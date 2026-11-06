/* Blue Sierra client portal — PREVIEW backend only. Never load this on the live site.
   It imitates apps-script/Portal.gs (same actions, same permission rules) with fictional sample data kept in this browser.
   Logins: jesus@example.com (admin), client@example.com (client) · code 123456. */
(function () {
  "use strict";
  var KEY = "bsp-mock-db";
  var PHASES = ["Design", "Permits", "Pre-construction", "Construction", "Punch list", "Complete"];

  function svgPhoto(label, a, b) {
    var svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 600"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="' + a + '"/><stop offset="1" stop-color="' + b + '"/></linearGradient></defs>' +
      '<rect width="800" height="600" fill="url(#g)"/><path d="M0 430 L220 300 L380 390 L560 250 L800 380 L800 600 L0 600Z" fill="#000" opacity=".18"/>' +
      '<text x="40" y="560" font-family="Arial" font-size="34" fill="#fff" opacity=".85">' + label + "</text></svg>";
    return "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svg);
  }
  function seed() {
    var ph = function (id, label, a, b, cap, at, upd) { return { id: id, project_id: "p1", file_id: "f-" + id, src: svgPhoto(label, a, b), caption: cap, at: at, author: "Jesús Toto", update_id: upd || "" }; };
    return {
      projects: [
        { id: "p1", name: "Hillside Residence", client_name: "Sample Client", address: "123 Example Lane", city: "Los Altos Hills", phase: "Construction", progress: "55", start_date: "2026-08-18", target_date: "2027-02-26",
          summary: "Full site package: grading, drainage, retaining walls, pool deck and planting.", cover_file_id: "f-ph1", status: "active", created_at: "2026-08-01 09:00" },
        { id: "p2", name: "Garden Courtyard", client_name: "Second Client", address: "456 Sample Ave", city: "Menlo Park", phase: "Design", progress: "15", start_date: "2026-10-20", target_date: "2027-05-14",
          summary: "Courtyard redesign with new paving, lighting and drought-tolerant planting.", cover_file_id: "", status: "active", created_at: "2026-10-15 10:00" }
      ],
      people: [
        { email: "jesus@example.com", name: "Jesús Toto", role: "admin", project_ids: "", active: "yes" },
        { email: "client@example.com", name: "Sample Client", role: "client", project_ids: "p1", active: "yes" },
        { email: "client2@example.com", name: "Second Client", role: "client", project_ids: "p2", active: "yes" }
      ],
      photos: [
        ph("ph1", "Sample photo · retaining wall", "#7d6a55", "#2f3a33", "Retaining wall, east side", "2026-11-03 15:20", "u3"),
        ph("ph2", "Sample photo · drainage", "#5d6b62", "#26302b", "Drain line before backfill", "2026-11-03 15:21", "u3"),
        ph("ph3", "Sample photo · pool deck", "#8a7f70", "#3b3a37", "Pool deck forms", "2026-10-27 11:05", "u2"),
        ph("ph4", "Sample photo · grading", "#9b8566", "#4a3f33", "Rough grading done", "2026-10-14 16:40", "u1"),
        ph("ph5", "Sample photo · site", "#6f7b6a", "#2c332c", "Site before work", "2026-08-18 08:30", "")
      ],
      timeline: [
        { id: "u1", project_id: "p1", at: "2026-10-14 16:45", author: "Jesús Toto", text: "Rough grading is finished and the site is ready for the drainage crew next week.", photo_ids: "ph4", emailed: "yes" },
        { id: "u2", project_id: "p1", at: "2026-10-27 11:10", author: "Jesús Toto", text: "Pool deck forms are set. Inspection is scheduled for Thursday morning.", photo_ids: "ph3", emailed: "yes" },
        { id: "u3", project_id: "p1", at: "2026-11-03 15:30", author: "Jesús Toto", text: "East retaining wall is poured and the main drain line is in. Next: backfill and the west wall footing.", photo_ids: "ph1,ph2", emailed: "yes" }
      ],
      messages: [
        { id: "m1", project_id: "p1", at: "2026-10-20 09:12", author: "Jesús Toto", author_email: "jesus@example.com", role: "admin", kind: "question", text: "Do you want the hose bibs on the north wall or by the side gate?", question_id: "", status: "answered", via: "portal" },
        { id: "m2", project_id: "p1", at: "2026-10-20 18:40", author: "Sample Client", author_email: "client@example.com", role: "client", kind: "answer", text: "By the side gate, please. Thanks!", question_id: "m1", status: "", via: "email" },
        { id: "m3", project_id: "p1", at: "2026-11-01 10:02", author: "Sample Client", author_email: "client@example.com", role: "client", kind: "message", text: "Will the crew need access to the backyard next Saturday?", question_id: "", status: "", via: "portal" },
        { id: "m4", project_id: "p1", at: "2026-11-01 12:30", author: "Jesús Toto", author_email: "jesus@example.com", role: "admin", kind: "message", text: "No weekend work. The crew is back Monday at 7:30.", question_id: "", status: "", via: "portal" },
        { id: "m5", project_id: "p1", at: "2026-11-04 08:15", author: "Jesús Toto", author_email: "jesus@example.com", role: "admin", kind: "question", text: "For the pool coping, do you prefer the honed limestone or the darker basalt sample we left on the patio?", question_id: "", status: "open", via: "portal" }
      ],
      invoices: [
        { id: "i1", project_id: "p1", number: "INV-1041", title: "Deposit", amount: "18500", issued: "2026-08-04", due: "2026-08-11", status: "paid", paid_date: "2026-08-09", pdf_file_id: "", pay_url: "", notes: "" },
        { id: "i2", project_id: "p1", number: "INV-1052", title: "Progress payment 1: grading and drainage", amount: "24750", issued: "2026-10-15", due: "2026-10-29", status: "paid", paid_date: "2026-10-24", pdf_file_id: "", pay_url: "", notes: "" },
        { id: "i3", project_id: "p1", number: "INV-1063", title: "Progress payment 2: walls and pool deck", amount: "31200", issued: "2026-11-04", due: "2026-11-18", status: "sent", paid_date: "", pdf_file_id: "", pay_url: "https://example.com/pay", notes: "" },
        { id: "i4", project_id: "p1", number: "INV-1070", title: "Progress payment 3 (draft)", amount: "22000", issued: "", due: "", status: "draft", paid_date: "", pdf_file_id: "", pay_url: "", notes: "" }
      ],
      checklist: [
        { id: "c1", project_id: "p1", phase: "Design", item: "Approve the planting plan", owner: "client", due: "", done: "yes", done_by: "Sample Client", done_at: "2026-08-02 19:10", sort: "1" },
        { id: "c2", project_id: "p1", phase: "Permits", item: "Grading permit approved", owner: "blue sierra", due: "", done: "yes", done_by: "Jesús Toto", done_at: "2026-08-14 10:00", sort: "2" },
        { id: "c3", project_id: "p1", phase: "Construction", item: "Choose the pool coping stone", owner: "client", due: "2026-11-12", done: "", done_by: "", done_at: "", sort: "3" },
        { id: "c4", project_id: "p1", phase: "Construction", item: "Confirm where the irrigation controller goes", owner: "client", due: "2026-11-15", done: "", done_by: "", done_at: "", sort: "4" },
        { id: "c5", project_id: "p1", phase: "Construction", item: "Pour the west retaining wall", owner: "blue sierra", due: "2026-11-20", done: "", done_by: "", done_at: "", sort: "5" },
        { id: "c6", project_id: "p1", phase: "Punch list", item: "Final walkthrough with the client", owner: "blue sierra", due: "", done: "", done_by: "", done_at: "", sort: "6" }
      ],
      sessions: {}, codes: {}, outbox: []
    };
  }
  function load() { try { var d = JSON.parse(localStorage.getItem(KEY)); if (d && d.projects) return d; } catch (e) {} return seed(); }
  function save(db) { try { localStorage.setItem(KEY, JSON.stringify(db)); } catch (e) { throw new Error("Preview storage is full. Clear it with BSP_MOCK.reset()."); } }
  function id() { return Math.random().toString(36).slice(2, 12); }
  function now() { var d = new Date(); return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0") + " " + String(d.getHours()).padStart(2, "0") + ":" + String(d.getMinutes()).padStart(2, "0"); }
  function today() { return now().slice(0, 10); }
  function clean(v, max) { return String(v == null ? "" : v).trim().slice(0, max); }
  function ids(s) { return String(s || "").split(",").filter(Boolean); }
  function isStaff(p) { return p.role === "admin" || p.role === "staff"; }
  function mail(db, to, subject) { db.outbox.push({ to: to, subject: subject, at: now() }); }

  var PUBLIC = {
    requestCode: function (db, b) { var e = clean(b.email, 200).toLowerCase(); if (db.people.some(function (p) { return p.email === e && p.active === "yes"; })) { db.codes[e] = "123456"; mail(db, e, "Your portal code"); } return { sent: true }; },
    verifyCode: function (db, b) {
      var e = clean(b.email, 200).toLowerCase();
      if (!db.codes[e]) throw new Error("That code expired. Ask for a new one.");
      if (String(b.code).replace(/\D/g, "") !== db.codes[e]) throw new Error("That code isn't right.");
      delete db.codes[e]; var t = id() + id() + id() + id() + id(); db.sessions[t] = e;
      var p = db.people.filter(function (x) { return x.email === e; })[0];
      return { token: t, me: meOut(p) };
    }
  };
  function meOut(p) { return { email: p.email, name: p.name, role: p.role, staff: isStaff(p), admin: p.role === "admin" }; }
  function auth(db, t) { var e = db.sessions[t]; var p = e && db.people.filter(function (x) { return x.email === e && x.active === "yes"; })[0]; if (!p) throw new Error("Please log in again."); return p; }
  function canSee(me, pid) { return isStaff(me) || ids(me.project_ids).indexOf(pid) > -1; }
  function needProject(db, me, pid) { var p = db.projects.filter(function (x) { return x.id === pid; })[0]; if (!p || !canSee(me, pid)) throw new Error("Project not found."); return p; }
  function needStaff(me) { if (!isStaff(me)) throw new Error("Only the Blue Sierra team can do that."); }
  function photoOut(ph) { return { id: ph.id, file_id: ph.file_id, thumb: ph.src, full: ph.src, caption: ph.caption, at: ph.at, author: ph.author, update_id: ph.update_id }; }
  function projOut(db, p) { var cover = db.photos.filter(function (x) { return x.file_id === p.cover_file_id; })[0]; return Object.assign({}, p, { progress: Number(p.progress || 0), cover: cover ? cover.src : "" }); }
  function invOut(i) { var st = i.status === "sent" && i.due && i.due < today() ? "overdue" : i.status; return Object.assign({}, i, { amount: Number(i.amount || 0), status: st, pdf: i.pdf_file_id ? "#preview-pdf" : "" }); }
  function emailClients(db, p, subject) { db.people.filter(function (x) { return x.role === "client" && x.active === "yes" && ids(x.project_ids).indexOf(p.id) > -1; }).forEach(function (x) { mail(db, x.email, subject); }); }
  function savePhotos(db, me, p, list, caption, upd) {
    if (list.length > 12) throw new Error("Up to 12 photos at a time.");
    return list.map(function (f) {
      if (!/^data:image\//.test(f.data || "")) throw new Error("Photos must be JPG, PNG or WebP.");
      var pid = id(); db.photos.push({ id: pid, project_id: p.id, file_id: "f-" + pid, src: f.data, caption: clean(f.caption || caption, 300), at: now(), author: me.name, update_id: upd });
      if (!p.cover_file_id) p.cover_file_id = "f-" + pid;
      return pid;
    });
  }

  var ACTIONS = {
    logout: function (db, me, b) { delete db.sessions[b.token]; return {}; },
    listProjects: function (db, me) {
      return { me: meOut(me), projects: db.projects.filter(function (p) { return canSee(me, p.id) && (isStaff(me) || p.status !== "archived"); }).map(function (p) {
        var inv = db.invoices.filter(function (i) { return i.project_id === p.id && i.status !== "draft" && i.status !== "void"; });
        var tl = db.timeline.filter(function (t) { return t.project_id === p.id; }).slice(-1)[0];
        return Object.assign(projOut(db, p), { balance: inv.filter(function (i) { return i.status !== "paid"; }).reduce(function (a, i) { return a + Number(i.amount); }, 0),
          openQuestions: db.messages.filter(function (m) { return m.project_id === p.id && m.kind === "question" && m.status === "open"; }).length, lastUpdate: tl ? tl.at : "" });
      }) };
    },
    getProject: function (db, me, b) {
      var p = needProject(db, me, b.projectId), by = function (list) { return list.filter(function (r) { return r.project_id === p.id; }); };
      var out = { project: projOut(db, p), timeline: by(db.timeline).slice().reverse(), photos: by(db.photos).slice().reverse().map(photoOut), messages: by(db.messages),
        invoices: by(db.invoices).filter(function (i) { return isStaff(me) || (i.status !== "draft" && i.status !== "void"); }).map(invOut),
        checklist: by(db.checklist).sort(function (a, c) { return Number(a.sort) - Number(c.sort); }), phases: PHASES };
      if (isStaff(me)) out.people = db.people.filter(function (x) { return isStaff(x) || ids(x.project_ids).indexOf(p.id) > -1; }).map(function (x) { return { email: x.email, name: x.name, role: x.role, active: x.active === "yes" }; });
      return out;
    },
    saveProject: function (db, me, b) {
      needStaff(me); var f = b.project || {}; if (!clean(f.name, 200)) throw new Error("The project needs a name.");
      var patch = {}; ["name", "client_name", "address", "city", "phase", "progress", "start_date", "target_date", "summary", "status"].forEach(function (k) { if (f[k] != null) patch[k] = clean(f[k], 1000); });
      if (f.id) { var p = needProject(db, me, f.id); Object.assign(p, patch); return { project: projOut(db, p) }; }
      var np = Object.assign({ id: id(), phase: PHASES[0], progress: "0", status: "active", cover_file_id: "", created_at: now() }, patch); db.projects.push(np); return { project: projOut(db, np) };
    },
    setCover: function (db, me, b) { needStaff(me); needProject(db, me, b.projectId).cover_file_id = b.fileId; return {}; },
    addPerson: function (db, me, b) {
      needStaff(me); var p = needProject(db, me, b.projectId), e = clean(b.email, 200).toLowerCase(), role = b.role === "staff" ? "staff" : "client";
      if (role === "staff" && me.role !== "admin") throw new Error("Only Jesús can add team members.");
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e)) throw new Error("That email doesn't look right.");
      var x = db.people.filter(function (q) { return q.email === e; })[0];
      if (x) { var l = ids(x.project_ids); if (l.indexOf(p.id) < 0) l.push(p.id); x.project_ids = l.join(","); x.active = "yes"; }
      else db.people.push({ email: e, name: clean(b.name, 120) || e, role: role, project_ids: p.id, active: "yes" });
      if (b.invite) mail(db, e, "Your project portal for " + p.name); return {};
    },
    removePerson: function (db, me, b) { needStaff(me); var x = db.people.filter(function (q) { return q.email === b.email; })[0]; if (x) x.project_ids = ids(x.project_ids).filter(function (i) { return i !== b.projectId; }).join(","); return {}; },
    postUpdate: function (db, me, b) {
      needStaff(me); var p = needProject(db, me, b.projectId), text = clean(b.text, 5000);
      if (!text && !(b.photos || []).length) throw new Error("Write something or add photos.");
      var u = id(), phs = savePhotos(db, me, p, b.photos || [], "", u);
      db.timeline.push({ id: u, project_id: p.id, at: now(), author: me.name, text: text, photo_ids: phs.join(","), emailed: b.notify ? "yes" : "" });
      if (b.notify) emailClients(db, p, "Project update: " + p.name); return {};
    },
    uploadPhotos: function (db, me, b) { needStaff(me); var p = needProject(db, me, b.projectId); return { count: savePhotos(db, me, p, b.photos || [], clean(b.caption, 300), "").length }; },
    deletePhoto: function (db, me, b) { needStaff(me); db.photos = db.photos.filter(function (x) { return x.id !== b.photoId; }); return {}; },
    sendMessage: function (db, me, b) {
      var p = needProject(db, me, b.projectId), text = clean(b.text, 5000); if (!text) throw new Error("Write a message.");
      var kind = isStaff(me) && b.kind === "question" ? "question" : "message";
      db.messages.push({ id: id(), project_id: p.id, at: now(), author: me.name, author_email: me.email, role: me.role, kind: kind, text: text, question_id: "", status: kind === "question" ? "open" : "", via: "portal" });
      if (isStaff(me)) emailClients(db, p, (kind === "question" ? "Question about " : "Message about ") + p.name); else mail(db, "jesus@example.com", "New message from " + me.name);
      return {};
    },
    answerQuestion: function (db, me, b) {
      var p = needProject(db, me, b.projectId), q = db.messages.filter(function (m) { return m.id === b.questionId && m.project_id === p.id && m.kind === "question"; })[0];
      if (!q) throw new Error("Question not found."); var text = clean(b.text, 5000); if (!text) throw new Error("Write an answer.");
      db.messages.push({ id: id(), project_id: p.id, at: now(), author: me.name, author_email: me.email, role: me.role, kind: "answer", text: text, question_id: q.id, status: "", via: "portal" });
      q.status = "answered"; if (me.role === "client") mail(db, "jesus@example.com", me.name + " answered a question"); return {};
    },
    closeQuestion: function (db, me, b) { needStaff(me); var q = db.messages.filter(function (m) { return m.id === b.questionId; })[0]; if (q) { needProject(db, me, q.project_id); q.status = "answered"; } return {}; },
    saveInvoice: function (db, me, b) {
      needStaff(me); var p = needProject(db, me, b.projectId), f = b.invoice || {};
      var patch = { number: clean(f.number, 40), title: clean(f.title, 200), amount: String(Math.round((Number(f.amount) || 0) * 100) / 100), issued: clean(f.issued, 10), due: clean(f.due, 10),
        status: ["draft", "sent", "paid", "void"].indexOf(f.status) > -1 ? f.status : "sent", pay_url: /^https:\/\//.test(f.pay_url || "") ? f.pay_url : "", notes: clean(f.notes, 1000) };
      patch.paid_date = patch.status === "paid" ? (clean(f.paid_date, 10) || today()) : "";
      if (f.pdf && f.pdf.data) { if (f.pdf.mime !== "application/pdf") throw new Error("Invoices must be PDF."); patch.pdf_file_id = "pdf-" + id(); }
      if (f.id) { var inv = db.invoices.filter(function (i) { return i.id === f.id && i.project_id === p.id; })[0]; if (!inv) throw new Error("Invoice not found."); Object.assign(inv, patch); }
      else db.invoices.push(Object.assign({ id: id(), project_id: p.id, pdf_file_id: "" }, patch));
      if (b.notify && patch.status === "sent") emailClients(db, p, "Invoice " + patch.number); return {};
    },
    saveChecklistItem: function (db, me, b) {
      needStaff(me); var p = needProject(db, me, b.projectId), f = b.item || {};
      var patch = { phase: PHASES.indexOf(f.phase) > -1 ? f.phase : PHASES[0], item: clean(f.item, 300), owner: f.owner === "client" ? "client" : "blue sierra", due: clean(f.due, 10) };
      if (!patch.item) throw new Error("Write the checklist item.");
      if (f.id) Object.assign(db.checklist.filter(function (c) { return c.id === f.id; })[0] || {}, patch);
      else db.checklist.push(Object.assign({ id: id(), project_id: p.id, done: "", done_by: "", done_at: "", sort: String(Date.now()) }, patch));
      return {};
    },
    deleteChecklistItem: function (db, me, b) { needStaff(me); db.checklist = db.checklist.filter(function (c) { return c.id !== b.itemId; }); return {}; },
    toggleChecklist: function (db, me, b) {
      var it = db.checklist.filter(function (c) { return c.id === b.itemId; })[0]; if (!it) throw new Error("Item not found.");
      needProject(db, me, it.project_id);
      if (!isStaff(me) && it.owner !== "client") throw new Error("Blue Sierra checks off that one.");
      var done = it.done !== "yes"; it.done = done ? "yes" : ""; it.done_by = done ? me.name : ""; it.done_at = done ? now() : "";
      if (done && !isStaff(me)) mail(db, "jesus@example.com", me.name + " checked off: " + it.item); return {};
    }
  };

  window.BSP_MOCK = function (b) {
    return new Promise(function (resolve) {
      setTimeout(function () {
        var db = load(), res;
        try {
          var fn = PUBLIC[b.action];
          if (fn) res = fn(db, b);
          else { var me = auth(db, b.token); fn = ACTIONS[b.action]; if (!fn) throw new Error("Unknown action."); res = fn(db, me, b); }
          save(db); res = res || {}; res.ok = true;
        } catch (e) { res = { ok: false, error: e.message }; }
        resolve(JSON.parse(JSON.stringify(res)));
      }, 120);
    });
  };
  window.BSP_MOCK.reset = function () { localStorage.removeItem(KEY); };
  window.BSP_MOCK.outbox = function () { return load().outbox; };
})();
