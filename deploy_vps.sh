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
# MIGRADO 2026-07-14: antes este paso hacia `git push origin main` sin
# importar la rama local real (convencion del repo: se trabaja en `develop`,
# main es la rama de deploy) -- eso podia pushear un `main` local
# desactualizado y pisar commits reales en remoto, o simplemente no llevar
# nada nuevo a main mientras el VPS seguia leyendo de ahi (paso el caso real:
# el rate-limit de auth.controller.ts vivio solo en develop varias horas
# mientras el VPS -- via tarball, ver nota de Paso 3 -- corria el codigo
# correcto igual porque el tarball empaqueta el working tree, no un ref de
# git; pero el git de main quedo desincronizado y una conversion a
# git-fetch-based deploy lo habria revertido en silencio de no corregirlo).
log "── Paso 1: Git push a GitHub (rama actual -> develop, luego merge a main) ──"

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
  CURRENT_BRANCH=$(git branch --show-current)
  # Agregar cambios si los hay, en la rama en la que el developer este parado
  git add . 2>/dev/null || true
  git diff --cached --quiet 2>/dev/null || git commit -m "chore: deploy update $(date '+%Y-%m-%d')" 2>/dev/null || true
  log "  Repo git existente (rama: $CURRENT_BRANCH) — OK"
fi

# Intentar push con gh CLI
if command -v gh > /dev/null 2>&1 && gh auth status > /dev/null 2>&1; then
  if ! git remote get-url origin > /dev/null 2>&1; then
    gh repo create s10bizsmarthub --public --source=. --remote=origin --push 2>&1 | tee -a "$LOG_FILE"
    log "  ✓ Repo GitHub creado y codigo subido"
  else
    CURRENT_BRANCH=$(git branch --show-current)
    git push origin "$CURRENT_BRANCH" 2>&1 | tee -a "$LOG_FILE" || log "  ⚠ Push de $CURRENT_BRANCH fallido — continuar con deploy"
    # main es la rama que el VPS realmente despliega (ver Paso 3). Si se
    # trabajo en otra rama (develop), mergearla a main AHORA -- nunca dejar
    # que el VPS reciba una version de main mas vieja que lo recien pusheado.
    if [ "$CURRENT_BRANCH" != "main" ]; then
      git fetch origin main -q 2>&1 | tee -a "$LOG_FILE" || true
      git checkout main 2>&1 | tee -a "$LOG_FILE"
      git merge "origin/$CURRENT_BRANCH" -m "Merge $CURRENT_BRANCH into main (deploy $(date '+%Y-%m-%d'))" 2>&1 | tee -a "$LOG_FILE"
      git push origin main 2>&1 | tee -a "$LOG_FILE" || log "  ⚠ Push de main fallido — continuar con deploy"
      git checkout "$CURRENT_BRANCH" 2>&1 | tee -a "$LOG_FILE"
    fi
    log "  ✓ Codigo subido a GitHub (main actualizado)"
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

# ── 3. Sincronizar codigo en el VPS (git fetch + reset) ───
# MIGRADO 2026-07-14 (regla #62/#34 global): antes este paso empaquetaba el
# working tree LOCAL entero en un tarball (incluyendo .git completo, sin
# excluirlo) y lo extraia pisando /opt/apps/s10bizsmarthub -- el codigo
# desplegado terminaba siendo un calco byte-a-byte de lo que hubiera en el
# disco local en ESE momento (comiteado o no), y el git del VPS quedaba
# atado a cualquier estado (limpio o sucio) que tuviera la maquina local al
# pushear, en vez de reflejar de forma confiable "lo que esta en GitHub".
# Ahora el VPS tiene su propio clone real (deploy key de solo lectura
# ~/.ssh/s10bizsmarthub_deploy, alias SSH `github-s10bizsmarthub`) y trae SU
# PROPIA copia de `main` con git fetch + reset --hard, igual que el resto
# del ecosistema -- inmune a que la maquina local tenga cambios sin
# commitear. Ver lecciones/2026-07-14-vera-git-desactualizado-no-era-drift.
log ""
log "── Paso 3: Sincronizando codigo en el VPS (git fetch + reset --hard origin/main) ──"

ssh $SSH_OPTS "$VPS" "
  set -e
  cd $VPS_APP_DIR
  git fetch origin main -q
  git reset --hard origin/main
  echo \"  HEAD=\$(git rev-parse --short HEAD)\"
" 2>&1 | tee -a "$LOG_FILE"

log "  ✓ Codigo en VPS sincronizado con GitHub"

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
  # Normalizar a LF: si el tarball trae CRLF (working copy Windows), bash en el
  # VPS falla con \"syntax error near \$'{\\r'\". Defensa independiente del git local.
  sed -i 's/\r\$//' $VPS_APP_DIR/sync-vpn.sh
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

