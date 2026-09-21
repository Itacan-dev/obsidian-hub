"use strict";
const assert = require("assert"), fs = require("fs"), path = require("path");
const source = fs.readFileSync(path.resolve(__dirname, "../../../../../System/Dashboards/Home/view.js"), "utf8");
const { homeTimePeriod } = require("../services/home-covers");
const expected = ["night", "morning", "afternoon", "evening"];
for (let minute = 0; minute < 1440; minute++) {
    // Exercise the real Home selector through local getHours(), not UTC.
    const period = homeTimePeriod({ getHours() { return Math.floor(minute / 60); } });
    const name = expected[Math.floor(minute / 360)];
    assert.equal(period.name, name, `Local minute ${minute}`);
    assert.equal(period.greeting, `Good ${name}`);
    assert(fs.existsSync(path.resolve(__dirname, "../../../../..", period.cover)), "Cover must exist");
}
assert(source.includes("const homePeriod = window.hubGetHomeTimePeriod();"));
assert(source.includes("const coverPath = window.hubGetHomeCover(homePeriod.name).path;"));
assert(source.includes("const greeting = homePeriod.greeting;"));
assert(source.includes('window.hubMountHomeCover?.(cover, image, dv.component, homePeriod.name)'));
console.log("Home time periods passed: every local minute, midnight/06:00/noon/18:00 boundaries, synchronized greetings/covers, existing image assets and unchanged cover mounting.");
