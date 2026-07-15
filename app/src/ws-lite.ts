/**
 * Minimal WebSocket server and client implementation using only Node.js built-ins.
 * Supports text frames only (sufficient for DevTools protocol JSON messages).
 */
import * as http from 'http';
import * as crypto from 'crypto';
import * as net from 'net';
import { EventEmitter } from 'events';

const GUID = '258EAFA5-E914-47DA-95CA-5AB5DC587D97';

export class WebSocket extends EventEmitter {
  static OPEN = 1;
  static CLOSED = 3;

  public readyState: number = 0;
  private _socket: net.Socket;

  constructor(urlOrSocket?: string | net.Socket) {
    super();
    if (typeof urlOrSocket === 'string') {
      this.connectToUrl(urlOrSocket);
    } else if (urlOrSocket instanceof net.Socket) {
      this._socket = urlOrSocket;
      this.readyState = WebSocket.OPEN;
      this.setupSocketListeners();
    }
  }

  private connectToUrl(url: string): void {
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

    socket.on('data', (data: Buffer) => {
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
      } else {
        this.handleData(data);
      }
    });

    socket.on('error', (err: Error) => {
      this.emit('error', err);
    });

    socket.on('close', () => {
      this.readyState = WebSocket.CLOSED;
      this.emit('close');
    });
  }

  private _buffer: Buffer = Buffer.alloc(0);

  private setupSocketListeners(): void {
    if (!this._socket) return;
    this._socket.on('data', (data: Buffer) => {
      this.handleData(data);
    });
    this._socket.on('close', () => {
      this.readyState = WebSocket.CLOSED;
      this.emit('close');
    });
    this._socket.on('error', (err: Error) => {
      this.emit('error', err);
    });
  }


  private handleData(data: Buffer): void {
    this._buffer = Buffer.concat([this._buffer, data]);
    while (this._buffer.length >= 2) {
      const firstByte = this._buffer[0];
      const secondByte = this._buffer[1];
      const isMasked = (secondByte & 0x80) !== 0;
      let payloadLength = secondByte & 0x7f;
      let offset = 2;

      if (payloadLength === 126) {
        if (this._buffer.length < 4) return;
        payloadLength = this._buffer.readUInt16BE(2);
        offset = 4;
      } else if (payloadLength === 127) {
        if (this._buffer.length < 10) return;
        payloadLength = Number(this._buffer.readBigUInt64BE(2));
        offset = 10;
      }

      if (isMasked) {
        if (this._buffer.length < offset + 4 + payloadLength) return;
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
        } else if (opcode === 0x08) {
          this.close();
        }
      } else {
        if (this._buffer.length < offset + payloadLength) return;
        const payload = this._buffer.slice(offset, offset + payloadLength);
        this._buffer = this._buffer.slice(offset + payloadLength);
        const opcode = firstByte & 0x0f;
        if (opcode === 0x01) {
          this.emit('message', payload.toString('utf8'));
        } else if (opcode === 0x08) {
          this.close();
        }
      }
    }
  }

  send(data: string): void {
    if (this.readyState !== WebSocket.OPEN || !this._socket) return;
    const payload = Buffer.from(data, 'utf8');
    const frame = this.createFrame(payload);
    this._socket.write(frame);
  }

  close(): void {
    this.readyState = WebSocket.CLOSED;
    if (this._socket) {
      this._socket.end();
    }
  }

  private createFrame(payload: Buffer): Buffer {
    const length = payload.length;
    let header: Buffer;
    if (length < 126) {
      header = Buffer.alloc(2);
      header[0] = 0x81; // FIN + text opcode
      header[1] = length;
    } else if (length < 65536) {
      header = Buffer.alloc(4);
      header[0] = 0x81;
      header[1] = 126;
      header.writeUInt16BE(length, 2);
    } else {
      header = Buffer.alloc(10);
      header[0] = 0x81;
      header[1] = 127;
      header.writeBigUInt64BE(BigInt(length), 2);
    }
    return Buffer.concat([header, payload]);
  }
}


export class WebSocketServer extends EventEmitter {
  constructor(server: http.Server) {
    super();
    server.on('upgrade', (req: http.IncomingMessage, socket: net.Socket, head: Buffer) => {
      this.handleUpgrade(req, socket, head);
    });
  }

  private handleUpgrade(req: http.IncomingMessage, socket: net.Socket, head: Buffer): void {
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

    const ws = new WebSocket(socket as any);
    this.emit('connection', ws, req);
  }
}
