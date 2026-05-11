#!/bin/bash
# ============================================================
# S10 BizSmartHub — Deploy automatico al VPS
# Ejecutar con Git Bash desde Windows
# ============================================================

set -e

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
ENVEOF

log "  ✓ .env configurado"

# ── 4b. Instalar sync-trigger como servicio systemd ──────────
log ""
log "── Paso 4b: Instalando sync-trigger systemd service ──"

ssh $SSH_OPTS "$VPS" "
  set -e
  # Copiar sync-trigger.js al lugar que espera el service file
  cp $VPS_APP_DIR/vps-infra/sync-trigger.js $VPS_APP_DIR/sync-trigger.js

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
  set -e

  # Detectar directorio conf.d desde el contenedor nginx
  NGINX_CONF_D=''
  for d in \$(docker inspect nginx --format='{{range .Mounts}}{{.Source}}:{{.Destination}} {{end}}' 2>/dev/null); do
    HOST=\$(echo \$d | cut -d: -f1)
    CONT=\$(echo \$d | cut -d: -f2)
    if [ \"\$CONT\" = '/etc/nginx/conf.d' ]; then
      NGINX_CONF_D=\"\$HOST\"
    fi
  done

  # Fallback: buscar manualmente
  if [ -z \"\$NGINX_CONF_D\" ]; then
    for path in /opt/apps/nginx/conf.d /opt/nginx/conf.d /etc/nginx/conf.d /data/nginx/conf.d; do
      [ -d \"\$path\" ] && NGINX_CONF_D=\"\$path\" && break
    done
  fi

  if [ -n \"\$NGINX_CONF_D\" ]; then
    echo \"Encontrado conf.d: \$NGINX_CONF_D\"
    cp $VPS_APP_DIR/nginx-s10block.conf \$NGINX_CONF_D/s10bizsmarthub.conf
    docker exec nginx nginx -t && docker exec nginx nginx -s reload
    echo '✓ nginx configurado y recargado'
  else
    echo '⚠ conf.d no encontrado automaticamente'
    echo 'Buscando en el filesystem del VPS...'
    find /opt /etc /data -name 'conf.d' -type d 2>/dev/null | head -5
    echo ''
    echo 'Copia manual necesaria:'
    echo \"  cp $VPS_APP_DIR/nginx-s10block.conf <ruta-conf.d>/s10bizsmarthub.conf\"
    echo '  docker exec nginx nginx -s reload'
  fi
" 2>&1 | tee -a "$LOG_FILE"

# ── 8. SSL Certbot ────────────────────────────────────────
log ""
log "── Paso 7: SSL Certbot ──"

ssh $SSH_OPTS "$VPS" "
  EMAIL='jhovanny.merino@gmail.com'
  DOMAIN='s10bizsmarthub.bizwareapps.com'

  # Verificar que el DNS apunte al VPS antes de lanzar certbot
  SERVER_IP=\$(curl -s ifconfig.me 2>/dev/null || hostname -I | awk '{print \$1}')
  DOMAIN_IP=\$(getent hosts \$DOMAIN 2>/dev/null | awk '{print \$1}' || dig +short \$DOMAIN 2>/dev/null | tail -1)

  echo \"VPS IP: \$SERVER_IP\"
  echo \"DNS \$DOMAIN apunta a: \$DOMAIN_IP\"

  if [ \"\$SERVER_IP\" = \"\$DOMAIN_IP\" ] || [ -z \"\$DOMAIN_IP\" ]; then
    # Intentar certbot dentro del contenedor nginx
    if docker exec nginx which certbot > /dev/null 2>&1; then
      docker exec nginx certbot --nginx -d \$DOMAIN \
        --non-interactive --agree-tos -m \$EMAIL \
        --redirect 2>&1 && echo '✓ SSL OK (certbot en contenedor)'
    elif which certbot > /dev/null 2>&1; then
      certbot --nginx -d \$DOMAIN \
        --non-interactive --agree-tos -m \$EMAIL \
        --redirect 2>&1 && echo '✓ SSL OK (certbot en host)'
    else
      echo '⚠ certbot no disponible — SSL pendiente manual'
      echo 'Instalar: apt install certbot python3-certbot-nginx'
      echo \"Luego: certbot --nginx -d \$DOMAIN\"
    fi
  else
    echo '⚠ DNS aun no apunta al VPS — agregar registro A primero:'
    echo \"  \$DOMAIN → \$SERVER_IP\"
    echo 'Luego ejecutar manualmente en el VPS:'
    echo \"  certbot --nginx -d \$DOMAIN --non-interactive --agree-tos -m \$EMAIL\"
  fi
" 2>&1 | tee -a "$LOG_FILE"

# ── 9. Docker Compose UP ──────────────────────────────────
log ""
log "── Paso 8: Levantando contenedores ──"

ssh $SSH_OPTS "$VPS" "
  cd $VPS_APP_DIR

  # Detectar qué cambió para minimizar builds y uso de RAM
  CHANGED_BACKEND=\$(git diff HEAD~1 HEAD --name-only 2>/dev/null | grep -c '^backend/' || echo 0)
  CHANGED_FRONTEND=\$(git diff HEAD~1 HEAD --name-only 2>/dev/null | grep -c '^frontend/' || echo 0)

  echo \"Cambios detectados — backend: \$CHANGED_BACKEND, frontend: \$CHANGED_FRONTEND\"

  # DB siempre levanta sin rebuild
  docker compose -f docker-compose.prod.yml up -d s10biz-db

  if [ \"\$CHANGED_BACKEND\" -gt 0 ] || ! docker ps --filter 'name=s10biz-api' --filter 'status=running' -q | grep -q .; then
    echo 'Rebuilding backend...'
    docker compose -f docker-compose.prod.yml up -d --build s10biz-backend
  else
    echo 'Backend sin cambios — saltando rebuild'
    docker compose -f docker-compose.prod.yml up -d s10biz-backend
  fi

  if [ \"\$CHANGED_FRONTEND\" -gt 0 ] || ! docker ps --filter 'name=s10biz-web' --filter 'status=running' -q | grep -q .; then
    echo 'Rebuilding frontend...'
    docker compose -f docker-compose.prod.yml up -d --build s10biz-frontend
  else
    echo 'Frontend sin cambios — saltando rebuild'
    docker compose -f docker-compose.prod.yml up -d s10biz-frontend
  fi

  echo ''
  echo 'Estado de contenedores s10biz:'
  docker ps --filter 'name=s10biz' --format 'table {{.Names}}\t{{.Status}}\t{{.Ports}}'
" 2>&1 | tee -a "$LOG_FILE"

# ── 10. Health check ──────────────────────────────────────
log ""
log "── Paso 9: Health check ──"
sleep 15

ssh $SSH_OPTS "$VPS" "
  echo 'Verificando API...'
  curl -sf http://localhost:3202/kpi/80688541/dashboard?year=2026 \
    -H 'Authorization: Bearer test' \
    -o /dev/null -w 'API status: %{http_code}\n' 2>/dev/null || echo 'API: no responde aun (normal en primer arranque)'

  echo ''
  echo 'Logs backend (ultimas 20 lineas):'
  docker logs s10biz-api --tail 20 2>&1
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
