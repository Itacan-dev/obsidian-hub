"use strict";
HTMLElement.prototype.createEl=function(tag,o={}){const e=document.createElement(tag);e.className=o.cls||"";if(o.text!=null)e.textContent=o.text;for(const[k,v]of Object.entries(o.attr||{}))e.setAttribute(k,v);if(o.type)e.type=o.type;this.append(e);return e};
HTMLElement.prototype.createDiv=function(o){return this.createEl("div",o)};
HTMLElement.prototype.createSpan=function(o){return this.createEl("span",o)};
HTMLElement.prototype.empty=function(){this.replaceChildren()};
class Component{constructor(){this.children=new Set();this.cleanup=[]}register(fn){this.cleanup.push(fn)}registerEvent(ref){this.register(()=>ref.emitter.offref(ref))}addChild(child){this.children.add(child)}removeChild(child){child.unload();this.children.delete(child)}unload(){this.cleanup.splice(0).forEach(fn=>fn());this.children.forEach(c=>c.unload());this.children.clear()}}
Component.prototype.load=function(){};
Component.prototype.registerDomEvent=function(element,event,callback,options){element.addEventListener(event,callback,options);this.register(()=>element.removeEventListener(event,callback,options))};
class Emitter{constructor(){this.events=new Map()}on(name,fn){const ref={emitter:this,name,fn};if(!this.events.has(name))this.events.set(name,new Set());this.events.get(name).add(ref);return ref}offref(ref){this.events.get(ref.name)?.delete(ref)}emit(name,...args){for(const ref of this.events.get(name)||[])ref.fn(...args)}}
class Modal{constructor(app){this.app=app;this.containerEl=document.body.createDiv({cls:"modal-container"});this.modalEl=this.containerEl.createDiv({cls:"modal"});this.modalEl.createEl("button",{text:"Ã—",cls:"modal-close-button"}).onclick=()=>this.close();this.contentEl=this.modalEl.createDiv();this.escape=e=>{if(e.key==="Escape")this.close()};document.addEventListener("keydown",this.escape)}open(){window.lastModal=this;this.onOpen?.()}close(){this.onClose?.();this.containerEl.remove();document.removeEventListener("keydown",this.escape)}}
Modal.prototype.setTitle = function(title) { this.modalEl.setAttribute("aria-label", title); };
class FuzzySuggestModal extends Modal{onOpen(){for(const item of this.getItems())this.contentEl.createEl("button",{text:this.getItemText(item)}).onclick=()=>{this.onChooseItem(item);this.close()}}}
class Menu {
 constructor(){this.items=[];this.hideHandlers=[];}
 addItem(fn){const item={setTitle(value){this.title=value;return this},setIcon(){return this},setWarning(){return this},setChecked(value){this.checked=value;return this},onClick(fn){this.action=fn;return this}};fn(item);this.items.push(item);return this}
 onHide(fn){this.hideHandlers.push(fn);return this}
 showAtMouseEvent(event){this.showAtPosition({x:event.clientX,y:event.clientY})}
 showAtPosition({x,y}){
  this.el=document.body.createDiv({cls:"menu hub-fixture-menu",attr:{role:"menu"}});
  this.el.style.cssText="position:fixed;z-index:999;background:var(--background-secondary);border:1px solid var(--background-modifier-border);border-radius:6px;padding:4px;box-shadow:0 3px 12px #0005;min-width:130px";
  for(const item of this.items){const button=this.el.createEl("button",{text:item.title,cls:"menu-item",attr:{role:"menuitem"}});button.style.cssText="display:block;width:100%;text-align:left;border:0;background:transparent;font-size:12px";button.onclick=()=>{this.hide();item.action?.()};}
  const r=this.el.getBoundingClientRect();this.el.style.left=Math.max(0,Math.min(x,innerWidth-r.width))+"px";this.el.style.top=Math.max(0,Math.min(y,innerHeight-r.height))+"px";
  this.outside=event=>{if(!this.el.contains(event.target))this.hide()};this.key=event=>{if(event.key==="Escape"){event.preventDefault();this.hide();return;}if(["ArrowDown","ArrowUp"].includes(event.key)){event.preventDefault();const buttons=[...this.el.querySelectorAll("button")],i=buttons.indexOf(document.activeElement);buttons[(i+(event.key==="ArrowDown"?1:-1)+buttons.length)%buttons.length].focus()}};
  queueMicrotask(()=>{if(this.el?.isConnected){document.addEventListener("pointerdown",this.outside);document.addEventListener("keydown",this.key);this.el.querySelector("button")?.focus();}});
 }
 hide(){if(!this.el)return;this.el.remove();document.removeEventListener("pointerdown",this.outside);document.removeEventListener("keydown",this.key);this.el=null;this.hideHandlers.splice(0).forEach(fn=>fn())}
}
const notices=[],assert=(condition,message)=>{if(!condition)throw Error(message)};
const settle=async()=>{for(let i=0;i<25;i++)await Promise.resolve();await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)))};
const icons={route:"M3 17a3 3 0 1 0 6 0 3 3 0 0 0-6 0 M15 7a3 3 0 1 0 6 0 3 3 0 0 0-6 0 M9 17h8a4 4 0 0 0 0-8H7a4 4 0 0 1 0-8h8","grip-vertical":"M9 5h.01M9 12h.01M9 19h.01M15 5h.01M15 12h.01M15 19h.01","chevron-up":"m5 15 7-7 7 7",folder:"M3 7h6l2-3h9v16H3z","list-todo":"M9 6h11M9 12h11M9 18h11M3 6h2M3 12h2M3 18h2",search:"M10 3a7 7 0 1 0 0 14 7 7 0 0 0 0-14m5 12 6 6",plus:"M12 5v14M5 12h14","chevron-right":"m9 5 7 7-7 7","chevron-left":"m15 5-7 7 7 7","chevron-down":"m5 9 7 7 7-7",x:"m5 5 14 14M5 19 19 5"};
Object.assign(icons, {"clock-alert":"M12 6v6l4 2 M20 12v5 M20 21h.01 M21.25 8.2A10 10 0 1 0 16 21.16",sun:"M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8 M12 2v2 M12 20v2 m4.93 4.93 1.41 1.41 m17.66 17.66 1.41 1.41 M2 12h2 M20 12h2 m6.34 17.66-1.41 1.41 m19.07 4.93-1.41 1.41","calendar-clock":"M16 14v2.2l1.6 1 M16 2v4 M21 7.5V6a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h3.5 M3 10h5 M8 2v4 M16 10a6 6 0 1 0 0 12 6 6 0 0 0 0-12","calendar-off":"M4.2 4.2A2 2 0 0 0 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 1.82-1.18 M21 15.5V6a2 2 0 0 0-2-2H9.5 M16 2v4 M3 10h7 M21 10h-5.5 m2 2 20 20"});
const obsidian={getIcon:()=>null,Component,Modal,FuzzySuggestModal,Menu,Notice:class{constructor(text){notices.push(text)}},setIcon(el,name){el.replaceChildren();el.dataset.icon=name;const svg=document.createElementNS("http://www.w3.org/2000/svg","svg");for(const[k,v]of Object.entries({viewBox:"0 0 24 24",fill:"none",stroke:"currentColor","stroke-width":"1.7","stroke-linecap":"round","stroke-linejoin":"round"}))svg.setAttribute(k,v);const p=document.createElementNS(svg.namespaceURI,"path");p.setAttribute("d",icons[name]||icons.folder);svg.append(p);el.append(svg)},MarkdownRenderer:{render:async(app,text,el)=>el.createEl("p",{text})}};
window.onerror=(message,source,line,col,error)=>document.getElementById("result").textContent="FAIL: "+(error?.stack||message);
