/* ======================================================================================================
   Outreach: get Blue Sierra on the bid lists of the architects, landscape architects, builders and engineers
   behind the Peninsula's permits. Projects come from the weekly permit search (a CSV), firms and contacts from
   our research and RocketReach, and every touch (email, LinkedIn, call, site walk) is logged.

   Rules that live here, not in anyone's memory:
   - Owners and individual applicants are never contacted: they show, with no outreach buttons.
   - Excluded firms (competitors, demo trades, partners Jesús handles himself) get no outreach; "do not call" skips calls.
   - On a shared project the warm firm goes first: cold outreach on it waits until the warm firm's email is
     3+ business days old or they replied.
   - New first emails: at most 10 a day, Tuesday to Thursday. Nothing goes out Nov 25-27 or Dec 24 - Jan 1.
   - The portal writes every email; Jesús reads it and taps Send. Follow-ups wait for his tap too, and stop
     the moment the firm replies (we look in his Gmail).
   - RocketReach lookups cost credits: the cost is shown before a batch, nothing runs without a confirm,
     firms with a verified email are skipped, and nobody is looked up twice.
   ====================================================================================================== */
TABLES.OxProjects = ["id", "key", "town", "address", "type", "other_types", "description", "permit_no", "status", "date", "priority", "source_url", "known", "next_step",
  "owner", "first_seen", "last_seen", "import_id", "updated_at"];
TABLES.OxFirms = ["id", "name", "norm", "firm_type", "segment", "priority", "wave", "channel", "website", "phone", "flags", "notes", "individual", "confirmed",
  "status", "next_step", "next_date", "email_source", "created_at", "updated_at"];
