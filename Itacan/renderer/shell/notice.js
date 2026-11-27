export function report(error) {
  const inline = [...document.querySelectorAll('dialog[open]')].at(-1)?.querySelector('.form-error');
  if (inline) {
    inline.textContent = error.message || String(error);
    return;
  }
  const message = document.querySelector('#message');
  message.textContent = error.message || String(error);
  message.hidden = false;
  message.onclick = () => { message.hidden = true; };
}
