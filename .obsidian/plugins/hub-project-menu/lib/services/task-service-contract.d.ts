/** Application contract. Search uses the legacy backend; native integration remains inactive. No platform imports. */
export type WorkspaceRef = { type: "project" | "resource"; id: string };
export type LocalEndpoint = { date: string; time: string | null };
export type PhaseRef = { projectId: string; phaseId: string };
export type TaskHandle =
    | { kind: "legacy"; identity: { kind: "hidden-id"; value: string } | null;
        locator: { path: string; line: number; expectedTitle: string } }
    | { kind: "native"; id: string };
export type StepHandle = { kind: "legacy-step"; taskIdentity: string | null; identity: string | null; ordinal: number } | { kind: "native-step"; id: string };
export type EditToken = { kind: "legacy-snapshot"; value: string } | { kind: "native-snapshot"; taskId: string; revision: number };
export type LocationRef = { type: "folder" | "note"; id: string };
export type Destination = { kind: "legacy-source"; path: string } | { kind: "native-location"; location: LocationRef | null };
export type RevealTarget = { kind: "legacy-source"; path: string; line?: number; existingId?: string | null } | { kind: "native-task"; id: string };
export interface CaptureSource { origin?: string; workspaceId?: string; workspaceName?: string; path?: string; title?: string; url?: string }
export interface TaskStep { handle: StepHandle; title: string; completed: boolean; parent: StepHandle | null; order: number }
export interface TaskDTO {
    handle: TaskHandle; existingId: string | null; title: string; completed: boolean; steps: TaskStep[];
    importance: "should" | "must" | null; start: LocalEndpoint | null; due: LocalEndpoint | null;
    description: string; phase: PhaseRef | null; owner: WorkspaceRef | null;
    source: { kind: "legacy"; locator: Extract<TaskHandle, { kind: "legacy" }>["locator"] } | null;
    location: LocationRef | null; captureSource: CaptureSource | null; revision: number | null;
    progress: { completedSteps: number; totalSteps: number; completedAt: number | null; consistency: "legacy-best-effort" | "native-committed" };
    editSafety: { kind: "legacy-source-block" | "native-revision"; persistentIdentity: boolean; saveSupported: boolean; durableRevision: boolean };
}
export interface StepDraft { handle?: StepHandle; title: string; completed: boolean; completedAt?: number }
export interface TaskDraft {
    title: string; completed: boolean; importance: "should" | "must" | null;
    start: LocalEndpoint | null; due: LocalEndpoint | null; description: string; phase: PhaseRef | null;
    captureSource?: CaptureSource | null; steps: StepDraft[]; completedAt?: number;
}
export interface EditableTask { token: EditToken; task: TaskDTO; draft: TaskDraft }
/** Read-only index projection. A displayable row is not a validated reveal target. */
export interface TaskDisplayView {
    handle: TaskHandle | null; title: string; completed: boolean; owner: WorkspaceRef | null;
    due: LocalEndpoint | null; description: string;
    source: { kind: "legacy-indexed-source"; path: string } | null;
    compatibility: { kind: "legacy-indexed-text" | "plain-text"; displayText: string; searchText: string };
    capabilities: { edit: false; attemptReveal: boolean };
}
export interface TaskReadDiagnostic {
    code: string; level: "row" | "query"; rowIndex: number | null;
    /** Diagnostic evidence only, never a reveal target or a UI message. */
    sourcePath: string | null; message: string;
}
export interface TaskDisplayRow {
    state: "indexed" | "resolved" | "ambiguous" | "unresolved" | "invalid";
    view: TaskDisplayView | null; diagnostics: TaskReadDiagnostic[];
}
export interface TaskDisplayQuery {
    consistency: "legacy-index" | "native-records"; rows: TaskDisplayRow[]; diagnostics: TaskReadDiagnostic[];
}
/** Guarded legacy action/read evidence; never a native location or an edit token. */
export interface LegacyTaskReference {
    path: string; line: number; text: string; hubTaskId: string | null; completed: boolean;
}
export interface StructuredTaskDisplayView extends TaskDisplayView {
    importance: "should" | "must" | null; start: LocalEndpoint | null;
    phase: PhaseRef | null; steps: TaskStep[]; validation: "indexed" | "source-checked";
    captureSource?: CaptureSource;
}
export interface StructuredTaskView extends StructuredTaskDisplayView {
    handle: TaskHandle;
    legacy: LegacyTaskReference & { kind: "legacy-task-read"; steps: (LegacyTaskReference & { parent?: number | null })[] };
}
export interface StructuredTaskQuery {
    consistency: "legacy-index" | "legacy-source-checked";
    /** Uncommitted parent selection only, never authoritative active Oath hydration. */
    policy?: "oath-candidates"; candidateWorkspace?: WorkspaceRef; complete?: boolean;
    rows: { state: "indexed" | "validated" | "ambiguous" | "unresolved" | "invalid";
        view: StructuredTaskView | null; display?: StructuredTaskDisplayView;
        /** Home attribution evidence. Presentation is resolved by Home's existing registry; physical ownership stays canonical. */
        home?: { physicalOwner: WorkspaceRef | null; projectReference: string | null };
        diagnostics: TaskReadDiagnostic[] }[];
    diagnostics: TaskReadDiagnostic[];
}
export type StructuredTaskOptions =
    | { workspace?: WorkspaceRef; policy?: "workspace" | "panel" | "home"; validation?: "indexed" | "source" }
    | { workspace: WorkspaceRef; policy: "oath-candidates"; validation?: "indexed" };
