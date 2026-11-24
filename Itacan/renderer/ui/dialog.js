import { el, button, icon } from './elements.js';

// Native dialog supplies focus trapping, Escape and focus return. Each caller owns its fields.
export function showDialog({ title, description, content, actions }) {
  const dialog = el('dialog', 'dialog');
  const heading = el('h2', '', title);
  heading.id = 'dialog-' + crypto.randomUUID();
  dialog.setAttribute('aria-labelledby', heading.id);
  const form = el('form');
  const header = el('header', 'section-heading');
  const close = button('', () => finish(null), { variant: 'icon-button' });
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
  function finish(value) {
    if (dialog.open) dialog.close();
    dialog.remove();
    resolve(value);
  }
  const primary = actions.find(action => action.primary);
  for (const action of actions) {
    const control = button(action.label, () => {
      if (!action.primary || form.reportValidity()) finish(action.value);
    }, { variant: action.primary ? 'primary' : '' });
    footer.append(control);
  }
  form.onsubmit = event => { event.preventDefault(); if (primary && form.reportValidity()) finish(primary.value); };
  dialog.addEventListener('cancel', event => { event.preventDefault(); finish(null); });
  dialog.showModal();
  (content?.querySelector('input') || footer.lastElementChild).focus();
  return answer;
}

export async function askName(title, initial = '') {
  const label = el('label', 'field', 'Name');
  const input = el('input');
  input.required = true;
  input.maxLength = 180;
  input.value = initial;
  label.append(input);
  const answer = await showDialog({ title, content: label, actions: [
    { label: 'Cancel', value: null }, { label: initial ? 'Save copy' : 'Create', value: true, primary: true }
  ] });
  return answer ? input.value.trim() : null;
}
