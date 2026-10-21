/** Internal portable participant contract. Opaque values are instance-bound at runtime. */
export interface CommandAdmissionGateV1 {readonly version:1;readonly __gate:unique symbol}
export interface CommandAdmissionTicketV1 {readonly version:1;readonly __ticket:unique symbol}
export function createGate(hooks:{authorityId?:string;admit(request:unknown,authorization:unknown,state:unknown):void|Promise<void>;fresh(request:unknown,authorization:unknown,state:unknown):void|Promise<void>;candidate(request:unknown,state:unknown,prior:unknown):void|Promise<void>}):{readonly gate:CommandAdmissionGateV1;start(creating:boolean):void;finish():void;issue(command:unknown,request:unknown,authorization:unknown):CommandAdmissionTicketV1};
