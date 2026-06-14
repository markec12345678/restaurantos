#!/usr/bin/env node
/* eslint-disable @typescript-eslint/no-require-imports */
// RestaurantOS POS - Daemon process that keeps server alive
const { spawn } = require('child_process');
const path = require('path');

const SERVER_SCRIPT = path.join(__dirname, 'server.js');
const MAX_RESTARTS = 50;
const RESTART_DELAY = 2000;

let restartCount = 0;
let lastRestartTime = 0;

function startServer() {
  console.log(`[Daemon] Starting server (attempt ${restartCount + 1}/${MAX_RESTARTS})...`);
  
  const child = spawn(process.execPath, [SERVER_SCRIPT], {
    cwd: __dirname,
    env: { ...process.env, NODE_ENV: 'development' },
    stdio: ['ignore', 'pipe', 'pipe'],
    detached: false,
  });

  child.stdout.on('data', (data) => {
    const msg = data.toString().trim();
    if (msg) process.stdout.write(msg + '\n');
  });

  child.stderr.on('data', (data) => {
    const msg = data.toString().trim();
    if (msg && !msg.includes('DEP0169')) process.stderr.write(msg + '\n');
  });

  child.on('exit', (code, signal) => {
    const now = Date.now();
    // Reset counter if last restart was more than 60s ago (stable period)
    if (now - lastRestartTime > 60000) restartCount = 0;
    
    restartCount++;
    lastRestartTime = now;
    
    if (restartCount >= MAX_RESTARTS) {
      console.error(`[Daemon] Max restarts (${MAX_RESTARTS}) reached. Exiting.`);
      process.exit(1);
    }

    console.log(`[Daemon] Server exited (code=${code}, signal=${signal}). Restarting in ${RESTART_DELAY}ms...`);
    setTimeout(startServer, RESTART_DELAY);
  });

  child.on('error', (err) => {
    console.error(`[Daemon] Failed to start: ${err.message}`);
    setTimeout(startServer, RESTART_DELAY * 2);
  });

  return child;
}

// Handle daemon shutdown
process.on('SIGINT', () => {
  console.log('[Daemon] Shutting down...');
  process.exit(0);
});
process.on('SIGTERM', () => {
  console.log('[Daemon] Shutting down...');
  process.exit(0);
});

// Keep the process alive
setInterval(() => {
  // Heartbeat - keep process alive
}, 30000);

console.log('[Daemon] RestaurantOS POS Daemon starting...');
startServer();
