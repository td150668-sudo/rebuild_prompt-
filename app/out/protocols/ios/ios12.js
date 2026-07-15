"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.IOS12Protocol = void 0;
const ios9_1 = require("./ios9");
class IOS12Protocol extends ios9_1.IOS9Protocol {
    constructor(target) {
        super(target);
        target.targetBased = true;
        target.addMessageFilter('target::Target.targetCreated', (msg) => this.onTargetCreated(msg));
    }
    onTargetCreated(msg) {
        this._target.targetId = msg.params.targetInfo.targetId;
        return Promise.resolve(msg);
    }
}
exports.IOS12Protocol = IOS12Protocol;
//# sourceMappingURL=ios12.js.map