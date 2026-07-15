import { Adapter } from './adapter';
import { Target } from '../protocols/target';
import { debug } from '../logger';
import { IAdapterOptions } from './adapterInterfaces';

export class AdapterCollection extends Adapter {
  protected _adapters: Map<string, Adapter>;

  constructor(id: string, proxyUrl: string, options: IAdapterOptions) {
    super(id, proxyUrl, options);
    this._adapters = new Map();
  }

  start(): Promise<any> {
    debug(`adapterCollection.start`, this._adapters);
    const startPromises: Promise<any>[] = [super.start()];
    this._adapters.forEach((adapter) => {
      startPromises.push(adapter.start());
    });
    return Promise.all(startPromises);
  }

  stop(): void {
    debug(`adapterCollection.stop`);
    super.stop();
    this._adapters.forEach((adapter) => {
      adapter.stop();
    });
  }

  forceRefresh(): void {
    debug(`adapterCollection.forceRefresh`);
    super.forceRefresh();
    this._adapters.forEach((adapter) => {
      adapter.forceRefresh();
    });
  }

  getTargets(metadata?: any): Promise<any[]> {
    return new Promise((resolve, reject) => {
      const promises: Promise<any[]>[] = [];
      let index = 0;
      this._adapters.forEach((adapter) => {
        let targetMetadata: any = null;
        if (metadata) {
          targetMetadata = Array.isArray(metadata) ? metadata[index] : metadata;
        }
        promises.push(adapter.getTargets(targetMetadata));
        index++;
      });

      Promise.all(promises).then((results) => {
        let allTargets: any[] = [];
        results.forEach((targets) => {
          allTargets = allTargets.concat(targets);
        });
        resolve(allTargets);
      });
    });
  }

  connectTo(url: string, wsFrom: any): Target | null {
    debug(`adapterCollection.connectTo, url=${url}`);
    const id = this.getWebSocketId(url);
    let target: Target | null = null;
    if (this._adapters.has(id.adapterId)) {
      target = this._adapters.get(id.adapterId).connectTo(id.targetId, wsFrom);
    }
    return target;
  }

  forwardTo(url: string, message: any): void {
    debug(`adapterCollection.forwardTo, url=${url}`);
    const id = this.getWebSocketId(url);
    if (this._adapters.has(id.adapterId)) {
      this._adapters.get(id.adapterId).forwardTo(id.targetId, message);
    }
  }

  private getWebSocketId(url: string): { adapterId: string; targetId: string } {
    debug(`adapterCollection.getWebSocketId, url=${url}`);
    const index = url.indexOf('/', 1);
    const adapterId = url.substr(0, index);
    const targetId = url.substr(index + 1);
    return { adapterId, targetId };
  }
}
