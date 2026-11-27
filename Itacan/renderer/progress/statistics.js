import {button,el} from '../ui/elements.js';
import {showDialog} from '../ui/dialog.js';
import {localDay,workspaces} from './report.js';

function startDate(range,days,end) {
  if(range==='All time')return days.reduce((a,b)=>a<b?a:b,localDay(end));
  const date=new Date(end);
  if(range==='7 days' || range==='30 days')date.setDate(date.getDate()-(range==='7 days'?6:29));
  else {
    const day=date.getDate();date.setDate(1);date.setMonth(date.getMonth()-(range==='1 year'?12:3));
    date.setDate(Math.min(day,new Date(date.getFullYear(),date.getMonth()+1,0).getDate())+1);
  }
  return localDay(date);
}
function chart(host,days,start,end,series){
  const ordinal=day=>Date.parse(day+'T00:00:00Z')/86400000;
  const length=ordinal(end)-ordinal(start)+1,step=length<=100?1:length<=730?7:Math.ceil(length/80);
  const bins=Array.from({length:Math.ceil(length/step)},()=>series.map(()=>0));
  for(const item of days){
    const i=Math.floor((ordinal(item.day)-ordinal(start))/step);
    if(bins[i])bins[i][item.series]++;
  }
  const scale=Math.max(1,...bins.map(values=>values.reduce((a,b)=>a+b,0)));
  const bars=el('div','stat-bars');
  bins.forEach((values,i)=>{
    const bar=el('div','stat-bin');
    bar.title=new Date((ordinal(start)+i*step)*86400000).toISOString().slice(0,10)+' · '+series.map((name,j)=>name+' '+values[j]).join(', ');
    values.forEach((n,j)=>{const segment=el('i','series-'+j);segment.style.height=(100*n/scale)+'%';bar.append(segment);});bars.append(bar);
  });
  host.append(el('small','muted',series.map((name,i)=>name+' '+days.filter(d=>d.series===i).length).join(' · ')),bars,el('small','muted',start+' — '+end));
}
export async function statistics(ctx) {
  const body=el('div','statistics'),filters=el('div','statistics-filters'),ranges=el('div','segmented-controls');
  const all='All workspaces';
  const owners=workspaces(ctx).map(w=>w.path);
  const scope=el('select','text-input'); scope.setAttribute('aria-label','Statistics workspace');
  for(const name of [all,...owners]) scope.add(new Option(name,name));
  filters.append(scope);
  const grid=el('div','statistics-grid scroll-body');body.append(grid);filters.append(ranges);
  let range='All time',notes;
  const activity=(ctx.state.activity || []).filter(e=>!e.reopened),reports=ctx.state.reports || [];
  const card=(title,wide=false)=>{const node=el('section',wide?'panel stat-card wide':'panel stat-card');node.append(el('h3','',title));grid.append(node);return node;};
  function render(){
    if(!notes)return;
    for(const b of ranges.children)b.setAttribute('aria-pressed',String(b.textContent===range));
    grid.replaceChildren();
    const end=localDay(),start=startDate(range,[...reports,...activity,...notes].map(i=>i.day),new Date());
    const period=r=>r.day>=start && r.day<=end;
    const visible=r=>period(r) && (scope.value===all || r.owner===scope.value && !r.removedWorkspace);
    const points=new Map();
    for(const r of reports.filter(visible))points.set(r.owner,(points.get(r.owner)||0)+(r.score || 0));
    const distribution=card('Work distribution');
    const sum=[...points.values()].reduce((a,b)=>a+b,0);
    if(!sum)distribution.append(el('p','muted','No progress report data in this period.'));
    for(const [name,n] of [...points].filter(([,n])=>n).sort((a,b)=>b[1]-a[1])){
      const meter=el('progress');meter.max=sum;meter.value=n;distribution.append(el('p','',name+' · '+n+' pts · '+Math.round(n*100/sum)+'%'),meter);
    }
    const events=activity.filter(visible),work=events.filter(e=>['created','edited','task','step'].includes(e.action));
    chart(card('Activity over time'),work.map(e=>({day:e.day,series:Number(e.owner.startsWith('Resources/'))})),start,end,['Projects','Resources']);
    chart(card('Tasks & steps completed',true),work.filter(e=>['task','step'].includes(e.action)).map(e=>({day:e.day,series:Number(e.action==='step')})),start,end,['Tasks','Steps']);
    const noteCard=card('Notes',true),surviving=new Set(notes.map(n=>n.path)),created=notes.filter(visible);
    const edited=new Set(events.filter(e=>e.action==='edited' && !e.removed && surviving.has(e.path)).map(e=>e.path));
    chart(noteCard,created.map(n=>({day:n.day,series:0})),start,end,['Notes created']);
    noteCard.append(el('p','',new Set([...created.map(n=>n.path),...edited]).size+' total notes · '+edited.size+' edited'));
    const projects=card('Projects');
    for(const w of ctx.library.projects){
      const last=activity.find(e=>!e.removedWorkspace && e.owner===w.path && ['created','edited','task','step'].includes(e.action));
      projects.append(el('p','',w.name+' · '+(ctx.state.projectStatus?.[w.path] || 'Active')+' · '+(last?.day || 'No activity')));
    }
    const compare=card('Projects vs Resources');
    const totals=['Projects','Resources'].map(kind=>reports.filter(r=>period(r)&&r.owner.startsWith(kind+'/')).reduce((n,r)=>n+(r.score||0),0));
    const total=totals[0]+totals[1];
    if(total){const ring=el('div','stat-ring');ring.style.setProperty('--share',(100*totals[0]/total)+'%');compare.append(ring);}
    compare.append(el('p','','Projects '+totals[0]+' pts · Resources '+totals[1]+' pts'));
  }
  for(const name of ['7 days','30 days','3 months','1 year','All time'])ranges.append(button(name,()=>{if(range!==name){range=name;render();}}));
  scope.onchange=render;
  grid.append(el('p','muted','Loading Statistics…'));
  const answer=showDialog({title:'Statistics',wide:true,headerControls:filters,content:body,actions:[]});
  try {notes=await window.itacan.statisticsNotes(ctx.library.session);render();}
  catch(error){grid.replaceChildren(el('p','form-error',error.message));}
  return answer;
}
