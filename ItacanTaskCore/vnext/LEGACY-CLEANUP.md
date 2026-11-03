# Inactive legacy source cleanup for approval

No deletion has been executed. The installed application and public TaskCore package use SQLite only. The following 28 inactive paths contain 524 files; every file matches its copy in the verified closed archive outside OneDrive. The [exact JSON plan](<C:/Users/El_Baraka 2025/AppData/Local/Itacan/DevelopmentEvidence/TaskCoreVNext/production-stage-20261102-10/RETIREMENT-PLAN.json>) records every relative filename, byte count and SHA-256.

Approval would authorize removal of these source paths only. It would preserve `ItacanTaskCore/vnext`, the public package/README, original native repositories, old History, archives/evidence, unrelated source, notes, project structures and application settings. Automatic approval review rejected the earlier broad recursive source/test cleanup because it did not recognize authorization for that scope.

| Path relative to Work | Files |
| --- | ---: |
| ItacanTaskCore/application | 21 |
| ItacanTaskCore/atomic-task | 21 |
| ItacanTaskCore/coordination | 14 |
| ItacanTaskCore/demo | 22 |
| ItacanTaskCore/editor | 7 |
| ItacanTaskCore/history | 12 |
| ItacanTaskCore/host | 33 |
| ItacanTaskCore/identity | 13 |
| ItacanTaskCore/integration | 89 |
| ItacanTaskCore/oath | 5 |
| ItacanTaskCore/perf | 22 |
| ItacanTaskCore/personal | 66 |
| ItacanTaskCore/product-ui | 12 |
| ItacanTaskCore/shared | 46 |
| ItacanTaskCore/src | 51 |
| ItacanTaskCore/temporal | 15 |
| ItacanTaskCore/tests | 44 |
| ItacanTaskCore/writer | 21 |
| .obsidian/plugins/hub-project-menu/lib/services/native-task-host-multi.js | 1 |
| .obsidian/plugins/hub-project-menu/lib/services/native-task-activation.js | 1 |
| .obsidian/plugins/hub-project-menu/lib/services/native-personal-activation.js | 1 |
| .obsidian/plugins/hub-project-menu/lib/services/native-personal-sync.js | 1 |
| .obsidian/plugins/hub-project-menu/lib/services/native-git-activation.js | 1 |
| .obsidian/plugins/hub-project-menu/lib/services/native-git-transition.js | 1 |
| .obsidian/plugins/hub-project-menu/lib/services/native-git-inventory.js | 1 |
| .obsidian/plugins/hub-project-menu/lib/services/native-git-watch.js | 1 |
| .obsidian/plugins/hub-project-menu/lib/services/native-task-shutdown.cjs | 1 |
| .obsidian/plugins/hub-project-menu/lib/ui/native-personal-resolution.js | 1 |

Before any approved deletion, resolve and check every absolute target remains under the intended Work source root, recheck every source/archive hash against the plan, and stop if anything has changed. Use native PowerShell literal paths end-to-end. Never include the archived or original native repositories in the removal.
