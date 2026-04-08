#!/bin/bash
# Backup SQLite database for CoWallet
# Keeps last 7 daily backups
# Suggested cron: 0 3 * * * /home/nicolas/docker/cowallet/backup.sh

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
DATA_DIR="$SCRIPT_DIR/data"
BACKUP_DIR="$SCRIPT_DIR/backups"
DB_FILE="$DATA_DIR/cowallet.db"
DATE=$(date +%Y-%m-%d)

mkdir -p "$BACKUP_DIR"

if [ ! -f "$DB_FILE" ]; then
  echo "[backup] DB not found: $DB_FILE"
  exit 1
fi

# Use SQLite's .backup command for a safe online backup (no file lock issues)
sqlite3 "$DB_FILE" ".backup '$BACKUP_DIR/cowallet-$DATE.db'"

if [ $? -eq 0 ]; then
  echo "[backup] OK → $BACKUP_DIR/cowallet-$DATE.db"
else
  echo "[backup] FAILED"
  exit 1
fi

# Rotation: keep last 7 backups
ls -t "$BACKUP_DIR"/cowallet-*.db 2>/dev/null | tail -n +8 | xargs -r rm --
echo "[backup] Rotation done (kept last 7)"
