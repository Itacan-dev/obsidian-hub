import type {HistoryReadPortV1,HistoryObservationV1} from "../host/history-read";
import type {HostReadStampV1} from "../host";
import type {WorkspaceRef} from "../src/contracts";
export interface LegacyHistoryPortV1 {read():Promise<{version:1;revision:string;records:readonly unknown[]}>;subscribe(listener:()=>void):()=>void}
export interface NativeHistoryReferenceV1 {authorityId:string;eventId:string;taskId:string|null;stepId:string|null;owner:WorkspaceRef|null;origin:string;navigation:{state:string;taskId:string|null;stepId:string|null}}
export interface AccountedCompletionsV1 {version:1;privacy:"local-private";stamp:HostReadStampV1;observations?:readonly {authorityId:string;stamp:HostReadStampV1}[];records:readonly (Record<string,unknown>&{nativeHistory?:NativeHistoryReferenceV1})[];completions:readonly Record<string,unknown>[];diagnostics:readonly unknown[]}
export interface CompletionFeedV1 {read():Promise<AccountedCompletionsV1>;subscribe(listener:()=>void):()=>void;reveal(record:{nativeHistory:NativeHistoryReferenceV1}):Promise<unknown>;dispose():void}
export function account(raw:readonly unknown[],native:HistoryObservationV1|readonly HistoryObservationV1[]):AccountedCompletionsV1;
export function createCompletionFeed(options:{native:HistoryReadPortV1|{read():Promise<readonly HistoryObservationV1[]>;subscribe(listener:(change:{reason:string;code?:string})=>void):()=>void};legacy:LegacyHistoryPortV1;navigate?:(target:NativeHistoryReferenceV1)=>unknown|Promise<unknown>}):CompletionFeedV1;
