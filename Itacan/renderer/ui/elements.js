export function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

const strokes = {
  library: 'M4 4v16 M8 4v16 M12 5v15 M16 5l4 14',
  folder: 'M3 7V5h7l2 2h9v12H3Z',
  note: 'M6 3h8l4 4v14H6Z M14 3v5h4 M9 12h6 M9 16h6',
  plus: 'M12 5v14 M5 12h14',
  arrow: 'M5 12h14 M13 6l6 6-6 6',
  chevron: 'm9 5 7 7-7 7',
  close: 'm6 6 12 12 M18 6 6 18',
  back: 'm14 5-7 7 7 7',
  file: 'M6 3h8l4 4v14H6Z M14 3v5h4'
};
export function icon(name) {
  const ns = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(ns, 'svg');
  svg.setAttribute('class', 'icon');
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('viewBox', '0 0 24 24');
  const path = document.createElementNS(ns, 'path');
  path.setAttribute('d', strokes[name]);
  svg.append(path);
  return svg;
}

export function report(error) {
  const message = document.querySelector('#message');
  message.textContent = error.message || String(error);
  message.hidden = false;
  message.onclick = () => { message.hidden = true; };
}

export function button(label, action, { variant = '', symbol } = {}) {
  const control = el('button', 'button ' + variant);
  control.type = 'button';
  if (symbol) control.append(icon(symbol));
  control.append(document.createTextNode(label));
  control.addEventListener('click', () => Promise.resolve().then(action).catch(report));
  return control;
}
