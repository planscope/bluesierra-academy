/* ======================================================================================================
   Outreach: get Blue Sierra on the bid lists of the architects, landscape architects, builders and engineers
   behind the Peninsula's permits. Projects come from the weekly permit search (a CSV), firms and contacts from
   our research and RocketReach, and every touch (email, LinkedIn, call, site walk) is logged.

   Rules that live here, not in anyone's memory:
   - Owners and individual applicants are never contacted: they show, with no outreach buttons.
   - Excluded firms (competitors, demo trades, partners Jesús handles himself) get no outreach; "do not call" skips calls.
   - On a shared project the warm firm goes first: cold outreach on it waits until the warm firm's email is
     3+ business days old or they replied.
   - New first emails: at most 10 a day. Jesús can send any day; Tuesday to Thursday is only a tip (more replies).
     Holiday weeks (Nov 25-27, Dec 24 - Jan 1) ask him to confirm first.
   - The portal writes every email; Jesús reads it and taps Send. Follow-ups wait for his tap too, and stop
     the moment the firm replies (we look in his Gmail).
   - RocketReach lookups cost credits: the cost is shown before a batch, nothing runs without a confirm,
     firms with a verified email are skipped, and nobody is looked up twice.
   ====================================================================================================== */
TABLES.OxProjects = ["id", "key", "town", "address", "type", "other_types", "description", "permit_no", "status", "date", "priority", "source_url", "known", "next_step",
  "owner", "first_seen", "last_seen", "import_id", "updated_at", "zone", "sub_area", "stage", "fit", "reach", "bid_status", "bid_by", "bid_at", "bid_due", "bid_note", "task_owner", "task_text", "task_date"];
TABLES.OxFirms = ["id", "name", "norm", "firm_type", "segment", "priority", "wave", "channel", "website", "phone", "flags", "notes", "individual", "confirmed",
  "status", "next_step", "next_date", "email_source", "created_at", "updated_at", "assignee"];
TABLES.OxContacts = ["id", "firm_id", "name", "role", "email", "phone", "linkedin", "source", "verified", "rr_id", "created_at", "updated_at", "phones", "bid_contact", "referred_by"];
TABLES.OxRoles = ["id", "project_id", "firm_id", "role", "raw", "source"];
TABLES.OxTouches = ["id", "firm_id", "contact_id", "project_id", "date", "channel", "step", "summary", "outcome", "by", "at", "outbox_id", "thread_id"];
TABLES.OxOutbox = ["id", "key", "firm_id", "contact_id", "project_id", "step", "to", "subject", "body", "status", "msg_id", "thread_id", "error", "created_by", "created_at", "sent_at", "send_on"];
TABLES.OxOpps = ["id", "firm_id", "project_id", "stage", "amount", "due", "notes", "created_by", "created_at", "updated_at", "scope", "contact_id", "plans_url", "next_step", "next_date", "assignee", "referred_by", "lost_note", "handoff_to", "handoff_at"];
TABLES.OxEnrich = ["id", "firm_id", "person", "rr_id", "status", "result", "at", "by"];
TABLES.OxAlerts = ["id", "firm_id", "project_id", "kind", "status", "created_at", "done_at"];
TABLES.OxImports = ["id", "kind", "file", "at", "by", "counts"];
TABLES.OxMeetings = ["id", "firm_id", "contact_id", "project_id", "day", "time", "minutes", "kind", "where", "email", "event_id", "link", "status", "booked_by", "note", "created_at", "updated_at"];
var OX_T = ["OxProjects", "OxFirms", "OxContacts", "OxRoles", "OxTouches", "OxOutbox", "OxOpps", "OxEnrich", "OxAlerts", "OxImports", "OxMeetings"];
var OX_TOWNS = ["Atherton", "Burlingame", "Hillsborough", "Los Altos", "Los Altos Hills", "Los Gatos", "Saratoga", "Woodside", "Portola Valley", "Menlo Park", "Palo Alto", "Monte Sereno", "Cupertino"];
var OX_STAGES = ["prospect", "invited", "plans", "site_walk", "bid_sent", "won", "lost"];          // a "bid track": one firm buying one scope on one property
var OX_ROLES = ["architect", "landscape_architect", "contractor", "engineer", "applicant", "owner"];
var OX_DAILY = 10;                                                                  // new first emails a day
var OX_NOW = 0;                                                                     // tests set a fixed clock
function oxNowMs() { return OX_NOW || Date.now(); }
function oxStamp() { return Utilities.formatDate(new Date(oxNowMs()), CONFIG.TZ, "yyyy-MM-dd HH:mm"); }
function oxToday() { return Utilities.formatDate(new Date(oxNowMs()), CONFIG.TZ, "yyyy-MM-dd"); }
function oxNeed(me) { if (!me || !isStaff(me) || me.preview) throw new Error("Outreach is for the Blue Sierra office."); }
function oxAdmin(me) { if (!me || me.role !== "admin" || me.preview) throw new Error("Only Jesús sends outreach emails."); }

/* ---------- names, addresses and dates ---------- */
var OX_STREET = { lane: "ln", road: "rd", avenue: "ave", av: "ave", drive: "dr", court: "ct", street: "st", place: "pl", circle: "cir", boulevard: "blvd", terrace: "ter", highway: "hwy", parkway: "pkwy", way: "way", trail: "trl", lne: "ln" };
function oxAddrKey(addr, town) {
  var tn = String(town || "").trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&");     // "1 Tynan Way, Portola Valley" is the same place as "1 Tynan Way"
  if (tn) addr = String(addr || "").replace(new RegExp(",\\s*" + tn + "(\\s*,?\\s*ca)?(\\s*\\d{5})?\\s*$", "i"), "");
  var w = String(addr || "").toLowerCase().replace(/[.,#]/g, " ").replace(/\s+/g, " ").trim().split(" ").map(function (x) { return OX_STREET[x] || x; });
  return (w.join(" ") + "|" + String(town || "").toLowerCase().trim()).trim();
}
function oxNorm(s) {
  return String(s || "").toLowerCase().replace(/\([^)]*\)/g, " ").replace(/&/g, " and ").replace(/[^a-z0-9 ]/g, " ")
    .replace(/\b(inc|llc|corp|corporation|co|ltd|the|dba|pc|aia|fasla)\b/g, " ").replace(/\s+/g, " ").trim();
}
function oxTitle(s) { return String(s || "").toLowerCase().replace(/\b[a-z]/g, function (c) { return c.toUpperCase(); }); }
function oxDayMs(d) { var m = String(d || "").match(/^(\d{4})-(\d\d)-(\d\d)/); return m ? new Date(+m[1], +m[2] - 1, +m[3], 12).getTime() : NaN; }
function oxDay(ms) { return Utilities.formatDate(new Date(ms), CONFIG.TZ, "yyyy-MM-dd"); }
function oxAdd(d, n) { return oxDay(oxDayMs(d) + n * 864e5); }
function oxDow(d) { return new Date(oxDayMs(d)).getDay(); }
function oxBlackout(d) { var md = String(d).slice(5); return (md >= "11-25" && md <= "11-27") || md >= "12-24" || md <= "01-01"; }
function oxWorkday(d) { var w = oxDow(d); return w > 0 && w < 6 && !oxBlackout(d); }
function oxNextWorkday(d) { var x = d; for (var i = 0; i < 20 && !oxWorkday(x); i++) x = oxAdd(x, 1); return x; }
function oxBizDaysSince(d, today) { var n = 0, x = d; for (var i = 0; i < 60 && x < today; i++) { x = oxAdd(x, 1); if (oxWorkday(x)) n++; } return n; }
function oxNewEmailDay(d) { var w = oxDow(d); return w >= 2 && w <= 4 && !oxBlackout(d); }       // Tue-Thu
function oxFlags(f) {
  var t = (String(f.flags || "") + " " + String(f.segment || "")).toLowerCase();
  return { excluded: f.segment === "excluded" || /exclude|do not contact|do-not-contact/.test(t) || /^verdance\b/i.test(f.name || ""), noCall: /do not call|do-not-call|no setter calls/.test(t + " " + String(f.channel || "").toLowerCase()),
    personal: /personally/.test(t + " " + String(f.channel || "").toLowerCase()), individual: isTrue(f.individual) && !isTrue(f.confirmed) };
}

/* ---------- writing whole tables at once (imports touch hundreds of rows; one write instead of hundreds) ---------- */
function oxWriteAll(t, list) {
  if (typeof oxMemWrite === "function") return oxMemWrite(t, list, false);              // the portal preview keeps tables in memory
  var sh = tableSheet(t), h = TABLES[t], last = sh.getLastRow();
  if (last > 1) sh.getRange(2, 1, last - 1, h.length).clearContent();
  if (list.length) sh.getRange(2, 1, list.length, h.length).setNumberFormat("@").setValues(list.map(function (o) { return h.map(function (k) { return safe(String(o[k] == null ? "" : o[k])); }); }));
  _ROWS[t] = list.map(function (o) { var x = {}; h.forEach(function (k) { x[k] = String(o[k] == null ? "" : o[k]); }); return x; });
}
function oxAppend(t, list) {
  if (!list.length) return; if (typeof oxMemWrite === "function") return oxMemWrite(t, list, true);
  var sh = tableSheet(t), h = TABLES[t], r = sh.getLastRow() + 1;
  sh.getRange(r, 1, list.length, h.length).setNumberFormat("@").setValues(list.map(function (o) { return h.map(function (k) { return safe(String(o[k] == null ? "" : o[k])); }); }));
  delete _ROWS[t];
}

/* ====================================== import ====================================== */
/* The three files from the permit search. Upsert: projects by permit no. + address, firms by name. Blank stays blank. */
ACTIONS.oxImport = function (me, b) {
  oxNeed(me); var kind = String(b.kind || ""), list = [].concat(b.rows || []);
  if (["projects", "firms", "tracker", "contacts"].indexOf(kind) < 0) throw new Error("Pick what you're importing.");
  if (!list.length) throw new Error("That file has no rows."); if (list.length > 5000) throw new Error("Too many rows for one import (5,000 max).");
  var g = function (r, k) { return clean(r[k], 4000); }, imp = { id: newId("oi"), kind: kind, file: clean(b.file, 120), at: now(), by: me.email, counts: "" }, c = {};
  if (kind === "projects") c = oxImportProjects(list, g, imp);
  else if (kind === "firms") c = oxImportFirms(list, g, me);
  else if (kind === "contacts") c = oxImportContacts(list, g, me);
  else c = oxImportTracker(list, g, me);
  imp.counts = JSON.stringify(c); insert("OxImports", imp);
  return { counts: c };
};
/* The ranked file (ALL_permit_leads_ranked.csv and its zone_*.csv parts) names some columns differently and adds zone, stage and fit. */
function oxProjRow(r) {
  if (r.application_permit_no != null || r.permit_no == null) return r;
  return Object.assign({}, r, { application_permit_no: r.permit_no, town: r.city, project_description: r.description, status: r.status_raw, owner: r.owner_do_not_contact,
    other_project_types: r.all_types, priority: r.fit_tier || r.original_priority || "" });
}
function oxImportProjects(list, g, imp) {
  list = list.map(oxProjRow);
  var all = rows("OxProjects").slice(), byKey = {}, t = now(), today = oxToday(), c = { rows: list.length, new: 0, updated: 0, skipped: 0, roles: 0, alerts: 0 }, fresh = [];
  all.forEach(function (p) { byKey[p.key] = p; });
  all.forEach(function (p) { var k2 = String(p.permit_no || "").toUpperCase() + "|" + oxAddrKey(p.address, p.town); if (!byKey[k2]) byKey[k2] = p; });   // also by today's address rules
  list.forEach(function (r) {
    var town = oxTitle(g(r, "town")), addr = g(r, "address"); if (!addr || !town) { c.skipped++; return; }
    var key = (g(r, "application_permit_no").toUpperCase() + "|" + oxAddrKey(addr, town)), p = byKey[key];
    if (!p && !g(r, "application_permit_no")) { all.forEach(function (x) { if (!p && oxAddrKey(x.address, x.town) === oxAddrKey(addr, town) && !x.permit_no) p = x; }); }
    var f = { town: town, address: addr, type: g(r, "project_type"), other_types: g(r, "other_project_types"), description: g(r, "project_description"), permit_no: g(r, "application_permit_no"),
      status: g(r, "status"), date: g(r, "date"), priority: g(r, "priority").toUpperCase().slice(0, 1), source_url: g(r, "source_url"), known: g(r, "known_to_jesus"), next_step: g(r, "next_step"), owner: g(r, "owner"), last_seen: today, updated_at: t,
      zone: g(r, "zone"), sub_area: g(r, "sub_area"), stage: (g(r, "stage_order") || g(r, "permit_stage")).replace(/^(\d).*$/, "$1").slice(0, 1).replace(/\D/, ""), fit: String(g(r, "fit_score")).replace(/[^\d.]/g, "").slice(0, 5), reach: g(r, "firm_to_reach").slice(0, 200) };
    if (p) { Object.keys(f).forEach(function (k) { if (f[k] !== "" || k === "status") p[k] = f[k]; }); c.updated++; }
    else { p = Object.assign({ id: newId("op"), key: key, first_seen: today, import_id: imp.id }, f); all.push(p); byKey[key] = p; c.new++; fresh.push(p.id); }
    p._raw = r;
  });
  oxWriteAll("OxProjects", all.map(function (p) { var o = Object.assign({}, p); delete o._raw; return o; }));
  // who's on each project, from the permit columns (manual links are kept)
  var firms = rows("OxFirms"), touched = {}; all.forEach(function (p) { if (p._raw) touched[p.id] = 1; });
  var old = rows("OxRoles"), prevLink = {};                                         // keep the firm a person already linked, by project + role + name
  old.forEach(function (x) { if (x.source === "permit" && x.firm_id) prevLink[x.project_id + "|" + x.role + "|" + x.raw] = x.firm_id; });
  var out = old.filter(function (x) { return !(x.source === "permit" && touched[x.project_id]); }), seenOut = {}, seenOld = {};
  out.forEach(function (x) { seenOut[x.project_id + "|" + x.role + "|" + x.raw] = 1; }); old.forEach(function (x) { seenOld[x.project_id + "|" + x.role + "|" + x.raw] = 1; });
  all.forEach(function (p) {
    if (!p._raw) return; var r = p._raw;
    [["architect", "architect"], ["landscape_architect", "landscape_architect"], ["contractor", "contractor"], ["engineer", "engineer"], ["applicant", "applicant"], ["owner", "owner"]].forEach(function (col) {
      String(g(r, col[0])).split(";").map(function (x) { return x.trim(); }).filter(Boolean).forEach(function (raw) {
        var rk = p.id + "|" + col[1] + "|" + raw; if (seenOut[rk]) return; seenOut[rk] = 1;
        var fm = col[1] === "owner" ? null : oxFindFirm(firms, raw), keepId = prevLink[p.id + "|" + col[1] + "|" + raw] || "";
        out.push({ id: newId("or"), project_id: p.id, firm_id: col[1] === "owner" ? "" : keepId || (fm ? fm.id : ""), role: col[1], raw: raw, source: "permit" }); if (!seenOld[rk]) c.roles++;
      });
    });
  });
  oxWriteAll("OxRoles", out);
  // a new project for a firm we're already talking to is a reason to write again
  var active = {}; rows("OxTouches").forEach(function (x) { active[x.firm_id] = 1; });
  var freshM = {}; fresh.forEach(function (id) { freshM[id] = 1; });
  var al = []; out.forEach(function (x) { if (x.firm_id && active[x.firm_id] && freshM[x.project_id] && !al.some(function (a) { return a.firm_id === x.firm_id && a.project_id === x.project_id; })) al.push({ id: newId("oa"), firm_id: x.firm_id, project_id: x.project_id, kind: "new_project", status: "open", created_at: t, done_at: "" }); });
  oxAppend("OxAlerts", al); c.alerts = al.length;
  return c;
}
function oxFindFirm(firms, raw) {
  var n = oxNorm(raw.replace(/\s+-\s+.*$/, "")); if (!n) return null;
  var hit = firms.filter(function (f) { return f.norm === n; })[0]; if (hit) return hit;
  hit = firms.filter(function (f) { return f.norm.length >= 6 && (n.indexOf(f.norm) === 0 || f.norm.indexOf(n) === 0); })[0];
  return hit || null;
}
function oxImportFirms(list, g, me) {
  var all = rows("OxFirms").slice(), contacts = rows("OxContacts").slice(), roles = rows("OxRoles").slice(), projects = rows("OxProjects"), touches = [], t = now(), c = { rows: list.length, new: 0, updated: 0, contacts: 0, links: 0, linkedin_touches: 0 };
  var byNorm = {}; all.forEach(function (f) { byNorm[f.norm] = f; });
  var byAddr = {}; projects.forEach(function (p) { var k = oxAddrKey(p.address, p.town); (byAddr[k] = byAddr[k] || []).push(p); });
  list.forEach(function (r) {
    var name = g(r, "firm"); if (!name) return; var n = oxNorm(name) || name.toLowerCase(), f = byNorm[n];
    var seg = g(r, "segment").toLowerCase().replace("known-firm", "known"), notes = g(r, "notes");
    var data = { name: name, norm: n, firm_type: g(r, "firm_type"), segment: seg, priority: g(r, "priority").toUpperCase().slice(0, 1), wave: g(r, "wave"), channel: g(r, "channel"),
      website: g(r, "website"), phone: g(r, "phone"), flags: g(r, "flags"), notes: notes, email_source: g(r, "email_source"), individual: /^individual named on permit/i.test(notes) ? "yes" : "", updated_at: t };
    if (f) { Object.keys(data).forEach(function (k) { if (data[k] !== "") f[k] = data[k]; }); c.updated++; }
    else { f = Object.assign({ id: newId("of"), status: "", next_step: "", next_date: "", confirmed: "", created_at: t }, data); all.push(f); byNorm[n] = f; c.new++; }
    // people: names split by ";", each email goes to the person it belongs to (by its local part), else it's the firm's general inbox
    var names = g(r, "contact_name").split(";").map(function (x) { return x.trim(); }).filter(Boolean);
    var emails = (g(r, "email") + " " + g(r, "email_source")).match(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g) || [];
    emails = emails.map(normEmail).filter(function (e, i, a) { return a.indexOf(e) === i; });
    var li = {}; g(r, "linkedin_in_crm").split(";").forEach(function (x) { var m = x.match(/^(.*?)\s*(https?:\/\/\S+)\s*(\[([^\]]+)\])?/); if (m) li[m[1].trim()] = { url: m[2], tag: m[4] || "" }; });
    var role = g(r, "role"), src = /gmail/i.test(g(r, "email_source")) ? "gmail" : g(r, "email") ? "website" : "import";
    var people = names.map(function (nm) { var clean1 = nm.replace(/\s*\([^)]*\)/g, "").replace(/,\s*(P\.?E\.?|FASLA|AIA|FAIA)\.?$/i, "").replace(/"[^"]*"\s*/g, "").trim(); return { name: clean1, raw: nm }; });
    Object.keys(li).forEach(function (nm) { var base = nm.replace(/,\s*(P\.?E\.?|FASLA|AIA|FAIA)\.?$/i, "").trim(); if (!people.some(function (p) { return oxSame(p.name, base); })) people.push({ name: base, raw: nm }); });
    var used = {};
    people.forEach(function (p) {
      var em = emails.filter(function (e) { return !used[e] && oxEmailFits(e, p.name); })[0] || ""; if (em) used[em] = 1;
      var link = null; Object.keys(li).forEach(function (k) { if (oxSame(k.replace(/,\s*(P\.?E\.?|FASLA|AIA|FAIA)\.?$/i, ""), p.name)) link = li[k]; });
      var ct = contacts.filter(function (x) { return x.firm_id === f.id && oxSame(x.name, p.name); })[0];
      var d = { firm_id: f.id, name: p.name, role: role, email: em, linkedin: link ? link.url : "", source: em ? src : "import", verified: em && src === "gmail" ? "yes" : "no", updated_at: t };
      if (ct) { Object.keys(d).forEach(function (k) { if (d[k] !== "" && !(k === "verified" && ct.verified === "yes")) ct[k] = d[k]; }); }
      else { ct = Object.assign({ id: newId("oc"), phone: "", rr_id: "", created_at: t }, d); contacts.push(ct); c.contacts++; }
      var sent = link && link.tag.match(/sent_(\d{4}-\d\d-\d\d)/);
      if (sent && !rows("OxTouches").some(function (x) { return x.contact_id === ct.id && x.channel === "linkedin"; })) { touches.push({ id: newId("ot"), firm_id: f.id, contact_id: ct.id, project_id: "", date: sent[1], channel: "linkedin", step: "", summary: "LinkedIn invite sent (from the research file)", outcome: "sent", by: me.email, at: t, outbox_id: "", thread_id: "" }); c.linkedin_touches++; }
    });
    emails.filter(function (e) { return !used[e]; }).forEach(function (e) {      // nobody's in particular: the firm's inbox
      if (contacts.some(function (x) { return x.firm_id === f.id && x.email === e; })) return;
      contacts.push({ id: newId("oc"), firm_id: f.id, name: "", role: "General inbox", email: e, phone: "", linkedin: "", source: src, verified: src === "gmail" ? "yes" : "no", rr_id: "", created_at: t, updated_at: t }); c.contacts++;
    });
    // its projects, by address (the firm's own list), e.g. "275 Josselyn Lane, Woodside (new home; applicant; ...) || ..."
    g(r, "projects").split("||").forEach(function (pp) {
      var m = pp.trim().match(/^([^,(]+),\s*([^(]+?)\s*\(([^;)]*);\s*([^;)]*)/); if (!m) return;
      var hits = byAddr[oxAddrKey(m[1], m[2])] || [], rl = oxRole(m[4]);
      hits.forEach(function (p) {
        if (roles.some(function (x) { return x.project_id === p.id && x.firm_id === f.id; })) return;
        var open = roles.filter(function (x) { return x.project_id === p.id && !x.firm_id && x.role === rl && oxFindFirm([f], x.raw); })[0];
        if (open) open.firm_id = f.id; else roles.push({ id: newId("or"), project_id: p.id, firm_id: f.id, role: rl, raw: name, source: "firms" });
        c.links++;
      });
    });
  });
  // permit names that match a firm now that the firm exists
  roles.forEach(function (x) { if (!x.firm_id && x.role !== "owner") { var fm = oxFindFirm(all, x.raw); if (fm) { x.firm_id = fm.id; c.links++; } } });
  oxWriteAll("OxFirms", all); oxWriteAll("OxContacts", contacts); oxWriteAll("OxRoles", roles); oxAppend("OxTouches", touches);
  return c;
}
function oxRole(s) { s = String(s || "").toLowerCase(); return /landscape/.test(s) ? "landscape_architect" : /architect|design/.test(s) ? "architect" : /contractor|builder|gc/.test(s) ? "contractor" : /engineer/.test(s) ? "engineer" : "applicant"; }
function oxSame(a, b) { var x = oxNorm(a), y = oxNorm(b); return !!x && !!y && (x === y || x.split(" ").slice(0, 2).join(" ") === y.split(" ").slice(0, 2).join(" ")); }
function oxEmailFits(email, name) {
  var lp = String(email).split("@")[0].toLowerCase().replace(/[^a-z]/g, ""), w = oxNorm(name).split(" ").filter(function (x) { return x.length > 1; }); if (!w.length || !lp) return false;
  var fi = w[0], la = w[w.length - 1];
  return lp === fi || lp === la || lp === fi + la || lp === fi[0] + la || lp === fi + la[0] || lp === fi + "." + la || (la.length >= 4 && lp.indexOf(la) > -1) || (fi.length >= 4 && lp.indexOf(fi) === 0);
}
/* The weekly search's second file: each firm's website, phone and public email (from its own site or the permit). */
function oxImportContacts(list, g, me) {
  var firms = rows("OxFirms").slice(), byNorm = {}, t = now(), c = { rows: list.length, firms_new: 0, websites: 0, phones: 0, emails: 0 };
  firms.forEach(function (f) { byNorm[f.norm] = f; });
  list.forEach(function (r) {
    var name = g(r, "firm"); if (!name) return; var n = oxNorm(name) || name.toLowerCase(), f = byNorm[n];
    if (!f) { f = { id: newId("of"), name: name, norm: n, firm_type: g(r, "firm_type"), segment: "cold", priority: "", wave: "", channel: "", website: "", phone: "", flags: "", notes: "", individual: "", confirmed: "", status: "", next_step: "", next_date: "", email_source: "", created_at: t, updated_at: t }; insert("OxFirms", f); byNorm[n] = f; c.firms_new++; }
    var patch = {}; if (g(r, "website") && !f.website) { patch.website = g(r, "website"); c.websites++; } if (g(r, "phone") && !f.phone) { patch.phone = g(r, "phone"); c.phones++; }
    if (Object.keys(patch).length) { patch.updated_at = t; update("OxFirms", "id", f.id, patch); }
    var e = normEmail(g(r, "public_email") || g(r, "email")); if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e) || OX_JUNK.test(e)) return;
    if (rows("OxContacts").some(function (x) { return x.firm_id === f.id && x.email === e; })) return;
    var cn = g(r, "contact_name"), person = cn ? rows("OxContacts").filter(function (x) { return x.firm_id === f.id && !x.email && oxSame(x.name, cn); })[0] : null;
    if (person) update("OxContacts", "id", person.id, { email: e, source: "website", updated_at: t });
    else insert("OxContacts", { id: newId("oc"), firm_id: f.id, name: cn, role: g(r, "role") || (OX_GENERIC.test(e.split("@")[0]) ? "General inbox" : ""), email: e, phone: "", linkedin: "", source: "website", verified: "no", rr_id: "", created_at: t, updated_at: t });
    c.emails++;
  });
  // new firms from this file get linked to the permits that name them
  var roles = rows("OxRoles"), all = rows("OxFirms"), links = 0; roles.forEach(function (x) { if (!x.firm_id && x.role !== "owner") { var fm = oxFindFirm(all, x.raw); if (fm) { update("OxRoles", "id", x.id, { firm_id: fm.id }); links++; } } }); c.links = links;
  return c;
}
function oxImportTracker(list, g, me) {
  var firms = rows("OxFirms"), byNorm = {}, t = now(), touches = [], have = rows("OxTouches"), c = { rows: list.length, firms: 0, touches: 0, unknown: [] };
  firms.forEach(function (f) { byNorm[f.norm] = f; });
  list.forEach(function (r) {
    var f = byNorm[oxNorm(g(r, "firm"))]; if (!f) { if (g(r, "firm")) c.unknown.push(g(r, "firm")); return; } c.firms++;
    var add = function (date, channel, step, summary, outcome) {
      if (!/^\d{4}-\d\d-\d\d/.test(date)) return; date = date.slice(0, 10);
      if (have.concat(touches).some(function (x) { return x.firm_id === f.id && x.channel === channel && x.date === date && x.step === step; })) return;
      touches.push({ id: newId("ot"), firm_id: f.id, contact_id: "", project_id: "", date: date, channel: channel, step: step, summary: summary, outcome: outcome, by: me.email, at: t, outbox_id: "", thread_id: "" }); c.touches++;
    };
    add(g(r, "day0_email_date"), "email", "day0", g(r, "notes") || "First email (from the tracker)", "sent");
    add(g(r, "day3_linkedin_date"), "linkedin", "day3", "LinkedIn (from the tracker)", "done");
    add(g(r, "day7_call_date"), "call", "day7", "Call (from the tracker)", "done");
    add(g(r, "day14_followup_date"), "email", "day14", "Follow-up (from the tracker)", "sent");
    add(g(r, "reply_date"), "reply", "", "They replied (from the tracker)", "replied");
    var o = g(r, "outcome"), patch = {};
    if (g(r, "next_step")) patch.next_step = g(r, "next_step"); if (g(r, "next_step_date")) patch.next_date = g(r, "next_step_date");
    if (g(r, "reply_date")) patch.status = "replied"; else if (o && o !== "not_started" && !f.status) patch.status = "active";
    if (Object.keys(patch).length) { patch.updated_at = t; update("OxFirms", "id", f.id, patch); }
  });
  oxAppend("OxTouches", touches); c.unknown = c.unknown.slice(0, 20);
  return c;
}

