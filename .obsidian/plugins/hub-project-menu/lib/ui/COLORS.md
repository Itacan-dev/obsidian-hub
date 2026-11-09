# Itacan Default colors

`styles.css` contains the authoritative Default color contract. Primitives feed
semantic roles and specialized Oath/visualization roles; those feed an explicitly
scoped native Obsidian compatibility bridge. Native aliases are rebound together
because inherited custom properties have already resolved their dependencies.

Only explicit `hub-color-scope` roots participate. `hub-button-scope` is not an
ownership marker. Use `color-system.js` at an Itacan surface's creation boundary,
before computed-style reads. Register returned disposers with its existing life.
Modal, Menu and Notice adapters preserve the original objects and native behavior.
A Notice's outer `containerEl` owns its paint. Native tooltip triggers receive the
scope through `data-tooltip-classes`; preserve existing tooltip settings.

The native bridge is Dark-only. Light retains its existing native inheritance and
specialized overrides. Native note-editor leaves, external service documents,
images/brands/calendar source identities and OS-controlled surfaces remain outside
the contract. Settings' excluded content uses a host island. Host snapshots are
used only to restore that island, never to derive Default.

Do not add palette preferences or activate Appearance during this migration.
Future application can replace the owned declaration set in each document. Cancel
sampled attention effects before doing so. The dock currently owns five local
fixed tokens; future messages belong in its existing model boundary.

## Verification

From the plugin directory:

```
node lib/tests/color-system.test.js
node lib/tests/progress-colors.test.js
node lib/tests/progress-heatmap.test.js
node lib/tests/run-color-system.cjs
node lib/tests/run-color-native.cjs
```

The browser runner extracts installed Obsidian 1.15.0 CSS to a temporary directory.
It compares 4,752 exact computed values against pre-migration Dark/Light goldens,
checks live token coverage, host isolation, portals, sampled effects, secondary documents, dock tokens and aborted
prepared frames, and captures native-style reference screenshots. The native runner
uses a hidden temporary profile, a minimal API probe plugin and synthetic forms;
it does not load the production plugin, task database or excluded integration.
`ITACAN_TEST_ELECTRON` and `ITACAN_TEST_REMOTE` can select existing test tools.

`color-native-baseline.json` records values measured in actual Obsidian.
`color-default-baseline.json` contains the deterministic native-styles gallery
states. Review host-version changes rather than automatically replacing goldens.
`color-ownership.json` inventories production entry points; the source test rejects
unowned native popup constructors and color literals outside the contract or
explicit compatibility fallbacks. Keep layouts, alpha values, mixing spaces,
selected-row overrides and legacy fallback behavior unchanged when migrating roles.

Build Athena from TypeScript when its integration options change, then use the
existing Hub build with `--output-dir`. Never hand-edit generated runtime bundles.

The delivery was checked with the existing window-title, wizard/report style,
progress, settings-navigation, roadmap and heatmap raster runners, and Athena's
TypeScript checks and 22 tests. Dark and Light gallery reference PNGs matched
byte-for-byte. These deterministic galleries and native API probes do not replace
a full manual tour of every production screen. Several older browser fixtures
reference retired task APIs; they are not claimed as passing color goldens.

## Stage 1 semantic responsibilities

The native bridge now includes the six demonstrated inherited dependencies:
`--dropdown-background` / `--dropdown-background-hover` use the native-control
button surfaces; `--input-date-separator` uses owned muted text; the blockquote
border uses the base accent; horizontal rules and code borders use the shared
border. All six are also restored at Settings' host island. The dark dropdown
icon background is already literal transparent in the pinned host; blockquote
text/background are inherit/transparent. They add no derived-color dependency.
Editor-only code-bracket and table-editing aliases are outside this UI migration.

Genuine task/music/folder validation errors use `--hub-color-error` with their
exact legacy `--color-red` fallback. Athena/native error text uses `--text-error`,
which bridges to the same owned error role in Dark mode. Existing warning text
uses `--text-warning`; warning section borders use `--hub-color-warning` with
their exact legacy orange fallback. Recorded completion icons/report checks use `--hub-color-success`,
as does native `--text-success`; the completion series retains its independent
series alias. Creation/deletion activity are categorical history events, and
retain their green/red primitives. Overdue dates and importance remain separate
from errors. Interactive checkbox fill and step-progress controls remain accent
states; momentum green remains an independent visualization.

Edited-history indicators use `--hub-color-activity-edited`. The step-completion
series derives directly from status blue, with its own series override. Accent
text now derives independently from the same Default HSL inputs as hover fill;
changing one semantic role no longer changes the other. These derivations retain
exactly the existing Default results and do not establish a new contrast policy.

