"use strict";
const assert = require("node:assert/strict");
const { createCompletionAudio, bindCompletionSound } = require("../ui/completion-audio");
const settle = async () => { for (let i = 0; i < 10; i++) await Promise.resolve(); };
async function run() {
    const listeners = {}, checkbox = { checked: true, addEventListener: (name, handler) => { listeners[name] = handler; } };
    let plays = 0;
    bindCompletionSound(checkbox, () => plays++);
    assert.equal(plays, 0, "Restoring checked state is silent");
    listeners.change({ isTrusted: false });
    listeners.click({ isTrusted: false }); listeners.change({ isTrusted: true });
    assert.equal(plays, 0, "Synthetic click, change and programmatic state changes are silent");
    listeners.click({ isTrusted: true }); listeners.change({ isTrusted: true });
    listeners.change({ isTrusted: true });
    assert.equal(plays, 1, "One sound per genuine completion");
    checkbox.checked = false; listeners.click({ isTrusted: true }); listeners.change({ isTrusted: true });
    assert.equal(plays, 1, "Unchecking is silent");
    checkbox.checked = true; listeners.click({ isTrusted: true }); listeners.change({ isTrusted: true });
    assert.equal(plays, 2, "Rechecking plays again");
    bindCompletionSound(checkbox, () => { throw Error("Audio failed"); });
    listeners.click({ isTrusted: true }); listeners.change({ isTrusted: true });

    let created = 0, enabled = true, volume = 1;
    const oscillators = [], gains = [];
    const param = () => ({ events: [], setValueAtTime(...args) { this.events.push(args); }, linearRampToValueAtTime(...args) { this.events.push(args); }, exponentialRampToValueAtTime(...args) { this.events.push(args); } });
    const node = () => ({ disconnected: false, connect() {}, disconnect() { this.disconnected = true; } });
    const context = { state: "suspended", currentTime: 5, destination: {},
        async resume() { this.state = "running"; }, async close() { this.state = "closed"; },
        createOscillator() { const n = { ...node(), frequency: param(), start(at) { this.started = at; }, stop(at) { this.stopped = at; } }; oscillators.push(n); return n; },
        createGain() { const n = { ...node(), gain: param() }; gains.push(n); return n; }
    };
    const audio = createCompletionAudio({ createContext: () => { created++; return context; }, getOptions: () => ({ enabled, volume }) });
    assert.equal(created, 0, "Context creation is lazy");
    audio.playStepCompletionSound(); await settle();
    assert.equal(created, 1); assert.equal(oscillators.length, 1);
    assert.equal(oscillators[0].type, "sine");
    assert.deepEqual(gains[0].gain.events[0], [0, 5]);
    assert.deepEqual(gains[0].gain.events.at(-1), [0, 5.12], "Step fades fully to zero at 120ms");
    audio.playTaskCompletionSound();
    assert.equal(oscillators.length, 3);
    assert.deepEqual(gains[1].gain.events.at(-1), [0, 5.21], "Task fades fully to zero at 210ms");
    assert.equal(oscillators[0].frequency.events[0][0], oscillators[1].frequency.events[0][0], "Same base timbre");
    assert.ok(gains[1].gain.events[1][0] + gains[2].gain.events[1][0] <= gains[0].gain.events[1][0] * 1.11, "Task peak stays modest");
    for (let i = 0; i < 20; i++) audio.playStepCompletionSound();
    assert.equal(created, 1); assert.equal(oscillators.length, 23);
    assert.equal(oscillators[0].stopped, 5.125, "New voices do not cut off previous sounds");
    for (const oscillator of oscillators) oscillator.onended();
    assert.ok([...oscillators, ...gains].every(n => n.disconnected), "All voice nodes disconnect");
    enabled = false; audio.playTaskCompletionSound(); enabled = true; volume = 0; audio.playStepCompletionSound();
    assert.equal(oscillators.length, 23, "Future mute/volume controls are supported");
    audio.dispose(); assert.equal(context.state, "closed");
    for (const createContext of [() => { throw Error("Unavailable"); }, () => ({ state: "suspended", resume: () => Promise.reject(Error("Blocked")) }), () => ({ state: "running", createOscillator() { throw Error("Device failed"); } })]) {
        const failed = createCompletionAudio({ createContext });
        failed.playStepCompletionSound(); failed.playTaskCompletionSound(); await settle(); failed.dispose();
    }
    console.log("PASS: completion intent, silence on restore/programmatic/uncheck, envelopes, overlap, reuse, cleanup, preferences and silent audio failures");
}
run().catch(error => { console.error(error); process.exitCode = 1; });
