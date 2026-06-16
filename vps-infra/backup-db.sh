#!/bin/bash
# Respaldo diario de la BD de S10 BizSmartHub (s10biz_db). Retención 7 días.
# Protege lo NO re-sincronizable: usuarios, config de empresas y datos manuales
# del Directorio (presupuesto, HH, backlog, pipeline). Los KPIs/mayor se pueden
# re-sincronizar desde S10, pero esto no.
# Instalar en VPS como /opt/backups-s10biz.sh + cron diario.
set -eo pipefail
BACKUP_DIR=/opt/backups/s10bizsmarthub
mkdir -p "$BACKUP_DIR"
TS=$(date +%Y%m%d-%H%M%S)
FILE="$BACKUP_DIR/s10biz_db-$TS.sql.gz"

docker exec s10biz-db pg_dump -U postgres -d s10biz_db | gzip > "$FILE"

# Retención: eliminar respaldos de más de 7 días
find "$BACKUP_DIR" -name 's10biz_db-*.sql.gz' -mtime +7 -delete

echo "$(date '+%Y-%m-%d %H:%M:%S') OK $FILE ($(du -h "$FILE" | cut -f1))" >> /var/log/s10biz-backup.log
