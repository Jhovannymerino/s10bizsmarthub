#!/bin/bash
# ============================================================
# S10 BizSmartHub — Deploy automatico al VPS DEV
# Ejecutar con Git Bash desde Windows
#
# Hermano de deploy_vps.sh (PROD, 72.62.16.28) pero apuntando al VPS DEV
# (76.13.99.90, s10biz.bizwareapps-dev.com). Migrado a git-clone real el
# 2026-08-20 (antes era una copia de archivos sueltos sin .git — el mismo
# problema que ya se había corregido en PROD el 2026-07-14). Deploy key de
# solo lectura propia (~/.ssh/s10bizsmarthub_deploy en el VPS DEV, distinta
# de la de PROD), alias SSH `github-s10bizsmarthub`.
#
# Diferencias con deploy_vps.sh:
#   - docker-compose.dev.yml (no .prod.yml) — así corre el VPS DEV hoy.
#   - Sin Paso de sync-trigger systemd: el VPS DEV no tiene VPN a un S10
#     real, el servicio está inactivo a propósito (dato cargado a mano).
#     Si en algún momento DEV necesita sync en vivo, replicar el Paso 4b
#     de deploy_vps.sh aquí.
#   - Sin Paso de Certbot: el dominio usa un certificado compartido
#     (integralcontrol.bizwareapps-dev.com) hasta que el DNS de
#     s10biz.bizwareapps-dev.com tenga su propio cert dedicado.
# ============================================================

set -eo pipefail

VPS="root@76.13.99.90"
SSH_OPTS="-o StrictHostKeyChecking=accept-new -o ConnectTimeout=30 -o BatchMode=no"
PROJECT="/c/Users/jhova/OneDrive/antigravity-proyectos/s10bizsmarthub"
VPS_APP_DIR="/opt/apps/s10bizsmarthub"
LOG_FILE="$PROJECT/deploy_dev_$(date +%Y%m%d_%H%M%S).log"

log() { echo "$@" | tee -a "$LOG_FILE"; }

log ""
log "╔══════════════════════════════════════════════════════╗"
log "║   S10 BizSmartHub — Deploy DEV  $(date '+%d/%m/%Y %H:%M')    ║"
log "╚══════════════════════════════════════════════════════╝"
log ""

# ── 1. GitHub ─────────────────────────────────────────────
log "── Paso 1: Git push a GitHub (rama actual -> main si corresponde) ──"

cd "$PROJECT"
CURRENT_BRANCH=$(git branch --show-current)
git add . 2>/dev/null || true
git diff --cached --quiet 2>/dev/null || git commit -m "chore: deploy dev update $(date '+%Y-%m-%d')" 2>/dev/null || true

git push origin "$CURRENT_BRANCH" 2>&1 | tee -a "$LOG_FILE" || log "  ⚠ Push de $CURRENT_BRANCH fallido — continuar con deploy"
if [ "$CURRENT_BRANCH" != "main" ]; then
  git fetch origin main -q 2>&1 | tee -a "$LOG_FILE" || true
  git checkout main 2>&1 | tee -a "$LOG_FILE"
  git merge "origin/$CURRENT_BRANCH" -m "Merge $CURRENT_BRANCH into main (deploy dev $(date '+%Y-%m-%d'))" 2>&1 | tee -a "$LOG_FILE"
  git push origin main 2>&1 | tee -a "$LOG_FILE" || log "  ⚠ Push de main fallido — continuar con deploy"
  git checkout "$CURRENT_BRANCH" 2>&1 | tee -a "$LOG_FILE"
fi
log "  ✓ Codigo subido a GitHub (main actualizado)"

# ── 2. Verificar conexion SSH al VPS ──────────────────────
log ""
log "── Paso 2: Verificando conexion VPS DEV ──"

if ! ssh $SSH_OPTS "$VPS" "echo 'VPS OK'" 2>&1 | tee -a "$LOG_FILE" | grep -q "VPS OK"; then
  log "  ✗ No se pudo conectar al VPS $VPS"
  read -p "Presiona Enter para cerrar..."
  exit 1
fi
log "  ✓ Conexion SSH OK"

# ── 3. Sincronizar codigo en el VPS (git fetch + reset) ───
log ""
log "── Paso 3: Sincronizando codigo en el VPS DEV (git fetch + reset --hard origin/main) ──"

ssh $SSH_OPTS "$VPS" "
  set -e
  cd $VPS_APP_DIR
  git fetch origin main -q
  git reset --hard origin/main
  echo \"  HEAD=\$(git rev-parse --short HEAD)\"
" 2>&1 | tee -a "$LOG_FILE"

log "  ✓ Codigo en VPS DEV sincronizado con GitHub"

# ── 4. Configurar .env en VPS ─────────────────────────────
log ""
log "── Paso 4: Configurando variables de entorno (DEV) ──"

# Se respalda el .env actual ANTES de pisarlo — ahí vive ANTHROPIC_API_KEY
# (ver nota más abajo, no se versiona en este script).
ssh $SSH_OPTS "$VPS" "cp $VPS_APP_DIR/backend/.env $VPS_APP_DIR/backend/.env.bak 2>/dev/null || true"

ssh $SSH_OPTS "$VPS" "cat > $VPS_APP_DIR/backend/.env" << 'ENVEOF'
NODE_ENV=production
PORT=3202
JWT_SECRET=17142b529428835988c63d96763d22ce347b0df0b3d8aea2097c33d4a3f8eba9
JWT_EXPIRATION=8h
DATABASE_URL=postgresql://postgres:7949413b5c1997927dd3b57c@s10biz-db:5432/s10biz_db?schema=public
S10_HOST=192.168.1.XXX
S10_PORT=1433
S10_USER=sa
S10_PASSWORD=
S10_DATABASE=CMO
S10_SYNC_MODE=push
SYNC_API_KEY=1fe0bf01e872d7f586e4828abcdc1ba0a5283f5625570128
CORS_ORIGINS=https://s10biz.bizwareapps-dev.com
SMTP_HOST=smtp.hostinger.com
SMTP_PORT=465
SMTP_SECURE=true
SMTP_USER=admin@bizwareapps-dev.com
SMTP_PASS=3x1t05H@@
SMTP_FROM_EMAIL=admin@bizwareapps-dev.com
ENVEOF

