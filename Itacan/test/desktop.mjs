// One offline workday, followed by a second library and restarts of the same profile.
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { prepareLibraries } from './desktop/fixture.mjs';
import { openWindow, closeWindow } from './desktop/window.mjs';
import { openHomeAndCreateWorkspace, selectAndCopyWorkspaceFiles, reorderProjectsAndMoveFolders } from './desktop/workspace-files.mjs';
import { editAndRestoreSplitDesk, restoreMediaAndReadLinkedNotes, reopenWindowsAliasPreset } from './desktop/document-desk.mjs';
import { createTaskAndFileCaptures, findMoveAndAppendCaptures } from './desktop/tasks-and-capture.mjs';
import { completeAndRelinkPlan, recordProgressAndQuit, verifyReportsAndPlanAfterRestart } from './desktop/plan-and-progress.mjs';
import { searchAndInterruptUnsavedDraft, recoverAndSaveAfterRestart } from './desktop/draft-recovery.mjs';

const tmp = await mkdtemp(path.join(tmpdir(), 'itacan-desktop-'));
const diagnostics = { errors: [], remoteRequests: [], timings: {} };
let session;
try {
  const fixture = await prepareLibraries(tmp);
  const started = performance.now();
  session = await openWindow(fixture, diagnostics);
  await session.button('Choose a folder').waitFor();
  diagnostics.timings.launchToHome = Math.round(performance.now() - started);

  await openHomeAndCreateWorkspace(session, fixture);
  const savedPaneWidth = await editAndRestoreSplitDesk(session, fixture);
  await selectAndCopyWorkspaceFiles(session, fixture);
  await createTaskAndFileCaptures(session, fixture);
  await completeAndRelinkPlan(session, fixture, savedPaneWidth);
  await recordProgressAndQuit(session);

  session = await openWindow(fixture, diagnostics);
  await verifyReportsAndPlanAfterRestart(session);
  await findMoveAndAppendCaptures(session, fixture);
  await reorderProjectsAndMoveFolders(session, fixture);
  await restoreMediaAndReadLinkedNotes(session, fixture);

  session = await openWindow(fixture, diagnostics);
  await reopenWindowsAliasPreset(session, fixture);
  await searchAndInterruptUnsavedDraft(session, fixture);

  session = await openWindow(fixture, diagnostics);
  await recoverAndSaveAfterRestart(session, fixture);
  assert.deepEqual(diagnostics.remoteRequests, []);
  assert.deepEqual(diagnostics.errors, []);
  console.log('Passed offline Plan, Progress, Statistics, split editing, presets, files, tasks, capture and restart workflows.', diagnostics.timings);
} catch (error) {
  const page = session?.page;
  if (page && !page.isClosed()) {
    console.error(await page.locator('dialog[open], #message:not([hidden]), .media-area, .pane > .empty, .search-results:not([hidden])').allTextContents().catch(() => []));
  }
  throw error;
} finally {
  try {
    await closeWindow(session);
  } finally {
    await rm(tmp, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
  }
}
