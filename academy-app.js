/* Blue Sierra Academy — dashboard engine.
   Needs: window.BSA_CONTENT (academy-content.js) and a <div id="bs-academy"></div> on the page.
   Login + saved progress come from Memberstack (window.$memberstackDom). Without Memberstack it runs in demo mode. */
(function () {
  "use strict";
  var C = window.BSA_CONTENT;
  var root = document.getElementById("bs-academy");
  if (!C || !root) return;
  // Site settings set in the Webflow page itself (so they never live in the public repo):
  // window.BSA_SETTINGS = { loginPhoto: "...", heroPhoto: "...", callsApi: "https://script.google.com/macros/s/.../exec" }
  var SET = window.BSA_SETTINGS || {};
  if (SET.loginPhoto) C.brand.loginPhoto = SET.loginPhoto;
  if (SET.heroPhoto) C.brand.heroPhoto = SET.heroPhoto;
  if (SET.callsApi) { C.calls = C.calls || {}; C.calls.api = SET.callsApi; }

  var LOGO = '<svg class="logo" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 265 33" fill="none" aria-label="Blue Sierra">' + C.brand.logoPaths + "</svg>";
  var ms = null;          // Memberstack DOM object when available
  var member = null;      // { id, email, name, fields }
  var S = null;           // saved progress
  var view = { tab: "home", module: null, quizAnswers: {}, quizDone: false, sim: null, drill: null };

  /* ---------- helpers ---------- */
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
  function initials(n) { return (n || "?").split(/\s+/).filter(Boolean).slice(0, 2).map(function (w) { return w[0].toUpperCase(); }).join(""); }
  function first(n) { return (n || "").split(/\s+/)[0] || "there"; }
  function today() { var d = new Date(); return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0"); }
  function fmtDate(iso) { try { return new Date(iso + "T12:00:00").toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" }); } catch (e) { return iso; } }
  function bg(url) { return url && !/^PASTE_/.test(url) ? "background-image:url('" + esc(url) + "')" : ""; }
  function toast(msg) {
    var t = root.querySelector(".toast"); if (!t) { t = document.createElement("div"); t.className = "toast"; root.appendChild(t); }
    t.textContent = msg; t.classList.add("show"); clearTimeout(t._h); t._h = setTimeout(function () { t.classList.remove("show"); }, 2400);
  }
  function shuffleSeeded(arr, seed) {
    var a = arr.slice(), s = 0; for (var i = 0; i < seed.length; i++) s = (s * 31 + seed.charCodeAt(i)) >>> 0;
    for (var j = a.length - 1; j > 0; j--) { s = (s * 1103515245 + 12345) >>> 0; var k = s % (j + 1); var tmp = a[j]; a[j] = a[k]; a[k] = tmp; }
    return a;
  }

  /* ---------- storage: Memberstack JSON, or localStorage in demo ---------- */
  var KEY = "bsa-demo-progress";
  function blank() { return { started: today(), modules: {}, final: null, sim: null, drill: null, checks: {}, certified: null, events: [] }; }
  var loaded = false, hadRemote = false;            // never write to Memberstack until a load has succeeded
  async function readRemote() {
    var lastErr;
    for (var i = 0; i < 3; i++) {
      try { var r = await ms.getMemberJSON(); return (r && r.data) || {}; }
      catch (e) { lastErr = e; await new Promise(function (res) { setTimeout(res, 600 * (i + 1)); }); }
    }
    throw lastErr || new Error("Could not load your progress.");
  }
  async function load() {
    if (ms) {
      var d = await readRemote();                    // throws after 3 tries: the caller shows "Retry", it never saves a blank record
      hadRemote = !!d.academy; loaded = true;
      return Object.assign(blank(), d.academy || {});
    }
    loaded = true;
    try { return Object.assign(blank(), JSON.parse(localStorage.getItem(KEY) || "{}")); } catch (e) { return blank(); }
  }
  /* Progress only moves forward, so two tabs (or a stale tab) merge instead of overwriting each other. */
  function earliest(a, b) { return !a ? b || null : !b ? a : (a < b ? a : b); }
  function mergeRec(a, b) {
    if (!a) return b || null; if (!b) return a;
    var more = (b.tries || 0) > (a.tries || 0) ? b : a;
    return { tries: Math.max(a.tries || 0, b.tries || 0), best: Math.max(a.best || 0, b.best || 0), passed: earliest(a.passed, b.passed) || undefined, last: more.last };
  }
  function mergeProgress(remote, local) {
    var out = Object.assign(blank(), remote || {}, local || {});
    out.started = earliest((remote || {}).started, (local || {}).started) || today();
    out.modules = {};
    Object.keys(Object.assign({}, (remote || {}).modules, (local || {}).modules)).forEach(function (k) { out.modules[k] = mergeRec(((remote || {}).modules || {})[k], ((local || {}).modules || {})[k]); });
    ["final", "sim", "drill"].forEach(function (k) { out[k] = mergeRec((remote || {})[k], (local || {})[k]); });
    ["certified", "acknowledged"].forEach(function (k) { out[k] = earliest((remote || {})[k], (local || {})[k]); });
    out.checks = Object.assign({}, (remote || {}).checks, (local || {}).checks);
    var seen = {}; out.events = [].concat((remote || {}).events || [], (local || {}).events || []).filter(function (e) { var k = e.at + "|" + e.event + "|" + e.detail; if (seen[k]) return false; seen[k] = 1; return true; })
      .sort(function (a, b) { return a.at < b.at ? -1 : 1; });
    return out;
  }
  var saveChain = Promise.resolve(), saveTimer = null;
  function save() {
    if (!ms) { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) {} return; }
    if (!loaded) return;
    clearTimeout(saveTimer);
    saveTimer = setTimeout(function () {
      saveChain = saveChain.then(async function () {      // one save at a time from this tab
        try {
          var d = await readRemote(), merged = mergeProgress(d.academy, S);
          d.academy = merged; S = merged;
          await ms.updateMemberJSON({ json: d });
        } catch (e) { toast("Could not save. Check your connection."); }
      });
    }, 300);
  }

  /* Sends an event to the Webflow form "Academy Progress" if it is on the page (Jesús gets an email per event). */
  function report(event, detail, score) {
    if (ms && !loaded) return;
    S.events.push({ at: new Date().toISOString(), event: event, detail: detail || "", score: score == null ? "" : score });
    save();
    submitWebflowForm(C.webflowForms.progress, {
      Name: member.name, Role: member.roleLabel,
      Module: detail ? event + " · " + detail : event,
      Score: score == null ? "" : String(score), Timestamp: new Date().toISOString(), Email: member.email
    });
  }
  /* Fills a Webflow form that sits (hidden) on the page and submits it, so Webflow emails Jesús and keeps the entry. */
  function submitWebflowForm(name, values) {
    var form = document.querySelector('form[data-name="' + name + '"]');
    if (!form) return false;
    Object.keys(values).forEach(function (k) {
      var input = form.querySelector('[name="' + k + '"]');
      if (!input) { input = document.createElement("input"); input.type = "hidden"; input.name = k; form.appendChild(input); }
      if (input.type === "checkbox") input.checked = !!values[k]; else input.value = values[k];
    });
    try { form.requestSubmit ? form.requestSubmit() : form.submit(); return true; } catch (e) { return false; }
  }

  /* ---------- progress math ---------- */
  var MODS = C.course.modules;
  function modState(id) { return S.modules[id] || {}; }
  function modPassed(id) { return !!modState(id).passed; }
  function modUnlocked(i) { return i === 0 || modPassed(MODS[i - 1].id); }
  function passedCount() { return MODS.filter(function (m) { return modPassed(m.id); }).length; }
  function checksDone() { return C.checklist.filter(function (c) { return S.checks[c.id]; }).length; }
  /* Required steps: the modules and the final exam. The drill and simulator are practice and never block. */
  function stepsAll() {
    var steps = MODS.map(function (m) { return modPassed(m.id); });
    steps.push(!!(S.final && S.final.passed));
    return steps;
  }
  function practiceReady(kind) {
    if (kind === "final") return passedCount() === MODS.length;
    var cfg = kind === "drill" ? C.drill : C.simulator;
    return passedCount() >= cfg.afterModule && MODS.slice(0, cfg.afterModule).every(function (m) { return modPassed(m.id); });
  }
  function pct() { var s = stepsAll(); return Math.round(s.filter(Boolean).length / s.length * 100); }
  function avgScore() {
    var sc = MODS.map(function (m) { return modState(m.id).best; }).filter(function (x) { return typeof x === "number"; });
    return sc.length ? Math.round(sc.reduce(function (a, b) { return a + b; }, 0) / sc.length) : null;
  }
  function nextStep() {
    for (var i = 0; i < MODS.length; i++) if (!modPassed(MODS[i].id)) return { kind: "module", i: i, title: MODS[i].title, label: "Module " + (i + 1) };
    if (!(S.final && S.final.passed)) return { kind: "final", title: "Final certification exam", label: "Final exam" };
    return { kind: "cert", title: "You are certified", label: "Certificate" };
  }
  function certReady() { return stepsAll().every(Boolean); }

  /* ---------- member info ("My info") ---------- */
  function field(key) {
    var f = C.memberFields[key]; if (!f) return null;
    var v = member.fields && member.fields[f.ms];
    if (v == null || v === "") v = f.fallback;
    return v;
  }

  /* ---------- rendering ---------- */
  function render() {
    if (!member) return renderLogin();
    var tabs = [
      ["home", "Overview", ""],
      ["info", "My info", ""],
      ["course", "Course", passedCount() + "/" + MODS.length],
      ["practice", "Practice", ""],
      ["checklist", "First week", checksDone() + "/" + C.checklist.length],
      ["cert", "Certificate", certReady() ? "✓" : ""]
    ];
    // Extra tabs from other files (academy-workspace.js): window.BSA_TABS = [{ id, label, count(ctx), visible(ctx), render(ctx), mounted(el, ctx) }]
    var cx = ctx(), ext = (window.BSA_TABS || []).filter(function (t) { return !t.visible || t.visible(cx); });
    ext.forEach(function (t) { tabs.push([t.id, t.label, t.count ? t.count(cx) : ""]); });
    var extTab = ext.filter(function (t) { return t.id === view.tab; })[0];
    var body = extTab ? extTab.render(cx) : ({
      home: renderHome, info: renderInfo, course: view.module != null ? renderLesson : renderCourse,
      practice: renderPractice, checklist: renderChecklist, cert: renderCert, final: renderFinal
    }[view.tab] || renderHome)();
    root.innerHTML =
      '<header class="topbar"><div class="brand">' + LOGO + "<span>" + esc(C.brand.academyName) + "</span></div>" +
      '<div class="who"><span class="name">' + esc(member.name) + '</span><div class="avatar">' + esc(initials(member.name)) + "</div>" +
      '<button class="btn ghost small" data-act="logout">Log out</button></div></header>' +
      '<div class="layout"><nav class="nav">' +
      tabs.map(function (t) { return '<button data-tab="' + t[0] + '" class="' + (view.tab === t[0] || (view.tab === "final" && t[0] === "practice") ? "on" : "") + '"><span>' + t[1] + '</span><span class="count">' + t[2] + "</span></button>"; }).join("") +
      '</nav><main class="main">' + body + "</main></div>";
    window.scrollTo({ top: 0, behavior: "instant" in window ? "instant" : "auto" });
    if (extTab && extTab.mounted) extTab.mounted(root.querySelector(".main"), cx);
  }
  function ctx() {
    return {
      member: member, state: S, content: C, esc: esc, toast: toast, save: save, report: report, rerender: render,
      certified: !!(S && S.final && S.final.passed), demo: !ms,
      token: async function () { try { return ms && ms.getMemberCookie ? await ms.getMemberCookie() : null; } catch (e) { return null; } }
    };
  }

  function renderLogin() {
    // Preview mode only when it is allowed AND Memberstack is absent. With demoAllowed false and no Memberstack, nobody gets in.
    var demo = !ms && C.demoAllowed === true;
    root.innerHTML =
      '<section class="login" style="' + bg(C.brand.loginPhoto) + '"><div class="login-inner">' + LOGO +
      '<div class="eyebrow">' + esc(C.brand.academyName) + "</div><h1>Welcome to the team.</h1>" +
      "<p>" + esc(C.brand.loginBlurb) + "</p>" +
      (ms
        ? '<div class="row"><button class="btn light" data-act="login">Log in</button></div>'
        : demo
          ? '<div class="row"><input id="bsa-demo-name" placeholder="Your name" value="Timothy Demo"><button class="btn light" data-act="demo-login">Enter preview</button></div><p class="demo-note">Preview mode: Memberstack is not on this page, so progress is saved only in this browser.</p>'
          : '<p class="demo-note">Login is not available right now. Refresh the page, and if it keeps happening, message Jesús.</p>') +
      '<div class="tagline">' + esc(C.brand.tagline) + "</div></div></section>";
  }

  function hero(title, sub) {
    var p = pct();
    return '<section class="hero" style="' + bg(C.brand.heroPhoto) + '"><div class="hero-flex"><div>' +
      '<div class="eyebrow">' + esc(member.roleLabel) + "</div><h1>" + title + "</h1><p>" + sub + "</p></div>" +
      '<div class="ring" style="--p:' + p + '"><div><div><b>' + p + "%</b><small>complete</small></div></div></div></div></section>";
  }

  function renderHome() {
    var n = nextStep(), sc = avgScore();
    var days = Math.max(1, Math.round((Date.now() - new Date(S.started + "T00:00:00").getTime()) / 864e5) + 1);
    return hero("Welcome, " + esc(first(member.name)) + ".", esc(C.brand.welcome)) +
      '<div class="card next"><div><div class="eyebrow">Up next · ' + esc(n.label) + "</div><h3>" + esc(n.title) + "</h3><p>" +
      (n.kind === "cert" ? "Everything is done. Print your certificate." : "Pick up where you left off.") + '</p></div><button class="btn light" data-act="go-next">' + (n.kind === "cert" ? "View certificate" : "Continue") + "</button></div>" +
      '<div class="grid g4" style="margin-top:16px">' +
      stat("Modules passed", passedCount() + "/" + MODS.length, "Pass mark " + C.course.passMark + "%") +
      stat("Average score", sc == null ? "—" : sc + "%", "Best attempt per module") +
      stat("First week", checksDone() + "/" + C.checklist.length, "Setup tasks done") +
      stat("Day", String(days), "Since you started") +
      "</div>" +
      '<div class="section-title"><h2>Your course</h2><button class="link" data-tab="course">See all</button></div>' +
      '<div class="modules">' + MODS.slice(0, 4).map(modRow).join("") + "</div>" +
      '<div class="section-title"><h2>Your people</h2></div>' + peopleCard();
  }
  function stat(label, big, small) { return '<div class="card stat"><div class="eyebrow">' + label + "</div><b>" + big + "</b><span>" + small + "</span></div>"; }

  function peopleCard() {
    return '<div class="card people">' + C.people.map(function (p) {
      return '<div class="person"><div class="avatar">' + esc(initials(p.name)) + '</div><div><b>' + esc(p.name) + '</b><div class="muted" style="font-size:14px">' + esc(p.role) + (p.contact ? " · " + esc(p.contact) : "") + "</div></div></div>";
    }).join("") + "</div>";
  }

  function renderInfo() {
    var cards = C.infoCards.map(function (key) {
      var f = C.memberFields[key], v = field(key), pending = !v;
      var isLink = v && /^https?:\/\//.test(v);
      return '<div class="card info"><div class="eyebrow">' + esc(f.label) + "</div>" +
        '<div class="value' + (pending ? " pending" : "") + '">' + (pending ? "Pending — Jesús will add this" : isLink ? '<a href="' + esc(v) + '" target="_blank" rel="noopener">' + esc(v.replace(/^https?:\/\//, "")) + "</a>" : esc(v)) + "</div>" +
        (v && f.copy ? '<button class="copy" data-copy="' + esc(v) + '">Copy</button>' : "") +
        (f.hint ? '<div class="hint">' + esc(f.hint) + "</div>" : "") + "</div>";
    }).join("");
    return '<div class="eyebrow">Your employee file</div><div class="section-title" style="margin-top:6px"><h2>My info</h2></div>' +
      '<p class="muted" style="margin-bottom:18px;max-width:640px">Everything you need to work: your contact details, tools and pay. If something is missing or wrong, message Jesús.</p>' +
      '<div class="grid g3">' + cards + "</div>" +
      '<div class="notice" style="margin-top:18px">' + esc(C.passwordNote) + "</div>" +
      '<div class="section-title"><h2>Tools</h2></div><div class="grid g2">' +
      C.tools.map(function (t) { return '<div class="card"><h3>' + esc(t.name) + '</h3><p class="muted">' + esc(t.what) + "</p>" + (t.url ? '<p style="margin-top:10px"><a href="' + esc(t.url) + '" target="_blank" rel="noopener">Open ↗</a></p>' : "") + "</div>"; }).join("") +
      '</div><div class="section-title"><h2>Your people</h2></div>' + peopleCard();
  }

  function modRow(m) {
    var i = MODS.indexOf(m), st = modState(m.id), open = modUnlocked(i);
    var tag = st.passed ? '<span class="pill ok">Passed · ' + st.best + "%</span>" : !open ? '<span class="pill">Locked</span>' : st.tries ? '<span class="pill gold">Retry · best ' + st.best + "%</span>" : '<span class="pill">' + esc(m.duration || "") + "</span>";
    return '<button class="mod' + (st.passed ? " done" : "") + '" data-module="' + i + '"' + (open ? "" : " disabled") + '><div class="num">' + (st.passed ? "✓" : i + 1) + "</div><div><h4>" + esc(m.title) + "</h4><p>" + esc(m.summary || "") + "</p></div>" + tag + "</button>";
  }

  function renderCourse() {
    return '<div class="eyebrow">' + esc(C.course.title) + '</div><div class="section-title" style="margin-top:6px"><h2>Course</h2><span class="muted">' + passedCount() + " of " + MODS.length + " passed</span></div>" +
      '<p class="muted" style="margin-bottom:18px;max-width:640px">Watch each video, then pass the short exam with ' + C.course.passMark + "% or more to unlock the next module. You can retry as many times as you need.</p>" +
      '<div class="modules">' + MODS.map(modRow).join("") + "</div>" +
      '<div class="section-title"><h2>After the modules</h2></div><div class="grid g3">' +
      (C.drill ? practiceCard("drill", C.drill.title, C.drill.blurb, S.drill) : "") +
      (C.simulator ? practiceCard("sim", C.simulator.title, C.simulator.blurb, S.sim) : "") +
      practiceCard("final", "Final certification exam", C.course.finalCount + " questions from all modules. Pass mark " + C.course.finalPassMark + "%.", S.final) + "</div>";
  }
  function practiceCard(kind, title, blurb, st) {
    var ready = practiceReady(kind);
    var after = kind === "final" ? MODS.length : (kind === "drill" ? C.drill : C.simulator).afterModule;
    var tag = kind === "final" ? "Required" : "Practice";
    return '<div class="card" style="display:flex;flex-direction:column;gap:10px"><div class="eyebrow">' + tag + "</div><h3>" + esc(title) + '</h3><p class="muted">' + esc(blurb) + "</p>" +
      '<div style="margin-top:auto;display:flex;justify-content:space-between;align-items:center;gap:10px">' +
      (st && st.passed ? '<span class="pill ok">Passed · ' + st.best + "%</span>" : st && st.tries ? '<span class="pill gold">Best ' + st.best + "%</span>" : '<span class="pill">' + (ready ? "Ready" : "After module " + after) + "</span>") +
      '<button class="btn small" data-start="' + kind + '"' + (ready ? "" : " disabled") + ">" + (st && st.passed ? "Retake" : "Start") + "</button></div></div>";
  }

  /* ----- lesson + module quiz ----- */
  function videoBlock(m) {
    if (!m.video) return '<div class="video"><div class="empty">Video coming soon.</div></div>';
    var v = m.video, src = v;
    var drive = v.match(/drive\.google\.com\/file\/d\/([^/]+)/);
    if (drive) src = "https://drive.google.com/file/d/" + drive[1] + "/preview";
    if (/\.(mp4|webm)(\?|$)/.test(v)) return '<div class="video"><video src="' + esc(v) + '" controls playsinline preload="metadata"></video></div>';
    return '<div class="video"><iframe src="' + esc(src) + '" allow="autoplay; fullscreen" allowfullscreen loading="lazy" title="' + esc(m.title) + '"></iframe></div>';
  }
  function renderLesson() {
    var i = view.module, m = MODS[i], st = modState(m.id);
    var qs = m.quiz || [];
    var answered = Object.keys(view.quizAnswers).length;
    var quizHtml = qs.map(function (q, qi) { return questionHtml(q, qi, view.quizAnswers[qi], view.quizDone); }).join("");
    var res = "";
    if (view.quizDone) {
      var sc = scoreOf(qs, view.quizAnswers), pass = sc >= C.course.passMark;
      res = '<div class="result ' + (pass ? "pass" : "fail") + '"><div><b>' + sc + "%</b> " + (pass ? " · Passed. Nice work." : " · Not yet. You need " + C.course.passMark + "%.") + "</div>" +
        (pass ? (i + 1 < MODS.length ? '<button class="btn" data-module="' + (i + 1) + '">Next module →</button>' : '<button class="btn" data-tab="course">Back to course</button>') : '<button class="btn" data-act="retry">Try again</button>') + "</div>";
    }
    return '<div class="crumbs"><button class="link" data-tab="course">Course</button><span>/</span><span>Module ' + (i + 1) + "</span></div>" +
      '<div class="lesson"><div>' + videoBlock(m) +
      '<div class="eyebrow">Module ' + (i + 1) + (m.duration ? " · " + esc(m.duration) : "") + '</div><h2 style="font-size:30px;margin:6px 0 10px">' + esc(m.title) + "</h2>" +
      (m.summary ? '<p class="muted">' + esc(m.summary) + "</p>" : "") +
      '<ul class="points">' + (m.points || []).map(function (p) { return "<li><span>" + esc(p) + "</span></li>"; }).join("") + "</ul>" +
      (m.script ? '<div class="script">' + esc(m.script) + "</div>" : "") +
      lessonPractice(i) +
      (qs.length ? '<div class="section-title"><h2>Module exam</h2><span class="muted">' + qs.length + " questions · pass " + C.course.passMark + "%</span></div>" +
        '<div class="quiz">' + quizHtml + "</div>" +
        (view.quizDone ? '<div style="margin-top:20px">' + res + "</div>" :
          '<div style="margin-top:20px;display:flex;gap:12px;align-items:center"><button class="btn" data-act="grade"' + (answered < qs.length ? " disabled" : "") + '>Check answers</button><span class="muted">' + answered + "/" + qs.length + " answered</span></div>") : "") +
      '</div><aside class="side"><div class="card"><div class="eyebrow" style="margin-bottom:12px">Modules</div><div class="steps">' +
      MODS.map(function (mm, j) { return '<div><span class="dot' + (modPassed(mm.id) ? " on" : "") + '">' + (modPassed(mm.id) ? "✓" : "") + "</span><span" + (j === i ? ' style="font-weight:500"' : ' class="muted"') + ">" + (j + 1) + ". " + esc(mm.title) + "</span></div>"; }).join("") +
      "</div></div>" + (st.tries ? '<div class="card"><div class="eyebrow">Your best</div><b style="font-size:28px;font-weight:500">' + st.best + '%</b><div class="muted" style="font-size:13px">' + st.tries + " attempt" + (st.tries > 1 ? "s" : "") + "</div></div>" : "") +
      "</aside></div>";
  }
  /* Module 4 carries the qualify drill and module 6 the call simulator. */
  function lessonPractice(i) {
    var kind = C.drill && i === C.drill.afterModule ? "drill" : C.simulator && i === C.simulator.afterModule ? "sim" : null;
    if (!kind) return "";
    var cfg = kind === "drill" ? C.drill : C.simulator, st = kind === "drill" ? S.drill : S.sim;
    return '<div class="card" style="margin-top:20px;display:flex;justify-content:space-between;align-items:center;gap:16px;flex-wrap:wrap"><div><div class="eyebrow">Practice for this module</div><h3 style="margin-top:4px">' + esc(cfg.title) + '</h3><p class="muted">' + esc(cfg.blurb) + "</p></div>" +
      (st && st.tries ? '<span class="pill ' + (st.passed ? "ok" : "gold") + '">Best ' + st.best + "%</span>" : "") +
      '<button class="btn small" data-start="' + kind + '">' + (st && st.tries ? "Practice again" : "Start") + "</button></div>";
  }
  function questionHtml(q, qi, picked, done) {
    return '<div class="q"><h4>' + (qi + 1) + ". " + esc(q.q) + '</h4><div class="opts">' +
      q.options.map(function (o, oi) {
        var cls = "opt";
        if (picked === oi) cls += " sel";
        if (done && oi === q.answer) cls += " right";
        else if (done && picked === oi) cls += " wrong";
        return '<button class="' + cls + '" data-q="' + qi + '" data-o="' + oi + '"' + (done ? " disabled" : "") + '><span class="key">' + "ABCD"[oi] + "</span><span>" + esc(o) + "</span></button>";
      }).join("") + "</div>" + (done && q.why ? '<p class="why">' + esc(q.why) + "</p>" : "") + "</div>";
  }
  function scoreOf(qs, ans) { var ok = 0; qs.forEach(function (q, i) { if (ans[i] === q.answer) ok++; }); return qs.length ? Math.round(ok / qs.length * 100) : 0; }

  /* ----- practice: drill, simulator, final ----- */
  function renderPractice() {
    if (view.sim) return renderSim();
    if (view.drill) return renderDrill();
    return '<div class="eyebrow">Practice</div><div class="section-title" style="margin-top:6px"><h2>Practice and certification</h2></div>' +
      '<p class="muted" style="margin-bottom:18px;max-width:640px">The drill opens after module ' + C.drill.afterModule + " and the simulator after module " + C.simulator.afterModule + ". They're practice: aim for " + C.drill.passMark + "%, retry as much as you like. The final exam opens after all " + MODS.length + " modules and is required for your certificate.</p>" +
      '<div class="grid g3">' +
      (C.drill ? practiceCard("drill", C.drill.title, C.drill.blurb, S.drill) : "") +
      (C.simulator ? practiceCard("sim", C.simulator.title, C.simulator.blurb, S.sim) : "") +
      practiceCard("final", "Final certification exam", C.course.finalCount + " questions from all modules. Pass mark " + C.course.finalPassMark + "%.", S.final) + "</div>";
  }

  function renderDrill() {
    var d = view.drill, cards = d.cards, i = d.i;
    if (i >= cards.length) {
      var sc = Math.round(d.ok / cards.length * 100), pass = sc >= C.drill.passMark;
      return '<div class="crumbs"><button class="link" data-act="leave-practice">Practice</button><span>/</span><span>' + esc(C.drill.title) + "</span></div>" +
        '<div class="result ' + (pass ? "pass" : "fail") + '"><div><b>' + sc + "%</b> · " + d.ok + " of " + cards.length + " right. " + (pass ? "Passed." : "You need " + C.drill.passMark + "%.") + '</div><div style="display:flex;gap:10px"><button class="btn ghost" data-start="drill">Again</button><button class="btn" data-act="leave-practice">Done</button></div></div>';
    }
    var c = cards[i];
    return '<div class="crumbs"><button class="link" data-act="leave-practice">Practice</button><span>/</span><span>' + esc(C.drill.title) + "</span><span>·</span><span>" + (i + 1) + "/" + cards.length + "</span></div>" +
      '<div class="bar" style="margin-bottom:22px"><i style="width:' + (i / cards.length * 100) + '%"></i></div>' +
      '<div class="card" style="max-width:720px"><div class="eyebrow">Prospect</div><h3 style="margin:8px 0 14px;font-size:22px">' + esc(c.prospect) + "</h3>" +
      '<div class="opts">' + C.drill.choices.map(function (ch, ci) {
        var cls = "opt"; if (d.picked != null) { if (ci === c.answer) cls += " right"; else if (ci === d.picked) cls += " wrong"; }
        return '<button class="' + cls + '" data-drill="' + ci + '"' + (d.picked != null ? " disabled" : "") + '><span class="key">' + "ABCD"[ci] + "</span><span>" + esc(ch) + "</span></button>";
      }).join("") + "</div>" +
      (d.picked != null ? '<p class="why">' + esc(c.why) + '</p><div style="margin-top:16px"><button class="btn" data-act="drill-next">' + (i + 1 < cards.length ? "Next" : "See result") + "</button></div>" : "") + "</div>";
  }

  function say(t) { return t.replace(/\[Setter\]/g, first(member.name)); }
  function renderSim() {
    var s = view.sim, steps = C.simulator.steps, max = steps.length * C.simulator.bestPoints;
    var html = '<div class="crumbs"><button class="link" data-act="leave-practice">Practice</button><span>/</span><span>' + esc(C.simulator.title) + "</span></div>" +
      '<div class="card" style="max-width:780px"><div class="eyebrow">' + esc(C.simulator.setup) + '</div><div class="chat">';
    for (var i = 0; i < s.log.length; i++) {
      var st = steps[i], pick = st.options[s.log[i]];
      html += '<div class="bubble them"><span class="tag">' + esc(C.simulator.them) + "</span>" + esc(st.prompt) + "</div>" +
        '<div class="bubble me"><span class="tag">You</span>' + esc(say(pick.text)) + "</div>" +
        '<div class="feedback ' + (pick.points >= C.simulator.bestPoints ? "good" : pick.points >= 0 ? "meh" : "bad") + '">' + (pick.points > 0 ? "+" : "") + pick.points + " · " + esc(pick.feedback) + "</div>";
    }
    if (s.log.length < steps.length) {
      var cur = steps[s.log.length];
      html += '<div class="bubble them"><span class="tag">' + esc(C.simulator.them) + "</span>" + esc(cur.prompt) + "</div></div>" +
        '<div class="eyebrow" style="margin-bottom:8px">How do you answer? · step ' + (s.log.length + 1) + " of " + steps.length + '</div><div class="opts">' +
        cur.options.map(function (o, oi) { return '<button class="opt" data-sim="' + oi + '"><span class="key">' + "ABC"[oi] + "</span><span>" + esc(say(o.text)) + "</span></button>"; }).join("") + "</div>";
    } else {
      var pts = s.log.reduce(function (a, oi, i) { return a + steps[i].options[oi].points; }, 0);
      var sc = Math.max(0, Math.round(pts / max * 100)), pass = sc >= C.simulator.passMark;
      html += "</div>" + '<div class="result ' + (pass ? "pass" : "fail") + '"><div><b>' + sc + "%</b> · " + pts + " of " + max + " points. " + (pass ? "Passed." : "You need " + C.simulator.passMark + "%.") + '</div><div style="display:flex;gap:10px"><button class="btn ghost" data-start="sim">Call again</button><button class="btn" data-act="leave-practice">Done</button></div></div>';
    }
    return html + "</div>";
  }

  function finalQuestions() {
    var pool = []; MODS.forEach(function (m) { (m.quiz || []).forEach(function (q) { pool.push(q); }); });
    return shuffleSeeded(pool, member.id + ":" + ((S.final && S.final.tries) || 0)).slice(0, C.course.finalCount);
  }
  function renderFinal() {
    var qs = view.finalQs, answered = Object.keys(view.quizAnswers).length, res = "";
    if (view.quizDone) {
      var sc = scoreOf(qs, view.quizAnswers), pass = sc >= C.course.finalPassMark;
      res = '<div class="result ' + (pass ? "pass" : "fail") + '"><div><b>' + sc + "%</b> · " + (pass ? "Passed." : "You need " + C.course.finalPassMark + "%. You get a new set of questions next try.") + "</div>" +
        (pass ? '<button class="btn" data-tab="cert">See certificate</button>' : '<button class="btn" data-start="final">Try again</button>') + "</div>";
    }
    return '<div class="crumbs"><button class="link" data-act="leave-practice">Practice</button><span>/</span><span>Final exam</span></div>' +
      '<div style="max-width:780px"><h2 style="font-size:30px;margin-bottom:6px">Final certification exam</h2><p class="muted" style="margin-bottom:22px">' + qs.length + " questions · pass " + C.course.finalPassMark + "%</p>" +
      '<div class="quiz">' + qs.map(function (q, qi) { return questionHtml(q, qi, view.quizAnswers[qi], view.quizDone); }).join("") + "</div>" +
      '<div style="margin-top:20px">' + (view.quizDone ? res : '<div style="display:flex;gap:12px;align-items:center"><button class="btn" data-act="grade-final"' + (answered < qs.length ? " disabled" : "") + '>Submit exam</button><span class="muted">' + answered + "/" + qs.length + " answered</span></div>") + "</div></div>";
  }

  /* ----- checklist + certificate ----- */
  function renderChecklist() {
    var done = checksDone(), total = C.checklist.length;
    return '<div class="eyebrow">First week</div><div class="section-title" style="margin-top:6px"><h2>Setup checklist</h2><span class="muted">' + done + " of " + total + "</span></div>" +
      '<div class="bar" style="margin-bottom:18px"><i style="width:' + (done / total * 100) + '%"></i></div><div class="checks">' +
      C.checklist.map(function (c) {
        var on = !!S.checks[c.id];
        return '<button class="check' + (on ? " on" : "") + '" data-check="' + esc(c.id) + '"><span class="box">' + (on ? "✓" : "") + '</span><span><span class="t">' + esc(c.title) + "</span>" + (c.detail ? "<small>" + esc(c.detail) + "</small>" : "") + "</span>" + (c.day ? '<span class="pill">' + esc(c.day) + "</span>" : "<span></span>") + "</button>";
      }).join("") + "</div>";
  }
  function renderCert() {
    if (!certReady()) {
      var left = stepsAll().filter(function (x) { return !x; }).length;
      return '<div class="card locked"><div class="eyebrow">Certificate</div><h2 style="font-size:30px;margin:10px 0">Almost there.</h2><p class="muted">' + left + " step" + (left > 1 ? "s" : "") + ' left: the modules, the practice and the final exam.</p><div style="margin-top:20px"><button class="btn" data-act="go-next">Continue</button></div></div>';
    }
    if (!S.certified) { S.certified = today(); save(); report("Certified", C.course.title, S.final && S.final.best); }
    return '<div class="cert">' + LOGO + '<div class="eyebrow">Certificate of completion</div><h2 class="serif">' + esc(member.name) + "</h2>" +
      '<p class="muted">has completed the</p><p style="font-size:20px;margin-top:6px">' + esc(C.course.title) + "</p>" +
      '<p class="muted" style="margin-top:6px">Final exam score ' + (S.final ? S.final.best : "") + "% · " + fmtDate(S.certified) + "</p>" +
      '<div class="sig"><div>' + esc(C.brand.signer) + "</div><div>" + esc(C.brand.company) + "</div></div></div>" +
      '<div style="margin-top:18px;text-align:center"><button class="btn" data-act="print">Print or save as PDF</button></div>' +
      (S.acknowledged
        ? '<div class="notice" style="margin-top:22px;text-align:center">Certification sent to Jesús on ' + fmtDate(S.acknowledged) + ".</div>"
        : '<div class="card" style="margin-top:22px"><h3>Send your certification to Jesús</h3><p class="muted" style="margin-bottom:14px">One last step before your first call.</p>' +
          '<label style="display:flex;gap:12px;align-items:flex-start;cursor:pointer"><input type="checkbox" id="bsa-ack" style="margin-top:4px;width:18px;height:18px"><span>' + esc(C.course.acknowledge) + "</span></label>" +
          '<div style="margin-top:16px"><button class="btn" data-act="certify">Send certification</button></div></div>');
  }

  /* ---------- events ---------- */
  root.addEventListener("click", async function (e) {
    var b = e.target.closest("button,[data-copy]"); if (!b || !root.contains(b)) return;
    var d = b.dataset;
    if (d.tab) { view.tab = d.tab; view.module = null; view.sim = null; view.drill = null; return render(); }
    if (d.module != null) { view.tab = "course"; view.module = +d.module; view.quizAnswers = {}; view.quizDone = false; return render(); }
    if (d.copy) { try { await navigator.clipboard.writeText(d.copy); toast("Copied"); } catch (er) { toast(d.copy); } return; }
    if (d.check) { S.checks[d.check] = !S.checks[d.check]; save(); if (checksDone() === C.checklist.length) report("Checklist complete", ""); return render(); }
    if (d.q != null) {
      // Update only the clicked question so a playing video is not reloaded.
      view.quizAnswers[+d.q] = +d.o;
      root.querySelectorAll('.opt[data-q="' + d.q + '"]').forEach(function (o) { o.classList.toggle("sel", o === b); });
      var total = root.querySelectorAll(".q").length, answered = Object.keys(view.quizAnswers).length;
      var grade = root.querySelector('[data-act="grade"],[data-act="grade-final"]');
      if (grade) { grade.disabled = answered < total; var cnt = grade.nextElementSibling; if (cnt) cnt.textContent = answered + "/" + total + " answered"; }
      return;
    }
    if (d.drill != null) { view.drill.picked = +d.drill; if (+d.drill === view.drill.cards[view.drill.i].answer) view.drill.ok++; var y1 = window.scrollY; render(); window.scrollTo(0, y1); return; }
    if (d.sim != null) { view.sim.log.push(+d.sim); var y2 = window.scrollY; render(); window.scrollTo(0, y2); if (view.sim.log.length === C.simulator.steps.length) finishSim(); return; }
    if (d.start) {
      view.module = null; view.quizAnswers = {}; view.quizDone = false;
      if (d.start === "drill") { view.tab = "practice"; view.sim = null; view.drill = { i: 0, ok: 0, picked: null, cards: shuffleSeeded(C.drill.cards, member.id + ":drill:" + ((S.drill && S.drill.tries) || 0)) }; }
      if (d.start === "sim") { view.tab = "practice"; view.drill = null; view.sim = { log: [] }; }
      if (d.start === "final") { view.tab = "final"; view.finalQs = finalQuestions(); }
      return render();
    }
    switch (d.act) {
      case "login": if (ms) { try { await ms.openModal("LOGIN"); ms.hideModal && ms.hideModal(); } catch (er) {} await boot(); } return;
      case "demo-login":
        if (ms || C.demoAllowed !== true) return;
        var nm = (root.querySelector("#bsa-demo-name") || {}).value || "Demo";
        member = { id: "demo", email: "demo@example.com", name: nm, roleLabel: C.course.roleLabel, fields: {}, isAdmin: true };
        S = await load(); return render();
      case "logout": if (ms) { try { await ms.logout(); } catch (er) {} } member = null; S = null; view = { tab: "home", module: null, quizAnswers: {}, quizDone: false }; return render();
      case "go-next":
        var n = nextStep();
        if (n.kind === "module") { view.tab = "course"; view.module = n.i; view.quizAnswers = {}; view.quizDone = false; }
        else if (n.kind === "final") { view.tab = "final"; view.finalQs = finalQuestions(); view.quizAnswers = {}; view.quizDone = false; }
        else view.tab = "cert";
        return render();
      case "grade": gradeModule(); return;
      case "grade-final": gradeFinal(); return;
      case "retry": view.quizAnswers = {}; view.quizDone = false; return render();
      case "drill-next": view.drill.i++; view.drill.picked = null; if (view.drill.i >= view.drill.cards.length) finishDrill(); return render();
      case "leave-practice": view.tab = "practice"; view.sim = null; view.drill = null; return render();
      case "print": window.print(); return;
      case "reload-progress": boot(); return;
      case "certify":
        var ack = root.querySelector("#bsa-ack");
        if (!ack || !ack.checked) { toast("Check the box first"); return; }
        var results = [member.roleLabel].concat(MODS.map(function (m, k) { return "M" + (k + 1) + " " + (modState(m.id).best || 0) + "%"; }))
          .concat(["Drill " + (S.drill ? S.drill.best + "%" : "not taken"), "Simulator " + (S.sim ? S.sim.best + "%" : "not taken"), "Final " + (S.final ? S.final.best : 0) + "%"]).join(" · ");
        // Only mark it sent once Webflow shows its success message.
        var cform = document.querySelector('form[data-name="' + C.webflowForms.certification + '"]');
        if (!cform) { toast("Could not send. Tell Jesús the certification form is missing on this page."); return; }
        b.disabled = true; b.textContent = "Sending…";
        var wrap = cform.closest(".w-form") || cform.parentNode, done = false;
        var finish = function (ok) {
          if (done) return; done = true; obs.disconnect(); clearTimeout(timer);
          if (ok) { S.acknowledged = today(); save(); toast("Sent to Jesús"); render(); }
          else { b.disabled = false; b.textContent = "Send certification"; toast("Could not send. Try again in a minute."); }
        };
        var visible = function (sel) { var el = wrap.querySelector(sel); return el && getComputedStyle(el).display !== "none"; };
        var obs = new MutationObserver(function () { if (visible(".w-form-done")) finish(true); else if (visible(".w-form-fail")) finish(false); });
        obs.observe(wrap, { attributes: true, subtree: true, attributeFilter: ["style", "class"] });
        var timer = setTimeout(function () { finish(false); }, 12000);
        if (!submitWebflowForm(C.webflowForms.certification, { "Full-Name": member.name, Email: member.email, "Course-Results": results, Acknowledge: ack.checked })) finish(false);
        return;
    }
  });

  function bump(rec, score, passMark) {
    rec = rec || {}; rec.tries = (rec.tries || 0) + 1; rec.best = Math.max(rec.best || 0, score); rec.last = score;
    if (score >= passMark && !rec.passed) { rec.passed = today(); rec.justPassed = true; } else rec.justPassed = false;
    return rec;
  }
  function gradeModule() {
    var m = MODS[view.module], sc = scoreOf(m.quiz, view.quizAnswers);
    var rec = bump(S.modules[m.id], sc, C.course.passMark); S.modules[m.id] = rec; view.quizDone = true; save();
    report(rec.justPassed ? "Module passed" : "Module attempt", "Module " + (view.module + 1) + ": " + m.title, sc);
    render(); var r = root.querySelector(".result"); if (r) r.scrollIntoView({ block: "center" });
  }
  function gradeFinal() {
    var sc = scoreOf(view.finalQs, view.quizAnswers);
    S.final = bump(S.final, sc, C.course.finalPassMark); view.quizDone = true; save();
    report(S.final.justPassed ? "Final exam passed" : "Final exam attempt", C.course.title, sc);
    render(); var r = root.querySelector(".result"); if (r) r.scrollIntoView({ block: "center" });
  }
  function finishDrill() {
    var sc = Math.round(view.drill.ok / view.drill.cards.length * 100);
    S.drill = bump(S.drill, sc, C.drill.passMark); save(); report(S.drill.justPassed ? "Practice passed" : "Practice attempt", C.drill.title, sc);
  }
  function finishSim() {
    var steps = C.simulator.steps, max = steps.length * C.simulator.bestPoints;
    var pts = view.sim.log.reduce(function (a, oi, i) { return a + steps[i].options[oi].points; }, 0);
    var sc = Math.max(0, Math.round(pts / max * 100));
    S.sim = bump(S.sim, sc, C.simulator.passMark); save(); report(S.sim.justPassed ? "Simulator passed" : "Simulator attempt", C.simulator.title, sc);
  }

  /* ---------- boot ---------- */
  function waitForMemberstack(ms_) {
    return new Promise(function (res) {
      if (window.$memberstackDom) return res(window.$memberstackDom);
      var t0 = Date.now(), h = setInterval(function () {
        if (window.$memberstackDom) { clearInterval(h); res(window.$memberstackDom); }
        else if (Date.now() - t0 > ms_) { clearInterval(h); res(null); }
      }, 100);
    });
  }
  async function boot() {
    root.innerHTML = '<div class="loading">Loading…</div>';
    ms = await waitForMemberstack(C.demoAllowed ? 2500 : 8000);
    if (!ms) { member = null; return render(); }
    try {
      var r = await ms.getCurrentMember(), m = r && r.data;
      if (!m) { member = null; return render(); }
      var cf = m.customFields || {};
      member = {
        id: m.id, email: (m.auth && m.auth.email) || "", fields: cf,
        name: [cf["first-name"], cf["last-name"]].filter(Boolean).join(" ") || cf.name || ((m.auth && m.auth.email) || "").split("@")[0],
        roleLabel: cf[C.memberFields.role && C.memberFields.role.ms] || C.course.roleLabel
      };
      member.isAdmin = /admin|owner|principal/i.test(member.roleLabel);
      try { S = await load(); }
      catch (le) {
        root.innerHTML = '<div class="loading"><div style="text-align:center"><p>We couldn\'t load your progress, so nothing was changed.</p><p style="margin-top:14px"><button class="btn" data-act="reload-progress">Try again</button></p></div></div>';
        return;
      }
      render();
      if (!hadRemote) report("Started", C.course.title);
    } catch (e) { member = null; render(); }
  }
  if (ms === null && window.$memberstackDom && window.$memberstackDom.onAuthChange) window.$memberstackDom.onAuthChange(function () { boot(); });
  boot();
})();
