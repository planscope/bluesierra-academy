/**
 * Blue Sierra Academy · Call log API for the Setter Call List.
 *
 * Paste this into the Setter Call List sheet: Extensions → Apps Script → Code.gs.
 * Then run setup() once, and deploy as a Web app (Execute as: Me · Who has access: Anyone).
 *
 * What it does
 *  - POST {action:"firms", key} → firms (setter fields are whitelisted; admin sees all columns).
 *  - POST {action:"log", key, row, firm, …} → writes the touch into the firm's row and the "Call Log" tab.
 *  - POST {action:"report", key, days} → the report for Jesús (admin keys only).
 *  - GET is disabled. Front-end must POST with Content-Type: text/plain and a JSON body
 *    to avoid CORS preflight. Never put access keys in URLs.
 *  - Keys live in Script Properties, not the shared sheet (setters can edit the sheet).
 *    Manage them with addSetter(), deactivateSetter() and listSetters(). Only Jesús should edit this script.
 *  - sendDailyReport()          → optional email summary. OFF by default: the Grok "Growth Strategist" bot already
 *                                 sends Jesús a 5:30 PM summary and can read the "Call Log" tab. Run enableDailyEmail() to turn it on.
 *
 * Rules it enforces (from the setter playbook): it never adds or deletes firms, never re-sorts,
 * and new notes go at the START of the notes cell with the date, keeping earlier notes.
 */

var CONFIG = {
  REPORT_EMAIL: "jtoto@bluesierracorp.com",
  TZ: "America/Los_Angeles",
  LOG_TAB: "Call Log",
  KEYS_PROPERTY: "ACADEMY_ACCESS_KEYS",
  // Columns the setter sees (the Setter Call List's real headers, checked 2026-11-05).
  SETTER_FIELDS: ["row", "priority", "firm", "type", "city", "website", "main_phone", "principal", "high_end_note", "source_url", "date", "outcome", "next_step", "next_step_date", "meeting_datetime", "qualified", "notes"],
  WEEKLY_TARGETS: { firms: 40, conversations: 10 },
  OUTCOMES: ["no_answer", "vm", "conversation", "booked", "declined"],
  CHANNELS: ["call", "voicemail", "email", "linkedin"],
  // A conversation happened when the outcome is one of these.
  TALKED: ["conversation", "booked", "declined"]
};

var LOG_HEADERS = ["timestamp", "date", "setter", "firm", "row", "priority", "channel", "outcome", "qualified", "hot", "meeting_datetime", "next_step", "next_step_date", "note"];

/* ---------------- web app ---------------- */

function doGet(e) {
  return guard(function () { return { ok: false, error: "Use POST." }; });
}

function doPost(e) {
  return guard(function () {
    var body = JSON.parse((e.postData && e.postData.contents) || "{}");
    var who = auth(body.key);
    if (body.action === "firms") return { ok: true, setter: who.name, firms: readFirms(who.role), mine: summarize(readLog(), who.name) };
    if (body.action === "report") {
      if (who.role !== "admin") throw new Error("Only Jesús can see the report.");
      return { ok: true, report: buildReport(Number(body.days) || 7) };
    }
    if (body.action !== "log") throw new Error("Unknown action.");
    var lock = LockService.getScriptLock();
    lock.waitLock(15000);
    try { return { ok: true, firm: logTouch(who, body), mine: summarize(readLog(), who.name) }; }
    finally { lock.releaseLock(); }
  });
}

function guard(fn) {
  var out;
  try { out = fn(); } catch (err) { out = { ok: false, error: String(err.message || err) }; }
  return ContentService.createTextOutput(JSON.stringify(out)).setMimeType(ContentService.MimeType.JSON);
}

/* Keys are private Script Properties; only trusted admins should have script editor access. */
function readKeys() {
  return JSON.parse(PropertiesService.getScriptProperties().getProperty(CONFIG.KEYS_PROPERTY) || "{}");
}
function saveKeys(keys) {
  PropertiesService.getScriptProperties().setProperty(CONFIG.KEYS_PROPERTY, JSON.stringify(keys));
}
function auth(key) {
  if (!key || String(key).length < 16) throw new Error("Missing access key. Ask Jesús to add your call key.");
  var keys = readKeys(), entry = Object.prototype.hasOwnProperty.call(keys, String(key)) ? keys[String(key)] : null;
  if (!entry || entry.active !== true) throw new Error("This access key is not active.");
  return { key: key, name: entry.name, email: entry.email, role: entry.role };
}

/* ---------------- call list ---------------- */

