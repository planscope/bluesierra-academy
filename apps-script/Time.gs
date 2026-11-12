/* ======================================================================================================
   Time & attendance ("My hours"). ONE record of time serves attendance, payroll review and job cost.
   - TtEvents is append-only: nothing in it is edited or deleted. Shifts, segments and totals are DERIVED from it.
   - A correction never overwrites. When approved it ADDS events; an added event may "supersede" an older one,
     and both stay on file (the older one is shown as replaced).
   - Times are stored in UTC (ISO). Days, weeks and the screen use the company time zone (CONFIG.TZ).
   - Location is auxiliary evidence, captured only when someone taps a button. A missing or far location creates
     an item to review; it never blocks recording time and never removes time.
   - Permissions are explicit columns set by the admin (People.perms). A hashtag in a message never grants access.
   Deployed concatenated after Today.gs.
   ====================================================================================================== */
TABLES.People = TABLES.People.concat(["perms", "supervisor", "lang", "pay_type", "clock", "phone", "crew_level"]);   // phone: crew log in with it + their PIN
/* Two kinds of #crew: "labor" only clock in and out (no projects, chat, plans or routes); "supervisor" (PM / foreman) see the
   projects they're added to, like crew always have. Empty = supervisor, so nobody already on the portal loses access. */
function ttIsLabor(p) { if (p && p.crew_level == null && p.email && !p.preview) p = findPerson(p.email) || p; return !!p && p.role === "crew" && String(p.crew_level || "") === "labor"; }
/* Preview as #labor (clock only) or #pm (crew supervisor / project manager): a make-believe crew member of that level. */
if (typeof previewMe === "function") { var ttPreviewMe0 = previewMe;
  previewMe = function (role) { if (role === "labor" || role === "pm") { var p = ttPreviewMe0("crew"); p.crew_level = role === "labor" ? "labor" : "supervisor"; p.name = role === "labor" ? "Labor preview" : "PM preview"; if (role === "labor") { p.project_ids = ""; p.projects = []; } return p; } return ttPreviewMe0(role); }; }
if (typeof canSee === "function") { var ttCanSee0 = canSee;
  canSee = function (me, pid) { return ttIsLabor(me) ? false : ttCanSee0(me, pid); }; }   // enforced on the server: every project, chat, file and plan goes through canSee
if (typeof publicMe === "function") { var ttPublicMe0 = publicMe;
  publicMe = function (p) { var o = ttPublicMe0(p); o.labor = ttIsLabor(p); o.crew_level = p.role === "crew" ? (o.labor ? "labor" : "supervisor") : ""; if (o.labor) o.ls = ""; return o; }; }   // clock: "yes" = this person sees the clock (pilot)
TABLES.TtEvents = ["id", "emp", "actor", "kind", "at", "device_at", "recv_at", "tz", "act", "ref_type", "ref_id", "ref_name", "lat", "lon", "acc", "loc_at", "loc_status",
  "zone", "zone_name", "zone_m", "source", "offline", "seq", "client_key", "device", "shift_id", "supersedes", "corr_id", "note", "status",
  "act_note", "tgt_lat", "tgt_lon", "radius_m", "presence", "presence_reason", "case_id", "scope_id", "loc_addr", "device_hash", "device_flag", "device_owner", "ip"];   // loc_addr: approximate street address of the phone's point      // presence: verified / outside / unverified, judged by the server for each check-in
/* One case per shift whose check-in (or move to another jobsite) couldn't be verified. Retries join the same case. */
TABLES.TtPresence = ["id", "emp", "shift_id", "status", "place", "ref_type", "ref_id", "first_at", "first_reason", "attempts", "explain", "verified_at", "decided_by", "decided_at", "decision", "decision_note", "created_at", "updated_at"];
TABLES.TtCorrections = ["id", "emp", "shift_id", "date", "reason", "explain", "changes", "before", "delta_min", "declared_place", "evidence_id", "requested_by", "requested_at",
  "status", "decided_by", "decided_at", "decision_note", "applied", "period_id", "after_close", "dispute", "dispute_at", "history", "seen_at"];
TABLES.TtWeeks = ["key", "period_id", "emp", "emp_status", "emp_note", "emp_at", "approved_by", "approved_at", "approved_hash", "history"];
TABLES.TtPeriods = ["id", "start", "end", "status", "version", "closed_by", "closed_at", "rules", "snapshot", "history"];
TABLES.TtAbsence = ["id", "emp", "from", "to", "kind", "note", "by", "at"];
TABLES.TtZones = ["id", "name", "kind", "lat", "lon", "radius_m", "active", "updated_by", "updated_at"];
TABLES.TtMeals = ["id", "emp", "shift_id", "day", "answer", "start", "minutes", "corr_id", "at"];   // what the person answered at check-out: took / none / interrupted
/* The phones each person uses, learned by the system. A phone is identified by a random id it keeps (stored here only as a hash).
   First phone of a person: trusted. Any other phone: pending until the office approves it. A phone already used by someone else
   is flagged on every check-in made from it for another person. */
TABLES.TtDevices = ["key", "dev", "emp", "label", "first_seen", "last_seen", "uses", "status", "by", "at"];
TABLES.TtAudit = ["id", "at", "by", "emp", "kind", "ref", "before", "after", "note"];
var TT_T = ["TtEvents", "TtCorrections", "TtWeeks", "TtPeriods", "TtAbsence", "TtZones", "TtAudit", "TtMeals", "TtPresence", "TtDevices"];
var TT_READ = ["People", "LsCrews", "LsVisits", "LsProps", "Projects"].concat(TT_T);
var TT_NOW = 0;                                                                     // tests set a fixed clock; production uses the real one
function ttNow() { return TT_NOW || Date.now(); }
var TT_PERMS = ["time_review", "accounting", "pay_view", "pay_rates", "period_close", "time_export", "clock_others"];
/* Activity is separate from the place. Main ones for landscaping / hardscape; load, travel, materials, dump runs are secondary. */
var TT_ACTS = { scope: 1, general: 1, maint: 1, prune: 1, irrig: 1, pavers: 1, concrete: 1, walls: 1, other: 1, load: 1, travel: 1, materials: 1, disposal: 1, office: 1 };
var TT_OPEN_CASE = { pending: 1, verified_later: 1 };
var TT_REASONS = { missed_in: 1, missed_out: 1, wrong_job: 1, meal: 1, tech: 1, other: 1, office_fix: 1, declared: 1 };   // declared: a time typed on the clock screen instead of "now"
var TT_ORDER = { "in": 0, meal_end: 1, rest_end: 1, "switch": 2, meal_start: 3, rest_start: 3, out: 4 };
/* California rules as the starting point (DLSE FAQ: daily over 8 h and weekly over 40 h = 1.5x, over 12 h = 2x, 7th consecutive day
   in the workweek: first 8 h 1.5x, beyond 8 h 2x). The result is labeled an estimate until accounting validates it. */
var TT_RULES = { v: "CA-2026.1", note: "Estimate. Accounting must validate these rules before any payroll export." };

function ttCfg() {
  var pr = PropertiesService.getScriptProperties(), n = function (k, d) { var v = Number(pr.getProperty(k)); return isFinite(v) && pr.getProperty(k) !== null ? v : d; };
  return { week_start: n("TT_WEEK_START", 1), radius: n("TT_RADIUS_M", 150), acc_ok: n("TT_ACC_OK_M", 100), open_long_h: n("TT_OPEN_LONG_H", 12), retention: pr.getProperty("TT_RETENTION") || "4 years" };
}
/* ---- time helpers (UTC in storage, company time zone on screen) ---- */
function ttMs(iso) { var t = Date.parse(String(iso || "")); return isNaN(t) ? null : t; }
function ttIso(ms) { return new Date(ms).toISOString(); }
function ttLocal(ms, pat) { return Utilities.formatDate(new Date(ms), CONFIG.TZ, pat || "yyyy-MM-dd HH:mm"); }
function ttDayOf(ms) { return ttLocal(ms, "yyyy-MM-dd"); }
function ttFromLocal(s) {                                                               // "2026-11-09 07:30" (company time) → UTC ms, DST-safe
  var m = String(s || "").match(/^(\d{4})-(\d\d)-(\d\d)[ T](\d\d):(\d\d)$/); if (!m) return null;
  var want = Date.UTC(+m[1], m[2] - 1, +m[3], +m[4], +m[5]);
  var off = function (ms) { var l = ttLocal(ms).match(/^(\d{4})-(\d\d)-(\d\d) (\d\d):(\d\d)$/); return Date.UTC(+l[1], l[2] - 1, +l[3], +l[4], +l[5]) - ms; };
  var g = want - off(want); return want - off(g);
}
function ttAddDays(d, n) { var x = new Date(d + "T12:00:00Z"); x.setUTCDate(x.getUTCDate() + n); return x.toISOString().slice(0, 10); }
function ttWeekStart(d) { var dow = new Date(d + "T12:00:00Z").getUTCDay(); return ttAddDays(d, -((dow - ttCfg().week_start + 7) % 7)); }
var TT_DOW = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
function ttHm(ms) { var l = ttLocal(ms), h = +l.slice(11, 13); return ((h % 12) || 12) + ":" + l.slice(14, 16) + (h < 12 ? " am" : " pm"); }
function ttHuman(ms) { var d = ttDayOf(ms); return TT_DOW[new Date(d + "T12:00:00Z").getUTCDay()] + " " + d.slice(5) + " " + ttHm(ms); }
function ttMin(ms) { return Math.round(ms / 6e4); }                                      // display only; sums are kept in milliseconds
function ttKm(a, b) { var R = 6371000, r = Math.PI / 180, dl = (b.lat - a.lat) * r, dn = (b.lon - a.lon) * r; var h = Math.sin(dl / 2) * Math.sin(dl / 2) + Math.cos(a.lat * r) * Math.cos(b.lat * r) * Math.sin(dn / 2) * Math.sin(dn / 2); return 2 * R * Math.asin(Math.sqrt(h)); }

/* ---- who may do what ---- */
function ttRow(me) { return findPerson(me.email) || me; }
function ttPerms(me) {
  if (!me || me.preview) return {}; var p = ttRow(me), o = {};
  if (p.role === "admin") { TT_PERMS.forEach(function (k) { o[k] = 1; }); return o; }
  if (!isTeam(p) || !isTrue(p.active)) return {};
  splitIds(p.perms).forEach(function (k) { if (TT_PERMS.indexOf(k) > -1) o[k] = 1; });
  if (o.accounting) o.time_review = 1; return o;
}
function ttLang(me) { var p = ttRow(me); return p.lang === "en" || p.lang === "es" ? p.lang : p.role === "crew" ? "es" : "en"; }
function ttErr(me, es, en) { return new Error(ttLang(me) === "es" ? es : en); }
/* Rollout: nobody sees the clock until Jesús turns it on, per person (People.clock) or for everyone (TT_ALL). */
function ttAll() { return PropertiesService.getScriptProperties().getProperty("TT_ALL") === "yes"; }
function ttEnabled(p) { if (!p || !isTeam(p) || !isTrue(p.active) || p.clock === "no" || p.role === "admin") return false; /* the admin manages hours, he doesn't clock */ return p.role === "crew" || ttAll() || isTrue(p.clock); }   // crew: on unless turned off; team: when turned on
function ttClocker(me) { if (!me || me.preview || !isTeam(me)) throw new Error("My hours is for the Blue Sierra team."); return me; }
function ttCrewsOf(emp) { return rows("LsCrews").filter(function (c) { return splitIds(c.members).map(normEmail).indexOf(emp) > -1; }); }
/* A reviewer sees: everyone (accounting / admin), or the people they supervise (People.supervisor) and the crews they lead. Never their own decisions. */
function ttCanReview(me, emp) {
  var pm = ttPerms(me); if (pm.accounting) return true; if (!pm.time_review) return false;
  var p = findPerson(emp); if (p && normEmail(p.supervisor) === normEmail(me.email)) return true;
  return ttCrewsOf(emp).some(function (c) { return normEmail(c.lead) === normEmail(me.email); });
}
function ttTeam() { return rows("People").filter(function (p) { return isTrue(p.active) && isTeam(p); }); }
function ttScope(me) { return ttTeam().filter(function (p) { return ttCanReview(me, normEmail(p.email)); }).map(function (p) { return normEmail(p.email); }); }
function ttOwnerOf(emp) {
  var p = findPerson(emp) || {}, sup = normEmail(p.supervisor); if (sup && sup !== emp && findPerson(sup)) return sup;
  var lead = ttCrewsOf(emp).map(function (c) { return normEmail(c.lead); }).filter(function (e) { return e && e !== emp && findPerson(e); })[0]; if (lead) return lead;
  var acc = ttTeam().filter(function (x) { return x.role === "admin" || splitIds(x.perms).indexOf("accounting") > -1; }).map(function (x) { return normEmail(x.email); }).filter(function (e) { return e !== emp; });
  return acc.filter(function (e) { return findPerson(e).role !== "admin"; })[0] || acc[0] || "";
}
function ttAudit(me, emp, kind, ref, before, after, note) {
  insert("TtAudit", { id: newId("ta"), at: ttIso(ttNow()), by: me.email, emp: emp, kind: kind, ref: ref || "", before: before == null ? "" : JSON.stringify(before).slice(0, 4000), after: after == null ? "" : JSON.stringify(after).slice(0, 4000), note: String(note || "").slice(0, 500) });
}

/* ---- shifts derived from the events ---- */
function ttEvents(emp) { return rows("TtEvents").filter(function (e) { return e.emp === emp; }); }
function ttLive(evs) { var gone = {}; evs.forEach(function (e) { if (e.supersedes) gone[e.supersedes] = 1; }); return evs.filter(function (e) { return !gone[e.id] && e.status !== "conflict"; }); }
function ttSort(a, b) { return ttMs(a.at) - ttMs(b.at) || (TT_ORDER[a.kind] || 0) - (TT_ORDER[b.kind] || 0) || String(a.recv_at).localeCompare(String(b.recv_at)); }
function ttShifts(evs, nowMs) {
  var live = ttLive(evs), by = {}, voided = {}; nowMs = nowMs || ttNow();
  live.filter(function (e) { return e.kind === "void" || e.kind === "restore"; }).sort(function (a, b) { return String(a.recv_at).localeCompare(String(b.recv_at)); })
    .forEach(function (e) { voided[e.shift_id] = e.kind === "void" ? e : null; });
  live.forEach(function (e) { if (e.kind !== "void" && e.kind !== "restore") (by[e.shift_id] = by[e.shift_id] || []).push(e); });
  return Object.keys(by).map(function (sid) { return ttBuild(sid, by[sid].sort(ttSort), voided[sid] || null, nowMs); }).sort(function (a, b) { return a.start - b.start; });
}
function ttJobOf(e) { return { act: e.act || "general", act_note: e.act_note || "", scope_id: e.scope_id || "", ref_type: e.ref_type || "", ref_id: e.ref_id || "", ref_name: e.ref_name || "" }; }
function ttBuild(sid, evs, voidEv, nowMs) {
  var inE = evs.filter(function (e) { return e.kind === "in"; })[0];
  if (!inE) return { id: sid, broken: true, start: ttMs(evs[0].at), end: null, open: false, voided: !!voidEv, events: evs, segs: [], meals: [], paid: 0, meal: 0, rest: 0, unassigned: 0, day: ttDayOf(ttMs(evs[0].at)), mode: "off" };
  var t = ttMs(inE.at), cur = ttJobOf(inE), mode = "work", segs = [], meals = [], mealFrom = 0, end = null, after = 0;
  var close = function (to) { if (to > t) segs.push({ from: t, to: to, kind: mode === "rest" ? "rest" : "work", act: cur.act, act_note: cur.act_note, ref_type: cur.ref_type, ref_id: cur.ref_id, ref_name: cur.ref_name }); t = Math.max(t, to); };
  evs.forEach(function (e) {
    if (e === inE) return; var ms = ttMs(e.at); if (end != null || ms < ttMs(inE.at)) { after++; return; }
    if (e.kind === "switch") { if (mode !== "meal") close(ms); cur = ttJobOf(e); }
    else if (e.kind === "meal_start" && mode !== "meal") { close(ms); mode = "meal"; mealFrom = ms; }
    else if (e.kind === "meal_end" && mode === "meal") { meals.push({ from: mealFrom, to: ms }); t = ms; mode = "work"; }
    else if (e.kind === "rest_start" && mode === "work") { close(ms); mode = "rest"; }
    else if (e.kind === "rest_end" && mode === "rest") { close(ms); mode = "work"; }
    else if (e.kind === "out") { if (mode === "meal") { meals.push({ from: mealFrom, to: ms }); t = ms; } else close(ms); end = ms; }
  });
  var open = end == null, upto = open ? Math.max(nowMs, t) : end;
  if (open) { if (mode === "meal") meals.push({ from: mealFrom, to: upto, open: true }); else { var m0 = mode; close(upto); mode = m0; } }
  var sum = function (l, f) { return l.reduce(function (a, s) { return a + (f ? (f(s) ? s.to - s.from : 0) : s.to - s.from); }, 0); };
  return { id: sid, start: ttMs(inE.at), end: end, open: open, voided: !!voidEv, void_ev: voidEv, mode: open ? mode : "off", job: cur, events: evs, segs: segs, meals: meals,
    paid: sum(segs), meal: sum(meals), rest: sum(segs, function (s) { return s.kind === "rest"; }), unassigned: sum(segs, function (s) { return !s.ref_id; }),
    span: upto - ttMs(inE.at), day: ttDayOf(ttMs(inE.at)), stray: after };
}
/* Paid time per company-time-zone calendar day (a shift past midnight counts on each day it touches).
   An open shift counts "so far" only while it's today's and not too long; a forgotten one counts nothing until someone
   records the real check-out: the portal never invents an end time. */
