// ExactMotion Cloner v3.0 — Cross-Section Choreography & Portal/Shared-Layer Dependency Graph
// Discovers fixed WebGL canvases, sticky curtain handoffs, pin-spacers, chapter navs & global theme bridges

(function () {
  var NS = (globalThis.__ExactMotion = globalThis.__ExactMotion || {});
  if (NS.CrossSectionGraph) return;

  function round(n, d) {
    if (!Number.isFinite(n)) return 0;
    var f = Math.pow(10, d === undefined ? 2 : d);
    return Math.round(n * f) / f;
  }

  // Discover candidate external fixed/sticky/portal layers on the page that visually overlap or co-animate with selected sections
  function discoverLinkedPortalCandidates(selectedRoots) {
    var roots = NS.Extractor.normalizeRoots(selectedRoots);
    if (roots.length === 0) return [];

    var portals = [];
    var seen = new Set();
    var vw = Math.max(1, window.innerWidth);
    var vh = Math.max(1, window.innerHeight);

    function isInsideAnyRoot(el) {
      for (var i = 0; i < roots.length; i++) {
        if (roots[i] === el || roots[i].contains(el) || el.contains(roots[i])) return true;
      }
      return false;
    }

    // Scan top-level and 2-level body containers + all canvases/fixed layers
    var candidates = [];
    var bodyKids = document.body ? Array.prototype.slice.call(document.body.children) : [];
    for (var b = 0; b < bodyKids.length; b++) {
      var bk = bodyKids[b];
      candidates.push(bk);
      if (bk.children && bk.children.length < 25) {
        for (var c = 0; c < bk.children.length; c++) {
          candidates.push(bk.children[c]);
          if (bk.children[c].children && bk.children[c].children.length < 15) {
            for (var gc = 0; gc < bk.children[c].children.length; gc++) {
              candidates.push(bk.children[c].children[gc]);
            }
          }
        }
      }
    }
    var canvases = document.querySelectorAll("canvas");
    for (var cv = 0; cv < canvases.length; cv++) candidates.push(canvases[cv]);

    for (var i = 0; i < candidates.length && portals.length < 6; i++) {
      var el = candidates[i];
      if (!el || el.nodeType !== 1 || seen.has(el)) continue;
      if (el.id === "__exactmotion-host" || (el.closest && el.closest("#__exactmotion-host"))) continue;
      if (el.tagName === "SCRIPT" || el.tagName === "STYLE" || el.tagName === "LINK") continue;
      if (isInsideAnyRoot(el)) continue;

      var cs;
      try {
        cs = getComputedStyle(el);
      } catch (_) {
        continue;
      }
      if (cs.display === "none" || cs.visibility === "hidden" || parseFloat(cs.opacity) === 0) continue;

      var rect = el.getBoundingClientRect();
      if (rect.width < 24 || rect.height < 24) continue;

      // Skip standard cookie banners / Intercom chat widgets
      var idCls = ((el.id || "") + " " + (typeof el.className === "string" ? el.className : "")).toLowerCase();
      if (/cookie|consent|gdpr|intercom|crisp|drift|hubspot|chat-widget|recaptcha/i.test(idCls)) continue;

      var isFixed = cs.position === "fixed";
      var isFullStageCanvas =
        (el.tagName === "CANVAS" || Boolean(el.querySelector && el.querySelector("canvas"))) &&
        (isFixed || cs.position === "sticky" || cs.position === "absolute") &&
        rect.width >= vw * 0.35 &&
        rect.height >= vh * 0.35;

      var isFixedBackgroundOrStage =
        isFixed &&
        rect.width >= vw * 0.5 &&
        rect.height >= vh * 0.5 &&
        parseInt(cs.zIndex || "0", 10) < 50;

      var isChapterProgressIndicator =
        isFixed &&
        /progress|chapter|indicator|scrollbar|stepper|dot-nav|section-nav/i.test(idCls);

      if (isFullStageCanvas || isFixedBackgroundOrStage || isChapterProgressIndicator) {
        // Avoid adding both parent wrapper and child canvas
        var alreadyCovered = portals.some(function (existing) {
          return existing.contains(el) || el.contains(existing);
        });
        if (!alreadyCovered) {
          seen.add(el);
          portals.push(el);
        }
      }
    }

    return portals;
  }

  // Suggest adjacent sibling section (previous or next) for 1-click Multi-Section Expansion!
  function findAdjacentSection(referenceSection, direction) {
    if (!referenceSection || referenceSection.nodeType !== 1) return null;
    var curr = referenceSection;
    // Unwrap GSAP .pin-spacer if wrapped
    if (curr.parentElement && curr.parentElement.classList.contains("pin-spacer")) {
      curr = curr.parentElement;
    }
    var sib = direction === "prev" ? curr.previousElementSibling : curr.nextElementSibling;
    while (sib) {
      if (
        sib.id !== "__exactmotion-host" &&
        sib.tagName !== "SCRIPT" &&
        sib.tagName !== "STYLE" &&
        sib.getBoundingClientRect().height > 40
      ) {
        // If sibling is a GSAP pin-spacer, select the actual section inside or the spacer itself
        if (sib.classList.contains("pin-spacer") && sib.firstElementChild) {
          return sib.firstElementChild;
        }
        return sib;
      }
      sib = direction === "prev" ? sib.previousElementSibling : sib.nextElementSibling;
    }
    return null;
  }

  // Create a live monitor that watches html/body global theme/CSS-var flips & portal mutations during scroll!
  function createGlobalBridgeMonitor(selectedRoots, linkedPortals) {
    var roots = NS.Extractor.normalizeRoots(selectedRoots);
    var portals = linkedPortals || [];

    var themeTransitions = [];
    var portalActivity = new Map();
    var observer = null;

    function normalizeThemeClassString(str) {
      if (!str || typeof str !== "string") return "";
      return str
        .split(/\s+/)
        .filter(function (c) {
          return (
            c &&
            c !== "lenis-scrolling" &&
            c !== "lenis-smooth" &&
            c !== "lenis-stopped" &&
            c !== "is-scrolling" &&
            c !== "has-scroll-scrolling"
          );
        })
        .sort()
        .join(" ");
    }

    function readGlobalThemeState() {
      var html = document.documentElement;
      var body = document.body;
      var bodyCs = getComputedStyle(body);
      var htmlCs = getComputedStyle(html);
      return {
        htmlClass: normalizeThemeClassString(html.className || ""),
        bodyClass: normalizeThemeClassString(body.className || ""),
        dataTheme: html.getAttribute("data-theme") || body.getAttribute("data-theme") || null,
        bg: bodyCs.backgroundColor !== "rgba(0, 0, 0, 0)" ? bodyCs.backgroundColor : htmlCs.backgroundColor,
        color: bodyCs.color
      };
    }

    var lastTheme = readGlobalThemeState();

    function checkThemeDiff(masterScrollProgress) {
      var cur = readGlobalThemeState();
      if (
        cur.htmlClass !== lastTheme.htmlClass ||
        cur.bodyClass !== lastTheme.bodyClass ||
        cur.dataTheme !== lastTheme.dataTheme ||
        cur.bg !== lastTheme.bg ||
        cur.color !== lastTheme.color
      ) {
        if (themeTransitions.length < 24) {
          themeTransitions.push({
            atMasterScrollProgress: round(masterScrollProgress, 3),
            windowScrollY: Math.round(window.scrollY),
            from: lastTheme,
            to: cur
          });
        }
        lastTheme = cur;
      }
    }

    function start() {
      lastTheme = readGlobalThemeState();
      observer = new MutationObserver(function (mutations) {
        for (var i = 0; i < mutations.length; i++) {
          var m = mutations[i];
          var t = m.target;
          if (!t || t.nodeType !== 1) continue;
          for (var p = 0; p < portals.length; p++) {
            if (portals[p] === t || portals[p].contains(t)) {
              var pid = portals[p].getAttribute("data-em-id") || "portal-" + p;
              portalActivity.set(pid, (portalActivity.get(pid) || 0) + 1);
            }
          }
        }
      });

      observer.observe(document.documentElement, {
        attributes: true,
        attributeFilter: ["class", "data-theme", "data-mode", "style"]
      });
      if (document.body) {
        observer.observe(document.body, {
          attributes: true,
          attributeFilter: ["class", "data-theme", "data-mode", "style"]
        });
      }
      portals.forEach(function (portal) {
        observer.observe(portal, {
          subtree: true,
          attributes: true,
          attributeFilter: ["style", "class", "data-state", "data-active"]
        });
      });
    }

    function stopAndCompile(masterMinY, masterMaxY) {
      if (observer) observer.disconnect();

      // Build Section Topology & Handoff Windows
      var vh = Math.max(1, window.innerHeight);
      var sectionWindows = [];
      var scrollStart = Infinity;
      var scrollEnd = -Infinity;

      for (var i = 0; i < roots.length; i++) {
        var el = roots[i];
        var r = el.getBoundingClientRect();
        var absTop = Math.round(r.top + window.scrollY);
        var h = Math.round(r.height);
        var cs = getComputedStyle(el);
        var parentCs = el.parentElement ? getComputedStyle(el.parentElement) : null;
        var isPinSpacerWrapped = Boolean(el.parentElement && el.parentElement.classList.contains("pin-spacer"));
        var hasStickyChild = Boolean(
          cs.position === "sticky" ||
            Array.prototype.some.call(el.querySelectorAll("*"), function (n) {
              return getComputedStyle(n).position === "sticky";
            })
        );

        var enterY = Math.max(0, absTop - vh);
        var exitY = absTop + h;
        if (enterY < scrollStart) scrollStart = enterY;
        if (exitY > scrollEnd) scrollEnd = exitY;

        sectionWindows.push({
          sectionIndex: i + 1,
          emId: el.getAttribute("data-em-id"),
          selector: NS.Extractor.describeElement(el),
          documentTopPx: absTop,
          heightPx: h,
          viewportMultiple: round(h / vh, 2) + "vh",
          position: cs.position,
          zIndex: cs.zIndex,
          marginTop: cs.marginTop,
          wrappedInGsapPinSpacer: isPinSpacerWrapped,
          pinSpacerHeightPx: isPinSpacerWrapped && el.parentElement ? Math.round(el.parentElement.getBoundingClientRect().height) : null,
          containsStickyViewportLock: hasStickyChild,
          parentOverflow: parentCs ? parentCs.overflow : null
        });
      }

      var totalMasterSpan = Math.max(1, scrollEnd - scrollStart);
      var handoffRelationships = [];

      for (var s = 0; s < sectionWindows.length; s++) {
        var sw = sectionWindows[s];
        var startNorm = round(Math.max(0, (sw.documentTopPx - vh - scrollStart) / totalMasterSpan), 3);
        var endNorm = round(Math.min(1, (sw.documentTopPx + sw.heightPx - scrollStart) / totalMasterSpan), 3);
        sw.masterTimelineWindow = startNorm + " -> " + endNorm;

        if (s > 0) {
          var prev = sectionWindows[s - 1];
          var prevBottom = prev.documentTopPx + prev.heightPx;
          var gapOrOverlapPx = sw.documentTopPx - prevBottom;
          var relation = "sequential-vertical-flow";
          if (gapOrOverlapPx < -8) {
            relation = "negative-margin-curtain-overlap (" + Math.abs(gapOrOverlapPx) + "px overlap)";
          } else if (prev.containsStickyViewportLock || prev.wrappedInGsapPinSpacer) {
            relation = "pinned-handoff (Section " + prev.sectionIndex + " pins while scrubbing, then releases into Section " + sw.sectionIndex + ")";
          }
          handoffRelationships.push({
            fromSection: prev.selector,
            toSection: sw.selector,
            boundaryScrollYPx: sw.documentTopPx,
            gapOrOverlapPx: gapOrOverlapPx,
            handoffType: relation
          });
        }
      }

      var linkedPortalSummaries = portals.map(function (p, idx) {
        var pid = p.getAttribute("data-em-id") || "portal-" + idx;
        var cs = getComputedStyle(p);
        var rect = p.getBoundingClientRect();
        return {
          emId: pid,
          selector: NS.Extractor.describeElement(p),
          position: cs.position,
          zIndex: cs.zIndex,
          pointerEvents: cs.pointerEvents,
          viewportCoverage: Math.round(rect.width) + "x" + Math.round(rect.height),
          observedMutationsDuringScroll: portalActivity.get(pid) || 0,
          containsCanvas: p.tagName === "CANVAS" || Boolean(p.querySelector && p.querySelector("canvas"))
        };
      });

      return {
        isMultiSection: roots.length > 1 || portals.length > 0 || themeTransitions.length > 0,
        masterScrollSpanPx: totalMasterSpan,
        observedScrollRangePx: [Math.round(masterMinY || 0), Math.round(masterMaxY || 0)],
        sectionsTopology: sectionWindows,
        crossSectionHandoffs: handoffRelationships,
        linkedPortalAndStageLayers: linkedPortalSummaries,
        globalThemeAndBodyTransitions: themeTransitions
      };
    }

    return {
      start: start,
      checkThemeDiff: checkThemeDiff,
      stopAndCompile: stopAndCompile
    };
  }

  NS.CrossSectionGraph = {
    discoverLinkedPortalCandidates: discoverLinkedPortalCandidates,
    findAdjacentSection: findAdjacentSection,
    createGlobalBridgeMonitor: createGlobalBridgeMonitor
  };
})();
