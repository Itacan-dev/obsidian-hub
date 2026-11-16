"use strict";
const status = document.getElementById("status");
window.oathPreview.status(message => { status.textContent = message; });
for (const button of document.querySelectorAll("button")) button.onclick = async () => {
    button.disabled = true;
    try {
        const result = await window.oathPreview.action(button.dataset.action);
        if (button.dataset.action === "diagnostics") {
            const target = document.getElementById("diagnostics");
            target.replaceChildren();
            for (const warning of result.warnings) {
                const text = document.createElement("p"); text.textContent = warning; target.append(text);
            }
            const table = document.createElement("table");
            for (const values of [["Window / executable", "Process window", "Electron source", "Finding"],
                ...result.rows.map(row => [row.title + " ? " + row.executable + " (" + row.handle + ")", row.processWindow ? "Yes" : "No", row.windowSource ? "Yes" : "No", row.classification])]) {
                const tr = document.createElement("tr");
                for (const value of values) { const td = document.createElement("td"); td.textContent = value; tr.append(td); }
                table.append(tr);
            }
            target.append(table);
        }
    }
    catch (error) { status.textContent = error.message; }
    finally { button.disabled = false; }
};
