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
  "owner", "first_seen", "last_seen", "import_id", "updated_at", "zone", "sub_area", "stage", "fit", "reach", "bid_status", "bid_by", "bid_at", "bid_due", "bid_note", "task_owner", "task_text", "task_date", "reached_at", "reached_by"];
TABLES.OxFirms = ["id", "name", "norm", "firm_type", "segment", "priority", "wave", "channel", "website", "phone", "flags", "notes", "individual", "confirmed",
  "status", "next_step", "next_date", "email_source", "created_at", "updated_at", "assignee"];
TABLES.OxContacts = ["id", "firm_id", "name", "role", "email", "phone", "linkedin", "source", "verified", "rr_id", "created_at", "updated_at", "phones", "bid_contact", "referred_by"];
TABLES.OxRoles = ["id", "project_id", "firm_id", "role", "raw", "source"];
TABLES.OxTouches = ["id", "firm_id", "contact_id", "project_id", "date", "channel", "step", "summary", "outcome", "by", "at", "outbox_id", "thread_id", "rc_session", "rc_to", "rc_at", "rc_secs", "rc_rec"];
TABLES.OxOutbox = ["id", "key", "firm_id", "contact_id", "project_id", "step", "to", "subject", "body", "status", "msg_id", "thread_id", "error", "created_by", "created_at", "sent_at", "send_on"];
TABLES.OxOpps = ["id", "firm_id", "project_id", "stage", "amount", "due", "notes", "created_by", "created_at", "updated_at", "scope", "contact_id", "plans_url", "next_step", "next_date", "assignee", "referred_by", "lost_note", "handoff_to", "handoff_at"];
TABLES.OxEnrich = ["id", "firm_id", "person", "rr_id", "status", "result", "at", "by", "goal"];
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
function oxFindFirm(firms, raw, inner) {
  var n = oxNorm(String(raw).replace(/\s+-\s+.*$/, "")); if (!n || (inner && n.length < 6)) return null;
  var hit = firms.filter(function (f) { return f.norm === n; })[0]; if (hit) return hit;
  hit = firms.filter(function (f) { return f.norm.length >= 6 && (n.indexOf(f.norm) === 0 || f.norm.indexOf(n) === 0); })[0];
  if (hit || inner) return hit || null;
  var parts = oxSplitRaw(raw); if (parts.length < 2) return null;                  // "Pete Mason, Mason Architects": try each part, the firm-like one first
  parts.sort(function (a, b) { return (oxFirmish(b) ? 1 : 0) - (oxFirmish(a) ? 1 : 0); });
  for (var i = 0; i < parts.length; i++) { hit = oxFindFirm(firms, parts[i], true); if (hit) return hit; }
  return null;
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
      o.score = oxProjScore(p, a, bd, today); o.contacted = oxContacted(p, cx); o.reached = oxReached(p, cx, a); return o; }),
    priority: (function () { var top = projects.map(function (p) { return { p: p, s: oxProjScore(p, oxProjAct(p, cx), oxBidOf(p, opps), today) }; }).filter(function (x) { return x.s > -999; }).sort(function (a, b) { return b.s - a.s; }).slice(0, 12);
      return top.map(function (x) { return oxBrief(x.p, cx, me); }); })(),
    tracked: { towns: projects.map(function (p) { return p.town; }).filter(function (x, i, l) { return x && l.indexOf(x) === i; }).sort(), week_start: oxWeekStart(today),
      reachable: projects.filter(function (p) { return ["email", "call", "ask", "log"].indexOf(oxProjAct(p, cx).kind) > -1 && p.stage !== "5"; }).length },
    agenda: oxAgenda(cx, projects, today), tracks: opps.map(oxTrackOut),
    drafts: rows("OxOutbox").filter(function (m) { return m.status === "draft"; }).map(function (m) { return { key: m.key, firm_id: m.firm_id, contact_id: m.contact_id, project_id: m.project_id, step: m.step, to: m.to, subject: m.subject, body: m.body, send_on: m.send_on, by: personName(m.created_by) }; }),
    team: rows("People").filter(function (x) { return isStaff(x) && isTrue(x.active); }).map(function (x) { return { email: x.email, name: x.name }; }),
    firms: firms.map(function (f) { var fl = oxFlags(f), s = st[f.id]; return Object.assign({}, f, { flag: fl, state: s.state, emailed: s.emailed, emailed_on: s.day0, replied: s.replied, last: s.last, due: s.due, blocked: block[f.id] || null,
      projects: roles.filter(function (x) { return x.firm_id === f.id && x.role !== "owner"; }).map(function (x) { return x.project_id; }).filter(function (x, i, l) { return l.indexOf(x) === i; }).length,
      act: cx.act[f.id] }); }),
    contacts: contacts, roles: roles, opps: opps, alerts: rows("OxAlerts").filter(function (a) { return a.status === "open"; }),
    touches: touches.slice(-1500).map(function (x) { var o = Object.assign({}, x); var p = people[normEmail(x.by)]; o.by_name = p ? p.name : x.by; o.by_avatar = p ? p.avatar : ""; o.by_key = p ? p.key : ""; return o; }),
    rr: oxRrInfo(), ai: { on: !!aiKey() }, city: oxCityHome(), sig: oxSig(), last_import: (rows("OxImports").slice(-1)[0] || null), calls: oxCallsHome(today) };
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
  var anyEm = em || list.filter(function (x) { return x.channel === "email" && x.outcome !== "draft"; }).sort(function (a, b) { return a.date < b.date ? -1 : 1; })[0];
  var o = { emailed: !!anyEm, replied: replied, last: last ? { date: last.date, channel: last.channel } : null, day0: anyEm ? anyEm.date : "", due: null, state: replied ? "replied" : f.status === "closed" ? "closed" : em ? "in_cadence" : "new" };
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
/* Our licenses, said the way that fits the job: Class A (general engineering) + C-27 (landscaping). A new home (or a big
   remodel, or grading) → we can take the whole site development, foundations included; landscape → the full landscape and
   hardscape package; a pool → the grading, drainage and hardscape around it. */
var OX_LIC = "Class A (general engineering) and C-27 (landscaping)";
function oxLicKind(p) { var t = [p.type].concat(String(p.other_types || "").split(/\s*[;,]\s*/)).join(" ");
  return p.type === "landscape" ? "landscape" : p.type === "pool" ? "pool" : /new_home|major_remodel|grading/.test(t) || !p.type ? "site" : /landscape/.test(t) ? "landscape" : "site"; }
var OX_LIC_SAY = {
  site: ["We hold a Class A general engineering license and a C-27, so we can take the site development from grading, drainage, utilities and foundations through the hardscape and landscape.",
    "With our Class A and C-27 licenses we can handle the site development on a new home, from grading, utilities and foundations to the hardscape and landscape.",
    "We're licensed Class A and C-27, so the site development (grading, drainage, utilities, foundations) and the hardscape and landscape can all sit with one contractor."],
  landscape: ["As a licensed C-27 landscape contractor (we also hold a Class A), we handle the full landscape and hardscape package, drainage and irrigation included.",
    "We're a C-27 landscape contractor with a Class A license too, so the whole landscape and hardscape package, drainage and irrigation included, can sit with us.",
    "With our C-27 and Class A licenses we take the full landscape and hardscape scope, from drainage and irrigation to the planting."],
  pool: ["With our Class A and C-27 licenses we can do the grading, drainage and hardscape around the pool along with the landscape.",
    "We're licensed Class A and C-27, so the grading, drainage and hardscape around the pool and the landscape can all be one package."]
};
function oxLicLine(p, seed) { return oxPick(OX_LIC_SAY[oxLicKind(p)], seed, "lic"); }
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
  if (step === "ask") { wk = v.work ? oxWorkLine(v.town, seed) : ""; parts = [pk("open"), pk("inbox"), v.pool ? pk("poolq") : "", v.lic || (wk ? "" : pk("pitch")), pk("close")]; }
  else if (step === "reply") parts = [pk("thanks"), pk("plans"), v.pool ? pk("poolq") : "", pk("close")];          // after a conversation: ask for the plans
  else if (step === "invited") parts = [pk("thanksinv"), oxNeedLine(v.need || [], seed), v.pool ? pk("poolq") : "", pk("close")];             // a general inbox: one practical question
  else if (step === "day14") parts = [oxPick(OX_BANK.open.slice(0, 4).concat(["", "", "", ""]), seed, "o14"), pk("follow"), pk("followAsk"), pk("close")];
  else if (step === "again") parts = [pk("open"), pk("again"), oxFill(pk("ask"), { scope: v.scope, either: "" }), pk("close")];   // they've heard from us: no license pitch again
  else { wk = v.work ? oxWorkLine(v.town, seed) : "";                                 // new firms: a few real projects from our portfolio, with a link (its own short paragraph)
    parts = [pk("open"), v.familiar ? pk("known") : v.cold && !wk && !v.lic ? pk("intro") : "", v.b ? pk("two") : pk("one"), v.familiar ? "" : v.lic, pk("ask"), pk("close")]; }
  var text = parts.filter(Boolean).map(function (x) { return oxFill(x, v); }).join(" ").replace(/\s+/g, " ").trim();
  return hi + "\n\n" + text + (wk ? "\n\n" + wk : "");
}
/* The setter may only prepare a follow-up after a call ("reply"), to a firm on their call list; Jesús sends it. */
function oxSetterFollowOk(me, f, step) {
  if (!me || me.role !== "setter") return false;
  if (step !== "reply") throw new Error("You only write follow-ups after a call. Jesús sends the first emails.");
  var fl = oxFlags(f); if (fl.excluded || fl.individual || fl.noCall || oxJesusOwn(f)) throw new Error("Jesús handles " + f.name + " himself.");
  return true;
}
ACTIONS.oxDraft = function (me, b) {
  var f0 = findBy("OxFirms", "id", String(b.firm_id || "")); if (!(f0 && oxSetterFollowOk(me, f0, b.step))) oxNeed(me);
  var f = f0; if (!f) throw new Error("Firm not found.");
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
    addrA: oxStreetFull(p), scope: oxScope(p), either: q ? " on either one" : "", lic: oxLicLine(p, f.id + "|" + p.id), pool: /\bpools?\b|\bspa\b/i.test(String(p.description || "") + " " + String(p.other_types || "")) };
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
    already: oxAlready(f.id, ct ? ct.email : ""), history: conv.slice(-4).reverse().map(function (m) { return { date: String(m.sent_at).slice(0, 10), subject: m.subject, to: m.to, step: m.step }; }).concat(rows("OxTouches").filter(function (t) { return t.firm_id === f.id && t.project_id === p.id && t.channel !== "email"; }).slice(-4).reverse().map(function (t) { return { date: t.date, subject: t.summary, to: "", step: t.channel }; })), also: q ? { id: q.id, street: oxStreetFull(q), town: q.town } : null, step: step, notes: f.notes || "", flags: oxFlags(f), waiting: hold && hold.held.indexOf(p.id) > -1 ? hold.waiting_on : null };
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
    "- Use only the facts given. Do not claim past work together, awards or years in business. Never mention the property owner.",
    "- Licenses: Blue Sierra holds the licenses in blue_sierra_licenses. When license_angle is given, mention them once, in one short clause that fits it: \"site\" means a new home or big remodel, so say we can take the site development (grading, drainage, utilities, foundations) through hardscape and landscape; \"landscape\" means the full landscape and hardscape package (drainage, irrigation, planting); \"pool\" means the grading, drainage and hardscape around the pool plus the landscape. Never list other license classes.",
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
    blue_sierra_does: "site work (grading, drainage, utilities, foundations), hardscape and landscape", blue_sierra_licenses: OX_LIC, license_angle: base.step === "day14" || base.step === "again" || (f.segment === "warm" || f.segment === "known") ? null : oxLicKind(p), subject_to_keep: base.step === "day14" ? base.subject : null };
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
  var dup = oxAlready(f.id, to).filter(function (x) { return x.dir === "sent" && x.same && oxDaysBetween(x.date, today) <= 14; })[0];
  if (dup && !b.repeat && !done) throw new Error("ALREADY: You already emailed " + to + " on " + dup.date + (dup.gmail ? " (from your Gmail)" : "") + ": “" + dup.subject + "”. Send this one too?");
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
ACTIONS.oxCheckReplies = function (me, b) { oxNeed(me); return { found: oxCheckReplies(me, !!(b && b.force)) }; };
/* Jesús's own Gmail (the last 12 months): what he already sent to a firm's people from Gmail, outside the portal, and
   what they wrote. Each becomes a touch, so the firm shows ✅ and the portal never offers a second "first email".
   - one touch per thread and direction (sent / they wrote); threads the portal sent are already known
   - a project is linked only when the subject or text names its street (number + street name)
   - a recent first email (≤ 30 days) starts the normal cadence; older ones only mark "already emailed"
   It runs in the background at most every 3 hours, in slices of ~20 seconds (it continues on the next run). */
