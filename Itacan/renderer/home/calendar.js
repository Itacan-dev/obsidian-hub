import { button, el, isoWeek } from '../ui/elements.js';
import { taskEditor } from '../tasks/tasks.js';

// Home's agenda uses dates already owned by library tasks.
export function calendarPanel(ctx) {
  const root = el('section', 'calendar-panel panel bounded-panel');
  const header = el('header', 'section-heading');
  const body = el('div', 'calendar-agenda scroll-body');
  const dates = new Intl.DateTimeFormat(undefined, {month:'short', day:'numeric'});
  const weekdays = new Intl.DateTimeFormat(undefined, {weekday:'short', month:'short', day:'numeric'});
  let weeks = 2;
  let renderedDay, nextWeek;
  const schedule = new Map();
  const todayButton=button('Today',goToToday);
  const more=button('Next week',()=>appendWeek().scrollIntoView({block:'start',container:'nearest'}));
  more.dataset.key='next-week';

  function updateToday(){
    const current=body.querySelector('[aria-current="date"]')?.getBoundingClientRect();
    const viewport=body.getBoundingClientRect();
    todayButton.disabled=!current || current.top>=viewport.top && current.bottom<=viewport.bottom;
  }

  function goToToday() {
    const today = body.querySelector('[aria-current="date"]');
    if (today) body.scrollTop += today.getBoundingClientRect().top - body.getBoundingClientRect().top;
    updateToday();
  }

  function renderWeek(content) {
    const date=nextWeek;
    const end = new Date(date);
    end.setDate(end.getDate() + 6);
    const heading = el('div','section-heading');
    heading.append(el('strong','','Week '+isoWeek(date)),el('small','muted',dates.format(date)+' – '+dates.format(end)));
    content.append(heading);
    for (let day = 0; day < 7; day++, date.setDate(date.getDate()+1)) {
      const key = date.toLocaleDateString('sv-SE');
      const group = el('section','agenda-day');
      const label = el('strong','',weekdays.format(date));
      if (key === renderedDay) label.setAttribute('aria-current','date');
      group.append(label);
      const entries = schedule.get(key) || [];
      for (const {task, time, label} of entries.sort((a,b)=>(a.time || '').localeCompare(b.time || ''))) {
        const row = button([label,time,task.title].filter(Boolean).join(' · '),()=>taskEditor(ctx,task),{variant:'quiet'});
        row.dataset.key=task.id+label;
        group.append(row);
      }
      if (!entries.length) group.append(el('small','muted','No scheduled tasks'));
      content.append(group);
    }
    return heading;
  }
  function appendWeek(){
    const content=document.createDocumentFragment();
    const heading=renderWeek(content);
    more.before(content);
    weeks++;
    return heading;
  }
  body.addEventListener('scroll',()=>{
    updateToday();
    if(body.scrollHeight-body.clientHeight-body.scrollTop<=72)appendWeek();
  },{passive:true});

  function refresh() {
    const top = body.scrollTop;
    const now = new Date();
    const today = now.toLocaleDateString('sv-SE');
    const first = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 12);
    first.setDate(first.getDate() - (first.getDay() + 6) % 7);
    schedule.clear();
    for (const task of ctx.state.tasks) {
      if (task.done) continue;
      for (const [day, time, label] of [[task.start, task.startTime, 'Start'], [task.due, task.dueTime, 'Due']]) {
        if (!day) continue;
        if (!schedule.has(day)) schedule.set(day, []);
        schedule.get(day).push({task, time, label});
      }
    }
    const focusKey = body.contains(document.activeElement) && document.activeElement.dataset.key;
    nextWeek=first;
    const changedDay=renderedDay!==today;
    renderedDay=today;
    const content = document.createDocumentFragment();
    for(let week=0;week<weeks;week++)renderWeek(content);
    content.append(more);
    body.replaceChildren(content);
    if (changedDay) goToToday();
    else body.scrollTop = top;
    updateToday();
    if (focusKey) body.querySelector('[data-key="'+CSS.escape(focusKey)+'"]')?.focus({preventScroll:true});
  }
  header.append(el('h2','','Calendar'),todayButton);
  root.append(header,body);
  refresh();
  return {root,refresh,goToToday};
}