function ttCounts(s) { return !s.voided && !s.broken && (!s.open || (s.day === ttDayOf(ttNow()) && ttNow() - s.start <= ttCfg().open_long_h * 36e5)); }
function ttPerDay(shifts) {
  var out = {};
  shifts.forEach(function (s) {
    if (!ttCounts(s)) return;
    s.segs.forEach(function (g) {
      var a = g.from;
      while (a < g.to) { var d = ttDayOf(a), next = ttFromLocal(ttAddDays(d, 1) + " 00:00"), b = Math.min(g.to, next > a ? next : g.to); out[d] = (out[d] || 0) + (b - a); a = b; }
    });
  });
  return out;
}
/* Regular / overtime / double time for one workweek. days: 7 numbers (minutes) in workweek order. */
function ttCalcWeek(days, payType) {
  var res = days.map(function () { return { reg: 0, ot: 0, dt: 0 }; }), worked = days.filter(function (m) { return m > 0; }).length, cum = 0;
  if (payType === "exempt") return { days: days.map(function (m) { return { reg: m, ot: 0, dt: 0 }; }), reg: days.reduce(function (a, b) { return a + b; }, 0), ot: 0, dt: 0, exempt: true, rules: TT_RULES };
  days.forEach(function (m, i) {
    var r = res[i];
    if (i === 6 && worked === 7) { r.ot = Math.min(m, 480); r.dt = Math.max(0, m - 480); }
    else { r.reg = Math.min(m, 480); r.ot = Math.min(Math.max(m - 480, 0), 240); r.dt = Math.max(0, m - 720); }
    if (cum + r.reg > 2400) { var over = cum + r.reg - 2400; r.reg -= over; r.ot += over; }      // weekly: only regular hours count toward 40, so nothing is counted twice
    cum += r.reg;
  });
  var t = { reg: 0, ot: 0, dt: 0 }; res.forEach(function (r) { t.reg += r.reg; t.ot += r.ot; t.dt += r.dt; });
  return { days: res, reg: t.reg, ot: t.ot, dt: t.dt, seventh: worked === 7, rules: TT_RULES };
}

/* ---- where the phone was when someone tapped: the server decides, never the phone ----
   The jobsite's point comes from office records (property, project, or a yard/office zone set up by the office).
   Employees can't change those points or the radius. A location only VERIFIES presence when it is real (permission
   given), fresh (captured within 2 minutes of the tap), precise enough (accuracy within TT_ACC_OK_M) and, counting its
   accuracy, entirely inside the radius. Anything else is "outside" (certainly away) or "unverified" (can't tell). */
function ttZones() {
  var cfg = ttCfg(), z = rows("TtZones").filter(function (x) { return isTrue(x.active) && x.lat !== "" && x.lon !== ""; }).map(function (x) { return { id: x.id, name: x.name, kind: x.kind, lat: num(x.lat), lon: num(x.lon), r: num(x.radius_m) || cfg.radius }; });
  if (!z.some(function (x) { return x.kind === "yard"; }) && typeof lsCfg === "function") { var y = lsCfg().yard; if (y && y.lat != null && y.lon != null) z.push({ id: "yard", name: "Yard", kind: "yard", lat: num(y.lat), lon: num(y.lon), r: cfg.radius }); }
  return z;
}
function ttTarget(job) {
  var t = job.ref_type, id = job.ref_id, cfg = ttCfg(), p = null;
  var pt = function (name, lat, lon, r) { return lat !== "" && lat != null && lon !== "" && lon != null && isFinite(num(lat)) && isFinite(num(lon)) && (num(lat) || num(lon)) ? { name: name, lat: num(lat), lon: num(lon), r: r || cfg.radius } : { name: name }; };
  if (t === "visit") { var v = findBy("LsVisits", "id", id); p = v ? findBy("LsProps", "id", v.property_id) : null; }
  else if (t === "property") p = findBy("LsProps", "id", id);
  else if (t === "project") { var pj = findBy("Projects", "id", id); return pj ? pt(pj.name, pj.lat, pj.lon) : null; }
  else if (t === "zone") { var z = ttZones().filter(function (x) { return x.id === id; })[0]; return z ? pt(z.name, z.lat, z.lon, z.r) : null; }
  return p ? pt(p.name, p.lat, p.lon) : null;
}
function ttLocate(loc, job, refMs) {
  loc = loc || {}; var cfg = ttCfg(), st = String(loc.status || "none"), o = { lat: "", lon: "", acc: "", loc_at: "", loc_status: "none", zone: "none", zone_name: "", zone_m: "", tgt_lat: "", tgt_lon: "", radius_m: "", presence: "unverified", presence_reason: "" };
  if (["ok", "denied", "timeout", "unavailable", "unsupported"].indexOf(st) < 0) st = "none";
  var lat = Number(loc.lat), lon = Number(loc.lon), acc = Number(loc.acc), lt = ttMs(loc.at);
  if (st === "ok" && !(isFinite(lat) && isFinite(lon) && Math.abs(lat) <= 90 && Math.abs(lon) <= 180 && isFinite(acc) && acc > 0 && lt)) st = "unavailable";
  o.loc_status = st;
  if (st === "ok") {
    o.lat = String(Math.round(lat * 1e6) / 1e6); o.lon = String(Math.round(lon * 1e6) / 1e6); o.acc = String(Math.round(acc)); o.loc_at = ttIso(lt);
    if (Math.abs(lt - refMs) > 120000) o.loc_status = "stale"; else if (acc > cfg.acc_ok) o.loc_status = "imprecise";
  }
  var tg = job && job.ref_id ? ttTarget(job) : null;
  if (!tg) { o.presence_reason = "no_place"; return o; }
  o.zone_name = tg.name || "";
  if (tg.lat == null) { o.zone = "nozone"; o.presence_reason = "no_geocode"; return o; }
  o.tgt_lat = String(tg.lat); o.tgt_lon = String(tg.lon); o.radius_m = String(Math.round(tg.r));
  if (!o.lat) { o.zone = "unknown"; o.presence_reason = st; return o; }                    // denied, timeout, unavailable, unsupported, none
  var d = ttKm({ lat: lat, lon: lon }, tg); o.zone_m = String(Math.round(d));
  if (o.loc_status === "stale") { o.zone = "unknown"; o.presence_reason = "stale"; return o; }   // an old position says nothing about now, near or far
  if (d - acc > tg.r) { o.zone = "outside"; o.presence = "outside"; o.presence_reason = "outside"; return o; }   // away even counting the phone's error
  if (o.loc_status === "imprecise") { o.zone = "unknown"; o.presence_reason = "imprecise"; return o; }
  if (d + acc <= tg.r) { o.zone = "inside"; o.presence = "verified"; return o; }               // inside even counting the phone's error
  o.zone = "unknown"; o.presence_reason = "uncertain"; return o;                                  // the error circle crosses the edge: can't decide
}

/* ---- what they can be doing there: the jobsite's own scope of work ----
   Project → its schedule tasks that aren't done (the ones happening now first). Maintenance visit → that visit's checklist.
   Property → its maintenance checklist. Yard / office → none (they can still write one). */
function ttScopeOf(t, id) {
  var today = ttDayOf(ttNow()), out = [];
  if (t === "project") {
    out = rows("Schedule").filter(function (x) { return x.project_id === id && (x.kind === "task" || !x.kind) && x.title && !/^(done|complete|completed|canceled|cancelled)$/i.test(String(x.status || "")); })
      .sort(function (a, b) { return num(a.sort) - num(b.sort) || String(a.start).localeCompare(String(b.start)); })   // the schedule's own order (1, 2, 3…)
      .map(function (x) { return { id: x.id, title: clean(x.title, 80) }; });
  } else if (t === "visit") {
    var v = findBy("LsVisits", "id", id);
    if (v) { out = parseJson(v.checklist, []).map(function (c, i) { return { id: "v" + i, title: clean(c && c.t != null ? c.t : c, 80) }; }); if (!out.length && v.scope) out = [{ id: "vs", title: clean(String(v.scope).split("\n")[0], 80) }]; }
  } else if (t === "property") {
    var p = findBy("LsProps", "id", id); if (p) out = parseJson(p.checklist, []).map(function (c, i) { return { id: "p" + i, title: clean(c && c.t != null ? c.t : c, 80) }; });
  }
  return out.filter(function (x) { return x.title; }).slice(0, 8);
}

if (typeof lsRole === "function") { var ttLsRole0 = lsRole; lsRole = function (me) { return ttIsLabor(me) ? "" : ttLsRole0(me); }; }   // labor don't see maintenance routes either

/* ---- phones: who usually clocks from which phone ---- */
function ttDevLabel(ua) {
  ua = String(ua || ""); var os = /iPhone/.test(ua) ? "iPhone" : /iPad/.test(ua) ? "iPad" : /Android/.test(ua) ? "Android" : /Mac OS X/.test(ua) ? "Mac" : /Windows/.test(ua) ? "Windows" : "Phone";
  var br = /SamsungBrowser/.test(ua) ? "Samsung Internet" : /CriOS|Chrome/.test(ua) ? "Chrome" : /FxiOS|Firefox/.test(ua) ? "Firefox" : /Safari/.test(ua) ? "Safari" : "browser";
  return os + " · " + br;
}
function ttDev(emp, devId, ua, where) {
  if (!/^[A-Za-z0-9_-]{16,80}$/.test(String(devId || ""))) return { flag: "no_device", dev: "" };
  var dev = sha("dev:" + devId).slice(0, 24), all = rows("TtDevices"), mine = all.filter(function (d) { return d.emp === emp && d.status !== "removed"; });
  var here = all.filter(function (d) { return d.dev === dev && d.status !== "removed"; }), own = here.filter(function (d) { return d.emp === emp; })[0], others = here.filter(function (d) { return d.emp !== emp; }), t = ttIso(ttNow()), st;
  if (own) { st = own.status; update("TtDevices", "key", own.key, { last_seen: t, uses: String(num(own.uses) + 1) }); }
  else {
    st = !mine.length && !others.length ? "trusted" : "pending";                          // the first phone someone uses is theirs; any later one waits for the office
    insert("TtDevices", { key: dev + "|" + emp, dev: dev, emp: emp, label: ttDevLabel(ua), first_seen: t, last_seen: t, uses: "1", status: st, by: where, at: t });
  }
  if (st === "blocked") return { flag: "blocked", dev: dev };
  if (others.length && st !== "trusted") return { flag: "other_person", dev: dev, owner: others[0].emp };
  if (st !== "trusted") return { flag: "new_device", dev: dev };
  return { flag: "ok", dev: dev };
}
function ttDevicesOf(emp) { return rows("TtDevices").filter(function (d) { return d.emp === emp && d.status !== "removed"; }).map(function (d) { return { dev: d.dev, label: d.label, status: d.status, first_seen: d.first_seen, last_seen: d.last_seen, uses: num(d.uses), shared_with: rows("TtDevices").filter(function (x) { return x.dev === d.dev && x.emp !== emp && x.status !== "removed"; }).map(function (x) { return personName(x.emp); }) }; }); }
/* The office decides about a phone: it's this person's (trust), it shouldn't be used (block), or forget it (remove). */
ACTIONS.ttDevice = function (me, b) {
  var emp = normEmail(b.emp), dev = String(b.dev || ""), act = String(b.decision || "");   // not "action": that name is the request itself
  if (!ttCanReview(me, emp) && me.role !== "admin") throw new Error("You can't manage this person's phones.");
  if (emp === normEmail(me.email) && me.role !== "admin") throw new Error("Another reviewer has to approve your phone.");
  var d = findBy("TtDevices", "key", dev + "|" + emp); if (!d) throw new Error("Phone not found.");
  var st = { trust: "trusted", block: "blocked", remove: "removed" }[act]; if (!st) throw new Error("Trust, block or remove.");
  update("TtDevices", "key", d.key, { status: st, by: normEmail(me.email), at: ttIso(ttNow()) }); ttAudit(me, emp, "device_" + act, dev, { status: d.status }, { status: st }, clean(b.note, 300));
  return { devices: ttDevicesOf(emp) };
};

/* ---- crew log in with their phone number + a 6-digit PIN the office gives them ---- */
function ttPhone(v) { var d = String(v || "").replace(/\D/g, ""); if (d.length === 11 && d[0] === "1") d = d.slice(1); return d.length === 10 ? d : ""; }
function ttByPhone(ph) { return ph ? rows("People").filter(function (p) { return ttPhone(p.phone) === ph && isTrue(p.active); })[0] || null : null; }
PUBLIC.checkPhone = function (b) {
  var ph = ttPhone(b.phone); if (!ph) throw new Error("Escribe tu número de 10 dígitos. / Type your 10-digit number.");
  var p = ttByPhone(ph); if (!p) throw new Error(NO_ACCESS);
  return { hasPin: !!p.pin_hash, welcome: !!(p.pin_hash && p.pin_temp), name: first(p.name), lang: p.lang || (p.role === "crew" ? "es" : "en") };
};
PUBLIC.loginPhone = function (b) {
  var ph = ttPhone(b.phone), p = ttByPhone(ph); if (!p) throw new Error(NO_ACCESS);
  var r = PUBLIC.loginPin({ email: p.email, pin: b.pin });                                // same PIN check, same 5-tries lock
  try { r.device = ttDev(normEmail(p.email), b.device_id, b.ua, "login").flag; } catch (e) {}
  return r;
};
var ttLoginPin0 = PUBLIC.loginPin;
PUBLIC.loginPin = function (b) {
  var who = findPerson(normEmail(b.email)), temp = who && who.pin_temp ? String(who.pin_temp) : "";
  if (temp && temp < now()) throw new Error("Tu código de bienvenida venció. Pídele uno nuevo a la oficina. / Your welcome code expired. Ask the office for a new one.");
  var r = ttLoginPin0(b); try { if (b.device_id) ttDev(normEmail(b.email), b.device_id, b.ua, "login"); } catch (e) {}
  if (temp) r.mustSetPin = true;                                                         // they came in with the office's code: next they choose their own PIN
  return r;
};
/* Choosing your own PIN retires the welcome code. */
var ttSetPin0 = ACTIONS.setPin;
ACTIONS.setPin = function (me, b) { var r = ttSetPin0(me, b); var p = findPerson(me.email); if (p && p.pin_temp) update("People", "email", p.email, { pin_temp: "" }); return r; };
/* Jesús adds a crew member by phone (no email needed) and gives them a PIN, or resets it. The PIN is shown once. */
function ttNewPin() { var p; do { p = String(Math.floor(100000 + Math.random() * 900000)); } while (/^(\d)\1{5}$/.test(p) || "0123456789".indexOf(p) > -1 || "9876543210".indexOf(p) > -1); return p; }
ACTIONS.ttCrewAccess = function (me, b) {
  if (me.role !== "admin" || me.preview) throw new Error("Only Jesús gives crew access.");
  var ph = ttPhone(b.phone); if (!ph) throw new Error("Type a 10-digit phone number.");
  var other = ttByPhone(ph), email = b.email ? normEmail(b.email) : "", p = email ? findPerson(email) : null;
  var pj = String(b.project_id || ""); if (pj && !findBy("Projects", "id", pj)) throw new Error("That project isn't here anymore.");
  if (other && (!p || normEmail(other.email) !== normEmail(p.email))) throw new Error("That phone is already used by " + other.name + ".");
  if (!p) {
    var name = clean(b.name, 80); if (name.length < 2) throw new Error("Write the person's name.");
    email = "crew-" + ph + "@phone.invalid";                                              // an internal id, never emailed (.invalid can't receive mail)
    p = findPerson(email);
    var lvl = b.level === "supervisor" ? "supervisor" : "labor";                          // new people by phone: labor (clock only) unless Jesús says supervisor
    if (!p) insert("People", { email: email, name: name, role: "crew", project_ids: [].concat(b.project_ids || []).concat(pj ? [pj] : []).join(","), active: "yes", created_at: now(), avatar: "", phone: ph, lang: "es", pay_type: "hourly", crew_level: lvl });
    else update("People", "email", email, { active: "yes", phone: ph, name: name, crew_level: lvl });
  } else update("People", "email", email, { phone: ph });
  if (pj) { var cur = findPerson(email), ids = splitIds(cur.project_ids); if (ids.indexOf(pj) < 0 && !isStaff(cur)) { ids.push(pj); update("People", "email", email, { project_ids: ids.join(",") }); } }
  var pin = ttNewPin(), salt = Utilities.getUuid().replace(/-/g, "").slice(0, 16);
  var until = Utilities.formatDate(new Date(Date.now() + 7 * 86400000), CONFIG.TZ, "yyyy-MM-dd HH:mm");   // a welcome code: good for 7 days, then they pick their own PIN
  update("People", "email", email, { pin_salt: salt, pin_hash: sha(salt + ":" + pin), pin_fails: "0", pin_lock: "", pin_temp: until });
  ttAudit(me, email, "crew_access", email, null, { phone: "***" + ph.slice(-4) }, "Welcome code issued");
  try { CacheService.getScriptCache().remove("who:" + email); } catch (e) {}
  return { email: email, phone: ph, pin: pin, name: (findPerson(email) || {}).name, until: until };
};

/* ---- addresses for the office: the approximate street address of a phone reading (Google's reverse geocoder,
   the same Maps service the routes use), and the jobsite's own address. A phone point's address is "near", never exact. ---- */
