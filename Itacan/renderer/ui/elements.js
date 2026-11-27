export function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

const strokes = {
  library: 'M4 4v16 M8 4v16 M12 5v15 M16 5l4 14',
  calendar: 'M3 5h18v16H3z M7 3v5m10-5v5M3 11h18',
  flag: 'M5 21V4q4-3 8 0t7 0v9q-4 3-7 0t-8 0',
  lines: 'M4 6h16M4 12h16M4 18h10',
  repeat: 'm17 2 4 4-4 4M21 6H7a4 4 0 0 0-4 4m4 12-4-4 4-4m-4 4h14a4 4 0 0 0 4-4',
  sort: 'M4 6h16M4 12h12M4 18h7',
  folderPlus: 'M3 7V5h7l2 2h9v12H3ZM12 10v6m-3-3h6',
  notePlus: 'M6 3h8l4 4v14H6ZM12 10v6m-3-3h6',
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
  const inline = [...document.querySelectorAll('dialog[open]')].at(-1)?.querySelector('.form-error');
  if (inline) { inline.textContent = error.message || String(error); return; }
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
  let running = false;
  control.addEventListener('click', async () => {
    if (running) return;
    running = true;
    try { await action(); } catch (error) { report(error); }
    finally { running = false; }
  });
  return control;
}
export function isoWeek(now) {
  const day = new Date(Date.UTC(now.getFullYear(),now.getMonth(),now.getDate()));
  day.setUTCDate(day.getUTCDate()+4-(day.getUTCDay() || 7));
  return Math.ceil(((day-Date.UTC(day.getUTCFullYear(),0,1))/86400000+1)/7);
}
export function dashboardDate(now = new Date()) {
  const week = isoWeek(now);
  const result = el('div','dashboard-date');
  const date = new Intl.DateTimeFormat(undefined,{weekday:'long',month:'long',day:'numeric',year:'numeric'});
  result.append(el('div','',date.format(now)),el('small','muted','Week '+week));
  return result;
}
