#!/bin/bash
# Mulai ulang loop sinkron per jam (box). Butuh env ACCURATE_CLIENT_SECRET untuk refresh token.
cd /workspace/accurate_api
pgrep -f "box_sync.py loop" >/dev/null && { echo "sudah jalan"; exit 0; }
setsid nohup python3 box_sync.py loop >> sync.log 2>&1 < /dev/null & disown
echo "loop dimulai"
