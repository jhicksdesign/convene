#!/bin/sh
# Fires one HTTP request at a cron route on the web service and exits.
# Railway runs this on the schedule defined per cron service.
#
# Required env vars (set in the Railway cron service):
#   WEB_URL       — public URL of the web service, e.g. https://convene.example.com
#   CRON_SECRET   — must match the same env var on the web service
#   CRON_PATH     — path to hit, e.g. /api/cron/expire-soft-claims
#
# Exits non-zero on HTTP >= 400 so Railway flags the run as failed.

set -eu

: "${WEB_URL:?WEB_URL not set}"
: "${CRON_SECRET:?CRON_SECRET not set}"
: "${CRON_PATH:?CRON_PATH not set}"

URL="${WEB_URL%/}${CRON_PATH}"
echo "[cron] $(date -u +%FT%TZ) → ${URL}"

STATUS=$(curl -sS -o /tmp/cron-body -w "%{http_code}" \
  -H "Authorization: Bearer ${CRON_SECRET}" \
  "${URL}")

cat /tmp/cron-body
echo
echo "[cron] HTTP ${STATUS}"

if [ "${STATUS}" -ge 400 ]; then
  exit 1
fi
