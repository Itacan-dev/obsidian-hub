"use strict";
const { hasKeyboardFocus, focusAfterRowRemoval } = require("./focus-restoration");
const { setHubIcon } = require("./icons");
const { bindCompletionSound, playStepCompletionSound } = require("./completion-audio");
const { TASK_FIELD_LABELS:labels, validateTaskTitle } = require("../domain/task-form");

function taskSection(host, title, help) {
    const section = host.createEl("section", { cls: "hub-task-section" });
    if (title) section.createEl("h3", { text: title });
    if (help) section.createEl("p", { cls: "hub-task-help", text: help });
    return section;
}

function mountTaskText(host, state, onChange = () => {}, { placeholder = "", multiline = false, wrapTitle = false, required = true, attributes = {} } = {}) {
    const input = host.createEl(multiline || wrapTitle ? "textarea" : "input", { cls: multiline ? "hub-quick-add-input" : "hub-task-title-input",
        attr: { ...(wrapTitle ? { rows: "1", wrap: "soft" } : multiline ? { rows: "3" } : { type: "text" }), "aria-label": labels.text, ...(required ? { required: "" } : {}), ...attributes } });
    input.value = state.text ?? ""; input.placeholder = placeholder;
    input.addEventListener("input", () => { if (!input.disabled && !input.readOnly) {
        // Match the single-line input's native CR/LF stripping for paste/drop.
        // Soft wrapping is presentation only; it never creates Markdown lines.
        if (wrapTitle && /[\r\n]/.test(input.value)) {
            const value = input.value, start = input.selectionStart, end = input.selectionEnd, direction = input.selectionDirection;
            input.value = value.replace(/[\r\n]/g, "");
            input.setSelectionRange(value.slice(0, start).replace(/[\r\n]/g, "").length, value.slice(0, end).replace(/[\r\n]/g, "").length, direction);
        }
        state.text = input.value; onChange({ text: state.text });
    } });
    return input;
}

// Shared natural-height measurement for the task title and editable checklist
// text. Call resize after attaching/showing a field, before assigning focus.
function mountWrappingTaskInput(input) {
    let width, frame;
    const resize = () => {
        if (!input.isConnected || !input.getClientRects().length) return;
        const originalWidth = input.style.width;
        for (let pass = 0; pass < 2; pass++) {
            const measuredWidth = input.getBoundingClientRect().width;
            input.style.width = measuredWidth + "px";
            input.style.height = "auto"; input.style.height = input.scrollHeight + "px";
            input.style.width = originalWidth;
            if (Math.abs(input.getBoundingClientRect().width - measuredWidth) < 0.1) break;
        }
        width = input.clientWidth;
    };
    input.addEventListener("input", resize);
    const view = input.ownerDocument.defaultView;
    const observer = new view.ResizeObserver(() => {
        if (width !== input.clientWidth) {
            width = input.clientWidth;
            if (frame === undefined) frame = view.requestAnimationFrame(() => { frame = undefined; resize(); });
        }
    });
    observer.observe(input); resize();
    return { resize, destroy() { observer.disconnect(); input.removeEventListener("input", resize); if (frame !== undefined) view.cancelAnimationFrame(frame); } };
}



