import test from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { readFile } from 'node:fs/promises';
import { setImmediate } from 'node:timers/promises';
import { runInNewContext } from 'node:vm';

const preload = await readFile(new URL('../main/preload.cjs', import.meta.url), 'utf8');

// Control the ordering of Electron's invoke reply and its independent send events.
// Execute the actual sandboxed bridge so cleanup is checked on the registered listener.
function searchBridge(invoke) {
  const ipcRenderer = new EventEmitter();
  ipcRenderer.invoke = invoke;
  let bridge;
  const contextBridge = { exposeInMainWorld: (_name, api) => { bridge = api; } };
  runInNewContext(preload, { require: () => ({ ipcRenderer, contextBridge }) });
  return { ipcRenderer, bridge };
}

test('streamed search keeps late matches from the selected query until its end event', async () => {
  const { ipcRenderer, bridge } = searchBridge(async () => ({ value: undefined }));
  const received = [];
  const done = bridge.streamNoteMatches('library', { token: 'active' }, matches => received.push(...matches));
  await setImmediate(); // The main process has already replied to invoke.
  assert.equal(ipcRenderer.listenerCount('search-matches'), 1);
  const emit = (session, token, matches) => ipcRenderer.emit('search-matches', {}, session, token, matches);
  emit('other library', 'active', ['out of scope']);
  emit('library', 'canceled', null);
  emit('library', 'active', ['late match']);
  emit('library', 'active', null);
  await done;
  assert.deepEqual(received, ['late match']);
  assert.equal(ipcRenderer.listenerCount('search-matches'), 0);
});

test('a rejected search releases its listener without waiting for matches', async () => {
  const { ipcRenderer, bridge } = searchBridge(async () => ({ error: 'Library changed' }));
  await assert.rejects(bridge.streamNoteMatches('old library', { token: 'stale' }, () => {}), /Library changed/);
  assert.equal(ipcRenderer.listenerCount('search-matches'), 0);
});
