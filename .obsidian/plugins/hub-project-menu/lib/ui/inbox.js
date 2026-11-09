"use strict";
const { ownMenuColors, ownModalColors, ownNoticeColors } = require("./color-system");

const { Notice, Menu } = require("obsidian");
const { CaptureModal, CaptureConfirmation, action, attachments } = require("./capture-modal");
const { setHubIcon } = require("./icons");
const { formatDateTime } = require("../domain/dates");
const { captureDraft, captureIntent, sortedCaptures, inboxCounts, INBOX_SORTS } = require("../domain/inbox");
const { mountCaptureForm } = require("./capture-form");
const { mountNativeCaptureTask } = require("./native-capture-task");
const clone = value => JSON.parse(JSON.stringify(value));
const preview = capture => capture.text?.trim() || capture.attachments?.map(a=>a.name).join(", ") || "Untitled item";
const fingerprint = value => JSON.stringify({text:value.text,attachments:value.attachments,intent:captureIntent(value,value.attachments??[])});
class InboxModal extends CaptureModal {
    onOpen() { ownModalColors(this);
        this.modalEl.classList.add("hub-inbox-dialog");this.header("Inbox","Saved items awaiting organisation","inbox");
        this.filter="all";this.sortOrder=["most-complete","least-complete"].includes(this.service.sortPreference)?"newest":this.service.sortPreference;
        this.rows=new Map();this.drafts=new Map();this.actionsByItem=new Map();this.selectedId=null;this.mode=null;this.dirty=false;
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
        this.refresh();this.filterButtons[0].button.focus();
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
    showItemMenu(id,position){const c=this.service.get(id);if(!c||this.busy)return;const menu=ownMenuColors(new Menu());menu.addItem(i=>i.setTitle('Open').setIcon('panel-right-open').onClick(()=>this.select(id)));if(!c.attachments.length)menu.addItem(i=>i.setTitle('Create task').setIcon('square-plus').onClick(async()=>{await this.select(id);await this.createTask()}));menu.addSeparator();menu.addItem(i=>i.setTitle('Delete').setIcon('trash-2').setWarning(true).onClick(()=>this.remove(id)));menu.showAtPosition(position)}
    async select(id,focus=false){if(this.busy||id===this.selectedId||!await this.flushEdits())return;this.remember();this.resetForm();this.selectedId=id;this.loadSelected();this.refresh();if(focus)this.rows.get(id)?.button.focus({preventScroll:true})}
    remember(){if(!this.selectedId||!this.draft)return;const value=this.form?.value()??this.draft;this.draft={...this.draft,...value};this.drafts.set(this.selectedId,clone(this.draft));if(this.mode){const choices=this.actionsByItem.get(this.selectedId)??{};choices[this.mode]=clone(this.draft);this.actionsByItem.set(this.selectedId,choices)}}
    resetForm(){this.form?.destroy();this.form=null;this.mode=null;this.draft=null;this.dirty=false;this.save=null}
    loadSelected(){
        this.detail.empty();this.detail.classList.add('is-action-form');const c=this.service.get(this.selectedId);if(!c){this.detail.createDiv({cls:'hub-capture-empty',text:'Select an item to organize.'});return;}
        this.draft=clone(this.drafts.get(c.id)??captureDraft(c));this.detail.createEl('h3',{text:c.attachments.length?'File':'Text',cls:'hub-inbox-detail-title hub-inbox-action-heading'});
        const body=this.detail.createDiv({cls:'hub-inbox-action-body'});this.sourceInput=null;
        if(c.text || !c.attachments.length){this.sourceInput=body.createEl('textarea',{cls:'hub-quick-add-input',attr:{rows:'4','aria-label':'Captured content'}});this.sourceInput.value=this.draft.text;this.sourceInput.disabled=!!c.operation&&c.operation.state!=='done';this.sourceInput.oninput=()=>{this.draft.text=this.sourceInput.value;this.dirty=true;this.form?.update({text:this.draft.text})};}
        if(c.attachments.length)attachments(body.createDiv({cls:'hub-capture-attachments'}),c.attachments,this.service,{open:ref=>{void this.run(()=>this.service.openAttachment(ref))}});
        const actions=body.createDiv({cls:'hub-inbox-organize-actions'});
        const task=action(actions,'Create task','square-plus',()=>{void this.createTask()},'mod-cta');task.disabled=!!c.attachments.length;if(task.disabled)task.title='Native task attachments are unavailable. Organize the files below.';
        const newNote=action(actions,'New note','notebook-plus',()=>{void this.showAction('note','new')});const existing=action(actions,'Add to existing note','notebook-pen',()=>{void this.showAction('note','existing')});existing.disabled=!!c.attachments.length;if(existing.disabled)existing.title='Use New note or Organize files to preserve these files.';
        this.actionHost=body.createDiv({cls:'hub-inbox-form-host'});
        const footer=this.detail.createDiv({cls:'hub-capture-actions hub-inbox-action-footer'});this.deleteButton=action(footer,'Delete','trash-2',()=>{void this.remove(c.id)},'hub-capture-delete');this.submitHost=footer.createSpan();
        const pending=c.operation&&c.operation.state!=='done';if(pending){task.disabled=!['native-task','task'].includes(c.operation.kind);newNote.disabled=true;existing.disabled=true;this.detail.createDiv({cls:'hub-capture-muted',text:'This item retains its original destination operation. Retry to confirm its outcome; no duplicate will be created.'});this.deleteButton.disabled=c.operation.kind==='native-task';void this.showAction(c.operation.kind==='native-task'||c.operation.kind==='task'?'task':c.operation.kind==='files'?'file':'note',c.operation.kind==='note-insertion'?'existing':'new',true);}
        else if(c.attachments.length)void this.showAction('file',null,true);else void this.showAction('task',null,true);
    }
    async showAction(type,noteAction=null,initial=false){
        const c=this.service.get(this.selectedId);if(!c||this.busy&&!initial)return;if(!initial&&!await this.flushEdits())return;this.remember();const content=this.draft?.text??c.text,choices=this.actionsByItem.get(c.id)??{};
        const draft={...captureDraft(c,type),...choices[type],text:content,type,...(noteAction?{noteAction}:{})};this.form?.destroy();this.form=null;this.actionHost.empty();this.submitHost.empty();this.mode=type;this.draft=draft;
        const changed=value=>{const changed=fingerprint(value)!==fingerprint(this.draft);this.draft=value;this.drafts.set(c.id,clone(value));if(changed)this.dirty=true;this.sync()};
        this.form=type==='task'&&this.service.plugin.nativeTaskHost?mountNativeCaptureTask({host:this.actionHost,service:this.service,draft,captureId:()=>c.id,onChange:changed,onSubmit:()=>{void this.commit()},details:false}):mountCaptureForm({host:this.actionHost,service:this.service,draft,fixedType:type,captureId:()=>c.id,onChange:changed});
        this.draft=this.form.value();if(!initial)this.dirty=true;
        if(type!=='task')this.save=action(this.submitHost,type==='file'?'Organize files':noteAction==='existing'?'Add text':'Create note',null,()=>{void this.commit()},'mod-cta');
        this.sync();
    }
    async flushEdits(){if(!this.dirty||!this.selectedId)return true;const id=this.selectedId,value=this.form?.value()??this.draft;if(!this.service.get(id)){this.dirty=false;return true}try{await this.service.updateCapture(id,value);this.dirty=false;this.remember();return true}catch(error){this.error.textContent=error.message;return false}}
    sync(){if(this.needsRefresh&&!this.busy){this.needsRefresh=false;this.refresh()}if(this.save)this.save.disabled=this.busy;const c=this.service.get(this.selectedId);if(c?.operation&&c.operation.state!=='done'&&(['native-task','task','note-insertion'].includes(c.operation.kind)||c.operation.state==='ready')){this.actionHost.querySelectorAll('input,textarea,select,button').forEach(e=>e.disabled=true)}}
    async createTask(){if(this.busy||this.closed)return;const c=this.service.get(this.selectedId);if(!c||c.attachments.length)return;if(this.mode!=='task'){await this.showAction('task');if(this.mode!=='task')return;}return this.commit()}
    async commit(){if(this.busy||this.closed||!this.form)return;if(this.form.prepare?.()===false)return;if(!this.service.get(this.selectedId)?.operation&&!this.form.valid()){this.error.textContent=this.service.completion(this.form.value(),this.selectedId).error??'Choose the required destination.';return;}if(!await this.flushEdits())return;
        return this.run(async()=>{const id=this.selectedId,draft=this.form.value(),result=this.mode==='task'?await this.service.makeTask(draft,id):this.mode==='note'?await this.service.createNote(draft,id):await this.service.addFiles(draft,id);ownNoticeColors(new Notice(result?.message??'Item organized.'));this.drafts.delete(id);this.actionsByItem.delete(id);this.dirty=false;this.resetForm();this.refresh()});}
    async remove(id){if(this.busy||!this.service.get(id)||this.confirmation)return;const dialog=this.confirmation=new CaptureConfirmation(this.app,null,{title:'Delete this inbox item?',message:'This item will be removed from your Inbox.',confirmLabel:'Delete',destructive:true});const yes=await dialog.ask();this.confirmation=null;if(!yes||this.closed)return;await this.run(async()=>{await this.service.delete(id);this.drafts.delete(id);this.actionsByItem.delete(id);this.resetForm();this.selectedId=null;this.refresh()});}
    async close(){if(this.busy||this.closed||!await this.flushEdits())return;super.close()}
    onClose(){this.modalEl.removeEventListener('keydown',this.deleteKey);this.confirmation?.close();this.sortMenu?.hide();this.remember();this.service.scheduleNativeRefresh?.();super.onClose()}
}
module.exports={InboxModal};
