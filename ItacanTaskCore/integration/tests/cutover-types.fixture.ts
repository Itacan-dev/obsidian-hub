import { createNativeRepositoryHost, type NativeAuthorityConfigV1, type OwnerRegistryPortV1 } from "../../host";
declare const registry: OwnerRegistryPortV1;
const config: NativeAuthorityConfigV1 = {version:1,scope:"device-private-project",storageFormat:"private-v4",authorityId:"70927a62-591c-4df9-81a1-27585c903563",directory:"C:/private/repository",applicationContextId:"context",registryId:"registry",binding:{version:1,vaultRoot:"C:/vault",vaultId:"0123456789abcdef",deviceId:"existing-device",projectId:"70927a62-591c-4df9-81a1-27585c903563",localDataRoot:"C:/local"}};
const host = createNativeRepositoryHost(config, {registry});
void host.create({version:2,authorityId:config.authorityId,partitions:[{id:"private",owner:{type:"project",id:config.binding!.projectId},kind:"private-project"}],reason:"Reviewed cutover",verifiedCutover:true,taskMutationVersion:1});
void host.open({version:1,expectedAuthorityId:config.authorityId,verifiedCutover:true});
// @ts-expect-error no unversioned generic activation flag
void host.open({version:1,expectedAuthorityId:config.authorityId,activate:true});
// @ts-expect-error unsupported atomic capability
void host.create({version:2,authorityId:config.authorityId,partitions:[],reason:"invalid",verifiedCutover:true,taskMutationVersion:2});
