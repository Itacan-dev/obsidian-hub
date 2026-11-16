"use strict";
const {clone}=require("../domain/global-plan");
class PlanDraft {
 constructor(storage,vault){this.storage=storage;this.key="itacan-plan-draft:"+vault;}
 read(){const text=this.storage.getItem(this.key);return text?JSON.parse(text):null;}
 put(record){this.storage.setItem(this.key,JSON.stringify(clone(record)));}
 clear(){this.storage.removeItem(this.key);}
}
module.exports={PlanDraft};
