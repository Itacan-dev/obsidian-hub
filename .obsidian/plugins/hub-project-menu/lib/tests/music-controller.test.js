"use strict";
const assert = require("assert/strict"), fs = require("fs"), vm = require("vm");
const exportsObject = { exports: {} };
vm.runInNewContext(fs.readFileSync(require.resolve("../services/music-controller"), "utf8"), {
    module: exportsObject, require: () => ({ createMusicProvider() { throw Error("Inject a fixture provider"); } }), console
});
const { MusicController } = exportsObject.exports;
function fixture() {
    let changed;
    const library = { state: { enabled: true }, items: [
        { id: "one", name: "First", provider: "local" }, { id: "two", name: "Second", provider: "local" },
        { id: "video", name: "Video", provider: "youtube" }, { id: "preview", name: "Preview", provider: "spotify" }
    ], get(id) { return this.items.find(item => item.id === id); }, list() { return this.items; },
    onChange(callback) { changed = callback; return () => { changed = null; }; }, emit() { changed?.(); } };
    const players = []; let delayed = false;
    const controller = new MusicController({}, library, { document: {}, createProvider(plugin, item, callbacks) {
        const player = { id: item.id, callbacks, destroyed: false, paused: false, mounts: 0, played: 0,
            capabilities: { play: true, pause: true, seek: true, volume: true, progress: true,
                persistent: item.provider === "local", visiblePlayer: item.provider !== "local" },
            element: { remove() {} }, mount() { this.mounts++; },
            load() { callbacks.onState({ status: "ready", duration: 120, volume: 1 }); return delayed ? new Promise(resolve => { this.resolve = resolve; }) : Promise.resolve(); },
            play() { this.played++; callbacks.onState({ status: "playing" }); },
            pause() { this.paused = true; callbacks.onState({ status: "paused" }); },
            seek(value) { callbacks.onState({ currentTime: value }); }, setVolume(value) { callbacks.onState({ volume: value }); },
            suspend() { this.paused = true; }, destroy() { this.destroyed = true; }
        }; players.push(player); return player;
    } });
    const surface = { ownerDocument: {} }; controller.attach(surface);
    return { controller, library, players, surface, delay(value) { delayed = value; } };
}
async function run() {
    {
        const { controller: c, players, surface } = fixture();
        await c.select("one"); c.seek(42); c.detach(surface);
        assert.equal(players.length, 1); assert.equal(players[0].destroyed, false);
        assert.equal(c.snapshot.status, "playing"); assert.equal(c.snapshot.currentTime, 42);
        c.attach(surface); assert.equal(players.length, 1); assert.equal(players[0].played, 1);
        assert.equal(c.snapshot.currentTime, 42, "Closing/reopening keeps the same audio and position");
        await c.setVolume(0.3); await c.select("two"); assert.equal(players[0].destroyed, true); assert.equal(players[0].paused, true);
        assert.equal(c.snapshot.volume, 0.3, "New audio metadata cannot reset the user's volume");
        assert.equal(c.snapshot.capabilities.previous, true); assert.equal(c.snapshot.capabilities.next, false);
        c.destroy(); assert.equal(players[1].destroyed, true);
    }
    {
        const { controller: c, players, surface } = fixture();
        await c.select("video"); c.seek(33); c.detach(surface);
        assert.equal(players[0].paused, true); assert.equal(players[0].destroyed, true);
        assert.equal(c.snapshot.status, "paused", "YouTube cannot remain playing without its visible player");
        c.attach(surface); await Promise.resolve(); await Promise.resolve(); await Promise.resolve();
        assert.equal(players.length, 2); assert.equal(players[1].played, 0, "Reopening never autoplays streaming content");
        c.destroy();
    }
    {
        const { controller: c, players, delay } = fixture();
        delay(true); const pending = c.select("video"); await Promise.resolve();
        delay(false); await c.select("one"); players[0].resolve(); await pending;
        assert.equal(players[0].played, 0, "A delayed old SDK cannot play after changing source");
        players[0].callbacks.onState({ status: "error", message: "stale" });
        assert.equal(c.snapshot.item.id, "one"); assert.equal(c.snapshot.status, "playing");
        c.destroy();
    }
    {
        const { controller: c, library, players } = fixture();
        await c.select("one"); library.state.enabled = false; library.emit();
        assert.equal(players[0].destroyed, true); assert.equal(c.snapshot.item, undefined);
        assert.equal(library.items.length, 4, "Feature disable retains saved references");
        await c.select("two"); assert.equal(players.length, 1);
        library.state.enabled = true; library.emit(); await c.select("two");
        library.items = library.items.filter(item => item.id !== "two"); library.emit();
        assert.equal(players[1].destroyed, true, "Removing/disabling active entry releases playback"); c.destroy();
    }
    {
        const { controller: c, players } = fixture();
        await c.select("one"); await c.ended();
        assert.equal(c.snapshot.item.id, "two", "Local queue follows saved ordering");
        assert.equal(players[0].destroyed, true); await c.ended();
        assert.equal(c.snapshot.status, "ended", "End of local queue does not play another provider"); c.destroy();
    }
    {
        const { controller: c, players } = fixture();
        await c.select("preview");
        const events = [];
        let finishPause;
        players[0].suspend = () => new Promise(resolve => {
            events.push("pause requested"); finishPause = () => { events.push("paused"); resolve(); };
        });
        const replacement = c.select("one");
        await Promise.resolve();
        assert.equal(players.length, 1, "Replacement is not even loaded while remote pause is pending");
        finishPause(); await replacement;
        assert.deepEqual(events, ["pause requested", "paused"]);
        assert.equal(players[1].played, 1, "Next source starts after remote pause completes");
        c.destroy();
    }
    {
        const { controller: c, players } = fixture();
        await c.select("preview");
        let attempts = 0;
        players[0].suspend = () => {
            if (++attempts === 1) throw Error("Spotify could not be paused. Check your connection and try again.");
        };
        await c.select("one");
        assert.equal(players.length, 1, "Failed pause cannot leave two sources active");
        assert.equal(c.snapshot.status, "error");
        await c.play();
        assert.equal(attempts, 2, "Retry reattempts the failed remote pause");
        assert.equal(players[1].played, 1);
        c.destroy();
    }
    {
        const { controller: c, players, library, surface } = fixture();
        await c.select("preview", { autoplay: false });
        const remote = players[0]; remote.capabilities.persistent = true;
        let detached = 0; remote.detach = () => detached++;
        remote.callbacks.onState({ trackTitle: "Current remote track", artist: "Artist" });
        library.items.find(item => item.id === "preview").name = "Renamed playlist"; library.emit();
        assert.equal(c.snapshot.title, "Current remote track", "Renaming saved context preserves current track metadata");
        c.detach(surface); assert.equal(detached, 1); assert.equal(remote.destroyed, false);
        c.attach(surface); assert.equal(players.length, 1, "Remote adapter survives close/reopen");
        c.destroy();
    }
    {
        const { controller: c, library } = fixture();
        await c.select("one"); library.items[0].name = "Renamed"; library.emit();
        assert.equal(c.snapshot.title, "Renamed"); await c.setVolume(4); assert.equal(c.snapshot.volume, 1);
        await c.setVolume(-1); assert.equal(c.snapshot.volume, 0); c.destroy();
    }
    console.log("Music controller passed: single-source ownership, close/reopen continuity, delayed SDK cancellation, disable/removal, local queue, rename and volume.");
}
run().catch(error => { console.error(error); process.exitCode = 1; });
