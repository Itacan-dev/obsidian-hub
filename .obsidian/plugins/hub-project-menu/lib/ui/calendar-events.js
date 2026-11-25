"use strict";

const { localISODate, formatTime } = require("../domain/dates");

const queries = new WeakMap();

function calendarQuery(provider, from, to) {
    let ranges = queries.get(provider);
    if (!ranges) queries.set(provider, ranges = new Map());
    const key = from.format("YYYY-MM-DD") + "/" + to.format("YYYY-MM-DD");
    const cached = ranges.get(key);
    if (cached && (cached.result === undefined && !cached.failed || Date.now() < cached.expires)) return cached;
    const query = { failed: false, expires: 0 };
    ranges.set(key, query);
    while (ranges.size > 24) ranges.delete(ranges.keys().next().value);
    query.promise = Promise.resolve().then(() => provider.runQuery({
        from: from.clone().startOf("day"), to: to.clone().endOf("day"),
        view: "agenda", group: "none", calendars: [], excludeCalendars: [],
        accounts: [], excludeAccounts: [], fields: ["time", "title"], columns: ["date", "time", "title"],
        limit: 100, hiddenTitles: [], allDay: "include", hideDeclined: true, hideCancelled: true,
        use24HourTime: true, dateHeadingFormat: "dddd, D MMMM YYYY", tableDateFormat: "DD/MM/YYYY",
        descriptionLength: 0, emptyMessage: "Nothing scheduled.", refresh: 0, showRefreshButton: false
    })).then(result => {
        query.result = result;
        query.expires = Date.now() + 60000;
        return result;
    }, error => {
        query.failed = true;
        throw error;
    });
    return query;
}

function queryCalendarEvents(provider, from, to) {
    return calendarQuery(provider, from, to).promise;
}

function renderCalendarEvent(parent, event) {
    const row = parent.createDiv({ cls: "home-calendar-row hub-calendar-event" });
    row.createSpan({ cls: "home-calendar-time", text: event.allDay ? "All day" : formatTime(event.start) });
    const details = row.createDiv({ cls: "home-calendar-info" });
    details.createSpan({ cls: "home-calendar-title", text: event.title, attr: { title: event.title } });
    if (event.location) details.createDiv({ cls: "home-calendar-location", text: event.location });
}

function createCalendarEventReader(app, win, changed) {
    let current, disposed = false;
    return {
        read(days) {
            const provider = app.plugins?.plugins?.["google-calendar-agenda"];
            if (!provider?.runQuery || !win.moment) return { days: new Map(), message: "External calendar unavailable." };
            const from = localISODate(days[0]), to = localISODate(days.at(-1));
            const key = from + "/" + to;
            if (current?.key === key && current.provider === provider) return current;
            const result = current = { key, provider, days: new Map(), message: "Loading calendar events…" };
            const weeks = [];
            for (let index = 0; index < days.length; index += 7) {
                weeks.push([days[index], days[Math.min(index + 6, days.length - 1)]]);
            }
            const requested = weeks.map(([start, end]) =>
                calendarQuery(provider, win.moment(localISODate(start)), win.moment(localISODate(end))));
            function receive(responses, loading = false) {
                if (disposed || current !== result) return;
                result.days.clear();
                const messages = new Set(), events = [];
                for (const response of responses) {
                    if (response.status === "rejected") messages.add("Some calendar events could not be loaded.");
                    else {
                        for (const warning of response.value.warnings ?? []) messages.add(String(warning));
                        events.push(...(response.value.events ?? []));
                    }
                }
                result.message = [...messages].join(" ") || (loading ? "Loading calendar events…" : "");
                events.sort((a, b) => a.start.valueOf() - b.start.valueOf());
                for (const event of events) {
                    const date = event.start.format("YYYY-MM-DD");
                    if (!result.days.has(date)) result.days.set(date, []);
                    result.days.get(date).push(event);
                }
            }
            const cached = requested.filter(query => query.result !== undefined);
            receive(cached.map(query => ({ status: "fulfilled", value: query.result })), cached.length < requested.length);
            if (cached.length === requested.length) return result;
            Promise.allSettled(requested.map(query => query.promise)).then(responses => {
                receive(responses);
                if (!disposed && current === result) changed();
            }).catch(() => {
                if (disposed || current !== result) return;
                result.message = "Calendar events could not be loaded.";
                changed();
            });
            return result;
        },
        reset() { current = null; },
        dispose() { disposed = true; current = null; }
    };
}

module.exports = { queryCalendarEvents, renderCalendarEvent, createCalendarEventReader };
