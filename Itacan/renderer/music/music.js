import { el, button, report } from '../ui/elements.js';
import { showDialog } from '../ui/dialog.js';
import { pickPath } from '../ui/forms.js';

export function musicButton(ctx) {
  const root=button('Music',open);
  const player=new Audio();
  player.preload='metadata';
  const savedVolume=localStorage.getItem('music-volume');
  if(savedVolume!==null && Number.isFinite(+savedVolume))player.volume=Math.max(0,Math.min(1,+savedVolume));
  let playingPath='',session,renderTransport,renderList,status='';
  function allowed(path) {
    const oath=ctx.oaths.current();
    return oath?.status!=='active' || ctx.workspaces.contextFor(path,oath.owner)===oath.owner;
  }
  function stop() {
    player.pause(); player.removeAttribute('src'); player.load(); playingPath='';status='';
  }
  function refresh() {
    root.hidden=!ctx.library || !ctx.settings.preferences()?.musicEnabled;
    if(playingPath && (root.hidden || session!==ctx.library?.session || !ctx.music.playlist().includes(playingPath) || !allowed(playingPath)))stop();
    session=ctx.library?.session;
    renderList?.();renderTransport?.();
  }
  async function play(path) {
    if(!path)return;
    if(!allowed(path))throw Error('This track is outside the active Oath workspace.');
    status='';
    if(playingPath!==path){
      playingPath=path;
      player.src='itacan://audio/'+path.split('/').map(encodeURIComponent).join('/')+'?library='+encodeURIComponent(session);
    }
    try {await player.play();}
    catch{status='Cannot play '+path+'. Check the file and its audio format.';}
    renderList?.();renderTransport?.();
  }
  async function adjacent(direction,automatic=false) {
    const tracks=ctx.music.playlist().filter(allowed);
    const index=tracks.indexOf(playingPath);
    const target=index<0 ? 0 : index+direction;
    if (target>=0 && target<tracks.length)await play(tracks[target]);
    else if(automatic){stop();renderList?.();renderTransport?.();}
  }
  player.onended=()=>adjacent(1,true).catch(report);
  player.onerror=()=>{if(playingPath){status='Cannot play '+playingPath+'. Check the file and its audio format.';renderTransport?.();}};
  for(const name of ['timeupdate','loadedmetadata','play','pause'])player.addEventListener(name,()=>renderTransport?.());
  async function open() {
    const body=el('div','settings-fields');
    const caption=el('strong');
    const feedback=el('p','muted');feedback.setAttribute('role','status');
    const seek=el('input'), volume=el('input');
    function slider(input,label,min,max,step) {
      input.type='range';input.min=min;input.max=max;input.step=step;
      input.setAttribute('aria-label',label);
      const wrap=el('label','field',label);wrap.append(input);return wrap;
    }
    const toggle=button('Play',()=>!player.paused ? player.pause() : play(playingPath || ctx.music.playlist().find(allowed)));
    const previous=button('Previous',()=>adjacent(-1)),next=button('Next',()=>adjacent(1));
    const tools=el('div','actions');tools.append(previous,toggle,next);
    const list=el('div','settings-fields');
    async function store(tracks) { await ctx.music.setPlaylist({tracks});refresh(); }
    body.append(caption,tools,slider(seek,'Position (seconds)',0,1,.1),slider(volume,'Volume',0,1,.01),feedback,list,
      button('Add local track',async()=>{
        const file=await pickPath(ctx,'Add local track','audio','',{confirm:'Add track'});
        if(file && !ctx.music.playlist().includes(file))await store([...ctx.music.playlist(),file]);
      }));
    seek.oninput=()=>{if(Number.isFinite(player.duration))player.currentTime=Number(seek.value);};
    volume.value=player.volume;
    volume.oninput=()=>{player.volume=Number(volume.value);localStorage.setItem('music-volume',volume.value);};
    renderList=()=>{
      const tracks=ctx.music.playlist();
      list.replaceChildren();
      if(!tracks.length)list.append(el('p','empty','No local tracks yet.'));
      function shift(index,to){const ordered=[...tracks];ordered.splice(to,0,ordered.splice(index,1)[0]);return store(ordered);}
      tracks.forEach((track,i)=>{
        const row=el('div','section-heading');
        const name=button(track.split('/').at(-1),()=>play(track));name.title=track;
        name.disabled=!allowed(track);name.setAttribute('aria-pressed',String(track===playingPath));
        const up=button('↑',()=>shift(i,i-1)),down=button('↓',()=>shift(i,i+1));
        up.setAttribute('aria-label','Move up '+track);down.setAttribute('aria-label','Move down '+track);
        up.disabled=i===0;down.disabled=i+1===tracks.length;
        const actions=el('div','actions');actions.append(up,down,button('Remove',()=>store(tracks.filter(p=>p!==track))));
        row.append(name,actions);list.append(row);
      });
    };
    renderTransport=()=>{
      const tracks=ctx.music.playlist().filter(allowed),index=tracks.indexOf(playingPath);
      caption.textContent=playingPath || 'Local playlist';
      toggle.textContent=player.paused ? 'Play':'Pause';toggle.disabled=!tracks.length;
      previous.disabled=index<1;next.disabled=index+1>=tracks.length;
      seek.disabled=!Number.isFinite(player.duration);seek.max=player.duration || 1;seek.value=player.currentTime || 0;
      feedback.textContent=status;
    };
    refresh();
    try {await showDialog({title:'Music',content:body,actions:[{label:'Close',primary:true}]});}
    finally {renderTransport=null;renderList=null;}
  }
  refresh();
  return {root,refresh};
}
