export interface Owner {id:string;kind:'project'|'resource';externalId:string;label:string;available:boolean}
export interface Metadata {title:string;description?:string;startDate?:string|null;startTime?:string|null;dueDate?:string|null;dueTime?:string|null;importance?:'should'|'must'|null;context?:{kind:'note'|'folder';reference:string}|null;phaseId?:string|null}
export interface StepDraft {id?:string;text:string;completed?:boolean}
export interface Step {id:string;taskId:string;order:number;text:string;completed:boolean;completedAt:number|null;createdAt:number;modifiedAt:number}
export interface RecurrenceRule {frequency:'daily'|'weekly';interval:number;zone:string;startDate:string|null;dueDate:string|null}
export interface Recurrence {seriesId:string;ordinal:number;seriesRevision:number;occurrenceRevision:number;active:boolean;rule:RecurrenceRule;successorId:string|null}
export type RecurrenceEdit={action:'define';rule:RecurrenceRule}|{action:'edit';expectedSeriesRevision:number;rule?:RecurrenceRule;updateTemplate?:boolean}|{action:'stop';expectedSeriesRevision:number};
export interface Task extends Required<Metadata> {id:string;ownerId:string;ownerKind:'project'|'resource';ownerAvailable:boolean;revision:number;completed:boolean;completedAt:number|null;completionEvent:{id:string;completedAt:number;operationId:string}|null;createdAt:number;modifiedAt:number;deletedAt:number|null;steps:Step[];recurrence:Recurrence|null}
type Base={operationId:string};type Target=Base&{taskId:string;expectedRevision:number};
export type Command=(Base&{type:'owner.put';owner:Owner})|(Base&{type:'task.create';task:Metadata&{id?:string;ownerId:string;completed?:boolean;steps?:StepDraft[];recurrence?:RecurrenceRule}})|(Target&{type:'task.edit';patch:Partial<Metadata>&{ownerId?:string};steps?:StepDraft[];completed?:boolean;recurrence?:RecurrenceEdit})|(Target&{type:'task.setCompleted';completed:boolean})|(Target&{type:'task.delete'})|(Target&{type:'step.add';step:StepDraft})|(Target&{type:'step.edit';stepId:string;text:string})|(Target&{type:'step.setCompleted';stepId:string;completed:boolean})|(Target&{type:'step.delete';stepId:string})|(Target&{type:'step.reorder';stepIds:string[]})|(Target&{type:'recurrence.define';rule:RecurrenceRule;seriesId?:string})|(Target&{type:'recurrence.edit';expectedSeriesRevision:number;rule?:RecurrenceRule;updateTemplate?:boolean})|(Target&{type:'recurrence.stop';expectedSeriesRevision:number});
export interface HistoryEvent {id:string;operationId:string;taskId:string;stepId:string|null;ownerId:string;title:string;parentTitle:string|null;completedAt:number;counted:boolean;reopenedAt:number|null}
export interface Outcome {operationId:string;sequence:number;taskId:string|null;taskRevision:number|null;successorId:string|null;historyIds:string[];owner:Owner|null}
/** operationSequence/taskRevision identify the original operation; task and sequence are a current snapshot on replay. */
export interface Result extends Omit<Outcome,'owner'> {operationSequence:number;owner?:Owner|null;task:Task|null;successor:Task|null;history?:HistoryEvent[];replayed:boolean;timing:{queueMs:number;transactionMs:number;serviceMs:number}}
export interface Change {sequence:number;operationId:string;ownerId:string;taskIds:string[];stepIds:string[];historyIds:string[];kind:string}
export interface OutboxChange extends Change {taskId:string|null;baseRevision:number|null;taskPatch:Partial<Task>|null;steps:Step[];deletedStepIds:string[];owner:Owner|null;generatedTasks:Task[];history:HistoryEvent[]}
export interface TaskService {
 execute(command:Command):Promise<Result>;
 listOwners():Promise<{sequence:number;owners:Owner[]}>;
 getTask(id:string,options?:{includeDeleted?:boolean}):Promise<{sequence:number;task:Task|null}>;
 listTasks(options?:{ownerId?:string|null;completed?:boolean|null;afterId?:string;limit?:number;dueFrom?:string|null;dueTo?:string|null}):Promise<{sequence:number;tasks:Task[];total:number;next:string|null}>;
 readHistory(options?:{ownerId?:string|null;taskId?:string|null;from?:number;to?:number;after?:{time:number;id:string}|null;limit?:number}):Promise<{sequence:number;events:HistoryEvent[];next:{time:number;id:string}|null}>;
 readStatistics(options?:{ownerId?:string|null;from?:number;to?:number}):Promise<{sequence:number;completedTasks:number;completedSteps:number;totalCompletions:number}>;
 getOperation(operationId:string):Promise<Outcome|null>;
 readOutbox(options?:{ownerId?:string|null;after?:number;limit?:number}):Promise<{sequence:number;changes:OutboxChange[];next:number}>;
 getCursor(consumerId:string,ownerId:string):Promise<number>;checkpoint(consumerId:string,ownerId:string,sequence:number):Promise<number>;
 subscribe(filter:{ownerId?:string;taskId?:string},listener:(change:Change)=>void):()=>void;close():Promise<void>;
}
export class TaskEngine implements TaskService {constructor(file:string,options?:{busyTimeout?:number;clock?:()=>number;diagnostic?:(event:object)=>void;readOnly?:boolean});execute:TaskService['execute'];listOwners:TaskService['listOwners'];getTask:TaskService['getTask'];listTasks:TaskService['listTasks'];readHistory:TaskService['readHistory'];readStatistics:TaskService['readStatistics'];getOperation:TaskService['getOperation'];readOutbox:TaskService['readOutbox'];getCursor:TaskService['getCursor'];checkpoint:TaskService['checkpoint'];subscribe:TaskService['subscribe'];close:TaskService['close']}
export class TaskError extends Error {code:string}
export interface TaskSyncStatus {state:'disabled'|'starting'|'syncing'|'current'|'waiting'|'conflict'|'enrollment-required'|'error';authorityId?:string;workspaceId?:string;deviceId?:string;error?:string|null;code?:string|null;conflicts?:number;pending?:number;lastSuccess?:number}
/** The installed utility adds personal synchronization; the SQLite engine stays transport-independent. */
export interface SynchronizedTaskService extends TaskService {
 syncStatus():Promise<TaskSyncStatus>;
 syncNow():Promise<TaskSyncStatus>;
 syncConflicts():Promise<Array<{operationId:string;deviceId:string;number:number;units:string[];local:Array<Partial<Task>>;incoming:Array<Partial<Task>>}>>;
 syncResolve(input:{operationId:string;choice:'local'|'incoming'}):Promise<TaskSyncStatus>;
 syncEnroll(choice:'merge'):Promise<TaskSyncStatus>;
}
