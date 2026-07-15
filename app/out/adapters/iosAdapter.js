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
exports.IOSAdapter = void 0;
const http = __importStar(require("http"));
const path = __importStar(require("path"));
const fs = __importStar(require("fs"));
const os = __importStar(require("os"));
const child_process_1 = require("child_process");
const logger_1 = require("../logger");
const adapter_1 = require("./adapter");
const adapterCollection_1 = require("./adapterCollection");
const ios8_1 = require("../protocols/ios/ios8");
const ios9_1 = require("../protocols/ios/ios9");
const ios12_1 = require("../protocols/ios/ios12");
function httpGet(url) {
    return new Promise((resolve, reject) => {
        http.get(url, (res) => {
            let data = '';
            res.on('data', (chunk) => { data += chunk; });
            res.on('end', () => resolve(data));
        }).on('error', (err) => reject(err));
    });
}
class IOSAdapter extends adapterCollection_1.AdapterCollection {
    constructor(id, socket, proxySettings) {
        super(id, socket, {
            port: proxySettings.proxyPort,
            proxyExePath: proxySettings.proxyPath,
            proxyExeArgs: proxySettings.proxyArgs
        });
        this._proxySettings = proxySettings;
        this._protocolMap = new Map();
    }
    getTargets() {
        (0, logger_1.debug)(`iOSAdapter.getTargets`);
        return httpGet(this._url).then((body) => {
            try {
                return JSON.parse(body);
            }
            catch (e) {
                return [];
            }
        }).catch(() => [])
            .then((devices) => {
            devices.forEach((d) => {
                if (d.deviceId === 'SIMULATOR') {
                    d.version = '9.3.0';
                }
                else if (d.deviceOSVersion) {
                    d.version = d.deviceOSVersion;
                }
                else {
                    (0, logger_1.debug)(`error.iosAdapter.getTargets.getDeviceVersion.failed.fallback, device=${d}. Please update ios-webkit-debug-proxy to version 1.8.5`);
                    d.version = '9.3.0';
                }
            });
            return devices;
        })
            .then((devices) => {
            // Now start up all the adapters
            devices.forEach((d) => {
                const adapterId = `${this._id}_${d.deviceId}`;
                if (!this._adapters.has(adapterId)) {
                    const parts = (d.url || '').split(':');
                    if (parts.length > 1) {
                        const port = parseInt(parts[1], 10);
                        const adapter = new adapter_1.Adapter(adapterId, this._proxyUrl, { port });
                        adapter.start();
                        adapter.on('socketClosed', (id) => {
                            this.emit('socketClosed', id);
                        });
                        this._adapters.set(adapterId, adapter);
                    }
                }
            });
            return devices;
        })
            .then((devices) => {
            // Now get the targets for each device adapter in our list
            return super.getTargets(devices);
        });
    }
    connectTo(url, wsFrom) {
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
    static async getProxySettings(args) {
        (0, logger_1.debug)(`iOSAdapter.getProxySettings`);
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
    static getProxyPath() {
        (0, logger_1.debug)(`iOSAdapter.getProxyPath`);
        return new Promise((resolve, reject) => {
            if (os.platform() === 'win32') {
                const baseDir = path.dirname(process.argv[1]);
                const proxy = path.join(baseDir, 'ios-webkit-debug-proxy-1.9.1-win64-bin', 'ios_webkit_debug_proxy.exe');
                try {
                    fs.statSync(proxy);
                    resolve(proxy);
                }
                catch (err) {
                    resolve(null);
                }
            }
            else if (os.platform() === 'darwin' || os.platform() === 'linux') {
                try {
                    const resolvedPath = (0, child_process_1.execSync)('which ios_webkit_debug_proxy', { encoding: 'utf8' }).trim();
                    if (resolvedPath) {
                        resolve(resolvedPath);
                    }
                    else {
                        resolve(null);
                    }
                }
                catch (e) {
                    resolve(null);
                }
            }
            else {
                resolve(null);
            }
        });
    }
    getProtocolFor(version, target) {
        (0, logger_1.debug)(`iOSAdapter.getProtocolFor`);
        const parts = (version || '').split('.');
        if (parts.length > 0) {
            const major = parseInt(parts[0], 10);
            if (major <= 8) {
                return new ios8_1.IOS8Protocol(target);
            }
            const minor = parseInt(parts[1], 10);
            if (major > 12 || (major >= 12 && minor >= 2)) {
                return new ios12_1.IOS12Protocol(target);
            }
        }
        return new ios9_1.IOS9Protocol(target);
    }
}
exports.IOSAdapter = IOSAdapter;
//# sourceMappingURL=iosAdapter.js.map