import type { Command, NativeTask, StepDraft, SourceEnvelope } from "../src/contracts";
import { captureSourceEnvelope, originalBytes, currentSearchProjection } from "../src/contracts";
declare const task: NativeTask, envelope: SourceEnvelope;
const step: StepDraft = { state: "new", id: "20000000-0000-4000-8000-000000000201", parentStepId: null, order: 0, title: "New", body: "Explicit content", completed: false };
const command: Command = { type: "task.editStructure", taskId: task.id, expectedRevision: task.revision, operationId: "edit-once", payload: { version: 1, draft: { version: 1, taskId: task.id, expectedRevision: task.revision, steps: [step] }, deletions: [], taskPatch: { description: "Explicit description" }, content: { version: 1, expectedRevision: 0, appendOriginals: [envelope], continuation: "Current continuation" } } };
// @ts-expect-error Parent field is explicit, not an implicit root append.
const ambiguous: StepDraft = { state: "new", id: "id", order: 0, title: "Text", body: "", completed: false };
// @ts-expect-error New structural Steps cannot synthesize completion events.
const completed: StepDraft = { ...step, state: "new", completed: true };
// @ts-expect-error This command does not change date policy or recurrence.
const badPatch: Command = { ...command, payload: { ...command.payload, taskPatch: { start: null } } };
const bytes: Uint8Array = originalBytes(envelope);
const capture = captureSourceEnvelope(bytes, { id: "capture", version: 1, parserVersion: 1, source: envelope.source, target: envelope.target, line: 0, expectedRange: null, metadata: null, explicitDescription: null });
const current = currentSearchProjection(task, task.owner);
// @ts-expect-error Current Search specimen exposes no private source provenance.
current.originals;
void [ambiguous, completed, badPatch, capture];
