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
  SESSION_DAYS: 30,
  CODE_MINUTES: 15,
  CODES_PER_15MIN: 3,       // login-code emails per address
  CODES_PER_6H: 8,
  CODES_PER_DAY: 200,       // across the whole portal
  MAIL_RESERVE: 40,         // stop sending codes/notices when the day's mail quota gets this low
  NOTICES_PER_HOUR: 10,     // client-triggered notices to Jesús, per person
  PHASES: ["Design", "Permits", "Pre-construction", "Construction", "Punch list", "Complete"],
  TAG: "BSP" // subject tag: [BSP-<projectId>-<messageId>]
};

var TABLES = {
  Projects: ["id", "name", "client_name", "address", "city", "phase", "progress", "start_date", "target_date", "summary", "cover_file_id", "folder_id", "status", "created_at", "retainage_pct"],
  People: ["email", "name", "role", "project_ids", "active", "created_at", "avatar"],
  Sessions: ["token_hash", "email", "expires_at", "created_at"],
  Timeline: ["id", "project_id", "at", "author", "text", "photo_ids", "emailed"],
  Photos: ["id", "project_id", "file_id", "caption", "at", "author", "update_id"],
  Messages: ["id", "project_id", "at", "author", "author_email", "role", "kind", "text", "question_id", "status", "via", "channel", "thread_id", "files", "reactions", "ref"],
  Invoices: ["id", "project_id", "number", "title", "amount", "issued", "due", "status", "paid_date", "pdf_file_id", "pay_url", "notes", "retainage", "lines"],
  Checklist: ["id", "project_id", "phase", "item", "owner", "due", "done", "done_by", "done_at", "sort"],
  EmailImports: ["gmail_id", "project_id", "message_id", "at", "result"],
  Schedule: ["id", "project_id", "kind", "title", "start", "end", "phase", "owner", "status", "notes", "sort"],
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
  activity: ["Projects", "People", "Messages", "Reads"], presence: ["People", "Projects"], me: ["People"], markRead: ["People", "Projects", "Reads"]
};
var NO_LOCK = { markRead: 1, presence: 1 };          // only touch your own row / the cache: no need to queue behind other saves
var READ_ONLY = { me: 1, listProjects: 1, getProject: 1, activity: 1, listTeam: 1, mailStatus: 1, planImage: 1, planText: 1 };
/* Chat channels per project: "client" (client, architect and team), "architect" (architect and team), "team" (team only). */
var CHANNELS = ["client", "architect", "team"];
var REACTIONS = ["👍", "✅", "❤️", "👀", "🎉", "🙏"];
var AVATARS = ["🦊", "🐻", "🦉", "🐢", "🐙", "🦖", "🐝", "🦄", "🐸", "🐼", "🦁", "🐧", "🌵", "🌲", "🌻", "🍄", "🏗️", "🚜", "🧱", "🔨", "📐", "🛠️", "🏡", "⛰️", "🌊", "🔥", "⭐", "🎸", "🚀", "😎"];
var AVATAR_COLORS = ["#f3e7d3", "#e3efe7", "#e7eef7", "#fdf4dc", "#efecfb", "#fcedf3", "#fdeee7", "#e8f4f4", "#111111"];
var PLAN_ORIGINS = ["https://www.bluesierracorp.com", "https://bluesierracorp.com", "https://planscope.github.io", "http://localhost:8765"];

/* ============================ web app ============================ */

function doGet() { return out({ ok: false, error: "Use POST." }); }

