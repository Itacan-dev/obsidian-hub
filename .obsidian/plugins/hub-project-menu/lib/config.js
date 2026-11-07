"use strict";

const PROJECT_META_FOLDER = "Meta";
const CATEGORY_IMAGE_ROOT = "Assets/ProjectCards/Categories";
const PROJECT_COVER_ROOT = "Assets/ProjectCards/Projects";
const WIP_IMAGE_PATH = "Assets/ProjectCards/wip.jpg";

const HUB_BACKUP_ROOT = "System/Backups/Obsidian Hub";
const HUB_BACKUP_VERSION = 1;

const RESOURCE_ROOT = "Resources";
const RESOURCE_TYPES = [
    {
        id: "study",
        label: "Knowledge",
        subtitle: "Concepts and material from established knowledge",
        root: "Resources/Knowledge",
        hubPath: "Resources/Knowledge/Knowledge.md",
        legacyRoots: [
            {
                root: "Resources/Study",
                hubName: "Study.md",
                label: "Study"
            }
        ],
        image: "Assets/ResourceCards/study.jpg",
        icon: "graduation-cap"
    },
    {
        id: "literature",
        label: "Research",
        subtitle: "Work and ideas from the research community",
        root: "Resources/Research",
        hubPath: "Resources/Research/Research.md",
        legacyRoots: [
            { root: "Resources/Literature", hubName: "Literature.md", label: "Literature" },
            {
                root: "Resources/The Literature",
                hubName: "The Literature.md",
                label: "The Literature"
            }
        ],
        image: "Assets/ResourceCards/literature.jpg",
        icon: "book-open"
    },
    {
        // Keep the persisted ID: folder selections, reports and Focus use it.
        id: "references",
        label: "Explorations",
        subtitle: "Personal investigation of questions and ideas",
        root: "Resources/Explorations",
        hubPath: "Resources/Explorations/Explorations.md",
        legacyRoots: [{ root: "Resources/References", hubName: "References.md", label: "References" }],
        image: "Assets/ResourceCards/references.jpg",
        icon: "library"
    },
    {
        id: "inspiration",
        label: "Inspiration",
        subtitle: "Collected material that spark ideas",
        root: "Resources/Inspiration",
        hubPath: "Resources/Inspiration/Inspiration.md",
        image: "Assets/ResourceCards/inspiration.jpg",
        icon: "sparkles"
    }
];

function publicResourceType(resource) {
    return resource
        ? {
            id: resource.id,
            label: resource.label,
            subtitle: resource.subtitle,
            name: resource.label,
            root: resource.root,
            path: resource.hubPath,
            hubPath: resource.hubPath,
            image: resource.image,
            icon: resource.icon,
            contextKind: "resource",
            resourceType: resource.id,
            projectId: `resource:${resource.id}`
        }
        : null;
}

const PROGRAM_FILES =
    process.env.ProgramFiles ||
    process.env.PROGRAMFILES ||
    "C:\\Program Files";

const LOCAL_APP_DATA = process.env.LOCALAPPDATA;

const APP_SHORTCUTS = [
    {
        id: "overleaf",
        label: "Overleaf",
        type: "website",
        icon: "Assets/AppShortcuts/overleaf.svg",
        url: "https://www.overleaf.com"
    },
    {
        id: "chatgpt",
        label: "ChatGPT",
        type: "website",
        icon: "Assets/AppShortcuts/chatgpt.svg",
        url: "https://chatgpt.com/"
    },
    {
        id: "zotero",
        label: "Zotero",
        type: "application",
        icon: "Assets/AppShortcuts/zotero.svg",
        processName: "zotero",
        executables: [
            `${PROGRAM_FILES}\\Zotero\\zotero.exe`,
            LOCAL_APP_DATA
                ? `${LOCAL_APP_DATA}\\Programs\\Zotero\\zotero.exe`
                : null,
            "zotero.exe"
        ]
    },
    {
        // Retain the saved shortcut ID so existing category selections/order work.
        id: "google",
        label: "Atlas",
        type: "atlas",
        iconName: "compass"
    }
];

