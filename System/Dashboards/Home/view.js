const today = dv.date("today");
const todayISO = today.toISODate();
// One local-time selection keeps the cover and greeting in sync.
const homePeriod = window.hubGetHomeTimePeriod();


// ---------- DATA ----------

const resourceTypes =
    window.hubGetResourceTypes?.() ?? [];

let projectTasks = [];
let resourceTasks = [];
let recentItems = [];
let progressReports = [];
let completedTaskHistory = [];

function folderPath(path) {
    const index = path.lastIndexOf("/");
    return index === -1
        ? ""
        : path.slice(0, index);
}

let projectCategories = [];
let projectCategoriesById =
    new Map();


function refreshProjectCategories() {

    projectCategories =
        window.hubGetProjectCategories?.()
        ?? [];

    projectCategoriesById =
        new Map(
            projectCategories.map(
                category => [
                    category.id,
                    category
                ]
            )
        );
}


function projectCategory(reference) {

    if (!reference) return null;

    /*
     * Normal new format:
     * project stores category ID.
     */
    const byId =
        projectCategoriesById.get(
            String(reference)
        );

    if (byId) {
        return byId;
    }


    /*
     * Transitional support for projects
     * created while category names were
     * stored directly.
     *
     * This uses the registry itself,
     * not hard-coded legacy categories.
     */
    return projectCategories.find(
        category =>
            category.name ===
            String(reference)
    ) ?? null;
}


refreshProjectCategories();



function homeProjectRecords() {
    if (window.hubGetHomeProjects) return window.hubGetHomeProjects().map(project => ({
        ...project, sourcePath: project.path, sourceRoot: project.root, deleted: false
    }));
    return dv.pages('"Projects"').where(p => p.type === "project").array().map(p => ({
        sourcePath: p.file.path, sourceRoot: folderPath(p.file.path),
        path: p.file.path, root: folderPath(p.file.path), projectId: p.projectId,
        name: p.file.name, status: p.status, categoryId: p.category, deleted: false
    }));
}
const projects = homeProjectRecords();


const savedProjectCardOrder =
    window.hubGetProjectCardOrder?.()
    ?? {};

let projectCardOrder =
    Object.fromEntries(
        [
            "active",
            "future",
            "shelved"
        ].map(status => [
            status,
            Array.isArray(
                savedProjectCardOrder[status]
            )
                ? [
                    ...savedProjectCardOrder[
                        status
                    ]
                ]
                : []
        ])
    );

let projectCardOrderSaveQueue =
    Promise.resolve();

// ---------- HELPERS ----------

const {
    el,
    historyHeading,
    makeActionableRow,
    historyKind,
    createHistoryPager,
    historyDate,
    formatDate,
    formatTime,
    formatDateTime,
    formatWeekday,
    formatDateRange,
    createFrame,
    placeHeatmapNavigation,
    createProgressHeatmap,
    progressColors,
    progressColor,
    lastFileTooltip,
    lastNavigationInfo,
    workspaceButton,
    presetsButton,
    markDashboardRow,
    navButton
} = window.hubCreateDashboardUi({
    navClass: "home-nav-button"
});

async function openHomeInNewTab() {

    if (
        window.hubOpenHome
    ) {

        await window.hubOpenHome(
            root
        );

        return;
    }

    const file =
        app.vault
            .getAbstractFileByPath(
                "Home.md"
            );


    if (file) {

        await app.workspace
            .getLeaf("tab")
            .openFile(
                file
            );
    }
}



function heading(
    parent,
    cls,
    title,
    icon = null
) {
    const heading = parent.createDiv({
        cls
    });

    if (icon) {
        const iconEl = heading.createSpan({
            cls: "home-heading-icon"
        });

        window.hubSetIcon?.(iconEl, icon);
    }

    heading.createSpan({
        text: title
    });

    return heading;
}


function panel(
    parent,
    title,
    cls = "",
    icon = null
) {
    const box = parent.createDiv({
        cls: `home-panel ${cls}`
    });

    heading(
        box,
        "home-panel-title",
        title,
        icon
    );

    return box;
}


async function getSectionItems(path, heading) {
    const file = app.vault.getAbstractFileByPath(path);
    if (!file) return [];

    const content = await app.vault.read(file);
    const lines = content.split("\n");

    const headingIndex = lines.findIndex(
        line => line.trim().toLowerCase() === `## ${heading}`.toLowerCase()
    );

    if (headingIndex === -1) return [];

    const items = [];

    for (let i = headingIndex + 1; i < lines.length; i++) {
        const line = lines[i].trim();

        // Stop at next H2
        if (line.startsWith("## ")) break;

        // Numbered list: 1. Something
        const numbered = line.match(/^\d+\.\s+(.+)/);
        if (numbered && numbered[1].trim()) {
            items.push(numbered[1].trim());
            continue;
        }

        // Bullet list: - Something
        const bullet = line.match(/^[-*]\s+(.+)/);
        if (bullet && bullet[1].trim()) {
            items.push(bullet[1].trim());
        }
    }

    return items;
}



function currentPath(path, owner) {

    // Project hub itself
    if (path === owner.sourcePath) {
        return owner.path;
    }


    // Something inside project folder
    if (
        path.startsWith(
            `${owner.sourceRoot}/`
        )
    ) {
        return (
            owner.root +
            path.slice(
                owner.sourceRoot.length
            )
        );
    }


    return path;
}


function homeTaskLocation(
    path,
    owner
) {

    const ownerName =
        String(owner?.name ?? "")
            .replace(
                /^(Book|MSc Thesis|Novel|Research|Poetry)\s*-\s*/i,
                ""
            );


    const resolvedPath =
        currentPath(
            String(path ?? ""),
            owner
        );


    const isResource =
        owner.contextKind === "resource";


    if (
        resolvedPath === owner.path
    ) {
        return `${ownerName} \u203a ${
            isResource
                ? "Resource Hub"
                : "Project Hub"
        }`;
    }


    const relative =
        resolvedPath.startsWith(
            `${owner.root}/`
        )
            ? resolvedPath
                .slice(
                    owner.root.length + 1
                )
                .replace(/\.md$/i, "")
            : "";


    const route =
        relative
            .split("/")
            .filter(Boolean);


    return [
        ownerName,
        ...(
            route.length > 0
                ? route
                : [
                    isResource
                        ? "Resource Root"
                        : "Project Root"
                ]
        )
    ].join(" \u203a ");
}


async function openFileFromHome(path) {

    const file =
        app.vault
            .getAbstractFileByPath(
                path
            );


    if (!file) {
        return false;
    }


    if (window.hubOpenFile) {

        await window.hubOpenFile(
            path,
            root
        );

        return true;
    }


    await app.workspace
        .getLeaf(false)
        .openFile(file);


    return true;
}

// ---------- ROOT ----------

const frame = createFrame(dv.container, dv.component, "home-dashboard hub-button-scope");
const root = frame.root;
window.hubWatchTooltips?.(root, dv.component);
// ---------- COVER ----------

const coverPath = window.hubGetHomeCover(homePeriod.name).path;

const coverFile = app.vault.getAbstractFileByPath(coverPath);

if (coverFile) {
    const cover = root.createDiv({
        cls: "home-cover"
    });

    const image = cover.createEl("img", {
        cls: "home-cover-image"
    });

    image.src = app.vault.getResourcePath(coverFile);
    image.alt = "";
    window.hubMountHomeCover?.(cover, image, dv.component, homePeriod.name);
}


// ---------- NAVIGATION ----------

const nav = root.createDiv({
    cls: "home-nav"
});

markDashboardRow(
    nav,
    1
);

navButton(
    nav,
    "Home",
    async () => {

        if (
            window.hubOpenHome
        ) {

            await window.hubOpenHome(
                root
            );

            return;
        }

        root.scrollIntoView({
            behavior:
                "smooth"
        });
    },
    true,
    openHomeInNewTab,
    "Go to homepage",
    "home"
);


workspaceButton(nav, root);


const lastFileButton = navButton(
    nav,
    "Last File",
    async () => {

        if (
            window.hubOpenLastFile
        ) {

            await window.hubOpenLastFile(
                root
            );
        }
    },
    false,
    null,
    lastFileTooltip,
    "last-file"
);


presetsButton(nav, dv.component);

// ---------- HEADER ----------

const header = root.createDiv({
    cls: "home-header"
});

markDashboardRow(
    header,
    2
);

const greeting = homePeriod.greeting;

const greetingBox =
    header.createDiv({
        cls:
            "home-title-box"
    });


el(
    greetingBox,
    "h1",
    "home-greeting",
    greeting
);


const homeContext =
    el(
        greetingBox,
        "div",
        "home-context",
        "Loading today..."
    );

let homeTaskCount = null;
let homeCalendarEventCount = null;


function updateHomeContext() {

    if (
        homeTaskCount === null ||
        homeCalendarEventCount === null
    ) {
        return;
    }


    homeContext.setText(
        formatHomeContextSummary(
            homeTaskCount,
            homeCalendarEventCount
        )
    );
}


function formatHomeContextSummary(
    tasks,
    events
) {

    if (tasks === 0) {
        const emptyTaskMessage =
            "Your task list is empty — add something to work on.";

        if (events === 0) {
            return emptyTaskMessage;
        }

        return events === 1
            ? `${emptyTaskMessage} You have 1 calendar event coming up.`
            : `${emptyTaskMessage} You have ${events} calendar events coming up.`;
    }


    const taskMessage =
        tasks === 1
            ? "You have 1 task to do"
            : `You have ${tasks} tasks to do`;


    if (events === 0) {
        return `${taskMessage}.`;
    }


    return events === 1
        ? `${taskMessage} and 1 calendar event coming up.`
        : `${taskMessage} and ${events} calendar events coming up.`;
}

const dateBox = header.createDiv({
    cls: "home-date"
});

el(
    dateBox,
    "div",
    "",
    formatWeekday(today) + ", " + formatDate(today, "full")
);

el(
    dateBox,
    "div",
    "home-week",
    `Week ${today.weekNumber}`
);

const dailyPath = `Daily Notes/${todayISO}.md`;
const savedFocusToday =
    window.hubGetDailyFocus?.(
        todayISO
    );

let focusToday =
    Array.isArray(savedFocusToday)
        ? savedFocusToday
        : [];
frame.defer(async () => {
    await window.hubActivatePendingFocus?.(todayISO);
    const saved = window.hubGetDailyFocus?.(todayISO);
    const focus = Array.isArray(saved) ? saved : await getSectionItems(dailyPath, "Focus");
    if (!frame.current()) return;
    focusToday = focus;
    renderTodayFocus();
});

// ---------- CONTEXT SEARCH ----------
const contextBar = root.createDiv({ cls: "home-context-bar" });
markDashboardRow(contextBar, 3);
window.hubMountContextSearch?.({ component: dv.component, dv, root, toolbar: contextBar });

// ---------- MAIN GRID ----------

const grid = root.createDiv({
    cls: "home-main-grid"
});

// ---------- Today's Focus ----------

const glance = panel(
    grid,
    "Today's Focus",
    "home-glance",
    "goal"
);

markDashboardRow(
    glance,
    4
);


const focusHeader =
    glance.querySelector(
        ".home-panel-title"
    );


const editFocusButton =
    focusHeader.createEl(
        "button",
        {
            cls:
                "home-focus-edit hub-panel-action",

            text:
                "Edit"
        }
    );


editFocusButton.addEventListener(
    "click",
    () => {
        window.hubOpenDailyFocusEditor?.(
            todayISO
        );
    }
);


const focusBody =
    glance.createDiv({
        cls:
            "home-focus-body"
    });


function renderTodayFocus() {

    focusBody.empty();


    if (focusToday.length === 0) {
        el(
            focusBody,
            "div",
            "home-empty",
            "No focus set for today."
        );
        return;
    }


    const focusList =
        focusBody.createDiv({
            cls:
                "home-focus-list"
        });


    for (const item of focusToday) {

        const focusText =
            typeof item === "string"
                ? item
                : item?.text ?? "";

        const projectName =
            typeof item === "object"
                ? item?.projectName
                : null;

        const row =
            focusList.createDiv({
                cls:
                    "home-focus-row"
            });


        el(
            row,
            "span",
            "home-focus-dot",
            "◆"
        );

        const content =
            row.createDiv({
                cls:
                    "home-focus-content"
            });


        el(
            content,
            "div",
            "home-focus-text",
            focusText
        );


        if (projectName) {
            el(
                content,
                "div",
                "home-focus-project",
                displayProjectName(
                    projectName
                )
            );
        }
    }
}


renderTodayFocus();


root.addEventListener(
    "hub-focus-changed",
    event => {

        if (
            event.detail?.date ===
                todayISO
        ) {

            focusToday =
                window.hubGetDailyFocus?.(
                    todayISO
                ) ?? [];


            renderTodayFocus();
        }


        if (
            typeof progressView !==
                "undefined" &&
            progressView === "reports"
        ) {
            renderActiveProgressView();
        }
    }
);



