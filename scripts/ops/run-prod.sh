#!/bin/bash
cd /home/z/my-project
export NODE_ENV=production
export HOSTNAME=0.0.0.0
export PORT=3000
exec node .next/standalone/server.js
