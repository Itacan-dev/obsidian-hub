"use strict";
const { localISODate, parseLocalISODate } = require("./dates");
const { taskLineDetails, taskDisplayText, taskIdentity, locateTaskLine, normalizedTaskText } = require("./tasks");

function taskMetadata(value = {}) {
    return {
        necessity: ["should", "must"].includes(value?.necessity) ? value.necessity : null,
        fromDate: parseLocalISODate(value?.fromDate) ? value.fromDate : null,
        dueDate: parseLocalISODate(value?.dueDate) ? value.dueDate : null
    };
}

function validateTaskMetadata(value) {
    for (const key of ["fromDate", "dueDate"]) {
        if (value[key] && !parseLocalISODate(value[key])) throw Error("Choose a valid date.");
    }
    const metadata = taskMetadata(value);
    if (metadata.fromDate && metadata.dueDate && metadata.fromDate > metadata.dueDate) {
        throw Error("Due must be on or after Start (From).");
    }
    return metadata;
}

function taskGroups(items, today = localISODate()) {
    const taskOf = item => item.task && typeof item.task === "object" ? item.task : item;
    const rank = task => ({ must: 0, should: 1 }[task.necessity] ?? 2);
    const active = [], future = [], completed = [];
    for (const [order, item] of items.entries()) {
        const task = taskOf(item);
        const target = task.completed ? completed : task.fromDate > today ? future : active;
        target.push({ item, task, order });
    }
    const compare = (a, b) => {
        const category = task => task.dueDate ? (task.dueDate < today ? 0 : 1) : 2;
        return category(a.task) - category(b.task) ||
            String(a.task.dueDate ?? "").localeCompare(String(b.task.dueDate ?? "")) ||
            rank(a.task) - rank(b.task) || a.order - b.order;
    };
    active.sort(compare);
    future.sort((a, b) => a.task.fromDate.localeCompare(b.task.fromDate) || compare(a, b));
    return { active: active.map(x => x.item), future: future.map(x => x.item), completed: completed.map(x => x.item) };
}

const indent = line => (line.match(/^[ \t]*/)?.[0] ?? "").replace(/\t/g, "    ").length;

// End of this Markdown list item, including indented prose and subordinate
// lists. Blank separators are consumed only when more indented content follows.
function taskBlockEnd(lines, start) {
    const level = indent(lines[start]);
    let end = start + 1;
    while (end < lines.length) {
        if (!lines[end].trim()) {
            let next = end + 1;
            while (next < lines.length && !lines[next].trim()) next++;
            if (next >= lines.length || indent(lines[next]) <= level) break;
            end = next;
        }
        if (indent(lines[end]) <= level) break;
        end++;
    }
    return end;
}

