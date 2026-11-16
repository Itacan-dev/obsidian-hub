"use strict";

/** @typedef {{title:string, explanation:string, actionLabel:string, secondaryLabel?:string, target: import('./daily-brief').BriefTarget, reason:string}} BriefRecommendation */
/** @typedef {{getRecommendation(context: import('./daily-brief').DailyBriefContext): BriefRecommendation|null|Promise<BriefRecommendation|null>}} BriefRecommendationProvider */

const { matchesProgress } = require("./daily-brief");

// A future Athena provider can consume the same facts; the modal only sees this contract.
class RulesRecommendationProvider {
    getRecommendation(context) {
        if (!context.lastWorkDate) return null;
        if (context.planRecommendation) return context.planRecommendation;
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
