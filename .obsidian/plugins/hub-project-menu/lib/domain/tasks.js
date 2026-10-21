"use strict";

const TASK_LINE_PATTERN =
    /^\s*(?:[-*+]|\d+[.)])\s+\[([^\]])\](?:[ \t]+(.*))?$/;

function taskLineDetails(line) {
    const normalizedLine =
        String(line ?? "").replace(/\r$/, "");

    const match =
        normalizedLine.match(TASK_LINE_PATTERN);

    return match
        ? {
            marker: match[1],
            text: match[2] ?? ""
        }
        : null;
}

function taskLineMatchesText(line, text) {
    const details = taskLineDetails(line);
    // Dataview compares the trimmed first line (task.text may include continuations).
    // Ignore formatting whitespace, never differences inside the task description.
    return details !== null && normalizedTaskText(details.text) === normalizedTaskText(text);
}

function normalizedTaskText(text) {
    return taskDisplayText(text).split(/\r?\n/)[0].trim();
}

// Only Hub's own invisible marker is removed. Markdown and native block IDs
// remain source content; no metadata is inferred from words in the description.
function taskIdentity(text) {
    return String(text ?? "").match(/<!-- hub-task:([a-zA-Z0-9-]+) -->/)?.[1] ?? null;
}

function taskDisplayText(text) {
    return String(text ?? "").replace(/[ \t]*<!-- hub-task:[a-zA-Z0-9-]+ -->/g, "");
}

function locateTaskLine(lines, line, text, id = null) {
    if (id) {
        const matches = lines.flatMap((value, i) => taskLineDetails(value) && taskIdentity(value) === id ? [i] : []);
        if (matches.length !== 1 || !taskLineMatchesText(lines[matches[0]], text)) {
            throw new Error("Task moved, changed or was copied; reopen it from the refreshed task list.");
        }
        return matches[0];
    }
    let index = line;
    if (!Number.isInteger(index) || !taskLineMatchesText(lines[index], text)) {
        const matches = lines.flatMap((value, i) => taskLineMatchesText(value, text) ? [i] : []);
        if (matches.length !== 1) throw new Error("Task moved or changed; could not identify it uniquely.");
        index = matches[0];
    }
    return index;
}

function editTaskContent(data, { path, line, text, completed, hubTaskId }, toggle) {
    const eol = data.includes("\r\n") ? "\r\n" : "\n";
    const lines = data.split(/\r?\n/);
    const index = locateTaskLine(lines, line, text, hubTaskId);
    const before = taskLineDetails(lines[index]);
    // A requested checked state is idempotent; do not invert a newer saved state.
    const updated = typeof completed === "boolean" && isCompletedTaskLine(lines[index]) === completed
        ? lines[index] : toggle(lines[index], path);
    const replacement = updated === "" ? [] : updated.split(/\r?\n/);
    lines.splice(index, 1, ...replacement);
    const tasks = replacement.flatMap((value, offset) => {
        const details = taskLineDetails(value);
        return details ? [{ line: index + offset, text: taskDisplayText(details.text).trim(), hubTaskId: taskIdentity(details.text),
            status: details.marker, completed: isCompletedTaskLine(value) }] : [];
    });
    return { content: lines.join(eol), edit: { path, line: index, requestLine: line,
        oldText: taskDisplayText(before.text), hubTaskId: taskIdentity(before.text), tasks, lineDelta: replacement.length - 1,
        wasCompleted: /^[xX]$/.test(before.marker),
        changed: lines.join(eol) !== data,
        completed: tasks.some(task => task.completed) } };
}

