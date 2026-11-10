"use strict";
const { PALETTES, DEFAULT_PREFERENCES } = require("./color-palettes");
function mountAppearanceColors(parent, service, { row, section, note }) {
    const doc=parent.ownerDocument, group=section(parent,"Color");
    const control=row(group,"Color palette"), name=control.createSpan({cls:"hub-settings-palette-name"});
    control.classList.add("hub-settings-palette-control");
    const swatches=control.createDiv({cls:"hub-settings-swatches",attr:{role:"radiogroup","aria-label":"Color palette"}});
    let snapshot=service.snapshot(), disposed=false;
    const enabled=()=>snapshot.available && doc.body.classList.contains("theme-dark");
    const choose=id=>{ if(enabled()) void service.set({...snapshot,paletteId:id}); };
    const buttons=PALETTES.map(palette=>{
        const button=swatches.createEl("button",{cls:"hub-settings-swatch",attr:{type:"button",role:"radio","aria-label":palette.label}});
        button.style.backgroundColor=`var(${palette.previewToken})`;
        button.addEventListener("click",()=>choose(palette.id)); return button;
    });
    swatches.addEventListener("keydown",event=>{
        if(!enabled()) return;
        const index=buttons.indexOf(event.target); if(index<0) return;
        const next=event.key==="ArrowRight"||event.key==="ArrowDown"?(index+1)%buttons.length:event.key==="ArrowLeft"||event.key==="ArrowUp"?(index+buttons.length-1)%buttons.length:event.key==="Home"?0:event.key==="End"?buttons.length-1:null;
        if(next===null) return; event.preventDefault(); buttons[next].focus(); choose(PALETTES[next].id);
    });
    swatches.createEl("button",{cls:"hub-settings-custom-color",text:"+",attr:{type:"button",disabled:"","aria-label":"Custom colors are not available yet"}});
    const toggleHost=row(group,"Coordinate interface colors","Coordinate surfaces, Oath treatments, and the dock; turn off to keep their Default colors.");
    const toggle=toggleHost.createEl("button",{cls:"checkbox-container hub-settings-toggle hub-settings-color-toggle",attr:{type:"button",role:"switch","aria-label":"Coordinate interface colors"}});
    toggle.addEventListener("click",()=>{ if(enabled()) void service.set({...snapshot,coordinateInterfaceColors:!snapshot.coordinateInterfaceColors}); });
    const reset=row(group,"Reset colors").createEl("button",{text:"Reset colors to Default",attr:{type:"button"}});
    reset.addEventListener("click",()=>{ if(enabled()) void service.set(DEFAULT_PREFERENCES); });
    const status=group.createEl("p",{cls:"hub-settings-description",attr:{role:"status","aria-live":"polite"}});
    function render(value=service.snapshot()) {
        if(disposed) return; snapshot=value;
        const dark=doc.body.classList.contains("theme-dark"), available=enabled();
        note.textContent=dark?"Color changes apply immediately. Other Appearance controls are not available yet.":"Color customization currently applies in Obsidian Dark mode. Your saved choice will return when Dark mode is enabled.";
        name.textContent=PALETTES.find(p=>p.id===value.paletteId)?.label || PALETTES[0].label;
        buttons.forEach((button,index)=>{ const selected=PALETTES[index].id===value.paletteId; button.classList.toggle("is-selected",selected); button.setAttribute("aria-checked",String(selected)); button.tabIndex=selected?0:-1; button.disabled=!available; });
        toggle.disabled=!available; toggle.classList.toggle("is-enabled",value.coordinateInterfaceColors); toggle.setAttribute("aria-checked",String(value.coordinateInterfaceColors));
        reset.disabled=!available || value.paletteId==="default" && value.coordinateInterfaceColors;
        status.textContent=value.error || (value.pending?"Saving colors…":value.coordinateInterfaceColors?"Coordinated interface colors enabled.":"Accent only. Interface surfaces and specialized colors use Default.");
        const modes=parent.querySelector('[aria-label="Theme mode"].hub-settings-segments');
        modes?.querySelectorAll("button").forEach(button=>{const selected=button.textContent===(dark?"Dark":"Light");button.classList.toggle("is-selected",selected);button.setAttribute("aria-pressed",String(selected));});
    }
    const unsubscribe=service.subscribe(render), mode=()=>render(); doc.addEventListener("hub-color-mode-change",mode);
    queueMicrotask(()=>render());
    return ()=>{disposed=true;unsubscribe();doc.removeEventListener("hub-color-mode-change",mode);};
}
module.exports={mountAppearanceColors};
