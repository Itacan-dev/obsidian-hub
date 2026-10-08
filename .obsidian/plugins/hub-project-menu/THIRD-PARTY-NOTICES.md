# Spotify Control

Itacan's Spotify Connect backend adapts the minimal backend implementation of
[caezium/obsidian-spotify-control](https://github.com/caezium/obsidian-spotify-control),
commit `bcac3ccd3231ba879e3a3e8444b3f7fb3bae9464`:
`src/auth.ts` (PKCE, expiry, refresh), `src/api.ts` (direct Obsidian requests,
player payloads, 204 handling, one-shot 401 retry, device transfer/retry), and
`src/secure-storage.ts` (Electron safeStorage discovery and encrypted tokens).
PKCE primitives use Node's existing cryptography support; Spotify item parsing
reuses Itacan's existing domain parser. Current Spotify redirect requirements
use an IP-literal loopback callback. There is no plaintext token fallback,
undocumented revocation endpoint, SDK, copied UI, or runtime plugin dependency.

The following upstream notice applies to those adapted portions.

MIT License

Copyright (c) 2026 caezium

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
