/* ======================================================================================================
   Landscape maintenance: properties with a maintenance agreement, crews, recurring visits (work orders),
   crew time and expenses, client issue reports. Three kinds of people:
     office  = admin and project managers (staff). Money (rates, costs, margins) only for admin + #money.
     crew    = anyone listed on a maintenance crew. Sees only their crew's stops, never prices or rates.
     client  = a person whose email is on a property. Sees only their own properties, reports and requests.
   Every rule here is enforced on the server; the screens only reflect it.
   Visits are real rows. Recurring ones are generated a few weeks ahead from the agreement; moving one visit
   never touches the rest of the series ("plan_date" remembers where it came from so it isn't generated twice).
   ====================================================================================================== */
TABLES.LsProps = ["id", "name", "client_name", "client_emails", "address", "city", "lat", "lon", "contacts", "access", "notes", "features", "crew_id", "freq", "weekday", "start", "visit_min",
  "price", "billing", "included", "excluded", "status", "created_at", "sample", "checklist"];
TABLES.LsCrews = ["id", "name", "members", "lead", "color", "skills", "hours", "sample"];
TABLES.LsVisits = ["id", "property_id", "date", "plan_date", "series", "kind", "crew_id", "status", "reason", "stop", "est_min", "scope", "checklist", "notes", "problems",
  "photos_before", "photos_after", "materials", "labor", "travel_min", "started_at", "done_at", "done_by", "priority", "issue_id", "price", "sample", "updated_by", "updated_at"];
TABLES.LsIssues = ["id", "property_id", "at", "by_email", "by_name", "text", "photos", "urgency", "place", "status", "office_note", "visit_id", "source", "sample"];
TABLES.LsExpenses = ["id", "at", "date", "property_id", "visit_id", "category", "vendor", "amount", "note", "receipt", "by_email", "status", "sample"];
TABLES.LsRates = ["email", "rate", "updated_at"];
TABLES.LsLog = ["id", "at", "by", "kind", "ref", "text"];
var LS_TABLES = ["LsProps", "LsCrews", "LsVisits", "LsIssues", "LsExpenses", "LsRates", "LsLog"];
var LS_FREQ = { weekly: 7, biweekly: 14, monthly: 0, seasonal: 0, none: 0 };
var LS_STATUS = ["scheduled", "in_progress", "blocked", "completed", "canceled", "weather"];
var LS_EXP = ["materials", "fertilizer", "hauling", "disposal", "fuel", "equipment", "subcontractor", "other"];
var LS_DEFAULT_CHECK = ["Mow and edge lawn areas", "Blow walks, drive and patios", "Weed planting beds", "Check irrigation (leaks, broken heads)", "Prune as needed", "Remove green waste"];
["lsHome", "lsSaveProperty", "lsSaveCrew", "lsSaveVisit", "lsMoveVisits", "lsRoute", "lsVisitUpdate", "lsReportIssue", "lsTriage", "lsSaveExpense", "lsReviewExpense", "lsSetRate", "lsSeed", "lsClearSample", "lsProperty"].forEach(function (a) {
  PREFETCH[a] = ["People", "Projects"].concat(LS_TABLES);
});
NO_LOCK.lsHome = 1; NO_LOCK.lsProperty = 1; NO_LOCK.lsReportIssue = 1; NO_LOCK.lsSaveExpense = 1;

/* ---- who is who ---- */
function lsCrewsOf(me) { var e = normEmail(me.email); return rows("LsCrews").filter(function (c) { return splitIds(c.members).map(normEmail).indexOf(e) > -1 || normEmail(c.lead) === e; }); }
function lsClientProps(me) { var e = normEmail(me.email); return rows("LsProps").filter(function (p) { return p.status !== "deleted" && splitIds(p.client_emails).map(normEmail).indexOf(e) > -1; }); }
function lsRole(me) {
  if (me.preview) return me.preview === "client" ? "client" : me.preview === "crew" ? "crew" : "";
  if (isStaff(me)) return "office";
  if (lsCrewsOf(me).length) return "crew";
  if (lsClientProps(me).length) return "client";
  return "";
}
function lsMoney(me) { return lsRole(me) === "office" && canMoney(me); }
function lsNeedOffice(me) { if (lsRole(me) !== "office") throw new Error("Only the Blue Sierra office can do that."); }
function lsLog(me, kind, ref, text) { insert("LsLog", { id: newId("l"), at: now(), by: me.email, kind: kind, ref: ref, text: String(text).slice(0, 500) }); }
function lsProp(id) { var p = findBy("LsProps", "id", String(id || "")); if (!p || p.status === "deleted") throw new Error("Property not found."); return p; }
function lsCanSeeProp(me, p) {
  var role = lsRole(me); if (role === "office") return true;
  if (role === "client") return splitIds(p.client_emails).map(normEmail).indexOf(normEmail(me.email)) > -1;
  if (role === "crew") { var mine = lsCrewsOf(me).map(function (c) { return c.id; }); return mine.indexOf(p.crew_id) > -1 || rows("LsVisits").some(function (v) { return v.property_id === p.id && mine.indexOf(v.crew_id) > -1; }); }
  return false;
}
function lsCanWorkVisit(me, v) {
  var role = lsRole(me); if (role === "office") return true;
  if (role !== "crew") return false; return lsCrewsOf(me).some(function (c) { return c.id === v.crew_id; });
}
function lsFolder(p) {
  var pr = PropertiesService.getScriptProperties(), id = pr.getProperty("LS_FOLDER_ID"), root = null;
  try { if (id) { root = DriveApp.getFolderById(id); if (root.isTrashed()) root = null; } } catch (e) { root = null; }
  if (!root) { root = rootFolder().createFolder("Landscape maintenance"); pr.setProperty("LS_FOLDER_ID", root.getId()); }
  return root;
}
function lsSaveImages(p, list, label) {
  return (list || []).slice(0, 6).map(function (f) {
    var mime = String(f.mime || ""); if (!/^image\/(jpeg|png|webp)$/.test(mime) && mime !== "application/pdf") throw new Error("Photos must be JPG or PNG (receipts can be PDF).");
    var bytes = Utilities.base64Decode(String(f.data).replace(/^data:[^,]+,/, "")); if (bytes.length > 12 * 1024 * 1024) throw new Error("That file is too big.");
    var file = lsFolder(p).createFile(Utilities.newBlob(bytes, mime, (label + " · " + p.name + " · " + now()).replace(/[:]/g, "-") + (mime === "application/pdf" ? ".pdf" : ".jpg")));
    try { file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW); } catch (e) {}
    return file.getId();
  });
}
function lsPhotoOut(ids) { return parseJson(ids, []).map(function (id) { return { id: id, thumb: img(id, 600), full: img(id, 1800) }; }); }

/* ---- dates ---- */
function lsDay(d) { return Utilities.formatDate(d, CONFIG.TZ, "yyyy-MM-dd"); }
function lsParse(s) { var m = String(s || "").match(/^(\d{4})-(\d\d)-(\d\d)$/); return m ? new Date(+m[1], +m[2] - 1, +m[3], 12) : null; }
function lsAdd(s, days) { var d = lsParse(s); d.setDate(d.getDate() + days); return lsDay(d); }
/* The dates an agreement puts on the calendar between two days. Monthly = same weekday in the first full week; seasonal = first weekday of Mar, Jun, Sep, Dec. */
function lsPlanDates(p, from, to) {
  var out = [], start = lsParse(p.start) || lsParse(from), wds = lsWds(p, start), wd = wds[0], freq = p.freq || "none";
  if (freq === "none" || p.status !== "active") return out;
  var end = lsParse(to), begin = lsParse(from);
  if (freq === "weekly" || freq === "biweekly") {
    // Each service day runs its own cadence from the start date (e.g. an HOA done Tuesday to Friday).
    wds.forEach(function (w) {
      var d = new Date(start.getTime()); while (d.getDay() !== w) d.setDate(d.getDate() + 1);
      for (var step = LS_FREQ[freq]; d <= end; d.setDate(d.getDate() + step)) if (d >= begin) out.push(lsDay(d));
    });
    out.sort();
  } else {
    var months = freq === "monthly" ? [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11] : [2, 5, 8, 11];
    for (var y = begin.getFullYear(); y <= end.getFullYear(); y++) months.forEach(function (mo) {
      var x = new Date(y, mo, 1, 12); while (x.getDay() !== wd) x.setDate(x.getDate() + 1);
      if (x >= begin && x <= end && x >= start) out.push(lsDay(x));
    });
  }
  return out;
}
/* Put the next weeks of recurring visits on the calendar (never duplicates, never moves what someone moved). */
function lsEnsureVisits(until) {
  var today = lsDay(new Date()), have = {};
  rows("LsVisits").forEach(function (v) { if (v.series === "rec") have[v.property_id + "|" + v.plan_date] = 1; });
  var made = 0;
  rows("LsProps").forEach(function (p) {
    if (p.status !== "active") return;
    lsPlanDates(p, today, until).forEach(function (d) {
      if (have[p.id + "|" + d]) return;
      insert("LsVisits", { id: newId("v"), property_id: p.id, date: d, plan_date: d, series: "rec", kind: "maintenance", crew_id: p.crew_id || "", status: "scheduled", reason: "", stop: "",
        est_min: p.visit_min || "60", scope: "Recurring maintenance", checklist: JSON.stringify(parseJson(p.checklist, LS_DEFAULT_CHECK).map(function (t) { return { t: t, done: false }; })),
        notes: "", problems: "", photos_before: "", photos_after: "", materials: "", labor: "", travel_min: "", started_at: "", done_at: "", done_by: "", priority: "normal", issue_id: "", price: "", sample: p.sample || "", updated_by: "", updated_at: "" });
      have[p.id + "|" + d] = 1; made++;
    });
  });
  return made;
}

/* ---- money: how a visit is valued and what it cost ---- */
function lsRateOf(email) { var r = findBy("LsRates", "email", normEmail(email)); return r ? num(r.rate) : num(PropertiesService.getScriptProperties().getProperty("LS_DEFAULT_RATE") || 32); }
/* Service days: "2" or "2,3,4,5" (0 = Sunday). Empty = the start date's weekday. */
function lsWds(p, start) {
  var l = String(p.weekday == null ? "" : p.weekday).split(",").filter(function (x) { return /^[0-6]$/.test(x.trim()); }).map(Number);
  return l.length ? l : [(start || lsParse(p.start) || new Date()).getDay()];
}
function lsVisitsPerMonth(freq) { return { weekly: 52 / 12, biweekly: 26 / 12, monthly: 1, seasonal: 1 / 3 }[freq] || 1; }
/* Recurring revenue: the agreement price spread evenly over the visits it pays for. Extra work: its own price. */
function lsVisitRevenue(v, p) {
  if (v.kind !== "maintenance") return num(v.price);
  var price = num(p && p.price); if (!price) return 0;
  var b = (p && p.billing) || "monthly";
  if (b === "per_visit") return price;
  var perMonth = b === "monthly" ? price : b === "quarterly" ? price / 3 : b === "annual" ? price / 12 : price;
  return perMonth / (lsVisitsPerMonth(p.freq) * (p.freq === "weekly" || p.freq === "biweekly" ? lsWds(p).length : 1));
}
function lsLabor(v) { return parseJson(v.labor, []).filter(function (l) { return l && l.email; }); }
function lsLaborMin(v) { return lsLabor(v).reduce(function (a, l) { return a + num(l.min); }, 0); }
function lsLaborCost(v) { return lsLabor(v).reduce(function (a, l) { return a + num(l.min) / 60 * lsRateOf(l.email); }, 0); }
function lsMaterialsCost(v) { return parseJson(v.materials, []).reduce(function (a, m) { return a + num(m.cost); }, 0); }

