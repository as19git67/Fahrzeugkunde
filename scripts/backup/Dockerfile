# Sidecar-Image für tägliche Backups (DB + Assets).
# Basiert auf postgres:16-alpine, damit pg_dump bitgenau zur DB-Version passt.
FROM postgres:16-alpine

# busybox-tar und -find reichen für unsere Zwecke; coreutils liefert stabiles
# `date -u +%FT%TZ` und `stat -c%s` – hilfreich für Logs.
RUN apk add --no-cache bash coreutils tzdata

COPY backup.sh /usr/local/bin/fzk-backup.sh
RUN chmod +x /usr/local/bin/fzk-backup.sh

ENTRYPOINT ["/usr/local/bin/fzk-backup.sh"]
