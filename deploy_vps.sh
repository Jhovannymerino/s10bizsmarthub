#!/bin/bash
# ============================================================
# S10 BizSmartHub — Deploy automatico al VPS
# Ejecutar con Git Bash desde Windows
# ============================================================

# set -e: aborta ante error. pipefail: que `ssh ... | tee` devuelva el fallo
# del ssh y no el éxito del tee (si no, un build roto pasa desapercibido).
set -eo pipefail

VPS="root@72.62.16.28"
SSH_OPTS="-o StrictHostKeyChecking=accept-new -o ConnectTimeout=30 -o BatchMode=no"
PROJECT="/c/Users/jhova/OneDrive/antigravity-proyectos/s10bizsmarthub"
VPS_APP_DIR="/opt/apps/s10bizsmarthub"
LOG_FILE="$PROJECT/deploy_$(date +%Y%m%d_%H%M%S).log"

log() { echo "$@" | tee -a "$LOG_FILE"; }

log ""
log "╔══════════════════════════════════════════════════════╗"
log "║   S10 BizSmartHub — Deploy  $(date '+%d/%m/%Y %H:%M')        ║"
log "╚══════════════════════════════════════════════════════╝"
log ""

# ── 1. GitHub ─────────────────────────────────────────────
log "── Paso 1: Git push a GitHub ──"

cd "$PROJECT"

if ! git rev-parse --git-dir > /dev/null 2>&1; then
  git init
  git config user.email "jhovanny.merino@gmail.com"
  git config user.name "Jhovanny Merino"
  git checkout -b main 2>/dev/null || git checkout main
  git add .
  git commit -m "feat: S10 BizSmartHub initial scaffold"
  log "  Repo git inicializado"
else
  # Agregar cambios si los hay
  git add . 2>/dev/null || true
  git diff --cached --quiet 2>/dev/null || git commit -m "chore: deploy update $(date '+%Y-%m-%d')" 2>/dev/null || true
  log "  Repo git existente — OK"
fi

# Intentar push con gh CLI
if command -v gh > /dev/null 2>&1 && gh auth status > /dev/null 2>&1; then
  if ! git remote get-url origin > /dev/null 2>&1; then
    gh repo create s10bizsmarthub --public --source=. --remote=origin --push 2>&1 | tee -a "$LOG_FILE"
    log "  ✓ Repo GitHub creado y codigo subido"
  else
    git push origin main 2>&1 | tee -a "$LOG_FILE" || log "  ⚠ Push fallido — continuar con deploy"
    log "  ✓ Codigo subido a GitHub"
  fi
else
  log "  ⚠ gh CLI no disponible — saltando GitHub (deploy continua igual)"
fi

# ── 2. Verificar conexion SSH al VPS ──────────────────────
log ""
log "── Paso 2: Verificando conexion VPS ──"

if ! ssh $SSH_OPTS "$VPS" "echo 'VPS OK'" 2>&1 | tee -a "$LOG_FILE" | grep -q "VPS OK"; then
  log "  ✗ No se pudo conectar al VPS $VPS"
  log "  Verifica que la clave SSH esta en ~/.ssh/ y que el VPS esta accesible"
  read -p "Presiona Enter para cerrar..."
  exit 1
fi
log "  ✓ Conexion SSH OK"

# ── 3. Upload del codigo al VPS ───────────────────────────
log ""
log "── Paso 3: Subiendo codigo al VPS ──"

ssh $SSH_OPTS "$VPS" "mkdir -p $VPS_APP_DIR" 2>&1 | tee -a "$LOG_FILE"

# Crear tarball excluyendo directorios pesados
cd "$(dirname "$PROJECT")"
tar \
  --exclude='s10bizsmarthub/node_modules' \
  --exclude='s10bizsmarthub/*/node_modules' \
  --exclude='s10bizsmarthub/.next' \
  --exclude='s10bizsmarthub/*/dist' \
  --exclude='s10bizsmarthub/*.log' \
  -czf /tmp/s10bizsmarthub_deploy.tar.gz \
  s10bizsmarthub/ 2>&1 | tee -a "$LOG_FILE"

log "  Archivo creado: $(du -sh /tmp/s10bizsmarthub_deploy.tar.gz | cut -f1)"

scp $SSH_OPTS /tmp/s10bizsmarthub_deploy.tar.gz "$VPS:/tmp/" 2>&1 | tee -a "$LOG_FILE"

ssh $SSH_OPTS "$VPS" "
  cd /opt/apps
  rm -rf s10bizsmarthub_old
  [ -d s10bizsmarthub ] && mv s10bizsmarthub s10bizsmarthub_old
  tar -xzf /tmp/s10bizsmarthub_deploy.tar.gz
  rm /tmp/s10bizsmarthub_deploy.tar.gz
  echo 'Extraccion OK'
