"use strict";
const assert=require("node:assert/strict");
function strip(source){
 const a=source.indexOf("    ensureCommittedRead()"),b=source.indexOf("    async resolveWork()"),end=source.indexOf("    refresh(readTasks = true)");
 assert(b>=0&&end>b);
 return (source.slice(0,a>=0?a:b)+source.slice(end))
  .replace("if (this.disposed || this.timer) return;","if (this.disposed) return;")
  .replace("        this.ensureCommittedRead();","        this.plugin.taskData.subscribe(this.plugin, () => { void this.refresh(); });")
  .replace("        if (readTasks) this.readRevision = (this.readRevision ?? 0) + 1;\n","")
  .replace("this.disposed = true; this.closeCommittedRead();","this.disposed = true;");
}
function unchangedOath(before,after){assert.equal(strip(after.replace(/\r\n/g,"\n")),strip(before.replace(/\r\n/g,"\n")),"Every Oath method outside the precise authorized read/lifecycle integration is byte-identical");}
module.exports={unchangedOath};
