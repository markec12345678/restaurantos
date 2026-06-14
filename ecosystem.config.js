module.exports = {
  apps: [{
    name: 'restaurantos',
    script: './.next/standalone/server.js',
    env: {
      NODE_ENV: 'production',
      HOSTNAME: '0.0.0.0',
      PORT: 3000
    },
    max_memory_restart: '512M',
    restart_delay: 3000,
    max_restarts: 10,
    autorestart: true
  }]
}
