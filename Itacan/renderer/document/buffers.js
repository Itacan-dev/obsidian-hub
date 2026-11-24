import { showDialog } from '../ui/dialog.js';

export class Documents {
  constructor(session) {
    this.session = session;
    this.open = new Map();
  }
  async get(path) {
    if (!this.open.has(path)) {
      const record = await window.itacan.readNote(this.session, path);
      if (!this.open.has(path)) this.open.set(path, new Buffer(this.session, path, record));
    }
    return this.open.get(path);
  }
  async allowClose(buffers = [...this.open.values()]) {
    for (const buffer of buffers) {
      if (buffer.pending) await buffer.pending.catch(() => { });
      if (!buffer.dirty) continue;
      const choice = await showDialog({
        title: 'Save your changes?', description: buffer.path, actions: [
          { label: 'Cancel', value: null }, { label: 'Discard', value: 'discard' },
          { label: 'Save', value: 'save', primary: true, run: () => buffer.save() }
        ]
      });
      if (!choice) return false;
    }
    return true;
  }
  relocate(from, to) {
    for (const [path, buffer] of [...this.open]) {
      if (path !== from && !path.startsWith(from + '/')) continue;
      this.open.delete(path);
      if (to) {
        buffer.path = to + path.slice(from.length);
        this.open.set(buffer.path, buffer);
      }
    }
  }
}

class Buffer {
  constructor(session, path, record) {
    this.session = session;
    this.path = path;
    this.text = this.saved = record.text.replace(/\r\n?/g, '\n');
    this.revision = record.revision;
    this.listeners = new Set();
  }
  get dirty() { return this.text !== this.saved; }
  notify(source) { for (const listener of this.listeners) listener(source); }
  edit(text, source) {
    if (text === this.text) return;
    this.text = text;
    this.notify(source);
  }
  acceptAppend(record, draft) {
    this.revision = record.revision;
    this.saved = record.text;
    this.text = this.text === draft ? record.text : this.text + record.text.slice(draft.length);
    this.failed = false;
    this.notify();
  }
  async save() {
    while (this.pending) await this.pending;
    if (!this.dirty) return;
    const draft = this.text;
    this.pending = window.itacan.saveNote(this.session, this.path, draft, this.revision);
    try {
      this.revision = await this.pending;
      this.saved = draft;
      this.failed = false;
    } catch (error) {
      this.failed = true;
      throw error;
    } finally {
      this.pending = null;
      this.notify();
    }
  }
}
