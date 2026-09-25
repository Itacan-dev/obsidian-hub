const today =
    dv.date("today");

const current =
    dv.current();


// ---------- HELPERS ----------

const {
    el,
    historyHeading,
    historyKind,
    createHistoryPager,
    historyDate,
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


const allShortcuts =
    window.hubGetAppShortcuts?.()
    ?? [];


const shortcutsById =
    new Map(
        allShortcuts.map(
            shortcut => [
                shortcut.id,
                shortcut
            ]
        )
    );


const projectShortcuts =
    (
        category?.shortcuts ??
        []
    )
        .map(
            id =>
                shortcutsById.get(id)
        )
        .filter(Boolean);


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
    today.toFormat(
        "cccc, d LLLL, yyyy"
    )
);


el(
    dateBox,
    "div",
    "project-week",
    `Week ${today.weekNumber}`
);


// ---------- APP SHORTCUTS ----------

const shortcutsBar =
    root.createDiv({
        cls:
            "project-shortcuts"
    });


markDashboardRow(
    shortcutsBar,
    3
);


const shortcutsTitle =
    shortcutsBar.createDiv({
        cls:
            "project-shortcuts-title"
    });


const shortcutsTitleIcon =
    shortcutsTitle.createSpan({
        cls:
            "project-shortcuts-title-icon"
    });


window.hubSetIcon?.(
    shortcutsTitleIcon,
    "app-window"
);


shortcutsTitle.createSpan({
    text:
        "App Shortcuts"
});


const shortcutButtons =
    shortcutsBar.createDiv({
        cls:
            "project-shortcut-buttons"
    });


if (
    projectShortcuts.length === 0
) {

    el(
        shortcutButtons,
        "div",
        "project-empty",
        "No shortcuts configured."
    );

} else {

    for (
        const shortcut
        of projectShortcuts
    ) {

        const button =
            shortcutButtons.createEl(
                "button",
                {
                    cls:
                        "project-shortcut-button"
                }
            );


        const icon =
            button.createSpan({
                cls:
                    "project-shortcut-icon"
            });


        const iconFile =
            shortcut.icon
                ? app.vault
                    .getAbstractFileByPath(
                        shortcut.icon
                    )
                : null;


        if (iconFile) {

            const image =
                icon.createEl(
                    "img"
                );


            image.src =
                app.vault
                    .getResourcePath(
                        iconFile
                    );

            image.alt = "";

        } else {

            window.hubSetIcon?.(
                icon,

                shortcut.type ===
                    "website"
                    ? "globe-2"
                    : "app-window"
            );
        }


        button.createSpan({
            text:
                shortcut.label
        });


        button.addEventListener(
            "click",
            async () => {

                button.disabled =
                    true;


                try {

                    await window
                        .hubOpenAppShortcut?.(
                            shortcut.id
                        );

                } finally {

                    button.disabled =
                        false;
                }
            }
        );
    }
}


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

// ---------- FOLDER PANELS ----------

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


function saveFolderUiState(
    path,
    state
) {

    savedFolderUiState[
        path
    ] = {
        currentPath:
            state.currentPath,

        search:
            state.search,

        sortKey:
            state.sortKey,

        sortDirection:
            state.sortDirection,

        collapsed:
            state.collapsed,

        manualHeight:
            state.manualHeight
    };


    persistFolderUiState();
}


const folderState =
    new Map();

const FOLDER_SIZE = {
    empty:
        130,

    firstItem:
        104,

    itemStep:
        45,

    autoMax:
        204
};


