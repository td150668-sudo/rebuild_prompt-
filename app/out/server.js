"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.ProxyServer = void 0;
const http = __importStar(require("http"));
const events_1 = require("events");
const logger_1 = require("./logger");
const ws_lite_1 = require("./ws-lite");
const iosAdapter_1 = require("./adapters/iosAdapter");
class ProxyServer extends events_1.EventEmitter {
    constructor() {
        super();
    }
    async run(serverPort) {
        this._serverPort = serverPort;
        (0, logger_1.debug)('server.run, port=%s', serverPort);
        this._hs = http.createServer((req, res) => this.handleHttp(req, res));
        this._wss = new ws_lite_1.WebSocketServer(this._hs);
        this._wss.on('connection', (ws, req) => {
            this.onWSSConnection(ws, req);
        });
        this._hs.listen(this._serverPort);
        const address = this._hs.address();
        const port = address.port;
        const settings = await iosAdapter_1.IOSAdapter.getProxySettings({
            proxyPath: null,
            proxyPort: port + 100,
            proxyArgs: null
        });
        this._adapter = new iosAdapter_1.IOSAdapter('/ios', `ws://localhost:${port}`, settings);
        try {
            await this._adapter.start();
        }
        catch (e) {
            (0, logger_1.debug)('adapter start skipped (no proxy binary): %s', e);
        }
        this.startTargetFetcher();
        return port;
    }
    stop() {
        (0, logger_1.debug)('server.stop');
        if (this._hs) {
            this._hs.close();
            this._hs = null;
        }
        this.stopTargetFetcher();
        if (this._adapter) {
            this._adapter.stop();
        }
    }
    startTargetFetcher() {
        (0, logger_1.debug)('server.startTargetFetcher');
        const fetch = () => {
            this._adapter.getTargets().then((targets) => {
                (0, logger_1.debug)(`server.startTargetFetcher.fetched.${targets.length}`);
            }, (err) => {
                (0, logger_1.debug)(`server.startTargetFetcher.error`, err);
            });
        };
        this._targetFetcherInterval = setInterval(fetch, 5000);
    }
    stopTargetFetcher() {
        (0, logger_1.debug)('server.stopTargetFetcher');
        if (!this._targetFetcherInterval)
            return;
        clearInterval(this._targetFetcherInterval);
    }
    handleHttp(req, res) {
        const url = req.url || '/';
        res.setHeader('Content-Type', 'application/json');
        if (url === '/') {
            (0, logger_1.debug)('server.http.endpoint/');
            res.end(JSON.stringify({ msg: 'UniTool Proxy OK!' }));
        }
        else if (url === '/refresh') {
            this._adapter.forceRefresh();
            this.emit('forceRefresh');
            res.end(JSON.stringify({ status: 'ok' }));
        }
        else if (url === '/json' || url === '/json/list') {
            (0, logger_1.debug)('server.http.endpoint' + url);
            this._adapter.getTargets().then((targets) => {
                res.end(JSON.stringify(targets));
            });
        }
        else if (url === '/json/version') {
            (0, logger_1.debug)('server.http.endpoint/json/version');
            res.end(JSON.stringify({
                Browser: 'Safari/UniTool iOS Webkit Adapter',
                'Protocol-Version': '1.2',
                'User-Agent': 'Mozilla/5.0',
                'WebKit-Version': '537.36'
            }));
        }
        else if (url === '/json/protocol') {
            (0, logger_1.debug)('server.http.endpoint/json/protocol');
            res.end(JSON.stringify({}));
        }
        else {
            res.statusCode = 404;
            res.end(JSON.stringify({ error: 'Not found' }));
        }
    }
    onWSSConnection(ws, req) {
        const url = req.url;
        (0, logger_1.debug)('server.ws.onWSSConnection', url);
        try {
            this._adapter.connectTo(url, ws);
        }
        catch (err) {
            (0, logger_1.debug)(`server.onWSSConnection.connectTo.error.${err}`);
        }
        ws.on('message', (msg) => {
            this._adapter.forwardTo(url, msg);
        });
    }
}
exports.ProxyServer = ProxyServer;
//# sourceMappingURL=server.js.map