// FOCUS


// ---------- Tasks to Do ----------

const upcoming = panel(
    grid,
    "Tasks",
    "home-upcoming",
    "list-todo"
);

markDashboardRow(
    upcoming,
    4
);

const upcomingHeader =
    upcoming.querySelector(
        ".home-panel-title"
    );


let visibleCompletedTasks = [];
let clearingCompletedTasks = false;

const upcomingBody =
    upcoming.createDiv({
        cls:
            "home-tasks-body"
    });

let homeTaskDisposed = false, homeTaskGeneration = 0, homeTaskStatus = null;
let homeTaskRefreshPending = false, homeTaskCountComplete = false, homeTaskLoading = true;
const homeTaskDocument = upcomingBody.ownerDocument;
function deferHomeTaskInteraction() {
    const interaction = homeTaskRead?.availability ? ".menu, .modal-container form" : ".menu, .modal-container";
    if (!homeTaskDocument.querySelector(interaction)) return false;
    homeTaskRefreshPending = true;
    return true;
}
const resumeHomeTaskRead = () => { void Promise.resolve().then(() => {
    if (homeTaskDisposed || !homeTaskRefreshPending || deferHomeTaskInteraction()) return;
    homeTaskRefreshPending = false;
    if (root.isConnected) void loadTaskData();
}); };
for (const event of ["pointerdown", "click", "keydown", "focusin"]) {
    homeTaskDocument.addEventListener(event, resumeHomeTaskRead);
    dv.component.register(() => homeTaskDocument.removeEventListener(event, resumeHomeTaskRead));
}
const homeTaskRead = window.hubCreateHomeTaskRead?.({
    component: dv.component,
    resolveNativeOwner: owner => owner.type === "resource" ? resourceTypes.find(resource => (resource.resourceType ?? resource.id) === owner.id) : projects.find(project => project.projectId === owner.id),
    resolveOwner: task => {
        const page = { file: { path: task.path }, project: task.homeProjectReference };
        return resourceForPage(page) ?? projectForPage(page);
    },
    changed: () => { queueMicrotask(() => { if (!homeTaskDisposed && root.isConnected) void loadTaskData(); }); }
});
const retainedPresentation = homeTaskRead?.previousPresentation?.() ?? [];
projectTasks = retainedPresentation.filter(item => item.owner.contextKind !== "resource");
resourceTasks = retainedPresentation.filter(item => item.owner.contextKind === "resource");
dv.component.register(() => { homeTaskDisposed = true; homeTaskGeneration++; });
function reconcileHomeTaskEdit(edit) {
    homeTaskGeneration++;
    const items = homeTaskRead.reconcile([...projectTasks, ...resourceTasks], edit);
    if (edit.backend === "native") homeTaskCountComplete = edit.availability === "current";
    projectTasks = items.filter(item => item.owner.contextKind !== "resource");
    resourceTasks = items.filter(item => item.owner.contextKind === "resource");
    if (!homeTaskDisposed && root.isConnected) renderTaskContext();
}
upcomingBody.hubTaskUi = window.hubCreateTaskUi?.(dv.component, upcomingBody, reconcileHomeTaskEdit, homeTaskRead?.actions);
const addTaskButton = upcomingBody.hubTaskUi?.addButton(upcomingHeader);

function renderTasksToDo(
    activeProjectTasks,
    activeResourceTasks = []
) {

    if (upcomingBody.hubTaskUi && !upcomingBody.hubTaskUi.beginRender(() => renderTaskContext())) return;
    const focused = homeTaskDocument.activeElement;
    const focusedRow = focused?.closest(".home-task-row");
    const focusKey = focusedRow?.homeTaskKey;
    const focusIndex = focusedRow ? [...focusedRow.querySelectorAll("button,input,textarea,select,a[href],[tabindex]")].indexOf(focused) : -1;
    const focusedGroup = focused?.classList.contains("hub-task-group-toggle") ? focused.textContent.replace(/^\d+\s*/, "") : null;
    const scrollTop = upcomingBody.scrollTop;
    try {
    upcomingBody.empty();


    /*
     * Stable concatenation supplies the source-order tie-breaker for the
     * shared date-first and Necessity ordering.
     */
    const activeTasks = [
        ...activeProjectTasks,
        ...activeResourceTasks
    ];


    const oathPlan = upcomingBody.hubTaskUi?.partitionOath?.(activeTasks, task => ({ task,
        owner: activeTasks.find(item => item.task.hubTaskId === task.hubTaskId)?.owner ?? window.hubTaskOwner?.(task.path) ?? {} }));
    const ordinaryTasks = oathPlan?.ordinary ?? activeTasks;
    const groups = upcomingBody.hubTaskUi?.groups(ordinaryTasks) ?? window.hubTaskGroups?.(ordinaryTasks);
    const openTasks = groups?.active ?? ordinaryTasks.filter(item => !item.task.completed);
    const futureTasks = groups?.future ?? [];


    const completedTasks =
        ordinaryTasks.filter(item =>
            item.task.completed
        );


    visibleCompletedTasks =
        completedTasks;


    if (
        openTasks.length === 0 &&
        completedTasks.length === 0 && futureTasks.length === 0 && !oathPlan?.oath
    ) {
        el(
            upcomingBody,
            "div",
            "home-empty",
            homeTaskCountComplete ? "No tasks to do." : homeTaskLoading ? "Loading tasks..." : "Tasks are temporarily unavailable."
        );

        return;
    }


    function renderTask(item, completed = false, target = upcomingBody) {

        const {
            task,
            owner
        } = item;


        const { row, checkbox, textEl } = window.hubCreateTaskRow(target, task, completed, { variant: "home" });
        row.homeTaskKey = task.nativeReference ? JSON.stringify([task.nativeReference.authorityId, task.nativeReference.owner, task.nativeReference.taskId]) : task.hubTaskId ?? `${task.path}\0${task.line}`;
        upcomingBody.hubTaskUi?.bind(row, textEl, task, () => task.nativeReference ? "" : currentPath(task.path, owner), task.nativeReference ? { sourceLabel: owner.name, locationWorkspace: null } : {});
        if (task.nativeReference) row.querySelector(".home-task-location")?.setAttribute("aria-disabled", "true");


        if (completed) {

            const deleteButton =
                row.createEl(
                    "button",
                    {
                        cls:
                            "home-task-delete"
                    }
                );


            window.hubSetIcon?.(
                deleteButton,
                "trash-2"
            );


            deleteButton.setAttribute(
                "aria-label",
                `Clear completed task: ${task.text}`
            );


            if (task.nativeReference) { deleteButton.disabled = true; deleteButton.title = "Native clear-completed is unavailable."; }
            deleteButton.addEventListener(
                "click",
                async event => {

                    event.stopPropagation();
                    if (task.nativeReference) return;

                    deleteButton.disabled =
                        true;


                    try {

                        await clearCompletedTaskItems(
                            [item]
                        );

                    } catch (error) {

                        console.error(
                            "Could not clear completed task:",
                            error
                        );

                    } finally {

                        if (
                            deleteButton.isConnected
                        ) {
                            deleteButton.disabled =
                                false;
                        }
                    }
                }
            );
        }


        checkbox.addEventListener(
            "click",
            event => {
                event.stopPropagation();
            }
        );


        checkbox.addEventListener(
            "change",
            async () => {
                if (task.nativeReadOnly || task.nativeLocationUnavailable) { checkbox.checked = !!task.completed; return; }

                checkbox.disabled = true;

                const previousState =
                    task.completed;
                const requestedState = checkbox.checked;

                const path =
                    task.nativeReference ? null : currentPath(
                        task.path,
                        owner
                    );

                try {

                    if (!task.nativeReference && !window.hubToggleTask) {
                        throw new Error(
                            "Task toggle bridge is unavailable."
                        );
                    }

                    const edit = await homeTaskRead.toggle(task, requestedState);
                    reconcileHomeTaskEdit(edit);

                } catch (error) {

                    console.error(
                        "Could not toggle task:",
                        error
                    );

                    task.completed =
                        previousState;

                    checkbox.checked =
                        previousState;

                    checkbox.disabled = false;
                }
            }
        );


        row.addEventListener(
            "click",
            async event => {
                if (task.nativeReference && event.target.closest(".home-task-location")) return;

                const path =
                    task.nativeReference ? null : currentPath(
                        task.path,
                        owner
                    );

                try {
                    if (task.nativeReference) { homeTaskRead.actions.editTask(task, reconcileHomeTaskEdit); return; }
                    const target = await homeTaskRead.reveal(task);
                    await openFileFromHome(target.path);
                } catch (error) { console.error("Could not open task source:", error); }
            }
        );
    }


    if (oathPlan) upcomingBody.hubTaskUi.renderOath(oathPlan, renderTask);

    // Open tasks first

    for (const item of openTasks) {
        renderTask(item, false);
    }


    if (upcomingBody.hubTaskUi?.group) {
        upcomingBody.hubTaskUi.group("future", futureTasks, item => renderTask(item, false));
        upcomingBody.hubTaskUi.group("completed", completedTasks, item => renderTask(item, true), {
            clear: () => clearVisibleCompletedTasks(),
            canClear: () => !clearingCompletedTasks && !completedTasks.some(item => item.task.nativeReference)
        });
        return;
    }

    // Divider only when both groups exist

    if (
        openTasks.length > 0 &&
        completedTasks.length > 0
    ) {
        upcomingBody.createDiv({
            cls: "home-task-divider"
        });
    }


    // Completed tasks underneath

    for (const item of completedTasks) {
        renderTask(item, true);
    }
    } finally {
        upcomingBody.scrollTop = scrollTop;
        if (focusKey && !focused.isConnected) {
            const row = [...upcomingBody.querySelectorAll(".home-task-row")].find(row => row.homeTaskKey === focusKey);
            row?.querySelectorAll("button,input,textarea,select,a[href],[tabindex]")[focusIndex]?.focus({ preventScroll: true });
        } else if (focusedGroup && !focused.isConnected) {
            [...upcomingBody.querySelectorAll(".hub-task-group-toggle")].find(button => button.textContent.replace(/^\d+\s*/, "") === focusedGroup)?.focus({ preventScroll: true });
        }
    }
}


function completedTaskRequest(
    item
) {

    const {
        task,
        owner
    } = item;


    return {
        hubTaskId: task.hubTaskId,
        path:
            currentPath(
                task.path,
                owner
            ),

        line:
            task.line,

        text:
            task.text,

        projectId:
            owner.contextKind === "resource"
                ? null
                : owner.projectId,

        projectName:
            owner.name,

        projectStatus:
            owner.status,

        projectPath:
            owner.path,

        projectRoot:
            owner.root,

        contextKind:
            owner.contextKind ?? "project",

        resourceType:
            owner.contextKind === "resource"
                ? owner.resourceType
                : null
    };
}


async function clearCompletedTaskItems(
    items,
    confirmMany = false
) {

    if (items.some(item => item.task.nativeReference)) throw new Error("Native clear-completed is unavailable.");
    if (!window.hubClearCompletedTasks) {
        throw new Error(
            "Completed-task archive bridge is unavailable."
        );
    }


    return homeTaskRead.clear(
        items.map(
            item => ({ ...item.task, ...completedTaskRequest(item) })
        ),
        confirmMany
    );
}


async function clearVisibleCompletedTasks() {
    if (clearingCompletedTasks || visibleCompletedTasks.length === 0) return;
    clearingCompletedTasks = true;
    try {
        // Keep the former header Clear scope and its native confirmation.
        await clearCompletedTaskItems([...visibleCompletedTasks], true);
    } finally {
        clearingCompletedTasks = false;
    }
}



// ---------- CALENDAR ----------

const calendar = panel(
    grid,
    "Calendar",
    "home-calendar",
    "calendar-days"
);

// Keep the existing grid slots: Calendar | Today's Focus | Tasks to Do.
grid.prepend(calendar);

markDashboardRow(
    calendar,
    4
);


const calendarHeader =
    calendar.querySelector(
        ".home-panel-title"
    );


const calendarTodayButton =
    calendarHeader.createEl(
        "button",
        {
            cls:
                "home-calendar-today hub-panel-action",

            text:
                "Today"
        }
    );


// Each action sizes from the same complete set of intrinsic labels (including
// Task's icon). CSS overlays them; font/theme/zoom changes need no measurement.
const topRowActions = [calendarTodayButton, editFocusButton, addTaskButton].filter(Boolean);
const topRowLabels = topRowActions.map(action => {
    action.classList.add("hub-compact-panel-action");
    const label = document.createElement("span");
    label.className = "hub-compact-panel-action-label";
    label.append(...Array.from(action.childNodes));
    action.append(label);
    return label;
});
for (const action of topRowActions) {
    for (const label of topRowLabels) {
        const sizer = label.cloneNode(true);
        sizer.className = "hub-compact-panel-action-sizer";
        sizer.setAttribute("aria-hidden", "true");
        sizer.setAttribute("inert", "");
        action.append(sizer);
    }
}

