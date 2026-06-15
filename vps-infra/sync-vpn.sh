#!/bin/bash
# Conecta VPN FortiGate → corre sync → desconecta (solo si no había VPN previa)
# IMPORTANT: No usar set -e. Usar trap cleanup EXIT para garantizar desconexión del VPN
# incluso si el sync falla, para evitar dejar iptables/rutas en estado inválido.

YEAR=${1:-$(date +%Y)}
FAST_FLAG=${2:-}
FORENSICS_FLAG=${3:-}
LOG=/var/log/s10-sync.log
PIDFILE=/tmp/openfortivpn.pid

log() { echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" >> "$LOG"; }

# Variables globales para el cleanup
VPN_PREEXISTENTE=false
ETH_GW=""
ETH_DEV=""

cleanup() {
  local exit_code=$?
  if [ "$VPN_PREEXISTENTE" = "false" ] && [ -f "$PIDFILE" ]; then
    ip route del 192.168.1.0/24 dev ppp0 2>/dev/null || true
    kill "$(cat "$PIDFILE")" 2>/dev/null || true
    rm -f "$PIDFILE"
    # Restaurar ruta default por si openfortivpn la cambió de nuevo
    if [ -n "$ETH_GW" ] && [ -n "$ETH_DEV" ]; then
      ip route replace default via "$ETH_GW" dev "$ETH_DEV" 2>/dev/null || true
      log "Ruta default restaurada en cleanup → $ETH_DEV (via $ETH_GW)"
    fi
    log "VPN desconectada (cleanup, exit_code=$exit_code)"
  fi
}
trap cleanup EXIT

log "Iniciando sync year=$YEAR"

# Si ya hay una interfaz ppp activa, reutilizarla
if ip link show 2>/dev/null | grep -q 'ppp[0-9]'; then
  log "VPN ya activo — reutilizando conexión existente"
  VPN_PREEXISTENTE=true
else
  # Guardar ruta default actual (eth0) ANTES de conectar VPN
  ETH_GW=$(ip route show default | awk '/default via/ {print $3; exit}')
  ETH_DEV=$(ip route show default | awk '/default via/ {print $5; exit}')
  log "Ruta default previa: via ${ETH_GW:-?} dev ${ETH_DEV:-?}"

  # Conectar el VPN con reintentos. El FortiGate a veces rechaza la reconexión
  # ("Peer refused to agree to our IP address") porque aún retiene la IP de la
  # sesión anterior; un cooldown entre intentos la libera. Hasta 3 intentos.
  CONECTADO=false
  for intento in 1 2 3; do
    # Limpiar cualquier VPN previa/colgada antes de cada intento
    if [ -f "$PIDFILE" ]; then kill "$(cat "$PIDFILE")" 2>/dev/null || true; rm -f "$PIDFILE"; fi
    pkill -f 'openfortivpn -c /etc/openfortivpn/s10.conf' 2>/dev/null || true
    if [ "$intento" -gt 1 ]; then
      log "Reintento VPN #$intento — esperando 60s a que el FortiGate libere la IP"
      sleep 60
    else
      sleep 3
    fi

    # NOTA: openfortivpn maneja las rutas (NO usar --no-routes). Se probó
    # --no-routes para mantener SSH vivo, pero rompe el acceso a SQL: ppp0
    # levanta pero la red S10 queda inalcanzable (la ruta manual no basta).
    # El SSH cae durante el sync (openfortivpn pone default via ppp0); es
    # molestia aceptable — lo que importa es que SQL sea alcanzable.
    openfortivpn -c /etc/openfortivpn/s10.conf 2>>"$LOG" &
    VPN_PID=$!
    echo $VPN_PID > "$PIDFILE"

    # Esperar interfaz ppp (max 60s)
    VPN_LEVANTO=false
    for i in $(seq 1 60); do
      sleep 1
      if ip link show 2>/dev/null | grep -q 'ppp[0-9]'; then
        log "ppp0 levantado tras ${i}s (intento $intento)"
        VPN_LEVANTO=true
        # Seguro extra: la ruta default debe quedar en eth0, no en el túnel
        if [ -n "$ETH_GW" ] && [ -n "$ETH_DEV" ]; then
          ip route replace default via "$ETH_GW" dev "$ETH_DEV" 2>/dev/null || true
        fi
        ip route add 192.168.1.0/24 dev ppp0 2>/dev/null || true
        log "Ruta S10 192.168.1.0/24 → ppp0; default intacto en eth0 (SSH vivo)"
        break
      fi
    done

    if [ "$VPN_LEVANTO" = "false" ]; then
      log "VPN no levantó en 60s (intento $intento) — reintentando"
      kill "$VPN_PID" 2>/dev/null || true; rm -f "$PIDFILE"
      continue
    fi

    # Esperar a que el SQL Server responda (max 30s)
    SQL_OK=false
    for j in $(seq 1 30); do
      if timeout 2 bash -c '</dev/tcp/192.168.1.51/1433' 2>/dev/null; then
        log "SQL accesible tras ${j}s (intento $intento) — listo para sync"
        SQL_OK=true
        break
      fi
      sleep 1
    done

    if [ "$SQL_OK" = "true" ]; then
      CONECTADO=true
      break
    fi
    log "SQL no accesible en intento $intento — matando VPN y reintentando"
    kill "$VPN_PID" 2>/dev/null || true; rm -f "$PIDFILE"
  done

  if [ "$CONECTADO" != "true" ]; then
    log "ERROR: VPN/SQL no disponible tras 3 intentos — abortando"
    exit 1
  fi
fi

# Sync
cd /opt/apps/s10bizsmarthub/s10-agent
EXTRA_FLAGS=""
[ "$FAST_FLAG" = "fast" ] && EXTRA_FLAGS="--fast"
[ "$FORENSICS_FLAG" = "forensics" ] && EXTRA_FLAGS="$EXTRA_FLAGS --forensics"
log "Corriendo sync --year=$YEAR $EXTRA_FLAGS"

node sync-agent.js --year=$YEAR $EXTRA_FLAGS >> "$LOG" 2>&1
SYNC_STATUS=$?

if [ $SYNC_STATUS -ne 0 ]; then
  log "ERROR: sync-agent.js salió con código $SYNC_STATUS"
else
  log "Sync completado year=$YEAR exitosamente"
fi

exit $SYNC_STATUS
