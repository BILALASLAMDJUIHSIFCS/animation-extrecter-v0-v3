// ExactMotion Cloner v3.0 — Manifest V3 Background Service Worker

var CONTENT_FILES = [
  "extractor.js",
  "crossSectionGraph.js",
  "motionRecorder.js",
  "promptBuilder.js",
  "content.js"
];

function isInjectableUrl(url) {
  if (!url || typeof url !== "string") return false;
  if (
    url.indexOf("chrome://") === 0 ||
    url.indexOf("chrome-extension://") === 0 ||
    url.indexOf("edge://") === 0 ||
    url.indexOf("about:") === 0 ||
    url.indexOf("https://chrome.google.com/webstore") === 0 ||
    url.indexOf("https://chromewebstore.google.com") === 0
  ) {
    return false;
  }
  return true;
}

function sendTabMessagePromise(tabId, payload) {
  return new Promise(function (resolve) {
    try {
      chrome.tabs.sendMessage(tabId, payload, function (resp) {
        if (chrome.runtime.lastError) {
          resolve({ __error: chrome.runtime.lastError.message });
        } else {
          resolve(resp || { ok: true });
        }
      });
    } catch (err) {
      resolve({ __error: String(err) });
    }
  });
}

async function ensureAndSendToTab(tabId, tabUrl, payload) {
  if (!isInjectableUrl(tabUrl)) {
    return {
      ok: false,
      error: "Browser internal pages (chrome:// or Web Store) cannot be inspected. Switch to any http/https website."
    };
  }

  var ping = await sendTabMessagePromise(tabId, { type: "PING" });
  if (ping && ping.__error) {
    try {
      // Ensure MAIN world bridge is injected for tabs opened before extension install/reload
      await chrome.scripting.executeScript({
        target: { tabId: tabId },
        world: "MAIN",
        files: ["pageBridge.js"]
      }).catch(function () {});

      await chrome.scripting.executeScript({
        target: { tabId: tabId },
        files: CONTENT_FILES
      });
    } catch (injectErr) {
      return {
        ok: false,
        error:
          "Could not inject ExactMotion v3.0 scripts into this tab: " +
          (injectErr && injectErr.message ? injectErr.message : String(injectErr))
      };
    }
  }

  var res = await sendTabMessagePromise(tabId, payload);
  if (res && res.__error) {
    return { ok: false, error: res.__error };
  }
  return res;
}

function updateBadge(tabId, stateName, sectionCount) {
  if (!tabId) return;
  if (stateName === "SELECTING") {
    chrome.action.setBadgeText({ tabId: tabId, text: sectionCount > 0 ? String(sectionCount) + "+" : "SEL" });
    chrome.action.setBadgeBackgroundColor({ tabId: tabId, color: "#06b6d4" });
  } else if (stateName === "RECORDING") {
    chrome.action.setBadgeText({ tabId: tabId, text: "REC" });
    chrome.action.setBadgeBackgroundColor({ tabId: tabId, color: "#ef4444" });
  } else if (stateName === "COMPLETED") {
    chrome.action.setBadgeText({ tabId: tabId, text: "v3" });
    chrome.action.setBadgeBackgroundColor({ tabId: tabId, color: "#10b981" });
  } else {
    chrome.action.setBadgeText({ tabId: tabId, text: "" });
  }
}

chrome.runtime.onMessage.addListener(function (msg, sender, sendResponse) {
  if (!msg || !msg.type) return false;

  if (msg.type === "INJECT_MAIN_BRIDGE") {
    var tabId = sender && sender.tab && sender.tab.id;
    if (!tabId) {
      sendResponse({ ok: false });
      return false;
    }
    chrome.scripting
      .executeScript({
        target: { tabId: tabId },
        world: "MAIN",
        files: ["pageBridge.js"]
      })
      .then(function () {
        sendResponse({ ok: true });
      })
      .catch(function (err) {
        sendResponse({ ok: false, error: String(err) });
      });
    return true;
  }

  if (msg.type === "CAPTURE_STATE_CHANGED") {
    var senderTabId = sender && sender.tab && sender.tab.id;
    updateBadge(senderTabId, msg.state, msg.sectionCount || 0);
    sendResponse({ ok: true });
    return false;
  }

  if (msg.type === "POPUP_ACTION") {
    chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
      var activeTab = tabs && tabs[0];
      if (!activeTab || !activeTab.id) {
        sendResponse({ ok: false, error: "No active browser tab found." });
        return;
      }
      ensureAndSendToTab(activeTab.id, activeTab.url || "", msg.payload).then(function (result) {
        sendResponse(result);
      });
    });
    return true;
  }

  return false;
});

chrome.commands.onCommand.addListener(function (command) {
  chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
    var activeTab = tabs && tabs[0];
    if (!activeTab || !activeTab.id) return;

    if (command === "toggle-selector") {
      ensureAndSendToTab(activeTab.id, activeTab.url || "", { type: "START_SELECTOR" });
    } else if (command === "auto-link-and-sweep") {
      ensureAndSendToTab(activeTab.id, activeTab.url || "", { type: "AUTO_CHOREOGRAPHY_SWEEP" });
    } else if (command === "finish-capture") {
      ensureAndSendToTab(activeTab.id, activeTab.url || "", { type: "FINISH_CAPTURE" });
    }
  });
});
