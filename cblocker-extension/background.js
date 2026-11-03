importScripts("shared.js", "lists.js");

async function doApply() {
  var settings = await CB.getSettings();
  var domains = CB.blockedDomains(settings, new Date(), CB_LISTS);
  var hasHost = await chrome.permissions.contains({ origins: ["<all_urls>"] });
  var sig = (hasHost ? "r:" : "b:") + domains.join(",");
  var last = (await chrome.storage.session.get("sig")).sig;
  if (sig !== last) {
    var action = hasHost
      ? { type: "redirect", redirect: { extensionPath: "/blocked.html" } }
      : { type: "block" };
    var rules = [];
    for (var i = 0; i < domains.length; i += 500) {
      rules.push({
        id: rules.length + 1, priority: 1, action: action,
        condition: { requestDomains: domains.slice(i, i + 500), resourceTypes: ["main_frame"] }
      });
    }
    var old = await chrome.declarativeNetRequest.getDynamicRules();
    await chrome.declarativeNetRequest.updateDynamicRules({
      removeRuleIds: old.map(function (r) { return r.id; }), addRules: rules
    });
    await chrome.storage.session.set({ sig: sig });
  }
  // Rules only affect new requests: redirect tabs that are already open.
  if (hasHost && domains.length) await redirectOpenTabs(new Set(domains));
}


// Chrome fires several events at once (install, startup, alarms, storage changes).
// Run the rule update one at a time so two updates never try to add the same rule id.
var queue = Promise.resolve();
function applyAll() {
  queue = queue.then(doApply).catch(function (e) { console.error("CBlocker: applyAll failed", e); });
  return queue;
}

async function redirectOpenTabs(set) {
  var url = chrome.runtime.getURL("blocked.html");
  var tabs = await chrome.tabs.query({});
  tabs.forEach(function (t) {
    if (!t.url || !/^https?:/.test(t.url)) return;
    var host;
    try { host = new URL(t.url).hostname.toLowerCase(); } catch (e) { return; }
    var parts = host.split(".");
    for (var i = 0; i < parts.length - 1; i++) {
      if (set.has(parts.slice(i).join("."))) { chrome.tabs.update(t.id, { url: url }); return; }
    }
  });
}

function ensureAlarm() {
  chrome.alarms.get("tick", function (a) {
    if (!a) chrome.alarms.create("tick", { periodInMinutes: 1 });
  });
}

chrome.runtime.onInstalled.addListener(function (d) {
  ensureAlarm();
  applyAll();
  if (d.reason === "install") chrome.runtime.openOptionsPage();
});
chrome.runtime.onStartup.addListener(function () { ensureAlarm(); applyAll(); });
chrome.alarms.onAlarm.addListener(function (a) { if (a.name === "tick") applyAll(); });
chrome.storage.onChanged.addListener(function (c, area) { if (area === "local" && c.settings) applyAll(); });
chrome.permissions.onAdded.addListener(applyAll);
chrome.permissions.onRemoved.addListener(applyAll);
chrome.action.onClicked.addListener(function () { chrome.runtime.openOptionsPage(); });

ensureAlarm();
applyAll();
