# Itacan SQLite TaskCore

Ordinary Work uses the SQLite engine in `vnext/`. The public package entry point and type contract expose this engine only. Personal OneDrive task synchronization exchanges committed changes while databases and device identities stay local; see [synchronization](vnext/SYNCHRONIZATION.md).

One device-local database and one Electron utility process serve all Project and Resource owners. SQL, transactions and database close run in that process. The renderer receives committed Tasks, revisions, completion events and targeted changes.

Run the focused correctness suite with `npm test --prefix ItacanTaskCore`. See [the implementation guide](vnext/README.md) and [the installation report](vnext/INSTALLATION.md) for behavior, evidence, installed hashes and limitations.

The previous engine is excluded from the installed dependency graph. Its exact closed software, repositories, History and relevant application state are archived outside OneDrive. Inactive historical source directories remain in this working tree because automatic approval rejected broad recursive source/test deletion; their concrete cleanup plan is linked in the installation report. They are not a runtime fallback.
