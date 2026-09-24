#!/bin/bash
cd "$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
export NODE_ENV=production
export PORT=3000
exec node node_modules/.bin/next start -p 3000 -H 0.0.0.0
