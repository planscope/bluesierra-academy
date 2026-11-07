/* Blue Sierra client portal — PREVIEW backend only. Never load this on the live site.
   It imitates apps-script/Portal.gs (same actions, same permission rules) with fictional sample data kept in this browser.
   Logins: jesus@example.com (admin), client@example.com (client), architect@example.com (architect) · code 123456. */
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
        { id: "p1", retainage_pct: "5", lat: "37.3797", lon: "-122.1375", name: "Hillside Residence", client_name: "Sample Client", address: "123 Example Lane", city: "Los Altos Hills", phase: "Construction", progress: "55", start_date: "2026-08-18", target_date: "2027-02-26",
          summary: "Full site package: grading, drainage, retaining walls, pool deck and planting.", cover_file_id: "f-ph1", status: "active", created_at: "2026-08-01 09:00" },
        { id: "p2", lat: "37.4530", lon: "-122.1817", name: "Garden Courtyard", client_name: "Second Client", address: "456 Sample Ave", city: "Menlo Park", phase: "Design", progress: "15", start_date: "2026-10-20", target_date: "2027-05-14",
          summary: "Courtyard redesign with new paving, lighting and drought-tolerant planting.", cover_file_id: "", status: "active", created_at: "2026-10-15 10:00" }
      ],
      people: [
        { email: "jesus@example.com", name: "Jesús Toto", role: "admin", project_ids: "", active: "yes" },
        { email: "client@example.com", name: "Sample Client", role: "client", project_ids: "p1", active: "yes" },
        { email: "client2@example.com", name: "Second Client", role: "client", project_ids: "p2", active: "yes" },
        { email: "architect@example.com", name: "Sample Architect", role: "architect", project_ids: "p1", active: "yes", avatar: "fx:cowboy-hat-face;t=0;bg=3" },
        { email: "maria@example.com", name: "Maria Team", role: "staff", project_ids: "", active: "yes", created_at: "2026-09-01 09:00", avatar: "fx:woman-office-worker;t=2;bg=2" },
        { email: "crew@example.com", name: "Carlos Crew", role: "crew", project_ids: "p1", active: "yes", created_at: "2026-10-01 07:00", avatar: "fx:man-construction-worker;t=4;bg=0" }
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
        { id: "i1", project_id: "p1", number: "INV-1041", title: "Deposit", amount: "18500", issued: "2026-08-04", due: "2026-08-11", status: "paid", paid_date: "2026-08-09", pdf_file_id: "", pay_url: "", notes: "", retainage: "0", lines: { cl1: 18500 } },
        { id: "i2", project_id: "p1", number: "INV-1052", title: "Progress payment 1: grading and drainage", amount: "24750", issued: "2026-10-15", due: "2026-10-29", status: "paid", paid_date: "2026-10-24", pdf_file_id: "", pay_url: "", notes: "", retainage: "1237.5", lines: { cl1: 20000, cl2: 4750 } },
        { id: "i3", project_id: "p1", number: "INV-1063", title: "Progress payment 2: walls and pool deck", amount: "31200", issued: "2026-11-04", due: "2026-11-18", status: "sent", paid_date: "", pdf_file_id: "", pay_url: "https://example.com/pay", notes: "", retainage: "1560", lines: { cl2: 10000, cl3: 21200 } },
        { id: "i4", project_id: "p1", number: "INV-1070", title: "Progress payment 3 (draft)", amount: "22000", issued: "", due: "", status: "draft", paid_date: "", pdf_file_id: "", pay_url: "", notes: "", retainage: "1100", lines: { cl3: 12000, cl4: 10000 } }
      ],
      checklist: [
        { id: "c1", project_id: "p1", phase: "Design", item: "Approve the planting plan", owner: "client", due: "", done: "yes", done_by: "Sample Client", done_at: "2026-08-02 19:10", sort: "1" },
        { id: "c2", project_id: "p1", phase: "Permits", item: "Grading permit approved", owner: "blue sierra", due: "", done: "yes", done_by: "Jesús Toto", done_at: "2026-08-14 10:00", sort: "2" },
        { id: "c3", project_id: "p1", phase: "Construction", item: "Choose the pool coping stone", owner: "client", due: "2026-11-12", done: "", done_by: "", done_at: "", sort: "3" },
        { id: "c4", project_id: "p1", phase: "Construction", item: "Confirm where the irrigation controller goes", owner: "client", due: "2026-11-15", done: "", done_by: "", done_at: "", sort: "4" },
        { id: "c5", project_id: "p1", phase: "Construction", item: "Pour the west retaining wall", owner: "blue sierra", due: "2026-11-20", done: "", done_by: "", done_at: "", sort: "5" },
        { id: "c6", project_id: "p1", phase: "Punch list", item: "Final walkthrough with the client", owner: "blue sierra", due: "", done: "", done_by: "", done_at: "", sort: "6" }
      ],
      schedule: [
        { id: "s1", project_id: "p1", kind: "task", title: "Design", start: "2026-08-18", end: "2026-09-04", phase: "Design", owner: "blue sierra", status: "done", notes: "", sort: "1" },
        { id: "s2", project_id: "p1", kind: "task", title: "Permits", start: "2026-08-25", end: "2026-09-25", phase: "Permits", owner: "blue sierra", status: "done", notes: "", sort: "2" },
        { id: "s3", project_id: "p1", kind: "task", title: "Grading and drainage", start: "2026-09-28", end: "2026-10-23", phase: "Construction", owner: "blue sierra", status: "done", notes: "", sort: "3" },
        { id: "s4", project_id: "p1", kind: "task", title: "Retaining walls", start: "2026-10-19", end: "2026-11-27", phase: "Construction", owner: "blue sierra", status: "in progress", notes: "", sort: "4" },
        { id: "s5", project_id: "p1", kind: "task", title: "Pool deck", start: "2026-11-09", end: "2026-12-18", phase: "Construction", owner: "blue sierra", status: "planned", notes: "Coping needs the client's pick first.", sort: "5" },
        { id: "s6", project_id: "p1", kind: "task", title: "Planting and irrigation", start: "2027-01-11", end: "2027-02-12", phase: "Construction", owner: "blue sierra", status: "planned", notes: "", sort: "6" },
        { id: "s7", project_id: "p1", kind: "task", title: "Punch list", start: "2027-02-15", end: "2027-02-26", phase: "Punch list", owner: "blue sierra", status: "planned", notes: "", sort: "7" },
        { id: "s8", project_id: "p1", kind: "inspection", title: "Pool deck forms inspection", start: "2026-11-06", end: "", phase: "Construction", owner: "blue sierra", status: "planned", notes: "City inspector, morning window.", sort: "8" },
        { id: "s9", project_id: "p1", kind: "decision", title: "Pick the pool coping stone", start: "2026-11-12", end: "", phase: "Construction", owner: "client", status: "planned", notes: "", sort: "9" },
        { id: "s10", project_id: "p1", kind: "meeting", title: "Site walk with the client", start: "2026-11-14", end: "", phase: "Construction", owner: "client", status: "planned", notes: "", sort: "10" },
        { id: "s11", project_id: "p1", kind: "inspection", title: "Wall rebar inspection", start: "2026-11-24", end: "", phase: "Construction", owner: "blue sierra", status: "planned", notes: "", sort: "11" },
        { id: "s12", project_id: "p1", kind: "milestone", title: "Pool deck complete", start: "2026-12-18", end: "", phase: "Construction", owner: "blue sierra", status: "planned", notes: "", sort: "12" },
        { id: "s13", project_id: "p1", kind: "inspection", title: "Final inspection", start: "2027-02-24", end: "", phase: "Punch list", owner: "blue sierra", status: "planned", notes: "", sort: "13" }
      ],
      chat: [
        { id: "t1", project_id: "p1", at: "2026-11-05 07:40", author: "Maria Team", author_email: "maria@example.com", role: "staff", kind: "message", text: "Concrete truck confirmed for Friday 7:30. @Jesús Toto can you meet the inspector at 7?", channel: "team", thread_id: "", reactions: { "👍": ["jesus@example.com"] } },
        { id: "t2", project_id: "p1", at: "2026-11-05 08:02", author: "Jesús Toto", author_email: "jesus@example.com", role: "admin", kind: "message", text: "Yes, I'll be there.", channel: "team", thread_id: "t1" },
        { id: "a1", project_id: "p1", at: "2026-11-04 16:10", author: "Sample Architect", author_email: "architect@example.com", role: "architect", kind: "message", text: "Please send the revised guardrail shop drawings before Friday so I can review them.", channel: "architect", thread_id: "" },
        { id: "a2", project_id: "p1", at: "2026-11-06 09:15", author: "Sample Architect", author_email: "architect@example.com", role: "architect", kind: "message", text: "Also, can you confirm the post spacing on sheet L3.22?", channel: "architect", thread_id: "a1" }
      ],
      reads: [], plans: [],
      events: [
        { id: "e1", project_id: "p1", at: "2026-11-03 17:40", author: "Jesús Toto", author_email: "jesus@example.com", role: "admin", kind: "event", text: "posted a project update with 2 photos\nWest retaining wall is formed and the drainage is in.", status: "update", channel: "client", thread_id: "", ref: "update:u3" },
        { id: "e2", project_id: "p1", at: "2026-11-04 09:05", author: "Jesús Toto", author_email: "jesus@example.com", role: "admin", kind: "event", text: "sent invoice INV-1063\nProgress payment 2: walls and pool deck · $29,640.00 due by 2026-11-18", status: "invoice", channel: "client", thread_id: "", ref: "invoice:i3" },
        { id: "e3", project_id: "p1", at: "2026-11-04 16:30", author: "Jesús Toto", author_email: "jesus@example.com", role: "admin", kind: "event", text: "proposed a change order CO-2\nUpgrade coping to basalt · +$2,450.00", status: "change", channel: "client", thread_id: "", ref: "co:cl7" }
      ],
      contractLines: [
        { id: "cl1", project_id: "p1", kind: "base", number: "1", title: "Site work and grading", amount: "48000", status: "approved", date: "", notes: "", sort: "1" },
        { id: "cl2", project_id: "p1", kind: "base", number: "2", title: "Drainage", amount: "18500", status: "approved", date: "", notes: "", sort: "2" },
        { id: "cl3", project_id: "p1", kind: "base", number: "3", title: "Retaining walls", amount: "62000", status: "approved", date: "", notes: "", sort: "3" },
        { id: "cl4", project_id: "p1", kind: "base", number: "4", title: "Pool deck", amount: "74000", status: "approved", date: "", notes: "", sort: "4" },
        { id: "cl5", project_id: "p1", kind: "base", number: "5", title: "Planting and irrigation", amount: "41500", status: "approved", date: "", notes: "", sort: "5" },
        { id: "cl6", project_id: "p1", kind: "change", number: "CO-1", title: "Add gas line to the fire pit", amount: "3800", status: "approved", date: "2026-10-30", notes: "", sort: "6" },
        { id: "cl7", project_id: "p1", kind: "change", number: "CO-2", title: "Upgrade coping to basalt", amount: "2450", status: "proposed", date: "2026-11-04", notes: "Waiting on the client's pick.", sort: "7" }
      ],
      sessions: {}, codes: {}, outbox: []
    };
  }
  function seedAll() { var d = seed(); d.messages = d.messages.concat(d.chat, d.events); delete d.chat; delete d.events; return d; }
  function load() { try { var d = JSON.parse(localStorage.getItem(KEY)); if (d && d.projects) { if (!d.plans) d.plans = []; if (!d.people.some(function (x) { return x.role === "crew"; })) d.people = d.people.concat(seed().people.filter(function (x) { return x.role === "crew"; })); if (!d.schedule) d.schedule = seed().schedule; if (!d.reads) { var s0 = seed(); d.reads = []; d.messages = d.messages.concat(s0.chat); d.people = s0.people; } if (!d.contractLines) { var sd = seed(); d.contractLines = sd.contractLines; d.invoices = sd.invoices; d.people = sd.people; d.projects.forEach(function (x) { if (x.id === "p1") x.retainage_pct = "5"; }); } return d; } } catch (e) {} return seedAll(); }
  function save(db) { try { localStorage.setItem(KEY, JSON.stringify(db)); } catch (e) { throw new Error("Preview storage is full. Clear it with BSP_MOCK.reset()."); } }
  function id() { return Math.random().toString(36).slice(2, 12); }
  function now() { var d = new Date(); return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0") + " " + String(d.getHours()).padStart(2, "0") + ":" + String(d.getMinutes()).padStart(2, "0"); }
  function today() { return now().slice(0, 10); }
  function clean(v, max) { return String(v == null ? "" : v).trim().slice(0, max); }
  function ids(s) { return String(s || "").split(",").filter(Boolean); }
  function isStaff(p) { return p.role === "admin" || p.role === "staff"; }
  function num(v) { var n = Number(v); return isFinite(n) ? n : 0; }
  function cents(v) { return Math.round(num(v) * 100) / 100; }
  function mail(db, to, subject) { db.outbox.push({ to: to, subject: subject, at: now() }); }

  var NO_ACCESS = "This email doesn't have access to the portal. Ask Blue Sierra to add you: info@bluesierracorp.com";
  function person(db, e) { return db.people.filter(function (p) { return p.email === e && p.active === "yes"; })[0]; }
  var PUBLIC = {
    checkEmail: function (db, b) { var e = clean(b.email, 200).toLowerCase(), p = person(db, e); if (!p) throw new Error(NO_ACCESS); return { hasPin: !!p.pin, name: p.name.split(" ")[0] }; },
    loginPin: function (db, b) {
      var e = clean(b.email, 200).toLowerCase(), p = person(db, e); if (!p) throw new Error(NO_ACCESS); if (!p.pin) throw new Error("You haven't set a PIN yet.");
      if (p.pinLock > Date.now()) throw new Error("Too many wrong PINs. Try again in " + Math.ceil((p.pinLock - Date.now()) / 60000) + " min, or use “Forgot PIN”.");
      if (String(b.pin) !== p.pin) { p.pinFails = (p.pinFails || 0) + 1; if (p.pinFails >= 5) { p.pinFails = 0; p.pinLock = Date.now() + 15 * 60000; throw new Error("Too many wrong PINs. It's locked for 15 minutes, or use “Forgot PIN”."); } throw new Error("That PIN isn't right. " + (5 - p.pinFails) + " tries left."); }
      p.pinFails = 0; var t = id() + id() + id() + id() + id(); db.sessions[t] = e; return { token: t, me: meOut(p) };
    },
    requestCode: function (db, b) { var e = clean(b.email, 200).toLowerCase(); if (!person(db, e)) throw new Error(NO_ACCESS); db.codes[e] = "123456"; mail(db, e, "Your portal code"); return { sent: true }; },
    verifyCode: function (db, b) {
      var e = clean(b.email, 200).toLowerCase();
      if (!db.codes[e]) throw new Error("That code expired. Ask for a new one.");
      if (String(b.code).replace(/\D/g, "") !== db.codes[e]) throw new Error("That code isn't right.");
      delete db.codes[e]; var t = id() + id() + id() + id() + id(); db.sessions[t] = e;
      var p = db.people.filter(function (x) { return x.email === e; })[0];
      p.pinLock = 0; return { token: t, me: meOut(p), needPin: !p.pin || !!b.resetPin };
    }
  };
  function meOut(p) { return { email: p.email, name: p.name, role: p.role, staff: isStaff(p), admin: p.role === "admin", crew: p.role === "crew", money: !p.preview && (p.role === "admin" || (p.role === "staff" && p.money === "yes")), key: pk(p.email), avatar: p.avatar || "", hasPin: !!p.pin, preview: p.preview || "" }; }
  function asg(c) { return String(c.assignee || "").split(",").filter(Boolean); }
  function isAsg(c, e) { return asg(c).indexOf(e) > -1; }
  function pk(e) { var h = 0; String(e).split("").forEach(function (c) { h = (h * 31 + c.charCodeAt(0)) >>> 0; }); return ("0000000000" + h.toString(16)).slice(-10); }
  function isTeam(p) { return isStaff(p) || p.role === "crew"; }
  function isDm(ch) { return /^dm:[0-9a-f]{10}-[0-9a-f]{10}$/.test(String(ch)); }
  function canRead(me, ch) { return isDm(ch) ? ch.indexOf(pk(me.email)) > -1 : chansFor(me).indexOf(ch) > -1; }
  function auth(db, t) { var e = db.sessions[t]; var p = e && db.people.filter(function (x) { return x.email === e && x.active === "yes"; })[0]; if (!p) throw new Error("Please log in again."); return p; }
  function canSee(me, pid) { return isStaff(me) || ids(me.project_ids).indexOf(pid) > -1; }
  function needProject(db, me, pid) { var p = db.projects.filter(function (x) { return x.id === pid; })[0]; if (!p || !canSee(me, pid) || (!isStaff(me) && p.status === "archived") || (p.status === "deleted" && me.role !== "admin")) throw new Error("Project not found."); return p; }
  function needStaff(me) { if (!isStaff(me)) throw new Error("Only the Blue Sierra team can do that."); }
  function photoOut(ph) { return { id: ph.id, file_id: ph.file_id, thumb: ph.src, full: ph.src, caption: ph.caption, at: ph.at, author: ph.author, update_id: ph.update_id }; }
  function projOut(db, p) { var cover = db.photos.filter(function (x) { return x.file_id === p.cover_file_id; })[0]; return Object.assign({}, p, { progress: Number(p.progress || 0), cover: cover ? cover.src : "", lat: p.lat ? +p.lat : null, lon: p.lon ? +p.lon : null }); }
  function invOut(i, staff) { var st = i.status === "sent" && i.due && i.due < today() ? "overdue" : i.status; var o = Object.assign({}, i, { amount: num(i.amount), retainage: num(i.retainage), lines: i.lines || {}, status: st, pdf: i.pdf_file_id ? "#preview-pdf" : "" }); if (!staff) delete o.notes; return o; }
  function emailClients(db, p, subject) { db.people.filter(function (x) { return (x.role === "client" || x.role === "architect") && x.active === "yes" && ids(x.project_ids).indexOf(p.id) > -1; }).forEach(function (x) { mail(db, x.email, subject); }); }
  function savePhotos(db, me, p, list, caption, upd) {
    if (list.length > 12) throw new Error("Up to 12 photos at a time.");
    return list.map(function (f) {
      if (!/^data:image\//.test(f.data || "")) throw new Error("Photos must be JPG, PNG or WebP.");
      var pid = id(); db.photos.push({ id: pid, project_id: p.id, file_id: "f-" + pid, src: f.data, caption: clean(f.caption || caption, 300), at: now(), author: me.name, update_id: upd });
      if (!p.cover_file_id) p.cover_file_id = "f-" + pid;
      return pid;
    });
  }

  var CHANNELS = ["client", "architect", "team", "crew"], RX = ["👍", "✅", "❤️", "👀", "🎉", "🙏"];
  function chansFor(me) { return isStaff(me) ? CHANNELS : me.role === "crew" ? ["crew"] : me.role === "architect" ? ["client", "architect"] : ["client"]; }
  function chOf(m) { return m.channel || "client"; }
  function readKey(me, pid, ch) { return me.email + "|" + pid + "|" + ch; }
  function readsOf(db, me) { var o = {}; db.reads.forEach(function (r) { if (r.email === me.email) o[r.project_id + "|" + r.channel] = r.at; }); return o; }
  function markR(db, me, pid, ch) { var r = db.reads.filter(function (x) { return x.email === me.email && x.project_id === pid && x.channel === ch; })[0]; if (r) r.at = now(); else db.reads.push({ email: me.email, project_id: pid, channel: ch, at: now() }); }
  function members(db, p) { return db.people.filter(function (x) { return x.active === "yes" && (isStaff(x) || ids(x.project_ids).indexOf(p.id) > -1); }); }
  function ment(text, name) { return !!name && String(text || "").toLowerCase().indexOf("@" + name.toLowerCase()) > -1; }
  function msgOut(db, m, me) {
    var names = {}; db.people.forEach(function (x) { names[x.email] = x.name; }); var r = m.reactions || {};
    var o = { id: m.id, at: m.at, author: m.author, role: m.role, kind: m.kind, text: m.text, question_id: m.question_id || "", status: m.status || "", via: m.via || "portal", channel: chOf(m), thread_id: m.thread_id || "", ref: m.ref || "",
      mine: m.author_email === me.email, mention: ment(m.text, me.name), akey: pk(m.author_email), avatar: (db.people.filter(function (x) { return x.email === m.author_email; })[0] || {}).avatar || "", files: (m.files || []).map(function (f) { return { id: f.id, name: f.name, mime: f.mime, thumb: f.mime !== "application/pdf" ? f.src : "", full: f.mime !== "application/pdf" ? f.src : "", url: f.mime === "application/pdf" ? "#preview-pdf" : f.src }; }),
      reactions: Object.keys(r).map(function (e) { return { e: e, n: r[e].length, mine: r[e].indexOf(me.email) > -1, who: r[e].map(function (x) { return names[x] || "Someone"; }) }; }) };
    if (isStaff(me)) o.author_email = m.author_email; return o;
  }
  function moneyOf(db, p) {
    var total = 0; db.contractLines.forEach(function (l) { if (l.project_id === p.id && (l.kind === "base" || l.status === "approved")) total += num(l.amount); });
    var o = { total: total, billed: 0, held: 0, paid: 0, waiting: 0, overdue: 0 };
    db.invoices.forEach(function (i) { if (i.project_id !== p.id || i.status === "void" || i.status === "draft") return; var a = num(i.amount), r = num(i.retainage); o.billed += a; o.held += r;
      if (i.status === "paid") o.paid += a - r; else { o.waiting += a - r; if (i.due && i.due < today()) o.overdue += a - r; } });
    o.left = total - o.billed; return o;
  }
  function ev(db, p, me, type, action, detail, ref, ch) { db.messages.push({ id: "e" + id(), project_id: p.id, at: now(), author: me.name, author_email: me.email, role: me.role, kind: "event", text: action + (detail ? "\n" + detail : ""), question_id: "", status: type, via: "portal", channel: ch || "client", thread_id: "", ref: ref }); }
  function usd(n) { return num(n).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }
  function needsOf(db, p) {
    var t = today(), lim = new Date(Date.now() + 14 * 864e5).toISOString().slice(0, 10);
    return { todos: db.checklist.filter(function (c) { return c.project_id === p.id && c.owner === "client" && c.done !== "yes"; }).map(function (c) { return { id: c.id, item: c.item, due: c.due }; }).slice(0, 8),
      dates: db.schedule.filter(function (x) { return x.project_id === p.id && x.kind !== "task" && x.status !== "done" && x.start >= t && x.start <= lim; }).sort(function (a, c) { return a.start < c.start ? -1 : 1; }).map(function (x) { return { id: x.id, kind: x.kind, title: x.title, start: x.start, owner: x.owner }; }).slice(0, 6),
      invoices: db.invoices.filter(function (i) { return i.project_id === p.id && i.status === "sent"; }).map(function (i) { return { id: i.id, number: i.number, due: i.due, amount: num(i.amount) - num(i.retainage), overdue: !!(i.due && i.due < t) }; }) };
  }
  function billed(db, lineId) { return db.invoices.some(function (i) { return i.status !== "void" && i.lines && i.lines[lineId]; }); }
  var ACTIONS = {
    logout: function (db, me, b) { delete db.sessions[b.token]; return {}; },
    listProjects: function (db, me) {
      return { me: meOut(me), projects: db.projects.filter(function (p) { return canSee(me, p.id) && (isStaff(me) || p.status !== "archived") && (p.status !== "deleted" || me.role === "admin"); }).map(function (p) {
        var inv = db.invoices.filter(function (i) { return i.project_id === p.id && i.status !== "draft" && i.status !== "void"; });
        var tl = db.timeline.filter(function (t) { return t.project_id === p.id; }).slice(-1)[0];
        return Object.assign(projOut(db, p), { balance: inv.filter(function (i) { return i.status !== "paid"; }).reduce(function (a, i) { return a + num(i.amount) - num(i.retainage); }, 0),
          openQuestions: db.messages.filter(function (m) { return m.project_id === p.id && m.kind === "question" && m.status === "open"; }).length, lastUpdate: tl ? tl.at : "",
          money: moneyOf(db, p), needs: needsOf(db, p), unread: (function () { var rd = readsOf(db, me), mine = chansFor(me); return db.messages.filter(function (m) { return m.project_id === p.id && canRead(me, chOf(m)) && m.author_email !== me.email && m.at > (rd[p.id + "|" + chOf(m)] || ""); }).length; })() });
      }) };
    },
    getProject: function (db, me, b) {
      var p = needProject(db, me, b.projectId), by = function (list) { return list.filter(function (r) { return r.project_id === p.id; }); };
      var out = { project: projOut(db, p), timeline: by(db.timeline).slice().reverse(), photos: by(db.photos).slice().reverse().map(photoOut),
        messages: by(db.messages).filter(function (m) { return canRead(me, chOf(m)); }).map(function (m) { return msgOut(db, m, me); }),
        reads: (function () { var rd = readsOf(db, me), o = {}; Object.keys(rd).forEach(function (k) { var i = k.indexOf("|"); if (k.slice(0, i) === p.id) o[k.slice(i + 1)] = rd[k]; }); return o; })(),
        members: members(db, p).map(function (x) { return { name: x.name, role: x.role, key: pk(x.email), avatar: x.avatar || "" }; }), channels: chansFor(me),
        plans: db.plans.filter(function (d) { return d.project_id === p.id && (isTeam(me) || d.visible === "all" || (d.visible === "architect" && me.role === "architect")) && (d.status === "ready" || isStaff(me)); })
          .map(function (d) { return Object.assign({}, d, { pdf: d.status === "ready" ? "#preview-pdf" : "", sheets: d.sheets.map(function (x) { return Object.assign({}, x, { thumb: x.src, full: x.src }); }) }); }),
        invoices: me.role === "crew" ? [] : by(db.invoices).filter(function (i) { return isStaff(me) || (i.status !== "draft" && i.status !== "void"); }).map(function (i) { return invOut(i, isStaff(me)); }),
        checklist: by(db.checklist).sort(function (a, c) { return Number(a.sort) - Number(c.sort); }), phases: PHASES,
        contract: { retainage_pct: num(p.retainage_pct), lines: by(db.contractLines).filter(function (l) { return me.role !== "crew" && (isStaff(me) || l.status !== "rejected"); })
          .sort(function (a, c) { return a.kind !== c.kind ? (a.kind === "base" ? -1 : 1) : Number(a.sort) - Number(c.sort); })
          .map(function (l) { var o = Object.assign({}, l, { amount: num(l.amount) }); if (!isStaff(me)) delete o.notes; return o; }) },
        schedule: by(db.schedule).sort(function (a, c) { return a.start < c.start ? -1 : a.start > c.start ? 1 : Number(a.sort) - Number(c.sort); }).map(function (x) { var o = Object.assign({}, x); if (!isTeam(me)) delete o.notes; return o; }) };
      if (isStaff(me)) out.people = db.people.filter(function (x) { return isStaff(x) || ids(x.project_ids).indexOf(p.id) > -1; }).map(function (x) { return { email: x.email, name: x.name, role: x.role, money: meOut(x).money, active: x.active === "yes", avatar: x.avatar || "" }; });
      return out;
    },
    saveProject: function (db, me, b) {
      needStaff(me); var f = b.project || {}; if (!clean(f.name, 200)) throw new Error("The project needs a name.");
      var patch = {}; ["name", "client_name", "address", "city", "phase", "progress", "start_date", "target_date", "summary", "status", "retainage_pct", "lat", "lon"].forEach(function (k) { if (f[k] != null) patch[k] = clean(f[k], 1000); });
      if (patch.retainage_pct != null) patch.retainage_pct = String(Math.max(0, Math.min(20, num(patch.retainage_pct))));
      if (f.id) { var p = needProject(db, me, f.id); Object.assign(p, patch); return { project: projOut(db, p) }; }
      var np = Object.assign({ id: id(), phase: PHASES[0], progress: "0", status: "active", cover_file_id: "", created_at: now() }, patch); db.projects.push(np); return { project: projOut(db, np) };
    },
    setCover: function (db, me, b) { needStaff(me); needProject(db, me, b.projectId).cover_file_id = b.fileId; return {}; },
    saveScheduleItem: function (db, me, b) {
      needStaff(me); var p = needProject(db, me, b.projectId), f = b.item || {}, dt = function (v) { return /^\d{4}-\d{2}-\d{2}$/.test(v || "") ? v : ""; };
      var patch = { kind: ["task", "inspection", "payment", "decision", "meeting", "milestone", "deadline"].indexOf(f.kind) > -1 ? f.kind : "task", title: clean(f.title, 200), start: dt(f.start), end: dt(f.end),
        phase: PHASES.indexOf(f.phase) > -1 ? f.phase : "", owner: f.owner === "client" ? "client" : "blue sierra", status: ["planned", "in progress", "done"].indexOf(f.status) > -1 ? f.status : "planned" };
      if (f.notes != null) patch.notes = clean(f.notes, 1000);
      if (!patch.title) throw new Error("Give it a name."); if (!patch.start) throw new Error("Pick a date.");
      if (patch.kind !== "task") patch.end = ""; if (patch.end && patch.end < patch.start) throw new Error("The end date is before the start date.");
      if (f.id) { var it = db.schedule.filter(function (x) { return x.id === f.id && x.project_id === p.id; })[0]; if (!it) throw new Error("Item not found."); Object.assign(it, patch); }
      else { var ns = Object.assign({ id: "s" + id(), project_id: p.id, sort: String(Date.now()), notes: "" }, patch); db.schedule.push(ns);
        if (ns.kind !== "task") ev(db, p, me, "date", "added a date to the schedule", ns.title + " · " + ns.start, "sched:" + ns.id); }
      return {};
    },
    deleteScheduleItem: function (db, me, b) { needStaff(me); db.schedule = db.schedule.filter(function (x) { return x.id !== b.itemId; }); return {}; },
    addStandardPhases: function (db, me, b) {
      needStaff(me); var p = needProject(db, me, b.projectId);
      if (!p.start_date || !p.target_date || p.target_date <= p.start_date) throw new Error("Set the project's start and target dates first (Edit project).");
      if (db.schedule.some(function (r) { return r.project_id === p.id && r.kind === "task" && PHASES.indexOf(r.title) > -1; })) throw new Error("The standard phases are already on the schedule.");
      var s0 = Date.parse(p.start_date + "T12:00:00Z"), total = Date.parse(p.target_date + "T12:00:00Z") - s0, w = [2, 2, 1, 6, 1, 0.3], sum = 12.3, acc = 0, d = function (ms) { return new Date(ms).toISOString().slice(0, 10); };
      PHASES.forEach(function (ph, i) { var a = s0 + total * acc / sum; acc += w[i]; var z = s0 + total * acc / sum - (i < PHASES.length - 1 ? 864e5 : 0);
        db.schedule.push({ id: "s" + id(), project_id: p.id, kind: "task", title: ph, start: d(a), end: d(Math.max(a, z)), phase: ph, owner: "blue sierra", status: "planned", notes: "", sort: String(Date.now() + i) }); });
      return {};
    },
    addPerson: function (db, me, b) {
      needStaff(me); var p = b.projectId ? needProject(db, me, b.projectId) : null, e = clean(b.email, 200).toLowerCase(), role = ["staff", "architect", "crew"].indexOf(b.role) > -1 ? b.role : "client";
      if (role === "staff" && me.role !== "admin") throw new Error("Only Jesús can add team members.");
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e)) throw new Error("That email doesn't look right.");
      var x = db.people.filter(function (q) { return q.email === e; })[0];
      if (x) { if (isStaff(x) && me.role !== "admin") throw new Error("Only Jesús can change team members."); var l = ids(x.project_ids); if (p && role !== "staff" && l.indexOf(p.id) < 0) l.push(p.id); x.project_ids = l.join(","); x.active = "yes"; if (x.role !== "admin") x.role = role; if (clean(b.name, 120)) x.name = clean(b.name, 120); }
      else db.people.push({ email: e, name: clean(b.name, 120) || e, role: role, project_ids: p && role !== "staff" ? p.id : "", active: "yes", created_at: now() });
      if (b.invite) mail(db, e, p ? "Your project portal for " + p.name : "You're on the portal team"); return {};
    },
    removePerson: function (db, me, b) {
      needStaff(me); var x = db.people.filter(function (q) { return q.email === b.email; })[0]; if (!x) return {};
      if (x.email === me.email) throw new Error("You can't remove yourself."); if (x.role === "admin") throw new Error("Jesús can't be removed.");
      if (isStaff(x) && me.role !== "admin") throw new Error("Only Jesús can remove team members.");
      var gone = function (q) { db.people = db.people.filter(function (y) { return y.email !== q.email; }); Object.keys(db.sessions).forEach(function (t) { if (db.sessions[t] === q.email) delete db.sessions[t]; }); };
      var left = ids(x.project_ids).filter(function (i) { return i !== b.projectId; });
      if (!b.projectId || (!left.length && !isStaff(x))) gone(x); else x.project_ids = left.join(",");
      db.people.filter(function (q) { return q.role !== "admin" && (q.active === "no" || (!isStaff(q) && !ids(q.project_ids).length)); }).forEach(gone);
      return {};
    },
    postUpdate: function (db, me, b) {
      needStaff(me); var p = needProject(db, me, b.projectId), text = clean(b.text, 5000);
      if (!text && !(b.photos || []).length) throw new Error("Write something or add photos.");
      var u = id(), phs = savePhotos(db, me, p, b.photos || [], "", u);
      db.timeline.push({ id: u, project_id: p.id, at: now(), author: me.name, text: text, photo_ids: phs.join(","), emailed: b.notify ? "yes" : "" });
      ev(db, p, me, "update", "posted a project update" + (phs.length ? " with " + phs.length + " photo" + (phs.length > 1 ? "s" : "") : ""), text.slice(0, 240), "update:" + u);
      if (b.notify) emailClients(db, p, "Project update: " + p.name); return {};
    },
    uploadPhotos: function (db, me, b) { needStaff(me); var p = needProject(db, me, b.projectId); return { count: savePhotos(db, me, p, b.photos || [], clean(b.caption, 300), "").length }; },
    deletePhoto: function (db, me, b) {
      needStaff(me); var ph = db.photos.filter(function (x) { return x.id === b.photoId; })[0]; if (!ph) return {};
      db.photos = db.photos.filter(function (x) { return x.id !== b.photoId; });
      var p = db.projects.filter(function (x) { return x.id === ph.project_id; })[0];
      if (p && p.cover_file_id === ph.file_id) { var rest = db.photos.filter(function (x) { return x.project_id === p.id; }); p.cover_file_id = rest.length ? rest[rest.length - 1].file_id : ""; }
      return {};
    },
    sendMessage: function (db, me, b) {
      var p = needProject(db, me, b.projectId), text = clean(b.text, 5000), ch = b.channel || "client";
      if (!canRead(me, ch)) throw new Error("You can't post in that channel.");
      var dmTo = isDm(ch) ? members(db, p).filter(function (x) { return x.email !== me.email && ch.indexOf(pk(x.email)) > -1; })[0] : null;
      if (isDm(ch) && !dmTo) throw new Error("That person isn't on this project.");
      var rootId = "";
      if (b.threadId) { var par = db.messages.filter(function (m) { return m.id === b.threadId && m.project_id === p.id; })[0]; if (!par || chOf(par) !== ch) throw new Error("That conversation isn't here anymore."); rootId = par.thread_id || par.id; }
      var files = (b.files || []).map(function (f) { if (!/^image\/(jpeg|png|webp)$/.test(f.mime) && f.mime !== "application/pdf") throw new Error("Attach photos (JPG, PNG) or PDFs."); return { id: "f-" + id(), name: clean(f.name, 120), mime: f.mime, src: f.mime === "application/pdf" ? "" : f.data }; });
      if (files.length > 5) throw new Error("Up to 5 files at a time.");
      if (!text && !files.length) throw new Error("Write a message.");
      var kind = isStaff(me) && b.kind === "question" && ch === "client" && !rootId ? "question" : "message", mid = id();
      db.messages.push({ id: mid, project_id: p.id, at: now(), author: me.name, author_email: me.email, role: me.role, kind: kind, text: text, question_id: "", status: kind === "question" ? "open" : "", via: "portal", channel: ch, thread_id: rootId, files: files, reactions: {} });
      if (dmTo) mail(db, dmTo.email, me.name + " sent you a private message");
      else if (isStaff(me) && ch !== "team") members(db, p).filter(function (x) { return (x.role === "client" && ch === "client") || x.role === "architect"; }).forEach(function (x) { mail(db, x.email, "Message about " + p.name); });
      else if (!isTeam(me)) mail(db, "jesus@example.com", "New message from " + me.name);
      members(db, p).forEach(function (x) { if (x.email !== me.email && ment(text, x.name) && chansFor(x).indexOf(ch) > -1) mail(db, x.email, me.name + " mentioned you"); });
      markR(db, me, p.id, ch); return { id: mid };
    },
    react: function (db, me, b) {
      var m = db.messages.filter(function (x) { return x.id === b.messageId; })[0]; if (!m) throw new Error("Message not found.");
      needProject(db, me, m.project_id); if (!canRead(me, chOf(m))) throw new Error("Message not found."); if (RX.indexOf(b.emoji) < 0) throw new Error("Pick one of the reactions.");
      var r = m.reactions = m.reactions || {}, l = r[b.emoji] || [], i = l.indexOf(me.email); if (i > -1) l.splice(i, 1); else l.push(me.email); if (l.length) r[b.emoji] = l; else delete r[b.emoji]; return {};
    },
    deleteMessage: function (db, me, b) {
      var m = db.messages.filter(function (x) { return x.id === b.messageId; })[0]; if (!m) return {}; needProject(db, me, m.project_id);
      if (m.author_email !== me.email && me.role !== "admin") throw new Error("Only the person who wrote it can delete it.");
      db.messages = db.messages.filter(function (x) { return !(x.id === m.id || (!m.thread_id && x.thread_id === m.id) || (m.kind === "question" && x.question_id === m.id)); }); return {};
    },
    markRead: function (db, me, b) { var p = needProject(db, me, b.projectId); if (canRead(me, b.channel)) markR(db, me, p.id, b.channel); return {}; },
    activity: function (db, me, b) {
      var seen = {}; db.projects.forEach(function (p) { if (canSee(me, p.id) && (isStaff(me) || p.status !== "archived") && p.status !== "deleted") seen[p.id] = p; });
      var rd = readsOf(db, me);
      return { items: db.messages.filter(function (m) { return seen[m.project_id] && canRead(me, chOf(m)); }).sort(function (a, c) { return a.at < c.at ? 1 : -1; }).slice(0, Math.min(b.limit || 60, 150)).map(function (m) {
        var o = { id: m.id, project_id: m.project_id, project: seen[m.project_id].name, channel: chOf(m), thread_id: m.thread_id || "", kind: m.kind, author: m.author, role: m.role, at: m.at, text: String(m.text).slice(0, 400), files: (m.files || []).length, mine: m.author_email === me.email, ref: m.ref || "", status: m.kind === "event" ? m.status : "" };
        o.unread = !o.mine && m.at > (rd[m.project_id + "|" + o.channel] || ""); o.mention = ment(m.text, me.name); o.dm = isDm(o.channel); o.akey = pk(m.author_email); o.avatar = (db.people.filter(function (x) { return x.email === m.author_email; })[0] || {}).avatar || ""; return o; }) };
    },
    listTeam: function (db, me) { needStaff(me); return { team: db.people.filter(isTeam).map(function (x) { return { email: x.email, name: x.name, role: x.role, money: meOut(x).money, active: x.active === "yes", since: String(x.created_at || "").slice(0, 10), avatar: x.avatar || "", projects: ids(x.project_ids).length }; }) }; },
    presence: function (db, me, b) {
      // Preview: a few sample people "online" so the panel has something to show.
      var sample = { "maria@example.com": ["online", "p1", "plans"], "architect@example.com": ["busy", "p1", "messages"], "crew@example.com": ["away", "p1", "schedule"] };
      var mine = { s: ["available", "busy", "away"].indexOf(b.status) > -1 ? b.status : "available", at: Date.now(), pid: b.pid || "", tab: b.tab || "" };
      var rd = readsOf(db, me), mineMsgs = db.messages.filter(function (m) { return canSee(me, m.project_id) && m.author_email !== me.email && canRead(me, chOf(m)); }), nw = mineMsgs[mineMsgs.length - 1];
      var unread = mineMsgs.filter(function (m) { return m.at > (rd[m.project_id + "|" + chOf(m)] || ""); }).length, pj = nw && db.projects.filter(function (q) { return q.id === nw.project_id; })[0];
      var pulse = nw ? { id: nw.id, at: nw.at, author: nw.author, avatar: (db.people.filter(function (x) { return x.email === nw.author_email; })[0] || {}).avatar || "", akey: pk(nw.author_email), text: String(nw.text).split("\n")[0], kind: nw.kind, pid: nw.project_id, project: pj ? pj.name : "", channel: chOf(nw), thread_id: nw.thread_id || "", dm: isDm(chOf(nw)), unread: unread } : { unread: unread };
      return { me: mine, pulse: pulse, people: db.people.filter(function (x) { return x.active === "yes" && x.email !== me.email && (isStaff(me) || isStaff(x) || ids(x.project_ids).some(function (id) { return canSee(me, id); })); }).map(function (x) {
        var smp = sample[x.email], state = smp ? smp[0] : "offline", pr = db.projects.filter(function (q) { return smp && q.id === smp[1] && canSee(me, q.id); })[0];
        return { key: pk(x.email), name: x.name, role: x.role, avatar: x.avatar || "", state: state, last: Date.now() - (smp ? 20000 : 3 * 3600000), inCall: false, pid: pr ? pr.id : "", project: pr ? pr.name : "", tab: pr ? smp[2] : "",
          shared: db.projects.filter(function (q) { return canSee(me, q.id) && (isStaff(x) || ids(x.project_ids).indexOf(q.id) > -1); }).map(function (q) { return q.id; }) }; }) };
    },
    setPin: function (db, me, b) { var pin = String(b.pin || ""); if (!/^\d{6}$/.test(pin)) throw new Error("The PIN has to be 6 digits."); if (/^(\d)\1{5}$/.test(pin) || "0123456789".indexOf(pin) > -1 || "9876543210".indexOf(pin) > -1) throw new Error("That PIN is too easy to guess. Try another one.");
      db.people.filter(function (q) { return q.email === me.email; })[0].pin = pin; return {}; },
    deleteInvoice: function (db, me, b) { needStaff(me); db.invoices = db.invoices.filter(function (i) { return i.id !== b.invoiceId; }); db.messages = db.messages.filter(function (m) { return m.ref !== "invoice:" + b.invoiceId; }); return {}; },
    deleteUpdate: function (db, me, b) { needStaff(me); db.timeline = db.timeline.filter(function (t) { return t.id !== b.updateId; }); db.messages = db.messages.filter(function (m) { return m.ref !== "update:" + b.updateId; }); return {}; },
    togglePin: function (db, me, b) { needStaff(me); var list = b.kind === "update" ? db.timeline : db.messages, it = list.filter(function (x) { return x.id === b.id; })[0]; if (!it) throw new Error("Not found."); it.pinned = it.pinned === "yes" ? "" : "yes"; return { pinned: it.pinned === "yes" }; },
    saveProfile: function (db, me, b) { var x = db.people.filter(function (q) { return q.email === me.email; })[0]; x.avatar = b.avatar || ""; return { avatar: x.avatar }; },
    deleteProject: function (db, me, b) { if (me.role !== "admin") throw new Error("Only Jesús can delete projects."); var p = needProject(db, me, b.projectId);
      if (String(b.confirm || "").trim().toLowerCase() !== p.name.trim().toLowerCase()) throw new Error("Type the project name exactly to delete it."); p.status = "deleted"; return {}; },
    restoreProject: function (db, me, b) { if (me.role !== "admin") throw new Error("Only Jesús can restore projects."); needProject(db, me, b.projectId).status = "active"; return {}; },
    startCall: function (db, me, b) { var p = needProject(db, me, b.projectId), ch = b.channel || "client"; if (!canRead(me, ch)) throw new Error("You can't start a call there.");
      var who = members(db, p).filter(function (x) { return x.email !== me.email && (b.invite || []).indexOf(pk(x.email)) > -1 && canRead(x, ch); }); if (!who.length) throw new Error("Pick at least one person to call.");
      var url = "https://meet.google.com/abc-defg-hij", names = who.map(function (x) { return x.name; }); who.forEach(function (x) { mail(db, x.email, me.name + " is calling you"); });
      db.messages.push({ id: "e" + id(), project_id: p.id, at: now(), author: me.name, author_email: me.email, role: me.role, kind: "event", text: "is calling " + names.join(", ").replace(/, ([^,]*)$/, " and $1") + "\nTap Join, or open meet.google.com and enter this code. The link works for the next hour.", status: "call", via: "portal", channel: ch, thread_id: "", ref: "meet:" + url });
      return { url: "about:blank#preview-meet", code: "abc-defg-hij" }; },
    planStart: function (db, me, b) { needStaff(me); var p = needProject(db, me, b.projectId), pid = "d" + id();
      db.plans.push({ id: pid, project_id: p.id, set: clean(b.set, 120), rev: clean(b.rev, 40), date: b.date || today(), notes: clean(b.notes, 2000), visible: b.visible || "team", status: "uploading", by: me.name, at: now() + ":" + String(Date.now()).slice(-5), sheets: [] }); return { id: pid, uploadUrl: "" }; },
    planPages: function (db, me, b) { needStaff(me); var d = db.plans.filter(function (x) { return x.id === b.id; })[0]; (b.pages || []).forEach(function (pg) { d.sheets.push({ n: pg.n, src: pg.data, w: pg.w, h: pg.h, sheet: pg.sheet }); }); return {}; },
    planFinish: function (db, me, b) { needStaff(me); var d = db.plans.filter(function (x) { return x.id === b.id; })[0], p = needProject(db, me, d.project_id), meta = {};
      (b.sheets || []).forEach(function (x) { meta[x.n] = x; }); d.sheets.forEach(function (x) { Object.assign(x, { status: meta[x.n].status, score: meta[x.n].score, boxes: meta[x.n].boxes, prev: meta[x.n].prev }); });
      d.status = "ready"; d.text = b.text || {}; var ch = d.sheets.filter(function (x) { return x.status === "changed"; }).length;
      var first = db.plans.filter(function (x) { return x.project_id === p.id && x.set === d.set && x.status === "ready"; }).length === 1;
      ev(db, p, me, "plan", "uploaded " + d.set + " " + d.rev, (first ? d.sheets.length + " sheets" : ch ? ch + " sheet" + (ch > 1 ? "s" : "") + " changed" : "No sheet changes found") + (d.notes ? " · " + d.notes.slice(0, 160) : ""), "plan:" + d.id);
      db.messages[db.messages.length - 1].channel = "team"; return {}; },
    planImage: function (db, me, b) { var d = db.plans.filter(function (x) { return x.id === b.id; })[0]; needProject(db, me, d.project_id); return { data: d.sheets.filter(function (x) { return x.n === Number(b.n); })[0].src }; },
    planText: function (db, me, b) { needStaff(me); var d = db.plans.filter(function (x) { return x.id === b.id; })[0]; return { text: (d && d.text) || {} }; },
    deletePlan: function (db, me, b) { needStaff(me); db.plans = db.plans.filter(function (x) { return x.id !== b.id; }); return {}; },
    answerQuestion: function (db, me, b) {
      var p = needProject(db, me, b.projectId), q = db.messages.filter(function (m) { return m.id === b.questionId && m.project_id === p.id && m.kind === "question"; })[0];
      if (!q) throw new Error("Question not found."); var text = clean(b.text, 5000); if (!text) throw new Error("Write an answer.");
      db.messages.push({ id: id(), project_id: p.id, at: now(), author: me.name, author_email: me.email, role: me.role, kind: "answer", text: text, question_id: q.id, status: "", via: "portal", channel: "client", thread_id: "" });
      q.status = "answered"; if (!isStaff(me)) mail(db, "jesus@example.com", me.name + " answered a question"); return {};
    },
    closeQuestion: function (db, me, b) { needStaff(me); var q = db.messages.filter(function (m) { return m.id === b.questionId; })[0]; if (q) { needProject(db, me, q.project_id); q.status = "answered"; } return {}; },
    saveInvoice: function (db, me, b) {
      needStaff(me); var p = needProject(db, me, b.projectId), f = b.invoice || {};
      var patch = { number: clean(f.number, 40), title: clean(f.title, 200), amount: String(Math.round((Number(f.amount) || 0) * 100) / 100), issued: clean(f.issued, 10), due: clean(f.due, 10),
        status: ["draft", "sent", "paid", "void"].indexOf(f.status) > -1 ? f.status : "sent", pay_url: /^https:\/\//.test(f.pay_url || "") ? f.pay_url : "", notes: clean(f.notes, 1000) };
      patch.paid_date = patch.status === "paid" ? (clean(f.paid_date, 10) || today()) : "";
      if (f.lines != null) {
        var valid = {}; db.contractLines.forEach(function (l) { if (l.project_id === p.id && l.status !== "rejected") valid[l.id] = 1; });
        var lines = {}, sum = 0; Object.keys(f.lines || {}).forEach(function (k) { var a = cents(f.lines[k]); if (!a) return; if (!valid[k]) throw new Error("That contract line isn't on this project."); lines[k] = a; sum += a; });
        patch.lines = lines; if (Object.keys(lines).length) patch.amount = String(cents(sum));
      }
      if (f.retainage != null) patch.retainage = String(cents(f.retainage));
      if (num(patch.retainage) > num(patch.amount) && num(patch.amount) > 0) throw new Error("Retainage can't be more than the work billed.");
      if (f.pdf && f.pdf.data) { if (f.pdf.mime !== "application/pdf") throw new Error("Invoices must be PDF."); patch.pdf_file_id = "pdf-" + id(); }
      var inv = f.id ? db.invoices.filter(function (i) { return i.id === f.id && i.project_id === p.id; })[0] : null, was = inv ? inv.status : "";
      if (f.id) { if (!inv) throw new Error("Invoice not found."); Object.assign(inv, patch); }
      else { inv = Object.assign({ id: id(), project_id: p.id, pdf_file_id: "" }, patch); db.invoices.push(inv); }
      var dueNow = num(inv.amount) - num(inv.retainage);
      if (inv.status === "sent" && ["sent", "paid"].indexOf(was) < 0) ev(db, p, me, "invoice", "sent invoice " + inv.number, (inv.title ? inv.title + " · " : "") + "$" + usd(dueNow) + " due" + (inv.due ? " by " + inv.due : ""), "invoice:" + inv.id);
      if (inv.status === "paid" && was !== "paid") ev(db, p, me, "paid", "marked invoice " + inv.number + " as paid", "$" + usd(dueNow) + " received. Thank you!", "invoice:" + inv.id);
      if (b.notify && patch.status === "sent") emailClients(db, p, "Invoice " + patch.number); return {};
    },
    saveContractLine: function (db, me, b) {
      needStaff(me); var p = needProject(db, me, b.projectId), f = b.line || {}, kind = f.kind === "change" ? "change" : "base";
      var patch = { kind: kind, number: clean(f.number, 20), title: clean(f.title, 200), amount: String(cents(f.amount)), date: clean(f.date, 10),
        status: kind === "base" ? "approved" : (["proposed", "approved", "rejected"].indexOf(f.status) > -1 ? f.status : "proposed") };
      if (f.notes != null) patch.notes = clean(f.notes, 1000);
      if (!patch.title) throw new Error("Give the line a name.");
      if (kind === "base" && num(patch.amount) <= 0) throw new Error("A contract line needs an amount above zero.");
      if (f.id) { var it = db.contractLines.filter(function (l) { return l.id === f.id && l.project_id === p.id; })[0]; if (!it) throw new Error("Line not found.");
        if (patch.status === "rejected" && billed(db, it.id)) throw new Error("Invoices already bill this change order, so it can't be rejected.");
        var st0 = it.status; Object.assign(it, patch); if (kind === "change" && patch.status !== st0 && patch.status !== "rejected") ev(db, p, me, "change", (patch.status === "approved" ? "approved" : "proposed") + " change order " + patch.number, patch.title + " · +$" + usd(patch.amount), "co:" + it.id); }
      else { var nl = Object.assign({ id: "c" + id(), project_id: p.id, sort: String(Date.now()), notes: "" }, patch); db.contractLines.push(nl);
        if (kind === "change" && patch.status !== "rejected") ev(db, p, me, "change", (patch.status === "approved" ? "added an approved" : "proposed a") + " change order " + patch.number, patch.title + " · +$" + usd(patch.amount), "co:" + nl.id); }
      return {};
    },
    deleteContractLine: function (db, me, b) {
      needStaff(me); if (billed(db, b.lineId)) throw new Error("Invoices already bill this line. Edit those invoices first.");
      db.contractLines = db.contractLines.filter(function (l) { return l.id !== b.lineId; }); return {};
    },
    saveChecklistItem: function (db, me, b) {
      needStaff(me); var p = needProject(db, me, b.projectId), f = b.item || {};
      var patch = { phase: PHASES.indexOf(f.phase) > -1 ? f.phase : PHASES[0], item: clean(f.item, 300), owner: f.owner === "client" ? "client" : "blue sierra", due: clean(f.due, 10) };
      if (!patch.item) throw new Error("Write the checklist item.");
      if (f.id) Object.assign(db.checklist.filter(function (c) { return c.id === f.id; })[0] || {}, patch);
      else { var nc = Object.assign({ id: id(), project_id: p.id, done: "", done_by: "", done_at: "", sort: String(Date.now()) }, patch); db.checklist.push(nc);
        if (nc.owner === "client") ev(db, p, me, "todo", "added a to-do for the client", nc.item + (nc.due ? " · due " + nc.due : ""), "check:" + nc.id); }
      return {};
    },
    deleteChecklistItem: function (db, me, b) { needStaff(me); db.checklist = db.checklist.filter(function (c) { return c.id !== b.itemId; }); return {}; },
    toggleChecklist: function (db, me, b) {
      var it = db.checklist.filter(function (c) { return c.id === b.itemId; })[0]; if (!it) throw new Error("Item not found.");
      var pp = needProject(db, me, it.project_id);
      if (!isStaff(me) && (it.owner !== "client" || me.role !== "client")) throw new Error(it.owner === "client" ? "Only the client checks off that one." : "Blue Sierra checks off that one.");
      var done = it.done !== "yes"; it.done = done ? "yes" : ""; it.done_by = done ? me.name : ""; it.done_at = done ? now() : "";
      if (done && !isStaff(me)) mail(db, "jesus@example.com", me.name + " checked off: " + it.item);
      if (done) ev(db, pp, me, "done", "checked off a to-do", it.item, "check:" + it.id); return {};
    }
  };

  /* ---- permission #tags, footprints, pins, start-over (mirrors Portal.gs) ---- */
  var AUDS = ["client", "architect", "team", "crew", "private"];
  function audOf(me) { return isStaff(me) ? AUDS : me.role === "crew" ? ["crew"] : me.role === "architect" ? ["client", "architect"] : ["client"]; }
  function audList(v) { return (Array.isArray(v) ? v : String(v || "").split(",")).map(String).filter(function (a) { return AUDS.indexOf(a) > -1; }); }
  function audOk(me, v) { var l = audList(v); return !l.length || l.some(function (a) { return audOf(me).indexOf(a) > -1; }); }
  function audView(me, v) { var l = audList(v); if (isStaff(me)) return l; var mine = audOf(me); return l.filter(function (a) { return mine.indexOf(a) > -1; }); }
  function myAud(me) { return me.role === "crew" ? "crew" : me.role === "architect" ? "architect" : me.role === "client" ? "client" : "team"; }
  function readTags(t) { var W = { client: "client", cliente: "client", architect: "architect", arquitecto: "architect", team: "team", equipo: "team", crew: "crew", private: "private", privado: "private" }, aud = [];
    var rest = String(t || "").replace(/(^|\s)#([a-z]+)\b/gi, function (all, sp, w) { var a = W[w.toLowerCase()]; if (!a) return all; if (aud.indexOf(a) < 0) aud.push(a); return sp; }); return { aud: aud, text: rest.replace(/\s{2,}/g, " ").trim() }; }
  function canBill(me, p) { return isStaff(me) ? true : me.role === "crew" ? false : audList(p.billing_aud).indexOf(me.role) > -1; }
  function foot(db, email, at) { if (!email) return null; var x = db.people.filter(function (q) { return q.email === email; })[0] || {}; return { name: x.name || "Someone", key: pk(email), avatar: x.avatar || "", role: x.role || "", at: at || "" }; }
  function canCheck(me, it) { if (isStaff(me)) return true; if (it.assignee) return isAsg(it, me.email); var l = audList(it.aud); if (!l.length) return it.owner === "client" && me.role === "client"; return l.indexOf(myAud(me)) > -1; }
  var baseGet = ACTIONS.getProject, baseList = ACTIONS.listProjects;
  ACTIONS.getProject = function (db, me, b) {
    var out = baseGet(db, me, b), p = db.projects.filter(function (x) { return x.id === b.projectId; })[0], bill = canBill(me, p);
    out.billing = bill; if (!bill) { out.invoices = []; out.contract = { retainage_pct: 0, lines: [] }; }
    out.channels = audOf(me).filter(function (a) { return a !== "private"; });
    out.messages = db.messages.filter(function (m) { return m.project_id === p.id && (bill || !(m.kind === "event" && /^(invoice|inv|co):/.test(m.ref || ""))) && (isDm(chOf(m)) ? m.channel.indexOf(pk(me.email)) > -1 : out.channels.indexOf(chOf(m)) > -1); }).map(function (m) { return msgOut(db, m, me); });
    out.project.billing_aud = audList(p.billing_aud);
    var hid = {}; db.timeline.forEach(function (u) { if (u.project_id === p.id && !audOk(me, u.aud)) hid[u.id] = 1; });
    out.timeline = out.timeline.filter(function (u) { return !hid[u.id]; }).map(function (u) { return Object.assign({}, u, { aud: audView(me, u.aud) }); });
    out.photos = out.photos.filter(function (ph) { return !hid[ph.update_id]; });
    var rx = function (r) { r = r || {}; return Object.keys(r).map(function (e) { return { e: e, n: r[e].length, mine: r[e].indexOf(me.email) > -1, who: r[e] }; }); };
    out.checklist = out.checklist.filter(function (c) { return audOk(me, c.aud) || isAsg(c, me.email); }).map(function (c) {
      return Object.assign({}, c, { aud: audView(me, c.aud), assignee: undefined, assignees: asg(c).map(function (e) { return foot(db, e); }), mine: isAsg(c, me.email), can: canCheck(me, c), pinned: c.pinned === "yes",
        doneFoot: c.done === "yes" ? foot(db, c.done_email, c.done_at) || { name: c.done_by, at: c.done_at } : null, edited: foot(db, c.edited_by || c.created_by, c.edited_at), reactions: rx(c.reactions) }); });
    out.schedule = out.schedule.map(function (x) { return Object.assign({}, x, { edited: foot(db, x.edited_by, x.edited_at), req: x.req_by ? Object.assign(foot(db, x.req_by, x.req_at), { note: x.req_note }) : null }); });
    if (me.role === "admin") { var w = (db.wipes || []).filter(function (x) { return x.pid === p.id; }).slice(-1)[0]; out.wipe = w ? { id: w.id, at: w.at, items: w.n } : null; }
    return out;
  };
  ACTIONS.listProjects = function (db, me) {
    var out = baseList(db, me), names = {}; out.projects.forEach(function (p) { names[p.id] = p.name; var raw = db.projects.filter(function (x) { return x.id === p.id; })[0]; if (!canBill(me, raw)) { p.money = {}; p.balance = 0; if (p.needs) p.needs.invoices = []; }
      p.needs = p.needs || {}; p.needs.mine = db.checklist.filter(function (c) { return c.project_id === p.id && isAsg(c, me.email) && c.done !== "yes"; }).map(function (c) { return { id: c.id, item: c.item, due: c.due }; }); });
    var pins = [];
    db.messages.forEach(function (m) { if (m.pinned === "yes" && names[m.project_id] && canRead(me, chOf(m))) pins.push({ kind: "msg", id: m.id, pid: m.project_id, project: names[m.project_id], at: m.at, text: m.text, author: m.author, akey: pk(m.author_email), channel: chOf(m) }); });
    db.timeline.forEach(function (u) { if (u.pinned === "yes" && names[u.project_id] && audOk(me, u.aud)) pins.push({ kind: "update", id: u.id, pid: u.project_id, project: names[u.project_id], at: u.at, text: u.text, author: u.author, aud: audView(me, u.aud) }); });
    db.checklist.forEach(function (c) { if (c.pinned === "yes" && names[c.project_id] && (audOk(me, c.aud) || isAsg(c, me.email))) pins.push({ kind: "check", id: c.id, pid: c.project_id, project: names[c.project_id], at: c.edited_at || "", text: c.item, done: c.done === "yes", aud: audView(me, c.aud) }); });
    out.pins = pins; return out;
  };
  ACTIONS.postUpdate = function (db, me, b) {
    needStaff(me); var p = needProject(db, me, b.projectId), tg = readTags(clean(b.text, 5000)), aud = audList((b.aud || []).concat(tg.aud)).filter(function (a, i, l) { return l.indexOf(a) === i; });
    if (aud.indexOf("private") > -1) aud = ["private"];
    var u = id(), phs = savePhotos(db, me, p, b.photos || [], "", u);
    db.timeline.push({ id: u, project_id: p.id, at: now(), author: me.name, author_email: me.email, text: tg.text, photo_ids: phs.join(","), emailed: b.notify ? "yes" : "", aud: aud.join(",") });
    if (aud[0] !== "private") (aud.length && aud.indexOf("client") < 0 ? aud : ["client"]).forEach(function (ch) { ev(db, p, me, "update", "posted a project update", tg.text.slice(0, 240), "update:" + u, ch); });
    return {};
  };
  ACTIONS.saveChecklistItem = function (db, me, b) {
    needStaff(me); var p = needProject(db, me, b.projectId), f = b.item || {}, tg = readTags(f.item), aud = audList((f.aud || []).concat(tg.aud));
    var who = (f.assignees || []).map(function (k) { return db.people.filter(function (x) { return pk(x.email) === k; })[0]; }).filter(Boolean), old = f.id ? db.checklist.filter(function (c) { return c.id === f.id; })[0] : null, before = old ? asg(old) : [];
    var patch = { phase: PHASES.indexOf(f.phase) > -1 ? f.phase : PHASES[0], item: tg.text, owner: aud.indexOf("client") > -1 ? "client" : "blue sierra", due: clean(f.due, 10), aud: aud.join(","), assignee: who.map(function (x) { return x.email; }).join(","), edited_by: me.email, edited_at: now() };
    if (!patch.item) throw new Error("Write the checklist item.");
    if (f.id) Object.assign(db.checklist.filter(function (c) { return c.id === f.id; })[0] || {}, patch);
    else { var nc = Object.assign({ id: id(), project_id: p.id, done: "", sort: String(Date.now()), created_by: me.email }, patch); db.checklist.push(nc);
    }
    var fresh = who.filter(function (x) { return before.indexOf(x.email) < 0 && x.email !== me.email; });
    if (fresh.length) ev(db, p, me, "todo", "assigned a to-do to " + fresh.map(function (x) { return x.name; }).join(", "), patch.item, "check:" + (f.id || nc.id), aud.indexOf("client") > -1 ? "client" : aud.indexOf("crew") > -1 ? "crew" : "team");
    return {};
  };
  ACTIONS.toggleChecklist = function (db, me, b) {
    var it = db.checklist.filter(function (c) { return c.id === b.itemId; })[0]; if (!it) throw new Error("Item not found.");
    var pp = needProject(db, me, it.project_id); if (!canCheck(me, it)) throw new Error("You can't check that one.");
    var done = it.done !== "yes"; it.done = done ? "yes" : ""; it.done_by = done ? me.name : ""; it.done_email = done ? me.email : ""; it.done_at = done ? now() : "";
    if (done) ev(db, pp, me, "done", "checked off a to-do", it.item, "check:" + it.id); return {};
  };
  ACTIONS.reactCheck = function (db, me, b) { var it = db.checklist.filter(function (c) { return c.id === b.itemId; })[0]; var r = it.reactions || {}, l = r[b.emoji] || [], i = l.indexOf(me.email); if (i > -1) l.splice(i, 1); else l.push(me.email); if (l.length) r[b.emoji] = l; else delete r[b.emoji]; it.reactions = r; return {}; };
  ACTIONS.requestScheduleChange = function (db, me, b) { var it = db.schedule.filter(function (x) { return x.id === b.itemId; })[0]; var p = needProject(db, me, it.project_id); it.req_by = me.email; it.req_at = now(); it.req_note = clean(b.note, 500); ev(db, p, me, "date", "asked to change “" + it.title + "”", it.req_note, "sched:" + it.id, me.role === "crew" ? "crew" : "client"); return {}; };
  var baseSched = ACTIONS.saveScheduleItem;
  ACTIONS.saveScheduleItem = function (db, me, b) { var r = baseSched(db, me, b), it = db.schedule.filter(function (x) { return x.id === (b.item || {}).id; })[0] || db.schedule[db.schedule.length - 1]; it.edited_by = me.email; it.edited_at = now(); it.req_by = ""; it.req_note = ""; return r; };
  ACTIONS.togglePin = function (db, me, b) { needStaff(me); var list = b.kind === "update" ? db.timeline : b.kind === "check" ? db.checklist : db.messages, it = list.filter(function (x) { return x.id === b.id; })[0]; it.pinned = it.pinned === "yes" ? "" : "yes"; return {}; };
  var baseSaveP = ACTIONS.saveProject;
  ACTIONS.saveProject = function (db, me, b) { var f = b.project || {}, r = baseSaveP(db, me, b), p = db.projects.filter(function (x) { return x.id === (f.id || r.project.id); })[0];
    if (f.architect_name != null) p.architect_name = clean(f.architect_name, 200); if (f.billing_aud) p.billing_aud = audList(f.billing_aud).join(","); if (f.logo && f.logo.data) p.architect_logo = f.logo.data; if (f.logo === "") p.architect_logo = ""; return r; };
  ACTIONS.wipeProject = function (db, me, b) { var p = needProject(db, me, b.projectId); if (String(b.confirm || "").trim().toLowerCase() !== p.name.toLowerCase()) throw new Error("Type the project name exactly to start it over.");
    var w = { id: id(), pid: p.id, at: now(), data: {} }, n = 0; ["messages", "timeline", "photos", "invoices", "checklist", "schedule", "contractLines"].forEach(function (t) { w.data[t] = db[t].filter(function (r) { return r.project_id === p.id; }); n += w.data[t].length; db[t] = db[t].filter(function (r) { return r.project_id !== p.id; }); });
    w.n = n; (db.wipes = db.wipes || []).push(w); return {}; };
  ACTIONS.restoreWipe = function (db, me, b) { var w = (db.wipes || []).filter(function (x) { return x.pid === b.projectId; }).slice(-1)[0]; if (!w) throw new Error("There's nothing to restore."); Object.keys(w.data).forEach(function (t) { db[t] = db[t].concat(w.data[t]); }); db.wipes = db.wipes.filter(function (x) { return x !== w; }); return {}; };

  ACTIONS.qbStatus = function (db, me) { needStaff(me); var q = db.qb || {}; return { hasKeys: !!q.keys, connected: !!q.connected, company: q.connected ? "Blue Sierra Construction (sample)" : "", env: q.env || "production", admin: me.role === "admin" }; };
  ACTIONS.qbSaveKeys = function (db, me, b) { db.qb = Object.assign(db.qb || {}, { keys: true, env: b.env }); return ACTIONS.qbStatus(db, me); };
  ACTIONS.qbConnectUrl = function (db, me) { db.qb = Object.assign(db.qb || {}, { connected: true }); return { url: "about:blank#preview-quickbooks-connected" }; };
  ACTIONS.qbDisconnect = function (db) { db.qb = { keys: true }; return {}; };
  ACTIONS.qbCustomers = function () { return { customers: [{ id: "58", name: "Sample Client" }, { id: "61", name: "Second Client" }] }; };
  ACTIONS.qbLink = function (db, me, b) { var p = needProject(db, me, b.projectId); p.qb_customer = b.customerId || ""; return {}; };
  ACTIONS.qbInvoices = function (db, me, b) { var p = needProject(db, me, b.projectId); if (!p.qb_customer) return { linked: false, invoices: [] };
    var imp = {}; db.invoices.forEach(function (i) { if (i.qb_id) imp[i.qb_id] = i.id; });
    return { linked: true, invoices: [{ id: "1041", number: "1041", date: "2026-11-01", due: "2026-11-15", total: 18500, balance: 18500, imported: imp["1041"] || "" }, { id: "1032", number: "1032", date: "2026-10-01", due: "2026-10-15", total: 22000, balance: 0, imported: imp["1032"] || "" }] }; };
  ACTIONS.qbImport = function (db, me, b) { var p = needProject(db, me, b.projectId), ex = db.invoices.filter(function (i) { return i.qb_id === b.qbId; })[0];
    var paid = b.qbId === "1032", f = { id: ex ? ex.id : undefined, number: b.qbId, title: "QuickBooks invoice", amount: paid ? 22000 : 18500, issued: paid ? "2026-10-01" : "2026-11-01", due: paid ? "2026-10-15" : "2026-11-15", status: paid ? "paid" : "sent" };
    var r = ACTIONS.saveInvoice(db, me, { projectId: p.id, invoice: f }); var it = db.invoices.filter(function (i) { return i.id === (r.id || (db.invoices[db.invoices.length - 1] || {}).id); })[0] || db.invoices[db.invoices.length - 1]; it.qb_id = b.qbId; it.pdf_file_id = "qb"; return { id: it.id }; };

  ACTIONS.setRole = function (db, me, b) {
    needStaff(me); var x = db.people.filter(function (q) { return q.email === b.email; })[0], admin = me.role === "admin", role = b.role;
    if (!x) throw new Error("Person not found."); if (["admin", "staff", "crew", "client", "architect"].indexOf(role) < 0) throw new Error("Pick a role.");
    if (x.email === me.email && role !== x.role) throw new Error("You can't change your own role.");
    if (!admin && (isStaff(x) || role === "staff" || role === "admin")) throw new Error("Only Jesús changes team roles.");
    var l = ids(x.project_ids); if (b.projectId && ["client", "architect", "crew"].indexOf(role) > -1 && l.indexOf(b.projectId) < 0) l.push(b.projectId);
    if ((role === "client" || role === "architect") && !l.length) throw new Error("Clients and architects need a project.");
    if (b.money != null && !admin) throw new Error("Only Jesús decides who sees #money.");
    x.role = role; x.project_ids = l.join(","); x.money = role === "staff" && (b.money != null ? b.money : x.money === "yes") ? "yes" : ""; return {};
  };
  ACTIONS.purgeProject = function (db, me, b) {
    if (me.role !== "admin") throw new Error("Only Jesús can erase projects."); var p = db.projects.filter(function (x) { return x.id === b.projectId; })[0];
    if (!p || p.status !== "deleted") throw new Error("Delete the project first."); if (String(b.confirm || "").trim().toLowerCase() !== p.name.toLowerCase()) throw new Error("Type the project name exactly to erase it.");
    ["messages", "timeline", "photos", "invoices", "checklist", "schedule", "contractLines", "plans"].forEach(function (t) { if (db[t]) db[t] = db[t].filter(function (r) { return r.project_id !== p.id; }); });
    db.people.forEach(function (x) { x.project_ids = ids(x.project_ids).filter(function (i) { return i !== p.id; }).join(","); });
    db.people = db.people.filter(function (x) { return isTeam(x) || ids(x.project_ids).length; });
    db.projects = db.projects.filter(function (x) { return x !== p; }); return { trashed: true };
  };
  ACTIONS.qbMoney = function (db, me, b) {
    if (!meOut(me).money) throw new Error("That's #money. Ask Jesús to tag you #money.");
    var p = needProject(db, me, b.projectId), q = db.qb || {};
    var contract = db.contractLines.filter(function (l) { return l.project_id === p.id && (l.kind === "base" || l.status === "approved"); }).reduce(function (a, l) { return a + num(l.amount); }, 0);
    var base = { contract: contract, connected: !!q.connected, linked: !!p.qb_customer }; if (!base.connected || !base.linked) return base;
    return Object.assign(base, { customer: "Sample Client", company: "Blue Sierra Construction (sample)", updated: now(), cached: !b.refresh,
      inn: { billed: 140500, collected: 122000, open: 18500, overdue: 0, count: 6 }, income: 140500,
      out: { total: 112340, labor: 46200, materials: 38900, subs: 21800, other: 5440 },
      accounts: [{ name: "Payroll Expenses:Wages", amount: 39800, bucket: "labor" }, { name: "Job Materials", amount: 38900, bucket: "materials" }, { name: "Subcontractors", amount: 21800, bucket: "subs" }, { name: "Payroll Expenses:Taxes", amount: 6400, bucket: "labor" }, { name: "Equipment Rental", amount: 3240, bucket: "other" }, { name: "Dump fees", amount: 2200, bucket: "other" }],
      owe: { open: 14260, overdue: 3120 }, bills: [{ vendor: "Golden State Lumber", number: "88231", due: "2026-10-30", amount: 3120, late: true, what: "Job Materials" }, { vendor: "Peninsula Electric", number: "1207", due: "2026-11-14", amount: 8400, late: false, what: "Subcontractors" }, { vendor: "Ferguson Plumbing", number: "55-901", due: "2026-11-22", amount: 2740, late: false, what: "Job Materials" }],
      recent: [{ date: "2026-11-04", who: "Home Depot", what: "Framing lumber, hangers", amount: 1284.55, bucket: "materials" }, { date: "2026-11-01", who: "Payroll", what: "Payroll Expenses:Wages", amount: 6240, bucket: "labor" }, { date: "2026-10-28", who: "Peninsula Electric", what: "Rough-in progress billing", amount: 8400, bucket: "subs" }, { date: "2026-10-24", who: "Sunbelt Rentals", what: "Mini excavator, 3 days", amount: 1080, bucket: "other" }],
      payments: [{ date: "2026-10-20", amount: 42000, method: "Check", ref: "1088" }, { date: "2026-09-18", amount: 40000, method: "ACH", ref: "" }, { date: "2026-08-15", amount: 40000, method: "Check", ref: "1032" }],
      hours: { total: 612, people: [{ name: "Miguel R.", hours: 214 }, { name: "Luis P.", hours: 188 }, { name: "Andrés G.", hours: 141 }, { name: "Chris T.", hours: 69 }] }, warnings: [] });
  };
  ACTIONS.qbFinance = function (db, me, b) {
    if (!meOut(me).money) throw new Error("That's #money. Ask Jesús to tag you #money.");
    var q = db.qb || {}, projects = db.projects.filter(function (p) { return p.status !== "deleted"; }).map(function (p) { return { id: p.id, name: p.name, qb: p.qb_customer || "", status: p.status }; });
    var base = { connected: !!q.connected, env: q.env || "production", projects: projects, admin: me.role === "admin" }; if (!base.connected) return base;
    var mk = function (lbl, i, o) { return { label: lbl, income: i, expenses: o }; };
    return Object.assign(base, { company: "Blue Sierra Construction (sample)", updated: now(), cached: !b.refresh,
      cash: { total: 124250.5, accounts: [{ name: "Chase Business Checking", balance: 84250.5 }, { name: "Chase Savings", balance: 40000 }] },
      cards: { total: 6200, accounts: [{ name: "Amex Business Gold", balance: 6200 }] },
      ar: { open: 48140, overdue: 2797.5, count: 4 }, ap: { open: 18980, overdue: 3120, count: 7, soon: [{ vendor: "Golden State Lumber", due: "2026-10-30", amount: 3120, late: true }, { vendor: "Peninsula Electric", due: "2026-11-14", amount: 8400, late: false }, { vendor: "Ferguson Plumbing", due: "2026-11-18", amount: 2740, late: false }] },
      months: [mk("Dec 2025", 61000, 52000), mk("Jan 2026", 38000, 47000), mk("Feb 2026", 72000, 55000), mk("Mar 2026", 84000, 61000), mk("Apr 2026", 91000, 70000), mk("May 2026", 76000, 68000), mk("Jun 2026", 99000, 73000), mk("Jul 2026", 112000, 81000), mk("Aug 2026", 88000, 79000), mk("Sep 2026", 104000, 76000), mk("Oct 2026", 121000, 88000), mk("Nov 2026", 34000, 21000)],
      ytd: { income: 919000, expenses: 719000, labor: 286000, materials: 221000, subs: 158000, other: 54000, top: [{ name: "Payroll Expenses: Wages", amount: 251000, bucket: "labor" }, { name: "Job Materials", amount: 221000, bucket: "materials" }, { name: "Subcontractors", amount: 158000, bucket: "subs" }, { name: "Payroll Expenses: Taxes", amount: 35000, bucket: "labor" }, { name: "Equipment Rental", amount: 21000, bucket: "other" }, { name: "Truck fuel", amount: 14000, bucket: "other" }] },
      jobs: [{ id: "58", name: "Sample Client", income: 140500, costs: 112340, net: 28160 }, { id: "61", name: "Second Client", income: 96000, costs: 101500, net: -5500 }, { id: "64", name: "Hillcrest ADU", income: 210000, costs: 158000, net: 52000 }, { id: "66", name: "Palo Alto Kitchen", income: 48000, costs: 31000, net: 17000 }],
      customers: [{ id: "58", name: "Sample Client", short: "Sample Client" }, { id: "61", name: "Second Client", short: "Second Client" }, { id: "64", name: "Hillcrest ADU", short: "Hillcrest ADU" }, { id: "66", name: "Palo Alto Kitchen", short: "Palo Alto Kitchen" }, { id: "70", name: "Morales: Backyard", short: "Backyard", parent: "69" }],
      warnings: [] });
  };
  ACTIONS.qbNewProject = function (db, me, b) {
    if (me.role !== "admin") throw new Error("Only Jesús creates projects from QuickBooks.");
    var r = ACTIONS.saveProject(db, me, { project: { name: b.name, client_name: b.client } }); var p = db.projects.filter(function (x) { return x.id === r.project.id; })[0]; p.qb_customer = String(b.customerId); return { project: r.project };
  };
  // QuickBooks writes in the preview: a pretend company that remembers what you change.
  function qbW(db, me) { if (!meOut(me).money) throw new Error("That's #money. Ask Jesús to tag you #money."); if (!(db.qb || {}).connected) throw new Error("QuickBooks isn't connected."); }
  ACTIONS.qbCreateCustomer = function (db, me, b) { qbW(db, me); var p = needProject(db, me, b.projectId); if (p.qb_customer) return { customerId: p.qb_customer, existed: true };
    p.qb_customer = String(80 + db.projects.indexOf(p)); var street = String(p.address || "").split(",")[0].trim(); return { customerId: p.qb_customer, name: street && p.client_name ? street + "/" + p.client_name : p.name }; };
  var _mSave = ACTIONS.saveInvoice;
  ACTIONS.saveInvoice = function (db, me, b) { var r = _mSave(db, me, b), it = db.invoices.filter(function (i) { return i.id === r.id; })[0] || db.invoices[db.invoices.length - 1];
    if ((b.qb || (it && it.qb_id)) && b.qb !== false && meOut(me).money && (db.qb || {}).connected && it && it.status !== "draft") {
      var p = needProject(db, me, b.projectId); if (!p.qb_customer) ACTIONS.qbCreateCustomer(db, me, { projectId: p.id });
      if (!it.qb_id) { db.qbNext = (db.qbNext || 1100) + 1; it.qb_id = String(db.qbNext); it.qb_made = "yes"; it.number = String(db.qbNext); it.pay_url = it.pay_url || "https://connect.intuit.com/pay/sample"; }
      (it.history = it.history || []).unshift({ at: now(), by: me.name, what: "updated in QuickBooks (#" + it.number + ")" });
      r.qb = { id: it.qb_id, number: it.number, voided: it.status === "void" || undefined, payment: it.status === "paid" && !it.qbPaid ? { id: "p1", amount: num(it.amount) - num(it.retainage) } : undefined }; if (it.status === "paid") it.qbPaid = 1; }
    return r; };
  var _mDel = ACTIONS.deleteInvoice;
  ACTIONS.deleteInvoice = function (db, me, b) { var it = db.invoices.filter(function (i) { return i.id === b.invoiceId; })[0], res = {};
    if (it && b.qb && it.qb_id) { if (it.qb_made !== "yes") throw new Error("Invoice " + it.number + " was made in QuickBooks, not here, so the portal won't delete it there."); res.qb = { deleted: true, number: it.number, payments: it.qbPaid ? 1 : 0 }; }
    _mDel(db, me, b); return res; };
  ACTIONS.qbSendInvoice = function (db, me, b) { qbW(db, me); return { to: "client@example.com" }; };
  function spSeed(db) {
    if (db.spend) return db.spend;
    var L = function (type, id, line, date, who, logo, amount, what, account, accountId, cust, from, bucket, extra) { return Object.assign({ type: type, id: id, line: line, date: date, who: who, logo: logo, amount: amount, what: what, account: account, accountId: accountId, item: false, cust: cust, custName: cust ? "Sample Client" : "", from: from, bucket: bucket }, extra || {}); };
    db.spend = [
      L("Purchase", "41", "1", "2026-11-05", "The Home Depot #0627", "homedepot.com", 1284.55, "Framing lumber, hangers", "Job Materials", "80", "", "Amex Business Gold", "materials"),
      L("Purchase", "42", "1", "2026-11-04", "Chevron 0091", "chevron.com", 96.4, "Truck fuel", "Truck fuel", "84", "", "Amex Business Gold", "other"),
      L("Bill", "60", "1", "2026-11-03", "Peninsula Electric", "", 8400, "Rough-in progress billing", "Subcontractors", "82", "58", "Bill · open", "subs"),
      L("Purchase", "43", "1", "2026-11-02", "Lowe's #1702", "lowes.com", 342.18, "Tile spacers, thinset", "Job Materials", "80", "", "Chase Ink", "materials"),
      L("TimeActivity", "7", "", "2026-11-02", "Miguel R.", "", 320, "Framing", "Labor", "", "58", "Timesheet", "labor", { hours: 8 }),
      L("Purchase", "44", "1", "2026-11-01", "Sunbelt Rentals", "sunbeltrentals.com", 1080, "Mini excavator, 3 days", "Equipment Rental", "83", "", "Chase Checking", "other"),
      L("Bill", "61", "1", "2026-10-30", "Vulcan Materials Company", "vulcanmaterials.com", 1000, "Base rock", "Job Materials", "80", "", "Bill · open", "materials"),
      L("Purchase", "45", "1", "2026-10-29", "Amazon", "amazon.com", 61.2, "Shop vac filters", "Supplies", "85", "", "Amex Business Gold", "materials"),
      L("Purchase", "46", "1", "2026-10-28", "Ferguson Plumbing", "ferguson.com", 2740, "Rough plumbing", "Job Materials", "80", "58", "Chase Ink", "materials"),
      L("Purchase", "47", "1", "2026-10-27", "Starbucks", "starbucks.com", 38.75, "Crew coffee", "Meals", "86", "", "Amex Business Gold", "other")];
    return db.spend;
  }
  ACTIONS.qbSpend = function (db, me, b) { qbW(db, me); var list = spSeed(db).slice(), byC = {}; db.projects.forEach(function (p) { if (p.qb_customer) byC[p.qb_customer] = p.id; });
    var only = b.projectId ? needProject(db, me, b.projectId) : null, q = String(b.q || "").toLowerCase();
    if (b.filter === "nojob") list = list.filter(function (r) { return !r.cust; });
    if (only) list = list.filter(function (r) { return only.qb_customer && r.cust === only.qb_customer; });
    if (q) list = list.filter(function (r) { return (r.who + " " + r.what + " " + r.account).toLowerCase().indexOf(q) > -1; });
    list.forEach(function (r) { r.project = byC[r.cust] || ""; });
    var off = Number(b.offset) || 0, lim = Number(b.limit) || 40;
    return { days: b.days || 60, count: list.length, total: list.reduce(function (a, r) { return a + r.amount; }, 0), noJob: list.filter(function (r) { return !r.cust; }).reduce(function (a, r) { return a + r.amount; }, 0),
      rows: list.slice(off, off + lim), more: list.length > off + lim, projects: db.projects.filter(function (p) { return p.status !== "deleted"; }).map(function (p) { return { id: p.id, name: p.name, qb: p.qb_customer || "" }; }) }; };
  ACTIONS.qbCategories = function (db, me) { qbW(db, me); return { categories: [{ id: "83", name: "Equipment Rental" }, { id: "80", name: "Job Materials" }, { id: "86", name: "Meals" }, { id: "82", name: "Subcontractors" }, { id: "85", name: "Supplies" }, { id: "84", name: "Truck fuel" }] }; };
  ACTIONS.qbAssign = function (db, me, b) { qbW(db, me); var r = spSeed(db).filter(function (x) { return x.type === b.type && x.id === b.id; })[0]; if (!r) throw new Error("Not found");
    var before = { cust: r.cust, accountId: r.accountId, account: r.account }, p = null;
    if (b.projectId) { p = needProject(db, me, b.projectId); if (!p.qb_customer) ACTIONS.qbCreateCustomer(db, me, { projectId: p.id }); r.cust = p.qb_customer; }
    else if (b.customerId != null) r.cust = b.customerId;
    if (b.accountId) { r.accountId = b.accountId; r.account = ({ 83: "Equipment Rental", 80: "Job Materials", 86: "Meals", 82: "Subcontractors", 85: "Supplies", 84: "Truck fuel" })[b.accountId] || r.account; }
    db.qbLog = db.qbLog || []; var lid = "q" + db.qbLog.length; db.qbLog.push({ id: lid, type: b.type, txn: b.id, before: before }); return { logId: lid, project: p ? p.id : "" }; };
  ACTIONS.qbUndo = function (db, me, b) { qbW(db, me); var l = (db.qbLog || []).filter(function (x) { return x.id === b.logId; })[0]; if (!l || l.undone) throw new Error("Nothing to undo.");
    var r = spSeed(db).filter(function (x) { return x.type === l.type && x.id === l.txn; })[0]; Object.assign(r, l.before); l.undone = 1; return {}; };
  var VIEWABLE = { listProjects: 1, getProject: 1, activity: 1, planImage: 1, planText: 1 };
  function previewMe(db, role) {
    if (["client", "architect", "crew"].indexOf(role) < 0) throw new Error("Pick #client, #architect or #crew to preview.");
    var l = db.projects.filter(function (p) { return p.status !== "deleted"; }).map(function (p) { return p.id; });
    return { email: "preview-" + role + "@preview.invalid", name: { client: "Client preview", architect: "Architect preview", crew: "Crew preview" }[role], role: role, project_ids: l.join(","), active: "yes", avatar: "", preview: role };
  }

  window.BSP_MOCK = function (b) {
    return new Promise(function (resolve) {
      setTimeout(function () {
        var db = load(), res;
        try {
          var fn = PUBLIC[b.action];
          if (fn) res = fn(db, b);
          else { var me = auth(db, b.token);
            if (b.viewAs) { if (me.role !== "admin") throw new Error("Only Jesús can preview the portal."); if (!VIEWABLE[b.action]) throw new Error("You're in preview. Exit the preview to change things."); me = previewMe(db, b.viewAs); }
            fn = ACTIONS[b.action]; if (!fn) throw new Error("Unknown action."); res = fn(db, me, b); }
          save(db); res = res || {}; res.ok = true;
        } catch (e) { res = { ok: false, error: e.message }; }
        resolve(JSON.parse(JSON.stringify(res)));
      }, 120);
    });
  };
  window.BSP_MOCK.reset = function () { localStorage.removeItem(KEY); };
  window.BSP_MOCK.outbox = function () { return load().outbox; };
})();
