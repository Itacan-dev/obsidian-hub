import {createTransactionalApplicationStore,type ApplicationRequestV1} from "../../services/application-storage";
const store=createTransactionalApplicationStore({version:1,scope:"inactive-disposable",directory:"temp",authorityId:"authority",applicationContextId:"context"});
void store.create({version:1,data:{folderUi:{}},allowedScopes:[{field:"folderUi",dependencies:[]}]});
declare const request:ApplicationRequestV1;void store.transact(request);void store.reconcile(request);
// @ts-expect-error no full snapshot writer
store.save({});
// @ts-expect-error excluded shared field
void store.readScopes({version:1,authorityId:"a",applicationContextId:"c",fields:["taskMetadata"]});
// @ts-expect-error no arbitrary callback transaction
void store.transact(()=>({}));
// @ts-expect-error no production profile
createTransactionalApplicationStore({version:1,scope:"production",directory:"vault",authorityId:"a",applicationContextId:"c"});
// @ts-expect-error deletion cannot carry replacement value
const change:ApplicationRequestV1["changes"][number]={field:"folderUi",expected:{present:false,digest:null},operation:"delete",value:{}};
