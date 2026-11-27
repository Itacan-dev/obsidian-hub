import { report } from '../ui/elements.js';

export const fileDragType='application/x-itacan-files';

// Internal selections move. Native file drops copy into the target folder.
export function fileDrag(move,importFiles,allowsImport=()=>true) {
  let paths=[], marked;
  function clear() {
    marked?.classList.remove('drop-folder');marked=null;
  }
  function finish() {paths=[];clear();}
  function source(control, selection) {
    control.draggable=true;
    control.ondragstart=e=>{
      paths=selection();
      e.dataTransfer.setData(fileDragType,JSON.stringify(paths));
      e.dataTransfer.effectAllowed='move';
      control.classList.add('is-dragging');
    };
    control.ondragend=()=>{finish();control.classList.remove('is-dragging');};
  }
  function target(control,destination) {
    const folder=()=>typeof destination==='function'?destination():destination;
    const external=e=>e.dataTransfer.types.includes('Files');
    const canImport=e=>importFiles && allowsImport(folder()) && ![...e.dataTransfer.items].some(i=>i.webkitGetAsEntry?.()?.isDirectory);

    const valid=()=>paths.length && paths.every(p=>p!==folder() && !folder().startsWith(p+'/') && p.slice(0,p.lastIndexOf('/'))!==folder());
    control.addEventListener('dragover',e=>{
      if(!(paths.length && e.dataTransfer.types.includes(fileDragType)) && !external(e))return;
      e.preventDefault();e.stopPropagation();
      if(external(e)?!canImport(e):!valid()){clear();e.dataTransfer.dropEffect='none';return;}
      e.dataTransfer.dropEffect=external(e)?'copy':'move';
      if(marked!==control){clear();marked=control;control.classList.add('drop-folder');}
    });
    control.addEventListener('dragleave',e=>{if(marked===control && !control.contains(e.relatedTarget))clear();});
    control.addEventListener('drop',e=>{
      if(!(paths.length && e.dataTransfer.types.includes(fileDragType)) && !external(e))return;
      e.preventDefault();e.stopPropagation();clear();
      if(external(e)){
        if(canImport(e))importFiles([...e.dataTransfer.files],folder()).catch(report);
      } else if(valid()) {
        const items=paths;paths=[];move(items,folder()).catch(report);
      }
    });
  }
  return {source,target,finish,get paths(){return paths;}};
}
