"use strict";
window.onload = async () => { try {
    const source = await (await fetch("task-panel-browser.js")).text();
    const setup = source.slice(source.indexOf("    const input ="), source.indexOf("    const deferred ="));
    const env = await new (Object.getPrototypeOf(async function() {}).constructor)(setup + ";await prepare('ui/planning-editor');await prepare('ui/project-roadmap');await prepare('services/project-planning');return {plugin,load,prepare,sources,dv,input,files,contents,pages,metadataCache,index,cleanup};")();
    const { plugin, load, prepare, sources, dv, input } = env;
    sources["ui/planning-editor-original"] = await (await fetch("phase-read-editor-original.cjs")).text();
    sources["services/project-planning-original"] = await (await fetch("phase-read-planning-original.cjs")).text();
    class Picker extends Modal {
        constructor(app) { super(app); this.inputEl = this.contentEl.createEl("input", { attr: { "aria-label": "Search tasks" } });
            this.resultContainerEl = this.contentEl.createDiv({ cls: "suggestion-container" }); this.index = 0;
            const picker = this; this.chooser = { get selectedItem() { return picker.index; }, setSelectedItem: index => { this.index = index; } }; }
        onOpen() { this.inputEl.addEventListener("input", () => this.updateSuggestions()); this.inputEl.addEventListener("keydown", event => {
            if (event.key === "ArrowDown") { event.preventDefault(); this.index = Math.min(this.index + 1, this.items.length - 1); }
            if (event.key === "Enter" && this.items[this.index]) { event.preventDefault(); this.onChooseItem(this.items[this.index]); this.close(); }
        }); this.updateSuggestions(); this.inputEl.focus(); }
        getSuggestions(query) { return this.getItems().filter(item => this.getItemText(item).toLowerCase().includes(query.toLowerCase())).map(item => ({ item })); }
        updateSuggestions() { this.items = this.getSuggestions(this.inputEl.value).map(value => value.item); this.resultContainerEl.empty();
            for (const item of this.items) this.resultContainerEl.createEl("button", { text: this.getItemText(item) }).onclick = () => { this.onChooseItem(item); this.close(); }; }
    }
    obsidian.FuzzySuggestModal = Picker;
    const data = plugin.projectWizard.data; data.projectPlanning = {};
    const projects = input.workspaces.filter(owner => owner.contextKind === "project");
    for (const owner of projects) data.projectPlanning[owner.projectId] = { revision: 3, phases: [
        { id: owner.projectId === "app" ? "phase" : "phase-" + owner.projectId, name: "Research", start: "2026-10-01", end: "2026-11-01", description: "Existing description", order: 0 },
        { id: "other-" + owner.projectId, name: "Review", start: "2026-11-01", end: "2026-12-01", description: "", order: 1 }
    ], milestones: [{ id: "milestone-" + owner.projectId, name: "Launch", date: "2026-11-10", achieved: false }] };
    data.taskMetadata.timed.phaseId = "phase"; data.taskMetadata.rich.phaseId = "phase"; data.taskMetadata.due.phaseId = "other-app";
    for (const owner of projects.slice(1)) (data.taskMetadata["owner-" + owner.projectId] ??= {}).phaseId = "phase-" + owner.projectId;
    const Old = load("services/project-planning-original").ProjectPlanningService, Current = load("services/project-planning").ProjectPlanningService;
    const openOld = load("ui/planning-editor-original").openPlanningEditor, openCurrent = load("ui/planning-editor").openPlanningEditor;
    const captures = [], checks = [];
    const screenshot = name => new Promise(resolve => { window.hubTestScreenshotDone = resolve; window.hubTestScreenshotRequest = name; });
    function check(ok, text) { assert(ok, text); checks.push(text); }
    function snapshot(root) { const origin = root.getBoundingClientRect(); return [...root.querySelectorAll("*")].map(el => ({ tag: el.tagName,
        cls: typeof el.className === "string" ? el.className : "svg", text: el.children.length ? null : el.textContent,
        label: el.getAttribute("aria-label"), value: el.matches("input,textarea") ? el.value : null,
        rect: [el.getBoundingClientRect().x - origin.x, el.getBoundingClientRect().y - origin.y, el.getBoundingClientRect().width, el.getBoundingClientRect().height].map(value => +value.toFixed(2)) })); }
    for (const owner of projects) {
        const old = new Old(plugin), value = old.phases(owner.projectId)[0]; plugin.planning = old;
        const modal = openOld(old, owner.projectId, "phases", value, dv); await settle(); const before = snapshot(modal.modalEl);
        await screenshot("phase-read-original-" + owner.projectId);
        [...modal.contentEl.querySelectorAll("button")].find(button => button.textContent === "Add tasks").click(); await settle();
        const picker = window.lastModal, labels = picker.getItems().map(item => picker.getItemText(item)); picker.close(); modal.close();
        const service = new (window.phaseReadBaselineOnly ? Old : Current)(plugin); plugin.planning = service;
        const next = (window.phaseReadBaselineOnly ? openOld : openCurrent)(service, owner.projectId, "phases", value, dv); await settle();
        const after = snapshot(next.modalEl), difference = before.findIndex((item, index) => JSON.stringify(item) !== JSON.stringify(after[index]));
        check(JSON.stringify(after) === JSON.stringify(before), owner.name + " exact original/current Phase modal DOM/layout: " + (difference < 0 ? "" : JSON.stringify({ index: difference, before: before[difference], after: after[difference], sizes: [before.length, after.length] })));
        await screenshot("phase-read-candidate-" + owner.projectId);
        [...next.contentEl.querySelectorAll("button")].find(button => button.textContent === "Add tasks").click(); await settle();
        const nextPicker = window.lastModal; check(JSON.stringify(nextPicker.getItems().map(item => nextPicker.getItemText(item))) === JSON.stringify(labels), owner.name + " exact original picker identities/order/labels");
        captures.push({ owner: owner.projectId, modal: before, labels }); nextPicker.close(); next.close();
    }
    if (!window.phaseReadBaselineOnly) {
        const oldPlanning = plugin.planning = new Old(plugin), milestone = oldPlanning.read("app").milestones[0];
        const oldModal = openOld(oldPlanning, "app", "milestones", milestone, dv); await settle(); const oldMilestone = snapshot(oldModal.modalEl); oldModal.close();
        const currentPlanning = plugin.planning = new Current(plugin), nextModal = openCurrent(currentPlanning, "app", "milestones", milestone, dv); await settle();
        check(JSON.stringify(snapshot(nextModal.modalEl)) === JSON.stringify(oldMilestone), "Milestone editor DOM/layout remains unchanged"); nextModal.close();
        const owner = projects[0], host = document.getElementById("fixture"), old = plugin.planning = new Old(plugin), component = new Component();
        const road = load("ui/project-roadmap").mountProjectRoadmap;
        road({ plugin, component, dv, host, workspace: owner, state: {} }); await settle(); const before = snapshot(host);
        component.unload(); host.empty(); plugin.planning = new Current(plugin); const next = new Component();
        road({ plugin, component: next, dv, host, workspace: owner, state: {} }); await settle();
        check(JSON.stringify(snapshot(host)) === JSON.stringify(before), "Actual Roadmap Phase/Milestone geometry and DOM remain identical");
        const html = host.innerHTML; await plugin.planning.tasks(dv, owner.projectId); await settle(); check(host.innerHTML === html, "Candidate reads do not redraw Roadmap");
        captures.push({ roadmap: before }); next.unload(); host.empty();
    }
    if (!window.phaseReadBaselineOnly && window.runPhaseReadInteractions) await window.runPhaseReadInteractions({ ...env, Current, openCurrent, check, settle, snapshot, Component });
    window.hubTaskOpeningFrames = { captures, checks };
    await plugin.taskService.close(); plugin.taskData.destroy();
    document.getElementById("result").textContent = "PASS: " + checks.length + " actual Phase editor/picker parity and safety checks";
} catch (error) { document.getElementById("result").textContent = "FAIL: " + error.stack; } };