function ttAddr(lat, lon) {
  if (lat == null || lon == null || lat === "" || lon === "") return "";
  var la = num(lat), lo = num(lon); if (!isFinite(la) || !isFinite(lo) || (!la && !lo)) return "";
  try {
    var v = lsCacheJson("ttgeo:" + la.toFixed(4) + "," + lo.toFixed(4), 21600, function () {
      var r = Maps.newGeocoder().reverseGeocode(la, lo), x = r && r.results && r.results[0];
      return x && x.formatted_address ? { a: String(x.formatted_address).replace(/, USA$/, "") } : null;
    });
    return v ? v.a : "";
  } catch (e) { return ""; }                                                               // no address is fine: the coordinates stay
}
function ttFillAddr(evs, cap) {                                                           // older records saved before addresses: look them up (cached), never rewrite the record
  var n = 0; (evs || []).forEach(function (e) { if (e && e.lat != null && !e.addr && n < (cap || 25)) { e.addr = ttAddr(e.lat, e.lon); n++; } }); return evs;
}
function ttPlaceAddr(t, id) {
  var p = null;
  if (t === "visit") { var v = findBy("LsVisits", "id", id); p = v ? findBy("LsProps", "id", v.property_id) : null; }
  else if (t === "property") p = findBy("LsProps", "id", id);
  else if (t === "project") p = findBy("Projects", "id", id);
  else if (t === "zone") { var z = ttZones().filter(function (x) { return x.id === id; })[0]; return z ? (z.kind === "yard" && typeof lsCfg === "function" && lsCfg().yard && lsCfg().yard.address) || z.name : ""; }
  return p ? [p.address, p.city].filter(Boolean).join(", ") : "";
}

/* ---- the jobsite (place) and the activity (what they're doing there) ---- */
function ttAuthorized(emp, t, id) {
  var who = findPerson(emp) || {}, staff = isStaff(who), crews = ttCrewsOf(emp).map(function (c) { return c.id; });
  var crewAny = who.role === "crew";                                                     // crew may be sent anywhere; the phone and GPS checks say whether they're really there
  if (t === "visit") { var v = findBy("LsVisits", "id", id), p = v && findBy("LsProps", "id", v.property_id); return p && p.status !== "deleted" ? { ok: staff || crewAny || crews.indexOf(v.crew_id) > -1 || crews.indexOf(p.crew_id) > -1, name: p.name } : null; }
  if (t === "property") { var pp = findBy("LsProps", "id", id); return pp && pp.status !== "deleted" && !isTrue(pp.sample) ? { ok: staff || crewAny || crews.indexOf(pp.crew_id) > -1, name: pp.name } : null; }
  if (t === "project") { var pj = findBy("Projects", "id", id); return pj && pj.status !== "deleted" && pj.status !== "archived" ? { ok: staff || crewAny || splitIds(who.project_ids).indexOf(id) > -1, name: pj.name } : null; }
  if (t === "zone") { var z = ttZones().filter(function (x) { return x.id === id; })[0]; return z ? { ok: true, name: z.name } : null; }   // only zones the office set up
  return null;
}
function ttJob(me, emp, b) {
  var act = String(b.act || "general"); if (act === "work" || act === "unassigned") act = "general";        // older screens: no shortcut around the jobsite
  if (!TT_ACTS[act]) throw ttErr(me, "Elige qué vas a hacer.", "Pick what you're working on.");
  var note = act === "other" ? clean(b.act_note, 80) : "", scopeId = "";
  if (act === "other" && note.length < 2) throw ttErr(me, "Escribe la actividad.", "Write the activity.");
  var t = String(b.ref_type || ""), id = String(b.ref_id || ""), name = "";
  if (act === "scope") {                                                                // must be an item of this jobsite's own scope
    var it = ttScopeOf(b.scope_ref_type || t, b.scope_ref_id || id).filter(function (x) { return x.id === String(b.scope_id || ""); })[0];
    if (!it) throw ttErr(me, "Esa actividad no está en el alcance de este jobsite. Elige otra o escríbela.", "That activity isn't in this jobsite's scope. Pick another or write it.");
    note = it.title; scopeId = it.id;
  }
  if (t || id) {
    var a = ttAuthorized(emp, t, id); if (!a) throw ttErr(me, "No encontré ese jobsite.", "Jobsite not found.");
    if (!a.ok) throw ttErr(me, "Ese jobsite no está asignado a ti. Elige uno de tu lista o avisa a la oficina.", "That jobsite isn't assigned to you. Pick one from your list or tell the office.");
    name = a.name;
  }
  return { act: act, act_note: note, scope_id: scopeId, ref_type: t, ref_id: id, ref_name: name };
}
/* The case for a shift: created by the first check-in that can't be verified, joined by every retry. */
function ttCaseOf(emp, sid) { return rows("TtPresence").filter(function (c) { return c.emp === emp && c.shift_id === sid; })[0] || null; }
function ttCaseTrack(ev, c) {
  var att = { ev: ev.id, kind: ev.kind, at: ev.at, presence: ev.presence, reason: ev.presence_reason, dist: ev.zone_m ? num(ev.zone_m) : null, acc: ev.acc ? num(ev.acc) : null, loc_at: ev.loc_at, place: ev.ref_name, offline: ev.offline === "yes",
    device_flag: ev.device_flag || "", device_owner: ev.device_owner ? personName(ev.device_owner) : "", device: ev.device_hash || "", ip: ev.ip || "" };
  if (!c) {
    if (ev.presence === "verified") return null;
    var row = { id: ev.case_id, emp: ev.emp, shift_id: ev.shift_id, status: "pending", place: ev.ref_name, ref_type: ev.ref_type, ref_id: ev.ref_id, first_at: ev.at, first_reason: ev.presence_reason || ev.presence,
      attempts: JSON.stringify([att]), explain: "[]", verified_at: "", decided_by: "", decided_at: "", decision: "", decision_note: "", created_at: ttIso(ttNow()), updated_at: ttIso(ttNow()) };
    insert("TtPresence", row); return row;
  }
  var atts = parseJson(c.attempts, []); atts.push(att); var patch = { attempts: JSON.stringify(atts), updated_at: ttIso(ttNow()) };
  if (ev.presence === "verified") { if (c.status === "pending") { patch.status = "verified_later"; patch.verified_at = ev.at; } }   // confirmed from THIS moment; the time before stays to review
  else if (!TT_OPEN_CASE[c.status]) { atts[atts.length - 1].reopened_after = c.decision; patch.attempts = JSON.stringify(atts); patch.status = "pending"; }   // a new failure in the same shift reopens it
  else if (c.status === "verified_later" && ev.kind === "switch") patch.status = "pending";
  update("TtPresence", "id", c.id, patch); return findBy("TtPresence", "id", c.id);
}
function ttCaseOut(c, withEvidence) {
  if (!c) return null;
  var o = { id: c.id, emp: c.emp, name: personName(c.emp), shift_id: c.shift_id, status: c.status, open: !!TT_OPEN_CASE[c.status], place: c.place, first_at: c.first_at, first_reason: c.first_reason,
    attempts: parseJson(c.attempts, []), explain: parseJson(c.explain, []), verified_at: c.verified_at, decided_by: c.decided_by ? personName(c.decided_by) : "", decided_at: c.decided_at, decision: c.decision, decision_note: c.decision_note };
  if (withEvidence) {
    var ids = {}; o.attempts.forEach(function (a) { ids[a.ev] = 1; });
    o.evidence = ttFillAddr(rows("TtEvents").filter(function (e) { return ids[e.id]; }).map(function (e) { return ttEvOut(e, true); }));   // the original records, never rewritten
    var byEv = {}; o.evidence.forEach(function (e) { byEv[e.id] = e; }); o.attempts.forEach(function (a) { a.addr = (byEv[a.ev] || {}).addr || ""; });
    o.place_addr = ttPlaceAddr(c.ref_type, c.ref_id);
    var devs = rows("TtDevices"); o.attempts.forEach(function (a) { var d = devs.filter(function (x) { return x.dev === a.device && x.emp === c.emp; })[0]; a.device_label = d ? d.label : ""; a.device_status = d ? d.status : ""; });
  }
  return o;
}

/* ---- state for the card ---- */
function ttEvOut(e, withLoc) {
  var o = { id: e.id, kind: e.kind, at: e.at, recv_at: e.recv_at, device_at: e.device_at, source: e.source, offline: isTrue(e.offline), actor: e.actor !== e.emp ? personName(e.actor) : "",
    act: e.act, ref_type: e.ref_type, ref_id: e.ref_id, ref_name: e.ref_name, loc_status: e.loc_status, zone: e.zone, zone_name: e.zone_name, zone_m: e.zone_m ? num(e.zone_m) : null,
    corr_id: e.corr_id, supersedes: e.supersedes, note: e.note, status: e.status, shift_id: e.shift_id, act_note: e.act_note || "", device_flag: e.device_flag || "", device_owner: e.device_owner ? personName(e.device_owner) : "", ip: withLoc ? e.ip || "" : "", presence: e.presence || "", presence_reason: e.presence_reason || "", case_id: e.case_id || "", radius_m: e.radius_m ? num(e.radius_m) : null };
  if (withLoc && e.lat !== "") { o.lat = num(e.lat); o.lon = num(e.lon); o.acc = num(e.acc); o.loc_at = e.loc_at; o.addr = e.loc_addr || ""; }
  if (withLoc && e.tgt_lat) { o.tgt_lat = num(e.tgt_lat); o.tgt_lon = num(e.tgt_lon); }
  return o;
}
function ttShiftOut(s, withLoc) {
  var seg = function (g) { return { from: ttIso(g.from), to: ttIso(g.to), min: ttMin(g.to - g.from), kind: g.kind, act: g.act, ref_type: g.ref_type, ref_id: g.ref_id, ref_name: g.ref_name }; };
  return { id: s.id, day: s.day, start: s.start != null ? ttIso(s.start) : null, end: s.end != null ? ttIso(s.end) : null, open: s.open, voided: s.voided, broken: !!s.broken, mode: s.mode, job: s.job || null,
    paid_min: ttMin(s.paid), meal_min: ttMin(s.meal), rest_min: ttMin(s.rest), unassigned_min: ttMin(s.unassigned), segs: s.segs.map(seg),
    meals: s.meals.map(function (m) { return { from: ttIso(m.from), to: ttIso(m.to), min: ttMin(m.to - m.from), open: !!m.open }; }), events: s.events.map(function (e) { return ttEvOut(e, withLoc); }) };
}
function ttStateOf(emp) {
  var sh = ttShifts(ttEvents(emp)), open = sh.filter(function (s) { return s.open && !s.voided && !s.broken; }).pop() || null, today = ttDayOf(ttNow());
  var todayMs = ttPerDay(sh)[today] || 0;
  var pres = null;
  if (open) {
    var lastP = open.events.filter(function (e) { return e.kind === "in" || e.kind === "presence" || (e.kind === "switch" && e.presence); }).pop(), c = ttCaseOf(emp, open.id);
    pres = { status: c ? c.status : lastP && lastP.presence === "verified" ? "verified" : "pending", last: lastP ? { presence: lastP.presence, reason: lastP.presence_reason, dist: lastP.zone_m ? num(lastP.zone_m) : null, acc: lastP.acc ? num(lastP.acc) : null, radius: lastP.radius_m ? num(lastP.radius_m) : null, at: lastP.at, place: lastP.ref_name || (open.job && open.job.ref_name) } : null,
      case_id: c ? c.id : "", verified_at: c ? c.verified_at : "", explained: c ? parseJson(c.explain, []).length : 0 };
  }
  return { mode: open ? open.mode : "off", shift: open ? ttShiftOut(open, true) : null, presence: pres, today_min: ttMin(todayMs), server_now: ttIso(ttNow()), today: today, recent: ttRecent(emp) };
}
function ttSuggest(emp, who0, crews0) {
  var today = ttDayOf(ttNow()), crews = crews0 || ttCrewsOf(emp).map(function (c) { return c.id; }), who = who0 || findPerson(emp) || {}, staff = isStaff(who);
  var addr = function (p) { return [p.address, p.city].filter(Boolean).join(", "); }, geo = function (o) { var t = ttTarget(o); return !!(t && t.lat != null); };
  var withScope = function (o) { o.scope = ttScopeOf(o.ref_type, o.ref_id); o.geo = geo(o); return o; };
  var visits = rows("LsVisits").filter(function (v) { return v.date === today && crews.indexOf(v.crew_id) > -1 && ["canceled", "skipped"].indexOf(v.status) < 0; })
    .sort(function (a, b) { return num(a.stop) - num(b.stop); }).map(function (v) { var p = findBy("LsProps", "id", v.property_id) || {}; return withScope({ ref_type: "visit", ref_id: v.id, name: p.name || "Visit", sub: addr(p), route: true }); });
  var crewAll = staff || who.role === "crew", mineP = splitIds(who.project_ids);
  var props = rows("LsProps").filter(function (p) { return p.status !== "deleted" && (crews.indexOf(p.crew_id) > -1 || crewAll) && !isTrue(p.sample); })
    .sort(function (a, b) { return (crews.indexOf(b.crew_id) > -1) - (crews.indexOf(a.crew_id) > -1); }).slice(0, 80).map(function (p) { return withScope({ ref_type: "property", ref_id: p.id, name: p.name, sub: addr(p), mine: crews.indexOf(p.crew_id) > -1 }); });
  var projs = rows("Projects").filter(function (p) { return (p.status === "active" || !p.status) && (crewAll || mineP.indexOf(p.id) > -1); })
    .sort(function (a, b) { return (mineP.indexOf(b.id) > -1) - (mineP.indexOf(a.id) > -1); }).map(function (p) { return withScope({ ref_type: "project", ref_id: p.id, name: p.name, sub: addr(p), mine: mineP.indexOf(p.id) > -1 }); });
  var zones = ttZones().map(function (z) { return { ref_type: "zone", ref_id: z.id, name: z.name, sub: z.kind === "yard" ? "Yard" : "Office", geo: true, scope: [] }; });
  return { visits: visits, properties: props, projects: projs, zones: zones };
}
/* What crew see about their own taps: that it was recorded, never whether the location or phone matched (that goes to the office). */
function ttCrewView(st) {
  if (st.presence) st.presence = { status: "recorded", loc_off: !!(st.presence.last && /^(denied|unsupported)$/.test(st.presence.last.reason || "")) };
  (st.recent || []).forEach(function (r) { delete r.presence; });
  if (st.shift) st.shift.events = st.shift.events.map(function (e) { return { id: e.id, kind: e.kind, at: e.at, act: e.act, act_note: e.act_note, ref_name: e.ref_name }; });
  return st;
}
/* My last records, for the bottom of the crew screen: day, jobsite, in, out, hours. */
function ttRecent(emp) {
  var since = ttAddDays(ttDayOf(ttNow()), -13);
  return ttShifts(ttEvents(emp)).filter(function (s) { return !s.broken && !s.voided && s.day >= since; }).sort(function (a, b) { return b.start - a.start; }).slice(0, 10).map(function (s) {
    var first = s.events.filter(function (e) { return e.kind === "in"; })[0] || {}, c = ttCaseOf(emp, s.id);
    return { day: s.day, place: first.ref_name || (s.job && s.job.ref_name) || "", start: ttIso(s.start), end: s.end != null ? ttIso(s.end) : null, open: s.open, paid_min: ttCounts(s) ? ttMin(s.paid) : null,
      presence: c ? c.status : first.presence === "verified" ? "verified" : first.presence ? "pending" : "" };
  });
}