calendarTodayButton.setAttribute(
    "aria-label",
    "Return calendar to today"
);


calendarTodayButton.disabled = true;


const gcal =
    app.plugins.plugins[
        "google-calendar-agenda"
    ];


const calendarBody =
    calendar.createDiv({
        cls:
            "home-calendar-body"
    });


calendar.setAttribute(
    "aria-label",
    "Scrollable weekly calendar"
);


let calendarNextWeekStart =
    moment()
        .startOf("isoWeek");


let calendarLoading = false;
let calendarCanLoadMore = true;
let calendarHasPositionedToday = false;

// One clock per rendered Home view, including Dataview replacing a frame on
// the same component. Separate leaves retain their own Calendar and clock.
dv.container.hubCalendarClockDispose?.();
let calendarClock = null;
const disposeCalendarClock = () => {
    clearInterval(calendarClock);
    if (dv.container.hubCalendarClockDispose === disposeCalendarClock) {
        delete dv.container.hubCalendarClockDispose;
    }
};
dv.container.hubCalendarClockDispose = disposeCalendarClock;
dv.component.register(disposeCalendarClock);

const calendarNowRow = calendarBody.ownerDocument.createElement("div");
calendarNowRow.className = "home-calendar-now";
calendarNowRow.setAttribute("role", "separator");
const calendarNowTime = calendarNowRow.createEl("time", { cls: "home-calendar-time" });
calendarNowRow.createSpan({ cls: "home-calendar-now-line", attr: { "aria-hidden": "true" } });

function updateCalendarNow() {
    const now = moment(), date = now.format("YYYY-MM-DD");
    const scrollTop = calendar.scrollTop;
    let todayGroup = null;
    for (const group of calendarBody.querySelectorAll(".home-calendar-day")) {
        const isToday = group.dataset.calendarDate === date;
        group.classList.toggle("is-today", isToday);
        if (isToday) todayGroup = group;
    }
    if (todayGroup) {
        const next = [...todayGroup.querySelectorAll(".home-calendar-row")].find(row =>
            row.dataset.calendarStart && Number(row.dataset.calendarStart) > now.valueOf()
        ) ?? todayGroup.querySelector(".home-calendar-day-empty");
        calendarNowTime.textContent = formatTime(now);
        calendarNowTime.dateTime = now.format();
        calendarNowRow.setAttribute("aria-label", `Current time ${formatTime(now)}`);
        // An ongoing event remains a single entry. All-day rows keep their
        // existing positions; only timed start instants determine insertion.
        if (calendarNowRow.parentElement !== todayGroup || calendarNowRow.nextSibling !== next) {
            todayGroup.insertBefore(calendarNowRow, next);
        }
    } else {
        calendarNowRow.remove();
    }
    // Insertion/removal can trigger browser scroll anchoring. Clock changes
    // never navigate, even when the divider changes day or passes an event.
    calendar.scrollTop = scrollTop;
    updateCalendarTodayButton();
}

async function refreshCalendarNow() {
    if (!frame.current()) return;
    updateCalendarNow();
    // A midnight rollover or wake can put today beyond the loaded weeks.
    // Reuse the existing paged query; never scroll as part of this refresh.
    while (frame.current() && gcal && !calendarLoading && calendarCanLoadMore &&
        calendarNextWeekStart.valueOf() <= moment().valueOf() &&
        !calendarBody.querySelector(".home-calendar-day.is-today")) {
        await loadNextCalendarWeek();
    }
}


function updateCalendarTodayButton() {

    const todayGroup =
        calendarBody.querySelector(
            ".home-calendar-day.is-today .home-calendar-now"
        );


    if (!todayGroup) {
        calendarTodayButton.disabled = true;
        return;
    }


    const calendarRect =
        calendar.getBoundingClientRect();


    const headerRect =
        calendarHeader.getBoundingClientRect();


    const todayRect =
        todayGroup.getBoundingClientRect();


    const visibleTop =
        calendarRect.top +
        headerRect.height;


    calendarTodayButton.disabled =
        todayRect.top >= visibleTop &&
        todayRect.bottom <= calendarRect.bottom;
}


function scrollCalendarToToday(
    behavior = "auto"
) {

    const todayGroup =
        calendarBody.querySelector(
            ".home-calendar-day.is-today .home-calendar-now"
        );


    if (!todayGroup) {
        return;
    }


    const calendarRect =
        calendar.getBoundingClientRect();


    const headerRect =
        calendarHeader.getBoundingClientRect();


    const todayRect =
        todayGroup.getBoundingClientRect();


    const targetTop =
        calendar.scrollTop +
        todayRect.top -
        calendarRect.top -
        headerRect.height -
        4;


    calendar.scrollTo({
        top:
            Math.max(
                0,
                targetTop
            ),

        behavior:
            behavior
    });
}


calendarTodayButton.addEventListener(
    "click",
    () => {
        updateCalendarNow();
        scrollCalendarToToday();
    }
);


function renderCalendarEvent(
    parent,
    event
) {

    const row =
        parent.createDiv({
            cls:
                "home-calendar-row"
        });


    if (!event.allDay) row.dataset.calendarStart = String(event.start.valueOf());

    const time =
        event.allDay
            ? "All day"
            : formatTime(event.start);


    el(
        row,
        "span",
        "home-calendar-time",
        time
    );


    const info =
        row.createDiv({
            cls:
                "home-calendar-info"
        });


    const url =
        event.meetUrl ||
        event.link;

    let linkUrl = null;
    if (typeof url === "string") {
        try { new URL(url); linkUrl = url; } catch {}
    }

    const title =
        info.createEl(
            linkUrl ? "a" : "span",
            {
                cls:
                    "home-calendar-title",

                text:
                    event.title
            }
        );


    if (linkUrl) {
        title.setAttribute("href", linkUrl);
        title.addEventListener(
            "click",
            event => {
                event.preventDefault();
                window.open(
                    url,
                    "_blank"
                );
            }
        );

        title.addClass(
            "is-clickable"
        );
    }


    if (event.location) {
        el(
            info,
            "div",
            "home-calendar-location",
            event.location
        );
    }


    const dot =
        row.createDiv({
            cls:
                "home-calendar-dot"
        });


    if (event.calendarColor) {
        dot.style.backgroundColor =
            event.calendarColor;
    }
}


function renderCalendarWeek(
    weekStart,
    events,
    warnings = []
) {

    const weekEnd =
        weekStart.clone()
            .add(6, "days");


    const week =
        calendarBody.createDiv({
            cls:
                "home-calendar-week"
        });


    const weekHeading =
        week.createDiv({
            cls:
                "home-calendar-week-heading"
        });


    el(
        weekHeading,
        "span",
        "home-calendar-week-number",
        `Week ${weekStart.isoWeek()}`
    );


    el(
        weekHeading,
        "span",
        "home-calendar-week-range",
        formatDateRange(weekStart, weekEnd, true)
    );


    const eventsByDate =
        new Map();


    for (const event of events) {

        const key =
            event.start.format(
                "YYYY-MM-DD"
            );


        if (!eventsByDate.has(key)) {
            eventsByDate.set(
                key,
                []
            );
        }


        eventsByDate.get(key)
            .push(event);
    }


    for (
        let dayOffset = 0;
        dayOffset < 7;
        dayOffset += 1
    ) {

        const day =
            weekStart.clone()
                .add(
                    dayOffset,
                    "days"
                );


        const key =
            day.format(
                "YYYY-MM-DD"
            );


        const dayGroup =
            week.createDiv({
                cls:
                    "home-calendar-day"
            });


        dayGroup.dataset.calendarDate = key;

        const dayHeading =
            dayGroup.createDiv({
                cls:
                    "home-calendar-day-heading"
            });


        el(
            dayHeading,
            "span",
            "home-calendar-weekday",
            formatWeekday(day, true)
        );


        el(
            dayHeading,
            "span",
            "home-calendar-day-date",
            historyDate(day)
        );


        const dayEvents =
            eventsByDate.get(key)
            ?? [];


        if (dayEvents.length === 0) {
            el(
                dayGroup,
                "div",
                "home-calendar-day-empty",
                "No events"
            );
        } else {
            dayEvents
                .sort(
                    (a, b) =>
                        a.start.valueOf() -
                        b.start.valueOf()
                )
                .forEach(event =>
                    renderCalendarEvent(
                        dayGroup,
                        event
                    )
                );
        }
    }


    for (const warning of warnings) {
        el(
            week,
            "div",
            "home-calendar-warning",
            warning
        );
    }


    updateCalendarNow();


    if (
        !calendarHasPositionedToday &&
        week.querySelector(
            ".home-calendar-day.is-today"
        )
    ) {
        calendarHasPositionedToday = true;

        requestAnimationFrame(
            () => {
                if (!frame.current()) return;
                scrollCalendarToToday(
                    "auto"
                );
                updateCalendarTodayButton();
            }
        );
    }
}


async function loadNextCalendarWeek() {

    if (!gcal) {

        homeCalendarEventCount = 0;
        updateHomeContext();


        el(
            calendarBody,
            "div",
            "home-empty",
            "Google Calendar Agenda is not enabled."
        );

        calendarCanLoadMore = false;
        return;
    }


    if (
        calendarLoading ||
        !calendarCanLoadMore
    ) {
        return;
    }


    calendarLoading = true;


    const loading =
        calendarBody.createDiv({
            cls:
                "home-calendar-loading",

            text:
                "Loading next week…"
        });


    try {

        const weekStart =
            calendarNextWeekStart.clone();


        const weekEnd =
            weekStart.clone()
                .add(6, "days");

        const query = {
            from:
                weekStart.clone()
                    .startOf("day"),

            to:
                weekEnd.clone()
                    .endOf("day"),

            view: "agenda",
            group: "none",

            calendars: [],
            excludeCalendars: [],
            accounts: [],
            excludeAccounts: [],

            fields: ["time", "title"],
            columns: ["date", "time", "title"],

            limit: 100,

            hiddenTitles: [],
            allDay: "include",

            hideDeclined: true,
            hideCancelled: true,

            use24HourTime: true,

            dateHeadingFormat: "dddd, D MMMM YYYY",
            tableDateFormat: "DD/MM/YYYY",

            descriptionLength: 0,
            emptyMessage: "Nothing scheduled.",

            refresh: 0,
            showRefreshButton: false
        };


        const result =
            await gcal.runQuery(query);
        if (!frame.current()) return;


        const events =
            result.events ?? [];


        /*
        * The first loaded week contains today.
        * Use it to update the Home summary.
        */
        const calendarTodayISO = moment().format("YYYY-MM-DD");
        if (
            calendarTodayISO >=
                weekStart.format("YYYY-MM-DD") &&
            calendarTodayISO <=
                weekEnd.format("YYYY-MM-DD")
        ) {

            const now =
                moment();


            homeCalendarEventCount =
                events.filter(event => {

                    if (
                        event.start.format(
                            "YYYY-MM-DD"
                        ) !== calendarTodayISO
                    ) {
                        return false;
                    }


                    /*
                    * All-day events count throughout
                    * the day.
                    */
                    if (event.allDay) {
                        return true;
                    }


                    /*
                    * Count an event until it ends.
                    * Fall back to its start time if
                    * no end time is available.
                    */
                    const end =
                        event.end ??
                        event.start;


                    return (
                        end.valueOf() >=
                        now.valueOf()
                    );
                }).length;


            updateHomeContext();
        }


        renderCalendarWeek(
            weekStart,
            events,
            result.warnings ?? []
        );


        calendarNextWeekStart =
            weekStart.clone()
                .add(7, "days");

    } catch (error) {

        console.error(
            "Home calendar error:",
            error
        );


        const message =
            error instanceof Error
                ? error.message
                : String(error);


        el(
            calendarBody,
            "div",
            "home-empty",
            `Could not load calendar: ${message}`
        );


        calendarCanLoadMore = false;

    } finally {

        loading.remove();
        calendarLoading = false;
    }
}


calendar.addEventListener(
    "scroll",
    () => {

        updateCalendarTodayButton();

        const distanceFromBottom =
            calendar.scrollHeight -
            calendar.scrollTop -
            calendar.clientHeight;


        if (distanceFromBottom <= 72) {
            loadNextCalendarWeek();
        }
    },
    {
        passive:
            true
    }
);


frame.defer(() => {
    void loadNextCalendarWeek().then(() => refreshCalendarNow());
    calendarClock = setInterval(() => { void refreshCalendarNow(); }, 60000);
});
// ---------- PROJECTS ----------

const projectPanel = grid.createDiv({
    cls: "home-panel home-projects"
});

markDashboardRow(
    projectPanel,
    5
);

function projectFromReference(reference) {
    if (!reference) return null;

    const raw =
        reference.path ??
        String(reference);

    const clean = raw
        .replace(/^\[\[/, "")
        .replace(/\]\]$/, "")
        .split("|")[0]
        .replace(/\.md$/, "")
        .trim();

    return projects.find(project => {

        return (
            project.name === clean ||
            [project.path, project.sourcePath].some(path => {
                const projectPath = path.replace(/\.md$/, "");
                return projectPath === clean || projectPath.endsWith(`/${clean}`);
            })
        );
    }) ?? null;
}


