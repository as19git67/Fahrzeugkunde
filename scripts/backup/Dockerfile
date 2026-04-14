# Sidecar-Image für tägliche Backups (DB + Assets).
# Die Major-Version MUSS zur DB in docker-compose.yml passen – ein älterer
# pg_dump verweigert gegen einen neueren Server den Dump ("server version
# mismatch") und hinterlässt dabei eine leere db.dump.
FROM postgres:18-alpine

# busybox-tar und -find reichen für unsere Zwecke; coreutils liefert stabiles
# `date -u +%FT%TZ` und `stat -c%s` – hilfreich für Logs.
RUN apk add --no-cache bash coreutils tzdata

COPY backup.sh /usr/local/bin/fzk-backup.sh
RUN chmod +x /usr/local/bin/fzk-backup.sh

ENTRYPOINT ["/usr/local/bin/fzk-backup.sh"]
