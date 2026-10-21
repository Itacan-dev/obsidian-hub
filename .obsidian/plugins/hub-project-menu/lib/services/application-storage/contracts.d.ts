export type Json = null | boolean | number | string | readonly Json[] | {readonly [key:string]:Json};
export type ApplicationFieldV1 = "activityLog"|"completedTaskChecks"|"completedTaskHistory"|"dailyBriefSnapshot"|"dailyFocus"|"dirtyContexts"|"folderUi"|"homeCoverImages"|"hubAuditArchive"|"inbox"|"inboxSort"|"lastDailyBriefAutoShownDay"|"music"|"oathsByDevice"|"pendingFocus"|"projectCardOrder"|"projectWorkLogs"|"projectWorkRatings"|"reportFocusByDate"|"resourceFolders"|"resourceWorkLogs"|"resourceWorkRatings"|"spotifyConnect"|"workRatings"|"workspaceMigration"|"workspaceMode";
export interface ApplicationConfigV1 {version:1;scope:"inactive-disposable";directory:string;authorityId:string;applicationContextId:string}
export interface ScopeDeclarationV1 {field:ApplicationFieldV1;dependencies:readonly ApplicationFieldV1[]}
export type FieldEvidenceV1 = {present:true;digest:string}|{present:false;digest:null};
export interface ApplicationObservationV1 {version:1;privacy:"local-private";authorityId:string;applicationContextId:string;revision:number;snapshotDigest:string;ownerEpoch:string;allowedScopes:readonly ScopeDeclarationV1[]}
export interface ApplicationScopeReadV1 {observation:ApplicationObservationV1;fields:readonly ({field:ApplicationFieldV1;value?:Json}&FieldEvidenceV1)[]}
export interface ScopeReadRequestV1 {version:1;authorityId:string;applicationContextId:string;fields:readonly ApplicationFieldV1[]}
export type ApplicationChangeV1={field:ApplicationFieldV1;expected:FieldEvidenceV1}&({operation:"replace";value:Json}|{operation:"delete";value?:never});
export interface ApplicationRequestV1 {version:1;authorityId:string;applicationContextId:string;operationId:string;reason:string;participant:"local-private"|"shared-project-data";observation:Pick<ApplicationObservationV1,"revision"|"snapshotDigest"|"ownerEpoch">;changes:readonly ApplicationChangeV1[];dependencies:readonly {field:ApplicationFieldV1;expected:FieldEvidenceV1}[]}
export interface SelectedEffectV1 {field:ApplicationFieldV1;before:FieldEvidenceV1;after:FieldEvidenceV1}
export interface ApplicationCommittedResultV1 {version:1;authorityId:string;applicationContextId:string;operationId:string;revision:number;snapshotDigest:string;selected:readonly SelectedEffectV1[]}
export type ApplicationMutationOutcomeV1={version:1;privacy:"local-private"}&(
 {status:"committed"|"replayed";code:string;replayed:boolean;result:ApplicationCommittedResultV1;receiptDigest:string}|
 {status:"conflict"|"cancelled"|"unsupported-participant";code:string}|
 {status:"uncertain"|"unknown"|"recovery-required";code:string;operationId?:string;retry?:"review"|"identical-request-after-reconciliation"});
export type ApplicationReconciliationV1=ApplicationMutationOutcomeV1;
export interface TransactionalApplicationStoreV1 {create(options:{version:1;data:{readonly [key:string]:Json};allowedScopes:readonly ScopeDeclarationV1[]}):Promise<ApplicationObservationV1>;open(options:{version:1}):Promise<ApplicationObservationV1>;readScopes(request:ScopeReadRequestV1):Promise<ApplicationScopeReadV1>;transact(originalRequest:ApplicationRequestV1,signal?:AbortSignal):Promise<ApplicationMutationOutcomeV1>;reconcile(originalRequest:ApplicationRequestV1):Promise<ApplicationReconciliationV1>;close():Promise<void>}
