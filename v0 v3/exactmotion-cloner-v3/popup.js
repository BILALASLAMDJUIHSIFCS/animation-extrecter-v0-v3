(function () {
  var statusPill = document.getElementById("status-pill");
  var errorBox = document.getElementById("error-box");
  var idleActions = document.getElementById("idle-actions");
  var recordingActions = document.getElementById("recording-actions");
  var lastSection = document.getElementById("last-capture-section");

  var fmtHtml = document.getElementById("fmt-html");
  var fmtReact = document.getElementById("fmt-react");

  var btnPick = document.getElementById("btn-pick");
  var btnLinkNext = document.getElementById("btn-link-next");
  var btnAutoScroll = document.getElementById("btn-autoscroll");
  var btnCancel = document.getElementById("btn-cancel");
  var btnFinish = document.getElementById("btn-finish");

  var btnCopyLast = document.getElementById("btn-copy-last");
  var btnDlMd = document.getElementById("btn-dl-md");
  var btnDlHtml = document.getElementById("btn-dl-html");

  var selectedFramework = "html-gsap";
  var cachedCapture = null;

  function showError(msg) {
    errorBox.textContent = msg;
    errorBox.hidden = false;
  }

  function clearError() {
    errorBox.hidden = true;
    errorBox.textContent = "";
  }

  function setFrameworkUI(fmt) {
    selectedFramework = fmt === "react-nextjs" ? "react-nextjs" : "html-gsap";
    fmtHtml.className = selectedFramework === "html-gsap" ? "seg-btn active" : "seg-btn";
    fmtReact.className = selectedFramework === "react-nextjs" ? "seg-btn active" : "seg-btn";
  }

  fmtHtml.addEventListener("click", function () {
    setFrameworkUI("html-gsap");
  });
  fmtReact.addEventListener("click", function () {
    setFrameworkUI("react-nextjs");
  });

  function sendPopupAction(payload, cb) {
    chrome.runtime.sendMessage({ type: "POPUP_ACTION", payload: payload }, function (resp) {
      if (chrome.runtime.lastError) {
        if (cb) cb({ ok: false, error: chrome.runtime.lastError.message });
        return;
      }
      if (cb) cb(resp || { ok: false });
    });
  }

  function setModeUI(mode) {
    statusPill.textContent = mode || "IDLE";
    if (mode === "RECORDING") {
      statusPill.className = "pill rec";
      idleActions.hidden = true;
      recordingActions.hidden = false;
    } else {
      statusPill.className = "pill";
      idleActions.hidden = false;
      recordingActions.hidden = true;
    }
  }

  function loadStoredCapture() {
    chrome.storage.local.get(["exactMotionLastCapture"], function (res) {
      var data = res && res.exactMotionLastCapture;
      if (!data || !data.summary || !data.prompt) {
        lastSection.hidden = true;
        return;
      }
      cachedCapture = data;
      lastSection.hidden = false;
      var s = data.summary;
      document.getElementById("last-kb").textContent = s.promptSizeKb + " KB";
      document.getElementById("last-target").textContent = s.target || "section";
      document.getElementById("last-stats").textContent =
        (s.sectionCount || 1) +
        " sec · " +
        (s.logicFunctionsCount || 0) +
        " core fns · " +
        ((s.scrollScrubs || 0) + (s.scrollReveals || 0)) +
        " scroll curves · " +
        ((s.hovers || 0) + (s.pointerEffects || 0)) +
        " hovers";
    });
  }

  function downloadBlob(filename, content, mime) {
    var blob = new Blob([content], { type: mime });
    var url = URL.createObjectURL(blob);
    var a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(function () {
      URL.revokeObjectURL(url);
    }, 1500);
  }

  btnPick.addEventListener("click", function () {
    clearError();
    sendPopupAction({ type: "START_SELECTOR", targetFramework: selectedFramework }, function (resp) {
      if (!resp || !resp.ok) {
        showError((resp && resp.error) || "Unable to inspect this tab. Switch to any http/https page.");
        return;
      }
      window.close();
    });
  });

  btnLinkNext.addEventListener("click", function () {
    sendPopupAction({ type: "LINK_NEXT_SECTION" }, function (resp) {
      if (resp && resp.ok) {
        btnLinkNext.textContent = "Linked (" + resp.sectionCount + ")";
      } else {
        btnLinkNext.textContent = "No Next Sec";
      }
    });
  });

  btnAutoScroll.addEventListener("click", function () {
    btnAutoScroll.textContent = "Sweeping...";
    btnAutoScroll.disabled = true;
    sendPopupAction({ type: "AUTO_CHOREOGRAPHY_SWEEP" }, function () {
      btnAutoScroll.textContent = "Swept";
      btnAutoScroll.disabled = false;
    });
  });

  btnCancel.addEventListener("click", function () {
    sendPopupAction({ type: "CANCEL_CAPTURE" }, function () {
      setModeUI("IDLE");
    });
  });

  btnFinish.addEventListener("click", function () {
    btnFinish.textContent = "Compiling...";
    btnFinish.disabled = true;
    sendPopupAction({ type: "FINISH_CAPTURE" }, function (resp) {
      btnFinish.textContent = "Finish & Copy v3.0 Prompt";
      btnFinish.disabled = false;
      if (resp && resp.ok) {
        setModeUI("COMPLETED");
        loadStoredCapture();
      } else if (resp && resp.error) {
        showError(resp.error);
      }
    });
  });

  btnCopyLast.addEventListener("click", async function () {
    if (!cachedCapture || !cachedCapture.prompt) return;
    try {
      await navigator.clipboard.writeText(cachedCapture.prompt);
      btnCopyLast.textContent = "Copied!";
      setTimeout(function () {
        btnCopyLast.textContent = "Copy Prompt";
      }, 1600);
    } catch (_) {
      downloadBlob("exactmotion-v3-prompt.md", cachedCapture.prompt, "text/markdown;charset=utf-8");
    }
  });

  btnDlMd.addEventListener("click", function () {
    if (!cachedCapture || !cachedCapture.prompt) return;
    downloadBlob("exactmotion-v3-prompt.md", cachedCapture.prompt, "text/markdown;charset=utf-8");
  });

  btnDlHtml.addEventListener("click", function () {
    if (!cachedCapture || !cachedCapture.standaloneHtml) return;
    downloadBlob("exactmotion-v3-clone.html", cachedCapture.standaloneHtml, "text/html;charset=utf-8");
  });

  loadStoredCapture();
  sendPopupAction({ type: "GET_STATUS" }, function (resp) {
    if (resp && resp.ok) {
      setModeUI(resp.mode);
      if (resp.targetFramework) setFrameworkUI(resp.targetFramework);
    }
  });
})();
