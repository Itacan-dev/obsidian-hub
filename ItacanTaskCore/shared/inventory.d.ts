import type {ExternalReservations} from "../src/recurrence";
import type {PhaseRef,WorkspaceRef} from "../src/contracts";
export interface GitReservationWitnessV2 {version:2;authorityId:string;revision:string;ids:readonly string[];phasePin:string}
export interface GitInventoryEvidenceV1 {version:1;authorityId:string;owner:WorkspaceRef;inventory:ExternalReservations;phases:{version:1;revision:string;values:readonly PhaseRef[]}}
export interface GitInventoryEvidencePortV1 {read():Promise<GitInventoryEvidenceV1>}
export function capture(authorityId:string,source:ExternalReservations,phases:GitInventoryEvidenceV1["phases"]):GitReservationWitnessV2;
export function validate(value:ExternalReservations|GitReservationWitnessV2,authorityId?:string):ExternalReservations|GitReservationWitnessV2;
export function contains(value:ExternalReservations|GitReservationWitnessV2,id:string):boolean;
