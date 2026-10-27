import type {PersonalPacketV1,PersonalNamespaceV1,PersonalConflictV1,PrivateSeedStateV1} from "../personal/contracts";
export function hash(value:unknown):string;
export function packet(namespace:PersonalNamespaceV1):PersonalPacketV1;
export function namespace(packet:PersonalPacketV1):PersonalNamespaceV1;
export function validateState(state:PrivateSeedStateV1 & {personalShared:PersonalNamespaceV1}):Promise<void>;
export function inspectConflict(state:PrivateSeedStateV1 & {personalShared:PersonalNamespaceV1},taskId:string):PersonalConflictV1[];
export function previewReceive(local:PersonalPacketV1,incoming:PersonalPacketV1):{changed:boolean;tasks:import("./contracts").NativeTask[]};

export function packet(namespace:import("../personal/contracts-v2").PersonalNamespaceV2):import("../personal/contracts-v2").PersonalPacketV2;
export function namespace(packet:import("../personal/contracts-v2").PersonalPacketV2):import("../personal/contracts-v2").PersonalNamespaceV2;
export {reviewResolution,inspectResolution} from "./personal-shared-v2";
