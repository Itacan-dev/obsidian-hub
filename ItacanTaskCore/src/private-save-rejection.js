"use strict";
// Retrospective nonexecution is justified only by complete committed receipt
// coverage AND a task revision that permanently invalidates the original save.
// This is not a writer-outcome guess, a receipt, or a Git bootstrap proof.
const V = require("./value"), { check } = require("./errors"), M = require("../personal/membership");
function source(state) {
    require("./domain").validateState(state);
    check(!state.gitShared && !state.historyImport && !state.recurrence && state.schemaVersion === 1 && state.partitions.length === 1 && state.partitions[0].id === "private", "Private save proof requires an intact private authority.");
    check(!state.personalShared || state.personalShared.version === 2, "Unsupported personal proof scope.");
}
function taskAt(receipts, taskId, revision) {
    return receipts.filter(r => r.result.repositoryRevision <= revision).sort((a,b) => b.result.repositoryRevision-a.result.repositoryRevision).flatMap(r => r.result.tasks).find(t => t.id === taskId);
}
function prove(state, command, through = state.revision) {
    source(state); require("./commands").validateCommand(command);
    check(command.type === "task.save" && command.expectedRepositoryRevision >= 1 && command.expectedRepositoryRevision < through && through <= state.revision, "An older original task.save is required.");
    check(!state.receipts.some(r => r.operationId === command.operationId) && !state.personalShared?.frames.some(f => f.receipt.operationId === command.operationId), "Operation has contradictory receipt/origin evidence.");
    const receipts = state.receipts.filter(r => r.result.repositoryRevision <= through).sort((a,b) => a.result.repositoryRevision-b.result.repositoryRevision);
    check(receipts.length === through && receipts.every((r,i) => r.result.repositoryRevision === i+1), "Complete durable receipt coverage required.");
    const predecessor = receipts[command.expectedRepositoryRevision-1], last = receipts.at(-1), before = taskAt(receipts, command.taskId, command.expectedRepositoryRevision), after = taskAt(receipts, command.taskId, through), current = state.tasks.find(t => t.id === command.taskId);
    check(before && after && current && before.revision === command.expectedRevision && after.revision > command.expectedRevision && current.revision >= after.revision && before.partitionId === "private" && V.canonical(before.owner) === V.canonical(state.partitions[0].owner) && V.canonical(after.owner) === V.canonical(before.owner) && V.canonical(current.owner) === V.canonical(before.owner), "Original task guard is not conclusively superseded.");
    return { format:"itacan-private-save-nonexecution", version:1, authorityId:state.storeId, operationId:command.operationId, commandDigest:M.hash(command), taskId:command.taskId, expectedRepositoryRevision:command.expectedRepositoryRevision, expectedTaskRevision:command.expectedRevision, predecessorRevisionId:predecessor.result.revisionId, head:{repositoryRevision:through,revisionId:last.result.revisionId}, receiptCoverageDigest:M.hash(receipts), supersedingTaskRevision:after.revision, supersedingTaskDigest:M.hash(after) };
}
function verify(state, command, proof) {
    check(proof?.format === "itacan-private-save-nonexecution" && proof.version === 1 && V.canonical(prove(state,command,proof.head.repositoryRevision)) === V.canonical(proof), "Private save nonexecution evidence differs.");
    return proof;
}
module.exports = { prove, verify };
