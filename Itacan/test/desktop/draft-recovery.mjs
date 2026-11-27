import assert from 'node:assert/strict';
import path from 'node:path';
import { readFile } from 'node:fs/promises';

export async function searchAndInterruptUnsavedDraft(session, { library }) {
  const { page, desktop, button, dialogButton, markdownEditor, dialog } = session;
  if (!await button('Home').isDisabled()) {
    await button('Home').click();
  }
  await button('Settings').click();
  await dialogButton('Editing').click();
  await dialog().getByLabel('Saving', { exact: true }).selectOption('manual');
  await dialogButton('Save settings').click();
  await button('Forest survey').click();
  await page.getByLabel('Search scope', { exact: true }).selectOption('folder');
  await page.getByRole('combobox', { name: 'Search current folder' }).fill('Undo after remount');
  await page.getByRole('option', { name: /Session.md.*Undo after remount/ }).click();
  const selectedLine = await markdownEditor().evaluate(() => window.getSelection()?.toString());
  assert.match(selectedLine, /Undo after remount/);
  await markdownEditor().fill('Recovered offline field observations');
  const sessionFile = 'Projects/Forest survey/Session.md';
  await page.waitForFunction(async (file) => {
    const { library } = await window.itacan.home();
    return (await window.itacan.getDraft(library.session, file))?.text === 'Recovered offline field observations';
  }, sessionFile);
  assert.doesNotMatch(await readFile(path.join(library, sessionFile), 'utf8'), /Recovered offline/);
  await Promise.all([desktop.waitForEvent('close'), desktop.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].destroy())]);
}

export async function recoverAndSaveAfterRestart(session, { library }) {
  const { page, button, fileRow } = session;
  const sessionFile = 'Projects/Forest survey/Session.md';
  await button('Forest survey').click();
  await fileRow('Session.md').dblclick();
  await page.getByText('Recovered draft', { exact: true }).waitFor();
  await button('Save').click();
  await page.getByText('Saved', { exact: true }).waitFor();
  assert.equal(await readFile(path.join(library, sessionFile), 'utf8'), 'Recovered offline field observations');
}
