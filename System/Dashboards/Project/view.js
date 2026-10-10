const today =
    dv.date("today");

const current =
    dv.current();


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
    progressColors,
    progressColor,
    lastFileTooltip,
    lastNavigationInfo,
    workspaceButton,
    presetsButton,
    selectNavigation,
    markDashboardRow,
    navButton
} = window.hubCreateDashboardUi({
    navClass: "project-nav-button",
    getLastNavigation: () => window.hubGetLastNavigation?.(root) ?? {}
});

const {
    availableExternalFilePath,
    directFiles,
    directFolders,
    isFolder,
    projectChildPath,
    projectItemPath,
    selectedRootPaths
} = window.hubCreateFileDomain({
    getByPath: path =>
        app.vault.getAbstractFileByPath(path)
});

// ---------- WORK CONTEXT ----------

const isResourceContext =
    current?.type === "resource";

if (
    !current ||
    !["project", "resource"].includes(current.type)
) {

    dv.paragraph(
        "This view must be opened from a Project or Resource hub."
    );

    return;
}


const projectRoot =
    current.file.folder;

const resourceTypes =
    window.hubGetResourceTypes?.() ?? [];

const resourceType =
    isResourceContext
        ? resourceTypes.find(item => item.id === current.resourceType) ?? null
        : null;

const contextId =
    isResourceContext
        ? `resource:${current.resourceType}`
        : current.projectId;


if (isResourceContext) {
    window.hubRememberResource?.(current.resourceType);
} else {
    window.hubRememberProject?.(current.file.path);
}


const categories =
    window.hubGetProjectCategories?.()
    ?? [];


const category =
    categories.find(
        item =>
            item.id === current.category ||
            item.name === current.category
    )
    ?? null;


// ---------- ROOT ----------

const frame = createFrame(dv.container, dv.component,
    "project-dashboard hub-button-scope " + (isResourceContext ? "resource-dashboard" : ""));
const root = frame.root;
root.dataset.hubContextId = contextId;
window.hubWatchTooltips?.(root, dv.component);


async function navigateFromHub(
    navigate
) {

    if (window.hubNavigateDashboard) {
        await window.hubNavigateDashboard(
            root,
            navigate
        );
    } else {
        await navigate();
    }
}


async function openProjectNote(
    file,
    placement = "replace"
) {

    if (
        window.hubOpenProjectNote
    ) {

        await window.hubOpenProjectNote(
            file.path,
            placement,
            root
        );

        return;
    }


    await app.workspace
        .getLeaf(false)
        .openFile(
            file
        );
}


// ---------- COVER ----------

const coverPath =
    current.cover ??
    (isResourceContext ? resourceType?.image : category?.image) ??
    null;


if (coverPath) {

    const coverFile =
        app.vault
            .getAbstractFileByPath(
                coverPath
            );


    if (coverFile) {

        const cover =
            root.createDiv({
                cls:
                    "project-cover"
            });


        const image =
            cover.createEl(
                "img",
                {
                    cls:
                        "project-cover-image"
                }
            );


        image.src =
            app.vault
                .getResourcePath(
                    coverFile
                );

        image.alt = "";
        window.hubMountHeaderImage?.(cover, image, dv.component, contextId, coverPath,
            { defaultY: 35, manageMenu: false });

        cover.addEventListener(
            "contextmenu",
            event => {

                event.preventDefault();
                event.stopPropagation();


                window
                    .hubShowProjectCoverMenu?.(
                        event,
                        current.file.path,
                        root
                    );
            }
        );
    }
}

root.addEventListener(
    "hub-project-cover",
    event => {

        const {
            path,
            cover
        } =
            event.detail ??
            {};


        if (
            path !==
                current.file.path
        ) {
            return;
        }


        const nextPath =
            cover ??
            category?.image ??
            null;


        const nextFile =
            nextPath
                ? app.vault
                    .getAbstractFileByPath(
                        nextPath
                    )
                : null;


        const image =
            root.querySelector(
                ".project-cover-image"
            );


        if (
            image &&
            nextFile
        ) {

            image.src =
                app.vault
                    .getResourcePath(
                        nextFile
                    );
            window.hubMountHeaderImage?.(image.parentElement, image, dv.component, contextId, nextPath,
                { defaultY: 35, manageMenu: false });
        }
    }
);


// ---------- NAVIGATION ----------

const navDock =
    root.createDiv({
        cls:
            "project-nav-dock"
    });


const navIdentity =
    navDock.createDiv({
        cls:
            "project-nav-identity"
    });


el(
    navIdentity,
    "div",
    "project-nav-title",
    current.file.name
);


const projectCategoryName =
    (isResourceContext ? resourceType?.subtitle : category?.name) ??
    current.category ??
    null;


if (projectCategoryName) {
    el(
        navIdentity,
        "div",
        "project-nav-category",
        projectCategoryName
    );
}


const nav =
    navDock.createDiv({
        cls:
            "project-nav"
    });


markDashboardRow(
    navDock,
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

        const home =
            app.vault
                .getAbstractFileByPath(
                    "Home.md"
                );


        if (home) {
            await navigateFromHub(
                () =>
                    app.workspace
                        .getLeaf(false)
                        .openFile(
                            home
                        )
            );
        }
    },
    false,
    async () => {

        if (
            window.hubOpenHome
        ) {

            await window.hubOpenHome(
                root
            );

            return;
        }

        const home =
            app.vault
                .getAbstractFileByPath(
                    "Home.md"
                );


        if (home) {

            await app.workspace
                .getLeaf("tab")
                .openFile(
                    home
                );
        }
    },
    "Go to homepage",
    "home"
);