/** Compatibility with existing persisted Daily Brief v1 locators; no migration. */
export interface SavedTaskTarget {
    path: string; taskId?: string; taskText?: string; taskLine?: number; stepId?: string; stepText?: string;
}
/** Persisted Oath identity; path/text remain historical snapshots. */
export interface OathCommittedReference { id: string; path: string; text: string }
/** Operation-local evidence from unchanged take/readNewWork, never synthesized on recovery. */
export interface OathEnrollmentEvidence {
    id: string; path: string; line: number; text: string;
    /** Existing optional-field overlay semantics from immediate enrollment hydration. */
    metadata?: { necessity?: "must" | "should" | null; fromDate?: string | null; dueDate?: string | null;
        fromTime?: string; dueTime?: string; description?: string; phaseId?: string; captureSource?: CaptureSource };
}
export interface OathCommittedTask extends LegacyTaskReference {
    end: number; status: string; identityConflict: false;
    steps: { line: number; end: number; text: string; hubTaskId: string | null; completed: boolean; status: string; indent: number }[];
    necessity: "must" | "should" | null; fromDate: string | null; dueDate: string | null;
    fromTime?: string; dueTime?: string; description?: string; phaseId?: string; captureSource?: CaptureSource;
}
export interface OathCommittedRequest {
    workspace: WorkspaceRef | null; references: OathCommittedReference[]; awaitingIndex?: OathEnrollmentEvidence[];
}
export interface OathCommittedRead {
    consistency: "legacy-source-checked"; workspace: WorkspaceRef | null;
    rows: { reference: OathCommittedReference; state: "resolved" | "awaiting-index" | "unavailable" | "ambiguous";
        task: OathCommittedTask | null; indexed: boolean; retireAwaitingIndex: boolean; diagnostics: TaskReadDiagnostic[] }[];
    diagnostics: TaskReadDiagnostic[];
}
export interface MutationResult {
    status: "legacy-applied" | "native-committed"; task: TaskDTO | null; reveal: RevealTarget | null;
    /** Null on legacy create unless the caller supplied its established retry ID. */
    existingId?: string | null; refreshRequired: boolean; historyPersistence: "unconfirmed" | "committed";
}
export interface HistoryFact {
    kind: "task" | "step"; recordId: string | null; taskIdentity: string | null; stepIdentity: string | null;
    title: string; parentTitle: string | null; timestamp: number | null; ownerAtEvent: WorkspaceRef | null;
    source: RevealTarget | null; consistency: "legacy-best-effort" | "native-committed";
}
/** Existing recorded primitives, never reconstructed from a current task. */
export type RecordedHistoryScalar = string | number | boolean | null;
export interface LegacyRecordedHistory {
    text: string; path: string;
    id?: RecordedHistoryScalar; kind?: RecordedHistoryScalar; hubTaskId?: RecordedHistoryScalar;
    parentTaskId?: RecordedHistoryScalar; parentText?: RecordedHistoryScalar;
    timestamp?: RecordedHistoryScalar; archivedAt?: RecordedHistoryScalar; line?: RecordedHistoryScalar;
    projectId?: RecordedHistoryScalar; projectName?: RecordedHistoryScalar; project?: RecordedHistoryScalar; projectStatus?: RecordedHistoryScalar;
    projectPath?: RecordedHistoryScalar; projectRoot?: RecordedHistoryScalar;
    contextKind?: RecordedHistoryScalar; targetKind?: RecordedHistoryScalar; resourceType?: RecordedHistoryScalar;
}
export interface RecordedHistoryFact extends HistoryFact {
    recorded: LegacyRecordedHistory;
    /** Recorded note evidence, not a validated current task/reveal target. */
    recordedSource: { kind: "recorded-legacy-note"; path: string; line?: number } | null;
}
export type RecordedHistoryEvidence = Omit<LegacyRecordedHistory, "text" | "path"> & {
    text?: RecordedHistoryScalar; path?: RecordedHistoryScalar;
};
export interface RecordedHistoryQuery {
    consistency: "legacy-recorded";
    rows: { state: "recorded" | "partial" | "invalid"; fact: RecordedHistoryFact | null; diagnostics: TaskReadDiagnostic[];
        /** Safe partial evidence when a row cannot be displayed; never a fabricated HistoryFact. */
        recorded?: RecordedHistoryEvidence; unavailableFields?: string[] }[];
    diagnostics: TaskReadDiagnostic[];
}
export type TaskChange =
    | { kind: "invalidation"; backend: "legacy-markdown"; reason: "legacy-refresh"; requiresRequery: true;
        durability: "unknown"; taskHandles: null }
    | { kind: "committed"; backend: "native"; requiresRequery: true; durability: "committed";
        taskHandles: TaskHandle[]; operationId: string; repositoryRevision: number };
