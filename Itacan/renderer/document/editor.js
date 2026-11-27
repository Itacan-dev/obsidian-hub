import { EditorView, minimalSetup } from 'codemirror';
import { markdown } from '@codemirror/lang-markdown';

export function makeEditor(parent, doc, changed, caret) {
  const selection = caret && {anchor:Math.min(caret.anchor,doc.length), head:Math.min(caret.head,doc.length)};
  return new EditorView({ parent, doc, selection, extensions: [
    minimalSetup, markdown(), EditorView.lineWrapping,
    EditorView.contentAttributes.of({ 'aria-label': 'Markdown source', spellcheck: 'true' }),
    EditorView.updateListener.of(update => { if (update.docChanged) changed(update.state.doc); })
  ] });
}