/* ---- shaping for each kind of person ---- */
function lsPropOut(p, role, money) {
  var o = { id: p.id, name: p.name, client_name: p.client_name, address: p.address, city: p.city, lat: p.lat ? num(p.lat) : null, lon: p.lon ? num(p.lon) : null,
    access: p.access, notes: p.notes, features: parseJson(p.features, []), crew_id: p.crew_id, freq: p.freq, weekday: p.weekday, start: p.start, visit_min: num(p.visit_min),
    included: p.included, excluded: p.excluded, status: p.status, contacts: p.contacts, sample: isTrue(p.sample), checklist: parseJson(p.checklist, LS_DEFAULT_CHECK) };
  if (role === "office") { o.client_emails = p.client_emails; o.billing = p.billing; if (money) o.price = num(p.price); }
  if (role === "client") { o.price = num(p.price); o.billing = p.billing; delete o.notes; }          // the client sees their own agreement price, not our notes
  return o;
}
function lsVisitOut(v, role, money) {
  var o = { id: v.id, property_id: v.property_id, date: v.date, plan_date: v.plan_date, series: v.series, kind: v.kind, crew_id: v.crew_id, status: v.status, reason: v.reason, stop: num(v.stop),
    est_min: num(v.est_min), scope: v.scope, checklist: parseJson(v.checklist, []), notes: v.notes, problems: v.problems, before: lsPhotoOut(v.photos_before), after: lsPhotoOut(v.photos_after),
    started_at: v.started_at, done_at: v.done_at, priority: v.priority, issue_id: v.issue_id, sample: isTrue(v.sample) };
  if (role !== "client") { o.labor = lsLabor(v).map(function (l) { return { email: l.email, name: personName(l.email), min: num(l.min) }; }); o.labor_min = lsLaborMin(v); o.materials = parseJson(v.materials, []).map(function (m) { return money ? m : { item: m.item, qty: m.qty }; }); o.travel_min = num(v.travel_min); }
  if (role === "client") { delete o.reason; if (v.status !== "completed") { o.notes = ""; o.checklist = []; } }
  if (money) { var p = findBy("LsProps", "id", v.property_id); o.revenue = cents(lsVisitRevenue(v, p)); o.labor_cost = cents(lsLaborCost(v)); o.materials_cost = cents(lsMaterialsCost(v)); o.price = num(v.price); }
  else if (role === "office" && v.kind !== "maintenance") o.price = num(v.price);
  return o;
}
function lsIssueOut(i, role) {
  return { id: i.id, property_id: i.property_id, at: i.at, by_name: i.by_name, text: i.text, photos: lsPhotoOut(i.photos), urgency: i.urgency, place: i.place, status: i.status,
    office_note: role === "office" ? i.office_note : (["included", "billable", "scheduled", "closed", "correction"].indexOf(i.status) > -1 ? i.office_note : ""), visit_id: i.visit_id, source: i.source, sample: isTrue(i.sample) };
}

/* ---- the one call each screen makes ---- */
ACTIONS.lsHome = function (me, b) {
  var role = lsRole(me); if (!role) return { role: "" };
  var today = lsDay(new Date()), from = /^\d{4}-\d\d-\d\d$/.test(b.from || "") ? b.from : lsAdd(today, -7), to = /^\d{4}-\d\d-\d\d$/.test(b.to || "") ? b.to : lsAdd(today, 21);
  if (role !== "client") {
    var horizon = lsAdd(today, 35), latest = rows("LsVisits").filter(function (v) { return v.series === "rec"; }).reduce(function (a, v) { return v.plan_date > a ? v.plan_date : a; }, "");
    if (latest < lsAdd(today, 21) && rows("LsProps").some(function (p) { return p.status === "active" && p.freq && p.freq !== "none"; })) withLock(function () { _ROWS = {}; prefetch(["People", "Projects"].concat(LS_TABLES)); lsEnsureVisits(horizon); });
  }
  var money = lsMoney(me), props = rows("LsProps").filter(function (p) { return p.status !== "deleted" && lsCanSeeProp(me, p); }), pids = {};
  props.forEach(function (p) { pids[p.id] = 1; });
  var crews = role === "office" ? rows("LsCrews") : role === "crew" ? lsCrewsOf(me) : [], myCrews = crews.map(function (c) { return c.id; });
  var visits = rows("LsVisits").filter(function (v) {
    if (!pids[v.property_id]) return false;
    if (role === "crew" && myCrews.indexOf(v.crew_id) < 0) return false;
    if (role === "client") return v.status !== "canceled" && (v.date >= lsAdd(today, -120)) && v.date <= lsAdd(today, 45);
    return (v.date >= from && v.date <= to) || (v.date < today && ["scheduled", "in_progress", "blocked", "weather"].indexOf(v.status) > -1 && v.date >= lsAdd(today, -60));
  });
  var issues = rows("LsIssues").filter(function (i) { return pids[i.property_id] && (role !== "client" || splitIds(lsProp(i.property_id).client_emails).length); });
  if (role === "client") issues = issues.filter(function (i) { return normEmail(i.by_email) === normEmail(me.email) || i.source === "client"; });
  if (role === "crew") issues = issues.filter(function (i) { return ["new", "review", "scheduled"].indexOf(i.status) > -1; });
  var out = { role: role, money: money, today: today, from: from, to: to,
    props: props.map(function (p) { return lsPropOut(p, role, money); }),
    crews: crews.map(function (c) { var o = { id: c.id, name: c.name, color: c.color || "#2f6db0", members: splitIds(c.members).map(function (e) { return { email: role === "office" || role === "crew" ? e : "", name: personName(e) }; }), lead: role === "office" ? c.lead : "", skills: c.skills, hours: c.hours }; return o; }),
    visits: visits.map(function (v) { return lsVisitOut(v, role, money); }).sort(function (a, c) { return a.date < c.date ? -1 : a.date > c.date ? 1 : (a.stop || 99) - (c.stop || 99); }),
    issues: issues.map(function (i) { return lsIssueOut(i, role); }).sort(function (a, c) { return a.at < c.at ? 1 : -1; }) };
  if (role === "office") {
    out.people = rows("People").filter(function (x) { return isTrue(x.active) && ["admin", "staff", "crew"].indexOf(x.role) > -1; }).map(function (x) { return { email: x.email, name: x.name, role: x.role }; });
    out.clients = rows("People").filter(function (x) { return isTrue(x.active) && x.role === "client"; }).map(function (x) { return { email: x.email, name: x.name }; });
    out.expenses = rows("LsExpenses").filter(function (e) { return (e.date >= from && e.date <= to) || e.status === "pending"; }).map(function (e) {
      var o = { id: e.id, date: e.date, property_id: e.property_id, visit_id: e.visit_id, category: e.category, vendor: e.vendor, note: e.note, status: e.status, by: personName(e.by_email), receipt: e.receipt ? "https://drive.google.com/file/d/" + e.receipt + "/view" : "" };
      if (money) o.amount = num(e.amount); return o; });
    if (money) { out.rates = rows("LsRates").map(function (r) { return { email: r.email, name: personName(r.email), rate: num(r.rate) }; }); out.default_rate = lsRateOf("nobody@none"); out.stats = lsStats(from, to, props); }
  }
  if (role === "crew") out.me = { email: me.email, name: me.name };
  return out;
};
/* Revenue, labor, expenses and profit for a period, overall and per property. Recurring revenue is counted per
   completed visit (the agreement spread over its visits). Expenses tied to a visit or property count there once;
   expenses with neither are "shared costs", shown apart and never added to a property (no double counting). */
function lsStats(from, to, props) {
  var byProp = {}, tot = { revenue: 0, labor: 0, materials: 0, expenses: 0, shared: 0, visits: 0, labor_min: 0, est_min: 0 }, pmap = {};
  props.forEach(function (p) { pmap[p.id] = p; byProp[p.id] = { id: p.id, name: p.name, revenue: 0, labor: 0, materials: 0, expenses: 0, visits: 0, labor_min: 0, est_min: 0 }; });
  rows("LsVisits").forEach(function (v) {
    if (v.status !== "completed" || v.date < from || v.date > to || !byProp[v.property_id]) return;
    var bp = byProp[v.property_id], rev = lsVisitRevenue(v, pmap[v.property_id]), lab = lsLaborCost(v), mat = lsMaterialsCost(v), lm = lsLaborMin(v);
    bp.revenue += rev; bp.labor += lab; bp.materials += mat; bp.visits++; bp.labor_min += lm; bp.est_min += num(v.est_min);
    tot.revenue += rev; tot.labor += lab; tot.materials += mat; tot.visits++; tot.labor_min += lm; tot.est_min += num(v.est_min);
  });
  rows("LsExpenses").forEach(function (e) {
    if (e.status !== "approved" || e.date < from || e.date > to) return;
    var a = num(e.amount), pid = e.property_id || ((findBy("LsVisits", "id", e.visit_id) || {}).property_id);
    if (pid && byProp[pid]) { byProp[pid].expenses += a; tot.expenses += a; } else tot.shared += a;
  });
  var list = Object.keys(byProp).map(function (k) { var x = byProp[k]; x.profit = x.revenue - x.labor - x.materials - x.expenses; x.margin = x.revenue ? Math.round(x.profit / x.revenue * 100) : null;
    x.over = x.est_min ? Math.round((x.labor_min / x.est_min - 1) * 100) : null; ["revenue", "labor", "materials", "expenses", "profit"].forEach(function (f) { x[f] = cents(x[f]); }); return x; });
  tot.profit = tot.revenue - tot.labor - tot.materials - tot.expenses - tot.shared;
  ["revenue", "labor", "materials", "expenses", "shared", "profit"].forEach(function (f) { tot[f] = cents(tot[f]); });
  return { total: tot, props: list.filter(function (x) { return x.visits || x.expenses; }).sort(function (a, c) { return a.profit - c.profit; }),
    over: list.filter(function (x) { return x.visits >= 2 && x.over != null && x.over > 15; }).sort(function (a, c) { return c.over - a.over; }) };
}
ACTIONS.lsProperty = function (me, b) {
  var p = lsProp(b.id); if (!lsCanSeeProp(me, p)) throw new Error("Property not found.");
  var role = lsRole(me), money = lsMoney(me);
  var visits = rows("LsVisits").filter(function (v) { return v.property_id === p.id && (role !== "client" || v.status !== "canceled"); }).sort(function (a, c) { return a.date < c.date ? 1 : -1; }).slice(0, 60);
  return { prop: lsPropOut(p, role, money), visits: visits.map(function (v) { return lsVisitOut(v, role, money); }), issues: rows("LsIssues").filter(function (i) { return i.property_id === p.id && (role !== "client" || i.source === "client"); }).map(function (i) { return lsIssueOut(i, role); }).reverse(),
    log: role === "office" ? rows("LsLog").filter(function (l) { return l.ref === p.id || visits.some(function (v) { return v.id === l.ref; }); }).slice(-40).reverse().map(function (l) { return { at: l.at, by: personName(l.by), text: l.text }; }) : [] };
};

