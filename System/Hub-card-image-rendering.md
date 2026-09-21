# Card image rendering investigation — 2026-09-06

## Findings

- Project category uploads are stored as the original binary bytes, without resizing or recompression. Both card types previously used those files directly via `vault.getResourcePath()` and centered CSS `background-size: cover`.
- Current sources: Project images 563×563 (Textbook), 768×518 (Master's thesis), 512×512 (Obsidian logo); Resource images 735×413 or 1200×675. These exceed their approximately 176×118 / 76×76 displayed image areas at the tested row width.
- No Hub pixelated/crisp-edge rendering rule or permanent card transform was found. Project clipping creates the diagonal boundary; Resource layers transform the decorative pseudo-elements, not the image. Card scale transforms are the existing hover/drag behavior.
- Installed Obsidian 1.13.7 applies `-webkit-optimize-contrast` to Markdown **img** elements, not these background divs. Changing that rule would not fix the cards.
- A local Chromium side-by-side comparison reproduces the downsampling difference. A regular `img` using `object-fit: cover` does not resolve it. Explicit high-quality canvas resampling gives smoother fine detail and silhouette edges at the same size, without sharpening. This isolates a resampling issue rather than degraded source files. The exact live Obsidian compositor has not been instrumented.

## Change

`lib/ui/card-images.js` provides one shared renderer for both Home card types. It decodes the original, resamples the existing centered cover crop with `imageSmoothingQuality = "high"`, and uses an in-memory lossless PNG background. The intermediate retains 2× device-pixel sampling headroom (capped at source resolution) for fractional placement and hover. Originals are never modified; no thumbnail files are written.

CSS dimensions, borders, diagonal clipping, spacing, hover and drag handlers remain unchanged. The pre-cropped preview fills the same background area, avoiding a second crop when device pixels are rounded. Resize and display-density changes regenerate previews. Source decodes and bounded preview results are shared within the dashboard and released on component disposal. SVG/GIF/APNG resource URLs bypass resampling. Decode/canvas failures retain the original background.

The installed Obsidian resource handler sends `Access-Control-Allow-Origin: *`. Image loads explicitly request anonymous CORS so the canvas can be read for local `app://` URLs.

## Verification

- Plugin bundle rebuilt; plugin-load, backlog and typography checks pass.
- `lib/tests/card-images.test.js`: centered/fractional crop math, high-quality lossless output, shared caching, resize, DPR changes, avoiding upscaling, source-replacement races, decode failure, bypass and disposal.
- `lib/tests/card-images.html`: original background / ordinary image / shared renderer / independent high-quality canvas comparison using all seven actual assets and actual card CSS; verifies unchanged card/image dimensions and diagonal clipping at 1× and 2× display density.
- These are isolated browser checks, not a claim of an automated test inside the user's running Obsidian window.

Background on the browser's filtering choice: [Chromium GraphicsContext source](https://chromium.googlesource.com/chromium/src/+/refs/heads/main/third_party/blink/renderer/platform/graphics/graphics_context.cc).

## Follow-up: KTH fine lettering

`lib/tests/card-image-detail.html` compares the previous final-sized intermediate with a 2× intermediate, the original CSS background, and a direct `img`, at normal/fractional card widths and the existing 1.015 hover scale. Tested at DPR 1 and 2 with the actual 768×518 source.

The previous renderer had sufficient nominal DPR but no spare samples for the final browser interpolation: e.g. a 176.203×118 CSS-pixel area was fed a 177×118 raster at DPR 1, and hover stretched it again. The comparison visibly reproduces additional softness in that path. Keeping 2× intermediate resolution improves fine edges during this second sampling pass. This is the only production adjustment; no CSS, layout, clipping, crop, positioning or hover behavior changed. Tests cover the new output sizes and source-resolution cap.

The fine emblem letters are approximately 15–17 pixels high in the original. At the current centered cover scale (118 / 518 ≈ 0.228), that is only about 3.4–3.9 CSS pixels high. Higher-resolution source material cannot enlarge that on-screen footprint at a fixed crop; a high-density display can resolve more strokes, but full small-text readability on a standard-density display is still limited. No sharpening, invented detail, alternative source download or larger crop was introduced. These are isolated Chromium measurements, not live Obsidian compositor instrumentation.
