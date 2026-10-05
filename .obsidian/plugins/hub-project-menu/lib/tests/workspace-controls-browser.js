"use strict";
window.hubTestWorkspaceControls = async f => {
    const { assert, settle, container, load, plugin } = f;
    const rect = el => el.getBoundingClientRect();
    const near = (a, b, label) => assert(Math.abs(a - b) < 1, label + ` (${a}, ${b})`);
    const equal = (buttons, height) => {
        buttons.forEach(button => {
            near(rect(button).height, height, "Common control height");
            near(rect(button).width, rect(buttons[0]).width, "Equal selector widths");
            assert(!button.querySelector("svg"), "Selectors remain text only");
        });
    };
    const toolbarChecks = () => {
        const toolbar = [...f.root.querySelectorAll(".hub-planning-toolbar")].find(el => el.getClientRects().length);
        const controls = [...toolbar.querySelectorAll("button,select")];
        controls.forEach(control => near(rect(control).height, 23, "Compact planning control"));
        const navigation = [...toolbar.querySelectorAll(".hub-planning-navigation button")];
        navigation.slice(0, 2).forEach(control => near(rect(control).width, 23, "Square navigation"));
        if (navigation.length) {
            assert(navigation[0].querySelector('[data-icon="chevron-left"]'), "Previous uses Lucide chevron-left");
            assert(navigation[1].querySelector('[data-icon="chevron-right"]'), "Next uses Lucide chevron-right");
            assert(navigation[2].textContent === "Today" && !navigation[2].querySelector("svg"), "Today remains text-only");
        }
        near(rect(toolbar).height, parseFloat(f.root.style.getPropertyValue("--hub-project-header-height")), "Planning header matches Work Files separator");
        const actions = toolbar.querySelector(".hub-planning-actions");
        assert(actions.scrollWidth <= actions.clientWidth + 1, "Actions do not overlap");
        return toolbar;
    };
    for (const width of [1040, 1440, 760]) {
        container.style.width = width + "px";
        f.mount(f.project); f.click("Work"); load("ui/full-view-layout").mountFullViewLayout({root:f.root,component:f.component,app:plugin.app}); await settle();
        const modes = [...f.root.querySelectorAll(".hub-task-mode")];
        equal(modes, 29);
        const search = f.root.querySelector(".hub-context-search"), primary = f.root.querySelector(".hub-task-primary-modes");
        const primaryStyle = getComputedStyle(primary);
        near(rect(modes[2]).right + parseFloat(primaryStyle.paddingRight), rect(primary).right - parseFloat(primaryStyle.borderRightWidth), "Primary buttons fill the divider-derived width");
        if (width >= 1040) near(rect(primary).right - parseFloat(primaryStyle.borderRightWidth), rect(f.root.querySelector(".hub-explorer-details")).left, "Primary separator aligns with Files divider");
        const positions = [...modes, primary, search].map(el => ({ left: rect(el).left, width: rect(el).width }));
        const stableModes = () => [...modes, primary, search].forEach((el, index) => {
            near(rect(el).left, positions[index].left, "Mode switching preserves horizontal position");
            near(rect(el).width, positions[index].width, "Mode switching preserves width");
        });
        assert(rect(primary).right <= rect(search).left, "Primary modes do not overlap search");
        f.click("Schedule");
        let previousY;
        for (const label of ["Overview", "Month", "Week"]) {
            f.click(label); await settle();
            stableModes();
            const toolbar = toolbarChecks();
            const choices = [...toolbar.querySelectorAll(".hub-panel-selectors button")];
            equal(choices, 23);
            assert(choices.find(button => button.textContent === label).classList.contains("is-active"), "Selected schedule view remains active");
            const action = toolbar.querySelector(".hub-full-add-task");
            assert(action.textContent === "Task" && action.querySelector('[data-icon="plus"]'), "Schedule action keeps its label and Lucide plus");
            near(rect(action).width,rect(choices[0]).width,"Task shares the Schedule view width");
            const internalGap = rect(choices[2]).left - rect(choices[1]).right;
            near(rect(choices[1]).left - rect(choices[0]).right, rect(action).left - rect(choices[2]).right, "Overview separation matches Task action separation");
            assert(rect(action).left - rect(choices[2]).right > internalGap, "Action is separate from selector");
            if (previousY != null) near(rect(action).top, previousY, "Switching Schedule views preserves control centerline");
            previousY = rect(action).top;
            if (label === "Overview") assert(toolbar.querySelector(".hub-schedule-title").textContent==="Schedule"&&!toolbar.querySelector("h3"), "Schedule panel title without a redundant Overview heading");
        }
        f.click("Roadmap"); await settle();
        stableModes();
        const toolbar = toolbarChecks(), actions = [...toolbar.querySelectorAll(".hub-roadmap-add-phase,.hub-roadmap-add-milestone")];
        assert(actions.map(button => button.textContent).join("|") === "Phase|Milestone", "Roadmap actions preserved");
        actions.forEach(button => assert(button.querySelector('[data-icon="plus"]') && !button.classList.contains("is-active"), "Neutral labelled Roadmap action"));
    }
    const samples = document.body.createDiv({ cls: "control-samples" });
    const referenceHost = samples.createDiv({ cls: "home-dashboard hub-button-scope" });
    const reference = referenceHost.createEl("button", { cls: "home-project-create hub-panel-action hub-panel-action-icon hub-panel-add", attr: { "aria-label": "New project" } });
    const setIcon = load("ui/icons").setHubIcon;
    setIcon(reference.createSpan({ cls: "home-project-create-icon" }), "plus");
    let created = 0;
    for (const variant of ["Home", "Project", "Resource", "Project note", "Resource note"]) {
        const host = samples.createDiv({ cls: (variant === "Home" ? "home-dashboard" : "project-dashboard") + " hub-button-scope" });
        if (variant.includes("note")) {
            const rail = samples.createDiv({ cls: "hub-project-rail" }); rail.style.width = "320px"; rail.append(host);
        }
        const header = host.createDiv({ cls: variant === "Home" ? "home-panel-title" : "project-tasks-title" });
        header.createSpan({ text: variant + " Tasks" });
        const clear = header.createEl("button", { text: "Clear", cls: "hub-panel-action hub-compact-panel-action" });
        const body = host.createDiv(), component = new f.component.constructor();
        const options = { root: variant };
        const ui = load("ui/tasks").createTaskUi({ app: plugin.app, component, body, createTask: value => { assert(value === options, "Add workflow receives original options"); created++; } });
        ui.addButton(header, options);
        const add = header.querySelector(".hub-task-add");
        assert(add.textContent === "" && add.getAttribute("aria-label") === "Add task" && add.title === "Add task", "Icon-only Tasks add remains accessible");
        assert(add.querySelector('[data-icon="plus"]'), "Task panel uses Lucide plus");
        for (const property of ["width", "height", "padding", "borderRadius", "backgroundColor", "borderTopColor", "boxShadow", "color"]) {
            assert(getComputedStyle(add)[property] === getComputedStyle(reference)[property], variant + " add matches Project creation " + property);
        }
        near(rect(add).width, 23, "Task add is compact square");
        near(rect(add).height, 23, "Task add height");
        near(rect(clear).top + rect(clear).height / 2, rect(add).top + rect(add).height / 2, "Clear/add centerline");
        near(rect(add.querySelector("svg")).width, 15, "Reference icon size");
        add.click(); assert(!add.classList.contains("is-active"), "Task action never retains an active state");
        component.unload();
    }
    assert(created === 5, "All five task-panel variants invoke the existing Add callback");
    window.controlHeaderPreview = () => { container.replaceChildren(samples.cloneNode(true)); };
    samples.remove(); container.style.width = "1040px"; f.mount(f.project); f.click("Schedule"); f.click("Overview"); await settle();
};
