"use strict";
const fs = require("fs"), path = require("path"), os = require("os"), { spawn } = require("child_process");
const directory = fs.mkdtempSync(path.join(os.tmpdir(), "athena-browser-profile-"));
const electron = require(path.resolve(__dirname, "../../atlas/tests/native/node_modules/electron"));
const env = { ...process.env, ATHENA_TEST_PROFILE: directory }; delete env.ELECTRON_RUN_AS_NODE;
const child = spawn(electron, [path.join(__dirname, "browser-runner.cjs")], { env, windowsHide: true, stdio: "inherit" });
child.on("error", error => { console.error(error); process.exitCode = 1; });
child.on("close", code => {
  const resolved = path.resolve(directory);
  if (path.dirname(resolved) !== path.resolve(os.tmpdir()) || !path.basename(resolved).startsWith("athena-browser-profile-")) throw Error("Unexpected fixture cleanup path");
  fs.rmSync(resolved, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 }); process.exitCode = code ?? 1;
});
