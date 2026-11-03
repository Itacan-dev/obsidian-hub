# Flat Step structure and private task content

See [the active flat-Step model](FLAT-STEPS.md). Every Step belongs directly to one Task.

`task.editStructure` accepts a complete ordered draft with `state`, `id`, `order`, `title`, `body`, and `completed`, explicit `{stepId}` deletions, a Task title/description patch and guarded current content. Existing Steps retain identity and completion; new structural Steps start open. Full-draft order must be exactly zero through n−1. Reordering and deletion never traverse descendants. Completion uses the existing completion command or atomic Save intention.

The Task revision, identity reservations, exactly-once receipts, source preservation and crash recovery guarantees are unchanged. The persisted v1 ancestry slot is retained only for historical evidence; new records store null. No ancestry field is required by the active draft type.

## Historical evidence and private content

The following source-envelope interpretation exists to validate original retained evidence. It does not discover Markdown tasks or enable nested native Steps.

Private content uses the existing private `task.migration.evidence` JSON carrier under reserved `format:"itacan-private-task-content"`, version 1, decision revision `N1-C-D05-D06-r1` and exact required capability `private-source-content-v1`. It contains:

- `previousEvidence`: the exact prior generic evidence value, retained unchanged.
- `originals`: append-only validated source envelopes; at most one immutable capture per native task/Step target.
- `revisions`: append-only current content revisions, in the same native state as hierarchy and receipt.

Existing migration source/sourceId/importedAt are preserved. If absent, the extension creates `{source:"private-native-content-v1",sourceId:task.id,importedAt:null,evidence:...}`. That carrier tag does **not** assert a completed migration, source association, alias mapping or identity-plan consumption. Generic legacy evidence outside this reserved format is not interpreted or rewritten. This opt-in reserved namespace is part of the contract; any future producer using it must implement its exact reader/writer rules.

Each content revision records its own version/sequence, native task revision, operation ID, current continuation/live Step bodies, removed Step IDs, native fingerprint, complete original ID/checksum prefix, previous-evidence digest, previous revision digest and own digest. Its latest native fingerprint/revision/body IDs must match the task. State validation also checks retained content against committed receipt snapshots, rejecting a stripped carrier or rewritten history. Original checksums and prior generic evidence are bound into the revision chain; removing original captures cannot turn corruption into empty content.

`task.update`, Step update/add/reorder/delete/complete, and other existing task mutations automatically advance the content/native relationship if the task actually changes. Old add has an empty current body; deletion removes a live body but retains prior revisions. Task owner relocation retains the original physical source owner as historical provenance. No source note is edited. Same-command retries return the original receipt/result before checking current task revisions; changed payload under the same operation ID conflicts. Stale task/content revisions have no effects.

Checksums are integrity/corruption checks, not signatures or proof against a hostile writer replacing all history and receipts. Storage growth is intentionally unbounded in these fixtures; production retention/compaction needs separate review.

## Private source envelope

`captureSourceEnvelope(bytes, request)` takes a **Uint8Array of original document bytes**, never an implicitly re-encoded string. Request fields: `id`, `version:1`, `parserVersion:1`, `source`, `target`, zero-based `line`, `expectedRange` or null, explicit JSON `metadata`, and `explicitDescription` string or null.

`source` requires stable caller-supplied document ID, forward-slash source path/root, source revision and exactly one physical Project/Resource owner. The path must be inside the supplied root, without empty/traversal components. `target` requires native task UUID, Step UUID or null, and captured native task revision. On attachment the task/Step target is checked and the source owner must equal the native owner. These are explicit synthetic caller assertions; this helper neither scans a vault nor authenticates an N2 registry/root claim.

| Envelope field | Meaning |
|---|---|
| `format`, `version`, `parserVersion`, `decisionRevision` | Explicit private envelope/parser/decision compatibility |
| `id`, `privacy:"local-private"` | Capture identity and mandatory classification |
| `source`, `target` | Physical provenance and native revision association |
| `document` | SHA-256 and byte length of supplied complete document, without duplicating its contents |
| `region` | Zero-based line, absolute half-open byte range `[start,end)`, selected-line fence context |
| `raw` | Original range encoded as lowercase hex, encoding state, SHA-256 and EOL statistics |
| `unresolvedContext` | Separate retained excluded tail and digest if an unclosed fence makes the boundary ambiguous |
| `folderContext` | Source parent folder evidence with `noteAssociation:false`; no native location registry |
| `parsed` | Versioned derived normalized Markdown, status/title/continuation/Step ranges, explicit metadata/description and diagnostics |
| `checksum` | SHA-256 of canonical envelope with `checksum:null` |

