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
  var TOKEN_KEY = API ? "bsp-session" : "bsp-preview-session";   // the preview never touches a real login
  var S = { sched: { view: "gantt", month: "" }, seq: 0, loadErr: "", token: store("get"), me: null, projects: null, pid: null, data: null, tab: "overview", step: "email", email: "", err: "", busy: false, pending: [], lb: null, modal: null };

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
  function asClient() { return !!(S.me && S.me.role === "client"); }   // the architect sees the project like the client, but the client's to-dos aren't theirs
  function resetState() { S.token = ""; S.me = null; S.projects = null; S.data = null; S.notif = null; S.bell = false; if (S.tour) { S.tour = null; var tw = document.getElementById("bsp-tour"); if (tw) tw.remove(); } S.pid = null; S.lb = null; S.modal = null; S.pending = []; S.loadErr = ""; S.seq++; }
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
      if (!S.projects) { var r = await call("listProjects"); if (seq !== S.seq) return; S.me = r.me; S.projects = r.projects; S.notif = null; loadNotif(); }
      if (!h.p && !staff() && S.projects.length === 1) h.p = S.projects[0].id; // a client with one project goes straight to it
      S.tab = h.t || "overview";
      if (h.p) {
        if (!S.data || S.data.project.id !== h.p) {
          S.pid = h.p; S.data = null; S.pending = []; S.att = { main: [], thread: [] }; S.readMark = {}; S.picker = null; S.chan = S.wantChan || "client"; S.wantChan = null; render();
          var d = await call("getProject", { projectId: h.p });
          if (seq !== S.seq) return;                                     // a newer navigation won: drop this answer
          S.data = d;
        }
      } else { S.pid = null; S.data = null; S.pending = []; }
    } catch (e) { if (seq !== S.seq) return; if (S.pid && !S.data) S.loadErr = e.message; else S.err = e.message; }
    if (S.wantChan && S.data) { S.chan = S.wantChan; S.wantChan = null; S.readMark = {}; }
    if (S.openThread && S.data) { S.modal = { type: "thread", id: S.openThread }; S.openThread = null; }
    if (S.afterLoadModal && S.data) { S.modal = staff() ? { type: "sched", id: S.afterLoadModal.id } : S.afterLoadModal; S.afterLoadModal = null; }
    render();
    if (S.flash) { var fl = document.getElementById(S.flash); S.flash = null; if (fl) { fl.scrollIntoView({ block: "center" }); fl.classList.add("flash"); setTimeout(function () { fl.classList.remove("flash"); }, 2400); } }
    setTimeout(function () { startTour(false); }, 400);
    if (S.tab === "messages" && S.data && !S.modal) window.scrollTo(0, document.body.scrollHeight);
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
  /* Live-ish chat: while a chat is open and the tab is visible, look for new messages every 40 seconds. */
  setInterval(async function () {
    if (!S.token || !S.pid || !S.data || S.tab !== "messages" || S.busy || document.visibilityState !== "visible") return;
    var pid = S.pid, seq = S.seq, sig = function (d) { return d.messages.map(function (m) { return m.id + ":" + (m.reactions || []).map(function (r) { return r.e + r.n; }).join(""); }).join("|"); };
    try {
      var d = await call("getProject", { projectId: pid });
      if (seq !== S.seq || S.pid !== pid || !S.data || sig(d) === sig(S.data)) return;
      var nearBottom = window.innerHeight + window.scrollY > document.body.scrollHeight - 200;
      d.reads = S.data.reads; S.data = d; keepScroll(render);
      if (nearBottom && !S.modal) window.scrollTo(0, document.body.scrollHeight);
    } catch (e) {}
  }, 40000);

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
    var snap = snapshot(), oldG = root.querySelector(".gantt-wrap"), gLeft = oldG ? oldG.scrollLeft : -1;
    root.innerHTML =
      '<header class="topbar"><div class="brand">' + LOGO + "<span>Client portal</span></div>" +
      '<div class="who">' + bellButton() + '<button class="icon-btn help" data-a="tour" aria-label="Take the tour" title="Take the tour">?</button><span class="name">' + esc(S.me.name) + (staff() ? ' <span class="pill">Team</span>' : "") + '</span><div class="avatar">' + esc(initials(S.me.name)) + '</div><button class="btn ghost sm" data-a="logout">Log out</button></div></header>' +
      '<div class="wrap' + (S.projects && (staff() || S.projects.length > 1) ? " has-side" : "") + '">' + (S.projects && (staff() || S.projects.length > 1) ? sidebar() : "") + '<main class="main">' + (S.err ? '<p class="error" style="margin-bottom:12px">' + esc(S.err) + "</p>" : "") + body + "</main></div>" +
      (S.bell ? bellPanel() : "") + (S.modal ? renderModal() : "") + (S.lb ? renderLightbox() : "");
    restore(snap);
    if (S.tour) drawTour();                       // a redraw wipes the overlay: put it back on the same step
    if (S.tab === "messages" && S.data) setTimeout(markChannelRead, 0);
    // Timeline wider than the screen (phones): keep the scroll position, or start with today in view.
    var gw = root.querySelector(".gantt-wrap"), tl = gw && gw.querySelector(".g-today"), lab = gw && gw.querySelector(".g-label");
    if (gw && gw.scrollWidth > gw.clientWidth) gw.scrollLeft = gLeft >= 0 ? gLeft : tl ? Math.max(0, tl.offsetLeft + tl.parentNode.offsetLeft - (lab ? lab.offsetWidth : 0) - 40) : 0;
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
      (demo ? '<div class="demo-box"><b>Preview with sample data.</b> Log in as <b>jesus@example.com</b> (team) , <b>client@example.com</b> (client) or <b>architect@example.com</b> (architect). The code is <b>123456</b>. Nothing here is real or sent.</div>' : "") +
      (!API && !window.BSP_MOCK ? '<p class="error">The portal isn\'t connected yet.</p>' : "") +
      "</div></section>";
    S.err = "";
    var inp = root.querySelector("input"); if (inp) inp.focus();
  }

  function renderList() {
    var list = S.projects || [], view = staff() ? (S.home || "projects") : "projects";
    var active = list.filter(function (p) { return p.status !== "archived"; }), archived = list.filter(function (p) { return p.status === "archived"; });
    var unreadAll = active.reduce(function (a, p) { return a + (p.unread || 0); }, 0);
    var card = function (p) {
      var mo = p.money || {}, paidPct = mo.total ? pctOf(mo.paid, mo.total) : 0;
      return '<button class="pcard" data-a="open" data-id="' + esc(p.id) + '"><div class="cover" style="' + bg(p.cover) + '"><span class="pill dark">' + esc(p.phase) + "</span>" + (p.unread ? '<span class="pill new">' + p.unread + " new</span>" : "") + "</div>" +
        '<div class="body"><h3>' + esc(p.name) + '</h3><span class="muted small">' + esc([p.client_name, p.city].filter(Boolean).join(" · ")) + "</span>" +
        (mo.total ? '<div class="pc-money"><b>' + money(mo.total) + '</b><span class="muted small">' + paidPct + "% paid</span></div>" + '<div class="cbar slim"><i class="paid" style="width:' + pctOf(mo.paid, mo.total) + '%"></i><i class="wait" style="width:' + pctOf(mo.waiting, mo.total) + '%"></i><i class="held" style="width:' + pctOf(mo.held, mo.total) + '%"></i></div>'
          : '<div class="bar"><i style="width:' + Number(p.progress || 0) + '%"></i></div>') +
        '<div class="meta">' + (p.openQuestions ? '<span class="pill gold">' + p.openQuestions + " open question" + (p.openQuestions > 1 ? "s" : "") + "</span>" : "") +
        (p.balance ? '<span class="pill' + (mo.overdue ? " bad" : "") + '">' + money(p.balance) + (mo.overdue ? " due · " + money(mo.overdue) + " overdue" : " due") + "</span>" : "") + (p.lastUpdate ? '<span class="pill">Updated ' + day(p.lastUpdate.slice(0, 10)) + "</span>" : "") + "</div></div></button>";
    };
    var chips = staff() ? '<div class="chips home-chips">' + [["projects", "Projects", 0], ["activity", "Activity", unreadAll], ["team", "Team", 0]].map(function (o) { return '<button class="chip' + (view === o[0] ? " on" : "") + '" data-a="homeView" data-v="' + o[0] + '">' + o[1] + (o[2] ? ' <span class="count">' + o[2] + "</span>" : "") + "</button>"; }).join("") + "</div>" : "";
    var head = '<div class="section-title" style="margin-top:6px"><div><div class="eyebrow">' + (staff() ? "Blue Sierra" : "Your projects") + '</div><h2 style="font-size:32px;margin-top:4px">' + (staff() ? "Home" : "Welcome, " + esc(first(S.me.name))) + "</h2></div>" +
      (staff() && view === "projects" ? '<button class="btn" data-a="modal" data-m="project">New project</button>' : "") + "</div>" + chips;
    if (view === "activity") return head + homeActivity();
    if (view === "team") return head + homeTeam();
    var portfolio = "";
    if (staff() && active.length) {
      var t = { total: 0, billed: 0, paid: 0, waiting: 0, overdue: 0, held: 0 }, withC = 0;
      active.forEach(function (p) { var mo = p.money || {}; if (mo.total) withC++; Object.keys(t).forEach(function (k) { t[k] += Number(mo[k] || 0); }); });
      portfolio = '<div class="grid g4 portfolio">' + stat("Under contract", money(t.total), withC + " active project" + (withC === 1 ? "" : "s") + " with a contract") +
        stat("Billed", money(t.billed), pctOf(t.billed, t.total) + "% of the contracts") + stat("Collected", money(t.paid), pctOf(t.paid, t.total) + "% of the contracts") +
        stat("To collect", money(t.waiting), t.overdue ? '<span style="color:var(--bad)">' + money(t.overdue) + " overdue</span>" : "Nothing overdue" + (t.held ? " · " + money(t.held) + " retainage held" : "")) + "</div>";
    }
    return head + portfolio +
      (active.length ? '<div class="projects">' + active.map(card).join("") + "</div>" : '<div class="empty">' + (staff() ? "No projects yet. Create the first one." : "There's no project on your account yet. Blue Sierra will add it soon.") + "</div>") +
      (archived.length ? '<div class="section-title"><h2>Archived</h2></div><div class="projects">' + archived.map(card).join("") + "</div>" : "");
  }
  function homeActivity() {
    if (!S.activity) { loadHome("activity"); return '<div class="loading" style="min-height:30vh">Loading activity…</div>'; }
    if (!S.activity.length) return '<div class="empty">No messages yet in any project.</div>';
    var lastDay = "";
    return '<div class="card act">' + S.activity.map(function (it) {
      var d = String(it.at).slice(0, 10), sep = d !== lastDay ? '<div class="act-day">' + day(d) + "</div>" : ""; lastDay = d;
      return sep + '<button class="act-row' + (it.unread ? " unread" : "") + '" data-a="actOpen" data-p="' + esc(it.project_id) + '" data-c="' + esc(it.channel) + '" data-th="' + esc(it.thread_id || "") + '">' +
        '<div class="avatar sm ' + (it.role === "client" ? "gold" : it.role === "architect" ? "arch" : "") + '">' + esc(initials(it.author)) + "</div><div class=\"act-body\"><div class=\"act-top\"><b>" + esc(it.author) + '</b><span class="muted small">' + esc(it.project) + " · #" + esc(it.channel) + (it.thread_id ? " · thread" : "") + "</span>" +
        (it.mention ? '<span class="pill new">@you</span>' : "") + (it.kind === "question" ? '<span class="pill gold">Question</span>' : "") + '<span class="muted small act-time">' + day(it.at).replace(/^.* · /, "") + "</span></div>" +
        '<div class="act-text">' + esc(it.text || (it.files ? it.files + " attachment" + (it.files > 1 ? "s" : "") : "")) + "</div></div>" + (it.unread ? '<span class="dot"></span>' : "") + "</button>";
    }).join("") + "</div>";
  }
  function homeTeam() {
    if (!S.team) { loadHome("team"); return '<div class="loading" style="min-height:30vh">Loading the team…</div>'; }
    var admin = S.me && S.me.admin;
    return '<div class="card" style="display:flex;flex-direction:column;gap:12px">' + S.team.map(function (x) {
      return '<div class="team-row' + (x.active ? "" : " off") + '"><div class="avatar">' + esc(initials(x.name)) + '</div><div style="flex:1;min-width:0"><b style="font-weight:500">' + esc(x.name) + (x.email === S.me.email ? " (you)" : "") + '</b><div class="muted small">' + esc(x.email) + (x.since ? " · since " + day(x.since) : "") + "</div></div>" +
        '<span class="pill ' + (x.role === "admin" ? "dark" : "") + '">' + (x.role === "admin" ? "Admin" : "Team") + "</span>" + (x.active ? "" : '<span class="pill bad">Access off</span>') +
        (admin && x.email !== S.me.email && x.role !== "admin" ? (x.active ? '<button class="btn ghost sm" data-a="teamOff" data-email="' + esc(x.email) + '">Turn off</button>' : '<button class="btn ghost sm" data-a="teamOn" data-email="' + esc(x.email) + '" data-name="' + esc(x.name) + '">Turn back on</button>') : "") + "</div>";
    }).join("") + "</div>" +
      (admin ? '<form class="card form" data-form="team" style="margin-top:16px"><h3>Add someone to the Blue Sierra team</h3><p class="muted small">Team members see every project: chat (including #team), schedule, photos, contract and invoices. They log in with their email and a 6-digit code.</p>' +
        '<div class="row2"><label class="f">Name<input type="text" name="name" required></label><label class="f">Email<input type="email" name="email" required></label></div>' +
        '<label class="check-line"><input type="checkbox" name="invite" checked> Email them an invitation</label><div class="actions"><button class="btn" type="submit">Add to the team</button></div></form>'
        : '<p class="muted small" style="margin-top:12px">Only Jesús can add or remove team members. Clients and architects are added from each project’s People tab.</p>');
  }
  function refreshList() { var seq = S.seq; call("listProjects").then(function (r) { if (seq === S.seq) { S.projects = r.projects; if (!S.pid) keepScroll(render); } }).catch(function () {}); }
  async function loadHome(what) {
    if (S.homeLoading === what) return; S.homeLoading = what; var seq = S.seq;
    try {
      if (what === "activity") { var r = await call("activity", { limit: 80 }); if (seq === S.seq) S.activity = r.items; }
      else { var t = await call("listTeam"); if (seq === S.seq) S.team = t.team; }
    } catch (e) { toast(e.message); if (what === "activity") S.activity = []; else S.team = []; }
    S.homeLoading = null; if (!S.pid) keepScroll(render);
  }
  /* Slack-style sidebar (wide screens): home, activity, team, every project with unread counts, and the open project's channels. */
  function sidebar() {
    var list = (S.projects || []).filter(function (p) { return p.status !== "archived"; }), unreadAll = list.reduce(function (a, p) { return a + (p.unread || 0); }, 0);
    var item = function (a, label, on, n, extra) { return '<button class="s-item' + (on ? " on" : "") + '" ' + a + ">" + label + (n ? '<span class="count">' + n + "</span>" : "") + "</button>" + (extra || ""); };
    var home = !S.pid;
    return '<aside class="side" data-lenis-prevent>' + (staff() ? item('data-a="homeView" data-v="projects"', "Home", home && (S.home || "projects") === "projects") + item('data-a="homeView" data-v="activity"', "Activity", home && S.home === "activity", unreadAll) + item('data-a="homeView" data-v="team"', "Team", home && S.home === "team")
        : item('data-a="home"', "All projects", home)) +
      '<div class="s-head">Projects</div>' + list.map(function (p) {
        var on = S.pid === p.id, chans = on && S.data ? '<div class="s-chans">' + myChannels().map(function (c) { var n = c === S.chan && S.tab === "messages" ? 0 : unreadIn(c); return '<button class="s-chan' + (S.tab === "messages" && S.chan === c ? " on" : "") + '" data-a="sideChan" data-c="' + c + '"># ' + c + (n ? '<span class="count">' + n + "</span>" : "") + "</button>"; }).join("") + "</div>" : "";
        return item('data-a="open" data-id="' + esc(p.id) + '"', esc(p.name), on, on && S.data ? 0 : p.unread, chans);
      }).join("") + "</aside>";
  }

  /* ---------------- project ---------------- */
  function openQuestions() { return S.data.messages.filter(function (m) { return m.kind === "question" && m.status === "open"; }); }
  function clientTodo() { if (!asClient() && !staff()) return []; return S.data.checklist.filter(function (c) { return c.owner === "client" && !isDone(c.done); }); }
  function visibleInvoices() { return S.data.invoices.filter(function (i) { return staff() || (i.status !== "draft" && i.status !== "void"); }); }

  function renderProject() {
    var d = S.data, p = d.project, oq = openQuestions().length, todo = clientTodo().length;
    var idx = PHASES.indexOf(p.phase);
    var tabs = [["overview", "Overview", 0], ["schedule", "Schedule", 0], ["updates", "Updates", 0], ["photos", "Photos", 0], ["messages", "Chat", (function () { var n = 0; myChannels().forEach(function (c) { n += unreadIn(c); }); return n || oq; })()], ["invoices", S.data && S.data.contract && S.data.contract.lines && S.data.contract.lines.length ? "Contract & billing" : "Invoices", 0], ["checklist", "Checklist", staff() ? 0 : todo]];
    if (staff()) tabs.push(["people", "People", 0]);
    var body = { overview: tabOverview, schedule: tabSchedule, updates: tabUpdates, photos: tabPhotos, messages: tabMessages, invoices: tabInvoices, checklist: tabChecklist, people: staff() ? tabPeople : tabOverview }[S.tab] || tabOverview;
    return (staff() || (S.projects || []).length > 1 ? '<button class="crumb link" data-a="home">← All projects</button>' : "") +
      '<section class="phead" style="' + bg(p.cover) + '"><div class="phead-flex"><div><div class="eyebrow">' + esc([p.city, p.phase].filter(Boolean).join(" · ")) + "</div><h1>" + esc(p.name) + "</h1>" +
      (p.summary ? "<p>" + esc(p.summary) + "</p>" : "") + (function () { var cm = contractMath(); return cm.has ? '<div class="phead-money"><span><b>' + money(cm.total) + '</b> contract</span><span><b>' + pctOf(cm.paid, cm.total) + "%</b> paid</span>" + (cm.waiting ? "<span><b>" + money(cm.waiting) + "</b> due</span>" : "") + "</div>" : ""; })() + "</div>" +
      (staff() ? '<button class="btn light sm" data-a="modal" data-m="project" data-id="' + esc(p.id) + '">Edit project</button>' : "") + "</div></section>" +
      '<div class="stepper" aria-label="Project phase: ' + esc(p.phase) + '">' + PHASES.map(function (ph, i) { return '<div class="step ' + (i < idx ? "done" : i === idx ? "now" : "") + '"><i></i><span>' + esc(ph) + "</span></div>"; }).join("") + "</div>" +
      '<nav class="tabs">' + tabs.map(function (t) { return '<button data-a="tab" data-t="' + t[0] + '" class="' + (S.tab === t[0] ? "on" : "") + '">' + t[1] + (t[2] ? '<span class="count">' + t[2] + "</span>" : "") + "</button>"; }).join("") + "</nav>" +
      body();
  }

  function stat(label, big, small) { return '<div class="card stat"><div class="eyebrow">' + label + "</div><b>" + big + "</b><span>" + small + "</span></div>"; }

  function tabOverview() {
    var d = S.data, p = d.project, inv = visibleInvoices().filter(function (i) { return i.status !== "draft" && i.status !== "void"; });
    var due = inv.filter(function (i) { return i.status !== "paid"; }).reduce(function (a, i) { return a + i.amount - (i.retainage || 0); }, 0), cm = contractMath();
    var overdue = inv.filter(function (i) { return i.status === "overdue"; }).length;
    var oq = openQuestions(), todo = clientTodo(), last = d.timeline[0];
    var waiting = oq.map(function (q) { return '<div class="msg"><div class="avatar gold">?</div><div class="bubble question"><div class="who-line"><b>' + esc(q.author) + "</b> asked · " + day(q.at) + '</div><div class="text">' + esc(q.text) + "</div>" + (!asClient() ? "" : answerBox(q)) + "</div></div>"; }).join("") +
      todo.map(function (c) { return checkRow(c); }).join("");
    return (!staff() ? '<div class="hello"><h2>' + esc(hello()) + '</h2><p class="muted">' + (oq.length + todo.length ? "There " + (oq.length + todo.length === 1 ? "is 1 thing" : "are " + (oq.length + todo.length) + " things") + " waiting on you below." : "Nothing needs you right now. Here's how your project is going.") + "</p></div>" : "") +
      '<div class="grid g4">' +
      stat("Progress", Number(p.progress || 0) + "%", '<div class="bar" style="margin-top:10px"><i style="width:' + Number(p.progress || 0) + '%"></i></div>') +
      stat(!asClient() ? "Waiting on the client" : "Waiting on you", String(oq.length + todo.length), oq.length + " question" + (oq.length === 1 ? "" : "s") + " · " + todo.length + " checklist") +
      stat("Balance due", money(due), overdue ? '<span style="color:var(--bad)">' + overdue + " overdue</span>" : "Nothing overdue") +
      stat("Target completion", p.target_date ? day(p.target_date) : "—", p.start_date ? "Started " + day(p.start_date) : "") + "</div>" +
      (cm.has ? '<div class="section-title"><h2>Contract</h2><button class="link" data-a="tab" data-t="invoices">Contract & billing</button></div><div class="card contract">' +
        '<div class="c-top"><div><div class="eyebrow">Contract total</div><div class="c-mid">' + money(cm.total) + '</div></div><div class="c-side"><div class="eyebrow">Paid so far</div><div class="c-mid">' + pctOf(cm.paid, cm.total) + "%</div></div></div>" + contractBar(cm, true) + "</div>" : "") +
      '<div class="section-title"><h2>' + (!asClient() ? "Waiting on the client" : "Waiting on you") + "</h2></div>" +
      (waiting ? '<div class="thread">' + waiting + "</div>" : '<div class="empty">' + (staff() ? "Nothing pending from the client." : "You're all caught up. Nothing needs your answer right now.") + "</div>") +
      (upcoming(30).length ? '<div class="section-title"><h2>Coming up</h2><button class="link" data-a="tab" data-t="schedule">Full schedule</button></div><div class="sch-list">' + upcoming(30).slice(0, 4).map(itemRow).join("") + "</div>" : "") +
      '<div class="section-title"><h2>Latest update</h2>' + (d.timeline.length ? '<button class="link" data-a="tab" data-t="updates">All updates</button>' : "") + "</div>" +
      (last ? post(last) : '<div class="empty">No updates yet.</div>') +
      (d.photos.length ? '<div class="section-title"><h2>Recent photos</h2><button class="link" data-a="tab" data-t="photos">All ' + d.photos.length + " photos</button></div>" +
        '<div class="strip">' + d.photos.slice(0, 6).map(function (ph, i) { return '<button class="ph" style="' + bg(ph.thumb) + '" data-a="lb" data-i="' + i + '" aria-label="' + esc(ph.caption || "Photo") + '"></button>'; }).join("") + "</div>" : "");
  }

  function post(t) {
    var photos = S.data.photos.filter(function (ph) { return t.photo_ids && t.photo_ids.split(",").indexOf(ph.id) > -1; });
    return '<article class="card" id="up-' + esc(t.id) + '"><div class="post-head"><div class="avatar">' + esc(initials(t.author)) + '</div><div><b style="font-weight:500">' + esc(t.author) + '</b><div class="muted small">' + day(t.at) + (t.emailed ? " · emailed to the client" : "") + "</div></div></div>" +
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
  /* ---------------- chat: channels, threads, files, reactions, @mentions ---------------- */
  var CH_INFO = { client: ["client", "Client, architect and Blue Sierra"], architect: ["architect", "The architect and Blue Sierra. The client doesn't see this."], team: ["team", "Blue Sierra team only. The client and architect never see this."] };
  var EMOJI = ["👍", "✅", "❤️", "👀", "🎉", "🙏"];
  function myChannels() { return (S.data && S.data.channels) || ["client"]; }
  function chanMsgs(ch) { return S.data.messages.filter(function (m) { return (m.channel || "client") === ch; }); }
  function unreadIn(ch) { var r = (S.data.reads || {})[ch] || ""; return chanMsgs(ch).filter(function (m) { return !m.mine && m.at > r; }).length; }
  function roleTag(role) { return role === "client" ? '<span class="pill gold">Client</span>' : role === "architect" ? '<span class="pill arch">Architect</span>' : '<span class="pill">Blue Sierra</span>'; }
  /* Text is escaped first; then links and @mentions of real members are highlighted. */
  function richText(t) {
    var h = esc(t).replace(/(https?:\/\/[^\s<]+[^\s<.,;:!?)\]])/g, '<a href="$1" target="_blank" rel="noopener noreferrer">$1</a>');
    ((S.data && S.data.members) || []).forEach(function (mb) {
      if (!mb.name) return; var at = "@" + esc(mb.name), i = h.toLowerCase().indexOf(at.toLowerCase());
      if (i > -1) h = h.split(at).join('<span class="mention' + (S.me && mb.name === S.me.name ? " me" : "") + '">' + at + "</span>");
    });
    return h;
  }
  function filesHtml(m) {
    if (!m.files || !m.files.length) return "";
    var imgs = m.files.filter(function (f) { return f.thumb; }), docs = m.files.filter(function (f) { return !f.thumb; });
    return (imgs.length ? '<div class="m-imgs">' + imgs.map(function (f) { return '<a href="' + esc(f.full || f.url) + '" target="_blank" rel="noopener noreferrer" class="m-img" style="' + bg(f.thumb) + '" aria-label="' + esc(f.name) + '"></a>'; }).join("") + "</div>" : "") +
      (docs.length ? '<div class="m-docs">' + docs.map(function (f) { return '<a class="m-doc" href="' + esc(f.url) + '" target="_blank" rel="noopener noreferrer"><span>PDF</span>' + esc(f.name) + "</a>"; }).join("") + "</div>" : "");
  }
  function reactHtml(m) {
    return '<div class="m-react">' + (m.reactions || []).map(function (r) { return '<button class="rx' + (r.mine ? " on" : "") + '" data-a="react" data-id="' + esc(m.id) + '" data-e="' + esc(r.e) + '" title="' + esc(r.who.join(", ")) + '">' + r.e + " <b>" + r.n + "</b></button>"; }).join("") +
      '<span class="rx-add"><button class="rx ghost" data-a="rxPick" data-id="' + esc(m.id) + '" aria-label="Add a reaction">☺+</button>' +
      (S.picker === m.id ? '<span class="rx-pop">' + EMOJI.map(function (e) { return '<button data-a="react" data-id="' + esc(m.id) + '" data-e="' + e + '">' + e + "</button>"; }).join("") + "</span>" : "") + "</span></div>";
  }
  var EV = { invoice: ["🧾", "Invoice"], paid: ["💚", "Payment received"], update: ["📸", "Project update"], change: ["✍️", "Change order"], todo: ["✅", "New to-do"], done: ["🎉", "Done"], date: ["📅", "New date"] };
  /* Something happened (an invoice, an update, a to-do): a colored card the client can't miss, with a button straight to it. */
  function eventHtml(m, opts) {
    var ev = EV[m.status] || ["✨", "Update"], lines = String(m.text || "").split("\n"), canDel = S.me && S.me.admin;
    return '<div class="ev ev-' + esc(m.status || "x") + '" id="m-' + esc(m.id) + '"><div class="ev-ico" aria-hidden="true">' + ev[0] + '</div><div class="ev-body">' +
      '<div class="ev-top"><span class="ev-kind">' + ev[1] + '</span><span class="muted small">' + day(m.at) + "</span>" +
      '<span class="m-tools">' + (!opts.inThread ? '<button class="link small" data-a="thread" data-id="' + esc(m.id) + '">Ask about this</button>' : "") + (canDel ? '<button class="link small" data-a="delMsg" data-id="' + esc(m.id) + '">Delete</button>' : "") + "</span></div>" +
      '<div class="ev-line"><b>' + esc(m.author) + "</b> " + esc(lines[0]) + "</div>" + (lines[1] ? '<div class="ev-detail">' + esc(lines.slice(1).join(" ")).replace(/\d{4}-\d{2}-\d{2}/g, function (d) { return day(d); }) + "</div>" : "") +
      (m.ref ? '<button class="ev-btn" data-a="ref" data-ref="' + esc(m.ref) + '">' + ({ invoice: "See the invoice", update: "See the update", co: "See the contract", check: "See the checklist", sched: "See the schedule" }[m.ref.split(":")[0]] || "Open") + " →</button>" : "") +
      reactHtml(m) + (!opts.inThread && opts.replies && opts.replies.length ? '<button class="m-replies" data-a="thread" data-id="' + esc(m.id) + '">' + opts.replies.length + " repl" + (opts.replies.length > 1 ? "ies" : "y") + "</button>" : "") +
      "</div></div>";
  }
  /* Jump to the thing an event or notification points at, and make it glow for a moment. */
  function openRef(ref, pid) {
    var t = String(ref).split(":"), tab = { invoice: "invoices", co: "invoices", update: "updates", check: "checklist", sched: "schedule" }[t[0]] || "overview";
    var target = { invoice: "inv-", update: "up-", check: "ck-" }[t[0]];
    S.bell = false; S.flash = target ? target + t[1] : null;
    if (t[0] === "sched") S.afterLoadModal = { type: "schedView", id: t[1] };
    go(pid || S.pid, tab);
  }
  function msgHtml(m, opts) {
    opts = opts || {};
    if (m.kind === "event") return eventHtml(m, opts);
    var q = m.kind === "question", replies = opts.replies || [], answers = opts.answers || [];
    var canDel = m.mine || (S.me && S.me.admin);
    return '<div class="msg' + (m.mine ? " mine" : "") + (m.mention ? " ping" : "") + '" id="m-' + esc(m.id) + '"><div class="avatar ' + (m.role === "client" ? "gold" : m.role === "architect" ? "arch" : "") + '">' + esc(initials(m.author)) + '</div><div class="bubble ' + (q ? "question" : "") + '">' +
      '<div class="who-line"><b>' + esc(m.author) + "</b>" + roleTag(m.role) + "<span>" + day(m.at) + "</span>" + (m.via === "email" ? '<span class="pill">by email</span>' : "") +
      (q ? (m.status === "open" ? '<span class="pill gold">Question · waiting</span>' : '<span class="pill ok">Answered</span>') : "") +
      '<span class="m-tools">' + (!opts.inThread ? '<button class="link small" data-a="thread" data-id="' + esc(m.id) + '">Reply in thread</button>' : "") +
      (canDel ? '<button class="link small" data-a="delMsg" data-id="' + esc(m.id) + '">Delete</button>' : "") + "</span></div>" +
      (m.text ? '<div class="text">' + richText(m.text) + "</div>" : "") + filesHtml(m) +
      answers.map(function (a) { return '<div class="answer"><div class="who-line"><b>' + esc(a.author) + "</b><span>" + day(a.at) + "</span>" + (a.via === "email" ? '<span class="pill">by email</span>' : "") + '</div><div class="text">' + richText(a.text) + "</div></div>"; }).join("") +
      (q && m.status === "open" ? (staff() ? '<div class="actions" style="justify-content:flex-start;margin-top:8px"><button class="link small" data-a="closeQ" data-id="' + esc(m.id) + '">Mark as answered</button></div>' : asClient() ? answerBox(m) : "") : "") +
      reactHtml(m) +
      (!opts.inThread && replies.length ? '<button class="m-replies" data-a="thread" data-id="' + esc(m.id) + '"><span class="faces">' + replies.slice(-3).map(function (r) { return '<i>' + esc(initials(r.author)) + "</i>"; }).join("") + "</span>" + replies.length + " repl" + (replies.length > 1 ? "ies" : "y") + '<span class="muted"> · last ' + day(replies[replies.length - 1].at) + "</span>" +
        (replies.some(function (r) { return !r.mine && r.at > ((S.data.reads || {})[m.channel || "client"] || ""); }) ? '<span class="dot"></span>' : "") + "</button>" : "") +
      "</div></div>";
  }
  function composer(ch, root) {
    var key = root ? "thread" : "main", pend = (S.att && S.att[key]) || [];
    var ph = root ? "Reply in thread…" : ch === "team" ? "Message the team (only Blue Sierra sees this)" : ch === "architect" ? "Message the architect" : staff() ? "Message the client and architect" : "Message Blue Sierra";
    return '<form class="card composer" data-form="chat" data-ch="' + ch + '"' + (root ? ' data-root="' + esc(root) + '"' : "") + '><div class="mention-wrap"><textarea name="text" data-chat placeholder="' + esc(ph) + '"></textarea></div>' +
      (pend.length ? '<div class="att-list">' + pend.map(function (f, i) { return '<span class="att">' + (f.mime === "application/pdf" ? "PDF · " : "") + esc(f.name) + '<button type="button" data-a="unatt" data-k="' + key + '" data-i="' + i + '" aria-label="Remove">×</button></span>'; }).join("") + "</div>" : "") +
      '<div class="actions" style="justify-content:space-between;align-items:center"><div class="c-left"><label class="btn ghost sm attach">Attach<input type="file" data-att="' + key + '" accept="image/jpeg,image/png,image/webp,application/pdf" multiple hidden></label>' +
      (staff() && ch === "client" && !root ? '<label class="check-line small"><input type="checkbox" name="question"> Ask as a question</label>' : "") + '<span class="muted small hint">Enter to send · Shift+Enter for a new line · @ to mention</span></div>' +
      '<button class="btn" type="submit">Send</button></div></form>';
  }
  function tabMessages() {
    var chans = myChannels(); if (chans.indexOf(S.chan) < 0) S.chan = "client";
    var ch = S.chan, list = chanMsgs(ch), answers = {}, replies = {};
    list.forEach(function (m) { if (m.kind === "answer") (answers[m.question_id] = answers[m.question_id] || []).push(m); else if (m.thread_id) (replies[m.thread_id] = replies[m.thread_id] || []).push(m); });
    var top = list.filter(function (m) { return m.kind !== "answer" && !m.thread_id; }), readAt = S.readMark && S.readMark[ch] != null ? S.readMark[ch] : ((S.data.reads || {})[ch] || ""), lastDay = "", newShown = false;
    var html = top.map(function (m) {
      var d = String(m.at).slice(0, 10), sep = d !== lastDay ? '<div class="day-sep"><span>' + day(d) + "</span></div>" : ""; lastDay = d;
      var nw = !newShown && !m.mine && m.at > readAt && readAt !== "" ? (newShown = true, '<div class="new-sep"><span>New</span></div>') : "";
      return sep + nw + msgHtml(m, { replies: replies[m.id], answers: answers[m.id] });
    }).join("");
    var bar = chans.length > 1 ? '<div class="chans">' + chans.map(function (c) { var n = c === ch ? 0 : unreadIn(c); return '<button class="chan' + (c === ch ? " on" : "") + '" data-a="chan" data-c="' + c + '"># ' + CH_INFO[c][0] + (n ? '<span class="count">' + n + "</span>" : "") + "</button>"; }).join("") + "</div>" : "";
    return bar + '<div class="chan-head"><h2># ' + CH_INFO[ch][0] + '</h2><span class="muted small">' + CH_INFO[ch][1] + (ch === "client" ? (staff() ? " Messages are emailed to the client; their email replies show up here." : " Replies by email also show up here.") : "") + "</span></div>" +
      (html ? '<div class="thread chat">' + html + "</div>" : '<div class="empty">No messages in #' + CH_INFO[ch][0] + " yet. Say hi.</div>") +
      '<div class="reply-bar">' + composer(ch) + "</div>";
  }
  /* Opening a channel marks it read on the server; the "New" line stays until you leave it. */
  function markChannelRead() {
    if (!S.data || S.tab !== "messages" || (S.modal && S.modal.type !== "thread")) return;
    var ch = S.chan, n = unreadIn(ch); if (!n) return;
    S.readMark = S.readMark || {}; if (S.readMark[ch] == null) S.readMark[ch] = (S.data.reads || {})[ch] || "";
    var stamp = new Date(), pad = function (x) { return String(x).padStart(2, "0"); };
    S.data.reads = S.data.reads || {}; S.data.reads[ch] = stamp.getFullYear() + "-" + pad(stamp.getMonth() + 1) + "-" + pad(stamp.getDate()) + " " + pad(stamp.getHours()) + ":" + pad(stamp.getMinutes()) + ":59";
    var pr = (S.projects || []).filter(function (x) { return x.id === S.pid; })[0]; if (pr) pr.unread = Math.max(0, (pr.unread || 0) - n);
    (S.notif || []).forEach(function (it) { if (it.project_id === S.pid && it.channel === ch) it.unread = false; });
    var bb = root.querySelector(".bell"); if (bb) bb.outerHTML = bellButton();
    call("markRead", { projectId: S.pid, channel: ch }).catch(function () {});
  }
  function readFile(file) {
    if (/^image\//.test(file.type)) return resize(file, API ? 1800 : 900);
    return new Promise(function (res, rej) {
      if (file.type !== "application/pdf") return rej(new Error(file.name + ": attach photos or PDFs."));
      if (file.size > 10 * 1024 * 1024) return rej(new Error(file.name + " is over 10 MB."));
      var fr = new FileReader(); fr.onload = function () { res({ name: file.name, mime: "application/pdf", data: fr.result }); }; fr.onerror = function () { rej(new Error("Couldn't read " + file.name + ".")); }; fr.readAsDataURL(file);
    });
  }
  /* @mention picker: shows the people who can see this channel. */
  function mentionPop(ta) {
    var wrap = ta.parentNode, old = wrap.querySelector(".mention-pop"); if (old) old.remove();
    var before = ta.value.slice(0, ta.selectionStart), mt = before.match(/(^|\s)@([^\s@]{0,20}(?: [^\s@]{0,20})?)$/); if (!mt) return;
    var ch = ta.form.dataset.ch, q = mt[2].toLowerCase();
    var who = ((S.data && S.data.members) || []).filter(function (mb) {
      var ok = ch === "team" ? (mb.role === "admin" || mb.role === "staff") : ch === "architect" ? mb.role !== "client" : true;
      return ok && mb.name && mb.name !== S.me.name && mb.name.toLowerCase().indexOf(q) > -1;
    }).slice(0, 6);
    if (!who.length) return;
    var pop = document.createElement("div"); pop.className = "mention-pop";
    who.forEach(function (mb) {
      var b = document.createElement("button"); b.type = "button"; b.innerHTML = "<b>" + esc(mb.name) + "</b> <span>" + esc({ client: "Client", architect: "Architect" }[mb.role] || "Blue Sierra") + "</span>";
      b.addEventListener("mousedown", function (e) {
        e.preventDefault();
        var start = before.length - mt[2].length - 1, after = ta.value.slice(ta.selectionStart);
        ta.value = ta.value.slice(0, start) + "@" + mb.name + " " + after; var pos = start + mb.name.length + 2; ta.setSelectionRange(pos, pos); ta.focus(); pop.remove();
      });
      pop.appendChild(b);
    });
    wrap.appendChild(pop);
  }

  /* ---------------- notification bell (playful, HEY-style) ---------------- */
  function notifModel() {
    var items = (S.notif || []).filter(function (it) { return !it.mine; }), fresh = items.filter(function (it) { return it.unread; }), old = items.filter(function (it) { return !it.unread; }).slice(0, 6);
    var needs = [];
    (S.projects || []).filter(function (p) { return p.status !== "archived"; }).forEach(function (p) {
      var n = p.needs || {}, many = (S.projects || []).length > 1, where = many ? " · " + p.name : "";
      (n.invoices || []).forEach(function (i) { if (!staff() || i.overdue) needs.push({ tone: i.overdue ? "red" : "green", ico: "🧾", text: (i.overdue ? "Overdue: " : "To pay: ") + "invoice " + i.number + " · " + money(i.amount) + (i.due ? " by " + day(i.due) : ""), ref: "invoice:" + i.id, p: p.id, where: where }); });
      if (p.openQuestions) needs.push({ tone: "gold", ico: "💬", text: (staff() ? p.openQuestions + " question" + (p.openQuestions > 1 ? "s" : "") + " waiting on the client" : "Blue Sierra asked you " + (p.openQuestions > 1 ? p.openQuestions + " questions" : "a question")), chat: true, p: p.id, where: where });
      if (!staff()) (n.todos || []).slice(0, 4).forEach(function (c) { needs.push({ tone: "purple", ico: "✅", text: "To do: " + c.item + (c.due ? " · by " + day(c.due) : ""), ref: "check:" + c.id, p: p.id, where: where }); });
      (n.dates || []).filter(function (x) { return staff() ? true : x.owner === "client" || ["decision", "meeting", "payment", "inspection"].indexOf(x.kind) > -1; }).slice(0, 3).forEach(function (x) {
        needs.push({ tone: "blue", ico: { decision: "🤔", meeting: "🤝", payment: "💵", inspection: "🔎", milestone: "🏁", deadline: "⏰" }[x.kind] || "📅", text: day(x.start) + ": " + x.title, ref: "sched:" + x.id, p: p.id, where: where });
      });
    });
    return { fresh: fresh, old: old, needs: needs };
  }
  function bellButton() {
    var m = notifModel(), n = m.fresh.length;
    return '<button class="bell' + (S.bell ? " on" : "") + '" data-a="bell" aria-label="Notifications' + (n ? ", " + n + " new" : "") + '"><svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path d="M12 22a2.5 2.5 0 0 0 2.45-2h-4.9A2.5 2.5 0 0 0 12 22Zm7-6V11a7 7 0 0 0-5.5-6.84V3.5a1.5 1.5 0 0 0-3 0v.66A7 7 0 0 0 5 11v5l-2 2v1h18v-1Z" fill="currentColor"/></svg>' +
      (n ? '<span class="bell-n">' + (n > 9 ? "9+" : n) + "</span>" : m.needs.length ? '<span class="bell-dot"></span>' : "") + "</button>";
  }
  function hello() {
    var h = new Date().getHours(), f = first(S.me.name);
    return h < 12 ? "Good morning, " + f + " ☀️" : h < 18 ? "Good afternoon, " + f + " 👋" : "Good evening, " + f + " 🌙";
  }
  function bellPanel() {
    var m = notifModel();
    var row = function (it) {
      var ev = it.kind === "event" ? (EV[it.status] || ["✨"])[0] : it.kind === "question" ? "❓" : it.files ? "📎" : "💬";
      var line = it.kind === "event" ? "<b>" + esc(it.author) + "</b> " + esc(String(it.text).split("\n")[0]) : "<b>" + esc(it.author) + "</b> in #" + esc(it.channel) + ": " + esc(String(it.text || "").slice(0, 120));
      return '<button class="n-row' + (it.unread ? " new" : "") + '" ' + (it.kind === "event" && it.ref ? 'data-a="ref" data-ref="' + esc(it.ref) + '" data-p="' + esc(it.project_id) + '"' : 'data-a="actOpen" data-p="' + esc(it.project_id) + '" data-c="' + esc(it.channel) + '" data-th="' + esc(it.thread_id || "") + '"') + '>' +
        '<span class="n-ico">' + ev + '</span><span class="n-txt">' + line + '<small>' + day(it.at) + ((S.projects || []).length > 1 ? " · " + esc(it.project) : "") + "</small></span>" + (it.unread ? '<span class="dot"></span>' : "") + "</button>";
    };
    var needs = m.needs.map(function (n) { return '<button class="need t-' + n.tone + '" ' + (n.chat ? 'data-a="actOpen" data-p="' + esc(n.p) + '" data-c="client" data-th=""' : 'data-a="ref" data-ref="' + esc(n.ref) + '" data-p="' + esc(n.p) + '"') + '><span>' + n.ico + "</span>" + esc(n.text) + '<small>' + esc(n.where) + "</small></button>"; }).join("");
    var caught = !m.fresh.length && !m.needs.length;
    return '<div class="bell-bg" data-a="bellClose"></div><div class="bell-panel" role="dialog" aria-label="Notifications" data-lenis-prevent>' +
      '<div class="bp-head"><div><div class="bp-hi">' + esc(hello()) + '</div><div class="muted small">' + (caught ? "Nothing needs you right now." : m.fresh.length ? m.fresh.length + " new thing" + (m.fresh.length > 1 ? "s" : "") + " since you last looked." : "Here's what's coming up.") + "</div></div>" +
      '<button class="icon-btn" data-a="bellClose" aria-label="Close">✕</button></div>' +
      (S.notif == null ? '<div class="bp-load">Checking for news…</div>' : "") +
      (caught && S.notif != null ? '<div class="bp-empty">' + EMPTY_ART + "<b>You're all caught up!</b><span>Go enjoy your day. We'll ping you when something happens.</span></div>" : "") +
      (needs ? '<div class="bp-sec">' + (staff() ? "Keep an eye on" : "Needs you") + '</div><div class="needs">' + needs + "</div>" : "") +
      (m.fresh.length ? '<div class="bp-sec">New for you</div>' + m.fresh.map(row).join("") : "") +
      (m.old.length ? '<div class="bp-sec">Earlier</div>' + m.old.map(row).join("") : "") +
      '<div class="bp-foot">' + (m.fresh.length ? '<button class="link small" data-a="markAll">Mark all as read</button>' : "<span></span>") + '<button class="link small" data-a="tour">Take the tour</button></div></div>';
  }
  var EMPTY_ART = '<svg viewBox="0 0 160 110" width="150" aria-hidden="true"><circle cx="80" cy="58" r="44" fill="#f3e7d3"/><path d="M48 70c10-16 22-24 32-24s22 8 32 24" fill="none" stroke="#c39a5a" stroke-width="4" stroke-linecap="round"/><circle cx="80" cy="38" r="12" fill="#eda100"/><g stroke="#eda100" stroke-width="3" stroke-linecap="round"><path d="M80 18v-6M98 26l5-4M62 26l-5-4M104 40h6M50 40h6"/></g><path d="M30 92h100" stroke="#2f6b4a" stroke-width="4" stroke-linecap="round"/><path d="M44 92c2-8 6-12 10-12M60 92c0-6 3-10 6-11M112 92c-2-8-6-12-10-12" stroke="#2f6b4a" stroke-width="3" fill="none" stroke-linecap="round"/></svg>';
  async function loadNotif() {
    var seq = S.seq;
    try {
      var r = await call("activity", { limit: 40 }); if (seq !== S.seq) return; S.notif = r.items;
      if (S.bell || !S.pid) keepScroll(render); else { var bb = root.querySelector(".bell"); if (bb) bb.outerHTML = bellButton(); }
    } catch (e) {}
  }
  async function markAllRead() {
    var pairs = {}; (S.notif || []).forEach(function (it) { if (it.unread) pairs[it.project_id + "|" + it.channel] = 1; });
    S.notif.forEach(function (it) { it.unread = false; }); (S.projects || []).forEach(function (p) { p.unread = 0; }); keepScroll(render);
    await Promise.all(Object.keys(pairs).map(function (k) { var x = k.split("|"); return call("markRead", { projectId: x[0], channel: x[1] }).catch(function () {}); }));
  }
  // The bell checks for news every minute while the page is open (and right away when you come back to the tab).
  setInterval(function () { if (S.token && S.me && document.visibilityState === "visible") { loadNotif(); refreshList(); } }, 60000);
  document.addEventListener("visibilitychange", function () { if (document.visibilityState === "visible" && S.token && S.me) loadNotif(); });

  /* ---------------- first-login tour: a spotlight that walks you around ---------------- */
  function tourSteps() {
    if (staff()) return [
      { t: "Welcome to the Blue Sierra portal 👋", b: "Every project in one place: chat, schedule, photos, contract and invoices. This takes 40 seconds." },
      { el: ".side", t: "Your sidebar", b: "Home, Activity, Team and every project. The red numbers are unread messages." },
      { el: ".home-chips", t: "Home, Activity, Team", b: "Activity is everything new across all projects. Team is where you add people from Blue Sierra." },
      { el: ".portfolio", t: "The money, at a glance", b: "What's under contract, billed, collected and still to collect across all projects." },
      { el: ".pcard", t: "A project", b: "Open it to post updates, chat in #client, #architect and #team, and send invoices." },
      { el: ".bell", t: "Notifications", b: "New messages, invoices and dates show up here. A number means something new." },
      { el: ".help", t: "Need this again?", b: "Tap the ? any time to replay the tour. That's it. Go build something beautiful 🌿" }
    ];
    return [
      { t: "Welcome, " + first(S.me.name) + " 👋", b: "This is your project with Blue Sierra. Let's take a 30-second look around." },
      { el: ".phead-money", t: "Your contract, in one line", b: "The total, how much is paid and what's due right now." },
      { el: ".stepper", t: "Where we are", b: "The phase your project is in today, from design to complete." },
      { el: ".tabs", t: "Everything about your project", b: "Updates and photos, the schedule, chat, contract & billing and your checklist." },
      { el: '[data-t="messages"]', t: "Chat with us", b: "Write any time. You can also just reply to our emails and it lands here." },
      { el: '[data-t="invoices"]', t: "Contract & billing", b: "Each invoice and how it draws down the contract total. No surprises." },
      { el: '[data-t="checklist"]', t: "Your to-dos", b: "Decisions and things we need from you. Tick them off when they're done." },
      { el: ".bell", t: "Notifications", b: "When we send an invoice, post photos or need a decision, it shows up here." },
      { el: ".help", t: "That's it!", b: "Tap the ? to see this again. Welcome aboard 🌿" }
    ];
  }
  function tourKey() { return "bsp-tour-v1-" + (S.me && S.me.email) + (staff() ? "-team" : "-client"); }
  function startTour(force) {
    if (!S.me || S.tour || S.modal) return;
    if (!force) { try { if (localStorage.getItem(tourKey())) return; } catch (e) { return; } if (!staff() && !S.data) return; if (staff() && S.pid) return; }
    var steps = tourSteps().filter(function (st) { return !st.el || visibleEl(st.el); });
    if (steps.length < 2) return;
    S.tour = { steps: steps, i: 0 }; drawTour();
  }
  function visibleEl(sel) { var e = root.querySelector(sel); if (!e) return null; var r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0 ? e : null; }
  function endTour() { try { localStorage.setItem(tourKey(), "1"); } catch (e) {} S.tour = null; var t = document.getElementById("bsp-tour"); if (t) t.remove(); }
  function drawTour() {
    var T = S.tour; if (!T) return; var st = T.steps[T.i], wrap = document.getElementById("bsp-tour");
    if (!wrap) { wrap = document.createElement("div"); wrap.id = "bsp-tour"; wrap.innerHTML = '<div class="tour-spot"></div><div class="tour-bubble" role="dialog" aria-live="polite"></div>'; root.appendChild(wrap); }
    var spot = wrap.querySelector(".tour-spot"), bub = wrap.querySelector(".tour-bubble"), el = st.el ? visibleEl(st.el) : null;
    bub.innerHTML = '<div class="tb-step">' + T.steps.map(function (_, k) { return '<i class="' + (k === T.i ? "on" : k < T.i ? "past" : "") + '"></i>'; }).join("") + "</div><b>" + esc(st.t) + "</b><p>" + esc(st.b) + "</p>" +
      '<div class="tb-actions"><button class="link small" data-tour="skip">' + (T.i === T.steps.length - 1 ? "" : "Skip") + "</button><span>" + (T.i ? '<button class="btn ghost sm" data-tour="back">Back</button>' : "") +
      '<button class="btn sm" data-tour="next">' + (T.i === T.steps.length - 1 ? "Let's go! 🎉" : "Next") + "</button></span></div>";
    var place = function () {
      var vw = innerWidth, vh = innerHeight, bw = Math.min(340, vw - 32);
      bub.style.width = bw + "px";
      if (!el) { spot.style.cssText = "top:" + vh / 2 + "px;left:" + vw / 2 + "px;width:0;height:0"; bub.style.left = (vw - bw) / 2 + "px"; bub.style.top = Math.max(16, vh / 2 - bub.offsetHeight / 2) + "px"; bub.className = "tour-bubble center"; return; }
      var r = el.getBoundingClientRect(), pad = 8;
      spot.style.cssText = "top:" + (r.top - pad) + "px;left:" + (r.left - pad) + "px;width:" + (r.width + pad * 2) + "px;height:" + (r.height + pad * 2) + "px";
      var below = r.bottom + 16 + bub.offsetHeight < vh, top = below ? r.bottom + 16 : Math.max(16, r.top - 16 - bub.offsetHeight);
      if (!below && r.top - 16 - bub.offsetHeight < 0) top = Math.min(vh - bub.offsetHeight - 16, r.bottom + 16);
      bub.style.top = top + "px"; bub.style.left = Math.max(16, Math.min(vw - bw - 16, r.left + r.width / 2 - bw / 2)) + "px";
      bub.className = "tour-bubble " + (below ? "below" : "above");
      bub.style.setProperty("--arrow", Math.max(18, Math.min(bw - 18, r.left + r.width / 2 - parseFloat(bub.style.left))) + "px");
    };
    if (el) { var rr = el.getBoundingClientRect(); if (rr.top < 70 || rr.bottom > innerHeight - 40) { el.scrollIntoView({ block: "center" }); } }
    requestAnimationFrame(place); T.place = place;
    var nb = bub.querySelector("[data-tour=next]"); if (nb) nb.focus({ preventScroll: true });
  }
  root.addEventListener("click", function (e) {
    var b = e.target.closest("[data-tour]"); if (!b || !S.tour) return;
    var a = b.dataset.tour; if (a === "skip") return endTour();
    if (a === "next") { if (S.tour.i >= S.tour.steps.length - 1) return endTour(); S.tour.i++; }
    if (a === "back") S.tour.i = Math.max(0, S.tour.i - 1);
    drawTour();
  });
  window.addEventListener("resize", function () { if (S.tour && S.tour.place) S.tour.place(); });
  window.addEventListener("scroll", function () { if (S.tour && S.tour.place) S.tour.place(); }, { passive: true });
  document.addEventListener("keydown", function (e) {
    if (!S.tour) return;
    if (e.key === "Escape") { e.stopPropagation(); endTour(); }
    if (e.key === "ArrowRight") { if (S.tour.i < S.tour.steps.length - 1) { S.tour.i++; drawTour(); } else endTour(); }
    if (e.key === "ArrowLeft" && S.tour.i) { S.tour.i--; drawTour(); }
  }, true);

  /* ---------------- contract & billing ---------------- */
  // Every number comes from the same math, so the overview, the bar, the breakdown and the invoices always agree.
  function contractMath() {
    var c = S.data.contract || { lines: [], retainage_pct: 0 }, lines = c.lines || [];
    var sum = function (list, f) { return list.reduce(function (a, x) { return a + f(x); }, 0); };
    var base = lines.filter(function (l) { return l.kind === "base"; }), cos = lines.filter(function (l) { return l.kind === "change"; });
    var approved = cos.filter(function (l) { return l.status === "approved"; }), proposed = cos.filter(function (l) { return l.status === "proposed"; });
    var inv = visibleInvoices().filter(function (i) { return i.status !== "draft" && i.status !== "void"; })
      .sort(function (a, b) { return (a.issued || "") < (b.issued || "") ? -1 : (a.issued || "") > (b.issued || "") ? 1 : String(a.number).localeCompare(String(b.number)); });
    var due = function (i) { return i.amount - (i.retainage || 0); };
    var m = { pct: Number(c.retainage_pct || 0), base: base, cos: cos, original: sum(base, function (l) { return l.amount; }), changes: sum(approved, function (l) { return l.amount; }),
      proposed: sum(proposed, function (l) { return l.amount; }), inv: inv, billed: sum(inv, function (i) { return i.amount; }), held: sum(inv, function (i) { return i.retainage || 0; }),
      paid: sum(inv.filter(function (i) { return i.status === "paid"; }), due), waiting: sum(inv.filter(function (i) { return i.status !== "paid"; }), due), byLine: {}, unsplit: 0, after: {} };
    m.total = m.original + m.changes; m.left = m.total - m.billed; m.has = lines.length > 0;
    var run = 0;
    inv.forEach(function (i) {
      var split = 0; Object.keys(i.lines || {}).forEach(function (k) { m.byLine[k] = (m.byLine[k] || 0) + Number(i.lines[k]); split += Number(i.lines[k]); });
      m.unsplit += i.amount - split; run += i.amount; m.after[i.id] = m.total - run;
    });
    return m;
  }
  function pctOf(a, b) { return b > 0 ? Math.round(a / b * 1000) / 10 : 0; }
  function contractBar(m, compact) {
    var whole = Math.max(m.total, m.billed, 1), seg = function (cls, v, label) { var w = Math.max(0, v) / whole * 100; return w > 0 ? '<i class="' + cls + '" style="width:' + w + '%" title="' + esc(label + ": " + money(v)) + '"></i>' : ""; };
    var key = [["paid", "Paid", m.paid, ""], ["wait", "Billed, waiting for payment", m.waiting, ""], ["held", "Retainage held" + (m.pct ? " (" + m.pct + "%)" : ""), m.held, "Paid at completion"], ["left", "Left to bill", m.left, ""]]
      .filter(function (k) { return k[0] === "paid" || k[0] === "left" || Math.abs(k[2]) > 0.004; });
    return '<div class="cbar" role="img" aria-label="' + esc(key.map(function (k) { return k[1] + " " + money(k[2]); }).join(", ")) + '">' +
      seg("paid", m.paid, "Paid") + seg("wait", m.waiting, "Billed, waiting for payment") + seg("held", m.held, "Retainage held") + seg("left", m.left, "Left to bill") + "</div>" +
      '<div class="ckey' + (compact ? " compact" : "") + '">' + key.map(function (k) {
        return '<div><span class="sw ' + k[0] + '"></span><span class="ck-l">' + k[1] + (k[3] && !compact ? '<small>' + k[3] + "</small>" : "") + '</span><b>' + money(k[2]) + '</b><span class="muted small">' + pctOf(k[2], m.total) + "%</span></div>";
      }).join("") + "</div>";
  }
  function contractCard(m) {
    return '<div class="card contract"><div class="c-top"><div><div class="eyebrow">Contract total</div><div class="c-big">' + money(m.total) + "</div>" +
      (m.changes || m.cos.length ? '<div class="muted small">Original ' + money(m.original) + " · approved change orders " + (m.changes >= 0 ? "+" : "−") + money(Math.abs(m.changes)) + "</div>" : "") +
      (m.proposed ? '<div class="muted small">Proposed change orders, not in the total yet: ' + (m.proposed >= 0 ? "+" : "−") + money(Math.abs(m.proposed)) + "</div>" : "") + "</div>" +
      '<div class="c-side"><div class="eyebrow">Paid so far</div><div class="c-mid">' + pctOf(m.paid, m.total) + '%</div><div class="muted small">' + money(m.paid) + " of " + money(m.total) + "</div></div></div>" +
      contractBar(m) + "</div>";
  }
  function lineRow(l, m) {
    var billed = m.byLine[l.id] || 0, counts = l.kind === "base" || l.status === "approved", p = pctOf(billed, l.amount);
    return "<tr" + (counts ? "" : ' class="muted-row"') + "><td><b style='font-weight:500'>" + (l.number ? esc(l.number) + " · " : "") + esc(l.title) + "</b>" +
      (l.kind === "change" ? ' <span class="pill ' + ({ approved: "ok", proposed: "gold", rejected: "bad" }[l.status] || "") + '">' + esc(l.status === "proposed" ? "Proposed, not in total" : l.status === "approved" ? "Approved" : "Rejected") + "</span>" + (l.date ? "<div class='muted small'>" + day(l.date) + "</div>" : "") : "") + "</td>" +
      '<td class="num">' + (l.amount < 0 ? "−" + money(-l.amount) : money(l.amount)) + '</td><td class="num">' + money(billed) + '</td><td class="pc"><div class="mini"><i style="width:' + Math.min(100, Math.max(0, p)) + '%"></i></div><span>' + p + '%</span></td><td class="num">' + money(l.amount - billed) + "</td>" +
      (staff() ? '<td><button class="icon-btn" data-a="modal" data-m="cline" data-id="' + esc(l.id) + '" aria-label="Edit">✎</button></td>' : "") + "</tr>";
  }
  function tabInvoices() {
    var m = contractMath(), list = visibleInvoices().slice().sort(function (a, b) { return (b.issued || "9") < (a.issued || "9") ? -1 : (b.issued || "9") > (a.issued || "9") ? 1 : 0; });
    var showRet = m.pct > 0 || m.inv.some(function (i) { return i.retainage; });
    var pill = function (s) { return '<span class="pill ' + ({ paid: "ok", overdue: "bad", sent: "gold" }[s] || "") + '">' + esc({ sent: "Due", paid: "Paid", overdue: "Overdue", draft: "Draft", void: "Void" }[s] || s) + "</span>"; };
    var head = m.has ? contractCard(m) : (staff() ? '<div class="empty">Add the contract lines (the schedule of values) and the client and architect will see the contract total and how each invoice draws it down.<div style="margin-top:14px"><button class="btn sm" data-a="modal" data-m="cline" data-kind="base">Add the first contract line</button></div></div>'
      : '<div class="grid g3">' + stat("Billed", money(m.billed), m.inv.length + " invoice" + (m.inv.length === 1 ? "" : "s")) + stat("Paid", money(m.paid), "") + stat("Balance due", money(m.waiting), "") + "</div>");
    var breakdown = !m.has ? "" : '<div class="section-title"><div><h2>Where the contract goes</h2><span class="muted small">Each line of the contract, what has been billed against it and what is left.</span></div>' +
      (staff() ? '<div class="actions"><button class="btn ghost sm" data-a="modal" data-m="cline" data-kind="base">Add line</button><button class="btn ghost sm" data-a="modal" data-m="cline" data-kind="change">Add change order</button></div>' : "") + "</div>" +
      '<div class="card tbl" data-lenis-prevent><table class="t sov"><thead><tr><th>Contract line</th><th class="num">Value</th><th class="num">Billed to date</th><th>Billed</th><th class="num">Left to bill</th>' + (staff() ? "<th></th>" : "") + "</tr></thead><tbody>" +
      m.base.map(function (l) { return lineRow(l, m); }).join("") +
      (m.cos.length ? '<tr class="grp"><td colspan="' + (staff() ? 6 : 5) + '">Change orders</td></tr>' + m.cos.map(function (l) { return lineRow(l, m); }).join("") : "") +
      (Math.abs(m.unsplit) > 0.004 ? '<tr class="muted-row"><td>Billed without a line split</td><td class="num">—</td><td class="num">' + money(m.unsplit) + '</td><td></td><td class="num">—</td>' + (staff() ? "<td></td>" : "") + "</tr>" : "") +
      '</tbody><tfoot><tr><td>Contract total</td><td class="num">' + money(m.total) + '</td><td class="num">' + money(m.billed) + '</td><td class="pc"><div class="mini"><i style="width:' + Math.min(100, pctOf(m.billed, m.total)) + '%"></i></div><span>' + pctOf(m.billed, m.total) + '%</span></td><td class="num">' + money(m.left) + "</td>" + (staff() ? "<td></td>" : "") + "</tr></tfoot></table></div>";
    var table = list.length ? '<div class="card tbl" data-lenis-prevent><table class="t inv"><thead><tr><th>Invoice</th><th>Issued</th><th class="num">Work billed</th>' + (showRet ? '<th class="num">Retainage</th>' : "") + '<th class="num">Amount due</th>' + (m.has ? '<th class="num">Contract left after</th>' : "") + "<th>Status</th><th></th></tr></thead><tbody>" +
      list.map(function (i) {
        var counted = m.after[i.id] != null;
        return '<tr id="inv-' + esc(i.id) + '"' + (counted ? "" : ' class="muted-row"') + "><td><b style='font-weight:500'>" + esc(i.number) + "</b><div class='muted small'>" + esc(i.title) + "</div></td><td>" + day(i.issued) + (i.due ? "<div class='muted small'>Due " + day(i.due) + "</div>" : "") + "</td>" +
          '<td class="num">' + money(i.amount) + "</td>" + (showRet ? '<td class="num">' + (i.retainage ? (i.retainage > 0 ? "−" : "+") + money(Math.abs(i.retainage)) + (i.retainage < 0 ? "<div class='muted small'>released</div>" : "") : "—") + "</td>" : "") +
          '<td class="num"><b style="font-weight:500">' + money(i.amount - (i.retainage || 0)) + "</b></td>" + (m.has ? '<td class="num">' + (counted ? money(m.after[i.id]) : "—") + "</td>" : "") + "<td>" + pill(i.status) + "</td>" +
          '<td><div class="row-actions">' + (i.pdf ? '<a class="btn ghost sm" href="' + esc(i.pdf) + '" target="_blank" rel="noopener noreferrer">PDF</a>' : "") +
          (i.pay_url && i.status !== "paid" && !staff() ? '<a class="btn sm" href="' + esc(i.pay_url) + '" target="_blank" rel="noopener noreferrer">Pay</a>' : "") +
          (staff() ? '<button class="btn ghost sm" data-a="modal" data-m="invoice" data-id="' + esc(i.id) + '">Edit</button>' : "") + "</div></td></tr>";
      }).join("") + "</tbody></table></div>" + (m.has ? '<p class="muted small" style="margin-top:8px">“Work billed” counts against the contract. ' + (showRet ? "Retainage is held back from each payment and paid at completion, so “Amount due” is what gets paid now. " : "") + "Drafts and void invoices don't count.</p>" : "")
      : '<div class="empty">No invoices yet.</div>';
    return head + breakdown + '<div class="section-title"><h2>Invoices</h2>' + (staff() ? '<button class="btn sm" data-a="modal" data-m="invoice">New invoice</button>' : "") + "</div>" + table;
  }

  function checkRow(c) {
    var done = isDone(c.done), can = staff() || (c.owner === "client" && asClient());
    return '<div class="ck ' + (done ? "done" : "") + '" id="ck-' + esc(c.id) + '"><button class="box" data-a="toggle" data-id="' + esc(c.id) + '"' + (can ? "" : " disabled") + ' aria-label="' + (done ? "Mark not done" : "Mark done") + '">' + (done ? "✓" : "") + "</button>" +
      '<div><span class="txt">' + esc(c.item) + "</span>" + (done && c.done_by ? "<small>Done by " + esc(c.done_by) + " · " + day(c.done_at) + "</small>" : c.due ? "<small>Due " + day(c.due) + "</small>" : "") + "</div>" +
      '<span class="pill ' + (c.owner === "client" ? "gold" : "") + '">' + (c.owner === "client" ? (!asClient() ? "Client" : "You") : "Blue Sierra") + "</span>" +
      (staff() ? '<span style="display:flex;gap:6px"><button class="icon-btn" data-a="modal" data-m="check" data-id="' + esc(c.id) + '" aria-label="Edit">✎</button><button class="icon-btn" data-a="delCheck" data-id="' + esc(c.id) + '" aria-label="Delete">×</button></span>' : "<span></span>") + "</div>";
  }
  function tabChecklist() {
    var list = S.data.checklist, groups = PHASES.map(function (ph) { return [ph, list.filter(function (c) { return c.phase === ph; })]; }).filter(function (g) { return g[1].length; });
    var done = list.filter(function (c) { return isDone(c.done); }).length;
    return '<div class="section-title" style="margin-top:0"><div><h2>Checklist</h2><span class="muted small">' + done + " of " + list.length + " done" + (!asClient() ? "" : " · you can check off the items marked “You”") + "</span></div>" +
      (staff() ? '<button class="btn sm" data-a="modal" data-m="check">Add item</button>' : "") + "</div>" +
      (groups.length ? groups.map(function (g) { return '<div class="phase-group"><h3>' + esc(g[0]) + (g[0] === S.data.project.phase ? ' <span class="pill dark">Current phase</span>' : "") + "</h3>" + g[1].map(checkRow).join("") + "</div>"; }).join("") : '<div class="empty">No checklist items yet.</div>');
  }

  function tabPeople() {
    var ppl = S.data.people || [];
    return '<div class="section-title" style="margin-top:0"><h2>People on this project</h2></div><div class="card" style="display:flex;flex-direction:column;gap:12px">' +
      ppl.map(function (x) { return '<div style="display:flex;align-items:center;gap:12px"><div class="avatar ' + (x.role === "client" ? "gold" : "") + '">' + esc(initials(x.name)) + '</div><div style="flex:1"><b style="font-weight:500">' + esc(x.name) + '</b><div class="muted small">' + esc(x.email) + "</div></div>" +
        '<span class="pill">' + esc({ client: "Client", architect: "Architect", admin: "Admin" }[x.role] || "Team") + "</span>" + (x.role === "client" || x.role === "architect" ? '<button class="icon-btn" data-a="removePerson" data-email="' + esc(x.email) + '" aria-label="Remove access">×</button>' : "") + "</div>"; }).join("") + "</div>" +
      '<form class="card form" data-form="person" style="margin-top:16px"><h3>Give someone access</h3><div class="row2"><label class="f">Name<input type="text" name="name" required></label><label class="f">Email<input type="email" name="email" required></label></div>' +
      '<label class="f">Role<select name="role"><option value="client">Client: sees this project only</option><option value="architect">Architect: sees this project only, like the client</option>' + (S.me.admin ? '<option value="staff">Blue Sierra team: sees all projects</option>' : "") + "</select></label>" +
      '<label class="check-line"><input type="checkbox" name="invite" checked> Email them an invitation</label><div class="actions"><button class="btn" type="submit">Add</button></div></form>';
  }


  /* ---------------- schedule: Gantt, calendar, list ---------------- */
  var KINDS = [["task", "Task"], ["inspection", "Inspection"], ["payment", "Payment due"], ["decision", "Decision"], ["meeting", "Meeting"], ["milestone", "Milestone"], ["deadline", "Deadline"]];
  function kindLabel(k) { for (var i = 0; i < KINDS.length; i++) if (KINDS[i][0] === k) return KINDS[i][1]; return k; }
  function ymd(d) { return d.getUTCFullYear() + "-" + String(d.getUTCMonth() + 1).padStart(2, "0") + "-" + String(d.getUTCDate()).padStart(2, "0"); }
  function parseD(s) { var m = String(s || "").match(/^(\d{4})-(\d{2})-(\d{2})/); return m ? Date.UTC(+m[1], +m[2] - 1, +m[3]) : NaN; }
  function addDays(s, n) { return ymd(new Date(parseD(s) + n * 864e5)); }
  /* Everything with a date: the schedule itself plus invoice due dates and checklist due dates (read-only here). */
  function scheduleItems() {
    var d = S.data, out = (d.schedule || []).map(function (x) { return Object.assign({}, x); });
    visibleInvoices().forEach(function (i) {
      if (i.due && i.status !== "paid" && i.status !== "void" && i.status !== "draft") out.push({ id: "inv-" + i.id, kind: "payment", title: "Invoice " + i.number + " due · " + money(i.amount), start: i.due, end: "", derived: "Invoices" });
    });
    d.checklist.forEach(function (c) {
      if (c.due && !isDone(c.done)) out.push({ id: "ck-" + c.id, kind: "deadline", title: c.item, start: c.due, end: "", derived: "Checklist", owner: c.owner });
    });
    return out.filter(function (x) { return !isNaN(parseD(x.start)); }).sort(function (a, b) { var ea = a.end || a.start, eb = b.end || b.start; return a.start < b.start ? -1 : a.start > b.start ? 1 : ea < eb ? -1 : ea > eb ? 1 : 0; });
  }
  function upcoming(days) {
    var t = today(), lim = addDays(t, days);
    return scheduleItems().filter(function (x) { var e = x.end || x.start; return e >= t && x.start <= lim && x.status !== "done"; });
  }
  function groupByDay(list) { var m = {}, out = []; list.forEach(function (x) { if (!m[x.start]) out.push(m[x.start] = []); m[x.start].push(x); }); return out; }
  function chip(x, label) {
    label = label || x.title;
    return '<button class="sch-chip k-' + esc(x.kind) + (x.status === "done" ? " done" : "") + (/^(no production|holiday|no work)/i.test(x.title) ? " off" : "") + '" data-a="schedView" data-id="' + esc(x.id) + '" title="' + esc(kindLabel(x.kind) + ": " + label) + '"><i></i><span>' + esc(label) + "</span></button>";
  }
  function itemRow(x) {
    var when = day(x.start) + (x.end && x.end !== x.start ? " → " + day(x.end) : "");
    return '<button class="sch-row" data-a="schedView" data-id="' + esc(x.id) + '"><span class="sch-dot k-' + esc(x.kind) + '"></span><span class="sch-when">' + when + "</span><span><b>" + esc(x.title) + '</b><span class="muted small">' + esc(kindLabel(x.kind)) + (x.owner === "client" ? (!asClient() ? " · client" : " · you") : "") + (x.derived ? " · from " + esc(x.derived) : "") + "</span></span>" +
      (x.status === "done" ? '<span class="pill ok">Done</span>' : x.status === "in progress" ? '<span class="pill gold">In progress</span>' : "<span></span>") + "</button>";
  }
  function tabSchedule() {
    var v = S.sched.view, items = scheduleItems(), tasks = (S.data.schedule || []).filter(function (x) { return x.kind === "task"; });
    var head = '<div class="section-title" style="margin-top:0"><div class="chips">' + [["gantt", "Timeline"], ["calendar", "Calendar"], ["list", "List"]].map(function (o) { return '<button class="chip' + (v === o[0] ? " on" : "") + '" data-a="schedMode" data-v="' + o[0] + '">' + o[1] + "</button>"; }).join("") + "</div>" +
      '<div class="actions">' + (items.length ? '<button class="btn ghost sm" data-a="ics">Add to my calendar</button>' : "") +
      (staff() && !tasks.length ? '<button class="btn ghost sm" data-a="stdPhases">Add the standard phases</button>' : "") +
      (staff() ? '<button class="btn sm" data-a="modal" data-m="sched">Add a date</button>' : "") + "</div></div>" +
      '<div class="sch-legend">' + KINDS.map(function (k) { return '<span><i class="sch-dot k-' + k[0] + '"></i>' + k[1] + "</span>"; }).join("") + "</div>";
    if (!items.length) return head + '<div class="empty">' + (staff() ? "No dates yet. Add the standard phases or a first date (inspection, payment, decision…)." : "Blue Sierra hasn't added dates yet.") + "</div>";
    return head + (v === "calendar" ? calendarView(items) : v === "list" ? listView(items) : ganttView(items));
  }
  function ganttView(items) {
    var p = S.data.project, bars = items.filter(function (x) { return x.kind === "task" && x.end; }), marks = items.filter(function (x) { return !(x.kind === "task" && x.end); });
    var all = items.map(function (x) { return x.start; }).concat(items.map(function (x) { return x.end; }).filter(Boolean), [p.start_date, p.target_date].filter(function (x) { return !isNaN(parseD(x)); }));
    var a = parseD(all.reduce(function (m, x) { return x < m ? x : m; })), z = parseD(all.reduce(function (m, x) { return x > m ? x : m; }));
    a = Date.UTC(new Date(a).getUTCFullYear(), new Date(a).getUTCMonth(), 1);                 // start on the 1st of the month
    var ze = new Date(z); z = Date.UTC(ze.getUTCFullYear(), ze.getUTCMonth() + 1, 1);           // end on the 1st of the next month
    var span = z - a, pos = function (s) { return Math.max(0, Math.min(100, (parseD(s) - a) / span * 100)); };
    var months = []; for (var m = new Date(a); m.getTime() < z; m = new Date(Date.UTC(m.getUTCFullYear(), m.getUTCMonth() + 1, 1))) months.push(m);
    var grid = months.map(function (m) { var next = Date.UTC(m.getUTCFullYear(), m.getUTCMonth() + 1, 1); return '<span style="left:' + ((m.getTime() - a) / span * 100) + "%;width:" + ((next - m.getTime()) / span * 100) + '%">' + m.toLocaleDateString("en-US", { month: "short", timeZone: "UTC" }) + (m.getUTCMonth() === 0 || m.getTime() === a ? " " + m.getUTCFullYear() : "") + "</span>"; }).join("");
    var t = today(), todayLine = parseD(t) >= a && parseD(t) <= z ? '<i class="g-today" style="left:' + pos(t) + '%" title="Today"></i>' : "";
    var rows = bars.map(function (x) {
      var l = pos(x.start), w = Math.max(0.8, pos(addDays(x.end, 1)) - l);
      var off = /^(no production|holiday|no work)/i.test(x.title);   // breaks show as hatched gray, not work
      return '<div class="g-label"><b title="' + esc(x.title) + '">' + esc(x.title) + '</b><span class="muted small">' + day(x.start) + " → " + day(x.end) + "</span></div>" +
        '<div class="g-track">' + todayLine + '<button class="g-bar k-' + esc(x.kind) + (x.status === "done" ? " done" : "") + (off ? " off" : "") + '" style="left:' + l + "%;width:" + w + '%" data-a="schedView" data-id="' + esc(x.id) + '" title="' + esc(x.title + ": " + day(x.start) + " → " + day(x.end)) + '">' + (x.status === "done" ? "✓" : "") + "</button></div>";
    }).join("");
    var keyRow = KINDS.map(function (k) {
      var ks = marks.filter(function (x) { return x.kind === k[0]; }); if (!ks.length) return "";
      return '<div class="g-label"><b><span class="sch-dot k-' + k[0] + '"></span> ' + k[1] + (ks.length > 1 && k[0] !== "payment" ? "s" : "") + '</b><span class="muted small">' + ks.length + " date" + (ks.length > 1 ? "s" : "") + "</span></div>" +
      '<div class="g-track g-marks">' + todayLine + groupByDay(ks).map(function (g) {
        var x = g[0], many = g.length > 1, names = g.map(function (y) { return y.title; }).join(" · ");
        return '<button class="g-mark k-' + esc(x.kind) + (x.kind === "milestone" ? " diamond" : "") + (many ? " many" : "") + '" style="left:' + pos(x.start) + '%" ' +
          (many ? 'data-a="schedDay" data-kind="' + esc(x.kind) + '" data-day="' + esc(x.start) + '"' : 'data-a="schedView" data-id="' + esc(x.id) + '"') +
          ' title="' + esc(kindLabel(x.kind) + " · " + day(x.start) + ": " + names) + '" aria-label="' + esc(kindLabel(x.kind) + " " + day(x.start) + ": " + names) + '">' + (many ? "<span>" + g.length + "</span>" : "") + "</button>";
      }).join("") + "</div>";
    }).join("");
    return '<div class="card gantt-wrap" data-lenis-prevent><div class="gantt"><div class="g-label g-head"></div><div class="g-track g-head">' + grid + "</div>" + rows + keyRow + "</div></div>" +
      '<p class="muted small" style="margin-top:8px">Tap a bar or a marker for details. The red line is today.</p>' +
      '<div class="section-title"><h2>Coming up</h2></div>' + (upcoming(30).length ? '<div class="sch-list">' + upcoming(30).map(itemRow).join("") + "</div>" : '<div class="empty">Nothing in the next 30 days.</div>');
  }
  function calendarView(items) {
    var ym = S.sched.month || today().slice(0, 7), y = +ym.slice(0, 4), mo = +ym.slice(5, 7) - 1;
    var first = new Date(Date.UTC(y, mo, 1)), startDow = (first.getUTCDay() + 6) % 7, daysIn = new Date(Date.UTC(y, mo + 1, 0)).getUTCDate();
    // Key dates first; a multi-day task shows only on the day it starts and the day it ends.
    var byDay = {}, put = function (d, x, label) { if (d.slice(0, 7) === ym) (byDay[d] = byDay[d] || []).push({ x: x, label: label }); };
    items.filter(function (x) { return x.kind !== "task"; }).forEach(function (x) { put(x.start, x, x.title); });
    items.filter(function (x) { return x.kind === "task"; }).forEach(function (x) {
      if (x.end && x.end !== x.start) { put(x.start, x, x.title + " starts"); put(x.end, x, x.title + " ends"); } else put(x.start, x, x.title);
    });
    var cells = ""; for (var i = 0; i < startDow; i++) cells += '<div class="cal-cell empty"></div>';
    for (var dn = 1; dn <= daysIn; dn++) {
      var key = ym + "-" + String(dn).padStart(2, "0"), list = byDay[key] || [];
      cells += '<div class="cal-cell' + (key === today() ? " today" : "") + '"><span class="cal-num">' + dn + "</span>" + list.slice(0, 3).map(function (c) { return chip(c.x, c.label); }).join("") + (list.length > 3 ? '<button class="link small" data-a="schedDay" data-day="' + key + '">+' + (list.length - 3) + " more</button>" : "") + "</div>";
    }
    var label = first.toLocaleDateString("en-US", { month: "long", year: "numeric", timeZone: "UTC" });
    return '<div class="card cal" data-lenis-prevent><div class="cal-head"><button class="icon-btn" data-a="calMove" data-n="-1" aria-label="Previous month">‹</button><b>' + label + '</b><button class="icon-btn" data-a="calMove" data-n="1" aria-label="Next month">›</button><button class="link small" data-a="calMove" data-n="0">Today</button></div>' +
      '<div class="cal-grid">' + ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map(function (d) { return '<div class="cal-dow">' + d + "</div>"; }).join("") + cells + "</div></div>" +
      '<div class="section-title"><h2>In ' + first.toLocaleDateString("en-US", { month: "long", timeZone: "UTC" }) + "</h2></div>" +
      (function () { var inMonth = items.filter(function (x) { return x.start.slice(0, 7) === ym || (x.end && x.kind === "task" && x.end.slice(0, 7) === ym); });
        return inMonth.length ? '<div class="sch-list">' + inMonth.map(itemRow).join("") + "</div>" : '<div class="empty">No dates this month.</div>'; })();
  }
  function listView(items) {
    var t = today(), next = items.filter(function (x) { return (x.end || x.start) >= t; }), past = items.filter(function (x) { return (x.end || x.start) < t; });
    return (next.length ? '<div class="sch-list">' + next.map(itemRow).join("") + "</div>" : '<div class="empty">Nothing coming up.</div>') +
      (past.length ? '<details class="sch-past"><summary>Past dates (' + past.length + ")</summary>" + '<div class="sch-list">' + past.slice().reverse().map(itemRow).join("") + "</div></details>" : "");
  }
  function icsFile() {
    var p = S.data.project, esc2 = function (t) { return String(t || "").replace(/[\;,]/g, function (c) { return "\\" + c; }).replace(/\n/g, "\\n"); };
    var stamp = new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d+Z$/, "Z");
    var lines = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Blue Sierra Construction//Client portal//EN", "CALSCALE:GREGORIAN", "X-WR-CALNAME:" + esc2(p.name + " · Blue Sierra")];
    scheduleItems().forEach(function (x) {
      var end = addDays(x.end && x.kind === "task" ? x.end : x.start, 1);
      lines.push("BEGIN:VEVENT", "UID:" + x.id + "@portal.bluesierracorp.com", "DTSTAMP:" + stamp, "DTSTART;VALUE=DATE:" + x.start.replace(/-/g, ""), "DTEND;VALUE=DATE:" + end.replace(/-/g, ""),
        "SUMMARY:" + esc2((x.kind === "task" || x.derived ? "" : kindLabel(x.kind) + ": ") + x.title + " · " + p.name), "DESCRIPTION:" + esc2("Blue Sierra client portal: https://www.bluesierracorp.com/portal"), "END:VEVENT");
    });
    lines.push("END:VCALENDAR");
    return lines.join("\r\n");
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
        '<label class="f">Retainage % held from each invoice (0 if none)<input type="number" name="retainage_pct" min="0" max="20" step="0.5" value="' + esc(p.retainage_pct || 0) + '"></label>' +
        (m.id ? '<label class="f">Status<select name="status"><option value="active"' + (p.status !== "archived" ? " selected" : "") + '>Active</option><option value="archived"' + (p.status === "archived" ? " selected" : "") + ">Archived (hidden from the client)</option></select></label>" : "") +
        '<div class="actions"><button type="button" class="btn ghost" data-a="close">Cancel</button><button class="btn" type="submit">Save</button></div></form>';
    }
    if (m.type === "invoice") {
      var i = m.id ? d.invoices.filter(function (x) { return x.id === m.id; })[0] || {} : { issued: today(), status: "sent" };
      var st = i.status === "overdue" ? "sent" : i.status, cm2 = contractMath(), billable = cm2.base.concat(cm2.cos.filter(function (l) { return l.status === "approved" || (i.lines && i.lines[l.id]); }));
      var heldElsewhere = cm2.held - (cm2.after[i.id] != null ? (i.retainage || 0) : 0);
      var auto = !m.id;                      // a new invoice suggests retainage from the project's percentage
      body = "<h2>" + (m.id ? "Edit invoice" : "New invoice") + '</h2><form class="form" data-form="invoice" data-pct="' + cm2.pct + '" data-auto="' + (auto ? 1 : 0) + '">' +
        '<div class="row2"><label class="f">Invoice number<input type="text" name="number" required value="' + esc(i.number) + '"></label><label class="f">Description<input type="text" name="title" value="' + esc(i.title) + '" placeholder="e.g. Pay application 2"></label></div>' +
        (billable.length ? '<fieldset class="lines"><legend>Work billed this period, by contract line</legend>' + billable.map(function (l) {
          var left = l.amount - (cm2.byLine[l.id] || 0) + (cm2.after[i.id] != null && i.lines ? Number(i.lines[l.id] || 0) : 0);
          return '<label class="lrow"><span>' + (l.number ? esc(l.number) + " · " : "") + esc(l.title) + '<small>Left to bill ' + money(left) + " of " + money(l.amount) + '</small></span><input type="number" step="0.01" name="line:' + esc(l.id) + '" value="' + esc(i.lines && i.lines[l.id] ? i.lines[l.id] : "") + '" placeholder="0.00"></label>';
        }).join("") + "</fieldset>" : "") +
        '<div class="row2"><label class="f">Work billed (USD)' + (billable.length ? " · or fill in the lines above" : "") + '<input type="number" name="amount" step="0.01" required value="' + esc(i.amount == null ? "" : i.amount) + '"' + (i.lines && Object.keys(i.lines).length ? " readonly" : "") + "></label>" +
        '<label class="f">Retainage held (USD)' + (cm2.pct ? " · " + cm2.pct + "%" : "") + '<input type="number" name="retainage" step="0.01" value="' + esc(i.retainage || "") + '" placeholder="0.00"></label></div>' +
        '<p class="inv-due">Amount due: <b data-due>' + money((i.amount || 0) - (i.retainage || 0)) + "</b>" + (heldElsewhere > 0 ? ' · <button type="button" class="link" data-a="releaseRet" data-held="' + heldElsewhere + '">Release the ' + money(heldElsewhere) + " retainage held</button>" : "") + "</p>" +
        '<div class="row2"><label class="f">Issued<input type="date" name="issued" value="' + esc(i.issued) + '"></label><label class="f">Due<input type="date" name="due" value="' + esc(i.due) + '"></label></div>' +
        '<div class="row2"><label class="f">Status<select name="status">' + [["draft", "Draft (client can't see it)"], ["sent", "Sent / due"], ["paid", "Paid"], ["void", "Void"]].map(function (o) { return '<option value="' + o[0] + '"' + (o[0] === st ? " selected" : "") + ">" + o[1] + "</option>"; }).join("") + "</select></label>" +
        '<label class="f">Paid on<input type="date" name="paid_date" value="' + esc(i.paid_date) + '"></label></div>' +
        '<label class="f">Payment link (optional, https)<input type="url" name="pay_url" value="' + esc(i.pay_url) + '" placeholder="Stripe or QuickBooks payment link"></label>' +
        '<label class="f">PDF' + (i.pdf ? ' (one is attached; choose a file to replace it)' : "") + '<input type="file" name="pdf" accept="application/pdf"></label>' +
        '<label class="f">Notes (team only)<textarea name="notes">' + esc(i.notes) + "</textarea></label>" +
        '<label class="check-line"><input type="checkbox" name="notify"' + (m.id ? "" : " checked") + "> Email the client that it's ready</label>" +
        '<div class="actions"><button type="button" class="btn ghost" data-a="close">Cancel</button><button class="btn" type="submit">Save invoice</button></div></form>';
    }
    if (m.type === "cline") {
      var cl = m.id ? ((d.contract && d.contract.lines) || []).filter(function (x) { return x.id === m.id; })[0] || {} : { kind: m.kind || "base", status: "proposed", date: today() };
      var isCO = cl.kind === "change";
      body = "<h2>" + (m.id ? "Edit " : "Add ") + (isCO ? "change order" : "contract line") + '</h2><form class="form" data-form="cline" data-kind="' + (isCO ? "change" : "base") + '">' +
        '<div class="row2"><label class="f">' + (isCO ? "CO number" : "Number (optional)") + '<input type="text" name="number" maxlength="20" value="' + esc(cl.number) + '" placeholder="' + (isCO ? "CO-1" : "e.g. 2") + '"></label>' +
        '<label class="f">Amount (USD)' + (isCO ? " · negative for a credit" : "") + '<input type="number" name="amount" step="0.01" required value="' + esc(cl.amount == null ? "" : cl.amount) + '"></label></div>' +
        '<label class="f">Name<input type="text" name="title" required maxlength="200" value="' + esc(cl.title) + '" placeholder="' + (isCO ? "e.g. Add gas line to fire pit" : "e.g. Deck") + '"></label>' +
        (isCO ? '<div class="row2"><label class="f">Status<select name="status">' + [["proposed", "Proposed (not in the total yet)"], ["approved", "Approved (adds to the contract)"], ["rejected", "Rejected (hidden from the client)"]].map(function (o) { return '<option value="' + o[0] + '"' + (o[0] === cl.status ? " selected" : "") + ">" + o[1] + "</option>"; }).join("") + "</select></label>" +
          '<label class="f">Date<input type="date" name="date" value="' + esc(cl.date) + '"></label></div>' : "") +
        '<label class="f">Notes (team only)<textarea name="notes" maxlength="1000">' + esc(cl.notes) + "</textarea></label>" +
        '<div class="actions">' + (m.id ? '<button type="button" class="btn ghost" data-a="delLine" data-id="' + esc(m.id) + '" style="margin-right:auto">Delete</button>' : "") + '<button type="button" class="btn ghost" data-a="close">Cancel</button><button class="btn" type="submit">Save</button></div></form>';
    }
    if (m.type === "sched") {
      var x = m.id ? (d.schedule || []).filter(function (y) { return y.id === m.id; })[0] || {} : { kind: "inspection", start: today(), owner: "blue sierra", status: "planned" };
      body = "<h2>" + (m.id ? "Edit date" : "Add a date") + '</h2><form class="form" data-form="sched">' +
        '<div class="row2"><label class="f">Type<select name="kind" data-sched-kind>' + KINDS.map(function (k) { return '<option value="' + k[0] + '"' + (k[0] === x.kind ? " selected" : "") + ">" + k[1] + "</option>"; }).join("") + '</select></label>' +
        '<label class="f">Status<select name="status">' + ["planned", "in progress", "done"].map(function (o) { return '<option value="' + o + '"' + (o === x.status ? " selected" : "") + ">" + o.charAt(0).toUpperCase() + o.slice(1) + "</option>"; }).join("") + "</select></label></div>" +
        '<label class="f">Name<input type="text" name="title" required maxlength="200" value="' + esc(x.title) + '" placeholder="e.g. Footing inspection, Choose pool coping, Progress payment 2"></label>' +
        '<div class="row2"><label class="f">Date' + '<input type="date" name="start" required value="' + esc(x.start) + '"></label><label class="f sched-end">End date (tasks only)<input type="date" name="end" value="' + esc(x.end) + '"></label></div>' +
        '<div class="row2"><label class="f">Phase<select name="phase"><option value="">—</option>' + PHASES.map(function (ph) { return "<option" + (ph === x.phase ? " selected" : "") + ">" + ph + "</option>"; }).join("") + '</select></label>' +
        '<label class="f">Who<select name="owner"><option value="blue sierra"' + (x.owner !== "client" ? " selected" : "") + '>Blue Sierra</option><option value="client"' + (x.owner === "client" ? " selected" : "") + ">Client</option></select></label></div>" +
        '<label class="f">Notes (team only)<textarea name="notes" maxlength="1000">' + esc(x.notes) + "</textarea></label>" +
        '<div class="actions">' + (m.id ? '<button type="button" class="btn ghost" data-a="delSched" data-id="' + esc(m.id) + '" style="margin-right:auto">Delete</button>' : "") + '<button type="button" class="btn ghost" data-a="close">Cancel</button><button class="btn" type="submit">Save</button></div></form>';
    }
    if (m.type === "thread") {
      var rootM = d.messages.filter(function (x) { return x.id === m.id; })[0];
      if (!rootM) body = '<p>That conversation was deleted.</p><div class="actions"><button class="btn" data-a="close">Close</button></div>';
      else {
        var reps = d.messages.filter(function (x) { return x.thread_id === rootM.id; });
        body = '<div class="eyebrow"># ' + esc(CH_INFO[rootM.channel || "client"][0]) + " · thread</div>" + '<div class="thread chat in-thread" style="margin-top:12px">' + msgHtml(rootM, { inThread: true }) +
          (reps.length ? '<div class="day-sep"><span>' + reps.length + " repl" + (reps.length > 1 ? "ies" : "y") + "</span></div>" : "") + reps.map(function (r) { return msgHtml(r, { inThread: true }); }).join("") + "</div>" +
          composer(rootM.channel || "client", rootM.id) + '<div class="actions" style="margin-top:10px"><button class="btn ghost" data-a="close">Close</button></div>';
      }
    }
    if (m.type === "schedDay") {
      var same = scheduleItems().filter(function (y) { return m.kind ? y.kind === m.kind && y.start === m.day : y.start === m.day || (y.kind === "task" && y.end === m.day); });
      body = '<div class="eyebrow">' + (m.kind ? '<span class="sch-dot k-' + esc(m.kind) + '"></span> ' + esc(kindLabel(m.kind)) : "All dates") + "</div><h2 style=\"margin-top:6px\">" + day(m.day) + "</h2>" +
        '<div class="sch-list" style="margin-top:14px">' + same.map(itemRow).join("") + '</div><div class="actions" style="margin-top:18px"><button class="btn" data-a="close">Close</button></div>';
    }
    if (m.type === "schedView") {
      var v = scheduleItems().filter(function (y) { return y.id === m.id; })[0];
      body = v ? '<div class="eyebrow"><span class="sch-dot k-' + esc(v.kind) + '"></span> ' + esc(kindLabel(v.kind)) + (v.derived ? " · from " + esc(v.derived) : "") + "</div><h2 style=\"margin-top:6px\">" + esc(v.title) + "</h2>" +
        '<p class="muted">' + day(v.start) + (v.end && v.end !== v.start ? " → " + day(v.end) : "") + (v.phase ? " · " + esc(v.phase) : "") + (v.status ? " · " + esc(v.status) : "") + "</p>" +
        (v.owner === "client" ? '<p style="margin-top:10px">' + (!asClient() ? "The client handles this one." : "This one is yours.") + "</p>" : "") +
        '<div class="actions" style="margin-top:18px">' + (v.derived ? '<button class="btn ghost" data-a="tab" data-t="' + (v.derived === "Invoices" ? "invoices" : "checklist") + '">Open ' + esc(v.derived) + "</button>" : "") + '<button class="btn" data-a="close">Close</button></div>' : "<p>Not found.</p>";
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
      case "home": refreshList(); return go(null);
      case "open": return go(b.dataset.id);
      case "tab": S.pending = []; S.lb = null; return go(S.pid, b.dataset.t);
      case "modal": S.modal = { type: b.dataset.m, id: b.dataset.id || null, kind: b.dataset.kind || "" }; return keepScroll(render);
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
      case "schedMode": S.sched.view = b.dataset.v; return keepScroll(render);
      case "calMove":
        var n = +b.dataset.n, cur = S.sched.month || today().slice(0, 7);
        if (!n) S.sched.month = today().slice(0, 7);
        else { var dd = new Date(Date.UTC(+cur.slice(0, 4), +cur.slice(5, 7) - 1 + n, 1)); S.sched.month = dd.getUTCFullYear() + "-" + String(dd.getUTCMonth() + 1).padStart(2, "0"); }
        return keepScroll(render);
      case "delLine": if (confirm("Delete this line?")) run(b, async function () { await call("deleteContractLine", { lineId: b.dataset.id }); S.modal = null; await refresh(); toast("Deleted"); }); return;
      case "releaseRet":
        var rf = b.closest("form"); rf.querySelectorAll("[name^='line:']").forEach(function (x) { x.value = ""; });
        rf.amount.value = 0; rf.retainage.value = -Number(b.dataset.held); rf.dataset.auto = 0; if (!rf.title.value) rf.title.value = "Retainage release"; invoiceMath(rf); return;
      case "chan": S.chan = b.dataset.c; S.picker = null; S.readMark = {}; render(); window.scrollTo(0, document.body.scrollHeight); markChannelRead(); return;
      case "thread": S.picker = null; S.modal = { type: "thread", id: b.dataset.id }; keepScroll(render); var tt = root.querySelector(".modal [data-chat]"); if (tt) tt.focus(); return;
      case "rxPick": S.picker = S.picker === b.dataset.id ? null : b.dataset.id; return keepScroll(render);
      case "react":
        S.picker = null;
        // Show it right away, then save; the next refresh brings everyone else's.
        var msg = S.data.messages.filter(function (x) { return x.id === b.dataset.id; })[0];
        if (msg) { var rx = (msg.reactions = msg.reactions || []), r0 = rx.filter(function (x) { return x.e === b.dataset.e; })[0];
          if (r0 && r0.mine) { r0.n--; r0.mine = false; r0.who = r0.who.filter(function (n) { return n !== S.me.name; }); if (!r0.n) rx.splice(rx.indexOf(r0), 1); }
          else if (r0) { r0.n++; r0.mine = true; r0.who.push(S.me.name); } else rx.push({ e: b.dataset.e, n: 1, mine: true, who: [S.me.name] }); }
        keepScroll(render);
        call("react", { messageId: b.dataset.id, emoji: b.dataset.e }).catch(function (e) { toast(e.message); refresh(); });
        return;
      case "delMsg": if (confirm("Delete this message" + (b.closest(".in-thread") ? "" : " and its replies") + "?")) run(b, async function () { await call("deleteMessage", { messageId: b.dataset.id }); if (S.modal && S.modal.id === b.dataset.id) S.modal = null; await refresh(); toast("Deleted"); }); return;
      case "unatt": S.att[b.dataset.k].splice(+b.dataset.i, 1); return keepScroll(render);
      case "homeView":
        S.home = b.dataset.v; if (b.dataset.v === "activity") S.activity = null; if (b.dataset.v === "team") S.team = null;
        refreshList(); if (S.pid) return go(null); return keepScroll(render);
      case "sideChan": S.chan = b.dataset.c; S.readMark = {}; if (S.tab !== "messages") return go(S.pid, "messages"); render(); window.scrollTo(0, document.body.scrollHeight); return;
      case "actOpen":
        S.wantChan = b.dataset.c; S.openThread = b.dataset.th || null;
        if (S.pid === b.dataset.p) { S.chan = b.dataset.c; S.readMark = {}; if (S.openThread) { S.modal = { type: "thread", id: S.openThread }; S.openThread = null; } S.wantChan = null; }
        return go(b.dataset.p, "messages");
      case "teamOff": if (confirm("Turn off this person's access? They won't be able to log in.")) run(b, async function () { await call("removePerson", { email: b.dataset.email }); S.team = null; render(); toast("Access turned off"); }); return;
      case "teamOn": run(b, async function () { await call("addPerson", { email: b.dataset.email, name: b.dataset.name, role: "staff" }); S.team = null; render(); toast("Access back on"); }); return;
      case "ref": return openRef(b.dataset.ref, b.dataset.p);
      case "bell": S.bell = !S.bell; if (S.bell) loadNotif(); return keepScroll(render);
      case "bellClose": S.bell = false; return keepScroll(render);
      case "markAll": markAllRead(); return;
      case "tour": S.bell = false; keepScroll(render); return startTour(true);
      case "schedDay": S.modal = { type: "schedDay", kind: b.dataset.kind || "", day: b.dataset.day }; return keepScroll(render);
      case "schedView":
        var it = (S.data.schedule || []).filter(function (y) { return y.id === b.dataset.id; })[0];
        S.modal = { type: staff() && it ? "sched" : "schedView", id: b.dataset.id }; return keepScroll(render);
      case "delSched": if (confirm("Delete this date?")) run(b, async function () { await call("deleteScheduleItem", { itemId: b.dataset.id }); S.modal = null; await refresh(); toast("Deleted"); }); return;
      case "stdPhases": run(b, async function () { await call("addStandardPhases", { projectId: S.pid }); await refresh(); toast("Phases added. Tap any of them to change its dates."); }); return;
      case "ics":
        var blob = new Blob([icsFile()], { type: "text/calendar" }), aIcs = document.createElement("a");
        aIcs.href = URL.createObjectURL(blob); aIcs.download = (S.data.project.name || "project").replace(/[^\w-]+/g, "-") + "-schedule.ics"; document.body.appendChild(aIcs); aIcs.click(); aIcs.remove(); return;
      case "delPhoto": if (confirm("Delete this photo?")) run(b, async function () { await call("deletePhoto", { photoId: b.dataset.id }); S.lb = null; await reload(); toast("Photo deleted"); }); return;
    }
  });

  root.addEventListener("mousedown", function (e) { S.downOnBg = !!(e.target.classList && e.target.classList.contains("modal-bg")); });
  /* Invoice form: the lines add up to the work billed, retainage follows the project's % until someone types it, and the amount due updates live. */
  function invoiceMath(f) {
    var lines = f.querySelectorAll("[name^='line:']"), pct = Number(f.dataset.pct || 0);
    var split = [].some.call(lines, function (x) { return x.value !== ""; });     // typing in any line makes the total automatic
    if (split) { var t = 0; lines.forEach(function (x) { t += Number(x.value) || 0; }); f.amount.value = Math.round(t * 100) / 100; }
    f.amount.readOnly = split;
    var amt = Number(f.amount.value) || 0;
    if (f.dataset.auto === "1" && pct) f.retainage.value = amt ? Math.round(amt * pct) / 100 : "";
    var out = f.querySelector("[data-due]"); if (out) out.textContent = money(amt - (Number(f.retainage.value) || 0));
  }
  root.addEventListener("input", function (e) {
    if (e.target.matches("[data-chat]")) return mentionPop(e.target);
    var f = e.target.form; if (!f || f.dataset.form !== "invoice") return;
    if (e.target.name === "retainage") f.dataset.auto = 0;
    invoiceMath(f);
  });
  root.addEventListener("change", function (e) {
    if (e.target.matches("[data-att]")) {
      var k = e.target.dataset.att, fl = [].slice.call(e.target.files || []); S.att = S.att || { main: [], thread: [] };
      var roomA = Math.max(0, 5 - S.att[k].length); if (fl.length > roomA) toast("Up to 5 files per message.");
      Promise.allSettled(fl.slice(0, roomA).map(readFile)).then(function (rs) {
        rs.forEach(function (r) { if (r.status === "fulfilled") S.att[k].push(r.value); else toast(r.reason.message); });
        keepScroll(render); var ta = root.querySelector((k === "thread" ? ".modal " : ".reply-bar ") + "[data-chat]"); if (ta) ta.focus();
      });
      return;
    }
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

  root.addEventListener("keydown", function (e) {
    if (!e.target.matches("[data-chat]")) return;
    var pop = e.target.parentNode.querySelector(".mention-pop");
    if (e.key === "Escape" && pop) { pop.remove(); e.stopPropagation(); return; }
    if (e.key === "Enter" && !e.shiftKey && !e.isComposing && !matchMedia("(pointer:coarse)").matches) {
      if (pop) { e.preventDefault(); pop.querySelector("button").dispatchEvent(new MouseEvent("mousedown")); return; }
      e.preventDefault(); e.target.form.requestSubmit();
    }
  });
  root.addEventListener("focusout", function (e) { if (e.target.matches && e.target.matches("[data-chat]")) setTimeout(function () { var pp = e.target.parentNode && e.target.parentNode.querySelector(".mention-pop"); if (pp) pp.remove(); }, 150); });
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
      if (kind === "team") {
        await call("addPerson", { name: v("name"), email: v("email"), role: "staff", invite: !!fd.get("invite") });
        f.reset(); S.team = null; render(); toast(fd.get("invite") ? "Added and invited" : "Added to the team"); return;
      }
      if (kind === "chat") {
        var q = !!fd.get("question"), ck = f.dataset.root ? "thread" : "main", att = (S.att && S.att[ck]) || [], ch = f.dataset.ch;
        if (!v("text") && !att.length) return;
        await call("sendMessage", { projectId: S.pid, channel: ch, threadId: f.dataset.root || undefined, text: v("text"), kind: q ? "question" : "message", files: att });
        f.reset(); if (S.att) S.att[ck] = [];
        S.readMark = S.readMark || {}; S.readMark[ch] = "9999";                // your own message clears the "New" line
        await refresh(); if (!f.dataset.root) window.scrollTo(0, document.body.scrollHeight);
        else { var mb = root.querySelector(".modal"); if (mb) mb.scrollTop = mb.scrollHeight; var t2 = root.querySelector(".modal [data-chat]"); if (t2) t2.focus(); }
        if (ch !== "team" && staff() && !f.dataset.root) toast(q ? "Question emailed" : ch === "architect" ? "Sent and emailed to the architect" : "Sent and emailed to the client and architect");
        return;
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
        ["name", "client_name", "address", "city", "phase", "progress", "start_date", "target_date", "summary", "status", "retainage_pct"].forEach(function (k) { if (fd.has(k)) proj[k] = v(k); });
        var r2 = await call("saveProject", { project: proj }); S.modal = null;
        if (!proj.id) { S.projects = null; return go(r2.project.id); }
        await refresh(true); toast("Project saved"); return;
      }
      if (kind === "cline") {
        await call("saveContractLine", { projectId: S.pid, line: { id: S.modal.id || undefined, kind: f.dataset.kind, number: v("number"), title: v("title"), amount: v("amount"), status: v("status"), date: v("date"), notes: v("notes") } });
        S.modal = null; await refresh(); toast("Contract updated"); return;
      }
      if (kind === "invoice") {
        var file = f.querySelector("[name=pdf]").files[0], pdf = file ? await readPdf(file) : null, lineVals = null;
        if (f.querySelector("[name^='line:']")) { lineVals = {}; f.querySelectorAll("[name^='line:']").forEach(function (x) { if (Number(x.value)) lineVals[x.name.slice(5)] = x.value; }); }
        await call("saveInvoice", { projectId: S.pid, notify: !!fd.get("notify"), invoice: { id: S.modal.id || undefined, number: v("number"), title: v("title"), amount: v("amount"), issued: v("issued"), due: v("due"), status: v("status"), paid_date: v("paid_date"), pay_url: v("pay_url"), pdf: pdf, notes: v("notes"), retainage: fd.has("retainage") ? v("retainage") || 0 : undefined, lines: lineVals || undefined } });
        S.modal = null; await refresh(true); toast("Invoice saved"); return;
      }
      if (kind === "sched") {
        await call("saveScheduleItem", { projectId: S.pid, item: { id: S.modal.id || undefined, kind: v("kind"), title: v("title"), start: v("start"), end: v("kind") === "task" ? v("end") : "", phase: v("phase"), owner: v("owner"), status: v("status"), notes: v("notes") } });
        S.modal = null; await refresh(); toast("Schedule updated"); return;
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
