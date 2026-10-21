const { createWindowTitle, setWindowUndertext, layoutModal } = require("./lib/ui/window-title");
const { dispose: disposeCompletionAudio } = require("./lib/ui/completion-audio");
const { mountMusicControl } = require("./lib/ui/music");
const { mountSettingsControl } = require("./lib/ui/settings");
const { installAtlasIntegration } = require("./lib/atlas/obsidian/integration");
const { processTaskWrite, isTaskWrite } = require("./lib/services/task-writes");
const { DailyBriefService } = require("./lib/services/daily-brief");
const { mountDailyBriefControl } = require("./lib/ui/daily-brief-control");
const { HubInboxService } = require("./lib/services/inbox");
const { mountCaptureControls } = require("./lib/ui/capture-controls");
const ITACAN_DEVELOPMENT = process.env.ITACAN_DEVELOPMENT === "1";
const { StatisticsModal } = require("./lib/ui/statistics");
const { OathNavigationGuard } = require("./lib/services/oath-navigation");
const { createWorkspaceCards } = require("./lib/ui/workspace-cards");
/*
 * Source entry for the generated main.js plugin artifact.
 * Run build.js after changing this file or anything under lib/.
 */

const {
    Plugin,
    Menu,
    Notice,
    normalizePath,
    setIcon,
    Modal,
    Component,
    FuzzySuggestModal,
    TFile,
    TFolder
} = require("obsidian");

const { taskProgressMutation } = require("./lib/domain/task-progress");
const { queryHistory } = require("./lib/domain/history");
const { savedReportContext, reportDay } = require("./lib/domain/report-context");
const { mountTransientEffects } = require("./lib/ui/attention");
const { lockModalControls } = require("./lib/ui/modal-save");
const { trackTextFieldFocus } = require("./lib/ui/text-field-focus");
const { installWindowMinimum } = require("./lib/services/window-minimum");
const { hasKeyboardFocus, focusAfterRowRemoval } = require("./lib/ui/focus-restoration");
const { renderReportWorkspaceHeader } = require("./lib/ui/report-workspace-header");
const { reportTitle, DailyReportModal, renderReportEvidence, focusSection } = require("./lib/ui/daily-report");
const { ProjectDeletionModal } = require("./lib/ui/project-deletion");
const { createPreparedNoteRails, NOTE_RAIL_VIEW } = require("./lib/ui/prepared-note-rail");
const { progressRatingOptions } = require('./lib/config');
const { createImmediateHubTooltip } = require('./lib/ui/tooltips');
const { HubTaskEditor } = require('./lib/services/task-editor');
const { openTaskEditor, openTaskCreator } = require('./lib/ui/task-editor');
const { taskGroups, taskBlockEnd, insertTaskAtCursor, toggleTaskStep } = require('./lib/domain/task-planning');
const { HubOathService } = require('./lib/services/oath');
const { createOathFullscreen } = require('./lib/services/oath-fullscreen');
const { mountOathControl } = require('./lib/ui/oath');
const { HubWorkspaceState, emptyWorkspaceState } = require('./lib/services/workspace-state');
const { HubNavigationHistory } = require('./lib/services/navigation-history');
const { SHARED_PROJECT_ROOTS, SHARED_IMAGE_ROOT } = require('./lib/services/shared-projects');

const fs =
    require("fs");

const {
    spawn
} =
    require("child_process");

const {
    randomUUID
} =
    require("crypto");

const {
    APP_SHORTCUTS,
    applyTaskEdit,
    editTaskContent,
    mutateTaskContent,
    normalizedTaskText,
    CATEGORY_IMAGE_ROOT,
    DEFAULT_CATEGORIES,
    DEFAULT_SHORTCUT_IDS,
    FIREFOX_EXECUTABLES,
    HUB_BACKUP_ROOT,
    HUB_BACKUP_VERSION,
    HubDataStore,
    HubTaskDataService,
    HubPresets,
    HomeCovers,
    homeTimePeriod,
    openHomeCoverEditor,
    showPresetsMenu,
    ProjectDeletionGuard,
    isProjectDeletionCancelled,
    HubTransitionService,
    PROJECT_ADVANCEMENT_OPTIONS,
    PROJECT_COVER_ROOT,
    PROJECT_META_FOLDER,
    RESOURCE_ROOT,
    RESOURCE_TYPES,
    WIP_IMAGE_PATH,
    auditHubData,
    auditWorkspaceState,
    calculateHomeMomentum,
    completedTaskText,
    createFileDomain,
    createDashboardUi,
    selectNavigation,
    createTaskUi,
    createHubMarkdown,
    mountNoteRail,
    createCardImageRenderer,
    createCardImageCache,
    fileIcon,
    findProjectById,
    findProjectForPath,
    findResourceByReference,
    findResourceForPath,
    isProvisionalNoteTitle,
    isCompletedTaskLine,
    localISODate,
    normalizeFocusItems,
    normalizeShortcutIds,
    normalizeShortcutOrder,
    parseLocalISODate,
    projectFileTitleFromPath,
    publicResourceType,
    prepareNoteLayout,
    rewriteLayoutPaths,
    reduceActivityLog,
    replacePathRoot,
    shortDateLabel,
    formatDate,
    formatWeekday,
    setHubTooltip,
    watchHubTooltips,
    mountHeaderImage,
    slugify,
    taskLineMatchesText,
    taskIdentity,
    locateTaskLine,
    validVaultName,
    validateFocusItems
} = require("./lib");

function resolveExecutable(
    candidates
) {

    for (
        const candidate
        of candidates.filter(Boolean)
    ) {

        /*
         * Absolute/local paths can be
         * verified directly.
         */
        if (
            candidate.includes("\\") ||
            candidate.includes("/")
        ) {

            if (
                fs.existsSync(
                    candidate
                )
            ) {
                return candidate;
            }

            continue;
        }


        /*
         * Bare executable names are kept
         * as a final PATH fallback.
         */
        return candidate;
    }


    return null;
}


function spawnDetached(
    executable,
    args = []
) {

    return new Promise(
        (
            resolve,
            reject
        ) => {

            const child =
                spawn(
                    executable,
                    args,
                    {
                        detached: true,
                        stdio: "ignore",
                        windowsHide: true
                    }
                );


            child.once(
                "error",
                reject
            );


            child.once(
                "spawn",
                () => {

                    child.unref();

                    resolve();
                }
            );
        }
    );
}


function focusWindowsApplication(
    processName
) {

    if (
        process.platform !== "win32"
    ) {
        return Promise.resolve(false);
    }


    const safeName =
        String(processName)
            .replaceAll(
                "'",
                "''"
            );


    const script = `
$p = Get-Process -Name '${safeName}' -ErrorAction SilentlyContinue |
    Where-Object { $_.MainWindowHandle -ne 0 } |
    Select-Object -First 1

if (-not $p) {
    exit 1
}

$wshell = New-Object -ComObject WScript.Shell

if ($wshell.AppActivate($p.Id)) {
    exit 0
}

exit 2
`;


    return new Promise(
        resolve => {

            const child =
                spawn(
                    "powershell.exe",
                    [
                        "-NoProfile",
                        "-NonInteractive",
                        "-WindowStyle",
                        "Hidden",
                        "-Command",
                        script
                    ],
                    {
                        windowsHide: true,
                        stdio: "ignore"
                    }
                );


            child.once(
                "error",
                () =>
                    resolve(false)
            );


            child.once(
                "close",
                code =>
                    resolve(
                        code === 0
                    )
            );
        }
    );
}

function projectFileTitle(
    file
) {

    if (
        !(file instanceof TFile)
    ) {
        return "";
    }


    return (
        file.extension === "md"
            ? file.basename
            : file.name
    );
}


function yieldToObsidian() {
    return new Promise(resolve => {
        setTimeout(resolve, 0);
    });
}

function focusWizardInput(
    input,
    select = false
) {
    input.focus();

    if (select) {
        input.select();
    }
}


class ProjectFolderPickerModal
    extends FuzzySuggestModal {

    constructor(
        app,
        onChoose
    ) {

        super(app);

        this.onChoose =
            onChoose;

        this.setPlaceholder(
            "Move to folder…"
        );
    }


    getItems() {

        return this.app.vault
            .getAllLoadedFiles()
            .filter(
                item =>
                    item instanceof TFolder
            )
            .sort(
                (
                    a,
                    b
                ) => {

                    if (
                        a ===
                        this.app.vault
                            .getRoot()
                    ) {
                        return -1;
                    }


                    if (
                        b ===
                        this.app.vault
                            .getRoot()
                    ) {
                        return 1;
                    }


                    return a.path
                        .localeCompare(
                            b.path,
                            undefined,
                            {
                                sensitivity:
                                    "base"
                            }
                        );
                }
            );
    }


    getItemText(
        folder
    ) {

        if (
            folder ===
            this.app.vault
                .getRoot()
        ) {
            return "Vault root";
        }


        return folder.path;
    }


    onChooseItem(
        folder
    ) {

        this.onChoose(
            folder.path
        );
    }
}

class HubBackupPickerModal
    extends FuzzySuggestModal {

    constructor(
        app,
        backups,
        onChoose
    ) {

        super(app);


        this.backups =
            backups;


        this.onChoose =
            onChoose;


        this.setPlaceholder(
            "Choose a Hub backup…"
        );
    }


    getItems() {

        return this.backups;
    }


    getItemText(
        file
    ) {

        return file.basename;
    }


    onChooseItem(
        file
    ) {

        this.onChoose(
            file
        );
    }
}

// Project wizard classes
class ConfirmModal extends Modal {

    constructor(
        app,
        title,
        message,
        confirmText = "Delete",
        confirmClass = "mod-warning"
    ) {
        super(app);

        this.title = title;
        this.message = message;
        this.confirmText = confirmText;
        this.confirmClass = confirmClass;

        this.resolvePromise = null;
        this.settled = false;
    }


    waitForConfirmation() {

        return new Promise(resolve => {

            this.resolvePromise = resolve;

            this.open();
        });
    }


    finish(result) {

        if (this.settled) return;

        this.settled = true;

        const resolve =
            this.resolvePromise;

        this.resolvePromise = null;

        this.close();

        resolve?.(result);
    }


    onOpen() {

        this.contentEl.addClass("hub-button-scope");

        this.contentEl.createEl("h2", {
            text: this.title
        });


        this.contentEl.createEl("p", {
            text: this.message
        });


        const actions =
            this.contentEl.createDiv({
                cls:
                    "hub-project-wizard-actions"
            });


        const cancel =
            actions.createEl("button", {
                text: "Cancel"
            });


        const confirm =
            actions.createEl("button", {
                text: this.confirmText
            });

        confirm.addClass(this.confirmClass);


        cancel.addEventListener(
            "click",
            () => this.finish(false)
        );


        confirm.addEventListener(
            "click",
            () => this.finish(true)
        );


        requestAnimationFrame(() => {
            (confirm.classList.contains("mod-warning") ? cancel : confirm).focus();
        });
    }


    onClose() {

        this.contentEl.empty();


        /*
         * Closing with X or Escape
         * counts as cancellation.
         */

        if (!this.settled) {

            this.settled = true;

            const resolve =
                this.resolvePromise;

            this.resolvePromise = null;

            resolve?.(false);
        }
    }
}

class FocusListEditor {

    constructor(
        parent,
        projects,
        items,
        label = "Focus"
    ) {

        this.parent = parent;
        this.label = label;
        this.projects =
            (
                Array.isArray(projects)
                    ? projects
                    : []
            ).filter(
                project =>
                    project?.projectId &&
                    project?.name
            );
        this.rows = [];
        this.effects = mountTransientEffects(parent);


        for (
            const item
            of normalizeFocusItems(items)
        ) {
            this.addRow(item);
        }


        this.ensureSuggestionRow();
    }


    addRow(
        value = null
    ) {

        if (this.rows.length >= 6) {
            return;
        }


        const row =
            this.parent.createDiv({
                cls:
                    "hub-project-advancement-focus-item"
            });


        const number =
            row.createSpan({
                cls:
                    "hub-project-advancement-focus-number"
            });


        const projectSelect =
            row.createEl(
                "select",
                {
                    cls:
                        "hub-project-advancement-focus-project"
                }
            );


        projectSelect.createEl(
            "option",
            {
                text:
                    "Project or Resource…",
                attr: {
                    value:
                        ""
                }
            }
        );


        for (
            const project
            of this.projects
        ) {
            projectSelect.createEl(
                "option",
                {
                    text:
                        project.name,
                    attr: {
                        value:
                            project.projectId
                    }
                }
            );
        }


        if (
            value?.projectId &&
            !this.projects.some(
                project =>
                    project.projectId ===
                        value.projectId
            )
        ) {
            projectSelect.createEl(
                "option",
                {
                    text:
                        value.projectName ??
                        "Unavailable Project or Resource",
                    attr: {
                        value:
                            value.projectId
                    }
                }
            );
        }


        projectSelect.value =
            value?.projectId ??
            (
                this.projects.length === 1
                    ? this.projects[0]
                        .projectId
                    : ""
            );


        const input =
            row.createEl(
                "input",
                {
                    type:
                        "text",
                    attr: {
                        maxlength:
                            "200",
                        placeholder:
                            "I will focus on…"
                    }
                }
            );


        input.value =
            value?.text ?? "";


        const remove =
            row.createEl(
                "button",
                {
                    cls:
                        "hub-project-advancement-remove-focus",
                    attr: {
                        type:
                            "button",
                        "aria-label":
                            "Remove focus"
                    }
                }
            );


        setIcon(remove, "x");


        const entry = {
            row,
            number,
            projectSelect,
            input,
            remove
        };


        this.rows.push(entry);

        projectSelect.addEventListener("change", () => {
            if (projectSelect.value) this.clearWarning(entry);
            this.syncRows();
        });


        input.addEventListener(
            "input",
            () => {
                if (!input.value.trim() || projectSelect.value) this.clearWarning(entry);
                this.ensureSuggestionRow();
                this.syncRows();
            }
        );


        remove.addEventListener(
            "click",
            event => {

                const restoreFocus = hasKeyboardFocus(remove, event);
                const index = this.rows.indexOf(entry);
                this.clearWarning(entry);
                row.remove();


                this.rows =
                    this.rows.filter(
                        item =>
                            item !== entry
                    );


                const survivingRows = this.rows.slice();
                this.ensureSuggestionRow();
                this.syncRows();
                if (restoreFocus) focusAfterRowRemoval(survivingRows.map(item => item.remove), index, this.rows[0]?.input);
            }
        );


        this.syncRows();
    }


    ensureSuggestionRow() {

        const hasEmptyRow =
            this.rows.some(
                entry =>
                    !entry.input.value.trim()
            );


        if (
            !hasEmptyRow &&
            this.rows.length < 6
        ) {
            this.addRow();
        }
    }


    syncRows() {

        this.rows.forEach(
            (entry, index) => {
                entry.number.setText(
                    `${index + 1}.`
                );
                entry.projectSelect.setAttribute("aria-label", `Project or Resource for ${this.label.toLowerCase()} intention ${index + 1}`);
                const workspace = entry.projectSelect.value ? entry.projectSelect.selectedOptions[0]?.textContent : "";
                entry.input.setAttribute("aria-label", `${this.label} intention ${index + 1}${workspace ? ` for ${workspace}` : ""}`);
            }
        );
    }


    clearWarning(entry) {
        this.effects.cancel(entry.projectSelect);
        entry.projectSelect.removeAttribute("aria-invalid");
    }

    validate(reveal = true) {
        let first = null;
        for (const entry of this.rows) {
            if (entry.input.value.trim() && !entry.projectSelect.value) {
                entry.projectSelect.setAttribute("aria-invalid", "true");
                this.effects.run(entry.projectSelect, "hub-attention");
                first ??= entry.projectSelect;
            } else this.clearWarning(entry);
        }
        if (first && reveal) {
            this.effects.reveal(first, this.parent.closest(".hub-modal-body, .modal-content"));
            first.focus({ preventScroll: true });
        }
        return first === null;
    }

    destroy() { this.effects.destroy(); }

    getValue() {
        if (!this.validate()) throw new Error("Choose a Project or Resource for each focus.");

        const items = [];


        for (
            const entry
            of this.rows
        ) {

            const text =
                entry.input.value.trim();


            if (!text) {
                continue;
            }


            const projectId =
                entry.projectSelect.value;


            const projectName =
                entry.projectSelect
                    .selectedOptions[0]
                    ?.textContent?.trim() ??
                "Unavailable project";


            items.push({
                text,
                projectId,
                projectName
            });
        }


        return items;
    }
}


class ProjectAdvancementModal
    extends Modal {

    constructor(
        app,
        {
            projects,
            resources = [],
            plugin,
            currentScores,
            currentSummaries = {},
            reportContexts = {},
            getReportContexts = null,
            showNextFocus = false,
            currentFocus = [],
            focusProjects = [],
            onSave,
            onSaved,
            onCancel,
            title =
                "Edit progress report",
            reportDate = null,
            reportMode = "edit",
            requireEveryProject = true,
            requireExplicitRatings = false,
            allowNoProgress = false,
            saveLabel = "Save & close",
            showCancel = false
        }
    ) {

        super(app);


        this.projects =
            Array.isArray(projects)
                ? projects
                : [];


        this.resources =
            Array.isArray(resources)
                ? resources
                : [];


        this.requireExplicitRatings = requireExplicitRatings;
        this.plugin = plugin;
        this.progressItems = [
            ...this.projects,
            ...this.resources
        ];


        this.currentScores =
            currentScores ?? {};


        this.currentSummaries =
            currentSummaries ?? {};
        this.getReportContexts = getReportContexts;
        this.reportContexts = getReportContexts?.() ?? reportContexts;


        this.showNextFocus =
            showNextFocus;


        this.currentFocus =
            Array.isArray(currentFocus)
                ? currentFocus
                : [];


        this.focusProjects =
            Array.isArray(focusProjects)
                ? focusProjects
                : [];


        this.onSave =
            onSave;


        this.onSaved =
            onSaved;


        this.onCancel =
            onCancel;


        this.title =
            title;
        this.reportDate = reportDate;
        this.reportMode = reportMode;


        this.requireEveryProject =
            requireEveryProject;


        this.allowNoProgress =
            allowNoProgress;


        this.saveLabel =
            saveLabel;


        this.showCancel =
            showCancel;


        this.selectedScores =
            new Map();


        this.summaryInputs =
            new Map();


        this.settled =
            false;


        this.saving =
            false;


        for (
            const project
            of this.progressItems
        ) {

            const score =
                this.currentScores[
                    project.projectId
                ];


            if (
                Number.isInteger(score) &&
                score >= 1 &&
                score <= 4
            ) {

                this.selectedScores.set(
                    project.projectId,
                    score
                );
            }
        }
    }


    onOpen() {
        this.evidenceRows = new Map();
        this.evidenceComponents = new Map();
        this.renderEvidence = (parent, context, id) => {
            this.evidenceComponents.get(id)?.unload();
            const component = new Component();
            component.load();
            this.evidenceComponents.set(id, component);
            const markdown = createHubMarkdown({ app: this.app, component });
            const evidence = renderReportEvidence(parent, context, markdown, component);
            if (context.focus.length) focusSection(evidence, "Focus for this day", context.focus, "", markdown);
            return evidence;
        };
        this.ratingRows = new Map();
        if (this.requireExplicitRatings) this.ratingEffects = mountTransientEffects(this.contentEl);
        this.refreshEvidence = () => {
            if (!this.getReportContexts) return;
            this.reportContexts = this.getReportContexts();
            for (const [id, previous] of this.evidenceRows) {
                const context = this.reportContexts[id];
                if (!context) continue;
                const evidence = this.renderEvidence(previous.parentElement, context, id);
                previous.replaceWith(evidence);
                this.evidenceRows.set(id, evidence);
            }
        };
        if (this.getReportContexts) document.addEventListener("hub-completed-tasks-changed", this.refreshEvidence);


        this.contentEl.addClass(
            "hub-project-advancement-modal", "hub-button-scope"
        );


        const heading = createWindowTitle(this.contentEl, this.title,
            this.reportMode === "complete" ? "clipboard-plus" : "clipboard-pen", {
                date: this.reportDate ? { value: this.reportDate,
                    label: formatDate(parseLocalISODate(this.reportDate), "full") } : null
            });


        const guidance = this.contentEl.createEl("p", { cls: "hub-progress-rating-guidance hub-oath-muted", text:
            this.reportMode === "complete"
                ? "Review your activity and rate your work in each project or resource"
                : this.reportMode === "update"
                    ? "New activity has been recorded since your last report. Review your ratings"
                    : "Review activity and adjust the significance of work recorded for this date" });
        setWindowUndertext(heading, guidance);
        this.ratingTooltips?.dispose();
        this.ratingTooltips = createImmediateHubTooltip(this.contentEl);


        this.contentEl.createDiv({
            cls:
                "hub-project-advancement-divider"
        });


        // ---------- PROJECTS ----------

        const rows =
            this.contentEl.createDiv({
                cls:
                    "hub-project-advancement-projects"
            });


        for (
            let index = 0;
            index < this.progressItems.length;
            index++
        ) {

            if (
                index === this.projects.length &&
                this.projects.length > 0 &&
                this.resources.length > 0
            ) {
                rows.createDiv({
                    cls:
                        "hub-project-advancement-divider is-context-divider"
                });
            }


            const project =
                this.progressItems[index];
            const ratingOptions = progressRatingOptions(project);
            const bindRatingTooltip = (button, score) => {
                const option = ratingOptions.find(option => option.score === score);
                this.ratingTooltips.bind(button, {
                    title: `${option.score} · ${option.title}`, description: option.description
                });
            };

            const row =
                rows.createDiv({
                    cls:
                        "hub-project-advancement-row"
                });


            row.dataset.projectId =
                project.projectId;


            renderReportWorkspaceHeader(row, project, this.plugin);


            const context = this.reportContexts[project.projectId];
            if (context) {
                const evidence = this.renderEvidence(row, context, project.projectId);
                this.evidenceRows.set(project.projectId, evidence);
            }

            const ratingSection =
                row.createDiv({
                    cls:
                        "hub-project-advancement-choices"
                });


            const choices = ratingSection.createDiv({ cls: "hub-project-advancement-rating-buttons" });
            choices.setAttribute("role", "group");
            choices.setAttribute("aria-label", `Rating for ${project.name}`);
            this.ratingRows.set(project.projectId, choices);

            if (this.allowNoProgress) {

                const noProgressButton =
                    choices.createEl(
                        "button",
                        {
                            cls:
                                "hub-project-advancement-score",

                            text:
                                "0"
                        }
                    );


                noProgressButton.dataset.score =
                    "0";


                bindRatingTooltip(noProgressButton, 0);


                if (
                    this.selectedScores.get(
                        project.projectId
                    ) === 0
                ) {

                    noProgressButton.addClass(
                        "is-selected"
                    );
                }


                noProgressButton.setAttribute(
                    "aria-pressed",
                    String(
                        this.selectedScores.get(
                            project.projectId
                        ) === 0
                    )
                );


                noProgressButton.addEventListener(
                    "click",
                    () => {

                        this.selectScore(
                            row,
                            project.projectId,
                            0
                        );
                    }
                );
            }


            for (
                const option
                of PROJECT_ADVANCEMENT_OPTIONS
            ) {

                const button =
                    choices.createEl(
                        "button",
                        {
                            cls:
                                "hub-project-advancement-score",

                            text:
                                String(
                                    option.score
                                )
                        }
                    );


                button.dataset.score =
                    String(
                        option.score
                    );


                bindRatingTooltip(button, option.score);


                if (
                    this.selectedScores.get(
                        project.projectId
                    ) ===
                        option.score
                ) {

                    button.addClass(
                        "is-selected"
                    );
                }


                button.setAttribute(
                    "aria-pressed",
                    String(
                        this.selectedScores.get(
                            project.projectId
                        ) ===
                            option.score
                    )
                );


                button.addEventListener(
                    "click",
                    () => {

                        this.selectScore(
                            row,
                            project.projectId,
                            option.score
                        );
                    }
                );
            }


            const summaryField =
                row.createDiv({
                    cls:
                        "hub-project-advancement-summary"
                });


            const summaryInput =
                summaryField.createEl(
                    "textarea",
                    {
                        attr: {
                            rows: "3",
                            maxlength: "1000",
                            "aria-label": `Comments for ${project.name}`,
                            placeholder:
                                "Comments\u2026"
                        }
                    }
                );


            summaryInput.value =
                String(
                    this.currentSummaries[
                        project.projectId
                    ] ?? ""
                );


            this.summaryInputs.set(
                project.projectId,
                summaryInput
            );
        }


        if (this.showNextFocus) {

            this.contentEl.createDiv({
                cls:
                    "hub-project-advancement-divider"
            });


            const focusSection =
                this.contentEl.createDiv({
                    cls:
                        "hub-project-advancement-focus"
                });


            focusSection.createEl(
                "h3",
                {
                    text:
                        "What will you focus on next time?"
                }
            );


            this.focusList =
                focusSection.createDiv({
                    cls:
                        "hub-project-advancement-focus-list"
                });


            this.focusEditor =
                new FocusListEditor(
                    this.focusList,
                    this.focusProjects,
                    this.currentFocus,
                    "Next focus"
                );
        }


        this.contentEl.addClass("hub-report-footer-layout");

        // ---------- ACTIONS ----------

        const actions =
            this.contentEl.createDiv({
                cls:
                    "hub-project-advancement-actions"
            });
        layoutModal(this, { footer: actions, bodyClass: "hub-report-scroll" });


        if (this.showCancel) {

            const cancelButton =
                actions.createEl(
                    "button",
                    {
                        text:
                            "Cancel"
                    }
                );


            cancelButton.addEventListener(
                "click",
                () => {

                    this.close();
                }
            );
        }


        this.saveButton =
            actions.createEl(
                "button",
                {
                    text:
                        this.saveLabel
                }
            );


        this.saveButton.addClass(
            "mod-cta"
        );


        this.saveButton.addEventListener(
            "click",
            () => {

                this.save();
            }
        );


        this.updateSaveButton();
    }


    selectScore(
        row,
        projectId,
        score
    ) {
        if (score !== null) {
            const choices = this.ratingRows.get(projectId);
            this.ratingEffects?.cancel(choices);
            choices?.removeAttribute("aria-invalid");
        }
        if (score === 0) {
            const input = this.summaryInputs.get(projectId);
            if (input) input.value = "";
            this.currentSummaries[projectId] = "";
        }

        if (score === null) {

            this.selectedScores.delete(
                projectId
            );

        } else {

            this.selectedScores.set(
                projectId,
                score
            );
        }


        row.querySelectorAll(
            ".hub-project-advancement-score"
        )
            .forEach(
                button => {

                    button.toggleClass(
                        "is-selected",

                        (
                            button.dataset.score ===
                                ""
                                ? null
                                : Number(
                                    button.dataset.score
                                )
                        ) === score
                    );


                    button.setAttribute(
                        "aria-pressed",
                        String(
                            (
                                button.dataset.score ===
                                    ""
                                    ? null
                                    : Number(
                                        button.dataset.score
                                    )
                            ) === score
                        )
                    );
                }
            );


        this.updateSaveButton();
    }


    updateSaveButton() {

        if (!this.saveButton) {
            return;
        }


        if (this.requireExplicitRatings) {
            this.saveButton.addClass("hub-guided-submit");
            this.saveButton.setAttribute("aria-disabled", String(this.saving ||
                this.progressItems.some(item => !this.selectedScores.has(item.projectId))));
        }

        this.saveButton.disabled =
            this.saving ||
            (
                this.requireEveryProject && !this.requireExplicitRatings &&
                this.selectedScores.size !==
                    this.progressItems.length
            );
    }


    async save() {
        if (!this.saving && this.requireExplicitRatings) {
            const missing = this.progressItems.filter(item => !this.selectedScores.has(item.projectId));
            for (const item of missing) {
                const choices = this.ratingRows.get(item.projectId);
                choices.setAttribute("aria-invalid", "true");
                this.ratingEffects.run(choices, "hub-attention");
            }
            if (missing.length) {
                this.ratingEffects.reveal(this.ratingRows.get(missing[0].projectId), this.contentEl.querySelector(".hub-report-scroll"));
                return;
            }
        }

        if (
            this.saving ||
            (
                this.requireEveryProject && !this.requireExplicitRatings &&
                this.selectedScores.size !==
                    this.progressItems.length
            )
        ) {
            return;
        }


        const scores =
            Object.fromEntries(
                [...this.selectedScores]
                    .filter(
                        ([, score]) =>
                            score !== 0
                    )
            );


        const summaries =
            Object.fromEntries(
                [...this.summaryInputs]
                    .map(
                        ([projectId, input]) => [
                            projectId,
                            input.value.trim()
                        ]
                    )
            );


        let focus;


        try {
            focus =
                this.focusEditor
                    ?.getValue() ?? [];

        } catch (error) {

            new Notice(
                error.message
            );

            return;
        }


        this.saving = true;
        const restoreControls = lockModalControls(this);
        this.updateSaveButton();

        try {

            await this.onSave({
                scores,
                summaries,
                focus
            });


            this.settled =
                true;

            this.saving = false;
            restoreControls();

            this.close();


            this.onSaved?.();


        } catch (error) {

            console.error(
                "Could not save progress report:",
                error
            );


            this.saving =
                false;

            restoreControls();

            this.updateSaveButton();


            new Notice(
                "Could not save progress report."
            );
        }
    }


    close() { if (!this.saving) super.close(); }

    onClose() {
        this.focusEditor?.destroy();
        this.evidenceComponents?.forEach(component => component.unload());
        this.evidenceComponents?.clear();
        if (this.refreshEvidence) document.removeEventListener("hub-completed-tasks-changed", this.refreshEvidence);

        this.ratingTooltips?.dispose();
        this.ratingEffects?.destroy();
        this.contentEl.empty();


        if (
            !this.settled
        ) {

            this.onCancel?.();
        }
    }
}


class DailyFocusModal
    extends Modal {

    constructor(
        app,
        {
            date,
            items,
            nextItems = [],
            projects = [],
            onSave,
            onSaved,
            onCancel,
            title = null,
            saveLabel = "Save changes"
        }
    ) {

        super(app);


        this.date = date;
        this.items =
            Array.isArray(items)
                ? items
                : [];
        this.nextItems =
            Array.isArray(nextItems)
                ? nextItems
                : [];
        this.projects =
            Array.isArray(projects)
                ? projects
                : [];
        this.onSave = onSave;
        this.onSaved = onSaved;
        this.onCancel = onCancel;
        this.title = title;
        this.saveLabel = saveLabel;
        this.saving = false;
        this.settled = false;
    }


    onOpen() {

        this.contentEl.addClass(
            "hub-daily-focus-modal", "hub-button-scope"
        );


        this.contentEl.createEl(
            "h2",
            {
                text:
                    this.title ??
                    "Edit focus for today"
            }
        );


        this.list =
            this.contentEl.createDiv({
                cls:
                    "hub-project-advancement-focus-list"
            });


        this.focusEditor =
            new FocusListEditor(
                this.list,
                this.projects,
                this.items,
                "Focus for today"
            );


        this.contentEl.createDiv({
            cls:
                "hub-project-advancement-divider"
        });


        const nextSection =
            this.contentEl.createDiv({
                cls:
                    "hub-project-advancement-focus"
            });


        nextSection.createEl(
            "h3",
            {
                text:
                    "Edit focus for next day"
            }
        );


        const nextList =
            nextSection.createDiv({
                cls:
                    "hub-project-advancement-focus-list"
            });


        this.nextFocusEditor =
            new FocusListEditor(
                nextList,
                this.projects,
                this.nextItems,
                "Focus for next day"
            );


        const actions =
            this.contentEl.createDiv({
                cls:
                    "hub-project-advancement-actions"
            });


        layoutModal(this, { footer: actions });

        const cancel =
            actions.createEl(
                "button",
                {
                    text:
                        "Cancel"
                }
            );


        cancel.addEventListener(
            "click",
            () => this.close()
        );


        this.saveButton =
            actions.createEl(
                "button",
                {
                    text:
                        this.saveLabel
                }
            );


        this.saveButton.addClass(
            "mod-cta"
        );


        this.saveButton.addEventListener(
            "click",
            () => this.save()
        );
    }


    async save() {

        if (this.saving) {
            return;
        }


        let restoreControls;

        try {
            const valid = this.focusEditor.validate();
            const nextValid = this.nextFocusEditor.validate(valid);
            if (!valid || !nextValid) throw new Error("Choose a Project or Resource for each focus.");

            const items =
                this.focusEditor
                    .getValue();

            const nextItems =
                this.nextFocusEditor
                    .getValue();

            this.saving = true;
            restoreControls = lockModalControls(this);

            await this.onSave({
                items,
                nextItems
            });
            this.settled = true;
            this.saving = false;
            restoreControls();
            this.close();
            this.onSaved?.();

        } catch (error) {

            console.error(
                "Could not save daily focus:",
                error
            );


            this.saving = false;
            restoreControls?.();


            new Notice(
                error.message ||
                "Could not save today's focus."
            );
        }
    }


    close() { if (!this.saving) super.close(); }

    onClose() {
        this.focusEditor?.destroy();
        this.nextFocusEditor?.destroy();
        this.contentEl.empty();


        if (!this.settled) {
            this.onCancel?.();
        }
    }
}

function confirmAction(
    app,
    title,
    message,
    confirmText = "Delete"
) {

    return new ConfirmModal(
        app,
        title,
        message,
        confirmText
    ).waitForConfirmation();
}

class ProjectCategoryModal
    extends Modal {

    constructor(
        app,
        categories,
        currentCategory,
        projectName,
        onChoose
    ) {
        super(app);

        this.categories =
            categories;

        this.currentCategory =
            currentCategory;

        this.projectName =
            projectName;

        this.onChoose =
            onChoose;
    }


    onOpen() {

        this.contentEl.addClass(
            "hub-project-wizard", "hub-button-scope"
        );

        createWindowTitle(this.contentEl, `Change category of "${this.projectName}"`, "tag");


        const list =
            this.contentEl.createDiv({
                cls:
                    "hub-project-wizard-options"
            });


        for (
            const category
            of this.categories
        ) {

            const button =
                list.createEl(
                    "button",
                    {
                        text:
                            category.name
                    }
                );


            if (
                category.id ===
                    this.currentCategory ||
                category.name ===
                    this.currentCategory
            ) {
                button.addClass(
                    "mod-cta"
                );
            }


            button.addEventListener(
                "click",
                async () => {

                    try {

                        await this.onChoose(
                            category
                        );

                        this.close();

                    } catch (error) {

                        console.error(error);

                        new Notice(
                            error.message ||
                            "Could not change category."
                        );
                    }
                }
            );
        }

        layoutModal(this);
        requestAnimationFrame(() => {
            this.contentEl
                .querySelector(".mod-cta")
                ?.focus();
        });
    }


    onClose() {
        this.contentEl.empty();
    }
}


class HubDataAuditModal extends Modal {

    constructor(
        app,
        report,
        onRepair
    ) {
        super(app);
        this.report = report;
        this.onRepair = onRepair;
    }


    onOpen() {
        this.render();
    }


    render() {
        this.contentEl.empty();
        this.contentEl.addClass(
            "hub-data-audit", "hub-button-scope"
        );

        this.contentEl.createEl("h2", {
            text: "Audit Hub data"
        });

        const issues =
            this.report.issues ?? [];
        const conflicts =
            this.report.conflicts ?? [];

        this.contentEl.createEl("p", {
            cls: "hub-data-audit-summary",
            text: this.report.repaired
                ? "Repairs were applied and the Hub state was saved."
                : issues.length || conflicts.length
                    ? `${issues.length} data issue${issues.length === 1 ? "" : "s"} and ${conflicts.length} conflict cop${conflicts.length === 1 ? "y" : "ies"} found.`
                    : "No Hub data issues were found."
        });

        if (
            !this.report.repaired &&
            issues.some(finding => finding.repairable)
        ) {
            this.contentEl.createEl("p", {
                cls: "hub-data-audit-summary",
                text: "A recovery backup is created before any repair."
            });
        }

        if (conflicts.length) {
            const section = this.contentEl.createDiv({
                cls: "hub-data-audit-section is-warning"
            });

            section.createEl("h3", {
                text: "OneDrive conflict copies"
            });
            section.createEl("p", {
                text: "These files contain alternate Hub histories. They are never deleted automatically; review or archive them after deciding which state to keep."
            });

            const list = section.createEl("ul");

            for (const conflict of conflicts) {
                const revision = conflict.revision == null
                    ? "unversioned"
                    : `revision ${conflict.revision}`;
                const updated = conflict.updatedAt ??
                    conflict.modifiedAt;
                const device = conflict.deviceId
                    ? `device ${conflict.deviceId.slice(0, 8)}`
                    : "unknown device";

                list.createEl("li", {
                    text: `${conflict.name} — ${revision}, ${device}, ${updated}`
                });
            }
        }

        if (issues.length) {
            const section = this.contentEl.createDiv({
                cls: "hub-data-audit-section"
            });

            section.createEl("h3", {
                text: "Findings"
            });

            const list = section.createEl("ul");

            for (const finding of issues) {
                const row = list.createEl("li");
                row.createSpan({
                    text: finding.message
                });

                if (!finding.repairable) {
                    row.createSpan({
                        cls: "hub-data-audit-manual",
                        text: "Manual action required"
                    });
                }
            }
        }

        const actions = this.contentEl.createDiv({
            cls: "hub-project-wizard-actions"
        });
        layoutModal(this, { footer: actions });
        const close = actions.createEl("button", {
            text: "Close"
        });

        close.addEventListener(
            "click",
            () => this.close()
        );

        if (
            !this.report.repaired &&
            issues.some(finding => finding.repairable)
        ) {
            const repair = actions.createEl("button", {
                text: "Repair issues"
            });
            repair.addClass("mod-cta");

            repair.addEventListener(
                "click",
                async () => {
                    repair.disabled = true;
                    close.disabled = true;

                    try {
                        this.report =
                            await this.onRepair();
                        this.render();
                    } catch (error) {
                        console.error(
                            "Could not repair Hub data:",
                            error
                        );
                        new Notice(
                            error.message ||
                            "Could not repair Hub data."
                        );
                        repair.disabled = false;
                        close.disabled = false;
                    }
                }
            );
        }
    }


