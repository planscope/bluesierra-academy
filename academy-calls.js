/* Blue Sierra Academy — "Calls" tab (setter call log) and "Report" tab (Jesús only).
   Talks to the Google Apps Script in the Setter Call List (apps-script/Code.gs).
   Without an API URL (preview), it runs on fictional sample firms saved in this browser. */
(function () {
  "use strict";
  var OUTCOMES = [["no_answer", "No answer"], ["vm", "Voicemail"], ["conversation", "Conversation"], ["booked", "Booked"], ["declined", "Declined"]];
  var CHANNELS = [["call", "Call"], ["voicemail", "Voicemail"], ["email", "Email"], ["linkedin", "LinkedIn"]];
  var TALKED = ["conversation", "booked", "declined"];
  var st = { firms: null, mine: null, error: null, filter: "due", prio: "", q: "", open: null, saving: false, preview: false, report: null, days: 7 };

  function label(list, v) { for (var i = 0; i < list.length; i++) if (list[i][0] === v) return list[i][1]; return v || ""; }
  function today() { var d = new Date(); return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0"); }
  function cfg(cx) { return cx.content.calls || {}; }
  function key(cx) { return (cx.member.fields || {})[cfg(cx).keyField || "call-key"] || ""; }
  function live(cx) { var u = cfg(cx).api; return !!(u && !/^PASTE_/.test(u)); }

  /* ---------------- API (Apps Script or preview mock) ---------------- */
  async function api(cx, method, params) {
    if (!live(cx)) return mock(cx, method, params);
    // Always POST: keys never go in a URL. text/plain keeps it a "simple" request, so Apps Script needs no CORS preflight.
    var res = await fetch(cfg(cx).api, { method: "POST", headers: { "Content-Type": "text/plain;charset=utf-8" }, body: JSON.stringify(params) });
    var data = await res.json();
    if (!data.ok) throw new Error(data.error || "Something went wrong.");
    return data;
  }

  var MOCK_KEY = "bsa-demo-calls";
  var SAMPLE = [
    ["A", "Northgate Studio", "Architect", "Palo Alto"], ["A", "Laurel & Pine Landscape Architecture", "Landscape Architect", "Menlo Park"],
    ["A", "Crestline Homes", "Builder", "Los Altos"], ["A", "Hillview Design Group", "Architect", "Atherton"],
    ["B", "Oakmont Residential", "Developer", "San José"], ["B", "Fieldstone Architects", "Architect", "Saratoga"],
    ["B", "Redwood Grove Builders", "Builder", "Woodside"], ["B", "Juniper Lane Studio", "Landscape Architect", "Los Gatos"],
    ["C", "Bayline Development", "Developer", "Redwood City"], ["C", "Summit Ridge Custom Homes", "Builder", "Cupertino"],
    ["C", "Willow Court Architecture", "Architect", "San Mateo"], ["C", "Granite Path Design", "Landscape Architect", "Burlingame"]
  ];
  function mockDb() {
    try { var d = JSON.parse(localStorage.getItem(MOCK_KEY)); if (d && d.firms) return d; } catch (e) {}
    return {
      log: [],
      firms: SAMPLE.map(function (s, i) {
        return { row: i + 2, priority: s[0], firm: s[1], type: s[2], city: s[3], website: "https://example.com", main_phone: "(650) 555-01" + String(10 + i),
          principal: "Sample contact", high_end_note: "Fictional sample firm for the preview.", source_url: "https://example.com",
          date: "", outcome: "", next_step: "", next_step_date: "", meeting_datetime: "", qualified: "", notes: "" };
      })
    };
  }
  function mockSave(db) { try { localStorage.setItem(MOCK_KEY, JSON.stringify(db)); } catch (e) {} }
  function weekStart() { var d = new Date(), dow = (d.getDay() + 6) % 7; d.setDate(d.getDate() - dow); return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0"); }
  function stats(rows) {
    var f = {}; rows.forEach(function (l) { f[l.firm] = 1; });
    return { touches: rows.length, firms: Object.keys(f).length, conversations: rows.filter(function (l) { return TALKED.indexOf(l.outcome) > -1; }).length,
      booked: rows.filter(function (l) { return l.outcome === "booked"; }).length, qualified: rows.filter(function (l) { return l.outcome === "booked" && l.qualified === "y"; }).length };
  }
  function summarize(log, who) {
    var mine = log.filter(function (l) { return !who || l.setter === who; }), t = today(), w = weekStart();
    return { today: stats(mine.filter(function (l) { return l.date === t; })), week: stats(mine.filter(function (l) { return l.date >= w; })), targets: { firms: 40, conversations: 10 } };
  }
  async function mock(cx, method, p) {
    var db = mockDb(), who = cx.member.name;
    if (method === "GET" && p.action === "firms") return { ok: true, setter: who, firms: db.firms, mine: summarize(db.log, who) };
    if (method === "POST" && p.action === "log") {
      var f = db.firms.filter(function (x) { return x.row === Number(p.row); })[0];
      if (!f || f.firm !== p.firm) throw new Error("That firm is not on the list.");
      if (p.outcome === "booked" && !p.meeting_datetime) throw new Error("A booked meeting needs the date and time it was accepted for.");
      var t = today(), line = t + " " + p.channel + ": " + p.outcome + (p.hot ? " · hot" : "") + (p.note ? " — " + p.note : "");
      f.date = t; f.outcome = p.outcome; f.next_step = p.next_step || ""; f.next_step_date = p.next_step_date || "";
      if (p.meeting_datetime) f.meeting_datetime = p.meeting_datetime; if (p.qualified) f.qualified = p.qualified;
      f.notes = f.notes ? line + "\n" + f.notes : line;
      db.log.push({ timestamp: (function (d) { return today() + " " + String(d.getHours()).padStart(2, "0") + ":" + String(d.getMinutes()).padStart(2, "0"); })(new Date()), date: t, setter: who, firm: f.firm, row: f.row, priority: f.priority, channel: p.channel,
        outcome: p.outcome, qualified: p.qualified || "", hot: p.hot ? "y" : "", meeting_datetime: p.meeting_datetime || "", next_step: p.next_step || "", next_step_date: p.next_step_date || "", note: p.note || "" });
      mockSave(db);
      return { ok: true, firm: f, mine: summarize(db.log, who) };
    }
    if (method === "GET" && p.action === "report") {
      var since = new Date(); since.setDate(since.getDate() - (Number(p.days) - 1));
      var sinceKey = since.getFullYear() + "-" + String(since.getMonth() + 1).padStart(2, "0") + "-" + String(since.getDate()).padStart(2, "0");
      var perDay = {}, setters = {}, cov = {};
      db.log.filter(function (l) { return l.date >= sinceKey; }).forEach(function (l) { var d = perDay[l.date] = perDay[l.date] || { touches: 0, conversations: 0, booked: 0 }; d.touches++; if (TALKED.indexOf(l.outcome) > -1) d.conversations++; if (l.outcome === "booked") d.booked++; });
      db.log.forEach(function (l) { setters[l.setter] = 1; });
      db.firms.forEach(function (f) { var c = cov[f.priority] = cov[f.priority] || { total: 0, touched: 0 }; c.total++; if (f.date) c.touched++; });
      var all = summarize(db.log);
      return { ok: true, report: {
        generated: new Date().toLocaleString("en-US"), today: all.today, week: all.week, targets: all.targets, perDay: perDay, coverage: cov,
        perSetter: Object.keys(setters).map(function (s) { var m = summarize(db.log, s); var mine = db.log.filter(function (l) { return l.setter === s; }); return { setter: s, today: m.today, week: m.week, last: mine.length ? mine[mine.length - 1].timestamp : "" }; }),
        meetings: db.firms.filter(function (f) { return f.outcome === "booked" && f.meeting_datetime; }),
        followUps: db.firms.filter(function (f) { return f.next_step_date && f.next_step_date <= today() && ["booked", "declined"].indexOf(f.outcome) < 0; }),
        recent: db.log.slice(-30).reverse()
      } };
    }
    throw new Error("Unknown action.");
  }

  /* ---------------- Calls tab (setter) ---------------- */
  function isDue(f) { return f.next_step_date && f.next_step_date <= today() && ["booked", "declined"].indexOf(f.outcome) < 0; }
  function visibleFirms() {
    var q = st.q.toLowerCase();
    return (st.firms || []).filter(function (f) {
      if (st.prio && f.priority !== st.prio) return false;
      if (q && (f.firm + " " + f.city + " " + f.type + " " + (f.principal || "")).toLowerCase().indexOf(q) < 0) return false;
      if (st.filter === "due") return isDue(f);
      if (st.filter === "new") return !f.date;
      if (st.filter === "booked") return f.outcome === "booked";
      return true;
    }).sort(function (a, b) { return (a.priority || "Z").localeCompare(b.priority || "Z") || a.row - b.row; });
  }
  function meter(label_, value, target) {
    var p = Math.min(100, Math.round(value / target * 100));
    return '<div class="card stat"><div class="eyebrow">' + label_ + "</div><b>" + value + '<span class="of"> / ' + target + '</span></b><div class="bar" style="margin-top:12px" role="img" aria-label="' + label_ + ": " + value + " of " + target + '"><i style="width:' + p + '%"></i></div></div>';
  }

  function renderCalls(cx) {
    var E = cx.esc;
    if (!cx.certified && !st.preview) {
      return '<div class="card locked"><div class="eyebrow">Calls</div><h2 style="font-size:30px;margin:10px 0">Get certified first.</h2><p class="muted">The call list opens after you pass the final certification exam.</p>' +
        '<div style="margin-top:20px;display:flex;gap:10px;justify-content:center;flex-wrap:wrap"><button class="btn" data-tab="course">Go to the course</button>' +
        (cx.demo ? '<button class="btn ghost" data-calls="preview">Preview anyway</button>' : "") + "</div></div>";
    }
    var head = '<div class="eyebrow">' + (live(cx) ? "Setter Call List" : "Preview · fictional sample firms") + '</div><div class="section-title" style="margin-top:6px"><h2>Calls</h2><button class="link" data-calls="reload">Refresh</button></div>';
    if (st.error) return head + '<div class="result fail"><div>' + E(st.error) + '</div><button class="btn" data-calls="reload">Try again</button></div>';
    if (!st.firms) return head + '<div class="loading" style="min-height:30vh">Loading your call list…</div>';
    var m = st.mine || { today: {}, week: {}, targets: { firms: 40, conversations: 10 } };
    var due = st.firms.filter(isDue).length, fresh = st.firms.filter(function (f) { return !f.date; }).length;
    var chips = [["due", "Due (" + due + ")"], ["new", "Not called (" + fresh + ")"], ["booked", "Booked"], ["all", "All (" + st.firms.length + ")"]];
    var list = visibleFirms();
    return head +
      '<div class="grid g4">' +
      '<div class="card stat"><div class="eyebrow">Today</div><b>' + (m.today.touches || 0) + "</b><span>touches · " + (m.today.conversations || 0) + " conversations</span></div>" +
      '<div class="card stat"><div class="eyebrow">Booked this week</div><b>' + (m.week.booked || 0) + "</b><span>" + (m.week.qualified || 0) + " qualified</span></div>" +
      meter("Firms this week", m.week.firms || 0, m.targets.firms) + meter("Conversations this week", m.week.conversations || 0, m.targets.conversations) + "</div>" +
      '<div class="calls-tools"><div class="chips">' + chips.map(function (c) { return '<button class="chip' + (st.filter === c[0] ? " on" : "") + '" data-calls-filter="' + c[0] + '">' + c[1] + "</button>"; }).join("") + "</div>" +
      '<div class="chips"><select data-calls-prio aria-label="Priority"><option value="">All priorities</option>' + ["A", "B", "C"].map(function (p) { return '<option value="' + p + '"' + (st.prio === p ? " selected" : "") + ">Priority " + p + "</option>"; }).join("") + "</select>" +
      '<input type="search" data-calls-q placeholder="Search firm or city" value="' + E(st.q) + '"></div></div>' +
      '<p class="muted" style="font-size:13px;margin:-4px 0 12px">Only call firms on this list. Work priority A first, 8:00 am–4:00 pm Pacific, Mon–Fri.</p>' +
      '<div class="firms">' + (list.length ? list.map(function (f) { return firmRow(f, E); }).join("") : '<div class="card muted" style="text-align:center">' + (st.filter === "due" ? "No follow-ups due. Pick a firm from “Not called”." : "No firms match.") + "</div>") + "</div>" +
      (st.open ? drawer(cx) : "");
  }
  function firmRow(f, E) {
    var status = f.outcome ? '<span class="pill' + (f.outcome === "booked" ? " ok" : isDue(f) ? " gold" : "") + '">' + E(label(OUTCOMES, f.outcome)) + (f.date ? " · " + E(f.date) : "") + "</span>" : '<span class="pill">Not called</span>';
    return '<button class="firm" data-calls-open="' + f.row + '"><span class="prio p' + E(f.priority) + '">' + E(f.priority || "–") + "</span>" +
      "<span><b>" + E(f.firm) + '</b><span class="muted">' + E(f.type) + " · " + E(f.city) + (f.next_step_date && f.outcome !== "booked" ? " · next " + E(f.next_step_date) : "") + "</span></span>" + status + "</button>";
  }
  function drawer(cx) {
    var E = cx.esc, f = (st.firms || []).filter(function (x) { return x.row === st.open; })[0]; if (!f) return "";
    var link = function (u, t) { return u ? '<a href="' + E(u) + '" target="_blank" rel="noopener">' + E(t) + " ↗</a>" : ""; };
    return '<div class="drawer-bg" data-calls="close"></div><aside class="drawer" role="dialog" aria-label="' + E(f.firm) + '">' +
      '<div class="drawer-head"><div><div class="eyebrow">Priority ' + E(f.priority) + " · " + E(f.type) + " · " + E(f.city) + '</div><h3 style="font-size:24px;margin-top:4px">' + E(f.firm) + '</h3></div><button class="btn ghost small" data-calls="close">Close</button></div>' +
      '<div class="facts">' +
      (f.principal ? "<div><span>Contact</span>" + E(f.principal) + "</div>" : "") +
      (f.main_phone ? "<div><span>Phone</span>" + E(f.main_phone) + "</div>" : "") +
      "<div><span>Research</span><p>" + [link(f.website, "Website"), link(f.source_url, "Source page")].filter(Boolean).join(" · ") + "</p></div>" +
      (f.high_end_note ? "<div><span>Why them</span>" + E(f.high_end_note) + "</div>" : "") +
      (f.meeting_datetime ? "<div><span>Meeting</span>" + E(f.meeting_datetime) + "</div>" : "") + "</div>" +
      '<form class="logform" data-calls-form="' + f.row + '">' +
      '<div class="eyebrow">Log a touch</div>' +
      '<div class="field"><span>Channel</span><div class="chips">' + CHANNELS.map(function (c, i) { return '<label class="chip-radio"><input type="radio" name="channel" value="' + c[0] + '"' + (i === 0 ? " checked" : "") + "><span>" + c[1] + "</span></label>"; }).join("") + "</div></div>" +
      '<div class="field"><span>Outcome</span><div class="chips">' + OUTCOMES.map(function (o) { return '<label class="chip-radio"><input type="radio" name="outcome" value="' + o[0] + '" required><span>' + o[1] + "</span></label>"; }).join("") + "</div></div>" +
      '<div class="field when-talked"><span>Qualified (all five criteria)</span><div class="chips"><label class="chip-radio"><input type="radio" name="qualified" value="y"><span>Yes</span></label><label class="chip-radio"><input type="radio" name="qualified" value="n"><span>No</span></label></div></div>' +
      '<div class="field when-booked"><span>Meeting (Pacific time) · only once they accepted the invite</span><div class="row2"><input type="date" name="meeting_date"><input type="time" name="meeting_time" step="900"></div></div>' +
      '<label class="field when-talked check-line"><input type="checkbox" name="hot"> Hot: project goes to bid within 6 months</label>' +
      '<div class="field"><span>Next step</span><input type="text" name="next_step" maxlength="200" placeholder="e.g. Call back after the bid set is out" value="' + E(f.outcome === "booked" ? "" : f.next_step) + '"></div>' +
      '<div class="field"><span>Follow-up date</span><input type="date" name="next_step_date" value="' + E(f.outcome === "booked" ? "" : f.next_step_date) + '"></div>' +
      '<div class="field"><span>Note</span><textarea name="note" rows="3" maxlength="600" placeholder="What happened, who you spoke with, GC names…"></textarea></div>' +
      '<button class="btn" type="submit"' + (st.saving ? " disabled" : "") + ">" + (st.saving ? "Saving…" : "Save to the call list") + "</button></form>" +
      (f.notes ? '<div class="eyebrow" style="margin-top:22px">History</div><div class="history">' + E(f.notes) + "</div>" : "") +
      "</aside>";
  }
  async function loadFirms(cx, el) {
    st.error = null;
    try { var d = await api(cx, "GET", { action: "firms", key: key(cx) }); st.firms = d.firms; st.mine = d.mine; }
    catch (e) { st.error = live(cx) && !key(cx) ? "Your call key is missing. Ask Jesús to add it to your account." : e.message; }
    paint(cx, el);
  }
  function paint(cx, el) { var main = el || document.querySelector("#bs-academy .main"); if (!main) return; main.innerHTML = renderCalls(cx); syncForm(main); }
  function syncForm(main) {
    var form = main.querySelector(".logform"); if (!form) return;
    var o = (form.querySelector('[name=outcome]:checked') || {}).value;
    form.querySelectorAll(".when-talked").forEach(function (x) { x.style.display = TALKED.indexOf(o) > -1 ? "" : "none"; });
    form.querySelectorAll(".when-booked").forEach(function (x) { x.style.display = o === "booked" ? "" : "none"; });
  }
  function mountCalls(el, cx) {
    if (el._bsaCalls) return; el._bsaCalls = true;
    if (!st.firms && (cx.certified || st.preview)) loadFirms(cx, el); else syncForm(el);
    el.addEventListener("click", function (e) {
      var b = e.target.closest("[data-calls],[data-calls-filter],[data-calls-open]"); if (!b) return;
      if (b.dataset.callsFilter) { st.filter = b.dataset.callsFilter; return paint(cx, el); }
      if (b.dataset.callsOpen) { st.open = Number(b.dataset.callsOpen); paint(cx, el); var d = el.querySelector(".drawer"); if (d) d.focus && d.focus(); return; }
      var a = b.dataset.calls;
      if (a === "close") { st.open = null; return paint(cx, el); }
      if (a === "reload") { st.firms = null; paint(cx, el); return loadFirms(cx, el); }
      if (a === "preview") { st.preview = true; paint(cx, el); return loadFirms(cx, el); }
    });
    el.addEventListener("change", function (e) {
      if (e.target.matches("[data-calls-prio]")) { st.prio = e.target.value; paint(cx, el); }
      if (e.target.name === "outcome") syncForm(el);
    });
    el.addEventListener("input", function (e) {
      if (!e.target.matches("[data-calls-q]")) return;
      st.q = e.target.value; var pos = e.target.selectionStart; paint(cx, el);
      var inp = el.querySelector("[data-calls-q]"); if (inp) { inp.focus(); inp.setSelectionRange(pos, pos); }
    });
    el.addEventListener("keydown", function (e) { if (e.key === "Escape" && st.open) { st.open = null; paint(cx, el); } });
    el.addEventListener("submit", async function (e) {
      if (!e.target.matches("[data-calls-form]")) return;
      e.preventDefault();
      var fd = new FormData(e.target), f = st.firms.filter(function (x) { return x.row === st.open; })[0];
      var outcome = fd.get("outcome");
      if (!outcome) { cx.toast("Pick an outcome"); return; }
      var md = fd.get("meeting_date"), mt = fd.get("meeting_time");
      if (outcome === "booked" && (!md || !mt)) { cx.toast("Add the meeting date and time"); return; }
      var body = { action: "log", key: key(cx), row: f.row, firm: f.firm, channel: fd.get("channel"), outcome: outcome,
        qualified: TALKED.indexOf(outcome) > -1 ? (fd.get("qualified") || "") : "", hot: TALKED.indexOf(outcome) > -1 && !!fd.get("hot"),
        meeting_datetime: outcome === "booked" ? md + " " + mt + " PT" : "", next_step: fd.get("next_step") || "", next_step_date: fd.get("next_step_date") || "", note: (fd.get("note") || "").trim() };
      st.saving = true; var btn = e.target.querySelector("[type=submit]"); if (btn) { btn.disabled = true; btn.textContent = "Saving…"; }
      try {
        var d = await api(cx, "POST", body);
        st.firms = st.firms.map(function (x) { return x.row === d.firm.row ? d.firm : x; }); st.mine = d.mine; st.open = null;
        cx.toast(outcome === "booked" ? "Booked. Send Jesús the brief within 1 hour." : "Saved to the call list");
      } catch (err) { cx.toast(err.message); }
      st.saving = false; paint(cx, el);
    });
  }

  /* ---------------- Report tab (Jesús) ---------------- */
  function renderReport(cx) {
    var E = cx.esc, r = st.report;
    var head = '<div class="eyebrow">' + (live(cx) ? "From the Setter Call List" : "Preview · sample data") + '</div><div class="section-title" style="margin-top:6px"><h2>Setter report</h2><div class="chips">' +
      [7, 30].map(function (d) { return '<button class="chip' + (st.days === d ? " on" : "") + '" data-report-days="' + d + '">' + d + " days</button>"; }).join("") + '<button class="link" data-report="reload">Refresh</button></div></div>';
    if (st.error && !r) return head + '<div class="result fail"><div>' + E(st.error) + "</div></div>";
    if (!r) return head + '<div class="loading" style="min-height:30vh">Loading the report…</div>';
    var t = r.today, w = r.week;
    var tile = function (l, v, s) { return '<div class="card stat"><div class="eyebrow">' + l + "</div><b>" + v + "</b><span>" + s + "</span></div>"; };
    var days = [], pd = r.perDay || {};
    for (var k = st.days - 1; k >= 0; k--) { var dd = new Date(); dd.setDate(dd.getDate() - k); days.push(dd.getFullYear() + "-" + String(dd.getMonth() + 1).padStart(2, "0") + "-" + String(dd.getDate()).padStart(2, "0")); }
    days.forEach(function (d) { pd[d] = pd[d] || { touches: 0, conversations: 0, booked: 0 }; }); r.perDay = pd;
    var maxT = Math.max(1, Math.max.apply(null, days.map(function (d) { return r.perDay[d].touches; }).concat([0])));
    var anyCalls = days.some(function (d) { return r.perDay[d].touches > 0; });
    var dayBars = anyCalls ? '<div class="vbars" role="img" aria-label="Touches per day">' + days.map(function (d, i) {
      var v = r.perDay[d], showLabel = st.days <= 14 || i % 7 === 0 || i === days.length - 1, h = Math.round(v.touches / maxT * 100);
      return '<div class="vbar" tabindex="0" data-tip="' + E(d + ": " + v.touches + " touches, " + v.conversations + " conversations, " + v.booked + " booked") + '"><i style="height:' + (v.touches ? Math.max(2, h) : 0) + '%"></i><span>' + (showLabel ? E(d.slice(5)) : "") + "</span></div>";
    }).join("") + "</div>" : '<p class="muted">No calls logged in this period.</p>';
    var cov = Object.keys(r.coverage || {}).sort().map(function (p) {
      var c = r.coverage[p], pct = Math.round(c.touched / Math.max(1, c.total) * 100);
      return '<div class="hbar"><span>Priority ' + E(p) + '</span><div class="bar" data-tip="' + E("Priority " + p + ": " + c.touched + " of " + c.total + " firms touched") + '" tabindex="0"><i style="width:' + pct + '%"></i></div><b>' + c.touched + "/" + c.total + "</b></div>";
    }).join("");
    var list = function (rows, fn, empty) { return rows && rows.length ? '<div class="rlist">' + rows.map(fn).join("") + "</div>" : '<p class="muted">' + empty + "</p>"; };
    return head +
      '<div class="grid g4">' + tile("Touches today", t.touches, t.firms + " firms") + tile("Conversations today", t.conversations, "people reached") + tile("Booked today", t.booked, t.qualified + " qualified") + tile("Booked this week", w.booked, w.qualified + " qualified") + "</div>" +
      '<div class="grid g2" style="margin-top:16px">' + meter("Firms touched this week", w.firms, r.targets.firms) + meter("Conversations this week", w.conversations, r.targets.conversations) + "</div>" +
      '<div class="grid g2" style="margin-top:16px"><div class="card"><h3>Touches per day</h3><p class="muted" style="font-size:13px;margin-bottom:10px">Last ' + st.days + ' days. Hover a bar for details.</p>' + dayBars + "</div>" +
      '<div class="card"><h3>List coverage</h3><p class="muted" style="font-size:13px;margin-bottom:14px">Firms called at least once, by priority.</p>' + (cov || '<p class="muted">No firms.</p>') + "</div></div>" +
      '<div class="section-title"><h2>By setter</h2></div>' +
      (r.perSetter && r.perSetter.length ? '<div class="card" style="padding:0;overflow-x:auto"><table class="rtable"><thead><tr><th>Setter</th><th>Today</th><th>Week firms</th><th>Week conversations</th><th>Week booked</th><th>Last activity</th></tr></thead><tbody>' +
        r.perSetter.map(function (s) { return "<tr><td>" + E(s.setter) + "</td><td>" + s.today.touches + "</td><td>" + s.week.firms + "</td><td>" + s.week.conversations + "</td><td>" + s.week.booked + "</td><td>" + E(s.last) + "</td></tr>"; }).join("") + "</tbody></table></div>" : '<p class="muted">No activity yet.</p>') +
      '<div class="grid g2" style="margin-top:24px"><div><h3 style="margin-bottom:10px">Booked meetings</h3>' + list(r.meetings, function (m) { return '<div class="ritem"><b>' + E(m.firm) + '</b><span class="muted">' + E(m.city) + " · " + E(m.meeting_datetime) + (m.qualified === "y" ? " · qualified" : "") + "</span></div>"; }, "None yet.") + "</div>" +
      '<div><h3 style="margin-bottom:10px">Follow-ups due</h3>' + list(r.followUps, function (m) { return '<div class="ritem"><b>' + E(m.firm) + '</b><span class="muted">' + E(m.next_step_date) + (m.next_step ? " · " + E(m.next_step) : "") + "</span></div>"; }, "Nothing due.") + "</div></div>" +
      '<div class="section-title"><h2>Recent activity</h2><span class="muted" style="font-size:13px">Updated ' + E(r.generated) + "</span></div>" +
      list(r.recent, function (l) { return '<div class="ritem"><b>' + E(l.firm) + ' <span class="pill' + (l.outcome === "booked" ? " ok" : "") + '">' + E(label(OUTCOMES, l.outcome)) + '</span></b><span class="muted">' + E(l.timestamp) + " · " + E(l.setter) + " · " + E(label(CHANNELS, l.channel)) + (l.note ? " — " + E(l.note) : "") + "</span></div>"; }, "No calls logged yet.") +
      '<p class="muted" style="font-size:13px;margin-top:20px">' + (live(cx) ? "Live from the Call Log tab. Your 5:30 PM summary comes from the Growth Strategist bot." : "Preview: these numbers come from the sample firms on the Calls tab.") + "</p>";
  }
  async function loadReport(cx, el) {
    st.error = null;
    try { var d = await api(cx, "GET", { action: "report", key: (cx.member.fields || {})[cfg(cx).adminKeyField || "call-key"] || key(cx), days: st.days }); st.report = d.report; }
    catch (e) { st.error = e.message; }
    var main = el || document.querySelector("#bs-academy .main"); if (main) main.innerHTML = renderReport(cx);
  }
  function mountReport(el, cx) {
    st.report = null; loadReport(cx, el);
    var host = document.getElementById("bs-academy"), tip = host.querySelector(".tip");
    if (!tip) { tip = document.createElement("div"); tip.className = "tip"; host.appendChild(tip); }
    tip.style.opacity = 0;
    el.addEventListener("click", function (e) {
      var b = e.target.closest("[data-report-days],[data-report]"); if (!b) return;
      if (b.dataset.reportDays) st.days = Number(b.dataset.reportDays);
      st.report = null; el.innerHTML = renderReport(cx); loadReport(cx, el);
    });
    var show = function (e) {
      var t = e.target.closest("[data-tip]"); if (!t) { tip.style.opacity = 0; return; }
      var r = t.getBoundingClientRect(); tip.textContent = t.dataset.tip; tip.style.opacity = 1;
      tip.style.left = Math.min(window.innerWidth - 16 - tip.offsetWidth, Math.max(16, r.left + r.width / 2 - tip.offsetWidth / 2)) + "px";
      tip.style.top = (r.top - tip.offsetHeight - 8) + "px";
    };
    el.addEventListener("mouseover", show); el.addEventListener("focusin", show);
    el.addEventListener("mouseleave", function () { tip.style.opacity = 0; });
  }

  window.BSA_TABS = (window.BSA_TABS || []).concat([
    { id: "calls", label: "Calls", count: function () { return st.firms ? String(st.firms.filter(isDue).length || "") : ""; }, render: renderCalls, mounted: function (el, cx) { el._bsaCalls = false; mountCalls(el, cx); } },
    { id: "report", label: "Report", visible: function (cx) { return !!cx.member.isAdmin; }, render: renderReport, mounted: mountReport }
  ]);
})();
