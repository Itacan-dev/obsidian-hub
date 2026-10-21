# C1-B handoff: caller adoption, separately reviewed

C1-A implements only inactive disposable local-private transactions in actual HubDataStore. It does not activate a production profile, repair live legacy snapshot writes or implement any domain coordinator. See application-storage/README.md and ../tests/native-application-storage-c1-a-verification.md.

Before adoption, audit every actual caller and freeze its mutation/dependency unit: navigation/workspace state; settings/covers; progress/Statistics; task application metadata; Inbox/Quick Add; Oath; planning; Music/Spotify; audit and full-state restore. Map each full-snapshot caller to complete scoped replacements with explicit original presence/digests and required dependencies. Never retry by refreshing original guards or changing operation identity. Domain validation is a caller-adoption requirement, not an automatic property of portable JSON.

Review the allowed-scope declarations, domain validators, preservation of unrelated fields and all supported writer entry points together. A production lease/authority/location, old-binary compatibility and real-format transition require explicit review. C1-A exposes no existing-root conversion or installation path. Frozen blind writers are incompatible; a format marker does not constrain them.

Mixed categories/projectPlanning/taskMetadata/headerImagePlacements remain excluded. Their private/shared participant split and shared preparation/assets/rollback require another reviewed contract; local receipts cannot certify shared/Git publication. No automatic receipt pruning or old-snapshot restoration.

C2 must version persisted Oath enrollment/order/fulfillment evidence in its existing session/outcome authority. C3 must persist complete original native Inbox requests, reconcile creation separately from cleanup and retain deleted-target drafts for review. C4 must establish assignment admission and resumable delete-and-clear, including shared planning. C1-B alone makes none of those workflows atomic. Native receipts/admission/fences remain authoritative and cannot be overridden by application evidence.

Use real disposable interruption/restart tests, dependency/conflict cases, retained operation replay, old-reader/writer compatibility and reviewed bundle impact before any activation. Native UI is an independent track. STOP FOR USER REVIEW: this handoff authorizes no implementation, routing, real-data conversion, installation or reload.
