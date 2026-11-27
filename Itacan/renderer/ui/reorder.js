import { button, report } from './elements.js';

export function reorderHandle(label,variant='quiet') {
  const handle=button('↕',()=>{},{variant});
  handle.draggable=true;handle.dataset.reorder='';
  handle.setAttribute('aria-label',label);
  handle.title='Drag to reorder, or press Alt+Up or Alt+Down';
  return handle;
}

// Rows keep their positions until drop. A handle can be the entire card.
export function reorderRows(list, selector, move, horizontal = false) {
  let source, marked;
  const rows = () => [...list.querySelectorAll(selector)];
  function clearMark() {
    if (marked) delete marked.dataset.insert;
    marked = null;
  }
  function finish() {
    clearMark(); source?.classList.remove('is-dragging'); source = null;
  }
  function commit(row, index) {
    const items = rows(), from = items.indexOf(row);
    if (from < 0 || index < 0 || index >= items.length || from === index) return;
    Promise.resolve(move(row,index,items)).catch(report);
  }
  list.addEventListener('dragstart', event => {
    const row = event.target.closest(selector);
    if (!row || !event.target.hasAttribute('data-reorder')) return;
    source = row;
    event.dataTransfer.effectAllowed='move';
    event.dataTransfer.setData('application/x-itacan-order','row');
    source.classList.add('is-dragging');
  });
  function insertion(event) {
    if(!source)return;
    const items=rows();
    let row=event.target.closest(selector);
    if(!row && event.target===list) {
      row=items.find(item=>{
        const box=item.getBoundingClientRect();
        return horizontal ? box.right>event.clientX : box.bottom>event.clientY;
      }) || items.at(-1);
    }
    if(!row)return;
    const rect=row.getBoundingClientRect();
    const after=horizontal ? event.clientX>rect.left+rect.width/2 : event.clientY>rect.top+rect.height/2;
    clearMark();
    const at=items.indexOf(row), from=items.indexOf(source);
    const boundary=at+Number(after);
    const index=boundary-Number(from<boundary);
    if (index!==from) {
      marked=row;
      row.dataset.insert=horizontal?(after?'right':'left'):(after?'after':'before');
    }
    return index;
  }
  list.addEventListener('dragover',event=>{
    if(insertion(event)===undefined)return;
    event.preventDefault();event.dataTransfer.dropEffect='move';
  });
  list.addEventListener('dragleave',event=>{if(!list.contains(event.relatedTarget))clearMark();});
  list.addEventListener('drop',event=>{
    const index=insertion(event);
    if(index===undefined)return;
    event.preventDefault();const row=source;finish();commit(row,index);
  });
  list.addEventListener('dragend',finish);
  list.addEventListener('keydown',event=>{
    if(!event.altKey || !event.target.hasAttribute('data-reorder'))return;
    const row=event.target.closest(selector), items=rows();
    if(!row)return;
    const previous=horizontal?'ArrowLeft':'ArrowUp', next=horizontal?'ArrowRight':'ArrowDown';
    const offsets={[previous]:items.indexOf(row)-1,[next]:items.indexOf(row)+1,Home:0,End:items.length-1};
    if(event.key in offsets){event.preventDefault();commit(row,offsets[event.key]);}
  });
}

// Unlisted entries retain the order supplied by the library.
export function inSavedOrder(items, paths = []) {
  const rank=new Map(paths.map((path,i)=>[path,i]));
  return [...items].sort((a,b)=>(rank.get(a.path) ?? paths.length)-(rank.get(b.path) ?? paths.length));
}
