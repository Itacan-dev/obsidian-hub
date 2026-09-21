/* HOME DASHBOARD */

.dashboard {
    --dashboard-gap: 14px;
}

/* Hide properties on dashboard */
.dashboard .metadata-container {
    display: none;
}

/* Wider page */
.dashboard.markdown-preview-view .markdown-preview-sizer,
.dashboard.markdown-source-view .cm-contentContainer {
    max-width: 1500px;
}

/* Dashboard cards */
.dashboard .callout[data-callout="dash"] {
    background: var(--background-secondary);
    border: 1px solid var(--background-modifier-border);
    border-radius: 10px;
    padding: 4px 8px;
    box-shadow: none;
}

.dashboard .callout[data-callout="dash"] .callout-title {
    font-size: 1rem;
    font-weight: 650;
}

/* Two-column dashboard */
.dashboard .callout[data-callout="columns"] {
    background: transparent;
    border: none;
    padding: 0;
}

.dashboard .callout[data-callout="columns"] > .callout-content {
    display: grid;
    grid-template-columns: minmax(0, 1.4fr) minmax(300px, 0.8fr);
    gap: var(--dashboard-gap);
}

.dashboard .callout[data-callout="columns"] > .callout-content > blockquote {
    margin: 0;
}

/* Tables */
.dashboard table {
    width: 100%;
}

.dashboard th {
    font-size: 0.85em;
    color: var(--text-muted);
}

/* Less wasted vertical space */
.dashboard h2 {
    margin-top: 1.4em;
}

.dashboard .callout-content > :first-child {
    margin-top: 0;
}

/* Mobile / narrow window */
@media (max-width: 900px) {
    .dashboard .callout[data-callout="columns"] > .callout-content {
        grid-template-columns: 1fr;
    }
}
