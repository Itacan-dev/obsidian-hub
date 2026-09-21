"use strict";

const FILE_ICONS = Object.freeze(Object.fromEntries([
    ["file-text", "md txt rtf doc docx odt"],
    ["file-type", "pdf"],
    ["file-image", "png jpg jpeg gif webp svg bmp avif"],
    ["file-music", "mp3 wav m4a flac ogg aac"],
    ["file-play", "mp4 mov mkv webm avi"],
    ["file-spreadsheet", "csv xls xlsx ods"],
    ["file-code", "js ts jsx tsx mjs cjs mts cts py pyw java c h cpp hpp cc cxx cs html htm css scss sass less json jsonc json5 yaml yml xml sh bash zsh fish ps1 bat cmd rb php go rs swift kt kts scala lua r sql toml ini conf cfg properties env vue svelte astro dockerfile makefile"],
    ["file-archive", "zip rar 7z tar gz"],
    ["presentation", "ppt pptx key"]
].flatMap(([icon, extensions]) => extensions.split(" ").map(extension => [extension, icon]))));

function fileIcon(file) {
    const value = typeof file === "string" ? file : file?.extension ?? file?.name ?? file?.path ?? "";
    const extension = String(value).split(/[\\/]/).pop().split(".").pop().toLowerCase();
    return FILE_ICONS[extension] ?? "file";
}

module.exports = { fileIcon };
