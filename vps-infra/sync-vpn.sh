#!/bin/bash
# Conecta VPN FortiGate → corre sync → desconecta (solo si no había VPN previa)
set -e

YEAR=${1:-$(date +%Y)}
LOG=/var/log/s10-sync.log
PIDFILE=/tmp/openfortivpn.pid

log() { echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" >> "$LOG"; }

log "Iniciando sync year=$YEAR"

VPN_PREEXISTENTE=false

# Si ya hay una interfaz ppp activa, reutilizarla
if ip link show 2>/dev/null | grep -q 'ppp[0-9]'; then
  log "VPN ya activo — reutilizando conexión existente"
  VPN_PREEXISTENTE=true
else
  # Matar VPN previa si existe (PIDFILE stale)
  if [ -f "$PIDFILE" ]; then
    kill $(cat "$PIDFILE") 2>/dev/null || true
    rm -f "$PIDFILE"
    sleep 3
  fi

  # Conectar VPN
  openfortivpn -c /etc/openfortivpn/s10.conf 2>>"$LOG" &
  VPN_PID=$!
  echo $VPN_PID > "$PIDFILE"

  # Esperar interfaz ppp (max 60s)
  for i in $(seq 1 60); do
    sleep 1
    if ip link show 2>/dev/null | grep -q 'ppp[0-9]'; then
      log "ppp0 levantado tras ${i}s - esperando rutas/tunnel"
      # Espera adicional hasta que el SQL Server responda (max 30s)
      for j in $(seq 1 30); do
        if timeout 2 bash -c '</dev/tcp/192.168.1.51/1433' 2>/dev/null; then
          log "SQL accesible tras ${j}s - listo para sync"
          break
        fi
        sleep 1
      done
      break
    fi
    if [ $i -eq 60 ]; then
      log "ERROR: VPN no levantó en 60s"
      kill $VPN_PID 2>/dev/null; rm -f "$PIDFILE"; exit 1
    fi
  done
fi

# Sync
cd /opt/apps/s10bizsmarthub/s10-agent
log "Corriendo sync --year=$YEAR"
node sync-agent.js --year=$YEAR >> "$LOG" 2>&1
STATUS=${PIPESTATUS[0]}

# Solo desconectar si nosotros conectamos
if [ "$VPN_PREEXISTENTE" = "false" ] && [ -f "$PIDFILE" ]; then
  kill $(cat "$PIDFILE") 2>/dev/null || true
  rm -f "$PIDFILE"
fi

log "Sync completado year=$YEAR (status=$STATUS)"