function ttOfficePending(me) { var sc = ttScope(me), self = normEmail(me.email); return rows("TtPresence").filter(function (c) { return TT_OPEN_CASE[c.status] && sc.indexOf(c.emp) > -1 && c.emp !== self; }).length; }
/* ====================================== actions: the employee ====================================== */
ACTIONS.ttState = function (me, b) {
  if (me && me.preview === "crew") {                                                    // Jesús previewing the portal as #crew: what a crew member sees, nothing saves
    var pcrews = typeof lsCrewsOf === "function" ? lsCrewsOf(me).map(function (c) { return c.id; }) : [], sug = ttSuggest(normEmail(me.email), me, pcrews), today0 = ttDayOf(ttNow());
    // An example worker: two earlier days in "My records", so the preview looks like a real person's phone. Nothing here is saved.
    var spots = [].concat(sug.projects || [], sug.properties || []).filter(function (x) { return x && x.name; }), ex = [];
    [1, 2].forEach(function (back, i) { var d = ttAddDays(today0, -back), sp = spots[i % Math.max(1, spots.length)] || { name: "Jobsite" };
      ex.push({ day: d, place: sp.name, start: d + "T07:00:00", end: d + "T15:30:00", open: false, paid_min: 480, presence: "verified", example: true }); });
    return { enabled: true, preview: true, mode: "off", shift: null, presence: null, today_min: 0, today: today0, server_now: ttIso(ttNow()), lang: "es", perms: {}, recent: ex, news: [], pending: 0, reviewer: false, admin: false,
      suggest: sug, privacy: { retention: ttCfg().retention, radius: ttCfg().radius } };
  }
  ttClocker(me); var emp = normEmail(me.email), pm = ttPerms(me), row = ttRow(me), cfg = ttCfg();
  if (!ttEnabled(row)) return { enabled: false, reviewer: !!pm.time_review, perms: pm, lang: ttLang(me), admin: me.role === "admin", office_pending: pm.time_review ? ttOfficePending(me) : 0,
    suggest: isStaff(row) ? ttSuggest(emp) : null };                                    // the office's GPS test still needs the jobsites
  var mine = rows("TtCorrections").filter(function (c) { return c.emp === emp; });
  var news = mine.filter(function (c) { return c.decided_at && (!c.seen_at || c.seen_at < c.decided_at); }).map(function (c) { return { id: c.id, status: c.status, date: c.date, note: c.decision_note }; });
  var stt = ttStateOf(emp);
  if (row.role === "crew") stt = ttCrewView(stt);
  return Object.assign(stt, { lang: ttLang(me), labor: ttIsLabor(row), perms: pm, pay_type: row.pay_type || "", suggest: ttSuggest(emp), news: news, pending: mine.filter(function (c) { return c.status === "pending" || c.status === "needs_info"; }).length,
    privacy: { retention: cfg.retention, radius: cfg.radius }, reviewer: !!pm.time_review, enabled: true, office_pending: pm.time_review ? ttOfficePending(me) : 0, admin: me.role === "admin", team: pm.clock_others ? ttScope(me).map(function (e) { return { email: e, name: personName(e) }; }) : [] });
};
ACTIONS.ttPunch = function (me, b) {
  ttClocker(me); var emp = normEmail(me.email), src = "employee";
  if (b.for_emp && normEmail(b.for_emp) !== emp) {                                     // a supervisor clocking for someone: needs its own permission, and it says so on the record
    emp = normEmail(b.for_emp); var who = findPerson(emp);
    if (!ttPerms(me).clock_others || !ttCanReview(me, emp) || !who || !isTeam(who)) throw ttErr(me, "No tienes permiso para registrar por esa persona.", "You can't clock for that person."); src = "supervisor";
  }
  if (!ttEnabled(findPerson(emp))) throw ttErr(me, "El reloj todavía no está activado para esta persona.", "The clock isn't turned on for this person yet.");
  var key = String(b.client_key || ""); if (!/^[A-Za-z0-9_-]{8,80}$/.test(key)) throw ttErr(me, "Recarga el portal e intenta otra vez.", "Reload the portal and try again.");
  var dup = findBy("TtEvents", "client_key", key);
  if (dup) return { dup: true, status: dup.status, event: ttEvOut(dup), state: ttStateOf(dup.emp) };   // a double tap or a retry of the same tap: nothing new is saved
  var kind = String(b.kind || ""); if (["in", "out", "meal_start", "meal_end", "rest_start", "rest_end", "switch", "presence"].indexOf(kind) < 0) throw new Error("Unknown action.");
  var nowMs = ttNow(), offline = !!b.offline, dev = ttMs(b.device_at), at = nowMs, notes = [], status = "ok";
  if (offline) {                                                                        // saved on the phone without signal: its own clock is all we have, and it says so
    if (dev == null) throw new Error("Missing the time of the offline record.");
    if (dev > nowMs + 120000) { notes.push("device clock was ahead of the server"); at = nowMs; } else at = dev;
    if (nowMs - at > 7 * 864e5) { status = "conflict"; notes.push("arrived more than 7 days late"); }
  } else if (dev != null && Math.abs(dev - nowMs) > 5 * 60000) notes.push("device clock off by " + Math.round((dev - nowMs) / 60000) + " min");
  var shifts = ttShifts(ttEvents(emp), nowMs).filter(function (s) { return !s.voided && !s.broken; }), open = shifts.filter(function (s) { return s.open; }).pop(), id = newId("te"), sid = id, job = null, placeEv = false;
  var per = findBy("TtPeriods", "id", ttWeekStart(ttDayOf(at))); if (per && per.status === "closed") { status = "conflict"; notes.push("that week is already closed"); }
  if (kind === "in") {
    if (open) { if (!offline) throw ttErr(me, "Ya tienes entrada desde las " + ttHm(open.start) + ".", "You're already checked in since " + ttHm(open.start) + "."); status = "conflict"; notes.push("another shift was open"); }
    else if (shifts.some(function (s) { return at >= s.start && (s.end == null || at < s.end); })) { status = "conflict"; notes.push("overlaps a recorded shift"); }
    job = ttJob(me, emp, b);
  } else {
    var tg = offline ? (shifts.filter(function (s) { return at >= s.start && (s.end == null || at <= s.end); }).pop() || open) : open;
    if (!tg) { if (!offline) throw ttErr(me, "No tienes entrada registrada.", "You're not checked in."); status = "conflict"; notes.push("no open shift for it"); }
    else {
      sid = tg.id; var m = tg.mode;
      var okk = { work: ["meal_start", "rest_start", "switch", "out", "presence"], meal: ["meal_end", "out", "presence"], rest: ["rest_end", "out", "presence"] }[m] || [];
      if (!offline && okk.indexOf(kind) < 0) throw ttErr(me, "Esa acción no aplica ahora.", "That doesn't apply right now.");
      if (at < tg.start) { status = "conflict"; notes.push("earlier than the check-in"); }
      if (offline && tg.end != null && at > tg.end) { status = "conflict"; notes.push("after the check-out"); }
      if (kind === "switch") {
        var cur = tg.job || {}, moving = !!b.ref_id && (String(b.ref_type) + "|" + String(b.ref_id)) !== (cur.ref_type + "|" + cur.ref_id);
        job = moving ? ttJob(me, emp, b) : Object.assign(ttJob(me, emp, { act: b.act, act_note: b.act_note, scope_id: b.scope_id, scope_ref_type: cur.ref_type, scope_ref_id: cur.ref_id }), { ref_type: cur.ref_type || "", ref_id: cur.ref_id || "", ref_name: cur.ref_name || "" });
        placeEv = moving;                                                                   // moving to another jobsite is checked like a check-in; changing activity is not
      } else job = tg.job;
    }
  }
  if (!job) job = { act: "", act_note: "", ref_type: "", ref_id: "", ref_name: "" };
  if (kind === "in" || kind === "presence") placeEv = true;
  var loc = ttLocate(b.loc, job, dev != null ? dev : at);
  if (!placeEv) { loc.presence = ""; loc.presence_reason = ""; }                         // out / meals / activity changes: the location is kept as evidence only
  var ev = Object.assign({ id: id, emp: emp, actor: me.email, kind: kind, at: ttIso(at), device_at: dev != null ? ttIso(dev) : "", recv_at: ttIso(nowMs), tz: CONFIG.TZ,
    act: kind === "in" || kind === "switch" ? job.act : "", act_note: kind === "in" || kind === "switch" ? job.act_note || "" : "", ref_type: job.ref_type || "", ref_id: job.ref_id || "", ref_name: job.ref_name || "",
    source: src, offline: offline ? "yes" : "", seq: String(num(b.seq) || ""), client_key: key, device: clean(b.device, 200), shift_id: sid, supersedes: "", corr_id: "", note: notes.join("; "), status: status, case_id: "", scope_id: kind === "in" || kind === "switch" ? job.scope_id || "" : "" }, loc);
  if (ev.lat) ev.loc_addr = ttAddr(ev.lat, ev.lon);
  if (src !== "supervisor") {                                                             // a supervisor clocking for someone uses their own phone on purpose
    var dv = ttDev(emp, b.device_id, b.device, "punch"); ev.device_hash = dv.dev || ""; ev.device_flag = dv.flag; ev.device_owner = dv.owner || "";
    if (placeEv && dv.flag !== "ok" && ev.presence === "verified") { ev.presence = "unverified"; ev.presence_reason = dv.flag === "other_person" ? "other_device" : dv.flag === "no_device" ? "no_device" : dv.flag === "blocked" ? "blocked_device" : "new_device"; }
  }
  var ipv = String(b.ip || ""); if (/^[0-9a-fA-F:.]{3,45}$/.test(ipv)) ev.ip = ipv;     // as reported by the phone itself: supporting detail only
  var cs = placeEv && status === "ok" ? ttCaseOf(emp, sid) : null;
  if (placeEv && status === "ok" && (cs || ev.presence !== "verified")) ev.case_id = cs ? cs.id : newId("tp");
  insert("TtEvents", ev);
  if (ev.case_id) cs = ttCaseTrack(ev, cs);
  if (src === "supervisor") ttAudit(me, emp, "clock_for", ev.id, null, { kind: kind, at: ev.at }, "clocked by a supervisor");
  var crewTap = (findPerson(emp) || {}).role === "crew" && src !== "supervisor";
  var out = { status: status, event: ttEvOut(ev, true), state: crewTap ? ttCrewView(ttStateOf(emp)) : ttStateOf(emp), presence: placeEv ? { result: ev.presence, reason: ev.presence_reason, dist: ev.zone_m ? num(ev.zone_m) : null, acc: ev.acc ? num(ev.acc) : null, radius: ev.radius_m ? num(ev.radius_m) : null, place: ev.ref_name, case: cs ? cs.status : "" } : null };
  if (kind === "out" && status === "ok") { var s = ttShifts(ttEvents(emp)).filter(function (x) { return x.id === sid; })[0]; if (s) { out.summary = ttShiftOut(s, false); out.summary.ask_meal = s.paid > 300 * 6e4 && !s.meals.length; } }
  if (crewTap) {                                                                          // crew get "recorded"; the verdict, distance and phone check stay with the office
    if (out.summary) out.summary.events = [];
    if (out.presence) out.presence = { result: "recorded", loc_off: /^(denied|unsupported)$/.test(ev.loc_status || ""), retry: !!(placeEv && ev.presence !== "verified" && /^(timeout|unavailable|imprecise|stale|uncertain|none)$/.test(ev.presence_reason || "")) };
    out.event = { id: ev.id, kind: ev.kind, at: ev.at, recv_at: ev.recv_at, ref_name: ev.ref_name, act_note: ev.act_note };
  }
  return out;
};
/* "Test my location" for the office: runs the exact same server check against a jobsite, saves nothing. */
ACTIONS.ttGeoTest = function (me, b) {
  if (!me || me.preview || !isStaff(me)) throw new Error("Only the office can run the location test.");
  var job = { ref_type: String(b.ref_type || ""), ref_id: String(b.ref_id || ""), ref_name: "" }, a = ttAuthorized(normEmail(me.email), job.ref_type, job.ref_id);
  if (!a) throw new Error("Pick a jobsite."); job.ref_name = a.name;
  var dev = ttMs(b.device_at), r = ttLocate(b.loc, job, dev != null ? dev : ttNow());
  return { result: r.presence, reason: r.presence_reason, dist: r.zone_m ? num(r.zone_m) : null, acc: r.acc ? num(r.acc) : null, radius: r.radius_m ? num(r.radius_m) : null, loc_status: r.loc_status,
    lat: r.lat ? num(r.lat) : null, lon: r.lon ? num(r.lon) : null, loc_at: r.loc_at, tgt_lat: r.tgt_lat ? num(r.tgt_lat) : null, tgt_lon: r.tgt_lon ? num(r.tgt_lon) : null, place: a.name, server_now: ttIso(ttNow()), acc_ok: ttCfg().acc_ok,
    addr: r.lat ? ttAddr(r.lat, r.lon) : "", place_addr: ttPlaceAddr(job.ref_type, job.ref_id) };
};
/* The employee explains a pending check-in. Writing an explanation never approves it. */
ACTIONS.ttPresenceExplain = function (me, b) {
  ttClocker(me); var emp = normEmail(me.email), txt = clean(b.text, 600);
  if (txt.length < 3) throw ttErr(me, "Escribe qué pasó.", "Write what happened.");
  var c = b.id ? findBy("TtPresence", "id", String(b.id)) : null;
  if (!c) { var open = ttShifts(ttEvents(emp)).filter(function (s) { return s.open && !s.voided; }).pop(); c = open ? ttCaseOf(emp, open.id) : null; }
  if (!c || c.emp !== emp) throw ttErr(me, "No hay una entrada pendiente que explicar.", "There's no pending check-in to explain.");
  var ex = parseJson(c.explain, []); ex.push({ at: ttIso(ttNow()), text: txt }); update("TtPresence", "id", c.id, { explain: JSON.stringify(ex), updated_at: ttIso(ttNow()) });
  ttAudit(me, emp, "presence_explained", c.id, null, null, txt); return { ok: true, status: c.status };
};
/* The office decides: accept or reject the unverified time, always with a reason. Nothing is deleted either way:
   if the hours shouldn't count, that is a separate office correction with its own history. */
ACTIONS.ttPresenceDecide = function (me, b) {
  var c = findBy("TtPresence", "id", String(b.id || "")); if (!c) throw new Error("Case not found.");
  if (!TT_OPEN_CASE[c.status]) throw new Error("This case was already decided.");
  if (normEmail(me.email) === c.emp) throw new Error("Nobody decides their own case. Another reviewer has to.");
  if (!ttCanReview(me, c.emp)) throw new Error("You can't review this person's hours.");
  var dec = String(b.decision || ""), note = clean(b.note, 600);
  if (["accept", "reject"].indexOf(dec) < 0) throw new Error("Accept or reject.");
  if (note.length < 3) throw new Error("Write the reason for the decision.");
  update("TtPresence", "id", c.id, { status: dec === "accept" ? "accepted" : "rejected", decision: dec, decision_note: note, decided_by: normEmail(me.email), decided_at: ttIso(ttNow()), updated_at: ttIso(ttNow()) });
  ttAudit(me, c.emp, "presence_" + dec, c.id, { status: c.status }, { status: dec === "accept" ? "accepted" : "rejected" }, note);
  return { case: ttCaseOut(findBy("TtPresence", "id", c.id), true) };
};
/* Several check-ins of one or more people at once, with one reason (the dashboard's "Accept all"). Each is checked like a single decision. */
ACTIONS.ttPresenceDecideMany = function (me, b) {
  var ids = [].concat(b.ids || []).map(String).filter(function (x, i, l) { return x && l.indexOf(x) === i; }).slice(0, 200);
  if (!ids.length) throw new Error("Pick at least one check-in.");
  if (clean(b.note, 600).length < 3) throw new Error("Write the reason for the decision.");
  var done = [], failed = [];
  ids.forEach(function (id) { try { ACTIONS.ttPresenceDecide(me, { id: id, decision: b.decision, note: b.note }); done.push(id); } catch (e) { failed.push({ id: id, error: e.message }); } });
  if (!done.length && failed.length) throw new Error(failed[0].error);
  return { done: done, failed: failed };
};
ACTIONS.ttSetLang = function (me, b) { ttClocker(me); var l = b.lang === "en" ? "en" : "es"; update("People", "email", normEmail(me.email), { lang: l }); return { lang: l }; };

/* One workweek for one person: days, shifts, totals, overtime estimate, items to review, corrections, confirmation. */
function ttWeekOf(emp, ws, forReviewer) {
  var we = ttAddDays(ws, 6), all = ttEvents(emp), sh = ttShifts(all), days = [], perDay = ttPerDay(sh), who = findPerson(emp) || {};
  var inWeek = sh.filter(function (s) { return s.day >= ws && s.day <= we || (s.end != null && ttDayOf(s.end) >= ws && s.day < ws); });
  for (var i = 0; i < 7; i++) { var d = ttAddDays(ws, i); days.push({ date: d, paid_min: ttMin(perDay[d] || 0), shifts: inWeek.filter(function (s) { return s.day === d; }).map(function (s) { return ttShiftOut(s, true); }) }); }
  var gone = {}; all.forEach(function (e) { if (e.supersedes) gone[e.supersedes] = e.corr_id || e.id; });
  var replaced = all.filter(function (e) { return gone[e.id] && ttDayOf(ttMs(e.at)) >= ws && ttDayOf(ttMs(e.at)) <= we; }).map(function (e) { var o = ttEvOut(e, true); o.replaced_by = gone[e.id]; return o; });
  var conflicts = all.filter(function (e) { return e.status === "conflict" && ttDayOf(ttMs(e.at)) >= ws && ttDayOf(ttMs(e.at)) <= we; }).map(function (e) { return ttEvOut(e, true); });
  var calc = ttCalcWeek(days.map(function (d) { return d.paid_min; }), who.pay_type);
  var byAct = {}; inWeek.forEach(function (s) { if (s.voided) return; s.segs.forEach(function (g) { var k = g.kind === "rest" ? "rest" : g.act; byAct[k] = (byAct[k] || 0) + (g.to - g.from); }); });
  Object.keys(byAct).forEach(function (k) { byAct[k] = ttMin(byAct[k]); });
  var wk = findBy("TtWeeks", "key", ws + "|" + emp), per = findBy("TtPeriods", "id", ws) || { id: ws, status: "open", version: "0" };
  var cors = rows("TtCorrections").filter(function (c) { return c.emp === emp && (c.period_id === ws || ["pending", "needs_info"].indexOf(c.status) > -1); }).map(ttCorOut);
  var hash = ttHash(days, inWeek);
  return { emp: emp, name: personName(emp), pay_type: who.pay_type || "", week: { start: ws, end: we, status: per.status, version: num(per.version) }, days: days, replaced: replaced, conflicts: conflicts,
    totals: { paid_min: days.reduce(function (a, d) { return a + d.paid_min; }, 0), meal_min: ttMin(inWeek.reduce(function (a, s) { return a + (s.voided ? 0 : s.meal); }, 0)), by_act: byAct }, calc: calc,
    open_shifts: inWeek.filter(function (s) { return s.open && !s.voided; }).length, exceptions: ttExc(emp, sh, ws, we, all), corrections: cors,
    confirm: wk ? { status: wk.emp_status, note: wk.emp_note, at: wk.emp_at } : null,
    approval: wk && wk.approved_by ? { by: personName(wk.approved_by), at: wk.approved_at, valid: wk.approved_hash === hash } : null };
}
function ttHash(days, inWeek) { return sha(JSON.stringify(days.map(function (d) { return d.paid_min; })) + "|" + inWeek.map(function (s) { return s.id + ":" + s.events.length + ":" + (s.voided ? "v" : ""); }).join(",")).slice(0, 16); }
ACTIONS.ttMyWeek = function (me, b) {
  ttClocker(me); var emp = normEmail(b.emp || me.email);
  if (emp !== normEmail(me.email) && !ttCanReview(me, emp)) throw ttErr(me, "No puedes ver las horas de esa persona.", "You can't see that person's hours.");
  var d = /^\d{4}-\d\d-\d\d$/.test(String(b.week || "")) ? b.week : ttDayOf(ttNow());
  var out = ttWeekOf(emp, ttWeekStart(d), emp !== normEmail(me.email)); out.today = ttDayOf(ttNow()); out.me = emp === normEmail(me.email);
  if (out.me && ttRow(me).role === "crew") {                                              // crew looking at their own week: times and jobsites, no verdicts
    out.exceptions = []; out.replaced = []; out.conflicts = [];
    out.days.forEach(function (dd) { dd.shifts.forEach(function (s) { s.events = s.events.map(function (e) { return { id: e.id, kind: e.kind, at: e.at, act: e.act, act_note: e.act_note, ref_name: e.ref_name, source: e.source }; }); }); });
  }
  if (isStaff(ttRow(me))) { var all = []; out.days.forEach(function (dd) { dd.shifts.forEach(function (s) { all = all.concat(s.events); }); }); ttFillAddr(all.concat(out.replaced || []), 40); }
  return out;
};
ACTIONS.ttConfirmWeek = function (me, b) {
  ttClocker(me); var emp = normEmail(me.email), ws = ttWeekStart(String(b.week || "")), st = b.status === "discrepancy" ? "discrepancy" : "ok", note = clean(b.note, 1000);
  if (!/^\d{4}-\d\d-\d\d$/.test(ws)) throw new Error("Pick the week.");
  if (st === "discrepancy" && note.length < 3) throw ttErr(me, "Escribe qué no cuadra.", "Say what doesn't match.");
  var k = ws + "|" + emp, wk = findBy("TtWeeks", "key", k), h = parseJson(wk && wk.history, []); h.push({ at: ttIso(ttNow()), by: emp, what: "employee " + st, note: note });
  var patch = { emp_status: st, emp_note: note, emp_at: ttIso(ttNow()), history: JSON.stringify(h) };
  if (wk) update("TtWeeks", "key", k, patch); else insert("TtWeeks", Object.assign({ key: k, period_id: ws, emp: emp }, patch));
  ttAudit(me, emp, "confirm", k, null, patch, note); return { ok: true };
};