/* ---- office: properties, crews, visits ---- */
ACTIONS.lsSaveProperty = function (me, b) {
  lsNeedOffice(me); var f = b.prop || {}, old = f.id ? lsProp(f.id) : null;
  var patch = {}; ["name", "client_name", "address", "city", "contacts", "access", "notes", "included", "excluded"].forEach(function (k) { if (f[k] != null) patch[k] = clean(f[k], 2000); });
  if (!clean(f.name || (old && old.name), 200)) throw new Error("The property needs a name.");
  if (f.client_emails != null) { var em = splitIds(String(f.client_emails).replace(/[;\s]+/g, ",")).map(normEmail); em.forEach(function (e) { if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e)) throw new Error("Check the client email " + e); }); patch.client_emails = em.join(","); }
  if (f.features != null) patch.features = JSON.stringify([].concat(f.features).map(function (x) { return clean(x, 60); }).filter(Boolean).slice(0, 20));
  if (f.checklist != null) patch.checklist = JSON.stringify([].concat(f.checklist).map(function (x) { return clean(x, 120); }).filter(Boolean).slice(0, 30));
  if (f.crew_id != null) { if (f.crew_id && !findBy("LsCrews", "id", f.crew_id)) throw new Error("Pick a crew."); patch.crew_id = f.crew_id; }
  if (f.freq != null) { if (!(f.freq in LS_FREQ)) throw new Error("Pick how often."); patch.freq = f.freq; }
  if (f.weekday != null) { var wl = [].concat(Array.isArray(f.weekday) ? f.weekday : String(f.weekday).split(",")).map(function (x) { return String(x).trim(); }).filter(function (x) { return /^[0-6]$/.test(x); });
    patch.weekday = wl.filter(function (x, i) { return wl.indexOf(x) === i; }).sort().join(","); }
  if (f.start != null) patch.start = dateOrEmpty(f.start) || lsDay(new Date());
  if (f.visit_min != null) patch.visit_min = String(Math.max(10, Math.min(1440, Math.round(num(f.visit_min)) || 60)));
  if (f.price != null) { if (!lsMoney(me) && old) throw new Error("Only Jesús and #money change prices."); patch.price = String(cents(f.price)); }
  if (f.billing != null) patch.billing = ["monthly", "per_visit", "quarterly", "annual"].indexOf(f.billing) > -1 ? f.billing : "monthly";
  if (f.status != null) patch.status = ["active", "paused", "ended"].indexOf(f.status) > -1 ? f.status : "active";
  ["lat", "lon"].forEach(function (k) { if (f[k] != null) patch[k] = f[k] === "" ? "" : String(Math.round(num(f[k]) * 1e6) / 1e6); });
  // A new or changed address with no pin: ask Google (cheap, cached). No luck = no pin; the map lists it as missing.
  if ((patch.address != null || patch.city != null) && f.lat == null && (!old || patch.address !== old.address || patch.city !== old.city)) {
    try { var gq = lsAddrOf({ address: patch.address != null ? patch.address : old && old.address, city: patch.city != null ? patch.city : old && old.city }), gg = typeof lsGeocode === "function" && gq ? lsGeocode(gq) : null;
      if (gg && gg.sure) { patch.lat = String(gg.lat); patch.lon = String(gg.lon); } } catch (e) { console.warn("geocode on save: " + e.message); }   // only an exact address; vague ones wait for "Find pins"
  }
  if (old) {
    old = Object.assign({}, old);                       // update() changes the cached row in place; keep the before-picture to compare
    update("LsProps", "id", old.id, patch); lsLog(me, "property", old.id, "edited the property / agreement");
    // A changed schedule re-plans the future visits nobody has touched yet (moved or worked ones stay as they are).
    if (["freq", "weekday", "start", "crew_id", "visit_min"].some(function (k) { return patch[k] != null && patch[k] !== old[k]; })) {
      var today = lsDay(new Date());
      removeWhere("LsVisits", function (v) { return v.property_id === old.id && v.series === "rec" && v.status === "scheduled" && v.date === v.plan_date && v.date >= today && !v.started_at; });
      lsEnsureVisits(lsAdd(today, 35));
    }
    return { id: old.id };
  }
  patch.id = newId("lp"); patch.created_at = now(); patch.status = patch.status || "active"; patch.freq = patch.freq || "weekly"; patch.billing = patch.billing || "monthly";
  if (patch.weekday == null) patch.weekday = String(lsParse(patch.start || lsDay(new Date())).getDay());
  if (!patch.start) patch.start = lsDay(new Date()); if (!patch.visit_min) patch.visit_min = "90"; patch.sample = f.sample ? "yes" : "";
  insert("LsProps", patch); lsLog(me, "property", patch.id, "added the property " + patch.name);
  lsEnsureVisits(lsAdd(lsDay(new Date()), 35));
  return { id: patch.id };
};
ACTIONS.lsSaveCrew = function (me, b) {
  lsNeedOffice(me); var f = b.crew || {}, patch = { name: clean(f.name, 80), color: /^#[0-9a-f]{6}$/i.test(f.color || "") ? f.color : "#2f6db0", skills: clean(f.skills, 300), hours: clean(f.hours, 40) };
  if (!patch.name) throw new Error("The crew needs a name.");
  var members = [].concat(f.members || []).map(normEmail).filter(function (e) { return !!findPerson(e); }); patch.members = members.join(",");
  patch.lead = f.lead && members.indexOf(normEmail(f.lead)) > -1 ? normEmail(f.lead) : (members[0] || "");
  if (f.id) { if (!findBy("LsCrews", "id", f.id)) throw new Error("Crew not found."); update("LsCrews", "id", f.id, patch); lsLog(me, "crew", f.id, "edited crew " + patch.name); return { id: f.id }; }
  patch.id = newId("lc"); patch.sample = f.sample ? "yes" : ""; insert("LsCrews", patch); lsLog(me, "crew", patch.id, "added crew " + patch.name); return { id: patch.id };
};
/* Office: add a one-time visit / work order, or change one visit (date, crew, status, scope, price). Only that visit changes. */
ACTIONS.lsSaveVisit = function (me, b) {
  lsNeedOffice(me); var f = b.visit || {}, v = f.id ? findBy("LsVisits", "id", f.id) : null;
  if (f.id && !v) throw new Error("Visit not found.");
  var p = lsProp(v ? v.property_id : f.property_id), patch = {};
  if (f.date != null) { var d = dateOrEmpty(f.date); if (!d) throw new Error("Pick a date."); patch.date = d; }
  if (f.crew_id != null) { if (f.crew_id && !findBy("LsCrews", "id", f.crew_id)) throw new Error("Pick a crew."); patch.crew_id = f.crew_id; }
  if (f.status != null) { if (LS_STATUS.indexOf(f.status) < 0) throw new Error("Unknown status."); patch.status = f.status;
    if (["blocked", "canceled", "weather"].indexOf(f.status) > -1 && !clean(f.reason || (v && v.reason), 300)) throw new Error("Say why the visit can't happen."); }
  if (f.reason != null) patch.reason = clean(f.reason, 300);
  ["scope", "notes", "priority"].forEach(function (k) { if (f[k] != null) patch[k] = clean(f[k], 2000); });
  if (f.est_min != null) patch.est_min = String(Math.max(5, Math.round(num(f.est_min))));
  if (f.kind != null) patch.kind = ["maintenance", "extra", "correction"].indexOf(f.kind) > -1 ? f.kind : "extra";
  if (f.price != null) { if (!lsMoney(me)) throw new Error("Only Jesús and #money set prices."); patch.price = String(cents(f.price)); }
  if (f.checklist != null) patch.checklist = JSON.stringify([].concat(f.checklist).map(function (t) { return { t: clean(t.t || t, 120), done: !!t.done }; }).filter(function (t) { return t.t; }));
  patch.updated_by = me.email; patch.updated_at = now();
  if (v) {
    var what = []; if (patch.date && patch.date !== v.date) what.push("moved " + v.date + " → " + patch.date); if (patch.crew_id != null && patch.crew_id !== v.crew_id) what.push("crew changed");
    if (patch.status && patch.status !== v.status) what.push("status " + v.status + " → " + patch.status + (patch.reason ? " (" + patch.reason + ")" : ""));
    if (patch.date && patch.date !== v.date) patch.stop = "";
    update("LsVisits", "id", v.id, patch); lsLog(me, "visit", v.id, what.join(", ") || "edited the visit"); return { id: v.id };
  }
  var d0 = patch.date || lsDay(new Date());
  var row = { id: newId("v"), property_id: p.id, date: d0, plan_date: d0, series: "one", kind: patch.kind || "extra", crew_id: patch.crew_id != null ? patch.crew_id : p.crew_id || "", status: patch.status || "scheduled", reason: patch.reason || "", stop: "",
    est_min: patch.est_min || p.visit_min || "60", scope: patch.scope || "Work order", checklist: patch.checklist || "[]", notes: patch.notes || "", problems: "", photos_before: "", photos_after: "", materials: "", labor: "", travel_min: "",
    started_at: "", done_at: "", done_by: "", priority: patch.priority || "normal", issue_id: clean(f.issue_id, 40), price: patch.price || "", sample: f.sample ? "yes" : "", updated_by: me.email, updated_at: now() };
  insert("LsVisits", row); lsLog(me, "visit", row.id, "created a " + row.kind + " work order for " + d0); return { id: row.id };
};
/* Rain day: move several visits at once (each one only), and optionally tell the clients. */
ACTIONS.lsMoveVisits = function (me, b) {
  lsNeedOffice(me); var to = dateOrEmpty(b.to); if (!to) throw new Error("Pick the new date.");
  var ids = [].concat(b.ids || []).slice(0, 200), moved = 0, told = {};
  ids.forEach(function (id) {
    var v = findBy("LsVisits", "id", id); if (!v || v.status === "completed") return;
    update("LsVisits", "id", v.id, { date: to, status: "scheduled", reason: b.reason ? clean(b.reason, 200) : v.reason, stop: "", updated_by: me.email, updated_at: now() });
    lsLog(me, "visit", v.id, "moved " + v.date + " → " + to + (b.reason ? " (" + clean(b.reason, 100) + ")" : "")); moved++;
    if (b.notify) { var p = findBy("LsProps", "id", v.property_id); splitIds(p && p.client_emails).forEach(function (e) { if (told[e + p.id]) return; told[e + p.id] = 1;
      safeMail(function () { sendMail(e, "Your maintenance visit moved · " + p.name, "<p>Hi,</p><p>Your landscape maintenance visit at <b>" + esc(p.name) + "</b> moved from " + esc(v.date) + " to <b>" + esc(to) + "</b>" + (b.reason ? " because of " + esc(clean(b.reason, 100)) : "") + ".</p><p>No need to do anything. Questions? Just reply.</p><p>— " + CONFIG.COMPANY + "</p>"); }, ""); }); }
  });
  return { moved: moved, told: Object.keys(told).length };
};
/* Stop order for one crew and day: nearest next stop from where the crew starts (or the first stop). Straight-line
   distance × 1.35 at 25 mph is an estimate, labeled as such on screen. Saves the order; the office can still reorder. */
function lsKm(a, b) { var R = 6371, t = Math.PI / 180, dLa = (b.lat - a.lat) * t, dLo = (b.lon - a.lon) * t, x = Math.sin(dLa / 2) * Math.sin(dLa / 2) + Math.cos(a.lat * t) * Math.cos(b.lat * t) * Math.sin(dLo / 2) * Math.sin(dLo / 2); return 2 * R * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x)); }
ACTIONS.lsRoute = function (me, b) {
  lsNeedOffice(me); var date = dateOrEmpty(b.date), crew = String(b.crew_id || "");
  var vs = rows("LsVisits").filter(function (v) { return v.date === date && v.crew_id === crew && v.status !== "canceled"; });
  if (b.order) { [].concat(b.order).forEach(function (id, i) { var v = vs.filter(function (x) { return x.id === id; })[0]; if (v) update("LsVisits", "id", v.id, { stop: String(i + 1) }); }); lsLog(me, "route", crew + "|" + date, "reordered stops by hand"); return { ok: true }; }
  var pts = vs.map(function (v) { var p = findBy("LsProps", "id", v.property_id) || {}; return { v: v, lat: num(p.lat), lon: num(p.lon), has: !!(p.lat && p.lon) }; });
  var withLoc = pts.filter(function (x) { return x.has; }), noLoc = pts.filter(function (x) { return !x.has; }), order = [], cur = withLoc.length ? withLoc[0] : null, left = withLoc.slice(1), totalKm = 0;
  if (cur) order.push(cur);
  while (left.length) { var bi = 0, bd = Infinity; left.forEach(function (x, i) { var dd = lsKm(cur, x); if (dd < bd) { bd = dd; bi = i; } }); totalKm += bd; cur = left.splice(bi, 1)[0]; cur.km = bd; order.push(cur); }
  order = order.concat(noLoc);
  order.forEach(function (x, i) { update("LsVisits", "id", x.v.id, { stop: String(i + 1), travel_min: x.km != null ? String(Math.round(x.km * 1.35 / 40 * 60)) : "" }); });
  var service = vs.reduce(function (a, v) { return a + num(v.est_min); }, 0), cw = findBy("LsCrews", "id", crew), size = Math.max(1, splitIds(cw && cw.members).length);
  return { stops: order.length, km: Math.round(totalKm * 10) / 10, drive_min: Math.round(totalKm * 1.35 / 40 * 60), service_min: Math.round(service / size), missing: noLoc.length };
};

