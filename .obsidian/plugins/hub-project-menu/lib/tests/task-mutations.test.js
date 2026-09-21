"use strict";
const assert = require("assert");
const { mutateTaskContent, applyTaskEdit } = require("../domain/tasks");
const path = "Projects/A/Tasks.md";
const data = "# Tasks\r\n- [ ] Top\r\n- [ ] Middle\r\n- [ ] Bottom\r\n";
const items = ["Top", "Middle", "Bottom"].map((text, i) => ({ path, line: i + 1, text, completed: false }));
for (const task of items) {
    for (const position of ["above", "below"]) {
        const added = mutateTaskContent(data, { ...task, operation: "add", position, value: "" });
        const at = task.line + (position === "below" ? 1 : 0);
        assert.equal(added.content.split("\r\n")[at], "- [ ] ");
        const cache = applyTaskEdit(items, added.edit);
        assert.equal(cache.find(item => item.text === "").line, at);
        assert.equal(cache.find(item => item.text === task.text).line, task.line + (position === "above" ? 1 : 0));
        const saved = mutateTaskContent(added.content, { ...added.edit.tasks[0], operation: "edit", value: "Saved" });
        assert.equal(saved.content.split("\r\n")[at], "- [ ] Saved");
    }
    const add = mutateTaskContent(data, { ...task, operation: "add", value: "**New** $x^2$" });
    assert.equal(add.content.split("\r\n")[task.line + 1], "- [ ] **New** $x^2$");
    const cache = applyTaskEdit(items, add.edit);
    assert.equal(cache.length, 4);
    assert.equal(cache.find(item => item.text.startsWith("**New**")).line, task.line + 1);
    const edit = mutateTaskContent(data, { ...task, operation: "edit", value: "[Link](../Other.md) $\\omega$" });
    assert.equal(edit.content.split("\r\n")[task.line], "- [ ] [Link](../Other.md) $\\omega$");
    assert.equal(applyTaskEdit(items, edit.edit)[task.line - 1].text, "[Link](../Other.md) $\\omega$");
    const deleted = mutateTaskContent(data, { ...task, operation: "delete" });
    assert.ok(!deleted.content.includes(task.text));
    assert.equal(applyTaskEdit(items, deleted.edit).length, 2);
    assert.equal(deleted.edit.completed, false);
}
const draft = mutateTaskContent(data, { ...items[0], operation: "add", value: "" });
const saved = mutateTaskContent(draft.content, { ...draft.edit.tasks[0], operation: "edit", value: "Saved draft" });
assert.ok(saved.content.includes("- [ ] Saved draft\r\n"));
const nested = "  * [ ] Parent\n      continuation\n      - [ ] Child\n  * [ ] Next\n";
const parent = { path, line: 0, text: "Parent\ncontinuation" };
assert.equal(mutateTaskContent(nested, { ...parent, operation: "add", position: "above", value: "Sibling" }).content,
    "  * [ ] Sibling\n" + nested, "Above preserves parent, continuations, children and indentation");
assert.equal(mutateTaskContent("\t3. [x] Numbered\n", { path, line: 0, text: "Numbered", operation: "add", position: "above", value: "New" }).content,
    "\t3. [ ] New\n\t3. [x] Numbered\n", "Keep list marker and tabs; new sibling is unchecked");
const sibling = mutateTaskContent(nested, { ...parent, operation: "add", value: "Sibling" });
assert.equal(sibling.content, "  * [ ] Parent\n      continuation\n      - [ ] Child\n  * [ ] Sibling\n  * [ ] Next\n");
const edited = mutateTaskContent(nested, { ...parent, operation: "edit", value: "Edited\n$\\alpha$" });
assert.ok(edited.content.includes("  * [ ] Edited\n      $\\alpha$\n      - [ ] Child"));
assert.equal(mutateTaskContent(nested, { ...parent, operation: "delete" }).content, "  - [ ] Child\n  * [ ] Next\n", "Keep child tasks as usable siblings instead of deleting them implicitly");
assert.throws(() => mutateTaskContent(nested, { ...parent, text: "Parent\nChanged", operation: "edit", value: "No" }), /changed/);
assert.throws(() => mutateTaskContent("- [ ] Same\n- [ ] Same", { path, line: 7, text: "Same", operation: "delete" }), /uniquely/);
console.log("Task mutation tests passed: add/edit/delete at top/middle/bottom, CRLF, empty drafts, Markdown/LaTeX source preservation, continuations, child safety and stale-source checks.");
