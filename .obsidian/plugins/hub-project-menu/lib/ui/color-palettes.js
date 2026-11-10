"use strict";
// Curated Dark contracts. Default remains authoritative in styles.css.
const freeze = value => { if (value && typeof value === "object") { Object.values(value).forEach(freeze); Object.freeze(value); } return value; };
const DEFAULT_PREFERENCES = freeze({ version: 1, paletteId: "default", coordinateInterfaceColors: true });
const DEFAULT_DOCK = freeze({ background: "#242329", text: "#eeeeee", button: "#37353f", border: "#55515e", focus: "#b4a5ed" });
const ramp = ["00", "05", "10", "20", "25", "30", "35", "40", "50", "60", "70", "100"];
const oathRoles = ["active-text", "active-background", "active-border", "focus", "selection-border", "selection-tint", "action-background", "action-hover", "action-text", "pledge-border", "pledge-tint", "pledge-divider", "pledge-icon", "pinned-border", "pinned-tint", "pinned-title", "workspace-badge"];
function family(id, label, h, s, l, action, neutrals, oath, phase, dock) {
    const accent = {
        "--hub-palette-accent-h": String(h), "--hub-palette-accent-s": s + "%", "--hub-palette-accent-l": l + "%",
        "--hub-color-accent": `hsl(${h}, ${s}%, ${l}%)`,
        "--hub-color-accent-hover": `hsl(${h}, ${s}%, ${l + 5}%)`,
        "--hub-color-accent-text": `hsl(${h}, ${s}%, ${l}%)`,
        "--hub-color-accent-text-hover": `hsl(${h}, ${s}%, ${l + 5}%)`,
        "--hub-color-primary-action-background": action[0], "--hub-color-primary-action-background-hover": action[1],
        "--hub-color-primary-action-text": "#ffffff", "--hub-color-text-on-accent": "#151719", "--hub-color-checkbox-marker": "#151719"
    };
    const coordinated = Object.fromEntries(ramp.map((key, index) => ["--hub-palette-neutral-" + key, neutrals[index]]));
    oathRoles.forEach((key, index) => { coordinated["--hub-oath-" + key] = oath[index]; });
    coordinated["--hub-roadmap-phase-start"] = phase[0]; coordinated["--hub-roadmap-phase-end"] = phase[1];
    return { id, label, previewToken: "--hub-color-preview-" + id, accent, coordinated,
        dock: Object.fromEntries(Object.keys(DEFAULT_DOCK).map((key, i) => [key, dock[i]])) };
}
const PALETTES = freeze([
    { id: "default", label: "Default — Purple", previewToken: "--hub-color-preview-purple", accent: {}, coordinated: {}, dock: DEFAULT_DOCK },
    family("blue", "Blue", 210, 75, 72, ["#245fa5", "#2b68ae"],
        ["#191d23", "#1e2229", "#20252c", "#252b33", "#2b323b", "#303943", "#3c4653", "#515f70", "#687687", "#9eacc0", "#b3bfd0", "#dce2eb"],
        ["#c4dcf7", "#284f76", "#6b98c4", "#9ebfe8", "#9ebfe8", "#6193ca", "#305c90", "#39669a", "#ffffff", "#6784a7", "#6193ca", "#9ebfe8", "#a0c4ed", "#526f99", "#6188bd", "#b2c9ec", "#bacfea"],
        ["#8aafe0", "#b7d7dd"], ["#202630", "#e6edf5", "#303d4c", "#52647c", "#afc9ef"]),
    family("green", "Green", 165, 45, 68, ["#246957", "#2c7260"],
        ["#191f1d", "#1e2422", "#202724", "#252d29", "#2b342f", "#303b35", "#3c4941", "#526357", "#697d70", "#9eb6a8", "#b6c8bd", "#dce7e0"],
        ["#c4eddf", "#285b4b", "#6aab92", "#9cd4bf", "#9cd4bf", "#5aab90", "#2d6655", "#35705e", "#ffffff", "#658d7b", "#5aab90", "#9cd4bf", "#a1dcc6", "#507f6c", "#609d87", "#acd9c7", "#b9dfd0"],
        ["#88bfae", "#b1cae2"], ["#202a25", "#e6efe9", "#303f36", "#526f5f", "#afdac5"]),
    family("amber", "Amber", 40, 65, 70, ["#78551e", "#825e26"],
        ["#211d18", "#26221c", "#29241e", "#2e2922", "#352f27", "#3c352c", "#4b4236", "#655947", "#80725e", "#bbaa90", "#cec0aa", "#e9e2d6"],
        ["#f2dfb9", "#635025", "#b49a62", "#d9bd82", "#d9bd82", "#b58d49", "#75551f", "#7f5e27", "#ffffff", "#9b835b", "#b58d49", "#d9bd82", "#e4c894", "#8c754f", "#ac925d", "#ddc79b", "#e6d3af"],
        ["#d2af72", "#c4b8db"], ["#2b251d", "#f0e9dd", "#40372a", "#77654a", "#dfc494"]),
    family("gray", "Gray", 220, 5, 74, ["#555b66", "#5f6570"],
        ["#1b1d20", "#202225", "#222427", "#27292d", "#2d2f34", "#33363b", "#40444a", "#575c64", "#707680", "#a8afb9", "#bbc0c8", "#dfe2e7"],
        ["#e0e4ec", "#454b56", "#929dac", "#b7c2d2", "#b7c2d2", "#929daa", "#535b68", "#5d6572", "#ffffff", "#8993a1", "#929daa", "#b7c2d2", "#c2cbd8", "#77818f", "#8b97a9", "#c4cddc", "#d0d7e2"],
        ["#a4b3ca", "#c1cad0"], ["#25272c", "#e8ebf0", "#383c44", "#636b79", "#c0cbdd"])
]);
const ACCENT_KEYS = freeze(Object.keys(PALETTES[1].accent));
const COORDINATED_KEYS = freeze(Object.keys(PALETTES[1].coordinated));
const TOKEN_KEYS = freeze([...ACCENT_KEYS, ...COORDINATED_KEYS]);
function luminance(value) {
    let rgb;
    if (/^#[0-9a-f]{6}$/i.test(value)) rgb = value.slice(1).match(/../g).map(x => parseInt(x, 16) / 255);
    else {
        const match = /^hsl\((\d+), (\d+)%, (\d+)%\)$/.exec(value);
        if (!match) throw Error("Unsupported palette color: " + value);
        const h = +match[1] / 60, s = +match[2] / 100, l = +match[3] / 100;
        const c = (1 - Math.abs(2 * l - 1)) * s, x = c * (1 - Math.abs(h % 2 - 1)), m = l - c / 2;
        rgb = (h < 1 ? [c,x,0] : h < 2 ? [x,c,0] : h < 3 ? [0,c,x] : h < 4 ? [0,x,c] : h < 5 ? [x,0,c] : [c,0,x]).map(v => v + m);
    }
    const a = rgb.map(v => v <= .04045 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4);
    return a[0] * .2126 + a[1] * .7152 + a[2] * .0722;
}
const contrast = (a,b) => { const x=luminance(a),y=luminance(b); return (Math.max(x,y)+.05)/(Math.min(x,y)+.05); };
function validatePalette(palette) {
    if (!palette || !/^(default|blue|green|amber|gray)$/.test(palette.id)) throw Error("Unknown palette");
    for (const [group, keys] of [[palette.accent, ACCENT_KEYS], [palette.coordinated, COORDINATED_KEYS]]) {
        if (!group || Object.keys(group).some(key => !keys.includes(key)) || (palette.id !== "default" && keys.some(key => !Object.hasOwn(group,key)))) throw Error("Incomplete palette roles");
        for (const [key,value] of Object.entries(group)) {
            if (key.startsWith("--hub-palette-accent-")) { if (!/^\d+%?$/.test(value) || parseInt(value) > (key.endsWith("-h") ? 359 : 100)) throw Error("Invalid accent channel"); }
            else luminance(value);
        }
    }
    if (Object.keys(palette.dock).sort().join() !== Object.keys(DEFAULT_DOCK).sort().join()) throw Error("Invalid dock roles");
    Object.values(palette.dock).forEach(luminance);
    if (palette.id === "default") { if (Object.keys(palette.accent).length || Object.keys(palette.coordinated).length) throw Error("Default cannot override CSS"); return; }
    const a=palette.accent,c=palette.coordinated;
    if(a["--hub-color-accent"] !== `hsl(${a["--hub-palette-accent-h"]}, ${a["--hub-palette-accent-s"]}, ${a["--hub-palette-accent-l"]})`) throw Error("Native accent channels disagree with accent fill");
    for (const fill of ["--hub-color-primary-action-background","--hub-color-primary-action-background-hover"]) if (contrast(a[fill],a["--hub-color-primary-action-text"])<4.5) throw Error("Primary contrast");
    if(luminance(a["--hub-color-primary-action-background-hover"])<=luminance(a["--hub-color-primary-action-background"])) throw Error("Primary hover must brighten");
    for(const fill of ["--hub-color-accent","--hub-color-accent-hover"]) if(contrast(a[fill],a["--hub-color-text-on-accent"])<4.5 || contrast(a[fill],a["--hub-color-checkbox-marker"])<3) throw Error("Selection contrast");
    for(const bg of ["#1c1c1c","#282828","#2e2e2e",c["--hub-palette-neutral-00"],c["--hub-palette-neutral-20"],c["--hub-palette-neutral-25"]]) {
        if(contrast(a["--hub-color-accent-text"],bg)<4.5 || contrast(c["--hub-palette-neutral-70"],bg)<4.5 || contrast(c["--hub-palette-neutral-60"],bg)<3) throw Error("Surface contrast");
    }
    for(const fill of ["action-background","action-hover"]) if(contrast(c["--hub-oath-"+fill],c["--hub-oath-action-text"])<4.5) throw Error("Oath action contrast");
    if(contrast(c["--hub-oath-active-text"],c["--hub-oath-active-background"])<4.5) throw Error("Oath active contrast");
    if(contrast(palette.dock.text,palette.dock.background)<4.5 || contrast(palette.dock.text,palette.dock.button)<4.5 || contrast(palette.dock.focus,palette.dock.button)<3) throw Error("Dock contrast");
}
if (new Set(PALETTES.map(p=>p.id)).size !== PALETTES.length) throw Error("Duplicate palette identifier");
PALETTES.forEach(validatePalette);
function normalizePreferences(value) {
    if (value == null) return { ...DEFAULT_PREFERENCES };
    if (value.version !== 1 || typeof value.paletteId !== "string" || typeof value.coordinateInterfaceColors !== "boolean" || Object.keys(value).some(k=>!Object.hasOwn(DEFAULT_PREFERENCES,k))) throw Error("Unsupported Appearance preferences");
    return { ...value, paletteId: PALETTES.some(p=>p.id===value.paletteId) ? value.paletteId : "default" };
}
function resolvePalette(value) {
    const preferences=normalizePreferences(value), palette=PALETTES.find(p=>p.id===preferences.paletteId);
    return freeze({ preferences, tokens: { ...palette.accent, ...(preferences.coordinateInterfaceColors ? palette.coordinated : {}) }, dock: preferences.coordinateInterfaceColors ? palette.dock : DEFAULT_DOCK });
}
module.exports = { PALETTES, DEFAULT_PREFERENCES, DEFAULT_DOCK, TOKEN_KEYS, ACCENT_KEYS, COORDINATED_KEYS, normalizePreferences, resolvePalette, validatePalette, luminance, contrast };
