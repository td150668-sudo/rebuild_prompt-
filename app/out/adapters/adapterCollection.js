"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AdapterCollection = void 0;
const adapter_1 = require("./adapter");
const logger_1 = require("../logger");
class AdapterCollection extends adapter_1.Adapter {
    constructor(id, proxyUrl, options) {
        super(id, proxyUrl, options);
        this._adapters = new Map();
    }
    start() {
        (0, logger_1.debug)(`adapterCollection.start`, this._adapters);
        const startPromises = [super.start()];
        this._adapters.forEach((adapter) => {
            startPromises.push(adapter.start());
        });
        return Promise.all(startPromises);
    }
    stop() {
        (0, logger_1.debug)(`adapterCollection.stop`);
        super.stop();
        this._adapters.forEach((adapter) => {
            adapter.stop();
        });
    }
    forceRefresh() {
        (0, logger_1.debug)(`adapterCollection.forceRefresh`);
        super.forceRefresh();
        this._adapters.forEach((adapter) => {
            adapter.forceRefresh();
        });
    }
    getTargets(metadata) {
        return new Promise((resolve, reject) => {
            const promises = [];
            let index = 0;
            this._adapters.forEach((adapter) => {
                let targetMetadata = null;
                if (metadata) {
                    targetMetadata = Array.isArray(metadata) ? metadata[index] : metadata;
                }
                promises.push(adapter.getTargets(targetMetadata));
                index++;
            });
            Promise.all(promises).then((results) => {
                let allTargets = [];
                results.forEach((targets) => {
                    allTargets = allTargets.concat(targets);
                });
                resolve(allTargets);
            });
        });
    }
    connectTo(url, wsFrom) {
        (0, logger_1.debug)(`adapterCollection.connectTo, url=${url}`);
        const id = this.getWebSocketId(url);
        let target = null;
        if (this._adapters.has(id.adapterId)) {
            target = this._adapters.get(id.adapterId).connectTo(id.targetId, wsFrom);
        }
        return target;
    }
    forwardTo(url, message) {
        (0, logger_1.debug)(`adapterCollection.forwardTo, url=${url}`);
        const id = this.getWebSocketId(url);
        if (this._adapters.has(id.adapterId)) {
            this._adapters.get(id.adapterId).forwardTo(id.targetId, message);
        }
    }
    getWebSocketId(url) {
        (0, logger_1.debug)(`adapterCollection.getWebSocketId, url=${url}`);
        const index = url.indexOf('/', 1);
        const adapterId = url.substr(0, index);
        const targetId = url.substr(index + 1);
        return { adapterId, targetId };
    }
}
exports.AdapterCollection = AdapterCollection;
//# sourceMappingURL=adapterCollection.js.map