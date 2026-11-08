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
TABLES.LsCrews = ["id", "name", "members", "lead", "color", "skills", "hours", "sample", "vehicle"];
var lsFollowups = [];
TABLES.LsVisits = ["id", "property_id", "date", "plan_date", "series", "kind", "crew_id", "status", "reason", "stop", "est_min", "scope", "checklist", "notes", "problems",
  "photos_before", "photos_after", "materials", "labor", "travel_min", "started_at", "done_at", "done_by", "priority", "issue_id", "price", "sample", "updated_by", "updated_at"];
TABLES.LsIssues = ["id", "property_id", "at", "by_email", "by_name", "text", "photos", "urgency", "place", "status", "office_note", "visit_id", "source", "sample", "owner", "next_action", "next_date", "kind", "found_visit"];
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
function lsCrewsOf(me) { if (me.preview) return me.preview === "crew" && me.preview_ls ? rows("LsCrews").filter(function (c) { return c.id === me.preview_ls; }) : []; var e = normEmail(me.email); return rows("LsCrews").filter(function (c) { return splitIds(c.members).map(normEmail).indexOf(e) > -1 || normEmail(c.lead) === e; }); }
function lsClientProps(me) { if (me.preview) return me.preview === "client" && me.preview_ls ? rows("LsProps").filter(function (p) { return p.id === me.preview_ls && p.status !== "deleted"; }) : []; var e = normEmail(me.email); return rows("LsProps").filter(function (p) { return p.status !== "deleted" && splitIds(p.client_emails).map(normEmail).indexOf(e) > -1; }); }
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
  if (role === "client") return me.preview ? !!me.preview_ls && p.id === me.preview_ls : splitIds(p.client_emails).map(normEmail).indexOf(normEmail(me.email)) > -1;
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
    office_note: role === "office" ? i.office_note : (["included", "billable", "scheduled", "closed", "correction"].indexOf(i.status) > -1 ? i.office_note : ""), visit_id: i.visit_id, source: i.source, sample: isTrue(i.sample), kind: i.kind || "request",
    owner: role === "office" ? i.owner || "" : undefined, owner_name: role === "office" && i.owner ? personName(i.owner) : undefined, next_action: role === "office" ? i.next_action || "" : undefined, next_date: role === "office" ? i.next_date || "" : undefined };
}

/* ---- the one call each screen makes ---- */
ACTIONS.lsHome = function (me, b) {
  var role = lsRole(me); if (!role) return { role: "" };
  var today = lsDay(new Date()), from = /^\d{4}-\d\d-\d\d$/.test(b.from || "") ? b.from : lsAdd(today, -7), to = /^\d{4}-\d\d-\d\d$/.test(b.to || "") ? b.to : lsAdd(today, 21);
  if (role !== "client" && !me.preview) {
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
  if (f.vehicle != null) patch.vehicle = clean(f.vehicle, 80);
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
    if (b.followup === "more_time" || b.followup === "another_visit") { var fu = clean(b.followup_note, 600); if (!fu) throw new Error("Say what's left to do.");
      patch.outcome = b.followup; lsFollowups.push({ property_id: v.property_id, visit_id: v.id, kind: "followup", text: (b.followup === "more_time" ? "More time needed next visit: " : "Another visit needed: ") + fu }); }
  }
  else if (act === "cannot") { var why = clean(b.reason, 300); if (!why) throw new Error("Say why it can't be completed."); patch.status = b.status === "canceled" ? "canceled" : b.status === "weather" || b.outcome === "weather" ? "weather" : "blocked"; patch.reason = why;
    var oc = { inaccessible: "Property inaccessible", weather: "Weather delay", equipment: "Equipment problem" }[b.outcome]; if (oc) { patch.outcome = b.outcome; patch.reason = oc + ": " + why; } log = "marked " + patch.status + ": " + why; }
  else throw new Error("Unknown update.");
  update("LsVisits", "id", v.id, patch); if (log) lsLog(me, "visit", v.id, log);
  lsFollowups.splice(0).forEach(function (f) { insert("LsIssues", { id: newId("li"), property_id: f.property_id, at: now(), by_email: me.email, by_name: me.name, text: f.text, photos: "[]", urgency: "normal", place: "", status: "new", office_note: "", visit_id: f.visit_id, source: lsRole(me), sample: "", kind: f.kind, found_visit: f.visit_id }); lsLog(me, "issue", f.property_id, f.text.slice(0, 120)); });
  if (patch.status === "blocked" || patch.status === "weather") lsLog(me, "visit", v.id, "back to the office: " + patch.reason);
  return { visit: lsVisitOut(findBy("LsVisits", "id", v.id), lsRole(me), lsMoney(me)) };
};

