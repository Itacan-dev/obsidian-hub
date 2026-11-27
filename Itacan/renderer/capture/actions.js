import { taskEditor } from '../tasks/tasks.js';
import { el } from '../ui/elements.js';
import { field, pickPath } from '../ui/forms.js';

export async function fileCapturedText(ctx,kind,items,quick = false) {
  const text = items.map(item => item.text).join('\n\n');
  const ids = items.map(item => item.id).filter(Boolean);
  if (!text.trim()) throw Error('Enter capture text.');
  if (kind==='task' && items.length>1) {
    const confirm='Create '+items.length+' tasks';
    const path=await pickPath(ctx,confirm,'location',ctx.workspaces.lastWorkspace() || '',{confirm,commit:(path,owner)=>
      ctx.tasks.fileCaptures({ids,path,owner})});
    return !!path;
  }
  if (kind === 'task') {
    const [title,...body] = text.split('\n');
    return taskEditor(ctx,{title,description:body.join('\n'),quick},ids[0]);
  }
  const append = kind === 'append', bulk = items.length>1;
  const fields = el('div','capture-target');
  const suggested = value => value.split('\n').find(s=>s.trim())?.trim().replace(/[<>:"/\\|?*]/g,' ').slice(0,120) || 'Untitled';
  const stamp = new Date().toLocaleString('sv-SE').slice(0,16).replace(':','-');
  const title = !append && !bulk ? field(fields,'Name','text',quick?'Quick Add — '+stamp:suggested(text)) : null;
  if (title) {title.required=true;title.readOnly=quick;}
  const position = append ? field(fields,'Position','select','',[]) : null;
  let positions, original, selectedPath;
  async function select(path) {
    selectedPath = path;
    if (!position) return;
    position.replaceChildren(); position.parentElement.hidden=!path;
    original = null;
    if (!path) return;
    const source=ctx.documents.open.get(path) || await window.itacan.readNote(ctx.library.session,path);
    const {notePositions}=await import('./positions.js');
    if (selectedPath!==path) return;
    original={text:source.text,revision:source.revision};
    positions=notePositions(source.text);
    positions.forEach((p,i)=>position.add(new Option(p.label,i)));
  }
  const completed = new Set();
  const target = await pickPath(ctx,append?'Add to note':bulk?'Create notes':'Create note',append?'note':'folder','',{
    fields, onSelect:select, confirm:append?'Add to note':bulk?'Create notes':'Create note',
    async commit(path) {
      if (append) {
        if (!original || selectedPath!==path) throw Error('Select the note again.');
        const buffer=ctx.documents.open.get(path);
        await buffer?.pending;
        if (buffer && buffer.text!==original.text) throw Error('The note changed. Select it again.');
        const point=positions[position.value];
        const {state,saved}=await window.itacan.fileText(ctx.library.session,{
          ids,quick,text,path,draft:original.text,revision:original.revision,offset:point.offset,marker:point.marker
        });
        buffer?.acceptAppend(saved,original.text); ctx.install(state,'capture');
      } else {
        for (const item of items) {
          if (completed.has(item)) continue;
          const name=bulk?suggested(item.text):title.value.trim();
          const {state}=await window.itacan.fileText(ctx.library.session,{id:item.id,quick,text:item.text,folder:path,name});
          completed.add(item); ctx.install(state,'capture');
        }
      }
    }
  });
  return !!target;
}
export async function fileAttachments(ctx,items,staged,remove = false) {
  const parent = remove ? null : await pickPath(ctx,'File location','folder');
  if (!remove && !parent) return false;
  for (const item of items) ctx.install(await window.itacan.resolveAttachment(ctx.library.session,item.id,parent,staged),'capture');
  return true;
}
