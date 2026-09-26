#!/usr/bin/env bash
# Proves a backup can actually be restored: loads it into a throwaway local database,
# compares row counts with the live database, then deletes the throwaway copy.
# Usage: npm run backup:verify [-- backups/rentcar-....dump]   (defaults to the newest backup)
set -euo pipefail
cd "$(dirname "$0")/.."

file="${1:-$(ls -1t backups/rentcar-*.dump 2>/dev/null | head -1)}"
[ -f "$file" ] || { echo "No backup file found. Run: npm run backup"; exit 1; }

if [ -z "${DATABASE_URL:-}" ] && [ -f .env ]; then
  DATABASE_URL=$(grep -E '^DATABASE_URL=' .env | head -1 | cut -d= -f2- | sed -E 's/^"(.*)"$/\1/')
fi

scratch="rentcar_restore_check_$$"
createdb "$scratch"
trap 'dropdb --if-exists "$scratch"' EXIT

pg_restore --no-owner --no-privileges --dbname="$scratch" "$file"

echo "Restored $file into a temporary database. Row counts (backup | live now):"
for table in cars bookings admin_users notifications blocked_customers audit_logs; do
  restored=$(psql -d "$scratch" -Atc "SELECT count(*) FROM $table")
  live=$( [ -n "${DATABASE_URL:-}" ] && psql "$DATABASE_URL" -Atc "SELECT count(*) FROM $table" 2>/dev/null || echo "?")
  printf '  %-18s %6s | %s\n' "$table" "$restored" "$live"
done
echo "OK: the backup restores cleanly."