// Both form layouts edit the same flat native Step draft.
function mountTaskSteps({ host: steps, state, onChange = () => {}, emptyPrompt = false, inlineAdd = false, checklist = null, markdown = null, getPath = () => state.path, actionLabel = "Add step", pendingPlaceholder = "Add a step...", focusFallback = null, canAdd = null, onBeforeAdd = () => {} }) {
    const list = checklist?.rowsHost ?? steps.createDiv({ cls: "hub-task-step-list" });
    const editors = new Set(), sizes = new Map();
    const textInput = (parent, attributes, value = "") => {
        const input = parent.createEl(checklist ? "textarea" : "input", { attr: { ...(checklist ? { rows: "1", wrap: "soft" } : { type: "text" }), ...attributes } });
        input.value = value;
        if (checklist) {
            input.classList.add("hub-task-card-edit-input");
            input.addEventListener("input", () => {
                // A Step title remains a single line.
                if (/[\r\n]/.test(input.value)) {
                    const value = input.value, start = input.selectionStart, end = input.selectionEnd, direction = input.selectionDirection;
                    input.value = value.replace(/[\r\n]/g, "");
                    input.setSelectionRange(value.slice(0, start).replace(/[\r\n]/g, "").length, value.slice(0, end).replace(/[\r\n]/g, "").length, direction);
                }
            });
            sizes.set(input, mountWrappingTaskInput(input));
        }
        return input;
    };
    state.steps ??= [];
    const renderSteps = (appendOnly = false) => {
        if (!appendOnly) { for (const input of editors) { sizes.get(input)?.destroy(); sizes.delete(input); } list.replaceChildren(); editors.clear(); }
        if (emptyPrompt && !state.steps.length) {
            const prompt = list.createEl("input", { type: "text", attr: { "aria-label": "New step", placeholder: "Add a step..." } });
            prompt.addEventListener("input", () => {
                if (!prompt.value.trim()) return;
                const position = prompt.selectionStart;
                state.steps.push({ text: prompt.value, completed: false }); renderSteps(); onChange({ steps: state.steps });
                const input = list.querySelector("input[type=text]"); input.focus(); input.setSelectionRange(position, position);
            });
        }
        state.steps.forEach((step, index) => {
            if (appendOnly && index !== state.steps.length - 1) return;
            const parts = checklist?.createRow(step);
            const row = parts?.row ?? list.createDiv({ cls: "hub-task-step" });
            if (!parts) row.classList.add("hub-task-step"); row.classList.toggle("is-completed", inlineAdd && !!step.completed);
            const checkbox = parts?.checkbox ?? row.createEl("input", { type: "checkbox", attr: { "aria-label": "Step complete" } }); checkbox.checked = !!step.completed;
            bindCompletionSound(checkbox, playStepCompletionSound);
            checkbox.addEventListener("change", () => { step.completed = checkbox.checked; step.completedAt = checkbox.checked ? Date.now() : null;
                if (inlineAdd) row.classList.toggle("is-completed", step.completed); onChange({ steps: state.steps }); });
            const input = textInput(parts?.text ?? row, { "aria-label": "Step text", required: "" }, step.text ?? "");
            editors.add(input);
            input.addEventListener("input", () => { if (!input.disabled && !input.readOnly) { step.text = input.value; onChange({ steps: state.steps }); } });
            if (parts) {
                input.classList.add("hub-task-card-edit-input");
                parts.text.tabIndex = 0; parts.text.setAttribute("role", "button"); parts.text.setAttribute("aria-label", "Edit Step: " + step.text);
                const show = () => { if (input.disabled) return; parts.text.removeAttribute("role"); parts.text.tabIndex = -1; parts.text.replaceChildren(input); sizes.get(input)?.resize(); input.focus(); };
                const preview = () => {
                    try { validateTaskTitle(input.value); }
                    catch (error) { input.setCustomValidity(error.message); return; }
                    input.remove();
                    parts.text.textContent = step.text;
                    parts.text.setAttribute("role", "button"); parts.text.tabIndex = 0;
                    void markdown.render(parts.text, step.text, getPath, () => !parts.text.contains(input));
                };
                parts.text.addEventListener("click", event => { if (event.target !== input) { event.preventDefault(); event.stopImmediatePropagation(); show(); } }, true);
                parts.text.addEventListener("keydown", event => {
                    if (event.target !== input && ["Enter", " "].includes(event.key)) { event.preventDefault(); show(); }
                });
                input.addEventListener("blur", preview); preview();
            }
            if (inlineAdd) {
                const confirm = () => {
                    try { validateTaskTitle(input.value); }
                    catch (error) { input.setCustomValidity(error.message); input.reportValidity(); return; }
                    input.blur(); add.focus({ preventScroll: true });
                };
                input.addEventListener("input", () => input.setCustomValidity(""));
                input.addEventListener("keydown", event => {
                    if (event.isComposing || event.keyCode === 229 || !["Enter", "Escape"].includes(event.key)) return;
                    // A checklist key finishes this row, never implicitly saves
                    // the parent task form. The task's Save commits all edits.
                    event.preventDefault(); event.stopPropagation();
                    if (event.key === "Enter") {
                        confirm();
                    } else { input.blur(); checkbox.focus({ preventScroll: true }); }
                });
                input.addEventListener("beforeinput", event => {
                    if (!event.isComposing && ["insertLineBreak", "insertParagraph"].includes(event.inputType)) { event.preventDefault(); confirm(); }
                });
            }
            for (const [offset, label, icon] of [[-1, "Move step up", "chevron-up"], [1, "Move step down", "chevron-down"]]) {
                const move = row.createEl("button", { cls: "hub-task-step-order", attr: { type: "button", "aria-label": label } }); setHubIcon(move, icon);
                move.disabled = index + offset < 0 || index + offset >= state.steps.length;
                move.onclick = () => { const next = index + offset; [state.steps[index], state.steps[next]] = [state.steps[next], state.steps[index]]; renderSteps(); onChange({ steps: state.steps }); };
            }
            const remove = row.createEl("button", { attr: { type: "button", "aria-label": "Remove step " + (index + 1) } }); setHubIcon(remove, "x");
            remove.addEventListener("click", event => {
                const restoreFocus = hasKeyboardFocus(remove, event);
                state.steps = state.steps.filter(item => item !== step);
                renderSteps(); onChange({ steps: state.steps });
                if (restoreFocus) focusAfterRowRemoval([...list.querySelectorAll(".hub-task-step > button, .hub-task-step-item > button")], index, draft && !draft.hidden ? draftInput : (add.getClientRects().length ? add : focusFallback ?? add));
            });
        });
    };
    renderSteps();
    const draftParts = inlineAdd && checklist ? checklist.createRow({ text: "" }, checklist.list) : null;
    const draft = inlineAdd ? draftParts?.row ?? steps.createDiv({ cls: "hub-task-step-draft hub-task-step" }) : null;
    if (draft) draft.classList.add("hub-task-step-draft");
    if (draft && !checklist) draft.classList.add("hub-task-step");
    if (draft) draft.hidden = true;
    const draftCheckbox = draftParts?.checkbox ?? draft?.createEl("input", { type: "checkbox", attr: { "aria-label": "New step complete" } });
    draftCheckbox?.setAttribute("aria-label", "New step complete");
    let draftCompletedAt = null, composing = false;
    if (draftCheckbox) {
        bindCompletionSound(draftCheckbox, playStepCompletionSound);
        draftCheckbox.addEventListener("change", () => { draftCompletedAt = draftCheckbox.checked ? Date.now() : null;
            draft.classList.toggle("is-completed", draftCheckbox.checked); onChange({ steps: state.steps }); });
    }
    const draftInput = draft ? textInput(draftParts?.text ?? draft, { "aria-label": "New step", placeholder: pendingPlaceholder }) : null;
    if (checklist) draftInput?.classList.add("hub-task-card-edit-input");
    const cancelDraft = draft?.createEl("button", { attr: { type: "button", "aria-label": "Cancel new step" } });
    if (cancelDraft) setHubIcon(cancelDraft, "x");
    const add = (checklist?.list ?? steps).createEl("button", { cls: "hub-task-add-step" + (inlineAdd ? " hub-task-inline-action" : ""), attr: { type: "button" } });
    setHubIcon(add.createSpan(), inlineAdd ? "circle-plus" : "plus"); add.createSpan({ text: actionLabel });
    const meaningfulPending = () => {
        if (!draft || draft.hidden || !draftInput.value.trim()) return false;
        try { validateTaskTitle(draftInput.value); return true; } catch (_) { return false; }
    };
    // Editor opt-in; generic forms retain their existing creation conventions.
    const refreshReadiness = () => { if (canAdd) add.disabled = !canAdd() || !!draft && !draft.hidden && !meaningfulPending(); };
    let draftVersion = 0, pointerDown = false, emptyBlurVersion = null, pointerTimer = null;
    const pointerRoot = inlineAdd ? steps.closest(".modal") ?? steps.closest("form") ?? steps : null;
    const view = steps.ownerDocument.defaultView;
    const closeDraft = (focus = false) => {
        if (!draft) return;
        draftVersion++;
        draft.hidden = true; draftInput.value = ""; draftInput.setCustomValidity(""); draftCheckbox.checked = false;
        draftCompletedAt = null; draft.classList.remove("is-completed"); add.hidden = false;
        refreshReadiness();
        if (checklist) onChange({ steps: state.steps });
        if (focus) (add.getClientRects().length ? add : focusFallback ?? add).focus({ preventScroll: true });
    };
    const commitPending = (focus = false) => {
        if (!draft || draft.hidden) return true;
        if (composing) return false;
        if (!draftInput.value.trim() && !focus) { closeDraft(); return true; }
        try { validateTaskTitle(draftInput.value); }
        catch (error) { draftInput.setCustomValidity(error.message); draftInput.reportValidity(); return false; }
        state.steps.push({ text: draftInput.value.trim(), completed: !!draftCheckbox.checked,
            ...(draftCompletedAt ? { completedAt: draftCompletedAt } : {}) });
        // Append without replacing existing rows: a blur caused by clicking an
        // existing Step must preserve that row's native focus/click target.
        closeDraft(focus); renderSteps(true); onChange({ steps: state.steps }); return true;
    };
    const finishBlur = () => {
        if (!draft?.isConnected || draft.hidden || composing || draft.contains(steps.ownerDocument.activeElement)) return;
        // A valid confirmation replaces a row of the same height. Empty rows
        // must survive pointer-down until click finishes, or the clicked control
        // can move out from under pointer-up and lose its intended action.
        if (pointerDown && !draftInput.value.trim()) emptyBlurVersion = draftVersion;
        else commitPending(); // Never restore Add focus for blur or Save.
    };
    const flushEmptyBlur = () => {
        const version = emptyBlurVersion; emptyBlurVersion = null;
        if (version !== null && version === draftVersion) finishBlur();
    };
    // A disabled native button rejects clicks but can still blur the editor.
    // Cancel focus transfer at the existing capture boundary, only for this
    // editor-opted-in action. All other targets retain their normal blur path.
    const preventDisabledAddFocus = event => {
        if (canAdd && add.disabled && event.composedPath().includes(add)) {
            event.preventDefault(); return true;
        }
        return false;
    };
    const beginPointer = event => { if (!preventDisabledAddFocus(event)) pointerDown = true; };
    const endPointer = () => {
        if (!pointerDown) return;
        pointerDown = false; view.clearTimeout(pointerTimer);
        // Click normally flushes after its target handler. This also handles a
        // released drag that produces no click; timers run after native click.
        pointerTimer = view.setTimeout(flushEmptyBlur, 0);
    };
    const keyboardPointerReset = () => { pointerDown = false; flushEmptyBlur(); };
    const pointerListeners = [[pointerRoot, "pointerdown", beginPointer, true], [pointerRoot, "mousedown", preventDisabledAddFocus, true],
        [steps.ownerDocument, "pointerup", endPointer, true], [steps.ownerDocument, "pointercancel", endPointer, true],
        [pointerRoot, "click", flushEmptyBlur, false], [pointerRoot, "keydown", keyboardPointerReset, true]];
    if (pointerRoot) pointerListeners.forEach(([target, type, handler, capture]) => target.addEventListener(type, handler, capture));
    if (draftInput) {
        draftInput.addEventListener("compositionstart", () => { composing = true; });
        draftInput.addEventListener("compositionend", () => { composing = false;
            finishBlur(); });
        draftInput.addEventListener("input", () => { draftInput.setCustomValidity(""); refreshReadiness(); onChange({ steps: state.steps }); });
        draftInput.addEventListener("keydown", event => {
            if (event.isComposing || event.keyCode === 229) return;
            if (event.key === "Enter") { event.preventDefault(); event.stopPropagation(); commitPending(true); }
            if (event.key === "Escape") { event.preventDefault(); event.stopPropagation(); closeDraft(true); }
        });
        draftInput.addEventListener("beforeinput", event => {
            if (!event.isComposing && ["insertLineBreak", "insertParagraph"].includes(event.inputType)) { event.preventDefault(); commitPending(true); }
        });
        draft.addEventListener("focusout", event => {
            // Native pointer focus can run a microtask between blur and focus,
            // while activeElement is temporarily body. Trust relatedTarget for
            // row-internal controls so their click is not removed mid-event.
            if (draft.contains(event.relatedTarget)) return;
            queueMicrotask(finishBlur);
        });
        cancelDraft.addEventListener("click", event => closeDraft(canAdd ? hasKeyboardFocus(cancelDraft, event) : true));
    }
    add.addEventListener("click", () => {
        if (add.disabled) return;
        onBeforeAdd();
        if (inlineAdd) { if (!commitPending()) return; draftVersion++; draft.hidden = false; refreshReadiness(); if (checklist) onChange({ steps: state.steps }); sizes.get(draftInput)?.resize(); draftInput.focus(); return; }
        state.steps.push({ text: "", completed: false }); renderSteps();
        list.lastElementChild?.querySelector("input[type=text]")?.focus(); onChange({ steps: state.steps });
    });
    refreshReadiness();
    return { refresh: renderSteps, refreshReadiness, commitPending, list, draftInput, add,
        get controls() { return [...editors, ...(draftInput ? [draftInput] : [])]; },
        get hasPending() { return !!draft && !draft.hidden; }, get pendingCompleted() { return !!draftCheckbox?.checked; },
        get meaningfulPending() { return meaningfulPending(); },
        destroy() { view.clearTimeout(pointerTimer); emptyBlurVersion = null;
            for (const sizing of sizes.values()) sizing.destroy(); sizes.clear();
            if (pointerRoot) pointerListeners.forEach(([target, type, handler, capture]) => target.removeEventListener(type, handler, capture)); },
        focusNew() { if (inlineAdd || !state.steps.length && !emptyPrompt) add.click(); else list.querySelector("input[type=text]")?.focus(); } };
}





// Workflow adapters provide routing and save behavior. Field order, markup,
// labels and controls live here for Quick Add, Inbox and the ordinary editor.
// Capture owns its primary text above Type; it uses mountTaskText there too.


module.exports={taskSection,mountTaskText,mountWrappingTaskInput,mountTaskSteps};