    onClose() {
        this.contentEl.empty();
    }
}

class ResourceFolderPickerModal extends Modal {

    constructor(app, { folders, selected = [], title = "Choose Resource folders", onSave }) {
        super(app);
        this.folders = folders;
        this.selected = new Set(selected.map(String));
        this.title = title;
        this.onSave = onSave;
    }

    onOpen() {
        this.contentEl.addClass("hub-resource-folder-picker", "hub-button-scope");
        createWindowTitle(this.contentEl, this.title, "library");

        const list = this.contentEl.createDiv({ cls: "hub-resource-folder-picker-list" });

        if (this.folders.length === 0) {
            list.createDiv({
                cls: "hub-resource-folder-picker-empty",
                text: "Create a folder on a Resource page first."
            });
        }

        for (const folder of this.folders) {
            const row = list.createEl("label", { cls: "hub-resource-folder-picker-row" });
            const input = row.createEl("input");
            input.type = "checkbox";
            input.checked = this.selected.has(folder.id);
            input.addEventListener("change", () => {
                if (input.checked) this.selected.add(folder.id);
                else this.selected.delete(folder.id);
            });

            const resource = RESOURCE_TYPES.find(item => item.id === folder.resourceType);
            row.createSpan({ text: folder.name });
            row.createSpan({
                cls: "hub-resource-folder-picker-type",
                text: resource?.label ?? folder.resourceType
            });
        }

        const actions = this.contentEl.createDiv({ cls: "hub-project-wizard-actions" });
        const cancel = actions.createEl("button", { text: "Cancel" });
        const save = actions.createEl("button", { text: "Save changes" });
        layoutModal(this, { footer: actions });
        save.addClass("mod-cta");
        cancel.addEventListener("click", () => this.close());
        save.addEventListener("click", async () => {
            save.disabled = true;
            try {
                await this.onSave([...this.selected]);
                this.close();
            } catch (error) {
                console.error(error);
                new Notice(error.message || "Could not save Resource folders.");
                save.disabled = false;
            }
        });
    }

    onClose() {
        this.contentEl.empty();
    }
}


class ProjectWizardModal extends Modal {

    constructor(
        service,
        dashboard,
        projectStatus
    ) {
        super(service.app);

        this.service = service;
        this.dashboard = dashboard;
        this.projectStatus = projectStatus;

        this.categoryName = "";
        this.imageChoice = null;

        this.shortcutIds = null;
        this.shortcutOrder = null;
    }


    onOpen() {
        this.showCategorySelection();
    }


    onClose() {
        this.contentEl.empty();
    }


    page(title) {
        this.contentEl.empty();
        this.contentEl.addClass(
            "hub-project-wizard", "hub-button-scope"
        );

        createWindowTitle(this.contentEl, title, "folder-plus");
    }

    notifyCategoriesChanged(
        detail = {}
    ) {

        if (
            this.dashboard?.isConnected
        ) {
            this.dashboard.dispatchEvent(
                new CustomEvent(
                    "hub-categories-changed",
                    {
                        detail
                    }
                )
            );
        }
    }

    actions() {
        const actions = this.contentEl.createDiv({
            cls: "hub-project-wizard-actions"
        });
        layoutModal(this, { footer: actions });
        return actions;
    }


    backButton(parent, action) {
        const button = parent.createEl(
            "button",
            {
                text: "Back"
            }
        );

        button.addEventListener(
            "click",
            () => {
                this.switchPage(action);
            }
        );
    }

    showCategoryMenu(
        event,
        category
    ) {

        const menu = new Menu();

        menu.addItem(item => {
            item
                .setTitle("Change image")
                .setIcon("image")
                .onClick(() => {
                    this.switchPage(
                        () =>
                            this.showChangeCategoryImage(
                                category
                            )
                    );
                });
        });

        menu.addItem(item => {

            item
                .setTitle(
                    "Change shortcuts"
                )
                .setIcon(
                    "app-window"
                )
                .onClick(
                    () => {

                        this.switchPage(
                            () =>
                                this.showChangeCategoryShortcuts(
                                    category
                                )
                        );
                    }
                );
        });

        menu.addItem(item => {
            item
                .setTitle("Choose Resource folders")
                .setIcon("library")
                .onClick(async () => {
                    await this.service.syncResourceFolders();
                    new ResourceFolderPickerModal(
                        this.service.app,
                        {
                            folders: this.service.getResourceFolders(),
                            selected: category.resourceFolders ?? [],
                            title: `Resource folders for ${category.name}`,
                            onSave: async ids => {
                                await this.service.updateCategoryResourceFolders(category, ids);
                                this.notifyCategoriesChanged({ id: category.id });
                            }
                        }
                    ).open();
                });
        });

        menu.addSeparator();


        menu.addItem(item => {
            item
                .setTitle("Rename")
                .setIcon("pencil")
                .onClick(() => {
                    this.switchPage(
                        () =>
                            this.showRenameCategory(
                                category
                            )
                    );
                });
        });


        menu.addItem(item => {
            item
                .setTitle("Delete")
                .setIcon("trash-2")
                .setWarning(true)
                .onClick(async () => {

                    const confirmed =
                        await confirmAction(
                            this.service.app,
                            "Delete category?",
                            `Delete "${category.name}"? Existing projects and template files will not be deleted.`
                        );


                    if (!confirmed) {
                        return;
                    }


                    try {

                        await this.service
                            .deleteCategory(
                                category
                            );

                        this.switchPage(
                            () => this.showCategorySelection()
                        );

                    } catch (error) {

                        console.error(error);

                        new Notice(
                            error.message ||
                            "Could not delete category."
                        );
                    }
                });
        });


        menu.showAtMouseEvent(event);
    }

    showCategorySelection() {

        this.page(
            "Choose a project category"
        );

        const list =
            this.contentEl.createDiv({
                cls: "hub-project-wizard-options"
            });


        for (
            const category
            of this.service.getCategories()
        ) {

            const row =
                list.createDiv({
                    cls:
                        "hub-project-wizard-category-row"
                });


            const button =
                row.createEl("button", {
                    cls:
                        "hub-project-wizard-category-button",
                    text: category.name
                });


            button.addEventListener(
                "click",
                () => {
                    this.switchPage(
                        () => this.showProjectName(
                            category
                        )
                    );
                }
            );


            const menuButton =
                row.createEl("button", {
                    cls:
                        "hub-project-wizard-category-menu",
                    text: "⋯"
                });


            menuButton.setAttribute(
                "aria-label",
                `Manage ${category.name}`
            );


            menuButton.addEventListener(
                "click",
                event => {

                    event.stopPropagation();

                    this.showCategoryMenu(
                        event,
                        category
                    );
                }
            );
        }


        const newCategory =
            list.createEl("button", {
                text: "Add category"
            });

        newCategory.addClass(
            "hub-project-wizard-new-category"
        );

        newCategory.addEventListener(
            "click",
            () => {
                this.switchPage(
                    () => this.showCategoryName()
                );
            }
        );
        layoutModal(this);
    }


    showProjectName(category) {

        this.page(
            "Name your project"
        );


        const input =
            this.contentEl.createEl(
                "input",
                {
                    cls:
                        "hub-project-wizard-input"
                }
            );

        input.type = "text";
        input.placeholder = "Project name";


        const actions = this.actions();

        this.backButton(
            actions,
            () =>
                this.showCategorySelection()
        );


        const create =
            actions.createEl("button", {
                text: "Create Project"
            });

        create.addClass("mod-cta");


        const submit = async () => {

            const name =
                input.value.trim();

            try {

                await this.service
                    .createProject(
                        category,
                        name,
                        this.dashboard,
                        this.projectStatus
                    );

                this.close();

            } catch (error) {

                console.error(error);

                new Notice(
                    error.message ||
                    "Could not create project."
                );
            }
        };


        create.addEventListener(
            "click",
            submit
        );


        input.addEventListener(
            "keydown",
            event => {
                if (event.key === "Enter") {
                    submit();
                }
            }
        );


        focusWizardInput(input);
    }

    showCategoryName() {

        this.page(
            "Name your category"
        );


        const input =
            this.contentEl.createEl(
                "input",
                {
                    cls:
                        "hub-project-wizard-input"
                }
            );

        input.type = "text";
        input.placeholder = "Category name";


        const actions = this.actions();

        this.backButton(
            actions,
            () =>
                this.showCategorySelection()
        );


        const next =
            actions.createEl("button", {
                text: "Next"
            });

        next.addClass("mod-cta");


        const submit = () => {

            const name =
                input.value.trim();

            try {

                this.service
                    .validateCategoryName(name);

                this.categoryName = name;

                this.switchPage(
                    () => this.showCategoryImage()
                );

            } catch (error) {

                new Notice(error.message);
            }
        };


        next.addEventListener(
            "click",
            submit
        );


        input.addEventListener(
            "keydown",
            event => {
                if (event.key === "Enter") {
                    submit();
                }
            }
        );


        focusWizardInput(input);
    }

    showRenameCategory(category) {

        this.page(
            "Rename category"
        );


        const input =
            this.contentEl.createEl(
                "input",
                {
                    cls:
                        "hub-project-wizard-input"
                }
            );

        input.type = "text";
        input.value = category.name;


        const actions =
            this.actions();


        this.backButton(
            actions,
            () =>
                this.showCategorySelection()
        );


        const rename =
            actions.createEl(
                "button",
                {
                    text: "Rename"
                }
            );

        rename.addClass("mod-cta");


        const submit = async () => {

            try {

                const oldName =
                        category.name;

                await this.service
                    .renameCategory(
                        category,
                        input.value
                    );
                
                this.notifyCategoriesChanged({
                    id: category.id,
                    oldName
                });

                this.showCategorySelection();


            } catch (error) {

                console.error(error);

                new Notice(
                    error.message ||
                    "Could not rename category."
                );
            }
        };


        rename.addEventListener(
            "click",
            submit
        );


        input.addEventListener(
            "keydown",
            event => {

                if (event.key === "Enter") {
                    submit();
                }
            }
        );


        focusWizardInput(
            input,
            true
        );
    }

    shortcutPicker(
        initialIds,
        initialOrder = null
    ) {

        const selected =
            new Set(
                normalizeShortcutIds(
                    initialIds
                )
            );


        let order =
            normalizeShortcutOrder(
                initialOrder ??
                initialIds
            );


        const list =
            this.contentEl.createDiv({
                cls:
                    "hub-project-wizard-shortcuts"
            });


        const render = () => {

            list.empty();


            order.forEach(
                (
                    id,
                    index
                ) => {

                    const shortcut =
                        APP_SHORTCUTS.find(
                            item =>
                                item.id === id
                        );


                    if (!shortcut) {
                        return;
                    }


                    const row =
                        list.createDiv({
                            cls:
                                "hub-project-wizard-shortcut-row"
                        });


                    // ---------- ENABLED ----------

                    const checkbox =
                        row.createEl(
                            "input",
                            {
                                cls:
                                    "hub-project-wizard-shortcut-check"
                            }
                        );


                    checkbox.type =
                        "checkbox";

                    checkbox.checked =
                        selected.has(id);


                    checkbox.addEventListener(
                        "change",
                        () => {

                            /*
                            * Selection changes only
                            * selection. It must never
                            * affect ordering.
                            */

                            if (
                                checkbox.checked
                            ) {

                                selected.add(id);

                            } else {

                                selected.delete(id);
                            }
                        }
                    );


                    // ---------- IDENTITY ----------

                    const identity =
                        row.createDiv({
                            cls:
                                "hub-project-wizard-shortcut-identity"
                        });


                    const icon =
                        identity.createSpan({
                            cls:
                                "hub-project-wizard-shortcut-icon"
                        });


                    const iconFile =
                        shortcut.icon
                            ? this.service.app.vault
                                .getAbstractFileByPath(
                                    shortcut.icon
                                )
                            : null;


                    if (
                        iconFile instanceof
                            TFile
                    ) {

                        const image =
                            icon.createEl(
                                "img"
                            );


                        image.src =
                            this.service.app.vault
                                .getResourcePath(
                                    iconFile
                                );

                        image.alt = "";

                    } else {

                        setIcon(
                            icon,

                            shortcut.type ===
                                "website"
                                ? "globe-2"
                                : "app-window"
                        );
                    }


                    identity.createSpan({
                        text:
                            shortcut.label
                    });


                    // ---------- ORDER ----------

                    const controls =
                        row.createDiv({
                            cls:
                                "hub-project-wizard-shortcut-order"
                        });


                    const up =
                        controls.createEl(
                            "button"
                        );


                    setIcon(
                        up,
                        "chevron-up"
                    );


                    const down =
                        controls.createEl(
                            "button"
                        );


                    setIcon(
                        down,
                        "chevron-down"
                    );


                    up.disabled =
                        index === 0;


                    down.disabled =
                        index ===
                        order.length - 1;


                    up.addEventListener(
                        "click",
                        event => {

                            event.preventDefault();


                            if (
                                index <= 0
                            ) {
                                return;
                            }


                            [
                                order[index - 1],
                                order[index]
                            ] = [
                                order[index],
                                order[index - 1]
                            ];


                            render();
                        }
                    );


                    down.addEventListener(
                        "click",
                        event => {

                            event.preventDefault();


                            if (
                                index >=
                                order.length - 1
                            ) {
                                return;
                            }


                            [
                                order[index],
                                order[index + 1]
                            ] = [
                                order[index + 1],
                                order[index]
                            ];


                            render();
                        }
                    );
                }
            );
        };


        render();


        return {

            /*
            * Enabled shortcuts, already in
            * the configured display order.
            */
            getIds:
                () =>
                    order.filter(
                        id =>
                            selected.has(id)
                    ),


            /*
            * Complete picker ordering,
            * including disabled shortcuts.
            */
            getOrder:
                () => [
                    ...order
                ]
        };
    }

    imagePicker(initialChoice = null) {

        let choice = initialChoice;


        const choices =
            this.contentEl.createDiv({
                cls:
                    "hub-project-wizard-image-choices"
            });


        const fileInput =
            choices.createEl("input");

        fileInput.type = "file";
        fileInput.accept = "image/*";


        const selected =
            this.contentEl.createDiv({
                cls:
                    "hub-project-wizard-selection"
            });


        const showSelection = () => {

            if (choice?.type === "upload") {

                selected.setText(
                    `Selected: ${choice.file.name}`
                );

            } else if (
                choice?.type === "wip"
            ) {

                selected.setText(
                    "Using placeholder image"
                );
            }
        };


        showSelection();


        fileInput.addEventListener(
            "change",
            () => {

                const file =
                    fileInput.files?.[0];

                if (!file) return;


                choice = {
                    type: "upload",
                    file
                };


                showSelection();
            }
        );


        const wip =
            choices.createEl(
                "button",
                {
                    text:
                        "Use placeholder image"
                }
            );


        wip.addEventListener(
            "click",
            () => {

                choice = {
                    type: "wip"
                };


                showSelection();
            }
        );


        return {
            getChoice: () => choice
        };
    }

    showCategoryImage() {

        this.page(
            "Choose a category image"
        );


        const picker =
            this.imagePicker(
                this.imageChoice
            );


        const actions =
            this.actions();


        this.backButton(
            actions,
            () =>
                this.showCategoryName()
        );


        const next =
            actions.createEl(
                "button",
                {
                    text: "Next"
                }
            );

        next.addClass("mod-cta");


        next.addEventListener(
            "click",
            () => {

                const choice =
                    picker.getChoice();


                if (!choice) {

                    new Notice(
                        "Choose a category image."
                    );

                    return;
                }


                this.imageChoice =
                    choice;


                this.switchPage(
                    () =>
                        this.showCategoryShortcuts()
                );
            }
        );
    }

    showCategoryShortcuts() {

        this.page(
            "Choose app shortcuts"
        );


        if (
            this.shortcutIds === null
        ) {

            this.shortcutIds =
                [
                    ...DEFAULT_SHORTCUT_IDS
                ];
        }


        const picker =
            this.shortcutPicker(
                this.shortcutIds,
                this.shortcutOrder
            );


        const actions =
            this.actions();


        this.backButton(
            actions,
            () =>
                this.showCategoryImage()
        );


        const next =
            actions.createEl(
                "button",
                {
                    text: "Next"
                }
            );

        next.addClass(
            "mod-cta"
        );


        next.addEventListener(
            "click",
            () => {

                this.shortcutIds =
                    picker.getIds();

                this.shortcutOrder =
                    picker.getOrder();


                this.switchPage(
                    () =>
                        this.showNewCategoryProjectName()
                );
            }
        );
    }

    showChangeCategoryImage(
        category
    ) {

        this.page(
            "Choose a new category image"
        );


        const picker =
            this.imagePicker();


        const actions =
            this.actions();


        const cancel =
            actions.createEl(
                "button",
                {
                    text: "Cancel"
                }
            );


        const apply =
            actions.createEl(
                "button",
                {
                    text: "Apply"
                }
            );

        apply.addClass("mod-cta");


        cancel.addEventListener(
            "click",
            () => {

                this.switchPage(
                    () =>
                        this.showCategorySelection()
                );
            }
        );


        apply.addEventListener(
            "click",
            async () => {

                const choice =
                    picker.getChoice();


                if (!choice) {

                    new Notice(
                        "Choose a category image."
                    );

                    return;
                }


                apply.disabled = true;


                try {

                    await this.service
                        .updateCategoryImage(
                            category,
                            choice
                        );


                    this.notifyCategoriesChanged({
                        id: category.id
                    });


                    this.showCategorySelection();


                } catch (error) {

                    console.error(error);

                    apply.disabled = false;


                    new Notice(
                        error.message ||
                        "Could not change category image."
                    );
                }
            }
        );
    }

    showChangeCategoryShortcuts(
        category
    ) {

        this.page(
            "Choose app shortcuts"
        );


        const picker =
            this.shortcutPicker(
                category.shortcuts ??
                    DEFAULT_SHORTCUT_IDS,

                category.shortcutOrder ??
                    DEFAULT_SHORTCUT_IDS
            );


        const actions =
            this.actions();


        const cancel =
            actions.createEl(
                "button",
                {
                    text: "Cancel"
                }
            );


        const apply =
            actions.createEl(
                "button",
                {
                    text: "Apply"
                }
            );

        apply.addClass(
            "mod-cta"
        );


        cancel.addEventListener(
            "click",
            () => {

                this.switchPage(
                    () =>
                        this.showCategorySelection()
                );
            }
        );


        apply.addEventListener(
            "click",
            async () => {

                try {

                    await this.service
                        .updateCategoryShortcuts(
                            category,
                            picker.getIds(),
                            picker.getOrder()
                        );


                    this.notifyCategoriesChanged({
                        id:
                            category.id
                    });


                    this.showCategorySelection();


                } catch (error) {

                    console.error(
                        error
                    );


                    new Notice(
                        "Could not change app shortcuts."
                    );
                }
            }
        );
    }

    showNewCategoryProjectName() {

        this.page(
            "Name your project"
        );


        const input =
            this.contentEl.createEl(
                "input",
                {
                    cls:
                        "hub-project-wizard-input"
                }
            );

        input.type = "text";
        input.placeholder = "Project name";


        const actions = this.actions();

        this.backButton(
            actions,
            () =>
                this.showCategoryShortcuts()
        );


        const create =
            actions.createEl("button", {
                text: "Create Project"
            });

        create.addClass("mod-cta");


        const submit = async () => {

            const projectName =
                input.value.trim();

            try {

                /*
                 * Validate the project before
                 * permanently creating the category.
                 */
                this.service
                    .validateProjectName(
                        projectName
                    );

                this.service
                    .assertProjectAvailable(
                        projectName
                    );


                const category =
                    await this.service
                        .createCustomCategory(
                            this.categoryName,
                            this.imageChoice,
                            this.shortcutIds ?? [],
                            this.shortcutOrder ??
                                DEFAULT_SHORTCUT_IDS
                        );


                await this.service
                    .createProject(
                        category,
                        projectName,
                        this.dashboard,
                        this.projectStatus
                    );


                this.close();

            } catch (error) {

                console.error(error);

                new Notice(
                    error.message ||
                    "Could not create project."
                );
            }
        };


        create.addEventListener(
            "click",
            submit
        );


        input.addEventListener(
            "keydown",
            event => {
                if (event.key === "Enter") {
                    submit();
                }
            }
        );


        focusWizardInput(input);
    }

    switchPage(renderPage) {
        setTimeout(renderPage, 0);
    }
}


class ProjectWizardService {

    constructor(plugin) {
        this.plugin = plugin;
        this.app = plugin.app;
        this.store =
            plugin.dataStore ??
            new HubDataStore(plugin);

        this.data = {};
        this.categories = [];
        this.workRatings = {};
        this.projectWorkRatings = {};
        this.projectWorkLogs = {};
        this.resourceWorkRatings = {};
        this.resourceWorkLogs = {};
        this.resourceFolders = {};
        this.dirtyContexts = {};
        this.dailyFocus = {};
        this.pendingFocus = null;
        this.activityLog = [];
        this.completedTaskHistory = [];
        this.completedTaskChecks = [];
        this.projectCardOrder = {
            active: [],
            future: [],
            shelved: []
        };
    }


    async load() {

        this.data =
            await this.store.load()
            ?? {};

            this.workRatings =
                (
                    this.data.workRatings &&
                    typeof this.data.workRatings
                        === "object" &&
                    !Array.isArray(
                        this.data.workRatings
                    )
                )
                    ? this.data.workRatings
                    : {};

            this.projectWorkRatings =
                (
                    this.data.projectWorkRatings &&
                    typeof this.data.projectWorkRatings ===
                        "object" &&
                    !Array.isArray(
                        this.data.projectWorkRatings
                    )
                )
                    ? this.data.projectWorkRatings
                    : {};

            this.projectWorkLogs =
                (
                    this.data.projectWorkLogs &&
                    typeof this.data.projectWorkLogs ===
                        "object" &&
                    !Array.isArray(
                        this.data.projectWorkLogs
                    )
                )
                    ? this.data.projectWorkLogs
                    : {};

            this.resourceWorkRatings =
                this.data.resourceWorkRatings &&
                typeof this.data.resourceWorkRatings === "object" &&
                !Array.isArray(this.data.resourceWorkRatings)
                    ? this.data.resourceWorkRatings
                    : {};

            this.resourceWorkLogs =
                this.data.resourceWorkLogs &&
                typeof this.data.resourceWorkLogs === "object" &&
                !Array.isArray(this.data.resourceWorkLogs)
                    ? this.data.resourceWorkLogs
                    : {};

            this.resourceFolders =
                this.data.resourceFolders &&
                typeof this.data.resourceFolders === "object" &&
                !Array.isArray(this.data.resourceFolders)
                    ? this.data.resourceFolders
                    : {};

            this.dirtyContexts =
                this.data.dirtyContexts &&
                typeof this.data.dirtyContexts === "object" &&
                !Array.isArray(this.data.dirtyContexts)
                    ? this.data.dirtyContexts
                    : {};

            this.dailyFocus =
                (
                    this.data.dailyFocus &&
                    typeof this.data.dailyFocus ===
                        "object" &&
                    !Array.isArray(
                        this.data.dailyFocus
                    )
                )
                    ? this.data.dailyFocus
                    : {};

            this.pendingFocus =
                (
                    this.data.pendingFocus &&
                    typeof this.data.pendingFocus ===
                        "object" &&
                    !Array.isArray(
                        this.data.pendingFocus
                    ) &&
                    parseLocalISODate(
                        this.data.pendingFocus
                            .sourceDate
                    )
                )
                    ? {
                        sourceDate:
                            this.data.pendingFocus
                                .sourceDate,
                        items:
                            normalizeFocusItems(
                                this.data.pendingFocus
                                    .items
                            )
                    }
                    : null;

            this.activityLog =
                Array.isArray(
                    this.data.activityLog
                )
                    ? this.data.activityLog
                    : [];

            this.completedTaskHistory =
                Array.isArray(
                    this.data.completedTaskHistory
                )
                    ? this.data.completedTaskHistory
                        .filter(
                            item =>
                                item &&
                                typeof item === "object" &&
                                typeof item.text === "string" &&
                                typeof item.path === "string"
                        )
                    : [];

            this.completedTaskChecks =
                Array.isArray(
                    this.data.completedTaskChecks
                )
                    ? this.data.completedTaskChecks
                        .filter(
                            item =>
                                item &&
                                typeof item === "object" &&
                                typeof item.path === "string" &&
                                typeof item.text === "string" &&
                                Number.isInteger(item.line) &&
                                Number.isFinite(item.timestamp)
                        )
                    : [];

            const savedProjectCardOrder =
                this.data.projectCardOrder;

            this.projectCardOrder =
                Object.fromEntries(
                    [
                        "active",
                        "future",
                        "shelved"
                    ].map(status => [
                        status,
                        Array.isArray(
                            savedProjectCardOrder?.[
                                status
                            ]
                        )
                            ? [
                                ...new Set(
                                    savedProjectCardOrder[
                                        status
                                    ]
                                        .map(String)
                                        .filter(Boolean)
                                )
                            ]
                            : []
                    ])
                );


            this.data.activityLog =
                this.activityLog;        

            this.data.completedTaskHistory =
                this.completedTaskHistory;

            this.data.completedTaskChecks =
                this.completedTaskChecks;

            this.data.projectCardOrder =
                this.projectCardOrder;


            this.data.workRatings =
                this.workRatings;

            this.data.projectWorkRatings =
                this.projectWorkRatings;

            this.data.projectWorkLogs =
                this.projectWorkLogs;

            this.data.resourceWorkRatings =
                this.resourceWorkRatings;

            this.data.resourceWorkLogs =
                this.resourceWorkLogs;

            this.data.resourceFolders =
                this.resourceFolders;

            this.data.dirtyContexts =
                this.dirtyContexts;

            this.data.dailyFocus =
                this.dailyFocus;

            this.data.pendingFocus =
                this.pendingFocus;

        /*
        * New format.
        */
        if (
            Array.isArray(
                this.data.categories
            )
        ) {
            this.categories =
                this.data.categories;

            return;
        }


        /*
        * One-time migration from the
        * old customCategories format.
        */

        const oldCustomCategories =
            Array.isArray(
                this.data.customCategories
            )
                ? this.data.customCategories
                : [];


        this.categories = [
            ...DEFAULT_CATEGORIES.map(
                category => ({
                    ...category
                })
            ),
            ...oldCustomCategories
        ];


        this.data.categories =
            this.categories;

        delete this.data.customCategories;


        await this.store.save(
            this.data
        );
    }


    open(
        dashboard,
        projectStatus
    ) {

        new ProjectWizardModal(
            this,
            dashboard,
            projectStatus
        ).open();
    }


    getCategories() {
        return this.categories;
    }

    async ensureCategoryShortcuts() {

        let changed = false;


        for (
            const category
            of this.categories
        ) {

            const shortcuts =
                Array.isArray(
                    category.shortcuts
                )
                    ? normalizeShortcutIds(
                        category.shortcuts
                    )
                    : [
                        ...DEFAULT_SHORTCUT_IDS
                    ];


            const shortcutOrder =
                normalizeShortcutOrder(
                    category.shortcutOrder ??
                    shortcuts
                );


            if (
                JSON.stringify(
                    category.shortcuts
                ) !==
                JSON.stringify(
                    shortcuts
                )
            ) {

                category.shortcuts =
                    shortcuts;

                changed = true;
            }


            if (
                JSON.stringify(
                    category.shortcutOrder
                ) !==
                JSON.stringify(
                    shortcutOrder
                )
            ) {

                category.shortcutOrder =
                    shortcutOrder;

                changed = true;
            }
        }


        if (changed) {

            await this.saveCategories();
        }
    }

    async ensureProjectIds() {

        const projects =
            this.app.vault
                .getMarkdownFiles()
                .filter(file => {

                    if (
                        !file.path.startsWith(
                            "Projects/"
                        )
                    ) {
                        return false;
                    }


                    const frontmatter =
                        this.app.metadataCache
                            .getFileCache(file)
                            ?.frontmatter;


                    return (
                        frontmatter?.type ===
                        "project"
                    );
                });


        for (const file of projects) {

            const frontmatter =
                this.app.metadataCache
                    .getFileCache(file)
                    ?.frontmatter;


            if (
                typeof frontmatter?.projectId ===
                    "string" &&
                frontmatter.projectId.trim()
            ) {
                continue;
            }


            await this.app.fileManager
                .processFrontMatter(
                    file,
                    metadata => {

                        /*
                        * Check again inside the write
                        * in case something changed.
                        */
                        if (
                            typeof metadata.projectId ===
                                "string" &&
                            metadata.projectId.trim()
                        ) {
                            return;
                        }


                        metadata.projectId =
                            randomUUID();
                    }
                );


            await yieldToObsidian();
        }
    }

    getPublicCategories() {

        return this.categories.map(
            category => ({
                id:
                    category.id,

                name:
                    category.name,

                image:
                    category.image,

                shortcuts:
                    [
                        ...normalizeShortcutIds(
                            category.shortcuts
                        )
                    ],

                resourceFolders:
                    this.normalizeResourceFolderIds(
                        category.resourceFolders
                    )
            })
        );
    }


    getProjectCardOrder() {

        return Object.fromEntries(
            Object.entries(
                this.projectCardOrder
            ).map(
                ([status, projectIds]) => [
                    status,
                    [...projectIds]
                ]
            )
        );
    }


    async setProjectCardOrder(
        status,
        projectIds
    ) {

        if (
            ![
                "active",
                "future",
                "shelved"
            ].includes(status) ||
            !Array.isArray(projectIds)
        ) {
            throw new Error(
                "Invalid project-card order."
            );
        }


        const previous =
            this.projectCardOrder[
                status
            ];

        const normalized =
            [
                ...new Set(
                    projectIds
                        .map(String)
                        .filter(Boolean)
                )
            ];


        this.projectCardOrder = {
            ...this.projectCardOrder,
            [status]: normalized
        };

        this.data.projectCardOrder =
            this.projectCardOrder;


        try {

            await this.store.save(
                this.data
            );

        } catch (error) {

            this.projectCardOrder = {
                ...this.projectCardOrder,
                [status]: previous
            };

            this.data.projectCardOrder =
                this.projectCardOrder;

            throw error;
        }


        return [...normalized];
    }

    getProjectsUsingCategory(
        category
    ) {

        return this.app.vault
            .getMarkdownFiles()
            .filter(file => {

                if (
                    !file.path.startsWith(
                        "Projects/"
                    )
                ) {
                    return false;
                }

                const frontmatter =
                    this.app.metadataCache
                        .getFileCache(file)
                        ?.frontmatter;

                if (
                    frontmatter?.type !==
                    "project"
                ) {
                    return false;
                }

                return (
                    frontmatter.category ===
                        category.id ||
                    frontmatter.category ===
                        category.name
                );
            });
    }

    getWorkRatings() {

        return {
            ...this.workRatings
        };
    }

    getProjectRecords() {

        const projects = [];


        for (
            const file
            of this.app.vault
                .getMarkdownFiles()
        ) {

            const frontmatter =
                this.app.metadataCache
                    .getFileCache(file)
                    ?.frontmatter;


            if (
                frontmatter?.type !==
                    "project" ||
                typeof frontmatter.projectId !==
                    "string" ||
                !frontmatter.projectId.trim()
            ) {
                continue;
            }


            const root =
                file.parent?.path;


            if (!root) {
                continue;
            }


            projects.push({
                projectId:
                    frontmatter.projectId,

                name:
                    file.basename,

                path:
                    file.path,

                root,

                categoryId: frontmatter.category,
                status:
                    frontmatter.status,

                contextKind:
                    "project",

                resourceFolderIds:
                    this.normalizeResourceFolderIds(
                        frontmatter.resource_folders
                    )
            });
        }


        return projects;
    }


    getFocusContexts() {
        return [...this.getProjectRecords().filter(project => project.status === "active"),
            ...this.getResourceTypes()];
    }

    getProjectById(
        projectId
    ) {
        return findProjectById(
            this.getProjectRecords(),
            projectId
        );
    }


    getProjectForPath(
        path
    ) {
        return findProjectForPath(
            this.getProjectRecords(),
            path
        );
    }


    getResourceTypes() {
        return RESOURCE_TYPES.map(publicResourceType);
    }


    getResourceById(reference) {
        return publicResourceType(
            findResourceByReference(
                RESOURCE_TYPES,
                reference
            )
        );
    }


    getResourceForPath(path) {
        return publicResourceType(
            findResourceForPath(
                RESOURCE_TYPES,
                path
            )
        );
    }


    getContextForPath(path) {
        return this.getResourceForPath(path) ||
            this.getProjectForPath(path);
    }


    normalizedDirtyContextRecord(date) {
        const value =
            this.dirtyContexts?.[date];

        return {
            projects: [
                ...new Set(
                    (Array.isArray(value?.projects)
                        ? value.projects
                        : [])
                        .map(String)
                        .filter(Boolean)
                )
            ],
            resources: [
                ...new Set(
                    (Array.isArray(value?.resources)
                        ? value.resources
                        : [])
                        .map(id =>
                            String(id).replace(
                                /^resource:/,
                                ""
                            )
                        )
                        .filter(Boolean)
                )
            ],
            resolvedAt:
                Number(value?.resolvedAt) || 0,
            updatedAt:
                value?.updatedAt ?? null
        };
    }


    activityDirtyContexts(
        date,
        afterTimestamp = 0
    ) {
        const projects = new Set();
        const resources = new Set();
        const validProjectIds = new Set(
            this.getProjectRecords()
                .map(project => project.projectId)
        );
        const validResourceIds = new Set(
            RESOURCE_TYPES.map(resource => resource.id)
        );

        for (const item of this.activityLog) {
            const timestamp = Number(item?.timestamp);

            if (
                !Number.isFinite(timestamp) ||
                timestamp <= afterTimestamp ||
                localISODate(new Date(timestamp)) !== date
            ) {
                continue;
            }

            if (
                item.contextKind === "resource" ||
                String(item.projectId ?? "")
                    .startsWith("resource:")
            ) {
                const resourceId = String(
                    item.resourceType ??
                    item.projectId ??
                    ""
                ).replace(/^resource:/, "");

                if (validResourceIds.has(resourceId)) {
                    resources.add(resourceId);
                }
            } else if (
                item.projectId &&
                validProjectIds.has(item.projectId)
            ) {
                projects.add(item.projectId);
            }
        }

        return {
            projects: [...projects],
            resources: [...resources]
        };
    }


    getDirtyContexts(date) {
        const stored =
            this.normalizedDirtyContextRecord(date);
        const fromActivity =
            this.activityDirtyContexts(
                date,
                stored.resolvedAt
            );

        return {
            projects: [
                ...new Set([
                    ...stored.projects,
                    ...fromActivity.projects
                ])
            ].filter(projectId =>
                this.getProjectById(projectId)
            ),
            resources: [
                ...new Set([
                    ...stored.resources,
                    ...fromActivity.resources
                ])
            ].filter(resourceId =>
                this.getResourceById(resourceId)
            ),
            resolvedAt: stored.resolvedAt
        };
    }


    async ensureDirtyContexts(date) {
        const current =
            this.normalizedDirtyContextRecord(date);
        const merged =
            this.getDirtyContexts(date);

        if (
            current.projects.length === merged.projects.length &&
            current.resources.length === merged.resources.length &&
            current.projects.every(id =>
                merged.projects.includes(id)
            ) &&
            current.resources.every(id =>
                merged.resources.includes(id)
            )
        ) {
            return merged;
        }

        this.dirtyContexts = {
            ...this.dirtyContexts,
            [date]: {
                projects: merged.projects,
                resources: merged.resources,
                resolvedAt: current.resolvedAt,
                updatedAt: new Date().toISOString()
            }
        };
        this.data.dirtyContexts =
            this.dirtyContexts;

        await this.store.save(this.data);
        return merged;
    }


    async markContextDirty(
        date,
        context
    ) {
        if (!parseLocalISODate(date) || !context) {
            return false;
        }

        const current =
            this.normalizedDirtyContextRecord(date);
        const collection =
            context.contextKind === "resource"
                ? "resources"
                : "projects";
        const id =
            context.contextKind === "resource"
                ? context.resourceType
                : context.projectId;

        if (!id || current[collection].includes(id)) {
            return false;
        }

        current[collection].push(id);
        current.updatedAt =
            new Date().toISOString();

        this.dirtyContexts = {
            ...this.dirtyContexts,
            [date]: current
        };
        this.data.dirtyContexts =
            this.dirtyContexts;

        await this.store.save(this.data);
        return true;
    }


    async clearDirtyContexts(
        date,
        projectIds = [],
        resourceIds = []
    ) {
        const current =
            this.normalizedDirtyContextRecord(date);
        const projectsToClear =
            new Set(projectIds.map(String));
        const resourcesToClear =
            new Set(
                resourceIds.map(id =>
                    String(id).replace(/^resource:/, "")
                )
            );

        this.dirtyContexts = {
            ...this.dirtyContexts,
            [date]: {
                projects: current.projects.filter(
                    id => !projectsToClear.has(id)
                ),
                resources: current.resources.filter(
                    id => !resourcesToClear.has(id)
                ),
                resolvedAt: Date.now(),
                updatedAt: new Date().toISOString()
            }
        };
        this.data.dirtyContexts =
            this.dirtyContexts;

        await this.store.save(this.data);
    }


    replaceResourceRoot(path, oldRoot, newRoot) {
        return replacePathRoot(
            path,
            oldRoot,
            newRoot
        );
    }


