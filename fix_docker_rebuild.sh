#!/bin/bash
# Fix Docker build and restart containers
set -e

VPS="root@72.62.16.28"
SSH_OPTS="-o StrictHostKeyChecking=accept-new -o ConnectTimeout=30"
VPS_APP_DIR="/opt/apps/s10bizsmarthub"
PROJECT="/c/Users/jhova/OneDrive/antigravity-proyectos/s10bizsmarthub"

echo ""
echo "══════════════════════════════════════════"
echo "  S10 BizSmartHub — Fix & Rebuild Docker"
echo "══════════════════════════════════════════"
echo ""

# 1. Upload fixed Dockerfiles
echo "── Subiendo Dockerfiles corregidos ──"
scp $SSH_OPTS "$PROJECT/frontend/Dockerfile" "$VPS:$VPS_APP_DIR/frontend/Dockerfile"
scp $SSH_OPTS "$PROJECT/backend/Dockerfile" "$VPS:$VPS_APP_DIR/backend/Dockerfile"
echo "  ✓ Dockerfiles actualizados"

# 2. Check nginx conf.d path on VPS
echo ""
echo "── Verificando nginx en VPS ──"
ssh $SSH_OPTS "$VPS" "
  # Try to find conf.d from nginx container mounts
  NGINX_CONF_D=''
  for d in \$(docker inspect nginx --format='{{range .Mounts}}{{.Source}}:{{.Destination}} {{end}}' 2>/dev/null); do
    HOST=\$(echo \$d | cut -d: -f1)
    CONT=\$(echo \$d | cut -d: -f2)
    if [ \"\$CONT\" = '/etc/nginx/conf.d' ]; then
      NGINX_CONF_D=\"\$HOST\"
    fi
  done

  # Common fallbacks
  if [ -z \"\$NGINX_CONF_D\" ]; then
    for path in /opt/apps/nginx/conf.d /opt/nginx/conf.d /etc/nginx/conf.d /data/nginx/proxy_host /opt/nginx-proxy-manager/data/nginx/proxy_host; do
      [ -d \"\$path\" ] && NGINX_CONF_D=\"\$path\" && break
    done
  fi

  if [ -n \"\$NGINX_CONF_D\" ]; then
    cp $VPS_APP_DIR/nginx-s10block.conf \$NGINX_CONF_D/s10bizsmarthub.conf
    docker exec nginx nginx -t 2>&1 && docker exec nginx nginx -s reload && echo \"✓ nginx OK: \$NGINX_CONF_D\"
  else
    echo '⚠ conf.d no encontrado — buscando...'
    find /opt /etc /data /home -name 'conf.d' -type d 2>/dev/null | head -10
    echo ''
    echo 'Lista completa de contenedores:'
    docker ps --format 'table {{.Names}}\t{{.Status}}\t{{.Ports}}'
    echo ''
    echo 'Mounts del contenedor nginx:'
    docker inspect nginx --format='{{range .Mounts}}  {{.Source}} → {{.Destination}}{{println}}{{end}}' 2>/dev/null || echo 'Contenedor nginx no encontrado'
  fi
" 2>&1

# 3. Docker compose rebuild
echo ""
echo "── Rebuild Docker (sin cache en frontend y backend) ──"
ssh $SSH_OPTS "$VPS" "
  cd $VPS_APP_DIR
  echo 'Stopping existing containers...'
  docker compose -f docker-compose.prod.yml down 2>/dev/null || true

  echo 'Building (this takes a few minutes)...'
  docker compose -f docker-compose.prod.yml build --no-cache s10biz-db s10biz-api s10biz-frontend 2>&1

  echo ''
  echo 'Starting containers...'
  docker compose -f docker-compose.prod.yml up -d 2>&1

  echo ''
  echo 'Container status:'
  docker ps --filter 'name=s10biz' --format 'table {{.Names}}\t{{.Status}}\t{{.Ports}}'
" 2>&1

# 4. Wait and health check
echo ""
echo "── Esperando 20s para que inicien los servicios ──"
sleep 20

ssh $SSH_OPTS "$VPS" "
  echo 'Health check:'
  curl -sf http://localhost:3202/health -o /dev/null -w 'Backend HTTP: %{http_code}\n' 2>/dev/null || echo 'Backend: no responde aun'
  echo ''
  echo 'Backend logs (last 30 lines):'
  docker logs s10biz-api --tail 30 2>&1
  echo ''
  echo 'Frontend logs (last 10 lines):'
  docker logs s10biz-frontend --tail 10 2>&1
" 2>&1

echo ""
echo "══════════════════════════════════════════"
echo "  ✓ Fix completado"
echo "  URL: https://s10bizsmarthub.bizwareapps.com"
echo "══════════════════════════════════════════"
echo ""

read -p "Presiona Enter para cerrar..."
