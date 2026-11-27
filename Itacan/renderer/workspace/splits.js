import {el} from '../ui/elements.js';
import {resizeDivider} from './divider.js';

// Leaves refer to pane IDs. Only a split owns a direction and the fraction of
// space before its divider. Older layouts supply the original ordered panes.
export function splitLayout(layout) {
  for(const pane of layout.panes)pane.id ||= crypto.randomUUID();
  const ids=new Set(layout.panes.map(p=>p.id));
  function retain(node){
    if(typeof node==='string')return ids.delete(node)?node:null;
    if(!node || !['row','column'].includes(node.axis))return null;
    const first=retain(node.first),second=retain(node.second);
    if(!first || !second)return first || second;
    node.first=first;node.second=second;
    if(!(node.share>0 && node.share<1))node.share=.5;
    return node;
  }
  let tree=retain(layout.split);
  let count=layout.panes.length-ids.size;
  for(const id of ids){
    tree=tree?{axis:'row',first:tree,second:id,share:count/(count+1)}:id;
    count++;
  }
  return layout.split=tree;
}
export function splitPane(layout,pane,next,axis,before=false) {
  const tree=splitLayout(layout);
  next.id=crypto.randomUUID();
  function insert(n){
    if(n===pane.id)return {axis,share:.5,first:before?next.id:pane.id,second:before?pane.id:next.id};
    if(typeof n==='string')return n;
    return {...n,first:insert(n.first),second:insert(n.second)};
  }
  layout.split=insert(tree);
}

export function mountSplits(tree,hosts,container,commit) {
  function build(node) {
    if(typeof node==='string')return hosts.get(node);
    const group=el('div','split-group'),a=build(node.first),b=build(node.second);
    const vertical=node.axis==='column';
    group.classList.toggle('stacked',vertical);
    const size=e=>vertical?e.clientHeight:e.clientWidth;
    function apply(){a.style.flexGrow=node.share;b.style.flexGrow=1-node.share;}
    const divider=resizeDivider('Resize document split',()=>size(a),extent=>{
      node.share=Math.max(.12,Math.min(.88,extent/Math.max(1,size(a)+size(b))));apply();
    },commit,{axis:()=>vertical?'y':'x',rememberSize:()=>{
      const previous=node.share;return ()=>{node.share=previous;apply();};
    }});
    divider.classList.add('split-divider');
    divider.setAttribute('aria-orientation',vertical?'horizontal':'vertical');
    group.append(a,divider,b);apply();
    return group;
  }
  const root=build(tree);
  root.style.flexGrow=1;
  container.replaceChildren(root);
}
