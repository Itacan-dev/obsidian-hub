import preferences from '../../contracts/preferences.cjs';
import { el, button, report } from '../ui/elements.js';
import { showDialog } from '../ui/dialog.js';
import { field, pickPath } from '../ui/forms.js';
import { menu } from '../ui/menu.js';

const {defaults,choices,shortcuts,periods,coverArt} = preferences;
const appearance = {theme:'Theme',accent:'Accent',textSize:'Text size',density:'Density',motion:'Motion',readingWidth:'Reading width',
  editorMode:'Default document mode',saveMode:'Saving'};
const accentColors = { Forest:['#315c4b','#214635'], Blue:['#315c86','#23496e'], Plum:['#784f76','#5b385a'], Amber:['#846027','#674a1e'] };
const systemTheme = window.matchMedia('(prefers-color-scheme: dark)');
let activeAppearance;
let coverTimer;
let devicePreferences={};
let loadingDevice;
function loadDevice() {
  loadingDevice ||= window.itacan.readDevicePreferences().then(values=>{devicePreferences=values;})
    .catch(error=>{loadingDevice=null;report(error);});
  return loadingDevice;
}
systemTheme.addEventListener('change',()=>{ if(activeAppearance)applyPreferences(...activeAppearance); });

export function applyPreferences(values,session) {
  activeAppearance = [values,session];
  if(session)void loadDevice();
  const settings = {...defaults,...values};
  const root = document.documentElement;
  root.dataset.theme = settings.theme === 'system' ? (systemTheme.matches?'dark':'light') : settings.theme;
  root.dataset.density = settings.density;
  root.dataset.motion = settings.motion;
  root.style.fontSize = ({'Extra large':'19px',Large:'17px',Standard:'15px'})[settings.textSize];
  const colors = accentColors[settings.accent] || accentColors.Forest;
  const dark = root.dataset.theme === 'dark';
  root.style.setProperty('--accent',dark ? 'color-mix(in srgb,'+colors[0]+' 35%,white)' : colors[0]);
  root.style.setProperty('--accent-hover',dark ? 'color-mix(in srgb,'+colors[1]+' 22%,white)' : colors[1]);
  root.style.setProperty('--reading-width',({Narrow:'600px',Wide:'900px',Standard:'700px'})[settings.readingWidth]);
  const now = new Date();
  const hour = now.getHours();
  const period = hour < 5 ? 'Night' : hour < 12 ? 'Morning' : hour < 18 ? 'Afternoon' : hour < 22 ? 'Evening' : 'Night';
  const cover = values?.covers?.[period];
  const art = coverArt.includes(cover?.art) ? cover.art : 'horizon';
  const url = cover?.path && session ? 'itacan://image/'+cover.path.split('/').map(encodeURIComponent).join('/')+'?library='+encodeURIComponent(session) : '/assets/'+art+'.jpg';
  root.style.setProperty('--home-cover',"url("+JSON.stringify(url)+")");
  root.style.setProperty('--cover-position',(cover?.position ?? 47)+'%');
  clearTimeout(coverTimer);
  if (values?.covers) {
    const next = new Date(now);
    next.setHours([5,12,18,22].find(limit=>limit>hour) ?? 29,0,0,0);
    coverTimer=setTimeout(()=>applyPreferences(...activeAppearance),next-now);
  }
}

const mac = /Mac/.test(navigator.platform);
function eventBinding(event,portable=true) {
  if (event.isComposing || event.getModifierState?.('AltGraph')) return '';
  const parts = [];
  if ((mac ? event.metaKey : event.ctrlKey) && portable) parts.push('Mod');
  else if (event.ctrlKey && !event.metaKey) parts.push('Ctrl');
  else if (event.metaKey) return '';
  if (event.altKey) parts.push('Alt');
  if (!parts.length) return '';
  if (event.shiftKey) parts.push('Shift');
  const key = event.key === ' ' ? 'Space' : event.key === 'Tab' ? 'Tab' : event.key.toUpperCase();
  if (!/^(Space|Tab|[A-Z0-9,./-])$/.test(key)) return '';
  parts.push(key);
  return parts.join('+');
}

