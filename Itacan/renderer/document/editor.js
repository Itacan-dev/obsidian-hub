import { EditorView, minimalSetup } from 'codemirror';
import { markdown } from '@codemirror/lang-markdown';

export function makeEditor(parent, doc, changed) {
  return new EditorView({ parent, doc, extensions: [
    minimalSetup, markdown(), EditorView.lineWrapping,
    EditorView.contentAttributes.of({ 'aria-label': 'Markdown source', spellcheck: 'true' }),
    EditorView.updateListener.of(update => { if (update.docChanged) changed(update.state.doc); })
  ] });
}
