#!/usr/bin/env bash
#
# fzk-backup.sh – Tägliches Backup für Fahrzeugkunde
# ===================================================
#
# Erzeugt eine einzige Backup-Datei je Lauf, bestehend aus:
#   - manifest.json   (Format-Kennung + Zeitstempel)
#   - db.dump         (pg_dump --format=custom)
#   - assets.tar      (Inhalt von /data/assets)
#
# Die Datei wird unter ${BACKUP_DIR} als
#   fahrzeugkunde-YYYYMMDDTHHMMSSZ.backup
# abgelegt. Alte Backups werden nach ${BACKUP_RETENTION_DAYS} Tagen entfernt.
#
# Konfiguration (Environment):
#   DATABASE_URL             – Connection-String (Pflicht)
#   BACKUP_DIR               – Ziel-Ordner, Default /backups
#   ASSETS_DIR               – Quell-Ordner für Assets, Default /data/assets
#   BACKUP_INTERVAL_SECONDS  – Abstand zwischen Läufen, Default 86400 (1 Tag)
#   BACKUP_RETENTION_DAYS    – Max. Alter alter Backups in Tagen, Default 14
#                              (leer oder 0 = keine Auto-Löschung)
#   RUN_ONCE                 – Wenn gesetzt, genau ein Backup, dann Exit
#
# Die Datei ist selbst ein tar-Archiv und mit jedem beliebigen Tool
# lesbar (tar xf fahrzeugkunde-....backup).

set -euo pipefail

: "${DATABASE_URL:?DATABASE_URL muss gesetzt sein}"
: "${BACKUP_DIR:=/backups}"
: "${ASSETS_DIR:=/data/assets}"
: "${BACKUP_INTERVAL_SECONDS:=86400}"
: "${BACKUP_RETENTION_DAYS:=14}"

log() {
  printf '[%s] %s\n' "$(date -u +%FT%TZ)" "$*"
}

prune_old() {
  local days="${BACKUP_RETENTION_DAYS:-0}"
  if [[ -z "$days" || "$days" -le 0 ]]; then
    return 0
  fi
  # +N bei `find -mtime` = strictly older than N*24h
  local removed
  removed=$(find "$BACKUP_DIR" -maxdepth 1 -type f \
    -name 'fahrzeugkunde-*.backup' -mtime "+$days" -print -delete 2>/dev/null | wc -l || true)
  if [[ "$removed" -gt 0 ]]; then
    log "aufgeräumt: $removed Backup(s) älter als ${days}d entfernt"
  fi
}

run_backup() {
  local ts out work
  ts=$(date -u +%Y%m%dT%H%M%SZ)
  out="$BACKUP_DIR/fahrzeugkunde-$ts.backup"
  work=$(mktemp -d "/tmp/fzk-backup.XXXXXXXX")

  # Cleanup auch bei Fehlern
  trap 'rm -rf "$work"' EXIT

  log "starte Backup → $out"

  # 1) DB-Dump im Custom-Format (kompakt, restore mit pg_restore)
  pg_dump \
    --format=custom \
    --no-owner \
    --no-privileges \
    --compress=6 \
    --dbname="$DATABASE_URL" \
    --file="$work/db.dump"
  # Defensiver Sanity-Check: Ein gültiger custom-format Dump hat immer einen
  # Header (>0 Bytes). Bei pg_dump/Server-Versionsmismatch legt pg_dump die
  # Datei per --file zwar an, schreibt aber nichts hinein. Ohne diese Prüfung
  # würde ein leerer Dump ins Archiv wandern und stillschweigend gute
  # Backups wegrotieren.
  local db_dump_size
  db_dump_size=$(stat -c%s "$work/db.dump")
  if [[ "$db_dump_size" -le 0 ]]; then
    log "FEHLER: pg_dump hat einen leeren db.dump erzeugt – Backup wird abgebrochen"
    return 1
  fi
  log "db.dump fertig ($db_dump_size Bytes)"

  # 2) Assets als tar. Wenn der Ordner leer oder nicht vorhanden ist,
  #    legen wir trotzdem ein (leeres) Tar an – damit Backups einheitlich
  #    aufgebaut sind und der Restore-Pfad nicht spezialgecased werden muss.
  if [[ -d "$ASSETS_DIR" ]]; then
    local parent base
    parent=$(dirname "$ASSETS_DIR")
    base=$(basename "$ASSETS_DIR")
    tar -cf "$work/assets.tar" -C "$parent" "$base"
  else
    tar -cf "$work/assets.tar" -T /dev/null
  fi
  log "assets.tar fertig ($(stat -c%s "$work/assets.tar") Bytes)"

  # 3) Manifest mit Format-Kennung und Zeitstempel
  cat > "$work/manifest.json" <<EOF
{
  "format": "fahrzeugkunde-backup",
  "schemaVersion": 1,
  "createdAt": "$(date -u +%FT%TZ)",
  "database": "$(psql "$DATABASE_URL" -tA -c 'SELECT current_database();' 2>/dev/null || echo 'unknown')",
  "postgresVersion": "$(pg_dump --version | head -1)"
}
EOF

  # 4) Alles in eine Datei packen. Reihenfolge ist wichtig für den
  #    Restore-Detektor: manifest zuerst, damit `tar -xOf ... manifest.json`
  #    in O(1) lesbar ist.
  mkdir -p "$BACKUP_DIR"
  tar -cf "$out" -C "$work" manifest.json db.dump assets.tar

  log "backup fertig: $out ($(stat -c%s "$out") Bytes)"

  rm -rf "$work"
  trap - EXIT
}

mkdir -p "$BACKUP_DIR"
log "backup-sidecar bereit – dir=$BACKUP_DIR interval=${BACKUP_INTERVAL_SECONDS}s retention=${BACKUP_RETENTION_DAYS}d"

if [[ -n "${RUN_ONCE:-}" ]]; then
  run_backup
  prune_old
  exit 0
fi

while :; do
  if ! run_backup; then
    log "WARNUNG: Backup-Lauf ist fehlgeschlagen, versuche beim nächsten Intervall erneut"
  fi
  prune_old
  log "schlafe ${BACKUP_INTERVAL_SECONDS}s bis zum nächsten Backup"
  sleep "$BACKUP_INTERVAL_SECONDS"
done
