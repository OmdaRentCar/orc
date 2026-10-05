#!/usr/bin/env bash
# Saves a full copy of the database to server/backups/rentcar-<date>.dump
# Usage: npm run backup            (uses DATABASE_URL from server/.env)
#        DATABASE_URL=... npm run backup
set -euo pipefail
cd "$(dirname "$0")/.."

if [ -z "${DATABASE_URL:-}" ] && [ -f .env ]; then
  DATABASE_URL=$(grep -E '^DATABASE_URL=' .env | head -1 | cut -d= -f2- | sed -E 's/^"(.*)"$/\1/')
fi
: "${DATABASE_URL:?DATABASE_URL is not set}"

mkdir -p backups
file="backups/rentcar-$(date +%Y-%m-%d_%H%M%S).dump"
pg_dump --format=custom --no-owner --no-privileges --dbname="$DATABASE_URL" --file="$file"

echo "Backup saved: server/$file ($(du -h "$file" | cut -f1))"
echo "Tables and row counts in this backup:"
pg_restore --list "$file" | grep -c "TABLE DATA" | xargs -I{} echo "  {} tables with data"

# Keep the 30 most recent backups
ls -1t backups/rentcar-*.dump | tail -n +31 | xargs -r rm --
