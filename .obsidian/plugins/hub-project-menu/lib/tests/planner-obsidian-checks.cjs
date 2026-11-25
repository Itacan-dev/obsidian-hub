"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

module.exports = async function checkPlanner({ evaluate, click: nativeClick, key, call, delay, wc, scratch }) {
    const waitFor = async expression => {
        for (let i = 0; i < 100; i++) {
            if (await wc.executeJavaScript(expression).catch(() => false)) return;
            await delay(100);
        }
        const state = await wc.executeJavaScript(`({
            status:document.querySelector('.hub-plans-status')?.textContent,
            active:app.workspace.getActiveFile()?.path,
            home:[...document.querySelectorAll('.home-glance:not(.hub-expansion-slot)')].map(panel=>({
                visible:panel.checkVisibility(), width:panel.clientWidth,
                trigger:!!panel.querySelector('.hub-expansion-trigger'), ready:panel.closest('.home-dashboard')?.dataset.hubReady,
                type:panel.closest('.workspace-leaf-content')?.dataset.type
            }))
        })`).catch(() => null);
        throw Error("Timed out waiting for " + expression + ". State: " + JSON.stringify(state));
    };
    const click = async expression => {
        await evaluate(`(${expression})?.scrollIntoView({block:"nearest",inline:"nearest"});void 0`);
        await delay(150);
        try { await nativeClick(expression); }
        catch (error) {
            const diagnostics = await evaluate(`(()=>{
                const element=(${expression}),box=element?.getBoundingClientRect();
                const ancestors=[];
                for(let node=element;node&&ancestors.length<7;node=node.parentElement){const css=getComputedStyle(node);ancestors.push([node.className,node.clientWidth,node.clientHeight,css.display,css.gridTemplateRows,css.position]);}
                return {box:box?.toJSON(),ancestors,leaf:app.workspace.getActiveFile()?.path};
            })()`);
            throw Error(error.message + " " + JSON.stringify(diagnostics));
        }
    };
    await call("DOM.enable");
    await call("CSS.enable");
    await call("Emulation.setEmulatedMedia", { features: [{ name: "prefers-reduced-motion", value: "reduce" }] });
    async function verifyIconAction(expression, name, label, { square = true, emphasis } = {}) {
        await waitFor(`!!(${expression})`);
        await evaluate(`(${expression}).setAttribute('data-test-icon-action','');void 0`);
        const { root } = await call("DOM.getDocument");
        const { nodeId } = await call("DOM.querySelector", { nodeId: root.nodeId, selector: "[data-test-icon-action]" });
        const state = () => evaluate(`(()=>{const e=document.querySelector('[data-test-icon-action]'), css=getComputedStyle(e), fill=getComputedStyle(e,'::before');
            return { color:css.color, muted:css.getPropertyValue('--text-muted'), normal:css.getPropertyValue('--text-normal'),
                outline:css.outlineWidth, surfaceOutline:fill.outlineWidth, fill:fill.backgroundColor, width:fill.width, height:fill.height,
                panel: e.closest('.hub-dashboard-panel')?.getBoundingClientRect().toJSON(),
                corner: e.classList.contains('hub-expansion-toggle'),
                rect:e.getBoundingClientRect().toJSON(), icon:[...e.querySelectorAll('svg')].find(svg=>svg.getClientRects().length)?.getAttribute('class') };
        })()`);
        const force = async forcedPseudoClasses => {
            await call("CSS.forcePseudoState", { nodeId, forcedPseudoClasses });
            return state();
        };
        try {
            const idle = await force([]);
            const idleIcons = idle.icon?.split(" ") ?? [];
            assert(idleIcons.includes("lucide-" + name) || name === "circle-dashed-check" && idleIcons.includes(name),
                label + " uses " + name + ": " + idle.icon);
            assert.equal(idle.fill, "rgba(0, 0, 0, 0)", label + " rests on a clear surface");
            const hover = await force(["hover"]);
            assert.notEqual(hover.fill, idle.fill, label + " gets a hover surface");
            assert.notEqual(hover.color, idle.color, label + " brightens " + JSON.stringify({ idle, hover }));
            assert.deepEqual(hover.rect, idle.rect, label + " keeps its hit area");
            if (square) assert.equal(hover.width, hover.height, label + " surface is square");
            if (emphasis) assert(hover.icon?.split(" ").includes("lucide-" + emphasis), label + " changes to " + emphasis);
            const focus = await force(["focus", "focus-visible"]);
            assert.equal(focus.fill, hover.fill, label + " gives keyboard focus equivalent emphasis");
            assert.equal(focus.corner ? focus.surfaceOutline : focus.outline, "2px", label + " draws a two-pixel focus ring");
            if (focus.corner) {
                assert.equal(hover.width, "20px", label + " has a restrained hover surface");
                assert.deepEqual([hover.rect.width, hover.rect.height], [38, 23], label + " keeps the full hit area");
                assert.equal(hover.rect.top + (hover.rect.height - 20) / 2 - hover.panel.top, 13, label + " hover surface top inset");
                assert(hover.panel.right - (hover.rect.right - hover.rect.width / 2) > 15, label + " hit area is centered inside the trailing slot");
            }
        } finally {
            await call("CSS.forcePseudoState", { nodeId, forcedPseudoClasses: [] }).catch(() => {});
            await evaluate("document.querySelector('[data-test-icon-action]')?.removeAttribute('data-test-icon-action');void 0");
        }
    }
    const saved = await evaluate(`(async()=>{
        const p=__explorerProbe, service=p.plugin.globalPlan;
        const seed=await p.startPlanFixture();
        await service.add([service.references.workspaceEntry(seed.workspace)]);
        const historical=service.active().id;
        await service.finishPlan(historical);
        const active=await service.createPlan(service.readPlan(historical).navigation);
        const next=new Date(service.now()); next.setDate(next.getDate()+1);
        const tomorrow=[next.getFullYear(),String(next.getMonth()+1).padStart(2,'0'),String(next.getDate()).padStart(2,'0')].join('-');
        const scheduled=await service.schedulePlan(tomorrow+'T10:00');
        service.setNote('Tomorrow at ten',scheduled);
        await service.flush();
        p.cleanup();
        return {historical,active,scheduled,tomorrow};
    })()`);
    // This profile contains only the bundled plugin, Dataview and synthetic notes.
    const trust = "[...document.querySelectorAll('.modal button')].find(b=>/^(Trust(?: the)? author|Confiar en el autor)/i.test(b.textContent.trim()))";
    await evaluate(`(${trust})?.click();void 0`);
    await waitFor("!!app.plugins.plugins.dataview");
    await evaluate(`(async()=>{
        app.workspace.leftSplit.collapse();
        app.workspace.rightSplit.collapse();
        app.plugins.plugins['google-calendar-agenda'] = { async runQuery({ from }) {
            return { events: Array.from({ length: 35 }, (_, i) => ({
                title: 'Calendar fixture event', start: from.clone().add(Math.floor(i / 5), 'days').add(i % 5 + 8, 'hours')
            })) };
        } };
        const home=app.vault.getAbstractFileByPath('Home.md');
        await app.vault.modify(home,${JSON.stringify([
            "---", "cssclasses: [dashboard]", "---", "```dataviewjs",
            'await dv.view("System/Dashboards/Home")', "```", ""
        ].join("\n"))});
        await app.workspace.getLeaf(false).openFile(home,{state:{mode:'preview'}});
        await app.plugins.plugins['hub-project-menu'].workspaceModes.openHome();
        await app.workspace.saveLayout();
    })()`);
    const hub = "app.plugins.plugins['hub-project-menu']";
    const home = "[...document.querySelectorAll('.home-glance:not(.hub-expansion-slot)')].find(panel=>panel.checkVisibility()&&panel.getBoundingClientRect().width>0)";
    const homeClick = expression => evaluate(`(${expression}).click();void 0`);
    const planner = label => `[...document.querySelectorAll('.hub-planner-window button')].find(b=>b.textContent===${JSON.stringify(label)}&&!b.hidden)`;
    const panelButton = label => `[...${home}.querySelectorAll('.hub-plan-browser-modes button')].find(b=>b.textContent===${JSON.stringify(label)})`;
    const selected = "document.querySelector('.hub-planner-card.is-selected')";
    const timePopover = "document.querySelector('.hub-planner-start-popover')";
    const set = (selector, value) => evaluate(`(() => {
        const field=(${selector});field.value=${JSON.stringify(value)};field.dispatchEvent(new Event('input',{bubbles:true}));return true;
    })()`);
    const homeReady = `!!${home}?.querySelector('.hub-plan-note-pencil')&&!!${home}?.querySelector('.hub-expansion-trigger')`;
    await waitFor(`!!${home}?.querySelector('.hub-plan-note-pencil')`);
    if (!await evaluate(homeReady)) {
        await evaluate(`(async()=>{
            const leaf=app.workspace.activeLeaf;
            if(leaf.view.previewMode?.rerender)leaf.view.previewMode.rerender(true);
            else await leaf.openFile(app.vault.getAbstractFileByPath('Home.md'),{state:{mode:'preview'}});
        })()`);
    }
    await waitFor(homeReady);
    const separators = async (open, selector, footer) => {
        await evaluate(`${open};void 0`);
        await waitFor(`!!document.querySelector(${JSON.stringify(selector + ' .hub-modal-separator.is-header')})`);
        assert(await evaluate(`(() => {
            const modal = document.querySelector(${JSON.stringify(selector)});
            const frame = modal.querySelector('.modal-content').getBoundingClientRect();
            const lines = [...modal.querySelectorAll('.hub-modal-separator')];
            return lines.length === ${footer ? 2 : 1} && lines.every(line => {
                const rect = line.getBoundingClientRect();
                return Math.abs(rect.left-frame.left)<.1 && Math.abs(rect.right-frame.right)<.1 && rect.height===1;
            });
        })()`), selector + ' renders full-width window dividers');
        await key("Escape", "Escape", 27);
        await waitFor(`!document.querySelector(${JSON.stringify(selector)})`);
    };
    const compactGeometry = await evaluate(`(()=>{
        const grid=${home}.closest('.home-main-grid'), gallery=grid.querySelector('.home-projects');
        const nodes=[gallery,...gallery.querySelectorAll('.home-project-tabs,.home-workspaces-body,.home-project-grid,.home-resource-section,.home-resource-grid')];
        return {insets:[...grid.querySelectorAll('.hub-expansion-trigger')].map(button=>{
            const panel=button.closest('.home-panel'), p=panel.getBoundingClientRect();
            const heading=button.parentElement.querySelector('.hub-panel-heading-slot').getBoundingClientRect();
            const slot=button.querySelector('.hub-expansion-visual-slot').getBoundingClientRect();
            const line=parseFloat(getComputedStyle(button.parentElement.querySelector('.hub-panel-heading-label')).lineHeight);
            return [heading.left-p.left,p.right-slot.right,heading.width,heading.height,slot.width,slot.height,line,(heading.top+heading.bottom-slot.top-slot.bottom)/2];
        }),gallery:nodes.map(node=>[node.className,node.clientHeight,node.scrollHeight]),
            bodyStarts:[['.home-calendar','.home-calendar-scroll'],['.home-glance','.hub-plan-home'],
                ['.home-upcoming','.home-tasks-body'],['.home-projects','.home-workspaces-body'],
                ['.home-recent','.home-progress-section']].map(([panel,body])=>{
                    const p=grid.querySelector(panel);
                    return p.querySelector(body).getBoundingClientRect().top-p.getBoundingClientRect().top;
                }),
            heatmapPadding:getComputedStyle(grid.querySelector('.home-progress-calendar')).paddingTop,
            bodyInsets:[[".home-calendar",".home-calendar-scroll"],[".home-glance",".hub-plan-home"],[".home-upcoming",".home-tasks-body"],[".home-recent",".hub-progress-history-grid"]].map(([panel,body])=>{
                const node=grid.querySelector(panel), p=node.getBoundingClientRect(), b=node.querySelector(body).getBoundingClientRect();
                return [b.left-p.left,p.right-b.right,p.bottom-b.bottom];
            })};
    })()`);
    assert(compactGeometry.insets.every(([left, right, headingWidth, headingHeight, toggleWidth, toggleHeight, line, centerDelta]) =>
        [left, right].every(inset => Math.abs(inset - 15) < .1) &&
        [headingWidth, headingHeight, toggleWidth, toggleHeight].every(size => Math.abs(size - line) < .1) &&
        Math.abs(centerDelta) <= .6),
        "Installed Home header uses the panel inset and shared centerline " + JSON.stringify(compactGeometry.insets));
    assert(compactGeometry.bodyInsets.every(insets => insets.every(inset => Math.abs(inset - 15) < .1)),
        "Installed Home scroll viewports use the shared bottom and side insets " + JSON.stringify(compactGeometry.bodyInsets));
    assert(compactGeometry.gallery.every(([, client, scroll]) => scroll <= client + 1),
        "Installed compact Projects and Resources fit without vertical overflow " + JSON.stringify(compactGeometry.gallery));
    assert(compactGeometry.bodyStarts.every(top => Math.abs(top - 48) < .1),
        "All installed Home bodies start at 48px " + JSON.stringify(compactGeometry.bodyStarts));
    assert.equal(compactGeometry.heatmapPadding, "0px", "The Home heatmap fallback starts at the body boundary");
    const widthGroups = await evaluate(`(()=>{
        const grid=${home}.closest('.home-main-grid');
        return ['.home-nav button','.home-calendar-today,.home-focus-edit,.hub-task-add',
            '.home-project-status-tab,.home-project-tab-buttons .hub-panel-add,.home-progress-header-controls .hub-panel-add',
            '.hub-progress-history-selectors button'].map(select =>
            [...grid.closest(".home-dashboard").querySelectorAll(select)].map(button => button.getBoundingClientRect().width));
    })()`);
    assert.deepEqual(widthGroups.map(group => group.length), [4, 3, 5, 5]);
    assert(widthGroups.every(group => Math.max(...group) - Math.min(...group) < .1),
        "Installed dashboard button groups have equal widths " + JSON.stringify(widthGroups));
    const gallery = `${home}.closest('.home-main-grid').querySelector('.home-projects')`;
    const projectSize = () => evaluate(`(()=>{
        const panel=${gallery},card=panel.querySelector('.home-project-card'),rail=panel.querySelector('.home-project-grid');
        const resources=panel.querySelector('.home-resource-section'), p=panel.getBoundingClientRect(), c=card.getBoundingClientRect();
        const separator=resources.getBoundingClientRect();
        const resourceCard=panel.querySelector('.home-resource-card').getBoundingClientRect();
        return [p.height,c.width,c.height,p.bottom-separator.bottom,rail.clientHeight,rail.scrollHeight,
            separator.top-rail.getBoundingClientRect().bottom+3,resourceCard.height];
    })()`);
    const openGallery = await projectSize();
    await homeClick(`${gallery}.querySelector('.home-resource-toggle')`);
    const collapsedGallery = await projectSize();
    await homeClick(`${gallery}.querySelector('.home-resource-toggle')`);
    assert.equal(openGallery[2], 138, "Installed compact Projects use 138px in one row");
    assert(openGallery[6] >= 14, "Installed compact Projects leave separator clearance");
    assert.equal(collapsedGallery[2], 138, "Installed compact Projects use 138px in two rows");
    for (const [height, width,, inset, client, scroll, gap] of [openGallery, collapsedGallery]) {
        assert(Math.abs(height - 404) < 1, "Installed compact gallery retains its panel height");
        assert(Math.abs(width-openGallery[1]) < .25, "Installed compact cards retain their width");
        assert(Math.abs(inset-15) < .1 && scroll <= client + 1, "Resources stay at the bottom and the cards fit vertically");
        assert(gap >= 14, "Installed Resources separator leaves clearance " + gap);
    }
    console.log("Installed compact separator gaps (open / collapsed):", openGallery[6], collapsedGallery[6]);
    await evaluate(`${gallery}.querySelector('.home-resource-grid').scrollIntoView({block:'center',behavior:'instant'});void 0`);
    await delay(150);
    const { data: galleryImage } = await call("Page.captureScreenshot", { format: "png" });
    fs.writeFileSync(path.join(scratch, "compact-projects.png"), Buffer.from(galleryImage, "base64"));
    await evaluate(`(${trust})?.click();void 0`);
    await waitFor(`!(${trust})`);
    await waitFor(`${hub}.globalPlan.active()?.id===${JSON.stringify(saved.active)}&&!!${home}?.querySelector('.hub-plan-note-pencil')`);
    const compactHeader = await evaluate(`(()=>{const bar=${home}.querySelector('.home-panel-title'), note=${home}.querySelector('.hub-plan-note-rectangle');
        const planner=bar.querySelector('.home-focus-edit'), expand=bar.querySelector('.hub-expansion-trigger');
        const title=bar.querySelector('.hub-panel-heading-label');
        return {planner:planner.getBoundingClientRect().toJSON(), expand:expand.getBoundingClientRect().toJSON(), title:title.getBoundingClientRect().toJSON(), pencil:note.contains(note.querySelector('.hub-plan-note-pencil'))};
    })()`);
    assert(compactHeader.planner.right <= compactHeader.expand.left && compactHeader.planner.left >= compactHeader.title.right && compactHeader.pencil,
        "Compact header groups Planner before Expand and embeds the pencil " + JSON.stringify(compactHeader));
    await verifyIconAction(`${home}.querySelector('.hub-expansion-trigger')`, "expand", "Home expand");
    await verifyIconAction(`${home}.querySelector('.hub-plan-note-pencil')`, "pencil", "Compact Plan edit");
    await evaluate(`window.__compactPlanPencil=${home}.querySelector('.hub-plan-note-pencil');window.__compactPlanPencil.focus();void 0`);
    await key("Enter", "Enter", 13);
    await waitFor(`!!${selected}`);
    assert.equal(await evaluate(selected+".dataset.record"), saved.active, "Compact pencil opens its active Plan");
    assert(await evaluate(`(()=>{const header=document.querySelector('.hub-planner-window .hub-capture-header'), svg=header.querySelector('.hub-window-title-icon svg');
        const icon=svg.getBoundingClientRect(), box=header.getBoundingClientRect();
        return header.textContent.includes('Plan and schedule your work.')&&icon.height>=32&&icon.top>=box.top&&icon.bottom<=box.bottom;
    })()`), "The installed Planner shows the title, subtitle and full icon");
    await homeClick("document.querySelector('.hub-planner-create')");
    await waitFor(`${selected}?.querySelector('.hub-plan-set-start:not([hidden])')`);
    await click(selected+".querySelector('.hub-plan-set-start')");
    await waitFor(`!!${timePopover}`);
    assert.equal(await evaluate(timePopover+".querySelector('input[type=time]').value"), "", "A Draft starts without a time");
    await key("Escape", "Escape", 27);
    assert(await evaluate(`!${timePopover}&&!!${hub}.planModal?.isOpen&&document.activeElement===document.querySelector('.hub-planner-card.is-selected .hub-plan-set-start')`),
        "Escape closes only creation and restores focus");
    await key("Escape", "Escape", 27);
    await waitFor(`!${hub}.planModal`);
    await separators(`${hub}.oathControl.open()`, ".hub-oath-dialog", true);
    await separators(`${hub}.settingsControl.open()`, ".hub-settings-dialog", false);
    // Dataview can remount Home during the draft and confirmation interactions.
    if (await evaluate("window.__compactPlanPencil.isConnected&&window.__compactPlanPencil.checkVisibility()")) {
        assert(await evaluate("document.activeElement===window.__compactPlanPencil"), "Native Escape returns focus to a mounted compact trigger");
    }
    await waitFor(`!!${home}?.querySelector('.hub-expansion-trigger')`);
    const corner = (name) => `(()=>{const panel=${home},p=panel.getBoundingClientRect(),button=panel.querySelector('.hub-expansion-${name}'),
        b=button.getBoundingClientRect(),glyph=button.querySelector('svg').getBoundingClientRect();
        return [b.width,b.height,glyph.top-p.top,p.right-glyph.right].map(x=>Math.round(x*100)/100);})()`;
    const expandCorner = await evaluate(corner("trigger"));
    await homeClick(`${home}.querySelector('.hub-expansion-trigger')`);
    await waitFor(`!!${home}?.querySelector('.hub-expanded-header .hub-expansion-tabs')`);
    await delay(350);
    assert(await evaluate(`!!${home}.querySelector('.hub-expanded-header .hub-expansion-tabs')&&!${home}.querySelector('.hub-plans textarea')`), "Expanded Home preserves navigation strip and shows browsing controls");
    const headerLayout = `(()=>{const h=${home}.querySelector('.hub-expanded-header'), nav=h.querySelector('.hub-expansion-navigation'), modes=h.querySelector('.hub-plan-browser-modes'), planner=h.querySelector('.home-focus-edit'), collapse=h.querySelector('.hub-expansion-collapse');
        const middle=r=>(r.left+r.right)/2;
        return h.querySelectorAll('.home-focus-edit').length===1&&planner.getBoundingClientRect().right<collapse.getBoundingClientRect().left&&nav.getBoundingClientRect().right<=modes.getBoundingClientRect().left&&Math.abs(middle(h.getBoundingClientRect())-middle(modes.getBoundingClientRect()))<2;
    })()`;
    assert(await evaluate(headerLayout), "Expanded Plan centers its modes and puts one Planner next to Collapse");
    assert.deepEqual(await evaluate(corner("collapse")), expandCorner, "Expand and Minimize share the same hit area and panel-relative inset");
    await verifyIconAction(`${home}.querySelector('.hub-expansion-tab[aria-label="Calendar"]')`, "calendar-days", "Expanded inactive Calendar tab");
    assert(await evaluate(`!!${home}.querySelector('.hub-plans-center .hub-plan-finish')`), "Selected active Plan can finish in expanded Plans mode");
    await verifyIconAction(`${home}.querySelector('.hub-expansion-collapse')`, "minimize", "Home minimize");
    const homeTab = title => `document.querySelector('.home-dashboard .hub-expansion-tab[aria-label=${JSON.stringify(title)}]')`;
    const expandedHeaderHeight = "document.querySelector('.home-dashboard .hub-expanded-header').getBoundingClientRect().height";
    const checkExpandedBody = async selector => {
        const insets = await evaluate(`(()=>{
            const panel=document.querySelector('.home-dashboard .hub-panel-expanded');
            const p=panel.getBoundingClientRect(), b=panel.querySelector(${JSON.stringify(selector)}).getBoundingClientRect();
            const band=panel.querySelector('.hub-expansion-header-band').getBoundingClientRect();
            return {body:[b.left-p.left,p.right-b.right,p.bottom-b.bottom],start:band.bottom-p.top};
        })()`);
        assert(insets.body.every(inset => Math.abs(inset - 15) < .1),
            "Installed expanded body uses the shared bottom and side insets " + selector + " " + JSON.stringify(insets));
        assert(Math.abs(insets.start-48) < .1, "Installed expanded Home header ends at 48px " + selector);
    };
    await checkExpandedBody(".hub-plans");
    const planHeaderHeight = await evaluate(expandedHeaderHeight);
    for (const [title, body] of [["Tasks", ".hub-expanded-task-view"], ["Projects", ".home-workspaces-body"],
        ["Progress", ".hub-progress-history-grid"], ["Calendar", ".hub-dashboard-calendar"]]) {
        await homeClick(homeTab(title));
        assert.equal(await evaluate(expandedHeaderHeight), planHeaderHeight, title + " keeps the installed Home header height");
        await checkExpandedBody(body);
        if (title === "Projects") {
            const [projectHeight, resourceHeight, bottom] = await evaluate(`(()=>{
                const panel=document.querySelector('.home-projects.hub-panel-expanded');
                const rect=selector=>panel.querySelector(selector).getBoundingClientRect();
                return [rect('.home-project-card').height,rect('.home-resource-card').height,
                    panel.getBoundingClientRect().bottom-rect('.home-resource-section').bottom];
            })()`);
            assert.deepEqual([projectHeight, resourceHeight, bottom], [138, openGallery[7], 15], "Expanded cards match compact heights and preserve the bottom inset");
            const { data } = await call("Page.captureScreenshot", { format: "png" });
            fs.writeFileSync(path.join(scratch, "expanded-projects.png"), Buffer.from(data, "base64"));
        }
    }
    const calendar = "document.querySelector('.home-dashboard .home-calendar.hub-panel-expanded')";
    const calendarMode = name => calendar + '.querySelector(\'[data-schedule-control="view-' + name + '"]\')';
    for (const mode of ["week", "month", "upcoming"]) {
        await homeClick(calendarMode(mode));
        await waitFor(calendarMode(mode) + '.getAttribute("aria-pressed")==="true"');
    }
    assert.equal(await evaluate(expandedHeaderHeight), planHeaderHeight, "Calendar views stay below the fixed header");
    await homeClick(homeTab("Plan"));
    await verifyIconAction(`${home}.querySelector('.hub-plans-center .hub-plan-finish')`, "circle-dashed-check", "Expanded Finish Plan",
        { square: false, emphasis: "circle-check" });
    assert.deepEqual(await evaluate(`[...${home}.querySelectorAll('.hub-plans-record')].map(b=>b.dataset.record)`), [saved.historical, saved.scheduled]);
    const layout = await evaluate(`(()=>{const p=${home};return [p.parentElement,p,...p.querySelectorAll('.hub-plans-scroll,.hub-plans-pane,.hub-plans-columns,.hub-plans')].map(e=>{const s=getComputedStyle(e);return [e.className,e.clientWidth,e.clientHeight,s.position,s.height,s.gridTemplateRows,s.getPropertyValue('--hub-expanded-height')]})})()`);
    fs.writeFileSync(path.join(scratch, "expanded-plan.png"), (await wc.capturePage()).toPNG());
    assert(layout.filter(([name])=>name.includes("hub-plans-scroll")).every(([, , height])=>height>80), JSON.stringify(layout));
    await homeClick(`${home}.querySelector('.hub-plans-record')`);
    assert.equal(await evaluate(`${home}.querySelector('.hub-plans-center article').dataset.record`), saved.historical);
    assert(await evaluate(`${home}.querySelector('.hub-plans-center button.hub-plan-title:not(:disabled)')!==null&&!${home}.querySelector('.hub-plans-center input[type=checkbox]:not(:disabled)')`), "Historical file or workspace opens through a live binding and tasks are frozen");
    await homeClick(`${home}.querySelector('.home-focus-edit')`);
    assert.equal(await evaluate(selected+".dataset.record"), saved.historical, "Expanded Plans passes the selected record");
    await key("Escape", "Escape", 27);
    await homeClick(panelButton("Days"));
    assert(await evaluate(headerLayout), "Days keeps the same expanded header");
    await homeClick(`[...${home}.querySelectorAll('.hub-plans-side-day')].at(-1).querySelector('.hub-plan-note-text')`);
    assert.equal(await evaluate(`${home}.querySelector('.hub-plans-center article').dataset.record`), saved.scheduled);
    const sideTask = `${home}.querySelector('.hub-plans-side-day input[type=checkbox]')`;
    assert(await evaluate(`(!(${sideTask})||(${sideTask}).disabled)&&!${home}.querySelector('.hub-plans-side-day button.hub-plan-title')&&!${home}.querySelector('.hub-plans-side-day .hub-plan-finish')`), "Muted days contain readable items without independent actions");
    assert(await evaluate(`Number(getComputedStyle(${home}.querySelector('.hub-plans-side-day')).opacity)<1`), "Side days are muted at rest");
    await evaluate(`${home}.querySelector('.hub-plans-day-heading').focus();void 0`);
    assert(await evaluate(`getComputedStyle(${home}.querySelector('.hub-plans-side-day')).opacity==='1'`), "Keyboard focus brightens the entire side day");
    await key("Enter", "Enter", 13);
    const centerTask = `${home}.querySelector('.hub-plans-center input[type=checkbox]:not(:disabled)')`;
    await waitFor(`!!(${centerTask})`);
    await homeClick(centerTask);
    await waitFor(`!!(${centerTask})?.checked`);
    assert(await evaluate(`!!${home}.querySelector('.hub-plans-center .hub-plan-finish')`), "Centered day's active card supports completion and Finish Plan without a redundant timestamp");
    await homeClick(`[...${home}.querySelectorAll('.hub-plans-side-day')].at(-1)`);
    await homeClick(`${home}.querySelector('.home-focus-edit')`);
    assert.equal(await evaluate(selected+".dataset.record"), saved.scheduled);
    await key("Escape", "Escape", 27);
    await waitFor(`!${hub}.planModal`);
    await homeClick(`${home}.querySelector('.hub-plans-center button[aria-label^="Create Plan for"]')`);
    await waitFor(`${selected}?.querySelector('.hub-plan-set-start:not([hidden])')`);
    await click(selected+".querySelector('.hub-plan-set-start')");
    await waitFor(`!!${timePopover}`);
    assert(await evaluate(`!!${timePopover}.querySelector('input[type=date]').value`), "Future Days plus supplies the date");
    await set(timePopover+".querySelector('input[type=time]')", "08:00");
    await homeClick(timePopover+".querySelector('button[type=submit]')");
    await waitFor(`${selected}?.querySelector('.hub-plan-set-start')?.textContent==='08:00'`);
    await set(selected+".querySelector('textarea')", "Recovered in Obsidian");
    const draft = await evaluate(selected+".dataset.record");
    await click(planner("Add to Plan"));
    await waitFor(`!!${hub}.planPicker?.isOpen`);
    await key("Escape", "Escape", 27);
    assert(await evaluate(`!${hub}.planPicker&&${hub}.planModal?.isOpen`), "Native Escape closes nested picker only");
    await click(planner("Full day"));
    assert.equal(await evaluate("document.querySelectorAll('.hub-planner-card-body:not([hidden])').length"), 2);
    const footerLayout = `(()=>{const m=${hub}.planModal.modalEl.getBoundingClientRect(), footer=document.querySelector('.hub-planner-controls'), r=footer.getBoundingClientRect(), date=footer.querySelector('.hub-plans-day-navigation').getBoundingClientRect();
        return Math.abs((m.left+m.right-date.left-date.right)/2)<1&&[...footer.querySelectorAll('input,button')].every(e=>e.getBoundingClientRect().left>=r.left-1&&e.getBoundingClientRect().right<=r.right+1);
    })()`;
    assert(await evaluate(footerLayout), "Installed Planner centers its footer date picker");
    await wc.setZoomFactor(1.25);
    await delay(150);
    assert(await evaluate(`(()=>{const m=${hub}.planModal.modalEl.getBoundingClientRect();return m.left>=0&&m.right<=innerWidth&&m.bottom<=innerHeight})()`), "Zoomed window remains bounded");
    await call("Emulation.setDeviceMetricsOverride", { width: 390, height: 640, deviceScaleFactor: 1, mobile: false });
    assert(await evaluate(footerLayout), "Installed Planner keeps the narrow footer centered and usable");
    await homeClick(planner("New Plan"));
    await waitFor(`${selected}?.querySelector('.hub-plan-set-start:not([hidden])')`);
    await click(selected+".querySelector('.hub-plan-set-start')");
    await waitFor(`!!${timePopover}`);
    assert(await evaluate(`(()=>{const box=${timePopover}.getBoundingClientRect();return box.left>=0&&box.right<=innerWidth&&box.top>=0&&box.bottom<=innerHeight})()`), "Time popover fits the installed app at a narrow width");
    await key("Escape", "Escape", 27);
    await call("Emulation.clearDeviceMetricsOverride");
    fs.writeFileSync(path.join(scratch, "planner.png"), (await wc.capturePage()).toPNG());
    await key("Escape", "Escape", 27);
    await evaluate(`(async()=>{const p=${hub};app.plugins.disablePlugin('hub-project-menu');await p.nativeTaskStopping})()`);
    await evaluate("setTimeout(()=>window.location.reload(),0);void 0");
    await delay(500);
    await waitFor(`!!${hub}?.globalPlan?.readPlan(${JSON.stringify(draft)})`);
    await evaluate("window.hubPlan.openPlanner();void 0");
    assert.equal(await evaluate(selected+".querySelector('textarea').value"), "Recovered in Obsidian");
    assert.equal(await evaluate(selected+".querySelector('.hub-plan-set-start').textContent"), "08:00", "Specific start time survives the installed app reload");
    assert(await evaluate(`${planner("Full day")}.getAttribute('aria-pressed')==='true'`), "Ordinary reopen restores mode and draft after a renderer reload");
    await waitFor(`${hub}.globalPlan.readPlan(${JSON.stringify(draft)})?.status==='scheduled'`);
    assert.equal(await evaluate(`${hub}.globalPlan.readPlan(${JSON.stringify(draft)}).content.note`), "Recovered in Obsidian");
    await evaluate(`(async()=>{
        const p=${hub}, service=p.globalPlan, original=service.now;
        service.now=()=>new Date(service.readPlan(${JSON.stringify(draft)}).scheduledAt);
        try { await service.ensureLifecycle(); } finally { service.now=original; }
    })()`);
    assert.equal(await evaluate(`${hub}.globalPlan.active().id`), draft, "Real service automatically activates the published Plan");
    const moved = await evaluate(`(async()=>{
        const p=${hub}, service=p.globalPlan, id=${JSON.stringify(saved.historical)};
        const frozen=JSON.stringify(service.readPlan(id).snapshot);
        const file=service.readPlan(id).navigation.find(entry=>entry.kind==='file').reference.path;
        const path=file.replace(/One[.]md$/,'Renamed historical file.md');
        await p.fileOperations.rename(file,path);
        await service.references.audit();
        if (JSON.stringify(service.readPlan(id).snapshot)!==frozen) throw Error('History changed after file rename');
        window.hubPlan.openPlanner({planId:id});
        return path;
    })()`);
    const openFile = `[...document.querySelectorAll(".hub-planner-card.is-selected .hub-plan-title")].find(item=>item.textContent==='One.md'&&!item.disabled)`;
    await waitFor(`!!(${openFile})`);
    await homeClick(openFile);
    await waitFor(`app.workspace.getActiveFile()?.path===${JSON.stringify(moved)}`);
    await evaluate("app.plugins.plugins['hub-project-menu'].planModal?.close();void 0");
    await waitFor("!app.plugins.plugins['hub-project-menu'].planModal");
    await evaluate("window.hubOpenResourceFull('study', document.body)");
    const resourceDashboard = "document.querySelector('.workspace-leaf.mod-active .resource-dashboard')";
    const resourceSchedule = resourceDashboard + "?.querySelector('[data-workspace-mode=schedule]')";
    await waitFor("!!(" + resourceSchedule + ")");
    await homeClick(resourceSchedule);
    await waitFor(resourceDashboard + "?.querySelector('[data-schedule-control=view-upcoming]')?.getAttribute('aria-pressed')==='true'");
    await homeClick(resourceDashboard + ".querySelector('[data-schedule-control=view-week]')");
    await waitFor(resourceDashboard + "?.querySelectorAll('.hub-task-calendar-day').length===7");
    await evaluate(`(async()=>{const p=${hub};app.plugins.disablePlugin('hub-project-menu');await p.nativeTaskStopping})()`);
};
