#!/usr/bin/env bash
# Runs a complete demo of RentCar on its own database and ports, next to your normal setup.
#   ./demo.sh          start the demo (creates and fills the demo database the first time)
#   ./demo.sh reset    refill the demo database with fresh data (dates move with today), then start
#   ./demo.sh stop     stop the demo servers
# Demo site: http://localhost:5180 · admin / demo1234 (owner) · agent / demo1234 (staff)
set -euo pipefail
cd "$(dirname "$0")"

DEMO_DB="rentcar_demo"
API_PORT=4100
WEB_PORT=5180
LOGS=".logs"
mkdir -p "$LOGS"

stop() {
  for port in $API_PORT $WEB_PORT; do
    pid=$(ss -ltnp 2>/dev/null | grep ":$port " | grep -oP 'pid=\K[0-9]+' | head -1 || true)
    if [ -n "$pid" ]; then kill "$pid" 2>/dev/null || true; echo "Stopped demo on port $port"; fi
  done
}

if [ "${1:-}" = "stop" ]; then stop; exit 0; fi

# The demo uses a local PostgreSQL database, reached through its socket
SOCKET_DIR="/var/run/postgresql"
DEMO_URL="postgresql://$(whoami)@localhost/$DEMO_DB?host=$SOCKET_DIR"
# Your own inbox receives the demo customers' emails (signature codes, contracts, reminders)
DEMO_EMAIL=$(grep -E '^SMTP_USER=' server/.env 2>/dev/null | head -1 | cut -d= -f2- | sed -E 's/^"(.*)"$/\1/' || true)

stop >/dev/null
fresh=false
if ! psql -d postgres -Atc "select 1 from pg_database where datname='$DEMO_DB'" | grep -q 1; then
  createdb "$DEMO_DB"
  fresh=true
fi

echo "Preparing the demo database ($DEMO_DB)..."
(cd server && DATABASE_URL="$DEMO_URL" npx prisma migrate deploy >/dev/null)
if [ "$fresh" = true ] || [ "${1:-}" = "reset" ]; then
  (cd server && DATABASE_URL="$DEMO_URL" DEMO_EMAIL="$DEMO_EMAIL" npm run -s seed:demo)
fi

echo "Starting the demo..."
# No Cloudflare captcha in the demo: it can refuse *.localhost addresses and get in the way of testing
(cd server && DATABASE_URL="$DEMO_URL" PORT=$API_PORT CLIENT_URL="http://localhost:$WEB_PORT" TURNSTILE_SECRET_KEY= \
  AGENCY_URL_TEMPLATE="http://{slug}.localhost:$WEB_PORT" DEFAULT_AGENCY_SLUG=rentcar \
  PLATFORM_URL="http://localhost:$WEB_PORT" API_PUBLIC_URL="http://localhost:$API_PORT" \
  setsid nohup npx tsx watch src/index.ts > "../$LOGS/demo-server.log" 2>&1 < /dev/null &)
(cd client && API_PROXY_TARGET="http://localhost:$API_PORT" VITE_TURNSTILE_SITE_KEY= \
  setsid nohup npx vite --port $WEB_PORT --strictPort > "../$LOGS/demo-client.log" 2>&1 < /dev/null &)

for _ in $(seq 1 60); do
  curl -s "localhost:$API_PORT/api/health" >/dev/null 2>&1 && curl -s "localhost:$WEB_PORT" >/dev/null 2>&1 && break
  sleep 1
done

if curl -s "localhost:$API_PORT/api/health" >/dev/null 2>&1; then
  cat <<EOF

  RentCar demo is running
  -----------------------
  1. General page: http://localhost:$WEB_PORT          (for agency owners: features, pricing, agencies)
  2. Agency sites:  http://rentcar.localhost:$WEB_PORT   http://sahel.localhost:$WEB_PORT
                    http://djerba-drive.localhost:$WEB_PORT   http://capbon.localhost:$WEB_PORT (suspended)
  3. Dashboards:    http://localhost:$WEB_PORT/login   (one login: admin / demo1234, or agent / demo1234)
  4. Console:       http://localhost:$WEB_PORT/login   (console@demo.test / demo1234)
  Demo emails: ${DEMO_EMAIL:-none (set SMTP_USER in server/.env)}
  Guide:       DEMO.md
  Stop:        ./demo.sh stop      Fresh data: ./demo.sh reset

EOF
else
  echo "The demo did not start. See $LOGS/demo-server.log and $LOGS/demo-client.log"
  exit 1
fi