    async migrateStoredResourceReferences(resource, legacy) {
        let changed = false;
        const migratePath = value => {
            const migrated = this.replaceResourceRoot(
                value,
                legacy.root,
                resource.root
            );
            if (migrated !== value) changed = true;
            return migrated;
        };

        for (const record of Object.values(this.resourceFolders)) {
            if (!record || typeof record !== "object") continue;
            record.path = migratePath(record.path);
            if (record.resourceType === resource.id) {
                record.resourceType = resource.id;
            }
        }

        for (const collection of [
            this.activityLog,
            this.completedTaskHistory,
            this.completedTaskChecks
        ]) {
            for (const item of collection) {
                if (!item || typeof item !== "object") continue;
                item.path = migratePath(item.path);
                item.oldPath = migratePath(item.oldPath);
                if (item.projectId === `resource:${resource.id}`) {
                    if (item.project !== resource.label) changed = true;
                    item.project = resource.label;
                    if ("projectName" in item) {
                        if (item.projectName !== resource.label) changed = true;
                        item.projectName = resource.label;
                    }
                }
            }
        }

        const updateFocusItems = items => {
            for (const item of Array.isArray(items) ? items : []) {
                if (item?.projectId !== `resource:${resource.id}`) continue;
                if (item.projectName !== resource.label) changed = true;
                item.projectName = resource.label;
            }
        };

        for (const items of Object.values(this.dailyFocus)) {
            updateFocusItems(items);
        }
        updateFocusItems(this.pendingFocus?.items);

        if (changed) {
            this.data.resourceFolders = this.resourceFolders;
            await this.store.save(this.data);
        }
    }


    async renameResourcePath(oldPath, newPath) {
        if (oldPath === newPath) return false;

        const oldEntry = this.app.vault.getAbstractFileByPath(oldPath);
        const oldExists = oldEntry ||
            await this.app.vault.adapter.exists(oldPath);
        const newExists = this.app.vault.getAbstractFileByPath(newPath) ||
            await this.app.vault.adapter.exists(newPath);

        if (!oldExists || newExists) return false;

        if (oldEntry) {
            await this.app.fileManager.renameFile(oldEntry, newPath);
        } else {
            await this.app.vault.adapter.rename(oldPath, newPath);
        }

        await yieldToObsidian();
        return true;
    }


    async migrateLegacyResource(resource) {
        for (const legacy of resource.legacyRoots ?? []) {
            const movedRoot = await this.renameResourcePath(
                legacy.root,
                resource.root
            );

            const legacyStillExists =
                await this.app.vault.adapter.exists(legacy.root);
            const currentRootExists =
                await this.app.vault.adapter.exists(resource.root);

            if (
                movedRoot ||
                (!legacyStillExists && currentRootExists)
            ) {
                await this.migrateStoredResourceReferences(resource, legacy);
            }

            await this.renameResourcePath(
                `${resource.root}/${legacy.hubName}`,
                resource.hubPath
            );
        }
    }


    async ensureResources() {
        await this.ensureFolder(RESOURCE_ROOT);

        for (const resource of RESOURCE_TYPES) {
            await this.migrateLegacyResource(resource);
            await this.ensureFolder(resource.root);

            const existing = this.app.vault.getAbstractFileByPath(
                resource.hubPath
            );

            const existsOnDisk =
                existing ||
                await this.app.vault.adapter.exists(
                    resource.hubPath
                );

            if (!existsOnDisk) {
                const content = [
                    "---",
                    "type: resource",
                    `resourceType: ${JSON.stringify(resource.id)}`,
                    "cssclasses: [dashboard]",
                    "folder_order: []",
                    "---",
                    "",
                    "```dataviewjs",
                    'await dv.view("System/Dashboards/Project")',
                    "```",
                    ""
                ].join("\n");

                await this.app.vault.create(resource.hubPath, content);
                await yieldToObsidian();
            }
        }

        await this.syncResourceFolders();
    }


    async syncResourceFolders() {
        let changed = false;
        const seenPaths = new Set();
        const scannedResourceTypes = new Set();

        for (const resource of RESOURCE_TYPES) {
            const root = this.app.vault.getAbstractFileByPath(resource.root);
            if (!(root instanceof TFolder)) continue;

            scannedResourceTypes.add(resource.id);

            for (const child of root.children) {
                if (!(child instanceof TFolder)) continue;
                seenPaths.add(child.path);

                let record = Object.values(this.resourceFolders)
                    .find(item => item?.path === child.path);

                if (!record) {
                    const relativePath =
                        child.path.slice(resource.root.length);
                    const legacyPaths = new Set(
                        (resource.legacyRoots ?? [])
                            .map(legacy => `${legacy.root}${relativePath}`)
                    );
                    record = Object.values(this.resourceFolders)
                        .find(item => legacyPaths.has(item?.path));
                }

                if (!record) {
                    const id = randomUUID();
                    this.resourceFolders[id] = {
                        id,
                        resourceType: resource.id,
                        path: child.path,
                        name: child.name
                    };
                    changed = true;
                } else if (
                    record.path !== child.path ||
                    record.name !== child.name ||
                    record.resourceType !== resource.id
                ) {
                    record.path = child.path;
                    record.name = child.name;
                    record.resourceType = resource.id;
                    changed = true;
                }
            }
        }

        for (const [id, record] of Object.entries(this.resourceFolders)) {
            if (!record?.path) {
                delete this.resourceFolders[id];
                changed = true;
                continue;
            }

            if (seenPaths.has(record.path)) continue;

            const owner = this.getResourceForPath(record.path);

            if (!owner) {
                delete this.resourceFolders[id];
                changed = true;
                continue;
            }

            /*
             * During startup/refresh, Obsidian's vault cache can briefly omit
             * a Resource root or one of its children. Preserve its stable ID
             * unless the root was fully scanned and the folder is also gone
             * from disk; otherwise category/project selections become stale.
             */
            if (
                !scannedResourceTypes.has(owner.id)
            ) {
                continue;
            }

            const existsOnDisk =
                await this.app.vault.adapter.exists(record.path);

            if (!existsOnDisk) {
                delete this.resourceFolders[id];
                changed = true;
            }
        }

        if (changed) {
            this.data.resourceFolders = this.resourceFolders;
            await this.store.save(this.data);
        }

        return this.getResourceFolders();
    }


    getResourceFolders(ids = null) {
        const filter = Array.isArray(ids) ? new Set(ids.map(String)) : null;
        return Object.values(this.resourceFolders)
            .filter(record => !filter || filter.has(record.id))
            .filter(record =>
                this.app.vault.getAbstractFileByPath(record.path) instanceof TFolder
            )
            .map(record => ({ ...record }))
            .sort((a, b) => {
                const aType = RESOURCE_TYPES.findIndex(item => item.id === a.resourceType);
                const bType = RESOURCE_TYPES.findIndex(item => item.id === b.resourceType);
                return aType - bType ||
                    a.name.localeCompare(b.name, undefined, { sensitivity: "base" });
            });
    }


    async handleResourceFolderRename(file, oldPath) {
        if (!(file instanceof TFolder)) return;

        const records = Object.values(this.resourceFolders)
            .filter(item =>
                item?.path === oldPath ||
                item?.path?.startsWith(`${oldPath}/`)
            );

        if (records.length > 0) {
            for (const record of records) {
                record.path = this.replaceResourceRoot(
                    record.path,
                    oldPath,
                    file.path
                );
                if (record.path === file.path) record.name = file.name;
                const resource = this.getResourceForPath(record.path);
                if (resource) record.resourceType = resource.resourceType;
            }
            this.data.resourceFolders = this.resourceFolders;
            await this.store.save(this.data);
        }

        await this.syncResourceFolders();
    }


    normalizeResourceFolderIds(ids) {
        const valid = new Set(Object.keys(this.resourceFolders));
        return [...new Set(Array.isArray(ids) ? ids.map(String) : [])]
            .filter(id => valid.has(id));
    }


    async setProjectResourceFolders(file, ids) {
        const normalized = this.normalizeResourceFolderIds(ids);
        await this.app.fileManager.processFrontMatter(file, frontmatter => {
            frontmatter.resource_folders = normalized;
        });
        return normalized;
    }


    async updateCategoryResourceFolders(category, ids) {
        category.resourceFolders = this.normalizeResourceFolderIds(ids);
        await this.saveCategories();
    }


    getResourceWorkRatings(resourceId) {
        const id = String(resourceId ?? "").replace(/^resource:/, "");
        const ratings = this.resourceWorkRatings[id];
        return { ...(ratings && typeof ratings === "object" ? ratings : {}) };
    }


    getResourceWorkLogs(resourceId) {
        const id = String(resourceId ?? "").replace(/^resource:/, "");
        const logs = this.resourceWorkLogs[id];
        return logs && typeof logs === "object" && !Array.isArray(logs)
            ? Object.fromEntries(Object.entries(logs).map(([date, entry]) => [date, { ...entry }]))
            : {};
    }


    getProjectWorkRatings(
        projectId
    ) {

        const ratings =
            this.projectWorkRatings[
                projectId
            ];


        return {
            ...(
                ratings &&
                typeof ratings ===
                    "object"
                    ? ratings
                    : {}
            )
        };
    }


    getProjectWorkLogs(
        projectId
    ) {

        const logs =
            this.projectWorkLogs[
                projectId
            ];


        if (
            !logs ||
            typeof logs !== "object" ||
            Array.isArray(logs)
        ) {
            return {};
        }


        return Object.fromEntries(
            Object.entries(logs)
                .map(
                    ([date, entry]) => [
                        date,
                        {
                            ...entry
                        }
                    ]
                )
        );
    }


    getDailyFocus(
        date
    ) {

        if (
            !Object.prototype.hasOwnProperty.call(
                this.dailyFocus,
                date
            )
        ) {
            return null;
        }


        return normalizeFocusItems(
            this.dailyFocus[date]
        );
    }


    getPendingFocus(
        sourceDate = null
    ) {

        if (
            !this.pendingFocus ||
            (
                sourceDate &&
                this.pendingFocus.sourceDate !==
                    sourceDate
            )
        ) {
            return null;
        }


        return {
            sourceDate:
                this.pendingFocus.sourceDate,
            items:
                normalizeFocusItems(
                    this.pendingFocus.items
                )
        };
    }


    async activatePendingFocus(
        date
    ) {

        if (
            !parseLocalISODate(date) ||
            !this.pendingFocus ||
            this.pendingFocus.sourceDate >= date
        ) {
            return false;
        }


        const nextDailyFocus = {
            ...this.dailyFocus
        };


        if (
            !Object.prototype.hasOwnProperty.call(
                nextDailyFocus,
                date
            )
        ) {
            nextDailyFocus[date] =
                normalizeFocusItems(
                    this.pendingFocus.items
                );
        }


        const nextData = {
            ...this.data,
            dailyFocus:
                nextDailyFocus,
            pendingFocus:
                null
        };


        await this.store.save(
            nextData
        );


        this.dailyFocus =
            nextDailyFocus;
        this.pendingFocus =
            null;
        this.data =
            nextData;


        return true;
    }


    getProgressReports(
        projectId = null
    ) {

        const resourceQuery =
            projectId && typeof projectId === "object" && projectId.kind === "resource";

        const resourceId =
            resourceQuery
                ? projectId.id ?? null
                : typeof projectId === "string" && projectId.startsWith("resource:")
                    ? projectId.slice("resource:".length)
                    : null;

        if (resourceQuery || resourceId) {
            const ids = resourceId ? [resourceId] : [...new Set([
                ...Object.keys(this.resourceWorkRatings), ...Object.keys(this.resourceWorkLogs)
            ])];
            const resources = ids.map(id => this.getResourceById(id) ?? {
                resourceType: id,
                label: Object.values(this.getResourceWorkLogs(id)).find(log => log.resourceName)?.resourceName ??
                    RESOURCE_TYPES.find(resource => resource.id === id)?.label ?? "Unavailable resource"
            });
            const reports = [];

            for (const resource of resources) {
                const id = resource.resourceType;
                const ratings = this.getResourceWorkRatings(id);
                const logs = this.getResourceWorkLogs(id);
                const dates = new Set([...Object.keys(ratings), ...Object.keys(logs)]);

                for (const date of dates) {
                    if (!parseLocalISODate(date)) continue;
                    const score = Number(ratings[date]);
                    const log = logs[date] ?? {};
                    const report = {
                        date,
                        targetKind: "resource",
                        resourceId: id,
                        resourceName: log.resourceName ?? resource.label,
                        projectId: `resource:${id}`,
                        projectName: log.resourceName ?? resource.label,
                        score: Number.isInteger(score) && score >= 1 && score <= 4 ? score : null,
                        summary: typeof log.summary === "string" ? log.summary : "",
                        context: log.context,
                        timestamp: Number(log.timestamp) > 0 ? Number(log.timestamp) : null
                    };
                    if (report.summary || report.score !== null) reports.push(report);
                }
            }

            return reports.sort(
                (a, b) =>
                    b.date.localeCompare(a.date) ||
                    a.resourceName.localeCompare(b.resourceName, undefined, { sensitivity: "base" })
            );
        }

        if (projectId && typeof projectId === "object" && projectId.kind === "project") {
            projectId = projectId.id ?? null;
        }

        const projects =
            this.getProjectRecords();


        const projectsById =
            new Map(
                projects.map(
                    project => [
                        project.projectId,
                        project
                    ]
                )
            );


        const projectIds =
            projectId
                ? [projectId]
                : [
                    ...new Set([
                        ...Object.keys(
                            this.projectWorkRatings
                        ),
                        ...Object.keys(
                            this.projectWorkLogs
                        )
                    ])
                ];


        const reports = [];


        for (
            const id
            of projectIds
        ) {

            const ratings =
                this.getProjectWorkRatings(id);

            const logs =
                this.getProjectWorkLogs(id);

            const dates =
                new Set([
                    ...Object.keys(ratings),
                    ...Object.keys(logs)
                ]);


            for (
                const date
                of dates
            ) {

                if (!parseLocalISODate(date)) {
                    continue;
                }


                const score =
                    Number(ratings[date]);

                const log =
                    logs[date] ?? {};

                const summary =
                    typeof log.summary === "string"
                        ? log.summary
                        : "";


                if (
                    !summary &&
                    (
                        !Number.isInteger(score) ||
                        score < 1 ||
                        score > 4
                    )
                ) {
                    continue;
                }


                const project =
                    projectsById.get(id);


                reports.push({
                    date,
                    targetKind: "project",
                    projectId: id,
                    context: log.context,
                    projectName:
                        log.projectName ??
                        project?.name ??
                        "Unavailable project",
                    projectStatus:
                        project?.status ??
                        null,
                    score:
                        Number.isInteger(score) &&
                        score >= 1 &&
                        score <= 4
                            ? score
                            : null,
                    summary,
                    timestamp:
                        Number.isFinite(
                            Number(log.timestamp)
                        ) &&
                        Number(log.timestamp) > 0
                            ? Number(
                                log.timestamp
                            )
                            : null
                });
            }
        }


        return reports.sort(
            (a, b) =>
                b.date.localeCompare(a.date) ||
                a.projectName.localeCompare(
                    b.projectName,
                    undefined,
                    {
                        sensitivity:
                            "base"
                    }
                )
        );
    }

    getHomeMomentumProgress(
        scope = "projects"
    ) {

        const byDate =
            new Map();

        const contexts =
            scope === "resources"
                ? this.getResourceTypes().map(resource => ({
                    projectId: `resource:${resource.resourceType}`,
                    name: resource.label,
                    ratings: this.getResourceWorkRatings(resource.resourceType)
                }))
                : this.getProjectRecords().map(project => ({
                    projectId: project.projectId,
                    name: project.name,
                    ratings: this.getProjectWorkRatings(project.projectId)
                }));

        for (
            const context
            of contexts
        ) {

            const ratings =
                context.ratings;


            for (
                const [
                    date,
                    rawScore
                ]
                of Object.entries(
                    ratings
                )
            ) {

                if (
                    !/^\d{4}-\d{2}-\d{2}$/
                        .test(date)
                ) {
                    continue;
                }


                const score =
                    Number(
                        rawScore
                    );


                /*
                * Missing/zero progress contributes
                * nothing to Home Momentum.
                */
                if (
                    !Number.isInteger(score) ||
                    score < 1 ||
                    score > 4
                ) {
                    continue;
                }


                if (
                    !byDate.has(date)
                ) {

                    byDate.set(
                        date,
                        []
                    );
                }


                byDate
                    .get(date)
                    .push({
                        projectId:
                            context.projectId,

                        name:
                            context.name,

                        score
                    });
            }
        }


        const ratings =
            {};

        const contributors =
            {};


        for (
            const [
                date,
                dayContributors
            ]
            of byDate
        ) {

            dayContributors.sort(
                (a, b) =>
                    b.score - a.score ||
                    a.name.localeCompare(
                        b.name,
                        undefined,
                        {
                            sensitivity:
                                "base"
                        }
                    )
            );


            ratings[date] =
                calculateHomeMomentum(
                    dayContributors.map(
                        project =>
                            project.score
                    )
                );


            contributors[date] =
                dayContributors;
        }


        return {
            ratings,
            contributors
        };
    }

    getActivityLog() {
        return queryHistory(this.activityLog);
    }


    async recordActivity(entry) {

        this.activityLog =
            reduceActivityLog(
                this.activityLog,
                entry
            );


        this.data.activityLog =
            this.activityLog;


        await this.store.save(
            this.data
        );
    }

    async setWorkRating(
        date,
        score
    ) {

        if (
            !/^\d{4}-\d{2}-\d{2}$/
                .test(date)
        ) {
            throw new Error(
                "Invalid work-rating date."
            );
        }


        if (
            !Number.isInteger(score) ||
            score < 0 ||
            score > 4
        ) {
            throw new Error(
                "Invalid work rating."
            );
        }


        this.workRatings[date] =
            score;


        this.data.workRatings =
            this.workRatings;


        await this.store.save(
            this.data
        );
    }

    async setProjectWorkRatings(
        date,
        scoresByProject
    ) {

        if (
            !/^\d{4}-\d{2}-\d{2}$/
                .test(date)
        ) {

            throw new Error(
                "Invalid project-rating date."
            );
        }


        const entries =
            Object.entries(
                scoresByProject ?? {}
            );


        for (
            const [
                projectId,
                score
            ]
            of entries
        ) {

            if (
                typeof projectId !==
                    "string" ||
                !projectId.trim()
            ) {

                throw new Error(
                    "Invalid project ID."
                );
            }


            if (
                !Number.isInteger(score) ||
                score < 1 ||
                score > 4
            ) {

                throw new Error(
                    "Invalid project advancement rating."
                );
            }
        }


        for (
            const [
                projectId,
                score
            ]
            of entries
        ) {

            if (
                !this.projectWorkRatings[
                    projectId
                ] ||
                typeof this.projectWorkRatings[
                    projectId
                ] !== "object"
            ) {

                this.projectWorkRatings[
                    projectId
                ] = {};
            }


            this.projectWorkRatings[
                projectId
            ][date] =
                score;
        }


        this.data.projectWorkRatings =
            this.projectWorkRatings;


        await this.store.save(
            this.data
        );
    }


    getCompletedTaskHistory(projectId = null) {
        return queryHistory(this.completedTaskHistory, { workspaceId: projectId });
    }


    getCompletedTaskCheck(path, line, text, hubTaskId) {
        const checks = this.completedTaskChecks.filter(item => item.kind !== "step");
        const identified = hubTaskId ? checks.filter(item => item.hubTaskId === hubTaskId) : [];
        if (identified.length) return identified.length === 1 ? identified[0] : null;
        const matches = checks.filter(item => item.path === path && normalizedTaskText(item.text) === normalizedTaskText(text));
        return matches.find(item => item.line === line) ?? (matches.length === 1 ? matches[0] : null);
    }

    getCompletedTaskTimestamp(path, line, text, hubTaskId) {
        return this.getCompletedTaskCheck(path, line, text, hubTaskId)?.timestamp ?? null;
    }

    async recordTaskMutation(edit, context, timestamp = Date.now()) {
        if (!edit.changed && !edit.progressTransitions?.length) return false;
        const previousChecks = this.completedTaskChecks;
        const previousHistory = this.completedTaskHistory;
        const next = taskProgressMutation(previousChecks, previousHistory, edit, context, timestamp, randomUUID);
        this.completedTaskChecks = this.data.completedTaskChecks = next.checks;
        this.completedTaskHistory = this.data.completedTaskHistory = next.history;
        try { await this.store.save(this.data); }
        catch (error) {
            this.completedTaskChecks = this.data.completedTaskChecks = previousChecks;
            this.completedTaskHistory = this.data.completedTaskHistory = previousHistory;
            throw error;
        }
        return next.changed;
    }

    getCompletedTaskHistoryId(path, line, text, hubTaskId) {
        const check = this.getCompletedTaskCheck(path, line, text, hubTaskId);
        return check?.historyId && this.completedTaskHistory.some(record => record.id === check.historyId)
            ? check.historyId : null;
    }


    async removeClearedTaskChecks(
        clearedTasks
    ) {

        const previous =
            this.completedTaskChecks;

        const clearedByPath =
            new Map();


        for (const task of clearedTasks) {

            if (!clearedByPath.has(task.path)) {
                clearedByPath.set(
                    task.path,
                    []
                );
            }


            clearedByPath.get(task.path)
                .push(task);
        }


        const checksToRemove =
            new Set();


        for (const task of clearedTasks) {

            const exact =
                previous.find(
                    item =>
                        item.path === task.path &&
                        item.line === task.line &&
                        item.text === task.text
                );


            if (exact) {
                checksToRemove.add(exact);
                continue;
            }


            const matches =
                previous.filter(
                    item =>
                        item.path === task.path &&
                        item.text === task.text
                );


            if (matches.length === 1) {
                checksToRemove.add(
                    matches[0]
                );
            }
        }


        this.completedTaskChecks =
            previous
                .filter(
                    item =>
                        !checksToRemove.has(item) && !clearedTasks.some(task => task.hubTaskId && (item.hubTaskId === task.hubTaskId || item.parentTaskId === task.hubTaskId)) && !(clearedByPath.get(item.path) ?? []).some(task =>
                            item.line >= task.line && item.line < task.line + (task.removedLines ?? 1))
                )
                .map(item => {

                    const cleared =
                        clearedByPath.get(
                            item.path
                        ) ?? [];

                    const shift =
                        cleared.filter(
                            task =>
                                task.line < item.line
                        ).reduce((count, task) => count + (task.removedLines ?? 1), 0);


                    return shift > 0
                        ? {
                            ...item,
                            line:
                                item.line - shift
                        }
                        : item;
                });


        this.data.completedTaskChecks =
            this.completedTaskChecks;


        try {

            await this.store.save(
                this.data
            );

        } catch (error) {

            this.completedTaskChecks =
                previous;

            this.data.completedTaskChecks =
                this.completedTaskChecks;

            throw error;
        }
    }


    async addCompletedTaskRecords(
        records
    ) {

        this.completedTaskHistory.unshift(
            ...records
        );

        this.data.completedTaskHistory =
            this.completedTaskHistory;

        try {

            await this.store.save(
                this.data
            );

        } catch (error) {

            const addedIds =
                new Set(
                    records.map(
                        record => record.id
                    )
                );

            this.completedTaskHistory =
                this.completedTaskHistory.filter(
                    item =>
                        !addedIds.has(item.id)
                );

            this.data.completedTaskHistory =
                this.completedTaskHistory;

            throw error;
        }
    }


    async removeCompletedTaskRecords(
        recordIds
    ) {

        const ids = new Set(recordIds);
        const previous =
            this.completedTaskHistory;

        this.completedTaskHistory =
            this.completedTaskHistory.filter(
                item => !ids.has(item.id)
            );

        this.data.completedTaskHistory =
            this.completedTaskHistory;

        try {

            await this.store.save(
                this.data
            );

        } catch (error) {

            this.completedTaskHistory =
                previous;

            this.data.completedTaskHistory =
                this.completedTaskHistory;

            throw error;
        }
    }


    async replaceProjectWorkRatings(
        date,
        projectIds,
        scoresByProject
    ) {

        if (
            !parseLocalISODate(date) ||
            date > localISODate()
        ) {

            throw new Error(
                "Invalid project-rating date."
            );
        }


        if (!Array.isArray(projectIds)) {

            throw new Error(
                "Project-rating scope must be an array."
            );
        }


        const scope =
            [
                ...new Set(
                    projectIds ?? []
                )
            ];


        for (
            const projectId
            of scope
        ) {

            if (
                typeof projectId !==
                    "string" ||
                !projectId.trim()
            ) {

                throw new Error(
                    "Invalid project ID."
                );
            }
        }


        const scopeSet =
            new Set(scope);


        const entries =
            Object.entries(
                scoresByProject ?? {}
            );


        for (
            const [
                projectId,
                score
            ]
            of entries
        ) {

            if (
                !scopeSet.has(
                    projectId
                )
            ) {

                throw new Error(
                    "A rating is outside the editing scope."
                );
            }


            if (
                !Number.isInteger(score) ||
                score < 1 ||
                score > 4
            ) {

                throw new Error(
                    "Invalid project advancement rating."
                );
            }
        }


        /*
         * Replacement semantics are intentional:
         * a missing score means that project's
         * saved answer for this date is cleared.
         * Other dates and projects remain untouched.
         */
        const nextProjectWorkRatings =
            {
                ...this.projectWorkRatings
            };


        for (
            const projectId
            of scope
        ) {

            const ratings =
                nextProjectWorkRatings[
                    projectId
                ];


            if (
                !ratings ||
                typeof ratings !==
                    "object" ||
                Array.isArray(ratings)
            ) {
                continue;
            }


            const nextRatings =
                {
                    ...ratings
                };


            delete nextRatings[date];


            if (
                Object.keys(nextRatings)
                    .length === 0
            ) {

                delete nextProjectWorkRatings[
                    projectId
                ];

            } else {

                nextProjectWorkRatings[
                    projectId
                ] =
                    nextRatings;
            }
        }


        for (
            const [
                projectId,
                score
            ]
            of entries
        ) {

            if (
                !nextProjectWorkRatings[
                    projectId
                ] ||
                typeof nextProjectWorkRatings[
                    projectId
                ] !== "object" ||
                Array.isArray(
                    nextProjectWorkRatings[
                        projectId
                    ]
                )
            ) {

                nextProjectWorkRatings[
                    projectId
                ] = {};
            }


            nextProjectWorkRatings[
                projectId
            ][date] =
                score;
        }


        const nextData = {
            ...this.data,

            projectWorkRatings:
                nextProjectWorkRatings
        };


        await this.store.save(
            nextData
        );


        this.projectWorkRatings =
            nextProjectWorkRatings;


        this.data =
            nextData;
    }


    async replaceProjectProgress(
        date,
        projectIds,
        scoresByProject,
        summariesByProject,
        focusUpdate = null
    ) {

        if (
            !parseLocalISODate(date) ||
            date > localISODate()
        ) {
            throw new Error(
                "Invalid project-progress date."
            );
        }


        if (!Array.isArray(projectIds)) {
            throw new Error(
                "Project-progress scope must be an array."
            );
        }


        const scope =
            [...new Set(projectIds)];

        const scopeSet =
            new Set(scope);


        for (
            const projectId
            of scope
        ) {

            if (
                typeof projectId !== "string" ||
                !projectId.trim()
            ) {
                throw new Error(
                    "Invalid project ID."
                );
            }
        }


        const scoreEntries =
            Object.entries(
                scoresByProject ?? {}
            );

        const summaryEntries =
            Object.entries(
                summariesByProject ?? {}
            );


        for (
            const [projectId, score]
            of scoreEntries
        ) {

            if (
                !scopeSet.has(projectId) ||
                !Number.isInteger(score) ||
                score < 1 ||
                score > 4
            ) {
                throw new Error(
                    "Invalid project advancement rating."
                );
            }
        }


        for (
            const [projectId, summary]
            of summaryEntries
        ) {

            if (
                !scopeSet.has(projectId) ||
                typeof summary !== "string" ||
                summary.length > 1000
            ) {
                throw new Error(
                    "Invalid project progress summary."
                );
            }
        }


        let normalizedFocus = null;


        if (focusUpdate !== null) {

            if (
                !focusUpdate ||
                !parseLocalISODate(
                    focusUpdate.sourceDate
                ) ||
                focusUpdate.sourceDate !==
                    date
            ) {
                throw new Error(
                    "Invalid pending focus."
                );
            }


            normalizedFocus =
                validateFocusItems(
                    focusUpdate.items
                );
        }


        const nextRatings =
            Object.fromEntries(
                Object.entries(
                    this.projectWorkRatings
                ).map(
                    ([projectId, ratings]) => [
                        projectId,
                        {
                            ...ratings
                        }
                    ]
                )
            );

        const nextLogs =
            Object.fromEntries(
                Object.entries(
                    this.projectWorkLogs
                ).map(
                    ([projectId, logs]) => [
                        projectId,
                        Object.fromEntries(
                            Object.entries(
                                logs &&
                                typeof logs === "object" &&
                                !Array.isArray(logs)
                                    ? logs
                                    : {}
                            ).map(
                                ([logDate, entry]) => [
                                    logDate,
                                    {
                                        ...entry
                                    }
                                ]
                            )
                        )
                    ]
                )
            );


        for (
            const projectId
            of scope
        ) {

            if (nextRatings[projectId]) {
                delete nextRatings[projectId][date];

                if (
                    Object.keys(
                        nextRatings[projectId]
                    ).length === 0
                ) {
                    delete nextRatings[projectId];
                }
            }


            if (nextLogs[projectId]) {
                delete nextLogs[projectId][date];

                if (
                    Object.keys(
                        nextLogs[projectId]
                    ).length === 0
                ) {
                    delete nextLogs[projectId];
                }
            }
        }


        for (
            const [projectId, score]
            of scoreEntries
        ) {

            nextRatings[projectId] =
                nextRatings[projectId] ?? {};

            nextRatings[projectId][date] =
                score;
        }


        for (
            const [projectId, rawSummary]
            of summaryEntries
        ) {

            const summary =
                rawSummary.trim();


            if (!summary) {
                continue;
            }


            const project =
                this.getProjectById(
                    projectId
                );


            const previousLog =
                this.projectWorkLogs[
                    projectId
                ]?.[date] ?? {};


            const previousTimestamp =
                Number(
                    previousLog.timestamp
                );


            nextLogs[projectId] =
                nextLogs[projectId] ?? {};

            nextLogs[projectId][date] = {
                summary,
                projectName:
                    project?.name ??
                    previousLog.projectName ??
                    "Unavailable project",
                timestamp:
                    Number.isFinite(
                        previousTimestamp
                    ) &&
                    previousTimestamp > 0
                        ? previousTimestamp
                        : Date.now()
            };
        }


        for (
            const [projectId]
            of scoreEntries
        ) {

            if (
                nextLogs[projectId]?.[date]
            ) {
                continue;
            }


            const project =
                this.getProjectById(
                    projectId
                );


            const previousLog =
                this.projectWorkLogs[
                    projectId
                ]?.[date] ?? {};


            const previousTimestamp =
                Number(
                    previousLog.timestamp
                );


            nextLogs[projectId] =
                nextLogs[projectId] ?? {};


            nextLogs[projectId][date] = {
                summary: "",
                projectName:
                    project?.name ??
                    previousLog.projectName ??
                    "Unavailable project",
                timestamp:
                    Number.isFinite(
                        previousTimestamp
                    ) &&
                    previousTimestamp > 0
                        ? previousTimestamp
                        : Date.now()
            };
        }


        for (const projectId of scope) {
            const log = nextLogs[projectId]?.[date];
            if (!log) continue;
            const previous = this.projectWorkLogs[projectId]?.[date];
            log.projectName = previous?.projectName ?? log.projectName;
            log.context = savedReportContext(this, date, projectId, previous?.context);
        }

        const nextPendingFocus =
            normalizedFocus === null
                ? this.pendingFocus
                : {
                    sourceDate:
                        focusUpdate.sourceDate,
                    items:
                        normalizedFocus
                };


        const nextData = {
            ...this.data,
            projectWorkRatings:
                nextRatings,
            projectWorkLogs:
                nextLogs,
            pendingFocus:
                nextPendingFocus,
            ...(normalizedFocus === null ? {} : { reportFocusByDate: {
                ...this.data.reportFocusByDate,
                [date]: { items: normalizedFocus }
            } })
        };


        await this.store.save(
            nextData
        );


        this.projectWorkRatings =
            nextRatings;
        this.projectWorkLogs =
            nextLogs;
        this.pendingFocus =
            nextPendingFocus;
        this.data =
            nextData;
    }


    async replaceResourceProgress(
        date,
        resourceId,
        score,
        summary
    ) {
        const resource = this.getResourceById(resourceId);
        if (
            !resource ||
            !parseLocalISODate(date) ||
            date > localISODate() ||
            typeof summary !== "string" ||
            summary.length > 1000
        ) {
            throw new Error("Invalid Resource progress entry.");
        }

        const id = resource.resourceType;
        const nextRatings = {
            ...this.resourceWorkRatings,
            [id]: { ...(this.resourceWorkRatings[id] ?? {}) }
        };
        const nextLogs = {
            ...this.resourceWorkLogs,
            [id]: { ...(this.resourceWorkLogs[id] ?? {}) }
        };

        delete nextRatings[id][date];
        delete nextLogs[id][date];

        if (Number.isInteger(score) && score >= 1 && score <= 4) {
            nextRatings[id][date] = score;
        }

        const normalizedSummary = String(summary ?? "").trim();
        if (normalizedSummary || nextRatings[id][date]) {
            const previousTimestamp = Number(this.resourceWorkLogs[id]?.[date]?.timestamp);
            nextLogs[id][date] = {
                summary: normalizedSummary,
                resourceName: this.resourceWorkLogs[id]?.[date]?.resourceName ?? resource.label,
                context: savedReportContext(this, date, `resource:${id}`, this.resourceWorkLogs[id]?.[date]?.context),
                targetKind: "resource",
                timestamp: Number.isFinite(previousTimestamp) && previousTimestamp > 0
                    ? previousTimestamp
                    : Date.now()
            };
        }

        if (Object.keys(nextRatings[id]).length === 0) delete nextRatings[id];
        if (Object.keys(nextLogs[id]).length === 0) delete nextLogs[id];

        const nextData = {
            ...this.data,
            resourceWorkRatings: nextRatings,
            resourceWorkLogs: nextLogs
        };
        await this.store.save(nextData);
        this.resourceWorkRatings = nextRatings;
        this.resourceWorkLogs = nextLogs;
        this.data = nextData;
    }


    async replaceCombinedProgress(
        date,
        projectIds,
        resourceIds,
        scoresByContext,
        summariesByContext,
        focusUpdate = null
    ) {
        const projects =
            [...new Set(
                Array.isArray(projectIds)
                    ? projectIds
                    : []
            )];

        const resources =
            [...new Set(
                Array.isArray(resourceIds)
                    ? resourceIds
                    : []
            )];

        const valuesFor = ids =>
            Object.fromEntries(
                ids
                    .filter(id =>
                        Object.prototype.hasOwnProperty.call(
                            scoresByContext ?? {},
                            id
                        )
                    )
                    .map(id => [
                        id,
                        scoresByContext[id]
                    ])
            );

        const summariesFor = ids =>
            Object.fromEntries(
                ids.map(id => [
                    id,
                    String(
                        summariesByContext?.[id] ?? ""
                    )
                ])
            );

        await this.replaceProjectProgress(
            date,
            projects,
            valuesFor(projects),
            summariesFor(projects),
            focusUpdate
        );

        for (const resourceId of resources) {
            const key = `resource:${resourceId}`;
            await this.replaceResourceProgress(
                date,
                resourceId,
                scoresByContext?.[key],
                String(
                    summariesByContext?.[key] ?? ""
                )
            );
        }
    }


    async setDailyFocus(
        date,
        items
    ) {

        if (
            !parseLocalISODate(date)
        ) {
            throw new Error(
                "Invalid daily focus."
            );
        }


        const normalized =
            validateFocusItems(items);


        const nextDailyFocus = {
            ...this.dailyFocus,
            [date]: normalized
        };


        const nextData = {
            ...this.data,
            dailyFocus:
                nextDailyFocus
        };


        await this.store.save(
            nextData
        );


        this.dailyFocus =
            nextDailyFocus;
        this.data =
            nextData;
    }


    async setDailyAndPendingFocus(
        date,
        items,
        nextItems
    ) {

        if (!parseLocalISODate(date)) {
            throw new Error(
                "Invalid daily focus."
            );
        }


        const normalizedItems =
            validateFocusItems(items);


        const normalizedNextItems =
            validateFocusItems(nextItems);


        const nextDailyFocus = {
            ...this.dailyFocus,
            [date]: normalizedItems
        };


        const pendingFocus = {
            sourceDate:
                date,
            items:
                normalizedNextItems
        };


        const nextData = {
            ...this.data,
            dailyFocus:
                nextDailyFocus,
            pendingFocus
        };


        await this.store.save(
            nextData
        );


        this.dailyFocus =
            nextDailyFocus;
        this.pendingFocus =
            pendingFocus;
        this.data =
            nextData;
    }


    async setPendingFocus(
        sourceDate,
        items
    ) {

        if (!parseLocalISODate(sourceDate)) {
            throw new Error(
                "Invalid pending-focus date."
            );
        }


        const pendingFocus = {
            sourceDate,
            items:
                validateFocusItems(items)
        };


        const nextData = {
            ...this.data,
            pendingFocus
        };


        await this.store.save(
            nextData
        );


        this.pendingFocus =
            pendingFocus;
        this.data =
            nextData;
    }

    async migrateCategoryReferences(
        category
    ) {

        const files =
            this.getProjectsUsingCategory(
                category
            );

        for (const file of files) {

            await this.app.fileManager
                .processFrontMatter(
                    file,
                    frontmatter => {

                        frontmatter.category =
                            category.id;

                        /*
                        * Remove old duplicated
                        * project-level metadata.
                        */
                        delete frontmatter.image;
                        delete frontmatter.kind;
                    }
                );
        }
    }

    async saveCategories() {

        this.data.categories =
            this.categories;

        await this.store.save(
            this.data
        );
    }

