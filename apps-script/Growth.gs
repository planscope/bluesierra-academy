/* ======================================================================================================
   Growth & Proposals: win maintenance contracts with HOAs (through management companies and boards) and
   private estates. Pipeline → site inspection → cost-engine estimate → proposal (internal review, immutable
   PDF versions, email the office checks) → conversion into a maintenance property (Landscape.gs).
   Office (staff) only. Internal costs, rates and margins only for #money.
   Nothing here invents facts: accounts and contacts keep source, link, date checked and verification state;
   amounts come only from the engine and the quantities the office reviewed.
   Deployed concatenated after Portal.gs and Landscape.gs.
   ====================================================================================================== */
TABLES.GrAccounts = ["id", "kind", "name", "parent_id", "website", "phone", "email", "address", "city", "notes", "source", "source_url", "checked_at", "verified", "created_at", "created_by", "status"];
TABLES.GrContacts = ["id", "account_id", "name", "role", "email", "phone", "can_approve", "source", "source_url", "checked_at", "verified", "notes", "status"];
TABLES.GrOpps = ["id", "kind", "name", "account_id", "mgmt_id", "contact_id", "approver", "address", "city", "lat", "lon", "stage", "signal", "owner", "next_action", "next_date",
  "source", "source_url", "checked_at", "verified", "contract_end", "rfp_due", "walk_date", "walk_required", "board_date", "docs_required", "selection", "start_wanted", "lost_reason",
  "property_id", "notes", "created_at", "created_by", "updated_at", "status"];