var OX_GSYNC_DAYS = 365, OX_GSYNC_CADENCE = 30;
function oxDaysBetween(a, b) { return Math.round((new Date(b + "T12:00:00") - new Date(a + "T12:00:00")) / 864e5); }
function oxStreetKey(p) { var m = String(oxStreetFull(p) || "").toLowerCase().match(/^(\d+[a-z]?)\s+([a-z]+)/); return m ? new RegExp("\\b" + m[1] + "\\s+" + m[2] + "\\b", "i") : null; }
function oxGmailTargets() {
  var firms = rows("OxFirms").filter(function (f) { return !oxFlags(f).excluded && f.status !== "removed"; }), byId = {}, dom = {}, addr = {};
  firms.forEach(function (f) { byId[f.id] = f; var d = oxDomain(f); if (d && !OX_MAILBOX.test(d) && !/bluesierracorp\.com$/.test(d)) dom[d] = f.id; });
  rows("OxContacts").forEach(function (c) { var f = byId[c.firm_id], e = normEmail(c.email || ""), d = e.split("@")[1] || ""; if (!f || !e || !d || /bluesierracorp\.com$/.test(d)) return;
    if (OX_MAILBOX.test(d)) addr[e] = f.id; else if (!dom[d]) dom[d] = f.id; });
  return { byId: byId, dom: dom, addr: addr, terms: Object.keys(dom).sort().concat(Object.keys(addr).sort()) };
}
function oxGmailSync(me, force) {
  var c = CacheService.getScriptCache(), pr = PropertiesService.getScriptProperties();
  if (!force && c.get("oxgsync")) return { done: true, sent: 0, wrote: 0, skipped: true };
  var T = oxGmailTargets(), start = Date.now(), at = force ? 0 : Number(pr.getProperty("OX_GSYNC_AT") || 0), today = oxToday();
  var ours = {}; rows("People").forEach(function (x) { if (isStaff(x)) ours[normEmail(x.email)] = 1; }); var fa = normEmail(fromAddress() || ""); if (fa) ours[fa] = 1;
  var isOurs = function (e) { return ours[e] || /@bluesierracorp\.com$/.test(e); };
  var firmOf = function (e) { if (T.addr[e]) return T.addr[e]; var d = e.split("@")[1] || ""; if (T.dom[d]) return T.dom[d]; var k = Object.keys(T.dom).filter(function (x) { return d.slice(-x.length - 1) === "." + x; })[0]; return k ? T.dom[k] : ""; };
  var touches = rows("OxTouches"), seen = {}, day0 = {};
  touches.forEach(function (t) { if (t.thread_id) seen[t.thread_id + "|" + t.channel + "|" + t.firm_id] = 1; if (t.channel === "email" && t.step === "day0") day0[t.firm_id] = 1; });
  var projOf = {}, pById = {}; rows("OxProjects").forEach(function (x) { pById[x.id] = x; });
  rows("OxRoles").forEach(function (r) { if (r.firm_id && r.role !== "owner" && pById[r.project_id]) (projOf[r.firm_id] = projOf[r.firm_id] || []).push(pById[r.project_id]); });
  var cts = rows("OxContacts"), out = { sent: 0, wrote: 0, firms: {}, done: false }, N = 20, firstSeen = {};
  while (at < T.terms.length) {
    if (Date.now() - start > 20000) break;
    var part = T.terms.slice(at, at + N), q = "{" + part.map(function (x) { return "to:" + x + " from:" + x + " cc:" + x; }).join(" ") + "} newer_than:" + OX_GSYNC_DAYS + "d";
    var threads = []; try { threads = GmailApp.search(q, 0, 100); } catch (e) { out.err = String(e.message || e); break; }
    var msgs = threads.length ? GmailApp.getMessagesForThreads(threads) : [];
    threads.forEach(function (th, i) {
      var tid = th.getId(), per = {};                                   // firm id → { sent: first message we sent, wrote: first message they sent }
      (msgs[i] || []).forEach(function (m) {
        var from = (oxParseAddrs(m.getFrom())[0] || {}).email || "", rcpt = oxParseAddrs(m.getTo()).concat(oxParseAddrs(m.getCc ? m.getCc() : ""));
        if (isOurs(from)) rcpt.forEach(function (a) { var fid = firmOf(a.email); if (!fid) return; var x = per[fid] = per[fid] || {}; if (!x.sent) x.sent = { m: m, to: a }; });
        else { var fid = firmOf(from); if (!fid) return; var x = per[fid] = per[fid] || {}; if (!x.wrote) x.wrote = { m: m, to: { email: from, name: (oxParseAddrs(m.getFrom())[0] || {}).name || "" } }; }
      });
      Object.keys(per).forEach(function (fid) {
        var f = T.byId[fid]; if (!f) return;
        ["sent", "wrote"].forEach(function (dir) {
          var hit = per[fid][dir], ch = dir === "sent" ? "email" : "reply"; if (!hit || seen[tid + "|" + ch + "|" + fid]) return; seen[tid + "|" + ch + "|" + fid] = 1;
          var m = hit.m, d = Utilities.formatDate(m.getDate(), CONFIG.TZ, "yyyy-MM-dd"), subj = clean(m.getSubject() || "(no subject)", 140), txt = subj + " " + String(m.getPlainBody ? m.getPlainBody() : "").slice(0, 4000);
          var pj = (projOf[fid] || []).filter(function (x) { var k = oxStreetKey(x); return k && k.test(txt); })[0];
          var ct = cts.filter(function (k) { return k.firm_id === fid && normEmail(k.email) === hit.to.email; })[0];
          if (!ct && !OX_GENERIC.test(hit.to.email.split("@")[0]) && !OX_JUNK.test(hit.to.email)) { ct = { id: newId("oc"), firm_id: fid, name: /@/.test(hit.to.name || "") ? "" : hit.to.name || "", role: "", email: hit.to.email, phone: "", source: "gmail", verified: "yes", created_at: now(), updated_at: now() }; insert("OxContacts", ct); cts.push(ct); }
          var step = ch === "reply" ? "" : !day0[fid] && oxDaysBetween(d, today) <= OX_GSYNC_CADENCE ? "day0" : "gmail"; if (step === "day0") day0[fid] = 1;
          insert("OxTouches", { id: newId("ot"), firm_id: fid, contact_id: ct ? ct.id : "", project_id: pj ? pj.id : "", date: d, channel: ch, step: step, summary: (ch === "email" ? "From your Gmail" + (hit.to.email ? " to " + hit.to.email : "") + ": " : "They wrote: ") + subj, outcome: ch === "email" ? "sent" : "replied", by: me.email, at: now(), outbox_id: "", thread_id: tid });
          if (ch === "reply" && ["meeting", "closed", "replied"].indexOf(f.status) < 0) { update("OxFirms", "id", fid, { status: "replied", updated_at: now() }); f.status = "replied"; }
          if (ch === "email" && !f.status) { update("OxFirms", "id", fid, { status: "active", updated_at: now() }); f.status = "active"; }
          out[dir]++; out.firms[fid] = 1;
        });
      });
    });
    at += N;
  }
  out.done = at >= T.terms.length; out.firms = Object.keys(out.firms).length; out.checked = Math.min(at, T.terms.length); out.of = T.terms.length;
  if (out.done) { pr.deleteProperty("OX_GSYNC_AT"); c.put("oxgsync", "1", 3 * 3600); } else pr.setProperty("OX_GSYNC_AT", String(at));
  return out;
}
ACTIONS.oxGmailSync = function (me, b) { oxAdmin(me); return oxGmailSync(me, !!(b && b.force)); };
/* Has this firm (or this person) already heard from us? Every email, the portal's and Gmail's, newest first. */
function oxAlready(fid, toAddr) {
  var cts = {}; rows("OxContacts").forEach(function (k) { cts[k.id] = k; });
  return rows("OxTouches").filter(function (t) { return t.firm_id === fid && (t.channel === "email" || t.channel === "reply"); }).sort(function (a, b) { return a.date < b.date ? 1 : -1; }).slice(0, 6).map(function (t) {
    var k = cts[t.contact_id], ob = t.outbox_id ? findBy("OxOutbox", "id", t.outbox_id) : null, to = ob ? normEmail(ob.to) : k ? normEmail(k.email) : "";
    return { date: t.date, dir: t.channel === "email" ? "sent" : "wrote", to: to, who: k ? (k.name || k.email) : "", subject: String(t.summary || "").replace(/^(From your Gmail( to \S+)?|They wrote): /, ""), gmail: t.step === "gmail" || /^From your Gmail/.test(t.summary || "") || (t.channel === "reply" && !t.outbox_id), same: !!toAddr && to === normEmail(toAddr), project_id: t.project_id || "" };
  });
}   // the portal calls it in the background; at most every 20 min unless forced

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
    var fl = oxFlags(f), why = info.no_lookup ? "not needed (you said so)" : goal === "calls" ? oxCallSkip(f, fl, contacts, log) : goal === "dm" ? oxDmSkip(f, fl, contacts, log) : fl.excluded ? "excluded" : isTrue(f.individual) && !isTrue(f.confirmed) ? "individual (confirm first)" : contacts.some(function (c) { return c.firm_id === f.id && c.email && c.verified === "yes"; }) ? "already has a verified email" : oxHasRealEmail(f.id) ? "already has a real email (free)" : log.some(function (x) { return x.firm_id === f.id && x.status === "done"; }) ? "already looked up" : "";
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
/* Decision maker = the person who puts us on a bid list: a principal/owner/partner, the one confirmed to handle bids, or
   (at a builder) the estimator. An info@ box, a guessed address or a staff email from their website doesn't count. */
function oxIsBuilder(f) { return /build|contract|construct|\bgc\b|developer/i.test(String(f.firm_type || "") + " " + String(f.name || "")); }
function oxDmTitle(f, title) {
  var t = String(title || ""); if (oxIsBuilder(f) && /estimat|precon|bid|purchas/i.test(t)) return 0;
  if (OX_DM.test(t)) return oxIsBuilder(f) ? 1 : 0; if (OX_DM2.test(t)) return 2; return 9;
}
function oxDmEmail(f, contacts) {
  return contacts.filter(function (c) { if (c.firm_id !== f.id) return false; var e = oxEmailInfo(c); return e && e.kind === "work" && (isTrue(c.bid_contact) || oxDmTitle(f, c.role) < 2); })[0] || null;
}
function oxDmSkip(f, fl, contacts, log) {
  if (fl.excluded) return "excluded"; if (isTrue(f.individual) && !isTrue(f.confirmed)) return "individual (confirm first)";
  var c = oxDmEmail(f, contacts); if (c) return "already has a decision maker's email (" + (c.name || c.email) + ")";
  if (log.some(function (x) { return x.firm_id === f.id && x.goal === "dm" && x.status === "done"; })) return "already looked up a decision maker";
  return "";
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
  var calls = b.goal === "calls", dm = b.goal === "dm", left = oxRrCredits(), go = oxEnrichList([].concat(b.firm_ids || []).map(String), b.goal).filter(function (x) { return !x.skip; }).slice(0, Math.min(12, left)), out = [], log = rows("OxEnrich");
  var TITLE = [/principal|partner|owner|founder|president/i, /project (architect|manager|lead)|associate/i, /estimat|bid|precon/i];
  go.forEach(function (x) {
    var f = findBy("OxFirms", "id", x.firm_id), res = { firm: f.name, found: "", status: "" };
    try {
      var dom = String(f.website || "").replace(/^https?:\/\//, "").replace(/^www\./, "").split("/")[0];
      var q = dom ? { company_domain: [dom] } : { employer: ["\"" + f.name.replace(/\s*\([^)]*\)/g, "") + "\""] };
      var mine = rows("OxContacts").filter(function (c) { return c.firm_id === f.id; });
      var saved = mine.filter(function (c) { return c.rr_id && (calls ? !c.phone : !c.email) && (!dm || oxDmTitle(f, c.role) < 9); }).map(function (c) { return { id: c.rr_id, name: c.name, current_title: c.role, region: "CA" }; });
      var people = saved.length ? saved : (function () { var r0 = rrCall("post", "/person/search", { query: q, page_size: dm ? 25 : 10 }) || []; return Array.isArray(r0) ? r0 : r0.profiles || []; })();
      people = people.filter(function (p) { return !log.some(function (l) { return String(l.rr_id) === String(p.id) && l.status === "done"; }); });
      if (dm) people = people.filter(function (p) { return oxDmTitle(f, p.current_title) < 9 && !mine.some(function (c) { var e = oxEmailInfo(c); return e && e.kind === "work" && (String(c.rr_id) === String(p.id) || oxSame(c.name, p.name)); }); });
      var score = dm ? function (p) { return oxDmTitle(f, p.current_title); } : function (p) { for (var i = 0; i < TITLE.length; i++) if (TITLE[i].test(p.current_title || "")) return i; return 9; };
      people.sort(function (a, c) { return score(a) - score(c) || (/california|\bca\b/i.test(c.region || c.location || "") ? 1 : 0) - (/california|\bca\b/i.test(a.region || a.location || "") ? 1 : 0); });
      var p = people[0];
      if (!p) { res.status = dm ? "no principal, owner or estimator on RocketReach (no credit used)" : "nobody found"; insert("OxEnrich", { id: newId("oe"), firm_id: f.id, person: "", rr_id: "", status: "done", result: "none", at: now(), by: me.email, goal: b.goal || "" }); oxRrAfter(f, res, me, b, null); out.push(res); return; }
      var d = rrCall("get", "/person/lookup?id=" + encodeURIComponent(p.id)) || {};
      var done = d.status === "complete" || d.status === "progress" || !!(d.emails || []).length;
      oxRrSaveContact(f, d.name ? d : Object.assign({}, p, d), me);
      res.found = (d.name || p.name || "") + (d.current_title || p.current_title ? " · " + (d.current_title || p.current_title) : ""); res.phone = (d.phones || []).length > 0; res.email = oxRrEmail(d); res.status = done ? (dm && !res.email ? "found them, but RocketReach has no work email yet" : "found") : "searching (check again in a minute)";
      res.guessed = oxFillPattern(f);                                    // one real email → the rest of the firm, free
      oxRrAfter(f, res, me, b, { name: d.name || p.name || "", title: d.current_title || p.current_title || "", website: d.current_employer_domain || d.current_employer_website || p.current_employer_domain || p.current_employer_website || "", pending: !done || d.status === "progress" });
      insert("OxEnrich", { id: newId("oe"), firm_id: f.id, person: d.name || p.name || "", rr_id: String(p.id), status: done && d.status === "complete" ? "done" : "pending", result: oxRrEmail(d) ? "email" : "no email yet", at: now(), by: me.email, goal: b.goal || "" });
    } catch (e) { res.status = e.message; if (/credits|key|rate/i.test(e.message)) { out.push(res); throw new Error(e.message + " (" + out.length + " firms done before this)"); } }
    out.push(res);
  });
  CacheService.getScriptCache().remove("rr:acct");
  return { results: out, rr: oxRrInfo() };
};
/* RocketReach came back without an email (or, for calls, without a phone): look elsewhere before giving up.
   Free first: the website RocketReach knows (saved if we had none), the firm's own site, your Gmail and the firm's email format.
   Then, only if there's still no real email (or phone) and the AI key is on, the internet (Claude + web search, about 5 cents). */
