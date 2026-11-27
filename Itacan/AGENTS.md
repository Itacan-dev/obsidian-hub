# Developing Itacan

Itacan is a private, offline desktop application for everyday personal work. Use Obsidian Hub as the functional and visual reference when refining a workflow. Keep the standalone implementation, assets and runtime dependencies inside `Itacan/`.

- Preserve Hub’s user-facing composition, placement, contextual controls and workflow outcomes. Apply simplification to the implementation and identify intentional product differences explicitly.
- Preserve Hub’s spatial proportions, relative panel sizes, responsive layout rules and distribution of working space. Let shared components provide consistent behavior while each feature determines its dimensions. Identify and justify intentional departures.
- Prefer simple, conventional code. Keep features easy to find by name and give each module a clear responsibility. Read the implementation for the workflow you are changing.
- Let each feature own its composition and content. Use shared CSS variables, classes and components for common appearance, controls and interactions. Reuse document, task and filing operations across entry points.
- Keep startup, navigation, editing and dialogs responsive. Measure a real interaction before adding optimization machinery. Introduce abstractions for demonstrated needs.
- Keep meaningful user data in one user-selected, portable library. Prefer ordinary folders, Markdown and readable JSON. Assume a single active writer and leave synchronization to the user's chosen tools.
- Preserve reliable saves, file integrity and Electron's main/renderer boundary. Test ordinary workflows and specific regressions. Keep robustness and test infrastructure proportionate to the application.
- Keep navigation, global controls and neighboring panels spatially predictable. Give changing content and empty states an established region with appropriate internal scrolling. Preserve relevant focus, scroll positions and user-set sizes during ordinary updates. Let window resizing, mode changes and deliberate layout actions determine when the arrangement changes. Reuse the shared layout conventions and keep each feature’s composition in its own module.
