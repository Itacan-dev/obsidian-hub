"use strict";
module.exports={createOneDriveTransport:input=>(input.binding.version===2?require("./onedrive-transport-v2"):require("./onedrive-transport-v1")).createOneDriveTransport(input)};
