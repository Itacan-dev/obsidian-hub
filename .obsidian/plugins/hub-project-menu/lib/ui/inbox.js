"use strict";
const { ownMenuColors, ownModalColors, ownNoticeColors } = require("./color-system");

const { Notice, Menu } = require("obsidian");
const { CaptureModal, CaptureConfirmation, action, attachments } = require("./capture-modal");
const { setHubIcon } = require("./icons");
const { formatDateTime } = require("../domain/dates");
const { captureDraft, sortedCaptures, inboxCounts, INBOX_SORTS } = require("../domain/inbox");
const { openCaptureAction, operationMode } = require("./capture-flow");
const clone = value => JSON.parse(JSON.stringify(value));
const preview = capture => capture.text?.trim() || capture.attachments?.map(a=>a.name).join(", ") || "Untitled item";
class InboxModal extends CaptureModal {
    onOpen() { ownModalColors(this);
        this.modalEl.classList.add("hub-inbox-dialog");this.header("Inbox","Saved items awaiting organisation","inbox");
        this.filter=this.options.resumeState?.filter??"all";this.sortOrder=["most-complete","least-complete"].includes(this.service.sortPreference)?"newest":this.service.sortPreference;
        this.rows=new Map();this.drafts=new Map();this.selectedId=this.options.resumeState?.selectedId??null;this.mode=null;this.dirty=false;
        const body=this.contentEl.createDiv({cls:"hub-inbox-body"}),aside=body.createEl("aside",{cls:"hub-inbox-sidebar",attr:{"aria-label":"Inbox items"}}),toolbar=aside.createDiv({cls:"hub-inbox-toolbar"});
        const filters=toolbar.createDiv({cls:"hub-inbox-filters hub-equal-selectors hub-option-group",attr:{role:"group","aria-label":"Filter items"}});
        this.filterButtons=[["all","All"],["text","Texts"],["files","Files"]].map(([key,label])=>({key,label,button:action(filters,label,null,()=>{void this.changeFilter(key)})}));
        this.sort=action(toolbar,"Sort","arrow-down-wide-narrow",()=>this.showSortMenu(),"hub-panel-action hub-inbox-sort-button");this.sort.setAttribute("aria-label","Sort items");
        this.list=aside.createDiv({cls:"hub-inbox-list",attr:{role:"group","aria-label":"Inbox items"}});
        this.list.addEventListener("keydown",event=>{const rows=[...this.list.querySelectorAll('[data-capture-id]')],at=rows.indexOf(event.target);if(at<0)return;const n=event.key==='ArrowDown'?Math.min(rows.length-1,at+1):event.key==='ArrowUp'?Math.max(0,at-1):event.key==='Home'?0:event.key==='End'?rows.length-1:null;if(n!==null){event.preventDefault();void this.select(rows[n].dataset.captureId,true)}});
        this.detail=body.createEl("section",{cls:"hub-inbox-detail",attr:{"aria-label":"Item details",tabindex:"-1"}});
        const footer=this.contentEl.createDiv({cls:"hub-capture-actions hub-inbox-footer"});action(footer,"Close",null,()=>this.close());
        this.stop=this.service.onChange(()=>{if(this.busy)this.needsRefresh=true;else this.refresh()});
        this.deleteKey=e=>{if(e.key==='Delete'&&!e.repeat&&!e.target.closest('input,textarea,select,[contenteditable],.menu')&&!this.busy&&!this.confirmation){e.preventDefault();void this.remove(this.selectedId)}};this.modalEl.addEventListener('keydown',this.deleteKey);
        this.refresh();if(this.selectedId&&!this.draft)this.loadSelected();this.list.scrollTop=this.options.resumeState?.scrollTop??0;this.filterButtons[0].button.focus();
    }
    visible(){return sortedCaptures(this.service.captures,{filter:this.filter,sort:this.sortOrder})}
    async changeFilter(filter){if(this.busy||!await this.flushEdits())return;this.filter=filter;this.refresh()}
    showSortMenu(){if(this.busy)return;const menu=this.sortMenu=ownMenuColors(new Menu());for(const [key,label]of INBOX_SORTS.filter(([key])=>!key.includes('complete')))menu.addItem(i=>i.setTitle(label).setChecked(key===this.sortOrder).onClick(async()=>{if(!await this.flushEdits())return;await this.service.setSortPreference(key);this.sortOrder=key;this.refresh()}));menu.onHide(()=>{this.sortMenu=null;this.sort.focus()});const r=this.sort.getBoundingClientRect();menu.showAtPosition({x:r.left,y:r.bottom})}
    refresh(){
        if(this.closed)return;const captures=this.visible(),scroll=this.list.scrollTop,counts=inboxCounts(this.service.captures);
        for(const f of this.filterButtons){f.button.querySelector('span').textContent=f.label+' ('+counts[f.key]+')';f.button.classList.toggle('is-selected',f.key===this.filter);f.button.setAttribute('aria-pressed',String(f.key===this.filter))}
        for(const [id,row]of this.rows)if(!captures.some(c=>c.id===id)){row.button.remove();this.rows.delete(id)}
        this.list.querySelector('.hub-capture-empty')?.remove();if(!captures.length)this.list.createDiv({cls:'hub-capture-empty',text:this.service.count?'No items match this filter.':'Your Inbox is empty. Use Quick Add to save something for later.'});
        captures.forEach((capture,index)=>{let row=this.rows.get(capture.id);if(!row){const button=this.list.createEl('button',{cls:'hub-inbox-row',attr:{type:'button','data-capture-id':capture.id}}),icon=button.createSpan({cls:'hub-capture-icon'}),copy=button.createDiv({cls:'hub-inbox-row-copy'}),title=copy.createDiv({cls:'hub-inbox-row-title'}),date=copy.createDiv({cls:'hub-capture-muted'});row={button,icon,title,date};this.rows.set(capture.id,row);button.onclick=()=>{void this.select(capture.id)};button.oncontextmenu=e=>{e.preventDefault();this.showItemMenu(capture.id,{x:e.clientX,y:e.clientY})};}
            setHubIcon(row.icon,capture.attachments.length?'file':'file-text');row.title.textContent=preview(capture);row.title.title=row.title.textContent;row.date.textContent=formatDateTime(new Date(capture.createdAt));row.button.classList.toggle('is-selected',capture.id===this.selectedId);row.button.setAttribute('aria-pressed',String(capture.id===this.selectedId));if(this.list.children[index]!==row.button)this.list.insertBefore(row.button,this.list.children[index]??null);
        });this.list.scrollTop=scroll;
        if(!captures.some(c=>c.id===this.selectedId)){this.resetForm();this.selectedId=captures[0]?.id??null;this.loadSelected();for(const [id,row]of this.rows){row.button.classList.toggle('is-selected',id===this.selectedId);row.button.setAttribute('aria-pressed',String(id===this.selectedId))}}
    }
    showItemMenu(id,position){const c=this.service.get(id);if(!c||this.busy)return;const menu=ownMenuColors(new Menu());menu.addItem(i=>i.setTitle('Open').setIcon('panel-right-open').onClick(()=>this.select(id)));if(!c.attachments.length)menu.addItem(i=>i.setTitle('Create task').setIcon('square-plus').onClick(async()=>{await this.select(id);if(this.selectedId===id)await this.createTask()}));menu.addSeparator();menu.addItem(i=>i.setTitle('Delete').setIcon('trash-2').setWarning(true).onClick(()=>this.remove(id)));menu.showAtPosition(position)}
    async select(id,focus=false){if(this.busy||id===this.selectedId||!await this.flushEdits())return;this.remember();this.resetForm();this.selectedId=id;this.loadSelected();this.refresh();if(focus)this.rows.get(id)?.button.focus({preventScroll:true})}
    remember(){if(!this.selectedId||!this.draft)return;const value=this.form?.value()??this.draft;this.draft={...this.draft,...value};this.drafts.set(this.selectedId,clone(this.draft));}
    resetForm(){this.form?.destroy();this.form=null;this.mode=null;this.draft=null;this.dirty=false;this.save=null}
    loadSelected(){
        this.detail.empty();this.detail.classList.add('is-action-form');const c=this.service.get(this.selectedId);
        if(!c){this.detail.createDiv({cls:'hub-capture-empty',text:'Select an item to organize.'});return;}
        this.draft=clone(this.drafts.get(c.id)??captureDraft(c));
        this.detail.createEl('h3',{text:c.attachments.length?'File':'Text',cls:'hub-inbox-detail-title hub-inbox-action-heading'});
        const body=this.detail.createDiv({cls:'hub-inbox-action-body'});this.sourceInput=null;
        if(c.text||!c.attachments.length){this.sourceInput=body.createEl('textarea',{cls:'hub-quick-add-input',attr:{rows:'4','aria-label':'Captured content'}});this.sourceInput.value=this.draft.text;this.sourceInput.disabled=!!operationMode(c);this.sourceInput.oninput=()=>{this.draft.text=this.sourceInput.value;this.dirty=true;};}
        if(c.attachments.length)attachments(body.createDiv({cls:'hub-capture-attachments'}),c.attachments,this.service,{open:ref=>{void this.run(()=>this.service.openAttachment(ref));}});
        const actions=body.createDiv({cls:'hub-inbox-organize-actions'}),pending=operationMode(c);
        const choices=c.attachments.length?[["file","File location"],["note","New note"]]:[["task","Create task"],["note","New note"],["text","Add to existing note"]];
        for(const[mode,label]of choices){const button=action(actions,label,null,()=>{void this.showAction(mode);},mode==='task'?'mod-cta':'');button.disabled=!!pending&&pending!==mode;}
        if(pending)body.createDiv({cls:'hub-capture-muted',text:'Retry the saved action to confirm its outcome. Its original content and destination are retained.'});
        const footer=this.detail.createDiv({cls:'hub-capture-actions hub-inbox-action-footer'});
        this.deleteButton=action(footer,'Delete','trash-2',()=>{void this.remove(c.id)},'hub-capture-delete');this.deleteButton.disabled=c.operation?.kind==='native-task';
    }
    async showAction(mode){
        if(this.busy||this.closed)return;
        this.busy=true;
        try{
            if(!await this.flushEdits())return;
            const id=this.selectedId,visible=this.visible(),index=visible.findIndex(c=>c.id===id);
            const state={filter:this.filter,selectedId:id,scrollTop:this.list.scrollTop};
            this.remember();this.busy=false;super.close();
            const resume=result=>Promise.resolve().then(()=>{
                if(result.status==='created'||result.status==='completed'){
                    ownNoticeColors(new Notice(result.result?.message??'Item organized.'));
                    state.selectedId=visible[index+1]?.id??visible[index-1]?.id??null;
                }else if(result.status==='failed')ownNoticeColors(new Notice(result.error));
                if(this.options.onResume)this.options.onResume(state);
                else new InboxModal(this.app,this.service,{...this.options,resumeState:state}).open();
            });
            try{openCaptureAction(this.service,{captureId:id,mode,onClose:resume});}catch(error){resume({status:'failed',error:error.message});}
        }finally{this.busy=false;}
    }
    async flushEdits(){
        if(!this.dirty||!this.selectedId)return true;
        const id=this.selectedId,value=clone(this.form?.value()??this.draft),input=this.sourceInput,disabled=input?.disabled;
        if(!this.service.get(id)){this.dirty=false;return true;}
        if(input)input.disabled=true;
        try{await this.service.updateCapture(id,value);this.dirty=false;this.remember();return true;}
        catch(error){this.error.textContent=error.message;return false;}
        finally{if(input?.isConnected)input.disabled=disabled;}
    }
    sync(){if(this.needsRefresh&&!this.busy){this.needsRefresh=false;this.refresh();}}
    async createTask(){return this.showAction('task');}
    async remove(id){if(this.busy||!this.service.get(id)||this.confirmation)return;const dialog=this.confirmation=new CaptureConfirmation(this.app,null,{title:'Delete this inbox item?',message:'This item will be removed from your Inbox.',confirmLabel:'Delete',destructive:true});const yes=await dialog.ask();this.confirmation=null;if(!yes||this.closed)return;await this.run(async()=>{await this.service.delete(id);this.drafts.delete(id);this.resetForm();this.selectedId=null;this.refresh()});}
    async close(){
        if(this.busy||this.closed||this.closing)return;
        this.closing=true;this.busy=true;
        try{if(!await this.flushEdits())return;this.busy=false;super.close();}
        finally{this.closing=false;this.busy=false;if(!this.closed)this.sync();}
    }
    onClose(){this.modalEl.removeEventListener('keydown',this.deleteKey);this.confirmation?.close();this.sortMenu?.hide();this.remember();this.service.scheduleNativeRefresh?.();super.onClose()}
}
module.exports={InboxModal};
