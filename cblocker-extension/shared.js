var CB = (function () {
  var NAMES = { social: "Social media", adult: "Adult sites", manual: "Sites you add by hand" };
  var DAYMIN = 1440, WEEK = 7 * 1440;
  function win() { return { days: [0, 1, 2, 3, 4, 5, 6], start: "20:00", end: "21:00" }; }
  function defaults() {
    return {
      social: { enabled: false, window: win() },
      adult: { enabled: false, window: win() },
      manual: { enabled: false, sites: [], window: win() },
      general: { waitMinutes: 3 }
    };
  }
  async function getSettings() {
    var d = defaults();
    var saved = (await chrome.storage.local.get("settings")).settings || {};
    Object.keys(d).forEach(function (k) { if (saved[k]) Object.assign(d[k], saved[k]); });
    return d;
  }
  async function getCommitmentUntil() {
    return (await chrome.storage.local.get("commitmentUntil")).commitmentUntil || 0;
  }
  function mins(t) { var p = t.split(":"); return Number(p[0]) * 60 + Number(p[1]); }
  // true if "date" falls inside the window when visiting IS allowed.
  function within(w, date) {
    var day = date.getDay(), m = date.getHours() * 60 + date.getMinutes();
    var s = mins(w.start), e = mins(w.end);
    if (s === e) return false;
    if (s < e) return w.days.includes(day) && m >= s && m < e;
    return (w.days.includes(day) && m >= s) || (w.days.includes((day + 6) % 7) && m < e);
  }
  // Next window start after "date", or null if no days are selected.
  function nextOpen(w, date) {
    var s = mins(w.start);
    for (var i = 0; i <= 7; i++) {
      var c = new Date(date.getFullYear(), date.getMonth(), date.getDate() + i, Math.floor(s / 60), s % 60);
      if (w.days.includes(c.getDay()) && c > date) return c;
    }
    return null;
  }
  // Minutes of the week (0 = Sunday 00:00) in which a window allows access.
  function slots(w) {
    var a = new Uint8Array(WEEK), s = mins(w.start), e = mins(w.end), m;
    if (s === e) return a;
    (w.days || []).forEach(function (d) {
      if (s < e) { for (m = s; m < e; m++) a[d * DAYMIN + m] = 1; }
      else {
        for (m = s; m < DAYMIN; m++) a[d * DAYMIN + m] = 1;
        var nd = (d + 1) % 7;
        for (m = 0; m < e; m++) a[nd * DAYMIN + m] = 1;
      }
    });
    return a;
  }
  function isSubset(nw, ow) {
    var a = slots(nw), b = slots(ow);
    for (var i = 0; i < WEEK; i++) if (a[i] && !b[i]) return false;
    return true;
  }
  // Commitment mode: lists the changes that would loosen the rules (empty = allowed).
  function tighten(oldS, newS) {
    var out = [];
    ["social", "adult", "manual"].forEach(function (k) {
      var o = oldS[k], n = newS[k];
      if (!o.enabled) return;
      if (!n.enabled) { out.push(NAMES[k] + ": it cannot be turned off."); return; }
      if (!isSubset(n.window, o.window)) out.push(NAMES[k] + ": the access window can only get shorter, not longer or on new days.");
      if (k === "manual") {
        var lost = o.sites.filter(function (x) { return n.sites.indexOf(x) < 0; });
        if (lost.length) out.push(NAMES[k] + ": sites cannot be removed (" + lost.join(", ") + ").");
      }
    });
    if (newS.general.waitMinutes < oldS.general.waitMinutes) out.push("The wait before unlocking can only get longer.");
    return out;
  }
  function normalizeSite(x) {
    var s = String(x || "").trim().toLowerCase();
    s = s.replace(/^[a-z]+:\/\//, "").replace(/^www\./, "").split(/[\/?#:]/)[0];
    return /^[a-z0-9-]+(\.[a-z0-9-]+)+$/.test(s) ? s : "";
  }
  function blockedDomains(settings, date, lists) {
    var seen = new Set();
    ["social", "adult", "manual"].forEach(function (k) {
      var c = settings[k];
      if (!c.enabled || within(c.window, date)) return;
      (k === "manual" ? c.sites : lists[k]).forEach(function (d) { seen.add(d); });
    });
    return Array.from(seen);
  }
  return { getSettings: getSettings, getCommitmentUntil: getCommitmentUntil, within: within,
           nextOpen: nextOpen, slots: slots, isSubset: isSubset, tighten: tighten,
           normalizeSite: normalizeSite, blockedDomains: blockedDomains };
})();
