# Home card image placement

Project and Resource card image areas expose the native **Edit image placement** context-menu action. Drag, cursor-anchored wheel zoom (1–3×), Cancel, Done, Escape and save-error handling reuse `mountHeaderImage` from the page covers.

The editor now accepts an optional rendering adapter and controls host. Cards use the existing background renderer through that adapter; covers retain their existing image-element rendering. `imagePlacementGeometry` is shared by both, so zoom and position have the same meaning.

The card renderer samples the selected crop from the original image and retains the existing high-quality, lossless, 2× device-pixel intermediate, capped at source resolution. Card dimensions, diagonal mask, Resource layers and hover transforms remain unchanged. SVG/GIF/APNG backgrounds keep their native rendering and can also be positioned.

Placements share the cover's existing `headerImagePlacements` data map and Hub data-store save path. Keys are `card:project:<stable project ID>::<image path>` or `card:resource:<resource ID>::<image path>`. They are independent of category membership, source-image sharing, card order and hover state. A new source path starts with default placement, as with the large covers. No image files are modified.

Controls are compact overlays inside the card, outside its image mask. During editing only, navigation and Project reordering are suppressed and Project edge scrolling pauses. Normal clicks and hover remain unchanged. The non-interactive Project text layer allows hit-testing of the visible image beneath its empty space.

Verification: `card-placement.html` exercises both card types, independent saves for a shared source, remount, failure recovery, navigation/reorder isolation, clipped-image hit-testing and unchanged geometry/layers. `browser.html` covers the original page-cover editor and existing Home drag behavior. `card-images.test.js` checks saved crop/zoom sampling, quality, caching, density, resizing and cleanup. These use real Hub code/CSS with mocked Obsidian services in an isolated browser; no user placements are changed by the tests.