function projectForPage(page) {
    if (!page?.file?.path) return null;

    // Explicit project property wins.
    const explicit =
        projectFromReference(page.project);

    if (explicit) {
        return explicit;
    }


    // Otherwise infer from project folder.
    return projects.find(project =>
        page.file.path === project.path ||
        page.file.path.startsWith(
            `${project.root}/`
        )
    ) ?? null;
}


function resourceForPage(page) {

    if (!page?.file?.path) {
        return null;
    }


    const resource =
        resourceTypes.find(item =>
            page.file.path === item.path ||
            page.file.path.startsWith(
                `${item.root}/`
            )
        );


    if (!resource) {
        return null;
    }


    return {
        sourcePath: resource.path,
        sourceRoot: resource.root,

        path: resource.path,
        root: resource.root,

        projectId: null,
        name: resource.label ?? resource.name,
        status: null,

        contextKind: "resource",
        resourceType: resource.id
    };
}


function isActiveProject(project) {
    return (
        project &&
        !project.deleted &&
        project.status === "active"
    );
}

// ---------- PROJECT TABS ----------

const projectTabs = projectPanel.createDiv({
    cls: "home-project-tabs"
});

heading(
    projectTabs,
    "home-project-heading",
    "Projects",
    "folder-kanban"
);

const projectTabButtons = projectTabs.createDiv({
    cls: "home-project-tab-buttons"
});
const projectStatusSelectors = projectTabButtons.createDiv({ cls: 'hub-panel-selectors' });
projectStatusSelectors.setAttribute('role', 'group');
projectStatusSelectors.setAttribute('aria-label', 'Project status');

const projectRail = projectPanel.createDiv({
    cls: "home-project-rail"
});

const projectGrid = projectRail.createDiv({
    cls: "home-project-grid"
});

const projectOverflowLeft = projectRail.createDiv({
    cls:
        "home-project-overflow-indicator is-left"
});

const projectOverflowRight = projectRail.createDiv({
    cls:
        "home-project-overflow-indicator is-right"
});

window.hubSetIcon?.(
    projectOverflowLeft,
    "chevron-left"
);

window.hubSetIcon?.(
    projectOverflowRight,
    "chevron-right"
);

projectOverflowLeft.setAttribute(
    "aria-hidden",
    "true"
);

projectOverflowRight.setAttribute(
    "aria-hidden",
    "true"
);

// Keep Home usable if Dataview reloads this view before the plugin is reloaded.
const renderCardImage = window.hubCreateCardImageRenderer?.(root, dv.component)
    ?? ((element, url) => {
        element.style.backgroundImage = `url(${JSON.stringify(url)})`;
    });

const resourceSection = projectPanel.createDiv({
    cls: "home-resource-section"
});

heading(
    resourceSection,
    "home-resource-heading",
    "Resources",
    "landmark"
);

const resourceGrid = resourceSection.createDiv({
    cls: "home-resource-grid"
});

const workspaceCards = window.hubCreateWorkspaceCards(root, dv.component, renderCardImage, () => projectCategories);
for (const resource of resourceTypes) {
    workspaceCards.render(resourceGrid, resource, async () => {
        await window.hubOpenResourceFull(resource.id, root);
    });
}


const projectViews = [
    {
        label: "Active",
        status: "active"
    },
    {
        label: "Future",
        status: "future"
    },
    {
        label: "Shelved",
        status: "shelved"
    }
];

const projectViewButtons = new Map();


function renderProjectTabCounts() {

    for (const view of projectViews) {

        const button =
            projectViewButtons.get(view.status);

        if (!button) continue;


        const count = projects.filter(project =>
            !project.deleted &&
            project.status === view.status
        ).length;


        button.textContent =
            `${view.label} (${count})`;
    }
}

// ---------- RENDER PROJECTS ----------

let currentProjectStatus = "active";
const suppressedProjectCardClicks =
    new WeakSet();


function projectCardKey(
    project
) {

    return String(
        project.projectId ||
        project.path
    );
}


function sameProjectCardOrder(
    first,
    second
) {

    return (
        first.length === second.length &&
        first.every(
            (value, index) =>
                value === second[index]
        )
    );
}


function mergeVisibleProjectCardOrder(
    status,
    visibleProjectIds
) {

    const saved =
        projectCardOrder[status] ?? [];

    const visibleSet =
        new Set(visibleProjectIds);

    const remaining =
        [...visibleProjectIds];

    const merged =
        saved.map(projectId =>
            visibleSet.has(projectId)
                ? remaining.shift()
                : projectId
        );


    return [
        ...merged,
        ...remaining
    ];
}


function rememberProjectCardOrder(
    status,
    projectIds
) {

    const normalized =
        [...new Set(projectIds)];


    if (
        sameProjectCardOrder(
            projectCardOrder[status] ?? [],
            normalized
        )
    ) {
        return;
    }


    projectCardOrder = {
        ...projectCardOrder,
        [status]: normalized
    };


    if (!window.hubSetProjectCardOrder) {
        return;
    }


    projectCardOrderSaveQueue =
        projectCardOrderSaveQueue
            .then(
                () =>
                    window.hubSetProjectCardOrder(
                        status,
                        [...normalized]
                    )
            )
            .catch(error => {
                console.error(
                    "Could not save project card order:",
                    error
                );
            });
}

function renderProjects(status) {
    currentProjectStatus = status;

    projectGrid.empty();

    const visibleProjects =
        projects.filter(project =>
            !project.deleted &&
            project.status === status
        );

    const savedOrder =
        projectCardOrder[status] ?? [];

    const savedPositions =
        new Map(
            savedOrder.map(
                (projectId, index) => [
                    projectId,
                    index
                ]
            )
        );


    visibleProjects.sort((a, b) => {

        const aPosition =
            savedPositions.get(
                projectCardKey(a)
            );

        const bPosition =
            savedPositions.get(
                projectCardKey(b)
            );


        if (
            aPosition === undefined &&
            bPosition === undefined
        ) {
            return 0;
        }


        if (aPosition === undefined) {
            return 1;
        }


        if (bPosition === undefined) {
            return -1;
        }


        return aPosition - bPosition;
    });


    const visibleProjectIds =
        visibleProjects.map(
            projectCardKey
        );


    rememberProjectCardOrder(
        status,
        [
            ...savedOrder,
            ...visibleProjectIds.filter(
                projectId =>
                    !savedPositions.has(
                        projectId
                    )
            )
        ]
    );

    if (visibleProjects.length === 0) {
        projectGrid.scrollLeft = 0;

        el(
            projectGrid,
            "div",
            "home-empty",
            "No projects here."
        );

        requestAnimationFrame(
            updateProjectOverflowIndicators
        );

        return;
    }

    for (const project of visibleProjects) {

        const card = workspaceCards.render(projectGrid, project);

        // Open project

        card.addEventListener("click", async event => {

            if (
                suppressedProjectCardClicks.has(
                    card
                )
            ) {
                event.preventDefault();
                return;
            }

            const path =
                card.dataset.projectPath;


            if (
                window.hubOpenProjectFull
            ) {

                await window
                    .hubOpenProjectFull(
                        path,
                        root
                    );

                return;
            }


            const file =
                app.vault
                    .getAbstractFileByPath(
                        path
                    );

            if (file) {
                await app.workspace
                    .getLeaf(false)
                    .openFile(file);
            }
        });


    }

    requestAnimationFrame(
        updateProjectOverflowIndicators
    );
}


// ---------- PROJECT EDGE SCROLL ----------

const PROJECT_EDGE_SCROLL_ZONE =
    96;

const PROJECT_EDGE_SCROLL_MAX_SPEED =
    16;

let projectEdgeScrollTarget =
    0;

let projectEdgeScrollVelocity =
    0;

let projectEdgeScrollFrame =
    null;

let projectEdgeScrollTimestamp =
    null;


function updateProjectOverflowIndicators() {

    const maxScroll =
        Math.max(
            0,
            projectGrid.scrollWidth -
                projectGrid.clientWidth
        );

    const hasOverflow =
        maxScroll > 1;


    projectOverflowLeft.toggleClass(
        "is-visible",
        hasOverflow &&
            projectGrid.scrollLeft > 1
    );

    projectOverflowRight.toggleClass(
        "is-visible",
        hasOverflow &&
            projectGrid.scrollLeft <
                maxScroll - 1
    );
}


projectGrid.addEventListener(
    "scroll",
    updateProjectOverflowIndicators,
    {
        passive: true
    }
);


if (typeof ResizeObserver !== "undefined") {
    const projectRailResizeObserver =
        new ResizeObserver(() => {
            if (!root.isConnected) {
                projectRailResizeObserver.disconnect();
                return;
            }

            updateProjectOverflowIndicators();
        });

    projectRailResizeObserver.observe(
        projectGrid
    );
}


function animateProjectEdgeScroll(
    timestamp
) {

    if (!root.isConnected || projectGrid.querySelector(".is-placement-editing")) {
        projectEdgeScrollFrame = null;
        projectEdgeScrollTimestamp = null;
        projectEdgeScrollTarget = 0;
        projectEdgeScrollVelocity = 0;
        return;
    }


    const elapsed =
        Math.min(
            32,
            Math.max(
                0,
                projectEdgeScrollTimestamp === null
                    ? 16.67
                    : timestamp - projectEdgeScrollTimestamp
            )
        );


    projectEdgeScrollTimestamp =
        timestamp;


    const smoothing =
        1 - Math.exp(-elapsed / 85);


    projectEdgeScrollVelocity +=
        (
            projectEdgeScrollTarget -
            projectEdgeScrollVelocity
        ) * smoothing;


    const maxScroll =
        Math.max(
            0,
            projectGrid.scrollWidth -
                projectGrid.clientWidth
        );


    if (maxScroll <= 0) {
        projectEdgeScrollTarget = 0;
        projectEdgeScrollVelocity = 0;
    } else {
        const nextScroll =
            Math.max(
                0,
                Math.min(
                    maxScroll,
                    projectGrid.scrollLeft +
                        projectEdgeScrollVelocity *
                        elapsed / 16.67
                )
            );


        projectGrid.scrollLeft =
            nextScroll;


        const pushingPastStart =
            nextScroll <= 0 &&
            projectEdgeScrollVelocity < 0;


        const pushingPastEnd =
            nextScroll >= maxScroll &&
            projectEdgeScrollVelocity > 0;


        if (
            pushingPastStart ||
            pushingPastEnd
        ) {
            projectEdgeScrollTarget = 0;
            projectEdgeScrollVelocity = 0;
        }
    }


    if (
        Math.abs(projectEdgeScrollTarget) > 0.01 ||
        Math.abs(projectEdgeScrollVelocity) > 0.03
    ) {
        projectEdgeScrollFrame =
            requestAnimationFrame(
                animateProjectEdgeScroll
            );
        return;
    }


    projectEdgeScrollFrame = null;
    projectEdgeScrollTimestamp = null;
    projectEdgeScrollVelocity = 0;
}


function setProjectEdgeScrollTarget(
    target
) {

    projectEdgeScrollTarget =
        target;


    if (
        projectEdgeScrollFrame === null &&
        (
            Math.abs(projectEdgeScrollTarget) > 0.01 ||
            Math.abs(projectEdgeScrollVelocity) > 0.03
        )
    ) {
        projectEdgeScrollFrame =
            requestAnimationFrame(
                animateProjectEdgeScroll
            );
    }
}


projectGrid.addEventListener(
    "pointermove",
    event => {

        if (
            (
                event.pointerType &&
                event.pointerType !== "mouse"
            ) ||
            projectGrid.hasClass(
                "is-reordering"
            )
        ) {
            setProjectEdgeScrollTarget(0);
            return;
        }


        const maxScroll =
            projectGrid.scrollWidth -
            projectGrid.clientWidth;


        if (maxScroll <= 0) {
            setProjectEdgeScrollTarget(0);
            return;
        }


        const rect =
            projectGrid.getBoundingClientRect();


        const zone =
            Math.min(
                PROJECT_EDGE_SCROLL_ZONE,
                rect.width * 0.22
            );


        const fromLeft =
            event.clientX - rect.left;


        const fromRight =
            rect.right - event.clientX;


        let target = 0;


        if (
            fromLeft >= 0 &&
            fromLeft < zone
        ) {
            const proximity =
                1 - fromLeft / zone;

            target =
                -PROJECT_EDGE_SCROLL_MAX_SPEED *
                proximity * proximity;

        } else if (
            fromRight >= 0 &&
            fromRight < zone
        ) {
            const proximity =
                1 - fromRight / zone;

            target =
                PROJECT_EDGE_SCROLL_MAX_SPEED *
                proximity * proximity;
        }


        setProjectEdgeScrollTarget(
            target
        );
    }
);


