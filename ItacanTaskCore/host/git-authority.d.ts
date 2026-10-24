export interface GitAuthorityBindingV1 {version:1;vaultRoot:string;vaultId:string;deviceId:string;localDataRoot:string;projectId:string;projectRoot:string;dashboard:string;namespaceDigest:string}
export function repositoryPath(binding:GitAuthorityBindingV1):string;
export function validateBinding(binding:GitAuthorityBindingV1,directory:string):Promise<import("../shared/project-binding").AcceptedGitProjectV1>;
