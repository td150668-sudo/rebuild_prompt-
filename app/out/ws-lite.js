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
exports.WebSocketServer = exports.WebSocket = void 0;
const crypto = __importStar(require("crypto"));
const net = __importStar(require("net"));
const events_1 = require("events");
const GUID = '258EAFA5-E914-47DA-95CA-5AB5DC587D97';
class WebSocket extends events_1.EventEmitter {
    constructor(urlOrSocket) {
        super();
        this.readyState = 0;
        this._buffer = Buffer.alloc(0);
        if (typeof urlOrSocket === 'string') {
            this.connectToUrl(urlOrSocket);
        }
        else if (urlOrSocket instanceof net.Socket) {
            this._socket = urlOrSocket;
            this.readyState = WebSocket.OPEN;
            this.setupSocketListeners();
        }
    }
    connectToUrl(url) {
        const parsed = new URL(url);
        const port = parseInt(parsed.port) || 80;
        const path = parsed.pathname + parsed.search;
        const key = crypto.randomBytes(16).toString('base64');
        const socket = net.createConnection(port, parsed.hostname, () => {
            const headers = [
                `GET ${path} HTTP/1.1`,
                `Host: ${parsed.hostname}:${port}`,
                `Upgrade: websocket`,
                `Connection: Upgrade`,
                `Sec-WebSocket-Key: ${key}`,
                `Sec-WebSocket-Version: 13`,
                '', ''
            ].join('\r\n');
            socket.write(headers);
        });
        let upgraded = false;
        let buffer = Buffer.alloc(0);
        socket.on('data', (data) => {
            if (!upgraded) {
                const str = data.toString();
                if (str.includes('\r\n\r\n')) {
                    upgraded = true;
                    this._socket = socket;
                    this.readyState = WebSocket.OPEN;
                    this.setupSocketListeners();
                    // Handle any remaining data after headers
                    const idx = data.indexOf(Buffer.from('\r\n\r\n'));
                    const remaining = data.slice(idx + 4);
                    if (remaining.length > 0) {
                        this.handleData(remaining);
                    }
                    this.emit('open');
                }
            }
            else {
                this.handleData(data);
            }
        });
        socket.on('error', (err) => {
            this.emit('error', err);
        });
        socket.on('close', () => {
            this.readyState = WebSocket.CLOSED;
            this.emit('close');
        });
    }
    setupSocketListeners() {
        if (!this._socket)
            return;
        this._socket.on('data', (data) => {
            this.handleData(data);
        });
        this._socket.on('close', () => {
            this.readyState = WebSocket.CLOSED;
            this.emit('close');
        });
        this._socket.on('error', (err) => {
            this.emit('error', err);
        });
    }
    handleData(data) {
        this._buffer = Buffer.concat([this._buffer, data]);
        while (this._buffer.length >= 2) {
            const firstByte = this._buffer[0];
            const secondByte = this._buffer[1];
            const isMasked = (secondByte & 0x80) !== 0;
            let payloadLength = secondByte & 0x7f;
            let offset = 2;
            if (payloadLength === 126) {
                if (this._buffer.length < 4)
                    return;
                payloadLength = this._buffer.readUInt16BE(2);
                offset = 4;
            }
            else if (payloadLength === 127) {
                if (this._buffer.length < 10)
                    return;
                payloadLength = Number(this._buffer.readBigUInt64BE(2));
                offset = 10;
            }
            if (isMasked) {
                if (this._buffer.length < offset + 4 + payloadLength)
                    return;
                const mask = this._buffer.slice(offset, offset + 4);
                offset += 4;
                const payload = this._buffer.slice(offset, offset + payloadLength);
                for (let i = 0; i < payload.length; i++) {
                    payload[i] ^= mask[i % 4];
                }
                this._buffer = this._buffer.slice(offset + payloadLength);
                const opcode = firstByte & 0x0f;
                if (opcode === 0x01) {
                    this.emit('message', payload.toString('utf8'));
                }
                else if (opcode === 0x08) {
                    this.close();
                }
            }
            else {
                if (this._buffer.length < offset + payloadLength)
                    return;
                const payload = this._buffer.slice(offset, offset + payloadLength);
                this._buffer = this._buffer.slice(offset + payloadLength);
                const opcode = firstByte & 0x0f;
                if (opcode === 0x01) {
                    this.emit('message', payload.toString('utf8'));
                }
                else if (opcode === 0x08) {
                    this.close();
                }
            }
        }
    }
    send(data) {
        if (this.readyState !== WebSocket.OPEN || !this._socket)
            return;
        const payload = Buffer.from(data, 'utf8');
        const frame = this.createFrame(payload);
        this._socket.write(frame);
    }
    close() {
        this.readyState = WebSocket.CLOSED;
        if (this._socket) {
            this._socket.end();
        }
    }
    createFrame(payload) {
        const length = payload.length;
        let header;
        if (length < 126) {
            header = Buffer.alloc(2);
            header[0] = 0x81; // FIN + text opcode
            header[1] = length;
        }
        else if (length < 65536) {
            header = Buffer.alloc(4);
            header[0] = 0x81;
            header[1] = 126;
            header.writeUInt16BE(length, 2);
        }
        else {
            header = Buffer.alloc(10);
            header[0] = 0x81;
            header[1] = 127;
            header.writeBigUInt64BE(BigInt(length), 2);
        }
        return Buffer.concat([header, payload]);
    }
}
exports.WebSocket = WebSocket;
WebSocket.OPEN = 1;
WebSocket.CLOSED = 3;
class WebSocketServer extends events_1.EventEmitter {
    constructor(server) {
        super();
        server.on('upgrade', (req, socket, head) => {
            this.handleUpgrade(req, socket, head);
        });
    }
    handleUpgrade(req, socket, head) {
        const key = req.headers['sec-websocket-key'];
        if (!key) {
            socket.destroy();
            return;
        }
        const acceptKey = crypto
            .createHash('sha1')
            .update(key + GUID)
            .digest('base64');
        const responseHeaders = [
            'HTTP/1.1 101 Switching Protocols',
            'Upgrade: websocket',
            'Connection: Upgrade',
            `Sec-WebSocket-Accept: ${acceptKey}`,
            '', ''
        ].join('\r\n');
        socket.write(responseHeaders);
        const ws = new WebSocket(socket);
        this.emit('connection', ws, req);
    }
}
exports.WebSocketServer = WebSocketServer;
//# sourceMappingURL=ws-lite.js.map