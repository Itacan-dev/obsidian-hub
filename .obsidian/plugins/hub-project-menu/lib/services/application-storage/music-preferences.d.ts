import type { Json, ApplicationObservationV1, ApplicationRequestV1, ApplicationMutationOutcomeV1, TransactionalApplicationStoreV1, FieldEvidenceV1 } from "./contracts";
type Frozen<T> = T extends object ? {readonly [K in keyof T]:Frozen<T[K]>} : T;
export type MusicPreferenceIntentV1 = {readonly kind:"set-enabled";readonly enabled:boolean} | {readonly kind:"set-provider-enabled";readonly provider:"spotify"|"youtube"|"youtube-music"|"local";readonly enabled:boolean};
export interface MusicPreferencesReadV1 {readonly observation:ApplicationObservationV1;readonly field:({readonly field:"music"}&FieldEvidenceV1&{readonly value?:Json})}
export interface PreparedMusicPreferenceV1 {readonly version:1;readonly privacy:"local-private";readonly intent:MusicPreferenceIntentV1;readonly intentDigest:string;readonly original:Frozen<MusicPreferencesReadV1>;readonly request:Frozen<ApplicationRequestV1>}
/** Private, already-open disposable C1-A authority. Does not create/open/close storage. */
export interface TransactionalMusicPreferencesV1 {
 read():Promise<MusicPreferencesReadV1>;
 prepare(intent:MusicPreferenceIntentV1, original:MusicPreferencesReadV1, operationId?:string):PreparedMusicPreferenceV1;
 submit(prepared:PreparedMusicPreferenceV1, signal?:AbortSignal):Promise<ApplicationMutationOutcomeV1>;
 reconcile(prepared:PreparedMusicPreferenceV1):Promise<ApplicationMutationOutcomeV1>;
}
/** Optional constructor dependency; omitted for every normal production MusicLibrary. */
export interface MusicLibraryPreferenceOptionsV1 {transactionalPreferences?:TransactionalMusicPreferencesV1}
export interface MusicPreferenceStatusV1 {readiness:"ready"|"unavailable"|"blocked"|"disposed";prepared:PreparedMusicPreferenceV1|null;outcome:ApplicationMutationOutcomeV1|null}
/** MusicLibrary's opted-in methods; ordinary legacy construction remains unchanged. */
export interface AdoptedMusicPreferencesCallerV1 {
 setEnabled(enabled:boolean):Promise<ApplicationMutationOutcomeV1>;
 setProviderEnabled(provider:"spotify"|"youtube"|"youtube-music"|"local",enabled:boolean):Promise<ApplicationMutationOutcomeV1>;
 getPreferenceStatus():MusicPreferenceStatusV1;
 refreshPreferences():Promise<Json>;
 reconcilePreferences(prepared?:PreparedMusicPreferenceV1):Promise<ApplicationMutationOutcomeV1>;
 replayPreferences(prepared?:PreparedMusicPreferenceV1,signal?:AbortSignal):Promise<ApplicationMutationOutcomeV1>;
 destroy():void;
}
export declare function createMusicPreferences(options:{store:TransactionalApplicationStoreV1;authorityId:string;applicationContextId:string}):TransactionalMusicPreferencesV1;
