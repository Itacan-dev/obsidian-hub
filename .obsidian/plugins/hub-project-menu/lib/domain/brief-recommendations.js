"use strict";

/** @typedef {{title:string, explanation:string, actionLabel:string, secondaryLabel?:string, target: import('./daily-brief').BriefTarget, reason:string}} BriefRecommendation */
/** @typedef {{getRecommendation(context: import('./daily-brief').DailyBriefContext): BriefRecommendation|null|Promise<BriefRecommendation|null>}} BriefRecommendationProvider */

// A future Athena provider can consume the same facts; the modal only sees this contract.
class RulesRecommendationProvider {
    getRecommendation(context) {
        if (!context.lastWorkDate) return null;
        const completed = context.workspaces.flatMap(workspace => workspace.taskProgress).find(event =>
            event.kind !== "step" && !context.relevantTasks.some(task => !task.completed &&
                (event.hubTaskId ? task.hubTaskId === event.hubTaskId : task.path === event.path && task.text === event.text)));
        for (const workspace of context.workspaces) {
            const focus = workspace.nextFocus.find(item => item.available && item.target);
            if (!focus) continue;
            const continuing = workspace.continuations.some(({ task }) => focus.target.taskId
                ? focus.target.taskId === task.hubTaskId
                : focus.target.path === task.path && focus.target.taskText === task.text);
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
                target: { kind: "file", workspaceId: workspace.workspaceId, path: task.path, taskText: task.text, taskLine: task.line,
                    ...(nextStep ? { stepText: nextStep.text } : {}),
                    ...(task.hubTaskId ? { taskId: task.hubTaskId } : {}), ...(nextStep?.hubTaskId ? { stepId: nextStep.hubTaskId } : {}) },
                continuation: true, reason: "unfinished-progress" };
        }
        return { title: "Today's tasks", explanation: "There isn't a clear next action from your recent work.",
            actionLabel: context.oathState?.active ? "View Oath tasks" : "View today's tasks",
            target: context.fallbackTarget, reason: "no-clear-action" };
    }
}
module.exports = { RulesRecommendationProvider };