TABLES.OxContacts = ["id", "firm_id", "name", "role", "email", "phone", "linkedin", "source", "verified", "rr_id", "created_at", "updated_at"];
TABLES.OxRoles = ["id", "project_id", "firm_id", "role", "raw", "source"];
TABLES.OxTouches = ["id", "firm_id", "contact_id", "project_id", "date", "channel", "step", "summary", "outcome", "by", "at", "outbox_id", "thread_id"];
TABLES.OxOutbox = ["id", "key", "firm_id", "contact_id", "project_id", "step", "to", "subject", "body", "status", "msg_id", "thread_id", "error", "created_by", "created_at", "sent_at"];
TABLES.OxOpps = ["id", "firm_id", "project_id", "stage", "amount", "due", "notes", "created_by", "created_at", "updated_at"];
TABLES.OxEnrich = ["id", "firm_id", "person", "rr_id", "status", "result", "at", "by"];
TABLES.OxAlerts = ["id", "firm_id", "project_id", "kind", "status", "created_at", "done_at"];
TABLES.OxImports = ["id", "kind", "file", "at", "by", "counts"];
var OX_T = ["OxProjects", "OxFirms", "OxContacts", "OxRoles", "OxTouches", "OxOutbox", "OxOpps", "OxEnrich", "OxAlerts", "OxImports"];
var OX_TOWNS = ["Atherton", "Burlingame", "Hillsborough", "Los Altos", "Los Altos Hills", "Los Gatos", "Saratoga", "Woodside"];
var OX_STAGES = ["invited", "plans", "site_walk", "bid_sent", "won", "lost"];
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
function oxImportProjects(list, g, imp) {
  var all = rows("OxProjects").slice(), byKey = {}, t = now(), today = oxToday(), c = { rows: list.length, new: 0, updated: 0, skipped: 0, roles: 0, alerts: 0 }, fresh = [];
  all.forEach(function (p) { byKey[p.key] = p; });
  list.forEach(function (r) {
    var town = oxTitle(g(r, "town")), addr = g(r, "address"); if (!addr || !town) { c.skipped++; return; }
    var key = (g(r, "application_permit_no").toUpperCase() + "|" + oxAddrKey(addr, town)), p = byKey[key];
    if (!p && !g(r, "application_permit_no")) { all.forEach(function (x) { if (!p && x.key.split("|").slice(1).join("|") === oxAddrKey(addr, town) && !x.permit_no) p = x; }); }
    var f = { town: town, address: addr, type: g(r, "project_type"), other_types: g(r, "other_project_types"), description: g(r, "project_description"), permit_no: g(r, "application_permit_no"),
      status: g(r, "status"), date: g(r, "date"), priority: g(r, "priority").toUpperCase().slice(0, 1), source_url: g(r, "source_url"), known: g(r, "known_to_jesus"), next_step: g(r, "next_step"), owner: g(r, "owner"), last_seen: today, updated_at: t };
    if (p) { Object.keys(f).forEach(function (k) { if (f[k] !== "" || k === "status") p[k] = f[k]; }); c.updated++; }
    else { p = Object.assign({ id: newId("op"), key: key, first_seen: today, import_id: imp.id }, f); all.push(p); byKey[key] = p; c.new++; fresh.push(p.id); }
    p._raw = r;
  });
  oxWriteAll("OxProjects", all.map(function (p) { var o = Object.assign({}, p); delete o._raw; return o; }));
  // who's on each project, from the permit columns (manual links are kept)
  var firms = rows("OxFirms"), touched = {}; all.forEach(function (p) { if (p._raw) touched[p.id] = 1; });
  var old = rows("OxRoles"), prevLink = {};                                         // keep the firm a person already linked, by project + role + name
  old.forEach(function (x) { if (x.source === "permit" && x.firm_id) prevLink[x.project_id + "|" + x.role + "|" + x.raw] = x.firm_id; });
  var out = old.filter(function (x) { return !(x.source === "permit" && touched[x.project_id]); });
  all.forEach(function (p) {
    if (!p._raw) return; var r = p._raw;
    [["architect", "architect"], ["landscape_architect", "landscape_architect"], ["contractor", "contractor"], ["engineer", "engineer"], ["applicant", "applicant"], ["owner", "owner"]].forEach(function (col) {
      String(g(r, col[0])).split(";").map(function (x) { return x.trim(); }).filter(Boolean).forEach(function (raw) {
        if (out.some(function (x) { return x.project_id === p.id && x.role === col[1] && x.raw === raw; })) return;
        var fm = col[1] === "owner" ? null : oxFindFirm(firms, raw), keepId = prevLink[p.id + "|" + col[1] + "|" + raw] || "";
        out.push({ id: newId("or"), project_id: p.id, firm_id: col[1] === "owner" ? "" : keepId || (fm ? fm.id : ""), role: col[1], raw: raw, source: "permit" }); if (!old.some(function (x) { return x.project_id === p.id && x.raw === raw && x.role === col[1]; })) c.roles++;
      });
    });
  });
  oxWriteAll("OxRoles", out);
  // a new project for a firm we're already talking to is a reason to write again
  var active = {}; rows("OxTouches").forEach(function (x) { active[x.firm_id] = 1; });
  var al = []; out.forEach(function (x) { if (x.firm_id && active[x.firm_id] && fresh.indexOf(x.project_id) > -1 && !al.some(function (a) { return a.firm_id === x.firm_id && a.project_id === x.project_id; })) al.push({ id: newId("oa"), firm_id: x.firm_id, project_id: x.project_id, kind: "new_project", status: "open", created_at: t, done_at: "" }); });
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
  var opps = rows("OxOpps");
  var kpi = { firms: firms.filter(function (f) { return !oxFlags(f).excluded; }).length, contacted: firms.filter(function (f) { return st[f.id].emailed; }).length, reached: firms.filter(function (f) { return !oxFlags(f).excluded && (st[f.id].emailed || st[f.id].last); }).length,
    replied: firms.filter(function (f) { return st[f.id].replied; }).length, invites: opps.length, bids: opps.filter(function (o) { return ["bid_sent", "won", "lost"].indexOf(o.stage) > -1; }).length,
    won: opps.filter(function (o) { return o.stage === "won"; }).length, sent_today: sentToday, daily: OX_DAILY };
  var wk = oxAdd(today, -((oxDow(today) + 6) % 7)), week = { from: wk, email: 0, linkedin: 0, call: 0, reply: 0, invites: 0 };
  touches.forEach(function (x) { if (x.date >= wk && x.date <= today) { if (x.channel === "email") week.email++; else if (x.channel === "linkedin") week.linkedin++; else if (x.channel === "call") week.call++; else if (x.channel === "reply") week.reply++; if (x.outcome === "invited") week.invites++; } });
  return { week: week, today: today, can_send: me.role === "admin", new_email_day: oxNewEmailDay(today), blackout: oxBlackout(today), kpi: kpi, queue: queue, towns: OX_TOWNS, stages: OX_STAGES,
    projects: projects.map(function (p) { var o = Object.assign({}, p); delete o.key; return o; }),
    firms: firms.map(function (f) { var fl = oxFlags(f), s = st[f.id]; return Object.assign({}, f, { flag: fl, state: s.state, emailed: s.emailed, replied: s.replied, last: s.last, due: s.due, blocked: block[f.id] || null }); }),
    contacts: contacts, roles: roles, opps: opps, alerts: rows("OxAlerts").filter(function (a) { return a.status === "open"; }),
    touches: touches.slice(-1500).map(function (x) { var o = Object.assign({}, x); var p = people[normEmail(x.by)]; o.by_name = p ? p.name : x.by; o.by_avatar = p ? p.avatar : ""; o.by_key = p ? p.key : ""; return o; }),
    rr: oxRrInfo(), last_import: (rows("OxImports").slice(-1)[0] || null) };
};
NO_LOCK.oxHome = 1;
/* Where a firm is in the cadence: day 0 email → day 3 LinkedIn → day 7 call → day 14 follow-up, unless they replied. */
function oxState(f, list, today) {
  var em = list.filter(function (x) { return x.channel === "email" && x.step === "day0"; }).sort(function (a, b) { return a.date < b.date ? -1 : 1; })[0];
  var replied = list.some(function (x) { return x.channel === "reply"; }) || f.status === "replied";
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
    var fl = oxFlags(f), s = st[f.id]; if (fl.excluded || s.replied || f.status === "closed" || f.status === "paused") return;
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
ACTIONS.oxDraft = function (me, b) {
  oxNeed(me); var f = findBy("OxFirms", "id", String(b.firm_id || "")); if (!f) throw new Error("Firm not found.");
  var ct = b.contact_id ? findBy("OxContacts", "id", String(b.contact_id)) : null, step = b.step === "day14" || b.step === "again" ? b.step : "day0";
  if (!ct) ct = oxBestContact(rows("OxContacts").filter(function (c) { return c.firm_id === f.id && c.email; }));
  var mine = rows("OxRoles").filter(function (x) { return x.firm_id === f.id; }).map(function (x) { return findBy("OxProjects", "id", x.project_id); }).filter(Boolean);
  var hold = oxHoldOf(f); if (!b.project_id && hold) { var freeL = mine.filter(function (x) { return hold.held.indexOf(x.id) < 0; }); if (freeL.length) mine = freeL; }
  var p = b.project_id ? findBy("OxProjects", "id", String(b.project_id)) : mine.sort(function (a, c) { return ("ABC".indexOf(a.priority) - "ABC".indexOf(c.priority)) || (a.date < c.date ? 1 : -1); })[0];
  if (!p) throw new Error("This firm has no project on the list to mention.");
  var first = ct && ct.name ? oxNorm(ct.name).split(" ")[0] : "", hi = first ? "Hi " + oxTitle(first) + "," : "Hi there,", where = oxStreet(p) + ", " + p.town, kind = OX_TYPE[p.type] || "";
  var prev = rows("OxOutbox").filter(function (m) { return m.firm_id === f.id && m.status === "sent" && m.step === "day0"; }).slice(-1)[0];
  var subject = step === "day14" && prev ? (/^re:/i.test(prev.subject) ? prev.subject : "Re: " + prev.subject) : where + " · bid list";
  if (step === "again") subject = where + " · bid list";
  var body = step === "again"
    ? hi + "\nSaw " + f.name + " is also on " + where + (kind ? " (" + kind + ")" : "") + ". Could you add Blue Sierra to the bid list for this one?\nHappy to walk the site or give early numbers."
    : step === "day14"
    ? hi + "\nCircling back on " + where + ". Happy to walk the site or give early numbers whenever it's useful.\nCould you add Blue Sierra to the bid list?"
    : hi + "\nSaw " + f.name + " on " + where + (kind ? " (" + kind + ")" : "") + ". Blue Sierra does the site work, hardscape and landscape on projects like this across the Peninsula.\nCould you add us to the bid list?\nHappy to walk the site or give early numbers.";
  return { subject: subject, body: body, to: ct ? ct.email : "", contact_id: ct ? ct.id : "", project_id: p.id, project: where, step: step, notes: f.notes || "", flags: oxFlags(f), waiting: hold && hold.held.indexOf(p.id) > -1 ? hold.waiting_on : null };
};
NO_LOCK.oxDraft = 1;
ACTIONS.oxSend = function (me, b) {
  oxAdmin(me); var key = String(b.key || ""); if (!/^[A-Za-z0-9_-]{8,80}$/.test(key)) throw new Error("Reload the portal and try again (missing send key).");
  var done = findBy("OxOutbox", "key", key); if (done && done.status === "sent") return { status: "sent", again: true };
  var f = findBy("OxFirms", "id", String(b.firm_id || "")); if (!f) throw new Error("Firm not found.");
  var fl = oxFlags(f), step = b.step === "day14" || b.step === "again" ? b.step : "day0", today = oxToday();
  if (fl.excluded) throw new Error(f.name + " is excluded from outreach.");
  if (fl.individual) throw new Error("First confirm " + f.name + " is a designer or engineer, not the owner.");
  if (oxBlackout(today)) throw new Error("No outreach today (holiday blackout).");
  var to = normEmail(b.to); if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(to)) throw new Error("Check the email address.");
  var ct = b.contact_id ? findBy("OxContacts", "id", String(b.contact_id)) : null; if (ct && ct.firm_id !== f.id) throw new Error("That contact belongs to another firm.");
  var subject = clean(b.subject, 160), text = clean(b.body, 3000); if (!subject || !text) throw new Error("Write a subject and a message.");
  var touches = rows("OxTouches").filter(function (x) { return x.firm_id === f.id; }), s = oxState(f, touches, today);
  if (step === "day0") {
    if (s.emailed) throw new Error("This firm already got its first email (" + s.day0 + "). Use the follow-up.");
    if (!oxNewEmailDay(today)) throw new Error("New first emails go out Tuesday to Thursday.");
    var block = oxHoldOf(f);
    if (block && (block.all || block.held.indexOf(String(b.project_id || "")) > -1) && !b.override) throw new Error("Wait: the warm contact on this project goes first (" + block.waiting_on.join(", ") + ").");
    var sentToday = rows("OxOutbox").filter(function (m) { return m.status === "sent" && m.step === "day0" && String(m.sent_at).slice(0, 10) === today; }).length;
    if (sentToday >= OX_DAILY) throw new Error("That's today's " + OX_DAILY + " new emails. More on the next sending day.");
  } else if (step === "day14" && s.replied) throw new Error(f.name + " already replied: no follow-up needed.");
  var ob = done || { id: newId("ob"), key: key, firm_id: f.id, contact_id: ct ? ct.id : "", project_id: String(b.project_id || ""), step: step, to: to, subject: subject, body: text, status: "pending", msg_id: "", thread_id: "", error: "", created_by: me.email, created_at: oxStamp(), sent_at: "" };
  if (!done) insert("OxOutbox", ob);                                    // recorded first: a crash leaves "pending", never a silent send
  try {
    var msg = GmailApp.createDraft(to, subject, text, { name: me.name || CONFIG.COMPANY, htmlBody: "<div style='font-family:Arial,sans-serif;font-size:15px;color:#111;line-height:1.5;max-width:560px'>" + nl2br(esc(text)) + "</div>", from: fromAddress() || undefined }).send();
    var mid = msg && msg.getId ? msg.getId() : "", tid = msg && msg.getThread ? msg.getThread().getId() : "";
    update("OxOutbox", "id", ob.id, { status: "sent", msg_id: mid, thread_id: tid, sent_at: oxStamp(), error: "" });
    insert("OxTouches", { id: newId("ot"), firm_id: f.id, contact_id: ct ? ct.id : "", project_id: String(b.project_id || ""), date: today, channel: "email", step: step, summary: subject, outcome: "sent", by: me.email, at: now(), outbox_id: ob.id, thread_id: tid });
    if (!f.status || f.status === "") update("OxFirms", "id", f.id, { status: "active", updated_at: now() });
    if (b.alert_id) update("OxAlerts", "id", String(b.alert_id), { status: "done", done_at: now() });
    return { status: "sent", to: to };
  } catch (e) { update("OxOutbox", "id", ob.id, { status: "failed", error: String(e.message || e).slice(0, 300) }); throw new Error("Gmail didn't send it: " + String(e.message || e)); }
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
  if (data.status && ["", "active", "paused", "replied", "closed"].indexOf(data.status) < 0) throw new Error("Unknown status.");
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
ACTIONS.oxDeleteContact = function (me, b) { oxNeed(me); removeWhere("OxContacts", function (c) { return c.id === String(b.id || ""); }); return {}; };
ACTIONS.oxSaveOpp = function (me, b) {
  oxNeed(me); var x = b.opp || {}, t = now(), o = x.id ? findBy("OxOpps", "id", String(x.id)) : null;
  var data = {}; if (x.stage != null) { if (OX_STAGES.indexOf(x.stage) < 0) throw new Error("Unknown stage."); data.stage = x.stage; }
  ["amount", "due", "notes"].forEach(function (k) { if (x[k] != null) data[k] = clean(x[k], k === "notes" ? 1000 : 40); });
  if (o) { data.updated_at = t; update("OxOpps", "id", o.id, data); return { id: o.id }; }
  var f = findBy("OxFirms", "id", String(x.firm_id || "")); if (!f) throw new Error("Pick the firm that invited us.");
  var id = newId("oo"); insert("OxOpps", Object.assign({ id: id, firm_id: f.id, project_id: clean(x.project_id, 40), stage: "invited", created_by: me.email, created_at: t, updated_at: t }, data));
  insert("OxTouches", { id: newId("ot"), firm_id: f.id, contact_id: "", project_id: clean(x.project_id, 40), date: oxToday(), channel: "note", step: "", summary: "Invited to bid", outcome: "invited", by: me.email, at: t, outbox_id: "", thread_id: "" });
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
function oxEnrichList(ids) {
  var firms = rows("OxFirms").filter(function (f) { return ids.indexOf(f.id) > -1; }), contacts = rows("OxContacts"), log = rows("OxEnrich");
  return firms.map(function (f) {
    var fl = oxFlags(f), why = fl.excluded ? "excluded" : isTrue(f.individual) && !isTrue(f.confirmed) ? "individual (confirm first)" : contacts.some(function (c) { return c.firm_id === f.id && c.email && c.verified === "yes"; }) ? "already has a verified email" : log.some(function (x) { return x.firm_id === f.id && x.status === "done"; }) ? "already looked up" : "";
    return { firm_id: f.id, name: f.name, skip: why };
  });
}
ACTIONS.oxEnrichPlan = function (me, b) {
  oxNeed(me); var ids = [].concat(b.firm_ids || []).map(String);
  if (b.wave) ids = rows("OxFirms").filter(function (f) { return String(f.wave) === String(b.wave); }).map(function (f) { return f.id; });
  var l = oxEnrichList(ids), go = l.filter(function (x) { return !x.skip; });
  return { list: l, lookups: go.length, rr: oxRrInfo() };
};
ACTIONS.oxEnrich = function (me, b) {
  if (me.role !== "admin" || me.preview) throw new Error("Only Jesús spends RocketReach credits."); if (!b.confirm) throw new Error("Confirm the cost first.");
  if (!rrKey()) throw new Error("Connect RocketReach first.");
  var go = oxEnrichList([].concat(b.firm_ids || []).map(String)).filter(function (x) { return !x.skip; }).slice(0, 12), out = [], log = rows("OxEnrich");
  var TITLE = [/principal|partner|owner|founder|president/i, /project (architect|manager|lead)|associate/i, /estimat|bid|precon/i];
  go.forEach(function (x) {
    var f = findBy("OxFirms", "id", x.firm_id), res = { firm: f.name, found: "", status: "" };
    try {
      var dom = String(f.website || "").replace(/^https?:\/\//, "").replace(/^www\./, "").split("/")[0];
      var q = dom ? { company_domain: [dom] } : { employer: ["\"" + f.name.replace(/\s*\([^)]*\)/g, "") + "\""] };
      var people = rrCall("post", "/person/search", { query: q, page_size: 10 }) || []; if (!Array.isArray(people)) people = people.profiles || [];
      people = people.filter(function (p) { return !log.some(function (l) { return String(l.rr_id) === String(p.id) && l.status === "done"; }); });
      var score = function (p) { for (var i = 0; i < TITLE.length; i++) if (TITLE[i].test(p.current_title || "")) return i; return 9; };
      people.sort(function (a, c) { return score(a) - score(c) || (/california|\bca\b/i.test(c.region || c.location || "") ? 1 : 0) - (/california|\bca\b/i.test(a.region || a.location || "") ? 1 : 0); });
      var p = people[0];
      if (!p) { res.status = "nobody found"; insert("OxEnrich", { id: newId("oe"), firm_id: f.id, person: "", rr_id: "", status: "done", result: "none", at: now(), by: me.email }); out.push(res); return; }
      var d = rrCall("get", "/person/lookup?id=" + encodeURIComponent(p.id)) || {};
      var done = d.status === "complete" || d.status === "progress" || !!(d.emails || []).length;
      oxRrSaveContact(f, d.name ? d : Object.assign({}, p, d), me);
      res.found = (d.name || p.name || "") + (d.current_title || p.current_title ? " · " + (d.current_title || p.current_title) : ""); res.status = done ? "found" : "searching (check again in a minute)";
      insert("OxEnrich", { id: newId("oe"), firm_id: f.id, person: d.name || p.name || "", rr_id: String(p.id), status: done && d.status === "complete" ? "done" : "pending", result: oxRrEmail(d) ? "email" : "no email yet", at: now(), by: me.email });
    } catch (e) { res.status = e.message; if (/credits|key|rate/i.test(e.message)) { out.push(res); throw new Error(e.message + " (" + out.length + " firms done before this)"); } }
    out.push(res);
  });
  CacheService.getScriptCache().remove("rr:acct");
  return { results: out, rr: oxRrInfo() };
};
/* Lookups still "searching": ask RocketReach again (no new credits for the same person). */
ACTIONS.oxEnrichCheck = function (me) {
  oxNeed(me); var pend = rows("OxEnrich").filter(function (x) { return x.status === "pending" && x.rr_id; }).slice(0, 25); if (!pend.length) return { updated: 0 };
  var got = rrCall("get", "/person/checkStatus?" + pend.map(function (x) { return "ids=" + encodeURIComponent(x.rr_id); }).join("&")) || [], n = 0;
  (Array.isArray(got) ? got : []).forEach(function (d) {
    var l = pend.filter(function (x) { return String(x.rr_id) === String(d.id); })[0]; if (!l || (d.status !== "complete" && d.status !== "failed")) return;
    var f = findBy("OxFirms", "id", l.firm_id); if (f && d.status === "complete") oxRrSaveContact(f, d, me);
    update("OxEnrich", "id", l.id, { status: "done", result: d.status === "complete" && oxRrEmail(d) ? "email" : "none" }); n++;
  });
  return { updated: n };
};
function oxRrEmail(d) {
  var pro = (d.emails || []).filter(function (e) { return e.type === "professional" && e.smtp_valid !== "invalid"; })[0];
  return normEmail(d.recommended_professional_email || d.current_work_email || (pro && pro.email) || "");
}
function oxRrSaveContact(f, d, me) {
  var em = oxRrEmail(d), ph = ((d.phones || []).filter(function (x) { return x.recommended; })[0] || (d.phones || [])[0] || {}).number || "", t = now();
  var ct = rows("OxContacts").filter(function (c) { return c.firm_id === f.id && (String(c.rr_id) === String(d.id) || (d.name && oxSame(c.name, d.name))); })[0];
  var data = { name: d.name || "", role: d.current_title || "", linkedin: d.linkedin_url || "", rr_id: String(d.id || ""), updated_at: t };
  if (em) data.email = em; if (ph) data.phone = ph;
  if (ct) { if (ct.verified === "yes") { delete data.email; } update("OxContacts", "id", ct.id, data); }
  else insert("OxContacts", Object.assign({ id: newId("oc"), firm_id: f.id, email: "", phone: "", source: "rocketreach", verified: "no", created_at: t }, data));
}

/* ====================================== free email finder ======================================
   No paid service: (1) Jesús's own Gmail — people at that firm who already wrote to him or got his emails (verified);
   (2) the firm's website — home, contact, about and team pages (public); (3) the firm's own email format — when one
   person's email is known (pcarlino@…), the others are built the same way and marked "guessed". */
var OX_JUNK = /\.(png|jpe?g|gif|svg|webp|css|js|ico)$|^(example|test|user|name|your|email)@|@(example|domain|email|sentry|wixpress|sentry-next|godaddy)\.|noreply|no-reply|donotreply/i;
var OX_GENERIC = /^(info|contact|hello|office|admin|studio|design|projects?|bids?|estimat\w*|mail|team|inquir\w*|general|reception|careers|jobs|marketing|press|media|sales)$/i;
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
  var list = Object.keys(emails).sort(function (a, b) { return (oxDomainFits(f, b.split("@")[1]) ? 1 : 0) - (oxDomainFits(f, a.split("@")[1]) ? 1 : 0); }).slice(0, 8);
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
ACTIONS.oxFindFree = function (me, b) {
  oxNeed(me); var ids = [].concat(b.firm_ids || []).map(String).slice(0, 6), out = [], t = now();
  ids.forEach(function (id) {
    var f = findBy("OxFirms", "id", id); if (!f) return; var r = { firm_id: f.id, firm: f.name, gmail: 0, website: 0, guessed: 0, phone: "", note: "" };
    if (oxFlags(f).excluded) { r.note = "excluded"; out.push(r); return; }
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
    var pat = oxPatternOf(cs());
    if (pat) cs().forEach(function (c) { if (c.email || !c.name) return; var p = oxNameParts(c.name); if (!p) return; update("OxContacts", "id", c.id, { email: OX_PATTERNS[pat.pattern](p.f, p.l) + "@" + pat.domain, source: "guessed", verified: "no", updated_at: t }); r.guessed++; });
    insert("OxEnrich", { id: newId("oe"), firm_id: f.id, person: "", rr_id: "", status: "free", result: "gmail " + r.gmail + ", website " + r.website + " (" + w.pages + " pages), guessed " + r.guessed, at: t, by: me.email });
    out.push(r);
  });
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
["oxFindFree", "oxImport", "oxSend", "oxTouch", "oxSaveFirm", "oxLinkRole", "oxSaveContact", "oxDeleteContact", "oxSaveOpp", "oxAlert", "oxEnrich", "oxEnrichCheck", "oxCheckReplies", "oxRrSave"].forEach(function (a) { PREFETCH[a] = OX_T.concat(["People"]); });
["oxHome", "oxDraft", "oxExport", "oxEnrichPlan"].forEach(function (a) { PREFETCH[a] = OX_T.concat(["People"]); });
