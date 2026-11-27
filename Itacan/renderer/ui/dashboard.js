import './dashboard.css';
import { el } from './elements.js';

export function isoWeek(now) {
  const day = new Date(Date.UTC(now.getFullYear(),now.getMonth(),now.getDate()));
  day.setUTCDate(day.getUTCDate()+4-(day.getUTCDay() || 7));
  return Math.ceil(((day-Date.UTC(day.getUTCFullYear(),0,1))/86400000+1)/7);
}
export function dashboardDate(now = new Date()) {
  const week = isoWeek(now);
  const result = el('div','dashboard-date');
  const date = new Intl.DateTimeFormat(undefined,{weekday:'long',month:'long',day:'numeric',year:'numeric'});
  result.append(el('div','',date.format(now)),el('small','muted','Week '+week));
  return result;
}
