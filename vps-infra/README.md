# VPS Infrastructure

Estos archivos viven en el VPS y son críticos para el sync automático y manual.
Se versionan aquí para auditoría y recuperación.

## Archivos

- **sync-vpn.sh** (`/opt/apps/s10bizsmarthub/sync-vpn.sh`): script invocado por cron y por el trigger HTTP. Conecta VPN FortiGate, espera a que el SQL Server responda (no solo a que ppp0 levante), ejecuta `sync-agent.js`, desconecta.
- **sync-trigger.js** (`/opt/apps/s10bizsmarthub/sync-trigger.js`): servidor HTTP en :3299 que recibe POSTs autenticados con `x-sync-key` desde el backend (`/api/sync/trigger`) y dispara `sync-vpn.sh`.
- **s10-sync-trigger.service** (`/etc/systemd/system/s10-sync-trigger.service`): unit systemd que mantiene `sync-trigger.js` corriendo (auto-restart, sobrevive reinicios).

## Cron (root crontab del VPS)

```
0  7 * * 1-5 /opt/apps/s10bizsmarthub/sync-vpn.sh 2026 >> /var/log/s10-sync.log 2>&1
0 18 * * 1-5 /opt/apps/s10bizsmarthub/sync-vpn.sh 2026 >> /var/log/s10-sync.log 2>&1
30 7 * * 1-5 /opt/apps/s10bizsmarthub/sync-vpn.sh 2025 >> /var/log/s10-sync.log 2>&1
```

## Si el script cambia

1. Editar localmente en este directorio
2. `scp vps-infra/sync-vpn.sh root@VPS:/opt/apps/s10bizsmarthub/sync-vpn.sh`
3. Para el service: `systemctl restart s10-sync-trigger` después del scp
