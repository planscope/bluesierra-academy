/* Blue Sierra client portal — front end for bluesierracorp.com/portal.
   Needs <div id="bs-portal"></div> and window.BSP_SETTINGS = { api: "<Apps Script /exec URL>", loginPhoto: "<image URL>" }.
   Talks only to apps-script/Portal.gs. In preview (portal-mock.js loaded, no api) it runs on fictional sample data. */
(function () {
  "use strict";
  var root = document.getElementById("bs-portal");
  if (!root) return;
  // Google Drive refuses to serve photos to other sites' pages unless the request carries no referrer.
  if (!document.querySelector('meta[name="referrer"]')) { var mr = document.createElement("meta"); mr.name = "referrer"; mr.content = "no-referrer"; document.head.appendChild(mr); }
  var SET = window.BSP_SETTINGS || {};
  var API = SET.api && !/^PASTE_/.test(SET.api) ? SET.api : "";
  var LOGO = '<svg class="logo" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 265 33" fill="none" aria-label="Blue Sierra"><path d="M104.849 16.552V16.2315C107.476 14.7578 108.756 14.4372 108.756 9.43255C108.756 4.42785 105.045 1.22217 98.8988 1.22217H86.4151V32.7144H99.7298C106.005 32.7144 109.845 29.4418 109.845 24.2505C109.845 20.7864 108.116 18.1597 104.849 16.552ZM89.5528 4.04508V3.98289H98.8988C103.187 3.98289 105.618 6.16466 105.618 9.62872C105.618 13.0928 103.25 15.2746 98.8988 15.2746H89.5528V4.04508ZM99.7298 29.8293V29.7671H89.5528V18.1597H99.7298C104.209 18.1597 106.645 20.3414 106.645 23.9969C106.645 27.6523 104.147 29.8341 99.7298 29.8341V29.8293Z" fill="currentColor"></path><path d="M117.013 1.22717H114.004V32.7194H117.013V1.22717Z" fill="currentColor"></path><path d="M135.643 23.0957C135.643 27.3301 133.465 29.8277 129.884 29.8277C126.302 29.8277 124.248 27.3923 124.248 23.0957V9.62708H121.24V23.2249C121.24 29.1243 124.248 32.7176 129.115 32.7176C131.741 32.7176 134.11 31.6937 135.39 29.7655H135.648V32.1386H138.595V9.62708H135.648V23.0957H135.643Z" fill="currentColor"></path><path d="M151.776 8.98965C146.016 8.98965 141.728 13.9943 141.728 20.8555C141.728 27.7166 146.016 32.7213 152.034 32.7213C154.402 32.7213 156.389 32.018 158.113 30.6687C159.775 29.3864 160.864 27.7166 161.251 25.664H158.304C157.473 28.2285 156.193 29.9606 151.967 29.9606C147.74 29.9606 144.989 26.6879 144.669 21.621H161.571C161.633 20.9177 161.633 20.3387 161.633 19.9512L161.762 19.889C161.762 13.8604 157.535 8.98486 151.776 8.98486V8.98965ZM144.798 18.9273C145.376 14.4393 147.998 11.7456 151.776 11.7456C155.553 11.7456 158.304 14.6307 158.82 18.9273H144.798Z" fill="currentColor"></path><path d="M261.364 9.62581V13.0229H261.106C259.697 10.3291 259.439 9.04688 253.742 9.04688C248.045 9.04688 243.894 14.0994 243.885 20.8792C243.899 27.6638 247.992 32.7115 253.742 32.7115C256.813 32.7115 259.697 31.4293 261.106 28.7355H261.364V32.1326H264.311V9.62581H261.364ZM254.196 29.8886C249.907 29.8886 247.027 26.2954 247.027 20.9079C247.027 15.5204 249.907 11.9272 254.196 11.9272C258.484 11.9272 261.364 15.5204 261.364 20.9079C261.364 26.2954 258.484 29.8886 254.196 29.8886Z" fill="currentColor"></path><path d="M178.08 14.4352C172.321 13.5356 170.143 12.2534 170.143 8.59793C170.143 4.9425 172.574 2.9521 177.249 2.9521C181.925 2.9521 185.316 5.64583 185.316 9.62184H188.386C188.257 4.36356 183.778 0 177.374 0C170.969 0 167.001 3.59324 167.001 8.66013C167.001 13.727 169.88 16.1002 177.947 17.4447C183.324 18.3442 185.373 19.4303 185.373 23.5355C185.373 27.6407 183.582 29.7555 177.947 29.7555C172.311 29.7555 168.921 25.9086 168.921 21.6121H165.85L165.788 21.6743C165.85 27.5115 171.227 32.7076 177.822 32.7076C184.418 32.7076 188.577 28.7937 188.577 23.5355C188.577 18.2772 185.378 15.5165 178.08 14.4304V14.4352Z" fill="currentColor"></path><path d="M195.235 10.2019H192.226V32.7135H195.235V10.2019Z" fill="currentColor"></path><path d="M195.235 3.79077H192.226V6.35532H195.235V3.79077Z" fill="currentColor"></path><path d="M208.745 8.98965C202.986 8.98965 198.692 13.9943 198.692 20.8555C198.692 27.7166 202.981 32.7213 208.998 32.7213C211.367 32.7213 213.354 32.018 215.078 30.6687C216.744 29.3864 217.828 27.7166 218.215 25.664H215.269C214.438 28.2285 213.158 29.9606 208.931 29.9606C204.705 29.9606 201.954 26.6879 201.634 21.621H218.535C218.597 20.9177 218.597 20.3387 218.597 19.9512L218.726 19.889C218.726 13.8604 214.5 8.98486 208.74 8.98486L208.745 8.98965ZM201.768 18.9273C202.346 14.4393 204.967 11.7456 208.745 11.7456C212.523 11.7456 215.273 14.6307 215.784 18.9273H201.763H201.768Z" fill="currentColor"></path><path d="M225.518 12.8951H225.26V10.2014H222.251V32.7129H225.322V19.3065C225.322 15.5218 226.602 13.0195 229.677 13.0195H232.046V10.0674H230.766C227.886 10.0674 226.415 10.7707 225.518 12.8903V12.8951Z" fill="currentColor"></path><path d="M244.529 10.0772H243.249C240.37 10.0772 238.899 10.7805 238.001 12.9001H237.743V10.2064H234.734V32.7179H237.805V19.3115C237.805 15.5268 239.085 13.0245 242.161 13.0245H244.529V10.0724V10.0772Z" fill="currentColor"></path><path d="M70.1781 11.0273H71.0186V7.48188H72.3749V6.78333H68.8218V7.48188H70.1781V11.0273Z" fill="currentColor"></path><path d="M73.5883 8.52885C73.6026 8.1413 73.6217 7.73461 73.6217 7.34227H73.6695C73.765 7.71547 73.8892 8.21785 73.9656 8.54321L74.7297 10.9594H75.6037L76.3678 8.60541C76.492 8.21785 76.6161 7.71547 76.726 7.34227H76.7737C76.788 7.79202 76.788 8.19871 76.8024 8.52885L76.96 11.0264H77.8005L77.4758 6.78247H76.2627L75.532 8.87334C75.4413 9.18434 75.3458 9.54319 75.2359 9.93553H75.2216C75.1118 9.50013 75.0354 9.18913 74.9398 8.85899L74.2092 6.78726H72.9484L72.6379 11.0312H73.4498L73.6026 8.53364L73.5883 8.52885Z" fill="currentColor"></path><path d="M13.2566 21.4173C13.1553 21.5191 12.9864 21.5191 12.885 21.4173L0.448804 8.8226C0.284725 8.65286 0 8.77411 0 9.01174V32.4504C0 32.5959 0.11582 32.7171 0.260596 32.7171H25.8762C25.8762 32.7171 25.9052 32.7171 25.9196 32.7171V8.30854C25.8424 8.29399 25.7604 8.31823 25.6928 8.38128L13.2566 21.4173Z" fill="currentColor"></path><path d="M56.0472 7.44852C55.9519 7.34675 55.7975 7.34675 55.7022 7.44852L42.1276 21.4306C42.0323 21.5324 41.8779 21.5324 41.7826 21.4306L30.251 8.40328C30.1965 8.34028 30.1239 8.32089 30.0558 8.32574V32.7132C30.0558 32.7132 30.0694 32.7132 30.0785 32.7132H46.5405L46.6131 32.6356L55.7022 22.2593C55.7975 22.1576 55.9519 22.1576 56.0472 22.2593L65.9671 32.6356C66.0125 32.6841 66.0761 32.7132 66.1396 32.7132H79.0196C79.2375 32.7132 79.3465 32.4272 79.1921 32.2576L56.0472 7.44368V7.44852Z" fill="currentColor"></path></svg>';
  var PHASES = ["Design", "Permits", "Pre-construction", "Construction", "Punch list", "Complete"];
  var TOKEN_KEY = "bsp-session";
  var S = { seq: 0, loadErr: "", token: store("get"), me: null, projects: null, pid: null, data: null, tab: "overview", step: "email", email: "", err: "", busy: false, pending: [], lb: null, modal: null };

  /* ---------------- helpers ---------------- */
  function store(op, v) { try { if (op === "get") return localStorage.getItem(TOKEN_KEY) || ""; if (op === "set") localStorage.setItem(TOKEN_KEY, v); else localStorage.removeItem(TOKEN_KEY); } catch (e) { return ""; } }
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
  function initials(n) { return String(n || "?").split(/\s+/).filter(Boolean).slice(0, 2).map(function (w) { return w[0].toUpperCase(); }).join(""); }
  function first(n) { return String(n || "").split(/\s+/)[0] || ""; }
  function money(n) { return Number(n || 0).toLocaleString("en-US", { style: "currency", currency: "USD" }); }
  function day(s) {
    if (!s) return ""; var m = String(s).match(/^(\d{4})-(\d{2})-(\d{2})(?: (\d{2}):(\d{2}))?/); if (!m) return esc(s);
    var d = new Date(+m[1], +m[2] - 1, +m[3], +(m[4] || 0), +(m[5] || 0));
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: d.getFullYear() === new Date().getFullYear() ? undefined : "numeric" }) + (m[4] ? " · " + d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" }) : "");
  }
  function today() { var d = new Date(); return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0"); }
  function bg(url) { return url ? "background-image:url('" + esc(url) + "')" : ""; }
  function toast(msg) { var t = root.querySelector(".toast"); if (!t) { t = document.createElement("div"); t.className = "toast"; root.appendChild(t); } t.textContent = msg; t.classList.add("show"); clearTimeout(t._h); t._h = setTimeout(function () { t.classList.remove("show"); }, 2800); }
  function staff() { return !!(S.me && S.me.staff); }
  function resetState() { S.token = ""; S.me = null; S.projects = null; S.data = null; S.pid = null; S.lb = null; S.modal = null; S.pending = []; S.loadErr = ""; S.seq++; }
  function isDone(v) { return /^(yes|true|y|1)$/i.test(String(v)); }
  function keepScroll(fn) { var y = window.scrollY; fn(); window.scrollTo(0, y); }

  async function call(action, body) {
    var payload = Object.assign({ action: action, token: S.token }, body || {}), res;
    if (API) {
      var r = await fetch(API, { method: "POST", headers: { "Content-Type": "text/plain;charset=utf-8" }, body: JSON.stringify(payload) });
      res = await r.json();
    } else if (window.BSP_MOCK) res = await window.BSP_MOCK(payload);
    else throw new Error("The portal isn't connected yet.");
    if (!res.ok) {
      if (/log in again|doesn't have access/i.test(res.error || "") && action !== "verifyCode") { store("del"); resetState(); render(); }
      throw new Error(res.error || "Something went wrong.");
    }
    if (res.notice) toast(res.notice);
    return res;
  }
  async function run(btn, fn) {
    if (S.busy) return; S.busy = true; var label = btn && btn.innerHTML; if (btn) { btn.disabled = true; btn.innerHTML = "Working…"; }
    try { await fn(); } catch (e) { toast(e.message); if (btn && document.body.contains(btn)) { btn.disabled = false; btn.innerHTML = label; } }
    S.busy = false;
  }
  function resize(file, max) {
    return new Promise(function (res, rej) {
      var url = URL.createObjectURL(file), im = new Image();
      im.onload = function () {
        var s = Math.min(1, max / Math.max(im.naturalWidth, im.naturalHeight)), c = document.createElement("canvas");
        c.width = Math.round(im.naturalWidth * s); c.height = Math.round(im.naturalHeight * s);
        var g = c.getContext("2d"); g.fillStyle = "#fff"; g.fillRect(0, 0, c.width, c.height);   // transparent PNGs become white, not black
        g.drawImage(im, 0, 0, c.width, c.height); URL.revokeObjectURL(url);
        res({ name: file.name.replace(/\.\w+$/, "") + ".jpg", mime: "image/jpeg", data: c.toDataURL("image/jpeg", 0.82) });
      };
      im.onerror = function () { URL.revokeObjectURL(url); rej(new Error("Couldn't read " + file.name + ". Use JPG or PNG.")); };
      im.src = url;
    });
  }
  function readPdf(file) {
    return new Promise(function (res, rej) {
      if (file.type !== "application/pdf") return rej(new Error("Invoices must be PDF."));
      if (file.size > 10 * 1024 * 1024) return rej(new Error("That PDF is over 10 MB."));
      var fr = new FileReader(); fr.onload = function () { res({ name: file.name, mime: "application/pdf", data: fr.result }); }; fr.onerror = function () { rej(new Error("Couldn't read the PDF.")); }; fr.readAsDataURL(file);
    });
  }

  /* ---------------- loading + routing ---------------- */
  function hashState() {
    var h = {};
    location.hash.replace(/^#/, "").split("&").forEach(function (kv) {
      var p = kv.split("="), v = ""; try { v = decodeURIComponent(p[1] || ""); } catch (e) { return; }
      if ((p[0] === "p" || p[0] === "t") && /^[\w-]{1,40}$/.test(v)) h[p[0]] = v;      // ignore anything else in the address
    });
    return h;
  }
  function go(pid, tab) {
    var h = pid ? "#p=" + encodeURIComponent(pid) + (tab && tab !== "overview" ? "&t=" + tab : "") : "#";
    if (location.hash !== h) history.pushState(null, "", h === "#" ? location.pathname + location.search : h);
    route();
  }
  async function route() {
    if (!S.token) { S.me = null; return render(); }
    var h = hashState(), seq = ++S.seq;
    S.lb = null; S.modal = null; S.loadErr = "";                     // overlays never survive navigation
    try {
      if (!S.projects) { var r = await call("listProjects"); if (seq !== S.seq) return; S.me = r.me; S.projects = r.projects; }
      if (!h.p && !staff() && S.projects.length === 1) h.p = S.projects[0].id; // a client with one project goes straight to it
      S.tab = h.t || "overview";
      if (h.p) {
        if (!S.data || S.data.project.id !== h.p) {
          S.pid = h.p; S.data = null; S.pending = []; render();
          var d = await call("getProject", { projectId: h.p });
          if (seq !== S.seq) return;                                     // a newer navigation won: drop this answer
          S.data = d;
        }
      } else { S.pid = null; S.data = null; S.pending = []; }
    } catch (e) { if (seq !== S.seq) return; if (S.pid && !S.data) S.loadErr = e.message; else S.err = e.message; }
    render();
  }
  async function reload(projectsToo) {
    var pid = S.pid, seq = S.seq;
    if (projectsToo) { var r = await call("listProjects"); if (seq === S.seq) S.projects = r.projects; }
    if (pid) { var d = await call("getProject", { projectId: pid }); if (seq !== S.seq || S.pid !== pid) return; S.data = d; }
    keepScroll(render);
  }
  /* After a save that worked, a failed refresh must not look like a failed save (and invite a duplicate). */
  async function refresh(projectsToo) { try { await reload(projectsToo); } catch (e) { toast("Saved, but the page couldn't refresh. Reload to see it."); } }
  window.addEventListener("popstate", route);

  /* ---------------- render ---------------- */
  function render() {
    if (!S.token || !S.me) {
      if (S.token && !S.me) {
        // A saved login, but we couldn't load the account (offline, or the portal isn't connected): say so instead of spinning forever.
        root.innerHTML = S.err
          ? '<div class="loading"><div style="text-align:center;padding:20px"><p class="error">' + esc(S.err) + '</p><p style="margin-top:14px;display:flex;gap:10px;justify-content:center"><button class="btn sm" data-a="retry">Try again</button><button class="btn ghost sm" data-a="forget">Log out</button></p></div></div>'
          : '<div class="loading">Loading…</div>';
        S.err = ""; return;
      }
      return renderLogin();
    }
    var body = !S.pid ? renderList() : S.loadErr ? '<div class="loading"><div style="text-align:center"><p class="error">' + esc(S.loadErr) + '</p><p style="margin-top:14px;display:flex;gap:10px;justify-content:center"><button class="btn sm" data-a="retry">Try again</button>' + (staff() || (S.projects || []).length > 1 ? '<button class="btn ghost sm" data-a="home">All projects</button>' : "") + "</p></div></div>"
      : !S.data ? '<div class="loading">Loading the project…</div>' : renderProject();
    var snap = snapshot();
    root.innerHTML =
      '<header class="topbar"><div class="brand">' + LOGO + "<span>Client portal</span></div>" +
      '<div class="who"><span class="name">' + esc(S.me.name) + (staff() ? ' <span class="pill">Team</span>' : "") + '</span><div class="avatar">' + esc(initials(S.me.name)) + '</div><button class="btn ghost sm" data-a="logout">Log out</button></div></header>' +
      '<div class="wrap">' + (S.err ? '<p class="error" style="margin-bottom:12px">' + esc(S.err) + "</p>" : "") + body + "</div>" +
      (S.modal ? renderModal() : "") + (S.lb ? renderLightbox() : "");
    restore(snap);
    S.err = "";
  }
  /* Keep what people typed (and their checkboxes) when the screen redraws. */
  function snapshot() {
    var snap = {};
    root.querySelectorAll("form[data-form]").forEach(function (form) {
      var vals = {};
      [].forEach.call(form.elements, function (el) {
        if (!el.name || el.type === "file" || el.type === "submit" || el.type === "button") return;
        if (el.type === "checkbox" || el.type === "radio") vals[el.name + "|" + el.value] = el.checked; else vals[el.name] = el.value;
      });
      snap[form.dataset.form + "|" + (form.dataset.q || "")] = vals;
    });
    return snap;
  }
  function restore(snap) {
    root.querySelectorAll("form[data-form]").forEach(function (form) {
      var vals = snap[form.dataset.form + "|" + (form.dataset.q || "")]; if (!vals) return;
      [].forEach.call(form.elements, function (el) {
        if (!el.name || el.type === "file") return;
        if (el.type === "checkbox" || el.type === "radio") { var k = el.name + "|" + el.value; if (k in vals) el.checked = vals[k]; }
        else if (el.name in vals) el.value = vals[el.name];
      });
    });
  }

  function renderLogin() {
    var demo = !API && window.BSP_MOCK;
    root.innerHTML = '<section class="login"><div class="login-photo" style="' + bg(SET.loginPhoto) + '"><div class="tag">Crafting sites, one space at a time.</div></div>' +
      '<div class="login-side">' + LOGO + '<div class="eyebrow">Client portal</div>' +
      (S.step === "email"
        ? '<h1>Your project, in one place.</h1><p class="muted">Photos, updates, questions, invoices and the checklist for your Blue Sierra project. Type your email and we\'ll send you a 6-digit code.</p>' +
          '<form class="form" data-form="email"><label class="f">Email<input type="email" name="email" autocomplete="email" required value="' + esc(S.email) + '"></label><button class="btn" type="submit">Send my code</button></form>'
        : '<h1>Check your email.</h1><p class="muted">We sent a 6-digit code to <b>' + esc(S.email) + '</b>. It works for 15 minutes.</p>' +
          '<form class="form" data-form="code"><label class="f">Code<input class="code-input" type="text" name="code" inputmode="numeric" autocomplete="one-time-code" maxlength="6" required></label><button class="btn" type="submit">Open the portal</button></form>' +
          '<button class="link" data-a="restart">Use a different email</button>') +
      (S.err ? '<p class="error">' + esc(S.err) + "</p>" : "") +
      (demo ? '<div class="demo-box"><b>Preview with sample data.</b> Log in as <b>jesus@example.com</b> (team) or <b>client@example.com</b> (client). The code is <b>123456</b>. Nothing here is real or sent.</div>' : "") +
      (!API && !window.BSP_MOCK ? '<p class="error">The portal isn\'t connected yet.</p>' : "") +
      "</div></section>";
    S.err = "";
    var inp = root.querySelector("input"); if (inp) inp.focus();
  }

  function renderList() {
    var list = S.projects || [];
    var active = list.filter(function (p) { return p.status !== "archived"; }), archived = list.filter(function (p) { return p.status === "archived"; });
    var card = function (p) {
      return '<button class="pcard" data-a="open" data-id="' + esc(p.id) + '"><div class="cover" style="' + bg(p.cover) + '"><span class="pill dark">' + esc(p.phase) + "</span></div>" +
        '<div class="body"><h3>' + esc(p.name) + '</h3><span class="muted small">' + esc([p.client_name, p.city].filter(Boolean).join(" · ")) + "</span>" +
        '<div class="bar"><i style="width:' + Number(p.progress || 0) + '%"></i></div>' +
        '<div class="meta">' + (p.openQuestions ? '<span class="pill gold">' + p.openQuestions + " open question" + (p.openQuestions > 1 ? "s" : "") + "</span>" : "") +
        (p.balance ? '<span class="pill">' + money(p.balance) + " due</span>" : "") + (p.lastUpdate ? '<span class="pill">Updated ' + day(p.lastUpdate.slice(0, 10)) + "</span>" : "") + "</div></div></button>";
    };
    return '<div class="section-title" style="margin-top:6px"><div><div class="eyebrow">' + (staff() ? "All projects" : "Your projects") + '</div><h2 style="font-size:32px;margin-top:4px">' + (staff() ? "Projects" : "Welcome, " + esc(first(S.me.name))) + "</h2></div>" +
      (staff() ? '<button class="btn" data-a="modal" data-m="project">New project</button>' : "") + "</div>" +
      (active.length ? '<div class="projects">' + active.map(card).join("") + "</div>" : '<div class="empty">' + (staff() ? "No projects yet. Create the first one." : "There's no project on your account yet. Blue Sierra will add it soon.") + "</div>") +
      (archived.length ? '<div class="section-title"><h2>Archived</h2></div><div class="projects">' + archived.map(card).join("") + "</div>" : "");
  }

  /* ---------------- project ---------------- */
  function openQuestions() { return S.data.messages.filter(function (m) { return m.kind === "question" && m.status === "open"; }); }
  function clientTodo() { return S.data.checklist.filter(function (c) { return c.owner === "client" && !isDone(c.done); }); }
  function visibleInvoices() { return S.data.invoices.filter(function (i) { return staff() || (i.status !== "draft" && i.status !== "void"); }); }

  function renderProject() {
    var d = S.data, p = d.project, oq = openQuestions().length, todo = clientTodo().length;
    var idx = PHASES.indexOf(p.phase);
    var tabs = [["overview", "Overview", 0], ["updates", "Updates", 0], ["photos", "Photos", 0], ["messages", "Messages", oq], ["invoices", "Invoices", 0], ["checklist", "Checklist", staff() ? 0 : todo]];
    if (staff()) tabs.push(["people", "People", 0]);
    var body = { overview: tabOverview, updates: tabUpdates, photos: tabPhotos, messages: tabMessages, invoices: tabInvoices, checklist: tabChecklist, people: staff() ? tabPeople : tabOverview }[S.tab] || tabOverview;
    return (staff() || (S.projects || []).length > 1 ? '<button class="crumb link" data-a="home">← All projects</button>' : "") +
      '<section class="phead" style="' + bg(p.cover) + '"><div class="phead-flex"><div><div class="eyebrow">' + esc([p.city, p.phase].filter(Boolean).join(" · ")) + "</div><h1>" + esc(p.name) + "</h1>" +
      (p.summary ? "<p>" + esc(p.summary) + "</p>" : "") + "</div>" +
      (staff() ? '<button class="btn light sm" data-a="modal" data-m="project" data-id="' + esc(p.id) + '">Edit project</button>' : "") + "</div></section>" +
      '<div class="stepper" aria-label="Project phase: ' + esc(p.phase) + '">' + PHASES.map(function (ph, i) { return '<div class="step ' + (i < idx ? "done" : i === idx ? "now" : "") + '"><i></i><span>' + esc(ph) + "</span></div>"; }).join("") + "</div>" +
      '<nav class="tabs">' + tabs.map(function (t) { return '<button data-a="tab" data-t="' + t[0] + '" class="' + (S.tab === t[0] ? "on" : "") + '">' + t[1] + (t[2] ? '<span class="count">' + t[2] + "</span>" : "") + "</button>"; }).join("") + "</nav>" +
      body();
  }

  function stat(label, big, small) { return '<div class="card stat"><div class="eyebrow">' + label + "</div><b>" + big + "</b><span>" + small + "</span></div>"; }

  function tabOverview() {
    var d = S.data, p = d.project, inv = visibleInvoices().filter(function (i) { return i.status !== "draft" && i.status !== "void"; });
    var due = inv.filter(function (i) { return i.status !== "paid"; }).reduce(function (a, i) { return a + i.amount; }, 0);
    var overdue = inv.filter(function (i) { return i.status === "overdue"; }).length;
    var oq = openQuestions(), todo = clientTodo(), last = d.timeline[0];
    var waiting = oq.map(function (q) { return '<div class="msg"><div class="avatar gold">?</div><div class="bubble question"><div class="who-line"><b>' + esc(q.author) + "</b> asked · " + day(q.at) + '</div><div class="text">' + esc(q.text) + "</div>" + (staff() ? "" : answerBox(q)) + "</div></div>"; }).join("") +
      todo.map(function (c) { return checkRow(c); }).join("");
    return '<div class="grid g4">' +
      stat("Progress", Number(p.progress || 0) + "%", '<div class="bar" style="margin-top:10px"><i style="width:' + Number(p.progress || 0) + '%"></i></div>') +
      stat(staff() ? "Waiting on the client" : "Waiting on you", String(oq.length + todo.length), oq.length + " question" + (oq.length === 1 ? "" : "s") + " · " + todo.length + " checklist") +
      stat("Balance due", money(due), overdue ? '<span style="color:var(--bad)">' + overdue + " overdue</span>" : "Nothing overdue") +
      stat("Target completion", p.target_date ? day(p.target_date) : "—", p.start_date ? "Started " + day(p.start_date) : "") + "</div>" +
      '<div class="section-title"><h2>' + (staff() ? "Waiting on the client" : "Waiting on you") + "</h2></div>" +
      (waiting ? '<div class="thread">' + waiting + "</div>" : '<div class="empty">' + (staff() ? "Nothing pending from the client." : "You're all caught up. Nothing needs your answer right now.") + "</div>") +
      '<div class="section-title"><h2>Latest update</h2>' + (d.timeline.length ? '<button class="link" data-a="tab" data-t="updates">All updates</button>' : "") + "</div>" +
      (last ? post(last) : '<div class="empty">No updates yet.</div>') +
      (d.photos.length ? '<div class="section-title"><h2>Recent photos</h2><button class="link" data-a="tab" data-t="photos">All ' + d.photos.length + " photos</button></div>" +
        '<div class="strip">' + d.photos.slice(0, 6).map(function (ph, i) { return '<button class="ph" style="' + bg(ph.thumb) + '" data-a="lb" data-i="' + i + '" aria-label="' + esc(ph.caption || "Photo") + '"></button>'; }).join("") + "</div>" : "");
  }

  function post(t) {
    var photos = S.data.photos.filter(function (ph) { return t.photo_ids && t.photo_ids.split(",").indexOf(ph.id) > -1; });
    return '<article class="card"><div class="post-head"><div class="avatar">' + esc(initials(t.author)) + '</div><div><b style="font-weight:500">' + esc(t.author) + '</b><div class="muted small">' + day(t.at) + (t.emailed ? " · emailed to the client" : "") + "</div></div></div>" +
      (t.text ? '<div class="post-text">' + esc(t.text) + "</div>" : "") +
      (photos.length ? '<div class="photo-grid">' + photos.map(function (ph) { return '<button class="ph" style="' + bg(ph.thumb) + '" data-a="lb" data-i="' + S.data.photos.indexOf(ph) + '" aria-label="' + esc(ph.caption || "Photo") + '"></button>'; }).join("") + "</div>" : "") + "</article>";
  }

  function photoPicker(label) {
    return '<div class="previews">' + S.pending.map(function (f, i) { return '<div style="' + bg(f.data) + '"><button type="button" class="icon-btn" style="position:absolute;top:-8px;right:-8px;background:#fff;width:24px;height:24px" data-a="unpick" data-i="' + i + '" aria-label="Remove">×</button></div>'; }).join("") + "</div>" +
      '<span class="btn ghost sm file-btn">' + label + '<input type="file" accept="image/*" multiple data-pick="photos"></span>';
  }

  function tabUpdates() {
    var d = S.data;
    return (staff() ? '<form class="card composer" data-form="update"><h3>Post an update</h3><textarea name="text" placeholder="What happened on site? What\'s next?"></textarea>' +
      photoPicker("Add photos") + '<label class="check-line"><input type="checkbox" name="notify" checked> Email the client about this update</label><div class="actions"><button class="btn" type="submit">Post update</button></div></form>' : "") +
      '<div class="section-title"><h2>Updates</h2><span class="muted small">' + d.timeline.length + "</span></div>" +
      (d.timeline.length ? '<div class="feed">' + d.timeline.map(post).join("") + "</div>" : '<div class="empty">No updates yet.</div>');
  }

  function tabPhotos() {
    var d = S.data;
    return (staff() ? '<form class="card composer" data-form="photos"><h3>Upload photos</h3>' + photoPicker("Choose photos") + '<input type="text" name="caption" placeholder="Caption (optional), e.g. Retaining wall pour"><div class="actions"><button class="btn" type="submit">Upload</button></div></form>' : "") +
      '<div class="section-title"><h2>Photos</h2><span class="muted small">' + d.photos.length + "</span></div>" +
      (d.photos.length ? '<div class="photo-grid big">' + d.photos.map(function (ph, i) { return '<button class="ph" style="' + bg(ph.thumb) + '" data-a="lb" data-i="' + i + '">' + (ph.caption ? '<span class="cap">' + esc(ph.caption) + "</span>" : "") + "</button>"; }).join("") + "</div>" : '<div class="empty">No photos yet.</div>');
  }

  function answerBox(q) {
    return '<form class="answer-box" data-form="answer" data-q="' + esc(q.id) + '"><textarea name="text" placeholder="Your answer" required style="min-height:64px"></textarea><div class="actions"><button class="btn sm" type="submit">Send answer</button></div></form>';
  }
  function tabMessages() {
    var d = S.data, answers = {};
    d.messages.forEach(function (m) { if (m.kind === "answer") (answers[m.question_id] = answers[m.question_id] || []).push(m); });
    var items = d.messages.filter(function (m) { return m.kind !== "answer"; });
    var html = items.map(function (m) {
      var mine = m.mine || m.author_email === S.me.email, q = m.kind === "question";
      return '<div class="msg ' + (mine ? "mine" : "") + '"><div class="avatar ' + (m.role === "client" ? "gold" : "") + '">' + esc(initials(m.author)) + '</div><div class="bubble ' + (q ? "question" : "") + '">' +
        '<div class="who-line"><b>' + esc(m.author) + "</b>" + (m.role === "client" ? "" : '<span class="pill">Blue Sierra</span>') + "<span>" + day(m.at) + "</span>" +
        (m.via === "email" ? '<span class="pill">by email</span>' : "") + (q ? (m.status === "open" ? '<span class="pill gold">Question · waiting</span>' : '<span class="pill ok">Answered</span>') : "") + "</div>" +
        '<div class="text">' + esc(m.text) + "</div>" +
        (answers[m.id] || []).map(function (a) { return '<div class="answer"><div class="who-line"><b>' + esc(a.author) + "</b><span>" + day(a.at) + "</span>" + (a.via === "email" ? '<span class="pill">by email</span>' : "") + '</div><div class="text">' + esc(a.text) + "</div></div>"; }).join("") +
        (q && m.status === "open" ? (staff() ? '<div class="actions" style="justify-content:flex-start;margin-top:8px"><button class="link small" data-a="closeQ" data-id="' + esc(m.id) + '">Mark as answered</button></div>' : answerBox(m)) : "") +
        "</div></div>";
    }).join("");
    return '<div class="section-title" style="margin-top:0"><h2>Messages</h2><span class="muted small">' + (staff() ? "Questions are emailed to the client; their email replies show up here." : "Replies by email also show up here.") + "</span></div>" +
      (html ? '<div class="thread">' + html + "</div>" : '<div class="empty">No messages yet.</div>') +
      '<div class="reply-bar"><form class="card" data-form="message"><textarea name="text" required placeholder="' + (staff() ? "Write to the client" : "Write to Blue Sierra") + '"></textarea>' +
      '<div class="actions" style="justify-content:space-between">' + (staff() ? '<label class="check-line"><input type="checkbox" name="question"> Ask as a question (the client can answer by replying to the email)</label>' : "<span></span>") +
      '<button class="btn" type="submit">Send</button></div></form></div>';
  }

  function tabInvoices() {
    var list = visibleInvoices(), billed = list.filter(function (i) { return i.status !== "draft" && i.status !== "void"; });
    var paid = billed.filter(function (i) { return i.status === "paid"; }).reduce(function (a, i) { return a + i.amount; }, 0);
    var total = billed.reduce(function (a, i) { return a + i.amount; }, 0);
    var pill = function (s) { return '<span class="pill ' + ({ paid: "ok", overdue: "bad", sent: "gold" }[s] || "") + '">' + esc({ sent: "Due", paid: "Paid", overdue: "Overdue", draft: "Draft", void: "Void" }[s] || s) + "</span>"; };
    return '<div class="grid g3">' + stat("Billed", money(total), billed.length + " invoice" + (billed.length === 1 ? "" : "s")) + stat("Paid", money(paid), "") + stat("Balance due", money(total - paid), "") + "</div>" +
      '<div class="section-title"><h2>Invoices</h2>' + (staff() ? '<button class="btn sm" data-a="modal" data-m="invoice">New invoice</button>' : "") + "</div>" +
      (list.length ? '<div class="card tbl"><table class="t"><thead><tr><th>Invoice</th><th>Issued</th><th>Due</th><th class="num">Amount</th><th>Status</th><th></th></tr></thead><tbody>' +
        list.map(function (i) {
          return "<tr><td><b style='font-weight:500'>" + esc(i.number) + "</b><div class='muted small'>" + esc(i.title) + "</div></td><td>" + day(i.issued) + "</td><td>" + day(i.due) + '</td><td class="num">' + money(i.amount) + "</td><td>" + pill(i.status) + (i.paid_date ? '<div class="muted small">' + day(i.paid_date) + "</div>" : "") + "</td>" +
            '<td><div class="row-actions">' + (i.pdf ? '<a class="btn ghost sm" href="' + esc(i.pdf) + '" target="_blank" rel="noopener noreferrer">PDF</a>' : "") +
            (i.pay_url && i.status !== "paid" && !staff() ? '<a class="btn sm" href="' + esc(i.pay_url) + '" target="_blank" rel="noopener noreferrer">Pay</a>' : "") +
            (staff() ? '<button class="btn ghost sm" data-a="modal" data-m="invoice" data-id="' + esc(i.id) + '">Edit</button>' : "") + "</div></td></tr>";
        }).join("") + "</tbody></table></div>" : '<div class="empty">No invoices yet.</div>');
  }

  function checkRow(c) {
    var done = isDone(c.done), can = staff() || c.owner === "client";
    return '<div class="ck ' + (done ? "done" : "") + '"><button class="box" data-a="toggle" data-id="' + esc(c.id) + '"' + (can ? "" : " disabled") + ' aria-label="' + (done ? "Mark not done" : "Mark done") + '">' + (done ? "✓" : "") + "</button>" +
      '<div><span class="txt">' + esc(c.item) + "</span>" + (done && c.done_by ? "<small>Done by " + esc(c.done_by) + " · " + day(c.done_at) + "</small>" : c.due ? "<small>Due " + day(c.due) + "</small>" : "") + "</div>" +
      '<span class="pill ' + (c.owner === "client" ? "gold" : "") + '">' + (c.owner === "client" ? (staff() ? "Client" : "You") : "Blue Sierra") + "</span>" +
      (staff() ? '<span style="display:flex;gap:6px"><button class="icon-btn" data-a="modal" data-m="check" data-id="' + esc(c.id) + '" aria-label="Edit">✎</button><button class="icon-btn" data-a="delCheck" data-id="' + esc(c.id) + '" aria-label="Delete">×</button></span>' : "<span></span>") + "</div>";
  }
  function tabChecklist() {
    var list = S.data.checklist, groups = PHASES.map(function (ph) { return [ph, list.filter(function (c) { return c.phase === ph; })]; }).filter(function (g) { return g[1].length; });
    var done = list.filter(function (c) { return isDone(c.done); }).length;
    return '<div class="section-title" style="margin-top:0"><div><h2>Checklist</h2><span class="muted small">' + done + " of " + list.length + " done" + (staff() ? "" : " · you can check off the items marked “You”") + "</span></div>" +
      (staff() ? '<button class="btn sm" data-a="modal" data-m="check">Add item</button>' : "") + "</div>" +
      (groups.length ? groups.map(function (g) { return '<div class="phase-group"><h3>' + esc(g[0]) + (g[0] === S.data.project.phase ? ' <span class="pill dark">Current phase</span>' : "") + "</h3>" + g[1].map(checkRow).join("") + "</div>"; }).join("") : '<div class="empty">No checklist items yet.</div>');
  }

  function tabPeople() {
    var ppl = S.data.people || [];
    return '<div class="section-title" style="margin-top:0"><h2>People on this project</h2></div><div class="card" style="display:flex;flex-direction:column;gap:12px">' +
      ppl.map(function (x) { return '<div style="display:flex;align-items:center;gap:12px"><div class="avatar ' + (x.role === "client" ? "gold" : "") + '">' + esc(initials(x.name)) + '</div><div style="flex:1"><b style="font-weight:500">' + esc(x.name) + '</b><div class="muted small">' + esc(x.email) + "</div></div>" +
        '<span class="pill">' + esc(x.role === "client" ? "Client" : x.role === "admin" ? "Admin" : "Team") + "</span>" + (x.role === "client" ? '<button class="icon-btn" data-a="removePerson" data-email="' + esc(x.email) + '" aria-label="Remove access">×</button>' : "") + "</div>"; }).join("") + "</div>" +
      '<form class="card form" data-form="person" style="margin-top:16px"><h3>Give someone access</h3><div class="row2"><label class="f">Name<input type="text" name="name" required></label><label class="f">Email<input type="email" name="email" required></label></div>' +
      (S.me.admin ? '<label class="f">Role<select name="role"><option value="client">Client: sees this project only</option><option value="staff">Blue Sierra team: sees all projects</option></select></label>' : "") +
      '<label class="check-line"><input type="checkbox" name="invite" checked> Email them an invitation</label><div class="actions"><button class="btn" type="submit">Add</button></div></form>';
  }

  /* ---------------- modals + lightbox ---------------- */
  function renderModal() {
    var m = S.modal, d = S.data, body = "";
    if (m.type === "project") {
      var p = m.id && d ? d.project : {};
      body = "<h2>" + (m.id ? "Edit project" : "New project") + '</h2><form class="form" data-form="project">' +
        '<label class="f">Project name<input type="text" name="name" required value="' + esc(p.name) + '" placeholder="e.g. Hillside Residence"></label>' +
        '<div class="row2"><label class="f">Client name<input type="text" name="client_name" value="' + esc(p.client_name) + '"></label><label class="f">City<input type="text" name="city" value="' + esc(p.city) + '"></label></div>' +
        '<label class="f">Address (only the client and team see it)<input type="text" name="address" value="' + esc(p.address) + '"></label>' +
        '<div class="row2"><label class="f">Phase<select name="phase">' + PHASES.map(function (ph) { return "<option" + (ph === p.phase ? " selected" : "") + ">" + ph + "</option>"; }).join("") + '</select></label><label class="f">Progress %<input type="number" name="progress" min="0" max="100" value="' + esc(p.progress || 0) + '"></label></div>' +
        '<div class="row2"><label class="f">Start date<input type="date" name="start_date" value="' + esc(p.start_date) + '"></label><label class="f">Target completion<input type="date" name="target_date" value="' + esc(p.target_date) + '"></label></div>' +
        '<label class="f">Short description<textarea name="summary">' + esc(p.summary) + "</textarea></label>" +
        (m.id ? '<label class="f">Status<select name="status"><option value="active"' + (p.status !== "archived" ? " selected" : "") + '>Active</option><option value="archived"' + (p.status === "archived" ? " selected" : "") + ">Archived (hidden from the client)</option></select></label>" : "") +
        '<div class="actions"><button type="button" class="btn ghost" data-a="close">Cancel</button><button class="btn" type="submit">Save</button></div></form>';
    }
    if (m.type === "invoice") {
      var i = m.id ? d.invoices.filter(function (x) { return x.id === m.id; })[0] || {} : { issued: today(), status: "sent" };
      var st = i.status === "overdue" ? "sent" : i.status;
      body = "<h2>" + (m.id ? "Edit invoice" : "New invoice") + '</h2><form class="form" data-form="invoice">' +
        '<div class="row2"><label class="f">Invoice number<input type="text" name="number" required value="' + esc(i.number) + '"></label><label class="f">Amount (USD)<input type="number" name="amount" step="0.01" min="0" required value="' + esc(i.amount) + '"></label></div>' +
        '<label class="f">Description<input type="text" name="title" value="' + esc(i.title) + '" placeholder="e.g. Progress payment 2: walls and drainage"></label>' +
        '<div class="row2"><label class="f">Issued<input type="date" name="issued" value="' + esc(i.issued) + '"></label><label class="f">Due<input type="date" name="due" value="' + esc(i.due) + '"></label></div>' +
        '<div class="row2"><label class="f">Status<select name="status">' + [["draft", "Draft (client can't see it)"], ["sent", "Sent / due"], ["paid", "Paid"], ["void", "Void"]].map(function (o) { return '<option value="' + o[0] + '"' + (o[0] === st ? " selected" : "") + ">" + o[1] + "</option>"; }).join("") + '</select></label><label class="f">Paid on<input type="date" name="paid_date" value="' + esc(i.paid_date) + '"></label></div>' +
        '<label class="f">Payment link (optional, https)<input type="url" name="pay_url" value="' + esc(i.pay_url) + '" placeholder="Stripe or QuickBooks payment link"></label>' +
        '<label class="f">PDF' + (i.pdf ? ' (one is attached; choose a file to replace it)' : "") + '<input type="file" name="pdf" accept="application/pdf"></label>' +
        '<label class="check-line"><input type="checkbox" name="notify"' + (m.id ? "" : " checked") + "> Email the client that it's ready</label>" +
        '<div class="actions"><button type="button" class="btn ghost" data-a="close">Cancel</button><button class="btn" type="submit">Save invoice</button></div></form>';
    }
    if (m.type === "check") {
      var c = m.id ? d.checklist.filter(function (x) { return x.id === m.id; })[0] || {} : { phase: d.project.phase, owner: "blue sierra" };
      body = "<h2>" + (m.id ? "Edit item" : "Add checklist item") + '</h2><form class="form" data-form="check">' +
        '<label class="f">Item<input type="text" name="item" required value="' + esc(c.item) + '" placeholder="e.g. Choose paver color"></label>' +
        '<div class="row2"><label class="f">Phase<select name="phase">' + PHASES.map(function (ph) { return "<option" + (ph === c.phase ? " selected" : "") + ">" + ph + "</option>"; }).join("") + '</select></label>' +
        '<label class="f">Who does it<select name="owner"><option value="blue sierra"' + (c.owner !== "client" ? " selected" : "") + '>Blue Sierra</option><option value="client"' + (c.owner === "client" ? " selected" : "") + ">Client</option></select></label></div>" +
        '<label class="f">Due (optional)<input type="date" name="due" value="' + esc(c.due) + '"></label>' +
        '<div class="actions"><button type="button" class="btn ghost" data-a="close">Cancel</button><button class="btn" type="submit">Save</button></div></form>';
    }
    return '<div class="modal-bg" data-a="bg" data-lenis-prevent><div class="modal" role="dialog" aria-modal="true">' + body + "</div></div>";
  }
  function renderLightbox() {
    var ph = S.data.photos[S.lb.i]; if (!ph) return "";
    return '<div class="lightbox" role="dialog" aria-label="Photo" data-lenis-prevent><img referrerpolicy="no-referrer" src="' + esc(ph.full) + '" alt="' + esc(ph.caption || "Project photo") + '">' +
      '<div class="lb-bar"><span>' + [esc(ph.caption || ""), day(ph.at), (S.lb.i + 1) + "/" + S.data.photos.length].filter(Boolean).join(" · ") + "</span><span style=\"display:flex;gap:8px\">" +
      (staff() ? '<button class="btn ghost sm" style="color:#fff;border-color:rgba(255,255,255,.4)" data-a="cover" data-id="' + esc(ph.file_id) + '">Use as cover</button><button class="btn ghost sm" style="color:#fff;border-color:rgba(255,255,255,.4)" data-a="delPhoto" data-id="' + esc(ph.id) + '">Delete</button>' : "") +
      '<a class="btn ghost sm" style="color:#fff;border-color:rgba(255,255,255,.4)" href="' + esc(ph.full) + '" target="_blank" rel="noopener noreferrer">Open full size</a><button class="icon-btn" data-a="lbClose" aria-label="Close">×</button></span></div>' +
      '<button class="icon-btn nav prev" data-a="lbPrev" aria-label="Previous">‹</button><button class="icon-btn nav next" data-a="lbNext" aria-label="Next">›</button></div>';
  }

  /* ---------------- events ---------------- */
  root.addEventListener("click", function (e) {
    var b = e.target.closest("[data-a]"); if (!b || !root.contains(b)) return;
    var a = b.dataset.a;
    if (a === "bg") { if (e.target === b && S.downOnBg) { S.modal = null; keepScroll(render); } return; }
    if (b.tagName === "A") return;
    e.preventDefault();
    switch (a) {
      case "restart": S.step = "email"; return render();
      case "retry": root.innerHTML = '<div class="loading">Loading…</div>'; return route();
      case "forget": store("del"); resetState(); S.step = "email"; return render();
      case "logout": run(b, async function () { try { await call("logout"); } catch (er) {} store("del"); resetState(); S.step = "email"; history.pushState(null, "", location.pathname + location.search); render(); }); return;
      case "home": return go(null);
      case "open": return go(b.dataset.id);
      case "tab": S.pending = []; S.lb = null; return go(S.pid, b.dataset.t);
      case "modal": S.modal = { type: b.dataset.m, id: b.dataset.id || null }; return keepScroll(render);
      case "close": S.modal = null; return keepScroll(render);
      case "unpick": S.pending.splice(+b.dataset.i, 1); return keepScroll(render);
      case "lb": S.lb = { i: +b.dataset.i }; return keepScroll(render);
      case "lbClose": S.lb = null; return keepScroll(render);
      case "lbPrev": S.lb.i = (S.lb.i - 1 + S.data.photos.length) % S.data.photos.length; return keepScroll(render);
      case "lbNext": S.lb.i = (S.lb.i + 1) % S.data.photos.length; return keepScroll(render);
      case "toggle": run(null, async function () { await call("toggleChecklist", { itemId: b.dataset.id }); await reload(); }); return;
      case "delCheck": if (confirm("Delete this checklist item?")) run(null, async function () { await call("deleteChecklistItem", { itemId: b.dataset.id }); await reload(); }); return;
      case "closeQ": run(b, async function () { await call("closeQuestion", { questionId: b.dataset.id }); await reload(true); }); return;
      case "removePerson": if (confirm("Remove " + b.dataset.email + " from this project?")) run(null, async function () { await call("removePerson", { projectId: S.pid, email: b.dataset.email }); await reload(); toast("Access removed"); }); return;
      case "cover": run(b, async function () { await call("setCover", { projectId: S.pid, fileId: b.dataset.id }); S.lb = null; await reload(true); toast("Cover photo updated"); }); return;
      case "delPhoto": if (confirm("Delete this photo?")) run(b, async function () { await call("deletePhoto", { photoId: b.dataset.id }); S.lb = null; await reload(); toast("Photo deleted"); }); return;
    }
  });

  root.addEventListener("mousedown", function (e) { S.downOnBg = !!(e.target.classList && e.target.classList.contains("modal-bg")); });
  root.addEventListener("change", function (e) {
    if (!e.target.matches("[data-pick]")) return;
    var files = [].slice.call(e.target.files || []), room = Math.max(0, 12 - S.pending.length);
    if (files.length > room) toast("Up to 12 photos at a time. " + (files.length - room) + " left out.");
    files = files.slice(0, room);
    Promise.allSettled(files.map(function (f) { return resize(f, API ? 1800 : 900); })).then(function (results) {
      var ok = results.filter(function (r) { return r.status === "fulfilled"; }).map(function (r) { return r.value; });
      var bad = results.length - ok.length;
      S.pending = S.pending.concat(ok); keepScroll(render);
      if (bad) toast(bad + " photo" + (bad > 1 ? "s" : "") + " couldn't be read. Use JPG or PNG.");
    });
  });

  document.addEventListener("keydown", function (e) {
    if (S.lb && !(S.data && S.data.photos.length)) { S.lb = null; return; }
    if (S.lb && e.key === "ArrowRight") { S.lb.i = (S.lb.i + 1) % S.data.photos.length; keepScroll(render); }
    else if (S.lb && e.key === "ArrowLeft") { S.lb.i = (S.lb.i - 1 + S.data.photos.length) % S.data.photos.length; keepScroll(render); }
    else if (e.key === "Escape" && (S.lb || S.modal)) { S.lb = null; S.modal = null; keepScroll(render); }
  });

  root.addEventListener("submit", function (e) {
    var f = e.target.closest("form[data-form]"); if (!f) return; e.preventDefault();
    var kind = f.dataset.form, fd = new FormData(f), btn = f.querySelector("[type=submit]"), v = function (k) { return String(fd.get(k) || "").trim(); };
    run(btn, async function () {
      if (kind === "email") {
        S.email = v("email").toLowerCase(); await call("requestCode", { email: S.email }); S.step = "code"; return render();
      }
      if (kind === "code") {
        var r = await call("verifyCode", { email: S.email, code: v("code") });
        S.token = r.token; store("set", r.token); S.me = r.me; S.projects = null; return route();
      }
      if (kind === "update") {
        var sentU = S.pending.slice();
        await call("postUpdate", { projectId: S.pid, text: v("text"), photos: sentU, notify: !!fd.get("notify") });
        S.pending = S.pending.filter(function (x) { return sentU.indexOf(x) < 0; }); f.reset();
        await refresh(true); toast(fd.get("notify") ? "Posted and emailed to the client" : "Posted"); return;
      }
      if (kind === "photos") {
        if (!S.pending.length) throw new Error("Choose at least one photo.");
        var sentP = S.pending.slice();
        await call("uploadPhotos", { projectId: S.pid, photos: sentP, caption: v("caption") });
        S.pending = S.pending.filter(function (x) { return sentP.indexOf(x) < 0; }); f.reset();
        await refresh(true); toast("Photos uploaded"); return;
      }
      if (kind === "message") {
        var q = !!fd.get("question");
        await call("sendMessage", { projectId: S.pid, text: v("text"), kind: q ? "question" : "message" });
        f.reset(); await refresh(true); toast(staff() ? (q ? "Question emailed to the client" : "Message sent to the client") : "Sent to Blue Sierra"); return;
      }
      if (kind === "answer") {
        await call("answerQuestion", { projectId: S.pid, questionId: f.dataset.q, text: v("text") });
        f.reset(); await refresh(true); toast("Answer sent"); return;
      }
      if (kind === "person") {
        await call("addPerson", { projectId: S.pid, name: v("name"), email: v("email"), role: v("role") || "client", invite: !!fd.get("invite") });
        f.reset(); await refresh(); toast(fd.get("invite") ? "Added and invited" : "Added"); return;
      }
      if (kind === "project") {
        var proj = { id: S.modal && S.modal.id || undefined };
        ["name", "client_name", "address", "city", "phase", "progress", "start_date", "target_date", "summary", "status"].forEach(function (k) { if (fd.has(k)) proj[k] = v(k); });
        var r2 = await call("saveProject", { project: proj }); S.modal = null;
        if (!proj.id) { S.projects = null; return go(r2.project.id); }
        await refresh(true); toast("Project saved"); return;
      }
      if (kind === "invoice") {
        var file = f.querySelector("[name=pdf]").files[0], pdf = file ? await readPdf(file) : null;
        await call("saveInvoice", { projectId: S.pid, notify: !!fd.get("notify"), invoice: { id: S.modal.id || undefined, number: v("number"), title: v("title"), amount: v("amount"), issued: v("issued"), due: v("due"), status: v("status"), paid_date: v("paid_date"), pay_url: v("pay_url"), pdf: pdf } });
        S.modal = null; await refresh(true); toast("Invoice saved"); return;
      }
      if (kind === "check") {
        await call("saveChecklistItem", { projectId: S.pid, item: { id: S.modal.id || undefined, item: v("item"), phase: v("phase"), owner: v("owner"), due: v("due") } });
        S.modal = null; await refresh(); toast("Checklist updated"); return;
      }
    }).catch(function () {});
  });

  /* Login errors show on the login screen, not only as a toast. */
  var _call = call;
  call = async function (action, body) {
    try { return await _call(action, body); }
    catch (e) { if (action === "requestCode" || action === "verifyCode") { S.err = e.message; renderLogin(); } throw e; }
  };

  if (S.token) { render(); route(); } else render();
})();
