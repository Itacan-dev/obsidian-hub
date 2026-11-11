"use strict";
const {Modal}=require("obsidian"),{ownModalColors}=require("./color-system");
function openFileOperationRecovery(plugin){
 plugin.fileOperationRecoveryModal?.close();let disposed=false;
 const modal=plugin.fileOperationRecoveryModal=new Modal(plugin.app);modal.titleEl.setText("File operation recovery");
 async function render(){
  modal.contentEl.empty();const pending=await plugin.fileOperations.list();
  if(disposed)return;
  if(!pending.length){modal.contentEl.createEl("p",{text:"No unresolved Itacan file operations."});return;}
  const item=pending[0],intent=item.intent;
  modal.contentEl.createEl("p",{text:`${intent.kind}: ${intent.from}${intent.to?" → "+intent.to:""}`});
  modal.contentEl.createEl("p",{text:"Status: "+item.progress.phase});
  modal.contentEl.createEl("p",{text:item.progress.message??"Original intent and filesystem evidence are retained. Affected tasks remain protected until reconciliation completes."});
  modal.contentEl.createEl("p",{text:"Rechecking preserves competing files and never repeats an uncertain deletion. If paths conflict, review the retained source and destination before rechecking."});
  const status=modal.contentEl.createEl("p",{attr:{role:"status","aria-live":"polite"}}),button=modal.contentEl.createEl("button",{text:"Recheck evidence"});
  const buttons=[button];
  const perform=async decision=>{buttons.forEach(b=>b.disabled=true);try{await plugin.fileOperations.resolve(decision);await render();}catch(error){if(!disposed){status.setText(error.message);buttons.forEach(b=>b.disabled=false);}}};
  button.onclick=()=>void perform("recheck");
  if(item.progress.phase==="review"){
   const choices=intent.kind==="copy"?[["Keep partial copy; end operation","keep-copy"]]:["rename","move"].includes(intent.kind)?[["Keep original source and retain other files","keep-source"],["Confirm moved destination for task references","use-destination"]]:[];
   if(choices.length)modal.contentEl.createEl("p",{text:"After inspecting these paths, choose which retained data the task references should follow. Confirming a changed destination accepts its present contents; no file is overwritten or removed."});
   for(const [label,decision]of choices){const action=modal.contentEl.createEl("button",{text:label});buttons.push(action);action.onclick=()=>void perform(decision);}
  }
 }
 modal.onClose=()=>{disposed=true;if(plugin.fileOperationRecoveryModal===modal)plugin.fileOperationRecoveryModal=null;};
 modal.onOpen=()=>void render().catch(error=>{if(!disposed)modal.contentEl.setText(error.message);});ownModalColors(modal);modal.open();return modal;
}
module.exports={openFileOperationRecovery};