The portable SHA-256 implementation is verified against Node crypto for standard, long and multibyte vectors. Canonical JSON uses the existing core's recursive sorted-key representation. Content revision digests hash the canonical revision with `digest:null`; native fingerprint replaces only `migration.evidence` with null, retaining the migration source/revision metadata. Hex decodes directly to original bytes; normalized text is never used to reconstruct them.

Supported UTF-8 decoding is fatal and retains BOM in the derived text. Byte scanning recognizes LF, CRLF and lone CR. EOL counts, final newline and region BOM are recorded. Offsets always count bytes, including multibyte prefixes/BOM, never JavaScript UTF-16 code units. Mixed EOL, tabs/spaces, trailing whitespace, Unicode combining characters/emoji, links, tags, comments and hidden/block IDs remain exact in `raw`.

`originalBytes(envelope)` validates and returns fresh captured-region bytes. It does not return an entire note. `verifySourceEnvelope(envelope, fullBytes, source)` additionally verifies full-document digest, source revision/path/owner and recapture; moved/renamed/replaced/edited/deleted source fails explicitly. Full-document mismatch intentionally fails even if only unrelated note text changed. It never allocates/rebases identities. Matching the same captured original can be retried; changing its ID/label cannot replace or rebase the original target's evidence.

## Parsing and unsupported constructs

The parser is deliberately a source-region interpreter, not a Markdown importer. It uses the established indented list-item region boundary: parent line plus indented continuations; blank lines belong only when followed by an indented continuation. A sibling parent or following unindented prose ends the region. Current legacy block boundaries/snapshots are compared using unchanged N1-A content vectors.

Child checkbox ranges preserve source ancestry through intervening prose/ordinary list items. Steps beneath non-task lists remain related through enclosing checkbox ranges. Quoted examples and content inside backtick/tilde fences are not eligible Steps. Fence closing requires matching character and sufficient length. Parsed `parentIndex` addresses another parsed Step, not a native UUID; `line` is region-relative and `startByte/endByte` absolute document offsets. Direct Steps have null parsed parent. Native IDs/order are never inferred from line numbers or titles.

Parsed title removes only the recognized legacy Hub-comment display syntax; original bytes retain it exactly. Normalized Markdown changes EOL to LF only. Parsed continuation is a non-checkbox-line projection, including ordinary lists/prose/fence examples; complete original syntax remains in raw bytes. Metadata/explicit description are caller-supplied evidence, never inferred from prose or interpreted into dates/recurrence/completion.

Typed status is `supported-region` or `quarantined`, with explicit diagnostic codes. Non-task/quoted selected lines, selected fenced examples, unknown parent/child checkbox statuses, uninterpreted Tasks/inline metadata syntax, unknown HTML comments/Hub IDs, lone CR and unclosed fences quarantine interpretation. Invalid UTF-8/UTF-16 preserves the complete supplied bytes as unsupported evidence with null decoded text, rather than guessing a region or normalizing bytes. Unclosed-fence excluded text is retained separately as unresolved context and never promoted to current content. `supported-region` proves neither supported import nor semantic conversion of arbitrary metadata.

Range mismatch, checksum/derived-field corruption, missing evidence or wrong owner rejects. Unknown mandatory fields fail closed. Missing/newer envelope/parser/content/draft/command versions or unknown content capabilities are unsupported; there is no automatic downgrade, lossy rewrite or reparse/upgrade operation. Reconstructing a fully equivalent source note from native edits is unverified and unsupported.

## Privacy and future Search

