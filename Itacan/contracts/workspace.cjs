function includesPath(root, path) {
  return !!root && typeof path === 'string' && (path === root || path.startsWith(root + '/'));
}
function workspaceIncludes(state, owner, path) {
  return includesPath(owner,path) || (state?.sharedFolders?.[owner] || []).some(folder => includesPath(folder,path));
}
function physicalWorkspace(path) {
  return path?.split('/').slice(0,2).join('/');
}
function workspaceContext(state, path, candidate) {
  return workspaceIncludes(state,candidate,path) ? candidate : physicalWorkspace(path);
}
function taskInWorkspace(state, owner, task) {
  if (task.owner === owner) return true;
  // A Resource task follows its attached folder. A Project's own task stays in that Project.
  return task.owner?.startsWith('Resources/') && task.owner === physicalWorkspace(task.location) &&
    workspaceIncludes(state,owner,task.location);
}
module.exports = {includesPath,workspaceIncludes,workspaceContext,taskInWorkspace};
