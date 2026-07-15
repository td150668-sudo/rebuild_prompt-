#!/usr/bin/env node
import { ProxyServer } from './server';

const pkg = require('../package.json');

process.title = 'unitool-proxy';

// Simple arg parsing (no external deps)
const args = process.argv.slice(2);
let port = 9000;

for (let i = 0; i < args.length; i++) {
  if (args[i] === '-p' || args[i] === '--port') {
    port = parseInt(args[i + 1], 10) || 9000;
    i++;
  } else if (args[i] === '--version') {
    console.log(pkg.version);
    process.exit(0);
  } else if (args[i] === '--help' || args[i] === '-h') {
    console.log(`UniTool Proxy Server v${pkg.version}`);
    console.log('Usage: unitool-proxy -p [port]');
    console.log('');
    console.log('Options:');
    console.log('  -p, --port     Port to listen on (default: 9000)');
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
