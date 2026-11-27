import assert from 'node:assert/strict';
import path from 'node:path';
import { readFile, writeFile, stat } from 'node:fs/promises';

export async function openHomeAndCreateWorkspace(session, { freshLibrary }) {
  const {
    page, desktop, button, chooseMenuAction, fileRow, bounds, nameDialog,
    renameItem, chooseNativePath, measure, screenshot
  } = session;
  await chooseNativePath(freshLibrary, 'Choose a folder');
  await button('Literature').waitFor();
  const fullscreen = () => desktop.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].isFullScreen());
  assert.equal(await fullscreen(), false);
  assert.equal(await desktop.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].isMaximized()), true);
  for (const expected of [true, false]) {
    await desktop.evaluate(({ BrowserWindow }) => {
      const win = BrowserWindow.getAllWindows()[0];
      win.focus();
      win.webContents.focus();
      for (const type of ['keyDown', 'keyUp']) {
        win.webContents.sendInputEvent({ type, keyCode: 'F11' });
      }
    });
    for (let i = 0; i < 25 && await fullscreen() !== expected; i++) {
      await new Promise(done => setTimeout(done, 40));
    }
    assert.equal(await fullscreen(), expected);
  }
  assert.deepEqual(await page.locator('.home-panels > section:nth-child(-n+3) h2').allTextContents(), ['Calendar', 'Plan', 'Tasks']);
  const agenda = page.locator('.calendar-agenda');
  const daysShown = await agenda.locator('.agenda-day').count();
  const calendarBox = await bounds('.calendar-panel');
  await agenda.evaluate(el => { el.scrollTop = el.scrollHeight; });
  await page.waitForFunction(n => document.querySelectorAll('.agenda-day').length === n + 7, daysShown);
  await button('Today').click();
  assert.deepEqual(await bounds('.calendar-panel'), calendarBox);
  assert.equal(await page.locator('.dashboard-cover + #navigation').count(), 1);
  assert.equal(await page.locator('.home-section.panel .resource-grid').count(), 1);
  await button('New project').click();
  await nameDialog('Experiment', 'Create');
  await screenshot('home');
  await button('Experiment').scrollIntoViewIfNeeded();
  const resourceBounds = await bounds('.resource-grid');
  await chooseMenuAction(button('Experiment'), 'Move to Future');
  assert.deepEqual(await bounds('.resource-grid'), resourceBounds);
  await button('Future (1)').click();
  await chooseMenuAction(button('Experiment'), 'Move to Active');
  await button('Active (1)').click();
  const navigationBounds = await bounds('#navigation');
  await measure('openWorkspace', async () => {
    await button('Experiment').click();
    await button('New folder').waitFor();
  });
  assert.deepEqual(await bounds('#navigation'), navigationBounds);
  const fileBounds = await bounds('.files');
  assert.equal(await button('New note').isDisabled(), true);
  assert.deepEqual(await page.locator('.workspace-work h2').allTextContents(), ['Files', 'Tasks', 'Progress']);
  await button('New folder').click();
  await renameItem('Run one');
  await fileRow('Run one').dblclick();
  assert.deepEqual(await bounds('.files'), fileBounds);
  await button('New note').click();
  await renameItem('Results');
  await fileRow('Results.md').dblclick();
  await button('Edit').click();
}

export async function selectAndCopyWorkspaceFiles(session, { freshLibrary }) {
  const { page, button, fileRow, screenshot } = session;
  await button('Workspace').click();
  await fileRow('Results.md').click();
  assert.equal(await fileRow('Results.md').getAttribute('aria-selected'), 'true');
  await fileRow('Results copy.md').click({ modifiers: ['Control'] });
  assert.equal(await page.locator('.file-row[aria-selected=true]').count(), 2);
  await screenshot('workspace');
  await fileRow('Results copy.md').click();
  await fileRow('Results copy.md').press('Control+c');
  await page.locator('.folder-crumbs').getByText('Experiment').click();
  await fileRow('Run one').press('Control+v');
  await fileRow('Results copy.md').waitFor();
  assert.equal(await readFile(path.join(freshLibrary, 'Projects/Experiment/Results copy.md'), 'utf8'), 'Local draft');
  await fileRow('Run one').dblclick();
  await button('Modified').click();
  await page.getByRole('separator', { name: 'Folder navigation width' }).press('ArrowRight');
}

export async function reorderProjectsAndMoveFolders(session, { freshLibrary }) {
  const { page, button, fileRow, nameDialog, renameItem } = session;
  await button('Home').click();
  await button('New project').click();
  await nameDialog('Interaction lab', 'Create');
  const labCard = button('Interaction lab');
  await labCard.waitFor();
  await labCard.dragTo(button('Experiment'), { targetPosition: { x: 3, y: 24 } });
  await page.waitForFunction(() => document.querySelector('.project-grid .collection-card')?.dataset.path === 'Projects/Interaction lab');
  await labCard.click();
  const labPath = path.join(freshLibrary, 'Projects', 'Interaction lab');
  for (const name of ['Papers', 'Drafts']) {
    await button('New folder').click();
    await renameItem(name);
  }
  const folderControl = name => page.locator('.tree-rows').getByRole('button', { name, exact: true });
  await folderControl('Papers').hover();
  await folderControl('Reorder Papers').dragTo(folderControl('Drafts'), { targetPosition: { x: 12, y: 2 } });
  await page.waitForFunction(() => document.querySelector('.tree-rows [data-root]')?.dataset.root.endsWith('/Papers'));
  for (const name of ['One', 'Two']) {
    await writeFile(path.join(labPath, 'Drafts', name + '.md'), name);
  }
  await fileRow('Drafts').dblclick();
  await fileRow('One.md').click();
  await fileRow('Two.md').click({ modifiers: ['Control'] });
  await fileRow('One.md').dragTo(folderControl('Papers'));
  await fileRow('One.md').waitFor({ state: 'detached' });
  for (const name of ['One', 'Two']) {
    assert.equal(await readFile(path.join(labPath, 'Papers', name + '.md'), 'utf8'), name);
    await assert.rejects(readFile(path.join(labPath, 'Drafts', name + '.md')), { code: 'ENOENT' });
  }
  await folderControl('Drafts').dragTo(folderControl('Papers'));
  await page.waitForFunction(() => !document.querySelector('.tree-rows [data-root="Projects/Interaction lab/Drafts"]'));
  await assert.rejects(stat(path.join(labPath, 'Drafts')), { code: 'ENOENT' });
  assert.ok((await stat(path.join(labPath, 'Papers', 'Drafts'))).isDirectory());
  await button('Home').click();
  assert.match(await page.locator('.project-grid .collection-card').first().textContent(), /Interaction lab/);
}
