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
  People: ["email", "name", "role", "project_ids", "active", "created_at"],
  Sessions: ["token_hash", "email", "expires_at", "created_at"],
  Timeline: ["id", "project_id", "at", "author", "text", "photo_ids", "emailed"],
  Photos: ["id", "project_id", "file_id", "caption", "at", "author", "update_id"],
  Messages: ["id", "project_id", "at", "author", "author_email", "role", "kind", "text", "question_id", "status", "via"],
  Invoices: ["id", "project_id", "number", "title", "amount", "issued", "due", "status", "paid_date", "pdf_file_id", "pay_url", "notes", "retainage", "lines"],
  Checklist: ["id", "project_id", "phase", "item", "owner", "due", "done", "done_by", "done_at", "sort"],
  EmailImports: ["gmail_id", "project_id", "message_id", "at", "result"],
  Schedule: ["id", "project_id", "kind", "title", "start", "end", "phase", "owner", "status", "notes", "sort"],
  // The contract: "base" lines are the schedule of values (they add up to the contract sum); "change" lines are change orders.
  ContractLines: ["id", "project_id", "kind", "number", "title", "amount", "status", "date", "notes", "sort"]
};
var KINDS = ["task", "inspection", "payment", "decision", "meeting", "milestone", "deadline"];
var READ_ONLY = { me: 1, listProjects: 1, getProject: 1 };

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
      var me = auth(b.token);
      fn = ACTIONS[b.action];
      if (!fn) throw new Error("Unknown action.");
      res = READ_ONLY[b.action] ? fn(me, b) : withLock(function () { return fn(me, b); });
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
function publicMe(p) { return { email: p.email, name: p.name, role: p.role, staff: isStaff(p), admin: p.role === "admin" }; }
function isStaff(p) { return p.role === "admin" || p.role === "staff"; }
function isOutside(p) { return p.role === "client" || p.role === "architect"; }   // people outside the team: see only their projects
function needStaff(me) { if (!isStaff(me)) throw new Error("Only the Blue Sierra team can do that."); }
function canSee(me, pid) { if (isStaff(me)) return true; return (me.projects || splitIds(me.project_ids)).indexOf(String(pid)) > -1; }
function needProject(me, pid) {
  var p = rows("Projects").filter(function (r) { return r.id === String(pid); })[0];
  if (!p || !canSee(me, pid) || (!isStaff(me) && p.status === "archived")) throw new Error("Project not found.");
  return p;
}

/* ============================ actions ============================ */