/* ---- the meal question at check-out (shifts over 5 h with no meal clocked). Nothing is deducted by itself:
   "took it" becomes a request with the time they give; "no" or "interrupted" keeps the time paid and goes to review. ---- */
function ttMealOf(emp, sid) { return rows("TtMeals").filter(function (m) { return m.emp === emp && m.shift_id === sid; }).sort(function (a, b) { return String(a.at).localeCompare(String(b.at)); }).pop() || null; }
ACTIONS.ttMeal = function (me, b) {
  ttClocker(me); var emp = normEmail(me.email), ans = String(b.answer || "");
  if (["took", "none", "interrupted"].indexOf(ans) < 0) throw ttErr(me, "Elige una respuesta.", "Pick an answer.");
  var s = ttShifts(ttEvents(emp)).filter(function (x) { return x.id === String(b.shift_id || ""); })[0];
  if (!s || s.open || s.voided) throw ttErr(me, "No encontré esa jornada.", "Shift not found.");
  if (s.meals.length) throw ttErr(me, "Esa jornada ya tiene comida registrada.", "That shift already has a meal recorded.");
  var row = { id: newId("tm"), emp: emp, shift_id: s.id, day: s.day, answer: ans, start: "", minutes: "", corr_id: "", at: ttIso(ttNow()) };
  if (ans === "took") {
    var st = String(b.start || ""), mins = Math.round(num(b.minutes));
    if (!/^\d\d:\d\d$/.test(st)) throw ttErr(me, "¿A qué hora empezaste a comer?", "What time did the meal start?");
    if (mins < 10 || mins > 120) throw ttErr(me, "La comida debe durar entre 10 y 120 minutos.", "A meal is 10 to 120 minutes.");
    var a = ttFromLocal(s.day + " " + st), z = a + mins * 6e4;
    if (a == null || a < s.start || z > s.end) throw ttErr(me, "La comida tiene que quedar entre tu entrada y tu salida.", "The meal has to fall between your check-in and check-out.");
    var r = ACTIONS.ttRequestCorrection(me, { reason: "meal", explain: (ttLang(me) === "es" ? "Comida reportada al marcar salida: " : "Meal reported at check-out: ") + st + ", " + mins + " min", shift_id: s.id,
      changes: [{ op: "add", kind: "meal_start", shift_id: s.id, at: ttLocal(a) }, { op: "add", kind: "meal_end", shift_id: s.id, at: ttLocal(z) }] });
    row.start = st; row.minutes = String(mins); row.corr_id = r.correction.id;
  }
  insert("TtMeals", row); ttAudit(me, emp, "meal_answer", s.id, null, { answer: ans, start: row.start, minutes: row.minutes }, "");
  return { answer: ans, corr_id: row.corr_id };
};

/* ====================================== corrections ====================================== */
function ttCorOut(c) {
  return { id: c.id, emp: c.emp, name: personName(c.emp), shift_id: c.shift_id, date: c.date, reason: c.reason, explain: c.explain, changes: parseJson(c.changes, []), before: parseJson(c.before, {}),
    delta_min: num(c.delta_min), declared_place: c.declared_place, requested_by: personName(c.requested_by), office: c.requested_by !== c.emp, requested_at: c.requested_at, status: c.status,
    decided_by: c.decided_by ? personName(c.decided_by) : "", decided_at: c.decided_at, decision_note: c.decision_note, period_id: c.period_id, after_close: isTrue(c.after_close),
    dispute: c.dispute, dispute_at: c.dispute_at, history: parseJson(c.history, []) };
}
/* The events a correction would add (nothing saved). Each says it came from a correction; none carries a phone location. */
function ttVirtual(me, emp, changes, corrId, declared, evs) {
  var byId = {}; evs.forEach(function (e) { byId[e.id] = e; }); var lastIn = "", made = [], t0 = ttIso(ttNow());
  var base = function (kind, atIso, sid, job, sup) {
    var id = newId("te"); return { id: id, emp: emp, actor: me.email, kind: kind, at: atIso, device_at: "", recv_at: t0, tz: CONFIG.TZ, act: job ? job.act : "", ref_type: job ? job.ref_type : "", ref_id: job ? job.ref_id : "",
      ref_name: job ? job.ref_name : "", lat: "", lon: "", acc: "", loc_at: "", loc_status: declared ? "declared" : "none", zone: "none", zone_name: declared ? String(declared).slice(0, 120) : "", zone_m: "",
      source: "correction", offline: "", seq: "", client_key: "", device: "", shift_id: sid || id, supersedes: sup || "", corr_id: corrId, note: "", status: "ok" };
  };
  changes.forEach(function (c) {
    if (c.op === "add") {
      var sid = c.kind === "in" ? "" : c.shift_id || lastIn; if (c.kind !== "in" && !sid) throw ttErr(me, "Indica a qué jornada pertenece.", "Say which shift it belongs to.");
      var e = base(c.kind, c.at, sid, c.kind === "in" || c.kind === "switch" ? c.job : null); if (c.kind === "in") lastIn = e.id; made.push(e);
    } else if (c.op === "move" || c.op === "retag") {
      var o = byId[c.target]; if (!o || o.emp !== emp || ["void", "restore"].indexOf(o.kind) > -1) throw ttErr(me, "No encontré ese registro.", "That record wasn't found.");
      var j = c.op === "retag" ? c.job : (o.kind === "in" || o.kind === "switch" ? ttJobOf(o) : null);
      made.push(base(o.kind, c.op === "move" ? c.at : o.at, o.shift_id, j, o.id));
    } else if (c.op === "void" || c.op === "restore") made.push(base(c.op, t0, c.shift_id, null, ""));
  });
  return made;
}
function ttParseChanges(me, emp, list) {
  list = [].concat(list || []); if (!list.length || list.length > 8) throw ttErr(me, "Agrega el cambio que pides (máximo 8).", "Add the change you're asking for (8 at most).");
  var nowMs = ttNow();
  return list.map(function (c) {
    var op = String(c.op || ""), o = { op: op };
    if (["add", "move", "retag", "void", "restore"].indexOf(op) < 0) throw new Error("Unknown change.");
    if (op === "void" || op === "restore") { if (!c.shift_id) throw new Error("Which shift?"); o.shift_id = String(c.shift_id); return o; }
    if (op !== "add") o.target = String(c.target || "");
    if (op === "add") { o.kind = String(c.kind || ""); if (["in", "out", "meal_start", "meal_end", "rest_start", "rest_end", "switch"].indexOf(o.kind) < 0) throw new Error("Unknown change."); if (c.shift_id) o.shift_id = String(c.shift_id); }
    if (op === "add" || op === "move") {
      var ms = ttFromLocal(c.at); if (ms == null) throw ttErr(me, "Escribe la hora (fecha y hora).", "Write the date and time.");
      if (ms > nowMs) throw ttErr(me, "La hora no puede ser en el futuro.", "The time can't be in the future."); o.at = ttIso(ms); o.at_local = ttLocal(ms);
    }
    if (op === "retag" || (op === "add" && (o.kind === "in" || o.kind === "switch"))) o.job = ttJob(me, emp, c);
    return o;
  });
}
function ttCheck(me, shifts) {
  var ok = shifts.filter(function (s) { return !s.voided; });
  ok.forEach(function (s) {
    if (s.broken) throw ttErr(me, "Así quedaría una jornada sin entrada.", "That would leave a shift without a check-in.");
    if (s.stray) throw ttErr(me, "Hay un registro fuera de la jornada (antes de la entrada o después de la salida).", "A record would fall outside its shift (before the check-in or after the check-out).");
    if (s.end != null && s.end - s.start > 24 * 36e5) throw ttErr(me, "Una jornada no puede pasar de 24 horas.", "A shift can't be longer than 24 hours.");
  });
  for (var i = 1; i < ok.length; i++) { var a = ok[i - 1], b = ok[i]; if (a.end == null || b.start < a.end) throw ttErr(me, "Se encimaría con otra jornada tuya que empezó el " + ttDayOf(a.start).slice(5).replace("-", "/") + " a las " + ttHm(a.start) + ".", "That would overlap the shift starting " + ttHuman(a.start) + "."); }
}
function ttDaysTouched(shifts, ids) { var d = {}; shifts.forEach(function (s) { if (ids[s.id]) { d[s.day] = 1; if (s.end != null) d[ttDayOf(s.end)] = 1; } }); return d; }
function ttPreview(me, emp, changes, corrId, declared) {
  var evs = ttEvents(emp), before = ttShifts(evs), virt = ttVirtual(me, emp, changes, corrId, declared, evs), after = ttShifts(evs.concat(virt));
  ttCheck(me, after);
  var ids = {}; virt.forEach(function (e) { ids[e.shift_id] = 1; }); var days = Object.assign(ttDaysTouched(before, ids), ttDaysTouched(after, ids));
  var pb = ttPerDay(before), pa = ttPerDay(after), bd = {}, ad = {}, delta = 0;
  Object.keys(days).forEach(function (d) { bd[d] = ttMin(pb[d] || 0); ad[d] = ttMin(pa[d] || 0); delta += ad[d] - bd[d]; });
  return { virt: virt, before: bd, after: ad, delta: delta, days: Object.keys(days).sort() };
}
ACTIONS.ttRequestCorrection = function (me, b) {
  ttClocker(me); var self = normEmail(me.email), emp = normEmail(b.emp || self), office = emp !== self;
  if (office && me.role !== "admin") throw ttErr(me, "Solo el admin edita horas de otras personas.", "Only the admin edits other people's hours.");
  var reason = office ? "office_fix" : String(b.reason || ""); if (!TT_REASONS[reason]) throw ttErr(me, "Elige el motivo.", "Pick the reason.");
  var explain = clean(b.explain, 1000); if (explain.length < (office ? 8 : 3)) throw ttErr(me, "Explica qué pasó.", "Explain what happened.");
  var changes = ttParseChanges(me, emp, b.changes), mineEv = {}; ttEvents(emp).forEach(function (e) { mineEv[e.id] = e; });
  changes.forEach(function (c) { var o = c.target && mineEv[c.target]; if (o) { c.orig_kind = o.kind; c.orig_at = ttIso(ttMs(o.at)); c.orig_local = ttLocal(ttMs(o.at)); c.orig_job = ttJobOf(o); } });   // what it was, shown next to what's asked
  if (!office && changes.some(function (c) { return c.op === "void" || c.op === "restore"; })) throw ttErr(me, "Solo la oficina puede anular una jornada.", "Only the office can void a shift.");
  var id = newId("tc"), pv = ttPreview(me, emp, changes, id, clean(b.declared_place, 120));
  var first = pv.days[0] || ttDayOf(ttNow()), ws = ttWeekStart(first), per = findBy("TtPeriods", "id", ws), closed = !!per && per.status === "closed";
  var row = { id: id, emp: emp, shift_id: clean(b.shift_id, 40), date: first, reason: reason, explain: explain, changes: JSON.stringify(changes), before: JSON.stringify({ before: pv.before, after: pv.after }),
    delta_min: String(pv.delta), declared_place: clean(b.declared_place, 120), evidence_id: "", requested_by: self, requested_at: ttIso(ttNow()), status: "pending", decided_by: "", decided_at: "", decision_note: "",
    applied: "", period_id: ws, after_close: closed ? "yes" : "", dispute: "", dispute_at: "", history: JSON.stringify([{ at: ttIso(ttNow()), by: self, what: "requested" }]), seen_at: "" };
  insert("TtCorrections", row); ttAudit(me, emp, "correction_requested", id, null, { changes: changes, delta_min: pv.delta }, explain);
  return { correction: ttCorOut(row) };
};
function ttCorNeed(me, id) { var c = findBy("TtCorrections", "id", String(id || "")); if (!c) throw new Error("Correction not found."); return c; }
function ttHist(c, me, what, note) { var h = parseJson(c.history, []); h.push({ at: ttIso(ttNow()), by: me.email, what: what, note: note || "" }); return JSON.stringify(h); }
/* The admin's manual edit: applied right away, with its reason; the original records stay on file as "replaced". */
ACTIONS.ttAdminEdit = function (me, b) {
  if (me.role !== "admin" || me.preview) throw new Error("Only the admin edits hours.");
  var emp = normEmail(b.emp), who = findPerson(emp); if (!who || !isTeam(who)) throw new Error("Pick an employee.");
  var explain = clean(b.explain, 1000); if (explain.length < 5) throw new Error("Write the reason for the edit.");
  var changes = ttParseChanges(me, emp, b.changes), id = newId("tc"), pv = ttPreview(me, emp, changes, id, "");
  var first = pv.days[0] || ttDayOf(ttNow()), ws = ttWeekStart(first), per = findBy("TtPeriods", "id", ws), closed = !!per && per.status === "closed", t = ttIso(ttNow());
  pv.virt.forEach(function (e) { insert("TtEvents", e); });
  insert("TtCorrections", { id: id, emp: emp, shift_id: clean(b.shift_id, 40), date: first, reason: "admin_edit", explain: explain, changes: JSON.stringify(changes), before: JSON.stringify({ before: pv.before, after: pv.after }),
    delta_min: String(pv.delta), declared_place: "", evidence_id: "", requested_by: normEmail(me.email), requested_at: t, status: "approved", decided_by: normEmail(me.email), decided_at: t, decision_note: explain,
    applied: pv.virt.map(function (e) { return e.id; }).join(","), period_id: ws, after_close: closed ? "yes" : "", dispute: "", dispute_at: "", history: JSON.stringify([{ at: t, by: normEmail(me.email), what: "edited by the admin", note: explain }]), seen_at: "" });
  if (closed) { var ph = parseJson(per.history, []), v = num(per.version) + 1; ph.push({ at: t, by: normEmail(me.email), what: "adjustment after close", corr: id, emp: emp, delta_min: pv.delta, version: v }); update("TtPeriods", "id", per.id, { version: String(v), history: JSON.stringify(ph) }); }
  ttAudit(me, emp, "admin_edit", id, pv.before, pv.after, explain);
  return { ok: true, delta_min: pv.delta };
};
ACTIONS.ttDecide = function (me, b) {
  var c = ttCorNeed(me, b.id), self = normEmail(me.email), dec = String(b.decision || ""), note = clean(b.note, 1000);
  if (["pending", "needs_info"].indexOf(c.status) < 0) throw new Error("This correction was already decided.");
  if (self === c.emp || self === c.requested_by) throw new Error("Nobody decides their own correction. Another reviewer has to.");
  if (!ttCanReview(me, c.emp)) throw new Error("You can't review this person's hours.");
  var per = findBy("TtPeriods", "id", c.period_id), closed = !!per && per.status === "closed";
  if (closed && !ttPerms(me).accounting) throw new Error("That week is closed. Only accounting decides changes to a closed week.");
  if (dec === "approve") {
    var pv = ttPreview(me, c.emp, parseJson(c.changes, []), c.id, c.declared_place);      // re-checked against the records as they are now
    pv.virt.forEach(function (e) { insert("TtEvents", e); });
    var patch = { status: "approved", decided_by: self, decided_at: ttIso(ttNow()), decision_note: note, applied: pv.virt.map(function (e) { return e.id; }).join(","), delta_min: String(pv.delta),
      before: JSON.stringify({ before: pv.before, after: pv.after }), history: ttHist(c, me, "approved", note) };
    if (closed) {
      var ph = parseJson(per.history, []), v = num(per.version) + 1; ph.push({ at: ttIso(ttNow()), by: self, what: "adjustment after close", corr: c.id, emp: c.emp, delta_min: pv.delta, version: v });
      update("TtPeriods", "id", per.id, { version: String(v), history: JSON.stringify(ph) }); patch.after_close = "yes";
    }
    update("TtCorrections", "id", c.id, patch); ttAudit(me, c.emp, "correction_approved", c.id, pv.before, pv.after, note);
  } else if (dec === "reject" || dec === "ask") {
    if (note.length < 3) throw new Error(dec === "reject" ? "Say why it's rejected." : "Write what you need to know.");
    update("TtCorrections", "id", c.id, { status: dec === "reject" ? "rejected" : "needs_info", decided_by: self, decided_at: ttIso(ttNow()), decision_note: note, history: ttHist(c, me, dec === "reject" ? "rejected" : "asked for details", note) });
    ttAudit(me, c.emp, dec === "reject" ? "correction_rejected" : "correction_question", c.id, null, null, note);
  } else throw new Error("Approve, reject or ask.");
  return { correction: ttCorOut(findBy("TtCorrections", "id", c.id)) };
};
ACTIONS.ttReply = function (me, b) {
  var c = ttCorNeed(me, b.id), self = normEmail(me.email), note = clean(b.note, 1000);
  if (c.emp !== self && c.requested_by !== self) throw new Error("Correction not found."); if (note.length < 2) throw ttErr(me, "Escribe tu respuesta.", "Write your answer.");
  if (b.withdraw) { if (["pending", "needs_info"].indexOf(c.status) < 0) throw new Error("It was already decided."); update("TtCorrections", "id", c.id, { status: "withdrawn", history: ttHist(c, me, "withdrawn", note) }); ttAudit(me, c.emp, "correction_withdrawn", c.id, null, null, note); return { ok: true }; }
  if (b.dispute) { if (["approved", "rejected"].indexOf(c.status) < 0) throw new Error("There's no decision to question yet."); update("TtCorrections", "id", c.id, { dispute: note, dispute_at: ttIso(ttNow()), history: ttHist(c, me, "questioned the decision", note) }); ttAudit(me, c.emp, "decision_questioned", c.id, null, null, note); return { ok: true }; }
  if (c.status !== "needs_info") throw new Error("Nobody asked for details on this one.");
  update("TtCorrections", "id", c.id, { status: "pending", history: ttHist(c, me, "answered", note) }); ttAudit(me, c.emp, "correction_answered", c.id, null, null, note); return { ok: true };
};
ACTIONS.ttSeen = function (me) { ttClocker(me); var e = normEmail(me.email), t = ttIso(ttNow()); rows("TtCorrections").forEach(function (c) { if (c.emp === e && c.decided_at && (!c.seen_at || c.seen_at < c.decided_at)) update("TtCorrections", "id", c.id, { seen_at: t }); }); return {}; };

