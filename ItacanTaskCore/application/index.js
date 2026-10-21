"use strict";
// Explicit inactive sibling import. No production registration or storage ownership.
module.exports = Object.freeze({ ...require("./service"), ...require("./native-adapter") });
