/**
 * Blue Sierra Academy · setter workspace (second file in the same Apps Script project as Code.gs).
 * Adds: the shift clock, call records (talk time), email from the dashboard, and the timesheet for Jesús.
 *
 * Time tracking is a cross-check for Upwork, not a replacement: Upwork's desktop tracker stays the billing
 * record (only tracked time has Upwork's hourly payment protection). The shift clock only credits minutes
 * while the dashboard is open and the setter is active, so Jesús can compare Upwork hours with real activity.
 */

var WS = {
  SHIFTS_TAB: "Shifts",
  CALLS_TAB: "Call Events",
  EMAILS_TAB: "Emails",
  SHIFT_HEADERS: ["id", "setter", "date", "started_at", "ended_at", "active_minutes", "last_ping", "status", "pings", "idle_pings"],
  CALL_HEADERS: ["timestamp", "date", "setter", "row", "firm", "number", "started_at", "connected_at", "ended_at", "seconds", "source", "rc_id"],
  EMAIL_HEADERS: ["timestamp", "date", "setter", "row", "firm", "to", "subject", "template", "domain_match"],
  PING_SECONDS: 60,          // the dashboard pings once a minute while a shift is running
  MAX_GAP_MIN: 3,            // a gap longer than this (sleep, closed tab) earns no credit
  STALE_MIN: 30,             // a shift with no ping for 30 min is treated as ended at its last ping
  MAX_CALL_SECONDS: 4 * 3600,
  EMAIL_DAILY_CAP: 40,
  BCC_JESUS: true,           // Jesús gets a copy of every email sent from the dashboard
  PAY: { hourly: 20, perQualifiedMeeting: 75 } // from the setter offer; the bonus is paid per qualified meeting HELD
};

/** Called from Code.gs doPost for workspace actions. Returns a response object, or null if it's not a workspace action. */
function workspaceAction(who, b) {
  switch (b.action) {
    case "workspace": return { ok: true, shift: shiftOut(openShift(who.name)), today: todayFor(who.name) };
    case "shift": return withLock(function () { return { ok: true, shift: shiftOut(shiftOp(who, String(b.op || ""), !!b.active)), today: todayFor(who.name) }; });
    case "callEvent": return withLock(function () { recordCall(who, b); return { ok: true, today: todayFor(who.name) }; });
    case "sendEmail": return withLock(function () { var f = sendFirmEmail(who, b); return { ok: true, firm: f, today: todayFor(who.name) }; });
    default: return null;
  }
}
function withLock(fn) { var lock = LockService.getScriptLock(); lock.waitLock(15000); try { return fn(); } finally { lock.releaseLock(); } }

/* ---------------- shifts ---------------- */

function shiftOp(who, op, active) {
  var t = Date.now(), s = openShift(who.name);
  if (op === "start") {
    if (s && s.status === "paused") { tUpdate(WS.SHIFTS_TAB, WS.SHIFT_HEADERS, s.id, { status: "open", last_ping: t }); return openShift(who.name); }
    if (s) return s;
    var id = Utilities.getUuid().slice(0, 13);
    tAppend(WS.SHIFTS_TAB, WS.SHIFT_HEADERS, { id: id, setter: who.name, date: todayKey(), started_at: t, ended_at: "", active_minutes: 0, last_ping: t, status: "open", pings: 0, idle_pings: 0 });
    return openShift(who.name);
  }
  if (!s) { if (op === "ping") return null; throw new Error("Start your shift first."); }
  if (op === "ping") {
    var gapMin = (t - Number(s.last_ping)) / 60000, patch = { last_ping: t };
    if (s.status === "open" && active && gapMin > 0 && gapMin <= WS.MAX_GAP_MIN) {
      patch.active_minutes = round2(Number(s.active_minutes || 0) + gapMin); patch.pings = Number(s.pings || 0) + 1;
    } else patch.idle_pings = Number(s.idle_pings || 0) + 1;
    tUpdate(WS.SHIFTS_TAB, WS.SHIFT_HEADERS, s.id, patch);
  } else if (op === "pause") tUpdate(WS.SHIFTS_TAB, WS.SHIFT_HEADERS, s.id, { status: "paused", last_ping: t });
  else if (op === "end") { tUpdate(WS.SHIFTS_TAB, WS.SHIFT_HEADERS, s.id, { status: "closed", ended_at: t, last_ping: t }); return null; }
  else throw new Error("Unknown shift action.");
  return openShift(who.name);
}

/** The setter's running or paused shift, after closing any shift that went stale. */
function openShift(name) {
  var rows = tRows(WS.SHIFTS_TAB, WS.SHIFT_HEADERS), open = null;
  rows.forEach(function (s) {
    if (s.setter !== name || (s.status !== "open" && s.status !== "paused")) return;
    if (Date.now() - Number(s.last_ping) > WS.STALE_MIN * 60000) tUpdate(WS.SHIFTS_TAB, WS.SHIFT_HEADERS, s.id, { status: "closed", ended_at: s.last_ping });
    else open = s;
  });
  return open;
}
function shiftOut(s) { return s ? { id: s.id, status: s.status, started_at: Number(s.started_at), active_minutes: Number(s.active_minutes || 0) } : null; }

