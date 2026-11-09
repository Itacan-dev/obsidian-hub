"use strict";
const Module=require("module"),originalLoad=Module._load;
Module._load=function(name){return originalLoad.call(this,name==="@electron/remote"?process.env.ITACAN_TEST_REMOTE:name,...Array.prototype.slice.call(arguments,1));};
