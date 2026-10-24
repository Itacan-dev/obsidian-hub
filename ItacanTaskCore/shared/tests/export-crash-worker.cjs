"use strict";
// Test-only filesystem wrapper around the actual transport publication.
const fs=require('node:fs/promises'),path=require('node:path');
(async()=>{const c=JSON.parse(await fs.readFile(process.argv[2],'utf8')),link=fs.link;
 fs.link=async(source,target)=>{if(path.basename(path.dirname(target))!=='heads')return link(source,target);if(c.stage==='after-link')await link(source,target);await fs.writeFile(c.signal,JSON.stringify({pid:process.pid,stage:c.stage,source,target}));await new Promise(()=>setInterval(()=>{},1000));};
 const transport=await require('../git-transport').createGitPacketTransport(c.transport);await transport.publish(c.packet);throw Error('Publication did not stop at the selected stage.');
})().catch(e=>{console.error(e.stack);process.exitCode=1});
