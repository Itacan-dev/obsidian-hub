"use strict";
const assert = require("assert"), { spawnSync } = require("child_process");
if (!process.env.HUB_DATE_TEST_CHILD) {
    for (const zone of ["UTC", "Europe/Stockholm", "America/New_York", "Pacific/Auckland"]) {
        const result = spawnSync(process.execPath, [__filename], { windowsHide: true, encoding: "utf8",
            env: { ...process.env, TZ: zone, LANG: "sv_SE.UTF-8", HUB_DATE_TEST_CHILD: "1" } });
        assert.equal(result.status, 0, zone + ": " + result.stdout + result.stderr);
        process.stdout.write(result.stdout);
    }
} else {
    const dates = require("../domain/dates"), planning = require("../domain/task-planning");
    const { formatDate, formatTime, formatDateTime, formatWeekday, formatDateRange, historyDateLabel,
        parseLocalISODate, localISODate, localDateTime, taskDateLabel, taskDateRangeLabel, shortDateLabel } = dates;
    assert.equal(Intl.DateTimeFormat().resolvedOptions().timeZone, process.env.TZ);
    const now = new Date(2026, 9, 7, 14, 30);
    const iso = "2026-10-07", date = parseLocalISODate(iso);
    assert.equal(formatDate(iso, "full"), "7 October 2026");
    assert.equal(formatDate(date), "7 Oct 2026");
    assert.equal(formatDate(date, "short"), "7 Oct");
    assert.equal(formatDate(date, "numeric"), "07/10/2026");
    assert.equal(shortDateLabel(iso), "07/10/2026");
    assert.equal(formatDate(date, "month"), "October 2026");
    assert.equal(formatDate(date, "month-short"), "Oct 2026");
    assert.equal(formatWeekday(date), "Wednesday");
    assert.equal(formatWeekday(date, true), "Wed");
    assert.equal(formatDateTime(now), "7 Oct 2026, 14:30");
    assert.equal(formatDateTime(now.getTime()), "7 Oct 2026, 14:30");
    for (const [hour, minute, expected] of [[0,0,"00:00"],[0,5,"00:05"],[12,0,"12:00"],[23,59,"23:59"]])
        assert.equal(formatTime(new Date(2026, 9, 7, hour, minute)), expected);
    const months = ["January","February","March","April","May","June","July","August","September","October","November","December"];
    months.forEach((month, index) => assert.equal(formatDate(new Date(2026, index, 17), "full"), "17 " + month + " 2026"));
    for (const value of [null, undefined, "2026-02-30", "2026-10-07T00:00:00Z", new Date(NaN)])
        assert.equal(formatDate(value), "", "Only local ISO date-only strings are interpreted");
    assert.equal(localISODate(date), iso); assert.equal(date.getHours(), 0);
    assert.equal(formatDateRange("2026-12-28", "2027-01-03", true, now), "28 Dec 2026 – 3 Jan 2027");
    assert.equal(formatDateRange("2026-10-05", "2026-10-11", true, now), "5 Oct – 11 Oct");
    assert.equal(formatDateRange("2025-10-05", "2025-10-11", true, now), "5 Oct 2025 – 11 Oct 2025");
    assert.equal(historyDateLabel(date, now), "7 Oct");
    assert.equal(historyDateLabel("2025-10-07", now), "7 Oct 2025");
    assert.equal(taskDateLabel(iso, "14:30", true, now), "Today, 14:30");
    assert.equal(taskDateLabel("2026-10-08", null, true, now), "Tomorrow");
    assert.equal(taskDateLabel("2027-01-01", null, true, new Date(2026,11,31)), "Tomorrow");
    assert.equal(taskDateLabel(iso, "14:30", false, now, true), "7 Oct 2026, 14:30");
    assert.equal(taskDateRangeLabel("2026-12-31", "23:30", "2027-01-01", "00:15", now), "31 Dec 2026, 23:30 → 1 Jan 2027, 00:15");
    assert.equal(taskDateRangeLabel(iso, "09:00", iso, "17:00", now), "7 Oct, 09:00 → 17:00");
    // Zoned adapters expose wall-clock fields; converting their instant would change the day.
    const moment = { isValid:()=>true, year:()=>2027, month:()=>0, date:()=>1, day:()=>5, hour:()=>0, minute:()=>15,
        valueOf(){ throw Error("Do not convert a zoned value"); } };
    const luxon = { isValid:true, year:2027, month:1, day:1, weekday:5, hour:0, minute:15,
        toJSDate(){ throw Error("Do not convert a zoned value"); } };
    for (const value of [moment,luxon]) {
        assert.equal(formatDateTime(value), "1 Jan 2027, 00:15");
        assert.equal(formatWeekday(value), "Friday");
        assert.equal(formatDate(value,"numeric"), "01/01/2027");
    }
    // Date-only meaning, scheduling boundaries and ISO precision across DST/year transitions.
    for (const iso of ["2026-03-08","2026-03-29","2026-04-05","2026-10-25","2026-11-01","2026-12-31","2027-01-01"]) {
        const value = parseLocalISODate(iso), snapshot = value.getTime();
        assert.equal(localISODate(value), iso);
        for (const time of ["00:00","01:30","02:30","12:00","23:59"]) {
            const instant = localDateTime(iso,time), before = instant.getTime();
            formatDateTime(instant); formatDate(instant,"full"); formatTime(instant);
            assert.equal(instant.getTime(), before);
            assert.equal(localISODate(instant), iso);
            const task = { fromDate:iso, fromTime:time, dueDate:iso, dueTime:time };
            assert.equal(planning.taskIsFuture(task,new Date(before-1)),true);
            assert.equal(planning.taskIsFuture(task,instant),false);
            assert.equal(planning.taskIsOverdue(task,instant),false);
            assert.equal(planning.taskIsOverdue(task,new Date(before+1)),true);
        }
        assert.equal(value.getTime(), snapshot);
        const untimed = localDateTime(iso,null);
        assert.equal(untimed.getHours(),23); assert.equal(untimed.getMinutes(),59);
        assert.equal(planning.taskIsOverdue({dueDate:iso},untimed),false);
        assert.equal(planning.taskIsOverdue({dueDate:iso},new Date(untimed.getTime()+1)),true);
    }
    console.log("PASS date presentation and unchanged local scheduling boundaries: " + process.env.TZ);
}
