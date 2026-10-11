"use strict";
const assert = require("assert/strict");
const fs = require("fs");
const vm = require("vm");
const source = fs.readFileSync(require.resolve("../ui/settings-pages"), "utf8");
function pages(environment) {
    const context = { module: { exports: {} } };
    if (environment !== undefined) context.process = { env: environment };
    vm.runInNewContext(source, context);
    return context.module.exports.SETTINGS_PAGES;
}
for (const environment of [undefined, {}, { ITACAN_DEVELOPMENT: "0" }]) {
    const shipped = pages(environment);
    assert.equal(shipped.length, 15);
    assert.ok(!shipped.some(page => page.id === "daily-brief"), "Shipped settings do not expose the developer Daily Brief");
    for (const id of ["oath", "appearance", "tasks", "atlas", "music", "integrations", "files"]) assert.ok(shipped.some(page => page.id === id));
}
const development = pages({ ITACAN_DEVELOPMENT: "1" });
assert.equal(development.length, 16);
assert.equal(development.filter(page => page.id === "daily-brief").length, 1, "Development retains the existing Daily Brief page");
console.log("Settings navigation passed: shipped categories, safe browser context, and explicit development Daily Brief access.");
