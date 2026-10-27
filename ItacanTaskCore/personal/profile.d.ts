import type {PersonalBindingV1,PersonalSignerV1} from "./contracts";
import type {PersonalBindingV2,PersonalProfileBodyV2} from "./contracts-v2";
export const protocol:PersonalProfileBodyV2["protocol"];
export function base(binding:PersonalBindingV1|PersonalBindingV2):PersonalBindingV1;
export function validate(value:unknown):PersonalBindingV2;
export function create(binding:PersonalBindingV1,signer:PersonalSignerV1,cuts?:PersonalProfileBodyV2["legacyCuts"]):PersonalBindingV2;
