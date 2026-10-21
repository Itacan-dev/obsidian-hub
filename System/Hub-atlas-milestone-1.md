# Atlas–Obsidian Milestone 1: reliable policy editing and recovery

Implemented against audit revision `91132b8` on 2026-10-15 in the active checkout at `C:\Users\jinhao\OneDrive\obsidian-hub`. The Desktop checkout named in the session no longer exists. Scope is F01–F05; AtlasCore authorization semantics and unrelated Hub functionality were not changed. No commit or push was created.

## Implementation

All paths below are relative to `.obsidian/plugins/hub-project-menu/`.

| Finding | Root cause | Solution and visible result | Source files |
| --- | --- | --- | --- |
| F01 | Non-shrinking Vault status/actions exceeded a clipped flex container; only the diff scrolled. | Terms and actions share one normal-flow scroll region. The parent can scroll when header content consumes the height. Container queries adapt a narrow embedded pane independently of viewport width. Confirm and Cancel remain reachable without covering terms. | `styles.css` |
| F02 | Import generated a hostname-derived curated ID already held by a record whose primary had changed. | Existing record IDs are immutable; new editor drafts use an opaque UUID that survives hostname edits. Import allocates deterministic unused suffixes for occupied seed IDs and respects existing primary/alias ownership. Customized names, categories, pins and aliases survive. Metadata validation errors return `CURATED_METADATA_CONFLICT` locally instead of taking down browsing. | `obsidian/application.js`, `obsidian/runtime.js`, `obsidian/settings-ui.js` |
| F03 | Cancellation and replacement were separate persisted operations with no copy surviving successful cancellation. | Save a validated recovery record before cancelling. Keep it through failures and ambiguous acknowledgements. Show saved copy, unresolved storage and active pending proposal as distinct states. Explicit review can create a fresh protected replacement using current revision bases. | `obsidian/application.js`, `obsidian/persistence.js`, `obsidian/runtime.js`, `obsidian/settings-ui.js` |
| F04 | Unchanged rows retained callbacks containing obsolete records and revision bases. | Edit, Pin and Remove resolve current committed data by stable ID at click time. Conflicts preserve input and offer current-value review, explicit acceptance of reviewed revision bases, reload or discard. Another input/state change invalidates the conflict review. | `obsidian/settings-ui.js` |
| F05 | A sticky Access-change flag turned a round trip into an all-host policy operation. | Compare final per-host choices with committed policy. The primary selector affects the primary; aliases have individual controls; applying one choice to every host requires an explicit checkbox. Name/category/pin changes preserve every class and overlapping list membership. Changing a primary retains its committed www alias. | `obsidian/settings-ui.js`, `obsidian/application.js`, `obsidian/runtime.js` |

`obsidian/native.js` and `obsidian/integration.js` now agree on native API version 4, preventing old native owners from receiving an incompatible editor/recovery contract. The production `main.js` and `atlas-native.cjs` bundles were rebuilt. Quit and reopen Obsidian to load the new main-process owner.

## Recovery ownership, persistence and security

The recovery copy belongs to adapter application metadata schema 2. Its closed fields contain an ID, source proposal ID, original operation, policy/configuration/application bases, exact policy/configuration candidates, and any staged destination records. Application schema 1 migrates through the existing owner lock, journal, flush, CAS, atomic replacement and verified receipt path, preserving Core and user metadata. Core's envelope and snapshot remain schema 2 with the existing closed Core fields; application/recovery data is stripped before Core receives its envelope.

Recreation proceeds in this order:

1. Validate readiness, proposal identity, expiry and revisions.
2. Persist the recovery copy and obtain a verified receipt before cancellation.
3. Ask Core to cancel the expired proposal. Stop on any failure or uncertainty.
4. Ask Core to create a replacement. Core supplies the new ID, current complete waiting period, immutable candidate and confirmation requirement.
5. Verify the replacement and staged metadata, then remove the recovery copy through another verified metadata transaction.

An uncertain outcome stops the workflow. Explicit **Recover saved state** reconciles persisted state; it never retries proposal creation or confirmation. A restart can initially show reconciliation rather than a loaded draft; the existing explicit recovery action then reveals the saved copy or verified pending replacement. If replacement persistence succeeded but its acknowledgement was lost, the UI recognizes the existing replacement and offers no duplicate creation. A matching replacement that later expires can be explicitly recreated again while preserving a durable copy before cancellation.

A saved copy remains non-authoritative until explicitly reviewed. **Create reviewed replacement** submits the policy, configuration and application revisions shown in that review; stale bases reject without dropping the copy. A policy draft restores its exact saved policy under current timing terms. A timing draft restores saved timing values while retaining current policy. When security values are already committed, the explicit **Save reviewed recovery details** action saves only reviewed display data and removes the copy; it does not manufacture a no-op policy proposal. **Discard recovery copy** never cancels a Core proposal or modifies policy.

