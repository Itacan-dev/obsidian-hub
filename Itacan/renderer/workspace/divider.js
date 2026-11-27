import { el, report } from '../ui/elements.js';
export function resizeDivider(label, value, change, commit = () => {}, options = {}) {
  const grip = el('div','divider');
  grip.tabIndex = 0;
  grip.setAttribute('role','separator');
  grip.setAttribute('aria-orientation','vertical');
  grip.setAttribute('aria-label',label);
  const axis = options.axis || (() => 'x');
  grip.onpointerdown = event => {
    if (event.button !== 0) return;
    const coord = axis()==='x'?'clientX':'clientY';
    const start = event[coord], initial = value();
    const restore=options.rememberSize?.() || (()=>change(initial));
    let cancelled=false;
    grip.setPointerCapture(event.pointerId);
    grip.onpointermove = e => change(initial + e[coord] - start);
    const cancel=()=>{cancelled=true;restore();};
    const escape=e=>{
      if(e.key==='Escape' && grip.hasPointerCapture(event.pointerId)) {
        e.preventDefault();cancel();grip.releasePointerCapture(event.pointerId);
      }
    };
    grip.onpointercancel=cancel;
    window.addEventListener('keydown',escape,true);
    grip.onlostpointercapture = () => {
      window.removeEventListener('keydown',escape,true);
      grip.onpointermove=null;grip.onpointercancel=null;
      if(!cancelled)Promise.resolve(commit()).catch(report);
    };
  };
  grip.onkeydown = e => {
    const keys=axis()==='x'?['ArrowLeft','ArrowRight']:['ArrowUp','ArrowDown'];
    if (!keys.includes(e.key)) return;
    e.preventDefault(); change(value() + (e.key === keys[1] ? 16 : -16)); Promise.resolve(commit()).catch(report);
  };
  return grip;
}
