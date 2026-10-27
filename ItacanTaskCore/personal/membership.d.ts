import type {PersonalSignerV1,PersonalBindingV1,PersonalMemberV1,SignedPersonalV1} from "./contracts";
export function hash(value:unknown):string;
export function identity(replicaId?:string):PersonalSignerV1 & {exportPrivate():Uint8Array};
export function restore(replicaId:string,privateBytes:Uint8Array):PersonalSignerV1;
export function seal<T>(body:T,signer:PersonalSignerV1):SignedPersonalV1<T>;
export function open<T>(record:SignedPersonalV1<T>,key:string,replicaId:string):T;
export function certify(binding:PersonalBindingV1|import("./contracts-v2").PersonalBindingV2,signer:PersonalSignerV1,member:Pick<PersonalSignerV1,"replicaId"|"publicKey">,parent?:string|null):PersonalMemberV1;
export function members(binding:PersonalBindingV1|import("./contracts-v2").PersonalBindingV2,records:PersonalMemberV1[]):Map<string,string>;
