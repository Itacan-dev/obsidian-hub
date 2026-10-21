export * from "./contracts";
import type {NativeApplicationOptionsV1,NativeApplicationAdapterV1,ServiceOptionsV1,ApplicationMutationServiceV1} from "./contracts";
export function createNativeApplicationAdapter(options:NativeApplicationOptionsV1):NativeApplicationAdapterV1;
export function createApplicationMutationService(options:ServiceOptionsV1):ApplicationMutationServiceV1;
