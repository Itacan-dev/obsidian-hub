"use strict";
// Shared Settings/setup editor. Paths are always rendered as text.
function mountOathApplications(parent, service, values, save) {
    const root = parent.createDiv({ cls: "hub-oath-applications" });
    let current = [...values], disposed = false, busy = false;
    const list = root.createEl("ul", { attr: { "aria-label": "Permitted desktop applications" } });
    const controls = root.createDiv({ cls: "hub-oath-application-controls" });
    const input = controls.createEl("input", { type: "text", attr: { "aria-label": "Application executable path", placeholder: "C:\\…\\application.exe" } });
    const add = controls.createEl("button", { text: "Add path", attr: { type: "button" } });
    const browse = controls.createEl("button", { text: "Browse…", attr: { type: "button" } });
    const error = root.createDiv({ cls: "hub-task-error", attr: { role: "alert" } });
    const paint = () => {
        if (disposed) return;
        list.empty();
        if (!current.length) list.createEl("li", { text: "Itacan only. No external applications permitted." });
        for (const value of current) {
            const item = list.createEl("li").createDiv({ cls: "hub-oath-application-row" }); item.createSpan({ text: value });
            const remove = item.createEl("button", { text: "Remove", attr: { type: "button", "aria-label": "Remove " + value } });
            remove.disabled = busy; remove.addEventListener("click", () => void update(current.filter(entry => entry !== value)));
        }
        input.disabled = add.disabled = browse.disabled = busy;
    };
    const update = async values => {
        if (busy || disposed) return;
        busy = true; error.textContent = ""; paint();
        try { current = await save(values); if (!disposed) input.value = ""; }
        catch (problem) { if (!disposed) error.textContent = problem.message; }
        finally { busy = false; paint(); }
    };
    const addInput = () => void update([...current, input.value.trim()]);
    add.addEventListener("click", addInput);
    input.addEventListener("keydown", event => { if (event.key === "Enter") { event.preventDefault(); addInput(); } });
    browse.addEventListener("click", async () => {
        if (busy) return;
        busy = true; paint();
        let selected;
        try { selected = await service.pickStrictApplication(); }
        catch (problem) { if (!disposed) error.textContent = problem.message; }
        finally { busy = false; paint(); }
        if (selected && !disposed) void update([...current, selected]);
    });
    paint(); return () => { disposed = true; };
}
module.exports = { mountOathApplications };