/* ====================================== the home: everything the module shows ====================================== */
ACTIONS.oxHome = function (me, b) {
  oxNeed(me); prefetch(OX_T.concat(["People"]));
  var today = oxToday(), firms = rows("OxFirms"), contacts = rows("OxContacts"), roles = rows("OxRoles"), touches = rows("OxTouches"), projects = rows("OxProjects");
  var people = {}; rows("People").forEach(function (p) { people[normEmail(p.email)] = { name: p.name, avatar: p.avatar || "", key: pkey(p.email), role: p.role }; });
  var byFirm = {}; touches.forEach(function (x) { (byFirm[x.firm_id] = byFirm[x.firm_id] || []).push(x); });
  var st = {}; firms.forEach(function (f) { st[f.id] = oxState(f, byFirm[f.id] || [], today); });
  var block = oxBlocks(firms, roles, st, today);
  var sentToday = rows("OxOutbox").filter(function (m) { return m.status === "sent" && m.step === "day0" && String(m.sent_at).slice(0, 10) === today; }).length;
  var queue = oxQueue(firms, contacts, roles, projects, st, block, today, sentToday);
  var opps = rows("OxOpps"), cx = oxCtx(today);
  var kpi = { firms: firms.filter(function (f) { return !oxFlags(f).excluded; }).length, contacted: firms.filter(function (f) { return st[f.id].emailed; }).length, reached: firms.filter(function (f) { return !oxFlags(f).excluded && (st[f.id].emailed || st[f.id].last); }).length,
    replied: firms.filter(function (f) { return st[f.id].replied; }).length, invites: opps.length, bids: opps.filter(function (o) { return ["bid_sent", "won", "lost"].indexOf(o.stage) > -1; }).length,
    won: opps.filter(function (o) { return o.stage === "won"; }).length, sent_today: sentToday, daily: OX_DAILY };
  var wk = oxAdd(today, -((oxDow(today) + 6) % 7)), week = { from: wk, email: 0, linkedin: 0, call: 0, reply: 0, invites: 0 };
  touches.forEach(function (x) { if (x.date >= wk && x.date <= today) { if (x.channel === "email") week.email++; else if (x.channel === "linkedin") week.linkedin++; else if (x.channel === "call") week.call++; else if (x.channel === "reply") week.reply++; if (x.outcome === "invited") week.invites++; } });
  return { week: week, today: today, can_send: me.role === "admin", new_email_day: oxNewEmailDay(today), blackout: oxBlackout(today), kpi: kpi, queue: queue, towns: OX_TOWNS, stages: OX_STAGES,
    projects: projects.map(function (p) { var o = Object.assign({}, p), a = oxProjAct(p, cx), bd = oxBidOf(p, opps); delete o.key; delete o.owner;
      o.act = { kind: a.kind, label: a.label, firm_id: a.firm_id || "", contact_id: a.contact_id || "", phone: a.phone || "", step: a.step || "", role_id: a.role_id || "", opp_id: a.opp_id || "", who: a.who || null, firm: a.firm || "", alt: (a.alt || []).map(function (x) { return { kind: x.kind, label: x.label, contact_id: x.contact_id || "", phone: x.phone || "", step: x.step || "" }; }) }; o.bid = bd.status; o.bid_label = bd.label; o.bid_due = bd.due; o.why = oxWhy(p, cx); o.scope_conf = oxScopeOf(p).confirmed;
      o.score = oxProjScore(p, a, bd, today); return o; }),
    priority: (function () { var top = projects.map(function (p) { return { p: p, s: oxProjScore(p, oxProjAct(p, cx), oxBidOf(p, opps), today) }; }).filter(function (x) { return x.s > -999; }).sort(function (a, b) { return b.s - a.s; }).slice(0, 12);
      return top.map(function (x) { return oxBrief(x.p, cx, me); }); })(),
    tracked: { towns: projects.map(function (p) { return p.town; }).filter(function (x, i, l) { return x && l.indexOf(x) === i; }).sort(), week_start: oxWeekStart(today),
      reachable: projects.filter(function (p) { return ["email", "call", "ask", "log"].indexOf(oxProjAct(p, cx).kind) > -1 && p.stage !== "5"; }).length },
    agenda: oxAgenda(cx, projects, today), tracks: opps.map(oxTrackOut),
    drafts: rows("OxOutbox").filter(function (m) { return m.status === "draft"; }).map(function (m) { return { key: m.key, firm_id: m.firm_id, contact_id: m.contact_id, project_id: m.project_id, step: m.step, to: m.to, subject: m.subject, body: m.body, send_on: m.send_on, by: personName(m.created_by) }; }),
    team: rows("People").filter(function (x) { return isStaff(x) && isTrue(x.active); }).map(function (x) { return { email: x.email, name: x.name }; }),
    firms: firms.map(function (f) { var fl = oxFlags(f), s = st[f.id]; return Object.assign({}, f, { flag: fl, state: s.state, emailed: s.emailed, replied: s.replied, last: s.last, due: s.due, blocked: block[f.id] || null,
      projects: roles.filter(function (x) { return x.firm_id === f.id && x.role !== "owner"; }).map(function (x) { return x.project_id; }).filter(function (x, i, l) { return l.indexOf(x) === i; }).length,
      act: cx.act[f.id] }); }),
    contacts: contacts, roles: roles, opps: opps, alerts: rows("OxAlerts").filter(function (a) { return a.status === "open"; }),
    touches: touches.slice(-1500).map(function (x) { var o = Object.assign({}, x); var p = people[normEmail(x.by)]; o.by_name = p ? p.name : x.by; o.by_avatar = p ? p.avatar : ""; o.by_key = p ? p.key : ""; return o; }),
    rr: oxRrInfo(), ai: { on: !!aiKey() }, sig: oxSig(), last_import: (rows("OxImports").slice(-1)[0] || null), calls: oxCallsHome(today) };
};
NO_LOCK.oxHome = 1;
/* What the setter did, for Jesús: meetings booked, today's and this week's calls, and who still needs a phone number. */
function oxCallsHome(today) {
  var pool = oxCallPool(today), since = oxAdd(today, -14);
  return { meetings: rows("OxMeetings").filter(function (m) { return (m.status === "booked" && m.day >= oxAdd(today, -3)) || (m.day >= since && m.status !== "canceled"); })
      .sort(function (a, c) { return (a.day + a.time) < (c.day + c.time) ? -1 : 1; }).map(oxMeetOut),
    on_list: pool.items.length, no_phone: pool.no_phone, no_phone_total: pool.no_phone.length, stats: oxCallStats("", today),
    setters: rows("People").filter(function (p) { return p.role === "setter" && isTrue(p.active); }).map(function (p) { return { name: p.name, email: p.email, stats: oxCallStats(p.email, today) }; }) };
}
/* Where a firm is in the cadence: day 0 email → day 3 LinkedIn → day 7 call → day 14 follow-up, unless they replied. */
function oxState(f, list, today) {
  var em = list.filter(function (x) { return x.channel === "email" && x.step === "day0"; }).sort(function (a, b) { return a.date < b.date ? -1 : 1; })[0];
  var replied = list.some(function (x) { return x.channel === "reply"; }) || f.status === "replied" || f.status === "meeting";   // a meeting booked by the setter stops the emails too
  var last = list.slice().sort(function (a, b) { return a.date < b.date ? 1 : -1; })[0] || null;
  var o = { emailed: !!em, replied: replied, last: last ? { date: last.date, channel: last.channel } : null, day0: em ? em.date : "", due: null, state: replied ? "replied" : f.status === "closed" ? "closed" : em ? "in_cadence" : "new" };
  if (em && !replied && f.status !== "closed" && f.status !== "paused") {
    var steps = [["day3", 3, "linkedin"], ["day7", 7, "call"], ["day14", 14, "email"]], fl = oxFlags(f);
    for (var i = 0; i < steps.length; i++) {
      var s = steps[i]; if (s[0] === "day7" && fl.noCall) continue;
      if (list.some(function (x) { return x.step === s[0] || (s[0] === "day3" && x.channel === "linkedin" && x.date >= em.date); })) continue;
      o.due = { step: s[0], channel: s[2], date: oxNextWorkday(oxAdd(em.date, s[1])) }; break;
    }
  }
  return o;
}
/* Warm first: on a shared project, cold outreach waits for the warm firm (3 business days after their email, or a reply). */
function oxBlocks(firms, roles, st, today) {
  var fById = {}; firms.forEach(function (f) { fById[f.id] = f; });
  var byProj = {}; roles.forEach(function (x) { if (x.firm_id) (byProj[x.project_id] = byProj[x.project_id] || []).push(x.firm_id); });
  var out = {};
  firms.forEach(function (f) {
    if (f.segment !== "cold") return;
    var mine = roles.filter(function (x) { return x.firm_id === f.id; }).map(function (x) { return x.project_id; });
    if (!mine.length) return;
    var waits = [], held = [];
    mine.forEach(function (pid) {
      var warm = (byProj[pid] || []).filter(function (id) { return id !== f.id && fById[id] && fById[id].segment === "warm"; });
      var w = warm.filter(function (id) { var s = st[id]; return !(s.replied || (s.day0 && oxBizDaysSince(s.day0, today) >= 3)); });
      if (w.length) { waits.push(fById[w[0]].name); held.push(pid); }
    });
    if (held.length) out[f.id] = { waiting_on: waits.filter(function (x, i, a) { return a.indexOf(x) === i; }).slice(0, 3), held: held, all: held.length >= mine.filter(function (x, i, a) { return a.indexOf(x) === i; }).length };
  });
  return out;
}
function oxBestContact(l) {
  var score = function (c) { return (c.verified === "yes" ? 0 : c.source === "guessed" ? 20 : 10) + (c.name ? 0 : 5) + (/princ|partner|owner|founder|president/i.test(c.role) ? 0 : /project|estimat|bid/i.test(c.role) ? 1 : 2); };
  return l.slice().sort(function (a, b) { return score(a) - score(b); })[0] || null;
}
/* What to do today, in order. */
function oxQueue(firms, contacts, roles, projects, st, block, today, sentToday) {
  var pById = {}; projects.forEach(function (p) { pById[p.id] = p; });
  var best = function (f) { var l = contacts.filter(function (c) { return c.firm_id === f.id && c.email; }); return oxBestContact(l); };
  var due = [], ready = [], noEmail = [];
  var rank = function (f) { return (f.segment === "warm" ? 0 : f.segment === "known" ? 1 : 2) * 100 + (Number(f.wave) || 9) * 10 + ("ABC".indexOf(f.priority) + 1 || 9); };
  firms.forEach(function (f) {
    var fl = oxFlags(f), s = st[f.id]; if (fl.excluded || s.replied || f.status === "closed" || f.status === "paused" || f.status === "removed") return;
    if (s.due && s.due.date <= today && !oxBlackout(today)) due.push({ firm_id: f.id, step: s.due.step, channel: s.due.channel, date: s.due.date, late: Math.max(0, Math.round((oxDayMs(today) - oxDayMs(s.due.date)) / 864e5)) });
    if (!s.emailed) {
      var ct = best(f), pr = roles.filter(function (x) { return x.firm_id === f.id; }).map(function (x) { return pById[x.project_id]; }).filter(Boolean);
      if (!pr.length) return;
      var item = { firm_id: f.id, contact_id: ct ? ct.id : "", rank: rank(f), blocked: block[f.id] && block[f.id].all ? block[f.id] : null, individual: fl.individual };
      if (ct) ready.push(item); else if (f.wave && !fl.individual) noEmail.push(item);
    }
  });
  ready.sort(function (a, b) { return (a.blocked ? 1 : 0) - (b.blocked ? 1 : 0) || a.rank - b.rank; });
  noEmail.sort(function (a, b) { return a.rank - b.rank; });
  return { due: due.sort(function (a, b) { return a.date < b.date ? -1 : 1; }), ready: ready.slice(0, 40), room: Math.max(0, OX_DAILY - sentToday), no_email: noEmail.slice(0, 40), no_email_total: noEmail.length };
}

/* ====================================== emails: drafted here, Jesús sends ====================================== */
var OX_TYPE = { new_home: "new home", major_remodel: "remodel", landscape: "landscape", grading: "site work", pool: "pool", tree: "", other: "" };
function oxStreet(p) { return oxTitle(String(p.address || "").replace(/\s+/g, " ")).replace(/\b(Ln|Rd|Ave|Dr|Ct|St|Pl|Cir|Blvd|Way)\b/g, function (x) { return x; }); }
/* How a project reads in an email: "32 Encina Avenue in Atherton just had landscape permits filed". */
var OX_SUF_LONG = { ln: "Lane", rd: "Road", ave: "Avenue", av: "Avenue", dr: "Drive", ct: "Court", st: "Street", pl: "Place", cir: "Circle", blvd: "Boulevard", ter: "Terrace", hwy: "Highway", pkwy: "Parkway", trl: "Trail" };
var OX_SUF_SHORT = { lane: "Ln", road: "Rd", avenue: "Ave", drive: "Dr", court: "Ct", street: "St", place: "Pl", circle: "Cir", boulevard: "Blvd", terrace: "Ter", highway: "Hwy", parkway: "Pkwy", trail: "Trl" };
function oxStreetWords(p) {
  var a = String(p.address || "").split(",")[0].replace(/\s+new$/i, "").replace(/\./g, "").trim();
  var w = oxTitle(a).split(/\s+/).filter(Boolean); if (/^0+$/.test(w[0] || "")) w = w.slice(1);   // "00 Eugenia Way" → "Eugenia Way"
  return w;
}
function oxStreetFull(p) { var w = oxStreetWords(p), k = (w[w.length - 1] || "").toLowerCase(); if (OX_SUF_LONG[k]) w[w.length - 1] = OX_SUF_LONG[k]; return w.join(" "); }
function oxStreetName(p) {                                              // "Encina Ave": no number, short suffix (for the subject)
  var w = oxStreetWords(p); if (/^\d/.test(w[0] || "")) w = w.slice(1); var k = (w[w.length - 1] || "").toLowerCase();
  if (OX_SUF_SHORT[k]) w[w.length - 1] = OX_SUF_SHORT[k]; else if (OX_SUF_LONG[k]) w[w.length - 1] = oxTitle(k); return w.join(" ");
}
function oxScope(p) { return { landscape: "the landscape", grading: "the grading and site work", pool: "the pool and hardscape" }[p.type] || "the site work and landscape"; }
function oxStagePhrase(p) {
  var kw = { landscape: "landscape ", pool: "pool ", grading: "grading " }[p.type] || "", st = String(p.stage || ""), raw = String(p.status || "").toLowerCase();
  if (!st) st = /issued|final/.test(raw) ? "4" : /approv/.test(raw) ? "3" : /review|asrb|adrb|ascc|hearing|scheduled/.test(raw) ? "1" : /applied|submitted|plan check|pending/.test(raw) ? "2" : "";
  return { "1": "is going through design review", "2": "just had " + kw + "permits filed", "3": "just got planning approval", "4": "just had " + kw + "permits issued" }[st] || "is moving";
}
/* Our portfolio: the public project pages on bluesierracorp.com/projects/… (location from each page). First emails to firms
   that haven't worked with us name one or two real projects, nearest first (same town, then the same part of the Peninsula). */
var OX_SITE = "https://www.bluesierracorp.com/projects/";
var OX_WORK = [["eucalyptus", "Eucalyptus", "Hillsborough"], ["pinehill-residence", "Pinehill Residence", "Hillsborough"], ["chiltern-residence", "Chiltern Residence", "Hillsborough"], ["rose-residence", "Rose Residence", "Hillsborough"],
  ["bates", "the Bates residence", "Hillsborough"], ["atherton-complex", "the Atherton Complex", "Atherton"], ["barron-ave", "Barron Ave", "Palo Alto"], ["enchanted-hotel", "the Enchanted Hotel", "Los Altos"], ["shirley", "the Shirley residence", "Los Altos"]];
var OX_AREA = { north: ["Hillsborough", "Burlingame", "San Mateo", "Unincorporated San Mateo Co."], mid: ["Atherton", "Menlo Park", "Woodside", "Portola Valley", "Palo Alto", "Redwood City"],
  south: ["Los Altos", "Los Altos Hills", "Cupertino", "Saratoga", "Los Gatos", "Monte Sereno", "Unincorporated Santa Clara Co."] };
var OX_WORK_SAY = { one: ["We've done several projects around here, including {n1} in {t1}. Here's that one: {url}", "We've built several projects around here, like {n1} in {t1}: {url}"], same: ["We've done several projects in {town}, like {n1} and {n2}. Here's one: {url}", "We've built several projects in {town}, including {n1} and {n2}: {url}"],
  near: ["We've done several projects nearby, including {n1} in {t1}: {url}", "We've built several projects around here, like {n1} in {t1}: {url}"],
  any: ["We've done several projects around the Peninsula, like {n1} in {t1} and {n2} in {t2}. Here's one: {url}", "We've built several projects on the Peninsula, including {n1} in {t1} and {n2} in {t2}: {url}"] };
function oxAreaOf(t) { for (var k in OX_AREA) if (OX_AREA[k].indexOf(t) > -1) return k; return ""; }
function oxWorkLine(town, seed) {
  var rot = function (l) { var i = Math.abs(oxPick(l.map(function (x, j) { return j; }), seed, "work")) % (l.length || 1); return l.slice(i).concat(l.slice(0, i)); };
  var same = rot(OX_WORK.filter(function (w) { return w[2] === town; })), area = oxAreaOf(town), near = rot(OX_WORK.filter(function (w) { return w[2] !== town && area && oxAreaOf(w[2]) === area; }));
  var pick = same.length >= 2 ? ["same", same[0], same[1]] : same.length ? ["one", same[0], same[0]] : near.length ? ["near", near[0], near[0]] : ["any", OX_WORK[0], rot(OX_WORK.filter(function (w) { return w[2] !== "Hillsborough"; }))[0]];
  return oxFill(oxPick(OX_WORK_SAY[pick[0]], seed, "worksay"), { town: town, n1: pick[1][1], n2: pick[2][1], t1: pick[1][2], t2: pick[2][2], url: OX_SITE + pick[1][0] }).replace(/^(.)/, function (c) { return c.toUpperCase(); });
}
/* The phrase bank: pieces written in Jesús's own voice (from his emails), combined differently on every "Rewrite".
   Always: greeting, blank line, one short paragraph with the street(s), one ask, the site walk. No sign-off (the signature
   goes under it). No API: the same firm + the same number always gives the same email, so nothing repeats by accident. */
