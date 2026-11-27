import { StateField } from '@codemirror/state';
import { Decoration, EditorView, ViewPlugin, WidgetType } from '@codemirror/view';
import { syntaxTree } from '@codemirror/language';
import katex from 'katex';
import { localURL } from './preview.js';

class PreviewWidget extends WidgetType {
  constructor(kind,value,alt='') { super(); Object.assign(this,{kind,value,alt}); }
  eq(other) { return this.kind===other.kind && this.value===other.value && this.alt===other.alt; }
  toDOM() {
    if (this.kind==='image') {
      const image=document.createElement('img');
      image.className='live-image';image.src=this.value;image.alt=this.alt;
      return image;
    }
    const node=document.createElement('span');
    katex.render(this.value,node,{trust:false,throwOnError:false,displayMode:this.kind==='display'});
    return node;
  }
  ignoreEvent() { return false; }
}

// Multiline replacements affect vertical layout and must come from an editor state field.
const displayBlocks=StateField.define({
  create:state=>displayMath(state),
  update:(previous,tr)=>tr.docChanged || tr.selection ? displayMath(tr.state) : previous,
  provide:field=>EditorView.decorations.from(field)
});
function displayMath(state) {
  const marks=[], tree=syntaxTree(state);
  let start=null,offset=0;
  for(const line of state.doc.iterLines()) {
    if(/^\s*\$\$\s*$/.test(line)) {
      let node=tree.resolveInner(offset+line.indexOf('$'),1);
      while(node && !/Code/.test(node.name))node=node.parent;
      if(!node) {
        if(start===null)start={from:offset,inner:offset+line.length+1};
        else {
          const to=offset+line.length;
          if(!state.selection.ranges.some(r=>r.from<=to && r.to>=start.from))
            marks.push(Decoration.replace({block:true,widget:new PreviewWidget('display',state.sliceDoc(start.inner,offset).trim())}).range(start.from,to));
          start=null;
        }
      }
    }
    offset+=line.length+1;
  }
  return Decoration.set(marks);
}

export function livePreview(buffer) {
  function build(view) {
    const marks=[], {state}=view, tree=syntaxTree(state), selections=state.selection.ranges;
    const selected=(from,to)=>view.composing || selections.some(r=>r.from<=to && r.to>=from);
    const hide=Decoration.replace({});
    const lines=new Set();
    for (const {from,to} of view.visibleRanges) {
      tree.iterate({from,to,enter(node) {
        const name=node.name;
        if (name==='Link' && !selected(node.from,node.to)) {
          for(let child=node.node.firstChild;child;child=child.nextSibling) {
            if(child.name==='URL' || child.name==='LinkMark') marks.push(hide.range(child.from,child.to));
          }
          marks.push(Decoration.mark({class:'live-link'}).range(node.from,node.to));
        }
        if (name==='Image' && !selected(node.from,node.to)) {
          const raw=state.sliceDoc(node.from,node.to);
          const match=/^!\[([^\]]*)\]\((?:<([^>]+)>|([^\s)]+))\)$/.exec(raw);
          const url=match && localURL(match[2] || match[3],buffer.path);
          if (url) {
            url.searchParams.set('library',buffer.session);
            marks.push(Decoration.replace({widget:new PreviewWidget('image',url.href,match[1])}).range(node.from,node.to));
            return false;
          }
        }
        if (/^ATXHeading/.test(name)) marks.push(Decoration.line({class:'live-heading'}).range(state.doc.lineAt(node.from).from));
        if (name==='Emphasis' || name==='StrongEmphasis') {
          marks.push(Decoration.mark({tagName:name==='Emphasis'?'em':'strong'}).range(node.from,node.to));
        }
        if ((name==='EmphasisMark' || name==='HeaderMark') && !selected(node.node.parent.from,node.node.parent.to))
          marks.push(hide.range(node.from,node.to));
      }});
      for(let number=state.doc.lineAt(from).number; number<=state.doc.lineAt(to).number;number++) lines.add(number);
    }
    for(const number of lines) {
      const line=state.doc.line(number);
      for(const match of line.text.matchAll(/(?<![\\$])([$]{1,2})(?!\s)(.+?)(?<![\\\s])\1(?!\$)/g)) {
        const from=line.from+match.index,to=from+match[0].length;
        if(selected(from,to))continue;
        let node=tree.resolveInner(from,1);
        while(node && !/Code|Link|Image/.test(node.name))node=node.parent;
        if(!node)marks.push(Decoration.replace({widget:new PreviewWidget(match[1]==='$$'?'display':'math',match[2])}).range(from,to));
      }
    }
    return Decoration.set(marks,true);
  }
  return [displayBlocks,ViewPlugin.fromClass(class {
    constructor(view){this.decorations=build(view);}
    update(update){if (update.docChanged || update.selectionSet || update.viewportChanged || update.focusChanged || syntaxTree(update.startState)!==syntaxTree(update.state)) this.decorations=build(update.view);}
  },{decorations:value=>value.decorations})];
}
