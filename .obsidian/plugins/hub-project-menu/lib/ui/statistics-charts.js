"use strict";

const { formatDuration } = require("../domain/statistics");
const SVG_NS = "http://www.w3.org/2000/svg";

function svgElement(parent, tag, attrs = {}, text) {
    const element = parent.ownerDocument.createElementNS(SVG_NS, tag);
    for (const [name, value] of Object.entries(attrs)) element.setAttribute(name, String(value));
    if (text != null) element.textContent = text;
    parent.appendChild(element); return element;
}

function dateLabel(time, year = false) {
    return new Date(time).toLocaleDateString([], { month: "short", day: "numeric", ...(year ? { year: "numeric" } : {}) });
}

function binLabel(bin) {
    const end = new Date(bin.end); end.setDate(end.getDate() - 1);
    return dateLabel(bin.start, true) + (+end > bin.start ? ` – ${dateLabel(+end, true)}` : "");
}

function emptyChart(parent, message) {
    parent.createDiv({ cls: "hub-report-empty hub-statistics-empty", text: message });
}

// One SVG rectangle per aggregated bin, never per raw event. A single focusable
// chart provides keyboard/pointer details, with a native table for all values.
function renderBarChart(parent, { range, values, label, color = "accent", duration = false, compact = false, summary = false, empty }) {
    if (!values.some(value => Number.isFinite(value) && value > 0)) { emptyChart(parent, empty); return; }
    const wrap = parent.createDiv({ cls: `hub-statistics-chart hub-statistics-series-${color}` });
    const format = duration ? formatDuration : value => value.toLocaleString();
    const plotHeight = summary ? 88 : compact ? 96 : 112;
    const plot = svgElement(wrap, "svg", { class: "hub-statistics-plot", viewBox: `0 0 400 ${plotHeight}`, preserveAspectRatio: "none",
        tabindex: "0", role: "group", "aria-label": `${label}. Use Left and Right arrows for dates, a data table is available to screen readers.` });
    plot.style.height = `${plotHeight}px`;
    const left = 42, top = 8, width = 348, height = plotHeight - 32;
    const max = Math.max(...values), scale = duration ? (max < 3600000 ? 60000 : 3600000) : 1;
    const upper = Math.max(scale, Math.ceil(max / scale / 4) * scale * 4);
    for (const fraction of [0, .5, 1]) {
        const y = top + height * (1 - fraction);
        svgElement(plot, "line", { x1: left, x2: left + width, y1: y, y2: y, class: "hub-statistics-gridline" });
        const amount = upper * fraction;
        svgElement(plot, "text", { x: left - 7, y: y + 4, "text-anchor": "end" }, duration ? `${amount / scale}${scale === 60000 ? "m" : "h"}` : amount.toLocaleString());
    }
    const bars = [], ticks = [];
    let chartWidth = 400, stride = width / values.length;
    values.forEach((value, index) => {
        const bar = svgElement(plot, "rect", { x: left + index * stride + stride * .15,
            y: top + height * (1 - value / upper), width: stride * .7, height: height * value / upper,
            class: "hub-statistics-bar", "aria-hidden": "true" });
        bars.push(bar);
    });
    for (const index of [...new Set([0, Math.floor((values.length - 1) / 2), values.length - 1])]) {
        const tick = svgElement(plot, "text", { x: left + (index + .5) * stride, y: plotHeight - 8,
            "text-anchor": index === 0 ? "start" : index === values.length - 1 ? "end" : "middle" }, dateLabel(range.bins[index].start, range.days > 366));
        ticks.push({ tick, index });
    }
    const layout = () => {
        chartWidth = plot.getBoundingClientRect().width || 400;
        const plotWidth = Math.max(1, chartWidth - left - 10);
        stride = plotWidth / values.length;
        plot.setAttribute("viewBox", `0 0 ${chartWidth} ${plotHeight}`);
        for (const line of plot.querySelectorAll("line")) line.setAttribute("x2", left + plotWidth);
        bars.forEach((bar, index) => { bar.setAttribute("x", left + (index + .15) * stride); bar.setAttribute("width", stride * .7); });
        ticks.forEach(({ tick, index }) => {
            tick.setAttribute("x", left + (index + .5) * stride);
            tick.style.display = chartWidth < 360 && index > 0 && index < values.length - 1 ? "none" : "";
        });
    };
    layout();
    const observer = typeof ResizeObserver === "function" ? new ResizeObserver(layout) : null;
    observer?.observe(wrap);
    const doc = wrap.ownerDocument, win = doc.defaultView;
    const detail = doc.createElement("div");
    detail.className = "tooltip hub-detail-tooltip hub-statistics-point-tooltip hub-button-scope";
    detail.setAttribute("role", "tooltip");
    detail.hidden = true;
    doc.body.append(detail);
    const hide = () => { detail.hidden = true; bars[selected]?.classList.remove("is-selected"); };
    let selected = Math.max(0, values.findIndex(value => value > 0));
    const show = index => {
        bars[selected]?.classList.remove("is-selected"); selected = Math.max(0, Math.min(values.length - 1, index));
        bars[selected].classList.add("is-selected");
        detail.textContent = `${binLabel(range.bins[selected])}: ${format(values[selected])}`;
        plot.setAttribute("aria-label", `${label}. ${detail.textContent}. Left and Right arrows change the date.`);
        detail.hidden = false;
        const rect = plot.getBoundingClientRect(), bounds = detail.getBoundingClientRect();
        detail.style.left = Math.max(8, Math.min(rect.left + left + (selected + .5) * stride - bounds.width / 2, win.innerWidth - bounds.width - 8)) + "px";
        detail.style.top = Math.max(8, rect.top >= bounds.height + 8 ? rect.top - bounds.height - 6 : rect.bottom + 6) + "px";
    };
    plot.addEventListener("pointermove", event => {
        const bounds = plot.getBoundingClientRect();
        show(Math.floor(((event.clientX - bounds.left) * chartWidth / bounds.width - left) / stride));
    });
    plot.addEventListener("focus", () => show(selected));
    plot.addEventListener("keydown", event => {
        if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
        event.preventDefault();
        show(event.key === "Home" ? 0 : event.key === "End" ? values.length - 1 : selected + (event.key === "ArrowRight" ? 1 : -1));
    });
    plot.addEventListener("pointerleave", hide);
    plot.addEventListener("blur", hide);
    doc.addEventListener("scroll", hide, true);
    win.addEventListener("resize", hide);
    const scroll = wrap.createDiv({ cls: "hub-statistics-sr-only" });
    const table = scroll.createEl("table"); table.createEl("caption", { text: label });
    const header = table.createEl("thead").createEl("tr");
    header.createEl("th", { text: "Date", attr: { scope: "col" } }); header.createEl("th", { text: duration ? "Time" : "Count", attr: { scope: "col" } });
    const body = table.createEl("tbody");
    values.forEach((value, index) => {
        const row = body.createEl("tr"); row.createEl("th", { text: binLabel(range.bins[index]), attr: { scope: "row" } });
        row.createEl("td", { text: format(value) });
    });
    return () => {
        observer?.disconnect(); detail.remove();
        doc.removeEventListener("scroll", hide, true); win.removeEventListener("resize", hide);
    };
}