/* ---------------- calls ---------------- */

function recordCall(who, b) {
  var firm = firmAt(b.row, b.firm);
  var started = Number(b.started_at) || Date.now(), ended = Number(b.ended_at) || Date.now();
  var seconds = Math.max(0, Math.min(WS.MAX_CALL_SECONDS, Math.round(Number(b.seconds) || 0)));
  tAppend(WS.CALLS_TAB, WS.CALL_HEADERS, {
    timestamp: new Date(), date: todayKey(), setter: who.name, row: firm.row, firm: firm.firm,
    number: String(b.number || "").replace(/[^\d+]/g, "").slice(0, 20), started_at: iso(started), connected_at: b.connected_at ? iso(Number(b.connected_at)) : "",
    ended_at: iso(ended), seconds: seconds, source: b.source === "ringcentral" ? "ringcentral" : "manual", rc_id: String(b.rc_id || "").slice(0, 80)
  });
}

/* ---------------- email ---------------- */

function sendFirmEmail(who, b) {
  var firm = firmAt(b.row, b.firm);
  var to = String(b.to || "").trim().toLowerCase();
  if (!/^[^@\s,;<>]+@[^@\s,;<>]+\.[a-z]{2,}$/.test(to)) throw new Error("That email address doesn't look right.");
  var subject = String(b.subject || "").replace(/[\r\n]+/g, " ").trim().slice(0, 200);
  var body = String(b.body || "").replace(/\r/g, "").trim().slice(0, 5000);
  if (!subject || !body) throw new Error("Write a subject and a message.");
  var today = todayKey();
  var sentToday = tRows(WS.EMAILS_TAB, WS.EMAIL_HEADERS).filter(function (e) { return e.setter === who.name && e.date === today; }).length;
  if (sentToday >= WS.EMAIL_DAILY_CAP) throw new Error("Daily email limit reached (" + WS.EMAIL_DAILY_CAP + "). Ask Jesús if you need more.");
  var siteDomain = String(firm.website || "").replace(/^https?:\/\//, "").replace(/^www\./, "").split(/[\/?#]/)[0].toLowerCase();
  var domainMatch = siteDomain && to.split("@")[1] === siteDomain;

  // Check the sheet before sending, so a broken sheet can't leave an email sent but not logged.
  var sh = callSheet(), head = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0].map(String);
  var col = function (n) { var i = head.indexOf(n); if (i < 0) throw new Error("Missing column: " + n); return i + 1; };
  var C = { date: col("date"), notes: col("notes"), next_step_date: col("next_step_date") }, logSh = logSheet();

  var props = PropertiesService.getScriptProperties();
  var opts = { name: who.name + " for Jesús Toto · Blue Sierra Construction", replyTo: props.getProperty("REPLY_TO") || CONFIG.REPORT_EMAIL };
  var from = props.getProperty("SEND_FROM");                    // optional "send mail as" alias, e.g. the setter's address
  if (from && GmailApp.getAliases().indexOf(from) > -1) opts.from = from;
  if (WS.BCC_JESUS) opts.bcc = CONFIG.REPORT_EMAIL;
  GmailApp.sendEmail(to, subject, body + "\n\n--\n" + who.name + ", on behalf of Jesús Toto\nBlue Sierra Construction, Inc. · San José, CA · (408) 458-7917", opts);

  tAppend(WS.EMAILS_TAB, WS.EMAIL_HEADERS, { timestamp: new Date(), date: today, setter: who.name, row: firm.row, firm: firm.firm, to: to, subject: subject, template: String(b.template || "custom").slice(0, 40), domain_match: domainMatch ? "y" : "n" });

  // Same touch rules as calls: the date and a dated note at the top of the firm's notes, plus a Call Log line.
  var old = String(sh.getRange(firm.row, C.notes).getValue() || "");
  var line = today + " email: sent to " + to + " — " + subject;
  sh.getRange(firm.row, C.date).setValue(today);
  sh.getRange(firm.row, C.notes).setValue(safe(old ? line + "\n" + old : line));
  if (b.next_step_date && /^\d{4}-\d{2}-\d{2}$/.test(b.next_step_date)) sh.getRange(firm.row, C.next_step_date).setValue(b.next_step_date);
  logSh.appendRow([new Date(), today, safe(who.name), firm.firm, firm.row, String(firm.priority || ""), "email", "sent", "", "", "", "", b.next_step_date || "", safe(subject)]);
  return filterFirm(readFirmRow(firm.row), who.role);
}

/* ---------------- numbers for the setter and for Jesús ---------------- */

function todayFor(name) { var d = todayKey(); return dayStats(name, d, d)[0] || emptyDay(name, d); }