# ── 5. Password real de Postgres ──────────────────────────
# ELIMINADO 2026-07-14: este paso hacia `sed -i` sobre docker-compose.prod.yml
# (un archivo TRACKEADO por git) para hornear la clave real de Postgres,
# reintroduciendo drift entre el VPS y GitHub cada vez que se corria (el
# mismo problema de fondo que llevo a migrar esta app a git-fetch-based
# deploy). La clave real ahora vive SOLO en $VPS_APP_DIR/.env (gitignored,
# *.env), que Docker Compose ya usa para resolver ${DB_PASSWORD:-...} sin
# tocar el yml. No revertir -- ver lecciones/2026-07-14-vera-git-desactualizado-no-era-drift.

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

  # Build explícito y separado: si tsc/prisma/next fallan, set -e aborta AQUÍ.
  docker compose -f docker-compose.prod.yml build s10biz-backend
  docker compose -f docker-compose.prod.yml build s10biz-frontend

  # up -d COMPLETO y SIN --force-recreate.  NO REVERTIR:
  #  - 'up -d <un-servicio>' (antes: 'up -d s10biz-db') aísla el servicio y puede dejarlo
  #    en 'Created' y/o recrearlo con nombre prefijado <hash>_<nombre>.
  #  - '--force-recreate' recrea aunque nada haya cambiado, y es el flujo donde compose
  #    hace ese renombrado. Como el reverse-proxy resuelve por NOMBRE, el resultado es un
  #    502 silencioso con el contenedor 'Up (healthy)'.
  # Compose ya recrea SOLO los servicios cuya imagen acaba de cambiar.
  docker compose -f docker-compose.prod.yml up -d

  echo ''
  echo 'Estado de contenedores s10biz:'
  docker ps --filter 'name=s10biz' --format 'table {{.Names}}\t{{.Status}}\t{{.Ports}}'

  # Verificación 1: nombre canónico + realmente corriendo (no Created/Exited/Restarting)
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

  # Verificación 2: el reverse-proxy los resuelve POR NOMBRE (si no, es 502 seguro).
  # Un 404/401 del backend es SANO: el proxy resolvió el nombre y conectó. El 502 lo
  # produce 'bad address' (nombre no resuelto) o 'Connection refused' (puerto malo).
  # SONDEO con reintentos: tras 'up -d' la app Node/Nest tarda unos segundos (o más, si
  # corre prisma migrate/seed) en empezar a escuchar el puerto, así que un 'connection
  # refused' inicial es NORMAL — no es un fallo. Se reintenta hasta ~90s antes de abortar.
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

# ── 10. Health check DESDE FUERA (no 'curl localhost') ────
# Un 'curl localhost:3202' dentro del VPS salta el reverse-proxy, el certificado y el
# DNS: pasa aunque el sitio esté caído para un usuario real. Se prueba el dominio
# público, desde esta máquina.
log ""
log "── Paso 9: Health check contra el dominio público ──"
sleep 15

PUB="https://s10bizsmarthub.bizwareapps.com"
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

# ── 11. Verificar el PROCESO DE SINCRONIZACIÓN ────────────
# El Paso 3 reemplaza $VPS_APP_DIR (mv + tar), lo que BORRA del root sync-trigger.js,
# sync-vpn.sh y s10-agent/node_modules; el Paso 4b los restaura. Si el deploy se corta
# entre medio (timeout, Ctrl-C), el sync queda ROTO EN SILENCIO: el cron falla porque
# sync-vpn.sh no existe, el servicio entra en crash-loop, y los DATOS SE CONGELAN sin
# que el sitio muestre nada raro. Caso real: 6 días sin sincronizar y nadie se enteró.
# Un deploy no está bien hasta que el sync también lo está.
log ""
log "── Paso 10: Verificando el proceso de sincronización ──"
SYNC_CHK=$(ssh $SSH_OPTS "$VPS" "
  miss=''
  [ -f $VPS_APP_DIR/sync-trigger.js ]        || miss=\"\$miss sync-trigger.js\"
  [ -x $VPS_APP_DIR/sync-vpn.sh ]            || miss=\"\$miss sync-vpn.sh(ejecutable)\"
  [ -d $VPS_APP_DIR/s10-agent/node_modules ] || miss=\"\$miss s10-agent/node_modules\"
  systemctl is-active --quiet s10-sync-trigger || miss=\"\$miss servicio-s10-sync-trigger\"
  [ -z \"\$miss\" ] && echo SYNC_OK || echo \"SYNC_ROTO:\$miss\"
" 2>&1 | tail -1)

if ! printf '%s' "$SYNC_CHK" | grep -q 'SYNC_OK'; then
  log "ERROR: el proceso de sincronización quedó incompleto -> $SYNC_CHK"
  log "  OJO: el sitio puede verse bien, pero los DATOS dejarán de actualizarse."
  log "  Arreglo: cp \$VPS_APP_DIR/vps-infra/{sync-trigger.js,sync-vpn.sh} al root,"
  log "           npm install --omit=dev en s10-agent, y systemctl restart s10-sync-trigger."
  exit 1
fi
log "  ✓ sync-trigger.js, sync-vpn.sh, node_modules y servicio activos"

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
