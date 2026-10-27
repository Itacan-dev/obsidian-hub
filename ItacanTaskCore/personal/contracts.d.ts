import type {CommandBase,NativeTask,HistoryRecord,CompletionRef,Partition,Receipt,WorkspaceRef} from "../src/contracts";
import type {ExternalReservations} from "../src/recurrence";
export interface PersonalSignerV1 {replicaId:string;publicKey:string;sign(value:unknown):string}
export interface SignedPersonalV1<T> {body:T;digest:string;signer:string;signature:string}
export interface PrivateSeedStateV1 {schemaVersion:1;storeId:string;revision:number;revisionId:string;parentRevisionId:string|null;partitions:Partition[];tasks:NativeTask[];history:HistoryRecord[];bindings:CompletionRef[];retiredStepIds:string[];receipts:Receipt[]}
export interface PersonalBindingV1 {format:"itacan-personal-binding";version:1;spaceId:string;root:{replicaId:string;publicKey:string};owners:{owner:WorkspaceRef;authorityId:string;partitionId:"private";kind:"private-project"|"resource";root:string;dashboard:string;seedDigest:string}[];protocol:{packet:1;frame:1;enrollment:1;membership:1;retention:3;capability:"personal-sync-proofs-v1"}}
export interface SourceCapabilityV1 {storageFormat:"private-v4";barrierVersion:2;logicalSchemaVersion:1;requiredCapabilities:["private-native-storage-v1","atomic-task-mutations-v1"]}
export interface EnrollmentBodyV1 {format:"itacan-personal-enrollment";version:1;spaceId:string;authorityId:string;owner:WorkspaceRef;partition:Partition;sourceCapability:SourceCapabilityV1;sourceRevision:number;sourceRevisionId:string;state:PrivateSeedStateV1}
export type PersonalSeedV1=SignedPersonalV1<EnrollmentBodyV1>;
export type PersonalMemberV1=SignedPersonalV1<{format:"itacan-personal-member";version:1;spaceId:string;bindingDigest:string;parent:string|null;replicaId:string;publicKey:string}>;
export interface PersonalPairingV1 {readonly version:1;readonly spaceId:string;readonly bindingDigest:string}
export interface PersonalContextV1 {binding:PersonalBindingV1;seed:PersonalSeedV1;members:PersonalMemberV1[];pairing:PersonalPairingV1;signer:PersonalSignerV1}
export interface PersonalFrameV1 {version:1;id:string;parent:string|null;replicaId:string;clock:number;allocations:string[];inventory:ExternalReservations;phases:{version:1;revision:string;values:{projectId:string;phaseId:string}[]};receipt:Receipt;packet:null|{head:string|null;frameIds:string[];members:PersonalMemberV1[]};delta:{history:HistoryRecord[];bindings:{remove:string[];add:CompletionRef[]};retiredStepIds:string[]};signature:string}
export interface PersonalPacketV1 {format:"itacan-personal-native";version:1;binding:PersonalBindingV1;seed:PersonalSeedV1;members:PersonalMemberV1[];head:string|null;frames:PersonalFrameV1[]}
export interface PersonalNamespaceV1 extends Omit<PersonalPacketV1,"format"> {format:"itacan-personal-origin-state"}
export type PersonalCommandV1=CommandBase & {expectedRepositoryRevision:number} & (
 {type:"personal.enroll";payload:{version:1;spaceId:string;seedDigest:string;bindingDigest:string;replicaId:string}}|
 {type:"personal.bootstrap";payload:{version:1;spaceId:string;seedDigest:string;bindingDigest:string;replicaId:string;baseRevisionId:string}}|
 {type:"personal.receive";payload:{version:1;spaceId:string;authorityId:string;partitionId:string;packetDigest:string;head:string|null}});
export interface PersonalSummaryV1 {version:1;acceptedOrigins:string[];conflicts:{taskId:string;origins:string[];digest:string}[]}
export interface PersonalStorageScopeV1 {version:1;spaceId:string;seedDigest:string;bindingDigest:string;replicaId:string;rootOperationId:string;rootCommandDigest:string;sourceRevisionId:string}
export interface PersonalConflictV1 {taskId:string;origins:string[];digest:string;branches:{originId:string;receiptDigest:string;task:Pick<NativeTask,"id"|"revision"|"owner"|"location"|"title"|"description"|"importance"|"start"|"due"|"completed"|"completedAt"|"archivedAt"|"deletedAt"|"steps">|null;content:{continuation:string;stepBodies:{id:string;body:string}[]}|null;history:Pick<HistoryRecord,"id"|"operationId"|"kind"|"taskId"|"stepId"|"timestamp"|"recordedAt"|"ownerAtEvent"|"counted"|"reopenedAt"|"snapshot">[];deleted:boolean}[]}