var OX_BANK = {
  open: ["Hope you're doing well.", "Hope all is well.", "Hope your week's going well.", "Hope things are good on your end.", "", ""],
  known: ["Good to see your name on another one.", "Always good crossing paths with your team.", "Nice to see your team on another one around here.", ""],
  intro: ["We do the site work, hardscape and landscape on a lot of the homes around here.", "Blue Sierra does the site work, hardscape and landscape on projects like this around the Peninsula.", "", ""],
  one: ["I saw {A} {stage}.", "Noticed {A} {stage}.", "Saw that {A} {stage}.", "Looks like {A} {stage}.", "I see {A} {stage}."],
  two: ["I saw {A} {stage}, and {B} is moving too.", "Noticed {A} {stage}, and {B} looks like it's moving too.", "Saw that {A} {stage}, and {B} is coming up as well.", "Looks like {A} {stage}, and {B} is moving along too."],
  ask: ["Would love to bid {scope}{either} when you're ready.", "We'd love a shot at {scope}{either} when it goes out to bid.", "If you're putting together a bid list for {scope}, we'd love to be on it.", "Would be great to get on the bid list for {scope}{either}.", "Let me know if we can bid {scope}{either}."],
  close: ["Happy to walk the site or give early numbers if that helps.", "Happy to walk the site anytime or put early numbers together.", "Glad to walk the site or get you early numbers whenever it's useful.", "I can walk the site this week if that helps.", "Happy to walk the site with you or send over early numbers."],
  follow: ["Just following up on {addrA}.", "Checking back in on {addrA}.", "Wanted to circle back on {addrA}.", "Following up on my note about {addrA}."],
  followAsk: ["If the bid list for {scope} is coming together, we'd love to be on it.", "Would love to be considered when it goes out to bid.", "Still very interested in bidding {scope}.", "Let me know if there's a spot for us on the bid list."],
  inbox: ["Who is coordinating bids for the exterior site work at {A}, and is there still time for Blue Sierra to be considered?", "Could you point me to whoever is putting together the bid list for the exterior site work at {A}? We'd love to be considered if there's still time.", "Who's the right person to talk to about bidding the exterior site work at {A}? We'd love to be considered if it isn't too late."],
  pitch: ["We do the site work, hardscape and landscape on a lot of the homes around here.", "Blue Sierra builds the site work, hardscape and landscape on custom homes around the Peninsula."],
  thanksinv: ["Thanks for including us on {A}.", "Thanks for thinking of us for {A}.", "Glad to be bidding {A} with you."],
  poolq: ["The permit mentions a pool: is the hardscape around it part of this package too?", "Since the permit includes a pool, is the hardscape around it being bid as well?"],
  thanks: ["Thanks for the time on the phone about {A}.", "Thanks for pointing me in the right direction on {A}.", "Good talking with your team about {A}."],
  plans: ["Could you send the plan set for {scope} when it's ready, along with the bid date?", "When the plans for {scope} are ready, could you send them over with the bid date?", "Whenever the plan set for {scope} is out, we'd love a copy and the bid date."],
  again: ["Saw your team is on {A2} too.", "Noticed {A} {stage}, and your team is on it.", "Another one I saw: {A} {stage}.", "Looks like your team has {A2} as well."]
};
function oxPick(list, seed, salt) { var h = 2166136261, str = String(seed) + "|" + salt; for (var i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; } h ^= h >>> 16; h = Math.imul(h, 0x85ebca6b) >>> 0; h ^= h >>> 13; h = Math.imul(h, 0xc2b2ae35) >>> 0; h = (h ^ (h >>> 16)) >>> 0; return list[h % list.length]; }
function oxFill(t, v) { return String(t).replace(/\{(\w+)\}/g, function (m, k) { return v[k] != null ? v[k] : ""; }); }
function oxCompose(step, v, seed) {
  var pk = function (k) { return oxPick(OX_BANK[k], seed, k); }, hi = v.first ? (v.familiar && oxPick([0, 1, 1], seed, "hey") ? "Hey " : "Hi ") + v.first + "," : "Hi there,", parts = [];
  var wk = "";
  if (step === "ask") { wk = v.work ? oxWorkLine(v.town, seed) : ""; parts = [pk("open"), pk("inbox"), v.pool ? pk("poolq") : "", wk ? "" : pk("pitch"), pk("close")]; }
  else if (step === "reply") parts = [pk("thanks"), pk("plans"), v.pool ? pk("poolq") : "", pk("close")];          // after a conversation: ask for the plans
  else if (step === "invited") parts = [pk("thanksinv"), oxNeedLine(v.need || [], seed), v.pool ? pk("poolq") : "", pk("close")];             // a general inbox: one practical question
  else if (step === "day14") parts = [oxPick(OX_BANK.open.slice(0, 4).concat(["", "", "", ""]), seed, "o14"), pk("follow"), pk("followAsk"), pk("close")];
  else if (step === "again") parts = [pk("open"), pk("again"), oxFill(pk("ask"), { scope: v.scope, either: "" }), pk("close")];
  else { wk = v.work ? oxWorkLine(v.town, seed) : "";                                 // new firms: a few real projects from our portfolio, with a link (its own short paragraph)
    parts = [pk("open"), v.familiar ? pk("known") : v.cold && !wk ? pk("intro") : "", v.b ? pk("two") : pk("one"), pk("ask"), pk("close")]; }
  var text = parts.filter(Boolean).map(function (x) { return oxFill(x, v); }).join(" ").replace(/\s+/g, " ").trim();
  return hi + "\n\n" + text + (wk ? "\n\n" + wk : "");
}
ACTIONS.oxDraft = function (me, b) {
  oxNeed(me); var f = findBy("OxFirms", "id", String(b.firm_id || "")); if (!f) throw new Error("Firm not found.");
  var ct = b.contact_id ? findBy("OxContacts", "id", String(b.contact_id)) : null, ask = b.step === "ask", reply = b.step === "reply", invited = b.step === "invited", step = reply || invited ? "again" : b.step === "day14" || b.step === "again" ? b.step : "day0";
  if (ct && ct.firm_id !== f.id) ct = null;
  if (!ct) ct = oxBestContact(rows("OxContacts").filter(function (c) { return c.firm_id === f.id && c.email; }));
  var mine = rows("OxRoles").filter(function (x) { return x.firm_id === f.id; }).map(function (x) { return findBy("OxProjects", "id", x.project_id); }).filter(Boolean);
  var hold = oxHoldOf(f); if (!b.project_id && hold) { var freeL = mine.filter(function (x) { return hold.held.indexOf(x.id) < 0; }); if (freeL.length) mine = freeL; }
  var p = b.project_id ? findBy("OxProjects", "id", String(b.project_id)) : mine.sort(function (a, c) { return ("ABC".indexOf(a.priority) - "ABC".indexOf(c.priority)) || (a.date < c.date ? 1 : -1); })[0];
  if (!p) throw new Error("This firm has no project on the list to mention.");
  var first = ct && ct.name ? oxNorm(ct.name).split(" ")[0] : "", hi = first ? "Hi " + oxTitle(first) + "," : "Hi there,", where = oxStreetFull(p) + ", " + p.town;
  var q = step === "day0" && !ask && !reply && !b.single ? mine.filter(function (x) { return x.id !== p.id && x.stage !== "5" && oxStreetFull(x) !== oxStreetFull(p) && !(hold && hold.held.indexOf(x.id) > -1); })
    .sort(function (x, y) { return (Number(y.fit) || 0) - (Number(x.fit) || 0) || ("ABC".indexOf(x.priority) - "ABC".indexOf(y.priority)) || (x.date < y.date ? 1 : -1); })[0] : null;
  var firstSent = rows("OxOutbox").filter(function (m) { return m.firm_id === f.id && m.status === "sent" && m.step === "day0"; }).slice(-1)[0];
  // "Re:" and replies only follow the conversation about THIS project with THIS person (an estimator can have several jobs with us)
  var mail = ct && ct.email ? normEmail(ct.email) : "", conv = rows("OxOutbox").filter(function (m) { return m.firm_id === f.id && m.status === "sent" && m.project_id === p.id && (!ct || normEmail(m.to) === mail || m.contact_id === ct.id); });
  var prev = conv.slice(-1)[0] || null;
  var subject = step === "day14" && prev ? (/^re:/i.test(prev.subject) ? prev.subject : "Re: " + prev.subject) : oxStreetName(p) + (q ? " / " + oxStreetName(q) : "");
  var v = { town: p.town, work: f.segment !== "warm", first: first ? oxTitle(first) : "", familiar: f.segment === "warm" || f.segment === "known", cold: !f.segment || f.segment === "cold",
    A: oxStreetFull(p) + " in " + p.town, A2: oxStreetFull(p) + " in " + p.town, stage: oxStagePhrase(p), B: q ? oxStreetFull(q) + (q.town === p.town ? "" : " in " + q.town) : "", b: !!q,
    addrA: oxStreetFull(p), scope: oxScope(p), either: q ? " on either one" : "", pool: /\bpools?\b|\bspa\b/i.test(String(p.description || "") + " " + String(p.other_types || "")) };
  var opp = invited ? (b.opp_id ? findBy("OxOpps", "id", String(b.opp_id)) : rows("OxOpps").filter(function (o) { return o.project_id === p.id && o.firm_id === f.id && ["won", "lost"].indexOf(o.stage) < 0; })[0]) : null;
  if (invited) { v.need = [!opp || !opp.plans_url ? "plans" : "", !opp || !opp.due ? "due" : "", !opp || !opp.scope ? "scope" : ""].filter(Boolean); v.oscope = opp && opp.scope ? opp.scope : ""; }
  var avoid = [].concat(b.avoid || []).map(String), n = Math.abs(Math.floor(Number(b.n) || 0)), body = "", k = 0;
  var re = function (fresh) { return prev ? (/^re:/i.test(prev.subject) ? prev.subject : "Re: " + prev.subject) : fresh; };
  if (ask) { v.first = ct && ct.name && !OX_GENERIC.test(String(ct.email || "").split("@")[0]) ? v.first : ""; subject = re(oxStreetName(p) + " bid list"); }
  if (reply) subject = re(oxStreetName(p) + " plans");
  if (invited) subject = re(oxStreetName(p) + (v.oscope ? " " + v.oscope : "") + " bid");
  var kind = ask ? "ask" : reply ? "reply" : invited ? "invited" : step === "day14" && !prev ? "again" : step;   // a follow-up with no earlier note about THIS project reads as a new note
  do { body = oxCompose(kind, v, f.id + "|" + (n + k)); k++; } while (avoid.indexOf(body) > -1 && k < 60);
  if (ask && firstSent) step = "again";                                                  // already emailed: the question goes as a new note, not a second "first email"
  var sendOn = oxToday(), sentToday = rows("OxOutbox").filter(function (m) { return m.status === "sent" && m.step === "day0" && String(m.sent_at).slice(0, 10) === sendOn; }).length;
  return { send_on: sendOn, can_send_today: step !== "day0" || sentToday < OX_DAILY, best_day: oxNewEmailDay(sendOn), holiday: oxBlackout(sendOn), ask: ask, subject: subject, body: body, n: n + k - 1, versions: 999, to: ct ? ct.email : "", contact_id: ct ? ct.id : "", project_id: p.id, project: where, firm: f.name, to_name: ct ? ct.name || "" : "", opp_id: opp ? opp.id : "",
    history: conv.slice(-4).reverse().map(function (m) { return { date: String(m.sent_at).slice(0, 10), subject: m.subject, to: m.to, step: m.step }; }).concat(rows("OxTouches").filter(function (t) { return t.firm_id === f.id && t.project_id === p.id && t.channel !== "email"; }).slice(-4).reverse().map(function (t) { return { date: t.date, subject: t.summary, to: "", step: t.channel }; })), also: q ? { id: q.id, street: oxStreetFull(q), town: q.town } : null, step: step, notes: f.notes || "", flags: oxFlags(f), waiting: hold && hold.held.indexOf(p.id) > -1 ? hold.waiting_on : null };
};
NO_LOCK.oxDraft = 1;

/* ====================================== AI writer (Claude) ======================================
   "Write email" and "New version" ask Claude for a fresh draft built only from the facts below (firm, first name,
   street + town, project type). Owners are never sent. The key lives in a Script Property (ANTHROPIC_KEY) and never
   reaches the browser. Without a key, or if the call fails, the hand-written versions above are used instead. */
