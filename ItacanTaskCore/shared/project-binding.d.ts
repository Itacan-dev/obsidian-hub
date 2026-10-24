import type {GitGenesisV1} from "../src/git-shared";
export interface GitProjectBindingV1 {format:"itacan-native-git-project";version:1;projectId:string;projectRoot:string;authorityId:string;genesis:GitGenesisV1;protocol:{packet:3;originFrame:2;reservationWitness:2,transport:3}}
export interface GitProjectInputV1 {vaultRoot:string;projectId:string;projectRoot:string;dashboard:string}
export interface AcceptedGitProjectV1 extends GitProjectInputV1 {gitRoot:string;binding:GitProjectBindingV1;namespaceFile:string;namespaceDigest:string}
export function authorityId(projectId:string):string;
export function namespacePath(projectId:string):string;
export function validateBinding(value:GitProjectBindingV1):GitProjectBindingV1;
export function inspectProject(input:GitProjectInputV1):Promise<GitProjectInputV1 & {gitRoot:string}>;
export function admitProject(input:GitProjectInputV1):Promise<AcceptedGitProjectV1>;
