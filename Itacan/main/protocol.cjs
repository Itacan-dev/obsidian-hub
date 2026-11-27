const fs = require('node:fs/promises');
const { createReadStream } = require('node:fs');
const path = require('node:path');
const { Readable } = require('node:stream');
const { imageTypes } = require('./library.cjs');
const { oathAllows } = require('./oath.cjs');
const { audioPath, audioTypes } = require('./music.cjs');

const appURL = 'itacan://app/index.html';
const types = {
  ...imageTypes,
  '.js': 'text/javascript',
  '.mjs': 'text/javascript',
  '.bcmap': 'application/octet-stream',
  '.pfb': 'application/octet-stream',
  '.wasm': 'application/wasm',
  '.bin': 'application/octet-stream',
  '.icc': 'application/octet-stream',
  '.otf': 'font/otf',
  '.css': 'text/css',
  '.html': 'text/html',
  '.woff2': 'font/woff2',
  '.woff': 'font/woff',
  '.ttf': 'font/ttf'
};
const csp = [
  "default-src 'none'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' itacan://image itacan://media",
  "media-src 'self' itacan://audio",
  "worker-src 'self'",
  "font-src 'self' blob:",
  "connect-src 'self' itacan://media",
  "base-uri 'none'",
  "form-action 'none'",
  "frame-src 'none'"
].join('; ');

async function serveAudio(request, library, relative) {
  const file = await audioPath(library, relative);
  const { size } = await fs.stat(file);
  const range = request.headers.get('range');
  let start = 0;
  let end = size - 1;
  if (range) {
    const match = /^bytes=(\d*)-(\d*)$/.exec(range);
    if (!match || (!match[1] && !match[2])) return new Response(null, { status: 416 });
    start = match[1] ? Number(match[1]) : Math.max(size - Number(match[2]), 0);
    if (match[1] && match[2]) end = Math.min(end, Number(match[2]));
    if (!Number.isSafeInteger(start) || start > end) {
      return new Response(null, { status: 416, headers: { 'Content-Range': 'bytes */' + size } });
    }
  }
  const headers = {
    'Content-Type': audioTypes[path.extname(relative).toLowerCase()],
    'Accept-Ranges': 'bytes',
    'Content-Length': String(end - start + 1)
  };
  if (range) headers['Content-Range'] = `bytes ${start}-${end}/${size}`;
  const body = size && request.method !== 'HEAD'
    ? Readable.toWeb(createReadStream(file, { start, end, signal: request.signal }))
    : null;
  return new Response(body, { status: range ? 206 : 200, headers });
}

// Every library URL carries its session so switching folders invalidates old renderer URLs.
async function serve(request, publicDir, { library, work }) {
  try {
    const url = new URL(request.url);
    let relative = decodeURIComponent(url.pathname.slice(1));
    const sameOriginMedia = url.hostname === 'app' && relative.startsWith('media/');
    const media = sameOriginMedia || url.hostname === 'media';
    if (sameOriginMedia) relative = relative.slice(6);
    const currentLibrary = library && url.searchParams.get('library') === library.session;
    const workState = work?.latest || {};
    if (url.hostname === 'audio') {
      if (!currentLibrary || !oathAllows(workState, relative)) return new Response(null, { status: 404 });
      return await serveAudio(request, library, relative);
    }

    let file;
    let type;
    if (url.hostname === 'image' || media) {
      type = imageTypes[path.extname(relative).toLowerCase()];
      if (!type && media && /\.pdf$/i.test(relative)) type = 'application/pdf';
      if (library && !oathAllows(workState, relative)) return new Response(null, { status: 403 });
      if (!type || !currentLibrary) return new Response(null, { status: 404 });
      file = await library.attachmentPath(relative);
    } else {
      const safePart = part => /^[a-z0-9_.-]+$/i.test(part) && !part.startsWith('.');
      if (url.hostname !== 'app' || !relative.split('/').every(safePart)) return new Response(null, { status: 404 });
      file = path.join(publicDir, relative);
      type = types[path.extname(file)];
      if (!type) return new Response(null, { status: 404 });
    }

    const headers = { 'Content-Type': type, 'Content-Security-Policy': csp, 'X-Content-Type-Options': 'nosniff' };
    if (media) {
      const stat = await fs.stat(file);
      headers.ETag = `"${stat.size}-${stat.mtimeMs}"`;
      headers['Last-Modified'] = stat.mtime.toUTCString();
      headers['Cache-Control'] = 'no-store';
      headers['Access-Control-Expose-Headers'] = 'ETag, Last-Modified';
      if (url.hostname === 'media') headers['Access-Control-Allow-Origin'] = 'itacan://app';
    }
    const body = request.method === 'HEAD' ? null : await fs.readFile(file);
    return new Response(body, { headers });
  } catch {
    return new Response(null, { status: 404 });
  }
}

module.exports = { appURL, serve };