projectGrid.addEventListener(
    "pointerleave",
    () => {
        setProjectEdgeScrollTarget(0);
    }
);


const projectCardSwapAnimations =
    new WeakMap();


function projectCardsInVisualOrder() {

    return [
        ...projectGrid.querySelectorAll(
            ":scope > .home-project-card"
        )
    ];
}


function positionDraggedProjectCard(
    state,
    event
) {

    const desiredLeft =
        state.initialRect.left +
        event.clientX -
        state.startX;

    const desiredTop =
        state.initialRect.top +
        event.clientY -
        state.startY;

    if (state.ghost) {
        state.ghost.style.left = `${desiredLeft}px`;
        state.ghost.style.top = `${desiredTop}px`;
        return;
    }

    state.card.style.translate =
        "none";


    const baseRect =
        state.card
            .getBoundingClientRect();


    state.card.style.translate =
        `${desiredLeft - baseRect.left}px ${
            desiredTop - baseRect.top
        }px`;
}


function projectDropIsValid(state, event) {
    const row = projectGrid.getBoundingClientRect();
    // One card-height above/below the row; no hit-testing against other cards.
    const verticalMargin = state.initialRect.height;
    const horizontalMargin = Math.min(80, state.initialRect.width / 2);
    return event.clientY >= row.top - verticalMargin &&
        event.clientY <= row.bottom + verticalMargin &&
        event.clientX >= row.left - horizontalMargin &&
        event.clientX <= row.right + horizontalMargin;
}

function updateProjectInsertion(state, event) {
    const valid = projectDropIsValid(state, event);
    state.card.classList.toggle("is-invalid-drop", !valid);
    if (!valid) return;
    const row = projectGrid.getBoundingClientRect();
    const center = state.initialRect.left + event.clientX - state.startX +
        state.initialRect.width / 2 - row.left + projectGrid.scrollLeft;
    const slots = state.slotCenters;
    let index = state.targetIndex;
    const tolerance = Math.min(8, state.initialRect.width * 0.025);
    while (index < slots.length - 1 &&
        center > (slots[index] + slots[index + 1]) / 2 + tolerance) index++;
    while (index > 0 &&
        center < (slots[index - 1] + slots[index]) / 2 - tolerance) index--;
    if (index === state.targetIndex) return;
    state.targetIndex = index;
    insertProjectCard(state, projectCardsInVisualOrder()[index], event);
}

function insertProjectCard(
    state,
    target,
    event
) {

    const cards =
        projectCardsInVisualOrder();

    const draggedIndex =
        cards.indexOf(state.card);

    const targetIndex =
        cards.indexOf(target);


    if (
        draggedIndex === -1 ||
        targetIndex === -1 ||
        draggedIndex === targetIndex
    ) {
        return;
    }


    const before =
        new Map(
            cards
                .filter(
                    card =>
                        card !== state.card
                )
                .map(card => [
                    card,
                    card.getBoundingClientRect()
                ])
        );


    for (const card of cards) {
        projectCardSwapAnimations
            .get(card)
            ?.cancel();
    }


    cards.splice(draggedIndex, 1);
    cards.splice(targetIndex, 0, state.card);


    for (const card of cards) {
        projectGrid.appendChild(card);
    }


    positionDraggedProjectCard(
        state,
        event
    );


    for (const card of cards) {

        if (
            card === state.card ||
            !card.animate
        ) {
            continue;
        }


        const previousRect =
            before.get(card);

        const currentRect =
            card.getBoundingClientRect();

        const deltaX =
            previousRect.left -
            currentRect.left;

        const deltaY =
            previousRect.top -
            currentRect.top;


        if (
            Math.abs(deltaX) < 0.5 &&
            Math.abs(deltaY) < 0.5
        ) {
            continue;
        }


        const animation =
            card.animate(
                [
                    {
                        translate:
                            `${deltaX}px ${deltaY}px`
                    },
                    {
                        translate:
                            "0px 0px"
                    }
                ],
                {
                    duration: 180,
                    easing:
                        "cubic-bezier(0.2, 0.8, 0.2, 1)"
                }
            );


        projectCardSwapAnimations.set(
            card,
            animation
        );


        animation.finished
            .catch(() => {})
            .finally(() => {

                if (
                    projectCardSwapAnimations
                        .get(card) ===
                        animation
                ) {
                    projectCardSwapAnimations
                        .delete(card);
                }
            });
    }
}


let cancelProjectCardDrag = null;
dv.component.register(() => cancelProjectCardDrag?.());

projectGrid.addEventListener(
    "pointerdown",
    event => {

        if (
            event.button !== 0 ||
            (
                event.pointerType &&
                event.pointerType !== "mouse"
            )
        ) {
            return;
        }


        const card =
            event.target.closest(
                ".home-project-card"
            );


        if (
            !card ||
            card.parentElement !== projectGrid
        ) {
            return;
        }


        cancelProjectCardDrag?.();
        const state = {
            card,
            pointerId:
                event.pointerId,
            startX:
                event.clientX,
            startY:
                event.clientY,
            initialRect:
                card.getBoundingClientRect(),
            status:
                currentProjectStatus,
            dragging:
                false,
            originalOrder: projectCardsInVisualOrder(),
            finished:
                false
        };


        const move = moveEvent => {

            if (
                moveEvent.pointerId !==
                state.pointerId
            ) {
                return;
            }


            const distance =
                Math.hypot(
                    moveEvent.clientX -
                        state.startX,
                    moveEvent.clientY -
                        state.startY
                );


            if (
                !state.dragging &&
                distance < 7
            ) {
                return;
            }


            if (!state.dragging) {
                state.dragging = true;
                state.ghost = card.cloneNode(true);
                state.ghost.addClass("is-dragging");
                Object.assign(state.ghost.style, {
                    position: "fixed", width: `${state.initialRect.width}px`,
                    height: `${state.initialRect.height}px`, minWidth: "0",
                    left: `${state.initialRect.left}px`, top: `${state.initialRect.top}px`,
                    zIndex: "10000", pointerEvents: "none", margin: "0"
                });
                card.ownerDocument.body.appendChild(state.ghost);
                card.addClass("is-drop-placeholder");
                const rowRect = projectGrid.getBoundingClientRect();
                state.slotCenters = state.originalOrder.map(item => {
                    const rect = item.getBoundingClientRect();
                    return (rect.left + rect.right) / 2 - rowRect.left + projectGrid.scrollLeft;
                });
                state.targetIndex = state.originalOrder.indexOf(card);
                projectGrid.addClass(
                    "is-reordering"
                );

                projectGrid.setPointerCapture(
                    state.pointerId
                );
            }


            moveEvent.preventDefault();


            positionDraggedProjectCard(
                state,
                moveEvent
            );


            updateProjectInsertion(state, moveEvent);
        };


        const finish = finishEvent => {

            if (
                state.finished ||
                finishEvent.pointerId !==
                state.pointerId
            ) {
                return;
            }


            const validDrop = state.dragging && finishEvent.type === "pointerup" &&
                projectDropIsValid(state, finishEvent);
            if (validDrop) updateProjectInsertion(state, finishEvent);
            state.finished = true;
            cancelProjectCardDrag = null;


            window.removeEventListener(
                "pointermove",
                move,
                true
            );
            window.removeEventListener(
                "pointerup",
                finish,
                true
            );
            window.removeEventListener(
                "pointercancel",
                finish,
                true
            );
            window.removeEventListener(
                "blur",
                finishFromBlur
            );
            window.removeEventListener("keydown", cancelFromKey, true);


            card.style.pointerEvents =
                "";


            if (
                projectGrid.hasPointerCapture(
                    state.pointerId
                )
            ) {
                projectGrid.releasePointerCapture(
                    state.pointerId
                );
            }


            if (!state.dragging) {
                return;
            }


            for (
                const projectCard
                of projectCardsInVisualOrder()
            ) {
                projectCardSwapAnimations
                    .get(projectCard)
                    ?.cancel();
                projectCardSwapAnimations
                    .delete(projectCard);
            }


            const releaseTranslate =
                card.style.translate;

            if (!validDrop) {
                for (const item of state.originalOrder) {
                    if (item.parentElement === projectGrid) projectGrid.appendChild(item);
                }
            }
            state.ghost?.remove();
            card.removeClass("is-drop-placeholder");
            card.removeClass("is-invalid-drop");
            card.style.visibility = "";
            card.style.translate = "";
            card.removeClass(
                "is-dragging"
            );
            projectGrid.removeClass(
                "is-reordering"
            );


            if (
                releaseTranslate &&
                card.animate
            ) {
                const releaseAnimation =
                    card.animate(
                        [
                            {
                                translate:
                                    releaseTranslate
                            },
                            {
                                translate:
                                    "0px 0px"
                            }
                        ],
                        {
                            duration: 150,
                            easing:
                                "cubic-bezier(0.2, 0.8, 0.2, 1)"
                        }
                    );


                releaseAnimation.finished
                    .catch(() => {})
                    .finally(() => {
                        releaseAnimation.cancel();
                    });
            }


            suppressedProjectCardClicks.add(
                card
            );

            setTimeout(
                () => {
                    suppressedProjectCardClicks
                        .delete(card);
                },
                350
            );


            if (!validDrop || state.originalOrder.every((item, index) =>
                projectCardsInVisualOrder()[index] === item)) return;

            rememberProjectCardOrder(
                state.status,
                mergeVisibleProjectCardOrder(
                    state.status,
                    projectCardsInVisualOrder()
                        .map(
                            projectCard =>
                                projectCard.dataset
                                    .projectId
                        )
                )
            );
        };


        const finishFromBlur =
            () => {
                finish({
                    pointerId:
                        state.pointerId
                });
            };

        const cancelFromKey = event => {
            if (event.key === "Escape") {
                event.preventDefault();
                finishFromBlur();
            }
        };
        window.addEventListener("keydown", cancelFromKey, true);
        cancelProjectCardDrag = finishFromBlur;

        window.addEventListener(
            "pointermove",
            move,
            {
                capture: true,
                passive: false
            }
        );
        window.addEventListener(
            "pointerup",
            finish,
            true
        );
        window.addEventListener(
            "pointercancel",
            finish,
            true
        );
        window.addEventListener(
            "blur",
            finishFromBlur
        );
    }
);

root.addEventListener("hub-project-status", event => {
    const { path, status } = event.detail;

    const project = projects.find(
        project => project.path === path
    );

    if (!project) return;

    project.status = status;

    renderProjects(currentProjectStatus);
    renderProjectTabCounts();
    renderActiveContext();
});

root.addEventListener("hub-project-delete", event => {
    const { path, deleted } = event.detail;

    const project = projects.find(
        project => project.path === path
    );

    if (!project) return;

    project.deleted = deleted;

    renderProjects(currentProjectStatus);
    renderProjectTabCounts();
    renderActiveContext();
});

root.addEventListener("hub-project-rename", event => {
    const {
        oldPath,
        newPath,
        name
    } = event.detail;

    const project = projects.find(
        project => project.path === oldPath
    );

    if (!project) return;

    project.path = newPath;
    project.root = folderPath(newPath);
    project.name = name;

    renderActiveContext();
});


root.addEventListener(
    "hub-project-created",
    event => {

        const {
            path,
            projectId,
            name,
            status,
            categoryId
        } = event.detail;


        const rootPath =
            folderPath(path);

        refreshProjectCategories();

        projects.push({
            sourcePath: path,
            sourceRoot: rootPath,

            path,
            root: rootPath,

            projectId,

            name,
            status,
            categoryId,

            deleted: false
        });


        renderProjects(currentProjectStatus);
        renderProjectTabCounts();
        renderActiveContext();
    }
);

// --------- CATEGORY ------------

root.addEventListener(
    "hub-project-category",
    event => {

        const {
            path,
            categoryId
        } = event.detail;


        const project =
            projects.find(
                project =>
                    project.path === path
            );

        if (!project) return;


        project.categoryId =
            categoryId;


        refreshProjectCategories();

        renderProjects(
            currentProjectStatus
        );
    }
);

root.addEventListener(
    "hub-categories-changed",
    event => {

        const {
            id,
            oldName
        } =
            event.detail ?? {};


        /*
         * Keep currently loaded Home
         * state synchronized while old
         * name-based projects migrate.
         */
        if (id && oldName) {

            for (
                const project
                of projects
            ) {
                if (
                    project.categoryId ===
                    oldName
                ) {
                    project.categoryId =
                        id;
                }
            }
        }


        refreshProjectCategories();

        renderProjects(
            currentProjectStatus
        );
    }
);

// ---------- TAB BUTTONS ----------

for (const view of projectViews) {

    const button = projectStatusSelectors.createEl("button", {
        cls: "home-project-tab home-project-status-tab",
        text: view.label
    });

    projectViewButtons.set(
        view.status,
        button
    );

    button.addEventListener("click", () => {

        projectTabButtons
            .querySelectorAll("button.home-project-status-tab")
            .forEach(tab =>
                tab.classList.remove("is-active")
            );

        button.classList.add("is-active");

        renderProjects(view.status);
    });

    if (view.status === "active") {
        button.classList.add("is-active");
    }
}

