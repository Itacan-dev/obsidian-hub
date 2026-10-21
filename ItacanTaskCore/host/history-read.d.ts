import type {NativeRepositoryHostV1,HostReadStampV1} from "./index";
import type {WorkspaceRef} from "../src/contracts";
import type {HistoryEvidenceV1} from "../src/history-read";
export interface HistoryObservationV1 {version:1;authorityId:string;stamp:HostReadStampV1;history:HistoryEvidenceV1}
export interface HistoryReadPortV1 {read(signal?:AbortSignal):Promise<HistoryObservationV1>;subscribe(listener:(invalidation:{reason:string;code:string})=>void):()=>void;dispose():void}
export function createHistoryReadPort(host:NativeRepositoryHostV1,options:{authorityId:string;owners:readonly WorkspaceRef[]}):HistoryReadPortV1;
