import type { CreateOptions, OpenOptions, IdentityRepository, IdentityState } from "./contracts";
export function createDirectoryIdentity(options: CreateOptions & { directory: string }): Promise<IdentityRepository>;
export function openDirectoryIdentity(options: OpenOptions & { directory: string }): Promise<IdentityRepository>;
export function inspectIdentityDirectory(directory: string): Promise<{ files: string[]; lockRaw: string | null; state: IdentityState | null; error: { code: string; message: string } | null }>;
export function preserveAbandonedIdentityLock(options: { directory: string; expectedRaw: string; confirmDeadWriter: true }): Promise<{ retained: string }>;
