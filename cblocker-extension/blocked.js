(async function () {
  var NAMES = { social: "Social media", adult: "Adult sites", manual: "Sites you added" };
  var s = await CB.getSettings(), now = new Date(), ul = document.getElementById("list"), any = false;
  function t12(hhmm) {
    var p = hhmm.split(":"), h = Number(p[0]), ap = h >= 12 ? "PM" : "AM";
    return ((h + 11) % 12 + 1) + ":" + p[1] + " " + ap;
  }
  function hm(d) { return d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" }); }
  Object.keys(NAMES).forEach(function (k) {
    var c = s[k];
    if (!c.enabled) return;
    any = true;
    var li = document.createElement("li"), txt;
    if (CB.within(c.window, now)) {
      txt = "open now, until " + t12(c.window.end);
    } else {
      var n = CB.nextOpen(c.window, now);
      txt = n ? "opens again on " + n.toLocaleDateString("en-US", { weekday: "long" }) + " at " + hm(n) : "no access schedule set";
    }
    li.textContent = NAMES[k] + ": " + txt;
    ul.appendChild(li);
  });
  if (!any) ul.textContent = "No categories are active.";
  var u = await CB.getCommitmentUntil();
  if (u > Date.now()) document.getElementById("commit").textContent = "Commitment mode is on until " + new Date(u).toLocaleString("en-US", { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }) + ".";
  document.getElementById("opt").addEventListener("click", function (e) {
    e.preventDefault();
    chrome.runtime.openOptionsPage();
  });
})();
