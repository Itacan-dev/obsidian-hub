"use strict";
module.exports = async function () {
    const plugin = app.plugins.plugins['hub-project-menu'];
    const { openTaskCreator, openTaskEditor } = plugin.constructor.__locationRuntimeUi;
    const owner = {type:'project',id:'fixture'};
    const root = 'Projects/Fixture';
    await app.vault.createFolder(root+'/Folder');
    await app.vault.create(root+'/Folder/Note.md', '# Synthetic note');
    const locations = {
        workspace: () => ({ owner, name:'Fixture', root, available:true }),
        workspaces: () => [{owner,name:'Fixture',root,available:true}],
        mountThumbnail() {},
        describe: (o,r) => ({workspaceName:'Fixture',segments:r?r.id.slice(root.length+1).split('/'):[],available:true}),
        resolve: (o,r) => ({path:r?.id??root,type:r?.type??'folder'}),
        resolveId: (o,id) => ({reference:{id,type:id.endsWith('.md')?'note':'folder'}}),
        select: (o,path,type) => ({owner:o,path,type,reference:path===root?null:{id:path,type}}),
        browse: (o,path) => ({rows: (app.vault.getAbstractFileByPath(path)?.children??[]).map(f=>({path:f.path,name:f.name,type:f.children?'folder':'note'}))})
    };
    const inspect = modal => {
        const button = modal.taskFields.presentation.sourceControl;
        return [button,...button.querySelectorAll('*'),button.parentElement,button.parentElement.parentElement].map(e=>{
            const s=getComputedStyle(e);
            return {tag:e.tagName,cls:typeof e.className==='string'?e.className:e.className.baseVal,
                bg:s.backgroundColor,shadow:s.boxShadow,border:s.border,outline:s.outline,
                hover:e.matches(':hover'),focus:e.matches(':focus'),focusVisible:e.matches(':focus-visible'),active:e.matches(':active')};
        });
    };

    window.__locationProbe={inspect:()=>inspect(window.__locationProbe.modal),async open(mode,kind){
        this.modal?.close();
        const snapshot={text:mode==='Add'?'':'Task',steps:[],nativeOwner:owner,nativeLocation:kind==='root'?'':root+'/Folder'+(kind==='note'?'/Note.md':''),nativeLocationType:kind==='note'?'note':'folder'};
        const service={app,nativeOwner:owner,nativeLocations:locations,phases:()=>[],context:()=>({root}),formContext:()=>({nativeOwner:owner}),read:async()=>snapshot};
        this.modal=mode==='Add'?openTaskCreator(service,snapshot):openTaskEditor(service,{});
        await this.modal.ready;return true;
    }};
    window.trigger=()=>__locationProbe.modal.taskFields.presentation.sourceControl;
    return true;
};
