/**
 * Blue Sierra client portal · backend for bluesierracorp.com/portal
 *
 * Lives in its own private Google Sheet ("Blue Sierra Portal"): Extensions → Apps Script → paste this as Portal.gs.
 * Run setup() once, then deploy as a Web app (Execute as: Me · Who has access: Anyone).
 *
 * - Login: the person types their email and gets a 6-digit code by email (no passwords, no per-client accounts).
 *   Only emails listed in the "People" tab can get a code. Sessions are stored hashed.
 * - Every request is a POST with Content-Type text/plain and a JSON body. Tokens never go in URLs.
 * - Photos and invoice PDFs go to a Drive folder per project.
 * - Questions are emailed to the client from Jesús's Gmail; replies by email come back into the portal
 *   (checkEmailReplies runs every 10 minutes).
 * - Clients only ever see projects they are listed on. Staff see all projects. Only admins manage staff.
 */

var CONFIG = {
  COMPANY: "Blue Sierra Construction",
  PORTAL_URL: "https://www.bluesierracorp.com/portal",
  NOTIFY_EMAIL: "jtoto@bluesierracorp.com",   // where client messages and answers are announced
  TZ: "America/Los_Angeles",
  ROOT_FOLDER: "Blue Sierra Portal",
  SESSION_DAYS: 30,
  CODE_MINUTES: 15,
  PHASES: ["Design", "Permits", "Pre-construction", "Construction", "Punch list", "Complete"],
  TAG: "BSP" // subject tag: [BSP-<projectId>-<messageId>]
};

var TABLES = {
  Projects: ["id", "name", "client_name", "address", "city", "phase", "progress", "start_date", "target_date", "summary", "cover_file_id", "folder_id", "status", "created_at"],
  People: ["email", "name", "role", "project_ids", "active", "created_at"],
  Sessions: ["token_hash", "email", "expires_at", "created_at"],
  Timeline: ["id", "project_id", "at", "author", "text", "photo_ids", "emailed"],
  Photos: ["id", "project_id", "file_id", "caption", "at", "author", "update_id"],
  Messages: ["id", "project_id", "at", "author", "author_email", "role", "kind", "text", "question_id", "status", "via"],
  Invoices: ["id", "project_id", "number", "title", "amount", "issued", "due", "status", "paid_date", "pdf_file_id", "pay_url", "notes"],
  Checklist: ["id", "project_id", "phase", "item", "owner", "due", "done", "done_by", "done_at", "sort"],
  EmailImports: ["gmail_id", "project_id", "message_id", "at"]
};

/* ============================ web app ============================ */

function doGet() { return out({ ok: false, error: "Use POST." }); }

function doPost(e) {
  var res;
  try {
    var b = JSON.parse((e.postData && e.postData.contents) || "{}");
    var fn = PUBLIC[b.action];
    if (fn) res = fn(b);
    else {
      var me = auth(b.token);
      fn = ACTIONS[b.action];
      if (!fn) throw new Error("Unknown action.");
      var lock = LockService.getScriptLock(); lock.waitLock(20000);
      try { res = fn(me, b); } finally { lock.releaseLock(); }
    }
    res = res || {}; res.ok = true;
  } catch (err) { res = { ok: false, error: String(err.message || err) }; }
  return out(res);
}
function out(o) { return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON); }

/* ============================ login ============================ */

