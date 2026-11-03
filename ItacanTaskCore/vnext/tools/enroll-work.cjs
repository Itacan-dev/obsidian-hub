"use strict";
// One-time stationary enrollment preparation, after accepted software is copied
// and Work is closed. No task, Step, History, operation or outbox row is edited.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),{DatabaseSync}=require('node:sqlite'),{createHash}=require('node:crypto');
const stageRoot=path.resolve(process.argv[2]??''),base=path.join(process.env.LOCALAPPDATA,'Itacan/DevelopmentEvidence/TaskCoreVNext');assert(stageRoot.startsWith(base+path.sep));
assert(JSON.parse(fs.readFileSync(path.join(stageRoot,'WORK-UPDATE.json'))).pass);
const file=path.join(process.env.LOCALAPPDATA,'Itacan/TaskCore/aad4db1ab68225712aa322ee/tasks.sqlite'),fixtureFile=path.join(base,'production-stage-20261102-14/pre-update-tasks.sqlite');
const {TaskEngine}=require(path.resolve(__dirname,'../../../.obsidian/plugins/hub-project-menu/lib/sqlite-taskcore/engine.cjs')),S=require('../sync-data.cjs');
const digest=value=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
function taskRows(db,id){return{task:db.prepare('SELECT * FROM tasks WHERE id=?').get(id),steps:db.prepare('SELECT * FROM steps WHERE task_id=? ORDER BY id').all(id),history:db.prepare('SELECT * FROM history WHERE task_id=? ORDER BY id').all(id),occurrence:db.prepare('SELECT * FROM occurrences WHERE task_id=?').get(id)??null};}
function preserved(db){return Object.fromEntries(['owners','tasks','steps','history','recurrence_series','occurrences','operations','outbox','consumer_cursors'].map(t=>[t,digest(db.prepare('SELECT * FROM '+t+' ORDER BY rowid').all())]));}
(async()=>{const old=new DatabaseSync(fixtureFile,{readOnly:true}),engine=new TaskEngine(file);try{
 assert.equal(S.setting(engine,'workspace'),null,'Work is already enrolled');
 const before=preserved(engine.db),excluded=[];
 // That closed installation snapshot contains only documented disposable,
 // deleted/uncounted acceptance tasks. Refuse changed or revived identities.
 assert.equal(old.prepare('SELECT count(*) n FROM tasks WHERE deleted_at IS NULL').get().n,0);assert.equal(old.prepare('SELECT count(*) n FROM history WHERE counted=1').get().n,0);
 for(const row of old.prepare('SELECT id FROM tasks').all())if(digest(taskRows(old,row.id))===digest(taskRows(engine.db,row.id)))excluded.push(row.id);
 await engine.syncTransaction(e=>{S.set(e,'baselineExclusions',excluded);return{value:true};});
 assert.deepEqual(preserved(engine.db),before,'Enrollment preparation changed production rows');
 fs.writeFileSync(path.join(stageRoot,'WORK-ENROLLMENT-PREP.json'),JSON.stringify({pass:true,file,fixtureFile,excludedTaskIds:excluded,preserved:before,activeTasks:engine.one('SELECT count(*) n FROM tasks WHERE deleted_at IS NULL').n,baselineTasks:S.initialData(engine).tasks.length},null,2));
 console.log(JSON.stringify({pass:true,excludedKnownFixtures:excluded.length,baselineTasks:S.initialData(engine).tasks.length,productionRowsUnchanged:true}));
 }finally{old.close();await engine.close();}})().catch(e=>{console.error(e);process.exitCode=1});
