"use strict";
const status = document.getElementById("status");
window.oathPreview.status(message => { status.textContent = message; });
for (const button of document.querySelectorAll("button")) button.onclick = async () => {
    button.disabled = true;
    try { await window.oathPreview.action(button.dataset.action); }
    catch (error) { status.textContent = error.message; }
    finally { button.disabled = false; }
};
