"use strict";
const status = document.getElementById("status"), apps = document.getElementById("apps");
async function request(action, index, button) {
    if (button) button.disabled = true;
    try { await window.oathDock.request(action, index); }
    catch (error) { status.textContent = error.message || "Action unavailable. Return to Itacan."; }
    finally { if (button) button.disabled = false; }
}
document.getElementById("focus").onclick = event => request("focus", undefined, event.currentTarget);
window.oathDock.subscribe(model => {
    const payload = model.colors, names = ["background", "text", "button", "border", "focus"];
    if (payload?.version === 1 && Number.isSafeInteger(payload.revision) && payload.revision >= 0 &&
        payload.colors && Object.keys(payload.colors).length === names.length && names.every(key => /^#[0-9a-f]{6}$/i.test(payload.colors[key]))) {
        for (const key of names) document.documentElement.style.setProperty("--hub-dock-" + key, payload.colors[key]);
    } else for (const key of names) document.documentElement.style.removeProperty("--hub-dock-" + key);
    void window.oathDock.request("colors-ready", payload?.revision ?? 0).catch(() => {});
    if (!apps.childElementCount) model.applications.forEach((name, index) => {
        const button = document.createElement("button"); button.type = "button"; button.textContent = "Open " + name;
        button.title = "Open application; it may create another window. Use Alt+Tab for existing windows.";
        button.onclick = () => request("launch", index, button); apps.appendChild(button);
    });
    status.textContent = model.status;
});
void request("ready");
