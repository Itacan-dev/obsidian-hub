module.exports = async (params) => {
    const { app, quickAddApi, obsidian } = params;

    // 1. Project type
    const kind = await quickAddApi.suggester(
        [
            "Physics / Research",
            "Novel",
            "Nonfiction book",
            "Poetry",
            "Other"
        ],
        [
            "research",
            "novel",
            "nonfiction",
            "poetry",
            "other"
        ]
    );

    if (!kind) return;

    // 2. Project name
    let name = await quickAddApi.inputPrompt("Project name");
    if (!name) return;

    name = name.trim().replace(/[\\/:*?"<>|]/g, "-");

    // 3. Area
    let area = await quickAddApi.suggester(
        [
            "Physics",
            "Writing",
            "Philosophy",
            "Politics",
            "Personal",
            "Other"
        ],
        [
            "physics",
            "writing",
            "philosophy",
            "politics",
            "personal",
            "other"
        ]
    );

    if (!area) return;

    if (area === "other") {
        area = await quickAddApi.inputPrompt("Area");
        if (!area) return;
        area = area.trim().toLowerCase();
    }

    // 4. Naming + folders
    const configs = {
        research: {
            prefix: "Research - ",
            folders: [
                "Research Log",
                "Derivations",
                "Meetings",
                "Working Notes",
                "Writing"
            ]
        },

        novel: {
            prefix: "Novel - ",
            folders: [
                "Manuscript",
                "Characters",
                "World",
                "Plot",
                "Scenes",
                "Research"
            ]
        },

        nonfiction: {
            prefix: "Book - ",
            folders: [
                "Manuscript",
                "Chapters",
                "Research",
                "Notes"
            ]
        },

        poetry: {
            prefix: "Poetry - ",
            folders: [
                "Poems",
                "Fragments",
                "Notes"
            ]
        },

        other: {
            prefix: "",
            folders: [
                "Notes"
            ]
        }
    };

    const config = configs[kind];
    const projectName = `${config.prefix}${name}`;
    const projectFolder = `Projects/${projectName}`;
    const hubPath = `${projectFolder}/${projectName}.md`;

    if (app.vault.getAbstractFileByPath(projectFolder)) {
        new obsidian.Notice("A project with that name already exists.");
        return;
    }

    // 5. Create folders
    await app.vault.createFolder(projectFolder);

    for (const folder of config.folders) {
        await app.vault.createFolder(`${projectFolder}/${folder}`);
    }

    // Local YYYY-MM-DD
    const now = new Date();
    const created =
        `${now.getFullYear()}-` +
        `${String(now.getMonth() + 1).padStart(2, "0")}-` +
        `${String(now.getDate()).padStart(2, "0")}`;

    // 6. Hub contents
    const headings = {
        research: `## Research objective

What am I trying to investigate, establish, or produce?

## Current state

## Next actions

- [ ]

## Open questions

-

## Key results and decisions

-`,

        novel: `## Premise

What is this story fundamentally about?

## Current state

## Next actions

- [ ]

## Open questions

-

## Key decisions

-`,

        nonfiction: `## Book objective

What should this book accomplish?

## Audience

Who am I writing for?

## Current state

## Next actions

- [ ]

## Open questions

-

## Key decisions

-`,

        poetry: `## Collection idea

What holds this project together?

## Current state

## Next actions

- [ ]

## Themes / ideas

-

## Key decisions

-`,

        other: `## Objective

What am I trying to create or accomplish?

## Current state

## Next actions

- [ ]

## Open questions

-

## Key decisions

-`
    };

    const content = `---
type: project
kind: ${kind}
area: ${area}
status: active
created: ${created}
deadline:
---

${headings[kind]}

## Project tasks

\`\`\`tasks
path includes ${projectFolder}
not done
sort by due
\`\`\`
`;

    // 7. Create + open hub
    const file = await app.vault.create(hubPath, content);
    await app.workspace.getLeaf(false).openFile(file);

    new obsidian.Notice(`Created ${projectName}`);
};