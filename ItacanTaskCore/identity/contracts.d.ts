import type { Json, WorkspaceRef } from "../src/contracts";
export type Owner = WorkspaceRef;
export type IdentityKind = "task" | "step";
export interface OwnerRegistration { owner: Owner; root: string; shared: boolean }
export interface SourceFile { id: string; path: string; revision: string; content: string }
export interface FolderEvidence { path: string; locationId: string | null; state: "resolved" | "unresolved" }
export interface SourceOccurrence {
    entryId: string; kind: IdentityKind; fileId: string; line: number; end: number; ordinal: number;
    parentEntryId: string | null; parentStepEntryId: string | null; order: number;
    owner: Owner | null; folder: FolderEvidence; blockers: string[]; privateEvidence: Json;
}
export interface SourceSnapshot {
    version: 1; id: string; revision: string; registryRevision: string; parserVersion: 1;
    scope: "global-synthetic"; files: SourceFile[]; occurrences: SourceOccurrence[];
}
export interface CapturedEvidence {
    version: 1; fileId: string; path: string | null; fileRevision: string | null; sourceDigest: string | null;
    line: number; end: number; ordinal: number; rawLine: string; rawBlock: string; legacyId: string | null;
}
export type Disposition = "eligible-planned" | "exact-alias-required" | "id-allocation-required" |
    "ambiguous-identity" | "unsupported-semantic" | "invalid-source-identity" | "unresolved-owner-context";
export interface PlanEntry {
    entryId: string; kind: IdentityKind; owner: Owner | null; parentEntryId: string | null; parentStepEntryId: string | null;
    order: number; evidence: CapturedEvidence; folder: FolderEvidence; privateEvidence: Json; reasons: string[];
    disposition: Disposition; identityBlocked: boolean; nativeId: string | null; processing: "planned-only";
}
export interface Approval {
    operationId: string; reviewer: string; planDigest: string; sourceDigest: string; registryDigest: string;
    ledgerRevision: number; syntheticOnly: true;
}
export interface IdentityPlan {
    version: 1; id: string; decisionRevision: string; capturedLedgerRevision: number; registryDigest: string;
    snapshot: SourceSnapshot; snapshotDigest: string; entries: PlanEntry[]; createdAt: number | null;
    prepareOperationId: string; publishOperationId: string; digest: string;
    status: "prepared" | "approved" | "published" | "abandoned"; approvals: Approval[]; publicationOperationId: string | null;
}
export interface Alias {
    version: 1; legacyId: string; nativeId: string | null; kind: IdentityKind | null; owner: Owner | null;
    planId: string; entryIds: string[]; status: "active" | "ambiguous" | "unavailable" | "retired"; ledgerRevision: number;
}
export interface Reservation {
    version: 1; id: string; kind: IdentityKind; owner: Owner;
    status: "existing" | "deleted" | "retired" | "planned" | "published" | "abandoned";
    planId: string | null; entryId: string | null;
}
export interface Quarantine {
    version: 1; id: string; planId: string; decisionRevision: string; entryIds: string[]; reason: string; legacyId: string | null;
    evidence: { entryId: string; owner: Owner | null; evidence: CapturedEvidence; privateEvidence: Json; reasons: string[] }[];
    candidateNativeIds: string[]; reviews: never[]; status: "quarantined"; privacy: "local-private";
}
export interface Accounting {
    captured: number; dispositions: Partial<Record<Disposition, number>>; uniquelyIdentifiable: number;
    plannedIdentities: number; exactAliasCases: number; quarantined: number; importedTasks: 0;
}
export interface IdentityResult { operationId: string; revision: number; plan: IdentityPlan; accounting: Accounting; replayed: boolean }
export interface Receipt { version: 1; operationId: string; payload: string; payloadDigest: string; revision: number; result: IdentityResult; resultDigest: string }
export interface IdentityState {
    format: "itacan-private-identity-planning";
    versions: { snapshot: 1; evidence: 1; plan: 1; aliases: 1; reservations: 1; quarantine: 1; receipts: 1 };
    decisionRevision: string; requiredCapabilities: string[]; storeId: string; revision: number; registryRevision: string;
    registry: OwnerRegistration[]; plans: IdentityPlan[]; aliases: Alias[]; reservations: Reservation[]; quarantines: Quarantine[]; receipts: Receipt[];
}
export type Command = { version: 1; decisionRevision: string; operationId: string; expectedRevision: number } & (
    { type: "prepare"; payload: { planId: string; snapshot: SourceSnapshot; publishOperationId: string } } |
    { type: "approve"; payload: { planId: string; snapshot: SourceSnapshot; reviewer: string; syntheticOnly: true } } |
    { type: "publish"; payload: { planId: string; snapshot: SourceSnapshot } } |
    { type: "abandon"; payload: { planId: string; reason: string } }
);
export type IdentityFault = (stage: string) => void | Promise<void>;
export interface OpenOptions { idFactory: () => string; clock?: () => number | null; fault?: IdentityFault }
export interface CreateOptions extends OpenOptions {
    storeId: string; registryRevision: string; registry: OwnerRegistration[];
    reservations?: { id: string; kind: IdentityKind; owner: Owner; status: "existing" | "deleted" | "retired" }[];
}
export interface AliasResolution { state: "missing" | "ambiguous" | "unavailable" | "retired" | "owner-conflict" | "resolved-identity-only"; nativeId: string | null; owner?: Owner; kind?: IdentityKind }
export interface Analysis { version: 1; snapshotDigest: string; entries: PlanEntry[]; accounting: Accounting }
export class IdentityRepository {
    private constructor();
    snapshot(): IdentityState;
    getPlan(id: string): IdentityPlan | null;
    analyze(snapshot: SourceSnapshot): Analysis;
    resolveAlias(legacyId: string, expectedOwner?: Owner | null): AliasResolution;
    publicProjection(): never;
    execute(command: Command): Promise<IdentityResult>;
    close(): Promise<void>;
}
export class MemoryIdentityStorage { state: IdentityState | null; leased: boolean; acquire(): Promise<void>; load(): Promise<IdentityState>; commit(state: IdentityState, expected: number | null): Promise<void>; close(): Promise<void> }
export function createMemoryIdentity(options: CreateOptions & { storage?: MemoryIdentityStorage }): Promise<IdentityRepository>;
export function openMemoryIdentity(options: OpenOptions & { storage: MemoryIdentityStorage }): Promise<IdentityRepository>;
