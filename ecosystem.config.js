module.exports = {
  apps: [{
    name: 'restaurantos',
    script: './.next/standalone/server.js',
    env: {
      NODE_ENV: 'production',
      HOSTNAME: '0.0.0.0',
      PORT: 3000
    },
    // FIX (R229, katalog napak B5): 512M je za Next.js 16 + WS custom server
    // prenizko — povzroča restart zanke pod obremenitvijo.
    max_memory_restart: '1536M',
    restart_delay: 3000,
    max_restarts: 10,
    autorestart: true
  }]
}
