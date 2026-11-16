"use strict";
const {CaptureConfirmation}=require('./capture-modal');
async function confirmFinish(plugin,id,returnFocus){
 if(plugin.planFinishConfirmation)return false;
 const modal=plugin.planFinishConfirmation=new CaptureConfirmation(plugin.app,null,{title:'Finish this plan?',message:'The plan will be preserved. Unfinished tasks will remain unchanged.',cancelLabel:'Keep working',confirmLabel:'Finish plan',returnFocus});
 try{if(!await modal.ask())return false;await plugin.globalPlan.finishPlan(id);return true;}finally{plugin.planFinishConfirmation=null;}
}
module.exports={confirmFinish};
