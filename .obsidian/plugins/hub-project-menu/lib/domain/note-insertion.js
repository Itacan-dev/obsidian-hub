"use strict";
const { createHash } = require("crypto");

const hash = value => createHash("sha256").update(value).digest("hex");
const normalized = value => value.replace(/\r\n?|\n/g, "\n");
const short = value => value.length > 64 ? value.slice(0, 61) + "…" : value;

class NoteLocationError extends Error {
    constructor() {
        super("This note position changed or is no longer available. Choose note and position again.");
        this.code = "NOTE_LOCATION_INVALID";
    }
}

// Only a complete, committed selection belongs in Capture intent. Offsets are
// deliberately not persisted: each write resolves the structural anchor anew.
function noteLocation(value) {
    if (!value || typeof value.path !== "string" || !/\.md$/i.test(value.path) ||
        value.path.startsWith("/") || /[\\\u0000-\u001f]/.test(value.path) || /^[a-z]:/i.test(value.path) ||
        value.path.split("/").some(part => !part || part === "." || part === "..")) return null;
    const positions = { note: ["end", "start"], heading: ["end", "top"], list: ["last", "first"] };
    if (!positions[value.targetType]?.includes(value.position)) return null;
    const result = { path: value.path, targetType: value.targetType, position: value.position };
    if (value.targetType !== "note") {
        if (typeof value.anchor !== "string" || !/^[0-9a-f]{64}$/i.test(value.anchor)) return null;
        result.anchor = value.anchor;
        if (typeof value.label === "string") result.label = value.label.slice(0, 240);
    }
    return result;
}

function sourceLines(text) {
    const lines = [];
    for (const match of text.matchAll(/([^\r\n]*)(\r\n|\r|\n|$)/g)) {
        if (!match[0] && match.index === text.length) break;
        lines.push({ text: match[1], from: match.index, to: match.index + match[0].length });
    }
    return lines;
}
const listItem = line => {
    const match = line.match(/^( {0,3})([-*+]|\d{1,9}[.)])([ \t]+)(.*)$/);
    if (!match || /^([-*_])(?:\s*\1){2,}\s*$/.test(line.trim())) return null;
    return { indent: match[1].length, marker: match[2], ordered: /^\d/.test(match[2]),
        delimiter: match[2].at(-1), content: match[4] };
};

