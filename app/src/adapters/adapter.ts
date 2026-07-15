import * as http from 'http';
import { EventEmitter } from 'events';
import { spawn, ChildProcess } from 'child_process';
import { Target } from '../protocols/target';
import { debug, Logger } from '../logger';
import { IAdapterOptions } from './adapterInterfaces';

function httpGet(url: string): Promise<string> {
  return new Promise((resolve, reject) => {
    http.get(url, (res) => {
      let data = '';
      res.on('data', (chunk: string) => { data += chunk; });
      res.on('end', () => resolve(data));
    }).on('error', (err) => reject(err));
  });
}

export class Adapter extends EventEmitter {
  protected _id: string;
  protected _proxyUrl: string;
  protected _targetMap: Map<string, Target>;
  protected _targetIdToTargetDataMap: Map<string, any>;
  protected _options: IAdapterOptions;
  protected _url: string;
  protected _adapterType: string;
  protected _proxyProc: ChildProcess | null;

  constructor(id: string, socket: string, options: IAdapterOptions) {
    super();
    this._id = id;
    this._proxyUrl = socket;
    this._targetMap = new Map();
    this._targetIdToTargetDataMap = new Map();

    // Apply default options
    options.pollingInterval = options.pollingInterval || 3000;
    options.baseUrl = options.baseUrl || 'http://127.0.0.1';
    options.path = options.path || '/json';
    options.port = options.port || 9222;
    this._options = options;

    this._url = `${this._options.baseUrl}:${this._options.port}${this._options.path}`;

    const index = this._id.indexOf('/', 1);
    if (index >= 0) {
      this._adapterType = '_' + this._id.substr(1, index - 1);
    } else {
      this._adapterType = this._id.replace('/', '_');
    }
  }

  get id(): string {
    debug(`adapter.id`);
    return this._id;
  }

  start(): Promise<any> {
    debug(`adapter.start`, this._options);
    if (!this._options.proxyExePath) {
      debug(`adapter.start: Skip spawnProcess, no proxyExePath available`);
      return Promise.resolve('skipped');
    }
    return this.spawnProcess(this._options.proxyExePath, this._options.proxyExeArgs);
  }

  stop(): void {
    debug(`adapter.stop`);
    if (this._proxyProc) {
      this._proxyProc.kill('SIGTERM');
      this._proxyProc = null;
    }
  }

  getTargets(metadata?: any): Promise<any[]> {
    debug(`adapter.getTargets, metadata=${metadata}`);
    return httpGet(this._url).then((body: string) => {
      const targets: any[] = [];
      const rawTargets = JSON.parse(body);
      rawTargets.forEach((t: any) => {
        targets.push(this.setTargetInfo(t, metadata));
      });
      return targets;
    }).catch(() => []);
  }

  connectTo(targetId: string, wsFrom: any): Target | null {
    debug(`adapter.connectTo, targetId=${targetId}`);
    if (!this._targetIdToTargetDataMap.has(targetId)) {
      Logger.error(`No endpoint url found for id ${targetId}`);
      return null;
    } else if (this._targetMap.has(targetId)) {
      debug(`Existing target found for id ${targetId}`);
      const existingTarget = this._targetMap.get(targetId);
      existingTarget.updateClient(wsFrom);
      return existingTarget;
    }

    const targetData = this._targetIdToTargetDataMap.get(targetId);
    const target = new Target(targetId, targetData);
    target.connectTo(targetData.webSocketDebuggerUrl, wsFrom);

    // Store the tools websocket for this target
    this._targetMap.set(targetId, target);
    target.on('socketClosed', (id: string) => {
      this.emit('socketClosed', id);
    });

    return target;
  }

  forwardTo(targetId: string, message: any): void {
    debug(`adapter.forwardTo, targetId=${targetId}`);
    if (!this._targetMap.has(targetId)) {
      Logger.error(`No target found for id ${targetId}`);
      return;
    }
    this._targetMap.get(targetId).forward(message);
  }

  forceRefresh(): void {
    debug('adapter.forceRefresh');
    if (this._proxyProc && this._options.proxyExePath && this._options.proxyExeArgs) {
      this.refreshProcess(this._proxyProc, this._options.proxyExePath, this._options.proxyExeArgs);
    }
  }

  protected setTargetInfo(t: any, metadata?: any): any {
    debug('adapter.setTargetInfo', t, metadata);

    // Ensure there is a valid id
    const id = t.id || t.webSocketDebuggerUrl;
    t.id = id;

    // Set the adapter type
    t.adapterType = this._adapterType;
    t.type = t.type || 'page';

    // Append the metadata
    t.metadata = metadata;

    // Store the real endpoint
    const targetData = JSON.parse(JSON.stringify(t));
    this._targetIdToTargetDataMap.set(t.id, targetData);

    // Overwrite the real endpoint with the url of our proxy multiplexor
    t.webSocketDebuggerUrl = `${this._proxyUrl}${this._id}/${t.id}`;
    const wsUrl = `${this._proxyUrl.replace('ws://', '')}${this._id}/${t.id}`;
    t.devtoolsFrontendUrl = `https://chrome-devtools-frontend.appspot.com/serve_file/@fcea73228632975e052eb90fcf6cd1752d3b42b4/inspector.html?experiments=true&remoteFrontend=screencast&ws=${wsUrl}`;

    return t;
  }

  private refreshProcess(process: ChildProcess, path: string, args: string[]): Promise<any> {
    debug('adapter.refreshProcess');
    process.kill('SIGTERM');
    return this.spawnProcess(path, args);
  }

  private spawnProcess(path: string, args: string[]): Promise<ChildProcess> {
    debug(`adapter.spawnProcess, path=${path}`);
    return new Promise((resolve, reject) => {
      if (this._proxyProc) {
        reject('adapter.spawnProcess.error, err=process already started');
      }

      this._proxyProc = spawn(path, args, {
        detached: true,
        stdio: ['ignore', 'pipe', 'pipe']
      });

      this._proxyProc.on('error', (err: Error) => {
        debug(`adapter.spawnProcess.error, err=${err}`);
        reject(`adapter.spawnProcess.error, err=${err}`);
      });

      this._proxyProc.on('close', (code: number) => {
        debug(`adapter.spawnProcess.close, code=${code}`);
        reject(`adapter.spawnProcess.close, code=${code}`);
      });

      this._proxyProc.stdout.on('data', (data: Buffer) => {
        debug(`adapter.spawnProcess.stdout, data=${data.toString()}`);
      });

      this._proxyProc.stderr.on('data', (data: Buffer) => {
        debug(`adapter.spawnProcess.stderr, data=${data.toString()}`);
      });

      setTimeout(() => {
        resolve(this._proxyProc);
      }, 200);
    });
  }
}
