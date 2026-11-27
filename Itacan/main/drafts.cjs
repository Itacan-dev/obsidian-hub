const fs = require('node:fs/promises');
const path = require('node:path');
const { createHash } = require('node:crypto');
const { atomicReplace, validName } = require('./library.cjs');
const { regularText } = require('./recovery.cjs');

class DeviceDrafts {
  constructor(profile) {
    this.directory = path.join(profile,'recovery-drafts');
    this.queue = Promise.resolve();
  }
  file(library,relative) {
    const parts = relative.split('/');
    if (parts.length < 3 || !['Projects','Resources'].includes(parts[0]) || !/\.md$/i.test(relative)) throw Error('Invalid draft path.');
    parts.forEach(validName);
    const key = createHash('sha256').update(library.root+'\0'+relative).digest('hex');
    return path.join(this.directory,key+'.json');
  }
  async get(library,relative) {
    await this.queue;
    const raw = await regularText(this.file(library,relative));
    if (!raw) return null;
    const draft = JSON.parse(raw);
    if (draft.path !== relative || typeof draft.text !== 'string' || typeof draft.revision !== 'string') throw Error('Invalid recovery draft.');
    return draft;
  }
  put(library,relative,draft) {
    const file = this.file(library,relative);
    const write = async () => {
      if (draft === null) return fs.rm(file,{force:true});
      if (typeof draft?.text !== 'string' || typeof draft.revision !== 'string') throw Error('Invalid recovery draft.');
      await fs.mkdir(this.directory,{recursive:true});
      await atomicReplace(file,JSON.stringify({path:relative,root:library.root,text:draft.text,revision:draft.revision}),0o600);
    };
    const result = this.queue.then(write);
    this.queue = result.catch(()=>{});
    return result;
  }
}
module.exports = { DeviceDrafts };
