/**
 * Blue Sierra client portal · backend for bluesierracorp.com/portal
 *
 * A STANDALONE Apps Script project owned only by Jesús. setup() creates its private database sheet
 * ("Blue Sierra Portal · database") and a Drive folder, and saves their IDs in Script Properties.
 * Nobody else should get edit access to this project. Deploy as a Web app (Execute as: Me · Who has access: Anyone).
 *
 * - Login: the person types their email and gets a 6-digit code by email (no passwords, no per-client accounts).
 *   Only emails in the "People" tab can get a code. Sessions are stored hashed.
 * - Every request is a POST with Content-Type text/plain and a JSON body. Tokens never go in URLs.
 * - Photos and invoice PDFs go to a Drive folder per project.
 * - Questions are emailed to clients from Jesús's Gmail. A client's reply by email comes back into the portal
 *   (checkEmailReplies, every 10 minutes) only if Gmail verified the sender (DMARC/DKIM) and the thread
 *   started with the portal's own email.
 * - Clients only see projects they are listed on (never archived ones). Staff see all. Only admins manage roles.
 */

var CONFIG = {
  COMPANY: "Blue Sierra Construction",
  PORTAL_URL: "https://www.bluesierracorp.com/portal",
  NOTIFY_EMAIL: "jtoto@bluesierracorp.com",   // where client messages and answers are announced
  FROM_EMAIL: "info@bluesierracorp.com",      // every portal email goes out from this address once it's a "Send mail as" alias in Gmail
  TZ: "America/Los_Angeles",
  DB_NAME: "Blue Sierra Portal · database",
  ROOT_FOLDER: "Blue Sierra Portal",
  SESSION_DAYS: 180,        // stay logged in for about six months on a device
  PIN_TRIES: 5,             // wrong PINs before a 15-minute lock
  PIN_LOCK_MIN: 15,
  CODE_MINUTES: 15,
  CODES_PER_15MIN: 5,       // login-code emails per address (codes are only for the first time and for a forgotten PIN)
  CODES_PER_6H: 20,
  CODES_PER_DAY: 200,       // across the whole portal
  MAIL_RESERVE: 40,         // stop sending codes/notices when the day's mail quota gets this low
  NOTICES_PER_HOUR: 10,     // client-triggered notices to Jesús, per person
  PHASES: ["Design", "Permits", "Pre-construction", "Construction", "Punch list", "Complete"],
  TAG: "BSP" // subject tag: [BSP-<projectId>-<messageId>]
};

var TABLES = {
  Projects: ["id", "name", "client_name", "address", "city", "phase", "progress", "start_date", "target_date", "summary", "cover_file_id", "folder_id", "status", "created_at", "retainage_pct", "lat", "lon", "billing_aud", "architect_name", "architect_logo", "qb_customer"],
  People: ["email", "name", "role", "project_ids", "active", "created_at", "avatar", "pin_hash", "pin_salt", "pin_fails", "pin_lock", "money"],
  Sessions: ["token_hash", "email", "expires_at", "created_at"],
  Timeline: ["id", "project_id", "at", "author", "text", "photo_ids", "emailed", "pinned", "aud", "author_email"],
  Photos: ["id", "project_id", "file_id", "caption", "at", "author", "update_id"],
  Messages: ["id", "project_id", "at", "author", "author_email", "role", "kind", "text", "question_id", "status", "via", "channel", "thread_id", "files", "reactions", "ref", "pinned"],
  Invoices: ["id", "project_id", "number", "title", "amount", "issued", "due", "status", "paid_date", "pdf_file_id", "pay_url", "notes", "retainage", "lines", "created_by", "created_at", "updated_by", "updated_at", "qb_id"],
  Checklist: ["id", "project_id", "phase", "item", "owner", "due", "done", "done_by", "done_at", "sort", "aud", "assignee", "created_by", "edited_by", "edited_at", "reactions", "pinned", "done_email"],
  EmailImports: ["gmail_id", "project_id", "message_id", "at", "result"],
  Schedule: ["id", "project_id", "kind", "title", "start", "end", "phase", "owner", "status", "notes", "sort", "edited_by", "edited_at", "req_by", "req_at", "req_note"],
  // "Start over": a project's rows are moved here (as JSON) so the admin can bring them back.
  Wipes: ["wipe_id", "project_id", "at", "by", "tbl", "part", "data"],
  // The contract: "base" lines are the schedule of values (they add up to the contract sum); "change" lines are change orders.
  Reads: ["email", "project_id", "channel", "at"],
  // Plan sets: one row per uploaded revision. "sheets" is JSON: [{n, sheet, title, img, w, h, status, score, boxes}]
  Plans: ["id", "project_id", "set", "rev", "date", "notes", "visible", "pdf_file_id", "pdf_name", "pages", "sheets", "status", "by", "at", "text_file_id"],      // when each person last looked at each channel (unread counts)
  ContractLines: ["id", "project_id", "kind", "number", "title", "amount", "status", "date", "notes", "sort"]
};
var KINDS = ["task", "inspection", "payment", "decision", "meeting", "milestone", "deadline"];
/* Speed: everything a request needs is read from the sheet in one Sheets API call, then kept for the rest of the request. */
var PREFETCH = {
  getProject: ["Projects", "People", "Timeline", "Photos", "Messages", "Reads", "Invoices", "Checklist", "Schedule", "ContractLines", "Plans"],
  listProjects: ["Projects", "People", "Invoices", "Messages", "Timeline", "ContractLines", "Reads", "Checklist", "Schedule"],
  activity: ["Projects", "People", "Messages", "Reads"], qbMoney: ["Projects", "People", "Invoices", "ContractLines"], presence: ["People", "Projects", "Messages", "Reads"], me: ["People"], markRead: ["People", "Projects", "Reads"]
};
var NO_LOCK = { markRead: 1, presence: 1, startCall: 1, qbStatus: 1, qbCustomers: 1, qbInvoices: 1, qbConnectUrl: 1, qbMoney: 1 };   // startCall locks only for its chat card          // only touch your own row / the cache: no need to queue behind other saves
var READ_ONLY = { me: 1, listProjects: 1, getProject: 1, activity: 1, listTeam: 1, mailStatus: 1, planImage: 1, planText: 1 };
/* Chat channels per project: "client" (client, architect and team), "architect" (architect and team), "team" (team only). */
var CHANNELS = ["client", "architect", "team", "crew"];
/* Permission tags. Everything that can be limited (chat, updates, checklist items, contract & billing) carries #tags:
   #client (client + architect + Blue Sierra), #architect (architect + Blue Sierra), #team (Blue Sierra only), #crew (field crew + Blue Sierra),
   #private (admin and project managers only). No tag = everyone on the project. */
var AUDS = ["client", "architect", "team", "crew", "private"];
var TAG_WORDS = { client: "client", cliente: "client", clients: "client", clientes: "client", architect: "architect", arquitecto: "architect", arch: "architect",
  team: "team", equipo: "team", crew: "crew", cuadrilla: "crew", private: "private", privado: "private", privada: "private" };
var REACTIONS = ["👍", "✅", "❤️", "👀", "🎉", "🙏"];
var AVATARS = ["🦊", "🐻", "🦉", "🐢", "🐙", "🦖", "🐝", "🦄", "🐸", "🐼", "🦁", "🐧", "🌵", "🌲", "🌻", "🍄", "🏗️", "🚜", "🧱", "🔨", "📐", "🛠️", "🏡", "⛰️", "🌊", "🔥", "⭐", "🎸", "🚀", "😎"];
var AVATAR_COLORS = ["#f3e7d3", "#e3efe7", "#e7eef7", "#fdf4dc", "#efecfb", "#fcedf3", "#fdeee7", "#e8f4f4", "#111111"];
var PLAN_ORIGINS = ["https://www.bluesierracorp.com", "https://bluesierracorp.com", "https://planscope.github.io", "http://localhost:8765"];

/* ============================ web app ============================ */

/* GET is only used by QuickBooks, to hand back the authorization after Jesús clicks "Connect QuickBooks". */
function doGet(e) {
  var q = (e && e.parameter) || {};
  if (q.code && q.state && q.realmId) {
    var msg;
    try { qbFinishConnect(q.code, q.state, q.realmId); msg = "QuickBooks is connected to the Blue Sierra portal. You can close this tab."; }
    catch (err) { msg = "QuickBooks couldn't connect: " + String(err.message || err); }
    return HtmlService.createHtmlOutput("<div style='font-family:Arial,sans-serif;padding:40px;font-size:18px'>" + esc(msg) + "</div>");
  }
  return out({ ok: false, error: "Use POST." });
}

function doPost(e) {
  var res, notices = [];
  OUTBOX = [];
  try {
    var b = JSON.parse((e.postData && e.postData.contents) || "{}");
    var pub = PUBLIC[b.action], fn;
    MAIL_NOTICES = notices;
    if (pub) res = withLock(function () { return pub(b); });
    else {
      prefetch(["People"].concat(PREFETCH[b.action] || []));
      var me = auth(b.token);
      if (b.viewAs) {
        if (me.role !== "admin") throw new Error("Only Jesús can preview the portal.");
        if (!READ_ONLY[b.action]) throw new Error("You're in preview. Exit the preview to change things.");
        me = previewMe(b.viewAs);
      }
      fn = ACTIONS[b.action];
      if (!fn) throw new Error("Unknown action.");
      if (READ_ONLY[b.action] || NO_LOCK[b.action]) res = fn(me, b);
      else {
        res = withLock(function () {
          // Inside the lock, read fresh: someone may have saved while we waited, and row positions must be exact.
          _ROWS = {}; prefetch(["People"].concat(PREFETCH[b.action] || WRITE_TABLES));
          return fn(me, b);
        });
        res = res || {}; res.ver = bumpVersion(b.projectId);   // so the saver's own portal doesn't reload twice
      }
    }
    res = res || {}; res.ok = true;
  } catch (err) { res = { ok: false, error: String(err.message || err) }; }
  flushMail();                                   // emails go out after the lock is released, so nobody waits behind them
  if (notices.length && res.ok) res.notice = notices[0];
  return out(res);
}
function out(o) { return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON); }
/* One writer at a time. Locks are held only for sheet work (no email, no waiting on Google services that can be done after). */
function withLock(fn) { var lock = LockService.getScriptLock(); if (!lock.tryLock(25000)) throw new Error("The portal is busy. Try again in a moment."); try { return fn(); } finally { SpreadsheetApp.flush(); lock.releaseLock(); } }
var WRITE_TABLES = ["Projects", "Messages", "Timeline", "Photos", "Invoices", "Checklist", "Schedule", "ContractLines", "Plans", "Reads", "Sessions"];
/* Every save bumps a version number; open portals see it in their next ping and reload only when something really changed. */
function bumpVersion(pid) { var t = Date.now(); try { CacheService.getScriptCache().put("ver:" + (pid || "*"), String(t), 21600); } catch (e) {} return t; }
function versionOf(pid) { try { var g = CacheService.getScriptCache().getAll(["ver:" + pid, "ver:*"]); return Math.max(Number(g["ver:" + pid] || 0), Number(g["ver:*"] || 0)); } catch (e) { return 0; } }

/* ============================ login ============================ */

var NO_ACCESS = "This email doesn't have access to the portal. Ask Blue Sierra to add you: info@bluesierracorp.com";
var PUBLIC = {
  /* Step 1: who is this? People with a PIN type it; new people (or a forgotten PIN) get a code by email. */
  checkEmail: function (b) {
    var email = normEmail(b.email);
    if (!email || email.length > 200 || email.indexOf("@") < 1) throw new Error("That email doesn't look right.");
    var person = findPerson(email);
    if (!person || !isTrue(person.active)) throw new Error(NO_ACCESS);
    return { hasPin: !!person.pin_hash, name: first(person.name) };
  },
  /* Everyday login: email + your 6-digit PIN. Five wrong tries lock it for 15 minutes. */
  loginPin: function (b) {
    var email = normEmail(b.email), person = findPerson(email);
    if (!person || !isTrue(person.active)) throw new Error(NO_ACCESS);
    if (!person.pin_hash) throw new Error("You haven't set a PIN yet. We'll email you a code to set it.");
    var lock = Number(person.pin_lock || 0);
    if (lock > Date.now()) throw new Error("Too many wrong PINs. Try again in " + Math.ceil((lock - Date.now()) / 60000) + " min, or use “Forgot PIN”.");
    if (sha(person.pin_salt + ":" + String(b.pin || "").replace(/\D/g, "")) !== person.pin_hash) {
      var fails = Number(person.pin_fails || 0) + 1, locked = fails >= CONFIG.PIN_TRIES;
      update("People", "email", email, { pin_fails: locked ? "0" : String(fails), pin_lock: locked ? String(Date.now() + CONFIG.PIN_LOCK_MIN * 60000) : "" });
      throw new Error(locked ? "Too many wrong PINs. It's locked for " + CONFIG.PIN_LOCK_MIN + " minutes, or use “Forgot PIN”." : "That PIN isn't right. " + (CONFIG.PIN_TRIES - fails) + " tr" + (CONFIG.PIN_TRIES - fails === 1 ? "y" : "ies") + " left.");
    }
    if (person.pin_fails && person.pin_fails !== "0") update("People", "email", email, { pin_fails: "0", pin_lock: "" });
    return { token: newSession(email), me: publicMe(person) };
  },
  requestCode: function (b) {
    var email = normEmail(b.email);
    if (!email || email.length > 200) throw new Error("That email doesn't look right.");
    var person = findPerson(email);
    if (!person || !isTrue(person.active)) throw new Error(NO_ACCESS);
    var cache = CacheService.getScriptCache(), k15 = "req15:" + email, k6 = "req6:" + email;
    var n15 = Number(cache.get(k15) || 0), n6 = Number(cache.get(k6) || 0);
    if (n15 >= CONFIG.CODES_PER_15MIN || n6 >= CONFIG.CODES_PER_6H) throw new Error("Too many codes requested. Wait 15 minutes and try again.");
    var props = PropertiesService.getScriptProperties(), dayKey = "codes:" + today(), nDay = Number(props.getProperty(dayKey) || 0);
    if (nDay >= CONFIG.CODES_PER_DAY || MailApp.getRemainingDailyQuota() < CONFIG.MAIL_RESERVE) throw new Error("The portal can't send codes right now. Try again later or call Blue Sierra.");
    cache.put(k15, String(n15 + 1), 900); cache.put(k6, String(n6 + 1), 21600); props.setProperty(dayKey, String(nDay + 1));
    var code = String(Math.floor(100000 + Math.random() * 900000)), exp = Date.now() + CONFIG.CODE_MINUTES * 60000;
    cache.put("code:" + email, JSON.stringify({ h: sha(code), n: 0, exp: exp }), CONFIG.CODE_MINUTES * 60);
    sendMail(email, "Your " + CONFIG.COMPANY + " portal code: " + code,
      "<p>Hi " + esc(first(person.name)) + ",</p><p>Your code to open the project portal is:</p>" +
      "<p style='font-size:28px;letter-spacing:6px;font-weight:600'>" + code + "</p>" +
      "<p>It works for " + CONFIG.CODE_MINUTES + " minutes. If you didn't ask for it, you can ignore this email.</p>");
    return { sent: true };
  },
  verifyCode: function (b) {
    var email = normEmail(b.email), cache = CacheService.getScriptCache(), raw = cache.get("code:" + email);
    var bad = new Error("That code isn't right or has expired. Ask for a new one if needed.");
    if (!raw) throw bad;
    var c = JSON.parse(raw), left = Math.floor((Number(c.exp) - Date.now()) / 1000);
    if (left <= 0 || c.n >= 5) { cache.remove("code:" + email); throw bad; }
    if (sha(String(b.code || "").replace(/\D/g, "")) !== c.h) { c.n++; cache.put("code:" + email, JSON.stringify(c), Math.max(1, left)); throw bad; }
    cache.remove("code:" + email);
    var person = findPerson(email);
    if (!person || !isTrue(person.active)) throw bad;
    if (person.pin_lock) update("People", "email", email, { pin_fails: "0", pin_lock: "" });      // the emailed code proves it's you: unlock
    return { token: newSession(email), me: publicMe(person), needPin: !person.pin_hash || !!b.resetPin };
  }
};
function newSession(email) {
  var token = Utilities.getUuid().replace(/-/g, "") + Utilities.getUuid().replace(/-/g, "");
  insert("Sessions", { token_hash: sha(token), email: email, expires_at: new Date(Date.now() + CONFIG.SESSION_DAYS * 864e5).toISOString(), created_at: now() });
  return token;
}

function auth(token) {
  if (!token || String(token).length < 40) throw new Error("Please log in again.");
  var h = sha(token), cache = CacheService.getScriptCache(), email = cache.get("sess:" + h);
  if (!email) {
    var s = rows("Sessions").filter(function (r) { return r.token_hash === h; })[0];
    if (!s || new Date(s.expires_at) < new Date()) throw new Error("Please log in again.");
    email = s.email; cache.put("sess:" + h, email, 600);
  }
  var p = findPerson(email);
  if (!p || !isTrue(p.active)) throw new Error("This email doesn't have access anymore.");
  p.projects = splitIds(p.project_ids); p.tokenHash = h;
  return p;
}
function publicMe(p) { return { email: p.email, name: p.name, role: p.role, staff: isStaff(p), admin: p.role === "admin", crew: p.role === "crew", money: canMoney(p), key: pkey(p.email), avatar: p.avatar || "", hasPin: !!p.pin_hash, preview: p.preview || "" }; }
/* #money: the admin always; a team member only when Jesús turns it on. Clients, architects and crew never. */
function canMoney(p) { return !p.preview && (p.role === "admin" || (p.role === "staff" && isTrue(p.money))); }
/* A make-believe person with one role, on every live project, who owns nothing: what the server sends them is what that role sees. */
function previewMe(role) {
  if (["client", "architect", "crew"].indexOf(role) < 0) throw new Error("Pick #client, #architect or #crew to preview.");
  var ids = rows("Projects").filter(function (p) { return p.status !== "deleted"; }).map(function (p) { return p.id; });
  return { email: "preview-" + role + "@preview.invalid", name: { client: "Client preview", architect: "Architect preview", crew: "Crew preview" }[role], role: role,
    project_ids: ids.join(","), projects: ids, active: "yes", avatar: "", preview: role };
}
/* Roles: admin (Jesús: everything), staff (project managers), crew (field: their projects, #team, plans and schedule, no money), client, architect. */
function isTeam(p) { return isStaff(p) || p.role === "crew"; }
function pkey(email) { return sha("bsp:" + normEmail(email)).slice(0, 10); }      // a person id that never reveals the email
function isDm(ch) { return /^dm:[0-9a-f]{10}-[0-9a-f]{10}$/.test(String(ch)); }
function dmOf(a, b) { return "dm:" + [a, b].sort().join("-"); }
/* Can this person read (and post in) this channel? Normal channels by role; private messages only the two people in them. */
/* Invoice and change-order cards live in a chat, but only people who can see Contract & billing see them
   (e.g. billing tagged #client only: the architect reads #client but never sees the amounts). */