function readTaskSnapshot(data, request) {
    const lines = data.split(/\r?\n/);
    const line = locateTaskLine(lines, request.line, request.text, request.hubTaskId);
    const end = taskBlockEnd(lines, line);
    const details = taskLineDetails(lines[line]);
    const steps = [];
    let fence = null;
    for (let i = line + 1; i < end; i++) {
        const token = lines[i].trim().match(/^(`{3,}|~{3,})/);
        if (token) { if (!fence) fence = token[1][0]; else if (fence === token[1][0]) fence = null; continue; }
        const child = !fence && taskLineDetails(lines[i]);
        if (child) steps.push({ line: i, text: taskDisplayText(child.text), completed: /^[xX]$/.test(child.marker),
            status: child.marker, indent: indent(lines[i]), end: taskBlockEnd(lines, i) });
    }
    return { path: request.path, line, end, text: taskDisplayText(details.text),
        hubTaskId: taskIdentity(details.text), completed: /^[xX]$/.test(details.marker),
        status: details.marker, steps, block: lines.slice(line, end).join("\n") };
}

function singleTaskText(value) {
    const text = String(value ?? "").trim();
    if (!text || /[\r\n]/.test(text)) throw Error("Enter task text on one line.");
    if (taskIdentity(text)) throw Error("Task text cannot contain a Hub identity marker.");
    return text;
}

// Resolve only inside the current parent block; never toggle a similarly named
// checkbox elsewhere in the note. Steps do not trigger parent completion/history.
function toggleTaskStep(data, request) {
    const parent = readTaskSnapshot(data, request);
    const matches = parent.steps.filter(step => normalizedTaskText(step.text) === normalizedTaskText(request.step.text));
    const expectedLine = parent.line + request.step.line - request.line;
    const step = matches.find(step => step.line === expectedLine) ?? (matches.length === 1 ? matches[0] : null);
    if (!step) throw Error("This Step moved or changed. Refresh the task before checking it.");
    const eol = data.includes("\r\n") ? "\r\n" : "\n";
    const lines = data.split(/\r?\n/);
    if (step.completed !== request.stepCompleted) {
        lines[step.line] = lines[step.line].replace(/^(\s*(?:[-*+]|\d+[.)])\s+\[)[^\]](\])/, (_all, prefix, suffix) =>
            prefix + (request.stepCompleted ? "x" : " ") + suffix);
    }
    const content = lines.join(eol);
    const saved = readTaskSnapshot(content, { ...request, line: parent.line });
    return { content, edit: { operation: "step", path: request.path, line: parent.line,
        requestLine: request.line, oldText: request.text, hubTaskId: parent.hubTaskId,
        tasks: [{ line: saved.line, text: saved.text, status: saved.status, completed: saved.completed, steps: saved.steps }],
        lineDelta: 0, changed: content !== data, wasCompleted: parent.completed, completed: saved.completed } };
}

function saveTaskSnapshot(data, snapshot, values, id = snapshot.hubTaskId) {
    const current = readTaskSnapshot(data, snapshot);
    if (current.block !== snapshot.block) throw Error("This task or its Steps changed in the note. Reopen the task before saving.");
    const eol = data.includes("\r\n") ? "\r\n" : "\n";
    const lines = data.split(/\r?\n/);
    const block = lines.slice(current.line, current.end);
    const deleting = values.operation === "delete";
    let replacement = [];
    if (!deleting) {
        const text = singleTaskText(values.text);
        const requested = values.steps ?? snapshot.steps;
        const existing = new Map(snapshot.steps.map(step => [step.line, step]));
        const seen = new Set();
        for (const step of requested) {
            singleTaskText(step.text);
            if (step.line != null && (!existing.has(step.line) || seen.has(step.line))) throw Error("A Step changed. Reopen this task.");
            seen.add(step.line);
        }
        const removed = snapshot.steps.filter(step => !seen.has(step.line));
        const updates = new Map(requested.filter(step => step.line != null).map(step => [step.line, step]));
        replacement = block.flatMap((value, offset) => {
            const originalLine = snapshot.line + offset;
            if (!offset) {
                const prefix = value.match(/^([ \t]*(?:[-*+]|\d+[.)])\s+\[[^\]]\][ \t]*)/)[1];
                // Put our comment before an existing native block ID.
                const nativeId = text.match(/\s+\^[a-zA-Z0-9-]+$/)?.[0] ?? "";
                const title = nativeId ? text.slice(0, -nativeId.length) : text;
                return [prefix + title + (id ? ` <!-- hub-task:${id} -->` : "") + nativeId];
            }
            if (removed.some(step => originalLine >= step.line && originalLine < step.end)) return [];
            const update = updates.get(originalLine);
            if (!update) return [value];
            const before = existing.get(originalLine);
            if (update.completed === before.completed && update.text === before.text) return [value];
            const marker = update.completed === before.completed ? before.status : update.completed ? "x" : " ";
            const stepId = taskIdentity(value);
            const stepText = singleTaskText(update.text);
            const nativeId = stepText.match(/\s+\^[a-zA-Z0-9-]+$/)?.[0] ?? "";
            const title = nativeId ? stepText.slice(0, -nativeId.length) : stepText;
            return [value.replace(/^(\s*(?:[-*+]|\d+[.)])\s+)\[[^\]]\].*$/, `$1[${marker}] `) + title +
                (stepId ? ` <!-- hub-task:${stepId} -->` : "") + nativeId];
        });
        const whitespace = block[0].match(/^[ \t]*/)[0] + "    ";
        replacement.push(...requested.filter(step => step.line == null).map(step =>
            `${whitespace}- [${step.completed ? "x" : " "}] ${singleTaskText(step.text)}`));
    }
    lines.splice(current.line, current.end - current.line, ...replacement);
    const content = lines.join(eol);
    const saved = deleting ? null : readTaskSnapshot(content, { path: snapshot.path, line: current.line, text: values.text, hubTaskId: id });
    return { content, edit: { operation: deleting ? "delete" : "edit", path: snapshot.path,
        line: current.line, requestLine: snapshot.line, oldText: snapshot.text, hubTaskId: snapshot.hubTaskId,
        tasks: saved ? [{ ...saved, ...taskMetadata(values), lineCount: saved.end - saved.line }] : [],
        lineDelta: replacement.length - (current.end - current.line), removedLines: current.end - current.line,
        changed: content !== data, wasCompleted: current.completed, completed: !!saved?.completed,
        preserveContinuation: false } };
}

function appendTask(data, text) {
    let fence = null, frontmatter = /^---\s*\r?\n/.test(data);
    for (const [index, line] of data.split(/\r?\n/).entries()) {
        if (frontmatter) { if (index && /^(---|\.\.\.)\s*$/.test(line)) frontmatter = false; continue; }
        const match = line.match(/^\s*(`{3,}|~{3,})(.*)$/);
        if (!match) continue;
        if (!fence) fence = match[1];
        else if (match[1][0] === fence[0] && match[1].length >= fence.length && !match[2].trim()) fence = null;
    }
    if (fence || frontmatter) throw Error("Close the open code fence or Properties block in this note before adding a task.");
    const eol = data.includes("\r\n") ? "\r\n" : "\n";
    return data + (data.endsWith("\n") || !data ? "" : eol) + `${eol}- [ ] ${singleTaskText(text)}${eol}`;
}

function insertTaskAtCursor(editor) {
    const cursor = editor.getCursor();
    const line = editor.getLine(cursor.line);
    if (taskLineDetails(line)) { editor.setCursor({ line: cursor.line, ch: line.length }); return; }
    const prefix = line.match(/^[ \t]*(?:(?:[-*+]|\d+[.)])\s+)?/)[0];
    const indentation = line.match(/^[ \t]*/)[0];
    const marker = /(?:[-*+]|\d+[.)])\s+$/.test(prefix) ? prefix : indentation + "- ";
    editor.replaceRange(marker + "[ ] ", { line: cursor.line, ch: 0 }, { line: cursor.line, ch: prefix.length });
    editor.setCursor({ line: cursor.line, ch: Math.max(marker.length + 4, cursor.ch + marker.length + 4 - prefix.length) });
}

module.exports = { taskMetadata, validateTaskMetadata, taskGroups, taskBlockEnd, readTaskSnapshot, saveTaskSnapshot, appendTask, insertTaskAtCursor, toggleTaskStep };