renderProjectTabCounts();

const newProjectButton =
    projectTabButtons.createEl(
        "button",
        {
            cls: "home-project-create hub-panel-action hub-panel-action-icon hub-panel-add"
        }
    );

const newProjectIcon =
    newProjectButton.createSpan({
        cls: "home-project-create-icon"
    });

window.hubSetIcon?.(
    newProjectIcon,
    "plus"
);

newProjectButton.setAttribute(
    "aria-label",
    "New project"
);

newProjectButton.addEventListener(
    "click",
    () => {

        if (!window.hubOpenProjectWizard) {
            console.error(
                "Project wizard is unavailable."
            );
            return;
        }

        window.hubOpenProjectWizard(
            root,
            currentProjectStatus
        );
    }
);

renderProjects("active");

// RECENT ACTIVITY

const recent = panel(
    grid,
    "Progress",
    "home-recent",
    "rocket"
);

markDashboardRow(
    recent,
    5
);

// ---------- PROGRESS OVERVIEW ---------- 

// Progress colors are shared with Project and Resource Workspaces.


let workRatings = {};


let workContributors = {};


const PROGRESS_SCOPE_STORAGE_KEY =
    "obsidian-hub::home-progress-scope";


const savedProgressScope =
    sessionStorage.getItem(
        PROGRESS_SCOPE_STORAGE_KEY
    );


let progressScope =
    [
        "projects",
        "resources"
    ].includes(savedProgressScope)
        ? savedProgressScope
        : "projects";


function getScopedProgressReports() {
    return window.hubGetProgressReports?.(
        progressScope === "resources"
            ? {
                kind: "resource"
            }
            : null
    ) ?? [];
}


function refreshWorkProgress() {

    const progress =
        window.hubGetWorkProgress?.(
            progressScope
        )
        ?? {
            ratings: {},
            contributors: {}
        };


    workRatings =
        progress.ratings
        ?? {};


    workContributors =
        progress.contributors
        ?? {};
}



const currentProgressYear =
    today.year;


const MIN_PROGRESS_YEAR =
    1900;


let progressYears = [];


let progressYear =
    currentProgressYear;


function refreshProgressYears() {

    const ratedYears =
        Object.keys(workRatings)
            .filter(date =>
                /^\d{4}-\d{2}-\d{2}$/
                    .test(date)
            )
            .map(date =>
                Number(
                    date.slice(0, 4)
                )
            );


    const earliestProgressYear = Math.min(
        currentProgressYear, progressYear, ...ratedYears
    );


    progressYears =
        Array.from(
            {
                length:
                    currentProgressYear -
                    earliestProgressYear +
                    1
            },
            (_, index) =>
                earliestProgressYear +
                index
        );
}





const progressSection =
    recent.createDiv({
        cls:
            "home-progress-section"
    });


const progressHeader =
    recent.querySelector(
        ".home-panel-title"
    );


const progressHeaderControls = progressHeader.createDiv({ cls: 'home-progress-header-controls' });
const progressScopeControls = progressHeaderControls.createDiv({ cls: 'home-progress-scope-controls hub-panel-selectors' });
progressScopeControls.setAttribute('role', 'group');
progressScopeControls.setAttribute('aria-label', 'Progress view');
for (const [scope, label] of [['projects', 'Projects'], ['resources', 'Resources']]) {
    const button = progressScopeControls.createEl('button', { text: label, attr: { type: 'button' } });
    button.dataset.scope = scope;
    button.addEventListener('click', () => setProgressScope(scope));
}
function updateProgressScopeButtons() {
    for (const button of progressScopeControls.children) {
        const active = button.dataset.scope === progressScope;
        button.classList.toggle('is-active', active);
        button.setAttribute('aria-pressed', String(active));
    }
}
updateProgressScopeButtons();

const statisticsButton = progressHeaderControls.createEl('button', {
    cls: 'hub-panel-action hub-panel-action-icon hub-statistics-trigger',
    attr: { type: 'button', 'aria-label': 'Open Statistics', title: 'Statistics' }
});
window.hubSetIcon?.(statisticsButton, 'chart-no-axes-column');
statisticsButton.addEventListener('click', () => window.hubOpenStatistics?.());

const progressToolbar = root.ownerDocument.createElement("div");


const previousYear =
    progressToolbar.createEl(
        "button",
        {
            cls:
                "home-progress-nav"
        }
    );

window.hubSetIcon?.(
    previousYear,
    "chevron-left"
);


const progressYearLabel =
    progressToolbar.createDiv({
        cls:
            "home-progress-year"
    });


const nextYear =
    progressToolbar.createEl(
        "button",
        {
            cls:
                "home-progress-nav"
        }
    );

window.hubSetIcon?.(
    nextYear,
    "chevron-right"
);

const progressCalendar =
    progressSection.createDiv({
        cls:
            "home-progress-calendar"
    });

const layoutProgressHeatmap = createProgressHeatmap(progressCalendar, dv.component);

function renderProgressYear() {

    progressCalendar.empty();


    progressYearLabel.setText(
        String(progressYear)
    );


    const yearIndex =
        progressYears.indexOf(
            progressYear
        );


    previousYear.disabled =
        progressYear <=
            MIN_PROGRESS_YEAR;


    nextYear.disabled =
        yearIndex === -1 ||
        yearIndex >=
            progressYears.length - 1;


    const yearRatings =
        Object.entries(
            workRatings
        )
            .filter(
                ([date]) =>
                    Number(
                        date.slice(0, 4)
                    ) ===
                    progressYear
            )
            .map(
                ([date, score]) => ({
                    date,
                    score:
                        Number(score)
                })
            )
            .filter(
                item =>
                    Number.isFinite(
                        item.score
                    ) &&
                    item.score > 0 &&
                    item.score <= 4
            );


    if (
        typeof renderHeatmapCalendar
        !== "function"
    ) {

        el(
            progressCalendar,
            "div",
            "home-empty",
            "Heatmap Calendar is not enabled."
        );

        return;
    }


    const calendarData = {
        year:
            progressYear,

        colors:
            progressColors,

        intensityScaleStart: 1,
        intensityScaleEnd: 4,

        showCurrentDayBorder:
            progressYear ===
            currentProgressYear,

        entries:
            yearRatings
                .filter(item =>
                    item.score > 0
                )
                .map(item => ({
                    date:
                        item.date,
                    intensity:
                        item.score
                }))
    };


    renderHeatmapCalendar(
        progressCalendar,
        calendarData
    );


    /*
     * Position month labels according
     * to the actual calendar weeks.
     */
    placeHeatmapNavigation(progressCalendar, progressToolbar, previousYear, progressYearLabel, nextYear);
    layoutProgressHeatmap();


    /*
     * Add tooltip information to
     * recorded heatmap entries.
     */
    for (const item of yearRatings) {

        const element =
            progressCalendar
                .querySelector(
                    `[data-date="${item.date}"]`
                );


        if (!element) {
            continue;
        }

        element.style.backgroundColor =
            progressColor(
                item.score
            );

        const momentumText =
            item.score
                .toFixed(2)
                .replace(
                    /\.?0+$/,
                    ""
                );


        const contributorLines =
            (
                workContributors[
                    item.date
                ]
                ?? []
            ).map(
                contributor =>
                    `${contributor.name}: ${contributor.score}/4`
            );


        element.dataset.hubProgressDetails =
            [
                `${momentumText}/4`,
                ...contributorLines
            ].join("\n");
    }


    window.hubEnableProgressCalendarEditing?.(
        progressCalendar,
        {
            year:
                progressYear,

            projectId:
                progressScope === "resources"
                    ? {
                        kind: "resource"
                    }
                    : {
                        kind: "project"
                    }
        }
    );
}


previousYear.addEventListener(
    "click",
    () => {

        const index =
            progressYears.indexOf(
                progressYear
            );


        if (
            progressYear <=
                MIN_PROGRESS_YEAR
        ) {
            return;
        }


        if (index <= 0) {

            progressYear--;

            progressYears.unshift(
                progressYear
            );

        } else {

            progressYear =
                progressYears[
                    index - 1
                ];
        }


        renderProgressYear();
    }
);


nextYear.addEventListener(
    "click",
    () => {

        const index =
            progressYears.indexOf(
                progressYear
            );


        if (
            index === -1 ||
            index >=
                progressYears.length - 1
        ) {
            return;
        }


        progressYear =
            progressYears[
                index + 1
            ];


        renderProgressYear();
    }
);

frame.beforePaint(() => { refreshWorkProgress(); refreshProgressYears(); renderProgressYear(); syncRecentActivityHeight(); });


root.addEventListener(
    "hub-progress-changed",
    () => {

        refreshWorkProgress();
        refreshProgressYears();

        progressReports =
            getScopedProgressReports();

        renderProgressYear();

        if (
            progressView === "reports"
        ) {
            renderActiveProgressView();
        }
    }
);


const progressTabs =
    recent.createDiv({
        cls:
            "home-progress-tabs hub-panel-selectors"
    });

historyHeading(progressTabs);
const historySelectors = progressTabs.createDiv({
    cls: "hub-history-selectors hub-panel-selectors"
});

const reportsTab =
    historySelectors.createEl(
        "button",
        {
            text:
                "Reports"
        }
    );


const activityTab =
    historySelectors.createEl(
        "button",
        {
            text:
                "Activity"
        }
    );


const tasksTab =
    historySelectors.createEl(
        "button",
        {
            text:
                "Tasks"
        }
    );


const savedProgressView =
    sessionStorage.getItem(
        "obsidian-hub::home-progress-view"
    );


let progressView =
    [
        "reports",
        "activity",
        "tasks"
    ].includes(savedProgressView)
        ? savedProgressView
        : "reports";


const recentBody =
    recent.createDiv({
        cls:
            "home-progress-history-body home-progress-activity-body"
    });
recentBody.hubMarkdown = window.hubCreateMarkdown?.(dv.component);
const historyPager = createHistoryPager(recentBody, dv.component);
let historyReadDisposed = false, historyReadGeneration = 0, historyReadStatus = null;
const completedHistoryRead = window.hubCreateTaskHistoryRead?.({ component: dv.component, changed: () => queueMicrotask(() => { if (!historyReadDisposed && root.isConnected) void refreshCompletedTaskHistory(); }) });
dv.component.register(() => { historyReadDisposed = true; historyReadGeneration++; });


// ---------- ACTIVITY SCROLL HEIGHT ----------

let recentActivityHeightFrame =
    null;


function syncRecentActivityHeight() {

    if (
        !recent.isConnected
    ) {
        return;
    }


    const panelRect =
        recent
            .getBoundingClientRect();


    const bodyRect =
        recentBody
            .getBoundingClientRect();


    const panelStyle =
        getComputedStyle(
            recent
        );


    const bottomPadding =
        parseFloat(
            panelStyle.paddingBottom
        ) || 0;


    /*
     * Everything above recentBody —
     * title, toolbar, months and heatmap —
     * keeps its natural rendered height.
     *
     * History receives only the remaining
     * space below it.
     */
    const availableHeight =
        Math.max(
            0,
            (panelRect.bottom - bodyRect.top) /
                (panelRect.height / parseFloat(panelStyle.height) || 1) -
            bottomPadding - (parseFloat(panelStyle.borderBottomWidth) || 0)
        );


    recentBody.style.height =
        `${Math.floor(
            availableHeight
        )}px`;
}


function scheduleRecentActivityHeight() {

    if (
        recentActivityHeightFrame !==
        null
    ) {

        cancelAnimationFrame(
            recentActivityHeightFrame
        );
    }


    recentActivityHeightFrame =
        requestAnimationFrame(
            () => {

                recentActivityHeightFrame =
                    null;

                syncRecentActivityHeight();
            }
        );
}


const recentActivityHeightObserver =
    new ResizeObserver(
        scheduleRecentActivityHeight
    );


recentActivityHeightObserver.observe(
    recent
);


recentActivityHeightObserver.observe(
    progressSection
);


recentActivityHeightObserver.observe(
    progressCalendar
);

dv.component.register(() => {
    recentActivityHeightObserver.disconnect();
    if (recentActivityHeightFrame !== null) cancelAnimationFrame(recentActivityHeightFrame);
});

scheduleRecentActivityHeight();

// ---------- PROGRESS WHEEL SCROLL ----------

let recentScrollTarget =
    recentBody.scrollTop;


let recentScrollFrame =
    null;


function stopRecentScrollAnimation() {

    if (
        recentScrollFrame !==
        null
    ) {

        cancelAnimationFrame(
            recentScrollFrame
        );

        recentScrollFrame =
            null;
    }


    recentScrollTarget =
        recentBody.scrollTop;
}