function callSheet() {
  var all = SpreadsheetApp.getActive().getSheets();
  for (var i = 0; i < all.length; i++) {
    var head = all[i].getRange(1, 1, 1, Math.max(1, all[i].getLastColumn())).getValues()[0].map(String);
    if (head.indexOf("firm") > -1 && head.indexOf("outcome") > -1) return all[i];
  }
  throw new Error("Could not find the call list tab (needs 'firm' and 'outcome' columns).");
}

function readFirms(role) {
  var sh = callSheet(), values = sh.getDataRange().getValues(), head = values[0].map(String), out = [];
  for (var r = 1; r < values.length; r++) {
    if (!values[r][head.indexOf("firm")]) continue;
    var f = { row: r + 1 };
    head.forEach(function (h, c) { if (h) f[h] = cell(values[r][c]); });
    out.push(filterFirm(f, role));
  }
  return out;
}

function filterFirm(f, role) {
  if (role === "admin") return f;
  var out = {};
  CONFIG.SETTER_FIELDS.forEach(function (h) { if (Object.prototype.hasOwnProperty.call(f, h)) out[h] = f[h]; });
  return out;
}

function logTouch(who, b) {
  var sh = callSheet(), head = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0].map(String);
  var row = Number(b.row);
  if (!(row >= 2 && row <= sh.getLastRow())) throw new Error("That firm is not on the list.");
  var col = function (name) { var i = head.indexOf(name); if (i < 0) throw new Error("Missing column: " + name); return i + 1; };
  var current = sh.getRange(row, 1, 1, head.length).getValues()[0];
  var firmName = String(current[head.indexOf("firm")]);
  if (firmName !== String(b.firm)) throw new Error("The list changed. Refresh and try again.");

  var outcome = pick(b.outcome, CONFIG.OUTCOMES, "outcome");
  var channel = pick(b.channel || "call", CONFIG.CHANNELS, "channel");
  var qualified = b.qualified === "y" || b.qualified === "n" ? b.qualified : "";
  var nextDate = dateOrEmpty(b.next_step_date, "next step date");
  var meeting = String(b.meeting_datetime || "").slice(0, 40);
  if (outcome === "booked" && !meeting) throw new Error("A booked meeting needs the date and time it was accepted for.");
  var note = String(b.note || "").replace(/\s+/g, " ").trim().slice(0, 600);
  var today = Utilities.formatDate(new Date(), CONFIG.TZ, "yyyy-MM-dd");

  var line = today + " " + channel + ": " + outcome + (b.hot ? " · hot" : "") + (note ? " — " + note : "");
  var oldNotes = String(current[head.indexOf("notes")] || "");
  sh.getRange(row, col("date")).setValue(today);
  sh.getRange(row, col("outcome")).setValue(outcome);
  if (b.next_step != null) sh.getRange(row, col("next_step")).setValue(safe(String(b.next_step).slice(0, 200)));
  sh.getRange(row, col("next_step_date")).setValue(nextDate);
  if (meeting) sh.getRange(row, col("meeting_datetime")).setValue(safe(meeting));
  if (qualified) sh.getRange(row, col("qualified")).setValue(qualified);
  sh.getRange(row, col("notes")).setValue(safe(oldNotes ? line + "\n" + oldNotes : line));

  sheet(CONFIG.LOG_TAB).appendRow([new Date(), today, safe(who.name), firmName, row, String(current[head.indexOf("priority")] || ""),
    channel, outcome, qualified, b.hot ? "y" : "", safe(meeting), safe(String(b.next_step || "")), nextDate, safe(note)]);

  var f = { row: row };
  var fresh = sh.getRange(row, 1, 1, head.length).getValues()[0];
  head.forEach(function (h, c) { if (h) f[h] = cell(fresh[c]); });
  return filterFirm(f, who.role);
}

/* ---------------- report ---------------- */

function readLog() {
  var v = sheet(CONFIG.LOG_TAB).getDataRange().getValues(), out = [];
  for (var i = 1; i < v.length; i++) {
    var o = {}; LOG_HEADERS.forEach(function (h, c) { o[h] = cell(v[i][c]); }); out.push(o);
  }
  return out;
}

function summarize(log, setter) {
  var t = dayKeys(), mine = log.filter(function (l) { return !setter || l.setter === setter; });
  return { today: stats(mine.filter(function (l) { return l.date === t.today; })), week: stats(mine.filter(function (l) { return l.date >= t.weekStart; })), targets: CONFIG.WEEKLY_TARGETS };
}

function stats(rows) {
  var firms = {}; rows.forEach(function (l) { firms[l.firm] = 1; });
  return {
    touches: rows.length,
    firms: Object.keys(firms).length,
    conversations: rows.filter(function (l) { return CONFIG.TALKED.indexOf(l.outcome) > -1; }).length,
    booked: rows.filter(function (l) { return l.outcome === "booked"; }).length,
    qualified: rows.filter(function (l) { return l.outcome === "booked" && l.qualified === "y"; }).length
  };
}

