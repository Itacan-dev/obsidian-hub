import { _electron } from 'playwright-core';
import { createRequire } from 'node:module';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';

const require = createRequire(import.meta.url);

export function launchElectron(profile, appPath = path.resolve('build/app')) {
  const env = { ...process.env };
  delete env.ELECTRON_RUN_AS_NODE;
  return _electron.launch({
    executablePath: require('electron'),
    env,
    args: ['--user-data-dir=' + profile, appPath]
  });
}

export function setPickerPath(desktop, directory) {
  return desktop.evaluate(({ dialog }, selected) => {
    dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [selected] });
  }, directory);
}

export async function openWindow({ tmp, appCopy }, { errors, remoteRequests, timings }) {
  const desktop = await launchElectron(path.join(tmp, 'profile'), appCopy);
  try {
    const page = await desktop.firstWindow();
    page.setDefaultTimeout(8000);
    page.on('pageerror', error => {
      errors.push(error.message);
      console.error('Renderer exception:', error.message);
    });
    page.on('request', request => {
      if (/^https?:/.test(request.url())) remoteRequests.push(request.url());
    });
    await page.context().setOffline(true);
    return { desktop, page, ...controls(page, desktop, timings) };
  } catch (error) {
    await desktop.close().catch(() => {});
    throw error;
  }
}

function controls(page, desktop, timings) {
  const button = name => page.getByRole('button', { name, exact: true });
  const dialog = () => page.getByRole('dialog').last();
  const dialogButton = name => dialog().getByRole('button', { name, exact: true });
  const menuItem = name => page.getByRole('menuitem', { name, exact: true });
  return {
    button, dialog, dialogButton, menuItem,
    bounds: selector => page.locator(selector).boundingBox(),
    fileRow: name => page.getByRole('option').filter({ has: page.getByText(name, { exact: true }) }),
    treeButton: name => page.locator('.file-tree').getByRole('button', { name, exact: true }),
    heading: name => page.getByRole('heading', { name, exact: true }),
    markdownEditor: () => page.getByRole('textbox', { name: 'Markdown source' }),
    async chooseNativePath(directory, control) {
      await setPickerPath(desktop, directory);
      await button(control).click();
    },
    async screenshot(name) {
      const directory = process.env.ITACAN_TEST_SCREENSHOTS;
      if (directory) {
        await mkdir(directory, { recursive: true });
        await page.screenshot({ path: path.join(directory, name + '.png') });
      }
    },
    async nameDialog(name, action) {
      await dialog().getByLabel('Name', { exact: true }).fill(name);
      await dialogButton(action).click();
    },
    async renameItem(value) {
      const input = page.getByRole('textbox', { name: 'Item name' });
      await input.fill(value);
      await input.press('Enter');
      await input.waitFor({ state: 'hidden' });
    },
    async chooseMenuAction(control, action) {
      await control.click({ button: 'right' });
      if (['New tab', 'Right split'].includes(action)) await menuItem('Open in…').click();
      await menuItem(action).click();
    },
    async capture(text) {
      const draft = page.getByLabel('Capture text');
      await draft.fill(text);
      await draft.press('Enter');
      await page.waitForFunction(() => document.querySelector('.capture-editor textarea')?.value === '');
    },
    async measure(key, work) {
      const start = performance.now();
      await work();
      timings[key] = Math.round(performance.now() - start);
    }
  };
}

export async function closeWindow(session) {
  if (!session || session.desktop.process().exitCode !== null) return;
  await session.desktop.evaluate(({ BrowserWindow }) => {
    for (const window of BrowserWindow.getAllWindows()) window.destroy();
  }).catch(() => {});
  await session.desktop.close().catch(() => {});
}