/* ---- crew (and office): working a visit ---- */
ACTIONS.lsVisitUpdate = function (me, b) {
  var v = findBy("LsVisits", "id", b.id); if (!v) throw new Error("Visit not found."); if (!lsCanWorkVisit(me, v)) throw new Error("This stop isn't on your route.");
  var p = lsProp(v.property_id), patch = { updated_by: me.email, updated_at: now() }, act = String(b.act || ""), log = "";
  if (act === "start") { patch.status = "in_progress"; patch.started_at = now(); log = "started the visit"; }
  else if (act === "check") { var cl = parseJson(v.checklist, []); var i = Number(b.i); if (cl[i]) cl[i].done = !!b.done; patch.checklist = JSON.stringify(cl); }
  else if (act === "notes") { patch.notes = clean(b.notes, 3000); }
  else if (act === "labor") {
    var crewMembers = splitIds((findBy("LsCrews", "id", v.crew_id) || {}).members).map(normEmail);
    var lab = [].concat(b.labor || []).map(function (l) { return { email: normEmail(l.email), min: Math.max(0, Math.min(960, Math.round(num(l.min)))) }; })
      .filter(function (l) { return l.min > 0 && (crewMembers.indexOf(l.email) > -1 || lsRole(me) === "office") && findPerson(l.email); });
    patch.labor = JSON.stringify(lab); if (b.travel_min != null) patch.travel_min = String(Math.max(0, Math.round(num(b.travel_min)))); log = "logged " + lab.reduce(function (a, l) { return a + l.min; }, 0) + " labor minutes";
  }
  else if (act === "material") { var mats = parseJson(v.materials, []); if (b.remove != null) mats.splice(Number(b.remove), 1); else { var it = clean(b.item, 120); if (!it) throw new Error("What did you use?"); mats.push({ item: it, qty: clean(b.qty, 30), cost: lsRole(me) === "office" ? cents(b.cost) : 0 }); } patch.materials = JSON.stringify(mats.slice(0, 40)); }
  else if (act === "photo") { var which = b.which === "before" ? "photos_before" : "photos_after", have = parseJson(v[which], []); patch[which] = JSON.stringify(have.concat(lsSaveImages(p, b.files || [], which === "photos_before" ? "Before" : "After")).slice(0, 24)); log = "added " + (which === "photos_before" ? "before" : "after") + " photos"; }
  else if (act === "complete") {
    var labNow = b.labor ? [].concat(b.labor).map(function (l) { return { email: normEmail(l.email), min: Math.max(0, Math.round(num(l.min))) }; }).filter(function (l) { return l.min > 0 && findPerson(l.email); }) : lsLabor(v);
    if (!labNow.length) throw new Error("Add the crew's time first (minutes per person).");
    patch.labor = JSON.stringify(labNow); patch.status = "completed"; patch.done_at = now(); patch.done_by = me.email; if (b.notes != null) patch.notes = clean(b.notes, 3000);
    if (b.problems != null) patch.problems = clean(b.problems, 2000); log = "completed the visit";
  }
  else if (act === "cannot") { var why = clean(b.reason, 300); if (!why) throw new Error("Say why it can't be completed."); patch.status = b.status === "canceled" ? "canceled" : b.status === "weather" ? "weather" : "blocked"; patch.reason = why; log = "marked " + patch.status + ": " + why; }
  else throw new Error("Unknown update.");
  update("LsVisits", "id", v.id, patch); if (log) lsLog(me, "visit", v.id, log);
  return { visit: lsVisitOut(findBy("LsVisits", "id", v.id), lsRole(me), lsMoney(me)) };
};

/* ---- issues: clients, crews and the office report; the office decides what it is ---- */
ACTIONS.lsReportIssue = function (me, b) {
  var p = lsProp(b.property_id); if (!lsCanSeeProp(me, p)) throw new Error("Property not found.");
  var role = lsRole(me), text = clean(b.text, 3000); if (!text) throw new Error("Tell us what's going on.");
  var c = CacheService.getScriptCache(), k = "lsiss:" + pkey(me.email), n = Number(c.get(k) || 0); if (n >= 20) throw new Error("That's a lot of reports in an hour. Call us if it's urgent.");
  var photos = lsSaveImages(p, b.photos || [], role === "client" ? "Client report" : "Crew report");
  var row = { id: newId("li"), property_id: p.id, at: now(), by_email: me.email, by_name: me.name, text: text, photos: JSON.stringify(photos), urgency: ["low", "normal", "urgent"].indexOf(b.urgency) > -1 ? b.urgency : "normal",
    place: clean(b.place, 200), status: "new", office_note: "", visit_id: clean(b.visit_id, 40), source: role === "office" ? "office" : role, sample: "" };
  withLock(function () { _ROWS = {}; prefetch(["People", "Projects"].concat(LS_TABLES)); insert("LsIssues", row); lsLog(me, "issue", p.id, "reported: " + text.slice(0, 120)); });
  c.put(k, String(n + 1), 3600);
  if (role !== "office") notifyJesus(me.email, (row.urgency === "urgent" ? "🚨 URGENT · " : "") + "Maintenance issue at " + p.name, "<p><b>" + esc(me.name) + "</b> (" + role + ") reported:</p><blockquote>" + nl2br(esc(text)) + "</blockquote>" + (row.place ? "<p>Where: " + esc(row.place) + "</p>" : "") + button("Open the portal", CONFIG.PORTAL_URL));
  return { id: row.id };
};
ACTIONS.lsTriage = function (me, b) {
  lsNeedOffice(me); var i = findBy("LsIssues", "id", b.id); if (!i) throw new Error("Request not found.");
  var st = ["review", "included", "correction", "billable", "scheduled", "closed"].indexOf(b.status) > -1 ? b.status : i.status, patch = { status: st };
  if (b.office_note != null) patch.office_note = clean(b.office_note, 1000);
  if (b.make_visit) {
    var kind = st === "billable" ? "extra" : st === "correction" ? "correction" : "maintenance";
    var r = ACTIONS.lsSaveVisit(me, { visit: { property_id: i.property_id, date: b.date, crew_id: b.crew_id, kind: kind === "maintenance" ? "extra" : kind, scope: (kind === "extra" ? "Additional work: " : kind === "correction" ? "Correction: " : "Included: ") + i.text.slice(0, 300), issue_id: i.id, price: lsMoney(me) && b.price != null ? b.price : undefined, priority: i.urgency === "urgent" ? "high" : "normal" } });
    patch.visit_id = r.id; patch.status = "scheduled";
  }
  update("LsIssues", "id", i.id, patch); lsLog(me, "issue", i.property_id, "request " + patch.status + (patch.office_note ? ": " + patch.office_note.slice(0, 120) : ""));
  return { id: i.id, visit_id: patch.visit_id || "" };
};

/* ---- expenses (crew & office) and rates (admin) ---- */
ACTIONS.lsSaveExpense = function (me, b) {
  var role = lsRole(me); if (role !== "office" && role !== "crew") throw new Error("Only the office and crews log expenses.");
  var v = b.visit_id ? findBy("LsVisits", "id", b.visit_id) : null, p = b.property_id ? lsProp(b.property_id) : v ? lsProp(v.property_id) : null;
  if (role === "crew" && (!v || !lsCanWorkVisit(me, v))) throw new Error("Log it from one of your stops.");
  var amt = cents(b.amount); if (!(amt > 0)) throw new Error("How much was it?");
  var cat = LS_EXP.indexOf(b.category) > -1 ? b.category : "other", receipt = b.receipt && b.receipt.data ? lsSaveImages(p || { name: "Shared" }, [b.receipt], "Receipt")[0] : "";
  var row = { id: newId("le"), at: now(), date: dateOrEmpty(b.date) || lsDay(new Date()), property_id: p ? p.id : "", visit_id: v ? v.id : "", category: cat, vendor: clean(b.vendor, 120), amount: String(amt), note: clean(b.note, 500), receipt: receipt, by_email: me.email, status: lsMoney(me) ? "approved" : "pending", sample: "" };
  withLock(function () { _ROWS = {}; prefetch(["People", "Projects"].concat(LS_TABLES)); insert("LsExpenses", row); lsLog(me, "expense", p ? p.id : "", "logged a " + cat + " expense"); });
  return { id: row.id, status: row.status };
};
ACTIONS.lsReviewExpense = function (me, b) {
  if (!lsMoney(me)) throw new Error("Only Jesús and #money review expenses."); var e = findBy("LsExpenses", "id", b.id); if (!e) throw new Error("Expense not found.");
  var patch = { status: b.status === "rejected" ? "rejected" : "approved" }; if (b.amount != null) patch.amount = String(cents(b.amount)); if (b.category && LS_EXP.indexOf(b.category) > -1) patch.category = b.category;
  update("LsExpenses", "id", e.id, patch); lsLog(me, "expense", e.property_id, patch.status + " an expense" + (b.amount != null && cents(b.amount) !== num(e.amount) ? " (amount " + e.amount + " → " + patch.amount + ")" : "")); return {};
};
ACTIONS.lsSetRate = function (me, b) {
  if (me.role !== "admin") throw new Error("Only Jesús sets pay rates."); var e = normEmail(b.email);
  if (b.default) { PropertiesService.getScriptProperties().setProperty("LS_DEFAULT_RATE", String(cents(b.rate))); return {}; }
  if (!findPerson(e)) throw new Error("Pick a person."); var r = findBy("LsRates", "email", e), patch = { rate: String(cents(b.rate)), updated_at: now() };
  if (r) update("LsRates", "email", e, patch); else insert("LsRates", Object.assign({ email: e }, patch)); lsLog(me, "rate", e, "set a labor rate"); return {};
};

