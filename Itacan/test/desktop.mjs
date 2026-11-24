// Run against an isolated profile and a temporary copy of the example, including when packaged.
import { _electron } from 'playwright-core';
import { createRequire } from 'node:module';
import { mkdtemp, cp, readFile, writeFile, mkdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';

const require = createRequire(import.meta.url);
const tmp = await mkdtemp(path.join(tmpdir(), 'itacan-desktop-'));
const library = path.join(tmp, 'Field Library');
const fresh = path.join(tmp, 'Fresh library');
await cp('examples/Field Library', library, { recursive: true });
await mkdir(fresh);
const packaged = process.env.ITACAN_TEST_EXECUTABLE;
const env = { ...process.env };
delete env.ELECTRON_RUN_AS_NODE;
const options = { executablePath: packaged || require('electron'), env,
  args: ['--user-data-dir=' + path.join(tmp, 'profile'), ...(packaged ? [] : [path.resolve('build/app')])] };
let desktop;
async function select(page, directory, control) {
  await desktop.evaluate(({ dialog }, selected) => {
    dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [selected] });
  }, directory);
  await page.getByRole('button', { name: control, exact: true }).click();
}
try {
  desktop = await _electron.launch(options);
  let page = await desktop.firstWindow();
  await page.context().setOffline(true);
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  const remoteRequests = [];
  page.on('request', req => { if (/^https?:/.test(req.url())) remoteRequests.push(req.url()); });
  page.setDefaultTimeout(8000);
  const btn = name => page.getByRole('button', { name, exact: true });
  await select(page, fresh, 'Choose a folder');
  await btn('Research').waitFor();
  await btn('New project').click();
  await page.getByLabel('Name', { exact: true }).fill('Experiment');
  await btn('Create').click();
  await btn('Experiment').click();
  await btn('New folder').click();
  await page.getByLabel('Name', { exact: true }).fill('Run one');
  await btn('Create').click();
  await page.getByRole('heading', { name: 'Run one' }).waitFor();
  await btn('New note').click();
  await page.getByLabel('Name', { exact: true }).fill('Results');
  await btn('Create').click();
  await page.getByRole('textbox', { name: 'Markdown source' }).fill('# Baseline');
  await btn('Save').click();
  await page.getByText('Saved', { exact: true }).waitFor();
  const file = path.join(fresh, 'Projects/Experiment/Run one/Results.md');
  assert.equal(await readFile(file, 'utf8'), '# Baseline');
  await page.getByRole('textbox', { name: 'Markdown source' }).fill('Local draft');
  await btn('Itacan Home').click();
  await btn('Cancel').click();
  const editor = page.getByRole('textbox', { name: 'Markdown source' });
  assert.equal(await editor.innerText(), 'Local draft');
  await writeFile(file, 'External change');
  await btn('Save').click();
  await btn('Save a copy').click();
  await page.getByRole('dialog').getByRole('button', { name: 'Save copy' }).click();
  await page.getByRole('heading', { name: 'Results copy' }).waitFor();
  assert.equal(await readFile(file, 'utf8'), 'External change');
  assert.equal(await readFile(file.replace('.md', ' copy.md'), 'utf8'), 'Local draft');
  await select(page, library, 'Fresh library');
  if (process.env.ITACAN_TEST_SCREENSHOT) await page.screenshot({ path: process.env.ITACAN_TEST_SCREENSHOT });
  await btn('Forest survey').click();
  await page.getByRole('button', { name: /Field notes\.md Markdown/ }).click();
  await page.locator('.katex-display').waitFor();
  await page.waitForFunction(() => document.querySelector('article img')?.naturalWidth > 0);
  await page.getByRole('link', { name: 'sampling protocol' }).click();
  await page.locator('article #heading-method').waitFor();
  await btn('Edit').click();
  await page.getByRole('textbox', { name: 'Markdown source' }).fill('Quit draft');
  await desktop.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].close());
  await btn('Cancel').click();
  await desktop.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].close());
  await Promise.all([desktop.waitForEvent('close', { timeout: 10000 }),
    page.getByRole('dialog').getByRole('button', { name: 'Save', exact: true }).click()]);
  desktop = null;
  assert.equal(await readFile(path.join(library, 'Resources/Research/Papers/Sampling protocol.md'), 'utf8'), 'Quit draft');
  desktop = await _electron.launch(options);
  page = await desktop.firstWindow();
  await btn('Field Library').waitFor();
  await btn('Forest survey').waitFor();
  assert.deepEqual(remoteRequests, []);
  assert.deepEqual(errors, []);
  console.log('Passed fresh library, create/edit/save, cancelled navigation, conflict copy, offline math/image/link, close guard and restart.');
} finally {
  try {
    if (desktop) {
      // The test may have failed mid-edit. End only this test-owned process.
      await desktop.evaluate(({ BrowserWindow }) => {
        for (const window of BrowserWindow.getAllWindows()) window.destroy();
      }).catch(() => {});
      await desktop.close().catch(() => {});
    }
  } finally { await rm(tmp, { recursive: true, force: true }); }
}
