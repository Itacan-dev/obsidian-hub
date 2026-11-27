import assert from 'node:assert/strict';
import path from 'node:path';
import { writeFile, rm } from 'node:fs/promises';

export async function completeAndRelinkPlan(session, { freshLibrary }, savedPaneWidth) {
  const {
    page, button, dialogButton, menuItem, chooseMenuAction, fileRow, dialog,
    renameItem, measure, screenshot
  } = session;
  const left = page.locator('.pane').first();
  const right = page.locator('.pane').nth(1);
  await button('Home').click();
  await measure('openPlan', async () => {
    await button('New plan').click();
    await dialogButton('Add to plan').waitFor();
  });
  await dialogButton('Add to plan').click();
  await dialogButton('Review results').click();
  await dialogButton('Files').click();
  await dialog().getByLabel('Filter items').fill('Run one/Results.md');
  await dialogButton('Results.md').click();
  await dialogButton('Workspaces').click();
  await dialogButton('Experiment').click();
  await dialog().getByText('Review selected (3)').waitFor();
  await dialog().getByText('Review selected (3)').click();
  await screenshot('plan-selection');
  await dialogButton('Add selected (3)').click();
  await dialogButton('Reorder Results.md').press('Alt+ArrowUp');
  await dialog().locator('.plan-entry').first().getByText('Results.md', { exact: true }).waitFor();
  await page.getByLabel('Plan notes').fill('Repeat the measurements');
  await dialogButton('Done').click();
  await button('Workspace').click();
  await chooseMenuAction(fileRow('Results.md'), 'Rename');
  await renameItem('Field results');
  await fileRow('Field results.md').waitFor();
  await button('Home').click();
  await page.locator('.plan-panel').getByRole('button', { name: 'Field results.md', exact: true }).waitFor();
  await measure('completeTask', async () => {
    await page.locator('.plan-panel').getByRole('checkbox', { name: 'Complete Review results' }).check();
    await page.locator('.plan-panel').getByRole('checkbox', { name: 'Reopen Review results' }).waitFor();
  });
  await button('Presets').click();
  await measure('restoreTwoPanes', async () => {
    await menuItem('Review desk').click();
    await left.getByRole('heading', { name: 'Field results', exact: true }).waitFor();
  });
  assert.ok(Math.abs((await left.boundingBox()).width - savedPaneWidth) < 2);
  assert.equal(await right.getByRole('textbox').innerText(), 'Shared edit');
  await button('Home').click();
  // A deletion outside Itacan keeps the Plan entry available for relinking.
  await writeFile(path.join(freshLibrary, 'Projects/Experiment/Temporary.md'), 'Temporary');
  await button('Edit plan').click();
  await dialogButton('Add to plan').click();
  await dialogButton('Files').click();
  await dialogButton('Temporary.md').click();
  await dialogButton('Add selected (1)').click();
  await dialogButton('Done').click();
  await rm(path.join(freshLibrary, 'Projects/Experiment/Temporary.md'));
  await button('Edit plan').click();
  await dialogButton('Relink').click();
  await dialogButton('Abstract.md').click();
  await dialogButton('Relink selected').click();
  await dialog().locator('.plan-entry').getByText('Abstract.md', { exact: true }).waitFor();
  await dialogButton('Done').click();
  await button('Finish plan').click();
  await dialogButton('Finish plan').click();
  await button('Hide').waitFor();
}

export async function recordProgressAndQuit(session) {
  const { page, desktop, button, dialogButton, dialog, measure } = session;
  const progress = page.locator('.home .progress-panel');
  const progressBounds = await progress.boundingBox();
  await measure('openProgress', async () => {
    await button('Log progress').click();
    await dialogButton('Save progress').waitFor();
  });
  const score = dialog().getByRole('group', { name: 'Rating for Projects/Experiment' }).getByRole('button', { name: '3', exact: true });
  await score.click();
  await dialog().getByLabel('Reflection for Projects/Experiment').fill('Repeated the measurement');
  await dialog().getByText('Current plan - optional').click();
  await dialogButton('View plan').click();
  await dialog().getByText('Repeat the measurements').waitFor();
  await dialogButton('Done').click();
  await dialogButton('Save progress').click();
  await progress.getByText('Repeated the measurement').waitFor();
  assert.equal((await progress.boundingBox()).height, progressBounds.height);
  const today = new Date().toLocaleDateString('sv-SE');
  await progress.locator('[data-day="' + today + '"]').click();
  await dialogButton('Edit progress').click();
  await dialog().getByLabel('Reflection for Projects/Experiment').fill('Verified reflection');
  await dialogButton('Save progress').click();
  const previousDay = new Date();
  previousDay.setDate(previousDay.getDate() - 1);
  if (previousDay.getFullYear() !== new Date().getFullYear()) {
    await progress.getByRole('button', { name: 'Previous year' }).click();
  }
  const earlierCell = progress.locator('[data-day="' + previousDay.toLocaleDateString('sv-SE') + '"]');
  await earlierCell.click();
  await dialogButton('Add workspace').click();
  await dialogButton('Literature').click();
  await dialog().getByRole('group', { name: 'Rating for Resources/Literature' }).getByRole('button', { name: '2', exact: true }).click();
  await dialog().getByLabel('Reflection for Resources/Literature').fill('Reviewed earlier notes');
  await dialogButton('Save progress').click();
  await earlierCell.click();
  await dialog().getByText('Reviewed earlier notes').waitFor();
  await dialogButton('Edit progress').click();
  await dialog().getByLabel('Reflection for Resources/Literature').fill('Reviewed earlier field notes');
  await dialogButton('Save progress').click();
  await progress.getByText('Reviewed earlier field notes').waitFor();
  await progress.getByRole('button', { name: 'Tasks', exact: true }).click();
  await progress.getByText('Review results', { exact: true }).waitFor();
  await progress.getByRole('button', { name: 'Activity', exact: true }).click();
  assert.ok(await progress.locator('.progress-row').count() > 0);
  await progress.getByRole('button', { name: 'Reports', exact: true }).click();
  await measure('openStatistics', async () => {
    await button('Statistics').click();
    await dialog().getByText('Work distribution').waitFor();
  });
  await dialogButton('7 days').click();
  await dialog().getByLabel('Statistics workspace').selectOption('Projects/Experiment');
  await dialog().getByText(/3 pts/).first().waitFor();
  await dialogButton('Close dialog').click();
  await button('Workspace').click();
  await page.locator('.workspace .progress-panel h2').waitFor();
  await button('Last File').click();
  const active = page.locator('.selected-pane');
  // A deliberate return to read a document is eligible even without another edit.
  await active.getByRole('button', { name: 'Read', exact: true }).click();
  await active.locator('article').click();
  await button('Home').click();
  await button('Hide').waitFor();
  await page.waitForFunction(() => !document.querySelector('#application').inert);
  await desktop.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].close());
  await Promise.all([desktop.waitForEvent('close', { timeout: 10000 }), dialogButton('Close without reporting').evaluate(b => requestAnimationFrame(() => b.click()))]);
}

export async function verifyReportsAndPlanAfterRestart(session) {
  const { page, button } = session;
  await page.locator('.progress-history').getByText('Verified reflection').waitFor();
  await button('Hide').click();
  await button('Show earlier plans').click();
  await page.locator('.plan-history summary').click();
  await page.locator('.plan-history').getByText('Repeat the measurements').waitFor();
}
