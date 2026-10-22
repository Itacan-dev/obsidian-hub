# Milestone 1E — Archive-and-switch preparation

Completed 2026-10-21. This includes an **actual read-only archive of existing vault sources**, not only a synthetic rehearsal. No real Project was selected, retired or activated.

## Implementation inventory

Only one existing file changed:

- `lib/tests/task-service-boundary.test.js`

New plugin files, relative to `.obsidian/plugins/hub-project-menu/`:

- `lib/services/native-cutover-preparation.js`
- `lib/services/native-cutover-preparation.d.ts`
- `lib/tests/native-cutover-preparation.test.cjs`
- `lib/tests/native-cutover-types.fixture.ts`
- `lib/tests/native-cutover-typecheck.cjs`
- `lib/tests/task-service-boundary.pre-m1e.cjs`
- This report.

New native-integration files:

- `ItacanTaskCore/integration/prepare-cutover.cjs`
- `ItacanTaskCore/integration/CUTOVER-PREPARATION.md`

The preparation module is offline and is not imported by production startup. No plugin lifecycle, native host/admission, persistence, codec, command, receipt, recovery, completion, History/Statistics algorithm, Oath/Inbox/Roadmap or Music source changed.

## Actual archive and preservation

The new private archive is:

```text
C:\Users\El_Baraka 2025\AppData\Local\Itacan\CutoverArchives\v1\47f2fab0a1a1e5ec\preparation-20261021-b4c56b89-01c7-4890-8b9a-dad0265687f9\capture-2026-10-21T17-39-56-340Z-e82b2a20-20a6-4dc9-9212-eb38caa7caa5
```

Primary files:

- `TASKS.txt`: readable task/Step status, available Necessity/civil dates/Description, source lines and verbatim task blocks. Unsupported and literal source is preserved raw.
- `originals/`: **12 complete original Markdown files**, including unrelated note material, with byte-identical backups.
- `TASK-METADATA.json`: private reference copies of metadata associated with archived legacy IDs; no automatic import. Copied IDs are not treated as proven metadata attribution.
- `MANIFEST.json` and `MANIFEST.sha256`: original paths, physical owners, backup locations/hashes, write stamps, count reliability, capture stability, source-safety findings and registry/application observations.

All 12 original/backup hashes match. Zero source changes were observed during capture. A separate subsequent read-only verification confirmed all original bytes and write stamps still match, registry files remained unchanged during capture, and legacy History/task metadata digests still match. Readable output and metadata-reference hashes also verify. The final conservative parser produces no changed safety findings for this capture.

The destination was validated outside the vault, OneDrive/cloud roots and Git. Its new private ACL and inherited capture ACL allow only the current user, SYSTEM and Administrators. An execution guard admitted writes only beneath owned Temp or this newly created archive root. No prior archive was overwritten. This is local disk storage, not Temp. Hashes detect modification; they do not authenticate a hostile writer or establish indefinite source quiescence.

Inventory excludes application/development infrastructure (`.git`, `.obsidian`, `.codex`, `.agents`, `.aws`, `node_modules`) and `System/Backups`; archived backups are not rediscovered as active sources. Other Markdown is inspected read-only. The strict Project identity reader accepts unambiguous scalar identities and reports unsupported YAML instead of guessing. Existing task source and physical-owner functions are reused.

## Private Project candidates

| Private Project | Status | Tasks | Steps | Current eligibility |
|---|---|---:|---:|---|
| Pulsed Optomechanics | active | 1 | 0 | Eligible; one source |
| Quantum Gravitational Phenomena | active | 0 | 0 | Eligible; no existing task sources |
| Magic Fantasy | future | 0 | 0 | Not currently eligible |
| Pop Science version of QGP | future | 0 | 0 | Not currently eligible |
| `Hello this is a long title…` (full identity/name in manifest) | shelved | 0 | 0 | Not currently eligible |

No candidate was chosen automatically. Shared Itacan and Obsidian Hub are excluded from private cutover eligibility. Knowledge physically owns **6 tasks and 20 Steps** across two task notes, plus one preserved checkbox-like formula/reference note. Resource mounts do not add those sources to a Project. Other Resources have no captured active tasks in this inventory.

## Retirement preview

The supported dry run requires one explicitly selected eligible private Project. It uses exact source hashes, write stamps and byte offsets. It proposes removing only the `[ ]`/`[x]` marker and its immediately following separator, leaving an ordinary list item. All other bytes—including titles, nested indentation, continuations, prose, headings, formulas and source identity comments—remain untouched. It never deletes entire blocks or applies proposed bytes. Unknown/custom status, unproven HTML/math/comment/code context, ambiguous ancestry/ownership, links and changed sources block approval.

The potential private source `Projects/Pulsed Optomechanics/Meta/Tasks.md` contains one verified task and has no identified retirement ambiguity. It would require one marker conversion **if that Project is explicitly selected and the snapshot still matches**. No owner-specific real retirement plan was approved/generated by choosing it on the user's behalf. Empty QGP needs no current marker retirement, subject to a fresh source-set check.

