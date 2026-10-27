import type {PersonalContextV1,PersonalPacketV1,SignedPersonalV1} from "./contracts";
export interface PersonalTransportV1 {
 publish(packet:PersonalPacketV1):Promise<{version:1;state:"locally-published";head:string|null;declaration:string}>;
 read():Promise<{version:1;packets:PersonalPacketV1[];waiting:{file:string;code:string}[];invalid:{file:string;code:string}[];aliases:{file:string;digest:string}[];acknowledgements:SignedPersonalV1<{head:string|null}>[]}>;
 acknowledge(head:string|null,application:{operationId:string;repositoryRevision:number;revisionId:string}):Promise<string>;
 assertPrivacy():Promise<void>;
 capacity():Promise<{objects:number;heads:number;acknowledgements:number;bytes:number;recordLimit:1024;byteLimit:number}>;
 readonly paths:{root:string;space:string;owner:string};
}
export function createOneDriveTransport(options:PersonalContextV1 & {vaultRoot:string}):Promise<PersonalTransportV1>;

export interface PersonalTransportV2 extends Omit<PersonalTransportV1,"publish"|"read"> {publish(packet:import("./contracts-v2").PersonalPacketV2):Promise<{version:1;state:"locally-published";head:string|null;declaration:string}>;read():Promise<{version:1;packets:import("./contracts-v2").PersonalPacketV2[];waiting:{file:string;code:string}[];invalid:{file:string;code:string}[];aliases:{file:string;digest:string}[];acknowledgements:SignedPersonalV1<{head:string|null}>[]}>}
export function createOneDriveTransport(options:import("./contracts-v2").PersonalContextV2&{vaultRoot:string}):Promise<PersonalTransportV2>;