    async updateCategoryShortcuts(
        category,
        shortcutIds,
        shortcutOrder
    ) {

        category.shortcutOrder =
            normalizeShortcutOrder(
                shortcutOrder
            );


        const selected =
            new Set(
                normalizeShortcutIds(
                    shortcutIds
                )
            );


        /*
        * Save selected shortcuts in the
        * same order as the full list.
        */
        category.shortcuts =
            category.shortcutOrder
                .filter(
                    id =>
                        selected.has(id)
                );


        await this.saveCategories();
        this.plugin.appShortcutsControl?.refresh();
    }


    validateCategoryName(
        name,
        ignoreId = null
    ) {

        if (!validVaultName(name)) {
            throw new Error(
                "Enter a valid category name."
            );
        }


        const exists =
            this.categories.some(category =>
                category.id !== ignoreId &&
                category.name
                    .toLowerCase() ===
                name.toLowerCase()
            );


        if (exists) {
            throw new Error(
                "That category already exists."
            );
        }
    }

    async renameCategory(
        category,
        newName
    ) {

        const name =
            newName.trim();


        this.validateCategoryName(
            name,
            category.id
        );


        /*
        * Convert any old projects that still
        * store the category name into the
        * stable category ID before renaming.
        */
        await this.migrateCategoryReferences(
            category
        );


        if (
            name === category.name
        ) {
            return;
        }


        category.name =
            name;


        await this.saveCategories();
    }


    async deleteCategory(category) {

        const projects =
            this.getProjectsUsingCategory(
                category
            );


        if (projects.length > 0) {

            const noun =
                projects.length === 1
                    ? "project uses"
                    : "projects use";

            throw new Error(
                `${projects.length} ${noun} this category. Change their category first.`
            );
        }


        this.categories =
            this.categories.filter(
                item =>
                    item.id !== category.id
            );


        await this.saveCategories();
    }


    validateProjectName(name) {

        if (!validVaultName(name)) {
            throw new Error(
                "Enter a valid project name."
            );
        }
    }


    assertProjectAvailable(name) {

        const path =
            normalizePath(
                `Projects/${name}`
            );

        if (
            this.app.vault
                .getAbstractFileByPath(path)
        ) {
            throw new Error(
                "A project with that name already exists."
            );
        }
    }


    async ensureFolder(path) {

        const normalized =
            normalizePath(path);

        const parts =
            normalized.split("/");

        let current = "";


        for (const part of parts) {

            current =
                current
                    ? `${current}/${part}`
                    : part;

            if (
                !this.app.vault
                    .getAbstractFileByPath(
                        current
                    )
            ) {
                const existsOnDisk =
                    await this.app.vault.adapter
                        .exists(current);

                if (!existsOnDisk) {
                    await this.app.vault
                        .createFolder(current);
                }

                await yieldToObsidian();
            }
        }
    }


    async createCustomCategory(
        name,
        imageChoice,
        shortcutIds,
        shortcutOrder
    ) {

        this.validateCategoryName(name);


        let baseId =
            slugify(name) ||
            "category";

        let id =
            `custom-${baseId}`;

        let suffix = 2;


        while (
            this.getCategories()
                .some(category =>
                    category.id === id
                )
        ) {
            id =
                `custom-${baseId}-${suffix++}`;
        }


        let image;


        if (imageChoice.type === "wip") {

            if (
                !this.app.vault
                    .getAbstractFileByPath(
                        WIP_IMAGE_PATH
                    )
            ) {
                throw new Error(
                    `W.I.P. picture not found at ${WIP_IMAGE_PATH}`
                );
            }

            image =
                WIP_IMAGE_PATH;

        } else {

            image =
                await this.saveCategoryImage(
                    id,
                    imageChoice.file
                );
        }


        const category = {
            id,
            name,
            image,

            shortcutOrder:
                normalizeShortcutOrder(
                    shortcutOrder
                ),

            shortcuts:
                normalizeShortcutOrder(
                    shortcutOrder
                ).filter(
                    id =>
                        normalizeShortcutIds(
                            shortcutIds
                        ).includes(id)
                ),

            custom: true
        };


        this.categories.push(
            category
        );

        await this.saveCategories();


        return category;
    }

    async updateCategoryImage(
        category,
        imageChoice
    ) {

        if (!imageChoice) {
            throw new Error(
                "Choose a category image."
            );
        }


        const oldImage =
            category.image;

        let newImage;


        if (
            imageChoice.type === "wip"
        ) {

            if (
                !this.app.vault
                    .getAbstractFileByPath(
                        WIP_IMAGE_PATH
                    )
            ) {
                throw new Error(
                    `Placeholder image not found at ${WIP_IMAGE_PATH}`
                );
            }


            newImage =
                WIP_IMAGE_PATH;

        } else if (
            imageChoice.type === "upload"
        ) {

            newImage =
                await this.saveCategoryImage(
                    category.id,
                    imageChoice.file
                );

        } else {

            throw new Error(
                "Invalid image choice."
            );
        }


        category.image =
            newImage;


        await this.saveCategories();


        /*
        * Clean up an old uploaded category
        * image when it is no longer used.
        *
        * Never delete built-in/shared images
        * outside CATEGORY_IMAGE_ROOT.
        */
        if (
            oldImage &&
            oldImage !== newImage &&
            oldImage.startsWith(
                `${CATEGORY_IMAGE_ROOT}/`
            )
        ) {

            const oldFile =
                this.app.vault
                    .getAbstractFileByPath(
                        oldImage
                    );


            if (oldFile instanceof TFile) {

                try {

                    await this.app.vault
                        .delete(oldFile);

                } catch (error) {

                    console.warn(
                        "Could not remove old category image:",
                        error
                    );
                }
            }
        }
    }

    async saveCategoryImage(
        id,
        file
    ) {

        const imageRoot = this.getProjectsUsingCategory({ id }).some(project =>
            SHARED_PROJECT_ROOTS.some(root => project.path.startsWith(`${root}/`)))
            ? SHARED_IMAGE_ROOT : CATEGORY_IMAGE_ROOT;
        await this.ensureFolder(
            imageRoot
        );


        const rawExtension =
            file.name
                .split(".")
                .pop()
                ?.toLowerCase();

        const extension =
            rawExtension
                ?.replace(
                    /[^a-z0-9]/g,
                    ""
                )
            || "png";


        const path =
            normalizePath(
                `${imageRoot}/${id}.${extension}`
            );


        const data =
            await file.arrayBuffer();


        const existing =
            this.app.vault
                .getAbstractFileByPath(
                    path
                );


        if (existing instanceof TFile) {

            await this.app.vault
                .modifyBinary(
                    existing,
                    data
                );

        } else {

            await this.app.vault
                .createBinary(
                    path,
                    data
                );
        }


        await yieldToObsidian();

        return path;
    }

    async createProject(
        category,
        name,
        dashboard,
        status
    ) {
        const validStatuses = [
            "active",
            "future",
            "shelved"
        ];

        if (!validStatuses.includes(status)) {
            throw new Error(
                `Invalid project status: ${status}`
            );
        }

        this.validateProjectName(name);
        this.assertProjectAvailable(name);


        await this.ensureFolder("Projects");


        const root =
            normalizePath(
                `Projects/${name}`
            );


        const hubPath =
            normalizePath(
                `${root}/${name}.md`
            );
        
        const projectId =
            randomUUID();

        let rootCreated = false;

        this.plugin
            .activityIgnoredRoots
            ?.add(root);

        try {

            await this.app.vault
                .createFolder(root);

            rootCreated = true;

            await yieldToObsidian();

            await this.ensureFolder(
                `${root}/${PROJECT_META_FOLDER}`
            );


            const frontmatter = [
                "---",
                "type: project",
                `projectId: ${JSON.stringify(projectId)}`,
                `status: ${status}`,
                `category: ${JSON.stringify(category.id)}`,
                `resource_folders: ${JSON.stringify(
                    this.normalizeResourceFolderIds(
                        category.resourceFolders
                    )
                )}`,
                "cssclasses: [dashboard]",
                "---"
            ].join("\n");

            const content = [
                frontmatter,
                "",
                "```dataviewjs",
                'await dv.view("System/Dashboards/Project")',
                "```",
                ""
            ].join("\n");


            await this.app.vault.create(
                hubPath,
                content
            );

            await yieldToObsidian();


            /*
             * Update Home immediately.
             * Do NOT open the project.
             */
            if (
                dashboard?.isConnected
            ) {
                dashboard.dispatchEvent(
                    new CustomEvent(
                        "hub-project-created",
                        {
                            detail: {
                                path: hubPath,
                                projectId,
                                name,
                                status,
                                categoryId:
                                    category.id
                            }
                        }
                    )
                );
            }

            this.plugin
                .logProjectActivity(
                    "created",
                    {
                        path:
                            hubPath,

                        title:
                            name,

                        projectStatus:
                            status
                    }
                ).catch(error => {

                    console.error(
                        "Could not record project creation:",
                        error
                    );
                });


            new Notice(
                `Created "${name}".`
            );


        } catch (error) {

            if (rootCreated) {

                const folder =
                    this.app.vault
                        .getAbstractFileByPath(
                            root
                        );

                if (folder) {
                    try {
                        // Roll back only the root this failed creation just made.
                        // This is not a user-requested deletion of an existing project.
                        await this.plugin.projectDeletion.originalTrash.call(
                            this.app.fileManager, folder
                        );
                    } catch (_) {}
                }
            }


            throw error;

        } finally {

            this.plugin
                .activityIgnoredRoots
                ?.delete(root);
        }
    }
}


class HubWorkspaceModeService {

    constructor(plugin) {

        this.plugin = plugin;
        this.app = plugin.app;

        this.mode = null;
        this.railTabs = null;
        this.railPane = null;
        this.modeRoot = null;
        this.lastActiveNoteLeaf = null;

        this.internalDepth = 0;
        this.layoutTimer = null;
        this.layoutRevision = 0;
        this.emptyContentSince = 0;
        this.reconcilePending = false;
        this.destroyed = false;
        this.operationQueue =
            Promise.resolve();

        this.state =
            this.loadState();
        this.navigationHistory.initialize();
    }

    get navigationHistory() {
        return this.history ??= new HubNavigationHistory(this);
    }

    emptyState() {
        return emptyWorkspaceState();
    }


    loadState() {

        const fallback =
            this.emptyState();


        try {

            const saved = this.plugin.workspaceState.load();

            if (
                !saved ||
                typeof saved !==
                    "object" ||
                Array.isArray(saved)
            ) {
                return fallback;
            }

            const migratePath = path => {
                if (typeof path !== "string") return path;
                for (const resource of RESOURCE_TYPES) for (const legacy of resource.legacyRoots ?? []) {
                    if (path === `${legacy.root}/${legacy.hubName}` || path === `${resource.root}/${legacy.hubName}`) return resource.hubPath;
                    path = replacePathRoot(path, legacy.root, resource.root);
                }
                return path;
            };
            for (const entry of Object.values(saved.projects ?? {})) {
                if (!entry || typeof entry !== "object") continue;
                entry.hubPath = migratePath(entry.hubPath);
                entry.lastNotePath = migratePath(entry.lastNotePath);
                entry.layout = rewriteLayoutPaths(entry.layout, migratePath);
            }
            if (saved.lastFile) saved.lastFile.path = migratePath(saved.lastFile.path);
            for (const entry of Array.isArray(saved.fileHistory) ? saved.fileHistory : []) {
                if (entry?.path) entry.path = migratePath(entry.path);
            }

            return {
                ...fallback,
                ...saved,

                version: saved.version ?? 3,

                projects:
                    saved.projects &&
                    typeof saved.projects ===
                        "object" &&
                    !Array.isArray(
                        saved.projects
                    )
                        ? saved.projects
                        : {}
            };

        } catch (_) {
            return fallback;
        }
    }


    saveState() {
        return this.plugin.workspaceState.save(this.state);
    }


    projectFor(reference) {

        if (!reference) {
            return null;
        }


        if (
            typeof reference ===
                "object" &&
            reference.projectId &&
            reference.path
        ) {
            return reference;
        }


        const value =
            String(reference);


        return (
            this.plugin.projectWizard
                .getProjectById(value) ||
            this.plugin.projectWizard
                .getProjectForPath(value) ||
            this.plugin.projectWizard
                .getProjectRecords()
                .find(
                    project =>
                        project.path === value
                ) ||
            null
        );
    }


    resourceFor(reference) {
        if (!reference) return null;
        if (typeof reference === "object" && reference.contextKind === "resource") {
            return reference;
        }
        return this.plugin.projectWizard.getResourceById(reference) ||
            this.plugin.projectWizard.getResourceForPath(reference);
    }


    contextFor(reference) {
        return this.resourceFor(reference) || this.projectFor(reference);
    }

    contextContainsFile(context, path) {
        if (!context || !path || path === context.path) return false;
        if (path.startsWith(`${context.root}/`)) return true;
        if (context.contextKind === "resource") return false;
        return this.plugin.projectWizard.getResourceFolders(context.resourceFolderIds ?? [])
            .some(folder => path.startsWith(`${folder.path}/`));
    }

    contextFromSource(source) {
        if (!source) return null;
        const root = this.dashboardRoot(source);
        const id = root?.dataset.hubContextId;
        return this.contextFor(id) || this.contextFor(this.leafPath(this.leafForSource(source)));
    }

    contextForFile(path, source = null) {
        const oathProject = this.plugin.oath?.projectWorkspaceForPath(path);
        if (oathProject) return oathProject;
        const candidate = this.contextFromSource(source) || this.mode?.project;
        return this.contextContainsFile(candidate, path) ? candidate : this.contextFor(path);
    }

    currentContext() {
        const leaf = this.app.workspace.activeLeaf;
        if (!this.isMainLeaf(leaf)) return null;
        const path = this.leafPath(leaf);
        if (path === "Home.md") return null;
        const context = this.plugin.oath?.projectWorkspaceForPath(path) || this.contextFromSource(leaf) || (path ? this.contextForFile(path, leaf) : null);
        if (context) return context;
        // A browser tab can belong to the visible note-mode workspace without
        // having a vault path. Never infer context from saved navigation history.
        const mode = this.mode;
        return !path && mode && this.isMainLeaf(mode.projectLeaf) &&
            this.leafDocument(leaf) === mode.ownerDocument ? mode.project : null;
    }

    captureNoteLayout(worked = false) {
        if (!this.mode || !this.usableContentLeaves().length) return;
        const layout = this.app.workspace.getLayout();
        const snapshot = prepareNoteLayout(layout, this.mode.project.path,
            path => this.app.vault.getAbstractFileByPath(path) instanceof TFile);
        if (!snapshot) return;
        const id = this.mode.project.projectId;
        const configuration = this.plugin.presets?.snapshot() ?? {
            contextId: id, hubPath: this.mode.project.path, root: this.mode.project.root,
            layout: snapshot, railState: this.noteRailState ?? "full"
        };
        this.navigationHistory.rememberConfiguration(this.mode.project, configuration, Date.now(), worked);
        this.state.projects[id] = { ...this.state.projects[id], hubPath: this.mode.project.path, layout: snapshot };
        const hasFile = node => node?.type === "leaf"
            ? !!node.state?.state?.file && node.state.state.file !== this.mode.project.path
            : (node?.children ?? []).some(hasFile);
        const activeView = this.lastActiveNoteLeaf?.getViewState?.() ??
            this.app.workspace.activeLeaf?.getViewState?.();
        if (activeView?.type === "webviewer" ||
            !hasFile(snapshot.main)) this.rememberBrowserLayout(this.mode.project);
        this.saveState();
    }

    rememberBrowserLayout(context) {
        if (this.plugin.oath?.canOpen(context, false) === false) return;
        this.rememberContext(context);
        // Workspace association, not a fabricated file path for a browser URL.
        this.state.lastFile = { contextKind: context.contextKind ?? "project",
            contextId: context.contextKind === "resource" ? context.resourceType : context.projectId };
        this.navigationHistory.rememberFile(context);
        this.saveState();
    }

    canRestoreLayoutView(type) {
        return type !== "webviewer" ||
            !!this.app.internalPlugins?.getEnabledPluginById?.("webviewer");
    }

    restorableNoteLayout(context) {
        if (!context || this.isShelvedLastFile(context.path)) return null;
        return prepareNoteLayout(this.state.projects[context.projectId]?.layout, context.path,
            path => this.app.vault.getAbstractFileByPath(path) instanceof TFile,
            type => this.canRestoreLayoutView(type));
    }

    async restoreNoteLayout(context, snapshot = this.state.projects[context.projectId]?.layout) {
        return this.presentWorkspace(null, context, true, () => this.applyNoteLayout(context, snapshot));
    }

    prepareRestoredNoteMode(context, snapshot) {
        this.cancelNoteRestore?.();
        const findHub = node => node?.type === "leaf"
            ? (node.state?.state?.file === context.path ? node.id : null)
            : (node?.children ?? []).map(findHub).find(Boolean);
        const leafId = findHub(snapshot.main);
        const doc = this.leafDocument(this.mode?.projectLeaf || this.activeMainLeaf());
        let cancelled = false;
        const adopt = () => {
            if (cancelled || this.destroyed) return;
            // Native restoration assigns the saved id before the Markdown file
            // is ready. Do not wait for leaf.view.file or changeLayout's promise.
            const leaf = this.mainLeaves(doc).find(item => item.id === leafId);
            const element = this.leafElement(leaf);
            if (!element?.isConnected) return;
            const pane = element.closest(".workspace-tabs");
            if (this.mode?.projectLeaf === leaf &&
                element.classList.contains("hub-project-rail-leaf") &&
                pane?.classList.contains("hub-project-rail") &&
                element.closest(".mod-root")?.classList.contains("hub-project-note-layout")) return;
            this.mode = { project: context, projectLeaf: leaf, ownerDocument: doc };
            this.state.currentMode = "note";
            this.applyModeClasses();
            leaf.view?.activatePreparedRail?.();
        };
        // Child insertion callbacks run before paint, including when native
        // changeLayout replaces its root split. No timer or content-ready gate.
        const observer = new doc.defaultView.MutationObserver(adopt);
        observer.observe(doc.querySelector(".workspace") || doc.body, { childList: true, subtree: true });
        const cancel = () => {
            cancelled = true;
            observer.disconnect();
            if (this.cancelNoteRestore === cancel) this.cancelNoteRestore = null;
        };
        this.cancelNoteRestore = cancel;
        return { adopt, cancel };
    }

    async applyNoteLayout(context, savedLayout = this.state.projects[context.projectId]?.layout) {
        if (this.plugin.oath?.canOpen(context) === false || this.plugin.oathNavigation?.allowLayout(savedLayout) === false) return false;
        const snapshot = prepareNoteLayout(savedLayout,
            context.path, path => this.app.vault.getAbstractFileByPath(path) instanceof TFile,
            type => this.canRestoreLayoutView(type));
        if (!snapshot || typeof this.app.workspace.changeLayout !== "function") return false;
        this.captureNoteLayout();
        // Prepare only the shared structural rail while the current page remains
        // live. Native panes and secondary dashboard work are not readiness gates.
        const prepared = await this.plugin.preparedNoteRails.prepare(context, snapshot,
            this.leafDocument(this.mode?.projectLeaf || this.activeMainLeaf()));
        if (this.destroyed || this.plugin.oath?.canOpen(context) === false || this.plugin.oathNavigation?.allowLayout(prepared.snapshot) === false) { prepared.dispose(); return false; }
        this.beginLayoutMutation();
        this.clearModeClasses();
        this.mode = null;
        // Use native deserialization so tabs, splits, ratios and view state survive.
        const restore = this.prepareRestoredNoteMode(context, snapshot);
        this.pendingNoteRestore = restore;
        try {
            const changing = this.app.workspace.changeLayout({ ...this.app.workspace.getLayout(), ...prepared.snapshot });
            restore.adopt();
            await changing;
            if (this.destroyed) return false;
            restore.adopt();
        } finally {
            restore.cancel();
            if (this.pendingNoteRestore === restore) this.pendingNoteRestore = null;
            prepared.dispose();
        }
        const projectLeaf = this.findLeafByPath(context.path);
        if (!projectLeaf) return false;
        this.mode = { project: context, projectLeaf, ownerDocument: this.leafDocument(projectLeaf) };
        this.lastActiveNoteLeaf = this.usableContentLeaves().find(leaf => leaf.id === snapshot.active) ?? null;
        this.lastActiveNoteLeaf = this.pickContentLeaf();
        this.state.currentMode = "note";
        const activeFile = this.app.vault.getAbstractFileByPath(this.leafPath(this.lastActiveNoteLeaf) ?? "");
        if (activeFile instanceof TFile) this.rememberNote(context, activeFile);
        else this.rememberBrowserLayout(context);
        this.applyModeClasses();
        this.collapseNativeSidebars();
        this.plugin.presets?.applyPendingFolders();
        return true;
    }

    startNativeFileDrag(event, paths, source) {
        const items = paths.map(path => this.app.vault.getAbstractFileByPath(path)).filter(Boolean);
        const manager = this.app.dragManager;
        if (!items.length || !manager?.onDragStart) return;
        const context = this.contextFromSource(source);
        this.dragContext = context;
        event.target.ownerDocument.addEventListener("dragend", () => {
            window.setTimeout(() => { if (this.dragContext === context) this.dragContext = null; }, 1000);
        }, { once: true });
        const drag = items.length === 1
            ? (items[0] instanceof TFolder ? manager.dragFolder(event, items[0], "hub") : manager.dragFile(event, items[0], "hub"))
            : manager.dragFiles(event, items, "hub");
        manager.onDragStart(event, drag);
    }


    lastProject() {
        return this.projectFor(this.state.lastProjectId);
    }


    rememberProject(reference) {

        const project =
            this.projectFor(reference);


        if (!project) {
            return null;
        }


        if (this.plugin.oath?.canOpen(project, false) === false) return null;
        this.state.lastProjectId =
            project.projectId;
        this.state.lastWorkspaceId = project.projectId;
        this.navigationHistory.rememberWorkspace(project);


        const current =
            this.state.projects[
                project.projectId
            ] ?? {};


        this.state.projects[
            project.projectId
        ] = {
            ...current,
            hubPath: project.path
        };


        this.saveState();


        return project;
    }


    lastResource() {
        return this.resourceFor(this.state.lastResourceId);
    }


    rememberResource(reference) {
        const resource = this.resourceFor(reference);
        if (!resource || this.plugin.oath?.canOpen(resource, false) === false) return null;
        this.state.lastResourceId = resource.resourceType;
        this.state.lastWorkspaceId = resource.projectId;
        this.navigationHistory.rememberWorkspace(resource);
        this.state.projects[resource.projectId] = {
            ...(this.state.projects[resource.projectId] ?? {}),
            hubPath: resource.path
        };
        this.saveState();
        return resource;
    }


    rememberContext(reference) {
        const context = this.contextFor(reference);
        if (this.plugin.oath?.canOpen(context, false) === false) return null;
        return context?.contextKind === "resource"
            ? this.rememberResource(context)
            : this.rememberProject(context);
    }


    lastContext() {
        this.navigationHistory.initialize();
        const entry = this.state.fileHistory[0];
        return this.contextFor(entry?.contextId) || this.contextFor(entry?.path);
    }

    lastWorkspace() {
        return this.navigationHistory.workspace();
    }

    openWorkspace(source = null) {
        const context = this.lastWorkspace();
        if (!context) {
            new Notice("No recently opened workspaces.");
            return Promise.resolve(false);
        }
        return this.openProjectFull(context, source);
    }

    navigateFrom(source, open) {
        const root = this.dashboardRoot(source);
        return root && this.plugin.transitions
            ? this.plugin.transitions.navigate(root, open) : open();
    }

    isShelvedLastFile(path) {
        // Resolve the current owner by path, not the context saved when opened.
        return Boolean(path && this.projectFor(path)?.status === "shelved");
    }

    globalLastFile() {
        return this.navigationHistory.resolveFile()?.file ?? null;
    }


    rememberNote(
        project,
        file
    ) {

        if (
            !project ||
            !(file instanceof TFile) ||
            file.path === project.path
        ) {
            return;
        }


        if (this.plugin.oath?.canOpen(project, false) === false || this.plugin.oath?.canOpen(file.path, false) === false) return;
        this.rememberContext(project);


        const current =
            this.state.projects[
                project.projectId
            ] ?? {};


        this.state.projects[
            project.projectId
        ] = {
            ...current,
            hubPath: project.path,
            lastNotePath: file.path
        };

        this.state.lastFile = {
            path: file.path,
            contextKind: project.contextKind ?? "project",
            contextId: project.contextKind === "resource"
                ? project.resourceType
                : project.projectId
        };
        this.navigationHistory.rememberFile(project, file);


        this.saveState();
    }


    rememberVaultFile(file) {
        if (!(file instanceof TFile) || this.plugin.oath?.canOpen(file.path, false) === false) return;
        this.state.lastFile = { path: file.path, contextKind: null, contextId: null };
        this.navigationHistory.rememberFile(null, file);
        this.saveState();
    }

    lastNoteFile(project = this.lastContext()) {
        return project ? this.navigationHistory.resolveFile(project.projectId)?.file ?? null : null;
    }


    hasLastProject() {

        return Boolean(
            this.lastProject()
        );
    }


    hasLastResource() {
        return Boolean(this.lastResource());
    }


    resolveLastFile(source = null) {
        // Keep a dashboard's scope even if its workspace was just deleted.
        // A missing scoped result must never fall through to global history.
        const id = this.dashboardRoot(source)?.dataset.hubContextId ||
            this.contextFromSource(source)?.projectId;
        return this.navigationHistory.resolveFile(id);
    }

    hasLastFile(source = null) {
        return Boolean(this.resolveLastFile(source));
    }


    lastNavigationInfo(source = null) {

        const project =
            this.lastProject();


        const resource = this.lastResource();
        const destination = this.resolveLastFile(source);
        const context = destination?.context;
        const file = destination?.file;


        return {
            project:
                project
                    ? {
                        projectId:
                            project.projectId,

                        name:
                            project.name,

                        path:
                            project.path
                    }
                    : null,

            resource:
                resource
                    ? {
                        resourceType: resource.resourceType,
                        name: resource.label,
                        path: resource.path
                    }
                    : null,

            file:
                file
                    ? {
                        name:
                            file.basename,

                        path:
                            file.path,

                        projectName:
                            context?.name ?? "Vault",

                        contextKind:
                            context?.contextKind ?? "project"
                    }
                    : null
        };
    }


    leafPath(leaf) {

        return (
            leaf?.view?.file?.path ||
            leaf?.getViewState?.()
                ?.state?.file ||
            null
        );
    }


    leafElement(leaf) {

        return (
            leaf?.view?.containerEl
                ?.closest?.(
                    ".workspace-leaf"
                ) ||
            leaf?.containerEl ||
            null
        );
    }


    leafDocument(leaf) {

        return (
            this.leafElement(leaf)
                ?.ownerDocument ||
            document
        );
    }


    leafForSource(source) {

        if (this.isMainLeaf(source)) {
            return source;
        }


        const element =
            source?.ownerDocument
                ? source
                : source?.containerEl ||
                    null;


        if (!element) {
            return null;
        }


        const ownerDocument =
            element.ownerDocument;


        return (
            this.mainLeaves(
                ownerDocument
            ).find(leaf => {

                const leafElement =
                    this.leafElement(leaf);


                return Boolean(
                    leafElement &&
                    (
                        leafElement ===
                            element ||
                        leafElement.contains(
                            element
                        )
                    )
                );
            }) ||
            null
        );
    }


    dashboardRoot(source) {

        const element =
            source?.ownerDocument
                ? source
                : source?.containerEl ||
                    null;


        if (!element) {
            return null;
        }


        const selector =
            ".home-dashboard, .project-dashboard";


        const root =
            element.matches?.(selector)
                ? element
                : element.closest?.(
                    selector
                ) ||
                element.querySelector?.(
                    selector
                ) ||
                null;


        if (
            !root ||
            (
                root.classList.contains(
                    "project-dashboard"
                ) &&
                (
                    root.closest(
                        ".hub-project-rail"
                    ) ||
                    root.ownerDocument?.body
                        ?.classList.contains(
                            "hub-project-note-mode"
                        )
                )
            )
        ) {
            return null;
        }


        return root;
    }


    isMainLeaf(leaf) {

        const element =
            this.leafElement(leaf);

        return Boolean(
            element?.isConnected &&
            element
                ?.closest?.(
                    ".workspace-split.mod-root"
                )
        );
    }


    mainLeaves(
        ownerDocument = document
    ) {

        const leaves = [];


        this.app.workspace
            .iterateAllLeaves(
                leaf => {

                    if (
                        this.isMainLeaf(leaf) &&
                        this.leafDocument(leaf) ===
                            ownerDocument
                    ) {
                        leaves.push(leaf);
                    }
                }
            );


        return leaves;
    }


    activeMainLeaf(
        ownerDocument = null
    ) {

        const active =
            this.app.workspace.activeLeaf;


        if (
            this.isMainLeaf(active) &&
            (
                !ownerDocument ||
                this.leafDocument(active) ===
                    ownerDocument
            )
        ) {
            return active;
        }


        return this.mainLeaves(
            ownerDocument || document
        )[0] ?? null;
    }


    findLeafByPath(
        path,
        ownerDocument = null
    ) {

        const active =
            this.app.workspace.activeLeaf;


        if (
            this.isMainLeaf(active) &&
            this.leafPath(active) === path &&
            (
                !ownerDocument ||
                this.leafDocument(active) ===
                    ownerDocument
            )
        ) {
            return active;
        }


        const documents =
            ownerDocument
                ? [ownerDocument]
                : [
                    ...new Set(
                        this.mainLeaves(document)
                            .map(
                                leaf =>
                                    this.leafDocument(
                                        leaf
                                    )
                            )
                    )
                ];


        for (
            const targetDocument
            of documents
        ) {

            const match =
                this.mainLeaves(
                    targetDocument
                )
                .find(
                    leaf =>
                        this.leafPath(leaf) ===
                            path
                );


            if (match) {
                return match;
            }
        }


        if (ownerDocument) {
            return null;
        }


        let match = null;


        this.app.workspace
            .iterateAllLeaves(
                leaf => {

                    if (
                        !match &&
                        this.isMainLeaf(leaf) &&
                        this.leafPath(leaf) ===
                            path
                    ) {
                        match = leaf;
                    }
                }
            );


        return match;
    }


    enqueue(
        action,
        scheduleAfter = true
    ) {

        const operation =
            this.operationQueue
                .then(
                    () =>
                        this.destroyed
                            ? false
                            : this.withInternal(
                                action,
                                scheduleAfter
                            )
                );


        this.operationQueue =
            operation.catch(error => {

                console.error(
                    "Could not update Hub workspace mode:",
                    error
                );
            });


        return operation;
    }


    async withInternal(
        action,
        scheduleAfter = true
    ) {

        const homepagePlugin =
            this.app.plugins
                ?.getPlugin?.(
                    "homepage"
                ) || null;


        const homepageWasExecuting =
            homepagePlugin
                ?.executing === true;


        /*
         * Homepage's `alwaysApply` handler
         * also reacts to the split/detach
         * events used to build note-mode.
         * Prevent it from restoring Home
         * into a leaf Hub is repurposing.
         */
        if (
            homepagePlugin &&
            !homepageWasExecuting
        ) {
            homepagePlugin.executing = true;
        }

        this.internalDepth++;


        try {
            return await action();

        } finally {

            this.internalDepth--;


            if (
                homepagePlugin &&
                !homepageWasExecuting
            ) {
                homepagePlugin.executing = false;
            }


            if (this.destroyed) {
                this.clearModeClasses();
                this.mode = null;
                this.lastActiveNoteLeaf =
                    null;
                this.reconcilePending =
                    false;
            }

            const shouldSchedule =
                scheduleAfter ||
                this.reconcilePending;


            if (this.internalDepth === 0) {
                this.reconcilePending =
                    false;
            }


            if (
                this.internalDepth === 0 &&
                shouldSchedule &&
                !this.destroyed
            ) {
                this.scheduleReconcile();
            }
        }
    }


    start() {

        this.destroyed = false;

        this.plugin.registerEvent(
            this.app.workspace.on(
                "file-open",
                file => {

                    if (
                        this.internalDepth > 0 ||
                        !(file instanceof TFile)
                    ) {
                        return;
                    }


                    /*
                     * `file-open` also fires
                     * for embeds. Only a real
                     * navigation of the active
                     * main leaf may reshape the
                     * workspace.
                     */
                    const leaf =
                        this.app.workspace
                            .activeLeaf;


                    if (
                        !this.isMainLeaf(leaf) ||
                        this.leafPath(leaf) !==
                            file.path
                    ) {
                        return;
                    }


                    this.enqueue(
                        () =>
                            this.handleOpenedFile(
                                file,
                                leaf
                            )
                    );
                }
            )
        );


        this.plugin.registerEvent(
            this.app.workspace.on(
                "active-leaf-change",
                leaf => {

                    if (
                        !this.mode ||
                        !leaf ||
                        leaf ===
                            this.mode.projectLeaf ||
                        !this.isMainLeaf(leaf) ||
                        this.leafDocument(leaf) !==
                            this.mode.ownerDocument
                    ) {
                        return;
                    }


                    this.lastActiveNoteLeaf =
                        leaf;


                    const path =
                        this.leafPath(leaf);


                    const project = this.contextForFile(path);


                    const file =
                        path
                            ? this.app.vault
                                .getAbstractFileByPath(
                                    path
                                )
                            : null;


                    if (
                        project?.projectId ===
                            this.mode.project.projectId &&
                        file instanceof TFile &&
                        file.path !== project.path
                    ) {
                        this.rememberNote(
                            project,
                            file
                        );
                    }
                    this.captureNoteLayout(true);
                }
            )
        );


        this.plugin.registerEvent(
            this.app.workspace.on(
                "layout-change",
                () =>
                    this.scheduleReconcile()
            )
        );


        this.plugin.registerEvent(
            this.app.vault.on(
                "rename",
                (
                    file,
                    oldPath
                ) =>
                    this.handleRename(
                        file,
                        oldPath
                    )
            )
        );


        this.plugin.registerEvent(
            this.app.vault.on(
                "delete",
                file =>
                    this.handleDelete(file)
            )
        );


        this.collapseNativeSidebars();


        window.setTimeout(
            () => {

                this.enqueue(
                    () =>
                        this.normalizeStartup()
                );
            },
            0
        );
    }


    destroy() {

        this.cancelNoteRestore?.();
        this.captureNoteLayout();
        this.destroyed = true;

        if (this.layoutTimer) {
            window.clearTimeout(
                this.layoutTimer
            );
        }


        this.clearModeClasses();
        this.mode = null;
        this.lastActiveNoteLeaf = null;
        this.reconcilePending = false;
    }


    collapseNativeSidebars() {

        try {
            this.app.workspace.leftSplit
                ?.collapse?.();
        } catch (_) {}


        try {
            if (!this.plugin.athena?.preserveRightSidebar()) {
                this.app.workspace.rightSplit?.collapse?.();
            }
        } catch (_) {}
    }


    setPinned(
        leaf,
        pinned
    ) {

        try {
            leaf?.setPinned?.(pinned);
        } catch (_) {}
    }


    beginLayoutMutation() {

        this.layoutRevision++;
        this.emptyContentSince = 0;
    }


    railTopology() {

        const projectLeaf =
            this.mode?.projectLeaf;


        const projectElement =
            this.leafElement(
                projectLeaf
            );


        if (
            !projectElement
                ?.isConnected
        ) {
            return {
                tabs: null,
                root: null,
                pane: null,
                valid: false
            };
        }


        const tabs =
            projectElement
                .closest(
                    ".workspace-tabs"
                );


        const root =
            projectElement
                .closest(
                    ".workspace-split.mod-root"
                );


        let pane = tabs;


        while (
            pane &&
            root &&
            pane.parentElement !== root
        ) {
            pane = pane.parentElement;
        }


        if (
            !pane ||
            !root ||
            pane.parentElement !== root
        ) {
            pane = null;
        }


        const railLeaves =
            tabs
                ? this.mainLeaves(
                    this.mode.ownerDocument
                ).filter(
                    leaf =>
                        this.leafElement(leaf)
                            .closest(
                                ".workspace-tabs"
                            ) === tabs
                )
                : [];


        const view =
            this.mode.ownerDocument
                ?.defaultView;


        const flexDirection =
            root && view
                ? view.getComputedStyle(
                    root
                ).flexDirection
                : null;


        const sideBySide =
            root?.classList.contains(
                "mod-vertical"
            ) ||
            flexDirection === "row";


        return {
            tabs,
            root,
            pane,

            valid:
                Boolean(
                    tabs &&
                    root &&
                    pane === tabs &&
                    sideBySide &&
                    railLeaves.length === 1 &&
                    railLeaves[0] ===
                        projectLeaf
                )
        };
    }


    applyModeClasses() {

        const projectElement =
            this.leafElement(
                this.mode?.projectLeaf
            );

        if (
            !projectElement
                ?.isConnected
        ) {
            return;
        }


        const leaf =
            this.mode.projectLeaf;


        const ownerDocument =
            this.leafDocument(leaf);


        const topology =
            this.railTopology();


        const tabs =
            topology.tabs;


        const root =
            topology.root;


        const pane =
            topology.pane || tabs;


        this.railPane?.classList.remove(
            "hub-project-rail-pane"
        );


        ownerDocument.body.classList.add(
            "hub-project-note-mode"
        );


        projectElement.classList.add(
            "hub-project-rail-leaf"
        );


        tabs?.classList.add(
            "hub-project-rail"
        );


        pane?.classList.add(
            "hub-project-rail-pane"
        );


        root?.classList.add(
            "hub-project-note-layout"
        );


        this.railTabs = tabs;
        this.railPane = pane;
        this.modeRoot = root;
        if (pane && this.noteRailControls?.pane !== pane) {
            this.noteRailControls?.destroy();
            this.noteRailControls = mountNoteRail(pane, this.noteRailState,
                state => { this.noteRailState = state; });
        }


        this.setPinned(
            leaf,
            true
        );


        this.syncProjectNavigation(
            ownerDocument,
            true
        );
    }


