"use strict";
module.exports={createPersonalPort:options=>(options.options.personalSync.binding.version===2?require("./personal-port-v2"):require("./personal-port-v1")).createPersonalPort(options)};