/* ---- clearly labeled sample data (admin) ---- */
ACTIONS.lsSeed = function (me) {
  if (me.role !== "admin") throw new Error("Only Jesús loads sample data.");
  if (rows("LsProps").some(function (p) { return isTrue(p.sample); })) throw new Error("Sample data is already loaded.");
  var crewPeople = rows("People").filter(function (x) { return isTrue(x.active) && (x.role === "crew" || x.role === "staff"); }).map(function (x) { return x.email; }).slice(0, 3);
  var c1 = ACTIONS.lsSaveCrew(me, { crew: { name: "SAMPLE · Crew A", color: "#2f6db0", members: crewPeople.length ? crewPeople : [me.email], skills: "Mowing, irrigation, pruning", hours: "7:00–15:30", sample: true } }).id;
  var c2 = ACTIONS.lsSaveCrew(me, { crew: { name: "SAMPLE · Crew B", color: "#b8873f", members: [me.email], skills: "Tree work, hauling", hours: "7:00–15:30", sample: true } }).id;
  var today = lsDay(new Date()), wd = lsParse(today).getDay();
  [["SAMPLE · Oak Knoll Estate", "Sample Client", "1200 Oak Knoll Rd", "Hillsborough", 37.5585, -122.3480, c1, "weekly", 650, 180],
   ["SAMPLE · Palo Alto Garden", "Sample Client", "455 Waverley St", "Palo Alto", 37.4470, -122.1590, c1, "weekly", 420, 120],
   ["SAMPLE · Atherton HOA Common", "Sample HOA", "80 Fair Oaks Ln", "Atherton", 37.4583, -122.2000, c2, "biweekly", 900, 240],
   ["SAMPLE · San Mateo Courtyard", "Sample Client", "210 W 3rd Ave", "San Mateo", 37.5650, -122.3270, c1, "monthly", 300, 90]].forEach(function (x, i) {
    ACTIONS.lsSaveProperty(me, { prop: { name: x[0], client_name: x[1], address: x[2], city: x[3], lat: x[4], lon: x[5], crew_id: x[6], freq: x[7], weekday: String((wd + i % 2) % 7), start: lsAdd(today, -14), price: x[8], billing: "monthly", visit_min: x[9],
      features: ["Lawn", "Planting beds", "Irrigation"].concat(i === 2 ? ["Trees", "Drainage"] : []), access: "Side gate code 1234 (sample)", included: "Mowing, edging, blowing, bed weeding, irrigation checks", excluded: "Tree work over 12 ft, plant replacement, hauling over 1 yd", sample: true } });
  });
  // four weeks of completed visits so the dashboard has numbers (all marked sample); one property runs over its labor budget
  rows("LsProps").filter(function (p) { return isTrue(p.sample); }).forEach(function (p, k) {
    lsPlanDates(Object.assign({}, p, { start: lsAdd(today, -35) }), lsAdd(today, -35), lsAdd(today, -1)).forEach(function (d, i) {
      var est = num(p.visit_min), f = k === 2 ? 0.75 : 0.45, who = crewPeople.length ? crewPeople : [me.email];
      insert("LsVisits", { id: newId("v"), property_id: p.id, date: d, plan_date: d, series: "rec", kind: "maintenance", crew_id: p.crew_id, status: "completed", reason: "", stop: String(k + 1), est_min: String(est), scope: "Recurring maintenance",
        checklist: JSON.stringify(parseJson(p.checklist, LS_DEFAULT_CHECK).map(function (t) { return { t: t, done: true }; })), notes: "All done. Irrigation checked. (sample report)", problems: "", photos_before: "", photos_after: "",
        materials: i % 3 === 0 ? JSON.stringify([{ item: "Mulch", qty: "2 yd", cost: 84 }]) : "", labor: JSON.stringify([{ email: who[0], min: Math.round(est * f) }, { email: who[1] || who[0], min: Math.round(est * f) }]), travel_min: "12",
        started_at: d + " 08:00", done_at: d + " 10:30", done_by: who[0], priority: "normal", issue_id: "", price: "", sample: "yes", updated_by: "", updated_at: "" });
    });
  });
  var firstSample = rows("LsVisits").filter(function (v) { return isTrue(v.sample) && v.date < today; }).slice(-1)[0];
  if (firstSample) update("LsVisits", "id", firstSample.id, { status: "scheduled", labor: "", done_at: "" });          // one missed visit to show in "Needs attention"
  try { var sp = rows("LsProps").filter(function (p) { return isTrue(p.sample); })[0], est = ACTIONS.lsSaveEstimate(me, { estimate: { property_id: sp.id, kind: "estimate", title: "SAMPLE · Replace 3 damaged shrubs + mulch front beds", scope: "Remove 3 damaged boxwoods by the entry, plant 3 new 5-gal boxwoods, refresh mulch in the front beds (about 3 yd).", exclusions: "Irrigation changes, plants beyond the 3 listed", impact: "Adds about 3 hours on the next visit; no change to the weekly schedule", proposed_date: lsAdd(today, 9), lines: [{ desc: "5-gal boxwood, planted", qty: 3, unit: "ea", price: 85 }, { desc: "Remove and haul damaged shrubs", qty: 1, unit: "job", price: 120 }, { desc: "Mulch, delivered and spread", qty: 3, unit: "yd", price: 78 }], sample: true } });
    if (splitIds(sp.client_emails).length) ACTIONS.lsSendEstimate(me, { id: est.id }); } catch (e) {}
  insert("LsIssues", { id: newId("li"), property_id: rows("LsProps").filter(function (p) { return isTrue(p.sample); })[0].id, at: now(), by_email: me.email, by_name: "Sample Client", text: "Sprinkler near the front walk is spraying the house (sample)", photos: "[]", urgency: "urgent", place: "Front walk", status: "new", office_note: "", visit_id: "", source: "client", sample: "yes" });
  return { ok: true };
};
ACTIONS.lsClearSample = function (me) {
  if (me.role !== "admin") throw new Error("Only Jesús clears sample data.");
  var props = {}; rows("LsProps").forEach(function (p) { if (isTrue(p.sample)) props[p.id] = 1; });
  removeWhere("LsVisits", function (v) { return isTrue(v.sample) || props[v.property_id]; });
  removeWhere("LsIssues", function (i) { return isTrue(i.sample) || props[i.property_id]; });
  removeWhere("LsExpenses", function (e) { return props[e.property_id]; });
  removeWhere("LsEstimates", function (e) { return isTrue(e.sample) || props[e.property_id]; });
  removeWhere("LsProps", function (p) { return isTrue(p.sample); }); removeWhere("LsCrews", function (c) { return isTrue(c.sample); });
  return { ok: true };
};

/* ======================================================================================================
   Estimates & change orders (stage 2). The office writes the scope, line items, what's not included and the
   schedule impact, then sends it. Every send freezes a numbered version. The client approves exactly that
   version (typed name + "I agree"), or declines with a reason. We keep who, when, which version and a
   fingerprint of what they saw. Changing an approved estimate makes a new version that needs a new approval,
   and its work order waits until then. An approval becomes a linked work order the office can schedule and bill.
   ====================================================================================================== */
TABLES.LsEstimates = ["id", "property_id", "issue_id", "visit_id", "kind", "title", "scope", "exclusions", "impact", "proposed_date", "lines", "total", "status", "version",
  "versions", "approved_v", "approved_at", "approved_by", "approved_name", "approved_hash", "declined_reason", "sent_at", "created_by", "created_at", "updated_at", "sample"];
