import type {CommandBase,NativeTask,HistoryRecord,CompletionRef} from "../src/contracts";
import type {PersonalBindingV1,PersonalSeedV1,PersonalMemberV1,PersonalFrameV1,PersonalSignerV1,PersonalContextV1,PersonalPacketV1,PersonalStorageScopeV1,PersonalConflictV1,SignedPersonalV1} from "./contracts";
export interface PersonalProfileBodyV2 {format:"itacan-personal-profile";version:2;spaceId:string;baseBindingDigest:string;protocol:{packet:2;frame:2;namespace:2;enrollment:1;membership:1;retention:4;capability:"personal-sync-proofs-v2"};legacyCuts:{authorityId:string;heads:string[]}[]}
export interface PersonalBindingV2 {format:"itacan-personal-binding";version:2;base:PersonalBindingV1;profile:SignedPersonalV1<PersonalProfileBodyV2>}
export interface PersonalPairingV2 {version:2;spaceId:string;bindingDigest:string;profileDigest:string}
export interface PersonalContextV2 extends Omit<PersonalContextV1,"binding"|"pairing"> {binding:PersonalBindingV2;pairing:PersonalPairingV2;legacyFrames?:PersonalFrameV1[]}
export interface PersonalFrameV2 extends Omit<PersonalFrameV1,"version"|"packet"> {version:2;profileDigest:string;packet:null|{version:2;head:string|null;frameIds:string[];members:PersonalMemberV1[]}}
export interface PersonalPacketV2 extends Omit<PersonalPacketV1,"version"|"binding"|"frames"> {version:2;binding:PersonalBindingV2;frames:(PersonalFrameV1|PersonalFrameV2)[]}
export interface PersonalNamespaceV2 extends Omit<PersonalPacketV2,"format"> {format:"itacan-personal-origin-state"}
export interface PersonalAccountingV2 {disposition:"counted"|"reopened"|"uncounted"|"superseded"|"unresolved";counted:boolean;reopenedAt:number|null;operationId:string|null}
export interface PersonalConflictV2 extends Omit<PersonalConflictV1,"branches"> {branches:(Omit<PersonalConflictV1["branches"][number],"history">&{history:(HistoryRecord&{accounting:PersonalAccountingV2})[];eligibility:{available:boolean;code:string|null}})[]}
export interface AccountingChangeV2 {eventId:string;before:Pick<PersonalAccountingV2,"counted"|"reopenedAt"|"disposition">;after:Pick<PersonalAccountingV2,"counted"|"reopenedAt"|"disposition">}
export interface ResolutionPreviewValueV2 {task:NativeTask;content:{continuation:string;stepBodies:{id:string;body:string}[]};accounting:({eventId:string}&PersonalAccountingV2)[];accountingChanges:AccountingChangeV2[];bindings:CompletionRef[];retiredStepIds:string[];newlyRetiredStepIds:string[];removedTombstoneSteps:string[];nextTaskRevision:number}
export interface ResolutionReviewV2 {version:2;taskId:string;conflictDigest:string;reviewedHeads:string[];selectedOriginId:string;previewDigest:string;value:ResolutionPreviewValueV2;authorityId:string;partitionId:string;spaceId:string;bindingDigest:string;profileDigest:string;expectedRepositoryRevision:number;expectedLocalHead:string;expectedTaskDigest:string|null;context?:{ownerContextPin:string;identityPin:string|null;inventoryPin:string;phasePin:string;observationDigest:string}}
export interface ResolutionEffectV2 {version:2;operationId:string;taskId:string;conflictDigest:string;reviewedHeads:string[];selectedOriginId:string;previewDigest:string;resultingTaskDigest:string;contentDigest:string;accounting:({eventId:string}&PersonalAccountingV2)[];accountingChanges:AccountingChangeV2[];bindings:CompletionRef[];retiredStepIds:string[];removedTombstoneSteps:string[]}
export interface PersonalSummaryV2 {version:2;acceptedOrigins:string[];conflicts:{taskId:string;origins:string[];digest:string}[];resolution:ResolutionEffectV2|null}
export interface ResolutionInspectionV2 {version:2;operationId:string;originId:string;receiptDigest:string;resolution:ResolutionEffectV2;branches:Omit<PersonalConflictV2["branches"][number],"eligibility">[];currentConflict:PersonalSummaryV2["conflicts"]}
type PersonalPayloadBaseV2={version:2;spaceId:string;bindingDigest:string;profileDigest:string};
export type PersonalCommandV2=CommandBase&{expectedRepositoryRevision:number}&(
 {type:"personal.enroll";payload:PersonalPayloadBaseV2&{seedDigest:string;replicaId:string}}|
 {type:"personal.bootstrap";payload:PersonalPayloadBaseV2&{seedDigest:string;replicaId:string;baseRevisionId:string}}|
 {type:"personal.upgrade";payload:PersonalPayloadBaseV2&{predecessorHead:string}}|
 {type:"personal.receive";payload:PersonalPayloadBaseV2&{authorityId:string;partitionId:string;packetDigest:string;head:string|null}}|
 {type:"personal.resolve";payload:PersonalPayloadBaseV2&{authorityId:string;partitionId:string;taskId:string;expectedLocalHead:string;expectedTaskDigest:string|null;conflictDigest:string;reviewedHeads:string[];choice:{kind:"select-origin";originId:string};previewDigest:string}});
export interface PersonalStorageScopeV2 extends Omit<PersonalStorageScopeV1,"version"> {version:2;profileDigest:string;transition:{operationId:string;commandDigest:string;predecessorRevisionId:string;predecessorCapability:"atomic-task-mutations-v1"|"personal-sync-proofs-v1"}}
