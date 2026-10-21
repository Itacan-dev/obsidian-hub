# N1-D Gate B0 evidence and proposed specification

This directory is test-only. It exports no native core feature, schema, command or store. D10 has not been approved. The proposal vectors describe desired behavior; their checks validate document consistency, not an implemented recurrence engine.

`evidence.json` is a new frozen observation set, independent of N1-A and Gate A. SHA256: `84B7BA46833BB6044CE936834D94E39BD0934534557CC6FEA6337AD474A319BB`. It records three process timezones: Europe/Stockholm, UTC and America/New_York. Each has 52 configured installed-Tasks cases, six transformation chains, four nested-Step splice cases, fourteen manually supplied clock-pair comparisons and four synthetic Map-host metadata/writer cases. These are 240 mixed evidence groups, not 240 native recurrence tests.

`harness.cjs` reuses the frozen Gate A fake host. It extends only the test harness's returned accessor in memory to inspect actual bundled RRule options/results; it does not alter installed recurrence algorithms. The RRule probe cutoff is explicitly labelled and can differ from Tasks' own reference. Original options are snapshotted before Tasks' month/year helper mutates `dtstart`.

Installed provenance is pinned in tests: Tasks 8.4.0, bundle `2B4F9CE24D26F1D0CB191DCA9A73477454D256E03E51D81F37FAEEE7A293AD1B`; Moment 2.29.4, `ECB84D57D5A7E3EC5F115BEF667656F2B9EDE90A03020525A2AF3573EA277453`. Actual user settings are never loaded. Every case carries synthetic settings, status definitions, clock and exact line. The default clock is `1792224000000`; explicit overlap/midnight cases carry their own clocks. Moment comes from the installed Obsidian ASAR as data; no Obsidian process is started.

The fake Tasks VM has no real vault, filesystem, network or plugin lifecycle. The Map host exercises current Itacan callbacks without `onload`. Clock-pair cases call the existing Gate A temporal classifier on manually selected endpoints; they do not calculate future occurrences. There is no native generation runner behind the proposed vectors.

Reproduce with the audit archive's `evidence/run-node.ps1` and its OS-Temp-only `isolation-guard.cjs` preloaded:

```text
node --require <OS-Temp>/isolation-guard.cjs --test ItacanTaskCore/temporal/b0/evidence.test.cjs ItacanTaskCore/temporal/b0/specification.test.cjs
```

On this host, Node is supplied by VS Code with `ELECTRON_RUN_AS_NODE=1`; the recorded wrapper launches it hidden. Tests spawn three isolated zone workers and compare complete output to frozen observations. Do not replace this with executing the plugin in Obsidian, real user settings or real task files.

The product decisions and proposed record contracts are in `lib/services/TASK-SERVICE-D10-DECISIONS.md` and `TASK-SERVICE-D10-CONTRACTS.md` under the Hub plugin. The evidence report identifies deliberate differences from Tasks. Gate B0 ends at review.