/** One row per setter per day between two YYYY-MM-DD dates (inclusive). */
function dayStats(name, from, to) {
  var byKey = {}, key = function (s, d) { return s + "|" + d; };
  var get = function (s, d) { return byKey[key(s, d)] = byKey[key(s, d)] || emptyDay(s, d); };
  var inRange = function (d) { return d >= from && d <= to; };
  tRows(WS.SHIFTS_TAB, WS.SHIFT_HEADERS).forEach(function (s) { if (inRange(s.date) && (!name || s.setter === name)) { var x = get(s.setter, s.date); x.active_minutes += Number(s.active_minutes || 0); x.shifts++; } });
  tRows(WS.CALLS_TAB, WS.CALL_HEADERS).forEach(function (c) { if (inRange(c.date) && (!name || c.setter === name)) { var x = get(c.setter, c.date); x.calls++; x.talk_seconds += Number(c.seconds || 0); if (c.source === "ringcentral") x.verified_calls++; } });
  tRows(WS.EMAILS_TAB, WS.EMAIL_HEADERS).forEach(function (e) { if (inRange(e.date) && (!name || e.setter === name)) get(e.setter, e.date).emails++; });
  readLog().forEach(function (l) {
    if (!inRange(l.date) || (name && l.setter !== name)) return;
    var x = get(l.setter, l.date); x.touches++;
    if (CONFIG.TALKED.indexOf(l.outcome) > -1) x.conversations++;
    if (l.outcome === "booked") { x.booked++; if (l.qualified === "y") x.qualified++; }
  });
  return Object.keys(byKey).sort().map(function (k) { var x = byKey[k]; x.active_minutes = round2(x.active_minutes); return x; });
}
function emptyDay(s, d) { return { setter: s, date: d, active_minutes: 0, shifts: 0, calls: 0, verified_calls: 0, talk_seconds: 0, emails: 0, touches: 0, conversations: 0, booked: 0, qualified: 0 }; }

/** Added to the admin report: daily timesheet rows, weekly totals per setter and an estimated cost. */
function workspaceReport(days) {
  var to = todayKey(), from = Utilities.formatDate(new Date(Date.now() - (Math.max(1, days) - 1) * 864e5), CONFIG.TZ, "yyyy-MM-dd");
  var rows = dayStats(null, from, to), totals = {};
  rows.forEach(function (r) {
    var t = totals[r.setter] = totals[r.setter] || emptyDay(r.setter, from + " → " + to);
    ["active_minutes", "shifts", "calls", "verified_calls", "talk_seconds", "emails", "touches", "conversations", "booked", "qualified"].forEach(function (k) { t[k] += r[k]; });
  });
  var out = Object.keys(totals).map(function (s) {
    var t = totals[s], hours = t.active_minutes / 60;
    t.active_minutes = round2(t.active_minutes);
    t.calls_per_hour = hours ? Math.round(t.calls / hours * 10) / 10 : 0;
    t.est_cost = Math.round(hours * WS.PAY.hourly + t.qualified * WS.PAY.perQualifiedMeeting);
    t.cost_per_qualified = t.qualified ? Math.round(t.est_cost / t.qualified) : null;
    return t;
  });
  return { from: from, to: to, pay: WS.PAY, days: rows, totals: out };
}

/* ---------------- helpers ---------------- */

function firmAt(row, name) {
  var f = readFirmRow(Number(row));
  if (!f || String(f.firm) !== String(name)) throw new Error("The list changed. Refresh and try again.");
  return f;
}
function readFirmRow(row) {
  var sh = callSheet();
  if (!(row >= 2 && row <= sh.getLastRow())) return null;
  var head = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0].map(String), vals = sh.getRange(row, 1, 1, head.length).getValues()[0], f = {};
  head.forEach(function (h, c) { if (h) f[h] = cell(vals[c]); });
  f.row = row;
  return f.firm ? f : null;
}
function tSheet(tab, headers) { var sh = sheet(tab); if (sh.getLastRow() === 0) { sh.appendRow(headers); sh.setFrozenRows(1); } return sh; }
function tRows(tab, headers) {
  var v = tSheet(tab, headers).getDataRange().getValues(), out = [];
  for (var i = 1; i < v.length; i++) { var o = {}; headers.forEach(function (h, c) { o[h] = v[i][c] instanceof Date ? cell(v[i][c]) : String(v[i][c]); }); out.push(o); }
  return out;
}
function tAppend(tab, headers, obj) { tSheet(tab, headers).appendRow(headers.map(function (h) { return safe(obj[h] == null ? "" : obj[h]); })); }
function tUpdate(tab, headers, id, patch) {
  var sh = tSheet(tab, headers), v = sh.getDataRange().getValues();
  for (var i = 1; i < v.length; i++) if (String(v[i][0]) === String(id)) {
    Object.keys(patch).forEach(function (k) { var c = headers.indexOf(k); if (c > -1) sh.getRange(i + 1, c + 1).setValue(safe(patch[k])); });
    return;
  }
}
function todayKey() { return Utilities.formatDate(new Date(), CONFIG.TZ, "yyyy-MM-dd"); }
function iso(ms) { return Utilities.formatDate(new Date(ms), CONFIG.TZ, "yyyy-MM-dd HH:mm:ss"); }
function round2(n) { return Math.round(Number(n) * 100) / 100; }
