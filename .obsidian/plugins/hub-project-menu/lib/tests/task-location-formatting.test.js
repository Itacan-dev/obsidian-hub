"use strict";
const test = require('node:test'), assert = require('node:assert/strict');
const { compactPathSegments, locationBreadcrumb } = require('../domain/native-task-location');
for (const [parts, expected, omitted] of [
    [['A'], ['A'], []],
    [['A','B'], ['A','B'], []],
    [['A','B','C'], ['A','B','C'], []],
    [['A','B','C','D'], ['A',null,'C','D'], ['B']],
    [['A','B','C','D','E'], ['A',null,'D','E'], ['B','C']],
    [['A','B','C','D','E','F'], ['A',null,'E','F'], ['B','C','D']]
]) test(parts.length + ' actual segments preserve first and final two', () => {
    const original = [...parts];
    assert.deepEqual(compactPathSegments(parts), {visible:expected, omitted});
    assert.deepEqual(parts, original);
});
const owner = {type:'resource',id:'knowledge'};
const task = {nativeReference:{owner},nativeLocationDisplay:{workspaceName:'Knowledge',segments:['Mathematics','MM5022 HT26, Complex Analysis','Encyclopedia of definitions & theorems.md']}};
test('Home and owning workspace share rules after context prefix selection', () => {
    const original = JSON.stringify(task), full = 'Knowledge / Mathematics / MM5022 HT26, Complex Analysis / Encyclopedia of definitions & theorems.md';
    assert.equal(locationBreadcrumb(task).label, 'Knowledge / \u2026 / MM5022 HT26, Complex Analysis / Encyclopedia of definitions & theorems.md');
    assert.equal(locationBreadcrumb(task,owner).label,'Mathematics / MM5022 HT26, Complex Analysis / Encyclopedia of definitions & theorems.md');
    assert.equal(locationBreadcrumb(task,{type:'project',id:'other'}).label,locationBreadcrumb(task).label);
    assert.equal(locationBreadcrumb(task).full,full);
    assert.equal(JSON.stringify(task),original);
});
test('roots and unavailable locations retain context and complete display', () => {
    const root = {...task,nativeLocationDisplay:{workspaceName:'Knowledge',segments:[]}};
    assert.equal(locationBreadcrumb(root).label,'Knowledge');
    assert.equal(locationBreadcrumb(root,owner).label,'Workspace root');
    const missing = {...task,nativeLocationDisplay:{workspaceName:'Knowledge',available:false}};
    assert.equal(locationBreadcrumb(missing).label,'Knowledge / Location unavailable');
    assert.equal(locationBreadcrumb(missing,owner).available,false);
});
