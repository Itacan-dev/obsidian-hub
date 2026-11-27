import { el, button, report } from '../ui/elements.js';
import { confirmAction } from '../ui/forms.js';
import { askName } from '../ui/dialog.js';
import { renderPreview, scrollToHeading } from './preview.js';
import { makeEditor, applyChanges, setPresentation } from './editor.js';

export function documentView(buffer, pane, { openNote, anchor, position, changedMode, pickCopyFolder }) {
  const root = el('section', 'document-pane panel');
  const heading = el('h1', 'note-name', buffer.path.split('/').at(-1).replace(/\.md$/i, ''));
  const name = heading.textContent;
  heading.setAttribute('aria-label',name);
  heading.textContent = buffer.path.replace(/\.md$/i,'').split('/').join(' / ');
  heading.title = heading.textContent;
  const inlineTitle = el('div','reading-title',name);
  inlineTitle.setAttribute('aria-hidden','true');
  const toolbar = el('div', 'document-tools');
  const modes = el('div', 'switcher');
  const actions = el('div', 'actions');
  const preview = el('article', 'prose');
  const source = el('div', 'source');
  let editor;
  let disposed = false;
  const read = button('Read', () => mode(false));
  const edit = button('Edit', () => mode(true));
  const live = button('Live Preview',()=>mode('live'));
  modes.append(read,live,edit);
  const save = button('Save', () => buffer.save(), { variant: 'primary' });
  const status = el('span', 'save-status');
  const copy = button('Save a copy', async () => {
    const parts = buffer.path.split('/');
    const name = await askName('Save a copy', parts.pop().replace(/\.md$/i, '') + ' copy');
    if (!name) return;
    const draft = buffer.text;
    let parent=parts.join('/');
    if(buffer.failed) {
      const available=await window.itacan.entries(buffer.session,parent).then(()=>true,()=>false);
      if(!available) {
        parent=await pickCopyFolder();
        if(!parent)return;
      }
    }
    const path = await window.itacan.create(buffer.session,parent,name,'note',draft);
    if (buffer.text === draft) {
      const disk = await window.itacan.readNote(buffer.session, buffer.path).catch(() => null);
      if (disk) buffer.reload(disk);
      else {buffer.saved=draft;buffer.failed=false;buffer.recovered=false;buffer.notify();}
      await buffer.clearDraft();
    }
    await openNote(path, true);
  });
  const reload=button('Reload from disk',async()=>{
    if(buffer.dirty && !await confirmAction('Reload from disk?', 'This replaces the open draft with the saved file.', 'Reload'))return;
    const draft=buffer.text;
    const record=await window.itacan.readNote(buffer.session,buffer.path);
    if (draft!==buffer.text) throw Error('The draft changed. Review it before reloading.');
    buffer.reload(record);
    await buffer.clearDraft();
  },{variant:'quiet'});
  actions.append(status,copy,reload,save);
  toolbar.append(heading, modes, actions);
  root.append(toolbar, preview, source);
  let displayed;
  function update(origin,changes) {
    if (disposed) return;
    if (editor && origin !== editor) {
      if(changes)applyChanges(editor,changes);
      else if(editor.state.doc.toString()!==buffer.text)applyChanges(editor,{from:0,to:editor.state.doc.length,insert:buffer.text});
    }
    if (!pane.edit && displayed !== buffer.text) {
      renderPreview(preview, buffer.text, buffer.path, buffer.session, openNote, report);
      preview.prepend(inlineTitle);
      displayed = buffer.text;
    }
    save.disabled = !buffer.dirty;
    status.textContent = buffer.failed ? 'Disk conflict or save failure' : buffer.recovered ? 'Recovered draft' : buffer.pending ? 'Saving…' : buffer.dirty ? 'Unsaved changes' : 'Saved';
    copy.hidden = !buffer.failed;
    reload.hidden = !buffer.failed;
  }
  function rememberPosition() {
    if (!root.isConnected) return;
    if (!preview.hidden) position.read = preview.scrollTop;
    else if (editor) {
      position.edit = editor.scrollSnapshot();
      position.editTop = editor.scrollDOM.scrollTop;
      const {anchor,head} = editor.state.selection.main;
      position.selection = {anchor,head};
    }
  }
  function restorePosition() {
    if (!pane.edit) preview.scrollTop = position.read;
    else if (position.edit) editor.dispatch({effects:position.edit});
    else if (position.editTop) editor.requestMeasure({read:()=>position.editTop,write:top=>{editor.scrollDOM.scrollTop=top;}});
  }
  let editorIsLive;
  function mode(editing, persist = true) {
    const switching = !!editing !== preview.hidden;
    if (switching) rememberPosition();
    const changed = pane.edit !== editing;
    pane.edit = editing;
    read.setAttribute('aria-pressed', String(!editing));
    edit.setAttribute('aria-pressed', String(editing===true));
    live.setAttribute('aria-pressed',String(editing==='live'));
    source.hidden = !editing;
    preview.hidden = editing;
    if (editing) {
      if (!editor) editor=makeEditor(source,buffer,position.selection,editing==='live');
      else if ((editing==='live')!==editorIsLive) setPresentation(editor,buffer,editing==='live');
      editorIsLive=editing==='live';
    }
    update();
    if (editing && persist) editor.focus();
    if (switching && root.isConnected) restorePosition();
    if (persist && changed) changedMode();
  }
  function reveal(fragment) {
    if (typeof fragment==='object' && fragment?.line) {
      mode(true,false);
      const line=editor.state.doc.line(Math.min(editor.state.doc.lines,Math.max(1,fragment.line)));
      editor.dispatch({selection:{anchor:line.from,head:line.to},scrollIntoView:true});
    } else if(fragment)scrollToHeading(preview,fragment);
  }
  buffer.listeners.add(update);
  mode(pane.edit, false);
  return {
    root, snapshot() {
      rememberPosition();
      return {editing:preview.hidden ? (editorIsLive ? 'live' : true) : false,read:position.read,editTop:position.editTop,selection:position.selection};
    }, display(editing, fragment) {
      mode(editing, false);
      reveal(fragment);
    }, mounted(focus) {
      if (focus && pane.edit) editor?.focus();
      restorePosition();
      reveal(anchor);
    },
    dispose() { rememberPosition(); disposed = true; buffer.listeners.delete(update); editor?.destroy(); }
  };
}
