import type {NativeRepositoryHostV1,HostReadResultV1,HostScopedResultV2} from "..";
declare const host:NativeRepositoryHostV1;
const owner={type:"project",id:"private"} as const;
const q={version:2,authorityId:"uuid",selection:"tasks",owners:[owner]} as const;
void host.readScoped(q);
void host.readScoped({version:2,authorityId:"uuid",selection:"editor",owners:[owner],targets:[{taskId:"task",owner,partitionId:"private"}]}).then(r=>{if("status" in r){r.snapshot.editor;r.info.head;r.stamp.head;
// @ts-expect-error no raw receipt
r.snapshot.receipts;
// @ts-expect-error no source envelope
r.snapshot.editor.originals;
}});
declare const result:HostScopedResultV2;
// @ts-expect-error explicit wrapper version, cannot relabel as v1
const old:HostReadResultV1=result;
// @ts-expect-error fixed selections only
void host.readScoped({...q,selection:"completions",targets:[]});
// @ts-expect-error no writes
host.execute({type:"task.complete"});
// @ts-expect-error no repository escape
host.repository;
// @ts-expect-error no current head supplied by caller
void host.readScoped({...q,head:{repositoryRevision:1}});
// @ts-expect-error incompatible old request version
void host.readScoped({...q,version:1});
// @ts-expect-error editor requires exact target
void host.readScoped({...q,selection:"editor"});
void old;

// Unresolved UI locations are explicit facts; default reads remain strict.
void host.readScoped({...q,locationEvidence:"report-unavailable"}).then(r=>{if("status" in r)r.locationFacts?.forEach(f=>{const state:"available"|"unavailable"=f.state;void state;});});
// @ts-expect-error no unverified/force location policy
void host.readScoped({...q,locationEvidence:"trust"});
