# Music in the Obsidian prototype

Music is configured in Settings → Music and selected for playback in the existing
Music window. Fresh and existing installations without saved configuration start
with Music disabled. Enabling it reveals the bottom-bar launcher. The launcher
has no permanent transport controls, and The Oath does not start music.

Settings uses the existing category navigation, section/row helpers, native
Obsidian toggles and shared Capture modal. Users can save source links, select
several local files, rename references, move them up/down, disable individual
items and remove them. Removing a reference does not delete its audio file or
change a streaming-service playlist. Provider and feature toggles retain the
saved library. The Music window contains only configured enabled entries; its
empty state links directly to Settings → Music.

## Ownership and persistence

- `lib/domain/music.js` defines provider identities, supported source types,
  URL/path validation, canonical references, stable IDs and safe defaults.
- `lib/services/music-library.js` serializes edits through the existing atomic
  `HubDataStore`. Optional official oEmbed requests retrieve titles and HTTPS
  thumbnails without inserting returned HTML or requiring account OAuth.
- `lib/services/music-controller.js` owns a single transient player and selects
  adapters through `lib/music/providers.js`. Adapter capabilities determine
  the controls shown by `lib/ui/music.js`. Generation checks and adapter
  cancellation prevent late ready callbacks from restoring old players.
- `lib/music/local-audio.js`, `youtube.js`, `spotify.js` and `youtube-music.js`
  implement provider lifetimes. Spotify's plugin-owned Connect service is
  `lib/services/spotify-connect.js`, with OS credential encryption in
  `spotify-secret-storage.js`; `lib/music/spotify-embed.js` retains the official
  embed implementation. `provider-base.js` owns cancellation/listener
  cleanup, `iframe-api.js` loads the official SDKs, and `browser-guard.js` adds
  the content boundary to an existing Atlas-protected Music guest.
- `lib/ui/music-settings.js` and `lib/ui/music-item-editor.js` extend existing
  Settings and Capture components. `plugin.js` mounts the existing launcher and
  disposes the library/controller on unload. `styles.css` uses existing modal,
  list, button, typography and accent conventions.

The optional `music` field in private Hub data is version 1:

```json
{
  "version": 1,
  "enabled": false,
  "providers": {
    "spotify": true,
    "youtube": true,
    "youtube-music": true,
    "local": true
  },
  "items": []
}
```

Each item stores its stable `id`, `name`, `provider`, `source`, `sourceType`,
`enabled`, optional HTTPS `artwork` and provider metadata needed to reconstruct
the player. Array order is playback/selection order. Reading absent fields does
not write a migration. Saves preserve unrelated Hub data and use existing
revision/conflict checks. Future unsupported versions remain readable as an
unavailable library with an inline explanation; they are not overwritten.
Player objects, current playback positions, audio nodes and SDK handles are
never persisted. Reload restores configuration and starts idle.

## Providers and lifetime

| Provider | Integration | Common controls | Closing Music |
| --- | --- | --- | --- |
| Local files | Native Chromium audio; existing vault resource URLs and desktop file references | Play/pause, seek, volume, duration/progress and ordered previous/next | Retains the same audio node and playback |
| YouTube | Official IFrame Player API; videos and playlists | Play/pause, seek, volume, duration/progress; previous/next for playlists | Pauses and destroys the visible player |
| Spotify | Spotify Connect through Spotify Web API; existing saved tracks, albums, playlists and artists | Play/pause, previous/next, seek, progress, current track/artist/artwork and supported device volume | Remote playback continues; polling stops |
| YouTube Music | Existing Obsidian webview partition, Atlas native guard and a source-specific navigation constraint | Actual service controls in its visible player | Destroys the guest and stops playback |

Local audio is never attached to the modal DOM. Chromium pauses connected audio
when its containing subtree is removed, so a detached audio node is created and
retained from the beginning. Closing/reopening only reconnects the Music UI to
controller state. Switching sources, disabling the active source, removing an
active item or unloading the plugin releases the previous player. Local files
advance automatically through enabled local entries in saved order.

