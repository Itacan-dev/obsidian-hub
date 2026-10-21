import { createJsonRepository, openJsonRepository, inspectJsonRepository } from "../src/json-repository";
import { makeBarrier, decodePrivateGeneration } from "../src/private-storage-codec";
import { validateState, type PartitionDefinition } from "../src/contracts";
declare const partitions: PartitionDefinition[];
const directory = "explicit-temp-directory", authority = "reviewed-uuid";
createJsonRepository({ directory, partitions });
createJsonRepository({ directory, partitions, storageFormat: "private-v4", storeId: authority });
openJsonRepository({ directory });
openJsonRepository({ directory, storageFormat: "private-v4", expectedAuthorityId: authority }).then(r => r.info().storage?.wireVersion);
inspectJsonRepository({ directory, expectedAuthorityId: authority, sourceFormat: "stopped-e2-flat-v1" }).then(r => {
    const readonly: false = r.writable;
    // @ts-expect-error Forensic evidence exposes no execution authority.
    r.execute({});
    void readonly;
});
const barrier = makeBarrier(authority, 1, null);
validateState(decodePrivateGeneration("encoded-private-json", authority).state);
// @ts-expect-error Dedicated creation requires an explicit authority.
createJsonRepository({ directory, partitions, storageFormat: "private-v4" });
// @ts-expect-error Dedicated opening requires the expected authority.
openJsonRepository({ directory, storageFormat: "private-v4" });
// @ts-expect-error Wire profiles cannot be inferred from an unsupported label.
openJsonRepository({ directory, storageFormat: "automatic" });
// @ts-expect-error Unsupported future logical versions are not accepted.
makeBarrier(authority, 5, null);
void barrier;
