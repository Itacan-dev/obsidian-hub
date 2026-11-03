-- Retained logical changes bridge existing transports. No additional task model.
CREATE TABLE sync_changes (
 sequence INTEGER PRIMARY KEY AUTOINCREMENT,
 operation_id TEXT NOT NULL UNIQUE,
 payload_json TEXT NOT NULL
) STRICT;
CREATE TABLE sync_git_members (
 project_id TEXT NOT NULL, task_id TEXT NOT NULL, payload_json TEXT NOT NULL,
 PRIMARY KEY(project_id,task_id)
) STRICT;
CREATE INDEX sync_git_members_task ON sync_git_members(task_id);
PRAGMA user_version=4;
