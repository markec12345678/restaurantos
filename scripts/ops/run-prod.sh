#!/bin/bash
cd "$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
export NODE_ENV=production
export HOSTNAME=0.0.0.0
export PORT=3000
exec node .next/standalone/server.js
