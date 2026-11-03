"use strict";
// Disposable installed-host peer, running SQLite in a second real utility.
const {utilityProcess}=require('electron'),{openTaskService}=require('../host/electron.cjs'),path=require('node:path');
const peers=new Map();let serial=0;
exports.open=async({file,vault,authorityId,entry})=>{if(!path.resolve(file).startsWith(path.join(process.env.LOCALAPPDATA,'Itacan/DevelopmentEvidence/TaskCoreVNext')+path.sep))throw Error('Owned disposable peer required');const peer=openTaskService({utilityProcess,file,entry,syncOptions:{vault,authorityId,automatic:false}}),key=++serial;peers.set(key,peer);await peer.client.ready;await peer.client.call('syncNow');return key;};
exports.call=async(key,method,...args)=>{const peer=peers.get(key);if(!peer)throw Error('Unknown disposable peer');return peer.client.call(method,...args);};
exports.close=async key=>{const peer=peers.get(key);if(!peer)return;const exit=new Promise(r=>peer.child.once('exit',r));await peer.client.close();await exit;peers.delete(key);return true;};
