"use strict";
// Git-scoped membership witness. Raw private UUIDs and Phase content stay local.
const V=require('../src/value'),{check}=require('../src/errors'),hash=x=>require('../src/source-content').sha256(V.canonical(x));
const key=(authorityId,id)=>hash(['itacan-git-reservation-v2',authorityId,id]);
function validate(v,authorityId){
 if(v?.version===1){require('../src/recurrence').validateExternalReservations(v);return v;}
 V.fields(v,['version','authorityId','revision','ids','phasePin'],['version','authorityId','revision','ids','phasePin']);check(v.version===2,'Unsupported Git reservation witness.');V.uuid(v.authorityId);check(authorityId===undefined||authorityId===v.authorityId,'Reservation authority differs.');
 for(const k of ['revision','phasePin'])check(/^[a-f0-9]{64}$/.test(v[k]),'Invalid inventory digest.');check(Array.isArray(v.ids)&&v.ids.every(x=>typeof x==='string'&&/^[a-f0-9]{64}$/.test(x))&&new Set(v.ids).size===v.ids.length&&V.canonical(v.ids)===V.canonical([...v.ids].sort()),'Explicit canonical reservation hashes required.');return v;
}
function capture(authorityId,source,phases){V.uuid(authorityId);require('../src/recurrence').validateExternalReservations(source);V.jsonValue(phases);return validate({version:2,authorityId,revision:hash(source),ids:source.ids.map(id=>key(authorityId,id)).sort(),phasePin:hash(phases)},authorityId);}
function contains(v,id){return v.version===2?v.ids.includes(key(v.authorityId,id)):v.ids.includes(id);}
module.exports={validate,capture,contains};
