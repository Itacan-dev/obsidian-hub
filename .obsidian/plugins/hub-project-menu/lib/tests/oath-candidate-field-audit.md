# Phase 2B-2F-1 — original read boundary and separation gate

Fresh source build matches installed F3D2850C8A59BC61195E99429510B626A9E5EAD735507569EBE35D4AB04931E5.
Original Oath service/UI and candidate facts were frozen before production changes.

| Caller / callee (plugin-relative) | Classification / authorized change |
| --- | --- |
| services/oath.js:74 tasks -> taskData.readPages global | Shared legacy primitive, unchanged |
| resolveWork:190 -> tasks:192 -> source snapshot/metadata/ownsTask | Active hydration, unchanged |
| reconcile:232 -> resolveWork:239, activate, markFulfilled | Active refresh/lifecycle, unchanged |
| start:167 -> taskData.subscribe + refresh; timer -> refresh(false) | Active subscriptions/clock, unchanged |
| take:271 -> validateDraft:276 -> setupRequirements -> workspaceTasks | Explicit final enrollment validation, unchanged |
| take:290 -> tasks global; queued vault.process -> readTaskSnapshot -> ownsTask -> ID assignment | Enrollment writer, unchanged |
| take:327 -> readNewWork:339 -> awaitingIndex | Post-enrollment hydration, unchanged |
| reviewStrict:60 -> validateDraft | Strict preflight validation, unchanged |
| ui/oath.js:147,176 picker render/Add -> workspaceTasks | Setup-only candidate consumer to migrate |
| ui/oath.js:378 inline suggestion/selection -> workspaceTasks | Setup-only candidate consumer to migrate |
| UI:314 startValid, :581 updateNext -> setupRequirements | Read-only prerequisite feedback to use candidate state, without repeated raw task scans |
| UI:594 Review, :630 review -> validateDraft; :697 Take -> take | Existing final validation/writer stays authoritative; explicit compatibility conversion before submission |
| ui/oath-tasks.js partition/render | Active task presentation/clock, unchanged |

Only Active Projects and registered Resources with a matching stable identity and
existing dashboard pass resolveWorkspace. Workspace cards list existing registry
entries; activation rechecks eligibility. workspaceTasks reads the existing global
index/metadata context, then physical dashboard/root scope, open parents and no
parent identityConflict, then unchanged taskGroups(active + future). Meta/hidden
folders are not extra Oath exclusions; recursive nested paths follow the original
root rule, including nested Project folders. Page project frontmatter and Resource
mount navigation allowances do not establish candidate ownership.

taskData.readPages counts all parent and Step IDs before scoping. Parent IDs copied
anywhere (including a Step outside the workspace) exclude that parent. A duplicated
Step ID alone does not exclude its otherwise valid parent in original Oath setup;
do not import the generic display projection's stronger Step/ID-less-title rejection.
Two ID-less same-title parents with different lines have distinct temporary keys
and enroll via the original writer. That writer deliberately allocates parent IDs.
Source text/line/path, full indexed continuation, metadata date/time/importance,
parent Steps (including nesting/completion) must survive the compatibility bridge.
No Step becomes a separate commitment. Commitment refs remain {id,path,text}.

The original picker discards chosen keys when a refresh removes candidates; inline
setup remaps draft selections by key and silently removes missing ones. The request
explicitly requires preserving selection intent instead: keep selected locators,
show unavailable selections and block stale submission instead of reidentifying by
title, silently clearing or reselecting them. Workspace changes still reset selection.

Separation gate before UI integration: 16 actual original-source tests pass. Ten
workspace candidate sets/keys/order/full text match through legacyReadView/legacyReadTask.
Actual unchanged take() outcomes match for parent/multiple/ID-less/same-title/Step/
Resource enrollment and copied IDs, mounted Resources, changed/completed/moved
sources, missing dashboards, status changes and source/persistence failures.
Deterministic synthetic UUID injection compares exact source writes, metadata,
persisted commitments, order and failures. Reads allocate no IDs or source writes.

The generic structured panel/display policy has stronger ambiguity rules than
Oath's original parent commitment policy. Add explicit indexed oath-candidates
policy; do not enable generic queryVisible oath support. Keep the entire Oath
service byte-identical, including workspaceTasks/setupRequirements/validateDraft.

Original oath.html browser cannot initially load ui/task-live-form (missing static
host dependency), before any production edit. Preserve that evidence; add required
host dependencies without weakening assertions. Independent original production
setup/picker DOM captures use a recursive actual-module loader.