function doPost(e) {
  var res, notices = [];
  try {
    var b = JSON.parse((e.postData && e.postData.contents) || "{}");
    var pub = PUBLIC[b.action], fn;
    MAIL_NOTICES = notices;
    if (pub) res = withLock(function () { return pub(b); });
    else {
      prefetch(["People"].concat(PREFETCH[b.action] || []));
      var me = auth(b.token);
      fn = ACTIONS[b.action];
      if (!fn) throw new Error("Unknown action.");
      res = READ_ONLY[b.action] || NO_LOCK[b.action] ? fn(me, b) : withLock(function () { return fn(me, b); });
    }
    res = res || {}; res.ok = true;
    if (notices.length) res.notice = notices[0];
  } catch (err) { res = { ok: false, error: String(err.message || err) }; }
  return out(res);
}
function out(o) { return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON); }
function withLock(fn) { var lock = LockService.getScriptLock(); if (!lock.tryLock(20000)) throw new Error("The portal is busy. Try again in a moment."); try { return fn(); } finally { lock.releaseLock(); } }

/* ============================ login ============================ */

var PUBLIC = {
  requestCode: function (b) {
    var email = normEmail(b.email);
    if (!email || email.length > 200) throw new Error("That email doesn't look right.");
    var person = findPerson(email);
    if (!person || !isTrue(person.active)) return { sent: true };      // same answer, nothing stored, nothing sent
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
    var token = Utilities.getUuid().replace(/-/g, "") + Utilities.getUuid().replace(/-/g, "");
    insert("Sessions", { token_hash: sha(token), email: email, expires_at: new Date(Date.now() + CONFIG.SESSION_DAYS * 864e5).toISOString(), created_at: now() });
    return { token: token, me: publicMe(person) };
  }
};

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
function publicMe(p) { return { email: p.email, name: p.name, role: p.role, staff: isStaff(p), admin: p.role === "admin", crew: p.role === "crew", key: pkey(p.email), avatar: p.avatar || "" }; }
/* Roles: admin (Jesús: everything), staff (project managers), crew (field: their projects, #team, plans and schedule, no money), client, architect. */
function isTeam(p) { return isStaff(p) || p.role === "crew"; }
function pkey(email) { return sha("bsp:" + normEmail(email)).slice(0, 10); }      // a person id that never reveals the email
function isDm(ch) { return /^dm:[0-9a-f]{10}-[0-9a-f]{10}$/.test(String(ch)); }
function dmOf(a, b) { return "dm:" + [a, b].sort().join("-"); }
/* Can this person read (and post in) this channel? Normal channels by role; private messages only the two people in them. */
function canRead(me, ch) { if (isDm(ch)) { me._k = me._k || pkey(me.email); return ch.indexOf(me._k) > -1; } return channelsFor(me).indexOf(ch) > -1; }
function isStaff(p) { return p.role === "admin" || p.role === "staff"; }
function channelsFor(me) { return isStaff(me) ? CHANNELS : me.role === "crew" ? ["team"] : me.role === "architect" ? ["client", "architect"] : ["client"]; }
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
    return { me: publicMe(me), projects: all.map(function (p) { var o = summary(p, inv, msgs, tl, me, lines, reads); o.needs = needsOf(p, ck, sc, inv);
      if (me.role === "crew") { o.money = {}; o.balance = 0; o.needs.invoices = []; o.needs.todos = []; }
      return o; }) };
  },

  getProject: function (me, b) {
    var p = needProject(me, b.projectId), id = p.id, staff = isStaff(me), team = isTeam(me), crew = me.role === "crew";
    var by = function (t) { return rows(t).filter(function (r) { return r.project_id === id; }); };
    var data = {
      project: projectOut(p),
      timeline: by("Timeline").reverse(),
      photos: by("Photos").reverse().map(photoOut),
      // Clients never receive other people's email addresses.
      messages: messagesOut(by("Messages"), me),
      reads: readsFor(me, id),
      members: membersOf(p).map(function (x) { return { name: x.name, role: x.role, key: pkey(x.email), avatar: x.avatar || "" }; }),
      channels: channelsFor(me),
      invoices: crew ? [] : by("Invoices").filter(function (i) { return staff || (i.status !== "draft" && i.status !== "void"); }).map(function (i) { return invoiceOut(i, staff); }),
      checklist: by("Checklist").sort(function (a, c) { return Number(a.sort || 0) - Number(c.sort || 0); }),
      schedule: by("Schedule").sort(function (a, c) { return a.start < c.start ? -1 : a.start > c.start ? 1 : Number(a.sort || 0) - Number(c.sort || 0); })
        .map(function (x) { var o = Object.assign({}, x); if (!team) delete o.notes; return o; }),
      contract: crew ? { retainage_pct: 0, lines: [] } : contractOut(by("ContractLines"), p, staff),
      plans: plansOut(by("Plans"), me),
      phases: CONFIG.PHASES
    };
    if (staff) data.people = rows("People").filter(function (x) { return isStaff(x) || splitIds(x.project_ids).indexOf(id) > -1; }).map(function (x) { return { email: x.email, name: x.name, role: x.role, active: isTrue(x.active), avatar: x.avatar || "" }; });
    return data;
  },

  saveProject: function (me, b) {
    needStaff(me);
    var f = b.project || {}, fields = ["name", "client_name", "address", "city", "phase", "progress", "start_date", "target_date", "summary", "status", "retainage_pct"];
    if (!clean(f.name, 200)) throw new Error("The project needs a name.");
    if (f.phase && CONFIG.PHASES.indexOf(f.phase) < 0) throw new Error("Unknown phase.");
    var patch = {}; fields.forEach(function (k) { if (f[k] != null) patch[k] = clean(f[k], 1000); });
    if (patch.progress != null) patch.progress = String(Math.max(0, Math.min(100, Number(patch.progress) || 0)));
    if (patch.status != null && ["active", "archived"].indexOf(patch.status) < 0) patch.status = "active";
    ["start_date", "target_date"].forEach(function (k) { if (patch[k] != null) patch[k] = dateOrEmpty(patch[k]); });
    if (patch.retainage_pct != null) patch.retainage_pct = String(Math.max(0, Math.min(20, num(patch.retainage_pct))));
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
    if (!/^[^@\s,;<>]+@[^@\s,;<>]+\.[^@\s,;<>]+$/.test(email)) throw new Error("That email doesn't look right.");
    var p = b.projectId ? needProject(me, b.projectId) : null;
    var existing = findPerson(email);
    if (existing) {
      if (isStaff(existing) && !admin) throw new Error("Only Jesús can change team members.");
      if (!isTrue(existing.active) && !admin) throw new Error("This person's access was turned off. Ask Jesús to turn it back on.");
      var ids = splitIds(existing.project_ids); if (p && role !== "staff" && ids.indexOf(p.id) < 0) ids.push(p.id);
      var patch = { project_ids: ids.join(","), active: "yes" };
      if (existing.role !== role && existing.role !== "admin" && (admin || (!isStaff(existing) && role !== "staff"))) patch.role = role;   // only admins touch team roles
      if (!existing.name && b.name) patch.name = clean(b.name, 120);
      update("People", "email", email, patch);
    } else {
      insert("People", { email: email, name: clean(b.name, 120) || email, role: role, project_ids: p && role !== "staff" ? p.id : "", active: "yes", created_at: now() });
    }
    if (b.invite && !p && role === "staff") safeMail(function () {
      sendMail(email, "You're on the " + CONFIG.COMPANY + " portal team",
        "<p>Hi " + esc(first(b.name || "")) + ",</p><p>Jesús added you to the " + CONFIG.COMPANY + " project portal. You can see every project: schedule, photos, chat, contract and invoices.</p>" +
        button("Open the portal") + "<p>To log in, type this email address and we'll send you a 6-digit code.</p>");
    }, "Added, but the invitation email couldn't be sent.");
    if (b.invite && p) safeMail(function () {
      sendMail(email, "Your project portal for " + p.name,
        "<p>Hi " + esc(first(b.name || "")) + ",</p><p>You can follow <b>" + esc(p.name) + "</b> in the " + CONFIG.COMPANY + " portal: photos, updates, questions, invoices and the checklist, all in one place.</p>" +
        button("Open the portal") + "<p>To log in, type this email address and we'll send you a 6-digit code.</p>");
    }, "Added, but the invitation email couldn't be sent.");
    return {};
  },

  removePerson: function (me, b) {
    needStaff(me);
    var person = findPerson(normEmail(b.email)); if (!person) return {};
    if (person.email === me.email && !b.projectId) throw new Error("You can't turn off your own access.");
    if (isStaff(person) && me.role !== "admin") throw new Error("Only Jesús can remove team members.");
    var ids = splitIds(person.project_ids).filter(function (x) { return x !== String(b.projectId); });
    update("People", "email", person.email, b.projectId ? { project_ids: ids.join(",") } : { active: "no" });
    return {};
  },

  postUpdate: function (me, b) {
    needStaff(me); var p = needProject(me, b.projectId);
    var text = clean(b.text, 5000); if (!text && !(b.photos || []).length) throw new Error("Write something or add photos.");
    var uid = newId("u"), ids = savePhotos(me, p, b.photos || [], "", uid);
    insert("Timeline", { id: uid, project_id: p.id, at: now(), author: me.name, text: text, photo_ids: ids.join(","), emailed: b.notify ? "yes" : "" });
    postEvent(p, me, "update", "posted a project update" + (ids.length ? " with " + ids.length + " photo" + (ids.length > 1 ? "s" : "") : ""), text.slice(0, 240), "update:" + uid);
    if (b.notify) safeMail(function () { emailClients(p, "Project update: " + p.name, "<p>" + nl2br(esc(text)) + "</p>" + (ids.length ? "<p>" + ids.length + " new photo" + (ids.length > 1 ? "s" : "") + " in the portal.</p>" : "") + button("See the update")); }, "Posted, but the email to the client couldn't be sent.");
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
      try { if (MailApp.getRemainingDailyQuota() >= CONFIG.MAIL_RESERVE) safeMail(function () { sendMail(dmTo.email, me.name + " sent you a private message · " + p.name, "<p>Hi " + esc(first(dmTo.name)) + ",</p><p><b>" + esc(me.name) + "</b> sent you a private message on " + esc(p.name) + ". Only the two of you can see it.</p><blockquote style='border-left:3px solid #ddd;margin:0;padding-left:12px;color:#333'>" + nl2br(esc(text)) + "</blockquote>" + button("Open the portal")); }, ""); } catch (e) {}
    } else if (isStaff(me) && channel !== "team") {
      // Client channel: the client and the architect. Architect channel: only the architect. Replies by email come back into the same place.
      var who = membersOf(p).filter(function (x) { return isOutside(x) && (channel === "client" || x.role === "architect"); });
      var subj = (kind === "question" ? "Question about " : "Message about ") + p.name + " " + tag(p.id, id);
      safeMail(function () { who.forEach(function (x) { emailed[x.email] = 1; sendMail(x.email, subj, "<p>Hi " + esc(first(x.name)) + ",</p>" + body +
        (kind === "question" ? "<p><b>You can answer by replying to this email</b>, or in the portal.</p>" : "<p>You can reply to this email or in the portal.</p>") + button("Open the portal")); }); },
        "Saved, but the email couldn't be sent.");
    } else if (!isTeam(me)) notifyJesus(me.email, "New message from " + me.name + " · " + p.name, "<p>" + nl2br(esc(text)) + "</p>" + button("Open the portal"));
    if (!dmTo) notifyMentions(p, me, text, channel, emailed);
    markReadNow(me, p.id, channel);
    return { id: id };
  },

  /* Reactions: one tap adds or removes yours. */
  react: function (me, b) {
    var m = findBy("Messages", "id", b.messageId); if (!m) throw new Error("Message not found.");
    needProject(me, m.project_id); if (!canRead(me, chOf(m))) throw new Error("Message not found.");
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
    var list = rows("Messages").filter(function (m) { return seen[m.project_id] && canRead(me, chOf(m)); }).reverse().slice(0, lim);
    return { items: list.map(function (m) {
      var o = { id: m.id, project_id: m.project_id, project: seen[m.project_id].name, channel: chOf(m), thread_id: m.thread_id, kind: m.kind, author: m.author, role: m.role,
        at: m.at, text: String(m.text).slice(0, 400), files: parseJson(m.files, []).length, mine: m.author_email === me.email, ref: m.ref || "", status: m.kind === "event" ? m.status : "", avatar: av[m.author_email] || "",
        dm: isDm(chOf(m)), akey: keyOf(m.author_email) };
      o.unread = !o.mine && m.at > (reads[m.project_id + "|" + o.channel] || "");
      o.mention = mentions(m.text, me.name);
      return o;
    }) };
  },
  /* Your own profile picture: a fun character on a color. */
  saveProfile: function (me, b) {
    var av = String(b.avatar || "");
    if (/^v1:[a-z0-9=;]{1,160}$/.test(av)) { update("People", "email", me.email, { avatar: av }); return { avatar: av }; }   // a drawn character
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
    var people = rows("People").filter(function (x) {
      if (!isTrue(x.active) || x.email === me.email) return false;
      if (isStaff(me)) return true;                                                  // the team sees everyone on the portal
      return isStaff(x) || splitIds(x.project_ids).some(function (id) { return names[id]; });
    });
    var keys = people.map(function (x) { return "pres:" + pkey(x.email); }), got = c.getAll(keys), now = Date.now();
    return { me: mine, people: people.map(function (x) {
      var k = pkey(x.email), raw = got["pres:" + k], pr = raw ? JSON.parse(raw) : null, age = pr ? now - pr.at : Infinity;
      var state = !pr || age > 3 * 60000 ? "offline" : pr.call > now ? "busy" : pr.s === "busy" ? "busy" : pr.hidden || pr.s === "away" || age > 90000 ? "away" : "online";
      var shared = isStaff(x) ? projects.map(function (p) { return p.id; }) : splitIds(x.project_ids).filter(function (id) { return names[id]; });
      return { key: k, name: x.name, role: x.role, avatar: x.avatar || "", state: state, last: pr ? pr.at : 0, inCall: !!(pr && pr.call > now),
        pid: pr && state !== "offline" && names[pr.pid] ? pr.pid : "", project: pr && names[pr.pid] ? names[pr.pid] : "", tab: pr && names[pr.pid] ? pr.tab : "", shared: shared.slice(0, 50) };
    }) };
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
    if (n >= 6) throw new Error("That's a lot of calls in an hour. Use the last link.");
    var keys = (b.invite || []).map(String), who = membersOf(p).filter(function (x) { return x.email !== me.email && keys.indexOf(pkey(x.email)) > -1 && canRead(x, ch); });
    if (!who.length) throw new Error("Pick at least one person to call.");
    c.put(k, String(n + 1), 3600);
    var start = new Date(), end = new Date(start.getTime() + 60 * 60000), names = who.map(function (x) { return x.name; });
    var ev = Calendar.Events.insert({ summary: "Call · " + p.name + " (" + me.name + ")", description: "Started from the Blue Sierra portal.",
      start: { dateTime: start.toISOString() }, end: { dateTime: end.toISOString() },
      attendees: who.map(function (x) { return { email: x.email }; }).concat(me.email !== Session.getEffectiveUser().getEmail() ? [{ email: me.email }] : []),
      conferenceData: { createRequest: { requestId: newId("r"), conferenceSolutionKey: { type: "hangoutsMeet" } } } }, "primary", { conferenceDataVersion: 1, sendUpdates: "none" });
    var url = ev.hangoutLink || ((ev.conferenceData && ev.conferenceData.entryPoints || []).filter(function (e) { return e.entryPointType === "video"; })[0] || {}).uri;
    if (!/^https:\/\/meet\.google\.com\//.test(url || "")) throw new Error("Google didn't return a Meet link. Try again.");
    var code = url.split("/").pop();
    who.forEach(function (x) {
      try { if (MailApp.getRemainingDailyQuota() < CONFIG.MAIL_RESERVE) return; } catch (e) {}
      safeMail(function () { sendMail(x.email, "📹 " + me.name + " is calling you · " + p.name, "<p>Hi " + esc(first(x.name)) + ",</p><p><b>" + esc(me.name) + "</b> started a video call about <b>" + esc(p.name) + "</b> and is waiting for you.</p>" +
        "<p><a href='" + url + "' style='display:inline-block;background:#1a73e8;color:#fff;padding:10px 18px;border-radius:999px;text-decoration:none'>Join the call</a></p>" +
        "<p style='color:#555'>Or open <b>meet.google.com</b> and enter the code <b>" + esc(code) + "</b>.</p>"); }, "");
    });
    try { var pc = CacheService.getScriptCache(), pkk = "pres:" + pkey(me.email), pv = JSON.parse(pc.get(pkk) || "{}"); pv.call = Date.now() + 45 * 60000; pv.at = pv.at || Date.now(); pc.put(pkk, JSON.stringify(pv), 21600); } catch (e) {}
    postEvent(p, me, "call", "is calling " + (names.length > 3 ? names.slice(0, 3).join(", ") + " and " + (names.length - 3) + " more" : names.join(", ").replace(/, ([^,]*)$/, " and $1")),
      "Tap Join, or open meet.google.com and enter this code. The link works for the next hour.", "meet:" + url, ch);
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
    return { team: rows("People").filter(isTeam).map(function (x) { return { email: x.email, name: x.name, role: x.role, active: isTrue(x.active), since: String(x.created_at || "").slice(0, 10), avatar: x.avatar || "", projects: splitIds(x.project_ids).length }; }) };
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
    var wasVisible = old && ["sent", "paid"].indexOf(old.status) > -1;
    if (id) update("Invoices", "id", id, patch);
    else { id = newId("i"); patch.id = id; patch.project_id = p.id; if (patch.notes == null) patch.notes = ""; insert("Invoices", patch); }
    var dueNow = num(patch.amount != null ? patch.amount : old && old.amount) - num(patch.retainage != null ? patch.retainage : old && old.retainage);
    if (patch.status === "sent" && !wasVisible) postEvent(p, me, "invoice", "sent invoice " + patch.number, (patch.title ? patch.title + " · " : "") + "$" + money(dueNow) + " due" + (patch.due ? " by " + patch.due : ""), "invoice:" + id);
    if (patch.status === "paid" && (!old || old.status !== "paid")) postEvent(p, me, "paid", "marked invoice " + patch.number + " as paid", "$" + money(dueNow) + " received. Thank you!", "invoice:" + id);
    if (b.notify && patch.status === "sent") safeMail(function () {
      emailClients(p, "Invoice " + patch.number + " · " + p.name,
        "<p>A new invoice is ready in your portal: <b>" + esc(patch.title || patch.number) + "</b>, $" + money(num(patch.amount) - num(patch.retainage != null ? patch.retainage : old && old.retainage)) + (patch.due ? ", due " + esc(patch.due) : "") + ".</p>" + button("See the invoice"));
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
  saveChecklistItem: function (me, b) {
    needStaff(me); var p = needProject(me, b.projectId), f = b.item || {};
    var patch = { phase: CONFIG.PHASES.indexOf(f.phase) > -1 ? f.phase : CONFIG.PHASES[0], item: clean(f.item, 300), owner: f.owner === "client" ? "client" : "blue sierra", due: dateOrEmpty(f.due) };
    if (!patch.item) throw new Error("Write the checklist item.");
    if (f.id) { var it = findBy("Checklist", "id", f.id); if (!it || it.project_id !== p.id) throw new Error("Item not found."); update("Checklist", "id", f.id, patch); }
    else {
      patch.id = newId("c"); patch.project_id = p.id; patch.done = ""; patch.sort = String(Date.now()); insert("Checklist", patch);
      if (patch.owner === "client") postEvent(p, me, "todo", "added a to-do for the client", patch.item + (patch.due ? " · due " + patch.due : ""), "check:" + patch.id);
    }
    return {};
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
    if (!isStaff(me) && (it.owner !== "client" || me.role !== "client")) throw new Error(it.owner === "client" ? "Only the client checks off that one." : "Blue Sierra checks off that one.");
    var done = !isTrue(it.done);
    update("Checklist", "id", it.id, { done: done ? "yes" : "", done_by: done ? me.name : "", done_at: done ? now() : "" });
    if (done && !isStaff(me)) notifyJesus(me.email, me.name + " checked off: " + it.item, "<p>" + esc(p.name) + "</p>" + button("Open the portal"));
    if (done) postEvent(p, me, "done", "checked off a to-do", it.item, "check:" + it.id);
    return {};
  }
};

/* ============================ email replies ============================ */

/** Runs every 10 minutes. Imports a client's email reply only when Gmail verified the sender and the thread began with our email. */
function checkEmailReplies() {
  var lock = LockService.getScriptLock(); if (!lock.tryLock(5000)) return;
  try {
    var done = {}; rows("EmailImports").forEach(function (r) { done[r.gmail_id] = 1; });
    var me = normEmail(Session.getEffectiveUser().getEmail()), ours = [me, normEmail(CONFIG.FROM_EMAIL), normEmail(CONFIG.NOTIFY_EMAIL)];
    GmailApp.search('subject:"' + CONFIG.TAG + '" newer_than:14d -in:spam -in:trash', 0, 50).forEach(function (th) {
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
  } finally { lock.releaseLock(); }
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
  if (role === "client" || role === "architect") notifyJesus(email, name + " answered: " + q.text.slice(0, 60), "<p><b>Question:</b> " + esc(q.text) + "</p><p><b>Answer:</b> " + nl2br(esc(text)) + "</p><p style='color:#666'>" + esc(p.name) + " · via " + via + "</p>" + button("Open the portal"));
  return id;
}
function addMessage(p, person, text, via, at, id, channel, threadId) {
  id = id || newId("m");
  insert("Messages", { id: id, project_id: p.id, at: at || now(), author: person.name, author_email: person.email, role: person.role, kind: "message", text: text, question_id: "", status: "", via: via,
    channel: channel || "client", thread_id: threadId || "", files: "", reactions: "" });
  notifyJesus(person.email, "New message from " + person.name + " · " + p.name, "<p>" + nl2br(esc(text)) + "</p>" + button("Open the portal"));
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
    retainage_pct: num(p.retainage_pct) };
}
function photoOut(ph) { return { id: ph.id, file_id: ph.file_id, thumb: img(ph.file_id, 600), full: img(ph.file_id, 2000), caption: ph.caption, at: ph.at, author: ph.author, update_id: ph.update_id }; }
function invoiceOut(i, staff) {
  var st = i.status; if (st === "sent" && i.due && i.due < today()) st = "overdue";
  var lines = {}; try { lines = i.lines ? JSON.parse(String(i.lines).replace(/^'/, "")) : {}; } catch (e) {}
  var o = { id: i.id, number: i.number, title: i.title, amount: num(i.amount), retainage: num(i.retainage), lines: lines, issued: i.issued, due: i.due, status: st, paid_date: i.paid_date,
    pdf: i.pdf_file_id ? "https://drive.google.com/file/d/" + i.pdf_file_id + "/view" : "", pay_url: i.pay_url };
  if (staff) o.notes = i.notes;                                          // internal notes stay with the team
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
  return list.filter(function (m) { return canRead(me, chOf(m)); }).map(function (m) {
    var r = parseJson(m.reactions, {});
    var o = { id: m.id, at: m.at, author: m.author, role: m.role, kind: m.kind, text: m.text, question_id: m.question_id, status: m.status, via: m.via,
      channel: chOf(m), thread_id: m.thread_id || "", ref: m.ref || "", mine: m.author_email === me.email, mention: mentions(m.text, me.name), avatar: av[m.author_email] || "", akey: keyOf(m.author_email),
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
  postEvent(p, me, "change", verb + " change order" + (line.number ? " " + line.number : ""), line.title + " · " + (num(line.amount) < 0 ? "−$" + money(-num(line.amount)) : "+$" + money(line.amount)), "co:" + id);
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
function membersOf(p) { return rows("People").filter(function (x) { return isTrue(x.active) && (isStaff(x) || splitIds(x.project_ids).indexOf(p.id) > -1); }); }
function mentions(text, name) { return !!name && String(text || "").toLowerCase().indexOf("@" + String(name).toLowerCase()) > -1; }
/* "@Full Name" emails that person if they can see the channel (and didn't already get the message by email). */
function notifyMentions(p, me, text, channel, emailed) {
  if (String(text).indexOf("@") < 0) return;
  membersOf(p).forEach(function (x) {
    if (x.email === me.email || emailed[x.email] || !mentions(text, x.name) || channelsFor(x).indexOf(channel) < 0) return;
    try { if (MailApp.getRemainingDailyQuota() < CONFIG.MAIL_RESERVE) return; } catch (e) {}
    safeMail(function () { sendMail(x.email, me.name + " mentioned you · " + p.name + " #" + channel, "<p>Hi " + esc(first(x.name)) + ",</p><p><b>" + esc(me.name) + "</b> mentioned you in <b>#" + channel + "</b> on " + esc(p.name) + ":</p><blockquote style='border-left:3px solid #ddd;margin:0;padding-left:12px;color:#333'>" + nl2br(esc(text)) + "</blockquote>" + button("Open the portal")); }, "");
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
    tableSheet("Reads").getRange(i + 2, 4).setNumberFormat("@").setValue(now()); list[i].at = now(); return;
  }
  insert("Reads", { email: me.email, project_id: pid, channel: ch, at: now() });
}
function unreadOf(me, msgs, reads) {
  return msgs.filter(function (m) { var c = chOf(m); return canRead(me, c) && m.author_email !== me.email && m.at > (reads[m.project_id + "|" + c] || ""); }).length;
}
/* What a project needs from the client soon: open to-dos, dates in the next 14 days, invoices due. Feeds the notification bell. */
function needsOf(p, ck, sc, inv) {
  var t = today(), lim = Utilities.formatDate(new Date(Date.now() + 14 * 864e5), CONFIG.TZ, "yyyy-MM-dd");
  return {
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

var MAIL_NOTICES = null;
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
function sendMail(to, subject, html) {
  var from = fromAddress();
  GmailApp.sendEmail(to, subject, html.replace(/<[^>]+>/g, " "), {
    from: from || undefined,
    name: CONFIG.COMPANY,
    htmlBody: "<div style='font-family:Arial,sans-serif;font-size:15px;color:#111;line-height:1.5;max-width:560px'>" + html +
      "<p style='color:#999;font-size:12px;margin-top:28px'>" + CONFIG.COMPANY + " · Crafting sites, one space at a time.</p></div>"
  });
}
function button(label) { return "<p><a href='" + CONFIG.PORTAL_URL + "' style='display:inline-block;background:#111;color:#fff;padding:10px 18px;border-radius:999px;text-decoration:none'>" + esc(label) + "</a></p>"; }
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
  delete _ROWS[t];
  var sh = tableSheet(t), h = TABLES[t], r = sh.getLastRow() + 1;
  sh.getRange(r, 1, 1, h.length).setNumberFormat("@").setValues([h.map(function (k) { return safe(obj[k] == null ? "" : String(obj[k])); })]);
}
function update(t, keyCol, keyVal, patch) {
  delete _ROWS[t];
  var sh = tableSheet(t), v = sh.getDataRange().getValues(), h = TABLES[t], kc = h.indexOf(keyCol);
  for (var i = 1; i < v.length; i++) if (cell(v[i][kc]) === String(keyVal)) {
    Object.keys(patch).forEach(function (k) { var c = h.indexOf(k); if (c > -1) sh.getRange(i + 1, c + 1).setNumberFormat("@").setValue(safe(String(patch[k] == null ? "" : patch[k]))); });
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
