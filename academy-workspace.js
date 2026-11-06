/* Blue Sierra Academy — the setter's Workspace tab and Jesús's Report tab.
   Workspace: shift clock, call queue (next firm to call, research, opener, call, email, outcome), and the checked-off list.
   Report: activity, list coverage, and the timesheet (active hours, calls, talk time, emails, meetings, estimated cost).
   Backend: apps-script/Code.gs + apps-script/Workspace.gs. Phone: academy-phone.js (RingCentral or tel:).
   Without a backend URL (preview), it runs on fictional sample firms kept in this browser. */
(function () {
  "use strict";
  var OUTCOMES = [["no_answer", "No answer"], ["vm", "Voicemail"], ["conversation", "Conversation"], ["booked", "Booked"], ["declined", "Declined"]];
  var CHANNELS = [["call", "Call"], ["voicemail", "Voicemail"], ["email", "Email"], ["linkedin", "LinkedIn"]];
  var TALKED = ["conversation", "booked", "declined"];
  var PING_MS = 60000, ACTIVE_WINDOW_MS = 120000;
  var st = {
    firms: null, mine: null, today: null, shift: null, wsError: null, reportError: null, preview: false,
    view: "queue", filter: "all", prio: "", q: "", pinned: null, skipped: [], outcomeFor: null, saving: false,
    call: null, compose: null, report: null, days: 7, lastInput: Date.now(), pingTimer: null, tickTimer: null, el: null, cx: null
  };

  /* ---------------- helpers ---------------- */
  function label(list, v) { for (var i = 0; i < list.length; i++) if (list[i][0] === v) return list[i][1]; return v || ""; }
  function ymd(d) { return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0"); }
  // Pacific date, so "today" and "due" match the server no matter where the setter is (and roll over at midnight PT).
  function today() { var p = {}; new Intl.DateTimeFormat("en-US", { timeZone: "America/Los_Angeles", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date()).forEach(function (x) { p[x.type] = x.value; }); return p.year + "-" + p.month + "-" + p.day; }
  function cfg(cx) { return cx.content.calls || {}; }
  function key(cx) { return (cx.member.fields || {})[cfg(cx).keyField || "call-key"] || ""; }
  function live(cx) { var u = cfg(cx).api; return !!(u && !/^PASTE_/.test(u)); }
  function first(n) { return String(n || "").trim().split(/\s+/)[0] || ""; }
  function mins(m) { m = Math.round(Number(m) || 0); return m >= 60 ? Math.floor(m / 60) + "h " + String(m % 60).padStart(2, "0") + "m" : m + "m"; }
  function secs(s) { s = Math.round(Number(s) || 0); return Math.floor(s / 60) + ":" + String(s % 60).padStart(2, "0"); }
  function fmtPhone(p) { var d = String(p || "").replace(/\D/g, "").replace(/^1(\d{10})$/, "$1"); return d.length === 10 ? "(" + d.slice(0, 3) + ") " + d.slice(3, 6) + "-" + d.slice(6) : String(p || ""); }
  function safeUrl(u) { return /^https?:\/\//i.test(String(u || "")) ? String(u) : ""; }
  function isDue(f) { return f.next_step_date && f.next_step_date <= today() && ["booked", "declined"].indexOf(f.outcome) < 0; }
  function closed(f) { return f.outcome === "booked" || f.outcome === "declined"; }
  function touchedToday(f) { return String(f.date || "").slice(0, 10) === today(); }
  function prioRank(p) { return { A: 0, B: 1, C: 2 }[p] == null ? 3 : { A: 0, B: 1, C: 2 }[p]; }

  /* ---------------- API (Apps Script, or the preview mock) ---------------- */
  async function api(cx, params) {
    params = Object.assign({ key: key(cx) }, params);
    if (!live(cx)) {
      if (cx.demo) return mock(cx, params);          // sample firms only in the local preview, never on the real site
      throw new Error("The call list isn't connected yet. Message Jesús before logging any calls.");
    }
    // POST with text/plain: keys never go in a URL, and Apps Script needs no CORS preflight.
    var res = await fetch(cfg(cx).api, { method: "POST", headers: { "Content-Type": "text/plain;charset=utf-8" }, body: JSON.stringify(params) });
    var data; try { data = await res.json(); } catch (e) { throw new Error("The call list didn't answer. Check your connection and try again."); }
    if (!data.ok) throw new Error(data.error || "Something went wrong.");
    return data;
  }

  /* ---------------- queue ---------------- */
  function queue() {
    var list = (st.firms || []).filter(function (f) { return !closed(f) && !touchedToday(f); });
    var due = list.filter(isDue).sort(function (a, b) { return a.next_step_date < b.next_step_date ? -1 : a.next_step_date > b.next_step_date ? 1 : prioRank(a.priority) - prioRank(b.priority); });
    var fresh = list.filter(function (f) { return !isDue(f) && !f.date; }).sort(function (a, b) { return prioRank(a.priority) - prioRank(b.priority) || a.row - b.row; });
    var later = list.filter(function (f) { return !isDue(f) && f.date && (!f.next_step_date || f.next_step_date > today()); }).sort(function (a, b) { return prioRank(a.priority) - prioRank(b.priority) || a.row - b.row; });
    var q = due.concat(fresh, later);
    // Skipped firms go to the back of the line for this session.
    var skipped = q.filter(function (f) { return st.skipped.indexOf(f.row) > -1; });
    return q.filter(function (f) { return st.skipped.indexOf(f.row) < 0; }).concat(skipped);
  }
  function current() {
    if (st.pinned != null) { var p = (st.firms || []).filter(function (f) { return f.row === st.pinned; })[0]; if (p) return p; }
    return queue()[0] || null;
  }
  function reason(f) {
    if (isDue(f)) return "Follow-up due " + f.next_step_date;
    if (!f.date) return "Not called yet · priority " + (f.priority || "–");
    if (closed(f)) return label(OUTCOMES, f.outcome);
    return "Last touch " + String(f.date).slice(0, 10) + (f.outcome ? " · " + label(OUTCOMES, f.outcome) : "");
  }
  function opener(f, setter) {
    var type = String(f.type || "").toLowerCase(), who = first(f.principal) || "there", city = f.city || "your area";
    var intro = "Hi " + who + ", this is " + setter + " calling for Jesús Toto at Blue Sierra Construction in San José. ";
    var middle = /landscape/.test(type)
      ? "We're the builder: we build to your drawings, from grading and drainage to walls, paving and planting. I saw your work in " + city + "."
      : /developer|builder|gc|contractor/.test(type)
        ? "We build full site and landscape packages for residential projects. I saw your projects in " + city + "."
        : "We build large residential site and landscape packages with architects. I saw your residential work in " + city + ".";
    return {
      main: intro + middle + " Could we set 20 minutes with Jesús? Do you have a minute?",
      gatekeeper: "Hi, this is " + setter + " calling for Jesús Toto at Blue Sierra Construction in San José. Who handles residential projects and contractor relationships?"
    };
  }

  /* ---------------- email templates ---------------- */
  function templates(f, cx) {
    var calendly = ((cx.member.fields || {})["calendly-url"]) || (cx.content.memberFields && cx.content.memberFields.calendly && cx.content.memberFields.calendly.fallback) || "";
    var hi = "Hi " + (first(f.principal) || "there") + ",\n\n";
    return [
      { id: "asked", label: "They asked for an email", subject: "Blue Sierra Construction · intro for " + f.firm,
        body: hi + "Thanks for taking my call. As promised, here's a quick intro: Blue Sierra Construction has built large residential site and landscape packages on the Peninsula and in the South Bay since 2005, from grading and drainage to walls, paving, pools and planting, built to the design team's drawings.\n\nJesús Toto, our principal, would like 20 minutes to learn how you work with contractors. Would [first time] or [second time] work?" + (calendly ? " If neither does, you can pick a time here: " + calendly : "") + "\n\nThank you," },
      { id: "after_vm", label: "After a voicemail", subject: "Following up on my voicemail · Blue Sierra Construction",
        body: hi + "I just left you a voicemail. I'm reaching out for Jesús Toto at Blue Sierra Construction in San José. We build full site and landscape packages for residential projects like your work in " + (f.city || "the area") + ".\n\nWould 20 minutes with Jesús make sense in the next couple of weeks?" + (calendly ? " Here's his calendar: " + calendly : "") + "\n\nThank you," },
      { id: "confirm", label: "Meeting confirmation", subject: "Confirmed: 20 minutes with Jesús Toto, Blue Sierra Construction",
        body: hi + "Thank you for your time today. This confirms your 20-minute call with Jesús Toto on [day and time] (Pacific). You'll also get a calendar invite.\n\nIf anything changes, just reply to this email.\n\nThank you," },
      { id: "custom", label: "Write my own", subject: "", body: hi }
    ];
  }

  /* ---------------- rendering: Workspace ---------------- */
  function renderWorkspace(cx) {
    var E = cx.esc;
    if (!cx.certified && !st.preview) {
      return '<div class="card locked"><div class="eyebrow">Workspace</div><h2 style="font-size:30px;margin:10px 0">Get certified first.</h2><p class="muted">Your call list and workspace open after you pass the final certification exam.</p>' +
        '<div style="margin-top:20px;display:flex;gap:10px;justify-content:center;flex-wrap:wrap"><button class="btn" data-tab="course">Go to the course</button>' +
        (cx.demo ? '<button class="btn ghost" data-ws="preview">Preview anyway</button>' : "") + "</div></div>";
    }
    var head = '<div class="eyebrow">' + (live(cx) || !cx.demo ? "Setter workspace · Setter Call List" : "Preview · fictional sample firms") + "</div>";
    if (st.wsError && !st.firms) return head + '<div class="result fail" style="margin-top:10px"><div>' + E(st.wsError) + '</div><button class="btn" data-ws="reload">Try again</button></div>';
    if (!st.firms) return head + '<div class="loading" style="min-height:30vh">Loading your workspace…</div>';
    return head + shiftBar(cx) + statsStrip(cx) +
      '<div class="ws-views"><div class="chips"><button class="chip' + (st.view === "queue" ? " on" : "") + '" data-ws-view="queue">Call queue · ' + queue().length + '</button><button class="chip' + (st.view === "list" ? " on" : "") + '" data-ws-view="list">Call list · ' + st.firms.length + '</button></div>' +
      '<span class="muted small">Only call firms on this list · 8:00 am–4:00 pm Pacific, Mon–Fri</span></div>' +
      (st.view === "queue" ? renderQueue(cx) : renderList(cx)) + (st.compose ? renderCompose(cx) : "");
  }

  function shiftBar(cx) {
    var s = st.shift, phone = window.BSA_PHONE ? window.BSA_PHONE.status() : { mode: "tel" };
    var phoneTag = phone.mode === "ringcentral" ? (phone.loggedIn ? '<span class="pill ok">RingCentral connected</span>' : '<span class="pill gold">Log in to RingCentral in the phone panel</span>') : '<span class="pill">Calls open your phone app</span>';
    if (!s) return '<div class="shift off"><div><b>You\'re off the clock.</b><span class="muted small">Start your shift here and your Upwork tracker. Upwork is how you\'re paid; this clock shows Jesús your activity.</span></div><div class="shift-actions">' + phoneTag + '<button class="btn" data-ws="shift" data-op="start">Start shift</button></div></div>';
    var paused = s.status === "paused";
    return '<div class="shift ' + (paused ? "paused" : "on") + '"><div><b><span class="dot"></span>' + (paused ? "Paused" : "On shift") + ' · <span data-ws-clock>' + mins(liveMinutes()) + '</span> active</b><span class="muted small">Started ' +
      new Date(s.started_at).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" }) + ". Time counts while this page is open and you're working.</span></div>" +
      '<div class="shift-actions">' + phoneTag + (paused ? '<button class="btn" data-ws="shift" data-op="start">Resume</button>' : '<button class="btn ghost" data-ws="shift" data-op="pause">Pause</button>') +
      '<button class="btn ghost" data-ws="shift" data-op="end">End shift</button></div></div>';
  }
  function liveMinutes() {
    var s = st.shift; if (!s) return 0;
    var extra = s.status === "open" && st.lastPingAt ? Math.min(2, (Date.now() - st.lastPingAt) / 60000) : 0;
    return Number(s.active_minutes || 0) + extra;
  }
  function statsStrip(cx) {
    var t = st.today || {}, m = st.mine || { week: {}, targets: { firms: 40, conversations: 10 } }, w = m.week || {};
    var tile = function (l, big, small) { return '<div class="card stat"><div class="eyebrow">' + l + "</div><b>" + big + "</b><span>" + small + "</span></div>"; };
    var bar = function (v, max) { return '<div class="bar" style="margin-top:10px"><i style="width:' + Math.min(100, Math.round((v || 0) / max * 100)) + '%"></i></div>'; };
    return '<div class="grid g4" style="margin-top:14px">' +
      tile("Today", (t.calls || 0) + " calls", secs(t.talk_seconds || 0) + " talk time · " + (t.emails || 0) + " emails") +
      tile("Conversations today", String(t.conversations || 0), (t.booked || 0) + " booked · " + (t.qualified || 0) + " qualified") +
      tile("Firms this week", (w.firms || 0) + '<span class="of"> / ' + m.targets.firms + "</span>", bar(w.firms, m.targets.firms)) +
      tile("Conversations this week", (w.conversations || 0) + '<span class="of"> / ' + m.targets.conversations + "</span>", bar(w.conversations, m.targets.conversations)) + "</div>";
  }

  function renderQueue(cx) {
    var E = cx.esc, f = current();
    if (!f) return '<div class="empty-state card"><h3>Queue cleared for today.</h3><p class="muted">Every open firm has been touched today or is waiting for its follow-up date. Check the call list or send your daily report.</p></div>';
    var o = opener(f, first(cx.member.name) || cx.member.name), call = st.call && st.call.row === f.row ? st.call : null;
    var web = safeUrl(f.website), src = safeUrl(f.source_url), q = queue(), pos = q.indexOf(f) + 1;
    return '<div class="qcard card">' +
      '<div class="qhead"><div><div class="eyebrow">' + E(reason(f)) + (pos > 0 ? " · " + pos + " of " + q.length + " in queue" : "") + '</div><h2>' + E(f.firm) + '</h2><div class="muted">' + E([f.type, f.city].filter(Boolean).join(" · ")) + '</div></div><span class="prio p' + E(f.priority) + '">' + E(f.priority || "–") + "</span></div>" +
      '<div class="qgrid"><div class="qmain">' +
      '<div class="facts">' + (f.principal ? "<div><span>Contact</span><p>" + E(f.principal) + "</p></div>" : "") +
      "<div><span>Phone</span><p>" + (f.main_phone ? E(fmtPhone(f.main_phone)) : '<span class="muted">Not on the list</span>') + "</p></div>" +
      "<div><span>Research</span><p>" + [web ? '<a href="' + E(web) + '" target="_blank" rel="noopener">Website ↗</a>' : "", src ? '<a href="' + E(src) + '" target="_blank" rel="noopener">Source page ↗</a>' : ""].filter(Boolean).join(" · ") + "</p></div>" +
      (f.high_end_note ? "<div><span>Why them</span><p>" + E(f.high_end_note) + "</p></div>" : "") + "</div>" +
      '<div class="script"><b>Opener</b><br>' + E(o.main) + '<br><br><b>If a receptionist answers</b><br>' + E(o.gatekeeper) + "</div>" +
      (f.notes ? '<details class="history-box"><summary>History</summary><div class="history">' + E(f.notes) + "</div></details>" : "") +
      '</div><div class="qside">' +
      (call ? callPanel(call) :
        '<button class="btn big" data-ws="call" data-row="' + Number(f.row) + '"' + (f.main_phone ? "" : " disabled") + '>Call ' + E(fmtPhone(f.main_phone) || "") + "</button>" +
        '<button class="btn ghost" data-ws="email" data-row="' + Number(f.row) + '">Email</button>' +
        '<button class="btn ghost" data-ws="log" data-row="' + Number(f.row) + '">Log a touch</button>' +
        '<button class="link small" data-ws="skip" data-row="' + Number(f.row) + '">Skip for now</button>' +
        (st.pinned != null ? '<button class="link small" data-ws="unpin">Back to the queue</button>' : "")) +
      "</div></div>" +
      (st.outcomeFor === f.row ? outcomeForm(cx, f) : "") + "</div>";
  }
  function callPanel(call) {
    var live_ = !call.endedAt;
    return '<div class="callbox ' + (live_ ? "live" : "") + '"><div class="eyebrow">' + (live_ ? (call.connectedAt ? "On the call" : "Dialing…") : "Call ended") + '</div><b data-ws-calltime>' + secs(callSeconds(call)) + "</b>" +
      '<span class="muted small">' + (call.source === "ringcentral" ? "Timed by RingCentral" : "Timed here: press End call when you hang up") + "</span>" +
      (live_ ? '<button class="btn" data-ws="endcall">End call</button>' : "") + "</div>";
  }
  function callSeconds(call) { return call.seconds || Math.round(((call.endedAt || Date.now()) - (call.connectedAt || call.startedAt)) / 1000); }

  function outcomeForm(cx, f) {
    var E = cx.esc, fromCall = st.call && st.call.row === f.row && st.call.endedAt;
    return '<form class="logform" data-ws-form="log" data-row="' + Number(f.row) + '"><div class="eyebrow">How did it go?' + (fromCall ? " · call " + secs(st.call.seconds) : "") + "</div>" +
      '<div class="field"><span>Channel</span><div class="chips">' + CHANNELS.map(function (c) { return '<label class="chip-radio"><input type="radio" name="channel" value="' + c[0] + '"' + (c[0] === "call" ? " checked" : "") + "><span>" + c[1] + "</span></label>"; }).join("") + "</div></div>" +
      '<div class="field"><span>Outcome</span><div class="chips">' + OUTCOMES.map(function (o) { return '<label class="chip-radio"><input type="radio" name="outcome" value="' + o[0] + '" required><span>' + o[1] + "</span></label>"; }).join("") + "</div></div>" +
      '<div class="field when-talked"><span>Qualified (all five criteria)</span><div class="chips"><label class="chip-radio"><input type="radio" name="qualified" value="y"><span>Yes</span></label><label class="chip-radio"><input type="radio" name="qualified" value="n"><span>No</span></label></div></div>' +
      '<div class="field when-booked"><span>Meeting (Pacific time) · only once they accepted the invite</span><div class="row2"><input type="date" name="meeting_date"><input type="time" name="meeting_time" step="900"></div></div>' +
      '<label class="field when-talked check-line"><input type="checkbox" name="hot"> Hot: project goes to bid within 6 months</label>' +
      '<div class="row2"><div class="field"><span>Next step</span><input type="text" name="next_step" maxlength="200" placeholder="e.g. Call back after the bid set is out"></div><div class="field"><span>Follow-up date</span><input type="date" name="next_step_date"></div></div>' +
      '<div class="field"><span>Note</span><textarea name="note" rows="3" maxlength="600" placeholder="Who you spoke with, what they said, GC names…"></textarea></div>' +
      '<div class="actions" style="justify-content:flex-start"><button class="btn" type="submit">Save & next</button><button class="btn ghost" type="button" data-ws="cancellog">Cancel</button></div></form>';
  }

  function renderList(cx) {
    var E = cx.esc, firms = st.firms, q = st.q.toLowerCase();
    var prios = ["A", "B", "C"].map(function (p) {
      var all = firms.filter(function (f) { return f.priority === p; }), done = all.filter(function (f) { return f.date; }).length;
      return '<div class="hbar"><span>Priority ' + p + '</span><div class="bar"><i style="width:' + (all.length ? Math.round(done / all.length * 100) : 0) + '%"></i></div><b>' + done + "/" + all.length + "</b></div>";
    }).join("");
    var rows = firms.filter(function (f) {
      if (st.prio && f.priority !== st.prio) return false;
      if (q && (f.firm + " " + f.city + " " + f.type + " " + (f.principal || "")).toLowerCase().indexOf(q) < 0) return false;
      if (st.filter === "due") return isDue(f);
      if (st.filter === "new") return !f.date;
      if (st.filter === "today") return touchedToday(f);
      if (st.filter === "booked") return f.outcome === "booked";
      return true;
    }).sort(function (a, b) { return prioRank(a.priority) - prioRank(b.priority) || a.row - b.row; });
    var chips = [["all", "All"], ["new", "Not called"], ["due", "Follow-ups due"], ["today", "Touched today"], ["booked", "Booked"]];
    return '<div class="card" style="margin-top:12px"><h3>List coverage</h3>' + prios + "</div>" +
      '<div class="calls-tools"><div class="chips">' + chips.map(function (c) { return '<button class="chip' + (st.filter === c[0] ? " on" : "") + '" data-ws-filter="' + c[0] + '">' + c[1] + "</button>"; }).join("") + "</div>" +
      '<div class="chips"><select data-ws-prio aria-label="Priority"><option value="">All priorities</option>' + ["A", "B", "C"].map(function (p) { return '<option value="' + p + '"' + (st.prio === p ? " selected" : "") + ">Priority " + p + "</option>"; }).join("") + "</select>" +
      '<input type="search" data-ws-q placeholder="Search firm or city" value="' + E(st.q) + '"></div></div>' +
      '<div class="firms">' + (rows.length ? rows.map(function (f) {
        var mark = closed(f) ? (f.outcome === "booked" ? "★" : "–") : touchedToday(f) ? "✓" : f.date ? "·" : "";
        var cls = touchedToday(f) || closed(f) ? " done" : "";
        return '<button class="firm' + cls + '" data-ws="open" data-row="' + Number(f.row) + '"><span class="tick' + cls + '" aria-label="' + (mark === "✓" ? "Touched today" : mark === "★" ? "Booked" : "") + '">' + mark + "</span>" +
          "<span><b>" + E(f.firm) + '</b><span class="muted">' + E([f.priority ? "Priority " + f.priority : "", f.type, f.city].filter(Boolean).join(" · ")) + "</span></span>" +
          '<span class="pill' + (f.outcome === "booked" ? " ok" : isDue(f) ? " gold" : "") + '">' + E(f.outcome ? label(OUTCOMES, f.outcome) + " · " + String(f.date).slice(5, 10) : "Not called") + "</span></button>";
      }).join("") : '<div class="card muted" style="text-align:center">No firms match.</div>') + "</div>";
  }

  function renderCompose(cx) {
    var E = cx.esc, c = st.compose, f = (st.firms || []).filter(function (x) { return x.row === c.row; })[0]; if (!f) return "";
    var tpls = templates(f, cx);
    return '<div class="drawer-bg" data-ws="closecompose"></div><aside class="drawer" role="dialog" aria-label="Email ' + E(f.firm) + '" data-lenis-prevent>' +
      '<div class="drawer-head"><div><div class="eyebrow">Email · ' + E(f.firm) + '</div><h3 style="font-size:22px;margin-top:4px">Send from the workspace</h3></div><button class="btn ghost small" data-ws="closecompose">Close</button></div>' +
      '<p class="muted small" style="margin-bottom:12px">Sent from Blue Sierra as “' + E(cx.member.name) + ' for Jesús Toto”. Replies go to Jesús, and he gets a copy. Only email firms on the list.</p>' +
      '<form class="logform" data-ws-form="email" data-row="' + Number(f.row) + '">' +
      '<div class="field"><span>Template</span><select name="template" data-ws-template>' + tpls.map(function (t) { return '<option value="' + t.id + '"' + (t.id === c.template ? " selected" : "") + ">" + E(t.label) + "</option>"; }).join("") + "</select></div>" +
      '<div class="field"><span>To</span><input type="email" name="to" required placeholder="name@' + E(String(safeUrl(f.website)).replace(/^https?:\/\/(www\.)?/, "").split("/")[0] || "firm.com") + '" value="' + E(c.to || "") + '"></div>' +
      '<div class="field"><span>Subject</span><input type="text" name="subject" required maxlength="200" value="' + E(c.subject) + '"></div>' +
      '<div class="field"><span>Message</span><textarea name="body" rows="11" required maxlength="5000">' + E(c.body) + "</textarea></div>" +
      '<div class="field"><span>Follow-up date (optional)</span><input type="date" name="next_step_date"></div>' +
      '<p class="muted small">Your signature is added automatically. Replace anything in [brackets] before sending.</p>' +
      '<button class="btn" type="submit">Send email</button></form></aside>';
  }

  /* ---------------- rendering: Report (Jesús) ---------------- */
  function renderReport(cx) {
    var E = cx.esc, r = st.report;
    var head = '<div class="eyebrow">' + (live(cx) ? "From the Setter Call List" : "Preview · sample data") + '</div><div class="section-title" style="margin-top:6px"><h2>Setter report</h2><div class="chips">' +
      [7, 30].map(function (d) { return '<button class="chip' + (st.days === d ? " on" : "") + '" data-report-days="' + d + '">' + d + " days</button>"; }).join("") + '<button class="link" data-report="reload">Refresh</button></div></div>';
    if (st.reportError && !r) return head + '<div class="result fail"><div>' + E(st.reportError) + "</div></div>";
    if (!r) return head + '<div class="loading" style="min-height:30vh">Loading the report…</div>';
    var ws = r.workspace || { totals: [], days: [], pay: { hourly: 20, perQualifiedMeeting: 75 } };
    var tile = function (l, v, s) { return '<div class="card stat"><div class="eyebrow">' + l + "</div><b>" + v + "</b><span>" + s + "</span></div>"; };
    var t = r.today, w = r.week;
    var sheetRows = ws.totals.map(function (x) {
      return "<tr><td>" + E(x.setter) + "</td><td class='num'>" + mins(x.active_minutes) + "</td><td class='num'>" + x.calls + (x.verified_calls ? ' <span class="muted small">(' + x.verified_calls + " RC)</span>" : "") + "</td><td class='num'>" + secs(x.talk_seconds) + "</td><td class='num'>" + x.emails + "</td><td class='num'>" + x.conversations + "</td><td class='num'>" + x.booked + " / " + x.qualified + "</td><td class='num'>" + x.calls_per_hour + "</td><td class='num'>$" + Number(x.est_cost).toLocaleString("en-US") + "</td><td class='num'>" + (x.cost_per_qualified == null ? "—" : "$" + Number(x.cost_per_qualified).toLocaleString("en-US")) + "</td></tr>";
    }).join("");
    var dayRows = ws.days.slice().reverse().map(function (d) {
      return "<tr><td>" + E(d.date) + "</td><td>" + E(d.setter) + "</td><td class='num'>" + mins(d.active_minutes) + "</td><td class='num'>" + d.calls + "</td><td class='num'>" + secs(d.talk_seconds) + "</td><td class='num'>" + d.emails + "</td><td class='num'>" + d.conversations + "</td><td class='num'>" + d.booked + "</td></tr>";
    }).join("");
    var list = function (rows, fn, empty) { return rows && rows.length ? '<div class="rlist">' + rows.map(fn).join("") + "</div>" : '<p class="muted">' + empty + "</p>"; };
    var cov = Object.keys(r.coverage || {}).sort().map(function (p) { var c = r.coverage[p], pct = Math.round(c.touched / Math.max(1, c.total) * 100); return '<div class="hbar"><span>Priority ' + E(p) + '</span><div class="bar"><i style="width:' + pct + '%"></i></div><b>' + c.touched + "/" + c.total + "</b></div>"; }).join("");
    return head +
      '<div class="grid g4">' + tile("Touches today", t.touches, t.firms + " firms") + tile("Conversations today", t.conversations, "people reached") + tile("Booked this week", w.booked, w.qualified + " qualified") + tile("Firms this week", w.firms + '<span class="of"> / ' + r.targets.firms + "</span>", "target " + r.targets.firms) + "</div>" +
      '<div class="section-title"><h2>Timesheet</h2><button class="btn ghost small" data-report="csv"' + (ws.days.length ? "" : " disabled") + ">Download CSV</button></div>" +
      '<p class="muted small" style="margin:-6px 0 12px">Active time only counts while the workspace is open and the setter is working, so compare it with the hours Upwork bills. Estimated cost = active hours × $' + ws.pay.hourly + " + $" + ws.pay.perQualifiedMeeting + " per qualified meeting (the bonus is paid only when the meeting is held). “RC” = calls timed by RingCentral.</p>" +
      (sheetRows ? '<div class="card tbl" style="padding:0;overflow-x:auto"><table class="rtable"><thead><tr><th>Setter</th><th class="num">Active</th><th class="num">Calls</th><th class="num">Talk</th><th class="num">Emails</th><th class="num">Conv.</th><th class="num">Booked / qual.</th><th class="num">Calls/h</th><th class="num">Est. cost</th><th class="num">Per qual.</th></tr></thead><tbody>' + sheetRows + "</tbody></table></div>" : '<p class="muted">No shifts yet in this period.</p>') +
      (dayRows ? '<details class="history-box" style="margin-top:12px"><summary>Day by day</summary><div style="overflow-x:auto"><table class="rtable"><thead><tr><th>Date</th><th>Setter</th><th class="num">Active</th><th class="num">Calls</th><th class="num">Talk</th><th class="num">Emails</th><th class="num">Conv.</th><th class="num">Booked</th></tr></thead><tbody>' + dayRows + "</tbody></table></div></details>" : "") +
      '<div class="grid g2" style="margin-top:24px"><div class="card"><h3>List coverage</h3><p class="muted small" style="margin-bottom:12px">Firms touched at least once, by priority.</p>' + (cov || '<p class="muted">No firms.</p>') + "</div>" +
      '<div class="card"><h3>Booked meetings</h3>' + list(r.meetings, function (m) { return '<div class="ritem"><b>' + E(m.firm) + '</b><span class="muted">' + E(m.city) + " · " + E(m.meeting_datetime) + (m.qualified === "y" ? " · qualified" : "") + "</span></div>"; }, "None yet.") + "</div></div>" +
      '<div class="section-title"><h2>Follow-ups due</h2></div>' + list(r.followUps, function (m) { return '<div class="ritem"><b>' + E(m.firm) + '</b><span class="muted">' + E(m.next_step_date) + (m.next_step ? " · " + E(m.next_step) : "") + "</span></div>"; }, "Nothing due.") +
      '<div class="section-title"><h2>Recent activity</h2><span class="muted small">Updated ' + E(r.generated) + "</span></div>" +
      list(r.recent, function (l) { return '<div class="ritem"><b>' + E(l.firm) + ' <span class="pill' + (l.outcome === "booked" ? " ok" : "") + '">' + E(l.channel === "email" ? "Email sent" : label(OUTCOMES, l.outcome)) + '</span></b><span class="muted">' + E(l.timestamp) + " · " + E(l.setter) + " · " + E(label(CHANNELS, l.channel)) + (l.note ? " — " + E(l.note) : "") + "</span></div>"; }, "No activity yet.");
  }
  function csv(r) {
    var rows = [["date", "setter", "active_minutes", "calls", "ringcentral_calls", "talk_seconds", "emails", "touches", "conversations", "booked", "qualified"]];
    ((r.workspace || {}).days || []).forEach(function (d) { rows.push([d.date, d.setter, d.active_minutes, d.calls, d.verified_calls, d.talk_seconds, d.emails, d.touches, d.conversations, d.booked, d.qualified]); });
    return rows.map(function (r_) { return r_.map(function (v) { v = String(v == null ? "" : v); return /[",\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v; }).join(","); }).join("\n");
  }

  /* ---------------- loading + shift loop ---------------- */
  async function load(cx) {
    st.wsError = null;
    try {
      if (live(cx) && !key(cx)) throw new Error("Your call key is missing. Ask Jesús to add it to your account.");
      var r1 = await api(cx, { action: "firms" }); st.firms = r1.firms; st.mine = r1.mine;
      var r2 = await api(cx, { action: "workspace" }); st.shift = r2.shift; st.today = r2.today; st.lastPingAt = Date.now();
      syncLoop(cx);
    } catch (e) { st.wsError = e.message; }
    paint(cx);
  }
  function syncLoop(cx) {
    clearInterval(st.pingTimer); clearInterval(st.tickTimer);
    if (!st.shift) return;
    st.pingTimer = setInterval(function () { ping(cx); }, PING_MS);
    st.tickTimer = setInterval(function () {
      var clock = document.querySelector("[data-ws-clock]"); if (clock) clock.textContent = mins(liveMinutes());
      var ct = document.querySelector("[data-ws-calltime]"); if (ct && st.call) ct.textContent = secs(callSeconds(st.call));
    }, 1000);
  }
  async function ping(cx) {
    if (!st.shift) return;
    var inCall = window.BSA_PHONE && window.BSA_PHONE.current();
    var active = !!inCall || (document.visibilityState === "visible" && Date.now() - st.lastInput < ACTIVE_WINDOW_MS);
    try { var r = await api(cx, { action: "shift", op: "ping", active: active }); st.shift = r.shift; st.today = r.today; st.lastPingAt = Date.now(); if (!r.shift) { syncLoop(cx); paint(cx); } }
    catch (e) { /* keep the shift running; the next ping retries */ }
  }
  ["mousemove", "keydown", "click", "scroll", "touchstart"].forEach(function (ev) { window.addEventListener(ev, function () { st.lastInput = Date.now(); }, { passive: true }); });

  function paint(cx) {
    var main = st.el && document.body.contains(st.el) ? st.el : document.querySelector("#bs-academy .main");
    if (!main || !document.querySelector('#bs-academy .nav button.on[data-tab="workspace"]')) return;
    var y = window.scrollY; main.innerHTML = renderWorkspace(cx); syncForm(main); window.scrollTo(0, y);
  }
  function syncForm(main) {
    var form = main.querySelector('[data-ws-form="log"]'); if (!form) return;
    var o = (form.querySelector("[name=outcome]:checked") || {}).value;
    form.querySelectorAll(".when-talked").forEach(function (x) { x.style.display = TALKED.indexOf(o) > -1 ? "" : "none"; });
    form.querySelectorAll(".when-booked").forEach(function (x) { x.style.display = o === "booked" ? "" : "none"; });
  }

  /* ---------------- phone events ---------------- */
  if (window.BSA_PHONE) window.BSA_PHONE.on(function (type, d) {
    if (type === "status") { if (st.cx) paint(st.cx); return; }
    if (type !== "call" || !st.cx) return;
    st.call = d.call;
    if (d.phase === "ended" && d.call.row) {
      st.outcomeFor = d.call.row;
      api(st.cx, { action: "callEvent", row: d.call.row, firm: d.call.firm, number: d.call.number, started_at: d.call.startedAt, connected_at: d.call.connectedAt, ended_at: d.call.endedAt, seconds: d.call.seconds, source: d.call.source, rc_id: d.call.rcId })
        .then(function (r) { st.today = r.today; paint(st.cx); }).catch(function (e) { st.cx.toast("Call time wasn't saved: " + e.message); });
    }
    paint(st.cx);
  });

  /* ---------------- events ---------------- */
  function mount(el, cx) {
    st.el = el; st.cx = cx;
    if (window.BSA_PHONE) window.BSA_PHONE.init();
    if (!st.firms && (cx.certified || st.preview)) load(cx); else { syncForm(el); syncLoop(cx); }
    el.addEventListener("click", async function (e) {
      var b = e.target.closest("[data-ws],[data-ws-view],[data-ws-filter]"); if (!b || !el.contains(b)) return;
      if (b.dataset.wsView) { st.view = b.dataset.wsView; return paint(cx); }
      if (b.dataset.wsFilter) { st.filter = b.dataset.wsFilter; return paint(cx); }
      var a = b.dataset.ws, row = Number(b.dataset.row), f = (st.firms || []).filter(function (x) { return x.row === row; })[0];
      try {
        if (a === "preview") { st.preview = true; paint(cx); return load(cx); }
        if (a === "reload") { st.firms = null; paint(cx); return load(cx); }
        if (a === "shift") {
          if (b.dataset.op === "end" && !confirm("End your shift? Remember to stop your Upwork tracker too.")) return;
          b.disabled = true;
          var r = await api(cx, { action: "shift", op: b.dataset.op, active: true }); st.shift = r.shift; st.today = r.today; st.lastPingAt = Date.now();
          syncLoop(cx); cx.toast(b.dataset.op === "start" ? "Shift started. Start your Upwork tracker too." : b.dataset.op === "pause" ? "Paused" : "Shift ended"); return paint(cx);
        }
        if (a === "open") { st.pinned = row; st.view = "queue"; st.outcomeFor = null; return paint(cx); }
        if (a === "unpin") { st.pinned = null; st.outcomeFor = null; return paint(cx); }
        if (a === "skip") { st.skipped.push(row); st.pinned = null; st.outcomeFor = null; return paint(cx); }
        if (a === "log") { st.outcomeFor = row; return paint(cx); }
        if (a === "cancellog") { st.outcomeFor = null; return paint(cx); }
        if (a === "call") {
          if (!st.shift) cx.toast("Tip: start your shift so this call counts toward your active time.");
          if (!window.BSA_PHONE) throw new Error("The phone isn't available on this page.");
          st.call = window.BSA_PHONE.call(f.main_phone, { row: f.row, firm: f.firm }); return paint(cx);
        }
        if (a === "endcall") { window.BSA_PHONE && window.BSA_PHONE.end(); return; }
        if (a === "email") { var t = templates(f, cx)[0]; st.compose = { row: row, template: t.id, subject: t.subject, body: t.body, to: "" }; return paint(cx); }
        if (a === "closecompose") { st.compose = null; return paint(cx); }
      } catch (err) { cx.toast(err.message); b.disabled = false; }
    });
    el.addEventListener("change", function (e) {
      if (e.target.matches("[data-ws-prio]")) { st.prio = e.target.value; paint(cx); }
      if (e.target.name === "outcome") syncForm(el);
      if (e.target.matches("[data-ws-template]") && st.compose) {
        var f = (st.firms || []).filter(function (x) { return x.row === st.compose.row; })[0], t = templates(f, cx).filter(function (x) { return x.id === e.target.value; })[0];
        var to = (el.querySelector('[data-ws-form="email"] [name=to]') || {}).value || "";
        st.compose = { row: st.compose.row, template: t.id, subject: t.subject, body: t.body, to: to }; paint(cx);
      }
    });
    el.addEventListener("input", function (e) {
      if (!e.target.matches("[data-ws-q]")) return;
      st.q = e.target.value; var pos = e.target.selectionStart; paint(cx);
      var inp = el.querySelector("[data-ws-q]"); if (inp) { inp.focus(); inp.setSelectionRange(pos, pos); }
    });
    el.addEventListener("submit", async function (e) {
      var form = e.target.closest("[data-ws-form]"); if (!form) return; e.preventDefault();
      if (st.saving) return;
      var fd = new FormData(form), row = Number(form.dataset.row), f = (st.firms || []).filter(function (x) { return x.row === row; })[0], btn = form.querySelector("[type=submit]");
      var v = function (k) { return String(fd.get(k) || "").trim(); };
      try {
        st.saving = true; if (btn) { btn.disabled = true; btn.textContent = "Saving…"; }
        if (form.dataset.wsForm === "log") {
          var outcome = v("outcome"); if (!outcome) throw new Error("Pick an outcome");
          if (outcome === "booked" && (!v("meeting_date") || !v("meeting_time"))) throw new Error("Add the meeting date and time");
          var talked = TALKED.indexOf(outcome) > -1, callNote = st.call && st.call.row === row && st.call.endedAt ? " [call " + secs(st.call.seconds) + "]" : "";
          var r = await api(cx, { action: "log", row: f.row, firm: f.firm, channel: v("channel") || "call", outcome: outcome, qualified: talked ? v("qualified") : "", hot: talked && !!fd.get("hot"),
            meeting_datetime: outcome === "booked" ? v("meeting_date") + " " + v("meeting_time") + " PT" : "", next_step: v("next_step"),
            next_step_date: v("next_step_date") || (outcome === "booked" || outcome === "declined" ? "" : undefined), note: (v("note") + callNote).trim() });
          st.firms = st.firms.map(function (x) { return x.row === r.firm.row ? r.firm : x; }); st.mine = r.mine; st.outcomeFor = null; st.pinned = null; st.call = null;
          try { var w = await api(cx, { action: "workspace" }); st.today = w.today; st.shift = w.shift; } catch (er) {}
          cx.toast(outcome === "booked" ? "Booked. Send Jesús the brief within 1 hour." : "Saved. Next firm.");
        } else if (form.dataset.wsForm === "email") {
          if (/\[[^\]]+\]/.test(v("body") + v("subject"))) throw new Error("Replace the [bracketed] parts first");
          var r2 = await api(cx, { action: "sendEmail", row: f.row, firm: f.firm, to: v("to"), subject: v("subject"), body: v("body"), template: v("template"), next_step_date: v("next_step_date") });
          st.firms = st.firms.map(function (x) { return x.row === r2.firm.row ? r2.firm : x; }); st.today = r2.today; st.compose = null;
          cx.toast("Email sent and logged");
        }
        st.saving = false; paint(cx);
      } catch (err) {
        // Keep what the setter typed: no repaint, just re-enable the button.
        st.saving = false; cx.toast(err.message);
        if (btn) { btn.disabled = false; btn.textContent = form.dataset.wsForm === "email" ? "Send email" : "Save & next"; }
      }
    });
  }

  function mountReport(el, cx) {
    st.report = null; loadReport(cx, el);
    el.addEventListener("click", function (e) {
      var b = e.target.closest("[data-report-days],[data-report]"); if (!b) return;
      if (b.dataset.report === "csv") {
        var blob = new Blob([csv(st.report || {})], { type: "text/csv" }), a = document.createElement("a");
        a.href = URL.createObjectURL(blob); a.download = "setter-timesheet-" + today() + ".csv"; document.body.appendChild(a); a.click(); a.remove(); return;
      }
      if (b.dataset.reportDays) st.days = Number(b.dataset.reportDays);
      st.report = null; el.innerHTML = renderReport(cx); loadReport(cx, el);
    });
  }
  async function loadReport(cx, el) {
    st.reportError = null;
    try { var d = await api(cx, { action: "report", days: st.days }); st.report = d.report; } catch (e) { st.reportError = e.message; }
    if (el && document.body.contains(el)) el.innerHTML = renderReport(cx);
  }

  /* ---------------- preview mock (fictional firms, this browser only) ---------------- */
  var MOCK_KEY = "bsa-demo-workspace";
  var SAMPLE = [["A", "Northgate Studio", "Architect", "Palo Alto", "Dana Example"], ["A", "Laurel & Pine Landscape Architecture", "Landscape Architect", "Menlo Park", "Sam Sample"], ["A", "Crestline Homes", "Builder", "Los Altos", "Alex Demo"],
    ["A", "Hillview Design Group", "Architect", "Atherton", "Jordan Test"], ["B", "Oakmont Residential", "Developer", "San José", "Taylor Placeholder"], ["B", "Fieldstone Architects", "Architect", "Saratoga", ""],
    ["B", "Redwood Grove Builders", "Builder", "Woodside", ""], ["B", "Juniper Lane Studio", "Landscape Architect", "Los Gatos", ""], ["C", "Bayline Development", "Developer", "Redwood City", ""],
    ["C", "Summit Ridge Custom Homes", "Builder", "Cupertino", ""], ["C", "Willow Court Architecture", "Architect", "San Mateo", ""], ["C", "Granite Path Design", "Landscape Architect", "Burlingame", ""]];
  function mdb() {
    try { var d = JSON.parse(localStorage.getItem(MOCK_KEY)); if (d && d.firms) return d; } catch (e) {}
    return { log: [], shifts: [], calls: [], emails: [], firms: SAMPLE.map(function (s, i) { return { row: i + 2, priority: s[0], firm: s[1], type: s[2], city: s[3], principal: s[4], website: "https://example.com", main_phone: "(650) 555-01" + String(10 + i), high_end_note: "Fictional sample firm for the preview.", source_url: "https://example.com", date: "", outcome: "", next_step: "", next_step_date: "", meeting_datetime: "", qualified: "", notes: "" }; }) };
  }
  function msave(db) { try { localStorage.setItem(MOCK_KEY, JSON.stringify(db)); } catch (e) {} }
  function stamp() { var d = new Date(); return today() + " " + String(d.getHours()).padStart(2, "0") + ":" + String(d.getMinutes()).padStart(2, "0"); }
  function weekStart() { var d = new Date(); d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); return ymd(d); }
  function mstats(rows) { var f = {}; rows.forEach(function (l) { f[l.firm] = 1; }); return { touches: rows.length, firms: Object.keys(f).length, conversations: rows.filter(function (l) { return TALKED.indexOf(l.outcome) > -1; }).length, booked: rows.filter(function (l) { return l.outcome === "booked"; }).length, qualified: rows.filter(function (l) { return l.outcome === "booked" && l.qualified === "y"; }).length }; }
  function mmine(db, who) { var m = db.log.filter(function (l) { return !who || l.setter === who; }); return { today: mstats(m.filter(function (l) { return l.date === today(); })), week: mstats(m.filter(function (l) { return l.date >= weekStart(); })), targets: { firms: 40, conversations: 10 } }; }
  function mday(db, who, d) {
    var x = { setter: who, date: d, active_minutes: 0, shifts: 0, calls: 0, verified_calls: 0, talk_seconds: 0, emails: 0, touches: 0, conversations: 0, booked: 0, qualified: 0 };
    db.shifts.forEach(function (s) { if (s.setter === who && s.date === d) { x.active_minutes += s.active_minutes; x.shifts++; } });
    db.calls.forEach(function (c) { if (c.setter === who && c.date === d) { x.calls++; x.talk_seconds += c.seconds; if (c.source === "ringcentral") x.verified_calls++; } });
    db.emails.forEach(function (e) { if (e.setter === who && e.date === d) x.emails++; });
    db.log.forEach(function (l) { if (l.setter === who && l.date === d) { x.touches++; if (TALKED.indexOf(l.outcome) > -1) x.conversations++; if (l.outcome === "booked") { x.booked++; if (l.qualified === "y") x.qualified++; } } });
    x.active_minutes = Math.round(x.active_minutes * 100) / 100; return x;
  }
  function mopen(db, who) { return db.shifts.filter(function (s) { return s.setter === who && (s.status === "open" || s.status === "paused"); })[0] || null; }
  function mfirm(db, p) { var f = db.firms.filter(function (x) { return x.row === Number(p.row); })[0]; if (!f || f.firm !== p.firm) throw new Error("The list changed. Refresh and try again."); return f; }
  async function mock(cx, p) {
    await new Promise(function (r) { setTimeout(r, 120); });
    var db = mdb(), who = cx.member.name, res;
    switch (p.action) {
      case "firms": res = { firms: db.firms, mine: mmine(db, who) }; break;
      case "workspace": var s0 = mopen(db, who); res = { shift: s0 && { id: s0.id, status: s0.status, started_at: s0.started_at, active_minutes: s0.active_minutes }, today: mday(db, who, today()) }; break;
      case "shift": {
        var s = mopen(db, who), t = Date.now();
        if (p.op === "start") { if (s) { s.status = "open"; s.last_ping = t; } else { s = { id: String(t), setter: who, date: today(), started_at: t, active_minutes: 0, last_ping: t, status: "open" }; db.shifts.push(s); } }
        else if (!s) { if (p.op !== "ping") throw new Error("Start your shift first."); }
        else if (p.op === "ping") { var gap = (t - s.last_ping) / 60000; if (s.status === "open" && p.active && gap > 0 && gap <= 3) s.active_minutes += gap; s.last_ping = t; }
        else if (p.op === "pause") { s.status = "paused"; s.last_ping = t; }
        else if (p.op === "end") { s.status = "closed"; s.ended_at = t; s = null; }
        var o = mopen(db, who); res = { shift: o && { id: o.id, status: o.status, started_at: o.started_at, active_minutes: o.active_minutes }, today: mday(db, who, today()) }; break;
      }
      case "log": {
        var f = mfirm(db, p);
        if (OUTCOMES.map(function (x) { return x[0]; }).indexOf(p.outcome) < 0) throw new Error("Invalid outcome.");
        if (p.outcome === "booked" && !p.meeting_datetime) throw new Error("A booked meeting needs the date and time it was accepted for.");
        var line = today() + " " + p.channel + ": " + p.outcome + (p.hot ? " · hot" : "") + (p.note ? " — " + p.note : "");
        f.date = today(); f.outcome = p.outcome; f.next_step = p.next_step || ""; f.next_step_date = p.next_step_date || ""; if (p.meeting_datetime) f.meeting_datetime = p.meeting_datetime; if (p.qualified) f.qualified = p.qualified;
        f.notes = f.notes ? line + "\n" + f.notes : line;
        db.log.push({ timestamp: stamp(), date: today(), setter: who, firm: f.firm, row: f.row, priority: f.priority, channel: p.channel, outcome: p.outcome, qualified: p.qualified || "", note: p.note || "", next_step: p.next_step || "", next_step_date: p.next_step_date || "", meeting_datetime: p.meeting_datetime || "" });
        res = { firm: f, mine: mmine(db, who) }; break;
      }
      case "callEvent": { var f2 = mfirm(db, p); db.calls.push({ setter: who, date: today(), row: f2.row, firm: f2.firm, seconds: Math.max(0, Math.round(Number(p.seconds) || 0)), source: p.source === "ringcentral" ? "ringcentral" : "manual" }); res = { today: mday(db, who, today()) }; break; }
      case "sendEmail": {
        var f3 = mfirm(db, p);
        if (!/^[^@\s,;<>]+@[^@\s,;<>]+\.[a-z]{2,}$/i.test(p.to || "")) throw new Error("That email address doesn't look right.");
        if (!p.subject || !p.body) throw new Error("Write a subject and a message.");
        db.emails.push({ setter: who, date: today(), row: f3.row, firm: f3.firm, to: p.to, subject: p.subject });
        f3.date = today(); f3.notes = today() + " email: sent to " + p.to + " — " + p.subject + (f3.notes ? "\n" + f3.notes : ""); if (p.next_step_date) f3.next_step_date = p.next_step_date;
        db.log.push({ timestamp: stamp(), date: today(), setter: who, firm: f3.firm, row: f3.row, channel: "email", outcome: "sent", note: p.subject });
        res = { firm: f3, today: mday(db, who, today()) }; break;
      }
      case "report": {
        var since = new Date(); since.setDate(since.getDate() - (Number(p.days) - 1)); var from = ymd(since), cov = {}, setters = {};
        db.firms.forEach(function (f) { var c = cov[f.priority] = cov[f.priority] || { total: 0, touched: 0 }; c.total++; if (f.date) c.touched++; });
        [db.log, db.shifts, db.calls, db.emails].forEach(function (list) { list.forEach(function (x) { if (x.date >= from) setters[x.setter + "|" + x.date] = 1; }); });
        var days = Object.keys(setters).sort().map(function (k) { var sp = k.split("|"); return mday(db, sp[0], sp[1]); }), totals = {};
        days.forEach(function (d) { var t = totals[d.setter] = totals[d.setter] || { setter: d.setter, active_minutes: 0, calls: 0, verified_calls: 0, talk_seconds: 0, emails: 0, touches: 0, conversations: 0, booked: 0, qualified: 0 }; Object.keys(t).forEach(function (k) { if (k !== "setter") t[k] += d[k]; }); });
        var tl = Object.keys(totals).map(function (k) { var t = totals[k], h = t.active_minutes / 60; t.calls_per_hour = h ? Math.round(t.calls / h * 10) / 10 : 0; t.est_cost = Math.round(h * 20 + t.qualified * 75); t.cost_per_qualified = t.qualified ? Math.round(t.est_cost / t.qualified) : null; return t; });
        var all = mmine(db);
        res = { report: { generated: new Date().toLocaleString("en-US"), today: all.today, week: all.week, targets: all.targets, coverage: cov,
          meetings: db.firms.filter(function (f) { return f.outcome === "booked"; }), followUps: db.firms.filter(isDue), recent: db.log.slice(-30).reverse(),
          workspace: { from: from, to: today(), pay: { hourly: 20, perQualifiedMeeting: 75 }, days: days, totals: tl } } }; break;
      }
      default: throw new Error("Unknown action.");
    }
    msave(db); return Object.assign({ ok: true }, res);
  }

  window.BSA_TABS = (window.BSA_TABS || []).concat([
    { id: "workspace", label: "Workspace", count: function () { return st.firms ? String(st.firms.filter(isDue).length || "") : ""; }, render: renderWorkspace, mounted: mount },
    { id: "report", label: "Report", visible: function (cx) { return !!cx.member.isAdmin; }, render: renderReport, mounted: mountReport }
  ]);
})();