var PUBLIC = {
  requestCode: function (b) {
    var email = normEmail(b.email), cache = CacheService.getScriptCache();
    var tries = Number(cache.get("req:" + email) || 0);
    if (tries >= 3) throw new Error("Too many codes requested. Wait 15 minutes and try again.");
    cache.put("req:" + email, String(tries + 1), 900);
    var person = findPerson(email);
    if (person && isTrue(person.active)) {          // same answer either way, so emails can't be probed
      var code = String(Math.floor(100000 + Math.random() * 900000));
      cache.put("code:" + email, JSON.stringify({ h: sha(code), n: 0 }), CONFIG.CODE_MINUTES * 60);
      sendMail(email, "Your " + CONFIG.COMPANY + " portal code: " + code,
        "<p>Hi " + esc(first(person.name)) + ",</p><p>Your code to open the project portal is:</p>" +
        "<p style='font-size:28px;letter-spacing:6px;font-weight:600'>" + code + "</p>" +
        "<p>It works for " + CONFIG.CODE_MINUTES + " minutes. If you didn't ask for it, you can ignore this email.</p>");
    }
    return { sent: true };
  },
  verifyCode: function (b) {
    var email = normEmail(b.email), cache = CacheService.getScriptCache(), raw = cache.get("code:" + email);
    if (!raw) throw new Error("That code expired. Ask for a new one.");
    var c = JSON.parse(raw);
    if (c.n >= 5) { cache.remove("code:" + email); throw new Error("Too many tries. Ask for a new code."); }
    if (sha(String(b.code || "").replace(/\D/g, "")) !== c.h) { c.n++; cache.put("code:" + email, JSON.stringify(c), CONFIG.CODE_MINUTES * 60); throw new Error("That code isn't right."); }
    cache.remove("code:" + email);
    var person = findPerson(email);
    if (!person || !isTrue(person.active)) throw new Error("This email doesn't have access.");
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
function needStaff(me) { if (!isStaff(me)) throw new Error("Only the Blue Sierra team can do that."); }
function canSee(me, pid) { if (isStaff(me)) return true; return (me.projects || splitIds(me.project_ids)).indexOf(String(pid)) > -1; }
function needProject(me, pid) {
  var p = rows("Projects").filter(function (r) { return r.id === String(pid); })[0];
  if (!p || !canSee(me, pid)) throw new Error("Project not found.");
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
    var p = needProject(me, b.projectId), id = p.id;
    var by = function (t) { return rows(t).filter(function (r) { return r.project_id === id; }); };
    var data = {
      project: projectOut(p),
      timeline: by("Timeline").reverse(),
      photos: by("Photos").reverse().map(photoOut),
      messages: by("Messages"),
      invoices: by("Invoices").filter(function (i) { return isStaff(me) || (i.status !== "draft" && i.status !== "void"); }).map(invoiceOut),
      checklist: by("Checklist").sort(function (a, c) { return Number(a.sort || 0) - Number(c.sort || 0); }),
      phases: CONFIG.PHASES
    };
    if (isStaff(me)) data.people = rows("People").filter(function (x) { return isStaff(x) || splitIds(x.project_ids).indexOf(id) > -1; }).map(function (x) { return { email: x.email, name: x.name, role: x.role, active: isTrue(x.active) }; });
    return data;
  },

  saveProject: function (me, b) {
    needStaff(me);
    var f = b.project || {}, fields = ["name", "client_name", "address", "city", "phase", "progress", "start_date", "target_date", "summary", "status"];
    if (!f.name) throw new Error("The project needs a name.");
    if (f.phase && CONFIG.PHASES.indexOf(f.phase) < 0) throw new Error("Unknown phase.");
    var patch = {}; fields.forEach(function (k) { if (f[k] != null) patch[k] = clean(f[k], 1000); });
    if (patch.progress != null) patch.progress = String(Math.max(0, Math.min(100, Number(patch.progress) || 0)));
    if (f.id) { needProject(me, f.id); update("Projects", "id", f.id, patch); return { project: projectOut(findBy("Projects", "id", f.id)) }; }
    var id = newId();
    var folder = rootFolder().createFolder(patch.name + " · " + id);
    patch.id = id; patch.folder_id = folder.getId(); patch.created_at = now(); patch.status = patch.status || "active";
    patch.phase = patch.phase || CONFIG.PHASES[0]; patch.progress = patch.progress || "0";
    insert("Projects", patch);
    return { project: projectOut(findBy("Projects", "id", id)) };
  },

  setCover: function (me, b) { needStaff(me); needProject(me, b.projectId); update("Projects", "id", b.projectId, { cover_file_id: String(b.fileId || "") }); return {}; },

  addPerson: function (me, b) {
    needStaff(me);
    var email = normEmail(b.email), role = b.role === "staff" ? "staff" : "client";
    if (role === "staff" && me.role !== "admin") throw new Error("Only Jesús can add team members.");
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) throw new Error("That email doesn't look right.");
    var p = b.projectId ? needProject(me, b.projectId) : null;
    var existing = findPerson(email);
    if (existing) {
      var ids = splitIds(existing.project_ids); if (p && ids.indexOf(p.id) < 0) ids.push(p.id);
      update("People", "email", email, { project_ids: ids.join(","), active: "yes", name: existing.name || clean(b.name, 120) });
    } else {
      insert("People", { email: email, name: clean(b.name, 120) || email, role: role, project_ids: p ? p.id : "", active: "yes", created_at: now() });
    }
    if (b.invite && p) sendMail(email, "Your project portal for " + p.name,
      "<p>Hi " + esc(first(b.name || "")) + ",</p><p>You can follow <b>" + esc(p.name) + "</b> in the " + CONFIG.COMPANY + " portal: photos, updates, questions, invoices and the checklist, all in one place.</p>" +
      button("Open the portal") + "<p>To log in, type this email address and we'll send you a 6-digit code.</p>");
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
    var uid = newId(), ids = savePhotos(me, p, b.photos || [], "", uid);
    insert("Timeline", { id: uid, project_id: p.id, at: now(), author: me.name, text: text, photo_ids: ids.join(","), emailed: b.notify ? "yes" : "" });
    if (b.notify) emailClients(p, "Project update: " + p.name, "<p>" + nl2br(esc(text)) + "</p>" + (ids.length ? "<p>" + ids.length + " new photo" + (ids.length > 1 ? "s" : "") + " in the portal.</p>" : "") + button("See the update"));
    return {};
  },

  uploadPhotos: function (me, b) { needStaff(me); var p = needProject(me, b.projectId); var ids = savePhotos(me, p, b.photos || [], clean(b.caption, 300), ""); return { count: ids.length }; },
  deletePhoto: function (me, b) {
    needStaff(me); var ph = findBy("Photos", "id", b.photoId); if (!ph) return {}; needProject(me, ph.project_id);
    try { DriveApp.getFileById(ph.file_id).setTrashed(true); } catch (e) {}
    removeWhere("Photos", function (r) { return r.id === ph.id; }); return {};
  },

  sendMessage: function (me, b) {
    var p = needProject(me, b.projectId), text = clean(b.text, 5000); if (!text) throw new Error("Write a message.");
    var kind = isStaff(me) && b.kind === "question" ? "question" : "message";
    var id = newId();
    insert("Messages", { id: id, project_id: p.id, at: now(), author: me.name, author_email: me.email, role: me.role, kind: kind, text: text, question_id: "", status: kind === "question" ? "open" : "", via: "portal" });
    if (isStaff(me)) {
      var subj = (kind === "question" ? "Question about " : "Message about ") + p.name + " " + tag(p.id, id);
      emailClients(p, subj, "<p>" + nl2br(esc(text)) + "</p><p style='color:#666'>— " + esc(me.name) + ", " + CONFIG.COMPANY + "</p>" +
        (kind === "question" ? "<p><b>You can answer by replying to this email</b>, or in the portal.</p>" : "<p>You can reply to this email or in the portal.</p>") + button("Open the portal"));
    } else {
      sendMail(CONFIG.NOTIFY_EMAIL, "New message from " + me.name + " · " + p.name, "<p>" + nl2br(esc(text)) + "</p>" + button("Open the portal"));
    }
    return {};
  },

  answerQuestion: function (me, b) {
    var p = needProject(me, b.projectId), q = findBy("Messages", "id", b.questionId);
    if (!q || q.project_id !== p.id || q.kind !== "question") throw new Error("Question not found.");
    var text = clean(b.text, 5000); if (!text) throw new Error("Write an answer.");
    addAnswer(p, q, me.name, me.email, me.role, text, "portal");
    return {};
  },

  closeQuestion: function (me, b) { needStaff(me); var q = findBy("Messages", "id", b.questionId); if (q) { needProject(me, q.project_id); update("Messages", "id", q.id, { status: "answered" }); } return {}; },

  saveInvoice: function (me, b) {
    needStaff(me); var p = needProject(me, b.projectId), f = b.invoice || {};
    var patch = {
      number: clean(f.number, 40), title: clean(f.title, 200), amount: String(Math.round((Number(f.amount) || 0) * 100) / 100),
      issued: dateOrEmpty(f.issued), due: dateOrEmpty(f.due), status: ["draft", "sent", "paid", "void"].indexOf(f.status) > -1 ? f.status : "sent",
      paid_date: f.status === "paid" ? (dateOrEmpty(f.paid_date) || today()) : "", pay_url: /^https:\/\//.test(f.pay_url || "") ? String(f.pay_url).slice(0, 500) : "", notes: clean(f.notes, 1000)
    };
    if (f.pdf && f.pdf.data) patch.pdf_file_id = saveFile(p, f.pdf, "Invoice " + (patch.number || "") + ".pdf", false);
    var id = f.id;
    if (id) { var inv = findBy("Invoices", "id", id); if (!inv || inv.project_id !== p.id) throw new Error("Invoice not found."); update("Invoices", "id", id, patch); }
    else { id = newId(); patch.id = id; patch.project_id = p.id; insert("Invoices", patch); }
    if (b.notify && patch.status === "sent") emailClients(p, "Invoice " + patch.number + " · " + p.name,
      "<p>A new invoice is ready in your portal: <b>" + esc(patch.title || patch.number) + "</b>, $" + money(patch.amount) + (patch.due ? ", due " + esc(patch.due) : "") + ".</p>" + button("See the invoice"));
    return { id: id };
  },

  saveChecklistItem: function (me, b) {
    needStaff(me); var p = needProject(me, b.projectId), f = b.item || {};
    var patch = { phase: CONFIG.PHASES.indexOf(f.phase) > -1 ? f.phase : CONFIG.PHASES[0], item: clean(f.item, 300), owner: f.owner === "client" ? "client" : "blue sierra", due: dateOrEmpty(f.due) };
    if (!patch.item) throw new Error("Write the checklist item.");
    if (f.id) update("Checklist", "id", f.id, patch);
    else { patch.id = newId(); patch.project_id = p.id; patch.done = ""; patch.sort = String(Date.now()); insert("Checklist", patch); }
    return {};
  },
  deleteChecklistItem: function (me, b) { needStaff(me); var it = findBy("Checklist", "id", b.itemId); if (it) { needProject(me, it.project_id); removeWhere("Checklist", function (r) { return r.id === it.id; }); } return {}; },
  toggleChecklist: function (me, b) {
    var it = findBy("Checklist", "id", b.itemId); if (!it) throw new Error("Item not found.");
    var p = needProject(me, it.project_id);
    if (!isStaff(me) && it.owner !== "client") throw new Error("Blue Sierra checks off that one.");
    var done = !isTrue(it.done);
    update("Checklist", "id", it.id, { done: done ? "yes" : "", done_by: done ? me.name : "", done_at: done ? now() : "" });
    if (done && !isStaff(me)) sendMail(CONFIG.NOTIFY_EMAIL, me.name + " checked off: " + it.item, "<p>" + esc(p.name) + "</p>" + button("Open the portal"));
    return {};
  }
};

