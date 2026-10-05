"use strict";
const assert = require("assert");
const { milestoneDiamond, placeMilestoneCards, milestoneLeaders, segmentHitsCard } = require("../domain/roadmap-milestones");
// Outer vertices are authoritative SVG polygon points, never inferred from a
// viewport box or an unrotated side. Preserve exact fractional timeline x.
for(const x of [0, .125, 100.3125, 999.875]){
    const g=milestoneDiamond(x);
    assert.deepStrictEqual(g.anchors.bottom,[x,g.y+g.radius]);
    assert.deepStrictEqual(g.anchors.left,[x-g.radius,g.y]);
    assert.deepStrictEqual(g.anchors.right,[x+g.radius,g.y]);
    assert.equal(g.y,31);assert.equal(g.radius,12/Math.SQRT2);
    assert.equal(g.interior.bottom[1],31+8/Math.SQRT2);
    const cards=placeMilestoneCards([{id:"a",x,tip:g.anchors.bottom,height:44},{id:"b",x:x+.5,tip:milestoneDiamond(x+.5).anchors.bottom,height:44}],{right:1200,top:g.anchors.bottom[1]+12});
    for(const route of milestoneLeaders(cards.cards,{right:1200}))assert.deepStrictEqual(route.points[0],cards.cards.find(card=>card.id===route.id).tip);
}
function check(xs, left = 0, right = 800) {
    const items = xs.map((x, i) => ({ id: "m" + i, x, height: 40 + i % 3 * 16 }));
    const layout = placeMilestoneCards(items, { left, right });
    assert.deepStrictEqual(layout, placeMilestoneCards(items, { left, right }), "Placement is deterministic");
    assert(layout.lanes <= 3, "Even extreme density is bounded to three lanes");
    assert.equal(layout.cards.length + layout.overflow.length, items.length, "Overflow retains every milestone");
    const cards = layout.more ? [...layout.cards, layout.more] : layout.cards;
    for (const [i, card] of cards.entries()) {
        assert.equal(card.x, items.find(item => item.id === card.id).x, "Date anchors never move");
        assert(card.left >= left && card.left + card.width <= right, "Labels stay inside the visible scrolled track");
        for (const other of cards.slice(i + 1)) assert(card.left + card.width <= other.left || other.left + other.width <= card.left ||
            card.top + card.height <= other.top || other.top + other.height <= card.top, "Cards never overlap");
    }
    const routes = milestoneLeaders(layout.cards, { left, right, bottom:40, today:(left + right) / 2, more:layout.more });
    for (const route of routes) {
        const card = layout.cards.find(card => card.id === route.id);
        assert.deepStrictEqual(route.points[0], [card.x, 40], "Leader starts at the exact bottom diamond tip");
        assert.equal(route.points.at(-1)[1], card.top, "Leader ends on upper card edge");
        assert(route.points.at(-1)[0] >= card.left && route.points.at(-1)[0] <= card.left + card.width);
        for (let i = 1; i < route.points.length; i++) {
            const a = route.points[i - 1], b = route.points[i];
            assert(a[0] === b[0] || a[1] === b[1], "Every segment is orthogonal");
            for (const other of cards.filter(other => other !== card)) assert(!segmentHitsCard(a, b, other), "Leaders avoid every other card");
        }
    }
    for (const card of layout.cards) if (card.lane || card.x < card.left + 6 || card.x > card.left + card.width - 6)
        assert(routes.some(route => route.id === card.id), "Every ambiguous displaced card has a leader");
    return { layout, routes };
}
const measured = placeMilestoneCards([{id:"offset-a",x:400,tip:[400.3125,39.485281],height:45},{id:"offset-b",x:401,tip:[401.1875,39.735281],height:45}],{right:800});
const measuredRoutes=milestoneLeaders(measured.cards,{right:800});
assert(measuredRoutes.length);
for(const route of measuredRoutes){
    const card=measured.cards.find(card=>card.id===route.id);
    assert.deepStrictEqual(route.points[0],card.tip,"Measured diamond geometry takes precedence over ideal date coordinates");
    assert.equal(route.points.at(-1)[1],card.top,"Measured route reaches card boundary");
    for(let i=1;i<route.points.length;i++)assert(route.points[i-1][0]===route.points[i][0]||route.points[i-1][1]===route.points[i][1]);
}
const isolated = check([400]); assert.equal(isolated.layout.cards[0].left, 327.5); assert.equal(isolated.routes.length, 0, "An isolated card needs no leader");
check([400, 404]); check([400, 404, 408]);
for (const width of [340, 600, 1000, 1600]) {
    for (const cluster of [6, width / 2, width - 12]) check(Array.from({length:6}, (_, i) => cluster + i), 0, width);
    check([300,301,302,303,304,305,500,599],300,600);
}
let seed = 37;
for (let trial = 0; trial < 100; trial++) {
    const xs = Array.from({length:20}, () => { seed = (seed * 16807) % 2147483647; return seed % 1000; }).sort((a,b)=>a-b);
    check(xs,0,1000);
}
const extreme = check(Array.from({length:1000},()=>400)); assert(extreme.layout.overflow.length > 0 && extreme.layout.more);
console.log("PASS: exact date anchors, centered isolated labels, bounded lanes, dense edge/middle/scrolled layouts, orthogonal card-avoiding leaders and accessible overflow capacity.");
