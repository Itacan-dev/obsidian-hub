import { type HistoryImportCommand, type TaskRepository, type ReviewedHistoryImportBundle, type ImportPins, HISTORY_IMPORT_COMMANDS } from "../src/contracts";
declare const repo: TaskRepository;
declare const bundle: ReviewedHistoryImportBundle;
declare const pins: ImportPins;
const command: HistoryImportCommand = { type: "history.prepareImport", operationId: "prepare", expectedRepositoryRevision: 0, payload: { version: 1, decisionRevision: "N1-E2-E01-E09-r1", planId: "uuid", publicationOperationId: "publish", bundle, bundleDigest: bundle.digest, pins, partitions: [], syntheticOnly: true, reason: "Reviewed synthetic evidence" } };
repo.execute(command).then(result => result.historyImport?.plan.groups.map(g => g.eventId));
repo.getHistoryImportPlan("uuid", { version: 1 });
const records = repo.historyCompatibility({ version: 1, projection: "statistics" }).records;
const version: 1 = HISTORY_IMPORT_COMMANDS.version;
// @ts-expect-error Import commands require repository revision.
const missing: HistoryImportCommand = { type: command.type, operationId: "missing", payload: command.payload };
// @ts-expect-error Import commands have no task-specific revision or task override.
const taskOverride: HistoryImportCommand = { ...command, taskId: "uuid", expectedRevision: 1 };
// @ts-expect-error Synthetic approval is explicit true.
const live: HistoryImportCommand = { ...command, payload: { ...command.payload, syntheticOnly: false } };
// @ts-expect-error Arbitrary event overrides are not an import input.
const override: HistoryImportCommand = { ...command, payload: { ...command.payload, events: [] } };
void [records, version, missing, taskOverride, live, override];