/* ============================ email replies ============================ */

/** Runs every 10 minutes (trigger from setup). Brings email replies to portal messages back into the portal. */
function checkEmailReplies() {
  var lock = LockService.getScriptLock(); if (!lock.tryLock(5000)) return;
  try {
    var done = {}; rows("EmailImports").forEach(function (r) { done[r.gmail_id] = 1; });
    var me = Session.getEffectiveUser().getEmail().toLowerCase();
    var threads = GmailApp.search('subject:"[' + CONFIG.TAG + '-" newer_than:14d', 0, 50);
    threads.forEach(function (th) {
      var m = th.getFirstMessageSubject().match(new RegExp("\\[" + CONFIG.TAG + "-([a-z0-9]+)-([a-z0-9]+)\\]"));
      if (!m) return;
      var p = findBy("Projects", "id", m[1]), q = findBy("Messages", "id", m[2]); if (!p || !q) return;
      th.getMessages().forEach(function (msg) {
        var gid = msg.getId(); if (done[gid]) return;
        var from = normEmail((msg.getFrom().match(/<([^>]+)>/) || [0, msg.getFrom()])[1]);
        if (from === me || from === normEmail(CONFIG.NOTIFY_EMAIL)) { insert("EmailImports", { gmail_id: gid, project_id: p.id, message_id: "", at: now() }); return; }
        var person = findPerson(from);
        if (!person || !isTrue(person.active) || splitIds(person.project_ids).indexOf(p.id) < 0) return; // only people on this project
        var text = replyText(msg.getPlainBody()); if (!text) return;
        var mid = q.kind === "question" ? addAnswer(p, q, person.name, from, person.role, text, "email") : addMessage(p, person, text, "email");
        insert("EmailImports", { gmail_id: gid, project_id: p.id, message_id: mid, at: now() });
      });
    });
  } finally { lock.releaseLock(); }
}

