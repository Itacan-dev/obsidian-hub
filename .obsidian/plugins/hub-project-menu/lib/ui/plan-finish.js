"use strict";
const {CaptureConfirmation}=require('./capture-modal');
const {Notice}=require("obsidian");
const {ownNoticeColors}=require("./color-system");
const {setHubIcon}=require("./icons");
async function confirmFinish(plugin,id,returnFocus){
 if(plugin.planFinishConfirmation)return false;
 const modal=plugin.planFinishConfirmation=new CaptureConfirmation(plugin.app,null,{title:'Finish this plan?',message:'The plan will be preserved. Unfinished tasks will remain unchanged.',cancelLabel:'Keep working',confirmLabel:'Finish plan',returnFocus});
 try{if(!await modal.ask())return false;await plugin.globalPlan.finishPlan(id);return true;}finally{plugin.planFinishConfirmation=null;}
}

function mountFinishPlan({root,component,plugin,planId}) {
 const plan=plugin.globalPlan;
 const button=root.createEl("button",{cls:"hub-button-plain hub-icon-action hub-plan-finish",attr:{type:"button"}});
 const icon=button.createSpan({cls:"hub-icon-action-glyph",attr:{"aria-hidden":"true"}});
 setHubIcon(icon.createSpan({cls:"hub-icon-action-default"}),"circle-dashed-check");
 setHubIcon(icon.createSpan({cls:"hub-icon-action-emphasis"}),"circle-check");
 button.createSpan({text:"Finish Plan"});
 function update(){
  const protectedPlan=plan.oathProtects(planId);
  button.disabled=plan.busy||protectedPlan||!plan.canFinish(planId);
  button.title=protectedPlan?"End the Oath before finishing its Plan":!plan.canFinish(planId)?"Add a note or item before finishing this Plan":"";
 }
 button.onclick=()=>void confirmFinish(plugin,planId,button).catch(error=>ownNoticeColors(new Notice(error.message)));
 plan.subscribe(component,update);
 update();
 return button;
}

module.exports={confirmFinish,mountFinishPlan};
