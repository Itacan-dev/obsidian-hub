"use strict";
const { row, section } = require("./settings-pages");
const { mountOathApplications } = require("./oath-applications");
function mountOathSettings(parent, service) {
    let disposed = false;
    parent.createEl("p", { text: "Strict Oath is an optional behavioral commitment. Desktop checks and focus restoration are best effort; Windows controls remain available.", cls: "hub-settings-description" });
    const control = row(section(parent, "Strict Oath"), "Enable Strict Oath on this device", "Off by default. Enables a choice in Oath setup; it does not start a commitment. Disabling affects future Oaths only.");
    const toggle = control.createEl("input", { type: "checkbox", attr: { "aria-label": "Enable Strict Oath on this device" } });
    toggle.checked = !!service.strictEnabled; toggle.disabled = !service.strictSupported;
    const error = parent.createDiv({ cls: "hub-task-error", attr: { role: "alert" } });
    const recovery = parent.createDiv({ attr: { role: "status" } });
    const paintRecovery = () => {
        recovery.empty();
        if (service.strictStatus?.status !== "recovery-required") return;
        recovery.createEl("p", { text: "Your Oath's window guards are released, but the original window state could not be fully restored." });
        const retry = recovery.createEl("button", { text: "Restore window", attr: { type: "button" } });
        retry.addEventListener("click", async () => {
            retry.disabled = true;
            try { await service.strict.retryRestoration(); error.textContent = ""; }
            catch (problem) { error.textContent = problem.message; }
            finally { retry.disabled = false; }
        });
    };
    const stopHealth = service.onChange?.(paintRecovery); paintRecovery();
    if (!service.strictSupported) parent.createEl("p", { text: "Strict Oath requires a supported Windows desktop host.", cls: "hub-settings-description" });
    toggle.addEventListener("change", async () => {
        toggle.disabled = true;
        try { await service.setStrictEnabled(toggle.checked); error.textContent = ""; }
        catch (problem) { error.textContent = problem.message; }
        finally { if (!disposed) { toggle.checked = !!service.strictEnabled; toggle.disabled = !service.strictSupported; } }
    });
    if (service.strict.developmentRecovery) {
        const development = section(parent, "Prototype development recovery");
        development.createEl("p", { text: "Ctrl+Alt+Shift+F12 releases Strict Oath while Itacan has focus. A separate recovery window opens before activation. Restrictions automatically release after two minutes and the Oath is recorded as interrupted.", cls: "hub-settings-description" });
        const verify = development.createEl("button", { text: "Verify development recovery", attr: { type: "button" } });
        verify.addEventListener("click", async () => {
            verify.disabled = true;
            try { await service.strict.developmentRecovery.verify(); error.textContent = "Development recovery verified."; }
            catch (problem) { error.textContent = problem.message; }
            finally { verify.disabled = false; }
        });
        const release = development.createEl("button", { text: "Release Strict Oath (development)", attr: { type: "button" } });
        release.addEventListener("click", async () => {
            release.disabled = true;
            try {
                await service.strict.developmentRecovery.release("settings");
                if (service.current?.state === "scheduled") await service.end(service.current.id, "cancel");
                else await service.refresh();
                error.textContent = "Development restrictions released.";
            } catch (problem) { error.textContent = problem.message; }
            finally { release.disabled = false; }
        });
    }
    const apps = section(parent, "Permitted desktop applications");
    if (!service.strictSupported) {
        apps.createEl("p", { text: "Application restrictions are unavailable on this device. Ordinary Oath remains available.", cls: "hub-settings-description" });
        return () => { disposed = true; stopHealth?.(); };
    }
    apps.createEl("p", { text: "Choose executable files for this device. Changes apply to future reviews. Each Oath can replace this default list; existing commitments keep their confirmed applications.", cls: "hub-settings-description" });
    const stop = mountOathApplications(apps, service, service.strictApplications, values => service.setStrictApplications(values));
    return () => { disposed = true; stop(); stopHealth?.(); };
}
module.exports = { mountOathSettings };
