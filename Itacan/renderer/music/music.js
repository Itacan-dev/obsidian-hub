import { el, button, report } from '../ui/elements.js';
import { showDialog } from '../ui/dialog.js';
import { pickPath } from '../ui/forms.js';
import './music.css';

function slider(input, label, step) {
  input.type = 'range';
  input.min = 0;
  input.max = 1;
  input.step = step;
  input.setAttribute('aria-label', label);
  const row = el('label', 'field', label);
  row.append(input);
  return row;
}

export function musicButton(ctx) {
  const root = button('Music', open);
  // Playback belongs to the application; the dialog only mounts its controls.
  const player = new Audio();
  player.preload = 'metadata';
  const savedVolume = localStorage.getItem('music-volume');
  if (savedVolume !== null && Number.isFinite(Number(savedVolume))) {
    player.volume = Math.max(0, Math.min(1, Number(savedVolume)));
  }

  let playingPath = '';
  let session;
  let status = '';
  let renderTransport;
  let renderList;

  function allowed(path) {
    const oath = ctx.oaths.current();
    return oath?.status !== 'active' || ctx.workspaces.contextFor(path, oath.owner) === oath.owner;
  }

  function stop() {
    player.pause();
    player.removeAttribute('src');
    player.load();
    playingPath = '';
    status = '';
  }

  function refresh() {
    root.hidden = !ctx.library || !ctx.settings.preferences()?.musicEnabled;
    const libraryChanged = session !== ctx.library?.session;
    if (playingPath && (root.hidden || libraryChanged || !ctx.music.playlist().includes(playingPath) || !allowed(playingPath))) {
      stop();
    }
    session = ctx.library?.session;
    renderList?.();
    renderTransport?.();
  }

  function playbackError(path) {
    status = 'Cannot play ' + path + '. Check the file and its audio format.';
  }

  async function play(path) {
    if (!path) return;
    if (!allowed(path)) throw Error('This track is outside the active Oath workspace.');
    status = '';
    if (playingPath !== path) {
      playingPath = path;
      const encodedPath = path.split('/').map(encodeURIComponent).join('/');
      player.src = 'itacan://audio/' + encodedPath + '?library=' + encodeURIComponent(session);
    }
    try {
      await player.play();
    } catch {
      playbackError(path);
    }
    renderList?.();
    renderTransport?.();
  }

  async function adjacent(direction, automatic = false) {
    const tracks = ctx.music.playlist().filter(allowed);
    const index = tracks.indexOf(playingPath);
    const target = index < 0 ? 0 : index + direction;
    if (target >= 0 && target < tracks.length) {
      await play(tracks[target]);
    } else if (automatic) {
      stop();
      renderList?.();
      renderTransport?.();
    }
  }

  player.onended = () => adjacent(1, true).catch(report);
  player.onerror = () => {
    if (playingPath) {
      playbackError(playingPath);
      renderTransport?.();
    }
  };
  for (const name of ['timeupdate', 'loadedmetadata', 'play', 'pause']) {
    player.addEventListener(name, () => renderTransport?.());
  }

  async function open() {
    const body = el('div', 'music-player');
    const caption = el('strong', 'music-current-track');
    const feedback = el('p', 'muted');
    feedback.setAttribute('role', 'status');

    const seek = el('input');
    const volume = el('input');
    const toggle = button('Play', () => {
      if (!player.paused) return player.pause();
      return play(playingPath || ctx.music.playlist().find(allowed));
    });
    const previous = button('Previous', () => adjacent(-1));
    const next = button('Next', () => adjacent(1));
    const tools = el('div', 'actions');
    tools.append(previous, toggle, next);

    const list = el('div', 'music-playlist');
    async function store(tracks) {
      await ctx.music.setPlaylist({ tracks });
      refresh();
    }
    const addTrack = button('Add local track', async () => {
      const file = await pickPath(ctx, 'Add local track', 'audio', '', { confirm: 'Add track' });
      const tracks = ctx.music.playlist();
      if (file && !tracks.includes(file)) await store([...tracks, file]);
    });
    body.append(caption, tools, slider(seek, 'Position (seconds)', .1), slider(volume, 'Volume', .01), feedback, list, addTrack);

    seek.oninput = () => {
      if (Number.isFinite(player.duration)) player.currentTime = Number(seek.value);
    };
    volume.value = player.volume;
    volume.oninput = () => {
      player.volume = Number(volume.value);
      localStorage.setItem('music-volume', volume.value);
    };

    renderList = () => {
      const tracks = ctx.music.playlist();
      list.replaceChildren();
      if (!tracks.length) list.append(el('p', 'empty', 'No local tracks yet.'));

      function shift(index, to) {
        const ordered = [...tracks];
        const [track] = ordered.splice(index, 1);
        ordered.splice(to, 0, track);
        return store(ordered);
      }
      for (const [index, track] of tracks.entries()) {
        const row = el('div', 'section-heading');
        const name = button(track.split('/').at(-1), () => play(track));
        name.title = track;
        name.disabled = !allowed(track);
        name.setAttribute('aria-pressed', String(track === playingPath));

        const up = button('↑', () => shift(index, index - 1));
        const down = button('↓', () => shift(index, index + 1));
        up.setAttribute('aria-label', 'Move up ' + track);
        down.setAttribute('aria-label', 'Move down ' + track);
        up.disabled = index === 0;
        down.disabled = index + 1 === tracks.length;
        const actions = el('div', 'actions');
        actions.append(up, down, button('Remove', () => store(tracks.filter(path => path !== track))));
        row.append(name, actions);
        list.append(row);
      }
    };
    renderTransport = () => {
      const tracks = ctx.music.playlist().filter(allowed);
      const index = tracks.indexOf(playingPath);
      caption.textContent = playingPath || 'Local playlist';
      toggle.textContent = player.paused ? 'Play' : 'Pause';
      toggle.disabled = !tracks.length;
      previous.disabled = index < 1;
      next.disabled = index + 1 >= tracks.length;
      seek.disabled = !Number.isFinite(player.duration);
      seek.max = player.duration || 1;
      seek.value = player.currentTime || 0;
      feedback.textContent = status;
    };
    refresh();
    try {
      await showDialog({ title: 'Music', content: body, actions: [{ label: 'Close', primary: true }] });
    } finally {
      renderTransport = null;
      renderList = null;
    }
  }
  refresh();
  return { root, refresh };
}
