import {prepareAuthority,captureArchive,previewRetirement,cutoverPreflight} from "../services/native-cutover-preparation";
async function example(){
 const plan=await prepareAuthority({vaultRoot:"vault",localDataRoot:"local",vaultId:"vault-id",deviceId:"device-id",projectId:"project-id"});
 const noActivation:false=plan.enabled;const noExecution:false=plan.executable;
 const archive=await captureArchive({vaultRoot:"vault",localDataRoot:"local",archivesRoot:"archives",vaultId:"vault-id"});
 const preview=await previewRetirement({archive:archive.archive,owner:plan.owner});const noWrites:0=preview.sourceWrites;
 const preflight=await cutoverPreflight({archive:archive.archive,owner:plan.owner,authority:plan});const neverActivate:false=preflight.activationReady;
 // @ts-expect-error Resource retirement is outside the Project cutover contract.
 await previewRetirement({archive:archive.archive,owner:{type:"resource",id:"study"}});
 // @ts-expect-error Stable Project identity is mandatory.
 await prepareAuthority({vaultRoot:"vault",localDataRoot:"local",vaultId:"v",deviceId:"d"});
 return [noActivation,noExecution,noWrites,neverActivate];
}
void example;