# ANTHROPIC_API_KEY: NO se versiona (a diferencia de los demás secretos de esta
# app, es una credencial de un proveedor externo — GitHub push protection la
# detecta y bloquea el push, y con razón). Se preserva la línea que ya exista
# en el .env remoto en vez de pisarla; si nunca se configuró, hay que agregarla
# a mano una vez en el VPS.
ssh $SSH_OPTS "$VPS" "
  grep -q '^ANTHROPIC_API_KEY=' $VPS_APP_DIR/backend/.env.bak 2>/dev/null && \
    grep '^ANTHROPIC_API_KEY=' $VPS_APP_DIR/backend/.env.bak >> $VPS_APP_DIR/backend/.env || true
" 2>&1 | tee -a "$LOG_FILE"

log "  ✓ .env configurado"

# ── 5. Docker network ─────────────────────────────────────
log ""
log "── Paso 5: Docker network ──"

ssh $SSH_OPTS "$VPS" "
  docker network ls | grep -q app_default && echo 'app_default ya existe' || docker network create app_default
" 2>&1 | tee -a "$LOG_FILE"
log "  ✓ Network app_default OK"

# ── 6. Docker Compose UP (docker-compose.dev.yml) ─────────
log ""
log "── Paso 6: Levantando contenedores (docker-compose.dev.yml) ──"

ssh $SSH_OPTS "$VPS" "
  set -e
  cd $VPS_APP_DIR

  export BUILDX_NO_DEFAULT_ATTESTATIONS=1

  docker compose -f docker-compose.dev.yml build s10biz-backend
  docker compose -f docker-compose.dev.yml build s10biz-frontend

  HUERFANOS=\$(docker ps -a --format '{{.Names}}' | grep -E '^[0-9a-f]{8,}_s10biz-' || true)
  if [ -n \"\$HUERFANOS\" ]; then
    echo \"  Removiendo contenedores huérfanos con prefijo de hash: \$HUERFANOS\"
    echo \"\$HUERFANOS\" | xargs -r docker rm -f || true
  fi

  docker compose -f docker-compose.dev.yml up -d

  echo ''
  echo 'Estado de contenedores s10biz:'
  docker ps --filter 'name=s10biz' --format 'table {{.Names}}\t{{.Status}}\t{{.Ports}}'

  for c in s10biz-db s10biz-api s10biz-web; do
    st=\$(docker inspect -f '{{.State.Status}}' \$c 2>/dev/null || echo missing)
    if [ \"\$st\" != 'running' ]; then
      echo \"ERROR: contenedor \$c en estado '\$st' tras el deploy\"
      docker logs \$c --tail 30 2>&1 || true
      exit 1
    fi
  done
  PREF=\$(docker ps -a --format '{{.Names}}' | grep -E '_s10biz-' || true)
  if [ -n \"\$PREF\" ]; then
    echo \"ERROR: contenedores con nombre prefijado (el proxy no los encuentra): \$PREF\"
    exit 1
  fi

  for pair in s10biz-api:3202 s10biz-web:3100; do
    okp=false
    for i in \$(seq 1 30); do
      OUT=\$(docker exec reverse-proxy sh -lc \"wget -O /dev/null -T 5 http://\$pair\" 2>&1 || true)
      if printf '%s' \"\$OUT\" | grep -qiE \"bad address|can't connect|connection refused|timed out|no route to host\"; then
        sleep 3
      else
        okp=true; break
      fi
    done
    if [ \"\$okp\" != 'true' ]; then
      echo \"ERROR: el reverse-proxy NO alcanza \$pair tras ~90s -> \$(printf '%s' \"\$OUT\" | tail -1)\"
      exit 1
    fi
    echo \"✓ proxy -> \$pair\"
  done
  echo '✓ Contenedores corriendo la imagen nueva, con nombre canónico y visibles para el proxy'
" 2>&1 | tee -a "$LOG_FILE"

# ── 7. Health check DESDE FUERA ───────────────────────────
log ""
log "── Paso 7: Health check contra el dominio público ──"
sleep 10

PUB="https://s10biz.bizwareapps-dev.com"
ok=false
for i in $(seq 1 10); do
  code=$(curl -s -o /dev/null -w '%{http_code}' -m 20 -L "$PUB/" || echo 000)
  if [ "$code" = "200" ]; then
    log "  ✓ $PUB -> 200"
    ok=true; break
  fi
  log "  intento $i: $PUB -> $code"
  sleep 5
done

if [ "$ok" != 'true' ]; then
  log "ERROR: $PUB no respondió 200 tras el deploy — NO des el deploy por bueno."
  ssh $SSH_OPTS "$VPS" "docker logs s10biz-api --tail 30 2>&1" | tee -a "$LOG_FILE" || true
  exit 1
fi

log ""
log "╔══════════════════════════════════════════════════════╗"
log "║   ✓ DEPLOY DEV COMPLETADO — $(date '+%H:%M:%S')               ║"
log "╠══════════════════════════════════════════════════════╣"
log "║   URL: https://s10biz.bizwareapps-dev.com            ║"
log "║   Log: $LOG_FILE"
log "╚══════════════════════════════════════════════════════╝"
log ""

read -p "Presiona Enter para cerrar..."
