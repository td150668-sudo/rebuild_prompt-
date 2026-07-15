"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Logger = void 0;
exports.debug = debug;
const DEBUG_ENABLED = process.env.DEBUG === 'remotedebug' || process.env.DEBUG === '*';
class LoggerUtil {
    log(msg, ...args) {
        console.log.apply(this, [msg, ...args]);
    }
    error(msg) {
        console.error(msg);
    }
}
function debug(msg, ...args) {
    if (DEBUG_ENABLED) {
        console.log(`[remotedebug] ${msg}`, ...args);
    }
}
exports.Logger = new LoggerUtil();
//# sourceMappingURL=logger.js.map