function renderDonut(parent, comparison) {
    if (!comparison.total) { emptyChart(parent, "No progress report data in this period."); return; }
    const root = parent.createDiv({ cls: "hub-statistics-comparison" });
    const svg = svgElement(root, "svg", { viewBox: "0 0 100 100", role: "img",
        "aria-label": `Projects ${comparison.projects}%. Resources ${comparison.resources}%. Based on progress report points.` });
    svgElement(svg, "circle", { cx: 50, cy: 50, r: 36, class: "hub-statistics-donut-base" });
    svgElement(svg, "circle", { cx: 50, cy: 50, r: 36, pathLength: 100, transform: "rotate(-90 50 50)",
        "stroke-dasharray": `${comparison.projects} ${100 - comparison.projects}`, class: "hub-statistics-donut-projects" });
    const legend = root.createDiv({ cls: "hub-statistics-legend" });
    for (const [label, percent, cls] of [["Projects", comparison.projects, "accent"], ["Resources", comparison.resources, "blue"]]) {
        const row = legend.createDiv({ cls: `hub-statistics-legend-row hub-statistics-series-${cls}` });
        row.createSpan({ cls: "hub-statistics-dot", attr: { "aria-hidden": "true" } });
        row.createSpan({ text: label }); row.createEl("strong", { text: `${percent}%` });
    }
}

module.exports = { renderBarChart, renderDonut, emptyChart, dateLabel };
