import type {Command,TaskRepository,RepositoryOptions} from "../../src/contracts";
import type {TaskSaveCommandV1,TaskCreateRichCommandV1,RichTaskDraftV1,AtomicTaskEffectsV1} from "../../src/atomic-task";
import type {NativeRepositoryHostV1} from "../../host";
import type {CompletionEvidencePortV1,CompletionEvidencePortV2,CompletionProofRequestV2} from "../../oath/completion-proof";
import {createOathAdapter} from "../../oath/adapter";
import type {OathAdapterOptionsV2} from "../../oath/adapter";
import type {NativeWriterPortV1,WriterRequestV1,WriterCapabilityV1,NativeTaskWriteV1} from "../../writer";
import type {ApplicationMutationServiceV1,AtomicActionEnvelopeV2} from "../../application/contracts";
import {createJsonRepository,openJsonRepository} from "../../src/json-repository";
import {createMemoryRepository,openMemoryRepository} from "../../src/contracts";
import {makeBarrier} from "../../src/private-storage-codec";
declare const save:TaskSaveCommandV1,rich:TaskCreateRichCommandV1,repo:TaskRepository,host:NativeRepositoryHostV1;
declare const proof:CompletionEvidencePortV2,oldProof:CompletionEvidencePortV1,request:CompletionProofRequestV2,options:OathAdapterOptionsV2;
declare const writer:NativeWriterPortV1,ticket:WriterCapabilityV1,w:WriterRequestV1<NativeTaskWriteV1>,app:ApplicationMutationServiceV1,intent:AtomicActionEnvelopeV2,settings:RepositoryOptions;
const command:Command=save;repo.execute(command).then(r=>{const effects:AtomicTaskEffectsV1|undefined=r.atomicTask;void effects;});repo.execute(rich);
writer.task(ticket,w);app.mutate(intent);proof.readCurrentCompletionProof(request).then(p=>{const v:2=p.version;void v;});createOathAdapter(options);
repo.readSnapshot({version:2,authorityId:"uuid",owners:[{type:"project",id:"p"}],selection:"completions",targets:[]}).then(s=>{const v:2=s.version;const e=s.completions[0]?.creation?.atomicEffect;void[v,e];});
host.create({version:2,authorityId:"uuid",partitions:[],reason:"Disposable",syntheticOnly:true,taskMutationVersion:1});
createJsonRepository({...settings,directory:"temp",storageFormat:"private-v4",storeId:"uuid",partitions:[],taskMutationVersion:1});
createMemoryRepository({...settings,partitions:[],taskMutationVersion:1});const barrier=makeBarrier("uuid",1,null,1);const barrierVersion:2=barrier.version;void barrierVersion;
// @ts-expect-error Capability cannot be selected by opening an existing JSON root.
openJsonRepository({...settings,directory:"temp",storageFormat:"private-v4",expectedAuthorityId:"uuid",taskMutationVersion:1});
// @ts-expect-error Opening memory backing cannot enable capability.
openMemoryRepository({...settings,storage:new (class {})(),taskMutationVersion:1});
// @ts-expect-error v1 proof port does not accept a v2 request.
oldProof.readCurrentCompletionProof(request);
// @ts-expect-error Explicit v2 proof selection cannot use only a v1 port.
createOathAdapter({...options,evidence:oldProof});
// @ts-expect-error v2 coherent reads are restricted to completion evidence.
repo.readSnapshot({version:2,authorityId:"uuid",owners:[],selection:"tasks"});
// @ts-expect-error Rich current content cannot supply migration/source clocks.
const bad:RichTaskDraftV1={...rich.payload.draft,createdAt:1};
// @ts-expect-error Save requires an explicit complete binding guard.
const missing:TaskSaveCommandV1={...save,payload:{version:1,scope:save.payload.scope,draft:save.payload.draft}};
// @ts-expect-error Host has no public command executor.
host.execute(save);
void[bad,missing];
