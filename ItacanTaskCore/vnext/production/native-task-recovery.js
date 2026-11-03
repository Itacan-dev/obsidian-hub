"use strict";
function openNativeTaskRecovery(plugin){
 const {Modal,Notice}=require('obsidian');
 class Recovery extends Modal{onOpen(){this.titleEl.setText('Local task recovery');const host=plugin.nativeTaskHost;this.contentEl.createEl('p',{text:'Tasks are stored on this device. Task synchronization is unavailable.'});const pending=host.pendingOperations();this.contentEl.createEl('p',{text:pending.length?pending.length+' original operation(s) await confirmation.':'No unconfirmed task operations.'});for(const c of pending)this.contentEl.createEl('code',{text:c.operationId});if(pending.length){const button=this.contentEl.createEl('button',{text:'Retry original operations',cls:'mod-cta'});button.onclick=async()=>{button.disabled=true;try{await host.retryPending();this.close();new Notice('Task operations confirmed.')}catch(e){new Notice(e.message);button.disabled=false}};}}}
 const modal=new Recovery(plugin.app);modal.open();return modal;
}
module.exports={openNativeTaskRecovery};
