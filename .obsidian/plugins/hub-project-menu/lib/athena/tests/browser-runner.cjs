"use strict";
const { app, BrowserWindow, session } = require("electron");
const path = require("path"), fs = require("fs"), os = require("os");
const profile = path.resolve(process.env.ATHENA_TEST_PROFILE || "");
if (path.dirname(profile) !== path.resolve(os.tmpdir()) || !path.basename(profile).startsWith("athena-browser-profile-")) throw Error("Unexpected fixture profile");
app.setPath("userData", profile); app.disableHardwareAcceleration();
app.whenReady().then(async () => {
  const root = path.resolve(__dirname, ".."); let forbidden = 0;
  session.defaultSession.webRequest.onBeforeRequest({ urls: ["http://*/*", "https://*/*"] }, (_details, callback) => { forbidden++; callback({ cancel: true }); });
  const win = new BrowserWindow({ show: false, width: 700, height: 1000, webPreferences: { nodeIntegration: true, contextIsolation: false, backgroundThrottling: false, offscreen: true } });
  const timer = setTimeout(() => { console.error("Athena browser fixture timed out"); app.exit(1); }, 60000);
  try {
    await win.loadURL("about:blank");
    const result = await win.webContents.executeJavaScript(`require(${JSON.stringify(path.join(root, ".cache/browser.cjs"))}).run(${JSON.stringify(root)})`);
    if (!String(result).startsWith("PASS") || forbidden) throw Error(`Fixture failed or attempted ${forbidden} forbidden network requests`);
    const screenshot = await win.webContents.capturePage(); fs.writeFileSync(path.join(root, ".cache/sidebar-verified.png"), screenshot.toPNG());
    console.log(result); clearTimeout(timer); win.destroy(); app.exit(0);
  } catch (error) { console.error(error); clearTimeout(timer); win.destroy(); app.exit(1); }
}).catch(error => { console.error(error); app.exit(1); });
