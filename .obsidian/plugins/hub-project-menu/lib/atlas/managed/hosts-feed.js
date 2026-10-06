"use strict";
// Ported from AtlasCore extension/src/managed/hosts-feed.ts. Validation and
// source identity preserve D17's combined variant and truncation safeguards.
const { normalizeTarget, compileManagedBlacklist } = require("../core/index");
const { isIP } = require("net");
const sourceUrl = "https://raw.githubusercontent.com/StevenBlack/hosts/master/alternates/fakenews-gambling-porn-social/hosts";
const categories = ["base", "fakenews", "gambling", "porn", "social"];
const maxFeedBytes = 20_000_000, minimumDomains = 50_000;
const local = h => h === "localhost" || h === "localhost.localdomain" || h === "local" || h === "broadcasthost" || h.startsWith("ip6-") || h.endsWith(".localhost") || h.endsWith(".local");
function parseHostsFeed(text) {
    const domains = new Set(), names = new Set(); let malformedLines = 0;
    for (const line of text.split(/\r?\n/)) {
        const record = line.split("#", 1)[0].trim(); if (!record) continue;
        const fields = record.split(/\s+/), ip = fields.shift();
        if (!["0.0.0.0", "127.0.0.1", "::"].includes(ip)) {
            if (isIP((ip ?? "").split("%")[0]) === 0) malformedLines++; continue;
        }
        if (!fields.length) { malformedLines++; continue; }
        for (const field of fields) {
            if (["0.0.0.0", "127.0.0.1", "::1"].includes(field) || local(field.toLowerCase())) continue;
            names.add(field.toLowerCase().replace(/\.$/, ""));
            const hostname = normalizeTarget({ hostname: field })?.hostname;
            if (hostname && hostname.includes(".") && !local(hostname)) domains.add(hostname);
        }
    }
    const header = text.slice(0, 4000), count = /^# Number of unique domains:\s*([\d,]+)\s*$/m.exec(header)?.[1];
    const extensions = /^# Extensions added to this file:\s*(.+)$/m.exec(header)?.[1]?.split(",").map(s => s.trim()).sort().join(",");
    return { domains: [...domains], malformedLines, uniqueNames: names.size, ignoredNames: names.size - domains.size,
        declaredCount: count ? Number(count.replaceAll(",", "")) : null, upstreamDate: /^# Date:\s*(.+)$/m.exec(header)?.[1]?.trim() ?? null,
        identityValid: header.startsWith("# Title: StevenBlack/hosts ") && header.includes("# Project home page: https://github.com/StevenBlack/hosts") && extensions === "fakenews,gambling,porn,social" };
}
function validateFeed(text, previousCount = 0) {
    if (typeof text !== "string" || !text.length || Buffer.byteLength(text) > maxFeedBytes || text.includes("\0")) return null;
    const parsed = parseHostsFeed(text);
    if (!parsed.identityValid || !parsed.upstreamDate || parsed.malformedLines !== 0 || parsed.uniqueNames !== parsed.declaredCount ||
        parsed.domains.length < minimumDomains || parsed.ignoredNames > Math.max(20, parsed.uniqueNames * 0.001) || parsed.domains.length < previousCount * 0.8) return null;
    const compiled = compileManagedBlacklist(parsed.domains);
    return compiled ? { parsed, compiled } : null;
}
module.exports = { sourceUrl, categories, maxFeedBytes, minimumDomains, parseHostsFeed, validateFeed };
