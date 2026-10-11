"use strict";
const assert = require("node:assert/strict");
const { heatmapGeometry } = require("../ui/progress-heatmap");
let cases = 0;
// All weekday alignments, both common/leap years, century exceptions and all
// supported week starts. UTC here represents calendar ordinals, not report dates.
for (const year of [1900, 2000, ...Array.from({ length: 28 }, (_, i) => 2020 + i)]) {
    for (let weekStart = 0; weekStart < 7; weekStart++) {
        const first = Date.UTC(year, 0, 1);
        const offset = (new Date(first).getUTCDay() - weekStart + 7) % 7;
        const days = (Date.UTC(year + 1, 0, 1) - first) / 86400000;
        const weeks = Math.ceil((offset + days) / 7);
        const starts = Array.from({ length: 12 }, (_, month) => Math.floor((offset + (Date.UTC(year, month, 1) - first) / 86400000) / 7));
        for (const scale of [.8, 1, 1.1, 1.25, 1.5, 1.65, 1.75, 2, 2.2, 2.5, 3]) {
        for (const width of [0, 120, 180, 240, 320, 360.5, 447.4, 470, 640, 1000]) {
            const labels = [20, 19, 22, 18, 23, 19, 16, 23, 21, 20, 23, 23];
            const initials = Array(12).fill(9);
            const g = heatmapGeometry(width, weeks, labels, starts, initials, scale);
            assert(g.cell >= 2 && Math.abs(g.gap * scale - 1) < 1e-9);
            assert(Number.isInteger(g.cellPixels));
            assert(Math.abs(g.cell * scale - g.cellPixels) < 1e-9);
            assert(Math.abs(g.width - (2 * g.margin + weeks * g.cell + (weeks - 1) * g.gap)) < 1e-9);
            assert(g.width >= width && g.margin >= -1e-9 && g.margin < weeks / (2 * scale) + 1e-9);
            (g.compact ? initials : labels).forEach((label, index) => assert(((starts[index + 1] ?? weeks) - starts[index]) * (g.cell + g.gap) - g.gap >= label + 3));
            // No larger quantized square can fit within the same required margins.
            assert(weeks * (g.cell + 1 / scale) + (weeks - 1) * g.gap > g.width + 1e-9);
            assert.deepEqual(heatmapGeometry(width, weeks, labels, starts, initials, scale), g);
            cases++;
        }
        }
    }
}
const compact = heatmapGeometry(280, 53, Array(12).fill(23), [0,4,8,13,17,21,26,30,34,39,43,47], Array(12).fill(8));
assert(compact.compact && compact.width === 280, "Narrow panel uses readable initials without scrolling");
console.log(`PASS: ${cases} heatmap geometries, all week starts, leap/century years, symmetric margins, label clearance and maximum equal squares.`);