LS_TABLES.push("LsEstimates");
["lsSaveEstimate", "lsSendEstimate", "lsDecide", "lsWithdraw", "lsEstimate"].forEach(function (a) { PREFETCH[a] = ["People", "Projects"].concat(LS_TABLES); });
["lsHome", "lsSaveProperty", "lsSaveCrew", "lsSaveVisit", "lsMoveVisits", "lsRoute", "lsVisitUpdate", "lsReportIssue", "lsTriage", "lsSaveExpense", "lsReviewExpense", "lsSetRate", "lsSeed", "lsClearSample", "lsProperty"].forEach(function (a) { PREFETCH[a] = ["People", "Projects"].concat(LS_TABLES); });
NO_LOCK.lsEstimate = 1;
var LS_EST_ST = ["draft", "sent", "approved", "declined", "withdrawn", "scheduled", "revised"];
function lsEstLines(list) {
  return [].concat(list || []).slice(0, 40).map(function (l) { var q = Math.max(0, num(l.qty) || 1), up = cents(l.price); return { desc: clean(l.desc, 300), qty: q, unit: clean(l.unit, 20), price: up, amount: cents(q * up) }; }).filter(function (l) { return l.desc; });
}
function lsEstSnapshot(e) { return { scope: e.scope, exclusions: e.exclusions, impact: e.impact, proposed_date: e.proposed_date, title: e.title, lines: parseJson(e.lines, []), total: num(e.total) }; }
function lsEstHash(snap) { return sha(JSON.stringify(snap)).slice(0, 16); }
function lsEstOut(e, role, money) {
  var vers = parseJson(e.versions, []), cur = vers[vers.length - 1] || null, seePrice = money || role === "client";
  var o = { id: e.id, property_id: e.property_id, issue_id: e.issue_id, visit_id: e.visit_id, kind: e.kind, status: e.status, version: num(e.version), sent_at: e.sent_at,
    approved_v: num(e.approved_v), approved_at: e.approved_at, approved_name: e.approved_name, declined_reason: e.declined_reason, created_at: e.created_at, sample: isTrue(e.sample) };
  // The client only ever sees what was sent (the frozen version), never a draft in progress.
  var show = role === "client" ? cur : lsEstSnapshot(e);
  if (show) { o.title = show.title; o.scope = show.scope; o.exclusions = show.exclusions; o.impact = show.impact; o.proposed_date = show.proposed_date; o.lines = seePrice ? show.lines : show.lines.map(function (l) { return { desc: l.desc, qty: l.qty, unit: l.unit }; }); if (seePrice) o.total = show.total; }
  if (role === "office") o.history = vers.map(function (v) { return { v: v.v, at: v.at, by: personName(v.by), total: seePrice ? v.total : undefined, hash: v.hash }; }), o.approved_hash = e.approved_hash, o.approved_by = e.approved_by ? personName(e.approved_by) : "";
  return o;
}
function lsCanSeeEst(me, e) { var role = lsRole(me); if (role === "office") return true; if (role !== "client") return false; return e.status !== "draft" && e.status !== "withdrawn" && num(e.version) > 0 && lsCanSeeProp(me, lsProp(e.property_id)); }
ACTIONS.lsEstimate = function (me, b) {
  var e = findBy("LsEstimates", "id", b.id); if (!e || !lsCanSeeEst(me, e)) throw new Error("Estimate not found.");
  return { estimate: lsEstOut(e, lsRole(me), lsMoney(me)), log: lsRole(me) === "office" ? rows("LsLog").filter(function (l) { return l.ref === e.id; }).reverse().map(function (l) { return { at: l.at, by: personName(l.by), text: l.text }; }) : [] };
};
/* Write or change an estimate (prices: admin + #money). Changing one the client already approved makes it a new version to approve again. */
ACTIONS.lsSaveEstimate = function (me, b) {
  if (!lsMoney(me)) throw new Error("Only Jesús and #money write estimates."); var f = b.estimate || {}, e = f.id ? findBy("LsEstimates", "id", f.id) : null;
  if (f.id && !e) throw new Error("Estimate not found.");
  var p = lsProp(e ? e.property_id : f.property_id), lines = lsEstLines(f.lines);
  if (!lines.length) throw new Error("Add at least one line with a price.");
  var patch = { kind: f.kind === "change_order" ? "change_order" : "estimate", title: clean(f.title, 200) || "Additional work", scope: clean(f.scope, 4000), exclusions: clean(f.exclusions, 2000), impact: clean(f.impact, 500),
    proposed_date: dateOrEmpty(f.proposed_date), lines: JSON.stringify(lines), total: String(cents(lines.reduce(function (a, l) { return a + l.amount; }, 0))), updated_at: now() };
  if (!patch.scope) throw new Error("Describe the scope of work.");
  if (e) {
    var material = lsEstHash(lsEstSnapshot(Object.assign({}, e, patch))) !== lsEstHash(lsEstSnapshot(e));
    if (["approved", "scheduled"].indexOf(e.status) > -1 && material) {
      patch.status = "revised";
      if (e.visit_id) { var v = findBy("LsVisits", "id", e.visit_id); if (v && v.status !== "completed") { update("LsVisits", "id", v.id, { status: "blocked", reason: "Waiting for the client to approve the revised estimate", updated_by: me.email, updated_at: now() }); lsLog(me, "visit", v.id, "on hold: estimate revised after approval"); } }
      lsLog(me, "estimate", e.id, "changed after approval (v" + e.approved_v + "): needs a new approval");
    } else if (e.status === "sent" && material) { patch.status = "draft"; lsLog(me, "estimate", e.id, "edited after sending: send it again for approval"); }
    else if (["declined", "withdrawn"].indexOf(e.status) > -1) { patch.status = "draft"; lsLog(me, "estimate", e.id, "reopened as a draft"); }
    else lsLog(me, "estimate", e.id, "edited");
    update("LsEstimates", "id", e.id, patch); return { id: e.id, status: patch.status || e.status };
  }
  var row = Object.assign({ id: newId("es"), property_id: p.id, issue_id: clean(f.issue_id, 40), visit_id: "", status: "draft", version: "0", versions: "[]", approved_v: "", approved_at: "", approved_by: "", approved_name: "", approved_hash: "",
    declined_reason: "", sent_at: "", created_by: me.email, created_at: now(), sample: f.sample ? "yes" : "" }, patch);
  insert("LsEstimates", row); lsLog(me, "estimate", row.id, "created " + (row.kind === "change_order" ? "a change order" : "an estimate") + " for " + p.name);
  if (row.issue_id) { var iss = findBy("LsIssues", "id", row.issue_id); if (iss) update("LsIssues", "id", iss.id, { status: "billable" }); }
  return { id: row.id, status: "draft" };
};
/* Send: freeze this version, tell the client(s). */
ACTIONS.lsSendEstimate = function (me, b) {
  if (!lsMoney(me)) throw new Error("Only Jesús and #money send estimates."); var e = findBy("LsEstimates", "id", b.id); if (!e) throw new Error("Estimate not found.");
  if (["draft", "revised"].indexOf(e.status) < 0) throw new Error("Only a draft can be sent. Edit it to make a new version.");
  var p = lsProp(e.property_id), emails = splitIds(p.client_emails); if (!emails.length) throw new Error("This property has no client email. Add one in the property first.");
  var snap = lsEstSnapshot(e), vers = parseJson(e.versions, []), v = vers.length + 1;
  vers.push(Object.assign({ v: v, at: now(), by: me.email, hash: lsEstHash(snap) }, snap));
  update("LsEstimates", "id", e.id, { status: "sent", version: String(v), versions: JSON.stringify(vers), sent_at: now() });
  lsLog(me, "estimate", e.id, "sent version " + v + " ($" + money(snap.total) + ")");
  emails.forEach(function (to) { safeMail(function () { sendMail(to, (e.kind === "change_order" ? "Change order" : "Estimate") + " to review · " + p.name, "<p>Hi,</p><p>Blue Sierra sent you " + (e.kind === "change_order" ? "a change order" : "an estimate") + " for <b>" + esc(p.name) + "</b>: <b>" + esc(snap.title) + "</b>, $" + money(snap.total) + ".</p><p>Open your portal to see the scope, what's not included and the schedule, and approve or decline it.</p>" + button("Review it", CONFIG.PORTAL_URL) + "<p style='color:#888;font-size:13px'>Version " + v + ".</p>"); }, "Saved, but the email to the client couldn't be sent."); });
  return { version: v };
};
/* The client decides on exactly the version they saw. The office can record a decision made by phone (it says so). */
ACTIONS.lsDecide = function (me, b) {
  var e = findBy("LsEstimates", "id", b.id); if (!e || !lsCanSeeEst(me, e)) throw new Error("Estimate not found.");
  var role = lsRole(me); if (role !== "client" && !lsMoney(me)) throw new Error("Only the client (or Jesús on their behalf) decides.");
  if (e.status !== "sent") throw new Error(e.status === "approved" || e.status === "scheduled" ? "It's already approved." : "This estimate isn't waiting for a decision anymore.");
  if (Number(b.version) !== num(e.version)) throw new Error("This estimate changed since you opened it. Please look at the new version.");
  var vers = parseJson(e.versions, []), cur = vers[vers.length - 1], p = lsProp(e.property_id);
  if (b.decision === "decline") {
    var why = clean(b.reason, 500); update("LsEstimates", "id", e.id, { status: "declined", declined_reason: why });
    lsLog(me, "estimate", e.id, (role === "client" ? "client" : "office for the client") + " declined v" + cur.v + (why ? ": " + why : ""));
    if (e.issue_id) update("LsIssues", "id", e.issue_id, { status: "review" });
    if (role === "client") notifyJesus(me.email, "Estimate declined · " + p.name, "<p><b>" + esc(me.name) + "</b> declined <b>" + esc(cur.title) + "</b> ($" + money(cur.total) + ", v" + cur.v + ").</p>" + (why ? "<p>Reason: " + esc(why) + "</p>" : "") + button("Open the portal", CONFIG.PORTAL_URL));
    return { status: "declined" };
  }
  var name = clean(b.name, 120); if (!name || !b.agree) throw new Error("Type your full name and confirm you agree.");
  var visitId = e.visit_id, priorV = num(e.approved_v);
  if (visitId && findBy("LsVisits", "id", visitId)) {
    var vv = findBy("LsVisits", "id", visitId);
    if (vv.status !== "completed") update("LsVisits", "id", visitId, { status: "scheduled", reason: "", scope: "Approved (v" + cur.v + "): " + cur.title + "\n" + cur.scope, price: String(cur.total), est_min: vv.est_min, updated_by: me.email, updated_at: now() });
  } else {
    visitId = newId("v"); var d0 = cur.proposed_date && cur.proposed_date >= lsDay(new Date()) ? cur.proposed_date : lsAdd(lsDay(new Date()), 7);
    insert("LsVisits", { id: visitId, property_id: p.id, date: d0, plan_date: d0, series: "one", kind: "extra", crew_id: p.crew_id || "", status: "scheduled", reason: "", stop: "", est_min: "120",
      scope: "Approved (v" + cur.v + "): " + cur.title + "\n" + cur.scope, checklist: JSON.stringify(cur.lines.map(function (l) { return { t: l.desc, done: false }; })), notes: "", problems: "", photos_before: "", photos_after: "", materials: "", labor: "", travel_min: "",
      started_at: "", done_at: "", done_by: "", priority: "normal", issue_id: e.issue_id || "", price: String(cur.total), sample: e.sample || "", updated_by: me.email, updated_at: now() });
  }
  update("LsEstimates", "id", e.id, { status: "scheduled", approved_v: String(cur.v), approved_at: now(), approved_by: me.email, approved_name: name + (role === "client" ? "" : " (recorded by " + me.name + ")"), approved_hash: cur.hash, visit_id: visitId });
  if (e.issue_id) update("LsIssues", "id", e.issue_id, { status: "scheduled", visit_id: visitId });
  lsLog(me, "estimate", e.id, (role === "client" ? name + " approved" : me.name + " recorded approval by " + name + " for") + " v" + cur.v + " ($" + money(cur.total) + ", fingerprint " + cur.hash + ")" + (priorV ? " · replaces approval of v" + priorV : ""));
  lsLog(me, "visit", visitId, "work order from approved estimate v" + cur.v);
  if (role === "client") notifyJesus(me.email, "✅ Estimate approved · " + p.name, "<p><b>" + esc(name) + "</b> approved <b>" + esc(cur.title) + "</b> ($" + money(cur.total) + ", v" + cur.v + "). A work order was created; schedule it in the portal.</p>" + button("Open the portal", CONFIG.PORTAL_URL));
  return { status: "scheduled", visit_id: visitId };
};
ACTIONS.lsWithdraw = function (me, b) {
  if (!lsMoney(me)) throw new Error("Only Jesús and #money withdraw estimates."); var e = findBy("LsEstimates", "id", b.id); if (!e) throw new Error("Estimate not found.");
  if (["approved", "scheduled"].indexOf(e.status) > -1) throw new Error("It's approved. Edit it to send a new version instead.");
  update("LsEstimates", "id", e.id, { status: "withdrawn" }); lsLog(me, "estimate", e.id, "withdrawn"); return {};
};
/* Add estimates to what each screen loads. */
var _lsHomeBase = ACTIONS.lsHome;
ACTIONS.lsHome = function (me, b) {
  var out = _lsHomeBase(me, b); if (!out.role || out.role === "crew") return out;
  var pids = {}; (out.props || []).forEach(function (p) { pids[p.id] = 1; });
  out.estimates = rows("LsEstimates").filter(function (e) { return pids[e.property_id] && lsCanSeeEst(me, e) && (out.role !== "office" || e.status !== "withdrawn" || b.all); })
    .map(function (e) { return lsEstOut(e, out.role, out.money); }).sort(function (a, c) { return (a.sent_at || a.created_at) < (c.sent_at || c.created_at) ? 1 : -1; });
  return out;
};

