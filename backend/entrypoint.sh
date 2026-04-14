#!/bin/bash
PUID=${PUID:-0}
PGID=${PGID:-0}

if [ "$PUID" != "0" ] || [ "$PGID" != "0" ]; then
    groupadd -g "$PGID" appgroup 2>/dev/null || true
    useradd -u "$PUID" -g "$PGID" -M -s /bin/false appuser 2>/dev/null || true
    chown -R "$PUID:$PGID" /data 2>/dev/null || true
    exec gosu "$PUID:$PGID" "$@"
else
    exec "$@"
fi
