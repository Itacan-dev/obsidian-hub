-- Device-local filesystem intent only. Never included in task synchronization.
CREATE TABLE pending_file_operations (
 slot INTEGER PRIMARY KEY CHECK(slot=1), operation_id TEXT NOT NULL UNIQUE,
 intent_json TEXT NOT NULL, intent_hash TEXT NOT NULL,
 progress_json TEXT NOT NULL, created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL
) STRICT;
PRAGMA user_version=5;
