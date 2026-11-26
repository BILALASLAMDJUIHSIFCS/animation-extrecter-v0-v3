// ExactMotion Cloner v3.0 — Main-World Core Logic Decompiler, Shader & Timeline Introspector
// Runs in world: "MAIN" at document_start (with safe idempotent re-entry if injected dynamically)

(function () {
  if (window.__ExactMotionPageBridgeV3Installed) return;
  window.__ExactMotionPageBridgeV3Installed = true;

  var REGISTRY = (window.__ExactMotionMainRegistry = {
    installedAt: Date.now(),
    elementListeners: new WeakMap(), // Element -> Array<{ type, fnSrc, passive, capture }>
    globalListeners: [], // Array<{ target: 'window'|'document', type, fnSrc }>
    intersectionObservers: [], // Array<{ thresholds, rootMargin, fnSrc, targets: Set<Element> }>
    resizeObservers: [], // Array<{ fnSrc, targets: Set<Element> }>
    rafCallbacks: new Map(), // fnSrcHash -> { fnSrc, sampleCount }
    webglContexts: new WeakMap(), // HTMLCanvasElement -> { contextType, shaders: [], uniforms: {} }
    canvasList: new Set()
  });

  var RELEVANT_EVENTS = new Set([
    "scroll",
    "scrollend",
    "wheel",
    "mousewheel",
    "pointermove",
    "mousemove",
    "pointerover",
    "pointerenter",
    "mouseenter",
    "pointerout",
    "pointerleave",
    "mouseleave",
    "pointerdown",
    "mousedown",
    "pointerup",
    "mouseup",
    "click",
    "touchstart",
    "touchmove",
    "touchend",
    "keydown",
    "resize",
    "transitionend",
    "animationend"
  ]);

  function cleanFnSource(fn, maxLen) {
    if (typeof fn !== "function") return null;
    var limit = maxLen || 900;
    try {
      var raw = Function.prototype.toString.call(fn);
      if (!raw || raw.indexOf("[native code]") !== -1) return null;
      // Filter generic React/Browser synthetic event dispatchers that carry zero app logic
      if (
        raw.length < 18 ||
        /dispatchDiscreteEvent|dispatchContinuousEvent|invokeGuardedCallback|batchedUpdates|__exactmotion/i.test(raw)
      ) {
        return null;
      }
      var compact = raw.replace(/\r\n/g, "\n").replace(/[ \t]+/g, " ").trim();
      if (compact.length > limit) {
        return compact.slice(0, limit) + " /* ...truncated (" + compact.length + " chars) */";
      }
      return compact;
    } catch (_) {
      return null;
    }
  }

  function isInterestingLogicFn(src) {
    if (!src) return false;
    return /scroll|wheel|progress|clamp|lerp|mapRange|transform|translate|scale|rotate|opacity|clip|style|setProperty|gsap|timeline|ScrollTrigger|lenis|raf|requestAnimationFrame|Intersection|boundingClientRect|clientX|clientY|offset|velocity|spring|stagger|active|index|current|video|currentTime|canvas|uniform|shader|Math\.|theme/i.test(
      src
    );
  }

  // 1. Intercept EventTarget.prototype.addEventListener at document_start
  try {
    var origAddEvent = EventTarget.prototype.addEventListener;
    EventTarget.prototype.addEventListener = function (type, listener, options) {
      try {
        if (type && RELEVANT_EVENTS.has(String(type))) {
          var fn = typeof listener === "function" ? listener : listener && typeof listener.handleEvent === "function" ? listener.handleEvent : null;
          var src = cleanFnSource(fn, 850);
          if (src) {
            var passive = typeof options === "object" && options ? Boolean(options.passive) : false;
            var capture = typeof options === "boolean" ? options : Boolean(options && options.capture);
            if (this === window || this === document || this === document.documentElement || this === document.body) {
              if (REGISTRY.globalListeners.length < 80 && isInterestingLogicFn(src)) {
                var existsGlobal = REGISTRY.globalListeners.some(function (g) {
                  return g.type === type && g.fnSrc === src;
                });
                if (!existsGlobal) {
                  REGISTRY.globalListeners.push({
                    target: this === window ? "window" : this === document ? "document" : this.tagName.toLowerCase(),
                    type: String(type),
                    passive: passive,
                    capture: capture,
                    fnSrc: src
                  });
                }
              }
            } else if (this && this.nodeType === 1) {
              var arr = REGISTRY.elementListeners.get(this);
              if (!arr) {
                arr = [];
                REGISTRY.elementListeners.set(this, arr);
              }
              if (arr.length < 16) {
                var dup = arr.some(function (item) {
                  return item.type === type && item.fnSrc === src;
                });
                if (!dup) {
                  arr.push({
                    type: String(type),
                    passive: passive,
                    capture: capture,
                    fnSrc: src
                  });
                }
              }
            }
          }
        }
      } catch (_) {}
      return origAddEvent.apply(this, arguments);
    };
  } catch (_) {}

  // 2. Intercept IntersectionObserver & ResizeObserver
  try {
    if (typeof window.IntersectionObserver === "function") {
      var OrigIO = window.IntersectionObserver;
      var WrappedIO = function (callback, options) {
        var inst = new OrigIO(callback, options);
        try {
          var src = cleanFnSource(callback, 800);
          if (src && REGISTRY.intersectionObservers.length < 50) {
            var rec = {
              thresholds: options && options.threshold !== undefined ? options.threshold : [0],
              rootMargin: (options && options.rootMargin) || "0px",
              fnSrc: src,
              targets: new Set()
            };
            REGISTRY.intersectionObservers.push(rec);
            var origObs = inst.observe;
            inst.observe = function (el) {
              if (el && el.nodeType === 1) rec.targets.add(el);
              return origObs.apply(this, arguments);
            };
          }
        } catch (_) {}
        return inst;
      };
      WrappedIO.prototype = OrigIO.prototype;
      Object.setPrototypeOf(WrappedIO, OrigIO);
      window.IntersectionObserver = WrappedIO;
    }
  } catch (_) {}

  try {
    if (typeof window.ResizeObserver === "function") {
      var OrigRO = window.ResizeObserver;
      var WrappedRO = function (callback) {
        var inst = new OrigRO(callback);
        try {
          var src = cleanFnSource(callback, 650);
          if (src && isInterestingLogicFn(src) && REGISTRY.resizeObservers.length < 30) {
            var rec = { fnSrc: src, targets: new Set() };
            REGISTRY.resizeObservers.push(rec);
            var origObs = inst.observe;
            inst.observe = function (el) {
              if (el && el.nodeType === 1) rec.targets.add(el);
              return origObs.apply(this, arguments);
            };
          }
        } catch (_) {}
        return inst;
      };
      WrappedRO.prototype = OrigRO.prototype;
      Object.setPrototypeOf(WrappedRO, OrigRO);
      window.ResizeObserver = WrappedRO;
    }
  } catch (_) {}

  // 3. Lightweight requestAnimationFrame loop profiler (captures custom tick math!)
  try {
    var origRAF = window.requestAnimationFrame;
    var rafSampleBudget = 0;
    window.requestAnimationFrame = function (cb) {
      if (rafSampleBudget < 120 && typeof cb === "function") {
        rafSampleBudget++;
        var src = cleanFnSource(cb, 850);
        if (src && isInterestingLogicFn(src)) {
          var key = src.slice(0, 120);
          var existing = REGISTRY.rafCallbacks.get(key);
          if (existing) {
            existing.sampleCount++;
          } else if (REGISTRY.rafCallbacks.size < 20) {
            REGISTRY.rafCallbacks.set(key, { fnSrc: src, sampleCount: 1 });
          }
        }
      }
      return origRAF.apply(this, arguments);
    };
  } catch (_) {}

  // 4. WebGL / WebGL2 Shader & Uniform Interceptor + preserveDrawingBuffer Assurance
  function instrumentWebGLPrototype(Proto) {
    if (!Proto || Proto.__emInstrumented) return;
    Proto.__emInstrumented = true;
    try {
      var origShaderSource = Proto.shaderSource;
      Proto.shaderSource = function (shader, source) {
        try {
          var canvas = this && this.canvas;
          if (canvas && typeof source === "string" && source.length > 20) {
            var meta = REGISTRY.webglContexts.get(canvas);
            if (!meta) {
              meta = { contextType: "webgl", shaders: [], uniforms: {} };
              REGISTRY.webglContexts.set(canvas, meta);
            }
            if (meta.shaders.length < 12) {
              var isFrag = /gl_FragColor|out\s+vec4|sampler2D|fragColor/i.test(source) && !/gl_Position/i.test(source);
              var trimmed = source.length > 2800 ? source.slice(0, 2800) + "\n/* ...shader truncated... */" : source;
              var dup = meta.shaders.some(function (s) { return s.source === trimmed; });
              if (!dup) {
                meta.shaders.push({
                  stage: isFrag ? "fragment" : "vertex",
                  source: trimmed
                });
              }
            }
          }
        } catch (_) {}
        return origShaderSource.apply(this, arguments);
      };

      var origGetUniformLocation = Proto.getUniformLocation;
      Proto.getUniformLocation = function (program, name) {
        var loc = origGetUniformLocation.apply(this, arguments);
        try {
          if (loc && typeof name === "string") {
            loc.__emUniformName = name;
            var canvas = this && this.canvas;
            if (canvas) {
              var meta = REGISTRY.webglContexts.get(canvas);
              if (!meta) {
                meta = { contextType: "webgl", shaders: [], uniforms: {} };
                REGISTRY.webglContexts.set(canvas, meta);
              }
              if (Object.keys(meta.uniforms).length < 40 && !(name in meta.uniforms)) {
                meta.uniforms[name] = "registered";
              }
            }
          }
        } catch (_) {}
        return loc;
      };

      ["uniform1f", "uniform2f", "uniform3f", "uniform4f", "uniform1i"].forEach(function (fnName) {
        var origU = Proto[fnName];
        if (typeof origU !== "function") return;
        Proto[fnName] = function (location) {
          try {
            if (location && location.__emUniformName && this && this.canvas) {
              var meta = REGISTRY.webglContexts.get(this.canvas);
              if (meta && Object.keys(meta.uniforms).length <= 45) {
                var vals = Array.prototype.slice.call(arguments, 1).map(function (v) {
                  return typeof v === "number" ? Math.round(v * 1000) / 1000 : v;
                });
                meta.uniforms[location.__emUniformName] = vals.length === 1 ? vals[0] : vals;
              }
            }
          } catch (_) {}
          return origU.apply(this, arguments);
        };
      });
    } catch (_) {}
  }

  try {
    if (typeof window.WebGLRenderingContext !== "undefined") {
      instrumentWebGLPrototype(window.WebGLRenderingContext.prototype);
    }
    if (typeof window.WebGL2RenderingContext !== "undefined") {
      instrumentWebGLPrototype(window.WebGL2RenderingContext.prototype);
    }
    var origGetContext = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (type, attrs) {
      var modifiedAttrs = attrs;
      if (type === "webgl" || type === "webgl2" || type === "experimental-webgl") {
        modifiedAttrs = Object.assign({}, attrs || {}, { preserveDrawingBuffer: true });
        REGISTRY.canvasList.add(this);
      }
      var ctx = origGetContext.call(this, type, modifiedAttrs);
      try {
        if (ctx && (type === "webgl" || type === "webgl2")) {
          if (!REGISTRY.webglContexts.has(this)) {
            REGISTRY.webglContexts.set(this, { contextType: type, shaders: [], uniforms: {} });
          }
        }
      } catch (_) {}
      return ctx;
    };
  } catch (_) {}

  // Serialization helper that PRESERVES function logic instead of discarding it!
  function safeSerialize(val, depth) {
    if (depth === undefined) depth = 0;
    if (depth > 4) return undefined;
    if (val === null || val === undefined) return val;
    var t = typeof val;
    if (t === "string") return val.length > 320 ? val.slice(0, 320) + "..." : val;
    if (t === "number") return Number.isFinite(val) ? Math.round(val * 10000) / 10000 : undefined;
    if (t === "boolean") return val;
    if (t === "symbol") return undefined;
    if (t === "function") {
      var fnStr = cleanFnSource(val, 520);
      return fnStr ? { __functionLogic: fnStr } : "[native/bound fn]";
    }

    if (t === "object") {
      if (val instanceof Node) {
        return val.nodeType === 1 ? getEmSelector(val) : undefined;
      }
      if (val instanceof Window || val instanceof Event) return undefined;

      // Framer Motion / Motion MotionValue introspection
      if (typeof val.get === "function" && ("current" in val || "prev" in val || "velocity" in val || "version" in val)) {
        try {
          var mvOut = {
            __motionValue: safeSerialize(val.get(), depth + 1)
          };
          if (typeof val.getVelocity === "function") {
            mvOut.velocity = Math.round(val.getVelocity() * 100) / 100;
          }
          return mvOut;
        } catch (_) {
          return "[MotionValue]";
        }
      }

      if (Array.isArray(val)) {
        return val.slice(0, 20).map(function (x) {
          return safeSerialize(x, depth + 1);
        });
      }

      var out = {};
      var keys = Object.keys(val);
      var count = 0;
      for (var i = 0; i < keys.length; i++) {
        var k = keys[i];
        if (k.startsWith("_") || k.startsWith("$") || k === "children" || k === "ref" || k === "ownerDocument" || k === "parent") continue;
        try {
          var sv = safeSerialize(val[k], depth + 1);
          if (sv !== undefined) {
            out[k] = sv;
            count++;
            if (count >= 28) break;
          }
        } catch (_) {}
      }
      return count > 0 ? out : undefined;
    }
    return undefined;
  }

  function getEmSelector(el) {
    if (!el || el.nodeType !== 1) return "unknown";
    var emId = el.getAttribute("data-em-id");
    var tag = el.tagName.toLowerCase();
    var idPart = el.id ? "#" + el.id : "";
    var cls =
      typeof el.className === "string" && el.className.trim()
        ? "." +
          el.className
            .trim()
            .split(/\s+/)
            .filter(function (c) {
              return c && c.length < 38 && c.indexOf("__exactmotion") === -1;
            })
            .slice(0, 2)
            .join(".")
        : "";
    if (cls === ".") cls = "";
    return emId ? tag + idPart + cls + ' [data-em-id="' + emId + '"]' : tag + idPart + cls;
  }

  function elementInScope(el, roots) {
    if (!el || el.nodeType !== 1) return false;
    for (var i = 0; i < roots.length; i++) {
      if (roots[i] === el || roots[i].contains(el) || el.contains(roots[i])) return true;
    }
    return false;
  }

  // Extract math/scroll formulas out of large minified React/Vue component functions
  function extractMathExpressionsFromSource(fnText) {
    if (!fnText || fnText.length < 25) return [];
    var hits = [];
    var patterns = [
      /(?:clamp|mapRange|lerp|smoothstep|normalize)\s*\([^;]{8,180}\)/g,
      /Math\.(?:sin|cos|atan2|hypot|pow|min|max|abs)\s*\([^;]{6,160}\)/g,
      /(?:scrollY|scrollTop|scrollProgress|progress|velocity|deltaY)[^;]{4,160}/g,
      /(?:translate3d|translateX|translateY|scale|rotate[XYZ]?|perspective)\([^`'")]{3,140}\)/g,
      /useTransform\s*\([^;]{8,200}\)/g,
      /useSpring\s*\([^;]{6,160}\)/g,
      /useScroll\s*\([^;]{4,160}\)/g
    ];
    for (var p = 0; p < patterns.length; p++) {
      var m = fnText.match(patterns[p]);
      if (m) {
        for (var i = 0; i < m.length && hits.length < 12; i++) {
          var snippet = m[i].trim();
          if (hits.indexOf(snippet) === -1) hits.push(snippet);
        }
      }
    }
    return hits;
  }

  // Deep React 18 + React 19 Compiler Fiber & Framer Motion Decompiler
  function inspectReactFibersAndLogic(roots) {
    var motionConfigs = [];
    var components = [];
    var extractedHooksLogic = [];
    var sharedLayoutIds = [];

    var seenComp = new Set();
    var seenFnSrc = new Set();

    var allNodes = [];
    for (var r = 0; r < roots.length; r++) {
      allNodes.push(roots[r]);
      var sub = roots[r].querySelectorAll("*");
      for (var s = 0; s < sub.length && allNodes.length < 450; s++) {
        allNodes.push(sub[s]);
      }
    }

    var motionKeys = [
      "initial",
      "animate",
      "exit",
      "whileHover",
      "whileTap",
      "whileFocus",
      "whileDrag",
      "whileInView",
      "viewport",
      "transition",
      "variants",
      "layout",
      "layoutId",
      "drag",
      "dragConstraints",
      "dragElastic",
      "custom"
    ];

    for (var i = 0; i < allNodes.length; i++) {
      var el = allNodes[i];
      var keys = Object.keys(el);
      var propsKey = null;
      var fiberKey = null;

      for (var k = 0; k < keys.length; k++) {
        if (keys[k].indexOf("__reactProps$") === 0) propsKey = keys[k];
        if (keys[k].indexOf("__reactFiber$") === 0 || keys[k].indexOf("__reactInternalInstance$") === 0) {
          fiberKey = keys[k];
        }
      }

      if (propsKey && el[propsKey]) {
        var rProps = el[propsKey];
        var foundMotion = {};
        var hasMotion = false;
        for (var m = 0; m < motionKeys.length; m++) {
          var mk = motionKeys[m];
          if (rProps[mk] !== undefined) {
            var serialized = safeSerialize(rProps[mk], 0);
            if (serialized !== undefined) {
              foundMotion[mk] = serialized;
              hasMotion = true;
              if (mk === "layoutId" && typeof rProps[mk] === "string") {
                sharedLayoutIds.push({ layoutId: rProps[mk], selector: getEmSelector(el) });
              }
            }
          }
        }

        // Capture interactive event handlers attached via React JSX props (onClick, onMouseEnter, onPointerMove, onWheel)
        var handlerProps = ["onClick", "onPointerMove", "onMouseMove", "onPointerEnter", "onMouseEnter", "onWheel", "onScroll"];
        for (var hp = 0; hp < handlerProps.length; hp++) {
          var hName = handlerProps[hp];
          if (typeof rProps[hName] === "function" && extractedHooksLogic.length < 35) {
            var hSrc = cleanFnSource(rProps[hName], 650);
            if (hSrc && !seenFnSrc.has(hSrc)) {
              seenFnSrc.add(hSrc);
              extractedHooksLogic.push({
                origin: "ReactProp:" + hName,
                targetSelector: getEmSelector(el),
                fnSrc: hSrc
              });
            }
          }
        }

        if (hasMotion && motionConfigs.length < 40) {
          motionConfigs.push({
            selector: getEmSelector(el),
            props: foundMotion
          });
        }
      }

      if (fiberKey && el[fiberKey]) {
        var curr = el[fiberKey];
        var hops = 0;
        while (curr && hops < 8) {
          var fnType = curr.elementType || curr.type;
          if (typeof fnType === "function") {
            var rawCompName = fnType.displayName || fnType.name || "";
            var compFnStr = "";
            try {
              compFnStr = Function.prototype.toString.call(fnType);
            } catch (_) {}

            var compKey = rawCompName + "::" + compFnStr.slice(0, 90);
            if (!seenComp.has(compKey) && !/^(Primitive|Slot|MotionComponent|PresenceChild|AnimatePresence)$/i.test(rawCompName)) {
              seenComp.add(compKey);

              // 1) Inspect React 19 Compiler memoCache (where useLenis/scroll/frame callbacks live!)
              var memoCacheSlots =
                curr.updateQueue &&
                curr.updateQueue.memoCache &&
                Array.isArray(curr.updateQueue.memoCache.data)
                  ? curr.updateQueue.memoCache.data
                  : null;
              if (memoCacheSlots) {
                for (var mc = 0; mc < memoCacheSlots.length; mc++) {
                  var slotArr = memoCacheSlots[mc];
                  if (!Array.isArray(slotArr)) continue;
                  for (var si = 0; si < slotArr.length; si++) {
                    if (typeof slotArr[si] === "function" && extractedHooksLogic.length < 35) {
                      var slotSrc = cleanFnSource(slotArr[si], 750);
                      if (slotSrc && isInterestingLogicFn(slotSrc) && !seenFnSrc.has(slotSrc)) {
                        seenFnSrc.add(slotSrc);
                        extractedHooksLogic.push({
                          origin: "React19MemoCache (" + (rawCompName || "SectionComponent") + ")",
                          targetSelector: getEmSelector(el),
                          fnSrc: slotSrc
                        });
                      }
                    }
                  }
                }
              }

              // 2) Walk Fiber Hook Linked List (useState, useRef<fn>, useEffect, useLayoutEffect, useMemo)
              var stateValues = [];
              var hookNode = curr.memoizedState;
              var hSafety = 0;
              while (hookNode && hSafety++ < 28) {
                var mVal = hookNode.memoizedState;
                if (mVal !== null && mVal !== undefined) {
                  if (typeof mVal === "object") {
                    // useEffect / useLayoutEffect
                    if (typeof mVal.create === "function" && extractedHooksLogic.length < 35) {
                      var efSrc = cleanFnSource(mVal.create, 780);
                      if (efSrc && isInterestingLogicFn(efSrc) && !seenFnSrc.has(efSrc)) {
                        seenFnSrc.add(efSrc);
                        extractedHooksLogic.push({
                          origin: "ReactHook:useEffect (" + (rawCompName || "Component") + ")",
                          targetSelector: getEmSelector(el),
                          fnSrc: efSrc
                        });
                      }
                    }
                    // useRef holding animation/scroll callback (e.g. useLenis / useTempus / useFrame)
                    else if ("current" in mVal && Object.keys(mVal).length === 1) {
                      if (typeof mVal.current === "function" && extractedHooksLogic.length < 35) {
                        var refFnSrc = cleanFnSource(mVal.current, 780);
                        if (refFnSrc && isInterestingLogicFn(refFnSrc) && !seenFnSrc.has(refFnSrc)) {
                          seenFnSrc.add(refFnSrc);
                          extractedHooksLogic.push({
                            origin: "ReactHook:useRef<Callback> (" + (rawCompName || "Component") + ")",
                            targetSelector: getEmSelector(el),
                            fnSrc: refFnSrc
                          });
                        }
                      }
                    }
                    // useCallback / useMemo tuple [val, deps]
                    else if (Array.isArray(mVal) && mVal.length === 2 && typeof mVal[0] === "function" && extractedHooksLogic.length < 35) {
                      var cbSrc = cleanFnSource(mVal[0], 750);
                      if (cbSrc && isInterestingLogicFn(cbSrc) && !seenFnSrc.has(cbSrc)) {
                        seenFnSrc.add(cbSrc);
                        extractedHooksLogic.push({
                          origin: "ReactHook:useCallback (" + (rawCompName || "Component") + ")",
                          targetSelector: getEmSelector(el),
                          fnSrc: cbSrc
                        });
                      }
                    }
                  } else if (typeof mVal === "number" || typeof mVal === "string" || typeof mVal === "boolean") {
                    if (stateValues.length < 8) stateValues.push(mVal);
                  }
                }
                hookNode = hookNode.next;
              }

              // 3) Extract math expressions from Component render body
              var mathExprs = extractMathExpressionsFromSource(compFnStr);
              if ((rawCompName && rawCompName.length > 1) || mathExprs.length > 0 || stateValues.length > 0) {
                if (components.length < 24) {
                  components.push({
                    componentName: rawCompName || "AnonymousMotionComponent",
                    mountedNear: getEmSelector(el),
                    props: safeSerialize(curr.memoizedProps, 1),
                    observedHookStates: stateValues.length > 0 ? stateValues : undefined,
                    mathAndScrollFormulas: mathExprs.length > 0 ? mathExprs : undefined
                  });
                }
              }
            }
          }
          curr = curr.return;
          hops++;
        }
      }
    }

    return {
      hasReact: components.length > 0 || motionConfigs.length > 0 || extractedHooksLogic.length > 0,
      components: components,
      framerMotionNodes: motionConfigs,
      sharedLayoutIds: sharedLayoutIds,
      decompiledHookAndHandlerFunctions: extractedHooksLogic
    };
  }

  // Deep GSAP 3 + ScrollTrigger + Nested Timeline + Element _gsap Cache Introspection
  function decompileGsapTimelineChildren(tl, maxItems) {
    if (!tl || typeof tl.getChildren !== "function") return [];
    var out = [];
    try {
      var kids = tl.getChildren(false, true, true);
      for (var i = 0; i < kids.length && out.length < (maxItems || 24); i++) {
        var child = kids[i];
        if (typeof child.getChildren === "function") {
          // Nested sub-timeline
          out.push({
            kind: "nested-timeline",
            startTime: typeof child.startTime === "function" ? Math.round(child.startTime() * 1000) / 1000 : 0,
            duration: typeof child.duration === "function" ? Math.round(child.duration() * 1000) / 1000 : 0,
            labels: child.labels || undefined,
            children: decompileGsapTimelineChildren(child, 10)
          });
        } else if (typeof child.targets === "function") {
          var domTargets = child
            .targets()
            .filter(function (n) {
              return n && n.nodeType === 1;
            })
            .slice(0, 6)
            .map(getEmSelector);
          var easeName =
            (child._ease && (child._ease.id || child._ease.name)) ||
            (child.vars && typeof child.vars.ease === "string" ? child.vars.ease : null);
          out.push({
            kind: "tween",
            startTime: typeof child.startTime === "function" ? Math.round(child.startTime() * 1000) / 1000 : 0,
            duration: typeof child.duration === "function" ? Math.round(child.duration() * 1000) / 1000 : 0,
            ease: easeName || "power1.out",
            targets: domTargets,
            vars: safeSerialize(child.vars, 2)
          });
        }
      }
    } catch (_) {}
    return out;
  }

  function inspectGSAPDeep(roots) {
    var result = {
      detected: false,
      version: null,
      bundledPrivateCachesCount: 0,
      elementGsapStates: [],
      scrollTriggers: [],
      crossSectionTriggers: [],
      activeTweens: []
    };

    // 1. Check element._gsap caches (works EVEN when GSAP is privately bundled inside Vite/Webpack/Next!)
    var sampleNodes = [];
    for (var r = 0; r < roots.length; r++) {
      sampleNodes.push(roots[r]);
      var q = roots[r].querySelectorAll("*");
      for (var s = 0; s < q.length && sampleNodes.length < 360; s++) {
        sampleNodes.push(q[s]);
      }
    }
    for (var n = 0; n < sampleNodes.length; n++) {
      var el = sampleNodes[n];
      if (el._gsap) {
        result.detected = true;
        result.bundledPrivateCachesCount++;
        if (result.elementGsapStates.length < 24) {
          var g = el._gsap;
          result.elementGsapStates.push({
            selector: getEmSelector(el),
            x: g.x,
            y: g.y,
            xPercent: g.xPercent,
            yPercent: g.yPercent,
            rotation: g.rotation,
            rotationX: g.rotationX,
            rotationY: g.rotationY,
            scaleX: g.scaleX,
            scaleY: g.scaleY,
            skewX: g.skewX,
            transformOrigin: g.origin
          });
        }
      }
    }

    var gsap = window.gsap || (window.GreenSockGlobals && window.GreenSockGlobals.gsap);
    if (!gsap) return result;

    result.detected = true;
    result.version = gsap.version || "3.x";

    var ST = window.ScrollTrigger || (gsap.core && gsap.core.globals && gsap.core.globals().ScrollTrigger);
    if (ST && typeof ST.getAll === "function") {
      try {
        var triggers = ST.getAll();
        for (var i = 0; i < triggers.length; i++) {
          var st = triggers[i];
          var trigEl = st.trigger || (st.pin && st.pin !== true ? st.pin : null);
          var trigInScope = trigEl && elementInScope(trigEl, roots);

          var animTargets = [];
          var anyTargetInScope = false;
          var anyTargetOutsideScope = false;

          if (st.animation && typeof st.animation.targets === "function") {
            var rawTargets = st.animation.targets();
            for (var j = 0; j < rawTargets.length; j++) {
              var tn = rawTargets[j];
              if (tn && tn.nodeType === 1) {
                if (animTargets.length < 10) animTargets.push(getEmSelector(tn));
                if (elementInScope(tn, roots)) anyTargetInScope = true;
                else anyTargetOutsideScope = true;
              }
            }
          } else if (st.animation && typeof st.animation.getChildren === "function") {
            var allKids = st.animation.getChildren(true, true, false);
            for (var ck = 0; ck < allKids.length; ck++) {
              if (typeof allKids[ck].targets !== "function") continue;
              var kt = allKids[ck].targets();
              for (var m = 0; m < kt.length; m++) {
                if (kt[m] && kt[m].nodeType === 1) {
                  if (animTargets.length < 10) animTargets.push(getEmSelector(kt[m]));
                  if (elementInScope(kt[m], roots)) anyTargetInScope = true;
                  else anyTargetOutsideScope = true;
                }
              }
            }
          }

          if ((trigInScope || anyTargetInScope) && result.scrollTriggers.length < 32) {
            var vars = st.vars || {};
            var callbacks = {};
            ["onUpdate", "onEnter", "onLeave", "onEnterBack", "onLeaveBack", "onToggle", "onSnapComplete"].forEach(function (cbName) {
              if (typeof vars[cbName] === "function") {
                var cbSrc = cleanFnSource(vars[cbName], 750);
                if (cbSrc) callbacks[cbName] = cbSrc;
              }
            });

            var stEntry = {
              trigger: trigEl ? getEmSelector(trigEl) : null,
              pin: st.pin ? (st.pin === true ? true : getEmSelector(st.pin)) : false,
              pinSpacing: vars.pinSpacing !== undefined ? vars.pinSpacing : true,
              scrub: vars.scrub !== undefined ? vars.scrub : false,
              horizontal: Boolean(vars.horizontal),
              hasContainerAnimation: Boolean(vars.containerAnimation),
              start: typeof vars.start === "string" || typeof vars.start === "number" ? vars.start : String(st.start || ""),
              end: typeof vars.end === "string" || typeof vars.end === "number" ? vars.end : String(st.end || ""),
              toggleActions: vars.toggleActions || null,
              toggleClass: vars.toggleClass ? safeSerialize(vars.toggleClass, 1) : null,
              snap: vars.snap !== undefined ? safeSerialize(vars.snap, 2) : null,
              progress: typeof st.progress === "number" ? Math.round(st.progress * 1000) / 1000 : null,
              targets: Array.from(new Set(animTargets)),
              callbacks: Object.keys(callbacks).length > 0 ? callbacks : undefined,
              timelineLabels: st.animation && st.animation.labels ? st.animation.labels : undefined,
              timelineChildren: st.animation ? decompileGsapTimelineChildren(st.animation, 18) : undefined
            };

            result.scrollTriggers.push(stEntry);

            // Cross-section link detected if trigger is inside selected section while targets live outside (or vice versa!)
            if ((trigInScope && anyTargetOutsideScope) || (!trigInScope && anyTargetInScope)) {
              result.crossSectionTriggers.push({
                trigger: stEntry.trigger,
                externalOrLinkedTargets: stEntry.targets,
                relationship: trigInScope
                  ? "Selected section trigger drives external/global target(s)"
                  : "External section trigger drives target(s) inside selected section"
              });
            }
          }
        }
      } catch (_) {}
    }

    if (gsap.globalTimeline && typeof gsap.globalTimeline.getChildren === "function") {
      try {
        var children = gsap.globalTimeline.getChildren(true, true, false);
        for (var c = 0; c < children.length && result.activeTweens.length < 25; c++) {
          var tw = children[c];
          if (typeof tw.targets !== "function") continue;
          var twTargets = tw.targets().filter(function (n) {
            return n && n.nodeType === 1 && elementInScope(n, roots);
          });
          if (twTargets.length > 0) {
            result.activeTweens.push({
              targets: twTargets.slice(0, 5).map(getEmSelector),
              startTime: typeof tw.startTime === "function" ? Math.round(tw.startTime() * 1000) / 1000 : 0,
              duration: typeof tw.duration === "function" ? Math.round(tw.duration() * 1000) / 1000 : null,
              vars: safeSerialize(tw.vars, 2)
            });
          }
        }
      } catch (_) {}
    }

    return result;
  }

  // Extract WebGL Shaders, Uniforms, R3F Scene Graph & Three.js Metadata
  function inspectShadersAndWebGL(roots) {
    var canvases = new Set();
    for (var r = 0; r < roots.length; r++) {
      if (roots[r].tagName === "CANVAS") canvases.add(roots[r]);
      var found = roots[r].querySelectorAll("canvas");
      for (var f = 0; f < found.length; f++) canvases.add(found[f]);
    }
    // Also check fixed/background full-bleed canvases linked to viewport!
    var docCanvases = document.querySelectorAll("canvas");
    for (var d = 0; d < docCanvases.length; d++) {
      var dc = docCanvases[d];
      var cs = getComputedStyle(dc);
      var rect = dc.getBoundingClientRect();
      if ((cs.position === "fixed" || cs.position === "sticky") && rect.width > window.innerWidth * 0.4 && rect.height > window.innerHeight * 0.4) {
        canvases.add(dc);
      }
    }

    var canvasReports = [];
    canvases.forEach(function (c) {
      var glMeta = REGISTRY.webglContexts.get(c);
      var r3fInfo = null;
      // React Three Fiber (__r3f) live scene introspection
      if (c.__r3f && c.__r3f.root && typeof c.__r3f.root.getState === "function") {
        try {
          var st = c.__r3f.root.getState();
          var meshes = [];
          if (st.scene && typeof st.scene.traverse === "function") {
            st.scene.traverse(function (obj) {
              if (meshes.length >= 16) return;
              if (obj.isMesh || obj.isPoints || obj.isShaderMaterial) {
                var mat = obj.material;
                meshes.push({
                  type: obj.type,
                  name: obj.name || undefined,
                  geometry: obj.geometry ? obj.geometry.type : undefined,
                  material: mat ? mat.type : undefined,
                  vertexShader: mat && mat.vertexShader ? mat.vertexShader.slice(0, 1400) : undefined,
                  fragmentShader: mat && mat.fragmentShader ? mat.fragmentShader.slice(0, 1400) : undefined,
                  uniforms: mat && mat.uniforms ? safeSerialize(mat.uniforms, 2) : undefined
                });
              }
            });
          }
          r3fInfo = {
            camera: st.camera
              ? {
                  type: st.camera.type,
                  fov: st.camera.fov,
                  position: st.camera.position ? [st.camera.position.x, st.camera.position.y, st.camera.position.z] : null
                }
              : null,
            meshes: meshes
          };
        } catch (_) {}
      }

      var rect = c.getBoundingClientRect();
      var cs2 = getComputedStyle(c);
      canvasReports.push({
        selector: getEmSelector(c),
        inSelectedSubtree: elementInScope(c, roots),
        positionRole: cs2.position === "fixed" ? "shared-fixed-stage-canvas" : cs2.position,
        width: c.width,
        height: c.height,
        cssSize: Math.round(rect.width) + "x" + Math.round(rect.height),
        dataEngine: c.getAttribute("data-engine") || null,
        capturedShaders: glMeta ? glMeta.shaders : [],
        capturedUniforms: glMeta ? glMeta.uniforms : {},
        reactThreeFiberScene: r3fInfo
      });
    });

    return canvasReports;
  }

  // Collect intercepted Event Listeners, Observers, Inline Scripts & Webflow IX2 Logic
  function inspectEventListenersAndScripts(roots) {
    var domListeners = [];
    var allNodes = [];
    for (var r = 0; r < roots.length; r++) {
      allNodes.push(roots[r]);
      var sub = roots[r].querySelectorAll("*");
      for (var s = 0; s < sub.length && allNodes.length < 400; s++) {
        allNodes.push(sub[s]);
      }
    }

    for (var i = 0; i < allNodes.length; i++) {
      var el = allNodes[i];
      var list = REGISTRY.elementListeners.get(el);
      if (list && list.length > 0 && domListeners.length < 35) {
        domListeners.push({
          selector: getEmSelector(el),
          listeners: list
        });
      }
    }

    var relevantIO = [];
    for (var ioIdx = 0; ioIdx < REGISTRY.intersectionObservers.length; ioIdx++) {
      var io = REGISTRY.intersectionObservers[ioIdx];
      var matchedTargets = [];
      io.targets.forEach(function (t) {
        if (elementInScope(t, roots) && matchedTargets.length < 8) {
          matchedTargets.push(getEmSelector(t));
        }
      });
      if (matchedTargets.length > 0) {
        relevantIO.push({
          thresholds: io.thresholds,
          rootMargin: io.rootMargin,
          targets: matchedTargets,
          callbackLogic: io.fnSrc
        });
      }
    }

    // Inspect inline <script> tags on the page that reference ids/classes inside the captured sections
    var relevantInlineScripts = [];
    try {
      var tokens = [];
      for (var rt = 0; rt < roots.length; rt++) {
        if (roots[rt].id) tokens.push(roots[rt].id);
        var clsList = typeof roots[rt].className === "string" ? roots[rt].className.trim().split(/\s+/) : [];
        for (var ci = 0; ci < Math.min(clsList.length, 3); ci++) {
          if (clsList[ci] && clsList[ci].length > 4 && !/^(relative|flex|grid|block|w-full|h-screen|overflow-hidden)$/i.test(clsList[ci])) {
            tokens.push(clsList[ci]);
          }
        }
      }
      var scripts = document.querySelectorAll("script:not([src])");
      for (var sc = 0; sc < scripts.length && relevantInlineScripts.length < 6; sc++) {
        var txt = (scripts[sc].textContent || "").trim();
        if (!txt || txt.length < 30 || txt.indexOf("__NEXT_DATA__") !== -1) continue;
        var matchesToken = tokens.some(function (tk) {
          return txt.indexOf(tk) !== -1;
        });
        var hasAnimCode = /gsap|ScrollTrigger|IntersectionObserver|requestAnimationFrame|addEventListener\s*\(\s*['"](?:scroll|wheel|pointermove|mousemove)/i.test(txt);
        if (matchesToken || (hasAnimCode && txt.length < 12000)) {
          relevantInlineScripts.push(txt.length > 2600 ? txt.slice(0, 2600) + "\n/* ...inline script truncated... */" : txt);
        }
      }
    } catch (_) {}

    // Webflow IX2 Store Introspection
    var webflowIx2 = null;
    try {
      if (window.Webflow && typeof window.Webflow.require === "function") {
        var ix2 = window.Webflow.require("ix2");
        if (ix2 && ix2.store && typeof ix2.store.getState === "function") {
          var ixState = ix2.store.getState();
          if (ixState && ixState.ixData) {
            var wfIds = new Set();
            allNodes.forEach(function (n) {
              var wid = n.getAttribute && n.getAttribute("data-w-id");
              if (wid) wfIds.add(wid);
            });
            var matchedEvents = {};
            var eventsObj = ixState.ixData.events || {};
            Object.keys(eventsObj).forEach(function (evKey) {
              var ev = eventsObj[evKey];
              if (ev && ev.target && wfIds.has(ev.target.id) && Object.keys(matchedEvents).length < 15) {
                matchedEvents[evKey] = safeSerialize(ev, 3);
              }
            });
            if (Object.keys(matchedEvents).length > 0) {
              webflowIx2 = { matchedEvents: matchedEvents };
            }
          }
        }
      }
    } catch (_) {}

    return {
      elementEventListeners: domListeners,
      globalScrollAndPointerListeners: REGISTRY.globalListeners.slice(0, 18),
      intersectionObservers: relevantIO,
      rafLoopCallbacks: Array.from(REGISTRY.rafCallbacks.values()).slice(0, 10),
      inlineAnimationScripts: relevantInlineScripts,
      webflowIx2: webflowIx2
    };
  }

  function inspectSmoothScrollAndLibraries(roots) {
    var libs = [];
    var smoothScroll = { type: "native", details: {} };
    var root = roots[0];

    var htmlCl = document.documentElement.className || "";
    var lenisInst = window.lenis || window.__lenis;
    if (lenisInst || /lenis/i.test(htmlCl)) {
      libs.push("Lenis Smooth Scroll");
      smoothScroll.type = "lenis";
      if (lenisInst && lenisInst.options) {
        smoothScroll.details =
          safeSerialize(
            {
              lerp: lenisInst.options.lerp,
              duration: lenisInst.options.duration,
              smoothWheel: lenisInst.options.smoothWheel,
              orientation: lenisInst.options.orientation
            },
            1
          ) || {};
      }
    }

    var locoNodes = [];
    roots.forEach(function (rt) {
      locoNodes = locoNodes.concat(Array.prototype.slice.call(rt.querySelectorAll("[data-scroll], [data-scroll-speed], [data-scroll-direction]")));
    });
    if (locoNodes.length > 0 || document.querySelector("[data-scroll-container]")) {
      libs.push("Locomotive Scroll");
      if (smoothScroll.type === "native") smoothScroll.type = "locomotive";
      smoothScroll.details.parallaxAttributes = locoNodes.slice(0, 18).map(function (n) {
        return {
          selector: getEmSelector(n),
          speed: n.getAttribute("data-scroll-speed"),
          direction: n.getAttribute("data-scroll-direction"),
          delay: n.getAttribute("data-scroll-delay")
        };
      });
    }

    if (window.ScrollSmoother && typeof window.ScrollSmoother.get === "function" && window.ScrollSmoother.get()) {
      libs.push("GSAP ScrollSmoother");
      smoothScroll.type = "gsap-scrollsmoother";
    }

    var swiperEls = [];
    roots.forEach(function (rt) {
      if (rt.classList && rt.classList.contains("swiper")) swiperEls.push(rt);
      swiperEls = swiperEls.concat(Array.prototype.slice.call(rt.querySelectorAll(".swiper, .swiper-container")));
    });
    var swiperConfigs = [];
    for (var s = 0; s < swiperEls.length; s++) {
      var sw = swiperEls[s].swiper;
      if (sw && sw.params) {
        swiperConfigs.push({
          selector: getEmSelector(swiperEls[s]),
          slidesPerView: sw.params.slidesPerView,
          spaceBetween: sw.params.spaceBetween,
          speed: sw.params.speed,
          loop: sw.params.loop,
          effect: sw.params.effect,
          freeMode: sw.params.freeMode,
          mousewheel: Boolean(sw.params.mousewheel)
        });
      }
    }
    if (swiperEls.length > 0) libs.push("Swiper.js");
    if (window.THREE) libs.push("Three.js (r" + (window.THREE.REVISION || "?") + ")");
    if (window.barba) libs.push("Barba.js");
    if (window.lottie || (root && root.querySelector("lottie-player"))) libs.push("Lottie");
    if (window.__NUXT__ || document.querySelector("[data-v-app]")) libs.push("Vue / Nuxt");
    if (window.__NEXT_DATA__ || document.querySelector("script[src*='/_next/']")) libs.push("Next.js / React");

    return {
      detectedLibraries: libs,
      smoothScroll: smoothScroll,
      swiperConfigs: swiperConfigs
    };
  }

  // Synthesize high-level Algorithmic Patterns from all captured functions
  function synthesizeAlgorithmicPatterns(gsapData, reactData, listenerData, shaderData) {
    var patterns = [];
    var corpus = [];

    if (reactData && reactData.decompiledHookAndHandlerFunctions) {
      reactData.decompiledHookAndHandlerFunctions.forEach(function (f) {
        corpus.push(f.fnSrc);
      });
    }
    if (reactData && reactData.components) {
      reactData.components.forEach(function (c) {
        if (c.mathAndScrollFormulas) corpus = corpus.concat(c.mathAndScrollFormulas);
      });
    }
    if (listenerData) {
      (listenerData.globalScrollAndPointerListeners || []).forEach(function (g) {
        corpus.push(g.fnSrc);
      });
      (listenerData.rafLoopCallbacks || []).forEach(function (r) {
        corpus.push(r.fnSrc);
      });
      (listenerData.inlineAnimationScripts || []).forEach(function (s) {
        corpus.push(s);
      });
    }
    if (gsapData && gsapData.scrollTriggers) {
      gsapData.scrollTriggers.forEach(function (st) {
        if (st.callbacks) {
          Object.keys(st.callbacks).forEach(function (k) {
            corpus.push(st.callbacks[k]);
          });
        }
      });
    }

    var joined = corpus.join("\n");
    if (/mapRange|clamp\s*\(\s*0/.test(joined)) {
      patterns.push({
        pattern: "NORMALIZED_SCROLL_RANGE_MAPPER",
        explanation: "Core function computes normalized progress p = clamp(0, (scroll - start) / (end - start), 1) from element top/height vs viewport height."
      });
    }
    if (/lerp|\*\s*0\.0\d|\*\s*0\.1\d|\+=\s*\([^)]+\)\s*\*\s*0\./.test(joined)) {
      patterns.push({
        pattern: "EXPONENTIAL_LERP_INERTIA_LOOP",
        explanation: "Continuous RAF/frame callback smooths current += (target - current) * dampingFactor for velvety scrub/cursor inertia."
      });
    }
    if (/Math\.sin|Math\.cos|Math\.atan2/.test(joined)) {
      patterns.push({
        pattern: "TRIGONOMETRIC_ORBIT_WAVE_OR_ARC",
        explanation: "Core function drives circular arc, carousel wheel, wave displacement, or angular cursor orientation using sin/cos/atan2."
      });
    }
    if (/currentTime\s*=/.test(joined)) {
      patterns.push({
        pattern: "VIDEO_CURRENT_TIME_SCROLL_SCRUB",
        explanation: "Scroll progress directly scrubs HTMLVideoElement.currentTime across video.duration."
      });
    }
    if (/drawImage/.test(joined)) {
      patterns.push({
        pattern: "CANVAS_2D_FRAME_SEQUENCE_OR_PROCEDURAL",
        explanation: "2D canvas draws procedural frames or sprite/image-sequence frames indexed by scroll progress."
      });
    }
    if (/theme|dark|light|setAttribute\(['"]data-theme/i.test(joined)) {
      patterns.push({
        pattern: "CROSS_SECTION_THEME_STATE_SYNC",
        explanation: "Scroll threshold callback dispatches global theme/store transition across sections."
      });
    }
    if (gsapData && gsapData.scrollTriggers && gsapData.scrollTriggers.some(function (s) { return s.hasContainerAnimation; })) {
      patterns.push({
        pattern: "GSAP_HORIZONTAL_CONTAINER_ANIMATION",
        explanation: "Vertical pin scrubs a horizontal flex track while nested child triggers sync via ScrollTrigger containerAnimation."
      });
    }
    if (shaderData && shaderData.some(function (c) { return (c.capturedShaders && c.capturedShaders.length > 0) || c.reactThreeFiberScene; })) {
      patterns.push({
        pattern: "WEBGL_GLSL_SHADER_STAGE",
        explanation: "Live WebGL / Three.js shader pipeline driven by time, scroll, and pointer uniforms."
      });
    }

    return patterns;
  }

  window.addEventListener("__exactmotion_bridge_req__", function (ev) {
    var detail = ev && ev.detail ? ev.detail : {};
    var requestId = detail.requestId || "default";
    var roots = Array.prototype.slice.call(document.querySelectorAll('[data-em-root="true"]'));

    var gsapData = roots.length ? inspectGSAPDeep(roots) : null;
    var reactData = roots.length ? inspectReactFibersAndLogic(roots) : null;
    var listenerData = roots.length ? inspectEventListenersAndScripts(roots) : null;
    var shaderData = roots.length ? inspectShadersAndWebGL(roots) : [];
    var runtimeData = roots.length ? inspectSmoothScrollAndLibraries(roots) : null;
    var algoPatterns = roots.length ? synthesizeAlgorithmicPatterns(gsapData, reactData, listenerData, shaderData) : [];

    var payload = {
      requestId: requestId,
      bridgeVersion: "3.0.0",
      ok: roots.length > 0,
      rootCount: roots.length,
      algorithmicPatterns: algoPatterns,
      gsap: gsapData,
      reactAndMotion: reactData,
      listenersAndScripts: listenerData,
      webglAndShaders: shaderData,
      runtime: runtimeData
    };

    window.dispatchEvent(
      new CustomEvent("__exactmotion_bridge_res__", {
        detail: JSON.stringify(payload)
      })
    );
  });
})();
