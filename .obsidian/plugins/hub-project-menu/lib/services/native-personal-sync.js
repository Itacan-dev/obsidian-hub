"use strict";
// Explicitly injected personal profile only. Importing this module opens no authority.
const createSync=require("../../../../../ItacanTaskCore/personal/runtime-sync").createPersonalSync;
const createTransport=require("../../../../../ItacanTaskCore/personal/onedrive-transport").createOneDriveTransport;
async function connect(plugin,runtime,options,changed){
 const p=options.personalSync;if(!p||!runtime.personal)throw Error("Explicit personal runtime required.");
 const transport=await createTransport({vaultRoot:options.vaultPin.real,binding:p.binding,seed:p.seed,members:p.members,pairing:p.pairing,signer:p.signer});
 const watches=new Map();let request;
 const watchEvidence=()=>{for(const dir of [transport.paths.owner+"/heads",transport.paths.owner+"/objects",transport.paths.owner+"/seeds",transport.paths.space+"/members"])if(!watches.has(dir))try{const watch=require("node:fs").watch(dir,()=>request?.());watch.on("error",()=>{watch.close();watches.delete(dir)});watches.set(dir,watch)}catch(e){if(e.code!=="ENOENT")throw e}};
 const sync=createSync({runtime,transport,assertBinding:async()=>{await options.assertActivation?.();await transport.assertPrivacy()},changed:status=>{watchEvidence();changed(status)}});
 let stopped=false,dirty=false,active=null;request=()=>{if(stopped)return;dirty=true;if(active)return;active=(async()=>{while(dirty&&!stopped){dirty=false;await new Promise(resolve=>setTimeout(resolve,0));await sync.sync().catch(()=>{})}})().finally(()=>{active=null;if(dirty&&!stopped)request()})};
 const stops=[runtime.personal.subscribe(change=>{if(change.reason==="repository")request()})];
 // Watch the known transport prefix, never scan unrelated vault contents.
 const cache=plugin.app.metadataCache;if(cache?.on){const ref=cache.on("resolved",request);stops.push(()=>cache.offref(ref))}
 const vault=plugin.app.vault;for(const event of ["create","modify","delete","rename"])if(vault?.on){const ref=vault.on(event,file=>{if(file?.path?.startsWith(".itacan-personal-sync/")||event!=="modify")request()});stops.push(()=>vault.offref(ref))}
 const timer=setInterval(request,30000);timer.unref?.();stops.push(()=>clearInterval(timer));
 return Object.freeze({start:request,sync:()=>sync.sync(),status:()=>sync.status(),async close(){stopped=true;for(const watch of watches.values())watch.close();watches.clear();stops.reverse().forEach(stop=>stop());await sync.close();await active}});
}
module.exports={connect};
