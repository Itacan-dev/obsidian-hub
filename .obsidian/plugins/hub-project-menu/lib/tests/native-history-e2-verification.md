# N1-E2 verification — stopped, not accepted

Status: **BLOCKED FOR USER REVIEW**. The inactive candidate is preserved. No production migration, hosting, installation, reload/restart or N1-F implementation occurred.

## Blocking evidence

Actual frozen schema-1, B1 and B2 readers are executed in OS Temp. Their manifest decoders validate exact fields before schema dispatch. New schema-4 capability/scope fields produce recoverable validation rather than terminal `UNSUPPORTED_SCHEMA`. All three publication-manifest acceptance tests fail with `RECOVERY_REQUIRED`.

The actual schema-1 state validator also validates exact fields before version dispatch. With a deliberately lowered manifest, it recovers and opens an older ancestor; the test process returns its unexpected-success status 2. This violates the approved refusal to drop import state/select older ancestry. B1/B2 generation-level rejection passes. Historical reader bytes, prior tests, E1 source and frozen observations remain unchanged.

No weaker assertion or replacement fixture was introduced. Resolving this requires review of the schema-4 wire contract or a separate reader prerequisite. A passing older-reader barrier cannot be claimed for the present candidate.

## Retained work

The nine authorized existing files and fifteen new outputs implement the inactive import participant, schema-4 integrity relationships, preparation/reservations, atomic historical publication, lifecycle projection metadata, recovery scope, export guards, declarations and synthetic verification. The shared completion transition is unchanged. Publication uses the pure constructor and direct proven historical events/bindings, never reenacted completion.

E1 policies are reused unchanged, including complete-tree quarantine and Phase/date/content restrictions. The full capture is referenced through its preparation receipt. Current source creation/modification and recording times remain explicitly null when unknown. No actual vault History/check was used as an import corpus.

## Verification ledger

The stopped-gate archive contains `verification-runs.json` and per-run JSON with command/explicit files, start/end, scalar exit code, raw stdout/stderr paths and TAP summaries. Initial failures remain separately retained. Runner completion and test success are recorded independently.

Final counts and protected/build comparisons are appended after the awaited runs. This report does not certify the outstanding acceptance work.

## Remaining work after review

Choose and approve a compatibility remedy before further implementation. Then complete direct portable schema-4 execution proof, expanded relationship corruption cases, lost-preparation/current-pointer recovery variants, late persistent-fence publication checks, and preparation-only older-reader cases. Rerun the entire acceptance inventory and safety comparison on the approved final representation.

The tests executed here support only cooperative local persistence and actual process interruption. They do not prove power-loss, cloud rollback, hostile-writer, distributed uniqueness, complete-directory rollback detection or atomic N1-B plan consumption.

## Awaited final verification results

| Run | Result |
| --- | --- |
| e2-persistence-reviewed | exit 1; # tests 124; # pass 120; # fail 4 |
| e2-behavior-final | exit 0; # tests 43; # pass 43; # fail 0 |
| e2-statistics-final | exit 0; # tests 53; # pass 53; # fail 0 |
| e1-frozen | exit 0; # tests 138; # pass 138; # fail 0 |
| e1-current | exit 0; # tests 137; # pass 137; # fail 0 |
| regression-b2 | exit 0; # tests 189; # pass 189; # fail 0 |
| regression-b1 | exit 0; # tests 207; # pass 207; # fail 0 |
| regression-b0 | exit 0; # tests 22; # pass 22; # fail 0 |
| regression-gateA | exit 0; # tests 145; # pass 145; # fail 0 |
| regression-stepContent | exit 0; # tests 180; # pass 180; # fail 0 |
| regression-identity | exit 0; # tests 158; # pass 158; # fail 0 |
| regression-compatibility | exit 0; # tests 158; # pass 158; # fail 0 |
| regression-readiness | exit 0; # tests 51; # pass 51; # fail 0 |
| regression-core | exit 0; # tests 66; # pass 66; # fail 0 |
| regression-focused | exit 0; # tests 452; # pass 452; # fail 0 |
| regression-regression | exit 0; # tests 34; # pass 34; # fail 0 |
| regression-safeStrict | exit 0; # tests 48; # pass 48; # fail 0 |
| declaration-0 | exit 0; ; ;  |
| declaration-1 | exit 0; ; ;  |
| declaration-2 | exit 0; ; ;  |
| declaration-3 | exit 0; ; ;  |
| declaration-4 | exit 0; ; ;  |
| declaration-5 | exit 0; ; ;  |
| declaration-6 | exit 0; ; ;  |
| declaration-7 | exit 0; ; ;  |
| declaration-8 | exit 0; ; ;  |
| source-build-after | exit 0; ; ;  |
| postflight-health | exit 0; ; ;  |

E2 behavior: 43/43. E2 Statistics: 53/53, including all 47 frozen vectors and three time-zone children. E2 persistence: 120/124. Four failing assertions are the actual older-reader barrier cases described above; they are not skipped or treated as passes. The final verification runner itself exits successfully after recording every individual child exit code; that is not E2 test success.

E1: unchanged 138 assertions pass against the frozen pre-edit graph. The current graph runs 137 behavioral assertions; only the exact frozen-source-hash test is excluded there. It is executed unchanged in the frozen graph. Authorized current changes are independently hashed against nine preserved originals. All prior saved inventories match their required counts; the regression suite explicitly names all 34 files. Eight existing declaration checks plus the new E2 check pass with existing TypeScript 6.0.3; no compiler was installed.

Actual process interruptions: 31, separate from exception injection. Raw PID/host/token lock evidence and SHA256 are archived in actual-interruption-lock-evidence.json. Each child exited 73 at its selected stage; PID death and ownership evidence were checked before moving that exact lock inside the disposable store. Preparation, publication, reopening, recompletion and persistent fence stages are covered.

## Completed safety comparison

Sequential fresh baseline: 2,617 files, 470 Git entries, nine exact originals, actual pre-edit B2/schema-1 reader closures and frozen E1 source graph. All scans finished before implementation. The predecessor E1 archive verified 124 archived files and 13 current reviewed files. Earlier archive verification was repeated after execution without rewriting those archives.

Final comparison: nine authorized existing-file changes, fifteen authorized new files, 485 Git entries. All 470 original status entries remain present. Zero protected-file drift, missing original paths, unexpected new files or native generation/fence/lock artifacts outside backups. Existing Markdown, plugin data, History/checks/metadata, progress/Oath/Strict/device/owner/mount/shared/planning state, frozen evidence, nonallowlisted core and installed assets match the completed baseline. There was no independent workspace drift to restore.

All twelve Temp-staged production assets are byte-identical before/after. Main has 168 factories, Atlas 24; the one legacy Task Service construction and startup graph are unchanged. No import writer appears in the production main bundle. Plugin data remains byte-identical: 174 History rows, two checks. Read-only health checks retain the two pre-existing stale-project-card-order diagnostics; no repair was run.

## Sealed stopped-gate snapshot

Archive: `System/Backups/itacan-n1e2-20261018-8d875302`. Its evidence-inventory.json seals originals, reviewed source, baseline and comparisons, original request, execution-contract summary, reader fixtures/graphs, frozen E1 graph, explicit run lists/logs/exit codes, interruption evidence and twelve staged assets before/after. The execution-contract record is explicitly a summary of the approved chat plan, not a verbatim chat export. This is an incomplete-gate preservation archive, not an E2 acceptance certificate.

STOP FOR USER REVIEW. The existing implementation is preserved; production remains unchanged. No N1-F implementation or activation follows this report.
