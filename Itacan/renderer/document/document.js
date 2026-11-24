import { el, button, report } from '../ui/elements.js';
import { askName, showDialog } from '../ui/dialog.js';
import { renderPreview, scrollToHeading } from './preview.js';

export async function documentView(library, file, { editing, anchor, openNote }) {
  const record = await window.itacan.readNote(library.session, file);
  let savedText = record.text.replace(/\r\n?/g, '\n');
  let revision = record.revision;
  let dirty = false;
  let editor;
  let savedDocument;
  let pending;
  let disposed = false;
  const parts = file.split('/');
  const root = el('section', 'document view-width');
  const header = el('header', 'view-title');
  header.append(el('p', 'context-label', parts.slice(0, -1).join(' / ')), el('h1', '', parts.at(-1).replace(/\.md$/i, '')));
  const panel = el('section', 'document-panel panel');
  const toolbar = el('div', 'document-tools');
  const modes = el('div', 'switcher');
  const readButton = button('Read', () => mode(false));
  const editButton = button('Edit', () => mode(true));
  modes.append(readButton, editButton);
  const actions = el('div', 'actions');
  const status = el('span', 'save-status');
  status.setAttribute('role', 'status');
  const saveButton = button('Save', save, { variant: 'primary' });
  const copyButton = button('Save a copy', saveCopy);
  copyButton.hidden = true;
  actions.append(status, copyButton, saveButton);
  toolbar.append(modes, actions);
  const preview = el('article', 'prose');
  const source = el('div', 'source');
  panel.append(toolbar, preview, source);
  root.append(header, panel);
  const text = () => editor ? editor.state.doc.toString() : savedText;

  function updateControls() {
    saveButton.disabled = !dirty || !!pending;
    status.textContent = pending ? 'Saving…' : dirty ? 'Unsaved changes' : 'Saved';
  }
  async function save() {
    if (pending) return pending;
    if (!dirty) return true;
    const draft = text();
    const snapshot = editor?.state.doc;
    pending = window.itacan.saveNote(library.session, file, draft, revision).then(next => {
      revision = next;
      savedText = draft;
      savedDocument = snapshot;
      dirty = text() !== savedText;
      copyButton.hidden = true;
      return true;
    }).catch(error => {
      copyButton.hidden = false;
      report(error);
      return false;
    }).finally(() => { pending = null; updateControls(); });
    updateControls();
    return pending;
  }
  async function saveCopy() {
    const name = await askName('Save a copy', parts.at(-1).replace(/\.md$/i, '') + ' copy');
    if (!name) return;
    const draft = text();
    const created = await window.itacan.create(library.session, parts.slice(0, -1).join('/'), name, 'note', draft);
    if (text() === draft) {
      dirty = false;
      await openNote(created, true);
    }
  }
  async function mode(edit) {
    if (edit && !editor) {
      const { makeEditor } = await import('./editor.js');
      if (disposed) return;
      if (!editor) {
        editor = makeEditor(source, savedText, doc => {
          dirty = !doc.eq(savedDocument);
          updateControls();
        });
        savedDocument = editor.state.doc;
      }
    }
    source.hidden = !edit;
    preview.hidden = edit;
    readButton.setAttribute('aria-pressed', String(!edit));
    editButton.setAttribute('aria-pressed', String(edit));
    if (!edit) renderPreview(preview, text(), file, library.session, openNote, report);
    else editor.focus();
  }
  updateControls();
  await mode(editing);
  return { root, save,
    mounted() {
      if (editing) editor.focus();
      if (anchor) scrollToHeading(preview, anchor);
    },
    async leave() {
      if (pending) await pending;
      if (!dirty) return true;
      const choice = await showDialog({ title: 'Save your changes?', description: parts.at(-1), actions: [
        { label: 'Cancel', value: null }, { label: 'Discard', value: 'discard' },
        { label: 'Save', value: 'save', primary: true }
      ] });
      if (choice === 'save') return await save() && !dirty;
      return choice === 'discard';
    },
    dispose() { disposed = true; editor?.destroy(); dirty = false; }
  };
}