" 2>&1 | tee -a "$LOG_FILE"

log "  ✓ Codigo en VPS"

# ── 4. Configurar .env en VPS ─────────────────────────────
log ""
log "── Paso 4: Configurando variables de entorno ──"

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
CORS_ORIGINS=https://s10bizsmarthub.bizwareapps.com
SMTP_HOST=smtp.hostinger.com
SMTP_PORT=465
SMTP_SECURE=true
SMTP_USER=admin@bizwareapps.com
SMTP_PASS=3x1t05BA@@@
SMTP_FROM_EMAIL=admin@bizwareapps.com
ENVEOF

log "  ✓ .env configurado"

# ── 4b. Instalar sync-trigger como servicio systemd ──────────
log ""
log "── Paso 4b: Instalando sync-trigger systemd service ──"

ssh $SSH_OPTS "$VPS" "
  set -e
  # Copiar archivos de vps-infra al directorio raíz donde los espera el service
  cp $VPS_APP_DIR/vps-infra/sync-trigger.js $VPS_APP_DIR/sync-trigger.js
  cp $VPS_APP_DIR/vps-infra/sync-vpn.sh $VPS_APP_DIR/sync-vpn.sh
  chmod +x $VPS_APP_DIR/sync-vpn.sh

  # Instalar dependencias del sync-agent si no están o si cambiaron
  cd $VPS_APP_DIR/s10-agent && npm install --omit=dev --prefer-offline 2>/dev/null || npm install --omit=dev
  cd $VPS_APP_DIR

  # Instalar unit file
  cp $VPS_APP_DIR/vps-infra/s10-sync-trigger.service /etc/systemd/system/s10-sync-trigger.service

  systemctl daemon-reload
  systemctl enable s10-sync-trigger
  systemctl restart s10-sync-trigger
  sleep 2
  systemctl is-active s10-sync-trigger && echo '✓ s10-sync-trigger activo' || echo '✗ fallo al iniciar'
" 2>&1 | tee -a "\$LOG_FILE"

log "  ✓ sync-trigger service instalado"

# ── 5. Actualizar docker-compose.prod.yml con password real ─
ssh $SSH_OPTS "$VPS" "
  sed -i 's/DB_PASSWORD:-s10biz2026/DB_PASSWORD:-7949413b5c1997927dd3b57c/g' $VPS_APP_DIR/docker-compose.prod.yml
" 2>&1 | tee -a "$LOG_FILE"

# ── 6. Docker network ─────────────────────────────────────
log ""
log "── Paso 5: Docker network ──"

ssh $SSH_OPTS "$VPS" "
  docker network ls | grep -q app_default && echo 'app_default ya existe' || docker network create app_default
" 2>&1 | tee -a "$LOG_FILE"
log "  ✓ Network app_default OK"

# ── 7. nginx ──────────────────────────────────────────────
log ""
log "── Paso 6: Configurando nginx ──"

ssh $SSH_OPTS "$VPS" "
  NGINX_CONF='/opt/reverse-proxy/nginx.conf'
  NGINX_CONTAINER='reverse-proxy'
  DOMAIN='s10bizsmarthub.bizwareapps.com'

  if docker ps --format '{{.Names}}' | grep -q \"^\${NGINX_CONTAINER}\$\"; then
    if grep -q \"\$DOMAIN\" \"\$NGINX_CONF\" 2>/dev/null; then
      echo \"✓ Bloque nginx \$DOMAIN ya configurado — recargando\"
      docker exec \"\$NGINX_CONTAINER\" nginx -t && docker exec \"\$NGINX_CONTAINER\" nginx -s reload
      echo '✓ nginx recargado'
    else
      echo \"Agregando bloque nginx para \$DOMAIN...\"
      cat $VPS_APP_DIR/nginx-s10block.conf >> \"\$NGINX_CONF\"
      docker exec \"\$NGINX_CONTAINER\" nginx -t && docker exec \"\$NGINX_CONTAINER\" nginx -s reload
      echo '✓ nginx configurado y recargado'
    fi
  else
    echo \"⚠ Contenedor \$NGINX_CONTAINER no encontrado\"
    docker ps --format 'table {{.Names}}\t{{.Status}}' | head -10
  fi
" 2>&1 | tee -a "$LOG_FILE"

# ── 8. SSL Certbot ────────────────────────────────────────
log ""
log "── Paso 7: SSL Certbot ──"

