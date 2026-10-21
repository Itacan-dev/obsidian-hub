// ---------- CURRENT TASKS ----------

const tasksPanel =
    right.createDiv({
        cls:
            "project-panel project-tasks"
    });


const tasksTitle =
    tasksPanel.createDiv({
        cls:
            "project-panel-title project-tasks-title"
    });


const tasksTitleIcon =
    tasksTitle.createSpan({
        cls:
            "project-tasks-title-icon"
    });


window.hubSetIcon?.(
    tasksTitleIcon,
    "list-todo"
);


const tasksTitleText =
    tasksTitle.createSpan({
        text:
            "Tasks"
    });


const tasksBody =
    tasksPanel.createDiv({
        cls:
            "project-tasks-body"
    });


let currentProjectTasks = [];
let visibleCompletedTasks = [];
let clearingCompletedTasks = false;

tasksBody.hubTaskUi = window.hubCreateTaskUi?.(dv.component, tasksBody, edit => {
    currentProjectTasks = window.hubApplyTaskEdit(currentProjectTasks, edit);
    if (root.isConnected) renderTaskRows();
});
tasksBody.hubTaskUi?.addButton(tasksTitle, { root: projectRoot });

function taskLocation(
    path
) {

    if (
        path ===
        (window.hubTaskData?.currentPath(current.file.path) ?? current.file.path)
    ) {
        return isResourceContext ? "Resource Hub" : "Project Hub";
    }


    const relative =
        String(path)
            .slice(
                (window.hubTaskData?.currentPath(projectRoot) ?? projectRoot).length + 1
            )
            .replace(
                /\.md$/i,
                ""
            );


    if (!relative) {
        return isResourceContext ? "Resource Root" : "Project Root";
    }


    return relative
        .split("/")
        .filter(Boolean)
        .join(" › ");
}


function readProjectTasks() {
    // Same recursive Dataview query, with current paths supplied by the shared
    // task-data service. Project and Resource views use this same renderer.
    const pages = window.hubTaskData?.readPages(dv, projectRoot)
        ?? dv.pages(JSON.stringify(projectRoot)).array();
    return pages.flatMap(page => Array.from(page.file.tasks ?? []));
}


