/** Offline preparation only. No source-writing or native-activation operation exists. */
export interface Owner {type:"project"|"resource";id:string}
export interface ArchiveOptions {vaultRoot:string;localDataRoot:string;archivesRoot:string;vaultId:string}
export interface Candidate {projectId:string;name:string;root:string;path:string;status:string;shared:boolean;eligible:boolean;files:number;tasks:number;steps:number;reviewFiles:number}
export interface SourceRecord {path:string;owner:Owner|null;shared:boolean;backup:string;sourceHash:string;backupHash:string;stamp:Record<string,string>;sourceUnchangedDuringCapture:boolean;tasks:number;steps:number;taskCountReliable:boolean;retirementSafe:boolean;issues:string[]}
export interface ArchiveManifest {version:1;purpose:"read-only-task-archive";activationAuthorized:false;vaultId:string;vaultRoot:string;sources:SourceRecord[];candidates:Candidate[];unresolved:{path:string;code:string}[];readableHash:string;metadataReferenceHash:string;application:{historyDigest:string;metadataDigest:string;unchanged:boolean}}
export interface AuthorityPreparation {version:1;purpose:"device-private-authority-preparation";executable:false;enabled:false;admitted:false;vaultId:string;localDataRoot:string;deviceId:string;owner:{type:"project";id:string};directory:string;privateLocationObserved:true;writerOwnership:"not-acquired";observationOnly:true}
export interface RetirementPreview {version:1;executable:false;owner:{type:"project";id:string};previewSafe:boolean;sourceWrites:0;problems:string[];files:{path:string;safe:boolean;issues?:string[];sourceHash?:string;proposedHash?:string;unrelatedBytesPreserved?:true;proposedBytes?:Uint8Array;edits?:{line:number;start:number;end:number;before:string}[]}[]}
export function inspectVault(vaultRoot:string):Promise<{root:string;candidates:Candidate[];sources:unknown[];unresolved:{path:string;code:string}[]}>;
export function analyzeSource(bytes:Uint8Array,name:string,metadata?:Record<string,unknown>):{tasks:unknown[];steps:number;edits:unknown[];issues:string[];safe:boolean;candidate:boolean;raw:string|null};
export function validatePrivateLocation(directory:string,options:{vaultRoot:string;localDataRoot:string;cloudRoots?:string[];kind?:"archive"|"authority"}):Promise<{directory:string;privateLocationObserved:true;writerOwnership:"not-acquired";observationOnly:true}>;
export function prepareAuthority(options:{vaultRoot:string;localDataRoot:string;vaultId:string;projectId:string;deviceId:string}):Promise<AuthorityPreparation>;
export function captureArchive(options:ArchiveOptions):Promise<{archive:string;manifest:ArchiveManifest}>;
export function verifyArchive(archive:string):Promise<ArchiveManifest>;
export function previewRetirement(options:{archive:string;owner:{type:"project";id:string}}):Promise<RetirementPreview>;
export function cutoverPreflight(options:{archive:string;owner?:{type:"project";id:string};authority?:AuthorityPreparation}):Promise<{version:1;executable:false;preparationReady:boolean;activationReady:false;blockers:string[];preview:RetirementPreview|null}>;