/* ====================================== review, items to resolve, closing the week ====================================== */
function ttAbsentOn(emp, d) { return rows("TtAbsence").some(function (a) { return a.emp === emp && a.from <= d && a.to >= d; }); }
/* Items to review for one person. Neutral words: an item is a gap in the record, never a judgment about the person. */
function ttExc(emp, shifts, from, to, evs) {
  var out = [], cfg = ttCfg(), nowMs = ttNow(), today = ttDayOf(nowMs), who = findPerson(emp) || {}, nm = who.name || emp, owner = ttOwnerOf(emp);
  var add = function (x) { x.emp = emp; x.name = nm; x.owner = x.owner || owner; out.push(x); };
  shifts.forEach(function (s) {
    if (s.voided || s.broken || s.day < from || s.day > to) return;
    if (s.open && s.day < today) add({ key: "out:" + s.id, kind: "missing_out", day: s.day, shift_id: s.id, priority: 1, title: "Check-out missing", why: "Shift started " + ttHuman(s.start) + " and is still open", next: "Ask " + nm + " for the time, or record an office correction" });
    else if (s.open && nowMs - s.start > cfg.open_long_h * 36e5) add({ key: "long:" + s.id, kind: "open_long", day: s.day, shift_id: s.id, priority: 2, title: "Shift open more than " + cfg.open_long_h + " h", why: "Started " + ttHm(s.start), next: "Check with " + nm });
    if (!s.open && s.unassigned >= 6e4) add({ key: "un:" + s.id, kind: "unassigned", day: s.day, shift_id: s.id, priority: 3, title: ttMin(s.unassigned) + " min not assigned to a job", why: "The time counts; it just isn't on a job yet", next: "Assign the job (correction)" });
    var paid = s.paid / 6e4, said = ttMealOf(emp, s.id);
    if (!s.open && paid > 300 && !s.meals.length && said && said.answer === "none") add({ key: "meal:" + s.id, kind: "meal", day: s.day, shift_id: s.id, priority: 2, title: "Says no meal was taken", why: Math.round(paid / 6) / 10 + " h shift; answered at check-out", next: "Review with accounting (a meal premium may apply)" });
    else if (!s.open && paid > 300 && !s.meals.length && said && said.answer === "interrupted") add({ key: "meal:" + s.id, kind: "meal", day: s.day, shift_id: s.id, priority: 2, title: "Says the meal was interrupted or worked through", why: Math.round(paid / 6) / 10 + " h shift; the time stays paid", next: "Review with accounting (a meal premium may apply)" });
    else if (!s.open && paid > 300 && !s.meals.length && said && said.answer === "took") { /* the meal they reported is a correction to decide */ }
    else if (!s.open && paid > 300 && !s.meals.length) add({ key: "meal:" + s.id, kind: "meal", day: s.day, shift_id: s.id, priority: 2, title: "Meal period to review", why: Math.round(paid / 6) / 10 + " h with no meal recorded", next: "Ask whether a meal was taken, missed or interrupted" });
    else if (!s.open && paid > 600 && s.meals.length < 2) add({ key: "meal2:" + s.id, kind: "meal", day: s.day, shift_id: s.id, priority: 2, title: "Second meal period to review", why: Math.round(paid / 6) / 10 + " h with " + s.meals.length + " meal recorded", next: "Review with accounting" });
    s.events.forEach(function (e) {
      if (e.source === "correction") return;
      if (isTrue(e.offline)) add({ key: "off:" + e.id, kind: "offline", day: s.day, shift_id: s.id, priority: 3, title: "Recorded without signal", why: "Time comes from the phone's clock; it reached the server " + ttHuman(ttMs(e.recv_at)), next: "Confirm the time looks right" });
    });
  });
  (evs || []).forEach(function (e) { var d = ttDayOf(ttMs(e.at)); if (e.status === "conflict" && d >= from && d <= to) add({ key: "conf:" + e.id, kind: "conflict", day: d, shift_id: e.shift_id, priority: 1, title: "A record didn't fit", why: (e.note || "conflict") + " (" + e.kind + " " + ttHuman(ttMs(e.at)) + ")", next: "Decide with an office correction; the record stays on file" }); });
  var live = shifts.filter(function (s) { return !s.voided && !s.broken; });
  for (var i = 1; i < live.length; i++) if (live[i - 1].end == null ? live[i].start > live[i - 1].start : live[i].start < live[i - 1].end) add({ key: "ovl:" + live[i].id, kind: "overlap", day: live[i].day, shift_id: live[i].id, priority: 1, title: "Overlapping shifts", why: "Two shifts cover the same time", next: "Fix with an office correction" });
  var perDay = ttPerDay(shifts);
  Object.keys(perDay).forEach(function (d) { if (d >= from && d <= to && perDay[d] > 8 * 36e5) add({ key: "ot:" + d + ":" + pkey(emp), kind: "overtime", day: d, priority: 3, title: "Possible overtime", why: Math.round(perDay[d] / 36e5 * 10) / 10 + " h on " + d, next: "Review hours; overtime worked is paid even if it wasn't pre-approved" }); });
  // a scheduled day with no check-in (crews only; past days; not on a recorded absence; only since this person started using the clock)
  var crews = ttCrewsOf(emp).map(function (c) { return c.id; }), firstDay = (evs || []).filter(function (e) { return e.source !== "correction"; }).map(function (e) { return ttDayOf(ttMs(e.at)); }).sort()[0];
  if (crews.length && firstDay) {
    var days = {}; rows("LsVisits").forEach(function (v) { if (crews.indexOf(v.crew_id) > -1 && v.date >= from && v.date >= firstDay && v.date <= to && v.date < today && ["canceled", "skipped"].indexOf(v.status) < 0) days[v.date] = 1; });
    Object.keys(days).forEach(function (d) { if (!live.some(function (s) { return s.day === d; }) && !ttAbsentOn(emp, d)) add({ key: "noin:" + d + ":" + pkey(emp), kind: "no_checkin", day: d, priority: 2, title: "No check-in on a scheduled day", why: "Their crew had visits on " + d, next: "Ask if they worked, or record the absence" }); });
  }
  // taps from another person's phone that aren't already in a check-in case (e.g. a check-out made for someone)
  (evs || []).forEach(function (e) {
    if (e.device_flag !== "other_person" || e.case_id || e.source === "correction") return; var d = ttDayOf(ttMs(e.at)); if (d < from || d > to) return;
    add({ key: "dev:" + e.id, kind: "device", day: d, shift_id: e.shift_id, priority: 1, title: (e.kind === "out" ? "Check-out" : "Clock tap") + " made from " + personName(e.device_owner) + "'s phone", why: ttHm(ttMs(e.at)) + " · " + (e.ref_name || "") + " · the phone is registered to " + personName(e.device_owner), next: "Ask both people; correct the time if needed" });
  });
  // check-ins that couldn't be verified: one item per shift, whatever the number of retries
  var RS = { denied: "location permission was off", timeout: "the phone took too long to locate", unavailable: "the phone couldn't get a location", unsupported: "the device doesn't share location", none: "no location was sent", stale: "the location was old", imprecise: "the location wasn't precise enough", uncertain: "too close to the edge to tell", outside: "the phone was away from the jobsite", other_device: "made from another person's phone", new_device: "from a phone not approved yet", no_device: "the phone didn't identify itself", blocked_device: "from a blocked phone", no_geocode: "the jobsite has no map point", no_place: "no jobsite was picked" };
  rows("TtPresence").forEach(function (c) {
    if (c.emp !== emp || !TT_OPEN_CASE[c.status]) return; var d = ttDayOf(ttMs(c.first_at)); if (d < from || d > to) return;
    var atts = parseJson(c.attempts, []), last = atts[atts.length - 1] || {};
    add({ key: "pres:" + c.id, kind: "presence", day: d, shift_id: c.shift_id, priority: 1, case_id: c.id,
      title: c.status === "verified_later" ? "Check-in verified late" : last.presence === "outside" ? "Check-in away from the jobsite" : "Check-in pending validation",
      why: (c.place || "No jobsite") + " · " + ttHm(ttMs(c.first_at)) + " · " + (RS[c.first_reason] || c.first_reason) + (last.dist != null ? " (" + last.dist + " m away, ±" + last.acc + " m)" : "") + (atts.length > 1 ? " · " + atts.length + " tries" : "") + (c.status === "verified_later" ? " · verified from " + ttHm(ttMs(c.verified_at)) : "") + (parseJson(c.explain, []).length ? " · explained" : ""),
      next: "Look at the evidence, then accept or reject with a reason" });
  });
  rows("TtCorrections").forEach(function (c) {
    if (c.emp !== emp) return;
    if (c.status === "pending" || c.status === "needs_info") add({ key: "cor:" + c.id, kind: "correction", day: c.date, priority: c.status === "pending" ? 1 : 3, title: c.status === "pending" ? "Correction to decide" : "Waiting on " + nm + "'s answer", why: (c.delta_min > 0 ? "+" : "") + num(c.delta_min) + " min · " + c.explain.slice(0, 80), next: c.status === "pending" ? "Approve, reject or ask" : "Wait for the reply" });
    if (c.dispute && c.dispute_at >= (c.decided_at || "")) add({ key: "dis:" + c.id, kind: "dispute", day: c.date, priority: 2, title: nm + " questions a decision", why: c.dispute.slice(0, 90), next: "Talk with them; record an office correction if needed" });
  });
  return out;
}
/* Speed: the dashboard is kept in the cache for 2 minutes per viewer and week, and thrown away the moment any hours change
   (every time action bumps "ttver"). Big answers are split in pieces (the cache holds 100 KB per piece). */
