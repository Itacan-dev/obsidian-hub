"use strict";

const MAX_FOCUS_ITEMS = 6;
const MAX_FOCUS_TEXT_LENGTH = 200;

function normalizeFocusItems(items) {
    return (Array.isArray(items) ? items : [])
        .map(item => {
            if (typeof item === "string") {
                return {
                    text: item.trim(),
                    projectId: null,
                    projectName: null
                };
            }

            if (!item || typeof item !== "object") {
                return null;
            }

            return {
                text: String(item.text ?? "").trim(),
                projectId:
                    typeof item.projectId === "string" &&
                    item.projectId.trim()
                        ? item.projectId
                        : null,
                projectName:
                    typeof item.projectName === "string" &&
                    item.projectName.trim()
                        ? item.projectName
                        : null
            };
        })
        .filter(item => item?.text)
        .slice(0, MAX_FOCUS_ITEMS);
}

function validateFocusItems(items) {
    if (
        !Array.isArray(items) ||
        items.length > MAX_FOCUS_ITEMS
    ) {
        throw new Error("Invalid focus list.");
    }

    const normalized = normalizeFocusItems(items);

    if (
        normalized.length !== items.length ||
        normalized.some(
            item =>
                !item.projectId ||
                item.text.length > MAX_FOCUS_TEXT_LENGTH
        )
    ) {
        throw new Error(
            "Each focus needs a Project or Resource and a short description."
        );
    }

    return normalized;
}

module.exports = {
    MAX_FOCUS_ITEMS,
    MAX_FOCUS_TEXT_LENGTH,
    normalizeFocusItems,
    validateFocusItems
};
