import { el, button, report } from '../ui/elements.js';
import { showDialog } from '../ui/dialog.js';
import { fileCapturedText, fileAttachments } from './actions.js';
export { inbox } from './inbox.js';

export function quickAdd(ctx) {
  const body = el('div','capture-form');
  const editor = el('div','capture-editor');
  const input = el('textarea','text-input'); input.setAttribute('aria-label','Capture text');
  input.value=ctx.capture.text(); editor.append(input);
  input.placeholder = 'Start typing…';
  const actions = el('div','actions capture-destinations');
  const files = el('div','capture-files');
  const feedback = el('small','muted'); feedback.setAttribute('role','status');
  let busy = false;
  const records = () => ctx.capture.files();
  let saveTimer;
  async function checkpoint() {
    clearTimeout(saveTimer);
    if (ctx.capture.text()!==input.value) await ctx.capture.saveDraft({text:input.value});
  }
  async function run(operation) {
    if (busy) return;
    busy = true; body.inert = true;
    try { await checkpoint(); await operation(); }
    finally { busy = false; body.inert = false; sync(); if (!records().length) input.focus(); }
  }
  const choose = button('Choose files',() => run(async () => {
    const next = await window.itacan.captureFiles(ctx.library.session);
    if (next) ctx.install(next, 'capture');
  }));
  const clear = button('Clear',() => run(async () => {
    await fileAttachments(ctx,[...records()],true,true);
    await ctx.capture.saveDraft({text:''}); input.value = '';
  }));
  const place = button('Add files to…',() => run(() => fileAttachments(ctx,[...records()],true)));
  const send = button('Send to Inbox',() => run(async () => {
    await ctx.capture.send({text:input.value});
    input.value = ''; feedback.textContent = 'Sent to Inbox.';
  }),{variant:'primary'});
  for (const [kind,label] of [['task','Create task…'],['note','Create note…'],['append','Add to note…']]) {
    actions.append(button(label,() => run(async () => {
      if (await fileCapturedText(ctx,kind,[{text:input.value}],true)) input.value = '';
    }),{symbol:kind==='task'?'plus':kind==='note'?'notePlus':'note'}));
  }
  function sync() {
    const attached = records().length > 0, text = !!input.value.trim();
    editor.hidden = attached; files.hidden = !attached; place.hidden = !attached;
    choose.textContent = attached ? 'Choose more files' : 'Choose files'; choose.disabled = text;
    clear.disabled = !attached && !input.value; send.disabled = !attached && !text;
    for (const b of actions.children) b.disabled = !text;
    files.replaceChildren();
    for (const item of records()) {
      const row = el('div','section-heading');
      row.append(el('span','',item.name),button('Remove '+item.name,() => run(() => fileAttachments(ctx,[item],true,true))));
      files.append(row);
    }
  }
  input.oninput = () => { feedback.textContent = ''; sync(); clearTimeout(saveTimer); saveTimer=setTimeout(()=>checkpoint().catch(report),300); };
  input.onkeydown = e => { if (e.key==='Enter' && !e.shiftKey && !e.isComposing) { e.preventDefault(); if (!send.disabled) send.click(); } };
  body.ondragover = e => e.preventDefault();
  body.ondrop = body.onpaste = e => {
    const transfer = e.dataTransfer || e.clipboardData;
    const incoming = [...transfer.files];
    const text = transfer.getData('text/plain') || transfer.getData('text/uri-list');
    if (!incoming.length) {
      if (!text || e.type !== 'drop') return;
      e.preventDefault();
      if (records().length) return report('Remove the files before writing.');
      const inside = e.target===input;
      input.setRangeText((!inside && input.value ? '\n' : '')+text,inside?input.selectionStart:input.value.length,inside?input.selectionEnd:input.value.length,'end');
      input.oninput(); input.focus(); return;
    }
    e.preventDefault();
    if (text.trim() && !text.startsWith('file:')) return report('Add text or files separately.');
    if (input.value.trim()) return report('Clear the text before choosing files.');
    run(async () => ctx.install(await window.itacan.stageFiles(ctx.library.session,incoming),'capture')).catch(report);
  };
  editor.append(actions); body.append(editor,files,choose,feedback); sync();
  return showDialog({title:'Quick Add',description:'Write down a thought, or choose files',content:body,wide:true,actions:[],footerControls:[clear,place,send],
    beforeClose:async () => {
      if (busy) throw Error('Finish the current capture action first.');
      await checkpoint();
    }});
}