export interface TaskCapabilities {
    backend: "legacy-markdown" | "native";
    guarantees: { durableRevisions: boolean; atomicTaskHistory: boolean; persistentIdempotency: boolean;
        nativeLocations: boolean; portableSharing: boolean; existingGitSharing: boolean; crossWorkspaceRelocation: boolean;
        creationRetry: "caller-supplied-legacy-id" | "durable-operation-receipt" | "unsupported";
        completion: "editor-save" | "native-command" | "unsupported"; notifications: "invalidation" | "committed" };
    /** true may have per-task restrictions; inspect editSafety and restrictions. */
    operations: Record<keyof TaskOperations, boolean>; restrictions: string[];
}
export interface TaskOperations {
    /** Tolerant display enumeration, without source reads. Fatal index errors reject. */
    queryDisplay(): Promise<TaskDisplayQuery>;
    queryStructured(options?: StructuredTaskOptions): Promise<StructuredTaskQuery>;
    /** Read-only committed parent hydration. Distinct from setup eligibility and editing locators. */
    resolveOathWork(request: OathCommittedRequest): Promise<OathCommittedRead>;
    resolveLegacyAction(handle: TaskHandle): Promise<StructuredTaskView>;
    resolveSavedTarget(target: SavedTaskTarget): Promise<StructuredTaskView>;
    getTask(handle: TaskHandle): Promise<TaskDTO>;
    queryOwned(owner: WorkspaceRef): Promise<TaskDTO[]>;
    queryVisible(workspace: WorkspaceRef, options?: { policy?: "panel" | "workspace" | "home" | "oath" }): Promise<TaskDTO[]>;
    readSteps(handle: TaskHandle): Promise<TaskStep[]>;
    readEditable(handle: TaskHandle): Promise<EditableTask>;
    releaseEditable(token: EditToken): Promise<void>;
    queryHistory(query: { owner?: WorkspaceRef; handle?: TaskHandle; projection: "recorded" }): Promise<RecordedHistoryQuery>;
    queryHistory(query?: { owner?: WorkspaceRef; handle?: TaskHandle }): Promise<HistoryFact[]>;
    resolveReveal(handle: TaskHandle): Promise<RevealTarget>;
    createTask(request: { owner: WorkspaceRef; destination: Destination; draft: TaskDraft;
        retry?: { kind: "legacy-create-id"; id: string } | { kind: "native-operation"; operationId: string } }): Promise<MutationResult>;
    saveEditable(token: EditToken, draft: TaskDraft): Promise<MutationResult>;
    setCompleted(token: EditToken, completed: boolean): Promise<MutationResult>;
    addStep(token: EditToken, step: { title: string; completed?: boolean; completedAt?: number; parent?: StepHandle | null; order?: number }): Promise<MutationResult>;
    editStep(token: EditToken, handle: StepHandle, patch: { title?: string }): Promise<MutationResult>;
    deleteStep(token: EditToken, handle: StepHandle, options?: { cascade?: boolean }): Promise<MutationResult>;
    reorderSteps(token: EditToken, parent: StepHandle | null, handles: StepHandle[]): Promise<MutationResult>;
    setStepCompleted(token: EditToken, handle: StepHandle, completed: boolean): Promise<MutationResult>;
    changeAssociations(token: EditToken, associations: { phase?: PhaseRef | null; owner?: WorkspaceRef; destination?: Destination }): Promise<MutationResult>;
    deleteTask(token: EditToken): Promise<MutationResult>;
    archiveTask(token: EditToken, archived: boolean): Promise<MutationResult>;
    clearCompleted(handles: TaskHandle[]): Promise<MutationResult[]>;
}
export interface TaskServiceLifecycle {
    capabilities(): TaskCapabilities;
    subscribe(listener: (change: TaskChange) => void | Promise<void>): () => void;
    close(): Promise<void>;
}
export type TaskServiceAdapter = TaskServiceLifecycle & Partial<TaskOperations> & Partial<TaskReadBackend>;