function buildReport(days) {
  var log = readLog(), firms = readFirms("admin"), t = dayKeys();
  var since = Utilities.formatDate(new Date(Date.now() - (days - 1) * 864e5), CONFIG.TZ, "yyyy-MM-dd");
  var setters = {}; log.forEach(function (l) { setters[l.setter] = 1; });
  var perSetter = Object.keys(setters).map(function (s) {
    var mine = log.filter(function (l) { return l.setter === s; });
    return { setter: s, today: stats(mine.filter(function (l) { return l.date === t.today; })), week: stats(mine.filter(function (l) { return l.date >= t.weekStart; })), last: mine.length ? mine[mine.length - 1].timestamp : "" };
  });
  var cov = {};
  firms.forEach(function (f) { var p = f.priority || "?"; cov[p] = cov[p] || { total: 0, touched: 0 }; cov[p].total++; if (f.date) cov[p].touched++; });
  var perDay = {};
  log.filter(function (l) { return l.date >= since; }).forEach(function (l) { var d = perDay[l.date] = perDay[l.date] || { touches: 0, conversations: 0, booked: 0 }; d.touches++; if (CONFIG.TALKED.indexOf(l.outcome) > -1) d.conversations++; if (l.outcome === "booked") d.booked++; });
  return {
    generated: Utilities.formatDate(new Date(), CONFIG.TZ, "yyyy-MM-dd HH:mm") + " PT",
    today: stats(log.filter(function (l) { return l.date === t.today; })),
    week: stats(log.filter(function (l) { return l.date >= t.weekStart; })),
    targets: CONFIG.WEEKLY_TARGETS,
    perSetter: perSetter,
    perDay: perDay,
    coverage: cov,
    meetings: firms.filter(function (f) { return f.outcome === "booked" && f.meeting_datetime; }).map(pickFirm),
    followUps: firms.filter(function (f) { return f.next_step_date && f.next_step_date <= t.tomorrow && ["booked", "declined"].indexOf(f.outcome) < 0; })
      .sort(function (a, b) { return a.next_step_date < b.next_step_date ? -1 : 1; }).map(pickFirm),
    recent: log.slice(-30).reverse()
  };
}

function pickFirm(f) { return { row: f.row, priority: f.priority, firm: f.firm, city: f.city, outcome: f.outcome, qualified: f.qualified, meeting_datetime: f.meeting_datetime, next_step: f.next_step, next_step_date: f.next_step_date }; }

/* Optional email to Jesús; trigger is only made by enableDailyEmail(), never setup(). */
function sendDailyReport() {
  var dow = Number(Utilities.formatDate(new Date(), CONFIG.TZ, "u"));
  if (dow > 5) return;
  var r = buildReport(7), td = r.today, wk = r.week;
  var row = function (a, b) { return "<tr><td style='padding:4px 12px 4px 0;color:#666'>" + a + "</td><td style='padding:4px 0'><b>" + b + "</b></td></tr>"; };
  var html = "<div style='font-family:Arial,sans-serif;font-size:14px;color:#111'>" +
    "<h2 style='font-weight:500'>Setter report · " + r.generated + "</h2>" +
    "<h3 style='font-weight:500'>Today</h3><table>" + row("Touches", td.touches) + row("Firms touched", td.firms) + row("Conversations", td.conversations) + row("Meetings booked", td.booked) + row("Qualified", td.qualified) + "</table>" +
    "<h3 style='font-weight:500'>This week</h3><table>" + row("Firms touched", wk.firms + " / " + r.targets.firms) + row("Conversations", wk.conversations + " / " + r.targets.conversations) + row("Meetings booked", wk.booked) + "</table>" +
    "<h3 style='font-weight:500'>Booked meetings</h3>" + (r.meetings.length ? "<ul>" + r.meetings.map(function (m) { return "<li>" + esc(m.firm) + " (" + esc(m.city) + ") · " + esc(m.meeting_datetime) + (m.qualified === "y" ? " · qualified" : "") + "</li>"; }).join("") + "</ul>" : "<p>None yet.</p>") +
    "<h3 style='font-weight:500'>Follow-ups due by tomorrow</h3>" + (r.followUps.length ? "<ul>" + r.followUps.slice(0, 15).map(function (m) { return "<li>" + esc(m.firm) + " · " + esc(m.next_step_date) + (m.next_step ? " · " + esc(m.next_step) : "") + "</li>"; }).join("") + "</ul>" : "<p>None.</p>") +
    "<h3 style='font-weight:500'>Today's log</h3>" + (r.recent.filter(function (l) { return l.date === dayKeys().today; }).map(function (l) { return "<div>" + esc(l.setter) + " · " + esc(l.firm) + " · " + esc(l.channel) + " · <b>" + esc(l.outcome) + "</b>" + (l.note ? " — " + esc(l.note) : "") + "</div>"; }).join("") || "<p>No calls logged today.</p>") +
    "</div>";
  MailApp.sendEmail({ to: CONFIG.REPORT_EMAIL, subject: "Setter report · " + td.touches + " touches, " + td.booked + " booked", htmlBody: html });
}