`currentSearchProjection(task, expectedOwner)` returns an explicitly **unverified specimen** containing current title, explicit description, current continuation, current Step titles/bodies/ancestry/order and native importance/start/due/phase. It validates physical owner scope. It includes no source paths, original bytes, prior evidence, old revisions, History/Oath/identity plans or raw envelopes. A source-independent native task requires no TFile, comment ID or fabricated note path. This is not a public export or a production Search/index/navigation endpoint.

Tests explicitly choose current values from five unchanged N1-A vectors to demonstrate title scoring, separate multiline description, formatting/link text, continuation, Step body, metadata and same-title different content. Such choices are fixture decisions, not an automatic provenance import. Existing pure `nameScore` is exercised (exact match score is zero); production ranking/full-content matching/parity remain unverified.

Public packets continue through the existing allowlisted owning-Project serializer, which excludes the entire migration/captureSource carrier. Thus this phase's private current Step bodies/continuation also remain local; a future public current-content schema requires review. The two shared Projects are distinct; all four Resources and private Projects remain private. Mount visibility never transfers ownership or expands exports. Full generations, receipts, original captures, identity/quarantine, History/Oath and Strict/device evidence are never Git packets.

## Transaction, crash and recovery limits

Memory transactions and the existing JSON adapter use the same detached candidate validation and receipt machinery. JSON stages/flushes/verifies a complete generation, then replaces the checksummed `CURRENT.json` pointer. That pointer publication is the commit boundary for structure/content/retired IDs/receipt together. Precommit faults expose the old complete state; postcommit reply loss recovers/replays the new complete state once. Failed staging may leave private orphan files which are never selected as tasks.

Tests cover actual partial writes/publication, receipt and hierarchy/content fault hooks, acknowledgement loss, two concurrent edits, process exit at seven boundaries and reopening. Abandoned locks block open; explicit disposable recovery reuses N1-B's unchanged exact-lock/dead-process evidence-preserving helper. No automatic stale-lock removal exists.

Known-version corrupt current generations follow the **existing core's reported committed-ancestry recovery**; tests recover an intact prior task/content pair and retain original evidence. This can roll back an entire last native revision and its receipt; it is not latest-state repair or a no-data-loss guarantee against disk corruption. If no verified committed ancestor exists, open fails. Unsupported newer private contracts raise `UNSUPPORTED_SCHEMA` and cannot be downgraded through ancestry. Transient reopening I/O failure preserves files and fails explicitly.

Durability claims are limited to tested local disposable single-writer storage, cooperating leases and same-state publication. Directory fsync is best effort; universal power-loss/cloud/OneDrive durability, hostile writers, cross-device coordination, cross-store N1-B plan consumption, production host/registry/retention and real-vault activation remain unproven/deferred.

## Synthetic API example

Run only in a standalone disposable test process. This example creates memory-only data and no Markdown/source evidence:

```js
const core = require('./src');
const taskId = '20000000-0000-4000-8000-000000000001';
const stepId = '20000000-0000-4000-8000-000000000201';
async function example() {
    let sequence = 3000;
    const repo = await core.createMemoryRepository({
        clock: () => 1792224000000,
        idFactory: () => '20000000-0000-4000-8000-' + String(++sequence).padStart(12,'0'),
        partitions: [{id:'private',kind:'private-project',owner:{type:'project',id:'private'}}]
    });
    try {
        const {task} = await repo.execute({type:'task.create',operationId:'create',
            payload:{task:{id:taskId,owner:{type:'project',id:'private'},title:'Synthetic'}}});
        const result = await repo.execute({type:'task.editStructure',operationId:'insert',
            taskId,expectedRevision:task.revision,payload:{version:1,
                draft:{version:1,taskId,expectedRevision:task.revision,steps:[{
                    state:'new',id:stepId,parentStepId:null,order:0,
                    title:'First Step',body:'Current body',completed:false}]},
                deletions:[],taskPatch:{description:'Explicit description'},
                content:{version:1,expectedRevision:0,appendOriginals:[],continuation:'Current prose'}}});
        return core.currentSearchProjection(result.task,result.task.owner);
    } finally { await repo.close(); }
}
```

No public command consumes an identity plan, imports a completion event, executes recurrence, changes local date policy, routes Oath aliases or activates a real repository. **STOP FOR REVIEW after N1-C.**