TABLES.GrInspections = ["id", "opp_id", "at", "by", "zones", "site", "recovery", "priorities", "issues", "status", "updated_at"];
TABLES.GrEstimates = ["id", "opp_id", "inspection_id", "version", "status", "lines", "params", "totals", "structure", "notes", "locked", "created_at", "created_by"];
TABLES.GrProposals = ["id", "opp_id", "estimate_id", "version", "status", "template", "content", "snapshot", "pdf_id", "hash", "reviewed_by", "reviewed_at", "sent_at", "sent_to", "accepted_at", "created_at", "created_by"];
var GR_TABLES = ["GrAccounts", "GrContacts", "GrOpps", "GrInspections", "GrEstimates", "GrProposals"];
if (TABLES.LsProps.indexOf("proposal_id") < 0) TABLES.LsProps.push("proposal_id");
var GR_STAGES = ["identified", "qualified", "contacted", "visit", "inspected", "drafting", "sent", "negotiation", "won", "lost", "later"];
var GR_SIGNALS = ["prospect", "interest", "rfp"];                 // identified prospect · confirmed interest · open bid (RFP)
var GR_ACC_KINDS = ["management_company", "hoa", "estate", "estate_manager", "other"];
var GR_SOURCES = ["manual", "referral", "website_form", "public_site", "rfp", "directory", "csv"];
var GR_FREQ = { weekly: 52, biweekly: 26, monthly: 12, quarterly: 4, three_a_year: 3, twice_a_year: 2, annual: 1, once: 1 };
var GR_SECTIONS = ["recurring", "seasonal", "recovery", "option"];
/* Production rates (person-minutes per unit per visit) and materials ($ per unit per visit). Editable by #money. */
var GR_TASKS = {
  mow: { label: "Mow, trim and edge turf", zone: "lawn", unit: "sq ft", per: 1000, min: 8, mat: 0, freq: "weekly", section: "recurring" },
  blow: { label: "Blow walks, drives and hardscape", zone: "hardscape", unit: "sq ft", per: 1000, min: 3, mat: 0, freq: "weekly", section: "recurring" },
  beds: { label: "Weed and detail planting beds", zone: "beds", unit: "sq ft", per: 1000, min: 15, mat: 0, freq: "biweekly", section: "recurring" },
  hedge: { label: "Shear hedges", zone: "hedges", unit: "lin ft", per: 100, min: 12, mat: 0, freq: "quarterly", section: "recurring" },
  irrig: { label: "Irrigation check and adjust", zone: "irrigation", unit: "valves", per: 1, min: 4, mat: 0, freq: "monthly", section: "recurring" },
  trees: { label: "Prune small trees (under 12 ft)", zone: "trees", unit: "trees", per: 1, min: 30, mat: 0, freq: "annual", section: "seasonal" },
  mulch: { label: "Mulch refresh, 2 in. deep", zone: "beds", unit: "sq ft", per: 1000, min: 280, mat: 280, freq: "annual", section: "seasonal" },
  leaves: { label: "Leaf cleanup", zone: "lawn", unit: "sq ft", per: 1000, min: 20, mat: 0, freq: "three_a_year", section: "seasonal" },
  fert: { label: "Fertilize turf", zone: "lawn", unit: "sq ft", per: 1000, min: 5, mat: 12, freq: "quarterly", section: "seasonal" }
};
function grNeed(me) { if (!me || !isStaff(me) || me.preview) throw new Error("Only the Blue Sierra office uses Growth & Proposals."); }
function grMoney(me) { return canMoney(me); }
function grLog(me, ref, text) { lsLog(me, "growth", ref, text); }
function grDow(d) { var x = lsParse(d); return x ? ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"][x.getDay()] : ""; }
function grToday() { return lsDay(new Date()); }
function grRates() {
  var o = parseJson(PropertiesService.getScriptProperties().getProperty("GR_RATES"), {}), c = lsCfg(), tasks = {};
  Object.keys(GR_TASKS).forEach(function (k) { tasks[k] = Object.assign({}, GR_TASKS[k], (o.tasks || {})[k] || {}); });
  return { tasks: tasks, labor_rate: num(o.labor_rate) || c.rate || 32, margin: o.margin != null ? num(o.margin) : 0.35, disposal: o.disposal != null ? num(o.disposal) : 35, crew: num(o.crew) || 2 };
}
function grFolder() {
  var pr = PropertiesService.getScriptProperties(), id = pr.getProperty("GR_FOLDER_ID"), f = null;
  try { if (id) { f = DriveApp.getFolderById(id); if (f.isTrashed()) f = null; } } catch (e) { f = null; }
  if (!f) { f = rootFolder().createFolder("Growth & proposals"); pr.setProperty("GR_FOLDER_ID", f.getId()); }
  return f;
}
function grOpp(id) { var o = findBy("GrOpps", "id", String(id || "")); if (!o || o.status === "deleted") throw new Error("Opportunity not found."); return o; }
function grAcc(id) { return id ? findBy("GrAccounts", "id", String(id)) : null; }
/* ---- accounts and contacts (a management company keeps its communities; one person = one contact) ---- */
function grSrc(f, patch) {
  if (f.source != null) patch.source = GR_SOURCES.indexOf(f.source) > -1 ? f.source : "manual";
  if (f.source_url != null) { var u = clean(f.source_url, 300); if (u && !/^https?:\/\//i.test(u)) throw new Error("The source link must start with http:// or https://"); patch.source_url = u; }
  if (f.checked_at != null) patch.checked_at = dateOrEmpty(f.checked_at);
  if (f.verified != null) patch.verified = f.verified ? "yes" : "";
}
ACTIONS.grSaveAccount = function (me, b) {
  grNeed(me); var f = b.account || {}, old = f.id ? findBy("GrAccounts", "id", String(f.id)) : null; if (f.id && !old) throw new Error("Account not found.");
  var patch = {}; ["name", "website", "phone", "email", "address", "city", "notes"].forEach(function (k) { if (f[k] != null) patch[k] = clean(f[k], k === "notes" ? 2000 : 200); });
  if (f.kind != null) patch.kind = GR_ACC_KINDS.indexOf(f.kind) > -1 ? f.kind : "other";
  if (f.parent_id != null) { var par = f.parent_id ? grAcc(f.parent_id) : null; if (f.parent_id && (!par || par.kind !== "management_company")) throw new Error("Pick the management company."); patch.parent_id = f.parent_id || ""; }
  if (patch.email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(patch.email)) throw new Error("Check the email.");
  grSrc(f, patch);
  if (old) { update("GrAccounts", "id", old.id, patch); return { id: old.id }; }
  if (!patch.name) throw new Error("The account needs a name.");
  var key = patch.name.toLowerCase().replace(/[^a-z0-9]+/g, ""), dup = rows("GrAccounts").filter(function (a) { return a.status !== "deleted" && a.name.toLowerCase().replace(/[^a-z0-9]+/g, "") === key; })[0];
  if (dup) return { id: dup.id, existing: true };
  patch.id = newId("ga"); patch.kind = patch.kind || "other"; patch.source = patch.source || "manual"; patch.created_at = now(); patch.created_by = me.email; patch.status = "active";
  insert("GrAccounts", patch); grLog(me, patch.id, "added account " + patch.name); return { id: patch.id };
};
ACTIONS.grSaveContact = function (me, b) {
  grNeed(me); var f = b.contact || {}, old = f.id ? findBy("GrContacts", "id", String(f.id)) : null; if (f.id && !old) throw new Error("Contact not found.");
  var patch = {}; ["name", "role", "phone", "notes"].forEach(function (k) { if (f[k] != null) patch[k] = clean(f[k], k === "notes" ? 1000 : 120); });
  if (f.email != null) { patch.email = normEmail(f.email); if (patch.email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(patch.email)) throw new Error("Check the email."); }
  if (f.account_id != null) { if (f.account_id && !grAcc(f.account_id)) throw new Error("Pick the account."); patch.account_id = f.account_id || ""; }
  if (f.can_approve != null) patch.can_approve = f.can_approve ? "yes" : "";
  grSrc(f, patch);
  if (patch.email) { var same = rows("GrContacts").filter(function (c) { return c.status !== "deleted" && c.email === patch.email && (!old || c.id !== old.id); })[0];
    if (same) { if (old) throw new Error(patch.email + " already belongs to " + same.name + "."); return { id: same.id, existing: true }; } }   // never two contacts for one person
  if (old) { update("GrContacts", "id", old.id, patch); return { id: old.id }; }
  if (!patch.name) throw new Error("The contact needs a name.");
  patch.id = newId("gc"); patch.status = "active"; patch.source = patch.source || "manual"; insert("GrContacts", patch); grLog(me, patch.account_id || patch.id, "added contact " + patch.name); return { id: patch.id };
};
/* ---- opportunities ---- */
ACTIONS.grSaveOpp = function (me, b) {
  grNeed(me); var f = b.opp || {}, old = f.id ? grOpp(f.id) : null, patch = {};
  ["name", "approver", "address", "city", "next_action", "docs_required", "selection", "notes", "lost_reason"].forEach(function (k) { if (f[k] != null) patch[k] = clean(f[k], k === "notes" ? 3000 : 400); });
  if (f.kind != null) { if (["hoa", "estate"].indexOf(f.kind) < 0) throw new Error("Pick HOA or estate."); patch.kind = f.kind; }
  ["account_id", "mgmt_id"].forEach(function (k) { if (f[k] != null) { if (f[k] && !grAcc(f[k])) throw new Error("Account not found."); patch[k] = f[k] || ""; } });
  if (f.contact_id != null) { if (f.contact_id && !findBy("GrContacts", "id", f.contact_id)) throw new Error("Contact not found."); patch.contact_id = f.contact_id || ""; }
  if (f.stage != null) { if (GR_STAGES.indexOf(f.stage) < 0) throw new Error("Unknown stage."); patch.stage = f.stage; }
  if (f.signal != null) patch.signal = GR_SIGNALS.indexOf(f.signal) > -1 ? f.signal : "prospect";
  if (f.owner != null) { var ow = normEmail(f.owner); if (ow && !isStaff(findPerson(ow) || {})) throw new Error("Pick someone from the office."); patch.owner = ow; }
  ["next_date", "contract_end", "rfp_due", "walk_date", "board_date", "start_wanted", "checked_at"].forEach(function (k) { if (f[k] != null) patch[k] = dateOrEmpty(f[k]); });
  if (f.walk_required != null) patch.walk_required = f.walk_required ? "yes" : "";
  grSrc(f, patch);
  var stage = patch.stage || (old ? old.stage : "identified");
  if (stage === "lost" && !(patch.lost_reason || (old && old.lost_reason))) throw new Error("Say why it was lost (it helps the next proposal).");
  var nx = function (k) { return patch[k] != null ? patch[k] : old ? old[k] : ""; };
  if (["won", "lost", "later"].indexOf(stage) < 0 && stage !== "identified" && !(nx("owner") && nx("next_action") && nx("next_date"))) throw new Error("Every active opportunity needs an owner, a next action and a follow-up date.");
  if ((patch.address != null || patch.city != null) && f.lat == null) {
    var q = lsAddrOf({ address: nx("address"), city: nx("city") }), g = q ? lsGeocode(q) : null;
    if (g) { patch.lat = String(g.lat); patch.lon = String(g.lon); } else { patch.lat = ""; patch.lon = ""; }
  }
  patch.updated_at = now();
  if (old) { update("GrOpps", "id", old.id, patch); if (patch.stage && patch.stage !== old.stage) grLog(me, old.id, "stage " + old.stage + " → " + patch.stage + (patch.lost_reason ? " (" + patch.lost_reason + ")" : "")); return { id: old.id }; }
  if (!patch.name) throw new Error("Name the opportunity (the community or estate).");
  patch.id = newId("go"); patch.kind = patch.kind || "hoa"; patch.stage = stage; patch.signal = patch.signal || "prospect"; patch.source = patch.source || "manual"; patch.created_at = now(); patch.created_by = me.email; patch.status = "active";
  insert("GrOpps", patch); grLog(me, patch.id, "new " + patch.kind.toUpperCase() + " opportunity " + patch.name); return { id: patch.id };
};
/* ---- inspection (mobile walk-through). Each quantity says where it came from: measured on site, told by the client, or estimated. ---- */
var GR_ZONE_TYPES = ["lawn", "beds", "hedges", "trees", "hardscape", "irrigation", "slope", "other"], GR_BASIS = ["verified", "client", "estimate", "unknown"];
function grZones(list) {
  return [].concat(list || []).slice(0, 60).map(function (z, i) {
    return { id: clean(z.id, 20) || "z" + (i + 1) + Math.random().toString(36).slice(2, 6), name: clean(z.name, 80) || "Zone " + (i + 1), type: GR_ZONE_TYPES.indexOf(z.type) > -1 ? z.type : "other",
      qty: z.qty === "" || z.qty == null ? null : Math.max(0, num(z.qty)), unit: clean(z.unit, 20), basis: GR_BASIS.indexOf(z.basis) > -1 ? z.basis : "unknown", condition: clean(z.condition, 300), notes: clean(z.notes, 1000),
      photos: [].concat(z.photos || []).map(function (p) { return clean(p, 80); }).filter(Boolean).slice(0, 12) };
  });
}
ACTIONS.grSaveInspection = function (me, b) {
  grNeed(me); var f = b.inspection || {}, o = grOpp(f.opp_id || (f.id && (findBy("GrInspections", "id", f.id) || {}).opp_id)), old = f.id ? findBy("GrInspections", "id", f.id) : null;
  var site = f.site || {}, s = {}; ["irrigation", "controllers", "slopes", "access", "parking", "waste", "frequencies", "restrictions", "equipment", "hours"].forEach(function (k) { if (site[k] != null) s[k] = clean(site[k], 600); });
  var patch = { zones: JSON.stringify(grZones(f.zones)), site: JSON.stringify(s), priorities: clean(f.priorities, 2000), issues: clean(f.issues, 2000), updated_at: now(),
    recovery: JSON.stringify([].concat(f.recovery || []).slice(0, 30).map(function (r) { return { desc: clean(r.desc, 200), hours: Math.max(0, num(r.hours)), materials: Math.max(0, num(r.materials)), basis: GR_BASIS.indexOf(r.basis) > -1 ? r.basis : "estimate" }; }).filter(function (r) { return r.desc; })),
    status: f.status === "done" ? "done" : "draft" };
  if (old) update("GrInspections", "id", old.id, patch);
  else { patch.id = newId("gi"); patch.opp_id = o.id; patch.at = now(); patch.by = me.email; insert("GrInspections", patch); }
  if (patch.status === "done" && GR_STAGES.indexOf(o.stage) < GR_STAGES.indexOf("inspected")) { update("GrOpps", "id", o.id, { stage: "inspected", updated_at: now() }); grLog(me, o.id, "inspection done"); }
  return { id: old ? old.id : patch.id };
};
ACTIONS.grAddPhotos = function (me, b) {
  grNeed(me); var ins = findBy("GrInspections", "id", String(b.id || "")); if (!ins) throw new Error("Inspection not found."); var o = grOpp(ins.opp_id);
  var ids = (b.files || []).slice(0, 6).map(function (f) {
    var mime = String(f.mime || ""); if (!/^image\/(jpeg|png|webp)$/.test(mime)) throw new Error("Photos must be JPG or PNG.");
    var bytes = Utilities.base64Decode(String(f.data).replace(/^data:[^,]+,/, "")); if (bytes.length > 12 * 1024 * 1024) throw new Error("That photo is too big.");
    var file = grFolder().createFile(Utilities.newBlob(bytes, mime, ("Inspection · " + o.name + " · " + now()).replace(/[:]/g, "-") + ".jpg")); return file.getId();
  });
  var zones = parseJson(ins.zones, []), z = zones.filter(function (x) { return x.id === b.zone_id; })[0]; if (!z) throw new Error("Pick the zone for these photos.");
  z.photos = (z.photos || []).concat(ids).slice(0, 12); update("GrInspections", "id", ins.id, { zones: JSON.stringify(zones), updated_at: now() });
  return { ids: ids };
};
/* ---- the cost engine: quantities × rates × visits a year + travel + disposal → cost → price at the target margin ---- */
function grTravel(o) {                                             // round trip from the office, minutes (Google when it answers)
  var y = lsCfg().yard; if (!y || !(o.lat && o.lon)) return { min: null, real: false };
  var pt = { lat: num(o.lat), lon: num(o.lon) }, g = null; try { g = lsDirections([y, pt, y]); } catch (e) {}
  return g && g.legs.length === 2 ? { min: g.legs[0].min + g.legs[1].min, real: true } : { min: Math.round(lsEstMin(y, pt) * 2), real: false };
}
function grCalc(lines, rates, travel, params) {
  params = params || {}; var margin = params.margin != null ? Math.max(0, Math.min(0.8, num(params.margin))) : rates.margin, rate = num(params.labor_rate) || rates.labor_rate, crew = Math.max(1, num(params.crew) || rates.crew);
  var out = [], prelim = [], recurVisits = 0;
  lines.forEach(function (l, i) {
    var t = rates.tasks[l.task] || {}, sec = GR_SECTIONS.indexOf(l.section) > -1 ? l.section : t.section || "recurring", fq = GR_FREQ[l.freq] ? l.freq : t.freq || "once", visits = GR_FREQ[fq];
    var per = num(l.per) || t.per || 1, qty = l.qty === "" || l.qty == null ? null : num(l.qty), minU = l.min != null && l.min !== "" ? num(l.min) : num(t.min), matU = l.mat != null && l.mat !== "" ? num(l.mat) : num(t.mat);
    var units = qty == null ? 0 : qty / per, pmin = l.hours != null && l.hours !== "" ? num(l.hours) * 60 : units * minU, labor = pmin * visits / 60 * rate, mat = (l.materials != null && l.materials !== "" ? num(l.materials) : units * matU * visits), sub = num(l.sub);
    if (qty == null && !(l.hours > 0) && !sub) prelim.push((l.label || t.label || "line " + (i + 1)) + ": no quantity");
    if (["estimate", "unknown", "client"].indexOf(l.basis) > -1 && l.include !== false) prelim.push((l.label || t.label) + (l.zone ? " (" + l.zone + ")" : "") + ": quantity " + { unknown: "unknown", estimate: "estimated, not measured", client: "from the client, not measured" }[l.basis]);
    if (sec === "recurring" && l.include !== false && visits > recurVisits) recurVisits = visits;
    out.push({ i: i, task: l.task || "", label: clean(l.label || t.label || "Custom item", 160), zone: clean(l.zone, 80), section: sec, freq: fq, visits: visits, qty: qty, unit: clean(l.unit || t.unit, 20), per: per, min: minU, mat: matU,
      basis: GR_BASIS.indexOf(l.basis) > -1 ? l.basis : "unknown", include: l.include !== false, person_min_visit: Math.round(pmin),
      in_hours: l.hours != null && l.hours !== "" ? num(l.hours) : null, in_materials: l.materials != null && l.materials !== "" ? num(l.materials) : null, in_min: l.min != null && l.min !== "" ? num(l.min) : null, in_mat: l.mat != null && l.mat !== "" ? num(l.mat) : null, hours_year: Math.round(pmin * visits / 6) / 10, labor: labor, materials: mat, sub: sub, cost: labor + mat + sub });
  });
  var recur = out.filter(function (x) { return x.section === "recurring" && x.include; }), recurLabor = recur.reduce(function (a, x) { return a + x.labor; }, 0) || 1;
  var travelMin = travel && travel.min != null ? travel.min : null; if (travelMin == null && recur.length) prelim.push("travel: no exact address / office address, so driving isn't priced");
  var travelCost = travelMin == null ? 0 : recurVisits * travelMin / 60 * crew * rate, disposalCost = recurVisits * (params.disposal != null ? num(params.disposal) : rates.disposal);
  recur.forEach(function (x) { var share = x.labor / recurLabor; x.travel = travelCost * share; x.disposal = disposalCost * share; x.cost += x.travel + x.disposal; });
  out.forEach(function (x) { x.price = Math.round(x.cost / (1 - margin)); x.labor = Math.round(x.labor); x.materials = Math.round(x.materials); x.cost = Math.round(x.cost); x.travel = Math.round(x.travel || 0); x.disposal = Math.round(x.disposal || 0); });
  var sum = function (sec, f) { return out.filter(function (x) { return x.section === sec && x.include; }).reduce(function (a, x) { return a + x[f]; }, 0); };
  var tot = { recurring_annual: sum("recurring", "price"), seasonal_annual: sum("seasonal", "price"), recovery_once: sum("recovery", "price"), options: out.filter(function (x) { return x.section === "option"; }).map(function (x) { return { label: x.label, price: x.price, freq: x.freq }; }),
    visits_year: recurVisits, travel_min: travelMin, travel_real: !!(travel && travel.real), crew: crew, rate: rate, margin: margin,
    cost_annual: sum("recurring", "cost") + sum("seasonal", "cost"), hours_year: Math.round((sum("recurring", "hours_year") + sum("seasonal", "hours_year") + recurVisits * (travelMin || 0) / 60 * crew) * 10) / 10,
    person_min_visit: recur.reduce(function (a, x) { return a + (x.freq === "weekly" || x.visits === recurVisits ? x.person_min_visit : x.person_min_visit * x.visits / Math.max(1, recurVisits)); }, 0) };
  tot.recurring_monthly = Math.round(tot.recurring_annual / 12); tot.annual_total = tot.recurring_annual + tot.seasonal_annual; tot.monthly_all_in = Math.round(tot.annual_total / 12);
  tot.person_min_visit = Math.round(tot.person_min_visit);
  return { lines: out, totals: tot, preliminary: prelim };
}
/* Draft lines from the inspection: each zone gets the usual tasks for its type; recovery work is its own section. */
function grLinesFrom(ins, rates) {
  var lines = [];
  parseJson(ins.zones, []).forEach(function (z) {
    Object.keys(rates.tasks).forEach(function (k) { var t = rates.tasks[k]; if (t.zone !== z.type) return;
      lines.push({ task: k, label: t.label, zone: z.name, section: t.section, freq: t.freq, qty: z.qty, unit: t.unit, basis: z.basis, include: true }); });
  });
  parseJson(ins.recovery, []).forEach(function (r) { lines.push({ task: "", label: r.desc, zone: "", section: "recovery", freq: "once", hours: r.hours, materials: r.materials, basis: r.basis, include: true }); });
  return lines;
}
function grEstOut(e, money) {
  var calc = parseJson(e.totals, {}), lines = parseJson(e.lines, []);
  var o = { id: e.id, opp_id: e.opp_id, inspection_id: e.inspection_id, version: num(e.version), status: e.status, structure: e.structure || "packages", notes: e.notes, locked: isTrue(e.locked), created_at: e.created_at,
    totals: { recurring_monthly: calc.recurring_monthly, recurring_annual: calc.recurring_annual, seasonal_annual: calc.seasonal_annual, recovery_once: calc.recovery_once, annual_total: calc.annual_total, monthly_all_in: calc.monthly_all_in,
      options: calc.options || [], visits_year: calc.visits_year, travel_min: calc.travel_min, travel_real: calc.travel_real, person_min_visit: calc.person_min_visit, hours_year: calc.hours_year },
    preliminary: parseJson(e.params, {}).preliminary || [],
    lines: lines.map(function (x) { var y = { label: x.label, zone: x.zone, section: x.section, freq: x.freq, visits: x.visits, qty: x.qty, unit: x.unit, basis: x.basis, include: x.include, price: x.price, task: x.task, per: x.per, person_min_visit: x.person_min_visit, hours_year: x.hours_year,
      hours: x.in_hours, materials: x.in_materials };                                   // what the office typed (never the computed costs)
      if (money) { y.min = x.in_min; y.mat = x.in_mat; y.rate_min = x.min; y.rate_mat = x.mat; y.labor = x.labor; y.materials_cost = x.materials; y.sub = x.sub || null; y.travel = x.travel; y.disposal = x.disposal; y.cost = x.cost; } return y; }) };
  if (money) { o.totals.cost_annual = calc.cost_annual; o.totals.margin = calc.margin; o.totals.rate = calc.rate; o.totals.crew = calc.crew; o.params = parseJson(e.params, {}); }
  return o;
}
ACTIONS.grDraftLines = function (me, b) { grNeed(me); var ins = findBy("GrInspections", "id", String(b.inspection_id || "")); if (!ins) throw new Error("Do the inspection first."); return { lines: grLinesFrom(ins, grRates()) }; };
NO_LOCK.grDraftLines = 1;
/* Save an estimate. A draft is changed in place; once a proposal used it, any change makes a new version. Amounts always come from the engine. */
ACTIONS.grSaveEstimate = function (me, b) {
  grNeed(me); var o = grOpp(b.opp_id), rates = grRates(), money = grMoney(me), old = b.id ? findBy("GrEstimates", "id", b.id) : null;
  var params = {}; if (money) ["margin", "labor_rate", "crew", "disposal"].forEach(function (k) { if (b.params && b.params[k] != null && b.params[k] !== "") params[k] = num(b.params[k]); });
  else if (old) params = parseJson(old.params, {});
  var lines = [].concat(b.lines || []).slice(0, 120).map(function (l) {
    var x = { task: rates.tasks[l.task] ? l.task : "", label: clean(l.label, 160), zone: clean(l.zone, 80), section: l.section, freq: l.freq, qty: l.qty === "" || l.qty == null ? null : num(l.qty), unit: clean(l.unit, 20), basis: l.basis, include: l.include !== false && l.include !== "false", per: l.per };
    if (money) { ["min", "mat", "hours", "materials", "sub"].forEach(function (k) { if (l[k] != null && l[k] !== "") x[k] = num(l[k]); }); }
    else { ["hours", "materials"].forEach(function (k) { if (l[k] != null && l[k] !== "") x[k] = num(l[k]); }); }
    return x; });
  if (!lines.length) throw new Error("Add at least one line.");
  var calc = grCalc(lines, rates, grTravel(o), params); params.preliminary = calc.preliminary;
  var row = { lines: JSON.stringify(calc.lines), params: JSON.stringify(params), totals: JSON.stringify(calc.totals), structure: b.structure ? (b.structure === "rfp" ? "rfp" : "packages") : old ? old.structure || "packages" : "packages", notes: b.notes != null ? clean(b.notes, 2000) : old ? old.notes : "",
    status: calc.preliminary.length ? "preliminary" : "complete" };
  var ins = b.inspection_id ? findBy("GrInspections", "id", b.inspection_id) : null;
  if (old && !isTrue(old.locked)) { update("GrEstimates", "id", old.id, row); return { id: old.id, version: num(old.version), status: row.status, preliminary: calc.preliminary }; }
  var v = rows("GrEstimates").filter(function (e) { return e.opp_id === o.id; }).length + 1;
  Object.assign(row, { id: newId("ge"), opp_id: o.id, inspection_id: ins ? ins.id : old ? old.inspection_id : "", version: String(v), locked: "", created_at: now(), created_by: me.email });
  insert("GrEstimates", row); grLog(me, o.id, "estimate v" + v + " (" + row.status + ")");
  if (GR_STAGES.indexOf(o.stage) < GR_STAGES.indexOf("drafting")) update("GrOpps", "id", o.id, { stage: "drafting", updated_at: now() });
  return { id: row.id, version: v, status: row.status, preliminary: calc.preliminary };
};
ACTIONS.grRates = function (me, b) {
  grNeed(me); if (!grMoney(me)) throw new Error("Rates and margins are #money.");
  if (b.save) { if (me.role !== "admin") throw new Error("Only Jesús changes the rates."); var r = b.save, cur = parseJson(PropertiesService.getScriptProperties().getProperty("GR_RATES"), {}), tasks = cur.tasks || {};
    Object.keys(r.tasks || {}).forEach(function (k) { if (!GR_TASKS[k]) return; tasks[k] = { min: Math.max(0, num(r.tasks[k].min)), mat: Math.max(0, num(r.tasks[k].mat)) }; });
    var next = { tasks: tasks, labor_rate: num(r.labor_rate) || cur.labor_rate, margin: r.margin != null ? Math.max(0, Math.min(0.8, num(r.margin))) : cur.margin, disposal: r.disposal != null ? num(r.disposal) : cur.disposal, crew: num(r.crew) || cur.crew };
    PropertiesService.getScriptProperties().setProperty("GR_RATES", JSON.stringify(next)); grLog(me, "", "changed the estimate rates"); }
  return { rates: grRates() };
};
/* ---- verified credentials (licenses, insurance, certifications, references) ---- */
function grCreds() { return parseJson(PropertiesService.getScriptProperties().getProperty("GR_CREDS"), []); }
function grCredsValid() { var t = grToday(); return grCreds().filter(function (c) { return c.verified && (!c.expires || c.expires >= t); }); }
ACTIONS.grSaveCred = function (me, b) {
  grNeed(me); if (me.role !== "admin") throw new Error("Only Jesús manages licenses and insurance."); var list = grCreds(), f = b.cred || {};
  if (f.remove) list = list.filter(function (c) { return c.id !== f.id; });
  else { var c = { id: f.id || newId("cr"), kind: ["license", "insurance", "certification", "reference"].indexOf(f.kind) > -1 ? f.kind : "license", name: clean(f.name, 120), number: clean(f.number, 80), detail: clean(f.detail, 300), expires: dateOrEmpty(f.expires), verified: !!f.verified, checked_at: grToday(), checked_by: me.email };
    if (!c.name) throw new Error("Name it."); list = list.filter(function (x) { return x.id !== c.id; }).concat([c]); }
  PropertiesService.getScriptProperties().setProperty("GR_CREDS", JSON.stringify(list.slice(0, 40))); return { creds: list };
};
/* ---- proposals: draft → internal review → approved (frozen) → final PDF → sent; accepted = what operations delivers ---- */
var GR_PROP_DEFAULTS = {
  supervision: "A named crew lead on every visit and a Blue Sierra supervisor who walks the property at least once a month.",
  communication: "One point of contact at Blue Sierra. A visit report after every service (what was done, photos, anything we found), and an answer to every request within one business day.",
  documentation: "Before/after photos and a checklist for every visit, available in the client portal.",
  pending: "Anything we find that needs attention is logged with photos and a recommendation; nothing outside the agreement is done or billed without written approval.",
  exclusions: "Tree work above 12 ft, irrigation repairs beyond adjustments and minor head replacement, plant replacement, storm cleanup, pest and disease treatment, and hauling beyond routine green waste are quoted separately.",
  next_steps: "1. Questions and adjustments to the scope.\n2. Approval of the agreement.\n3. Kick-off walk with your representative and our supervisor.\n4. First service on the agreed start date."
};
function grTransition(o, est) {
  var start = o.start_wanted ? grDow(o.start_wanted) + " " + o.start_wanted : "the agreed start date";
  return { d30: "From " + start + ": kick-off walk, access and contacts confirmed, recurring service at the agreed frequency, punch list of existing issues with photos." + (est && est.totals && est.totals.recovery_once ? " Initial clean-up work completed as quoted." : ""),
    d60: "Irrigation reviewed zone by zone and adjusted; first seasonal items scheduled; monthly supervisor walk and report.",
    d90: "Review meeting: what's working, open items, seasonal plan for the next quarter." };
}
function grPropOut(p, money, full) {
  var o = { id: p.id, opp_id: p.opp_id, estimate_id: p.estimate_id, version: num(p.version), status: p.status, template: p.template, pdf_id: p.pdf_id || "", pdf_url: p.pdf_id ? "https://drive.google.com/file/d/" + p.pdf_id + "/view" : "",
    hash: p.hash || "", reviewed_by: p.reviewed_by ? personName(p.reviewed_by) : "", reviewed_at: p.reviewed_at, sent_at: p.sent_at, sent_to: p.sent_to, accepted_at: p.accepted_at, created_at: p.created_at };
  if (full) { o.content = parseJson(p.content, {}); o.snapshot = parseJson(p.snapshot, null); }
  return o;
}
/* What a proposal shows the client: never internal costs, rates, margins or private notes. */
function grClientView(o, est, content, ins) {
  var acc = grAcc(o.account_id), mg = grAcc(o.mgmt_id), ct = o.contact_id ? findBy("GrContacts", "id", o.contact_id) : null, t = est ? parseJson(est.totals, {}) : {};
  var lines = est ? parseJson(est.lines, []).filter(function (x) { return x.include || x.section === "option"; }).map(function (x) { return { label: x.label, task: x.task || "", zone: x.zone, section: x.section, freq: x.freq, visits: x.visits, qty: x.qty, unit: x.unit, basis: x.basis, price: x.price }; }) : [];
  var zones = ins ? parseJson(ins.zones, []).map(function (z) { return { name: z.name, type: z.type, qty: z.qty, unit: z.unit, basis: z.basis, condition: z.condition }; }) : [];
  return { kind: o.kind, name: o.name, address: [o.address, o.city].filter(Boolean).join(", "), account: acc ? acc.name : "", mgmt: mg ? mg.name : "", contact: ct ? { name: ct.name, role: ct.role } : null, approver: o.approver || "",
    start_wanted: o.start_wanted || "", rfp_due: o.rfp_due || "", structure: est ? est.structure || "packages" : "packages", est_version: est ? num(est.version) : 0, preliminary: est ? (parseJson(est.params, {}).preliminary || []).length > 0 : true,
    totals: { recurring_monthly: t.recurring_monthly || 0, recurring_annual: t.recurring_annual || 0, seasonal_annual: t.seasonal_annual || 0, recovery_once: t.recovery_once || 0, annual_total: t.annual_total || 0, monthly_all_in: t.monthly_all_in || 0, options: t.options || [], visits_year: t.visits_year || 0 },
    lines: lines, zones: zones, priorities: ins ? ins.priorities : "", issues: ins ? ins.issues : "", content: content, creds: grCredsValid().map(function (c) { return { kind: c.kind, name: c.name, number: c.number, detail: c.detail, expires: c.expires }; }),
    date: grToday() };
}
ACTIONS.grNewProposal = function (me, b) {
  grNeed(me); var o = grOpp(b.opp_id), est = findBy("GrEstimates", "id", String(b.estimate_id || "")); if (!est || est.opp_id !== o.id) throw new Error("Pick the estimate this proposal prices.");
  var prev = rows("GrProposals").filter(function (p) { return p.opp_id === o.id; }).sort(function (a, c) { return num(c.version) - num(a.version); })[0];
  var ins = est.inspection_id ? findBy("GrInspections", "id", est.inspection_id) : null, base = prev ? parseJson(prev.content, {}) : {};
  var content = Object.assign({}, GR_PROP_DEFAULTS, { title: (o.kind === "hoa" ? "Landscape maintenance proposal for " : "Garden care proposal for ") + o.name,
    needs: ins ? [ins.priorities, ins.issues].filter(Boolean).join("\n\n") : "", transition: grTransition(o, grEstOut(est, false)),
    photos: ins ? parseJson(ins.zones, []).reduce(function (a, z) { return a.concat((z.photos || []).slice(0, 1)); }, []).slice(0, 6) : [],
    board: o.kind === "hoa" ? "Scope: recurring maintenance of the common areas as listed, seasonal work and the optional items priced separately.\nResponsibilities: Blue Sierra supplies labor, equipment and routine green-waste disposal; the association keeps water service and approves any extra work in writing.\nInvestment: see the price summary." : "" }, base, b.content || {});
  var v = (prev ? num(prev.version) : 0) + 1, row = { id: newId("gp"), opp_id: o.id, estimate_id: est.id, version: String(v), status: "draft", template: o.kind === "hoa" ? "hoa" : "estate", content: JSON.stringify(content), snapshot: "", pdf_id: "", hash: "",
    reviewed_by: "", reviewed_at: "", sent_at: "", sent_to: "", accepted_at: "", created_at: now(), created_by: me.email };
  insert("GrProposals", row); update("GrEstimates", "id", est.id, { locked: "yes" }); grLog(me, o.id, "proposal v" + v + " started (estimate v" + est.version + ")");
  return { id: row.id, version: v };
};
ACTIONS.grSaveProposal = function (me, b) {
  grNeed(me); var p = findBy("GrProposals", "id", String(b.id || "")); if (!p) throw new Error("Proposal not found.");
  if (p.status !== "draft") throw new Error("This version is " + p.status + " and can't change. Make a new version.");
  var c = Object.assign(parseJson(p.content, {}), {}); Object.keys(b.content || {}).forEach(function (k) {
    if (k === "photos") c.photos = [].concat(b.content.photos || []).map(function (x) { return clean(x, 80); }).slice(0, 8);
    else if (k === "transition") c.transition = { d30: clean(b.content.transition.d30, 800), d60: clean(b.content.transition.d60, 800), d90: clean(b.content.transition.d90, 800) };
    else c[k] = clean(b.content[k], 4000); });
  update("GrProposals", "id", p.id, { content: JSON.stringify(c) }); return { id: p.id };
};
ACTIONS.grProposalView = function (me, b) {
  grNeed(me); var p = findBy("GrProposals", "id", String(b.id || "")); if (!p) throw new Error("Proposal not found.");
  if (p.snapshot) return { proposal: grPropOut(p, grMoney(me)), view: parseJson(p.snapshot, {}), frozen: true };
  var o = grOpp(p.opp_id), est = findBy("GrEstimates", "id", p.estimate_id), ins = est && est.inspection_id ? findBy("GrInspections", "id", est.inspection_id) : null;
  return { proposal: grPropOut(p, grMoney(me)), view: grClientView(o, est, parseJson(p.content, {}), ins), frozen: false };
};
NO_LOCK.grProposalView = 1;
/* Photos as data for the PDF (Drive thumbnails can't be read by the page directly). */
ACTIONS.grPhotoData = function (me, b) {
  grNeed(me); var out = {};
  [].concat(b.ids || []).slice(0, 8).forEach(function (id) { try { var r = UrlFetchApp.fetch(img(id, 1000), { headers: { Authorization: "Bearer " + ScriptApp.getOAuthToken() }, muteHttpExceptions: true });
    if (r.getResponseCode() === 200) out[id] = "data:image/jpeg;base64," + Utilities.base64Encode(r.getBlob().getBytes()); } catch (e) {} });
  return { photos: out };
};
NO_LOCK.grPhotoData = 1;
ACTIONS.grReview = function (me, b) {
  grNeed(me); var p = findBy("GrProposals", "id", String(b.id || "")); if (!p) throw new Error("Proposal not found."); var o = grOpp(p.opp_id), act = b.act;
  if (act === "submit") { if (p.status !== "draft") throw new Error("Only a draft goes to review."); update("GrProposals", "id", p.id, { status: "review" }); grLog(me, o.id, "proposal v" + p.version + " sent to internal review"); return { status: "review" }; }
  if (act === "back") { if (p.status !== "review") throw new Error("It isn't in review."); update("GrProposals", "id", p.id, { status: "draft" }); grLog(me, o.id, "proposal v" + p.version + " back to draft: " + clean(b.note, 200)); return { status: "draft" }; }
  if (act === "approve") {
    if (p.status !== "review") throw new Error("Send it to review first."); if (!(me.role === "admin" || grMoney(me))) throw new Error("Only Jesús or #money approve proposals.");
    var est = findBy("GrEstimates", "id", p.estimate_id), ins = est && est.inspection_id ? findBy("GrInspections", "id", est.inspection_id) : null, view = grClientView(o, est, parseJson(p.content, {}), ins);
    if (view.preliminary && !b.preliminary_ok) throw new Error("The estimate is preliminary (some quantities aren't measured). Approve it as a preliminary proposal, or finish the estimate.");
    view.preliminary_ok = !!view.preliminary; var snap = JSON.stringify(view);
    update("GrProposals", "id", p.id, { status: "approved", snapshot: snap, hash: sha(snap).slice(0, 16), reviewed_by: me.email, reviewed_at: now() }); grLog(me, o.id, "proposal v" + p.version + " approved for sending");
    return { status: "approved" };
  }
  throw new Error("Unknown review step.");
};
/* The final PDF (made in the browser from the frozen snapshot) is stored once; that version can't change after this. */
ACTIONS.grSavePdf = function (me, b) {
  grNeed(me); var p = findBy("GrProposals", "id", String(b.id || "")); if (!p) throw new Error("Proposal not found."); var o = grOpp(p.opp_id);
  if (p.status !== "approved") throw new Error(p.pdf_id ? "This version already has its final PDF." : "Approve it in internal review first.");
  var bytes = Utilities.base64Decode(String(b.pdf || "").replace(/^data:[^,]+,/, "")); if (bytes.length < 800 || bytes.length > 25 * 1024 * 1024) throw new Error("That PDF looks wrong.");
  var name = (o.name + " · Blue Sierra proposal v" + p.version + " · " + grToday()).replace(/[\/:]/g, "-") + ".pdf", file = grFolder().createFile(Utilities.newBlob(bytes, "application/pdf", name));
  update("GrProposals", "id", p.id, { status: "final", pdf_id: file.getId() }); grLog(me, o.id, "final PDF for proposal v" + p.version);
  return { pdf_id: file.getId(), url: "https://drive.google.com/file/d/" + file.getId() + "/view" };
};
/* Email drafts the office edits; nothing is sent until they press Send. */
function grDraft(kind, o, me, p) {
  var ct = o.contact_id ? findBy("GrContacts", "id", o.contact_id) : null, hi = "Hi" + (ct && ct.name ? " " + ct.name.split(" ")[0] : "") + ",\n\n", sig = "\n\nBest regards,\n" + me.name + "\nBlue Sierra Construction";
  var t = {
    intro: ["Landscape maintenance for " + o.name, hi + "I'm with Blue Sierra, a landscape construction and maintenance company in the Bay Area. We already service properties near " + (o.city || "your community") + " and would welcome the chance to walk " + o.name + " and understand what matters most to you." + sig],
    visit: ["Site walk at " + o.name, hi + "Could we schedule a site walk at " + o.name + "? It takes about an hour. We'll measure the areas, note anything that needs attention, and use it to prepare an accurate proposal. Which days work for you?" + sig],
    followup: ["Following up · " + o.name, hi + "I wanted to follow up on " + (p ? "our proposal (version " + p.version + ")" : "our conversation") + " for " + o.name + ". Happy to answer questions or adjust the scope." + sig],
    proposal: ["Blue Sierra proposal · " + o.name, hi + "Attached is our proposal for " + o.name + (p ? " (version " + p.version + ")" : "") + ". It includes the scope by area, frequencies, the seasonal plan and pricing. Let me know if you'd like to walk through it together." + sig],
    objection: ["About your questions · " + o.name, hi + "Thanks for the feedback on our proposal. Here's how we'd address it:\n\n- \n\nWe're happy to adjust the scope or frequencies to fit your budget, and we'll keep every commitment in writing." + sig]
  }[kind];
  if (!t) throw new Error("Unknown draft.");
  return { subject: t[0], text: t[1], to: ct && ct.email ? [ct.email] : [] };
}
ACTIONS.grDraftEmail = function (me, b) { grNeed(me); var o = grOpp(b.opp_id), p = b.proposal_id ? findBy("GrProposals", "id", b.proposal_id) : null; return grDraft(b.kind, o, me, p); };
NO_LOCK.grDraftEmail = 1;
ACTIONS.grSendEmail = function (me, b) {
  grNeed(me); var o = grOpp(b.opp_id), to = [].concat(b.to || []).map(normEmail).filter(Boolean), subject = clean(b.subject, 160), text = clean(b.text, 6000);
  if (!to.length) throw new Error("Add who it goes to."); to.forEach(function (e) { if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e)) throw new Error("Check " + e); });
  if (!subject || !text) throw new Error("Write a subject and a message.");
  var p = b.proposal_id ? findBy("GrProposals", "id", b.proposal_id) : null, att = null;
  if (p) { if (["final", "sent", "accepted"].indexOf(p.status) < 0 || !p.pdf_id) throw new Error("Make the final PDF first."); att = DriveApp.getFileById(p.pdf_id).getBlob(); }
  to.forEach(function (e) { safeMail(function () { if (att) GmailApp.sendEmail(e, subject, text, { name: CONFIG.COMPANY, attachments: [att], from: fromAddress() || undefined }); else sendMail(e, subject, "<p>" + nl2br(esc(text)) + "</p>"); }); });
  if (p && p.status === "final") { update("GrProposals", "id", p.id, { status: "sent", sent_at: now(), sent_to: to.join(",") }); if (GR_STAGES.indexOf(o.stage) < GR_STAGES.indexOf("sent")) update("GrOpps", "id", o.id, { stage: "sent", updated_at: now() }); }
  grLog(me, o.id, "emailed " + to.join(", ") + ": " + subject); return { sent: to.length };
};
/* The client accepted a version: that frozen version is what operations delivers. */
ACTIONS.grAccept = function (me, b) {
  grNeed(me); var p = findBy("GrProposals", "id", String(b.id || "")); if (!p) throw new Error("Proposal not found."); if (["sent", "final"].indexOf(p.status) < 0) throw new Error("Only a final or sent version can be accepted.");
  var o = grOpp(p.opp_id); update("GrProposals", "id", p.id, { status: "accepted", accepted_at: now() }); update("GrOpps", "id", o.id, { stage: "won", updated_at: now() }); grLog(me, o.id, "WON with proposal v" + p.version);
  return { status: "accepted" };
};
/* ---- won → maintenance: check everything first, then create the property, agreement, checklist, labor budget and visits ---- */
function grConvertDraft(o) {
  var p = rows("GrProposals").filter(function (x) { return x.opp_id === o.id && x.status === "accepted"; }).sort(function (a, c) { return num(c.version) - num(a.version); })[0];
  if (!p) return null; var snap = parseJson(p.snapshot, {}), est = findBy("GrEstimates", "id", p.estimate_id), ins = est && est.inspection_id ? findBy("GrInspections", "id", est.inspection_id) : null, site = ins ? parseJson(ins.site, {}) : {};
  var ct = o.contact_id ? findBy("GrContacts", "id", o.contact_id) : null, t = snap.totals || {}, recur = (snap.lines || []).filter(function (x) { return x.section === "recurring"; });
  var freq = t.visits_year >= 52 ? "weekly" : t.visits_year >= 26 ? "biweekly" : "monthly", calc = parseJson(est.totals, {});
  var feats = {}; (snap.zones || []).forEach(function (z) { var m = { lawn: "Lawn", beds: "Planting beds", hedges: "Hedges", trees: "Trees", irrigation: "Irrigation", hardscape: "Hardscape", slope: "Slopes" }[z.type]; if (m) feats[m] = 1; });
  return { proposal: p, prop: { name: o.name, client_name: snap.account || o.name, client_emails: ct && ct.email ? ct.email : "", address: o.address, city: o.city, access: site.access || "", contacts: ct ? [ct.name, ct.phone].filter(Boolean).join(" · ") : "",
    notes: "Sold with proposal v" + p.version + " (" + p.id + "), accepted " + String(p.accepted_at).slice(0, 10) + ". Restrictions: " + (site.restrictions || "none noted") + ".",
    features: Object.keys(feats), freq: freq, start: o.start_wanted || "", visit_min: calc.person_min_visit || 60, price: t.recurring_monthly || 0, billing: "monthly",
    included: recur.map(function (x) { return x.label + (x.zone ? " (" + x.zone + ")" : "") + ", " + x.freq.replace(/_/g, " "); }).join("; "), excluded: (snap.content || {}).exclusions || "",
    checklist: recur.map(function (x) { return x.label + (x.zone ? " · " + x.zone : ""); }).slice(0, 25), equipment: site.equipment || "", window_from: "", window_to: "", proposal_id: p.id } };
}
ACTIONS.grConvertCheck = function (me, b) {
  grNeed(me); var o = grOpp(b.opp_id), d = grConvertDraft(o); if (!d) throw new Error("Mark the client's accepted proposal first (Accepted).");
  var f = Object.assign({}, d.prop); Object.keys(b.prop || {}).forEach(function (k) { var x = b.prop[k]; if (x != null && String(x).trim() !== "") f[k] = x; });   // empty fields never wipe what the proposal says
  var checks = [], g = lsAddrOf({ address: f.address, city: f.city }) ? lsGeocode(lsAddrOf({ address: f.address, city: f.city })) : null;
  checks.push({ key: "address", ok: !!(g && g.sure && /^\s*\d+/.test(f.address || "")), text: g ? (g.sure ? "Address found exactly: " + g.address : "Google only found the street or area: " + g.address) : "Address not found" });
  checks.push({ key: "access", ok: !!clean(f.access, 10), text: f.access ? "Access: " + f.access : "No access instructions (gate codes, parking, who opens)" });
  checks.push({ key: "start", ok: !!dateOrEmpty(f.start) && f.start >= grToday(), text: f.start ? "Starts " + f.start : "No start date" });
  var cw = f.crew_id ? findBy("LsCrews", "id", f.crew_id) : null; checks.push({ key: "crew", ok: !!cw, text: cw ? "Crew: " + cw.name : "No crew assigned" });
  var need = String(f.equipment || "").split(",").map(function (x) { return x.trim(); }).filter(Boolean), have = String((cw && cw.skills) || "").toLowerCase(), lack = need.filter(function (e) { return have.indexOf(e.toLowerCase()) < 0; });
  checks.push({ key: "equipment", ok: !lack.length, text: !need.length ? "No special equipment noted" : lack.length ? "Crew doesn't list: " + lack.join(", ") : "Crew has: " + need.join(", ") });
  var wd = f.weekday != null && f.weekday !== "" ? Number(String(f.weekday).split(",")[0]) : null, cap = null;
  if (cw && f.start && wd != null && g) {
    var first = f.start; while (lsParse(first).getDay() !== wd) first = lsAdd(first, 1);
    var tmpP = { id: "gr-tmp", name: f.name, address: f.address, city: f.city, lat: String(g.lat), lon: String(g.lon), status: "active", visit_min: String(f.visit_min || 60), crew_id: cw.id, pin_q: g.sure ? "" : "approx" };
    rows("LsProps").push(tmpP); try { cap = ACTIONS.lsInsertImpact(me, { property_id: "gr-tmp", date: first, crew_id: cw.id, est_min: f.visit_min }); } catch (e) { cap = { err: e.message }; } finally { var L = rows("LsProps"); L.splice(L.indexOf(tmpP), 1); }
    checks.push({ key: "capacity", ok: !!(cap && !cap.err && cap.after && cap.after.finish <= cap.end && !cap.after.late), text: cap && cap.after ? "First " + grDow(first) + " (" + first + "): back at " + Math.floor(cap.after.finish / 60) + ":" + ("0" + cap.after.finish % 60).slice(-2) + (cap.after.finish > cap.end ? " · over the crew's shift" : " · fits the shift") + (cap.after.late ? " · " + cap.after.late + " stop(s) late" : "") : "Couldn't check the route: " + ((cap && cap.err) || "") });
  } else checks.push({ key: "capacity", ok: false, text: "Pick the crew, the day and the start date to check the route" });
  return { prop: f, checks: checks, ready: checks.every(function (c) { return c.ok || c.key === "equipment"; }), proposal_id: d.proposal.id, version: num(d.proposal.version) };
};
NO_LOCK.grConvertCheck = 1;
ACTIONS.grConvert = function (me, b) {
  grNeed(me); var o = grOpp(b.opp_id); if (o.property_id) throw new Error("Already converted.");
  var chk = ACTIONS.grConvertCheck(me, { opp_id: o.id, prop: b.prop }); if (!chk.ready && !b.force) throw new Error("Fix the checks first: " + chk.checks.filter(function (c) { return !c.ok && c.key !== "equipment"; }).map(function (c) { return c.text; }).join("; "));
  var f = chk.prop, r = ACTIONS.lsSaveProperty(me, { prop: { name: f.name, client_name: f.client_name, client_emails: f.client_emails, address: f.address, city: f.city, contacts: f.contacts, access: f.access, notes: f.notes, features: f.features,
    freq: f.freq, weekday: f.weekday, start: f.start, crew_id: f.crew_id, visit_min: f.visit_min, price: f.price, billing: "monthly", included: f.included, excluded: f.excluded, checklist: f.checklist, equipment: f.equipment, labor_ok: true } });
  update("LsProps", "id", r.id, { proposal_id: chk.proposal_id });
  update("GrOpps", "id", o.id, { property_id: r.id, stage: "won", updated_at: now() }); grLog(me, o.id, "converted to maintenance property " + f.name);
  return { property_id: r.id };
};
/* ---- the office's view: pipeline, accounts, contacts, dashboard ---- */
ACTIONS.grHome = function (me, b) {
  grNeed(me); var money = grMoney(me), today = grToday(), soon = lsAdd(today, 21);
  var opps = rows("GrOpps").filter(function (o) { return o.status !== "deleted"; }), ins = rows("GrInspections"), ests = rows("GrEstimates"), props = rows("GrProposals");
  var out = opps.map(function (o) {
    var x = {}; TABLES.GrOpps.forEach(function (k) { x[k] = o[k]; }); x.lat = o.lat ? num(o.lat) : null; x.lon = o.lon ? num(o.lon) : null; x.owner_name = o.owner ? personName(o.owner) : "";
    x.inspections = ins.filter(function (i) { return i.opp_id === o.id; }).map(function (i) { return { id: i.id, status: i.status, at: i.at, by: personName(i.by), zones: parseJson(i.zones, []), site: parseJson(i.site, {}), recovery: parseJson(i.recovery, []), priorities: i.priorities, issues: i.issues }; });
    x.estimates = ests.filter(function (e) { return e.opp_id === o.id; }).map(function (e) { return grEstOut(e, money); }).sort(function (a, c) { return c.version - a.version; });
    x.proposals = props.filter(function (p) { return p.opp_id === o.id; }).map(function (p) { return grPropOut(p, money, true); }).sort(function (a, c) { return c.version - a.version; });
    x.overdue = ["won", "lost", "later"].indexOf(o.stage) < 0 && o.next_date && o.next_date < today;
    return x;
  });
  var act = out.filter(function (o) { return ["won", "lost", "later"].indexOf(o.stage) < 0; }), accepted = out.filter(function (o) { return o.stage === "won"; });
  var mrr = accepted.reduce(function (a, o) { var p = o.proposals.filter(function (x) { return x.status === "accepted"; })[0]; return a + (p && p.snapshot && p.snapshot.totals ? p.snapshot.totals.recurring_monthly || 0 : 0); }, 0);
  var pipe = act.reduce(function (a, o) { var p = o.proposals.filter(function (x) { return ["final", "sent"].indexOf(x.status) > -1; })[0]; return a + (p && p.snapshot && p.snapshot.totals ? p.snapshot.totals.recurring_monthly || 0 : 0); }, 0);
  var lost = {}; out.filter(function (o) { return o.stage === "lost"; }).forEach(function (o) { var k = o.lost_reason || "No reason"; lost[k] = (lost[k] || 0) + 1; });
  var dash = { overdue: act.filter(function (o) { return o.overdue; }).length, visits: act.filter(function (o) { return o.stage === "visit" || (o.walk_date && o.walk_date >= today); }).length,
    drafting: act.filter(function (o) { return o.stage === "drafting" || o.proposals.some(function (p) { return ["draft", "review", "approved"].indexOf(p.status) > -1; }); }).length,
    decisions: act.filter(function (o) { return [o.rfp_due, o.board_date].some(function (d) { return d && d >= today && d <= soon; }); }).length,
    won: accepted.length, mrr_confirmed: mrr, mrr_sent_projection: pipe, lost: lost, active: act.length };
  var accounts = rows("GrAccounts").filter(function (a) { return a.status !== "deleted"; }).map(function (a) { var x = {}; TABLES.GrAccounts.forEach(function (k) { x[k] = a[k]; }); return x; });
  var contacts = rows("GrContacts").filter(function (c) { return c.status !== "deleted"; }).map(function (c) { var x = {}; TABLES.GrContacts.forEach(function (k) { x[k] = c[k]; }); return x; });
  return { opps: out, accounts: accounts, contacts: contacts, dash: dash, today: today, money: money, admin: me.role === "admin", rates: money ? grRates() : null, creds: grCreds(), stages: GR_STAGES, tasks: Object.keys(GR_TASKS).map(function (k) { return { key: k, label: GR_TASKS[k].label, zone: GR_TASKS[k].zone, unit: GR_TASKS[k].unit, freq: GR_TASKS[k].freq, section: GR_TASKS[k].section }; }),
    staff: rows("People").filter(function (x) { return isTrue(x.active) && isStaff(x); }).map(function (x) { return { email: x.email, name: x.name }; }), crews: rows("LsCrews").map(function (c) { return { id: c.id, name: c.name, skills: c.skills }; }),
    log: rows("LsLog").filter(function (l) { return l.kind === "growth"; }).slice(-80).reverse().map(function (l) { return { at: l.at, by: personName(l.by), ref: l.ref, text: l.text }; }) };
};
NO_LOCK.grHome = 1;
var _lsPropOutGr = lsPropOut;
lsPropOut = function (p, role, money) { var o = _lsPropOutGr(p, role, money); if (role === "office") o.proposal_id = p.proposal_id || ""; return o; };
["grSaveAccount", "grSaveContact", "grSaveOpp", "grSaveInspection", "grAddPhotos", "grDraftLines", "grSaveEstimate", "grRates", "grSaveCred", "grNewProposal", "grSaveProposal", "grProposalView", "grPhotoData", "grReview", "grSavePdf",
 "grDraftEmail", "grSendEmail", "grAccept", "grConvertCheck", "grConvert", "grHome"].forEach(function (a) { PREFETCH[a] = ["People", "Projects"].concat(LS_TABLES, GR_TABLES); });
