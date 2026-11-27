import MarkdownIt from 'markdown-it';
import texmath from 'markdown-it-texmath';
import katex from 'katex';
import 'katex/dist/katex.min.css';

const md = new MarkdownIt({ html: false }).use(texmath, {
  engine: katex, delimiters: 'dollars', katexOptions: { trust: false, throwOnError: false }
});

export function localURL(value, note) {
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

      const anchor = decodeURIComponent(url.hash.slice(1));
      if (target !== note) await openNote(target, false, anchor);
      else if (anchor) scrollToHeading(container, anchor);
    } catch (error) { onError(error); }
  };
}
export function scrollToHeading(container, anchor) {
  container.querySelector('#' + CSS.escape('heading-' + anchor.toLowerCase().trim().replace(/\s+/g,'-')))?.scrollIntoView();
}
