"use strict";
// Fixed read-only query. Only documented .NET and injected Electron APIs.
const { execFile } = require("child_process"), path = require("path");
const QUERY = `
$ErrorActionPreference='Stop'
[Console]::OutputEncoding=[Text.UTF8Encoding]::new($false)
$failures=0
$rows=@(Get-Process | ForEach-Object {
    $p=$_
    try {
        $p.Refresh()
        $h=$p.MainWindowHandle
        if($h -ne [IntPtr]::Zero) {
            $exe=$null
            $title=''
            try { $exe=$p.Path } catch { $failures++ }
            try { $title=$p.MainWindowTitle } catch { $failures++ }
            [pscustomobject]@{pid=$p.Id;handle=$h.ToInt64().ToString();title=$title;executable=$exe}
        }
    } catch { $failures++ }
})
ConvertTo-Json -InputObject @{records=$rows;failures=$failures} -Compress
`;

class OathProcessObserver {
    constructor({ getSources = null, execute = execFile, timeoutMs = 4000 } = {}) {
        this.getSources = getSources;
        this.execute = execute;
        this.timeoutMs = timeoutMs;
        this.pending = null;
        this.sourcePending = null;
        this.child = null;
        this.generation = 0;
    }
    capabilities() { return { inventory: process.platform === "win32", foreground: false, externalControls: false, complete: false }; }
    async sources() {
        if (!this.getSources || this.sourcePending) return { status: "unavailable", records: [] };
        const request = Promise.resolve().then(() => this.getSources({
            types: ["window"], thumbnailSize: { width: 0, height: 0 }, fetchWindowIcons: false
        }));
        // Retain the lease after timeout/cancellation until Electron actually settles.
        this.sourcePending = request;
        const clear = () => { if (this.sourcePending === request) this.sourcePending = null; };
        request.then(clear, clear);
        let timer;
        try {
            const records = await Promise.race([request, new Promise((_, reject) => {
                timer = setTimeout(() => reject(Error("Window source timeout")), this.timeoutMs);
            })]);
            if (!Array.isArray(records) || records.some(row => !row || typeof row.id !== "string")) throw Error("Invalid sources");
            return { status: "ok", records: records.map(({ id, name }) => ({ id, title: typeof name === "string" ? name : "" })) };
        } catch { return { status: "unavailable", records: [] }; }
        finally { clearTimeout(timer); }
    }
    listWindows() {
        if (this.pending) return this.pending;
        if (process.platform !== "win32") return Promise.reject(Error("Application observation is Windows-only."));
        const generation = this.generation;
        const primary = new Promise((resolve, reject) => {
            this.child = this.execute(path.join(process.env.SystemRoot || "C:\\Windows", "System32/WindowsPowerShell/v1.0/powershell.exe"),
                ["-NoProfile", "-NonInteractive", "-WindowStyle", "Hidden", "-Command", QUERY],
                { windowsHide: true, timeout: this.timeoutMs, maxBuffer: 1024 * 1024, encoding: "utf8" }, (error, stdout) => {
                    this.child = null;
                    if (error) { reject(Error("Application observation timed out or is unavailable.")); return; }
                    try {
                        const result = JSON.parse(stdout.replace(/^\uFEFF/, ""));
                        if (!Array.isArray(result?.records) || !Number.isInteger(result.failures) || result.failures < 0 ||
                            result.records.some(row => !row || !Number.isInteger(row.pid) || typeof row.handle !== "string" || !/^-?\d+$/.test(row.handle) || BigInt(row.handle) === 0n)) throw Error();
                        resolve(result);
                    } catch { reject(Error("Invalid application observation response.")); }
                });
        });
        this.pending = Promise.all([primary, this.sources()]).then(([result, sources]) => {
            if (generation !== this.generation) throw Error("Application observation cancelled.");
            return { records: result.records, sources, warnings: result.failures ? ["Some process or window metadata could not be read."] : [] };
        }).finally(() => { this.pending = null; });
        return this.pending;
    }
    cancel() { this.generation++; this.child?.kill(); }
}
module.exports = { OathProcessObserver };