/* ---------------- setup ---------------- */

/** Run once. Creates Call Log and an admin key in Script Properties; never creates a Setters tab. */
function setup() {
  var log = sheet(CONFIG.LOG_TAB);
  if (log.getLastRow() === 0) { log.appendRow(LOG_HEADERS); log.setFrozenRows(1); }
  var lock = LockService.getScriptLock();
  lock.waitLock(15000);
  try {
    var keys = readKeys();
    var hasAdmin = Object.keys(keys).some(function (k) { return keys[k].role === "admin" && keys[k].active === true; });
    if (!hasAdmin) {
      var k = newKey();
      keys[k] = { name: "Jesús Toto", email: CONFIG.REPORT_EMAIL, role: "admin", active: true };
      saveKeys(keys);
      Logger.log("Jesús Toto admin key: " + k);
    }
  } finally { lock.releaseLock(); }
  Logger.log("Done. Use addSetter, then deploy as a Web app. Daily email remains off by default.");
}

/** Optional: email Jesús this script's own summary at 5:30 PM Pacific on weekdays. disableDailyEmail() turns it off. */
function enableDailyEmail() {
  disableDailyEmail();
  ScriptApp.newTrigger("sendDailyReport").timeBased().atHour(17).nearMinute(30).everyDays(1).inTimezone(CONFIG.TZ).create();
}
function disableDailyEmail() {
  ScriptApp.getProjectTriggers().forEach(function (t) { if (t.getHandlerFunction() === "sendDailyReport") ScriptApp.deleteTrigger(t); });
}

/** Example: addSetter("Timothy", "timothy@example.com") → prints the key to paste in his Memberstack field "call-key". */
function addSetter(name, email) {
  var lock = LockService.getScriptLock();
  lock.waitLock(15000);
  try {
    var keys = readKeys(), k = newKey();
    keys[k] = { name: String(name), email: String(email || ""), role: "setter", active: true };
    saveKeys(keys);
    Logger.log(name + " key: " + k);
    return k;
  } finally { lock.releaseLock(); }
}

function deactivateSetter(name) {
  var lock = LockService.getScriptLock();
  lock.waitLock(15000);
  try {
    var keys = readKeys();
    Object.keys(keys).forEach(function (k) { if (keys[k].name === name) keys[k].active = false; });
    saveKeys(keys);
  } finally { lock.releaseLock(); }
}

function listSetters() {
  var keys = readKeys();
  Object.keys(keys).forEach(function (k) {
    var entry = keys[k];
    Logger.log(entry.name + " · " + entry.role + " · " + (entry.active ? "active" : "inactive"));
  });
}

/* ---------------- helpers ---------------- */

function safe(v) { return typeof v === "string" && /^[=+@\-\t\r]/.test(v) ? "'" + v : v; }
function sheet(name) { var ss = SpreadsheetApp.getActive(); return ss.getSheetByName(name) || ss.insertSheet(name); }
function newKey() { return Utilities.getUuid().replace(/-/g, "") + Utilities.getUuid().replace(/-/g, "").slice(0, 8); }
function pick(v, list, what) { if (list.indexOf(v) < 0) throw new Error("Invalid " + what + "."); return v; }
function dateOrEmpty(v, what) { if (!v) return ""; if (!/^\d{4}-\d{2}-\d{2}$/.test(v)) throw new Error("Use YYYY-MM-DD for the " + what + "."); return v; }
function cell(v) {
  if (!(v instanceof Date)) return String(v);
  var hm = Utilities.formatDate(v, CONFIG.TZ, "HH:mm"); // Sheets turns typed dates into Date objects; keep the time when there is one.
  return Utilities.formatDate(v, CONFIG.TZ, "yyyy-MM-dd") + (hm !== "00:00" ? " " + hm : "");
}
function esc(s) { return String(s == null ? "" : s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }
function dayKeys() {
  var now = new Date(), f = function (d) { return Utilities.formatDate(d, CONFIG.TZ, "yyyy-MM-dd"); };
  var dow = Number(Utilities.formatDate(now, CONFIG.TZ, "u")); // 1 = Monday
  return { today: f(now), tomorrow: f(new Date(now.getTime() + 864e5)), weekStart: f(new Date(now.getTime() - (dow - 1) * 864e5)) };
}