function animateRecentScroll() {

    const maxScroll =
        Math.max(
            0,

            recentBody.scrollHeight -
            recentBody.clientHeight
        );


    recentScrollTarget =
        Math.max(
            0,

            Math.min(
                maxScroll,
                recentScrollTarget
            )
        );


    const current =
        recentBody.scrollTop;


    const distance =
        recentScrollTarget -
        current;


    if (
        Math.abs(
            distance
        ) < 0.5
    ) {

        recentBody.scrollTop =
            recentScrollTarget;


        recentScrollFrame =
            null;

        return;
    }


    recentBody.scrollTop =
        current +
        distance * 0.22;


    recentScrollFrame =
        requestAnimationFrame(
            animateRecentScroll
        );
}


recentBody.addEventListener(
    "scroll",
    () => {

        /*
         * Native/manual scrolling keeps
         * our target synchronized.
         */
        if (
            recentScrollFrame ===
            null
        ) {

            recentScrollTarget =
                recentBody.scrollTop;
        }
    }
);


recent.addEventListener(
    "wheel",
    event => {

        /*
         * Directly over history:
         * use native scrolling.
         *
         * Cancel any previous animation
         * so it cannot fight the browser.
         */
        if (
            event.target.closest(
                ".home-progress-activity-body"
            )
        ) {

            stopRecentScrollAnimation();

            return;
        }


        const maxScroll =
            Math.max(
                0,

                recentBody.scrollHeight -
                recentBody.clientHeight
            );


        if (
            maxScroll <= 0
        ) {
            return;
        }


        let delta =
            event.deltaY;


        if (
            event.deltaMode === 1
        ) {

            delta *= 16;

        } else if (
            event.deltaMode === 2
        ) {

            delta *=
                recentBody.clientHeight;
        }


        if (
            delta === 0
        ) {
            return;
        }


        const current =
            recentBody.scrollTop;


        /*
         * At the actual boundary, release
         * scrolling to the main page.
         */
        if (
            (
                delta < 0 &&
                current <= 0.5
            ) ||
            (
                delta > 0 &&
                current >=
                    maxScroll - 0.5
            )
        ) {

            stopRecentScrollAnimation();

            return;
        }


        event.preventDefault();


        /*
         * Beginning a new animation starts
         * from the actual scroll position.
         */
        if (
            recentScrollFrame ===
            null
        ) {

            recentScrollTarget =
                current;
        }


        recentScrollTarget =
            Math.max(
                0,

                Math.min(
                    maxScroll,

                    recentScrollTarget +
                    delta
                )
            );


        if (
            recentScrollFrame ===
            null
        ) {

            recentScrollFrame =
                requestAnimationFrame(
                    animateRecentScroll
                );
        }
    },
    {
        passive:
            false
    }
);

function displayProjectName(
    name
) {

    return String(name ?? "")
        .replace(
            /^(Book|MSc Thesis|Novel|Research|Poetry)\s*-\s*/i,
            ""
        );
}

function activityLocationParts(
    item,
    project
) {

    const parts =
        String(
            item?.path ?? ""
        )
            .split("/")
            .filter(Boolean);


    const folders =
        parts[0] === "Projects"
            ? parts.slice(2, -1)
            : [];


    return [
        displayProjectName(
            project?.name
        ),
        ...folders
    ]
        .filter(Boolean);
}


function resourceActivityLocationParts(
    item,
    resource
) {

    const parts =
        String(
            item?.path ?? ""
        )
            .split("/")
            .filter(Boolean);


    const rootParts =
        String(resource?.root ?? "")
            .split("/")
            .filter(Boolean);


    return [
        resource?.label,
        ...parts.slice(
            rootParts.length,
            -1
        )
    ]
        .filter(Boolean);
}

function activityIcon(action) {

    const icons = {
        created:
            "file",

        edited:
            "file-pen-line",

        renamed:
            "pencil-line",

        deleted:
            "trash-2",

        "project-created":
            "folder-plus",

        "project-renamed":
            "folder-pen",

        "project-deleted":
            "trash-2"
    };


    return icons[action]
        ?? "activity";
}


function renderRecentReports() {
    historyPager.reset();

    recentBody.hubMarkdown?.clear();
    recentBody.empty();


    const visibleReports =
        progressReports
            .filter(
                report =>
                    progressScope === "resources"
                        ? historyKind(report) === "resource"
                        : historyKind(report) !== "resource"
            )
            ;


    if (
        visibleReports.length === 0
    ) {

        el(
            recentBody,
            "div",
            "home-empty",
            progressScope === "resources"
                ? "No Resource progress reports yet."
                : "No project progress reports yet."
        );

        return;
    }


    historyPager.render(visibleReports, (report) => {

        const row =
            recentBody.createDiv({
                cls:
                    "home-progress-report-row"
            });


        const header =
            row.createDiv({
                cls:
                    "home-progress-report-header"
            });


        const icon =
            header.createSpan({
                cls:
                    "home-recent-action-icon is-progress-report"
            });


        window.hubSetIcon?.(
            icon,
            "clipboard-check"
        );


        el(
            header,
            "span",
            "home-progress-report-project",
            displayProjectName(
                report.projectName
            )
        );


        if (report.score !== null) {
            el(
                header,
                "span",
                "home-progress-report-score",
                `${report.score}/4`
            );
        }


        const summary = el(
            row,
            "div",
            "home-progress-report-summary" +
                (
                    report.summary
                        ? ""
                        : " is-empty"
                ),
            report.summary ||
                "No summary recorded."
        );
        if (report.summary) {
            const context = report.targetKind === "resource"
                ? resourceTypes.find(type => (type.id ?? type.resourceType) === report.resourceId)
                : projects.find(project => project.projectId === report.projectId);
            summary.classList.add("hub-report-reflection");
            void recentBody.hubMarkdown?.render(summary, report.summary,
                context?.path || context?.hubPath || "Home.md");
        }


        const reportTime =
            row.createDiv({
                cls:
                    "home-progress-report-time"
            });


        reportTime.title = Number.isFinite(report.timestamp)
            ? formatDateTime(moment(report.timestamp)) : formatDate(moment(report.date, "YYYY-MM-DD"));
        el(
            reportTime,
            "div",
            "home-recent-date",
            historyDate(moment(report.date, "YYYY-MM-DD"))
        );


        if (
            Number.isFinite(
                report.timestamp
            )
        ) {
            el(
                reportTime,
                "div",
                "home-recent-clock",
                formatTime(moment(report.timestamp))
            );
        }


        makeActionableRow(
            row,
            event => {
                window.hubOpenProgressEditor?.(
                    report.date,
                    report.targetKind === "resource"
                        ? {
                            kind: "resource",
                            id: report.resourceId
                        }
                        : {
                            kind: "project",
                            id: report.projectId
                        }
                );
            }
        );

    });
}


async function refreshCompletedTaskHistory(render = true) {
    const ticket = ++historyReadGeneration;
    if (historyReadDisposed || !root.isConnected) return;
    try {
        if (!completedHistoryRead) throw new Error("Recorded task History reader is unavailable.");
        const result = await completedHistoryRead.read(() => historyReadDisposed || ticket !== historyReadGeneration || !root.isConnected);
        if (!result || historyReadDisposed || !root.isConnected || ticket !== historyReadGeneration) return;
        historyReadStatus?.remove(); historyReadStatus = null;
        completedTaskHistory = result.records;
        completedHistoryRead.accept(result);
        if (render && result.changed && progressView === "tasks") {
            completedHistoryRead.preserve(recentBody, renderCompletedTaskHistory);
            scheduleRecentActivityHeight();
        }
    } catch (error) {
        if (historyReadDisposed || !root.isConnected || ticket !== historyReadGeneration) return;
        if (!historyReadStatus) historyReadStatus = recentBody.parentElement.createDiv({ cls: "home-empty", text: homeTaskRead?.availability?.() === "loading" ? "Loading task History..." : "Task History is temporarily unavailable. Existing History is retained." });
        historyReadStatus.setAttribute("role", "status"); historyReadStatus.setAttribute("data-task-history-status", "");
        historyReadStatus.hidden = progressView !== "tasks";
        if (homeTaskRead?.availability?.() !== "loading") console.error("Recorded task History read failed", error);
    }
}

function renderCompletedTaskHistory() {
    if (historyReadStatus && completedTaskHistory.length === 0) return;
    historyPager.reset();

    recentBody.hubMarkdown?.clear();
    recentBody.empty();


    const items =
        [...completedTaskHistory]
            .filter(item => {
                const isResourceItem = historyKind(item) === "resource";

                return progressScope === "resources"
                    ? Boolean(isResourceItem)
                    : !isResourceItem;
            })
            .sort(
                (a, b) =>
                    a.nativeHistory && a.timestamp === null ? (b.nativeHistory && b.timestamp === null ? 0 : 1) : b.nativeHistory && b.timestamp === null ? -1 : Number(b.timestamp) -
                    Number(a.timestamp)
            );


    if (items.length === 0) {

        el(
            recentBody,
            "div",
            "home-empty",
            progressScope === "resources"
                ? "No task progress recorded for Resources."
                : "No task progress recorded for projects."
        );

        return;
    }


    historyPager.render(items, (item) => {

        const row =
            recentBody.createDiv({
                cls:
                    "home-recent-row home-completed-task-row"
            });
        row.historyReadKey = item.historyReadKey;


        const info =
            row.createDiv({
                cls:
                    "home-recent-info"
            });


        const titleRow =
            info.createDiv({
                cls:
                    "home-recent-title-row"
            });


        const icon =
            titleRow.createSpan({
                cls:
                    "home-recent-action-icon " + (item.kind === "step" ? "is-step-progress" : "is-completed-task")
            });


        window.hubSetIcon?.(
            icon,
            item.kind === "step" ? "circle-check" : "square-check"
        );


        const progressText = item.kind === "step" ? `${item.parentText} \u00b7 ${item.text}` : item.text;
        const title = el(titleRow, "div", "home-recent-title", progressText);
        void recentBody.hubMarkdown?.render(title, progressText, item.path || item.projectPath || "Home.md");


        const resourceId =
            item.resourceType ??
            (
                String(item.projectId ?? "")
                    .startsWith("resource:")
                    ? String(item.projectId)
                        .slice("resource:".length)
                    : null
            );


        const resource =
            resourceTypes.find(item =>
                item.resourceType === resourceId ||
                item.id === resourceId
            );


        const project =
            resource
                ? null
                : projects.find(
                    project =>
                        project.projectId ===
                            item.projectId
                );


        const projectName =
            displayProjectName(
                item.nativeHistory ? (item.projectName ?? (item.nativeHistory.owner ? item.nativeHistory.owner.type + ": " + item.nativeHistory.owner.id : "Unassigned")) : resource?.label ??
                project?.name ??
                item.projectName
            );


        if (projectName) {

            const location =
                info.createDiv({
                    cls:
                        "home-recent-type"
                });


            location.setText(
                projectName
            );
        }


        const when =
            moment(
                item.timestamp
            );

        const time =
            row.createDiv({
                cls:
                    "home-recent-time"
            });


        if (item.nativeHistory && item.timestamp === null) {
            row.setAttribute("data-history-undated", "true"); time.title = "Completion time unavailable";
            el(time, "div", "home-recent-date", "Completion time unavailable");
        } else {
        time.title = formatDateTime(when);
        el(
            time,
            "div",
            "home-recent-date",
            historyDate(when)
        );


        el(
            time,
            "div",
            "home-recent-clock",
            formatTime(when)
        );
        }


        const file = item.nativeHistory ? null :
            app.vault
                .getAbstractFileByPath(
                    item.path
                );


        if (file || item.nativeHistory?.navigation.state === "available") {

            row.addClass(
                "home-recent-clickable"
            );


            makeActionableRow(
                row,
                async () => {

                    const target = await completedHistoryRead.reveal(item);
                    if (!item.nativeHistory && target) await openFileFromHome(target.path);
                }
            );
        }
    });
}


function renderActiveProgressView() {
    if (historyReadStatus) historyReadStatus.hidden = progressView !== "tasks";

    reportsTab.toggleClass(
        "is-active",
        progressView === "reports"
    );

    activityTab.toggleClass(
        "is-active",
        progressView === "activity"
    );

    tasksTab.toggleClass(
        "is-active",
        progressView === "tasks"
    );


    if (progressView === "reports") {
        renderRecentReports();
    } else if (progressView === "activity") {
        renderRecentActivity();
    } else {
        renderCompletedTaskHistory();
    }


    scheduleRecentActivityHeight();
}


function setProgressScope(scope) {
        if (scope === progressScope) return;

        progressScope =
            scope === "resources"
                ? "resources"
                : "projects";

        updateProgressScopeButtons();

        sessionStorage.setItem(
            PROGRESS_SCOPE_STORAGE_KEY,
            progressScope
        );


        refreshWorkProgress();
        refreshProgressYears();


        progressReports =
            getScopedProgressReports();


        recentBody.scrollTop = 0;
        recentScrollTarget = 0;


        renderProgressYear();
        renderActiveProgressView();
}


reportsTab.addEventListener(
    "click",
    () => {
        progressView = "reports";
        sessionStorage.setItem(
            "obsidian-hub::home-progress-view",
            progressView
        );
        recentBody.scrollTop = 0;
        recentScrollTarget = 0;
        renderActiveProgressView();
    }
);


