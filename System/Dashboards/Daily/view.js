
const projects =
    window
        .hubGetChangedProjectsToday?.()
    ?? [];


if (
    projects.length === 0
) {

    dv.el(
        "div",
        "No project activity yet today.",
        {
            cls:
                "daily-project-empty hub-color-scope"
        }
    );

    return;
}


const list =
    dv.container.createDiv({
        cls:
            "daily-project-list hub-color-scope"
    });


for (
    const project
    of projects
) {

    const row =
        list.createDiv({
            cls:
                "daily-project-row"
        });


    const icon =
        row.createSpan({
            cls:
                "daily-project-icon"
        });


    window.hubSetIcon?.(
        icon,
        "folder"
    );


    const name =
        row.createSpan({
            cls:
                "daily-project-name",

            text:
                project.name
    });


    row.addEventListener(
        "click",
        async () => {

            const file =
                app.vault
                    .getAbstractFileByPath(
                        project.path
                    );


            if (file) {

                await app.workspace
                    .getLeaf(false)
                    .openFile(
                        file
                    );
            }
        }
    );
}