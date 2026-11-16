"use strict";
const { setHubIcon } = require("./icons");

function appendRouteSeparator(host, className = "") {
    const separator = host.ownerDocument.createElement("span");
    separator.className = "hub-route-separator" + (className ? " " + className : "");
    separator.setAttribute("aria-hidden", "true");
    host.append(separator);
    setHubIcon(separator, "chevron-right");
    return separator;
}

// Inline content lets the host retain its existing ellipsis or wrapping rules.
// Accessible separator text also preserves readable plain-text route labels.
function renderRouteBreadcrumb(host, segments, separatorText = " / ") {
    host.replaceChildren();
    host.classList.add("hub-route");
    segments.forEach((label, index) => {
        const part = host.ownerDocument.createElement("span");
        part.className = "hub-route-part";
        if (index) {
            const accessible = host.ownerDocument.createElement("span");
            accessible.className = "hub-route-accessible-separator";
            accessible.textContent = separatorText;
            part.append(accessible);
            appendRouteSeparator(part);
        }
        const text = host.ownerDocument.createElement("span");
        text.className = "hub-route-label";
        text.textContent = label;
        part.append(text);
        host.append(part);
    });
    return host;
}

module.exports = { appendRouteSeparator, renderRouteBreadcrumb };
