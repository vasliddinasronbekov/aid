#!/bin/sh
set -eu

is_enabled() {
    case "${1:-}" in
        1|true|TRUE|yes|YES|on|ON) return 0 ;;
        *) return 1 ;;
    esac
}

if is_enabled "${AID_RUN_MIGRATIONS:-true}"; then
    python manage.py migrate --noinput
fi

if is_enabled "${AID_COLLECTSTATIC:-true}"; then
    python manage.py collectstatic --noinput
fi

exec "$@"
