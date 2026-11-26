// ExactMotion Cloner v3.0 — Multi-Root, Portal Layer & Smart SplitText DOM/Style Extractor

(function () {
  var NS = (globalThis.__ExactMotion = globalThis.__ExactMotion || {});
  if (NS.Extractor && NS.Extractor.version === "3.0.0") return;

  var ESSENTIAL_PROPS = [
    "display",
    "position",
    "top",
    "right",
    "bottom",
    "left",
    "z-index",
    "width",
    "height",
    "min-width",
    "min-height",
    "max-width",
    "max-height",
    "aspect-ratio",
    "box-sizing",
    "margin",
    "padding",
    "overflow",
    "overflow-x",
    "overflow-y",
    "flex-direction",
    "flex-wrap",
    "flex",
    "flex-grow",
    "flex-shrink",
    "justify-content",
    "align-items",
    "align-content",
    "align-self",
    "gap",
    "row-gap",
    "column-gap",
    "grid-template-columns",
    "grid-template-rows",
    "grid-column",
    "grid-row",
    "place-items",
    "font-family",
    "font-size",
    "font-weight",
    "font-style",
    "font-variation-settings",
    "line-height",
    "letter-spacing",
    "text-align",
    "text-transform",
    "text-decoration",
    "white-space",
    "color",
    "background-color",
    "background-image",
    "background-size",
    "background-position",
    "background-repeat",
    "background-clip",
    "-webkit-background-clip",
    "-webkit-text-fill-color",
    "border",
    "border-top",
    "border-right",
    "border-bottom",
    "border-left",
    "border-radius",
    "outline",
    "box-shadow",
    "opacity",
    "visibility",
    "pointer-events",
    "cursor",
    "transform",
    "transform-origin",
    "transform-style",
    "perspective",
    "perspective-origin",
    "backface-visibility",
    "filter",
    "backdrop-filter",
    "-webkit-backdrop-filter",
    "mix-blend-mode",
    "clip-path",
    "mask-image",
    "-webkit-mask-image",
    "object-fit",
    "object-position",
    "transition",
    "animation",
    "animation-timeline",
    "animation-range",
    "will-change"
  ];

  var DEFAULT_SKIP_VALUES = {
    "position": "static",
    "top": "auto",
    "right": "auto",
    "bottom": "auto",
    "left": "auto",
    "z-index": "auto",
    "min-width": "0px",
    "min-height": "0px",
    "max-width": "none",
    "max-height": "none",
    "aspect-ratio": "auto",
    "margin": "0px",
    "padding": "0px",
    "overflow": "visible",
    "overflow-x": "visible",
    "overflow-y": "visible",
    "flex-direction": "row",
    "flex-wrap": "nowrap",
    "flex-grow": "0",
    "flex-shrink": "1",
    "justify-content": "normal",
    "align-items": "normal",
    "align-content": "normal",
    "align-self": "auto",
    "gap": "normal",
    "row-gap": "normal",
    "column-gap": "normal",
    "grid-template-columns": "none",
    "grid-template-rows": "none",
    "place-items": "normal",
    "font-style": "normal",
    "font-variation-settings": "normal",
    "letter-spacing": "normal",
    "text-transform": "none",
    "white-space": "normal",
    "background-color": "rgba(0, 0, 0, 0)",
    "background-image": "none",
    "border-radius": "0px",
    "box-shadow": "none",
    "opacity": "1",
    "visibility": "visible",
    "pointer-events": "auto",
    "cursor": "auto",
    "transform": "none",
    "transform-style": "flat",
    "perspective": "none",
    "backface-visibility": "visible",
    "filter": "none",
    "backdrop-filter": "none",
    "-webkit-backdrop-filter": "none",
    "mix-blend-mode": "normal",
    "clip-path": "none",
    "mask-image": "none",
    "-webkit-mask-image": "none",
    "object-fit": "fill",
    "animation-timeline": "auto",
    "animation-range": "normal",
    "will-change": "auto"
  };

  function normalizeRoots(rootsInput) {
    if (!rootsInput) return [];
    var arr = Array.isArray(rootsInput) ? rootsInput : [rootsInput];
    var valid = arr.filter(function (el) {
      return el && el.nodeType === 1 && el.isConnected;
    });
    // Deduplicate nested roots (if parent and child both selected, keep outer parent!)
    var deduped = [];
    for (var i = 0; i < valid.length; i++) {
      var candidate = valid[i];
      var containedByOther = valid.some(function (other, j) {
        return i !== j && other.contains(candidate);
      });
      if (!containedByOther && deduped.indexOf(candidate) === -1) {
        deduped.push(candidate);
      }
    }
    // Sort in natural DOM document order
    deduped.sort(function (a, b) {
      if (a === b) return 0;
      var pos = a.compareDocumentPosition(b);
      return pos & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1;
    });
    return deduped;
  }

  function toAbsUrl(raw, baseHref) {
    if (!raw || typeof raw !== "string") return raw;
    var trimmed = raw.trim();
    if (
      !trimmed ||
      trimmed.indexOf("data:") === 0 ||
      trimmed.indexOf("blob:") === 0 ||
      trimmed.indexOf("mailto:") === 0 ||
      trimmed.indexOf("tel:") === 0 ||
      trimmed.indexOf("javascript:") === 0 ||
      trimmed.indexOf("#") === 0
    ) {
      return trimmed;
    }
    try {
      return new URL(trimmed, baseHref || document.baseURI || location.href).href;
    } catch (_) {
      return trimmed;
    }
  }

  function resolveCssUrls(cssText, baseHref) {
    if (!cssText || cssText.indexOf("url(") === -1) return cssText;
    return cssText.replace(/url\(\s*(['"]?)([^'")]+)\1\s*\)/gi, function (match, _quote, urlPart) {
      var u = urlPart.trim();
      if (!u || u.indexOf("data:") === 0 || u.indexOf("#") === 0) return match;
      var abs = toAbsUrl(u, baseHref);
      return 'url("' + abs + '")';
    });
  }

  function resolveSrcset(srcset, baseHref) {
    if (!srcset) return srcset;
    return srcset
      .split(",")
      .map(function (entry) {
        var parts = entry.trim().split(/\s+/);
        if (!parts[0]) return entry;
        parts[0] = toAbsUrl(parts[0], baseHref);
        return parts.join(" ");
      })
      .join(", ");
  }

  function tagSubtrees(rootsInput, linkedPortals) {
    var roots = normalizeRoots(rootsInput);
    var portals = Array.isArray(linkedPortals)
      ? linkedPortals.filter(function (p) {
          return p && p.nodeType === 1 && p.isConnected && !roots.some(function (r) { return r.contains(p); });
        })
      : [];

    // Clear stale tags first
    var staleRoots = document.querySelectorAll('[data-em-root], [data-em-portal], [data-em-id]');
    for (var sr = 0; sr < staleRoots.length; sr++) {
      staleRoots[sr].removeAttribute("data-em-root");
      staleRoots[sr].removeAttribute("data-em-section-index");
      staleRoots[sr].removeAttribute("data-em-portal");
      staleRoots[sr].removeAttribute("data-em-id");
    }

    var tagged = [];
    var idx = 0;

    for (var r = 0; r < roots.length; r++) {
      var root = roots[r];
      root.setAttribute("data-em-root", "true");
      root.setAttribute("data-em-section-index", String(r));
      var all = [root].concat(Array.prototype.slice.call(root.querySelectorAll("*")));
      for (var i = 0; i < all.length; i++) {
        var el = all[i];
        if (el.id === "__exactmotion-host" || (el.closest && el.closest("#__exactmotion-host"))) continue;
        var id = "em-" + idx++;
        el.setAttribute("data-em-id", id);
        tagged.push(el);
      }
    }

    for (var p = 0; p < portals.length; p++) {
      var portal = portals[p];
      if (portal.id === "__exactmotion-host" || (portal.closest && portal.closest("#__exactmotion-host"))) continue;
      portal.setAttribute("data-em-root", "true");
      portal.setAttribute("data-em-portal", "true");
      var pAll = [portal].concat(Array.prototype.slice.call(portal.querySelectorAll("*")));
      for (var j = 0; j < pAll.length; j++) {
        var pel = pAll[j];
        if (pel.id === "__exactmotion-host" || (pel.closest && pel.closest("#__exactmotion-host"))) continue;
        if (!pel.hasAttribute("data-em-id")) {
          pel.setAttribute("data-em-id", "em-portal-" + p + "-" + j);
          tagged.push(pel);
        }
      }
    }

    return tagged;
  }

  function untagAll() {
    var nodes = document.querySelectorAll("[data-em-root], [data-em-portal], [data-em-section-index], [data-em-id]");
    for (var i = 0; i < nodes.length; i++) {
      nodes[i].removeAttribute("data-em-root");
      nodes[i].removeAttribute("data-em-portal");
      nodes[i].removeAttribute("data-em-section-index");
      nodes[i].removeAttribute("data-em-id");
    }
  }

  function describeElement(el) {
    if (!el || el.nodeType !== 1) return "unknown";
    var emId = el.getAttribute("data-em-id");
    var tag = el.tagName.toLowerCase();
    var idPart = el.id ? "#" + el.id : "";
    var cls = "";
    if (typeof el.className === "string" && el.className.trim()) {
      cls =
        "." +
        el.className
          .trim()
          .split(/\s+/)
          .filter(function (c) {
            return c && c.length < 36 && c.indexOf("__exactmotion") === -1;
          })
          .slice(0, 2)
          .join(".");
      if (cls === ".") cls = "";
    }
    var base = tag + idPart + cls;
    return emId ? base + ' [data-em-id="' + emId + '"]' : base;
  }

  // Detect SplitText / SplitType / Char-by-Char exploded text blocks so they don't bloat DOM or starve trackers!
  function detectSplitTextGroups(roots) {
    var groups = [];
    var splitCharSet = new Set();

    for (var r = 0; r < roots.length; r++) {
      var candidates = roots[r].querySelectorAll("h1, h2, h3, h4, p, blockquote, [aria-label], div, span");
      for (var i = 0; i < candidates.length && groups.length < 24; i++) {
        var container = candidates[i];
        var kids = container.children;
        if (!kids || kids.length < 8) continue;

        var singleCharCount = 0;
        var wordSpanCount = 0;
        var sameTag = kids[0].tagName;
        var allSame = true;

        for (var k = 0; k < kids.length; k++) {
          var ch = kids[k];
          if (ch.tagName !== sameTag) allSame = false;
          var txt = (ch.textContent || "").trim();
          var cls = typeof ch.className === "string" ? ch.className : "";
          if (txt.length <= 2 || /char|letter|glyph/i.test(cls)) {
            singleCharCount++;
          } else if (/word|line/i.test(cls) || (ch.children.length === 0 && txt.length <= 16)) {
            wordSpanCount++;
          }
        }

        if (allSame && (singleCharCount >= 8 || wordSpanCount >= 8)) {
          var mode = singleCharCount >= 8 ? "chars" : "words";
          var reconstructed = (container.getAttribute("aria-label") || container.textContent || "")
            .replace(/\s+/g, " ")
            .trim();
          groups.push({
            containerEmId: container.getAttribute("data-em-id"),
            selector: describeElement(container),
            splitGranularity: mode,
            unitCount: kids.length,
            unitTag: sameTag.toLowerCase(),
            sampleFirstEmId: kids[0].getAttribute("data-em-id"),
            sampleMiddleEmId: kids[Math.floor(kids.length / 2)].getAttribute("data-em-id"),
            sampleLastEmId: kids[kids.length - 1].getAttribute("data-em-id"),
            fullText: reconstructed.slice(0, 320)
          });

          // Mark non-sample glyph nodes so recorder/baseline style loops don't waste budget on 250 identical spans!
          var midIdx = Math.floor(kids.length / 2);
          for (var m = 0; m < kids.length; m++) {
            if (m !== 0 && m !== 1 && m !== midIdx && m !== kids.length - 1) {
              var subId = kids[m].getAttribute("data-em-id");
              if (subId) splitCharSet.add(subId);
            }
          }
        }
      }
    }

    return {
      groups: groups,
      redundantGlyphEmIds: splitCharSet
    };
  }

  function fingerprintTech(roots) {
    var badges = [];
    var details = {
      tailwind: false,
      radixOrShadcn: false,
      framerMotion: false,
      gsapHints: false,
      pinSpacerDetected: false,
      cssScrollDriven: false,
      webflow: false,
      threeOrCanvas: false,
      svgMotion: false,
      videoScrubCandidate: false,
      stickyPinArchitecture: false,
      splitTextDetected: false,
      innerScrollContainers: []
    };

    var all = [];
    for (var r = 0; r < roots.length; r++) {
      if (roots[r].parentElement && roots[r].parentElement.classList.contains("pin-spacer")) {
        details.pinSpacerDetected = true;
        details.gsapHints = true;
      }
      all.push(roots[r]);
      var sub = roots[r].querySelectorAll("*");
      for (var s = 0; s < sub.length && all.length < 500; s++) all.push(sub[s]);
    }

    var twRegex = /(?:^|\s)(?:flex|grid|items-center|justify-between|rounded-(?:sm|md|lg|xl|2xl|full)|px-\d|py-\d|text-(?:xs|sm|base|lg|xl|\dxl)|bg-\[|tracking-|backdrop-blur)/;

    for (var i = 0; i < all.length; i++) {
      var el = all[i];
      var cls = typeof el.className === "string" ? el.className : "";
      if (!details.tailwind && twRegex.test(cls)) details.tailwind = true;
      if (/pin-spacer/.test(cls) || el._gsap) details.gsapHints = true;
      if (/\b(?:char|word|line)\b/i.test(cls) && el.tagName === "DIV") details.splitTextDetected = true;

      var attrs = el.attributes || [];
      for (var a = 0; a < attrs.length; a++) {
        var an = attrs[a].name;
        if (an.indexOf("data-radix-") === 0 || an === "data-state" || an === "data-slot") details.radixOrShadcn = true;
        if (an.indexOf("data-framer-") === 0 || an === "data-projection-id") details.framerMotion = true;
        if (an === "data-w-id") details.webflow = true;
        if (an.indexOf("data-gsap") === 0 || an === "data-speed" || an === "data-lag") details.gsapHints = true;
      }

      if (el.tagName === "CANVAS") details.threeOrCanvas = true;
      if (el.tagName === "VIDEO") details.videoScrubCandidate = true;
      if (el.tagName === "svg" || el.tagName === "path") {
        var st = el.getAttribute("style") || "";
        if (st.indexOf("stroke-dashoffset") !== -1 || el.hasAttribute("stroke-dasharray") || el.tagName === "path") {
          details.svgMotion = true;
        }
      }

      try {
        var cs = getComputedStyle(el);
        if (cs.position === "sticky") details.stickyPinArchitecture = true;
        if (cs.animationTimeline && cs.animationTimeline !== "auto" && cs.animationTimeline !== "none") {
          details.cssScrollDriven = true;
        }
        if (
          (cs.overflowY === "auto" || cs.overflowY === "scroll" || cs.overflowX === "auto" || cs.overflowX === "scroll") &&
          (el.scrollHeight > el.clientHeight + 8 || el.scrollWidth > el.clientWidth + 8)
        ) {
          if (details.innerScrollContainers.length < 8) {
            details.innerScrollContainers.push({
              selector: describeElement(el),
              emId: el.getAttribute("data-em-id"),
              scrollHeight: el.scrollHeight,
              clientHeight: el.clientHeight,
              scrollWidth: el.scrollWidth,
              clientWidth: el.clientWidth
            });
          }
        }
      } catch (_) {}
    }

    if (roots.length > 1) badges.push("Multi-Section (" + roots.length + " Linked)");
    if (details.tailwind) badges.push("Tailwind CSS");
    if (details.radixOrShadcn) badges.push("Radix / Shadcn UI");
    if (details.framerMotion) badges.push("Framer Motion");
    if (details.gsapHints) badges.push("GSAP / ScrollTrigger");
    if (details.pinSpacerDetected) badges.push("GSAP Pin-Spacer");
    if (details.cssScrollDriven) badges.push("CSS Scroll-Driven");
    if (details.webflow) badges.push("Webflow IX2");
    if (details.stickyPinArchitecture) badges.push("Sticky Scroll-Pin");
    if (details.innerScrollContainers.length > 0) badges.push("Inner Scroll Container");
    if (details.threeOrCanvas) badges.push("Canvas / WebGL");
    if (details.svgMotion) badges.push("SVG Vector Motion");
    if (details.videoScrubCandidate) badges.push("HTML5 Video");

    return {
      badges: badges,
      details: details
    };
  }

  function extractCssVariables(roots) {
    var vars = {};
    var primaryRoot = roots[0] || document.documentElement;

    for (var s = 0; s < document.styleSheets.length; s++) {
      var sheet = document.styleSheets[s];
      var rules;
      try {
        rules = sheet.cssRules;
      } catch (_) {
        continue;
      }
      if (!rules) continue;
      for (var r = 0; r < rules.length; r++) {
        var rule = rules[r];
        if (rule.type === 1 && rule.style) {
          var sel = rule.selectorText || "";
          var applies = false;
          if (/^(:root|html|body|\*|:where\(:root\)|\[data-theme|\.dark|\.light|\.theme-)/i.test(sel)) {
            applies = true;
          } else {
            try {
              applies = roots.some(function (rt) {
                return rt.matches(sel) || Boolean(rt.closest(sel));
              });
            } catch (_) {}
          }
          if (applies) {
            for (var i = 0; i < rule.style.length; i++) {
              var prop = rule.style[i];
              if (prop.indexOf("--") === 0) {
                var val =
                  getComputedStyle(primaryRoot).getPropertyValue(prop).trim() ||
                  rule.style.getPropertyValue(prop).trim();
                if (val) vars[prop] = val;
              }
            }
          }
        }
      }
    }

    roots.forEach(function (rt) {
      var curr = rt;
      while (curr && curr.nodeType === 1) {
        if (curr.style) {
          for (var k = 0; k < curr.style.length; k++) {
            var pName = curr.style[k];
            if (pName.indexOf("--") === 0) {
              vars[pName] = curr.style.getPropertyValue(pName).trim();
            }
          }
        }
        curr = curr.parentElement;
      }
    });

    return vars;
  }

  function stripInteractivePseudos(selector) {
    return selector
      .replace(/::?(?:before|after|placeholder|selection|backdrop|marker|first-line|first-letter)/gi, "")
      .replace(/:(?:hover|focus-visible|focus-within|focus|active|visited|checked|disabled|target)/gi, "")
      .trim();
  }

  function selectorMatchesAnyRoot(selectorText, roots) {
    if (!selectorText) return false;
    var parts = selectorText.split(",");
    for (var i = 0; i < parts.length; i++) {
      var raw = parts[i].trim();
      if (!raw || raw === "*" || raw === ":root" || raw === "html" || raw === "body") continue;
      var base = stripInteractivePseudos(raw);
      if (!base) continue;
      try {
        for (var r = 0; r < roots.length; r++) {
          if (roots[r].matches(base) || roots[r].querySelector(base)) return true;
        }
      } catch (_) {}
    }
    return false;
  }

  function extractStylesheetsAndKeyframes(roots) {
    var matchedRules = [];
    var hoverAndStateRules = [];
    var keyframesMap = {};
    var houdiniProperties = [];
    var fontFaces = [];
    var externalFontLinks = [];
    var inaccessibleSheets = 0;

    var links = document.querySelectorAll('link[rel="stylesheet"]');
    for (var l = 0; l < links.length; l++) {
      var href = links[l].href || "";
      if (/fonts\.googleapis\.com|use\.typekit\.net|api\.fontshare\.com|cdn\.fonts/i.test(href)) {
        externalFontLinks.push(href);
      }
    }

    function walkRules(ruleList, baseHref, wrapperPrefix) {
      for (var i = 0; i < ruleList.length; i++) {
        var rule = ruleList[i];
        var cssText = rule.cssText || "";
        if (rule.type === 1) {
          var sel = rule.selectorText || "";
          if (selectorMatchesAnyRoot(sel, roots)) {
            var resolvedCss = resolveCssUrls(cssText, baseHref);
            if (wrapperPrefix) {
              resolvedCss = wrapperPrefix + " {\n  " + resolvedCss + "\n}";
            }
            if (/:hover|:focus|:active|data-state|data-active|aria-expanded|aria-selected|\.active|\.open|\.is-|theme-/i.test(sel)) {
              if (hoverAndStateRules.length < 220) hoverAndStateRules.push(resolvedCss);
            } else {
              if (matchedRules.length < 340) matchedRules.push(resolvedCss);
            }
          }
        } else if (rule.type === 7 || rule.type === 8) {
          if (rule.name && !keyframesMap[rule.name]) {
            keyframesMap[rule.name] = cssText;
          }
        } else if (rule.type === 5) {
          if (fontFaces.length < 28) {
            fontFaces.push(resolveCssUrls(cssText, baseHref));
          }
        } else if (cssText.indexOf("@property ") === 0) {
          // CSS Houdini @property (crucial for animated CSS custom property gradients/angles!)
          if (houdiniProperties.length < 30) houdiniProperties.push(cssText);
        } else if (rule.cssRules && rule.cssRules.length > 0) {
          // Handles @media, @supports, @layer, @container recursively!
          var header = cssText.split("{")[0].trim();
          walkRules(rule.cssRules, baseHref, header || wrapperPrefix);
        }
      }
    }

    for (var s = 0; s < document.styleSheets.length; s++) {
      var sheet = document.styleSheets[s];
      var baseHref = sheet.href || document.baseURI;
      try {
        if (sheet.cssRules) {
          walkRules(sheet.cssRules, baseHref, "");
        }
      } catch (_) {
        inaccessibleSheets++;
      }
    }

    return {
      matchedRules: matchedRules,
      hoverAndStateRules: hoverAndStateRules,
      keyframes: Object.keys(keyframesMap)
        .slice(0, 50)
        .map(function (k) {
          return keyframesMap[k];
        }),
      houdiniProperties: houdiniProperties,
      fontFaces: fontFaces,
      externalFontLinks: externalFontLinks,
      inaccessibleSheets: inaccessibleSheets
    };
  }

  function extractBaselineComputedStyles(allRoots, redundantGlyphEmIds) {
    var nodes = [];
    for (var r = 0; r < allRoots.length; r++) {
      nodes.push(allRoots[r]);
      var sub = allRoots[r].querySelectorAll("[data-em-id]");
      for (var s = 0; s < sub.length && nodes.length < 420; s++) {
        var id = sub[s].getAttribute("data-em-id");
        if (redundantGlyphEmIds && redundantGlyphEmIds.has(id)) continue;
        nodes.push(sub[s]);
      }
    }

    var seen = new Set();
    var declSignatureToIds = new Map(); // Deduplicate identical computed style blocks!
    var pseudoBlocks = [];

    for (var i = 0; i < nodes.length; i++) {
      var el = nodes[i];
      var emId = el.getAttribute("data-em-id");
      if (!emId || seen.has(emId)) continue;
      seen.add(emId);

      var cs;
      try {
        cs = getComputedStyle(el);
      } catch (_) {
        continue;
      }

      var decls = [];
      for (var p = 0; p < ESSENTIAL_PROPS.length; p++) {
        var prop = ESSENTIAL_PROPS[p];
        var val = cs.getPropertyValue(prop);
        if (!val) continue;
        val = val.trim();
        if (!val) continue;
        if (DEFAULT_SKIP_VALUES[prop] === val) continue;
        if (prop === "transition" && (val === "all 0s ease 0s" || val === "all")) continue;
        if (prop === "animation" && val.indexOf("none") === 0) continue;
        if (prop === "border" && val.indexOf("0px none") === 0) continue;
        if ((prop === "border-top" || prop === "border-right" || prop === "border-bottom" || prop === "border-left") && val.indexOf("0px none") === 0) {
          continue;
        }
        if (prop === "outline" && val.indexOf("0px") !== -1 && val.indexOf("none") !== -1) continue;
        if ((prop === "width" || prop === "height") && cs.display === "inline") continue;

        decls.push("  " + prop + ": " + resolveCssUrls(val, document.baseURI) + ";");
      }

      if (decls.length > 0) {
        var sig = decls.join("\n");
        if (!declSignatureToIds.has(sig)) {
          declSignatureToIds.set(sig, []);
        }
        declSignatureToIds.get(sig).push('[data-em-id="' + emId + '"]');
      }

      var pseudos = ["::before", "::after"];
      for (var ps = 0; ps < pseudos.length; ps++) {
        var pType = pseudos[ps];
        try {
          var pcs = getComputedStyle(el, pType);
          var content = pcs.getPropertyValue("content");
          if (content && content !== "none" && content !== "normal") {
            var pDecls = ["  content: " + content + ";"];
            for (var pp = 0; pp < ESSENTIAL_PROPS.length; pp++) {
              var kProp = ESSENTIAL_PROPS[pp];
              var kVal = pcs.getPropertyValue(kProp);
              if (!kVal || DEFAULT_SKIP_VALUES[kProp] === kVal) continue;
              if (kProp === "transition" && kVal.indexOf("0s") !== -1) continue;
              if (kProp === "animation" && kVal.indexOf("none") === 0) continue;
              if (kProp.indexOf("border") === 0 && kVal.indexOf("0px none") === 0) continue;
              pDecls.push("  " + kProp + ": " + resolveCssUrls(kVal, document.baseURI) + ";");
            }
            if (pseudoBlocks.length < 80) {
              pseudoBlocks.push('[data-em-id="' + emId + '"]' + pType + " {\n" + pDecls.join("\n") + "\n}");
            }
          }
        } catch (_) {}
      }
    }

    var elementStyles = [];
    declSignatureToIds.forEach(function (selectors, declBody) {
      if (elementStyles.length < 240) {
        elementStyles.push(selectors.join(", ") + " {\n" + declBody + "\n}");
      }
    });

    return {
      elementStyles: elementStyles,
      pseudoStyles: pseudoBlocks
    };
  }

  // Clone a single root or portal, resolve URLs, inline external SVG defs/filters/masks, and compress SplitText if massive
  function cloneSingleNodeClean(node, compressSplitText) {
    var clone = node.cloneNode(true);
    var baseHref = document.baseURI || location.href;

    var junk = clone.querySelectorAll("script, noscript, #__exactmotion-host, [data-exactmotion-ui]");
    for (var j = 0; j < junk.length; j++) {
      junk[j].remove();
    }

    // Compress huge SplitText spans (> 25 single-char children) into clean annotated markup so prompt stays crystal-clear!
    if (compressSplitText) {
      var textContainers = clone.querySelectorAll("[data-em-id]");
      for (var tc = 0; tc < textContainers.length; tc++) {
        var box = textContainers[tc];
        var kids = box.children;
        if (kids && kids.length > 24) {
          var singleChars = 0;
          for (var k = 0; k < kids.length; k++) {
            if ((kids[k].textContent || "").trim().length <= 2 && kids[k].children.length === 0) singleChars++;
          }
          if (singleChars >= kids.length * 0.8) {
            var fullStr = (box.getAttribute("aria-label") || box.textContent || "").replace(/\s+/g, " ").trim();
            var sampleClass = kids[0].className || "";
            box.setAttribute("data-em-split-chars", "true");
            if (sampleClass) box.setAttribute("data-em-char-class", sampleClass);
            box.textContent = fullStr;
          }
        }
      }
    }

    var allClone = [clone].concat(Array.prototype.slice.call(clone.querySelectorAll("*")));
    var svgRefsNeeded = new Set();

    for (var i = 0; i < allClone.length; i++) {
      var el = allClone[i];
      if (el.hasAttribute("src")) el.setAttribute("src", toAbsUrl(el.getAttribute("src"), baseHref));
      if (el.hasAttribute("poster")) el.setAttribute("poster", toAbsUrl(el.getAttribute("poster"), baseHref));
      if (el.hasAttribute("srcset")) el.setAttribute("srcset", resolveSrcset(el.getAttribute("srcset"), baseHref));
      if (el.tagName === "A" && el.hasAttribute("href")) el.setAttribute("href", toAbsUrl(el.getAttribute("href"), baseHref));
      if (el.hasAttribute("style")) el.setAttribute("style", resolveCssUrls(el.getAttribute("style"), baseHref));

      // Collect #id references for SVG <use>, filter="url(#...)", clip-path="url(#...)", mask="url(#...)", fill="url(#...)"
      ["href", "xlink:href", "filter", "clip-path", "mask", "fill", "stroke"].forEach(function (attr) {
        var v = el.getAttribute(attr);
        if (!v) return;
        if (v.indexOf("#") === 0 && v.length > 1) {
          svgRefsNeeded.add(v.slice(1));
        } else if (v.indexOf("url(#") !== -1) {
          var m = v.match(/url\(\s*['"]?#([^'")\s]+)['"]?\s*\)/);
          if (m && m[1]) svgRefsNeeded.add(m[1]);
        }
      });
    }

    if (svgRefsNeeded.size > 0) {
      var defsSvg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
      defsSvg.setAttribute("aria-hidden", "true");
      defsSvg.setAttribute("style", "position:absolute;width:0;height:0;overflow:hidden;pointer-events:none;");
      var defs = document.createElementNS("http://www.w3.org/2000/svg", "defs");
      var added = false;
      svgRefsNeeded.forEach(function (refId) {
        try {
          if (!clone.querySelector("#" + CSS.escape(refId))) {
            var docDef = document.getElementById(refId);
            if (docDef) {
              defs.appendChild(docDef.cloneNode(true));
              added = true;
            }
          }
        } catch (_) {}
      });
      if (added) {
        defsSvg.appendChild(defs);
        clone.insertBefore(defsSvg, clone.firstChild);
      }
    }

    return clone.outerHTML;
  }

  function cloneAndResolveMultiDOM(roots, portals) {
    var allTargets = roots.concat(portals || []);
    var promptHtmlParts = [];
    var standaloneHtmlParts = [];

    for (var p = 0; p < (portals || []).length; p++) {
      var portalNode = portals[p];
      promptHtmlParts.push(
        "<!-- [AUTO-LINKED SHARED FIXED/PORTAL LAYER #" + (p + 1) + ": " + describeElement(portalNode) + "] -->\n" +
          cloneSingleNodeClean(portalNode, true)
      );
      standaloneHtmlParts.push(cloneSingleNodeClean(portalNode, false));
    }

    for (var r = 0; r < roots.length; r++) {
      var rootNode = roots[r];
      var rRect = rootNode.getBoundingClientRect();
      var headerComment =
        "<!-- [SECTION #" +
        (r + 1) +
        " of " +
        roots.length +
        ": " +
        describeElement(rootNode) +
        " | top=" +
        Math.round(rRect.top + window.scrollY) +
        "px, height=" +
        Math.round(rRect.height) +
        "px] -->\n";
      promptHtmlParts.push(headerComment + cloneSingleNodeClean(rootNode, true));
      standaloneHtmlParts.push(cloneSingleNodeClean(rootNode, false));
    }

    // Capture canvas & video metadata across all roots + portals
    var canvasSnapshots = [];
    var videoElements = [];
    var seenCanvases = new Set();

    allTargets.forEach(function (tNode) {
      var canvases = [tNode]
        .concat(Array.prototype.slice.call(tNode.querySelectorAll("canvas")))
        .filter(function (n) {
          return n.tagName === "CANVAS";
        });
      for (var c = 0; c < canvases.length; c++) {
        var liveC = canvases[c];
        if (seenCanvases.has(liveC)) continue;
        seenCanvases.add(liveC);
        var emId = liveC.getAttribute("data-em-id");
        var rect = liveC.getBoundingClientRect();
        var snapUrl = null;
        try {
          if (liveC.width > 0 && liveC.height > 0) {
            snapUrl = liveC.toDataURL("image/webp", 0.68);
            if (snapUrl && snapUrl.length > 180000) {
              snapUrl = liveC.toDataURL("image/jpeg", 0.5);
            }
          }
        } catch (_) {
          snapUrl = null;
        }
        canvasSnapshots.push({
          emId: emId,
          selector: describeElement(liveC),
          isPortalLayer: Boolean(liveC.closest && liveC.closest('[data-em-portal="true"]')),
          width: liveC.width,
          height: liveC.height,
          cssWidth: Math.round(rect.width),
          cssHeight: Math.round(rect.height),
          hasSnapshot: Boolean(snapUrl),
          dataUrlPreview: snapUrl && snapUrl.length < 130000 ? snapUrl : null
        });
      }

      var videos = tNode.querySelectorAll("video");
      for (var v = 0; v < videos.length && videoElements.length < 10; v++) {
        var vid = videos[v];
        videoElements.push({
          emId: vid.getAttribute("data-em-id"),
          selector: describeElement(vid),
          src: toAbsUrl(vid.currentSrc || vid.getAttribute("src") || "", document.baseURI),
          duration: Number.isFinite(vid.duration) ? Math.round(vid.duration * 100) / 100 : null,
          muted: vid.muted,
          loop: vid.loop,
          playsInline: vid.playsInline
        });
      }
    });

    // Compute combined bounding box across all selected sections
    var minTop = Infinity;
    var maxBottom = -Infinity;
    var minLeft = Infinity;
    var maxRight = -Infinity;
    var sectionBoxes = [];

    for (var b = 0; b < roots.length; b++) {
      var br = roots[b].getBoundingClientRect();
      var absTop = Math.round(br.top + window.scrollY);
      var absLeft = Math.round(br.left + window.scrollX);
      var h = Math.round(br.height);
      var w = Math.round(br.width);
      if (absTop < minTop) minTop = absTop;
      if (absTop + h > maxBottom) maxBottom = absTop + h;
      if (absLeft < minLeft) minLeft = absLeft;
      if (absLeft + w > maxRight) maxRight = absLeft + w;
      sectionBoxes.push({
        sectionIndex: b,
        selector: describeElement(roots[b]),
        emId: roots[b].getAttribute("data-em-id"),
        top: absTop,
        height: h,
        width: w
      });
    }

    var bodyCs = getComputedStyle(document.body);
    var htmlCs = getComputedStyle(document.documentElement);

    return {
      html: promptHtmlParts.join("\n\n"),
      standaloneHtmlFragment: standaloneHtmlParts.join("\n\n"),
      canvasSnapshots: canvasSnapshots,
      videoElements: videoElements,
      sectionBoxes: sectionBoxes,
      boundingBox: {
        width: Number.isFinite(maxRight - minLeft) ? Math.max(0, maxRight - minLeft) : window.innerWidth,
        height: Number.isFinite(maxBottom - minTop) ? Math.max(0, maxBottom - minTop) : window.innerHeight,
        top: Number.isFinite(minTop) ? minTop : 0,
        left: Number.isFinite(minLeft) ? minLeft : 0,
        viewportWidth: window.innerWidth,
        viewportHeight: window.innerHeight
      },
      pageEnvironment: {
        url: location.href,
        title: document.title,
        htmlClasses: document.documentElement.className || "",
        bodyClasses: document.body.className || "",
        dataTheme:
          document.documentElement.getAttribute("data-theme") ||
          document.body.getAttribute("data-theme") ||
          null,
        bodyBackground:
          bodyCs.backgroundColor !== "rgba(0, 0, 0, 0)" ? bodyCs.backgroundColor : htmlCs.backgroundColor,
        bodyColor: bodyCs.color,
        bodyFontFamily: bodyCs.fontFamily
      }
    };
  }

  function extractAll(rootsInput, linkedPortals) {
    var roots = normalizeRoots(rootsInput);
    var portals = Array.isArray(linkedPortals)
      ? linkedPortals.filter(function (p) {
          return p && p.nodeType === 1 && p.isConnected && !roots.some(function (r) { return r.contains(p); });
        })
      : [];

    tagSubtrees(roots, portals);
    var allScopeRoots = roots.concat(portals);
    var splitTextInfo = detectSplitTextGroups(allScopeRoots);
    var fingerprint = fingerprintTech(allScopeRoots);
    var cssVars = extractCssVariables(allScopeRoots);
    var sheets = extractStylesheetsAndKeyframes(allScopeRoots);
    var computed = extractBaselineComputedStyles(allScopeRoots, splitTextInfo.redundantGlyphEmIds);
    var domData = cloneAndResolveMultiDOM(roots, portals);

    var descriptor = roots.map(describeElement).join("  +  ");

    return {
      sectionCount: roots.length,
      portalCount: portals.length,
      targetDescriptor: descriptor,
      splitTextGroups: splitTextInfo.groups,
      fingerprint: fingerprint,
      cssVariables: cssVars,
      stylesheets: sheets,
      computedBaseline: computed,
      dom: domData
    };
  }

  NS.Extractor = {
    version: "3.0.0",
    normalizeRoots: normalizeRoots,
    tagSubtree: function (root) {
      return tagSubtrees([root], []);
    },
    tagSubtrees: tagSubtrees,
    untagSubtree: untagAll,
    untagAll: untagAll,
    describeElement: describeElement,
    detectSplitTextGroups: detectSplitTextGroups,
    fingerprintTech: fingerprintTech,
    extractAll: extractAll
  };
})();
