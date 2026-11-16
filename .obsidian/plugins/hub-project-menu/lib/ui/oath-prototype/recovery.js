"use strict";
const status = document.getElementById("status");
window.prototypeRecovery.status(text => { status.textContent = text; });
document.getElementById("release").onclick = async () => {
    try { await window.prototypeRecovery.release(); }
    catch (error) { status.textContent = error.message; }
};
