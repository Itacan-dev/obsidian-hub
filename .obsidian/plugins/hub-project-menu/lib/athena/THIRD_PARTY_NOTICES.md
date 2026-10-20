# Athena third-party notices

The generated runtime includes MiniSearch **7.2.0**, copyright 2022 Luca Ongaro,
under the MIT license. The complete license is in `licenses/minisearch.txt`.
Source: https://github.com/lucaong/minisearch

The packaged PDF extraction worker derives from PDF.js **5.4.624**, copyright
2024 Mozilla Foundation, under Apache License 2.0. The complete license is in
`licenses/pdfjs.txt`. Its original JavaScript notice is preserved in the worker.
Athena bundles the parsing API and worker code together and adds its own bounded,
text-only extraction protocol; it does not distribute the full PDF viewer.
Source: https://github.com/mozilla/pdf.js

No native canvas binaries, OCR engines, font files, CMaps, WASM assets, cloud
SDKs, or authentication SDKs are included in the production asset closure.
PDFs requiring unavailable external font/CMap resources may extract partially
or fail. Development-only npm dependencies are not required by the shipped plugin.

Keep this file and both license texts with the distributed plugin, alongside
the notices already present for Hub's other components.
