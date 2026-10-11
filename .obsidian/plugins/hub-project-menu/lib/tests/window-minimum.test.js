"use strict";

const assert = require("assert");
const { installWindowMinimum } = require("../services/window-minimum");

function windowHandle(minimum = [200, 150]) {
    let size = [...minimum];
    return {
        calls: [], destroyed: false,
        isDestroyed() { return this.destroyed; },
        getMinimumSize() { return [...size]; },
        setMinimumSize(width, height) { this.calls.push([width, height]); size = [width, height]; }
    };
}

const host = windowHandle(), other = windowHandle([400, 300]);
let dispose = installWindowMinimum({ electronWindow: host });
assert.deepStrictEqual(host.getMinimumSize(), [1024, 150]);
assert.deepStrictEqual(other.calls, []);
dispose();
dispose();
assert.deepStrictEqual(host.calls, [[1024, 150], [200, 150]]);
for (let i = 0; i < 3; i++) {
    dispose = installWindowMinimum({ electronWindow: host });
    assert.deepStrictEqual(host.getMinimumSize(), [1024, 150]);
    dispose();
    assert.deepStrictEqual(host.getMinimumSize(), [200, 150]);
}

for (const width of [1024, 1200]) {
    const native = windowHandle([width, 275]);
    installWindowMinimum({ electronWindow: native })();
    assert.deepStrictEqual(native.getMinimumSize(), [width, 275]);
    assert.deepStrictEqual(native.calls, []);
}
const zeroHeight = windowHandle([0, 0]);
installWindowMinimum({ electronWindow: zeroHeight })();
assert.deepStrictEqual(zeroHeight.calls, [[1024, 0], [0, 0]]);

const fallback = windowHandle();
installWindowMinimum({ electron: { remote: { getCurrentWindow: () => fallback } } })();
assert.deepStrictEqual(fallback.calls, [[1024, 150], [200, 150]]);
const destroyed = windowHandle();
dispose = installWindowMinimum({ electronWindow: destroyed });
destroyed.destroyed = true;
dispose();
assert.deepStrictEqual(destroyed.calls, [[1024, 150]]);
assert.doesNotThrow(() => installWindowMinimum({ electronWindow: destroyed })());
assert.doesNotThrow(() => installWindowMinimum(undefined)());
assert.doesNotThrow(() => installWindowMinimum({ electronWindow: {} })());

const warn = console.warn;
const warnings = [];
console.warn = (...args) => warnings.push(args);
try {
    assert.doesNotThrow(() => installWindowMinimum({ get electronWindow() { throw Error("Unavailable"); } })());
    const invalid = windowHandle();
    invalid.getMinimumSize = () => [NaN, 150];
    installWindowMinimum({ electronWindow: invalid })();
    assert.deepStrictEqual(invalid.calls, []);
    const partial = windowHandle();
    const set = partial.setMinimumSize;
    partial.setMinimumSize = function (width, height) {
        set.call(this, width, height);
        if (width === 1024) throw Error("Native failure");
    };
    installWindowMinimum({ electronWindow: partial })();
    assert.deepStrictEqual(partial.getMinimumSize(), [200, 150]);
    const failedRestore = windowHandle();
    const restoreSet = failedRestore.setMinimumSize;
    dispose = installWindowMinimum({ electronWindow: failedRestore });
    failedRestore.setMinimumSize = () => { throw Error("IPC disconnected"); };
    assert.doesNotThrow(dispose);
    failedRestore.setMinimumSize = restoreSet;
    dispose();
    assert.deepStrictEqual(failedRestore.getMinimumSize(), [200, 150]);
    assert.strictEqual(warnings.length, 3);
} finally { console.warn = warn; }

console.log("Window minimum lifecycle checks passed.");
