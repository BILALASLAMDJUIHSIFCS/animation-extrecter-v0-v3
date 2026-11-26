// ExactMotion Cloner v3.0 — Multi-Root 60fps Recorder, Non-Monotonic Piecewise Phase Solver,
// SVG Morph / CSS-Var / Video Scrubber & Adaptive Multi-Section Sweep Engine

(function () {
  var NS = (globalThis.__ExactMotion = globalThis.__ExactMotion || {});
  if (NS.MotionRecorder && NS.MotionRecorder.version === "3.0.0") return;

  function round(n, digits) {
    if (!Number.isFinite(n)) return 0;
    var f = Math.pow(10, digits === undefined ? 2 : digits);
    var r = Math.round(n * f) / f;
    return Object.is(r, -0) ? 0 : r;
  }

  function clamp(v, lo, hi) {
    return v < lo ? lo : v > hi ? hi : v;
  }

  function extractFirstNumber(str) {
    if (!str || str === "none") return 0;
    var m = str.match(/-?\d+(\.\d+)?/);
    return m ? parseFloat(m[0]) : 0;
  }

  function decomposeTransform(transformStr) {
    var identity = {
      raw: "none",
      tx: 0,
      ty: 0,
      tz: 0,
      scaleX: 1,
      scaleY: 1,
      scaleZ: 1,
      rotateX: 0,
      rotateY: 0,
      rotateZ: 0,
      skewX: 0
    };
    if (!transformStr || transformStr === "none") return identity;

    var m2 = transformStr.match(/^matrix\(([^)]+)\)$/);
    if (m2) {
      var v = m2[1].split(",").map(Number);
      if (v.length === 6) {
        var a = v[0], b = v[1], c = v[2], d = v[3], tx = v[4], ty = v[5];
        var scaleX = Math.hypot(a, b);
        var rotateZ = Math.atan2(b, a) * (180 / Math.PI);
        var det = a * d - b * c;
        var scaleY = scaleX !== 0 ? det / scaleX : Math.hypot(c, d);
        var skewX = Math.atan2(a * c + b * d, scaleX * scaleX) * (180 / Math.PI);
        return {
          raw: transformStr,
          tx: round(tx, 2),
          ty: round(ty, 2),
          tz: 0,
          scaleX: round(scaleX, 4),
          scaleY: round(scaleY, 4),
          scaleZ: 1,
          rotateX: 0,
          rotateY: 0,
          rotateZ: round(rotateZ, 2),
          skewX: round(skewX, 2)
        };
      }
    }

    var m3 = transformStr.match(/^matrix3d\(([^)]+)\)$/);
    if (m3) {
      var m = m3[1].split(",").map(Number);
      if (m.length === 16) {
        var m11 = m[0], m12 = m[1], m13 = m[2];
        var m21 = m[4], m22 = m[5], m23 = m[6];
        var m31 = m[8], m32 = m[9], m33 = m[10];
        var tx3 = m[12], ty3 = m[13], tz3 = m[14];

        var sx = Math.hypot(m11, m12, m13) || 1;
        var sy = Math.hypot(m21, m22, m23) || 1;
        var sz = Math.hypot(m31, m32, m33) || 1;

        var r11 = m11 / sx, r12 = m12 / sx, r13 = m13 / sx;
        var r23 = m23 / sy;
        var r33 = m33 / sz;

        var rotY = Math.asin(clamp(-r13, -1, 1)) * (180 / Math.PI);
        var rotX = Math.atan2(r23, r33) * (180 / Math.PI);
        var rotZ = Math.atan2(r12, r11) * (180 / Math.PI);

        return {
          raw: transformStr,
          tx: round(tx3, 2),
          ty: round(ty3, 2),
          tz: round(tz3, 2),
          scaleX: round(sx, 4),
          scaleY: round(sy, 4),
          scaleZ: round(sz, 4),
          rotateX: round(rotX, 2),
          rotateY: round(rotY, 2),
          rotateZ: round(rotZ, 2),
          skewX: 0
        };
      }
    }

    return identity;
  }

  function extractInlineCustomProps(el) {
    var out = null;
    var st = el.style;
    if (!st || st.length === 0) return null;
    for (var i = 0; i < st.length; i++) {
      var k = st[i];
      if (k && k.indexOf("--") === 0) {
        if (!out) out = {};
        out[k] = st.getPropertyValue(k).trim();
      }
    }
    return out;
  }

  function snapshotVisualProps(el) {
    var cs = getComputedStyle(el);
    var tf = decomposeTransform(cs.transform);
    var opacity = parseFloat(cs.opacity);
    if (!Number.isFinite(opacity)) opacity = 1;

    var clipPathVal = cs.clipPath || cs.webkitClipPath || "none";
    var filterVal = cs.filter || "none";
    var dashVal = cs.strokeDashoffset || "0px";
    var borderRad = parseFloat(cs.borderRadius) || 0;

    // SVG Morph (<path d="...">) & Media (<video currentTime>) channels!
    var svgPathD = el.tagName === "path" ? el.getAttribute("d") || "" : null;
    var videoTime = el.tagName === "VIDEO" && Number.isFinite(el.currentTime) ? round(el.currentTime, 3) : null;
    var customVars = extractInlineCustomProps(el);

    // Use un-transformed layout dimensions so rotateZ/scaleX never pollute width/height!
    var layoutW = typeof el.offsetWidth === "number" && el.offsetWidth > 0 ? el.offsetWidth : parseFloat(cs.width) || 0;
    var layoutH = typeof el.offsetHeight === "number" && el.offsetHeight > 0 ? el.offsetHeight : parseFloat(cs.height) || 0;

    return {
      transform: cs.transform || "none",
      tx: tf.tx,
      ty: tf.ty,
      tz: tf.tz,
      scaleX: tf.scaleX,
      scaleY: tf.scaleY,
      rotateX: tf.rotateX,
      rotateY: tf.rotateY,
      rotateZ: tf.rotateZ,
      skewX: tf.skewX,
      opacity: round(opacity, 3),
      width: round(layoutW, 1),
      height: round(layoutH, 1),
      borderRadius: round(borderRad, 1),
      clipPath: clipPathVal,
      clipMetric: round(extractFirstNumber(clipPathVal), 2),
      filter: filterVal,
      filterMetric: round(extractFirstNumber(filterVal), 2),
      backdropFilter: cs.backdropFilter || cs.webkitBackdropFilter || "none",
      backgroundColor: cs.backgroundColor || "",
      color: cs.color || "",
      borderColor: cs.borderColor || "",
      boxShadow: cs.boxShadow || "none",
      backgroundPosition: cs.backgroundPosition || "",
      strokeDashoffset: dashVal,
      dashMetric: round(extractFirstNumber(dashVal), 2),
      svgPathD: svgPathD,
      videoTime: videoTime,
      customVars: customVars,
      transition: cs.transition || ""
    };
  }

  function customVarsChanged(aVars, bVars) {
    if (!aVars && !bVars) return false;
    if (!aVars || !bVars) return true;
    var keys = Object.keys(bVars);
    for (var i = 0; i < keys.length; i++) {
      if (aVars[keys[i]] !== bVars[keys[i]]) return true;
    }
    return false;
  }

  function hasVisualDiff(a, b) {
    if (!a || !b) return false;
    if (Math.abs(a.tx - b.tx) > 0.35) return true;
    if (Math.abs(a.ty - b.ty) > 0.35) return true;
    if (Math.abs(a.tz - b.tz) > 0.5) return true;
    if (Math.abs(a.scaleX - b.scaleX) > 0.004) return true;
    if (Math.abs(a.scaleY - b.scaleY) > 0.004) return true;
    if (Math.abs(a.rotateX - b.rotateX) > 0.25) return true;
    if (Math.abs(a.rotateY - b.rotateY) > 0.25) return true;
    if (Math.abs(a.rotateZ - b.rotateZ) > 0.25) return true;
    if (Math.abs(a.skewX - b.skewX) > 0.25) return true;
    if (Math.abs(a.opacity - b.opacity) > 0.01) return true;
    if (Math.abs(a.width - b.width) > 2.0 && Math.abs(a.scaleX - b.scaleX) < 0.004) return true;
    if (Math.abs(a.height - b.height) > 2.0 && Math.abs(a.scaleY - b.scaleY) < 0.004) return true;
    if (Math.abs(a.borderRadius - b.borderRadius) > 1.0) return true;
    if (a.clipPath !== b.clipPath) return true;
    if (a.filter !== b.filter) return true;
    if (a.backgroundColor !== b.backgroundColor) return true;
    if (a.color !== b.color) return true;
    if (a.borderColor !== b.borderColor) return true;
    if (a.boxShadow !== b.boxShadow) return true;
    if (a.backgroundPosition !== b.backgroundPosition) return true;
    if (a.strokeDashoffset !== b.strokeDashoffset) return true;
    if (a.svgPathD !== b.svgPathD) return true;
    if (a.videoTime !== b.videoTime && Math.abs((a.videoTime || 0) - (b.videoTime || 0)) > 0.03) return true;
    if (customVarsChanged(a.customVars, b.customVars)) return true;
    return false;
  }

  function diffMagnitude(base, cur) {
    if (!base || !cur) return 0;
    var score =
      Math.abs(cur.tx - base.tx) +
      Math.abs(cur.ty - base.ty) +
      Math.abs(cur.tz - base.tz) * 0.5 +
      Math.abs(cur.scaleX - base.scaleX) * 120 +
      Math.abs(cur.scaleY - base.scaleY) * 120 +
      Math.abs(cur.rotateX - base.rotateX) * 2 +
      Math.abs(cur.rotateY - base.rotateY) * 2 +
      Math.abs(cur.rotateZ - base.rotateZ) * 2 +
      Math.abs(cur.opacity - base.opacity) * 80 +
      Math.abs(cur.width - base.width) * 0.3 +
      Math.abs(cur.height - base.height) * 0.3;
    if (cur.clipPath !== base.clipPath) score += 25;
    if (cur.filter !== base.filter) score += 20;
    if (cur.backgroundColor !== base.backgroundColor) score += 15;
    if (cur.color !== base.color) score += 10;
    if (cur.borderColor !== base.borderColor) score += 8;
    if (cur.boxShadow !== base.boxShadow) score += 12;
    if (cur.svgPathD !== base.svgPathD) score += 30;
    return score;
  }

  function summarizeDiff(fromSnap, toSnap) {
    var delta = {};
    if (Math.abs(toSnap.tx - fromSnap.tx) > 0.5) delta.translateX = fromSnap.tx + "px -> " + toSnap.tx + "px";
    if (Math.abs(toSnap.ty - fromSnap.ty) > 0.5) delta.translateY = fromSnap.ty + "px -> " + toSnap.ty + "px";
    if (Math.abs(toSnap.tz - fromSnap.tz) > 0.5) delta.translateZ = fromSnap.tz + "px -> " + toSnap.tz + "px";
    if (Math.abs(toSnap.scaleX - fromSnap.scaleX) > 0.005 || Math.abs(toSnap.scaleY - fromSnap.scaleY) > 0.005) {
      delta.scale = "(" + fromSnap.scaleX + ", " + fromSnap.scaleY + ") -> (" + toSnap.scaleX + ", " + toSnap.scaleY + ")";
    }
    if (Math.abs(toSnap.rotateX - fromSnap.rotateX) > 0.3) delta.rotateX = fromSnap.rotateX + "deg -> " + toSnap.rotateX + "deg";
    if (Math.abs(toSnap.rotateY - fromSnap.rotateY) > 0.3) delta.rotateY = fromSnap.rotateY + "deg -> " + toSnap.rotateY + "deg";
    if (Math.abs(toSnap.rotateZ - fromSnap.rotateZ) > 0.3) delta.rotateZ = fromSnap.rotateZ + "deg -> " + toSnap.rotateZ + "deg";
    if (Math.abs(toSnap.skewX - fromSnap.skewX) > 0.3) delta.skewX = fromSnap.skewX + "deg -> " + toSnap.skewX + "deg";
    if (Math.abs(toSnap.opacity - fromSnap.opacity) > 0.015) delta.opacity = fromSnap.opacity + " -> " + toSnap.opacity;
    if (Math.abs(toSnap.width - fromSnap.width) > 3 && Math.abs(toSnap.scaleX - fromSnap.scaleX) < 0.005) {
      delta.width = fromSnap.width + "px -> " + toSnap.width + "px";
    }
    if (Math.abs(toSnap.height - fromSnap.height) > 3 && Math.abs(toSnap.scaleY - fromSnap.scaleY) < 0.005) {
      delta.height = fromSnap.height + "px -> " + toSnap.height + "px";
    }
    if (Math.abs(toSnap.borderRadius - fromSnap.borderRadius) > 1.5) {
      delta.borderRadius = fromSnap.borderRadius + "px -> " + toSnap.borderRadius + "px";
    }
    if (toSnap.clipPath !== fromSnap.clipPath) delta.clipPath = fromSnap.clipPath + " -> " + toSnap.clipPath;
    if (toSnap.filter !== fromSnap.filter) delta.filter = fromSnap.filter + " -> " + toSnap.filter;
    if (toSnap.backgroundColor !== fromSnap.backgroundColor) delta.backgroundColor = fromSnap.backgroundColor + " -> " + toSnap.backgroundColor;
    if (toSnap.color !== fromSnap.color) delta.color = fromSnap.color + " -> " + toSnap.color;
    if (toSnap.borderColor !== fromSnap.borderColor) delta.borderColor = fromSnap.borderColor + " -> " + toSnap.borderColor;
    if (toSnap.boxShadow !== fromSnap.boxShadow) delta.boxShadow = fromSnap.boxShadow + " -> " + toSnap.boxShadow;
    if (toSnap.strokeDashoffset !== fromSnap.strokeDashoffset) delta.strokeDashoffset = fromSnap.strokeDashoffset + " -> " + toSnap.strokeDashoffset;
    if (toSnap.svgPathD !== fromSnap.svgPathD && toSnap.svgPathD) {
      delta.svgPathMorph = (fromSnap.svgPathD || "").slice(0, 80) + "... -> " + toSnap.svgPathD.slice(0, 80) + "...";
    }
    if (toSnap.videoTime !== fromSnap.videoTime && toSnap.videoTime !== null) {
      delta.videoCurrentTime = fromSnap.videoTime + "s -> " + toSnap.videoTime + "s";
    }
    if (customVarsChanged(fromSnap.customVars, toSnap.customVars)) {
      delta.cssCustomProperties = { from: fromSnap.customVars, to: toSnap.customVars };
    }
    return delta;
  }

  function pearsonCorrelation(xs, ys) {
    var n = xs.length;
    if (n < 5 || ys.length !== n) return 0;
    var sumX = 0, sumY = 0;
    for (var i = 0; i < n; i++) {
      sumX += xs[i];
      sumY += ys[i];
    }
    var meanX = sumX / n;
    var meanY = sumY / n;
    var num = 0, denX = 0, denY = 0;
    for (var j = 0; j < n; j++) {
      var dx = xs[j] - meanX;
      var dy = ys[j] - meanY;
      num += dx * dy;
      denX += dx * dx;
      denY += dy * dy;
    }
    if (denX < 1e-9 || denY < 1e-9) return 0;
    return num / Math.sqrt(denX * denY);
  }

  // CRITICAL V3 UPGRADE: Non-Monotonic Binned Variance Explained (Piecewise R^2)
  // Detects bell-curves (0->1->0), multi-stage pinned plateaus, sine waves, and multi-section handoffs where linear Pearson r == 0!
  function computeNonLinearScrollR2(scrollXs, valYs) {
    var n = scrollXs.length;
    if (n < 6 || valYs.length !== n) return 0;

    var minX = Infinity, maxX = -Infinity;
    var sumY = 0;
    for (var i = 0; i < n; i++) {
      if (scrollXs[i] < minX) minX = scrollXs[i];
      if (scrollXs[i] > maxX) maxX = scrollXs[i];
      sumY += valYs[i];
    }
    var spanX = maxX - minX;
    if (spanX < 1e-5) return 0;

    var meanY = sumY / n;
    var totalSS = 0;
    for (var j = 0; j < n; j++) {
      var d = valYs[j] - meanY;
      totalSS += d * d;
    }
    if (totalSS < 1e-9) return 0;

    var binCount = Math.min(16, Math.max(4, Math.floor(n / 3)));
    var bins = [];
    for (var b = 0; b < binCount; b++) bins.push([]);

    for (var k = 0; k < n; k++) {
      var bi = Math.min(binCount - 1, Math.floor(((scrollXs[k] - minX) / spanX) * binCount));
      bins[bi].push(valYs[k]);
    }

    var withinBinSS = 0;
    var populatedBins = 0;
    for (var m = 0; m < binCount; m++) {
      var arr = bins[m];
      if (arr.length === 0) continue;
      populatedBins++;
      var bMean = 0;
      for (var q = 0; q < arr.length; q++) bMean += arr[q];
      bMean /= arr.length;
      for (var r = 0; r < arr.length; r++) {
        var bd = arr[r] - bMean;
        withinBinSS += bd * bd;
      }
    }

    // Require trajectory to span at least 3 distinct scroll bins so pure time animations at static scroll don't false-positive
    if (populatedBins < 3) return 0;
    return clamp(1 - withinBinSS / totalSS, 0, 1);
  }

  // Segment a scroll-scrubbed trajectory into human & LLM readable Phases (e.g. Enter -> Hold/Pin -> Exit)
  function extractPiecewiseScrollPhases(keyframes, primaryChan) {
    if (!keyframes || keyframes.length < 3 || !primaryChan) return [];
    var phases = [];
    var defaultVal = primaryChan === "scaleX" || primaryChan === "scaleY" || primaryChan === "opacity" ? 1 : 0;
    var vals = keyframes.map(function (kf) {
      return kf[primaryChan] !== undefined ? kf[primaryChan] : defaultVal;
    });
    var totalSpan = Math.max.apply(null, vals) - Math.min.apply(null, vals);
    if (totalSpan < 1e-4) return [];

    var curStartIdx = 0;
    var curKind = null;

    function classifySegment(v0, v1) {
      var delta = v1 - v0;
      if (Math.abs(delta) < totalSpan * 0.05) return "hold-plateau";
      return delta > 0 ? "ramp-up" : "ramp-down";
    }

    function pushPhase(startIdx, endIdx, kind) {
      var pStart = keyframes[startIdx].scrollProgressPercent;
      var pEnd = keyframes[endIdx].scrollProgressPercent;
      if (pStart === pEnd && Math.abs(vals[endIdx] - vals[startIdx]) < totalSpan * 0.03) return;
      phases.push({
        window: pStart + " -> " + pEnd,
        behavior: kind,
        channel: primaryChan,
        from: round(vals[startIdx], 3),
        to: round(vals[endIdx], 3)
      });
    }

    for (var i = 1; i < keyframes.length; i++) {
      var segKind = classifySegment(vals[i - 1], vals[i]);
      if (curKind === null) {
        curKind = segKind;
      } else if (segKind !== curKind) {
        pushPhase(curStartIdx, i - 1, curKind);
        curStartIdx = i - 1;
        curKind = segKind;
      }
    }
    if (curKind !== null) {
      pushPhase(curStartIdx, keyframes.length - 1, curKind);
    }
    return phases;
  }

  function analyzeCurvePhysics(samples, propKey) {
    if (!samples || samples.length < 4) {
      return {
        type: "instant-or-short",
        durationMs: samples && samples.length > 1 ? round(samples[samples.length - 1].t - samples[0].t, 0) : 0
      };
    }
    var firstVal = samples[0][propKey];
    var lastVal = samples[samples.length - 1][propKey];
    var totalDelta = lastVal - firstVal;
    var durationMs = round(samples[samples.length - 1].t - samples[0].t, 0);

    if (Math.abs(totalDelta) < 0.001) {
      var maxExcursion = 0;
      for (var k = 0; k < samples.length; k++) {
        maxExcursion = Math.max(maxExcursion, Math.abs(samples[k][propKey] - firstVal));
      }
      return {
        type: maxExcursion > 0.05 ? "bell-curve-or-return" : "static",
        durationMs: durationMs,
        peakExcursion: round(maxExcursion, 3)
      };
    }

    var maxNorm = 0;
    var tHalf = null;
    var t0 = samples[0].t;
    var spanT = Math.max(1, samples[samples.length - 1].t - t0);

    for (var i = 0; i < samples.length; i++) {
      var norm = (samples[i][propKey] - firstVal) / totalDelta;
      if (norm > maxNorm) maxNorm = norm;
      if (tHalf === null && norm >= 0.5) {
        tHalf = (samples[i].t - t0) / spanT;
      }
    }

    if (maxNorm > 1.035) {
      var overshootRatio = maxNorm - 1;
      var lnMp = Math.log(clamp(overshootRatio, 0.005, 0.85));
      var zeta = clamp(-lnMp / Math.sqrt(Math.PI * Math.PI + lnMp * lnMp), 0.18, 0.92);
      var omegaN = 4.0 / (zeta * Math.max(0.15, durationMs / 1000));
      var stiffness = round(clamp(omegaN * omegaN, 60, 600), 0);
      var damping = round(clamp(2 * zeta * omegaN, 8, 60), 1);
      return {
        type: "spring",
        durationMs: durationMs,
        overshootPercent: round(overshootRatio * 100, 1),
        estimatedSpring: { stiffness: stiffness, damping: damping, mass: 1 },
        cssFallbackBezier: "cubic-bezier(0.34, " + round(1 + Math.min(0.65, overshootRatio * 2.2), 2) + ", 0.64, 1)"
      };
    }

    var easing = "cubic-bezier(0.22, 1, 0.36, 1)";
    if (tHalf !== null) {
      if (tHalf < 0.22) easing = "cubic-bezier(0.16, 1, 0.3, 1)";
      else if (tHalf < 0.36) easing = "cubic-bezier(0.25, 1, 0.5, 1)";
      else if (tHalf >= 0.36 && tHalf <= 0.58) easing = "cubic-bezier(0.4, 0, 0.2, 1)";
      else easing = "cubic-bezier(0.55, 0.05, 0.68, 0.19)";
    }

    return {
      type: "tween",
      durationMs: durationMs,
      estimatedBezier: easing
    };
  }

  function findAncestorScroller(el) {
    var curr = el ? el.parentElement : null;
    while (curr && curr !== document.body && curr !== document.documentElement) {
      try {
        var cs = getComputedStyle(curr);
        if (
          (cs.overflowY === "auto" || cs.overflowY === "scroll" || cs.overflowY === "overlay") &&
          curr.scrollHeight > curr.clientHeight + 8
        ) {
          return curr;
        }
      } catch (_) {}
      curr = curr.parentElement;
    }
    return null;
  }

  function findInnerScrollers(roots) {
    var list = [];
    for (var r = 0; r < roots.length; r++) {
      var all = [roots[r]].concat(Array.prototype.slice.call(roots[r].querySelectorAll("*"), 0, 260));
      for (var i = 0; i < all.length; i++) {
        var el = all[i];
        try {
          var cs = getComputedStyle(el);
          var vert = (cs.overflowY === "auto" || cs.overflowY === "scroll") && el.scrollHeight > el.clientHeight + 8;
          var horiz = (cs.overflowX === "auto" || cs.overflowX === "scroll") && el.scrollWidth > el.clientWidth + 8;
          if (vert || horiz) {
            list.push(el);
            if (list.length >= 6) return list;
          }
        } catch (_) {}
      }
    }
    return list;
  }

  function containsInAny(node, containers) {
    if (!node || node.nodeType !== 1) return false;
    for (var i = 0; i < containers.length; i++) {
      if (containers[i] === node || containers[i].contains(node)) return true;
    }
    return false;
  }

  function resolveInteractiveNode(node, roots) {
    if (!node || node.nodeType !== 1 || !containsInAny(node, roots)) return null;
    var curr = node;
    while (curr && curr !== document.body) {
      if (roots.indexOf(curr) !== -1) break;
      var tag = curr.tagName;
      if (
        tag === "A" ||
        tag === "BUTTON" ||
        tag === "LI" ||
        tag === "SUMMARY" ||
        tag === "ARTICLE" ||
        curr.hasAttribute("role") ||
        curr.hasAttribute("tabindex") ||
        curr.hasAttribute("data-state") ||
        curr.hasAttribute("data-w-id")
      ) {
        return curr;
      }
      try {
        if (getComputedStyle(curr).cursor === "pointer") return curr;
      } catch (_) {}
      curr = curr.parentElement;
    }
    return node;
  }

  function createRecorder(rootsInput, options) {
    options = options || {};
    var onStatusUpdate = typeof options.onStatusUpdate === "function" ? options.onStatusUpdate : function () {};

    var extractor = NS.Extractor;
    var graphEngine = NS.CrossSectionGraph;

    var selectedRoots = extractor.normalizeRoots(rootsInput);
    var linkedPortals = options.autoLinkPortals !== false ? graphEngine.discoverLinkedPortalCandidates(selectedRoots) : [];
    var allScopeRoots = selectedRoots.concat(linkedPortals);

    extractor.tagSubtrees(selectedRoots, linkedPortals);
    var splitTextMeta = extractor.detectSplitTextGroups(allScopeRoots);
    var redundantGlyphIds = splitTextMeta.redundantGlyphEmIds;

    var globalBridgeMonitor = graphEngine.createGlobalBridgeMonitor(selectedRoots, linkedPortals);

    var isRecording = false;
    var rafId = null;
    var startTime = 0;
    var frameCount = 0;
    var fpsEstimate = 60;
    var lastFrameTime = 0;

    var ancestorScroller = findAncestorScroller(selectedRoots[0]);
    var innerScrollers = findInnerScrollers(selectedRoots);
    var activeInnerScroller = innerScrollers[0] || null;

    var virtualWheelAccumY = 0;
    var minWheelY = 0;
    var maxWheelY = 0;
    var wheelEventsCount = 0;
    var scrollEventsCount = 0;

    var minWindowScrollY = window.scrollY;
    var maxWindowScrollY = window.scrollY;

    var scrollHistory = [];
    var minScrollProg = 1;
    var maxScrollProg = 0;
    var lastScrollMetricY = window.scrollY;
    var lastScrollVelocity = 0;
    var scrollDirection = "idle";
    var lastScrollActivityTime = -9999;

    // Expanded 240-element 60fps tracker (SplitText glyphs deduplicated so real elements never starve!)
    var MAX_ACTIVE_ELEMENTS = 240;
    var activeElements = new Map();
    var baselineSnapshots = new Map();
    var lastSnapshots = new Map();
    var elementTrajectories = new Map();
    var waapiCaptured = new Map();

    var currentHoverEl = null;
    var currentHoverSession = null;
    var hoverSessions = [];
    var pointerSamples = [];
    var lastPointer = { normX: 0, normY: 0, inside: false, clientX: 0, clientY: 0 };

    var interactionEvents = [];
    var mutationLog = [];
    var mutationObserver = null;

    // Compute combined master scroll progress across ALL selected sections!
    function computeMasterBounds() {
      var vh = Math.max(1, window.innerHeight);
      var minTop = Infinity;
      var maxBottom = -Infinity;
      for (var i = 0; i < selectedRoots.length; i++) {
        var r = selectedRoots[i].getBoundingClientRect();
        if (r.top < minTop) minTop = r.top;
        if (r.bottom > maxBottom) maxBottom = r.bottom;
      }
      var combinedHeight = Math.max(1, maxBottom - minTop);
      return {
        top: minTop,
        height: combinedHeight,
        vh: vh
      };
    }

    function computeCurrentScrollMetrics() {
      var b = computeMasterBounds();
      var vh = b.vh;

      var viewportProgress = clamp((vh - b.top) / Math.max(1, vh + b.height), 0, 1);
      var isStickyPinCandidate = b.height > vh * 1.18;
      var stickyPinProgress = isStickyPinCandidate ? clamp(-b.top / Math.max(1, b.height - vh), 0, 1) : viewportProgress;

      var ancestorProgress = null;
      if (ancestorScroller) {
        var maxAnc = Math.max(1, ancestorScroller.scrollHeight - ancestorScroller.clientHeight);
        ancestorProgress = clamp(ancestorScroller.scrollTop / maxAnc, 0, 1);
      }

      var innerProgress = null;
      if (activeInnerScroller) {
        var maxInnerY = activeInnerScroller.scrollHeight - activeInnerScroller.clientHeight;
        var maxInnerX = activeInnerScroller.scrollWidth - activeInnerScroller.clientWidth;
        if (maxInnerY > 4) innerProgress = clamp(activeInnerScroller.scrollTop / maxInnerY, 0, 1);
        else if (maxInnerX > 4) innerProgress = clamp(activeInnerScroller.scrollLeft / maxInnerX, 0, 1);
      }

      var primarySource = "window-viewport";
      var primaryProgress = viewportProgress;

      if (innerProgress !== null && activeInnerScroller && (activeInnerScroller.scrollTop > 0 || activeInnerScroller.scrollLeft > 0)) {
        primarySource = "inner-scroll-container";
        primaryProgress = innerProgress;
      } else if (isStickyPinCandidate) {
        primarySource = selectedRoots.length > 1 ? "multi-section-master-timeline" : "sticky-pin-section";
        primaryProgress = stickyPinProgress;
      } else if (ancestorProgress !== null) {
        primarySource = "ancestor-scroll-container";
        primaryProgress = ancestorProgress;
      }

      return {
        primarySource: primarySource,
        primaryProgress: round(primaryProgress, 4),
        viewportProgress: round(viewportProgress, 4),
        stickyPinProgress: round(stickyPinProgress, 4),
        innerProgress: innerProgress !== null ? round(innerProgress, 4) : null,
        windowScrollY: round(window.scrollY, 1),
        virtualWheelY: round(virtualWheelAccumY, 1),
        targetTop: round(b.top, 1),
        targetHeight: round(b.height, 1)
      };
    }

    function promoteElement(el, includeRelatives) {
      if (!el || el.nodeType !== 1 || !containsInAny(el, allScopeRoots)) return;
      if (el.id === "__exactmotion-host" || (el.closest && el.closest("#__exactmotion-host"))) return;
      var emId = el.getAttribute("data-em-id");
      if (!emId || redundantGlyphIds.has(emId)) return;

      if (!activeElements.has(emId) && activeElements.size < MAX_ACTIVE_ELEMENTS) {
        activeElements.set(emId, el);
        try {
          var snap = snapshotVisualProps(el);
          if (!baselineSnapshots.has(emId)) baselineSnapshots.set(emId, snap);
          lastSnapshots.set(emId, snap);
          elementTrajectories.set(emId, [
            {
              t: round(performance.now() - startTime, 1),
              scrollP: computeCurrentScrollMetrics().primaryProgress,
              wheelY: virtualWheelAccumY,
              hoverActive: Boolean(currentHoverEl && (currentHoverEl === el || currentHoverEl.contains(el))),
              ptrX: lastPointer.normX,
              ptrY: lastPointer.normY,
              snap: snap
            }
          ]);
        } catch (_) {}
      }

      if (includeRelatives) {
        var kids = el.children || [];
        for (var i = 0; i < Math.min(kids.length, 10); i++) {
          promoteElement(kids[i], false);
        }
        if (el.parentElement && containsInAny(el.parentElement, allScopeRoots)) {
          promoteElement(el.parentElement, false);
        }
      }
    }

    function seedInitialCandidates() {
      for (var r = 0; r < allScopeRoots.length; r++) {
        var rootNode = allScopeRoots[r];
        promoteElement(rootNode, true);
        var all = rootNode.querySelectorAll("[data-em-id]");
        for (var i = 0; i < all.length && activeElements.size < MAX_ACTIVE_ELEMENTS - 25; i++) {
          var el = all[i];
          var emId = el.getAttribute("data-em-id");
          if (redundantGlyphIds.has(emId)) continue;

          var inlineSt = el.getAttribute("style") || "";
          var shouldTrack = false;
          if (
            inlineSt.indexOf("transform") !== -1 ||
            inlineSt.indexOf("opacity") !== -1 ||
            inlineSt.indexOf("clip-path") !== -1 ||
            inlineSt.indexOf("--") !== -1 ||
            el._gsap ||
            el.hasAttribute("data-w-id") ||
            el.hasAttribute("data-framer-appear-id") ||
            el.hasAttribute("data-projection-id") ||
            el.hasAttribute("data-scroll") ||
            el.hasAttribute("data-speed") ||
            el.tagName === "CANVAS" ||
            el.tagName === "VIDEO" ||
            el.tagName === "path" ||
            el.tagName === "SVG" ||
            el.tagName === "LI" ||
            el.tagName === "ARTICLE" ||
            el.tagName === "BUTTON" ||
            el.tagName === "A" ||
            el.tagName === "H1" ||
            el.tagName === "H2" ||
            el.tagName === "H3" ||
            el.tagName === "IMG"
          ) {
            shouldTrack = true;
          } else {
            try {
              var cs = getComputedStyle(el);
              if (
                cs.position === "sticky" ||
                cs.position === "fixed" ||
                cs.transform !== "none" ||
                cs.willChange.indexOf("transform") !== -1 ||
                cs.willChange.indexOf("opacity") !== -1 ||
                (cs.transitionDuration && cs.transitionDuration !== "0s") ||
                (cs.animationName && cs.animationName !== "none")
              ) {
                shouldTrack = true;
              }
            } catch (_) {}
          }
          if (shouldTrack) {
            promoteElement(el, false);
          }
        }
      }
    }

    // Dynamically link an additional section during live recording!
    function addLinkedSection(newSectionEl) {
      if (!newSectionEl || newSectionEl.nodeType !== 1) return false;
      if (selectedRoots.indexOf(newSectionEl) !== -1) return false;
      selectedRoots.push(newSectionEl);
      selectedRoots = extractor.normalizeRoots(selectedRoots);
      linkedPortals = graphEngine.discoverLinkedPortalCandidates(selectedRoots);
      allScopeRoots = selectedRoots.concat(linkedPortals);
      extractor.tagSubtrees(selectedRoots, linkedPortals);
      splitTextMeta = extractor.detectSplitTextGroups(allScopeRoots);
      redundantGlyphIds = splitTextMeta.redundantGlyphEmIds;
      seedInitialCandidates();
      return true;
    }

    function collectWAAPI(triggerLabel) {
      for (var r = 0; r < allScopeRoots.length; r++) {
        var scopeEl = allScopeRoots[r];
        if (typeof scopeEl.getAnimations !== "function") continue;
        try {
          var anims = scopeEl.getAnimations({ subtree: true });
          for (var i = 0; i < anims.length; i++) {
            var anim = anims[i];
            var effect = anim.effect;
            if (!effect || typeof effect.getKeyframes !== "function") continue;
            var targetEl = effect.target;
            if (!targetEl || targetEl.nodeType !== 1) continue;
            var emId = targetEl.getAttribute("data-em-id") || "root";
            if (redundantGlyphIds.has(emId)) continue;
            var animName = anim.animationName || anim.id || "waapi";
            var timing = typeof effect.getComputedTiming === "function" ? effect.getComputedTiming() : {};
            var key = emId + "::" + animName + "::" + (timing.duration || 0);

            if (!waapiCaptured.has(key) && waapiCaptured.size < 65) {
              var rawKf = effect.getKeyframes().slice(0, 12).map(function (kf) {
                var clean = {};
                Object.keys(kf).forEach(function (prop) {
                  if (prop === "computedOffset" && kf.offset !== null) return;
                  if (kf[prop] !== undefined && kf[prop] !== null && kf[prop] !== "") clean[prop] = kf[prop];
                });
                return clean;
              });

              waapiCaptured.set(key, {
                targetSelector: extractor.describeElement(targetEl),
                emId: emId,
                type: anim.animationName
                  ? "CSS @keyframes (" + anim.animationName + ")"
                  : anim.transitionProperty
                  ? "CSS Transition (" + anim.transitionProperty + ")"
                  : "Web Animations API",
                capturedDuring: triggerLabel,
                timing: {
                  duration: timing.duration,
                  delay: timing.delay || 0,
                  easing: timing.easing || "linear",
                  iterations: timing.iterations === Infinity ? "infinite" : timing.iterations || 1,
                  direction: timing.direction || "normal",
                  fill: timing.fill || "none"
                },
                keyframes: rawKf
              });
            }
          }
        } catch (_) {}
      }
    }

    function onAnyScroll(ev) {
      if (!isRecording) return;
      lastScrollActivityTime = performance.now() - startTime;
      scrollEventsCount++;
      if (window.scrollY < minWindowScrollY) minWindowScrollY = window.scrollY;
      if (window.scrollY > maxWindowScrollY) maxWindowScrollY = window.scrollY;

      var scTarget = ev.target;
      if (scTarget && scTarget.nodeType === 1 && containsInAny(scTarget, selectedRoots)) {
        if (scTarget.scrollHeight > scTarget.clientHeight + 4 || scTarget.scrollWidth > scTarget.clientWidth + 4) {
          activeInnerScroller = scTarget;
        }
      }
      collectWAAPI("scroll");
    }

    function onWheel(ev) {
      if (!isRecording) return;
      if (ev.target && ev.target.closest && ev.target.closest("#__exactmotion-host")) return;
      lastScrollActivityTime = performance.now() - startTime;
      wheelEventsCount++;
      virtualWheelAccumY += ev.deltaY || 0;
      if (virtualWheelAccumY < minWheelY) minWheelY = virtualWheelAccumY;
      if (virtualWheelAccumY > maxWheelY) maxWheelY = virtualWheelAccumY;

      if (ev.target && ev.target.nodeType === 1 && containsInAny(ev.target, allScopeRoots)) {
        promoteElement(ev.target, true);
      }
      collectWAAPI("wheel");
    }

    function sampleActiveHoverPeak(session) {
      if (!session || !session.el || !session.el.isConnected) return;
      try {
        var curSnap = snapshotVisualProps(session.el);
        var curScore = diffMagnitude(session.enterBaseline, curSnap);
        if (curScore >= (session.peakScore || 0)) {
          session.peakScore = curScore;
          session.peakSnapshot = curSnap;
        }
        for (var i = 0; i < session.childBaselines.length; i++) {
          var cb = session.childBaselines[i];
          if (!cb.el || !cb.el.isConnected) continue;
          var cSnap = snapshotVisualProps(cb.el);
          var cScore = diffMagnitude(cb.snap, cSnap);
          if (cScore > (cb.peakScore || 0)) {
            cb.peakScore = cScore;
            cb.peakSnap = cSnap;
          }
        }
      } catch (_) {}
    }

    function finalizeHoverSession(tExit) {
      if (!currentHoverSession) return;
      var closed = currentHoverSession;
      closed.tLeave = round(tExit, 1);

      var childChanges = [];
      for (var i = 0; i < closed.childBaselines.length; i++) {
        var cb = closed.childBaselines[i];
        if (cb.peakSnap && hasVisualDiff(cb.snap, cb.peakSnap)) {
          childChanges.push({
            selector: extractor.describeElement(cb.el),
            emId: cb.emId,
            deltas: summarizeDiff(cb.snap, cb.peakSnap),
            transitionCss: cb.peakSnap.transition
          });
        }
      }
      closed.childCascades = childChanges;

      setTimeout(function () {
        try {
          if (closed.el && closed.el.isConnected && currentHoverEl !== closed.el) {
            var restSnap = snapshotVisualProps(closed.el);
            if (diffMagnitude(restSnap, closed.peakSnapshot) > diffMagnitude(closed.enterBaseline, closed.peakSnapshot)) {
              closed.enterBaseline = restSnap;
            }
          }
        } catch (_) {}
      }, 260);

      hoverSessions.push(closed);
      currentHoverSession = null;
    }

    function onPointerOver(ev) {
      if (!isRecording) return;
      var raw = ev.target;
      if (!raw || raw.nodeType !== 1) return;
      if (raw.id === "__exactmotion-host" || (raw.closest && raw.closest("#__exactmotion-host"))) return;
      if (!containsInAny(raw, selectedRoots)) return;

      var resolved = resolveInteractiveNode(raw, selectedRoots);
      if (!resolved || resolved === currentHoverEl) return;

      var tNow = performance.now() - startTime;
      if (currentHoverSession) finalizeHoverSession(tNow);

      currentHoverEl = resolved;
      var resEmId = resolved.getAttribute("data-em-id");
      var preBase = resEmId ? baselineSnapshots.get(resEmId) : null;
      promoteElement(resolved, true);

      var childBaselines = [];
      var descendants = resolved.querySelectorAll("[data-em-id]");
      for (var i = 0; i < Math.min(descendants.length, 16); i++) {
        var child = descendants[i];
        var cId = child.getAttribute("data-em-id");
        if (redundantGlyphIds.has(cId)) continue;
        var preChildBase = cId ? baselineSnapshots.get(cId) : null;
        promoteElement(child, false);
        try {
          childBaselines.push({
            el: child,
            emId: cId,
            snap: preChildBase || snapshotVisualProps(child),
            peakSnap: null,
            peakScore: 0
          });
        } catch (_) {}
      }

      var baseSnap = preBase;
      try {
        if (!baseSnap) baseSnap = snapshotVisualProps(resolved);
      } catch (_) {}

      var sessionRef = {
        el: resolved,
        emId: resEmId,
        selector: extractor.describeElement(resolved),
        label: (resolved.textContent || "").trim().replace(/\s+/g, " ").slice(0, 48),
        tEnter: round(tNow, 1),
        tLeave: null,
        enterBaseline: baseSnap,
        peakSnapshot: baseSnap,
        peakScore: 0,
        childBaselines: childBaselines,
        childCascades: []
      };
      currentHoverSession = sessionRef;

      sampleActiveHoverPeak(sessionRef);
      setTimeout(function () {
        if (isRecording && currentHoverSession === sessionRef) {
          sampleActiveHoverPeak(sessionRef);
          collectWAAPI("hover:" + sessionRef.selector);
        }
      }, 45);
      setTimeout(function () {
        if (isRecording && currentHoverSession === sessionRef) {
          sampleActiveHoverPeak(sessionRef);
        }
      }, 220);
    }

    function onPointerOut(ev) {
      if (!isRecording || !currentHoverEl) return;
      var related = ev.relatedTarget;
      if (related && currentHoverEl.contains(related)) return;
      finalizeHoverSession(performance.now() - startTime);
      currentHoverEl = null;
      setTimeout(function () {
        if (isRecording) collectWAAPI("hover-leave");
      }, 35);
    }

    function onPointerMove(ev) {
      if (!isRecording) return;
      if (ev.target && ev.target.closest && ev.target.closest("#__exactmotion-host")) return;

      var primaryRoot = selectedRoots[0];
      if (!primaryRoot) return;
      var rootRect = primaryRoot.getBoundingClientRect();
      var inside = containsInAny(ev.target, selectedRoots);

      var normX = rootRect.width > 0 ? clamp(((ev.clientX - rootRect.left) / rootRect.width) * 2 - 1, -1, 1) : 0;
      var normY = rootRect.height > 0 ? clamp(((ev.clientY - rootRect.top) / rootRect.height) * 2 - 1, -1, 1) : 0;

      lastPointer = {
        normX: round(normX, 3),
        normY: round(normY, 3),
        inside: inside,
        clientX: round(ev.clientX, 1),
        clientY: round(ev.clientY, 1)
      };

      if (inside && pointerSamples.length < 500) {
        var hoverTarget = currentHoverEl || primaryRoot;
        var localRect = hoverTarget.getBoundingClientRect();
        var localNormX = localRect.width > 0 ? clamp(((ev.clientX - localRect.left) / localRect.width) * 2 - 1, -1, 1) : normX;
        var localNormY = localRect.height > 0 ? clamp(((ev.clientY - localRect.top) / localRect.height) * 2 - 1, -1, 1) : normY;

        var customPointerVars = {};
        var inlineStyle = hoverTarget.style;
        if (inlineStyle && inlineStyle.length > 0) {
          for (var s = 0; s < inlineStyle.length; s++) {
            var p = inlineStyle[s];
            if (p.indexOf("--") === 0 && /x|y|mouse|cursor|spot|angle|rot|tilt/i.test(p)) {
              customPointerVars[p] = inlineStyle.getPropertyValue(p).trim();
            }
          }
        }

        pointerSamples.push({
          t: round(performance.now() - startTime, 1),
          emId: hoverTarget.getAttribute("data-em-id") || "em-0",
          localX: round(localNormX, 3),
          localY: round(localNormY, 3),
          snap: snapshotVisualProps(hoverTarget),
          cssVars: customPointerVars
        });
      }
    }

    function onClick(ev) {
      if (!isRecording) return;
      var raw = ev.target;
      if (!raw || raw.nodeType !== 1) return;
      if (raw.id === "__exactmotion-host" || (raw.closest && raw.closest("#__exactmotion-host"))) return;
      if (!containsInAny(raw, selectedRoots)) return;

      var resolved = resolveInteractiveNode(raw, selectedRoots) || raw;
      promoteElement(resolved, true);
      var tNow = round(performance.now() - startTime, 1);

      interactionEvents.push({
        type: "click",
        t: tNow,
        emId: resolved.getAttribute("data-em-id"),
        selector: extractor.describeElement(resolved),
        label: (resolved.textContent || "").trim().replace(/\s+/g, " ").slice(0, 48)
      });

      setTimeout(function () {
        if (isRecording) collectWAAPI("click:" + extractor.describeElement(resolved));
      }, 45);
    }

    function setupMutationObserver() {
      mutationObserver = new MutationObserver(function (mutations) {
        if (!isRecording) return;
        var tNow = round(performance.now() - startTime, 1);
        for (var i = 0; i < mutations.length; i++) {
          var m = mutations[i];
          var el = m.target;
          if (!el || el.nodeType !== 1) continue;
          if (el.id === "__exactmotion-host" || (el.closest && el.closest("#__exactmotion-host"))) continue;

          promoteElement(el, false);

          if (m.type === "attributes" && m.attributeName !== "style" && m.attributeName !== "data-em-id") {
            if (mutationLog.length < 150) {
              mutationLog.push({
                t: tNow,
                emId: el.getAttribute("data-em-id"),
                selector: extractor.describeElement(el),
                attribute: m.attributeName,
                oldValue: m.oldValue,
                newValue: el.getAttribute(m.attributeName)
              });
            }
          } else if (m.type === "childList" && (m.addedNodes.length > 0 || m.removedNodes.length > 0)) {
            for (var a = 0; a < m.addedNodes.length; a++) {
              var added = m.addedNodes[a];
              if (added && added.nodeType === 1) {
                if (!added.hasAttribute("data-em-id")) {
                  added.setAttribute("data-em-id", "em-dyn-" + mutationLog.length + "-" + a);
                }
                promoteElement(added, true);
              }
            }
            if (mutationLog.length < 150) {
              mutationLog.push({
                t: tNow,
                emId: el.getAttribute("data-em-id"),
                selector: extractor.describeElement(el),
                childListChange: "+" + m.addedNodes.length + " / -" + m.removedNodes.length
              });
            }
          }
        }
      });

      allScopeRoots.forEach(function (rt) {
        mutationObserver.observe(rt, {
          subtree: true,
          childList: true,
          attributes: true,
          attributeOldValue: true,
          attributeFilter: [
            "style",
            "class",
            "d",
            "data-state",
            "data-active",
            "data-open",
            "aria-expanded",
            "aria-selected",
            "aria-hidden",
            "open",
            "hidden"
          ]
        });
      });
    }

    function tick(now) {
      if (!isRecording) return;
      var elapsed = now - startTime;
      frameCount++;

      if (lastFrameTime > 0) {
        var dt = now - lastFrameTime;
        if (dt > 0) fpsEstimate = round(fpsEstimate * 0.9 + (1000 / dt) * 0.1, 0);
      }
      var dtSec = lastFrameTime > 0 ? Math.max(0.001, (now - lastFrameTime) / 1000) : 0.016;
      lastFrameTime = now;

      var sc = computeCurrentScrollMetrics();
      var dyScroll = sc.windowScrollY - lastScrollMetricY;
      lastScrollMetricY = sc.windowScrollY;
      lastScrollVelocity = round(dyScroll / dtSec, 0);
      if (Math.abs(dyScroll) > 0.4) {
        scrollDirection = dyScroll > 0 ? "down" : "up";
      } else if (elapsed - lastScrollActivityTime > 220) {
        scrollDirection = "idle";
      }

      if (sc.primaryProgress < minScrollProg) minScrollProg = sc.primaryProgress;
      if (sc.primaryProgress > maxScrollProg) maxScrollProg = sc.primaryProgress;

      globalBridgeMonitor.checkThemeDiff(sc.primaryProgress);

      if (
        scrollHistory.length === 0 ||
        Math.abs(scrollHistory[scrollHistory.length - 1].primaryProgress - sc.primaryProgress) > 0.0025 ||
        Math.abs(scrollHistory[scrollHistory.length - 1].virtualWheelY - sc.virtualWheelY) > 2
      ) {
        if (scrollHistory.length < 800) {
          scrollHistory.push({
            t: round(elapsed, 1),
            primaryProgress: sc.primaryProgress,
            viewportProgress: sc.viewportProgress,
            stickyPinProgress: sc.stickyPinProgress,
            innerProgress: sc.innerProgress,
            virtualWheelY: sc.virtualWheelY,
            velocity: lastScrollVelocity,
            direction: scrollDirection
          });
        }
      }

      activeElements.forEach(function (el, emId) {
        if (!el.isConnected) return;
        var snap;
        try {
          snap = snapshotVisualProps(el);
        } catch (_) {
          return;
        }
        var prev = lastSnapshots.get(emId);
        if (!prev || hasVisualDiff(prev, snap)) {
          lastSnapshots.set(emId, snap);
          var traj = elementTrajectories.get(emId);
          if (traj && traj.length < 650) {
            traj.push({
              t: round(elapsed, 1),
              scrollP: sc.primaryProgress,
              viewportP: sc.viewportProgress,
              stickyP: sc.stickyPinProgress,
              innerP: sc.innerProgress,
              wheelY: sc.virtualWheelY,
              hoverActive: Boolean(currentHoverEl && (currentHoverEl === el || currentHoverEl.contains(el))),
              ptrX: lastPointer.normX,
              ptrY: lastPointer.normY,
              snap: snap
            });
          }
        }
      });

      if (currentHoverSession) sampleActiveHoverPeak(currentHoverSession);

      if (frameCount % 6 === 0) {
        var animatedCount = 0;
        elementTrajectories.forEach(function (traj) {
          if (traj.length > 1) animatedCount++;
        });
        onStatusUpdate({
          elapsedSec: round(elapsed / 1000, 1),
          fps: clamp(fpsEstimate, 15, 144),
          sectionCount: selectedRoots.length,
          portalCount: linkedPortals.length,
          scrollProgress: sc.primaryProgress,
          scrollMin: minScrollProg === 1 ? sc.primaryProgress : minScrollProg,
          scrollMax: maxScrollProg === 0 ? sc.primaryProgress : maxScrollProg,
          scrollDirection: scrollDirection,
          scrollSource: sc.primarySource,
          wheelEvents: wheelEventsCount,
          hoverCount: hoverSessions.length + (currentHoverSession ? 1 : 0),
          clickCount: interactionEvents.length,
          animatedNodes: animatedCount,
          trackedNodes: activeElements.size
        });
      }

      rafId = requestAnimationFrame(tick);
    }

    function compileMotionIntelligence() {
      if (currentHoverSession) finalizeHoverSession(performance.now() - startTime);
      collectWAAPI("final");

      var crossSectionGraphReport = globalBridgeMonitor.stopAndCompile(minWindowScrollY, maxWindowScrollY);

      var scrollScrubAnimations = [];
      var scrollRevealAnimations = [];
      var svgMorphAndDrawAnimations = [];
      var videoScrubAnimations = [];
      var timeDrivenAnimations = [];

      var wheelRange = maxWheelY - minWheelY;
      var scrollSpan = Math.max(0, maxScrollProg - minScrollProg);

      elementTrajectories.forEach(function (traj, emId) {
        if (!traj || traj.length < 2) return;
        var el = activeElements.get(emId);
        if (!el) return;

        var firstSnap = traj[0].snap;
        var lastSnap = traj[traj.length - 1].snap;

        // Check SVG path morphing
        if (firstSnap.svgPathD && lastSnap.svgPathD && firstSnap.svgPathD !== lastSnap.svgPathD) {
          var midSnap = traj[Math.floor(traj.length / 2)].snap;
          svgMorphAndDrawAnimations.push({
            emId: emId,
            selector: extractor.describeElement(el),
            type: "SVG_PATH_MORPH",
            keyframes: [
              { scrollP: round(traj[0].scrollP, 3), d: firstSnap.svgPathD },
              { scrollP: round(traj[Math.floor(traj.length / 2)].scrollP, 3), d: midSnap.svgPathD },
              { scrollP: round(traj[traj.length - 1].scrollP, 3), d: lastSnap.svgPathD }
            ]
          });
        }

        // Check HTML5 Video scroll scrubbing
        if (firstSnap.videoTime !== null && lastSnap.videoTime !== null && Math.abs(lastSnap.videoTime - firstSnap.videoTime) > 0.15) {
          videoScrubAnimations.push({
            emId: emId,
            selector: extractor.describeElement(el),
            fromTimeSec: firstSnap.videoTime,
            toTimeSec: lastSnap.videoTime,
            fromScrollP: round(traj[0].scrollP, 3),
            toScrollP: round(traj[traj.length - 1].scrollP, 3)
          });
        }

        var numericChannels = [
          "tx",
          "ty",
          "tz",
          "scaleX",
          "scaleY",
          "rotateX",
          "rotateY",
          "rotateZ",
          "skewX",
          "opacity",
          "width",
          "height",
          "borderRadius",
          "clipMetric",
          "filterMetric",
          "dashMetric"
        ];
        var activeChannels = [];
        for (var c = 0; c < numericChannels.length; c++) {
          var ch = numericChannels[c];
          if ((ch === "width" || ch === "height") && activeChannels.some(function (x) { return x.name === "scaleX" || x.name === "scaleY"; })) {
            continue;
          }
          var lo = Infinity, hi = -Infinity;
          for (var s = 0; s < traj.length; s++) {
            var v = traj[s].snap[ch];
            if (v < lo) lo = v;
            if (v > hi) hi = v;
          }
          var threshold = ch === "scaleX" || ch === "scaleY" || ch === "opacity" ? 0.015 : ch === "width" || ch === "height" ? 4.0 : 0.8;
          if (hi - lo > threshold) {
            activeChannels.push({ name: ch, min: round(lo, 3), max: round(hi, 3), span: round(hi - lo, 3) });
          }
        }

        var styleChanges = summarizeDiff(firstSnap, lastSnap);
        if (activeChannels.length === 0 && Object.keys(styleChanges).length === 0) return;

        // V3 NON-MONOTONIC + LINEAR SCROLL DEPENDENCY SOLVER
        var bestScrollScore = 0;
        var isNonMonotonic = false;
        var scrollDriverType = "viewport-scroll";
        var primaryChan = activeChannels.length > 0 ? activeChannels[0].name : null;

        if (primaryChan && traj.length >= 5) {
          var vals = traj.map(function (pt) { return pt.snap[primaryChan]; });
          var scrollPs = traj.map(function (pt) { return pt.scrollP; });
          var wheelYs = traj.map(function (pt) { return pt.wheelY; });

          var rLinearScroll = Math.abs(pearsonCorrelation(scrollPs, vals));
          var r2NonLinearScroll = computeNonLinearScrollR2(scrollPs, vals);
          var effectiveScrollScore = Math.max(rLinearScroll, r2NonLinearScroll);

          if (r2NonLinearScroll > rLinearScroll + 0.18 && r2NonLinearScroll >= 0.68) {
            isNonMonotonic = true;
          }

          var rWheel = wheelRange > 30 ? Math.max(Math.abs(pearsonCorrelation(wheelYs, vals)), computeNonLinearScrollR2(wheelYs, vals)) : 0;

          if (rWheel > effectiveScrollScore && rWheel >= 0.68) {
            bestScrollScore = rWheel;
            scrollDriverType = "wheel-virtual-scroll";
          } else {
            bestScrollScore = effectiveScrollScore;
            scrollDriverType =
              scrollHistory.length > 0 && activeInnerScroller
                ? "inner-container-scroll"
                : selectedRoots.length > 1
                ? "multi-section-master-scroll"
                : "viewport-scroll";
          }
        }

        var mostlyHover = traj.filter(function (pt) { return pt.hoverActive; }).length > traj.length * 0.55;

        if (!mostlyHover && bestScrollScore >= 0.68 && (scrollSpan >= 0.05 || wheelRange > 36)) {
          var useWheel = scrollDriverType === "wheel-virtual-scroll";
          var pMin = useWheel ? minWheelY : minScrollProg;
          var pMax = useWheel ? maxWheelY : maxScrollProg;
          var pSpan = Math.max(0.0001, pMax - pMin);

          // High-resolution 13-stop Keyframe Table (catches multi-phase hold & bell-curve peaks accurately!)
          var stops = [0, 0.08, 0.17, 0.25, 0.33, 0.42, 0.5, 0.58, 0.67, 0.75, 0.83, 0.92, 1.0];
          var scrollKeyframes = [];
          for (var stIdx = 0; stIdx < stops.length; stIdx++) {
            var targetVal = pMin + stops[stIdx] * pSpan;
            var nearest = traj[0];
            var bestDist = Infinity;
            for (var ti = 0; ti < traj.length; ti++) {
              var curMetric = useWheel ? traj[ti].wheelY : traj[ti].scrollP;
              var dist = Math.abs(curMetric - targetVal);
              if (dist < bestDist) {
                bestDist = dist;
                nearest = traj[ti];
              }
            }
            var activeSet = {};
            for (var aci = 0; aci < activeChannels.length; aci++) {
              activeSet[activeChannels[aci].name] = true;
            }
            var kfEntry = {
              scrollProgressPercent: Math.round((useWheel ? stops[stIdx] : nearest.scrollP) * 100) + "%"
            };
            if (activeSet.tx || Math.abs(nearest.snap.tx) > 0.01) kfEntry.tx = nearest.snap.tx;
            if (activeSet.ty || Math.abs(nearest.snap.ty) > 0.01) kfEntry.ty = nearest.snap.ty;
            if (activeSet.tz || Math.abs(nearest.snap.tz) > 0.01) kfEntry.tz = nearest.snap.tz;
            if (activeSet.scaleX || Math.abs(nearest.snap.scaleX - 1) > 0.002) kfEntry.scaleX = nearest.snap.scaleX;
            if (activeSet.scaleY || Math.abs(nearest.snap.scaleY - 1) > 0.002) kfEntry.scaleY = nearest.snap.scaleY;
            if (activeSet.rotateX || Math.abs(nearest.snap.rotateX) > 0.05) kfEntry.rotateX = nearest.snap.rotateX;
            if (activeSet.rotateY || Math.abs(nearest.snap.rotateY) > 0.05) kfEntry.rotateY = nearest.snap.rotateY;
            if (activeSet.rotateZ || Math.abs(nearest.snap.rotateZ) > 0.05) kfEntry.rotateZ = nearest.snap.rotateZ;
            if (activeSet.skewX || Math.abs(nearest.snap.skewX) > 0.05) kfEntry.skewX = nearest.snap.skewX;
            if (activeSet.opacity || Math.abs(nearest.snap.opacity - 1) > 0.005) kfEntry.opacity = nearest.snap.opacity;
            if (nearest.snap.clipPath !== "none") kfEntry.clipPath = nearest.snap.clipPath;
            if (nearest.snap.filter !== "none") kfEntry.filter = nearest.snap.filter;
            if (nearest.snap.customVars) kfEntry.customVars = nearest.snap.customVars;
            if (activeSet.width) kfEntry.width = nearest.snap.width;
            if (activeSet.height) kfEntry.height = nearest.snap.height;
            if (activeSet.borderRadius) kfEntry.borderRadius = nearest.snap.borderRadius;
            scrollKeyframes.push(kfEntry);
          }

          var piecewisePhases = extractPiecewiseScrollPhases(scrollKeyframes, primaryChan);

          scrollScrubAnimations.push({
            emId: emId,
            selector: extractor.describeElement(el),
            isPortalLayer: Boolean(el.closest && el.closest('[data-em-portal="true"]')),
            driver: scrollDriverType,
            curveTopology: isNonMonotonic ? "multi-phase-non-monotonic" : "monotonic-scrub",
            dependencyScoreR2: round(bestScrollScore, 3),
            channels: activeChannels,
            phases: piecewisePhases,
            keyframesByScroll: scrollKeyframes
          });
        } else if (!mostlyHover && (scrollEventsCount > 0 || wheelEventsCount > 0) && traj[0].t > 120) {
          var curveSamples = primaryChan
            ? traj.map(function (pt) {
                var o = { t: pt.t };
                o[primaryChan] = pt.snap[primaryChan];
                return o;
              })
            : [];
          scrollRevealAnimations.push({
            emId: emId,
            selector: extractor.describeElement(el),
            triggerScrollProgress: round(traj[0].scrollP, 3),
            startTimeMs: traj[0].t,
            endTimeMs: traj[traj.length - 1].t,
            deltas: styleChanges,
            physics: primaryChan ? analyzeCurvePhysics(curveSamples, primaryChan) : { durationMs: round(traj[traj.length - 1].t - traj[0].t, 0) }
          });
        } else if (!mostlyHover) {
          var tSamples = primaryChan
            ? traj.map(function (pt) {
                var o2 = { t: pt.t };
                o2[primaryChan] = pt.snap[primaryChan];
                return o2;
              })
            : [];
          timeDrivenAnimations.push({
            emId: emId,
            selector: extractor.describeElement(el),
            startTimeMs: traj[0].t,
            endTimeMs: traj[traj.length - 1].t,
            sampleCount: traj.length,
            deltas: styleChanges,
            physics: primaryChan ? analyzeCurvePhysics(tSamples, primaryChan) : { durationMs: round(traj[traj.length - 1].t - traj[0].t, 0) }
          });
        }
      });

      // Sibling Stagger Detection (including SplitText first/middle/last glyph stagger estimation!)
      var staggerGroups = [];
      var revealPool = scrollRevealAnimations.concat(timeDrivenAnimations);
      if (revealPool.length >= 2) {
        var byParent = new Map();
        for (var r = 0; r < revealPool.length; r++) {
          var item = revealPool[r];
          var domNode = activeElements.get(item.emId);
          var parentKey = domNode && domNode.parentElement ? domNode.parentElement.getAttribute("data-em-id") || "root" : "root";
          if (!byParent.has(parentKey)) byParent.set(parentKey, []);
          byParent.get(parentKey).push(item);
        }
        byParent.forEach(function (siblings, pKey) {
          if (siblings.length >= 2) {
            siblings.sort(function (a, b) { return a.startTimeMs - b.startTimeMs; });
            var diffs = [];
            for (var k = 1; k < siblings.length; k++) {
              var dt = siblings[k].startTimeMs - siblings[k - 1].startTimeMs;
              if (dt >= 8 && dt <= 550) diffs.push(dt);
            }
            if (diffs.length >= 1) {
              var avgStagger = round(diffs.reduce(function (a, b) { return a + b; }, 0) / diffs.length, 0);
              staggerGroups.push({
                parentContainerEmId: pKey,
                itemCount: siblings.length,
                staggerDelayMs: avgStagger,
                items: siblings.map(function (s) { return s.selector; }).slice(0, 8)
              });
            }
          }
        });
      }

      // Arc / Curved Trajectory Detection
      var arcMechanics = null;
      if (scrollScrubAnimations.length >= 3) {
        var arcCandidates = scrollScrubAnimations.filter(function (scAnim) {
          var hasX = scAnim.channels.some(function (c) { return c.name === "tx" && c.span > 6; });
          var hasYOrRot = scAnim.channels.some(function (c) { return (c.name === "ty" && c.span > 10) || (c.name === "rotateZ" && c.span > 2); });
          return hasX && hasYOrRot;
        });
        if (arcCandidates.length >= 3) {
          var maxRot = 0;
          var maxArcX = 0;
          arcCandidates.forEach(function (ac) {
            ac.channels.forEach(function (c) {
              if (c.name === "rotateZ") maxRot = Math.max(maxRot, c.span / 2);
              if (c.name === "tx") maxArcX = Math.max(maxArcX, c.span);
            });
          });
          arcMechanics = {
            detected: true,
            itemCount: arcCandidates.length,
            estimatedMaxRotationDeg: round(maxRot, 1),
            horizontalArcDisplacementPx: round(maxArcX, 1),
            formulaHint:
              "Items travel along a circular arc: angle = offsetFromCenter * angleStep; x = radius * (1 - Math.cos(angle)); y = radius * Math.sin(angle); rotateZ = angleDeg;"
          };
        }
      }

      // Hover Cascades
      var compiledHovers = [];
      var seenHoverSelectors = new Set();
      for (var h = 0; h < hoverSessions.length; h++) {
        var hs = hoverSessions[h];
        if (!hs.enterBaseline || !hs.peakSnapshot) continue;
        var selfDiff = summarizeDiff(hs.enterBaseline, hs.peakSnapshot);
        var hasSelfChange = Object.keys(selfDiff).length > 0;
        var hasChildCascade = hs.childCascades && hs.childCascades.length > 0;

        if ((hasSelfChange || hasChildCascade) && !seenHoverSelectors.has(hs.selector)) {
          seenHoverSelectors.add(hs.selector);
          var hTraj = (elementTrajectories.get(hs.emId) || []).filter(function (pt) {
            return pt.t >= hs.tEnter - 10 && (hs.tLeave === null || pt.t <= hs.tLeave + 20);
          });
          var hoverProp = Math.abs(hs.peakSnapshot.scaleX - hs.enterBaseline.scaleX) > 0.008 ? "scaleX" : "ty";
          var hoverPhysics =
            hTraj.length >= 3
              ? analyzeCurvePhysics(
                  hTraj.map(function (pt) {
                    var obj = { t: pt.t };
                    obj[hoverProp] = pt.snap[hoverProp];
                    return obj;
                  }),
                  hoverProp
                )
              : { type: "css-transition", cssTransition: hs.peakSnapshot.transition };

          compiledHovers.push({
            selector: hs.selector,
            emId: hs.emId,
            label: hs.label,
            hoverDurationObservedMs: hs.tLeave ? round(hs.tLeave - hs.tEnter, 0) : null,
            selfDeltas: selfDiff,
            cssTransitionProperty: hs.peakSnapshot.transition !== "all 0s ease 0s" ? hs.peakSnapshot.transition : null,
            physics: hoverPhysics,
            childCascades: hs.childCascades
          });
        }
      }

      // Pointer Reactive Effects (3D Tilt / Magnetic Pull / Spotlight Vars)
      var pointerReactiveEffects = [];
      if (pointerSamples.length >= 8) {
        var byEm = new Map();
        for (var psIdx = 0; psIdx < pointerSamples.length; psIdx++) {
          var ps = pointerSamples[psIdx];
          if (!byEm.has(ps.emId)) byEm.set(ps.emId, []);
          byEm.get(ps.emId).push(ps);
        }
        byEm.forEach(function (samples, pEmId) {
          if (samples.length < 6) return;
          var xs = samples.map(function (s) { return s.localX; });
          var ys = samples.map(function (s) { return s.localY; });
          var rotYs = samples.map(function (s) { return s.snap.rotateY; });
          var rotXs = samples.map(function (s) { return s.snap.rotateX; });
          var txs = samples.map(function (s) { return s.snap.tx; });
          var tys = samples.map(function (s) { return s.snap.ty; });

          var corrTiltY = pearsonCorrelation(xs, rotYs);
          var corrTiltX = pearsonCorrelation(ys, rotXs);
          var corrMagX = pearsonCorrelation(xs, txs);
          var corrMagY = pearsonCorrelation(ys, tys);

          var maxRotY = Math.max.apply(null, rotYs.map(Math.abs));
          var maxRotX = Math.max.apply(null, rotXs.map(Math.abs));
          var maxTx = Math.max.apply(null, txs.map(Math.abs));
          var maxTy = Math.max.apply(null, tys.map(Math.abs));

          var targetEl = activeElements.get(pEmId) || selectedRoots[0];

          if ((Math.abs(corrTiltY) > 0.65 || Math.abs(corrTiltX) > 0.65) && (maxRotY > 1.2 || maxRotX > 1.2)) {
            pointerReactiveEffects.push({
              type: "3D_PERSPECTIVE_TILT",
              emId: pEmId,
              selector: extractor.describeElement(targetEl),
              maxRotateXDeg: round(maxRotX, 1),
              maxRotateYDeg: round(maxRotY, 1),
              invertX: corrTiltX < 0,
              equation:
                "rotateY = normX * " +
                round(maxRotY * (corrTiltY >= 0 ? 1 : -1), 1) +
                "deg; rotateX = normY * " +
                round(maxRotX * (corrTiltX >= 0 ? 1 : -1), 1) +
                "deg;"
            });
          } else if (Math.abs(corrMagX) > 0.68 && Math.abs(corrMagY) > 0.68 && (maxTx > 2 || maxTy > 2)) {
            pointerReactiveEffects.push({
              type: "MAGNETIC_CURSOR_PULL",
              emId: pEmId,
              selector: extractor.describeElement(targetEl),
              maxPullXPx: round(maxTx, 1),
              maxPullYPx: round(maxTy, 1),
              equation:
                "translateX = normX * " +
                round(maxTx, 1) +
                "px; translateY = normY * " +
                round(maxTy, 1) +
                "px (with spring return on pointerleave);"
            });
          }

          var sampleWithVars = samples.find(function (s) { return Object.keys(s.cssVars).length > 0; });
          if (sampleWithVars) {
            pointerReactiveEffects.push({
              type: "CURSOR_CSS_VARIABLES_SPOTLIGHT",
              emId: pEmId,
              selector: extractor.describeElement(targetEl),
              cssVariablesUpdatedOnMove: Object.keys(sampleWithVars.cssVars),
              sampleValues: sampleWithVars.cssVars
            });
          }
        });
      }

      return {
        recordingSummary: {
          durationSec: round((performance.now() - startTime) / 1000, 2),
          totalFramesSampled: frameCount,
          averageFps: fpsEstimate,
          sectionsRecorded: selectedRoots.length,
          linkedPortalsRecorded: linkedPortals.length,
          scrollCoverageMin: minScrollProg === 1 ? 0 : round(minScrollProg, 3),
          scrollCoverageMax: round(maxScrollProg, 3),
          scrollEventsRecorded: scrollEventsCount,
          wheelEventsRecorded: wheelEventsCount,
          hoverInteractionsRecorded: compiledHovers.length,
          clickEventsRecorded: interactionEvents.length,
          domMutationsRecorded: mutationLog.length
        },
        crossSectionGraph: crossSectionGraphReport,
        scrollScrubAnimations: scrollScrubAnimations,
        scrollRevealAnimations: scrollRevealAnimations,
        svgMorphAndDrawAnimations: svgMorphAndDrawAnimations,
        videoScrubAnimations: videoScrubAnimations,
        arcMechanics: arcMechanics,
        staggerGroups: staggerGroups,
        hoverInteractions: compiledHovers,
        pointerReactiveEffects: pointerReactiveEffects,
        waapiAnimations: Array.from(waapiCaptured.values()),
        timeDrivenAnimations: timeDrivenAnimations,
        interactiveStateMachine: {
          clicks: interactionEvents,
          mutations: mutationLog.slice(0, 75)
        }
      };
    }

    // Adaptive Multi-Section Choreography Sweep (scales duration to total multi-section pixel span + dispatches wheel for Lenis/GSAP!)
    function runAutoScrollSweep(onDone) {
      if (!isRecording) {
        if (onDone) onDone();
        return;
      }

      if (activeInnerScroller && activeInnerScroller.scrollHeight > activeInnerScroller.clientHeight + 12) {
        var startInner = activeInnerScroller.scrollTop;
        var maxInner = activeInnerScroller.scrollHeight - activeInnerScroller.clientHeight;
        var steps = 50;
        var idx = 0;
        var timer = setInterval(function () {
          if (!isRecording || idx > steps) {
            clearInterval(timer);
            activeInnerScroller.scrollTop = startInner;
            if (onDone) onDone();
            return;
          }
          var p = idx / steps;
          activeInnerScroller.scrollTop = p <= 0.82 ? (p / 0.82) * maxInner : (1 - (p - 0.82) / 0.18) * maxInner;
          activeInnerScroller.dispatchEvent(new WheelEvent("wheel", { deltaY: 40, bubbles: true }));
          idx++;
        }, 32);
        return;
      }

      var origY = window.scrollY;
      var bounds = computeMasterBounds();
      var absTop = bounds.top + origY;
      var vh = bounds.vh;
      var sweepStart = Math.max(0, absTop - vh * 0.85);
      var sweepEnd = Math.min(Math.max(0, document.documentElement.scrollHeight - vh), absTop + bounds.height - vh * 0.1);
      var travelPx = Math.abs(sweepEnd - sweepStart);

      if (travelPx < 24) {
        var primary = selectedRoots[0];
        var wStep = 0;
        var wTimer = setInterval(function () {
          if (!isRecording || wStep >= 28 || !primary) {
            clearInterval(wTimer);
            if (onDone) onDone();
            return;
          }
          var delta = wStep < 18 ? 60 : -60;
          primary.dispatchEvent(new WheelEvent("wheel", { deltaY: delta, bubbles: true, cancelable: true }));
          wStep++;
        }, 42);
        return;
      }

      // Scale duration smoothly for multi-section / 500vh-1000vh pinned tracks (2.6s up to 5.6s max)
      var totalMs = clamp(2400 + (travelPx / Math.max(1, vh)) * 380, 2600, 5600);
      var t0 = performance.now();
      var prevTargetY = sweepStart;

      function stepSweep(now) {
        if (!isRecording) {
          window.scrollTo(0, origY);
          if (onDone) onDone();
          return;
        }
        var u = clamp((now - t0) / totalMs, 0, 1);
        var targetY;
        if (u <= 0.84) {
          var k = u / 0.84;
          var eased = k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2;
          targetY = sweepStart + (sweepEnd - sweepStart) * eased;
        } else {
          var r = (u - 0.84) / 0.16;
          targetY = sweepEnd + (origY - sweepEnd) * r;
        }

        window.scrollTo(0, targetY);
        // Also sync Lenis if exposed on window so smooth-scroll velocity triggers fire!
        var lenis = window.lenis || window.__lenis;
        if (lenis && typeof lenis.scrollTo === "function") {
          try {
            lenis.scrollTo(targetY, { immediate: true });
          } catch (_) {}
        }
        var dy = targetY - prevTargetY;
        prevTargetY = targetY;
        if (Math.abs(dy) > 1) {
          window.dispatchEvent(new WheelEvent("wheel", { deltaY: dy, bubbles: true }));
        }

        if (u < 1) {
          requestAnimationFrame(stepSweep);
        } else {
          window.scrollTo(0, origY);
          if (onDone) onDone();
        }
      }
      requestAnimationFrame(stepSweep);
    }

    function runAutoHoverProbe(onDone) {
      if (!isRecording) {
        if (onDone) onDone();
        return;
      }
      var targets = [];
      for (var r = 0; r < selectedRoots.length; r++) {
        var found = selectedRoots[r].querySelectorAll('a, button, li, [role="button"], [tabindex], article, [data-w-id]');
        for (var f = 0; f < found.length && targets.length < 12; f++) {
          targets.push(found[f]);
        }
      }
      if (targets.length === 0 && selectedRoots[0]) {
        targets = Array.prototype.slice.call(selectedRoots[0].children || [], 0, 6);
      }

      var idx = 0;
      function probeNext() {
        if (!isRecording || idx >= targets.length) {
          if (onDone) onDone();
          return;
        }
        var el = targets[idx++];
        var rect = el.getBoundingClientRect();
        if (rect.width < 4 || rect.height < 4) {
          probeNext();
          return;
        }
        var cx = rect.left + rect.width * 0.5;
        var cy = rect.top + rect.height * 0.5;
        el.dispatchEvent(new PointerEvent("pointerover", { bubbles: true, clientX: cx, clientY: cy }));
        el.dispatchEvent(new MouseEvent("mouseover", { bubbles: true, clientX: cx, clientY: cy }));
        el.dispatchEvent(new MouseEvent("mouseenter", { bubbles: false, clientX: cx, clientY: cy }));
        el.dispatchEvent(new PointerEvent("pointermove", { bubbles: true, clientX: cx + rect.width * 0.28, clientY: cy - rect.height * 0.22 }));

        setTimeout(function () {
          el.dispatchEvent(new PointerEvent("pointerout", { bubbles: true, clientX: 0, clientY: 0 }));
          el.dispatchEvent(new MouseEvent("mouseout", { bubbles: true, clientX: 0, clientY: 0 }));
          el.dispatchEvent(new MouseEvent("mouseleave", { bubbles: false, clientX: 0, clientY: 0 }));
          setTimeout(probeNext, 75);
        }, 190);
      }
      probeNext();
    }

    function start() {
      if (isRecording) return;
      isRecording = true;
      startTime = performance.now();
      lastFrameTime = startTime;
      frameCount = 0;
      minWindowScrollY = window.scrollY;
      maxWindowScrollY = window.scrollY;

      globalBridgeMonitor.start();
      seedInitialCandidates();
      collectWAAPI("initial-mount");
      setupMutationObserver();

      document.addEventListener("scroll", onAnyScroll, { capture: true, passive: true });
      window.addEventListener("scroll", onAnyScroll, { passive: true });
      document.addEventListener("wheel", onWheel, { capture: true, passive: true });
      document.addEventListener("pointerover", onPointerOver, { capture: true, passive: true });
      document.addEventListener("pointerout", onPointerOut, { capture: true, passive: true });
      document.addEventListener("pointermove", onPointerMove, { capture: true, passive: true });
      document.addEventListener("click", onClick, { capture: true, passive: true });

      rafId = requestAnimationFrame(tick);
    }

    function stop() {
      if (!isRecording) return compileMotionIntelligence();
      isRecording = false;
      if (rafId) cancelAnimationFrame(rafId);
      if (mutationObserver) mutationObserver.disconnect();

      document.removeEventListener("scroll", onAnyScroll, { capture: true });
      window.removeEventListener("scroll", onAnyScroll);
      document.removeEventListener("wheel", onWheel, { capture: true });
      document.removeEventListener("pointerover", onPointerOver, { capture: true });
      document.removeEventListener("pointerout", onPointerOut, { capture: true });
      document.removeEventListener("pointermove", onPointerMove, { capture: true });
      document.removeEventListener("click", onClick, { capture: true });

      return compileMotionIntelligence();
    }

    return {
      start: start,
      stop: stop,
      addLinkedSection: addLinkedSection,
      getSelectedRoots: function () { return selectedRoots.slice(); },
      getLinkedPortals: function () { return linkedPortals.slice(); },
      runAutoScrollSweep: runAutoScrollSweep,
      runAutoHoverProbe: runAutoHoverProbe,
      isRecording: function () { return isRecording; }
    };
  }

  NS.MotionRecorder = {
    version: "3.0.0",
    createRecorder: createRecorder,
    decomposeTransform: decomposeTransform,
    computeNonLinearScrollR2: computeNonLinearScrollR2
  };
})();
