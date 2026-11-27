import {report} from '../ui/elements.js';

// The tab strip inserts at a boundary. The document surface joins at its
// center or splits at its nearest edge. All previews are out of flow.
export function paneDrop(host, pane, dragged, place) {
  let marked;
  function clear() {
    delete host.dataset.drop;
    if(marked)delete marked.dataset.insert;
    marked=null;
  }
  function destination(event) {
    const source=dragged(event);
    if(!source)return;
    const strip=event.target.closest('.tabs');
    let index=pane.tabs.length, edge;
    clear();
    if(strip) {
      const tab=event.target.closest('.document-tab');
      if(tab) {
        const box=tab.getBoundingClientRect(), after=event.clientX>box.left+box.width/2;
        index=pane.tabs.indexOf(tab.dataset.file)+Number(after);
        marked=tab;tab.dataset.insert=after?'right':'left';
      } else host.dataset.drop='strip';
      if(source.pane===pane && pane.tabs.indexOf(source.path)<index)index--;
    } else {
      const box=host.getBoundingClientRect();
      const x=(event.clientX-box.left)/box.width, y=(event.clientY-box.top)/box.height;
      const nearest=Math.min(x,1-x,y,1-y);
      if(nearest<.24)edge=nearest===x?'left':nearest===1-x?'right':nearest===y?'top':'bottom';
      if(source.pane===pane && (edge?pane.tabs.length===1:true))return;
      host.dataset.drop=edge || 'center';
    }
    return {source,index,edge};
  }
  host.addEventListener('dragover',event=>{
    if(!destination(event))return;
    event.preventDefault();event.stopPropagation();event.dataTransfer.dropEffect='move';
  },true);
  host.addEventListener('dragleave',event=>{if(!host.contains(event.relatedTarget))clear();});
  host.addEventListener('drop',event=>{
    const dest=destination(event);clear();
    if(!dest)return;
    event.preventDefault();event.stopPropagation();
    place(dest.source,pane,dest.index,dest.edge).catch(report);
  },true);
  return clear;
}
