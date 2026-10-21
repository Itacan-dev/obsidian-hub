"use strict";

const fs = require("fs");
const path = require("path");

const pluginRoot = __dirname;
const entryPath = path.join(pluginRoot, "plugin.js");
const nativeRoot = path.resolve(pluginRoot, "../../../ItacanTaskCore");
const inside = (root, file) => { const r = path.relative(root, file); return r !== ".." && !r.startsWith(".." + path.sep) && !path.isAbsolute(r); };
// Build current sources into a disposable profile without replacing installed bundles.
const outputFlag = process.argv.indexOf("--output-dir");
if (outputFlag >= 0 && !process.argv[outputFlag + 1]) throw Error("--output-dir requires a directory");
const outputDirectory = outputFlag < 0 ? pluginRoot : path.resolve(process.argv[outputFlag + 1]);
fs.mkdirSync(outputDirectory, { recursive: true });
const outputPath = path.join(outputDirectory, "main.js");
const modules = new Map();
// Refuse a stale or hand-edited Core artifact. Rebuilding Hub UI still needs
// only Node; modifying Core first requires its normal TypeScript compiler.
const atlasCore = path.join(pluginRoot, "lib/atlas/core"), coreSource = path.resolve(pluginRoot, "../../../AtlasCore/packages/core");
const atlasManifest = JSON.parse(fs.readFileSync(path.join(atlasCore, "build-manifest.json"), "utf8"));
// Git may check these text files out as CRLF on Windows. Match the compiler's
// canonical LF hashes without treating checkout line endings as source edits.
const atlasHash = file => require("crypto").createHash("sha256").update(fs.readFileSync(file, "utf8").replace(/\r\n/g, "\n")).digest("hex");
const atlasStale = atlasManifest.schemaVersion !== 1 || atlasManifest.builder !== atlasHash(path.join(pluginRoot, "build-atlas.js")) ||
    atlasManifest.configuration !== atlasHash(path.join(coreSource, "tsconfig.json")) ||
    JSON.stringify(Object.keys(atlasManifest.sources)) !== JSON.stringify(fs.readdirSync(path.join(coreSource, "src")).filter(name => name.endsWith(".ts")).sort()) ||
    Object.entries(atlasManifest.sources).some(([name, hash]) => atlasHash(path.join(coreSource, "src", name)) !== hash) ||
    Object.entries(atlasManifest.artifacts).some(([name, hash]) => atlasHash(path.join(atlasCore, name)) !== hash);
if (atlasStale) throw new Error("AtlasCore artifacts are stale. Run node .obsidian/plugins/hub-project-menu/build-atlas.js first.");
const presetPath = path.join(pluginRoot, "lib/atlas/presets/curated-whitelist");
const presetManifest = JSON.parse(fs.readFileSync(path.join(path.dirname(presetPath), "build-manifest.json"), "utf8"));
if (presetManifest.source !== atlasHash(presetPath + ".ts") || presetManifest.javascript !== atlasHash(presetPath + ".js") ||
    presetManifest.declarations !== atlasHash(presetPath + ".d.ts")) throw new Error("Curated preset is stale. Run build-atlas.js.");

function moduleId(filePath) {
    return path.relative(pluginRoot, filePath)
        .split(path.sep)
        .join("/");
}

function resolveLocalModule(fromPath, request) {
    const unresolved = path.resolve(
        path.dirname(fromPath),
        request
    );

    const candidates = [
        unresolved,
        `${unresolved}.js`,
        path.join(unresolved, "index.js")
    ];

    const resolved = candidates.find(candidate =>
        fs.existsSync(candidate) &&
        fs.statSync(candidate).isFile()
    );

    if (!resolved) {
        throw new Error(
            `Cannot resolve ${request} from ${moduleId(fromPath)}.`
        );
    }

    const relative = path.relative(pluginRoot, resolved);

    if (
        !inside(pluginRoot, resolved) && !inside(nativeRoot, resolved)
    ) {
        throw new Error(
            `Local module escapes the plugin directory: ${request}`
        );
    }

    return resolved;
}

