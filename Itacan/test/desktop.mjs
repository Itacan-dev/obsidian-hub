// Run against an isolated profile and a temporary copy of the example, including when packaged.
import { _electron } from 'playwright-core';
import { createRequire } from 'node:module';
import { mkdtemp, cp, appendFile, readFile, writeFile, mkdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';

const require = createRequire(import.meta.url);
const tmp = await mkdtemp(path.join(tmpdir(), 'itacan-desktop-'));
const library = path.join(tmp, 'Field Library');
const fresh = path.join(tmp, 'Fresh library');
await cp('examples/Field Library', library, { recursive: true });
await appendFile(path.join(library,'Projects/Forest survey/Field notes.md'),
  '\n[[../../Resources/Research/Papers/Sampling protocol#Method|Wiki method]]\n');
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
  const started = performance.now();
  desktop = await _electron.launch(options);
  const errors = [];
  const remoteRequests = [];
  async function testWindow() {
    const page = await desktop.firstWindow();
    page.setDefaultTimeout(8000);
    page.on('pageerror', error => errors.push(error.message));
    page.on('request', request => { if (/^https?:/.test(request.url())) remoteRequests.push(request.url()); });
    await page.context().setOffline(true);
    return page;
  }
  let page = await testWindow();
  const btn = name => page.getByRole('button', { name, exact: true });
  await btn('Choose a folder').waitFor();
  const timings = {launchToHome: Math.round(performance.now()-started)};
  async function measure(key,work) {
    const start = performance.now();
    await work();
    timings[key] = Math.round(performance.now()-start);
  }
  const dialog = () => page.getByRole('dialog').last();
  const db = name => dialog().getByRole('button',{name,exact:true});
  await select(page, fresh, 'Choose a folder');
  await btn('Research').waitFor();
  await btn('New project').click();
  await page.getByLabel('Name', { exact: true }).fill('Experiment');
  await btn('Create').click();
  await measure('openWorkspace',async () => { await btn('Experiment').click(); await btn('New note').waitFor(); });
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
  await btn('Resume documents').click();
  const editor = page.getByRole('textbox', { name: 'Markdown source' });
  assert.equal(await editor.innerText(), 'Local draft');
  await writeFile(file, 'External change');
  await btn('Save').click();
  await btn('Save a copy').click();
  await page.getByRole('dialog').getByRole('button', { name: 'Save copy' }).click();
  await page.getByRole('heading', { name: 'Results copy' }).waitFor();
  assert.equal(await readFile(file, 'utf8'), 'External change');
  assert.equal(await readFile(file.replace('.md', ' copy.md'), 'utf8'), 'Local draft');
  await measure('switchTab',async () => {
    await page.locator('.tabs').getByRole('button',{name:'Results.md',exact:true}).click();
    await page.getByRole('heading',{name:'Results',exact:true}).waitFor();
  });
  await btn('Split view').click();
  const left = page.locator('.pane').first();
  const right = page.locator('.pane').last();
  await left.getByRole('button',{name:'Edit',exact:true}).click();
  await left.getByRole('textbox').fill('Shared draft');
  await right.locator('article').getByText('Shared draft').waitFor();
  await right.getByRole('button',{name:'Edit',exact:true}).click();
  await right.getByRole('textbox').fill('Shared edit');
  assert.equal(await left.getByRole('textbox').innerText(),'Shared edit');
  await right.getByRole('button',{name:'Save',exact:true}).click();
  await left.getByText('Saved',{exact:true}).waitFor();
  assert.equal(await readFile(file,'utf8'),'Shared edit');
  await btn('Save layout').click();
  await page.getByLabel('Name',{exact:true}).fill('Field desk');
  await db('Create').click();
  await page.locator('#breadcrumbs').getByRole('button',{name:'Run one'}).click();

  await btn('New task').click();
  await page.getByLabel('Title',{exact:true}).fill('Review results');
  await db('Choose note or folder').click();
  await db('Run one').click(); await db('Results.md').click(); await db('Choose').click();
  await db('Add step').click();
  await page.getByLabel('Step text').fill('Check baseline');
  await db('Save task').click();
  await btn('Review results').waitFor();

  await measure('openQuickAdd',async () => { await btn('Quick Add').click(); await page.getByLabel('Capture text').waitFor(); });
  await page.getByLabel('Capture text').fill('Collect sample');
  await db('Send to Inbox').click();
  await btn('Inbox').click(); await db('Create task').click(); await db('Save task').click();
  await db('Done').click();
  await btn('Collect sample').waitFor();
  await btn('Quick Add').click(); await page.getByLabel('Capture text').fill('Local abstract');
  await db('Send to Inbox').click();
  await btn('Inbox').click(); await db('Create note').click(); await db('Experiment').click();
  await db('Choose').click(); await page.getByLabel('Name',{exact:true}).fill('Abstract'); await db('Create').click();
  await dialog().getByText('No captures to show.').waitFor(); await db('Done').click();
  assert.equal(await readFile(path.join(fresh,'Projects/Experiment/Abstract.md'),'utf8'),'Local abstract');

  const attachment = path.join(tmp,'Dataset.pdf');
  await writeFile(attachment,'sample bytes');
  await btn('Quick Add').click(); await select(page,attachment,'Capture files…');
  await btn('Inbox').click(); await db('File attachment').click(); await db('Experiment').click(); await db('Choose').click();
  await dialog().getByText('No captures to show.').waitFor(); await db('Done').click();
  assert.equal(await readFile(path.join(fresh,'Projects/Experiment/Dataset.pdf'),'utf8'),'sample bytes');

  await btn('Plan').click(); await db('Start today’s plan').click();
  await db('Add task').click(); await page.getByLabel('Task',{exact:true}).selectOption({label:'Review results'}); await db('Add').click();
  await db('Add document').click(); await db('Experiment').click(); await db('Run one').click();
  await db('Results.md').click(); await db('Choose').click();
  await db('Add workspace').click(); await page.getByLabel('Workspace',{exact:true}).selectOption('Projects/Experiment'); await db('Add').click();
  await dialog().locator('.plan-list li').nth(1).getByRole('button',{name:'Up',exact:true}).click();
  await page.getByLabel('Plan notes').fill('Repeat the measurements');
  await db('Done').click();
  await btn('Manage Results.md').click(); await db('Rename').click();
  await page.getByLabel('Name',{exact:true}).fill('Field results.md'); await db('Rename').click();
  await btn('Manage Field results.md').waitFor();

  await btn('Itacan Home').click();
  const taskRow = page.locator('.task-row').filter({hasText:'Review results'});
  await measure('completeTask', async () => {
    await taskRow.getByRole('button',{name:'Complete'}).click();
    await taskRow.waitFor({state:'hidden'});
  });
  await btn('Field desk').click();
  await left.getByRole('heading',{name:'Field results',exact:true}).waitFor();
  assert.equal(await right.getByRole('textbox').innerText(),'Shared edit');
  await btn('Plan').click();
  assert.match(await dialog().locator('.plan-list li').first().innerText(),/Field results.md/);
  await db('Reopen').waitFor();
  await db('Field results.md').click();
  await right.getByRole('heading',{name:'Field results',exact:true}).waitFor();
  await btn('Plan').click(); await db('Finish plan').click(); await db('Finish').click();
  await dialog().getByText('Daily history',{exact:true}).waitFor(); await db('Done').click();

  await Promise.all([desktop.waitForEvent('close',{timeout:10000}),
    desktop.evaluate(({BrowserWindow}) => BrowserWindow.getAllWindows()[0].close())]);
  desktop = await _electron.launch(options);
  page = await testWindow();
  await btn('Field desk').waitFor(); await btn('Plan').click();
  await dialog().locator('summary').click(); await dialog().getByText('Repeat the measurements').waitFor();
  await db('Done').click();
  await btn('Experiment').click();
  await btn('Manage Abstract.md').click(); await db('Move').click(); await db('Research').click(); await db('Choose').click();
  await btn('Manage Abstract.md').waitFor({state:'hidden'});
  const moved = path.join(fresh,'Resources/Research/Abstract.md');
  assert.equal(await readFile(moved,'utf8'),'Local abstract');
  await btn('Quick Add').click(); await page.getByLabel('Capture text').fill('Follow-up');
  await db('Add to note').click(); await db('Research').click(); await db('Abstract.md').click(); await db('Choose').click();
  await page.getByRole('dialog').waitFor({state:'hidden'});
  assert.equal(await readFile(moved,'utf8'),'Local abstract\n\nFollow-up');
  await btn('Itacan Home').click(); await btn('Research').click();
  await btn('Manage Abstract.md').click(); await db('Delete').click(); await db('Delete').click();
  await btn('Manage Abstract.md').waitFor({state:'hidden'});
  await assert.rejects(readFile(moved),{code:'ENOENT'});
  await select(page, library, 'Fresh library');
  if (process.env.ITACAN_TEST_SCREENSHOT) await page.screenshot({ path: process.env.ITACAN_TEST_SCREENSHOT });
  await btn('Forest survey').click();
  await page.getByRole('button', { name: /Field notes\.md Markdown/ }).click();
  await page.locator('.katex-display').waitFor();
  await page.waitForFunction(() => document.querySelector('article img')?.naturalWidth > 0);
  await page.getByRole('link', { name: 'Wiki method' }).click();
  await page.locator('article #heading-method').waitFor();
  await page.locator('.tabs').getByRole('button',{name:'Field notes.md',exact:true}).click();
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
  page = await testWindow();
  await btn('Field Library').waitFor();
  await btn('Forest survey').waitFor();
  assert.deepEqual(remoteRequests, []);
  assert.deepEqual(errors, []);
  console.log('Passed offline workspace, split editing, layouts, conflict copy, task, capture, Plan, rename, history and restart workflows.',timings);
} catch (error) {
  const page = desktop?.windows().at(-1);
  if (page) console.error(await page.locator('dialog[open], #message:not([hidden])').allTextContents().catch(() => []));
  throw error;
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
