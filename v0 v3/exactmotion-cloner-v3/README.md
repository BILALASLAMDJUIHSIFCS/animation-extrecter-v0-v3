# ExactMotion Cloner v3.0 — Multi-Section Choreography, Core Function Decompiler & Shader Extractor

Production-grade Manifest V3 Chrome Extension engineered to clone **complex multi-section linked animations**, **decompiled core JS/React/GSAP logic**, **WebGL GLSL shaders**, and **non-monotonic 60fps physics** into deterministic 1:1 LLM specifications (`Standalone HTML + GSAP` or `React / Next.js + Motion`).

## What's New in v3.0 (vs v2.0)

1. **Main-World Core JS Function & Hook Decompiler (`pageBridge.js` @ `document_start`)**:
   - Intercepts `addEventListener`, `IntersectionObserver`, `ResizeObserver`, and `requestAnimationFrame` loops before page scripts execute, preserving exact JS function logic (`fn.toString()`).
   - Walks **React 18 & React 19 Compiler Fibers** (`memoizedState` hook linked-list + `updateQueue.memoCache` slots + `useRef<Callback>`) to extract actual `useLenis`, `useScroll`, `useTransform`, and custom math closures (`clamp`, `mapRange`, `lerp`, trigonometric orbits).
   - Recursively decompiles **GSAP 3 + `ScrollTrigger`** nested timelines (`getChildren`), pin controllers, `containerAnimation` horizontal tracks, `onUpdate`/`onEnter` callbacks, `morphSVG` paths, and private bundled `element._gsap` caches.
   - Captures live **WebGL / WebGL2 GLSL Vertex & Fragment Shaders**, active uniform values, and **React Three Fiber (`__r3f`)** scene graphs while guaranteeing `preserveDrawingBuffer: true`.

2. **Multi-Section Linked Choreography & Portal Graph (`crossSectionGraph.js`)**:
   - **Shift+Click** multiple sections in Selection Mode or click **+ Link Next Section** live during recording.
   - Automatically discovers and links external **`position: fixed` background WebGL canvases, persistent floating stages, chapter progress indicators, GSAP `.pin-spacer` wrappers, negative-margin curtain overlaps, and `html`/`body` global theme transitions**.

3. **Non-Monotonic Piecewise Scroll `R²` Solver & Expanded Channels (`motionRecorder.js`)**:
   - Replaces v2.0's linear Pearson correlation (which failed with `r ≈ 0` on bell-curves and pinned hold plateaus) with **Binned Variance-Explained `R²` + Automatic Phase Segmentation** (`ramp-up` -> `hold-plateau` -> `ramp-down`) across **13 high-resolution scroll stops**.
   - Tracks **SVG `<path d>` morphing**, **HTML5 `<video currentTime>` scrubbing**, **live `--css-custom-properties`**, and **layout width/height/border-radius morphing**.
   - Deduplicates **SplitText / SplitType** character wrappers so 250+ glyph spans never starve the 240-element 60fps tracker or bloat the LLM context window.

## Installation (Chrome / Brave / Edge / Arc)

1. Unzip `carban-created-extension-v3.zip` (or use the `extension/carban3` folder).
2. Navigate to `chrome://extensions` and enable **Developer mode**.
3. Click **Load unpacked** and select the `carban3` folder (containing `manifest.json`).

## Workflow

1. Press `Alt+Shift+E` (or click the extension icon -> **Select Section(s) & Decompile Logic**).
2. **Click** a section to start immediately, OR **Shift+Click** multiple consecutive sections to chain them into a **Multi-Section Master Timeline**.
3. Click **⚡ Auto-Choreography** (or press `Alt+Shift+A`) to sweep all linked sections, probe interactive hovers, and decompile core JS functions, OR scroll/hover manually.
4. Choose **Standalone HTML + GSAP** or **React / Next.js + Motion**, then click **✓ Finish & Copy v3.0 Prompt** (`Alt+Shift+S`).
