#!/bin/bash
# Conecta VPN → corre validation-agent.js → desconecta
set -e

LOG=/var/log/s10-validation.log
PIDFILE=/tmp/openfortivpn-validate.pid
OUT=/opt/apps/s10bizsmarthub/s10-agent/validation-output.json

log() { echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" | tee -a "$LOG"; }

log "Iniciando validation"

VPN_PREEXISTENTE=false

if ip link show 2>/dev/null | grep -q 'ppp[0-9]'; then
  log "VPN ya activo — reutilizando"
  VPN_PREEXISTENTE=true
else
  if [ -f "$PIDFILE" ]; then
    kill $(cat "$PIDFILE") 2>/dev/null || true
    rm -f "$PIDFILE"
    sleep 3
  fi

  openfortivpn -c /etc/openfortivpn/s10.conf 2>>"$LOG" &
  VPN_PID=$!
  echo $VPN_PID > "$PIDFILE"

  for i in $(seq 1 60); do
    sleep 1
    if ip link show 2>/dev/null | grep -q 'ppp[0-9]'; then
      log "ppp0 OK tras ${i}s"
      for j in $(seq 1 30); do
        if timeout 2 bash -c '</dev/tcp/192.168.1.51/1433' 2>/dev/null; then
          log "SQL accesible tras ${j}s"
          break
        fi
        sleep 1
      done
      break
    fi
    if [ $i -eq 60 ]; then
      log "ERROR: VPN no levantó"
      kill $VPN_PID 2>/dev/null; rm -f "$PIDFILE"; exit 1
    fi
  done
fi

cd /opt/apps/s10bizsmarthub/s10-agent
log "Corriendo validation-agent.js"
node validation-agent.js --out="$OUT" 2>&1 | tee -a "$LOG"
STATUS=${PIPESTATUS[0]}

if [ "$VPN_PREEXISTENTE" = "false" ] && [ -f "$PIDFILE" ]; then
  kill $(cat "$PIDFILE") 2>/dev/null || true
  rm -f "$PIDFILE"
fi

log "Validation completada (status=$STATUS, output=$OUT)"
exit $STATUS