var ACTIONS = {
  me: function (me) { return { me: publicMe(me) }; },
  logout: function (me) { removeWhere("Sessions", function (r) { return r.token_hash === me.tokenHash; }); CacheService.getScriptCache().remove("sess:" + me.tokenHash); return {}; },

  listProjects: function (me) {
    var all = rows("Projects").filter(function (p) { return canSee(me, p.id) && (isStaff(me) || p.status !== "archived"); });
    var inv = rows("Invoices"), msgs = rows("Messages"), tl = rows("Timeline");
    return { me: publicMe(me), projects: all.map(function (p) { return summary(p, inv, msgs, tl); }) };
  },

  getProject: function (me, b) {
    var p = needProject(me, b.projectId), id = p.id, staff = isStaff(me);
    var by = function (t) { return rows(t).filter(function (r) { return r.project_id === id; }); };
    var data = {
      project: projectOut(p),
      timeline: by("Timeline").reverse(),
      photos: by("Photos").reverse().map(photoOut),
      // Clients never receive other people's email addresses.
      messages: by("Messages").map(function (m) { var o = Object.assign({}, m); o.mine = m.author_email === me.email; if (!staff) delete o.author_email; return o; }),
      invoices: by("Invoices").filter(function (i) { return staff || (i.status !== "draft" && i.status !== "void"); }).map(function (i) { return invoiceOut(i, staff); }),
      checklist: by("Checklist").sort(function (a, c) { return Number(a.sort || 0) - Number(c.sort || 0); }),
      schedule: by("Schedule").sort(function (a, c) { return a.start < c.start ? -1 : a.start > c.start ? 1 : Number(a.sort || 0) - Number(c.sort || 0); })
        .map(function (x) { var o = Object.assign({}, x); if (!staff) delete o.notes; return o; }),
      contract: contractOut(by("ContractLines"), p, staff),
      phases: CONFIG.PHASES
    };
    if (staff) data.people = rows("People").filter(function (x) { return isStaff(x) || splitIds(x.project_ids).indexOf(id) > -1; }).map(function (x) { return { email: x.email, name: x.name, role: x.role, active: isTrue(x.active) }; });
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
    var email = normEmail(b.email), role = ["staff", "architect"].indexOf(b.role) > -1 ? b.role : "client", admin = me.role === "admin";
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
    var p = needProject(me, b.projectId), text = clean(b.text, 5000); if (!text) throw new Error("Write a message.");
    var kind = isStaff(me) && b.kind === "question" ? "question" : "message";
    var id = newId("m");
    insert("Messages", { id: id, project_id: p.id, at: now(), author: me.name, author_email: me.email, role: me.role, kind: kind, text: text, question_id: "", status: kind === "question" ? "open" : "", via: "portal" });
    if (isStaff(me)) {
      var subj = (kind === "question" ? "Question about " : "Message about ") + p.name + " " + tag(p.id, id);
      safeMail(function () {
        emailClients(p, subj, "<p>" + nl2br(esc(text)) + "</p><p style='color:#666'>— " + esc(me.name) + ", " + CONFIG.COMPANY + "</p>" +
          (kind === "question" ? "<p><b>You can answer by replying to this email</b>, or in the portal.</p>" : "<p>You can reply to this email or in the portal.</p>") + button("Open the portal"));
      }, "Saved, but the email to the client couldn't be sent.");
    } else notifyJesus(me.email, "New message from " + me.name + " · " + p.name, "<p>" + nl2br(esc(text)) + "</p>" + button("Open the portal"));
    return {};
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
    if (id) update("Invoices", "id", id, patch);
    else { id = newId("i"); patch.id = id; patch.project_id = p.id; if (patch.notes == null) patch.notes = ""; insert("Invoices", patch); }
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
    } else { patch.id = newId("c"); patch.project_id = p.id; patch.sort = String(Date.now()); if (patch.notes == null) patch.notes = ""; insert("ContractLines", patch); }
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
    else { patch.id = newId("c"); patch.project_id = p.id; patch.done = ""; patch.sort = String(Date.now()); insert("Checklist", patch); }
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
    else { patch.id = newId("s"); patch.project_id = p.id; patch.sort = String(Date.now()); if (patch.notes == null) patch.notes = ""; insert("Schedule", patch); }
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
    return {};
  }
};

/* ============================ email replies ============================ */

