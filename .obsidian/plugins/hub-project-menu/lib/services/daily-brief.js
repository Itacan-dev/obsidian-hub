"use strict";
const { buildDailyBriefContext, dailyBriefDay, dailyBriefStart, dailyBriefSnapshot, briefFromSnapshot } = require("../domain/daily-brief");
const { RulesRecommendationProvider } = require("../domain/brief-recommendations");
const { DailyBriefTrigger } = require("./daily-brief-trigger");
const { DailyBriefModal } = require("../ui/daily-brief");
const { DailyReportModal } = require("../ui/daily-report");
const { reportDay } = require("../domain/report-context");
const { taskIsFuture } = require("../domain/task-planning");
const { TaskReadSession } = require("./task-read-session");
const { legacyReadTask } = require("./task-service-legacy-bridge");

class DailyBriefService {
    constructor(plugin, { provider = new RulesRecommendationProvider(), now = () => new Date() } = {}) {
        this.plugin = plugin; this.app = plugin.app; this.provider = provider; this.now = now; this.disposed = false;
        this.listeners = new Set(); this.manualOpening = false; this.resolving = null;
        this.availabilityGeneration = 0; this.readSession = null;
        this.trigger = new DailyBriefTrigger({ now, ready: () => this.ready(), blocked: () => this.manualOpening || this.blocked(),
            shownDay: () => plugin.projectWizard.data.lastDailyBriefAutoShownDay,
            load: date => this.load(date), open: brief => this.open(brief), persist: day => this.persistShown(day) });
    }
    ready() { return !!this.started && this.plugin.oath.ready() && !this.plugin.dataStore.loadWarning; }
    oathBlocked() {
        const oath = this.plugin.oath;
        return oath.active || oath.current?.state === "scheduled" && oath.current.scheduledAt <= this.now().getTime();
    }
    blocked() { return this.oathBlocked() || !!document.querySelector(".modal-container"); }
    onChange(callback) { this.listeners.add(callback); return () => this.listeners.delete(callback); }
    emit() { for (const callback of this.listeners) {
        try { Promise.resolve(callback()).catch(error => console.error("Daily Brief listener failed", error)); }
        catch (error) { console.error("Daily Brief listener failed", error); }
    } }
    reader() {
        if (!this.readSession) this.readSession = new TaskReadSession(this.plugin.taskService, () => {
            if (!this.disposed && this.started) { void this.refreshAvailability(); void this.trigger.resume(); }
        });
        return this.readSession;
    }
    snapshot(now = this.now()) {
        const value = this.plugin.projectWizard.data.dailyBriefSnapshot;
        return value?.version === 1 && value.dayKey === dailyBriefDay(now) && Array.isArray(value.days) ? value : null;
    }
    availability() {
        if (this.disposed || !this.ready()) return { available: false, reason: "Waiting for task history to load." };
        if (this.oathBlocked()) return { available: false, reason: "Unavailable during an active Oath." };
        if (this.manualOpening) return { available: false, reason: "Opening today's brief." };
        const snapshot = this.snapshot(), useful = snapshot ? snapshot.days.length :
            this.historyDay === dailyBriefDay(this.now()) && this.hasHistory;
        return { available: !!useful, reason: useful ? "" : "No meaningful work recorded before this Itacan day." };
    }
    async refreshAvailability() {
        if (this.disposed) return;
        const generation = ++this.availabilityGeneration, day = dailyBriefDay(this.now());
        if (this.ready() && !this.oathBlocked() && !this.snapshot()) {
            try {
                const context = await this.context();
                if (this.disposed || generation !== this.availabilityGeneration || day !== dailyBriefDay(this.now()) || !this.ready() || this.oathBlocked()) return;
                this.hasHistory = !!context?.lastWorkDate; this.historyDay = day;
            } catch (error) {
                if (this.disposed || generation !== this.availabilityGeneration) return;
                this.hasHistory = false; console.error("Daily Brief availability could not be read", error);
            }
        }
        this.emit();
    }
    async openManual() {
        if (this.modal) { this.modal.contentEl.querySelector("h2")?.focus(); return true; }
        if (this.disposed || this.manualOpening || !this.ready() || this.blocked()) return false;
        this.manualOpening = true; this.emit();
        try {
            const brief = await this.load(this.now());
            return !!brief && this.open(brief);
        } catch (error) {
            console.error("Daily Brief could not be opened", error);
            new (require("obsidian").Notice)("The Daily Brief could not be saved or opened. Please try again.");
            return false;
        } finally { this.manualOpening = false; this.refreshAvailability(); }
    }
    async persistSnapshot(snapshot, current = () => true) {
        // Let an already-saving wizard update publish its data before taking our copy.
        await this.plugin.dataStore.writeQueue?.catch(() => {});
        if (!current()) return false;
        const data = this.plugin.projectWizard.data, previous = data.dailyBriefSnapshot;
        data.dailyBriefSnapshot = snapshot;
        try {
            await this.plugin.dataStore.save(data);
            // Another normal store writer may have replaced the wizard object while saving.
            this.plugin.projectWizard.data.dailyBriefSnapshot = snapshot;
        }
        catch (error) {
            if (data.dailyBriefSnapshot === snapshot) {
                if (previous === undefined) delete data.dailyBriefSnapshot;
                else data.dailyBriefSnapshot = previous;
            }
            throw error;
        }
    }
    async persistShown(day) {
        const data = this.plugin.projectWizard.data, previous = data.lastDailyBriefAutoShownDay;
        data.lastDailyBriefAutoShownDay = day;
        try { await this.plugin.dataStore.save(data); }
        catch (error) {
            if (previous === undefined) delete data.lastDailyBriefAutoShownDay;
            else data.lastDailyBriefAutoShownDay = previous;
            throw error;
        }
    }
    start() {
        if (this.disposed || this.started) return;
        this.started = true;
        const foreground = () => {
            if (!document.hidden && document.hasFocus()) { this.refreshAvailability(); void this.trigger.activate(); }
            else this.trigger.background();
        };
        this.plugin.registerDomEvent(window, "focus", foreground);
        this.plugin.registerDomEvent(window, "blur", () => this.trigger.background());
        this.plugin.registerDomEvent(document, "visibilitychange", foreground);
        this.reader();
        this.stopNative = this.plugin.nativeTaskHost?.completionFeed.subscribe(() => { if (!this.disposed) { void this.refreshAvailability(); void this.trigger.resume(); } });
        this.stopOath = this.plugin.oath.onChange(() => {
            this.readSession?.invalidate(); this.availabilityGeneration++;
            if (this.oathBlocked()) this.modal?.close();
            this.refreshAvailability();
        });
        this.refreshAvailability();
        foreground();
    }
    resolvePath(path) {
        if (!path) return null;
        const current = this.plugin.taskData.currentPath(path);
        return this.app.vault.getAbstractFileByPath(current)?.extension === "md" ? current : null;
    }
    workspace(id) {
        const wizard = this.plugin.projectWizard;
        return id?.startsWith("resource:") ? wizard.getResourceById(id.slice(9)) : wizard.getProjectById(id);
    }
    eligible(workspace) {
        return !!workspace && !!this.resolvePath(workspace.path) &&
            (workspace.contextKind === "resource" || workspace.status === "active");
    }
    async context(now = this.now()) {
        if (this.disposed) return null;
        const query = await this.reader().read({ validation: "source" }, () => this.disposed);
        if (!query || this.disposed) return null;
        if (query.diagnostics.length) console.warn("Daily Brief task-read diagnostics", query.diagnostics);
        const { projectWizard: wizard, oath } = this.plugin;
        const workspaceId = workspace => workspace?.contextKind === "resource" ? `resource:${workspace.resourceType}` : workspace?.projectId;
        const workspaces = [...wizard.getProjectRecords(), ...wizard.getResourceTypes()].map(workspace => ({
            workspaceId: workspaceId(workspace), name: workspace.name ?? workspace.label, path: workspace.path,
            type: workspace.contextKind, status: workspace.status, available: this.eligible(workspace) }));
        const tasks = query.rows.filter(row => row.view?.legacy)
            .map(row => ({ ...legacyReadTask(row.view), identityConflict: row.state !== "validated" || row.view.validation !== "source-checked",
                workspaceId: row.view.owner?.type === "resource" ? `resource:${row.view.owner.id}` : row.view.owner?.id }));
        let evidenceWizard = wizard;
        if (this.plugin.nativeTaskHost) {
            const host = this.plugin.nativeTaskHost, completion = await host.completionFeed.read();
            evidenceWizard = { ...wizard, completedTaskHistory: completion.records, taskProgressEvidence: undefined, getProgressReports: wizard.getProgressReports.bind(wizard) };
            for (const owner of host.nativeTasks.owners ?? [host.nativeTasks.owner]) {
                const runtime = host.runtime(owner), current = await runtime.list();
                tasks.push(...current.tasks.map(task => ({ ...task, workspaceId: owner.type === "resource" ? "resource:" + owner.id : owner.id })));
            }
        }
        const workingConfigurations = workspaces.map(workspace => this.plugin.workspaceModes?.navigationHistory?.configurationAt(
            workspace.workspaceId, dailyBriefStart(now).getTime())).filter(Boolean);
        return buildDailyBriefContext(evidenceWizard, { now, workspaces, tasks, workingConfigurations,
            resolvePath: path => this.resolvePath(path),
            canOpenNative: owner => this.eligible(this.workspace(owner.type === "resource" ? "resource:" + owner.id : owner.id)) && !oath.active,
            canOpen: path => this.eligible(wizard.getContextForPath(path)) && oath.canOpen(path, false),
            resolveLink: (link, source) => this.resolvePath(this.app.metadataCache.getFirstLinkpathDest(link, source ?? "Home.md")?.path),
            oathState: { active: oath.active, workspaceId: workspaceId(oath.workspace), state: oath.current?.state ?? null } });
    }
    async load(now = this.now()) {
        if (!this.ready() || this.disposed) return null;
        // Wait for persistence as well as generation before exposing the artifact.
        if (this.resolving) { await this.resolving; return this.load(now); }
        const saved = this.snapshot(now);
        if (saved) return briefFromSnapshot(saved);
        this.resolving = (async () => {
            const activation = this.trigger.activation;
            while (!this.disposed) {
                const generation = this.reader().generation;
                const context = await this.context(now);
                if (!context) return null;
                if (generation !== this.reader().generation) continue;
                if (!context.lastWorkDate) return null;
                let recommendation = await this.provider.getRecommendation(context);
                if (recommendation?.continuation) {
                    const workspace = context.workspaces.find(item => item.workspaceId === recommendation.target.workspaceId);
                    const configuration = workspace?.workingConfiguration;
                    if (configuration) recommendation = { ...recommendation, target: {
                        kind: "configuration", workspaceId: workspace.workspaceId, configuration
                    } };
                    else if (recommendation.target.taskId || recommendation.target.taskText) {
                        // Progress knows the task storage location, not where work took place.
                        recommendation = { ...recommendation, target: { kind: "workspace", workspaceId: recommendation.target.workspaceId } };
                    }
                }
                if (generation !== this.reader().generation) continue;
                const current = () => !this.disposed && this.ready() && !this.oathBlocked() &&
                    activation === this.trigger.activation && generation === this.reader().generation && dailyBriefDay(this.now()) === context.briefDate;
                if (!current()) return null;
                const snapshot = dailyBriefSnapshot(context, recommendation);
                if (await this.persistSnapshot(snapshot, current) === false) return null;
                return briefFromSnapshot(snapshot);
            }
            return null;
        })();
        try { return await this.resolving; }
        finally { this.resolving = null; this.refreshAvailability(); }
    }
    open(brief) {
        if (this.disposed || this.blocked() || brief.context.briefDate !== dailyBriefDay(this.now())) return false;
        const modal = new DailyBriefModal(this.app, { ...brief,
            onAction: target => this.navigate(target), onReport: date => this.openReport(date),
            onClose: () => { if (this.modal === modal) this.modal = null; this.emit(); } });
        modal.open(); this.modal = modal; this.emit();
        return modal.contentEl.isConnected;
    }
    openReport(date) {
        if (this.plugin.oath.active) return;
        const wizard = this.plugin.projectWizard;
        const projects = reportDay(wizard, date), resources = reportDay(wizard, date, { kind: "resource" });
        const day = { ...projects, reports: [...projects.reports, ...resources.reports] };
        if (!day.reports.length) return;
        this.modal?.close();
        new DailyReportModal(this.app, { day, plugin: this.plugin, onEdit: () => this.plugin.openProgressEditor(date) }).open();
    }
    async validateTarget(target) {
        if (target?.kind === "home") return this.plugin.oath.active ? null : target;
        const workspace = this.workspace(target?.workspaceId);
        if (!this.eligible(workspace)) return null;
        if (target.kind === "workspace") return this.plugin.oath.canOpen(workspace, false)
            ? { ...target, path: workspace.path, workspace } : null;
        if (target.kind === "native-task") {
            try { const host = this.plugin.nativeTaskHost; if (!host?.matches(target.owner)) return null;
                const r = host.runtime(target.owner); if (r.info().authority.authorityId !== target.authorityId) return null;
                const task = (await r.list()).tasks.find(t => t.id === target.taskId);
                return task && !task.completed && !task.nativeReadOnly && (!target.stepId || task.steps.some(s => s.id === target.stepId && !s.completed)) && !this.plugin.oath.active ? { ...target, task, runtime: r } : null;
            } catch (_) { return null; }
        }
        let path = this.resolvePath(target.path);
        if (target.taskId || target.taskText) {
            if (!this.plugin.oath.ready()) return null;
            try {
                const current = await this.plugin.taskService.resolveSavedTarget({ ...target, path: path ?? target.path });
                if (this.disposed || current.validation !== "source-checked" || current.legacy?.kind !== "legacy-task-read") return null;
                path = this.resolvePath(current.legacy.path);
                if (!path || current.completed || taskIsFuture({ fromDate: current.start?.date, fromTime: current.start?.time }, this.now())) return null;
            } catch (_) { return null; }
        }
        if (!path || !this.plugin.oath.canOpen(path, false)) return null;
        const owner = this.plugin.projectWizard.getContextForPath(path);
        if (!this.eligible(owner)) return null;
        return { ...target, path };
    }
    historicalPath(path, since) {
        if (!path) return path;
        // Existing rename activity survives restarts; taskData handles in-session renames.
        for (const event of [...(this.plugin.projectWizard.activityLog ?? [])].sort((a, b) => a.timestamp - b.timestamp)) {
            if (event.timestamp < (since ?? 0) || !["renamed", "project-renamed"].includes(event.action) || !event.oldPath || !event.path) continue;
            if (path === event.oldPath || path.startsWith(event.oldPath + "/")) path = event.path + path.slice(event.oldPath.length);
        }
        return this.plugin.taskData.currentPath(path);
    }
    async navigateConfiguration(target) {
        const workspace = this.workspace(target.workspaceId), modes = this.plugin.workspaceModes;
        if (!this.eligible(workspace) || !this.plugin.oath.canOpen(workspace, false)) return this.navigate(null);
        this.modal?.close();
        try {
            if (await this.plugin.presets.restoreSnapshot(target.configuration, null, {
                allowActivation: false,
                resolvePath: path => this.historicalPath(path, target.configuration.capturedAt)
            })) return true;
        } catch (error) { console.warn("[Hub Daily Brief] Configuration could not be restored.", error); }
        // Only after the entire historical layout is unavailable, use another
        // existing Last File destination from the same workspace, then Full-view.
        const alternate = modes.navigationHistory?.resolveFile?.(workspace.projectId);
        if (alternate && this.eligible(workspace) && this.plugin.oath.canOpen(workspace, false)) {
            try {
                const restored = alternate.layout ? await modes.enqueue(() => modes.restoreNoteLayout(workspace, alternate.layout))
                    : alternate.file ? await modes.openProjectNote(alternate.file.path) : false;
                if (restored !== false) return true;
            } catch (_) { /* Full-view remains available below */ }
        }
        // A wholly unavailable configuration stays within its historical workspace.
        if (this.eligible(workspace) && this.plugin.oath.canOpen(workspace, false)) {
            try { if (await modes.openProjectFull(workspace) !== false) return true; } catch (_) { /* existing safe fallback below */ }
        }
        return this.navigate(null);
    }
    async navigate(requested) {
        if (requested?.kind === "configuration") return this.navigateConfiguration(requested);
        let target = await this.validateTarget(requested);
        if (!target) {
            const oath = this.plugin.oath;
            const workspace = oath.active ? oath.workspace : null;
            target = oath.active ? this.eligible(workspace) ? { kind: "workspace", workspace } : null : { kind: "home" };
        }
        if (!target) return false;
        const modes = this.plugin.workspaceModes;
        this.modal?.close();
        let result;
        try {
            result = target.kind === "native-task" ? (require("../ui/task-editor").openTaskEditor(target.runtime.formService(this.app), target.task), true) : target.kind === "home" ? await modes.openHome() : target.kind === "workspace"
                ? await modes.openProjectFull(target.workspace ?? this.workspace(target.workspaceId))
                : await modes.openProjectNote(target.path);
        } catch (error) {
            console.warn("[Hub Daily Brief] Target could not be opened; using the current task surface.", error);
            result = false;
        }
        if (result === false) {
            if (this.plugin.oath.active) await this.plugin.oath.enterWorkspace();
            else await modes.openHome();
        }
        if (target.kind === "home") document.querySelector(".home-dashboard .home-upcoming")?.scrollIntoView({ block: "center" });
        return true;
    }
    destroy() { this.disposed = true; this.availabilityGeneration++; this.readSession?.close(); this.trigger.destroy(); this.stopOath?.(); this.stopNative?.(); this.modal?.close(); this.listeners.clear(); }
}
module.exports = { DailyBriefService };
