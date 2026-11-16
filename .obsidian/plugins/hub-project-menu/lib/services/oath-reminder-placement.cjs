"use strict";
const valid = r => r && [r.x, r.y, r.width, r.height].every(Number.isFinite) && r.width > 0 && r.height > 0;
const overlap = (a, b) => valid(a) && valid(b) ? Math.max(0, Math.min(a.x+a.width,b.x+b.width)-Math.max(a.x,b.x)) * Math.max(0,Math.min(a.y+a.height,b.y+b.height)-Math.max(a.y,b.y)) : 0;
function centeredBounds(screen, foreground, hostBounds, retainedId = null) {
    const displays = screen.getAllDisplays();
    const host = valid(hostBounds) ? screen.getDisplayMatching(hostBounds) : screen.getPrimaryDisplay();
    let display = displays.find(d => d.id === retainedId) ?? host;
    if (foreground) {
        let rect;
        try { if (valid(foreground.bounds)) rect = screen.screenToDipRect(null, foreground.bounds); } catch {}
        const ranked = displays.map(d => ({ d, area: overlap(rect, d.bounds) })).sort((a,b) => b.area-a.area || Number(b.d.id === host.id)-Number(a.d.id === host.id));
        display = ranked[0]?.area > 0 ? ranked[0].d : host;
    }
    const area = display.workArea, width = Math.min(380,area.width), height = Math.min(230,area.height);
    return { displayId: display.id, bounds: { x: area.x+Math.round((area.width-width)/2), y: area.y+Math.round((area.height-height)/2), width, height } };
}
module.exports = { centeredBounds };
