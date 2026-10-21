import {createHistoryReadPort, HistoryObservationV1} from "../../host/history-read";
import {createCompletionFeed, LegacyHistoryPortV1} from "../completion-feed";
import {HistoryReadRequestV4} from "../../src/history-read";
import {NativeRepositoryHostV1} from "../../host";
import {TaskRepository} from "../../src/contracts";
import {openProjectRuntime, ProjectRuntimeOptionsV1} from "../project-runtime";
declare const host:NativeRepositoryHostV1, repository:TaskRepository, legacy:LegacyHistoryPortV1, options:ProjectRuntimeOptionsV1;
const q:HistoryReadRequestV4={version:4,selection:"history",authorityId:"uuid",owners:[options.owner]};
async function use(){
 await repository.readSnapshot(q); const accepted=await host.readHistory(q);
 const port=createHistoryReadPort(host,{authorityId:q.authorityId,owners:q.owners});
 const observation:HistoryObservationV1=await port.read(); observation.history.events[0]?.receipt.operationId;
 // @ts-expect-error full receipt and commands remain private
 observation.history.events[0].receipt.payload;
 // @ts-expect-error snapshots are fixed, no arbitrary selection
 await host.readHistory({...q,selection:"state"});
 // @ts-expect-error History projection uses its explicit negotiated version
 await repository.readSnapshot({...q,version:1});
 const feed=createCompletionFeed({native:port,legacy}); const value=await feed.read(); value.completions;
 const runtime=await openProjectRuntime({} as Parameters<typeof openProjectRuntime>[0],{...options,historyUiV1:true});
 runtime.completionFeed({legacy,app:{}}); feed.dispose(); port.dispose(); return accepted;
}
void use;
