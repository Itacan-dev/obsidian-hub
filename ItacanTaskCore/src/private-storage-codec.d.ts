export interface PrivateBarrierV1 {
    version: 1; authorityId: string; minimumLogicalSchemaVersion: 1 | 2 | 3 | 4; requiredCapabilities: string[];
    importRecoveryScope: null | { version: 1; minimumSchemaVersion: 4; planId: string; captureDigest: string; taskIds: string[]; stepIds: string[]; eventIds: string[]; partitionIds: string[]; digest: string };
}
export interface PrivateBarrierV2 extends Omit<PrivateBarrierV1,"version"> { version:2 }
export type PrivateBarrier = PrivateBarrierV1 | PrivateBarrierV2;
export function makeBarrier(id: string, minimum: 1 | 2 | 3 | 4, scope: PrivateBarrierV1["importRecoveryScope"]): PrivateBarrierV1;
export function makeBarrier(id: string, minimum: 1 | 2 | 3 | 4, scope: PrivateBarrierV1["importRecoveryScope"], taskMutationVersion:1): PrivateBarrierV2;
export function validateBarrier(barrier: unknown, expectedAuthority: string): PrivateBarrier;
export function encodePrivateGeneration(state: unknown, barrier: PrivateBarrier): string;
export function decodePrivateGeneration(raw: string, expectedAuthority: string): { state: Record<string, unknown>; barrier: PrivateBarrier };
export function encodePrivateManifest(manifest: unknown, barrier: PrivateBarrier): string;
export function decodePrivateManifest(raw: string, expectedAuthority: string): { manifest: Record<string, unknown>; barrier: PrivateBarrier };
