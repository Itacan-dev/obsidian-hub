# Join the existing native shared Projects

Primary migration is complete locally. Remote publication is pending authorization; Jinhao has not yet joined. Do not run a migration executor or create another genesis.

## Before opening Obsidian

1. Keep every older task-writing client closed. Close Obsidian normally.
2. Preserve your local .obsidian/plugins/hub-project-menu/data.json and uncommitted/untracked/ignored Git work in a device-private backup outside the vault. Keep your History; never copy the primary's data.json or native repository. Preserve local changes to System/Hub-shared-projects.json too.
3. Inspect your checkout using git status --short and git diff --cached --name-only. For additional tracked-change backups, these commands do not change the checkout:

       git diff --binary --output="C:/your-private-backup/working.patch"
       git diff --cached --binary --output="C:/your-private-backup/staged.patch"

   Patches exclude untracked/ignored files; back those up separately. Do not reset, clean, force-merge or stage all unrelated work.
4. Obtain the complete compatible-client package from the primary. Preserve previous installed assets. Copy only the twelve files listed in COMPATIBILITY.json into your plugin folder, retaining relative paths. The package contains no user data, device identity or authority.
5. From the package folder run:

       node verify-client.cjs "C:/your-vault/.obsidian/plugins/hub-project-menu"

   All twelve hashes must match. Required main SHA-256:
   e7f954071182052d2bc73de4259a9e13536b3e30666e1534108b90b9cdbc34b1

   Windows desktop was tested. A different OS requires supported authority-path admission checked before writes.

## Receive the published baseline

Only after the primary confirms remote publication, receive this exact handoff commit:

ac909287f196495f2ff0e57d3b7e92393bf89e6d

Its parent migration commit is c5095f2a7bfd9594859f2700df98ee03664ea4f2.

    git fetch origin
    git show --stat ac909287f196495f2ff0e57d3b7e92393bf89e6d
    git merge --ff-only ac909287f196495f2ff0e57d3b7e92393bf89e6d

If fast-forward or local-file protection fails, stop and preserve changes. Do not force-reset or run a second cutover. Review overlapping work with the primary. Migration changes four task notes, .gitignore and portable .itacan-native files; it does not replace your application data. History is local in ignored data.json. The tracked System shared file holds Project planning/metadata, not Legacy completion History.

## Open and join

Open the compatible client. Ordinary metadata-ready startup validates the committed binding and retired sources, reserves each owner against Legacy writes immediately, then creates only your device-local authority and receives validated portable evidence. Do not copy the primary's device ID or local native files. Interrupted joining reconciles saved CUTOVER/ACTIVATION evidence.

| Project | Project UUID | Shared authority | Genesis revision |
| --- | --- | --- | --- |
| Itacan | 4b597e3b-b588-4a29-969b-70db3a684112 | 29233647-49ee-8061-9291-1d1d6c7d20ce | efa5ee9f-2e72-42c4-8957-df46d4e325cd |
| Obsidian Hub | 9325047c-eb3d-43e7-92f2-a9bf630afe13 | 44f5d46b-cb87-83cd-ae30-ec18dfc21548 | 96b2fae6-8b56-43aa-9ddf-b579bbeb843d |

Relative physical roots remain Projects/Itacan and Projects/Obsidian Hub; local absolute vault paths and device identities may differ.

Confirm both owners are native/ready, task lists are empty, original local History remains, and Native task recovery shows Git status. Verification tasks are deleted; their immutable proofs/tombstones remain. No old tasks or History are imported.

Close normally, confirm a clean restart, and send the primary the checker result, received commit SHA and both ready statuses. Keep old task-writing clients closed. Live joining remains unverified until this is done.

## Normal collaboration

Native edits publish portable evidence under .itacan-native/v3/<authority>/. Git exchanges these files; the application validates received data on startup/file notifications and through Native task recovery ? Process Git task changes. Review/commit only intended portable files with your normal workflow. Local publication does not mean another client received it. Conflicts remain explicit. No automatic remote push/pull occurs.

Required: packet3, origin frame2, namespace2, receive2, reservation witness2, retention marker2, host API3 and git-shared-compact-proofs-v2. Unsupported Oath/Inbox/Phase/recurrence/nested-editor/clear-completed actions remain guarded.
