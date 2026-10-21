# N3-C handoff — separate review required

N3-B2-B implements inactive atomic `task.save` / `task.createRich`, mandatory
creation-time private capability, validated completion effects, coherent private
proof v2 and application v2 supplied drafts. See
[ATOMIC-TASKS.md](../../../../../ItacanTaskCore/ATOMIC-TASKS.md) and the
[B verification report](../tests/native-atomic-task-n3-b2-b-verification.md).
The frozen N3-B2-A contract and earlier reports remain unchanged.

Production still constructs the Legacy Task Service. No native routing, root
conversion, migration, installation, reload, Oath adoption or N3-C implementation
is included.

Future N3-C review must define durable full-request/authority/receipt linkage for
Inbox Send and Quick Add, then reconcile native commitment separately from
capture acknowledgement/removal. Translation or task commitment alone is not a
successful complete Inbox workflow. Live Phase/planning consistency needs its
own reviewed coordination contract.

Partial-success recovery must retain the exact admitted request and original
operation until authoritative reconciliation and identical replay establish the
native result. A missing receipt is not permission to replace IDs or regenerate
a successor. Future migration must separately coordinate published N1-B plans,
source revisions, committed-tree protection and native receipts; these remain
independent authorities rather than an atomic plan-consumption transaction.

Native task publication and Oath persistence remain separate. Current binding
and verified Save effect can establish genuine native work, but ordinary or
restored enrollment still cannot prove independent durable save order. The F2
closed synthetic witness remains volatile. Tests preserve the failed-save /
reopen / reconstruction case in which an unsaved fulfillment latch is lost.
No new outcome store, intent journal, latch recovery or cross-authority atomicity
is established.

Interactive rich editor loading remains unavailable. A future private coherent
draft must supply complete editable content, current completion display, all
Steps and task/content/tree/binding/partition/recurrence guards with host,
registry, identity, inventory and Phase pins. It must exclude originals, raw
receipts and unrelated History. Source-less tasks must remain supported.

Prepared recurrence Save completion/generation remains rejected. Reopening and
occurrence-local edits preserve the successor, selected template and spent
outcome; standalone `recurrence.complete` retains generation authority. Native
clear-completed, child promotion, source-position editing, cross-owner movement
and direct Markdown synchronization remain deferred.

Enabled roots with known fallback block all mutations and replay. There is no
unfence, substitute-root or replacement-identity path. Preserve the existing
private-v4 root/lease/authority barriers and all export guards. Any new persisted
coordination or recovery contract requires a fresh reviewed gate, safety baseline
and exact allowlist. N4 owns sharing; N5 rehearsals; N6 activation; N8 task UI.

STOP FOR USER REVIEW. Do not begin N3-C automatically.
