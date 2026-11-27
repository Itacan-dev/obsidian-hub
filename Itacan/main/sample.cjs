const fs = require('node:fs/promises');
const path = require('node:path');

async function copySample(source, parent) {
  const original = await fs.realpath(source);
  const container = await fs.realpath(parent);
  const relative = path.relative(original,container);
  if (relative === '' || !relative.startsWith('..'+path.sep) && relative!=='..' && !path.isAbsolute(relative))
    throw Error('Choose a location outside the example library.');
  let destination;
  for (let number=1; ;number++) {
    destination=path.join(container,number===1?'Field Library':'Field Library ('+number+')');
    try {await fs.mkdir(destination);break;}
    catch(error){if(error.code!=='EEXIST')throw error;}
  }
  try {
    for (const name of await fs.readdir(original)) {
      await fs.cp(path.join(original,name),path.join(destination,name),{recursive:true,force:false,errorOnExist:true});
    }
    return destination;
  } catch(error) {
    await fs.rm(destination,{recursive:true,force:true});
    throw error;
  }
}
module.exports={copySample};
