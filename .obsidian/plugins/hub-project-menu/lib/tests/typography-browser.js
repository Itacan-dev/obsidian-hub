"use strict";

// Production renderers with a portable native Obsidian host.
window.onload = async function runTypographyChecks() {
    let checks = 0;
    const assert = (condition, message) => {
        checks++;
        if (!condition) throw Error(message);
    };
    const near = (actual, expected, message) => assert(Math.abs(actual - expected) < .08, `${message}: ${actual} / ${expected}`);
    const rect = element => element.getBoundingClientRect();
    const style = element => getComputedStyle(element);
    const host = document.getElementById("fixtures");
    const cleanups = [];
    const settle = async () => {
        await document.fonts.ready;
        await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    };
    const hover = async element => {
        element.scrollIntoView({ block: "center", behavior: "instant" });
        await settle();
        const bounds = rect(element);
        return new Promise(resolve => {
            window.hubTestPointerDone = resolve;
            window.hubTestPointerRequest = { x: bounds.left + bounds.width / 2, y: bounds.top + bounds.height / 2, action: "move" };
        });
    };
    function create(tag, cls = "", text = "", parent = host) {
        const element = document.createElement(tag);
        element.className = cls;
        element.textContent = text;
        parent.append(element);
        return element;
    }
    HTMLElement.prototype.createEl = function(tag, options = {}) {
        const element = create(tag, options.cls, options.text, this);
        for (const [name, value] of Object.entries(options.attr || {})) element.setAttribute(name, value);
        if (options.type) element.type = options.type;
        return element;
    };
    HTMLElement.prototype.createDiv = function(options) { return this.createEl("div", options); };
    HTMLElement.prototype.createSpan = function(options) { return this.createEl("span", options); };
    HTMLElement.prototype.empty = function() { this.replaceChildren(); };
    const icon = () => {
        const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
        svg.setAttribute("width", "17");
        svg.setAttribute("height", "17");
        return svg;
    };
    const native = { Modal: class {}, Notice: class {}, getIcon: icon, setIcon(element) { element.replaceChildren(icon()); }, addIcon() {} };
    const sources = new Map(), modules = new Map();
    function resolveModule(from, request) {
        const parts = (from.slice(0, from.lastIndexOf("/")) + "/" + request).split("/"), result = [];
        for (const part of parts) {
            if (part === "..") result.pop();
            else if (part !== ".") result.push(part);
        }
        return result.join("/").replace(/\.js$/, "");
    }
    async function collect(name) {
        if (sources.has(name)) return;
        const response = await fetch("../" + name + ".js");
        if (!response.ok) throw Error("Cannot load production module " + name);
        const source = await response.text();
        sources.set(name, source);
        const dependencies = [...source.matchAll(/require\(["'](\.\.?\/[^"']+)["']\)/g)].map(match => resolveModule(name, match[1]));
        await Promise.all(dependencies.map(collect));
    }
    function load(name) {
        if (name === "obsidian") return native;
        if (modules.has(name)) return modules.get(name).exports;
        const module = { exports: {} };
        modules.set(name, module);
        new Function("module", "require", sources.get(name))(module, request => load(request === "obsidian" ? request : resolveModule(name, request)));
        return module.exports;
    }
    function type(element, size, weight, line) {
        near(parseFloat(style(element).fontSize), size, element.className + " size");
        assert(style(element).fontWeight === String(weight), element.className + " weight");
        if (line != null) near(parseFloat(style(element).lineHeight), line, element.className + " leading");
    }
    function inside(child, parent, message) {
        assert(rect(child).bottom <= rect(parent).bottom + .1 && rect(child).right <= rect(parent).right + .1, message);
    }
    function readable(element, pseudo = null) {
        const textStyle = getComputedStyle(element, pseudo);
        const foreground = textStyle.color.match(/[\d.]+/g).slice(0, 3).map(Number);
        let background, opacity = pseudo ? Number(textStyle.opacity) : 1;
        for (let node = element; node; node = node.parentElement) {
            const computed = style(node);
            opacity *= Number(computed.opacity);
            if (!background && computed.backgroundColor !== "rgba(0, 0, 0, 0)") background = computed.backgroundColor.match(/[\d.]+/g).slice(0, 3).map(Number);
        }
        const luminance = channels => channels.map(value => value / 255).map(value => value <= .04045 ? value / 12.92 : ((value + .055) / 1.055) ** 2.4).reduce((sum, value, index) => sum + value * [.2126, .7152, .0722][index], 0);
        const ink = luminance(foreground.map((value, index) => value * opacity + background[index] * (1 - opacity)));
        const paper = luminance(background), ratio = (Math.max(ink, paper) + .05) / (Math.min(ink, paper) + .05);
        assert(ratio >= 4.5, element.className + " contrast " + ratio);
        return Number(ratio.toFixed(2));
    }
    function modal(name, classes = "") {
        return create("div", "modal-content hub-button-scope " + classes, "", create("div", "modal hub-color-scope " + name));
    }
    function dashboardHost() {
        const viewport = create("div", "markdown-preview-view markdown-rendered dashboard");
        viewport.style.cssText = "position:relative;height:auto;overflow:visible";
        return create("div", "markdown-preview-sizer", "", viewport);
    }
    try {
        const nativeCss = new URLSearchParams(location.search).get("preview");
        if (nativeCss) {
            const link = document.createElement("link");
            link.rel = "stylesheet"; link.href = nativeCss;
            document.head.prepend(link);
            await new Promise((resolve, reject) => { link.onload = resolve; link.onerror = reject; });
            document.getElementById("native-host").remove();
        }
        await Promise.all(["ui/workspace-cards", "ui/task-card", "ui/task-form", "ui/capture-actions", "ui/window-title", "ui/dashboard-ui", "ui/workspace-explorer"].map(collect));
        const cardModule = load("ui/workspace-cards"), tasks = load("ui/task-card"), forms = load("ui/task-form");
        const capture = load("ui/capture-actions"), headers = load("ui/window-title");
        const homeSource = await (await fetch("../../../../../System/Dashboards/Home/view.js")).text();
        const headingSource = homeSource.match(/function heading\([\s\S]*?\n}/)?.[0];
        assert(headingSource, "Home heading helper is available");
        const homeHeading = new Function("return (" + headingSource + ")")();
        const dashboardUi = load("ui/dashboard-ui").createDashboardUi({ navClass: "home-nav-button" });
        const home = create("div", "home-dashboard hub-button-scope hub-color-scope", "", dashboardHost());
        home.style.width = "1700px";
        const page = create("h1", "home-greeting", "Good afternoon", home);
        const context = create("div", "home-context", "Your daily work", home);
        const date = create("div", "home-date", "12 November", home);
        const grid = create("div", "home-main-grid", "", home);
        const focus = create("div", "home-panel home-glance", "", grid);
        homeHeading(focus, "home-panel-title", "Today's Focus");
        const focusContext = create("div", "home-focus-project", "Pulsed Optomechanics", focus);
        const focusText = create("div", "home-focus-text", "Review the research notes", focus);
        const calendar = create("div", "home-panel home-calendar", "", grid);
        homeHeading(calendar, "home-panel-title", "Calendar");
        const taskPanel = create("div", "home-panel home-upcoming", "", grid);
        homeHeading(taskPanel, "home-panel-title", "Tasks");
        const completed = tasks.createTaskRow(taskPanel, { text: "Review the experimental controls", completed: true }, true, { variant: "home" });
        completed.source.textContent = "Research / Notes";
        const projects = create("div", "home-panel home-projects", "", grid);
        homeHeading(create("div", "home-project-tabs", "", projects), "home-project-heading", "Projects");
        const projectGrid = create("div", "home-project-grid", "", create("div", "home-project-rail", "", projects));
        const cardsFor = root => cardModule.createWorkspaceCards({ root, app: { vault: { getAbstractFileByPath() {} } }, component: { register() {} }, categories: () => [{ id: "research", name: "Research", image: "sample.png" }] });
        const cards = cardsFor(home);
        const projectCards = ["Quantum Gravitational Phenomena", "Pulsed Optomechanics", "Itacan"].map(name => cards.render(projectGrid, { name, categoryId: "research", path: name }, () => {}));
        const resources = create("div", "home-resource-section", "", projects);
        homeHeading(resources, "home-resource-heading", "Resources");
        const resourceGrid = create("div", "home-resource-grid", "", resources);
        const resourceCards = ["Knowledge", "Research", "Explorations", "Inspiration"].map(name => cards.render(resourceGrid, { name, resourceType: name, path: name }, () => {}));
        const progress = create("div", "home-panel home-recent", "", grid);
        const progressHeading = homeHeading(progress, "home-panel-title", "Progress");
        const progressAction = create("button", "hub-panel-action", "Statistics", progressHeading);
        const selectors = create("div", "home-progress-tabs hub-panel-selectors hub-history-selectors", "", progress);
        const tab = create("button", "", "Reports", selectors);
        const clock = create("div", "home-recent-clock", "14:30", progress);
        const breadcrumb = create("span", "home-recent-breadcrumb-part", "Research", progress);
        const decoration = create("span", "home-recent-breadcrumb-separator", "/", progress);
        const heatmap = create("div", "heatmap-calendar-graph hub-progress-graph", "", create("div", "home-progress-calendar", "", progress));
        const month = create("li", "", "Nov", create("ul", "heatmap-calendar-months", "", heatmap));
        const weekday = create("li", "", "M", create("ul", "hub-progress-weekdays", "", heatmap));
        const histories = [clock, breadcrumb], workspaces = [];
        for (const resource of [false, true]) {
            const workspace = create("div", "project-dashboard hub-button-scope hub-color-scope" + (resource ? " resource-dashboard" : ""), "", dashboardHost());
            create("h1", "project-title", resource ? "Knowledge" : "Pulsed Optomechanics", workspace);
            const panel = create("div", "project-panel project-progress", "", workspace);
            const heading = create("div", "project-panel-title project-progress-title", "", create("div", "project-progress-header", "", panel));
            create("h2", "hub-panel-heading-label", "Progress", heading);
            dashboardUi.historyHeading(panel);
            histories.push(create("span", "project-activity-clock", "14:30", panel));
            const row = tasks.createTaskRow(panel, { text: "Complete the next step", completed: true }, true);
            row.source.textContent = "Concepts / Note";
            const taskHeading = create("div", "project-panel-title project-tasks-title", "", workspace);
            create("h2", "hub-panel-heading-label", "Tasks", taskHeading);
            const folder = { path: "Projects/Typography", name: "Typography", children: [] }, folderStates = {};
            const explorer = load("ui/workspace-explorer").mountWorkspaceExplorer({ parent: workspace, workspacePath: folder.path,
                dashboardPath: folder.path + "/Home.md", descriptors: () => [{ path: folder.path, title: folder.name, isRoot: true }],
                getByPath: path => path === folder.path ? folder : null, states: () => folderStates, persist() {}, setIcon: native.setIcon, openFile() {}, createItem() {} });
            cleanups.push(() => explorer.destroy());
            workspaces.push({ workspace, heading, row });
        }
        const picker = modal("hub-oath-workspace-picker"), pickerCards = cardsFor(picker);
        const pickerCard = pickerCards.render(create("div", "hub-oath-workspace-grid is-project", "", picker), { name: "Quantum Gravitational Phenomena", categoryId: "research", path: "picker" }, () => {});
        const pickerResource = pickerCards.render(create("div", "hub-oath-workspace-grid is-resource", "", picker), { name: "Explorations", resourceType: "Explorations", path: "resource" }, () => {});
        const editors = [];
        for (const name of ["Add task", "Edit task"]) {
            const editor = modal("hub-task-dialog hub-task-compact-dialog hub-task-live-dialog", "hub-task-form hub-capture-form-scope hub-capture-content");
            const heading = headers.createModalHeader(editor, { title: name, icon: "square-plus" }).heading;
            const fields = create("div", "hub-task-live-fields", "", editor);
            const row = tasks.createTaskRow(create("div", "hub-task-card-container", "", fields), { text: "" });
            const input = create("textarea", "hub-task-card-edit-input", "", row.textEl);
            input.value = "A long editable task title that should wrap without clipping when its font is enlarged";
            const wrapping = forms.mountWrappingTaskInput(input);
            cleanups.push(() => wrapping.destroy());
            const disabled = create("button", "hub-task-config-action", "Add due date", fields);
            disabled.disabled = true;
            const endpoint = create("div", "hub-task-config-section hub-task-date-endpoint", "", fields);
            const dateInput = create("input", "", "", create("div", "hub-task-date-surface", "", endpoint));
            dateInput.type = "date";
            editors.push({ heading, input, disabled, dateInput });
        }
        const captures = [];
        const placeholders = [];
        for (const inbox of [false, true]) {
            const content = modal(inbox ? "hub-inbox-dialog" : "hub-quick-add-dialog", "hub-capture-content hub-capture-form-scope");
            headers.createModalHeader(content, { title: inbox ? "Inbox" : "Quick Add", icon: "inbox" });
            if (!inbox) placeholders.push(forms.mountTaskText(create("div", "hub-capture-text-editor", "", content), { text: "" }, () => {}, { multiline: true, placeholder: "Start typing..." }));
            const actions = create("div", inbox ? "hub-inbox-organize-actions hub-capture-action-row" : "hub-quick-capture-actions", "", content);
            const buttons = capture.captureActions({ attachments: [] }).map(choice => capture.captureAction(actions, choice, () => {}));
            captures.push({ actions, buttons });
        }
        const nativeHeading = headers.createModalHeader(modal("hub-settings-dialog", "hub-settings-content"), { title: "Settings", icon: "settings" }).heading;
        const windows = editors.map(editor => editor.heading);
        windows.push(nativeHeading, ...[...host.querySelectorAll(".hub-quick-add-dialog h2, .hub-inbox-dialog h2")]);
        for (const [name, shell, content] of [
            ["Daily brief", "hub-daily-brief-window", "hub-daily-brief-modal"],
            ["Statistics", "hub-statistics-window", "hub-project-advancement-modal hub-statistics-modal"],
            ["Make an Oath", "hub-oath-dialog", "hub-oath-setup"],
            ["Task location", "hub-task-location-dialog", ""],
            ["Note location", "hub-task-location-dialog", ""],
            ["File location", "hub-task-location-dialog", ""],
            ["Save preset", "hub-preset-dialog", ""]
        ]) {
            const root = modal(shell, content);
            const body = create("div", "", "Body context", root);
            const bodyFont = style(body).fontSize;
            const title = headers.createWindowTitle(root, name, "settings");
            headers.setWindowUndertext(title, create("p", "hub-oath-muted", "Window guidance", root));
            assert(style(body).fontSize === bodyFont, name + " keeps its body font context");
            windows.push(title);
        }
        const noIcon = headers.createModalHeader(modal("hub-inbox-dialog", "hub-capture-content"), { title: "Confirm action", subtitle: "Supporting information" }).heading;
        windows.push(noIcon);
        const dated = headers.createWindowTitle(modal("hub-daily-report-dialog", "hub-daily-report-modal"), "Progress report", "settings", { date: { label: "12 Nov", value: "2026-11-12" } });
        windows.push(dated);
        type(dated.parentElement.querySelector("time"), 21.93, 680, 26.316);
        const themedRoot = modal("hub-quick-add-dialog", "hub-capture-content");
        themedRoot.style.setProperty("--font-ui-medium", "18px");
        const themedTitle = headers.createWindowTitle(themedRoot, "Theme UI size", "settings");
        type(themedTitle, 26.316, 680, 31.5792);
        near(parseFloat(style(themedRoot).fontSize), 13.44, "Native title sizing does not resize capture content");
        themedRoot.parentElement.remove();
        const longRoot = modal("hub-quick-add-dialog", "hub-capture-content");
        const longHeader = headers.createModalHeader(longRoot, {
            title: "Choose a destination for Quantum Gravitational Phenomena and research notes",
            subtitle: "Choose an existing destination", icon: "settings"
        });
        const followingContent = create("p", "", "Dialog content", longRoot);
        const close = create("button", "modal-close-button", "x", longRoot.parentElement);
        close.setAttribute("aria-label", "Close dialog");
        close.style.cssText = "position:absolute;right:8px;top:8px;width:24px;height:24px;padding:0";
        for (const width of [650, 320]) {
            for (const rootSize of [16, 32]) {
                document.documentElement.style.fontSize = rootSize + "px";
                longRoot.parentElement.style.width = width + "px";
                await settle();
                inside(longHeader.heading, longHeader.header, "Long heading remains inside its header");
                assert(rect(followingContent).top >= rect(longHeader.header).bottom, "Long heading stays above dialog content");
                const range = document.createRange();
                range.selectNodeContents(longHeader.heading);
                const corner = rect(close);
                for (const line of range.getClientRects()) assert(line.bottom <= corner.top || line.top >= corner.bottom || line.right <= corner.left, "Heading text clears the close button");
            }
        }
        document.documentElement.style.fontSize = "16px";
        longRoot.parentElement.remove();
        const rail = create("div", "project-dashboard hub-button-scope", "", create("div", "hub-project-rail"));
        const railTitle = create("div", "project-nav-title", "Pulsed Optomechanics", rail);
        const dailyName = create("div", "daily-project-name", "Research", create("div", "daily-project-list"));
        const subheading = dashboardUi.historyHeading(progress);
        const headingLevel = element => element.matches("h1,h2,h3,h4,h5,h6") ? Number(element.tagName.slice(1)) : Number(element.getAttribute("aria-level"));
        for (const root of [home, ...workspaces.map(item => item.workspace)]) {
            const headings = [...root.querySelectorAll("h1,h2,h3,[role=heading]")];
            assert(headingLevel(headings[0]) === 1, "Page heading precedes its panels");
            assert(headings.filter(element => headingLevel(element) === 1).length === 1, "Dashboard has one page heading");
            assert(headings.filter(element => headingLevel(element) === 2).length === (root === home ? 6 : 3), "Dashboard panels have level-two headings");
            assert(headings.filter(element => headingLevel(element) === 3).length === 1, "History is a level-three subsection");
            for (const label of root.querySelectorAll(".hub-panel-heading-label")) {
                assert(label.tagName === "H2" && !label.querySelector("button"), "Native panel heading contains only its label");
                near(parseFloat(style(label).marginTop), 0, "Native heading introduces no top margin");
                near(parseFloat(style(label).marginBottom), 0, "Native heading introduces no bottom margin");
                type(label, 16, 700);
            }
        }
        assert(!progressHeading.querySelector("h2").contains(progressAction), "Progress controls stay outside the heading name");
        const checked = completed.checkbox.checked;
        completed.checkbox.click();
        assert(completed.checkbox.checked !== checked, "Task checkbox interaction remains available");
        for (const title of windows) type(title, 21.93, 680, 26.316);
        for (const row of [completed, ...workspaces.map(item => item.row)]) {
            type(row.textEl, 13.44, 400, 18.144);
            type(row.source, 10.56, 400);
        }
        const dense = tasks.createTaskRow(taskPanel, { text: "Dense Schedule card" });
        dense.row.classList.add("hub-full-task-card");
        type(dense.textEl, 12.48, 400, 17.472);
        dense.row.classList.remove("hub-full-task-card");
        dense.row.classList.add("is-calendar-task");
        type(dense.textEl, 11.52, 400, 14.976);
        dense.row.remove();
        const themeResults = {};
        for (const theme of ["dark", "light"]) {
            document.body.className = "theme-" + theme;
            await settle();
            for (const title of windows) type(title, 21.93, 680, 26.316);
            themeResults[theme] = [focusContext, ...histories, completed.source, ...workspaces.map(item => item.row.source)].map(element => readable(element));
            for (const input of placeholders) readable(input, "::placeholder");
            const faint = create("span", "", "", focus);
            faint.style.color = "var(--text-faint)";
            assert(style(decoration).color === style(faint).color, "Decorative separator retains faint treatment");
            faint.remove();
            for (const editor of editors) assert(style(editor.disabled).color !== style(focusContext).color, "Disabled controls retain distinct treatment");
        }
        type(page, 26.4, 700, 31.68);
        type(context, 12.48, 600, 18.72);
        type(date, 11.52, 600, 17.28);
        type(focusContext, 10.56, 650, 15.84);
        type(focusText, 13.44, 400, 18.144);
        type(subheading, 14.4, 700);
        type(dailyName, 13.44, 400);
        type(railTitle, 16, 700, 20);
        type(month, 10.56, 400, 14.784);
        type(weekday, 10.56, 400, 10.56);
        near(parseFloat(style(nativeHeading).fontSize), 21.93, "Settings native heading");
        for (const editor of editors) {
            type(editor.heading, 21.93, 680, 26.316);
            type(editor.input, 13.44, 400, 18.144);
        }
        assert(style(document.getElementById("native-button")).fontSize === "13px", "Typography remains scoped");
        near(rect(tab).height, 23, "Baseline compact control height");
        near(rect(projectCards[0]).height, 132, "Baseline Home project height");
        near(rect(pickerCard).height, 120, "Baseline picker project height");
        near(rect(resourceCards[0]).height, 104, "Baseline Home resource height");
        near(rect(pickerResource).height, 100, "Baseline picker resource height");
        assert(projects.scrollHeight === projects.clientHeight, "Baseline Projects has no vertical overflow");
        for (const card of [...projectCards, pickerCard]) {
            type(card.querySelector(".home-project-title"), 16, 700, 20.8);
            type(card.querySelector(".home-project-category"), 11.52, 500, 14.4);
            assert(style(card.querySelector(".home-project-title")).webkitLineClamp === "3", "Three-line clamp retained");
        }
        const compactMetrics = [];
        for (const theme of ["dark", "light"]) {
            document.body.className = "theme-" + theme;
            for (const rootSize of [16, 20, 24, 32]) {
                document.documentElement.style.fontSize = rootSize + "px";
                for (const { actions, buttons } of captures) {
                    for (const width of [480, 400, 360, 320, 240, 160]) {
                        actions.style.width = width + "px";
                        await settle();
                        for (const button of buttons) {
                            const label = button.lastElementChild;
                            type(label, rootSize * .78, 400, rootSize * .78 * 1.4);
                            inside(label, button, "Capture label stays inside its button");
                            assert(button.scrollWidth <= button.clientWidth, "Capture action has no horizontal text clipping");
                            assert(rect(button).right <= rect(actions).right + .1, "Action stays in its group");
                            const iconBounds = rect(button.firstElementChild), buttonBounds = rect(button);
                            near(iconBounds.left + iconBounds.width / 2, buttonBounds.left + buttonBounds.width / 2, "Action icon stays centered");
                        }
                        const columns = style(actions).gridTemplateColumns.split(" ").filter(value => parseFloat(value) > 0).length;
                        const expected = Math.min(3, Math.max(1, Math.floor((width + 8) / (rootSize * 6 + 8))));
                        assert(columns === expected, "Action columns adapt to readable text width");
                        compactMetrics.push({ rootSize, width, columns, font: style(buttons[0]).fontSize });
                    }
                }
                await settle();
                for (const heading of [progressHeading, ...workspaces.map(item => item.heading)]) near(parseFloat(style(heading).lineHeight), rootSize, "Progress leading scales with heading");
                for (const card of [...projectCards, pickerCard]) {
                    inside(card.querySelector(".home-project-category"), card.querySelector(".home-project-surface"), "Enlarged subtitle remains visible");
                    if (rootSize === 32) assert(rect(card.querySelector(".home-project-title")).right < rect(card.querySelector(".home-project-image")).left, "Enlarged title stays clear of the image");
                }
                for (const editor of editors) {
                    assert(editor.input.scrollHeight <= editor.input.clientHeight + 1, "Wrapping task editor grows with its text");
                    const line = style(editor.dateInput).lineHeight;
                    if (line !== "normal") assert(rect(editor.dateInput).height >= parseFloat(line) + 8, "Date control accommodates its leading");
                }
                if (rootSize === 32) {
                    projects.scrollTop = projects.scrollHeight;
                    assert(projects.scrollTop > 0, "Enlarged Home content remains accessible through panel scrolling");
                }
            }
        }
        document.documentElement.style.fontSize = "16px";
        for (const { actions, buttons } of captures) {
            actions.style.width = "240px";
            buttons[0].lastElementChild.textContent = "Create a task in the selected research workspace";
            await settle();
            assert(rect(buttons[0].lastElementChild).height > parseFloat(style(buttons[0]).lineHeight) * 2, "Long labels wrap naturally");
            inside(buttons[0].lastElementChild, buttons[0], "Wrapped action stays contained");
            await hover(buttons[0]);
            assert(buttons[0].matches(":hover"), "Capture action receives pointer hover");
            buttons[0].focus();
            assert(style(buttons[0]).outlineStyle !== "none", "Capture keyboard focus remains visible");
            const height = rect(buttons[0]).height;
            buttons[0].disabled = true;
            assert(Number(style(buttons[0]).opacity) === .65, "Capture disabled treatment retained");
            near(rect(buttons[0]).height, height, "Disabled action preserves its layout");
            buttons[0].disabled = false;
        }
        const resourceTitle = resourceCards[2].querySelector(".home-resource-title");
        resourceTitle.textContent = "Explorations and long translated resource names";
        document.documentElement.style.fontSize = "32px";
        await settle();
        inside(resourceTitle, resourceCards[2].querySelector(".home-resource-face"), "Resource card grows around enlarged title");
        document.documentElement.style.fontSize = "16px";
        for (const zoom of [.8, 1.25, 2]) {
            home.style.zoom = zoom;
            await settle();
            near(parseFloat(style(projectCards[0].querySelector(".home-project-title")).fontSize), 16, "CSS zoom preserves authored size");
            inside(projectCards[0].querySelector(".home-project-category"), projectCards[0], "Zoom keeps subtitle visible");
            for (const editor of editors) {
                const shell = editor.input.closest(".modal");
                shell.style.zoom = zoom;
                await settle();
                assert(editor.input.scrollHeight <= editor.input.clientHeight + 1, "Zoom keeps editable task text visible");
                shell.style.zoom = "1";
            }
        }
        home.style.zoom = "1";
        const spacing = document.createElement("style");
        spacing.textContent = ".home-project-content * { line-height:1.5!important; letter-spacing:.12em!important; word-spacing:.16em!important; }";
        document.head.append(spacing);
        document.documentElement.style.fontSize = "32px";
        await settle();
        inside(projectCards[0].querySelector(".home-project-category"), projectCards[0], "Text spacing and enlargement retain the subtitle");
        spacing.remove();
        document.documentElement.style.fontSize = "16px";
        window.hubTypographyResults = { checks, themeResults, compactMetrics };
        document.getElementById("result").textContent = `PASS: ${checks} typography assertions; primary task titles, native window headings, dashboard semantics, both themes, narrow labels, 200% root text, CSS zoom and baseline card sizes.\nContrast dark ${themeResults.dark.join(", ")}; light ${themeResults.light.join(", ")}.`;
    } catch (error) {
        document.getElementById("result").textContent = "FAIL " + error.stack;
    } finally {
        cleanups.reverse().forEach(cleanup => cleanup());
    }
};
