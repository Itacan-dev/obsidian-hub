"use strict";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const MONTH_NAMES = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

// Equal CSS lengths alone are insufficient: fractional device-pixel edges are
// rounded independently when painted. Both the square and the pitch must be
// integral in device pixels. Keep the DOM grid; convert to CSS units only once.
function heatmapGeometry(width, weeks, monthWidths, starts, compactWidths = monthWidths, scale = 1, minimumDayCell = 0) {
    const gap = 1 / scale;
    const minimumPixels = (widths, minimumCell) => Math.ceil(Math.max(minimumCell, minimumDayCell, ...widths.map((label, index) =>
        (label + 4 + gap) / ((starts[index + 1] ?? weeks) - starts[index]) - gap)) * scale - 1e-9);
    const widthFor = pixels => (weeks * pixels + weeks - 1) / scale;
    const fullMinimum = minimumPixels(monthWidths, 4);
    const compact = width < widthFor(fullMinimum);
    const minimumWidth = widthFor(compact ? minimumPixels(compactWidths, 2) : fullMinimum);
    const layoutWidth = Math.max(width, minimumWidth);
    const cellPixels = Math.floor((layoutWidth * scale - (weeks - 1)) / weeks + 1e-9);
    const cell = cellPixels / scale;
    const innerWidth = weeks * cell + (weeks - 1) * gap;
    return { cell, cellPixels, gap, scale, innerWidth, width: layoutWidth, margin: (layoutWidth - innerWidth) / 2, compact };
}

function heatmapPixelScale(calendar) {
    const view = calendar.ownerDocument.defaultView;
    // Obsidian's browser zoom and OS scaling are already in devicePixelRatio.
    // CSS zoom is separate and may be applied to any dashboard ancestor.
    let scale = view.devicePixelRatio || 1;
    for (let element = calendar; element; element = element.parentElement) {
        scale *= parseFloat(view.getComputedStyle(element).zoom) || 1;
    }
    return scale;
}

function fillOutsideYearCells(boxes) {
    // The native date order and leading weekday offset determine the columns.
    // Rebuild only trailing fillers so repeated refreshes remain idempotent.
    while (boxes.lastElementChild && !boxes.lastElementChild.matches("[class*='month-']")) {
        boxes.lastElementChild.remove();
    }
    const weeks = Math.ceil(boxes.children.length / 7);
    while (boxes.children.length < weeks * 7) boxes.append(boxes.ownerDocument.createElement("li"));
    for (const cell of boxes.children) {
        if (cell.matches("[class*='month-']")) continue;
        cell.classList.add("hub-progress-padding", "isEmpty");
        cell.style.removeProperty("background-color");
        cell.replaceChildren();
        cell.inert = true;
        cell.setAttribute("aria-hidden", "true");
    }
    return weeks;
}