    syncProjectNavigation(
        ownerDocument,
        noteMode
    ) {

        const navigations =
            ownerDocument
                ?.querySelectorAll?.(
                    ".project-dashboard .project-nav"
                ) ?? [];


        for (const navigation of navigations) {

            selectNavigation(navigation,
                noteMode && navigation.closest(".hub-project-rail") ? "last-file" : "workspace");
        }
    }


    clearModeClasses() {
        this.noteRailControls?.destroy();
        this.noteRailControls = null;

        const leaf =
            this.mode?.projectLeaf;


        const ownerDocument =
            this.mode?.ownerDocument ||
            leaf &&
                this.leafDocument(leaf);


        this.syncProjectNavigation(
            ownerDocument,
            false
        );


        ownerDocument?.body
            ?.classList.remove(
                "hub-project-note-mode"
            );


        this.leafElement(leaf)
            ?.classList.remove(
                "hub-project-rail-leaf"
            );


        this.railTabs?.classList.remove(
            "hub-project-rail"
        );


        this.railPane?.classList.remove(
            "hub-project-rail-pane"
        );


        this.modeRoot?.classList.remove(
            "hub-project-note-layout"
        );


        this.setPinned(
            leaf,
            false
        );


        this.railTabs = null;
        this.railPane = null;
        this.modeRoot = null;
    }


    detachLeavesExcept(
        ownerDocument,
        keep
    ) {

        const retained =
            new Set(
                Array.from(keep)
                    .filter(Boolean)
            );


        for (
            const leaf
            of this.mainLeaves(
                ownerDocument
            )
        ) {

            if (
                !retained.has(leaf)
            ) {
                leaf.detach();
            }
        }
    }


    async desiredMode(file) {

        if (
            !(file instanceof TFile) ||
            file.extension !== "md"
        ) {
            return null;
        }


        if (
            file.path === "Home.md" ||
            this.contextFor(file.path)
                ?.path === file.path
        ) {
            return "preview";
        }


        return "source";
    }


    async openInLeaf(
        leaf,
        file,
        active = true
    ) {

        if (
            !leaf ||
            !(file instanceof TFile)
        ) {
            return;
        }


        const mode =
            await this.desiredMode(file);


        const state =
            mode
                ? {
                    mode,
                    source: false
                }
                : undefined;


        await leaf.openFile(
            file,
            {
                active,
                state
            }
        );
    }


    async openNoteInLeaf(
        leaf,
        file,
        active = true
    ) {

        await this.openInLeaf(leaf, file, active);
    }


    async ensureFileInLeaf(
        leaf,
        file,
        active = true
    ) {

        if (
            this.leafPath(leaf) !==
                file?.path ||
            leaf?.getViewState?.().type === NOTE_RAIL_VIEW
        ) {

            await this.openInLeaf(
                leaf,
                file,
                active
            );


            return;
        }


        await this.enforceViewMode(
            leaf,
            file
        );


        if (
            active &&
            this.app.workspace.activeLeaf !==
                leaf
        ) {
            this.app.workspace.setActiveLeaf(
                leaf,
                { focus: false }
            );
        }
    }


    async enforceViewMode(
        leaf,
        file
    ) {

        if (
            !leaf ||
            !(file instanceof TFile) ||
            file.extension !== "md"
        ) {
            return;
        }


        const mode =
            await this.desiredMode(file);


        const viewState =
            leaf.getViewState?.();


        if (
            !mode ||
            viewState?.type !==
                "markdown" ||
            viewState.state?.mode === mode
        ) {
            return;
        }


        await leaf.setViewState({
            ...viewState,

            state: {
                ...viewState.state,
                file: file.path,
                mode,
                source: false
            }
        });
    }


    createSplitLeaf(
        anchor,
        before = false
    ) {

        if (
            typeof this.app.workspace
                .createLeafBySplit ===
                "function"
        ) {

            return this.app.workspace
                .createLeafBySplit(
                    anchor,
                    "vertical",
                    before
                );
        }


        this.app.workspace.setActiveLeaf(
            anchor,
            { focus: false }
        );


        return this.app.workspace
            .getLeaf(
                "split",
                "vertical"
            );
    }


    createTabLeaf(anchor) {

        this.app.workspace.setActiveLeaf(
            anchor,
            { focus: false }
        );


        return this.app.workspace
            .getLeaf("tab");
    }


    contentLeaves() {

        if (!this.mode) {
            return [];
        }


        return this.mainLeaves(
            this.mode.ownerDocument
        ).filter(
            leaf =>
                leaf !==
                    this.mode.projectLeaf
        );
    }


    usableContentLeaves() {

        return this.contentLeaves()
            .filter(
                leaf =>
                    leaf.getViewState?.()
                        ?.type !== "empty" &&
                    this.leafPath(leaf) !==
                        this.mode?.project.path
            );
    }


    pickContentLeaf() {

        if (
            this.lastActiveNoteLeaf &&
            this.leafElement(
                this.lastActiveNoteLeaf
            )?.isConnected &&
            this.lastActiveNoteLeaf !==
                this.mode?.projectLeaf &&
            this.lastActiveNoteLeaf
                .getViewState?.()
                ?.type !== "empty" &&
            this.leafPath(
                this.lastActiveNoteLeaf
            ) !==
                this.mode?.project.path &&
            this.leafDocument(
                this.lastActiveNoteLeaf
            ) ===
                this.mode?.ownerDocument
        ) {
            return this.lastActiveNoteLeaf;
        }


        return (
            this.usableContentLeaves()[0] ||
            this.contentLeaves()[0] ||
            null
        );
    }


    async releaseModeOutside(
        ownerDocument
    ) {

        if (
            !this.mode ||
            this.mode.ownerDocument ===
                ownerDocument
        ) {
            return;
        }


        const previous =
            this.mode;


        const project =
            this.contextFor(
                previous.project.projectId
            ) ||
            previous.project;


        let projectLeaf =
            this.isMainLeaf(
                previous.projectLeaf
            ) &&
            this.leafDocument(
                previous.projectLeaf
            ) ===
                previous.ownerDocument &&
            this.leafPath(
                previous.projectLeaf
            ) === project.path
                ? previous.projectLeaf
                : this.findLeafByPath(
                    project.path,
                    previous.ownerDocument
                );


        projectLeaf =
            projectLeaf ||
            this.activeMainLeaf(
                previous.ownerDocument
            );


        this.clearModeClasses();
        this.mode = null;
        this.lastActiveNoteLeaf = null;


        if (!projectLeaf) {
            return;
        }


        this.detachLeavesExcept(
            previous.ownerDocument,
            [projectLeaf]
        );


        const file =
            this.app.vault
                .getAbstractFileByPath(
                    project.path
                );


        if (file instanceof TFile) {
            await this.ensureFileInLeaf(
                projectLeaf,
                file,
                false
            );
        }


        this.setPinned(
            projectLeaf,
            false
        );
    }


    async presentWorkspace(sourceLeaf, context, note, update) {
        if (this.plugin.oath?.canOpen(context) === false) return false;
        const doc = this.leafDocument(sourceLeaf || this.mode?.projectLeaf);
        const presentation = this.plugin.transitions?.stageWorkspace(doc);
        try {
            const result = await update();
            // Routing completes before Dataview renders. Finalize covers when
            // that render arrives without holding the next navigation in the
            // queue. A newer stage or unload cancels this stale continuation.
            if (result !== false && presentation) {
                void presentation.reveal(() => this.leafElement(
                    this.findLeafByPath(context?.path || "Home.md", doc)), context, note)
                    .catch(error => console.error('Hub destination render failed', error))
                    .finally(() => presentation.cancel());
            } else presentation?.cancel();
            return result;
        } catch (error) {
            presentation?.cancel();
            throw error;
        }
    }

    normalizeHome(preferredLeaf = null) {
        return this.presentWorkspace(preferredLeaf, null, false, () => this.applyHome(preferredLeaf));
    }

    async leaveNoteModeForHome(preferredLeaf) {
        const home = this.app.vault.getAbstractFileByPath("Home.md");
        if (!(home instanceof TFile)) return false;
        this.captureNoteLayout();
        const target = this.isMainLeaf(preferredLeaf) ? preferredLeaf : this.mode.projectLeaf;
        const doc = this.leafDocument(target);
        // Keep the current rail AND content panes mounted until Home's shared
        // renderer has committed its detached structural frame. Deferred panels
        // and cover decoding are deliberately not part of this preparation.
        const prepared = await this.plugin.preparedNoteRails.prepare(
            { path: home.path, name: "Home" },
            { main: { type: "leaf", id: target.id, state: { state: { file: home.path } } } },
            doc, "home");
        try {
            if (this.destroyed || !this.isMainLeaf(target)) return false;
            await this.releaseModeOutside(doc);
            this.beginLayoutMutation();
            await prepared.openHome(target, () => {
                // The native host installs Home and runs this callback in one
                // synchronous commit, before its asynchronous close/open yields.
                this.clearModeClasses();
                this.mode = null;
                this.lastActiveNoteLeaf = null;
                this.detachLeavesExcept(doc, [target]);
                this.setPinned(target, false);
                this.state.currentMode = "home";
                this.collapseNativeSidebars();
            });
            this.saveState();
            return true;
        } finally { prepared.dispose(); }
    }

    async applyHome(
        preferredLeaf = null
    ) {

        if (this.mode) return this.leaveNoteModeForHome(preferredLeaf);

        this.captureNoteLayout();
        this.beginLayoutMutation();

        let target =
            preferredLeaf;


        if (
            !this.isMainLeaf(target)
        ) {
            target =
                this.mode?.projectLeaf ||
                this.activeMainLeaf() ||
                this.app.workspace
                    .getLeaf(false);
        }


        const ownerDocument =
            this.leafDocument(target);


        await this.releaseModeOutside(
            ownerDocument
        );


        this.detachLeavesExcept(
            ownerDocument,
            [target]
        );


        const home =
            this.app.vault
                .getAbstractFileByPath(
                    "Home.md"
                );


        if (home instanceof TFile) {
            await this.ensureFileInLeaf(
                target,
                home
            );
        }


        this.clearModeClasses();
        this.mode = null;
        this.lastActiveNoteLeaf = null;


        this.setPinned(
            target,
            false
        );


        this.state.currentMode =
            "home";

        this.saveState();
        this.collapseNativeSidebars();
    }


    openHome(source = null) {

        const sourceLeaf =
            this.leafForSource(source);

        const open =
            () =>
                this.enqueue(
                    () =>
                        this.normalizeHome(
                            sourceLeaf ||
                            this.mode?.projectLeaf ||
                            this.findLeafByPath(
                                "Home.md"
                            )
                        )
                );


        return this.navigateFrom(source, open);
    }


    async showProjectFull(project, preferredLeaf = null) {
        const context = this.contextFor(project);
        if (!context || !await this.plugin.ensureContextOpen(context, this.dashboardRoot(preferredLeaf))) return false;
        return this.presentWorkspace(preferredLeaf, context, false,
            () => this.applyProjectFull(context, preferredLeaf));
    }

    async applyProjectFull(
        project,
        preferredLeaf = null
    ) {

        const record =
            this.contextFor(project);


        if (!record) {
            return false;
        }

        this.captureNoteLayout();

        const file =
            this.app.vault
                .getAbstractFileByPath(
                    record.path
                );


        if (!(file instanceof TFile)) {
            return false;
        }


        this.beginLayoutMutation();


        let target =
            preferredLeaf;


        if (
            !this.isMainLeaf(target)
        ) {
            target =
                this.mode?.projectLeaf ||
                this.findLeafByPath(
                    record.path
                ) ||
                this.activeMainLeaf() ||
                this.app.workspace
                    .getLeaf(false);
        }


        const ownerDocument =
            this.leafDocument(target);


        await this.releaseModeOutside(
            ownerDocument
        );


        this.clearModeClasses();
        this.mode = null;
        this.lastActiveNoteLeaf = null;


        this.detachLeavesExcept(
            ownerDocument,
            [target]
        );


        await this.ensureFileInLeaf(
            target,
            file
        );


        this.setPinned(
            target,
            false
        );


        this.rememberContext(record);
        this.state.currentMode =
            record.contextKind === "resource"
                ? "resource"
                : "project";
        this.saveState();
        this.collapseNativeSidebars();


        return true;
    }


    openProjectFull(
        project,
        source = null
    ) {
        if (this.plugin.oath?.canOpen(this.contextFor(project)) === false) return Promise.resolve(false);

        const sourceLeaf =
            this.leafForSource(source);

        const open =
            () =>
                this.enqueue(
                    () =>
                        this.showProjectFull(
                            project,
                            sourceLeaf
                        )
                );


        return this.navigateFrom(source, open);
    }


    isProjectNoteMode(project) {

        const record =
            this.contextFor(project);


        return Boolean(
            record &&
            this.mode &&
            this.mode.project.projectId ===
                record.projectId &&
            this.leafElement(
                this.mode.projectLeaf
            )?.isConnected
        );
    }


    async enterProjectNoteMode(project, file, options = {}) {
        if (this.plugin.oath?.canOpen(file?.path) === false) return false;
        const context = this.plugin.oath?.projectWorkspaceForPath(file?.path) || this.contextFor(project);
        if (!context || !(file instanceof TFile) || file.path === context.path) return false;
        if (!await this.plugin.ensureContextOpen(context, this.dashboardRoot(options.sourceLeaf))) return false;
        return this.presentWorkspace(options.sourceLeaf || options.existingLeaf, context, true,
            () => this.applyProjectNoteMode(context, file, options));
    }

    async applyProjectNoteMode(
        project,
        file,
        options = {}
    ) {

        const record =
            this.contextFor(project);


        if (
            !record ||
            !(file instanceof TFile) ||
            file.path === record.path
        ) {
            return false;
        }

        this.beginLayoutMutation();


        const placement =
            [
                "replace",
                "tab",
                "split"
            ].includes(
                options.placement
            )
                ? options.placement
                : "replace";


        let existingLeaf =
            options.existingLeaf;


        let sourceLeaf =
            options.sourceLeaf;


        if (
            !this.isMainLeaf(existingLeaf)
        ) {
            existingLeaf = null;
        }


        if (
            !this.isMainLeaf(sourceLeaf)
        ) {
            sourceLeaf = null;
        }


        const sameMode =
            this.mode &&
            this.mode.project.projectId ===
                record.projectId &&
            this.leafElement(
                this.mode.projectLeaf
            )?.isConnected &&
            this.leafPath(
                this.mode.projectLeaf
            ) === record.path &&
            (
                !(existingLeaf || sourceLeaf) ||
                this.leafDocument(
                    existingLeaf ||
                    sourceLeaf
                ) ===
                    this.mode.ownerDocument
            );


        if (sameMode) {

            this.applyModeClasses();


            let target =
                existingLeaf &&
                existingLeaf !==
                    this.mode.projectLeaf
                    ? existingLeaf
                    : this.pickContentLeaf();


            if (
                placement === "split"
            ) {

                target =
                    this.createSplitLeaf(
                        target ||
                        this.mode.projectLeaf
                    );

            } else if (
                placement === "tab"
            ) {

                target =
                    target
                        ? this.createTabLeaf(
                            target
                        )
                        : this.createSplitLeaf(
                            this.mode.projectLeaf
                        );

            } else if (!target) {

                target =
                    this.createSplitLeaf(
                        this.mode.projectLeaf
                    );
            }


            await this.openNoteInLeaf(
                target,
                file
            );


            this.lastActiveNoteLeaf =
                target;

            this.rememberNote(
                record,
                file
            );

            this.state.currentMode =
                "note";
            this.saveState();
            this.applyModeClasses();

            this.captureNoteLayout();
            return true;
        }


        let ownerDocument =
            existingLeaf
                ? this.leafDocument(
                    existingLeaf
                )
                : this.leafDocument(
                    sourceLeaf ||
                    this.activeMainLeaf()
                );


        await this.releaseModeOutside(
            ownerDocument
        );


        this.clearModeClasses();
        this.mode = null;
        this.lastActiveNoteLeaf = null;


        let projectLeaf =
            this.findLeafByPath(
                record.path,
                ownerDocument
            );


        /*
         * Begin every note-mode from a
         * simple, known shell. This keeps
         * an old split tree from becoming
         * part of the fixed project rail.
         */
        if (existingLeaf) {

            this.detachLeavesExcept(
                ownerDocument,
                [existingLeaf]
            );


            projectLeaf =
                this.createSplitLeaf(
                    existingLeaf,
                    true
                );

        } else {

            projectLeaf =
                projectLeaf ||
                sourceLeaf ||
                this.activeMainLeaf(
                    ownerDocument
                ) ||
                this.app.workspace
                    .getLeaf(false);


            ownerDocument =
                this.leafDocument(
                    projectLeaf
                );


            this.detachLeavesExcept(
                ownerDocument,
                [projectLeaf]
            );
        }


        ownerDocument =
            this.leafDocument(
                projectLeaf
            );


        this.mode = {
            project: record,
            projectLeaf,
            ownerDocument
        };


        // A mounted Workspace becomes the rail in this turn. Do not narrow a
        // Home/source page still occupying this leaf; a new Workspace renderer
        // reads the destination mode above before committing its own header.
        if (this.leafPath(projectLeaf) === record.path) this.applyModeClasses();

        ownerDocument.body.classList.add(
            "hub-project-note-mode"
        );


        const projectFile =
            this.app.vault
                .getAbstractFileByPath(
                    record.path
                );


        if (projectFile instanceof TFile) {
            await this.ensureFileInLeaf(
                projectLeaf,
                projectFile,
                false
            );
        }


        this.applyModeClasses();


        let target =
            existingLeaf &&
            existingLeaf !== projectLeaf
                ? existingLeaf
                : null;


        if (!target) {
            target =
                this.createSplitLeaf(
                    projectLeaf
                );
        }


        await this.openNoteInLeaf(
            target,
            file
        );


        this.lastActiveNoteLeaf =
            target;

        this.rememberNote(
            record,
            file
        );

        this.state.currentMode =
            "note";
        this.saveState();
        this.applyModeClasses();
        this.collapseNativeSidebars();

        this.captureNoteLayout();
        return true;
    }


    openProjectNote(
        path,
        placement = "replace",
        source = null
    ) {
        if (this.plugin.oath?.canOpen(path) === false) return Promise.resolve(false);

        const sourceLeaf =
            this.leafForSource(source);

        const open = () => this.enqueue(
            async () => {

                const file =
                    this.app.vault
                        .getAbstractFileByPath(
                            path
                        );


                const project = this.contextForFile(path, source);


                if (
                    !(file instanceof TFile) ||
                    !project
                ) {
                    return false;
                }


                if (
                    file.path === project.path
                ) {
                    return this.showProjectFull(
                        project,
                        sourceLeaf
                    );
                }


                if (!this.isProjectNoteMode(project)) {
                    if (!await this.plugin.ensureContextOpen(project, this.dashboardRoot(source))) return false;
                    if (placement === "split") await this.restoreNoteLayout(project);
                    else if (this.state.projects[project.projectId]) {
                        delete this.state.projects[project.projectId].layout;
                        this.saveState();
                    }
                }
                return this.enterProjectNoteMode(
                    project,
                    file,
                    {
                        placement,
                        sourceLeaf
                    }
                );
            }
        );
        return this.navigateFrom(source, open);
    }


    async openFile(
        path,
        preferredLeaf = null
    ) {

        const file =
            this.app.vault
                .getAbstractFileByPath(path);


        if (!(file instanceof TFile) || this.plugin.oath?.canOpen(file.path) === false) {
            return false;
        }


        if (file.path === "Home.md") {
            await this.normalizeHome(
                preferredLeaf
            );
            return true;
        }


        const project =
            this.contextForFile(file.path);


        if (project) {

            if (
                file.path === project.path
            ) {
                return this.showProjectFull(
                    project,
                    preferredLeaf
                );
            }


            return this.enterProjectNoteMode(
                project,
                file,
                {
                    sourceLeaf:
                        preferredLeaf
                }
            );
        }


        let leaf =
            this.isMainLeaf(
                preferredLeaf
            )
                ? preferredLeaf
                : this.mode
                ? this.pickContentLeaf()
                : this.activeMainLeaf();


        if (!leaf) {
            leaf =
                this.mode
                    ? this.createSplitLeaf(
                        this.mode.projectLeaf
                    )
                    : this.app.workspace
                        .getLeaf(false);
        }


        await this.openInLeaf(
            leaf,
            file
        );
        // Queued navigation suppresses file-open events, so record this route
        // explicitly just as Project/Resource Note-view opening does.
        this.rememberVaultFile(file);


        return true;
    }


    openPath(
        path,
        source = null
    ) {

        const sourceLeaf =
            this.leafForSource(source);

        const open = () => this.enqueue(
            () =>
                this.openFile(
                    path,
                    sourceLeaf
                )
        );
        return this.navigateFrom(source, open);
    }


    openLastProject(source = null) {

        const sourceLeaf =
            this.leafForSource(source);

        const open =
            () =>
                this.enqueue(
                    async () => {

                        const project =
                            this.lastProject();


                        if (!project) {
                            new Notice(
                                "No project has been opened yet."
                            );
                            return false;
                        }


                        return this.showProjectFull(
                            project,
                            sourceLeaf
                        );
                    }
                );


        return this.navigateFrom(source, open);
    }


    openLastResource(source = null) {
        const sourceLeaf = this.leafForSource(source);
        const open = () => this.enqueue(async () => {
            const resource = this.lastResource();
            if (!resource) {
                new Notice("No Resource has been opened yet.");
                return false;
            }
            return this.showProjectFull(resource, sourceLeaf);
        });
        return this.navigateFrom(source, open);
    }


    openLastFile(dashboardRoot) {

        return this.enqueue(
            async () => {

                const sourceLeaf =
                    this.leafForSource(
                        dashboardRoot
                    );


                const transitionRoot =
                    this.dashboardRoot(
                        dashboardRoot
                    );

                const destination = this.resolveLastFile(dashboardRoot);
                if (!destination) {
                    new Notice("No recently opened files.");
                    return false;
                }
                const { file, context: project, layout } = destination;

                const open = async () => {
                    if (!project) return this.openFile(file.path, sourceLeaf);
                    if (!await this.plugin.ensureContextOpen(project, transitionRoot)) return false;
                    if (!this.isProjectNoteMode(project) && layout && await this.restoreNoteLayout(project, layout)) return true;
                    if (!file) return this.isProjectNoteMode(project);
                    return this.enterProjectNoteMode(
                            project,
                            file,
                            { sourceLeaf }
                        );
                };


                let opened = false;
                const navigate = async () => { opened = await open(); return opened; };
                if (transitionRoot) {
                    await this.plugin.transitions
                        .navigateToLastFile(
                            transitionRoot,
                            navigate
                        );
                } else {
                    await navigate();
                }


                return opened;
            }
        );
    }


    async handleOpenedFile(
        file,
        leaf
    ) {

        if (file.path === "Home.md") {
            await this.normalizeHome(leaf);
            return;
        }


        const project = this.contextContainsFile(this.dragContext, file.path)
            ? this.dragContext : this.contextForFile(file.path);
        this.dragContext = null;


        if (
            project &&
            file.path === project.path
        ) {

            if (
                this.mode &&
                leaf ===
                    this.mode.projectLeaf &&
                this.mode.project.projectId ===
                    project.projectId
            ) {
                this.applyModeClasses();
                return;
            }


            await this.showProjectFull(
                project,
                leaf
            );

            return;
        }


        if (project) {

            if (
                this.mode &&
                this.mode.project.projectId ===
                    project.projectId &&
                leaf &&
                leaf !==
                    this.mode.projectLeaf
            ) {

                this.lastActiveNoteLeaf =
                    leaf;

                this.rememberNote(
                    project,
                    file
                );

                await this.enforceViewMode(
                    leaf,
                    file
                );

                this.applyModeClasses();

            } else {

                await this.enterProjectNoteMode(
                    project,
                    file,
                    {
                        existingLeaf:
                            leaf
                    }
                );
            }


            return;
        }


        if (
            this.mode &&
            leaf ===
                this.mode.projectLeaf
        ) {

            await this.enterProjectNoteMode(
                this.mode.project,
                file,
                {
                    existingLeaf:
                        leaf
                }
            );

            return;
        }


        await this.enforceViewMode(
            leaf,
            file
        );
        this.rememberVaultFile(file);
    }


    async normalizeStartup() {

        const active =
            this.activeMainLeaf();


        const path =
            this.leafPath(active);


        if (path === "Home.md") {
            await this.normalizeHome(active);
            return;
        }


        if (
            this.state.currentMode ===
                "note"
        ) {

            const project =
                this.lastContext();


            if (project) {

                const projectLeaf =
                    this.findLeafByPath(
                        project.path,
                        active
                            ? this.leafDocument(
                                active
                            )
                            : null
                    );


                if (projectLeaf) {

                    const ownerDocument =
                        this.leafDocument(
                            projectLeaf
                        );


                    const content =
                        this.mainLeaves(
                            ownerDocument
                        ).filter(
                            leaf =>
                                leaf !==
                                    projectLeaf &&
                                leaf.getViewState?.()
                                    ?.type !==
                                        "empty"
                        );


                    if (
                        content.length > 0
                    ) {

                        this.mode = {
                            project,
                            projectLeaf,
                            ownerDocument
                        };

                        this.lastActiveNoteLeaf =
                            content.includes(active)
                                ? active
                                : content[0];

                        for (const leaf of content) {
                            const file = this.app.vault.getAbstractFileByPath(this.leafPath(leaf) ?? "");
                            if (file instanceof TFile) await this.enforceViewMode(leaf, file);
                        }
                        this.applyModeClasses();
                        return;
                    }
                }
            }
        }


        if (path) {

            const file =
                this.app.vault
                    .getAbstractFileByPath(path);


            if (file instanceof TFile) {
                await this.handleOpenedFile(
                    file,
                    active
                );
            }
        }
    }


    scheduleReconcile() {

        if (this.destroyed) {
            return;
        }


        if (
            this.internalDepth > 0
        ) {
            this.reconcilePending = true;
            return;
        }


        if (this.layoutTimer) {
            window.clearTimeout(
                this.layoutTimer
            );
        }


        const revision =
            this.layoutRevision;


        this.layoutTimer =
            window.setTimeout(
                () => {

                    this.layoutTimer = null;


                    if (
                        !this.destroyed
                    ) {
                        this.enqueue(
                            () => {

                                if (
                                    revision !==
                                        this.layoutRevision
                                ) {
                                    return false;
                                }


                                return this.reconcile();
                            },
                            false
                        );
                    }
                },
                60
            );
    }


    async rebuildNoteLayout() {

        if (!this.mode) {
            return false;
        }


        const project =
            this.contextFor(
                this.mode.project.projectId
            ) ||
            this.mode.project;


        const ownerDocument =
            this.mode.ownerDocument;


        const projectFile =
            this.app.vault
                .getAbstractFileByPath(
                    project.path
                );


        const entries =
            this.usableContentLeaves()
                .map(leaf => ({
                    leaf,
                    viewState:
                        leaf.getViewState?.(),
                    active:
                        this.app.workspace
                            .activeLeaf === leaf
                }))
                .filter(
                    entry =>
                        entry.viewState
                );


        if (
            !(projectFile instanceof TFile) ||
            entries.length === 0
        ) {
            return false;
        }


        const preferred =
            entries.find(
                entry =>
                    entry.active
            ) ||
            entries.find(
                entry =>
                    entry.leaf ===
                        this.lastActiveNoteLeaf
            ) ||
            entries[0];


        const keeper =
            preferred.leaf;


        this.clearModeClasses();
        this.mode = null;
        this.lastActiveNoteLeaf = null;


        this.detachLeavesExcept(
            ownerDocument,
            [keeper]
        );


        const projectLeaf =
            this.createSplitLeaf(
                keeper,
                true
            );


        this.mode = {
            project,
            projectLeaf,
            ownerDocument
        };


        ownerDocument.body.classList.add(
            "hub-project-note-mode"
        );


        await this.ensureFileInLeaf(
            projectLeaf,
            projectFile,
            false
        );


        let lastTarget =
            keeper;


        let activeTarget =
            keeper;


        for (
            const entry
            of entries
        ) {

            if (entry === preferred) {
                continue;
            }


            const target =
                this.createSplitLeaf(
                    lastTarget
                );


            await target.setViewState(
                entry.viewState
            );


            lastTarget = target;


            if (entry.active) {
                activeTarget = target;
            }
        }


        this.lastActiveNoteLeaf =
            activeTarget;


        this.app.workspace.setActiveLeaf(
            activeTarget,
            { focus: false }
        );


        this.state.currentMode =
            "note";
        this.saveState();
        this.applyModeClasses();


        return true;
    }


    async reconcile() {

        const homeLeaf =
            this.findLeafByPath(
                "Home.md",
                this.mode
                    ?.ownerDocument ||
                    null
            );


        if (homeLeaf) {

            if (this.mode) {

                const projectFile =
                    this.app.vault
                        .getAbstractFileByPath(
                            this.mode.project.path
                        );


                if (
                    homeLeaf ===
                        this.mode.projectLeaf &&
                    projectFile instanceof TFile
                ) {
                    await this.ensureFileInLeaf(
                        homeLeaf,
                        projectFile,
                        false
                    );

                } else {

                    const noteFile =
                        this.lastNoteFile(
                            this.mode.project
                        );


                    if (noteFile instanceof TFile) {
                        await this.openInLeaf(
                            homeLeaf,
                            noteFile,
                            true
                        );
                    } else {
                        homeLeaf.detach();
                    }
                }


                this.applyModeClasses();
                this.scheduleReconcile();
                return;
            }

            const ownerDocument =
                this.leafDocument(
                    homeLeaf
                );


            const state =
                homeLeaf.getViewState?.();


            if (
                this.mainLeaves(
                    ownerDocument
                ).length > 1 ||
                state?.state?.mode !==
                    "preview" ||
                this.mode
            ) {

                await this.normalizeHome(
                    homeLeaf
                );
            }


            return;
        }


        if (!this.mode) {
            return;
        }


        const {
            project,
            projectLeaf,
            ownerDocument
        } = this.mode;


        if (
            !this.leafElement(
                projectLeaf
            )?.isConnected ||
            this.leafPath(projectLeaf) !==
                project.path
        ) {

            const replacement =
                this.findLeafByPath(
                    project.path,
                    ownerDocument
                );


            if (!replacement) {
                this.clearModeClasses();
                this.mode = null;
                this.state.currentMode =
                    null;
                this.saveState();
                return;
            }


            this.mode.projectLeaf =
                replacement;
        }


        this.applyModeClasses();


        const usable =
            this.usableContentLeaves();


        if (usable.length > 0) {

            this.emptyContentSince = 0;

            if (
                !this.railTopology()
                    .valid
            ) {

                await this.rebuildNoteLayout();
                return;
            }


            this.applyModeClasses();
            this.captureNoteLayout();
            return;
        }


        const now = Date.now();


        if (!this.emptyContentSince) {
            this.emptyContentSince = now;
        }


        /*
         * A newly opened Obsidian leaf can
         * briefly report an `empty` view.
         * Do not mistake that transient
         * state for the user closing the
         * final content pane.
         */
        if (
            now - this.emptyContentSince <
                750
        ) {
            this.scheduleReconcile();
            return;
        }


        this.emptyContentSince = 0;


        for (
            const emptyLeaf
            of this.contentLeaves()
        ) {
            emptyLeaf.detach();
        }


        await this.showProjectFull(
            project,
            this.mode.projectLeaf
        );
    }


    handleRename(
        file,
        oldPath
    ) {

        const nextPath =
            file?.path;


        if (
            !nextPath ||
            !oldPath
        ) {
            return;
        }


        let changed = false;


        const rewritePath =
            value => {

                if (
                    value === oldPath ||
                    value?.startsWith(
                        `${oldPath}/`
                    )
                ) {
                    return (
                        nextPath +
                        value.slice(
                            oldPath.length
                        )
                    );
                }


                return value;
            };

        this.plugin.presets?.rewritePaths(rewritePath);
        changed = this.navigationHistory.rewritePaths(rewritePath) || changed;


        if (this.mode?.project) {

            const previous =
                this.mode.project;


            const path =
                rewritePath(
                    previous.path
                );


            const root =
                rewritePath(
                    previous.root
                );


            if (
                path !== previous.path ||
                root !== previous.root
            ) {

                this.mode.project = {
                    ...previous,
                    path,
                    root
                };


                changed = true;
            }
        }


        for (
            const entry
            of Object.values(
                this.state.projects
            )
        ) {
            if (entry?.configurations) {
                entry.configurations = entry.configurations.map(item => ({ ...item,
                    hubPath: rewritePath(item.hubPath), root: rewritePath(item.root),
                    layout: rewriteLayoutPaths(item.layout, rewritePath),
                    folderState: item.folderState ? { ...item.folderState,
                        folders: Object.fromEntries(Object.entries(item.folderState.folders ?? {}).map(([path, state]) =>
                            [rewritePath(path), { ...state, currentPath: rewritePath(state.currentPath) }])) } : undefined
                }));
                changed = true;
            }
            if (entry?.layout) {
                entry.layout = rewriteLayoutPaths(entry.layout, rewritePath);
                changed = true;
            }

            for (
                const key
                of [
                    "hubPath",
                    "lastNotePath"
                ]
            ) {

                const value =
                    entry?.[key];


                const nextValue =
                    rewritePath(value);


                if (nextValue !== value) {

                    entry[key] = nextValue;

                    changed = true;
                }
            }
        }

        if (this.state.lastFile?.path) {
            const nextLastFilePath = rewritePath(this.state.lastFile.path);
            if (nextLastFilePath !== this.state.lastFile.path) {
                this.state.lastFile.path = nextLastFilePath;
                changed = true;
            }
        }


        if (changed) {
            this.saveState();
            this.scheduleReconcile();
        }
    }


    handleDelete(file) {

        const path =
            file?.path;


        if (!path) {
            return;
        }


        let changed = this.navigationHistory.deletePath(path);


        for (
            const [
                projectId,
                entry
            ]
            of Object.entries(
                this.state.projects
            )
        ) {

            if (
                entry.hubPath === path ||
                entry.hubPath?.startsWith(
                    `${path}/`
                )
            ) {

                delete this.state.projects[
                    projectId
                ];


                if (
                    this.state.lastProjectId ===
                        projectId
                ) {
                    this.state.lastProjectId =
                        null;
                }

                if (`resource:${this.state.lastResourceId}` === projectId) {
                    this.state.lastResourceId = null;
                }


                changed = true;
                continue;
            }


            if (
                entry.lastNotePath === path ||
                entry.lastNotePath?.startsWith(
                    `${path}/`
                )
            ) {
                delete entry.lastNotePath;
                changed = true;
            }
        }

        if (
            this.state.lastFile?.path === path ||
            this.state.lastFile?.path?.startsWith(`${path}/`)
        ) {
            this.state.lastFile = null;
            changed = true;
        }


        if (changed) {
            this.saveState();
        }
    }
}


