import type { TaskRepository, RepositoryOptions, PartitionDefinition } from "./contracts";
export interface StoragePort {
    list(): Promise<string[]>; read(name: string): Promise<string>;
    writeNew(name: string, data: string, hook?: null | ((stage: string) => void | Promise<void>)): Promise<void>;
    publish(source: string, destination: string): Promise<void>; replace(source: string, destination: string): Promise<void>;
    remove(name: string): Promise<void>; syncDirectory(): Promise<boolean>;
    acquire(): Promise<void>; assertWriter(): Promise<void>; release(): Promise<void>;
}
export interface JsonOptions extends Omit<RepositoryOptions, "idFactory"> {
    /** Required absolute directory, existing and empty on creation. No default. */
    directory: string; idFactory?: () => string; retention?: number; storagePort?: StoragePort;
}
export type JsonCreateOptions = JsonOptions & { partitions: PartitionDefinition[] } & (
    { storageFormat?: "legacy"; storeId?: string; expectedAuthorityId?: never } |
    { storageFormat: "private-v4"; storeId: string; expectedAuthorityId?: string; taskMutationVersion?: 1 }
);
export type JsonOpenOptions = JsonOptions & (
    { storageFormat?: "legacy"; expectedAuthorityId?: never } |
    { storageFormat: "private-v4"; expectedAuthorityId: string }
);
export function createJsonRepository(options: JsonCreateOptions): Promise<TaskRepository>;
export function openJsonRepository(options: JsonOpenOptions): Promise<TaskRepository>;
export interface ForensicSnapshot { version: 1; authority: "forensic"; writable: false; sourceFormat: "stopped-e2-flat-v1"; storeId: string; snapshot: Record<string, unknown> | null; diagnostics: {code:string;message:string}[]; manifestSha256?: string }
export function inspectJsonRepository(options: { directory: string; expectedAuthorityId: string; sourceFormat: "stopped-e2-flat-v1" }): Promise<ForensicSnapshot>;