function replyText(body) {
  var lines = String(body || "").split(/\r?\n/), outL = [];
  for (var i = 0; i < lines.length; i++) {
    var l = lines[i];
    if (/^On .+wrote:\s*$/.test(l) || /^El .+escribió:\s*$/.test(l) || /^-{2,}\s*Original Message/i.test(l) || /^From: /.test(l) || /^>/.test(l)) break;
    outL.push(l);
  }
  return outL.join("\n").replace(/\n{3,}/g, "\n\n").trim().slice(0, 5000);
}

function addAnswer(p, q, name, email, role, text, via) {
  var id = newId();
  insert("Messages", { id: id, project_id: p.id, at: now(), author: name, author_email: email, role: role, kind: "answer", text: text, question_id: q.id, status: "", via: via });
  update("Messages", "id", q.id, { status: "answered" });
  if (role === "client") sendMail(CONFIG.NOTIFY_EMAIL, name + " answered: " + q.text.slice(0, 60), "<p><b>Question:</b> " + esc(q.text) + "</p><p><b>Answer:</b> " + nl2br(esc(text)) + "</p><p style='color:#666'>" + esc(p.name) + " · via " + via + "</p>" + button("Open the portal"));
  return id;
}
function addMessage(p, person, text, via) {
  var id = newId();
  insert("Messages", { id: id, project_id: p.id, at: now(), author: person.name, author_email: person.email, role: person.role, kind: "message", text: text, question_id: "", status: "", via: via });
  sendMail(CONFIG.NOTIFY_EMAIL, "New message from " + person.name + " · " + p.name, "<p>" + nl2br(esc(text)) + "</p>" + button("Open the portal"));
  return id;
}

