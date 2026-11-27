import { applyHomeCover } from '../home/artwork.js';
import preferences from '../../contracts/preferences.cjs';
import { el, button, report } from '../ui/elements.js';
import { showDialog } from '../ui/dialog.js';
import { field, pickPath } from '../ui/forms.js';
import { menu } from '../ui/menu.js';
import './settings.css';

const { defaults, choices, shortcuts, periods, coverArt } = preferences;
const appearance = {
  theme: 'Theme', accent: 'Accent', textSize: 'Text size', density: 'Density', motion: 'Motion',
  readingWidth: 'Reading width', editorMode: 'Default document mode', saveMode: 'Saving'
};
const systemTheme = window.matchMedia('(prefers-color-scheme: dark)');
let activeAppearance;
let devicePreferences = {};
let loadingDevice;

function loadDevice() {
  loadingDevice ||= window.itacan.readDevicePreferences().then(values => {
    devicePreferences = values;
  }).catch(error => {
    loadingDevice = null;
    report(error);
  });
  return loadingDevice;
}

systemTheme.addEventListener('change', () => {
  if (activeAppearance) applyPreferences(...activeAppearance);
});

export function applyPreferences(values,session) {
  activeAppearance = [values,session];
  if (session) void loadDevice();
  const settings = {...defaults,...values};
  const root = document.documentElement;
  root.dataset.theme = settings.theme === 'system' ? (systemTheme.matches?'dark':'light') : settings.theme;
  root.dataset.density = settings.density;
  root.dataset.motion = settings.motion;
  root.dataset.textSize = settings.textSize;
  root.dataset.accent = settings.accent;
  root.dataset.readingWidth = settings.readingWidth;
  applyHomeCover(values?.covers, session);
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
  for (const [name, candidate] of Object.entries(devicePreferences.shortcuts || {})) {
    if ((binding === candidate || literal === candidate) && name in shortcuts) return name;
  }
  for (const [name,[,standard]] of Object.entries(shortcuts)) {
    if (devicePreferences.shortcuts?.[name]) continue;
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
  const sections = el('nav', 'actions');
  sections.setAttribute('aria-label','Settings sections');
  const panel = el('section','settings-fields');
  body.append(sections,panel);
  const tabs = ['Appearance','Editing','Shortcuts','Music','This device'];
  const controls = new Map();
  let page = initial;
  for (const name of tabs) {
    const control = button(name,()=>show(name),{variant:'quiet'});
    controls.set(name, control);
    sections.append(control);
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
        cover.path = path;
        file.textContent = path;
      });
      const actions = el('div','actions');
      actions.append(choose, button('Use bundled image', () => {
        cover.path = '';
        file.textContent = 'Using bundled image';
      }, {variant:'quiet'}));
      group.append(file,actions);
      const position = field(group,'Vertical position (%)','number',cover.position);
      position.min = '0';
      position.max = '100';
      position.oninput = () => {cover.position=Number(position.value);};
      host.append(group);
    }
    panel.append(host);
  }
  function bindings(local = false) {
    const help = local
      ? 'An override takes precedence on this device. Press Backspace to use the library binding again.'
      : 'Select a binding and press its new key combination.';
    panel.append(el('h3', '', local ? 'Device keyboard overrides' : 'Keyboard shortcuts'), el('p', 'muted', help));
    for (const [name, [label, standard]] of Object.entries(shortcuts)) {
      const libraryBinding = values.shortcuts?.[name] || standard;
      const input = field(panel, local ? label + ' override' : label, 'text', local ? localBindings[name] || '' : libraryBinding);
      if (local) input.placeholder = libraryBinding;
      input.readOnly = true;
      input.onkeydown = event => {
        const focusNavigation = event.key === 'Tab' && !event.ctrlKey && !event.metaKey && !event.altKey;
        if (event.key === 'Escape' || focusNavigation) return;
        event.preventDefault();
        if (local && event.key === 'Backspace') {
          delete localBindings[name];
          input.value = '';
          return;
        }
        const binding = eventBinding(event);
        if (!binding) return;
        const target = local ? localBindings : (values.shortcuts ||= {});
        target[name] = binding;
        input.value = binding;
      };
    }
  }

  function websites() {
    const sites = values.websites ||= [];
    panel.append(el('h3', '', 'Website shortcuts'));
    const list = el('div', 'settings-fields');
    panel.append(list, button('Add website', () => {
      sites.push({ label: '', url: '' });
      render();
      list.lastElementChild.querySelector('input').focus();
    }));
    function render() {
      list.replaceChildren();
      for (const [index, site] of sites.entries()) {
        const row = el('div', 'settings-link');
        const label = field(row, 'Name', 'text', site.label);
        const address = field(row, 'Address', 'url', site.url);
        label.oninput = () => { site.label = label.value; };
        address.oninput = () => { site.url = address.value; };
        row.append(button('Remove', () => {
          sites.splice(index, 1);
          render();
        }));
        list.append(row);
      }
    }
    render();
  }

  async function deviceApplications() {
    panel.append(el('h3', '', 'Local applications'), el('p', 'muted', 'Application bindings are saved immediately on this device.'));
    const list = el('div', 'settings-fields');
    panel.append(list, button('Choose application', async () => render(await window.itacan.chooseDeviceApp())));
    function render(apps) {
      list.replaceChildren();
      for (const app of apps) {
        const row = el('div', 'section-heading');
        row.append(el('span', '', app.label), button('Remove', async () => render(await window.itacan.removeDeviceApp(app.id))));
        list.append(row);
      }
      if (!apps.length) list.append(el('p', 'empty', 'No applications configured.'));
    }
    render(await window.itacan.listDeviceApps());
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
      bindings();
      websites();
    } else if (name === 'Music') {
      const enabled=field(panel,'Local music player','select',values.musicEnabled?'Enabled':'Off',['Off','Enabled']);
      enabled.onchange=()=>{values.musicEnabled=enabled.value==='Enabled';};
      panel.append(el('p','muted','Enable Music to play local audio from Projects and Resources.'));
    } else {
      bindings(true);
      await deviceApplications();
    }
  }
  async function restoreDefaults() {
    if (page === 'This device') {
      for (const key of Object.keys(localBindings)) delete localBindings[key];
    } else {
      Object.assign(values, defaults, { shortcuts: {}, covers: {}, websites: [], musicEnabled: false });
    }
    await show(page);
  }

  async function save() {
    const used = new Set();
    for (const [name, [, standard]] of Object.entries(shortcuts)) {
      const binding = localBindings[name] || values.shortcuts?.[name] || standard;
      const normalized = binding.replace(/^Mod\+/, mac ? 'Cmd+' : 'Ctrl+');
      if (used.has(normalized)) throw Error('Shortcut already assigned: ' + binding + '. Review library and device shortcuts.');
      used.add(normalized);
    }
    await ctx.settings.save(values);
    if (JSON.stringify(localBindings) !== JSON.stringify(devicePreferences.shortcuts || {})) {
      devicePreferences = await window.itacan.saveDevicePreferences({ shortcuts: localBindings });
    }
    applyPreferences(ctx.settings.preferences(), ctx.library.session);
  }

  await show(initial);
  return showDialog({
    title: 'Settings',
    content: body,
    footerControls: [button('Restore defaults', restoreDefaults, { variant: 'quiet' })],
    actions: [
      { label: 'Cancel', value: null },
      { label: 'Save settings', primary: true, run: save }
    ]
  });
}
