import type { Command, SourceSnapshot, IdentityRepository } from "../contracts";
import { createMemoryIdentity, MemoryIdentityStorage } from "../repository";
import { openDirectoryIdentity } from "../node-store";
declare const snapshot: SourceSnapshot, repo: IdentityRepository;
const command: Command = { version: 1, decisionRevision: "N1-B-D01-D02-D03-D17-D18-r1", type: "prepare", operationId: "prepare-1", expectedRevision: 0, payload: { planId: "plan-1", snapshot, publishOperationId: "publish-1" } };
repo.execute(command).then(result => { const imported: 0 = result.accounting.importedTasks; return imported; });
// @ts-expect-error Identity planning cannot execute task commands.
repo.execute({ ...command, type: "task.create" });
// @ts-expect-error Explicit synthetic plan-level approval is required.
repo.execute({ ...command, type: "approve", payload: { planId: "plan-1", snapshot, reviewer: "reviewer" } });
// @ts-expect-error No task authority/records are exposed by a planning snapshot.
repo.snapshot().tasks;
// @ts-expect-error No portable sharing interface exists.
repo.exportSharedPartition("itacan");
const storage = new MemoryIdentityStorage();
createMemoryIdentity({ storage, storeId: "10000000-0000-4000-8000-000000000001", registry: [{ owner: { type: "resource", id: "study" }, root: "Resources/Knowledge", shared: false }], registryRevision: "r1", idFactory: () => "10000000-0000-4000-8000-000000000002" });
openDirectoryIdentity({ directory: "explicit-disposable-path", idFactory: () => "10000000-0000-4000-8000-000000000002" });
