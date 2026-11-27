import assert from 'node:assert/strict';
import path from 'node:path';
import { readFile, writeFile } from 'node:fs/promises';

export async function editAndRestoreSplitDesk(session, { freshLibrary }) {
  const {
    page, button, dialogButton, menuItem, chooseMenuAction, treeButton,
    heading, markdownEditor, bounds, nameDialog, measure
  } = session;
  assert.equal((await bounds('.tabs')).y, 0);
  assert.equal(await page.locator('.desk-rail #navigation').count(), 1);
  await markdownEditor().fill('# Baseline');
  await page.keyboard.press('Control+s');
  await page.getByText('Saved', { exact: true }).waitFor();
  const file = path.join(freshLibrary, 'Projects/Experiment/Run one/Results.md');
  assert.equal(await readFile(file, 'utf8'), '# Baseline');
  await markdownEditor().fill('Local draft');
  await button('Home').click();
  await button('Last File').click();
  assert.equal(await markdownEditor().innerText(), 'Local draft');
  await writeFile(file, 'External change');
  await button('Save').click();
  await button('Save a copy').click();
  await dialogButton('Save copy').click();
  await heading('Results copy').waitFor();
  assert.equal(await readFile(file, 'utf8'), 'External change');
  assert.equal(await readFile(file.replace('.md', ' copy.md'), 'utf8'), 'Local draft');
  await treeButton('Collapse Run one').waitFor();
  await chooseMenuAction(treeButton('Results.md'), 'New tab');
  await heading('Results').waitFor();
  assert.equal(await page.locator('.document-tab').count(), 2);
  await measure('switchTab', async () => {
    await page.locator('.tabs').getByText('Results copy.md', { exact: true }).click();
    await heading('Results copy').waitFor();
  });
  await page.locator('.tabs').getByText('Results.md', { exact: true }).click();
  const tab = name => page.locator('.tabs').getByRole('button', { name, exact: true });
  await tab('Results.md').dragTo(tab('Results copy.md'), { targetPosition: { x: 2, y: 10 } });
  await page.waitForFunction(() => document.querySelector('.document-tab')?.dataset.file.endsWith('/Results.md'));
  assert.deepEqual(await page.locator('.tabs [data-path]').allTextContents(), ['Results.md', 'Results copy.md']);
  const paneBox = await bounds('.pane');
  await treeButton('Results.md').dragTo(page.locator('.pane'), { targetPosition: { x: Math.floor(paneBox.width) - 6, y: 150 } });
  await page.locator('.pane').nth(1).waitFor();
  const left = page.locator('.pane').first(), right = page.locator('.pane').nth(1);
  await left.getByRole('button', { name: 'Edit', exact: true }).click();
  await left.getByRole('textbox').fill('Shared draft');
  await right.locator('article').getByText('Shared draft').waitFor();
  await right.getByRole('button', { name: 'Edit', exact: true }).click();
  await right.getByRole('textbox').fill('Shared edit');
  assert.equal(await left.getByRole('textbox').innerText(), 'Shared edit');
  await page.keyboard.press('Control+s');
  await left.getByText('Saved', { exact: true }).waitFor();
  assert.equal(await readFile(file, 'utf8'), 'Shared edit');
  const resize = page.getByRole('separator', { name: 'Resize document split' });
  const originalWidth = (await left.boundingBox()).width;
  await resize.press('ArrowRight');
  const savedPaneWidth = (await left.boundingBox()).width;
  assert.ok(savedPaneWidth > originalWidth);
  await chooseMenuAction(right.locator('.tabs [aria-pressed=true]'), 'Split below');
  await page.locator('.pane').nth(2).waitFor();
  assert.ok(Math.abs((await left.boundingBox()).width - savedPaneWidth) < 2);
  assert.equal(await page.locator('.split-group.stacked .pane').count(), 2);
  await chooseMenuAction(page.locator('.pane').nth(2).locator('.tabs [aria-pressed=true]'), 'Close pane');
  await page.locator('.pane').nth(2).waitFor({ state: 'detached' });
  await left.locator('.tabs').getByText('Results copy.md', { exact: true }).dragTo(right.locator('.tabs'));
  await right.locator('.tabs').getByText('Results copy.md', { exact: true }).waitFor();
  await chooseMenuAction(right.locator('.tabs').getByText('Results copy.md', { exact: true }), 'Move to pane 1');
  await left.locator('.tabs').getByText('Results.md', { exact: true }).click();
  await button('Presets').click();
  await menuItem('Save as new preset').click();
  await nameDialog('Field desk', 'Save');
  await button('Presets').click();
  await chooseMenuAction(menuItem('Field desk'), 'Rename');
  await nameDialog('Review desk', 'Rename');
  await right.getByRole('textbox').fill('Draft retained by preset');
  await button('Home').click();
  await button('Presets').click();
  await menuItem('Review desk').click();
  assert.equal(await right.getByRole('textbox').innerText(), 'Draft retained by preset');
  await left.getByText('Draft retained by preset', { exact: true }).waitFor();
  await left.getByText('Unsaved changes', { exact: true }).waitFor();
  await right.getByRole('textbox').fill('Shared edit');
  return savedPaneWidth;
}

