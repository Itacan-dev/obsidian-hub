import type {WorkspaceRef} from "./contracts";
import type {TaskSaveDraftV1,TaskSaveGuardsV1} from "./atomic-task";
import type {CoherentSnapshotV1} from "./snapshot-read";
export interface EditorReadRequestV1 {version:1;authorityId:string;owners:readonly [WorkspaceRef];selection:"editor";targets:readonly [{taskId:string;owner:WorkspaceRef;partitionId:string}]}
export interface AvailableEditorV1 {version:1;state:"available";taskId:string;taskRevision:number;owner:WorkspaceRef;partitionId:string;expectedPartitionRevision:number;lifecycle:{archivedAt:number|null;deletedAt:null};currentCompletion:readonly {stepId:string|null;completed:boolean;completedAt:number|null}[];guards:TaskSaveGuardsV1;draft:TaskSaveDraftV1}
export interface UnavailableEditorV1 {version:1;state:"unavailable";code:string;taskId:string}
export type EditorSnapshotV1=CoherentSnapshotV1 & {editor:AvailableEditorV1|UnavailableEditorV1};
export function projectEditor(state:unknown,target:EditorReadRequestV1["targets"][0],options?:{fenced?:boolean}):AvailableEditorV1|UnavailableEditorV1;
