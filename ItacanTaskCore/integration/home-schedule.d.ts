import type {WorkspaceRef} from "../src/contracts";
import type {NativeProjectTaskV1} from "./project-runtime";
export interface NativeHomeContextV1 {owner:WorkspaceRef;root:string;dashboard:string;status:string}
export interface HomeOwnerV1 {projectId:string;root:string;path:string;status?:string;contextKind?:string;resourceType?:string;deleted?:boolean}
export interface HomeItemV1 {task:NativeProjectTaskV1|{homePhysicalOwner?:WorkspaceRef|null};owner:HomeOwnerV1;phaseLabel?:string|null}
export function taskKey(task:NativeProjectTaskV1):string;
export function homeOwner(context:NativeHomeContextV1,resolve:(owner:WorkspaceRef)=>HomeOwnerV1|undefined):HomeOwnerV1;
export function mergeHome(legacy:readonly HomeItemV1[],native:readonly NativeProjectTaskV1[],owner:WorkspaceRef,context:NativeHomeContextV1,resolve:(owner:WorkspaceRef)=>HomeOwnerV1|undefined):HomeItemV1[];