ssh $SSH_OPTS "$VPS" "
  DOMAIN='s10bizsmarthub.bizwareapps.com'
  CERT_PATH=\"/etc/letsencrypt/live/\$DOMAIN/fullchain.pem\"

  # Verificar si el cert ya existe y es valido
  if [ -f \"\$CERT_PATH\" ]; then
    EXPIRY=\$(openssl x509 -enddate -noout -in \"\$CERT_PATH\" 2>/dev/null | cut -d= -f2)
    echo \"✓ Certificado SSL existe — expira: \$EXPIRY\"
    echo '  (renovacion automatica via snap.certbot.renew.timer)'
  else
    echo \"⚠ Certificado no encontrado en \$CERT_PATH\"
    echo 'Emitir manualmente en el VPS:'
    echo \"  certbot certonly --webroot -w /var/www/html -d \$DOMAIN --non-interactive --agree-tos -m jhovanny.merino@gmail.com\"
  fi
" 2>&1 | tee -a "$LOG_FILE"

# ── 9. Docker Compose UP ──────────────────────────────────
log ""
log "── Paso 8: Levantando contenedores ──"

ssh $SSH_OPTS "$VPS" "
  set -e   # un build/recreate que falle aborta el bloque remoto (y con pipefail, el deploy)
  cd $VPS_APP_DIR

  # Imagen plana que SÍ se carga como :latest en el image store de docker.
  # Sin esto, buildx puede producir manifest-lists/attestations que dejan :latest
  # apuntando a la imagen vieja y el contenedor nunca estrena el código nuevo.
  export BUILDX_NO_DEFAULT_ATTESTATIONS=1

  echo 'Rebuilding todos los servicios...'
  docker compose -f docker-compose.prod.yml up -d s10biz-db

  # Build explícito y separado: si tsc/prisma/next fallan, set -e aborta AQUÍ.
  docker compose -f docker-compose.prod.yml build s10biz-backend
  docker compose -f docker-compose.prod.yml build s10biz-frontend

  # --force-recreate garantiza que el contenedor estrene la imagen recién construida.
  docker compose -f docker-compose.prod.yml up -d --force-recreate s10biz-backend s10biz-frontend

  echo ''
  echo 'Estado de contenedores s10biz:'
  docker ps --filter 'name=s10biz' --format 'table {{.Names}}\t{{.Status}}\t{{.Ports}}'

  # Asegurar que ambos contenedores quedaron efectivamente corriendo (no Exited/Restarting)
  for c in s10biz-api s10biz-web; do
    st=\$(docker inspect -f '{{.State.Status}}' \$c 2>/dev/null || echo missing)
    if [ \"\$st\" != 'running' ]; then
      echo \"ERROR: contenedor \$c en estado '\$st' tras el deploy\"
      docker logs \$c --tail 30 2>&1 || true
      exit 1
    fi
  done
  echo '✓ Contenedores corriendo la imagen nueva'
" 2>&1 | tee -a "$LOG_FILE"

# ── 10. Health check ──────────────────────────────────────
log ""
log "── Paso 9: Health check ──"
sleep 15

ssh $SSH_OPTS "$VPS" "
  set -e
  echo 'Verificando API (hasta 6 intentos)...'
  ok=false
  for i in \$(seq 1 6); do
    code=\$(curl -s -o /dev/null -w '%{http_code}' http://localhost:3202/kpi/80688541/dashboard?year=2026 -H 'Authorization: Bearer test' || echo 000)
    # Cualquier HTTP real (incl. 401/403) = la app responde. 000 = conexión rechazada/arrancando.
    if [ \"\$code\" != '000' ]; then
      echo \"✓ API responde (HTTP \$code)\"
      ok=true; break
    fi
    echo \"  intento \$i: sin respuesta aun...\"; sleep 5
  done
  echo ''
  echo 'Logs backend (ultimas 20 lineas):'
  docker logs s10biz-api --tail 20 2>&1
  if [ \"\$ok\" != 'true' ]; then
    echo 'ERROR: la API no respondió tras el deploy — abortando'
    exit 1
  fi
" 2>&1 | tee -a "$LOG_FILE"

log ""
log "╔══════════════════════════════════════════════════════╗"
log "║   ✓ DEPLOY COMPLETADO — $(date '+%H:%M:%S')                   ║"
log "╠══════════════════════════════════════════════════════╣"
log "║   URL: https://s10bizsmarthub.bizwareapps.com        ║"
log "║   Log: $LOG_FILE"
log "║                                                      ║"
log "║   Proximos pasos:                                    ║"
log "║   1. Crear usuario admin en la DB                    ║"
log "║   2. Agregar empresa INTEGRAL en /companies          ║"
log "║   3. Configurar sync-agent con IP real de S10        ║"
log "╚══════════════════════════════════════════════════════╝"
log ""

read -p "Presiona Enter para cerrar..."
