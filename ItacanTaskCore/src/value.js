"use strict";
const { check } = require("./errors");

function plain(value) {
    return value !== null && typeof value === "object" &&
        (Object.getPrototypeOf(value) === Object.prototype || Object.getPrototypeOf(value) === null);
}
function jsonValue(value, depth = 0) {
    check(depth <= 64, "JSON value is too deeply nested.");
    if (value === null || typeof value === "string" || typeof value === "boolean") return;
    if (typeof value === "number") { check(Number.isFinite(value), "Non-finite JSON number."); return; }
    check(Array.isArray(value) || plain(value), "Only portable JSON values are supported.");
    if (Array.isArray(value)) {
        check(Object.keys(value).length === value.length && Reflect.ownKeys(value).length === value.length + 1, "Sparse or decorated arrays are unsupported.");
        for (const item of value) jsonValue(item, depth + 1);
    } else {
        check(Reflect.ownKeys(value).length === Object.keys(value).length, "Symbol or hidden record fields are unsupported.");
        for (const key of Object.keys(value)) {
            check(!["__proto__", "constructor", "prototype"].includes(key), "Unsafe JSON key.");
            const descriptor = Object.getOwnPropertyDescriptor(value, key);
            check(!descriptor.get && !descriptor.set, "Accessor fields are not portable JSON records.");
            jsonValue(value[key], depth + 1);
        }
    }
}
function canonical(value) {
    jsonValue(value);
    const sort = item => Array.isArray(item) ? item.map(sort) : plain(item)
        ? Object.fromEntries(Object.keys(item).sort().map(key => [key, sort(item[key])])) : item;
    return JSON.stringify(sort(value));
}
function clone(value) { return JSON.parse(canonical(value)); }
function fields(value, allowed, required = []) {
    check(plain(value), "Expected a plain record.");
    check(Object.keys(value).every(key => allowed.includes(key)), "Unsupported record field.", { fields: Object.keys(value).filter(key => !allowed.includes(key)) });
    check(required.every(key => Object.hasOwn(value, key)), "Missing required record field.", { fields: required.filter(key => !Object.hasOwn(value, key)) });
}
function text(value, label = "identifier") {
    check(typeof value === "string" && value.length > 0 && value.length <= 512 && value === value.trim() && !/[\u0000-\u001f]/.test(value), `Invalid ${label}.`);
}
function referenceId(value) {
    text(value);
    check(!/[\\/]/.test(value) && !/^[a-z]:/i.test(value) && value !== "." && value !== "..", "Reference IDs must not be filesystem paths.");
}
function uuid(value) {
    check(typeof value === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(value), "Expected a canonical UUID.");
}
function timestamp(value) { check(value === null || Number.isSafeInteger(value) && value >= 0, "Invalid timestamp."); }
function revision(value) { check(Number.isSafeInteger(value) && value >= 0, "Invalid revision."); }
module.exports = { plain, jsonValue, canonical, clone, fields, text, referenceId, uuid, timestamp, revision };
