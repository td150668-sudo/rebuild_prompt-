#!/usr/bin/env node
import { ProxyServer } from './server';

const pkg = require('../package.json');

process.title = 'unitool-proxy';

// Simple arg parsing (no external deps)
const args = process.argv.slice(2);
// Render.com provides PORT env var - use it as default
let port = parseInt(process.env.PORT, 10) || 9000;

for (let i = 0; i < args.length; i++) {
  if (args[i] === '-p' || args[i] === '--port') {
    port = parseInt(args[i + 1], 10) || port;
    i++;
  } else if (args[i] === '--version') {
    console.log(pkg.version);
    process.exit(0);
  } else if (args[i] === '--help' || args[i] === '-h') {
    console.log(`UniTool Proxy Server v${pkg.version}`);
    console.log('Usage: unitool-proxy -p [port]');
    console.log('');
    console.log('Options:');
    console.log('  -p, --port     Port to listen on (default: PORT env or 9000)');
    console.log('  --version      Print version');
    console.log('  -h, --help     Show this help');
    process.exit(0);
  }
}

const server = new ProxyServer();

server.run(port).then((actualPort: number) => {
  console.log(`UniTool Proxy is listening on port ${actualPort}`);
  console.log(`  Health check: http://localhost:${actualPort}/`);
  console.log(`  Targets:      http://localhost:${actualPort}/json`);

  // === KEEP-ALIVE for Render Free Tier ===
  // Render spins down free services after 15 min of inactivity.
  // Self-ping every 14 minutes to stay awake (uses 0 extra resources).
  const RENDER_URL = process.env.RENDER_EXTERNAL_URL;
  if (RENDER_URL) {
    const http = require('http');
    const KEEP_ALIVE_INTERVAL = 14 * 60 * 1000; // 14 minutes
    setInterval(() => {
      http.get(`${RENDER_URL}/health`, () => {});
    }, KEEP_ALIVE_INTERVAL);
    console.log(`  Keep-alive: pinging ${RENDER_URL}/health every 14 min`);
  }
}).catch((err: any) => {
  console.error('UniTool Proxy failed to run:', err);
  process.exit(1);
});

process.on('SIGINT', () => {
  server.stop();
  process.exit();
});

process.on('SIGTERM', () => {
  server.stop();
  process.exit();
});