`--hub-color-checkbox-marker` defaults to the page surface, preserving the native
marker while allowing an independent foreground. `--hub-color-destructive`
defaults to status red and controls destructive actions without coupling their
fill to error feedback. The native warning-button error-fill aliases are rebound
locally on that button. `--hub-color-text-on-destructive` defaults independently
to fixed white, so changing ordinary on-accent text cannot recolor danger labels.
All new role defaults and native mappings are Dark-only. Light uses exact legacy
native/primitive fallbacks, including when a host uses different semantic colors.

| Existing role | Responsibility / status |
| --- | --- |
| `--hub-color-surface-button` | Native neutral-control surface, including selects. Component-specific flat/page-colored buttons deliberately retain their existing mappings. |
| `--hub-color-surface-floating` | Reserved, currently unconsumed. Menus and task popovers intentionally use different surfaces. |
| `--hub-color-text-disabled` | Reserved, currently unconsumed. Existing components retain foreground/opacity combinations; it is not a universal disabled-color API. |
| `--hub-color-window-title` | Specialized graphic/optional-date color. Heading text follows its inherited heading/text color. Name retained for compatibility. |
| `--hub-color-fallback-attention-base` | Unconsumed compatibility declaration; the JavaScript fallback remains the exact legacy literal. Retained rather than silently removing a compatibility name. |

Roadmap's `--hub-roadmap-phase-end` remains directly overridable. Its Default
nested Oklab formula intentionally references phase start, status blue and primary
text; a coordinated palette can supply an explicit endpoint. No interpolation,
geometry, or phase-order behavior changed.

## Stage 1 verification

Run `node lib/tests/run-color-system.cjs color-consistency` in addition to the
existing commands above. `color-consistency-baseline.json` freezes additional
pre-Stage-1 Dark/Light normal, hover and focus styles. It supplements the original
4,752-value golden, which is unchanged. The fixture checks semantic independence,
native dropdown hover, actual date-punctuation pixels, unowned host controls and
the host island. Its shared checks also run in the real native Obsidian probe.
`--capture` only records candidate evidence in the temporary browser output; it
never writes or replaces a golden. Review baseline changes explicitly.

Stage 1 deferred primary-action hover consistency, contrast, History metadata,
faint text and focus refinements; Stage 2 below records their resolution. Palette selection,
application transactions, preferences, Light contracts and dock synchronization
remain future work. Appearance is still an inactive preview.

Stage 1 delivery validation: 11,594 added pre-change style/geometry comparisons,
196 semantic/isolation assertions in both the browser and native probe, six
native alias equivalence checks, and the original 4,752/44 checks pass. Existing
title, wizard/report, task date/location/routing, History status, Settings,
roadmap, progress and heatmap raster checks also pass. History tests use an
explicit throwing stub for the excluded integration import; that integration
never executes. `unified-progress.test.js` fails at line 71's missing
`hub-progress-changed` listener in both frozen baseline and changed source;
this unrelated existing failure is not reported as passing or repaired here.
Athena source/runtime and dock assets were unchanged and were not rebuilt.

## Stage 2: restrained visual corrections

Default Dark ordinary primary actions now use an independent fill/foreground
contract. `--hub-color-primary-action-background` keeps the accent hue/saturation
and subtracts four percentage points from Default's 66% HSL lightness (62%).
`--hub-color-primary-action-background-hover` subtracts two points (64%).
`--hub-color-primary-action-text` stays fixed white in both states. Rendered
normal/hover colors are rgb(124,73,243) / rgb(131,82,244), with 5.12:1 / 4.69:1
white-text contrast, compared with 4.26:1 / 2.75:1 previously. The trade-off is a
slightly darker normal fill and a much gentler brightening on hover. Hue and
saturation remain purple; no foreground swap, glow or geometry change is used.

The scoped ordinary `.mod-cta` treatment covers Quick Add, Add/Edit Task,
task-location confirmation, Inbox, Daily Brief, Music editing, planning,
presets and recovery actions. It retains existing borders and elevation,
using the existing 120ms Hub transition. Oath actions, destructive actions,
filled selections, pressed-option controls and host islands are excluded.
Native, ARIA-disabled and mod-disabled actions do not receive the hover fill.
Inbox's submit arrow inherits the actual button foreground in owned Dark UI.

