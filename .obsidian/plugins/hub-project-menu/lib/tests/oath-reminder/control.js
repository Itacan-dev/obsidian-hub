"use strict";
window.reminder.onModel(model => { document.getElementById("status").textContent = model.status; });
for (const action of ["start", "observe", "release"]) document.getElementById(action).onclick = async () => {
    try {
        await window.reminder.action(action, { paths: document.getElementById("paths").value.split(/\r?\n/).filter(Boolean), raising: document.getElementById("raising").checked });
        if (action !== "release") for (const id of ["start", "observe", "paths", "raising"]) document.getElementById(id).disabled = true;
    } catch (error) { document.getElementById("status").textContent = error.message; }
};
