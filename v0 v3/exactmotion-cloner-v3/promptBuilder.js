// ExactMotion Cloner v3.0 — Core Logic, Multi-Section Choreography & Shader Prompt Compiler

(function () {
  var NS = (globalThis.__ExactMotion = globalThis.__ExactMotion || {});
  if (NS.PromptBuilder && NS.PromptBuilder.version === "3.0.0") return;

  function formatJsonBlock(obj) {
    return "```json\n" + JSON.stringify(obj, null, 2) + "\n```";
  }

  function compactCssBlock(rules, maxChars, separator) {
    if (!rules || !rules.length) return "";
    var sep = separator || "\n";
    var out = [];
    var used = 0;
    for (var i = 0; i < rules.length; i++) {
      var r = String(rules[i]).replace(/url\((['"]?)data:[^)]{180,}\1\)/g, "url(/* data-uri-omitted */)");
      if (r.length > 1800) r = r.slice(0, 1800) + " /* ...rule truncated... */ }";
      if (used + r.length > maxChars) break;
      out.push(r);
      used += r.length + sep.length;
    }
    return out.join(sep);
  }

  function countDecompiledFunctions(bridgeData) {
    if (!bridgeData || !bridgeData.ok) return 0;
    var count = 0;
    if (bridgeData.reactAndMotion && bridgeData.reactAndMotion.decompiledHookAndHandlerFunctions) {
      count += bridgeData.reactAndMotion.decompiledHookAndHandlerFunctions.length;
    }
    if (bridgeData.gsap && bridgeData.gsap.scrollTriggers) {
      bridgeData.gsap.scrollTriggers.forEach(function (st) {
        if (st.callbacks) count += Object.keys(st.callbacks).length;
        if (st.timelineChildren) count += st.timelineChildren.length;
      });
    }
    if (bridgeData.listenersAndScripts) {
      count += (bridgeData.listenersAndScripts.elementEventListeners || []).length;
      count += (bridgeData.listenersAndScripts.globalScrollAndPointerListeners || []).length;
      count += (bridgeData.listenersAndScripts.rafLoopCallbacks || []).length;
      count += (bridgeData.listenersAndScripts.intersectionObservers || []).length;
    }
    if (bridgeData.webglAndShaders) {
      bridgeData.webglAndShaders.forEach(function (c) {
        count += (c.capturedShaders || []).length;
      });
    }
    return count;
  }

  function buildPrompt(extraction, motion, bridgeData, options) {
    options = options || {};
    var targetFramework = options.targetFramework || "html-gsap"; // "html-gsap" | "react-nextjs"
    var lines = [];
    var env = extraction.dom.pageEnvironment;
    var bbox = extraction.dom.boundingBox;
    var summary = motion.recordingSummary;
    var graph = motion.crossSectionGraph;

    var isMulti = extraction.sectionCount > 1 || extraction.portalCount > 0;

    lines.push(
      isMulti
        ? "# ExactMotion v3.0 — Multi-Section Linked Choreography & Core Logic Specification"
        : "# ExactMotion v3.0 — 1:1 Section, Core Logic & Motion Physics Specification"
    );
    lines.push("");

    if (targetFramework === "react-nextjs") {
      lines.push(
        "You are a Principal Creative Technologist and Motion Systems Architect. Reconstruct an **exact, pixel-accurate, logic-accurate 1:1 replica** of the captured website experience below using **React / Next.js (App Router) + Tailwind CSS + GSAP (`ScrollTrigger`) / Motion (`framer-motion`)**, implementing the exact decompiled core functions, cross-section state handoffs, shaders, and 60fps physics curves."
      );
    } else {
      lines.push(
        "You are a Principal Creative Technologist and Motion Systems Architect. Reconstruct an **exact, pixel-accurate, logic-accurate 1:1 replica** of the captured website experience below as a **single self-contained, production-grade `index.html` file** (zero build step; you may load GSAP 3 + ScrollTrigger + Lenis via jsDelivr CDN when beneficial), implementing the exact decompiled core functions, cross-section state handoffs, shaders, and 60fps physics curves."
      );
    }
    lines.push("");

    // =========================================================================
    // SECTION 1: MASTER SCENE & MULTI-SECTION TOPOLOGY
    // =========================================================================
    lines.push("## 1. Master Scene, Viewport & Multi-Section Architecture");
    lines.push("- **Source URL:** `" + env.url + "`");
    lines.push("- **Page Title:** " + (env.title || "Untitled"));
    lines.push("- **Captured Sections (`" + extraction.sectionCount + "`):** `" + extraction.targetDescriptor + "`");
    if (extraction.portalCount > 0) {
      lines.push(
        "- **Auto-Linked Shared Fixed/Portal Stage Layers (`" +
          extraction.portalCount +
          "`):** Captured alongside the sections because they co-animate across scroll boundaries (e.g., persistent WebGL canvas, floating stage, or chapter nav)."
      );
    }
    lines.push(
      "- **Combined Bounding Box:** `" +
        bbox.width +
        "px × " +
        bbox.height +
        "px` (captured at viewport `" +
        bbox.viewportWidth +
        "px × " +
        bbox.viewportHeight +
        "px`)"
    );
    lines.push(
      "- **Initial Global Theme:** `background: " +
        env.bodyBackground +
        "`, `color: " +
        env.bodyColor +
        "`, `font-family: " +
        env.bodyFontFamily +
        "`" +
        (env.dataTheme ? ", `data-theme: " + env.dataTheme + "`" : "")
    );

    var badges = (extraction.fingerprint && extraction.fingerprint.badges) || [];
    if (bridgeData && bridgeData.runtime && bridgeData.runtime.detectedLibraries) {
      badges = badges.concat(bridgeData.runtime.detectedLibraries);
    }
    var uniqueBadges = Array.from(new Set(badges));
    lines.push(
      "- **Detected Runtime & Motion Stack:** " +
        (uniqueBadges.length > 0
          ? uniqueBadges.map(function (b) { return "`" + b + "`"; }).join(", ")
          : "`Vanilla JS / CSS`")
    );
    lines.push(
      "- **60fps Telemetry Summary:** `" +
        summary.durationSec +
        "s` at `~" +
        summary.averageFps +
        "fps` (`" +
        summary.totalFramesSampled +
        "` frames, master scroll coverage `" +
        Math.round(summary.scrollCoverageMin * 100) +
        "% → " +
        Math.round(summary.scrollCoverageMax * 100) +
        "%`, `" +
        motion.scrollScrubAnimations.length +
        "` scrubbed trajectories, `" +
        summary.hoverInteractionsRecorded +
        "` hover cascades, `" +
        countDecompiledFunctions(bridgeData) +
        "` decompiled JS functions/timelines/shaders)."
    );

    // =========================================================================
    // SECTION 2: DECOMPILED CORE JS LOGIC, HOOKS, TIMELINES & SHADERS (NEW IN V3!)
    // =========================================================================
    lines.push("");
    lines.push("## 2. Decompiled Core JS Logic, Mathematical Transfer Functions & Shaders");
    lines.push(
      "CRITICAL: Do NOT guess generic animations. Below is the **actual decompiled runtime logic** (scroll math closures, React 18/19 Compiler hooks, GSAP nested timelines & callbacks, event listeners, observers, and GLSL shaders) extracted directly from the live page's MAIN execution world. Clone the **core algorithmic logic** behind these functions:"
    );

    var wroteAnyLogic = false;

    if (bridgeData && bridgeData.ok) {
      if (bridgeData.algorithmicPatterns && bridgeData.algorithmicPatterns.length > 0) {
        wroteAnyLogic = true;
        lines.push("");
        lines.push("### 2.1 High-Level Algorithmic Architecture Detected");
        lines.push(formatJsonBlock(bridgeData.algorithmicPatterns));
      }

      if (bridgeData.gsap && bridgeData.gsap.detected) {
        wroteAnyLogic = true;
        lines.push("");
        lines.push("### 2.2 GSAP / ScrollTrigger Timelines, Pin Controllers, Callbacks & `_gsap` States");
        lines.push(formatJsonBlock(bridgeData.gsap));
      }

      if (
        bridgeData.reactAndMotion &&
        (bridgeData.reactAndMotion.decompiledHookAndHandlerFunctions.length > 0 ||
          bridgeData.reactAndMotion.framerMotionNodes.length > 0 ||
          bridgeData.reactAndMotion.components.length > 0)
      ) {
        wroteAnyLogic = true;
        lines.push("");
        lines.push("### 2.3 Decompiled React Fiber Hooks (`useEffect`, `useRef<Callback>`, React 19 `memoCache`) & Framer Motion");
        lines.push(formatJsonBlock(bridgeData.reactAndMotion));
      }

      if (bridgeData.listenersAndScripts) {
        var ls = bridgeData.listenersAndScripts;
        var hasLs =
          (ls.elementEventListeners && ls.elementEventListeners.length > 0) ||
          (ls.globalScrollAndPointerListeners && ls.globalScrollAndPointerListeners.length > 0) ||
          (ls.intersectionObservers && ls.intersectionObservers.length > 0) ||
          (ls.rafLoopCallbacks && ls.rafLoopCallbacks.length > 0) ||
          (ls.inlineAnimationScripts && ls.inlineAnimationScripts.length > 0) ||
          Boolean(ls.webflowIx2);
        if (hasLs) {
          wroteAnyLogic = true;
          lines.push("");
          lines.push("### 2.4 Intercepted Event Listeners, RAF Tickers, Observers & Inline Controllers");
          lines.push(formatJsonBlock(ls));
        }
      }

      if (bridgeData.webglAndShaders && bridgeData.webglAndShaders.length > 0) {
        wroteAnyLogic = true;
        lines.push("");
        lines.push("### 2.5 WebGL / Three.js / R3F Scene & Captured GLSL Shaders + Uniforms");
        lines.push(formatJsonBlock(bridgeData.webglAndShaders));
      }

      if (
        bridgeData.runtime &&
        (bridgeData.runtime.smoothScroll.type !== "native" || bridgeData.runtime.swiperConfigs.length > 0)
      ) {
        wroteAnyLogic = true;
        lines.push("");
        lines.push("### 2.6 Smooth Scroll & Carousel Engine Parameters");
        lines.push(
          formatJsonBlock({
            smoothScroll: bridgeData.runtime.smoothScroll,
            swiperConfigs: bridgeData.runtime.swiperConfigs
          })
        );
      }
    }

    if (!wroteAnyLogic) {
      lines.push("");
      lines.push(
        "No external JS framework closures were exposed on the selected nodes; animations are driven by native CSS rules/timelines or pure scroll/pointer state machines captured in Sections 3–5 below."
      );
    }

    // =========================================================================
    // SECTION 3: CROSS-SECTION CHOREOGRAPHY & SHARED LAYER HANDOFF GRAPH (NEW IN V3!)
    // =========================================================================
    lines.push("");
    lines.push("## 3. Cross-Section Choreography, Pin Handoffs & Global Theme Bridges");
    if (graph) {
      lines.push(
        "Preserve the exact spatial heights (`viewportMultiple`), sticky/pin-spacer locks, negative-margin curtain overlaps, shared fixed/portal layers, and `html`/`body` theme flips across the master scroll timeline:"
      );
      lines.push(formatJsonBlock(graph));
    }

    // =========================================================================
    // SECTION 4: PIECEWISE SCROLL-SCRUB PHYSICS, SVG MORPHS & VIDEO SCRUBS
    // =========================================================================
    lines.push("");
    lines.push("## 4. Multi-Phase Scroll-Scrub Physics, Non-Monotonic Curves, SVG Morphs & Reveals");
    if (
      motion.scrollScrubAnimations.length === 0 &&
      motion.scrollRevealAnimations.length === 0 &&
      motion.svgMorphAndDrawAnimations.length === 0 &&
      motion.videoScrubAnimations.length === 0 &&
      !motion.arcMechanics
    ) {
      lines.push(
        "No scroll-driven style deltas were observed during the recording window. Rely on the decompiled ScrollTrigger / hook functions in Section 2 if scroll bindings exist."
      );
    } else {
      if (motion.arcMechanics) {
        lines.push("### 4.1 Circular / Curved Arc-List Mechanics");
        lines.push(formatJsonBlock(motion.arcMechanics));
      }

      if (motion.scrollScrubAnimations.length > 0) {
        lines.push("");
        lines.push("### 4.2 Piecewise Scroll-Scrubbed Trajectories (13-Stop Tables + Phase Segmentation)");
        lines.push(
          "NOTE: Entries marked `curveTopology: 'multi-phase-non-monotonic'` enter, hold on a pinned plateau, and exit (bell-curve or multi-stage choreography). Implement every phase in `phases` and interpolate smoothly across all 13 keyframe stops:"
        );
        lines.push(formatJsonBlock(motion.scrollScrubAnimations.slice(0, 40)));
      }

      if (motion.svgMorphAndDrawAnimations && motion.svgMorphAndDrawAnimations.length > 0) {
        lines.push("");
        lines.push("### 4.3 SVG `<path d>` Morphing & Stroke-Dash Vector Animations");
        lines.push(formatJsonBlock(motion.svgMorphAndDrawAnimations));
      }

      if (motion.videoScrubAnimations && motion.videoScrubAnimations.length > 0) {
        lines.push("");
        lines.push("### 4.4 Scroll-Scrubbed `<video currentTime>` Playback");
        lines.push(formatJsonBlock(motion.videoScrubAnimations));
      }

      if (motion.scrollRevealAnimations.length > 0 || (extraction.splitTextGroups && extraction.splitTextGroups.length > 0)) {
        lines.push("");
        lines.push("### 4.5 Threshold Scroll Reveals, Sibling Staggers & SplitText Typography Specs");
        lines.push(
          formatJsonBlock({
            reveals: motion.scrollRevealAnimations,
            siblingStaggerGroups: motion.staggerGroups,
            splitTextTypographyGroups: extraction.splitTextGroups
          })
        );
      }
    }

    // =========================================================================
    // SECTION 5: HOVER CASCADES, 3D TILT, MAGNETIC PULL & STATE MACHINE
    // =========================================================================
    lines.push("");
    lines.push("## 5. Hover Cascades, Pointer Physics & Interactive Click/DOM State Machine");
    var hasHoverRules = extraction.stylesheets.hoverAndStateRules.length > 0;

    if (motion.hoverInteractions.length > 0) {
      lines.push("### 5.1 Recorded Hover Enter/Exit Deltas & Descendant Cascades");
      lines.push(formatJsonBlock(motion.hoverInteractions));
    }
    if (motion.pointerReactiveEffects.length > 0) {
      lines.push("");
      lines.push("### 5.2 Continuous Pointer-Move Equations (3D Perspective Tilt / Magnetic Pull / Spotlight `--vars`)");
      lines.push(formatJsonBlock(motion.pointerReactiveEffects));
    }
    if (
      motion.interactiveStateMachine.clicks.length > 0 ||
      motion.interactiveStateMachine.mutations.length > 0
    ) {
      lines.push("");
      lines.push("### 5.3 Interactive Click Triggers & Live DOM Attribute/Class State Machine");
      lines.push(formatJsonBlock(motion.interactiveStateMachine));
    }
    if (motion.waapiAnimations.length > 0 || motion.timeDrivenAnimations.length > 0) {
      lines.push("");
      lines.push("### 5.4 Web Animations API (`getAnimations`) & Autonomous Curves");
      lines.push(
        formatJsonBlock({
          waapi: motion.waapiAnimations,
          timeDriven: motion.timeDrivenAnimations.slice(0, 30)
        })
      );
    }
    if (hasHoverRules) {
      lines.push("");
      lines.push("### 5.5 Native CSS `:hover`, `:focus-visible`, `[data-state]` & Theme Rules");
      lines.push("```css\n" + compactCssBlock(extraction.stylesheets.hoverAndStateRules.slice(0, 90), 14000, "\n\n") + "\n```");
    }

    // =========================================================================
    // SECTION 6: COMPLETE DESIGN TOKENS, HOUDINI @property, @keyframes & STYLES
    // =========================================================================
    lines.push("");
    lines.push("## 6. Design Tokens, `@property` Houdini, `@keyframes` & Deduplicated Computed Styles");

    if (extraction.stylesheets.externalFontLinks.length > 0) {
      lines.push("### External Font Stylesheets");
      extraction.stylesheets.externalFontLinks.forEach(function (href) {
        lines.push('- `<link rel="stylesheet" href="' + href + '">`');
      });
      lines.push("");
    }

    var varKeys = Object.keys(extraction.cssVariables);
    if (varKeys.length > 0) {
      lines.push("### CSS Custom Properties (`:root`)");
      var varLines = [":root {"];
      for (var v = 0; v < Math.min(varKeys.length, 140); v++) {
        var k = varKeys[v];
        varLines.push("  " + k + ": " + extraction.cssVariables[k] + ";");
      }
      varLines.push("}");
      lines.push("```css\n" + varLines.join("\n") + "\n```");
    }

    var extraAtRules = []
      .concat(extraction.stylesheets.houdiniProperties || [])
      .concat(extraction.stylesheets.fontFaces || [])
      .concat(extraction.stylesheets.keyframes || []);
    if (extraAtRules.length > 0) {
      lines.push("");
      lines.push("### `@property`, `@font-face` & `@keyframes` Definitions");
      lines.push("```css\n" + compactCssBlock(extraAtRules, 16000, "\n\n") + "\n```");
    }

    if (extraction.stylesheets.matchedRules.length > 0) {
      lines.push("");
      lines.push("### Matched Author Stylesheet Rules (Media / Container / Layer Preserved)");
      lines.push("```css\n" + compactCssBlock(extraction.stylesheets.matchedRules.slice(0, 140), 22000, "\n") + "\n```");
    }

    lines.push("");
    lines.push("### Deduplicated Computed Layout & Pseudo-Element Baseline (`[data-em-id]`)");
    lines.push(
      "```css\n" +
        compactCssBlock(
          extraction.computedBaseline.elementStyles
            .slice(0, 130)
            .concat(extraction.computedBaseline.pseudoStyles.slice(0, 45)),
          24000,
          "\n\n"
        ) +
        "\n```"
    );

    // =========================================================================
    // SECTION 7: CLEAN MULTI-SECTION & PORTAL DOM
    // =========================================================================
    lines.push("");
    lines.push("## 7. Clean Cloned Multi-Section + Linked Portal DOM & Media Assets");
    if (extraction.dom.canvasSnapshots.length > 0 || (extraction.dom.videoElements && extraction.dom.videoElements.length > 0)) {
      lines.push("### Live `<canvas>` & `<video>` Stage Inventory");
      lines.push(
        formatJsonBlock({
          canvases: extraction.dom.canvasSnapshots.map(function (c) {
            return {
              emId: c.emId,
              selector: c.selector,
              isPortalLayer: c.isPortalLayer,
              width: c.width,
              height: c.height,
              cssWidth: c.cssWidth,
              cssHeight: c.cssHeight
            };
          }),
          videos: extraction.dom.videoElements || []
        })
      );
    }

    if (extraction.splitTextGroups && extraction.splitTextGroups.length > 0) {
      lines.push(
        "> **Note on `[data-em-split-chars=\"true\"]` elements:** Large SplitText headlines were compacted to clean readable text in the HTML below to preserve token budget. Use a small JS `splitTextIntoSpans()` helper on mount to wrap characters/words with `data-em-char-class` and apply the exact stagger formula from Section 4.5."
      );
      lines.push("");
    }

    var htmlStr = extraction.dom.html;
    if (htmlStr.length > 55000) {
      htmlStr = htmlStr.slice(0, 55000) + "\n<!-- [DOM truncated at 55KB for LLM context window] -->";
    }
    lines.push("```html\n" + htmlStr + "\n```");

    // =========================================================================
    // SECTION 8: STRICT COPY-TO-COPY + CORE LOGIC CONTRACT
    // =========================================================================
    lines.push("");
    lines.push("## 8. Strict Copy-to-Copy & Core Logic Implementation Contract");
    lines.push(
      "1. **Reconstruct the Core Function Logic (Not Superficial Fades):** Implement the exact mathematical transfer functions (`clamp`, `mapRange`, `lerp`, trigonometric arc/orbit equations, ScrollTrigger pin timelines, `onUpdate` callbacks, state/theme reducers, and GLSL shaders) extracted in **Section 2**."
    );
    lines.push(
      "2. **Preserve Multi-Section Linked Choreography & Handoffs:** Maintain the exact scroll-track heights (`vh` multiples), sticky viewport locks, negative-margin curtain overlaps, shared `position: fixed` stage layers/canvases, and `html`/`body` theme flips in **Section 3**."
    );
    lines.push(
      "3. **Multi-Phase & Non-Monotonic Scroll Fidelity:** Every element in **Section 4** must scrub smoothly and reversibly across all 13 stops (including hold plateaus and bell-curve enter→hold→exit trajectories), SVG `<path d>` morphs, and `<video>` time scrubs."
    );
    lines.push(
      "4. **Complete Interactive State Machine & Zero Omissions:** Wire all hover child cascades, 3D tilt/magnetic equations, tabs/accordions/carousels (**Section 5**), fonts, custom properties, and resolved assets with zero `// TODO` placeholders."
    );

    return lines.join("\n");
  }

  function buildStandaloneHtml(extraction, motion) {
    var env = extraction.dom.pageEnvironment;
    var fontLinksHtml = extraction.stylesheets.externalFontLinks
      .map(function (href) {
        return '  <link rel="stylesheet" href="' + href + '">';
      })
      .join("\n");

    var varKeys = Object.keys(extraction.cssVariables);
    var rootVarsCss =
      ":root {\n" +
      varKeys
        .map(function (k) {
          return "  " + k + ": " + extraction.cssVariables[k] + ";";
        })
        .join("\n") +
      "\n}";

    var cssParts = [
      "*, *::before, *::after { box-sizing: border-box; }",
      "html, body { margin: 0; padding: 0; background: " +
        (env.bodyBackground || "#0a0a0c") +
        "; color: " +
        (env.bodyColor || "#ffffff") +
        "; font-family: " +
        (env.bodyFontFamily || "system-ui, sans-serif") +
        "; overflow-x: hidden; transition: background-color 0.35s ease, color 0.35s ease; }",
      rootVarsCss,
      (extraction.stylesheets.houdiniProperties || []).join("\n"),
      extraction.stylesheets.fontFaces.join("\n"),
      extraction.stylesheets.keyframes.join("\n"),
      extraction.computedBaseline.elementStyles.join("\n"),
      extraction.computedBaseline.pseudoStyles.join("\n"),
      extraction.stylesheets.matchedRules.join("\n"),
      extraction.stylesheets.hoverAndStateRules.join("\n")
    ].join("\n\n");

    var scrubDataJson = JSON.stringify(motion.scrollScrubAnimations || []);
    var svgMorphJson = JSON.stringify(motion.svgMorphAndDrawAnimations || []);
    var themeFlipsJson = JSON.stringify(
      (motion.crossSectionGraph && motion.crossSectionGraph.globalThemeAndBodyTransitions) || []
    );
    var tiltDataJson = JSON.stringify(motion.pointerReactiveEffects || []);
    var canvasDataJson = JSON.stringify(
      (extraction.dom.canvasSnapshots || []).filter(function (c) {
        return c.dataUrlPreview;
      })
    );

    var bodyHtml = extraction.dom.standaloneHtmlFragment || extraction.dom.html;

    return (
      "<!DOCTYPE html>\n" +
      '<html lang="en"' +
      (env.htmlClasses ? ' class="' + env.htmlClasses.replace(/"/g, "&quot;") + '"' : "") +
      (env.dataTheme ? ' data-theme="' + env.dataTheme.replace(/"/g, "&quot;") + '"' : "") +
      ">\n" +
      "<head>\n" +
      '  <meta charset="UTF-8">\n' +
      '  <meta name="viewport" content="width=device-width, initial-scale=1.0">\n' +
      "  <title>ExactMotion v3.0 Clone — " +
      (env.title || "Captured Choreography").replace(/</g, "&lt;") +
      "</title>\n" +
      (fontLinksHtml ? fontLinksHtml + "\n" : "") +
      "  <style>\n" +
      cssParts +
      "\n  </style>\n" +
      "</head>\n" +
      "<body" +
      (env.bodyClasses ? ' class="' + env.bodyClasses.replace(/"/g, "&quot;") + '"' : "") +
      ">\n" +
      '  <div id="exactmotion-v3-stage" style="min-height: 100vh;">\n' +
      bodyHtml +
      "\n  </div>\n" +
      "  <script>\n" +
      "    (function() {\n" +
      "      var scrubs = " + scrubDataJson + ";\n" +
      "      var svgMorphs = " + svgMorphJson + ";\n" +
      "      var themeFlips = " + themeFlipsJson + ";\n" +
      "      var tilts = " + tiltDataJson + ";\n" +
      "      var canvases = " + canvasDataJson + ";\n" +
      "      canvases.forEach(function(c) {\n" +
      '        var el = document.querySelector(\'[data-em-id="\' + c.emId + \'"]\');\n' +
      "        if (el && el.getContext && c.dataUrlPreview) {\n" +
      "          var img = new Image();\n" +
      "          img.onload = function() { var ctx = el.getContext('2d'); if (ctx) ctx.drawImage(img, 0, 0, el.width, el.height); };\n" +
      "          img.src = c.dataUrlPreview;\n" +
      "        }\n" +
      "      });\n" +
      "      function lerp(a, b, t) { return a + (b - a) * t; }\n" +
      "      function computeMasterProgress() {\n" +
      '        var roots = document.querySelectorAll(\'[data-em-root="true"]:not([data-em-portal="true"])\');\n' +
      "        if (!roots.length) return 0;\n" +
      "        var minTop = Infinity, maxBot = -Infinity;\n" +
      "        for (var i = 0; i < roots.length; i++) {\n" +
      "          var r = roots[i].getBoundingClientRect();\n" +
      "          if (r.top < minTop) minTop = r.top;\n" +
      "          if (r.bottom > maxBot) maxBot = r.bottom;\n" +
      "        }\n" +
      "        var vh = Math.max(1, window.innerHeight);\n" +
      "        var h = Math.max(1, maxBot - minTop);\n" +
      "        return h > vh * 1.18 ? Math.max(0, Math.min(1, -minTop / Math.max(1, h - vh))) : Math.max(0, Math.min(1, (vh - minTop) / Math.max(1, vh + h)));\n" +
      "      }\n" +
      "      function applyChoreography() {\n" +
      "        var p = computeMasterProgress();\n" +
      "        scrubs.forEach(function(item) {\n" +
      '          var node = document.querySelector(\'[data-em-id="\' + item.emId + \'"]\');\n' +
      "          if (!node || !item.keyframesByScroll || item.keyframesByScroll.length < 2) return;\n" +
      "          var kfs = item.keyframesByScroll;\n" +
      "          var pos = p * (kfs.length - 1);\n" +
      "          var i0 = Math.floor(pos), i1 = Math.min(kfs.length - 1, i0 + 1);\n" +
      "          var f = pos - i0;\n" +
      "          var k0 = kfs[i0], k1 = kfs[i1];\n" +
      "          var tx = lerp(k0.tx || 0, k1.tx || 0, f), ty = lerp(k0.ty || 0, k1.ty || 0, f);\n" +
      "          var sx = lerp(k0.scaleX !== undefined ? k0.scaleX : 1, k1.scaleX !== undefined ? k1.scaleX : 1, f);\n" +
      "          var sy = lerp(k0.scaleY !== undefined ? k0.scaleY : 1, k1.scaleY !== undefined ? k1.scaleY : 1, f);\n" +
      "          var rx = lerp(k0.rotateX || 0, k1.rotateX || 0, f);\n" +
      "          var ry = lerp(k0.rotateY || 0, k1.rotateY || 0, f);\n" +
      "          var rz = lerp(k0.rotateZ || 0, k1.rotateZ || 0, f);\n" +
      "          var op = lerp(k0.opacity !== undefined ? k0.opacity : 1, k1.opacity !== undefined ? k1.opacity : 1, f);\n" +
      "          node.style.transform = 'translate3d(' + tx.toFixed(2) + 'px,' + ty.toFixed(2) + 'px,0) scale(' + sx.toFixed(4) + ',' + sy.toFixed(4) + ') rotateX(' + rx.toFixed(2) + 'deg) rotateY(' + ry.toFixed(2) + 'deg) rotateZ(' + rz.toFixed(2) + 'deg)';\n" +
      "          node.style.opacity = op.toFixed(3);\n" +
      "          if (k0.clipPath && f < 0.5) node.style.clipPath = k0.clipPath;\n" +
      "          else if (k1.clipPath) node.style.clipPath = k1.clipPath;\n" +
      "        });\n" +
      "        svgMorphs.forEach(function(m) {\n" +
      '          var pathEl = document.querySelector(\'[data-em-id="\' + m.emId + \'"]\');\n' +
      "          if (!pathEl || !m.keyframes || !m.keyframes.length) return;\n" +
      "          var idx = p < 0.33 ? 0 : p < 0.75 ? Math.min(1, m.keyframes.length - 1) : m.keyframes.length - 1;\n" +
      "          pathEl.setAttribute('d', m.keyframes[idx].d);\n" +
      "        });\n" +
      "        for (var t = 0; t < themeFlips.length; t++) {\n" +
      "          var tf = themeFlips[t];\n" +
      "          var activeTheme = p >= tf.atMasterScrollProgress ? tf.to : tf.from;\n" +
      "          if (activeTheme && activeTheme.bg) document.body.style.backgroundColor = activeTheme.bg;\n" +
      "          if (activeTheme && activeTheme.color) document.body.style.color = activeTheme.color;\n" +
      "        }\n" +
      "      }\n" +
      "      if (scrubs.length || svgMorphs.length || themeFlips.length) {\n" +
      "        window.addEventListener('scroll', function() { requestAnimationFrame(applyChoreography); }, { passive: true });\n" +
      "        applyChoreography();\n" +
      "      }\n" +
      "      tilts.forEach(function(ef) {\n" +
      '        var el = document.querySelector(\'[data-em-id="\' + ef.emId + \'"]\');\n' +
      "        if (!el) return;\n" +
      "        el.addEventListener('pointermove', function(e) {\n" +
      "          var b = el.getBoundingClientRect();\n" +
      "          var nx = ((e.clientX - b.left) / Math.max(1, b.width)) * 2 - 1;\n" +
      "          var ny = ((e.clientY - b.top) / Math.max(1, b.height)) * 2 - 1;\n" +
      "          if (ef.type === '3D_PERSPECTIVE_TILT') {\n" +
      "            el.style.transform = 'perspective(1000px) rotateX(' + (-ny * (ef.maxRotateXDeg || 10)).toFixed(2) + 'deg) rotateY(' + (nx * (ef.maxRotateYDeg || 10)).toFixed(2) + 'deg)';\n" +
      "          } else if (ef.type === 'MAGNETIC_CURSOR_PULL') {\n" +
      "            el.style.transform = 'translate3d(' + (nx * (ef.maxPullXPx || 12)).toFixed(2) + 'px,' + (ny * (ef.maxPullYPx || 12)).toFixed(2) + 'px,0)';\n" +
      "          }\n" +
      "        });\n" +
      "        el.addEventListener('pointerleave', function() { el.style.transform = ''; });\n" +
      "      });\n" +
      "    })();\n" +
      "  </script>\n" +
      "</body>\n" +
      "</html>\n"
    );
  }

  NS.PromptBuilder = {
    version: "3.0.0",
    countDecompiledFunctions: countDecompiledFunctions,
    buildPrompt: buildPrompt,
    buildStandaloneHtml: buildStandaloneHtml
  };
})();
