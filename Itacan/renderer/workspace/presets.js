import { reorderRows } from '../ui/reorder.js';
import { menu } from '../ui/menu.js';
import { askName } from '../ui/dialog.js';
import { confirmAction } from '../ui/forms.js';

export function presetMenu(ctx, anchor, inDesk) {
  const items = ctx.presets.list();
  const snapshot = () => {
    const owner = ctx.layout.folder?.split('/').slice(0,2).join('/');
    return {...ctx.snapshot(), explorer:ctx.workspaces.explorer(owner)};
  };
  const save = async () => {
    let number=1;
    while(items.some(p=>p.name==='Preset '+number)) number++;
    const name = await askName('Save preset', 'Preset '+number, 'Save');
    if (!name) return;
    if (items.some(p => p.name === name)) throw Error('A preset already has that name.');
    await ctx.presets.save({name, layout:snapshot()});
  };
  const options = items.map((preset,index) => ({
    label:preset.name, run:() => ctx.restore(preset),
    context:() => [
      {label:'Rename', run:async () => {
        const name = await askName('Rename preset', preset.name, 'Rename');
        if (name) await ctx.presets.rename({name:preset.name, next:name});
      }},
      {label:'Update preset', disabled:!inDesk, run:() => ctx.presets.save({name:preset.name,layout:snapshot()})},
      ...['up','down'].map((dir,i) => ({label:'Move '+dir, disabled:i ? index === items.length-1 : index === 0,
        run:() => (dir==='up'?ctx.presets.moveUp:ctx.presets.moveDown)({name:preset.name})})),
      {label:'Delete', run:async () => {
        if (await confirmAction('Delete preset?',preset.name,'Delete')) await ctx.presets.remove({name:preset.name});
      }}
    ]
  }));
  if (inDesk) options.unshift({label:'Save as new preset',run:save});
  if (!options.length) options.push({label:'No presets',disabled:true});
  const list=menu(anchor,options);
  for (const label of list.querySelectorAll('.menu-row > button:first-child')) {
    label.draggable=true;label.dataset.reorder='';
  }
  reorderRows(list,'.menu-row',async (row,index,rows)=>{
    const name=row.firstElementChild.textContent;
    await ctx.presets.reorder({name,next:rows[index].firstElementChild.textContent});
    presetMenu(ctx,anchor,inDesk);
    const controls=document.querySelectorAll('.action-menu:popover-open [role=menuitem]');
    [...controls].find(b=>b.textContent===name)?.focus({preventScroll:true});
  });
}
