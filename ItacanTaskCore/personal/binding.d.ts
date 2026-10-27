import type {PersonalBindingV1,PersonalPairingV1} from "./contracts";
export function validate(value:unknown):PersonalBindingV1|import("./contracts-v2").PersonalBindingV2;
export function fingerprint(binding:PersonalBindingV1|import("./contracts-v2").PersonalBindingV2):string;
export function confirm(binding:PersonalBindingV1,expectedFingerprint:string):PersonalPairingV1;

export function confirm(binding:import("./contracts-v2").PersonalBindingV2,expectedFingerprint:string):import("./contracts-v2").PersonalPairingV2;
