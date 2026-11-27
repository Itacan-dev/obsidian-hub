import MarkdownIt from 'markdown-it';
import texmath from 'markdown-it-texmath';
import katex from 'katex';
import 'katex/dist/katex.min.css';

const md = new MarkdownIt({ html: false }).use(texmath, {
  engine: katex, delimiters: 'dollars', katexOptions: { trust: false, throwOnError: false }
});

// Research notes commonly link to a sibling note using a relative wiki link.
md.inline.ruler.before('link', 'wiki_note', (state, silent) => {
  if (!state.src.startsWith('[[',state.pos)) return false;
  const end = state.src.indexOf(']]',state.pos + 2);
  if (end < 0) return false;
  const [target, alias] = state.src.slice(state.pos + 2,end).split('|');
  if (!target || /[\n\r]/.test(target)) return false;
  const [file, heading] = target.split('#');
  const url = (file && !/\.md$/i.test(file) ? file + '.md' : file) + (heading ? '#' + heading : '');
  if (!md.validateLink(url) || /^[a-z][a-z0-9+.-]*:|^[\\/]/i.test(url)) return false;
  if (!silent) {
    state.push('link_open','a',1).attrSet('href',md.normalizeLink(url));
    state.push('text','',0).content = alias || target;
    state.push('link_close','a',-1);
  }
  state.pos = end + 2;
  return true;
});

function localURL(value, note) {
  if (!value || /^[a-z][a-z\d+.-]*:|^[\\/]/i.test(value) || value.includes('\\')) return null;
  const base = 'itacan://image/' + note.split('/').map(encodeURIComponent).join('/');
  const url = new URL(value, base);
  return /^\/(Projects|Resources)\//i.test(url.pathname) ? url : null;
}

md.renderer.rules.image = (tokens, index, options, env, renderer) => {
  const token = tokens[index];
  const target = localURL(token.attrGet('src'), env.note);
  if (!target) return md.utils.escapeHtml(token.content);
  target.searchParams.set('library', env.session);
  token.attrSet('src', target.href);
  token.attrSet('alt', renderer.renderInlineAsText(token.children || [], options, env));
  return renderer.renderToken(tokens, index, options);
};
md.renderer.rules.heading_open = (tokens, index, options, env, renderer) => {
  const slug = tokens[index + 1].content.toLowerCase().trim().replace(/[^\p{L}\p{N}\s_-]/gu, '').replace(/\s+/g, '-');
  const count = env.headings.get(slug) || 0;
  env.headings.set(slug, count + 1);
  tokens[index].attrSet('id', 'heading-' + slug + (count ? '-' + count : ''));
  return renderer.renderToken(tokens, index, options);
};

export function renderPreview(container, text, note, session, openNote, onError) {
  container.innerHTML = md.render(text, { note, session, headings: new Map() });
  container.onclick = async event => {
    const link = event.target.closest('a[href]');
    if (!link) return;
    event.preventDefault();
    try {
      const href = link.getAttribute('href');
      if (/^https?:\/\//i.test(href)) return await window.itacan.openWebLink(href);
      const url = localURL(href, note);
      if (!url) throw Error('Use a relative Markdown link inside this library.');
      const target = decodeURIComponent(url.pathname.slice(1));
      if (!/\.md$/i.test(target)) return await window.itacan.openAttachment(session, target);
      const anchor = decodeURIComponent(url.hash.slice(1));
      if (target !== note) await openNote(target, false, anchor);
      else if (anchor) scrollToHeading(container, anchor);
    } catch (error) { onError(error); }
  };
}
export function scrollToHeading(container, anchor) {
  container.querySelector('#' + CSS.escape('heading-' + anchor.toLowerCase().trim().replace(/\s+/g,'-')))?.scrollIntoView();
}
