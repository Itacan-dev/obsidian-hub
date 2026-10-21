export * from "./contracts";
import type {ApplicationConfigV1,TransactionalApplicationStoreV1} from "./contracts";
export function createTransactionalApplicationStore(config:ApplicationConfigV1):TransactionalApplicationStoreV1;
