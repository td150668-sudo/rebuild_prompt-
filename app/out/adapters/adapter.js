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
exports.Adapter = void 0;
const http = __importStar(require("http"));
const events_1 = require("events");
const child_process_1 = require("child_process");
const target_1 = require("../protocols/target");
const logger_1 = require("../logger");
function httpGet(url) {
    return new Promise((resolve, reject) => {
        http.get(url, (res) => {
            let data = '';
            res.on('data', (chunk) => { data += chunk; });
            res.on('end', () => resolve(data));
        }).on('error', (err) => reject(err));
    });
}
class Adapter extends events_1.EventEmitter {
    constructor(id, socket, options) {
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
        }
        else {
            this._adapterType = this._id.replace('/', '_');
        }
    }
    get id() {
        (0, logger_1.debug)(`adapter.id`);
        return this._id;
    }
    start() {
        (0, logger_1.debug)(`adapter.start`, this._options);
        if (!this._options.proxyExePath) {
            (0, logger_1.debug)(`adapter.start: Skip spawnProcess, no proxyExePath available`);
            return Promise.resolve('skipped');
        }
        return this.spawnProcess(this._options.proxyExePath, this._options.proxyExeArgs);
    }
    stop() {
        (0, logger_1.debug)(`adapter.stop`);
        if (this._proxyProc) {
            this._proxyProc.kill('SIGTERM');
            this._proxyProc = null;
        }
    }
    getTargets(metadata) {
        (0, logger_1.debug)(`adapter.getTargets, metadata=${metadata}`);
        return httpGet(this._url).then((body) => {
            const targets = [];
            const rawTargets = JSON.parse(body);
            rawTargets.forEach((t) => {
                targets.push(this.setTargetInfo(t, metadata));
            });
            return targets;
        }).catch(() => []);
    }
    connectTo(targetId, wsFrom) {
        (0, logger_1.debug)(`adapter.connectTo, targetId=${targetId}`);
        if (!this._targetIdToTargetDataMap.has(targetId)) {
            logger_1.Logger.error(`No endpoint url found for id ${targetId}`);
            return null;
        }
        else if (this._targetMap.has(targetId)) {
            (0, logger_1.debug)(`Existing target found for id ${targetId}`);
            const existingTarget = this._targetMap.get(targetId);
            existingTarget.updateClient(wsFrom);
            return existingTarget;
        }
        const targetData = this._targetIdToTargetDataMap.get(targetId);
        const target = new target_1.Target(targetId, targetData);
        target.connectTo(targetData.webSocketDebuggerUrl, wsFrom);
        // Store the tools websocket for this target
        this._targetMap.set(targetId, target);
        target.on('socketClosed', (id) => {
            this.emit('socketClosed', id);
        });
        return target;
    }
    forwardTo(targetId, message) {
        (0, logger_1.debug)(`adapter.forwardTo, targetId=${targetId}`);
        if (!this._targetMap.has(targetId)) {
            logger_1.Logger.error(`No target found for id ${targetId}`);
            return;
        }
        this._targetMap.get(targetId).forward(message);
    }
    forceRefresh() {
        (0, logger_1.debug)('adapter.forceRefresh');
        if (this._proxyProc && this._options.proxyExePath && this._options.proxyExeArgs) {
            this.refreshProcess(this._proxyProc, this._options.proxyExePath, this._options.proxyExeArgs);
        }
    }
    setTargetInfo(t, metadata) {
        (0, logger_1.debug)('adapter.setTargetInfo', t, metadata);
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
    refreshProcess(process, path, args) {
        (0, logger_1.debug)('adapter.refreshProcess');
        process.kill('SIGTERM');
        return this.spawnProcess(path, args);
    }
    spawnProcess(path, args) {
        (0, logger_1.debug)(`adapter.spawnProcess, path=${path}`);
        return new Promise((resolve, reject) => {
            if (this._proxyProc) {
                reject('adapter.spawnProcess.error, err=process already started');
            }
            this._proxyProc = (0, child_process_1.spawn)(path, args, {
                detached: true,
                stdio: ['ignore', 'pipe', 'pipe']
            });
            this._proxyProc.on('error', (err) => {
                (0, logger_1.debug)(`adapter.spawnProcess.error, err=${err}`);
                reject(`adapter.spawnProcess.error, err=${err}`);
            });
            this._proxyProc.on('close', (code) => {
                (0, logger_1.debug)(`adapter.spawnProcess.close, code=${code}`);
                reject(`adapter.spawnProcess.close, code=${code}`);
            });
            this._proxyProc.stdout.on('data', (data) => {
                (0, logger_1.debug)(`adapter.spawnProcess.stdout, data=${data.toString()}`);
            });
            this._proxyProc.stderr.on('data', (data) => {
                (0, logger_1.debug)(`adapter.spawnProcess.stderr, data=${data.toString()}`);
            });
            setTimeout(() => {
                resolve(this._proxyProc);
            }, 200);
        });
    }
}
exports.Adapter = Adapter;
//# sourceMappingURL=adapter.js.map