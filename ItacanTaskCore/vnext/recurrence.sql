CREATE TABLE recurrence_series (
 id TEXT PRIMARY KEY, owner_id TEXT NOT NULL REFERENCES owners(id), revision INTEGER NOT NULL CHECK(revision>0),
 active INTEGER NOT NULL CHECK(active IN (0,1)), rule_json TEXT NOT NULL, template_json TEXT NOT NULL,
 created_at INTEGER NOT NULL, modified_at INTEGER NOT NULL
) STRICT;
CREATE TABLE occurrences (
 task_id TEXT PRIMARY KEY REFERENCES tasks(id), series_id TEXT NOT NULL REFERENCES recurrence_series(id),
 ordinal INTEGER NOT NULL CHECK(ordinal>0), series_revision INTEGER NOT NULL CHECK(series_revision>0),
 successor_id TEXT UNIQUE REFERENCES tasks(id), generated INTEGER NOT NULL DEFAULT 0 CHECK(generated IN (0,1)),
 UNIQUE(series_id,ordinal)
) STRICT;
CREATE INDEX occurrence_series ON occurrences(series_id,ordinal);
PRAGMA user_version=2;
