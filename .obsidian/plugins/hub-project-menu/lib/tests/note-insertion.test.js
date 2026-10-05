"use strict";
const assert = require("assert/strict");
const { noteLocation, parseNotePositions, resolveNoteLocation, insertNoteText, noteLocationSummary } = require("../domain/note-insertion");

const path = "Projects/Itacan/Meta/Functionality.md";
const location = (targetType, position, target) => ({ path, targetType, position, ...(target ? { anchor: target.anchor, label: target.label } : {}) });
const insert = (text, type, position, target, content = "Captured content") => insertNoteText(text, location(type, position, target), content);

assert.equal(noteLocation({ path, targetType: "heading", position: "end" }), null, "A structural target requires its anchor");
for (const path of ["/Bad.md", "../Bad.md", "Root/../Bad.md", "C:/Bad.md", "Root/Bad.pdf", "Root\\Bad.md"])
    assert.equal(noteLocation({ path, targetType: "note", position: "end" }), null);
assert.equal(noteLocation({ path, targetType: "list", position: "end", anchor: "a".repeat(64) }), null, "Target and position must agree");

assert.equal(insert("", "note", "end"), "Captured content\n");
assert.equal(insert("Existing", "note", "end"), "Existing\n\nCaptured content\n");
assert.equal(insert("Existing\n\n", "note", "end"), "Existing\n\nCaptured content\n");
assert.equal(insert("Existing\n", "note", "start"), "Captured content\n\nExisting\n");
const yaml = "---\r\ntitle: Note\r\n---\r\n\r\n# Body\r\nExisting\r\n";
assert.equal(insert(yaml, "note", "start", null, "One\nTwo"), "---\r\ntitle: Note\r\n---\r\n\r\nOne\r\nTwo\r\n\r\n# Body\r\nExisting\r\n", "Start is after YAML and preserves CRLF");
assert.equal(insert("\ufeff---\nkey: value\n...\nBody", "note", "start"), "\ufeff---\nkey: value\n...\n\nCaptured content\n\nBody");
assert.throws(() => insert("---\nkey: value", "note", "start"), /Choose note and position again/, "Unclosed YAML cannot be guessed");

const sections = "# Main\nIntro\n\n## Quick Add ##\nExisting\n\n### Nested\nChild\n\n## Next\nUntouched\n";
const parsed = parseNotePositions(sections), quick = parsed.headings[1];
assert.deepEqual(parsed.headings.map(item => item.title), ["Main", "Quick Add", "Nested", "Next"]);
assert.equal(insert(sections, "heading", "top", quick), sections.replace("## Quick Add ##\n", "## Quick Add ##\n\nCaptured content\n\n"));
assert.equal(insert(sections, "heading", "end", quick), sections.replace("## Next", "Captured content\n\n## Next"), "End includes descendants and stops at next same-level heading");
assert.equal(noteLocationSummary(location("heading", "end", quick)), "Functionality · Quick Add · End of section");
assert.ok(resolveNoteLocation(parseNotePositions("New introduction\n\n" + sections), location("heading", "end", quick)), "Unrelated preceding edits do not invalidate a unique heading");
assert.throws(() => insert(sections.replace("Quick Add", "Removed"), "heading", "end", quick), /Choose note and position again/);
const duplicateText = "# One\n## Questions\nA\n# Two\n## Questions\nB\n";
const duplicates = parseNotePositions(duplicateText).headings.filter(item => item.title === "Questions");
assert.deepEqual(duplicates.map(item => item.label), ["One · Questions", "Two · Questions"]);
assert.notEqual(duplicates[0].anchor, duplicates[1].anchor);
const sameParent = parseNotePositions("# Same\nA\n# Same\nB\n").headings;
assert.notEqual(sameParent[0].anchor, sameParent[1].anchor);
assert.ok(!resolveNoteLocation(parseNotePositions("# Same\nB\n"), location("heading", "end", sameParent[0])), "Deleting a duplicate cannot silently retarget the remaining heading");

const markdown = "---\n# YAML heading\n---\n# Questions\n* First\n  continued\n  - nested\n* Second\n\n## Ordered\n3) One\n4) Two\n\n```md\n# Code heading\n- code list\n```\n<!--\n# Comment\n- comment\n-->\n    # Indented code\n    - code\n";
const lists = parseNotePositions(markdown);
assert.deepEqual(lists.headings.map(item => item.title), ["Questions", "Ordered"]);
assert.equal(lists.lists.length, 2, "Nested items, code, YAML and comments do not become list targets");
assert.equal(lists.lists[0].label, "Questions");
assert.equal(insert(markdown, "list", "first", lists.lists[0], "First line\nSecond line\n\nFourth line"), markdown.replace("* First", "* First line\n  Second line\n  \n  Fourth line\n* First"), "Multiline text stays one correctly indented item");
assert.equal(insert(markdown, "list", "last", lists.lists[0]), markdown.replace("* Second\n", "* Second\n* Captured content\n"));
assert.equal(insert(markdown, "list", "first", lists.lists[1]), markdown.replace("3) One", "3) Captured content\n3) One"));
assert.equal(insert(markdown, "list", "last", lists.lists[1], "One\nTwo"), markdown.replace("4) Two\n", "4) Two\n5) One\n   Two\n"));
assert.throws(() => insert(markdown.replace("* Second", "* Edited"), "list", "last", lists.lists[0]), /Choose note and position again/, "Changed list contents require reselection");
assert.equal(insert("+ Existing", "list", "last", parseNotePositions("+ Existing").lists[0]), "+ Existing\n+ Captured content\n");
assert.equal(insert("- Existing\r\n", "list", "last", parseNotePositions("- Existing\r\n").lists[0], "A\nB"), "- Existing\r\n- A\r\n  B\r\n");
const fallback = parseNotePositions("- Check gravitational phase and the rest of this very long sentence that will truncate\n").lists[0].label;
assert.ok(fallback.startsWith("“Check gravitational phase") && fallback.endsWith("…”") && fallback.length <= 66);
assert.equal(parseNotePositions("* * *\n---\n+ + +\n").lists.length, 1, "Horizontal rules never count as lists; plus remains a Markdown list");
console.log("Note insertion tests passed");
