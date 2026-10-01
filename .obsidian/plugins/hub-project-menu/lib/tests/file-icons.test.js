"use strict";
const assert = require("assert/strict");
const { fileIcon } = require("../ui/file-icons");
const groups = {
    "file-text": "pdf txt rtf doc docx odt", "notebook-text": "md",
    "file-image": "png jpg jpeg gif webp svg bmp avif", "file-music": "mp3 wav m4a flac ogg aac",
    "file-play": "mp4 mov mkv webm avi", "file-spreadsheet": "csv xls xlsx ods",
    "file-code": "js ts jsx tsx py java c cpp html css scss json yaml yml xml sh toml rs go ps1",
    "file-archive": "zip rar 7z tar gz", "presentation": "ppt pptx key"
};
for (const [icon, extensions] of Object.entries(groups)) for (const extension of extensions.split(" ")) {
    assert.equal(fileIcon({ extension }), icon);
    assert.equal(fileIcon({ extension: extension.toUpperCase() }), icon);
    assert.equal(fileIcon(`folder.with.dots/a.${extension}`), icon);
}
for (const value of [null, {}, { extension: "" }, "unknown.xyz", "README"]) assert.equal(fileIcon(value), "file");
assert.equal(fileIcon("archive.tar.gz"), "file-archive");
assert.equal(fileIcon({ extension: "md", basename: "Course information" }), "notebook-text");
assert.equal(fileIcon({ extension: "pdf", name: "Lecture plan.md" }), "file-text", "Underlying extension takes precedence over a display name");
console.log("File icon checks passed: all requested types, PDF file-text and Markdown notebook-text, case-insensitive extensions and unknown fallback.");
