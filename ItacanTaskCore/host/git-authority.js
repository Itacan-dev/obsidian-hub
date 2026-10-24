"use strict";
// Device-local runtime authority, bound to a committed portable Git namespace.
const fs=require('node:fs/promises'),path=require('node:path'),A=require('./private-authority'),B=require('../shared/project-binding'),V=require('../src/value'),{check}=require('../src/errors');
function repositoryPath(b){return A.repositoryPath({version:2,localDataRoot:b.localDataRoot,vaultId:b.vaultId,deviceId:b.deviceId,owner:{type:'project',id:b.projectId}});}
async function validateBinding(b,directory){
 V.jsonValue(b);const fields=['version','vaultRoot','vaultId','deviceId','localDataRoot','projectId','projectRoot','dashboard','namespaceDigest'];V.fields(b,fields,fields);check(b.version===1,'Unsupported Git runtime binding.');V.uuid(b.projectId);V.text(b.deviceId);check(/^[a-f0-9]{64}$/.test(b.namespaceDigest),'Explicit namespace commitment required.');
 const vault=await fs.realpath(b.vaultRoot),local=await fs.realpath(process.env.LOCALAPPDATA),real=await A.ordinaryPath(directory);
 check(await A.registration(vault)===b.vaultId&&path.relative(local,await fs.realpath(b.localDataRoot))==='','Git runtime vault/local-data identity differs.');
 check(path.relative(await A.ordinaryPath(repositoryPath(b)),real)===''&&A.inside(local,real)&&!A.inside(vault,real)&&!A.inside(real,vault)&&real!==vault&&!directory.startsWith('\\\\'),'Git runtime authority path differs.');
 for(const cloud of [process.env.OneDrive,process.env.OneDriveConsumer,process.env.OneDriveCommercial].filter(Boolean)){const c=await A.ordinaryPath(cloud);check(c!==real&&!A.inside(c,real),'Cloud runtime authority rejected.');}
 for(let p=real;;p=path.dirname(p)){try{await fs.lstat(path.join(p,'.git'));check(false,'Runtime authority cannot be tracked by Git.');}catch(e){if(e.code!=='ENOENT')throw e}if(p===path.dirname(p))break;}
 const project=await B.admitProject({vaultRoot:vault,projectId:b.projectId,projectRoot:b.projectRoot,dashboard:b.dashboard});check(project.namespaceDigest===b.namespaceDigest,'Shared Project namespace changed.');return project;
}
module.exports={repositoryPath,validateBinding};