`--interactive-accent`, ordinary accent text, on-accent selection foregrounds,
Oath roles, importance, status, categorical charts and momentum colors remain
unchanged. The three new primary-action roles are separate from them. Future
palettes must supply validated primary pairs rather than assume the Default HSL
lightness offsets work for every accent. No palette application or preference
was added. Native Light primary controls retain existing host appearance.

### Faint information review

| Consumer | Classification | Stage 2 treatment |
| --- | --- | --- |
| Completed-task Home project name | Readable metadata, equivalent to workspace History | Secondary text, matching Project/Resource; typography and layout unchanged. |
| Home calendar week range | Readable low-priority date/navigation context | Secondary text. |
| Appearance preview explanation | Readable explanatory information, rather than a disabled control | Secondary text. |
| Clocks, breadcrumb separators, disclosure chevrons | Deliberately faint/decorative hierarchy | Unchanged. |
| Disabled controls and unavailable date indicators | Disabled/unavailable | Unchanged foreground/opacity conventions. |
| Out-of-month dates and unassigned chart tracks | Deliberately subordinate context | Unchanged. |
| Empty-state labels, placeholders, activity breadcrumb parts and legacy upcoming-date styles | Low-priority or context-dependent; no high-confidence universal correction | Deferred. Current explorer timestamps and ordinary task dates already use secondary text. |

No neutral ramp, global faint role, font, spacing or History behavior changed.
The metadata/week-range/preview-note corrections use the existing secondary role
in both modes, preserving native Light inheritance.

### Keyboard focus

`--hub-color-focus-ring` uses existing neutral-60 (#999999) in owned Dark UI.
It has 5.98:1 against the page, 5.17:1 against panels, and 4.77:1 against fields.
Previously weak neutral focus outlines now use this role with exact legacy Light
fallbacks. Targeted footer secondary buttons, Home/Work navigation and keyboard
preset rows also gain an explicit neutral keyboard ring. Athena checkboxes retain
the native 2px shadow-ring geometry with the stronger color.

Text fields retain the existing `hub-keyboard-focus` navigation tracker; pointer
focus and modal autofocus do not acquire a strong ring. Wrapped selects use one
outer indicator with the child's outline suppressed in owned Dark UI. Existing
strong primary-action, Settings, Statistics and specialized Oath focus treatments
remain intact. Decorative borders, input focus borders, typography and sizes are
unchanged. Native menu selection and other ambiguous state-only highlights were
reviewed but left unchanged rather than redesigning their interaction behavior.

### Verification and baseline discipline

Run `node lib/tests/run-color-system.cjs color-stage-two` alongside the existing
color runners. It checks nine action contexts, icon/text contrast, lighter hover,
disabled states, 120ms transitions, Tab versus pointer focus, single wrapped-select
rings, metadata, unowned controls and host islands. Existing semantic override
checks now distinguish primary-action text from on-accent selected-state text.

The three prior golden files remain byte-for-byte unchanged. The additional
pre-Stage-2 gallery is frozen in `color-stage2-baseline.json`.
`color-stage2-expectations.json` records explicit before/after fields and hashes;
the test helper and source guard reject paths outside the approved primary fill,
metadata and keyboard-focus corrections. This is an additive review record, not
an indiscriminate replacement of captured baselines. The native probe also opens
real Task, task-location, Quick Add, Inbox and Daily Brief windows with synthetic
services and hover-only actions; no saves or navigation are performed. Hidden
native paint transitions are finished explicitly in the test after genuine hover;
the browser checks the ordinary animation timing separately.

Production changes are source-loaded CSS only. No Hub, Athena, dock or excluded
runtime artifacts need rebuilding. Stage 3 palette selection, persistence, mode
contracts and application transactions remain future work. Contrast for selected
filled options and independently styled semantic controls is not generalized from
the new primary-action contract.

Stage 2 delivery checks: 26,888 dedicated style/geometry comparisons plus the
4,752 and 11,594 existing comparisons pass with explicit reviewed deltas only.
All 212 semantic/isolation assertions, 44 native comparisons and six native-alias
checks pass. Actual Task, task-location, Quick Add, Inbox and Daily Brief primary
actions were genuinely hovered in the native host and produced the same pair,
with unchanged button dimensions. Before/after screenshot differences were
confined to approved action/text rectangles: zero pixels changed elsewhere in
both the Dark and Light reference galleries. Focus behavior was also tested with
real Tab and pointer input. Existing title, wizard/report, task/date/location,
History status, Settings, roadmap and heatmap checks pass. The independently
established `unified-progress.test.js:71` failure remains reproducible before and
after Stage 2 and is reported separately. No production JavaScript changed.