External files remain in their original location. Desktop playback reuses
Obsidian's existing file-resource protocol instead of attempting to load a
`file:///` URL into its `app://` renderer. Missing or unreadable paths and
unsupported formats produce identifiable inline errors.

YouTube always retains its official visible player and branding while the
window is open. Closing Music or hiding the document pauses it. The API's
reported inaccessible-video/embed errors are surfaced in Music, including error
153 when the runtime cannot identify an embed. No stream extraction, download,
background iframe or provider DOM scraping is used.

YouTube Music remains a separate provider. Its webview uses the existing Atlas
partition and guard; there is no address bar or Atlas browser toolbar in Music.
The additional native source constraint permits only the configured content and
its supported playback path, and refuses unrelated navigation/popups. Atlas
must be initialized and allow `music.youtube.com`. Where regional consent is
required, the official `https://consent.youtube.com/m` or `/ml` screen is allowed
only when its single `continue` URL returns to the same configured item. Its
consent form can submit after that bound screen has loaded. Atlas independently
assesses every navigation and must also permit the exact `consent.youtube.com`
hostname; Music does not change its policy or grant access. Consent is completed
manually in the visible service surface. Sign-in, consent and network
availability can limit playback. An album's shared
playlist URL is the most reliable source form; a supported album page can also
be saved. Because the service has no supported transport API for this desktop
surface, Music does not invent common controls or retain a hidden guest.

## Spotify in Obsidian and standalone Itacan

```text
OBSIDIAN PROTOTYPE
MusicController -> SpotifyProvider -> SpotifyConnectBackend
                -> Spotify Web API -> Spotify Connect device

FUTURE STANDALONE ITACAN
MusicController -> SpotifyProvider -> SpotifyEmbedBackend
                -> official Spotify Embed -> DRM/Widevine-capable runtime
```

The current Obsidian build selects Connect directly. It does not try an embed
and fall back after detecting a preview. The official Embed implementation
remains in the repository for standalone Itacan, where the application can
provide a DRM/Widevine-capable runtime. The earlier actual Obsidian investigation
confirmed a correct iframe URL, `encrypted-media` permission, and no relevant
sandbox/CSP restriction, but `com.widevine.alpha` rejected with
`NotSupportedError`. EME's API and iframe permission do not supply the Widevine
decryption module, so Spotify provided approximately 29.7-second previews.

Connect sends playback commands to an existing Spotify device; the Obsidian
renderer does not decrypt or play Spotify audio itself. The Music window keeps
Itacan's existing selection, Now Playing and capability-based controls. It does
not show Spotify's web interface, search or discovery. Saved Spotify entries
keep their identities, names, ordering, artwork and enabled state. Their
existing canonical URL/metadata supplies `spotify:track:ID` for a track URI
list or `spotify:playlist:ID`, `spotify:album:ID`, or `spotify:artist:ID` as a
playback context. No item migration or re-adding is required.

### Spotify setup