/* ============================ setup ============================ */

/** Run once. Creates the tabs, the Drive folder, Jesús as admin and the 10-minute email check. */
function setup() {
  Object.keys(TABLES).forEach(function (t) { var sh = sheet(t); if (sh.getLastRow() === 0) { sh.appendRow(TABLES[t]); sh.setFrozenRows(1); } });
  rootFolder();
  if (!findPerson(CONFIG.NOTIFY_EMAIL)) insert("People", { email: normEmail(CONFIG.NOTIFY_EMAIL), name: "Jesús Toto", role: "admin", project_ids: "", active: "yes", created_at: now() });
  ScriptApp.getProjectTriggers().forEach(function (t) { if (t.getHandlerFunction() === "checkEmailReplies") ScriptApp.deleteTrigger(t); });
  ScriptApp.newTrigger("checkEmailReplies").timeBased().everyMinutes(10).create();
  Logger.log("Ready. Deploy as a Web app and paste its URL in the Webflow page /portal.");
}
/** Add a project manager (staff) from the editor: addStaff("Name", "email@…") */
function addStaff(name, email) { insert("People", { email: normEmail(email), name: name, role: "staff", project_ids: "", active: "yes", created_at: now() }); }

/* ============================ files ============================ */

function savePhotos(me, p, list, caption, updateId) {
  if (list.length > 12) throw new Error("Up to 12 photos at a time.");
  return list.map(function (ph) {
    var fid = saveFile(p, ph, ph.name || "photo.jpg", true), id = newId();
    insert("Photos", { id: id, project_id: p.id, file_id: fid, caption: clean(ph.caption || caption, 300), at: now(), author: me.name, update_id: updateId });
    if (!p.cover_file_id) { update("Projects", "id", p.id, { cover_file_id: fid }); p.cover_file_id = fid; }
    return id;
  });
}
function saveFile(p, f, name, image) {
  var mime = String(f.mime || "");
  if (image ? !/^image\/(jpeg|png|webp|heic)$/.test(mime) : mime !== "application/pdf") throw new Error(image ? "Photos must be JPG, PNG or WebP." : "Invoices must be PDF.");
  var bytes = Utilities.base64Decode(String(f.data).replace(/^data:[^,]+,/, ""));
  if (bytes.length > 15 * 1024 * 1024) throw new Error("That file is too big (15 MB max).");
  var file = DriveApp.getFolderById(p.folder_id).createFile(Utilities.newBlob(bytes, mime, String(name).slice(0, 120)));
  // Viewable by link so the portal can show it; the ID is long and unguessable and only appears inside the portal.
  try { file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW); } catch (e) { /* Workspace policy may block link sharing; see INSTALAR.md */ }
  return file.getId();
}
function rootFolder() { var it = DriveApp.getFoldersByName(CONFIG.ROOT_FOLDER); return it.hasNext() ? it.next() : DriveApp.createFolder(CONFIG.ROOT_FOLDER); }