/* Bring in properties from a spreadsheet (Jesús only). Same name as one already there = skipped, so running it twice is safe.
   Visits are planned from today on; nothing is billed or emailed. */
ACTIONS.lsImport = function (me, b) {
  if (me.role !== "admin") throw new Error("Only Jesús imports properties.");
  var list = [].concat(b.props || []).slice(0, 300), have = {}, made = [], skipped = [];
  rows("LsProps").forEach(function (p) { if (!isTrue(p.sample)) have[String(p.name).trim().toLowerCase()] = p.id; });
  list.forEach(function (f) {
    var name = clean(f && f.name, 200), k = name.toLowerCase(); if (!name) return;
    if (have[k]) { skipped.push(name); return; }
    var prop = { name: name };
    ["client_name", "address", "city", "notes", "freq", "weekday", "start", "billing", "visit_min", "status", "client_emails", "lat", "lon", "price"].forEach(function (x) { if (f[x] != null && f[x] !== "") prop[x] = f[x]; });
    if (prop.freq && !(prop.freq in LS_FREQ)) prop.freq = "weekly";
    var r = ACTIONS.lsSaveProperty(me, { prop: prop }); have[k] = r.id; made.push(name);
  });
  if (made.length) lsLog(me, "property", "", "imported " + made.length + " properties");
  return { made: made, skipped: skipped };
};
PREFETCH.lsImport = ["People", "Projects"].concat(LS_TABLES);

/* ======================================================================================================
   Routes & money per hour (stage 2). Real drive times come from Google (Apps Script's built-in Maps service:
   no key, a daily quota, so every answer is cached for 6 hours). If Google can't answer, we fall back to the
   straight-line estimate and say so. "Better days" and the pricing check use the cheap straight-line estimate
   for a typical week, so they never spend the Google quota.
   ====================================================================================================== */
var LS_WORKDAYS = [1, 2, 3, 4, 5];
function lsCfg() {
  var pr = PropertiesService.getScriptProperties();
  return { yard: parseJson(pr.getProperty("LS_YARD"), null), target: num(pr.getProperty("LS_TARGET")) || 75, rate: num(pr.getProperty("LS_DEFAULT_RATE")) || 32 };
}
function lsCacheJson(key, secs, fn) {
  var c = CacheService.getScriptCache(), k = key.length > 200 ? key.slice(0, 40) + sha(key).slice(0, 32) : key, hit = c.get(k);
  if (hit) return JSON.parse(hit);
  var v = fn(); if (v) { try { c.put(k, JSON.stringify(v), secs); } catch (e) {} } return v;
}
/* Google's geocoder, limited to the Bay Area. sure = an exact street address (not a street, town or guess). */
function lsGeocode(q) {
  q = String(q || "").trim(); if (!q) return null;
  var g = lsCacheJson("geo2:" + q.toLowerCase(), 21600, function () {
    var r = Maps.newGeocoder().setRegion("us").setBounds(36.8, -122.7, 38.2, -121.4).geocode(q);
    if (!r || r.status !== "OK" || !r.results || !r.results.length) return { miss: 1 };                     // remember "not found" too
    var x = r.results[0], loc = x.geometry.location, t = x.geometry.location_type;
    return { lat: Math.round(loc.lat * 1e6) / 1e6, lon: Math.round(loc.lng * 1e6) / 1e6, address: x.formatted_address, sure: !x.partial_match && (t === "ROOFTOP" || t === "RANGE_INTERPOLATED") };
  });
  return g && !g.miss ? g : null;
}
function lsAddrOf(p) { return [p.address, p.city, "CA"].filter(function (x) { return String(x || "").trim(); }).join(", "); }
/* Straight-line minutes (roads ≈ 1.35× the straight line, ~40 km/h in town). */
function lsEstMin(a, b) { return lsKm(a, b) * 1.35 / 40 * 60; }
/* Shortest visiting order by distance: nearest neighbour from each start, then 2-opt. Returns indexes. */
function lsBestOrder(pts, yard) {
  var n = pts.length; if (n < 2) return pts.map(function (x, i) { return i; });
  var cost = function (o) { var s = 0; for (var i = 1; i < o.length; i++) s += lsKm(pts[o[i - 1]], pts[o[i]]); if (yard) s += lsKm(yard, pts[o[0]]) + lsKm(pts[o[o.length - 1]], yard); return s; };
  var best = null;
  for (var st = 0; st < n; st++) {
    var o = [st], left = []; for (var i = 0; i < n; i++) if (i !== st) left.push(i);
    while (left.length) { var cur = pts[o[o.length - 1]], bi = 0; left.forEach(function (x, j) { if (lsKm(cur, pts[x]) < lsKm(cur, pts[left[bi]])) bi = j; }); o.push(left.splice(bi, 1)[0]); }
    var improved = true; while (improved) { improved = false;
      for (var a = 0; a < n - 1; a++) for (var b2 = a + 1; b2 < n; b2++) { var t = o.slice(0, a).concat(o.slice(a, b2 + 1).reverse(), o.slice(b2 + 1)); if (cost(t) < cost(o) - 1e-9) { o = t; improved = true; } } }
    if (!best || cost(o) < best.c) best = { o: o, c: cost(o) };
  }
  return best.o;
}
/* One crew's day: order (kept if the office set one, else optimized), each leg's real drive time, the road line. */
function lsRouteFor(stops, yard, keepOrder) {
  var n = stops.length, out = { order: [], legs: [], back_min: 0, drive_min: 0, km: 0, real: false, poly: "" };
  if (!n) return out;
  var ord = keepOrder ? stops.map(function (x, i) { return i; }) : lsBestOrder(stops, yard);
  var seq = ord.map(function (i) { return stops[i]; });
  var straight = function () {
    out.legs = seq.map(function (s, i) { var from = i ? seq[i - 1] : yard; return from ? { min: Math.round(lsEstMin(from, s)), km: Math.round(lsKm(from, s) * 13.5) / 10 } : { min: 0, km: 0 }; });
    out.back_min = yard ? Math.round(lsEstMin(seq[n - 1], yard)) : 0;
  };
  try {
    if (n === 1 && !yard) straight();
    else {
      var pts = (yard ? [yard] : []).concat(seq, yard ? [yard] : []);
      var key = "dir2:" + pts.map(function (p) { return p.lat.toFixed(5) + "," + p.lon.toFixed(5); }).join("|");
      var g = lsCacheJson(key, 21600, function () {
        var f = Maps.newDirectionFinder().setMode(Maps.DirectionFinder.Mode.DRIVING).setOrigin(pts[0].lat, pts[0].lon).setDestination(pts[pts.length - 1].lat, pts[pts.length - 1].lon);
        pts.slice(1, -1).forEach(function (p) { f.addWaypoint(p.lat, p.lon); });
        var r = f.getDirections(); if (!r || r.status !== "OK" || !r.routes || !r.routes.length) return null;
        var rt = r.routes[0]; return { legs: rt.legs.map(function (l) { return { min: Math.round(l.duration.value / 60), km: Math.round(l.distance.value / 100) / 10 }; }), poly: rt.overview_polyline ? rt.overview_polyline.points : "" };
      });
      if (!g) straight();
      else { out.real = true; out.poly = g.poly;
        if (yard) { out.legs = g.legs.slice(0, n); out.back_min = g.legs[n] ? g.legs[n].min : 0; }
        else out.legs = [{ min: 0, km: 0 }].concat(g.legs); }
    }
  } catch (e) { console.warn("lsRouteFor: " + e.message); straight(); }
  out.order = ord;
  out.drive_min = out.legs.reduce(function (a, l) { return a + l.min; }, 0) + out.back_min;
  out.km = Math.round(out.legs.reduce(function (a, l) { return a + l.km; }, 0) * 10) / 10;
  return out;
}
function lsMapsLink(seq, yard) {
  var pt = function (p) { return p.lat + "," + p.lon; }, all = seq.map(pt);
  var o = yard ? pt(yard) : all.shift(), d = yard ? pt(yard) : all.pop() || o;
  return "https://www.google.com/maps/dir/?api=1&travelmode=driving&origin=" + encodeURIComponent(o) + "&destination=" + encodeURIComponent(d) + (all.length ? "&waypoints=" + encodeURIComponent(all.join("|")) : "");
}
/* The day on the map: one route per crew with real drive times, time on site, the total against an 8-hour day, and revenue. */
ACTIONS.lsDayRoutes = function (me, b) {
  lsNeedOffice(me); var date = dateOrEmpty(b.date) || lsDay(new Date()), cfg = lsCfg(), money = lsMoney(me), groups = {};
  rows("LsVisits").filter(function (v) { return v.date === date && v.status !== "canceled"; }).forEach(function (v) { (groups[v.crew_id || ""] = groups[v.crew_id || ""] || []).push(v); });
  var props = {}; rows("LsProps").forEach(function (p) { props[p.id] = p; });
  var crews = Object.keys(groups).map(function (cid) {
    var vs = groups[cid].sort(function (a, c) { return (num(a.stop) || 99) - (num(c.stop) || 99); }), cw = cid ? findBy("LsCrews", "id", cid) : null, size = Math.max(1, splitIds(cw && cw.members).length || 2);
    var keep = vs.every(function (v) { return num(v.stop) > 0; }) && !b.optimize;
    var withLoc = vs.filter(function (v) { var p = props[v.property_id]; return p && p.lat && p.lon; }), noLoc = vs.filter(function (v) { return withLoc.indexOf(v) < 0; });
    var stops = withLoc.map(function (v) { var p = props[v.property_id]; return { lat: num(p.lat), lon: num(p.lon), v: v }; });
    var r = lsRouteFor(stops, cfg.yard, keep), seq = r.order.map(function (i) { return stops[i]; });
    var site = vs.reduce(function (a, v) { return a + num(v.est_min); }, 0) / size;
    var o = { crew_id: cid, size: size, stops: seq.map(function (s, i) { return { visit_id: s.v.id, drive_min: r.legs[i] ? r.legs[i].min : 0, km: r.legs[i] ? r.legs[i].km : 0 }; }).concat(noLoc.map(function (v) { return { visit_id: v.id, drive_min: null, km: null }; })),
      back_min: r.back_min, drive_min: r.drive_min, km: r.km, site_min: Math.round(site), day_min: Math.round(site + r.drive_min), real: r.real, poly: r.poly, missing: noLoc.length, kept: keep,
      maps: seq.length ? lsMapsLink(seq, cfg.yard) : "" };
    if (money) o.revenue = Math.round(vs.reduce(function (a, v) { return a + lsVisitRevenue(v, props[v.property_id]); }, 0));
    return o;
  });
  return { date: date, yard: cfg.yard, crews: crews };
};
NO_LOCK.lsDayRoutes = 1;
/* Save the order the office sees on the map (or the optimized one) as the stop numbers, with real drive times. */
var _lsRouteBase = ACTIONS.lsRoute;
ACTIONS.lsRoute = function (me, b) {
  if (b.order) return _lsRouteBase(me, b);
  lsNeedOffice(me); var r = ACTIONS.lsDayRoutes(me, { date: b.date, optimize: true }), g = r.crews.filter(function (c) { return c.crew_id === String(b.crew_id || ""); })[0];
  if (!g) return { stops: 0, km: 0, drive_min: 0, service_min: 0, missing: 0 };
  g.stops.forEach(function (s, i) { update("LsVisits", "id", s.visit_id, { stop: String(i + 1), travel_min: s.drive_min == null ? "" : String(s.drive_min) }); });
  lsLog(me, "route", g.crew_id + "|" + r.date, "planned the route (" + (g.real ? "Google drive times" : "estimated") + ", " + g.drive_min + " min driving)");
  return { stops: g.stops.length, km: g.km, drive_min: g.drive_min, service_min: g.site_min, missing: g.missing, real: g.real };
};
/* Put every property on the map: Google finds the ones without a pin. Unsure matches are listed to check. */
ACTIONS.lsFixPins = function (me, b) {
  lsNeedOffice(me); var found = [], check = [], none = [];
  rows("LsProps").filter(function (p) { return p.status !== "ended" && (!p.lat || !p.lon || b.all); }).slice(0, 60).forEach(function (p) {
    var q = lsAddrOf(p), g = null; try { g = lsGeocode(q); } catch (e) { console.warn("geocode: " + e.message); }
    if (!g) { none.push(p.name); return; }
    update("LsProps", "id", p.id, { lat: String(g.lat), lon: String(g.lon) });
    (g.sure ? found : check).push({ id: p.id, name: p.name, address: g.address });
  });
  if (found.length + check.length) lsLog(me, "property", "", "found map pins for " + (found.length + check.length) + " properties");
  return { found: found, check: check, none: none };
};
/* Yard (where the day starts and ends) and the $/hour goal (admin). */
ACTIONS.lsSettings = function (me, b) {
  if (me.role !== "admin") throw new Error("Only Jesús changes these settings.");
  var pr = PropertiesService.getScriptProperties();
  if (b.yard != null) {
    var q = clean(b.yard, 300);
    if (!q) pr.deleteProperty("LS_YARD");
    else { var g = lsGeocode(q); if (!g) throw new Error("Google couldn't find that address. Add the street number and city."); pr.setProperty("LS_YARD", JSON.stringify({ address: g.address, lat: g.lat, lon: g.lon })); }
  }
  if (b.target != null) pr.setProperty("LS_TARGET", String(Math.max(10, Math.min(500, Math.round(num(b.target)) || 75))));
  return { cfg: lsCfg() };
};
/* A typical week: which properties each crew does on each workday (biweekly ones count half). */
function lsWeek() {
  var week = {}, props = rows("LsProps").filter(function (p) { return p.status === "active" && (p.freq === "weekly" || p.freq === "biweekly") && p.lat && p.lon; });
  props.forEach(function (p) { lsWds(p).forEach(function (d) { var k = (p.crew_id || "") + "|" + d; (week[k] = week[k] || []).push(p); }); });
  return { week: week, props: props };
}
function lsTourMin(list, yard) {
  if (!list.length) return 0; var pts = list.map(function (p) { return { lat: num(p.lat), lon: num(p.lon) }; }), o = lsBestOrder(pts, yard), s = 0;
  for (var i = 1; i < o.length; i++) s += lsEstMin(pts[o[i - 1]], pts[o[i]]);
  if (yard) s += lsEstMin(yard, pts[o[0]]) + lsEstMin(pts[o[o.length - 1]], yard);
  return s;
}
function lsCrewSize(cid) { var c = cid ? findBy("LsCrews", "id", cid) : null; return Math.max(1, splitIds(c && c.members).length || 2); }
/* Better days: move a property to the day its crew is already nearby. Greedy, up to 6 moves, each saving ≥ 10 min a week,
   never past a 9-hour day. Uses straight-line estimates for a typical week. */