function ttVer() { try { return CacheService.getScriptCache().get("ttver") || "0"; } catch (e) { return "0"; } }
function ttBump() { try { CacheService.getScriptCache().put("ttver", String(Date.now()), 21600); } catch (e) {} }
function bigCacheGet(k) {
  try { var c = CacheService.getScriptCache(), n = Number(c.get(k + ":n") || 0); if (!n || n > 40) return null; var keys = []; for (var i = 0; i < n; i++) keys.push(k + ":" + i);
    var g = c.getAll(keys), s = ""; for (var j = 0; j < n; j++) { if (g[k + ":" + j] == null) return null; s += g[k + ":" + j]; } return JSON.parse(s); } catch (e) { return null; }
}
function bigCachePut(k, obj, ttl) {
  try { var s = JSON.stringify(obj), size = 30000, n = Math.ceil(s.length / size); if (!n || n > 40) return; var o = {}; for (var i = 0; i < n; i++) o[k + ":" + i] = s.substr(i * size, size); o[k + ":n"] = String(n); CacheService.getScriptCache().putAll(o, ttl || 120); } catch (e) {}
}
ACTIONS.ttReview = function (me, b) {
  var pm = ttPerms(me); if (!pm.time_review) throw new Error("Only reviewers see the team's hours.");
  var ws0 = ttWeekStart(/^\d{4}-\d\d-\d\d$/.test(String(b.week || "")) ? b.week : ttDayOf(ttNow())), ck = "ttrev:" + rtHash("r|" + normEmail(me.email) + "|" + ws0).slice(0, 24) + ":" + ttVer();
  if (!b.fresh && !TT_NOW) { var hit = bigCacheGet(ck); if (hit) { hit.cached = true; return hit; } }
  prefetch(TT_READ);
  var out = ttReviewBuild(me, b, pm, ws0); if (!TT_NOW) bigCachePut(ck, out, 120); return out;
};
function ttReviewBuild(me, b, pm, ws) {
  var we = ttAddDays(ws, 6), self = normEmail(me.email);
  var scope = ttScope(me), per = findBy("TtPeriods", "id", ws) || { id: ws, status: "open", version: "0", history: "" };
  var people = scope.map(function (emp) {
    var w = ttWeekOf(emp, ws, true), pr = findPerson(emp) || {};                         // everyone on the team shows, even with no hours this week…
    var has = pr.role !== "admin" || w.totals.paid_min > 0 || w.open_shifts > 0 || w.days.some(function (d) { return d.shifts.length; });   // …except the admin, unless he has hours to fix
    var loc = { inside: 0, outside: 0, unknown: 0, nogps: 0 };                          // where the taps happened vs the place they picked (office only)
    w.days.forEach(function (d) { d.shifts.forEach(function (s) { s.events.forEach(function (e) {
      if (e.source === "correction" || !e.presence) return;                                // check-ins, jobsite moves and retries
      if (e.presence === "verified") loc.inside++; else if (e.presence === "outside") loc.outside++; else if (e.lat == null) loc.nogps++; else loc.unknown++;
    }); }); });
    return has ? { emp: emp, name: w.name, pay_type: w.pay_type, paid_min: w.totals.paid_min, reg: w.calc.reg, ot: w.calc.ot, dt: w.calc.dt, exceptions: w.exceptions.length, open_shifts: w.open_shifts,
      pending: w.corrections.filter(function (c) { return c.status === "pending"; }).length, confirm: w.confirm, approval: w.approval, self: emp === self, loc: loc,
      presence_open: w.exceptions.filter(function (x) { return x.kind === "presence"; }).length,
      role: pr.role, level: pr.role === "crew" ? (ttIsLabor(pr) ? "labor" : "pm") : pr.role === "admin" ? "admin" : "team", clock: ttEnabled(pr),
      days: w.days.map(function (d) { return { date: d.date, paid_min: d.paid_min, shifts: d.shifts.map(function (s) {
        var ins = s.events.filter(function (e) { return e.kind === "in"; })[0] || {}, outs = s.events.filter(function (e) { return e.kind === "out"; })[0] || null, c = ttCaseOf(emp, s.id);
        var places = []; s.segs.forEach(function (g) { var n = g.ref_name || "No jobsite"; if (places.indexOf(n) < 0) places.push(n); });
        var last = s.events.filter(function (e) { return e.presence; }).pop() || ins;
        return { id: s.id, start: s.start, end: s.end, open: s.open, voided: s.voided, paid_min: s.paid_min, places: places, acts: s.segs.map(function (g) { return g.act_note || ""; }).filter(function (x, i, a) { return x && a.indexOf(x) === i; }),
          gps: { result: ins.presence || "", reason: ins.presence_reason || "", dist: ins.zone_m, acc: ins.acc, addr: ins.addr || "", last: last.presence || "" }, phone: { flag: ins.device_flag || "", owner: ins.device_owner || "" },
          out_phone: outs ? outs.device_flag || "" : "", case: c ? c.status : "", corrected: s.events.some(function (e) { return e.source === "correction"; }), in_id: ins.id || "", out_id: outs ? outs.id : "" };
      }) }; }),
      now: (function () { var o = ttStateOf(emp); return o.shift ? { since: o.shift.start, place: o.shift.job && o.shift.job.ref_name } : null; })() } : null;
  }).filter(Boolean);
  var cors = rows("TtCorrections").filter(function (c) { return scope.indexOf(c.emp) > -1 && (c.status === "pending" || c.status === "needs_info"); }).map(function (c) {
    var o = ttCorOut(c), sh = ttShifts(ttEvents(c.emp)); o.can_decide = c.emp !== self && c.requested_by !== self && (!(per.id === c.period_id && per.status === "closed") || !!pm.accounting);
    o.near = sh.filter(function (s) { return Math.abs(new Date(s.day) - new Date(c.date)) <= 864e5; }).map(function (s) { return ttShiftOut(s, true); });   // the record as it is now, side by side
    var crews = ttCrewsOf(c.emp).map(function (x) { return x.id; }); o.assigned = rows("LsVisits").filter(function (v) { return v.date === c.date && crews.indexOf(v.crew_id) > -1; }).map(function (v) { var p = findBy("LsProps", "id", v.property_id) || {}; return { name: p.name || "Visit", status: v.status, stop: v.stop }; });
    return o;
  });
  var cases = rows("TtPresence").filter(function (c) { if (scope.indexOf(c.emp) < 0) return false; var d = ttDayOf(ttMs(c.first_at)); return TT_OPEN_CASE[c.status] || (d >= ws && d <= we); })
    .map(function (c) { var o = ttCaseOut(c, false); o.can_decide = o.open && c.emp !== self; return o; }).sort(function (a, b) { return (b.open - a.open) || String(a.first_at).localeCompare(String(b.first_at)); });   // the map data loads on "Where?" (ttCaseDetail)
  var blockers = ttCloseBlockers(people); if (we >= ttDayOf(ttNow())) blockers.unshift("The week isn't over yet (it ends " + we + ")");
  var hist = ttHistory(scope, ws, we, pm), byShift = {};
  hist.forEach(function (h) { if (h.shift_id) (byShift[h.shift_id] = byShift[h.shift_id] || []).push(h); });
  people.forEach(function (p) { p.days.forEach(function (d) { d.shifts.forEach(function (sh) { if (byShift[sh.id]) sh.hist = byShift[sh.id].slice(0, 5); }); }); });
  return { week: { start: ws, end: we, status: per.status, version: num(per.version), closed_by: per.closed_by ? personName(per.closed_by) : "", closed_at: per.closed_at || "", history: parseJson(per.history, []) },
    people: people, corrections: cors, cases: cases, can_close: !!(pm.accounting && pm.period_close), blockers: blockers, rules: TT_RULES, today: ttDayOf(ttNow()), perms: pm,
    log: hist.filter(function (h) { var d = String(h.at).slice(0, 10); return h.in_week || (d >= ws && d <= ttAddDays(we, 7)); }).slice(0, 60), can_purge: me.role === "admin" && !me.preview };
}
/* Who did what to the hours, newest first: the person (name + avatar), when, what, and their reason. Pay rates never show here. */
function ttHistory(scope, ws, we, pm) {
  var ppl = {}; rows("People").forEach(function (p) { ppl[normEmail(p.email)] = p; });
  var cors = {}; rows("TtCorrections").forEach(function (c) { cors[c.id] = c; });
  var cases = {}; rows("TtPresence").forEach(function (c) { cases[c.id] = c; });
  var shiftDay = {}; scope.forEach(function (emp) { ttShifts(ttEvents(emp)).forEach(function (s) { if (s.day >= ws && s.day <= we) shiftDay[s.id] = s.day; }); });
  var SAY = { presence_accept: "accepted a check-in", presence_reject: "rejected a check-in", correction_approved: "approved a correction", correction_requested: "asked for a correction", correction_withdrawn: "withdrew a correction",
    correction_answered: "answered a question about a correction", decision_questioned: "questioned a decision", week_approved: "approved the week", absence: "recorded an absence", crew_access: "gave phone access",
    person_settings: "changed clock settings", confirm: "confirmed their week", presence_explained: "explained a check-in", clock_for: "clocked in for someone", shift_purged: "permanently deleted a shift",
    device_trust: "approved a phone", device_block: "blocked a phone", device_remove: "removed a phone" };
  var out = [];
  rows("TtAudit").forEach(function (a) {
    if (scope.indexOf(a.emp) < 0 || a.kind === "pay_rate" || a.kind === "meal_answer") return;
    var what = SAY[a.kind] || "", sid = "", delta = null;
    if (a.kind === "admin_edit" || /^correction_/.test(a.kind)) {
      var c = cors[a.ref] || {}, ch = parseJson(c.changes, []), ops = ch.map(function (x) { return x.op + (x.op === "add" ? ":" + x.kind : ""); });
      sid = c.shift_id || (ch.filter(function (x) { return x.shift_id; })[0] || {}).shift_id || ""; delta = c.delta_min !== "" && c.delta_min != null ? num(c.delta_min) : null;
      if (a.kind === "admin_edit") what = ops.length && ops.every(function (o) { return o === "void"; }) ? "deleted a shift" : ops.length && ops.every(function (o) { return o === "restore"; }) ? "restored a shift"
        : ops.indexOf("add:in") > -1 ? "added a shift" : ops.length === 1 && ops[0] === "add:out" ? "added the check-out" : ops.every(function (o) { return o === "move"; }) ? "changed the times" : "edited the hours";
    } else if (/^presence_/.test(a.kind)) sid = (cases[a.ref] || {}).shift_id || "";
    else if (a.kind === "shift_purged") sid = a.ref;
    if (!what) return;
    var by = ppl[normEmail(a.by)] || {}, emp = ppl[a.emp] || {};
    out.push({ id: a.id, at: a.at, by: by.name || a.by, key: by.email ? pkey(by.email) : "", avatar: by.avatar || "", role: by.role || "", emp: a.emp, emp_name: emp.name || a.emp, kind: a.kind, what: what, note: a.note || "",
      shift_id: sid, in_week: !!(sid && shiftDay[sid]), delta: delta });
  });
  return out.sort(function (x, y) { return String(y.at).localeCompare(String(x.at)); });
}
/* The map, the addresses and the phones of one check-in, only when the office asks for them. */
ACTIONS.ttCaseDetail = function (me, b) {
  var c = findBy("TtPresence", "id", String(b.id || "")); if (!c) throw new Error("Case not found.");
  if (!ttPerms(me).time_review || ttScope(me).indexOf(c.emp) < 0) throw new Error("You can't review this person's hours.");
  var o = ttCaseOut(c, true); o.can_decide = o.open && c.emp !== normEmail(me.email); return { case: o };
};
/* Permanently delete a shift (admin only): for test check-ins and real mistakes. The records are removed; a line in the
   history keeps who deleted what, when and why. Not allowed in a week already closed for payroll (delete it there instead, it stays on file). */
ACTIONS.ttPurgeShift = function (me, b) {
  if (me.role !== "admin" || me.preview) throw new Error("Only the admin permanently deletes hours.");
  var emp = normEmail(b.emp), sid = String(b.shift_id || ""), why = clean(b.explain, 500);
  if (why.length < 5) throw new Error("Write the reason for deleting it permanently.");
  var sh = ttShifts(ttEvents(emp)).filter(function (s) { return s.id === sid; })[0]; if (!sh) throw new Error("That shift wasn't found.");
  var per = findBy("TtPeriods", "id", ttWeekStart(sh.day)); if (per && per.status === "closed") throw new Error("That week is closed for payroll. Use Delete (it stays on file) instead.");
  var evIds = {}; rows("TtEvents").forEach(function (e) { if (e.emp === emp && e.shift_id === sid) evIds[e.id] = 1; });
  var summary = { day: sh.day, start: ttIso(sh.start), end: sh.end != null ? ttIso(sh.end) : "", paid_min: ttMin(sh.paid || 0), places: sh.segs.map(function (g) { return g.ref_name || ""; }).filter(Boolean), events: Object.keys(evIds).length };
  removeWhere("TtEvents", function (e) { return evIds[e.id] || (e.emp === emp && e.shift_id === sid); });
  removeWhere("TtPresence", function (c) { return c.emp === emp && c.shift_id === sid; });
  removeWhere("TtMeals", function (m) { return m.emp === emp && m.shift_id === sid; });
  ttAudit(me, emp, "shift_purged", sid, summary, null, why);
  return { purged: summary };
};
function ttReviewUnused() {}
function ttCloseBlockers(people) {
  var out = []; people.forEach(function (p) {
    if (!p.paid_min && !p.open_shifts && !p.pending && !p.presence_open) return;            // nothing worked this week: nothing to approve
    if (p.open_shifts) out.push(p.name + ": a shift is still open"); if (p.pending) out.push(p.name + ": " + p.pending + " correction(s) to decide");
    if (p.presence_open) out.push(p.name + ": " + p.presence_open + " check-in(s) pending validation");
    if (!p.approval || !p.approval.valid) out.push(p.name + ": hours not approved" + (p.approval && !p.approval.valid ? " (changed after approval)" : ""));
  }); return out;
}
ACTIONS.ttApprove = function (me, b) {
  var emp = normEmail(b.emp), ws = ttWeekStart(String(b.week || "")), self = normEmail(me.email);
  if (!ttCanReview(me, emp)) throw new Error("You can't review this person's hours."); if (emp === self) throw new Error("Nobody approves their own hours. Another reviewer has to.");
  var w = ttWeekOf(emp, ws, true); if (w.week.status === "closed") throw new Error("That week is already closed.");
  if (w.open_shifts) throw new Error("A shift is still open. Resolve the check-out first.");
  if (w.corrections.some(function (c) { return c.period_id === ws && (c.status === "pending" || c.status === "needs_info"); })) throw new Error("Decide the corrections first.");
  if (w.exceptions.some(function (x) { return x.kind === "presence"; })) throw new Error("Decide the check-ins pending validation first.");
  if (ttWeekStart(ttDayOf(ttNow())) === ws && !b.mid_week) throw new Error("The week isn't over yet.");
  var all = ttShifts(ttEvents(emp)), inWeek = all.filter(function (s) { return s.day >= ws && s.day <= w.week.end; }), hash = ttHash(w.days, inWeek), k = ws + "|" + emp, wk = findBy("TtWeeks", "key", k);
  var h = parseJson(wk && wk.history, []); h.push({ at: ttIso(ttNow()), by: self, what: "approved", paid_min: w.totals.paid_min });
  var patch = { approved_by: self, approved_at: ttIso(ttNow()), approved_hash: hash, history: JSON.stringify(h) };
  if (wk) update("TtWeeks", "key", k, patch); else insert("TtWeeks", Object.assign({ key: k, period_id: ws, emp: emp, emp_status: "", emp_note: "", emp_at: "" }, patch));
  ttAudit(me, emp, "week_approved", k, null, { paid_min: w.totals.paid_min, reg: w.calc.reg, ot: w.calc.ot, dt: w.calc.dt }, "");
  return { ok: true, unconfirmed: !w.confirm };
};
ACTIONS.ttClose = function (me, b) {
  var pm = ttPerms(me); if (!pm.accounting || !pm.period_close) throw new Error("Only accounting closes a week.");
  var ws = ttWeekStart(String(b.week || "")), we = ttAddDays(ws, 6); if (we >= ttDayOf(ttNow())) throw new Error("The week isn't over yet.");
  var per = findBy("TtPeriods", "id", ws); if (per && per.status === "closed") throw new Error("Already closed.");
  var r = ACTIONS.ttReview(me, { week: ws }), bl = r.blockers; if (bl.length) throw new Error("Not ready to close: " + bl.slice(0, 4).join("; ") + (bl.length > 4 ? " (+" + (bl.length - 4) + " more)" : ""));
  var snap = r.people.map(function (p) { return { emp: p.emp, paid_min: p.paid_min, reg: p.reg, ot: p.ot, dt: p.dt, confirm: p.confirm ? p.confirm.status : "not confirmed" }; });
  var h = parseJson(per && per.history, []); h.push({ at: ttIso(ttNow()), by: me.email, what: "closed", version: 1 });
  var row = { id: ws, start: ws, end: we, status: "closed", version: "1", closed_by: me.email, closed_at: ttIso(ttNow()), rules: TT_RULES.v, snapshot: JSON.stringify(snap), history: JSON.stringify(h) };
  if (per) update("TtPeriods", "id", ws, row); else insert("TtPeriods", row);
  ttAudit(me, "", "week_closed", ws, null, snap, ""); return { ok: true, people: snap.length };
};
/* ---- admin settings: explicit permissions, supervisor, pay type; absences ---- */
ACTIONS.ttSetPerson = function (me, b) {
  if (me.role !== "admin" || me.preview) throw new Error("Only Jesús changes time permissions.");
  var e = normEmail(b.email), p = findPerson(e); if (!p || !isTeam(p)) throw new Error("Pick someone on the team.");
  var patch = {};
  if (b.perms != null) patch.perms = [].concat(b.perms).filter(function (k) { return TT_PERMS.indexOf(k) > -1; }).join(",");
  if (b.supervisor != null) { var s = normEmail(b.supervisor); if (s && (!findPerson(s) || s === e)) throw new Error("Pick a different supervisor."); patch.supervisor = s; }
  if (b.pay_type != null) { if (["hourly", "exempt", ""].indexOf(b.pay_type) < 0) throw new Error("Pay type: hourly or exempt."); patch.pay_type = b.pay_type; }
  if (b.clock != null) patch.clock = b.clock ? "yes" : "no";
  if (b.crew_level != null) { if (p.role !== "crew") throw new Error("Only #crew have a level."); patch.crew_level = b.crew_level === "labor" ? "labor" : "supervisor"; }
  ttAudit(me, e, "person_settings", e, { perms: p.perms, supervisor: p.supervisor, pay_type: p.pay_type, clock: p.clock }, patch, ""); update("People", "email", e, patch);
  try { CacheService.getScriptCache().remove("who:" + e); } catch (x) {}
  return { ok: true };
};
/* Jesús's settings screen: who has the clock, explicit permissions, supervisor and pay type, per person. */
ACTIONS.ttSettings = function (me, b) {
  if (me.role !== "admin" || me.preview) throw new Error("Only Jesús changes time settings.");
  if (b.all != null) { PropertiesService.getScriptProperties().setProperty("TT_ALL", b.all ? "yes" : "no"); ttAudit(me, "", "clock_for_everyone", "", null, { all: !!b.all }, ""); }
  return { all: ttAll(), week_start: ttCfg().week_start, perms: TT_PERMS, people: ttTeam().map(function (p) {
    return { email: normEmail(p.email), name: p.name, role: p.role, admin: p.role === "admin", clock: ttEnabled(p), perms: splitIds(p.perms), supervisor: normEmail(p.supervisor), pay_type: p.pay_type || "",
      crews: ttCrewsOf(normEmail(p.email)).map(function (c) { return c.name; }), phone: ttPhone(p.phone), crew_level: p.role === "crew" ? (ttIsLabor(p) ? "labor" : "supervisor") : "", has_pin: !!p.pin_hash, devices: ttDevicesOf(normEmail(p.email)) };
  }) };
};
ACTIONS.ttSetAbsence = function (me, b) {
  var e = normEmail(b.emp); if (!ttCanReview(me, e)) throw new Error("You can't manage this person's absences.");
  var f = String(b.from || ""), t = String(b.to || f); if (!/^\d{4}-\d\d-\d\d$/.test(f) || !/^\d{4}-\d\d-\d\d$/.test(t) || t < f) throw new Error("Pick the dates.");
  var row = { id: newId("tb"), emp: e, from: f, to: t, kind: ["vacation", "sick", "off", "other"].indexOf(b.kind) > -1 ? b.kind : "off", note: clean(b.note, 300), by: me.email, at: ttIso(ttNow()) };
  insert("TtAbsence", row); ttAudit(me, e, "absence", row.id, null, row, ""); return { ok: true };
};
/* Items for the office's Today queue (reviewers only), last 14 days. */
function ttTodayItems(me) {
  if (!ttPerms(me).time_review) return [];
  var to = ttDayOf(ttNow()), from = ttAddDays(to, -14), out = [];
  ttScope(me).forEach(function (emp) { var evs = ttEvents(emp); ttExc(emp, ttShifts(evs), from, to, evs).forEach(function (x) {
    if (x.kind === "overtime") return;                        // shown in the weekly review, not in the daily queue
    out.push({ key: "tt:" + x.key, kind: "time", area: "time", priority: x.priority, title: x.title + " · " + x.name, sub: "Hours · " + x.day, why: x.why, next: x.next, owner: x.owner, since: x.day + " 00:00", link: { type: "time", emp: emp, week: ttWeekStart(x.day), case_id: x.case_id || "" } });
  }); });
  return out;
}
if (typeof tdItems === "function") { var ttTd0 = tdItems; tdItems = function (me) { return ttTd0(me).concat(ttTodayItems(me)); }; }
if (PREFETCH.todayQueue) PREFETCH.todayQueue = PREFETCH.todayQueue.concat(TT_T.filter(function (t) { return PREFETCH.todayQueue.indexOf(t) < 0; }));
["ttState", "ttGeoTest", "ttSettings", "ttDevice", "ttCrewAccess", "ttAdminEdit", "ttPunch", "ttPresenceExplain", "ttPresenceDecide", "ttPresenceDecideMany", "ttCaseDetail", "ttPurgeShift", "ttMeal", "ttSetLang", "ttMyWeek", "ttConfirmWeek", "ttRequestCorrection", "ttDecide", "ttReply", "ttSeen", "ttReview", "ttApprove", "ttClose", "ttSetPerson", "ttSetAbsence"].forEach(function (a) { PREFETCH[a] = TT_READ; });
NO_LOCK.ttState = 1; NO_LOCK.ttMyWeek = 1; NO_LOCK.ttReview = 1; NO_LOCK.ttGeoTest = 1; READ_ONLY.ttState = 1;
NO_LOCK.ttCaseDetail = 1; PREFETCH.ttReview = ["People"];   // the dashboard reads the time tables itself, only when its cached copy is gone   // read-only: also what lets Jesús preview the crew screen