/** N0 opt-in read protocol. Existing TaskOperations/result shapes above are unchanged. */
export type ReadBackend = "legacy-markdown" | "native";
export type ReadOperation = "structured" | "candidates" | "committed" | "history" | "navigation" | "target";
export type ReadFeature = "hierarchy" | "physical-owner" | "presentation" | "recorded-attribution" |
    "navigation" | "completion" | "lifecycle" | "stable-id" | "oath-candidates" | "oath-committed" |
    "history" | "history-counting" | "invalidation" | "source-independent" | "legacy-source" |
    "legacy-actions" | "imported-lineage" | "recurrence" | "mutation";
export type ReadSupport = { state: "supported" } | { state: "conditional" | "unsupported"; reason: string };
export interface ReadCapabilities {
    backend: ReadBackend;
    operations: Record<ReadOperation, ReadSupport>;
    features: Record<ReadFeature, ReadSupport>;
}
export interface TaskReadiness {
    backend: ReadBackend;
    state: "ready" | "not-ready" | "unavailable" | "recovering" | "unsupported";
    reason: string;
    capabilities: ReadCapabilities;
    /** Unsupported OR conditional requirements; ready does not waive missing capabilities. */
    missing: ReadFeature[];
}
export type ReadinessSnapshot = Pick<TaskReadiness, "backend" | "state" | "reason"> & { capabilities?: ReadCapabilities };
export interface NativeReadStep {
    kind: "native-step-read"; id: string; taskId: string; parentStepId: string | null; order: number;
    title: string; completed: boolean; completedAt: number | null;
}
export interface NativeReadTask {
    kind: "native-task-read"; handle: Extract<TaskHandle, { kind: "native" }>;
    id: string; revision: number; owner: WorkspaceRef; location: LocationRef | null;
    title: string; description: string; completed: boolean; completedAt: number | null;
    importance: "must" | "should" | null; start: LocalEndpoint | null; due: LocalEndpoint | null;
    phase: PhaseRef | null; steps: NativeReadStep[];
    archivedAt: number | null; deletedAt: number | null;
    /** Presentation is NOT inferred from primary ownership or provenance. */
    presentation: { state: "unresolved"; reason: string };
}
export type NativeParentReference = { kind: "native"; id: string } | { kind: "legacy-id"; id: string };
export interface NativeReadEvent {
    kind: "native-history-event"; eventId: string; targetKind: "task" | "step";
    taskId: string | null; stepId: string | null; operationId: string; partitionId: string;
    timestamp: number | null; recordedAt: number | null; ownerAtEvent: WorkspaceRef | null;
    workingContext: WorkspaceRef | null; snapshot: { title: string; parentTitle: string | null };
    counted: boolean; reopenedAt: number | null;
    relationship: "native-target" | "historical-only";
    /** Portable retained evidence only; not an imported current completion binding. */
    legacy: unknown;
}
export type NativeNavigationTarget =
    | { kind: "native-task"; id: string }
    | { kind: "native-location"; owner: WorkspaceRef; location: LocationRef }
    | { kind: "historical-provenance"; source: { kind: "recorded-legacy-note"; path: string; line?: number } };
