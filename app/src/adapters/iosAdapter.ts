import * as http from 'http';
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';
import { execSync } from 'child_process';
import { debug } from '../logger';
import { Adapter } from './adapter';
import { AdapterCollection } from './adapterCollection';
import { Target } from '../protocols/target';
import { IOS8Protocol } from '../protocols/ios/ios8';
import { IOS9Protocol } from '../protocols/ios/ios9';
import { IOS12Protocol } from '../protocols/ios/ios12';
import { IProxySettings, IDevice } from './adapterInterfaces';

function httpGet(url: string): Promise<string> {
  return new Promise((resolve, reject) => {
    http.get(url, (res) => {
      let data = '';
      res.on('data', (chunk: string) => { data += chunk; });
      res.on('end', () => resolve(data));
    }).on('error', (err) => reject(err));
  });
}

export class IOSAdapter extends AdapterCollection {
  private _proxySettings: IProxySettings;
  private _protocolMap: Map<Target, any>;

  constructor(id: string, socket: string, proxySettings: IProxySettings) {
    super(id, socket, {
      port: proxySettings.proxyPort,
      proxyExePath: proxySettings.proxyPath,
      proxyExeArgs: proxySettings.proxyArgs
    });
    this._proxySettings = proxySettings;
    this._protocolMap = new Map();
  }

  getTargets(): Promise<any[]> {
    debug(`iOSAdapter.getTargets`);

    return httpGet(this._url).then((body: string) => {
      try {
        return JSON.parse(body) as IDevice[];
      } catch (e) {
        return [] as IDevice[];
      }
    }).catch(() => [] as IDevice[])
      .then((devices: IDevice[]) => {
        devices.forEach((d) => {
          if (d.deviceId === 'SIMULATOR') {
            d.version = '9.3.0';
          } else if (d.deviceOSVersion) {
            d.version = d.deviceOSVersion;
          } else {
            debug(
              `error.iosAdapter.getTargets.getDeviceVersion.failed.fallback, device=${d}. Please update ios-webkit-debug-proxy to version 1.8.5`
            );
            d.version = '9.3.0';
          }
        });
        return devices;
      })
      .then((devices: IDevice[]) => {
        // Now start up all the adapters
        devices.forEach((d) => {
          const adapterId = `${this._id}_${d.deviceId}`;
          if (!this._adapters.has(adapterId)) {
            const parts = (d.url || '').split(':');
            if (parts.length > 1) {
              const port = parseInt(parts[1], 10);
              const adapter = new Adapter(adapterId, this._proxyUrl, { port });
              adapter.start();
              adapter.on('socketClosed', (id: string) => {
                this.emit('socketClosed', id);
              });
              this._adapters.set(adapterId, adapter);
            }
          }
        });
        return devices;
      })
      .then((devices: IDevice[]) => {
        // Now get the targets for each device adapter in our list
        return super.getTargets(devices);
      });
  }

  connectTo(url: string, wsFrom: any): Target {
    const target = super.connectTo(url, wsFrom);
    if (!target) {
      throw new Error(`Target not found for ${url}`);
    }

    if (!this._protocolMap.has(target)) {
      const version = target.data.metadata.version;
      const protocol = this.getProtocolFor(version, target);
      this._protocolMap.set(target, protocol);
    }

    return target;
  }

  static async getProxySettings(args: {
    proxyPath: string | null;
    proxyPort: number;
    proxyArgs: string[] | null;
  }): Promise<IProxySettings> {
    debug(`iOSAdapter.getProxySettings`);

    // Check that the proxy exists
    const proxyPath = await IOSAdapter.getProxyPath();

    const proxyPort = args.proxyPort;
    const proxyArgs = [
      '--no-frontend',
      '--config=null:' + proxyPort + ',:' + (proxyPort + 1) + '-' + (proxyPort + 101)
    ];

    return {
      proxyPath,
      proxyPort,
      proxyArgs
    };
  }

  static getProxyPath(): Promise<string> {
    debug(`iOSAdapter.getProxyPath`);
    return new Promise((resolve, reject) => {
      if (os.platform() === 'win32') {
        const baseDir = path.dirname(process.argv[1]);
        const proxy = path.join(
          baseDir,
          'ios-webkit-debug-proxy-1.9.1-win64-bin',
          'ios_webkit_debug_proxy.exe'
        );
        try {
          fs.statSync(proxy);
          resolve(proxy);
        } catch (err) {
          resolve(null);
        }
      } else if (os.platform() === 'darwin' || os.platform() === 'linux') {
        try {
          const resolvedPath = execSync('which ios_webkit_debug_proxy', { encoding: 'utf8' }).trim();
          if (resolvedPath) {
            resolve(resolvedPath);
          } else {
            resolve(null);
          }
        } catch (e) {
          resolve(null);
        }
      } else {
        resolve(null);
      }
    });
  }

  private getProtocolFor(version: string, target: Target): any {
    debug(`iOSAdapter.getProtocolFor`);
    const parts = (version || '').split('.');
    if (parts.length > 0) {
      const major = parseInt(parts[0], 10);
      if (major <= 8) {
        return new IOS8Protocol(target);
      }
      const minor = parseInt(parts[1], 10);
      if (major > 12 || (major >= 12 && minor >= 2)) {
        return new IOS12Protocol(target);
      }
    }
    return new IOS9Protocol(target);
  }
}