function mutateTaskContent(data, request) {
    const { path, line, text, operation } = request;
    if (!["add", "edit", "delete"].includes(operation)) throw new Error("Unknown task action.");
    const eol = data.includes("\r\n") ? "\r\n" : "\n";
    const lines = data.split(/\r?\n/);
    const index = locateTaskLine(lines, line, text, request.hubTaskId);
    const before = taskLineDetails(lines[index]);
    const prefix = lines[index].match(/^([ \t]*)([-*+]|\d+[.)])\s+\[[^\]]\][ \t]*/);
    const parts = String(text).split(/\r?\n/);
    // Validate continuations, never consume child tasks or unrelated note text.
    for (let i = 1; i < parts.length; i++) {
        if (taskLineDetails(lines[index + i]) || lines[index + i]?.trim() !== parts[i].trim()) {
            throw new Error("The task text changed while it was being edited.");
        }
    }
    const count = parts.length;
    const value = String(request.value ?? "").replace(/\r\n/g, "\n");
    const valueLines = value.split("\n");
    const marker = operation === "add" ? " " : before.marker;
    const replacement = operation === "delete" ? [] : [
        `${prefix[1]}${prefix[2]} [${marker}] ${valueLines[0]}${operation === "edit" && taskIdentity(before.text) ? ` <!-- hub-task:${taskIdentity(before.text)} -->` : ""}`,
        ...valueLines.slice(1).map(part => prefix[1] + "    " + part)
    ];
    let insertionLine = request.position === "above" ? index : index + count;
    if (operation === "add") {
        // Insert a sibling after any children, so they keep their original parent.
        while (request.position !== "above" && insertionLine < lines.length) {
            let next = insertionLine;
            while (next < lines.length && !lines[next].trim()) next++;
            if (next >= lines.length || lines[next].match(/^[ \t]*/)[0].replace(/\t/g, "    ").length <= prefix[1].replace(/\t/g, "    ").length) break;
            insertionLine = next + 1;
        }
        lines.splice(insertionLine, 0, ...replacement);
    } else {
        if (operation === "delete") {
            // Promote surviving children; leaving their old indentation would
            // turn them into code or attach them to a different task.
            const start = index + count;
            let end = start;
            while (end < lines.length && lines[end].trim() &&
                lines[end].match(/^[ \t]*/)[0].length > prefix[1].length) end++;
            const indents = lines.slice(start, end).filter(value => taskLineDetails(value))
                .map(value => value.match(/^[ \t]*/)[0].length);
            if (indents.length) {
                const shift = Math.min(...indents) - prefix[1].length;
                for (let i = start; i < end; i++) lines[i] = lines[i].slice(shift);
            }
        }
        lines.splice(index, count, ...replacement);
    }
    const tasks = operation === "delete" ? [] : [{
        path, line: operation === "add" ? insertionLine : index,
        hubTaskId: operation === "add" ? null : taskIdentity(before.text),
        text: value, status: marker, completed: /^[xX]$/.test(marker),
        lineCount: replacement.length,
        ...(operation === "add" ? { children: [], subtasks: [] } : {})
    }];
    return { content: lines.join(eol), edit: {
        operation, path, line: index, requestLine: line, oldText: before.text,
        tasks, insertionLine, removedLines: operation === "add" ? 0 : count,
        lineDelta: replacement.length - (operation === "add" ? 0 : count),
        wasCompleted: /^[xX]$/.test(before.marker), completed: tasks.some(task => task.completed),
        changed: lines.join(eol) !== data, preserveContinuation: false
    } };
}

// Reconcile against the current list, not the task/checkbox captured before await.
// Both Home's {task, owner} entries and Project/Resource's plain task entries use this.
function applyTaskEdit(items, edit, resolvePath = task => task.path) {
    if (edit.movedTo) {
        const remaining = applyTaskEdit(items, { ...edit, movedTo: null, tasks: [] }, resolvePath);
        if (remaining.length === items.length) return items;
        const wrapper = items.find(item => (item.task && typeof item.task === "object" ? item.task : item).path === edit.path);
        return [...remaining, ...edit.tasks.map(task => wrapper?.task && typeof wrapper.task === "object" ?
            { ...wrapper, task, ...(edit.destinationContext ? { owner: edit.destinationContext } : {}) } : task)];
    }
    const taskOf = item => item.task && typeof item.task === "object" ? item.task : item;
    const candidates = items.filter(item => {
        const task = taskOf(item);
        return resolvePath(task, item) === edit.path &&
            (!edit.hubTaskId || task.hubTaskId === edit.hubTaskId) &&
            normalizedTaskText(task.text) === normalizedTaskText(edit.oldText);
    });
    const target = candidates.find(item => taskOf(item).line === edit.requestLine) ??
        candidates.find(item => taskOf(item).line === edit.line) ??
        (candidates.length === 1 ? candidates[0] : null);
    if (!target) return items; // A newer index/render already replaced this task.
    if (edit.operation === "add") {
        const shifted = items.map(item => {
            const task = taskOf(item);
            if (resolvePath(task, item) !== edit.path || task.line < edit.insertionLine) return item;
            const next = { ...task, line: task.line + edit.lineDelta };
            return task === item ? next : { ...item, task: next };
        });
        let at = items.findIndex(item => resolvePath(taskOf(item), item) === edit.path && taskOf(item).line >= edit.insertionLine);
        if (at < 0) at = items.reduce((last, item, i) => resolvePath(taskOf(item), item) === edit.path ? i + 1 : last, 0);
        shifted.splice(at, 0, ...edit.tasks.map(task => taskOf(target) === target ? task : { ...target, task }));
        return shifted;
    }
    const previousLine = taskOf(target).line;
    return items.flatMap(item => {
        const task = taskOf(item);
        const wrap = next => task === item ? next : { ...item, task: next };
        if (item === target) {
            const continuation = edit.preserveContinuation === false ? [] : String(task.text).split("\n").slice(1);
            return edit.tasks.map((saved, i) => wrap({ ...task, ...saved, path: edit.path,
                checked: saved.status !== " ",
                text: [saved.text, ...(i === edit.tasks.length - 1 ? continuation : [])].join("\n") }));
        }
        return resolvePath(task, item) === edit.path && task.line > previousLine
            ? [wrap({ ...task, line: task.line + edit.lineDelta })] : [item];
    });
}

function completedTaskText(line) {
    const details = taskLineDetails(line);

    return details && /^[xX]$/.test(details.marker)
        ? details.text
        : null;
}

function isCompletedTaskLine(line) {
    return completedTaskText(line) !== null;
}

module.exports = {
    locateTaskLine,
    taskIdentity,
    taskDisplayText,
    applyTaskEdit,
    editTaskContent,
    mutateTaskContent,
    completedTaskText,
    isCompletedTaskLine,
    taskLineDetails,
    taskLineMatchesText,
    normalizedTaskText
};
