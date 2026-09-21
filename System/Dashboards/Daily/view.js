
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
                "daily-project-empty"
        }
    );

    return;
}


const list =
    dv.container.createDiv({
        cls:
            "daily-project-list"
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