// Small source scanner for the supported Markdown subset. YAML, fenced/indented
// code, comments and nested list items cannot become insertion targets. Keeping
// source offsets lets insertion preserve every unrelated byte of the note.
function parseNotePositions(text) {
    text = String(text);
    const lines = sourceLines(text), newline = text.match(/\r\n|\r|\n/)?.[0] ?? "\n";
    let bodyStart = text.startsWith("\ufeff") ? 1 : 0, first = 0, unclosedFrontmatter = false;
    if (lines[0]?.text.replace(/^\ufeff/, "").trim() === "---") {
        const end = lines.findIndex((line, i) => i > 0 && /^(---|\.\.\.)\s*$/.test(line.text));
        unclosedFrontmatter = end < 0;
        bodyStart = end < 0 ? text.length : lines[end].to; first = end < 0 ? lines.length : end + 1;
    }
    const headings = [], lists = [], stack = [];
    let fence = null, comment = false;
    for (let i = first; i < lines.length; i++) {
        const line = lines[i], source = line.text;
        if (comment) { if (source.includes("-->")) comment = false; continue; }
        if (fence) {
            const closing = source.match(/^ {0,3}(`{3,}|~{3,})\s*$/);
            if (closing && closing[1][0] === fence[0] && closing[1].length >= fence.length) fence = null;
            continue;
        }
        const opening = source.match(/^ {0,3}(`{3,}|~{3,})/);
        if (opening) { fence = opening[1]; continue; }
        if (/^\s*<!--/.test(source)) { comment = !source.includes("-->"); continue; }
        const heading = source.match(/^ {0,3}(#{1,6})(?:[ \t]+(.*?)\s*|\s*)$/);
        if (heading) {
            const level = heading[1].length, title = (heading[2] ?? "").replace(/[ \t]+#+[ \t]*$/, "").trim();
            while (stack.length && stack.at(-1).level >= level) stack.pop();
            const trail = [...stack.map(item => [item.level, item.title]), [level, title]];
            const item = { level, title, trail, from: line.from, top: line.to, end: text.length };
            headings.push(item); stack.push(item); continue;
        }
        const item = listItem(source); if (!item) continue;
        const items = [{ ...item, from: line.from }];
        let end = i + 1;
        for (; end < lines.length; end++) {
            const next = lines[end].text;
            if (!next.trim()) break;
            const candidate = listItem(next), indent = next.match(/^ */)[0].length;
            // Nested items and indented continuation lines belong to the item,
            // never to an independently selectable nested-list destination.
            if (next.startsWith("\t") || indent >= item.indent + 2) continue;
            if (!candidate || candidate.indent !== item.indent || candidate.ordered !== item.ordered ||
                candidate.ordered && candidate.delimiter !== item.delimiter) break;
            items.push({ ...candidate, from: lines[end].from });
        }
        lists.push({ from: line.from, to: lines[end - 1].to, items, trail: stack.map(item => [item.level, item.title]),
            label: stack.at(-1)?.title || "“" + short(item.content.replace(/^\[[ xX]\]\s*/, "").trim()) + "”" });
        i = end - 1;
    }
    for (let i = 0; i < headings.length; i++) {
        const item = headings[i];
        item.end = headings.slice(i + 1).find(next => next.level <= item.level)?.from ?? text.length;
    }
    for (const item of headings) {
        const peers = headings.filter(other => JSON.stringify(other.trail) === JSON.stringify(item.trail));
        const identity = ["heading", item.trail, ...(peers.length > 1 ? [normalized(text.slice(item.top, item.end)).trim()] : [])];
        const identical = peers.filter(other => normalized(text.slice(other.top, other.end)).trim() === normalized(text.slice(item.top, item.end)).trim());
        if (identical.length > 1) identity.push(hash(normalized(text)), item.from);
        item.anchor = hash(JSON.stringify(identity));
        const duplicateName = headings.filter(other => other.title === item.title).length > 1;
        item.label = short(duplicateName ? item.trail.map(part => part[1] || "Untitled heading").join(" · ") : item.title || "Untitled heading");
        if (peers.length > 1) item.label += " · " + (peers.indexOf(item) + 1);
    }
    const listLabels = lists.map(list => list.label);
    for (const list of lists) {
        const block = normalized(text.slice(list.from, list.to)).trimEnd();
        const identity = ["list", list.trail, block];
        const peers = lists.filter(other => JSON.stringify(other.trail) === JSON.stringify(list.trail) && normalized(text.slice(other.from, other.to)).trimEnd() === block);
        if (peers.length > 1) identity.push(hash(normalized(text)), list.from);
        list.anchor = hash(JSON.stringify(identity));
        const labels = lists.filter((other, i) => listLabels[i] === list.label);
        if (labels.length > 1) list.label = short(list.label + " · “" + short(list.items[0].content) + "”") + (peers.length > 1 ? " · " + (peers.indexOf(list) + 1) : "");
    }
    return { newline, bodyStart, unclosedFrontmatter, headings, lists };
}

function resolveNoteLocation(parsed, value) {
    const location = noteLocation(value); if (!location || !parsed) return null;
    if (location.targetType === "note") return location.position === "start" && parsed.unclosedFrontmatter ? null : { location };
    const candidates = (location.targetType === "heading" ? parsed.headings : parsed.lists).filter(item => item.anchor === location.anchor);
    return candidates.length === 1 ? { location, target: candidates[0] } : null;
}

function insertNoteText(text, value, content) {
    const parsed = parseNotePositions(text), resolved = resolveNoteLocation(parsed, value);
    if (!resolved) throw new NoteLocationError();
    content = normalized(String(content ?? "")).replace(/^(?:[ \t]*\n)+/, "").trimEnd();
    if (!content.trim()) throw Error("Write the note content.");
    const { location, target } = resolved, eol = parsed.newline;
    let offset;
    if (location.targetType === "list") {
        const first = location.position === "first", model = first ? target.items[0] : target.items.at(-1);
        const marker = model.ordered ? (first ? parseInt(model.marker, 10) : parseInt(model.marker, 10) + 1) + model.delimiter : model.marker;
        const prefix = " ".repeat(model.indent) + marker + " ", indent = " ".repeat(prefix.length);
        content = content.split("\n").map((line, i) => (i ? indent : prefix) + line).join(eol);
        offset = first ? target.from : target.to;
        const before = text.slice(0, offset), after = text.slice(offset);
        const leading = before && !/[\r\n]$/.test(before) ? eol : "";
        const trailing = !first && after && !/^[\r\n]/.test(after) ? eol + eol : eol;
        return before + leading + content + trailing + after;
    }
    offset = location.targetType === "note" ? location.position === "start" ? parsed.bodyStart : text.length :
        location.position === "top" ? target.top : target.end;
    content = content.replace(/\n/g, eol);
    const before = text.slice(0, offset), after = text.slice(offset);
    const count = value => (normalized(value).match(/\n/g) ?? []).length;
    const leading = !before || before === "\ufeff" ? "" : eol.repeat(Math.max(0, 2 - count(before.match(/[\r\n]*$/)[0])));
    const trailing = after ? eol.repeat(Math.max(0, 2 - count(after.match(/^[\r\n]*/)[0]))) : eol;
    return before + leading + content + trailing + after;
}

function noteLocationSummary(value) {
    const location = noteLocation(value); if (!location) return "Choose note and position...";
    const note = location.path.split("/").at(-1).replace(/\.md$/i, "");
    const positions = { note: { end: "End of note", start: "Start of note" }, heading: { end: "End of section", top: "Top of section" }, list: { last: "Last item", first: "First item" } };
    return [note, location.targetType !== "note" ? location.label : null, positions[location.targetType][location.position]].filter(Boolean).join(" · ");
}

module.exports = { NoteLocationError, noteLocation, parseNotePositions, resolveNoteLocation, insertNoteText, noteLocationSummary };