function oxRrAfter(f, res, me, b, who) {
  var calls = b.goal === "calls", needPhone = function () { return calls && !res.phone && !rows("OxContacts").some(function (c) { return c.firm_id === f.id && oxPhoneOk(c.phone); }); };
  if (b.fallback === false || (res.email && !needPhone())) return;
  var fb = { website: 0, gmail: 0, guessed: 0, phone: "", web: null, note: "" }, t = now();
  try {
    if (who && who.website && !oxDomain(f)) { var w0 = String(who.website).replace(/^https?:\/\//i, "").replace(/^www\./i, "").split("/")[0]; if (/^[a-z0-9.-]+\.[a-z]{2,}$/i.test(w0)) { update("OxFirms", "id", f.id, { website: "https://" + w0, updated_at: t }); f = findBy("OxFirms", "id", f.id); fb.site_from_rr = w0; } }
    var fr = oxFreeFirm(f, me); fb.website = fr.website; fb.gmail = fr.gmail; fb.guessed = fr.guessed; if (fr.phone) fb.phone = oxPhoneFmt(fr.phone); f = findBy("OxFirms", "id", f.id);
    var stillEmail = !calls && !res.email && !oxHasRealEmail(f.id), stillPhone = needPhone() && !oxPhoneOk(f.phone);   // a phone lookup only needs a phone
    if ((stillEmail || stillPhone) && b.web !== false && aiKey() && !(who && who.pending)) {
      var w = oxAiWebContact(f, who), saved = oxWebContactSave(f, w, who); fb.web = { cost: w.cost, searches: w.searches, emails: saved.emails, phone: saved.phone, website: saved.website, why: w.why || "" };
      if (saved.website) { var fr2 = oxFreeFirm(findBy("OxFirms", "id", f.id), me); fb.website += fr2.website; fb.guessed += fr2.guessed; }
    }
  } catch (e) { fb.note = String(e.message || e).slice(0, 160); }
  var bits = [fb.website ? fb.website + " email" + (fb.website === 1 ? "" : "s") + " on their website" : "", fb.gmail ? fb.gmail + " in your Gmail" : "", fb.guessed ? fb.guessed + " guessed from their format" : "", fb.phone ? "office phone " + fb.phone : "",
    fb.web ? (fb.web.emails || fb.web.phone || fb.web.website ? "online: " + [fb.web.emails ? fb.web.emails + " email" + (fb.web.emails === 1 ? "" : "s") : "", fb.web.phone ? "phone " + fb.web.phone : "", fb.web.website ? "website" : ""].filter(Boolean).join(", ") : "nothing more online") + " (≈" + Math.max(1, Math.round(fb.web.cost * 100)) + "¢)" : ""].filter(Boolean);
  fb.summary = bits.length ? "Also found: " + bits.join(" · ") : "Nothing more on their website" + (me.role === "admin" ? " or in your Gmail" : "") + (aiKey() ? "" : " (connect the AI key to also search the internet)");
  if (fb.note) fb.summary += " · " + fb.note;
  res.fallback = fb;
}
function oxAiWebContact(f, who) {
  var c = CacheService.getScriptCache(), hk = "oxweb:" + Utilities.formatDate(new Date(), "UTC", "yyyyMMddHH"), used = Number(c.get(hk) || 0);
  if (used >= OX_WEB.perHour) throw new Error("internet searches paused for this hour"); c.put(hk, String(used + 1), 3700);
  var prompt = ["Find public contact details for this firm in the San Francisco Bay Area, California: \"" + f.name + "\"" + (f.firm_type ? " (" + f.firm_type + ")" : "") + (oxDomain(f) ? ", website " + oxDomain(f) : "") + ".",
    "We want: the firm's website, its main office phone, any email address shown publicly (a general one like info@ is fine)" + (who && who.name ? ", and if public, the work email or direct phone of " + who.name + (who.title ? " (" + who.title + ")" : "") : "") + ".",
    "Look at the firm's own site (contact and team pages), the California license board, Houzz, AIA, Google Business and similar listings. Only report what a source shows; never guess an email.",
    "Reply with only this JSON: {\"website\": \"\", \"phone\": \"\", \"emails\": [{\"email\": \"\", \"name\": \"\", \"title\": \"\"}], \"person_email\": \"\", \"person_phone\": \"\", \"why\": \"one sentence\", \"sources\": [\"url\"]}"].join("\n");
  var msgs = [{ role: "user", content: prompt }], j = null, searches = 0, tin = 0, tout = 0;
  for (var i = 0; i < 3; i++) {
    j = oxAiPost({ model: OX_WEB.model, max_tokens: 3000, messages: msgs, tools: [{ type: "web_search_20260209", name: "web_search", max_uses: 4 }], output_config: { effort: "low" } });
    var u = j.usage || {}; tin += u.input_tokens || 0; tout += u.output_tokens || 0; searches += ((u.server_tool_use || {}).web_search_requests) || 0;
    if (j.stop_reason !== "pause_turn") break; msgs = [msgs[0], { role: "assistant", content: j.content }];
  }
  var out = (j && j.stop_reason !== "refusal" && oxJsonIn(oxAiText(j))) || {};
  out.cost = Math.round((tin / 1e6 * OX_WEB.inPerM + tout / 1e6 * OX_WEB.outPerM + searches * OX_WEB.perSearch) * 1000) / 1000; out.searches = searches;
  return out;
}
function oxWebContactSave(f, w, who) {
  var t = now(), r = { emails: 0, phone: "", website: false }, okE = function (e) { return /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e) && !OX_JUNK.test(e); };
  var dom = oxDomain({ website: w.website || "" }); if (dom && !oxDomain(f)) { update("OxFirms", "id", f.id, { website: "https://" + dom, updated_at: t }); r.website = true; }
  if (oxPhoneOk(w.phone) && !oxPhoneOk(f.phone)) { update("OxFirms", "id", f.id, { phone: oxPhoneFmt(w.phone), updated_at: t }); r.phone = oxPhoneFmt(w.phone); }
  var have = rows("OxContacts").filter(function (c) { return c.firm_id === f.id; });
  var list = [].concat(w.emails || []).map(function (x) { return typeof x === "string" ? { email: x } : x || {}; });
  if (who && who.name && (okE(w.person_email || "") || oxPhoneOk(w.person_phone))) list.unshift({ email: w.person_email || "", name: who.name, title: who.title || "", phone: w.person_phone || "" });
  list.slice(0, 5).forEach(function (x) {
    var e = normEmail(x.email || ""), ph = oxPhoneOk(x.phone) ? oxPhoneFmt(x.phone) : ""; if (!okE(e) && !ph) return; if (e && !okE(e)) e = "";
    var same = have.filter(function (c) { return (e && normEmail(c.email) === e) || (x.name && c.name && oxSame(c.name, x.name)); })[0];
    if (same) { var up = {}; if (e && !same.email) up.email = e; if (ph && !oxPhoneOk(same.phone)) up.phone = ph; if (Object.keys(up).length) { up.updated_at = t; if (up.email) { up.source = "web"; up.verified = "no"; } update("OxContacts", "id", same.id, up); if (up.email) r.emails++; } return; }
    var ct = { id: newId("oc"), firm_id: f.id, name: clean(x.name || "", 120), role: clean(x.title || (e && OX_GENERIC.test(e.split("@")[0]) ? "General inbox" : ""), 120), email: e, phone: ph, source: "web", verified: "no", created_at: t, updated_at: t };
    insert("OxContacts", ct); have.push(ct); if (e) r.emails++;
  });
  return r;
}
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
    var cbDue = /^call back/i.test(f.next_step || "") && f.next_date && f.next_date <= today;          // "they'll send plans: check back Thursday" brings them back
    if (fl.excluded || fl.noCall || fl.individual || oxJesusOwn(f) || (s.replied && !cbDue) || ["closed", "paused", "removed", "meeting"].indexOf(f.status) > -1) return;
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
var OX_LIC_CALL = { site: "We're licensed Class A and C-27, so we can take the whole site, from grading and foundations to the landscape.", landscape: "We're a licensed C-27 landscape contractor, with a Class A too.", pool: "We're licensed Class A and C-27, so the grading and hardscape around the pool can be ours too." };
var OX_SAY = {
  why: ["I'm calling about {A}. I saw it {stage}.", "I saw {A} {stage}, and I wanted to reach out.", "Quick call about {A}. Looks like it {stage}."],
  pitch: ["We do the site work, hardscape and landscape on a lot of the homes around here.", "Blue Sierra builds the site work, hardscape and landscape on custom homes around the Peninsula.", "We're the site work, hardscape and landscape contractor on a lot of homes like this one."],
  ask: ["Who's putting together the bid list for {scope}? We'd love to be on it.", "Is the bid list for {scope} together yet? We'd love a shot at it.", "Could we get on the bid list for {scope}?"],
  plans: ["Could you send me the plan set so we can put a number together? What's the best email for it?", "Can you send over the current plans and the bid date? I'll make sure we get you a price on time.", "Would you email me the plans when they're ready, and let me know when bids are due?"],
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
    pitch: oxPick(OX_SAY.pitch, seed, "pitch") + (p.id ? " " + OX_LIC_CALL[oxLicKind(findBy("OxProjects", "id", p.id) || {})] : ""),
    ask: oxFill(oxPick(OX_SAY.ask, seed, "ask"), v),
    plans: oxPick(OX_SAY.plans, seed, "plans"),
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
    queue: pool.items.slice(0, 400).map(function (it) { return oxCallOut(it, me, Number(b && b.n) || 0); }), total: pool.items.length, later: pool.later, done_today: pool.done_today, no_phone: pool.no_phone.length,
    meetings: rows("OxMeetings").filter(function (m) { return m.status === "booked" && m.day >= today; }).sort(function (a, c) { return (a.day + a.time) < (c.day + c.time) ? -1 : 1; }).map(oxMeetOut),
    outcomes: OX_CALL_OUT, kinds: OX_MEET_KIND, hours: OX_HOURS,
    called_today: oxCalledToday(me, today), rc: oxRcPublic(), shift: me.role === "setter" ? oxShiftState(me) : null,
    academy: me.role === "setter" ? (function () { var r = findBy("AcProgress", "email", normEmail(me.email)); return { certified: !!(r && r.certified_at) }; })() : null };
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
  oxRcStamp(t, b.rc); insert("OxTouches", t); update("OxFirms", "id", f.id, patch);
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
  if (!oxDmEmail(f, cs.map(function (c) { return Object.assign({}, c, { firm_id: f.id }); })) && !oxNoLookup(f) && !rows("OxEnrich").some(function (x) { return x.firm_id === f.id && x.goal === "dm"; })) other.push({ kind: "dm", label: "Find the decision maker’s email (RocketReach, 1 credit)" });
  return Object.assign({}, best, { alt: other });
}
var OX_ACT_RANK = { email: 0, call: 1, ask: 2, log: 3, link: 4, wait: 4, find: 5, confirm: 6, none: 9 };
var OX_ROLE_PREF = { landscape_architect: 0, architect: 1, contractor: 2, applicant: 3, engineer: 4 };
/* Already reached out on this project? Then it leaves "Start here" so new ones move up:
   - any email, call, LinkedIn, note or reply logged on this property (portal or Gmail), or a bid track on it
   - or the firm we'd contact first got an email from us in the last 14 days (about anything): don't hit them twice
   - or Jesús marked it "Done" by hand (undo puts it back) */
var OX_REACH_DAYS = 14;
function oxReached(p, c, a) {
  if (p.reached_at) return { how: "marked", date: String(p.reached_at).slice(0, 10), by: p.reached_by ? personName(p.reached_by) : "" };
  var fids = (c.roles[p.id] || []).filter(function (r) { return r.firm_id; }).map(function (r) { return r.firm_id; }), best = null;
  fids.forEach(function (fid) { (c.touches[fid] || []).forEach(function (t) { if (t.project_id === p.id && (!best || t.date > best.date)) best = { how: t.channel, date: t.date, firm: (c.firms[fid] || {}).name || "" }; }); });
  if (best) return best;
  var tr = (c.oppsBy[p.id] || [])[0]; if (tr) return { how: "bid", date: String(tr.updated_at || tr.created_at || "").slice(0, 10), firm: (c.firms[tr.firm_id] || {}).name || "" };
  var lead = a && a.firm_id, since = oxAdd(c.today, -OX_REACH_DAYS), recent = null;
  if (lead) (c.touches[lead] || []).forEach(function (t) { if (t.channel === "email" && t.date >= since && (!recent || t.date > recent.date)) recent = { how: "firm", date: t.date, firm: (c.firms[lead] || {}).name || "" }; });
  return recent;
}
ACTIONS.oxProjReached = function (me, b) {
  oxNeed(me); var ids = b.project_ids ? [].concat(b.project_ids).map(String).slice(0, 60) : [String(b.project_id || "")], n = 0;
  ids.forEach(function (id) { var p = findBy("OxProjects", "id", id); if (!p) { if (ids.length === 1) throw new Error("Project not found."); return; }
    update("OxProjects", "id", p.id, b.on === false ? { reached_at: "", reached_by: "" } : { reached_at: oxToday(), reached_by: me.email }); n++; });
  return { on: b.on !== false, count: n };
};
/* "Already reached out" up close: for each firm on the project, what we did and when (the emails themselves: the portal's,
   and for Jesús also the ones from his Gmail), and that firm's other projects, so the same people don't get the same email twice. */
