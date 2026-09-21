"use strict";
const assert = require("assert");
const { prepareNoteLayout, rewriteLayoutPaths } = require("../domain/navigation");
const file = (id, path) => ({ id, type: "leaf", state: { type: "markdown", state: { file: path } } });
const browser = (id, url) => ({ id, type: "leaf", state: { type: "webviewer",
    state: { url, title: id, mode: "reader", navigate: true, history: ["private"], loading: true } } });
const a = browser("web-a", "https://example.org/a?q=1#part"), b = browser("web-b", "https://example.org/b");
const layout = entries => ({ main: { id: "root", type: "split", direction: "vertical", children: [
    { id: "rail", type: "tabs", children: [file("hub", "Hub.md")] },
    { id: "notes", type: "tabs", currentTab: 1, children: entries }
] }, active: entries[1]?.id || entries[0]?.id });
const exists = path => ["Hub.md", "A.md", "B.md"].includes(path);
for (const entries of [[file("a", "A.md")], [a], [a,b],
    [file("a", "A.md"),a,file("b","B.md"),b]]) {
    const original = layout(entries), serialized = JSON.stringify(original);
    const saved = prepareNoteLayout(original, "Hub.md", exists);
    assert(saved);
    const restored = prepareNoteLayout(JSON.parse(JSON.stringify(saved)), "Hub.md", exists, () => true);
    assert.deepStrictEqual(restored, saved);
    assert.deepStrictEqual(restored.main.children[1].children.map(x=>x.id), entries.map(x=>x.id));
    assert.equal(restored.active, original.active);
    assert.equal(JSON.stringify(original), serialized, "Never mutate live or saved input");
    for (const item of restored.main.children[1].children.filter(x=>x.state.type==="webviewer"))
        assert.deepStrictEqual(Object.keys(item.state.state).sort(), ["title","url"]);
}
const mixed = layout([file("a","A.md"),a,b,file("b","B.md")]);
const noBrowser = prepareNoteLayout(mixed,"Hub.md",exists,()=>false);
assert.deepStrictEqual(noBrowser.main.children[1].children.map(x=>x.id),["a","b"]);
assert.equal(prepareNoteLayout(layout([a,b]),"Hub.md",exists,()=>false),null);
for (const url of ["", "invalid", "javascript:alert(1)", "file:///private", "data:text/html,test", null]) {
    const result=prepareNoteLayout(layout([file("a","A.md"),browser("bad",url),b]),"Hub.md",exists);
    assert.deepStrictEqual(result.main.children[1].children.map(x=>x.id),["a","web-b"]);
}
const rewritten=rewriteLayoutPaths(prepareNoteLayout(mixed,"Hub.md",exists),p=>p.replace("A.md","Moved.md"));
assert.equal(rewritten.main.children[1].children[0].state.state.file,"Moved.md");
assert.equal(rewritten.main.children[1].children[1].state.state.url,a.state.state.url);
console.log("Browser layout tests passed: files-only, browser-only, interspersed tabs, URL/title whitelist, ordering/active tabs, invalid URLs, unavailable provider, input immutability and file-only rename.");
