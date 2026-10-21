"use strict";
const fs=require("fs").promises,path=require("path"),os=require("os"),{randomUUID}=require("crypto"),C=require("./codec");
const identity=s=>({dev:String(s.dev),ino:String(s.ino)}), pins=new Map();
async function pin(directory, authorityId) {
    C.check(typeof directory==="string" && path.isAbsolute(directory) && !directory.startsWith("\\\\"),"ROOT_REJECTED");
    const st=await fs.lstat(directory); C.check(st.isDirectory() && !st.isSymbolicLink(),"ROOT_REJECTED");
    const root=await fs.realpath(directory),temp=await fs.realpath(os.tmpdir()),rel=path.relative(temp,root);
    C.check(rel && rel!==".." && !rel.startsWith(".."+path.sep) && !path.isAbsolute(rel),"ROOT_REJECTED");
    const id=identity(st);C.check(id.ino!=="0","ROOT_IDENTITY_UNSUPPORTED");
    const prior=pins.get(authorityId);C.check(!prior || C.same(prior.id,id),"AUTHORITY_ROOT_MISMATCH"); pins.set(authorityId,{root,id});
    return {directory,root,id};
}
async function checkRoot(p) {const st=await fs.lstat(p.directory);C.check(st.isDirectory()&&!st.isSymbolicLink()&&C.same(identity(st),p.id)&&await fs.realpath(p.directory)===p.root,"ROOT_CHANGED");}
async function ordinary(file) {const s=await fs.lstat(file);C.check(s.isFile()&&!s.isSymbolicLink()&&s.nlink===1,"STORAGE_REJECTED");return identity(s);}
async function acquire(p,authorityId) {
    await checkRoot(p);const file=path.join(p.root,"APPLICATION.lock"),record={format:"itacan-application-lease",version:1,authorityId,pid:process.pid,host:os.hostname(),token:randomUUID()},raw=C.canonical(record)+"\n";let h;
    try{h=await fs.open(file,"wx");}catch(e){if(e.code==="EEXIST")C.fail("LOCK_HELD");throw e;}
    try{await h.writeFile(raw,"utf8");await h.sync();}finally{await h.close();}
    const id=await ordinary(file),lease={pin:p,file,raw,id,epoch:randomUUID()};
    await assertOwned(lease);return lease;
}
async function assertOwned(l) {await checkRoot(l.pin);const id=await ordinary(l.file);C.check(C.same(id,l.id)&&await fs.readFile(l.file,"utf8")===l.raw,"LEASE_LOST");}
async function release(l) {await assertOwned(l);await fs.unlink(l.file);}
module.exports={pin,checkRoot,ordinary,acquire,assertOwned,release};
