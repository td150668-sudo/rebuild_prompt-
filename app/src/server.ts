import * as http from 'http';
import { EventEmitter } from 'events';
import { debug } from './logger';
import { WebSocket as WS, WebSocketServer } from './ws-lite';
import { IOSAdapter } from './adapters/iosAdapter';
import { renderDashboard } from './webui';

const pkg = require('../package.json');

export class ProxyServer extends EventEmitter {
  private _serverPort: number;
  private _hs: http.Server;
  private _wss: WebSocketServer;
  private _adapter: IOSAdapter;
  private _targetFetcherInterval: NodeJS.Timeout;

  constructor() {
    super();
  }

  async run(serverPort: number): Promise<number> {
    this._serverPort = serverPort;
    debug('server.run, port=%s', serverPort);

    this._hs = http.createServer((req, res) => this.handleHttp(req, res));
    this._wss = new WebSocketServer(this._hs);

    this._wss.on('connection', (ws: WS, req: http.IncomingMessage) => {
      this.onWSSConnection(ws, req);
    });

    this._hs.listen(this._serverPort);
    const address = this._hs.address() as any;
    const port = address.port;

    const settings = await IOSAdapter.getProxySettings({
      proxyPath: null,
      proxyPort: port + 100,
      proxyArgs: null
    });

    this._adapter = new IOSAdapter('/ios', `ws://localhost:${port}`, settings);

    try {
      await this._adapter.start();
    } catch (e) {
      debug('adapter start skipped (no proxy binary): %s', e);
    }
    this.startTargetFetcher();
    return port;
  }

  stop() {
    debug('server.stop');
    if (this._hs) {
      this._hs.close();
      this._hs = null;
    }
    this.stopTargetFetcher();
    if (this._adapter) {
      this._adapter.stop();
    }
  }

  private startTargetFetcher() {
    debug('server.startTargetFetcher');
    const fetch = () => {
      this._adapter.getTargets().then(
        (targets: any[]) => {
          debug(`server.startTargetFetcher.fetched.${targets.length}`);
        },
        (err: any) => {
          debug(`server.startTargetFetcher.error`, err);
        }
      );
    };
    this._targetFetcherInterval = setInterval(fetch, 5000);
  }

  private stopTargetFetcher() {
    debug('server.stopTargetFetcher');
    if (!this._targetFetcherInterval) return;
    clearInterval(this._targetFetcherInterval);
  }

  private handleHttp(req: http.IncomingMessage, res: http.ServerResponse) {
    const url = req.url || '/';

    // Root → Serve HTML dashboard
    if (url === '/') {
      debug('server.http.endpoint/');
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      const html = renderDashboard(
        this._serverPort,
        Math.floor(process.uptime()),
        pkg.version || '1.0.0'
      );
      res.end(html);
      return;
    }

    // Everything else → JSON
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Access-Control-Allow-Origin', '*');

    if (url === '/api/status' || url === '/health') {
      res.end(JSON.stringify({
        status: 'ok',
        service: 'unitool-proxy',
        version: pkg.version || '1.0.0',
        uptime: Math.floor(process.uptime()),
        port: this._serverPort,
        timestamp: new Date().toISOString()
      }));
    } else if (url === '/refresh') {
      if (this._adapter) this._adapter.forceRefresh();
      this.emit('forceRefresh');
      res.end(JSON.stringify({ status: 'ok', msg: 'Refresh triggered' }));
    } else if (url === '/json' || url === '/json/list') {
      debug('server.http.endpoint' + url);
      if (!this._adapter) {
        res.end('[]');
        return;
      }
      this._adapter.getTargets().then((targets: any[]) => {
        res.end(JSON.stringify(targets || []));
      }).catch(() => {
        res.end('[]');
      });
    } else if (url === '/json/version') {
      debug('server.http.endpoint/json/version');
      res.end(JSON.stringify({
        Browser: 'Safari/UniTool iOS Webkit Adapter',
        'Protocol-Version': '1.2',
        'User-Agent': 'Mozilla/5.0',
        'WebKit-Version': '537.36'
      }));
    } else if (url === '/json/protocol') {
      debug('server.http.endpoint/json/protocol');
      res.end(JSON.stringify({}));
    } else {
      res.statusCode = 404;
      res.end(JSON.stringify({ error: 'Not found', path: url }));
    }
  }

  private onWSSConnection(ws: WS, req: http.IncomingMessage) {
    const url = req.url;
    debug('server.ws.onWSSConnection', url);

    try {
      this._adapter.connectTo(url, ws);
    } catch (err) {
      debug(`server.onWSSConnection.connectTo.error.${err}`);
    }

    ws.on('message', (msg: string) => {
      this._adapter.forwardTo(url, msg);
    });
  }
}