Five preserved sources require manual review and are not approved for conversion: the shared Itacan `Meta/Tasks to Do Functionality.md` note (empty task title); Knowledge's `Mathematics/MM7052 HT26, Topology/Encyclopedia of definitions & theorems.md` (unsupported checkbox-like syntax); and `System/Templates/Meeting.md`, `Project.md`, `Research Log.md` (empty template checkboxes/unestablished physical owner). These do not become private Project task sources by inference.

## Stable authority preparation and preflight

`prepareAuthority` validates this convention without creating directories, allocating a native authority or opening storage:

```text
%LOCALAPPDATA%/Itacan/NativeTasks/v1/<hash(vaultId)>/<hash(deviceId)>/<hash(projectId)>/repository
```

It requires the registered vault identity, actual owning-context device identity and selected Project identity, rather than names. The last writer's `data.json` device stamp is not substituted for the local device identity. Vault-contained, cloud, UNC, Git, junction/symlink and conflicting/occupied authority paths reject. Writer/receipt evidence is observed read-only, never acquired or repaired. Existing writer ownership/recovery remains the eventual authority.

The preparation object is explicitly `enabled:false`, `admitted:false`, `executable:false`; it is not a usable native host configuration. Existing synthetic-only production admission remains unchanged. **No real `Itacan/NativeTasks` directory, repository or activation configuration exists from this execution.**

Preflight rechecks verified archive outputs, current source membership, registry, hashes/write stamps, metadata/History digests and current authority-path conflicts. Same-byte writes invalidate captured write stamps. No prior archive proves indefinite absence of writes. Even a clean synthetic preparation always leaves activation false, requiring an exclusive source-write window, separately approved permanent native admission and explicit cutover authorization. Missing Project/authority selection currently also blocks readiness. No distributed transaction or second outcome authority was introduced.

## Active regression maintenance

The obsolete static no-native-reachability assertion is replaced by disabled-mode behavior: native module loading is denied, filesystem mutation/open probes fail if reached, default host construction returns null, actual Legacy construction/queries remain operational, and recorded History uses its existing default reader/cache. The directly related source-level ban on **any** History subscription was also replaced by default-branch behavior: optional native-feed subscriptions are already authorized, while legacy-only History acquires no such subscription. Raw-source exclusions and all unrelated original assertions remain.

Exact original active-test bytes are preserved in `task-service-boundary.pre-m1e.cjs`, matching the fresh Temp original with SHA256:

`94abf4a06a944af97accc0de73a3bc9c7f311bc48a93cec041fa0d9fcd36ea29`

No immutable historical graph/fixture was edited or claimed newly green. The maintained active boundary now passes 3/3, with no remaining active historical exception in the selected checks.

## Verification and protection

- **43/43 focused checks pass:** 13 preparation/archive/path/preview cases, three active boundary cases, nine startup/owner/lifecycle cases and 18 actual retained-request recovery cases.
- **Three declaration runners pass**, zero diagnostics: preparation, real-host integration and request recovery.
- **19/19 genuine isolated-Obsidian workflows pass**, using actual plugin startup and shutdown with synthetic data. The everyday vault/process was not substituted or reloaded.
- Synthetic cases cover raw nested/unsupported content, mounted Resource exclusion, exact backup equality, concurrent source changes, same-byte rewrites, changed inventories, corrupt outputs, failed backup verification, repeated archives, copied IDs, shared owners, junctions and conflicting authority paths. Injected failures are distinguished from successful actual backup verification.
- Baseline/final staged builds match across **all twelve assets**, with **233 main / 25 Atlas factories** in this gate's fresh baseline and candidate. No startup factory or routing delta was introduced by 1E.
- **All twelve installed production assets match.** All protected existing Markdown, plugin `data.json`, shared data, workspace, History and task metadata match the fresh baseline at comparison. No observed protected drift required restoration. Existing dirty Git state is preserved; only the authorized active test differs among the 1,818 baseline files.

Initial failed verification is retained: Windows short-path/canonical-path comparisons and a noncanonical test-injection path were corrected; the added Legacy History fixture was supplied its actual existing reader. No assertion was weakened to conceal these failures. Focused tests now pass. No broad historical recovery archive or verification ZIP was created.

Commands, raw results, initial failures, source original, protected/installed/build comparisons and real archive verification are retained in:

`C:\Users\EL_BAR~1\AppData\Local\Temp\itacan-m1e-un7imo77`

Genuine Obsidian evidence:

`C:\Users\EL_BAR~1\AppData\Local\Temp\itacan-real-host-8Vaq0x\evidence`

## Required next approval

Select one eligible private Project. Then review its exact owner-scoped preview and device/vault-bound permanent authority preparation, establish source-write quiescence, and immediately revalidate verified originals/backups (recapture if changed). Separately authorize the narrowly scoped permanent-admission/configuration change and actual checkbox retirement/native activation. Legacy History remains untouched; desired active tasks will be manually recreated as new native tasks. No import, automated migration or task recreation is required or authorized here.

Stop for user review. Real retirement and activation remain unperformed.