function automaticFolderHeight(
    itemCount
) {

    if (
        itemCount <= 0
    ) {
        return FOLDER_SIZE.empty;
    }


    return Math.min(
        FOLDER_SIZE.autoMax,

        FOLDER_SIZE.firstItem +
        (
            itemCount - 1
        ) *
        FOLDER_SIZE.itemStep
    );
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

function projectFileDisplayName(
    file
) {

    return (
        file.extension === "md"
            ? file.basename
            : file.name
    );
}


function projectFileIcon(
    file
) {
    return window.hubFileIcon?.(file) ?? "file";
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


    // Move live panel state to the new path.

    const liveState =
        folderState.get(
            oldPath
        );


    if (liveState) {

        folderState.delete(
            oldPath
        );


        if (
            liveState.currentPath ===
                oldPath ||
            liveState.currentPath
                .startsWith(
                    `${oldPath}/`
                )
        ) {

            liveState.currentPath =
                newPath +
                liveState.currentPath
                    .slice(
                        oldPath.length
                    );
        }


        folderState.set(
            newPath,
            liveState
        );
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


    // Remove live state.

    folderState.delete(
        descriptor.path
    );


    // Remove persisted state.

    delete savedFolderUiState[
        descriptor.path
    ];


    persistFolderUiState();


    renderFolderPanels();
}

/*
 * Only top-level folders become panels.
 *
 * Nested folders are navigated inside
 * their parent panel.
 */
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


function breadcrumbParts(
    descriptor,
    currentPath
) {

    if (
        descriptor.isRoot
    ) {

        return [
            {
                name:
                    isResourceContext
                        ? "Resource Root"
                        : "Project Root",

                path:
                    projectRoot
            }
        ];
    }


    const scopeRoot =
        descriptor.sharedResource
            ? descriptor.path.split("/").slice(0, -1).join("/")
            : projectRoot;

    const relative =
        currentPath
            .slice(
                scopeRoot.length
            )
            .replace(
                /^\/+/,
                ""
            );


    const names =
        relative
            .split("/")
            .filter(Boolean);


    return names.map(
        (
            name,
            index
        ) => ({
            name,

            path:
                `${scopeRoot}/${
                    names
                        .slice(
                            0,
                            index + 1
                        )
                        .join("/")
                }`
        })
    );
}

function folderPanelItemCount(
    folder,
    descriptor
) {

    let files =
        directFiles(
            folder
        );


    if (
        descriptor.isRoot
    ) {

        files =
            files.filter(
                file =>
                    file.path !==
                    current.file.path
            );
    }


    const folders =
        descriptor.isRoot
            ? []
            : directFolders(
                folder
            );


    return (
        files.length +
        folders.length
    );
}

function compareNames(
    a,
    b
) {

    return String(a)
        .localeCompare(
            String(b),
            undefined,
            {
                sensitivity:
                    "base"
            }
        );
}


function formatFileTime(
    timestamp
) {

    return moment(
        timestamp
    ).format(
        "HH:mm, DD/MM/YY"
    );
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
    const rows = [...folderStack.querySelectorAll(".project-browser-row[data-path]")]
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

    folderStack
        .querySelectorAll(
            ".project-browser-row[data-path]"
        )
        .forEach(
            row => {

                row.setAttribute("aria-selected", String(selectedProjectItemPaths.has(row.dataset.path)));
                row.toggleClass(
                    "is-selected",

                    selectedProjectItemPaths
                        .has(
                            row.dataset.path
                        )
                );
            }
        );
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
                ...row.parentElement
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

function renderFolderPanel(
    descriptor
) {

    const savedUi =
        savedFolderUiState[
            descriptor.path
        ] ?? {};


    const state =
        folderState.get(
            descriptor.path
        )
        ?? {
            currentPath:
                typeof savedUi.currentPath ===
                    "string"
                    ? savedUi.currentPath
                    : descriptor.path,

            search:
                typeof savedUi.search ===
                    "string"
                    ? savedUi.search
                    : "",

            sortKey:
                [
                    "name",
                    "modified",
                    "created"
                ].includes(
                    savedUi.sortKey
                )
                    ? savedUi.sortKey
                    : "modified",

            sortDirection:
                [
                    "asc",
                    "desc"
                ].includes(
                    savedUi.sortDirection
                )
                    ? savedUi.sortDirection
                    : "desc",

            createKind:
                null,

            collapsed:
                savedUi.collapsed ===
                    true,

            autoFloor:
                FOLDER_SIZE.empty,

            manualHeight:
                Number.isFinite(
                    savedUi.manualHeight
                )
                    ? savedUi.manualHeight
                    : FOLDER_SIZE.empty
        };


    folderState.set(
        descriptor.path,
        state
    );


    /*
     * The folder may have been deleted
     * or renamed while the dashboard was
     * open. Fall back to the panel root.
     */
    let currentFolder =
        app.vault
            .getAbstractFileByPath(
                state.currentPath
            );


    const currentPathBelongsToPanel =
        state.currentPath ===
            descriptor.path ||
        state.currentPath
            .startsWith(
                `${descriptor.path}/`
            );


    if (
        !currentPathBelongsToPanel ||
        !isFolder(
            currentFolder
        )
    ) {

        state.currentPath =
            descriptor.path;


        currentFolder =
            app.vault
                .getAbstractFileByPath(
                    descriptor.path
                );


        saveFolderUiState(
            descriptor.path,
            state
        );
    }


    if (
        !isFolder(
            currentFolder
        )
    ) {
        return;
    }


    const panel =
        folderStack.createDiv({
            cls:
                "project-panel project-folder-panel" +
                (descriptor.sharedResource ? " is-shared-resource" : "")
        });

    if (descriptor.sharedResource) {
        panel.dataset.resourceType = descriptor.resourceType;
        panel.setAttribute(
            "aria-label",
            `${descriptor.title}, shared from ${descriptor.resourceLabel}`
        );
    }


    // ---------- HEADER ----------

    const header =
        panel.createDiv({
            cls:
                "project-folder-header"
        });


    const title =
        header.createDiv({
            cls:
                "project-folder-title"
        });

    const folderIcon =
        title.createSpan({
            cls:
                "project-folder-icon project-folder-toggle"
        });


    folderIcon.setAttribute(
        "role",
        "button"
    );


    folderIcon.tabIndex =
        0;


    const openFolderIcon =
        folderIcon.createSpan({
            cls:
                "project-folder-toggle-icon"
        });


    const closedFolderIcon =
        folderIcon.createSpan({
            cls:
                "project-folder-toggle-icon"
        });


    window.hubSetIcon?.(
        openFolderIcon,
        "folder-open"
    );


    window.hubSetIcon?.(
        closedFolderIcon,
        "folder-closed"
    );


    // ---------- REORDER HANDLE ----------

    const canReorder =
        !descriptor.isRoot &&
        !descriptor.sharedResource &&
        descriptor.title !==
            "Meta";


    if (
        canReorder
    ) {

        header.draggable =
            true;

        header.addClass(
            "is-reorderable"
        );
    }


    const breadcrumb =
        title.createDiv({
            cls:
                "project-folder-breadcrumb"
        });


    const controls =
        header.createDiv({
            cls:
                "project-folder-controls"
        });

    const search =
        controls.createEl(
            "input",
            {
                cls:
                    "project-folder-search"
            }
        );


    search.type =
        "search";

    search.placeholder =
        "Search";

    search.value =
        state.search;

    // ---------- FOLDER REORDERING ----------

    if (
        canReorder
    ) {

        let canStartDrag =
            true;


        header.addEventListener(
            "pointerdown",
            event => {

                /*
                * Search/buttons keep their normal
                * behaviour and never start dragging.
                */
                canStartDrag =
                    !event.target.closest(
                        "input, button"
                    );
            }
        );


        header.addEventListener(
            "dragstart",
            event => {

                if (
                    !canStartDrag
                ) {

                    event.preventDefault();

                    return;
                }


                draggedFolderPath =
                    descriptor.path;


                panel.addClass(
                    "is-dragging"
                );


                event.dataTransfer
                    .setData(
                        "text/plain",
                        descriptor.path
                    );


                event.dataTransfer.effectAllowed =
                    "move";
            }
        );


        header.addEventListener(
            "dragend",
            () => {

                draggedFolderPath =
                    null;


                panel.removeClass(
                    "is-dragging"
                );


                clearFolderDropIndicators();
            }
        );
    }


    panel.addEventListener(
        "dragover",
        event => {

            if (
                !draggedFolderPath ||
                descriptor.isRoot ||
                descriptor.sharedResource ||
                descriptor.path ===
                    draggedFolderPath
            ) {
                return;
            }


            event.preventDefault();


            const bounds =
                panel
                    .getBoundingClientRect();


            const placeAfter =
                descriptor.title ===
                    "Meta"
                    ? true
                    : event.clientY >
                        bounds.top +
                        bounds.height / 2;


            clearFolderDropIndicators();


            panel.addClass(
                placeAfter
                    ? "is-drop-after"
                    : "is-drop-before"
            );


            event.dataTransfer.dropEffect =
                "move";
        }
    );


    panel.addEventListener(
        "dragleave",
        event => {

            if (
                panel.contains(
                    event.relatedTarget
                )
            ) {
                return;
            }


            panel.removeClass(
                "is-drop-before",
                "is-drop-after"
            );
        }
    );


    panel.addEventListener(
        "drop",
        async event => {

            if (
                !draggedFolderPath ||
                descriptor.isRoot ||
                descriptor.sharedResource ||
                descriptor.path ===
                    draggedFolderPath
            ) {
                return;
            }


            event.preventDefault();
            event.stopPropagation();


            const bounds =
                panel
                    .getBoundingClientRect();


            const placeAfter =
                descriptor.title ===
                    "Meta"
                    ? true
                    : event.clientY >
                        bounds.top +
                        bounds.height / 2;


            const sourcePath =
                draggedFolderPath;


            draggedFolderPath =
                null;


            clearFolderDropIndicators();


            await moveTopLevelFolder(
                sourcePath,
                descriptor.path,
                placeAfter
            );
        }
    );

    function beginCreate(
        kind,
        targetPath =
            state.currentPath
    ) {

        state.currentPath =
            targetPath;


        state.createKind =
            kind;

        state.search =
            "";

        search.value =
            "";


        if (
            state.collapsed
        ) {

            state.collapsed =
                false;


            applyPanelGeometry();
        }


        saveFolderUiState(
            descriptor.path,
            state
        );


        renderContents();
    }

    makeProjectItemDropTarget(
        header,
        () =>
            state.currentPath
    );

    makeExternalFileDropTarget(
        header,
        () =>
            state.currentPath
    );

    // ---------- BODY ----------

    const body =
        panel.createDiv({
            cls:
                "project-folder-body"
        });


    makeProjectItemDropTarget(
        body,
        () =>
            state.currentPath
    );


    makeExternalFileDropTarget(
        body,
        () =>
            state.currentPath
    );


    const columns =
        body.createDiv({
            cls:
                "project-browser-columns"
        });


    const rows =
        body.createDiv({
            cls:
                "project-browser-rows",
            attr: { role: "listbox", "aria-multiselectable": "true", "aria-label": descriptor.title }
        });


    const SORT_COLUMNS = [
        {
            key: "name",
            label: "Name"
        },
        {
            key: "modified",
            label: "Modified"
        },
        {
            key: "created",
            label: "Created"
        }
    ];


    function defaultSortDirection(
        key
    ) {

        return (
            key === "name"
                ? "asc"
                : "desc"
        );
    }


    function renderSortHeaders() {

        columns.empty();


        for (
            const definition
            of SORT_COLUMNS
        ) {

            const button =
                columns.createEl(
                    "button",
                    {
                        cls:
                            `project-browser-column hub-button-plain project-browser-column-${definition.key}`
                    }
                );


            button.type =
                "button";


            button.createSpan({
                text:
                    definition.label
            });


            if (
                state.sortKey ===
                definition.key
            ) {

                button.addClass(
                    "is-active"
                );


                const indicator =
                    button.createSpan({
                        cls:
                            "project-browser-sort-indicator"
                    });


                window.hubSetIcon?.(
                    indicator,
                    state.sortDirection ===
                        "asc"
                        ? "chevron-up"
                        : "chevron-down"
                );
            }


            button.addEventListener(
                "click",
                () => {

                    if (
                        state.sortKey ===
                        definition.key
                    ) {

                        state.sortDirection =
                            state.sortDirection ===
                                "asc"
                                ? "desc"
                                : "asc";

                    } else {

                        state.sortKey =
                            definition.key;

                        state.sortDirection =
                            defaultSortDirection(
                                definition.key
                            );
                    }


                    saveFolderUiState(
                        descriptor.path,
                        state
                    );


                    renderSortHeaders();
                    renderContents();
                }
            );
        }
    }


    renderSortHeaders();

    const resizeHandle =
        panel.createDiv({
            cls:
                "project-folder-resize-handle"
        });


    function applyPanelGeometry() {

        panel.toggleClass(
            "is-collapsed",
            state.collapsed
        );


        openFolderIcon.toggleClass(
            "is-hidden",
            state.collapsed
        );


        closedFolderIcon.toggleClass(
            "is-hidden",
            !state.collapsed
        );


        folderIcon.title =
            state.collapsed
                ? "Open folder"
                : "Close folder";


        if (
            !state.collapsed
        ) {

            panel.style.height =
                `${state.manualHeight}px`;
        }
    }

    panel.addEventListener(
        "contextmenu",
        event => {

            /*
            * Notes already have their own
            * right-click menu.
            *
            * Inputs/buttons should retain
            * their normal behaviour.
            */
            if (
                event.target.closest(
                    ".project-browser-row, input, button"
                )
            ) {
                return;
            }


            event.preventDefault();
            event.stopPropagation();


            const actions = {

                name:
                    descriptor.title,


                newNote:
                    () => {

                        beginCreate(
                            "note"
                        );
                    },


                newFolder:
                    () => {

                        beginCreate(
                            "folder"
                        );
                    }
            };


            /*
            * Project Root is only a virtual
            * panel, so it cannot itself be
            * renamed or deleted.
            */
            if (!descriptor.isRoot && !descriptor.sharedResource) {

                actions.rename =
                    async newName => {

                        await renameTopLevelProjectFolder(
                            descriptor,
                            newName
                        );
                    };


                actions.delete =
                    async () => {

                        await deleteTopLevelProjectFolder(
                            descriptor
                        );
                    };
            }

            if (descriptor.sharedResource) {
                actions.detach = async () => {
                    await window.hubDetachResourceFolder?.(
                        current.file.path,
                        descriptor.resourceFolderId
                    );
                    renderFolderPanels();
                };
            }


            window
                .hubShowProjectFolderMenu?.(
                    event,
                    actions
                );
        }
    );

    function updateAutoFloor(
        folder
    ) {

        const requiredHeight =
            automaticFolderHeight(
                folderPanelItemCount(
                    folder,
                    descriptor
                )
            );


        state.autoFloor =
            requiredHeight;


        state.manualHeight =
            Math.max(
                state.manualHeight,
                state.autoFloor
            );


        if (
            !state.collapsed
        ) {

            panel.style.height =
                `${state.manualHeight}px`;
        }
    }


    // ---------- COLLAPSE ----------

    folderIcon.addEventListener(
        "click",
        event => {

            event.preventDefault();
            event.stopPropagation();


            state.collapsed =
                !state.collapsed;
            
            saveFolderUiState(
                descriptor.path,
                state
            );

            applyPanelGeometry();
        }
    );

    folderIcon.addEventListener(
        "keydown",
        event => {

            if (
                event.key !== "Enter" &&
                event.key !== " "
            ) {
                return;
            }


            event.preventDefault();
            event.stopPropagation();


            state.collapsed =
                !state.collapsed;

            saveFolderUiState(
                descriptor.path,
                state
            );

            applyPanelGeometry();
        }
    );

    // ---------- MANUAL RESIZE ----------

    let resizeSession =
        null;


    resizeHandle.addEventListener(
        "pointerdown",
        event => {

            if (
                state.collapsed
            ) {
                return;
            }


            event.preventDefault();
            event.stopPropagation();


            resizeSession = {
                pointerId:
                    event.pointerId,

                startY:
                    event.clientY,

                startHeight:
                    panel
                        .getBoundingClientRect()
                        .height
            };


            resizeHandle
                .setPointerCapture(
                    event.pointerId
                );


            panel.addClass(
                "is-resizing"
            );
        }
    );


    resizeHandle.addEventListener(
        "pointermove",
        event => {

            if (
                !resizeSession ||
                event.pointerId !==
                    resizeSession.pointerId
            ) {
                return;
            }


            const delta =
                event.clientY -
                resizeSession.startY;


            const nextHeight =
                Math.max(
                    state.autoFloor,

                    Math.round(
                        resizeSession.startHeight +
                        delta
                    )
                );


            state.manualHeight =
                nextHeight;


            panel.style.height =
                `${nextHeight}px`;
        }
    );


    function finishResize(
        event
    ) {

        if (
            !resizeSession ||
            event.pointerId !==
                resizeSession.pointerId
        ) {
            return;
        }


        resizeSession =
            null;


        panel.removeClass(
            "is-resizing"
        );


        if (
            resizeHandle.hasPointerCapture(
                event.pointerId
            )
        ) {

            resizeHandle
                .releasePointerCapture(
                    event.pointerId
                );
        }


        saveFolderUiState(
            descriptor.path,
            state
        );
    }


    resizeHandle.addEventListener(
        "pointerup",
        finishResize
    );


    resizeHandle.addEventListener(
        "pointercancel",
        finishResize
    );

    function navigateTo(
        path
    ) {

        const folder =
            app.vault
                .getAbstractFileByPath(
                    path
                );


        if (
            !isFolder(folder)
        ) {
            return;
        }


        /*
         * Entering another folder should
         * not inherit a search query from
         * the previous folder.
         */
        state.currentPath =
            path;

        state.search =
            "";

        search.value =
            "";


        saveFolderUiState(
            descriptor.path,
            state
        );


        renderContents();
    }


    function makeFolderNameEditable(
        crumb,
        part
    ) {

        /*
        * Only the actual top-level folder
        * square title is editable here.
        *
        * Project Root is not a real
        * folder-square name.
        */
        if (
            descriptor.isRoot ||
            descriptor.sharedResource ||
            part.path !==
                descriptor.path
        ) {
            return;
        }


        crumb.classList.add(
            "is-editable"
        );


        crumb.addEventListener(
            "click",
            event => {

                event.stopPropagation();


                if (
                    crumb.isContentEditable
                ) {
                    return;
                }


                const oldName =
                    part.name;

                const oldPath =
                    part.path;


                let cancelled =
                    false;


                crumb.contentEditable =
                    "true";

                crumb.spellcheck =
                    false;


                crumb.classList.add(
                    "is-editing"
                );


                crumb.focus();


                /*
                * Select the whole name so you
                * can immediately type over it.
                */
                const selection =
                    window.getSelection();

                const range =
                    document.createRange();


                range.selectNodeContents(
                    crumb
                );


                selection.removeAllRanges();
                selection.addRange(
                    range
                );


                const onKeyDown =
                    event => {

                        if (
                            event.key === "Enter"
                        ) {

                            event.preventDefault();

                            crumb.blur();

                        } else if (
                            event.key === "Escape"
                        ) {

                            event.preventDefault();

                            cancelled =
                                true;

                            crumb.textContent =
                                oldName;

                            crumb.blur();
                        }
                    };


                const onBlur =
                    async () => {

                        crumb.removeEventListener(
                            "keydown",
                            onKeyDown
                        );


                        crumb.contentEditable =
                            "false";


                        crumb.classList.remove(
                            "is-editing"
                        );


                        if (cancelled) {
                            return;
                        }


                        const newName =
                            crumb.textContent
                                .trim();


                        if (
                            !newName ||
                            newName ===
                                oldName
                        ) {

                            crumb.textContent =
                                oldName;

                            return;
                        }


                        try {

                            await renameTopLevelProjectFolder(
                                descriptor,
                                newName
                            );


                        } catch (error) {

                            crumb.textContent =
                                oldName;


                            crumb.title =
                                error.message ??
                                "Could not rename folder.";
                        }
                    };


                crumb.addEventListener(
                    "keydown",
                    onKeyDown
                );


                crumb.addEventListener(
                    "blur",
                    onBlur,
                    {
                        once:
                            true
                    }
                );
            }
        );
    }

    function renderBreadcrumb() {

        breadcrumb.empty();


        const parts =
            breadcrumbParts(
                descriptor,
                state.currentPath
            );


        parts.forEach(
            (
                part,
                index
            ) => {

                const isCurrent =
                    index ===
                    parts.length - 1;


                if (isCurrent) {

                    const crumb =
                        breadcrumb.createSpan({
                            cls:
                                "project-folder-crumb is-current",

                            text:
                                part.name
                        });


                    makeExternalFileDropTarget(
                        crumb,
                        () =>
                            part.path
                    );


                    makeFolderNameEditable(
                        crumb,
                        part
                    );

                } else {

                    const crumb =
                        breadcrumb.createSpan({
                            cls:
                                "project-folder-crumb is-clickable",

                            text:
                                part.name
                        });

                    makeProjectItemDropTarget(
                        crumb,
                        () =>
                            part.path
                    );

                    makeExternalFileDropTarget(
                        crumb,
                        () =>
                            part.path
                    );


                    crumb.addEventListener(
                        "click",
                        event => {

                            event.stopPropagation();

                            navigateTo(
                                part.path
                            );
                        }
                    );
                }


                if (
                    !isCurrent
                ) {

                    const separator =
                        breadcrumb.createSpan({
                            cls:
                                "project-folder-separator"
                        });


                    window.hubSetIcon?.(
                        separator,
                        "chevron-right"
                    );
                }
            }
        );
    }

    function renderCreateRow(
        folder
    ) {

        if (
            !state.createKind
        ) {
            return;
        }


        const kind =
            state.createKind;


        const row =
            rows.createDiv({
                cls:
                    "project-create-row"
            });


        const icon =
            row.createSpan({
                cls:
                    "project-create-row-icon"
            });


        window.hubSetIcon?.(
            icon,
            kind === "folder"
                ? "folder-plus"
                : "file-plus-2"
        );


        const input =
            row.createEl(
                "input",
                {
                    cls:
                        "project-create-input"
                }
            );


        input.placeholder =
            kind === "folder"
                ? "Subfolder name…"
                : "Note name…";


        const cancel =
            row.createEl(
                "button",
                {
                    cls:
                        "project-create-cancel"
                }
            );


        cancel.type =
            "button";

        cancel.title =
            "Cancel";


        window.hubSetIcon?.(
            cancel,
            "x"
        );


        function close() {

            state.createKind =
                null;

            renderContents();
        }


        async function create() {
            if (input.dataset.committing === "true") return;
            if (!input.value.trim()) { close(); return; }
            input.dataset.committing = "true";

            try {

                const path =
                    await createProjectItem(
                        folder.path,
                        kind,
                        input.value
                    );


                state.createKind =
                    null;


                if (
                    kind === "folder"
                ) {
                    renderFolderPanels();

                    return;
                }

                renderFolderPanels();

            } catch (error) {

                input.dataset.committing = "false";
                input.classList.add("is-error");
                input.title = error.message ?? "Could not create item.";

                input.select();
            }
        }


        input.addEventListener(
            "input",
            () => {

                input.classList.remove(
                    "is-error"
                );
            }
        );


        input.addEventListener(
            "keydown",
            event => {

                if (
                    event.key === "Enter"
                ) {

                    event.preventDefault();

                    create();

                } else if (
                    event.key === "Escape"
                ) {

                    event.preventDefault();

                    close();
                }
            }
        );


        cancel.addEventListener(
            "click",
            close
        );
        cancel.addEventListener("pointerdown", event => event.preventDefault());
        input.addEventListener("blur", () => { if (input.isConnected) create(); });


        input.focus();
    }

    function renderContents() {

        renderBreadcrumb();

        rows.empty();


        let folder =
            app.vault
                .getAbstractFileByPath(
                    state.currentPath
                );


        /*
         * If navigation state became invalid
         * after a rename/delete, return to the
         * root of this panel.
         */
        if (
            !isFolder(folder)
        ) {

            state.currentPath =
                descriptor.path;


            folder =
                app.vault
                    .getAbstractFileByPath(
                        descriptor.path
                    );


            saveFolderUiState(
                descriptor.path,
                state
            );


            renderBreadcrumb();
        }

        if (
            !isFolder(folder)
        ) {
            return;
        }


        updateAutoFloor(
            folder
        );


        renderCreateRow(
            folder
        );


        const query =
            state.search
                .trim()
                .toLowerCase();


        /*
         * Top-level folders already have
         * their own panels, so Project Root
         * does not duplicate them as rows.
         *
         * Inside every normal folder,
         * direct child folders are shown.
         */
        let folders =
            descriptor.isRoot
                ? []
                : directFolders(
                    folder
                );


        let files =
            directFiles(
                folder
            );


        if (
            descriptor.isRoot
        ) {

            files =
                files.filter(
                    file =>
                        file.path !==
                        current.file.path
                );
        }


        if (query) {

            folders =
                folders.filter(
                    child =>
                        child.name
                            .toLowerCase()
                            .includes(
                                query
                            )
                );


            files =
                files.filter(
                    file =>
                        projectFileDisplayName(
                            file
                        )
                            .toLowerCase()
                            .includes(
                                query
                            )
                );
        }


        const direction =
            state.sortDirection ===
                "asc"
                ? 1
                : -1;


        /*
        * Folders remain above notes.
        *
        * Name sorting applies to folders too.
        * For date sorting, folders remain
        * alphabetical because TFolder does
        * not expose the same stat data.
        */
        folders.sort(
            (a, b) => {

                const result =
                    compareNames(
                        a.name,
                        b.name
                    );


                return (
                    state.sortKey === "name"
                        ? result * direction
                        : result
                );
            }
        );


        files.sort(
            (a, b) => {

                let result;


                if (
                    state.sortKey ===
                    "name"
                ) {

                    result =
                        compareNames(
                            projectFileDisplayName(
                                a
                            ),
                            projectFileDisplayName(
                                b
                            )
                        );

                } else if (
                    state.sortKey ===
                    "created"
                ) {

                    result =
                        a.stat.ctime -
                        b.stat.ctime;

                } else {

                    result =
                        a.stat.mtime -
                        b.stat.mtime;
                }


                if (
                    result === 0
                ) {

                    return compareNames(
                        projectFileDisplayName(
                            a
                        ),
                        projectFileDisplayName(
                            b
                        )
                    );
                }


                return (
                    result *
                    direction
                );
            }
        );


        if (
            folders.length === 0 &&
            files.length === 0 &&
            !state.createKind
        ) {

            el(
                rows,
                "div",
                "project-folder-empty",
                query
                    ? "No matching items."
                    : "No items."
            );

            return;
        }


        // ---------- SUBFOLDERS ----------

        for (
            const childFolder
            of folders
        ) {

            const row =
                rows.createDiv({
                    cls:
                        "project-browser-row project-subfolder-row"
                });


            row.dataset.path =
                childFolder.path;


            row.toggleClass(
                "is-selected",

                selectedProjectItemPaths
                    .has(
                        childFolder.path
                    )
            );


            makeProjectItemDraggable(
                row,
                childFolder.path
            );

            const info =
                row.createDiv({
                    cls:
                        "project-browser-info"
                });


            const icon =
                info.createSpan({
                    cls:
                        "project-browser-icon"
                });


            window.hubSetIcon?.(
                icon,
                "folder"
            );


            info.createSpan({
                cls:
                    "project-browser-name",

                text:
                    childFolder.name
            });


            const arrow =
                info.createSpan({
                    cls:
                        "project-browser-arrow"
                });


            window.hubSetIcon?.(
                arrow,
                "chevron-right"
            );

            row.createDiv({
                cls:
                    "project-browser-time"
            });


            row.createDiv({
                cls:
                    "project-browser-time"
            });

            makeProjectItemDropTarget(
                row,
                () =>
                    childFolder.path
            );

            makeExternalFileDropTarget(
                row,
                () =>
                    childFolder.path
            );
            
            row.addEventListener(
                "contextmenu",
                event => {

                    handleProjectItemContextMenu(
                        event,
                        childFolder.path,

                        () => {

                            window
                                .hubShowProjectFolderMenu?.(
                                    event,
                                    {
                                        name:
                                            childFolder.name,

                                        path:
                                            childFolder.path,


                                        newNote:
                                            () => {

                                                beginCreate(
                                                    "note",
                                                    childFolder.path
                                                );
                                            },


                                        newFolder:
                                            () => {

                                                beginCreate(
                                                    "folder",
                                                    childFolder.path
                                                );
                                            },


                                        moveTo:
                                            async targetPath => {

                                                await moveProjectItemsTo(
                                                    [
                                                        childFolder.path
                                                    ],
                                                    targetPath
                                                );


                                                clearProjectItemSelection();

                                                renderFolderPanels();
                                            },


                                        rename:
                                            async newName => {

                                                await renameProjectFolder(
                                                    childFolder.path,
                                                    newName
                                                );


                                                clearProjectItemSelection();


                                                renderFolderPanels();
                                            },


                                        delete:
                                            async () => {

                                                const folder =
                                                    app.vault
                                                        .getAbstractFileByPath(
                                                            childFolder.path
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


                                                clearProjectItemSelection();


                                                renderFolderPanels();
                                            }
                                    }
                                );
                        }
                    );
                }
            );
        
            row.addEventListener(
                "click",
                event => {

                    if (
                        handleProjectItemSelection(
                            event,
                            row,
                            childFolder.path
                        )
                    ) {
                        return;
                    }


                    clearProjectItemSelection();


                    navigateTo(
                        childFolder.path
                    );
                }
            );
        }


        // ---------- NOTES ----------

        for (
            const file
            of files
        ) {

            const row =
                rows.createDiv({
                    cls:
                        "project-browser-row project-note-row"
                });


            row.dataset.path =
                file.path;

            row.toggleClass(
                "is-selected",

                selectedProjectItemPaths
                    .has(
                        file.path
                    )
            );
            
            makeProjectItemDraggable(
                row,
                file.path
            );

            const info =
                row.createDiv({
                    cls:
                        "project-browser-info"
                });


            const icon =
                info.createSpan({
                    cls:
                        "project-browser-icon"
                });


            window.hubSetIcon?.(
                icon,
                projectFileIcon(
                    file
                )
            );


            info.createSpan({
                cls:
                    "project-browser-name",

                text:
                    projectFileDisplayName(
                        file
                    )
            });


            const modified =
                row.createDiv({
                    cls:
                        "project-browser-time",

                    text:
                        formatFileTime(
                            file.stat.mtime
                        )
                });


            modified.title =
                moment(
                    file.stat.mtime
                ).format(
                    "YYYY-MM-DD HH:mm:ss"
                );


            const created =
                row.createDiv({
                    cls:
                        "project-browser-time",

                    text:
                        formatFileTime(
                            file.stat.ctime
                        )
                });


            created.title =
                moment(
                    file.stat.ctime
                ).format(
                    "YYYY-MM-DD HH:mm:ss"
                );


            modified.title =
                moment(
                    file.stat.mtime
                ).format(
                    "YYYY-MM-DD HH:mm"
                );


            row.addEventListener(
                "click",
                async event => {

                    if (
                        handleProjectItemSelection(
                            event,
                            row,
                            row.dataset.path
                        )
                    ) {
                        return;
                    }


                    clearProjectItemSelection();


                    const currentFile =
                        app.vault
                            .getAbstractFileByPath(
                                row.dataset.path
                            );


                    if (currentFile) {

                        await openProjectNote(
                            currentFile
                        );
                    }
                }
            );


            row.addEventListener(
                "contextmenu",
                event => {

                    handleProjectItemContextMenu(
                        event,
                        row.dataset.path,
                        () => {

                            window
                                .hubShowProjectFileMenu?.(
                                    event,
                                    row.dataset.path,
                                    {
                                        moveTo:
                                            async targetPath => {

                                                await moveProjectItemsTo(
                                                    [
                                                        row.dataset.path
                                                    ],
                                                    targetPath
                                                );


                                                clearProjectItemSelection();

                                                renderFolderPanels();
                                            }
                                    }
                                );
                        }
                    );
                }
            );
        }
    }


    search.addEventListener(
        "input",
        () => {

            state.search =
                search.value;


            if (
                state.search.trim() &&
                state.collapsed
            ) {

                state.collapsed =
                    false;

                applyPanelGeometry();
            }


            saveFolderUiState(
                descriptor.path,
                state
            );


            renderContents();
        }
    );

    renderContents();

    applyPanelGeometry();
}

function renderFolderSuggestion() {

    const panel =
        folderStack.createDiv({
            cls:
                "project-panel project-folder-panel project-folder-placeholder"
        });


    const header =
        panel.createDiv({
            cls:
                "project-folder-header project-folder-placeholder-header"
        });


    const title =
        header.createDiv({
            cls:
                "project-folder-title"
        });


    const icon =
        title.createSpan({
            cls:
                "project-folder-icon"
        });


    window.hubSetIcon?.(
        icon,
        "folder-plus"
    );


    const input =
        title.createEl(
            "input",
            {
                cls:
                    "project-folder-placeholder-input"
            }
        );


    input.type =
        "text";

    input.placeholder =
        "Folder name…";

    input.spellcheck =
        false;


    input.addEventListener(
        "input",
        () => {

            input.classList.remove(
                "is-error"
            );
        }
    );


    async function commitFolder() {
            if (!input.value.trim() || input.dataset.committing === "true") return;
            input.dataset.committing = "true";
            try {

                /*
                 * The first time an explicit
                 * order is needed, preserve
                 * exactly what is currently
                 * visible.
                 */
                if (
                    folderOrder.length === 0
                ) {

                    folderOrder =
                        projectFolderDescriptors()
                            .filter(
                                descriptor =>
                                    !descriptor.isRoot &&
                                    !descriptor.sharedResource
                            )
                            .map(
                                descriptor =>
                                    descriptor.title
                            );
                }


                const path =
                    await createProjectItem(
                        projectRoot,
                        "folder",
                        input.value
                    );


                const name =
                    path
                        .split("/")
                        .pop();


                /*
                 * Newly created folders always
                 * go after existing folders.
                 */
                folderOrder =
                    folderOrder.filter(
                        existing =>
                            existing !== name
                    );


                folderOrder.push(
                    name
                );


                await saveFolderOrder();


                renderFolderPanels();


            } catch (error) {

                input.classList.add(
                    "is-error"
                );

                input.title = error.message ?? "Could not create folder.";
                input.value = "";
            }
            finally { input.dataset.committing = "false"; }
    }
    input.addEventListener("blur", commitFolder);
    input.addEventListener("keydown", event => {
        if (event.key === "Escape") { input.value = ""; input.blur(); }
        if (event.key !== "Enter") return;
        event.preventDefault();
        commitFolder();
    });
}

function renderFolderPanels() {

    folderStack.empty();


    const descriptors =
        projectFolderDescriptors();


    if (
        descriptors.length === 0
    ) {

        el(
            folderStack,
            "div",
            "project-empty",
            isResourceContext
                ? "No Resource folders yet."
                : "No project folders."
        );

        renderFolderSuggestion();
        return;
    }


    for (
        const descriptor
        of descriptors
    ) {

        renderFolderPanel(
            descriptor
        );
    }

    renderFolderSuggestion();
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
    folderState.clear();
    selectedProjectItemPaths.clear();
    selectionAnchorPath = null;
    renderFolderPanels();
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

            renderFolderPanels();
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
    "list-checks"
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


    const folderRect =
        folderStack
            .getBoundingClientRect();


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
        if (report.summary) void activityBody.hubMarkdown?.render(summary, report.summary, current.file.path);


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
        el(time, "div", "project-activity-date", historyDate(moment(report.date, "YYYY-MM-DD")));
        if (Number.isFinite(report.timestamp)) {
            el(time, "div", "project-activity-clock", moment(report.timestamp).format("HH:mm"));
        }


        row.addEventListener(
            "click",
            () => {
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
            "No completed tasks have been cleared yet."
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
                    "project-activity-icon is-completed-task"
            });


        window.hubSetIcon?.(
            icon,
            "square-check"
        );


        const info =
            row.createDiv({
                cls:
                    "project-activity-info"
            });


        const title = el(info, "div", "project-activity-title", item.text);
        void activityBody.hubMarkdown?.render(title, item.text, item.path || current.file.path);


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
            when.format("HH:mm")
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


            row.addEventListener(
                "click",
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
            when.format(
                "HH:mm"
            )
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


                row.addEventListener(
                    "click",
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


frame.commit();
if (window.hubEnterDashboard) {
    window.hubEnterDashboard(root);
} else {
    root.classList.remove(
        "is-hub-cover-pending"
    );
}