function oxGmailBody(tid, date) {
  try { var th = GmailApp.getThreadById(tid); if (!th) return null; var ours = {}; rows("People").forEach(function (x) { if (isStaff(x)) ours[normEmail(x.email)] = 1; });
    var ms = th.getMessages().filter(function (m) { var fr = (oxParseAddrs(m.getFrom())[0] || {}).email || ""; return ours[fr] || /@bluesierracorp\.com$/.test(fr); }); if (!ms.length) return null;
    var m = ms.filter(function (x) { return Utilities.formatDate(x.getDate(), CONFIG.TZ, "yyyy-MM-dd") === date; })[0] || ms[0];
    return { to: oxParseAddrs(m.getTo()).map(function (a) { return a.email; }).join(", "), subject: m.getSubject() || "", body: String(m.getPlainBody() || "").split(/\n\s*On .{10,120}wrote:\s*\n/)[0].trim().slice(0, 2500) };
  } catch (e) { return null; }
}
ACTIONS.oxReachDetail = function (me, b) {
  oxNeed(me); var p = findBy("OxProjects", "id", String(b.project_id || "")); if (!p) throw new Error("Project not found.");
  var c = oxCtx(oxToday()), pById = {}; rows("OxProjects").forEach(function (x) { pById[x.id] = x; });
  var people = {}; rows("People").forEach(function (x) { people[normEmail(x.email)] = x.name; }); var cts = {}; rows("OxContacts").forEach(function (k) { cts[k.id] = k; });
  var fids = (c.roles[p.id] || []).filter(function (r) { return r.firm_id && r.role !== "owner" && c.firms[r.firm_id]; }).map(function (r) { return r.firm_id; }).filter(function (x, i, l) { return l.indexOf(x) === i; });
  var gmailN = 0;
  return { project_id: p.id, firms: fids.map(function (fid) {
    var f = c.firms[fid], ts = (c.touches[fid] || []).slice().sort(function (a, b) { return a.date < b.date ? 1 : -1; }).slice(0, 10);
    var hist = ts.map(function (t) {
      var q = t.project_id ? pById[t.project_id] : null, k = cts[t.contact_id], out = { date: t.date, channel: t.channel, outcome: t.outcome || "", summary: t.summary || "", by: people[normEmail(t.by)] || "", here: t.project_id === p.id, street: q ? oxStreetFull(q) : "", project_id: t.project_id || "", who: k ? k.name || k.email : "" };
      if (t.channel === "email") {
        var ob = t.outbox_id ? findBy("OxOutbox", "id", t.outbox_id) : null;
        if (ob) out.email = { to: ob.to, subject: ob.subject, body: String(ob.body || "").slice(0, 2500), from: "portal" };
        else if (t.thread_id && me.role === "admin" && gmailN < 6) { gmailN++; var gm = oxGmailBody(t.thread_id, t.date); if (gm) out.email = Object.assign(gm, { from: "gmail" }); }
      }
      return out;
    });
    var others = Object.keys(c.roles).filter(function (pid) { return pid !== p.id && pById[pid] && (c.roles[pid] || []).some(function (r) { return r.firm_id === fid && r.role !== "owner"; }); }).map(function (pid) {
      var q = pById[pid], a = oxProjAct(q, c), r = oxReached(q, c, a); return { id: q.id, street: oxStreetFull(q), town: q.town, stage: q.stage || "", reached: r, closed: q.stage === "5" || oxBidOf(q, c.opps).status === "closed" };
    }).sort(function (a, b) { return (a.reached ? 1 : 0) - (b.reached ? 1 : 0) || a.street.localeCompare(b.street); });
    return { firm_id: fid, name: f.name, segment: f.segment || "", emailed: c.st[fid].emailed ? c.st[fid].day0 : "", replied: c.st[fid].replied, history: hist, others: others };
  }) };
};
NO_LOCK.oxReachDetail = 1; PREFETCH.oxReachDetail = OX_T.concat(["People"]);
PREFETCH.oxProjReached = OX_T.concat(["People"]);
/* ✅ marks: the newest email we sent and the newest one they wrote, about THIS property first, else to any firm on it. */
function oxContacted(p, c) {
  var fids = (c.roles[p.id] || []).filter(function (r) { return r.firm_id && r.role !== "owner"; }).map(function (r) { return r.firm_id; }), best = {};
  fids.forEach(function (fid) { (c.touches[fid] || []).forEach(function (t) {
    var k = t.channel === "email" ? "sent" : t.channel === "reply" ? "wrote" : ""; if (!k) return;
    var here = t.project_id === p.id, cur = best[k]; if (!cur || (here && !cur.here) || (here === cur.here && t.date > cur.date)) best[k] = { date: t.date, here: here, firm: (c.firms[fid] || {}).name || "", gmail: t.step === "gmail" || /^From your Gmail/.test(t.summary || "") };
  }); });
  return best.sent || best.wrote ? best : null;
}
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
/* The setter logs the calls that win something (plans coming, on the bid list, referred to who's collecting prices) the same
   way Jesús does, for firms on their own list only. */
