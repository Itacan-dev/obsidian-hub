"use strict";
// Fixed data-only model crossing the existing Strict dock boundary.
const keys=["background","text","button","border","focus"];
function validateDockColors(payload) {
    if (!payload || payload.version!==1 || !Number.isSafeInteger(payload.revision) || payload.revision<0 || Object.keys(payload).sort().join()!=="colors,revision,version" || !payload.colors || Object.keys(payload.colors).sort().join()!==keys.slice().sort().join() || keys.some(key=>!/^#[0-9a-f]{6}$/i.test(payload.colors[key]))) throw Error("Invalid dock color model");
    return {version:1,revision:payload.revision,colors:Object.fromEntries(keys.map(key=>[key,payload.colors[key]]))};
}
module.exports={validateDockColors};
