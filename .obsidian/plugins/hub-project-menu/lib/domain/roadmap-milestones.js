"use strict";

const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
const overlaps = (a, b, gap) => a.left < b.left + b.width + gap && b.left < a.left + a.width + gap;

// Preserve the former 12px CSS square, 2px inset border and 25px top.
// Explicit outer/inner polygons reproduce the rotated border without an SVG
// stroke extending beyond the authoritative vertex used by the connector.
function milestoneDiamond(x, { side = 12, border = 2, top = 25 } = {}) {
    const y = top + side / 2, radius = side / Math.SQRT2;
    const vertices = r => ({ top: [x, y - r], right: [x + r, y], bottom: [x, y + r], left: [x - r, y] });
    return { x, y, radius, anchors: vertices(radius), interior: vertices(Math.max(0, side - 2 * border) / Math.SQRT2) };
}

// Pixel coordinates are local to the date track. Only cards are displaced;
// the caller retains authoritative date positions for every diamond.
function placeMilestoneCards(items, { left = 0, right, width = 145, top = 52, gap = 12, lanes = 3 } = {}) {
    left += gap / 2; right -= gap / 2;
    width = Math.max(1, Math.min(width, right - left));
    const pitch = Math.max(1, ...items.map(item => item.height)) + gap;
    const occupied = Array.from({ length: lanes }, () => []), cards = [], overflow = [];
    for (const item of items) {
        const preferred = clamp(item.x - width / 2, left, right - width);
        let placement;
        // Center/clamp first, moving down before introducing a horizontal shift.
        for (let lane = 0; lane < lanes; lane++) {
            if (!occupied[lane].some(other => overlaps({ left: preferred, width }, other, gap))) {
                placement = { left: preferred, lane }; break;
            }
        }
        if (!placement) {
            const candidates = occupied.flatMap((row, lane) => [left, right - width,
                ...row.flatMap(card => [card.left - width - gap, card.left + card.width + gap])]
                .filter(x => x >= left && x + width <= right && !row.some(card => overlaps({ left: x, width }, card, gap)))
                .map(x => ({ left: x, lane, distance: Math.abs(x - preferred) })));
            candidates.sort((a, b) => a.distance - b.distance || a.lane - b.lane || a.left - b.left);
            placement = candidates[0];
        }
        if (!placement) { overflow.push(item); continue; }
        const card = { ...item, ...placement, width, top: top + placement.lane * pitch };
        occupied[placement.lane].push(card); cards.push(card);
    }
    // When the physical three-lane capacity is exhausted, reserve one slot for
    // an accessible native-menu overflow control rather than grow or overlap.
    let more = null;
    if (overflow.length && cards.length) {
        more = cards.pop(); overflow.unshift(items.find(item => item.id === more.id));
    }
    return { cards, overflow, more, lanes: Math.max(1, ...cards.map(card => card.lane + 1), more ? more.lane + 1 : 1), pitch };
}

function segmentHitsCard(a, b, card, clearance = 2) {
    const left = card.left - clearance, right = card.left + card.width + clearance;
    const top = card.top - clearance, bottom = card.top + card.height + clearance;
    if (a[0] === b[0]) return a[0] > left && a[0] < right && Math.max(a[1], b[1]) > top && Math.min(a[1], b[1]) < bottom;
    return a[1] > top && a[1] < bottom && Math.max(a[0], b[0]) > left && Math.min(a[0], b[0]) < right;
}
function simplify(points) {
    const out = [];
    for (const point of points) {
        if (out.length && point[0] === out.at(-1)[0] && point[1] === out.at(-1)[1]) continue;
        if (out.length > 1) {
            const a = out.at(-2), b = out.at(-1);
            if (a[0] === b[0] && b[0] === point[0] || a[1] === b[1] && b[1] === point[1]) out.pop();
        }
        out.push(point);
    }
    return out;
}
function segments(points) { return points.slice(1).map((point, i) => [points[i], point]); }
function crosses(a, b) {
    const [p, q] = a, [r, s] = b;
    if ((p[0] === q[0]) === (r[0] === s[0])) return false;
    const [v, h] = p[0] === q[0] ? [a, b] : [b, a];
    return v[0][0] > Math.min(h[0][0], h[1][0]) && v[0][0] < Math.max(h[0][0], h[1][0]) &&
        h[0][1] > Math.min(v[0][1], v[1][1]) && h[0][1] < Math.max(v[0][1], v[1][1]);
}

// A compact orthogonal router: direct, one gutter turn, or a clear vertical
// corridor with two gutter turns. It never routes through another card.
function milestoneLeaders(cards, { bottom = 40, left = 0, right, today = null, more = null } = {}) {
    const routes = [], obstacles = more ? [...cards, more] : cards;
    for (const card of cards) {
        const source = card.tip ?? [card.x, bottom], [sourceX, sourceY] = source;
        const endX = clamp(sourceX, card.left + 6, card.left + card.width - 6);
        const blockers = obstacles.filter(other => other !== card);
        if (card.lane === 0 && sourceX >= card.left + 6 && sourceX <= card.left + card.width - 6) continue;
        const gutter = card.top - 6, first = sourceY + 6;
        const corridors = [left + 2, right - 2, ...blockers.flatMap(other => [other.left - 4, other.left + other.width + 4])];
        const endpoints = [...new Set([endX, card.left + 6, card.left + card.width - 6,
            ...corridors.filter(x => x >= card.left + 6 && x <= card.left + card.width - 6)])];
        const candidates = endpoints.flatMap(end => [
            [source, [sourceX, gutter], [end, gutter], [end, card.top]],
            [source, [sourceX, first], [end, first], [end, card.top]]
        ]);
        for (const x of corridors.filter(x => x >= left && x <= right)) {
            candidates.push([source, [sourceX, first], [x, first], [x, gutter], [endX, gutter], [endX, card.top]]);
        }
        const choices = candidates.map(simplify).filter(points => !segments(points).some(([a, b]) => blockers.some(other => segmentHitsCard(a, b, other))));
        const cost = points => {
            const lines = segments(points);
            const length = lines.reduce((sum, [a, b]) => sum + Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1]), 0);
            const intersections = lines.reduce((sum, line) => sum + routes.flatMap(route => segments(route.points)).filter(other => crosses(line, other)).length, 0);
            const todayCrossings = today == null ? 0 : lines.filter(([a, b]) => a[1] === b[1] && Math.min(a[0], b[0]) < today && Math.max(a[0], b[0]) > today).length;
            return length + (points.length - 2) * 30 + intersections * 40 + todayCrossings * 80;
        };
        choices.sort((a, b) => cost(a) - cost(b));
        if (choices[0]) routes.push({ id: card.id, points: choices[0] });
    }
    return routes;
}
module.exports = { milestoneDiamond, placeMilestoneCards, milestoneLeaders, segmentHitsCard };
