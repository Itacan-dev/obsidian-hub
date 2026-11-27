import { report } from '../shell/notice.js';
import { icon } from './icons.js';

export { icon, report };

export function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

export function button(label, action, { variant = '', symbol } = {}) {
  const control = el('button', 'button ' + variant);
  control.type = 'button';
  if (symbol) control.append(icon(symbol));
  control.append(document.createTextNode(label));
  let running = false;
  control.addEventListener('click', async () => {
    if (running) return;
    running = true;
    try {
      await action();
    } catch (error) {
      report(error);
    } finally {
      running = false;
    }
  });
  return control;
}