/* ---- issues: clients, crews and the office report; the office decides what it is ---- */
ACTIONS.lsReportIssue = function (me, b) {
  var p = lsProp(b.property_id); if (!lsCanSeeProp(me, p)) throw new Error("Property not found.");
  var role = lsRole(me), text = clean(b.text, 3000); if (!text) throw new Error("Tell us what's going on.");
  var c = CacheService.getScriptCache(), k = "lsiss:" + pkey(me.email), n = Number(c.get(k) || 0); if (n >= 20) throw new Error("That's a lot of reports in an hour. Call us if it's urgent.");
  var photos = lsSaveImages(p, b.photos || [], role === "client" ? "Client report" : "Crew report");
  var row = { id: newId("li"), property_id: p.id, at: now(), by_email: me.email, by_name: me.name, text: text, photos: JSON.stringify(photos), urgency: ["low", "normal", "urgent"].indexOf(b.urgency) > -1 ? b.urgency : "normal",
    place: clean(b.place, 200), status: "new", office_note: "", visit_id: clean(b.visit_id, 40), source: role === "office" ? "office" : role, sample: "",
    kind: role === "crew" && b.recommend ? "recommendation" : "request", found_visit: clean(b.visit_id, 40) };                                    // crews recommend extra work; only the office decides if it's billable
  withLock(function () { _ROWS = {}; prefetch(["People", "Projects"].concat(LS_TABLES)); insert("LsIssues", row); lsLog(me, "issue", p.id, "reported: " + text.slice(0, 120)); });
  c.put(k, String(n + 1), 3600);
  if (role !== "office") notifyJesus(me.email, (row.urgency === "urgent" ? "🚨 URGENT · " : "") + "Maintenance issue at " + p.name, "<p><b>" + esc(me.name) + "</b> (" + role + ") reported:</p><blockquote>" + nl2br(esc(text)) + "</blockquote>" + (row.place ? "<p>Where: " + esc(row.place) + "</p>" : "") + button("Open the portal", CONFIG.PORTAL_URL));
  return { id: row.id };
};
ACTIONS.lsTriage = function (me, b) {
  lsNeedOffice(me); var i = findBy("LsIssues", "id", b.id); if (!i) throw new Error("Request not found.");
  var st = ["review", "included", "correction", "billable", "scheduled", "closed"].indexOf(b.status) > -1 ? b.status : i.status, patch = { status: st };
  if (b.office_note != null) patch.office_note = clean(b.office_note, 1000);
  if (b.owner != null) { var ow = normEmail(b.owner); if (ow && !isStaff(findPerson(ow) || {})) throw new Error("Pick someone from the office."); patch.owner = ow; }
  if (b.next_action != null) patch.next_action = clean(b.next_action, 200);
  if (b.next_date != null) patch.next_date = dateOrEmpty(b.next_date);
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
  var g = function (k, d) { var v = pr.getProperty(k); return v == null || v === "" ? d : num(v); };
  return { yard: parseJson(pr.getProperty("LS_YARD"), null), target: num(pr.getProperty("LS_TARGET")) || 75, rate: num(pr.getProperty("LS_DEFAULT_RATE")) || 32,
    load_min: g("LS_LOAD", 15), break_min: g("LS_BREAK", 30), break_at: g("LS_BREAK_AT", 690) };            // loading at the yard, lunch, and when lunch starts (11:30)
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
/* Straight-line estimate of drive minutes: roads ≈ 1.3× the straight line; town speed (~32 km/h) for the first 6 km,
   freeway speed (~70 km/h) after that. Only used when Google isn't asked (typical-week planning) or doesn't answer. */
function lsEstMin(a, b) { var r = lsKm(a, b) * 1.3; return r <= 6 ? r / 32 * 60 : 6 / 32 * 60 + (r - 6) / 70 * 60; }
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
  var n = stops.length, out = { order: [], legs: [], back_min: 0, back_km: 0, drive_min: 0, km: 0, real: false, poly: "" };
  if (!n) return out;
  var ord = keepOrder ? stops.map(function (x, i) { return i; }) : lsBestOrder(stops, yard);
  var seq = ord.map(function (i) { return stops[i]; });
  var straight = function () {
    out.legs = seq.map(function (s, i) { var from = i ? seq[i - 1] : yard; return from ? { min: Math.round(lsEstMin(from, s)), km: Math.round(lsKm(from, s) * 13.5) / 10 } : { min: 0, km: 0 }; });
    out.back_min = yard ? Math.round(lsEstMin(seq[n - 1], yard)) : 0; out.back_km = yard ? Math.round(lsKm(seq[n - 1], yard) * 13.5) / 10 : 0;
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
        if (yard) { out.legs = g.legs.slice(0, n); out.back_min = g.legs[n] ? g.legs[n].min : 0; out.back_km = g.legs[n] ? g.legs[n].km : 0; }
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
  var only = b.ids ? [].concat(b.ids).map(String) : null;
  rows("LsVisits").filter(function (v) { return v.date === date && v.status !== "canceled" && (!only || only.indexOf(v.id) > -1); }).forEach(function (v) { (groups[v.crew_id || ""] = groups[v.crew_id || ""] || []).push(v); });
  var props = {}; rows("LsProps").forEach(function (p) { props[p.id] = p; });
  var crews = Object.keys(groups).map(function (cid) {
    var vs = groups[cid].sort(lsStopCmp(props)), cw = cid ? findBy("LsCrews", "id", cid) : null, size = Math.max(1, splitIds(cw && cw.members).length || 1);
    var keep = !b.optimize, saved = vs.every(function (v) { return num(v.stop) > 0; });               // the map shows the same order as the list; optimizing is a suggestion
    var withLoc = vs.filter(function (v) { return lsRoutable(props[v.property_id]); }), noLoc = vs.filter(function (v) { return withLoc.indexOf(v) < 0; });
    var stops = withLoc.map(function (v) { var p = props[v.property_id]; return { lat: num(p.lat), lon: num(p.lon), v: v }; });
    var r = lsRouteFor(stops, cfg.yard, keep), seq = r.order.map(function (i) { return stops[i]; });
    var siteOf = function (v) { return lsOnSite(v, props[v.property_id], size); }, site = vs.reduce(function (a, v) { return a + siteOf(v).min; }, 0), hrs = lsCrewHours(cw);
    var o = { crew_id: cid, size: size, no_crew: !cw, hours: hrs, stops: seq.map(function (s, i) { var os = siteOf(s.v); return { visit_id: s.v.id, drive_min: r.legs[i] ? r.legs[i].min : 0, km: r.legs[i] ? r.legs[i].km : 0, site_min: os.min, site_src: os.src, person_min: num(s.v.est_min) }; })
        .concat(noLoc.map(function (v) { var os = siteOf(v); return { visit_id: v.id, drive_min: null, km: null, site_min: os.min, site_src: os.src, person_min: num(v.est_min), why: lsWhyNotRoutable(props[v.property_id]) }; })),
      back_min: r.back_min, back_km: r.back_km, drive_min: r.drive_min, km: r.km, site_min: Math.round(site), day_min: Math.round(site + r.drive_min), over: Math.round(site + r.drive_min) > hrs.end - hrs.start, real: r.real, poly: r.poly, missing: noLoc.length, kept: keep, saved: saved,
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
    update("LsProps", "id", p.id, { lat: String(g.lat), lon: String(g.lon), pin_q: g.sure ? "" : "approx" });
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
  if (b.load_min != null) pr.setProperty("LS_LOAD", String(Math.max(0, Math.min(120, Math.round(num(b.load_min))))));
  if (b.break_min != null) pr.setProperty("LS_BREAK", String(Math.max(0, Math.min(120, Math.round(num(b.break_min))))));
  if (b.break_at != null) { var ba = lsMinOf(lsHHMM(b.break_at)); if (ba == null) throw new Error("Write the break time like 11:30."); pr.setProperty("LS_BREAK_AT", String(ba)); }
  return { cfg: lsCfg() };
};
/* A typical week: which properties each crew does on each workday (biweekly ones count half). */
function lsWeek() {
  var week = {}, props = rows("LsProps").filter(function (p) { return p.status === "active" && (p.freq === "weekly" || p.freq === "biweekly") && lsRoutable(p); });
  props.forEach(function (p) { lsWds(p).forEach(function (d) { var k = (p.crew_id || "") + "|" + d; (week[k] = week[k] || []).push(p); }); });
  return { week: week, props: props };
}
function lsTourMin(list, yard) {
  if (!list.length) return 0; var pts = list.map(function (p) { return { lat: num(p.lat), lon: num(p.lon) }; }), o = lsBestOrder(pts, yard), s = 0;
  for (var i = 1; i < o.length; i++) s += lsEstMin(pts[o[i - 1]], pts[o[i]]);
  if (yard) s += lsEstMin(yard, pts[o[0]]) + lsEstMin(pts[o[o.length - 1]], yard);
  return s;
}
function lsCrewSize(cid) { var c = cid ? findBy("LsCrews", "id", cid) : null; return Math.max(1, splitIds(c && c.members).length || 1); }     // no crew yet = 1 person (and the screens say so)
/* Time on site (elapsed) vs labor (person-minutes): an elapsed override on the property wins; otherwise the work is split
   evenly between the people in the crew (90 person-min with 2 people ≈ 45 min on site). */
function lsOnSite(v, p, size) {
  var o = num(p && p.visit_dur); if (o > 0 && (!v || v.kind === "maintenance")) return { min: Math.round(o), src: "set" };
  var pm = num((v && v.est_min) || (p && p.visit_min) || 60); size = Math.max(1, size || 1);
  return { min: Math.max(5, Math.ceil(pm / size)), src: size > 1 ? "split" : "one" };
}
/* A property goes into drive times only with an exact pin: a street number in the address and not an "approximate" match. */
function lsRoutable(p) { return !!(p && p.lat && p.lon && /^\s*\d+[a-z]?\s+\S/i.test(String(p.address || "")) && p.pin_q !== "approx"); }
function lsWhyNotRoutable(p) { return !(p && p.lat && p.lon) ? "no map pin" : !/^\s*\d+[a-z]?\s+\S/i.test(String(p.address || "")) ? "address has no street number" : "approximate pin"; }
/* One stop order everywhere (list, map, crew phone, navigation): saved stop number, then property name, then id. */
function lsStopCmp(props) { return function (a, c) { var d = (num(a.stop) || 99) - (num(c.stop) || 99); if (d) return d; var na = String((props[a.property_id] || {}).name || ""), nc = String((props[c.property_id] || {}).name || ""); return na < nc ? -1 : na > nc ? 1 : a.id < c.id ? -1 : 1; }; }
/* Better days: move a property to the day its crew is already nearby. Greedy, up to 6 moves, each saving ≥ 10 min a week,
   never past a 9-hour day. Uses straight-line estimates for a typical week. */
ACTIONS.lsSuggestDays = function (me, b) {
  lsNeedOffice(me); var cfg = lsCfg(), W = lsWeek(), week = W.week, moves = [], moved = {};
  var dayLoad = function (k, list) { var sz = lsCrewSize(k.split("|")[0]); return lsTourMin(list, cfg.yard) + list.reduce(function (a, p) { return a + lsOnSite(null, p, sz).min; }, 0); };
  for (var round = 0; round < 6; round++) {
    var best = null;
    W.props.forEach(function (p) {
      if (moved[p.id] || lsWds(p).length !== 1) return;
      var cid = p.crew_id || "", from = lsWds(p)[0], fk = cid + "|" + from, fl = week[fk] || [], wt = p.freq === "biweekly" ? 0.5 : 1;
      var without = fl.filter(function (x) { return x !== p; }), saveFrom = lsTourMin(fl, cfg.yard) - lsTourMin(without, cfg.yard);
      LS_WORKDAYS.forEach(function (d) {
        if (d === from || !lsDayOk(p, d)) return; var tk = cid + "|" + d, tl = week[tk] || []; if (!tl.length) return;      // only to a day the crew already works and the client allows
        var withP = tl.concat([p]), add = lsTourMin(withP, cfg.yard) - lsTourMin(tl, cfg.yard), save = (saveFrom - add) * wt;
        if (dayLoad(tk, withP) > 9 * 60) return;
        if (save >= 10 && (!best || save > best.save)) best = { p: p, from: from, to: d, save: save, fk: fk, tk: tk, near: tl.slice().sort(function (a, c) { return lsKm(p, a) - lsKm(p, c); })[0] };
      });
    });
    if (!best) break;
    week[best.fk] = week[best.fk].filter(function (x) { return x !== best.p; }); week[best.tk] = week[best.tk].concat([best.p]); moved[best.p.id] = 1;
    var nearBy = week[best.tk].filter(function (x) { return x !== best.p; }).map(function (x) { return { name: x.name, mi: Math.round(lsKm(best.p, x) * 0.621 * 10) / 10 }; }).sort(function (a, c) { return a.mi - c.mi; }).slice(0, 4);
    var leftBehind = week[best.fk].map(function (x) { return x.name; }).slice(0, 4);
    moves.push({ id: best.p.id, name: best.p.name, city: best.p.city || "", crew_id: best.p.crew_id || "", from: best.from, to: best.to, save_min: Math.round(best.save), near: best.near ? best.near.name : "", near_mi: nearBy.length ? nearBy[0].mi : null,
      with: nearBy, was_with: leftBehind, biweekly: best.p.freq === "biweekly", freq: best.p.freq, days_ok: best.p.days_ok || "" });
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
  // Each property's share of the day's driving: what it adds, plus an even part of the shared trip. The last stop no longer pays the whole trip home.
  Object.keys(W.week).forEach(function (k) {
    var list = W.week[k], total = lsTourMin(list, cfg.yard); if (!list.length) return;
    var add = list.map(function (p) { return Math.max(0, total - lsTourMin(list.filter(function (x) { return x !== p; }), cfg.yard)); }), sum = add.reduce(function (a, x) { return a + x; }, 0);
    // each stop pays the driving it adds; the rest (the shared trip out and back) is split evenly
    list.forEach(function (p, i) { var share = sum > total ? total * add[i] / sum : add[i] + (total - sum) / list.length; drive[p.id] = (drive[p.id] || 0) + share; });
  });
  var logged = {}; rows("LsVisits").filter(function (v) { return v.status === "completed" && v.date >= since && v.kind === "maintenance"; }).forEach(function (v) {
    var mins = lsLabor(v).reduce(function (a, l) { return a + num(l.min); }, 0); if (!mins) return; var x = logged[v.property_id] = logged[v.property_id] || { n: 0, min: 0 }; x.n++; x.min += mins; });
  var out = rows("LsProps").filter(function (p) { return p.status === "active" && p.freq && p.freq !== "none" && !isTrue(p.sample); }).map(function (p) {
    var days = lsWds(p).length, perMonthVisits = lsVisitsPerMonth(p.freq) * (p.freq === "weekly" || p.freq === "biweekly" ? days : 1);
    var price = num(p.price), b2 = p.billing || "monthly", rev = !price ? 0 : b2 === "per_visit" ? price * perMonthVisits : b2 === "quarterly" ? price / 3 : b2 === "annual" ? price / 12 : price;
    var lg = logged[p.id], size = lsCrewSize(p.crew_id), siteMin = lg ? lg.min / lg.n : num(p.visit_dur) > 0 ? num(p.visit_dur) * size : num(p.visit_min || 60);   // person-minutes of labor
    var cw = p.crew_id ? findBy("LsCrews", "id", p.crew_id) : null, ems = splitIds(cw && cw.members), rate = ems.length ? ems.reduce(function (a, e) { return a + lsRateOf(e); }, 0) / ems.length : cfg.rate;
    var ownRate = ems.some(function (e) { return !!findBy("LsRates", "email", normEmail(e)); }), routable = lsRoutable(p), estOk = !!lg || isTrue(p.labor_ok);
    // What this row rests on. Anything missing makes it an estimate (or incomplete), never a conclusion.
    var gaps = []; if (!price) gaps.push("no agreement price"); if (!routable) gaps.push("address can't be routed, so driving isn't counted"); if (!p.crew_id) gaps.push("no crew: 1 person assumed");
    if (!estOk) gaps.push("time on site not confirmed"); if (!ownRate) gaps.push("default labor rate " + "$" + cfg.rate + "/h");
    var driveMin = (drive[p.id] || 0) / days;                              // per visit, truck minutes
    var personHours = (siteMin + driveMin * size) * perMonthVisits / 60, cost = personHours * rate;
    return { id: p.id, name: p.name, revenue: Math.round(rev), visits: Math.round(perMonthVisits * 10) / 10, site_min: Math.round(siteMin), drive_min: Math.round(driveMin), crew: size, hours: Math.round(personHours * 10) / 10,
      cost: Math.round(cost), contribution: price ? Math.round(rev - cost) : null, per_hour: price && personHours ? Math.round(rev / personHours) : null, logged: !!lg, no_price: !price, no_pin: !routable, no_crew: !p.crew_id, est_ok: estOk, own_rate: ownRate,
      gaps: gaps, confidence: !price || !routable ? "incomplete" : gaps.length ? "estimated" : lg ? "logged" : "planned" };
  }).sort(function (a, c) { return (a.per_hour == null ? -1 : a.per_hour) - (c.per_hour == null ? -1 : c.per_hour); });
  // F02: this is revenue minus crew labor (on site + driving). It is NOT profit: the exclusions travel with the numbers.
  return { rows: out, target: cfg.target, rate: cfg.rate, yard: !!cfg.yard, computed_at: now(), currency: "USD",
    basis: { period: "Per month, from a typical week of the current schedule", revenue: "Agreement price (not invoices or payments)", labor: "Person-minutes on site (logged in the last 90 days, otherwise planned) + driving × people in the truck, at each member's rate or the default",
      driving: "Estimated from distance (town and freeway speeds), not Google traffic" + (cfg.yard ? "; starts and ends at the yard" : "; the yard isn't set"),
      excluded: ["materials and dump fees", "fuel, vehicles and equipment", "payroll taxes, workers' comp and benefits (unless already in the rate)", "insurance, office and other overhead"] },
    reliable: out.filter(function (x) { return x.confidence === "planned" || x.confidence === "logged"; }).length };
};
NO_LOCK.lsPricing = 1;
["lsDayRoutes", "lsFixPins", "lsSettings", "lsSuggestDays", "lsMoveDay", "lsPricing"].forEach(function (a) { PREFETCH[a] = ["People", "Projects"].concat(LS_TABLES); });
/* The office sees the yard and the $/hour goal with everything else. */
var _lsHomeEst = ACTIONS.lsHome;
ACTIONS.lsHome = function (me, b) { var out = _lsHomeEst(me, b); if (out.role === "office") { var c = lsCfg(); out.yard = c.yard; if (out.money) out.target = c.target; } return out; };

/* ======================================================================================================
   Route planner: every property's drive from the office, a crew's day with arrival and departure times,
   locked appointment times, client access windows and allowed days, crew hours and equipment, the current
   order against the suggested one, and fuel stops (stations from OpenStreetMap, detours from Google).
   Times are minutes after midnight. Service time on site = planned person-minutes ÷ people in the crew.
   ====================================================================================================== */
["window_from", "window_to", "days_ok", "equipment", "visit_dur", "labor_ok", "pin_q"].forEach(function (k) { if (TABLES.LsProps.indexOf(k) < 0) TABLES.LsProps.push(k); });
if (TABLES.LsVisits.indexOf("fixed_time") < 0) TABLES.LsVisits.push("fixed_time");
function lsHHMM(x) {
  var m = String(x == null ? "" : x).trim().toLowerCase().replace(/\./g, "").match(/^(\d{1,2})(?::(\d\d))?\s*(am|pm|a|p)?$/); if (!m) return "";
  var h = +m[1], mi = +(m[2] || 0); if (m[3]) { if (h > 12 || h === 0) return ""; if (m[3][0] === "p" && h < 12) h += 12; if (m[3][0] === "a" && h === 12) h = 0; }
  if (h > 23 || mi > 59) return ""; return (h < 10 ? "0" : "") + h + ":" + (mi < 10 ? "0" : "") + mi;
}
function lsMinOf(hhmm) { var m = String(hhmm || "").match(/^(\d\d):(\d\d)$/); return m ? +m[1] * 60 + +m[2] : null; }
/* Crew hours from the free text on the crew ("7:00–3:30", "7am-4pm"). Default 7:00 AM – 3:30 PM. */
function lsCrewHours(c) {
  var t = String((c && c.hours) || "").toLowerCase().match(/\d{1,2}(?::\d\d)?\s*(?:am|pm|a|p)?/g) || [];
  var a = t[0] ? lsMinOf(lsHHMM(t[0])) : null, b = t[1] ? lsMinOf(lsHHMM(t[1])) : null;
  if (a == null) a = 420; if (b == null) b = a + 510; if (b <= a && !/[ap]/.test(t[1] || "")) b += 720; if (b <= a) b = a + 510;
  return { start: a, end: b, set: t.length >= 2 };
}
function lsDayList(x) { var l = String(x == null ? "" : x).split(",").map(function (d) { return String(d).trim(); }).filter(function (d) { return /^[0-6]$/.test(d); }); return l.filter(function (d, i) { return l.indexOf(d) === i; }).sort(); }
function lsDayOk(p, d) { var l = lsDayList(p.days_ok); return !l.length || l.indexOf(String(d)) > -1; }
var _lsPropOutPlan = lsPropOut;
lsPropOut = function (p, role, money) {
  var o = _lsPropOutPlan(p, role, money);
  if (role !== "client") { o.window_from = p.window_from || ""; o.window_to = p.window_to || ""; o.days_ok = lsDayList(p.days_ok).join(","); o.equipment = p.equipment || ""; o.visit_dur = num(p.visit_dur) || null; o.labor_ok = isTrue(p.labor_ok); o.pin_q = p.pin_q || ""; o.routable = lsRoutable(p); o.route_why = o.routable ? "" : lsWhyNotRoutable(p); }
  return o;
};
var _lsVisitOutPlan = lsVisitOut;
lsVisitOut = function (v, role, money) { var o = _lsVisitOutPlan(v, role, money); if (role !== "client") o.fixed_time = v.fixed_time || ""; return o; };
var _lsSavePropPlan = ACTIONS.lsSaveProperty;
ACTIONS.lsSaveProperty = function (me, b) {
  var f = b.prop || {}, patch = {};
  ["window_from", "window_to"].forEach(function (k) { if (f[k] == null) return; patch[k] = lsHHMM(f[k]); if (String(f[k]).trim() && !patch[k]) throw new Error("Write the access window like 8:00 or 2:30 PM."); });
  if (patch.window_from && patch.window_to && lsMinOf(patch.window_from) >= lsMinOf(patch.window_to)) throw new Error("The access window has to end after it starts.");
  if (f.days_ok != null) patch.days_ok = lsDayList([].concat(f.days_ok).join(",")).join(",");
  if (f.visit_dur != null) patch.visit_dur = String(f.visit_dur).trim() === "" ? "" : String(Math.max(5, Math.min(720, Math.round(num(f.visit_dur)) || 0)));
  if (f.labor_ok != null) patch.labor_ok = f.labor_ok ? "yes" : "";                        // the office confirmed the planned labor (the import's 90 is only a default)
  if (f.equipment != null) patch.equipment = String(f.equipment).split(",").map(function (x) { return clean(x, 40); }).filter(Boolean).slice(0, 10).join(", ");
  if (f.weekday != null && f.days_ok == null && f.id) { var cur = findBy("LsProps", "id", String(f.id)); if (cur && lsDayList(cur.days_ok).length) { var bad = lsDayList([].concat(f.weekday).join(",")).filter(function (d) { return !lsDayOk(cur, d); }); if (bad.length) throw new Error("The client doesn't allow " + bad.map(function (d) { return ["Sundays", "Mondays", "Tuesdays", "Wednesdays", "Thursdays", "Fridays", "Saturdays"][d]; }).join(" or ") + ". Change the allowed days first."); } }
  var before = f.id ? findBy("LsProps", "id", String(f.id)) : null, addrWas = before ? before.address + "|" + before.city : null;
  var r = _lsSavePropPlan(me, b), after = findBy("LsProps", "id", r.id);
  if (after && addrWas != null && after.address + "|" + after.city !== addrWas && after.pin_q) patch.pin_q = "";       // a new address = a new pin
  if (Object.keys(patch).length) update("LsProps", "id", r.id, patch);
  return r;
};
/* Google directions through a list of points (cached 6 h, same cache as the day routes). */
function lsDirections(pts) {
  var key = "dir2:" + pts.map(function (p) { return num(p.lat).toFixed(5) + "," + num(p.lon).toFixed(5); }).join("|");
  return lsCacheJson(key, 21600, function () {
    var f = Maps.newDirectionFinder().setMode(Maps.DirectionFinder.Mode.DRIVING).setOrigin(num(pts[0].lat), num(pts[0].lon)).setDestination(num(pts[pts.length - 1].lat), num(pts[pts.length - 1].lon));
    pts.slice(1, -1).forEach(function (p) { f.addWaypoint(num(p.lat), num(p.lon)); });
    var r = f.getDirections(); if (!r || r.status !== "OK" || !r.routes || !r.routes.length) return null;
    var rt = r.routes[0]; return { legs: rt.legs.map(function (l) { return { min: Math.round(l.duration.value / 60), km: Math.round(l.distance.value / 100) / 10 }; }), poly: rt.overview_polyline ? rt.overview_polyline.points : "" };
  });
}
function lsEstLeg(a, b, k) { return { min: Math.round(lsEstMin(a, b) * (k || 1)), km: Math.round(lsKm(a, b) * 13.5) / 10 }; }
/* Drive from the office to each property and back: Google once, then remembered (until the office moves). */
function lsOfficeStore() { return parseJson(PropertiesService.getScriptProperties().getProperty("LS_OD"), {}); }
function lsOfficeOf(store, y, p) {
  if (!y || !lsRoutable(p)) return null; var pt = { lat: num(p.lat), lon: num(p.lon) }, hit = store.y === y.lat.toFixed(4) + "," + y.lon.toFixed(4) && store.d ? store.d[pt.lat.toFixed(5) + "," + pt.lon.toFixed(5)] : null;
  return hit ? { min: hit[0], km: hit[1], back_min: hit[2], real: true } : { min: Math.round(lsEstMin(y, pt)), km: Math.round(lsKm(y, pt) * 13.5) / 10, real: false };
}
ACTIONS.lsOfficeDist = function (me, b) {
  lsNeedOffice(me); var y = lsCfg().yard; if (!y) return { yard: null, props: {} };
  var pr = PropertiesService.getScriptProperties(), yk = y.lat.toFixed(4) + "," + y.lon.toFixed(4), store = lsOfficeStore(), t0 = Date.now(), dirty = false, out = {};
  if (store.y !== yk || !store.d) store = { y: yk, d: {} };
  rows("LsProps").filter(function (p) { return p.status !== "ended" && p.status !== "deleted" && lsRoutable(p); }).forEach(function (p) {
    var pt = { lat: num(p.lat), lon: num(p.lon) }, k = pt.lat.toFixed(5) + "," + pt.lon.toFixed(5);
    if (!store.d[k] && Date.now() - t0 < 20000) { try { var g = lsDirections([y, pt, y]); if (g && g.legs.length === 2) { store.d[k] = [g.legs[0].min, g.legs[0].km, g.legs[1].min]; dirty = true; } } catch (e) { console.warn("office distance: " + e.message); } }
    out[p.id] = lsOfficeOf(store, y, p);
  });
  if (dirty) try { pr.setProperty("LS_OD", JSON.stringify(store)); } catch (e) { console.warn("LS_OD too big: " + e.message); }
  return { yard: y, props: out };
};
NO_LOCK.lsOfficeDist = 1;
/* The road from the office to one property (for the map when a property is picked). */
ACTIONS.lsPropLine = function (me, b) {
  lsNeedOffice(me); var y = lsCfg().yard, p = lsProp(b.id); if (!y || !(p.lat && p.lon)) return { poly: "" };
  var pt = { lat: num(p.lat), lon: num(p.lon) }, g = null; try { g = lsDirections([y, pt]); } catch (e) { console.warn("prop line: " + e.message); }
  return g ? { poly: g.poly, min: g.legs[0].min, km: g.legs[0].km, real: true } : { poly: "", min: Math.round(lsEstMin(y, pt)), km: Math.round(lsKm(y, pt) * 13.5) / 10, real: false };
};
NO_LOCK.lsPropLine = 1;
/* One fuel stop per crew and day, kept with the day's plan. pos = how many stops come before it (n = on the way back). */
function lsFuelKey(date, crew) { return "LSF:" + date + "|" + (crew || "-"); }
/* Extra stops (fuel, supplier, disposal) sit at a position: how many property stops come before them (n = on the way back). */
function lsExtras(list, n) {
  return [].concat(list || []).map(function (f, i) { return f && f.lat != null ? { fuel: true, kind: f.kind || "fuel", i: i, lat: num(f.lat), lon: num(f.lon), name: f.name || "Fuel", address: f.addr || "", id: f.id || "", place_id: f.place_id || "",
    svc: Math.max(5, Math.min(90, num(f.min) || 15)), pos: Math.max(0, Math.min(n, Math.round(num(f.pos)))) } : null; }).filter(Boolean).sort(function (a, b) { return a.pos - b.pos || a.i - b.i; });
}
function lsWithFuel(seq, list) {
  var nodes = seq.slice(), ex = lsExtras(list, seq.length);
  ex.forEach(function (f, k) { nodes.splice(f.pos + k, 0, f); }); return nodes;
}
/* Walk the day: arrive, wait for a locked time or the access window, work, leave. legs[i] = drive into node i. */
function lsTimeline(nodes, startMin, hrs, legs, back, opt) {
  opt = opt || {}; var load = opt.load || 0, brk = opt.brk || 0, brkAt = opt.brkAt == null ? 690 : opt.brkAt, took = !brk || !nodes.length, brkTotal = 0;
  var t = startMin + load, rowsOut = [], late = 0, wait = 0, drive = 0, km = 0, svc = 0, fuelMin = 0;
  nodes.forEach(function (s, i) {
    var b0 = 0; if (!took && t >= brkAt) { b0 = brk; t += brk; took = true; brkTotal += brk; }            // lunch when the crew leaves a stop after the break time
    var lg = legs[i] || { min: 0, km: 0 }; t += lg.min; drive += lg.min; km += lg.km;
    var arrive = t, w = 0, lt = 0, why = [];
    if (s.fixed != null) { if (t < s.fixed) w = s.fixed - t; else if (t > s.fixed + 10) { lt = t - s.fixed; why.push("late for the locked time"); } }
    if (s.wf != null && t + w < s.wf) w = s.wf - t;
    if (s.wt != null && t + w + s.svc > s.wt) { lt = Math.max(lt, t + w + s.svc - s.wt); why.push("runs past the access window"); }      // the work has to be done inside the window
    t += w; var st = t; t += s.svc; if (s.fuel) fuelMin += s.svc; else svc += s.svc; wait += w; late += lt;
    rowsOut.push({ node: s, drive_min: lg.min, km: lg.km, arrive: arrive, start: st, depart: t, wait: w, late: lt, why: why, brk: b0 });
  });
  if (back) { t += back.min; drive += back.min; km += back.km; }
  return { rows: rowsOut, drive_min: drive, km: Math.round(km * 10) / 10, svc_min: svc, fuel_min: fuelMin, wait_min: wait, late_min: late, start: startMin, leave: startMin + load, load_min: load, break_min: brkTotal, finish: t, end: hrs.end,
    over_min: Math.max(0, t - hrs.end), back_min: back ? back.min : 0, back_km: back ? back.km : 0, cost: drive + wait * 0.3 + late * 30 + Math.max(0, t - hrs.end) * 3 };
}
/* Legs for a sequence: Google when it answers (one call), otherwise straight-line estimates scaled by k. */
function lsLegsFor(nodes, origin, k) {
  var est = function () { return { real: false, poly: "", legs: nodes.map(function (s, i) { var f = i ? nodes[i - 1] : origin; return f ? lsEstLeg(f, s, k) : { min: 0, km: 0 }; }), back: origin && nodes.length ? lsEstLeg(nodes[nodes.length - 1], origin, k) : null }; };
  if (!nodes.length) return { real: false, poly: "", legs: [], back: null };
  var pts = (origin ? [origin] : []).concat(nodes, origin ? [origin] : []); if (pts.length < 2) return est();
  var g = null; try { g = lsDirections(pts); } catch (e) { console.warn("directions: " + e.message); }
  if (!g || g.legs.length !== pts.length - 1) return est();
  return origin ? { real: true, poly: g.poly, legs: g.legs.slice(0, nodes.length), back: g.legs[nodes.length] } : { real: true, poly: g.poly, legs: [{ min: 0, km: 0 }].concat(g.legs), back: null };
}
/* Best stop orders by estimated time (every order up to 8 stops, else nearest-neighbour + local moves). Top 3. */
function lsSolve(stops, origin, fuel, startMin, hrs, k) {
  var n = stops.length; if (n < 2) return [stops.map(function (x, i) { return i; })];
  var ex = lsExtras(fuel, n), all = stops.concat(ex, origin ? [origin] : []), O = origin ? all.length - 1 : -1;
  var M = all.map(function (a) { return all.map(function (c) { return a === c ? 0 : lsEstMin(a, c) * k; }); });
  var cost = function (ord) {
    var seq = ord.slice(); ex.forEach(function (f, x) { seq.splice(f.pos + x, 0, n + x); });
    var t = startMin, prev = O, drive = 0, wait = 0, late = 0;
    for (var i = 0; i < seq.length; i++) {
      var j = seq[i], s = all[j], d = prev < 0 ? 0 : M[prev][j], w = 0; t += d; drive += d;
      if (s.fixed != null) { if (t < s.fixed) w = s.fixed - t; else if (t > s.fixed + 10) late += t - s.fixed; }
      if (s.wf != null && t + w < s.wf) w = s.wf - t; if (s.wt != null && t + w + s.svc > s.wt) late += t + w + s.svc - s.wt;
      t += w + s.svc; wait += w; prev = j;
    }
    if (O >= 0 && prev >= 0) { t += M[prev][O]; drive += M[prev][O]; }
    return drive + wait * 0.3 + late * 30 + Math.max(0, t - hrs.end) * 3;
  };
  var top = [], keep = function (o) { var c = cost(o); if (top.length < 3 || c < top[top.length - 1].c) { top.push({ o: o.slice(), c: c }); top.sort(function (a, b) { return a.c - b.c; }); if (top.length > 3) top.pop(); } };
  if (n <= 8) {
    var a = stops.map(function (x, i) { return i; }), cc = a.map(function () { return 0; }), i = 0; keep(a);
    while (i < n) { if (cc[i] < i) { var sw = i % 2 ? cc[i] : 0, tmp = a[sw]; a[sw] = a[i]; a[i] = tmp; keep(a); cc[i]++; i = 0; } else { cc[i] = 0; i++; } }
  } else {
    var o = lsBestOrder(stops, origin), better = true, guard = 0;
    while (better && guard++ < 50) { better = false;
      for (var x = 0; x < n; x++) for (var y = 0; y < n; y++) { if (x === y) continue; var t2 = o.slice(), it = t2.splice(x, 1)[0]; t2.splice(y, 0, it); if (cost(t2) < cost(o) - 0.01) { o = t2; better = true; } } }
    keep(o);
  }
  return top.map(function (t) { return t.o; });
}
function lsPlanRows(tl, store, y) {
  return tl.rows.map(function (r) {
    var s = r.node;
    if (s.fuel) return { fuel: true, kind: s.kind, i: s.i, id: s.id, place_id: s.place_id, name: s.name, address: s.address, lat: s.lat, lon: s.lon, drive_min: r.drive_min, km: r.km, arrive: r.arrive, depart: r.depart, svc: s.svc, brk: r.brk };
    var od = lsOfficeOf(store, y, s.p);
    return { visit_id: s.v.id, property_id: s.p.id, lat: s.lat, lon: s.lon, drive_min: r.drive_min, km: r.km, arrive: r.arrive, start: r.start, depart: r.depart, wait: r.wait, late: r.late, why: r.why, svc: s.svc, svc_src: s.src, person_min: num(s.v.est_min),
      fixed: s.v.fixed_time || "", window: (s.wf != null || s.wt != null) ? [s.p.window_from || "", s.p.window_to || ""] : null, need: s.need, lack: s.lack, brk: r.brk,
      office_min: od ? od.min : null, office_km: od ? od.km : null, office_real: od ? od.real : false };
  });
}
function lsPlanOut(nodes, tl, lg, origin, store, y) {
  return { rows: lsPlanRows(tl, store, y), leave: tl.leave, load_min: tl.load_min, break_min: tl.break_min, drive_min: tl.drive_min, km: tl.km, svc_min: tl.svc_min, fuel_min: tl.fuel_min, wait_min: tl.wait_min, late_min: tl.late_min, start: tl.start, finish: tl.finish, end: tl.end, over_min: tl.over_min,
    back_min: tl.back_min, back_km: tl.back_km, real: lg.real, poly: lg.poly, order: nodes.filter(function (s) { return !s.fuel; }).map(function (s) { return s.v.id; }), maps: nodes.length ? lsMapsLink(nodes, origin) : "" };
}
/* A crew's day, planned: the current order (saved, or the one dragged on screen) and the best one, with times. */
ACTIONS.lsPlanDay = function (me, b) {
  lsNeedOffice(me);
  var date = dateOrEmpty(b.date) || lsDay(new Date()), crew = String(b.crew_id || ""), cfg = lsCfg(), pr = PropertiesService.getScriptProperties(), store = lsOfficeStore();
  var cw = crew ? findBy("LsCrews", "id", crew) : null, size = Math.max(1, splitIds(cw && cw.members).length || 1), hrs = lsCrewHours(cw), ids = b.ids ? [].concat(b.ids).map(String) : null;
  var vs = rows("LsVisits").filter(function (v) { return v.date === date && (v.crew_id || "") === crew && v.status !== "canceled" && (!ids || ids.indexOf(v.id) > -1); });
  var props = {}; rows("LsProps").forEach(function (p) { props[p.id] = p; });
  var origin = cfg.yard ? { address: cfg.yard.address, lat: cfg.yard.lat, lon: cfg.yard.lon, kind: "office" } : null;
  if (b.start) { var g0 = lsGeocode(clean(b.start, 300)); if (!g0) throw new Error("Google couldn't find that start address. Add the street number and city."); origin = { address: g0.address, lat: g0.lat, lon: g0.lon, kind: "custom" }; }
  var startMin = lsMinOf(lsHHMM(b.start_time)); if (startMin == null) startMin = hrs.start;
  var have = String((cw && cw.skills) || "").toLowerCase(), stops = [], missing = [];
  vs.forEach(function (v) {
    var p = props[v.property_id] || {};
    if (!lsRoutable(p)) { missing.push({ visit_id: v.id, property_id: p.id || "", name: p.name || "Visit", why: lsWhyNotRoutable(p) }); return; }
    var need = String(p.equipment || "").split(",").map(function (x) { return x.trim(); }).filter(Boolean), lack = cw ? need.filter(function (e) { return have.indexOf(e.toLowerCase()) < 0; }) : [];
    var os = lsOnSite(v, p, size);
    stops.push({ v: v, p: p, lat: num(p.lat), lon: num(p.lon), svc: os.min, src: os.src, wf: lsMinOf(p.window_from), wt: lsMinOf(p.window_to), fixed: lsMinOf(v.fixed_time), need: need, lack: lack });
  });
  var fuel = b.nofuel ? [] : lsDayExtras(date, crew);
  var ord = b.order ? [].concat(b.order).map(String) : null, cmp = lsStopCmp(props);
  var cur = stops.slice().sort(function (a, c) { if (ord) { var ia = ord.indexOf(a.v.id), ic = ord.indexOf(c.v.id); return (ia < 0 ? 999 : ia) - (ic < 0 ? 999 : ic) || cmp(a.v, c.v); } return cmp(a.v, c.v); }), saved = stops.length > 0 && stops.every(function (s) { return num(s.v.stop) > 0; });
  var curNodes = lsWithFuel(cur, fuel), curLg = lsLegsFor(curNodes, origin, 1), opt = { load: cfg.load_min, brk: cfg.break_min, brkAt: cfg.break_at }, curTl = lsTimeline(curNodes, startMin, hrs, curLg.legs, curLg.back, opt), current = lsPlanOut(curNodes, curTl, curLg, origin, store, cfg.yard);
  var suggested = null;
  if (stops.length > 1 && !b.nosuggest) {
    var est = { legs: curNodes.map(function (s, i) { var f = i ? curNodes[i - 1] : origin; return f ? lsEstLeg(f, s, 1) : { min: 0, km: 0 }; }) };
    var estDrive = est.legs.reduce(function (a, l) { return a + l.min; }, 0) + (origin ? lsEstLeg(curNodes[curNodes.length - 1], origin, 1).min : 0);
    var k = curLg.real && estDrive > 0 ? Math.max(0.6, Math.min(2.2, curTl.drive_min / estDrive)) : 1, best = null, t0 = Date.now();
    lsSolve(cur, origin, fuel, startMin + (origin ? cfg.load_min : 0), hrs, k).forEach(function (o, i) {
      var seq = o.map(function (j) { return cur[j]; }), nodes = lsWithFuel(seq, fuel);
      var lg = i === 0 || Date.now() - t0 < 15000 ? lsLegsFor(nodes, origin, k) : { real: false, poly: "", legs: nodes.map(function (s, x) { var f = x ? nodes[x - 1] : origin; return f ? lsEstLeg(f, s, k) : { min: 0, km: 0 }; }), back: origin ? lsEstLeg(nodes[nodes.length - 1], origin, k) : null };
      var tl = lsTimeline(nodes, startMin, hrs, lg.legs, lg.back, opt); if (!best || tl.cost < best.tl.cost) best = { nodes: nodes, tl: tl, lg: lg };
    });
    var same = best && best.nodes.map(function (s) { return s.fuel ? "f" : s.v.id; }).join() === curNodes.map(function (s) { return s.fuel ? "f" : s.v.id; }).join();
    if (best && !same && best.tl.cost < curTl.cost - 0.5) suggested = lsPlanOut(best.nodes, best.tl, best.lg, origin, store, cfg.yard);
  }
  return { date: date, crew_id: crew, size: size, no_crew: !cw, origin: origin, office: cfg.yard, start_time: startMin, hours: hrs, saved: saved, custom_order: !!ord, current: current, suggested: suggested,
    save_min: suggested ? current.drive_min - suggested.drive_min : 0, save_km: suggested ? Math.round((current.km - suggested.km) * 10) / 10 : 0, save_finish: suggested ? current.finish - suggested.finish : 0,
    missing: missing, fuel: fuel, extras: fuel, fuel_pref: parseJson(pr.getProperty("LS_FUELPREF"), { fuel: "gas", trailer: false }) };
};
NO_LOCK.lsPlanDay = 1;
/* Save an order as the crew's stop numbers (with each drive time). */
ACTIONS.lsSaveOrder = function (me, b) {
  lsNeedOffice(me); var r = ACTIONS.lsPlanDay(me, { date: b.date, crew_id: b.crew_id, order: b.order, start: b.start, start_time: b.start_time, nosuggest: true }), n = 0;
  r.current.rows.forEach(function (x) { if (x.fuel) return; n++; update("LsVisits", "id", x.visit_id, { stop: String(n), travel_min: String(x.drive_min) }); });
  r.missing.forEach(function (m) { n++; update("LsVisits", "id", m.visit_id, { stop: String(n), travel_min: "" }); });
  lsLog(me, "route", (r.crew_id || "-") + "|" + r.date, "saved the stop order (" + (r.current.real ? "Google drive times" : "estimated") + ", " + r.current.drive_min + " min driving)");
  return { stops: n, drive_min: r.current.drive_min, km: r.current.km, real: r.current.real, finish: r.current.finish };
};
/* Lock a visit to a fixed time (an appointment with the client). Empty time unlocks it. */
ACTIONS.lsFixTime = function (me, b) {
  lsNeedOffice(me); var v = findBy("LsVisits", "id", String(b.id || "")); if (!v) throw new Error("Visit not found.");
  var t = lsHHMM(b.time); if (String(b.time || "").trim() && !t) throw new Error("Write the time like 9:30 or 1:15 PM.");
  update("LsVisits", "id", v.id, { fixed_time: t, updated_by: me.email, updated_at: now() }); lsLog(me, "visit", v.id, t ? "locked the visit at " + t : "unlocked the visit time");
  return { id: v.id, fixed_time: t };
};
/* ---- fuel ---- */
function lsFuelRecs() { return parseJson(PropertiesService.getScriptProperties().getProperty("LS_FUEL"), {}); }
var LS_OVERPASS = ["https://overpass-api.de/api/interpreter", "https://overpass.kumi.systems/api/interpreter", "https://overpass.private.coffee/api/interpreter", "https://maps.mail.ru/osm/tools/overpass/api/interpreter"], LS_OSM_ERR = "";
/* One Overpass request (several servers, the first that answers). No caching here. */
function lsOverpassFetch(s, w, n, e) {
    var q = "[out:json][timeout:90];nwr[\"amenity\"=\"fuel\"](" + [s, w, n, e].map(function (x) { return x.toFixed(4); }).join(",") + ");out center tags 4000;";
    var j = null; LS_OSM_ERR = "";
    LS_OVERPASS.some(function (url) {                                   // the public Overpass servers sometimes refuse or are busy: try the next one
      try { var r = UrlFetchApp.fetch(url + "?data=" + encodeURIComponent(q), { muteHttpExceptions: true, headers: { "User-Agent": "BlueSierraPortal/1.0 (landscape maintenance routing; info@bluesierracorp.com)", Accept: "application/json" } });
        var t = r.getContentText(), code = r.getResponseCode();
        if (code === 200 && /^\s*\{/.test(t)) { var x = JSON.parse(t); if (x && Array.isArray(x.elements)) { j = x; return true; } }
        LS_OSM_ERR += url.split("/")[2] + " " + code + "; ";
      } catch (e) { LS_OSM_ERR += url.split("/")[2] + " " + e.message.slice(0, 60) + "; "; }
      return false;
    });
    if (!j) { console.warn("overpass: " + LS_OSM_ERR); return null; }
    return (j.elements || []).map(function (el) {
      var t = el.tags || {}, c = el.center || el; if (c.lat == null) return null;
      return { id: el.type.charAt(0) + el.id, lat: Math.round(c.lat * 1e6) / 1e6, lon: Math.round(c.lon * 1e6) / 1e6, name: t.name || t.brand || "Gas station", brand: t.brand || "",
        addr: [[t["addr:housenumber"], t["addr:street"]].filter(Boolean).join(" "), t["addr:city"]].filter(Boolean).join(", "), hours: t.opening_hours || "",
        diesel: t["fuel:diesel"] || "", gas: t["fuel:octane_87"] || t["fuel:octane_89"] || t["fuel:octane_91"] || t["fuel:octane_93"] || "", hgv: t.hgv || "" };
    }).filter(Boolean);
}
/* Every station in the service area (yard + all properties), fetched once and kept 6 h: Overpass can take ~40 s. */
function lsFuelArea() {
  var y = lsCfg().yard, pts = rows("LsProps").filter(function (p) { return p.status === "active" && lsRoutable(p); }).map(function (p) { return { lat: num(p.lat), lon: num(p.lon) }; }); if (y) pts.push(y); if (!pts.length) return null;
  var a = { s: 90, w: 180, n: -90, e: -180 }; pts.forEach(function (p) { a.s = Math.min(a.s, p.lat); a.n = Math.max(a.n, p.lat); a.w = Math.min(a.w, p.lon); a.e = Math.max(a.e, p.lon); });
  var dn = function (x) { return Math.floor(x / 0.05) * 0.05; }, up = function (x) { return Math.ceil(x / 0.05) * 0.05; };
  a = { s: dn(a.s - 0.06), w: dn(a.w - 0.06), n: up(a.n + 0.06), e: up(a.e + 0.06) };
  if (a.n - a.s > 1.4 || a.e - a.w > 1.4) return null;                      // too spread out for one request
  return a;
}
function lsFuelAll(fetchIfMissing, force) {
  var a = lsFuelArea(); if (!a) return null; var key = "osmarea:" + [a.s, a.w, a.n, a.e].map(function (x) { return x.toFixed(2); }).join(",");
  var hit = force ? null : cacheGetBig(key); if (hit) return { area: a, list: hit };
  if (!fetchIfMissing) return null;
  var list = lsOverpassFetch(a.s, a.w, a.n, a.e); if (!list) return null;
  cachePutBig(key, list, 21600); PropertiesService.getScriptProperties().setProperty("LS_FUEL_AT", String(Date.now()));
  return { area: a, list: list };
}
function lsOsmFuel(s, w, n, e) {
  var all = lsFuelAll(true);
  if (all && s >= all.area.s && n <= all.area.n && w >= all.area.w && e <= all.area.e) return all.list.filter(function (x) { return x.lat >= s && x.lat <= n && x.lon >= w && x.lon <= e; });
  var key = "osmfuel:" + [s, w, n, e].map(function (x) { return x.toFixed(2); }).join(",");
  return lsCacheJson(key, 21600, function () { return lsOverpassFetch(s, w, n, e); });
}
/* Keep the station list fresh in the background (every 4 h), so a fuel search answers right away. */
function lsWarm() { try { var at = Number(PropertiesService.getScriptProperties().getProperty("LS_FUEL_AT") || 0); if (Date.now() - at > 4.5 * 3600000 || !lsFuelAll(false)) lsFuelAll(true, true); return "ok"; } catch (e) { console.warn("lsWarm: " + e.message); return "error"; } }
function lsWarmEnsure() {
  var pr = PropertiesService.getScriptProperties(); if (pr.getProperty("LS_WARM") === "1") return;
  try { var has = ScriptApp.getProjectTriggers().some(function (t) { return t.getHandlerFunction() === "lsWarm"; });
    if (!has) ScriptApp.newTrigger("lsWarm").timeBased().everyHours(4).create(); pr.setProperty("LS_WARM", "1"); } catch (e) { console.warn("lsWarmEnsure: " + e.message); }
}
function lsDecodePoly(str) {
  var i = 0, lat = 0, lng = 0, out = []; str = String(str || "");
  while (i < str.length) { var b, sh = 0, res = 0; do { b = str.charCodeAt(i++) - 63; res |= (b & 31) << sh; sh += 5; } while (b >= 32); lat += res & 1 ? ~(res >> 1) : res >> 1;
    sh = 0; res = 0; do { b = str.charCodeAt(i++) - 63; res |= (b & 31) << sh; sh += 5; } while (b >= 32); lng += res & 1 ? ~(res >> 1) : res >> 1; out.push({ lat: lat / 1e5, lon: lng / 1e5 }); }
  return out;
}
/* Stations near the office or along the planned route, best detour first. */
ACTIONS.lsFuelFind = function (me, b) {
  lsNeedOffice(me); var pr = PropertiesService.getScriptProperties(), prefs = { fuel: b.fuel === "diesel" ? "diesel" : "gas", trailer: !!b.trailer };
  pr.setProperty("LS_FUELPREF", JSON.stringify(prefs));
  var plan = ACTIONS.lsPlanDay(me, { date: b.date, crew_id: b.crew_id, ids: b.ids, order: b.order, start: b.start, start_time: b.start_time, nosuggest: true, nofuel: true });
  var origin = plan.origin, stops = plan.current.rows.map(function (r) { return { lat: r.lat, lon: r.lon }; }), near = b.near === "office" || !stops.length ? "office" : "route";
  if (near === "office" && !origin) throw new Error("Set the office address first, or plan stops for this day.");
  var line = near === "office" ? [origin] : (origin ? [origin] : []).concat(stops).concat(plan.current.poly ? lsDecodePoly(plan.current.poly).filter(function (x, i) { return i % 4 === 0; }) : []);
  var pad = near === "office" ? 0.045 : 0.02, s = Infinity, w = Infinity, n = -Infinity, e = -Infinity;
  line.forEach(function (p) { s = Math.min(s, p.lat); n = Math.max(n, p.lat); w = Math.min(w, p.lon); e = Math.max(e, p.lon); }); s -= pad; n += pad; w -= pad; e += pad;
  if (n - s > 1.2 || e - w > 1.2) { var cy = (n + s) / 2, cx = (e + w) / 2; s = cy - 0.6; n = cy + 0.6; w = cx - 0.6; e = cx + 0.6; }
  // The office's browser usually brings the station list (Overpass is slow for Google's shared servers); otherwise ask from here.
  var raw = null;
  if (b.stations && b.stations.length) raw = lsCleanStations(b.stations).filter(function (x) { return x.lat >= s && x.lat <= n && x.lon >= w && x.lon <= e; });
  else try { raw = lsOsmFuel(s, w, n, e); } catch (er) { console.warn("overpass: " + er.message); }
  if (!raw) return { prefs: prefs, near: near, stations: [], err: "The station map (OpenStreetMap) didn't answer. Try again in a minute.", detail: LS_OSM_ERR };
  var recs = lsFuelRecs(), seqPts = (origin ? [origin] : []).concat(stops), nS = stops.length;
  var pairs = [];                                                                       // [pos, from, to]; pos = stops before the station
  if (near === "office") pairs.push([0, origin, stops.length ? stops[0] : origin]);
  else { for (var i = 0; i < seqPts.length - 1; i++) pairs.push([origin ? i : i + 1, seqPts[i], seqPts[i + 1]]); if (origin) pairs.push([nS, stops[nS - 1], origin]); else pairs.push([nS, stops[nS - 1], null]); }
  var list = raw.filter(function (st) { var r = recs[st.id] || {}; return !(prefs.fuel === "diesel" && (st.diesel === "no" || r.diesel === "no")) && !(prefs.trailer && r.trailer === "no"); }).map(function (st) {
    var bestP = null; pairs.forEach(function (pp) { var d = pp[2] ? lsEstMin(pp[1], st) + lsEstMin(st, pp[2]) - lsEstMin(pp[1], pp[2]) : lsEstMin(pp[1], st); if (!bestP || d < bestP.d) bestP = { d: d, p: pp }; });
    return { st: st, d: bestP.d, pair: bestP.p };
  }).sort(function (a, c) { return a.d - c.d; }).slice(0, 8);
  var t0 = Date.now(), base = {};
  list.forEach(function (x, i) {
    x.real = false; x.min = Math.max(0, Math.round(x.d));
    if (Date.now() - t0 > 20000) return;                                  // every station shown gets a Google detour (cached 6 h)
    try { var A = x.pair[1], B = x.pair[2], via = B ? lsDirections([A, x.st, B]) : lsDirections([A, x.st]); if (!via) { x.err = "no route"; return; }
      var bk = B ? A.lat + "," + A.lon + ">" + B.lat + "," + B.lon : "", ab = !B ? { legs: [{ min: 0 }] } : base[bk] || (base[bk] = lsDirections([A, B])); if (!ab) { x.err = "no base route"; return; }
      x.min = Math.max(0, via.legs.reduce(function (a, l) { return a + l.min; }, 0) - ab.legs[0].min); x.real = true; } catch (er) { x.err = er.message.slice(0, 120); console.warn("fuel detour: " + er.message); }
  });
  list.sort(function (a, c) { return a.min - c.min; });
  return { prefs: prefs, near: near, n_stops: nS, has_origin: !!origin, source: "OpenStreetMap", stations: list.map(function (x) {
    var r = recs[x.st.id] || null; return Object.assign({}, x.st, { detour_min: x.min, detour_real: x.real, detour_err: x.err || undefined, pos: x.pair[0], rec: r });
  }) };
};
NO_LOCK.lsFuelFind = 1;
/* What the office knows about a station (truck/trailer access, diesel, hours), marked as checked by them. */
ACTIONS.lsFuelNote = function (me, b) {
  lsNeedOffice(me); var id = clean(b.id, 40); if (!/^[nwr]\d+$/.test(id)) throw new Error("Unknown station.");
  var recs = lsFuelRecs(), r = { name: clean(b.name, 80), trailer: ["ok", "tight", "no"].indexOf(b.trailer) > -1 ? b.trailer : "", diesel: ["yes", "no"].indexOf(b.diesel) > -1 ? b.diesel : "", note: clean(b.note, 200), by: personName(me.email) || me.email, at: lsDay(new Date()) };
  recs[id] = r; var keys = Object.keys(recs); if (keys.length > 120) delete recs[keys[0]];
  PropertiesService.getScriptProperties().setProperty("LS_FUEL", JSON.stringify(recs)); return { id: id, rec: r };
};
/* Put a station in the day (or take it out). */
ACTIONS.lsFuelSet = function (me, b) {
  lsNeedOffice(me); var date = dateOrEmpty(b.date); if (!date) throw new Error("Pick a day."); var pr = PropertiesService.getScriptProperties(), key = lsFuelKey(date, String(b.crew_id || ""));
  var old = lsAdd(lsDay(new Date()), -14); Object.keys(pr.getProperties()).forEach(function (k) { if (k.indexOf("LSF:") === 0 && k.slice(4, 14) < old) pr.deleteProperty(k); });
  var list = lsDayExtras(date, String(b.crew_id || "")).filter(function (x) { return x.kind !== "fuel"; }); pr.deleteProperty(key);
  if (b.clear) { lsSaveExtras(date, String(b.crew_id || ""), list); return { ok: true }; }
  var st = b.station || {}; if (st.lat == null || st.lon == null) throw new Error("Pick a station.");
  var f = { kind: "fuel", id: clean(st.id, 40), name: clean(st.name, 80) || "Fuel", addr: clean(st.addr, 160), lat: Math.round(num(st.lat) * 1e6) / 1e6, lon: Math.round(num(st.lon) * 1e6) / 1e6, pos: Math.max(0, Math.round(num(b.pos))), min: Math.max(5, Math.min(60, Math.round(num(b.min)) || 15)) };
  lsSaveExtras(date, String(b.crew_id || ""), list.concat([f])); lsLog(me, "route", (b.crew_id || "-") + "|" + date, "added a fuel stop: " + f.name);
  return { fuel: f };
};
var _lsMoveDayPlan = ACTIONS.lsMoveDay;
ACTIONS.lsMoveDay = function (me, b) { var p = lsProp(b.id); if (!lsDayOk(p, b.weekday)) throw new Error("The client doesn't allow that day."); return _lsMoveDayPlan(me, b); };
["lsOfficeDist", "lsPropLine", "lsPlanDay", "lsSaveOrder", "lsFixTime", "lsFuelFind", "lsFuelNote", "lsFuelSet"].forEach(function (a) { PREFETCH[a] = ["People", "Projects"].concat(LS_TABLES); });

/* Preview (Jesús only): the list to pick which property's client, or which crew, to see the portal as. Names only. */
var _lsHomePlan = ACTIONS.lsHome;
ACTIONS.lsHome = function (me, b) {
  var out = _lsHomePlan(me, b);
  if (me.preview) out.pick = me.preview === "client" ? rows("LsProps").filter(function (p) { return p.status !== "deleted"; }).map(function (p) { return { id: p.id, name: p.name, has_client: !!splitIds(p.client_emails).length }; })
    : me.preview === "crew" ? rows("LsCrews").map(function (c) { return { id: c.id, name: c.name }; }) : [];
  return out;
};

/* Dispatch extras: each crew's vehicle, and the yard routine (loading, lunch) for the office. */
var _lsHomeDisp = ACTIONS.lsHome;
ACTIONS.lsHome = function (me, b) {
  var out = _lsHomeDisp(me, b);
  if (out.role === "office" || out.role === "crew") (out.crews || []).forEach(function (c) { var r = findBy("LsCrews", "id", c.id); c.vehicle = r ? r.vehicle || "" : ""; });
  if (out.role === "office") { var cf = lsCfg(); out.day_cfg = { load_min: cf.load_min, break_min: cf.break_min, break_at: cf.break_at }; }
  return out;
};
/* Before moving a property to another recurring day: which future visits move (and to which date), which stay, and any client restriction. Nothing changes. */
ACTIONS.lsMoveDayPreview = function (me, b) {
  lsNeedOffice(me); var p = lsProp(b.id), d = Number(b.weekday); if (!(d >= 0 && d <= 6)) throw new Error("Pick a day.");
  var today = lsDay(new Date()), start = today; while (lsParse(start).getDay() !== d) start = lsAdd(start, 1);
  var fut = rows("LsVisits").filter(function (v) { return v.property_id === p.id && v.series === "rec" && v.date >= today && v.status !== "canceled"; }).sort(function (a, c) { return a.date < c.date ? -1 : 1; });
  var moves = fut.filter(function (v) { return v.status === "scheduled" && v.date === v.plan_date && !v.started_at; }), stays = fut.filter(function (v) { return moves.indexOf(v) < 0; });
  var newDates = lsPlanDates(Object.assign({}, p, { weekday: String(d), start: start }), today, lsAdd(today, 35));
  return { id: p.id, name: p.name, from: lsWds(p).join(","), to: d, start: start, allowed: lsDayOk(p, d), days_ok: lsDayList(p.days_ok).join(","), multi: lsWds(p).length > 1,
    remove: moves.map(function (v) { return v.date; }), add: newDates, stay: stays.map(function (v) { return { date: v.date, status: v.status, moved: v.date !== v.plan_date }; }) };
};
NO_LOCK.lsMoveDayPreview = 1;
PREFETCH.lsMoveDayPreview = ["People", "Projects"].concat(LS_TABLES);

/* ======================================================================================================
   Batch 3: extra stops (fuel, supplier, disposal) as real appointments, saved places, crew outcomes,
   the office's request queue (owner, next action, the chain to estimate / work order / report),
   the effect of an urgent visit on a day before inserting it, client messages, seasonal opportunities.
   ====================================================================================================== */
if (TABLES.LsVisits.indexOf("outcome") < 0) TABLES.LsVisits.push("outcome");
TABLES.LsPlaces = ["id", "kind", "name", "address", "lat", "lon", "hours", "notes", "min", "preferred", "trailer", "diesel", "osm_id", "checked_by", "checked_at", "status"];
TABLES.LsOpps = ["id", "property_id", "service", "reason", "timing", "owner", "status", "est_id", "visit_id", "created_at", "created_by", "key", "note"];
["LsPlaces", "LsOpps"].forEach(function (t) { if (LS_TABLES.indexOf(t) < 0) LS_TABLES.push(t); });
var LS_PLACE_KINDS = { fuel: "Fuel", supplier: "Supplier", disposal: "Disposal / green waste" };
var _lsVisitOutB3 = lsVisitOut;
lsVisitOut = function (v, role, money) { var o = _lsVisitOutB3(v, role, money); if (role !== "client") o.outcome = v.outcome || ""; return o; };
function lsExKey(date, crew) { return "LSX:" + date + "|" + (crew || "-"); }
function lsDayExtras(date, crew) {
  var pr = PropertiesService.getScriptProperties(), list = parseJson(pr.getProperty(lsExKey(date, crew)), []), old = parseJson(pr.getProperty(lsFuelKey(date, crew)), null);
  if (old && old.lat != null) list = list.concat([Object.assign({ kind: "fuel" }, old)]);                     // a fuel stop saved before extra stops existed
  return list;
}
function lsSaveExtras(date, crew, list) {
  var pr = PropertiesService.getScriptProperties(), old = lsAdd(lsDay(new Date()), -14);
  Object.keys(pr.getProperties()).forEach(function (k) { if ((k.indexOf("LSX:") === 0 || k.indexOf("LSF:") === 0) && k.slice(4, 14) < old) pr.deleteProperty(k); });
  pr.deleteProperty(lsFuelKey(date, crew));
  if (list.length) pr.setProperty(lsExKey(date, crew), JSON.stringify(list.slice(0, 8))); else pr.deleteProperty(lsExKey(date, crew));
}
function lsPlaceOut(p) { return { id: p.id, kind: p.kind, name: p.name, address: p.address, lat: p.lat ? num(p.lat) : null, lon: p.lon ? num(p.lon) : null, hours: p.hours, notes: p.notes, min: num(p.min) || 15,
  preferred: isTrue(p.preferred), trailer: p.trailer || "", diesel: p.diesel || "", osm_id: p.osm_id || "", checked_by: p.checked_by ? personName(p.checked_by) : "", checked_at: p.checked_at || "" }; }
/* Places the office uses: preferred fuel station, suppliers, dump / green-waste sites. */
ACTIONS.lsSavePlace = function (me, b) {
  lsNeedOffice(me); var f = b.place || {}, old = f.id ? findBy("LsPlaces", "id", String(f.id)) : null; if (f.id && !old) throw new Error("Place not found.");
  if (f.remove) { update("LsPlaces", "id", old.id, { status: "deleted" }); return { id: old.id }; }
  var patch = { kind: LS_PLACE_KINDS[f.kind] ? f.kind : (old ? old.kind : "supplier"), name: clean(f.name, 80) || (old && old.name), address: f.address != null ? clean(f.address, 200) : old ? old.address : "",
    hours: f.hours != null ? clean(f.hours, 120) : old ? old.hours : "", notes: f.notes != null ? clean(f.notes, 300) : old ? old.notes : "", min: String(Math.max(5, Math.min(90, Math.round(num(f.min)) || (old ? num(old.min) : 15) || 15))),
    preferred: f.preferred != null ? (f.preferred ? "yes" : "") : old ? old.preferred : "", trailer: f.trailer != null ? (["ok", "tight", "no"].indexOf(f.trailer) > -1 ? f.trailer : "") : old ? old.trailer : "",
    diesel: f.diesel != null ? (["yes", "no"].indexOf(f.diesel) > -1 ? f.diesel : "") : old ? old.diesel : "", osm_id: f.osm_id != null ? clean(f.osm_id, 40) : old ? old.osm_id : "", status: "active" };
  if (!patch.name) throw new Error("Give the place a name.");
  if (f.trailer != null || f.diesel != null || f.hours != null) { patch.checked_by = me.email; patch.checked_at = lsDay(new Date()); }
  if (f.lat != null && f.lon != null) { patch.lat = String(num(f.lat)); patch.lon = String(num(f.lon)); }
  else if (patch.address && (!old || patch.address !== old.address)) { var g = lsGeocode(patch.address); if (!g) throw new Error("Google couldn't find that address. Add the street number and city."); patch.lat = String(g.lat); patch.lon = String(g.lon); patch.address = g.address; }
  if (!patch.lat && !(old && old.lat)) throw new Error("Add the address so it can go on the route.");
  if (patch.preferred && patch.kind === "fuel") rows("LsPlaces").forEach(function (x) { if (x.kind === "fuel" && isTrue(x.preferred) && (!old || x.id !== old.id)) update("LsPlaces", "id", x.id, { preferred: "" }); });
  if (old) { update("LsPlaces", "id", old.id, patch); return { id: old.id }; }
  patch.id = newId("pl"); insert("LsPlaces", patch); lsLog(me, "place", patch.id, "added " + patch.kind + " place " + patch.name); return { id: patch.id };
};
/* Add a fuel / supplier / disposal stop to a crew's day, or take one out. */
ACTIONS.lsStopAdd = function (me, b) {
  lsNeedOffice(me); var date = dateOrEmpty(b.date); if (!date) throw new Error("Pick a day."); var crew = String(b.crew_id || ""), list = lsDayExtras(date, crew), st;
  if (b.place_id) { var pl = findBy("LsPlaces", "id", String(b.place_id)); if (!pl || pl.status === "deleted") throw new Error("Place not found."); st = { kind: pl.kind, place_id: pl.id, name: pl.name, addr: pl.address, lat: num(pl.lat), lon: num(pl.lon), min: num(b.min) || num(pl.min) || 15 }; }
  else { var s0 = b.station || {}; if (s0.lat == null) throw new Error("Pick a place."); st = { kind: LS_PLACE_KINDS[b.kind] ? b.kind : "fuel", id: clean(s0.id, 40), name: clean(s0.name, 80) || "Stop", addr: clean(s0.addr, 160), lat: num(s0.lat), lon: num(s0.lon), min: num(b.min) || 15 }; }
  st.pos = Math.max(0, Math.round(num(b.pos))); st.min = Math.max(5, Math.min(90, Math.round(st.min)));
  if (list.length >= 8) throw new Error("That's enough extra stops for one day."); list.push(st); lsSaveExtras(date, crew, list);
  lsLog(me, "route", (crew || "-") + "|" + date, "added a " + st.kind + " stop: " + st.name); return { extras: list };
};
ACTIONS.lsStopRemove = function (me, b) {
  lsNeedOffice(me); var date = dateOrEmpty(b.date), crew = String(b.crew_id || ""), list = lsDayExtras(date, crew), i = Number(b.i); if (!list[i]) throw new Error("Stop not found.");
  var gone = list.splice(i, 1)[0]; lsSaveExtras(date, crew, list); lsLog(me, "route", (crew || "-") + "|" + date, "removed the " + gone.kind + " stop " + gone.name); return { extras: list };
};
/* Fuel: the preferred station (and other saved ones) come first, marked as checked by the office. */
var _lsFuelFindB3 = ACTIONS.lsFuelFind;
ACTIONS.lsFuelFind = function (me, b) {
  var r = _lsFuelFindB3(me, b), saved = rows("LsPlaces").filter(function (p) { return p.kind === "fuel" && p.status !== "deleted" && p.lat; });
  (r.stations || []).forEach(function (s) { var pl = saved.filter(function (p) { return p.osm_id === s.id; })[0]; if (pl) { s.place = lsPlaceOut(pl); } });
  saved.forEach(function (pl) { if ((r.stations || []).some(function (s) { return s.place && s.place.id === pl.id; })) return;
    if (r.prefs && r.prefs.fuel === "diesel" && pl.diesel === "no") return;
    (r.stations = r.stations || []).push({ id: pl.osm_id || pl.id, name: pl.name, addr: pl.address, lat: num(pl.lat), lon: num(pl.lon), hours: pl.hours || "", diesel: pl.diesel || "", gas: "", hgv: "", detour_min: null, detour_real: false, pos: 0, place: lsPlaceOut(pl) }); });
  (r.stations || []).sort(function (a, c) { var pa = a.place && a.place.preferred ? 0 : 1, pc = c.place && c.place.preferred ? 0 : 1; return pa - pc || (a.detour_min == null ? 999 : a.detour_min) - (c.detour_min == null ? 999 : c.detour_min); });
  r.prices = "Prices aren't shown: no reliable live price source is connected.";
  return r;
};
/* Before inserting an urgent visit: the day with and without it (best position, conflicts, return time). Nothing is saved. */
ACTIONS.lsInsertImpact = function (me, b) {
  lsNeedOffice(me); var p = lsProp(b.property_id), date = dateOrEmpty(b.date); if (!date) throw new Error("Pick a day.");
  var before = ACTIONS.lsPlanDay(me, { date: date, crew_id: b.crew_id }), tmp = { id: "new-visit", property_id: p.id, date: date, plan_date: date, series: "one", kind: "extra", crew_id: String(b.crew_id || ""), status: "scheduled", stop: "", est_min: String(num(b.est_min) || num(p.visit_min) || 60), fixed_time: "" };
  rows("LsVisits").push(tmp);
  try { var after = ACTIONS.lsPlanDay(me, { date: date, crew_id: b.crew_id }); } finally { var L = rows("LsVisits"), k = L.indexOf(tmp); if (k > -1) L.splice(k, 1); }
  var pick = function (r) { var pl = r.suggested || r.current; return { drive_min: pl.drive_min, km: pl.km, finish: pl.finish, over_min: pl.over_min, late: pl.rows.filter(function (x) { return x.late; }).length, stops: pl.rows.filter(function (x) { return !x.fuel; }).length, order: pl.order }; };
  var a = pick(after), bf = before.current.rows.length ? pick(before) : { drive_min: 0, km: 0, finish: null, over_min: 0, late: 0, stops: 0, order: [] };
  return { date: date, crew_id: String(b.crew_id || ""), routable: lsRoutable(p), before: bf, after: a, position: a.order.indexOf("new-visit") + 1, end: after.hours.end, real: (after.suggested || after.current).real };
};
NO_LOCK.lsInsertImpact = 1;
/* A message to the property's client, written (or edited) by the office and sent only when they press Send. */
ACTIONS.lsNotifyClient = function (me, b) {
  lsNeedOffice(me); var p = lsProp(b.property_id), to = splitIds(p.client_emails), subject = clean(b.subject, 150), text = clean(b.text, 4000);
  if (!to.length) throw new Error("This property has no client email yet. Add one on the property.");
  if (!subject || !text) throw new Error("Write a subject and a message.");
  to.forEach(function (e) { safeMail(function () { sendMail(e, subject, "<p>" + nl2br(esc(text)) + "</p>"); }); });
  lsLog(me, "property", p.id, "emailed the client: " + subject); return { sent: to.length };
};
/* ---- seasonal opportunities ---- */
var LS_SEASON = [
  { service: "Pre-winter pruning", months: [10, 11, 0, 1], feat: [], reason: "Dormant season: prune before the rains to reduce storm damage." },
  { service: "Reduce irrigation schedule for winter", months: [10, 11], feat: ["Irrigation"], reason: "Rain season: cutting watering avoids runoff and saves the client's water bill." },
  { service: "Gutter and drain cleaning", months: [10, 11], feat: ["Drainage"], reason: "Leaves clog drains before the first big storms." },
  { service: "Leaf cleanup", months: [10, 11], feat: ["Trees"], reason: "Heavy leaf drop this time of year." },
  { service: "Mulch refresh", months: [1, 2, 3], feat: ["Planting beds"], reason: "Spring mulch holds moisture and keeps weeds down." },
  { service: "Lawn aeration and overseeding", months: [2, 3, 8, 9], feat: ["Lawn"], reason: "Cool, moist weeks are best for aeration and seed." },
  { service: "Spring fertilizing", months: [2, 3], feat: ["Lawn", "Planting beds"], reason: "Feed at the start of the growing season." },
  { service: "Irrigation check and summer schedule", months: [3, 4], feat: ["Irrigation"], reason: "Fix leaks and broken heads before the heat." }
];
function lsOppKey(pid, service) { return pid + "|" + String(service || "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim(); }
function lsOppOut(o) {
  var e = o.est_id ? findBy("LsEstimates", "id", o.est_id) : null, v = o.visit_id ? findBy("LsVisits", "id", o.visit_id) : (e && e.visit_id ? findBy("LsVisits", "id", e.visit_id) : null), st = o.status;
  if (e && st !== "declined") st = v && v.status === "completed" ? "done" : v ? "scheduled" : e.status === "approved" || e.status === "scheduled" ? "approved" : e.status === "declined" ? "declined" : e.status === "sent" || e.status === "revised" ? "proposed" : st;
  return { id: o.id, property_id: o.property_id, service: o.service, reason: o.reason, timing: o.timing, owner: o.owner, owner_name: o.owner ? personName(o.owner) : "", status: st, est_id: o.est_id || "", est_status: e ? e.status : "",
    visit_id: v ? v.id : "", visit_date: v ? v.date : "", created_at: o.created_at, note: o.note || "" };
}
function lsOppOpen(o) { var st = lsOppOut(o).status; return ["declined", "done", "dropped"].indexOf(st) < 0 || String(o.created_at).slice(0, 10) > lsAdd(lsDay(new Date()), -300); }
ACTIONS.lsSaveOpp = function (me, b) {
  lsNeedOffice(me); var f = b.opp || {}, old = f.id ? findBy("LsOpps", "id", String(f.id)) : null; if (f.id && !old) throw new Error("Opportunity not found.");
  if (old) {
    var patch = {}; ["reason", "timing", "note"].forEach(function (k) { if (f[k] != null) patch[k] = clean(f[k], 300); });
    if (f.owner != null) { var ow = normEmail(f.owner); if (ow && !isStaff(findPerson(ow) || {})) throw new Error("Pick someone from the office."); patch.owner = ow; }
    if (f.status != null) { if (["idea", "proposed", "declined", "dropped"].indexOf(f.status) < 0) throw new Error("Unknown status."); patch.status = f.status; }
    if (f.est_id != null) { if (f.est_id && !findBy("LsEstimates", "id", f.est_id)) throw new Error("Estimate not found."); patch.est_id = f.est_id; if (f.est_id && old.status === "idea") patch.status = "proposed"; }
    update("LsOpps", "id", old.id, patch); lsLog(me, "opp", old.property_id, "updated opportunity " + old.service); return { id: old.id };
  }
  var p = lsProp(f.property_id), service = clean(f.service, 100); if (!service) throw new Error("What service?");
  var key = lsOppKey(p.id, service), dup = rows("LsOpps").filter(function (o) { return o.key === key && lsOppOpen(o); })[0];
  if (dup) throw new Error("“" + service + "” is already proposed for " + p.name + " (" + lsOppOut(dup).status + "). Open that one instead.");
  var row = { id: newId("lo"), property_id: p.id, service: service, reason: clean(f.reason, 300), timing: clean(f.timing, 60), owner: normEmail(f.owner || ""), status: "idea", est_id: "", visit_id: "", created_at: now(), created_by: me.email, key: key, note: "" };
  insert("LsOpps", row); lsLog(me, "opp", p.id, "seasonal opportunity: " + service); return { id: row.id };
};
/* Suggest this season's work for every active property (skips anything already proposed). */
ACTIONS.lsSuggestOpps = function (me, b) {
  lsNeedOffice(me); var m = new Date().getMonth(), made = [], props = rows("LsProps").filter(function (p) { return p.status === "active" && !isTrue(p.sample) || (b.sample && isTrue(p.sample)); });
  var mon = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  LS_SEASON.filter(function (s) { return s.months.indexOf(m) > -1 || s.months.indexOf((m + 1) % 12) > -1; }).forEach(function (s) {
    props.forEach(function (p) {
      var feats = parseJson(p.features, []); if (s.feat.length && !s.feat.some(function (x) { return feats.indexOf(x) > -1; })) return;
      if (String(p.included || "").toLowerCase().indexOf(s.service.toLowerCase().split(" ")[0]) > -1) return;          // already in the agreement
      var key = lsOppKey(p.id, s.service); if (rows("LsOpps").some(function (o) { return o.key === key && lsOppOpen(o); })) return;
      var when = s.months.filter(function (x) { return x >= m; })[0]; var row = { id: newId("lo"), property_id: p.id, service: s.service, reason: s.reason, timing: mon[when == null ? s.months[0] : when], owner: "", status: "idea", est_id: "", visit_id: "", created_at: now(), created_by: me.email, key: key, note: "" };
      insert("LsOpps", row); made.push(row.id);
    });
  });
  if (made.length) lsLog(me, "opp", "", "suggested " + made.length + " seasonal opportunities"); return { made: made.length };
};
/* An estimate written from an opportunity links back to it. */
var _lsSaveEstB3 = ACTIONS.lsSaveEstimate;
ACTIONS.lsSaveEstimate = function (me, b) {
  var r = _lsSaveEstB3(me, b), oid = b.estimate && b.estimate.opp_id;
  if (oid) { var o = findBy("LsOpps", "id", String(oid)); if (o) update("LsOpps", "id", o.id, { est_id: r.id, status: "proposed" }); }
  return r;
};
/* The office's screens get places, opportunities and, on each request, where it stands (estimate → work order → report). */
var _lsHomeB3 = ACTIONS.lsHome;
ACTIONS.lsHome = function (me, b) {
  var out = _lsHomeB3(me, b); if (out.role !== "office") return out;
  if (me.role === "admin" && !me.preview) lsWarmEnsure();
  out.places = rows("LsPlaces").filter(function (p) { return p.status !== "deleted"; }).map(lsPlaceOut);
  var pids = {}; out.props.forEach(function (p) { pids[p.id] = 1; });
  out.opps = rows("LsOpps").filter(function (o) { return pids[o.property_id]; }).map(lsOppOut).sort(function (a, c) { return a.created_at < c.created_at ? 1 : -1; });
  var ests = rows("LsEstimates");
  (out.issues || []).forEach(function (i) {
    var e = ests.filter(function (x) { return x.issue_id === i.id && x.status !== "withdrawn"; })[0];
    var v = rows("LsVisits").filter(function (x) { return x.issue_id === i.id; })[0] || (e && e.visit_id ? findBy("LsVisits", "id", e.visit_id) : null);   // the work order made for this request
    var raw = findBy("LsIssues", "id", i.id) || {}, fid = raw.found_visit || (i.visit_id && (!v || v.id !== i.visit_id) ? i.visit_id : ""), found = fid && (!v || v.id !== fid) ? findBy("LsVisits", "id", fid) : null;                                         // the visit where the crew found it
    i.chain = { est_id: e ? e.id : "", est_status: e ? e.status : "", est_v: e ? num(e.version) : 0, visit_id: v ? v.id : "", visit_date: v ? v.date : "", visit_status: v ? v.status : "", done_at: v ? v.done_at || "" : "",
      found_id: found ? found.id : "", found_date: found ? found.date : "" };
  });
  out.staff = rows("People").filter(function (x) { return isTrue(x.active) && isStaff(x); }).map(function (x) { return { email: x.email, name: x.name }; });
  return out;
};
["lsSavePlace", "lsStopAdd", "lsStopRemove", "lsInsertImpact", "lsNotifyClient", "lsSaveOpp", "lsSuggestOpps"].forEach(function (a) { PREFETCH[a] = ["People", "Projects"].concat(LS_TABLES); });
["lsHome", "lsSaveProperty", "lsSaveCrew", "lsSaveVisit", "lsMoveVisits", "lsRoute", "lsVisitUpdate", "lsReportIssue", "lsTriage", "lsSaveExpense", "lsReviewExpense", "lsSetRate", "lsSeed", "lsClearSample", "lsProperty",
 "lsSaveEstimate", "lsSendEstimate", "lsDecide", "lsWithdraw", "lsEstimate", "lsDayRoutes", "lsFixPins", "lsSettings", "lsSuggestDays", "lsMoveDay", "lsPricing", "lsImport", "lsOfficeDist", "lsPropLine", "lsPlanDay", "lsSaveOrder",
 "lsFixTime", "lsFuelFind", "lsFuelNote", "lsFuelSet", "lsMoveDayPreview"].forEach(function (a) { PREFETCH[a] = ["People", "Projects"].concat(LS_TABLES); });

function lsCleanStations(list) {
  return [].concat(list || []).slice(0, 2000).map(function (x) {
    if (!x || !/^[nwr]\d+$/.test(String(x.id)) || !(Math.abs(num(x.lat)) <= 90) || !(Math.abs(num(x.lon)) <= 180) || x.lat == null) return null;
    return { id: String(x.id), lat: Math.round(num(x.lat) * 1e6) / 1e6, lon: Math.round(num(x.lon) * 1e6) / 1e6, name: clean(x.name, 80) || "Gas station", brand: clean(x.brand, 60), addr: clean(x.addr, 160), hours: clean(x.hours, 120), diesel: clean(x.diesel, 10), gas: clean(x.gas, 10), hgv: clean(x.hgv, 10) };
  }).filter(Boolean);
}
