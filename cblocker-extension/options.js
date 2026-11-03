(async function () {
  var NAMES = { social: "Social media", adult: "Adult sites", manual: "Sites you add by hand" };
  var ORDER = [0, 1, 2, 3, 4, 5, 6], LAB = { 0: "Sun", 1: "Mon", 2: "Tue", 3: "Wed", 4: "Thu", 5: "Fri", 6: "Sat" };
  var saved = await CB.getSettings(), until = await CB.getCommitmentUntil();
  var active = until > Date.now();
  var host = document.getElementById("cats"), msg = document.getElementById("msg"), wait = document.getElementById("wait");
  function say(t) { msg.textContent = t; }
  function t12(hhmm) { var p = hhmm.split(":"), h = Number(p[0]); return ((h + 11) % 12 + 1) + ":" + p[1] + " " + (h >= 12 ? "PM" : "AM"); }
  function dateStr(ms) {
    return new Date(ms).toLocaleString("en-US", { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
  }

  Object.keys(NAMES).forEach(function (k) {
    var c = saved[k], el = document.createElement("section");
    el.className = "card"; el.dataset.k = k;
    el.innerHTML =
      '<label class="row"><input type="checkbox" class="en"> <b>' + NAMES[k] + "</b></label>" +
      (k === "manual" ? '<textarea class="sites" rows="4" placeholder="One site per line, for example example.com"></textarea>' : "") +
      '<p class="lbl">Days and hours when you CAN visit</p><div class="days"></div>' +
      '<div class="row"><input type="time" class="st"> to <input type="time" class="ed"></div>';
    var en = el.querySelector(".en");
    en.checked = c.enabled;
    if (active && c.enabled) en.disabled = true; // cannot be turned off during commitment mode
    if (k === "manual") el.querySelector(".sites").value = c.sites.join("\n");
    var days = el.querySelector(".days");
    ORDER.forEach(function (d) {
      var l = document.createElement("label"), i = document.createElement("input");
      i.type = "checkbox"; i.value = d; i.checked = c.window.days.includes(d);
      l.appendChild(i); l.appendChild(document.createTextNode(" " + LAB[d]));
      days.appendChild(l);
    });
    el.querySelector(".st").value = c.window.start;
    el.querySelector(".ed").value = c.window.end;
    host.appendChild(el);
  });
  wait.value = saved.general.waitMinutes;
  if (active) wait.min = String(saved.general.waitMinutes);

  function collect() {
    var out = { general: {} }, ignored = 0, cards = host.querySelectorAll(".card");
    var w = Number(wait.value);
    if (!Number.isInteger(w) || w < 3 || w > 120) return { error: "The wait must be a whole number of minutes between 3 and 120." };
    out.general.waitMinutes = w;
    for (var n = 0; n < cards.length; n++) {
      var el = cards[n], k = el.dataset.k;
      var days = Array.from(el.querySelectorAll(".days input:checked")).map(function (i) { return Number(i.value); });
      var st = el.querySelector(".st").value, ed = el.querySelector(".ed").value;
      var enabled = el.querySelector(".en").checked;
      if (enabled && (!days.length || !st || !ed || st === ed))
        return { error: NAMES[k] + ": choose at least one day and different start and end times." };
      out[k] = { enabled: enabled, window: { days: days, start: st || "20:00", end: ed || "21:00" } };
      if (k === "manual") {
        var sites = [];
        el.querySelector(".sites").value.split("\n").forEach(function (line) {
          if (!line.trim()) return;
          var d = CB.normalizeSite(line);
          if (d) { if (sites.indexOf(d) < 0) sites.push(d); } else ignored++;
        });
        out[k].sites = sites;
      }
    }
    return { settings: out, ignored: ignored };
  }

  async function save() {
    var r = collect();
    if (r.error) { say(r.error); return false; }
    if (active) {
      var v = CB.tighten(saved, r.settings);
      if (v.length) { say("Commitment mode is on. These changes are not allowed:\n- " + v.join("\n- ")); return false; }
    }
    await chrome.storage.local.set({ settings: r.settings });
    saved = r.settings;
    var sitesBox = host.querySelector(".sites");
    if (sitesBox) sitesBox.value = saved.manual.sites.join("\n");
    say("Saved." + (r.ignored ? " " + r.ignored + " line(s) that did not look like a valid site were ignored." : ""));
    renderCommit();
    return true;
  }
  document.getElementById("save").addEventListener("click", save);

  function renderCommit() {
    var st = document.getElementById("cstatus"), box = document.getElementById("cstart");
    if (active) {
      st.textContent = "Commitment mode is ON until " + dateStr(until) + ". Your rules can only be made stricter until then.";
      box.hidden = true;
      return;
    }
    st.textContent = until ? "Commitment mode ended on " + dateStr(until) + "." : "Commitment mode is off.";
    box.hidden = false;
    var ul = document.getElementById("csum");
    ul.textContent = "";
    Object.keys(NAMES).forEach(function (k) {
      var c = saved[k];
      if (!c.enabled) return;
      var li = document.createElement("li");
      li.textContent = NAMES[k] + ": you can visit " + c.window.days.map(function (d) { return LAB[d]; }).join(", ") +
        " from " + t12(c.window.start) + " to " + t12(c.window.end) + (k === "manual" ? " (" + c.sites.length + " site(s))" : "");
      ul.appendChild(li);
    });
    var lw = document.createElement("li");
    lw.textContent = "Wait before unlocking: " + saved.general.waitMinutes + " minutes";
    ul.appendChild(lw);
  }

  document.getElementById("cgo").addEventListener("click", async function () {
    if (!document.getElementById("ack").checked) { say("Check the box to confirm you understand."); return; }
    if (!(await save())) return;
    if (!["social", "adult", "manual"].some(function (k) { return saved[k].enabled; })) {
      say("Turn on at least one category before starting commitment mode.");
      return;
    }
    var days = Number(document.getElementById("cdays").value);
    await chrome.storage.local.set({ commitmentUntil: Date.now() + days * 86400000 });
    location.reload();
  });

  async function status() {
    var ok = await chrome.permissions.contains({ origins: ["<all_urls>"] });
    document.getElementById("hostst").textContent = ok ? "enabled." : "not enabled.";
    document.getElementById("host").hidden = ok;
    var inc = await chrome.extension.isAllowedIncognitoAccess();
    document.getElementById("incst").textContent = inc ? "allowed." : "not allowed yet.";
    var warn = [];
    if (!ok) warn.push("the block screen permission is not enabled");
    if (!inc) warn.push("incognito windows are not covered yet");
    document.getElementById("cwarn").textContent = warn.length ? "Heads up: " + warn.join(" and ") + ". You can still start, but these gaps stay open during commitment mode." : "";
  }
  document.getElementById("host").addEventListener("click", async function () {
    await chrome.permissions.request({ origins: ["<all_urls>"] });
    status();
  });
  renderCommit();
  status();
})();
