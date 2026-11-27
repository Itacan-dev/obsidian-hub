// Inputs accepted by the structured-work bridge. Paths are relative to the library.
type Id = { id: string }
type Named = { name: string }
type Attachment = { project: string, folder: string }
type ProjectStatus = 'Active' | 'Future' | 'Shelved'
type PlanTarget = { planId?: string }
type PlanEntry = { kind: 'task' | 'note' | 'file' | 'workspace', ref: string }
type Split = string | { axis: 'row' | 'column', share: number, first: Split, second: Split }

interface Layout {
  panes: { id?: string, tabs: string[], file: string, edit?: boolean, views?: Record<string, object> }[]
  active: number
  folder?: string
  workspace?: string
  split?: Split
}

interface TaskInput {
  id?: string
  owner: string
  location?: string
  title: string
  description?: string
  done?: boolean
  start?: string
  due?: string
  until?: string
  planned?: string
  startTime?: string
  dueTime?: string
  untilTime?: string
  plannedTime?: string
  importance?: '' | 'Must do' | 'Should do'
  repeat?: '' | 'daily' | 'weekly'
  interval?: number
  captureId?: string
  quick?: boolean
  steps?: { id?: string, text: string, done: boolean }[]
}

interface Preferences {
  theme?: 'system' | 'light' | 'dark'
  accent?: 'Forest' | 'Blue' | 'Plum' | 'Amber'
  textSize?: 'Standard' | 'Large' | 'Extra large'
  density?: 'Comfortable' | 'Compact'
  motion?: 'System' | 'Reduced'
  readingWidth?: 'Standard' | 'Narrow' | 'Wide'
  editorMode?: 'read' | 'source' | 'live'
  saveMode?: 'auto' | 'manual'
  musicEnabled?: boolean
  shortcuts?: Record<string,string>
  covers?: Partial<Record<'Morning' | 'Afternoon' | 'Evening' | 'Night', { art: string, path?: string, position: number }>>
  websites?: { label: string, url: string }[]
}

export interface OperationInputs {
  task: {
    save: TaskInput
    complete: Id & { done: boolean }
    step: Id & ({ index: number, stepId?: string } | { stepId: string, index?: number }) & { done: boolean }
    attach: Id & { owner: string, location?: string }
    delete: Id
    captures: { ids: string[], path: string, owner?: string }
  }
  workspace: {
    visit: { path: string, workspace?: string }
    explorer: { path: string, folder?: string, expanded: string[], sort?: string, direction?: number, width?: number, order?: string[] }
    status: { path: string, status: ProjectStatus }
    'project-order': { path: string, status: ProjectStatus, order: string[] }
    attach: Attachment
    detach: Attachment
    'relink-document': { from: string, to: string }
  }
  layout: {
    preset: Named & { layout: Layout }
    remember: { layout: Layout }
    rename: Named & { next: string }
    remove: Named
    reorder: Named & { next: string }
    up: Named
    down: Named
  }
  plan: {
    start: PlanTarget
    note: PlanTarget & { note: string }
    abandon: PlanTarget
    add: PlanTarget & PlanEntry
    addMany: PlanTarget & { items: PlanEntry[] }
    finish: PlanTarget
    hide: PlanTarget
    move: PlanTarget & Id & { to: number }
    remove: PlanTarget & Id
    relink: PlanTarget & Id & { ref: string }
  }
  oath: {
    start: { owner: string, condition: 'duration' | 'tasks' | 'manual', mode?: 'regular', minutes?: number, startsAt?: string | null, taskIds: string[] }
    break: Id
    add: Id & { taskId: string }
    end: Id & { fulfilled: true }
    rest: Id & { minutes: number }
    resume: Id
    cancel: Id
  }
  roadmap: {
    save: { owner: string, id?: string, kind: 'phase' | 'milestone', title: string, start: string, end?: string, achieved?: boolean, taskIds?: string[] }
    delete: Id & { owner: string }
  }
  progress: {
    save: { day: string, entries: { owner: string, score: number | null, summary: string, expected?: string | null }[] }
  }
  settings: { save: Preferences }
  capture: { draft: { text: string }, send: { text?: string } }
  inbox: { edit: Id & { text: string }, sort: { sort: 'Newest' | 'Oldest' | 'Type' }, remove: Id, add: { text: string } }
  music: { setPlaylist: { tracks: string[] } }
}

export type WorkDispatch<Result> =
  <Group extends keyof OperationInputs, Action extends keyof OperationInputs[Group]>
    (group: Group, action: Action, data: OperationInputs[Group][Action]) => Promise<Result>