function renderTaskRows() {

    if (tasksBody.hubTaskUi && !tasksBody.hubTaskUi.beginRender(() => renderTaskRows())) return;
    tasksBody.empty();


    const oathPlan = tasksBody.hubTaskUi?.partitionOath?.(currentProjectTasks);
    const ordinaryTasks = oathPlan?.ordinary ?? currentProjectTasks;
    const groups = tasksBody.hubTaskUi?.groups(ordinaryTasks) ?? window.hubTaskGroups?.(ordinaryTasks);
    const openTasks = groups?.active ?? ordinaryTasks.filter(task => !task.completed);
    const futureTasks = groups?.future ?? [];


    const completedTasks =
        ordinaryTasks.filter(
            task =>
                task.completed
        );


    visibleCompletedTasks =
        completedTasks;


    const openTaskCount =
        openTasks.length;

    if (
        openTasks.length === 0 &&
        completedTasks.length === 0 && futureTasks.length === 0 && !oathPlan?.oath
    ) {

        el(
            tasksBody,
            "div",
            "project-empty",
            "No tasks."
        );

        return;
    }


    function renderTask(
        task,
        completed,
        target = tasksBody
    ) {

        const { row, checkbox, textEl } = window.hubCreateTaskRow(target, task, completed);
        tasksBody.hubTaskUi?.bind(row, textEl, task, () => window.hubTaskData?.currentPath(task.path) ?? task.path);


        if (completed) {

            const deleteButton =
                row.createEl(
                    "button",
                    {
                        cls:
                            "project-task-delete"
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


            deleteButton.addEventListener(
                "click",
                async event => {

                    event.stopPropagation();
                    deleteButton.disabled =
                        true;


                    try {
                        await clearCompletedProjectTasks(
                            [task]
                        );
                    } catch (error) {

                        console.error(
                            "Could not clear completed project task:",
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


        /*
         * Clicking the checkbox should
         * toggle the task, not open the
         * source note.
         */
        checkbox.addEventListener(
            "click",
            event => {

                event.stopPropagation();
            }
        );


        checkbox.addEventListener(
            "change",
            async () => {

                const previousState =
                    task.completed;
                const requestedState = checkbox.checked;


                checkbox.disabled =
                    true;


                try {

                    if (
                        !window
                            .hubToggleTask
                    ) {

                        throw new Error(
                            "Task toggle bridge is unavailable."
                        );
                    }


                    const edit = await window
                        .hubToggleTask(
                            task.path,
                            task.line,
                            task.text,
                            requestedState,
                            task.hubTaskId
                        );


                    /*
                     * Update this dashboard
                     * immediately instead of
                     * waiting for Dataview to
                     * re-index the file.
                     */
                    currentProjectTasks = window.hubApplyTaskEdit(currentProjectTasks, edit);


                    if (root.isConnected) renderTaskRows();


                } catch (error) {

                    console.error(
                        "Could not toggle project task:",
                        error
                    );


                    task.completed =
                        previousState;

                    checkbox.checked =
                        previousState;

                    checkbox.disabled =
                        false;
                }
            }
        );


        /*
         * Clicking anywhere else opens
         * the note containing the task.
         */
        row.addEventListener(
            "click",
            async () => {

                const file =
                    app.vault
                        .getAbstractFileByPath(
                            task.path
                        );


                if (file) {

                    await openProjectNote(
                        file
                    );
                }
            }
        );
    }


    if (oathPlan) tasksBody.hubTaskUi.renderOath(oathPlan, renderTask);

    // Open tasks first.

    for (
        const task
        of openTasks
    ) {

        renderTask(
            task,
            false
        );
    }


    if (tasksBody.hubTaskUi?.group) {
        tasksBody.hubTaskUi.group("future", futureTasks, task => renderTask(task, false));
        tasksBody.hubTaskUi.group("completed", completedTasks, task => renderTask(task, true), {
            clear: () => clearVisibleCompletedTasks(),
            canClear: () => !clearingCompletedTasks
        });
        return;
    }

    // Divider between open/completed.

    if (
        openTasks.length > 0 &&
        completedTasks.length > 0
    ) {

        tasksBody.createDiv({
            cls:
                "project-task-divider"
        });
    }


    // Completed tasks underneath.

    for (
        const task
        of completedTasks
    ) {

        renderTask(
            task,
            true
        );
    }
}


function renderCurrentTasks() {
    if (taskWorkspace?.active()) return;

    if (tasksBody.hubTaskUi?.defer(() => renderCurrentTasks())) return;
    currentProjectTasks =
        readProjectTasks();


    renderTaskRows();
}


function completedProjectTaskRequest(
    task
) {

    return {
        hubTaskId: task.hubTaskId,
        path:
            task.path,

        line:
            task.line,

        text:
            task.text,

        projectId:
            isResourceContext ? null : current.projectId,

        projectName:
            current.file.name,

        projectStatus:
            current.status,

        projectPath:
            window.hubTaskData?.currentPath(current.file.path) ?? current.file.path,

        projectRoot: window.hubTaskData?.currentPath(projectRoot) ?? projectRoot,

        contextKind:
            isResourceContext ? "resource" : "project",

        resourceType:
            isResourceContext ? current.resourceType : null
    };
}


async function clearCompletedProjectTasks(
    tasks,
    confirmMany = false
) {

    if (!window.hubClearCompletedTasks) {
        throw new Error(
            "Completed-task archive bridge is unavailable."
        );
    }


    return window.hubClearCompletedTasks(
        tasks.map(
            completedProjectTaskRequest
        ),
        confirmMany
    );
}


async function clearVisibleCompletedTasks() {
    if (clearingCompletedTasks || visibleCompletedTasks.length === 0) return;
    clearingCompletedTasks = true;
    try {
        // Keep the former header Clear scope and its native confirmation.
        await clearCompletedProjectTasks([...visibleCompletedTasks], true);
    } finally {
        clearingCompletedTasks = false;
    }
}


frame.defer(() => renderCurrentTasks());

window.hubTaskData?.subscribe(dv.component, () => {
    if (root.isConnected) renderCurrentTasks();
}, () => [projectRoot]);


