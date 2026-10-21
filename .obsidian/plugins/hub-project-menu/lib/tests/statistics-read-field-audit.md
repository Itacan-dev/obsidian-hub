# Phase 2B-2E-2 source and field audit, before production edits

The fresh source build matches installed main.js SHA256
`8B20B6877F2D42CE1283B7E2B546950AEBD89E1D55A9B150160537A10ECC4F08`.
Original service, UI and domain sources are frozen in statistics-read-*-original.cjs.

| Source family | Original provider | Authorized change |
| --- | --- | --- |
| Completions | wizard.completedTaskHistory | Shared taskService.queryHistory recorded projection |
| Projects / Resources | getProjectRecords / getResourceTypes | None |
| Notes | vault.getMarkdownFiles, metadataCache.getFileCache, file.stat.ctime, current ownership | None |
| Activity | wizard.activityLog | None |
| Reports | getProgressReports(), getProgressReports({kind:"resource"}) | None |
| Oaths | wizard.data.oathsByDevice, every array history | None |

| Recorded evidence | Exact original Statistics use | Compatibility |
| --- | --- | --- |
| id | First truthy event ID wins, before timestamp filtering | Preserve scalar value, null/absence/empty/zero; never task ID |
| kind | Only exact string step counts as Step | Preserve raw value; other kinds count as task |
| timestamp | Finite numeric >0, <=Date maximum, <=snapshot now | No coercion, inference or archivedAt replacement |
| projectId | Truthy ID creates kind-qualified cohort; missing/falsy ID Unassigned | No name/path lookup |
| projectName, project | Unknown truthy ID label uses projectName ?? project ?? Deleted workspace | Add optional project evidence; no registry name matching |
| targetKind, contextKind | First non-null kind, if project/resource | Preserve precedence |
| resourceType, projectId prefix, path | Remaining historyKind fallbacks, in that order | Recorded source only; missing/moved source remains countable |
| task/Step/parent IDs, text, line, archivedAt, projectStatus/root/path | Not used in arithmetic or dedup | Retain generic recorded evidence, never substitute for event ID/time/owner |

Current registry ID matches retain today's name/status. Unknown IDs get deleted
cohorts with first accepted recorded name; duplicate display names never merge.
Legacy project name alone remains Unassigned, even when matching a current name.
Case, rename and collisions therefore cannot resolve identity. No task lookup occurs.

The Wizard getter filters null rows and shallow-copies in stored order. Statistics
originally filters falsy entries, deduplicates before validity filtering and does
not require title/path. The E1 projection rejects rows lacking string title/path;
E2 must retain safe partial recorded evidence for Statistics without displaying
previously invalid rows in Home/Project History. Unsupported statistically relevant
nonportable evidence must produce an explicit failure rather than false zeroes.

All calendar/aggregation code stays byte-identical, including local DST boundaries,
report-only cohort timing, surviving-note metrics, Oath clipping and truthy Oath IDs.
Original UI defaults to 3m, contrary to the prompt's stated All time default. The
user explicitly selected Change default to All time on 2026-10-16. Only that
intentional default selection differs from original loaded UI.

Only production caller: StatisticsModal.onOpen; plugin hubOpenStatistics prevents
duplicate entry modal and onunload closes it. Other uses are synthetic test hosts.
Supplied source renders synchronously. Unsupplied source needs one awaited coherent
snapshot, retryable failure, close/reopen generation guards and plugin cleanup.
Range/workspace controls operate solely on snapshot/cache; no subscriptions.
