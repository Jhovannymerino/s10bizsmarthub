#!/bin/bash
set -e

VPN_HOST="${VPN_HOST:-38.19.155.202}"
VPN_PORT="${VPN_PORT:-10443}"
VPN_USER="${VPN_USER:-oleon}"
VPN_PASS="${VPN_PASS:-auditor5}"
YEAR="${YEAR:-$(date +%Y)}"

echo "=== Conectando VPN FortiGate $VPN_HOST:$VPN_PORT ==="

# Obtener trusted-cert fingerprint
CERT=$(echo | openssl s_client -connect "$VPN_HOST:$VPN_PORT" 2>/dev/null \
    | openssl x509 -fingerprint -sha256 -noout 2>/dev/null \
    | sed 's/sha256 Fingerprint=//' | tr -d ':' | tr 'A-F' 'a-f' 2>/dev/null || true)

echo "Cert fingerprint: $CERT"

# Crear config de openfortivpn
cat > /tmp/vpn.conf <<EOF
host = $VPN_HOST
port = $VPN_PORT
username = $VPN_USER
password = $VPN_PASS
set-routes = 0
set-dns = 0
EOF
[ -n "$CERT" ] && echo "trusted-cert = $CERT" >> /tmp/vpn.conf

# Conectar en background
echo "Iniciando tunnel VPN..."
openfortivpn -c /tmp/vpn.conf &
VPN_PID=$!

# Esperar tunnel (max 30s)
for i in $(seq 1 30); do
    if ip addr show ppp0 &>/dev/null 2>&1; then
        echo "Tunnel VPN activo (ppp0)"
        break
    fi
    sleep 1
done

# Agregar ruta a la red CMO
ip route add 192.168.1.0/24 dev ppp0 2>/dev/null || true
echo "Ruta 192.168.1.x agregada"

# Test conectividad S10
echo "Test S10 (192.168.1.51:1433)..."
timeout 5 bash -c 'cat < /dev/null > /dev/tcp/192.168.1.51/1433' 2>/dev/null \
    && echo "S10 ALCANZABLE" || echo "S10 no responde aún, intentando sync..."

# Ejecutar sync
echo ""
echo "=== Ejecutando sync S10 → VPS ==="
node /app/sync-agent.js --year=$YEAR

# Cleanup
kill $VPN_PID 2>/dev/null || true
echo "=== Sync completado ==="
