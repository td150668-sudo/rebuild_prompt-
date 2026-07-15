#!/usr/bin/env node
import { ProxyServer } from './server';

const pkg = require('../package.json');

process.title = 'unitool-proxy';

// Use PORT from environment (Render sets this automatically)
const port = parseInt(process.env.PORT, 10) || 9000;

const server = new ProxyServer();

server.run(port).then((actualPort: number) => {
  console.log(`UniTool Proxy is listening on port ${actualPort}`);
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