const DEFAULT_SHORTCUT_IDS = APP_SHORTCUTS.map(
    shortcut => shortcut.id
);

function normalizeShortcutIds(ids) {
    const validIds = new Set(DEFAULT_SHORTCUT_IDS);
    const result = [];

    for (const id of Array.isArray(ids) ? ids : []) {
        if (validIds.has(id) && !result.includes(id)) {
            result.push(id);
        }
    }

    return result;
}

function normalizeShortcutOrder(ids) {
    const normalized = normalizeShortcutIds(ids);

    return [
        ...normalized,
        ...DEFAULT_SHORTCUT_IDS.filter(
            id => !normalized.includes(id)
        )
    ];
}

const DEFAULT_CATEGORIES = [
    {
        id: "physics-research",
        name: "Physics Research",
        image: "Assets/ProjectCards/research.jpg"
    },
    {
        id: "nonfiction-book",
        name: "Nonfiction Book",
        image: "Assets/ProjectCards/books.jpg"
    },
    {
        id: "fiction-book",
        name: "Fiction Book",
        image: "Assets/ProjectCards/novel.jpg"
    }
];

const WORK_RATING_OPTIONS = [
    { score: 0, label: "No work so far" },
    { score: 1, label: "I did something" },
    { score: 2, label: "Medium" },
    { score: 3, label: "Heavy work" },
    { score: 4, label: "Highly non-trivial and deep work" }
];

const PROJECT_ADVANCEMENT_OPTIONS = [
    {
        score: 1,
        title: "At most polished, not clearly advanced.",
        description:
            "Refined, reorganized, fixed a minor issue, or added a small detail."
    },
    {
        score: 2,
        title: "Clearly advanced, but not substantially so.",
        description:
            "Completed an ordinary step, extended existing work, or added a meaningful but straightforward part."
    },
    {
        score: 3,
        title: "A few substantive advances.",
        description:
            "Derived a nontrivial result, gained a new insight, solved a meaningful problem, or completed several substantial parts."
    },
    {
        score: 4,
        title: "Many substantive advances, or one major one.",
        description:
            "Made several substantive advances like those above, or completed one major result that significantly changed what is known, possible, or finished."
    }
];

const PROGRESS_RATING_OPTIONS = {
    project: [
        { score: 0, title: 'No progress', description: 'No meaningful work was done on the project.' },
        ...PROJECT_ADVANCEMENT_OPTIONS
    ],
    resource: [
        { score: 0, title: 'No engagement', description: 'No meaningful work was done with the resource.' },
        { score: 1, title: 'Light engagement.', description: 'Reviewed, annotated, organized, collected, or briefly studied material.' },
        { score: 2, title: 'Meaningful engagement.', description: 'Studied a meaningful amount, developed an idea, added useful material, or improved your understanding.' },
        { score: 3, title: 'Substantial engagement.', description: 'Worked through material in depth, gained a nontrivial insight, made meaningful connections, or added several substantial pieces.' },
        { score: 4, title: 'Major engagement.', description: 'Reached an important new understanding, produced a major synthesis, completed a large body of study, or substantially developed the resource.' }
    ]
};

function progressRatingOptions(workspace) {
    return PROGRESS_RATING_OPTIONS[workspace.contextKind === 'resource' || workspace.resourceType ||
        String(workspace.projectId ?? '').startsWith('resource:') ? 'resource' : 'project'];
}

module.exports = {
    progressRatingOptions,
    APP_SHORTCUTS,
    CATEGORY_IMAGE_ROOT,
    DEFAULT_CATEGORIES,
    DEFAULT_SHORTCUT_IDS,
    HUB_BACKUP_ROOT,
    HUB_BACKUP_VERSION,
    PROJECT_ADVANCEMENT_OPTIONS,
    PROJECT_COVER_ROOT,
    PROJECT_META_FOLDER,
    RESOURCE_ROOT,
    RESOURCE_TYPES,
    WIP_IMAGE_PATH,
    WORK_RATING_OPTIONS,
    normalizeShortcutIds,
    normalizeShortcutOrder,
    publicResourceType
};
