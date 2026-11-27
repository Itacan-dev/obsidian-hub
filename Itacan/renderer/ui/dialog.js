import { el, button, icon } from './elements.js';

// Native dialog supplies focus trapping, Escape and focus return. Each caller owns its fields.
export function showDialog({ title, description, content, actions, footerControls = [], headerControls, wide = false, beforeClose }) {
  const dialog = el('dialog', wide ? 'dialog wide' : 'dialog');
  const heading = el('h2', '', title);
  heading.id = 'dialog-' + crypto.randomUUID();
  dialog.setAttribute('aria-labelledby', heading.id);
  const form = el('form');
  const header = el('header', 'section-heading');
  const close = button('', () => submit({ value: null }), { variant: 'icon-button' });
  close.append(icon('close'));
  close.setAttribute('aria-label', 'Close dialog');
  const titles = el('div','dialog-titles');
  titles.append(heading);
  if (description) titles.append(el('p', 'dialog-description muted', description));
  header.append(titles);
  if (headerControls) header.append(headerControls);
  header.append(close);
  form.append(header);
  if (content) {
    content.classList.add('dialog-body');
    form.append(content);
  }
  const footer = el('footer', 'dialog-actions');
  footer.append(...footerControls);
  form.append(footer);
  dialog.append(form);
  document.body.append(dialog);
  let resolve;
  const answer = new Promise(done => { resolve = done; });
  let busy = false;
  function finish(value) {
    if (busy) return;
    if (dialog.open) dialog.close();
    dialog.remove();
    resolve(value);
  }
  const primary = actions.find(action => action.primary);
  const error = el('p', 'form-error');
  error.setAttribute('role', 'alert');
  footer.before(error);
  async function submit(action) {
    if (busy || action.primary && !form.reportValidity()) return;
    busy = true;
    form.inert = true;
    try {
      await beforeClose?.();
      if(await action.run?.()===false)return;
      busy = false;
      finish(action.value);
    } catch (problem) { error.textContent = problem.message; }
    finally { busy = false; form.inert = false; }
  }
  for (const action of actions) {
    const control = button(action.label, () => submit(action), { variant: action.primary ? 'primary' : '' });
    footer.append(control);
  }
  form.onsubmit = event => { event.preventDefault(); if (primary) void submit(primary); };
  dialog.addEventListener('cancel', event => { event.preventDefault(); void submit({ value: null }); });
  dialog.addEventListener('close', () => { dialog.remove(); resolve(null); }, { once: true });
  dialog.showModal();
  const first = [...(content?.querySelectorAll('input:enabled, textarea:enabled, select:enabled') || [])].find(control => control.getClientRects().length);
  // A destructive confirmation opens on its cancellation action.
  const cancel=actions.findIndex(a=>a.value===false);
  const safeDefault=cancel>=0 && !content ? footer.children[footerControls.length+cancel] : null;
  (content?.querySelector('[autofocus]') || first || safeDefault || footer.lastElementChild || close).focus({preventScroll:true});
  return answer;
}

export async function askName(title, initial = '', submitLabel = initial ? 'Save copy' : 'Create') {
  const label = el('label', 'field', 'Name');
  const input = el('input');
  input.required = true;
  input.maxLength = 180;
  input.value = initial;
  label.append(input);
  const answer = showDialog({ title, content: label, actions: [
    { label: 'Cancel', value: null }, { label: submitLabel, value: true, primary: true }
  ] });
  input.select();
  return await answer ? input.value.trim() : null;
}