function collectModule(filePath) {
    const id = moduleId(filePath);

    if (modules.has(id)) {
        return id;
    }

    modules.set(id, null);

    let source = fs.readFileSync(filePath, "utf8");
    // Resolve only the two reviewed sibling-import closures at build time.
    if (["integration/project-runtime.js", "integration/completion-feed.js"].some(name => filePath === path.join(nativeRoot, name))) {
        source = source.replace(/require\((?:pluginRoot|lib) \+ (["'])([^"']+)\1\)/g,
            (_match, _quote, suffix) => `require(${JSON.stringify("../../.obsidian/plugins/hub-project-menu/lib/" + suffix)})`);
    }
    const transformed = source.replace(
        /require\(\s*(["'])(\.\.?\/[^"']+)\1\s*\)/g,
        (_match, _quote, request) => {
            const dependency = resolveLocalModule(
                filePath,
                request
            );

            return `__hubRequire(${JSON.stringify(
                collectModule(dependency)
            )})`;
        }
    );

    modules.set(id, transformed);
    return id;
}

function buildBundle(entryPath, outputPath) {
modules.clear();
const entryId = collectModule(entryPath);
const factories = [...modules.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([id, source]) =>
        `${JSON.stringify(id)}: function (module, exports, __hubRequire) {\n${source}\n}`
    )
    .join(",\n");

const bundle = `"use strict";

/*
 * Generated by build.js from source modules.
 * Edit the source modules, then rebuild; do not edit this file directly.
 */

const __hubModules = {
${factories}
};

const __hubModuleCache = Object.create(null);

function __hubRequire(id) {
    const cached = __hubModuleCache[id];

    if (cached) {
        return cached.exports;
    }

    const factory = __hubModules[id];

    if (!factory) {
        throw new Error(\`Unknown bundled Hub module: \${id}\`);
    }

    const bundledModule = { exports: {} };
    __hubModuleCache[id] = bundledModule;
    factory(
        bundledModule,
        bundledModule.exports,
        __hubRequire
    );

    return bundledModule.exports;
}

module.exports = __hubRequire(${JSON.stringify(entryId)});
`;

// Keep the existing distributed bundles' CRLF convention across source checkouts.
fs.writeFileSync(outputPath, bundle.replace(/\r?\n/g, "\r\n"), "utf8");

console.log(
    `Built ${path.basename(outputPath)} with ${modules.size} modules.`
);
}

buildBundle(entryPath, outputPath);
buildBundle(path.join(pluginRoot, "lib/atlas/obsidian/native.js"),
    path.join(outputDirectory, "atlas-native.cjs"));

// Obsidian's main-process bridge loads these modules by path, outside main.js.
// Ship an explicit production-only closure, including the sandbox preload/assets.
const strictAssets = ["lib/services/oath-strict-host.js", "lib/services/oath-strict.js", "lib/services/oath-process-observer.js",
    "lib/services/oath-dock.js", "lib/domain/oath-strict.js", "lib/ui/oath-dock/preload.cjs", "lib/ui/oath-dock/index.html",
    "lib/ui/oath-dock/dock.js", "lib/ui/oath-dock/dock.css"];
const strictManifest = {};
for (const relative of strictAssets) {
    const source = path.join(pluginRoot, relative), target = path.join(outputDirectory, relative);
    const content = fs.readFileSync(source);
    if (source !== target) { fs.mkdirSync(path.dirname(target), { recursive: true }); fs.writeFileSync(target, content); }
    strictManifest[relative] = require("crypto").createHash("sha256").update(content).digest("hex");
}
fs.writeFileSync(path.join(outputDirectory, "strict-oath-assets.json"), JSON.stringify({ schemaVersion: 1, files: strictManifest }, null, 2));