export type NativeReadRequest =
    | { backend: "native"; operation: "structured"; owner?: WorkspaceRef; includeDeleted?: boolean; includeArchived?: boolean }
    | { backend: "native"; operation: "candidates"; workspace: WorkspaceRef }
    | { backend: "native"; operation: "committed"; workspace: WorkspaceRef; references: NativeParentReference[] }
    | { backend: "native"; operation: "history"; selection: "retained" | "counted" | "current-bindings" | "legacy-statistics" }
    | { backend: "native"; operation: "navigation"; handle: Extract<TaskHandle, { kind: "native" }>; mode: "task" | "location" | "provenance" }
    | { backend: "native"; operation: "target"; handle: Extract<TaskHandle, { kind: "native" }>; stepId?: string };
export type LegacyReadRequest =
    | { backend: "legacy-markdown"; operation: "structured"; options?: StructuredTaskOptions }
    | { backend: "legacy-markdown"; operation: "candidates"; workspace: WorkspaceRef }
    | { backend: "legacy-markdown"; operation: "committed"; request: OathCommittedRequest }
    | { backend: "legacy-markdown"; operation: "history"; query?: { owner?: WorkspaceRef; handle?: TaskHandle } }
    | { backend: "legacy-markdown"; operation: "navigation"; handle: TaskHandle }
    | { backend: "legacy-markdown"; operation: "target"; target: SavedTaskTarget };
export type TaskReadRequest = NativeReadRequest | LegacyReadRequest;
export type ReadFailure = {
    backend: ReadBackend; operation: ReadOperation; status: "unsupported" | "unavailable";
    code: string; reason: string;
};
export type NativeReadResult =
    | { backend: "native"; operation: "structured"; status: "ok"; consistency: "native-records";
        rows: NativeReadTask[] }
    | { backend: "native"; operation: "candidates"; status: "ok"; workspace: WorkspaceRef;
        /** Open physical parents only. Group/date policy remains consumer-level. */
        rows: NativeReadTask[] }
    | { backend: "native"; operation: "committed"; status: "ok"; workspace: WorkspaceRef;
        rows: { reference: NativeParentReference; state: "resolved" | "missing" | "deleted" | "owner-mismatch" | "unsupported-alias";
            task: NativeReadTask | null }[] }
    | { backend: "native"; operation: "history"; status: "ok"; selection: "retained" | "counted";
        counting: "native-counted-flag; not legacy Statistics parity"; rows: NativeReadEvent[] }
    | { backend: "native"; operation: "navigation"; status: "ok";
        state: "available" | "none" | "missing-location" | "deleted-task"; target: NativeNavigationTarget | null }
    | { backend: "native"; operation: "target"; status: "ok"; state: "resolved" | "missing" | "deleted" | "missing-step";
        task: NativeReadTask | null; step: NativeReadStep | null };
export type LegacyReadResult =
    | { backend: "legacy-markdown"; operation: "structured" | "candidates"; status: "ok"; data: StructuredTaskQuery }
    | { backend: "legacy-markdown"; operation: "committed"; status: "ok"; data: OathCommittedRead }
    | { backend: "legacy-markdown"; operation: "history"; status: "ok"; data: RecordedHistoryQuery }
    | { backend: "legacy-markdown"; operation: "navigation"; status: "ok"; data: RevealTarget }
    | { backend: "legacy-markdown"; operation: "target"; status: "ok"; data: StructuredTaskView };
export type TaskReadResult = NativeReadResult | LegacyReadResult | ReadFailure;
export interface TaskReadProtocol {
    readiness(required?: ReadFeature[]): Promise<TaskReadiness>;
    read(request: TaskReadRequest): Promise<TaskReadResult>;
    subscribeReads(listener: (change: TaskReadInvalidation) => void): () => void;
}
export type TaskReadInvalidation =
    | { backend: "native"; kind: "snapshot-invalidated"; durability: "ephemeral" }
    | { backend: "legacy-markdown"; kind: "invalidation"; durability: "unknown" };
/** Optional backend port; no production native implementation or selection. */
export interface TaskReadBackend {
    readiness(): ReadinessSnapshot | Promise<ReadinessSnapshot>;
    read(request: NativeReadRequest): Promise<NativeReadResult | ReadFailure>;
    subscribeReads(listener: (change: TaskReadInvalidation) => void): () => void;
}