ACTIONS.lsSuggestDays = function (me, b) {
  lsNeedOffice(me); var cfg = lsCfg(), W = lsWeek(), week = W.week, moves = [], moved = {};
  var dayLoad = function (k, list) { return lsTourMin(list, cfg.yard) + list.reduce(function (a, p) { return a + num(p.visit_min || 60); }, 0) / lsCrewSize(k.split("|")[0]); };
  for (var round = 0; round < 6; round++) {
    var best = null;
    W.props.forEach(function (p) {
      if (moved[p.id] || lsWds(p).length !== 1) return;
      var cid = p.crew_id || "", from = lsWds(p)[0], fk = cid + "|" + from, fl = week[fk] || [], wt = p.freq === "biweekly" ? 0.5 : 1;
      var without = fl.filter(function (x) { return x !== p; }), saveFrom = lsTourMin(fl, cfg.yard) - lsTourMin(without, cfg.yard);
      LS_WORKDAYS.forEach(function (d) {
        if (d === from) return; var tk = cid + "|" + d, tl = week[tk] || []; if (!tl.length) return;      // only to a day the crew already works
        var withP = tl.concat([p]), add = lsTourMin(withP, cfg.yard) - lsTourMin(tl, cfg.yard), save = (saveFrom - add) * wt;
        if (dayLoad(tk, withP) > 9 * 60) return;
        if (save >= 10 && (!best || save > best.save)) best = { p: p, from: from, to: d, save: save, fk: fk, tk: tk, near: tl.slice().sort(function (a, c) { return lsKm(p, a) - lsKm(p, c); })[0] };
      });
    });
    if (!best) break;
    week[best.fk] = week[best.fk].filter(function (x) { return x !== best.p; }); week[best.tk] = week[best.tk].concat([best.p]); moved[best.p.id] = 1;
    moves.push({ id: best.p.id, name: best.p.name, crew_id: best.p.crew_id || "", from: best.from, to: best.to, save_min: Math.round(best.save), near: best.near ? best.near.name : "", biweekly: best.p.freq === "biweekly" });
  }
  var total = moves.reduce(function (a, m) { return a + m.save_min; }, 0);
  return { moves: moves, save_min_week: total, yard: !!cfg.yard };
};
NO_LOCK.lsSuggestDays = 1;
/* Apply one suggestion: new service day from the next occurrence on; future untouched visits are re-planned. */
ACTIONS.lsMoveDay = function (me, b) {
  lsNeedOffice(me); var p = lsProp(b.id), d = Number(b.weekday); if (!(d >= 0 && d <= 6)) throw new Error("Pick a day.");
  var start = lsDay(new Date()); while (lsParse(start).getDay() !== d) start = lsAdd(start, 1);
  ACTIONS.lsSaveProperty(me, { prop: { id: p.id, weekday: String(d), start: start } });
  lsLog(me, "property", p.id, "moved to " + ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"][d] + "s to save driving");
  return { id: p.id, start: start };
};
/* Pricing check (planned): what each agreement pays per hour of crew time, including its share of the driving.
   Uses logged crew time from the last 90 days when there is some, otherwise the planned minutes per visit. */
ACTIONS.lsPricing = function (me, b) {
  if (!lsMoney(me)) throw new Error("That's #money."); var cfg = lsCfg(), W = lsWeek(), drive = {}, today = lsDay(new Date()), since = lsAdd(today, -90);
  Object.keys(W.week).forEach(function (k) {
    var list = W.week[k], pts = list.map(function (p) { return { lat: num(p.lat), lon: num(p.lon), p: p }; }), o = lsBestOrder(pts, cfg.yard);
    o.forEach(function (idx, i) { var from = i ? pts[o[i - 1]] : cfg.yard; var m = from ? lsEstMin(from, pts[idx]) : 0;
      if (i === o.length - 1 && cfg.yard) m += lsEstMin(pts[idx], cfg.yard);
      var id = pts[idx].p.id; drive[id] = (drive[id] || 0) + m; });
  });
  var logged = {}; rows("LsVisits").filter(function (v) { return v.status === "completed" && v.date >= since && v.kind === "maintenance"; }).forEach(function (v) {
    var mins = lsLabor(v).reduce(function (a, l) { return a + num(l.min); }, 0); if (!mins) return; var x = logged[v.property_id] = logged[v.property_id] || { n: 0, min: 0 }; x.n++; x.min += mins; });
  var out = rows("LsProps").filter(function (p) { return p.status === "active" && p.freq && p.freq !== "none" && !isTrue(p.sample); }).map(function (p) {
    var days = lsWds(p).length, perMonthVisits = lsVisitsPerMonth(p.freq) * (p.freq === "weekly" || p.freq === "biweekly" ? days : 1);
    var price = num(p.price), b2 = p.billing || "monthly", rev = !price ? 0 : b2 === "per_visit" ? price * perMonthVisits : b2 === "quarterly" ? price / 3 : b2 === "annual" ? price / 12 : price;
    var lg = logged[p.id], siteMin = lg ? lg.min / lg.n : num(p.visit_min || 60), size = lsCrewSize(p.crew_id);
    var cw = p.crew_id ? findBy("LsCrews", "id", p.crew_id) : null, ems = splitIds(cw && cw.members), rate = ems.length ? ems.reduce(function (a, e) { return a + lsRateOf(e); }, 0) / ems.length : cfg.rate;
    var driveMin = (drive[p.id] || 0) / days;                              // per visit, truck minutes
    var personHours = (siteMin + driveMin * size) * perMonthVisits / 60, cost = personHours * rate;
    return { id: p.id, name: p.name, revenue: Math.round(rev), visits: Math.round(perMonthVisits * 10) / 10, site_min: Math.round(siteMin), drive_min: Math.round(driveMin), crew: size, hours: Math.round(personHours * 10) / 10,
      cost: Math.round(cost), profit: Math.round(rev - cost), per_hour: personHours ? Math.round(rev / personHours) : null, logged: !!lg, no_price: !price, no_pin: !(p.lat && p.lon) };
  }).sort(function (a, c) { return (a.per_hour == null ? -1 : a.per_hour) - (c.per_hour == null ? -1 : c.per_hour); });
  return { rows: out, target: cfg.target, rate: cfg.rate, yard: !!cfg.yard };
};
NO_LOCK.lsPricing = 1;
["lsDayRoutes", "lsFixPins", "lsSettings", "lsSuggestDays", "lsMoveDay", "lsPricing"].forEach(function (a) { PREFETCH[a] = ["People", "Projects"].concat(LS_TABLES); });
/* The office sees the yard and the $/hour goal with everything else. */
var _lsHomeEst = ACTIONS.lsHome;
ACTIONS.lsHome = function (me, b) { var out = _lsHomeEst(me, b); if (out.role === "office") { var c = lsCfg(); out.yard = c.yard; if (out.money) out.target = c.target; } return out; };
