"use strict";
const { ownMenuColors, ownModalColors, ownNoticeColors } = require("./color-system");

const { Notice, Menu } = require("obsidian");
const { CaptureModal, CaptureConfirmation, action, attachments } = require("./capture-modal");
const { setHubIcon } = require("./icons");
const { fileIcon } = require("./file-icons");
const { bindMenuToggle } = require("./menu-toggle");
const { formatDateTime } = require("../domain/dates");
const { captureDraft, sortedCaptures, inboxCounts, INBOX_SORTS } = require("../domain/inbox");
const { openCaptureAction, operationMode } = require("./capture-flow");
const { captureActions, captureAction } = require("./capture-actions");
const { bulkEligibility, remainingMembers, distinctFileCount, bulkMessage } = require("../domain/inbox-bulk");
const { openBulkAction, bulkLabel } = require("./inbox-bulk-flow");
const { inboxSelection, inboxFiles } = require("../domain/inbox-selection");
const clone = value => JSON.parse(JSON.stringify(value));
const preview = capture => capture.text?.trim() || capture.attachments?.map(a=>a.name).join(", ") || "Untitled item";
class InboxModal extends CaptureModal {
    onOpen() { ownModalColors(this);
        this.modalEl.classList.add("hub-inbox-dialog");this.header("Inbox","Saved items awaiting organisation","inbox");
        this.filter=this.options.resumeState?.filter??"all";this.sortOrder=["most-complete","least-complete"].includes(this.service.sortPreference)?"newest":this.service.sortPreference;
        if(['newest','oldest','type'].includes(this.options.resumeState?.sortOrder))this.sortOrder=this.options.resumeState.sortOrder;
        this.rows=new Map();this.drafts=new Map();this.selectedId=this.options.resumeState?.selectedId??null;this.mode=null;this.dirty=false;
        this.checkedIds=new Set(this.options.resumeState?.checkedIds??remainingMembers(this.service.activeBulk).map(m=>m.id));this.bulkDrafts=this.options.resumeState?.bulkDrafts??{};
        this.selectionAnchor=this.options.resumeState?.selectionAnchor??this.selectedId;this.selectionEmpty=this.options.resumeState?.selectionEmpty??false;
        this.bulkFileScroll=this.options.resumeState?.bulkFileScroll??0;
        const body=this.contentEl.createDiv({cls:"hub-inbox-body"}),aside=body.createEl("aside",{cls:"hub-inbox-sidebar",attr:{"aria-label":"Inbox items"}}),toolbar=aside.createDiv({cls:"hub-inbox-toolbar"});
        const filters=toolbar.createDiv({cls:"hub-inbox-filters hub-equal-selectors hub-option-group",attr:{role:"group","aria-label":"Filter items"}});
        this.filterButtons=[["all","All"],["text","Texts"],["files","Files"]].map(([key,label])=>({key,label,button:action(filters,label,null,()=>{void this.changeFilter(key)})}));
        this.sort=action(toolbar,"Sort by","arrow-up-down",()=>this.showSortMenu(),"hub-panel-action hub-inbox-sort-button");
        this.sort.setAttribute("aria-label","Sort by");this.sort.setAttribute("aria-haspopup","menu");this.sort.setAttribute("aria-expanded","false");
        this.sortChevron=this.sort.createSpan({cls:'hub-capture-icon',attr:{'aria-hidden':'true'}});setHubIcon(this.sortChevron,'chevron-right');
        this.stopSortToggle=bindMenuToggle(this.sort,{isOpen:()=>!!this.sortMenu,close:()=>this.sortMenu?.hide()});
        this.list=aside.createDiv({cls:"hub-inbox-list",attr:{role:"group","aria-label":"Inbox items"}});
        this.list.addEventListener("keydown",event=>{const rows=[...this.list.querySelectorAll('[data-capture-id]')],at=rows.indexOf(event.target);if(at<0)return;const n=event.key==='ArrowDown'?Math.min(rows.length-1,at+1):event.key==='ArrowUp'?Math.max(0,at-1):event.key==='Home'?0:event.key==='End'?rows.length-1:[' ','Enter'].includes(event.key)?at:null;if(n!==null){event.preventDefault();if((event.ctrlKey||event.metaKey)&&!event.shiftKey&&![' ','Enter'].includes(event.key))rows[n].focus();else void this.changeSelection(rows[n].dataset.captureId,event,true)}});
        this.detail=body.createEl("section",{cls:"hub-inbox-detail",attr:{"aria-label":"Item details",tabindex:"-1"}});
        const footer=this.contentEl.createDiv({cls:"hub-capture-actions hub-inbox-footer"});action(footer,"Close",null,()=>this.close());
        this.stop=this.service.onChange(()=>{if(this.busy)this.needsRefresh=true;else this.refresh()});
        this.deleteKey=e=>{if(e.key==='Delete'&&!e.repeat&&!e.target.closest('input,textarea,select,[contenteditable],.menu')&&!this.busy&&!this.confirmation&&this.checkedIds.size<2){e.preventDefault();void this.remove(this.selectedId)}};this.modalEl.addEventListener('keydown',this.deleteKey);
        this.refresh();this.list.scrollTop=this.options.resumeState?.scrollTop??0;this.filterButtons[0].button.focus();
    }
    visible(){return sortedCaptures(this.service.captures,{filter:this.filter,sort:this.sortOrder})}
    async changeFilter(filter){if(this.busy||!await this.flushEdits())return;this.filter=filter;this.selectionEmpty=false;this.refresh()}
    showSortMenu(){
        if(this.busy||this.sortMenu)return;
        const menu=this.sortMenu=ownMenuColors(new Menu());
        for(const [key,label]of INBOX_SORTS.filter(([key])=>!key.includes('complete')))menu.addItem(i=>i.setTitle(label).setChecked(key===this.sortOrder).onClick(async()=>{if(!await this.flushEdits())return;await this.service.setSortPreference(key);this.sortOrder=key;this.refresh()}));
        const win=this.sort.ownerDocument.defaultView;
        let verticalGap=0;
        const center=()=>{if(this.sortMenu!==menu)return;const r=this.sort.getBoundingClientRect(),width=menu.dom.offsetWidth,left=Math.max(4,Math.min(win.innerWidth-width-4,(r.left+r.right-width)/2)),top=r.bottom+verticalGap;if(!(Math.abs(parseFloat(menu.dom.style.left)-left)<.01))menu.dom.style.left=left+'px';if(!(Math.abs(parseFloat(menu.dom.style.top)-top)<.01))menu.dom.style.top=top+'px';};
        const observer=new win.ResizeObserver(center),resize=()=>win.requestAnimationFrame(center);
        menu.onHide(()=>{observer.disconnect();win.removeEventListener('resize',resize);this.sortMenu=null;this.sort.setAttribute('aria-expanded','false');setHubIcon(this.sortChevron,'chevron-right');this.sort.focus()});
        this.sort.setAttribute('aria-expanded','true');setHubIcon(this.sortChevron,'chevron-down');
        const r=this.sort.getBoundingClientRect();menu.showAtPosition({x:r.left,y:r.bottom});verticalGap=menu.dom.offsetTop-r.bottom;center();observer.observe(menu.dom);observer.observe(this.sort.parentElement);win.addEventListener('resize',resize);
    }
    onEscapeKey(event){if(this.sortMenu){this.sortMenu.hide();return;}super.onEscapeKey(event);}
    refresh(){
        if(this.closed)return;const captures=this.visible(),counts=inboxCounts(this.service.captures);
        const single=this.checkedIds.size===1;
        this.checkedIds=new Set(captures.filter(c=>this.checkedIds.has(c.id)&&(single||!bulkEligibility(c,this.service.activeBulk).reason)).map(c=>c.id));
        if(!this.checkedIds.size&&!this.selectionEmpty){const initial=captures.find(c=>c.id===this.selectedId)??captures[0];if(initial)this.checkedIds.add(initial.id);}
        if(this.checkedIds.size&&!this.checkedIds.has(this.selectedId)){this.resetForm();this.selectedId=[...this.checkedIds][0];}
        if(!this.checkedIds.size&&this.selectionEmpty){this.resetForm();this.selectedId=null;}
        const missingSelection=!captures.some(c=>c.id===this.selectedId);
        if(missingSelection&&!this.selectionEmpty){this.resetForm();this.selectedId=captures[0]?.id??null;}
        if(!captures.some(c=>c.id===this.selectionAnchor))this.selectionAnchor=this.selectedId;
        for(const f of this.filterButtons){f.button.querySelector('span').textContent=f.label+' ('+counts[f.key]+')';f.button.classList.toggle('is-selected',f.key===this.filter);f.button.setAttribute('aria-pressed',String(f.key===this.filter))}
        if(missingSelection||!this.draft)this.loadSelected();
        // Select and populate details before scroll reads force initial layout.
        const scroll=this.list.scrollTop;
        for(const [id,row]of this.rows)if(!captures.some(c=>c.id===id)){row.button.remove();this.rows.delete(id)}
        this.list.querySelector('.hub-capture-empty')?.remove();if(!captures.length)this.list.createDiv({cls:'hub-capture-empty',text:this.service.count?'No items match this filter.':'Your Inbox is empty. Use Quick Add to save something for later.'});
        captures.forEach((capture,index)=>{let row=this.rows.get(capture.id);if(!row){const button=this.list.createEl('button',{cls:'hub-inbox-row',attr:{type:'button','data-capture-id':capture.id}}),icon=button.createSpan({cls:'hub-capture-icon'}),copy=button.createDiv({cls:'hub-inbox-row-copy'}),title=copy.createDiv({cls:'hub-inbox-row-title'}),date=copy.createDiv({cls:'hub-capture-muted'});row={button,icon,title,date};this.rows.set(capture.id,row);button.onmousedown=e=>{if(e.shiftKey)e.preventDefault();};button.onclick=e=>{void this.changeSelection(capture.id,e,true)};button.oncontextmenu=async e=>{e.preventDefault();await this.openItem(capture.id);if(this.checkedIds.size===1&&this.selectedId===capture.id)this.showItemMenu(capture.id,{x:e.clientX,y:e.clientY})};}
            setHubIcon(row.icon,capture.attachments.length?fileIcon(capture.attachments[0].name||capture.attachments[0].path):'file-text');row.title.textContent=preview(capture);row.title.title=row.title.textContent;row.date.textContent=formatDateTime(new Date(capture.createdAt));row.button.classList.toggle('is-selected',this.checkedIds.has(capture.id));row.button.setAttribute('aria-pressed',String(this.checkedIds.has(capture.id)));if(this.list.children[index]!==row.button)this.list.insertBefore(row.button,this.list.children[index]??null);
        });this.list.scrollTop=scroll;
        this.syncSelection();
    }
    syncSelection(){
        const first=this.service.get([...this.checkedIds][0]),group=first?bulkEligibility(first,this.service.activeBulk).group:null;
        for(const [id,row]of this.rows){const eligibility=bulkEligibility(this.service.get(id),this.service.activeBulk),reason=eligibility.reason??(group&&eligibility.group!==group?'Select texts or files separately.':'');row.button.setAttribute('aria-description',reason||'Ctrl-click toggles selection. Shift-click selects a range.');row.button.classList.toggle('is-selected',this.checkedIds.has(id));row.button.setAttribute('aria-pressed',String(this.checkedIds.has(id)));}
    }
    async changeSelection(id,modifiers={},focus=false){
        if(this.busy||!await this.flushEdits())return;
        const next=inboxSelection(this.visible(),this.checkedIds,this.selectionAnchor,id,modifiers,c=>bulkEligibility(c,this.service.activeBulk));
        if(!next||next.reason){this.syncSelection();return;}
        this.remember();this.checkedIds=new Set(next.ids);this.selectionAnchor=next.anchor;this.selectionEmpty=!next.ids.length;
        this.selectedId=this.checkedIds.has(id)?id:next.ids[0]??null;
        this.resetForm();this.loadSelected();this.refresh();if(focus)this.rows.get(id)?.button.focus({preventScroll:modifiers.type!=="keydown"});
    }
    async openItem(id,focus=false){return this.changeSelection(id,{},focus);}
    renderBulk(){
        const captures=this.visible().filter(c=>this.checkedIds.has(c.id)),files=captures[0].attachments.length>0,batch=this.service.activeBulk,refs=files?inboxFiles(captures,ref=>this.service.attachmentPath(ref)):[];
        this.draft=null;this.sourceInput=null;
        this.detail.createEl('h3',{text:`${files?refs.length:captures.length} ${files?'file'+(refs.length===1?'':'s'):'texts'} selected`,cls:'hub-inbox-detail-title'});
        const body=this.detail.createDiv({cls:'hub-inbox-action-body hub-inbox-bulk-body '+(files?'hub-inbox-bulk-files':'hub-inbox-bulk-texts')});
        if(batch){body.createDiv({text:bulkMessage(batch),cls:'hub-capture-muted',attr:{role:'status'}});if(batch.error)body.createDiv({text:batch.error,cls:'hub-task-error'});}
        if(batch)body.createDiv({text:'Retry keeps all remaining batch items and their original order.',cls:'hub-capture-muted'});
        if(files){this.bulkFilesList=body.createDiv({cls:'hub-capture-attachments hub-inbox-bulk-files-list'});attachments(this.bulkFilesList,refs,this.service,{remove:ref=>{void this.deselectFile(ref,refs.indexOf(ref));},removeLabel:'Deselect'});if(batch)for(const button of this.bulkFilesList.querySelectorAll('button')){button.disabled=true;button.title='Finish the retained batch before changing its selection.';}this.bulkFilesList.scrollTop=this.bulkFileScroll;}
        const actions=body.createDiv({cls:'hub-inbox-organize-actions'});
        for(const choice of captureActions(captures[0])){
            const inputs=batch?remainingMembers(batch).map(m=>m.input):captures,count=choice.mode==='file'?distinctFileCount(inputs):inputs.length,button=captureAction(actions,{...choice,label:bulkLabel(choice.mode,count,true)},mode=>{void this.showBulkAction(mode,batch?.id)});
            button.disabled=!!batch&&choice.mode!==batch.action;
        }
        action(this.detail.createDiv({cls:'hub-capture-actions hub-inbox-action-footer'}),'Clear selection',null,()=>{this.checkedIds.clear();this.selectionEmpty=true;this.selectedId=null;this.resetForm();this.loadSelected();this.refresh();});
    }
    async deselectFile(ref,index){
        if(this.busy||this.service.activeBulk||!await this.flushEdits())return;
        const path=this.service.attachmentPath(ref),removed=new Set(this.visible().filter(c=>this.checkedIds.has(c.id)&&c.attachments.some(a=>this.service.attachmentPath(a)===path)).map(c=>c.id));
        if(!removed.size)return;
        this.checkedIds=new Set([...this.checkedIds].filter(id=>!removed.has(id)));
        this.selectionEmpty=!this.checkedIds.size;
        if(!this.checkedIds.has(this.selectedId))this.selectedId=[...this.checkedIds][0]??null;
        if(removed.has(this.selectionAnchor))this.selectionAnchor=this.selectedId;
        this.resetForm();this.loadSelected();this.refresh();
        const buttons=this.bulkFilesList?.querySelectorAll('[aria-label^="Deselect "]');
        (buttons?.[Math.min(index,buttons.length-1)]??this.rows.get(this.selectedId)?.button??this.filterButtons.find(f=>f.key===this.filter)?.button)?.focus({preventScroll:true});
    }
    showItemMenu(id,position){const c=this.service.get(id);if(!c||this.busy)return;const menu=ownMenuColors(new Menu());menu.addItem(i=>i.setTitle('Open').setIcon('panel-right-open').onClick(()=>this.select(id)));if(!c.attachments.length)menu.addItem(i=>i.setTitle('Create task').setIcon('square-plus').onClick(async()=>{await this.select(id);if(this.selectedId===id)await this.createTask()}));menu.addSeparator();menu.addItem(i=>i.setTitle('Delete').setIcon('trash-2').setWarning(true).onClick(()=>this.remove(id)));menu.showAtPosition(position)}
    async select(id,focus=false){return this.changeSelection(id,{},focus);}
    remember(){if(!this.selectedId||!this.draft)return;const value=this.form?.value()??this.draft;this.draft={...this.draft,...value};this.drafts.set(this.selectedId,clone(this.draft));}
    resetForm(){this.form?.destroy();this.form=null;this.mode=null;this.draft=null;this.dirty=false;this.save=null}
    loadSelected(){
        this.bulkFileScroll=this.bulkFilesList?.scrollTop??this.bulkFileScroll;this.bulkFilesList=null;
        this.detail.empty();this.detail.classList.add('is-action-form');const c=this.service.get(this.selectedId);
        if(this.checkedIds.size>=2){this.renderBulk();return;}
        if(!c){this.detail.createDiv({cls:'hub-capture-empty',text:'Select an item to organize.'});return;}
        this.draft=clone(this.drafts.get(c.id)??captureDraft(c));
        this.detail.createEl('h3',{text:c.attachments.length?'File':'Text',cls:'hub-inbox-detail-title hub-inbox-action-heading'});
        const body=this.detail.createDiv({cls:'hub-inbox-action-body'});this.sourceInput=null;
        if(c.text||!c.attachments.length){this.sourceInput=body.createEl('textarea',{cls:'hub-quick-add-input',attr:{rows:'4','aria-label':'Captured content'}});this.sourceInput.value=this.draft.text;this.sourceInput.disabled=!!operationMode(c)||!!this.service.bulkMember(c.id);this.sourceInput.oninput=()=>{this.draft.text=this.sourceInput.value;this.dirty=true;};}
        if(c.attachments.length)attachments(body.createDiv({cls:'hub-capture-attachments'}),c.attachments,this.service,{open:ref=>{void this.run(()=>this.service.openAttachment(ref));}});
        const actions=body.createDiv({cls:'hub-inbox-organize-actions'+(!c.attachments.length?' hub-capture-action-row':'')}),pending=operationMode(c);
        for(const choice of captureActions(c,true)){
            const button=captureAction(actions,choice,mode=>{void this.showAction(mode);});
            button.disabled=this.service.bulkMember(c.id)?this.service.activeBulk.action!==choice.mode:!!pending&&pending!==choice.mode;
        }
        if(pending)body.createDiv({cls:'hub-capture-muted',text:'Retry the saved action to confirm its outcome. Its original content and destination are retained.'});
        if(this.service.bulkMember(c.id))body.createDiv({cls:'hub-capture-muted',text:bulkMessage(this.service.activeBulk)+(this.service.activeBulk.error?' '+this.service.activeBulk.error:'')});
        const footer=this.detail.createDiv({cls:'hub-capture-actions hub-inbox-action-footer'});
        this.deleteButton=action(footer,'Delete','trash-2',()=>{void this.remove(c.id)},'hub-capture-delete');this.deleteButton.disabled=c.operation?.kind==='native-task'||!!this.service.bulkMember(c.id);
    }
    async showAction(mode){
        if(this.busy||this.closed)return;
        if(this.service.bulkMember(this.selectedId)){if(mode===this.service.activeBulk.action)return this.showBulkAction(mode,this.service.activeBulk.id);return;}
        this.busy=true;
        try{
            if(!await this.flushEdits())return;
            const id=this.selectedId,visible=this.visible(),index=visible.findIndex(c=>c.id===id);
            const state={filter:this.filter,sortOrder:this.sortOrder,selectedId:id,scrollTop:this.list.scrollTop,checkedIds:[...this.checkedIds],selectionAnchor:this.selectionAnchor,bulkDrafts:this.bulkDrafts};
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
    async showBulkAction(mode,batchId){
        if(this.busy||this.closed)return;this.busy=true;
        try{
            if(!await this.flushEdits())return;
            const ids=batchId?remainingMembers(this.service.activeBulk).map(m=>m.id):this.visible().filter(c=>this.checkedIds.has(c.id)).map(c=>c.id);
            if(!batchId&&ids.length<2)return;
            const state={filter:this.filter,sortOrder:this.sortOrder,selectedId:this.selectedId,scrollTop:this.list.scrollTop,checkedIds:ids,selectionAnchor:this.selectionAnchor,bulkFileScroll:this.bulkFilesList?.scrollTop??this.bulkFileScroll,bulkDrafts:this.bulkDrafts};
            this.remember();this.busy=false;super.close();
            const resume=result=>Promise.resolve().then(()=>{
                state.checkedIds=this.service.activeBulk?remainingMembers(this.service.activeBulk).map(m=>m.id):ids.filter(id=>this.service.get(id));
                if(result.status==='completed')ownNoticeColors(new Notice(result.result.message));
                else if(result.status==='failed')ownNoticeColors(new Notice(result.error));
                if(this.options.onResume)this.options.onResume(state);else new InboxModal(this.app,this.service,{...this.options,resumeState:state}).open();
            });
            try{this.bulkChild=openBulkAction(this.service,{ids,mode,batchId,draft:this.bulkDrafts[mode],onDraftChange:value=>{this.bulkDrafts[mode]=value;},onClose:resume});}
            catch(error){resume({status:'failed',error:error.message});}
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
    sync(){if(this.needsRefresh&&!this.busy){this.needsRefresh=false;this.refresh();}this.syncSelection();}
    async createTask(){return this.showAction('task');}
    async remove(id){if(this.busy||!this.service.get(id)||this.confirmation||this.checkedIds.size>=2||this.service.bulkMember(id))return;const dialog=this.confirmation=new CaptureConfirmation(this.app,null,{title:'Delete this inbox item?',message:'This item will be removed from your Inbox.',confirmLabel:'Delete',destructive:true});const yes=await dialog.ask();this.confirmation=null;if(!yes||this.closed)return;await this.run(async()=>{await this.service.delete(id);this.drafts.delete(id);this.resetForm();this.selectedId=null;this.refresh()});}
    async close(){
        if(this.busy||this.closed||this.closing)return;
        this.closing=true;this.busy=true;
        try{if(!await this.flushEdits())return;this.busy=false;super.close();}
        finally{this.closing=false;this.busy=false;if(!this.closed)this.sync();}
    }
    onClose(){this.modalEl.removeEventListener('keydown',this.deleteKey);this.confirmation?.close();this.sortMenu?.hide();this.stopSortToggle?.();this.remember();this.service.scheduleNativeRefresh?.();super.onClose()}
}
module.exports={InboxModal};
