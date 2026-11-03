"use strict";
const path = require('node:path'), fs = require('node:fs'), os = require('node:os');
const { createHash } = require('node:crypto');

function workspaceIdentity(vault, platform = process.platform) {
 const paths = platform === 'win32' ? path.win32 : path.posix;
 const resolved = paths.resolve(vault);
 return createHash('sha256').update(platform === 'win32' ? resolved.toLowerCase() : resolved).digest('hex').slice(0, 24);
}
function canonicalPath(file, paths) {
 let ancestor = file; const missing = [];
 for (;;) {
  try { return paths.join(fs.realpathSync(ancestor), ...missing); }
  catch (error) {
   if (error.code !== 'ENOENT' || paths.dirname(ancestor) === ancestor) throw error;
   missing.unshift(paths.basename(ancestor)); ancestor = paths.dirname(ancestor);
  }
 }
}
function storageLocation(vault, { platform = process.platform, env = process.env, home = os.homedir(), canonicalize = canonicalPath } = {}) {
 const paths = platform === 'win32' ? path.win32 : path.posix, workspaceId = workspaceIdentity(vault, platform);
 let root;
 if (platform === 'win32') {
  if (!env.LOCALAPPDATA) throw Object.assign(Error('LOCALAPPDATA is unavailable; local task storage cannot be located.'), { code: 'TASK_STORAGE_UNAVAILABLE' });
  // Keep the existing Windows location and identity byte-for-byte compatible.
  root = paths.join(env.LOCALAPPDATA, 'Itacan/TaskCore');
 } else if (platform === 'darwin') root = paths.join(home, 'Library', 'Application Support', 'Itacan', 'TaskCore');
 else throw Object.assign(Error('Task storage supports Windows and macOS desktop hosts.'), { code: 'TASK_PLATFORM_UNSUPPORTED' });
 const file = paths.join(root, workspaceId, 'tasks.sqlite');
 if (platform === 'darwin') {
  const actual = canonicalize(file, paths), base = canonicalize(paths.resolve(vault), paths), relative = paths.relative(base, actual);
  if (!relative || relative !== '..' && !relative.startsWith('..' + paths.sep) && !paths.isAbsolute(relative)) {
   throw Object.assign(Error('Task storage resolves inside the vault. Restore a device-local Application Support directory.'), { code: 'TASK_STORAGE_IN_VAULT' });
  }
 }
 return { workspaceId, file, pendingPrefix: 'itacan-sqlite-pending:' + workspaceId + ':' };
}
module.exports = { workspaceIdentity, storageLocation };
