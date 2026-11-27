import preferences from '../../contracts/preferences.cjs';

export const resourceArt = {
  Knowledge: 'knowledge',
  Literature: 'research',
  Explorations: 'explorations',
  Inspiration: 'inspiration'
};

let coverTimer;

function timeOfDay(hour) {
  if (hour < 5 || hour >= 22) return 'Night';
  if (hour < 12) return 'Morning';
  return hour < 18 ? 'Afternoon' : 'Evening';
}

export function applyHomeCover(covers, session) {
  const now = new Date();
  const hour = now.getHours();
  const cover = covers?.[timeOfDay(hour)];
  const art = preferences.coverArt.includes(cover?.art) ? cover.art : 'horizon';
  let url = '/assets/' + art + '.jpg';
  if (cover?.path && session) {
    const file = cover.path.split('/').map(encodeURIComponent).join('/');
    url = 'itacan://image/' + file + '?library=' + encodeURIComponent(session);
  }
  const style = document.documentElement.style;
  style.setProperty('--home-cover', 'url(' + JSON.stringify(url) + ')');
  style.setProperty('--cover-position', (cover?.position ?? 47) + '%');

  clearTimeout(coverTimer);
  if (covers) {
    const next = new Date(now);
    // After 22:00 the next boundary is 05:00 on the following day.
    next.setHours([5, 12, 18, 22].find(boundary => boundary > hour) ?? 29, 0, 0, 0);
    coverTimer = setTimeout(() => applyHomeCover(covers, session), next - now);
  }
}
