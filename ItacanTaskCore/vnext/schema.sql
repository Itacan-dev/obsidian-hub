CREATE TABLE owners (
 id TEXT PRIMARY KEY, kind TEXT NOT NULL CHECK(kind IN ('project','resource')),
 external_id TEXT NOT NULL, label TEXT NOT NULL, available INTEGER NOT NULL CHECK(available IN (0,1)),
 UNIQUE(kind,external_id)
) STRICT;
CREATE TABLE tasks (
 id TEXT PRIMARY KEY, owner_id TEXT NOT NULL REFERENCES owners(id), revision INTEGER NOT NULL CHECK(revision>0),
 title TEXT NOT NULL, description TEXT NOT NULL, completed INTEGER NOT NULL CHECK(completed IN (0,1)), completed_at INTEGER,
 start_date TEXT, start_time TEXT, due_date TEXT, due_time TEXT, importance TEXT CHECK(importance IN ('should','must')),
 context_json TEXT, phase_id TEXT, created_at INTEGER NOT NULL, modified_at INTEGER NOT NULL, deleted_at INTEGER,
 CHECK((completed=0 AND completed_at IS NULL) OR (completed=1 AND completed_at IS NOT NULL)),
 CHECK(start_time IS NULL OR start_date IS NOT NULL), CHECK(due_time IS NULL OR due_date IS NOT NULL)
) STRICT;
CREATE INDEX task_owner_status ON tasks(owner_id,completed,id) WHERE deleted_at IS NULL;
CREATE INDEX task_status ON tasks(completed,id) WHERE deleted_at IS NULL;
CREATE INDEX task_due ON tasks(due_date,id) WHERE deleted_at IS NULL;
CREATE INDEX task_start ON tasks(start_date,id) WHERE deleted_at IS NULL;
CREATE TABLE steps (
 id TEXT PRIMARY KEY, task_id TEXT NOT NULL REFERENCES tasks(id), position INTEGER NOT NULL CHECK(position>=0),
 text TEXT NOT NULL, completed INTEGER NOT NULL CHECK(completed IN (0,1)), completed_at INTEGER,
 created_at INTEGER NOT NULL, modified_at INTEGER NOT NULL, deleted_at INTEGER,
 CHECK((completed=0 AND completed_at IS NULL) OR (completed=1 AND completed_at IS NOT NULL))
) STRICT;
CREATE UNIQUE INDEX step_position ON steps(task_id,position) WHERE deleted_at IS NULL;
CREATE INDEX step_task ON steps(task_id,position);
CREATE TABLE operations (
 sequence INTEGER PRIMARY KEY AUTOINCREMENT, operation_id TEXT NOT NULL UNIQUE,
 command_hash TEXT NOT NULL, result_json TEXT NOT NULL, committed_at INTEGER NOT NULL
) STRICT;
CREATE TABLE history (
 id TEXT PRIMARY KEY, operation_id TEXT NOT NULL REFERENCES operations(operation_id) DEFERRABLE INITIALLY DEFERRED,
 task_id TEXT NOT NULL REFERENCES tasks(id), step_id TEXT REFERENCES steps(id), owner_id TEXT NOT NULL REFERENCES owners(id),
 title TEXT NOT NULL, parent_title TEXT, completed_at INTEGER NOT NULL,
 counted INTEGER NOT NULL CHECK(counted IN (0,1)), reopened_at INTEGER,
 CHECK((counted=1 AND reopened_at IS NULL) OR (counted=0 AND reopened_at IS NOT NULL))
) STRICT;
CREATE UNIQUE INDEX history_active ON history(task_id,ifnull(step_id,'')) WHERE counted=1;
CREATE INDEX history_owner_time ON history(owner_id,completed_at,id);
CREATE INDEX history_time ON history(completed_at,id);
CREATE INDEX history_task ON history(task_id,step_id,completed_at);
CREATE INDEX history_counted_owner ON history(owner_id,counted,completed_at);
CREATE TABLE outbox (
 sequence INTEGER NOT NULL REFERENCES operations(sequence), owner_id TEXT NOT NULL REFERENCES owners(id),
 operation_id TEXT NOT NULL REFERENCES operations(operation_id), change_json TEXT NOT NULL,
 PRIMARY KEY(owner_id,sequence)
) STRICT;
CREATE INDEX outbox_sequence ON outbox(sequence);
CREATE TABLE consumer_cursors (
 consumer_id TEXT NOT NULL, owner_id TEXT NOT NULL REFERENCES owners(id), sequence INTEGER NOT NULL CHECK(sequence>=0),
 PRIMARY KEY(consumer_id,owner_id)
) STRICT;
PRAGMA user_version=1;