module.exports = class HubProjectMenu extends Plugin {
    // Ephemeral authorization admits synthetic Temp vaults only.
    static authorizeNativeTaskRehearsal(plugin, configuration) {
        return require("./lib/services/native-task-host").authorizeNativeTaskRehearsal(plugin, configuration);
    }


    getHubLocalStorage() {

        const vaultName =
            this.app.vault
                .getName();


        const result =
            {};


        for (
            let index = 0;
            index < localStorage.length;
            index++
        ) {

            const key =
                localStorage.key(
                    index
                );


            if (
                !key ||
                !key.startsWith(
                    "obsidian-hub::"
                ) ||
                !key.includes(
                    `::${vaultName}`
                )
            ) {
                continue;
            }


            result[key] =
                localStorage.getItem(
                    key
                );
        }


        return result;
    }


    hubBackupTimestamp() {

        return moment()
            .format(
                "YYYY-MM-DD_HH-mm-ss"
            );
    }


    async createHubBackup(
        label = null
    ) {

        await this.projectWizard
            .ensureFolder(
                HUB_BACKUP_ROOT
            );


        const suffix =
            label
                ? `_${label}`
                : "";


        const path =
            normalizePath(
                `${HUB_BACKUP_ROOT}/${this.hubBackupTimestamp()}${suffix}.json`
            );


        await this.dataStore.writeQueue;

        const backup = {

            kind:
                "obsidian-hub-backup",

            version:
                HUB_BACKUP_VERSION,

            exportedAt:
                new Date()
                    .toISOString(),

            vaultName:
                this.app.vault
                    .getName(),


            /*
            * Everything persisted through
            * plugin.saveData().
            */
            pluginData:
                await this.dataStore
                    .readDiskData()
                ?? this.projectWizard?.data
                ?? {},


            /*
            * Hub UI persistence that lives
            * outside plugin data.
            */
            localStorage:
                this.getHubLocalStorage()
        };


        await this.app.vault
            .create(
                path,
                JSON.stringify(
                    backup,
                    null,
                    2
                )
            );


        return path;
    }


    getHubBackupFiles() {

        return this.app.vault
            .getFiles()
            .filter(
                file =>
                    file.path.startsWith(
                        `${HUB_BACKUP_ROOT}/`
                    ) &&
                    file.extension ===
                        "json"
            )
            .sort(
                (
                    a,
                    b
                ) =>
                    b.stat.mtime -
                    a.stat.mtime
            );
    }


    validateHubBackup(
        backup
    ) {

        if (
            !backup ||
            backup.kind !==
                "obsidian-hub-backup" ||
            backup.version !==
                HUB_BACKUP_VERSION
        ) {

            throw new Error(
                "This is not a valid Obsidian Hub backup."
            );
        }


        if (
            !backup.pluginData ||
            typeof backup.pluginData !==
                "object" ||
            Array.isArray(
                backup.pluginData
            )
        ) {

            throw new Error(
                "The backup contains invalid Hub data."
            );
        }


        if (
            !backup.localStorage ||
            typeof backup.localStorage !==
                "object" ||
            Array.isArray(
                backup.localStorage
            )
        ) {

            throw new Error(
                "The backup contains invalid UI state."
            );
        }


        if (
            backup.vaultName !==
            this.app.vault
                .getName()
        ) {

            throw new Error(
                `This backup belongs to vault "${backup.vaultName}".`
            );
        }
    }


    async restoreHubBackup(
        file
    ) {

        const content =
            await this.app.vault
                .read(
                    file
                );


        let backup;


        try {

            backup =
                JSON.parse(
                    content
                );

        } catch {

            throw new Error(
                "The backup file is not valid JSON."
            );
        }


        this.validateHubBackup(
            backup
        );


        /*
        * Protect the current state before
        * replacing anything.
        */
        await this.createHubBackup(
            "pre-restore"
        );


        await this.dataStore.save(
            backup.pluginData
        );


        /*
        * Remove the current Hub UI state
        * for this vault before restoring
        * the backed-up values.
        */
        const currentKeys =
            Object.keys(
                this.getHubLocalStorage()
            );


        for (
            const key
            of currentKeys
        ) {

            localStorage.removeItem(
                key
            );
        }


        for (
            const [
                key,
                value
            ]
            of Object.entries(
                backup.localStorage
            )
        ) {

            if (
                value !== null
            ) {

                localStorage.setItem(
                    key,
                    value
                );
            }
        }


        /*
        * Reload so every bridge, dashboard
        * and in-memory service reads the
        * restored state cleanly.
        */
        await this.app.commands
            .executeCommandById(
                "app:reload"
            );
    }


    openHubBackupRestore() {

        const backups =
            this.getHubBackupFiles();


        if (
            backups.length === 0
        ) {

            new Notice(
                "No Hub backups found."
            );

            return;
        }


        new HubBackupPickerModal(
            this.app,
            backups,

            async file => {

                const confirmed =
                    await confirmAction(
                        this.app,

                        "Restore Hub backup?",

                        `Restore "${file.basename}"? A backup of the current Hub state will be created first.`,

                        "Restore"
                    );


                if (
                    !confirmed
                ) {
                    return;
                }


                try {

                    await this.restoreHubBackup(
                        file
                    );

                } catch (error) {

                    console.error(
                        "Could not restore Hub backup:",
                        error
                    );


                    new Notice(
                        error.message ||
                        "Could not restore Hub backup."
                    );
                }
            }
        ).open();
    }

    async vaultPathExists(path) {
        return Boolean(
            this.app.vault
                .getAbstractFileByPath(path) ||
            await this.app.vault.adapter
                .exists(path)
        );
    }


    async auditHubFiles(repair = false) {
        const issues = [];
        let changed = false;

        const addIssue = (
            code,
            message,
            count = 1,
            repairable = true
        ) => {
            issues.push({
                code,
                message,
                count,
                repairable
            });
        };

        if (!await this.vaultPathExists("Home.md")) {
            addIssue(
                "missing-home-hub",
                "The Home hub file is missing"
            );

            if (repair) {
                await this.app.vault.create(
                    "Home.md",
                    [
                        "---",
                        "cssclasses:",
                        "  - dashboard",
                        "cover:",
                        "---",
                        "",
                        "```dataviewjs",
                        'await dv.view("System/Dashboards/Home")',
                        "```",
                        ""
                    ].join("\n")
                );
                changed = true;
                await yieldToObsidian();
            }
        }

        const missingResources = [];

        for (const resource of RESOURCE_TYPES) {
            if (!await this.vaultPathExists(resource.hubPath)) {
                missingResources.push(resource.label);
            }
        }

        if (missingResources.length) {
            addIssue(
                "missing-resource-hubs",
                `${missingResources.length} Resource hub file${missingResources.length === 1 ? " is" : "s are"} missing: ${missingResources.join(", ")}`,
                missingResources.length
            );

            if (repair) {
                await this.projectWizard.ensureResources();
                changed = true;
            }
        }

        for (const runtimePath of [
            "System/Dashboards/Home/view.js",
            "System/Dashboards/Project/view.js"
        ]) {
            if (!await this.vaultPathExists(runtimePath)) {
                addIssue(
                    "missing-dashboard-runtime",
                    `Required dashboard runtime is missing: ${runtimePath}`,
                    1,
                    false
                );
            }
        }

        const projectsRoot =
            this.app.vault
                .getAbstractFileByPath("Projects");
        const projectFolders =
            projectsRoot instanceof TFolder
                ? projectsRoot.children
                    .filter(child =>
                        child instanceof TFolder
                    )
                : [];
        const missingProjectFolders = [];
        const blockedProjectFolders = [];

        for (const folder of projectFolders) {
            const hubFiles = folder.children.filter(child =>
                child instanceof TFile &&
                child.extension === "md" &&
                this.app.metadataCache
                    .getFileCache(child)
                    ?.frontmatter?.type === "project"
            );

            if (hubFiles.length) {
                continue;
            }

            const expectedPath =
                `${folder.path}/${folder.name}.md`;
            const expectedExists =
                await this.vaultPathExists(expectedPath);

            if (expectedExists) {
                blockedProjectFolders.push(folder.name);
                continue;
            }

            missingProjectFolders.push(folder);
        }

        if (missingProjectFolders.length) {
            addIssue(
                "missing-project-hubs",
                `${missingProjectFolders.length} project folder${missingProjectFolders.length === 1 ? " has" : "s have"} no Hub file`,
                missingProjectFolders.length
            );

            if (repair) {
                const categoryId =
                    this.projectWizard.categories[0]?.id ??
                    DEFAULT_CATEGORIES[0].id;

                for (const folder of missingProjectFolders) {
                    const folderOrder = folder.children
                        .filter(child => child instanceof TFolder)
                        .map(child => child.name);
                    const content = [
                        "---",
                        "type: project",
                        `projectId: ${JSON.stringify(randomUUID())}`,
                        "status: active",
                        `category: ${JSON.stringify(categoryId)}`,
                        "resource_folders: []",
                        "cssclasses: [dashboard]",
                        "folder_order:",
                        ...folderOrder.map(name =>
                            `  - ${JSON.stringify(name)}`
                        ),
                        "---",
                        "",
                        "```dataviewjs",
                        'await dv.view("System/Dashboards/Project")',
                        "```",
                        ""
                    ].join("\n");

                    await this.app.vault.create(
                        `${folder.path}/${folder.name}.md`,
                        content
                    );
                    await yieldToObsidian();
                }

                changed = true;
            }
        }

        if (blockedProjectFolders.length) {
            addIssue(
                "invalid-project-hubs",
                `${blockedProjectFolders.length} expected project Hub file${blockedProjectFolders.length === 1 ? " exists" : "s exist"} but lacks project metadata: ${blockedProjectFolders.join(", ")}`,
                blockedProjectFolders.length,
                false
            );
        }

        const projectFiles =
            this.app.vault
                .getMarkdownFiles()
                .filter(file =>
                    file.path.startsWith("Projects/") &&
                    this.app.metadataCache
                        .getFileCache(file)
                        ?.frontmatter?.type === "project"
                );
        let missingProjectIds = 0;
        const filesByProjectId = new Map();

        for (const file of projectFiles) {
            const projectId = String(
                this.app.metadataCache
                    .getFileCache(file)
                    ?.frontmatter?.projectId ??
                ""
            ).trim();

            if (!projectId) {
                missingProjectIds++;

                if (repair) {
                    await this.app.fileManager
                        .processFrontMatter(
                            file,
                            metadata => {
                                metadata.projectId =
                                    randomUUID();
                            }
                        );
                    await yieldToObsidian();
                    changed = true;
                }

                continue;
            }

            if (!filesByProjectId.has(projectId)) {
                filesByProjectId.set(projectId, []);
            }

            filesByProjectId.get(projectId).push(file);
        }

        if (missingProjectIds) {
            addIssue(
                "missing-project-ids",
                `${missingProjectIds} project Hub file${missingProjectIds === 1 ? " is" : "s are"} missing a stable ID`,
                missingProjectIds
            );
        }

        const duplicateProjectFiles = [];

        for (const files of filesByProjectId.values()) {
            files.sort((left, right) =>
                left.path.localeCompare(right.path)
            );
            duplicateProjectFiles.push(...files.slice(1));
        }

        if (duplicateProjectFiles.length) {
            addIssue(
                "duplicate-project-ids",
                `${duplicateProjectFiles.length} duplicated project ID${duplicateProjectFiles.length === 1 ? "" : "s"}`,
                duplicateProjectFiles.length
            );

            if (repair) {
                for (const file of duplicateProjectFiles) {
                    await this.app.fileManager
                        .processFrontMatter(
                            file,
                            metadata => {
                                metadata.projectId =
                                    randomUUID();
                            }
                        );
                    await yieldToObsidian();
                }

                changed = true;
            }
        }

        const validResourceFolderIds = new Set(
            Object.keys(
                this.projectWizard.resourceFolders
            )
        );
        let invalidProjectResourceReferences = 0;

        for (const file of projectFiles) {
            const frontmatter =
                this.app.metadataCache
                    .getFileCache(file)
                    ?.frontmatter;
            const original = Array.isArray(
                frontmatter?.resource_folders
            )
                ? [
                    ...new Set(
                        frontmatter.resource_folders
                            .map(String)
                            .filter(Boolean)
                    )
                ]
                : [];
            const valid = original.filter(id =>
                validResourceFolderIds.has(id)
            );
            const invalidCount =
                original.length - valid.length;

            if (!invalidCount) {
                continue;
            }

            invalidProjectResourceReferences +=
                invalidCount;

            if (repair) {
                await this.app.fileManager
                    .processFrontMatter(
                        file,
                        metadata => {
                            metadata.resource_folders =
                                valid;
                        }
                    );
                await yieldToObsidian();
                changed = true;
            }
        }

        if (invalidProjectResourceReferences) {
            addIssue(
                "invalid-project-resource-references",
                `${invalidProjectResourceReferences} invalid Resource folder reference${invalidProjectResourceReferences === 1 ? "" : "s"} in project files`,
                invalidProjectResourceReferences
            );
        }

        return {
            changed,
            issues
        };
    }


    auditLocalUiState(repair = false) {
        const issues = [];
        const projects =
            this.projectWizard.getProjectRecords();
        const validProjectIds = new Set(
            projects.map(project => project.projectId)
        );
        const validResourceIds = new Set(
            RESOURCE_TYPES.map(resource => resource.id)
        );
        const workspaceAudit = auditWorkspaceState(
            this.workspaceModes.state,
            {
                validProjectIds,
                validResourceIds,
                pathExists: path => Boolean(
                    this.app.vault
                        .getAbstractFileByPath(path)
                )
            }
        );

        issues.push(...workspaceAudit.issues);

        if (repair && workspaceAudit.changed) {
            this.workspaceModes.state =
                workspaceAudit.repairedState;
            this.workspaceModes.saveState();
        }

        const vaultName =
            this.app.vault.getName();
        const validContextIds = new Set([
            ...validProjectIds,
            ...[...validResourceIds].map(id =>
                `resource:${id}`
            )
        ]);
        const staleFolderUiKeys = Object.keys(this.projectWizard.data.folderUi ?? {})
            .filter(id => !validContextIds.has(id));
        if (staleFolderUiKeys.length) {
            issues.push({
                code: "stale-local-ui-state",
                message: `${staleFolderUiKeys.length} stale dashboard state entries`,
                count: staleFolderUiKeys.length,
                repairable: true
            });
            if (repair) {
                const folders = { ...this.projectWizard.data.folderUi };
                for (const id of staleFolderUiKeys) delete folders[id];
                this.workspaceState.write("folderUi", folders);
            }
        }

        const sessionRules = [
            [
                "obsidian-hub::home-progress-scope",
                ["projects", "resources"]
            ],
            [
                "obsidian-hub::home-progress-view",
                ["reports", "activity", "tasks"]
            ],
            [
                "obsidian-hub::project-progress-view",
                ["reports", "activity", "tasks"]
            ]
        ];
        const staleSessionKeys = sessionRules
            .filter(([key, allowed]) => {
                const value = sessionStorage.getItem(key);
                return value != null && !allowed.includes(value);
            })
            .map(([key]) => key);

        if (staleSessionKeys.length) {
            issues.push({
                code: "stale-session-ui-state",
                message: `${staleSessionKeys.length} invalid dashboard view preference${staleSessionKeys.length === 1 ? "" : "s"}`,
                count: staleSessionKeys.length,
                repairable: true
            });

            if (repair) {
                for (const key of staleSessionKeys) {
                    sessionStorage.removeItem(key);
                }
            }
        }

        return {
            changed:
                workspaceAudit.changed ||
                staleFolderUiKeys.length > 0 ||
                staleSessionKeys.length > 0,
            issues
        };
    }


    async collectExistingResourceFolderPaths() {
        const paths = new Set();

        for (
            const record
            of Object.values(
                this.projectWizard.resourceFolders
            )
        ) {
            if (
                record?.path &&
                await this.vaultPathExists(record.path)
            ) {
                paths.add(record.path);
            }
        }

        return paths;
    }


    async runHubDataAudit(repair = false) {
        if (repair) {
            await this.createHubBackup("pre-audit");
        }

        const conflicts =
            await this.dataStore.findConflictFiles();
        const fileAudit =
            await this.auditHubFiles(repair);

        if (repair && fileAudit.changed) {
            await this.projectWizard
                .syncResourceFolders();
            await yieldToObsidian();
        }

        const existingResourceFolderPaths =
            await this.collectExistingResourceFolderPaths();
        const dataAudit = auditHubData(
            this.projectWizard.data,
            {
                projects:
                    this.projectWizard
                        .getProjectRecords(),
                resourceTypes:
                    RESOURCE_TYPES,
                existingResourceFolderPaths,
                makeId: () => randomUUID()
            }
        );

        if (repair && dataAudit.changed) {
            await this.dataStore.save(
                dataAudit.repairedData
            );
            await this.projectWizard.load();

        this.workspaceState = new HubWorkspaceState(this);
        await this.workspaceState.initialize();
        window.hubGetFolderUiState = id => this.workspaceState.folders(id);
        window.hubSaveFolderUiState = (id, folders) => this.workspaceState.saveFolders(id, folders);
        }

        const uiAudit =
            this.auditLocalUiState(repair);

        return {
            conflicts,
            issues: [
                ...fileAudit.issues,
                ...dataAudit.issues,
                ...uiAudit.issues
            ],
            repaired: repair
        };
    }


    async openHubDataAudit() {
        try {
            const report =
                await this.runHubDataAudit(false);

            new HubDataAuditModal(
                this.app,
                report,
                async () => {
                    await this.runHubDataAudit(true);
                    const verified =
                        await this.runHubDataAudit(false);

                    await this.refreshHubConflictWarning();

                    return {
                        ...verified,
                        repaired: true
                    };
                }
            ).open();
        } catch (error) {
            console.error(
                "Could not audit Hub data:",
                error
            );
            new Notice(
                error.message ||
                "Could not audit Hub data."
            );
        }
    }


    async refreshHubConflictWarning(
        notify = false
    ) {
        const conflicts =
            await this.dataStore.findConflictFiles();
        const signature = conflicts
            .map(file =>
                `${file.name}:${file.modifiedAt}`
            )
            .join("|");

        if (!conflicts.length) {
            this.hubConflictStatusEl?.remove();
            this.hubConflictStatusEl = null;
            this.hubConflictSignature = "";
            return [];
        }

        if (!this.hubConflictStatusEl) {
            this.hubConflictStatusEl =
                this.addStatusBarItem();
            this.hubConflictStatusEl
                .addClass("hub-data-conflict-status");
            this.hubConflictStatusEl
                .addEventListener(
                    "click",
                    () => this.openHubDataAudit()
                );
        }

        this.hubConflictStatusEl.empty();
        const icon =
            this.hubConflictStatusEl.createSpan();
        setIcon(icon, "triangle-alert");
        this.hubConflictStatusEl.createSpan({
            text: `Hub conflicts: ${conflicts.length}`
        });
        this.hubConflictStatusEl.setAttribute(
            "aria-label",
            "OneDrive Hub data conflicts found. Click to audit."
        );

        if (
            notify ||
            signature !== this.hubConflictSignature
        ) {
            new Notice(
                `${conflicts.length} conflicting Hub data file${conflicts.length === 1 ? " was" : "s were"} found. Run “Audit Hub data” to review them.`,
                12000
            );
        }

        this.hubConflictSignature = signature;
        return conflicts;
    }


    async onload() {

        this.register(installWindowMinimum(window));

        const focusDocuments = new Set();
        const trackDocumentFocus = doc => {
            if (!doc || focusDocuments.has(doc)) return;
            focusDocuments.add(doc);
            this.register(trackTextFieldFocus(doc));
        };
        trackDocumentFocus(document);
        this.app.workspace.iterateAllLeaves(leaf => trackDocumentFocus(leaf.containerEl?.ownerDocument));
        this.registerEvent(this.app.workspace.on("window-open", (_workspaceWindow, win) => trackDocumentFocus(win.document)));

        this.atlas = installAtlasIntegration(this);

        this.dataStore =
            new HubDataStore(this);

        this.transitions =
            new HubTransitionService();

        this.projectWizard =
            new ProjectWizardService(this);

        this.projectDeletion = new ProjectDeletionGuard(this.app, async (name, targetPath) => {
            const modal = new ProjectDeletionModal(this.app, name, targetPath);
            this.projectDeletionModal = modal;
            try { return await modal.waitForConfirmation(); }
            finally { if (this.projectDeletionModal === modal) this.projectDeletionModal = null; }
        });

        await this.projectWizard.load();

        this.workspaceState = new HubWorkspaceState(this);
        await this.workspaceState.initialize();
        window.hubGetFolderUiState = id => this.workspaceState.folders(id);
        window.hubSaveFolderUiState = (id, folders) => this.workspaceState.saveFolders(id, folders);


        if (this.dataStore.loadWarning) {
            new Notice(
                "The Hub loaded, but its state metadata could not be saved. Reload Obsidian before making Hub changes.",
                12000
            );
        }

        await this.projectWizard
            .ensureCategoryShortcuts();

        await this.projectWizard
            .ensureProjectIds();

        try {
            await this.projectWizard
                .ensureResources();
        } catch (error) {
            /*
             * Resource folders can be created by OneDrive or another
             * process just before Obsidian refreshes its vault cache.
             * That race must not disable the rest of the Hub plugin.
             */
            console.error(
                "Could not initialize Hub Resources:",
                error
            );
        }

        this.workspaceModes =
            new HubWorkspaceModeService(
                this
            );
        this.presets = new HubPresets(this.workspaceModes);

        this.addCommand({
            id:
                "create-hub-backup",

            name:
                "Create Hub backup",

            callback:
                async () => {

                    try {

                        const path =
                            await this
                                .createHubBackup();


                        new Notice(
                            `Hub backup created: ${path}`
                        );

                    } catch (error) {

                        console.error(
                            "Could not create Hub backup:",
                            error
                        );


                        new Notice(
                            error.message ||
                            "Could not create Hub backup."
                        );
                    }
                }
        });


        this.addCommand({
            id:
                "restore-hub-backup",

            name:
                "Restore Hub backup",

            callback:
                () => {

                    this.openHubBackupRestore();
                }
        });


        this.addCommand({
            id:
                "audit-hub-data",

            name:
                "Audit Hub data",

            callback:
                () => {
                    this.openHubDataAudit();
                }
        });

        this.activityEditTimers =
            new Map();
        
        this.activityIgnoredRoots =
            new Set();

        this.changedProjectDate =
            localISODate();


        const restoredDirtyContexts =
            await this.projectWizard
                .ensureDirtyContexts(
                    this.changedProjectDate
                );


        this.changedProjectIds =
            new Set(
                restoredDirtyContexts.projects
            );

        this.changedResourceIds =
            new Set(
                restoredDirtyContexts.resources
            );

        this.hubAllowWindowClose =
            false;

        this.hubAdvancementPromptOpen =
            false;

        this.registerDomEvent(
            document,
            "click",
            event => {

                const closeButton =
                    event.target.closest?.(
                        ".titlebar-button.mod-close"
                    );


                if (!closeButton) {
                    return;
                }


                /*
                * This is the synthetic click
                * after the questionnaire has
                * already been answered.
                */
                if (
                    this.hubAllowWindowClose
                ) {
                    return;
                }


                /*
                * Crucial:
                *
                * stop the click BEFORE
                * Obsidian receives it.
                *
                * Therefore Obsidian never
                * begins its quit procedure.
                */
                event.preventDefault();

                event.stopImmediatePropagation();


                this.openProjectAdvancementPrompt(
                    closeButton
                );
            },
            true
        );
        
        this.hubAllowUnload = false;
        this.hubAdvancementPromptOpen = false;

        window.hubShowProjectCoverMenu =
            (
                event,
                path,
                dashboard
            ) => {

                this.showProjectCoverMenu(
                    event,
                    path,
                    dashboard
                );
            };


        window.hubEnterDashboard =
            root => {

                this.transitions.enter(root)
                    .catch(error => {

                        root?.classList.remove(
                            "is-hub-cover-pending"
                        );


                        console.error(
                            "Could not animate Hub dashboard:",
                            error
                        );
                    });
            };


        window.hubNavigateDashboard =
            (
                root,
                navigate
            ) =>
                this.transitions.navigate(
                    root,
                    navigate
                );


        window.hubOpenHome =
            source =>
                this.workspaceModes
                    .openHome(source);

        window.hubOpenWorkspace = source => this.workspaceModes.openWorkspace(source);
        window.hubShowPresets = anchor => {
            this.presetMenu?.close();
            return this.presetMenu = showPresetsMenu(anchor, this.presets);
        };
        window.hubGetFolderPresetState = id => this.presets.folderRestore(id);
        window.hubHasWorkspace = () => Boolean(this.workspaceModes.lastWorkspace());


        window.hubOpenLastProject =
            source =>
                this.workspaceModes
                    .openLastProject(
                        source
                    );

        window.hubOpenLastResource =
            source =>
                this.workspaceModes
                    .openLastResource(source);

        window.hubOpenResourceFull =
            (resource, source = null) =>
                this.workspaceModes
                    .openProjectFull(resource, source);


        window.hubOpenLastFile =
            root =>
                this.workspaceModes
                    .openLastFile(root);


        window.hubOpenProjectFull =
            (
                project,
                source = null
            ) =>
                this.workspaceModes
                    .openProjectFull(
                        project,
                        source
                    );


        window.hubOpenProjectNote =
            (
                path,
                placement = "replace",
                source = null
            ) =>
                this.workspaceModes
                    .openProjectNote(
                        path,
                        placement,
                        source
                    );


        window.hubOpenFile =
            (
                path,
                source = null
            ) =>
                this.workspaceModes
                    .openPath(
                        path,
                        source
                    );


        window.hubRememberProject =
            project =>
                this.workspaceModes
                    .rememberProject(
                        project
                    );

        window.hubRememberResource =
            resource =>
                this.workspaceModes
                    .rememberResource(resource);


        window.hubIsProjectNoteMode =
            project =>
                this.workspaceModes
                    .isProjectNoteMode(
                        project
                    );


        window.hubHasLastProject =
            () =>
                this.workspaceModes
                    .hasLastProject();

        window.hubHasLastResource =
            () =>
                this.workspaceModes
                    .hasLastResource();


        window.hubHasLastFile =
            source =>
                this.workspaceModes
                    .hasLastFile(source);


        window.hubGetLastNavigation =
            source =>
                this.workspaceModes
                    .lastNavigationInfo(source);

        window.hubStartFileDrag = (event, paths, source) =>
            this.workspaceModes.startNativeFileDrag(event, paths, source);

        window.hubGetAppShortcuts =
            () =>
                APP_SHORTCUTS.map(
                    shortcut => ({
                        id:
                            shortcut.id,

                        label:
                            shortcut.label,

                        type:
                            shortcut.type,

                        icon:
                            shortcut.icon
                    })
                );


        window.hubOpenAppShortcut =
            async id => {

                try {

                    await this.openAppShortcut(
                        id
                    );

                } catch (error) {

                    console.error(
                        "Could not open app shortcut:",
                        error
                    );


                    new Notice(
                        error.message ||
                        "Could not open shortcut."
                    );
                }
            };

        window.hubOpenProjectWizard =
            (
                dashboard,
                projectStatus
            ) => {
                this.projectWizard.open(
                    dashboard,
                    projectStatus
                );
            };

        window.hubGetProjectCategories =
            () =>
                this.projectWizard
                    .getPublicCategories();

        window.hubGetResourceTypes =
            () => this.projectWizard.getResourceTypes();

        window.hubGetResourceFolders =
            ids => this.projectWizard.getResourceFolders(ids);

        window.hubGetProjectResourceFolders =
            projectId => {
                const project = this.projectWizard.getProjectById(projectId);
                return this.projectWizard.getResourceFolders(
                    project?.resourceFolderIds ?? []
                );
            };

        window.hubDetachResourceFolder =
            async (projectPath, folderId) => {
                const file = this.app.vault.getAbstractFileByPath(projectPath);
                if (!(file instanceof TFile)) return false;
                const project = this.projectWizard.getProjectForPath(projectPath);
                if (!project) return false;
                await this.projectWizard.setProjectResourceFolders(
                    file,
                    project.resourceFolderIds.filter(id => id !== folderId)
                );
                this.notifyProjectFilesChanged(projectPath);
                return true;
            };

        window.hubGetProjectCardOrder =
            () =>
                this.projectWizard
                    .getProjectCardOrder();

        window.hubSetProjectCardOrder =
            (
                status,
                projectIds
            ) =>
                this.projectWizard
                    .setProjectCardOrder(
                        status,
                        projectIds
                    );

        window.hubGetWorkProgress =
            scope =>
                this.projectWizard
                    .getHomeMomentumProgress(scope);

        window.hubGetProjectProgress =
            projectId => {
                const resource =
                    projectId && typeof projectId === "object" && projectId.kind === "resource"
                        ? this.projectWizard.getResourceById(projectId.id)
                        : typeof projectId === "string" && projectId.startsWith("resource:")
                            ? this.projectWizard.getResourceById(projectId)
                            : null;

                const normalizedProjectId =
                    projectId && typeof projectId === "object" && projectId.kind === "project"
                        ? projectId.id ?? null
                        : projectId;

                return ({

                ratings:
                    resource
                        ? this.projectWizard.getResourceWorkRatings(resource.resourceType)
                        : this.projectWizard.getProjectWorkRatings(normalizedProjectId),

                levels:
                    PROJECT_ADVANCEMENT_OPTIONS
                        .map(
                            option => ({
                                score:
                                    option.score,

                                label:
                                    option.title
                            })
                        )
                });
            };


        window.hubGetProgressReports =
            projectId =>
                this.projectWizard
                    .getProgressReports(
                        projectId
                    );


        window.hubGetDailyFocus =
            date =>
                this.projectWizard
                    .getDailyFocus(date);


        window.hubActivatePendingFocus =
            async date => {

                const activated =
                    await this.projectWizard
                        .activatePendingFocus(
                            date
                        );


                if (activated) {
                    this.notifyFocusChanged(
                        date
                    );
                }


                return activated;
            };


        window.hubEnableProgressCalendarEditing =
            (
                calendar,
                options
            ) => {

                this.enableProgressCalendarEditing(
                    calendar,
                    options
                );
            };


        window.hubOpenProgressEditor =
            (
                date,
                projectId = null
            ) => {

                this.openProgressEditor(
                    date,
                    projectId
                );
            };


        window.hubOpenDailyFocusEditor =
            date => {
                this.openDailyFocusEditor(
                    date
                );
            };

        window.hubGetChangedProjectsToday =
            () =>
                this.getChangedProjects()
                    .map(
                        project => ({
                            projectId:
                                project.projectId,

                            name:
                                project.name,

                            path:
                                project.path,

                            root:
                                project.root,

                            status:
                                project.status
                        })
                    );

        window.hubGetActivityLog =
        () =>
            this.projectWizard
                .getActivityLog();

        window.hubGetCompletedTaskHistory =
        projectId =>
            this.projectWizard
                .getCompletedTaskHistory(
                    projectId
                );


        window.hubOpenStatistics = () => {
            if (this.statisticsModal) return;
            this.statisticsModal = new StatisticsModal(this.app, this, {
                onClose: () => { this.statisticsModal = null; },
                completionFeed: this.nativeTaskHost?.completionFeed
            });
            this.statisticsModal.open();
        };
        window.hubSetIcon = require("./lib/ui/icons").setHubIcon;
        this.homeCovers = new HomeCovers(this);
        window.hubGetHomeTimePeriod = homeTimePeriod;
        window.hubGetHomeCover = name => this.homeCovers.config(name);
        window.hubMountHomeCover = (cover, image, component, period) => this.homeCovers.mount(cover, image, component, period,
            source => {
                this.homeCoverModal?.close();
                this.homeCoverModal = openHomeCoverEditor(this.homeCovers, source);
            });
        window.hubFileIcon = fileIcon;
        const imagePlacementStorage = key => ({
            initial: this.projectWizard.data.headerImagePlacements?.[key],
            save: async placement => {
                const data = this.projectWizard.data;
                data.headerImagePlacements = { ...data.headerImagePlacements, [key]: placement };
                await this.dataStore.save(data);
            }
        });
        this.cardImageCache = createCardImageCache();
        const invalidateCardImage = (file, oldPath) => {
            this.cardImageCache.invalidate(file.path);
            if (oldPath) this.cardImageCache.invalidate(oldPath);
        };
        for (const event of ['modify', 'delete', 'rename']) {
            this.registerEvent(this.app.vault.on(event, invalidateCardImage));
        }
        window.hubCreateCardImageRenderer = (root, component) =>
            createCardImageRenderer(root, component, imagePlacementStorage, this.cardImageCache);
        window.hubWatchTooltips = watchHubTooltips;
        this.headerImageEditors = new WeakMap();
        window.hubMountHeaderImage = (cover, image, component, context, imagePath, options = {}) => {
            this.headerImageEditors.get(cover)?.dispose();
            const key = `${context}::${imagePath}`;
            const editor = mountHeaderImage({ cover, image, component, ...options,
                ...imagePlacementStorage(key)
            });
            this.headerImageEditors.set(cover, editor);
        };

        window.hubCreateDashboardUi =
            createDashboardUi;

        window.hubMountWorkspaceExplorer = require("./lib/ui/workspace-explorer").mountWorkspaceExplorer;

        window.hubCreateFileDomain =
            createFileDomain;

        window.hubToggleTask = (
            path,
            line,
            text,
            completed,
            hubTaskId
        ) => this.toggleTask(
            path,
            line,
            text,
            completed,
            hubTaskId
        );
        window.hubApplyTaskEdit = applyTaskEdit;
        this.taskEditor = new HubTaskEditor(this);
        const oathNativeModule = this.app.vault.adapter.getBasePath?.();
        let strictOath = null;
        if (oathNativeModule && window.electron?.remote && window.electronWindow) {
            try {
                // Default-disabled main-process coordinator; reuse ownership on plugin reload.
                strictOath = window.electron.remote.require(require("path").join(oathNativeModule,
                    this.manifest.dir, "lib/services/oath-strict-host.js")).getStrictCoordinator(window.electronWindow);
            } catch (error) { console.error("Strict Oath host unavailable; ordinary Oaths remain available", error); }
        }
        this.oath = new HubOathService(this, createOathFullscreen(window, oathNativeModule ?
            require("path").join(oathNativeModule, this.manifest.dir, "lib/services/oath-fullscreen.js") : null), strictOath ? { strict: strictOath } : {});
        this.oathNavigation = new OathNavigationGuard(this, require("obsidian").WorkspaceLeaf);
        window.hubCreateWorkspaceCards = (root, component, renderImage, categories) =>
            createWorkspaceCards({ app: this.app, root, component, renderImage, categories, oath: this.oath });
        window.hubCreateTaskRow = require("./lib/ui/tasks").createTaskRow;
        window.hubTaskGroups = taskGroups;
        window.hubTaskOwner = path => this.projectWizard.getContextForPath(path);
        window.hubCreateTaskUi = (component, body, onEdit, actions = {}) => createTaskUi({
            app: this.app, component, body, onEdit, oath: this.oath, phaseLabel: task => this.planning?.phaseFor(task)?.name, mutate: actions.mutate ?? (request => this.mutateTask(request)),
            editTask: actions.editTask ?? ((task, saved) => openTaskEditor(this.taskEditor, task, saved)),
            createTask: options => this.openTaskCreator(options)
        });
        window.hubCreateMarkdown = component => createHubMarkdown({ app: this.app, component });
        this.taskData = new HubTaskDataService(this.app, { metadata: id => this.taskEditor.metadata(id) });
        window.hubTaskData = this.taskData;
        this.planning = new (require("./lib/services/project-planning").ProjectPlanningService)(this);
        window.hubMountFullViewLayout = (root, component) => require("./lib/ui/full-view-layout").mountFullViewLayout({ root, component, app: this.app });
        this.taskService = require("./lib/services/task-service-host").createLegacyTaskService(this);
        this.contextSearch = new (require("./lib/services/context-search").ContextSearchService)(this);
        try { this.athena = require("./lib/athena/runtime.cjs").installAthena(this, {
            openSettings: () => require("./lib/ui/settings").getSettingsOwner(this).open("athena")
        }); }
        catch (_) { new Notice("Athena could not initialize. Other Hub features remain available."); }
        window.hubMountContextSearch = options => require("./lib/ui/context-search").mountContextSearch({ service: this.contextSearch, ...options });
        window.hubRegisterSearchWorkspace = (...args) => this.contextSearch.registerWorkspace(...args);
        window.hubApplySearchFolder = root => this.contextSearch.applyFolder(root);
        this.dailyBrief = new DailyBriefService(this);
        this.inbox = new HubInboxService(this);
        this.nativeTaskHost = require("./lib/services/native-task-host").createNativeTaskHost(this);
        if (this.nativeTaskHost) {
            this.nativeTaskHost.guardUnsupported();
            await this.nativeTaskHost.ready;
            this.addCommand({ id: "native-task-recovery", name: "Native task recovery",
                callback: () => { this.nativeTaskRecoveryModal?.close(); this.nativeTaskRecoveryModal = require("./lib/ui/native-task-recovery").openNativeTaskRecovery(this); } });
        }
        window.hubMountTaskWorkspace = options => require("./lib/ui/task-workspace").mountTaskWorkspace({ plugin: this, ...options, nativeTasks: this.nativeTaskHost?.nativeTasks });
        window.hubCreateTaskPanelRead = options => require("./lib/services/task-panel-read").createTaskPanelRead({
            plugin: this, ...options, nativeTasks: this.nativeTaskHost?.nativeTasks, editTask: (task, saved) => openTaskEditor(this.taskEditor, task, saved)
        });
        window.hubCreateHomeTaskRead = options => require("./lib/services/home-task-read").createHomeTaskRead({
            plugin: this, ...options, nativeTasks: this.nativeTaskHost?.nativeTasks, editTask: (task, saved) => openTaskEditor(this.taskEditor, task, saved)
        });
        window.hubCreateTaskHistoryRead = options => require("./lib/services/task-history-read").createTaskHistoryRead({ plugin: this, ...options, completionFeed: this.nativeTaskHost?.completionFeed });
        this.spotifyConnect = new (require("./lib/services/spotify-connect").SpotifyConnectBackend)(this);
        await this.spotifyConnect.restore();
        this.musicLibrary = new (require("./lib/services/music-library").MusicLibrary)(this);
        this.music = new (require("./lib/services/music-controller").MusicController)(this, this.musicLibrary);
        this.app.workspace.onLayoutReady(() => {
            if (this.oath.disposed) return;
            this.oathControl = mountOathControl(this, this.oath);
            this.captureControls = mountCaptureControls(this, this.inbox, this.oathControl.item);
            this.musicControl = mountMusicControl(this, this.oathControl.item);
            this.settingsControl = mountSettingsControl(this, this.oathControl.item);
            if (ITACAN_DEVELOPMENT) this.dailyBriefControl = mountDailyBriefControl(this, this.dailyBrief, this.oathControl.item);
            this.appShortcutsControl = require("./lib/ui/app-shortcuts").mountAppShortcuts(this, this.oathControl.item);
            void this.oath.start().then(() => { if (ITACAN_DEVELOPMENT) this.dailyBrief.start(); }).catch(error => this.oath.error(error));
        });
        this.addCommand({ id: "quick-add", name: "Quick Add", hotkeys: [{ modifiers: ["Mod", "Shift"], key: " " }],
            callback: () => this.captureControls?.openQuickAdd() });
        this.addCommand({ id: "inbox", name: "Inbox", callback: () => this.captureControls?.openInbox() });
        if (ITACAN_DEVELOPMENT) this.addCommand({ id: "daily-brief", name: "Daily brief (development)", callback: () => this.dailyBrief.openManual() });
        this.addCommand({ id: "the-oath", name: "The Oath", callback: () => this.oathControl?.open() });
        this.addCommand({ id: "insert-markdown-task", name: "Insert task at cursor", editorCallback: (editor, view) => { this.nativeTaskHost?.rejectLegacy(view?.file?.path ?? this.app.workspace.getActiveFile()?.path); return insertTaskAtCursor(editor, view); } });
        this.addCommand({ id: "add-hub-task", name: "Add task", callback: () => this.openTaskCreator() });

        window.hubClearCompletedTasks = (
            tasks,
            confirmMany = false
        ) => this.clearCompletedTasks(
            tasks,
            confirmMany
        );

        window.hubShowProjectFileMenu =
            (
                event,
                path,
                actions = {}
            ) => {

                this.showProjectFileMenu(
                    event,
                    path,
                    actions
                );
            };
        
        window.hubShowProjectFolderMenu =
            (
                event,
                actions
            ) => {

                this.showProjectFolderMenu(
                    event,
                    actions
                );
            };

        window.hubShowProjectSelectionMenu =
            (
                event,
                actions
            ) => {

                this.showProjectSelectionMenu(
                    event,
                    actions
                );
            };

        this.registerDomEvent(
            document,
            "contextmenu",
            event => {

                const card =
                    event.target.closest?.(".home-project-card");

                if (!card) return;

                const path = card.dataset.projectPath;
                if (!path) return;

                const file =
                    this.app.vault.getAbstractFileByPath(path);

                if (!file) return;

                event.preventDefault();
                event.stopPropagation();

                const dashboard =
                    card.closest(".home-dashboard");

                if (!dashboard) return;

                this.showProjectMenu(
                    event,
                    file,
                    card.dataset.projectStatus,
                    dashboard,
                    card
                );
            }
        );
        
        this.preparedNoteRails = createPreparedNoteRails(this);
        this.app.workspace.onLayoutReady(
            () => {
                this.workspaceModes.start();
                this.registerActivityTracking();
            }
        );


        this.refreshHubConflictWarning()
            .catch(error => {
                console.error(
                    "Could not inspect Hub conflict files:",
                    error
                );
            });


        this.registerInterval(
            window.setInterval(
                () => {
                    this.refreshHubConflictWarning()
                        .catch(error => {
                            console.error(
                                "Could not refresh Hub conflict warning:",
                                error
                            );
                        });
                },
                60000
            )
        );
    }
    onunload() {
        this.nativeTaskRecoveryModal?.close();
        this.nativeTaskStopping = this.nativeTaskHost?.close();
        this.nativeTaskStopping?.catch(error => console.error("Native task shutdown failed", error));
        this.athena?.destroy();
        this.atlas?.destroy();
        disposeCompletionAudio();
        this.statisticsModal?.close();
        delete window.hubOpenStatistics;

        this.appShortcutsControl?.destroy();
        this.captureControls?.destroy();
        this.inbox?.destroy();
        delete window.hubMountFullViewLayout;
        delete window.hubMountTaskWorkspace;
        delete window.hubMountContextSearch;
        delete window.hubRegisterSearchWorkspace;
        delete window.hubApplySearchFolder;
        this.musicControl?.destroy();
        const spotifyStopping = this.music?.destroy();
        Promise.resolve(spotifyStopping).catch(() => {}).finally(() => {
            this.spotifyConnect?.destroy(); this.musicLibrary?.destroy();
        });
        this.settingsControl?.destroy();
        this.dailyBriefControl?.destroy();
        this.dailyBrief?.destroy();
        this.preparedNoteRails?.destroy();
        this.cardImageCache?.destroy();
        this.transitions?.destroy();
        this.workspaceModes?.destroy();
        this.presetMenu?.destroy();
        delete window.hubShowPresets;
        delete window.hubGetFolderPresetState;
        delete window.hubGetFolderUiState;
        delete window.hubSaveFolderUiState;
        this.oathControl?.destroy();
        this.oath?.destroy();
        this.oathNavigation?.destroy();
        delete window.hubCreateWorkspaceCards;
        delete window.hubCreateTaskRow;
        this.taskData?.destroy();
        this.projectDeletion?.destroy();
        this.projectDeletionModal?.close();
        delete window.hubTaskData;

        for (
            const timer
            of this.activityEditTimers
                ?.values()
                ?? []
        ) {
            clearTimeout(timer);
        }

        delete window.hubGetActivityLog;
        delete window.hubGetCompletedTaskHistory;
        delete window.hubSetIcon;
        delete window.hubFileIcon;
        delete window.hubCreateCardImageRenderer;
        delete window.hubWatchTooltips;
        delete window.hubMountHeaderImage;
        delete window.hubCreateDashboardUi;
        this.homeCoverModal?.close();
        this.homeCovers?.destroy();
        delete window.hubGetHomeTimePeriod;
        delete window.hubGetHomeCover;
        delete window.hubMountHomeCover;
        delete window.hubMountWorkspaceExplorer;
        delete window.hubCreateFileDomain;
        delete window.hubToggleTask;
        delete window.hubApplyTaskEdit;
        delete window.hubCreateTaskUi;
        delete window.hubCreateTaskPanelRead;
        delete window.hubCreateHomeTaskRead;
        delete window.hubCreateTaskHistoryRead;
        delete window.hubTaskGroups;
        delete window.hubTaskOwner;
        delete window.hubCreateMarkdown;
        delete window.hubClearCompletedTasks;
        delete window.hubOpenProjectWizard;
        delete window.hubGetProjectCategories;
        delete window.hubGetResourceTypes;
        delete window.hubGetResourceFolders;
        delete window.hubGetProjectResourceFolders;
        delete window.hubDetachResourceFolder;
        delete window.hubGetProjectCardOrder;
        delete window.hubSetProjectCardOrder;
        delete window.hubGetWorkProgress;
        delete window.hubGetAppShortcuts;
        delete window.hubOpenAppShortcut;
        delete window.hubShowProjectFileMenu;
        delete window.hubShowProjectFolderMenu;
        delete window.hubGetProjectProgress;
        delete window.hubGetProgressReports;
        delete window.hubGetDailyFocus;
        delete window.hubActivatePendingFocus;
        delete window.hubEnableProgressCalendarEditing;
        delete window.hubOpenProgressEditor;
        delete window.hubOpenDailyFocusEditor;
        delete window.hubShowProjectSelectionMenu;
        delete window.hubGetChangedProjectsToday;
        delete window.hubShowProjectCoverMenu;
        delete window.hubEnterDashboard;
        delete window.hubNavigateDashboard;
        delete window.hubOpenWorkspace;
        delete window.hubHasWorkspace;
        delete window.hubOpenHome;
        delete window.hubOpenLastProject;
        delete window.hubOpenLastResource;
        delete window.hubOpenResourceFull;
        delete window.hubOpenLastFile;
        delete window.hubOpenProjectFull;
        delete window.hubOpenProjectNote;
        delete window.hubOpenFile;
        delete window.hubRememberProject;
        delete window.hubRememberResource;
        delete window.hubIsProjectNoteMode;
        delete window.hubHasLastProject;
        delete window.hubHasLastResource;
        delete window.hubHasLastFile;
        delete window.hubGetLastNavigation;
        delete window.hubStartFileDrag;
    }

    ensureChangedProjectDate() {

        const today =
            localISODate();


        if (
            this.changedProjectDate ===
            today
        ) {
            return;
        }


        this.changedProjectDate =
            today;


        this.changedProjectIds
            .clear();

        this.changedResourceIds
            .clear();


        this.projectWizard
            .ensureDirtyContexts(today)
            .then(restored => {
                if (this.changedProjectDate !== today) {
                    return;
                }

                for (const projectId of restored.projects) {
                    this.changedProjectIds.add(projectId);
                }

                for (const resourceId of restored.resources) {
                    this.changedResourceIds.add(resourceId);
                }
            })
            .catch(error => {
                console.error(
                    "Could not restore today’s changed Hub contexts:",
                    error
                );
            });
    }


    isIgnoredProjectPath(
        path
    ) {

        const target =
            String(
                path ?? ""
            );


        for (
            const root
            of this.activityIgnoredRoots
        ) {

            if (
                target === root ||
                target.startsWith(
                    `${root}/`
                )
            ) {

                return true;
            }
        }


        return false;
    }


    markProjectChangedByPath(
        path
    ) {

        this.ensureChangedProjectDate();


        if (
            !path ||
            this.isIgnoredProjectPath(
                path
            )
        ) {
            return;
        }


        const context =
            this.projectWizard
                .getContextForPath(
                    path
                );


        if (!context) {
            return;
        }


        if (context.contextKind === "resource") {
            const isNew =
                !this.changedResourceIds.has(
                    context.resourceType
                );

            this.changedResourceIds.add(
                context.resourceType
            );

            if (isNew) {
                this.projectWizard
                    .markContextDirty(
                        this.changedProjectDate,
                        context
                    )
                    .catch(error => {
                        console.error(
                            "Could not persist changed Resource context:",
                            error
                        );
                    });
            }

            return;
        }

        const isNew =
            !this.changedProjectIds.has(
                context.projectId
            );

        this.changedProjectIds.add(
            context.projectId
        );

        if (isNew) {
            this.projectWizard
                .markContextDirty(
                    this.changedProjectDate,
                    context
                )
                .catch(error => {
                    console.error(
                        "Could not persist changed project context:",
                        error
                    );
                });
        }
    }


    getChangedProjects() {

        this.ensureChangedProjectDate();


        return [
            ...this.changedProjectIds
        ]
            .map(
                projectId =>
                    this.projectWizard
                        .getProjectById(
                            projectId
                        )
            )
            .filter(Boolean)
            .sort(
                (a, b) =>
                    a.name.localeCompare(
                        b.name,
                        undefined,
                        {
                            sensitivity:
                                "base"
                        }
                    )
            );
    }


    getChangedResources() {

        this.ensureChangedProjectDate();


        return [
            ...this.changedResourceIds
        ]
            .map(resourceId =>
                this.projectWizard
                    .getResourceById(
                        resourceId
                    )
            )
            .filter(Boolean)
            .sort(
                (a, b) =>
                    a.label.localeCompare(
                        b.label,
                        undefined,
                        {
                            sensitivity:
                                "base"
                        }
                    )
            );
    }


    finishWindowClose(
        closeButton
    ) {

        this.hubAllowWindowClose =
            true;


        try {

            closeButton.click();

        } finally {

            this.hubAllowWindowClose =
                false;
        }
    }

    registerActivityTracking() {

        /*
        * Activity tracking starts only after
        * Obsidian has finished initializing
        * the vault.
        */


        this.registerEvent(
            this.app.vault.on(
                "create",
                file => {
                    
                    this.markProjectChangedByPath(
                        file?.path
                    );

                    if (
                        file instanceof TFolder
                    ) {

                        this.projectWizard.syncResourceFolders()
                            .catch(error => console.error("Could not update Resource folders:", error));

                        this.notifyProjectFilesChanged(
                            file.path
                        );

                        return;
                    }


                    if (!(file instanceof TFile)) {
                        return;
                    }


                    if (
                        !this.activityDetails(
                            file
                        )
                    ) {
                        return;
                    }


                    this.logActivity(
                        "created",
                        file
                    ).catch(error => {

                        console.error(
                            "Could not record create activity:",
                            error
                        );
                    });
                }
            )
        );


        this.registerEvent(
            this.app.workspace.on(
                "editor-change",
                (
                    _editor,
                    info
                ) => {

                    const file =
                        info?.file;


                    if (!(file instanceof TFile)) {
                        return;
                    }

                    this.markProjectChangedByPath(
                        file.path
                    );

                    this.recordEditorActivity(file, _editor);
                }
            )
        );


        this.registerEvent(
            this.app.vault.on(
                "delete",
                file => {

                    this.markProjectChangedByPath(
                        file?.path
                    );

                    if (
                        file instanceof TFolder
                    ) {

                        this.projectWizard.syncResourceFolders()
                            .catch(error => console.error("Could not update Resource folders:", error));

                        this.notifyProjectFilesChanged(
                            file.path
                        );

                        return;
                    }


                    if (!(file instanceof TFile)) {
                        return;
                    }


                    const timer =
                        this.activityEditTimers
                            .get(file.path);


                    if (timer) {

                        clearTimeout(
                            timer
                        );

                        this.activityEditTimers
                            .delete(
                                file.path
                            );
                    }


                    this.logActivity(
                        "deleted",
                        file
                    ).catch(error => {

                        console.error(
                            "Could not record delete activity:",
                            error
                        );
                    });
                }
            )
        );


        this.registerEvent(
            this.app.vault.on(
                "rename",
                async (
                    file,
                    oldPath
                ) => {

                    this.markProjectChangedByPath(
                        oldPath
                    );


                    this.markProjectChangedByPath(
                        file?.path
                    );

                    if (
                        file instanceof TFolder
                    ) {

                        await this.projectWizard
                            .handleResourceFolderRename(file, oldPath);

                        this.notifyProjectFilesChanged(
                            file.path,
                            oldPath
                        );

                        return;
                    }


                    if (!(file instanceof TFile)) {
                        return;
                    }

                    const oldTitle =
                        projectFileTitleFromPath(
                            oldPath
                        );


                    const newTitle =
                        projectFileTitle(
                            file
                        );


                    /*
                    * A pure move is not a rename.
                    *
                    * Still refresh open project
                    * dashboards because the file
                    * changed location.
                    */
                    if (
                        oldTitle ===
                        newTitle
                    ) {

                        this.notifyProjectFilesChanged(
                            file.path,
                            oldPath
                        );

                        return;
                    }


                    const oldTimer =
                        this.activityEditTimers
                            .get(oldPath);


                    if (oldTimer) {

                        clearTimeout(
                            oldTimer
                        );

                        this.activityEditTimers
                            .delete(
                                oldPath
                            );


                        /*
                        * An edit happened before this rename,
                        * but its debounce had not finished.
                        * Record it now so it correctly breaks
                        * the Created → Renamed adjacency.
                        */
                        await this.logActivity(
                            "edited",
                            file,
                            {
                                path:
                                    oldPath,

                                title:
                                    oldTitle,

                                project:
                                    oldPath
                                        .split("/")[1]
                            }
                        );
                    }


                    try {

                        await this.logActivity(
                            "renamed",
                            file,
                            {
                                oldTitle,
                                oldPath
                            }
                        );

                    } catch (error) {

                        console.error(
                            "Could not record rename activity:",
                            error
                        );
                    }
                }
            )
        );
    }

    notifyProjectFilesChanged(
        path,
        oldPath = null
    ) {

        const currentPath =
            String(
                path ?? ""
            );


        const previousPath =
            String(
                oldPath ?? ""
            );


        if (
            !currentPath.startsWith("Projects/") &&
            !previousPath.startsWith("Projects/") &&
            !currentPath.startsWith(`${RESOURCE_ROOT}/`) &&
            !previousPath.startsWith(`${RESOURCE_ROOT}/`)
        ) {
            return;
        }


        document
            .querySelectorAll(
                ".project-dashboard"
            )
            .forEach(
                dashboard => {

                    dashboard.dispatchEvent(
                        new CustomEvent(
                            "hub-project-files-changed",
                            {
                                detail: {
                                    path:
                                        currentPath,

                                    oldPath:
                                        previousPath ||
                                        null
                                }
                            }
                        )
                    );
                }
            );
    }

    activityDetails(
        file
    ) {

        if (
            !(file instanceof TFile)
        ) {
            return null;
        }


        for (
            const root
            of this.activityIgnoredRoots
        ) {

            if (
                file.path === root ||
                file.path.startsWith(
                    `${root}/`
                )
            ) {
                return null;
            }
        }


        const project =
            this.projectWizard
                .getContextForPath(
                    file.path
                );


        if (!project) {
            return null;
        }


        /*
        * Project hubs have their own
        * lifecycle activity.
        */
        const frontmatter =
            this.app.metadataCache
                .getFileCache(file)
                ?.frontmatter;


        if (
            frontmatter?.type === "project" ||
            frontmatter?.type === "resource"
        ) {
            return null;
        }


        return {
            path:
                file.path,

            title:
                projectFileTitle(
                    file
                ),

            project:
                project.name,

            projectId:
                project.projectId,

            contextKind:
                project.contextKind ?? "project",

            resourceType:
                project.resourceType ?? null
        };
    }

    notifyActivityChanged() {

        document
            .querySelectorAll(
                ".home-dashboard, .project-dashboard"
            )
            .forEach(dashboard => {

                dashboard.dispatchEvent(
                    new CustomEvent(
                        "hub-activity-changed"
                    )
                );
            });
    }


    async logProjectActivity(
        action,
        {
            path,
            oldPath = null,
            title,
            oldTitle = null,
            projectStatus,
            projectId = null
        }
    ) {

        const context = this.projectWizard.getContextForPath(path);
        projectId ??= context?.projectId ?? null;

        await this.projectWizard
            .recordActivity({
                action:
                    `project-${action}`,

                path,
                oldPath,
                title,
                oldTitle,
                projectStatus,
                projectId,
                project: title,
                contextKind: "project"
            });


        this.notifyActivityChanged();
    }

    async logActivity(
        action,
        file,
        extra = {}
    ) {

        const details =
            this.activityDetails(file);


        if (!details) {
            return;
        }


        await this.projectWizard
            .recordActivity({
                action,
                ...details,
                ...extra
            });


        /*
        * Refresh an open Home dashboard
        * immediately.
        */

        this.notifyActivityChanged();

        this.notifyProjectFilesChanged(
            extra.path ??
                file.path,

            extra.oldPath ??
                null
        );
    }


    recordEditorActivity(file, editor) {
        if (isTaskWrite(this, file, editor)) return;
        if (this.workspaceModes?.mode && this.app.workspace.getActiveFile() === file) this.workspaceModes.captureNoteLayout(true);
        this.scheduleEditedActivity(file);
    }

    scheduleEditedActivity(file) {

        const details =
            this.activityDetails(file);


        if (!details) {
            return;
        }


        /*
        * Each new modification resets the
        * timer. We therefore record one
        * "Edited" event after editing settles.
        */

        const existing =
            this.activityEditTimers
                .get(file.path);


        if (existing) {
            clearTimeout(existing);
        }


        const timer =
            setTimeout(
                () => {

                    this.activityEditTimers
                        .delete(
                            file.path
                        );


                    this.logActivity(
                        "edited",
                        file
                    ).catch(error => {

                        console.error(
                            "Could not record edit activity:",
                            error
                        );
                    });

                },
                3000
            );


        this.activityEditTimers.set(
            file.path,
            timer
        );
    }

    openProjectAdvancementPrompt(
        closeButton
    ) {

        if (
            this.hubAdvancementPromptOpen
        ) {
            return;
        }


        const projects =
            this.getChangedProjects();

        const resources =
            this.getChangedResources();


        const date =
            localISODate();


        if (
            projects.length === 0 &&
            resources.length === 0
        ) {
            this.finishWindowClose(
                closeButton
            );
            return;
        }


        this.hubAdvancementPromptOpen =
            true;


        const currentScores = {};
        const currentSummaries = {};


        for (
            const project
            of projects
        ) {

            const score =
                this.projectWizard
                    .getProjectWorkRatings(
                        project.projectId
                    )[date];


            if (
                Number.isInteger(score) &&
                score >= 1 &&
                score <= 4
            ) {

                currentScores[
                    project.projectId
                ] =
                    score;
            }


            currentSummaries[
                project.projectId
            ] =
                this.projectWizard
                    .getProjectWorkLogs(
                        project.projectId
                    )[date]?.summary ?? "";
        }


        for (const resource of resources) {
            const key =
                `resource:${resource.resourceType}`;

            const score =
                this.projectWizard
                    .getResourceWorkRatings(
                        resource.resourceType
                    )[date];

            if (
                Number.isInteger(score) &&
                score >= 1 &&
                score <= 4
            ) {
                currentScores[key] =
                    score;
            }

            currentSummaries[key] =
                this.projectWizard
                    .getResourceWorkLogs(
                        resource.resourceType
                    )[date]?.summary ?? "";
        }


        // Reuse the exit resolution marker and the existing activity query.
        // Manual saves do not clear dirty contexts; a dirty flag alone cannot
        // establish activity since a newer manual save or a legacy report.
        const savedReports = [...this.projectWizard.getProgressReports(),
            ...this.projectWizard.getProgressReports({ kind: "resource" })]
            .filter(report => report.date === date);
        const resolvedAt = this.projectWizard.normalizedDirtyContextRecord(date).resolvedAt;
        const lastSavedAt = Math.max(resolvedAt, ...savedReports.map(report => report.timestamp || 0));
        const activity = lastSavedAt > 0
            ? this.projectWizard.activityDirtyContexts(date, lastSavedAt) : null;
        const updatingReport = (resolvedAt > 0 && lastSavedAt === resolvedAt) ||
            projects.some(project => activity?.projects.includes(project.projectId)) ||
            resources.some(resource => activity?.resources.includes(resource.resourceType));
        const reportMode = updatingReport ? "update"
            : savedReports.length || resolvedAt > 0 ? "edit" : "complete";

        new ProjectAdvancementModal(
            this.app,
            {
                plugin: this,
                requireExplicitRatings: true,
                reportDate: date,
                reportMode,
                getReportContexts: () => Object.fromEntries([...projects, ...resources].map(workspace => {
                    const id = workspace.projectId ?? `resource:${workspace.resourceType}`;
                    const previous = id.startsWith("resource:")
                        ? this.projectWizard.resourceWorkLogs[id.slice(9)]?.[date]
                        : this.projectWizard.projectWorkLogs[id]?.[date];
                    return [id, savedReportContext(this.projectWizard, date, id, previous?.context)];
                })),
                projects,

                resources,

                currentScores,

                currentSummaries,

                allowNoProgress:
                    true,

                showNextFocus:
                    true,

                currentFocus:
                    this.projectWizard
                        .getPendingFocus(
                            date
                        )?.items ?? [],

                focusProjects:
                    this.projectWizard
                        .getFocusContexts(),

                title:
                    reportMode === "update" ? "Update progress report"
                        : reportMode === "edit" ? "Edit progress report" : "Complete progress report",

                onSave:
                    async ({
                        scores,
                        summaries,
                        focus
                    }) => {

                        await this
                            .projectWizard
                            .replaceCombinedProgress(
                                date,
                                projects.map(
                                    project =>
                                        project.projectId
                                ),
                                resources.map(
                                    resource =>
                                        resource.resourceType
                                ),
                                scores,
                                summaries,
                                {
                                    sourceDate:
                                        date,
                                    items:
                                        focus
                                }
                            );


                        await this
                            .projectWizard
                            .clearDirtyContexts(
                                date,
                                projects.map(
                                    project =>
                                        project.projectId
                                ),
                                resources.map(
                                    resource =>
                                        resource.resourceType
                                )
                            );
                    },

                onSaved:
                    () => {

                        this.hubAdvancementPromptOpen =
                            false;


                        /*
                        * Ratings are already saved.
                        * If closing somehow fails,
                        * don't ask for them again.
                        */
                        this.changedProjectIds
                            .clear();

                        this.changedResourceIds
                            .clear();


                        this.notifyProgressChanged(
                            date,
                            projects.map(
                                project =>
                                    project.projectId
                            ).concat(
                                resources.map(
                                    resource =>
                                        `resource:${resource.resourceType}`
                                )
                            )
                        );


                        this.finishWindowClose(
                            closeButton
                        );
                    },

                onCancel:
                    () => {

                        /*
                        * Closing the modal itself
                        * means "don't quit yet".
                        *
                        * The project set remains,
                        * so the form appears again
                        * on the next quit attempt.
                        */
                        this.hubAdvancementPromptOpen =
                            false;
                    }
            }
        ).open();
    }

    openTaskCreator(options = {}) {
        if (!this.nativeTaskHost) return openTaskCreator(this.taskEditor, options);
        const owner = options.location ? this.taskEditor.context(options.location) : this.taskEditor.currentContext();
        if (this.nativeTaskHost?.matches({ type: owner?.contextKind === "resource" ? "resource" : "project", id: owner?.projectId })) return this.nativeTaskHost.create(options);
        return openTaskCreator(this.taskEditor, options);
    }

    async toggleTask(path, lineNumber, taskText, completed, hubTaskId) {
        return this.mutateTask({ path, line: lineNumber, text: taskText, completed, hubTaskId });
    }

    enqueueTaskMutation(work) {
        const result = (this.taskMutationQueue ?? Promise.resolve()).then(work);
        this.taskMutationQueue = result.catch(() => {});
        return result;
    }

    mutateTask(request) {
        const actionTimestamp = Date.now();
        return this.enqueueTaskMutation(async () => {
            const path = this.taskData?.currentPath(request.path) ?? request.path;
            const file = this.app.vault.getAbstractFileByPath(path);
            if (!file) throw new Error(`Task file not found: ${path}`);
            const tasksApi = this.app.plugins.plugins["obsidian-tasks-plugin"]?.apiV1;
            let edit;
            await processTaskWrite(this, file, data => {
                const args = { ...request, path };
                const result = request.operation === "step" ? toggleTaskStep(data, args, randomUUID) : request.operation ? mutateTaskContent(data, args)
                    : editTaskContent(data, args, (line, taskPath) => tasksApi?.executeToggleTaskDoneCommand
                        ? tasksApi.executeToggleTaskDoneCommand(line, taskPath)
                        : line.replace(/^(\s*(?:[-*+]|\d+[.)])\s+\[)([^\]])(\])/, (_all, prefix, mark, end) => prefix + (/^[xX]$/.test(mark) ? " " : "x") + end));
                edit = result.edit;
                return result.content;
            });
            try {
                const context = this.projectWizard.getContextForPath(path);
                if (await this.projectWizard.recordTaskMutation(edit, context, actionTimestamp)) this.notifyCompletedTasksChanged();
            } catch (error) {
                console.error("Could not save task History:", error);
                new Notice("The task changed, but its History could not be saved.");
            }
            this.markProjectChangedByPath(path);
            this.oath?.changed(edit);
            return edit;
        });
    }


    clearCompletedTasks(taskRequests, confirmMany = false) {
        return this.enqueueTaskMutation(() => this.performClearCompletedTasks(taskRequests, confirmMany));
    }

    async performClearCompletedTasks(
        taskRequests,
        confirmMany = false
    ) {

        const requests =
            Array.isArray(taskRequests)
                ? taskRequests
                    .map(item => ({
                        hubTaskId: item?.hubTaskId ?? null,
                        path:
                            String(item?.path ?? ""),

                        line:
                            Number(item?.line),

                        text:
                            String(item?.text ?? ""),

                        projectId:
                            item?.projectId ?? null,

                        projectName:
                            String(
                                item?.projectName ?? ""
                            ),

                        projectStatus:
                            item?.projectStatus ?? null,

                        projectPath:
                            String(
                                item?.projectPath ?? ""
                            ),

                        projectRoot:
                            String(
                                item?.projectRoot ?? ""
                            ),

                        contextKind:
                            item?.contextKind ?? "project",

                        resourceType:
                            item?.resourceType ?? null
                    }))
                    .filter(
                        item =>
                            item.path &&
                            Number.isInteger(
                                item.line
                            ) &&
                            item.line >= 0 &&
                            item.text
                    )
                : [];


        if (requests.length === 0) {
            return {
                deleted: [],
                cancelled: false
            };
        }


        if (confirmMany) {

            const confirmed =
                await confirmAction(
                    this.app,
                    "Clear completed tasks?",
                    requests.length === 1
                        ? "Remove this completed task from its note? It will remain available in Tasks history."
                        : `Remove these ${requests.length} completed tasks from their notes? They will remain available in Tasks history.`
                );


            if (!confirmed) {
                return {
                    deleted: [],
                    cancelled: true
                };
            }
        }


        const requestsByPath =
            new Map();


        for (const request of requests) {

            if (
                !requestsByPath.has(
                    request.path
                )
            ) {
                requestsByPath.set(
                    request.path,
                    []
                );
            }


            requestsByPath.get(
                request.path
            ).push(request);
        }


        const deleted = [];
        const failures = [];


        for (
            const [path, pathRequests]
            of requestsByPath
        ) {

            const file =
                this.app.vault
                    .getAbstractFileByPath(
                        path
                    );


            if (!(file instanceof TFile)) {
                failures.push(path);
                continue;
            }


            try {

                const original =
                    await this.app.vault
                        .read(file);

                const lines =
                    original.split("\n");

                const usedLines =
                    new Set();


                const resolved =
                    pathRequests.map(
                        request => {

                            let index = request.hubTaskId
                                ? locateTaskLine(lines, request.line, request.text, request.hubTaskId)
                                : request.line;


                            if (
                                usedLines.has(index) ||
                                !isCompletedTaskLine(lines[index]) ||
                                !taskLineMatchesText(lines[index], request.text)
                            ) {

                                const matches = [];


                                for (
                                    let i = 0;
                                    i < lines.length;
                                    i++
                                ) {

                                    if (
                                        !usedLines.has(i) &&
                                        isCompletedTaskLine(lines[i]) &&
                                        taskLineMatchesText(lines[i], request.text)
                                    ) {
                                        matches.push(i);
                                    }
                                }


                                if (matches.length !== 1) {
                                    throw new Error(
                                        "A completed task moved or changed while the dashboard was open."
                                    );
                                }


                                index = matches[0];
                            }


                            usedLines.add(index);


                            return {
                                ...request,
                                line: index,
                                removedLines: taskBlockEnd(lines, index) - index,
                                hubTaskId: taskIdentity(lines[index])
                            };
                        }
                    );


                const archivedAt =
                    Date.now();

                const records =
                    resolved.filter(request => !this.projectWizard.getCompletedTaskHistoryId(
                        request.path, request.line, request.text, request.hubTaskId
                    )).map(
                        (request, index) => ({
                            id:
                                globalThis.crypto
                                    ?.randomUUID?.() ??
                                `${archivedAt}-${index}-${Math.random().toString(36).slice(2)}`,

                            text:
                                request.text,

                            path:
                                request.path,

                            line:
                                request.line,

                            projectId:
                                request.projectId,

                            projectName:
                                request.projectName,

                            projectStatus:
                                request.projectStatus,

                            projectPath:
                                request.projectPath,

                            projectRoot:
                                request.projectRoot,

                            contextKind:
                                request.contextKind,

                            resourceType:
                                request.resourceType,

                            timestamp:
                                this.projectWizard
                                    .getCompletedTaskTimestamp(
                                        request.path,
                                        request.line,
                                        request.text, request.hubTaskId
                                    ) ?? archivedAt,

                            archivedAt
                        })
                    );


                await this.projectWizard
                    .addCompletedTaskRecords(
                        records
                    );


                try {

                    await processTaskWrite(this,
                            file,
                            currentData => {

                                if (
                                    currentData !==
                                    original
                                ) {
                                    throw new Error(
                                        "The task note changed while completed tasks were being cleared."
                                    );
                                }


                                const updatedLines =
                                    [...lines];


                                resolved
                                    .map(item => item.line)
                                    .sort((a, b) => b - a)
                                    .forEach(
                                        line => {
                                            updatedLines.splice(
                                                line,
                                                taskBlockEnd(updatedLines, line) - line
                                            );
                                        }
                                    );


                                return updatedLines
                                    .join("\n");
                            }
                        );

                } catch (error) {

                    await this.projectWizard
                        .removeCompletedTaskRecords(
                            records.map(
                                record =>
                                    record.id
                            )
                        );

                    throw error;
                }


                try {

                    await this.taskEditor?.forget(resolved.map(task => task.hubTaskId));
                    await this.projectWizard
                        .removeClearedTaskChecks(
                            resolved
                        );

                } catch (error) {

                    console.error(
                        "Could not tidy cleared task timestamps:",
                        error
                    );
                }


                deleted.push(
                    ...resolved.map(
                        item => ({
                            path:
                                item.path,

                            line:
                                item.line,

                            text:
                                item.text
                        })
                    )
                );


                this.markProjectChangedByPath(
                    path
                );

            } catch (error) {

                failures.push(path);

                console.error(
                    `Could not clear completed tasks from ${path}:`,
                    error
                );
            }
        }


        if (deleted.length > 0) {
            this.notifyCompletedTasksChanged({
                deleted
            });
        }


        if (failures.length > 0) {
            new Notice(
                failures.length === 1
                    ? "Could not clear a completed task. The source note may have changed."
                    : `Could not clear completed tasks from ${failures.length} notes.`
            );
        }


        return {
            deleted,
            cancelled: false
        };
    }

    showProjectCoverMenu(
        event,
        path,
        dashboard
    ) {

        const file =
            this.app.vault
                .getAbstractFileByPath(
                    path
                );


        if (
            !(file instanceof TFile)
        ) {
            return;
        }


        const frontmatter =
            this.app.metadataCache
                .getFileCache(
                    file
                )
                ?.frontmatter;


        if (!["project", "resource"].includes(frontmatter?.type)) {
            return;
        }


        const menu =
            new Menu();

        menu.addItem(item => item.setTitle("Edit image placement").setIcon("move")
            .onClick(() => this.headerImageEditors.get(dashboard.querySelector(".project-cover"))?.begin()));
        if (frontmatter.type === "resource") { menu.showAtMouseEvent(event); return; }

        menu.addItem(
            item => {

                item
                    .setTitle(
                        "Change image"
                    )
                    .setIcon(
                        "image"
                    )
                    .onClick(
                        () => {

                            this.chooseProjectCover(
                                file,
                                dashboard
                            );
                        }
                    );
            }
        );


        if (
            frontmatter.cover
        ) {

            menu.addItem(
                item => {

                    item
                        .setTitle(
                            "Use category image"
                        )
                        .setIcon(
                            "undo-2"
                        )
                        .onClick(
                            async () => {

                                await this.clearProjectCover(
                                    file,
                                    dashboard
                                );
                            }
                        );
                }
            );
        }


        menu.showAtMouseEvent(
            event
        );
    }


    async chooseProjectCover(
        file,
        dashboard
    ) {

        const input =
            document.createElement(
                "input"
            );


        input.type =
            "file";

        input.accept =
            "image/*";


        input.addEventListener(
            "change",
            async () => {

                const source =
                    input.files?.[0];


                if (!source) {
                    return;
                }


                try {

                    const frontmatter =
                        this.app.metadataCache
                            .getFileCache(
                                file
                            )
                            ?.frontmatter;


                    const projectId =
                        frontmatter?.projectId;


                    if (
                        !projectId
                    ) {

                        throw new Error(
                            "Project ID is missing."
                        );
                    }


                    const oldCover =
                        frontmatter.cover;


                    const coverRoot = SHARED_PROJECT_ROOTS.some(root => file.path.startsWith(`${root}/`))
                        ? SHARED_IMAGE_ROOT : PROJECT_COVER_ROOT;
                    await this.projectWizard
                        .ensureFolder(
                            coverRoot
                        );


                    const rawExtension =
                        source.name
                            .split(".")
                            .pop()
                            ?.toLowerCase();


                    const extension =
                        rawExtension
                            ?.replace(
                                /[^a-z0-9]/g,
                                ""
                            )
                        || "png";


                    const coverPath =
                        normalizePath(
                            `${coverRoot}/${projectId}.${extension}`
                        );


                    const data =
                        await source
                            .arrayBuffer();


                    const existing =
                        this.app.vault
                            .getAbstractFileByPath(
                                coverPath
                            );


                    if (
                        existing instanceof TFile
                    ) {

                        await this.app.vault
                            .modifyBinary(
                                existing,
                                data
                            );

                    } else {

                        await this.app.vault
                            .createBinary(
                                coverPath,
                                data
                            );
                    }


                    await this.app.fileManager
                        .processFrontMatter(
                            file,
                            metadata => {

                                metadata.cover =
                                    coverPath;
                            }
                        );


                    /*
                    * Remove an older Hub-managed
                    * cover if its extension/path
                    * changed.
                    */
                    if (
                        oldCover &&
                        oldCover !==
                            coverPath &&
                        oldCover.startsWith(
                            `${PROJECT_COVER_ROOT}/`
                        )
                    ) {

                        const oldFile =
                            this.app.vault
                                .getAbstractFileByPath(
                                    oldCover
                                );


                        if (
                            oldFile instanceof TFile
                        ) {

                            await this.app.vault
                                .delete(
                                    oldFile
                                );
                        }
                    }


                    if (
                        dashboard?.isConnected
                    ) {

                        dashboard.dispatchEvent(
                            new CustomEvent(
                                "hub-project-cover",
                                {
                                    detail: {
                                        path:
                                            file.path,

                                        cover:
                                            coverPath
                                    }
                                }
                            )
                        );
                    }


                } catch (error) {

                    console.error(
                        "Could not change project image:",
                        error
                    );


                    new Notice(
                        error.message ||
                        "Could not change project image."
                    );
                }
            },
            {
                once:
                    true
            }
        );


        input.click();
    }


    async clearProjectCover(
        file,
        dashboard
    ) {

        const frontmatter =
            this.app.metadataCache
                .getFileCache(
                    file
                )
                ?.frontmatter;


        const oldCover =
            frontmatter?.cover;


        await this.app.fileManager
            .processFrontMatter(
                file,
                metadata => {

                    delete metadata.cover;
                }
            );


        if (
            oldCover &&
            oldCover.startsWith(
                `${PROJECT_COVER_ROOT}/`
            )
        ) {

            const oldFile =
                this.app.vault
                    .getAbstractFileByPath(
                        oldCover
                    );


            if (
                oldFile instanceof TFile
            ) {

                await this.app.vault
                    .delete(
                        oldFile
                    );
            }
        }


        if (
            dashboard?.isConnected
        ) {

            dashboard.dispatchEvent(
                new CustomEvent(
                    "hub-project-cover",
                    {
                        detail: {
                            path:
                                file.path,

                            cover:
                                null
                        }
                    }
                )
            );
        }
    }

    showProjectMenu(event, file, status, dashboard, card) {

        const menu = new Menu();

        // Open

        menu.addItem(item => {
            item
                .setTitle("Open")
                .setIcon("file")
                .onClick(async () => {
                    await this.workspaceModes
                        .openProjectFull(
                            file.path,
                            card
                        );
                });
        });


        // SEPERATION 

        menu.addSeparator(); 


        // Project status

        if (status === "active") {

            menu.addItem(item => {
                item
                    .setTitle("Move to Shelf")
                    .setIcon("archive")
                    .onClick(() =>
                        this.setStatus(
                            file,
                            "shelved",
                            status,
                            dashboard
                        )
                    );
            });

            menu.addItem(item => {
                item
                    .setTitle("Move to Future")
                    .setIcon("clock")
                    .onClick(() =>
                        this.setStatus(
                            file,
                            "future",
                            status,
                            dashboard
                        )
                    );
            });

        } else if (status === "future") {

            menu.addItem(item => {
                item
                    .setTitle("Activate")
                    .setIcon("play")
                    .onClick(() =>
                        this.setStatus(
                            file,
                            "active",
                            status,
                            dashboard
                        )
                    );
            });

            menu.addItem(item => {
                item
                    .setTitle("Move to Shelf")
                    .setIcon("archive")
                    .onClick(() =>
                        this.setStatus(
                            file,
                            "shelved",
                            status,
                            dashboard
                        )
                    );
            });

        } else if (status === "shelved") {

            menu.addItem(item => {
                item
                    .setTitle("Activate")
                    .setIcon("play")
                    .onClick(() =>
                        this.setStatus(
                            file,
                            "active",
                            status,
                            dashboard
                        )
                    );
            });

            menu.addItem(item => {
                item
                    .setTitle("Move to Future")
                    .setIcon("clock")
                    .onClick(() =>
                        this.setStatus(
                            file,
                            "future",
                            status,
                            dashboard
                        )
                    );
            });
        }

        // SEPARATION 
        menu.addSeparator();

        // Change category

        menu.addItem(item => {
            item
                .setTitle(
                    "Change category"
                )
                .setIcon("tag")
                .onClick(() =>
                    this.changeProjectCategory(
                        file,
                        dashboard
                    )
                );
        });

        menu.addItem(item => {
            item
                .setTitle("Resource folders")
                .setIcon("library")
                .onClick(async () => {
                    await this.projectWizard.syncResourceFolders();
                    const project = this.projectWizard.getProjectForPath(file.path);
                    new ResourceFolderPickerModal(
                        this.app,
                        {
                            folders: this.projectWizard.getResourceFolders(),
                            selected: project?.resourceFolderIds ?? [],
                            title: `Resource folders for ${file.basename}`,
                            onSave: async ids => {
                                await this.projectWizard.setProjectResourceFolders(file, ids);
                                this.notifyProjectFilesChanged(file.path);
                            }
                        }
                    ).open();
                });
        });
    
        // SEPARATION 
        menu.addSeparator();

        // Rename

        menu.addItem(item => {
            item
                .setTitle("Rename")
                .setIcon("pencil")
                .onClick(() =>
                    this.renameProject(
                        file,
                        card,
                        dashboard
                    )
                );
        });

        // Destructive action last

        menu.addItem(item => {
            item
                .setTitle("Delete")
                .setIcon("trash-2")
                .onClick(() =>
                    this.deleteProject(
                        file,
                        dashboard
                    )
                );

            item.setWarning(true);
        });


        menu.showAtMouseEvent(event);
    }

    showProjectFolderMenu(
        event,
        actions
    ) {

        const menu =
            new Menu();


        // ---------- CREATE ----------

        menu.addItem(
            item => {

                item
                    .setTitle(
                        "New note"
                    )
                    .setIcon(
                        "file-plus-2"
                    )
                    .onClick(
                        () => {

                            actions
                                ?.newNote?.();
                        }
                    );
            }
        );


        menu.addItem(
            item => {

                item
                    .setTitle(
                        "New subfolder"
                    )
                    .setIcon(
                        "folder-plus"
                    )
                    .onClick(
                        () => {

                            actions
                                ?.newFolder?.();
                        }
                    );
            }
        );

        if (
            actions?.moveTo
        ) {

            menu.addSeparator();


            menu.addItem(
                item => {

                    item
                        .setTitle(
                            "Move folder to…"
                        )
                        .setIcon(
                            "folder-input"
                        )
                        .onClick(
                            () => {

                                new ProjectFolderPickerModal(
                                    this.app,

                                    async targetPath => {

                                        try {

                                            await actions
                                                .moveTo(
                                                    targetPath
                                                );

                                        } catch (error) {

                                            console.error(
                                                "Could not move folder:",
                                                error
                                            );


                                            new Notice(
                                                error.message ||
                                                "Could not move folder."
                                            );
                                        }
                                    }
                                ).open();
                            }
                        );
                }
            );
        }

        /*
        * Project Root does not provide
        * rename/delete callbacks.
        */
        if (
            actions?.rename ||
            actions?.delete
        ) {

            menu.addSeparator();
        }


        // ---------- RENAME ----------

        if (
            actions?.rename
        ) {

            menu.addItem(
                item => {

                    item
                        .setTitle(
                            "Rename"
                        )
                        .setIcon(
                            "pencil"
                        )
                        .onClick(
                            async () => {

                                const quickAddApi =
                                    this.app.plugins
                                        .plugins
                                        .quickadd
                                        ?.api;


                                if (
                                    !quickAddApi
                                ) {

                                    new Notice(
                                        "QuickAdd is not enabled."
                                    );

                                    return;
                                }


                                let response;


                                try {

                                    response =
                                        await quickAddApi
                                            .inputPrompt(
                                                "Folder name",
                                                "",
                                                actions.name ??
                                                    ""
                                            );

                                } catch {

                                    return;
                                }


                                if (
                                    !response
                                ) {
                                    return;
                                }


                                try {

                                    await actions
                                        .rename(
                                            response
                                        );

                                } catch (error) {

                                    console.error(
                                        "Could not rename folder:",
                                        error
                                    );


                                    new Notice(
                                        error.message ||
                                        "Could not rename folder."
                                    );
                                }
                            }
                        );
                }
            );
        }

        if (
            actions?.path
        ) {

            const folder =
                this.app.vault
                    .getAbstractFileByPath(
                        actions.path
                    );


            if (
                folder instanceof TFolder
            ) {

                this.app.workspace
                    .trigger(
                        "file-menu",
                        menu,
                        folder,
                        "file-explorer-context-menu"
                    );
            }
        }

        // ---------- DELETE ----------

        if (
            actions?.delete
        ) {

            menu.addItem(
                item => {

                    item
                        .setTitle(
                            "Delete"
                        )
                        .setIcon(
                            "trash-2"
                        )
                        .setWarning(
                            true
                        )
                        .onClick(
                            async () => {

                                const confirmed =
                                    await confirmAction(
                                        this.app,

                                        "Delete folder?",

                                        `Delete "${actions.name}" and everything inside it?`
                                    );


                                if (
                                    !confirmed
                                ) {
                                    return;
                                }


                                try {

                                    await actions
                                        .delete();

                                } catch (error) {

                                    if (isProjectDeletionCancelled(error)) return;
                                    console.error(
                                        "Could not delete folder:",
                                        error
                                    );


                                    new Notice(
                                        error.message ||
                                        "Could not delete folder."
                                    );
                                }
                            }
                        );
                }
            );
        }

        if (actions?.detach) {
            menu.addSeparator();
            menu.addItem(item => {
                item
                    .setTitle("Detach from project")
                    .setIcon("unlink")
                    .onClick(async () => {
                        try {
                            await actions.detach();
                        } catch (error) {
                            console.error("Could not detach Resource folder:", error);
                            new Notice(error.message || "Could not detach Resource folder.");
                        }
                    });
            });
        }


        menu.showAtMouseEvent(
            event
        );
    }

    showProjectSelectionMenu(
        event,
        actions
    ) {

        const menu =
            new Menu();


        const count =
            Number(
                actions?.count
            ) || 0;


        // ---------- MOVE ----------

        if (
            actions?.moveTo
        ) {

            menu.addItem(
                item => {

                    item
                        .setTitle(
                            `Move ${count} ${
                                count === 1
                                    ? "item"
                                    : "items"
                            } to…`
                        )
                        .setIcon(
                            "folder-input"
                        )
                        .onClick(
                            () => {

                                new ProjectFolderPickerModal(
                                    this.app,

                                    async targetPath => {

                                        try {

                                            await actions
                                                .moveTo(
                                                    targetPath
                                                );

                                        } catch (error) {

                                            console.error(
                                                "Could not move selected items:",
                                                error
                                            );


                                            new Notice(
                                                error.message ||
                                                "Could not move selected items."
                                            );
                                        }
                                    }
                                ).open();
                            }
                        );
                }
            );
        }


        /*
        * Allow plugins that support
        * Obsidian's multi-file menu event
        * to contribute actions too.
        */
        const files =
            (
                actions?.paths ??
                []
            )
                .map(
                    path =>
                        this.app.vault
                            .getAbstractFileByPath(
                                path
                            )
                )
                .filter(Boolean);


        if (
            files.length > 1
        ) {

            this.app.workspace
                .trigger(
                    "files-menu",
                    menu,
                    files,
                    "file-explorer-context-menu"
                );
        }


        menu.addSeparator();


        // ---------- DELETE ----------

        menu.addItem(
            item => {

                item
                    .setTitle(
                        count === 1
                            ? "Delete"
                            : `Delete ${count} items`
                    )
                    .setIcon(
                        "trash-2"
                    )
                    .setWarning(
                        true
                    )
                    .onClick(
                        async () => {

                            const confirmed =
                                await confirmAction(
                                    this.app,

                                    count === 1
                                        ? "Delete item?"
                                        : `Delete ${count} items?`,

                                    count === 1
                                        ? "Move this item to the trash?"
                                        : `Move these ${count} items to the trash?`
                                );


                            if (
                                !confirmed
                            ) {
                                return;
                            }


                            try {

                                await actions
                                    ?.delete?.();

                            } catch (error) {

                                if (isProjectDeletionCancelled(error)) return;
                                console.error(
                                    "Could not delete selected project items:",
                                    error
                                );


                                new Notice(
                                    error.message ||
                                    "Could not delete selected items."
                                );
                            }
                        }
                    );
            }
        );


        menu.showAtMouseEvent(
            event
        );
    }

    async duplicateProjectFile(
        file
    ) {

        const parentPath =
            file.parent?.path ?? "";


        const prefix =
            parentPath &&
            parentPath !== "/"
                ? `${parentPath}/`
                : "";


        let index =
            1;


        let path;


        do {

            const suffix =
                index === 1
                    ? " copy"
                    : ` copy ${index}`;


            const extension =
                file.extension
                    ? `.${file.extension}`
                    : "";


            path =
                normalizePath(
                    `${prefix}${file.basename}${suffix}${extension}`
                );


            index++;

        } while (
            this.app.vault
                .getAbstractFileByPath(
                    path
                )
        );


        await this.app.vault
            .copy(
                file,
                path
            );
    }


    notifyProgressChanged(
        date,
        projectIds
    ) {

        document
            .querySelectorAll(
                ".home-dashboard, .project-dashboard"
            )
            .forEach(dashboard => {

                dashboard.dispatchEvent(
                    new CustomEvent(
                        "hub-progress-changed",
                        {
                            detail: {
                                date,

                                projectIds:
                                    [...projectIds]
                            }
                        }
                    )
                );
            });
    }


    notifyCompletedTasksChanged(
        detail = {}
    ) {

        document
            .querySelectorAll(
                ".home-dashboard, .project-dashboard"
            )
            .forEach(dashboard => {

                dashboard.dispatchEvent(
                    new CustomEvent(
                        "hub-completed-tasks-changed",
                        {
                            detail
                        }
                    )
                );
            });
        document.dispatchEvent(new CustomEvent("hub-completed-tasks-changed", { detail }));
    }


    notifyFocusChanged(
        date
    ) {

        document
            .querySelectorAll(
                ".home-dashboard, .project-dashboard"
            )
            .forEach(dashboard => {

                dashboard.dispatchEvent(
                    new CustomEvent(
                        "hub-focus-changed",
                        {
                            detail: {
                                date
                            }
                        }
                    )
                );
            });
    }


    openDailyFocusEditor(
        date
    ) {

        if (!parseLocalISODate(date)) {

            new Notice(
                "Choose a valid focus date."
            );

            return;
        }


        new DailyFocusModal(
            this.app,
            {
                date,

                items:
                    this.projectWizard
                        .getDailyFocus(date) ?? [],

                nextItems:
                    this.projectWizard
                        .getPendingFocus(
                            date
                        )?.items ?? [],

                projects:
                    this.projectWizard
                        .getFocusContexts(),

                onSave:
                    ({
                        items,
                        nextItems
                    }) =>
                        this.projectWizard
                            .setDailyAndPendingFocus(
                                date,
                                items,
                                nextItems
                            ),

                onSaved:
                    () => {
                        this.notifyFocusChanged(
                            date
                        );
                    }
            }
        ).open();
    }


    openProgressEditor(
        date,
        projectId = null
    ) {

        const parsedDate =
            parseLocalISODate(date);


        if (
            !parsedDate ||
            date > localISODate()
        ) {

            new Notice(
                "Choose today or an earlier date."
            );

            return;
        }

        const isGeneralReport =
            projectId === null;


        const requestedKind =
            projectId &&
            typeof projectId === "object"
                ? projectId.kind
                : typeof projectId === "string" &&
                    projectId.startsWith("resource:")
                    ? "resource"
                    : projectId
                        ? "project"
                        : "all";


        const resourceTarget =
            requestedKind === "resource" &&
            (
                typeof projectId === "string" ||
                projectId?.id
            )
                ? this.projectWizard.getResourceById(
                    typeof projectId === "string"
                        ? projectId
                        : projectId.id
                )
                : null;


        const projectTargetId =
            requestedKind === "project"
                ? (
                    typeof projectId === "object"
                        ? projectId.id ?? null
                        : projectId
                )
                : null;


        let projects =
            requestedKind === "resource"
                ? []
                : this.projectWizard
                    .getProjectRecords();


        if (projectTargetId) {

            projects =
                projects.filter(
                    project =>
                        project.projectId ===
                            projectTargetId
                );

        } else if (requestedKind !== "resource") {

            /*
             * Keep a daily check-in focused:
             * show active projects plus any
             * project already answered that day.
             */
            projects =
                projects.filter(
                    project => {

                        const score =
                            this.projectWizard
                                .getProjectWorkRatings(
                                    project.projectId
                                )[date];

                        const summary =
                            this.projectWizard
                                .getProjectWorkLogs(
                                    project.projectId
                                )[date]?.summary;


                        return (
                            project.status ===
                                "active" ||
                            (
                                Number.isInteger(
                                    score
                                ) &&
                                score >= 1 &&
                                score <= 4
                            ) ||
                            Boolean(summary)
                        );
                    }
                );
        }


        const resources =
            requestedKind === "project"
                ? []
                : resourceTarget
                    ? [resourceTarget]
                    : this.projectWizard
                        .getResourceTypes();


        const statusOrder = {
            active: 0,
            future: 1,
            shelved: 2
        };


        projects.sort(
            (a, b) =>
                (
                    statusOrder[a.status] ?? 3
                ) -
                (
                    statusOrder[b.status] ?? 3
                ) ||
                a.name.localeCompare(
                    b.name,
                    undefined,
                    {
                        sensitivity:
                            "base"
                    }
                )
        );


        if (
            projects.length === 0 &&
            resources.length === 0
        ) {

            new Notice(
                requestedKind === "resource"
                    ? "No Resource is available for this progress entry."
                    : "No project is available for this progress entry."
            );

            return;
        }


        const currentScores = {};
        const currentSummaries = {};


        for (
            const project
            of projects
        ) {

            const score =
                this.projectWizard
                    .getProjectWorkRatings(
                        project.projectId
                    )[date];


            if (
                Number.isInteger(score) &&
                score >= 1 &&
                score <= 4
            ) {

                currentScores[
                    project.projectId
                ] =
                    score;
            }


            currentSummaries[
                project.projectId
            ] =
                this.projectWizard
                    .getProjectWorkLogs(
                        project.projectId
                    )[date]?.summary ?? "";
        }


        for (const resource of resources) {
            const key =
                `resource:${resource.resourceType}`;

            const score =
                this.projectWizard
                    .getResourceWorkRatings(
                        resource.resourceType
                    )[date];

            if (
                Number.isInteger(score) &&
                score >= 1 &&
                score <= 4
            ) {
                currentScores[key] =
                    score;
            }

            currentSummaries[key] =
                this.projectWizard
                    .getResourceWorkLogs(
                        resource.resourceType
                    )[date]?.summary ?? "";
        }


        const showNextFocus =
            isGeneralReport &&
            date === localISODate();


        const projectIds =
            projects.map(
                project =>
                    project.projectId
            );


        const resourceIds =
            resources.map(
                resource =>
                    resource.resourceType
            );


        const dateLabel =
            formatWeekday(parsedDate) + ", " + formatDate(parsedDate, "full");


        new ProjectAdvancementModal(
            this.app,
            {
                plugin: this,
                reportDate: date,
                getReportContexts: () => Object.fromEntries([...projects, ...resources].map(workspace => {
                    const id = workspace.projectId ?? `resource:${workspace.resourceType}`;
                    const previous = id.startsWith("resource:")
                        ? this.projectWizard.resourceWorkLogs[id.slice(9)]?.[date]
                        : this.projectWizard.projectWorkLogs[id]?.[date];
                    return [id, savedReportContext(this.projectWizard, date, id, previous?.context)];
                })),
                projects,

                resources,

                currentScores,

                currentSummaries,

                showNextFocus,

                currentFocus:
                    showNextFocus
                        ? (
                            this.projectWizard
                                .getPendingFocus(
                                    date
                                )?.items ?? []
                        )
                        : [],

                focusProjects:
                    this.projectWizard
                        .getFocusContexts(),

                title:
                    reportTitle(date, true),

                requireEveryProject:
                    false,

                allowNoProgress:
                    true,

                saveLabel:
                    "Save changes",

                showCancel:
                    true,

                onSave:
                    async ({
                        scores,
                        summaries,
                        focus
                    }) => {

                        await this.projectWizard
                            .replaceCombinedProgress(
                                date,
                                projectIds,
                                resourceIds,
                                scores,
                                summaries,
                                showNextFocus
                                    ? {
                                        sourceDate:
                                            date,
                                        items:
                                            focus
                                    }
                                    : null
                            );
                    },

                onSaved:
                    () => {

                        this.notifyProgressChanged(
                            date,
                            projectIds.concat(
                                resourceIds.map(
                                    resourceId =>
                                        `resource:${resourceId}`
                                )
                            )
                        );


                        new Notice(
                            `Updated progress for ${dateLabel}.`
                        );
                    }
            }
        ).open();
    }


    enableProgressCalendarEditing(
        calendar,
        {
            year,
            projectId = null
        } = {}
    ) {

        if (
            !calendar ||
            typeof calendar.querySelectorAll !==
                "function" ||
            !Number.isInteger(year)
        ) {
            return;
        }


        const today =
            localISODate();
        const reportDates = new Set(this.projectWizard.getProgressReports(projectId).map(report => report.date));

        const dayCells =
            [
                ...calendar.querySelectorAll(
                    ".heatmap-calendar-boxes > li[class*='month-']"
                )
            ];


        for (
            let index = 0;
            index < dayCells.length;
            index++
        ) {

            const cell =
                dayCells[index];


            const cellDate =
                new Date(
                    year,
                    0,
                    index + 1
                );


            const date =
                localISODate(
                    cellDate
                );


            const dateLabel =
                shortDateLabel(date);


            const isFuture =
                date > today;


            cell.dataset.date =
                date;


            cell.classList.add(
                "hub-progress-day"
            );


            cell.classList.toggle(
                "is-future",
                isFuture
            );


            cell.classList.toggle("has-report", reportDates.has(date));
            const progressDetails =
                cell.dataset
                    .hubProgressDetails;


            if (isFuture) {

                cell.removeAttribute(
                    "role"
                );


                cell.removeAttribute(
                    "tabindex"
                );


                cell.setAttribute(
                    "aria-disabled",
                    "true"
                );


                cell.removeAttribute(
                    "aria-label"
                );


                setHubTooltip(cell, `${dateLabel}\nFuture dates cannot be edited`);

                continue;
            }


            cell.setAttribute(
                "role",
                "button"
            );


            cell.setAttribute(
                "tabindex",
                "-1"
            );


            cell.removeAttribute(
                "aria-disabled"
            );


            const details =
                progressDetails ||
                "No progress recorded";


            cell.removeAttribute(
                "aria-label"
            );


            setHubTooltip(cell, `${dateLabel}\n${details}\n${reportDates.has(date) ? "Click to view report" : "Click to edit progress"}`);
        }


        const editableCells =
            dayCells.filter(
                cell =>
                    !cell.classList.contains(
                        "is-future"
                    )
            );


        const initialTabStop =
            editableCells.find(
                cell =>
                    cell.dataset.date ===
                        today
            ) ||
            editableCells.at(-1);


        initialTabStop?.setAttribute(
            "tabindex",
            "0"
        );


        calendar.hubProgressEditorOptions = {
            projectId
        };


        if (
            calendar.hubProgressClickHandler
        ) {

            calendar.removeEventListener(
                "click",
                calendar.hubProgressClickHandler
            );
        }


        if (
            calendar.hubProgressKeyHandler
        ) {

            calendar.removeEventListener(
                "keydown",
                calendar.hubProgressKeyHandler
            );
        }


        const getEventCell =
            event => {

                const cell =
                    event.target.closest?.(
                        ".hub-progress-day[data-date]"
                    );


                if (
                    !cell ||
                    !calendar.contains(cell) ||
                    cell.classList.contains(
                        "is-future"
                    )
                ) {
                    return null;
                }


                return cell;
            };


        const setTabStop =
            cell => {

                calendar
                    .querySelectorAll(
                        ".hub-progress-day[tabindex='0']"
                    )
                    .forEach(current => {

                        current.setAttribute(
                            "tabindex",
                            "-1"
                        );
                    });


                cell.setAttribute(
                    "tabindex",
                    "0"
                );
            };


        const openCell =
            cell => {

                setTabStop(cell);


                const scope = calendar.hubProgressEditorOptions?.projectId ?? null;
                const day = reportDay(this.projectWizard, cell.dataset.date, scope);
                if (day.reports.length) {
                    new DailyReportModal(this.app, { day, plugin: this,
                        onEdit: () => window.hubOpenProgressEditor?.(day.date, scope)
                    }).open();
                } else {
                    window.hubOpenProgressEditor?.(cell.dataset.date, scope);
                }
            };


        calendar.hubProgressClickHandler =
            event => {

                const cell =
                    getEventCell(event);


                if (cell) {
                    openCell(cell);
                }
            };


        calendar.hubProgressKeyHandler =
            event => {

                const cell =
                    getEventCell(event);


                if (!cell) {
                    return;
                }


                if (
                    event.key === "Enter" ||
                    event.key === " "
                ) {

                    event.preventDefault();

                    openCell(cell);

                    return;
                }


                const offsets = {
                    ArrowUp: -1,
                    ArrowDown: 1,
                    ArrowLeft: -7,
                    ArrowRight: 7
                };


                const offset =
                    offsets[event.key];


                if (!offset) {
                    return;
                }


                const currentIndex =
                    editableCells.indexOf(
                        cell
                    );


                const target =
                    editableCells[
                        currentIndex +
                        offset
                    ];


                if (!target) {
                    return;
                }


                event.preventDefault();


                setTabStop(target);


                target.focus();
            };


        calendar.addEventListener(
            "click",
            calendar.hubProgressClickHandler
        );


        calendar.addEventListener(
            "keydown",
            calendar.hubProgressKeyHandler
        );
    }


    async copyProjectObsidianUrl(
        file
    ) {

        const vault =
            encodeURIComponent(
                this.app.vault
                    .getName()
            );


        const path =
            encodeURIComponent(
                file.path
            );


        await navigator.clipboard
            .writeText(
                `obsidian://open?vault=${vault}&file=${path}`
            );


        new Notice(
            "Obsidian URL copied."
        );
    }

    showProjectFileMenu(
        event,
        path,
        actions = {}
    ) {

        const file =
            this.app.vault
                .getAbstractFileByPath(
                    path
                );


        if (
            !(file instanceof TFile)
        ) {
            return;
        }

        const frontmatter =
            this.app.metadataCache
                .getFileCache(
                    file
                )
                ?.frontmatter;


        if (
            frontmatter?.type ===
            "project"
        ) {
            return;
        }


        const menu =
            new Menu();


        // ---------- OPEN ----------

        menu.addItem(
            item => {

                item
                    .setTitle(
                        "Open in new tab"
                    )
                    .setIcon(
                        "file-plus-2"
                    )
                    .onClick(
                        async () => {

                            await this.workspaceModes
                                .openProjectNote(
                                    file.path,
                                    "tab",
                                    event.target
                                );
                        }
                    );
            }
        );


        menu.addItem(
            item => {

                item
                    .setTitle(
                        "Open to the right"
                    )
                    .setIcon(
                        "columns-2"
                    )
                    .onClick(
                        async () => {

                            await this.workspaceModes
                                .openProjectNote(
                                    file.path,
                                    "split",
                                    event.target
                                );
                        }
                    );
            }
        );


        menu.addItem(
            item => {

                item
                    .setTitle(
                        "Open in new window"
                    )
                    .setIcon(
                        "external-link"
                    )
                    .onClick(
                        async () => {

                            await this.app.workspace
                                .getLeaf(
                                    "window"
                                )
                                .openFile(
                                    file
                                );
                        }
                    );
            }
        );


        menu.addSeparator();


        // ---------- FILE OPERATIONS ----------

        menu.addItem(
            item => {

                item
                    .setTitle(
                        "Rename"
                    )
                    .setIcon(
                        "pencil"
                    )
                    .onClick(
                        () => {

                            this.renameProjectFile(
                                file
                            );
                        }
                    );
            }
        );


        menu.addItem(
            item => {

                item
                    .setTitle(
                        "Make a copy"
                    )
                    .setIcon(
                        "copy"
                    )
                    .onClick(
                        async () => {

                            try {

                                await this
                                    .duplicateProjectFile(
                                        file
                                    );

                            } catch (error) {

                                console.error(
                                    "Could not duplicate file:",
                                    error
                                );


                                new Notice(
                                    error.message ||
                                    "Could not make a copy."
                                );
                            }
                        }
                    );
            }
        );


        if (
            actions?.moveTo
        ) {

            menu.addItem(
                item => {

                    item
                        .setTitle(
                            "Move file to…"
                        )
                        .setIcon(
                            "folder-input"
                        )
                        .onClick(
                            () => {

                                new ProjectFolderPickerModal(
                                    this.app,

                                    async targetPath => {

                                        try {

                                            await actions
                                                .moveTo(
                                                    targetPath
                                                );

                                        } catch (error) {

                                            console.error(
                                                "Could not move file:",
                                                error
                                            );


                                            new Notice(
                                                error.message ||
                                                "Could not move file."
                                            );
                                        }
                                    }
                                ).open();
                            }
                        );
                }
            );
        }


        /*
        * Let Obsidian/core/community plugins
        * contribute their normal file-explorer
        * actions, including Bookmarks.
        */
        this.app.workspace
            .trigger(
                "file-menu",
                menu,
                file,
                "file-explorer-context-menu"
            );


        menu.addSeparator();


        // ---------- COPY URL ----------

        menu.addItem(
            item => {

                item
                    .setTitle(
                        "Copy Obsidian URL"
                    )
                    .setIcon(
                        "link"
                    )
                    .onClick(
                        async () => {

                            await this
                                .copyProjectObsidianUrl(
                                    file
                                );
                        }
                    );
            }
        );


        menu.addSeparator();


        // ---------- DELETE ----------

        menu.addItem(
            item => {

                item
                    .setTitle(
                        "Delete"
                    )
                    .setIcon(
                        "trash-2"
                    )
                    .setWarning(
                        true
                    )
                    .onClick(
                        () => {

                            this.deleteProjectFile(
                                file
                            );
                        }
                    );
            }
        );


        menu.showAtMouseEvent(
            event
        );
    }


    async renameProjectFile(
        file
    ) {

        const quickAddApi =
            this.app.plugins
                .plugins.quickadd
                ?.api;


        if (!quickAddApi) {

            new Notice(
                "QuickAdd is not enabled."
            );

            return;
        }


        try {

            const response =
                await quickAddApi
                    .inputPrompt(
                        "File name",
                        "",
                        file.basename
                    );


            if (!response) {
                return;
            }


            const newName =
                response.trim();


            if (
                !validVaultName(
                    newName
                )
            ) {

                new Notice(
                    "Enter a valid file name."
                );

                return;
            }


            if (
                newName ===
                    file.basename
            ) {
                return;
            }


            const extension =
                file.extension
                    ? `.${file.extension}`
                    : "";


            const newPath =
                normalizePath(
                    `${file.parent.path}/${newName}${extension}`
                );


            const existing =
                this.app.vault
                    .getAbstractFileByPath(
                        newPath
                    );


            if (existing) {

                new Notice(
                    "A file with that name already exists."
                );

                return;
            }


            await this.app.fileManager
                .renameFile(
                    file,
                    newPath
                );


        } catch (error) {

            /*
            * Closing QuickAdd should not
            * become a visible error.
            */
            console.debug(
                "File rename cancelled.",
                error
            );
        }
    }


    async deleteProjectFile(
        file
    ) {

        const confirmed =
            await confirmAction(
                this.app,

                "Delete file?",

                `Delete "${projectFileTitle(
                    file
                )}"?`
            );


        if (!confirmed) {
            return;
        }


        try {

            await this.app.fileManager
                .trashFile(
                    file
                );


        } catch (error) {

            if (isProjectDeletionCancelled(error)) return;
            console.error(
                "Could not delete note:",
                error
            );


            new Notice(
                "Could not delete file."
            );
        }
    }

    changeProjectCategory(
        file,
        dashboard
    ) {

        const frontmatter =
            this.app.metadataCache
                .getFileCache(file)
                ?.frontmatter;


        new ProjectCategoryModal(
            this.app,
            this.projectWizard
                .getCategories(),
            frontmatter?.category,
            file.basename,
            async category => {

                await this.app.fileManager
                    .processFrontMatter(
                        file,
                        frontmatter => {

                            frontmatter.category =
                                category.id;

                            delete frontmatter.image;
                            delete frontmatter.kind;
                        }
                    );


                if (
                    dashboard?.isConnected
                ) {
                    dashboard.dispatchEvent(
                        new CustomEvent(
                            "hub-project-category",
                            {
                                detail: {
                                    path:
                                        file.path,
                                    categoryId:
                                        category.id
                                }
                            }
                        )
                    );
                }
            }
        ).open();
    }

    async ensureContextOpen(context, dashboard = null) {
        if (this.oath?.canOpen(context) === false) return false;
        if (context.contextKind === "resource" || context.status === "active") return true;
        if (context.status !== "shelved") {
            new Notice("Activate this project before opening it.");
            return false;
        }
        const accepted = await new ConfirmModal(this.app,
            "Activate shelved project?",
            `${context.name} is shelved and cannot currently be opened. Activate it to continue?`,
            "Activate project", "mod-cta").waitForConfirmation();
        if (!accepted) return false;
        const file = this.app.vault.getAbstractFileByPath(context.path);
        if (!(file instanceof TFile)) return false;
        const saved = await this.setStatus(file, "active", context.status, dashboard);
        if (saved) context.status = "active";
        return saved;
    }

    async setStatus(
        file,
        newStatus,
        oldStatus,
        dashboard
    ) {

        // Change the visible dashboard NOW.
        // dispatchEvent() is synchronous.
        dashboard?.dispatchEvent(
            new CustomEvent("hub-project-status", {
                detail: {
                    path: file.path,
                    status: newStatus
                }
            })
        );


        // Persist the change afterwards.
        try {

            await this.app.fileManager.processFrontMatter(
                file,
                frontmatter => {
                    frontmatter.status = newStatus;
                }
            );
            return true;

        } catch (error) {

            console.error(error);


            // Restore the UI if writing failed.
            if (dashboard?.isConnected) {
                dashboard.dispatchEvent(
                    new CustomEvent("hub-project-status", {
                        detail: {
                            path: file.path,
                            status: oldStatus
                        }
                    })
                );
            }

            new Notice(
                "Could not change project status."
            );
            return false;
        }
    }


    async renameProject(file, card, dashboard) {

        const quickAddApi =
            this.app.plugins.plugins.quickadd?.api;

        if (!quickAddApi) {
            new Notice("QuickAdd is not enabled.");
            return;
        }

        try {

            const newName =
                await quickAddApi.inputPrompt(
                    "Project name",
                    "",
                    file.basename
                );

            if (!newName) return;

            const trimmedName = newName.trim();

            if (
                !trimmedName ||
                trimmedName === file.basename
            ) {
                return;
            }

            await this.performRename(
                file,
                trimmedName,
                card,
                dashboard
            );

        } catch (error) {

            // Closing/cancelling the QuickAdd prompt
            // should simply do nothing.
            console.debug(
                "Project rename cancelled.",
                error
            );
        }
    }

    async performRename(
        file,
        newName,
        card,
        dashboard
    ) {

        const oldName = file.basename;
        const oldPath = file.path;

        const projectStatus =
            this.app.metadataCache
                .getFileCache(file)
                ?.frontmatter
                ?.status;

        const folder = file.parent;

        const standardProject =
            folder &&
            folder.name === oldName &&
            folder.parent;


        // Work out final path before changing anything.

        const newFilePath = standardProject
            ? normalizePath(
                `${folder.parent.path}/${newName}/${newName}.md`
            )
            : normalizePath(
                file.parent?.path
                    ? `${file.parent.path}/${newName}.md`
                    : `${newName}.md`
            );


        // ---------- IMMEDIATE UI UPDATE ----------

        const title =
            card.querySelector(".home-project-title");

        const oldDisplayName =
            title?.textContent || "";

        const newDisplayName =
            newName.replace(
                /^(Book|MSc Thesis|Novel|Research|Poetry)\s*-\s*/i,
                ""
            );

        if (title) {
            title.textContent = newDisplayName;
        }

        card.dataset.projectPath = newFilePath;

                dashboard.dispatchEvent(
            new CustomEvent("hub-project-rename", {
                detail: {
                    oldPath,
                    newPath: newFilePath,
                    name: newName
                }
            })
        );

        // ---------- ACTUAL FILE RENAME ----------

        try {

            if (standardProject) {

                const newFolderPath =
                    normalizePath(
                        `${folder.parent.path}/${newName}`
                    );


                await this.app.fileManager.renameFile(
                    folder,
                    newFolderPath
                );


                const movedFile =
                    this.app.vault.getAbstractFileByPath(
                        normalizePath(
                            `${newFolderPath}/${oldName}.md`
                        )
                    );

                if (!movedFile) {
                    throw new Error(
                        "Project hub not found after folder rename."
                    );
                }


                await this.app.fileManager.renameFile(
                    movedFile,
                    newFilePath
                );

            } else {

                await this.app.fileManager.renameFile(
                    file,
                    newFilePath
                );
            }


            this.logProjectActivity(
                "renamed",
                {
                    path:
                        newFilePath,

                    oldPath,

                    title:
                        newName,

                    oldTitle:
                        oldName,

                    projectStatus
                }
            ).catch(error => {

                console.error(
                    "Could not record project rename:",
                    error
                );
            });


        } catch (error) {

            console.error(
                "Could not rename project:",
                error
            );


            // Roll back immediate visual change.

            if (card.isConnected) {
                card.dataset.projectPath = oldPath;

                if (dashboard.isConnected) {
                    dashboard.dispatchEvent(
                        new CustomEvent("hub-project-rename", {
                            detail: {
                                oldPath: newFilePath,
                                newPath: oldPath,
                                name: oldName
                            }
                        })
                    );
                }

                if (title) {
                    title.textContent = oldDisplayName;
                }
            }

            new Notice(
                "Could not rename project."
            );
        }
    }


    async deleteProject(file, dashboard) {

        const folder = file.parent;

        const target =
            folder &&
            folder.name === file.basename
                ? folder
                : file;

        const projectStatus =
            this.app.metadataCache
                .getFileCache(file)
                ?.frontmatter
                ?.status;


        const projectId = this.app.metadataCache.getFileCache(file)?.frontmatter?.projectId;

        const projectName =
            file.basename;


        const projectPath =
            file.path;


        const ignoredRoot =
            target instanceof TFolder
                ? target.path
                : null;

        const onApproved = () => {
            // Remove from dashboard only after both deletion safeguards pass.
            dashboard.dispatchEvent(
                new CustomEvent("hub-project-delete", {
                    detail: { path: file.path, deleted: true }
                })
            );
            if (ignoredRoot) this.activityIgnoredRoots.add(ignoredRoot);
        };

        try {

            await this.projectDeletion.trash(target, { onApproved, requiredProject: file });

            this.logProjectActivity(
                "deleted",
                {
                    path:
                        projectPath,

                    title:
                        projectName,

                    projectStatus,
                    projectId
                }
            ).catch(error => {

                console.error(
                    "Could not record project deletion:",
                    error
                );
            });

        } catch (error) {

            if (isProjectDeletionCancelled(error)) return;
            console.error(error);

            // Restore card if deletion failed.

            if (dashboard.isConnected) {
                dashboard.dispatchEvent(
                    new CustomEvent("hub-project-delete", {
                        detail: {
                            path: file.path,
                            deleted: false
                        }
                    })
                );
            }

            new Notice(
                "Could not delete project."
            );
        } finally {

            if (ignoredRoot) {

                this.activityIgnoredRoots
                    .delete(
                        ignoredRoot
                    );
            }
        }
    }

    async openAppShortcut(
        id
    ) {

        const shortcut =
            APP_SHORTCUTS.find(
                shortcut =>
                    shortcut.id === id
            );


        if (!shortcut) {

            throw new Error(
                `Unknown shortcut: ${id}`
            );
        }


        if (this.oath?.active && this.oath.isStrict) {
            // Strict shortcuts use the frozen executable policy; no title/PID focus workaround.
            const executable = resolveExecutable(shortcut.type === "website" ? FIREFOX_EXECUTABLES : shortcut.executables ?? []);
            if (!executable) throw new Error("Application executable could not be found.");
            await this.oath.launchStrictApplication(executable, shortcut.type === "website" ? shortcut.url : null);
            return;
        }

        // ---------- WEBSITE ----------

        if (
            shortcut.type === "website"
        ) {

            const firefox =
                resolveExecutable(
                    FIREFOX_EXECUTABLES
                );


            if (!firefox) {

                throw new Error(
                    "Firefox could not be found."
                );
            }


            /*
            * Firefox behavior:
            *
            * closed  -> launch Firefox
            * running -> open a new tab
            */
            await spawnDetached(
                firefox,
                [
                    "-new-tab",
                    shortcut.url
                ]
            );


            return;
        }


        // ---------- APPLICATION ----------

        if (
            shortcut.type ===
                "application"
        ) {

            /*
            * If already running, reveal/focus
            * the existing window first.
            */
            if (
                shortcut.processName
            ) {

                const focused =
                    await focusWindowsApplication(
                        shortcut.processName
                    );


                if (focused) {
                    return;
                }
            }


            const executable =
                resolveExecutable(
                    shortcut.executables ??
                    []
                );


            if (!executable) {

                throw new Error(
                    `${shortcut.label} could not be found.`
                );
            }


            await spawnDetached(
                executable
            );


            return;
        }


        throw new Error(
            `Unsupported shortcut type: ${shortcut.type}`
        );
    }
};
