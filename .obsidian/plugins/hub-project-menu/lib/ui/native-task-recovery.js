"use strict";
const { Modal } = require("obsidian");
const { createModalHeader, layoutModal } = require("./window-title");
function openNativeTaskRecovery(plugin) {
    const host = plugin.nativeTaskHost;
    if (!host) throw Error("Native tasks are not enabled.");
    class RecoveryModal extends Modal {
        onOpen() {
            this.contentEl.classList.add("hub-button-scope");
            createModalHeader(this.contentEl, { title: "Native task recovery", icon: "rotate-ccw" });
            this.body = this.contentEl.createDiv(); this.generation = 0;
            layoutModal(this, { container: this.body }); void this.refresh();
        }
        async refresh() {
            const ticket = ++this.generation; this.body.replaceChildren();
            this.body.createEl("p", { text: "Checking retained requests…" });
            try {
                const runtime = host.runtime(), requests = await runtime.retained();
                if (ticket !== this.generation) return;
                this.body.replaceChildren();
                if (!requests.length) this.body.createEl("p", { text: "No retained requests." });
                for (const request of requests) {
                    const id = request.operationId;
                    const row = this.body.createDiv(); row.createEl("p", { text: id });
                    const status = row.createEl("p", { text: "Not inspected" });
                    const inspect = row.createEl("button", { text: "Inspect" });
                    const reconcile = row.createEl("button", { text: "Reconcile" });
                    const replay = row.createEl("button", { text: "Review identical replay" }); replay.disabled = true;
                    let review = null, armed = false;
                    const show = result => { review = result; armed = false; status.textContent = result.classification + " · " + result.code; replay.disabled = !result.canReplay; replay.textContent = "Review identical replay"; };
                    const run = async action => {
                        inspect.disabled = reconcile.disabled = replay.disabled = true;
                        try { await action(); } catch (_) { status.textContent = "Recovery remains blocked. Inspect again or preserve this request for review."; review = null; }
                        finally { if (ticket === this.generation) { inspect.disabled = reconcile.disabled = false; replay.disabled = !review?.canReplay; } }
                    };
                    inspect.onclick = () => run(async () => { const result = await runtime.recovery.inspect(id); if (ticket === this.generation) show(result); });
                    reconcile.onclick = () => run(async () => { const result = await runtime.recovery.reconcile(id); if (ticket === this.generation) show(result.inspection); });
                    replay.onclick = () => {
                        if (!armed) { armed = true; replay.textContent = "Confirm exact original replay"; status.textContent = "Replay only this unchanged retained request, with its original identities and guards?"; return; }
                        const original = review; review = null;
                        void run(async () => { await runtime.recovery.replay(original); const result = await runtime.recovery.reconcile(id); if (ticket === this.generation) show(result.inspection); });
                    };
                }
            } catch (_) {
                if (ticket !== this.generation) return;
                this.body.replaceChildren(); this.body.createEl("p", { text: "Native authority unavailable. Retained evidence has not been changed.", attr: { role: "alert" } });
                this.body.createEl("button", { text: "Retry" }).onclick = () => void this.refresh();
            }
        }
        onClose() { this.generation++; this.contentEl.replaceChildren(); }
    }
    const modal = new RecoveryModal(plugin.app); modal.open(); return modal;
}
module.exports = { openNativeTaskRecovery };
