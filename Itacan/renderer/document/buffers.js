import { EditorState, Transaction } from '@codemirror/state';
import { history, undo, redo } from '@codemirror/commands';
import { report } from '../ui/elements.js';
import { showDialog } from '../ui/dialog.js';

export class Documents {
  constructor(session, autosave = () => true) {
    this.autosave = autosave;
    this.session = session;
    this.open = new Map();
  }
  async get(path) {
    if (!/\.md$/i.test(path)) {
      const canonical = await window.itacan.documentPath(this.session,path);
      return {path:canonical,session:this.session,kind:/\.pdf$/i.test(canonical)?'pdf':'image'};
    }
    const cached=this.open.get(path);
    if (cached && !cached.dirty && !cached.pending) {
      const revision=cached.revision;
      const record=await window.itacan.readNote(this.session,path);
      if(cached.revision===revision && !cached.dirty && !cached.pending && (cached.failed || record.revision!==revision))cached.reload(record);
    }
    if (!this.open.has(path)) {
      let record;
      try { record=await window.itacan.readNote(this.session,path); }
      catch(error) {
        const draft=await window.itacan.getDraft(this.session,path);
        if(typeof draft?.text!=='string')throw error;
        const recovered=new Buffer(this.session,path,{text:'',revision:draft.revision},draft,this.autosave);
        recovered.saved=null;
        recovered.recovered=recovered.failed=true;
        this.open.set(path,recovered);
        return recovered;
      }
      path = record.path;
      if (!this.open.has(path)) {
        const draft = await window.itacan.getDraft(this.session, path);
        if (!this.open.has(path)) this.open.set(path, new Buffer(this.session,path,record,draft,this.autosave));
      }
    }
    return this.open.get(path);
  }
  async revalidate() {
    for (const buffer of this.open.values()) {
      if (buffer.pending) continue;
      const revision = buffer.revision;
      const disk = await window.itacan.readNote(this.session,buffer.path).catch(() => null);
      if (buffer.revision !== revision || buffer.pending || disk?.revision === revision) continue;
      if (!disk || buffer.dirty) {
        buffer.failed = true;
        clearTimeout(buffer.timer);
        buffer.notify();
      } else {
        buffer.reload(disk);
      }
    }
  }
  async allowClose(buffers = [...this.open.values()]) {
    const discarded = [];
    for (const buffer of buffers) {
      if (buffer.pending) await buffer.pending.catch(() => { });
      if (!buffer.dirty) continue;
      clearTimeout(buffer.timer);
      const choice = await showDialog({
        title: 'Save your changes?', description: buffer.path, actions: [
          { label: 'Cancel', value: null }, { label: 'Discard', value: 'discard' },
          { label: 'Save', value: 'save', primary: true, run: () => buffer.save() }
        ]
      });
      if (!choice) { for (const item of [...discarded,buffer]) item.scheduleSave(); return false; }
      if (choice === 'discard') discarded.push(buffer);
    }
    for (const buffer of discarded) {
      await buffer.clearDraft();
      buffer.reset(buffer.saved ?? '');
      buffer.failed = false;
      buffer.notify();
    }
    return true;
  }
  relocate(from, to) {
    for (const [path, buffer] of [...this.open]) {
      if (path !== from && !path.startsWith(from + '/')) continue;
      this.open.delete(path);
      clearTimeout(buffer.timer);
      buffer.clearDraft().catch(report);
      if (to) {
        buffer.path = to + path.slice(from.length);
        this.open.set(buffer.path, buffer);
        if (buffer.dirty) { buffer.backup(); buffer.scheduleSave(); }
      }
    }
  }
}

class Buffer {
  constructor(session, path, record, draft, autosave) {
    this.session = session;
    this.path = path;
    this.text = this.saved = record.text.replace(/\r\n?/g, '\n');
    this.revision = record.revision;
    this.autosave = autosave;
    this.listeners = new Set();
    this.backups = Promise.resolve();
    this.reset(typeof draft?.text === 'string' ? draft.text : this.saved);
    this.recovered = this.dirty;
    this.failed = this.dirty && draft?.revision !== record.revision;
    if (this.failed) this.revision = draft.revision;
  }
  reset(text) {
    this.text = text;
    this.history = EditorState.create({doc:text,extensions:[history()]});
  }
  reload(record) {
    clearTimeout(this.timer);
    this.saved = record.text.replace(/\r\n?/g,'\n');
    this.revision = record.revision;
    this.reset(this.saved);
    this.failed = false;
    this.recovered = false;
    this.notify();
  }
  backup() {
    const path = this.path, value = this.dirty ? {text:this.text,revision:this.revision} : null;
    const sequence=this.backupSequence=(this.backupSequence || 0)+1;
    this.backups = this.backups.catch(()=>{}).then(()=>{
      if(sequence===this.backupSequence)return window.itacan.putDraft(this.session,path,value);
    });
    this.backups.catch(report);
  }
  async clearDraft() {
    const path = this.path;
    this.backups = this.backups.catch(()=>{}).then(()=>window.itacan.putDraft(this.session,path,null));
    await this.backups;
  }
  scheduleSave() {
    clearTimeout(this.timer);
    if (!this.failed && this.dirty && this.autosave()) this.timer = setTimeout(()=>this.save().catch(report),1000);
  }
  apply(transaction, source) {
    if (!transaction.docChanged) return;
    // History lives with the document. The other pane maps its own selection through these changes.
    const start = this.history.update({selection:transaction.startState.selection}).state;
    const next = start.update({changes:transaction.changes,selection:transaction.newSelection,
      annotations:Transaction.userEvent.of(transaction.annotation(Transaction.userEvent) || 'input')});
    this.commit(next,source);
  }
  commit(transaction,source) {
    this.history = transaction.state;
    this.text = transaction.newDoc.toString();
    this.notify(source,transaction.changes);
    this.backup();
    this.scheduleSave();
  }
  undo(view, backwards) {
    return (backwards ? undo : redo)({state:this.history,dispatch:transaction=>{
      this.commit(transaction);
      view.dispatch({selection:transaction.newSelection,scrollIntoView:true});
    }});
  }
  get dirty() { return this.text !== this.saved; }
  notify(source,changes) { for (const listener of this.listeners) listener(source,changes); }
  edit(text, source) {
    if (text === this.text) return;
    this.commit(this.history.update({changes:{from:0,to:this.history.doc.length,insert:text}}),source);
  }
  acceptAppend(record, draft) {
    this.revision = record.revision;
    this.saved = record.text;
    this.edit(this.text === draft ? record.text : this.text + record.text.slice(draft.length));
    this.failed = false;
    this.notify();
  }
  async save() {
    while (this.pending) await this.pending;
    if (!this.dirty) { await this.clearDraft(); return; }
    const draft = this.text;
    this.pending = (async()=>{
      try {
        this.revision = await window.itacan.saveNote(this.session,this.path,draft,this.revision);
        this.saved = draft;
        this.failed = false;
        this.recovered = false;
        if (this.text === draft) await this.clearDraft().catch(report);
        else this.backup();
      } catch(error) { this.failed=true;throw error; }
      finally {this.pending=null;this.notify();}
    })();
    this.notify();
    await this.pending;
  }
}
