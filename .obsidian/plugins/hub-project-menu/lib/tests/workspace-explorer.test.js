"use strict";
const assert = require("assert");
const { workspaceTree, filterWorkspaceTree, displayedPlanNodes, sortExplorerChildren, rewriteExplorerPaths } = require("../domain/workspace-explorer");
const objects = new Map();
function folder(path) { const item = { path, name: path.split("/").pop(), children: [] }; objects.set(path, item); return item; }
function file(path, mtime = 10, ctime = 5) {
    const name = path.split("/").pop(), item = { path, name, basename: name.replace(/\.[^.]+$/, ""), extension: name.split(".").pop(), stat: { mtime, ctime } };
    objects.set(path, item); return item;
}
const resource = folder("Resources/Knowledge/Mathematics"), course = folder(resource.path + "/Topology");
const notes = file(course.path + "/Definitions.md"), pdf = file(course.path + "/Course literature.pdf", 20, 1);
const empty = folder(course.path + "/Assignments");
resource.children.push(course); course.children.push(notes, empty, pdf);
const local = folder("Projects/Itacan/Meta"), project = folder("Projects/Itacan");
const hub = file(project.path + "/Itacan.md"), rootNote = file(project.path + "/Inbox.md");
project.children.push(local, hub, rootNote);
const shared = { path: resource.path, title: "Mathematics", sharedResource: true, resourceLabel: "Knowledge", resourceFolderId: "math" };
const tree = workspaceTree([{ path: project.path, title: "Project Root", isRoot: true }, { path: local.path, title: "Meta" }, shared], p => objects.get(p), hub.path);
assert.deepEqual(tree.roots[0].children.map(n => n.path), [rootNote.path], "Root notes exclude the dashboard and do not duplicate root folders");
assert.equal(tree.byPath.get(resource.path).item, resource, "Shared folder keeps the Resource vault object");
assert.equal(tree.byPath.get(notes.path).item, notes, "Shared file is not copied");
assert.equal(tree.byPath.get(notes.path).descriptor, shared, "Descendants retain shared-root ownership");
assert.equal(tree.byPath.get(empty.path).children.length, 0, "Empty folders are leaves for disclosure");
assert.equal(tree.byPath.get(notes.path).folder, false);
assert.equal(tree.byPath.get(pdf.path).name, "Course literature.pdf");
assert.equal(tree.byPath.get(notes.path).name, "Definitions");
const filtered = filterWorkspaceTree(tree.roots, "definitions");
assert.deepEqual([...filtered.visible].sort(), [resource.path, course.path, notes.path].sort(), "Search retains exactly the matching file and its ancestors");
assert.equal(filtered.matches.size, 1);
assert(filterWorkspaceTree(tree.roots, "TOPOLOGY").visible.has(pdf.path), "Matching folders expose their contents");
assert.equal(filterWorkspaceTree(tree.roots, "absent").visible.size, 0);
assert.equal(filterWorkspaceTree(tree.roots, "").visible.size, tree.byPath.size);
const children = tree.byPath.get(course.path).children;
assert.deepEqual(sortExplorerChildren(children).map(n => n.path), [empty.path, pdf.path, notes.path], "Date sort retains folders first and modified descending");
assert.deepEqual(sortExplorerChildren(children, { sortKey: "created", sortDirection: "asc" }).map(n => n.path), [empty.path, pdf.path, notes.path]);
const state = { [project.path]: { currentPath: course.path, search: "definitions" },
    [resource.path]: { collapsed: false }, [course.path]: { collapsed: true, sortKey: "name", manualHeight: 200 },
    [resource.path + "Other"]: { collapsed: true } };
rewriteExplorerPaths(state, resource.path, "Resources/Knowledge/Math");
assert.equal(state[project.path].currentPath, "Resources/Knowledge/Math/Topology");
assert.equal(state["Resources/Knowledge/Math/Topology"].collapsed, true);
assert.equal(state["Resources/Knowledge/Math/Topology"].manualHeight, 200, "Legacy fields survive without a schema migration");
assert(state[resource.path + "Other"], "Renames do not affect similarly prefixed siblings");
assert.equal(objects.get(notes.path), notes, "All model, filtering, sorting, and state work is read-only on vault data");
assert.deepEqual(workspaceTree([], () => null).roots, []);
const full = workspaceTree([{ path: local.path, title: "Meta" }, shared], p => objects.get(p), hub.path,
    { workspacePath: project.path, fullView: true });
assert.equal(full.roots[0].path, project.path, "Full view always starts at the physical workspace root");
assert.deepEqual(full.roots[0].children.map(node => node.path), [local.path, rootNote.path], "Full root includes immediate folders and legacy files, excluding dashboard");
assert.equal(full.byPath.get(local.path).parent.path, project.path, "Local folders retain their physical hierarchy");
assert.equal(full.roots[1].item, resource, "Linked Resource root remains canonical and separate");
const [projectRoot, sharedRoot] = full.roots, meta = full.byPath.get(local.path), topology = full.byPath.get(course.path);
const markers = (nodes, locations, options) => [...displayedPlanNodes(nodes, locations, options)].map(node => node.path);
assert.deepEqual(markers([projectRoot, sharedRoot], [notes.path]), [resource.path], "Collapsed attachment represents its hidden planned note");
assert.deepEqual(markers([projectRoot, sharedRoot, topology], [notes.path]), [course.path], "Expanding a root passes the cue to the deepest displayed folder");
assert.deepEqual(markers([projectRoot, sharedRoot, topology], [notes.path, resource.path, rootNote.path]),
    [course.path, resource.path, project.path], "Folder-local work and invisible root files still have cues");
assert.deepEqual(markers([projectRoot, meta, sharedRoot, topology], [notes.path, empty.path, local.path]), [course.path, local.path],
    "Multiple routes use each displayed branch once");
assert.deepEqual(markers([tree.roots[0]], [local.path, local.path + "/Hidden.md"], { rootFilesOnly: true }), [],
    "The synthetic root-file group does not claim routes from a hidden sibling root");
assert.deepEqual(markers([tree.roots[0]], [rootNote.path], { rootFilesOnly: true }), [project.path]);
assert.deepEqual(markers([tree.roots[2], tree.byPath.get(course.path), tree.byPath.get(notes.path)], [notes.path]), [notes.path],
    "The note itself represents a route once the note is displayed");
const overlapping = workspaceTree([shared, { ...shared, path: course.path }], path => objects.get(path), hub.path);
const nestedOccurrence = overlapping.roots[0].children[0];
assert.deepEqual([...displayedPlanNodes([overlapping.roots[0], nestedOccurrence, overlapping.roots[1]], [notes.path])],
    [nestedOccurrence, overlapping.roots[1]], "Overlapping shared roots each display their own route");
console.log("Workspace explorer model checks passed.");

const { availableDefaultItemPath } = require('../domain/files');
const occupied = new Set(['P/New note.md', 'P/New note (2).md', 'P/New folder', 'P/New folder (2)']);
assert.equal(availableDefaultItemPath('P', 'note', p=>occupied.has(p)), 'P/New note (3).md');
assert.equal(availableDefaultItemPath('P', 'folder', p=>occupied.has(p)), 'P/New folder (3)');
assert.equal(availableDefaultItemPath('Empty', 'note', ()=>false), 'Empty/New note.md');

assert.equal(availableDefaultItemPath('P','note',p=>p==='P'?{children:[{name:'new NOTE.md'}]}:null),'P/New note (2).md');