workspaceButton(nav, root, true);


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

            return;
        }


        const path =
            lastNavigationInfo()
                .file?.path;


        const file =
            path
                ? app.vault
                    .getAbstractFileByPath(
                        path
                    )
                : null;


        if (file) {
            await openProjectNote(
                file
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

selectNavigation(nav, dv.component.hubDestinationMode === "note" ||
    window.hubIsProjectNoteMode?.(current.file.path) === true
    ? "last-file" : "workspace");

const header =
    root.createDiv({
        cls:
            "project-header"
    });


markDashboardRow(
    header,
    2
);


const titleBox =
    header.createDiv({
        cls:
            "project-title-box"
    });


el(
    titleBox,
    "h1",
    "project-title",
    current.file.name
);


if (category || isResourceContext) {

    el(
        titleBox,
        "div",
        "project-category",
        isResourceContext ? resourceType?.subtitle : category.name
    );
}


const dateBox =
    header.createDiv({
        cls:
            "project-date"
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
    "project-week",
    `Week ${today.weekNumber}`
);


// ---------- WORKSPACE MODES ----------
const shortcutsBar = root.createDiv({ cls: "project-shortcuts" });
const searchWorkspace = { root: projectRoot, projectId: contextId, name: current.file.name,
    contextKind: isResourceContext ? "resource" : "project" };
window.hubMountContextSearch?.({ component: dv.component, dv, root, toolbar: shortcutsBar, scope: searchWorkspace });
markDashboardRow(shortcutsBar, 3);
let taskWorkspace = null;

// ---------- MAIN LAYOUT ----------

const grid =
    root.createDiv({
        cls:
            "project-main-grid"
    });


const left =
    grid.createDiv({
        cls:
            "project-left-column"
    });


markDashboardRow(
    left,
    4
);


const right =
    grid.createDiv({
        cls:
            "project-right-column"
    });


markDashboardRow(
    right,
    4
);


// ---------- TEMPORARY PLACEHOLDERS ----------

// ---------- WORKSPACE FILES ----------

const folderStack =
    left.createDiv({
        cls:
            "project-folder-stack"
    });


// ---------- PERSISTENT FOLDER UI ----------

const folderUiContextId = contextId ?? projectRoot;
function loadFolderUiState() {
    return window.hubGetFolderUiState?.(folderUiContextId) ?? {};
}
function persistFolderUiState() {
    window.hubSaveFolderUiState?.(folderUiContextId, savedFolderUiState);
}

const savedFolderUiState =
    loadFolderUiState();
const restoredFolderPreset = window.hubGetFolderPresetState?.(contextId);
if (restoredFolderPreset) {
    for (const key of Object.keys(savedFolderUiState)) delete savedFolderUiState[key];
    Object.assign(savedFolderUiState, restoredFolderPreset.folders);
}


const projectHubFile =
    app.vault
        .getAbstractFileByPath(
            current.file.path
        );


let folderOrder =
    Array.isArray(
        current.folder_order
    )
        ? [
            ...current.folder_order
        ]
        : [];
if (restoredFolderPreset) folderOrder = [...restoredFolderPreset.order];


async function saveFolderOrder() {

    if (
        !projectHubFile ||
        isFolder(projectHubFile)
    ) {
        return;
    }


    await app.fileManager
        .processFrontMatter(
            projectHubFile,
            frontmatter => {

                frontmatter.folder_order =
                    folderOrder;
            }
        );
}

// ---------- EXTERNAL FILE IMPORT ----------

function isExternalFileDrag(
    event
) {

    return Array.from(
        event.dataTransfer
            ?.types
        ?? []
    ).includes(
        "Files"
    );
}


function externalDragHasDirectory(
    event
) {

    return Array.from(
        event.dataTransfer
            ?.items
        ?? []
    ).some(
        item => {

            if (
                item.kind !==
                "file"
            ) {
                return false;
            }


            const entry =
                item.webkitGetAsEntry?.();


            return (
                entry?.isDirectory ===
                true
            );
        }
    );
}


async function importExternalFiles(
    folderPath,
    files
) {

    const folder =
        app.vault
            .getAbstractFileByPath(
                folderPath
            );


    if (
        !isFolder(
            folder
        )
    ) {
        return;
    }


    for (
        const sourceFile
        of files
    ) {

        const fileName =
            String(
                sourceFile.name ??
                ""
            ).trim();


        if (
            !fileName ||
            /[\\/:*?"<>|]/
                .test(
                    fileName
                )
        ) {
            continue;
        }


        const path =
            availableExternalFilePath(
                folderPath,
                fileName
            );


        /*
         * Markdown remains text.
         * Everything else is copied
         * byte-for-byte.
         */
        if (
            /\.md$/i.test(
                fileName
            )
        ) {

            await app.vault
                .create(
                    path,
                    await sourceFile
                        .text()
                );

        } else {

            await app.vault
                .createBinary(
                    path,
                    await sourceFile
                        .arrayBuffer()
                );
        }
    }


    /*
     * Refresh once after the complete
     * batch. Imported files stay closed.
     */
    renderFolderPanels();
}


function makeExternalFileDropTarget(
    element,
    getTargetPath
) {

    element.addEventListener(
        "dragover",
        event => {

            if (
                !isExternalFileDrag(
                    event
                )
            ) {
                return;
            }


            event.preventDefault();
            event.stopPropagation();


            clearProjectItemDropIndicators();


            if (
                externalDragHasDirectory(
                    event
                )
            ) {

                event.dataTransfer.dropEffect =
                    "none";

                return;
            }


            element.addClass(
                "is-item-drop-target"
            );


            event.dataTransfer.dropEffect =
                "copy";
        }
    );


    element.addEventListener(
        "dragleave",
        event => {

            if (
                !isExternalFileDrag(
                    event
                )
            ) {
                return;
            }


            if (
                event.relatedTarget &&
                element.contains(
                    event.relatedTarget
                )
            ) {
                return;
            }


            element.removeClass(
                "is-item-drop-target"
            );
        }
    );


    element.addEventListener(
        "drop",
        async event => {

            if (
                !isExternalFileDrag(
                    event
                )
            ) {
                return;
            }


            event.preventDefault();

            /*
             * Do not let this external drop
             * reach our existing internal
             * move/reorder handlers.
             */
            event.stopImmediatePropagation();


            clearProjectItemDropIndicators();


            if (
                externalDragHasDirectory(
                    event
                )
            ) {
                return;
            }


            const files =
                Array.from(
                    event.dataTransfer
                        ?.files
                    ?? []
                );


            if (
                files.length === 0
            ) {
                return;
            }


            try {

                await importExternalFiles(
                    getTargetPath(),
                    files
                );

            } catch (error) {

                console.error(
                    "Could not import external files:",
                    error
                );
            }
        }
    );
}

async function createProjectItem(
    parentPath,
    kind,
    rawName
) {

    const path =
        projectItemPath(
            parentPath,
            kind,
            rawName
        );


    if (
        app.vault
            .getAbstractFileByPath(
                path
            )
    ) {

        throw new Error(
            `That ${kind} already exists here.`
        );
    }


    if (
        kind === "folder"
    ) {

        await app.vault
            .createFolder(
                path
            );

    } else {

        await app.vault
            .create(
                path,
                ""
            );
    }


    return path;
}

async function moveProjectItem(
    sourcePath,
    targetFolderPath
) {

    const item =
        app.vault
            .getAbstractFileByPath(
                sourcePath
            );


    const targetFolder =
        app.vault
            .getAbstractFileByPath(
                targetFolderPath
            );


    if (
        !item ||
        !isFolder(
            targetFolder
        )
    ) {

        throw new Error(
            "Source or target no longer exists."
        );
    }


    const name =
        item.name;


    const newPath =
        projectChildPath(
            targetFolderPath,
            item.name
        );


    if (
        newPath ===
        sourcePath
    ) {
        return sourcePath;
    }


    if (
        app.vault
            .getAbstractFileByPath(
                newPath
            )
    ) {

        throw new Error(
            `"${name}" already exists there.`
        );
    }


    /*
     * A folder cannot be moved
     * inside itself.
     */
    if (
        isFolder(item) &&
        (
            targetFolderPath ===
                sourcePath ||
            targetFolderPath
                .startsWith(
                    `${sourcePath}/`
                )
        )
    ) {

        throw new Error(
            "A folder cannot be moved inside itself."
        );
    }


    await app.fileManager
        .renameFile(
            item,
            newPath
        );


    return newPath;
}

async function moveProjectItemsTo(
    paths,
    targetFolderPath
) {

    const sourcePaths =
        selectedRootPaths(
            paths
        );


    const target =
        app.vault
            .getAbstractFileByPath(
                targetFolderPath
            );


    if (
        !isFolder(
            target
        )
    ) {

        throw new Error(
            "Target folder no longer exists."
        );
    }


    // ---------- PREFLIGHT ----------

    for (
        const sourcePath
        of sourcePaths
    ) {

        const source =
            app.vault
                .getAbstractFileByPath(
                    sourcePath
                );


        if (!source) {

            throw new Error(
                "One of the selected items no longer exists."
            );
        }


        if (
            source.parent?.path ===
            targetFolderPath
        ) {
            continue;
        }


        if (
            isFolder(
                source
            ) &&
            (
                targetFolderPath ===
                    sourcePath ||
                targetFolderPath
                    .startsWith(
                        `${sourcePath}/`
                    )
            )
        ) {

            throw new Error(
                "A folder cannot be moved inside itself."
            );
        }


        const destination =
            projectChildPath(
                targetFolderPath,
                source.name
            );


        if (
            app.vault
                .getAbstractFileByPath(
                    destination
                )
        ) {

            throw new Error(
                `"${source.name}" already exists there.`
            );
        }
    }


    // ---------- MOVE ----------

    for (
        const sourcePath
        of sourcePaths
    ) {

        const source =
            app.vault
                .getAbstractFileByPath(
                    sourcePath
                );


        if (
            !source ||
            source.parent?.path ===
                targetFolderPath
        ) {
            continue;
        }


        await moveProjectItem(
            sourcePath,
            targetFolderPath
        );
    }
}

async function renameProjectFolder(
    path,
    rawName
) {

    const folder =
        app.vault
            .getAbstractFileByPath(
                path
            );


    if (
        !isFolder(folder)
    ) {

        throw new Error(
            "Folder no longer exists."
        );
    }


    const separator =
        path.lastIndexOf("/");


    const parentPath =
        path.slice(
            0,
            separator
        );


    const newPath =
        projectItemPath(
            parentPath,
            "folder",
            rawName
        );


    if (
        newPath === path
    ) {
        return path;
    }


    if (
        app.vault
            .getAbstractFileByPath(
                newPath
            )
    ) {

        throw new Error(
            "A folder with that name already exists."
        );
    }


    await app.fileManager
        .renameFile(
            folder,
            newPath
        );


    return newPath;
}

async function renameTopLevelProjectFolder(
    descriptor,
    rawName
) {

    const oldPath =
        descriptor.path;

    const oldName =
        descriptor.title;


    const newPath =
        await renameProjectFolder(
            oldPath,
            rawName
        );


    if (
        newPath === oldPath
    ) {
        return;
    }


    const newName =
        newPath
            .split("/")
            .pop();


    // Keep folder_order correct.

    const orderIndex =
        folderOrder.indexOf(
            oldName
        );


    if (
        orderIndex !== -1
    ) {

        folderOrder[
            orderIndex
        ] =
            newName;


        await saveFolderOrder();
    }


    // Move persisted panel state too.

    if (
        Object.prototype
            .hasOwnProperty.call(
                savedFolderUiState,
                oldPath
            )
    ) {

        const persistedState =
            savedFolderUiState[
                oldPath
            ];


        if (
            typeof persistedState.currentPath ===
                "string" &&
            (
                persistedState.currentPath ===
                    oldPath ||
                persistedState.currentPath
                    .startsWith(
                        `${oldPath}/`
                    )
            )
        ) {

            persistedState.currentPath =
                newPath +
                persistedState.currentPath
                    .slice(
                        oldPath.length
                    );
        }


        savedFolderUiState[
            newPath
        ] =
            persistedState;


        delete savedFolderUiState[
            oldPath
        ];


        persistFolderUiState();
    }


    renderFolderPanels();
}


async function deleteTopLevelProjectFolder(
    descriptor
) {

    const folder =
        app.vault
            .getAbstractFileByPath(
                descriptor.path
            );


    if (
        !isFolder(
            folder
        )
    ) {

        throw new Error(
            "Folder no longer exists."
        );
    }


    await app.fileManager
        .trashFile(
            folder
        );


    // Remove stale ordering entry.

    folderOrder =
        folderOrder.filter(
            name =>
                name !==
                descriptor.title
        );


    await saveFolderOrder();


// Remove persisted state.

    delete savedFolderUiState[
        descriptor.path
    ];


    persistFolderUiState();


    renderFolderPanels();
}

// Workspace roots retain their local or shared Resource identity in the tree.
function projectFolderDescriptors() {

    const projectFolder =
        app.vault
            .getAbstractFileByPath(
                projectRoot
            );


    if (
        !isFolder(
            projectFolder
        )
    ) {
        return [];
    }


    const descriptors = [];


    /*
     * Direct project-root notes still
     * need somewhere to appear.
     *
     * The project hub itself is excluded.
     */
    const rootFiles =
        directFiles(
            projectFolder
        )
            .filter(
                file =>
                    file.path !==
                    current.file.path
            );


    if (
        rootFiles.length > 0
    ) {

        descriptors.push({
            path:
                projectRoot,

            title:
                isResourceContext
                    ? `${resourceType?.label ?? "Resource"} Root`
                    : "Project Root",

            isRoot:
                true
        });
    }


    const topLevelFolders =
        directFolders(
            projectFolder
        )
            .sort(
                (a, b) => {

                    /*
                    * Meta always remains first.
                    */
                    if (
                        a.name === "Meta"
                    ) {
                        return -1;
                    }


                    if (
                        b.name === "Meta"
                    ) {
                        return 1;
                    }


                    const aIndex =
                        folderOrder.indexOf(
                            a.name
                        );


                    const bIndex =
                        folderOrder.indexOf(
                            b.name
                        );


                    /*
                    * Once a project has an
                    * explicit folder order,
                    * respect it.
                    */
                    if (
                        aIndex !== -1 ||
                        bIndex !== -1
                    ) {

                        if (
                            aIndex === -1
                        ) {
                            return 1;
                        }


                        if (
                            bIndex === -1
                        ) {
                            return -1;
                        }


                        return (
                            aIndex -
                            bIndex
                        );
                    }


                    /*
                    * Old projects without an
                    * explicit order retain the
                    * existing alphabetical
                    * behaviour.
                    */
                    return a.name
                        .localeCompare(
                            b.name,
                            undefined,
                            {
                                sensitivity:
                                    "base"
                            }
                        );
                }
            );


    for (
        const folder
        of topLevelFolders
    ) {

        descriptors.push({
            path:
                folder.path,

            title:
                folder.name,

            isRoot:
                false
        });
    }

    if (!isResourceContext) {
        const attached =
            window.hubGetProjectResourceFolders?.(current.projectId) ?? [];

        for (const folder of attached) {
            if (!isFolder(app.vault.getAbstractFileByPath(folder.path))) {
                continue;
            }

            const owner = resourceTypes.find(item => item.id === folder.resourceType);
            descriptors.push({
                path: folder.path,
                title: folder.name,
                isRoot: false,
                sharedResource: true,
                resourceFolderId: folder.id,
                resourceType: folder.resourceType,
                resourceLabel: owner?.label ?? "Resource"
            });
        }
    }


    return descriptors;
}

async function moveTopLevelFolder(
    sourcePath,
    targetPath,
    placeAfter
) {

    const descriptors =
        projectFolderDescriptors()
            .filter(
                descriptor =>
                    !descriptor.isRoot &&
                    !descriptor.sharedResource
            );


    const source =
        descriptors.find(
            descriptor =>
                descriptor.path ===
                    sourcePath
        );


    const target =
        descriptors.find(
            descriptor =>
                descriptor.path ===
                    targetPath
        );


    if (
        !source ||
        !target ||
        source.path ===
            target.path ||
        source.title ===
            "Meta"
    ) {
        return;
    }


    const names =
        descriptors.map(
            descriptor =>
                descriptor.title
        );


    const sourceIndex =
        names.indexOf(
            source.title
        );


    names.splice(
        sourceIndex,
        1
    );


    const targetIndex =
        names.indexOf(
            target.title
        );


    /*
     * Meta always stays first.
     * Dropping onto it therefore means
     * placing the dragged folder after it.
     */
    const after =
        target.title === "Meta"
            ? true
            : placeAfter;


    const insertIndex =
        targetIndex +
        (
            after
                ? 1
                : 0
        );


    names.splice(
        insertIndex,
        0,
        source.title
    );


    folderOrder =
        names;


    await saveFolderOrder();


    renderFolderPanels();
}


function formatFileTime(
    timestamp
) {

    return formatDateTime(moment(timestamp));
}

let draggedFolderPath =
    null;


const selectedProjectItemPaths =
    new Set();


let selectionAnchorPath =
    null;


let draggedProjectItemPaths =
    [];

function clearProjectItemDropIndicators() {

    folderStack
        .querySelectorAll(
            ".is-item-drop-target"
        )
        .forEach(
            element => {

                element.removeClass(
                    "is-item-drop-target"
                );
            }
        );
}

function clearProjectItemSelection() {

    selectedProjectItemPaths
        .clear();

    selectionAnchorPath =
        null;

    syncProjectItemSelection();
}

dv.component.registerDomEvent(
    root.ownerDocument,
    "click",
    event => {

        if (
            selectedProjectItemPaths
                .size === 0
        ) {
            return;
        }


        /*
         * Ctrl/Cmd/Shift clicks on rows
         * are handled by the row's own
         * selection logic.
         */
        if (
            event.button !== 0 ||
            ((event.ctrlKey || event.metaKey || event.shiftKey) &&
                folderStack.contains(event.target.closest(".project-browser-row")))
        ) {
            return;
        }


        // Menu actions capture the selected paths before ordinary-click dismissal.
        if (event.target.closest(".menu")) queueMicrotask(clearProjectItemSelection);
        else clearProjectItemSelection();
    },
    true
);

dv.component.registerDomEvent(folderStack, "keydown", event => {
    if (event.target.closest("input, textarea, select, [contenteditable=true]")) return;
    const scope = event.target.closest(".hub-explorer-tree, .hub-explorer-contents") ?? folderStack;
    const rows = [...scope.querySelectorAll(".project-browser-row[data-path]")]
        .filter(item => item.getClientRects().length);
    const row = event.target.closest(".project-browser-row[data-path]");
    const key = event.key;
    if (key === "Escape") clearProjectItemSelection();
    else if ((event.ctrlKey || event.metaKey) && key.toLowerCase() === "a") {
        rows.forEach(item => selectedProjectItemPaths.add(item.dataset.path));
        syncProjectItemSelection();
    } else if (key === "Delete" && selectedProjectItemPaths.size) {
        deleteSelectedProjectItems().catch(error => {
            if (error?.name !== "HubProjectDeletionCancelled") console.error("Could not delete selected Hub files", error);
        });
    } else if (row && key === "Enter") row.click();
    else if (row && key === " ") {
        const path = row.dataset.path;
        if (selectedProjectItemPaths.has(path)) selectedProjectItemPaths.delete(path);
        else selectedProjectItemPaths.add(path);
        selectionAnchorPath = path;
        syncProjectItemSelection();
    } else if (row && ["ArrowUp", "ArrowDown", "Home", "End"].includes(key)) {
        const index = rows.indexOf(row);
        const nextIndex = key === "Home" ? 0 : key === "End" ? rows.length - 1
            : Math.max(0, Math.min(rows.length - 1, index + (key === "ArrowDown" ? 1 : -1)));
        const next = rows[nextIndex];
        if (!selectionAnchorPath) selectionAnchorPath = row.dataset.path;
        if (event.shiftKey) handleProjectItemSelection(event, next, next.dataset.path);
        else {
            selectedProjectItemPaths.clear();
            selectedProjectItemPaths.add(next.dataset.path);
            selectionAnchorPath = next.dataset.path;
            syncProjectItemSelection();
        }
        next.focus();
    } else return;
    event.preventDefault();
    event.stopPropagation();
});

function syncProjectItemSelection() {
    if (workspaceExplorer) { workspaceExplorer.syncSelection(); return; }
    for (const row of folderStack.querySelectorAll(".project-browser-row[data-path]")) {
        const selected = selectedProjectItemPaths.has(row.dataset.path);
        row.setAttribute("aria-selected", String(selected));
        row.classList.toggle("is-selected", selected);
    }
}


async function deleteSelectedProjectItems() {

    const paths =
        selectedRootPaths(
            [
                ...selectedProjectItemPaths
            ]
        );


    for (
        const path
        of paths
    ) {

        const item =
            app.vault
                .getAbstractFileByPath(
                    path
                );


        if (!item) {
            continue;
        }


        await app.fileManager
            .trashFile(
                item
            );
    }


    selectedProjectItemPaths
        .clear();

    selectionAnchorPath =
        null;


    renderFolderPanels();
}

function handleProjectItemSelection(
    event,
    row,
    path
) {

    const modifier =
        event.ctrlKey ||
        event.metaKey;


    // ---------- RANGE ----------

    if (
        event.shiftKey
    ) {

        const visibleRows =
            [
                ...(row.closest(".hub-explorer-tree, .hub-explorer-contents") ?? row.parentElement)
                    .querySelectorAll(
                        ".project-browser-row[data-path]"
                    )
            ];


        const anchorIndex =
            visibleRows.findIndex(
                candidate =>
                    candidate.dataset.path ===
                        selectionAnchorPath
            );


        const currentIndex =
            visibleRows.indexOf(
                row
            );


        if (
            !modifier
        ) {

            selectedProjectItemPaths
                .clear();
        }


        if (
            anchorIndex !== -1 &&
            currentIndex !== -1
        ) {

            const start =
                Math.min(
                    anchorIndex,
                    currentIndex
                );


            const end =
                Math.max(
                    anchorIndex,
                    currentIndex
                );


            for (
                let index = start;
                index <= end;
                index++
            ) {

                selectedProjectItemPaths
                    .add(
                        visibleRows[
                            index
                        ].dataset.path
                    );
            }

        } else {

            selectedProjectItemPaths
                .add(
                    path
                );


            selectionAnchorPath =
                path;
        }


        syncProjectItemSelection();

        event.preventDefault();
        event.stopPropagation();

        return true;
    }


    // ---------- INDIVIDUAL ----------

    if (
        modifier
    ) {

        if (
            selectedProjectItemPaths
                .has(
                    path
                )
        ) {

            selectedProjectItemPaths
                .delete(
                    path
                );

        } else {

            selectedProjectItemPaths
                .add(
                    path
                );
        }


        selectionAnchorPath =
            path;


        syncProjectItemSelection();

        event.preventDefault();
        event.stopPropagation();

        return true;
    }


    return false;
}

function handleProjectItemContextMenu(
    event,
    path,
    singleItemMenu = null
) {

    event.preventDefault();
    event.stopPropagation();


    /*
     * Conventional behavior:
     * right-clicking an unselected item
     * selects only that item.
     */
    if (
        !selectedProjectItemPaths
            .has(
                path
            )
    ) {

        selectedProjectItemPaths
            .clear();


        selectedProjectItemPaths
            .add(
                path
            );


        selectionAnchorPath =
            path;


        syncProjectItemSelection();
    }


    const selectedPaths =
        selectedRootPaths(
            [
                ...selectedProjectItemPaths
            ]
        );


    /*
     * One item can continue using its
     * normal item-specific menu.
     */
    if (
        selectedPaths.length === 1 &&
        singleItemMenu
    ) {

        singleItemMenu();

        return;
    }


    window
        .hubShowProjectSelectionMenu?.(
            event,
            {
                count:
                    selectedPaths.length,

                paths:
                    selectedPaths,


                moveTo:
                    async targetPath => {

                        await moveProjectItemsTo(
                            selectedPaths,
                            targetPath
                        );


                        clearProjectItemSelection();

                        renderFolderPanels();
                    },


                delete:
                    deleteSelectedProjectItems
            }
        );
}


function makeProjectItemDraggable(
    row,
    path
) {
    row.tabIndex = 0;
    row.setAttribute("role", "option");
    row.addEventListener("click", () => row.focus({ preventScroll: true }));
    row.addEventListener("mousedown", event => {
        if (event.button === 1) event.preventDefault(); // Do not start Windows autoscroll.
    });
    row.addEventListener("auxclick", async event => {
        if (event.button !== 1) return;
        const file = app.vault.getAbstractFileByPath(row.dataset.path);
        if (!file || isFolder(file)) return;
        event.preventDefault();
        event.stopPropagation();
        clearProjectItemSelection();
        await openProjectNote(file, "split");
    });

    row.draggable =
        true;


    row.addEventListener(
        "dragstart",
        event => {

            /*
             * Dragging an unselected item
             * starts a new one-item selection.
             *
             * Dragging an already-selected
             * item drags the whole selection.
             */
            if (
                !selectedProjectItemPaths
                    .has(
                        path
                    )
            ) {

                selectedProjectItemPaths
                    .clear();


                selectedProjectItemPaths
                    .add(
                        path
                    );


                selectionAnchorPath =
                    path;


                syncProjectItemSelection();
            }


            draggedProjectItemPaths =
                selectedRootPaths(
                    [
                        ...selectedProjectItemPaths
                    ]
                );


            folderStack
                .querySelectorAll(
                    ".project-browser-row.is-selected"
                )
                .forEach(
                    selectedRow => {

                        selectedRow.addClass(
                            "is-item-dragging"
                        );
                    }
                );


            event.dataTransfer
                .setData(
                    "text/plain",
                    path
                );


            window.hubStartFileDrag?.(event, draggedProjectItemPaths, root);
        }
    );


    row.addEventListener(
        "dragend",
        () => {

            draggedProjectItemPaths =
                [];


            folderStack
                .querySelectorAll(
                    ".is-item-dragging"
                )
                .forEach(
                    selectedRow => {

                        selectedRow.removeClass(
                            "is-item-dragging"
                        );
                    }
                );


            clearProjectItemDropIndicators();
        }
    );
}


function makeProjectItemDropTarget(
    element,
    getTargetPath
) {

    function canDropHere() {

        if (
            draggedProjectItemPaths
                .length === 0
        ) {
            return false;
        }


        const targetPath =
            getTargetPath();


        const target =
            app.vault
                .getAbstractFileByPath(
                    targetPath
                );


        if (
            !isFolder(
                target
            )
        ) {
            return false;
        }


        for (
            const sourcePath
            of draggedProjectItemPaths
        ) {

            const source =
                app.vault
                    .getAbstractFileByPath(
                        sourcePath
                    );


            if (!source) {
                return false;
            }


            if (
                isFolder(
                    source
                ) &&
                (
                    targetPath ===
                        sourcePath ||
                    targetPath
                        .startsWith(
                            `${sourcePath}/`
                        )
                )
            ) {

                return false;
            }


            const destination =
                `${targetPath}/${source.name}`;


            const existing =
                app.vault
                    .getAbstractFileByPath(
                        destination
                    );


            if (
                existing &&
                source.parent?.path !==
                    targetPath
            ) {

                return false;
            }
        }


        return true;
    }


    element.addEventListener(
        "dragover",
        event => {

            if (
                !canDropHere()
            ) {
                return;
            }


            event.preventDefault();
            event.stopPropagation();


            clearProjectItemDropIndicators();


            element.addClass(
                "is-item-drop-target"
            );


            event.dataTransfer.dropEffect =
                "move";
        }
    );


    element.addEventListener(
        "dragleave",
        event => {

            if (
                element.contains(
                    event.relatedTarget
                )
            ) {
                return;
            }


            element.removeClass(
                "is-item-drop-target"
            );
        }
    );


    element.addEventListener(
        "drop",
        async event => {

            if (
                !canDropHere()
            ) {
                return;
            }


            event.preventDefault();
            event.stopPropagation();


            const targetPath =
                getTargetPath();


            const sourcePaths =
                [
                    ...draggedProjectItemPaths
                ];


            draggedProjectItemPaths =
                [];


            clearProjectItemDropIndicators();


            try {

                for (
                    const sourcePath
                    of sourcePaths
                ) {

                    const source =
                        app.vault
                            .getAbstractFileByPath(
                                sourcePath
                            );


                    /*
                     * Already there:
                     * nothing to do.
                     */
                    if (
                        source?.parent?.path ===
                            targetPath
                    ) {
                        continue;
                    }


                    await moveProjectItem(
                        sourcePath,
                        targetPath
                    );
                }


                selectedProjectItemPaths
                    .clear();

                selectionAnchorPath =
                    null;


                renderFolderPanels();

            } catch (error) {

                console.error(
                    "Could not move project items:",
                    error
                );
            }
        }
    );
}

function clearFolderDropIndicators() {

    folderStack
        .querySelectorAll(
            ".is-drop-before, .is-drop-after"
        )
        .forEach(
            panel => {

                panel.classList.remove(
                    "is-drop-before",
                    "is-drop-after"
                );
            }
        );
}

// ---------- UNIFIED WORKSPACE EXPLORER ----------

let workspaceExplorer = null;

function explorerFolderActions(node, beginCreate) {
    const { descriptor, path, parent } = node;
    const actions = {
        name: node.name,
        path,
        newNote: () => beginCreate("note", path),
        newFolder: () => beginCreate("folder", path)
    };
    if (!parent) {
        if (!descriptor.isRoot && !descriptor.sharedResource) {
            actions.rename = name => renameTopLevelProjectFolder(descriptor, name);
            actions.delete = () => deleteTopLevelProjectFolder(descriptor);
        }
        if (descriptor.sharedResource) actions.detach = async () => {
            await window.hubDetachResourceFolder?.(current.file.path, descriptor.resourceFolderId);
            renderFolderPanels();
        };
    } else {
        actions.moveTo = async target => {
            await moveProjectItemsTo([path], target);
            clearProjectItemSelection(); renderFolderPanels();
        };
        actions.rename = async name => {
            await renameProjectFolder(path, name);
            clearProjectItemSelection(); renderFolderPanels();
        };
        actions.delete = async () => {
            const folder = app.vault.getAbstractFileByPath(path);
            if (isFolder(folder)) await app.fileManager.trashFile(folder);
            clearProjectItemSelection(); renderFolderPanels();
        };
    }
    return actions;
}

function decorateExplorerRow(row, node, presentation) {
    if (node.parent) makeProjectItemDraggable(row, node.path);
    if (node.folder) {
        makeProjectItemDropTarget(row, () => node.path);
        makeExternalFileDropTarget(row, () => node.path);
    }
    // Workspace roots retain their existing reorder behavior. Dragging a shared
    // root must never move the underlying Resource folder into the Project.
    if (node.parent || node.descriptor.isRoot || node.descriptor.sharedResource || presentation !== "tree") return;
    if (node.name !== "Meta") {
        row.draggable = true;
        row.addEventListener("dragstart", event => {
            draggedFolderPath = node.path;
            event.dataTransfer.setData("text/plain", node.path);
            event.dataTransfer.effectAllowed = "move";
            row.classList.add("is-item-dragging");
        });
        row.addEventListener("dragend", () => {
            draggedFolderPath = null; row.classList.remove("is-item-dragging"); clearFolderDropIndicators();
        });
    }
    const after = event => node.name === "Meta" || event.clientY > row.getBoundingClientRect().top + row.getBoundingClientRect().height / 2;
    row.addEventListener("dragover", event => {
        if (!draggedFolderPath || draggedFolderPath === node.path) return;
        event.preventDefault(); event.stopPropagation(); clearFolderDropIndicators();
        row.classList.add(after(event) ? "is-drop-after" : "is-drop-before");
    });
    row.addEventListener("dragleave", event => {
        if (!row.contains(event.relatedTarget)) clearFolderDropIndicators();
    });
    row.addEventListener("drop", async event => {
        if (!draggedFolderPath || draggedFolderPath === node.path) return;
        event.preventDefault(); event.stopPropagation();
        const source = draggedFolderPath; draggedFolderPath = null; clearFolderDropIndicators();
        await moveTopLevelFolder(source, node.path, after(event));
    });
}

async function createExplorerItem(parentPath, kind, name) {
    const isWorkspaceFolder = parentPath === projectRoot && kind === "folder";
    if (isWorkspaceFolder && !folderOrder.length) folderOrder = projectFolderDescriptors()
        .filter(descriptor => !descriptor.isRoot && !descriptor.sharedResource).map(descriptor => descriptor.title);
    const path = await createProjectItem(parentPath, kind, name);
    if (isWorkspaceFolder) {
        const folderName = path.split("/").pop();
        folderOrder = [...folderOrder.filter(value => value !== folderName), folderName];
        await saveFolderOrder();
    }
    return path;
}

function renderFolderPanels() {
    if (workspaceExplorer) { workspaceExplorer.refresh(); return; }
    workspaceExplorer = window.hubMountWorkspaceExplorer({
        parent: folderStack,
        workspacePath: projectRoot,
        dashboardPath: current.file.path,
        descriptors: projectFolderDescriptors,
        getByPath: path => app.vault.getAbstractFileByPath(path),
        states: () => savedFolderUiState,
        isNoteView: () => !!root.closest(".hub-project-rail") ||
            (!root.isConnected && dv.component.hubDestinationMode === "note"),
        persist: persistFolderUiState,
        setIcon: (element, icon) => window.hubSetIcon?.(element, icon),
        openFile: openProjectNote,
        createItem: createExplorerItem,
        formatTime: formatFileTime,
        selectedPaths: selectedProjectItemPaths,
        selectItem: handleProjectItemSelection,
        clearSelection: clearProjectItemSelection,
        decorateRow: decorateExplorerRow,
        decorateFolder: (element, path) => {
            makeProjectItemDropTarget(element, path);
            makeExternalFileDropTarget(element, path);
        },
        contextMenu: (event, node, beginCreate) => {
            const single = () => {
                if (node.folder) window.hubShowProjectFolderMenu?.(event, explorerFolderActions(node, beginCreate));
                else window.hubShowProjectFileMenu?.(event, node.path, {
                    moveTo: async target => {
                        await moveProjectItemsTo([node.path], target);
                        clearProjectItemSelection(); renderFolderPanels();
                    }
                });
            };
            if (!node.parent) { clearProjectItemSelection(); single(); }
            else handleProjectItemContextMenu(event, node.path, single);
        }
    });
    dv.component.register(() => workspaceExplorer?.destroy());
    const syncActiveFile = file => workspaceExplorer.setActive(file?.path ?? "");
    dv.component.registerEvent(app.workspace.on("file-open", syncActiveFile));
    // Seed remounted views from existing scoped history without opening a file
    // or changing the expansion restored by a preset.
    workspaceExplorer.setActive(window.hubGetLastNavigation?.(root)?.file?.path ?? "", { revealFile: false });
    const activeFile = app.workspace.getActiveFile?.();
    if (activeFile) syncActiveFile(activeFile);
    // Mode changes reuse this renderer; file-open alone does not signal them.
    const syncExplorerMode = () => workspaceExplorer?.syncMode();
    const modeObserver = new MutationObserver(syncExplorerMode);
    modeObserver.observe(root.ownerDocument.body, { attributes: true, attributeFilter: ["class"] });
    dv.component.registerEvent(app.workspace.on("layout-change", () => queueMicrotask(syncExplorerMode)));
    dv.component.register(() => modeObserver.disconnect());
}




renderFolderPanels();


/*
 * The plugin emits this when project
 * files/folders are added, renamed,
 * deleted or edited.
 */
root.hubCaptureFolders = () => ({ folders: structuredClone(savedFolderUiState), order: [...folderOrder] });
root.hubRestoreFolders = snapshot => {
    for (const key of Object.keys(savedFolderUiState)) delete savedFolderUiState[key];
    Object.assign(savedFolderUiState, snapshot.folders);
    folderOrder = [...snapshot.order];
    selectedProjectItemPaths.clear();
    selectionAnchorPath = null;
    workspaceExplorer.refresh({ restore: true });
};
dv.component.register(() => { delete root.hubCaptureFolders; delete root.hubRestoreFolders; });

root.addEventListener(
    "hub-project-files-changed",
    event => {

        const {
            path,
            oldPath
        } =
            event.detail ??
            {};


        const belongsHere =
            [
                path,
                oldPath
            ]
                .filter(Boolean)
                .some(
                    candidate =>
                        candidate ===
                            projectRoot ||
                        candidate
                            .startsWith(
                                `${projectRoot}/`
                            ) ||
                        (!isResourceContext && (
                            window.hubGetProjectResourceFolders?.(current.projectId) ?? []
                        ).some(folder =>
                            candidate === folder.path ||
                            candidate.startsWith(`${folder.path}/`)
                        ))
                );


        if (
            belongsHere
        ) {
            if (oldPath && path && oldPath !== path) workspaceExplorer.rename(oldPath, path);
            else renderFolderPanels();
        }
    }
);


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


const clearCompletedTasksButton =
    tasksTitle.createEl(
        "button",
        {
            cls:
                "project-task-clear-completed hub-panel-action hub-compact-panel-action"
        }
    );


clearCompletedTasksButton.createSpan({
    cls: "hub-compact-panel-action-label",
    text:
        "Clear"
});

// Match Home's compact action width, including its widest-label reference.
clearCompletedTasksButton.createSpan({
    cls: "hub-compact-panel-action-sizer",
    text: "Today",
    attr: { "aria-hidden": "true" }
});


clearCompletedTasksButton.setAttribute(
    "aria-label",
    "Clear all completed tasks"
);

const tasksBody =
    tasksPanel.createDiv({
        cls:
            "project-tasks-body"
    });


let currentProjectTasks = [];
let visibleCompletedTasks = [];

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


    clearCompletedTasksButton.disabled =
        completedTasks.length === 0;

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
        tasksBody.hubTaskUi.group("completed", completedTasks, task => renderTask(task, true));
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


clearCompletedTasksButton.addEventListener(
    "click",
    async event => {

        event.stopPropagation();


        if (
            visibleCompletedTasks.length === 0
        ) {
            return;
        }


        clearCompletedTasksButton.disabled =
            true;


        try {
            await clearCompletedProjectTasks(
                [...visibleCompletedTasks],
                true
            );
        } catch (error) {

            console.error(
                "Could not clear completed project tasks:",
                error
            );

        } finally {

            if (
                clearCompletedTasksButton.isConnected
            ) {
                clearCompletedTasksButton.disabled =
                    visibleCompletedTasks.length === 0;
            }
        }
    }
);


frame.defer(() => renderCurrentTasks());

window.hubTaskData?.subscribe(dv.component, () => {
    if (root.isConnected) renderCurrentTasks();
}, () => [projectRoot]);


// ---------- PROGRESS ----------

// Progress colors use the canonical Home palette.


let projectRatings = {};
let projectReports = [];


let projectLevelLabels =
    new Map();


function refreshProjectProgress() {

    const progress =
        window.hubGetProjectProgress?.(
            isResourceContext
                ? { kind: "resource", id: current.resourceType }
                : current.projectId
        )
        ?? {
            ratings: {},
            levels: []
        };


    projectRatings =
        progress.ratings
        ?? {};


    projectReports =
        window.hubGetProgressReports?.(
            isResourceContext
                ? { kind: "resource", id: current.resourceType }
                : current.projectId
        ) ?? [];


    projectLevelLabels =
        new Map(
            (
                progress.levels
                ?? []
            ).map(
                level => [
                    level.score,
                    level.label
                ]
            )
        );
}




const progressPanel =
    right.createDiv({
        cls:
            "project-panel project-progress"
    });

// ---------- DYNAMIC PROGRESS HEIGHT ----------

const MIN_PROGRESS_HEIGHT =
    320;


function syncProgressHeight() {

    /*
     * Wait until the dashboard is
     * actually attached and measurable.
     */
    if (
        !root.isConnected
    ) {
        return;
    }

    if (root.classList.contains("hub-full-view") && !root.closest(".hub-project-rail")) {
        progressPanel.style.removeProperty("height");
        return;
    }

    // Project Work now stretches Files to this stack. Do not feed the stretched
    // height back into Progress on resize; Resources keep their existing sync.
    if (!isResourceContext && !root.closest(".hub-project-rail")) {
        progressPanel.style.height = `${MIN_PROGRESS_HEIGHT}px`;
        return;
    }

    const leftRect =
        left.getBoundingClientRect();


    const rightRect =
        right.getBoundingClientRect();


    /*
     * On narrow layouts the two columns
     * stack vertically, so bottom-edge
     * alignment no longer makes sense.
     */
    const columnsAreAligned =
        Math.abs(
            leftRect.top -
            rightRect.top
        ) < 2;


    if (
        !columnsAreAligned
    ) {

        progressPanel.style.height =
            `${MIN_PROGRESS_HEIGHT}px`;

        return;
    }


    const folderRect = folderStack.getBoundingClientRect();


    const progressRect =
        progressPanel
            .getBoundingClientRect();


    const requiredHeight =
        folderRect.bottom -
        progressRect.top;


    const height =
        Math.max(
            MIN_PROGRESS_HEIGHT,
            requiredHeight
        );


    progressPanel.style.height =
        `${Math.round(height)}px`;
}

let progressHeightFrame =
    null;


function scheduleProgressHeightSync() {

    if (
        progressHeightFrame !==
        null
    ) {

        cancelAnimationFrame(
            progressHeightFrame
        );
    }


    progressHeightFrame =
        requestAnimationFrame(
            () => {

                progressHeightFrame =
                    null;

                syncProgressHeight();
            }
        );
}


const progressHeightObserver =
    new ResizeObserver(
        scheduleProgressHeightSync
    );


progressHeightObserver.observe(
    folderStack
);


progressHeightObserver.observe(
    grid
);


progressHeightObserver.observe(
    tasksPanel
);


scheduleProgressHeightSync();

const progressHeader =
    progressPanel.createDiv({
        cls:
            "project-progress-header"
    });


const progressTitle =
    progressHeader.createDiv({
        cls:
            "project-panel-title project-progress-title"
    });


const progressTitleIcon =
    progressTitle.createSpan({
        cls:
            "project-progress-title-icon"
    });


window.hubSetIcon?.(
    progressTitleIcon,
    "rocket"
);


progressTitle.createSpan({
    text:
        "Progress"
});


const progressToolbar = root.ownerDocument.createElement("div");


const previousYear =
    progressToolbar.createEl(
        "button",
        {
            cls:
                "project-progress-nav"
        }
    );


window.hubSetIcon?.(
    previousYear,
    "chevron-left"
);


const progressYearLabel =
    progressToolbar.createDiv({
        cls:
            "project-progress-year"
    });


const nextYear =
    progressToolbar.createEl(
        "button",
        {
            cls:
                "project-progress-nav"
        }
    );


window.hubSetIcon?.(
    nextYear,
    "chevron-right"
);


// ---------- HEATMAP ----------

const currentProgressYear =
    today.year;


const MIN_PROGRESS_YEAR =
    1900;


let progressYears = [currentProgressYear];
function loadInitialProgressYears() {
const ratedYears =
    Object.keys(
        projectRatings
    )
        .filter(
            date =>
                /^\d{4}-\d{2}-\d{2}$/
                    .test(date)
        )
        .map(
            date =>
                Number(
                    date.slice(
                        0,
                        4
                    )
                )
        );


const earliestProgressYear =
    ratedYears.length
        ? Math.min(
            currentProgressYear,
            ...ratedYears
        )
        : currentProgressYear;


progressYears =
    Array.from(
        {
            length:
                currentProgressYear -
                earliestProgressYear +
                1
        },

        (
            _,
            index
        ) =>
            earliestProgressYear +
            index
    );


}
let progressYear =
    currentProgressYear;


const progressCalendar =
    progressPanel.createDiv({
        cls:
            "project-progress-calendar"
    });


function alignProjectProgressMonths() {

    const months =
        progressCalendar
            .querySelector(
                ".heatmap-calendar-months"
            );


    const boxes =
        progressCalendar
            .querySelector(
                ".heatmap-calendar-boxes"
            );


    if (
        !months ||
        !boxes
    ) {
        return;
    }


    const labels =
        [
            ...months.children
        ];


    const cells =
        [
            ...boxes.children
        ];


    const monthNames = [
        "jan",
        "feb",
        "mar",
        "apr",
        "may",
        "jun",
        "jul",
        "aug",
        "sep",
        "oct",
        "nov",
        "dec"
    ];


    const starts =
        monthNames.map(
            name => {

                const firstCell =
                    boxes.querySelector(
                        `.month-${name}`
                    );


                const index =
                    cells.indexOf(
                        firstCell
                    );


                return (
                    Math.floor(
                        index / 7
                    ) + 1
                );
            }
        );


    labels.forEach(
        (
            label,
            index
        ) => {

            const start =
                starts[index];


            const end =
                index < 11
                    ? starts[
                        index + 1
                    ]
                    : 54;


            label.style.gridColumn =
                `${start} / ${end}`;
        }
    );
}


function renderProjectProgressYear() {

    progressCalendar.empty();


    progressYearLabel.setText(
        String(
            progressYear
        )
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
            projectRatings
        )
            .filter(
                ([date]) =>
                    Number(
                        date.slice(
                            0,
                            4
                        )
                    ) ===
                        progressYear
            )
            .map(
                (
                    [
                        date,
                        score
                    ]
                ) => ({
                    date,

                    score:
                        Number(
                            score
                        )
                })
            )
            .filter(
                item =>
                    Number.isInteger(
                        item.score
                    ) &&
                    item.score >= 1 &&
                    item.score <= 4
            );


    if (
        typeof renderHeatmapCalendar
        !== "function"
    ) {

        el(
            progressCalendar,
            "div",
            "project-empty",
            "Heatmap Calendar is not enabled."
        );

        return;
    }


    renderHeatmapCalendar(
        progressCalendar,
        {
            year:
                progressYear,

            colors:
                progressColors,

            intensityScaleStart:
                1,

            intensityScaleEnd:
                4,

            showCurrentDayBorder:
                progressYear ===
                currentProgressYear,

            entries:
                yearRatings.map(
                    item => ({
                        date:
                            item.date,

                        intensity:
                            item.score
                    })
                )
        }
    );


    alignProjectProgressMonths();
    placeHeatmapNavigation(progressCalendar, progressToolbar, previousYear, progressYearLabel, nextYear);


    for (
        const item
        of yearRatings
    ) {

        const element =
            progressCalendar
                .querySelector(
                    `[data-date="${item.date}"]`
                );


        if (!element) {
            continue;
        }


        element.style.backgroundColor = progressColor(item.score);

        const label =
            projectLevelLabels.get(
                item.score
            )
            ?? `Level ${item.score}`;


        element.dataset.hubProgressDetails =
            `${label}\n${item.score}/4`;
    }


    window.hubEnableProgressCalendarEditing?.(
        progressCalendar,
        {
            year:
                progressYear,

            projectId:
                isResourceContext
                    ? `resource:${current.resourceType}`
                    : current.projectId
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


        renderProjectProgressYear();
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


        renderProjectProgressYear();
    }
);


frame.defer(() => { refreshProjectProgress(); loadInitialProgressYears(); renderProjectProgressYear(); });


root.addEventListener(
    "hub-progress-changed",
    event => {

        const changedProjectIds =
            event.detail?.projectIds
            ?? [];


        if (
            changedProjectIds.length > 0 &&
            !changedProjectIds.includes(
                contextId
            )
        ) {
            return;
        }


        refreshProjectProgress();

        renderProjectProgressYear();


        if (
            progressView === "reports"
        ) {
            renderProjectProgressView();
        }
    }
);


// ---------- PROJECT REPORTS / ACTIVITY ----------

const progressTabs =
    progressPanel.createDiv({
        cls:
            "project-progress-tabs hub-panel-selectors"
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
        "obsidian-hub::project-progress-view"
    );


let progressView =
    [
        "reports",
        "activity",
        "tasks"
    ].includes(savedProgressView)
        ? savedProgressView
        : "reports";

const activitySection =
    progressPanel.createDiv({
        cls:
            "project-progress-activity"
    });


const activityBody =
    activitySection.createDiv({
        cls:
            "project-progress-activity-body"
    });
activityBody.hubMarkdown = window.hubCreateMarkdown?.(dv.component);
const historyPager = createHistoryPager(activityBody, dv.component);

// ---------- ACTIVITY SCROLL HEIGHT ----------

let activityHeightFrame =
    null;


function syncProjectActivityHeight() {

    if (
        !progressPanel.isConnected
    ) {
        return;
    }


    if (root.classList.contains("hub-full-view") && !root.closest(".hub-project-rail")) {
        activitySection.style.removeProperty("height");
        return;
    }

    const panelRect =
        progressPanel
            .getBoundingClientRect();


    const activityRect =
        activitySection
            .getBoundingClientRect();


    const panelStyle =
        getComputedStyle(
            progressPanel
        );


    const bottomPadding =
        parseFloat(
            panelStyle.paddingBottom
        ) || 0;


    const availableHeight =
        Math.max(
            0,

            panelRect.bottom -
            bottomPadding -
            activityRect.top
        );


    activitySection.style.height =
        `${Math.floor(
            availableHeight
        )}px`;
}


function scheduleProjectActivityHeight() {

    if (
        activityHeightFrame !==
        null
    ) {

        cancelAnimationFrame(
            activityHeightFrame
        );
    }


    activityHeightFrame =
        requestAnimationFrame(
            () => {

                activityHeightFrame =
                    null;

                syncProjectActivityHeight();
            }
        );
}


const activityHeightObserver =
    new ResizeObserver(
        scheduleProjectActivityHeight
    );


activityHeightObserver.observe(
    progressPanel
);


activityHeightObserver.observe(
    progressCalendar
);


scheduleProjectActivityHeight();

// ---------- PROGRESS WHEEL SCROLL ----------

let activityScrollTarget =
    activityBody.scrollTop;


let activityScrollFrame =
    null;


function stopActivityScrollAnimation() {

    if (
        activityScrollFrame !==
        null
    ) {

        cancelAnimationFrame(
            activityScrollFrame
        );

        activityScrollFrame =
            null;
    }


    activityScrollTarget =
        activityBody.scrollTop;
}


function animateActivityScroll() {

    const maxScroll =
        Math.max(
            0,

            activityBody.scrollHeight -
            activityBody.clientHeight
        );


    activityScrollTarget =
        Math.max(
            0,

            Math.min(
                maxScroll,
                activityScrollTarget
            )
        );


    const current =
        activityBody.scrollTop;


    const distance =
        activityScrollTarget -
        current;


    if (
        Math.abs(
            distance
        ) < 0.5
    ) {

        activityBody.scrollTop =
            activityScrollTarget;


        activityScrollFrame =
            null;

        return;
    }


    activityBody.scrollTop =
        current +
        distance * 0.22;


    activityScrollFrame =
        requestAnimationFrame(
            animateActivityScroll
        );
}


activityBody.addEventListener(
    "scroll",
    () => {

        if (
            activityScrollFrame ===
            null
        ) {

            activityScrollTarget =
                activityBody.scrollTop;
        }
    }
);


progressPanel.addEventListener(
    "wheel",
    event => {

        /*
         * Directly over history:
         * retain native scrolling.
         */
        if (
            event.target.closest(
                ".project-progress-activity-body"
            )
        ) {

            stopActivityScrollAnimation();

            return;
        }


        const maxScroll =
            Math.max(
                0,

                activityBody.scrollHeight -
                activityBody.clientHeight
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
                activityBody.clientHeight;
        }


        if (
            delta === 0
        ) {
            return;
        }


        const current =
            activityBody.scrollTop;


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

            stopActivityScrollAnimation();

            return;
        }


        event.preventDefault();


        if (
            activityScrollFrame ===
            null
        ) {

            activityScrollTarget =
                current;
        }


        activityScrollTarget =
            Math.max(
                0,

                Math.min(
                    maxScroll,

                    activityScrollTarget +
                    delta
                )
            );


        if (
            activityScrollFrame ===
            null
        ) {

            activityScrollFrame =
                requestAnimationFrame(
                    animateActivityScroll
                );
        }
    },
    {
        passive:
            false
    }
);

function projectActivityIcon(
    action
) {

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


function belongsToCurrentProject(
    item
) {

    if (isResourceContext) {
        if (item.contextKind === "resource" || item.resourceType) {
            return item.resourceType === current.resourceType;
        }

        return [item.path, item.oldPath]
            .filter(Boolean)
            .some(path =>
                path === current.file.path ||
                path === projectRoot ||
                path.startsWith(`${projectRoot}/`)
            );
    }

    if (
        item.projectId
    ) {

        return (
            item.projectId ===
            current.projectId
        );
    }


    /*
     * Temporary fallback for activity
     * recorded before projectId was added.
     */
    return [
        item.path,
        item.oldPath
    ]
        .filter(Boolean)
        .some(
            path =>
                path ===
                    current.file.path ||
                path ===
                    projectRoot ||
                path.startsWith(
                    `${projectRoot}/`
                )
        );
}


function projectActivityTitle(
    item
) {

    switch (
        item.action
    ) {

        case "created":
            return (
                `Created "${item.title}"`
            );


        case "edited":
            return (
                `Edited "${item.title}"`
            );


        case "deleted":
            return (
                `Deleted "${item.title}"`
            );


        case "renamed":
            return (
                `Renamed "${item.oldTitle}" to "${item.title}"`
            );


        case "project-created":
            return (
                "Created project"
            );


        case "project-renamed":
            return (
                `Renamed project from "${item.oldTitle}"`
            );


        default:
            return (
                item.title ??
                item.action
            );
    }
}


function projectActivityLocationParts(
    item
) {

    if (
        item.action
            ?.startsWith(
                "project-"
            )
    ) {
        return [];
    }


    const path =
        String(
            item.path ?? ""
        );


    if (
        !path.startsWith(
            `${projectRoot}/`
        )
    ) {
        return [];
    }


    const relative =
        path.slice(
            projectRoot.length + 1
        );


    const parts =
        relative
            .split("/")
            .filter(Boolean);


    /*
     * Filename is already displayed
     * in the activity title.
     */
    parts.pop();


    return parts.length
        ? parts
        : [
            isResourceContext ? "Resource Root" : "Project Root"
        ];
}


function renderProjectReports() {
    historyPager.reset();

    activityBody.hubMarkdown?.clear();
    activityBody.empty();


    const reports =
        projectReports;


    if (reports.length === 0) {

        el(
            activityBody,
            "div",
            "project-empty",
            "No progress reports yet."
        );

        return;
    }


    historyPager.render(reports, (report) => {

        const row =
            activityBody.createDiv({
                cls:
                    "project-progress-report-row"
            });


        const content =
            row.createDiv({
                cls:
                    "project-progress-report-content"
            });


        const icon =
            content.createSpan({
                cls:
                    "project-activity-icon is-progress-report"
            });


        window.hubSetIcon?.(
            icon,
            "clipboard-check"
        );


        const summary = el(
            content,
            "div",
            "project-progress-report-summary" +
                (
                    report.summary
                        ? ""
                        : " is-empty"
                ),
            report.summary ||
                "No summary recorded."
        );
        if (report.summary) {
            summary.classList.add("hub-report-reflection");
            void activityBody.hubMarkdown?.render(summary, report.summary, current.file.path);
        }


        const meta =
            row.createDiv({
                cls:
                    "project-progress-report-meta"
            });


        if (report.score !== null) {
            el(
                meta,
                "span",
                "project-progress-report-score",
                `${report.score}/4`
            );
        }


        const time = meta.createDiv({ cls: "project-activity-time" });
        time.title = Number.isFinite(report.timestamp)
            ? formatDateTime(moment(report.timestamp)) : formatDate(moment(report.date, "YYYY-MM-DD"));
        el(time, "div", "project-activity-date", historyDate(moment(report.date, "YYYY-MM-DD")));
        if (Number.isFinite(report.timestamp)) {
            el(time, "div", "project-activity-clock", formatTime(moment(report.timestamp)));
        }


        makeActionableRow(
            row,
            event => {
                window.hubOpenProgressEditor?.(
                    report.date,
                    isResourceContext
                        ? { kind: "resource", id: current.resourceType }
                        : current.projectId
                );
            }
        );
    });
}


function renderProjectTaskHistory() {
    historyPager.reset();

    activityBody.hubMarkdown?.clear();
    activityBody.empty();


    const items =
        (
            window
                .hubGetCompletedTaskHistory?.()
            ?? []
        )
            .filter(item => {
                if (isResourceContext) {
                    return (
                        item.resourceType === current.resourceType ||
                        item.projectRoot === projectRoot
                    );
                }

                if (current.projectId && item.projectId) {
                    return item.projectId === current.projectId;
                }

                return (
                    item.projectRoot === projectRoot ||
                    item.projectPath === current.file.path
                );
            })
            .sort(
                (a, b) =>
                    Number(b.timestamp) -
                    Number(a.timestamp)
            );


    if (items.length === 0) {

        el(
            activityBody,
            "div",
            "project-empty",
            "No task progress recorded."
        );

        return;
    }


    historyPager.render(items, (item) => {

        const row =
            activityBody.createDiv({
                cls:
                    "project-activity-row project-completed-task-row"
            });


        const icon =
            row.createSpan({
                cls:
                    "project-activity-icon " + (item.kind === "step" ? "is-step-progress" : "is-completed-task")
            });


        window.hubSetIcon?.(
            icon,
            item.kind === "step" ? "circle-check" : "square-check"
        );


        const info =
            row.createDiv({
                cls:
                    "project-activity-info"
            });


        const progressText = item.kind === "step" ? `${item.parentText} \u00b7 ${item.text}` : item.text;
        const title = el(info, "div", "project-activity-title", progressText);
        void activityBody.hubMarkdown?.render(title, progressText, item.path || current.file.path);


        const sourceRoot =
            item.projectRoot ||
            projectRoot;

        const sourceLocation =
            item.path === item.projectPath ||
            item.path === current.file.path
                ? (isResourceContext ? "Resource Hub" : "Project Hub")
                : item.path.startsWith(
                    `${sourceRoot}/`
                )
                    ? item.path
                        .slice(
                            sourceRoot.length + 1
                        )
                        .replace(/\.md$/i, "")
                        .split("/")
                        .filter(Boolean)
                        .join(" › ") ||
                        (isResourceContext ? "Resource Root" : "Project Root")
                    : String(item.path)
                        .split("/")
                        .pop()
                        ?.replace(/\.md$/i, "") ||
                        (isResourceContext ? "Resource Root" : "Project Root");


        el(
            info,
            "div",
            "project-activity-location",
            sourceLocation
        );


        const when =
            moment(
                item.timestamp
            );

        const time =
            row.createDiv({
                cls:
                    "project-activity-time"
            });


        time.title = formatDateTime(when);
        el(
            time,
            "div",
            "project-activity-date",
            historyDate(when)
        );


        el(
            time,
            "div",
            "project-activity-clock",
            formatTime(when)
        );


        const file =
            app.vault
                .getAbstractFileByPath(
                    item.path
                );


        if (file) {

            row.addClass(
                "is-clickable"
            );


            makeActionableRow(
                row,
                async () => {

                    const currentFile =
                        app.vault
                            .getAbstractFileByPath(
                                item.path
                            );


                    if (currentFile) {
                        await openProjectNote(
                            currentFile
                        );
                    }
                }
            );
        }
    });
}


function renderProjectProgressView() {

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
        renderProjectReports();
    } else if (progressView === "activity") {
        renderProjectActivity();
    } else {
        renderProjectTaskHistory();
    }


    scheduleProjectActivityHeight();
}


reportsTab.addEventListener(
    "click",
    () => {
        progressView = "reports";
        sessionStorage.setItem(
            "obsidian-hub::project-progress-view",
            progressView
        );
        activityBody.scrollTop = 0;
        activityScrollTarget = 0;
        renderProjectProgressView();
    }
);


activityTab.addEventListener(
    "click",
    () => {
        progressView = "activity";
        sessionStorage.setItem(
            "obsidian-hub::project-progress-view",
            progressView
        );
        activityBody.scrollTop = 0;
        activityScrollTarget = 0;
        renderProjectProgressView();
    }
);


tasksTab.addEventListener(
    "click",
    () => {
        progressView = "tasks";
        sessionStorage.setItem(
            "obsidian-hub::project-progress-view",
            progressView
        );
        activityBody.scrollTop = 0;
        activityScrollTarget = 0;
        renderProjectProgressView();
    }
);

function renderProjectActivity() {
    historyPager.reset();

    activityBody.hubMarkdown?.clear();
    activityBody.empty();


    const items =
        (
            window
                .hubGetActivityLog?.()
            ?? []
        )
            .filter(
                belongsToCurrentProject
            )
            .sort(
                (
                    a,
                    b
                ) =>
                    Number(
                        b.timestamp
                    ) -
                    Number(
                        a.timestamp
                    )
            )
            ;


    if (
        items.length === 0
    ) {

        el(
            activityBody,
            "div",
            "project-empty",
            "No recent activity."
        );

        return;
    }


    historyPager.render(items, (item) => {

        const row =
            activityBody.createDiv({
                cls:
                    "project-activity-row"
            });


        const icon =
            row.createSpan({
                cls:
                    `project-activity-icon is-${item.action}`
            });


        window.hubSetIcon?.(
            icon,
            projectActivityIcon(
                item.action
            )
        );


        const info =
            row.createDiv({
                cls:
                    "project-activity-info"
            });


        el(
            info,
            "div",
            "project-activity-title",
            projectActivityTitle(
                item
            )
        );


        const locationParts =
            projectActivityLocationParts(
                item
            );


        if (
            locationParts.length > 0
        ) {

            const breadcrumb =
                info.createDiv({
                    cls:
                        "project-activity-location project-activity-breadcrumb"
                });


            locationParts.forEach(
                (
                    part,
                    index
                ) => {

                    breadcrumb.createSpan({
                        cls:
                            "project-activity-breadcrumb-part",

                        text:
                            part
                    });


                    if (
                        index <
                        locationParts.length - 1
                    ) {

                        const separator =
                            breadcrumb.createSpan({
                                cls:
                                    "project-activity-breadcrumb-separator"
                            });


                        window.hubSetIcon?.(
                            separator,
                            "chevron-right"
                        );
                    }
                }
            );
        }


        const when =
            moment(
                item.timestamp
            );


        const time =
            row.createDiv({
                cls:
                    "project-activity-time"
            });


        time.title = formatDateTime(when);
        el(
            time,
            "div",
            "project-activity-date",
            historyDate(when)
        );


        el(
            time,
            "div",
            "project-activity-clock",
            formatTime(when)
        );


        const deleted =
            item.action ===
                "deleted" ||
            item.action ===
                "project-deleted";


        if (!deleted) {

            const file =
                app.vault
                    .getAbstractFileByPath(
                        item.path
                    );


            if (file) {

                row.addClass(
                    "is-clickable"
                );


                makeActionableRow(
                    row,
                    async () => {

                        const currentFile =
                            app.vault
                                .getAbstractFileByPath(
                                    item.path
                                );


                        if (
                            currentFile
                        ) {

                            await openProjectNote(
                                currentFile
                            );
                        }
                    }
                );
            }
        }
    });
}


frame.defer(() => renderProjectProgressView());


root.addEventListener(
    "hub-activity-changed",
    () => {

        if (
            progressView === "activity"
        ) {
            renderProjectProgressView();
        }
    }
);


root.addEventListener(
    "hub-completed-tasks-changed",
    event => {

        const linesByPath =
            new Map();


        for (
            const item
            of event.detail?.deleted ?? []
        ) {

            if (!linesByPath.has(item.path)) {
                linesByPath.set(
                    item.path,
                    []
                );
            }


            linesByPath.get(item.path)
                .push(item.line);
        }


        currentProjectTasks =
            currentProjectTasks.filter(
                task => {

                    const deletedLines =
                        linesByPath.get(
                            task.path
                        ) ?? [];


                    if (
                        deletedLines.includes(
                            task.line
                        )
                    ) {
                        return false;
                    }


                    task.line -=
                        deletedLines.filter(
                            line =>
                                line < task.line
                        ).length;


                    return true;
                }
            );


        renderTaskRows();


        if (progressView === "tasks") {
            renderProjectProgressView();
        }
    }
);


taskWorkspace = window.hubMountTaskWorkspace?.({
    component: dv.component, dv, root, toolbar: shortcutsBar, filesGrid: grid, filesPanel: folderStack, roadmapParent: left,
    workspace: { root: projectRoot, projectId: contextId, name: current.file.name,
        contextKind: isResourceContext ? "resource" : "project" },
    onFiles: () => { renderCurrentTasks(); scheduleProgressHeightSync(); },
    openSource: path => {
        const file = app.vault.getAbstractFileByPath(path);
        if (file) return openProjectNote(file);
    }
});
window.hubRegisterSearchWorkspace?.(dv.component, root, searchWorkspace, path => {
    taskWorkspace?.showFiles();
    workspaceExplorer?.selectFolderPath(path);
}, (kind, id) => taskWorkspace?.focusPlanning(kind, id));
frame.defer(() => window.hubApplySearchFolder?.(root));
frame.commit();
window.hubMountFullViewLayout?.(root, dv.component);
if (window.hubEnterDashboard) {
    window.hubEnterDashboard(root);
} else {
    root.classList.remove(
        "is-hub-cover-pending"
    );
}
