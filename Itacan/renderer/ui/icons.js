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