var OX_SETTER_PROJ_OUT = ["send_plans", "invited", "referred", "open", "not_bidding", "passed"];
ACTIONS.oxProjLog = function (me, b) {
  var f0 = findBy("OxFirms", "id", String(b.firm_id || ""));
  if (me && me.role === "setter") {
    if (me.preview) throw new Error("This is a preview. Nothing is saved.");
    if (OX_SETTER_PROJ_OUT.indexOf(String(b.outcome || "")) < 0 || b.channel !== "call") throw new Error("Log it from the call card.");
    if (!f0) throw new Error("Pick the firm."); var fl0 = oxFlags(f0); if (fl0.excluded || fl0.individual || fl0.noCall || oxJesusOwn(f0)) throw new Error("Jesús handles " + f0.name + " himself.");
    b.assignee = "";
  } else oxNeed(me);
  var p = findBy("OxProjects", "id", String(b.project_id || "")); if (!p) throw new Error("Project not found.");
  var f = f0; if (!f) throw new Error("Pick the firm.");
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
  oxRcStamp(touch, b.rc); insert("OxTouches", touch);
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
    .filter(function (x) { return x.s > -999 && !oxReached(x.p, c, x.a) && ["email", "call", "ask", "link"].indexOf(x.a.kind) > -1; }).sort(function (a, b) { return b.s - a.s; }).slice(0, 5)
    .map(function (x) { return { project_id: x.p.id, firm_id: x.a.firm_id || "", street: oxStreetFull(x.p), town: x.p.town, reason: oxWhy(x.p, c), act: x.a }; });
  out.deadlines.sort(function (a, b) { return a.date < b.date ? -1 : 1; }); out.callbacks.sort(function (a, b) { return a.date < b.date ? -1 : 1; });
  return out;
}
["oxProjTask", "oxHandoff"].forEach(function (a) { PREFETCH[a] = OX_T.concat(["People"]); });
PREFETCH.oxHandoffSheet = OX_T.concat(["People"]);
/* A first email can be prepared any day; it goes out on the next allowed day (Tue to Thu for first emails). Staff prepare, Jesús sends. */
function oxNextSendDay(step, today) { return today; }                               // Jesús sends whenever he wants; drafts are for the team to prepare
ACTIONS.oxSaveDraft = function (me, b) {
  var f = findBy("OxFirms", "id", String(b.firm_id || "")); if (!f) throw new Error("Firm not found.");
  var setter = oxSetterFollowOk(me, f, b.step === "again" || b.step === "reply" ? "reply" : b.step); if (setter && me.preview) throw new Error("This is a preview. Nothing is saved."); if (!setter) oxNeed(me);
  if (oxFlags(f).excluded) throw new Error(f.name + " is excluded from outreach.");
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

/* ====================================== Link firm: who is "<name on the permit>"? ======================================
   Free first: your own firms (their names and their people), then Jesús's Gmail. The internet (Claude with web search,
   a few cents) only when someone asks for it. Nothing is linked until a person picks a suggestion. */
var OX_GENERIC_W = ["architect", "architects", "architecture", "architectural", "design", "designs", "designer", "studio", "associates", "group", "partners", "landscape", "construction", "builders", "builder", "building", "development", "engineering", "engineers", "homes", "company", "and", "the", "of", "planning", "interiors", "inc", "llc", "general", "contractor", "contractors"];
var OX_WEB = { model: "claude-sonnet-5-5", perHour: 20, inPerM: 2, outPerM: 10, perSearch: 0.01 };
OX_SRC_TXT.web = "the internet";
function oxSigTokens(s) { return oxNorm(s).split(" ").filter(function (w) { return w.length > 1 && OX_GENERIC_W.indexOf(w) < 0; }); }
function oxNameScore(a, b) {                                                // shared words that matter; a shared first name alone ("James …") never counts
  var x = oxSigTokens(a), y = oxSigTokens(b); if (!x.length || !y.length) return 0; var hit = x.filter(function (w) { return y.indexOf(w) > -1; }), sc = hit.length / Math.max(x.length, y.length);
  if (sc >= 0.67) return sc; return hit.length && x[x.length - 1] === y[y.length - 1] ? sc : 0;
}
function oxSplitRaw(raw) {                                                  // "Peter Mason, Mason Architects" → ["Peter Mason", "Mason Architects"]
  return String(raw || "").replace(/\([^)]*\)/g, " ").split(/\s*[,;\/|]\s*|\s+-\s+|\s+&\s+(?=[A-Z])/).map(function (x) { return x.trim(); }).filter(function (x) { return x.length > 2; });
}
function oxFirmish(s) { return /architect|design|studio|associates|group|partners|landscape|construct|build|develop|engineer|homes|inc\b|llc\b|aia\b|company/i.test(s); }
function oxLocalMatches(raw) {
  var firms = rows("OxFirms").filter(function (f) { return f.status !== "removed"; }), byId = {}, out = {}; firms.forEach(function (f) { byId[f.id] = f; });
  var add = function (f, score, why) { if (!f) return; var o = out[f.id]; if (!o || score > o.score) out[f.id] = { firm_id: f.id, name: f.name, firm_type: f.firm_type || "", website: f.website || "", phone: f.phone || "", score: Math.round(score * 100) / 100, why: why, source: "yours" }; };
  var exact = oxFindFirm(firms, raw); if (exact) add(exact, 1, "Same name as your firm “" + exact.name + "”");
  var parts = [raw].concat(oxSplitRaw(raw));
  parts.forEach(function (pt) {
    firms.forEach(function (f) { var s = oxNameScore(pt, f.name); if (s >= 0.5) add(f, 0.45 + s * 0.45, "Name matches your firm “" + f.name + "”"); });
    if (oxNorm(pt).split(" ").length >= 2) rows("OxContacts").forEach(function (c) { if (c.name && oxNorm(c.name) === oxNorm(pt)) add(byId[c.firm_id], 0.92, c.name + " works there" + (c.role ? " (" + c.role + ")" : "")); });
  });
  return Object.keys(out).map(function (k) { return out[k]; }).sort(function (a, b) { return b.score - a.score; }).slice(0, 4);
}
function oxFirmByDomain(dom) {
  if (!dom) return null; var f = rows("OxFirms").filter(function (x) { return oxDomain(x) === dom; })[0]; if (f) return f;
  var c = rows("OxContacts").filter(function (x) { return String(x.email || "").split("@")[1] === dom; })[0]; return c ? findBy("OxFirms", "id", c.firm_id) : null;
}
function oxGmailFirm(raw, me) {
  if (me.role !== "admin" || me.preview) return [];
  var parts = [raw].concat(oxSplitRaw(raw)).filter(function (x, i, l) { return l.indexOf(x) === i; }).slice(0, 3), q = parts.map(function (p) { return '"' + p.replace(/"/g, "") + '"'; }).join(" OR ");
  var threads = []; try { threads = GmailApp.search("(" + q + ") newer_than:3y", 0, 15); } catch (e) { return []; }
  if (!threads.length) return []; var msgs = GmailApp.getMessagesForThreads(threads), ours = {}, dom = {};
  rows("People").forEach(function (x) { ours[normEmail(x.email)] = 1; });
  msgs.forEach(function (ms) { (ms || []).forEach(function (m) { [m.getFrom(), m.getTo(), m.getCc ? m.getCc() : ""].forEach(function (h) { oxParseAddrs(h).forEach(function (a) {
    var d = a.email.split("@")[1] || ""; if (!d || ours[a.email] || /bluesierracorp\.com$/.test(d) || OX_MAILBOX.test(d) || OX_JUNK.test(a.email)) return;
    var x = dom[d] = dom[d] || { domain: d, n: 0, people: {} }; x.n++; if (a.name && !/@/.test(a.name)) x.people[a.email] = a.name; else if (!x.people[a.email]) x.people[a.email] = "";
  }); }); }); });
  return Object.keys(dom).map(function (k) { return dom[k]; }).sort(function (a, b) { return b.n - a.n; }).slice(0, 3).map(function (x) {
    var f = oxFirmByDomain(x.domain), ppl = Object.keys(x.people).slice(0, 3).map(function (e) { return { email: e, name: x.people[e] }; }), why = "In your Gmail: " + x.n + " message" + (x.n === 1 ? "" : "s") + " with @" + x.domain + " mention this name";
    return f ? { firm_id: f.id, name: f.name, firm_type: f.firm_type || "", website: f.website || "", score: 0.8, why: why, source: "gmail" }
      : { firm_id: "", name: oxFirmish(parts[parts.length - 1]) ? parts[parts.length - 1] : oxTitle(x.domain.split(".")[0]), website: "https://" + x.domain, people: ppl, score: 0.6, why: why, source: "gmail" };
  });
}
function oxAiPost(payload, beta) {
  var key = aiKey(); if (!key) throw new Error("Connect the AI key first (Import & tools → AI email writer).");
  var h = { "x-api-key": key, "anthropic-version": OX_AI.version }; if (beta) h["anthropic-beta"] = beta;
  var r = UrlFetchApp.fetch(OX_AI.url, { method: "post", contentType: "application/json", payload: JSON.stringify(payload), headers: h, muteHttpExceptions: true }), j = null;
  try { j = JSON.parse(r.getContentText()); } catch (e) {}
  var code = r.getResponseCode();
  if (code === 401 || code === 403) throw new Error("The AI key was rejected. Reconnect it in Import & tools.");
  if (code === 429 || code === 529) throw new Error("Claude is busy right now. Try again in a minute.");
  if (code >= 300 || !j) throw new Error("Claude didn't answer (" + code + ").");
  return j;
}
function oxJsonIn(txt) {
  var s = String(txt || ""), a = s.indexOf("{"), b = s.lastIndexOf("}"); if (a < 0 || b < a) return null;
  try { return JSON.parse(s.slice(a, b + 1)); } catch (e) {}
  var c = s.lastIndexOf("{", b); while (c > -1) { try { return JSON.parse(s.slice(c, b + 1)); } catch (e2) {} c = s.lastIndexOf("{", c - 1); }
  return null;
}
function oxAiText(j) { return (j.content || []).filter(function (x) { return x.type === "text"; }).map(function (x) { return x.text; }).join("\n"); }
function oxAiWebFirm(r, p) {
  var c = CacheService.getScriptCache(), hk = "oxweb:" + Utilities.formatDate(new Date(), "UTC", "yyyyMMddHH"), used = Number(c.get(hk) || 0);
  if (used >= OX_WEB.perHour) throw new Error("That's " + OX_WEB.perHour + " internet searches this hour. Try again later."); c.put(hk, String(used + 1), 3700);
  var role = OX_ROLE_TXT[r.role] || r.role, prompt = [
    "A building permit or design-review agenda in " + (p ? p.town : "the San Francisco Peninsula") + ", California names this " + role + ": \"" + r.raw + "\".",
    p ? "Project: " + oxStreetFull(p) + ", " + p.town + ". " + String(p.description || "").slice(0, 300) : "",
    "Use web search to find the design or building firm this refers to. If it's a person, find the firm they work for. Prefer the firm's own website, the California contractors or architects license boards, AIA and Houzz listings.",
    "Only report what the sources show. If you can't tell which firm it is, say found: false.",
    "Reply with only this JSON: {\"found\": true, \"firm_name\": \"\", \"firm_type\": \"Architect | Landscape Architect | Designer | Builder | Engineer | Other\", \"website\": \"\", \"phone\": \"\", \"city\": \"\", \"person\": \"\", \"person_title\": \"\", \"email\": \"\", \"confidence\": \"high | medium | low\", \"why\": \"one sentence\", \"sources\": [\"url\"]}"
  ].filter(Boolean).join("\n");
  var msgs = [{ role: "user", content: prompt }], j = null, searches = 0, tin = 0, tout = 0;
  for (var i = 0; i < 3; i++) {
    j = oxAiPost({ model: OX_WEB.model, max_tokens: 3000, messages: msgs, tools: [{ type: "web_search_20260209", name: "web_search", max_uses: 4 }], output_config: { effort: "low" } });
    var u = j.usage || {}; tin += u.input_tokens || 0; tout += u.output_tokens || 0; searches += ((u.server_tool_use || {}).web_search_requests) || 0;
    if (j.stop_reason !== "pause_turn") break; msgs = [msgs[0], { role: "assistant", content: j.content }];
  }
  if (j.stop_reason === "refusal") throw new Error("Claude declined this search.");
  var out = oxJsonIn(oxAiText(j)) || { found: false, why: "No clear answer." };
  out.cost = Math.round((tin / 1e6 * OX_WEB.inPerM + tout / 1e6 * OX_WEB.outPerM + searches * OX_WEB.perSearch) * 1000) / 1000; out.searches = searches;
  return out;
}
ACTIONS.oxLinkSuggest = function (me, b) {
  oxNeed(me); var r = findBy("OxRoles", "id", String(b.role_id || "")); if (!r) throw new Error("Not found."); if (r.role === "owner") throw new Error("Owners are never linked to outreach.");
  var p = findBy("OxProjects", "id", r.project_id), same = rows("OxRoles").filter(function (x) { return x.id !== r.id && !x.firm_id && x.role !== "owner" && oxNorm(x.raw) === oxNorm(r.raw); }).length;
  var out = { raw: r.raw, role: OX_ROLE_TXT[r.role] || r.role, town: p ? p.town : "", street: p ? oxStreetFull(p) : "", same: same, web_ok: !!aiKey(), candidates: oxLocalMatches(r.raw) };
  oxGmailFirm(r.raw, me).forEach(function (g) { if (!out.candidates.some(function (c) { return (g.firm_id && c.firm_id === g.firm_id) || (!g.firm_id && c.website === g.website); })) out.candidates.push(g); });
  if (b.web) {
    var w = oxAiWebFirm(r, p); out.web = { cost: w.cost, searches: w.searches, found: !!w.found && !!w.firm_name, why: w.why || "" };
    if (out.web.found) {
      var dom = oxDomain({ website: w.website || "" }), f = oxFirmByDomain(dom) || rows("OxFirms").filter(function (x) { return oxNameScore(w.firm_name, x.name) >= 0.75; })[0];
      var cand = { firm_id: f ? f.id : "", name: f ? f.name : w.firm_name, firm_type: (f && f.firm_type) || w.firm_type || "", website: (f && f.website) || (dom ? "https://" + dom : ""), phone: (f && f.phone) || w.phone || "", city: w.city || "",
        person: w.person || "", person_title: w.person_title || "", email: /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(w.email || "") ? normEmail(w.email) : "", confidence: w.confidence || "low", why: (f ? "Found online, and it's already your firm. " : "Found online. ") + (w.why || ""),
        sources: [].concat(w.sources || []).filter(function (s) { return /^https?:\/\//.test(s); }).slice(0, 4), score: { high: 0.85, medium: 0.65, low: 0.4 }[w.confidence] || 0.4, source: "web" };
      out.candidates = out.candidates.filter(function (c) { return !(cand.firm_id && c.firm_id === cand.firm_id); }); out.candidates.unshift(cand);
    }
  }
  out.candidates.sort(function (a, c) { return (c.source === "web" ? 1 : 0) - (a.source === "web" ? 1 : 0) || c.score - a.score; });
  return out;
};
NO_LOCK.oxLinkSuggest = 1; PREFETCH.oxLinkSuggest = OX_T.concat(["People"]);
/* Link it: to a firm you have, or a new one from a suggestion (with the person and email it found). "same" links every other
   unlinked mention of the same name too. */
ACTIONS.oxLinkFirm = function (me, b) {
  oxNeed(me); var r = findBy("OxRoles", "id", String(b.role_id || "")); if (!r) throw new Error("Not found."); if (r.role === "owner") throw new Error("Owners are never linked to outreach.");
  var fid = String(b.firm_id || ""), nf = b.new_firm, t = now(), made = false;
  if (!fid && nf) {
    var nm = clean(nf.name, 200); if (!nm) throw new Error("Write the firm's name.");
    var ex = rows("OxFirms").filter(function (x) { return x.norm === oxNorm(nm); })[0] || oxFirmByDomain(oxDomain({ website: nf.website || "" }));
    if (ex) fid = ex.id;
    else { fid = ACTIONS.oxSaveFirm(me, { firm: { name: nm, firm_type: clean(nf.firm_type, 80), website: clean(nf.website, 200), phone: clean(nf.phone, 40), segment: "cold",
      notes: nf.why ? "Found by " + (nf.source === "web" ? "internet search" : nf.source === "gmail" ? "your Gmail" : "the portal") + ": " + clean(nf.why, 300) + ([].concat(nf.sources || []).length ? " Sources: " + [].concat(nf.sources).slice(0, 3).join(" ") : "") : "" } }).id; made = true; }
    var ppl = [].concat(nf.people || []); if (nf.person || nf.email) ppl.unshift({ name: nf.person || "", email: nf.email || "", role: nf.person_title || "" });
    var have = rows("OxContacts").filter(function (c) { return c.firm_id === fid; });
    ppl.slice(0, 4).forEach(function (x) { var e = normEmail(x.email || ""); if (!x.name && !e) return; if (have.some(function (c) { return (e && normEmail(c.email) === e) || (x.name && c.name && oxSame(c.name, x.name)); })) return;
      var ct = { id: newId("oc"), firm_id: fid, name: clean(x.name, 120), role: clean(x.role, 120), email: /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e) ? e : "", phone: "", source: nf.source === "gmail" ? "gmail" : "web", verified: nf.source === "gmail" ? "yes" : "no", created_at: t, updated_at: t };
      insert("OxContacts", ct); have.push(ct); });
  }
  if (!fid || !findBy("OxFirms", "id", fid)) throw new Error("Pick a firm.");
  var n = 0; rows("OxRoles").filter(function (x) { return x.id === r.id || (b.same && !x.firm_id && x.role !== "owner" && oxNorm(x.raw) === oxNorm(r.raw)); }).forEach(function (x) { update("OxRoles", "id", x.id, { firm_id: fid, source: "manual" }); n++; });
  return { firm_id: fid, created: made, linked: n };
};
PREFETCH.oxLinkFirm = OX_T.concat(["People"]);

/* ====================================== The cities, read every week ======================================
   Instead of asking Grok each week, the portal reads the towns' own meeting agendas (design review boards and planning
   commissions, where a project shows up first with its architect) and Palo Alto's open permit list.
   - agendas: Claude (Haiku, a fraction of a cent each) turns each agenda's text into project rows; Palo Alto needs no AI
   - only residential work we'd bid (A/B fit); owners are kept only to never contact them
   - an address you already track isn't re-imported: its new names are added, nothing is overwritten
   - each agenda is read once; the job runs every Monday morning and from the "Check the cities now" button */
TABLES.OxCityLog = ["id", "town", "source", "ref", "url", "title", "meeting_date", "at", "status", "found", "added", "note", "cost", "by"];
OX_T.push("OxCityLog");
var OX_CITY_BODY = /architect|design review|site review|planning commission|site development|special project|zoning administrator/i, OX_CITY_SKIP = /cancel|packet|minutes|notice of/i;
var OX_CITY = [
  { town: "Palo Alto", kind: "paloalto", url: "https://data.paloalto.gov/rest/datastreams/298718/data.csv" },
  { town: "Woodside", kind: "civicplus", base: "https://www.woodsideca.gov" },
  { town: "Hillsborough", kind: "civicplus", base: "https://www.hillsborough.net" },
  { town: "Los Altos Hills", kind: "civicplus", base: "https://www.losaltoshills.ca.gov" },
  { town: "Saratoga", kind: "civicplus", base: "https://www.saratoga.ca.us" },
  { town: "Burlingame", kind: "legistar", client: "burlingameca" },
  { town: "Atherton", kind: "primegov", host: "https://atherton.primegov.com" },
  { town: "Los Altos", kind: "civicclerk", host: "https://losaltosca.api.civicclerk.com" }
];
var OX_READ = { model: "claude-haiku-5-5", inPerM: 0.1, outPerM: 0.5, maxChars: 60000, perRun: 8, lookbackDays: 21 };
function oxCityGet(url, json) {
  var r = UrlFetchApp.fetch(url, { muteHttpExceptions: true, followRedirects: true, headers: { "User-Agent": "Mozilla/5.0 (Blue Sierra permit reader)", Accept: json ? "application/json" : "*/*" } });
  if (r.getResponseCode() >= 300) throw new Error(url.split("/")[2] + " answered " + r.getResponseCode());
  return json ? JSON.parse(r.getContentText()) : r.getContentText();
}
function oxHtmlText(h) {
  return String(h || "").replace(/<(script|style)[\s\S]*?<\/\1>/gi, " ").replace(/<br\s*\/?>|<\/(p|div|tr|li|h\d)>/gi, "\n").replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;|&#160;/g, " ").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;|&rsquo;|&#8217;/g, "'")
    .replace(/[ \t ]+/g, " ").replace(/\n\s*\n+/g, "\n").trim();
}
/* each source → its recent agendas: { ref, title, date, url, textUrl | itemsUrl } */
function oxCityAgendas(src, since, until) {
  var out = [];
  if (src.kind === "civicplus") {
    var x = oxCityGet(src.base + "/RSSFeed.aspx?ModID=65&CID=All-0");
    (x.match(/<item>[\s\S]*?<\/item>/g) || []).forEach(function (it) {
      var title = oxHtmlText((it.match(/<title>([\s\S]*?)<\/title>/) || [])[1] || ""), link = ((it.match(/<link>([\s\S]*?)<\/link>/) || [])[1] || "").trim(), id = (link.match(/(\d+)\s*$/) || [])[1];
      if (!id || !OX_CITY_BODY.test(title) || OX_CITY_SKIP.test(title)) return;
      out.push({ ref: "cp-" + id, title: title, date: "", url: "", page: /^http/.test(link) ? link : src.base + link, id: id });
    });
    out.forEach(function (a) { try { var pg = oxCityGet(a.page), m = pg.match(new RegExp("/AgendaCenter/ViewFile/Agenda/_(\\d{2})(\\d{2})(\\d{4})-" + a.id)); if (m) { a.date = m[3] + "-" + m[1] + "-" + m[2]; a.url = src.base + "/AgendaCenter/ViewFile/Agenda/_" + m[1] + m[2] + m[3] + "-" + a.id; a.textUrl = a.url + "?html=true"; } } catch (e) { a.err = e.message; } });
    out = out.filter(function (a) { return a.url; });
  } else if (src.kind === "legistar") {
    var ev = oxCityGet("https://webapi.legistar.com/v1/" + src.client + "/events?$top=25&$orderby=EventDate%20desc", true);
    ev.forEach(function (e) { if (!OX_CITY_BODY.test(e.EventBodyName || "")) return; out.push({ ref: "lg-" + e.EventId, title: e.EventBodyName, date: String(e.EventDate || "").slice(0, 10), url: e.EventInSiteURL || e.EventAgendaFile || "", itemsUrl: "https://webapi.legistar.com/v1/" + src.client + "/events/" + e.EventId + "/eventitems" }); });
  } else if (src.kind === "primegov") {
    var ms = oxCityGet(src.host + "/api/v2/PublicPortal/ListUpcomingMeetings", true); try { ms = ms.concat(oxCityGet(src.host + "/api/v2/PublicPortal/ListArchivedMeetings?year=" + since.slice(0, 4), true)); } catch (e) {}
    ms.forEach(function (m) { if (!OX_CITY_BODY.test(m.title || "")) return; var doc = (m.documentList || []).filter(function (d) { return /html agenda/i.test(d.templateName || ""); })[0] || (m.documentList || []).filter(function (d) { return /^agenda$/i.test(d.templateName || ""); })[0]; if (!doc) return;
      out.push({ ref: "pg-" + m.id + "-" + doc.templateId, title: m.title, date: String(m.dateTime || "").slice(0, 10), url: src.host + "/Portal/Meeting?meetingTemplateId=" + doc.templateId, textUrl: src.host + "/Portal/Meeting?meetingTemplateId=" + doc.templateId }); });
  } else if (src.kind === "civicclerk") {
    var j = oxCityGet(src.host + "/v1/Events?$filter=startDateTime%20ge%20" + since + "T00:00:00Z%20and%20startDateTime%20le%20" + until + "T23:59:59Z&$orderby=startDateTime%20desc&$top=30", true);
    (j.value || []).forEach(function (e) { if (!OX_CITY_BODY.test(e.eventName || "")) return; (e.publishedFiles || []).forEach(function (f) { if (!/^agenda$/i.test(f.type || "") || OX_CITY_SKIP.test(f.name || "")) return;
      out.push({ ref: "cc-" + f.fileId, title: e.eventName, date: String(e.startDateTime || "").slice(0, 10), url: src.host + "/v1/Meetings/GetMeetingFileStream(fileId=" + f.fileId + ",plainText=false)", textUrl: src.host + "/v1/Meetings/GetMeetingFileStream(fileId=" + f.fileId + ",plainText=true)" }); }); });
  }
  return out.filter(function (a) { return a.date && a.date >= since && a.date <= until; });
}
function oxAgendaText(a) {                                                  // the agenda as text, or { pdf: base64 } when the town only publishes a PDF
  if (a.itemsUrl) return oxCityGet(a.itemsUrl, true).map(function (x) { return String(x.EventItemTitle || "").trim(); }).filter(function (t) { return /\d/.test(t.slice(0, 80)) && t.length > 30; }).join("\n\n");
  var r = UrlFetchApp.fetch(a.textUrl, { muteHttpExceptions: true, followRedirects: true, headers: { "User-Agent": "Mozilla/5.0 (Blue Sierra permit reader)" } });
  if (r.getResponseCode() >= 300) throw new Error(a.textUrl.split("/")[2] + " answered " + r.getResponseCode());
  var b = r.getContent();
  if (b.length > 4 && b[0] === 37 && b[1] === 80 && b[2] === 68 && b[3] === 70) { if (b.length > 9000000) throw new Error("agenda PDF is too big to read (" + Math.round(b.length / 1e6) + " MB)"); return { pdf: Utilities.base64Encode(b) }; }
  var t = r.getContentText(); return /<html|<body|<div/i.test(t.slice(0, 2000)) ? oxHtmlText(t) : t;
}
var OX_READ_SCHEMA = { type: "object", additionalProperties: false, required: ["items"], properties: { items: { type: "array", items: { type: "object", additionalProperties: false,
  required: ["address", "case_numbers", "description", "project_type", "fit_tier", "architect", "landscape_architect", "applicant", "contractor", "engineer", "owner"],
  properties: { address: { type: "string" }, case_numbers: { type: "string" }, description: { type: "string" }, project_type: { type: "string", enum: ["new_home", "major_remodel", "landscape", "grading", "pool", "tree", "other"] },
    fit_tier: { type: "string", enum: ["A", "B", "C"] }, architect: { type: "string" }, landscape_architect: { type: "string" }, applicant: { type: "string" }, contractor: { type: "string" }, engineer: { type: "string" }, owner: { type: "string" } } } } } };
function oxAiReadAgenda(text, town, title, date) {
  var sys = ["You read a town meeting agenda from " + town + ", California and list each private property project on it.",
    "Blue Sierra Construction bids site work, hardscape, pools and landscape on custom homes. Fit: A = new home, a full rebuild, or a remodel with a new pool, landscape, grading or site work; B = a major remodel or addition that likely changes the yard; C = anything else (interior, signs, commercial, policy items, minutes, trees only).",
    "For each project item: the street address as written (number and street), the case or permit numbers, a one-sentence description, the type, the fit, and the names given for the architect or designer, landscape architect, applicant, contractor, engineer and property owner (\"\" when not named). When a line says \"Applicant and Architect: X\", put X in both. Keep firm names with the person (\"Peter Mason, Mason Architects\").",
    "Skip items with no street address. Use only what the agenda says."].join("\n");
  var content = text && text.pdf ? [{ type: "document", source: { type: "base64", media_type: "application/pdf", data: text.pdf } }, { type: "text", text: title + " · " + date + ": list the projects on this agenda." }] : title + " · " + date + "\n\n" + String(text).slice(0, OX_READ.maxChars);
  var j = oxAiPost({ model: OX_READ.model, max_tokens: 8000, system: sys, messages: [{ role: "user", content: content }], output_config: { effort: "low", format: { type: "json_schema", schema: OX_READ_SCHEMA } } });
  if (j.stop_reason === "refusal") throw new Error("Claude declined this agenda.");
  var u = j.usage || {}, out = oxJsonIn(oxAiText(j)) || { items: [] };
  out.cost = Math.round(((u.input_tokens || 0) / 1e6 * OX_READ.inPerM + (u.output_tokens || 0) / 1e6 * OX_READ.outPerM) * 10000) / 10000;
  return out;
}
var OX_PA_YES = /single[- ]family|new (residence|home|dwelling|sfd|sfr)|addition|remodel|swimming pool|\bpool\b|landscap|hardscap|grading|retaining wall|site work|site improvement/i, OX_PA_NO = /instant permit|re-?roof|solar|photovoltaic|heat pump|water heater|ev charger|electric(al)? (service|panel)|hvac|furnace|window replacement|like[- ]for[- ]like|sewer lateral|demolition only|fire sprinkler|tenant improvement|commercial/i;
function oxPaloAltoRows(since) {
  var csv = Utilities.parseCsv(oxCityGet(OX_CITY.filter(function (s) { return s.kind === "paloalto"; })[0].url)); if (!csv.length) return [];
  var h = csv[0].map(function (x) { return String(x).replace(/^﻿/, "").trim().toUpperCase(); }), ix = function (k) { return h.indexOf(k); }, out = [];
  csv.slice(1).forEach(function (r) {
    var g = function (k) { var i = ix(k); return i > -1 ? String(r[i] || "").trim() : ""; }, desc = g("DESCRIPTION"), d = g("DATE OPENED").match(/^(\d+)\/(\d+)\/(\d{4})/), val = Number(g("JOB VALUE").replace(/[^\d.]/g, "")) || 0;
    if (!d) return; var ymd = d[3] + "-" + ("0" + d[1]).slice(-2) + "-" + ("0" + d[2]).slice(-2); if (ymd < since || !/building/i.test(g("RECORD MODULE"))) return;
    if (!OX_PA_YES.test(desc) || OX_PA_NO.test(desc) || /^\s*(com|comm|commercial|mf|multi[- ]?family)\b/i.test(desc) || !/^\s*(res|residential)\b|single[- ]family/i.test(desc)) return;   // homes only
    var type = /\bnew\b.{0,40}(residence|home|dwelling|single[- ]family|sfd|sfr)/i.test(desc) ? "new_home" : /pool/i.test(desc) ? "pool" : /landscap|hardscap/i.test(desc) ? "landscape" : /grading|retaining|site work|site improvement/i.test(desc) ? "grading" : "major_remodel";
    if (type === "major_remodel" && val < 250000) return; if (val && val < 30000) return;
    var addr = g("ADDR FULL LINE").split(",")[0].replace(/\b([A-Z])([A-Z]+)\b/g, function (m0, a, b) { return a + b.toLowerCase(); });
    out.push({ permit_no: g("RECORD ID"), address: addr, city: "Palo Alto", description: desc.slice(0, 600), status_raw: g("RECORD STATUS") + " " + g("RECORD STATUS DATE"), project_type: type, all_types: type, fit_tier: type === "major_remodel" && val < 600000 ? "B" : "A",
      stage_order: /issued/i.test(g("RECORD STATUS")) ? "4" : "2", date: ymd, contractor: g("BUSINESS NAME"), source_url: "https://data.paloalto.gov/dataviews/265480/", next_step: "Permit " + (/issued/i.test(g("RECORD STATUS")) ? "issued " : "filed ") + ymd + (val ? " · job value $" + Math.round(val).toLocaleString() : "") });
  });
  return out;
}
/* rows from a reader → new projects through the normal import; addresses you already track only gain the new names */
function oxCityIngest(list, me, label) {
  var have = rows("OxProjects"), byAddr = {}; have.forEach(function (p) { byAddr[oxAddrKey(p.address, p.town)] = p; });
  var zoneOf = {}; have.forEach(function (p) { if (p.zone) { var z = zoneOf[p.town] = zoneOf[p.town] || {}; z[p.zone] = (z[p.zone] || 0) + 1; } });
  var fresh = [], seen = {}, rolesAdd = [], firms = rows("OxFirms"), roles = rows("OxRoles"), names = 0;
  list.forEach(function (r) {
    if (!/^\d+[A-Za-z]?\s+\S/.test(String(r.address || "").trim())) return; var k = oxAddrKey(r.address, r.city); if (seen[k]) return; seen[k] = 1;
    var p = byAddr[k];
    if (!p) { var z = zoneOf[r.city] || {}; r.zone = r.zone || Object.keys(z).sort(function (a, b) { return z[b] - z[a]; })[0] || ""; fresh.push(r); return; }
    [["architect", "architect"], ["landscape_architect", "landscape_architect"], ["contractor", "contractor"], ["engineer", "engineer"], ["applicant", "applicant"], ["owner_do_not_contact", "owner"]].forEach(function (col) {
      String(r[col[0]] || "").split(";").map(function (x) { return x.trim(); }).filter(Boolean).forEach(function (raw) {
        if (roles.concat(rolesAdd).some(function (x) { return x.project_id === p.id && x.role === col[1] && oxNorm(x.raw) === oxNorm(raw); })) return;
        var f = col[1] === "owner" ? null : oxFindFirm(firms, raw); rolesAdd.push({ id: newId("or"), project_id: p.id, firm_id: f ? f.id : "", role: col[1], raw: raw, source: "agenda" }); names++;
      }); });
    if (r.source_url && String(p.source_url || "").indexOf(r.source_url) < 0) update("OxProjects", "id", p.id, { source_url: (p.source_url ? p.source_url + " ; " : "") + r.source_url + " " + (r.next_step || ""), updated_at: now() });
  });
  if (rolesAdd.length) oxAppend("OxRoles", rolesAdd);
  var c = fresh.length ? ACTIONS.oxImport(me, { kind: "projects", rows: fresh, file: label }).counts : { new: 0 };
  return { added: c.new || 0, names: names };
}
function oxCityRun(me, b) {
  var start = Date.now(), today = oxToday(), log = rows("OxCityLog"), done = {}, out = { towns: [], added: 0, names: 0, cost: 0, more: false, ai: !!aiKey() };
  log.forEach(function (x) { if (x.status === "read" || x.status === "empty") done[x.town + "|" + x.ref] = 1; });
  var since = oxAdd(today, -(Number(b.days) || OX_READ.lookbackDays)), until = oxAdd(today, 30), reads = 0, towns = b.towns ? [].concat(b.towns) : null;
  for (var i = 0; i < OX_CITY.length; i++) {
    var src = OX_CITY[i]; if (towns && towns.indexOf(src.town) < 0) continue; var res = { town: src.town, agendas: 0, read: 0, added: 0, names: 0, note: "" };
    try {
      if (src.kind === "paloalto") {
        var last = log.filter(function (x) { return x.town === "Palo Alto" && x.status === "read"; }).map(function (x) { return String(x.at); }).sort().pop(), from = last && !b.days ? oxAdd(last.slice(0, 10), -3) : since;
        if (last && last.slice(0, 10) === today && !b.force) { res.note = "already read today"; }
        else { var pa = oxPaloAltoRows(from), ig = oxCityIngest(pa, me, "Palo Alto open data " + today); res.agendas = 1; res.read = 1; res.added = ig.added; res.names = ig.names; res.found = pa.length;
          insert("OxCityLog", { id: newId("ol"), town: "Palo Alto", source: "open data", ref: "pa-" + today, url: src.url, title: "Permits since " + from, meeting_date: today, at: now(), status: "read", found: pa.length, added: ig.added, note: "", cost: 0, by: me.email }); }
      } else {
        var ags = oxCityAgendas(src, since, until).filter(function (a) { return !done[src.town + "|" + a.ref]; }); res.agendas = ags.length;
        for (var k = 0; k < ags.length; k++) {
          var a = ags[k];
          if (!out.ai) { res.note = "needs the AI key to read agendas"; break; }
          if (reads >= OX_READ.perRun || Date.now() - start > 240000) { out.more = true; break; }
          var txt = oxAgendaText(a); reads++;
          if (!txt || (typeof txt === "string" && txt.length < 200)) { insert("OxCityLog", { id: newId("ol"), town: src.town, source: src.kind, ref: a.ref, url: a.url, title: a.title, meeting_date: a.date, at: now(), status: "empty", found: 0, added: 0, note: "no text", cost: 0, by: me.email }); continue; }
          var ai = oxAiReadAgenda(txt, src.town, a.title, a.date), items = (ai.items || []).filter(function (x) { return x.fit_tier !== "C"; });
          var rowsIn = items.map(function (x) { return { permit_no: x.case_numbers, address: x.address, city: src.town, description: x.description, status_raw: a.title + " " + a.date, project_type: x.project_type, all_types: x.project_type, fit_tier: x.fit_tier,
            stage_order: "1", date: a.date, architect: x.architect, landscape_architect: x.landscape_architect, applicant: x.applicant, contractor: x.contractor, engineer: x.engineer, owner_do_not_contact: x.owner, source_url: a.url, next_step: "On the " + a.title + " agenda " + a.date }; });
          var ig2 = oxCityIngest(rowsIn, me, src.town + " · " + a.title + " " + a.date); res.read++; res.added += ig2.added; res.names += ig2.names; out.cost += ai.cost || 0;
          insert("OxCityLog", { id: newId("ol"), town: src.town, source: src.kind, ref: a.ref, url: a.url, title: a.title, meeting_date: a.date, at: now(), status: "read", found: (ai.items || []).length, added: ig2.added, note: items.length + " fit", cost: ai.cost || 0, by: me.email });
        }
      }
    } catch (e) { res.note = String(e.message || e).slice(0, 160); insert("OxCityLog", { id: newId("ol"), town: src.town, source: src.kind, ref: "err-" + today + "-" + i, url: "", title: "", meeting_date: today, at: now(), status: "error", found: 0, added: 0, note: res.note, cost: 0, by: me.email }); }
    out.added += res.added; out.names += res.names; out.towns.push(res);
    if (out.more) break;
  }
  out.cost = Math.round(out.cost * 1000) / 1000;
  return out;
}
function oxCityEnsure() {
  try { var has = ScriptApp.getProjectTriggers().some(function (t) { return t.getHandlerFunction() === "oxCityWeekly"; });
    if (!has) ScriptApp.newTrigger("oxCityWeekly").timeBased().onWeekDay(ScriptApp.WeekDay.MONDAY).atHour(7).inTimezone(CONFIG.TZ).create(); return true; } catch (e) { console.warn("oxCityEnsure: " + e.message); return false; }
}
function oxCityWeekly() {                                                    // the Monday job: runs as Jesús, reads everything new
  var adm = rows("People").filter(function (x) { return x.role === "admin" && isTrue(x.active); })[0]; if (!adm) return;
  var me = { email: adm.email, name: adm.name, role: "admin" }, r = oxCityRun(me, {}); if (r.more) r = oxCityRun(me, {});
  PropertiesService.getScriptProperties().setProperty("OX_CITY_LAST", JSON.stringify({ at: now(), added: r.added, names: r.names, cost: r.cost, auto: true }));
}
ACTIONS.oxCityRun = function (me, b) {
  oxNeed(me); var r = oxCityRun(me, b || {}); r.weekly = oxCityEnsure();
  PropertiesService.getScriptProperties().setProperty("OX_CITY_LAST", JSON.stringify({ at: now(), added: r.added, names: r.names, cost: r.cost, by: me.name || me.email }));
  return r;
};
PREFETCH.oxCityRun = OX_T.concat(["People"]);
function oxCityHome() {
  var last = null; try { last = JSON.parse(PropertiesService.getScriptProperties().getProperty("OX_CITY_LAST") || "null"); } catch (e) {}
  var log = rows("OxCityLog"), towns = OX_CITY.map(function (s) { var l = log.filter(function (x) { return x.town === s.town; }), ok = l.filter(function (x) { return x.status === "read"; }).pop(), err = l.filter(function (x) { return x.status === "error"; }).pop();
    return { town: s.town, kind: s.kind, last: ok ? String(ok.at).slice(0, 10) : "", title: ok ? ok.title : "", added: l.reduce(function (t, x) { return t + (Number(x.added) || 0); }, 0), error: err && (!ok || String(err.at) > String(ok.at)) ? err.note : "" }; });
  return { last: last, towns: towns, ai: !!aiKey() };
}

/* ====================================== The setter inside the portal ======================================
   1) The Academy (the setter's course) now lives in the portal: progress is saved here per person, Jesús sees it.
   2) "What Jesús reached": every firm we've emailed, called or heard from lately, so the setter never doubles up.
   3) Follow-up emails: the setter prepares one after a call; it waits in Jesús's drafts and only he sends it. */
TABLES.AcProgress = ["email", "data", "updated_at", "certified_at", "results"];
function acNeed(me) { if (!me || (me.role !== "setter" && me.role !== "admin")) throw new Error("The Academy is for the appointment setter."); }
ACTIONS.acLoad = function (me, b) {
  acNeed(me); var em = me.role === "admin" && b && b.email ? normEmail(b.email) : normEmail(me.email), r = findBy("AcProgress", "email", em), d = null;
  if (r && r.data) { try { d = JSON.parse(r.data); } catch (e) { d = null; } }
  return { data: d, roleLabel: "Appointment Setter" };
};
NO_LOCK.acLoad = 1; READ_ONLY.acLoad = 1;
ACTIONS.acSave = function (me, b) {
  acNeed(me); if (me.preview) throw new Error("This is a preview. Nothing is saved.");
  var d = b.data || {}; if (typeof d !== "object") throw new Error("Nothing to save.");
  d.events = [].concat(d.events || []).slice(-200);
  var s = JSON.stringify(d); if (s.length > 45000) throw new Error("Progress is too big to save.");
  var em = normEmail(me.email), r = findBy("AcProgress", "email", em), t = now();
  if (r) update("AcProgress", "email", em, { data: s, updated_at: t }); else insert("AcProgress", { email: em, data: s, updated_at: t, certified_at: "", results: "" });
  return { ok: true };
};
ACTIONS.acCertify = function (me, b) {
  acNeed(me); if (me.preview) throw new Error("This is a preview. Nothing is sent.");
  var em = normEmail(me.email), results = clean(b.results, 1200), t = now();
  if (!findBy("AcProgress", "email", em)) insert("AcProgress", { email: em, data: "{}", updated_at: t, certified_at: t, results: results });
  else update("AcProgress", "email", em, { certified_at: t, results: results, updated_at: t });
  rows("People").filter(function (x) { return x.role === "admin" && isTrue(x.active); }).forEach(function (a) {
    safeMail(function () { sendMail(a.email, "🎓 " + (me.name || em) + " finished the setter certification", "<p><b>" + esc(me.name || em) + "</b> passed the Appointment Setter course in the portal and confirmed the rules.</p><p>" + esc(results) + "</p>"); });
  });
  return { ok: true, at: t };
};
/* For Jesús: each setter's course progress. */
ACTIONS.acTeam = function (me) {
  if (!me || me.role !== "admin") throw new Error("Only Jesús sees the team's progress.");
  var mods = ["m1", "m2", "m3p", "m4", "m5", "m6", "m7p", "m8p"], prog = {}; rows("AcProgress").forEach(function (r) { prog[normEmail(r.email)] = r; });
  return { setters: rows("People").filter(function (x) { return x.role === "setter" && isTrue(x.active); }).map(function (p) {
    var r = prog[normEmail(p.email)], d = {}; try { d = r && r.data ? JSON.parse(r.data) : {}; } catch (e) { d = {}; }
    var m = d.modules || {}, ev = (d.events || []).slice(-1)[0] || null;
    return { name: p.name, email: p.email, started: d.started || "", passed: mods.filter(function (k) { return m[k] && m[k].passed; }).length, of: mods.length,
      final: d.final ? { best: d.final.best || 0, passed: d.final.passed || "" } : null, drill: d.drill ? d.drill.best || 0 : null, sim: d.sim ? d.sim.best || 0 : null,
      certified: r && r.certified_at ? String(r.certified_at).slice(0, 10) : "", results: r ? r.results || "" : "", last: ev ? { at: (function () { var dt = new Date(ev.at); return isNaN(dt) ? String(ev.at || "").slice(0, 10) : Utilities.formatDate(dt, CONFIG.TZ, "yyyy-MM-dd"); })(), event: ev.event, detail: ev.detail || "", score: ev.score } : null };
  }) };
};
NO_LOCK.acTeam = 1;

/* What Jesús (and the office) already did, by firm, newest first: so the setter knows who's been reached and how. */
ACTIONS.oxSetterReached = function (me, b) {
  oxCallNeed(me); var today = oxToday(), since = oxAdd(today, -(Number(b && b.days) || 45)), firms = {}, pById = {}, cts = {};
  rows("OxFirms").forEach(function (f) { firms[f.id] = f; }); rows("OxProjects").forEach(function (p) { pById[p.id] = p; }); rows("OxContacts").forEach(function (c) { cts[c.id] = c; });
  var pool = oxCallPool(today), onList = {}; pool.items.forEach(function (it) { onList[it.f.id] = it.kind; });
  var meets = {}; rows("OxMeetings").forEach(function (m) { if (m.status === "booked" && m.day >= today) meets[m.firm_id] = m.day + " " + m.time; });
  var by = {};
  rows("OxTouches").forEach(function (t) {
    if (t.date < since || ["email", "reply", "call", "linkedin", "note", "site_walk"].indexOf(t.channel) < 0 || !firms[t.firm_id]) return;
    (by[t.firm_id] = by[t.firm_id] || []).push(t);
  });
  var CH = { email: "✉️", reply: "💬", call: "📞", linkedin: "💼", note: "📝", site_walk: "🚶" };
  var out = Object.keys(by).map(function (fid) {
    var f = firms[fid], fl = oxFlags(f), list = by[fid].sort(function (a, c) { return a.date < c.date ? 1 : -1; }), st = oxState(f, rows("OxTouches").filter(function (x) { return x.firm_id === fid; }), today);
    var items = list.slice(0, 5).map(function (t) {
      var p = t.project_id ? pById[t.project_id] : null, k = cts[t.contact_id], who = personName(t.by) || t.by, firstWho = String(who || "").split(" ")[0];
      var what = t.channel === "email" ? firstWho + " emailed" + (k ? " " + (k.name || k.email) : "") + (t.summary ? ": “" + String(t.summary).replace(/^From your Gmail( to \S+)?: /, "") + "”" : "")
        : t.channel === "reply" ? "They wrote back" + (t.summary ? ": “" + String(t.summary).replace(/^They wrote: |^Replied: /, "") + "”" : "")
        : t.channel === "call" ? firstWho + " called" + (t.outcome ? " (" + (OX_CALL_OUT[t.outcome] || String(t.outcome).replace(/_/g, " ")) + ")" : "") + (t.summary ? ": " + t.summary : "")
        : (t.summary || t.channel);
      return { date: t.date, icon: CH[t.channel] || "•", what: clean(what, 240), street: p ? oxStreetFull(p) + ", " + p.town : "" };
    });
    var status = fl.excluded ? "Not on outreach" : oxJesusOwn(f) || fl.noCall ? "Jesús handles them himself: don't call"
      : meets[fid] ? "Meeting booked " + meets[fid] : st.replied ? "They replied: Jesús follows up" : onList[fid] ? "On your call list" + (onList[fid] === "cadence" ? ": follow-up call due" : onList[fid] === "callback" ? ": callback due" : "")
      : st.due && st.due.channel === "call" ? "Follow-up call on " + st.due.date : "Waiting: nothing for you to do now";
    return { firm_id: fid, firm: f.name, type: f.firm_type || "", last: list[0].date, status: status, callable: !!onList[fid], items: items };
  }).sort(function (a, c) { return a.last < c.last ? 1 : -1; }).slice(0, 150);
  return { since: since, firms: out };
};
NO_LOCK.oxSetterReached = 1; READ_ONLY.oxSetterReached = 1; PREFETCH.oxSetterReached = OX_T.concat(["People"]);


/* ====================================== The setter's day: what was called, and the clock ======================================
   "✓ Called today": every call logged today (the setter's own; Jesús sees everyone's), newest first, so nobody calls twice.
   The clock: a simple clock in / clock out for remote work (no GPS, no jobsite). Hours per day and week, and the calls made in
   each shift, for Jesús to review. A shift left open more than 12 hours closes itself 15 minutes after the last call of it. */
TABLES.SetterShifts = ["id", "email", "in_at", "out_at", "minutes", "calls", "note", "closed_by"];
OX_T.push("SetterShifts");
function oxCalledToday(me, today) {
  var firms = {}; rows("OxFirms").forEach(function (f) { firms[f.id] = f; });
  var pById = {}; rows("OxProjects").forEach(function (p) { pById[p.id] = p; });
  return rows("OxTouches").filter(function (t) { return t.channel === "call" && t.date === today && (me.role !== "setter" || normEmail(t.by) === normEmail(me.email)); })
    .sort(function (a, b) { return String(a.at) < String(b.at) ? 1 : -1; }).slice(0, 200).map(function (t) {
      var p = t.project_id ? pById[t.project_id] : null;
      return { id: t.id, rec: me.role === "admin" && !!(t.rc_session || t.rc_to), secs: Number(t.rc_secs) || 0, firm_id: t.firm_id, firm: (firms[t.firm_id] || {}).name || "", at: String(t.at || ""), outcome: OX_CALL_OUT[t.outcome] || OX_PROJ_OUT[t.outcome] || String(t.outcome || "").replace(/_/g, " "),
        win: ["send_plans", "invited", "referred", "booked", "open"].indexOf(t.outcome) > -1, by: personName(t.by), street: p ? oxStreetFull(p) : "" };
    });
}
function oxMsOf(stamp) { var d = new Date(String(stamp || "").replace(" ", "T")); return isNaN(d) ? 0 : d.getTime(); }
function oxShiftCalls(email, fromMs, toMs) {
  return rows("OxTouches").filter(function (t) { var ms = oxMsOf(t.at); return t.channel === "call" && normEmail(t.by) === normEmail(email) && ms >= fromMs && ms <= toMs; });
}
function oxShiftAutoClose(sh) {                                                          // forgot to clock out
  if (sh.out_at || oxNowMs() - oxMsOf(sh.in_at) < 12 * 3600000) return sh;
  var inMs = oxMsOf(sh.in_at), calls = oxShiftCalls(sh.email, inMs, inMs + 12 * 3600000), last = calls.reduce(function (m, t) { return Math.max(m, oxMsOf(t.at)); }, inMs);
  var outMs = last + 15 * 60000, out = Utilities.formatDate(new Date(outMs), CONFIG.TZ, "yyyy-MM-dd HH:mm");
  var patch = { out_at: out, minutes: Math.round((outMs - inMs) / 60000), calls: calls.length, closed_by: "auto (forgot to clock out)" };
  update("SetterShifts", "id", sh.id, patch); return Object.assign({}, sh, patch);
}
function oxShiftState(me) {
  var mine = rows("SetterShifts").filter(function (x) { return normEmail(x.email) === normEmail(me.email); }).map(oxShiftAutoClose);
  var open = mine.filter(function (x) { return !x.out_at; })[0] || null, today = oxToday(), wk = oxAdd(today, -((oxDow(today) + 6) % 7));
  var sum = function (from) { return mine.filter(function (x) { return String(x.in_at).slice(0, 10) >= from; }).reduce(function (t, x) { return t + (x.out_at ? Number(x.minutes) || 0 : Math.round((oxNowMs() - oxMsOf(x.in_at)) / 60000)); }, 0); };
  return { open: open ? { id: open.id, in_at: open.in_at, since_ms: oxMsOf(open.in_at) } : null, today_min: sum(today), week_min: sum(wk) };
}
ACTIONS.oxShift = function (me, b) {
  if (!me || me.role !== "setter") throw new Error("The clock is for the setter.");
  if (me.preview) throw new Error("This is a preview. Nothing is saved.");
  var st = oxShiftState(me), t = Utilities.formatDate(new Date(oxNowMs()), CONFIG.TZ, "yyyy-MM-dd HH:mm");
  if (b.act === "in") { if (st.open) throw new Error("You're already clocked in."); insert("SetterShifts", { id: newId("sh"), email: normEmail(me.email), in_at: t, out_at: "", minutes: "", calls: "", note: "", closed_by: "" }); }
  else if (b.act === "out") {
    if (!st.open) throw new Error("You're not clocked in.");
    var inMs = st.open.since_ms, mins = Math.max(1, Math.round((oxNowMs() - inMs) / 60000));
    update("SetterShifts", "id", st.open.id, { out_at: t, minutes: mins, calls: oxShiftCalls(me.email, inMs, oxNowMs()).length, note: clean(b.note, 300), closed_by: "setter" });
  } else throw new Error("Clock in or out.");
  return { shift: oxShiftState(me) };
};
PREFETCH.oxShift = OX_T.concat(["People"]);
/* For Jesús: each setter's hours, calls and wins, day by day (this week and last). */
ACTIONS.oxShiftReport = function (me, b) {
  if (!me || me.role !== "admin") throw new Error("Only Jesús sees the hours.");
  var today = oxToday(), from = oxAdd(today, -((oxDow(today) + 6) % 7) - 7), touches = rows("OxTouches"), shifts = rows("SetterShifts").map(oxShiftAutoClose);
  return { from: from, setters: rows("People").filter(function (x) { return x.role === "setter" && isTrue(x.active); }).map(function (p) {
    var em = normEmail(p.email), days = {};
    shifts.filter(function (x) { return normEmail(x.email) === em && String(x.in_at).slice(0, 10) >= from; }).forEach(function (x) {
      var d = String(x.in_at).slice(0, 10), o = days[d] = days[d] || { day: d, minutes: 0, shifts: [], calls: 0, talked: 0, wins: 0 };
      var mins = x.out_at ? Number(x.minutes) || 0 : Math.round((oxNowMs() - oxMsOf(x.in_at)) / 60000); o.minutes += mins;
      o.shifts.push({ in: String(x.in_at).slice(11, 16), out: x.out_at ? String(x.out_at).slice(11, 16) : "", open: !x.out_at, auto: /auto/.test(x.closed_by || ""), minutes: mins });
    });
    touches.filter(function (t) { return t.channel === "call" && normEmail(t.by) === em && t.date >= from; }).forEach(function (t) {
      var o = days[t.date] = days[t.date] || { day: t.date, minutes: 0, shifts: [], calls: 0, talked: 0, wins: 0 }; o.calls++;
      if (["conversation", "callback", "not_interested", "booked", "send_plans", "invited", "referred", "open", "not_bidding", "passed"].indexOf(t.outcome) > -1) o.talked++;
      if (["send_plans", "invited", "referred", "booked"].indexOf(t.outcome) > -1) o.wins++;
    });
    var list = Object.keys(days).sort().reverse().map(function (k) { return days[k]; }), st = oxShiftState({ email: p.email });
    return { name: p.name, email: p.email, clocked_in: st.open ? st.open.in_at : "", today_min: st.today_min, week_min: st.week_min, days: list };
  }) };
};
NO_LOCK.oxShiftReport = 1; PREFETCH.oxShiftReport = OX_T.concat(["People"]);


/* ====================================== RingCentral: calls from the portal, recordings for Jesús ======================================
   The setter calls from RingCentral's own web phone, embedded in the portal (RingCentral Embeddable, with the Blue Sierra app's
   client ID). When a call ends, the portal opens "how did it go?" and saves the call with its RingCentral session.
   Recordings stay in RingCentral: when Jesús presses ▶, the server signs in with a JWT credential (read call log + recordings
   only), finds that call's recording and plays it in the portal. Recording itself (and its announcement) is set in
   RingCentral's admin: automatic recording with "this call may be recorded" for every call (California needs everyone's consent). */
var RC_DEF_SERVER = "https://platform.ringcentral.com";
function rcProp(k) { return PropertiesService.getScriptProperties().getProperty(k) || ""; }
function oxRcPublic() { var id = rcProp("RC_CLIENT_ID"); return id ? { on: true, clientId: id, server: rcProp("RC_SERVER") || RC_DEF_SERVER } : { on: false }; }
function oxRcStamp(t, rc) {                                                              // what the web phone told us about the call
  if (!rc || typeof rc !== "object") return t;
  t.rc_session = clean(rc.session, 120); t.rc_to = String(rc.to || "").replace(/[^\d+]/g, "").slice(-15);
  t.rc_at = /^\d{4}-\d\d-\d\dT/.test(String(rc.at || "")) ? String(rc.at).slice(0, 30) : ""; t.rc_secs = Math.max(0, Math.min(36000, Math.round(Number(rc.secs) || 0))) || "";
  return t;
}
ACTIONS.oxRcSave = function (me, b) {
  if (!me || me.role !== "admin" || me.preview) throw new Error("Only Jesús connects RingCentral.");
  var pr = PropertiesService.getScriptProperties(), x = b.rc || {};
  if (b.off) { ["RC_CLIENT_ID", "RC_SERVER", "RC_JWT_CLIENT_ID", "RC_JWT_SECRET", "RC_JWT"].forEach(function (k) { pr.deleteProperty(k); }); CacheService.getScriptCache().remove("rc:tok"); return { rc: oxRcAdmin() }; }
  var id = String(x.client_id || "").trim(); if (id) { if (!/^[A-Za-z0-9_-]{8,80}$/.test(id)) throw new Error("That client ID doesn't look right."); pr.setProperty("RC_CLIENT_ID", id); }
  if (x.server) { var sv = String(x.server).trim().replace(/\/+$/, ""); if (!/^https:\/\/platform(\.devtest)?\.ringcentral\.com$/.test(sv)) throw new Error("Server: https://platform.ringcentral.com"); pr.setProperty("RC_SERVER", sv); }
  var jid = String(x.jwt_client_id || "").trim(), jsec = String(x.jwt_secret || "").trim(), jwt = String(x.jwt || "").trim();
  if (jid || jsec || jwt) {
    if (!/^[A-Za-z0-9_-]{8,80}$/.test(jid) || jsec.length < 8 || !/^[A-Za-z0-9_\-]+\.[A-Za-z0-9_\-]+\.[A-Za-z0-9_\-]+$/.test(jwt)) throw new Error("Paste the recordings app's client ID, client secret and the JWT credential.");
    rcToken({ id: jid, secret: jsec, jwt: jwt, server: rcProp("RC_SERVER") || RC_DEF_SERVER }, true);       // proves it works before saving
    pr.setProperty("RC_JWT_CLIENT_ID", jid); pr.setProperty("RC_JWT_SECRET", jsec); pr.setProperty("RC_JWT", jwt); CacheService.getScriptCache().remove("rc:tok");
  }
  return { rc: oxRcAdmin() };
};
function oxRcAdmin() { return { phone: !!rcProp("RC_CLIENT_ID"), recordings: !!(rcProp("RC_JWT") && rcProp("RC_JWT_CLIENT_ID") && rcProp("RC_JWT_SECRET")), server: rcProp("RC_SERVER") || RC_DEF_SERVER, client_id: rcProp("RC_CLIENT_ID") }; }
ACTIONS.oxRcStatus = function (me) { if (!me || me.role !== "admin") throw new Error("Only Jesús."); return { rc: oxRcAdmin() }; };
NO_LOCK.oxRcStatus = 1;
function rcToken(c, fresh) {
  c = c || { id: rcProp("RC_JWT_CLIENT_ID"), secret: rcProp("RC_JWT_SECRET"), jwt: rcProp("RC_JWT"), server: rcProp("RC_SERVER") || RC_DEF_SERVER };
  if (!c.id || !c.secret || !c.jwt) throw new Error("Connect RingCentral recordings first (Import & tools → RingCentral).");
  var cache = CacheService.getScriptCache(); if (!fresh) { var hit = cache.get("rc:tok"); if (hit) return hit; }
  var r = UrlFetchApp.fetch(c.server + "/restapi/oauth/token", { method: "post", muteHttpExceptions: true, contentType: "application/x-www-form-urlencoded",
    headers: { Authorization: "Basic " + Utilities.base64Encode(c.id + ":" + c.secret) }, payload: { grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion: c.jwt } });
  var j = {}; try { j = JSON.parse(r.getContentText()); } catch (e) {}
  if (r.getResponseCode() >= 300 || !j.access_token) throw new Error("RingCentral didn't accept the credentials" + (j.error_description ? ": " + j.error_description : "") + ".");
  cache.put("rc:tok", j.access_token, Math.max(60, Math.min(3000, (Number(j.expires_in) || 3600) - 300))); return j.access_token;
}
function rcGet(path, token) {
  var r = UrlFetchApp.fetch((/^https:/.test(path) ? "" : (rcProp("RC_SERVER") || RC_DEF_SERVER)) + path, { muteHttpExceptions: true, headers: { Authorization: "Bearer " + token } });
  if (r.getResponseCode() === 403) throw new Error("RingCentral says the recordings app is missing a permission (Read Call Log, Read Call Recording).");
  if (r.getResponseCode() >= 300) throw new Error("RingCentral answered " + r.getResponseCode() + ".");
  return r;
}
/* Find the recording of one call: by the web phone's session first, else the same number within 20 minutes of the call. */
function rcFindRecording(t, token) {
  var at = t.rc_at ? new Date(t.rc_at) : new Date(String(t.at || "").replace(" ", "T")); if (isNaN(at)) throw new Error("This call has no time to look up.");
  var from = new Date(at.getTime() - 30 * 60000).toISOString(), to = new Date(at.getTime() + 90 * 60000).toISOString();
  var j = JSON.parse(rcGet("/restapi/v1.0/account/~/call-log?recordingType=All&view=Detailed&perPage=250&dateFrom=" + encodeURIComponent(from) + "&dateTo=" + encodeURIComponent(to), token).getContentText());
  var recs = (j.records || []).filter(function (x) { return x.recording && x.recording.contentUri; });
  var digits = function (s) { return String(s || "").replace(/\D/g, "").slice(-10); };
  var hit = t.rc_session ? recs.filter(function (x) { return String(x.telephonySessionId || "") === t.rc_session || String(x.sessionId || "") === t.rc_session || String(x.id || "") === t.rc_session; })[0] : null;
  if (!hit && t.rc_to) hit = recs.filter(function (x) { return digits((x.to || {}).phoneNumber) === digits(t.rc_to) || digits((x.from || {}).phoneNumber) === digits(t.rc_to); })
    .sort(function (a, b) { return Math.abs(new Date(a.startTime) - at) - Math.abs(new Date(b.startTime) - at); })[0];
  if (hit && Math.abs(new Date(hit.startTime) - at) > 20 * 60000 && !(t.rc_session && hit.telephonySessionId === t.rc_session)) hit = null;
  return hit ? { id: String(hit.recording.id), uri: hit.recording.contentUri, start: hit.startTime, secs: hit.duration } : null;
}
ACTIONS.oxRecording = function (me, b) {
  if (!me || me.role !== "admin" || me.preview) throw new Error("Only Jesús listens to the recordings.");
  var t = findBy("OxTouches", "id", String(b.touch_id || "")); if (!t || t.channel !== "call") throw new Error("Call not found.");
  if (!t.rc_session && !t.rc_to) throw new Error("This call wasn't made from the portal's phone.");
  var token = rcToken(), rec = null;
  if (t.rc_rec) { try { rec = JSON.parse(t.rc_rec); } catch (e) { rec = null; } }
  if (!rec) { rec = rcFindRecording(t, token); if (!rec) return { found: false, note: "No recording yet. RingCentral keeps only calls over 30 seconds, and it can take a few minutes after the call." }; update("OxTouches", "id", t.id, { rc_rec: JSON.stringify(rec) }); }
  var r = rcGet(rec.uri, token), blob = r.getBlob(), bytes = blob.getBytes(); if (bytes.length > 25000000) throw new Error("That recording is too long to play here.");
  return { found: true, type: blob.getContentType() || "audio/mpeg", data: Utilities.base64Encode(bytes), secs: rec.secs || Number(t.rc_secs) || 0, start: rec.start };
};
NO_LOCK.oxRecording = 1; PREFETCH.oxRecording = OX_T.concat(["People"]);