1. In [Spotify Developer Dashboard](https://developer.spotify.com/dashboard),
   create or open your app and enable Web API use. Add this exact redirect URI
   and save the app: `http://127.0.0.1:43827/itacan-spotify-callback`.
2. Copy the app's Client ID into **Settings -> Music -> Spotify**, then Save.
   No Client Secret is used. Authorize only an account allowed by your app.
3. Choose **Connect Spotify**, complete authorization in the external browser,
   and return to Itacan. The plugin receives the callback through a temporary
   listener bound to `127.0.0.1`; it does not use an `obsidian://` redirect.
4. Open Spotify on a device and keep it available. Select a saved Spotify item
   in Music and press Play. Spotify Premium is required for playback control.

New apps use development mode. The app owner must have Spotify Premium, and
currently at most five Spotify users can authenticate. Add the account you
will authorize to the app's allowlist under **Settings -> Users Management ->
Add new user** in the dashboard. These are Spotify's current
[development-mode requirements](https://developer.spotify.com/documentation/web-api/concepts/quota-modes).

The flow uses a public client with PKCE and a checked OAuth state. Its only
scopes are `user-read-playback-state` and `user-modify-playback-state`.
Authentication, automatic refresh and HTTP requests belong to the plugin-owned
backend. Client ID is ordinary configuration; access and refresh credentials
are encrypted with Electron `safeStorage`, with no plaintext fallback.
The optional `spotifyConnect` field in existing private Hub data contains
`version: 1`, `clientId`, and `tokensEnc` ciphertext when connected. Ciphertext
is bound to the operating system's secure storage; copying it to another
machine does not provide portable credentials. The PKCE verifier and state
exist only in memory. The loopback listener closes on a valid callback,
Disconnect, plugin unload, or its five-minute authorization timeout.
If secure storage is unavailable, Settings explains the problem and disables
Connect. Disconnect removes Itacan's local credentials and cancels pending
authorization; it leaves remote Spotify playback alone and does not claim
Spotify-side revocation. If Itacan started that playback and later loses
authorization, switching to another provider requires reconnecting so Itacan
can complete the Spotify pause before starting the next source.

Requests use Obsidian `requestUrl`; successful `204` writes do not attempt to
parse JSON. An expired token refreshes on demand with a 30-second safety margin,
and a `401` gets one refresh/retry. Concurrent refreshes share one request.
`429` responses enforce `Retry-After`; transient refresh failures enforce a
30/60/120/300-second increasing cooldown on demand, and terminal credential
errors require reconnecting. No access token,
refresh token, authorization code or verifier is logged.

The backend prefers an active usable device and ignores restricted devices.
When only an inactive usable device is available, it transfers playback and
continues the command. With no usable device, Music asks the user to open
Spotify on a device and try again. It never launches or foregrounds Spotify
for normal controls. Volume is exposed only for a supporting device.
Closing Music leaves remote playback running; reopening queries current state
instead of restarting the saved playlist. Selecting another provider pauses
Spotify before starting that provider. Spotify UI state uses moderate visible
polling and refreshed state after actions, with no polling while Music is closed.

The Connect backend is self-contained. Spotify Control is a source/reference
implementation, not a runtime dependency. Itacan does not access another
plugin's objects and does not use Spotify Web Playback SDK. The adapted backend
concepts cover PKCE authentication, secure credential persistence, refresh,
Obsidian `requestUrl`, playback/device requests, and transfer/retry handling.
Spotify Control's sidebar, settings, commands, lyrics, capture, search, queue,
discovery and library UI are deliberately excluded. The authentication redirect
uses Spotify's current loopback-URI rules rather than the upstream plugin's
older custom-protocol callback.
The adapted source is `src/auth.ts`, `src/api.ts`, and `src/secure-storage.ts`
from [caezium/obsidian-spotify-control](https://github.com/caezium/obsidian-spotify-control)
at commit `bcac3ccd3231ba879e3a3e8444b3f7fb3bae9464`. The backend source headers
identify the adaptation, and the full MIT copyright/permission notice is
preserved in `.obsidian/plugins/hub-project-menu/THIRD-PARTY-NOTICES.md`.
Authentication follows Spotify's current
[PKCE flow](https://developer.spotify.com/documentation/web-api/tutorials/code-pkce-flow)
and [redirect URI rules](https://developer.spotify.com/documentation/web-api/concepts/redirect_uri).

## Verification

From the vault root, with Node available on PATH (or substitute its executable
path):

```powershell
node .obsidian/plugins/hub-project-menu/build.js
node --test .obsidian/plugins/hub-project-menu/lib/tests/music-library.test.js
node --test .obsidian/plugins/hub-project-menu/lib/tests/music-controller.test.js
node --test .obsidian/plugins/hub-project-menu/lib/tests/music-providers.test.js
node --test .obsidian/plugins/hub-project-menu/lib/tests/spotify-connect.test.js
node .obsidian/plugins/hub-project-menu/lib/tests/plugin-load.test.js
node .obsidian/plugins/hub-project-menu/lib/tests/run-music-obsidian-test.cjs
```

The last command loads the installed Obsidian application archive with the
already-installed native-test Electron runtime. It forces every application
window to stay hidden and creates an isolated temporary profile/vault. It copies
the built plugin and production modules, supplies two synthetic silent WAVs and
uses actual Obsidian APIs, native modals, native toggles and atomic persistence.
It never opens the working vault, copies personal Hub data or shares account
cookies. The checked temporary tree is removed when the child exits. The runner
does not install dependencies or patch the installed Obsidian application.

The runtime fixture covers defaults and the actual launcher, Settings/empty
state navigation, invalid and valid Add music forms, actual multiple-file input
through Chromium `File` objects, all source toggles, retained items,
rename/order/removal, native vault/external audio, seek/volume/pause, focused
seek-range progress, close/reopen identity, automatic next, missing files,
undecodable WAV errors and actual plugin unload/reload. Desktop, intermediate
and narrow native modal captures and a JSON
provider-outcome report are written to the system temporary directory.

The fixture attempts the real official remote embeds and an initialized Atlas
YouTube Music guest. A remote provider settling to an explained error verifies
graceful failure; it does not establish successful playback, DRM support or
account-specific compatibility. The hidden test application deliberately does
not bypass YouTube's visibility restriction to simulate background playback.

The isolated desktop run on 7 October 2026 used installed Obsidian 1.13.7 and
the existing Electron 39.8.3 native-test runtime. It verified actual native
playback of both vault and external WAVs, retained audio after closing/reopening,
seek/progress while the range remained focused, volume across manual/automatic
track changes, missing paths, actual invalid-WAV decode errors, native multiple
file selection and plugin unload/reload. Official YouTube video and playlist players both reached
ready. The official Spotify track embed played a 29.713-second preview, reported
advancing progress and confirmed pause; this is preview playback evidence and
does not establish full Spotify playback or DRM support. All three official
SDK/service network probes returned HTTP 200 in the network-enabled run.

YouTube Music reached its official regional consent screen in a visible player
surface inside the hidden test window. The synthetic Atlas policy explicitly
allowed only `music.youtube.com` and `consent.youtube.com`; the native assessment
recorded both exact hostnames and the guest reached `DISPLAYED`. The consent
return URL referred to the saved song. Music showed the manual consent
instruction and closing the modal destroyed the guest. Consent was not accepted,
so this verifies the protected service/consent surface and lifecycle, not actual
YouTube Music song playback or signed-in compatibility.

The test keeps its audio output muted and uses fresh account storage. It does
not accept service consent or sign in. The running work vault's plugin is not
reloaded by this harness; the rebuilt plugin takes effect there on the user's
next reload/restart. No personal settings or existing library are written by
the runtime test.

The Connect run on 7 October 2026 loaded the actual installed Obsidian 1.14.4
application archive in the isolated native-test Electron 39.8.3 environment.
All 17 native runtime checks passed. This is distinct from the earlier 1.13.7
Embed verification and from the running work application's Electron 43.3.0.

The Spotify Connect fixture adds native Settings draft/caret retention, Client
ID persistence, exact redirect display, external PKCE authorization-point
capture, a real local HTTP callback listener, and native OS encryption of
deliberately synthetic credentials. It supplies synthetic Spotify token/player
responses to exercise Itacan controls, metadata, source switching, modal
lifetime, reload and local Disconnect. These checks exercise actual Obsidian
UI, persistence and Electron secure storage; they do not authorize a real
Spotify account or establish actual Spotify device playback. Focused backend
and provider tests also cover URI/payload conversion, PKCE state/cancellation,
expiry/refresh, `204`, bounded `401` retry, `429`, usable device selection,
transfer/retry, device capabilities and visible polling/closed cleanup.

Live verification requires the user's Client ID, Spotify authorization and an
available Premium Connect device. After the setup above, manually verify saved
track, playlist, album and supported artist contexts; play/pause, previous/next,
seek, progress, track/artist/artwork and supported device volume; continuing
playback when Music closes, fresh state without restarting on reopen, and pause
before switching to Local or YouTube. Also check an inactive available device
transfer and the actionable no-device state. No live-account success is claimed
by the synthetic fixture.