// Keep the upstream renderer's dates, colors and week-start setting. Only this
// controller owns the resulting geometry, including after a year/scope change.
function createProgressHeatmap(calendar, component) {
    const view = calendar.ownerDocument.defaultView;
    let graph, boxes, months, weekdays, measure, weeks, starts;
    let availableWidth = 0;
    let disposed = false;
    const observer = new view.ResizeObserver(entries => {
        for (const entry of entries) {
            if (entry.target === calendar) availableWidth = entry.contentRect.width;
        }
        layout();
    });
    // This box also changes when CSS zoom changes without a CSS-width change.
    try { observer.observe(calendar, { box: "device-pixel-content-box" }); }
    catch { observer.observe(calendar); }
    // Moving between monitors or changing Obsidian zoom can change DPR without
    // changing the content-box width, so ResizeObserver alone is insufficient.
    let resolution;
    function watchScale() {
        resolution?.removeEventListener("change", watchScale);
        // Chrome can report 2.0000000596 while the media resolution is 2.
        // A narrow range matches the current scale on both sides of that float
        // conversion, then changes on either an increase or a decrease.
        const ratio = view.devicePixelRatio;
        const tolerance = ratio * 1e-6;
        resolution = view.matchMedia(`(min-resolution: ${ratio - tolerance}dppx) and (max-resolution: ${ratio + tolerance}dppx)`);
        resolution.addEventListener("change", watchScale);
        layout();
    }
    watchScale();
    view.addEventListener("resize", layout);

    function layout() {
        if (disposed || !graph?.isConnected || !measure || !availableWidth) return;
        const samples = [...measure.children];
        const calendarStyle = view.getComputedStyle(calendar);
        const weekdayGap = parseFloat(calendarStyle.getPropertyValue("--hub-heatmap-label-gap")) || 4;
        const inset = parseFloat(calendarStyle.getPropertyValue("--hub-heatmap-inline-inset")) || 4;
        const scale = heatmapPixelScale(calendar);
        // offsetWidth rounds text to CSS pixels and can under-reserve this tight
        // column. Measure painted layout widths and round outward in device pixels.
        const zoom = scale / (view.devicePixelRatio || 1);
        const weekdayWidth = Math.ceil(Math.max(...samples.slice(24).map(label => label.getBoundingClientRect().width / zoom)) * scale - 1e-9) / scale;
        // The separator bounds the complete assembly, not just the squares.
        // Reserve its two insets and the measured label column before applying
        // the existing integer-pixel sizing. Never borrow the panel padding.
        const gridAvailable = Math.max(0, availableWidth - 2 * inset - weekdayWidth - weekdayGap);
        // Some configured week starts place Sunday and Monday next to each
        // other. Keep their unchanged text size readable using the existing
        // narrow-calendar scroll fallback rather than overlapping the labels.
        const rows = [...weekdays.children].map(label => Number(label.style.gridRow)).sort((a, b) => a - b);
        const rowDistance = Math.min(...rows.slice(1).map((row, index) => row - rows[index]));
        const minimumDayCell = parseFloat(view.getComputedStyle(weekdays).fontSize) / rowDistance - 1 / scale;
        const geometry = heatmapGeometry(gridAvailable, weeks,
            samples.slice(0, 12).map(label => label.offsetWidth), starts,
            samples.slice(12, 24).map(label => label.offsetWidth), scale, minimumDayCell);
        const blockWidth = weekdayWidth + weekdayGap + geometry.innerWidth;
        const outerWidth = Math.max(availableWidth, blockWidth + 2 * inset);
        [...months.children].forEach((label, index) => {
            const text = geometry.compact ? MONTHS[index][0] : MONTHS[index];
            if (label.textContent !== text) label.textContent = text;
        });
        for (const [name, value] of Object.entries({
            cell: geometry.cell + "px", gap: geometry.gap + "px",
            margin: (outerWidth - blockWidth) / 2 + "px", weeks, width: outerWidth + "px",
            weekday: weekdayWidth + "px", "weekday-gap": weekdayGap + "px", inner: geometry.innerWidth + "px"
        })) graph.style.setProperty("--hub-heatmap-" + name, value);
    }

    function refresh() {
        if (measure) for (const sample of measure.children) observer.unobserve(sample);
        graph = calendar.querySelector(".heatmap-calendar-graph");
        boxes = calendar.querySelector(".heatmap-calendar-boxes");
        months = calendar.querySelector(".heatmap-calendar-months");
        if (!graph || !boxes || !months) return;
        graph.querySelector(".heatmap-calendar-year")?.remove();
        weekdays = graph.querySelector(".heatmap-calendar-days, .hub-progress-weekdays");
        if (!weekdays) return;
        // Keep the native week-start order. A separate class excludes legacy
        // snippet offsets and fixed weekday rows from this shared geometry.
        weekdays.className = "hub-progress-weekdays";
        [...weekdays.children].forEach((label, index) => {
            const name = { Sun: "Sun", Mon: "Mon", Wed: "Wed", Fri: "Fri", S: "Sun", M: "Mon", W: "Wed", F: "Fri" }[label.textContent];
            if (!name) label.remove();
            else {
                if (!label.style.gridRow) label.style.gridRow = String(index + 1);
                label.textContent = name[0];
                label.setAttribute("aria-label", name);
            }
        });
        graph.classList.add("hub-progress-graph");
        boxes.classList.add("hub-progress-grid");
        if (!graph.parentElement.classList.contains("hub-heatmap-viewport")) {
            const viewport = calendar.ownerDocument.createElement("div");
            viewport.className = "hub-heatmap-viewport";
            graph.before(viewport);
            viewport.append(graph);
        }
        weeks = fillOutsideYearCells(boxes);
        const cells = [...boxes.children];
        starts = MONTHS.map(name => Math.floor(cells.indexOf(boxes.querySelector(".month-" + name.toLowerCase())) / 7));
        [...months.children].forEach((label, index) => {
            label.style.gridColumn = `${starts[index] + 1} / ${(starts[index + 1] ?? weeks) + 1}`;
            label.setAttribute("aria-label", MONTH_NAMES[index]);
            label.title = MONTH_NAMES[index];
        });
        graph.querySelector(".hub-heatmap-measure")?.remove();
        measure = calendar.ownerDocument.createElement("div");
        measure.className = "hub-heatmap-measure";
        measure.setAttribute("aria-hidden", "true");
        // Measure the displayed letters, not a reserved full-word column. The
        // existing device-pixel geometry fits the remaining calendar width.
        for (const text of [...MONTHS, ...MONTHS.map(name => name[0]), "S", "M", "W", "F"]) {
            const sample = calendar.ownerDocument.createElement("span");
            sample.textContent = text;
            measure.append(sample);
            observer.observe(sample);
        }
        graph.append(measure);
        // A font or text-size change also invalidates the geometry.
        availableWidth = parseFloat(view.getComputedStyle(calendar).width) || availableWidth;
        layout();
    }

    component.register(() => {
        disposed = true;
        observer.disconnect();
        resolution?.removeEventListener("change", watchScale);
        view.removeEventListener("resize", layout);
    });
    return refresh;
}

module.exports = { heatmapGeometry, heatmapPixelScale, fillOutsideYearCells, createProgressHeatmap };
