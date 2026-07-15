#!/usr/bin/env node
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const server_1 = require("./server");
process.title = 'unitool-proxy';
// Render sets PORT automatically
const port = parseInt(process.env.PORT, 10) || 9000;
const server = new server_1.ProxyServer();
server.run(port).then((actualPort) => {
    console.log(`UniTool Proxy is listening on port ${actualPort}`);
}).catch((err) => {
    console.error('UniTool Proxy failed to run:', err);
    process.exit(1);
});
process.on('SIGINT', () => { server.stop(); process.exit(); });
process.on('SIGTERM', () => { server.stop(); process.exit(); });
//# sourceMappingURL=index.js.map