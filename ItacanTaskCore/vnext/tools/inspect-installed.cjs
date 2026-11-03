"use strict";
// Read-only inspection of the installed bootstrap archive.
const fs = require('node:fs'), path = require('node:path');
const file = path.join(process.env.LOCALAPPDATA, 'Programs/obsidian/resources/app.asar');
const bytes = fs.readFileSync(file), size = bytes.readUInt32LE(4), length = bytes.readUInt32LE(12);
const header = JSON.parse(bytes.subarray(16, 16 + length));
for (const [name, entry] of Object.entries(header.files)) {
 if (entry.files || !/\.(js|json)$/.test(name)) continue;
 console.log('FILE', name);
 console.log(bytes.subarray(8 + size + Number(entry.offset), 8 + size + Number(entry.offset) + entry.size).toString());
}