export async function restoreMediaAndReadLinkedNotes(session, { library }) {
  const {
    page, desktop, button, dialogButton, menuItem, chooseMenuAction, treeButton,
    fileRow, markdownEditor, nameDialog, chooseNativePath, measure
  } = session;
  await chooseNativePath(library, 'Fresh library');
  if (process.env.ITACAN_TEST_SCREENSHOT) {
    await page.screenshot({ path: process.env.ITACAN_TEST_SCREENSHOT });
  }
  await button('Forest survey').click();
  // Read two native document types and restore a PDF page from a mixed preset.
  await fileRow('Sampling.pdf').dblclick();
  await page.locator('.pdf-text-layer').getByText('Sampling methods').waitFor();
  await button('Next page').click();
  await page.waitForFunction(() => document.querySelector('.media-page-number')?.value === '2');
  await chooseMenuAction(treeButton('canopy.jpg'), 'Right split');
  await page.waitForFunction(() => document.querySelector('.media-image')?.naturalWidth > 0);
  await button('Presets').click();
  await menuItem('Save as new preset').click();
  await nameDialog('Mixed desk', 'Save');
  await button('Home').click();
  await button('Presets').click();
  await menuItem('Mixed desk').click();
  await page.waitForFunction(() => document.querySelector('.media-page-number')?.value === '2' && document.querySelector('.media-image')?.naturalWidth > 0);
  await chooseMenuAction(page.locator('.tabs').getByRole('button', { name: 'canopy.jpg', exact: true }), 'Close pane');
  await button('Workspace').click();
  await fileRow('Session.md').dblclick();
  await button('Live Preview').click();
  await page.locator('.cm-content .katex').waitFor();
  await page.waitForFunction(() => document.querySelector('.live-image')?.naturalWidth > 0);
  await markdownEditor().press('Control+End');
  await page.keyboard.insertText('Undo after remount');
  await chooseMenuAction(treeButton('Companion.md'), 'New tab');
  await page.locator('.tabs').getByRole('button', { name: 'Session.md', exact: true }).click();
  await markdownEditor().press('Control+z');
  assert.doesNotMatch(await markdownEditor().innerText(), /Undo after remount/);
  await markdownEditor().press('Control+Shift+z');
  assert.match(await markdownEditor().innerText(), /Undo after remount/);
  await page.getByText('Saved', { exact: true }).waitFor();
  assert.match(await readFile(path.join(library, 'Projects/Forest survey/Session.md'), 'utf8'), /Undo after remount/);
  await button('Workspace').click();
  await measure('openDocument', async () => {
    await fileRow('Field notes.md').dblclick();
    await page.locator('.katex-display').waitFor();
  });
  await page.waitForFunction(() => document.querySelector('article img')?.naturalWidth > 0);
  const readingOffset = await page.locator('.prose').evaluate(el => {
    el.scrollTop = 240;
    return el.scrollTop;
  });
  assert.ok(readingOffset > 0);
  await button('Presets').click();
  await menuItem('Save as new preset').click();
  await nameDialog('Reading position', 'Save');
  await page.locator('.prose').evaluate(el => { el.scrollTop = 0; });
  await button('Presets').click();
  await menuItem('Reading position').click();
  await page.waitForFunction(top => document.querySelector('.prose')?.scrollTop === top, readingOffset);
  await button('Home').click();
  await button('Last File').click();
  assert.equal(await page.locator('.prose').evaluate(el => el.scrollTop), readingOffset);
  await chooseMenuAction(treeButton('Companion.md'), 'New tab');
  const readingTab = page.locator('.tabs').getByRole('button', { name: 'Field notes.md', exact: true });
  const surface = page.locator('.pane'), box = await surface.boundingBox();
  await readingTab.dragTo(surface, { targetPosition: { x: Math.floor(box.width / 2), y: Math.floor(box.height) - 8 } });
  await page.waitForFunction(top => document.querySelector('.split-group.stacked .pane:last-child .prose')?.scrollTop === top, readingOffset);
  await button('Presets').click();
  await menuItem('Reading position').click();
  await page.getByRole('link', { name: 'Linked method' }).click();
  await page.locator('article #heading-method').waitFor();
  await button('Home').click();
  await button('Forest survey').click();
  await fileRow('Field notes.md').dblclick();
  await page.getByRole('link', { name: 'sampling protocol' }).click();
  await page.locator('article #heading-method').waitFor();
  await button('Edit').click();
  await page.getByRole('textbox', { name: 'Markdown source' }).fill('Quit draft');
  await desktop.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].close());
  await button('Cancel').click();
  await desktop.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].close());
  await dialogButton('Save').click();
  await Promise.all([desktop.waitForEvent('close', { timeout: 10000 }), dialogButton('Close without reporting').evaluate(b => requestAnimationFrame(() => b.click()))]);
  assert.equal(await readFile(path.join(library, 'Resources/Research/Papers/Sampling protocol.md'), 'utf8'), 'Quit draft');
}

