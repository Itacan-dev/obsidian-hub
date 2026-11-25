"use strict";
const { Component } = require("obsidian");
const { setHubIcon } = require("./icons");
const { mountPlanPresentation } = require("./plan-presentation");
const { mountFinishPlan } = require("./plan-finish");
const { mountPlanDelete } = require("./plan-delete");
const { planFeedback, showPlanFeedback } = require("./plan-feedback");

function mountPlanHome({ root, component, plugin }) {
    const plan = plugin.globalPlan;
    root.classList.add("hub-plan-home");
    const body = root.createDiv({ cls: "hub-plan-home-content" });
    const footer = root.createDiv({ cls: "hub-plan-home-footer" });
    const notice = root.createDiv({ cls: "hub-plan-preview-status", attr: { role: "status" } });
    let mounted, selection;

    function render() {
        const active = plan.active();
        const finished = plan.readPlan(plan.finishedPreviewPlanId);
        const record = active ?? (finished?.status === "finished" ? finished : null);
        root.classList.toggle("is-finished-plan", record?.status === "finished");
        const key = record ? record.id + ":" + record.status : "empty";
        if (selection !== key) {
            selection = key;
            mounted?.unload();
            mounted = new Component();
            mounted.load();
            body.empty();
            footer.empty();
            if (!record) body.createDiv({ cls: "hub-plan-empty", text: "No active Plan" });
            else {
                const tools = body.createDiv({ cls: "hub-plan-card-actions hub-plan-home-actions" });
                if (!active) {
                    const history = tools.createSpan({ cls: "hub-plan-status-icon is-finished", attr: { role: "img", "aria-label": "Finished Plan" } });
                    setHubIcon(history, "check");
                }
                mountPlanDelete(tools, mounted, plugin, record.id, () =>
                    root.closest(".home-panel")?.querySelector(".home-focus-edit")?.focus({ preventScroll: true }));
                mountPlanPresentation({
                root: body, component: mounted, plan: plan.bind(record.id), context: "home",
                interactive: !!active, emptyMessage: false, showStatus: false,
                noteAction: active ? host => {
                    const pencil = host.createEl("button", {
                        cls: "hub-button-plain hub-icon-action hub-plan-note-pencil",
                        attr: { type: "button", "aria-label": "Edit active Plan", title: "Edit active Plan" }
                    });
                    setHubIcon(pencil.createSpan({ cls: "hub-icon-action-glyph", attr: { "aria-hidden": "true" } }), "pencil");
                    pencil.onclick = () => require("./plan").openPlanner(plugin, { planId: record.id, returnFocus: pencil });
                } : undefined
                });
            }
            footer.hidden = !record;
            if (active) {
                mountFinishPlan({ root: footer, component: mounted, plugin, planId: active.id });
            } else if (record) {
                footer.createSpan({ cls: "hub-plan-finished-status", text: "Plan finished" });
                footer.createEl("button", { cls: "hub-button-plain hub-plan-hide", text: "Hide" }).onclick = () => plan.dismissHomePlan(record.id);
            }
        }
        showPlanFeedback(notice, planFeedback(plan));
    }

    plan.subscribe(component, render);
    component.register(() => mounted?.unload());
    render();
}
module.exports = { mountPlanHome };
