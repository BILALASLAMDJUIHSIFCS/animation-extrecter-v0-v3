// ExactMotion Cloner v3.0 — Multi-Section Interactive Selector, Live Logic HUD & Orchestrator

(function () {
  var NS = (globalThis.__ExactMotion = globalThis.__ExactMotion || {});
  if (NS.ContentControllerV3Installed) return;
  NS.ContentControllerV3Installed = true;

  var state = {
    mode: "IDLE", // IDLE | SELECTING | RECORDING | COMPLETED
    hoveredEl: null,
    childHistory: [],
    queuedSections: [], // Supports Shift+Click multi-section chaining!
    selectedRoots: [],
    linkedPortals: [],
    targetFramework: "html-gsap", // "html-gsap" | "react-nextjs"
    recorder: null,
    bridgeData: null,
    lastCompiledPrompt: "",
    lastStandaloneHtml: "",
    lastSummary: null,
    rectTimer: null
  };

  var hostEl = null;
  var shadow = null;
  var hoverBox = null;
  var multiBoxesContainer = null;
  var inspectLabel = null;
  var hudPanel = null;
  var toastEl = null;

  function ensureUI() {
    if (hostEl && hostEl.isConnected) return;
    hostEl = document.createElement("div");
    hostEl.id = "__exactmotion-host";
    hostEl.setAttribute("data-exactmotion-ui", "true");
    hostEl.style.cssText =
      "position:fixed;inset:0;width:100vw;height:100vh;pointer-events:none;z-index:2147483646;margin:0;padding:0;border:0;background:transparent;";
    shadow = hostEl.attachShadow({ mode: "open" });

    var style = document.createElement("style");
    style.textContent = [
      "* { box-sizing: border-box; font-family: -apple-system, BlinkMacSystemFont, 'Inter', 'Segoe UI', sans-serif; }",
      ".em-highlight {",
      "  position: fixed; pointer-events: none; z-index: 2147483646;",
      "  border: 2px solid #22d3ee; border-radius: 6px;",
      "  background: rgba(34, 211, 238, 0.06);",
      "  box-shadow: 0 0 0 1px rgba(15,23,42,0.5), 0 0 24px rgba(34,211,238,0.22);",
      "  transition: top 40ms linear, left 40ms linear, width 40ms linear, height 40ms linear;",
      "  display: none;",
      "}",
      ".em-multi-box {",
      "  position: fixed; pointer-events: none; z-index: 2147483645;",
      "  border: 1.5px dashed #34d399; border-radius: 6px;",
      "  background: rgba(16, 185, 129, 0.03);",
      "}",
      ".em-multi-box.portal {",
      "  border-color: #a855f7; border-style: dotted;",
      "  background: transparent;",
      "}",
      ".em-multi-tag {",
      "  position: absolute; top: 6px; left: 6px;",
      "  background: rgba(6, 78, 59, 0.92); color: #6ee7b7;",
      "  font-size: 10px; font-weight: 700; font-family: ui-monospace, monospace;",
      "  padding: 2px 6px; border-radius: 4px; border: 1px solid rgba(52,211,153,0.4);",
      "}",
      ".em-multi-box.portal .em-multi-tag {",
      "  background: rgba(59, 7, 100, 0.9); color: #d8b4fe; border-color: rgba(168,85,247,0.45);",
      "}",
      ".em-label {",
      "  position: fixed; pointer-events: none; z-index: 2147483647;",
      "  background: rgba(9, 13, 22, 0.96); color: #f8fafc;",
      "  border: 1px solid rgba(56, 189, 248, 0.45); border-radius: 8px;",
      "  padding: 7px 11px; font-size: 11.5px; line-height: 1.4;",
      "  box-shadow: 0 12px 32px rgba(0,0,0,0.5); backdrop-filter: blur(10px);",
      "  max-width: 480px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;",
      "  display: none;",
      "}",
      ".em-label-tag { color: #22d3ee; font-weight: 700; font-family: ui-monospace, SFMono-Regular, Menlo, monospace; }",
      ".em-label-dim { color: #94a3b8; margin-left: 6px; font-family: ui-monospace, monospace; }",
      ".em-label-hint { color: #cbd5e1; font-size: 10.5px; margin-top: 3px; }",
      ".em-hud {",
      "  position: fixed; right: 18px; bottom: 18px; width: 382px;",
      "  pointer-events: auto; z-index: 2147483647;",
      "  background: rgba(9, 13, 22, 0.97); color: #f1f5f9;",
      "  border: 1px solid rgba(148, 163, 184, 0.25); border-radius: 14px;",
      "  padding: 14px; box-shadow: 0 22px 55px rgba(0,0,0,0.6);",
      "  backdrop-filter: blur(16px); display: none;",
      "}",
      ".em-hud-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px; }",
      ".em-hud-title { display: flex; align-items: center; gap: 8px; font-size: 12.5px; font-weight: 700; letter-spacing: 0.01em; }",
      ".em-dot { width: 8px; height: 8px; border-radius: 999px; background: #ef4444; box-shadow: 0 0 10px #ef4444; animation: emPulse 1.1s infinite ease-in-out; }",
      ".em-dot.done { background: #10b981; box-shadow: 0 0 10px #10b981; animation: none; }",
      ".em-dot.sel { background: #22d3ee; box-shadow: 0 0 10px #22d3ee; }",
      "@keyframes emPulse { 0%, 100% { opacity: 1; transform: scale(1); } 50% { opacity: 0.45; transform: scale(0.85); } }",
      ".em-badge { font-size: 10.5px; font-family: ui-monospace, monospace; color: #38bdf8; background: rgba(56,189,248,0.12); border: 1px solid rgba(56,189,248,0.28); padding: 2px 7px; border-radius: 999px; }",
      ".em-desc { font-size: 11px; color: #94a3b8; margin-bottom: 9px; line-height: 1.42; }",
      ".em-metrics { display: grid; grid-template-columns: repeat(4, 1fr); gap: 5px; margin-bottom: 9px; }",
      ".em-metric { background: rgba(30, 41, 59, 0.65); border: 1px solid rgba(148,163,184,0.14); border-radius: 8px; padding: 5px 7px; }",
      ".em-metric-k { font-size: 9px; text-transform: uppercase; letter-spacing: 0.04em; color: #94a3b8; }",
      ".em-metric-v { font-size: 12.5px; font-weight: 700; color: #f8fafc; font-family: ui-monospace, monospace; margin-top: 2px; }",
      ".em-scroll-wrap { background: rgba(30,41,59,0.55); border: 1px solid rgba(148,163,184,0.14); border-radius: 8px; padding: 7px 9px; margin-bottom: 9px; }",
      ".em-scroll-top { display: flex; justify-content: space-between; font-size: 10px; color: #cbd5e1; margin-bottom: 5px; font-family: ui-monospace, monospace; }",
      ".em-bar-bg { position: relative; height: 6px; background: rgba(15,23,42,0.9); border-radius: 999px; overflow: hidden; }",
      ".em-bar-cov { position: absolute; top: 0; bottom: 0; background: linear-gradient(90deg, #06b6d4, #8b5cf6); border-radius: 999px; }",
      ".em-bar-head { position: absolute; top: -1px; bottom: -1px; width: 3px; background: #ffffff; border-radius: 2px; }",
      ".em-seg-row { display: flex; gap: 4px; background: rgba(15,23,42,0.75); padding: 3px; border-radius: 8px; border: 1px solid rgba(148,163,184,0.16); margin-bottom: 8px; }",
      ".em-seg { flex: 1; border: 0; background: transparent; color: #94a3b8; font-size: 10.5px; font-weight: 600; padding: 5px 6px; border-radius: 6px; cursor: pointer; }",
      ".em-seg.active { background: rgba(56,189,248,0.18); color: #f8fafc; border: 1px solid rgba(56,189,248,0.35); }",
      ".em-btn-row { display: flex; gap: 6px; margin-top: 6px; }",
      ".em-btn {",
      "  flex: 1; border: 1px solid rgba(148,163,184,0.24); background: rgba(30,41,59,0.82); color: #e2e8f0;",
      "  border-radius: 8px; padding: 7px 8px; font-size: 11px; font-weight: 600; cursor: pointer;",
      "  transition: background 120ms ease, border-color 120ms ease, transform 80ms ease; text-align: center;",
      "}",
      ".em-btn:hover { background: rgba(51,65,85,0.95); border-color: rgba(148,163,184,0.45); }",
      ".em-btn:active { transform: scale(0.98); }",
      ".em-btn-primary { background: linear-gradient(135deg, #06b6d4, #6366f1); border-color: rgba(99,102,241,0.6); color: #ffffff; }",
      ".em-btn-primary:hover { background: linear-gradient(135deg, #0891b2, #4f46e5); border-color: #818cf8; }",
      ".em-btn-danger { flex: 0 0 auto; color: #fca5a5; border-color: rgba(239,68,68,0.3); background: rgba(127,29,29,0.28); padding: 7px 10px; }",
      ".em-toast {",
      "  position: fixed; top: 18px; left: 50%; transform: translateX(-50%);",
      "  pointer-events: none; z-index: 2147483647;",
      "  background: rgba(6, 78, 59, 0.96); color: #ecfdf5;",
      "  border: 1px solid rgba(52, 211, 153, 0.55); border-radius: 999px;",
      "  padding: 8px 16px; font-size: 12px; font-weight: 600;",
      "  box-shadow: 0 12px 30px rgba(0,0,0,0.45); display: none;",
      "}"
    ].join("\n");

    multiBoxesContainer = document.createElement("div");
    hoverBox = document.createElement("div");
    hoverBox.className = "em-highlight";
    inspectLabel = document.createElement("div");
    inspectLabel.className = "em-label";
    hudPanel = document.createElement("div");
    hudPanel.className = "em-hud";
    toastEl = document.createElement("div");
    toastEl.className = "em-toast";

    shadow.appendChild(style);
    shadow.appendChild(multiBoxesContainer);
    shadow.appendChild(hoverBox);
    shadow.appendChild(inspectLabel);
    shadow.appendChild(hudPanel);
    shadow.appendChild(toastEl);

    (document.documentElement || document.body).appendChild(hostEl);
  }

  function showToast(msg, duration) {
    ensureUI();
    toastEl.textContent = msg;
    toastEl.style.display = "block";
    clearTimeout(toastEl._timer);
    toastEl._timer = setTimeout(function () {
      toastEl.style.display = "none";
    }, duration || 3200);
  }

  function renderMultiOutlines(sections, portals) {
    if (!multiBoxesContainer) return;
    multiBoxesContainer.innerHTML = "";

    (sections || []).forEach(function (sec, i) {
      if (!sec || !sec.isConnected) return;
      var r = sec.getBoundingClientRect();
      if (r.bottom < -50 || r.top > window.innerHeight + 50) return;
      var b = document.createElement("div");
      b.className = "em-multi-box";
      b.style.top = Math.round(r.top) + "px";
      b.style.left = Math.round(r.left) + "px";
      b.style.width = Math.max(2, Math.round(r.width)) + "px";
      b.style.height = Math.max(2, Math.round(r.height)) + "px";
      b.innerHTML = '<span class="em-multi-tag">SECTION ' + (i + 1) + "</span>";
      multiBoxesContainer.appendChild(b);
    });

    (portals || []).forEach(function (portal, pIdx) {
      if (!portal || !portal.isConnected) return;
      var r = portal.getBoundingClientRect();
      var b = document.createElement("div");
      b.className = "em-multi-box portal";
      b.style.top = Math.round(r.top) + "px";
      b.style.left = Math.round(r.left) + "px";
      b.style.width = Math.max(2, Math.round(r.width)) + "px";
      b.style.height = Math.max(2, Math.round(r.height)) + "px";
      b.innerHTML = '<span class="em-multi-tag">LINKED STAGE ' + (pIdx + 1) + "</span>";
      multiBoxesContainer.appendChild(b);
    });
  }

  function updateHoverHighlight(el) {
    if (!el || !el.isConnected) {
      if (hoverBox) hoverBox.style.display = "none";
      if (inspectLabel) inspectLabel.style.display = "none";
      return;
    }
    var r = el.getBoundingClientRect();
    hoverBox.style.display = "block";
    hoverBox.style.top = Math.round(r.top) + "px";
    hoverBox.style.left = Math.round(r.left) + "px";
    hoverBox.style.width = Math.max(2, Math.round(r.width)) + "px";
    hoverBox.style.height = Math.max(2, Math.round(r.height)) + "px";

    var tag = el.tagName.toLowerCase();
    var idStr = el.id ? "#" + el.id : "";
    var cls =
      typeof el.className === "string" && el.className.trim()
        ? "." + el.className.trim().split(/\s+/).slice(0, 2).join(".")
        : "";
    var qCount = state.queuedSections.length;
    inspectLabel.innerHTML =
      '<div><span class="em-label-tag">' +
      tag +
      idStr +
      cls +
      '</span><span class="em-label-dim">' +
      Math.round(r.width) +
      " × " +
      Math.round(r.height) +
      "px" +
      (qCount > 0 ? " · " + qCount + " queued" : "") +
      "</span></div>" +
      '<div class="em-label-hint"><b>Click</b> Start Capture · <b>Shift+Click</b> Queue Multi-Section · <b>[↑/↓]</b> Parent/Child</div>';
    inspectLabel.style.display = "block";
    var labelTop = r.top - 50;
    if (labelTop < 8) labelTop = Math.min(window.innerHeight - 56, r.bottom + 8);
    var labelLeft = Math.max(8, Math.min(window.innerWidth - 460, r.left));
    inspectLabel.style.top = Math.round(labelTop) + "px";
    inspectLabel.style.left = Math.round(labelLeft) + "px";
  }

  function requestMainWorldIntrospection(callback) {
    var reqId = "req_v3_" + Date.now() + "_" + Math.random().toString(36).slice(2, 7);
    var done = false;

    function onBridgeResponse(ev) {
      if (done) return;
      try {
        var parsed = typeof ev.detail === "string" ? JSON.parse(ev.detail) : ev.detail;
        if (parsed && parsed.requestId === reqId) {
          done = true;
          window.removeEventListener("__exactmotion_bridge_res__", onBridgeResponse);
          callback(parsed);
        }
      } catch (_) {}
    }

    window.addEventListener("__exactmotion_bridge_res__", onBridgeResponse);

    try {
      chrome.runtime.sendMessage({ type: "INJECT_MAIN_BRIDGE" }, function () {
        void chrome.runtime.lastError;
        window.dispatchEvent(new CustomEvent("__exactmotion_bridge_req__", { detail: { requestId: reqId } }));
      });
    } catch (_) {
      window.dispatchEvent(new CustomEvent("__exactmotion_bridge_req__", { detail: { requestId: reqId } }));
    }

    setTimeout(function () {
      if (!done) {
        done = true;
        window.removeEventListener("__exactmotion_bridge_res__", onBridgeResponse);
        callback(null);
      }
    }, 850);
  }

  async function copyTextSafe(text) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch (_) {
      try {
        var ta = document.createElement("textarea");
        ta.value = text;
        ta.setAttribute("readonly", "readonly");
        ta.style.cssText = "position:fixed;top:-9999px;left:-9999px;opacity:0;";
        document.body.appendChild(ta);
        ta.select();
        var ok = document.execCommand("copy");
        ta.remove();
        return ok;
      } catch (_2) {
        return false;
      }
    }
  }

  function triggerFileDownload(filename, content, mimeType) {
    var blob = new Blob([content], { type: mimeType || "text/plain;charset=utf-8" });
    var url = URL.createObjectURL(blob);
    var a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(function () {
      URL.revokeObjectURL(url);
    }, 2000);
  }

  function onSelectPointerMove(ev) {
    if (state.mode !== "SELECTING") return;
    if (ev.target && ev.target.closest && ev.target.closest("#__exactmotion-host")) return;

    var el = document.elementFromPoint(ev.clientX, ev.clientY);
    if (!el || el === document.documentElement || el === document.body || el === hostEl) return;
    if (el !== state.hoveredEl) {
      state.hoveredEl = el;
      state.childHistory = [];
      updateHoverHighlight(el);
    }
  }

  function onSelectClick(ev) {
    if (state.mode !== "SELECTING") return;
    if (ev.target && ev.target.closest && ev.target.closest("#__exactmotion-host")) return;
    ev.preventDefault();
    ev.stopPropagation();
    ev.stopImmediatePropagation();

    var chosen = state.hoveredEl || document.elementFromPoint(ev.clientX, ev.clientY);
    if (!chosen) return;

    // Shift+Click adds/removes section in multi-section queue without starting yet!
    if (ev.shiftKey) {
      var existingIdx = state.queuedSections.indexOf(chosen);
      if (existingIdx !== -1) {
        state.queuedSections.splice(existingIdx, 1);
      } else {
        state.queuedSections.push(chosen);
      }
      state.queuedSections = NS.Extractor.normalizeRoots(state.queuedSections);
      renderMultiOutlines(state.queuedSections, []);
      renderSelectingHUD();
      updateHoverHighlight(chosen);
      showToast("Queued " + state.queuedSections.length + " linked section(s). Click Start or Shift+Click more!", 2400);
      return;
    }

    var finalSections = state.queuedSections.slice();
    if (finalSections.indexOf(chosen) === -1) {
      finalSections.push(chosen);
    }
    detachSelectorListeners();
    beginLiveRecording(finalSections);
  }

  function onSelectKeyDown(ev) {
    if (state.mode === "SELECTING") {
      if (ev.key === "Escape") {
        ev.preventDefault();
        cancelAll();
      } else if (
        ev.key === "ArrowUp" &&
        state.hoveredEl &&
        state.hoveredEl.parentElement &&
        state.hoveredEl.parentElement !== document.documentElement &&
        state.hoveredEl.parentElement !== document.body
      ) {
        ev.preventDefault();
        state.childHistory.push(state.hoveredEl);
        state.hoveredEl = state.hoveredEl.parentElement;
        updateHoverHighlight(state.hoveredEl);
      } else if (ev.key === "ArrowDown" && state.childHistory.length > 0) {
        ev.preventDefault();
        state.hoveredEl = state.childHistory.pop();
        updateHoverHighlight(state.hoveredEl);
      } else if (ev.key === "Enter") {
        ev.preventDefault();
        var targets = state.queuedSections.slice();
        if (state.hoveredEl && targets.indexOf(state.hoveredEl) === -1) targets.push(state.hoveredEl);
        if (targets.length > 0) {
          detachSelectorListeners();
          beginLiveRecording(targets);
        }
      }
    } else if (state.mode === "RECORDING" && ev.key === "Escape") {
      cancelAll();
    }
  }

  function attachSelectorListeners() {
    window.addEventListener("pointermove", onSelectPointerMove, true);
    window.addEventListener("click", onSelectClick, true);
    window.addEventListener("keydown", onSelectKeyDown, true);
  }

  function detachSelectorListeners() {
    window.removeEventListener("pointermove", onSelectPointerMove, true);
    window.removeEventListener("click", onSelectClick, true);
  }

  function renderSelectingHUD() {
    if (state.queuedSections.length === 0) {
      hudPanel.style.display = "none";
      return;
    }
    hudPanel.style.display = "block";
    hudPanel.innerHTML = [
      '<div class="em-hud-header">',
      '  <div class="em-hud-title"><span class="em-dot sel"></span><span>MULTI-SECTION CHAIN (' + state.queuedSections.length + ")</span></div>",
      '  <span class="em-badge">v3.0 GRAPH</span>',
      "</div>",
      '<div class="em-desc"><b>Shift+Click</b> more sections on the page to link their scroll choreography, or click below to lock &amp; record all <b>' +
        state.queuedSections.length +
        "</b> together.</div>",
      '<div class="em-btn-row">',
      '  <button class="em-btn em-btn-primary" id="em-btn-start-chain">▶ Lock &amp; Record ' + state.queuedSections.length + " Linked Sections</button>",
      '  <button class="em-btn em-btn-danger" id="em-btn-cancel-sel">✕</button>',
      "</div>"
    ].join("");

    shadow.getElementById("em-btn-start-chain").addEventListener("click", function (e) {
      e.stopPropagation();
      detachSelectorListeners();
      beginLiveRecording(state.queuedSections.slice());
    });
    shadow.getElementById("em-btn-cancel-sel").addEventListener("click", function (e) {
      e.stopPropagation();
      cancelAll();
    });
  }

  function startSelectorMode() {
    ensureUI();
    if (state.recorder && state.recorder.isRecording()) {
      state.recorder.stop();
    }
    clearInterval(state.rectTimer);
    state.mode = "SELECTING";
    state.hoveredEl = null;
    state.childHistory = [];
    state.queuedSections = [];
    multiBoxesContainer.innerHTML = "";
    hudPanel.style.display = "none";
    inspectLabel.style.display = "none";
    hoverBox.style.display = "none";

    attachSelectorListeners();
    showToast("Click a section to capture · Shift+Click to chain multiple linked sections · [↑/↓] Parent", 4000);
  }

  function renderRecordingHUD() {
    hudPanel.style.display = "block";
    hudPanel.innerHTML = [
      '<div class="em-hud-header">',
      '  <div class="em-hud-title"><span class="em-dot"></span><span>v3.0 LOGIC &amp; MOTION REC</span></div>',
      '  <span class="em-badge" id="em-fps-badge">60 FPS · 0.0s</span>',
      "</div>",
      '<div class="em-desc">Scroll across all linked sections, hover elements, or click <b>⚡ Auto-Choreography</b> to sweep scroll + hovers + decompile core JS logic.</div>',
      '<div class="em-seg-row">',
      '  <button class="em-seg ' + (state.targetFramework === "html-gsap" ? "active" : "") + '" id="em-fmt-html">Standalone HTML + GSAP</button>',
      '  <button class="em-seg ' + (state.targetFramework === "react-nextjs" ? "active" : "") + '" id="em-fmt-react">React / Next.js + Motion</button>',
      "</div>",
      '<div class="em-scroll-wrap">',
      '  <div class="em-scroll-top"><span id="em-scroll-src">Master Scroll: 0%</span><span id="em-scroll-cov">Range: 0%→0%</span></div>',
      '  <div class="em-bar-bg"><div class="em-bar-cov" id="em-bar-cov" style="left:0%;width:2%;"></div><div class="em-bar-head" id="em-bar-head" style="left:0%;"></div></div>',
      "</div>",
      '<div class="em-metrics">',
      '  <div class="em-metric"><div class="em-metric-k">Sections</div><div class="em-metric-v" id="em-m-secs">' +
        state.selectedRoots.length +
        (state.linkedPortals.length ? "+" + state.linkedPortals.length : "") +
        "</div></div>",
      '  <div class="em-metric"><div class="em-metric-k">JS Logic</div><div class="em-metric-v" id="em-m-logic">…</div></div>',
      '  <div class="em-metric"><div class="em-metric-k">Animated</div><div class="em-metric-v" id="em-m-anim">0</div></div>',
      '  <div class="em-metric"><div class="em-metric-k">Hovers</div><div class="em-metric-v" id="em-m-hovers">0</div></div>',
      "</div>",
      '<div class="em-btn-row">',
      '  <button class="em-btn" id="em-btn-link-next" title="Link the next sibling section below into this choreography">+ Link Next Section</button>',
      '  <button class="em-btn" id="em-btn-autosweep" title="Sweep scroll + probe hovers automatically">⚡ Auto-Choreography</button>',
      "</div>",
      '<div class="em-btn-row">',
      '  <button class="em-btn em-btn-primary" id="em-btn-finish">✓ Finish &amp; Copy v3.0 Prompt</button>',
      '  <button class="em-btn em-btn-danger" id="em-btn-cancel" title="Cancel">✕</button>',
      "</div>"
    ].join("");

    shadow.getElementById("em-fmt-html").addEventListener("click", function (e) {
      e.stopPropagation();
      state.targetFramework = "html-gsap";
      shadow.getElementById("em-fmt-html").className = "em-seg active";
      shadow.getElementById("em-fmt-react").className = "em-seg";
    });

    shadow.getElementById("em-fmt-react").addEventListener("click", function (e) {
      e.stopPropagation();
      state.targetFramework = "react-nextjs";
      shadow.getElementById("em-fmt-react").className = "em-seg active";
      shadow.getElementById("em-fmt-html").className = "em-seg";
    });

    shadow.getElementById("em-btn-link-next").addEventListener("click", function (e) {
      e.stopPropagation();
      var lastSec = state.selectedRoots[state.selectedRoots.length - 1];
      var nextSec = NS.CrossSectionGraph.findAdjacentSection(lastSec, "next");
      if (!nextSec) {
        showToast("No further sibling section found below.", 2200);
        return;
      }
      if (state.recorder && state.recorder.addLinkedSection(nextSec)) {
        state.selectedRoots = state.recorder.getSelectedRoots();
        state.linkedPortals = state.recorder.getLinkedPortals();
        requestMainWorldIntrospection(function (bData) {
          state.bridgeData = bData;
          updateLogicBadgeCount();
        });
        showToast("Linked Section #" + state.selectedRoots.length + " into Master Timeline!", 2500);
      }
    });

    shadow.getElementById("em-btn-autosweep").addEventListener("click", function (e) {
      e.stopPropagation();
      var btn = e.currentTarget;
      btn.textContent = "Sweeping...";
      btn.disabled = true;
      state.recorder.runAutoHoverProbe(function () {
        state.recorder.runAutoScrollSweep(function () {
          requestMainWorldIntrospection(function (bData) {
            if (bData) state.bridgeData = bData;
            updateLogicBadgeCount();
            btn.textContent = "✓ Swept All";
            btn.disabled = false;
          });
        });
      });
    });

    shadow.getElementById("em-btn-finish").addEventListener("click", function (e) {
      e.stopPropagation();
      finishCaptureAndCompile();
    });

    shadow.getElementById("em-btn-cancel").addEventListener("click", function (e) {
      e.stopPropagation();
      cancelAll();
    });
  }

  function updateLogicBadgeCount() {
    if (!shadow) return;
    var el = shadow.getElementById("em-m-logic");
    if (el) {
      var c = NS.PromptBuilder.countDecompiledFunctions(state.bridgeData);
      el.textContent = String(c);
    }
  }

  function updateRecordingHUD(st) {
    if (state.mode !== "RECORDING" || !shadow) return;
    var fpsEl = shadow.getElementById("em-fps-badge");
    var srcEl = shadow.getElementById("em-scroll-src");
    var covEl = shadow.getElementById("em-scroll-cov");
    var barCov = shadow.getElementById("em-bar-cov");
    var barHead = shadow.getElementById("em-bar-head");
    var mSecs = shadow.getElementById("em-m-secs");
    var mHov = shadow.getElementById("em-m-hovers");
    var mAnim = shadow.getElementById("em-m-anim");

    if (fpsEl) fpsEl.textContent = st.fps + " FPS · " + st.elapsedSec.toFixed(1) + "s";
    var curPct = Math.round(st.scrollProgress * 100);
    var minPct = Math.round(st.scrollMin * 100);
    var maxPct = Math.round(st.scrollMax * 100);
    var arrow = st.scrollDirection === "down" ? " ↓" : st.scrollDirection === "up" ? " ↑" : "";

    if (srcEl) srcEl.textContent = "Master Scroll: " + curPct + "%" + arrow;
    if (covEl) covEl.textContent = "Covered: " + minPct + "%→" + maxPct + "%";
    if (barCov) {
      barCov.style.left = minPct + "%";
      barCov.style.width = Math.max(2, maxPct - minPct) + "%";
    }
    if (barHead) barHead.style.left = Math.min(99, curPct) + "%";
    if (mSecs) mSecs.textContent = st.sectionCount + (st.portalCount ? "+" + st.portalCount : "");
    if (mHov) mHov.textContent = String(st.hoverCount);
    if (mAnim) mAnim.textContent = String(st.animatedNodes);
  }

  function beginLiveRecording(targetElements) {
    state.mode = "RECORDING";
    state.selectedRoots = NS.Extractor.normalizeRoots(targetElements);
    state.bridgeData = null;
    hoverBox.style.display = "none";
    inspectLabel.style.display = "none";

    state.recorder = NS.MotionRecorder.createRecorder(state.selectedRoots, {
      autoLinkPortals: true,
      onStatusUpdate: updateRecordingHUD
    });

    state.selectedRoots = state.recorder.getSelectedRoots();
    state.linkedPortals = state.recorder.getLinkedPortals();

    renderMultiOutlines(state.selectedRoots, state.linkedPortals);
    renderRecordingHUD();

    clearInterval(state.rectTimer);
    state.rectTimer = setInterval(function () {
      if (state.mode === "RECORDING") {
        renderMultiOutlines(state.selectedRoots, state.linkedPortals);
      }
    }, 60);

    requestMainWorldIntrospection(function (bData) {
      state.bridgeData = bData;
      updateLogicBadgeCount();
    });

    state.recorder.start();

    try {
      chrome.runtime.sendMessage(
        { type: "CAPTURE_STATE_CHANGED", state: "RECORDING", sectionCount: state.selectedRoots.length },
        function () {
          void chrome.runtime.lastError;
        }
      );
    } catch (_) {}
  }

  async function finishCaptureAndCompile() {
    if (state.mode !== "RECORDING" || !state.selectedRoots.length || !state.recorder) return;

    clearInterval(state.rectTimer);

    // Refresh MAIN world bridge one final time so any newly created ScrollTriggers/shaders/listeners are captured!
    await new Promise(function (resolve) {
      requestMainWorldIntrospection(function (freshBridge) {
        if (freshBridge && freshBridge.ok) state.bridgeData = freshBridge;
        resolve();
      });
    });

    var motionTelemetry = state.recorder.stop();
    var extraction = NS.Extractor.extractAll(state.selectedRoots, state.linkedPortals);

    var prompt = NS.PromptBuilder.buildPrompt(extraction, motionTelemetry, state.bridgeData, {
      targetFramework: state.targetFramework
    });
    var standaloneHtml = NS.PromptBuilder.buildStandaloneHtml(extraction, motionTelemetry);
    var logicFnCount = NS.PromptBuilder.countDecompiledFunctions(state.bridgeData);

    state.mode = "COMPLETED";
    state.lastCompiledPrompt = prompt;
    state.lastStandaloneHtml = standaloneHtml;
    state.lastSummary = {
      url: location.href,
      title: document.title,
      target: extraction.targetDescriptor,
      sectionCount: extraction.sectionCount,
      portalCount: extraction.portalCount,
      targetFramework: state.targetFramework,
      promptSizeKb: Math.round((prompt.length / 1024) * 10) / 10,
      logicFunctionsCount: logicFnCount,
      scrollScrubs: motionTelemetry.scrollScrubAnimations.length,
      scrollReveals: motionTelemetry.scrollRevealAnimations.length,
      hovers: motionTelemetry.hoverInteractions.length,
      pointerEffects: motionTelemetry.pointerReactiveEffects.length,
      waapiCount: motionTelemetry.waapiAnimations.length,
      timestamp: new Date().toISOString()
    };

    var copied = await copyTextSafe(prompt);

    try {
      chrome.storage.local.set({
        exactMotionLastCapture: {
          summary: state.lastSummary,
          prompt: prompt.length < 2200000 ? prompt : prompt.slice(0, 2200000),
          standaloneHtml: standaloneHtml.length < 2200000 ? standaloneHtml : ""
        }
      });
      chrome.runtime.sendMessage({ type: "CAPTURE_STATE_CHANGED", state: "COMPLETED" }, function () {
        void chrome.runtime.lastError;
      });
    } catch (_) {}

    renderCompletedHUD(copied);
    showToast(
      copied
        ? "✓ v3.0 Multi-Section & Core Logic Prompt Copied! (" + state.lastSummary.promptSizeKb + " KB)"
        : "✓ Prompt Compiled! Click 'Copy Prompt' below.",
      4200
    );
  }

  function renderCompletedHUD(copied) {
    var s = state.lastSummary;
    hudPanel.style.display = "block";
    hudPanel.innerHTML = [
      '<div class="em-hud-header">',
      '  <div class="em-hud-title"><span class="em-dot done"></span><span>v3.0 COMPILED (' + s.promptSizeKb + " KB)</span></div>",
      '  <span class="em-badge">' + (copied ? "COPIED ✓" : "READY") + "</span>",
      "</div>",
      '<div class="em-desc">Captured <b>' +
        s.sectionCount +
        " section(s)" +
        (s.portalCount ? " + " + s.portalCount + " portal stage" : "") +
        "</b>, <b>" +
        s.logicFunctionsCount +
        " core JS functions/shaders</b>, <b>" +
        (s.scrollScrubs + s.scrollReveals) +
        " scroll phase curves</b>, and <b>" +
        (s.hovers + s.pointerEffects) +
        " hover/tilt cascades</b>.</div>",
      '<div class="em-btn-row">',
      '  <button class="em-btn em-btn-primary" id="em-btn-copy-again">📋 Copy v3.0 Prompt</button>',
      '  <button class="em-btn" id="em-btn-dl-md">⬇ .md Spec</button>',
      "</div>",
      '<div class="em-btn-row">',
      '  <button class="em-btn" id="em-btn-dl-html">⬇ Replay .html</button>',
      '  <button class="em-btn" id="em-btn-new">↻ New Capture</button>',
      '  <button class="em-btn em-btn-danger" id="em-btn-close">✕</button>',
      "</div>"
    ].join("");

    shadow.getElementById("em-btn-copy-again").addEventListener("click", async function () {
      var ok = await copyTextSafe(state.lastCompiledPrompt);
      showToast(ok ? "✓ Copied to clipboard!" : "Clipboard blocked — use Download .md", 2400);
    });

    shadow.getElementById("em-btn-dl-md").addEventListener("click", function () {
      triggerFileDownload("exactmotion-v3-prompt.md", state.lastCompiledPrompt, "text/markdown;charset=utf-8");
    });

    shadow.getElementById("em-btn-dl-html").addEventListener("click", function () {
      triggerFileDownload("exactmotion-v3-clone.html", state.lastStandaloneHtml, "text/html;charset=utf-8");
    });

    shadow.getElementById("em-btn-new").addEventListener("click", function () {
      startSelectorMode();
    });

    shadow.getElementById("em-btn-close").addEventListener("click", function () {
      cancelAll();
    });
  }

  function cancelAll() {
    detachSelectorListeners();
    window.removeEventListener("keydown", onSelectKeyDown, true);
    clearInterval(state.rectTimer);
    if (state.recorder && state.recorder.isRecording()) {
      state.recorder.stop();
    }
    NS.Extractor.untagAll();
    state.mode = "IDLE";
    state.hoveredEl = null;
    state.queuedSections = [];
    state.selectedRoots = [];
    state.linkedPortals = [];
    if (multiBoxesContainer) multiBoxesContainer.innerHTML = "";
    if (hoverBox) hoverBox.style.display = "none";
    if (inspectLabel) inspectLabel.style.display = "none";
    if (hudPanel) hudPanel.style.display = "none";

    try {
      chrome.runtime.sendMessage({ type: "CAPTURE_STATE_CHANGED", state: "IDLE" }, function () {
        void chrome.runtime.lastError;
      });
    } catch (_) {}
  }

  chrome.runtime.onMessage.addListener(function (msg, _sender, sendResponse) {
    if (!msg || !msg.type) return false;

    if (msg.type === "PING") {
      sendResponse({ ok: true, mode: state.mode, version: "3.0.0" });
      return false;
    }

    if (msg.type === "START_SELECTOR") {
      if (msg.targetFramework) state.targetFramework = msg.targetFramework;
      startSelectorMode();
      sendResponse({ ok: true, mode: state.mode });
      return false;
    }

    if (msg.type === "AUTO_CHOREOGRAPHY_SWEEP" || msg.type === "AUTO_SCROLL_SWEEP") {
      if (state.mode === "RECORDING" && state.recorder) {
        state.recorder.runAutoHoverProbe(function () {
          state.recorder.runAutoScrollSweep(function () {
            sendResponse({ ok: true });
          });
        });
        return true;
      }
      sendResponse({ ok: false });
      return false;
    }

    if (msg.type === "LINK_NEXT_SECTION") {
      if (state.mode === "RECORDING" && state.recorder && state.selectedRoots.length > 0) {
        var nextSec = NS.CrossSectionGraph.findAdjacentSection(state.selectedRoots[state.selectedRoots.length - 1], "next");
        if (nextSec && state.recorder.addLinkedSection(nextSec)) {
          state.selectedRoots = state.recorder.getSelectedRoots();
          state.linkedPortals = state.recorder.getLinkedPortals();
          sendResponse({ ok: true, sectionCount: state.selectedRoots.length });
          return false;
        }
      }
      sendResponse({ ok: false });
      return false;
    }

    if (msg.type === "FINISH_CAPTURE") {
      if (state.mode === "RECORDING") {
        finishCaptureAndCompile().then(function () {
          sendResponse({ ok: true, mode: state.mode, summary: state.lastSummary });
        });
        return true;
      }
      sendResponse({ ok: false, error: "Not currently recording" });
      return false;
    }

    if (msg.type === "CANCEL_CAPTURE") {
      cancelAll();
      sendResponse({ ok: true, mode: "IDLE" });
      return false;
    }

    if (msg.type === "GET_STATUS") {
      sendResponse({
        ok: true,
        mode: state.mode,
        sectionCount: state.selectedRoots.length,
        targetFramework: state.targetFramework,
        summary: state.lastSummary
      });
      return false;
    }

    return false;
  });
})();
