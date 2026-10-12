"use strict";
const assert = require("node:assert/strict");
const { progressColor, progressColors } = require("../ui/progress-colors");
const alpha = score => Number(progressColor(score).match(/, ([\d.]+)\)$/)[1]);
// Compare painted RGB contrast on the existing dark panel and empty surface.
const green = [13, 201, 79], panel = [38, 38, 38], empty = [30, 30, 30];
const contrast = opacity => Math.hypot(...green.map((value, i) =>
    opacity * value + (1 - opacity) * panel[i] - empty[i]));
assert(contrast(alpha(1)) < contrast(.25), "Level 1 paints closer to empty than the former 25% green");
for (let score = 1.25; score <= 4; score += .25) {
    assert(alpha(score) > alpha(score - .25), "Every displayed score step increases brightness");
}
assert.deepEqual([1, 2, 3, 4].map(alpha), [.1, .3, .6, 1]);
assert.equal(progressColor(4), "rgba(13, 201, 79, 1)", "Level 4 retains its exact color and opacity");
assert.equal(progressColors.green[3], progressColor(4));
assert.equal(progressColor(2.24), progressColor(2), "Sub-quarter scores retain the existing display quantization");
assert.equal(progressColor(3.99), progressColor(3.75));
console.log("PASS: softer level-1 contrast, monotonic quarter-point colors, unchanged score quantization and exact level-4 green.");
