"use strict";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const MONTH_NAMES = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

// Equal CSS lengths alone are insufficient: fractional device-pixel edges are
// rounded independently when painted. Both the square and the pitch must be
// integral in device pixels. Keep the DOM grid; convert to CSS units only once.
function heatmapGeometry(width, weeks, monthWidths, starts, compactWidths = monthWidths, scale = 1) {
    const gap = 1 / scale;
    const minimumPixels = (widths, minimumCell) => Math.ceil(Math.max(minimumCell, ...widths.map((label, index) =>
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

function completeHeatmapWeeks(boxes) {
    // Native leading placeholders + real dates determine the week count. Keep
    // their order unchanged and complete only the final week. Padding has no
    // month class or data-date, so the existing report handlers never select it.
    const weeks = Math.ceil(boxes.children.length / 7);
    while (boxes.children.length < weeks * 7) {
        boxes.append(boxes.ownerDocument.createElement("li"));
    }
    for (const cell of boxes.children) {
        if (cell.matches("[class*='month-']")) continue;
        cell.classList.add("isEmpty", "hub-progress-padding");
        cell.style.removeProperty("background-color");
        cell.setAttribute("aria-hidden", "true");
    }
    return weeks;
}

// Keep the upstream renderer's dates, colors and week-start setting. Only this
// controller owns the resulting geometry, including after a year/scope change.
function createProgressHeatmap(calendar, component) {
    const view = calendar.ownerDocument.defaultView;
    let graph, boxes, months, measure, weeks, starts;
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
        if (disposed || !graph?.isConnected || !availableWidth) return;
        const samples = [...measure.children];
        const geometry = heatmapGeometry(availableWidth, weeks,
            samples.slice(0, 12).map(label => label.offsetWidth), starts,
            samples.slice(12).map(label => label.offsetWidth), heatmapPixelScale(calendar));
        [...months.children].forEach((label, index) => {
            const text = geometry.compact ? MONTHS[index][0] : MONTHS[index];
            if (label.textContent !== text) label.textContent = text;
        });
        for (const [name, value] of Object.entries({
            cell: geometry.cell + "px", gap: geometry.gap + "px",
            margin: geometry.margin + "px", weeks, width: geometry.width + "px"
        })) graph.style.setProperty("--hub-heatmap-" + name, value);
    }

    function refresh() {
        if (measure) for (const sample of measure.children) observer.unobserve(sample);
        graph = calendar.querySelector(".heatmap-calendar-graph");
        boxes = calendar.querySelector(".heatmap-calendar-boxes");
        months = calendar.querySelector(".heatmap-calendar-months");
        if (!graph || !boxes || !months) return;
        // The native weekday column is intentionally absent on dashboards.
        // Remove it so global snippet !important rules cannot create an implicit
        // grid column by making the unused column visible again.
        graph.querySelector(".heatmap-calendar-year")?.remove();
        graph.querySelector(".heatmap-calendar-days")?.remove();
        graph.classList.add("hub-progress-graph");
        boxes.classList.add("hub-progress-grid");
        weeks = completeHeatmapWeeks(boxes);
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
        for (const text of [...MONTHS, ...MONTHS.map(name => name[0])]) {
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

module.exports = { heatmapGeometry, heatmapPixelScale, completeHeatmapWeeks, createProgressHeatmap };