/* ============================ shaping ============================ */

function summary(p, inv, msgs, tl) {
  var mine = function (list) { return list.filter(function (r) { return r.project_id === p.id; }); };
  var invs = mine(inv).filter(function (i) { return i.status !== "void" && i.status !== "draft"; });
  var last = mine(tl).slice(-1)[0];
  return Object.assign(projectOut(p), {
    balance: invs.filter(function (i) { return i.status !== "paid"; }).reduce(function (a, i) { return a + Number(i.amount || 0); }, 0),
    openQuestions: mine(msgs).filter(function (m) { return m.kind === "question" && m.status === "open"; }).length,
    lastUpdate: last ? last.at : ""
  });
}
function projectOut(p) {
  return { id: p.id, name: p.name, client_name: p.client_name, address: p.address, city: p.city, phase: p.phase, progress: Number(p.progress || 0),
    start_date: p.start_date, target_date: p.target_date, summary: p.summary, status: p.status, cover: p.cover_file_id ? img(p.cover_file_id, 1200) : "" };
}
function photoOut(ph) { return { id: ph.id, file_id: ph.file_id, thumb: img(ph.file_id, 600), full: img(ph.file_id, 2000), caption: ph.caption, at: ph.at, author: ph.author, update_id: ph.update_id }; }
function invoiceOut(i) {
  var st = i.status; if (st === "sent" && i.due && i.due < today()) st = "overdue";
  return { id: i.id, number: i.number, title: i.title, amount: Number(i.amount || 0), issued: i.issued, due: i.due, status: st, paid_date: i.paid_date,
    pdf: i.pdf_file_id ? "https://drive.google.com/file/d/" + i.pdf_file_id + "/view" : "", pay_url: i.pay_url, notes: i.notes };
}
function img(id, w) { return "https://drive.google.com/thumbnail?id=" + encodeURIComponent(id) + "&sz=w" + w; }

/* ============================ email ============================ */

function emailClients(p, subject, html) {
  rows("People").filter(function (x) { return x.role === "client" && isTrue(x.active) && splitIds(x.project_ids).indexOf(p.id) > -1; })
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

function sheet(name) { var ss = SpreadsheetApp.getActive(); return ss.getSheetByName(name) || ss.insertSheet(name); }
function rows(t) {
  var v = sheet(t).getDataRange().getValues(), h = TABLES[t], outR = [];
  for (var i = 1; i < v.length; i++) { var o = {}; h.forEach(function (k, c) { o[k] = cell(v[i][c]); }); outR.push(o); }
  return outR;
}
function insert(t, obj) { sheet(t).appendRow(TABLES[t].map(function (k) { return safe(obj[k] == null ? "" : obj[k]); })); }
function update(t, keyCol, keyVal, patch) {
  var sh = sheet(t), v = sh.getDataRange().getValues(), h = TABLES[t], kc = h.indexOf(keyCol);
  for (var i = 1; i < v.length; i++) if (cell(v[i][kc]) === String(keyVal)) {
    Object.keys(patch).forEach(function (k) { var c = h.indexOf(k); if (c > -1) sh.getRange(i + 1, c + 1).setValue(safe(patch[k])); });
    return true;
  }
  return false;
}
function removeWhere(t, test) {
  var sh = sheet(t), all = rows(t);
  for (var i = all.length - 1; i >= 0; i--) if (test(all[i])) sh.deleteRow(i + 2);
}
function findBy(t, col, val) { return rows(t).filter(function (r) { return r[col] === String(val); })[0] || null; }
function findPerson(email) { return findBy("People", "email", normEmail(email)); }

/* ============================ helpers ============================ */

function newId() { return Utilities.getUuid().replace(/-/g, "").slice(0, 10); }
function sha(s) { return Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, String(s)).map(function (b) { return ((b + 256) % 256).toString(16).padStart(2, "0"); }).join(""); }
function now() { return Utilities.formatDate(new Date(), CONFIG.TZ, "yyyy-MM-dd HH:mm"); }
function today() { return Utilities.formatDate(new Date(), CONFIG.TZ, "yyyy-MM-dd"); }
function cell(v) { if (!(v instanceof Date)) return String(v); var hm = Utilities.formatDate(v, CONFIG.TZ, "HH:mm"); return Utilities.formatDate(v, CONFIG.TZ, "yyyy-MM-dd") + (hm !== "00:00" ? " " + hm : ""); }
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
