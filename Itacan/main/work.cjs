const fs = require('node:fs/promises');
const path = require('node:path');
const { atomicReplace } = require('./library.cjs');
const { taskAction, rewriteTaskRefs } = require('./tasks.cjs');
const { saveReports, recordTaskChanges, moveProgress } = require('./progress.cjs');
const { today, expired, finish, planAction, rewritePlanRefs } = require('./plan.cjs');

const { setPlaylist, rewriteMusicRefs } = require('./music.cjs');
const { protectFormat } = require('./library-format.cjs');
const { validateStoredWork } = require('./work-format.cjs');
const { recoverMove, serialize } = require('./recovery.cjs');
const { oathAction, advanceOath, moveOath } = require('./oath.cjs');
const { roadmapAction, moveRoadmaps } = require('./project-planning.cjs');
const { setPreferences, rewriteCoverRefs } = require('./settings.cjs');
const { workspaceAction, relinkDestination, rewriteWorkspaceRefs } = require('./workspaces.cjs');
const { updateLayout, rewriteLayoutRefs } = require('./presets.cjs');
const { captureAction, inboxAction, fileCapturesAsTasks } = require('./capture-state.cjs');

function empty() {
  return { version: 1, tasks: [], inbox: [], plan: null, history: [], presets: [], lastLayout: null };
}
function rewriteRefs(state, from, to) {
  function moved(path) {
    if (path !== from && !path?.startsWith(from + '/')) return path;
    return to ? to + path.slice(from.length) : '';
  }

  moveProgress(state, from, to);
  rewriteMusicRefs(state, from, to);
  // The Oath verifies its current scope before any attached folders change.
  moveOath(state, from, to);
  moveRoadmaps(state, from, to);
  rewriteWorkspaceRefs(state, from, to);
  rewriteCoverRefs(state, moved);
  // Task ownership uses the Project's updated Resource attachments.
  rewriteTaskRefs(state, moved);
  rewritePlanRefs(state, moved);
  rewriteLayoutRefs(state, moved);
}

// Coordinated task changes share one commit with dependent progress, Oath and capture records.
async function applyTaskChange(state, action, data, library) {
  const capture = action === 'save' && data.captureId;
  if (capture && !state.inbox.some(item => item.id === capture && item.text)) throw Error('Capture already resolved.');
  const before = structuredClone(state.tasks.find(task => task.id === data.id));
  const saved = await taskAction(state, action, data, library);
  const after = action === 'save' ? saved : state.tasks.find(task => task.id === data.id);
  recordTaskChanges(state, before, after);
  advanceOath(state);
  if (data.quick) state.quickText = '';
  if (capture) state.inbox = state.inbox.filter(item => item.id !== capture);
}

class LibraryWork {
  constructor(library) {
    this.library = library;
    this.file = path.join(library.root, 'itacan-work.json');
    this.queue = Promise.resolve();
    this.firstRead = true;
  }
  async load() {
    if (await fs.realpath(this.library.root) !== this.library.root) throw Error('The library moved. Choose its folder again.');
    try {
      if (!(await fs.lstat(this.file)).isFile()) throw Error('Invalid library work file.');
      const raw = await fs.readFile(this.file, 'utf8');
      const state = JSON.parse(raw);
      validateStoredWork(state);
      state.history ??= [];
      state.presets ??= [];
      return { raw, state };
    } catch (error) {
      if (error.code === 'ENOENT') return { raw: null, state: empty() };
      throw error;
    }
  }
  transaction(change) {
    const run = async () => {
      await recoverMove(this.library);
      const { state, raw } = await this.load();
      const oathChanged = advanceOath(state, { recover: this.firstRead });
      const expiredPreview = state.finishedPreview &&
        state.history.find(plan => plan.id === state.finishedPreview)?.day !== today();
      const rollover = !change && expired(state.plan);
      if (expiredPreview) state.finishedPreview = null;
      if (!change && !rollover && !expiredPreview && !oathChanged) {
        this.firstRead = false;
        this.latest = state;
        return state;
      }
      if (state.revision === Number.MAX_SAFE_INTEGER) throw Error('Library revision exhausted. Preserve the work file for recovery.');
      if (rollover) finish(state);
      await protectFormat(this.library, raw, atomicReplace);
      let rollback;
      try {
        rollback = await change?.(state, raw);
        if (serialize(state) !== (raw ?? serialize(empty()))) {
          state.revision = (state.revision || 0) + 1;
          await atomicReplace(this.file, serialize(state), undefined, async () => {
            const current = await fs.readFile(this.file, 'utf8').catch(error => {
              if (error.code === 'ENOENT') return null;
              throw error;
            });
            if (raw !== current) throw Error('Library data changed on disk. Reopen this view and retry.');
          });
        }
      } catch (error) {
        if (typeof rollback === 'function') await rollback();
        throw error;
      }
      this.firstRead = false;
      this.latest = state;
      return state;
    };
    const result = this.queue.then(run);
    this.queue = result.catch(() => { });
    return result;
  }
  command(group, action, data = {}) {
    if (!data || typeof data !== 'object' || Array.isArray(data)) throw Error('Invalid operation arguments.');
    return this.transaction(async state => {
      switch (group) {
        case 'workspace':
          if (action === 'relink-document') {
            const destination = await relinkDestination(this.library, data);
            rewriteRefs(state, data.from, destination);
          } else await workspaceAction(state, action, data, this.library);
          return;
        case 'layout': return updateLayout(state, action, data);
        case 'capture': return captureAction(state, action, data);
        case 'inbox': return inboxAction(state, action, data);
        case 'plan': return planAction(state, action, data, this.library);
        case 'oath': return oathAction(state, action, data, this.library);
        case 'roadmap': return roadmapAction(state, action, data, this.library);
        case 'music':
          if (action === 'setPlaylist') return setPlaylist(state,data,this.library);
          break;
        case 'settings':
          if (action === 'save') return setPreferences(state, data, this.library);
          break;
        case 'progress':
          if (action === 'save') return saveReports(state, data, this.library);
          break;
        case 'task':
          if (action === 'captures') return fileCapturesAsTasks(state, data, this.library);
          return applyTaskChange(state, action, data, this.library);
      }
      throw Error('Unknown library operation.');
    });
  }
}
module.exports = { LibraryWork, rewriteRefs };
