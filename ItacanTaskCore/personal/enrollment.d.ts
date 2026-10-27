import type {PrivateSeedStateV1,SourceCapabilityV1,PersonalSignerV1,PersonalBindingV1,PersonalSeedV1,EnrollmentBodyV1} from "./contracts";
export function validateSource(state:PrivateSeedStateV1,capability:SourceCapabilityV1):PrivateSeedStateV1;
export function prepare(input:{spaceId:string;state:PrivateSeedStateV1;capability:SourceCapabilityV1;signer:PersonalSignerV1}):PersonalSeedV1;
export function validate(seed:PersonalSeedV1,binding:PersonalBindingV1|import("./contracts-v2").PersonalBindingV2):EnrollmentBodyV1;
