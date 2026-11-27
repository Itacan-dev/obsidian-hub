import scope from '../contracts/workspace.cjs';

// Each query reads the current committed revision. Records keep their identity within that revision.
/** @template Result
 * @param {import('../contracts/work-commands').WorkDispatch<Result>} dispatch
 * @param {() => Record<string, any> | undefined} getState
 */
export function workOperations(dispatch,getState) {
  /** @template {keyof import('../contracts/work-commands').OperationInputs} Group
   * @template {keyof import('../contracts/work-commands').OperationInputs[Group]} Action
   * @param {Group} group
   * @param {Action} action
   * @returns {(data: import('../contracts/work-commands').OperationInputs[Group][Action]) => Promise<Result>}
   */
  const operation = (group,action) => data => dispatch(group,action,data);
  return {
    tasks: {
      list: () => getState()?.tasks || [],
      find: id => getState()?.tasks?.find(task => task.id === id),
      inWorkspace: (owner,task) => scope.taskInWorkspace(getState(),owner,task),
      save: operation('task','save'),
      setCompleted: operation('task','complete'),
      setStepCompleted: operation('task','step'),
      attach: operation('task','attach'),
      remove: operation('task','delete'),
      fileCaptures: operation('task','captures')
    },
    workspaces: {
      attachments: owner => getState()?.sharedFolders?.[owner] || [],
      explorer: owner => getState()?.explorers?.[owner],
      contextFor: (path,candidate) => scope.workspaceContext(getState(),path,candidate),
      lastFolder: () => getState()?.lastFolder,
      lastWorkspace: () => getState()?.lastWorkspace,
      status: owner => getState()?.projectStatus?.[owner] || 'Active',
      projectOrder: status => getState()?.projectOrder?.[status] || [],
      visit: operation('workspace','visit'),
      saveExplorer: operation('workspace','explorer'),
      setStatus: operation('workspace','status'),
      orderProjects: operation('workspace','project-order'),
      attachFolder: operation('workspace','attach'),
      detachFolder: operation('workspace','detach'),
      relinkDocument: operation('workspace','relink-document')
    },
    presets: {
      list: () => getState()?.presets || [],
      lastLayout: owner => owner ? getState()?.workspaceLayouts?.[owner] : getState()?.lastLayout,
      save: operation('layout','preset'),
      remember: operation('layout','remember'),
      rename: operation('layout','rename'),
      remove: operation('layout','remove'),
      reorder: operation('layout','reorder'),
      moveUp: operation('layout','up'),
      moveDown: operation('layout','down')
    },
    plans: {
      current: () => getState()?.plan,
      history: () => getState()?.history || [],
      finishedPreviewId: () => getState()?.finishedPreview,
      start: operation('plan','start'),
      saveNote: operation('plan','note'),
      discardEmpty: operation('plan','abandon'),
      add: operation('plan','add'),
      addMany: operation('plan','addMany'),
      finish: operation('plan','finish'),
      hidePreview: operation('plan','hide'),
      move: operation('plan','move'),
      remove: operation('plan','remove'),
      relink: operation('plan','relink')
    },
    oaths: {
      current: () => getState()?.oath,
      history: () => getState()?.oathHistory || [],
      start: operation('oath','start'),
      break: operation('oath','break'),
      addTask: operation('oath','add'),
      end: operation('oath','end'),
      rest: operation('oath','rest'),
      resume: operation('oath','resume'),
      cancelScheduled: operation('oath','cancel')
    },
    roadmaps: {
      entries: owner => getState()?.roadmaps?.[owner] || [],
      save: operation('roadmap','save'),
      remove: operation('roadmap','delete')
    },
    progress: {
      reports: () => getState()?.reports || [],
      activity: () => getState()?.activity || [],
      saveReport: operation('progress','save')
    },
    settings: {
      preferences: () => getState()?.settings || {},
      save: operation('settings','save')
    },
    capture: {
      text: () => getState()?.quickText || '',
      files: () => getState()?.quickFiles || [],
      saveDraft: operation('capture','draft'),
      send: operation('capture','send')
    },
    inbox: {
      list: () => getState()?.inbox || [],
      sort: () => getState()?.inboxSort || 'Newest',
      edit: operation('inbox','edit'),
      setSort: operation('inbox','sort'),
      remove: operation('inbox','remove'),
      add: operation('inbox','add')
    },
    music: {
      playlist: () => getState()?.playlist || [],
      setPlaylist: operation('music','setPlaylist')
    }
  };
}