export async function reopenWindowsAliasPreset(session, { library, fieldNote, testCaseAliases }) {
  const { page, button, menuItem } = session;
  await button('Field Library').waitFor();
  await button('Forest survey').waitFor();
  if (testCaseAliases) {
    await button('Presets').click();
    await menuItem('Legacy casing').click();
    const left = page.locator('.pane').first();
    const right = page.locator('.pane').nth(1);
    await left.getByRole('heading', { name: 'Field notes', exact: true }).waitFor();
    assert.deepEqual(await left.locator('.tabs [data-path]').allTextContents(), ['Field notes.md']);
    await right.getByRole('textbox').fill('One shared Windows draft');
    await left.locator('article').getByText('One shared Windows draft').waitFor();
    await left.locator('.note-name').click();
    await page.locator('.file-tree').getByRole('button', { name: 'Links.md', exact: true }).click();
    await left.getByRole('link', { name: 'Alternate spelling' }).click();
    await left.locator('article').getByText('One shared Windows draft').waitFor();
    assert.deepEqual(await left.locator('.tabs [data-path]').allTextContents(), ['Field notes.md']);
    await right.getByRole('button', { name: 'Close Field notes.md', exact: true }).click();
    await page.locator('.pane').nth(1).waitFor({ state: 'detached' });
    await page.waitForFunction(() => !document.querySelector('#application').inert);
    await page.keyboard.press('Control+s');
    await left.getByText('Saved', { exact: true }).waitFor();
    assert.equal(await readFile(path.join(library, fieldNote), 'utf8'), 'One shared Windows draft');
  }
}
