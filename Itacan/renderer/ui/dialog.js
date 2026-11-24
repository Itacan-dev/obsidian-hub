import { el, button, icon } from './elements.js';

// Native dialog supplies focus trapping, Escape and focus return. Each caller owns its fields.
export function showDialog({ title, description, content, actions, wide = false, beforeClose }) {
  const dialog = el('dialog', wide ? 'dialog wide' : 'dialog');
  const heading = el('h2', '', title);
  heading.id = 'dialog-' + crypto.randomUUID();
  dialog.setAttribute('aria-labelledby', heading.id);
  const form = el('form');
  const header = el('header', 'section-heading');
  const close = button('', () => submit({ value: null }), { variant: 'icon-button' });
  close.append(icon('close'));
  close.setAttribute('aria-label', 'Close dialog');
  header.append(heading, close);
  form.append(header);
  if (description) form.append(el('p', 'muted', description));
  if (content) form.append(content);
  const footer = el('footer', 'dialog-actions');
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
      await action.run?.();
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
  (content?.querySelector('input, textarea, select') || footer.lastElementChild).focus();
  return answer;
}

export async function askName(title, initial = '', submitLabel = initial ? 'Save copy' : 'Create') {
  const label = el('label', 'field', 'Name');
  const input = el('input');
  input.required = true;
  input.maxLength = 180;
  input.value = initial;
  label.append(input);
  const answer = await showDialog({ title, content: label, actions: [
    { label: 'Cancel', value: null }, { label: submitLabel, value: true, primary: true }
  ] });
  return answer ? input.value.trim() : null;
}
