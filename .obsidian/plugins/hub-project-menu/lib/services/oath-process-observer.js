"use strict";
// Fixed read-only PowerShell/.NET query. No interpolated user input, Win32 interop,
// input injection, native addons, or external-window control.
const { execFile } = require("child_process"), path = require("path");
const QUERY = `$ErrorActionPreference='Stop'; [Console]::OutputEncoding=[Text.UTF8Encoding]::new($false); $rows=@(Get-Process | ForEach-Object { $p=$_; try { $p.Refresh(); $h=$p.MainWindowHandle; if($h -ne [IntPtr]::Zero) { $exe=$null; try { $exe=$p.Path } catch {}; [pscustomobject]@{pid=$p.Id;handle=$h.ToInt64().ToString();title=$p.MainWindowTitle;executable=$exe} } } catch {} }); ConvertTo-Json -InputObject $rows -Compress`;
class OathProcessObserver {
    constructor() { this.pending = null; this.child = null; }
    capabilities() { return { inventory: process.platform === "win32", foreground: false, externalControls: false, complete: false }; }
    listWindows() {
        if (this.pending) return this.pending;
        if (process.platform !== "win32") return Promise.reject(Error("Application observation is Windows-only."));
        this.pending = new Promise((resolve, reject) => {
            this.child = execFile(path.join(process.env.SystemRoot || "C:\\Windows", "System32/WindowsPowerShell/v1.0/powershell.exe"),
                ["-NoProfile", "-NonInteractive", "-WindowStyle", "Hidden", "-Command", QUERY],
                { windowsHide: true, timeout: 4000, maxBuffer: 1024 * 1024, encoding: "utf8" }, (error, stdout) => {
                    this.child = null;
                    if (error) { reject(Error("Application observation timed out or is unavailable.")); return; }
                    try { const rows = JSON.parse(stdout.replace(/^\uFEFF/, "")); if (!Array.isArray(rows)) throw Error(); resolve(rows); }
                    catch { reject(Error("Invalid application observation response.")); }
                });
        }).finally(() => { this.pending = null; });
        return this.pending;
    }
    cancel() { this.child?.kill(); } // only our own read-only query, never an external application
}
module.exports = { OathProcessObserver };
