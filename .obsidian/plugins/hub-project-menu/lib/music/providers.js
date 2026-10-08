"use strict";
const { LocalAudioProvider } = require("./local-audio");
const { YouTubeProvider } = require("./youtube");
const { SpotifyProvider } = require("./spotify");
const { YouTubeMusicProvider } = require("./youtube-music");

const providers = { local: LocalAudioProvider, youtube: YouTubeProvider, spotify: SpotifyProvider, "youtube-music": YouTubeMusicProvider };

function createMusicProvider(plugin, item, options = {}) {
    const Provider = providers[item.provider];
    if (!Provider) throw new Error("This music source is not supported.");
    return new Provider(plugin, item, options);
}

module.exports = { createMusicProvider };
