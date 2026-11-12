#!/usr/bin/env bash
# Runs a command against the LOCAL Supabase stack only. Overrides any
# NEXT_PUBLIC_SUPABASE_* values inherited from the shell (which may point at
# the hosted project) with the URL and keys from `supabase status`.
set -euo pipefail
status="$(npx supabase status -o env 2>/dev/null)"
get() { printf '%s\n' "$status" | sed -n "s/^$1=\"\{0,1\}\([^\"]*\)\"\{0,1\}$/\1/p"; }
url="$(get API_URL)"
case "$url" in
  http://127.0.0.1:*|http://localhost:*) ;;
  *) echo "Local Supabase is not running (npm run db:start)" >&2; exit 1 ;;
esac
export NEXT_PUBLIC_SUPABASE_URL="$url"
export NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY="$(get PUBLISHABLE_KEY)"
export SUPABASE_SECRET_KEY="$(get SECRET_KEY)"
export CATALOG_SOURCE="${CATALOG_SOURCE:-supabase}"
exec "$@"