/* ======================================================================================================
   Job costing: what each project really costs, line by line, in one place.
   - #pm (crew supervisors on the project) and the team log costs against the contract's lines: amount, vendor, date,
     how it was paid. Each entry keeps who logged it and when; nothing is ever edited in place.
   - Accounting (#money or the "accounting" hours permission) checks each one against the card / bank / bill and approves
     or rejects it. Approving can also put the matching QuickBooks charge on this job (the same logged, undoable change
     as Finances → Spending). Nothing here moves money.
   - Labor comes from the hours: approved weeks × each person's pay rate (overtime and double time included, shared by
     the time spent on each job). Hours not approved yet show as hours only.
   #labor never sees any of this. Contract amounts follow "Who sees Contract & billing"; pay rates and labor dollars only
   for #money / "pay_view".
   ====================================================================================================== */
TABLES.JobCosts = ["id", "project_id", "line_id", "kind", "vendor", "amount", "date", "paid_with", "notes", "status", "by", "at", "reviewed_by", "reviewed_at", "review_note", "qb_type", "qb_id", "qb_log"];
TABLES.People = TABLES.People.concat(["pay_rate", "pin_temp"]);   // pin_temp: until when the office's welcome code works (then they pick their own PIN)
var JC_KINDS = { materials: "Materials", subs: "Subcontractor", equipment: "Equipment / rental", disposal: "Dump / disposal", permits: "Permits / fees", other: "Other" };
var JC_PAID = { card: "Company card", bank: "Bank / ACH", check: "Check", cash: "Cash (reimburse)", bill: "Vendor bill (to pay)" };
function jcReviewer(me) { return !!me && !me.preview && (canMoney(me) || !!ttPerms(me).accounting); }
function jcLaborMoney(me) { return !!me && !me.preview && (canMoney(me) || !!ttPerms(me).pay_view); }
function jcProj(me, pid) {
  if (!me || (me.role === "crew" && ttIsLabor(me))) throw new Error("No access.");
  if (!isStaff(me) && me.role !== "crew") throw new Error("No access.");
  var p = findBy("Projects", "id", String(pid || "")); if (!p || p.status === "deleted" || !canSee(me, p.id)) throw new Error("No access.");
  return p;
}
/* Labor on one project from the hours: per person, per week. Approved weeks get dollars; the rest stay as hours. */
function jcLabor(pid, withMoney) {
  var out = { approved_min: 0, pending_min: 0, cost: 0, people: [] };
  ttTeam().forEach(function (who) {
    var emp = normEmail(who.email), evs = ttEvents(emp); if (!evs.length) return;
    var weeks = {};
    ttShifts(evs).forEach(function (s) {
      if (!ttCounts(s)) return;
      s.segs.forEach(function (g) { var ws = ttWeekStart(ttDayOf(g.from)), w = weeks[ws] = weeks[ws] || { all: 0, job: 0 }; w.all += g.to - g.from; if (g.ref_type === "project" && String(g.ref_id) === String(pid)) w.job += g.to - g.from; });
    });
    var rate = num(who.pay_rate), mine = { name: who.name || emp, approved_min: 0, pending_min: 0, cost: 0, rate_missing: !rate };
    Object.keys(weeks).forEach(function (ws) {
      var w = weeks[ws]; if (!w.job) return;
      var wk = ttWeekOf(emp, ws, true), ok = wk.approval && wk.approval.valid, share = w.all ? w.job / w.all : 0;
      if (!ok) { mine.pending_min += ttMin(w.job); return; }
      mine.approved_min += ttMin(w.job);
      var c = wk.calc || {}, pay = rate * ((num(c.reg) + 1.5 * num(c.ot) + 2 * num(c.dt)) / 60);
      mine.cost += pay * share;
    });
    if (!mine.approved_min && !mine.pending_min) return;
    mine.cost = cents(mine.cost); out.approved_min += mine.approved_min; out.pending_min += mine.pending_min; out.cost += mine.cost;
    if (!withMoney) { delete mine.cost; delete mine.rate_missing; }
    out.people.push(mine);
  });
  out.cost = cents(out.cost); if (!withMoney) delete out.cost;
  out.people.sort(function (a, b) { return b.approved_min + b.pending_min - a.approved_min - a.pending_min; });
  return out;
}
function jcLinesOf(pid) {
  return rows("ContractLines").filter(function (l) { return l.project_id === pid && l.status !== "rejected"; })
    .sort(function (a, c) { return a.kind !== c.kind ? (a.kind === "base" ? -1 : 1) : num(a.sort) - num(c.sort); });
}
function jcCostOut(c, me, lines) {
  var l = lines[c.line_id] || null;
  return { id: c.id, line_id: c.line_id || "", line: l ? (l.number ? l.number + " · " : "") + l.title : "General (no line)", kind: c.kind, kind_label: JC_KINDS[c.kind] || c.kind, vendor: c.vendor, amount: num(c.amount),
    date: c.date, paid_with: c.paid_with, paid_label: JC_PAID[c.paid_with] || c.paid_with, notes: c.notes, status: c.status, by: personName(c.by), at: c.at, mine: normEmail(c.by) === normEmail(me.email),
    reviewed_by: c.reviewed_by ? personName(c.reviewed_by) : "", reviewed_at: c.reviewed_at || "", review_note: c.review_note || "", qb: c.qb_id ? { type: c.qb_type, id: c.qb_id } : null };
}
ACTIONS.jcProject = function (me, b) {
  var p = jcProj(me, b.projectId), bill = canBill(me, p), review = jcReviewer(me), labor$ = jcLaborMoney(me);
  var lines = jcLinesOf(p.id), byId = {}; lines.forEach(function (l) { byId[l.id] = l; });
  var costs = rows("JobCosts").filter(function (c) { return c.project_id === p.id; }).sort(function (a, c) { return String(c.at).localeCompare(String(a.at)); });
  var roll = {}; costs.forEach(function (c) { var k = byId[c.line_id] ? c.line_id : ""; var r = roll[k] = roll[k] || { approved: 0, pending: 0 }; if (c.status === "approved") r.approved += num(c.amount); else if (c.status === "submitted") r.pending += num(c.amount); });
  var outLines = lines.map(function (l) { var r = roll[l.id] || { approved: 0, pending: 0 }, o = { id: l.id, number: l.number || "", title: l.title, kind: l.kind, approved: cents(r.approved), pending: cents(r.pending) };
    if (bill) { o.amount = num(l.amount); o.left = cents(o.amount - r.approved); } return o; });
  var gen = roll[""] || { approved: 0, pending: 0 }, lab = jcLabor(p.id, labor$);
  var tot = { approved: cents(costs.reduce(function (a, c) { return a + (c.status === "approved" ? num(c.amount) : 0); }, 0)), pending: cents(costs.reduce(function (a, c) { return a + (c.status === "submitted" ? num(c.amount) : 0); }, 0)) };
  if (labor$) tot.labor = lab.cost;
  if (bill) { tot.contract = cents(lines.reduce(function (a, l) { return a + (l.kind === "base" || l.status === "approved" ? num(l.amount) : 0); }, 0)); if (labor$) tot.margin = cents(tot.contract - tot.approved - tot.labor); }
  return { project: { id: p.id, name: p.name, qb: !!p.qb_customer }, can: { add: !me.preview, review: review, contract: bill, labor_money: labor$ }, kinds: JC_KINDS, paid: JC_PAID,
    lines: outLines, general: { approved: cents(gen.approved), pending: cents(gen.pending) }, labor: lab, totals: tot, costs: costs.map(function (c) { return jcCostOut(c, me, byId); }),
    qb_connected: review && typeof qbCfg === "function" ? !!qbCfg().refresh : false };
};
ACTIONS.jcAdd = function (me, b) {
  if (me.preview) throw new Error("You're in preview. Exit the preview to change things.");
  var p = jcProj(me, b.projectId), f = b.cost || {}, amt = cents(f.amount);
  if (!(amt > 0) || amt > 5e6) throw new Error("Enter the amount.");
  var line = String(f.line_id || ""); if (line && !jcLinesOf(p.id).some(function (l) { return l.id === line; })) throw new Error("Pick a line of this project's contract.");
  var kind = JC_KINDS[f.kind] ? f.kind : "other", paid = JC_PAID[f.paid_with] ? f.paid_with : "";
  var d = dateOrEmpty(f.date) || ttDayOf(ttNow()); if (d > ttDayOf(ttNow())) throw new Error("The date can't be in the future.");
  var vendor = clean(f.vendor, 120); if (!vendor) throw new Error("Who was it paid to? (store, sub, rental…)");
  var row = { id: newId("jc"), project_id: p.id, line_id: line, kind: kind, vendor: vendor, amount: String(amt), date: d, paid_with: paid, notes: clean(f.notes, 500), status: "submitted", by: normEmail(me.email), at: ttIso(ttNow()),
    reviewed_by: "", reviewed_at: "", review_note: "", qb_type: "", qb_id: "", qb_log: "" };
  insert("JobCosts", row);
  return { id: row.id };
};
ACTIONS.jcDelete = function (me, b) {
  var c = findBy("JobCosts", "id", String(b.id || "")); if (!c) throw new Error("Not found.");
  jcProj(me, c.project_id);
  if (c.status !== "submitted" || (normEmail(c.by) !== normEmail(me.email) && me.role !== "admin")) throw new Error("Only a cost still waiting for accounting can be removed, by whoever logged it.");
  update("JobCosts", "id", c.id, { status: "withdrawn", reviewed_by: normEmail(me.email), reviewed_at: ttIso(ttNow()), review_note: "withdrawn" });
  return {};
};
/* Accounting: approve (optionally matching the QuickBooks charge and putting it on this job) or reject with a reason. */
ACTIONS.jcReview = function (me, b) {
  if (!jcReviewer(me)) throw new Error("Accounting approves costs (#money).");
  var c = findBy("JobCosts", "id", String(b.id || "")); if (!c) throw new Error("Not found.");
  var p = findBy("Projects", "id", c.project_id); if (!p) throw new Error("Project not found.");
  if (c.status !== "submitted" && !(b.decision === "approve" && c.status === "approved" && b.qb_id && !c.qb_id)) throw new Error("Already " + c.status + ".");
  if (normEmail(c.by) === normEmail(me.email) && me.role !== "admin") throw new Error("Someone else approves the costs you logged.");
  var note = clean(b.note, 300), patch = { reviewed_by: normEmail(me.email), reviewed_at: ttIso(ttNow()), review_note: note };
  if (b.decision === "reject") { if (note.length < 3) throw new Error("Say why (e.g. not on the card, wrong job)."); patch.status = "rejected"; update("JobCosts", "id", c.id, patch); return { status: "rejected" }; }
  if (b.decision !== "approve") throw new Error("Approve or reject.");
  patch.status = "approved";
  if (b.qb_id) {
    var type = String(b.qb_type || ""), id = String(b.qb_id); if (!QB_PATH[type] || !/^\d{1,15}$/.test(id)) throw new Error("Pick the QuickBooks charge.");
    var dup = rows("JobCosts").filter(function (x) { return x.id !== c.id && x.qb_type === type && x.qb_id === id && x.status === "approved"; })[0];
    if (dup && !b.qb_line) throw new Error("That QuickBooks charge is already matched to another cost.");
    var r = ACTIONS.qbAssign(me, { type: type, id: id, lines: b.qb_line ? [String(b.qb_line)] : [], projectId: p.id });
    patch.qb_type = type; patch.qb_id = id; patch.qb_log = r.logId || "";
  }
  update("JobCosts", "id", c.id, patch);
  return { status: "approved", qb: !!patch.qb_id };
};
/* QuickBooks charges that look like this cost: same amount (±2%), within 2 weeks. */
ACTIONS.jcMatches = function (me, b) {
  if (!jcReviewer(me)) throw new Error("Accounting approves costs (#money).");
  var c = findBy("JobCosts", "id", String(b.id || "")); if (!c) throw new Error("Not found.");
  if (typeof qbCfg !== "function" || !qbCfg().refresh) return { connected: false, rows: [] };
  qbCheck();
  var amt = num(c.amount), d0 = new Date(c.date + "T12:00:00Z").getTime(), p = findBy("Projects", "id", c.project_id) || {};
  var used = {}; rows("JobCosts").forEach(function (x) { if (x.qb_id && x.id !== c.id && x.status === "approved") used[x.qb_type + ":" + x.qb_id] = 1; });
  var list = qbSpendRows(120).filter(function (r) { var dd = Math.abs(new Date(r.date + "T12:00:00Z").getTime() - d0) / 864e5; return dd <= 14 && Math.abs(r.amount - amt) <= Math.max(1, amt * 0.02); })
    .map(function (r) { return Object.assign({}, r, { used: !!used[r.type + ":" + r.id], here: !!(p.qb_customer && r.cust === p.qb_customer), days: Math.round(Math.abs(new Date(r.date + "T12:00:00Z").getTime() - d0) / 864e5) }); })
    .sort(function (a, b2) { return (a.used - b2.used) || (Math.abs(a.amount - amt) - Math.abs(b2.amount - amt)) || (a.days - b2.days); });
  return { connected: true, rows: list.slice(0, 8) };
};
/* Finances: every active project, contract vs. what it has cost so far. */
ACTIONS.jcSummary = function (me) {
  if (!jcReviewer(me) && me.role !== "admin") throw new Error("That's #money.");
  var costs = rows("JobCosts"), labor$ = jcLaborMoney(me);
  var list = rows("Projects").filter(function (p) { return p.status === "active"; }).map(function (p) {
    var lines = jcLinesOf(p.id), mine = costs.filter(function (c) { return c.project_id === p.id; }), lab = jcLabor(p.id, labor$);
    var o = { id: p.id, name: p.name, contract: cents(lines.reduce(function (a, l) { return a + (l.kind === "base" || l.status === "approved" ? num(l.amount) : 0); }, 0)),
      approved: cents(mine.reduce(function (a, c) { return a + (c.status === "approved" ? num(c.amount) : 0); }, 0)), pending: cents(mine.reduce(function (a, c) { return a + (c.status === "submitted" ? num(c.amount) : 0); }, 0)),
      to_review: mine.filter(function (c) { return c.status === "submitted"; }).length, labor_min: lab.approved_min, labor_pending_min: lab.pending_min };
    if (labor$) { o.labor = lab.cost; o.spent = cents(o.approved + o.labor); o.left = cents(o.contract - o.spent); }
    return o;
  }).filter(function (o) { return o.contract || o.approved || o.pending || o.labor_min || o.labor_pending_min; });
  return { projects: list, labor_money: labor$ };
};
/* Pay rates: Jesús or whoever has "pay_rates". Only #money / "pay_view" ever see them. */
ACTIONS.jcSetRate = function (me, b) {
  if (me.preview || !ttPerms(me).pay_rates) throw new Error("Only Jesús (or someone with the pay rates permission) sets pay rates.");
  var e = normEmail(b.email), p = findPerson(e); if (!p || !isTeam(p)) throw new Error("Pick someone on the team.");
  var r = String(b.rate == null ? "" : b.rate).trim(), v = r === "" ? "" : String(cents(r)); if (v !== "" && !(num(v) > 0 && num(v) < 1000)) throw new Error("Hourly rate between $1 and $999.");
  ttAudit(me, e, "pay_rate", e, { pay_rate: p.pay_rate ? "set" : "" }, { pay_rate: v ? "set" : "" }, "");
  update("People", "email", e, { pay_rate: v });
  return { ok: true };
};
ACTIONS.jcRates = function (me) {
  if (me.preview || !(ttPerms(me).pay_rates || ttPerms(me).pay_view)) throw new Error("That's for pay rates.");
  return { can_set: !!ttPerms(me).pay_rates, people: ttTeam().filter(function (p) { return p.role !== "admin"; }).map(function (p) { return { email: normEmail(p.email), name: p.name, role: p.role, level: p.role === "crew" ? (ttIsLabor(p) ? "labor" : "pm") : "team", pay_type: p.pay_type || "hourly", rate: p.pay_rate ? num(p.pay_rate) : null }; }) };
};
/* Today: accounting sees the costs waiting for them, one item per project. */
function jcTodayItems(me) {
  if (!jcReviewer(me)) return [];
  var by = {}; rows("JobCosts").forEach(function (c) { if (c.status === "submitted" && normEmail(c.by) !== normEmail(me.email)) (by[c.project_id] = by[c.project_id] || []).push(c); });
  return Object.keys(by).map(function (pid) {
    var l = by[pid], p = findBy("Projects", "id", pid) || { name: "Project" }, tot = l.reduce(function (a, c) { return a + num(c.amount); }, 0), first = l.map(function (c) { return c.at; }).sort()[0];
    return { key: "jc:" + pid, kind: "money", area: "money", priority: 2, title: l.length + " cost" + (l.length > 1 ? "s" : "") + " to verify · " + p.name, sub: "Job costing · $" + cents(tot).toFixed(2),
      why: "Logged by the PM. Check them against the card, bank or bill before they count.", next: "Approve or reject", owner: me.email, since: String(first || "").slice(0, 16).replace("T", " "), link: { type: "costs", projectId: pid } };
  });
}
if (typeof tdItems === "function") { var jcTd0 = tdItems; tdItems = function (me) { return jcTd0(me).concat(jcTodayItems(me)); }; }
if (PREFETCH.todayQueue && PREFETCH.todayQueue.indexOf("JobCosts") < 0) PREFETCH.todayQueue = PREFETCH.todayQueue.concat(["JobCosts", "ContractLines"]);
["jcProject", "jcAdd", "jcDelete", "jcReview", "jcMatches", "jcSummary", "jcSetRate", "jcRates"].forEach(function (a) { PREFETCH[a] = TT_READ.concat(["JobCosts", "ContractLines"]); });
NO_LOCK.jcProject = 1; NO_LOCK.jcSummary = 1; NO_LOCK.jcRates = 1; NO_LOCK.jcMatches = 1; READ_ONLY.jcProject = 1;
