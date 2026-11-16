"use strict";
window.reminder.onModel(model => {
    document.getElementById("message").textContent = model.label ? model.label + " is outside this Oath's permitted applications." : "Return to your permitted work.";
});
document.getElementById("return").onclick = () => void window.reminder.action("return");