function moneyEvent(m) { return m.kind === "event" && /^(invoice|inv|co):/.test(String(m.ref || "")); }
function projIndex() { var l = rows("Projects"); if (!l._idx) { var o = {}; l.forEach(function (p) { o[p.id] = p; }); l._idx = o; } return l._idx; }
function seesMsg(me, m) { if (!canRead(me, chOf(m))) return false; if (isStaff(me) || !moneyEvent(m)) return true; var p = projIndex()[m.project_id]; return !!p && canBill(me, p); }
function canRead(me, ch) { if (isDm(ch)) { me._k = me._k || pkey(me.email); return ch.indexOf(me._k) > -1; } return channelsFor(me).indexOf(ch) > -1; }
function isStaff(p) { return p.role === "admin" || p.role === "staff"; }
function channelsFor(me) { return isStaff(me) ? CHANNELS : me.role === "crew" ? ["crew"] : me.role === "architect" ? ["client", "architect"] : ["client"]; }
function audOf(me) { return isStaff(me) ? AUDS : channelsFor(me); }
function audList(v) { return splitIds(v).filter(function (a) { return AUDS.indexOf(a) > -1; }); }
/* Outside Blue Sierra you only see the tags that include you (a client never learns an item is also #team). */
function audView(me, v) { var l = audList(v); if (isStaff(me)) return l; var mine = audOf(me); return l.filter(function (a) { return mine.indexOf(a) > -1; }); }
function audOk(me, v) { var l = audList(v); if (!l.length) return true; var mine = audOf(me); return l.some(function (a) { return mine.indexOf(a) > -1; }); }
function myAud(me) { return me.role === "crew" ? "crew" : me.role === "architect" ? "architect" : me.role === "client" ? "client" : "team"; }
/* "#team #client" in a text → ["team","client"], and the text without the tags. */
function readTags(text) {
  var aud = [];
  var rest = String(text || "").replace(/(^|\s)#([a-záéíóú]+)\b/gi, function (all, sp, w) { var a = TAG_WORDS[w.toLowerCase()]; if (!a) return all; if (aud.indexOf(a) < 0) aud.push(a); return sp; });
  return { aud: aud, text: rest.replace(/[ \t]{2,}/g, " ").trim() };
}
function cleanAud(v) { return (Array.isArray(v) ? v : splitIds(v)).map(String).filter(function (a, i, l) { return AUDS.indexOf(a) > -1 && l.indexOf(a) === i; }); }
/* Contract & billing: Blue Sierra always; the field crew never; the client and the architect only when the admin tags them in. */
function canBill(me, p) { if (isStaff(me)) return true; if (me.role === "crew") return false; return audList(p.billing_aud).indexOf(me.role) > -1; }
function billChannel(p) { return audList(p.billing_aud).indexOf("client") > -1 ? "client" : audList(p.billing_aud).indexOf("architect") > -1 ? "architect" : "team"; }
/* A channel for a list of tags (where the chat card goes). */
function chanFor(aud) { return !aud.length || aud.indexOf("client") > -1 ? "client" : aud.indexOf("architect") > -1 ? "architect" : aud.indexOf("crew") > -1 ? "crew" : "team"; }
function chansFor(aud) { if (!aud.length) return ["client"]; if (aud.indexOf("client") > -1) return ["client"]; return aud.filter(function (a) { return a !== "private"; }); }
function chOf(m) { return m.channel || "client"; }
function isOutside(p) { return p.role === "client" || p.role === "architect"; }   // people outside the team: see only their projects
function needStaff(me) { if (!isStaff(me)) throw new Error("Only the Blue Sierra team can do that."); }
function canSee(me, pid) { if (isStaff(me)) return true; return (me.projects || splitIds(me.project_ids)).indexOf(String(pid)) > -1; }
function needProject(me, pid) {
  var p = rows("Projects").filter(function (r) { return r.id === String(pid); })[0];
  if (!p || !canSee(me, pid) || (!isStaff(me) && p.status === "archived") || (p.status === "deleted" && me.role !== "admin")) throw new Error("Project not found.");
  return p;
}

/* ============================ actions ============================ */

var ACTIONS = {
  me: function (me) { return { me: publicMe(me) }; },
  logout: function (me) { removeWhere("Sessions", function (r) { return r.token_hash === me.tokenHash; }); CacheService.getScriptCache().remove("sess:" + me.tokenHash); return {}; },

  listProjects: function (me) {
    var all = rows("Projects").filter(function (p) { return canSee(me, p.id) && (isStaff(me) || p.status !== "archived") && (p.status !== "deleted" || me.role === "admin"); });
    var inv = rows("Invoices"), msgs = rows("Messages"), tl = rows("Timeline"), lines = rows("ContractLines"), reads = readsAll(me), ck = rows("Checklist"), sc = rows("Schedule");
    var live = all.filter(function (p) { return p.status !== "deleted"; }), names = {}; live.forEach(function (p) { names[p.id] = p.name; });
    return { me: publicMe(me), pins: pinsFor(me, names, msgs, tl, ck), projects: all.map(function (p) { var o = summary(p, inv, msgs, tl, me, lines, reads); o.needs = needsOf(p, ck, sc, inv, me);
      if (!canBill(me, p)) { o.money = {}; o.balance = 0; o.needs.invoices = []; }
      if (me.role === "crew") o.needs.todos = [];
      return o; }) };
  },

  getProject: function (me, b) {
    var p = needProject(me, b.projectId), id = p.id, staff = isStaff(me), team = isTeam(me), crew = me.role === "crew", bill = canBill(me, p);
    var by = function (t) { return rows(t).filter(function (r) { return r.project_id === id; }); };
    var ppl = peopleIndex(), tl = by("Timeline").filter(function (u) { return audOk(me, u.aud); }), hiddenU = {};
    by("Timeline").forEach(function (u) { if (!audOk(me, u.aud)) hiddenU[u.id] = 1; });
    var data = {
      project: projectOut(p),
      timeline: tl.reverse().map(function (u) { var o = Object.assign({}, u, { aud: audView(me, u.aud), akey: keyOf(u.author_email), avatar: (ppl[u.author_email] || {}).avatar || "" }); delete o.author_email; return o; }),
      photos: by("Photos").filter(function (ph) { return !hiddenU[ph.update_id]; }).reverse().map(photoOut),
      billing: bill,
      // Clients never receive other people's email addresses.
      messages: messagesOut(by("Messages"), me),
      reads: readsFor(me, id),
      members: membersOf(p).map(function (x) { return { name: x.name, role: x.role, key: pkey(x.email), avatar: x.avatar || "" }; }),
      channels: channelsFor(me),
      invoices: !bill ? [] : by("Invoices").filter(function (i) { return staff || (i.status !== "draft" && i.status !== "void"); }).map(function (i) { return invoiceOut(i, staff, ppl); }),
      checklist: by("Checklist").filter(function (c) { return audOk(me, c.aud) || isAssigned(c, me.email); }).sort(function (a, c) { return Number(a.sort || 0) - Number(c.sort || 0); }).map(function (c) { return checkOut(c, me, ppl); }),
      schedule: by("Schedule").sort(function (a, c) { return a.start < c.start ? -1 : a.start > c.start ? 1 : Number(a.sort || 0) - Number(c.sort || 0); })
        .map(function (x) { return schedOut(x, team, ppl); }),
      contract: !bill ? { retainage_pct: 0, lines: [] } : contractOut(by("ContractLines"), p, staff),
      plans: plansOut(by("Plans"), me),
      phases: CONFIG.PHASES
    };
    if (me.role === "admin") data.wipe = lastWipe(id);
    if (staff) data.people = rows("People").filter(function (x) { return isStaff(x) || splitIds(x.project_ids).indexOf(id) > -1; }).map(function (x) { return { email: x.email, name: x.name, role: x.role, money: canMoney(x), active: isTrue(x.active), avatar: x.avatar || "" }; });
    return data;
  },

  saveProject: function (me, b) {
    needStaff(me);
    var f = b.project || {}, fields = ["name", "client_name", "address", "city", "phase", "progress", "start_date", "target_date", "summary", "status", "retainage_pct", "lat", "lon", "architect_name"];
    if (!clean(f.name, 200)) throw new Error("The project needs a name.");
    if (f.phase && CONFIG.PHASES.indexOf(f.phase) < 0) throw new Error("Unknown phase.");
    var patch = {}; fields.forEach(function (k) { if (f[k] != null) patch[k] = clean(f[k], 1000); });
    if (patch.progress != null) patch.progress = String(Math.max(0, Math.min(100, Number(patch.progress) || 0)));
    if (patch.status != null && ["active", "archived"].indexOf(patch.status) < 0) patch.status = "active";
    ["start_date", "target_date"].forEach(function (k) { if (patch[k] != null) patch[k] = dateOrEmpty(patch[k]); });
    ["lat", "lon"].forEach(function (k) { if (patch[k] != null) patch[k] = patch[k] === "" ? "" : String(Math.round(num(patch[k]) * 1e6) / 1e6); });   // where the property is, for the header map
    if (f.address != null && f.lat == null) { patch.lat = ""; patch.lon = ""; }                                                                   // a new address: find it again
    if (patch.retainage_pct != null) patch.retainage_pct = String(Math.max(0, Math.min(20, num(patch.retainage_pct))));
    if (f.billing_aud != null) { if (me.role !== "admin") throw new Error("Only Jesús changes who sees Contract & billing."); patch.billing_aud = cleanAud(f.billing_aud).filter(function (a) { return a === "client" || a === "architect"; }).join(","); }
    if (f.logo && f.logo.data && f.id) { var lp = findBy("Projects", "id", f.id); patch.architect_logo = saveFile(lp, f.logo, "Architect logo", true); }
    if (f.logo === "") patch.architect_logo = "";
    if (f.id) { needProject(me, f.id); update("Projects", "id", f.id, patch); return { project: projectOut(findBy("Projects", "id", f.id)) }; }
    var id = newId("p");
    patch.id = id; patch.folder_id = rootFolder().createFolder(patch.name + " · " + id).getId(); patch.created_at = now(); patch.status = patch.status || "active";
    patch.phase = patch.phase || CONFIG.PHASES[0]; patch.progress = patch.progress || "0";
    insert("Projects", patch);
    return { project: projectOut(findBy("Projects", "id", id)) };
  },

  setCover: function (me, b) {
    needStaff(me); var p = needProject(me, b.projectId);
    var ok = rows("Photos").some(function (ph) { return ph.project_id === p.id && ph.file_id === String(b.fileId); });
    if (!ok) throw new Error("Pick one of this project's photos.");
    update("Projects", "id", p.id, { cover_file_id: String(b.fileId) }); return {};
  },

  addPerson: function (me, b) {
    needStaff(me);
    var email = normEmail(b.email), role = ["staff", "architect", "crew"].indexOf(b.role) > -1 ? b.role : "client", admin = me.role === "admin";
    if (role === "staff" && !admin) throw new Error("Only Jesús can add team members.");
    if (!b.projectId && (role === "client" || role === "architect")) throw new Error("Add clients and architects from a project's People tab, so they only see that project.");
    if (!/^[^@\s,;<>]+@[^@\s,;<>]+\.[^@\s,;<>]+$/.test(email)) throw new Error("That email doesn't look right.");
    var p = b.projectId ? needProject(me, b.projectId) : null;
    purgeOrphans();                                        // clear leftovers first, so a returning email always starts fresh
    var existing = findPerson(email);
    if (existing) {
      if (isStaff(existing) && !admin) throw new Error("Only Jesús can change team members.");
      if (!isTrue(existing.active) && !admin) throw new Error("This person's access was turned off. Ask Jesús to turn it back on.");
      var ids = splitIds(existing.project_ids); if (p && role !== "staff" && ids.indexOf(p.id) < 0) ids.push(p.id);
      var patch = { project_ids: ids.join(","), active: "yes" };
      if (existing.role !== role && existing.role !== "admin" && (admin || (!isStaff(existing) && role !== "staff"))) patch.role = role;   // only admins touch team roles
      if (b.name && clean(b.name, 120) && (!isStaff(existing) || admin)) patch.name = clean(b.name, 120);     // the name you type now wins
      if (admin && b.money != null) patch.money = (patch.role || existing.role) === "staff" && b.money ? "yes" : "";
      update("People", "email", email, patch);
    } else {
      insert("People", { email: email, name: clean(b.name, 120) || email, role: role, project_ids: p && role !== "staff" ? p.id : "", active: "yes", created_at: now(), money: admin && role === "staff" && b.money ? "yes" : "" });
    }
    if (b.invite && !p && (role === "staff" || role === "crew")) safeMail(function () {
      sendMail(email, "You're on the " + CONFIG.COMPANY + " portal team",
        "<p>Hi " + esc(first(b.name || "")) + ",</p><p>Jesús added you to the " + CONFIG.COMPANY + " project portal. You can see every project: schedule, photos, chat, contract and invoices.</p>" +
        button("Open the portal") + "<p>The first time, type this email address and we'll send you a 6-digit code. Then pick a PIN, and from then on you log in with your email and PIN.</p>");
    }, "Added, but the invitation email couldn't be sent.");
    if (b.invite && p) safeMail(function () {
      sendMail(email, "Your project portal for " + p.name,
        "<p>Hi " + esc(first(b.name || "")) + ",</p><p>You can follow <b>" + esc(p.name) + "</b> in the " + CONFIG.COMPANY + " portal: photos, updates, questions, invoices and the checklist, all in one place.</p>" +
        button("Open the portal") + "<p>The first time, type this email address and we'll send you a 6-digit code. Then pick a PIN, and from then on you log in with your email and PIN.</p>");
    }, "Added, but the invitation email couldn't be sent.");
    return {};
  },

  /* Change someone's role (#client, #architect, #crew, #team, #admin) and, for the team, #money. */
  setRole: function (me, b) {
    needStaff(me);
    var person = findPerson(b.email), admin = me.role === "admin", role = String(b.role || "");
    if (!person) throw new Error("Person not found.");
    if (["admin", "staff", "crew", "client", "architect"].indexOf(role) < 0) throw new Error("Pick a role.");
    if (person.email === me.email && role !== person.role) throw new Error("You can't change your own role.");
    if (!admin && (isStaff(person) || role === "staff" || role === "admin")) throw new Error("Only Jesús changes team roles.");
    var p = b.projectId ? needProject(me, b.projectId) : null, ids = splitIds(person.project_ids);
    if (p && ["client", "architect", "crew"].indexOf(role) > -1 && ids.indexOf(p.id) < 0) ids.push(p.id);
    if ((role === "client" || role === "architect") && !ids.length) throw new Error("Clients and architects need a project. Change it from that project's People tab.");
    var patch = { role: role, project_ids: ids.join(",") };
    if (b.money != null && !admin) throw new Error("Only Jesús decides who sees #money.");
    patch.money = role === "staff" && (b.money != null ? !!b.money : isTrue(person.money)) ? "yes" : "";
    update("People", "email", person.email, patch);
    return {};
  },

  /* Recently deleted → Delete forever: the project's rows go away for good and its Drive folder goes to the Drive trash. */
  purgeProject: function (me, b) {
    if (me.role !== "admin") throw new Error("Only Jesús can erase projects.");
    var p = needProject(me, b.projectId);
    if (p.status !== "deleted") throw new Error("Delete the project first. Then you can erase it from Recently deleted.");
    if (String(b.confirm || "").trim().toLowerCase() !== String(p.name).trim().toLowerCase()) throw new Error("Type the project name exactly to erase it.");
    WIPE_TABLES.concat(["Wipes", "EmailImports"]).forEach(function (t) { removeAll(t, function (r) { return r.project_id === p.id; }); });
    rows("People").forEach(function (x) { var ids = splitIds(x.project_ids); if (ids.indexOf(p.id) > -1) update("People", "email", x.email, { project_ids: ids.filter(function (i) { return i !== p.id; }).join(",") }); });
    removeWhere("Projects", function (r) { return r.id === p.id; });
    var trashed = false; try { if (p.folder_id) { DriveApp.getFolderById(p.folder_id).setTrashed(true); trashed = true; } } catch (e) {}
    purgeOrphans();
    return { trashed: trashed };
  },

  removePerson: function (me, b) {
    needStaff(me);
    var person = findPerson(normEmail(b.email)); if (!person) return {};
    if (person.email === me.email) throw new Error(b.projectId ? "You can't remove yourself." : "You can't turn off your own access.");
    if (person.role === "admin") throw new Error("Jesús can't be removed.");
    if (isStaff(person) && me.role !== "admin") throw new Error("Only Jesús can remove team members.");
    var ids = splitIds(person.project_ids).filter(function (x) { return x !== String(b.projectId); });
    // Removed from the team page, or from their last project: they leave the portal completely (sessions, PIN, presence),
    // so they disappear from Who's around and adding the email again starts fresh. Their old chat messages stay as history.
    if (!b.projectId || (!ids.length && !isStaff(person))) { purgePerson(person); purgeOrphans(); return { removed: true }; }
    update("People", "email", person.email, { project_ids: ids.join(",") });
    purgeOrphans(); return {};
  },

  postUpdate: function (me, b) {
    needStaff(me); var p = needProject(me, b.projectId);
    // #team, #client, #architect, #crew or #private in the text (or picked as chips) decide who sees it and which chat gets the card.
    var tg = readTags(clean(b.text, 5000)), aud = cleanAud(cleanAud(b.aud).concat(tg.aud)), text = tg.text;
    if (aud.indexOf("private") > -1) aud = ["private"];
    if (!text && !(b.photos || []).length) throw new Error("Write something or add photos.");
    var uid = newId("u"), ids = savePhotos(me, p, b.photos || [], "", uid), toClient = !aud.length || aud.indexOf("client") > -1;
    insert("Timeline", { id: uid, project_id: p.id, at: now(), author: me.name, author_email: me.email, text: text, photo_ids: ids.join(","), emailed: b.notify && toClient ? "yes" : "", aud: aud.join(",") });
    if (aud[0] !== "private") chansFor(aud).forEach(function (ch) {
      postEvent(p, me, "update", "posted a project update" + (ids.length ? " with " + ids.length + " photo" + (ids.length > 1 ? "s" : "") : ""), text.slice(0, 240), "update:" + uid, ch);
    });
    if (b.notify && toClient) safeMail(function () { emailClients(p, "Project update: " + p.name, "<p>" + nl2br(esc(text)) + "</p>" + (ids.length ? "<p>" + ids.length + " new photo" + (ids.length > 1 ? "s" : "") + " in the portal.</p>" : "") + button("See the update", deep(p.id, "updates"))); }, "Posted, but the email to the client couldn't be sent.");
    return {};
  },

  uploadPhotos: function (me, b) { needStaff(me); var p = needProject(me, b.projectId); var ids = savePhotos(me, p, b.photos || [], clean(b.caption, 300), ""); return { count: ids.length }; },
  deletePhoto: function (me, b) {
    needStaff(me); var ph = findBy("Photos", "id", b.photoId); if (!ph) return {}; var p = needProject(me, ph.project_id);
    try { DriveApp.getFileById(ph.file_id).setTrashed(true); } catch (e) {}
    removeWhere("Photos", function (r) { return r.id === ph.id; });
    if (p.cover_file_id === ph.file_id) {                    // pick the newest remaining photo as the cover
      var rest = rows("Photos").filter(function (r) { return r.project_id === p.id; });
      update("Projects", "id", p.id, { cover_file_id: rest.length ? rest[rest.length - 1].file_id : "" });
    }
    return {};
  },

  sendMessage: function (me, b) {
    var p = needProject(me, b.projectId), text = clean(b.text, 5000), channel = b.channel || "client";
    if (!canRead(me, channel)) throw new Error("You can't post in that channel.");
    var dmTo = null;
    if (isDm(channel)) {                                  // a private message: the other person must be on this project
      var other = channel.slice(3).split("-").filter(function (k) { return k !== pkey(me.email); })[0];
      dmTo = membersOf(p).filter(function (x) { return pkey(x.email) === other; })[0];
      if (!dmTo) throw new Error("That person isn't on this project.");
    }
    var root = "";
    if (b.threadId) {
      var parent = findBy("Messages", "id", b.threadId);
      if (!parent || parent.project_id !== p.id || chOf(parent) !== channel) throw new Error("That conversation isn't here anymore.");
      root = parent.thread_id || parent.id;                                  // replies always hang off the first message
    }
    var files = saveAttachments(p, b.files || []);
    if (!text && !files.length) throw new Error("Write a message.");
    var kind = isStaff(me) && b.kind === "question" && channel === "client" && !root ? "question" : "message";
    if (b.kind === "call") throw new Error("Use the call button.");
    var id = newId("m");
    insert("Messages", { id: id, project_id: p.id, at: now(), author: me.name, author_email: me.email, role: me.role, kind: kind, text: text, question_id: "", status: kind === "question" ? "open" : "",
      via: "portal", channel: channel, thread_id: root, files: files.length ? JSON.stringify(files) : "", reactions: "" });
    var emailed = {};
    var body = "<p>" + nl2br(esc(text)) + "</p>" + (files.length ? "<p style='color:#666'>" + files.length + " attachment" + (files.length > 1 ? "s" : "") + " in the portal.</p>" : "") + "<p style='color:#666'>— " + esc(me.name) + ", " + CONFIG.COMPANY + "</p>";
    if (dmTo) {
      emailed[dmTo.email] = 1;
      try { if (MailApp.getRemainingDailyQuota() >= CONFIG.MAIL_RESERVE) safeMail(function () { sendMail(dmTo.email, me.name + " sent you a private message · " + p.name, "<p>Hi " + esc(first(dmTo.name)) + ",</p><p><b>" + esc(me.name) + "</b> sent you a private message on " + esc(p.name) + ". Only the two of you can see it.</p><blockquote style='border-left:3px solid #ddd;margin:0;padding-left:12px;color:#333'>" + nl2br(esc(text)) + "</blockquote>" + button("Open the portal", deep(p.id, "messages", channel))); }, ""); } catch (e) {}
    } else if (isStaff(me) && (channel === "client" || channel === "architect")) {
      // Client channel: the client and the architect. Architect channel: only the architect. Replies by email come back into the same place.
      var who = membersOf(p).filter(function (x) { return isOutside(x) && (channel === "client" || x.role === "architect"); });
      var subj = (kind === "question" ? "Question about " : "Message about ") + p.name + " " + tag(p.id, id);
      safeMail(function () { who.forEach(function (x) { emailed[x.email] = 1; sendMail(x.email, subj, "<p>Hi " + esc(first(x.name)) + ",</p>" + body +
        (kind === "question" ? "<p><b>You can answer by replying to this email</b>, or in the portal.</p>" : "<p>You can reply to this email or in the portal.</p>") + button("Open the portal", deep(p.id, "messages", channel))); }); },
        "Saved, but the email couldn't be sent.");
    } else if (!isTeam(me)) notifyJesus(me.email, "New message from " + me.name + " · " + p.name, "<p>" + nl2br(esc(text)) + "</p>" + button("Open the portal", deep(p.id, "messages", channel)));
    if (!dmTo) notifyMentions(p, me, text, channel, emailed);
    markReadNow(me, p.id, channel);
    return { id: id };
  },

  /* Reactions: one tap adds or removes yours. */
  react: function (me, b) {
    var m = findBy("Messages", "id", b.messageId); if (!m) throw new Error("Message not found.");
    needProject(me, m.project_id); if (!seesMsg(me, m)) throw new Error("Message not found.");
    if (REACTIONS.indexOf(b.emoji) < 0) throw new Error("Pick one of the reactions.");
    var r = parseJson(m.reactions, {}), list = r[b.emoji] || [], i = list.indexOf(me.email);
    if (i > -1) list.splice(i, 1); else list.push(me.email);
    if (list.length) r[b.emoji] = list; else delete r[b.emoji];
    update("Messages", "id", m.id, { reactions: Object.keys(r).length ? JSON.stringify(r) : "" });
    return {};
  },
  /* The author or Jesús can delete a message; deleting the first message of a thread deletes its replies. */
  deleteMessage: function (me, b) {
    var m = findBy("Messages", "id", b.messageId); if (!m) return {};
    needProject(me, m.project_id);
    if (m.author_email !== me.email && me.role !== "admin") throw new Error("Only the person who wrote it can delete it.");
    var gone = rows("Messages").filter(function (x) { return x.id === m.id || (x.thread_id === m.id && !m.thread_id) || (m.kind === "question" && x.question_id === m.id); });
    gone.forEach(function (x) { parseJson(x.files, []).forEach(function (f) { try { DriveApp.getFileById(f.id).setTrashed(true); } catch (e) {} }); });
    var ids = {}; gone.forEach(function (x) { ids[x.id] = 1; });
    removeWhere("Messages", function (r) { return ids[r.id]; });
    return {};
  },
  markRead: function (me, b) {
    var p = needProject(me, b.projectId), ch = b.channel || "client";
    if (!canRead(me, ch)) return {};
    markReadNow(me, p.id, ch); return {};
  },
  /* Everything new across the projects and channels this person can see, newest first. */
  activity: function (me, b) {
    var seen = {}; rows("Projects").forEach(function (p) { if (canSee(me, p.id) && (isStaff(me) || p.status !== "archived") && p.status !== "deleted") seen[p.id] = p; });
    var reads = readsAll(me), lim = Math.min(Number(b.limit) || 60, 150), av = avatarsByEmail();
    var list = rows("Messages").filter(function (m) { return seen[m.project_id] && seesMsg(me, m); }).reverse().slice(0, lim);
    return { items: list.map(function (m) {
      var o = { id: m.id, project_id: m.project_id, project: seen[m.project_id].name, channel: chOf(m), thread_id: m.thread_id, kind: m.kind, author: m.author, role: m.role,
        at: m.at, text: String(m.text).slice(0, 400), files: parseJson(m.files, []).length, mine: m.author_email === me.email, ref: m.ref || "", status: m.kind === "event" ? m.status : "", avatar: av[m.author_email] || "",
        dm: isDm(chOf(m)), akey: keyOf(m.author_email) };
      o.unread = !o.mine && m.at > (reads[m.project_id + "|" + o.channel] || "");
      o.mention = mentions(m.text, me.name);
      return o;
    }) };
  },
  /* Your PIN: 6 digits, stored only as a salted hash. */
  setPin: function (me, b) {
    var pin = String(b.pin || "").replace(/\D/g, "");
    if (!/^\d{6}$/.test(pin)) throw new Error("The PIN has to be 6 digits.");
    if (/^(\d)\1{5}$/.test(pin) || "0123456789".indexOf(pin) > -1 || "9876543210".indexOf(pin) > -1) throw new Error("That PIN is too easy to guess. Try another one.");
    var salt = Utilities.getUuid().replace(/-/g, "").slice(0, 16);
    update("People", "email", me.email, { pin_salt: salt, pin_hash: sha(salt + ":" + pin), pin_fails: "0", pin_lock: "" });
    return {};
  },
  /* Your own profile picture: a fun character on a color. */
  saveProfile: function (me, b) {
    var av = String(b.avatar || "");
    if (/^sc:[a-z0-9=;]{1,120}$/.test(av) || /^fx:[a-z-]{2,40};t=[0-5];bg=[0-9]$/.test(av) || /^v1:[a-z0-9=;]{1,160}$/.test(av)) { update("People", "email", me.email, { avatar: av }); return { avatar: av }; }   // a drawn character
    var a = av.split("|"), emoji = a[0], color = a[1];
    if (av && (AVATARS.indexOf(emoji) < 0 || AVATAR_COLORS.indexOf(color) < 0)) throw new Error("Pick one of the characters.");
    update("People", "email", me.email, { avatar: av ? emoji + "|" + color : "" });
    return { avatar: av ? emoji + "|" + color : "" };
  },
  /* Who's around: each open portal pings every ~30 s. Kept in the script cache (fast, never written to the sheet).
     You see people who share a project with you; where they are (project and tab) only for projects you can see too. */
  presence: function (me, b) {
    var c = CacheService.getScriptCache(), myKey = pkey(me.email), prevRaw = c.get("pres:" + myKey), prev = prevRaw ? JSON.parse(prevRaw) : {};
    var st = ["available", "busy", "away"].indexOf(b.status) > -1 ? b.status : prev.s || "available";
    var mine = { s: st, at: Date.now(), hidden: !!b.hidden, pid: canSee(me, b.pid) ? String(b.pid || "") : "", tab: String(b.tab || "").slice(0, 20), call: prev.call || 0 };
    c.put("pres:" + myKey, JSON.stringify(mine), 21600);
    var projects = rows("Projects").filter(function (p) { return canSee(me, p.id) && p.status !== "deleted" && (isStaff(me) || p.status !== "archived"); }), names = {};
    projects.forEach(function (p) { names[p.id] = p.name; });
    var live = liveProjectIds(), people = rows("People").filter(function (x) {
      if (x.email === me.email || !inPortal(x, live)) return false;
      if (isStaff(me)) return true;                                                  // the team sees everyone on the portal
      return isStaff(x) || splitIds(x.project_ids).some(function (id) { return names[id]; });
    });
    var keys = people.map(function (x) { return "pres:" + pkey(x.email); }), got = c.getAll(keys), now = Date.now();
    // Pulse: the newest message someone else wrote where I can read it, plus how many I haven't read.
    var reads = readsAll(me), newest = null, unread = 0;
    rows("Messages").forEach(function (m) {
      if (!names[m.project_id] || m.author_email === me.email || !seesMsg(me, m)) return;
      if (m.at > (reads[m.project_id + "|" + chOf(m)] || "")) unread++;
      newest = m;                                         // sheet order = the order things were written
    });
    var pulse = newest ? { id: newest.id, at: newest.at, author: newest.author, avatar: (rows("People").filter(function (x) { return x.email === newest.author_email; })[0] || {}).avatar || "", akey: keyOf(newest.author_email),
      text: String(newest.text).split("\n")[0].slice(0, 140), kind: newest.kind, status: newest.kind === "event" ? newest.status : "", pid: newest.project_id, project: names[newest.project_id], channel: chOf(newest), thread_id: newest.thread_id || "", dm: isDm(chOf(newest)), unread: unread } : { unread: unread };
    return { me: mine, pulse: pulse, ver: b.pid && names[b.pid] ? versionOf(String(b.pid)) : 0, people: people.map(function (x) {
      var k = pkey(x.email), raw = got["pres:" + k], pr = raw ? JSON.parse(raw) : null, age = pr ? now - pr.at : Infinity;
      var state = !pr || age > 3 * 60000 ? "offline" : pr.call > now ? "busy" : pr.s === "busy" ? "busy" : pr.hidden || pr.s === "away" || age > 90000 ? "away" : "online";
      var shared = isStaff(x) ? projects.map(function (p) { return p.id; }) : splitIds(x.project_ids).filter(function (id) { return names[id]; });
      return { key: k, name: x.name, role: x.role, avatar: x.avatar || "", state: state, last: pr ? pr.at : 0, inCall: !!(pr && pr.call > now),
        pid: pr && state !== "offline" && names[pr.pid] ? pr.pid : "", project: pr && names[pr.pid] ? names[pr.pid] : "", tab: pr && names[pr.pid] ? pr.tab : "", shared: shared.slice(0, 50) };
    }) };
  },
  /* Delete an invoice (team only): its PDF goes to the Drive trash and its chat card disappears. */
  deleteInvoice: function (me, b) {
    needStaff(me); var i = findBy("Invoices", "id", b.invoiceId); if (!i) return {}; needProject(me, i.project_id);
    if (i.pdf_file_id) try { DriveApp.getFileById(i.pdf_file_id).setTrashed(true); } catch (e) {}
    removeWhere("Invoices", function (r) { return r.id === i.id; });
    removeWhere("Messages", function (r) { return r.kind === "event" && r.ref === "invoice:" + i.id; });
    return {};
  },
  /* Delete a project update (team only). Its photos stay in the Photos tab unless you ask to delete them too. */
  deleteUpdate: function (me, b) {
    needStaff(me); var u = findBy("Timeline", "id", b.updateId); if (!u) return {}; needProject(me, u.project_id);
    if (b.withPhotos) {
      var ids = splitIds(u.photo_ids);
      rows("Photos").filter(function (ph) { return ids.indexOf(ph.id) > -1; }).forEach(function (ph) { try { DriveApp.getFileById(ph.file_id).setTrashed(true); } catch (e) {} });
      removeWhere("Photos", function (r) { return ids.indexOf(r.id) > -1; });
    }
    removeWhere("Timeline", function (r) { return r.id === u.id; });
    removeWhere("Messages", function (r) { return r.kind === "event" && r.ref === "update:" + u.id; });
    return {};
  },
  /* Pin or unpin an update or a message (team only); pinned things show at the top for everyone who can see them. */
  togglePin: function (me, b) {
    needStaff(me);
    var t = b.kind === "update" ? "Timeline" : b.kind === "check" ? "Checklist" : "Messages", it = findBy(t, "id", b.id); if (!it) throw new Error("Not found.");
    needProject(me, it.project_id);
    update(t, "id", it.id, { pinned: isTrue(it.pinned) ? "" : "yes" }); return { pinned: !isTrue(it.pinned) };
  },
  /* Jesús only. Deleting hides the project from everyone (photos and files stay in Drive); it can be restored. */
  deleteProject: function (me, b) {
    if (me.role !== "admin") throw new Error("Only Jesús can delete projects.");
    var p = needProject(me, b.projectId);
    if (String(b.confirm || "").trim().toLowerCase() !== String(p.name).trim().toLowerCase()) throw new Error("Type the project name exactly to delete it.");
    update("Projects", "id", p.id, { status: "deleted" }); return {};
  },
  restoreProject: function (me, b) {
    if (me.role !== "admin") throw new Error("Only Jesús can restore projects.");
    var p = needProject(me, b.projectId); update("Projects", "id", p.id, { status: "active" }); return {};
  },
  /* A Google Meet call: you pick who you're calling (people who can see this channel); they get an email with the link and the code,
     they're added as guests on the Calendar event (so Meet lets them straight in), and a "Join" card with the code lands in the channel. */
  startCall: function (me, b) {
    var p = needProject(me, b.projectId), ch = b.channel || "client";
    if (!canRead(me, ch)) throw new Error("You can't start a call there.");
    var c = CacheService.getScriptCache(), k = "calls:" + normEmail(me.email), n = Number(c.get(k) || 0);
    if (n >= 20) throw new Error("That's a lot of calls in an hour. Use the last link.");
    var keys = (b.invite || []).map(String), who = membersOf(p).filter(function (x) { return x.email !== me.email && keys.indexOf(pkey(x.email)) > -1 && canRead(x, ch); });
    if (!who.length) throw new Error("Pick at least one person to call.");
    c.put(k, String(n + 1), 3600);
    var start = new Date(), end = new Date(start.getTime() + 60 * 60000), names = who.map(function (x) { return x.name; });
    var ev = Calendar.Events.insert({ summary: "Call · " + p.name + " (" + me.name + ")", description: "Started from the Blue Sierra portal.",
      start: { dateTime: start.toISOString() }, end: { dateTime: end.toISOString() },
      attendees: who.map(function (x) { return { email: x.email }; }).concat(me.email !== Session.getEffectiveUser().getEmail() ? [{ email: me.email }] : []),
      guestsCanModify: false, guestsCanInviteOthers: true,
      conferenceData: { createRequest: { requestId: newId("r"), conferenceSolutionKey: { type: "hangoutsMeet" } } } }, "primary", { conferenceDataVersion: 1, sendUpdates: "none" });
    var linkOf = function (e) { return e.hangoutLink || ((e.conferenceData && e.conferenceData.entryPoints || []).filter(function (x) { return x.entryPointType === "video"; })[0] || {}).uri; };
    var url = linkOf(ev);
    // Google sometimes needs a moment to make the Meet room: wait for it instead of failing.
    for (var tries = 0; !url && tries < 6; tries++) { Utilities.sleep(600 + tries * 300); ev = Calendar.Events.get("primary", ev.id); url = linkOf(ev); }
    if (!/^https:\/\/meet\.google\.com\//.test(url || "")) throw new Error("Google didn't return a Meet link. Try again.");
    var code = url.split("/").pop();
    who.forEach(function (x) {
      try { if (MailApp.getRemainingDailyQuota() < CONFIG.MAIL_RESERVE) return; } catch (e) {}
      safeMail(function () { sendMail(x.email, "📹 " + me.name + " is calling you · " + p.name, "<p>Hi " + esc(first(x.name)) + ",</p><p><b>" + esc(me.name) + "</b> started a video call about <b>" + esc(p.name) + "</b> and is waiting for you.</p>" +
        "<p><a href='" + url + "' style='display:inline-block;background:#1a73e8;color:#fff;padding:10px 18px;border-radius:999px;text-decoration:none'>Join the call</a></p>" +
        "<p style='color:#555'>Or open <b>meet.google.com</b> and enter the code <b>" + esc(code) + "</b>.</p>"); }, "");
    });
    try { var pc = CacheService.getScriptCache(), pkk = "pres:" + pkey(me.email), pv = JSON.parse(pc.get(pkk) || "{}"); pv.call = Date.now() + 45 * 60000; pv.at = pv.at || Date.now(); pc.put(pkk, JSON.stringify(pv), 21600); } catch (e) {}
    withLock(function () {                                // only the chat card needs the lock; the Calendar work above didn't
      _ROWS = {}; prefetch(["People", "Projects", "Messages"]);
      postEvent(p, me, "call", "is calling " + (names.length > 3 ? names.slice(0, 3).join(", ") + " and " + (names.length - 3) + " more" : names.join(", ").replace(/, ([^,]*)$/, " and $1")),
        "Tap Join (it opens the Google Meet app on phones), or open meet.google.com and enter this code. The link works for the next hour.", "meet:" + url, ch);
    });
    bumpVersion(p.id);
    return { url: url, code: code };
  },

  /* ---------- Plans: revisions of the drawing set, with what changed sheet by sheet ---------- */
  planStart: function (me, b) {
    needStaff(me); var p = needProject(me, b.projectId);
    var origin = String(b.origin || ""); if (PLAN_ORIGINS.indexOf(origin) < 0) throw new Error("Uploads only work from the portal page.");
    var size = Number(b.size) || 0; if (size <= 0 || size > 300 * 1024 * 1024) throw new Error("The PDF must be under 300 MB.");
    var set = clean(b.set, 120) || "Plans", rev = clean(b.rev, 40) || "Rev 1", name = clean(b.name, 160) || (set + " " + rev + ".pdf");
    var id = newId("d");
    insert("Plans", { id: id, project_id: p.id, set: set, rev: rev, date: dateOrEmpty(b.date) || today(), notes: clean(b.notes, 2000), visible: ["team", "architect", "all"].indexOf(b.visible) > -1 ? b.visible : "team",
      pdf_file_id: "", pdf_name: name, pages: "0", sheets: "[]", status: "uploading", by: me.name, at: now() });
    // The browser sends the PDF straight to Google Drive (no size limit from this script); we only open the upload.
    var res = UrlFetchApp.fetch("https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable&fields=id", {
      method: "post", contentType: "application/json; charset=UTF-8", muteHttpExceptions: true,
      headers: { Authorization: "Bearer " + ScriptApp.getOAuthToken(), "X-Upload-Content-Type": "application/pdf", "X-Upload-Content-Length": String(size), Origin: origin },
      payload: JSON.stringify({ name: name, mimeType: "application/pdf", parents: [projectFolder(p).getId()] }) });
    var loc = res.getHeaders().Location || res.getHeaders().location;
    if (res.getResponseCode() !== 200 || !loc) { removeWhere("Plans", function (r) { return r.id === id; }); throw new Error("Google Drive didn't open the upload (" + res.getResponseCode() + ")."); }
    return { id: id, uploadUrl: loc };
  },
  planPages: function (me, b) {
    needStaff(me); var d = findBy("Plans", "id", b.id); if (!d) throw new Error("Upload not found."); var p = needProject(me, d.project_id);
    var list = b.pages || []; if (list.length > 4) throw new Error("Up to 4 pages at a time.");
    var sheets = parseJson(d.sheets, []);
    list.forEach(function (pg) {
      var fid = saveFile(p, { mime: "image/jpeg", data: pg.data }, d.set + " " + d.rev + " p" + pg.n + ".jpg", true);
      sheets = sheets.filter(function (x) { return x.n !== Number(pg.n); });
      sheets.push({ n: Number(pg.n), img: fid, w: Number(pg.w) || 0, h: Number(pg.h) || 0, sheet: clean(pg.sheet, 30), title: clean(pg.title, 120) });
    });
    sheets.sort(function (a, c) { return a.n - c.n; });
    update("Plans", "id", d.id, { sheets: JSON.stringify(sheets) }); return { count: sheets.length };
  },
  planFinish: function (me, b) {
    needStaff(me); var d = findBy("Plans", "id", b.id); if (!d) throw new Error("Upload not found."); var p = needProject(me, d.project_id);
    var file; try { file = DriveApp.getFileById(String(b.fileId)); } catch (e) { throw new Error("The PDF didn't reach Drive. Try again."); }
    var inFolder = false, it = file.getParents(), fid = projectFolder(p).getId(); while (it.hasNext()) if (it.next().getId() === fid) inFolder = true;
    if (!inFolder || file.getMimeType() !== "application/pdf") throw new Error("That file isn't this project's plan upload.");
    try { file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW); } catch (e) {}
    var meta = {}; (b.sheets || []).forEach(function (x) { meta[Number(x.n)] = x; });
    var sheets = parseJson(d.sheets, []).map(function (x) {
      var m = meta[x.n] || {};
      return Object.assign(x, { sheet: clean(m.sheet != null ? m.sheet : x.sheet, 30), title: clean(m.title != null ? m.title : x.title, 120), status: ["new", "changed", "same"].indexOf(m.status) > -1 ? m.status : "new",
        prev: m.prev && m.prev.id ? { id: clean(m.prev.id, 20), n: Number(m.prev.n) || 0, rev: clean(m.prev.rev, 40) } : null,
        score: Math.round((Number(m.score) || 0) * 10000) / 10000, boxes: (m.boxes || []).slice(0, 40).map(function (bx) { return bx.slice(0, 4).map(function (v) { return Math.round(Number(v) * 1000) / 1000; }); }) });
    });
    var removed = (b.removed || []).slice(0, 200).map(function (x) { return clean(x, 30); });
    // The words on each sheet (with positions), so the next revision can spot changed dimensions and notes.
    var textId = "";
    if (b.text && typeof b.text === "object") { var tf = projectFolder(p).createFile(Utilities.newBlob(JSON.stringify(b.text).slice(0, 20 * 1024 * 1024), "application/json", d.set + " " + d.rev + " text.json")); textId = tf.getId(); }
    update("Plans", "id", d.id, { pdf_file_id: file.getId(), pages: String(sheets.length), sheets: JSON.stringify(sheets), status: "ready", text_file_id: textId });
    var ch = sheets.filter(function (x) { return x.status === "changed"; }).length, nw = sheets.filter(function (x) { return x.status === "new"; }).length;
    var isFirst = rows("Plans").filter(function (r) { return r.project_id === p.id && r.set === d.set && r.status === "ready"; }).length === 1;
    var detail = isFirst ? sheets.length + " sheet" + (sheets.length === 1 ? "" : "s") : (ch ? ch + " sheet" + (ch > 1 ? "s" : "") + " changed" : "No sheet changes found") + (nw ? " · " + nw + " new" : "") + (removed.length ? " · " + removed.length + " removed" : "");
    var text = (d.notes ? " · " + d.notes.slice(0, 160) : "");
    postEvent(p, me, "plan", "uploaded " + d.set + " " + d.rev, detail + text, "plan:" + d.id, "team");
    if (d.visible === "architect" || d.visible === "all") postEvent(p, me, "plan", "uploaded " + d.set + " " + d.rev, detail + text, "plan:" + d.id, d.visible === "all" ? "client" : "architect");
    return {};
  },
  planImage: function (me, b) {
    var d = findBy("Plans", "id", b.id); if (!d) throw new Error("Plan not found."); needProject(me, d.project_id);
    if (!planVisible(d, me)) throw new Error("Plan not found.");
    var sh = parseJson(d.sheets, []).filter(function (x) { return x.n === Number(b.n); })[0]; if (!sh) throw new Error("Sheet not found.");
    return { data: "data:image/jpeg;base64," + Utilities.base64Encode(DriveApp.getFileById(sh.img).getBlob().getBytes()) };
  },
  planText: function (me, b) {
    var d = findBy("Plans", "id", b.id); if (!d) throw new Error("Plan not found."); needProject(me, d.project_id); needStaff(me);
    if (!d.text_file_id) return { text: {} };
    return { text: parseJson(DriveApp.getFileById(d.text_file_id).getBlob().getDataAsString(), {}) };
  },
  deletePlan: function (me, b) {
    needStaff(me); var d = findBy("Plans", "id", b.id); if (!d) return {}; needProject(me, d.project_id);
    [d.pdf_file_id, d.text_file_id].concat(parseJson(d.sheets, []).map(function (x) { return x.img; })).forEach(function (f) { if (f) try { DriveApp.getFileById(f).setTrashed(true); } catch (e) {} });
    removeWhere("Plans", function (r) { return r.id === d.id; }); return {};
  },

  /* Jesús only: which address portal emails go out from, and which "Send mail as" aliases Gmail has. */
  mailStatus: function (me) {
    if (me.role !== "admin") throw new Error("Only Jesús can see this.");
    var aliases = []; try { aliases = GmailApp.getAliases(); } catch (e) {}
    CacheService.getScriptCache().remove("from-alias");
    return { account: Session.getEffectiveUser().getEmail(), aliases: aliases, sendingFrom: fromAddress() || Session.getEffectiveUser().getEmail(), wanted: CONFIG.FROM_EMAIL };
  },
  listTeam: function (me) {
    needStaff(me);
    return { team: rows("People").filter(isTeam).map(function (x) { return { email: x.email, name: x.name, role: x.role, money: canMoney(x), active: isTrue(x.active), since: String(x.created_at || "").slice(0, 10), avatar: x.avatar || "", projects: splitIds(x.project_ids).length }; }) };
  },

  answerQuestion: function (me, b) {
    var p = needProject(me, b.projectId), q = findBy("Messages", "id", b.questionId);
    if (!q || q.project_id !== p.id || q.kind !== "question") throw new Error("Question not found.");
    var text = clean(b.text, 5000); if (!text) throw new Error("Write an answer.");
    addAnswer(p, q, me.name, me.email, me.role, text, "portal", now());
    return {};
  },

  closeQuestion: function (me, b) { needStaff(me); var q = findBy("Messages", "id", b.questionId); if (q) { needProject(me, q.project_id); update("Messages", "id", q.id, { status: "answered" }); } return {}; },

  saveInvoice: function (me, b) {
    needStaff(me); var p = needProject(me, b.projectId), f = b.invoice || {};
    var patch = {
      number: clean(f.number, 40), title: clean(f.title, 200), amount: String(Math.round((Number(f.amount) || 0) * 100) / 100),
      issued: dateOrEmpty(f.issued), due: dateOrEmpty(f.due), status: ["draft", "sent", "paid", "void"].indexOf(f.status) > -1 ? f.status : "sent",
      paid_date: f.status === "paid" ? (dateOrEmpty(f.paid_date) || today()) : "", pay_url: /^https:\/\//.test(f.pay_url || "") ? String(f.pay_url).slice(0, 500) : ""
    };
    if (f.notes != null) patch.notes = clean(f.notes, 1000);       // never blank notes the form didn't send
    // Work billed by contract line (AIA G703 style). When it's given, the invoice amount is its total.
    if (f.lines != null) {
      var valid = {}; rows("ContractLines").forEach(function (l) { if (l.project_id === p.id && l.status !== "rejected") valid[l.id] = 1; });
      var lines = {}, sum = 0;
      Object.keys(f.lines || {}).forEach(function (k) { var a = cents(f.lines[k]); if (!a) return; if (!valid[k]) throw new Error("That contract line isn't on this project."); lines[k] = a; sum += a; });
      patch.lines = Object.keys(lines).length ? JSON.stringify(lines) : "";
      if (patch.lines) patch.amount = String(cents(sum));
    }
    if (f.retainage != null) patch.retainage = String(cents(f.retainage));
    if (num(patch.retainage) > num(patch.amount) && num(patch.amount) > 0) throw new Error("Retainage can't be more than the work billed.");
    var id = f.id, old = id ? findBy("Invoices", "id", id) : null;
    if (id && (!old || old.project_id !== p.id)) throw new Error("Invoice not found.");
    if (f.pdf && f.pdf.data) {
      patch.pdf_file_id = saveFile(p, f.pdf, "Invoice " + (patch.number || "") + ".pdf", false);
      if (old && old.pdf_file_id) try { DriveApp.getFileById(old.pdf_file_id).setTrashed(true); } catch (e) {}
    }
    var pdfId = patch.pdf_file_id || (old && old.pdf_file_id);
    if (pdfId) try { DriveApp.getFileById(pdfId).setSharing(patch.status === "void" || patch.status === "draft" ? DriveApp.Access.PRIVATE : DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW); } catch (e) {}
    var wasVisible = old && ["sent", "paid"].indexOf(old.status) > -1, bch = billChannel(p);
    patch.updated_by = me.email; patch.updated_at = now();
    if (id) update("Invoices", "id", id, patch);
    else { id = newId("i"); patch.id = id; patch.project_id = p.id; patch.created_by = me.email; patch.created_at = now(); if (patch.notes == null) patch.notes = ""; insert("Invoices", patch); }
    var dueNow = num(patch.amount != null ? patch.amount : old && old.amount) - num(patch.retainage != null ? patch.retainage : old && old.retainage);
    if (patch.status === "sent" && !wasVisible) postEvent(p, me, "invoice", "sent invoice " + patch.number, (patch.title ? patch.title + " · " : "") + "$" + money(dueNow) + " due" + (patch.due ? " by " + patch.due : ""), "invoice:" + id, bch);
    if (patch.status === "paid" && (!old || old.status !== "paid")) postEvent(p, me, "paid", "marked invoice " + patch.number + " as paid", "$" + money(dueNow) + " received. Thank you!", "invoice:" + id, bch);
    if (b.notify && patch.status === "sent" && bch === "client") safeMail(function () {
      emailClients(p, "Invoice " + patch.number + " · " + p.name,
        "<p>A new invoice is ready in your portal: <b>" + esc(patch.title || patch.number) + "</b>, $" + money(num(patch.amount) - num(patch.retainage != null ? patch.retainage : old && old.retainage)) + (patch.due ? ", due " + esc(patch.due) : "") + ".</p>" + button("See the invoice", deep(p.id, "invoices")));
    }, "Saved, but the email to the client couldn't be sent.");
    return { id: id };
  },

  /* Contract: schedule-of-values lines and change orders. */
  saveContractLine: function (me, b) {
    needStaff(me); var p = needProject(me, b.projectId), f = b.line || {}, kind = f.kind === "change" ? "change" : "base";
    var patch = { kind: kind, number: clean(f.number, 20), title: clean(f.title, 200), amount: String(cents(f.amount)), date: dateOrEmpty(f.date),
      status: kind === "base" ? "approved" : (["proposed", "approved", "rejected"].indexOf(f.status) > -1 ? f.status : "proposed") };
    if (f.notes != null) patch.notes = clean(f.notes, 1000);
    if (!patch.title) throw new Error("Give the line a name.");
    if (kind === "base" && num(patch.amount) <= 0) throw new Error("A contract line needs an amount above zero.");
    if (f.id) {
      var it = findBy("ContractLines", "id", f.id); if (!it || it.project_id !== p.id) throw new Error("Line not found.");
      if (patch.status === "rejected" && billedOn(p.id, it.id)) throw new Error("Invoices already bill this change order, so it can't be rejected.");
      update("ContractLines", "id", f.id, patch);
      if (kind === "change" && patch.status !== it.status && patch.status !== "rejected") coEvent(p, me, patch, f.id, patch.status === "approved" ? "approved" : "proposed");
    } else {
      patch.id = newId("c"); patch.project_id = p.id; patch.sort = String(Date.now()); if (patch.notes == null) patch.notes = ""; insert("ContractLines", patch);
      if (kind === "change" && patch.status !== "rejected") coEvent(p, me, patch, patch.id, patch.status === "approved" ? "added an approved" : "proposed a");
    }
    return {};
  },
  deleteContractLine: function (me, b) {
    needStaff(me); var it = findBy("ContractLines", "id", b.lineId); if (!it) return {};
    needProject(me, it.project_id);
    if (billedOn(it.project_id, it.id)) throw new Error("Invoices already bill this line. Edit those invoices first.");
    removeWhere("ContractLines", function (r) { return r.id === it.id; }); return {};
  },
  /* Checklist items carry #tags (who sees them) and can be assigned to one person (it lands in their to-dos and alerts). */
  saveChecklistItem: function (me, b) {
    needStaff(me); var p = needProject(me, b.projectId), f = b.item || {};
    var tg = readTags(clean(f.item, 300)), aud = cleanAud(cleanAud(f.aud).concat(tg.aud));
    var keys = (Array.isArray(f.assignees) ? f.assignees : f.assignee ? [f.assignee] : []).map(String).filter(function (k, i, l) { return k && l.indexOf(k) === i; }).slice(0, 12);
    var mem = membersOf(p), who = keys.map(function (k) { var x = mem.filter(function (m) { return pkey(m.email) === k; })[0]; if (!x) throw new Error("Someone you picked isn't on this project."); return x; });
    var assignee = who.map(function (x) { return x.email; }).join(",");
    if (who.length && !aud.length) aud = who.map(myAud).filter(function (a, i, l) { return l.indexOf(a) === i; });
    var patch = { phase: CONFIG.PHASES.indexOf(f.phase) > -1 ? f.phase : CONFIG.PHASES[0], item: tg.text, owner: aud.indexOf("client") > -1 || (!aud.length && f.owner === "client") ? "client" : "blue sierra",
      due: dateOrEmpty(f.due), aud: aud.join(","), assignee: assignee, edited_by: me.email, edited_at: now() };
    if (!patch.item) throw new Error("Write the checklist item.");
    var old = f.id ? findBy("Checklist", "id", f.id) : null, id = f.id, before = old ? splitIds(old.assignee) : [];   // read before saving: the row object changes in place
    if (f.id) { if (!old || old.project_id !== p.id) throw new Error("Item not found."); update("Checklist", "id", f.id, patch); }
    else {
      id = newId("c"); patch.id = id; patch.project_id = p.id; patch.done = ""; patch.sort = String(Date.now()); patch.created_by = me.email; patch.reactions = ""; patch.pinned = ""; insert("Checklist", patch);
      if (patch.owner === "client" && !assignee) postEvent(p, me, "todo", "added a to-do for the client", patch.item + (patch.due ? " · due " + patch.due : ""), "check:" + id, "client");
    }
    var fresh = who.filter(function (x) { return before.indexOf(x.email) < 0 && x.email !== me.email; });
    if (fresh.length) {
      postEvent(p, me, "todo", "assigned a to-do to " + fresh.map(function (x) { return x.name; }).join(", "), patch.item + (patch.due ? " · due " + patch.due : ""), "check:" + id, chanFor(aud));
      fresh.forEach(function (x) {
        try { if (MailApp.getRemainingDailyQuota() >= CONFIG.MAIL_RESERVE) sendMail(x.email, me.name + " gave you a to-do · " + p.name, "<p>Hi " + esc(first(x.name)) + ",</p><p><b>" + esc(me.name) + "</b> assigned you a to-do on <b>" + esc(p.name) + "</b>" + (who.length > 1 ? " (with " + esc(who.filter(function (y) { return y.email !== x.email; }).map(function (y) { return first(y.name); }).join(", ")) + ")" : "") + ":</p><blockquote style='border-left:3px solid #ddd;margin:0;padding-left:12px;color:#333'>" + esc(patch.item) + (patch.due ? "<br><small>Due " + esc(patch.due) + "</small>" : "") + "</blockquote>" + button("Open my to-dos", deep(p.id, "checklist")), ""); } catch (e) {}
      });
    }
    return { id: id };
  },
  /* Schedule: Gantt tasks (start + end) and dated events (inspections, payments, decisions, meetings, milestones, deadlines). */
  saveScheduleItem: function (me, b) {
    needStaff(me); var p = needProject(me, b.projectId), f = b.item || {};
    var patch = {
      kind: KINDS.indexOf(f.kind) > -1 ? f.kind : "task", title: clean(f.title, 200), start: dateOrEmpty(f.start),
      end: dateOrEmpty(f.end), phase: CONFIG.PHASES.indexOf(f.phase) > -1 ? f.phase : "", owner: f.owner === "client" ? "client" : "blue sierra",
      status: ["planned", "in progress", "done"].indexOf(f.status) > -1 ? f.status : "planned"
    };
    if (f.notes != null) patch.notes = clean(f.notes, 1000);
    if (!patch.title) throw new Error("Give it a name.");
    if (!patch.start) throw new Error("Pick a date.");
    if (patch.kind !== "task") patch.end = "";
    if (patch.end && patch.end < patch.start) throw new Error("The end date is before the start date.");
    patch.edited_by = me.email; patch.edited_at = now(); patch.req_by = ""; patch.req_at = ""; patch.req_note = "";     // a team edit answers any pending request
    if (f.id) { var it = findBy("Schedule", "id", f.id); if (!it || it.project_id !== p.id) throw new Error("Item not found."); update("Schedule", "id", f.id, patch); }
    else {
      patch.id = newId("s"); patch.project_id = p.id; patch.sort = String(Date.now()); if (patch.notes == null) patch.notes = ""; insert("Schedule", patch);
      if (patch.kind !== "task") postEvent(p, me, "date", "added a date to the schedule", patch.title + " · " + patch.start, "sched:" + patch.id);
    }
    return {};
  },
  deleteScheduleItem: function (me, b) { needStaff(me); var it = findBy("Schedule", "id", b.itemId); if (it) { needProject(me, it.project_id); removeWhere("Schedule", function (r) { return r.id === it.id; }); } return {}; },
  /* One click: the six standard phases spread evenly between the project's start and target dates. */
  addStandardPhases: function (me, b) {
    needStaff(me); var p = needProject(me, b.projectId);
    if (!p.start_date || !p.target_date || p.target_date <= p.start_date) throw new Error("Set the project's start and target dates first (Edit project).");
    if (rows("Schedule").some(function (r) { return r.project_id === p.id && r.kind === "task" && CONFIG.PHASES.indexOf(r.title) > -1; })) throw new Error("The standard phases are already on the schedule.");
    var s0 = new Date(p.start_date + "T12:00:00Z").getTime(), total = new Date(p.target_date + "T12:00:00Z").getTime() - s0;
    var weights = [2, 2, 1, 6, 1, 0.3], sum = weights.reduce(function (a, w) { return a + w; }, 0), acc = 0;
    var d = function (ms) { return Utilities.formatDate(new Date(ms), "UTC", "yyyy-MM-dd"); };
    CONFIG.PHASES.forEach(function (ph, i) {
      var a = s0 + total * acc / sum; acc += weights[i]; var z = s0 + total * acc / sum - (i < CONFIG.PHASES.length - 1 ? 864e5 : 0);
      insert("Schedule", { id: newId("s"), project_id: p.id, kind: "task", title: ph, start: d(a), end: d(Math.max(a, z)), phase: ph, owner: "blue sierra", status: "planned", notes: "", sort: String(Date.now() + i) });
    });
    return {};
  },
  deleteChecklistItem: function (me, b) { needStaff(me); var it = findBy("Checklist", "id", b.itemId); if (it) { needProject(me, it.project_id); removeWhere("Checklist", function (r) { return r.id === it.id; }); } return {}; },
  toggleChecklist: function (me, b) {
    var it = findBy("Checklist", "id", b.itemId); if (!it) throw new Error("Item not found.");
    var p = needProject(me, it.project_id);
    if (!canCheck(me, it)) throw new Error(it.assignee ? "Only the people it's assigned to (or Blue Sierra) check that one." : it.owner === "client" ? "Only the client checks off that one." : "Blue Sierra checks off that one.");
    var done = !isTrue(it.done);
    update("Checklist", "id", it.id, { done: done ? "yes" : "", done_by: done ? me.name : "", done_email: done ? me.email : "", done_at: done ? now() : "" });
    if (done && !isStaff(me)) notifyJesus(me.email, me.name + " checked off: " + it.item, "<p>" + esc(p.name) + "</p>" + button("Open the portal", deep(p.id, "checklist")));
    if (done && audList(it.aud).indexOf("private") < 0) postEvent(p, me, "done", "checked off a to-do", it.item, "check:" + it.id, chanFor(audList(it.aud)));
    return {};
  },
  /* A like (or any of the reactions) on a checklist item. */
  reactCheck: function (me, b) {
    var it = findBy("Checklist", "id", b.itemId); if (!it) throw new Error("Item not found.");
    needProject(me, it.project_id); if (!audOk(me, it.aud) && !isAssigned(it, me.email)) throw new Error("Item not found.");
    if (REACTIONS.indexOf(b.emoji) < 0) throw new Error("Pick one of the reactions.");
    var r = parseJson(it.reactions, {}), list = r[b.emoji] || [], i = list.indexOf(me.email);
    if (i > -1) list.splice(i, 1); else list.push(me.email);
    if (list.length) r[b.emoji] = list; else delete r[b.emoji];
    update("Checklist", "id", it.id, { reactions: Object.keys(r).length ? JSON.stringify(r) : "" }); return {};
  },
  /* Anyone on the project who can't edit the schedule (client, architect, crew) can ask for a change. */
  requestScheduleChange: function (me, b) {
    var it = findBy("Schedule", "id", b.itemId); if (!it) throw new Error("Item not found.");
    var p = needProject(me, it.project_id), note = clean(b.note, 500);
    if (!note) throw new Error("Say what should change.");
    update("Schedule", "id", it.id, { req_by: me.email, req_at: now(), req_note: note });
    var ch = isStaff(me) ? "team" : channelsFor(me)[me.role === "architect" ? 1 : 0];
    postEvent(p, me, "date", "asked to change “" + it.title + "”", note, "sched:" + it.id, ch);
    if (!isStaff(me)) notifyJesus(me.email, me.name + " asked for a schedule change · " + p.name, "<p><b>" + esc(it.title) + "</b></p><p>" + nl2br(esc(note)) + "</p>" + button("Open the schedule", deep(p.id, "schedule")));
    return {};
  },
  /* Admin: start a project over. Everything in it (chat, updates, photos list, invoices, contract, checklist, schedule, plans,
     and the people added to it) moves to the Wipes tab, so it can be brought back exactly as it was. Drive files are never deleted. */
  wipeProject: function (me, b) {
    if (me.role !== "admin") throw new Error("Only Jesús can start a project over.");
    var p = needProject(me, b.projectId);
    if (String(b.confirm || "").trim().toLowerCase() !== String(p.name).trim().toLowerCase()) throw new Error("Type the project name exactly to start it over.");
    var wid = newId("w"), at = now(), out = [];
    var push = function (tbl, obj) { var js = JSON.stringify(obj); for (var i = 0, part = 0; i < js.length; i += 45000, part++) out.push([wid, p.id, at, me.email, tbl, String(part), js.slice(i, i + 45000)]); };
    WIPE_TABLES.forEach(function (t) { rows(t).filter(function (r) { return r.project_id === p.id; }).forEach(function (r) { push(t, r); }); });
    push("Projects", findBy("Projects", "id", p.id));
    var outsiders = rows("People").filter(function (x) { return !isStaff(x) && splitIds(x.project_ids).indexOf(p.id) > -1; });
    outsiders.forEach(function (x) { push("People", x); });
    if (out.length) { var sh = tableSheet("Wipes"); sh.getRange(sh.getLastRow() + 1, 1, out.length, 7).setNumberFormat("@").setValues(out.map(function (r) { return r.map(safe); })); }
    WIPE_TABLES.forEach(function (t) { removeAll(t, function (r) { return r.project_id === p.id; }); });
    outsiders.forEach(function (x) { var ids = splitIds(x.project_ids).filter(function (i) { return i !== p.id; }); if (!ids.length && x.role !== "crew") purgePerson(x); else update("People", "email", x.email, { project_ids: ids.join(",") }); });
    update("Projects", "id", p.id, { progress: "0", phase: CONFIG.PHASES[0], cover_file_id: "" });
    return { wipe: wid };
  },
  restoreWipe: function (me, b) {
    if (me.role !== "admin") throw new Error("Only Jesús can restore a project.");
    var p = needProject(me, b.projectId), w = lastWipe(p.id); if (!w) throw new Error("There's nothing to restore.");
    var parts = rows("Wipes").filter(function (r) { return r.wipe_id === w.id; });
    // Rebuild each saved row from its parts (they were written in order).
    var objs = [], cur = null;
    parts.forEach(function (r) { if (r.part === "0") { if (cur) objs.push(cur); cur = { tbl: r.tbl, js: "" }; } cur.js += String(r.data).replace(/^'/, ""); }); if (cur) objs.push(cur);
    var add = {};
    objs.forEach(function (o) { var row = JSON.parse(o.js);
      if (o.tbl === "Projects") { var pr = {}; ["progress", "phase", "cover_file_id", "summary"].forEach(function (k) { pr[k] = row[k] || ""; }); update("Projects", "id", p.id, pr); return; }
      if (o.tbl === "People") {
        var ex = findPerson(row.email);
        if (ex) { var ids = splitIds(ex.project_ids); if (ids.indexOf(p.id) < 0) ids.push(p.id); update("People", "email", ex.email, { project_ids: ids.join(","), active: "yes" }); }
        else { row.project_ids = p.id; row.active = "yes"; (add.People = add.People || []).push(row); }
        return;
      }
      (add[o.tbl] = add[o.tbl] || []).push(row);
    });
    Object.keys(add).forEach(function (t) {
      var have = {}; rows(t).forEach(function (r) { if (r.id) have[r.id] = 1; });
      var list = add[t].filter(function (r) { return !r.id || !have[r.id]; }); if (!list.length) return;
      var sh = tableSheet(t), h = TABLES[t];
      sh.getRange(sh.getLastRow() + 1, 1, list.length, h.length).setNumberFormat("@").setValues(list.map(function (r) { return h.map(function (k) { return safe(r[k] == null ? "" : String(r[k])); }); }));
      delete _ROWS[t];
    });
    removeAll("Wipes", function (r) { return r.wipe_id === w.id; });
    return {};
  }
};
/* ============================ QuickBooks Online ============================
   Jesús creates an app at developer.intuit.com, pastes its Client ID and Secret into the portal (stored in Script Properties,
   never shown again), and clicks Connect. The portal can then list a customer's QuickBooks invoices and bring them in,
   PDF included, so the client sees the real QuickBooks invoice. */
var QB = { AUTH: "https://appcenter.intuit.com/connect/oauth2", TOKEN: "https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer",
  API: { production: "https://quickbooks.api.intuit.com", sandbox: "https://sandbox-quickbooks.api.intuit.com" }, SCOPE: "com.intuit.quickbooks.accounting", MINOR: "75" };
function qbProps() { return PropertiesService.getScriptProperties(); }
/* Intuit's discovery document lists the current OAuth endpoints; read it once a day instead of hardcoding them. */
function qbDiscovery() {
  var env = qbCfg().env, c = CacheService.getScriptCache(), k = "qbdisc:" + env, hit = c.get(k);
  if (hit) return JSON.parse(hit);
  var d = { authorization_endpoint: QB.AUTH, token_endpoint: QB.TOKEN, revocation_endpoint: "https://developer.api.intuit.com/v2/oauth2/tokens/revoke" };
  try {
    var r = UrlFetchApp.fetch("https://developer.api.intuit.com/.well-known/" + (env === "sandbox" ? "openid_sandbox_configuration" : "openid_configuration"), { muteHttpExceptions: true, headers: { Accept: "application/json" } });
    if (r.getResponseCode() === 200) { var j = JSON.parse(r.getContentText()); ["authorization_endpoint", "token_endpoint", "revocation_endpoint"].forEach(function (f) { if (/^https:\/\//.test(j[f] || "")) d[f] = j[f]; }); c.put(k, JSON.stringify(d), 86400); }
  } catch (e) {}
  return d;
}
/* QuickBooks said the connection is no longer valid (refresh token expired or revoked): forget it, and the portal asks Jesús to connect again. */
function qbDropConnection(why) {
  var pr = qbProps(); ["QB_REFRESH", "QB_REALM", "QB_COMPANY"].forEach(function (k) { pr.deleteProperty(k); });
  pr.setProperty("QB_RECONNECT", why || "QuickBooks ended the connection. Connect it again.");
  CacheService.getScriptCache().remove("qb:access");
}
function qbCfg() { var pr = qbProps(); return { id: pr.getProperty("QB_CLIENT_ID") || "", secret: pr.getProperty("QB_CLIENT_SECRET") || "", redirect: CONFIG.PORTAL_URL,
  env: pr.getProperty("QB_ENV") || "production", realm: pr.getProperty("QB_REALM") || "", refresh: pr.getProperty("QB_REFRESH") || "", company: pr.getProperty("QB_COMPANY") || "" }; }
function qbFinishConnect(code, state, realm) {
  var c = CacheService.getScriptCache(); if (!state || c.get("qbstate:" + state) !== "1") throw new Error("This link expired. Click Connect QuickBooks again.");
  c.remove("qbstate:" + state);
  var cfg = qbCfg(), res = qbTokenCall({ grant_type: "authorization_code", code: code, redirect_uri: cfg.redirect });
  qbProps().setProperties({ QB_REALM: String(realm), QB_REFRESH: res.refresh_token }); qbProps().deleteProperty("QB_RECONNECT");
  c.put("qb:access", res.access_token, Math.max(60, (res.expires_in || 3600) - 120));
  try { var info = qbGet("/companyinfo/" + realm); qbProps().setProperty("QB_COMPANY", info.CompanyInfo.CompanyName || ""); } catch (e) {}
}
function qbTokenCall(form) {
  var cfg = qbCfg(); if (!cfg.id || !cfg.secret) throw new Error("Add the QuickBooks app keys first.");
  var r = UrlFetchApp.fetch(qbDiscovery().token_endpoint, { method: "post", muteHttpExceptions: true, payload: form, headers: { Accept: "application/json", Authorization: "Basic " + Utilities.base64Encode(cfg.id + ":" + cfg.secret) } });
  var j = {}; try { j = JSON.parse(r.getContentText()); } catch (e) {}
  if (r.getResponseCode() !== 200 || !j.access_token) {
    var tid = qbTid(r); console.error("QuickBooks token error " + r.getResponseCode() + " " + (j.error || "") + " intuit_tid=" + tid);
    if (form.grant_type === "refresh_token" && (j.error === "invalid_grant" || r.getResponseCode() === 400 || r.getResponseCode() === 401)) {
      qbDropConnection("QuickBooks ended the connection (it expires after 100 days without use, or was disconnected in QuickBooks). Connect it again.");
      throw new Error("QuickBooks needs to be connected again. Jesús can do it from Home → Team.");
    }
    throw new Error("QuickBooks said: " + (j.error_description || j.error || r.getResponseCode()) + (tid ? " (ref " + tid + ")" : ""));
  }
  return j;
}
function qbAccess() {
  var c = CacheService.getScriptCache(), t = c.get("qb:access"); if (t) return t;
  var cfg = qbCfg(); if (!cfg.refresh) throw new Error("QuickBooks isn't connected yet.");
  var j = qbTokenCall({ grant_type: "refresh_token", refresh_token: cfg.refresh });
  if (j.refresh_token && j.refresh_token !== cfg.refresh) qbProps().setProperty("QB_REFRESH", j.refresh_token);       // Intuit rotates it
  c.put("qb:access", j.access_token, Math.max(60, (j.expires_in || 3600) - 120)); return j.access_token;
}
function qbFetch(path, accept) {
  var cfg = qbCfg(), url = QB.API[cfg.env] + "/v3/company/" + cfg.realm + path + (path.indexOf("?") > -1 ? "&" : "?") + "minorversion=" + QB.MINOR;
  var r = UrlFetchApp.fetch(url, { muteHttpExceptions: true, headers: { Authorization: "Bearer " + qbAccess(), Accept: accept || "application/json" } });
  if (r.getResponseCode() === 401) { CacheService.getScriptCache().remove("qb:access"); r = UrlFetchApp.fetch(url, { muteHttpExceptions: true, headers: { Authorization: "Bearer " + qbAccess(), Accept: accept || "application/json" } }); }
  if (r.getResponseCode() !== 200) {
    var tid = qbTid(r), body = String(r.getContentText()).slice(0, 300);
    console.error("QuickBooks API error " + r.getResponseCode() + " " + path.split("?")[0] + " intuit_tid=" + tid + " " + body);   // Apps Script logs, for Intuit support
    throw new Error("QuickBooks error " + r.getResponseCode() + (tid ? " (ref " + tid + ")" : "") + ": " + body.slice(0, 160));
  }
  return r;
}
function qbTid(r) { try { var h = r.getAllHeaders() || {}; return h.intuit_tid || h["Intuit_tid"] || h["intuit-tid"] || ""; } catch (e) { return ""; } }
function qbGet(path) { return JSON.parse(qbFetch(path).getContentText()); }
function qbQuery(sql) { return qbGet("/query?query=" + encodeURIComponent(sql)).QueryResponse || {}; }
function qbInvoiceOut(i, imported) {
  return { id: String(i.Id), number: i.DocNumber || "", date: i.TxnDate || "", due: i.DueDate || "", total: num(i.TotalAmt), balance: num(i.Balance), customer: (i.CustomerRef || {}).name || "", imported: imported[String(i.Id)] || "" };
}
ACTIONS.qbStatus = function (me) {
  needStaff(me); var cfg = qbCfg();
  return { hasKeys: !!(cfg.id && cfg.secret), connected: !!cfg.refresh, company: cfg.company, env: cfg.env, redirect: cfg.redirect, admin: me.role === "admin", reconnect: cfg.refresh ? "" : (qbProps().getProperty("QB_RECONNECT") || "") };
};
ACTIONS.qbSaveKeys = function (me, b) {
  if (me.role !== "admin") throw new Error("Only Jesús can connect QuickBooks.");
  var id = clean(b.clientId, 200), secret = clean(b.clientSecret, 200);
  var set = { QB_ENV: b.env === "sandbox" ? "sandbox" : "production" };
  if (id) set.QB_CLIENT_ID = id; if (secret) set.QB_CLIENT_SECRET = secret;
  var old = qbCfg(), changed = (id && id !== old.id) || set.QB_ENV !== old.env;
  qbProps().setProperties(set);
  if (changed && old.refresh) { ["QB_REFRESH", "QB_REALM", "QB_COMPANY", "QB_RECONNECT"].forEach(function (k) { qbProps().deleteProperty(k); }); CacheService.getScriptCache().remove("qb:access"); }
  return ACTIONS.qbStatus(me);
};
ACTIONS.qbConnectUrl = function (me) {
  if (me.role !== "admin") throw new Error("Only Jesús can connect QuickBooks.");
  var cfg = qbCfg(); if (!cfg.id || !cfg.secret) throw new Error("Add the QuickBooks app keys first.");
  var state = newId("q") + newId("s"); CacheService.getScriptCache().put("qbstate:" + state, "1", 900);
  return { url: qbDiscovery().authorization_endpoint + "?client_id=" + encodeURIComponent(cfg.id) + "&response_type=code&scope=" + encodeURIComponent(QB.SCOPE) + "&redirect_uri=" + encodeURIComponent(cfg.redirect) + "&state=" + state };
};
/* Intuit sent Jesús back to the portal with ?code=&state=&realmId=; the portal hands them here to finish connecting. */
ACTIONS.qbFinish = function (me, b) {
  if (me.role !== "admin") throw new Error("Only Jesús can connect QuickBooks.");
  if (!/^[\w.~-]{1,500}$/.test(String(b.code || "")) || !/^\d{1,20}$/.test(String(b.realmId || ""))) throw new Error("That QuickBooks link looks wrong. Click Connect QuickBooks again.");
  qbFinishConnect(String(b.code), String(b.state || ""), String(b.realmId));
  return ACTIONS.qbStatus(me);
};
ACTIONS.qbDisconnect = function (me) {
  if (me.role !== "admin") throw new Error("Only Jesús can disconnect QuickBooks.");
  var cfg = qbCfg(), pr = qbProps();
  if (cfg.refresh) try { UrlFetchApp.fetch(qbDiscovery().revocation_endpoint, { method: "post", muteHttpExceptions: true, contentType: "application/json", payload: JSON.stringify({ token: cfg.refresh }), headers: { Accept: "application/json", Authorization: "Basic " + Utilities.base64Encode(cfg.id + ":" + cfg.secret) } }); } catch (e) {}
  ["QB_REFRESH", "QB_REALM", "QB_COMPANY", "QB_RECONNECT"].forEach(function (k) { pr.deleteProperty(k); }); CacheService.getScriptCache().remove("qb:access"); return {};
};
ACTIONS.qbCustomers = function (me) {
  needStaff(me);
  return { customers: (qbQuery("select Id, DisplayName from Customer where Active = true maxresults 1000").Customer || []).map(function (c) { return { id: String(c.Id), name: c.DisplayName }; }) };
};
ACTIONS.qbLink = function (me, b) {
  needStaff(me); var p = needProject(me, b.projectId); update("Projects", "id", p.id, { qb_customer: /^\d{1,12}$/.test(String(b.customerId || "")) ? String(b.customerId) : "" }); return {};
};
ACTIONS.qbInvoices = function (me, b) {
  needStaff(me); var p = needProject(me, b.projectId); if (!p.qb_customer) return { linked: false, invoices: [] };
  var imported = {}; rows("Invoices").forEach(function (i) { if (i.qb_id && i.project_id === p.id) imported[i.qb_id] = i.id; });
  var list = (qbQuery("select * from Invoice where CustomerRef = '" + p.qb_customer + "' maxresults 1000").Invoice || []).sort(function (x, y) { return String(x.TxnDate) < String(y.TxnDate) ? 1 : -1; }).slice(0, 100);
  return { linked: true, invoices: list.map(function (i) { return qbInvoiceOut(i, imported); }) };
};
/* Bring one QuickBooks invoice into the portal: its number, dates, total and status, plus the real PDF from QuickBooks. */
ACTIONS.qbImport = function (me, b) {
  needStaff(me); var p = needProject(me, b.projectId); if (!p.qb_customer) throw new Error("Link this project to a QuickBooks customer first.");
  var qid = String(b.qbId || ""); if (!/^\d{1,12}$/.test(qid)) throw new Error("Pick an invoice.");
  var inv = qbGet("/invoice/" + qid).Invoice; if (!inv || String((inv.CustomerRef || {}).value) !== String(p.qb_customer)) throw new Error("That invoice isn't for this project's customer.");
  var pdf = qbFetch("/invoice/" + qid + "/pdf", "application/pdf").getBlob().setName("Invoice " + (inv.DocNumber || qid) + ".pdf");
  var file = projectFolder(p).createFile(pdf); try { file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW); } catch (e) {}
  var paid = num(inv.Balance) === 0 && num(inv.TotalAmt) > 0, existing = rows("Invoices").filter(function (i) { return i.project_id === p.id && i.qb_id === qid; })[0];
  var f = { id: existing ? existing.id : undefined, number: inv.DocNumber || ("QB-" + qid), title: (inv.CustomerMemo && inv.CustomerMemo.value) || "QuickBooks invoice", amount: num(inv.TotalAmt), issued: inv.TxnDate || "", due: inv.DueDate || "",
    status: paid ? "paid" : "sent", paid_date: paid ? today() : "", pay_url: inv.InvoiceLink && /^https:\/\//.test(inv.InvoiceLink) ? inv.InvoiceLink : "",
    // Partly paid in QuickBooks: say so, so nobody chases the full amount.
    notes: !paid && num(inv.Balance) < num(inv.TotalAmt) ? "Partly paid in QuickBooks: $" + money(num(inv.TotalAmt) - num(inv.Balance)) + " received, $" + money(inv.Balance) + " still open." : "" };
  var r = ACTIONS.saveInvoice(me, { projectId: p.id, invoice: f, notify: !!b.notify });
  var old = existing && existing.pdf_file_id;
  update("Invoices", "id", r.id, { qb_id: qid, pdf_file_id: file.getId() });
  if (old && old !== file.getId()) try { DriveApp.getFileById(old).setTrashed(true); } catch (e) {}
  return { id: r.id };
};

/* ---- #money: one job's real numbers from QuickBooks (only the admin and team members Jesús tags #money) ----
   Money in = this customer's QuickBooks invoices. Money out = the job's Profit & Loss (bills, checks, card charges and payroll
   tagged to this customer), sorted into labor, materials, subs and other by account name. Open bills = what we still owe. */
function qbBucket(name) {
  var s = String(name || "").toLowerCase();
  if (/subcontract|sub-contract|\bsubs?\b|contract labou?r|contractors?\b/.test(s)) return "subs";
  if (/payroll|wage|salar|labou?r|worker'?s'? comp|employee|benefit|401k|officer/.test(s)) return "labor";
  if (/material|supplies|supply|lumber|hardware|cost of goods|cogs|concrete|fixture|appliance|tile|paint|plumbing|electrical/.test(s)) return "materials";
  return "other";
}
function qbLinesFor(txn, cust) {
  return (txn.Line || []).filter(function (l) { var d = l.AccountBasedExpenseLineDetail || l.ItemBasedExpenseLineDetail || {}; return d.CustomerRef && String(d.CustomerRef.value) === String(cust); });
}
function qbLineAccount(l) { var d = l.AccountBasedExpenseLineDetail || l.ItemBasedExpenseLineDetail || {}; return ((d.AccountRef || d.ItemRef || {}).name) || ""; }
function qbJobMoney(cust) {
  var t = today(), warn = [], tryIt = function (label, fn, dflt) { try { return fn(); } catch (e) { warn.push(label); return dflt; } };
  var r2 = function (n) { return Math.round(n * 100) / 100; };
  // Money in
  var invs = tryIt("invoices", function () { return qbQuery("select * from Invoice where CustomerRef = '" + cust + "' maxresults 1000").Invoice || []; }, []);
  var inn = { billed: 0, collected: 0, open: 0, overdue: 0, count: invs.length };
  invs.forEach(function (i) { var tot = num(i.TotalAmt), bal = num(i.Balance); inn.billed += tot; inn.open += bal; if (bal > 0 && i.DueDate && i.DueDate < t) inn.overdue += bal; });
  inn.collected = inn.billed - inn.open;
  // Money out: the job's Profit & Loss, every account with an amount
  var out = { total: 0, labor: 0, materials: 0, subs: 0, other: 0 }, accounts = [], income = 0;
  tryIt("profit & loss", function () {
    var rep = qbGet("/reports/ProfitAndLoss?customer=" + cust + "&start_date=2010-01-01&end_date=" + t + "&accounting_method=Accrual");
    // Sub-accounts carry their parent's name ("Payroll Expenses: Taxes"), so they sort with it.
    var walk = function (list, group, parent) {
      (list || []).forEach(function (r) {
        var g = r.group || group, hd = r.Header && r.Header.ColData, own = hd ? (hd[0] || {}).value || "" : "", path = function (n) { return parent ? parent + ": " + n : n; };
        if (r.ColData) { var cd = r.ColData; accounts.push({ group: g, name: path((cd[0] || {}).value || ""), amount: num((cd[cd.length - 1] || {}).value) }); }
        if (hd && hd.length > 1 && num(hd[hd.length - 1].value)) accounts.push({ group: g, name: path(own), amount: num(hd[hd.length - 1].value) });
        if (r.Rows && r.Rows.Row) walk(r.Rows.Row, g, r.group ? "" : path(own));
      });
    };
    walk(((rep || {}).Rows || {}).Row, "", "");
  });
  accounts = accounts.filter(function (a) { return a.amount; });
  accounts.forEach(function (a) {
    if (a.group === "Income" || a.group === "OtherIncome") { income += a.amount; return; }
    if (["COGS", "Expenses", "OtherExpenses"].indexOf(a.group) < 0) return;
    a.bucket = qbBucket(a.name); out[a.bucket] += a.amount; out.total += a.amount;
  });
  // What we owe: open bills with lines on this job (only this job's share)
  var bills = [], owe = { open: 0, overdue: 0 };
  tryIt("bills", function () {
    (qbQuery("select * from Bill where Balance > '0' maxresults 1000").Bill || []).forEach(function (b) {
      var job = qbLinesFor(b, cust).reduce(function (a, l) { return a + num(l.Amount); }, 0); if (!job) return;
      var share = num(b.TotalAmt) ? job / num(b.TotalAmt) : 1, due = r2(num(b.Balance) * share), late = !!(b.DueDate && b.DueDate < t);
      owe.open += due; if (late) owe.overdue += due;
      bills.push({ vendor: (b.VendorRef || {}).name || "Vendor", number: b.DocNumber || "", due: b.DueDate || "", amount: due, late: late, what: qbLineAccount(qbLinesFor(b, cust)[0] || {}) });
    });
  });
  bills.sort(function (a, b) { return (a.due || "9") < (b.due || "9") ? -1 : 1; });
  // Latest spending on this job (last 6 months of checks, card charges and bills)
  var since = Utilities.formatDate(new Date(Date.now() - 183 * 864e5), CONFIG.TZ, "yyyy-MM-dd"), recent = [];
  [["Purchase", "EntityRef"], ["Bill", "VendorRef"]].forEach(function (k) {
    tryIt("recent " + k[0].toLowerCase() + "s", function () {
      (qbQuery("select * from " + k[0] + " where TxnDate >= '" + since + "' maxresults 1000")[k[0]] || []).forEach(function (x) {
        qbLinesFor(x, cust).forEach(function (l) { var acc = qbLineAccount(l); recent.push({ date: x.TxnDate || "", who: (x[k[1]] || {}).name || "", what: l.Description || acc, account: acc, amount: r2(num(l.Amount)), bucket: qbBucket(acc) }); });
      });
    });
  });
  recent.sort(function (a, b) { return a.date < b.date ? 1 : -1; });
  // Crew hours logged to this job (QuickBooks Time / timesheets)
  var hrs = {}, hours = 0;
  tryIt("timesheets", function () {
    (qbQuery("select * from TimeActivity where CustomerRef = '" + cust + "' maxresults 1000").TimeActivity || []).forEach(function (a) {
      var h = num(a.Hours) + num(a.Minutes) / 60, n = ((a.EmployeeRef || a.VendorRef || {}).name) || "Someone"; hours += h; hrs[n] = (hrs[n] || 0) + h;
    });
  });
  var name = tryIt("customer", function () { return (qbGet("/customer/" + cust).Customer || {}).DisplayName || ""; }, "");
  Object.keys(out).forEach(function (k) { out[k] = r2(out[k]); }); Object.keys(inn).forEach(function (k) { inn[k] = r2(inn[k]); });
  return { customer: name, company: qbCfg().company, updated: now(), inn: inn, out: out, income: r2(income),
    accounts: accounts.filter(function (a) { return a.bucket; }).sort(function (a, b) { return b.amount - a.amount; }).slice(0, 12).map(function (a) { return { name: a.name, amount: r2(a.amount), bucket: a.bucket }; }),
    owe: { open: r2(owe.open), overdue: r2(owe.overdue) }, bills: bills.slice(0, 25), recent: recent.slice(0, 15),
    hours: { total: Math.round(hours * 10) / 10, people: Object.keys(hrs).map(function (n) { return { name: n, hours: Math.round(hrs[n] * 10) / 10 }; }).sort(function (a, b) { return b.hours - a.hours; }).slice(0, 8) },
    warnings: warn };
}
ACTIONS.qbMoney = function (me, b) {
  if (!canMoney(me)) throw new Error("That's #money. Ask Jesús to tag you #money.");
  var p = needProject(me, b.projectId), mo = moneyOf(p, rows("Invoices").filter(function (i) { return i.project_id === p.id; }), rows("ContractLines").filter(function (l) { return l.project_id === p.id; }));
  var base = { contract: mo.total, connected: !!qbCfg().refresh, linked: !!p.qb_customer };
  if (!base.connected || !base.linked) return base;
  var c = CacheService.getScriptCache(), ck = "qbm:" + qbCfg().realm + ":" + p.id + ":" + p.qb_customer, hit = !b.refresh && c.get(ck);
  if (hit) return Object.assign(JSON.parse(hit), base, { cached: true });
  var data = qbJobMoney(p.qb_customer);
  try { c.put(ck, JSON.stringify(data), 900); } catch (e) {}
  return Object.assign(data, base);
};

var WIPE_TABLES = ["Messages", "Timeline", "Photos", "Invoices", "Checklist", "Schedule", "ContractLines", "Plans", "Reads"];
function lastWipe(pid) {
  var l = rows("Wipes").filter(function (r) { return r.project_id === pid; }); if (!l.length) return null;
  var last = l[l.length - 1], n = l.filter(function (r) { return r.wipe_id === last.wipe_id && r.part === "0"; }).length;
  return { id: last.wipe_id, at: last.at, items: n };
}
function canCheck(me, it) {
  if (isStaff(me)) return true;
  if (it.assignee) return isAssigned(it, me.email);
  var l = audList(it.aud);
  if (!l.length) return it.owner === "client" && me.role === "client";
  return l.indexOf(myAud(me)) > -1;
}
function isAssigned(c, email) { return !!email && splitIds(c.assignee).indexOf(email) > -1; }
function peopleIndex() { var o = {}; rows("People").forEach(function (x) { o[x.email] = x; }); return o; }
function footOf(email, at, ppl) { if (!email) return null; var x = ppl[email] || {}; return { name: x.name || "Someone", key: keyOf(email), avatar: x.avatar || "", role: x.role || "", at: at || "" }; }
function checkOut(c, me, ppl) {
  var r = parseJson(c.reactions, {}), names = function (l) { return l.map(function (e) { return (ppl[e] || {}).name || "Someone"; }); };
  return { id: c.id, phase: c.phase, item: c.item, owner: c.owner, due: c.due, done: c.done, done_by: c.done_by, done_at: c.done_at, sort: c.sort, aud: audView(me, c.aud), pinned: isTrue(c.pinned),
    assignees: splitIds(c.assignee).map(function (e) { return footOf(e, "", ppl); }), mine: isAssigned(c, me.email), can: canCheck(me, c),
    doneFoot: isTrue(c.done) ? footOf(c.done_email || "", c.done_at, ppl) || { name: c.done_by, at: c.done_at } : null,
    edited: footOf(c.edited_by || c.created_by, c.edited_at, ppl),
    reactions: Object.keys(r).map(function (e) { return { e: e, n: r[e].length, mine: r[e].indexOf(me.email) > -1, who: names(r[e]) }; }) };
}
function schedOut(x, team, ppl) {
  var o = { id: x.id, kind: x.kind, title: x.title, start: x.start, end: x.end, phase: x.phase, owner: x.owner, status: x.status, sort: x.sort,
    edited: footOf(x.edited_by, x.edited_at, ppl), req: x.req_by ? Object.assign(footOf(x.req_by, x.req_at, ppl), { note: x.req_note }) : null };
  if (team) o.notes = x.notes;
  return o;
}
/* Pinned things across my projects, for the home dashboard: messages I can read, updates and checklist items tagged for me. */
function pinsFor(me, names, msgs, tl, ck) {
  var out = [], ppl = peopleIndex();
  msgs.forEach(function (m) { if (isTrue(m.pinned) && names[m.project_id] && seesMsg(me, m)) out.push({ kind: "msg", id: m.id, pid: m.project_id, project: names[m.project_id], at: m.at, text: String(m.text).slice(0, 220), author: m.author, akey: keyOf(m.author_email), avatar: (ppl[m.author_email] || {}).avatar || "", channel: chOf(m), dm: isDm(chOf(m)) }); });
  tl.forEach(function (u) { if (isTrue(u.pinned) && names[u.project_id] && audOk(me, u.aud)) out.push({ kind: "update", id: u.id, pid: u.project_id, project: names[u.project_id], at: u.at, text: String(u.text).slice(0, 220), author: u.author, akey: keyOf(u.author_email), avatar: (ppl[u.author_email] || {}).avatar || "", aud: audView(me, u.aud) }); });
  ck.forEach(function (c) { if (isTrue(c.pinned) && names[c.project_id] && (audOk(me, c.aud) || isAssigned(c, me.email))) out.push({ kind: "check", id: c.id, pid: c.project_id, project: names[c.project_id], at: c.edited_at || "", text: c.item, done: isTrue(c.done), aud: audView(me, c.aud), author: (ppl[c.created_by] || {}).name || "", akey: keyOf(c.created_by), avatar: (ppl[c.created_by] || {}).avatar || "" }); });
  return out.sort(function (a, b) { return a.at < b.at ? 1 : -1; }).slice(0, 24);
}
/* Remove many rows at once (rewrites the tab once instead of deleting row by row). */
function removeAll(t, test) {
  var sh = tableSheet(t), all = rows(t), keep = all.filter(function (r) { return !test(r); }), h = TABLES[t]; delete _ROWS[t];
  if (keep.length === all.length) return;
  if (all.length) sh.getRange(2, 1, all.length, h.length).clearContent();
  if (keep.length) sh.getRange(2, 1, keep.length, h.length).setNumberFormat("@").setValues(keep.map(function (r) { return h.map(function (k) { return safe(r[k] == null ? "" : String(r[k])); }); }));
}
/* ============================ email replies ============================ */

/** Runs every 10 minutes. Imports a client's email reply only when Gmail verified the sender and the thread began with our email. */
function checkEmailReplies() {
  // Look first without holding anything: most runs find nothing new and never block people saving in the portal.
  var seen = {}; rows("EmailImports").forEach(function (r) { seen[r.gmail_id] = 1; });
  var threads = GmailApp.search('subject:"' + CONFIG.TAG + '" newer_than:14d -in:spam -in:trash', 0, 50);
  if (!threads.some(function (th) { return th.getMessages().slice(1).some(function (m) { return !seen[m.getId()]; }); })) return;
  var lock = LockService.getScriptLock(); if (!lock.tryLock(10000)) return;
  OUTBOX = [];
  try {
    _ROWS = {};
    var done = {}; rows("EmailImports").forEach(function (r) { done[r.gmail_id] = 1; });
    var me = normEmail(Session.getEffectiveUser().getEmail()), ours = [me, normEmail(CONFIG.FROM_EMAIL), normEmail(CONFIG.NOTIFY_EMAIL)];
    threads.forEach(function (th) {
      var msgs = th.getMessages(), firstMsg = msgs[0];
      var m = String(firstMsg.getSubject()).match(new RegExp("\\[" + CONFIG.TAG + "-([a-z0-9]+)-([a-z0-9]+)\\]"));
      if (!m || ours.indexOf(senderOf(firstMsg.getFrom())) < 0) return;    // the thread must start with the portal's own email
      var p = findBy("Projects", "id", m[1]), q = findBy("Messages", "id", m[2]);
      if (!p || !q || q.project_id !== p.id || p.status === "archived") return;
      msgs.slice(1).forEach(function (msg) {
        var gid = msg.getId(); if (done[gid]) return;
        var mark = function (result, mid) { insert("EmailImports", { gmail_id: gid, project_id: p.id, message_id: mid || "", at: now(), result: result }); done[gid] = 1; };
        var from = senderOf(msg.getFrom());
        if (!from) return mark("unreadable sender");
        if (ours.indexOf(from) > -1) return mark("ours");
        if (isAutoReply(msg)) return mark("auto-reply");
        if (!verifiedSender(msg, from)) return mark("not verified");
        var person = findPerson(from);
        if (!person || !isTrue(person.active) || !isOutside(person) || splitIds(person.project_ids).indexOf(p.id) < 0) return mark("not a client on this project");
        var text = replyText(msg.getPlainBody()); if (!text) return mark("empty");
        var at = Utilities.formatDate(msg.getDate(), CONFIG.TZ, "yyyy-MM-dd HH:mm");
        // Record the import first, so a failed notice can't make the same reply import again.
        var mid = newId("m"); mark("imported", mid);
        if (q.kind === "question" && q.status === "open") addAnswer(p, q, person.name, from, person.role, text, "email", at, mid);
        else {
          if (!canRead(person, chOf(q))) return mark("not allowed in that channel");   // e.g. a client replying to an architect-only email: never leak it into their channel
          addMessage(p, person, text, "email", at, mid, chOf(q), q.thread_id || q.id);
        }
      });
    });
  } finally { SpreadsheetApp.flush(); lock.releaseLock(); }
  flushMail(); bumpVersion("");
}

/* "Name <a@b.com>" or "a@b.com" only; anything with extra angle brackets or an @ in the display name is rejected. */
function senderOf(raw) {
  var f = String(raw || "").trim(), mm = f.match(/^(?:"?[^"<>@]*"?\s*)?<([^<>\s@]+@[^<>\s@]+)>$/) || f.match(/^([^<>\s@"]+@[^<>\s@"]+)$/);
  return mm ? normEmail(mm[1]) : "";
}
/* Gmail's own Authentication-Results must show DMARC pass, or DKIM pass signed by the sender's domain. */
function verifiedSender(msg, from) {
  var domain = from.split("@")[1], ar = "";
  try { ar = String(msg.getHeader("Authentication-Results") || ""); } catch (e) {}
  if (!/mx\.google\.com/i.test(ar)) return false;
  var dmarc = new RegExp("dmarc=pass[^;]*header\\.from=" + domain.replace(/\./g, "\\."), "i").test(ar);
  var dkim = new RegExp("dkim=pass[^;]*header\\.(?:i=@|d=)" + domain.replace(/\./g, "\\."), "i").test(ar);
  return dmarc || dkim;
}
function isAutoReply(msg) {
  var h = function (n) { try { return String(msg.getHeader(n) || "").toLowerCase(); } catch (e) { return ""; } };
  var auto = h("Auto-Submitted"), prec = h("Precedence");
  return (auto && auto !== "no") || !!h("X-Autoreply") || !!h("X-Autorespond") || /auto_reply|bulk|junk/.test(prec) ||
    /^(auto(matic)?[ -]?reply|out of (the )?office|autorespuesta|respuesta autom[aá]tica|fuera de la oficina)/i.test(String(msg.getSubject()));
}
function replyText(body) {
  var t = String(body || "").replace(/\r/g, "");
  var cut = t.search(/\n[ \t]*(On [\s\S]{0,300}?wrote:|El [\s\S]{0,300}?escribi[oó]:|-{2,}\s*(Original Message|Mensaje original)|_{8,}|From:\s|De:\s|Sent from my |Enviado desde mi )/i);
  if (cut > -1) t = t.slice(0, cut);
  return t.split("\n").filter(function (l) { return !/^\s*>/.test(l); }).join("\n").replace(/\n{3,}/g, "\n\n").trim().slice(0, 5000);
}

function addAnswer(p, q, name, email, role, text, via, at, id) {
  id = id || newId("m");
  insert("Messages", { id: id, project_id: p.id, at: at || now(), author: name, author_email: email, role: role, kind: "answer", text: text, question_id: q.id, status: "", via: via, channel: "client", thread_id: "", files: "", reactions: "" });
  update("Messages", "id", q.id, { status: "answered" });
  if (role === "client" || role === "architect") notifyJesus(email, name + " answered: " + q.text.slice(0, 60), "<p><b>Question:</b> " + esc(q.text) + "</p><p><b>Answer:</b> " + nl2br(esc(text)) + "</p><p style='color:#666'>" + esc(p.name) + " · via " + via + "</p>" + button("Open the portal", deep(p.id, "messages", "client")));
  return id;
}
function addMessage(p, person, text, via, at, id, channel, threadId) {
  id = id || newId("m");
  insert("Messages", { id: id, project_id: p.id, at: at || now(), author: person.name, author_email: person.email, role: person.role, kind: "message", text: text, question_id: "", status: "", via: via,
    channel: channel || "client", thread_id: threadId || "", files: "", reactions: "" });
  notifyJesus(person.email, "New message from " + person.name + " · " + p.name, "<p>" + nl2br(esc(text)) + "</p>" + button("Open the portal", deep(p.id, "messages", channel || "client")));
  return id;
}

/* ============================ setup ============================ */

/** Run once from the editor. Creates the database sheet, the Drive folder, Jesús as admin and the 10-minute email check. */
function setup() {
  var book = ss();
  if (book.getSpreadsheetTimeZone() !== CONFIG.TZ) book.setSpreadsheetTimeZone(CONFIG.TZ);
  Object.keys(TABLES).forEach(function (t) { tableSheet(t); });
  var blank = book.getSheetByName("Sheet1"); if (blank && book.getSheets().length > 1 && blank.getLastRow() === 0) book.deleteSheet(blank);
  var folder = rootFolder();
  try { DriveApp.getFileById(book.getId()).moveTo(folder); } catch (e) {}
  if (!findPerson(CONFIG.NOTIFY_EMAIL)) insert("People", { email: normEmail(CONFIG.NOTIFY_EMAIL), name: "Jesús Toto", role: "admin", project_ids: "", active: "yes", created_at: now() });
  ScriptApp.getProjectTriggers().forEach(function (t) { if (t.getHandlerFunction() === "checkEmailReplies") ScriptApp.deleteTrigger(t); });
  ScriptApp.newTrigger("checkEmailReplies").timeBased().everyMinutes(10).create();
  Logger.log("Ready. Database: " + book.getUrl());
}
/** Add or update a project manager from the editor: addStaff("Name", "email@…") */
function addStaff(name, email) {
  var e = normEmail(email), p = findPerson(e);
  if (p) update("People", "email", e, { name: name || p.name, role: p.role === "admin" ? "admin" : "staff", active: "yes" });
  else insert("People", { email: e, name: name, role: "staff", project_ids: "", active: "yes", created_at: now() });
}

/* ============================ files ============================ */

function savePhotos(me, p, list, caption, updateId) {
  if (list.length > 12) throw new Error("Up to 12 photos at a time.");
  return list.map(function (ph) {
    var fid = saveFile(p, ph, ph.name || "photo.jpg", true), id = newId("f");
    insert("Photos", { id: id, project_id: p.id, file_id: fid, caption: clean(ph.caption || caption, 300), at: now(), author: me.name, update_id: updateId });
    if (!p.cover_file_id) { update("Projects", "id", p.id, { cover_file_id: fid }); p.cover_file_id = fid; }
    return id;
  });
}
function saveFile(p, f, name, image) {
  var mime = String(f.mime || "");
  if (image ? !/^image\/(jpeg|png|webp)$/.test(mime) : mime !== "application/pdf") throw new Error(image ? "Photos must be JPG, PNG or WebP." : "Invoices must be PDF.");
  var bytes = Utilities.base64Decode(String(f.data).replace(/^data:[^,]+,/, ""));
  if (bytes.length > 15 * 1024 * 1024) throw new Error("That file is too big (15 MB max).");
  var file = projectFolder(p).createFile(Utilities.newBlob(bytes, mime, String(name).slice(0, 120)));
  // Viewable by link so the portal can show it; the ID is long and unguessable and only appears inside the portal.
  try { file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW); }
  catch (e) { if (MAIL_NOTICES) MAIL_NOTICES.push("Saved, but Google Workspace blocked link sharing, so it may not show in the portal."); }
  return file.getId();
}
function projectFolder(p) {
  try { if (p.folder_id) { var f = DriveApp.getFolderById(p.folder_id); if (!f.isTrashed()) return f; } } catch (e) {}
  var nf = rootFolder().createFolder(p.name + " · " + p.id);              // the folder was deleted: make a new one
  update("Projects", "id", p.id, { folder_id: nf.getId() }); p.folder_id = nf.getId();
  return nf;
}
/* The root folder is created once and remembered by ID (never looked up by name, which anyone could copy). */
function rootFolder() {
  var props = PropertiesService.getScriptProperties(), id = props.getProperty("ROOT_FOLDER_ID");
  try { if (id) { var f = DriveApp.getFolderById(id); if (!f.isTrashed()) return f; } } catch (e) {}
  var nf = DriveApp.createFolder(CONFIG.ROOT_FOLDER); props.setProperty("ROOT_FOLDER_ID", nf.getId()); return nf;
}

/* ============================ shaping ============================ */

function summary(p, inv, msgs, tl, me, lines, reads) {
  var mine = function (list) { return list.filter(function (r) { return r.project_id === p.id; }); };
  var invs = mine(inv).filter(function (i) { return i.status !== "void" && i.status !== "draft"; });
  var last = mine(tl).slice(-1)[0];
  return Object.assign(projectOut(p), {
    balance: invs.filter(function (i) { return i.status !== "paid"; }).reduce(function (a, i) { return a + num(i.amount) - num(i.retainage); }, 0),
    openQuestions: mine(msgs).filter(function (m) { return m.kind === "question" && m.status === "open"; }).length,
    lastUpdate: last ? last.at : "",
    money: moneyOf(p, mine(inv), mine(lines || [])),
    unread: me ? unreadOf(me, mine(msgs), reads || {}) : 0
  });
}
function projectOut(p) {
  return { id: p.id, name: p.name, client_name: p.client_name, address: p.address, city: p.city, phase: p.phase, progress: Number(p.progress || 0),
    start_date: p.start_date, target_date: p.target_date, summary: p.summary, status: p.status, cover: p.cover_file_id ? img(p.cover_file_id, 1200) : "",
    retainage_pct: num(p.retainage_pct), lat: p.lat ? num(p.lat) : null, lon: p.lon ? num(p.lon) : null,
    billing_aud: audList(p.billing_aud), architect_name: p.architect_name || "", architect_logo: p.architect_logo ? img(p.architect_logo, 400) : "" };
}
function photoOut(ph) { return { id: ph.id, file_id: ph.file_id, thumb: img(ph.file_id, 600), full: img(ph.file_id, 2000), caption: ph.caption, at: ph.at, author: ph.author, update_id: ph.update_id }; }
function invoiceOut(i, staff, ppl) {
  var st = i.status; if (st === "sent" && i.due && i.due < today()) st = "overdue";
  var lines = {}; try { lines = i.lines ? JSON.parse(String(i.lines).replace(/^'/, "")) : {}; } catch (e) {}
  var o = { id: i.id, number: i.number, title: i.title, amount: num(i.amount), retainage: num(i.retainage), lines: lines, issued: i.issued, due: i.due, status: st, paid_date: i.paid_date,
    pdf: i.pdf_file_id ? "https://drive.google.com/file/d/" + i.pdf_file_id + "/view" : "", pay_url: i.pay_url };
  if (staff) {                                                           // internal notes and who made it stay with the team
    o.notes = i.notes; ppl = ppl || {};
    o.created_by = (ppl[i.created_by] || {}).name || ""; o.created_at = i.created_at || ""; o.cby_key = i.created_by ? keyOf(i.created_by) : ""; o.cby_avatar = (ppl[i.created_by] || {}).avatar || "";
    o.updated_by = (ppl[i.updated_by] || {}).name || ""; o.updated_at = i.updated_at || ""; o.qb_id = i.qb_id || "";
  }
  return o;
}
/* Clients and architects see the base contract and change orders that aren't rejected; team notes stay with the team. */
function contractOut(list, p, staff) {
  return { retainage_pct: num(p.retainage_pct), lines: list.filter(function (l) { return staff || l.status !== "rejected"; })
    .sort(function (a, c) { return a.kind !== c.kind ? (a.kind === "base" ? -1 : 1) : Number(a.sort || 0) - Number(c.sort || 0); })
    .map(function (l) { var o = { id: l.id, kind: l.kind, number: l.number, title: l.title, amount: num(l.amount), status: l.status, date: l.date }; if (staff) o.notes = l.notes; return o; }) };
}
function billedOn(pid, lineId) {
  return rows("Invoices").some(function (i) { if (i.project_id !== pid || i.status === "void" || !i.lines) return false; try { return !!JSON.parse(String(i.lines).replace(/^'/, ""))[lineId]; } catch (e) { return false; } });
}
/* ---- chat ---- */
function messagesOut(list, me) {
  var staff = isStaff(me), names = {}, av = {};
  rows("People").forEach(function (x) { names[x.email] = x.name; av[x.email] = x.avatar || ""; });
  return list.filter(function (m) { return seesMsg(me, m); }).map(function (m) {
    var r = parseJson(m.reactions, {});
    var o = { id: m.id, at: m.at, author: m.author, role: m.role, kind: m.kind, text: m.text, question_id: m.question_id, status: m.status, via: m.via,
      channel: chOf(m), thread_id: m.thread_id || "", ref: m.ref || "", mine: m.author_email === me.email, mention: mentions(m.text, me.name), avatar: av[m.author_email] || "", akey: keyOf(m.author_email), pinned: isTrue(m.pinned),
      files: parseJson(m.files, []).map(function (f) { return { id: f.id, name: f.name, mime: f.mime, thumb: /^image\//.test(f.mime) ? img(f.id, 600) : "", full: /^image\//.test(f.mime) ? img(f.id, 2000) : "", url: "https://drive.google.com/file/d/" + f.id + "/view" }; }),
      reactions: Object.keys(r).map(function (e) { return { e: e, n: r[e].length, mine: r[e].indexOf(me.email) > -1, who: r[e].map(function (x) { return names[x] || "Someone"; }) }; }) };
    if (staff) o.author_email = m.author_email;                                  // clients never receive other people's email addresses
    return o;
  });
}
/* Events: things that happened (an invoice was sent, a to-do was added) show up in #client as colored cards. They never email anyone. */
function postEvent(p, me, type, action, detail, ref, channel) {
  insert("Messages", { id: newId("m"), project_id: p.id, at: now(), author: me.name, author_email: me.email, role: me.role, kind: "event", text: (action + (detail ? "\n" + detail : "")).slice(0, 600),
    question_id: "", status: type, via: "portal", channel: channel || "client", thread_id: "", files: "", reactions: "", ref: ref || "" });
}
function coEvent(p, me, line, id, verb) {
  postEvent(p, me, "change", verb + " change order" + (line.number ? " " + line.number : ""), line.title + " · " + (num(line.amount) < 0 ? "−$" + money(-num(line.amount)) : "+$" + money(line.amount)), "co:" + id, billChannel(p));
}
function planVisible(d, me) { return isTeam(me) || (d.visible === "all") || (d.visible === "architect" && me.role === "architect"); }
function plansOut(list, me) {
  var cutoff = Utilities.formatDate(new Date(Date.now() - 864e5), CONFIG.TZ, "yyyy-MM-dd HH:mm");
  return list.filter(function (d) { return planVisible(d, me) && (d.status === "ready" || (isStaff(me) && d.at > cutoff)); }).map(function (d) {
    return { id: d.id, set: d.set, rev: d.rev, date: d.date, notes: d.notes, visible: d.visible, status: d.status, by: d.by, at: d.at,
      pdf: d.pdf_file_id ? "https://drive.google.com/file/d/" + d.pdf_file_id + "/view" : "",
      sheets: parseJson(d.sheets, []).map(function (x) { return Object.assign({}, x, { thumb: img(x.img, 600), full: img(x.img, 2400) }); }) };
  });
}
var _KEYS = {};
function keyOf(email) { return email ? (_KEYS[email] = _KEYS[email] || pkey(email)) : ""; }
function avatarsByEmail() { var o = {}; rows("People").forEach(function (x) { o[x.email] = x.avatar || ""; }); return o; }
/* Someone counts as "in the portal" only if their access is on and they're on the team or on a live project. */
function liveProjectIds() { var ids = {}; rows("Projects").forEach(function (p) { if (p.status !== "deleted") ids[p.id] = 1; }); return ids; }
function inPortal(x, live) { return isTrue(x.active) && (isTeam(x) || splitIds(x.project_ids).some(function (id) { return live[id]; })); }
function purgePerson(person) {
  var c = CacheService.getScriptCache();
  rows("Sessions").forEach(function (sn) { if (sn.email === person.email) c.remove("sess:" + sn.token_hash); });
  c.remove("pres:" + pkey(person.email));
  removeWhere("Sessions", function (r) { return r.email === person.email; });
  removeWhere("People", function (r) { return r.email === person.email; });
}
/* Leftovers from older versions: people whose access was turned off, or who have no project at all and aren't on the team. */
function purgeOrphans() {
  rows("People").filter(function (x) { return x.role !== "admin" && (!isTrue(x.active) || (!isTeam(x) && !splitIds(x.project_ids).length)); }).forEach(purgePerson);
}
function membersOf(p) { return rows("People").filter(function (x) { return isTrue(x.active) && (isStaff(x) || splitIds(x.project_ids).indexOf(p.id) > -1); }); }
function mentions(text, name) { return !!name && String(text || "").toLowerCase().indexOf("@" + String(name).toLowerCase()) > -1; }
/* "@Full Name" emails that person if they can see the channel (and didn't already get the message by email). */
function notifyMentions(p, me, text, channel, emailed) {
  if (String(text).indexOf("@") < 0) return;
  membersOf(p).forEach(function (x) {
    if (x.email === me.email || emailed[x.email] || !mentions(text, x.name) || channelsFor(x).indexOf(channel) < 0) return;
    try { if (MailApp.getRemainingDailyQuota() < CONFIG.MAIL_RESERVE) return; } catch (e) {}
    safeMail(function () { sendMail(x.email, me.name + " mentioned you · " + p.name + " #" + channel, "<p>Hi " + esc(first(x.name)) + ",</p><p><b>" + esc(me.name) + "</b> mentioned you in <b>#" + channel + "</b> on " + esc(p.name) + ":</p><blockquote style='border-left:3px solid #ddd;margin:0;padding-left:12px;color:#333'>" + nl2br(esc(text)) + "</blockquote>" + button("Open the portal", deep(p.id, "messages", channel))); }, "");
  });
}
function saveAttachments(p, list) {
  if (list.length > 5) throw new Error("Up to 5 files at a time.");
  return list.map(function (f) {
    var mime = String(f.mime || "");
    if (!/^image\/(jpeg|png|webp)$/.test(mime) && mime !== "application/pdf") throw new Error("Attach photos (JPG, PNG) or PDFs.");
    var name = clean(f.name, 120) || "file";
    return { id: saveFile(p, f, name, /^image\//.test(mime)), name: name, mime: mime };
  });
}
function readsAll(me) { var o = {}; rows("Reads").forEach(function (r) { if (r.email === me.email) o[r.project_id + "|" + r.channel] = r.at; }); return o; }
function readsFor(me, pid) { var all = readsAll(me), o = {}; Object.keys(all).forEach(function (k) { var i = k.indexOf("|"); if (k.slice(0, i) === pid) o[k.slice(i + 1)] = all[k]; }); return o; }
function markReadNow(me, pid, ch) {
  var list = rows("Reads");
  for (var i = 0; i < list.length; i++) if (list[i].email === me.email && list[i].project_id === pid && list[i].channel === ch) {
    tableSheet("Reads").getRange(i + 2, 4).setValue(now()); list[i].at = now(); return;
  }
  insert("Reads", { email: me.email, project_id: pid, channel: ch, at: now() });
}
function unreadOf(me, msgs, reads) {
  return msgs.filter(function (m) { var c = chOf(m); return seesMsg(me, m) && m.author_email !== me.email && m.at > (reads[m.project_id + "|" + c] || ""); }).length;
}
/* What a project needs from the client soon: open to-dos, dates in the next 14 days, invoices due. Feeds the notification bell. */
function needsOf(p, ck, sc, inv, me) {
  var t = today(), lim = Utilities.formatDate(new Date(Date.now() + 14 * 864e5), CONFIG.TZ, "yyyy-MM-dd");
  return {
    // Things assigned to me by name (any role): they show up in my alerts and my to-dos.
    mine: me ? ck.filter(function (c) { return c.project_id === p.id && isAssigned(c, me.email) && !isTrue(c.done); }).map(function (c) { return { id: c.id, item: c.item, due: c.due, aud: audView(me, c.aud), by: c.created_by }; }).slice(0, 12) : [],
    todos: ck.filter(function (c) { return c.project_id === p.id && c.owner === "client" && !isTrue(c.done); }).map(function (c) { return { id: c.id, item: c.item, due: c.due }; }).slice(0, 8),
    dates: sc.filter(function (x) { return x.project_id === p.id && x.kind !== "task" && x.status !== "done" && x.start >= t && x.start <= lim; })
      .sort(function (a, c) { return a.start < c.start ? -1 : 1; }).map(function (x) { return { id: x.id, kind: x.kind, title: x.title, start: x.start, owner: x.owner }; }).slice(0, 6),
    invoices: inv.filter(function (i) { return i.project_id === p.id && i.status === "sent"; }).map(function (i) { return { id: i.id, number: i.number, due: i.due, amount: cents(num(i.amount) - num(i.retainage)), overdue: !!(i.due && i.due < t) }; })
  };
}
/* ---- money: the same math as the Contract & billing tab ---- */
function moneyOf(p, inv, lines) {
  var total = 0; lines.forEach(function (l) { if (l.kind === "base" || l.status === "approved") total += num(l.amount); });
  var billed = 0, held = 0, paid = 0, waiting = 0, overdue = 0, t = today();
  inv.forEach(function (i) {
    if (i.status === "void" || i.status === "draft") return;
    var a = num(i.amount), r = num(i.retainage); billed += a; held += r;
    if (i.status === "paid") paid += a - r; else { waiting += a - r; if (i.due && i.due < t) overdue += a - r; }
  });
  return { total: cents(total), billed: cents(billed), held: cents(held), paid: cents(paid), waiting: cents(waiting), overdue: cents(overdue), left: cents(total - billed) };
}
function parseJson(v, dflt) { if (!v) return dflt; try { return JSON.parse(String(v).replace(/^'/, "")); } catch (e) { return dflt; } }
function img(id, w) { return "https://drive.google.com/thumbnail?id=" + encodeURIComponent(id) + "&sz=w" + w; }

/* ============================ email ============================ */

var MAIL_NOTICES = null, OUTBOX = null;
function flushMail() {
  var box = OUTBOX || []; OUTBOX = null;
  box.forEach(function (m) { try { sendMailNow(m.to, m.subject, m.html); } catch (e) { if (MAIL_NOTICES && m.notice !== "") MAIL_NOTICES.push(m.notice || "Saved, but an email couldn't be sent."); } });
}
/* Data is already saved when mail goes out, so a mail failure becomes a notice, never an error that suggests nothing happened. */
function safeMail(fn, notice) { try { fn(); } catch (e) { if (MAIL_NOTICES && notice) MAIL_NOTICES.push(notice); } }
function notifyJesus(fromEmail, subject, html) {
  var cache = CacheService.getScriptCache(), k = "notice:" + normEmail(fromEmail), n = Number(cache.get(k) || 0);
  if (n >= CONFIG.NOTICES_PER_HOUR) return;                                // still saved in the portal, just no extra email
  try { if (MailApp.getRemainingDailyQuota() < CONFIG.MAIL_RESERVE) return; } catch (e) {}
  cache.put(k, String(n + 1), 3600);
  safeMail(function () { sendMail(CONFIG.NOTIFY_EMAIL, subject, html); }, "");
}
function emailClients(p, subject, html) {
  rows("People").filter(function (x) { return isOutside(x) && isTrue(x.active) && splitIds(x.project_ids).indexOf(p.id) > -1; })
    .forEach(function (x) { sendMail(x.email, subject, "<p>Hi " + esc(first(x.name)) + ",</p>" + html); });
}
/* Send from info@ when Gmail lets this account send as it; otherwise from the account itself (nothing breaks). */
function fromAddress() {
  var c = CacheService.getScriptCache(), k = "from-alias", v = c.get(k);
  if (v == null) { try { v = GmailApp.getAliases().map(normEmail).indexOf(normEmail(CONFIG.FROM_EMAIL)) > -1 ? CONFIG.FROM_EMAIL : ""; } catch (e) { v = ""; } c.put(k, v, 3600); }
  return v;
}
function sendMail(to, subject, html, notice) {
  if (OUTBOX) { OUTBOX.push({ to: to, subject: subject, html: html, notice: notice }); return; }   // during a request: send once the lock is free
  sendMailNow(to, subject, html);
}
function sendMailNow(to, subject, html) {
  var from = fromAddress();
  GmailApp.sendEmail(to, subject, html.replace(/<[^>]+>/g, " "), {
    from: from || undefined,
    name: CONFIG.COMPANY,
    htmlBody: "<div style='font-family:Arial,sans-serif;font-size:15px;color:#111;line-height:1.5;max-width:560px'>" + html +
      "<p style='color:#999;font-size:12px;margin-top:28px'>" + CONFIG.COMPANY + " · Crafting sites, one space at a time.</p></div>"
  });
}
/* Email buttons open the portal right where the thing is: a chat, a private conversation, an invoice, an update. */
function deep(pid, tab, ch) { return "#p=" + encodeURIComponent(pid) + (tab ? "&t=" + tab : "") + (ch ? "&c=" + encodeURIComponent(ch) : ""); }
function button(label, hash) { return "<p><a href='" + CONFIG.PORTAL_URL + (hash || "") + "' style='display:inline-block;background:#111;color:#fff;padding:10px 18px;border-radius:999px;text-decoration:none'>" + esc(label) + "</a></p>"; }
function tag(pid, mid) { return "[" + CONFIG.TAG + "-" + pid + "-" + mid + "]"; }

/* ============================ tiny sheet "database" ============================ */

var _BOOK = null;
function ss() {
  if (_BOOK) return _BOOK;
  var props = PropertiesService.getScriptProperties(), id = props.getProperty("PORTAL_SHEET_ID");
  if (id) { try { return (_BOOK = SpreadsheetApp.openById(id)); } catch (e) { throw new Error("The portal database sheet is missing. Run setup() again."); } }
  _BOOK = SpreadsheetApp.create(CONFIG.DB_NAME); props.setProperty("PORTAL_SHEET_ID", _BOOK.getId());
  return _BOOK;
}
/* Every tab keeps its header row and stores everything as plain text, so Sheets never turns ids, amounts or dates into something else. */
var _ROWS = {}, _SHEETS = {};
function prefetch(tables) {
  var need = tables.filter(function (t, i) { return !_ROWS[t] && tables.indexOf(t) === i && TABLES[t]; }); if (!need.length) return;
  var id = PropertiesService.getScriptProperties().getProperty("PORTAL_SHEET_ID"); if (!id) return;
  try {
    var res = Sheets.Spreadsheets.Values.batchGet(id, { ranges: need.map(function (t) { return "'" + t + "'!A1:AZ"; }), valueRenderOption: "FORMATTED_VALUE" });
    (res.valueRanges || []).forEach(function (vr, i) {
      var t = need[i], h = TABLES[t], v = vr.values || [], out = [];
      for (var r = 1; r < v.length; r++) { var o = {}, row = v[r]; for (var c = 0; c < h.length; c++) o[h[c]] = row[c] == null ? "" : String(row[c]); out.push(o); }
      _ROWS[t] = out;
    });
  } catch (e) { /* a tab may not exist yet: the normal one-by-one reads still work */ }
}
function tableSheet(t) {
  if (_SHEETS[t]) return _SHEETS[t];
  var book = ss(), sh = book.getSheetByName(t);
  if (!sh) sh = book.insertSheet(t, book.getNumSheets());
  var n = TABLES[t].length;
  if (sh.getLastRow() === 0) {
    sh.getRange(1, 1, sh.getMaxRows(), n).setNumberFormat("@");
    sh.getRange(1, 1, 1, n).setValues([TABLES[t]]); sh.setFrozenRows(1);
  } else if (sh.getLastColumn() < n) {                     // a newer version added columns: label them, keep them as text
    var from = sh.getLastColumn() + 1;
    sh.getRange(1, from, sh.getMaxRows(), n - from + 1).setNumberFormat("@");
    sh.getRange(1, from, 1, n - from + 1).setValues([TABLES[t].slice(from - 1)]);
  }
  _SHEETS[t] = sh;
  return sh;
}
function rows(t) {
  if (_ROWS[t]) return _ROWS[t];
  var sh = tableSheet(t), v = sh.getDataRange().getValues(), h = TABLES[t], outR = [];
  for (var i = 1; i < v.length; i++) { var o = {}; h.forEach(function (k, c) { o[k] = v[i][c] == null ? "" : cell(v[i][c]); }); outR.push(o); }
  _ROWS[t] = outR;
  return outR;
}
function insert(t, obj) {
  var sh = tableSheet(t), h = TABLES[t], r = sh.getLastRow() + 1, vals = h.map(function (k) { return obj[k] == null ? "" : String(obj[k]); });
  sh.getRange(r, 1, 1, h.length).setNumberFormat("@").setValues([vals.map(safe)]);
  if (_ROWS[t] && _ROWS[t].length === r - 2) { var o = {}; h.forEach(function (k, c) { o[k] = vals[c]; }); _ROWS[t].push(o); } else delete _ROWS[t];
}
function update(t, keyCol, keyVal, patch) {
  var sh = tableSheet(t), list = rows(t), h = TABLES[t];
  for (var i = 0; i < list.length; i++) if (list[i][keyCol] === String(keyVal)) {
    Object.keys(patch).forEach(function (k) {
      var c = h.indexOf(k); if (c < 0) return;
      var v = String(patch[k] == null ? "" : patch[k]);
      sh.getRange(i + 2, c + 1).setValue(safe(v)); list[i][k] = v;      // columns are plain text already; keep our copy in step
    });
    return true;
  }
  return false;
}
function removeWhere(t, test) {
  var sh = tableSheet(t), all = rows(t); delete _ROWS[t];
  for (var i = all.length - 1; i >= 0; i--) if (test(all[i])) sh.deleteRow(i + 2);
}
function findBy(t, col, val) { return rows(t).filter(function (r) { return r[col] === String(val); })[0] || null; }
function findPerson(email) { return findBy("People", "email", normEmail(email)); }

/* ============================ helpers ============================ */

function newId(prefix) { return (prefix || "x") + Utilities.getUuid().replace(/-/g, "").slice(0, 11); }   // always starts with a letter
function sha(s) { return Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, String(s)).map(function (b) { return ((b + 256) % 256).toString(16).padStart(2, "0"); }).join(""); }
function now() { return Utilities.formatDate(new Date(), CONFIG.TZ, "yyyy-MM-dd HH:mm"); }
function today() { return Utilities.formatDate(new Date(), CONFIG.TZ, "yyyy-MM-dd"); }
function cell(v) {
  if (!(v instanceof Date)) return String(v);
  var tz = ss().getSpreadsheetTimeZone() || CONFIG.TZ, hm = Utilities.formatDate(v, tz, "HH:mm");
  return Utilities.formatDate(v, tz, "yyyy-MM-dd") + (hm !== "00:00" ? " " + hm : "");
}
function num(v) { var n = Number(String(v == null ? "" : v).replace(/^'/, "").replace(/[$,\s]/g, "")); return isFinite(n) ? n : 0; }   // a stored "-500" can come back as "'-500"
function cents(v) { return Math.round(num(v) * 100) / 100; }
function safe(v) { return typeof v === "string" && /^[=+@\-\t\r]/.test(v) ? "'" + v : v; }
function clean(v, max) { return String(v == null ? "" : v).replace(/\r/g, "").trim().slice(0, max); }
function normEmail(e) { return String(e || "").trim().toLowerCase(); }
function splitIds(s) { return String(s || "").split(",").map(function (x) { return x.trim(); }).filter(Boolean); }
function isTrue(v) { return /^(yes|true|y|1)$/i.test(String(v)); }
function first(n) { return String(n || "").split(/\s+/)[0] || "there"; }
function dateOrEmpty(v) { return /^\d{4}-\d{2}-\d{2}$/.test(String(v || "")) ? String(v) : ""; }
function money(n) { return Number(n || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }
function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
function nl2br(s) { return String(s).replace(/\n/g, "<br>"); }