/** Runs every 10 minutes. Imports a client's email reply only when Gmail verified the sender and the thread began with our email. */
function checkEmailReplies() {
  var lock = LockService.getScriptLock(); if (!lock.tryLock(5000)) return;
  try {
    var done = {}; rows("EmailImports").forEach(function (r) { done[r.gmail_id] = 1; });
    var me = normEmail(Session.getEffectiveUser().getEmail());
    GmailApp.search('subject:"' + CONFIG.TAG + '" newer_than:14d -in:spam -in:trash', 0, 50).forEach(function (th) {
      var msgs = th.getMessages(), firstMsg = msgs[0];
      var m = String(firstMsg.getSubject()).match(new RegExp("\\[" + CONFIG.TAG + "-([a-z0-9]+)-([a-z0-9]+)\\]"));
      if (!m || senderOf(firstMsg.getFrom()) !== me) return;               // the thread must start with the portal's own email
      var p = findBy("Projects", "id", m[1]), q = findBy("Messages", "id", m[2]);
      if (!p || !q || q.project_id !== p.id || p.status === "archived") return;
      msgs.slice(1).forEach(function (msg) {
        var gid = msg.getId(); if (done[gid]) return;
        var mark = function (result, mid) { insert("EmailImports", { gmail_id: gid, project_id: p.id, message_id: mid || "", at: now(), result: result }); done[gid] = 1; };
        var from = senderOf(msg.getFrom());
        if (!from) return mark("unreadable sender");
        if (from === me || from === normEmail(CONFIG.NOTIFY_EMAIL)) return mark("ours");
        if (isAutoReply(msg)) return mark("auto-reply");
        if (!verifiedSender(msg, from)) return mark("not verified");
        var person = findPerson(from);
        if (!person || !isTrue(person.active) || !isOutside(person) || splitIds(person.project_ids).indexOf(p.id) < 0) return mark("not a client on this project");
        var text = replyText(msg.getPlainBody()); if (!text) return mark("empty");
        var at = Utilities.formatDate(msg.getDate(), CONFIG.TZ, "yyyy-MM-dd HH:mm");
        // Record the import first, so a failed notice can't make the same reply import again.
        var mid = newId("m"); mark("imported", mid);
        if (q.kind === "question" && q.status === "open") addAnswer(p, q, person.name, from, person.role, text, "email", at, mid);
        else addMessage(p, person, text, "email", at, mid);
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
  insert("Messages", { id: id, project_id: p.id, at: at || now(), author: name, author_email: email, role: role, kind: "answer", text: text, question_id: q.id, status: "", via: via });
  update("Messages", "id", q.id, { status: "answered" });
  if (role === "client" || role === "architect") notifyJesus(email, name + " answered: " + q.text.slice(0, 60), "<p><b>Question:</b> " + esc(q.text) + "</p><p><b>Answer:</b> " + nl2br(esc(text)) + "</p><p style='color:#666'>" + esc(p.name) + " · via " + via + "</p>" + button("Open the portal"));
  return id;
}
function addMessage(p, person, text, via, at, id) {
  id = id || newId("m");
  insert("Messages", { id: id, project_id: p.id, at: at || now(), author: person.name, author_email: person.email, role: person.role, kind: "message", text: text, question_id: "", status: "", via: via });
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

function summary(p, inv, msgs, tl) {
  var mine = function (list) { return list.filter(function (r) { return r.project_id === p.id; }); };
  var invs = mine(inv).filter(function (i) { return i.status !== "void" && i.status !== "draft"; });
  var last = mine(tl).slice(-1)[0];
  return Object.assign(projectOut(p), {
    balance: invs.filter(function (i) { return i.status !== "paid"; }).reduce(function (a, i) { return a + num(i.amount) - num(i.retainage); }, 0),
    openQuestions: mine(msgs).filter(function (m) { return m.kind === "question" && m.status === "open"; }).length,
    lastUpdate: last ? last.at : ""
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
function sendMail(to, subject, html) {
  GmailApp.sendEmail(to, subject, html.replace(/<[^>]+>/g, " "), {
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
function tableSheet(t) {
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
  return sh;
}
function rows(t) {
  var sh = tableSheet(t), v = sh.getDataRange().getValues(), h = TABLES[t], outR = [];
  for (var i = 1; i < v.length; i++) { var o = {}; h.forEach(function (k, c) { o[k] = v[i][c] == null ? "" : cell(v[i][c]); }); outR.push(o); }
  return outR;
}
function insert(t, obj) {
  var sh = tableSheet(t), h = TABLES[t], r = sh.getLastRow() + 1;
  sh.getRange(r, 1, 1, h.length).setNumberFormat("@").setValues([h.map(function (k) { return safe(obj[k] == null ? "" : String(obj[k])); })]);
}
function update(t, keyCol, keyVal, patch) {
  var sh = tableSheet(t), v = sh.getDataRange().getValues(), h = TABLES[t], kc = h.indexOf(keyCol);
  for (var i = 1; i < v.length; i++) if (cell(v[i][kc]) === String(keyVal)) {
    Object.keys(patch).forEach(function (k) { var c = h.indexOf(k); if (c > -1) sh.getRange(i + 1, c + 1).setNumberFormat("@").setValue(safe(String(patch[k] == null ? "" : patch[k]))); });
    return true;
  }
  return false;
}
function removeWhere(t, test) {
  var sh = tableSheet(t), all = rows(t);
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
