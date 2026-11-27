import { el, button, report } from '../ui/elements.js';

// This view deliberately requires only a library session, never parsed work metadata.
export function recoveryView(library,error,choose) {
  const root = el('section','library-recovery view-width');
  const nav = el('div');
  const panel = el('section','recovery-panel panel');
  const rows = el('div','recovery-files');
  const article = el('pre','prose');
  const location = el('div','actions');
  let generation = 0;
  async function open(folder) {
    const token = ++generation;
    const entries = folder ? await window.itacan.entries(library.session,folder) :
      [...library.projects,...library.resources,...(library.extraResources || [])];
    if (token !== generation) return;
    article.textContent = '';
    location.replaceChildren(button('Workspaces',()=>open()),el('strong','',folder || ''));
    if (folder?.split('/').length>2) location.append(button('Parent folder',()=>open(folder.slice(0,folder.lastIndexOf('/')))));
    rows.replaceChildren(...entries.map(entry=>button(entry.name,async()=>{
      if (entry.kind === 'folder') return open(entry.path);
      if (entry.kind === 'note') {
        const note = await window.itacan.readNote(library.session,entry.path);
        if (token === generation) article.textContent = note.text;
      } else await window.itacan.revealItem(library.session,entry.path);
    })));
  }
  const intro = el('header','recovery-intro');
  intro.append(el('h1','','Library recovery'),el('p','recovery-error',error.message),
    el('p','','You can read files here while the library needs recovery. Keep a copy of the entire library before restoring its work file from backup.'),
    button('Reopen or choose another library',choose));
  panel.append(intro,location,rows,article);
  root.append(nav,panel);
  open().catch(report);
  return {root,navigationHost:nav};
}
