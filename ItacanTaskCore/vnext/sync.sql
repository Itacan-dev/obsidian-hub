-- Device-local synchronization bookkeeping. Transport files contain no SQLite files.
CREATE TABLE sync_settings (key TEXT PRIMARY KEY, value TEXT NOT NULL) STRICT;
CREATE TABLE sync_versions (unit TEXT PRIMARY KEY, version_json TEXT NOT NULL) STRICT;
CREATE TABLE sync_received (
 device_id TEXT NOT NULL, number INTEGER NOT NULL, operation_id TEXT NOT NULL UNIQUE,
 payload_json TEXT NOT NULL, payload_hash TEXT NOT NULL, state TEXT NOT NULL CHECK(state IN ('pending','conflict','applied','superseded')),
 PRIMARY KEY(device_id,number)
) STRICT;
CREATE INDEX sync_received_state ON sync_received(state,device_id,number);
CREATE TABLE sync_progress (device_id TEXT PRIMARY KEY, number INTEGER NOT NULL) STRICT;
CREATE TABLE sync_baseline (part INTEGER PRIMARY KEY, payload_json TEXT NOT NULL) STRICT;
CREATE INDEX history_task_counted ON history(task_id,counted);
PRAGMA user_version=3;