Destination metadata cannot grant access. Imports and per-host edits continue through Core whenever their final candidate changes policy. Blacklist precedence, exact-host evaluation, explicit Greylist authorization, replay protection, bounded Journeys, native enforcement and verified persistence before publication remain in force. Vault still displays Core's actual per-host classifications and both list diffs. Legacy closed `access` commands remain explicit all-host operations; the new editor submits a complete, validated `hostAccess` array instead.

## Regression evidence and validation

New coverage is in `lib/atlas/tests/milestone.test.js` (19 tests) and `lib/atlas/tests/native/milestone-renderer.cjs`. The existing native renderer fixture invokes the new fixture within its UI case. Its pin selector now uses the control's accessible label instead of a checkbox index. The existing presentation migration expectation now checks application schema 2.

Baseline reproductions failed before the fixes. Against the committed UI, a fresh editor submitted policy revision 0 when current revision was 1. The installed-theme layout reproduction at 800×500 measured Confirm at y=434.52–470.52 with the section clipped at y=433. Both now pass the regression.

Commands were run from the active repository root:

| Command | Result |
| --- | --- |
| `node --test AtlasCore/packages/core/tests/*.test.mjs` | 191 passed |
| `node --test .obsidian/plugins/hub-project-menu/lib/atlas/tests/*.test.js` | 70 passed, including 19 new Milestone 1 adapter tests |
| `node --test .obsidian/plugins/hub-project-menu/lib/tests/*.test.js` | 90 passed |
| `node .obsidian/plugins/hub-project-menu/lib/atlas/tests/native/launch.cjs` | 22 passed; includes expanded renderer regressions |
| `node .obsidian/plugins/hub-project-menu/lib/atlas/tests/native/browser-launch.cjs` | 5 passed: settings, workspace-navigation, workspace-explorer, workspace-covers, atlas-product |
| `node AtlasCore/packages/core/node_modules/typescript/bin/tsc -p .obsidian/plugins/hub-project-menu/lib/atlas/tsconfig.json` | Passed |
| `npm.cmd --prefix AtlasCore/packages/core run typecheck` | Passed |
| `git -c core.whitespace=cr-at-eol -c core.safecrlf=false diff --check` | Passed; honors the established generated-bundle CRLF convention |

The final build used:

```powershell
node .obsidian/plugins/hub-project-menu/build.js --output-dir 'C:\Users\jinhao\AppData\Local\Temp\atlas-milestone-final-147cd714222b4c4d853845a053174269'
```

Only its two affected bundles were copied into the plugin. An independent second build produced byte-identical production bundles: 144 renderer modules and 24 native modules.

| Bundle | SHA-256 |
| --- | --- |
| `main.js` | `1b7099ee8d3ce36d3fe23a6088130addf5932e96674fb7f2cc71b4c38d849f02` |
| `atlas-native.cjs` | `8d256875752ed6f51efc684e96c8f62b07a8bb214f44f952940607d5e1ee112c` |

The native suite ran Electron 39.8.3 / Chromium 142.0.7444.265. Layout/focus checks use the actual installed Obsidian 1.14.4 stylesheet with the plugin stylesheet. They exercise 800×900, 800×500, 800×400, a 420×360 embedded pane within a 1300×940 viewport, 150% Electron zoom, and a 300-host diff with a long description. They check normal-scroll reachability, actual Tab navigation, real button bounds, hit testing, first/final terms and non-overlapping actions.

The added editing/recovery renderer checks call the real runtime and filesystem repository through an isolated test bridge. Existing native tests exercise the production native bundle, real Electron guests, multi-window ownership and local fixture servers. All authority fixtures and browser profiles use temporary directories.

Failure injection covers saving the copy before cancellation, cancellation failure, replacement failure, lost copy/replacement/cleanup acknowledgements, restart with a new repository owner, concurrent policy revision changes, timing recovery under concurrent policy, stale restoration and an already-current policy. Tests assert actual Core candidates, diffs and committed policy, not just labels.

## Limits and next milestone

No F01–F05 defect remains known within the exercised cases. Full manual operation inside the user's running Obsidian session, live account/SSO/provider behavior, physical power loss and cross-device sync interruption were not tested. Tests used a real browser engine and installed CSS with a fixture Obsidian workspace, rather than a full live application session.

Ordinary unsaved editor drafts still have the existing mount lifetime: closing Settings or replacing an editor can lose them (F06). That is distinct from the new durable recovery copy for already-frozen expired proposals. The two Settings owners, broader contextual navigation, general pending-action visibility, batching and popup/download behavior remain outside this milestone.

Recommend Milestone 2 focus on shared Settings routing and edit-session preservation (F10/F06), contextual Note launch availability (F08), and pending-action links plus actionable feedback (F11/F12). Keep full batching and authorization-feature changes separately scoped.