var OX_AI = { url: "https://api.anthropic.com/v1/messages", model: "claude-opus-5-5", version: "2026-10-21", perHour: 60 };
var OX_ANGLES = ["Open with the project address.", "Open with what Blue Sierra does on projects like this.", "Keep it to two short sentences plus the site-walk line.", "Open with a short question about who handles bids.", "Mention the type of project first, then the address.", "Lead with the offer to walk the site."];
function aiKey() { return PropertiesService.getScriptProperties().getProperty("ANTHROPIC_KEY") || ""; }
function oxAiSystem() {
  return [
    "You write short outreach emails for Jesús Toto, owner of Blue Sierra Construction, a site work, hardscape and landscape contractor on the San Francisco Peninsula.",
    "Each email goes from his Gmail to a design or building firm named on a public permit or design-review agenda. The goal: get Blue Sierra on the bid list for the project(s).",
    "",
    "It must read like a quick personal note he typed himself, never like a marketing email. This is the tone to match:",
    "\"Hi Michael,\\n\\nHope you're doing well. I saw 32 Encina Avenue in Atherton just had landscape permits filed, and 2555 Summit Drive in Hillsborough is moving too. Would love to bid the landscape on either one when you're ready. Happy to walk the site or give early numbers if that helps.\"",
    "",
    "Rules:",
    "- First line: \"Hi <first name>,\" (or \"Hi there,\" with no name). Then a blank line, then ONE paragraph of 2 to 4 sentences.",
    "- Name each project by its street and town as given, with the stage phrase given (for example \"just had landscape permits filed\"). If two projects are given, mention both in one sentence.",
    "- One ask: to bid the scope given (or to be on the bid list). Offer to walk the site or give early numbers.",
    "- No sign-off and no name at the end: his signature is added automatically.",
    "- Plain, warm, direct. No flattery, no \"I hope this email finds you well\", no \"reach out\", \"leverage\", \"excited\", \"delighted\", \"partner\", \"synergy\", \"touch base\". No em dashes or en dashes, no exclamation marks, no emojis, no bullets, no links.",
    "- Use only the facts given. Do not claim past work together, awards, years in business or licenses. Never mention the property owner.",
    "",
    "Subject: the street names only, like \"Encina Ave / Summit Dr\" (use the suggested subject unless you have a better plain one). For a follow-up, keep the subject you are given unchanged.",
    "Each request may list versions already shown. Write one that is clearly different in its opening and wording."
  ].join("\n");
}
function oxAiCall(facts, avoid, angle) {
  var key = aiKey(); if (!key) return null;
  var c = CacheService.getScriptCache(), hk = "oxai:" + Utilities.formatDate(new Date(), "UTC", "yyyyMMddHH"), used = Number(c.get(hk) || 0);
  if (used >= OX_AI.perHour) throw new Error("The AI writer did " + OX_AI.perHour + " drafts this hour. Using a saved version for now.");
  c.put(hk, String(used + 1), 3700);
  var user = "Facts:\n" + JSON.stringify(facts, null, 1) + "\n\nAngle for this version: " + angle + (avoid.length ? "\n\nVersions already shown (write something clearly different):\n" + avoid.map(function (x, i) { return "--- " + (i + 1) + " ---\n" + x; }).join("\n") : "");
  var payload = { model: OX_AI.model, max_tokens: 16000, system: oxAiSystem(), messages: [{ role: "user", content: user }],
    output_config: { effort: "low", format: { type: "json_schema", schema: { type: "object", properties: { subject: { type: "string" }, body: { type: "string" } }, required: ["subject", "body"], additionalProperties: false } } },
    fallbacks: "default" };
  var go = function (pl, beta) {
    var h = { "x-api-key": key, "anthropic-version": OX_AI.version }; if (beta) h["anthropic-beta"] = beta;
    var r = UrlFetchApp.fetch(OX_AI.url, { method: "post", contentType: "application/json", payload: JSON.stringify(pl), headers: h, muteHttpExceptions: true }), j = null;
    try { j = JSON.parse(r.getContentText()); } catch (e) {}
    return { code: r.getResponseCode(), j: j };
  };
  var r = go(payload, "server-side-fallback-2026-07-01");
  if (r.code === 400 && /fallback/i.test(JSON.stringify(r.j || ""))) { delete payload.fallbacks; r = go(payload, ""); }   // the account can't use fallbacks: plain request
  if (r.code === 401 || r.code === 403) throw new Error("The AI key was rejected. Reconnect it in Import & tools.");
  if (r.code === 429 || r.code === 529) throw new Error("The AI writer is busy. Using a saved version for now.");
  if (r.code >= 300 || !r.j) throw new Error("The AI writer didn't answer (" + r.code + "). Using a saved version.");
  if (r.j.stop_reason === "refusal") throw new Error("The AI writer declined this one. Using a saved version.");
  var txt = (r.j.content || []).filter(function (x) { return x.type === "text"; }).map(function (x) { return x.text; }).join("");
  var out = null; try { out = JSON.parse(txt); } catch (e) { throw new Error("The AI draft came back incomplete. Using a saved version."); }
  return out;
}
function oxAiTidy(t) {
  var lines = String(t || "").replace(/\r/g, "").replace(/\s*[—–]\s*/g, ", ").replace(/!/g, ".").split("\n").map(function (x) { return x.trim(); });
  while (lines.length && !lines[lines.length - 1]) lines.pop();
  while (lines.length > 1 && /^(best|thanks|thank you|cheers|regards|best regards|sincerely|talk soon)[,.]?$|^jes[uú]s|^blue sierra/i.test(lines[lines.length - 1])) { lines.pop(); while (lines.length && !lines[lines.length - 1]) lines.pop(); }
  var paras = lines.join("\n").split(/\n\s*\n/).map(function (x) { return x.split("\n").map(function (y) { return y.trim(); }).filter(Boolean).join(" "); }).filter(Boolean);
  var m = paras.length && paras[0].match(/^((?:hi|hello|hey)\s[^,]{1,40},)\s+(.+)$/i); if (m) paras.splice(0, 1, m[1], m[2]);
  return paras.join("\n\n").slice(0, 900);
}
ACTIONS.oxAiDraft = function (me, b) {
  var base = ACTIONS.oxDraft(me, b);                                           // checks access, picks contact + project, and is the fallback
  if (!aiKey()) return Object.assign(base, { ai: false });
  var f = findBy("OxFirms", "id", String(b.firm_id || "")), p = findBy("OxProjects", "id", base.project_id), ct = base.contact_id ? findBy("OxContacts", "id", base.contact_id) : null;
  var first = ct && ct.name ? oxTitle(oxNorm(ct.name).split(" ")[0]) : "";
  var facts = { email_kind: { day0: "first email", day14: "follow-up 14 days after the first email (no reply yet)", again: "first email about a NEW project; we've written this firm before about another one" }[base.step],
    recipient_first_name: first || null, recipient_role: ct && ct.role && ct.role !== "General inbox" ? ct.role : null, firm: f.name, firm_type: f.firm_type || null,
    projects: [{ street: oxStreetFull(p), town: p.town, stage_phrase: oxStagePhrase(p) }].concat(base.also ? [(function (q) { return { street: oxStreetFull(q), town: q.town, stage_phrase: oxStagePhrase(q) }; })(findBy("OxProjects", "id", base.also.id))] : []),
    scope_to_bid: oxScope(p), suggested_subject: base.subject,
    blue_sierra_does: "site work (grading, drainage, utilities), hardscape and landscape", subject_to_keep: base.step === "day14" ? base.subject : null };
  var avoid = [].concat(b.avoid || []).map(function (x) { return clean(x, 900); }).filter(Boolean).slice(-4);
  var n = Math.abs(Math.floor(Number(b.n) || 0)), angle = OX_ANGLES[n % OX_ANGLES.length];
  try {
    var r = oxAiCall(facts, avoid, angle); if (!r || !r.body) return Object.assign(base, { ai: false });
    var body = oxAiTidy(r.body), subject = base.step === "day14" ? base.subject : clean(r.subject, 80).replace(/[—–]/g, "-");
    if (body.length < 40) return Object.assign(base, { ai: false, ai_err: "The AI draft was too short. Using a saved version." });
    return Object.assign(base, { subject: subject || base.subject, body: body, ai: true });
  } catch (e) { return Object.assign(base, { ai: false, ai_err: String(e.message || e) }); }
};
NO_LOCK.oxAiDraft = 1;
ACTIONS.oxAiSave = function (me, b) {
  if (me.role !== "admin" || me.preview) throw new Error("Only Jesús connects the AI writer."); var pr = PropertiesService.getScriptProperties();
  if (b.off) { pr.deleteProperty("ANTHROPIC_KEY"); return { ai: { on: false } }; }
  var key = String(b.key || "").trim(); if (!/^sk-ant-[A-Za-z0-9_-]{20,300}$/.test(key)) throw new Error("Paste an API key from console.anthropic.com → API keys (it starts with sk-ant-).");
  var r = UrlFetchApp.fetch("https://api.anthropic.com/v1/models/" + OX_AI.model, { method: "get", headers: { "x-api-key": key, "anthropic-version": OX_AI.version }, muteHttpExceptions: true });
  if (r.getResponseCode() === 401 || r.getResponseCode() === 403) throw new Error("Anthropic rejected that key. Check it and paste it again.");
  if (r.getResponseCode() >= 300) throw new Error("Couldn't check the key right now (" + r.getResponseCode() + "). Try again in a minute.");
  pr.setProperty("ANTHROPIC_KEY", key); return { ai: { on: true } };
};
ACTIONS.oxSend = function (me, b) {
  oxAdmin(me); var key = String(b.key || ""); if (!/^[A-Za-z0-9_-]{8,80}$/.test(key)) throw new Error("Reload the portal and try again (missing send key).");
  var done = findBy("OxOutbox", "key", key); if (done && done.status === "sent") return { status: "sent", again: true };
  if (done && done.status === "draft") done.status = "pending";                       // a draft saved earlier is now going out
  var f = findBy("OxFirms", "id", String(b.firm_id || "")); if (!f) throw new Error("Firm not found.");
  var fl = oxFlags(f), step = b.step === "day14" || b.step === "again" ? b.step : "day0", today = oxToday();
  if (fl.excluded) throw new Error(f.name + " is excluded from outreach.");
  if (fl.individual) throw new Error("First confirm " + f.name + " is a designer or engineer, not the owner.");
  if (oxBlackout(today) && !b.anyday) throw new Error("HOLIDAY: It's a holiday week (Nov 25-27 or Dec 24 - Jan 1). Send anyway?");
  var to = normEmail(b.to); if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(to)) throw new Error("Check the email address.");
  var ct = b.contact_id ? findBy("OxContacts", "id", String(b.contact_id)) : null; if (ct && ct.firm_id !== f.id) throw new Error("That contact belongs to another firm.");
  var subject = clean(b.subject, 160), text = clean(b.body, 3000); if (!subject || !text) throw new Error("Write a subject and a message.");
  var touches = rows("OxTouches").filter(function (x) { return x.firm_id === f.id; }), s = oxState(f, touches, today);
  if (step === "day0") {
    if (s.emailed) throw new Error("This firm already got its first email (" + s.day0 + "). Use the follow-up.");
    // any day works now: Tuesday to Thursday is only shown as a tip
    var block = oxHoldOf(f);
    if (block && (block.all || block.held.indexOf(String(b.project_id || "")) > -1) && !b.override) throw new Error("Wait: the warm contact on this project goes first (" + block.waiting_on.join(", ") + ").");
    var sentToday = rows("OxOutbox").filter(function (m) { return m.status === "sent" && m.step === "day0" && String(m.sent_at).slice(0, 10) === today; }).length;
    if (sentToday >= OX_DAILY) throw new Error("That's today's " + OX_DAILY + " new emails. More on the next sending day.");
  } else if (step === "day14" && s.replied) throw new Error(f.name + " already replied: no follow-up needed.");
  var ob = done || { id: newId("ob"), key: key, firm_id: f.id, contact_id: ct ? ct.id : "", project_id: String(b.project_id || ""), step: step, to: to, subject: subject, body: text, status: "pending", msg_id: "", thread_id: "", error: "", created_by: me.email, created_at: oxStamp(), sent_at: "" };
  if (!done) insert("OxOutbox", ob);                                    // recorded first: a crash leaves "pending", never a silent send
  try {
    var sig = oxSig(), msg = GmailApp.createDraft(to, subject, text + (sig ? "\n\n" + oxSigText(sig) : ""), { name: me.name || CONFIG.COMPANY, htmlBody: oxMailHtml(text, sig), from: fromAddress() || undefined }).send();
    var mid = msg && msg.getId ? msg.getId() : "", tid = msg && msg.getThread ? msg.getThread().getId() : "";
    update("OxOutbox", "id", ob.id, { status: "sent", msg_id: mid, thread_id: tid, sent_at: oxStamp(), error: "", to: to, subject: subject, body: text, step: step, contact_id: ct ? ct.id : "", project_id: String(b.project_id || "") });
    insert("OxTouches", { id: newId("ot"), firm_id: f.id, contact_id: ct ? ct.id : "", project_id: String(b.project_id || ""), date: today, channel: "email", step: step, summary: subject, outcome: "sent", by: me.email, at: now(), outbox_id: ob.id, thread_id: tid });
    if (!f.status || f.status === "") update("OxFirms", "id", f.id, { status: "active", updated_at: now() });
    if (b.alert_id) update("OxAlerts", "id", String(b.alert_id), { status: "done", done_at: now() });
    return { status: "sent", to: to };
  } catch (e) { update("OxOutbox", "id", ob.id, { status: "failed", error: String(e.message || e).slice(0, 300) }); throw new Error("Gmail didn't send it: " + String(e.message || e)); }
};
/* The email as Gmail itself writes it: no forced font or size, a <div> per line, then the signature block. */
function oxMailHtml(text, sig) {
  var link = function (h) { return h.replace(/https?:\/\/[^\s<]+[^\s<.,;:!?)]/g, function (u) { return '<a href="' + u + '">' + u.replace(/^https?:\/\/(www\.)?/, "") + "</a>"; }); };
  var paras = String(text || "").replace(/\r/g, "").split(/\n\s*\n/).map(function (p) { return "<div>" + link(esc(p.trim())).replace(/\n/g, "<br>") + "</div>"; });
  return '<div dir="ltr">' + paras.join("<div><br></div>") + (sig ? '<div><br></div><div><br></div><div dir="ltr" class="gmail_signature" data-smartmail="gmail_signature">' + oxSigHtml(sig) + "</div>" : "") + "</div>";
}
/* Jesús's signature (Import & tools → Email signature). Stored on the server, not in the code. */
var OX_SIG_F = ["name", "title", "company", "email", "phone", "fax", "cell", "website"];
function oxSig() { try { var j = JSON.parse(PropertiesService.getScriptProperties().getProperty("OX_SIG") || "null"); return j && j.name ? j : null; } catch (e) { return null; } }
function oxSigHtml(g) {
  var gray = "color:#808080", red = "color:#c0504d", web = String(g.website || ""), href = /^https?:/i.test(web) ? web : "https://" + web, out = [];
  out.push('<b style="' + gray + '">' + esc(g.name) + "</b>");
  if (g.title) out.push('<i style="' + red + '">' + esc(g.title) + "</i>");
  if (g.company) out.push('<span style="' + gray + '">' + esc(g.company) + "</span>");
  if (g.email) out.push('<a href="mailto:' + esc(g.email) + '">' + esc(g.email) + "</a>");
  [["P", g.phone], ["F", g.fax], ["C", g.cell]].forEach(function (x) { if (x[1]) out.push('<span style="' + red + '">' + x[0] + '</span> <span style="' + gray + '">' + esc(x[1]) + "</span>"); });
  if (web) out.push('<a href="' + esc(href) + '">' + esc(web.replace(/^https?:\/\//i, "")) + "</a>");
  return '<div style="font-family:Verdana,Geneva,sans-serif">' + out.join("<br>") + "</div>";
}
function oxSigText(g) { return [g.name, g.title, g.company, g.email, g.phone ? "P " + g.phone : "", g.fax ? "F " + g.fax : "", g.cell ? "C " + g.cell : "", String(g.website || "").replace(/^https?:\/\//i, "")].filter(Boolean).join("\n"); }
ACTIONS.oxSigSave = function (me, b) {
  oxAdmin(me); var x = b.sig || {}, g = {};
  OX_SIG_F.forEach(function (k) { g[k] = clean(x[k], 120); });
  if (!g.name) throw new Error("Write your name.");
  if (g.email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(g.email)) throw new Error("Check the email.");
  PropertiesService.getScriptProperties().setProperty("OX_SIG", JSON.stringify(g)); return { sig: g };
};
function oxHoldOf(f) {
  var today = oxToday(), firms = rows("OxFirms"), touches = rows("OxTouches"), st = {};
  firms.forEach(function (x) { st[x.id] = oxState(x, touches.filter(function (t) { return t.firm_id === x.id; }), today); });
  return oxBlocks(firms, rows("OxRoles"), st, today)[f.id] || null;
}
/* Replies: anything from that firm's people in Jesús's inbox after the first email stops the cadence. */
function oxCheckReplies(me, force) {
  var c = CacheService.getScriptCache(); if (!force && c.get("oxreplies")) return 0; c.put("oxreplies", "1", 1200);
  var firms = rows("OxFirms"), contacts = rows("OxContacts"), touches = rows("OxTouches"), today = oxToday(), want = {};
  firms.forEach(function (f) { var s = oxState(f, touches.filter(function (x) { return x.firm_id === f.id; }), today); if (s.emailed && !s.replied) contacts.filter(function (x) { return x.firm_id === f.id && x.email; }).forEach(function (x) { want[x.email] = { firm: f, since: s.day0 }; }); });
  var addrs = Object.keys(want), found = 0;
  for (var i = 0; i < addrs.length; i += 15) {
    var part = addrs.slice(i, i + 15), threads = [];
    try { threads = GmailApp.search("from:(" + part.join(" OR ") + ") newer_than:60d", 0, 50); } catch (e) { break; }
    threads.forEach(function (th) {
      th.getMessages().forEach(function (m) {
        var from = normEmail((String(m.getFrom()).match(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/) || [""])[0]), w = want[from]; if (!w) return;
        var d = Utilities.formatDate(m.getDate(), CONFIG.TZ, "yyyy-MM-dd"); if (d < w.since || w.done) return; w.done = 1; found++;
        insert("OxTouches", { id: newId("ot"), firm_id: w.firm.id, contact_id: "", project_id: "", date: d, channel: "reply", step: "", summary: "Replied: " + clean(m.getSubject(), 120), outcome: "replied", by: me.email, at: now(), outbox_id: "", thread_id: th.getId() });
        update("OxFirms", "id", w.firm.id, { status: "replied", updated_at: now() });
      });
    });
  }
  return found;
}
ACTIONS.oxCheckReplies = function (me, b) { oxNeed(me); return { found: oxCheckReplies(me, !!(b && b.force)) }; };   // the portal calls it in the background; at most every 20 min unless forced

/* ====================================== touches, firms, contacts, bids ====================================== */
ACTIONS.oxTouch = function (me, b) {
  oxNeed(me); var f = findBy("OxFirms", "id", String(b.firm_id || "")); if (!f) throw new Error("Firm not found.");
  var ch = String(b.channel || ""); if (["linkedin", "call", "site_walk", "note", "reply", "email"].indexOf(ch) < 0) throw new Error("Pick what you did.");
  if (oxFlags(f).excluded && ["note", "reply"].indexOf(ch) < 0) throw new Error(f.name + " is excluded from outreach.");
  if (ch === "call" && oxFlags(f).noCall) throw new Error(f.name + " is on the do-not-call list.");
  var d = /^\d{4}-\d\d-\d\d$/.test(String(b.date || "")) ? b.date : oxToday();
  var t = { id: newId("ot"), firm_id: f.id, contact_id: clean(b.contact_id, 40), project_id: clean(b.project_id, 40), date: d, channel: ch, step: clean(b.step, 10), summary: clean(b.summary, 500), outcome: clean(b.outcome, 60), by: me.email, at: now(), outbox_id: "", thread_id: "" };
  insert("OxTouches", t);
  var patch = { updated_at: now() };
  if (ch === "reply" || t.outcome === "replied") patch.status = "replied";
  if (t.outcome === "not_interested") patch.status = "closed";
  if (b.next_step != null) patch.next_step = clean(b.next_step, 200); if (b.next_date != null) patch.next_date = clean(b.next_date, 10);
  update("OxFirms", "id", f.id, patch);
  return { touch: t };
};
ACTIONS.oxSaveFirm = function (me, b) {
  oxNeed(me); var x = b.firm || {}, f = x.id ? findBy("OxFirms", "id", String(x.id)) : null, t = now();
  var data = {}; ["name", "firm_type", "segment", "priority", "wave", "channel", "website", "phone", "notes", "status", "next_step", "next_date"].forEach(function (k) { if (x[k] != null) data[k] = clean(x[k], k === "notes" ? 2000 : 300); });
  if (data.segment && ["warm", "known", "cold", "excluded"].indexOf(data.segment) < 0) throw new Error("Unknown segment.");
  if (data.status && ["", "active", "paused", "replied", "closed", "removed"].indexOf(data.status) < 0) throw new Error("Unknown status.");
  if (x.confirmed != null) data.confirmed = x.confirmed ? "yes" : "";
  if (data.name) data.norm = oxNorm(data.name);
  if (f) { data.updated_at = t; update("OxFirms", "id", f.id, data); return { id: f.id }; }
  if (!data.name) throw new Error("Write the firm's name."); if (rows("OxFirms").some(function (y) { return y.norm === data.norm; })) throw new Error("That firm is already on the list.");
  var id = newId("of"); insert("OxFirms", Object.assign({ id: id, segment: "cold", created_at: t, updated_at: t }, data));
  if (x.project_id && x.role) insert("OxRoles", { id: newId("or"), project_id: clean(x.project_id, 40), firm_id: id, role: OX_ROLES.indexOf(x.role) > -1 ? x.role : "architect", raw: data.name, source: "manual" });
  return { id: id };
};
ACTIONS.oxLinkRole = function (me, b) {
  oxNeed(me); var r = findBy("OxRoles", "id", String(b.role_id || "")); if (!r) throw new Error("Not found."); if (r.role === "owner") throw new Error("Owners are never linked to outreach.");
  if (b.firm_id && !findBy("OxFirms", "id", String(b.firm_id))) throw new Error("Firm not found.");
  update("OxRoles", "id", r.id, { firm_id: clean(b.firm_id, 40), source: "manual" }); return {};
};
ACTIONS.oxSaveContact = function (me, b) {
  oxNeed(me); var x = b.contact || {}, t = now(), ct = x.id ? findBy("OxContacts", "id", String(x.id)) : null;
  var f = findBy("OxFirms", "id", String(x.firm_id || (ct && ct.firm_id) || "")); if (!f) throw new Error("Firm not found.");
  var data = { firm_id: f.id }; ["name", "role", "phone", "linkedin"].forEach(function (k) { if (x[k] != null) data[k] = clean(x[k], 300); });
  if (x.email != null) { data.email = normEmail(x.email); if (data.email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(data.email)) throw new Error("Check the email."); }
  if (x.verified != null) data.verified = x.verified ? "yes" : "no";
  if (ct) { data.updated_at = t; update("OxContacts", "id", ct.id, data); return { id: ct.id }; }
  var id = newId("oc"); insert("OxContacts", Object.assign({ id: id, source: "manual", verified: "no", rr_id: "", created_at: t, updated_at: t }, data)); return { id: id };
};
/* Delete a project (a duplicate, or one that isn't ours). Its permit links and alerts go; firms, people and the history stay. */
ACTIONS.oxDeleteProject = function (me, b) {
  oxNeed(me); var id = String(b.id || ""), p = findBy("OxProjects", "id", id); if (!p) throw new Error("Project not found.");
  if (rows("OxOpps").some(function (o) { return o.project_id === id; })) throw new Error("This project has a bid in Bids. Move or delete the bid first.");
  rows("OxTouches").filter(function (t) { return t.project_id === id; }).forEach(function (t) { update("OxTouches", "id", t.id, { project_id: "" }); });
  removeWhere("OxRoles", function (x) { return x.project_id === id; });
  removeWhere("OxAlerts", function (x) { return x.project_id === id; });
  removeWhere("OxProjects", function (x) { return x.id === id; });
  return { deleted: id };
};
ACTIONS.oxDeleteContact = function (me, b) { oxNeed(me); removeWhere("OxContacts", function (c) { return c.id === String(b.id || ""); }); return {}; };
ACTIONS.oxSaveOpp = function (me, b) {
  oxNeed(me); var x = b.opp || {}, t = now(), o = x.id ? findBy("OxOpps", "id", String(x.id)) : null;
  var data = {}; if (x.stage != null) { if (OX_STAGES.indexOf(x.stage) < 0) throw new Error("Unknown stage."); data.stage = x.stage; }
  ["amount", "due", "notes", "scope", "contact_id", "plans_url", "next_step", "next_date", "lost_note"].forEach(function (k) { if (x[k] != null) data[k] = clean(x[k], k === "notes" || k === "plans_url" ? 1000 : k === "next_step" || k === "lost_note" ? 300 : 60); });
  if (data.plans_url && !/^https?:\/\//i.test(data.plans_url)) throw new Error("The plans link should start with https://");
  if (x.assignee != null) { var asg = x.assignee ? findPerson(normEmail(x.assignee)) : null; if (x.assignee && (!asg || !isStaff(asg))) throw new Error("Pick someone on the Blue Sierra team."); data.assignee = asg ? asg.email : ""; }
  if (o) { data.updated_at = t; update("OxOpps", "id", o.id, data); return { id: o.id }; }
  var f = findBy("OxFirms", "id", String(x.firm_id || "")); if (!f) throw new Error("Pick the firm that invited us.");
  if (x.project_id && !rows("OxRoles").some(function (r) { return r.project_id === String(x.project_id) && r.firm_id === f.id; }))   // a buyer on this property is "on it"
    insert("OxRoles", { id: newId("or"), project_id: clean(x.project_id, 40), firm_id: f.id, role: "contractor", raw: f.name, source: "bid" });
  var id = newId("oo"), st0 = data.stage || "invited"; insert("OxOpps", Object.assign({ id: id, firm_id: f.id, project_id: clean(x.project_id, 40), stage: st0, created_by: me.email, created_at: t, updated_at: t }, data));
  insert("OxTouches", { id: newId("ot"), firm_id: f.id, contact_id: data.contact_id || "", project_id: clean(x.project_id, 40), date: oxToday(), channel: "note", step: "", summary: st0 === "prospect" ? "Collecting bids" + (data.scope ? " (" + data.scope + ")" : "") : "Invited to bid" + (data.scope ? " (" + data.scope + ")" : ""), outcome: st0 === "prospect" ? "open" : "invited", by: me.email, at: t, outbox_id: "", thread_id: "" });
  if (f.status !== "replied") update("OxFirms", "id", f.id, { status: "replied", updated_at: t });
  return { id: id };
};
ACTIONS.oxAlert = function (me, b) { oxNeed(me); update("OxAlerts", "id", String(b.id || ""), { status: "dismissed", done_at: now() }); return {}; };

/* ====================================== RocketReach ====================================== */
var RR_API = "https://api.rocketreach.co/api/v2";
function rrKey() { return PropertiesService.getScriptProperties().getProperty("RR_KEY") || ""; }
function rrCall(method, path, body, key) {
  var o = { method: method, muteHttpExceptions: true, headers: { "Api-Key": key || rrKey() } };
  if (body) { o.contentType = "application/json"; o.payload = JSON.stringify(body); }
  var r = UrlFetchApp.fetch(RR_API + path, o), code = r.getResponseCode(), j = null; try { j = JSON.parse(r.getContentText()); } catch (e) {}
  if (code === 402 || code === 403) throw new Error("RocketReach: no lookup credits left (or the key can't do this).");
  if (code === 401) throw new Error("RocketReach: the API key is missing or wrong.");
  if (code === 429) throw new Error("RocketReach is rate-limiting us. Try again in a minute.");
  if (code >= 300) throw new Error("RocketReach said: " + ((j && (j.detail || j.message)) || code));
  return j;
}
function oxRrInfo() {
  if (!rrKey()) return { on: false };
  var c = CacheService.getScriptCache(), raw = c.get("rr:acct"); if (raw) return JSON.parse(raw);
  var out = { on: true };
  try { var a = rrCall("get", "/account/"), lk = (a.credit_usage || []).filter(function (x) { return /lookup|export|person/i.test(x.credit_type || ""); })[0] || (a.credit_usage || [])[0];
    if (lk) { out.credits = lk.remaining; out.credit_type = lk.credit_type; } } catch (e) { out.err = e.message; }
  c.put("rr:acct", JSON.stringify(out), 600); return out;
}
ACTIONS.oxRrSave = function (me, b) {
  if (me.role !== "admin" || me.preview) throw new Error("Only Jesús connects RocketReach."); var pr = PropertiesService.getScriptProperties();
  if (b.off) { pr.deleteProperty("RR_KEY"); CacheService.getScriptCache().remove("rr:acct"); return { on: false }; }
  var key = String(b.key || "").trim(); if (!/^[A-Za-z0-9_.-]{16,200}$/.test(key)) throw new Error("Paste the API key from RocketReach (Account → API).");
  rrCall("get", "/account/", null, key);                                             // proves the key works
  pr.setProperty("RR_KEY", key); CacheService.getScriptCache().remove("rr:acct"); return { rr: oxRrInfo() };
};
/* Which firms a batch would look up, and what it costs: one lookup per firm (the best person there). */
function oxEnrichList(ids, goal) {
  var firms = rows("OxFirms").filter(function (f) { return ids.indexOf(f.id) > -1; }), contacts = rows("OxContacts"), log = rows("OxEnrich"), roles = rows("OxRoles");
  var pById = {}; rows("OxProjects").forEach(function (p) { pById[p.id] = p; });
  return firms.map(function (f) {
    var mine = roles.filter(function (x) { return x.firm_id === f.id && x.role !== "owner"; }).map(function (x) { return pById[x.project_id]; }).filter(function (p, i, a) { return p && a.indexOf(p) === i; });
    var top = mine.slice().sort(function (a, c) { return (Number(c.fit) || 0) - (Number(a.fit) || 0); })[0];
    var info = { type: f.firm_type || "", segment: f.segment || "", projects: mine.length, top: top ? oxStreetFull(top) + ", " + top.town : "", no_lookup: oxNoLookup(f) };
    var fl = oxFlags(f), why = info.no_lookup ? "not needed (you said so)" : goal === "calls" ? oxCallSkip(f, fl, contacts, log) : fl.excluded ? "excluded" : isTrue(f.individual) && !isTrue(f.confirmed) ? "individual (confirm first)" : contacts.some(function (c) { return c.firm_id === f.id && c.email && c.verified === "yes"; }) ? "already has a verified email" : oxHasRealEmail(f.id) ? "already has a real email (free)" : log.some(function (x) { return x.firm_id === f.id && x.status === "done"; }) ? "already looked up" : "";
    return Object.assign({ firm_id: f.id, name: f.name, skip: why, value: oxFirmValue(f) }, info);
  }).sort(function (a, b) { return (a.skip ? 1 : 0) - (b.skip ? 1 : 0) || b.value - a.value; });
}
/* Which firms deserve a paid lookup first: warm/known, early-stage projects with a high fit, more projects. */
function oxFirmValue(f) {
  var pids = {}; rows("OxRoles").forEach(function (x) { if (x.firm_id === f.id) pids[x.project_id] = 1; });
  var ps = rows("OxProjects").filter(function (p) { return pids[p.id] && p.stage !== "5"; }), best = 0;
  ps.forEach(function (p) { var v = (Number(p.fit) || { A: 80, B: 60, C: 40 }[p.priority] || 30) + ({ "1": 10, "2": 8, "3": 10, "4": 4 }[p.stage] || 0); if (v > best) best = v; });
  return best + Math.min(ps.length, 5) * 3 + ({ warm: 25, known: 15 }[f.segment] || 0);
}
function oxRrCredits() { CacheService.getScriptCache().remove("rr:acct"); var c = oxRrInfo().credits; return c === "inf" || c == null ? Infinity : Number(c); }
/* "Not needed": Jesús decides a firm never gets a paid lookup (it stays in Outreach; nothing else changes). */
function oxNoLookup(f) { return /\bno lookup\b/i.test(String(f.flags || "")); }
ACTIONS.oxNoLookup = function (me, b) {
  if (me.role !== "admin" || me.preview) throw new Error("Only Jesús decides where RocketReach credits go.");
  var f = findBy("OxFirms", "id", String(b.firm_id || "")); if (!f) throw new Error("Firm not found.");
  var rest = String(f.flags || "").split(/\s*;\s*/).filter(function (x) { return x && !/^no lookup$/i.test(x); });
  if (b.on) rest.push("no lookup");
  update("OxFirms", "id", f.id, { flags: rest.join("; "), updated_at: now() });
  return { no_lookup: !!b.on };
};
PREFETCH.oxNoLookup = OX_T.concat(["People"]);
ACTIONS.oxEnrichPlan = function (me, b) {
  oxNeed(me); var ids = [].concat(b.firm_ids || []).map(String);
  if (b.wave) ids = rows("OxFirms").filter(function (f) { return String(f.wave) === String(b.wave); }).map(function (f) { return f.id; });
  var left = oxRrCredits(), info = oxRrInfo(), l = oxEnrichList(ids, b.goal), go = l.filter(function (x) { return !x.skip; });
  if (!b.pick) go.forEach(function (x, i) { if (i >= left) x.skip = "not enough credits (best firms go first)"; });   // when Jesús picks by hand, he sees the credits and chooses
  go = l.filter(function (x) { return !x.skip; });
  return { list: l, lookups: go.length, rr: info };
};
ACTIONS.oxEnrich = function (me, b) {
  if (me.role !== "admin" || me.preview) throw new Error("Only Jesús spends RocketReach credits."); if (!b.confirm) throw new Error("Confirm the cost first.");
  if (!rrKey()) throw new Error("Connect RocketReach first.");
  var calls = b.goal === "calls", left = oxRrCredits(), go = oxEnrichList([].concat(b.firm_ids || []).map(String), b.goal).filter(function (x) { return !x.skip; }).slice(0, Math.min(12, left)), out = [], log = rows("OxEnrich");
  var TITLE = [/principal|partner|owner|founder|president/i, /project (architect|manager|lead)|associate/i, /estimat|bid|precon/i];
  go.forEach(function (x) {
    var f = findBy("OxFirms", "id", x.firm_id), res = { firm: f.name, found: "", status: "" };
    try {
      var dom = String(f.website || "").replace(/^https?:\/\//, "").replace(/^www\./, "").split("/")[0];
      var q = dom ? { company_domain: [dom] } : { employer: ["\"" + f.name.replace(/\s*\([^)]*\)/g, "") + "\""] };
      var saved = rows("OxContacts").filter(function (c) { return c.firm_id === f.id && c.rr_id && (calls ? !c.phone : !c.email); }).map(function (c) { return { id: c.rr_id, name: c.name, current_title: c.role, region: "CA" }; });
      var people = saved.length ? saved : (function () { var r0 = rrCall("post", "/person/search", { query: q, page_size: 10 }) || []; return Array.isArray(r0) ? r0 : r0.profiles || []; })();
      people = people.filter(function (p) { return !log.some(function (l) { return String(l.rr_id) === String(p.id) && l.status === "done"; }); });
      var score = function (p) { for (var i = 0; i < TITLE.length; i++) if (TITLE[i].test(p.current_title || "")) return i; return 9; };
      people.sort(function (a, c) { return score(a) - score(c) || (/california|\bca\b/i.test(c.region || c.location || "") ? 1 : 0) - (/california|\bca\b/i.test(a.region || a.location || "") ? 1 : 0); });
      var p = people[0];
      if (!p) { res.status = "nobody found"; insert("OxEnrich", { id: newId("oe"), firm_id: f.id, person: "", rr_id: "", status: "done", result: "none", at: now(), by: me.email }); out.push(res); return; }
      var d = rrCall("get", "/person/lookup?id=" + encodeURIComponent(p.id)) || {};
      var done = d.status === "complete" || d.status === "progress" || !!(d.emails || []).length;
      oxRrSaveContact(f, d.name ? d : Object.assign({}, p, d), me);
      res.found = (d.name || p.name || "") + (d.current_title || p.current_title ? " · " + (d.current_title || p.current_title) : ""); res.phone = (d.phones || []).length > 0; res.status = done ? "found" : "searching (check again in a minute)";
      res.guessed = oxFillPattern(f);                                    // one real email → the rest of the firm, free
      insert("OxEnrich", { id: newId("oe"), firm_id: f.id, person: d.name || p.name || "", rr_id: String(p.id), status: done && d.status === "complete" ? "done" : "pending", result: oxRrEmail(d) ? "email" : "no email yet", at: now(), by: me.email });
    } catch (e) { res.status = e.message; if (/credits|key|rate/i.test(e.message)) { out.push(res); throw new Error(e.message + " (" + out.length + " firms done before this)"); } }
    out.push(res);
  });
  CacheService.getScriptCache().remove("rr:acct");
  return { results: out, rr: oxRrInfo() };
};
/* Free first: a RocketReach SEARCH (names, titles, the company's website; no contact info) for each firm, then the free
   finder on that website. Credits are spent only later, and only on firms that still have no real email. If a search
   ever lowers the credits on this plan, it stops right away. */
ACTIONS.oxRrScout = function (me, b) {
  oxAdmin(me); if (!rrKey()) throw new Error("Connect RocketReach first.");
  var ids = [].concat(b.firm_ids || []).map(String).slice(0, 4), out = [], c0 = oxRrCredits(), checked = false, t = now();
  for (var i = 0; i < ids.length; i++) {
    var f = findBy("OxFirms", "id", ids[i]); if (!f) continue; var fl = oxFlags(f), res = { firm_id: f.id, firm: f.name, people: 0, website: "", free: 0, guessed: 0, needs_lookup: false, note: "" };
    if (fl.excluded) { res.note = "excluded"; out.push(res); continue; }
    if (oxHasRealEmail(f.id)) { res.note = "already has a real email"; out.push(res); continue; }
    var dom = oxDomain(f), nm = String(f.name).replace(/\s*\([^)]*\)/g, "").trim(), people = [];
    try { var r0 = rrCall("post", "/person/search", { query: dom ? { company_domain: [dom] } : { employer: [nm] }, page_size: 25 }) || []; people = Array.isArray(r0) ? r0 : r0.profiles || []; }
    catch (e) { res.note = e.message; out.push(res); if (/credits|key|rate/i.test(e.message)) break; continue; }
    if (!checked) { checked = true; if (oxRrCredits() < c0) { res.note = "searching used a credit on this plan, so it stopped"; out.push(res); return { results: out, stopped: true, rr: oxRrInfo() }; } }
    var words = oxNorm(nm).split(" ").filter(function (w) { return w.length >= 4 && ["architects", "architecture", "landscape", "design", "designs", "builders", "construction", "engineering", "associates", "group", "studio", "partners", "homes", "company", "development"].indexOf(w) < 0; });
    people = people.filter(function (p) { var em = oxNorm(p.current_employer || ""), pd = String(p.current_employer_domain || "").toLowerCase(); return dom ? (!pd || pd === dom) : (words.length ? words.every(function (w) { return em.indexOf(w) > -1; }) : em === oxNorm(nm)); });
    var site = ""; people.some(function (p) { var w = String(p.current_employer_website || p.current_employer_domain || "").trim(); if (w) site = w; return !!w; });
    if (!site) people.some(function (p) { var te = [].concat((p.teaser && (p.teaser.professional_emails || p.teaser.emails)) || []); te.some(function (x) { var d = String(x).split("@").pop().toLowerCase(); if (/^[a-z0-9.-]+\.[a-z]{2,}$/.test(d) && !OX_MAILBOX.test(d)) site = d; return !!site; }); return !!site; });
    if (site && !dom) { update("OxFirms", "id", f.id, { website: /^https?:/i.test(site) ? site : "https://" + site.replace(/^www\./i, ""), updated_at: t }); res.website = site; f = findBy("OxFirms", "id", f.id); }
    var have = rows("OxContacts").filter(function (c) { return c.firm_id === f.id; });
    people.slice(0, 15).forEach(function (p) {
      if (!p.name || have.some(function (c) { return String(c.rr_id) === String(p.id) || oxSame(c.name, p.name); })) return;
      insert("OxContacts", { id: newId("oc"), firm_id: f.id, name: p.name, role: p.current_title || "", email: "", phone: "", linkedin: p.linkedin_url || "", source: "rocketreach", verified: "no", rr_id: String(p.id || ""), created_at: t, updated_at: t }); res.people++;
    });
    var fr = oxFreeFirm(f, me); res.free = fr.gmail + fr.website; res.guessed = fr.guessed;
    res.needs_lookup = !oxHasRealEmail(f.id) && rows("OxContacts").some(function (c) { return c.firm_id === f.id && c.rr_id && !c.email; });
    if (!people.length) res.note = "RocketReach doesn't know this firm";
    out.push(res);
  }
  return { results: out, rr: oxRrInfo() };
};
/* Lookups still "searching": ask RocketReach again (no new credits for the same person). */
ACTIONS.oxEnrichCheck = function (me) {
  oxNeed(me); var pend = rows("OxEnrich").filter(function (x) { return x.status === "pending" && x.rr_id; }).slice(0, 25); if (!pend.length) return { updated: 0 };
  var got = rrCall("get", "/person/checkStatus?" + pend.map(function (x) { return "ids=" + encodeURIComponent(x.rr_id); }).join("&")) || [], n = 0;
  (Array.isArray(got) ? got : []).forEach(function (d) {
    var l = pend.filter(function (x) { return String(x.rr_id) === String(d.id); })[0]; if (!l || (d.status !== "complete" && d.status !== "failed")) return;
    var f = findBy("OxFirms", "id", l.firm_id); if (f && d.status === "complete") { oxRrSaveContact(f, d, me); oxFillPattern(f); }
    update("OxEnrich", "id", l.id, { status: "done", result: d.status === "complete" && oxRrEmail(d) ? "email" : "none" }); n++;
  });
  return { updated: n };
};
function oxRrEmail(d) {
  var pro = (d.emails || []).filter(function (e) { return e.type === "professional" && e.smtp_valid !== "invalid"; })[0];
  return normEmail(d.recommended_professional_email || d.current_work_email || (pro && pro.email) || "");
}
function oxRrSaveContact(f, d, me) {
  var phs = (d.phones || []).map(function (x) { return typeof x === "string" ? { number: x } : x || {}; }).filter(function (x) { return oxPhoneOk(x.number); });
  var bestPh = phs.filter(function (x) { return x.recommended; })[0] || phs.filter(function (x) { return /mobile|direct|cell/i.test(x.type || ""); })[0] || phs[0];
  var em = oxRrEmail(d), ph = bestPh ? oxPhoneFmt(bestPh.number) : "", t = now();
  var ct = rows("OxContacts").filter(function (c) { return c.firm_id === f.id && (String(c.rr_id) === String(d.id) || (d.name && oxSame(c.name, d.name))); })[0];
  var data = { name: d.name || "", role: d.current_title || "", linkedin: d.linkedin_url || "", rr_id: String(d.id || ""), updated_at: t };
  if (em) data.email = em; if (ph) data.phone = ph;
  if (phs.length) data.phones = phs.slice(0, 4).map(function (x) { return oxPhoneFmt(x.number) + (x.type ? " (" + String(x.type).toLowerCase() + ")" : ""); }).join(", ");
  if (ct) { if (ct.verified === "yes") { delete data.email; } update("OxContacts", "id", ct.id, data); }
  else insert("OxContacts", Object.assign({ id: newId("oc"), firm_id: f.id, email: "", phone: "", source: "rocketreach", verified: "no", created_at: t }, data));
}

/* ====================================== free email finder ======================================
   No paid service: (1) Jesús's own Gmail — people at that firm who already wrote to him or got his emails (verified);
   (2) the firm's website — home, contact, about and team pages (public); (3) the firm's own email format — when one
   person's email is known (jsmith@…), the others are built the same way and marked "guessed". */
var OX_JUNK = /\.(png|jpe?g|gif|svg|webp|css|js|ico)$|^(example|test|user|name|your|email)@|@(example|domain|email|sentry|wixpress|sentry-next|godaddy)\.|noreply|no-reply|donotreply/i;
var OX_GENERIC = /^(info|contact|hello|office|admin|studio|design|projects?|bids?|estimat\w*|mail|team|inquir\w*|general|reception|careers|jobs|marketing|press|media|sales)$/i;
var OX_MAILBOX = /^(gmail|yahoo|hotmail|outlook|icloud|aol|me|comcast|sbcglobal|att)\.(com|net)$/i;
function oxDomain(f) { var m = String(f.website || "").trim().replace(/^https?:\/\//i, "").replace(/^www\./i, "").split(/[\/?#]/)[0].toLowerCase(); return /^[a-z0-9.-]+\.[a-z]{2,}$/.test(m) ? m : ""; }
function oxDomainFits(f, dom) {                                    // does this email domain belong to the firm? (its website, or its name in the domain)
  dom = String(dom || "").toLowerCase(); if (!dom || /^(gmail|yahoo|hotmail|outlook|icloud|aol|me|comcast|sbcglobal|att)\./.test(dom)) return false;
  var own = oxDomain(f); if (own && (dom === own || dom.slice(-own.length - 1) === "." + own)) return true;
  var label = dom.split(".").slice(-2)[0].replace(/[^a-z]/g, ""), words = oxNorm(f.name).split(" ").filter(function (w) { return w.length >= 4 && ["architects", "architecture", "landscape", "design", "designs", "builders", "construction", "engineering", "associates", "group", "studio", "partners", "homes"].indexOf(w) < 0; });
  return words.length > 0 && words.some(function (w) { return label.indexOf(w) > -1; });
}
function oxParseAddrs(s) {
  var out = []; String(s || "").split(/,(?=(?:[^"]*"[^"]*")*[^"]*$)/).forEach(function (part) {
    var m = part.match(/^\s*"?([^"<]*?)"?\s*<([^>]+)>\s*$/), e = normEmail(m ? m[2] : part), n = m ? m[1].trim() : "";
    if (/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e)) out.push({ email: e, name: /@/.test(n) ? "" : n });
  });
  return out;
}
function oxFromGmail(f) {
  var dom = oxDomain(f), q = dom ? "(from:" + dom + " OR to:" + dom + " OR cc:" + dom + ")" : '"' + String(f.name).replace(/\s*\([^)]*\)/g, "").replace(/"/g, "") + '"';
  var ours = {}; rows("People").forEach(function (p) { ours[normEmail(p.email)] = 1; });
  var found = {}, threads = [];
  try { threads = GmailApp.search(q + " newer_than:3y", 0, 25); } catch (e) { return []; }
  threads.forEach(function (th) { th.getMessages().forEach(function (m) {
    [m.getFrom(), m.getTo(), m.getCc ? m.getCc() : ""].forEach(function (h) { oxParseAddrs(h).forEach(function (a) {
      var d = a.email.split("@")[1]; if (ours[a.email] || /bluesierracorp\.com$/.test(d) || OX_JUNK.test(a.email) || !oxDomainFits(f, d)) return;
      if (!found[a.email] || (!found[a.email].name && a.name)) found[a.email] = { email: a.email, name: a.name };
    }); });
  }); });
  return Object.keys(found).map(function (k) { return found[k]; });
}
function oxFromWebsite(f) {
  var dom = oxDomain(f); if (!dom) return { emails: [], phones: [], pages: 0 };
  var paths = ["", "/contact", "/contact-us", "/about", "/team", "/people", "/studio", "/office"], emails = {}, phones = {}, ok = 0;
  var res = []; try { res = UrlFetchApp.fetchAll(paths.map(function (p) { return { url: "https://" + dom + p, muteHttpExceptions: true, followRedirects: true, headers: { "User-Agent": "Mozilla/5.0 (portal contact finder)" } }; })); } catch (e) { return { emails: [], phones: [], pages: 0, err: String(e.message || e).slice(0, 120) }; }
  res.forEach(function (r) {
    if (r.getResponseCode() >= 300) return; ok++;
    var html = String(r.getContentText() || "").slice(0, 400000).replace(/&#64;|&#x40;|\s*\[at\]\s*|\s*\(at\)\s*/gi, "@").replace(/\s*\[dot\]\s*|\s*\(dot\)\s*/gi, ".");
    (html.match(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g) || []).forEach(function (e) { e = normEmail(e); if (!OX_JUNK.test(e) && e.length < 80) emails[e] = 1; });
    var text = html.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/gi, " ").replace(/<[^>]+>/g, " ");
    (text.match(/(?:\+?1[\s.-]?)?\(?\b[2-9]\d{2}\)?[\s.-]\d{3}[\s.-]\d{4}\b/g) || []).forEach(function (p) { var d = p.replace(/\D/g, "").slice(-10); if (d.length === 10) phones[d] = 1; });
  });
  var keep = {}; Object.keys(emails).forEach(function (e) {             // only the firm's own domain (or a plain mailbox like Gmail); sites that hide emails with ROT13 get decoded
    var r13 = e.replace(/[a-z]/g, function (c) { return String.fromCharCode((c.charCodeAt(0) - 97 + 13) % 26 + 97); });
    if (oxDomainFits(f, e.split("@")[1]) || OX_MAILBOX.test(e.split("@")[1])) keep[e] = 1; else if (oxDomainFits(f, r13.split("@")[1])) keep[r13] = 1;
  });
  var list = Object.keys(keep).sort(function (a, b) { return (oxDomainFits(f, b.split("@")[1]) ? 1 : 0) - (oxDomainFits(f, a.split("@")[1]) ? 1 : 0); }).slice(0, 8);
  return { emails: list, phones: Object.keys(phones).slice(0, 3), pages: ok };
}
/* first.last@, flast@, first@ … learned from one known person at the firm */
var OX_PATTERNS = { first: function (f, l) { return f; }, last: function (f, l) { return l; }, firstlast: function (f, l) { return f + l; }, "first.last": function (f, l) { return f + "." + l; }, flast: function (f, l) { return f[0] + l; }, "f.last": function (f, l) { return f[0] + "." + l; }, firstl: function (f, l) { return f + l[0]; } };
function oxNameParts(n) { var w = oxNorm(n).split(" ").filter(function (x) { return x.length > 1 && !/^(pe|jr|sr|ii|iii|aia|asla|leed|ap)$/.test(x); }); return w.length >= 2 ? { f: w[0], l: w[w.length - 1] } : null; }
function oxPatternOf(contacts) {
  var hit = null; contacts.forEach(function (c) {
    if (hit || !c.email || !c.name || c.source === "guessed") return; var p = oxNameParts(c.name); if (!p) return;
    var lp = c.email.split("@")[0]; Object.keys(OX_PATTERNS).forEach(function (k) { if (!hit && OX_PATTERNS[k](p.f, p.l) === lp && !(k === "first" && p.f === p.l)) hit = { pattern: k, domain: c.email.split("@")[1], from: c.name }; });
  });
  return hit;
}
/* The free search for one firm: Gmail, its website, its email format. Used by "Find emails (free)" and after a RocketReach search. */
function oxFreeFirm(f, me) {
  var t = now(), r = { firm_id: f.id, firm: f.name, gmail: 0, website: 0, guessed: 0, phone: "", note: "" };
  if (oxFlags(f).excluded) { r.note = "excluded"; return r; }
  var cs = function () { return rows("OxContacts").filter(function (c) { return c.firm_id === f.id; }); };
  var add = function (email, name, source, verified, role) {
    var have = cs(), same = have.filter(function (c) { return c.email === email; })[0]; if (same) { if (verified === "yes" && same.verified !== "yes") update("OxContacts", "id", same.id, { verified: "yes", source: source, updated_at: t }); return false; }
    var person = name ? have.filter(function (c) { return !c.email && oxSame(c.name, name); })[0] : have.filter(function (c) { return !c.email && c.name && oxEmailFits(email, c.name); })[0];
    if (person) { update("OxContacts", "id", person.id, { email: email, source: source, verified: verified, updated_at: t }); return true; }
    insert("OxContacts", { id: newId("oc"), firm_id: f.id, name: name || "", role: role || (OX_GENERIC.test(email.split("@")[0]) ? "General inbox" : ""), email: email, phone: "", linkedin: "", source: source, verified: verified, rr_id: "", created_at: t, updated_at: t });
    return true;
  };
  try { oxFromGmail(f).forEach(function (a) { if (add(a.email, a.name, "gmail", "yes")) r.gmail++; }); } catch (e) { r.note = "Gmail: " + e.message; }
  var w = oxFromWebsite(f); w.emails.forEach(function (e) { if (add(e, "", "website", "no")) r.website++; });
  if (w.phones.length && !f.phone) { update("OxFirms", "id", f.id, { phone: w.phones[0].replace(/(\d{3})(\d{3})(\d{4})/, "($1) $2-$3"), updated_at: t }); r.phone = w.phones[0]; }
  if (!oxDomain(f)) r.note = r.note || "no website saved";
  r.guessed = oxFillPattern(f);
  insert("OxEnrich", { id: newId("oe"), firm_id: f.id, person: "", rr_id: "", status: "free", result: "gmail " + r.gmail + ", website " + r.website + " (" + w.pages + " pages), guessed " + r.guessed, at: t, by: me.email });
  return r;
}
/* Once one real email shows the firm's format (jsmith@), everyone else we know at the firm gets theirs built the same way ("guessed"). */
function oxFillPattern(f) {
  var cs = rows("OxContacts").filter(function (c) { return c.firm_id === f.id; }), pat = oxPatternOf(cs), n = 0, t = now(); if (!pat) return 0;
  cs.forEach(function (c) { if (c.email || !c.name) return; var p = oxNameParts(c.name); if (!p) return; update("OxContacts", "id", c.id, { email: OX_PATTERNS[pat.pattern](p.f, p.l) + "@" + pat.domain, source: "guessed", verified: "no", updated_at: t }); n++; });
  return n;
}
/* A real person's email (not a general inbox, not a guess): with one of these a RocketReach credit isn't needed. */
function oxHasRealEmail(fid) {
  return rows("OxContacts").some(function (c) { return c.firm_id === fid && c.email && c.source !== "guessed" && !OX_GENERIC.test(c.email.split("@")[0]) && (c.verified === "yes" || ["gmail", "website", "rocketreach", "research file"].indexOf(c.source) > -1); });
}
ACTIONS.oxFindFree = function (me, b) {
  oxNeed(me); var ids = [].concat(b.firm_ids || []).map(String).slice(0, 6), out = [];
  ids.forEach(function (id) { var f = findBy("OxFirms", "id", id); if (f) out.push(oxFreeFirm(f, me)); });
  return { results: out };
};

/* ====================================== export ====================================== */
ACTIONS.oxExport = function (me, b) {
  oxNeed(me); var t = String(b.table || ""), map = { projects: "OxProjects", firms: "OxFirms", contacts: "OxContacts", roles: "OxRoles", touches: "OxTouches", opportunities: "OxOpps", emails: "OxOutbox", lookups: "OxEnrich" };
  if (!map[t]) throw new Error("Pick a table."); var h = TABLES[map[t]];
  var q = function (v) { v = String(v == null ? "" : v); return /[",\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v; };
  return { file: "outreach_" + t + "_" + oxToday() + ".csv", csv: [h.join(",")].concat(rows(map[t]).map(function (r) { return h.map(function (k) { return q(r[k]); }).join(","); })).join("\n") };
};
NO_LOCK.oxExport = 1; NO_LOCK.oxEnrichPlan = 1;
["oxRrScout", "oxSigSave", "oxDeleteProject", "oxAiSave", "oxFindFree", "oxImport", "oxSend", "oxTouch", "oxSaveFirm", "oxLinkRole", "oxSaveContact", "oxDeleteContact", "oxSaveOpp", "oxAlert", "oxEnrich", "oxEnrichCheck", "oxCheckReplies", "oxRrSave"].forEach(function (a) { PREFETCH[a] = OX_T.concat(["People"]); });
["oxHome", "oxDraft", "oxAiDraft", "oxExport", "oxEnrichPlan"].forEach(function (a) { PREFETCH[a] = OX_T.concat(["People"]); });

/* ====================================== Calls: the appointment setter ======================================
   The setter logs in to the portal like anyone else (role "setter") and sees only this: who to call, the number,
   what to say about their projects, and Jesús's free times to book a meeting straight onto his Google Calendar.
   Every call is an Outreach touch, so Jesús's emails and the setter's calls are one history. Same rules as email:
   - owners and unconfirmed individuals never show; excluded and "do not call" firms never show; warm firms first,
     and on a shared project cold firms wait for the warm one (same rule as the emails);
   - a firm that replied, booked or said "not interested" leaves the list; "do not call" from a call is permanent;
   - a booked meeting stops the email follow-ups; the calendar invite only says who and what, never internal notes;
   - the setter sees names, titles, phones and emails of the firm's people, and the projects' streets and stages:
     never owners' names, never notes, never money. */
var OX_CALL_OUT = { no_answer: "No answer", voicemail: "Left a voicemail", gatekeeper: "Talked to the front desk", callback: "Call back", conversation: "Talked",
  not_interested: "Not interested", wrong_number: "Wrong number", do_not_call: "Do not call", booked: "Meeting booked" };
var OX_MEET_KIND = { phone: "Phone call", video: "Video call", office: "At their office", site: "Site walk" };
var OX_DM = /princ|partner|owner|founder|president|ceo|director|\bvp\b|head of/i, OX_DM2 = /project (architect|manager|lead)|associate|estimat|precon|bid/i;
var OX_HOURS = { from: 9 * 60, to: 16 * 60 + 30 };                                     // bookable start times, Pacific, Monday to Friday
function oxCallNeed(me, write) {
  if (!me || !(isStaff(me) || me.role === "setter")) throw new Error("Calls are for the Blue Sierra office and the setter.");
  if (write && me.preview) throw new Error("This is a preview. Nothing is saved.");
}
function oxDmRank(c) { return OX_DM.test(c.role || "") ? 0 : OX_DM2.test(c.role || "") ? 1 : 2; }
function oxPhoneOk(s) { return String(s || "").replace(/\D/g, "").length >= 10; }
function oxPhoneFmt(s) { var one = String(s || "").match(/(?:\+?1[\s.-]?)?\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}/), d = (one ? one[0] : String(s || "")).replace(/\D/g, ""); if (d.length === 11 && d[0] === "1") d = d.slice(1); return d.length === 10 ? "(" + d.slice(0, 3) + ") " + d.slice(3, 6) + "-" + d.slice(6) : String(s || "").trim(); }
/* Why a firm gets no paid phone lookup. */
function oxCallSkip(f, fl, contacts, log) {
  if (fl.excluded) return "excluded"; if (fl.individual) return "individual (confirm first)"; if (fl.noCall) return "on the do-not-call list";
  if (contacts.some(function (c) { return c.firm_id === f.id && oxPhoneOk(c.phone) && oxDmRank(c) === 0; })) return "a decision maker already has a phone";
  if (log.some(function (x) { return x.firm_id === f.id && x.status === "done"; })) return "already looked up";
  return "";
}
/* Who's on the call list today, and why. Shared by the setter's list and Jesús's Outreach home. */
function oxCallPool(today) {
  var firms = rows("OxFirms"), contacts = rows("OxContacts"), roles = rows("OxRoles"), touches = rows("OxTouches"), projects = rows("OxProjects"), meets = rows("OxMeetings");
  var pById = {}; projects.forEach(function (p) { pById[p.id] = p; });
  var byFirm = {}; touches.forEach(function (x) { (byFirm[x.firm_id] = byFirm[x.firm_id] || []).push(x); });
  var st = {}; firms.forEach(function (f) { st[f.id] = oxState(f, byFirm[f.id] || [], today); });
  var block = oxBlocks(firms, roles, st, today), items = [], noPhone = [], later = 0, doneToday = 0;
  firms.forEach(function (f) {
    var fl = oxFlags(f), s = st[f.id], list = byFirm[f.id] || [];
    if (fl.excluded || fl.noCall || fl.individual || oxJesusOwn(f) || s.replied || ["closed", "paused", "removed", "meeting"].indexOf(f.status) > -1) return;
    if (meets.some(function (m) { return m.firm_id === f.id && m.status === "booked"; })) return;
    if (block[f.id] && block[f.id].all) return;
    var mine = roles.filter(function (x) { return x.firm_id === f.id && x.role !== "owner"; }).map(function (x) { return pById[x.project_id]; }).filter(function (p) { return p && p.stage !== "5"; });
    if (!mine.length) return;
    var calls = list.filter(function (x) { return x.channel === "call"; }).sort(function (a, b) { return a.at < b.at ? -1 : 1; }), last = calls[calls.length - 1] || null;
    if (last && last.date === today) { doneToday++; return; }
    var cb = /^call back/i.test(f.next_step || "") && f.next_date ? f.next_date : "";
    if (cb && cb > today) { later++; return; }
    var tries = calls.filter(function (x) { return ["no_answer", "voicemail", "gatekeeper"].indexOf(x.outcome) > -1; }).length;
    if (!cb && last && ["no_answer", "voicemail"].indexOf(last.outcome) > -1 && oxWorkdaysBetween(last.date, today) < 2) { later++; return; }
    if (!cb && tries >= 5) return;                                                     // five tries without a conversation: email only from here
    var people = contacts.filter(function (c) { return c.firm_id === f.id && c.name && !/general inbox/i.test(c.role || ""); });
    var withPh = people.filter(function (c) { return oxPhoneOk(c.phone); }).sort(function (a, b) { return oxDmRank(a) - oxDmRank(b); });
    var dm = people.slice().sort(function (a, b) { return oxDmRank(a) - oxDmRank(b); })[0] || null;
    var target = withPh[0] || null, main = oxPhoneOk(f.phone) ? oxPhoneFmt(f.phone) : "";
    var value = oxFirmValue(f);
    if (!target && !main) { noPhone.push({ firm_id: f.id, value: value }); return; }
    var dueCall = s.due && s.due.step === "day7" && s.due.date <= today;
    var kind = cb ? "callback" : dueCall ? "cadence" : s.emailed ? "emailed" : "new";
    var score = { callback: 1000, cadence: 600, emailed: 300, new: 0 }[kind] + value + (target && oxDmRank(target) === 0 ? 40 : 0) - tries * 15;
    items.push({ f: f, s: s, mine: mine, target: target, dm: dm, others: withPh.slice(1, 4), main: main, kind: kind, cb: cb, tries: tries, last: last, list: list, score: score });
  });
  items.sort(function (a, b) { return b.score - a.score; });
  noPhone.sort(function (a, b) { return b.value - a.value; });
  return { items: items, no_phone: noPhone.map(function (x) { return x.firm_id; }), later: later, done_today: doneToday };
}
/* Firms Jesús handles himself ("Email from Jesús personally", "Jesús calls"): never on the setter's list. */
function oxJesusOwn(f) { return oxFlags(f).personal || /jes[uú]s calls/i.test(String(f.channel || "")); }
function oxWorkdaysBetween(a, b) { var n = 0, d = a; for (var i = 0; i < 30 && d < b; i++) { d = oxAdd(d, 1); if (oxWorkday(d)) n++; } return n; }
function oxCallProjects(mine) {
  return mine.slice().sort(function (x, y) { return (Number(y.fit) || 0) - (Number(x.fit) || 0) || ("ABC".indexOf(x.priority) - "ABC".indexOf(y.priority)) || (x.date < y.date ? 1 : -1); })
    .filter(function (p, i, a) { return a.findIndex(function (q) { return oxStreetFull(q) === oxStreetFull(p); }) === i; }).slice(0, 3)
    .map(function (p) { return { id: p.id, street: oxStreetFull(p), town: p.town, stage: oxStagePhrase(p), scope: oxScope(p), type: OX_TYPE[p.type] || "", date: p.date }; });
}
/* What to say: short, in Jesús's voice, no dashes. The same firm and number give the same words. */
var OX_SAY = {
  why: ["I'm calling about {A}. I saw it {stage}.", "I saw {A} {stage}, and I wanted to reach out.", "Quick call about {A}. Looks like it {stage}."],
  pitch: ["We do the site work, hardscape and landscape on a lot of the homes around here.", "Blue Sierra builds the site work, hardscape and landscape on custom homes around the Peninsula.", "We're the site work, hardscape and landscape contractor on a lot of homes like this one."],
  ask: ["Who's putting together the bid list for {scope}? We'd love to be on it.", "Is the bid list for {scope} together yet? We'd love a shot at it.", "Could we get on the bid list for {scope}?"],
  meet: ["Would you have 15 minutes this week to talk it through with Jesús, our owner?", "Could Jesús, our owner, grab 15 minutes with you to walk through it?", "Jesús, our owner, would love to meet you. Do you have 15 minutes this week or next?"]
};
function oxCallScript(it, me, n) {
  var ct = it.target || it.dm, first = ct && ct.name ? oxTitle(oxNorm(ct.name).split(" ")[0]) : "", p = it.projects[0] || {}, seed = it.f.id + "|call|" + (n || 0);
  var v = { A: (p.street || "your project") + (p.town ? " in " + p.town : ""), stage: p.stage || "is moving", scope: p.scope || "the site work and landscape" };
  var mine = String(me.name || "").split(" ")[0] || "Tim", who = ct && ct.name ? ct.name : it.dm && it.dm.name ? it.dm.name : "", sigPh = (oxSig() || {}).phone || "";
  var why = oxFill(oxPick(OX_SAY.why, seed, "why"), v).replace(/\bit is /g, "it's ");
  var two = it.projects[1] ? " Your team has " + it.projects[1].street + (it.projects[1].town !== p.town ? " in " + it.projects[1].town : "") + " too." : "";
  return {
    opener: (first ? "Hi " + first + ", " : "Hi, ") + "this is " + mine + " with Blue Sierra Construction.",
    front: "Hi, this is " + mine + " with Blue Sierra Construction. " + (who ? "Is " + who.split(" ")[0] + " in? " : "Who handles the bid lists for your projects? ") + "It's about " + (p.street || "one of your projects") + ".",
    why: why + two,
    pitch: oxPick(OX_SAY.pitch, seed, "pitch"),
    ask: oxFill(oxPick(OX_SAY.ask, seed, "ask"), v),
    meet: oxPick(OX_SAY.meet, seed, "meet"),
    voicemail: (first ? "Hi " + first + ", " : "Hi, ") + "this is " + mine + " with Blue Sierra Construction, about " + v.A + ". We'd love to bid " + v.scope + ". " + (sigPh ? "You can reach us at " + sigPh + ". " : "") + "Thank you."
  };
}
function oxCallOut(it, me, n) {
  var person = function (c) { return c ? { id: c.id, name: c.name || "", title: c.role || "", phone: oxPhoneOk(c.phone) ? oxPhoneFmt(c.phone) : "", phones: c.phones || "", email: c.email || "", linkedin: c.linkedin || "", dm: oxDmRank(c) === 0 } : null; };
  it.projects = oxCallProjects(it.mine);
  var reason = it.kind === "callback" ? "Call back" + (it.cb < oxToday() ? " (was due " + it.cb + ")" : " today") + (it.f.next_step && it.f.next_step.length > 9 ? ": " + it.f.next_step.replace(/^call back:?\s*/i, "") : "")
    : it.kind === "cadence" ? "Jesús emailed on " + it.s.day0 + ". Today is the follow-up call."
    : it.kind === "emailed" ? "Jesús emailed on " + it.s.day0 + ", no reply yet."
    : (it.f.segment === "warm" ? "We know this firm. " : it.f.segment === "known" ? "They know our name. " : "") + it.mine.length + " project" + (it.mine.length === 1 ? "" : "s") + " on the permits.";
  return { firm_id: it.f.id, firm: it.f.name, type: it.f.firm_type || "", segment: it.f.segment || "cold", website: it.f.website || "", main_phone: it.main, kind: it.kind, reason: reason, tries: it.tries,
    last: it.last ? { date: it.last.date, outcome: it.last.outcome, label: OX_CALL_OUT[it.last.outcome] || it.last.outcome, by: personName(it.last.by) } : null,
    contact: person(it.target), ask_for: !it.target && it.dm ? person(it.dm) : null, others: it.others.map(person), projects: it.projects,
    history: it.list.slice().sort(function (a, b) { return a.at < b.at ? 1 : -1; }).slice(0, 6).map(function (x) { return { date: x.date, channel: x.channel, outcome: OX_CALL_OUT[x.outcome] || x.outcome || "", summary: x.channel === "email" ? "Jesús emailed" + (x.step === "day14" ? " a follow-up" : "") : clean(x.summary, 200), by: personName(x.by) }; }),
    script: oxCallScript(it, me, n) };
}
function oxMeetOut(m) {
  var f = findBy("OxFirms", "id", m.firm_id) || {}, c = m.contact_id ? findBy("OxContacts", "id", m.contact_id) : null, p = m.project_id ? findBy("OxProjects", "id", m.project_id) : null;
  return { id: m.id, day: m.day, time: m.time, minutes: Number(m.minutes) || 30, kind: m.kind, kind_label: OX_MEET_KIND[m.kind] || m.kind, where: m.where, link: m.link, status: m.status, firm_id: m.firm_id, firm: f.name || "",
    contact: c ? c.name : "", title: c ? c.role : "", phone: c && oxPhoneOk(c.phone) ? oxPhoneFmt(c.phone) : "", email: m.email, project: p ? oxStreetFull(p) + ", " + p.town : "", booked_by: personName(m.booked_by), note: m.note };
}
function oxCallStats(email, today) {
  var wk = oxAdd(today, -((oxDow(today) + 6) % 7)), z = function () { return { calls: 0, talked: 0, booked: 0 }; }, o = { today: z(), week: z() };
  rows("OxTouches").forEach(function (x) {
    if (x.channel !== "call" || (email && normEmail(x.by) !== normEmail(email)) || x.date < wk || x.date > today) return;
    [x.date === today ? o.today : null, o.week].forEach(function (b) { if (!b) return; b.calls++; if (["conversation", "callback", "not_interested", "booked"].indexOf(x.outcome) > -1) b.talked++; if (x.outcome === "booked") b.booked++; });
  });
  return o;
}
ACTIONS.oxCalls = function (me, b) {
  oxCallNeed(me); prefetch(OX_T.concat(["People"]));
  var today = oxToday(), pool = oxCallPool(today);
  return { today: today, me: { name: me.name, first: String(me.name || "").split(" ")[0] }, stats: oxCallStats(me.role === "setter" ? me.email : "", today),
    queue: pool.items.slice(0, 40).map(function (it) { return oxCallOut(it, me, Number(b && b.n) || 0); }), total: pool.items.length, later: pool.later, done_today: pool.done_today, no_phone: pool.no_phone.length,
    meetings: rows("OxMeetings").filter(function (m) { return m.status === "booked" && m.day >= today; }).sort(function (a, c) { return (a.day + a.time) < (c.day + c.time) ? -1 : 1; }).map(oxMeetOut),
    outcomes: OX_CALL_OUT, kinds: OX_MEET_KIND, hours: OX_HOURS };
};
NO_LOCK.oxCalls = 1;
ACTIONS.oxCallLog = function (me, b) {
  oxCallNeed(me, true); var f = findBy("OxFirms", "id", String(b.firm_id || "")); if (!f) throw new Error("Firm not found.");
  var fl = oxFlags(f), out = String(b.outcome || ""); if (!OX_CALL_OUT[out] || out === "booked") throw new Error("Pick how the call went.");
  if (fl.excluded || fl.individual) throw new Error(f.name + " isn't on the call list."); if (fl.noCall) throw new Error(f.name + " is on the do-not-call list.");
  if (me.role === "setter" && oxJesusOwn(f)) throw new Error("Jesús handles " + f.name + " himself.");
  var ct = b.contact_id ? findBy("OxContacts", "id", String(b.contact_id)) : null; if (ct && ct.firm_id !== f.id) ct = null;
  var today = oxToday(), st = oxState(f, rows("OxTouches").filter(function (x) { return x.firm_id === f.id; }), today), patch = { updated_at: now() }, note = clean(b.note, 600);
  if (out === "callback") {
    var cd = String(b.callback_date || ""); if (!/^\d{4}-\d\d-\d\d$/.test(cd) || cd < today) throw new Error("Pick the day to call back.");
    var tm = /^\d\d:\d\d$/.test(String(b.callback_time || "")) ? b.callback_time : "";
    patch.next_step = "Call back" + (tm ? " at " + tm : "") + (ct && ct.name ? ": " + ct.name : ""); patch.next_date = cd;
  } else if (/^call back/i.test(f.next_step || "")) { patch.next_step = ""; patch.next_date = ""; }
  if (out === "not_interested") patch.status = "closed";
  if (out === "do_not_call") patch.flags = (String(f.flags || "").trim() + (f.flags ? "; " : "") + "do not call (" + me.name + ", " + today + ")").slice(0, 300);
  if (out === "wrong_number") {
    if (ct && ct.phone) update("OxContacts", "id", ct.id, { phone: "", phones: ("wrong: " + ct.phone + (ct.phones ? ", " + ct.phones : "")).slice(0, 300), updated_at: now() });
    else if (f.phone) patch.phone = "";
  }
  var np = b.new_contact || null, newId_ = "";
  if (np && clean(np.name, 120)) {
    var nc = { id: newId("oc"), firm_id: f.id, name: clean(np.name, 120), role: clean(np.role, 120), email: /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(String(np.email || "").trim()) ? normEmail(np.email) : "",
      phone: oxPhoneOk(np.phone) ? oxPhoneFmt(np.phone) : "", linkedin: "", source: "setter", verified: "no", rr_id: "", created_at: now(), updated_at: now(), phones: "" };
    insert("OxContacts", nc); newId_ = nc.id;
  }
  if (ct && b.new_phone && oxPhoneOk(b.new_phone) && out !== "wrong_number") update("OxContacts", "id", ct.id, { phone: oxPhoneFmt(b.new_phone), updated_at: now() });
  var t = { id: newId("ot"), firm_id: f.id, contact_id: ct ? ct.id : newId_, project_id: clean(b.project_id, 40), date: today, channel: "call", step: st.due && st.due.step === "day7" ? "day7" : "",
    summary: (OX_CALL_OUT[out] + (ct && ct.name ? " · " + ct.name : "") + (note ? ": " + note : "")).slice(0, 500), outcome: out, by: me.email, at: now(), outbox_id: "", thread_id: "" };
  insert("OxTouches", t); update("OxFirms", "id", f.id, patch);
  if (b.want_email && ["conversation", "gatekeeper", "callback"].indexOf(out) > -1)                   // "send me the info": Jesús writes it, from his Gmail
    insert("OxAlerts", { id: newId("oa"), firm_id: f.id, project_id: clean(b.project_id, 40), kind: "setter_email", status: "open", created_at: now(), done_at: "" });
  return { touch: t, stats: oxCallStats(me.role === "setter" ? me.email : "", today) };
};
/* Jesús's free times: his Google Calendar (busy blocks) plus meetings already booked here, Monday to Friday, 9:00 to 4:30. */
function oxPtMs(day, hm) {
  var m = String(day).match(/^(\d{4})-(\d\d)-(\d\d)$/), t = String(hm).match(/^(\d\d):(\d\d)$/); if (!m || !t) return NaN;
  var base = Date.UTC(+m[1], +m[2] - 1, +m[3], +t[1], +t[2]);
  for (var off = 7; off <= 8; off++) { var ms = base + off * 3600e3; if (Utilities.formatDate(new Date(ms), CONFIG.TZ, "yyyy-MM-dd HH:mm") === day + " " + hm) return ms; }
  return base + 8 * 3600e3;
}
function oxHm(min) { return ("0" + Math.floor(min / 60)).slice(-2) + ":" + ("0" + (min % 60)).slice(-2); }
function oxBusy(fromMs, toMs) {
  var busy = [];
  try {
    var r = Calendar.Freebusy.query({ timeMin: new Date(fromMs).toISOString(), timeMax: new Date(toMs).toISOString(), timeZone: CONFIG.TZ, items: [{ id: "primary" }] });
    ((r.calendars && r.calendars.primary && r.calendars.primary.busy) || []).forEach(function (x) { busy.push([new Date(x.start).getTime(), new Date(x.end).getTime()]); });
  } catch (e) { throw new Error("Couldn't read Jesús's calendar right now. Try again in a minute."); }
  rows("OxMeetings").forEach(function (m) { if (m.status !== "booked") return; var s = oxPtMs(m.day, m.time); busy.push([s, s + (Number(m.minutes) || 30) * 60000]); });
  return busy;
}
ACTIONS.oxCallSlots = function (me, b) {
  oxCallNeed(me); var mins = [15, 30, 45, 60].indexOf(Number(b.minutes)) > -1 ? Number(b.minutes) : 30, nowMs = oxNowMs(), today = oxToday(), days = [], d = today;
  for (var i = 0; days.length < 8 && i < 20; i++) { if (oxWorkday(d)) days.push(d); d = oxAdd(d, 1); }
  var busy = oxBusy(oxPtMs(days[0], "00:00"), oxPtMs(days[days.length - 1], "23:59"));
  return { minutes: mins, days: days.map(function (day) {
    var slots = [];
    for (var t = OX_HOURS.from; t <= OX_HOURS.to; t += 30) {
      var s = oxPtMs(day, oxHm(t)), e = s + mins * 60000; if (s < nowMs + 2 * 3600e3) continue;
      if (busy.some(function (x) { return s < x[1] && e > x[0]; })) continue; slots.push(oxHm(t));
    }
    return { day: day, slots: slots };
  }) };
};
NO_LOCK.oxCallSlots = 1;
ACTIONS.oxCallBook = function (me, b) {
  oxCallNeed(me, true); var f = findBy("OxFirms", "id", String(b.firm_id || "")); if (!f) throw new Error("Firm not found.");
  var fl = oxFlags(f); if (fl.excluded || fl.individual) throw new Error(f.name + " isn't on the call list.");
  if (me.role === "setter" && (fl.noCall || oxJesusOwn(f))) throw new Error("Jesús handles " + f.name + " himself.");
  var day = String(b.day || ""), time = String(b.time || ""), mins = [15, 30, 45, 60].indexOf(Number(b.minutes)) > -1 ? Number(b.minutes) : 30, kind = OX_MEET_KIND[b.kind] ? b.kind : "phone";
  var tMin = /^\d\d:\d\d$/.test(time) ? Number(time.slice(0, 2)) * 60 + Number(time.slice(3)) : -1;
  if (!/^\d{4}-\d\d-\d\d$/.test(day) || !oxWorkday(day) || tMin < OX_HOURS.from || tMin > OX_HOURS.to) throw new Error("Pick one of Jesús's free times.");
  var s = oxPtMs(day, time), e = s + mins * 60000; if (s < oxNowMs() + 60 * 60000) throw new Error("That time is too soon. Pick a later one.");
  if (oxBusy(s - 60000, e + 60000).some(function (x) { return s < x[1] && e > x[0]; })) throw new Error("Jesús just got busy at that time. Pick another one.");
  var ct = b.contact_id ? findBy("OxContacts", "id", String(b.contact_id)) : null; if (ct && ct.firm_id !== f.id) ct = null;
  var p = b.project_id ? findBy("OxProjects", "id", String(b.project_id)) : null;
  var email = String(b.email || (ct && ct.email) || "").trim().toLowerCase(); if (email && !/^[^@\s,;<>]+@[^@\s,;<>]+\.[^@\s,;<>]+$/.test(email)) throw new Error("That email doesn't look right.");
  var where = clean(b.where, 200) || (kind === "site" && p ? oxStreetFull(p) + ", " + p.town + ", CA" : kind === "phone" && ct && ct.phone ? "Jesús calls " + oxPhoneFmt(ct.phone) : "");
  var about = p ? oxStreetFull(p) + " in " + p.town : "";
  var ev = { summary: "Blue Sierra Construction × " + f.name + (ct && ct.name ? " (" + ct.name + ")" : ""), location: where,
    description: OX_MEET_KIND[kind] + " with Jesús Toto, Blue Sierra Construction." + (about ? "\nAbout: " + about + "." : ""),             // the guest sees this: no internal notes
    start: { dateTime: new Date(s).toISOString(), timeZone: CONFIG.TZ }, end: { dateTime: new Date(e).toISOString(), timeZone: CONFIG.TZ },
    attendees: email ? [{ email: email, displayName: ct && ct.name ? ct.name : "" }] : [], reminders: { useDefault: true } };
  if (kind === "video") ev.conferenceData = { createRequest: { requestId: newId("m"), conferenceSolutionKey: { type: "hangoutsMeet" } } };
  var made; try { made = Calendar.Events.insert(ev, "primary", { sendUpdates: email ? "all" : "none", conferenceDataVersion: 1 }); }
  catch (er) { throw new Error("Google Calendar didn't take it: " + (er.message || er)); }
  var link = (made && (made.hangoutLink || made.htmlLink)) || "", t = now();
  var m = { id: newId("om"), firm_id: f.id, contact_id: ct ? ct.id : "", project_id: p ? p.id : "", day: day, time: time, minutes: mins, kind: kind, where: where, email: email, event_id: (made && made.id) || "", link: link,
    status: "booked", booked_by: me.email, note: clean(b.note, 600), created_at: t, updated_at: t };
  insert("OxMeetings", m);
  insert("OxTouches", { id: newId("ot"), firm_id: f.id, contact_id: m.contact_id, project_id: m.project_id, date: oxToday(), channel: "call", step: "", summary: ("Booked: " + OX_MEET_KIND[kind] + " " + day + " " + time + (ct && ct.name ? " with " + ct.name : "") + (m.note ? ": " + m.note : "")).slice(0, 500), outcome: "booked", by: me.email, at: t, outbox_id: "", thread_id: "" });
  update("OxFirms", "id", f.id, { status: "meeting", next_step: "Meeting " + day + " " + time + " (" + OX_MEET_KIND[kind] + ")", next_date: day, updated_at: t });
  return { meeting: oxMeetOut(m), invited: !!email, stats: oxCallStats(me.role === "setter" ? me.email : "", oxToday()) };
};
/* After the meeting: Jesús marks it held / no-show / canceled. Canceling removes it from his calendar and tells the guest. */
ACTIONS.oxMeeting = function (me, b) {
  oxCallNeed(me, true); var m = findBy("OxMeetings", "id", String(b.id || "")); if (!m) throw new Error("Meeting not found.");
  var st = String(b.status || ""); if (["held", "no_show", "canceled"].indexOf(st) < 0) throw new Error("Pick what happened.");
  if (me.role === "setter" && (st !== "canceled" || normEmail(m.booked_by) !== normEmail(me.email))) throw new Error("Only Jesús updates meetings. You can cancel one you booked.");
  if (st === "canceled" && m.event_id) { try { Calendar.Events.remove("primary", m.event_id, { sendUpdates: m.email ? "all" : "none" }); } catch (e) {} }
  update("OxMeetings", "id", m.id, { status: st, note: b.note != null ? clean(b.note, 600) : m.note, updated_at: now() });
  var f = findBy("OxFirms", "id", m.firm_id);
  if (f) update("OxFirms", "id", f.id, st === "held" ? { status: "replied", next_step: "Send the bid info", next_date: oxToday(), updated_at: now() } : { status: "", next_step: st === "no_show" ? "Call back: missed the meeting" : "", next_date: st === "no_show" ? oxToday() : "", updated_at: now() });
  return { meeting: oxMeetOut(findBy("OxMeetings", "id", m.id)) };
};
["oxCallLog", "oxCallBook", "oxMeeting"].forEach(function (a) { PREFETCH[a] = OX_T.concat(["People"]); });
["oxCalls", "oxCallSlots"].forEach(function (a) { PREFETCH[a] = OX_T.concat(["People"]); READ_ONLY[a] = 1; });   // Jesús can preview the setter's screen

/* ====================================== Find projects: one brief per project ======================================
   An office employee should open a project and answer four questions without training: which project, what work
   Blue Sierra could bid, who can get us on the bid list, and what to do next. Everything here reads the same records
   as the rest of Outreach. Honesty rules: a permit stage is not a bid status; a scope keyword in the permit text is
   "in the permit", anything we infer from the project type is only a "possible fit"; a firm's main number is the office
   switchboard, never someone's direct line; a guessed email is never shown as verified; "principal" makes someone a
   likely contact, not a confirmed bid contact. Owners stay excluded, warm holds and sending limits stay as they are. */
var OX_SCOPE_KW = [["grading", /grading|\bgrade\b|earthwork|cut and fill|\b\d[\d,]*\s*cy\b|cubic yards?/i], ["drainage", /drainage|\bdrain|storm ?water|bioretention|detention|swale/i],
  ["paving and driveways", /paving|pavers?\b|driveway|asphalt|flatwork/i], ["retaining walls", /retaining|soil nail|shoring wall/i], ["planting", /planting|landscap|\btrees? (planting|replacement)|hedge/i],
  ["irrigation", /irrigation|mwelo|water.efficient landscape/i], ["pool and spa decks", /\bpools?\b|\bspa\b/i], ["patios and outdoor living", /hardscape|patio|terrace|trellis|pergola|outdoor kitchen|fire ?pit|deck\b/i],
  ["site improvements", /site improvements?|site ?work|site development|utilities|trench/i]];
var OX_SCOPE_BY_TYPE = { new_home: ["grading", "drainage", "paving and driveways", "planting", "irrigation"], major_remodel: ["patios and outdoor living", "planting", "irrigation", "drainage"],
  landscape: ["planting", "irrigation", "patios and outdoor living"], grading: ["grading", "drainage", "retaining walls"], pool: ["pool and spa decks", "patios and outdoor living"] };
var OX_STAGE_TXT = { "1": "Design review (early)", "2": "Permits in review", "3": "Planning approved", "4": "Permits issued", "5": "Finaled (built)" };
var OX_BID_TXT = { unknown: "Unknown: call to confirm", open: "Confirmed open", invited: "Invited", closed: "Already awarded or closed" };
var OX_ROLE_TXT = { architect: "Architect", landscape_architect: "Landscape architect", contractor: "Builder / GC", engineer: "Engineer", applicant: "Applicant" };
function oxScopeOf(p) {
  var text = [p.description, p.other_types, p.type].join(" "), conf = [], poss = [];
  OX_SCOPE_KW.forEach(function (k) { if (k[1].test(text)) conf.push(k[0]); });
  (OX_SCOPE_BY_TYPE[p.type] || ["site improvements"]).forEach(function (k) { if (conf.indexOf(k) < 0) poss.push(k); });
  return { confirmed: conf, possible: poss };
}
var OX_TRACK_TXT = { prospect: "Collecting prices (not invited yet)", invited: "Invited", plans: "Plans in", site_walk: "Site walk", bid_sent: "Bid sent", won: "Won", lost: "Lost / passed" };
var OX_DOW = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"], OX_MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
function oxShortDay(d) { var x = new Date(oxDayMs(d)); return isNaN(x) ? String(d || "") : OX_DOW[x.getDay()] + " " + OX_MON[x.getMonth()] + " " + x.getDate(); }
function oxTrackOut(o) {
  var f = findBy("OxFirms", "id", o.firm_id) || {}, c = o.contact_id ? findBy("OxContacts", "id", o.contact_id) : null;
  return { id: o.id, project_id: o.project_id, firm_id: o.firm_id, firm: f.name || "", scope: o.scope || "", stage: o.stage, label: OX_TRACK_TXT[o.stage] || o.stage, active: ["won", "lost"].indexOf(o.stage) < 0, due: o.due || "", plans_url: o.plans_url || "",
    contact: c ? { id: c.id, name: c.name || "", title: c.role || "", email: c.email || "", phone: oxPhoneOk(c.phone) ? oxPhoneFmt(c.phone) : "" } : null, next_step: o.next_step || "", next_date: o.next_date || "",
    referred_by: o.referred_by || "", assignee: o.assignee ? personName(o.assignee) : "", lost_note: o.lost_note || "", handoff_to: o.handoff_to ? personName(o.handoff_to) : "", handoff_at: String(o.handoff_at || "").slice(0, 10), notes: o.notes || "", amount: o.amount || "",
    missing: [!o.plans_url ? "plans" : "", !o.due ? "due date" : "", !o.scope ? "scope" : ""].filter(Boolean) };
}
/* The property's bid picture, built from every buyer's track: one builder passing never closes a job another builder still wants priced. */
function oxBidOf(p, opps) {
  var tr = opps.filter(function (x) { return x.project_id === p.id; }), act = tr.filter(function (x) { return ["won", "lost"].indexOf(x.stage) < 0; }), inv = act.filter(function (x) { return x.stage !== "prospect"; });
  var due = act.map(function (x) { return x.due; }).filter(Boolean).sort()[0] || "", n = function (k, w) { return k + " " + w + (k === 1 ? "" : "s"); };
  var base = { tracks: tr.map(oxTrackOut), due: due, by: "", at: "", note: "" };
  if (inv.length) return Object.assign(base, { status: "invited", label: n(inv.length, "active invitation") + (due ? " · due " + oxShortDay(due) : "") });
  if (act.length) return Object.assign(base, { status: "open", label: n(act.length, "buyer") + " collecting prices" + (due ? " · due " + oxShortDay(due) : "") });
  if (tr.some(function (x) { return x.stage === "won"; })) return Object.assign(base, { status: "closed", label: "We won it" });
  if (p.bid_status === "closed" || p.bid_status === "open") return Object.assign(base, { status: p.bid_status, label: OX_BID_TXT[p.bid_status], by: p.bid_by ? personName(p.bid_by) : "", at: String(p.bid_at || "").slice(0, 10), due: p.bid_due || "", note: p.bid_note || "" });
  if (tr.length) return Object.assign(base, { status: "unknown", label: n(tr.length, "buyer") + " passed · others unknown" });
  return Object.assign(base, { status: "unknown", label: OX_BID_TXT.unknown });
}
/* What to do next with one buyer's track: a promised callback first, then what an invitation still lacks. */
function oxTrackAction(o, f, c) {
  var ct = o.contact_id ? ((c.cs[f.id] || []).filter(function (k) { return k.id === o.contact_id; })[0] || null) : null, today = c.today, nm = ct && ct.name ? oxTitle(oxNorm(ct.name).split(" ")[0]) : "";
  var ph = ct && oxPhoneOk(ct.phone) ? oxPhoneFmt(ct.phone) : oxPhoneOk(f.phone) ? oxPhoneFmt(f.phone) : "", em = ct ? oxEmailInfo(ct) : null, who = nm ? nm + (ct.role ? " (" + ct.role + ", " + f.name + ")" : " (" + f.name + ")") : f.name;
  var scope = o.scope ? o.scope : "our", miss = [!o.plans_url ? "the plans" : "", !o.due ? "the due date" : ""].filter(Boolean);
  if (o.next_date && o.next_date <= today && ph && !oxFlags(f).noCall) return { kind: "call", label: "Call " + who + (o.next_date === today ? ": callback today" : ": callback was due " + oxShortDay(o.next_date)), contact_id: ct ? ct.id : "", phone: ph, opp_id: o.id };
  if (o.stage !== "prospect" && em && em.kind !== "inbox") return { kind: "email", label: "Email " + who + ": invited us" + (miss.length ? ", ask for " + miss.join(" and ") : " (" + scope + " price)"), contact_id: ct.id, step: "invited", opp_id: o.id };
  if (o.stage === "prospect" && ph && !oxFlags(f).noCall) return { kind: "call", label: "Call " + who + ": collecting " + scope + " prices", contact_id: ct ? ct.id : "", phone: ph, opp_id: o.id };
  if (em && em.kind !== "inbox") return { kind: "email", label: "Email " + who + " about the " + scope + " price", contact_id: ct.id, step: "invited", opp_id: o.id };
  return c.act[f.id];
}
function oxNeedLine(need, seed) {
  var L = { plans: "send the current plan set", due: "confirm the bid due date", scope: "let me know which parts of the exterior work you'd like us to price" }, it = need.map(function (k) { return L[k]; }).filter(Boolean);
  if (!it.length) return oxPick(["We're on it and will have our number to you before the due date.", "We'll have our number to you before the due date. Let me know if anything changes on the plans."], seed, "need0");
  var list = it.length === 1 ? it[0] : it.slice(0, -1).join(", ") + " and " + it[it.length - 1];
  return oxPick(["Could you " + list + "?", "When you get a chance, could you " + list + "?"], seed, "need");
}
function oxSources(p) {
  return String(p.source_url || "").split(/\s*;\s*|\s+\|\s+/).map(function (part) {
    var m = String(part).trim().match(/^(https?:\/\/[^\s]+)\s*(.*)$/); if (!m) return null;
    var url = m[1], host = url.replace(/^https?:\/\//i, "").split("/")[0].replace(/^www\./i, "");
    var label = /etrakit|csqrcloud|accela|citizenaccess|permit/i.test(url) ? "Permit search · " + host : /agenda|minutes|hearing/i.test(url) ? "Meeting agenda · " + host : host;
    return { url: url, label: label, hint: m[2].replace(/[()]/g, "").replace(/PERMIT_NUMBER/, "the permit number").trim() };
  }).filter(Boolean);
}
var OX_SRC_TXT = { gmail: "your Gmail", website: "their website", rocketreach: "RocketReach", import: "the research file", manual: "added by hand", told: "the firm told us", setter: "the setter's call", guessed: "the firm's email format" };
function oxEmailInfo(c) {
  if (!c.email) return null; var lp = String(c.email).split("@")[0], src = OX_SRC_TXT[c.source] || c.source || "unknown";
  var kind = OX_GENERIC.test(lp) || /general inbox/i.test(c.role || "") ? "inbox" : c.source === "guessed" ? "guessed" : "work";
  return { addr: c.email, kind: kind, label: { inbox: "General inbox", guessed: "Guessed email (not verified)", work: "Direct work email" }[kind], source: src, verified: c.verified === "yes" && kind !== "guessed",
    date: String(c.updated_at || c.created_at || "").slice(0, 10) };
}
function oxPhoneInfo(c, f) {
  if (!oxPhoneOk(c.phone)) return null; var d = String(c.phone).replace(/\D/g, "").slice(-10), office = String(f.phone || "").replace(/\D/g, "").slice(-10);
  var typed = String(c.phones || "").split(/,\s*/).filter(function (x) { return x.replace(/\D/g, "").slice(-10) === d; })[0] || "", ty = (typed.match(/\(([a-z ]+)\)/) || [])[1] || "";
  var kind = d === office || /office|main|switchboard|hq/.test(ty) ? "switchboard" : /mobile|cell/.test(ty) ? "mobile" : c.source === "told" ? "verified" : c.source === "rocketreach" || c.source === "setter" || /direct/.test(ty) ? "direct" : "unconfirmed";
  return { num: oxPhoneFmt(c.phone), kind: kind, label: { switchboard: "Office switchboard", mobile: "Mobile", direct: "Direct business phone", verified: "Verified phone (the firm told us)", unconfirmed: "Phone on file (not confirmed direct)" }[kind], source: OX_SRC_TXT[c.source] || c.source || "" };
}
function oxRelation(c) {
  if (isTrue(c.bid_contact)) return { kind: "confirmed", label: "Confirmed bid contact" };
  if (OX_DM.test(c.role || "") || OX_DM2.test(c.role || "")) return { kind: "likely", label: "Likely contact" + (c.role ? " (" + c.role + ")" : "") };
  return { kind: "refer", label: "Can refer us" };
}
/* What the evidence lets us do with one firm right now (the project's warm hold is checked by the caller). */
function oxFirmAction(f, cs, st, me) {
  var fl = oxFlags(f), s = st || {}, named = cs.filter(function (c) { return c.name && !/general inbox/i.test(c.role || ""); });
  var rank = function (a, b) { return (isTrue(b.bid_contact) ? 1 : 0) - (isTrue(a.bid_contact) ? 1 : 0) || oxDmRank(a) - oxDmRank(b); };
  if (fl.excluded) return { kind: "none", label: "No outreach (excluded)" };
  if (fl.individual) return { kind: "confirm", label: "Confirm they're a pro, not the owner" };
  var work = named.filter(function (c) { var e = oxEmailInfo(c); return e && e.kind === "work"; }).sort(rank)[0];
  var guess = named.filter(function (c) { var e = oxEmailInfo(c); return e && e.kind === "guessed"; }).sort(rank)[0];
  var direct = named.filter(function (c) { var ph = oxPhoneInfo(c, f); return ph && (ph.kind === "direct" || ph.kind === "mobile" || ph.kind === "verified"); }).sort(rank)[0];
  var who = named.slice().sort(rank)[0] || null, office = oxPhoneOk(f.phone) ? oxPhoneFmt(f.phone) : "";
  var inbox = cs.filter(function (c) { var e = oxEmailInfo(c); return e && e.kind === "inbox"; })[0];
  var nm = function (c) { return oxTitle(oxNorm(c.name).split(" ")[0]); };
  // every way we could reach them: the button follows the best evidence, the other channel stays one tap away
  var strong = !work ? null : s.replied ? { kind: "email", label: "Email " + nm(work) + " (ask for the plans)", contact_id: work.id, step: "reply" }
    : { kind: "email", label: (s.emailed ? "Write follow-up to " : "Draft email to ") + nm(work), contact_id: work.id, step: s.emailed ? "day14" : "day0" };
  var guessed = guess ? { kind: "email", label: "Email " + nm(guess) + " (guessed address)", contact_id: guess.id, step: s.replied ? "reply" : s.emailed ? "day14" : "day0" } : null;
  var askBox = inbox ? { kind: "ask", label: "Ask who handles bids", contact_id: inbox.id, step: s.emailed ? "again" : "day0" } : null;
  var callNamed = fl.noCall ? null : direct ? { kind: "call", label: "Call " + nm(direct), contact_id: direct.id, phone: oxPhoneInfo(direct, f).num } : office && who ? { kind: "call", label: "Call office · ask for " + nm(who), contact_id: who.id, phone: office } : null;
  var anon = fl.noCall || !office || who ? null : { kind: "call", label: "Call office · ask who handles bids", contact_id: "", phone: office };
  var best = s.replied ? strong || callNamed || anon || { kind: "log", label: "They replied: log the next step" } : strong || callNamed || askBox || anon || { kind: "find", label: "Find contact" };
  // the button follows the best evidence; the other channel (call or email) stays one tap away
  var mail = strong || askBox || guessed, phone = callNamed || anon;
  var other = [mail, phone].filter(function (x) { return x && x !== best && !(best.kind === x.kind && best.contact_id === x.contact_id); });
  return Object.assign({}, best, { alt: other });
}
var OX_ACT_RANK = { email: 0, call: 1, ask: 2, log: 3, link: 4, wait: 4, find: 5, confirm: 6, none: 9 };
var OX_ROLE_PREF = { landscape_architect: 0, architect: 1, contractor: 2, applicant: 3, engineer: 4 };
function oxCtx(today) {
  var c = { today: today, firms: {}, cs: {}, roles: {}, opps: rows("OxOpps"), touches: {}, st: {} }, firms = rows("OxFirms");
  firms.forEach(function (f) { c.firms[f.id] = f; });
  rows("OxContacts").forEach(function (x) { (c.cs[x.firm_id] = c.cs[x.firm_id] || []).push(x); });
  rows("OxRoles").forEach(function (x) { (c.roles[x.project_id] = c.roles[x.project_id] || []).push(x); });
  rows("OxTouches").forEach(function (x) { (c.touches[x.firm_id] = c.touches[x.firm_id] || []).push(x); });
  firms.forEach(function (f) { c.st[f.id] = oxState(f, c.touches[f.id] || [], today); });
  c.block = oxBlocks(firms, rows("OxRoles"), c.st, today); c.act = {}; c.oppsBy = {};
  c.opps.forEach(function (o) { (c.oppsBy[o.project_id] = c.oppsBy[o.project_id] || []).push(o); });
  firms.forEach(function (f) { c.act[f.id] = oxFirmAction(f, c.cs[f.id] || [], c.st[f.id]); });
  return c;
}
/* The firms on a project (each once, with every role it has there) and the one to approach first. */
function oxProjFirms(p, c) {
  var by = {}, order = [], tr = (c.oppsBy && c.oppsBy[p.id]) || [];
  (c.roles[p.id] || []).forEach(function (r) { if (r.role === "owner" || !r.firm_id || !c.firms[r.firm_id]) return; if (!by[r.firm_id]) { by[r.firm_id] = []; order.push(r.firm_id); } if (by[r.firm_id].indexOf(r.role) < 0) by[r.firm_id].push(r.role); });
  return order.map(function (fid) {
    var f = c.firms[fid], hold = c.block[fid], mine = tr.filter(function (o) { return o.firm_id === fid; }), live = mine.filter(function (o) { return ["won", "lost"].indexOf(o.stage) < 0; })[0];
    var held = hold && (hold.all || hold.held.indexOf(p.id) > -1) && !live, act = live ? oxTrackAction(live, f, c) : mine.length && !live ? { kind: "log", label: "Lost this job / passed" + (mine[0].lost_note && mine[0].lost_note !== "Passed" ? ": " + mine[0].lost_note : "") } : held ? { kind: "wait", label: "Waits for " + hold.waiting_on.join(", ") + " (warm, same project)" } : c.act[fid];
    var cs = c.cs[fid] || [], trk = live ? (live.stage === "prospect" ? 1 : 0) : mine.length ? 4 : 2;      // invited > collecting prices > nothing yet > passed on this job
    return { f: f, roles: by[fid], act: act, track: trk, buyer: cs.some(function (k) { return isTrue(k.bid_contact); }) ? 0 : 1, pref: Math.min.apply(null, by[fid].map(function (r) { return r in OX_ROLE_PREF ? OX_ROLE_PREF[r] : 5; })) };
  }).sort(function (a, b) { var ra = a.act.kind in OX_ACT_RANK ? OX_ACT_RANK[a.act.kind] : 5, rb = b.act.kind in OX_ACT_RANK ? OX_ACT_RANK[b.act.kind] : 5;
    return a.track - b.track || a.buyer - b.buyer || ra - rb || ({ warm: 0, known: 1 }[a.f.segment] !== undefined ? { warm: 0, known: 1 }[a.f.segment] : 2) - ({ warm: 0, known: 1 }[b.f.segment] !== undefined ? { warm: 0, known: 1 }[b.f.segment] : 2) || a.pref - b.pref; });
}
function oxUnlinked(p, c) { return (c.roles[p.id] || []).filter(function (r) { return r.role !== "owner" && !r.firm_id && String(r.raw || "").trim().length > 2; }).map(function (r) { return { role_id: r.id, raw: r.raw, role: OX_ROLE_TXT[r.role] || r.role, source: r.source === "manual" ? "added by hand" : "the permit" }; }); }
function oxProjAct(p, c) {
  var fs = oxProjFirms(p, c), lead = fs.filter(function (x) { return x.act.kind !== "none"; })[0], un = oxUnlinked(p, c);
  if (!lead && un.length) return { kind: "link", label: "Link firm: " + un[0].raw + " (" + un[0].role.toLowerCase() + ")", role_id: un[0].role_id, firm_id: "" };   // the permit already names someone: don't research from scratch
  if (!fs.length) return { kind: "find", label: "Find who's on it", firm_id: "" };
  if (!lead) return { kind: "none", label: "No outreach (excluded firms only)", firm_id: "" };
  var who = lead.act.contact_id ? ((c.cs[lead.f.id] || []).filter(function (k) { return k.id === lead.act.contact_id; })[0] || null) : null;
  return Object.assign({ firm_id: lead.f.id, firm: lead.f.name, who: who && who.name && !/general inbox/i.test(who.role || "") ? { name: who.name, title: who.role || "", rel: oxRelation(who).kind } : null }, lead.act);
}
function oxWeekStart(today) { return oxAdd(today, -((oxDow(today) + 6) % 7)); }
/* Which projects to pursue first: early stage, our kind of work, fresh, a firm we can reach, nothing closed. */
function oxProjScore(p, a, bid, today) {
  if (p.stage === "5" || bid.status === "closed" || a.kind === "none") return -999;
  var s = { A: 30, B: 15, C: 0 }[p.priority] || 0; s += { new_home: 20, landscape: 18, major_remodel: 15, grading: 12, pool: 8 }[p.type] || 0;
  var age = (oxDayMs(today) - oxDayMs(String(p.date).slice(0, 10))) / 864e5; if (age < 31) s += 15; else if (age < 61) s += 8; else if (age > 365) s -= 10;
  s += { "1": 12, "2": 10, "3": 12, "4": /landscape|pool/.test(p.type) ? 8 : 2 }[p.stage] || 0; s += Number(p.fit) >= 88 ? 10 : Number(p.fit) >= 70 ? 5 : 0;
  s += { email: 12, call: 10, ask: 6, log: 8, link: 2, wait: -5, find: -8, confirm: -10 }[a.kind] || 0; s += bid.status === "open" ? 25 : bid.status === "invited" ? 15 : 0;
  return s;
}
function oxBrief(p, c, me) {
  var fs = oxProjFirms(p, c), act = oxProjAct(p, c), bid = oxBidOf(p, c.opps), sc = oxScopeOf(p), people = {};
  rows("People").forEach(function (x) { people[normEmail(x.email)] = x.name; });
  var firms = fs.map(function (x) {
    var f = x.f, cs = c.cs[f.id] || [], s = c.st[f.id] || {};
    return { firm_id: f.id, name: f.name, type: f.firm_type || "", segment: f.segment || "cold", roles: x.roles.map(function (r) { return OX_ROLE_TXT[r] || r; }), action: x.act, emailed: s.emailed ? s.day0 : "", replied: !!s.replied,
      office: oxPhoneOk(f.phone) ? oxPhoneFmt(f.phone) : "", website: f.website || "", assignee: f.assignee ? people[normEmail(f.assignee)] || f.assignee : "", next_step: f.next_step || "", next_date: f.next_date || "",
      people: cs.filter(function (k) { return k.name || k.email; }).map(function (k) { var e = oxEmailInfo(k), ph = oxPhoneInfo(k, f);
        return { id: k.id, name: k.name || (e && e.kind === "inbox" ? "General inbox" : ""), title: k.role || "", relation: k.name && !/general inbox/i.test(k.role || "") ? oxRelation(k) : { kind: "inbox", label: "Shared inbox" }, email: e, phone: ph, linkedin: k.linkedin || "" }; })
        .sort(function (a, b) { return ({ confirmed: 0, likely: 1, refer: 2, inbox: 3 }[a.relation.kind]) - ({ confirmed: 0, likely: 1, refer: 2, inbox: 3 }[b.relation.kind]); }) };
  });
  var lead = firms.filter(function (x) { return x.firm_id === act.firm_id; })[0], ask = lead && lead.people.filter(function (k) { return k.id === act.contact_id; })[0];
  var street = oxStreetFull(p), mine = String((me && me.name) || "").split(" ")[0] || "Jesús";
  var owners = (c.roles[p.id] || []).filter(function (r) { return r.role === "owner"; }).length;
  return { id: p.id, street: street, town: p.town, type: OX_TYPE[p.type] || p.type || "", stage: { n: p.stage || "", label: OX_STAGE_TXT[p.stage] || (p.status ? "See permit status" : "Unknown") }, bid: bid, scope: sc,
    action: act, firms: firms, owners_named: owners, unlinked: oxUnlinked(p, c), why: oxWhy(p, c),
    task: p.task_text || p.task_owner ? { owner: p.task_owner ? personName(p.task_owner) : "", owner_email: p.task_owner || "", text: p.task_text || "", date: p.task_date || "" } : null, last_seen: p.last_seen, first_seen: p.first_seen, new_week: p.first_seen >= oxWeekStart(c.today), import_id: p.import_id,
    say: { front: "Hi, this is " + mine + " with Blue Sierra Construction. " + (ask && ask.name && ask.relation.kind !== "inbox" ? "Is " + ask.name.split(" ")[0] + " in? " : "") + "It's about " + street + " in " + p.town + ".",
      ask: "Who is coordinating bids for the exterior site work on this project, and is there still time for Blue Sierra to be considered?" },
    raw: { description: p.description || "", status: p.status || "", permit_no: p.permit_no || "", date: p.date || "", fit: p.fit || "", priority: p.priority || "" }, sources: oxSources(p),
    touches: Object.keys(c.touches).reduce(function (a, k) { return a.concat(c.touches[k].filter(function (t) { return t.project_id === p.id; })); }, []).sort(function (a, b) { return a.at < b.at ? 1 : -1; }).slice(0, 12)
      .map(function (t) { return { date: t.date, channel: t.channel, outcome: t.outcome, summary: t.summary, by: personName(t.by), firm: (c.firms[t.firm_id] || {}).name || "" }; }) };
}
ACTIONS.oxBrief = function (me, b) {
  oxNeed(me); prefetch(OX_T.concat(["People"])); var p = findBy("OxProjects", "id", String(b.project_id || "")); if (!p) throw new Error("Project not found.");
  return { brief: oxBrief(p, oxCtx(oxToday()), me) };
};
NO_LOCK.oxBrief = 1;
/* What's known about bidding this project: open, invited (that's a Bids card), or closed. Who said so and when. */
ACTIONS.oxBidStatus = function (me, b) {
  oxNeed(me); var p = findBy("OxProjects", "id", String(b.project_id || "")); if (!p) throw new Error("Project not found.");
  var st = String(b.status || ""); if (!OX_BID_TXT[st]) throw new Error("Pick the bid status.");
  if (st === "invited") throw new Error("An invitation is a Bids card: use “Invited to bid”.");
  var due = /^\d{4}-\d\d-\d\d$/.test(String(b.due || "")) ? b.due : "";
  update("OxProjects", "id", p.id, { bid_status: st === "unknown" ? "" : st, bid_by: me.email, bid_at: oxStamp(), bid_due: due, bid_note: clean(b.note, 300), updated_at: now() });
  return { bid: oxBidOf(findBy("OxProjects", "id", p.id), rows("OxOpps")) };
};
/* After a call or email about a project: what happened, who on our side owns it, when to follow up, and anyone new they named. */
var OX_PROJ_OUT = { talked: "Talked", voicemail: "Left a voicemail", no_answer: "No answer", send_plans: "They'll send plans / asked for info", referred: "Referred us to who's collecting prices", open: "Bid list is open", invited: "Invited us to bid", passed: "This firm lost the job / passed", not_bidding: "Not bidding it out / closed", wrong_person: "Wrong person", note: "Note" };
ACTIONS.oxProjLog = function (me, b) {
  oxNeed(me); var p = findBy("OxProjects", "id", String(b.project_id || "")); if (!p) throw new Error("Project not found.");
  var f = findBy("OxFirms", "id", String(b.firm_id || "")); if (!f) throw new Error("Pick the firm.");
  var fl = oxFlags(f); if (fl.excluded) throw new Error(f.name + " is excluded from outreach.");
  var out = String(b.outcome || ""); if (!OX_PROJ_OUT[out]) throw new Error("Pick what happened.");
  var ch = ["call", "email", "meeting", "linkedin", "note"].indexOf(b.channel) > -1 ? b.channel : "note";
  if (ch === "call" && fl.noCall) throw new Error(f.name + " is on the do-not-call list.");
  var who = b.assignee ? findPerson(normEmail(b.assignee)) : null; if (b.assignee && (!who || !isStaff(who))) throw new Error("Pick someone on the Blue Sierra team.");
  var nd = /^\d{4}-\d\d-\d\d$/.test(String(b.next_date || "")) ? b.next_date : "", t = now(), today = oxToday(), newC = "";
  var nc = b.new_contact || null;
  if (nc && clean(nc.name, 120)) {
    var em = String(nc.email || "").trim().toLowerCase(); if (em && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(em)) throw new Error("Check the new person's email.");
    var row = { id: newId("oc"), firm_id: f.id, name: clean(nc.name, 120), role: clean(nc.role, 120), email: em, phone: oxPhoneOk(nc.phone) ? oxPhoneFmt(nc.phone) : "", linkedin: "", source: "told", verified: em ? "yes" : "no", rr_id: "", created_at: t, updated_at: t, phones: "", bid_contact: nc.handles_bids ? "yes" : "" };
    insert("OxContacts", row); newC = row.id;                                          // told to us by the firm itself: that's as verified as it gets
  }
  if (b.contact_id && b.bid_contact) { var ct = findBy("OxContacts", "id", String(b.contact_id)); if (ct && ct.firm_id === f.id) update("OxContacts", "id", ct.id, { bid_contact: "yes", updated_at: t }); }
  var touch = { id: newId("ot"), firm_id: f.id, contact_id: newC || clean(b.contact_id, 40), project_id: p.id, date: today, channel: ch, step: "", summary: (OX_PROJ_OUT[out] + (b.note ? ": " + clean(b.note, 400) : "")).slice(0, 500), outcome: out, by: me.email, at: t, outbox_id: "", thread_id: "" };
  insert("OxTouches", touch);
  var fp = { updated_at: t }; if (who) fp.assignee = who.email; if (b.next_step != null) fp.next_step = clean(b.next_step, 200); if (b.next_date != null) fp.next_date = nd;
  if (["talked", "send_plans", "open", "invited"].indexOf(out) > -1 && f.status !== "meeting") fp.status = "replied";        // a conversation stops the automatic email cadence
  update("OxFirms", "id", f.id, fp);
  var due = /^\d{4}-\d\d-\d\d$/.test(String(b.bid_due || "")) ? b.bid_due : "", scope = clean(b.scope, 60), refOut = null;
  if (["no_answer", "voicemail", "note"].indexOf(out) < 0)                               // we reached them: the promised callback on this job is done (or moved to the new date)
    rows("OxOpps").filter(function (o) { return o.project_id === p.id && o.firm_id === f.id && ["won", "lost"].indexOf(o.stage) < 0; }).forEach(function (o) { update("OxOpps", "id", o.id, { next_date: nd, next_step: b.next_step != null ? clean(b.next_step, 200) : "", updated_at: t }); });
  if (out === "referred") refOut = oxReferral(me, p, f, b.ref || {}, newC || clean(b.contact_id, 40), touch);
  if (out === "passed") { var mineT = rows("OxOpps").filter(function (o) { return o.project_id === p.id && o.firm_id === f.id && ["won", "lost"].indexOf(o.stage) < 0; });
    if (mineT.length) mineT.forEach(function (o) { update("OxOpps", "id", o.id, { stage: "lost", lost_note: clean(b.note, 300) || "Passed", updated_at: t }); });
    else insert("OxOpps", { id: newId("oo"), firm_id: f.id, project_id: p.id, stage: "lost", amount: "", due: "", notes: "", created_by: me.email, created_at: t, updated_at: t, scope: scope, contact_id: "", plans_url: "", next_step: "", next_date: "", assignee: "", referred_by: "", lost_note: clean(b.note, 300) || "Passed", handoff_to: "", handoff_at: "" }); }
  if (out === "open") update("OxProjects", "id", p.id, { bid_status: "open", bid_by: me.email, bid_at: oxStamp(), bid_due: due, bid_note: clean(b.note, 300) });
  if (out === "not_bidding") update("OxProjects", "id", p.id, { bid_status: "closed", bid_by: me.email, bid_at: oxStamp(), bid_note: clean(b.note, 300) });
  if (out === "invited") { var live = rows("OxOpps").filter(function (o) { return o.project_id === p.id && o.firm_id === f.id && ["won", "lost"].indexOf(o.stage) < 0 && (!scope || !o.scope || o.scope === scope); })[0];
    var plans = /^https?:\/\//i.test(String(b.plans_url || "")) ? clean(b.plans_url, 1000) : "";
    if (live) update("OxOpps", "id", live.id, { stage: live.stage === "prospect" ? "invited" : live.stage, due: due || live.due, scope: scope || live.scope, plans_url: plans || live.plans_url, contact_id: live.contact_id || newC || clean(b.contact_id, 40), updated_at: t });
    else insert("OxOpps", { id: newId("oo"), firm_id: f.id, project_id: p.id, stage: "invited", amount: "", due: due, notes: clean(b.note, 1000), created_by: me.email, created_at: t, updated_at: t, scope: scope, contact_id: newC || clean(b.contact_id, 40), plans_url: plans, next_step: "", next_date: "", assignee: who ? who.email : "", referred_by: "", lost_note: "", handoff_to: "", handoff_at: "" }); }
  return { touch: touch, referral: refOut, brief: oxBrief(findBy("OxProjects", "id", p.id), oxCtx(today), me) };
};
/* "I'm the architect. Ridge Builders is collecting landscape bids. Ask for Taylor in estimating and call Thursday."
   One entry: the buyer firm (picked or created) is linked to the property, Taylor is saved as the bid contact with who referred
   us, and a "collecting prices" track carries the callback, what to ask and who on our side owns it. The original call stays
   on the architect's history. */
function oxReferral(me, p, from, r, fromContactId, touch) {
  var t = now(), firm = r.firm_id ? findBy("OxFirms", "id", String(r.firm_id)) : null;
  if (!firm) { var nm = clean(r.firm_name, 120); if (!nm) throw new Error("Which firm is collecting the prices?");
    firm = rows("OxFirms").filter(function (x) { return oxNorm(x.name) === oxNorm(nm); })[0];
    if (!firm) { firm = { id: newId("of"), name: nm, norm: oxNorm(nm), firm_type: clean(r.firm_type, 60) || "Builder/GC", segment: "cold", priority: "", wave: "", channel: "", website: "", phone: oxPhoneOk(r.firm_phone) ? oxPhoneFmt(r.firm_phone) : "", flags: "", notes: "", individual: "", confirmed: "", status: "", next_step: "", next_date: "", email_source: "", created_at: t, updated_at: t, assignee: "" };
      insert("OxFirms", firm); } }
  if (oxFlags(firm).excluded) throw new Error(firm.name + " is excluded from outreach.");
  if (!rows("OxRoles").some(function (x) { return x.project_id === p.id && x.firm_id === firm.id; }))
    insert("OxRoles", { id: newId("or"), project_id: p.id, firm_id: firm.id, role: r.role && OX_ROLES.indexOf(r.role) > -1 && r.role !== "owner" ? r.role : "contractor", raw: firm.name, source: "referral" });
  var fromC = fromContactId ? findBy("OxContacts", "id", fromContactId) : null, by = (fromC && fromC.name ? fromC.name + ", " : "") + from.name;
  var ct = r.contact_id ? findBy("OxContacts", "id", String(r.contact_id)) : null; if (ct && ct.firm_id !== firm.id) ct = null;
  var pr = r.person || {};
  if (!ct && clean(pr.name, 120)) { var em = String(pr.email || "").trim().toLowerCase(); if (em && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(em)) throw new Error("Check the email of the person they named.");
    ct = { id: newId("oc"), firm_id: firm.id, name: clean(pr.name, 120), role: clean(pr.role, 120), email: em, phone: oxPhoneOk(pr.phone) ? oxPhoneFmt(pr.phone) : "", linkedin: "", source: "told", verified: em ? "yes" : "no", rr_id: "", created_at: t, updated_at: t, phones: "", bid_contact: "yes", referred_by: by };
    insert("OxContacts", ct); }
  else if (ct) update("OxContacts", "id", ct.id, { bid_contact: "yes", referred_by: ct.referred_by || by, updated_at: t });
  var asg = r.assignee ? findPerson(normEmail(r.assignee)) : null; if (r.assignee && (!asg || !isStaff(asg))) throw new Error("Pick someone on the Blue Sierra team.");
  var cb = /^\d{4}-\d\d-\d\d$/.test(String(r.callback_date || "")) ? r.callback_date : "", scope = clean(r.scope, 60), ask = clean(r.ask, 300);
  var nmF = ct && ct.name ? oxTitle(oxNorm(ct.name).split(" ")[0]) : "the estimator";
  var o = { id: newId("oo"), firm_id: firm.id, project_id: p.id, stage: "prospect", amount: "", due: /^\d{4}-\d\d-\d\d$/.test(String(r.due || "")) ? r.due : "", notes: ask, created_by: me.email, created_at: t, updated_at: t, scope: scope, contact_id: ct ? ct.id : "",
    plans_url: "", next_step: "Call " + nmF + (ask ? ": " + ask : scope ? " about the " + scope + " bid" : ""), next_date: cb, assignee: asg ? asg.email : me.email, referred_by: by, lost_note: "", handoff_to: "", handoff_at: "" };
  insert("OxOpps", o);
  insert("OxTouches", { id: newId("ot"), firm_id: firm.id, contact_id: ct ? ct.id : "", project_id: p.id, date: oxToday(), channel: "note", step: "", summary: "Referred by " + by + (scope ? " for the " + scope + " bids" : "") + (cb ? ". Call " + nmF + " " + oxShortDay(cb) : ""), outcome: "referral", by: me.email, at: t, outbox_id: "", thread_id: "" });
  update("OxTouches", "id", touch.id, { summary: ("Referred us to " + (ct && ct.name ? ct.name + " at " : "") + firm.name + (scope ? " (" + scope + ")" : "") + (touch.summary.indexOf(": ") > -1 ? touch.summary.slice(touch.summary.indexOf(": ")) : "")).slice(0, 500) });
  return { firm_id: firm.id, contact_id: ct ? ct.id : "", opp_id: o.id };
}
/* Nobody named on the permit: someone on the team takes the research, with a date. */
ACTIONS.oxProjTask = function (me, b) {
  oxNeed(me); var p = findBy("OxProjects", "id", String(b.project_id || "")); if (!p) throw new Error("Project not found.");
  var who = b.owner ? findPerson(normEmail(b.owner)) : null; if (b.owner && (!who || !isStaff(who))) throw new Error("Pick someone on the Blue Sierra team.");
  update("OxProjects", "id", p.id, { task_owner: who ? who.email : "", task_text: clean(b.text, 200), task_date: /^\d{4}-\d\d-\d\d$/.test(String(b.date || "")) ? b.date : "", updated_at: now() });
  return {};
};
/* Invited: hand it to our estimator with everything they need to price it, and say what's still missing. */
function oxHandoffSheet(o, p) {
  var tr = oxTrackOut(o), sc = oxScopeOf(p), f = findBy("OxFirms", "id", o.firm_id) || {}, pool = /\bpools?\b|\bspa\b/i.test(String(p.description || ""));
  var q = tr.missing.map(function (m) { return { plans: "Get the current plan set", "due date": "Confirm the bid due date", scope: "Confirm exactly which scope we're pricing" }[m]; });
  if (pool) q.push("Is the hardscape around the pool part of this package?");
  return { property: oxStreetFull(p) + ", " + p.town, permit: p.permit_no || "", buyer: f.name || "", contact: tr.contact, scope: tr.scope || "Not confirmed yet", permit_scope: sc.confirmed, possible: sc.possible, plans_url: tr.plans_url, due: tr.due,
    referred_by: tr.referred_by, notes: tr.notes, questions: q, stage: tr.label };
}
ACTIONS.oxHandoff = function (me, b) {
  oxNeed(me); var o = findBy("OxOpps", "id", String(b.opp_id || "")); if (!o) throw new Error("Bid not found."); if (o.stage === "prospect") throw new Error("They haven't invited us yet. Record the invitation first.");
  var to = findPerson(normEmail(b.to)); if (!to || !isStaff(to) || !isTrue(to.active)) throw new Error("Pick our estimator (someone on the team).");
  var p = findBy("OxProjects", "id", o.project_id); if (!p) throw new Error("Project not found."); var sh = oxHandoffSheet(o, p), t = now();
  update("OxOpps", "id", o.id, { handoff_to: to.email, handoff_at: t, updated_at: t });
  insert("OxTouches", { id: newId("ot"), firm_id: o.firm_id, contact_id: o.contact_id || "", project_id: p.id, date: oxToday(), channel: "note", step: "", summary: "Handed to estimating: " + to.name + (b.note ? ": " + clean(b.note, 300) : ""), outcome: "handoff", by: me.email, at: t, outbox_id: "", thread_id: "" });
  var li = function (k, v) { return v ? "<tr><td style=\"color:#77736c;padding:3px 12px 3px 0;vertical-align:top\">" + esc(k) + "</td><td style=\"padding:3px 0\">" + v + "</td></tr>" : ""; };
  safeMail(function () { sendMail(to.email, "To price: " + sh.property + " · " + sh.buyer + (sh.due ? " · due " + oxShortDay(sh.due) : ""),
    "<p>Hi " + esc(first(to.name)) + ",</p><p>" + esc(me.name) + " handed you a bid to price.</p><table style=\"border-collapse:collapse\">" +
    li("Property", esc(sh.property) + (sh.permit ? " <span style=\"color:#77736c\">(" + esc(sh.permit) + ")</span>" : "")) + li("Buyer", esc(sh.buyer) + (sh.contact ? ": " + esc(sh.contact.name) + (sh.contact.title ? ", " + esc(sh.contact.title) : "") + (sh.contact.email ? " · " + esc(sh.contact.email) : "") + (sh.contact.phone ? " · " + esc(sh.contact.phone) : "") : "")) +
    li("We're asked to price", esc(sh.scope)) + li("In the permit", esc(sh.permit_scope.join(", "))) + li("Plans", sh.plans_url ? '<a href="' + esc(sh.plans_url) + '">' + esc(sh.plans_url) + "</a>" : "Not received yet") + li("Due", sh.due ? esc(oxShortDay(sh.due)) : "Not confirmed yet") +
    li("Referred by", esc(sh.referred_by)) + li("Notes", esc([sh.notes, clean(b.note, 300)].filter(Boolean).join(" · "))) + "</table>" +
    (sh.questions.length ? "<p><b>Still open</b></p><ul>" + sh.questions.map(function (x) { return "<li>" + esc(x) + "</li>"; }).join("") + "</ul>" : "") + button("Open the portal")); }, "Handed off, but the email to the estimator couldn't be sent.");
  return { sheet: sh };
};
ACTIONS.oxHandoffSheet = function (me, b) { oxNeed(me); var o = findBy("OxOpps", "id", String(b.opp_id || "")); if (!o) throw new Error("Bid not found."); return { sheet: oxHandoffSheet(o, findBy("OxProjects", "id", o.project_id) || {}) }; };
NO_LOCK.oxHandoffSheet = 1;
/* Where to spend the next hour, in order: bid deadlines, promised callbacks, then new projects worth pursuing. One plain reason each. */
function oxWhy(p, c) {
  var rl = (c.roles[p.id] || []).filter(function (r) { return r.role !== "owner" && (r.firm_id || r.raw); }), sc = oxScopeOf(p).confirmed.filter(function (k) { return k !== "site improvements"; }).slice(0, 2);
  var who = rl.some(function (r) { return r.role === "landscape_architect"; }) ? "a landscape architect" : rl.some(function (r) { return r.role === "architect"; }) ? "an architect" : rl.some(function (r) { return r.role === "contractor"; }) ? "a builder" : rl.length ? "a professional" : "";
  var parts = []; if (who) parts.push("Permit names " + who); if (sc.length) parts.push((who ? "and " : "Permit ") + "explicitly includes " + sc.join(", "));
  var st = { "1": "early design review", "2": "permits in review", "3": "just approved" }[p.stage];
  return (parts.join(" ") || "Our kind of work") + (st ? " · " + st : "");
}
function oxAgenda(c, projects, today) {
  var pById = {}; projects.forEach(function (p) { pById[p.id] = p; }); var out = { deadlines: [], callbacks: [], fresh: [] }, seen = {};
  c.opps.forEach(function (o) { var p = pById[o.project_id], f = c.firms[o.firm_id]; if (!p || !f || ["won", "lost"].indexOf(o.stage) > -1) return; var a = oxTrackAction(o, f, c), ct = o.contact_id ? ((c.cs[f.id] || []).filter(function (k) { return k.id === o.contact_id; })[0] || {}) : {};
    var whoS = ct.name ? ct.name.split(" ")[0] + (ct.role ? " (" + ct.role + ", " + f.name + ")" : " (" + f.name + ")") : f.name;
    if (o.due && o.stage !== "won") out.deadlines.push({ project_id: p.id, firm_id: f.id, opp_id: o.id, date: o.due, street: oxStreetFull(p), town: p.town, reason: "Bid due " + oxShortDay(o.due) + ": " + whoS + " wants our " + (o.scope ? o.scope + " " : "") + "price", act: a, overdue: o.due < today });
    if (o.next_date && o.next_date <= today) { seen[f.id + "|" + p.id] = 1; out.callbacks.push({ project_id: p.id, firm_id: f.id, opp_id: o.id, date: o.next_date, street: oxStreetFull(p), town: p.town, reason: (ct.name ? whoS + " asked us to call " : "Follow up with " + f.name + " ") + (o.next_date === today ? "today" : "(was due " + oxShortDay(o.next_date) + ")") + (o.referred_by ? " · referred by " + o.referred_by : "") + (o.next_step ? " · " + o.next_step : ""), act: a, assignee: o.assignee ? personName(o.assignee) : "" }); } });
  Object.keys(c.firms).forEach(function (fid) { var f = c.firms[fid]; if (!f.next_date || f.next_date > today || !f.next_step || oxFlags(f).excluded || /^call back/i.test(f.next_step)) return;
    var t = (c.touches[fid] || []).filter(function (x) { return x.project_id; }).slice(-1)[0], p = t ? pById[t.project_id] : null; if (p && seen[fid + "|" + p.id]) return;
    out.callbacks.push({ project_id: p ? p.id : "", firm_id: fid, date: f.next_date, street: p ? oxStreetFull(p) : "", town: p ? p.town : "", reason: f.name + ": " + f.next_step + (f.next_date < today ? " (was due " + oxShortDay(f.next_date) + ")" : " (today)"), act: p ? oxProjAct(p, c) : c.act[fid], assignee: f.assignee ? personName(f.assignee) : "" }); });
  projects.forEach(function (p) { if (p.task_date && p.task_date <= today && p.task_text) out.callbacks.push({ project_id: p.id, firm_id: "", date: p.task_date, street: oxStreetFull(p), town: p.town, reason: "Research: " + p.task_text, act: { kind: "find", label: "Find who's on it" }, assignee: p.task_owner ? personName(p.task_owner) : "" }); });
  var touched = {}; Object.keys(c.touches).forEach(function (k) { c.touches[k].forEach(function (t) { if (t.project_id) touched[t.project_id] = 1; }); });
  out.fresh = projects.filter(function (p) { return !touched[p.id] && !(c.oppsBy[p.id] || []).length && p.stage !== "5"; }).map(function (p) { var a = oxProjAct(p, c), bd = oxBidOf(p, c.opps); return { p: p, a: a, s: oxProjScore(p, a, bd, today) }; })
    .filter(function (x) { return x.s > -999 && ["email", "call", "ask", "link"].indexOf(x.a.kind) > -1; }).sort(function (a, b) { return b.s - a.s; }).slice(0, 5)
    .map(function (x) { return { project_id: x.p.id, firm_id: x.a.firm_id || "", street: oxStreetFull(x.p), town: x.p.town, reason: oxWhy(x.p, c), act: x.a }; });
  out.deadlines.sort(function (a, b) { return a.date < b.date ? -1 : 1; }); out.callbacks.sort(function (a, b) { return a.date < b.date ? -1 : 1; });
  return out;
}
["oxProjTask", "oxHandoff"].forEach(function (a) { PREFETCH[a] = OX_T.concat(["People"]); });
PREFETCH.oxHandoffSheet = OX_T.concat(["People"]);
/* A first email can be prepared any day; it goes out on the next allowed day (Tue to Thu for first emails). Staff prepare, Jesús sends. */
function oxNextSendDay(step, today) { return today; }                               // Jesús sends whenever he wants; drafts are for the team to prepare
ACTIONS.oxSaveDraft = function (me, b) {
  oxNeed(me); var f = findBy("OxFirms", "id", String(b.firm_id || "")); if (!f) throw new Error("Firm not found."); if (oxFlags(f).excluded) throw new Error(f.name + " is excluded from outreach.");
  var key = String(b.key || ""); if (!/^[A-Za-z0-9_-]{8,80}$/.test(key)) throw new Error("Reload the portal and try again.");
  var to = normEmail(b.to); if (to && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(to)) throw new Error("Check the email address.");
  var step = b.step === "day14" || b.step === "again" ? b.step : "day0", subject = clean(b.subject, 160), text = clean(b.body, 3000); if (!subject || !text) throw new Error("Write a subject and a message.");
  var ct = b.contact_id ? findBy("OxContacts", "id", String(b.contact_id)) : null, sendOn = oxNextSendDay(step, oxToday());
  var data = { firm_id: f.id, contact_id: ct && ct.firm_id === f.id ? ct.id : "", project_id: clean(b.project_id, 40), step: step, to: to, subject: subject, body: text, status: "draft", send_on: sendOn };
  var old = findBy("OxOutbox", "key", key); if (old && old.status === "sent") throw new Error("That one was already sent.");
  if (old) update("OxOutbox", "id", old.id, data); else insert("OxOutbox", Object.assign({ id: newId("ob"), key: key, msg_id: "", thread_id: "", error: "", created_by: me.email, created_at: oxStamp(), sent_at: "" }, data));
  return { key: key, send_on: sendOn };
};
ACTIONS.oxDropDraft = function (me, b) { oxNeed(me); removeWhere("OxOutbox", function (m) { return m.key === String(b.key || "") && m.status === "draft"; }); return {}; };
["oxBidStatus", "oxProjLog", "oxSaveDraft", "oxDropDraft"].forEach(function (a) { PREFETCH[a] = OX_T.concat(["People"]); });
PREFETCH.oxBrief = OX_T.concat(["People"]);
