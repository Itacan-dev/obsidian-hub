"use strict";

/** @typedef {{title:string, explanation:string, actionLabel:string, secondaryLabel?:string, target: import('./daily-brief').BriefTarget, reason:string}} BriefRecommendation */
/** @typedef {{getRecommendation(context: import('./daily-brief').DailyBriefContext): BriefRecommendation|null|Promise<BriefRecommendation|null>}} BriefRecommendationProvider */

const { matchesProgress } = require("./daily-brief");

// A future Athena provider can consume the same facts; the modal only sees this contract.
class RulesRecommendationProvider {
    getRecommendation(context) {
        if (!context.lastWorkDate) return null;
        const completed = context.workspaces.flatMap(workspace => workspace.taskProgress).find(event =>
            event.kind !== "step" && !context.relevantTasks.some(task => !task.completed &&
                matchesProgress(task, event)));
        for (const workspace of context.workspaces) {
            const focus = workspace.nextFocus.find(item => item.available && item.target);
            if (!focus) continue;
            const continuing = workspace.continuations.some(({ task }) => focus.target.kind === "native-task" && focus.target.taskId === task.id && focus.target.authorityId === task.nativeReference.authorityId);
            const transition = completed && !continuing;
            return { title: focus.text, explanation: transition
                ? `You completed ${completed.text}. Your next recorded focus is ${focus.text}.`
                : `${focus.text} was your recorded next focus.`,
                actionLabel: `${transition ? "Start" : "Continue"} ${focus.text}`, secondaryLabel: workspace.workspaceName,
                target: focus.target, continuation: !transition, reason: "recorded-focus" };
        }
        for (const workspace of context.workspaces) {
            const continuation = workspace.continuations[0];
            if (!continuation) continue;
            const { task, nextStep } = continuation;
            return { title: task.text, explanation: nextStep
                ? `${task.text} is unfinished. ${nextStep.text} is the next remaining step.`
                : `${task.text} is unfinished and received progress during your last work.`,
                actionLabel: `Continue ${task.text}`, secondaryLabel: workspace.workspaceName,
                target: { kind: "native-task", workspaceId: workspace.workspaceId, authorityId:task.nativeReference.authorityId,owner:task.nativeReference.owner,taskId:task.id,stepId:nextStep?.id??null },
                continuation: true, reason: "unfinished-progress" };
        }
        return { title: "Today's tasks", explanation: "There isn't a clear next action from your recent work.",
            actionLabel: context.oathState?.active ? "View Oath tasks" : "View today's tasks",
            target: context.fallbackTarget, reason: "no-clear-action" };
    }
}
module.exports = { RulesRecommendationProvider };