activityTab.addEventListener(
    "click",
    () => {
        progressView = "activity";
        sessionStorage.setItem(
            "obsidian-hub::home-progress-view",
            progressView
        );
        recentBody.scrollTop = 0;
        recentScrollTarget = 0;
        renderActiveProgressView();
    }
);


tasksTab.addEventListener(
    "click",
    () => {
        progressView = "tasks";
        sessionStorage.setItem(
            "obsidian-hub::home-progress-view",
            progressView
        );
        recentBody.scrollTop = 0;
        recentScrollTarget = 0;
        renderActiveProgressView();
        if (historyReadStatus) void refreshCompletedTaskHistory();
    }
);

function renderRecentActivity() {
    historyPager.reset();

    recentBody.hubMarkdown?.clear();
    recentBody.empty();


    const visibleItems =
        recentItems
            .map(item => {

                const isProjectEvent =
                    item.action
                        ?.startsWith(
                            "project-"
                        );


                const isResourceItem = historyKind(item) === "resource";


                const resourceId =
                    item.resourceType ??
                    (
                        String(item.projectId ?? "")
                            .startsWith("resource:")
                            ? String(item.projectId)
                                .slice("resource:".length)
                            : null
                    );


                const resource =
                    resourceTypes.find(resource =>
                        resource.id === resourceId ||
                        resource.resourceType === resourceId
                    ) ?? null;


                const project =
                    isResourceItem
                        ? null
                        : projects.find(
                            project =>
                                item.projectId === project.projectId ||
                                item.path ===
                                    project.sourcePath ||
                                item.path ===
                                    project.path ||
                                item.path?.startsWith(
                                    `${project.sourceRoot}/`
                                ) ||
                                item.path?.startsWith(
                                    `${project.root}/`
                                )
                        ) ?? null;


                const visible = progressScope === "resources"
                    ? isResourceItem : !isResourceItem;


                return {
                    item,
                    project,
                    resource,
                    isProjectEvent,
                    visible
                };
            })
            .filter(
                item =>
                    item.visible
            )
            .sort(
                (a, b) =>
                    Number(
                        b.item.timestamp
                    ) -
                    Number(
                        a.item.timestamp
                    )
            )
            ;

    if (
        visibleItems.length === 0
    ) {

        el(
            recentBody,
            "div",
            "home-empty",
            progressScope === "resources"
                ? "No recent Resource activity."
                : "No recent project activity."
        );

        return;
    }


    historyPager.render(visibleItems, ({
            item,
            project,
            resource,
            isProjectEvent
        }) => {

        const row =
            recentBody.createDiv({
                cls:
                    "home-recent-row"
            });


        const info =
            row.createDiv({
                cls:
                    "home-recent-info"
            });


        let title;


        switch (item.action) {

            case "created":
                title =
                    `Created "${item.title}"`;
                break;


            case "edited":
                title =
                    `Edited "${item.title}"`;
                break;


            case "deleted":
                title =
                    `Deleted "${item.title}"`;
                break;


            case "renamed":
                title =
                    `Renamed "${item.oldTitle}" to "${item.title}"`;
                break;

            case "project-created":
                title =
                    `Created project "${displayProjectName(
                        item.title
                    )}"`;
                break;


            case "project-renamed":
                title =
                    `Renamed project "${displayProjectName(
                        item.oldTitle
                    )}" to "${displayProjectName(
                        item.title
                    )}"`;
                break;


            case "project-deleted":
                title =
                    `Deleted project "${displayProjectName(
                        item.title
                    )}"`;
                break;

            default:
                title =
                    item.title;
        }


    const titleRow =
        info.createDiv({
            cls:
                "home-recent-title-row"
        });


    const icon =
        titleRow.createSpan({
            cls:
                `home-recent-action-icon is-${item.action}`
        });


    window.hubSetIcon?.(
        icon,
        activityIcon(
            item.action
        )
    );


    el(
        titleRow,
        "span",
        "home-recent-title",
        title
    );

        if (
            !isProjectEvent &&
            (project || resource || item.project || item.projectName)
        ) {

            const breadcrumb =
                info.createDiv({
                    cls:
                        "home-recent-type home-recent-breadcrumb"
                });


            const parts =
                resource
                    ? resourceActivityLocationParts(
                        item,
                        resource
                    )
                    : project ? activityLocationParts(item, project)
                        : [item.projectName || item.project];


            parts.forEach(
                (part, index) => {

                    breadcrumb.createSpan({
                        cls:
                            "home-recent-breadcrumb-part" +
                            (
                                index === 0
                                    ? " is-project"
                                    : ""
                            ),

                        text:
                            part
                    });


                    if (
                        index <
                        parts.length - 1
                    ) {

                        const separator =
                            breadcrumb.createSpan({
                                cls:
                                    "home-recent-breadcrumb-separator"
                            });


                        window.hubSetIcon?.(
                            separator,
                            "chevron-right"
                        );
                    }
                }
            );
        }

        const timestamp =
            row.createDiv({
                cls:
                    "home-recent-time"
            });


        const when =
            moment(
                item.timestamp
            );


        timestamp.title = formatDateTime(when);
        el(
            timestamp,
            "div",
            "home-recent-date",
                historyDate(when)
        );


        el(
            timestamp,
            "div",
            "home-recent-clock",
            formatTime(when)
        );


        /*
         * Deleted files cannot be opened.
         */

        const isDeleted =
            item.action === "deleted" ||
            item.action ===
                "project-deleted";


        if (!isDeleted) {

            const openPath =
                isProjectEvent &&
                project
                    ? project.path
                    : item.path;


            const file =
                app.vault
                    .getAbstractFileByPath(
                        openPath
                    );


            if (file) {

                row.addClass(
                    "home-recent-clickable"
                );


                makeActionableRow(
                    row,
                    async () => {

                        await openFileFromHome(
                            openPath
                        );
                    }
                );
            }
        }
    });
}

root.addEventListener(
    "hub-activity-changed",
    () => {

        recentItems =
            window
                .hubGetActivityLog?.()
            ?? [];


        if (
            progressView === "activity"
        ) {
            renderActiveProgressView();
        }
    }
);


function removeClearedTasksFromCache(
    deleted
) {

    const linesByPath =
        new Map();


    for (const item of deleted ?? []) {

        if (!linesByPath.has(item.path)) {
            linesByPath.set(
                item.path,
                []
            );
        }


        linesByPath.get(item.path)
            .push(item.line);
    }


    const retainExistingTasks =
        tasks => tasks.filter(item => {

            const path =
                currentPath(
                    item.task.path,
                    item.owner
                );

            const deletedLines =
                linesByPath.get(path) ?? [];


            if (
                deletedLines.includes(
                    item.task.line
                )
            ) {
                return false;
            }


            item.task.line -=
                deletedLines.filter(
                    line =>
                        line < item.task.line
                ).length;


            return true;
        });


    projectTasks =
        retainExistingTasks(
            projectTasks
        );


    resourceTasks =
        retainExistingTasks(
            resourceTasks
        );
    homeTaskRead?.remember([...projectTasks, ...resourceTasks], [...linesByPath.keys()]);
}


root.addEventListener(
    "hub-completed-tasks-changed",
    event => {

        if (event.detail?.deleted?.length) {
            removeClearedTasksFromCache(event.detail.deleted);
            renderTaskContext();
        }
        completedHistoryRead?.invalidate();
        void refreshCompletedTaskHistory();
    }
);


async function loadTaskData(render = true) {
    const ticket = ++homeTaskGeneration;
    if (homeTaskDisposed || !root.isConnected) return;
    if (deferHomeTaskInteraction()) return;
    if (upcomingBody.hubTaskUi?.defer(() => { void loadTaskData(render); })) return;
    const taskData = window.hubTaskData;
    // Keep the existing owner objects: status/delete handlers update them in
    // place. Resolve relocated roots before assigning tasks to their owners.
    for (const owner of [...projects, ...resourceTypes]) {
        owner.path = taskData?.currentPath(owner.path) ?? owner.path;
        owner.root = taskData?.currentPath(owner.root) ?? owner.root;
    }
    try {
        if (!homeTaskRead) throw new Error("Home task reader is unavailable.");
        const result = await homeTaskRead.read();
        if (!result || homeTaskDisposed || !root.isConnected || ticket !== homeTaskGeneration) return;
        if (deferHomeTaskInteraction()) return;
        if (upcomingBody.hubTaskUi?.defer(() => { void loadTaskData(render); })) return;
        const stateChanged = homeTaskCountComplete !== (result.countComplete !== false) || homeTaskLoading !== (result.availability === "loading");
        homeTaskCountComplete = result.countComplete !== false; homeTaskLoading = result.availability === "loading";
        homeTaskStatus?.remove(); homeTaskStatus = null;
        if (!homeTaskCountComplete && result.items.length) {
            homeTaskStatus = upcoming.createDiv({ cls: "home-empty", text: homeTaskLoading ? "Loading tasks..." : "Native tasks are unavailable. Retained tasks are not a complete current total." });
            homeTaskStatus.setAttribute("role", "status");
        }
        if (result.changed) {
            projectTasks = result.items.filter(item => item.owner.contextKind !== "resource");
            resourceTasks = result.items.filter(item => item.owner.contextKind === "resource");
            homeTaskRead.accept(result.items);
        }
        if (render && (result.changed || stateChanged)) renderTaskContext();
    } catch (error) {
        if (homeTaskDisposed || !root.isConnected || ticket !== homeTaskGeneration) return;
        homeTaskLoading = homeTaskRead?.availability?.() === "loading";
        if (homeTaskRead?.availability) { homeTaskCountComplete = false; homeTaskCount = null; if (typeof homeContext !== "undefined") homeContext.setText(homeTaskLoading ? (retainedPresentation.length ? "Refreshing tasks..." : "Loading tasks...") : "Tasks temporarily unavailable."); }
        if ([...projectTasks, ...resourceTasks].length && !homeTaskStatus) homeTaskStatus = upcoming.createDiv({ cls: "home-empty", text: homeTaskLoading ? "Loading tasks..." : "Tasks are temporarily unavailable. Existing tasks are retained." });
        homeTaskStatus?.setAttribute("role", "status");
        if (render) renderTaskContext();
        if (!homeTaskLoading) console.error("Home task read failed", error);
    }
}

async function loadSecondaryData() {
    if (homeTaskDisposed || !root.isConnected) return;
    // Independent panels must not queue behind native admission or task reads.
    void loadTaskData();

    recentItems =
        window.hubGetActivityLog?.()
        ?? [];

    progressReports =
        getScopedProgressReports();

    renderActiveProgressView();
    void refreshCompletedTaskHistory();
}


function renderTaskContext() {

    const activeProjectTasks =
        projectTasks.filter(item =>
            isActiveProject(item.owner)
        );


    const homeTasks = [...activeProjectTasks, ...resourceTasks];
    homeTaskCount = homeTaskCountComplete ? (window.hubTaskGroups?.(homeTasks).active ?? homeTasks.filter(item => !item.task.completed)).length : null;


    if (!homeTaskCountComplete && typeof homeContext !== "undefined") homeContext.setText(homeTaskLoading ? (retainedPresentation.length ? "Refreshing tasks..." : "Loading tasks...") : "Tasks temporarily unavailable.");
    else updateHomeContext();


    renderTasksToDo(
        activeProjectTasks,
        resourceTasks
    );
}

function renderActiveContext() {
    renderTaskContext();
    renderActiveProgressView();
}

// Subscribe before the final capture, so metadata becoming ready during this
// render cannot strand Home with an empty Project/owner snapshot.
function refreshHomeProjects() {
    if (homeTaskDisposed || !root.isConnected || !window.hubGetHomeProjects) return;
    const records = homeProjectRecords();
    const fields = ["projectId", "path", "root", "name", "status", "categoryId"];
    const before = JSON.stringify(projects.map(project => fields.map(key => project[key])));
    const next = records.map(record => {
        const existing = projects.find(project => project.projectId === record.projectId);
        return existing ? Object.assign(existing, record) : record;
    });
    if (before === JSON.stringify(next.map(project => fields.map(key => project[key])))) return;
    projects.splice(0, projects.length, ...next);
    renderProjects(currentProjectStatus);
    renderProjectTabCounts();
    renderActiveContext();
    void loadTaskData();
}
if (window.hubGetHomeProjects && app.metadataCache?.on) {
    dv.component.registerEvent(app.metadataCache.on("resolved", refreshHomeProjects));
    dv.component.registerEvent(app.metadataCache.on("changed", file => {
        if (projects.some(project => project.path === file.path)
            || app.metadataCache.getFileCache(file)?.frontmatter?.type === "project") refreshHomeProjects();
    }));
}
renderTaskContext();
frame.defer(() => { refreshHomeProjects(); void loadSecondaryData(); });
frame.commit();
window.hubEnterDashboard?.(root);
