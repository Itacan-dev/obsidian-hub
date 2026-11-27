const fs = require('node:fs/promises');
const path = require('node:path');

// The document files need no conversion. Keep the exact pre-upgrade metadata
// before making a change that an older application would not understand.
async function protectFormat(library, raw, atomicReplace) {
  if (library.formatVersion !== 1) return;
  const backup = path.join(library.root,'.itacan-recovery');
  await fs.mkdir(backup).catch(error=>{if (error.code!=='EEXIST') throw error;});
  if (!(await fs.lstat(backup)).isDirectory()) throw Error('Invalid backup directory.');
  const marker = path.join(library.root,'itacan-library.json');
  const previous = await fs.readFile(marker,'utf8');
  const old = JSON.parse(previous);
  if (old.format !== 'itacan-library' || old.version !== 1) throw Error('The library format changed. Reopen it.');
  const file = path.join(backup,'before-format-2.json');
  const snapshot = JSON.stringify({marker:previous,work:raw},null,2)+'\n';
  try {
    const handle = await fs.open(file,'wx',0o600);
    try { await handle.writeFile(snapshot); await handle.sync(); } finally { await handle.close(); }
  } catch(error) { if (error.code !== 'EEXIST') throw error; }
  if (!(await fs.lstat(file)).isFile() || await fs.readFile(file,'utf8') !== snapshot) {
    throw Error('The pre-upgrade backup differs from the current library. Preserve both copies before upgrading.');
  }
  await atomicReplace(marker, JSON.stringify({...old,version:2},null,2)+'\n',undefined,async()=>{
    if (previous !== await fs.readFile(marker,'utf8')) throw Error('Library changed during upgrade.');
  });
  library.formatVersion = 2;
}
module.exports = { protectFormat };
