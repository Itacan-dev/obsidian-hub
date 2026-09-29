"use strict";

// Keep sound design and future volume/enabled preferences outside task logic.
function createCompletionAudio({ createContext = () => new globalThis.AudioContext(), getOptions = () => ({}) } = {}) {
    let context = null;
    async function play(kind) {
        try {
            const { enabled = true, volume = 1 } = getOptions();
            if (!enabled || !Number.isFinite(volume) || volume <= 0) return;
            if (!context || context.state === "closed") context = createContext();
            const current = context;
            if (current.state !== "running") await current.resume();
            if (context !== current || current.state !== "running") return;
            const duration = kind === "task" ? 0.21 : 0.12;
            const level = Math.min(volume, 1) * 0.035;
            const start = current.currentTime;
            const nodes = [];
            try {
                const tones = kind === "task" ? [[840, level * 0.94], [1260, level * 0.16]] : [[840, level]];
                for (const [frequency, peak] of tones) {
                    const oscillator = current.createOscillator();
                    nodes.push(oscillator);
                    const gain = current.createGain();
                    nodes.push(gain);
                    oscillator.type = "sine";
                    oscillator.frequency.setValueAtTime(frequency, start);
                    gain.gain.setValueAtTime(0, start);
                    gain.gain.linearRampToValueAtTime(peak, start + 0.008);
                    gain.gain.exponentialRampToValueAtTime(Math.max(peak * 0.001, 1e-9), start + duration - 0.015);
                    gain.gain.linearRampToValueAtTime(0, start + duration);
                    oscillator.connect(gain);
                    gain.connect(current.destination);
                    oscillator.onended = () => { oscillator.disconnect(); gain.disconnect(); };
                    oscillator.start(start);
                    oscillator.stop(start + duration + 0.005);
                }
            } catch (_) {
                for (const node of nodes) {
                    try { node.stop?.(); } catch (_) { /* May not have started. */ }
                    try { node.disconnect(); } catch (_) { /* Audio is optional. */ }
                }
            }
        } catch (_) { /* Unsupported/blocked audio must never affect completion. */ }
    }
    function dispose() {
        const current = context;
        context = null;
        try { current?.close()?.catch(() => {}); } catch (_) { /* Already closed. */ }
    }
    return {
        playStepCompletionSound: () => { void play("step"); },
        playTaskCompletionSound: () => { void play("task"); },
        dispose
    };
}

// Native checkbox activation (including Space and label clicks) dispatches click
// before change. Require both: even element.click() can emit a trusted change.
function bindCompletionSound(checkbox, play) {
    let userCompletion = false;
    checkbox.addEventListener("click", event => {
        userCompletion = event.isTrusted && checkbox.checked;
    });
    checkbox.addEventListener("change", event => {
        const shouldPlay = userCompletion && event.isTrusted && checkbox.checked;
        userCompletion = false;
        if (shouldPlay) {
            try { play(); } catch (_) { /* Audio must not block the checkbox. */ }
        }
    });
}

const completionAudio = createCompletionAudio();
module.exports = { createCompletionAudio, bindCompletionSound, ...completionAudio };
