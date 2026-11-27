export function workspaceName(library, path) {
  const resource = library.resources.find(entry => entry.path === path);
  return resource?.name || path.split('/').at(-1);
}
