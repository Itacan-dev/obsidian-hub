import { el, button, report } from './elements.js';
import './menu.css';

// Native popover handles outside clicks and Escape for both toolbar and row menus.
export function menu(anchor, items, event) {
  document.querySelector('.action-menu:popover-open')?.hidePopover();
  const list = el('div', 'action-menu');
  list.popover = 'auto';
  list.setAttribute('role', 'menu');
  for (const item of items.filter(Boolean)) {
    const control = button(item.label, async () => {
      if (item.items) return menu(anchor,item.items);
      list.hidePopover();
      await item.run();
    }, { variant: 'quiet' });
    control.setAttribute('role', 'menuitem');
    control.disabled = !!item.disabled;
    if (item.items) control.setAttribute('aria-haspopup','menu');
    if (item.context) control.oncontextmenu = e => {
      e.preventDefault(); menu(anchor, item.context(), e);
    };
    if (item.context) control.onkeydown = e => {
      if (['ArrowRight','ContextMenu'].includes(e.key) || e.shiftKey && e.key === 'F10') control.oncontextmenu(e);
    };
    if (item.context) {
      const row=el('div','menu-row');
      const more=button('…',()=>menu(anchor,item.context()),{variant:'quiet'});
      more.setAttribute('aria-label','Manage '+item.label); more.setAttribute('aria-haspopup','menu');
      row.append(control,more); list.append(row);
    } else list.append(control);
  }
  list.onkeydown = e => {
    if (e.key === 'Escape') {e.preventDefault();list.hidePopover();anchor.focus({preventScroll:true});return;}
    if(e.altKey)return;
    const controls = [...list.querySelectorAll('button:enabled')];
    if(e.key==='Home' || e.key==='End'){e.preventDefault();controls[e.key==='Home'?0:controls.length-1]?.focus();return;}
    if (['ArrowDown','ArrowUp'].includes(e.key)) {
      e.preventDefault();
      controls[(controls.indexOf(document.activeElement) + (e.key === 'ArrowDown' ? 1 : -1) + controls.length) % controls.length]?.focus();
    }
  };
  list.addEventListener('toggle', () => { if (!list.matches(':popover-open')) list.remove(); });
  (anchor.closest('dialog') || document.body).append(list);
  list.showPopover();
  const bounds = anchor.getBoundingClientRect();
  list.style.left = Math.max(4, Math.min(event?.clientX || bounds.left, innerWidth - list.offsetWidth - 4)) + 'px';
  list.style.top = Math.max(4, Math.min(event?.clientY || bounds.bottom, innerHeight - list.offsetHeight - 4)) + 'px';
  list.querySelector('button:enabled')?.focus();
  return list;
}

export function onContext(control, items) {
  control.oncontextmenu = event => {
    event.preventDefault();
    try { menu(control, items(), event); } catch (error) { report(error); }
  };
  control.addEventListener('keydown', event => {
    if (event.key === 'ContextMenu' || event.shiftKey && event.key === 'F10') control.oncontextmenu(event);
  });
}
