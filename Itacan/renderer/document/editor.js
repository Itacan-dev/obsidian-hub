import { EditorView, keymap, lineNumbers, highlightActiveLine } from '@codemirror/view';
import { Annotation, Compartment } from '@codemirror/state';
import { defaultKeymap } from '@codemirror/commands';
import { syntaxHighlighting } from '@codemirror/language';
import { classHighlighter } from '@lezer/highlight';
import { livePreview } from './live-preview.js';
const mirrored=Annotation.define();
export const presentation=new Compartment();
import { markdown } from '@codemirror/lang-markdown';

export function makeEditor(parent, buffer, caret, live) {
  const doc=buffer.text;
  const selection = caret && {anchor:Math.min(caret.anchor,doc.length), head:Math.min(caret.head,doc.length)};
  return new EditorView({ parent, doc, selection, extensions: [
    markdown(), syntaxHighlighting(classHighlighter), EditorView.lineWrapping,
    presentation.of(live ? livePreview(buffer) : [lineNumbers(),highlightActiveLine()]),
    keymap.of([{key:'Mod-z',run:v=>buffer.undo(v,true),preventDefault:true},
      {key:'Mod-Shift-z',run:v=>buffer.undo(v,false),preventDefault:true},
      {key:'Mod-y',run:v=>buffer.undo(v,false),preventDefault:true}, ...defaultKeymap]),
    EditorView.contentAttributes.of({ 'aria-label': 'Markdown source', spellcheck: 'true' }),
    EditorView.updateListener.of(update => {
      for (const tr of update.transactions) if (tr.docChanged && !tr.annotation(mirrored)) buffer.apply(tr,update.view);
    })
  ] });
}

export function applyChanges(editor,changes) {
  editor.dispatch({changes,annotations:mirrored.of(true)});
}
export function setPresentation(editor,buffer,live) {
  editor.dispatch({effects:presentation.reconfigure(live ? livePreview(buffer) : [lineNumbers(),highlightActiveLine()])});
}
