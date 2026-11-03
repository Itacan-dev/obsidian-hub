"use strict";
const path = require("node:path"), { SHARED_PROJECT_ROOTS } = require("../services/shared-projects");
function projectHeader(text, name) {
    const source = text.replace(/^\uFEFF/, ""), lines = source.split(/\r?\n/);
    if (lines[0] !== "---")
        return null;
    const end = lines.findIndex((line, i) => i > 0 && /^(---|\.\.\.)\s*$/.test(line));
    if (end < 0)
        return { path: name, ambiguous: true };
    const header = lines.slice(1, end), values = {}, problems = [];
    for (const key of ["type", "projectId", "status"]) {
        const hits = header.filter(l => new RegExp("^" + key + "\\s*:").test(l));
        if (hits.length !== 1) {
            problems.push(key);
            continue;
        }
        const raw = hits[0].slice(hits[0].indexOf(":") + 1).trim();
        if (/^[A-Za-z_][A-Za-z0-9_.:-]*$/.test(raw) && !/^(true|false|null|yes|no|on|off)$/i.test(raw) || /^[0-9a-f]{8}-[0-9a-f-]{27}$/i.test(raw))
            values[key] = raw;
        else if (/^"(?:[^"\\]|\\.)*"$/.test(raw)) {
            try {
                values[key] = JSON.parse(raw);
            }
            catch (_) {
                problems.push(key);
            }
        }
        else if (/^'(?:[^']|'')*'$/.test(raw))
            values[key] = raw.slice(1, -1).replace(/''/g, "'");
        else
            problems.push(key);
    }
    if (values.type !== "project" && !header.some(l => /^type\s*:.*project/.test(l) || /^projectId\s*:/.test(l)))
        return null;
    if (header.some(l => /^<<\s*:/.test(l)) || values.type !== "project" || typeof values.projectId !== "string" || !values.projectId.trim() || !["active", "future", "shelved", "archived"].includes(values.status))
        problems.push("identity");
    if (problems.length)
        return { path: name, root: path.posix.dirname(name), ambiguous: true };
    return { projectId: values.projectId, root: path.posix.dirname(name), path: name, name: path.posix.basename(name, ".md"), contextKind: "project", status: values.status, shared: SHARED_PROJECT_ROOTS.includes(path.posix.dirname(name)) };
}
module.exports = { projectHeader };