export function matchCommand(event, settings) {
  const binding = eventBinding(event);
  const literal = eventBinding(event,false);
  if (!binding && !literal) return null;
  for (const [name,candidate] of Object.entries(devicePreferences.shortcuts || {}))
    if ((binding===candidate || literal===candidate) && name in shortcuts) return name;
  for (const [name,[,standard]] of Object.entries(shortcuts)) {
    if(devicePreferences.shortcuts?.[name])continue;
    const candidate = settings?.shortcuts?.[name] || standard;
    if (binding === candidate || literal === candidate) return name;
  }
  return null;
}

export function launchShortcuts(ctx) {
  const control = button('App shortcuts',async()=>{
    const apps = await window.itacan.listDeviceApps();
    const sites = ctx.settings.preferences()?.websites || [];
    menu(control,[
      ...sites.map(site=>({label:site.label,run:()=>window.itacan.openWebLink(site.url)})),
      ...apps.map(app=>({label:app.label,run:()=>window.itacan.launchDeviceApp(app.id)})),
      {label:'Manage shortcuts',run:()=>settingsDialog(ctx,'Shortcuts')}
    ]);
  },{variant:'quiet'});
  return control;
}

export async function settingsDialog(ctx,initial='Appearance') {
  await loadDevice();
  const localBindings={...devicePreferences.shortcuts};
  const values = structuredClone({...defaults,...ctx.settings.preferences()});
  const body = el('div','settings-panel');
  const sections = el('nav','actions'); sections.setAttribute('aria-label','Settings sections');
  const panel = el('section','settings-fields');
  body.append(sections,panel);
  const tabs = ['Appearance','Editing','Shortcuts','Music','This device'];
  const controls = new Map();
  let page = initial;
  for (const name of tabs) {
    const control = button(name,()=>show(name),{variant:'quiet'});
    controls.set(name,control); sections.append(control);
  }
  function preference(key) {
    const input = field(panel,appearance[key],'select',values[key],choices[key]);
    input.onchange = () => { values[key] = input.value; };
  }
  function covers() {
    const host = el('details');
    host.append(el('summary','','Home covers'));
    for (const period of periods) {
      const cover = (values.covers ||= {})[period] ||= {art:'horizon',path:'',position:47};
      const group = el('fieldset','settings-cover');
      group.append(el('legend','',period));
      const art = field(group,'Bundled image','select',cover.art,coverArt);
      art.onchange = () => { cover.art=art.value; };
      const file = el('span','muted',cover.path || 'Using bundled image');
      const choose = button('Choose library image',async()=>{
        const path = await pickPath(ctx,'Choose library image','image','');
        if (!path) return;
        if (!/\.(png|jpe?g|webp|gif|avif)$/i.test(path)) throw Error('Choose a PNG, JPEG, WebP, GIF or AVIF image.');
        cover.path=path;file.textContent=path;
      });
      group.append(file,choose,button('Use bundled image',()=>{cover.path='';file.textContent='Using bundled image';}));
      const position = field(group,'Vertical position (%)','number',cover.position);
      position.min='0'; position.max='100';
      position.oninput = () => {cover.position=Number(position.value);};
      host.append(group);
    }
    panel.append(host);
  }
  function bindings(local=false) {
    panel.append(el('h3','',local?'Device keyboard overrides':'Keyboard shortcuts'),
      el('p','muted',local?'An override takes precedence on this device. Press Backspace to use the library binding again.':'Select a binding and press its new key combination.'));
    for (const [name,[label,standard]] of Object.entries(shortcuts)) {
      const input = field(panel,local?label+' override':label,'text',local?localBindings[name] || '':values.shortcuts?.[name] || standard);
      if (local)input.placeholder=values.shortcuts?.[name] || standard;
      input.readOnly = true;
      input.onkeydown = event => {
        if (event.key === 'Escape' || event.key === 'Tab' && !event.ctrlKey && !event.metaKey && !event.altKey) return;
        event.preventDefault();
        if(local && event.key==='Backspace'){delete localBindings[name];input.value='';return;}
        const binding = eventBinding(event);
        if (binding) { (local ? localBindings : (values.shortcuts ||= {}))[name] = binding; input.value = binding; }
      };
    }
  }
  function websites() {
    const sites = values.websites ||= [];
    panel.append(el('h3','','Website shortcuts'));
    const list = el('div','settings-fields');
    panel.append(list,button('Add website',()=>{sites.push({label:'',url:''});render();list.lastElementChild.querySelector('input').focus();}));
    function render() {
      list.replaceChildren();
      for (const [i,site] of sites.entries()) {
        const row=el('div','settings-link');
        const label=field(row,'Name','text',site.label), address=field(row,'Address','url',site.url);
        label.oninput=()=>{site.label=label.value;};address.oninput=()=>{site.url=address.value;};
        row.append(button('Remove',()=>{sites.splice(i,1);render();}));list.append(row);
      }
    }
    render();
  }
  async function show(name) {
    page = name;
    for (const [key,control] of controls) control.setAttribute('aria-pressed',String(key===page));
    panel.replaceChildren();
    if (name === 'Appearance') {
      for (const key of ['theme','accent','textSize','density','motion']) preference(key);
      covers();
    } else if (name === 'Editing') {
      for (const key of ['editorMode','saveMode','readingWidth']) preference(key);
      panel.append(el('p','muted','Automatic saving writes after a short pause. If a file changes outside Itacan, recover your draft or save a copy.'));
    } else if (name === 'Shortcuts') {
      bindings(); websites();
    } else if (name === 'Music') {
      const enabled=field(panel,'Local music player','select',values.musicEnabled?'Enabled':'Off',['Off','Enabled']);
      enabled.onchange=()=>{values.musicEnabled=enabled.value==='Enabled';};
      panel.append(el('p','muted','Enable Music to play local audio from Projects and Resources.'));
    } else {
      bindings(true);
      panel.append(el('h3','','Local applications'),el('p','muted','Application bindings are saved immediately on this device.'));
      const list = el('div','settings-fields');
      panel.append(list,button('Choose application',async()=>render(await window.itacan.chooseDeviceApp())));
      function render(rows) {
        list.replaceChildren();
        for (const app of rows) {
          const row=el('div','section-heading');
          row.append(el('span','',app.label),button('Remove',async()=>render(await window.itacan.removeDeviceApp(app.id))));list.append(row);
        }
        if (!rows.length) list.append(el('p','empty','No applications configured.'));
      }
      render(await window.itacan.listDeviceApps());
    }
  }
  await show(initial);
  return showDialog({title:'Settings',content:body,footerControls:[
    button('Restore defaults',async()=>{
      if (page==='This device') {
        for (const key of Object.keys(localBindings)) delete localBindings[key];
      } else Object.assign(values,defaults,{shortcuts:{},covers:{},websites:[],musicEnabled:false});
      await show(page);
    },{variant:'quiet'})
  ],actions:[{label:'Cancel',value:null},{label:'Save settings',primary:true,run:async()=>{
    const used=new Set();
    for(const [name,[,standard]] of Object.entries(shortcuts)){
      const binding=localBindings[name] || values.shortcuts?.[name] || standard;
      const normalized=binding.replace(/^Mod\+/,mac?'Cmd+':'Ctrl+');
      if(used.has(normalized))throw Error('Shortcut already assigned: '+binding+'. Review library and device shortcuts.');
      used.add(normalized);
    }
    await ctx.settings.save(values);
    if (JSON.stringify(localBindings)!==JSON.stringify(devicePreferences.shortcuts || {}))
      devicePreferences=await window.itacan.saveDevicePreferences({shortcuts:localBindings});
    applyPreferences(ctx.settings.preferences(),ctx.library.session);
  }}]});
}
