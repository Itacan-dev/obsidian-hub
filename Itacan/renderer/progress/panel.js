import {el,button} from '../ui/elements.js';
import {dailyReport,progressEditor,localDay,eventLabel} from './report.js';
import {taskEditor} from '../tasks/tasks.js';

function momentum(scores) {
  const positive=scores.filter(s=>s>0).sort((a,b)=>b-a);
  if (!positive.length) return 0;
  const [best,...rest]=positive;
  return best+(4-best)*0.5*(1-rest.reduce((product,s)=>product*(1-s/4),1));
}

export function progressPanel(ctx,owner) {
  const root=el('section','panel bounded-panel progress-panel');
  const heading=el('header','section-heading');
  heading.append(el('h2','','Progress'));
  if (!owner) heading.append(button('Statistics',async()=>{const {statistics}=await import('./statistics.js');return statistics(ctx);}));
  let year=new Date().getFullYear();
  const nav=el('div','actions progress-years'), label=el('strong');
  function changeYear(delta){year+=delta;calendar();if(tab==='Oaths')renderHistory();}
  const prev=button('‹',()=>changeYear(-1)),next=button('›',()=>changeYear(1));
  prev.setAttribute('aria-label','Previous year');next.setAttribute('aria-label','Next year');nav.append(prev,label,next);
  const heat=el('div','heatmap'),months=el('div','heat-months'),days=el('div','heat-days');
  const weekdays=el('div','heat-weekdays');
  for (const [i,name] of ['Mon','Wed','Fri'].entries()) {
    const label=el('small','',name);
    label.style.gridRow=i*2+1;
    weekdays.append(label);
  }
  heat.append(months,weekdays,days);
  const selectors=el('div','segmented-controls'),history=el('header','section-heading'),body=el('div','scroll-body progress-history');
  history.append(el('h3','','History'),selectors);
  const key=owner?'workspace-progress':'home-progress';
  let historyLimit=50;
  let tab=sessionStorage.getItem(key) || 'Reports';
  for (const name of ['Reports','Activity','Tasks','Oaths']) selectors.append(button(name,()=>{
    if(tab===name)return;
    tab=name;historyLimit=50;sessionStorage.setItem(key,name);body.scrollTop=0;renderHistory();
  }));
  root.append(heading,nav,heat,history,body);
  const matches=e=>!owner || e.owner===owner && !e.removedWorkspace;
  function calendar(){
    const now=localDay(),scores=new Map();
    for(const r of ctx.progress.reports()) if(matches(r)) {
      if(!scores.has(r.day))scores.set(r.day,[]);
      scores.get(r.day).push(r);
    }
    function paint(cell) {
      const day=cell.dataset.day,reports=scores.get(day) || [];
      cell.dataset.level=Math.round(momentum(reports.map(r=>r.score)));
      cell.title=day+' · '+(reports.length?reports.map(r=>r.owner+' '+(r.score??'Unrated')).join(', '):'No progress recorded');
      cell.setAttribute('aria-label',cell.title);
    }
    if(label.textContent===String(year) && days.dataset.today===now) {
      for(const cell of days.querySelectorAll('.heat-day'))paint(cell);
      return;
    }
    days.dataset.today=now;
    label.textContent=year;prev.disabled=year<=1900;next.disabled=year>=Number(now.slice(0,4));
    months.replaceChildren();days.replaceChildren();
    const start=new Date(year,0,1,12),offset=(start.getDay()+6)%7;
    for(let i=0;i<offset;i++)days.append(el('span'));
    const yearDays=new Date(year,1,29).getMonth()===1?366:365;
    months.style.gridTemplateColumns='repeat('+Math.ceil((yearDays+offset)/7)+',minmax(0,1fr))';
    let last, index=offset;
    for(const date=new Date(start);date.getFullYear()===year;date.setDate(date.getDate()+1)){
      const day=localDay(date);
      if(date.getDate()===1){
        const month=el('small','',date.toLocaleString(undefined,{month:'short'}));
        month.style.gridColumn=Math.floor(index/7)+1;
        months.append(month);
      }
      index++;
      const cell=button('',()=>dailyReport(ctx,day,owner));
      cell.className='heat-day';cell.dataset.day=day;paint(cell);
      cell.disabled=day>now;cell.tabIndex=-1;
      if(!cell.disabled)last=cell;
      days.append(cell);
    }
    if(last)last.tabIndex=0;
  }
  function focusDay(target) {
    days.querySelector('[tabindex="0"]')?.setAttribute('tabindex','-1');target.tabIndex=0;
  }
  days.onfocusin=e=>{if(e.target.dataset.day)focusDay(e.target);};
  days.onkeydown=e=>{
    const offsets={ArrowDown:1,ArrowUp:-1,ArrowRight:7,ArrowLeft:-7};
    if(!(e.key in offsets))return;
    e.preventDefault();const cells=[...days.querySelectorAll('button:enabled')];
    cells[Math.max(0,Math.min(cells.length-1,cells.indexOf(e.target)+offsets[e.key]))]?.focus();
  };
  function renderHistory(){
    for(const b of selectors.children)b.setAttribute('aria-pressed',String(b.textContent===tab));
    const fragment=document.createDocumentFragment();
    const rows=tab==='Oaths'?ctx.oaths.history():tab==='Reports'?[...ctx.progress.reports()].sort((a,b)=>b.day.localeCompare(a.day)||b.updated.localeCompare(a.updated)):
      ctx.progress.activity().filter(e=>!e.reopened && (tab==='Tasks')===['task','step'].includes(e.action));
    const visible=rows.filter(r=>matches(r) && (tab!=='Oaths' || r.day?.startsWith(year+'-')));
    if(tab==='Oaths' && visible.length){
      const sessions=visible.filter(r=>r.startedAt || ['fulfilled','broken','interrupted'].includes(r.status));
      const minutes=Math.round(sessions.reduce((ms,r)=>ms+(r.activeMs || 0),0)/60000);
      fragment.append(el('small','muted',year+' · '+sessions.length+' taken · '+sessions.filter(r=>r.status==='fulfilled').length+
        ' fulfilled · '+sessions.filter(r=>r.status==='broken').length+' broken · '+minutes+' min recorded'));
    }
    for(const r of visible.slice(0,historyLimit)){
      const row=el('div','progress-row');
      if(tab==='Oaths'){
        const details=el('details');
        details.append(el('summary','','Oath '+r.status+' · '+r.day),el('p','muted',r.originalOwner || r.owner),
          el('p','',r.condition==='duration'?'Fixed duration':r.condition==='manual'?'Until ended':'Until selected tasks are complete'),
          el('p','',(r.selected || []).map(t=>t.title).join(' · ')),
          el('small','muted',r.activeMs==null?'Active time unknown':Math.round(r.activeMs/60000)+' min committed'));
        row.append(details);fragment.append(row);continue;
      }
      const text=tab==='Reports'?r.summary || 'No reflection':eventLabel(r);
      const open=tab==='Reports'?()=>r.removed?dailyReport(ctx,r.day):progressEditor(ctx,r.day,r.owner):
        r.taskId?()=>{const task=ctx.tasks.find(r.taskId);return task && taskEditor(ctx,task);}:
        ()=>r.action.startsWith('project-')?ctx.openFolder(r.owner):ctx.openNote(r.path);
      const available=tab==='Reports' || (!r.removed && (r.taskId?!!ctx.tasks.find(r.taskId):r.action.startsWith('project-') || /\.md$/i.test(r.path)));
      row.append(available?button(text,open,{variant:'quiet'}):el('span','',text),el('small','muted',[r.owner,r.day,tab==='Reports'?(r.score==null?'Unrated':r.score+'/4'):new Date(r.at).toLocaleTimeString()].join(' · ')));
      fragment.append(row);
    }
    if(visible.length>historyLimit)fragment.append(button('Show more',()=>{
      const top=body.scrollTop;
      historyLimit+=50;renderHistory();body.scrollTop=top;
      body.children[historyLimit-50]?.querySelector('button')?.focus({preventScroll:true});
    }));
    if(!fragment.childNodes.length)fragment.append(el('p','empty',{Reports:'No progress reports yet.',Activity:'No recent activity.',Tasks:'No task progress recorded.',Oaths:'No Oaths recorded yet.'}[tab]));
    body.replaceChildren(fragment);
  }
  function refresh(group){
    if (!group || group==='progress')calendar();
    if (!group || group==='progress' && tab==='Reports' || group==='task' && ['Tasks','Oaths'].includes(tab) || group==='oath' && tab==='Oaths' || group==='files' && tab==='Activity')renderHistory();
  }
  refresh();return {root,refresh};
}
