const {randomUUID}=require('node:crypto');
const {taskAction}=require('./tasks.cjs');

function captureAction(state,action,data) {
  if(action==='draft') {
    if(typeof data.text!=='string')throw Error('Enter capture text.');
    if(state.quickFiles?.length && data.text.trim())throw Error('File capture is active.');
    state.quickText=data.text;
    return;
  }
  if(action!=='send')throw Error('Unknown capture action.');
  if(state.quickFiles?.length)state.inbox.unshift(...state.quickFiles);
  else if(data.text?.trim())state.inbox.unshift({id:randomUUID(),text:data.text,created:new Date().toISOString()});
  else throw Error('Enter text or choose files.');
  state.quickFiles=[];
  state.quickText='';
}

function inboxAction(state,action,data) {
  if(action==='edit') {
    const item=state.inbox.find(i=>i.id===data.id && !i.name);
    if(!item || !data.text?.trim())throw Error('Capture text is required.');
    item.text=data.text;
    return;
  }
  if(action==='sort') {
    if(!['Newest','Oldest','Type'].includes(data.sort))throw Error('Choose an Inbox sort order.');
    state.inboxSort=data.sort;
    return;
  }
  if(action==='add' && data.text?.trim())state.inbox.unshift({id:randomUUID(),text:data.text,created:new Date().toISOString()});
  else if(action==='remove')state.inbox=state.inbox.filter(item=>item.id!==data.id);
  else throw Error('Enter capture text.');
}

async function fileCapturesAsTasks(state,{ids,path,owner},library) {
  if(!Array.isArray(ids) || !ids.length || typeof path!=='string')throw Error('Select captures and a destination.');
  owner ||= path.split('/').slice(0,2).join('/');
  const selected=new Set(ids);
  for(const id of selected) {
    const item=state.inbox.find(i=>i.id===id && !i.name);
    if(!item)throw Error('Capture is no longer available.');
    const [title,...lines]=item.text.split('\n');
    await taskAction(state,'save',{owner,location:owner===path?'':path,title,description:lines.join('\n')},library);
  }
  state.inbox=state.inbox.filter(item=>!selected.has(item.id));
}
module.exports={captureAction,inboxAction,fileCapturesAsTasks};
