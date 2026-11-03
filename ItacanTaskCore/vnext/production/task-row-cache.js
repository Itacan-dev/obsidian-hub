"use strict";
// Reuse unchanged native rows while the existing grouping/layout code runs.
function createTaskRowCache(component,signature){
 const rows=new Map();let generation=0,used=new Set(),attempted=new Set();
 const key=task=>JSON.stringify([task.nativeReference?.authorityId,task.nativeReference?.owner,task.id]);
 function dispose(entry){component.removeChild(entry.component);}
 const clear=()=>{for(const entry of rows.values())dispose(entry);rows.clear()};component.register(clear);
 return{begin(){const ticket=++generation;used=new Set();attempted=new Set();queueMicrotask(()=>{if(ticket!==generation)return;for(const[k,entry]of rows)if(!used.has(k)){dispose(entry);rows.delete(k)}})},
  reuse(parent,task){const k=key(task);attempted.add(k);const entry=rows.get(k);if(!entry||entry.signature!==signature(task))return false;used.add(k);parent.append(entry.row);return true},
  store(task,row,rowComponent){const taskKey=key(task),k=attempted.has(taskKey)?taskKey:Symbol(),old=rows.get(k);if(old)dispose(old);rows.set(k,{row,component:rowComponent,signature:signature(task)});used.add(k)},clear};
}
module.exports={createTaskRowCache};
