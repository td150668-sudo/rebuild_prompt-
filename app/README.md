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

- Node.js >= 18
- `ios_webkit_debug_proxy` installed (macOS/Linux) or bundled (Windows)

## Deploy on Render.com (Free Tier)

### One-Click Blueprint Deploy

1. Fork/push this repo to your GitHub
2. Go to [render.com/new](https://dashboard.render.com/) → **New** → **Blueprint**
3. Connect your repo → Render reads `render.yaml` automatically
4. Click **Apply** → Done!

### Manual Web Service Setup

| Setting | Value |
|---------|-------|
| **Runtime** | Node |
| **Root Directory** | `app` |
| **Build Command** | `npm install && npm run build` |
| **Start Command** | `node out/index.js` |
| **Instance Type** | Free |
| **Health Check Path** | `/health` |

### Keep-Alive (Prevent Sleep)

Free services sleep after 15 min of inactivity. Two solutions:

**Option A: Built-in self-ping (automatic)**
Set env var `RENDER_EXTERNAL_URL=https://your-app.onrender.com`
The app will ping itself every 14 minutes automatically.

**Option B: External cron (recommended backup)**
Use [cron-job.org](https://cron-job.org) (free):
- URL: `https://your-app.onrender.com/health`
- Schedule: Every 14 minutes

### Free Tier Limits

| Resource | Limit |
|----------|-------|
| Instance hours | 750/month (enough for 1 service 24/7) |
| RAM | 512 MB |
| Bandwidth | 100 GB/month |
| Sleep after idle | 15 minutes |
| Cold start | ~30-60 seconds |

## License

Rebuilt from recovered runtime artifacts for educational/development purposes.
