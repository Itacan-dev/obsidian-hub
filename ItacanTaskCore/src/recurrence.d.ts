import type {WorkspaceRef,LocationRef,PhaseRef,NativeTask} from "./contracts";
export interface ExternalReservations {version:1; revision:string; ids:string[]}
export interface CalendarPolicy {calendar:"gregory"; zone:string}
export interface RecurrenceRule {version:1; frequency:"DAILY"|"WEEKLY"; interval:number; referencePolicy:"fixed-origin"; calendar:CalendarPolicy}
export interface OriginalEndpoints {start:{date:string;time:null}|null; due:{date:string;time:null}|null}
export interface RuleRevision {
 version:1;ruleId:string;seriesId:string;revision:number;previousDigest:string|null;rule:RecurrenceRule;origin:OriginalEndpoints;originOrdinal:1;
 offsets:{anchor:"due"|"start";date:string;startDays:number|null;dueDays:number|null};effectiveAfterOccurrenceId:string;reason:string;operationId:string;createdAt:number;originalEvidenceRef:null;digest:string;
}
export interface TemplateNode {id:string;parentNodeId:string|null;order:number;title:string;body:string}
export type TemplateNodeDraft = TemplateNode & {state:"new"|"existing"};
export interface TemplateRevision {version:1;templateId:string;seriesId:string;revision:number;parentRevision:number|null;previousDigest:string|null;effectiveAfterOccurrenceId:string;reason:string;operationId:string;createdAt:number;description:string;nodes:TemplateNode[];digest:string}
export interface TemplateDefinition {version:1;id:string;seriesId:string;owner:WorkspaceRef;partitionId:string;revision:number}
export type RecurrenceLifecycle="active"|"paused"|"exhausted"|"stopped"|"quarantined"|"conflicted";
export interface RecurrenceSeries {version:1;id:string;owner:WorkspaceRef;partitionId:string;revision:number;state:RecurrenceLifecycle;ruleId:string;ruleRevision:number;calendar:CalendarPolicy;templateId:string|null;templateRevision:number|null;initialOccurrenceId:string;frontierOccurrenceId:string;committedOccurrenceCount:number;createdAt:number;modifiedAt:number}
export interface OccurrenceMembership {version:1;taskId:string;seriesId:string;owner:WorkspaceRef;partitionId:string;ordinal:number;predecessorId:string|null;successorId:string|null;ruleId:string;ruleRevision:number;templateId:string|null;templateRevision:number|null;generationOperationId:string|null;generationKey:string|null;originalEndpoints:OriginalEndpoints}
export interface RecurrenceSnapshot {version:1;series:RecurrenceSeries;rule:RuleRevision;template:null|{definition:TemplateDefinition;revision:TemplateRevision};membership:OccurrenceMembership}
interface PayloadBase {version:1;expectedInventoryRevision:string;owner:WorkspaceRef;partitionId:string;reason:string}
interface RevisionPayload extends PayloadBase {seriesId:string;expectedSeriesRevision:number}
interface CommandGuard {operationId:string;taskId:string;expectedRevision:number;expectedRepositoryRevision:number}
export type RecurrenceCommand = CommandGuard & (
 | {type:"recurrence.defineSeries";payload:PayloadBase & {seriesId?:string;ruleId?:string;rule:RecurrenceRule}}
 | {type:"recurrence.reviseRule";payload:RevisionPayload & {expectedRuleRevision:number;rule:RecurrenceRule;origin:OriginalEndpoints;effectiveAfterOccurrenceId:string}}
 | {type:"recurrence.defineTemplate";payload:RevisionPayload & {templateId?:string;description:string;nodes:TemplateNodeDraft[]}}
 | {type:"recurrence.reviseTemplate";payload:RevisionPayload & {expectedTemplateRevision:number;description:string;nodes:TemplateNodeDraft[];deletions:{nodeId:string;cascade:boolean;descendantIds:string[]}[];effectiveAfterOccurrenceId:string}}
);
export interface GenerationLedgerRecord {
 version:1;key:string;seriesId:string;predecessorId:string;operationId:string;receiptOperationId:string;completionEventId:string;committedRevision:number;ruleRevision:number;templateRevision:number|null;
 referenceEvidence:{version:1;policy:"fixed-origin";originOrdinal:1;origin:OriginalEndpoints;zone:string};
 result:{kind:"successor";taskId:string;steps:{stepId:string;templateNodeId:string;completed:false;completedAt:null;completionBinding:null}[]}|{kind:"exhausted";reason:"count"|"until"|"both";proof:string};
}
/** Pure static contract validation, not an executable generation command. */
export interface GenerationGraph {version:1;occurrences:OccurrenceMembership[];ledger:GenerationLedgerRecord[];retiredSuccessorIds:string[]}
export interface RecurrenceReadiness {version:1;definitionWritesAllowed:boolean;generationSupported:false;recoveryFence:object|null}
export interface RecurrenceReservation {id:string;kind:"series"|"rule"|"template"|"node";seriesId:string;templateId:string|null;retired:boolean}
/** B1 live stores allow initial membership only and an empty generation ledger. */
export interface RecurrenceNamespace {version:1;format:"itacan-recurrence-foundation";requiredCapabilities:["recurrence-foundation-v1"];externalInventory:ExternalReservations;series:RecurrenceSeries[];ruleRevisions:RuleRevision[];templates:TemplateDefinition[];templateRevisions:TemplateRevision[];memberships:OccurrenceMembership[];reservations:RecurrenceReservation[];generationLedger:[]}
export const RECURRENCE_COMMANDS:readonly ["recurrence.defineSeries","recurrence.reviseRule","recurrence.defineTemplate","recurrence.reviseTemplate"];
export const RECURRENCE_STATES:readonly RecurrenceLifecycle[];
export function generationKey(owner:WorkspaceRef,seriesId:string,predecessorOccurrenceId:string):string;
export function validateExternalReservations(value:unknown):void;
export function validateRuleInput(value:unknown):void;
export function validateRuleRevision(value:unknown):void;
export function validateTemplateRevision(value:unknown):void;
export function validateSeries(value:unknown):void;
export function validateMembership(value:unknown):void;
export function validateGenerationGraph(value:unknown):true;
/** Explicit B2 complete future content; administrative template description is separate. */
export interface CompleteTaskContent {title:string;description:string;continuation:string;importance:"should"|"must"|null;location:LocationRef|null;phase:PhaseRef|null}
export type CompleteTemplateRevision = Omit<TemplateRevision,"version"> & {version:2;taskContent:CompleteTaskContent};
export interface CalculationEvidence {version:1;policy:"fixed-origin-civil-day-v1";ruleId:string;ruleRevision:number;ruleDigest:string;frequency:"DAILY"|"WEEKLY";interval:number;origin:OriginalEndpoints;ordinal:number;anchor:string;offsets:RuleRevision["offsets"];zone:string;endpoints:OriginalEndpoints}
export function calculateRecurrenceEndpoints(ruleRevision:RuleRevision,nextOrdinal:number):CalculationEvidence;
export interface GenerationOutcomeV2 {version:2;key:string;seriesId:string;predecessorId:string;operationId:string;receiptOperationId:string;completionEventId:string;committedRevision:number;ruleRevision:number;ruleDigest:string;templateRevision:number;templateDigest:string;calculation:CalculationEvidence;generatedAt:number;result:{kind:"successor";taskId:string;steps:{stepId:string;templateNodeId:string;completed:false;completedAt:null;completionBinding:null}[]};creationTask:NativeTask;digest:string}
export interface CompletionResultV2 {version:2;completionEventId:string;reused:boolean;outcome:GenerationOutcomeV2}
export interface RecurrenceSnapshotV2 {version:2;series:RecurrenceSeries;rule:RuleRevision;template:null|{definition:TemplateDefinition;revision:TemplateRevision|CompleteTemplateRevision};membership:OccurrenceMembership;frontierMembership:OccurrenceMembership;completion:CompletionResultV2|null}
export interface RecurrenceReadinessV2 {version:2;seriesId:string;generationSupported:true;eligible:boolean;blockers:string[];recoveryFence:object|null;inventoryRevision:string|null}
export interface GenerationPayload {version:2;seriesId:string;owner:WorkspaceRef;partitionId:string;expectedPartitionRevision:number;expectedSeriesRevision:number;expectedRuleRevision:number;expectedTemplateRevision:number;expectedInventoryRevision:string;reason:string}
export interface CompleteTemplateDraft {description:string;taskContent:CompleteTaskContent;nodes:TemplateNodeDraft[];deletions:{nodeId:string;cascade:boolean;descendantIds:string[]}[];effectiveAfterOccurrenceId:string}
export type RecurrenceGenerationCommand = CommandGuard & (
 | {type:"recurrence.prepareGeneration"|"recurrence.reviseTemplate";payload:GenerationPayload & CompleteTemplateDraft}
 | {type:"recurrence.complete";payload:GenerationPayload & {completedAt?:number|null}}
);
export const RECURRENCE_GENERATION_COMMANDS: {readonly version:2;readonly commands:readonly ["recurrence.prepareGeneration","recurrence.complete"]};
export interface RecurrenceNamespaceV2 extends Omit<RecurrenceNamespace,"version"|"requiredCapabilities"|"templateRevisions"|"generationLedger"> {version:2;requiredCapabilities:["recurrence-foundation-v1","recurrence-generation-v2"];templateRevisions:(TemplateRevision|CompleteTemplateRevision)[];generationLedger:GenerationOutcomeV2[]}
