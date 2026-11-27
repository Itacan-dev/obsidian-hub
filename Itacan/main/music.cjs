const fs = require('node:fs/promises');
const path = require('node:path');
const audioTypes = {'.mp3':'audio/mpeg','.m4a':'audio/mp4','.aac':'audio/aac','.wav':'audio/wav','.ogg':'audio/ogg','.flac':'audio/flac','.opus':'audio/ogg'};

async function audioPath(library, relative) {
  if (typeof relative!=='string' || !audioTypes[path.extname(relative).toLowerCase()]) throw Error('Choose a supported local audio file.');
  const resolved = await library.resolve(relative,3);
  if (!(await fs.stat(resolved)).isFile()) throw Error('Choose an audio file.');
  return resolved;
}

async function setPlaylist(state, {tracks}, library) {
  if (!Array.isArray(tracks) || tracks.length>1000 || tracks.some(item=>typeof item!=='string') || new Set(tracks).size!==tracks.length)
    throw Error('A playlist contains up to 1000 unique library tracks.');
  const previous = new Set(state.playlist || []);
  for (const item of tracks) if (!previous.has(item)) await audioPath(library,item);
  state.playlist=[...tracks];
}

function rewriteMusicRefs(state, from, to) {
  if (!state.playlist) return;
  const tracks = [];
  for (const track of state.playlist) {
    if (track !== from && !track.startsWith(from + '/')) tracks.push(track);
    else if (to) tracks.push(to + track.slice(from.length));
  }
  state.playlist = tracks;
}
module.exports = {audioTypes,audioPath,setPlaylist,rewriteMusicRefs};
