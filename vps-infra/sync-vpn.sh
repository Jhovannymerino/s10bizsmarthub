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
ETH_IP=""
PPP_IFACE=""    # interfaz ppp especifica de ESTE script (nunca asumir "ppp0" a secas --
                # otros tuneles VPN de otros proyectos en el mismo VPS, ej. Pulso/
                # NuevaMasVida, corren su propio ppp0/ppp1/etc. de forma permanente. Ver
                # bizware-knowledge/global-engineering/standard/vpn-multitenant-aislamiento-de-rutas.md)
SSH_TABLE=100   # tabla de policy routing dedicada para el tráfico de gestión
SQL_HOST=192.168.1.51
SQL_PORT=1433

cleanup() {
  local exit_code=$?
  if [ "$VPN_PREEXISTENTE" = "false" ] && [ -f "$PIDFILE" ]; then
    # Quitar policy routing de gestión
    if [ -n "$ETH_IP" ]; then
      ip rule del from "$ETH_IP" table "$SSH_TABLE" 2>/dev/null || true
      ip route flush table "$SSH_TABLE" 2>/dev/null || true
    fi
    if [ -n "$PPP_IFACE" ]; then
      ip route del 192.168.1.0/24 dev "$PPP_IFACE" 2>/dev/null || true
    fi
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

# Si la red de S10 YA es alcanzable (no "si existe cualquier interfaz ppp" -- otros
# tuneles VPN de otros proyectos, ej. Pulso/NuevaMasVida, mantienen su propio ppp0
# permanentemente prendido en este mismo VPS y NO tienen nada que ver con la red de
# S10; asumir "ppp existe = mi VPN" reutilizaria por error el tunel de otro cliente).
if timeout 2 bash -c "</dev/tcp/${SQL_HOST}/${SQL_PORT}" 2>/dev/null; then
  log "Red S10 (${SQL_HOST}:${SQL_PORT}) ya alcanzable — reutilizando conexión existente"
  VPN_PREEXISTENTE=true
else
  # Guardar ruta default actual (eth0) ANTES de conectar VPN
  ETH_GW=$(ip route show default | awk '/default via/ {print $3; exit}')
  ETH_DEV=$(ip route show default | awk '/default via/ {print $5; exit}')
  ETH_IP=$(ip -4 -o addr show "$ETH_DEV" 2>/dev/null | awk '{print $4}' | cut -d/ -f1 | head -1)
  log "Ruta default previa: via ${ETH_GW:-?} dev ${ETH_DEV:-?} (IP ${ETH_IP:-?})"

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

    # Interfaces ppp que YA existen antes de conectar (ej. el tunel de otro proyecto
    # como Pulso/NuevaMasVida, que vive permanentemente prendido en este VPS) -- para
    # poder identificar cual interfaz es la NUEVA (la nuestra) despues de conectar, en
    # vez de asumir "ppp0" a secas.
    PPP_ANTES=$(ip -o link show 2>/dev/null | grep -oE 'ppp[0-9]+' | sort -u)

    # NOTA: openfortivpn maneja las rutas (NO usar --no-routes). Se probó
    # --no-routes para mantener SSH vivo, pero rompe el acceso a SQL: ppp levanta
    # pero la red S10 queda inalcanzable (la ruta manual no basta).
    # El SSH cae durante el sync (openfortivpn pone default via la interfaz ppp); es
    # molestia aceptable — lo que importa es que SQL sea alcanzable.
    openfortivpn -c /etc/openfortivpn/s10.conf 2>>"$LOG" &
    VPN_PID=$!
    echo $VPN_PID > "$PIDFILE"

    # Esperar a que aparezca una interfaz ppp NUEVA (que no estuviera en PPP_ANTES) —
    # max 60s. No alcanza con "cualquier ppp existe": si el tunel de otro proyecto ya
    # tiene ppp0 arriba, la interfaz nueva de ESTE script sera ppp1 (o la que
    # corresponda), nunca asumir el numero.
    VPN_LEVANTO=false
    for i in $(seq 1 60); do
      sleep 1
      PPP_AHORA=$(ip -o link show 2>/dev/null | grep -oE 'ppp[0-9]+' | sort -u)
      PPP_IFACE=$(comm -13 <(echo "$PPP_ANTES") <(echo "$PPP_AHORA") | head -1)
      if [ -n "$PPP_IFACE" ]; then
        log "Interfaz nueva levantada: ${PPP_IFACE} (tras ${i}s, intento $intento)"
        VPN_LEVANTO=true
        # POLICY ROUTING — mantiene vivo el acceso de gestión (SSH) sin perder
        # la ruta a SQL. openfortivpn maneja sus rutas normalmente (la red S10
        # queda alcanzable por su ppp), pero secuestra y renegocia la ruta default
        # → esa interfaz, lo que mataría el SSH. En vez de pelear por la tabla
        # principal (carrera que se pierde), creamos una tabla aparte: TODO el
        # tráfico cuyo ORIGEN sea la IP pública del VPS sale por eth0, pase lo que
        # pase con el túnel. openfortivpn no toca esta regla → SSH estable todo el sync.
        if [ -n "$ETH_IP" ] && [ -n "$ETH_GW" ] && [ -n "$ETH_DEV" ]; then
          ip route replace default via "$ETH_GW" dev "$ETH_DEV" table "$SSH_TABLE" 2>/dev/null || true
          ip rule del from "$ETH_IP" table "$SSH_TABLE" 2>/dev/null || true   # evitar duplicado
          ip rule add from "$ETH_IP" table "$SSH_TABLE" priority 100 2>/dev/null || true
          log "Policy routing: origen $ETH_IP → tabla $SSH_TABLE (eth0) — SSH vivo durante el sync"
        fi
        ip route add 192.168.1.0/24 dev "$PPP_IFACE" 2>/dev/null || true
        log "Ruta S10 192.168.1.0/24 → ${PPP_IFACE}"
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
