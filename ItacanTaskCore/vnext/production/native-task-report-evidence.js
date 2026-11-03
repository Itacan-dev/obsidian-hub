"use strict";
// Reports consume committed History asynchronously, independently of task replies.
function attachNativeReportEvidence(plugin,host){let value=null,generation=0,closed=false,timer;
 const read=()=>value?{availability:'current',records:value.records}:{availability:'unavailable',records:[]};plugin.projectWizard.taskProgressEvidence=read;
 function refresh(){const ticket=++generation;value=null;clearTimeout(timer);timer=setTimeout(async()=>{try{const result=await host.completionFeed.read();if(!closed&&ticket===generation){value=result;document.dispatchEvent(new Event('hub-task-progress-evidence-changed'));}}catch{}},0);}
 const stop=host.completionFeed.subscribe(refresh);refresh();plugin.register(()=>{closed=true;clearTimeout(timer);stop();if(plugin.projectWizard.taskProgressEvidence===read)delete plugin.projectWizard.taskProgressEvidence});
}
module.exports={attachNativeReportEvidence};
