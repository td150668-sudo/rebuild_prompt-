# UniTool AI Proxy Server

A rebuilt iOS WebKit Debug Proxy Adapter based on recovered runtime sources.

## Features

- Express HTTP server with WebSocket relay
- iOS device target discovery via `ios_webkit_debug_proxy`
- Protocol translation for Chrome DevTools ↔ iOS WebKit
- Screencast support for remote screen viewing
- Multi-device adapter support (iOS 8–18+)

## Quick Start

```bash
# Install dependencies
npm install

# Build TypeScript
npm run build

# Start the proxy server (default port 9000)
npm start

# Or with custom port
node out/index.js -p 8080
```

## Endpoints

| Route             | Description                          |
|-------------------|--------------------------------------|
| `GET /`           | Health check                         |
| `GET /json`       | List connected targets               |
| `GET /json/list`  | Same as `/json`                      |
| `GET /json/version` | Version info                       |
| `GET /refresh`    | Force refresh device list            |
| `ws://`           | WebSocket for DevTools communication |

## Architecture

```
src/
├── index.ts              # CLI entry point
├── server.ts             # HTTP + WebSocket server
├── logger.ts             # Debug logging utility
├── adapters/
│   ├── adapter.ts        # Base adapter (spawns proxy, manages targets)
│   ├── adapterCollection.ts  # Multi-adapter manager
│   ├── adapterInterfaces.ts  # TypeScript interfaces
│   └── iosAdapter.ts     # iOS device discovery + protocol selection
└── protocols/
    ├── protocol.ts       # Base protocol adapter
    ├── target.ts         # WebSocket target proxy with message filtering
    └── ios/
        ├── ios.ts        # iOS protocol translation (DOM, CSS, Runtime, etc.)
        ├── ios8.ts       # iOS 8 specific overrides
        ├── ios9.ts       # iOS 9+ specific overrides
        ├── ios12.ts      # iOS 12+ target-based protocol
        └── screencast.ts # Screen capture session
```

## Requirements

- Node.js >= 14
- `ios_webkit_debug_proxy` installed (macOS/Linux) or bundled (Windows)

## License

Rebuilt from recovered runtime artifacts for educational/development purposes.
