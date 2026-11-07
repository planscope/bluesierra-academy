/* Blue Sierra client portal — front end for bluesierracorp.com/portal.
   Needs <div id="bs-portal"></div> and window.BSP_SETTINGS = { api: "<Apps Script /exec URL>", loginPhoto: "<image URL>" }.
   Talks only to apps-script/Portal.gs. In preview (portal-mock.js loaded, no api) it runs on fictional sample data. */
(function () {
  "use strict";
  var root = document.getElementById("bs-portal");
  var BASE = ((document.currentScript && document.currentScript.src) || "").replace(/[^\/]*(\?.*)?$/, "");   // where portal-app.js (and the avatars folder) live
  if (!root) return;
  // Google Drive refuses to serve photos to other sites' pages unless the request carries no referrer.
  if (!document.querySelector('meta[name="referrer"]')) { var mr = document.createElement("meta"); mr.name = "referrer"; mr.content = "no-referrer"; document.head.appendChild(mr); }
  var SET = window.BSP_SETTINGS || {};
  var API = SET.api && !/^PASTE_/.test(SET.api) ? SET.api : "";
  var LOGO = '<svg class="logo" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 265 33" fill="none" aria-label="Blue Sierra"><path d="M104.849 16.552V16.2315C107.476 14.7578 108.756 14.4372 108.756 9.43255C108.756 4.42785 105.045 1.22217 98.8988 1.22217H86.4151V32.7144H99.7298C106.005 32.7144 109.845 29.4418 109.845 24.2505C109.845 20.7864 108.116 18.1597 104.849 16.552ZM89.5528 4.04508V3.98289H98.8988C103.187 3.98289 105.618 6.16466 105.618 9.62872C105.618 13.0928 103.25 15.2746 98.8988 15.2746H89.5528V4.04508ZM99.7298 29.8293V29.7671H89.5528V18.1597H99.7298C104.209 18.1597 106.645 20.3414 106.645 23.9969C106.645 27.6523 104.147 29.8341 99.7298 29.8341V29.8293Z" fill="currentColor"></path><path d="M117.013 1.22717H114.004V32.7194H117.013V1.22717Z" fill="currentColor"></path><path d="M135.643 23.0957C135.643 27.3301 133.465 29.8277 129.884 29.8277C126.302 29.8277 124.248 27.3923 124.248 23.0957V9.62708H121.24V23.2249C121.24 29.1243 124.248 32.7176 129.115 32.7176C131.741 32.7176 134.11 31.6937 135.39 29.7655H135.648V32.1386H138.595V9.62708H135.648V23.0957H135.643Z" fill="currentColor"></path><path d="M151.776 8.98965C146.016 8.98965 141.728 13.9943 141.728 20.8555C141.728 27.7166 146.016 32.7213 152.034 32.7213C154.402 32.7213 156.389 32.018 158.113 30.6687C159.775 29.3864 160.864 27.7166 161.251 25.664H158.304C157.473 28.2285 156.193 29.9606 151.967 29.9606C147.74 29.9606 144.989 26.6879 144.669 21.621H161.571C161.633 20.9177 161.633 20.3387 161.633 19.9512L161.762 19.889C161.762 13.8604 157.535 8.98486 151.776 8.98486V8.98965ZM144.798 18.9273C145.376 14.4393 147.998 11.7456 151.776 11.7456C155.553 11.7456 158.304 14.6307 158.82 18.9273H144.798Z" fill="currentColor"></path><path d="M261.364 9.62581V13.0229H261.106C259.697 10.3291 259.439 9.04688 253.742 9.04688C248.045 9.04688 243.894 14.0994 243.885 20.8792C243.899 27.6638 247.992 32.7115 253.742 32.7115C256.813 32.7115 259.697 31.4293 261.106 28.7355H261.364V32.1326H264.311V9.62581H261.364ZM254.196 29.8886C249.907 29.8886 247.027 26.2954 247.027 20.9079C247.027 15.5204 249.907 11.9272 254.196 11.9272C258.484 11.9272 261.364 15.5204 261.364 20.9079C261.364 26.2954 258.484 29.8886 254.196 29.8886Z" fill="currentColor"></path><path d="M178.08 14.4352C172.321 13.5356 170.143 12.2534 170.143 8.59793C170.143 4.9425 172.574 2.9521 177.249 2.9521C181.925 2.9521 185.316 5.64583 185.316 9.62184H188.386C188.257 4.36356 183.778 0 177.374 0C170.969 0 167.001 3.59324 167.001 8.66013C167.001 13.727 169.88 16.1002 177.947 17.4447C183.324 18.3442 185.373 19.4303 185.373 23.5355C185.373 27.6407 183.582 29.7555 177.947 29.7555C172.311 29.7555 168.921 25.9086 168.921 21.6121H165.85L165.788 21.6743C165.85 27.5115 171.227 32.7076 177.822 32.7076C184.418 32.7076 188.577 28.7937 188.577 23.5355C188.577 18.2772 185.378 15.5165 178.08 14.4304V14.4352Z" fill="currentColor"></path><path d="M195.235 10.2019H192.226V32.7135H195.235V10.2019Z" fill="currentColor"></path><path d="M195.235 3.79077H192.226V6.35532H195.235V3.79077Z" fill="currentColor"></path><path d="M208.745 8.98965C202.986 8.98965 198.692 13.9943 198.692 20.8555C198.692 27.7166 202.981 32.7213 208.998 32.7213C211.367 32.7213 213.354 32.018 215.078 30.6687C216.744 29.3864 217.828 27.7166 218.215 25.664H215.269C214.438 28.2285 213.158 29.9606 208.931 29.9606C204.705 29.9606 201.954 26.6879 201.634 21.621H218.535C218.597 20.9177 218.597 20.3387 218.597 19.9512L218.726 19.889C218.726 13.8604 214.5 8.98486 208.74 8.98486L208.745 8.98965ZM201.768 18.9273C202.346 14.4393 204.967 11.7456 208.745 11.7456C212.523 11.7456 215.273 14.6307 215.784 18.9273H201.763H201.768Z" fill="currentColor"></path><path d="M225.518 12.8951H225.26V10.2014H222.251V32.7129H225.322V19.3065C225.322 15.5218 226.602 13.0195 229.677 13.0195H232.046V10.0674H230.766C227.886 10.0674 226.415 10.7707 225.518 12.8903V12.8951Z" fill="currentColor"></path><path d="M244.529 10.0772H243.249C240.37 10.0772 238.899 10.7805 238.001 12.9001H237.743V10.2064H234.734V32.7179H237.805V19.3115C237.805 15.5268 239.085 13.0245 242.161 13.0245H244.529V10.0724V10.0772Z" fill="currentColor"></path><path d="M70.1781 11.0273H71.0186V7.48188H72.3749V6.78333H68.8218V7.48188H70.1781V11.0273Z" fill="currentColor"></path><path d="M73.5883 8.52885C73.6026 8.1413 73.6217 7.73461 73.6217 7.34227H73.6695C73.765 7.71547 73.8892 8.21785 73.9656 8.54321L74.7297 10.9594H75.6037L76.3678 8.60541C76.492 8.21785 76.6161 7.71547 76.726 7.34227H76.7737C76.788 7.79202 76.788 8.19871 76.8024 8.52885L76.96 11.0264H77.8005L77.4758 6.78247H76.2627L75.532 8.87334C75.4413 9.18434 75.3458 9.54319 75.2359 9.93553H75.2216C75.1118 9.50013 75.0354 9.18913 74.9398 8.85899L74.2092 6.78726H72.9484L72.6379 11.0312H73.4498L73.6026 8.53364L73.5883 8.52885Z" fill="currentColor"></path><path d="M13.2566 21.4173C13.1553 21.5191 12.9864 21.5191 12.885 21.4173L0.448804 8.8226C0.284725 8.65286 0 8.77411 0 9.01174V32.4504C0 32.5959 0.11582 32.7171 0.260596 32.7171H25.8762C25.8762 32.7171 25.9052 32.7171 25.9196 32.7171V8.30854C25.8424 8.29399 25.7604 8.31823 25.6928 8.38128L13.2566 21.4173Z" fill="currentColor"></path><path d="M56.0472 7.44852C55.9519 7.34675 55.7975 7.34675 55.7022 7.44852L42.1276 21.4306C42.0323 21.5324 41.8779 21.5324 41.7826 21.4306L30.251 8.40328C30.1965 8.34028 30.1239 8.32089 30.0558 8.32574V32.7132C30.0558 32.7132 30.0694 32.7132 30.0785 32.7132H46.5405L46.6131 32.6356L55.7022 22.2593C55.7975 22.1576 55.9519 22.1576 56.0472 22.2593L65.9671 32.6356C66.0125 32.6841 66.0761 32.7132 66.1396 32.7132H79.0196C79.2375 32.7132 79.3465 32.4272 79.1921 32.2576L56.0472 7.44368V7.44852Z" fill="currentColor"></path></svg>';
  var PHASES = ["Design", "Permits", "Pre-construction", "Construction", "Punch list", "Complete"];
  var TOKEN_KEY = API ? "bsp-session" : "bsp-preview-session";   // the preview never touches a real login
  var S = { sideOff: (function () { try { return !!localStorage.getItem("bsp-side-off"); } catch (e) { return false; } })(), sched: { view: "gantt", month: "" }, seq: 0, loadErr: "", token: store("get"), me: null, projects: null, pid: null, data: null, tab: "overview", step: "email", email: "", err: "", busy: false, pending: [], lb: null, modal: null };

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
  function crew() { return !!(S.me && S.me.role === "crew"); }
  function team() { return staff() || crew(); }
  /* Little line icons (24×24, drawn for the portal) instead of emoji, so buttons look the same on every phone. */
  function ico(d, cls) { return '<svg class="ico ' + (cls || "") + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + d + "</svg>"; }
  var ICON = {
    eye: ico('<path d="M2.5 12s3.5-6.5 9.5-6.5S21.5 12 21.5 12s-3.5 6.5-9.5 6.5S2.5 12 2.5 12Z"/><circle cx="12" cy="12" r="3"/>'),
    people: ico('<circle cx="9" cy="8.5" r="3.2"/><path d="M3.2 19.5c.7-3.3 3-5 5.8-5s5.1 1.7 5.8 5"/><circle cx="16.8" cy="9.3" r="2.6"/><path d="M16.2 14.6c2.4.1 4 1.7 4.6 4.9"/>'),
    wave: ico('<path d="M7.5 12.5 5.6 10.6a1.6 1.6 0 0 0-2.3 2.3l4.5 4.6A7 7 0 0 0 19.6 13V7.6a1.5 1.5 0 0 0-3 0V11"/><path d="M16.6 10.5V5.6a1.5 1.5 0 0 0-3 0v4.9"/><path d="M13.6 10V4.6a1.5 1.5 0 0 0-3 0V10"/><path d="M10.6 10.2V6.6a1.5 1.5 0 0 0-3 0v6"/>', "wave"),
    chat: ico('<path d="M4.5 5.5h15a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H10l-4.6 3.4V16.5H4.5a1 1 0 0 1-1-1v-9a1 1 0 0 1 1-1Z"/>'),
    video: ico('<rect x="3" y="6.5" width="12.5" height="11" rx="2.5"/><path d="m15.5 10.6 5.5-3v8.8l-5.5-3"/>'),
    dice: ico('<rect x="4" y="4" width="16" height="16" rx="4"/><circle cx="9" cy="9" r=".9" fill="currentColor"/><circle cx="15" cy="9" r=".9" fill="currentColor"/><circle cx="12" cy="12" r=".9" fill="currentColor"/><circle cx="9" cy="15" r=".9" fill="currentColor"/><circle cx="15" cy="15" r=".9" fill="currentColor"/>'),
    lock: ico('<rect x="5" y="10.5" width="14" height="9.5" rx="2.5"/><path d="M8.5 10.5V8a3.5 3.5 0 0 1 7 0v2.5"/>'),
    x: ico('<path d="M6.5 6.5l11 11M17.5 6.5l-11 11"/>'),
    receipt: ico('<path d="M6 3.5h12v17l-2.4-1.6-2.4 1.6-2.4-1.6-2.4 1.6L6 20.5Z"/><path d="M9 8.5h6M9 12h6M9 15.5h3.5"/>'),
    paid: ico('<circle cx="12" cy="12" r="8.5"/><path d="m8.3 12.3 2.5 2.5 5-5.3"/>'),
    camera: ico('<path d="M4 8.5a2 2 0 0 1 2-2h2l1.5-2h5l1.5 2h2a2 2 0 0 1 2 2V17a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2Z"/><circle cx="12" cy="12.6" r="3.4"/>'),
    pen: ico('<path d="M15.5 4.5 19.5 8.5 9 19H5v-4Z"/><path d="m13.5 6.5 4 4"/>'),
    todo: ico('<rect x="4" y="4" width="16" height="16" rx="4"/><path d="m8.5 12.2 2.4 2.4 4.6-5"/>'),
    party: ico('<path d="m4 20 4.5-12 7.5 7.5Z"/><path d="M14 4.5c.4 1.3-.2 2.4-1.5 2.9M19.5 10c-1.3-.4-2.4.2-2.9 1.5M17 4l.01 0M20 7l.01 0M11 3l.01 0"/>'),
    calendar: ico('<rect x="4" y="5.5" width="16" height="14.5" rx="3"/><path d="M4 10h16M8.5 3.5v4M15.5 3.5v4"/>'),
    ruler: ico('<path d="m3.5 15.5 12-12 5 5-12 12Z"/><path d="m7.5 11.5 2 2M10.5 8.5l2 2M13.5 5.5l2 2"/>'),
    question: ico('<circle cx="12" cy="12" r="8.5"/><path d="M9.6 9.6a2.5 2.5 0 0 1 4.8.8c0 1.7-2.4 2.1-2.4 3.6"/><path d="M12 17v.01"/>'),
    clip: ico('<path d="m19 11.5-6.8 6.8a4.2 4.2 0 0 1-6-6l7.3-7.2a2.8 2.8 0 0 1 4 4l-7.2 7.2a1.4 1.4 0 0 1-2-2l6.4-6.3"/>'),
    dollar: ico('<path d="M12 3.5v17M16.5 7.5c-.7-1.3-2.3-2-4.5-2-2.6 0-4.3 1.2-4.3 3.1 0 4.5 9 2.4 9 6.9 0 1.9-1.9 3.1-4.7 3.1-2.3 0-4-.8-4.8-2.2"/>'),
    bell: ico('<path d="M6.5 16.5V11a5.5 5.5 0 0 1 11 0v5.5l1.5 2H5Z"/><path d="M10 20.5a2.2 2.2 0 0 0 4 0"/>'),
    spark: ico('<path d="M12 3.5 13.8 10.2 20.5 12l-6.7 1.8L12 20.5l-1.8-6.7L3.5 12l6.7-1.8Z"/>')
  };
  /* ---- Sierra Crew: everyone's little character. Line art from Notionists by Zoish (CC0); the hard hat, cowboy hat and
     safety vest are drawn for Blue Sierra. Parts load once (avatars/crew.json) and each face becomes a tiny cached image. ---- */
  var SC_BG = ["#F4D58D", "#F6B89B", "#B9DCCB", "#BFD3F2", "#D9C9F2", "#F2C4D6", "#E8DCC6", "#C7E59A", "#9FD8E0", "#E9A867"];
  var SC_HATS = [["", "None"], ["cap", "Cap"], ["hard", "Hard hat"], ["cowboy", "Cowboy"]];
  var SC_FULL = "300 250 1150 1150", SC_HEAD = "380 280 960 960", SC_FACE = "570 540 600 600";
  var CREW = null, crewLoading = null, scUrls = {};
  function loadCrew() {
    if (CREW || crewLoading) return;
    crewLoading = fetch(BASE + "avatars/crew.json?v=1").then(function (r) { if (!r.ok) throw 0; return r.json(); })
      .then(function (j) { CREW = j; crewReady(); }).catch(function () { setTimeout(function () { crewLoading = null; }, 5000); });
  }
  function crewReady() {            // swap every placeholder for the real face, without redrawing the page
    root.querySelectorAll("[data-sc]").forEach(function (el) { var ini = el.querySelector(".ini"); if (ini) ini.outerHTML = '<img src="' + scUrl(scParse(el.dataset.sc)) + '" alt="">'; el.removeAttribute("data-sc"); });
    if (S.modal && S.modal.type === "profile") keepScroll(render);
  }
  function scHash(s) { var h = 2166136261; s = String(s || ""); for (var i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
  function scKeys(k) { return CREW ? Object.keys(CREW[k]) : []; }
  var SC_DEF = { h: "01", x: "", v: 0, y: "14", e: "02", b: "03", n: "05", l: "22", g: "", d: "", c: 0 };
  function scParse(code) {
    var o = Object.assign({}, SC_DEF);
    String(code || "").replace(/^sc:/, "").split(";").forEach(function (kv) { var p = kv.split("="); if (p[0] in o) o[p[0]] = p[0] === "v" || p[0] === "c" ? +p[1] || 0 : p[1] || ""; });
    if (o.c > 9) o.c = 0; return o;
  }
  function scEncode(o) { return "sc:" + Object.keys(SC_DEF).map(function (k) { return k + "=" + (o[k] == null ? "" : o[k]); }).join(";"); }
  /* No pick yet? Everyone still gets their own character, the same one on every device. The crew comes with a hard hat and vest. */
  function scAuto(seed, role, legacy) {
    var h = scHash(seed), r = function (list, salt) { return list[(h >>> salt) % list.length]; };
    var hairs = ["01", "03", "04", "05", "07", "16", "18", "21", "25", "27", "30", "33", "34", "44", "49", "53"];   // short, easygoing styles; anyone can change theirs
    var o = { h: r(hairs, 1), x: "", v: 0, y: r(["14", "01", "07", "10", "13", "17", "20", "25"], 3), e: r(["01", "02", "03", "04", "05"], 5), b: r(["01", "03", "05", "07", "09"], 7),
      n: r(["01", "05", "08", "12", "15"], 9), l: r(["22", "25", "08", "03", "14"], 11), g: (h >>> 13) % 4 === 0 ? r(["01", "03", "05"], 15) : "", d: (h >>> 17) % 4 === 0 ? r(["01", "03", "05", "08"], 19) : "", c: (h >>> 21) % 10 };
    if (role === "crew") { o.x = "hard"; o.v = 1; }
    if (role === "architect" && !o.g) o.g = "01";
    var lg = String(legacy || "");                               // keep the spirit of an older pick
    if (/cowboy/.test(lg)) o.x = "cowboy"; else if (/construction|👷|hat=2|hat=3/.test(lg)) { o.x = "hard"; o.v = 1; } else if (/hat=1/.test(lg)) o.x = "cowboy";
    var fb = lg.match(/;bg=(\d)$/); if (fb) o.c = +fb[1];
    return o;
  }
  function scFor(avatar, seed, role) { var a = String(avatar || ""); return /^sc:/.test(a) ? scParse(a) : scAuto(seed, role, a); }
  function scSvg(o, crop) {
    var P = CREW, part = function (k, id) { return id && P[k][id] ? P[k][id] : ""; }, hat = o.x;
    var body = o.v ? "14" : o.y;
    var s = P.base + part("body", body) + (o.v ? P.extra.vest : "") + (hat === "cap" ? part("hair", "hat") : hat ? "" : part("hair", o.h)) +
      part("lips", o.l) + part("beard", o.d) + part("nose", o.n) + part("eyes", o.e) + part("glasses", o.g) + part("brows", o.b) + (hat === "hard" || hat === "cowboy" ? P.extra[hat] : "");
    return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="' + (crop || SC_FULL) + '" fill="none">' + s + "</svg>";
  }
  function scUrl(o, crop) {
    var k = scEncode(o) + "|" + (crop || "");
    if (!scUrls[k]) { try { scUrls[k] = URL.createObjectURL(new Blob([scSvg(o, crop)], { type: "image/svg+xml" })); } catch (e) { scUrls[k] = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(scSvg(o, crop)); } }
    return scUrls[k];
  }
  /* A person's picture. */
  function av(name, avatar, role, cls, key) {
    var o = scFor(avatar, key || name, role), dot = key && S.presence ? presDot(key) : "";
    if (!CREW) loadCrew();
    return '<div class="avatar sc ' + (cls || "") + '" style="background:' + SC_BG[o.c] + '" title="' + esc(name) + '"' + (CREW ? "" : ' data-sc="' + esc(scEncode(o)) + '"') + ">" +
      (CREW ? '<img src="' + scUrl(o) + '" alt="">' : '<span class="ini">' + esc(initials(name)) + "</span>") + dot + "</div>";
  }
  loadCrew();
  function roleName(r) { return { client: "Client", architect: "Architect", admin: "Admin", staff: "Project manager", crew: "Field crew" }[r] || "Team"; }
  function asClient() { return !!(S.me && S.me.role === "client"); }   // the architect sees the project like the client, but the client's to-dos aren't theirs
  function resetState() { S.viewAs = null; S.realMe = null; cacheClear(); S.dis = null; S.presence = null; S.peopleOpen = false; S.token = ""; S.me = null; S.projects = null; S.data = null; S.notif = null; S.bell = false; if (S.tour) { S.tour = null; var tw = document.getElementById("bsp-tour"); if (tw) tw.remove(); } S.pid = null; S.lb = null; S.modal = null; S.pending = []; S.loadErr = ""; S.seq++; }
  function isDone(v) { return /^(yes|true|y|1)$/i.test(String(v)); }
  /* "Are you sure?" drawn by the portal itself: the browser's confirm() box is blocked in some apps and embedded views. */
  function sure(text, yes) {
    var old = document.getElementById("bsp-sure"); if (old) old.remove();
    var w = document.createElement("div"); w.id = "bsp-sure"; w.className = "sure-bg";
    w.innerHTML = '<div class="sure" role="alertdialog" aria-modal="true"><p></p><div class="actions"><button class="btn ghost" data-s="no">Cancel</button><button class="btn danger-btn" data-s="yes">Delete</button></div></div>';
    w.querySelector("p").textContent = text; root.appendChild(w);
    var close = function () { w.remove(); document.removeEventListener("keydown", key, true); };
    var key = function (e) { if (e.key === "Escape") { e.stopPropagation(); close(); } if (e.key === "Enter") { e.preventDefault(); close(); yes(); } };
    document.addEventListener("keydown", key, true);
    w.addEventListener("click", function (e) { var t = e.target.closest("[data-s]"); if (e.target === w || (t && t.dataset.s === "no")) close(); else if (t) { close(); yes(); } });
    w.querySelector("[data-s=yes]").focus();
  }
  function keepScroll(fn) { var y = window.scrollY; fn(); window.scrollTo(0, y); }

  /* Preview: the admin reads the portal the way a #client, #architect or #crew member gets it from the server. Nothing saves. */
  var VIEWABLE = { listProjects: 1, getProject: 1, activity: 1, planImage: 1, planText: 1, lsHome: 1, lsProperty: 1, lsEstimate: 1 };
  async function call(action, body) {
    var payload = Object.assign({ action: action, token: S.token }, body || {}), res;
    if (S.viewAs) {
      if (VIEWABLE[action]) { payload.viewAs = S.viewAs; if (S.viewAsLs) payload.viewAsLs = S.viewAsLs; }
      else if (action === "markRead") return { ok: true };
      else if (action !== "logout") throw new Error("You're previewing as #" + S.viewAs + ". Exit the preview to change things.");
    }
    if (API) {
      for (var tries = 0; ; tries++) {
        var r = await fetch(API, { method: "POST", headers: { "Content-Type": "text/plain;charset=utf-8" }, body: JSON.stringify(payload) });
        res = await r.json();
        // "Busy" means the save never started, so trying again is safe. Quietly retry twice before telling anyone.
        if (res.ok || !/busy/i.test(res.error || "") || tries >= 2) break;
        await new Promise(function (ok) { setTimeout(ok, 1200 + tries * 1800 + Math.random() * 600); });
      }
    } else if (window.BSP_MOCK) res = await window.BSP_MOCK(payload);
    else throw new Error("The portal isn't connected yet.");
    if (!res.ok) {
      if (/log in again|doesn't have access/i.test(res.error || "") && action !== "verifyCode") { store("del"); resetState(); render(); }
      throw new Error(res.error || "Something went wrong.");
    }
    if (res.notice) toast(res.notice);
    if (res.ver && action !== "presence") S.ver = Math.max(S.ver || 0, res.ver);
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
      if (p[0] === "c" && /^(client|architect|team|dm:[0-9a-f]{10}-[0-9a-f]{10})$/.test(v)) h.c = v;   // a chat channel, from an email link
    });
    return h;
  }
  function go(pid, tab) {
    var h = pid ? "#p=" + encodeURIComponent(pid) + (tab && tab !== "overview" ? "&t=" + tab : "") : "#";
    if (location.hash !== h) history.pushState(null, "", h === "#" ? location.pathname + location.search : h);
    route();
  }
  (function () {
    try {
      var qs = new URLSearchParams(location.search);
      if (qs.get("code") && qs.get("state") && qs.get("realmId")) {
        S.qbReturn = { code: qs.get("code"), state: qs.get("state"), realmId: qs.get("realmId") };
        ["code", "state", "realmId"].forEach(function (k) { qs.delete(k); });
        history.replaceState(null, "", location.pathname + (qs.toString() ? "?" + qs : "") + location.hash);
      } else if (qs.get("error") && qs.get("state")) { S.qbReturnErr = qs.get("error"); history.replaceState(null, "", location.pathname + location.hash); }
    } catch (e) {}
  })();
  async function finishQb() {
    var r = S.qbReturn; S.qbReturn = null; if (!r || !S.me || !S.me.admin) return;
    try { S.qb = await call("qbFinish", r); S.home = "team"; if (!S.pid) keepScroll(render); toast("QuickBooks connected" + (S.qb.company ? ": " + S.qb.company : "") + " 🎉"); }
    catch (e) { S.qb = null; toast(e.message); }
  }
  async function route() {
    if (!S.token) { S.me = null; return render(); }
    var h = hashState(), seq = ++S.seq;
    S.lb = null; S.modal = null; S.loadErr = "";                     // overlays never survive navigation
    try {
      if (!S.projects) {
        var cl = cacheGet("list"); if (cl && cl.me) { S.me = cl.me; S.projects = cl.projects; if (!h.p) render(); }      // show the last copy instantly
        var r = await call("listProjects"); if (seq !== S.seq) return; S.me = r.me; S.projects = r.projects; S.pins = r.pins || []; S.notif = null; loadNotif(); ping();
        if (S.qbReturn) { S.home = "team"; finishQb(); }
        if (S.qbReturnErr) { toast("QuickBooks wasn't connected (" + S.qbReturnErr + ")."); S.qbReturnErr = null; }
        if (!S.viewAs) { try { localStorage.setItem("bsp-last-email", r.me.email); } catch (e) {} cacheSet("list", { me: r.me, projects: r.projects }); }
      }
      if (!h.p && !staff() && S.projects.length === 1 && !(S.me && S.me.ls)) h.p = S.projects[0].id; // a client with one project goes straight to it (unless they also have maintenance: Home shows both)
      S.tab = h.t || "overview";
      if (h.c) { S.wantChan = h.c; if (S.data && S.pid === h.p) { S.chan = h.c; S.readMark = {}; } history.replaceState(null, "", "#p=" + h.p + "&t=" + S.tab); }
      if (h.p) {
        if (!S.data || S.data.project.id !== h.p) {
          S.pid = h.p; S.pending = []; S.att = { main: [], thread: [] }; S.readMark = {}; S.picker = null; S.chan = S.wantChan || "client"; S.wantChan = null;
          S.data = cacheGet("p:" + h.p); render();                       // the last copy right away (if there is one), fresh data a moment later
          var d = await call("getProject", { projectId: h.p });
          if (seq !== S.seq) return;                                     // a newer navigation won: drop this answer
          S.data = d; cacheSet("p:" + h.p, d);
        }
      } else { S.pid = null; S.data = null; S.pending = []; }
    } catch (e) { if (seq !== S.seq) return; if (S.pid && !S.data) S.loadErr = e.message; else S.err = e.message; }
    if (S.wantChan && S.data) { S.chan = S.wantChan; S.wantChan = null; S.readMark = {}; }
    pingLater();
    if (S.openThread && S.data) { S.modal = { type: "thread", id: S.openThread }; S.openThread = null; }
    if (S.afterLoadModal && S.data) { S.modal = staff() ? { type: "sched", id: S.afterLoadModal.id } : S.afterLoadModal; S.afterLoadModal = null; }
    render();
    if (S.flash) { var fl = document.getElementById(S.flash); S.flash = null; if (fl) { fl.scrollIntoView({ block: "center" }); fl.classList.add("flash"); setTimeout(function () { fl.classList.remove("flash"); }, 2400); } }
    setTimeout(function () { startTour(false); }, 400);
    if (S.tab === "messages" && S.data && !S.modal) window.scrollTo(0, document.body.scrollHeight);
  }
  function enterPreview(role) {
    if (!S.viewAs) S.realMe = S.me;
    S.viewAs = role; S.viewAsLs = null; lsReset(); S.modal = null; S.projects = null; S.data = null; S.notif = null; S.bell = false; S.peopleOpen = false; S.presence = null; S.team = null;
    if (S.tab === "money" || S.tab === "people") history.replaceState(null, "", S.pid ? "#p=" + S.pid : location.pathname + location.search);
    window.scrollTo(0, 0); route();
  }
  function exitPreview() { S.viewAs = null; S.viewAsLs = null; lsReset(); if (S.realMe) S.me = S.realMe; S.realMe = null; S.projects = null; S.data = null; S.notif = null; route(); ping(); }
  function previewBar() {
    if (!S.viewAs) return "";
    return '<div class="viewas-bar"><span class="va-txt">' + ICON.eye + ' Previewing as <span class="tg tg-' + S.viewAs + '">#' + S.viewAs + "</span> · exactly what they see. Nothing saves.</span>" +
      '<span class="va-btns">' + ["client", "architect", "crew"].filter(function (r) { return r !== S.viewAs; }).map(function (r) { return '<button class="chip" data-a="viewAs" data-v="' + r + '">#' + r + "</button>"; }).join("") +
      '<button class="btn sm light" data-a="exitPreview">Exit preview</button></span></div>';
  }
  async function reload(projectsToo) {
    var pid = S.pid, seq = S.seq;
    if (projectsToo) { var r = await call("listProjects"); if (seq === S.seq) { S.projects = r.projects; S.pins = r.pins || []; } }
    if (pid) { var d = await call("getProject", { projectId: pid }); if (seq !== S.seq || S.pid !== pid) return; S.data = d; cacheSet("p:" + pid, d); }
    keepScroll(render);
  }
  /* After a save that worked, a failed refresh must not look like a failed save (and invite a duplicate). */
  async function refresh(projectsToo) { try { await reload(projectsToo); } catch (e) { toast("Saved, but the page couldn't refresh. Reload to see it."); } }
  window.addEventListener("popstate", route);
  /* Live updates: every ping carries the project's version number; when someone saves anything, open portals reload it once. */
  function onVersion(v) {
    if (!v || !S.pid || !S.data) return;
    if (S.verPid !== S.pid) { S.verPid = S.pid; S.ver = v; return; }
    if (v === S.ver) return; S.ver = v;
    if (S.busy || S.modal) { S.verLater = true; return; }   // don't pull the rug while someone is typing in a form
    liveReload();
  }
  async function liveReload() {
    var pid = S.pid, seq = S.seq;
    try {
      var d = await call("getProject", { projectId: pid });
      if (seq !== S.seq || S.pid !== pid || !S.data) return;
      var nearBottom = S.tab === "messages" && window.innerHeight + window.scrollY > document.body.scrollHeight - 200;
      d.reads = S.data.reads; S.data = d; cacheSet && cacheSet("p:" + pid, d); keepScroll(render);
      if (nearBottom && !S.modal) window.scrollTo(0, document.body.scrollHeight);
    } catch (e) {}
  }

  /* ---------------- render ---------------- */
  function render() {
    if (S.step === "setpin" && !S.me) return renderLogin();
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
    // Panels that are already open stay put on a redraw: no replayed opening animation, same scroll position.
    var OVER = [".bell-panel", ".bell-bg", ".pp-panel", ".pp-bg", ".modal-bg", ".modal", ".mk-body"], kept = {};
    OVER.forEach(function (q) { var el = root.querySelector(q); if (el) kept[q] = el.scrollTop; });
    var floaters = [].slice.call(root.querySelectorAll("#bsp-pop, .toast, #bsp-sure"));   // live cards survive the redraw
    root.innerHTML =
      previewBar() + '<header class="topbar"><div class="brand">' + (hasSide() ? '<button class="side-tog' + ((matchMedia("(max-width:1080px)").matches ? S.drawer : !S.sideOff) ? " open" : "") + '" data-a="sideTog" aria-label="Show or hide the sidebar" title="Sidebar"><i></i><i></i><i></i></button>' : "") + LOGO + '<span>Client portal <em class="beta" title="We\'re testing it: tell us anything with the Feedback button">Beta v1.1</em></span></div>' +
      '<div class="who">' + ((S.me.admin || S.viewAs) && !S.viewAs ? '<button class="icon-btn eye-btn" data-a="modal" data-m="viewAs" aria-label="Preview as client, architect or crew" title="Preview as #client, #architect or #crew">' + ICON.eye + "</button>" : "") + peopleButton() + '<button class="icon-btn chat-btn" data-a="chatDock" aria-label="Open chat" title="Chat (it opens in a corner, so you can keep working)">' + ICON.chat + "</button>" + bellButton() + '<button class="icon-btn help" data-a="tour" aria-label="Take the tour" title="Take the tour">?</button><button class="me-btn" data-a="modal" data-m="profile" title="Your profile"><span class="name">' + esc(S.me.name) + (team() ? ' <span class="pill">' + (crew() ? "Crew" : "Team") + "</span>" : "") + "</span>" + av(S.me.name, S.me.avatar, S.me.role, "", S.me.key) + '</button><button class="btn ghost sm" data-a="logout">Log out</button></div></header>' +
      '<div class="wrap' + (hasSide() ? " has-side" + (S.sideOff ? " side-off" : "") + (S.drawer ? " drawer-on" : "") : "") + '">' + (hasSide() ? '<div class="side-bg" data-a="sideTog"></div>' + sidebar() : "") + '<main class="main">' + (S.err ? '<p class="error" style="margin-bottom:12px">' + esc(S.err) + "</p>" : "") + body + "</main></div>" +
      (S.peopleOpen ? peoplePanel() : "") + (S.bell ? bellPanel() : "") + (S.modal ? renderModal() : "") + (S.lb ? renderLightbox() : "");
    restore(snap);
    floaters.forEach(function (el) { root.appendChild(el); });
    Object.keys(kept).forEach(function (q) { var el = root.querySelector(q); if (el) { el.classList.add("still"); el.scrollTop = kept[q]; } });
    if (S.tour) drawTour(0);                      // a redraw wipes the overlay: put it back on the same step, without scrolling
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

  /* Our work, from the website's own image library: a different one each visit (Webflow's loginPhoto setting wins if set). */
  var WORK = [
    ["6aeaccf885dc4e4804abb83f_hero-chiltern-001-1920.webp", "Chiltern Residence, Hillsborough"],
    ["6aea95959662959df8d8daec_eucalyptus-tjp-2291-7508-5x-main-2880.avif", "Eucalyptus, Hillsborough"],
    ["6aea8ecc28a19611d8389d6b_hero-bates-road-a.avif", "Bates Road, Hillsborough"],
    ["6aea8ecc7c528bedc63e941b_hero-shirley-los-altos.avif", "Shirley Residence, Los Altos"],
    ["6aea8284ac84cad28d7ba644_hero-01-rose-residence-06.avif", "Rose Residence, Hillsborough"],
    ["6aea95d0cc00a0f02cf8a93f_lacumbre-0632-v1-main-2880.avif", "Woodside garden"]
  ];
  function loginPhoto() {
    if (SET.loginPhoto) return [SET.loginPhoto, ""];
    if (S.loginPick == null) S.loginPick = Math.floor(Math.random() * WORK.length);
    var w = WORK[S.loginPick]; return ["https://cdn.prod.website-files.com/69582886d4d5d7d43ba632a5/" + w[0], w[1]];
  }
  /* This device remembers who logged in, so next time it's just the PIN. */
  function loginStep() { try { var r = JSON.parse(localStorage.getItem("bsp-remember") || "null"); if (r && r.email) { S.email = r.email; S.who = r.name; return "pin"; } } catch (e) {} return "email"; }
  function remember(email, name) { try { localStorage.setItem("bsp-remember", JSON.stringify({ email: email, name: name || "" })); } catch (e) {} }
  function forget() { try { localStorage.removeItem("bsp-remember"); } catch (e) {} S.who = ""; }
  async function savePin(pin) {
    await call("setPin", { pin: pin }); S.lastCode = null; S.resetPin = false;
    S.me = S.pendingMe; S.me.hasPin = true; S.pendingMe = null; S.projects = null; toast("PIN saved 🔐 Next time, just your email and PIN."); return route();
  }
  (function () { try { var r = JSON.parse(localStorage.getItem("bsp-remember") || "null"); if (r && r.email) { S.email = r.email; S.who = r.name; S.step = "pin"; } } catch (e) {} })();
  function renderLogin() {
    var demo = !API && window.BSP_MOCK, lp = loginPhoto();
    root.innerHTML = '<section class="login"><div class="login-photo" style="' + bg(lp[0]) + '">' + (lp[1] ? '<div class="lp-cap">' + esc(lp[1]) + "</div>" : "") + '<div class="lp-tag">Crafting sites, one space at a time.</div></div>' +
      '<div class="login-side">' + LOGO + '<div class="eyebrow">Client portal · Beta v1.1</div>' +
      (S.step === "setpin" ? '<h1>Choose your PIN.</h1><p class="muted">6 digits you\'ll use to log in from now on' + (S.lastCode ? ", or keep the code we just sent you" : "") + ". No more codes by email.</p>" +
          '<form class="form" data-form="setpin"><label class="f">Your new PIN<input class="code-input" type="password" name="pin" inputmode="numeric" autocomplete="new-password" maxlength="6" pattern="\\d{6}" required></label><button class="btn" type="submit">Save my PIN</button></form>' +
          (S.lastCode ? '<button class="link" data-a="keepCode">Keep ' + esc(S.lastCode) + " as my PIN</button>" : "")
        : S.step === "pin" ? "<h1>Welcome back" + (S.who ? ", " + esc(S.who) : "") + '.</h1><p class="muted">Type your 6-digit PIN for <b>' + esc(S.email) + "</b>.</p>" +
          '<form class="form" data-form="pin"><input type="email" name="username" autocomplete="username" value="' + esc(S.email) + '" hidden><label class="f">PIN<input class="code-input" type="password" name="pin" inputmode="numeric" autocomplete="current-password" maxlength="6" required></label><button class="btn" type="submit">Open the portal</button></form>' +
          '<div class="login-links"><button class="link" data-a="forgotPin">Forgot my PIN</button><button class="link" data-a="restart">Not ' + esc(S.who || "you") + "? Use another email</button></div>"
        : S.step === "code" ? "<h1>" + (S.resetPin ? "Reset your PIN." : "Check your email.") + '</h1><p class="muted">We sent a 6-digit code to <b>' + esc(S.email) + "</b>. It works for 15 minutes." + (S.resetPin ? " Then you'll choose a new PIN." : " It's only for this first time: next you'll choose your own PIN.") + "</p>" +
          '<form class="form" data-form="code"><label class="f">Code<input class="code-input" type="text" name="code" inputmode="numeric" autocomplete="one-time-code" maxlength="6" required></label><button class="btn" type="submit">Continue</button></form>' +
          '<button class="link" data-a="restart">Use a different email</button>'
        : '<h1>Your project, in one place.</h1><p class="muted">Photos, updates, chat, the schedule and invoices for your Blue Sierra project. Type your email to log in.</p>' +
          '<form class="form" data-form="email"><label class="f">Email<input type="email" name="email" autocomplete="username email" required value="' + esc(S.email) + '"></label><button class="btn" type="submit">Continue</button></form>') +
      (S.err ? '<p class="error">' + esc(S.err) + "</p>" : "") +
      (demo ? '<div class="demo-box"><b>Preview with sample data.</b> Log in as <b>jesus@example.com</b> (team), <b>client@example.com</b> (client), <b>architect@example.com</b> or <b>crew@example.com</b>. The first time the code is <b>123456</b>. Nothing here is real or sent.</div>' : "") +
      (!API && !window.BSP_MOCK ? '<p class="error">The portal isn\'t connected yet.</p>' : "") +
      "</div></section>";
    S.err = "";
    var inp = root.querySelector("input"); if (inp) inp.focus();
  }

  function renderList() {
    var lsRoleMe = S.me && S.me.ls, list0 = S.projects || [];
    var list = list0, view = staff() ? (S.home || "projects") : lsRoleMe ? (S.home || (list0.length ? "projects" : "ls")) : "projects";
    var deleted = list.filter(function (p) { return p.status === "deleted"; }); list = list.filter(function (p) { return p.status !== "deleted"; });
    var active = list.filter(function (p) { return p.status !== "archived"; }), archived = list.filter(function (p) { return p.status === "archived"; });
    var unreadAll = active.reduce(function (a, p) { return a + (p.unread || 0); }, 0);
    var card = function (p) {
      var mo = p.money || {}, paidPct = mo.total ? pctOf(mo.paid, mo.total) : 0;
      var cv = p.cover ? bg(p.cover) : "", mapBg = !p.cover && p.lat != null ? cardMap(p) : "", logo = "";
      return '<button class="pcard" data-a="open" data-id="' + esc(p.id) + '"><div class="cover' + (!p.cover ? " no-photo" : "") + '" style="' + cv + '">' + mapBg + (!p.cover ? '<span class="cv-name">' + esc(p.name) + "</span>" : "") + '<span class="pill dark">' + esc(p.phase) + "</span>" + (p.unread ? '<span class="pill new">' + p.unread + " new</span>" : "") + logo + "</div>" +
        '<div class="body"><h3>' + esc(p.name) + '</h3><span class="muted small">' + esc([p.client_name, p.city].filter(Boolean).join(" · ")) + "</span>" +
        (mo.total ? '<div class="pc-money"><b>' + money(mo.total) + '</b><span class="muted small">' + paidPct + "% paid</span></div>" + '<div class="cbar slim"><i class="paid" style="width:' + pctOf(mo.paid, mo.total) + '%"></i><i class="wait" style="width:' + pctOf(mo.waiting, mo.total) + '%"></i><i class="held" style="width:' + pctOf(mo.held, mo.total) + '%"></i></div>'
          : '<div class="bar"><i style="width:' + Number(p.progress || 0) + '%"></i></div>') +
        '<div class="meta">' + (p.openQuestions ? '<span class="pill gold">' + p.openQuestions + " open question" + (p.openQuestions > 1 ? "s" : "") + "</span>" : "") +
        (p.balance ? '<span class="pill' + (mo.overdue ? " bad" : "") + '">' + money(p.balance) + (mo.overdue ? " due · " + money(mo.overdue) + " overdue" : " due") + "</span>" : "") + (p.lastUpdate ? '<span class="pill">Updated ' + day(p.lastUpdate.slice(0, 10)) + "</span>" : "") + "</div></div></button>";
    };
    var chips = staff() ? '<div class="chips home-chips">' + [["projects", "Projects", 0], ["activity", "Activity", unreadAll], ["ls", "Maintenance", 0]].concat(S.me.money ? [["finance", "Finances", 0]] : [], [["team", "Team", 0]]).map(function (o) { return '<button class="chip' + (view === o[0] ? " on" : "") + '" data-a="homeView" data-v="' + o[0] + '">' + o[1] + (o[2] ? ' <span class="count">' + o[2] + "</span>" : "") + "</button>"; }).join("") + "</div>" : "";
    var head = '<div class="section-title" style="margin-top:6px"><div><div class="eyebrow">' + (staff() ? "Blue Sierra" : "Your projects") + '</div><h2 style="font-size:32px;margin-top:4px">' + (staff() ? "Home" : "Welcome, " + esc(first(S.me.name))) + "</h2></div>" +
      (staff() && view === "projects" ? '<button class="btn" data-a="modal" data-m="project">＋ New project</button>' : "") + "</div>" + chips;
    if (!staff() && lsRoleMe) head = head + '<div class="chips home-chips">' + [["projects", "Projects"], ["ls", lsRoleMe === "crew" ? "My route" : "My property"]].map(function (o) { return '<button class="chip' + (view === o[0] ? " on" : "") + '" data-a="homeView" data-v="' + o[0] + '">' + o[1] + "</button>"; }).join("") + "</div>";
    if (view === "ls") return head + '<div class="ls-wrap">' + lsView() + "</div>";
    if (view === "activity") return head + homeActivity();
    if (view === "team") return head + homeTeam();
    if (view === "finance" && S.me.money) return head + homeFinance();
    var portfolio = "";
    if (staff() && active.length) {
      var t = { total: 0, billed: 0, paid: 0, waiting: 0, overdue: 0, held: 0 }, withC = 0;
      active.forEach(function (p) { var mo = p.money || {}; if (mo.total) withC++; Object.keys(t).forEach(function (k) { t[k] += Number(mo[k] || 0); }); });
      portfolio = '<div class="grid g4 portfolio">' + stat("Under contract", money(t.total), withC + " active project" + (withC === 1 ? "" : "s") + " with a contract") +
        stat("Billed", money(t.billed), pctOf(t.billed, t.total) + "% of the contracts") + stat("Collected", money(t.paid), pctOf(t.paid, t.total) + "% of the contracts") +
        stat("To collect", money(t.waiting), t.overdue ? '<span style="color:var(--bad)">' + money(t.overdue) + " overdue</span>" : "Nothing overdue" + (t.held ? " · " + money(t.held) + " retainage held" : "")) + "</div>";
    }
    return head + portfolio + homePins() +
      (active.length ? '<div class="projects">' + active.map(card).join("") + "</div>" : '<div class="empty">' + (staff() ? "No projects yet. Create the first one." : "There's no project on your account yet. Blue Sierra will add it soon.") + "</div>") +
      (archived.length ? '<div class="section-title"><h2>Archived</h2></div><div class="projects">' + archived.map(card).join("") + "</div>" : "") +
      (deleted.length ? '<div class="section-title"><h2>Recently deleted</h2><span class="muted small">Only you see these.</span></div><div class="card" style="display:flex;flex-direction:column;gap:10px">' + deleted.map(function (p) { return '<div class="team-row"><div style="flex:1"><b style="font-weight:500">' + esc(p.name) + '</b><div class="muted small">' + esc([p.client_name, p.city].filter(Boolean).join(" · ")) + '</div></div><button class="btn ghost sm" data-a="restoreProject" data-id="' + esc(p.id) + '">Restore</button><button class="btn ghost sm danger-txt" data-a="modal" data-m="purge" data-id="' + esc(p.id) + '">Delete forever</button></div>'; }).join("") + "</div>" : "");
  }
  /* The job site on the card: map tiles around the property, the gold pin right where it is. The page sends no referrer
     (Webflow setting) and OpenStreetMap blocks tiles without one, so each tile asks for the origin explicitly. */
  function cardMap(p) {
    var z = 16, n = Math.pow(2, z), lat = p.lat * Math.PI / 180, fx = (p.lon + 180) / 360 * n, fy = (1 - Math.log(Math.tan(lat) + 1 / Math.cos(lat)) / Math.PI) / 2 * n, out = [];
    for (var tx = Math.floor(fx) - 2; tx <= Math.floor(fx) + 1; tx++) for (var ty = Math.floor(fy) - 1; ty <= Math.floor(fy) + 1; ty++)
      out.push('<img src="https://tile.openstreetmap.org/' + z + "/" + tx + "/" + ty + '.png" alt="" loading="lazy" referrerpolicy="strict-origin-when-cross-origin" style="left:calc(var(--mx) + ' + Math.round((tx - fx) * 256) + "px);top:calc(var(--my) + " + Math.round((ty - fy) * 256) + 'px)">');
    return '<div class="cv-map" aria-hidden="true">' + out.join("") + '</div><span class="cv-pin" aria-hidden="true"><i class="pulse"></i><svg viewBox="0 0 48 60"><path d="M24 58C24 58 4 36.5 4 22.5a20 20 0 0 1 40 0C44 36.5 24 58 24 58Z" fill="#c39a5a" stroke="#fff" stroke-width="2.5"/><circle cx="24" cy="22" r="7.5" fill="#fff"/></svg></span>';
  }
  function tileUrl(lat, lon, z) { var n = Math.pow(2, z), r = lat * Math.PI / 180; return "https://tile.openstreetmap.org/" + z + "/" + Math.floor((lon + 180) / 360 * n) + "/" + Math.floor((1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2 * n) + ".png"; }
  /* Pinned across all my projects: what the team (or I) pinned in chat, updates and checklists, filtered by #tags. */
  function homePins() {
    var l = S.pins || []; if (!l.length) return "";
    var ico = { msg: ICON.chat, update: ICON.camera, check: ICON.todo };
    return '<div class="section-title"><h2>📌 Pinned</h2><span class="muted small">Visible to everyone who can see each one</span></div><div class="home-pins">' + l.slice(0, 9).map(function (x) {
      return '<button class="hp-card k-' + x.kind + (x.done ? " done" : "") + '" data-a="homePin" data-kind="' + x.kind + '" data-id="' + esc(x.id) + '" data-p="' + esc(x.pid) + '" data-c="' + esc(x.channel || "") + '">' +
        '<span class="hp-top"><span class="hp-ico">' + ico[x.kind] + "</span>" + esc(x.project) + (x.kind === "msg" ? " · " + (x.dm ? "private" : "#" + esc(x.channel)) : "") + "</span>" +
        '<span class="hp-text">' + esc(String(x.text || "").split("\n")[0] || "Photos") + "</span>" +
        '<span class="hp-foot">' + (x.author ? av(x.author, x.avatar, "", "xs", x.akey) + "<span>" + esc(first(x.author)) + "</span>" : "") + tagChips(x.aud) + (x.at ? '<small class="muted">' + day(String(x.at).slice(0, 10)) + "</small>" : "") + "</span></button>";
    }).join("") + "</div>";
  }
  function homeActivity() {
    if (!S.activity) { loadHome("activity"); return '<div class="loading" style="min-height:30vh">Loading activity…</div>'; }
    if (!S.activity.length) return '<div class="empty">No messages yet in any project.</div>';
    var lastDay = "";
    return '<div class="card act">' + S.activity.map(function (it) {
      var d = String(it.at).slice(0, 10), sep = d !== lastDay ? '<div class="act-day">' + day(d) + "</div>" : ""; lastDay = d;
      return sep + '<button class="act-row' + (it.unread ? " unread" : "") + '" data-a="actOpen" data-p="' + esc(it.project_id) + '" data-c="' + esc(it.channel) + '" data-th="' + esc(it.thread_id || "") + '">' +
        av(it.author, it.avatar, it.role, "sm", it.akey) + "<div class=\"act-body\"><div class=\"act-top\"><b>" + esc(it.author) + '</b><span class="muted small">' + esc(it.project) + " · " + (it.dm ? "🔒 private" : "#" + esc(it.channel)) + (it.thread_id ? " · thread" : "") + "</span>" +
        (it.mention ? '<span class="pill new">@you</span>' : "") + (it.kind === "question" ? '<span class="pill gold">Question</span>' : "") + '<span class="muted small act-time">' + day(it.at).replace(/^.* · /, "") + "</span></div>" +
        '<div class="act-text">' + esc(it.text || (it.files ? it.files + " attachment" + (it.files > 1 ? "s" : "") : "")) + "</div></div>" + (it.unread ? '<span class="dot"></span>' : "") + "</button>";
    }).join("") + "</div>";
  }
  /* ---------------- QuickBooks ---------------- */
  function qbLoad() { if (S.qbBusy) return; S.qbBusy = true; call("qbStatus").then(function (r) { S.qb = r; }).catch(function (e) { S.qb = { error: e.message }; }).then(function () { S.qbBusy = false; keepScroll(render); }); }
  function qbLogo() { return '<span class="qb-mark" aria-hidden="true">qb</span>'; }
  function qbSettings() {
    var q = S.qb; if (!q) { qbLoad(); return '<div class="card qb-card"><div class="qb-h">' + qbLogo() + "<b>QuickBooks</b></div><p class=\"muted small\">Checking…</p></div>"; }
    if (q.error) return '<div class="card qb-card"><div class="qb-h">' + qbLogo() + "<b>QuickBooks</b></div><p class=\"muted small\">" + esc(q.error) + "</p></div>";
    if (q.connected) return '<div class="card qb-card on"><div class="qb-h">' + qbLogo() + "<div><b>QuickBooks connected</b><div class=\"muted small\">" + esc(q.company || "Your company") + (q.env === "sandbox" ? " · sandbox" : "") + "</div></div>" +
      (q.admin ? '<button class="btn ghost sm" data-a="qbDisconnect" style="margin-left:auto">Disconnect</button>' : "") + '</div><p class="muted small">Open a project → Contract & billing → “From QuickBooks” to link its customer and bring invoices in with their real PDF.</p>' + qbHelp() + "</div>";
    if (!q.admin) return '<div class="card qb-card"><div class="qb-h">' + qbLogo() + '<b>QuickBooks</b></div><p class="muted small">Not connected yet. Jesús connects it from here.</p></div>';
    return '<div class="card qb-card"><div class="qb-h">' + qbLogo() + "<div><b>" + (q.reconnect ? "Connect QuickBooks again" : "Connect QuickBooks") + "</b><div class=\"muted small\">Bring invoices from QuickBooks into each project, PDF included, and see #money for every job.</div></div></div>" +
      (q.reconnect ? '<p class="qb-warn">' + esc(q.reconnect) + "</p>" : "") +
      '<ol class="qb-steps"><li>Go to <a href="https://developer.intuit.com/app/developer/dashboard" target="_blank" rel="noopener">developer.intuit.com</a> → your app (Blue Sierra Portal).</li>' +
      '<li>In the app’s <b>Settings → Redirect URIs</b> (Development to test with a sandbox, Production for your real company), add:<div class="qb-copy"><code>' + esc(q.redirect || "https://www.bluesierracorp.com/portal") + '</code><button type="button" class="btn ghost sm" data-a="copyText" data-v="' + esc(q.redirect || "https://www.bluesierracorp.com/portal") + '">Copy</button></div></li>' +
      "<li>Paste the app’s Client ID and Client Secret below (you type them; they’re stored privately in Google and never shown again).</li></ol>" +
      '<form class="form" data-form="qbKeys"><div class="row2"><label class="f">Client ID<input type="text" name="clientId" autocomplete="off" ' + (q.hasKeys ? 'placeholder="Saved. Leave blank to keep it"' : "required") + '></label><label class="f">Client Secret<input type="password" name="clientSecret" autocomplete="new-password" ' + (q.hasKeys ? 'placeholder="Saved. Leave blank to keep it"' : "required") + "></label></div>" +
      '<label class="f">Which QuickBooks<select name="env"><option value="production">My real company (production)</option><option value="sandbox"' + (q.env === "sandbox" ? " selected" : "") + ">Sandbox (for testing, with the Development keys)</option></select></label>" +
      '<div class="actions"><button class="btn ghost" type="submit">Save keys</button>' + (q.hasKeys ? '<button type="button" class="btn" data-a="qbConnect">Connect QuickBooks</button>' : "") + "</div></form>" + qbHelp() + "</div>";
  }
  function qbHelp() { var base = "https://planscope.github.io/bluesierra-academy/"; return '<p class="muted small qb-help">Help with QuickBooks in the portal: <a href="mailto:info@bluesierracorp.com?subject=Portal%20QuickBooks%20help">info@bluesierracorp.com</a> · <a href="' + base + 'portal-privacy.html" target="_blank" rel="noopener">Privacy</a> · <a href="' + base + 'portal-terms.html" target="_blank" rel="noopener">Terms</a></p>'; }
  function qbProjectBox() {
    var q = S.qb; if (!q) { qbLoad(); return ""; }
    if (!q.connected) return '<div class="card qb-card slim"><div class="qb-h">' + qbLogo() + '<span class="muted small">' + (q.reconnect ? "QuickBooks needs to be connected again. " : "QuickBooks isn’t connected yet. ") + (S.me.admin ? 'Connect it from <button class="link" data-a="homeTeamQb">Home → Team</button>.' : "Jesús can connect it from Home → Team.") + "</span></div></div>";
    var st = S.qbp && S.qbp.pid === S.pid ? S.qbp : null;
    if (!st) { S.qbp = { pid: S.pid, loading: true }; call("qbInvoices", { projectId: S.pid }).then(function (r) { S.qbp = { pid: S.pid, linked: r.linked, invoices: r.invoices }; }).catch(function (e) { S.qbp = { pid: S.pid, error: e.message }; }).then(function () { keepScroll(render); }); return '<div class="card qb-card"><div class="qb-h">' + qbLogo() + "<b>From QuickBooks</b></div><p class=\"muted small\">Loading…</p></div>"; }
    if (st.loading) return '<div class="card qb-card"><div class="qb-h">' + qbLogo() + "<b>From QuickBooks</b></div><p class=\"muted small\">Loading…</p></div>";
    if (st.error) return '<div class="card qb-card"><div class="qb-h">' + qbLogo() + "<b>From QuickBooks</b></div><p class=\"muted small\">" + esc(st.error) + "</p></div>";
    if (!st.linked) {
      if (!S.qbCust) { S.qbCust = "loading"; call("qbCustomers").then(function (r) { S.qbCust = r.customers; }).catch(function (e) { S.qbCust = []; toast(e.message); }).then(function () { keepScroll(render); }); }
      return '<div class="card qb-card"><div class="qb-h">' + qbLogo() + "<div><b>QuickBooks</b><div class=\"muted small\">Which QuickBooks customer is this project?</div></div>" + (S.me.money ? '<button class="btn sm" data-a="qbCreateCust" style="margin-left:auto">Create it in QuickBooks</button>' : "") + "</div>" +
        (S.qbCust === "loading" ? '<p class="muted small">Loading customers…</p>' : '<form class="form qb-link" data-form="qbLink"><select name="customer" required><option value="">Pick the customer</option>' + (S.qbCust || []).map(function (c) { return '<option value="' + esc(c.id) + '">' + esc(c.name) + "</option>"; }).join("") + '</select><button class="btn sm" type="submit">Link</button></form>') + "</div>";
    }
    return '<div class="card qb-card"><div class="qb-h">' + qbLogo() + '<div><b>From QuickBooks</b><div class="muted small">Bring an invoice in: the client sees the real QuickBooks PDF (only if they can see Contract & billing).</div></div><button class="link small" data-a="qbUnlink" style="margin-left:auto">Change customer</button></div>' +
      (st.invoices.length ? '<div class="qb-list">' + st.invoices.map(function (i) {
        return '<div class="qb-row"><div><b>#' + esc(i.number || i.id) + "</b> · " + money(i.total) + '<div class="muted small">' + (i.date ? day(i.date) : "") + (i.due ? " · due " + day(i.due) : "") + " · " + (i.balance === 0 ? "paid" : "open " + money(i.balance)) + "</div></div>" +
          '<button class="btn ' + (i.imported ? "ghost " : "") + 'sm" data-a="qbImport" data-q="' + esc(i.id) + '">' + (i.imported ? "Update" : "Bring in") + "</button></div>";
      }).join("") + "</div>" : '<p class="muted small">No invoices for this customer in QuickBooks yet.</p>') + "</div>";
  }
  function homeTeam() {
    if (!S.team) { loadHome("team"); return '<div class="loading" style="min-height:30vh">Loading the team…</div>'; }
    var admin = S.me && S.me.admin;
    return (admin ? '<div class="card va-card"><div><b>See what everyone else sees</b><div class="muted small">Preview the portal as #client, #architect or #crew to check nothing private is leaking.</div></div><button class="btn ghost sm" data-a="modal" data-m="viewAs">' + ICON.eye + " Preview</button></div>" : "") +
      qbSettings() + rtCard() + callCard() + feedbackCard() + '<div class="card" style="display:flex;flex-direction:column;gap:12px">' + S.team.map(function (x) {
      return '<div class="team-row' + (x.active ? "" : " off") + '">' + av(x.name, x.avatar, x.role) + '<div style="flex:1;min-width:0"><b style="font-weight:500">' + esc(x.name) + (x.email === S.me.email ? " (you)" : "") + '</b><div class="muted small">' + esc(x.email) + (x.since ? " · since " + day(x.since) : "") + "</div></div>" +
        '<span class="role-chips">' + roleChip(x.role, x.money) + (x.role === "crew" ? '<small class="muted">' + (x.projects || 0) + " project" + (x.projects === 1 ? "" : "s") + "</small>" : "") + "</span>" + (x.active ? "" : '<span class="pill bad">Access off</span>') +
        (admin && x.email !== S.me.email ? '<button class="btn ghost sm" data-a="modal" data-m="role" data-email="' + esc(x.email) + '" data-from="team">Change</button>' : "") +
        (admin && x.email !== S.me.email && x.role !== "admin" ? '<button class="btn ghost sm" data-a="teamOff" data-email="' + esc(x.email) + '" data-name="' + esc(x.name) + '">Remove</button>' : "") + "</div>";
    }).join("") + "</div>" +
      (admin ? '<form class="card form" data-form="team" style="margin-top:16px"><h3>Add someone to the Blue Sierra team</h3><p class="muted small">Team members see every project: chat (including #team), schedule, photos, contract and invoices. They log in with their email: the first time with a 6-digit code we email them, then with a PIN they choose.</p>' +
        '<div class="row2"><label class="f">Name<input type="text" name="name" required></label><label class="f">Email<input type="email" name="email" required></label></div>' +
        '<div class="f"><span>Role</span>' + rolePicker("staff", ["staff", "crew"], false) + "</div>" +
        '<p class="muted small">Clients and architects are added from each project’s People tab, so they only ever see their project.</p>' +
        '<label class="check-line"><input type="checkbox" name="invite" checked> Email them an invitation</label><div class="actions"><button class="btn" type="submit">Add</button></div></form>'
        : '<p class="muted small" style="margin-top:12px">Only Jesús can add or remove team members. Clients and architects are added from each project’s People tab.</p>');
  }
  function refreshList() { var seq = S.seq; call("listProjects").then(function (r) { if (seq === S.seq) { S.projects = r.projects; S.pins = r.pins || []; if (!S.pid) keepScroll(render); } }).catch(function () {}); }
  async function loadHome(what) {
    if (S.homeLoading === what) return; S.homeLoading = what; var seq = S.seq;
    try {
      if (what === "activity") { var r = await call("activity", { limit: 80 }); if (seq === S.seq) S.activity = r.items; }
      else { var t = await call("listTeam"); if (seq === S.seq) S.team = t.team; }
    } catch (e) { toast(e.message); if (what === "activity") S.activity = []; else S.team = []; }
    S.homeLoading = null; if (!S.pid) keepScroll(render);
  }
  /* Slack-style sidebar (wide screens): home, activity, team, every project with unread counts, and the open project's channels. */
  function hasSide() { return !!(S.projects && (staff() || S.projects.length > 1 || (S.me && S.me.ls))); }
  function sidebar() {
    var list = (S.projects || []).filter(function (p) { return p.status !== "archived" && p.status !== "deleted"; }), unreadAll = list.reduce(function (a, p) { return a + (p.unread || 0); }, 0);
    var item = function (a, label, on, n, extra) { return '<button class="s-item' + (on ? " on" : "") + '" ' + a + ">" + label + (n ? '<span class="count">' + n + "</span>" : "") + "</button>" + (extra || ""); };
    var home = !S.pid;
    return '<aside class="side" data-lenis-prevent><div class="s-top"><b>Menu</b><button class="icon-btn" data-a="sideTog" aria-label="Hide the sidebar">⟨</button></div>' + (staff() ? item('data-a="homeView" data-v="projects"', "Home", home && (S.home || "projects") === "projects") + item('data-a="homeView" data-v="activity"', "Activity", home && S.home === "activity", unreadAll) + item('data-a="homeView" data-v="ls"', "Maintenance", home && S.home === "ls") + (S.me.money ? item('data-a="homeView" data-v="finance"', "Finances", home && S.home === "finance") : "") + item('data-a="homeView" data-v="team"', "Team", home && S.home === "team")
        : item('data-a="home"', "All projects", home && S.home !== "ls") + (S.me && S.me.ls ? item('data-a="homeView" data-v="ls"', S.me.ls === "crew" ? "My route" : "My property", home && S.home === "ls") : "")) +
      '<div class="s-head">Projects</div>' + list.map(function (p) {
        var on = S.pid === p.id, chans = on && S.data ? '<div class="s-chans">' + myChannels().concat(myDms()).map(function (c) { var n = c === S.chan && S.tab === "messages" ? 0 : unreadIn(c); return '<button class="s-chan' + (S.tab === "messages" && S.chan === c ? " on" : "") + '" data-a="sideChan" data-c="' + esc(c) + '">' + esc(chanLabel(c)) + (n ? '<span class="count">' + n + "</span>" : "") + "</button>"; }).join("") + "</div>" : "";
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
    if (team() || (d.plans || []).length) tabs.splice(2, 0, ["plans", "Plans", (d.plans || []).filter(function (x) { return x.status === "ready"; }).length ? 0 : 0]);
    if (crew() || d.billing === false) tabs = tabs.filter(function (t) { return t[0] !== "invoices"; });
    if (S.me.money && !S.viewAs) tabs.splice(tabs.findIndex(function (t) { return t[0] === "checklist"; }), 0, ["money", "#money", 0]);
    if (staff()) tabs.push(["people", "People", 0]);
    var body = { overview: tabOverview, plans: tabPlans, schedule: tabSchedule, updates: tabUpdates, photos: tabPhotos, messages: tabMessages, invoices: tabInvoices, checklist: tabChecklist, money: S.me.money && !S.viewAs ? tabMoney : tabOverview, people: staff() ? tabPeople : tabOverview }[S.tab] || tabOverview;
    return (staff() || (S.projects || []).length > 1 ? '<button class="crumb link" data-a="home">← All projects</button>' : "") +
      '<section class="phead' + (p.lat != null ? " has-map" : "") + '" style="' + (p.lat != null ? "" : bg(p.cover)) + '">' + mapHtml(p) + todayHtml(p) + '<div class="phead-flex"><div><div class="eyebrow">' + esc([p.city, p.phase].filter(Boolean).join(" · ")) + "</div><h1>" + esc(p.name) + "</h1>" +
      (p.summary ? "<p>" + esc(p.summary) + "</p>" : "") + (function () { var cm = contractMath(); return cm.has ? '<div class="phead-money"><span><b>' + money(cm.total) + '</b> contract</span><span><b>' + pctOf(cm.paid, cm.total) + "%</b> paid</span>" + (cm.waiting ? "<span><b>" + money(cm.waiting) + "</b> due</span>" : "") + "</div>" : ""; })() + "</div>" +
      '<div class="ph-right">' + hereNow() + (staff() ? '<button class="btn light sm" data-a="modal" data-m="project" data-id="' + esc(p.id) + '">Edit project</button>' : "") + "</div></div></section>" +
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
      (crew() || d.billing === false ? stat("Plans", String(planSets().length), planSets().length ? "Latest: " + esc(planSets()[0].latest.set + " " + planSets()[0].latest.rev) : "None yet") : stat("Balance due", money(due), overdue ? '<span style="color:var(--bad)">' + overdue + " overdue</span>" : "Nothing overdue")) +
      stat("Target completion", p.target_date ? day(p.target_date) : "—", p.start_date ? "Started " + day(p.start_date) : "") + "</div>" +
      (cm.has ? '<div class="section-title"><h2>Contract</h2><button class="link" data-a="tab" data-t="invoices">Contract & billing</button></div><div class="card contract">' +
        '<div class="c-top"><div><div class="eyebrow">Contract total</div><div class="c-mid">' + money(cm.total) + '</div></div><div class="c-side"><div class="eyebrow">Paid so far</div><div class="c-mid">' + pctOf(cm.paid, cm.total) + "%</div></div></div>" + contractBar(cm, true) + "</div>" : "") +
      '<div class="section-title"><h2>' + (!asClient() ? "Waiting on the client" : "Waiting on you") + "</h2></div>" +
      (waiting ? '<div class="thread">' + waiting + "</div>" : '<div class="empty">' + (staff() ? "Nothing pending from the client." : "You're all caught up. Nothing needs your answer right now.") + "</div>") +
      pinnedHtml(d.timeline.filter(isPinned).concat(d.messages.filter(function (m) { return isPinned(m) && !isDm(m.channel); })), "") +
      (upcoming(30).length ? '<div class="section-title"><h2>Coming up</h2><button class="link" data-a="tab" data-t="schedule">Full schedule</button></div><div class="sch-list">' + upcoming(30).slice(0, 4).map(itemRow).join("") + "</div>" : "") +
      '<div class="section-title"><h2>Latest update</h2>' + (d.timeline.length ? '<button class="link" data-a="tab" data-t="updates">All updates</button>' : "") + "</div>" +
      (last ? post(last) : '<div class="empty">No updates yet.</div>') +
      (d.photos.length ? '<div class="section-title"><h2>Recent photos</h2><button class="link" data-a="tab" data-t="photos">All ' + d.photos.length + " photos</button></div>" +
        '<div class="strip">' + d.photos.slice(0, 6).map(function (ph, i) { return '<button class="ph" style="' + bg(ph.thumb) + '" data-a="lb" data-i="' + i + '" aria-label="' + esc(ph.caption || "Photo") + '"></button>'; }).join("") + "</div>" : "");
  }

  function post(t) {
    var photos = S.data.photos.filter(function (ph) { return t.photo_ids && t.photo_ids.split(",").indexOf(ph.id) > -1; });
    var who = ((S.data.members) || []).filter(function (mb) { return mb.name === t.author; })[0] || {}, pinned = /^(yes|true)$/i.test(t.pinned || "");
    return '<article class="card post' + (pinned ? " pinned" : "") + '" id="up-' + esc(t.id) + '"><div class="post-head">' + av(t.author, t.avatar || who.avatar, who.role, "", t.akey || who.key) + '<div style="flex:1"><b style="font-weight:500">' + esc(t.author) + '</b><div class="muted small">' + (pinned ? "📌 Pinned · " : "") + day(t.at) + (t.emailed ? " · emailed to the client" : "") + "</div>" + (t.aud && t.aud.length ? '<div class="tags">' + tagChips(t.aud) + "</div>" : "") + "</div>" +
      (staff() ? '<div class="post-tools"><button class="icon-btn" data-a="pin" data-kind="update" data-id="' + esc(t.id) + '" title="' + (pinned ? "Unpin" : "Pin to the top") + '">📌</button><button class="icon-btn" data-a="delUpdate" data-id="' + esc(t.id) + '" data-ph="' + (t.photo_ids ? 1 : 0) + '" title="Delete update">🗑</button></div>' : "") + "</div>" +
      (t.text ? '<div class="post-text">' + esc(t.text) + "</div>" : "") +
      (photos.length ? '<div class="photo-grid">' + photos.map(function (ph) { return '<button class="ph" style="' + bg(ph.thumb) + '" data-a="lb" data-i="' + S.data.photos.indexOf(ph) + '" aria-label="' + esc(ph.caption || "Photo") + '"></button>'; }).join("") + "</div>" : "") + "</article>";
  }

  function photoPicker(label) {
    return '<div class="previews">' + S.pending.map(function (f, i) { return '<div style="' + bg(f.data) + '"><button type="button" class="icon-btn" style="position:absolute;top:-8px;right:-8px;background:#fff;width:24px;height:24px" data-a="unpick" data-i="' + i + '" aria-label="Remove">×</button></div>'; }).join("") + "</div>" +
      '<span class="btn ghost sm file-btn">' + label + '<input type="file" accept="image/*" multiple data-pick="photos"></span>';
  }

  function isPinned(x) { return x.pinned === true || /^(yes|true)$/i.test(x.pinned || ""); }
  /* Pinned things, at the top of the overview and of each chat channel. */
  function pinnedHtml(list, where) {
    if (!list.length) return "";
    return '<div class="pins"><div class="pins-h">📌 Pinned</div>' + list.map(function (x) {
      var isUp = where === "update" || x.photo_ids != null && x.channel == null, txt = String(x.text || "").split("\n")[0];
      return '<button class="pin-row" data-a="' + (isUp ? "pinUpOpen" : "pinMsgOpen") + '" data-id="' + esc(x.id) + '"><b>' + esc(x.author) + '</b><span>' + esc(txt.slice(0, 160) || "Photos") + '</span><small class="muted">' + day(x.at) + "</small></button>";
    }).join("") + "</div>";
  }
  function tabUpdates() {
    var d = S.data;
    return (staff() ? '<form class="card composer" data-form="update"><h3>Post an update</h3><textarea name="text" placeholder="What happened on site? What\'s next?  Tip: type #team, #client, #crew or #private"></textarea>' +
      '<div class="who-sees"><span class="muted small">Who sees it</span>' + tagPicker("aud", [], ["client", "architect", "team", "crew", "private"]) + '<span class="muted small hint">None picked = everyone on the project</span></div>' +
      photoPicker("Add photos") + '<label class="check-line"><input type="checkbox" name="notify" checked> Email the client about this update (only when the client can see it)</label><div class="actions"><button class="btn" type="submit">Post update</button></div></form>' : "") +
      '<div class="section-title"><h2>Updates</h2><span class="muted small">' + d.timeline.length + "</span></div>" +
      (d.timeline.length ? '<div class="feed">' + d.timeline.filter(isPinned).concat(d.timeline.filter(function (t) { return !isPinned(t); })).map(post).join("") + "</div>" : '<div class="empty">No updates yet.</div>');
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
  var CH_INFO = { client: ["client", "Client, architect and Blue Sierra"], architect: ["architect", "The architect and Blue Sierra. The client doesn't see this."], team: ["team", "Blue Sierra only (admin and project managers). The crew, client and architect never see this."], crew: ["crew", "The field crew and Blue Sierra. The client and architect never see this."] };
  /* Permission #tags: who sees an update, a checklist item, or Contract & billing. */
  var TAGS = { client: "Client, architect and Blue Sierra", architect: "Architect and Blue Sierra", team: "Blue Sierra only", crew: "Field crew and Blue Sierra", private: "Admin and project managers only" };
  function tagChips(list) { return (list || []).map(function (a) { return '<span class="tg tg-' + esc(a) + '" title="' + esc(TAGS[a] || "") + '">#' + esc(a) + "</span>"; }).join(""); }
  function tagPicker(name, sel, allowed) {
    sel = sel || [];
    return '<div class="tag-pick">' + allowed.map(function (a) { return '<label class="tg-opt o-' + a + '" title="' + esc(TAGS[a]) + '"><input type="checkbox" name="' + name + '" value="' + a + '"' + (sel.indexOf(a) > -1 ? " checked" : "") + "><span>#" + a + "</span></label>"; }).join("") + "</div>";
  }
  /* Roles are #tags too: the same colors everywhere (team list, people, the role picker). */
  var ROLES = {
    client: ["client", "Client", "Only their project: updates, photos, schedule, the #client chat and their to-dos. Invoices only if billing is tagged #client."],
    architect: ["architect", "Architect", "Only their project, like the client, plus the #architect chat and the plans you share with them."],
    crew: ["crew", "Field crew", "Only the projects you add them to: plans, schedule, photos and the #crew chat. No money, and they can't change the schedule."],
    staff: ["team", "Team", "Blue Sierra project manager or office: every project, the #team chat, contract and billing."],
    admin: ["admin", "Admin", "Everything, plus permissions, #money, deleting projects and starting them over."]
  };
  function roleChip(role, money) { var r = ROLES[role] || ROLES.client; return '<span class="tg tg-' + r[0] + '" title="' + esc(r[1] + ": " + r[2]) + '">#' + r[0] + "</span>" + (money && role !== "admin" ? '<span class="tg tg-money" title="Sees #money: what each job costs and makes">#money</span>' : ""); }
  function rolePicker(sel, allowed, money) {
    var m = money !== undefined;
    return '<div class="role-pick"><div class="tag-pick">' + allowed.map(function (r) { return '<label class="tg-opt o-' + ROLES[r][0] + '"><input type="radio" name="role" value="' + r + '"' + (sel === r ? " checked" : "") + ' required><span>#' + ROLES[r][0] + "</span></label>"; }).join("") +
      (m ? '<label class="tg-opt o-money rp-money" title="Sees what each job costs and makes"><input type="checkbox" name="money"' + (money ? " checked" : "") + "><span>#money</span></label>" : "") + "</div>" +
      allowed.map(function (r) { return '<p class="rp-desc rp-' + r + '"><b>#' + ROLES[r][0] + "</b> · " + esc(ROLES[r][2]) + "</p>"; }).join("") +
      (m ? '<p class="rp-desc rp-mdesc"><b>#money</b> · Also sees the #money tab: payroll, materials, bills due and profit for every job, straight from QuickBooks. Only for #team. Handle with care.</p>' : "") + "</div>";
  }
  /* A tiny face that says who did something (and when). */
  function foot(f, verb, cls) { if (!f || !f.name) return ""; return '<span class="foot ' + (cls || "") + '" title="' + esc(verb + " " + f.name + (f.at ? " · " + day(f.at) : "")) + '">' + av(f.name, f.avatar, f.role, "xs", f.key) + "</span>"; }
  var EMOJI = ["👍", "✅", "❤️", "👀", "🎉", "🙏"];
  function myChannels() { return (S.data && S.data.channels) || ["client"]; }
  function isDm(ch) { return /^dm:/.test(String(ch || "")); }
  function dmWith(ch) { var ks = String(ch).slice(3).split("-"), other = ks[0] === S.me.key ? ks[1] : ks[0]; return ((S.data && S.data.members) || []).filter(function (m) { return m.key === other; })[0] || { name: "Someone", key: other }; }
  function dmOk(role) { return staff() || role === "admin" || role === "staff"; }
  function dmKey(otherKey) { return "dm:" + [S.me.key, otherKey].sort().join("-"); }
  function myDms() { var seen = {}; (S.data.messages || []).forEach(function (m) { if (isDm(m.channel) && dmWith(m.channel).role) seen[m.channel] = 1; }); if (isDm(S.chan)) seen[S.chan] = 1; return Object.keys(seen); }
  function chanLabel(ch) { return isDm(ch) ? "@ " + dmWith(ch).name : "# " + CH_INFO[ch][0]; }
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
  var EV = { invoice: ["receipt", "Invoice"], paid: ["paid", "Payment received"], update: ["camera", "Project update"], change: ["pen", "Change order"], todo: ["todo", "New to-do"], done: ["party", "Done"], date: ["calendar", "New date"], call: ["video", "Video call"], plan: ["ruler", "Plans"] };
  /* Something happened (an invoice, an update, a to-do): a colored card the client can't miss, with a button straight to it. */
  function eventHtml(m, opts) {
    var ev = EV[m.status] || ["spark", "Update"], lines = String(m.text || "").split("\n"), canDel = S.me && S.me.admin;
    var selEv = S.sel && !opts.inThread && S.me && S.me.admin;
    return '<div class="ev ev-' + esc(m.status || "x") + (selEv ? " sel-able" : "") + (selEv && S.sel[m.id] ? " picked" : "") + '" id="m-' + esc(m.id) + '"' + (selEv ? ' data-a="selPick" data-id="' + esc(m.id) + '"' : "") + '><div class="ev-ico" aria-hidden="true">' + ICON[ev[0]] + '</div><div class="ev-body">' +
      '<div class="ev-top"><span class="ev-kind">' + ev[1] + '</span><span class="muted small">' + day(m.at) + "</span>" +
      '<span class="m-tools">' + (!opts.inThread ? '<button class="link small" data-a="thread" data-id="' + esc(m.id) + '">Ask about this</button>' : "") + (canDel ? '<button class="link small" data-a="delMsg" data-id="' + esc(m.id) + '">Delete</button>' : "") + "</span></div>" +
      '<div class="ev-line"><b>' + esc(m.author) + "</b> " + esc(lines[0]) + "</div>" + (lines[1] ? '<div class="ev-detail">' + esc(lines.slice(1).join(" ")).replace(/\d{4}-\d{2}-\d{2}/g, function (d) { return day(d); }) + "</div>" : "") +
      (m.status === "call" && m.ref ? '<div class="meet-row"><span class="meet-code" title="Meeting code">' + esc(meetCode(m.ref)) + '</span><button class="link small" data-a="copyCode" data-c="' + esc(meetCode(m.ref)) + '">Copy code</button></div>' + (!API ? '<div class="muted small">Preview: this is a sample code, not a real meeting.</div>' : "") : "") +
      (m.ref && /^call:/.test(m.ref) ? '<button class="ev-btn" data-a="joinCall" data-room="' + esc(m.ref.slice(5)) + '" data-p="' + esc(S.pid || "") + '">' + ICON.video + " Join the call →</button>" :
       m.ref && /^meet:https:\/\/meet\.google\.com\//.test(m.ref) ? '<a class="ev-btn" href="' + esc(meetUrl(m.ref)) + '" target="' + (PHONE ? "_blank" : "bsp-meet") + '" rel="noopener">' + ICON.video + " Join the call →</a>" :
       m.ref ? '<button class="ev-btn" data-a="ref" data-ref="' + esc(m.ref) + '">' + ({ invoice: "See the invoice", update: "See the update", co: "See the contract", check: "See the checklist", sched: "See the schedule", meet: "Join the call 📹", plan: "See what changed" }[m.ref.split(":")[0]] || "Open") + " →</button>" : "") +
      reactHtml(m) + (!opts.inThread && opts.replies && opts.replies.length ? '<button class="m-replies" data-a="thread" data-id="' + esc(m.id) + '">' + opts.replies.length + " repl" + (opts.replies.length > 1 ? "ies" : "y") + "</button>" : "") +
      "</div></div>";
  }
  /* Jump to the thing an event or notification points at, and make it glow for a moment. */
  function openRef(ref, pid) {
    if (/^meet:/.test(ref)) { if (PHONE) { location.href = meetUrl(ref); } else window.open(meetUrl(ref), "bsp-meet", "width=1180,height=780"); return; }
    if (/^plan:/.test(ref)) { S.bell = false; S.planOpen = ref.slice(5); return go(pid || S.pid, "plans"); }
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
    var selOk = S.sel && !opts.inThread && (m.mine || (S.me && S.me.admin));
    return '<div class="msg' + (m.mine ? " mine" : "") + (m.pending ? " pending" : "") + (m.mention ? " ping" : "") + (selOk ? " sel-able" : "") + (selOk && S.sel[m.id] ? " picked" : "") + '" id="m-' + esc(m.id) + '"' + (selOk ? ' data-a="selPick" data-id="' + esc(m.id) + '"' : "") + ">" + '<button class="av-btn" data-a="person" data-k="' + esc(m.akey || "") + '" aria-label="' + esc(m.author) + '">' + av(m.author, m.avatar, m.role, "", m.akey) + "</button>" + '<div class="bubble ' + (q ? "question" : "") + '">' +
      '<div class="who-line"><b>' + esc(m.author) + "</b>" + roleTag(m.role) + "<span>" + day(m.at) + "</span>" + (m.via === "email" ? '<span class="pill">by email</span>' : "") +
      (q ? (m.status === "open" ? '<span class="pill gold">Question · waiting</span>' : '<span class="pill ok">Answered</span>') : "") +
      '<span class="m-tools">' + (!opts.inThread ? '<button class="link small" data-a="thread" data-id="' + esc(m.id) + '">Reply in thread</button>' : "") +
      (staff() && !opts.inThread ? '<button class="link small" data-a="pin" data-kind="msg" data-id="' + esc(m.id) + '">' + (isPinned(m) ? "Unpin" : "Pin") + "</button>" : "") +
      (canDel ? '<button class="link small" data-a="delMsg" data-id="' + esc(m.id) + '">Delete</button>' : "") + "</span></div>" + (isPinned(m) ? '<div class="pin-tag">📌 Pinned</div>' : "") +
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
    var ph = root ? "Reply in thread…" : isDm(ch) ? "Private message to " + dmWith(ch).name + " (only the two of you see this)" : ch === "team" ? "Message the team (only Blue Sierra sees this)" : ch === "architect" ? "Message the architect" : staff() ? "Message the client and architect" : "Message Blue Sierra";
    return '<form class="card composer" data-form="chat" data-ch="' + ch + '"' + (root ? ' data-root="' + esc(root) + '"' : "") + '><div class="mention-wrap"><textarea name="text" data-chat placeholder="' + esc(ph) + '"></textarea></div>' +
      (pend.length ? '<div class="att-list">' + pend.map(function (f, i) { return '<span class="att">' + (f.mime === "application/pdf" ? "PDF · " : "") + esc(f.name) + '<button type="button" data-a="unatt" data-k="' + key + '" data-i="' + i + '" aria-label="Remove">×</button></span>'; }).join("") + "</div>" : "") +
      '<div class="actions" style="justify-content:space-between;align-items:center"><div class="c-left"><label class="btn ghost sm attach">Attach<input type="file" data-att="' + key + '" accept="image/jpeg,image/png,image/webp,application/pdf" multiple hidden></label>' +
      (staff() && ch === "client" && !root && !isDm(ch) ? '<label class="check-line small"><input type="checkbox" name="question"> Ask as a question</label>' : "") +
      '<label class="check-line small imp" title="Chat is live. Important also sends an email."><input type="checkbox" name="important"> ⚑ Important (email too)</label><span class="muted small hint">Enter to send · Shift+Enter for a new line · @ to mention</span></div>' +
      '<button class="btn" type="submit">Send</button></div></form>';
  }
  function tabMessages() {
    var chans = myChannels(); if (chans.indexOf(S.chan) < 0 && !isDm(S.chan)) S.chan = chans[0];
    var ch = S.chan, list = chanMsgs(ch), answers = {}, replies = {};
    list.forEach(function (m) { if (m.kind === "answer") (answers[m.question_id] = answers[m.question_id] || []).push(m); else if (m.thread_id) (replies[m.thread_id] = replies[m.thread_id] || []).push(m); });
    var top = list.filter(function (m) { return m.kind !== "answer" && !m.thread_id; }), readAt = S.readMark && S.readMark[ch] != null ? S.readMark[ch] : ((S.data.reads || {})[ch] || ""), lastDay = "", newShown = false;
    var html = top.map(function (m) {
      var d = String(m.at).slice(0, 10), sep = d !== lastDay ? '<div class="day-sep"><span>' + day(d) + "</span></div>" : ""; lastDay = d;
      var nw = !newShown && !m.mine && m.at > readAt && readAt !== "" ? (newShown = true, '<div class="new-sep"><span>New</span></div>') : "";
      return sep + nw + msgHtml(m, { replies: replies[m.id], answers: answers[m.id] });
    }).join("");
    var all = chans.concat(myDms());
    var bar = '<div class="chans">' + all.map(function (c) { var n = c === ch ? 0 : unreadIn(c); return '<button class="chan' + (c === ch ? " on" : "") + (isDm(c) ? " dm" : "") + '" data-a="chan" data-c="' + esc(c) + '">' + esc(chanLabel(c)) + (n ? '<span class="count">' + n + "</span>" : "") + "</button>"; }).join("") +
      '<button class="chan add" data-a="modal" data-m="dm" title="Message one person privately">＋ Private message</button></div>';
    var head = isDm(ch) ? '<h2>@ ' + esc(dmWith(ch).name) + '</h2><span class="muted small">🔒 Private: only you and ' + esc(first(dmWith(ch).name)) + " can see this.</span>"
      : "<h2># " + CH_INFO[ch][0] + '</h2><span class="muted small">' + CH_INFO[ch][1] + (ch === "client" ? (staff() ? " Live chat. People who are away get one email at most every few hours; ⚑ Important always emails. Email replies show up here." : " Live chat. Replies by email also show up here.") : "") + "</span>";
    var pinsHere = list.filter(function (m) { return isPinned(m) && !m.thread_id; });
    var canClear = isDm(ch) || (S.me && S.me.admin);
    return bar + '<div class="chan-head"><div class="ch-title">' + head + '</div><div class="ch-acts">' +
      '<button class="ch-btn call" data-a="call" title="Start a video call here">' + ICON.video + "<span>Call</span></button>" +
      (S.sel ? "" : '<button class="ch-btn" data-a="selStart" title="Select messages to delete">' + ICON.todo + "<span>Select</span></button>" + (canClear ? '<button class="ch-btn" data-a="clearChat" title="Delete every message here">' + ICON.x + "<span>Clear</span></button>" : "")) + "</div></div>" +
      (S.sel ? '<div class="sel-bar"><span>' + (Object.keys(S.sel).length ? Object.keys(S.sel).length + " selected" : "Tap your messages to select them" + (S.me && S.me.admin ? " (you can pick any)" : "")) + '</span><button class="btn ghost sm" data-a="selCancel">Cancel</button><button class="btn sm danger-btn" data-a="selDelete"' + (Object.keys(S.sel).length ? "" : " disabled") + ">Delete</button></div>" : "") +
      pinnedHtml(pinsHere, "msg") + (html ? '<div class="thread chat">' + html + "</div>" : '<div class="empty">' + (isDm(ch) ? "Start a private conversation with " + esc(first(dmWith(ch).name)) + "." : "No messages in #" + CH_INFO[ch][0] + " yet. Say hi.") + "</div>") +
      '<div class="typing-line" aria-live="polite"></div><div class="reply-bar">' + composer(ch) + "</div>";
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
  /* Who can be called from this channel: everyone who can read it, except you. */
  function callable(ch) {
    return ((S.data && S.data.members) || []).filter(function (mb) {
      if (!mb.key || mb.key === S.me.key) return false;
      return isDm(ch) ? mb.key === dmWith(ch).key : ch === "team" ? ["admin", "staff", "crew"].indexOf(mb.role) > -1 : ch === "architect" ? ["admin", "staff", "architect"].indexOf(mb.role) > -1 : mb.role !== "crew";
    });
  }
  /* Open the call window right away (browsers only allow pop-ups straight from a click), then point it at the Meet link. */
  var PHONE = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent) || (navigator.maxTouchPoints > 1 && /Mac/.test(navigator.platform));
  /* Start a call. On a computer the Meet tab opens right away; on a phone the browser can't hand a link to the Meet app
     by itself, so we show a big Join button (a real tap opens the app). */
  function startCallNow(btn, keys, pid, ch, label) {
    pid = pid || S.pid; ch = ch || S.chan;
    var inPortal = S.me && S.me.calls === "portal";
    var w = inPortal || PHONE ? null : window.open("", "bsp-meet", "width=1180,height=780"); if (w) try { w.document.write('<p style="font:16px sans-serif;padding:30px">Starting your Google Meet…</p>'); } catch (e) {}
    return run(btn, async function () {
      try { var r = await call("startCall", { projectId: pid, channel: ch, invite: keys }); }
      catch (e) { if (w) w.close(); throw e; }
      if (r.embed) { if (w) w.close(); callWindow(r.url, label || "Calling…"); }
      else if (w) { w.location = r.url; toast("Calling " + (label || "") + "… Google Meet opened in a new window."); }
      else { S.modal = { type: "callReady", url: r.url, code: r.code }; keepScroll(render); }
      loadFeed(pid);
    });
  }
  function meetCode(ref) { return String(ref || "").replace(/^meet:/, "").split("/").pop().split("?")[0]; }
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
      var ok = isDm(ch) ? mb.key === dmWith(ch).key : ch === "team" ? ["admin", "staff", "crew"].indexOf(mb.role) > -1 : ch === "architect" ? ["admin", "staff", "architect"].indexOf(mb.role) > -1 : mb.role !== "crew";
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

  /* ---------------- who's around: presence, the people panel, waves ---------------- */
  var STATE_TXT = { online: "Online", busy: "Busy", away: "Away", offline: "Offline" };
  function presOf(key) {
    if (S.me && key === S.me.key) return { state: S.myStatus === "busy" ? "busy" : S.myStatus === "away" ? "away" : "online" };
    return ((S.presence && S.presence.people) || []).filter(function (x) { return x.key === key; })[0];
  }
  function presDot(key) { var p = presOf(key); return p ? '<i class="pres p-' + p.state + '" title="' + STATE_TXT[p.state] + '"></i>' : ""; }
  var TABN = { overview: "Overview", plans: "Plans", schedule: "Schedule", updates: "Updates", photos: "Photos", messages: "Chat", invoices: "Contract", checklist: "Checklist", money: "#money", people: "People" };
  function ago(t) { if (!t) return ""; var m = Math.round((Date.now() - t) / 60000); return m < 60 ? m + " min ago" : m < 1440 ? Math.round(m / 60) + " h ago" : Math.round(m / 1440) + " d ago"; }
  async function ping() {
    if (!S.token || !S.me || S.viewAs) return;
    try { var r = await call("presence", { pid: S.pid || "", tab: S.pid ? S.tab : "", status: S.myStatus || "", hidden: document.visibilityState !== "visible" });
      S.presence = r; if (!S.myStatus && r.me) S.myStatus = r.me.s;
      if (r.pulse) onPulse(r.pulse);
      if (r.ver) onVersion(r.ver);
      patch(".people-btn", peopleButton()); patch(".here-now", hereNow());
      if (S.peopleOpen) { var pl = root.querySelector(".pp-list"), lh = ppList(); if (pl && pl.dataset.h !== String(scHash(lh))) { pl.innerHTML = lh; pl.dataset.h = scHash(lh); } }
    } catch (e) {}
  }
  // Every 20 s while you're looking, every minute in the background (so other devices hear about new messages quickly).
  var tick = 0; setInterval(function () { tick++; if (document.visibilityState === "visible" || tick % 3 === 0) ping(); }, 20000);
  /* Something new from someone else: pop a card, update the bell and the chat, and a device notification if allowed. */
  function onPulse(p) {
    document.title = (p.unread ? "(" + p.unread + ") " : "") + document.title.replace(/^\(\d+\) /, "");
    if (!p.id) return;
    if (S.pulseId == null) { S.pulseId = p.id; return; }        // first look: just remember where we are
    if (p.id === S.pulseId) return; S.pulseId = p.id;
    var here = S.pid === p.pid && S.tab === "messages" && S.chan === p.channel && document.visibilityState === "visible";
    if (S.pid === p.pid && S.data) refresh();
    loadNotif(); refreshList();
    if (here) return;
    var where = p.dm ? "privately" : p.kind === "event" ? "" : "in #" + p.channel, line = p.kind === "event" ? p.author + " " + p.text : p.text;
    showPop(p, where, line);
    try {
      if (document.visibilityState !== "visible" && window.Notification && Notification.permission === "granted") {
        var n = new Notification(p.author + (p.dm ? " (private)" : " · " + p.project), { body: line, tag: "bsp-" + p.id });
        n.onclick = function () { window.focus(); S.wantChan = p.channel; S.openThread = p.thread_id || null; go(p.pid, "messages"); n.close(); };
      }
    } catch (e) {}
  }
  /* The little card that slides in when someone writes. One at a time: a newer message updates it in place.
     Tap to open, × or swipe it up to dismiss; it waits while your pointer is on it. */
  var popTimer = null;
  function showPop(p, where, line) {
    var pop = document.getElementById("bsp-pop"), fresh = !pop;
    if (fresh) { pop = document.createElement("div"); pop.id = "bsp-pop"; pop.className = "pop"; pop.setAttribute("role", "status"); root.appendChild(pop); }
    pop.classList.remove("out", "bump"); if (!fresh) { void pop.offsetWidth; pop.classList.add("bump"); }
    pop.innerHTML = '<button class="pop-main" data-a="actOpen" data-p="' + esc(p.pid) + '" data-c="' + esc(p.channel) + '" data-th="' + esc(p.thread_id || "") + '">' + av(p.author, p.avatar, "", "", p.akey) +
      '<span class="pop-txt"><span class="pop-top"><b>' + esc(p.author) + "</b>" + (where ? " " + (p.dm ? ICON.lock + " " : "") + esc(where) : "") + ((S.projects || []).length > 1 ? ' <small>· ' + esc(p.project) + "</small>" : "") + "</span><span>" + esc(line) + '</span></span></button><button class="pop-x" aria-label="Dismiss">' + ICON.x + '</button><i class="pop-bar"></i>';
    pop.querySelector(".pop-x").onclick = function (e) { e.stopPropagation(); hidePop(); };
    pop.querySelector(".pop-main").addEventListener("click", function () { hidePop(); });
    var bar = pop.querySelector(".pop-bar"); bar.style.animation = "none"; void bar.offsetWidth; bar.style.animation = "";
    clearTimeout(popTimer); popTimer = setTimeout(hidePop, 8000);
    pop.onmouseenter = function () { clearTimeout(popTimer); pop.classList.add("hold"); };
    pop.onmouseleave = function () { pop.classList.remove("hold"); popTimer = setTimeout(hidePop, 3000); };
    var y0 = null; pop.onpointerdown = function (e) { y0 = e.clientY; }; pop.onpointerup = function (e) { if (y0 != null && y0 - e.clientY > 30) hidePop(); y0 = null; };
  }
  function hidePop() { var pop = document.getElementById("bsp-pop"); clearTimeout(popTimer); if (!pop || pop.classList.contains("out")) return; pop.classList.add("out"); setTimeout(function () { if (pop.classList.contains("out")) pop.remove(); }, 320); }
  document.addEventListener("visibilitychange", function () { ping(); });
  var pingSoon = null; function pingLater() { clearTimeout(pingSoon); pingSoon = setTimeout(ping, 1200); }
  /* Swap one piece of the page only when it really changed (no flicker every 20 seconds). */
  function patch(sel, html) { var el = root.querySelector(sel), h = String(scHash(html)); if (!el || el.dataset.h === h) return; var t = document.createElement("div"); t.innerHTML = html; var n = t.firstElementChild; n.dataset.h = h; el.replaceWith(n); }
  function peopleButton() {
    var on = ((S.presence && S.presence.people) || []).filter(function (x) { return x.state === "online" || x.state === "busy"; });
    return '<button class="people-btn' + (S.peopleOpen ? " on" : "") + (on.length ? " has" : "") + '" data-a="people" aria-label="Who\'s around: ' + on.length + ' online" title="Who\'s around">' +
      (on.length ? '<span class="faces">' + on.slice(0, 3).map(function (x) { return av(x.name, x.avatar, x.role, "xs", ""); }).join("") + '</span><b>' + on.length + "</b>" : ICON.people) + '<i class="live"></i></button>';
  }
  function hereNow() {
    var here = ((S.presence && S.presence.people) || []).filter(function (x) { return x.pid === S.pid && x.state !== "offline"; });
    return '<div class="here-now">' + (here.length ? here.slice(0, 5).map(function (x) { return '<button class="hn" data-a="person" data-k="' + esc(x.key) + '" title="' + esc(x.name + " · " + STATE_TXT[x.state] + (x.tab ? " · on " + (TABN[x.tab] || x.tab) : "")) + '">' + av(x.name, x.avatar, x.role, "sm", x.key) + "</button>"; }).join("") + '<span>here now</span>' : "") + "</div>";
  }
  function sharedPid(x) { return x.shared.indexOf(S.pid) > -1 ? S.pid : x.shared[0]; }
  function ppList() {
    var list = ((S.presence && S.presence.people) || []).slice().sort(function (a, b) { var o = { online: 0, busy: 1, away: 2, offline: 3 }; return o[a.state] - o[b.state] || b.last - a.last; });
    var row = function (x) {
      var pid = sharedPid(x), where = x.state !== "offline" && x.project ? (x.pid === S.pid ? "here" : x.project) + (x.tab ? " · " + (TABN[x.tab] || x.tab) : "") : "";
      var st = x.inCall ? "In a call" : STATE_TXT[x.state] + (x.state === "offline" && x.last ? " · " + ago(x.last) : "");
      return '<div class="pp-row s-' + x.state + (S.peopleFocus === x.key ? " focus" : "") + '" id="pp-' + esc(x.key) + '">' + av(x.name, x.avatar, x.role, "", x.key) +
        '<div class="pp-who"><b>' + esc(x.name) + '</b><small><span class="pp-role">' + esc(roleName(x.role)) + "</span> · " + esc(st) + (where ? ' · <span class="pp-where">' + esc(where) + "</span>" : "") + "</small></div>" +
        (pid ? '<div class="pp-act"><button class="pp-btn hi" data-a="wave" data-k="' + esc(x.key) + '" data-p="' + esc(pid) + '" title="Say hi" aria-label="Say hi to ' + esc(x.name) + '">' + ICON.wave + '</button><button class="pp-btn" data-a="dmGo" data-k="' + esc(x.key) + '" data-p="' + esc(pid) + '" title="Message privately" aria-label="Message ' + esc(x.name) + '">' + ICON.chat + "</button>" +
          (pid ? '<button class="pp-btn" data-a="callPerson" data-k="' + esc(x.key) + '" data-p="' + esc(pid) + '" title="Video call" aria-label="Call ' + esc(x.name) + '">' + ICON.video + "</button>" : "") + "</div>" : "") + "</div>";
    };
    if (!S.presence) return '<div class="pp-empty">Checking who\'s around…</div>';
    var groups = [["online", "Online"], ["busy", "Busy"], ["away", "Away"], ["offline", "Offline"]].map(function (g) { var l = list.filter(function (x) { return x.state === g[0]; }); return l.length ? '<div class="pp-sec">' + g[1] + " <span>" + l.length + "</span></div>" + l.map(row).join("") : ""; }).join("");
    return groups || '<div class="pp-empty">Nobody else is on your projects yet.</div>';
  }
  function peoplePanel() {
    var st = S.myStatus || "available", lh = ppList();
    return '<div class="pp-bg" data-a="peopleClose"></div><aside class="pp-panel" data-lenis-prevent role="dialog" aria-label="Who\'s around"><div class="pp-head"><div><h3>Who\'s around</h3><span class="muted small">' + (S.pid ? "Wave, message or call anyone, right from here." : "Everyone on your projects.") + '</span></div><button class="icon-btn" data-a="peopleClose" aria-label="Close">' + ICON.x + "</button></div>" +
      '<div class="pp-me">' + av(S.me.name, S.me.avatar, S.me.role, "", S.me.key) + '<div class="pp-status">' + [["available", "Available"], ["busy", "Busy"], ["away", "Away"]].map(function (o) { return '<button class="st-chip' + (st === o[0] ? " on" : "") + '" data-a="myStatus" data-v="' + o[0] + '"><i class="sd sd-' + o[0] + '"></i>' + o[1] + "</button>"; }).join("") + "</div></div>" +
      '<div class="pp-list" data-h="' + scHash(lh) + '">' + lh + "</div></aside>";
  }

  /* ---------------- the site map behind the project header (OpenStreetMap, darkened) ---------------- */
  function mapHtml(p) {
    if (p.lat == null || p.lon == null) { if (staff() && p.address) findSite(p); return ""; }
    var z = 17, n = Math.pow(2, z), lat = p.lat * Math.PI / 180, fx = (p.lon + 180) / 360 * n, fy = (1 - Math.log(Math.tan(lat) + 1 / Math.cos(lat)) / Math.PI) / 2 * n, out = [];
    for (var tx = Math.floor(fx) - 4; tx <= Math.floor(fx) + 3; tx++) for (var ty = Math.floor(fy) - 2; ty <= Math.floor(fy) + 2; ty++)
      out.push('<img src="https://tile.openstreetmap.org/' + z + "/" + tx + "/" + ty + '.png" alt="" loading="lazy" referrerpolicy="strict-origin-when-cross-origin" style="left:calc(var(--mx) + ' + Math.round((tx - fx) * 256) + "px);top:calc(var(--my) + " + Math.round((ty - fy) * 256) + 'px)">');
    // The pin: gold, with the project's cover photo inside (or the Blue Sierra mark), and a soft pulse where the property is.
    var pin = '<span class="ph-pin"><i class="pulse"></i><svg viewBox="0 0 48 60" aria-hidden="true"><path d="M24 58C24 58 4 36.5 4 22.5a20 20 0 0 1 40 0C44 36.5 24 58 24 58Z" fill="#c39a5a" stroke="#fff" stroke-width="2.5"/></svg>' +
      '<span class="pin-face"' + (p.cover ? ' style="' + bg(p.cover) + '"' : "") + ">" + (p.cover ? "" : '<svg viewBox="0 0 80 33" aria-hidden="true"><path d="M13.3 21.4c-.1.1-.3.1-.4 0L.4 8.8C.3 8.7 0 8.8 0 9v23.5c0 .1.1.2.3.2h25.6V8.3c-.1 0-.2 0-.2.1L13.3 21.4ZM56 7.4c-.1-.1-.2-.1-.3 0L42.1 21.4c-.1.1-.2.1-.3 0L30.3 8.4c-.1-.1-.1-.1-.2-.1v24.4h16.5l9.1-10.4c.1-.1.3-.1.3 0l9.9 10.4h13.1c.2 0 .3-.3.2-.5L56 7.4Z" fill="#111"/></svg>') + "</span></span>";
    return '<div class="ph-map" aria-hidden="true">' + out.join("") + "</div>" + pin + '<a class="ph-osm" href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">© OpenStreetMap</a>';
  }
  /* Team only, once per project: find the address on the map and save it, so nobody else's browser ever has to look it up. */
  async function findSite(p) {
    S.siteTried = S.siteTried || {}; if (S.siteTried[p.id]) return; S.siteTried[p.id] = 1;
    try {
      var q = [p.address, p.city, "CA"].filter(Boolean).join(", ");
      var r = await (await fetch("https://nominatim.openstreetmap.org/search?format=json&limit=1&countrycodes=us&q=" + encodeURIComponent(q))).json();
      if (!r || !r[0]) return;
      var lat = +(+r[0].lat).toFixed(6), lon = +(+r[0].lon).toFixed(6);
      await call("saveProject", { project: { id: p.id, name: p.name, lat: lat, lon: lon } });
      if (S.data && S.data.project.id === p.id) { S.data.project.lat = lat; S.data.project.lon = lon; keepScroll(render); }
    } catch (e) {}
  }

  /* ---------------- today: date, weather where the job is, and your luck ---------------- */
  var WX = { 0: ["☀️", "Clear"], 1: ["🌤️", "Mostly clear"], 2: ["⛅", "Partly cloudy"], 3: ["☁️", "Cloudy"], 45: ["🌫️", "Fog"], 48: ["🌫️", "Fog"], 51: ["🌦️", "Drizzle"], 53: ["🌦️", "Drizzle"], 55: ["🌦️", "Drizzle"], 61: ["🌧️", "Rain"], 63: ["🌧️", "Rain"], 65: ["🌧️", "Heavy rain"], 71: ["🌨️", "Snow"], 80: ["🌦️", "Showers"], 81: ["🌧️", "Showers"], 82: ["⛈️", "Heavy showers"], 95: ["⛈️", "Thunderstorm"] };
  var LUCK = ["The inspector shows up early and in a great mood. 🍀", "Concrete truck on time. Buy a lottery ticket. 🎟️", "Measure twice, cut once, nail it the first time. 📐", "A client says “that looks better than the rendering.” ✨",
    "Zero change orders today. Savor it. 🍩", "The crew finds the missing tape measure. 🎉", "Rain holds off until 5:01 pm. 🌂", "Everything is plumb, level and square. Even your coffee. ☕",
    "Today a hard hat saves the day. Wear it with pride. 👷", "Ask again after lunch. 🌮", "Signs point to yes. And to the porta-potty. 🚻", "The permit comes back approved. No comments. 📜",
    "Supplier says “it's already on the truck” and means it. 🚚", "Outlook not so good… for weeds. 🌿", "Your excavator operator is an artist today. 🎨", "Cannot predict now. Check the two-week look-ahead. 📅",
    "Lucky number: 16d. 🔨", "You will hear “wow” at the walkthrough. 🤩", "Fortune favors the bold… and the well-shored. 🪵", "Today's vibe: smooth as fresh-troweled concrete. 🧱"];
  function todayHtml(p) {
    var d = new Date(), w = S.wx && S.wx[p.city || ""];
    var wx = w ? '<span class="t-wx">' + w.ico + " " + Math.round(w.t) + "°F · " + esc(w.txt) + (w.rain != null ? " · rain " + w.rain + "%" : "") + '</span><span class="t-tip">' + esc(w.tip) + "</span>" : p.city ? '<span class="t-wx muted">Checking the weather in ' + esc(p.city) + "…</span>" : "";
    if (p.city && !w) loadWx(p.city);
    return '<div class="today"><div class="t-main"><span class="t-day">' + d.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" }) + "</span>" + wx + '</div><button class="ball' + (S.luck ? " told" : "") + '" data-a="ball" title="Today\'s luck">🎱<span>Today\'s luck</span></button>' + (S.luck ? '<div class="luck">' + esc(S.luck) + "</div>" : "") + "</div>";
  }
  async function loadWx(city) {
    S.wx = S.wx || {}; if (S.wxBusy === city) return; S.wxBusy = city;
    var key = "bsp-wx:" + city;
    try { var c = JSON.parse(localStorage.getItem(key) || "null"); if (c && Date.now() - c.at < 30 * 60000) { S.wx[city] = c.w; S.wxBusy = null; return keepScroll(render); } } catch (e) {}
    try {
      var g = await (await fetch("https://geocoding-api.open-meteo.com/v1/search?count=1&language=en&format=json&countryCode=US&name=" + encodeURIComponent(city))).json(), loc = g.results && g.results[0]; if (!loc) throw 0;
      var f = await (await fetch("https://api.open-meteo.com/v1/forecast?latitude=" + loc.latitude + "&longitude=" + loc.longitude + "&current=temperature_2m,weather_code,wind_speed_10m&daily=precipitation_probability_max,temperature_2m_min&temperature_unit=fahrenheit&wind_speed_unit=mph&timezone=auto&forecast_days=1")).json();
      var code = f.current.weather_code, rain = f.daily.precipitation_probability_max[0], wind = f.current.wind_speed_10m, tmin = f.daily.temperature_2m_min[0], m = WX[code] || WX[Math.floor(code / 10) * 10] || ["🌡️", "Weather"];
      var tip = rain >= 50 ? "Rain likely: cover open excavations and hold the pour." : wind >= 20 ? "Windy: tie down materials and sheet goods." : tmin < 40 ? "Cold start: protect fresh concrete." : "Good day to build. 🏗️";
      S.wx[city] = { ico: m[0], txt: m[1], t: f.current.temperature_2m, rain: rain, tip: tip };
      try { localStorage.setItem(key, JSON.stringify({ at: Date.now(), w: S.wx[city] })); } catch (e) {}
    } catch (e) { S.wx[city] = { ico: "🌡️", txt: "Weather unavailable", t: NaN, rain: null, tip: "" }; }
    S.wxBusy = null; var el = root.querySelector(".today"); if (el && S.data) el.outerHTML = todayHtml(S.data.project);
  }

  /* ---------------- instant screens: show the last copy right away, then refresh it ---------------- */
  function ckey(name) { if (S.viewAs) return ""; var e = S.me && S.me.email || (function () { try { return localStorage.getItem("bsp-last-email"); } catch (x) { return ""; } })(); return e ? "bsp-c:" + e + ":" + name : ""; }
  function cacheGet(name) { try { var k = ckey(name); return k ? JSON.parse(localStorage.getItem(k) || "null") : null; } catch (e) { return null; } }
  function cacheSet(name, v) { try { var k = ckey(name); if (k) localStorage.setItem(k, JSON.stringify(v)); } catch (e) { try { Object.keys(localStorage).filter(function (x) { return x.indexOf("bsp-c:") === 0; }).forEach(function (x) { localStorage.removeItem(x); }); } catch (e2) {} } }
  function cacheClear() { try { Object.keys(localStorage).filter(function (x) { return x.indexOf("bsp-c:") === 0 || x === "bsp-last-email"; }).forEach(function (x) { localStorage.removeItem(x); }); } catch (e) {} }

  /* ---------------- notification bell (playful, HEY-style) ---------------- */
  /* Notifications you cleared (this device): activity ids, and "needs" snoozed until tomorrow. */
  function disKey() { return "bsp-dis:" + (S.me && S.me.email); }
  function dismissed() { if (!S.dis) { try { S.dis = JSON.parse(localStorage.getItem(disKey()) || "{}"); } catch (e) { S.dis = {}; } } return S.dis; }
  function dismiss(ids) { var d = dismissed(), t = Date.now(); ids.forEach(function (k) { d[k] = t; }); var keys = Object.keys(d); if (keys.length > 400) keys.sort(function (a, b) { return d[a] - d[b]; }).slice(0, keys.length - 400).forEach(function (k) { delete d[k]; }); try { localStorage.setItem(disKey(), JSON.stringify(d)); } catch (e) {} }
  function notifModel() {
    var dis = dismissed(), td = today();
    var items = (S.notif || []).filter(function (it) { return !it.mine && !dis[it.id]; }), fresh = items.filter(function (it) { return it.unread; }), old = items.filter(function (it) { return !it.unread; }).slice(0, 8);
    var groups = { pay: [], ask: [], todo: [], soon: [] };
    (S.projects || []).filter(function (p) { return p.status !== "archived" && p.status !== "deleted"; }).forEach(function (p) {
      var n = p.needs || {}, where = (S.projects || []).length > 1 ? p.name : "";
      var add = function (g, x) { x.key = "need:" + (x.ref || g + p.id) + ":" + td; if (!dis[x.key]) groups[g].push(x); };
      (n.invoices || []).forEach(function (i) { if (!staff() || i.overdue) add("pay", { tone: i.overdue ? "red" : "green", text: "Invoice " + i.number + " · " + money(i.amount) + (i.due ? (i.overdue ? " · overdue since " : " · due ") + day(i.due) : ""), ref: "invoice:" + i.id, p: p.id, where: where }); });
      if (p.openQuestions) add("ask", { tone: "gold", text: staff() ? p.openQuestions + " question" + (p.openQuestions > 1 ? "s" : "") + " waiting on the client" : "Blue Sierra asked you " + (p.openQuestions > 1 ? p.openQuestions + " questions" : "a question"), chat: true, p: p.id, where: where });
      if (!staff() && !crew()) (n.todos || []).forEach(function (c) { add("todo", { tone: "purple", text: c.item + (c.due ? " · by " + day(c.due) : ""), ref: "check:" + c.id, p: p.id, where: where }); });
      (n.mine || []).forEach(function (c) { if ((n.todos || []).some(function (t) { return t.id === c.id; }) && !staff() && !crew()) return; add("todo", { tone: "purple", text: c.item + (c.due ? " · by " + day(c.due) : "") + (c.by ? "" : ""), ref: "check:" + c.id, p: p.id, where: where }); });
      (n.dates || []).filter(function (x) { return team() || x.owner === "client" || ["decision", "meeting", "payment", "inspection"].indexOf(x.kind) > -1; }).forEach(function (x) {
        add("soon", { tone: "blue", ico: { decision: "🤔", meeting: "🤝", payment: "💵", inspection: "🔎", milestone: "🏁", deadline: "⏰" }[x.kind] || "📅", text: day(x.start) + " · " + x.title, ref: "sched:" + x.id, p: p.id, where: where });
      });
    });
    var nNeeds = groups.pay.length + groups.ask.length + groups.todo.length + groups.soon.length;
    return { fresh: fresh, old: old, groups: groups, nNeeds: nNeeds, needs: [].concat(groups.pay, groups.ask, groups.todo, groups.soon) };
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
      var evk = it.kind === "event" ? (EV[it.status] || ["spark"])[0] : it.kind === "question" ? "question" : it.files ? "clip" : it.dm ? "lock" : "chat", ev = ICON[evk];
      var line = it.kind === "event" ? "<b>" + esc(it.author) + "</b> " + esc(String(it.text).split("\n")[0]) : "<b>" + esc(it.author) + "</b> " + (it.dm ? "privately" : "in #" + esc(it.channel)) + ': <span class="n-msg">' + esc(String(it.text || (it.files ? "📎 attachment" : "")).slice(0, 140)) + "</span>";
      var open = it.kind === "event" && it.ref ? 'data-a="ref" data-ref="' + esc(it.ref) + '" data-p="' + esc(it.project_id) + '"' : 'data-a="actOpen" data-p="' + esc(it.project_id) + '" data-c="' + esc(it.channel) + '" data-th="' + esc(it.thread_id || "") + '"';
      return '<div class="n-wrap" data-swipe="' + esc(it.id) + '"><div class="n-under">Clear</div><button class="n-row' + (it.unread ? " new" : "") + '" ' + open + ">" +
        '<span class="n-face">' + av(it.author, it.avatar, it.role, "sm", it.akey) + '<i class="nb nb-' + evk + '">' + ev + '</i></span><span class="n-txt">' + line + "<small>" + day(it.at) + ((S.projects || []).length > 1 ? " · " + esc(it.project) : "") + "</small></span></button>" +
        '<button class="n-x" data-a="nClear" data-id="' + esc(it.id) + '" aria-label="Clear">' + ICON.x + '</button></div>';
    };
    var tiles = [["pay", ICON.dollar, staff() ? "Overdue" : "To pay"], ["ask", ICON.chat, "Questions"], ["todo", ICON.todo, "To-dos"], ["soon", ICON.calendar, "Next 2 weeks"]].filter(function (t) { return m.groups[t[0]].length; });
    var open = S.needOpen && m.groups[S.needOpen] && m.groups[S.needOpen].length ? S.needOpen : null;
    var day0 = tiles.length ? '<div class="bp-sec">Your day</div><div class="day-tiles">' + tiles.map(function (t) {
        var g = m.groups[t[0]]; return '<button class="day-tile t-' + t[0] + (open === t[0] ? " on" : "") + '" data-a="needOpen" data-v="' + t[0] + '"><span class="dt-ico">' + t[1] + '</span><b>' + g.length + "</b><span>" + t[2] + "</span></button>";
      }).join("") + "</div>" +
      (open ? '<div class="needs">' + m.groups[open].map(function (n) {
        return '<div class="need t-' + n.tone + '"><button class="need-go" ' + (n.chat ? 'data-a="actOpen" data-p="' + esc(n.p) + '" data-c="client" data-th=""' : 'data-a="ref" data-ref="' + esc(n.ref) + '" data-p="' + esc(n.p) + '"') + ">" + (n.ico ? n.ico + " " : "") + esc(n.text) + (n.where ? "<small>" + esc(n.where) + "</small>" : "") + '</button><button class="n-x" data-a="needClear" data-k="' + esc(n.key) + '" title="Hide until tomorrow">✕</button></div>';
      }).join("") + "</div>" : "") : "";
    var caught = !m.fresh.length && !m.nNeeds;
    return '<div class="bell-bg" data-a="bellClose"></div><div class="bell-panel" role="dialog" aria-label="Notifications" data-lenis-prevent>' +
      '<div class="bp-head"><div><div class="bp-hi">' + esc(hello()) + '</div><div class="muted small">' + (caught ? "Nothing needs you right now." : m.fresh.length ? m.fresh.length + " new since you last looked." : "Here's your day.") + "</div></div>" +
      '<div class="bp-tools">' + (m.fresh.length || m.old.length ? '<button class="clear-all" data-a="nClearAll">Clear all</button>' : "") + '<button class="icon-btn" data-a="bellClose" aria-label="Close">' + ICON.x + '</button></div></div>' +
      (S.notif == null ? '<div class="bp-load">Checking for news…</div>' : "") +
      (m.fresh.length ? '<div class="bp-sec">New</div><div class="n-list">' + m.fresh.map(row).join("") + "</div>" : "") +
      day0 +
      (caught && S.notif != null ? '<div class="bp-empty">' + EMPTY_ART + "<b>You're all caught up!</b><span>Go enjoy your day. We'll ping you when something happens.</span></div>" : "") +
      (m.old.length ? '<div class="bp-sec">Earlier</div><div class="n-list">' + m.old.map(row).join("") + "</div>" : "") +
      (window.Notification && Notification.permission === "default" ? '<button class="alerts-btn" data-a="alertsOn">' + ICON.bell + ' Get alerts on this device when someone writes</button>' : "") +
      '<div class="bp-foot"><span class="muted small">Swipe left or tap × to clear</span><button class="link small" data-a="tour">Take the tour</button></div></div>';
  }
  var EMPTY_ART = '<svg viewBox="0 0 160 110" width="150" aria-hidden="true"><circle cx="80" cy="58" r="44" fill="#f3e7d3"/><path d="M48 70c10-16 22-24 32-24s22 8 32 24" fill="none" stroke="#c39a5a" stroke-width="4" stroke-linecap="round"/><circle cx="80" cy="38" r="12" fill="#eda100"/><g stroke="#eda100" stroke-width="3" stroke-linecap="round"><path d="M80 18v-6M98 26l5-4M62 26l-5-4M104 40h6M50 40h6"/></g><path d="M30 92h100" stroke="#2f6b4a" stroke-width="4" stroke-linecap="round"/><path d="M44 92c2-8 6-12 10-12M60 92c0-6 3-10 6-11M112 92c-2-8-6-12-10-12" stroke="#2f6b4a" stroke-width="3" fill="none" stroke-linecap="round"/></svg>';
  async function loadNotif() {
    var seq = S.seq;
    try {
      var r = await call("activity", { limit: 40 }); if (seq !== S.seq) return; S.notif = r.items;
      if (S.bell || !S.pid) keepScroll(render); else { var bb = root.querySelector(".bell"); if (bb) bb.outerHTML = bellButton(); }
    } catch (e) {}
  }
  /* Clear one notification (✕ or swipe): it slides away, is marked read, and doesn't come back on this device. */
  function clearNote(id, wrap) {
    var it = (S.notif || []).filter(function (x) { return x.id === id; })[0];
    if (wrap) wrap.classList.add("gone");
    setTimeout(function () {
      dismiss([id]);
      if (it && it.unread) { it.unread = false; call("markRead", { projectId: it.project_id, channel: it.channel }).catch(function () {}); }
      keepScroll(render);
    }, 280);
  }
  // Swipe left to clear (touch or mouse drag), like iPhone notifications.
  (function () {
    var drag = null;
    root.addEventListener("pointerdown", function (e) { var w = e.target.closest && e.target.closest(".n-wrap"); if (!w || e.target.closest(".n-x")) return; drag = { w: w, x: e.clientX, y: e.clientY, dx: 0, on: false }; });
    root.addEventListener("pointermove", function (e) {
      if (!drag) return; var dx = e.clientX - drag.x, dy = e.clientY - drag.y;
      if (!drag.on && Math.abs(dx) > 8 && Math.abs(dx) > Math.abs(dy)) drag.on = true;
      if (!drag.on) return; drag.dx = Math.min(0, dx); drag.w.querySelector(".n-row").style.transform = "translateX(" + drag.dx + "px)"; drag.w.classList.add("dragging");
    });
    var end = function () {
      if (!drag) return; var d = drag; drag = null; d.w.classList.remove("dragging");
      var row = d.w.querySelector(".n-row");
      if (d.dx < -90) { S.swiped = Date.now(); row.style.transform = "translateX(-110%)"; clearNote(d.w.dataset.swipe, d.w); }
      else { row.style.transform = ""; if (d.on) S.swiped = Date.now(); }
    };
    root.addEventListener("pointerup", end); root.addEventListener("pointercancel", end);
    root.addEventListener("click", function (e) { if (S.swiped && Date.now() - S.swiped < 350 && e.target.closest(".n-wrap")) { e.stopPropagation(); e.preventDefault(); } }, true);
  })();
  async function markAllRead() {
    document.title = document.title.replace(/^\(\d+\) /, "");
    var pairs = {}; (S.notif || []).forEach(function (it) { if (it.unread) pairs[it.project_id + "|" + it.channel] = 1; });
    S.notif.forEach(function (it) { it.unread = false; }); (S.projects || []).forEach(function (p) { p.unread = 0; }); keepScroll(render);
    await Promise.all(Object.keys(pairs).map(function (k) { var x = k.split("|"); return call("markRead", { projectId: x[0], channel: x[1] }).catch(function () {}); }));
  }
  // The bell checks for news every minute while the page is open (and right away when you come back to the tab).
  setInterval(function () { if (S.token && S.me && document.visibilityState === "visible") { loadNotif(); if (!S.pid) refreshList(); } }, 120000);
  document.addEventListener("visibilitychange", function () { if (document.visibilityState === "visible" && S.token && S.me) loadNotif(); });

  /* ---------------- first-login tour: a spotlight that walks you around ---------------- */
  function tourSteps() {
    if (staff()) return [
      { t: "Welcome to the Blue Sierra portal 👋", b: "Every project in one place: chat, schedule, photos, contract and invoices. This takes 40 seconds." },
      { el: ".side .s-item", t: "Your sidebar", b: "Home, Activity, Team and every project. The red numbers are unread messages." },
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
  function tourKey(v) { return "bsp-tour-" + (v || "v2") + "-" + (S.me && S.me.email) + (staff() ? "-team" : "-client"); }
  var NEW_STEPS = [
    { el: ".people-btn", t: "Who's around 👀", b: "See who's online, busy or away, and where they are. Wave 👋, message or call anyone from here." },
    { el: ".here-now", t: "Here now", b: "Faces of people looking at this project right now." },
    { el: ".me-btn", t: "Your character 🤠", b: "Tap your name to build your character. Cowboy hat or hard hat? Your call." },
    { el: '[data-t="plans"]', t: "Plans", b: "Every revision of the drawings, with the changes highlighted sheet by sheet." },
    { el: ".today", t: "Today on site", b: "The date, the weather where the job is, and a tip for the crew." },
    { el: ".ball", t: "Today's luck 🎱", b: "Tap the 8-ball. No promises, but it's usually right." },
    { el: ".side-tog", t: "Hide the menu", b: "Tap ☰ to hide or show the sidebar. On a phone it slides out." }
  ];
  function startTour(force) {
    if (!S.me || S.tour || S.modal) return;
    var whatsNew = false;
    if (!force) {
      try { if (localStorage.getItem(tourKey())) return; whatsNew = !!localStorage.getItem(tourKey("v1")); } catch (e) { return; }
      if (!S.data) return;                                     // tours start inside a project, where everything is on screen
    }
    var ts = tourSteps(), last = ts.pop();               // the new things go before the "That's it!" step
    var base = whatsNew ? [{ t: "New in the portal ✨", b: "A few things were added since you last looked. 20 seconds." }].concat(NEW_STEPS, [{ el: ".help", t: "That's it!", b: "Tap the ? any time to see the full tour. 🌿" }])
      : ts.concat(NEW_STEPS.filter(function (n) { return !ts.some(function (t) { return t.el === n.el; }); }), [last]);
    var steps = base.filter(function (st) { return !st.el || root.querySelector(st.el); });
    if (steps.length < 2) return;
    S.tour = { steps: steps, i: 0 }; drawTour();
  }
  /* On screen for real: has a size, isn't hidden, and isn't parked off-screen (like the phone drawer when it's closed). */
  function visibleEl(sel) {
    var e = root.querySelector(sel); if (!e) return null;
    var r = e.getBoundingClientRect(); if (!r.width || !r.height) return null;
    if (e.closest(".side") && matchMedia("(max-width:1080px)").matches && !S.drawer) return null;
    var cs = getComputedStyle(e); if (cs.visibility === "hidden" || cs.display === "none" || +cs.opacity === 0) return null;
    return e;
  }
  function lenis(on) { try { var l = window.lenis || window.__lenis; if (l) on ? l.start() : l.stop(); } catch (e) {} }
  function endTour() { try { localStorage.setItem(tourKey(), "1"); } catch (e) {} if (S.tour && S.tour.raf) cancelAnimationFrame(S.tour.raf); S.tour = null; lenis(true); var t = document.getElementById("bsp-tour"); if (t) t.remove(); }
  function drawTour(dir) {
    var T = S.tour; if (!T) return; var redraw = dir === 0; dir = dir || 1;
    var st = T.steps[T.i], el = null;
    if (st.el) {
      var cand = root.querySelector(st.el);
      if (cand && (!cand.closest(".side") || !matchMedia("(max-width:1080px)").matches || S.drawer)) {
        if (!redraw) try { cand.scrollIntoView({ block: "center", inline: "center", behavior: "instant" }); } catch (e) { cand.scrollIntoView(); }   // also brings a tab into view inside the scrolling tab bar
        el = visibleEl(st.el);
      }
      if (!el) {                                  // not on screen right now: skip it instead of pointing at nothing
        var nx = T.i + dir; if (nx < 0 || nx >= T.steps.length) return endTour();
        T.i = nx; return drawTour(dir);
      }
    }
    var wrap = document.getElementById("bsp-tour");
    if (!wrap) { wrap = document.createElement("div"); wrap.id = "bsp-tour"; wrap.setAttribute("data-lenis-prevent", ""); wrap.innerHTML = '<div class="tour-spot"></div><div class="tour-bubble" role="dialog" aria-live="polite"></div>'; root.appendChild(wrap); lenis(false); }
    var spot = wrap.querySelector(".tour-spot"), bub = wrap.querySelector(".tour-bubble");
    bub.innerHTML = '<div class="tb-step">' + T.steps.map(function (_, k) { return '<i class="' + (k === T.i ? "on" : k < T.i ? "past" : "") + '"></i>'; }).join("") + "</div><b>" + esc(st.t) + "</b><p>" + esc(st.b) + "</p>" +
      '<div class="tb-actions"><button class="link small" data-tour="skip">' + (T.i === T.steps.length - 1 ? "" : "Skip") + "</button><span>" + (T.i ? '<button class="btn ghost sm" data-tour="back">Back</button>' : "") +
      '<button class="btn sm" data-tour="next">' + (T.i === T.steps.length - 1 ? "Let's go! 🎉" : "Next") + "</button></span></div>";
    var last = "";
    var place = function () {
      var vv = window.visualViewport, vw = vv ? vv.width : innerWidth, vh = vv ? vv.height : innerHeight, bw = Math.min(340, vw - 24);
      bub.style.width = bw + "px";
      if (!el) { spot.style.cssText = "top:" + vh / 2 + "px;left:" + vw / 2 + "px;width:0;height:0"; bub.style.left = (vw - bw) / 2 + "px"; bub.style.top = Math.max(16, vh / 2 - bub.offsetHeight / 2) + "px"; bub.className = "tour-bubble center"; return; }
      var r = el.getBoundingClientRect(), sig = [r.top, r.left, r.width, r.height, vw, vh].map(Math.round).join(",");
      if (sig === last) return; last = sig;
      var pad = 6, top = Math.max(4, r.top - pad), left = Math.max(4, r.left - pad), w = Math.min(vw - 8, r.width + pad * 2), h = Math.min(vh - 8, r.height + pad * 2);
      spot.style.cssText = "top:" + top + "px;left:" + left + "px;width:" + w + "px;height:" + h + "px";
      var bh = bub.offsetHeight, below = r.bottom + 14 + bh < vh - 8, y = below ? r.bottom + 14 : r.top - 14 - bh;
      if (!below && y < 8) y = Math.max(8, vh - bh - 12);                         // tall target on a small screen: dock the bubble at the bottom
      var x = Math.max(12, Math.min(vw - bw - 12, r.left + r.width / 2 - bw / 2));
      bub.style.top = y + "px"; bub.style.left = x + "px"; bub.className = "tour-bubble " + (below ? "below" : "above");
      bub.style.setProperty("--arrow", Math.max(18, Math.min(bw - 18, r.left + r.width / 2 - x)) + "px");
    };
    // Follow the target every frame while the tour is open: smooth scrolling, the phone toolbar or a late layout can't leave the spotlight behind.
    if (T.raf) cancelAnimationFrame(T.raf);
    var loop = function () { if (S.tour !== T) return; place(); T.raf = requestAnimationFrame(loop); };
    T.place = place; loop();
    var nb = bub.querySelector("[data-tour=next]"); if (nb) nb.focus({ preventScroll: true });
  }
  root.addEventListener("click", function (e) {
    var b = e.target.closest("[data-tour]"); if (!b || !S.tour) return;
    var a = b.dataset.tour; if (a === "skip") return endTour();
    if (a === "next") { if (S.tour.i >= S.tour.steps.length - 1) return endTour(); S.tour.i++; return drawTour(1); }
    if (a === "back") { S.tour.i = Math.max(0, S.tour.i - 1); return drawTour(-1); }
  });
  window.addEventListener("resize", function () { if (S.tour && S.tour.place) S.tour.place(); });
  window.addEventListener("scroll", function () { if (S.tour && S.tour.place) S.tour.place(); }, { passive: true });
  document.addEventListener("keydown", function (e) {
    if (!S.tour) return;
    if (e.key === "Escape") { e.stopPropagation(); endTour(); }
    if (e.key === "ArrowRight") { if (S.tour.i < S.tour.steps.length - 1) { S.tour.i++; drawTour(1); } else endTour(); }
    if (e.key === "ArrowLeft" && S.tour.i) { S.tour.i--; drawTour(-1); }
  }, true);

  /* ---------------- plans: revisions of the drawing set, and what changed ---------------- */
  var PDFJS = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/";
  function planSets() {
    var by = {}; ((S.data && S.data.plans) || []).filter(function (d) { return d.status === "ready"; }).forEach(function (d) { (by[d.set] = by[d.set] || []).push(d); });
    return Object.keys(by).map(function (k) { var revs = by[k].sort(function (a, b) { return a.at < b.at ? 1 : -1; }); return { set: k, revs: revs, latest: revs[0] }; })
      .sort(function (a, b) { return a.latest.at < b.latest.at ? 1 : -1; });
  }
  function planById(id) { return ((S.data && S.data.plans) || []).filter(function (d) { return d.id === id; })[0]; }
  function sheetLabel(x) { return x.sheet || "Page " + x.n; }
  var VIS = { team: "Team only", architect: "Team + architect", all: "Everyone on the project" };
  function boxesHtml(x) { return (x.boxes || []).map(function (bx) { return '<i class="cbox" style="left:' + bx[0] * 100 + "%;top:" + bx[1] * 100 + "%;width:" + bx[2] * 100 + "%;height:" + bx[3] * 100 + '%"></i>'; }).join(""); }
  function tabPlans() {
    var sets = planSets(), open = S.planOpen && planById(S.planOpen);
    var unfinished = ((S.data.plans) || []).filter(function (d) { return d.status !== "ready"; });
    var head = '<div class="section-title" style="margin-top:0"><div><h2>Plans</h2><span class="muted small">Every revision of the drawings. Each new upload is compared with the last one, and changed sheets are highlighted.</span></div>' +
      (staff() ? '<button class="btn sm" data-a="modal" data-m="planUp">＋ Upload a revision</button>' : "") + "</div>";
    if (!sets.length) return head + '<div class="empty">' + (staff() ? "No plans yet. Upload the current set (a PDF) and the field crew will always have the latest sheets." : "No plans have been shared yet.") + "</div>" +
      unfinished.map(function (d) { return '<p class="muted small">Unfinished upload: ' + esc(d.set + " " + d.rev) + ' · <button class="link small" data-a="delPlan" data-id="' + esc(d.id) + '">remove</button></p>'; }).join("");
    return head + sets.map(function (st) {
      var cur = (open && open.set === st.set) ? open : (S.planRev && planById(S.planRev[st.set])) || st.latest;
      var sh = cur.sheets || [], nCh = sh.filter(function (x) { return x.status === "changed"; }).length, nNew = sh.filter(function (x) { return x.status === "new"; }).length;
      var isFirstRev = st.revs[st.revs.length - 1].id === cur.id, filt = (S.planFilter || {})[cur.id] || "all";
      var shown = sh.filter(function (x) { return filt === "all" || x.status === filt; });
      return '<section class="card planset" id="plan-' + esc(st.set) + '"><div class="ps-head"><div><div class="eyebrow">Plan set</div><h3>' + esc(st.set) + "</h3>" +
        '<div class="ps-meta"><span class="pill dark">' + esc(cur.rev) + (cur.id === st.latest.id ? " · latest" : "") + '</span><span class="muted small">' + day(cur.date) + " · uploaded by " + esc(cur.by) + '</span><span class="pill">' + esc(VIS[cur.visible] || "") + "</span></div></div>" +
        '<div class="actions">' + (cur.pdf ? '<a class="btn ghost sm" href="' + esc(cur.pdf) + '" target="_blank" rel="noopener noreferrer">Download PDF</a>' : "") + (staff() ? '<button class="btn ghost sm" data-a="delPlan" data-id="' + esc(cur.id) + '">Delete revision</button>' : "") + "</div></div>" +
        (cur.notes ? '<p class="ps-notes">“' + esc(cur.notes) + "”</p>" : "") +
        (st.revs.length > 1 ? '<div class="chips revs">' + st.revs.map(function (r) { return '<button class="chip' + (r.id === cur.id ? " on" : "") + '" data-a="planRev" data-set="' + esc(st.set) + '" data-id="' + esc(r.id) + '">' + esc(r.rev) + "</button>"; }).join("") + "</div>" : "") +
        (!isFirstRev ? '<div class="ps-sum">' + (nCh ? '<span class="tag t-changed">' + nCh + " changed</span>" : '<span class="tag t-same">No changes found</span>') + (nNew ? '<span class="tag t-new">' + nNew + " new</span>" : "") +
          '<span class="ps-filter">' + [["all", "All sheets"], ["changed", "Changed"], ["new", "New"]].map(function (o) { return '<button class="link small' + (filt === o[0] ? " on" : "") + '" data-a="planFilter" data-id="' + esc(cur.id) + '" data-v="' + o[0] + '">' + o[1] + "</button>"; }).join(" · ") + "</span></div>" : "") +
        '<div class="sheets">' + shown.map(function (x) {
          return '<button class="sheet s-' + esc(isFirstRev ? "none" : x.status) + '" data-a="sheet" data-id="' + esc(cur.id) + '" data-n="' + x.n + '"><span class="sh-img"><img src="' + esc(x.thumb) + '" alt="" loading="lazy" referrerpolicy="no-referrer">' + (isFirstRev || x.status !== "changed" ? "" : boxesHtml(x)) + "</span>" +
            '<span class="sh-cap"><b>' + esc(sheetLabel(x)) + "</b>" + (isFirstRev ? "" : x.status === "changed" ? '<span class="tag t-changed">Changed</span>' : x.status === "new" ? '<span class="tag t-new">New</span>' : '<span class="tag t-same">Same</span>') + "</span></button>";
        }).join("") + (shown.length ? "" : '<div class="empty" style="grid-column:1/-1">No sheets in this filter.</div>') + "</div></section>";
    }).join("");
  }
  /* The sheet viewer: the sheet with its changes boxed in red, or an overlay against the previous revision (red = removed, blue = added). */
  function sheetModal(m) {
    var d = planById(m.id); if (!d) return "<p>That revision was deleted.</p>";
    var list = d.sheets || [], i = list.map(function (x) { return x.n; }).indexOf(m.n), x = list[i] || list[0]; if (!x) return "<p>No sheets.</p>";
    var st = planSets().filter(function (s2) { return s2.set === d.set; })[0], firstRev = st && st.revs[st.revs.length - 1].id === d.id;
    var mode = S.sheetMode || "hl", key = d.id + ":" + x.n, cmp = S.cmpCache && S.cmpCache[key];
    var canCmp = !!(x.prev && x.prev.id && planById(x.prev.id));
    var stage = mode === "cmp" && canCmp ? (cmp ? '<img src="' + cmp + '" alt="Comparison">' : '<div class="loading" style="min-height:40vh">Comparing with ' + esc(x.prev.rev || "the last revision") + "…</div>")
      : '<span class="sh-wrap"><img src="' + esc(x.full) + '" alt="' + esc(sheetLabel(x)) + '" referrerpolicy="no-referrer">' + (mode === "hl" && !firstRev && x.status === "changed" ? boxesHtml(x) : "") + "</span>";
    if (mode === "cmp" && canCmp && !cmp) setTimeout(function () { buildCompare(d, x); }, 0);
    return '<div class="sv-bar"><div><div class="eyebrow">' + esc(d.set + " · " + d.rev) + "</div><h2>" + esc(sheetLabel(x)) + (firstRev ? "" : ' <span class="tag t-' + esc(x.status) + '">' + esc({ changed: "Changed", new: "New", same: "Same" }[x.status] || "") + "</span>") + "</h2></div>" +
      '<div class="sv-tools"><div class="chips">' + [["hl", "Highlights"], ["plain", "Clean"]].concat(canCmp ? [["cmp", "Compare with " + (x.prev.rev || "last")]] : []).map(function (o) { return '<button class="chip' + (mode === o[0] ? " on" : "") + '" data-a="sheetMode" data-v="' + o[0] + '">' + esc(o[1]) + "</button>"; }).join("") + "</div>" +
      '<button class="icon-btn" data-a="zoom" data-z="-1" aria-label="Zoom out">−</button><button class="icon-btn" data-a="zoom" data-z="1" aria-label="Zoom in">+</button>' +
      '<button class="icon-btn" data-a="sheetNav" data-d="-1" aria-label="Previous sheet"' + (i <= 0 ? " disabled" : "") + '>‹</button><span class="muted small">' + (i + 1) + " / " + list.length + '</span><button class="icon-btn" data-a="sheetNav" data-d="1" aria-label="Next sheet"' + (i >= list.length - 1 ? " disabled" : "") + ">›</button>" +
      '<button class="icon-btn" data-a="close" aria-label="Close">✕</button></div></div>' +
      (mode === "cmp" ? '<div class="sv-legend"><span><i style="background:#e5484d"></i>Removed</span><span><i style="background:#1f6fe5"></i>Added</span><span><i style="background:#9a958c"></i>Same</span></div>' : mode === "hl" && !firstRev && x.status === "changed" && (x.boxes || []).length ? '<div class="sv-legend"><span><i class="cl"></i>' + x.boxes.length + " area" + (x.boxes.length > 1 ? "s" : "") + " changed since " + esc((x.prev && x.prev.rev) || "the last revision") + "</span></div>" : "") +
      '<div class="sv-stage" data-lenis-prevent><div class="sv-zoom" style="width:' + (S.zoom || 100) + '%">' + stage + "</div></div>";
  }
  function loadScript(src) { return new Promise(function (res, rej) { var sc = document.createElement("script"); sc.src = src; sc.onload = res; sc.onerror = function () { rej(new Error("Couldn't load the PDF reader. Check your connection.")); }; document.head.appendChild(sc); }); }
  async function pdfjs() { if (!window.pdfjsLib) { await loadScript(PDFJS + "pdf.min.js"); window.pdfjsLib.GlobalWorkerOptions.workerSrc = PDFJS + "pdf.worker.min.js"; } return window.pdfjsLib; }
  function imgFromSrc(src) { return new Promise(function (res, rej) { var im = new Image(); im.onload = function () { res(im); }; im.onerror = function () { rej(new Error("Couldn't read a sheet image.")); }; im.src = src; }); }
  /* Grayscale at a fixed width so two revisions line up pixel for pixel. */
  function inkMask(src, W, H) {
    var c = document.createElement("canvas"); c.width = W; c.height = H; var g = c.getContext("2d", { willReadFrequently: true });
    g.fillStyle = "#fff"; g.fillRect(0, 0, W, H); g.drawImage(src, 0, 0, W, H);
    var px = g.getImageData(0, 0, W, H).data, L = new Uint8Array(W * H), ink = 0;
    for (var i = 0, j = 0; j < L.length; i += 4, j++) { L[j] = px[i] * 0.3 + px[i + 1] * 0.59 + px[i + 2] * 0.11; if (L[j] < 150) ink++; }
    return { L: L, w: W, h: H, ink: ink };
  }
  /* Darkest value within r pixels: lets a line move by a pixel (rendering, compression) without counting as a change. */
  function minFilter(a, w, h, r) {
    var t = new Uint8Array(a.length), o = new Uint8Array(a.length), x, y, k, m;
    for (y = 0; y < h; y++) for (x = 0; x < w; x++) { m = 255; for (k = Math.max(0, x - r); k <= Math.min(w - 1, x + r); k++) m = Math.min(m, a[y * w + k]); t[y * w + x] = m; }
    for (x = 0; x < w; x++) for (y = 0; y < h; y++) { m = 255; for (k = Math.max(0, y - r); k <= Math.min(h - 1, y + r); k++) m = Math.min(m, t[k * w + x]); o[y * w + x] = m; }
    return o;
  }
  /* A pixel changed when it's clearly dark in one revision and clearly light everywhere near it in the other.
     Faint gray lines and compression noise don't count; a moved wall, a new note or a changed dimension does. */
  function changeMap(A, B) {
    var w = B.w, h = B.h, mA = minFilter(A.L, w, h, 1), mB = minFilter(B.L, w, h, 1), out = new Uint8Array(w * h);
    for (var i = 0; i < out.length; i++) { if (B.L[i] < 150 && B.L[i] < mA[i] - 70) out[i] = 1; else if (A.L[i] < 150 && A.L[i] < mB[i] - 70) out[i] = 2; }
    return out;
  }
  /* Compare two sheets and box the areas where linework appeared or disappeared. */
  function diffSheets(A, B) {
    var w = B.w, h = B.h, ch = changeMap(A, B), G = 48, cell = w / G, rows = Math.ceil(h / cell), cnt = new Uint16Array(G * rows), changed = 0;
    for (var y = 0; y < h; y++) for (var x = 0; x < w; x++) if (ch[y * w + x]) { changed++; cnt[Math.floor(y / cell) * G + Math.floor(x / cell)]++; }
    var thr = Math.max(4, cell * cell * 0.006), hot = new Uint8Array(G * rows), seen = new Uint8Array(G * rows), boxes = [];
    for (var c = 0; c < cnt.length; c++) if (cnt[c] > thr) hot[c] = 1;
    for (c = 0; c < hot.length; c++) if (hot[c] && !seen[c]) {
      var st = [c], x0 = G, y0 = rows, x1 = 0, y1 = 0, n = 0; seen[c] = 1;
      while (st.length) { var q = st.pop(), qx = q % G, qy = (q - qx) / G; n++; x0 = Math.min(x0, qx); x1 = Math.max(x1, qx); y0 = Math.min(y0, qy); y1 = Math.max(y1, qy);
        [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, -1], [1, -1], [-1, 1]].forEach(function (dd) { var nx = qx + dd[0], ny = qy + dd[1], ni = ny * G + nx; if (nx >= 0 && ny >= 0 && nx < G && ny < rows && hot[ni] && !seen[ni]) { seen[ni] = 1; st.push(ni); } }); }
      boxes.push([Math.max(0, (x0 - 0.6) / G), Math.max(0, (y0 - 0.6) * cell / h), Math.min(1, (x1 - x0 + 2.2) / G), Math.min(1, (y1 - y0 + 2.2) * cell / h), n]);
    }
    boxes.sort(function (a, b) { return b[4] - a[4]; });
    var score = changed / Math.max(1, A.ink + B.ink);
    return { score: score, status: boxes.length && changed > 20 ? "changed" : "same", boxes: boxes.slice(0, 30).map(function (b) { return b.slice(0, 4); }) };
  }
  /* Words on a sheet with their position (0–1 from the top left): [text, x, y, w, h]. */
  function sheetWords(tc, vw, vh) {
    var out = [];
    tc.items.forEach(function (it) {
      var t = String(it.str || "").trim(); if (!t) return;
      var size = Math.hypot(it.transform[2], it.transform[3]) || Math.hypot(it.transform[0], it.transform[1]);
      out.push([t.slice(0, 80), +(it.transform[4] / vw).toFixed(4), +(1 - (it.transform[5] + size) / vh).toFixed(4), +((it.width || size * t.length * 0.5) / vw).toFixed(4), +(size * 1.2 / vh).toFixed(4)]);
    });
    return out.slice(0, 6000);
  }
  /* Text that's new or gone between two revisions of a sheet (a changed dimension, a new note), as boxes. */
  function textChanges(oldW, newW) {
    var near = function (a, b) { return a[0] === b[0] && Math.abs(a[1] - b[1]) < 0.006 && Math.abs(a[2] - b[2]) < 0.006; };
    var gone = function (list, other) { return list.filter(function (a) { return !other.some(function (b) { return near(a, b); }); }); };
    return gone(newW, oldW).concat(gone(oldW, newW)).slice(0, 40).map(function (a) { var p2 = 0.006; return [Math.max(0, a[1] - p2), Math.max(0, a[2] - p2), Math.min(1, a[3] + p2 * 2), Math.min(1, a[4] + p2 * 2)]; });
  }
  /* Sheet number from the title block: short codes like A101, L3.22 or S-2.1, preferring big text near the bottom right. */
  function sheetId(tc, vw, vh) {
    var best = null;
    tc.items.forEach(function (it) {
      var t = String(it.str || "").trim().replace(/\s+/g, ""); if (!/^[A-Z]{1,3}[-.]?\d{1,3}(\.\d{1,3})?[A-Z]?$/.test(t)) return;
      var x = it.transform[4], y = it.transform[5], size = Math.hypot(it.transform[0], it.transform[1]);
      if (x < vw * 0.55 && y > vh * 0.45) return;
      var sc = size * 2 + (x / vw) * 10 + (1 - y / vh) * 10; if (!best || sc > best.sc) best = { t: t, sc: sc };
    });
    return best ? best.t : "";
  }
  async function buildCompare(d, x) {
    var key = d.id + ":" + x.n; if (S.cmpBusy === key) return; S.cmpBusy = key;
    try {
      var a = await call("planImage", { id: x.prev.id, n: x.prev.n }), b = await call("planImage", { id: d.id, n: x.n });
      var ia = await imgFromSrc(a.data), ib = await imgFromSrc(b.data), W = Math.min(2000, ib.naturalWidth), H = Math.round(W * ib.naturalHeight / ib.naturalWidth);
      var A = inkMask(ia, W, H), B = inkMask(ib, W, H), chg = changeMap(A, B);
      var c = document.createElement("canvas"); c.width = W; c.height = H; var g = c.getContext("2d"), out = g.createImageData(W, H), o = out.data;
      for (var i = 0; i < B.L.length; i++) {
        var r = 255, gg = 255, bb = 255;
        if (chg[i] === 1) { r = 31; gg = 111; bb = 229; } else if (chg[i] === 2) { r = 229; gg = 72; bb = 77; } else if (B.L[i] < 200) { var k2 = 255 - (255 - B.L[i]) * 0.45; r = gg = bb = k2; }
        o[i * 4] = r; o[i * 4 + 1] = gg; o[i * 4 + 2] = bb; o[i * 4 + 3] = 255;
      }
      g.putImageData(out, 0, 0); S.cmpCache = S.cmpCache || {}; S.cmpCache[key] = c.toDataURL("image/png");
    } catch (e) { toast(e.message); S.sheetMode = "hl"; }
    S.cmpBusy = null; if (S.modal && S.modal.type === "sheet") keepScroll(render);
  }
  function planUpModal(d) {
    var sets = planSets(), last = sets[0], nextRev = function (st) { var m2 = String(st.latest.rev).match(/(\d+)\s*$/); return m2 ? String(st.latest.rev).replace(/(\d+)\s*$/, String(Number(m2[1]) + 1)) : st.latest.rev + " 2"; };
    return "<h2>Upload a plan revision</h2><p class=\"muted\" style=\"margin:4px 0 12px\">Pick the PDF. The portal reads every sheet, compares it with the last revision of the same set, and highlights what changed. Big sets can take a minute.</p>" +
      '<form class="form" data-form="planUp"><label class="f">Plan set<input type="text" name="set" list="bsp-sets" required maxlength="120" value="' + esc(last ? last.set : "Construction set") + '"><datalist id="bsp-sets">' + sets.map(function (st) { return '<option value="' + esc(st.set) + '">'; }).join("") + "</datalist></label>" +
      '<div class="row2"><label class="f">Revision<input type="text" name="rev" required maxlength="40" value="' + esc(last ? nextRev(last) : "Rev 1") + '"></label><label class="f">Date on the set<input type="date" name="date" value="' + today() + '"></label></div>' +
      '<label class="f">Who can see it<select name="visible"><option value="team">Team and field crew only</option><option value="architect">Team, crew and the architect</option><option value="all">Everyone on the project, including the client</option></select></label>' +
      '<label class="f">What changed (optional)<textarea name="notes" maxlength="2000" placeholder="e.g. Architect revised the deck framing and moved the fire pit 2 ft east"></textarea></label>' +
      '<label class="f">PDF<input type="file" name="pdf" accept="application/pdf" required></label>' +
      '<div class="plan-prog" id="plan-prog" hidden><div class="pp-bar"><i></i></div><span></span></div>' +
      '<div class="actions"><button type="button" class="btn ghost" data-a="close">Cancel</button><button class="btn" type="submit">Upload and compare</button></div></form>';
  }
  function prog(txt, frac) { var el = document.getElementById("plan-prog"); if (!el) return; el.hidden = false; el.querySelector("span").textContent = txt; el.querySelector("i").style.width = Math.round((frac || 0) * 100) + "%"; }
  /* The upload: read the PDF here in the browser, compare sheet by sheet, then send the file straight to Drive and the sheet images to the portal. */
  async function uploadPlan(f, fd, v) {
    var file = f.pdf.files[0]; if (!file || file.type !== "application/pdf") throw new Error("Pick a PDF.");
    var set = v("set"), rev = v("rev");
    if (planSets().some(function (st) { return st.set === set && st.revs.some(function (r) { return r.rev === rev; }); })) throw new Error(set + " already has a " + rev + ". Use a new revision name.");
    prog("Opening the PDF…", 0.02);
    var lib = await pdfjs(), pdf = await lib.getDocument({ data: await file.arrayBuffer() }).promise, N = pdf.numPages, W = API ? 2000 : 1400, pages = [];
    if (N > 120) throw new Error("That PDF has " + N + " pages. Split it into sets under 120 pages.");
    for (var i = 1; i <= N; i++) {
      prog("Reading sheet " + i + " of " + N + "…", 0.05 + 0.45 * i / N);
      var page = await pdf.getPage(i), vp1 = page.getViewport({ scale: 1 }), vp = page.getViewport({ scale: W / vp1.width });
      var c = document.createElement("canvas"); c.width = Math.round(vp.width); c.height = Math.round(vp.height);
      var g = c.getContext("2d"); g.fillStyle = "#fff"; g.fillRect(0, 0, c.width, c.height);
      await page.render({ canvasContext: g, viewport: vp }).promise;
      var tc = await page.getTextContent();
      pages.push({ n: i, data: c.toDataURL("image/jpeg", API ? 0.82 : 0.7), w: c.width, h: c.height, sheet: sheetId(tc, vp1.width, vp1.height), words: sheetWords(tc, vp1.width, vp1.height), canvas: c });
    }
    // Compare with the latest revision of the same set.
    var prev = planSets().filter(function (st) { return st.set === set; })[0], prevRev = prev && prev.latest, used = {}, prevText = {};
    if (prevRev) { try { prevText = (await call("planText", { id: prevRev.id })).text || {}; } catch (e) { prevText = {}; } }
    for (i = 0; i < pages.length; i++) {
      var pg = pages[i]; pg.status = "new";
      if (!prevRev) continue;
      var match = (prevRev.sheets || []).filter(function (x) { return pg.sheet && x.sheet === pg.sheet; })[0] || (!pg.sheet ? (prevRev.sheets || []).filter(function (x) { return x.n === pg.n && !x.sheet; })[0] : null);
      if (!match) continue; used[match.n] = 1;
      prog("Comparing " + (pg.sheet || "sheet " + pg.n) + " with " + prevRev.rev + "…", 0.5 + 0.3 * (i + 1) / pages.length);
      var old = await imgFromSrc((await call("planImage", { id: prevRev.id, n: match.n })).data), Wd = Math.min(1600, pg.w), Hd = Math.round(Wd * pg.h / pg.w);
      var r = diffSheets(inkMask(old, Wd, Hd), inkMask(pg.canvas, Wd, Hd));
      var tb = prevText[match.n] ? textChanges(prevText[match.n], pg.words) : [];        // changed words: dimensions, notes, labels
      pg.status = r.status === "changed" || tb.length ? "changed" : "same"; pg.score = r.score; pg.boxes = tb.concat(r.boxes).slice(0, 40); pg.prev = { id: prevRev.id, n: match.n, rev: prevRev.rev };
    }
    var removed = prevRev ? (prevRev.sheets || []).filter(function (x) { return !used[x.n]; }).map(sheetLabel) : [];
    prog("Sending the PDF to Google Drive…", 0.82);
    var start = await call("planStart", { projectId: S.pid, set: set, rev: rev, date: v("date"), notes: v("notes"), visible: v("visible"), name: file.name, size: file.size, origin: location.origin }), fileId = "preview";
    if (start.uploadUrl) {
      var up = await fetch(start.uploadUrl, { method: "PUT", headers: { "Content-Type": "application/pdf" }, body: file });
      if (!up.ok) throw new Error("Google Drive refused the upload (" + up.status + "). Try again.");
      fileId = (await up.json()).id;
    }
    for (i = 0; i < pages.length; i += 3) {
      prog("Saving sheets " + (i + 1) + "–" + Math.min(pages.length, i + 3) + " of " + pages.length + "…", 0.85 + 0.12 * i / pages.length);
      await call("planPages", { id: start.id, pages: pages.slice(i, i + 3).map(function (x) { return { n: x.n, data: x.data, w: x.w, h: x.h, sheet: x.sheet }; }) });
    }
    prog("Finishing…", 0.98);
    var text = {}; pages.forEach(function (x) { text[x.n] = x.words; });
    await call("planFinish", { id: start.id, fileId: fileId, removed: removed, text: text, sheets: pages.map(function (x) { return { n: x.n, sheet: x.sheet, status: x.status, score: x.score || 0, boxes: x.boxes || [], prev: x.prev || null }; }) });
    S.planOpen = start.id; return { changed: pages.filter(function (x) { return x.status === "changed"; }).length, first: !prevRev, n: pages.length };
  }

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
        return '<tr id="inv-' + esc(i.id) + '"' + (counted ? "" : ' class="muted-row"') + "><td><b style='font-weight:500'>" + esc(i.number) + "</b>" + (i.qb_id && staff() ? ' <span class="qb-badge" title="In QuickBooks">QB</span>' : "") + "<div class='muted small'>" + esc(i.title) + "</div></td><td>" + day(i.issued) + (i.due ? "<div class='muted small'>Due " + day(i.due) + "</div>" : "") + "</td>" +
          '<td class="num">' + money(i.amount) + "</td>" + (showRet ? '<td class="num">' + (i.retainage ? (i.retainage > 0 ? "−" : "+") + money(Math.abs(i.retainage)) + (i.retainage < 0 ? "<div class='muted small'>released</div>" : "") : "—") + "</td>" : "") +
          '<td class="num"><b style="font-weight:500">' + money(i.amount - (i.retainage || 0)) + "</b></td>" + (m.has ? '<td class="num">' + (counted ? money(m.after[i.id]) : "—") + "</td>" : "") + "<td>" + pill(i.status) + "</td>" +
          '<td><div class="row-actions">' + (i.pdf ? '<a class="btn ghost sm" href="' + esc(i.pdf) + '" target="_blank" rel="noopener noreferrer">PDF</a>' : "") +
          (i.pay_url && i.status !== "paid" && !staff() ? '<a class="btn sm" href="' + esc(i.pay_url) + '" target="_blank" rel="noopener noreferrer">Pay</a>' : "") +
          (S.me.money && i.qb_id && i.status !== "paid" && i.status !== "void" && i.status !== "draft" ? '<button class="btn ghost sm" data-a="qbSendInv" data-id="' + esc(i.id) + '" title="Email it from QuickBooks with its pay link">Email</button>' : "") +
          (staff() ? '<button class="btn ghost sm" data-a="modal" data-m="invoice" data-id="' + esc(i.id) + '">Edit</button>' : "") + "</div></td></tr>";
      }).join("") + "</tbody></table></div>" + (m.has ? '<p class="muted small" style="margin-top:8px">“Work billed” counts against the contract. ' + (showRet ? "Retainage is held back from each payment and paid at completion, so “Amount due” is what gets paid now. " : "") + "Drafts and void invoices don't count.</p>" : "")
      : '<div class="empty">No invoices yet.</div>';
    var pj = (S.data && S.data.project) || {}, aud = pj.billing_aud || [], seesC = aud.indexOf("client") > -1;
    var vis = staff() ? '<div class="card bill-vis' + (seesC ? " on" : "") + '">' + ICON.eye + '<div><b>' + (seesC ? "The client sees this tab" : "The client can’t see this tab") + '</b><span class="muted small">' +
      (seesC ? "Contract, change orders and every invoice marked Paid, Due or Overdue. Drafts, void invoices and team notes stay hidden." : "Only Blue Sierra" + (aud.indexOf("architect") > -1 ? " and the architect" : "") + " see the contract and invoices.") + "</span></div>" +
      (S.me.admin ? '<button class="btn ' + (seesC ? "ghost " : "") + 'sm" data-a="billAud" data-v="' + (seesC ? "off" : "on") + '">' + (seesC ? "Hide from the client" : "Show it to the client") + "</button>" : "") + "</div>" : "";
    return vis + head + breakdown + '<div class="section-title"><h2>Invoices</h2>' + (staff() ? '<button class="btn sm" data-a="modal" data-m="invoice">New invoice</button>' : "") + "</div>" + table + (staff() ? qbProjectBox() : "");
  }

  /* ---------------- #money: what this job costs and makes, from QuickBooks (admin + people tagged #money) ---------------- */
  async function loadMoney(refresh) {
    var pid = S.pid; S.moneyBusy = S.moneyBusy || {}; if (S.moneyBusy[pid]) return; S.moneyBusy[pid] = 1; S.money = S.money || {};
    if (refresh && S.money[pid]) S.money[pid].refreshing = true;
    if (!S.money[pid] && !refresh) { var oldm = cacheGet("money:" + pid); if (oldm && oldm.linked) { S.money[pid] = Object.assign(oldm, { refreshing: true }); if (S.pid === pid && S.tab === "money") keepScroll(render); } }
    try { var mr = await call("qbMoney", { projectId: pid, refresh: !!refresh }); S.money[pid] = mr; if (mr && mr.linked) cacheSet("money:" + pid, mr); } catch (e) { if (!S.money[pid] || !S.money[pid].linked) S.money[pid] = { err: e.message }; else S.money[pid].refreshing = false; }
    S.moneyBusy[pid] = 0; if (S.pid === pid && S.tab === "money") keepScroll(render);
  }
  var BUCKETS = [["labor", "Labor & payroll"], ["materials", "Materials"], ["subs", "Subs"], ["other", "Everything else"]];
  function moneyMood(billed, spent) {
    var mg = billed ? (billed - spent) / billed * 100 : null;
    if (!billed && !spent) return ["calm", "Fresh start.", "Nothing in QuickBooks for this job yet. Bills, checks and payroll show up here once they’re tagged to this customer."];
    if (!spent) return ["good", "Money in, nothing out (yet).", "No costs are tagged to this job in QuickBooks. If that sounds too good to be true, it is: tag the bills to this customer."];
    if (!billed) return ["bad", "All out, nothing in.", "We’re spending and haven’t billed yet. Time to send an invoice."];
    if (mg >= 25) return ["great", "Chef’s kiss. This job is printing money.", "Keep doing whatever you’re doing."];
    if (mg >= 15) return ["good", "Looking healthy.", "Solid margin. Keep an eye on the change orders."];
    if (mg >= 5) return ["tight", "Tight, but alive.", "Every extra Home Depot run counts on this one."];
    if (mg >= 0) return ["tight", "Breaking even.", "We’re working for free right now. Coffee’s on you."];
    return ["bad", "Ouch. This job is eating our lunch.", "Costs are higher than what we billed. Time for a change order?"];
  }
  function piggy(mood, fill) {
    var c = { great: "#2f6b4a", good: "#2f6b4a", tight: "#c39a5a", bad: "#9a3b2e", calm: "#77736c" }[mood], h = Math.max(4, Math.min(100, fill)) * 0.36;
    return '<svg class="piggy" viewBox="0 0 64 56" aria-hidden="true"><defs><clipPath id="pg-c"><ellipse cx="30" cy="30" rx="22" ry="17"/></clipPath></defs>' +
      '<ellipse cx="30" cy="30" rx="22" ry="17" fill="#fff" stroke="' + c + '" stroke-width="2.5"/><rect x="6" y="' + (47 - h) + '" width="48" height="' + h + '" fill="' + c + '" opacity=".25" clip-path="url(#pg-c)"/>' +
      '<path d="M18 16l-3-8 9 5" fill="#fff" stroke="' + c + '" stroke-width="2.5" stroke-linejoin="round"/><rect x="50" y="24" width="9" height="11" rx="4" fill="#fff" stroke="' + c + '" stroke-width="2.5"/>' +
      '<circle cx="54.5" cy="29.5" r="1" fill="' + c + '"/><circle cx="41" cy="24" r="2" fill="' + c + '"/><path d="M24 14h10" stroke="' + c + '" stroke-width="2.5" stroke-linecap="round"/>' +
      '<path d="M18 45v6M40 45v6" stroke="' + c + '" stroke-width="3" stroke-linecap="round"/>' + (mood === "great" ? '<circle cx="30" cy="5" r="4" fill="#c39a5a" class="coin"/>' : "") + "</svg>";
  }
  function tabMoney() {
    var m = (S.money || {})[S.pid];
    var head = '<div class="section-title" style="margin-top:0"><div><h2>#money</h2><span class="muted small">Only Jesús and people tagged #money see this tab.</span></div>' +
      (m && m.linked ? '<button class="btn ghost sm" data-a="moneyRefresh"' + (m.refreshing ? " disabled" : "") + ">" + (m.refreshing ? "Counting…" : "Refresh") + "</button>" : "") + "</div>";
    if (!m) { loadMoney(false); return head + '<div class="loading" style="min-height:30vh">Counting the money…</div>'; }
    if (m.err) return head + '<div class="empty">' + esc(m.err) + ' <button class="link" data-a="moneyRefresh">Try again</button></div>';
    if (!m.connected) return head + '<div class="empty">QuickBooks isn’t connected yet. ' + (S.me.admin ? '<button class="link" data-a="homeTeamQb">Connect it in Home → Team</button>.' : "Jesús can connect it from Home → Team.") + "</div>";
    if (!m.linked) return head + '<div class="card fin-empty">' + qbLogo() + '<div><b>This job isn’t in QuickBooks yet</b><p class="muted small">Create it as a QuickBooks customer and its invoices, payments and costs flow both ways. Already there? Link it in Contract & billing.</p></div><div class="fe-acts"><button class="btn" data-a="qbCreateCust">Create it in QuickBooks</button><button class="link" data-a="tab" data-t="invoices">Link an existing one</button></div></div>';
    var inn = m.inn || {}, out = m.out || {}, owe = m.owe || {}, billed = inn.billed || 0, spent = out.total || 0, profit = billed - spent, mood = moneyMood(billed, spent);
    var margin = billed ? Math.round(profit / billed * 1000) / 10 : null;
    var hero = '<div class="card money-hero mood-' + mood[0] + '">' + piggy(mood[0], margin == null ? 0 : margin * 2.5) +
      '<div class="mh-txt"><div class="eyebrow">' + esc(m.customer || "This job") + " in QuickBooks</div><h2>" + esc(mood[1]) + '</h2><p class="muted">' + esc(mood[2]) + "</p></div>" +
      '<div class="mh-num"><div class="eyebrow">Profit so far</div><b class="' + (profit < 0 ? "neg" : "") + '">' + money(profit) + "</b><span>" + (margin == null ? "nothing billed yet" : margin + "% of what we billed") + "</span></div></div>";
    var tiles = '<div class="grid g4 money-tiles">' +
      stat("Money in", money(billed), money(inn.collected || 0) + " collected" + (m.contract ? " · contract " + money(m.contract) : "")) +
      stat("Still owed to us", money(inn.open || 0), inn.overdue ? '<span style="color:var(--bad)">' + money(inn.overdue) + " overdue. Go get it.</span>" : "Nobody’s late") +
      stat("Money out", money(spent), out.labor ? money(out.labor) + " of it is labor" : "Labor, materials, subs and more") +
      stat("We owe", money(owe.open || 0), owe.overdue ? '<span style="color:var(--bad)">' + money(owe.overdue) + " past due</span>" : (m.bills || []).length ? (m.bills || []).length + " open bill" + ((m.bills || []).length === 1 ? "" : "s") : "All bills paid") + "</div>";
    var segs = BUCKETS.filter(function (b) { return out[b[0]] > 0; });
    var where = '<div class="section-title"><h2>Where the money went</h2><span class="muted small">' + money(spent) + " so far</span></div>" + (spent > 0 ?
      '<div class="card"><div class="mbar" role="img" aria-label="' + esc(segs.map(function (b) { return b[1] + " " + money(out[b[0]]); }).join(", ")) + '">' + segs.map(function (b) { return '<i class="mb-' + b[0] + '" style="width:' + pctOf(out[b[0]], spent) + '%" title="' + esc(b[1] + " · " + money(out[b[0]])) + '"></i>'; }).join("") + "</div>" +
      '<div class="mlegend">' + BUCKETS.map(function (b) { return '<div class="ml-row' + (out[b[0]] ? "" : " zero") + '"><i class="mb-' + b[0] + '"></i><span>' + b[1] + "</span><b>" + money(out[b[0]] || 0) + '</b><small class="muted">' + pctOf(out[b[0]] || 0, spent) + "%</small></div>"; }).join("") + "</div>" +
      ((m.accounts || []).length ? '<details class="m-acc"><summary>How it was sorted</summary>' + m.accounts.map(function (a) { return '<div class="ml-row"><i class="mb-' + a.bucket + '"></i><span>' + esc(a.name) + "</span><b>" + money(a.amount) + "</b><small></small></div>"; }).join("") + '<p class="muted small">Sorted by the QuickBooks account name (payroll and wages = labor, materials and supplies = materials, subcontractors = subs).</p></details>' : "") + "</div>"
      : '<div class="empty">No costs tagged to this job yet. In QuickBooks, pick this customer in the “Customer/project” column of bills, checks, card charges and payroll.</div>');
    var mx = Math.max(billed, inn.collected || 0, spent, 1);
    var vs = '<div class="section-title"><h2>In vs out</h2></div><div class="card vs">' + [["Billed", billed, "in"], ["Collected", inn.collected || 0, "got"], ["Spent", spent, "out"]].map(function (r) { return '<div class="vs-row"><span>' + r[0] + '</span><div class="vs-track"><i class="vs-' + r[2] + '" style="width:' + pctOf(r[1], mx) + '%"></i></div><b>' + money(r[1]) + "</b></div>"; }).join("") + "</div>";
    var bills = (m.bills || []).length ? '<div class="section-title"><h2>Bills knocking on the door</h2><span class="muted small">' + money(owe.open || 0) + " for this job</span></div><div class=\"card m-list\">" + m.bills.map(function (b) {
      return '<div class="m-row has-logo' + (b.late ? " late" : "") + '">' + spLogo({ who: b.vendor, logo: b.logo }) + '<div><b>' + esc(b.vendor) + '</b><small class="muted">' + esc([b.what, b.number ? "#" + b.number : ""].filter(Boolean).join(" · ")) + '</small></div><span class="m-due">' + (b.due ? (b.late ? '<span class="pill bad">Late! was due ' + day(b.due) + "</span>" : "Due " + day(b.due)) : "") + "</span><b>" + money(b.amount) + "</b></div>"; }).join("") + "</div>" : "";
    var hrs = m.hours && m.hours.total ? '<div class="section-title"><h2>Crew hours</h2><span class="muted small">' + m.hours.total + " hours logged to this job</span></div><div class=\"card vs\">" + m.hours.people.map(function (h) { return '<div class="vs-row"><span>' + esc(h.name) + '</span><div class="vs-track"><i class="vs-hrs" style="width:' + pctOf(h.hours, m.hours.people[0].hours) + '%"></i></div><b>' + h.hours + " h</b></div>"; }).join("") + "</div>" : "";
    var recent = (m.recent || []).length ? '<div class="section-title"><h2>Latest spending</h2><span class="muted small">Last 6 months</span></div><div class="card m-list">' + m.recent.map(function (r) {
      return '<div class="m-row"><div><b>' + esc(r.who || r.what) + '</b><small class="muted">' + esc(r.what) + "</small></div><span class=\"m-due\"><i class=\"mdot mb-" + r.bucket + '"></i>' + day(r.date) + "</span><b>" + money(r.amount) + "</b></div>"; }).join("") + "</div>" : "";
    return head + moneyFlow(m, S.pid) + hero + tiles + where + vs + bills + hrs + moneyLists(m, S.pid) +
      '<p class="muted small m-foot">From QuickBooks' + (m.company ? " (" + esc(m.company) + ")" : "") + " · updated " + day(m.updated) + (m.cached ? " · saved copy, Refresh for the latest" : "") + ((m.warnings || []).length ? " · couldn’t read: " + esc(m.warnings.join(", ")) : "") + ".</p>";
  }

  /* ---------------- Spending: every charge with its store's logo, put on a job in one tap (it's saved in QuickBooks) ---------------- */
  function spKey(r) { return r.type + ":" + r.id + ":" + (r.line || ""); }
  function spLogo(r) {
    var name = String(r.who || "?").replace(/^the\s+/i, "").trim(), h = 0; name.split("").forEach(function (c) { h = (h * 31 + c.charCodeAt(0)) % 360; });
    return '<span class="sp-logo" style="--h:' + h + '" aria-hidden="true"><span>' + esc((name.charAt(0) || "?").toUpperCase()) + "</span>" +
      (r.logo ? '<img src="https://www.google.com/s2/favicons?domain=' + encodeURIComponent(r.logo) + '&amp;sz=64" alt="" loading="lazy" referrerpolicy="no-referrer" onerror="this.remove()">' : "") + "</span>";
  }
  async function loadSpend(k, params, more) {
    S.spend = S.spend || {}; S.spBusy = S.spBusy || {}; if (S.spBusy[k]) return; S.spBusy[k] = 1;
    var cur = S.spend[k];
    try {
      var r = await call("qbSpend", Object.assign({}, params, { offset: more && cur ? cur.rows.length : 0 }));
      if (more && cur) { r.rows = cur.rows.concat(r.rows); }
      r.params = params; S.spend[k] = r; S.spProjects = r.projects;
    } catch (e) { S.spend[k] = { err: e.message, params: params }; }
    S.spBusy[k] = 0; keepScroll(render);
  }
  function spFind(key) { var hit = null; Object.keys(S.spend || {}).forEach(function (k) { ((S.spend[k] || {}).rows || []).forEach(function (r) { if (spKey(r) === key) hit = hit || r; }); }); return hit; }
  function spRow(r, pid) {
    var key = spKey(r), undo = (S.spUndo || {})[key], projs = S.spProjects || [], cur = r.project ? r.project : r.cust ? "c:" + r.cust : "";
    var job = '<select class="sp-sel" data-sp-job="' + esc(key) + '" aria-label="Job"><option value="-"' + (cur ? "" : " selected") + ">No job</option>" +
      (r.cust && !r.project ? '<option value="c:' + esc(r.cust) + '" selected>' + esc(r.custName || "QuickBooks customer") + "</option>" : "") +
      projs.map(function (p) { return '<option value="' + esc(p.id) + '"' + (p.id === r.project ? " selected" : "") + ">" + esc(p.name) + "</option>"; }).join("") + "</select>";
    var cat = r.type === "TimeActivity" || r.item ? '<span class="sp-cat muted small">' + esc(r.account) + "</span>"
      : S.spCats && S.spCats.length ? '<select class="sp-sel cat" data-sp-cat="' + esc(key) + '" aria-label="Category">' + (S.spCats.some(function (c) { return c.id === r.accountId; }) ? "" : '<option value="">' + esc(r.account) + "</option>") +
          S.spCats.map(function (c) { return '<option value="' + esc(c.id) + '"' + (c.id === r.accountId ? " selected" : "") + ">" + esc(c.name) + "</option>"; }).join("") + "</select>"
      : '<button class="sp-cat link small" data-a="spCats" title="Change the category">' + esc(r.account || "Category") + "</button>";
    var quick = pid && !r.cust ? '<button class="btn sm sp-add" data-a="spAdd" data-key="' + esc(key) + '" data-pid="' + esc(pid) + '">Add to this job</button>' : "";
    return '<div class="sp-row b-' + esc(r.bucket || "other") + (S.spBusyRow === key ? " busy" : "") + '">' + spLogo(r) +
      '<div class="sp-main"><b>' + esc(r.who || r.what || "Charge") + '</b><small class="muted">' + esc([day(r.date), r.what && r.what !== r.who ? r.what : "", r.from].filter(Boolean).join(" · ")) + "</small></div>" +
      '<div class="sp-tags">' + cat + (quick || job) + (undo ? '<button class="link small" data-a="spUndo" data-key="' + esc(key) + '">Undo</button>' : "") + "</div>" +
      '<b class="sp-amt' + (r.amount < 0 ? " pos" : "") + '">' + (r.type === "TimeActivity" ? (r.hours || 0) + " h" + (r.amount ? '<small class="muted">' + money(r.amount) + "</small>" : "") : (r.amount < 0 ? "+" : "") + money(Math.abs(r.amount))) + "</b></div>";
  }
  function spList(k, s, pid) {
    if (!s) return '<div class="card sp-card"><p class="muted small">Loading charges…</p></div>';
    if (s.err) return '<div class="card sp-card"><p class="muted small">' + esc(s.err) + ' <button class="link" data-a="spReload" data-k="' + esc(k) + '">Try again</button></p></div>';
    if (!s.rows.length) return '<div class="card sp-card"><p class="muted small">' + (s.params && s.params.filter === "nojob" ? "Every charge is on a job. Nice." : "No charges here.") + "</p></div>";
    return '<div class="card sp-card">' + s.rows.map(function (r) { return spRow(r, pid); }).join("") +
      (s.more ? '<button class="btn ghost sm sp-more" data-a="spMore" data-k="' + esc(k) + '"' + (S.spBusy && S.spBusy[k] ? " disabled" : "") + ">Show more</button>" : "") + "</div>";
  }
  async function spAssign(key, val, kind) {
    var r = spFind(key); if (!r) return; S.spBusyRow = key; keepScroll(render);
    var body = { type: r.type, id: r.id, line: r.line || undefined };
    if (kind === "cat") body.accountId = val;
    else if (val === "-") body.customerId = "";
    else if (val.indexOf("c:") === 0) body.customerId = val.slice(2);
    else body.projectId = val;
    try {
      var res = await call("qbAssign", body); S.spUndo = S.spUndo || {}; S.spUndo[key] = res.logId;
      if (kind === "cat") { r.accountId = val; r.account = ((S.spCats || []).filter(function (c) { return c.id === val; })[0] || {}).name || r.account; }
      else { r.project = body.projectId || ""; r.cust = body.projectId ? ((S.spProjects || []).filter(function (p) { return p.id === body.projectId; })[0] || {}).qb || "x" : body.customerId || ""; if (body.projectId && res.project) (S.spProjects || []).forEach(function (p) { if (p.id === res.project && !p.qb) p.qb = r.cust; }); }
      toast(kind === "cat" ? "Category changed in QuickBooks" : body.customerId === "" ? "Taken off the job in QuickBooks" : "Put on the job in QuickBooks");
      S.fin = null; spRefreshAll();
    } catch (e) { toast(e.message); }
    S.spBusyRow = null; keepScroll(render);
  }
  /* After a change: totals and lists refresh in the background, keeping what's on screen until the new numbers arrive. */
  function spRefreshAll() {
    if (S.money) Object.keys(S.money).forEach(function (k) { if (k !== S.pid) delete S.money[k]; });
    if (S.pid && S.money && S.money[S.pid] && !S.money[S.pid].err) loadMoney(true);
    Object.keys(S.spend || {}).forEach(function (k) { if (k !== "fin" && S.spend[k] && S.spend[k].params) { var pr = S.spend[k].params; S.spend[k].params = null; S.spend[k].params = pr; loadSpend(k, pr); } });
  }
  function finSpending() {
    var fl = S.spF || { filter: "all", q: "", days: 60 }, k = "fin", s = (S.spend || {})[k];
    var params = { filter: fl.filter, q: fl.q, days: fl.days, limit: 40 };
    if (!s || JSON.stringify(s.params) !== JSON.stringify(params)) { if (!(S.spBusy || {})[k]) loadSpend(k, params); }
    var head = '<div class="section-title"><div><h2>Spending</h2><span class="muted small">Every card charge, check, bill and timesheet. Pick the job or category and it’s saved in QuickBooks.</span></div></div>' +
      '<div class="sp-bar"><div class="chips ck-filter">' + [["all", "All"], ["nojob", "No job yet"]].map(function (o) { return '<button class="chip' + (fl.filter === o[0] ? " on" : "") + '" data-a="spFilter" data-v="' + o[0] + '">' + o[1] + "</button>"; }).join("") + "</div>" +
      '<input type="search" class="sp-q" data-sp-q placeholder="Search Home Depot, lumber, a job…" value="' + esc(fl.q) + '">' +
      '<select class="sp-sel" data-sp-days aria-label="Period">' + [[30, "Last 30 days"], [60, "Last 60 days"], [90, "Last 90 days"], [180, "Last 6 months"], [365, "Last year"]].map(function (o) { return '<option value="' + o[0] + '"' + (o[0] === fl.days ? " selected" : "") + ">" + o[1] + "</option>"; }).join("") + "</select></div>";
    var sum = s && !s.err && s.rows ? '<div class="sp-sum"><span><b>' + s.count + "</b> charges</span><span><b>" + m0(s.total) + "</b> spent</span>" + (s.noJob ? '<span class="warn"><b>' + m0(s.noJob) + '</b> with no job · <button class="link" data-a="spFilter" data-v="nojob">put them on a job</button></span>' : '<span class="ok">Everything is on a job</span>') + "</div>" : "";
    return head + sum + spList(k, s && JSON.stringify(s.params) === JSON.stringify(params) ? s : null);
  }
  /* Inside a project (#money): what came in, what went out, and the charges that still need a job. */
  function moneyFlow(m, pid) {
    var inn = m.inn || {}, out = m.out || {}, billed = inn.billed || 0, got = inn.collected || 0, spent = out.total || 0, profit = billed - spent, cash = got - spent, c = m.contract || 0;
    var step = function (lbl, val, sub, cls, act) { return '<div class="mf-step ' + cls + '"><span class="eyebrow">' + lbl + "</span><b>" + money(val) + "</b><small>" + sub + "</small>" + (act || "") + "</div>"; };
    return '<div class="card mflow">' +
      step("Contract", c, c ? "the job" : "add contract lines", "c", '<button class="link small" data-a="tab" data-t="invoices">Contract</button>') + '<i class="mf-arrow">→</i>' +
      step("Invoiced", billed, c ? pctOf(billed, c) + "% of the contract" : (inn.count || 0) + " invoices", "inv", '<button class="link small" data-a="modal" data-m="invoice">＋ New invoice</button>') + '<i class="mf-arrow">→</i>' +
      step("Collected", got, inn.open ? money(inn.open) + " still owed" : "all collected", "got", '<button class="link small" data-a="tab" data-t="invoices">Record a payment</button>') + '<i class="mf-arrow">→</i>' +
      step("Spent", spent, out.labor ? money(out.labor) + " labor" : "labor, materials, subs", "out", '<button class="link small" data-a="spJump">＋ Add costs</button>') + '<i class="mf-arrow">=</i>' +
      step("Profit so far", profit, (billed ? Math.round(profit / billed * 100) + "% of billed · " : "") + "cash in hand " + m0(cash), profit < 0 ? "neg" : "pro") + "</div>";
  }
  function moneyLists(m, pid) {
    var kj = "pj:" + pid, kn = "pn:" + pid, sj = (S.spend || {})[kj], sn = (S.spend || {})[kn];
    if (!sj && !(S.spBusy || {})[kj]) loadSpend(kj, { projectId: pid, days: 365, limit: 25 });
    if (!sn && !(S.spBusy || {})[kn]) loadSpend(kn, { filter: "nojob", days: 60, limit: 15 });
    var pays = (m.payments || []).length ? '<div class="section-title"><h2>Money in</h2><span class="muted small">Payments received in QuickBooks</span></div><div class="card m-list">' + m.payments.map(function (y) {
      return '<div class="m-row"><div><b>' + money(y.amount) + '</b><small class="muted">' + esc([y.method, y.ref ? "#" + y.ref : ""].filter(Boolean).join(" · ") || "Payment") + '</small></div><span class="m-due">' + day(y.date) + "</span><b class=\"pos\">+" + money(y.amount) + "</b></div>"; }).join("") + "</div>" : "";
    return pays + '<div class="section-title"><h2>Costs on this job</h2><span class="muted small">Last 12 months · change the job or category right here</span></div>' + spList(kj, sj) +
      '<div class="section-title" id="sp-nojob"><h2>Charges with no job yet</h2><span class="muted small">Last 60 days. If it was for this job, add it: QuickBooks gets it too.</span></div>' + spList(kn, sn, pid);
  }
  /* ---------------- Home → Finances (#money): the whole company, Monarch-style, from QuickBooks ---------------- */
  async function loadFin(refresh) {
    if (S.finBusy) return; S.finBusy = 1; if (refresh && S.fin) S.fin.refreshing = true;
    if (!S.fin && !refresh) { var old = cacheGet("fin"); if (old && old.connected) { S.fin = Object.assign(old, { refreshing: true, cached: true }); } }
    try { var fr = await call("qbFinance", { refresh: !!refresh }); S.fin = fr; if (fr && fr.connected && !fr.err) cacheSet("fin", fr); } catch (e) { if (!S.fin || !S.fin.connected) S.fin = { err: e.message }; else { S.fin.refreshing = false; toast("Couldn't refresh from QuickBooks: " + e.message); } }
    S.finBusy = 0; if (!S.pid && S.home === "finance") keepScroll(render);
  }
  async function finLink(sel) {
    var v = sel.value; if (!v) return; sel.disabled = true;
    try {
      if (sel.dataset.finLink != null) {
        var job = (S.fin.jobs || []).concat(S.fin.customers || []).filter(function (j) { return j.id === sel.dataset.finLink; })[0] || {};
        if (v === "new") { var r = await call("qbNewProject", { customerId: sel.dataset.finLink, name: job.short || job.name || "New project", client: job.short || job.name || "" }); S.projects = null; refreshList(); toast("Project created and linked: " + r.project.name); }
        else { await call("qbLink", { projectId: v, customerId: sel.dataset.finLink }); toast("Linked"); }
      } else { await call("qbLink", { projectId: sel.dataset.finProj, customerId: v }); toast("Linked"); }
      await loadFin(false);
    } catch (e) { sel.disabled = false; sel.value = ""; toast(e.message); }
  }
  function m0(n) { return (n < 0 ? "−" : "") + "$" + Math.abs(Math.round(n || 0)).toLocaleString("en-US"); }
  function mK(n) { var a = Math.abs(n || 0); return (n < 0 ? "−" : "") + "$" + (a >= 1e6 ? (a / 1e6).toFixed(1) + "M" : a >= 1e3 ? Math.round(a / 1e3) + "k" : Math.round(a)); }
  function finChart(months) {
    if (!months.length) return '<div class="empty small">No monthly numbers yet.</div>';
    var W = 720, H = 230, L = 52, B = 30, T = 14, n = months.length, gw = (W - L - 8) / n, bw = Math.max(4, Math.min(18, gw * 0.32));
    var nets = months.map(function (m) { return m.income - m.expenses; });
    var hi = Math.max.apply(null, months.map(function (m) { return Math.max(m.income, m.expenses); }).concat(nets, [1])), lo = Math.min(0, Math.min.apply(null, nets));
    var y = function (v) { return T + (hi - v) / (hi - lo) * (H - T - B); }, y0 = y(0), out = [];
    [hi, hi / 2].forEach(function (g) { out.push('<line x1="' + L + '" x2="' + W + '" y1="' + y(g).toFixed(1) + '" y2="' + y(g).toFixed(1) + '" class="fc-grid"/><text x="' + (L - 8) + '" y="' + (y(g) + 4).toFixed(1) + '" class="fc-ax" text-anchor="end">' + esc(mK(g)) + "</text>"); });
    if (lo < 0) out.push('<text x="' + (L - 8) + '" y="' + (y(lo) + 4).toFixed(1) + '" class="fc-ax" text-anchor="end">' + esc(mK(lo)) + "</text>");
    out.push('<line x1="' + L + '" x2="' + W + '" y1="' + y0.toFixed(1) + '" y2="' + y0.toFixed(1) + '" class="fc-zero"/>');
    var pts = [];
    months.forEach(function (m, i) {
      var cx = L + gw * i + gw / 2, xi = cx - bw - 1, xo = cx + 1, net = m.income - m.expenses;
      var bar = function (x, v, cls) { var top = y(Math.max(v, 0)), h = Math.max(0, y0 - top); return h ? '<path class="' + cls + '" d="M' + x + "," + y0 + "V" + (top + Math.min(4, h)) + "Q" + x + "," + top + " " + (x + Math.min(4, bw / 2)) + "," + top + "H" + (x + bw - Math.min(4, bw / 2)) + "Q" + (x + bw) + "," + top + " " + (x + bw) + "," + (top + Math.min(4, h)) + "V" + y0 + 'Z"/>' : ""; };
      out.push(bar(xi, m.income, "fc-in") + bar(xo, m.expenses, "fc-out"));
      out.push('<text x="' + cx + '" y="' + (H - 9) + '" class="fc-ax" text-anchor="middle">' + esc(String(m.label).split(" ")[0].slice(0, 3)) + "</text>");
      out.push('<rect class="fc-hit" x="' + (L + gw * i) + '" y="' + T + '" width="' + gw + '" height="' + (H - T - B) + '" tabindex="0" data-tip="' + esc(m.label + "|In " + m0(m.income) + "|Out " + m0(m.expenses) + "|" + (net >= 0 ? "Kept " : "Lost ") + m0(Math.abs(net))) + '"/>');
      pts.push(cx.toFixed(1) + "," + y(net).toFixed(1));
    });
    out.push('<polyline class="fc-net" points="' + pts.join(" ") + '"/>' + pts.map(function (pt) { var c = pt.split(","); return '<circle class="fc-dot" cx="' + c[0] + '" cy="' + c[1] + '" r="3.5"/>'; }).join(""));
    var last = months[months.length - 1];
    return '<div class="fc-legend"><span><i class="fc-k in"></i>Money in</span><span><i class="fc-k out"></i>Money out</span><span><i class="fc-k net"></i>What we kept</span></div>' +
      '<svg class="fin-chart" viewBox="0 0 ' + W + " " + H + '" role="img" aria-label="' + esc("Last " + n + " months of money in and out. " + last.label + ": in " + m0(last.income) + ", out " + m0(last.expenses)) + '">' + out.join("") + "</svg>" +
      '<details class="fc-table"><summary>See the numbers</summary><table><tr><th>Month</th><th>In</th><th>Out</th><th>Kept</th></tr>' + months.map(function (m) { return "<tr><td>" + esc(m.label) + "</td><td>" + m0(m.income) + "</td><td>" + m0(m.expenses) + "</td><td>" + m0(m.income - m.expenses) + "</td></tr>"; }).join("") + "</table></details>";
  }
  function homeFinance() {
    var f = S.fin;
    if (!f) { loadFin(false); return '<div class="loading" style="min-height:30vh">Counting every dollar…</div>'; }
    if (f.err) return '<div class="card fin-empty fin-err">' + qbLogo() + '<div><b>QuickBooks isn’t sharing the numbers yet</b><p class="muted small">' + esc(f.err) + '</p></div><div class="fe-acts"><button class="btn" data-a="homeView" data-v="team">Go to Team</button><button class="link" data-a="finRefresh">Try again</button></div></div>';
    if (!f.connected) return '<div class="card fin-empty">' + qbLogo() + "<div><b>Connect QuickBooks to see the whole picture</b><p class=\"muted small\">Cash, what clients owe us, bills due, payroll and profit for every job, all in one place.</p></div><button class=\"btn\" data-a=\"homeView\" data-v=\"team\">Connect it</button></div>";
    var cash = f.cash || { total: 0, accounts: [] }, cards = f.cards || { total: 0, accounts: [] }, ar = f.ar || {}, ap = f.ap || {}, y = f.ytd || {};
    var stand = cash.total + (ar.open || 0) - (ap.open || 0) - cards.total, mood = moneyMood(y.income || 0, y.expenses || 0), kept = (y.income || 0) - (y.expenses || 0);
    var margin = y.income ? Math.round(kept / y.income * 1000) / 10 : null;
    var hero = '<div class="card fin-hero mood-' + mood[0] + '"><div class="fh-main"><div class="eyebrow">Where Blue Sierra stands today</div><b class="fh-big' + (stand < 0 ? " neg" : "") + '">' + m0(stand) + "</b>" +
      '<p class="muted small">Cash in the bank + what clients owe us − bills we owe − credit cards.</p>' +
      '<div class="fh-pills"><span class="fp in">' + ICON.paid + " Bank <b>" + m0(cash.total) + '</b></span><span class="fp ar">' + ICON.receipt + " Owed to us <b>" + m0(ar.open) + "</b>" + (ar.overdue ? ' <em>' + m0(ar.overdue) + " late</em>" : "") + "</span>" +
      '<span class="fp ap">' + ICON.receipt + " We owe <b>" + m0(ap.open) + "</b>" + (ap.overdue ? " <em>" + m0(ap.overdue) + " late</em>" : "") + '</span><span class="fp cc">' + ICON.dollar + " Cards <b>" + m0(cards.total) + "</b></span></div></div>" +
      '<div class="fh-side">' + piggy(mood[0], margin == null ? 0 : margin * 2.5) + "<b>" + esc(mood[1]) + '</b><span class="muted small">This year: ' + m0(y.income) + " in, " + m0(y.expenses) + " out" + (margin == null ? "" : " · " + margin + "% kept") + "</span></div></div>";
    var segs = BUCKETS.filter(function (b) { return y[b[0]] > 0; });
    var year = '<div class="card fin-year"><div class="section-mini"><h3>Where this year’s money went</h3><span class="muted small">' + m0(y.expenses) + "</span></div>" +
      (y.expenses ? '<div class="mbar">' + segs.map(function (b) { return '<i class="mb-' + b[0] + '" style="width:' + pctOf(y[b[0]], y.expenses) + '%" data-tip="' + esc(b[1] + "|" + m0(y[b[0]]) + "|" + pctOf(y[b[0]], y.expenses) + "% of spending") + '"></i>'; }).join("") + "</div>" +
        '<div class="mlegend">' + BUCKETS.map(function (b) { return '<div class="ml-row' + (y[b[0]] ? "" : " zero") + '"><i class="mb-' + b[0] + '"></i><span>' + b[1] + "</span><b>" + m0(y[b[0]] || 0) + '</b><small class="muted">' + pctOf(y[b[0]] || 0, y.expenses) + "%</small></div>"; }).join("") + "</div>" +
        ((y.top || []).length ? '<div class="fin-top">' + y.top.map(function (a) { return '<div class="ft-row"><i class="mdot mb-' + a.bucket + '"></i><span>' + esc(a.name) + "</span><b>" + m0(a.amount) + "</b></div>"; }).join("") + "</div>" : "")
        : '<p class="muted small">No spending recorded in QuickBooks this year yet.</p>') + "</div>";
    var flow = '<div class="card fin-flow"><div class="section-mini"><h3>Money in vs out</h3><span class="muted small">Last 12 months</span></div>' + finChart(f.months || []) + "</div>";
    var accts = '<div class="card fin-acc"><div class="section-mini"><h3>Accounts</h3><span class="muted small">' + m0(cash.total - cards.total) + " net</span></div>" +
      (cash.accounts.length + cards.accounts.length ? cash.accounts.map(function (a) { return '<div class="fa-row">' + (a.logo ? spLogo({ who: a.name, logo: a.logo }) : '<span class="fa-ico bank">' + ICON.paid + "</span>") + "<span>" + esc(a.name) + "</span><b>" + m0(a.balance) + "</b></div>"; }).join("") +
        cards.accounts.map(function (a) { return '<div class="fa-row">' + (a.logo ? spLogo({ who: a.name, logo: a.logo }) : '<span class="fa-ico cc">' + ICON.dollar + "</span>") + "<span>" + esc(a.name) + "<small>" + (a.balance < 0 ? "credit" : "owed") + "</small></span>" + (a.balance < 0 ? '<b class="pos">+' + m0(-a.balance) + "</b>" : '<b class="neg">−' + m0(a.balance) + "</b>") + "</div>"; }).join("") : '<p class="muted small">No bank or card accounts in QuickBooks.</p>') + "</div>";
    var bills = '<div class="card fin-bills"><div class="section-mini"><h3>Bills knocking on the door</h3><span class="muted small">' + (ap.count || 0) + " open</span></div>" +
      ((ap.soon || []).length ? ap.soon.map(function (b) { return '<div class="fa-row' + (b.late ? " late" : "") + '">' + spLogo({ who: b.vendor, logo: b.logo }) + "<span>" + esc(b.vendor) + "<small>" + (b.late ? "Late! was due " : "Due ") + day(b.due) + "</small></span><b>" + m0(b.amount) + "</b></div>"; }).join("") : '<p class="muted small">Nothing due in the next two weeks. Nice.</p>') + (ap.stale && ap.stale.count ? '<p class="muted small fin-stale">+ ' + ap.stale.count + " bills more than 60 days late (" + m0(ap.stale.amount) + "). If they were already paid, mark them paid in QuickBooks so this number is real.</p>" : "") + "</div>";
    // Jobs ↔ projects
    var projects = f.projects || [], byQb = {}; projects.forEach(function (p) { if (p.qb) byQb[p.qb] = p; });
    var free = projects.filter(function (p) { return !p.qb && p.status !== "archived"; });
    var ff = S.finFilter || "all", jobs = (f.jobs || []).filter(function (j) { return ff === "all" || (ff === "linked" ? byQb[j.id] : !byQb[j.id]); });
    var linkSel = function (j) { return '<select class="fin-sel" data-fin-link="' + esc(j.id) + '"><option value="">Link to a project…</option>' + free.map(function (p) { return '<option value="' + esc(p.id) + '">' + esc(p.name) + "</option>"; }).join("") + (f.admin ? '<option value="new">＋ New project “' + esc(j.name) + "”</option>" : "") + "</select>"; };
    var jobRow = function (j) {
      var p = byQb[j.id], mg = j.income ? Math.round(j.net / j.income * 100) : null, tone = j.net < 0 ? "bad" : mg != null && mg >= 15 ? "good" : "tight";
      return '<div class="fj-row"><div class="fj-name"><b>' + esc(j.name) + "</b><small>" + m0(j.income) + " billed · " + m0(j.costs) + " spent</small>" +
        '<div class="fj-bar" data-tip="' + esc(j.name + "|Billed " + m0(j.income) + "|Spent " + m0(j.costs) + "|" + (j.net >= 0 ? "Kept " : "Lost ") + m0(Math.abs(j.net))) + '"><i style="width:' + Math.min(100, pctOf(j.costs, Math.max(j.income, j.costs))) + '%"></i></div></div>' +
        '<div class="fj-net ' + tone + '"><b>' + (j.net >= 0 ? "+" : "") + m0(j.net) + "</b>" + (mg != null ? "<small>" + mg + "% margin</small>" : "") + "</div>" +
        '<div class="fj-link">' + (p ? '<button class="fj-proj" data-a="open" data-id="' + esc(p.id) + '">' + ICON.ruler + " " + esc(p.name) + '</button><button class="icon-btn sm" data-a="finUnlink" data-pid="' + esc(p.id) + '" title="Unlink" aria-label="Unlink">' + ICON.x + "</button>" : linkSel(j)) + "</div></div>";
    };
    var unlinkedJobs = (f.customers || []).filter(function (c) { return !byQb[c.id]; });
    var jobsCard = '<div class="section-title"><div><h2>Jobs</h2><span class="muted small">Every QuickBooks customer and job, all time. Link each one to its project and its #money tab fills itself.</span></div></div>' +
      '<div class="chips ck-filter">' + [["all", "All"], ["linked", "Linked"], ["free", "Not linked"]].map(function (o) { return '<button class="chip' + (ff === o[0] ? " on" : "") + '" data-a="finFilter" data-v="' + o[0] + '">' + o[1] + "</button>"; }).join("") + "</div>" +
      '<div class="card fin-jobs">' + (jobs.length ? jobs.map(jobRow).join("") : '<p class="muted small">' + (ff === "all" ? "No customers with income or costs yet." : "Nothing here.") + "</p>") + (f.unassigned ? '<p class="muted small fin-stale">' + m0(f.unassigned) + " of costs in QuickBooks have no customer or job, so they don’t count toward any job above.</p>" : "") + "</div>" +
      (free.length ? '<div class="section-title"><div><h2>Projects without QuickBooks</h2><span class="muted small">Pick the customer or job each one belongs to.</span></div></div><div class="card fin-jobs">' +
        free.map(function (p) { return '<div class="fj-row"><div class="fj-name"><b>' + esc(p.name) + '</b><small>Portal project</small></div><div></div><div class="fj-link"><select class="fin-sel" data-fin-proj="' + esc(p.id) + '"><option value="">Pick its QuickBooks customer…</option>' + unlinkedJobs.map(function (c) { return '<option value="' + esc(c.id) + '">' + esc(c.name) + "</option>"; }).join("") + "</select></div></div>"; }).join("") + "</div>" : "");
    return '<div class="section-title fin-head"><div><h2>Finances</h2><span class="muted small">' + esc(f.company || "From QuickBooks") + (f.env === "sandbox" ? " · sandbox" : "") + " · only you and #money see this</span></div>" +
      '<button class="btn ghost sm" data-a="finRefresh"' + (f.refreshing ? " disabled" : "") + ">" + (f.refreshing ? "Counting…" : "Refresh") + "</button></div>" +
      hero + '<div class="fin-grid">' + flow + year + "</div>" + '<div class="fin-grid">' + accts + bills + "</div>" + finSpending() + jobsCard +
      '<p class="muted small m-foot">From QuickBooks · updated ' + day(f.updated) + (f.cached ? " · saved copy, Refresh for the latest" : "") + ((f.warnings || []).length ? " · couldn’t read: " + esc(f.warnings.join(", ")) : "") + ".</p>";
  }
  /* One small tooltip for every chart mark with data-tip="Title|line|line" (hover or keyboard focus). */
  (function () {
    var tip = null;
    function show(el) {
      if (!tip) { tip = document.createElement("div"); tip.className = "bsp-tip"; tip.setAttribute("role", "tooltip"); document.body.appendChild(tip); }
      var parts = String(el.getAttribute("data-tip")).split("|"); tip.textContent = "";
      parts.forEach(function (t, i) { var d = document.createElement(i ? "span" : "b"); d.textContent = t; tip.appendChild(d); });
      var r = el.getBoundingClientRect(); tip.style.display = "flex";
      var x = Math.min(window.innerWidth - tip.offsetWidth - 8, Math.max(8, r.left + r.width / 2 - tip.offsetWidth / 2)), yy = r.top - tip.offsetHeight - 8;
      tip.style.left = x + "px"; tip.style.top = (yy < 8 ? r.bottom + 8 : yy) + "px";
    }
    function hide() { if (tip) tip.style.display = "none"; }
    root.addEventListener("mouseover", function (e) { var el = e.target.closest && e.target.closest("[data-tip]"); if (el) show(el); else hide(); });
    root.addEventListener("focusin", function (e) { var el = e.target.closest && e.target.closest("[data-tip]"); if (el) show(el); });
    root.addEventListener("focusout", hide); window.addEventListener("scroll", hide, { passive: true });
  })();

  function checkRow(c) {
    var done = isDone(c.done), can = c.can != null ? c.can : staff() || (c.owner === "client" && asClient()), pinned = isPinned(c);
    var mineTxt = c.mine ? '<span class="pill gold">Yours</span>' : "";
    var as = c.assignees || (c.assignee ? [c.assignee] : []);
    var who = as.length ? '<span class="assignee" title="Assigned to ' + esc(as.map(function (a) { return a.name; }).join(", ")) + '"><span class="faces">' + as.slice(0, 4).map(function (a) { return av(a.name, a.avatar, a.role, "xs", a.key); }).join("") + "</span><span>" + esc(first(as[0].name) + (as.length > 1 ? " +" + (as.length - 1) : "")) + "</span></span>" :
      (c.aud && c.aud.length ? "" : '<span class="pill ' + (c.owner === "client" ? "gold" : "") + '">' + (c.owner === "client" ? (!asClient() ? "Client" : "You") : "Blue Sierra") + "</span>");
    var df = c.doneFoot, ef = c.edited;
    return '<div class="ck ' + (done ? "done" : "") + (pinned ? " pinned" : "") + (c.mine && !done ? " mine" : "") + '" id="ck-' + esc(c.id) + '"><button class="box" data-a="toggle" data-id="' + esc(c.id) + '"' + (can ? "" : " disabled") + ' aria-label="' + (done ? "Mark not done" : "Mark done") + '">' + (done ? "✓" : "") + "</button>" +
      '<div class="ck-main"><span class="txt">' + esc(c.item) + "</span>" +
        '<div class="ck-meta">' + tagChips(c.aud) + mineTxt +
        (done && df ? '<span class="ck-foot">' + foot(df, "Done by") + "Done by " + esc(first(df.name)) + " · " + day(df.at || c.done_at) + "</span>" : c.due ? "<small>Due " + day(c.due) + "</small>" : "") +
        (!done && ef && staff() ? '<span class="ck-foot muted">' + foot(ef, "Last edited by") + "</span>" : "") +
        (c.reactions || []).map(function (r) { return '<button class="rx' + (r.mine ? " mine" : "") + '" data-a="ckReact" data-id="' + esc(c.id) + '" data-e="' + esc(r.e) + '" title="' + esc(r.who.join(", ")) + '">' + r.e + " " + r.n + "</button>"; }).join("") +
        ((c.reactions || []).some(function (r) { return r.mine && r.e === "👍"; }) ? "" : '<button class="rx add" data-a="ckReact" data-id="' + esc(c.id) + '" data-e="👍" title="Like">👍</button>') + "</div></div>" +
      who +
      (staff() ? '<span class="ck-tools"><button class="icon-btn" data-a="pin" data-kind="check" data-id="' + esc(c.id) + '" title="' + (pinned ? "Unpin" : "Pin to Home") + '">📌</button><button class="icon-btn" data-a="modal" data-m="check" data-id="' + esc(c.id) + '" aria-label="Edit">✎</button><button class="icon-btn" data-a="delCheck" data-id="' + esc(c.id) + '" aria-label="Delete">×</button></span>' : "<span></span>") + "</div>";
  }
  function tabChecklist() {
    var all = S.data.checklist, f = S.ckFilter || "all";
    var has = function (a) { return all.some(function (c) { return (c.aud || []).indexOf(a) > -1; }); };
    var filters = [["all", "All"], ["mine", "Mine"]].concat(["client", "architect", "team", "crew"].filter(has).map(function (a) { return [a, "#" + a]; }));
    var list = f === "all" ? all : f === "mine" ? all.filter(function (c) { return c.mine; }) : all.filter(function (c) { return (c.aud || []).indexOf(f) > -1; });
    var groups = PHASES.map(function (ph) { return [ph, list.filter(function (c) { return c.phase === ph; })]; }).filter(function (g) { return g[1].length; });
    var done = list.filter(function (c) { return isDone(c.done); }).length;
    return '<div class="section-title" style="margin-top:0"><div><h2>Checklist</h2><span class="muted small">' + done + " of " + list.length + " done" + (!asClient() ? "" : " · you can check off the items marked “You”") + "</span></div>" +
      (staff() ? '<button class="btn sm" data-a="modal" data-m="check">Add item</button>' : "") + "</div>" +
      (filters.length > 2 || all.some(function (c) { return c.mine; }) ? '<div class="chips ck-filter">' + filters.map(function (o) { return '<button class="chip' + (f === o[0] ? " on" : "") + '" data-a="ckFilter" data-v="' + o[0] + '">' + o[1] + "</button>"; }).join("") + "</div>" : "") +
      (groups.length ? groups.map(function (g) { return '<div class="phase-group"><h3>' + esc(g[0]) + (g[0] === S.data.project.phase ? ' <span class="pill dark">Current phase</span>' : "") + "</h3>" + g[1].map(checkRow).join("") + "</div>"; }).join("") : '<div class="empty">' + (f === "mine" ? "Nothing assigned to you here. 🎉" : "No checklist items yet.") + "</div>");
  }

  function tabPeople() {
    var ppl = S.data.people || [];
    return '<div class="section-title" style="margin-top:0"><h2>People on this project</h2>' + (S.me.admin ? '<button class="btn ghost sm" data-a="modal" data-m="viewAs">' + ICON.eye + " Preview as…</button>" : "") + '</div><div class="card" style="display:flex;flex-direction:column;gap:12px">' +
      ppl.map(function (x) { return '<div style="display:flex;align-items:center;gap:12px">' + av(x.name, x.avatar, x.role) + '<div style="flex:1"><b style="font-weight:500">' + esc(x.name) + '</b><div class="muted small">' + esc(x.email) + "</div></div>" +
        '<span class="role-chips">' + roleChip(x.role, x.money) + "</span>" + (x.email !== S.me.email && (S.me.admin || ["client", "architect", "crew"].indexOf(x.role) > -1) ? '<button class="btn ghost sm" data-a="modal" data-m="role" data-email="' + esc(x.email) + '" data-from="project">Change</button>' : "") +
        (x.role === "client" || x.role === "architect" || x.role === "crew" ? '<button class="icon-btn" data-a="removePerson" data-email="' + esc(x.email) + '" aria-label="Remove access">×</button>' : "") + "</div>"; }).join("") + "</div>" +
      '<form class="card form" data-form="person" style="margin-top:16px"><h3>Give someone access</h3><div class="row2"><label class="f">Name<input type="text" name="name" required></label><label class="f">Email<input type="email" name="email" required></label></div>' +
      '<div class="f"><span>Role</span>' + rolePicker("client", ["client", "architect", "crew"].concat(S.me.admin ? ["staff"] : [])) + "</div>" +
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
  /* The little face on a schedule item: who asked for a change (gold ring), or who changed it last. */
  function schedFoot(x) { return x.req ? foot(x.req, "Change requested by", "req") : x.edited ? foot(x.edited, "Changed by") : ""; }
  function itemRow(x) {
    var when = day(x.start) + (x.end && x.end !== x.start ? " → " + day(x.end) : "");
    return '<button class="sch-row" data-a="schedView" data-id="' + esc(x.id) + '"><span class="sch-dot k-' + esc(x.kind) + '"></span><span class="sch-when">' + when + "</span><span><b>" + schedFoot(x) + esc(x.title) + '</b><span class="muted small">' + esc(kindLabel(x.kind)) + (x.owner === "client" ? (!asClient() ? " · client" : " · you") : "") + (x.derived ? " · from " + esc(x.derived) : "") + "</span></span>" +
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
      return '<div class="g-label"><b title="' + esc(x.title) + '">' + schedFoot(x) + esc(x.title) + '</b><span class="muted small">' + day(x.start) + " → " + day(x.end) + "</span></div>" +
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
  /* ---- the character maker (profile) ---- */
  var MK_TABS = [["hair", "Hair"], ["face", "Face"], ["gear", "Hats & gear"], ["outfit", "Outfit"], ["color", "Color"]];
  var MK_MOOD = { "22": "Smile", "25": "Grin", "08": "Big grin", "03": "Happy", "14": "Cheerful", "06": "Toothy", "12": "Cheeky", "30": "Smirk", "15": "Whistle", "29": "Wow" };
  function makerHtml() {
    var o = S.scDraft, tab = S.scTab || "hair";
    if (!CREW) return '<div class="loading" style="min-height:30vh">Getting the crew ready…</div>';
    var opt = function (k, v, crop, label, extra) {
      var t = Object.assign({}, o, extra || {}); t[k] = v;
      return '<button type="button" class="mk-opt' + (String(o[k]) === String(v) && !(extra && extra.x !== undefined && extra.x !== o.x) ? " on" : "") + '" data-a="scSet" data-k="' + k + '" data-v="' + esc(v) + '"' + (label ? ' title="' + esc(label) + '"' : "") + ' style="background:' + SC_BG[o.c] + '"><img src="' + scUrl(t, crop) + '" alt="' + esc(label || "") + '" loading="lazy"></button>';
    };
    var none = function (k) { return '<button type="button" class="mk-opt mk-none' + (!o[k] ? " on" : "") + '" data-a="scSet" data-k="' + k + '" data-v="">None</button>'; };
    var row = function (title, html) { return '<div class="mk-row"><span class="mk-label">' + title + '</span><div class="mk-strip">' + html + "</div></div>"; };
    var body = "";
    if (tab === "hair") body = (o.x && o.x !== "" ? '<p class="mk-note">Your hat is covering your hair. Pick a hairstyle and the hat comes off.</p>' : "") +
      '<div class="mk-grid">' + scKeys("hair").filter(function (k) { return k !== "hat"; }).map(function (k) { return opt("h", k, SC_HEAD, "Hair " + k, { x: "" }); }).join("") + "</div>";
    if (tab === "face") body = row("Mood", scKeys("lips").map(function (k) { return opt("l", k, SC_FACE, MK_MOOD[k]); }).join("")) +
      row("Eyes", scKeys("eyes").map(function (k) { return opt("e", k, SC_FACE); }).join("")) +
      row("Brows", scKeys("brows").map(function (k) { return opt("b", k, SC_FACE); }).join("")) +
      row("Nose", scKeys("nose").map(function (k) { return opt("n", k, SC_FACE); }).join("")) +
      row("Glasses", none("g") + scKeys("glasses").map(function (k) { return opt("g", k, SC_FACE); }).join("")) +
      row("Beard", none("d") + scKeys("beard").map(function (k) { return opt("d", k, SC_HEAD); }).join(""));
    if (tab === "gear") body = row("Hat", SC_HATS.map(function (hh) { return opt("x", hh[0], SC_FULL, hh[1]); }).join("")) +
      row("Safety vest", opt("v", 0, SC_FULL, "No vest") + opt("v", 1, SC_FULL, "Hi-vis vest"));
    if (tab === "outfit") body = (o.v ? '<p class="mk-note">The vest is on. Pick an outfit and it comes off.</p>' : "") + '<div class="mk-grid">' + scKeys("body").map(function (k) { return opt("y", k, SC_FULL, "Outfit", { v: 0 }); }).join("") + "</div>";
    if (tab === "color") body = '<div class="mk-colors">' + SC_BG.map(function (c, i) { return '<button type="button" class="mk-sw' + (o.c === i ? " on" : "") + '" data-a="scSet" data-k="c" data-v="' + i + '" style="background:' + c + '" aria-label="Color ' + (i + 1) + '"></button>'; }).join("") + "</div>";
    return '<div class="mk-head"><div class="mk-stage" style="background:' + SC_BG[o.c] + '"><img src="' + scUrl(o) + '" alt="Your character"></div>' +
      '<div class="mk-intro"><h2>Make your character</h2><p class="muted small">' + esc(S.me.name) + " · " + esc(roleName(S.me.role)) + '</p><button type="button" class="btn ghost sm mk-dice" data-a="scShuffle">' + ICON.dice + " Shuffle</button></div></div>" +
      '<div class="mk-tabs" role="tablist">' + MK_TABS.map(function (t) { return '<button type="button" role="tab" class="mk-tab' + (tab === t[0] ? " on" : "") + '" data-a="scTab" data-v="' + t[0] + '">' + t[1] + "</button>"; }).join("") + "</div>" +
      '<div class="mk-body" data-lenis-prevent>' + body + "</div>";
  }
  function redrawMaker(bounce) {
    var w = root.querySelector(".maker-wrap"); if (!w) return;
    var mb = w.querySelector(".mk-body"), top = mb ? mb.scrollTop : 0, lefts = [].map.call(w.querySelectorAll(".mk-strip"), function (x) { return x.scrollLeft; });
    w.innerHTML = makerHtml();
    var nb = w.querySelector(".mk-body"); if (nb && !bounce) nb.scrollTop = top;
    if (!bounce) w.querySelectorAll(".mk-strip").forEach(function (x, i) { x.scrollLeft = lefts[i] || 0; });
    var st = w.querySelector(".mk-stage"); if (st) { st.classList.remove("bounce"); void st.offsetWidth; st.classList.add("bounce"); }
  }
  function scShuffle() {
    var o = scAuto(Math.random() + ":" + Date.now(), S.me.role), k = function (n) { var l = scKeys(n); return l[Math.floor(Math.random() * l.length)]; };
    o.h = k("hair"); if (o.h === "hat") o.h = "01"; o.l = k("lips"); o.e = k("eyes"); o.b = k("brows"); o.n = k("nose"); o.y = k("body");
    o.g = Math.random() < .3 ? k("glasses") : ""; o.d = Math.random() < .3 ? k("beard") : ""; o.c = Math.floor(Math.random() * SC_BG.length);
    var r = Math.random(); o.x = r < .2 ? "hard" : r < .32 ? "cowboy" : r < .42 ? "cap" : ""; o.v = o.x === "hard" && Math.random() < .7 ? 1 : 0;
    return o;
  }
  function renderModal() {
    var m = S.modal, d = S.data, body = "";
    if (/^ls/.test(m.type)) body = lsModal(m);
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
        '<div class="row2"><label class="f">Architect (firm)<input type="text" name="architect_name" value="' + esc(p.architect_name) + '" placeholder="e.g. Studio Name Architects"></label>' +
        '<span class="muted small" style="align-self:end">Home shows the job’s map until you pick a cover photo.</span></div>' +
        (m.id && S.me.admin ? '<div class="f"><span>Who sees Contract & billing</span><input type="hidden" name="billing_set" value="1"><div class="tag-pick"><span class="tg tg-team">#team</span>' +
          ["client", "architect"].map(function (a) { return '<label class="tg-opt o-' + a + '"><input type="checkbox" name="billing_aud" value="' + a + '"' + ((p.billing_aud || []).indexOf(a) > -1 ? " checked" : "") + "><span>#" + a + "</span></label>"; }).join("") +
          '<span class="tg off">#crew never</span></div><span class="muted small">Blue Sierra always sees it. Tag #client and/or #architect to show it to them too.</span></div>' : "") +
        (m.id ? '<label class="f">Status<select name="status"><option value="active"' + (p.status !== "archived" ? " selected" : "") + '>Active</option><option value="archived"' + (p.status === "archived" ? " selected" : "") + ">Archived (hidden from the client)</option></select></label>" : "") +
        (m.id && S.me.admin ? '<details class="danger"><summary>Start this project over</summary><p class="muted small">Clears the chat, updates, photos list, invoices, contract, checklist, schedule, plans and the people added to it, so you can start from zero. Nothing is lost: you can restore it right here. Files stay in Google Drive.</p>' +
          (d && d.wipe ? '<div class="restore-box"><b>Saved copy from ' + day(String(d.wipe.at).slice(0, 10)) + "</b> · " + d.wipe.items + ' items<button type="button" class="btn sm" data-a="restoreWipe">Restore it</button></div>' : "") +
          '<label class="f">Type <b>' + esc(p.name) + '</b> to confirm<input type="text" data-wipe-confirm autocomplete="off"></label><button type="button" class="btn danger-btn" data-a="wipeProject">Start over</button></details>' : "") +
        (m.id && S.me.admin ? '<details class="danger"><summary>Delete this project</summary><p class="muted small">It disappears for everyone, including the client. Photos and files stay in Google Drive, and you can restore it from Home → Recently deleted.</p><label class="f">Type <b>' + esc(p.name) + '</b> to confirm<input type="text" data-del-confirm autocomplete="off"></label><button type="button" class="btn danger-btn" data-a="delProject" data-id="' + esc(p.id) + '">Delete project</button></details>' : "") +
        (!m.id && S.me.money ? '<label class="check-line qb-line"><input type="checkbox" name="qb" checked> ' + qbLogo() + " Also create it as a customer in QuickBooks, so invoices and costs go to the right job</label>" : "") +
        '<div class="actions"><button type="button" class="btn ghost" data-a="close">Cancel</button><button class="btn" type="submit">Save</button></div></form>';
    }
    if (m.type === "delInv") {
      var di = ((d && d.invoices) || []).filter(function (x) { return x.id === m.id; })[0] || {};
      body = "<h2>Delete invoice " + esc(di.number) + "</h2>" + '<form class="form" data-form="delInv">' +
        '<label class="radio-card"><input type="radio" name="where" value="both" checked><span><b>Here and in QuickBooks</b><small>' +
          "Takes it all back: the invoice" + (di.status === "paid" ? " and the payment the portal recorded" : "") + " leave QuickBooks too. If it was made directly in QuickBooks, or someone recorded a payment there, the portal won't touch it and tells you why." + "</small></span></label>" +
        '<label class="radio-card"><input type="radio" name="where" value="here"><span><b>Only here</b><small>It disappears from the portal and stays in QuickBooks as it is.</small></span></label>' +
        '<p class="muted small">Want to keep a record instead? Edit it and set it to <b>Void</b>: it voids in QuickBooks and stays in both places.</p>' +
        '<div class="actions"><button type="button" class="btn ghost" data-a="close">Cancel</button><button class="btn danger-btn" type="submit">Delete invoice</button></div></form>';
    }
    if (m.type === "invoice") {
      var i = m.id ? d.invoices.filter(function (x) { return x.id === m.id; })[0] || {} : { issued: today(), status: "sent" };
      var st = i.status === "overdue" ? "sent" : i.status, cm2 = contractMath(), billable = cm2.base.concat(cm2.cos.filter(function (l) { return l.status === "approved" || (i.lines && i.lines[l.id]); }));
      var heldElsewhere = cm2.held - (cm2.after[i.id] != null ? (i.retainage || 0) : 0);
      var auto = !m.id;                      // a new invoice suggests retainage from the project's percentage
      var made = m.id && i.created_by ? '<p class="inv-by">' + av(i.created_by, i.cby_avatar, "staff", "xs", i.cby_key) + " Created by <b>" + esc(i.created_by) + "</b>" + (i.created_at ? " · " + day(i.created_at) : "") + (i.updated_by && i.updated_at && i.updated_at !== i.created_at ? " · last edited by " + esc(i.updated_by) + " · " + day(i.updated_at) : "") + "</p>"
        : !m.id ? '<p class="inv-by">' + av(S.me.name, S.me.avatar, S.me.role, "xs", S.me.key) + " Created by <b>" + esc(S.me.name) + "</b> · today</p>" : "";
      body = "<h2>" + (m.id ? "Edit invoice" : "New invoice") + "</h2>" + made + '<form class="form" data-form="invoice" data-pct="' + cm2.pct + '" data-auto="' + (auto ? 1 : 0) + '">' +
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
        (i.qb_id && S.me.money ? '<p class="muted small qb-hint">' + qbLogo() + " Linked to QuickBooks #" + esc(i.number) + ". <b>Paid</b> records the payment there; back to <b>Sent / due</b> takes that payment back; back to <b>Draft</b> takes the invoice out of QuickBooks" + (i.qb_made ? "" : " (only for invoices made here)") + "; <b>Void</b> voids it.</p>" : "") +
        '<label class="f">Notes (team only)<textarea name="notes">' + esc(i.notes) + "</textarea></label>" +
        '<label class="check-line"><input type="checkbox" name="notify"' + (m.id ? "" : " checked") + "> Email the client that it's ready</label>" +
        (S.me.money ? '<label class="check-line qb-line"><input type="checkbox" name="qb"' + (i.qb_id || !m.id ? " checked" : "") + "> " + qbLogo() + (i.qb_id ? " In QuickBooks. Saving updates it there too (paid records the payment, void voids it)." : " Also create it in QuickBooks, with its PDF and pay link. Drafts stay here.") + "</label>" : "") +
        ((i.history || []).length ? '<details class="inv-hist"><summary>History · ' + i.history.length + " change" + (i.history.length === 1 ? "" : "s") + "</summary>" + i.history.map(function (h) { return '<div class="ih-row"><b>' + esc(h.by) + "</b> " + esc(h.what) + '<small class="muted">' + esc(String(h.at).replace(/^(\d{4}-\d\d-\d\d)/, function (x) { return day(x); })) + "</small></div>"; }).join("") + "</details>" : "") +
        '<div class="actions">' + (m.id ? '<button type="button" class="btn ghost" data-a="delInvoice" data-id="' + esc(m.id) + '" style="margin-right:auto;color:var(--bad)">Delete invoice</button>' : "") + '<button type="button" class="btn ghost" data-a="close">Cancel</button><button class="btn" type="submit">Save invoice</button></div></form>';
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
    if (m.type === "planUp") body = planUpModal(d);
    if (m.type === "call") {
      var pp = callable(S.chan);
      body = "<h2>📹 Who are you calling?</h2><p class=\"muted\" style=\"margin:4px 0 14px\">They get an email with the link and the code, and a Join card shows up in " + esc(chanLabel(S.chan)) + ".</p>" +
        (pp.length ? '<form class="form" data-form="call"><div class="dm-list">' + pp.map(function (x) { return '<label class="dm-row pick"><input type="checkbox" name="k" value="' + esc(x.key) + '" checked>' + av(x.name, x.avatar, x.role, "", x.key) + "<span><b>" + esc(x.name) + '</b><small class="muted">' + esc(roleName(x.role)) + "</small></span></label>"; }).join("") + "</div>" +
          '<div class="actions"><button type="button" class="btn ghost" data-a="close">Cancel</button><button class="btn call-go" type="submit">📹 Call ' + (pp.length === 1 ? "1 person" : pp.length + " people") + "</button></div></form>"
          : '<div class="empty">Nobody else can see this channel yet.</div><div class="actions"><button class="btn ghost" data-a="close">Close</button></div>');
    }
    if (m.type === "sheet") body = sheetModal(m);
    if (m.type === "dm") {
      var ppl2 = (d.members || []).filter(function (x) { return x.key && x.key !== S.me.key && dmOk(x.role); });
      body = "<h2>Private message</h2><p class=\"muted\" style=\"margin:4px 0 14px\">Only you and the person you pick will see it. Nobody else on the project, not even the team.</p>" +
        '<div class="dm-list">' + (ppl2.length ? ppl2.map(function (x) { return '<button class="dm-row" data-a="dmPick" data-k="' + esc(x.key) + '">' + av(x.name, x.avatar, x.role, "", x.key) + "<span><b>" + esc(x.name) + '</b><small class="muted">' + esc(roleName(x.role)) + "</small></span></button>"; }).join("") : '<div class="empty">Nobody else is on this project yet.</div>') + "</div>" +
        '<div class="actions" style="margin-top:14px"><button class="btn ghost" data-a="close">Cancel</button></div>';
    }
    if (m.type === "callReady") {
      body = '<div class="call-ready"><div class="cr-ico">' + ICON.video + '</div><h2>Your call is ready</h2><p class="muted">We let them know. Tap Join to open Google Meet.</p>' +
        '<a class="btn cr-join" href="' + esc(m.url) + '" target="_blank" rel="noopener" data-a="callGo">Join on Google Meet</a>' +
        '<p class="cr-code">Code <b>' + esc(m.code) + '</b></p><p class="muted small">If Meet says “Asking to join”, the other person can still get in: they tap Join in the portal chat too.</p>' +
        '<div class="actions"><button class="btn ghost" data-a="close">Close</button></div></div>';
    }
    if (m.type === "profile") {
      if (!S.scDraft) S.scDraft = scFor(S.me.avatar, S.me.key || S.me.name, S.me.role);
      body = '<div class="maker-wrap">' + makerHtml() + "</div>" +
        '<form class="form" data-form="profile"><div class="actions"><button type="button" class="link small" data-a="logout" style="margin-right:auto">Log out</button><button type="button" class="btn ghost" data-a="close">Cancel</button><button class="btn" type="submit">Save</button></div></form>' +
        '<form class="form pin-form" data-form="changepin"><div class="ch-label">' + ICON.lock + " " + (S.me.hasPin ? "Change my PIN" : "Set a PIN so you can log in without codes") + '</div><div class="pin-row"><input type="password" name="pin" inputmode="numeric" autocomplete="new-password" maxlength="6" pattern="\\d{6}" placeholder="6 digits" required><button class="btn ghost sm" type="submit">Save PIN</button></div></form>';
    }
    if (m.type === "thread") {
      var rootM = d.messages.filter(function (x) { return x.id === m.id; })[0];
      if (!rootM) body = '<p>That conversation was deleted.</p><div class="actions"><button class="btn" data-a="close">Close</button></div>';
      else {
        var reps = d.messages.filter(function (x) { return x.thread_id === rootM.id; });
        body = '<div class="eyebrow">' + esc(chanLabel(rootM.channel || "client")) + " · thread</div>" + '<div class="thread chat in-thread" style="margin-top:12px">' + msgHtml(rootM, { inThread: true }) +
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
        (v.req ? '<div class="req-box">' + foot(v.req, "Asked by") + "<div><b>" + esc(v.req.name) + " asked for a change</b> · " + day(v.req.at) + "<p>" + esc(v.req.note) + "</p></div></div>" : "") +
        (v.edited && !v.derived ? '<p class="muted small foot-line">' + foot(v.edited, "Changed by") + " Last changed by " + esc(v.edited.name) + (v.edited.at ? " · " + day(v.edited.at) : "") + "</p>" : "") +
        (!v.derived && !staff() ? '<form class="form req-form" data-form="schedReq" data-id="' + esc(v.id) + '"><label class="f">Need a different date?<textarea name="note" required placeholder="e.g. Can we move this to the week of Dec 7? The stone arrives late."></textarea></label><div class="actions"><button class="btn sm" type="submit">Ask Blue Sierra</button></div></form>' : "") +
        (!v.derived && staff() && v.req ? '<div class="actions" style="margin-top:6px"><button class="btn" data-a="schedEdit" data-id="' + esc(v.id) + '">Edit the date</button></div>' : "") +
        '<div class="actions" style="margin-top:18px">' + (v.derived ? '<button class="btn ghost" data-a="tab" data-t="' + (v.derived === "Invoices" ? "invoices" : "checklist") + '">Open ' + esc(v.derived) + "</button>" : "") + '<button class="btn" data-a="close">Close</button></div>' : "<p>Not found.</p>";
    }
    if (m.type === "role") {
      var rx = (m.from === "team" ? S.team : d && d.people || []).filter(function (x) { return x.email === m.email; })[0];
      if (!rx) body = "<p>Not found.</p>";
      else {
        var rAllowed = m.from === "team" ? ["staff", "crew", "admin"] : ["client", "architect", "crew"].concat(S.me.admin ? ["staff", "admin"] : []);
        if (rAllowed.indexOf(rx.role) < 0) rAllowed.unshift(rx.role);
        body = '<h2>Role and permissions</h2><div class="role-who">' + av(rx.name, rx.avatar, rx.role) + "<div><b>" + esc(rx.name) + '</b><div class="muted small">' + esc(rx.email) + "</div></div></div>" +
          '<form class="form" data-form="role">' + rolePicker(rx.role, rAllowed, S.me.admin ? !!rx.money : undefined) +
          (m.from === "team" ? '<p class="muted small">To make someone a #client or #architect, change it from their project’s People tab, so they only see that project.</p>' : "") +
          '<p class="muted small">It takes effect right away, the next time their portal loads.</p><div class="actions"><button type="button" class="btn ghost" data-a="close">Cancel</button><button class="btn" type="submit">Save</button></div></form>';
      }
    }
    if (m.type === "viewAs") {
      body = '<h2>Preview the portal</h2><p class="muted">See exactly what the server sends to each role, on every project. Read-only: nothing you click here saves. Use it to check nothing private is leaking.</p>' +
        '<div class="va-pick">' + ["client", "architect", "crew"].map(function (r) { return '<button class="va-opt" data-a="viewAs" data-v="' + r + '"><span class="tg tg-' + r + '">#' + r + "</span><small>" + esc(ROLES[r][2]) + "</small></button>"; }).join("") + "</div>" +
        '<div class="actions"><button type="button" class="btn ghost" data-a="close">Close</button></div>';
    }
    if (m.type === "purge") {
      var pp0 = (S.projects || []).filter(function (x) { return x.id === m.id; })[0] || {};
      body = '<h2>Delete forever</h2><p>This erases <b>' + esc(pp0.name) + "</b> from the portal for good: chat, updates, invoices, contract, checklist, schedule, plans and the saved “start over” copy. People who were only on this project lose access.</p>" +
        '<p class="muted small">Its Google Drive folder (photos, PDFs, plans) goes to the Drive trash, where Google keeps it 30 days before it’s gone.</p>' +
        '<label class="f">Type <b>' + esc(pp0.name) + '</b> to confirm<input type="text" data-purge-confirm autocomplete="off"></label>' +
        '<div class="actions"><button type="button" class="btn ghost" data-a="close">Cancel</button><button type="button" class="btn danger-btn" data-a="purgeProject" data-id="' + esc(m.id) + '">Delete forever</button></div>';
    }
    if (m.type === "check") {
      var c = m.id ? d.checklist.filter(function (x) { return x.id === m.id; })[0] || {} : { phase: d.project.phase, owner: "blue sierra", aud: [] };
      var ppl3 = (d.members || []);
      body = "<h2>" + (m.id ? "Edit item" : "Add checklist item") + '</h2><form class="form" data-form="check">' +
        '<label class="f">Item<input type="text" name="item" required value="' + esc(c.item) + '" placeholder="e.g. Check the arborist permit #team"></label>' +
        '<div class="f"><span>Who sees it</span>' + tagPicker("aud", c.aud || (c.owner === "client" ? ["client"] : []), ["client", "architect", "team", "crew", "private"]) + '<span class="muted small">#client: everyone on the project · #team: Blue Sierra only · #crew: crew + Blue Sierra. None picked = everyone.</span></div>' +
        '<div class="f"><span>Assign to <small class="muted">(pick as many as you like: it goes to their to-dos and alerts)</small></span><div class="assign-pick">' + ppl3.map(function (x) { var on = (c.assignees || []).some(function (a) { return a.key === x.key; }); return '<label class="ap-opt"><input type="checkbox" name="assignees" value="' + esc(x.key) + '"' + (on ? " checked" : "") + "><span>" + av(x.name, x.avatar, x.role, "xs", x.key) + "<b>" + esc(x.name) + "</b>" + roleChip(x.role) + "</span></label>"; }).join("") + "</div></div>" +
        '<div class="row2"><label class="f">Phase<select name="phase">' + PHASES.map(function (ph) { return "<option" + (ph === c.phase ? " selected" : "") + ">" + ph + "</option>"; }).join("") + "</select></label>" +
        '<label class="f">Due (optional)<input type="date" name="due" value="' + esc(c.due) + '"></label></div>' +
        (c.edited && c.edited.name ? '<p class="muted small foot-line">' + foot(c.edited, "Last edited by") + " Last edited by " + esc(c.edited.name) + (c.edited.at ? " · " + day(c.edited.at) : "") + "</p>" : "") +
        '<div class="actions"><button type="button" class="btn ghost" data-a="close">Cancel</button><button class="btn" type="submit">Save</button></div></form>';
    }
    return '<div class="modal-bg" data-a="bg" data-lenis-prevent><div class="modal m-' + esc(m.type) + '" role="dialog" aria-modal="true">' + body + "</div></div>";
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
    if (S.drawer && b.closest(".side") && b.dataset.a !== "sideTog") S.drawer = false;      // picking something in the phone drawer closes it
    var a = b.dataset.a;
    if (a === "bg") { if (e.target === b && S.downOnBg) { S.modal = null; keepScroll(render); } return; }
    if (b.tagName === "A") return;
    e.preventDefault();
    switch (a) {
      case "forgotPin": run(b, async function () { await call("requestCode", { email: S.email }); S.resetPin = true; S.step = "code"; render(); }); return;
      case "keepCode": run(b, async function () { await savePin(S.lastCode); }); return;
      case "restart": forget(); S.step = "email"; return render();
      case "retry": root.innerHTML = '<div class="loading">Loading…</div>'; return route();
      case "forget": store("del"); resetState(); S.step = loginStep(); return render();
      case "logout": run(b, async function () { try { await call("logout"); } catch (er) {} store("del"); resetState(); S.step = loginStep(); history.pushState(null, "", location.pathname + location.search); render(); }); return;
      case "home": refreshList(); return go(null);
      case "open": return go(b.dataset.id);
      case "tab": S.pending = []; S.lb = null; return go(S.pid, b.dataset.t);
      case "viewAs": enterPreview(b.dataset.v); return;
      case "exitPreview": exitPreview(); return;
      case "purgeProject":
        var pc = root.querySelector("[data-purge-confirm]");
        run(b, async function () { var rr = await call("purgeProject", { projectId: b.dataset.id, confirm: pc ? pc.value : "" }); S.modal = null; S.projects = null; await route(); toast(rr.trashed ? "Erased. Its Drive folder is in the Drive trash." : "Erased."); });
        return;
      case "moneyRefresh": loadMoney(true); keepScroll(render); return;
      case "finRefresh": loadFin(true); keepScroll(render); return;
      case "finFilter": S.finFilter = b.dataset.v; keepScroll(render); return;
      case "billAud": run(b, async function () { var pj = S.data.project, l = (pj.billing_aud || []).filter(function (x) { return x !== "client"; }); if (b.dataset.v === "on") l.push("client");
        await call("saveProject", { project: { id: pj.id, name: pj.name, billing_aud: l } }); await refresh(true); toast(b.dataset.v === "on" ? "The client now sees Contract & billing" : "Hidden from the client"); }); return;
      case "qbCreateCust": run(b, async function () { var qc = await call("qbCreateCustomer", { projectId: S.pid }); S.qbp = null; S.qbCust = null; if (S.money) S.money[S.pid] = null; S.fin = null; await refresh(); toast(qc.existed ? "Already in QuickBooks" : "Created in QuickBooks as “" + qc.name + "”"); }); return;
      case "qbSendInv":
        if (!window.confirm("Email this invoice to the client from QuickBooks, with its pay link?")) return;
        run(b, async function () { var rs = await call("qbSendInvoice", { invoiceId: b.dataset.id }); toast("Emailed from QuickBooks to " + rs.to); }); return;
      case "spFilter": S.spF = Object.assign({ filter: "all", q: "", days: 60 }, S.spF || {}, { filter: b.dataset.v }); keepScroll(render); return;
      case "spMore": var sk = b.dataset.k, sp = (S.spend || {})[sk]; if (sp) loadSpend(sk, sp.params, true); keepScroll(render); return;
      case "spReload": var sk2 = b.dataset.k, sp2 = (S.spend || {})[sk2]; delete S.spend[sk2]; if (sp2) loadSpend(sk2, sp2.params); keepScroll(render); return;
      case "spCats": if (S.spCats === "loading") return; S.spCats = "loading"; call("qbCategories").then(function (r) { S.spCats = r.categories; }).catch(function (e) { S.spCats = null; toast(e.message); }).then(function () { keepScroll(render); }); return;
      case "spAdd": spAssign(b.dataset.key, b.dataset.pid, "job"); return;
      case "spUndo":
        run(b, async function () { var key = b.dataset.key; await call("qbUndo", { logId: S.spUndo[key] }); delete S.spUndo[key]; S.fin = null; if (S.spend && S.spend.fin) loadSpend("fin", S.spend.fin.params); spRefreshAll(); toast("Undone in QuickBooks"); }); return;
      case "spJump": var el = root.querySelector("#sp-nojob"); if (el) el.scrollIntoView({ behavior: "smooth", block: "start" }); return;
      case "finUnlink": run(b, async function () { await call("qbLink", { projectId: b.dataset.pid, customerId: "" }); await loadFin(false); toast("Unlinked"); }); return;
      case "modal": S.modal = { type: b.dataset.m, id: b.dataset.id || null, kind: b.dataset.kind || "", email: b.dataset.email || "", from: b.dataset.from || "", visit: b.dataset.visit || "", prop: b.dataset.prop || "", issue: b.dataset.issue || "" }; return keepScroll(render);
      case "callGo": setTimeout(function () { S.modal = null; keepScroll(render); }, 600); return;   // let the tap open Meet first
      case "close": S.modal = null; S.scDraft = null; keepScroll(render); if (S.verLater) { S.verLater = false; liveReload(); } return;
      case "unpick": S.pending.splice(+b.dataset.i, 1); return keepScroll(render);
      case "lb": S.lb = { i: +b.dataset.i }; return keepScroll(render);
      case "lbClose": S.lb = null; return keepScroll(render);
      case "lbPrev": S.lb.i = (S.lb.i - 1 + S.data.photos.length) % S.data.photos.length; return keepScroll(render);
      case "lbNext": S.lb.i = (S.lb.i + 1) % S.data.photos.length; return keepScroll(render);
      case "toggle": run(null, async function () { await call("toggleChecklist", { itemId: b.dataset.id }); await reload(); }); return;
      case "delCheck": sure("Delete this checklist item?", function () { run(null, async function () { await call("deleteChecklistItem", { itemId: b.dataset.id }); await reload(); }); }); return;
      case "closeQ": run(b, async function () { await call("closeQuestion", { questionId: b.dataset.id }); await reload(true); }); return;
      case "removePerson": sure("Remove " + b.dataset.email + " from this project?", function () { run(null, async function () { await call("removePerson", { projectId: S.pid, email: b.dataset.email }); await reload(); ping(); toast("Access removed"); }); }); return;
      case "cover": run(b, async function () { await call("setCover", { projectId: S.pid, fileId: b.dataset.id }); S.lb = null; await reload(true); toast("Cover photo updated"); }); return;
      case "schedMode": S.sched.view = b.dataset.v; return keepScroll(render);
      case "calMove":
        var n = +b.dataset.n, cur = S.sched.month || today().slice(0, 7);
        if (!n) S.sched.month = today().slice(0, 7);
        else { var dd = new Date(Date.UTC(+cur.slice(0, 4), +cur.slice(5, 7) - 1 + n, 1)); S.sched.month = dd.getUTCFullYear() + "-" + String(dd.getUTCMonth() + 1).padStart(2, "0"); }
        return keepScroll(render);
      case "delLine": sure("Delete this line?", function () { run(b, async function () { await call("deleteContractLine", { lineId: b.dataset.id }); S.modal = null; await refresh(); toast("Deleted"); }); }); return;
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
      case "delMsg": sure("Delete this message" + (b.closest(".in-thread") ? "" : " and its replies") + "?", function () { var gone = b.dataset.id; S.data.messages = S.data.messages.filter(function (x) { return x.id !== gone && x.thread_id !== gone; }); if (S.modal && S.modal.id === gone) S.modal = null; keepScroll(render);   // gone right away; the server catches up
        run(null, async function () { try { await call("deleteMessage", { messageId: gone }); } catch (e) { await refresh(); throw e; } toast("Deleted"); }); }); return;
      case "unatt": S.att[b.dataset.k].splice(+b.dataset.i, 1); return keepScroll(render);
      case "homeView":
        S.home = b.dataset.v; if (b.dataset.v === "activity") S.activity = null; if (b.dataset.v === "team") S.team = null;
        if (b.dataset.v === "finance" && S.fin && S.fin.err) S.fin = null;
        refreshList(); if (S.pid) return go(null); return keepScroll(render);
      case "sideChan": S.chan = b.dataset.c; S.readMark = {}; if (S.tab !== "messages") return go(S.pid, "messages"); render(); window.scrollTo(0, document.body.scrollHeight); return;
      case "actOpen": var pp = document.getElementById("bsp-pop"); if (pp && b === pp) pp.remove();
        S.wantChan = b.dataset.c; S.openThread = b.dataset.th || null;
        if (S.pid === b.dataset.p) { S.chan = b.dataset.c; S.readMark = {}; if (S.openThread) { S.modal = { type: "thread", id: S.openThread }; S.openThread = null; } S.wantChan = null; }
        return go(b.dataset.p, "messages");
      case "teamOff": sure("Remove " + (b.dataset.name || b.dataset.email) + " from the portal? They can't log in anymore and disappear from Who's around. Their old messages stay.", function () { run(b, async function () { await call("removePerson", { email: b.dataset.email }); S.team = null; S.presence && (S.presence.people = S.presence.people.filter(function (x) { return x.name !== b.dataset.name; })); render(); ping(); toast("Removed"); }); }); return;
      case "teamOn": run(b, async function () { await call("addPerson", { email: b.dataset.email, name: b.dataset.name, role: "staff" }); S.team = null; render(); toast("Access back on"); }); return;
      case "ref": return openRef(b.dataset.ref, b.dataset.p);
      case "bell": S.bell = !S.bell; if (S.bell) loadNotif(); return keepScroll(render);
      case "bellClose": S.bell = false; return keepScroll(render);
      case "markAll": markAllRead(); return;
      case "tour": S.bell = false; keepScroll(render); return startTour(true);
      case "call":
        if (isDm(S.chan)) return startCallNow(b, [dmWith(S.chan).key]);      // a private chat: you're calling that one person
        S.modal = { type: "call" }; return keepScroll(render);
      case "copyCode": try { navigator.clipboard.writeText(b.dataset.c); toast("Code copied: " + b.dataset.c); } catch (e) { toast(b.dataset.c); } return;
      case "sideTog":
        if (matchMedia("(max-width:1080px)").matches) S.drawer = !S.drawer;
        else { S.sideOff = !S.sideOff; try { localStorage.setItem("bsp-side-off", S.sideOff ? "1" : ""); } catch (e) {} }
        return keepScroll(render);
      case "dmPick": S.modal = null; S.chan = dmKey(b.dataset.k); S.readMark = {}; if (S.tab !== "messages") return go(S.pid, "messages"); render(); return;
      case "people": S.peopleOpen = !S.peopleOpen; S.peopleFocus = null; S.bell = false; if (S.peopleOpen) ping(); return keepScroll(render);
      case "peopleClose": S.peopleOpen = false; return keepScroll(render);
      case "person": if (!b.dataset.k || b.dataset.k === (S.me && S.me.key)) return; S.peopleOpen = true; S.peopleFocus = b.dataset.k; S.bell = false; keepScroll(render); var fx = document.getElementById("pp-" + b.dataset.k); if (fx) fx.scrollIntoView({ block: "center" }); return;
      case "myStatus": S.myStatus = b.dataset.v; keepScroll(render); ping(); toast({ available: "You're available 🟢", busy: "You're busy 🔴 People will see it.", away: "You're away 🌙" }[b.dataset.v]); return;
      case "wave":
        var wp = (S.presence.people || []).filter(function (x) { return x.key === b.dataset.k; })[0];
        b.classList.add("waving"); toast("You waved at " + first(wp ? wp.name : "them") + " 👋");
        call("sendMessage", { projectId: b.dataset.p, channel: dmKey(b.dataset.k), text: "👋 Hi " + first(wp ? wp.name : "") + "!" }).then(function () { if (S.pid === b.dataset.p) refresh(); }).catch(function (e) { toast(e.message); });
        return;
      case "dmGo": S.peopleOpen = false; S.wantChan = dmKey(b.dataset.k); if (S.pid === b.dataset.p) { S.chan = S.wantChan; S.wantChan = null; S.readMark = {}; } return go(b.dataset.p, "messages");
      case "callPerson": S.peopleOpen = false; S.chan = dmKey(b.dataset.k); if (S.tab !== "messages") { S.tab = "messages"; history.pushState(null, "", "#p=" + S.pid + "&t=messages"); } keepScroll(render); return startCallNow(null, [b.dataset.k]);
      case "ball":
        b.classList.remove("shake"); void b.offsetWidth; b.classList.add("shake");
        setTimeout(function () { S.luck = LUCK[Math.floor(Math.random() * LUCK.length)]; var el = root.querySelector(".today"); if (el && S.data) el.outerHTML = todayHtml(S.data.project); }, 900);
        return;
      case "nClear": clearNote(b.dataset.id, b.closest(".n-wrap")); return;
      case "nClearAll":
        var mm = notifModel(), ids = mm.fresh.concat(mm.old).map(function (x) { return x.id; });
        root.querySelectorAll(".n-wrap").forEach(function (w, i) { w.style.transitionDelay = (i * 30) + "ms"; w.classList.add("gone"); });
        setTimeout(function () { dismiss(ids); markAllRead(); }, 350); return;
      case "needOpen": S.needOpen = S.needOpen === b.dataset.v ? null : b.dataset.v; return keepScroll(render);
      case "needClear": dismiss([b.dataset.k]); return keepScroll(render);
      case "alertsOn": try { Notification.requestPermission().then(function (r) { toast(r === "granted" ? "Alerts on 🔔" : "Alerts are off. You can turn them on in your browser settings."); keepScroll(render); }); } catch (e) {} return;
      case "pin":
        var pk = b.dataset.kind, list2 = pk === "update" ? S.data.timeline : pk === "check" ? S.data.checklist : S.data.messages, it2 = list2.filter(function (x) { return x.id === b.dataset.id; })[0];
        if (it2) { it2.pinned = isPinned(it2) ? "" : "yes"; keepScroll(render); toast(it2.pinned ? "📌 Pinned (it shows on Home too)" : "Unpinned"); }
        call("togglePin", { kind: pk === "update" ? "update" : pk === "check" ? "check" : "msg", id: b.dataset.id }).catch(function (e) { toast(e.message); refresh(); });
        return;
      case "pinUpOpen": S.flash = "up-" + b.dataset.id; return go(S.pid, "updates");
      case "homePin":
        var hp = b.dataset;
        if (hp.kind === "update") { S.flash = "up-" + hp.id; return go(hp.p, "updates"); }
        if (hp.kind === "check") { S.flash = "ck-" + hp.id; return go(hp.p, "checklist"); }
        S.wantChan = hp.c; S.flash = "m-" + hp.id; return go(hp.p, "messages");
      case "copyText": try { navigator.clipboard.writeText(b.dataset.v); toast("Copied"); } catch (e) { toast("Select it and copy it"); } return;
      case "homeTeamQb": S.home = "team"; return go(null);
      case "qbConnect": var qw = window.open("", "_blank"); run(b, async function () { try { var qr = await call("qbConnectUrl"); if (qw) qw.location = qr.url; else location.href = qr.url; } catch (e) { if (qw) qw.close(); throw e; } S.qb = null; toast("Finish in the QuickBooks tab, then come back here."); }); return;
      case "qbDisconnect": sure("Disconnect QuickBooks? Invoices already brought in stay in the portal.", function () { run(b, async function () { await call("qbDisconnect"); S.qb = null; render(); }); }); return;
      case "qbUnlink": run(b, async function () { await call("qbLink", { projectId: S.pid, customerId: "" }); S.qbp = null; S.qbCust = null; render(); }); return;
      case "qbImport": run(b, async function () { await call("qbImport", { projectId: S.pid, qbId: b.dataset.q }); S.qbp = null; await refresh(); toast("Invoice brought in from QuickBooks"); }); return;
      case "ckFilter": S.ckFilter = b.dataset.v; return keepScroll(render);
      case "ckReact":
        var ci = S.data.checklist.filter(function (x) { return x.id === b.dataset.id; })[0], em = b.dataset.e;
        if (ci) { var rr = (ci.reactions || []).filter(function (r) { return r.e === em; })[0]; if (rr) { rr.n += rr.mine ? -1 : 1; rr.mine = !rr.mine; if (!rr.n) ci.reactions = ci.reactions.filter(function (r) { return r !== rr; }); } else (ci.reactions = ci.reactions || []).push({ e: em, n: 1, mine: true, who: [S.me.name] }); keepScroll(render); }
        call("reactCheck", { itemId: b.dataset.id, emoji: em }).catch(function (e) { toast(e.message); refresh(); });
        return;
      case "dropLogo": var fl = b.closest("form"); fl.dataset.dropLogo = "1"; b.closest(".logo-row").innerHTML = '<span class="muted small">Logo will be removed when you save.</span>'; return;
      case "wipeProject":
        var wc = root.querySelector("[data-wipe-confirm]");
        sure("Start this project over? Chat, updates, invoices, contract, checklist, schedule, plans and the people on it are cleared. You can restore it later.", function () {
          run(b, async function () { await call("wipeProject", { projectId: S.pid, confirm: wc ? wc.value : "" }); S.modal = null; cacheClear(); await refresh(true); toast("Project cleared. You can restore it from Edit project."); });
        });
        return;
      case "restoreWipe": run(b, async function () { await call("restoreWipe", { projectId: S.pid }); S.modal = null; await refresh(true); toast("Restored ✨"); }); return;
      case "pinMsgOpen": var pm = S.data.messages.filter(function (x) { return x.id === b.dataset.id; })[0]; if (pm) { S.chan = pm.channel || "client"; S.flash = "m-" + pm.id; S.readMark = {}; } if (S.tab === "messages") { render(); var fe = document.getElementById("m-" + b.dataset.id); if (fe) { fe.scrollIntoView({ block: "center" }); fe.classList.add("flash"); } return; } return go(S.pid, "messages");
      case "delUpdate":
        var hasPh = b.dataset.ph === "1", uid = b.dataset.id;
        sure(hasPh ? "Delete this update? Its photos stay in the Photos tab." : "Delete this update?", function () {
          S.data.timeline = S.data.timeline.filter(function (x) { return x.id !== uid; }); keepScroll(render);
          run(null, async function () { try { await call("deleteUpdate", { updateId: uid }); } catch (e) { await refresh(); throw e; } toast("Update deleted"); });
        });
        return;
      case "delInvoice":
        var iid = b.dataset.id, invD = (S.data.invoices || []).filter(function (x) { return x.id === iid; })[0] || {};
        if (invD.qb_id && S.me.money) { S.modal = { type: "delInv", id: iid }; return keepScroll(render); }
        sure("Delete this invoice? Its PDF goes to the Drive trash and it disappears for the client.", function () {
          S.modal = null; S.data.invoices = S.data.invoices.filter(function (x) { return x.id !== iid; }); keepScroll(render);
          run(null, async function () { try { await call("deleteInvoice", { invoiceId: iid }); } catch (e) { await refresh(); throw e; } await refresh(); toast("Invoice deleted"); });
        });
        return;
      case "scSet": var sk = b.dataset.k, sv = b.dataset.v; S.scDraft[sk] = sk === "v" || sk === "c" ? +sv : sv; if (sk === "h") S.scDraft.x = ""; if (sk === "y") S.scDraft.v = 0; if (sk === "v" && +sv) S.scDraft.x = S.scDraft.x || "hard"; return redrawMaker();
      case "scTab": S.scTab = b.dataset.v; return redrawMaker(true);
      case "scShuffle": S.scDraft = scShuffle(); return redrawMaker();
      case "delProject":
        var cf = root.querySelector("[data-del-confirm]");
        run(b, async function () { await call("deleteProject", { projectId: b.dataset.id, confirm: cf ? cf.value : "" }); S.modal = null; S.projects = null; toast("Project deleted. You can restore it from Home."); go(null); });
        return;
      case "restoreProject": run(b, async function () { await call("restoreProject", { projectId: b.dataset.id }); S.projects = null; refreshList(); toast("Project restored"); }); return;
      case "sheet": S.sheetMode = S.sheetMode || "hl"; S.zoom = 100; S.modal = { type: "sheet", id: b.dataset.id, n: +b.dataset.n }; return keepScroll(render);
      case "sheetMode": S.sheetMode = b.dataset.v; return keepScroll(render);
      case "zoom": S.zoom = Math.max(100, Math.min(400, (S.zoom || 100) + (+b.dataset.z) * 50)); return keepScroll(render);
      case "sheetNav":
        var dd = planById(S.modal.id), li = dd.sheets.map(function (x) { return x.n; }).indexOf(S.modal.n) + (+b.dataset.d);
        if (dd.sheets[li]) { S.modal.n = dd.sheets[li].n; S.zoom = 100; } return keepScroll(render);
      case "planRev": S.planRev = S.planRev || {}; S.planRev[b.dataset.set] = b.dataset.id; S.planOpen = null; return keepScroll(render);
      case "planFilter": S.planFilter = S.planFilter || {}; S.planFilter[b.dataset.id] = b.dataset.v; return keepScroll(render);
      case "delPlan": sure("Delete this revision and its sheets?", function () { run(b, async function () { await call("deletePlan", { id: b.dataset.id }); S.planOpen = null; await refresh(); toast("Revision deleted"); }); }); return;
      case "schedDay": S.modal = { type: "schedDay", kind: b.dataset.kind || "", day: b.dataset.day }; return keepScroll(render);
      case "schedEdit": S.modal = { type: "sched", id: b.dataset.id }; return keepScroll(render);
      case "schedView":
        var it = (S.data.schedule || []).filter(function (y) { return y.id === b.dataset.id; })[0];
        S.modal = { type: staff() && it && !it.req ? "sched" : "schedView", id: b.dataset.id }; return keepScroll(render);
      case "delSched": sure("Delete this date?", function () { run(b, async function () { await call("deleteScheduleItem", { itemId: b.dataset.id }); S.modal = null; await refresh(); toast("Deleted"); }); }); return;
      case "stdPhases": run(b, async function () { await call("addStandardPhases", { projectId: S.pid }); await refresh(); toast("Phases added. Tap any of them to change its dates."); }); return;
      case "ics":
        var blob = new Blob([icsFile()], { type: "text/calendar" }), aIcs = document.createElement("a");
        aIcs.href = URL.createObjectURL(blob); aIcs.download = (S.data.project.name || "project").replace(/[^\w-]+/g, "-") + "-schedule.ics"; document.body.appendChild(aIcs); aIcs.click(); aIcs.remove(); return;
      case "delPhoto": sure("Delete this photo?", function () { run(b, async function () { await call("deletePhoto", { photoId: b.dataset.id }); S.lb = null; await reload(); toast("Photo deleted"); }); }); return;
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
    if (e.target.form && e.target.form.dataset.form === "call") { var nn = e.target.form.querySelectorAll("input[name=k]:checked").length, cb = e.target.form.querySelector(".call-go"); cb.textContent = nn ? "📹 Call " + (nn === 1 ? "1 person" : nn + " people") : "Pick someone"; cb.disabled = !nn; return; }
    var f = e.target.form; if (!f || f.dataset.form !== "invoice") return;
    if (e.target.name === "retainage") f.dataset.auto = 0;
    invoiceMath(f);
  });
  // Intuit's "Copy all - production keys" pastes both keys at once: split them here, before the one-line box squashes the line break.
  root.addEventListener("paste", function (e) {
    var box = e.target; if (!box || box.name !== "clientId" && box.name !== "clientSecret") return;
    var t = ((e.clipboardData || window.clipboardData) || { getData: function () { return ""; } }).getData("text") || "";
    var id = (t.match(/client\s*id\W*([A-Za-z0-9]+)/i) || [])[1], sec = (t.match(/client\s*secret\W*([A-Za-z0-9]+)/i) || [])[1];
    if (!id || !sec) { var parts = t.split(/[^A-Za-z0-9]+/).filter(function (x) { return x.length >= 20; }); if (parts.length === 2) { id = parts[0]; sec = parts[1]; } }
    if (!id || !sec) return;
    e.preventDefault(); var f = box.form; f.clientId.value = id; f.clientSecret.value = sec; toast("Got both keys. Now click Save keys.");
  });
  root.addEventListener("change", function (e) {
    if (e.target.matches("[data-fin-link], [data-fin-proj]")) { finLink(e.target); return; }
    if (e.target.matches("[data-sp-job]")) { spAssign(e.target.dataset.spJob, e.target.value, "job"); return; }
    if (e.target.matches("[data-sp-cat]")) { if (e.target.value) spAssign(e.target.dataset.spCat, e.target.value, "cat"); return; }
    if (e.target.matches("[data-sp-q]")) { S.spF = Object.assign({ filter: "all", q: "", days: 60 }, S.spF || {}, { q: e.target.value.trim() }); keepScroll(render); return; }
    if (e.target.matches("[data-sp-days]")) { S.spF = Object.assign({ filter: "all", q: "", days: 60 }, S.spF || {}, { days: Number(e.target.value) }); keepScroll(render); return; }
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
    if (kind === "call") {
      var keys = [].slice.call(f.querySelectorAll("input[name=k]:checked")).map(function (x) { return x.value; });
      if (!keys.length) return toast("Pick at least one person.");
      return startCallNow(btn, keys);
    }
    var loginForm = ["email", "pin", "code", "setpin"].indexOf(kind) > -1;
    run(btn, async function () { try { await submitForm(); } catch (e) { if (!loginForm) throw e; S.err = e.message; renderLogin(); } }).catch(function () {});
    async function submitForm() {
      if (kind === "email") {
        S.email = v("email").toLowerCase(); var ce = await call("checkEmail", { email: S.email }); S.who = ce.name;
        if (ce.hasPin) { S.step = "pin"; return render(); }
        await call("requestCode", { email: S.email }); S.step = "code"; S.resetPin = false; return render();
      }
      if (kind === "pin") {
        var rp = await call("loginPin", { email: S.email, pin: v("pin") }); remember(S.email, S.who);
        S.token = rp.token; store("set", rp.token); S.me = rp.me; S.projects = null; return route();
      }
      if (kind === "code") {
        var r = await call("verifyCode", { email: S.email, code: v("code"), resetPin: !!S.resetPin });
        S.token = r.token; store("set", r.token); remember(S.email, S.who || first(r.me.name));
        if (r.needPin) { S.pendingMe = r.me; S.lastCode = v("code").replace(/\D/g, ""); S.step = "setpin"; S.me = null; return renderLogin(); }
        S.me = r.me; S.projects = null; return route();
      }
      if (kind === "setpin") { await savePin(v("pin")); return; }
      if (kind === "changepin") { await call("setPin", { pin: v("pin") }); S.me.hasPin = true; f.reset(); toast("PIN saved 🔐"); return; }
      if (kind === "update") {
        var sentU = S.pending.slice();
        var audU = fd.getAll("aud");
        await call("postUpdate", { projectId: S.pid, text: v("text"), photos: sentU, notify: !!fd.get("notify"), aud: audU });
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
      if (kind === "planUp") {
        f.querySelectorAll("input,select,textarea,button").forEach(function (x) { x.disabled = true; });
        try { var res = await uploadPlan(f, fd, v); }
        catch (e) { f.querySelectorAll("input,select,textarea,button").forEach(function (x) { x.disabled = false; }); prog("", 0); var pe = document.getElementById("plan-prog"); if (pe) pe.hidden = true; throw e; }
        S.modal = null; await refresh(); toast(res.first ? res.n + " sheets uploaded" : res.changed ? res.changed + " sheet" + (res.changed > 1 ? "s" : "") + " changed. They're highlighted." : "Uploaded. No sheet changes found."); return;
      }
      if (kind === "profile") {
        var rp = await call("saveProfile", { avatar: scEncode(S.scDraft) }); S.me.avatar = rp.avatar; S.scDraft = null; S.modal = null; if (S.pid) await refresh(); else { keepScroll(render); refreshList(); } toast("Looking good ✨"); return;
      }
      if (kind === "team") {
        await call("addPerson", { name: v("name"), email: v("email"), role: v("role") || "staff", money: !!fd.get("money"), invite: !!fd.get("invite") });
        f.reset(); S.team = null; render(); toast(fd.get("invite") ? "Added and invited" : "Added to the team"); return;
      }
      if (kind === "chat") {
        var q = !!fd.get("question"), ck = f.dataset.root ? "thread" : "main", att = (S.att && S.att[ck]) || [], ch = f.dataset.ch;
        if (!v("text") && !att.length) return;
        // Show it right away; the server catches up in the background.
        var nd = new Date(), pad2 = function (x) { return String(x).padStart(2, "0"); }, tmpId = "tmp" + nd.getTime(), sentText = v("text");
        S.data.messages.push({ id: tmpId, pending: true, at: nd.getFullYear() + "-" + pad2(nd.getMonth() + 1) + "-" + pad2(nd.getDate()) + " " + pad2(nd.getHours()) + ":" + pad2(nd.getMinutes()), author: S.me.name, role: S.me.role, kind: q ? "question" : "message", status: q ? "open" : "",
          text: sentText, channel: ch, thread_id: f.dataset.root || "", mine: true, avatar: S.me.avatar, akey: S.me.key, reactions: [], files: att.map(function (x) { return { name: x.name, mime: x.mime, thumb: x.mime === "application/pdf" ? "" : x.data, full: x.data, url: "#" }; }) });
        f.reset(); if (S.att) S.att[ck] = []; keepScroll(render); if (!f.dataset.root) window.scrollTo(0, document.body.scrollHeight);
        var imp = !!fd.get("important");
        try { await call("sendMessage", { projectId: S.pid, channel: ch, threadId: f.dataset.root || undefined, text: sentText, kind: q ? "question" : "message", files: att, important: imp }); }
        catch (e) { S.data.messages = S.data.messages.filter(function (x) { return x.id !== tmpId; }); keepScroll(render); var tb = root.querySelector((f.dataset.root ? ".modal " : ".reply-bar ") + "[data-chat]"); if (tb) tb.value = sentText; throw e; }
        S.readMark = S.readMark || {}; S.readMark[ch] = "9999";                // your own message clears the "New" line
        await loadFeed(S.pid); if (!f.dataset.root) window.scrollTo(0, document.body.scrollHeight);
        else { var mb = root.querySelector(".modal"); if (mb) mb.scrollTop = mb.scrollHeight; var t2 = root.querySelector(".modal [data-chat]"); if (t2) t2.focus(); }
        if (q || imp) toast(q ? "Question sent · emailed too" : "Sent · emailed too");
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
        ["name", "client_name", "address", "city", "phase", "progress", "start_date", "target_date", "summary", "status", "retainage_pct", "architect_name"].forEach(function (k) { if (fd.has(k)) proj[k] = v(k); });
        if (fd.has("billing_set")) proj.billing_aud = fd.getAll("billing_aud");
        var lf = f.querySelector("[name=logo]"); if (lf && lf.files && lf.files[0]) proj.logo = await resize(lf.files[0], 600);
        if (f.dataset.dropLogo) proj.logo = "";
        var r2 = await call("saveProject", { project: proj }); S.modal = null;
        if (!proj.id && fd.get("qb")) { try { var qc = await call("qbCreateCustomer", { projectId: r2.project.id }); toast("Project created · in QuickBooks as “" + (qc.name || proj.name) + "”"); } catch (e) { toast("Project created. QuickBooks: " + e.message); } }
        if (!proj.id) { S.projects = null; return go(r2.project.id); }
        await refresh(true); toast("Project saved"); return;
      }
      if (kind === "cline") {
        await call("saveContractLine", { projectId: S.pid, line: { id: S.modal.id || undefined, kind: f.dataset.kind, number: v("number"), title: v("title"), amount: v("amount"), status: v("status"), date: v("date"), notes: v("notes") } });
        S.modal = null; await refresh(); toast("Contract updated"); return;
      }
      if (kind === "delInv") {
        var did = S.modal.id, both = fd.get("where") === "both";
        var rd = await call("deleteInvoice", { invoiceId: did, qb: both }); S.modal = null; S.qbp = null; if (S.money) S.money[S.pid] = null; await refresh(true);
        toast(rd.qb ? (rd.qb.gone ? "Deleted (it was already gone from QuickBooks)" : "Deleted here and in QuickBooks" + (rd.qb.payments ? ", with its payment" : "")) : "Deleted here. It stays in QuickBooks."); return;
      }
      if (kind === "invoice") {
        var file = f.querySelector("[name=pdf]").files[0], pdf = file ? await readPdf(file) : null, lineVals = null;
        if (f.querySelector("[name^='line:']")) { lineVals = {}; f.querySelectorAll("[name^='line:']").forEach(function (x) { if (Number(x.value)) lineVals[x.name.slice(5)] = x.value; }); }
        var ri = await call("saveInvoice", { projectId: S.pid, notify: !!fd.get("notify"), qb: S.me.money ? !!fd.get("qb") : undefined, invoice: { id: S.modal.id || undefined, number: v("number"), title: v("title"), amount: v("amount"), issued: v("issued"), due: v("due"), status: v("status"), paid_date: v("paid_date"), pay_url: v("pay_url"), pdf: pdf, notes: v("notes"), retainage: fd.has("retainage") ? v("retainage") || 0 : undefined, lines: lineVals || undefined } });
        S.modal = null; S.qbp = null; if (S.money) S.money[S.pid] = null; await refresh(true);
        toast(ri.qbError ? "Saved here. QuickBooks: " + ri.qbError : ri.qb ? (ri.qb.voided ? "Voided in QuickBooks too" : "Saved · QuickBooks invoice #" + (ri.qb.number || ri.qb.id) + (ri.qb.payment ? " · payment recorded" : ri.qb.paidInQb ? " · already paid in QuickBooks" : "")) : "Invoice saved"); return;
      }
      if (kind === "sched") {
        await call("saveScheduleItem", { projectId: S.pid, item: { id: S.modal.id || undefined, kind: v("kind"), title: v("title"), start: v("start"), end: v("kind") === "task" ? v("end") : "", phase: v("phase"), owner: v("owner"), status: v("status"), notes: v("notes") } });
        S.modal = null; await refresh(); toast("Schedule updated"); return;
      }
      if (kind === "qbKeys") { S.qb = await call("qbSaveKeys", { clientId: v("clientId"), clientSecret: v("clientSecret"), env: v("env"), redirect: API }); f.reset(); var envSel = f.querySelector("[name=env]"); if (envSel) envSel.value = S.qb.env;   // the redraw keeps what the form shows, so show what was saved
        render(); toast(S.qb.env === "sandbox" ? "Saved for the sandbox (test company). Now click Connect QuickBooks." : "Saved for your real company. Now click Connect QuickBooks."); return; }
      if (kind === "qbLink") { await call("qbLink", { projectId: S.pid, customerId: v("customer") }); S.qbp = null; render(); toast("Linked to QuickBooks"); return; }
      if (kind === "schedReq") {
        await call("requestScheduleChange", { itemId: f.dataset.id, note: v("note") });
        S.modal = null; await refresh(); toast("Sent to Blue Sierra"); return;
      }
      if (kind === "role") {
        await call("setRole", { email: S.modal.email, role: v("role"), money: S.me.admin && fd.has("role") ? !!fd.get("money") : undefined, projectId: S.modal.from === "project" ? S.pid : undefined });
        var fromTeam = S.modal.from === "team"; S.modal = null;
        if (fromTeam) { S.team = null; render(); } else await refresh();
        toast("Role updated"); return;
      }
      if (kind === "check") {
        await call("saveChecklistItem", { projectId: S.pid, item: { id: S.modal.id || undefined, item: v("item"), phase: v("phase"), due: v("due"), aud: fd.getAll("aud"), assignees: fd.getAll("assignees") } });
        S.modal = null; await refresh(); toast("Checklist updated"); return;
      }
    }
  });

  /* Login errors show on the login screen, not only as a toast. */
  var _call = call;
  call = async function (action, body) {
    try { return await _call(action, body); }
    catch (e) { if (action === "requestCode" || action === "verifyCode") { S.err = e.message; renderLogin(); } throw e; }
  };

  /* New version published? Refresh by itself when nobody's typing or in a form (checked every 5 minutes and when you come back). */
  var BUILD = "20261107132147";
  function checkBuild() {
    if (!API) return;
    var base = ((document.querySelector('script[src*="portal-app.js"]') || {}).src || "").replace(/portal-app\.js.*$/, "");
    if (!base) return;
    fetch(base + "portal-version.json?t=" + Date.now(), { cache: "no-store" }).then(function (r) { return r.ok ? r.json() : null; }).then(function (v) {
      if (!v || !v.build || v.build === BUILD || BUILD === "0") return;
      var busy = S.modal || S.busy || document.querySelector(".hp-panel") || [].some.call(document.querySelectorAll("textarea, input[type=text]"), function (t) { return t.value && t === document.activeElement; });
      if (busy) { S.newBuild = true; return; }
      try { if (sessionStorage.getItem("bsp-reload-" + v.build)) return; sessionStorage.setItem("bsp-reload-" + v.build, "1"); } catch (e) { return; }   // once per version, never a loop
      location.reload();
    }).catch(function () {});
  }
  setInterval(checkBuild, 5 * 60000); document.addEventListener("visibilitychange", function () { if (document.visibilityState === "visible") checkBuild(); });
  /* ================= Beta v1.1: live chat, chat dock, support widget, smoother redraws ================= */
  // The Webflow page smooth-scrolls with Lenis, which makes the wheel lag behind. Inside the portal: plain, instant scrolling.
  root.setAttribute("data-lenis-prevent", "");
  /* Smart redraws: instead of rebuilding the whole page on every update, only what changed is touched (morphdom).
     Photos and maps don't flash, animations don't replay, and the box you're typing in is left alone. */
  var MORPH = null;
  (function () { var sc = document.createElement("script"); sc.src = "https://cdn.jsdelivr.net/npm/morphdom@2.7.4/dist/morphdom-umd.min.js"; sc.async = true; sc.onload = function () { MORPH = window.morphdom || null; }; document.head.appendChild(sc); })();
  (function () {
    var desc = Object.getOwnPropertyDescriptor(Element.prototype, "innerHTML"); if (!desc || !desc.set) return;
    try {
      Object.defineProperty(root, "innerHTML", { configurable: true, get: function () { return desc.get.call(root); }, set: function (html) {
        if (!MORPH || !root.firstElementChild) return desc.set.call(root, html);
        var next = document.createElement("div"); desc.set.call(next, html);
        try {
          MORPH(root, next, { childrenOnly: true,
            onBeforeNodeDiscarded: function (n) { return !(n.id === "bsp-dock" || n.id === "bsp-help" || n.id === "bsp-pop" || (n.classList && (n.classList.contains("inc-call") || n.classList.contains("toast") || n.classList.contains("call-win")))); },
            onBeforeElUpdated: function (from, to) {
              if (from.isEqualNode(to)) return false;
              if (from.hasAttribute && from.hasAttribute("data-keep")) return false;
              if (from === document.activeElement && /^(INPUT|TEXTAREA|SELECT)$/.test(from.tagName) && from.tagName === to.tagName && (from.getAttribute("name") || "") === (to.getAttribute("name") || "") && (from.getAttribute("type") || "") === (to.getAttribute("type") || "")) return false;   // same field you're typing in: leave it alone (a different field in the same spot gets replaced)
              return true;
            } });
        } catch (e) { desc.set.call(root, html); }
      } });
    } catch (e) {}
  })();
  var ERRLOG = [];
  window.addEventListener("error", function (e) { ERRLOG.push(String(e.message || e.error || "error").slice(0, 200)); if (ERRLOG.length > 10) ERRLOG.shift(); });
  var _call2 = call;
  call = async function (action, body) {
    try { return await _call2(action, body); }
    catch (e) { if (action !== "tick" && action !== "typing") { ERRLOG.push(action + ": " + String(e.message).slice(0, 160)); if (ERRLOG.length > 10) ERRLOG.shift(); } throw e; }
  };

  /* Redraws never eat what you're typing: chat boxes keep their text, focus and cursor. Then the dock and support widget go back in. */
  function draftKey(t) { var f = t.closest("form") || {}, d = f.dataset || {}; return [d.form || "", d.ch || "", d.root || "", t.name || "", t.closest(".modal") ? "m" : ""].join("|"); }
  var _render0 = render;
  render = function () {
    var keep = [], act = document.activeElement, actKey = null, sel = null;
    root.querySelectorAll("textarea[data-chat], input[data-sp-q]").forEach(function (t) { if (t.closest("#bsp-dock")) return; var k = draftKey(t); keep.push([k, t.value]); if (t === act) { actKey = k; sel = [t.selectionStart, t.selectionEnd]; } });
    var r = _render0.apply(this, arguments);
    var find = function (k) { var hit = null; root.querySelectorAll("textarea[data-chat], input[data-sp-q]").forEach(function (t) { if (!hit && !t.closest("#bsp-dock") && draftKey(t) === k) hit = t; }); return hit; };
    keep.forEach(function (kv) { var t = find(kv[0]); if (t && !t.value && kv[1]) t.value = kv[1]; });
    if (actKey) { var t = find(actKey); if (t) { t.focus({ preventScroll: true }); try { t.setSelectionRange(sel[0], sel[1]); } catch (e) {} } }
    mountFloat(); showTyping(); if (root.querySelector("#ls-map")) setTimeout(lsMapInit, 0);
    return r;
  };

  /* ---------- Live: a tiny check every ~2.5 s while a chat is open (8 s otherwise), from the server's cache only ---------- */
  S.vers = {};
  function liveTarget() {
    if (S.pid && S.tab === "messages" && S.data) return [S.pid, S.chan];
    if (S.dock && S.dock.open && !S.dock.min && S.dock.pid) return [S.dock.pid, S.dock.ch];
    return null;
  }
  var liveT = null;
  function liveLoop(soon) {
    clearTimeout(liveT);
    var vis = document.visibilityState === "visible", fast = vis && !!liveTarget();
    liveT = setTimeout(async function () {
      if (S.token && S.me && !S.viewAs) {
        var tg = liveTarget(), pids = [S.pid, S.dock && S.dock.pid].filter(Boolean);
        if (pids.length) try {
          var r = await call("tick", { pids: pids, pid: tg ? tg[0] : "", ch: tg ? tg[1] : "" });
          S.typing = r.typing || []; showTyping();
          Object.keys(r.vers || {}).forEach(function (pid) { onVer(pid, r.vers[pid]); });
        } catch (e) {}
      }
      liveLoop();
    }, soon ? 300 : !vis ? 30000 : RT && RT.open ? 20000 : fast ? 2500 : 8000);
  }
  document.addEventListener("visibilitychange", function () { if (document.visibilityState === "visible") liveLoop(true); });
  function onVer(pid, v) {
    if (!v) return; var was = S.vers[pid]; S.vers[pid] = v; if (!was || v <= was) return;
    if (pid === S.pid && S.data && S.tab !== "messages") { S.verPid = pid; if (v !== S.ver) { S.ver = v; if (S.busy || S.modal) S.verLater = true; else liveReload(); } return; }
    loadFeed(pid);
  }
  /* Just the chat (much lighter than the whole project), merged in without a jump. */
  async function loadFeed(pid) {
    S.feedBusy = S.feedBusy || {}; if (S.feedBusy[pid]) { S.feedAgain = pid; return; } S.feedBusy[pid] = 1;
    try {
      var r = await call("chatFeed", { projectId: pid });
      S.dockData = S.dockData || {}; S.dockData[pid] = r; S.vers[pid] = Math.max(S.vers[pid] || 0, r.ver || 0);
      if (S.data && S.pid === pid) {
        var pend = (S.data.messages || []).filter(function (m) { return m.pending && !r.messages.some(function (x) { return x.mine && x.text === m.text && x.channel === m.channel; }); });
        var atBottom = window.innerHeight + window.scrollY > document.body.scrollHeight - 220;
        S.data.messages = r.messages.concat(pend); S.ver = Math.max(S.ver || 0, r.ver || 0); S.verPid = pid;
        if (S.tab === "messages" && !S.modal) { keepScroll(render); if (atBottom) window.scrollTo(0, document.body.scrollHeight); markChannelRead(); }
      }
      dockPaint(true);
    } catch (e) {}
    S.feedBusy[pid] = 0; if (S.feedAgain === pid) { S.feedAgain = null; loadFeed(pid); }
  }
  /* "Nayeli is typing…" */
  var typedAt = 0;
  function typedIn(pid, ch) { var t = Date.now(); if (t - typedAt < 2500 || !pid || !ch) return; typedAt = t; call("typing", { pid: pid, ch: ch }).catch(function () {}); }
  root.addEventListener("input", function (e) {
    if (e.target.matches("#bsp-dock textarea")) { typedIn(S.dock.pid, S.dock.ch); return; }
    if (e.target.matches("textarea[data-chat]") && S.pid) { var f = e.target.closest("form"); typedIn(S.pid, f && f.dataset.ch); }
  });
  function typingText() { var n = S.typing || []; return !n.length ? "" : n.length === 1 ? n[0] + " is typing" : n.length === 2 ? n[0] + " and " + n[1] + " are typing" : n.length + " people are typing"; }
  function showTyping() {
    var txt = typingText(), html = txt ? '<span class="dots"><i></i><i></i><i></i></span>' + esc(txt) : "";
    root.querySelectorAll(".typing-line").forEach(function (el) { if (el.dataset.t !== txt) { el.dataset.t = txt; el.innerHTML = html; } });
  }

  /* ---------- The chat dock: bottom-right on every page. Read and reply without leaving what you're looking at. ---------- */
  var DOCK = null, HELP = null;
  S.dock = (function () { try { return JSON.parse(localStorage.getItem("bsp-dock") || "null") || {}; } catch (e) { return {}; } })();
  if (PHONE || window.innerWidth < 700) { S.dock.open = false; S.dock.min = true; }        // on a phone the dock is full screen: never open it by itself
  function dockSave() { try { localStorage.setItem("bsp-dock", JSON.stringify({ open: S.dock.open, min: S.dock.min, pid: S.dock.pid, ch: S.dock.ch, closed: S.dock.closed })); } catch (e) {} }
  function dockUnread() { return (S.projects || []).reduce(function (a, p) { return a + (p.unread || 0); }, 0); }
  function dockChans(d) {
    var ch = (d && d.channels) || ["client"], seen = {};
    ((d && d.messages) || []).forEach(function (m) { if (isDm(m.channel) && dockLabel(d, m.channel) !== "@ private") seen[m.channel] = 1; });   // only conversations with people still on the project
    if (isDm(S.dock.ch)) seen[S.dock.ch] = 1;
    return ch.concat(Object.keys(seen));
  }
  function dockLabel(d, c) {
    if (!isDm(c)) return "# " + ((CH_INFO[c] || [c])[0]);
    var ks = String(c).slice(3).split("-"), other = ks[0] === S.me.key ? ks[1] : ks[0], who = ((d && d.members) || []).filter(function (m) { return m.key === other; })[0];
    return "@ " + (who ? first(who.name) : "private");
  }
  function dockMsg(m) {
    if (m.kind === "event") {
      var isMeet = m.status === "call" && /^meet:/.test(m.ref || ""), isRoom = /^call:/.test(m.ref || "");
      return '<div class="dk-ev' + (S.dock.sel && S.me.admin ? " sel-able" : "") + (S.dock.sel && S.dock.sel[m.id] ? " picked" : "") + '"' + (S.dock.sel && S.me.admin ? ' data-a="dkSel" data-id="' + esc(m.id) + '"' : "") + ">" + esc(m.author) + " " + esc(String(m.text || "").split("\n")[0]) +
        (isRoom ? ' <button class="dk-join" data-a="joinCall" data-room="' + esc(m.ref.slice(5)) + '" data-p="' + esc(S.dock.pid) + '">Join</button>' : isMeet ? ' <a class="dk-join" href="' + esc(meetUrl(m.ref)) + '" target="_blank" rel="noopener">Join</a>' : "") + '<small>' + day(m.at) + "</small></div>";
    }
    var canSel = S.dock.sel && (m.mine || (S.me && S.me.admin));
    return '<div class="dk-m' + (m.mine ? " mine" : "") + (m.pending ? " pending" : "") + (canSel ? " sel-able" : "") + (canSel && S.dock.sel[m.id] ? " picked" : "") + '"' + (canSel ? ' data-a="dkSel" data-id="' + esc(m.id) + '"' : "") + ">" + (m.mine ? "" : av(m.author, m.avatar, m.role, "xs", m.akey)) +
      '<div class="dk-b">' + (m.mine ? "" : "<b>" + esc(first(m.author)) + "</b>") + (m.text ? '<div class="text">' + richText(m.text) + "</div>" : "") +
      ((m.files || []).length ? '<div class="dk-files">📎 ' + m.files.length + " file" + (m.files.length > 1 ? "s" : "") + "</div>" : "") + "<small>" + day(m.at) + "</small></div></div>";
  }
  function mountFloat() {
    if (!S.token || !S.me || S.viewAs || !root.querySelector(".topbar")) { if (DOCK) DOCK.remove(); if (HELP) HELP.remove(); return; }
    if (!DOCK) {
      DOCK = document.createElement("div"); DOCK.id = "bsp-dock";
      DOCK.innerHTML = '<button class="dk-bubble" data-a="dkOpen" aria-label="Open chat">' + ICON.chat + '<span class="dk-count"></span></button>' +
        '<section class="dk-panel" aria-label="Chat"><header class="dk-head"></header><div class="dk-chans"></div><div class="dk-body" data-lenis-prevent></div><div class="dk-typing typing-line" aria-live="polite"></div>' +
        '<form class="dk-form"><textarea rows="1" placeholder="Write a message…" aria-label="Message"></textarea><label class="dk-imp" title="Important: also email them"><input type="checkbox" name="important"> ⚑</label><button class="btn sm" type="submit">Send</button></form></section>';
      var form = DOCK.querySelector(".dk-form"), ta = form.querySelector("textarea");
      form.addEventListener("submit", function (e) { e.preventDefault(); e.stopPropagation(); dockSend(); });
      ta.addEventListener("keydown", function (e) { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); dockSend(); } });
      ta.addEventListener("input", function () { ta.style.height = "auto"; ta.style.height = Math.min(120, ta.scrollHeight) + "px"; });
    }
    if (!HELP) {
      HELP = document.createElement("div"); HELP.id = "bsp-help";
      HELP.innerHTML = '<button class="hp-btn" data-a="helpOpen" title="Something wrong or an idea? Tell us (with a screenshot)">' + ICON.question + "<span>Feedback</span></button>";
    }
    if (DOCK.parentNode !== root) root.appendChild(DOCK);
    if (HELP.parentNode !== root) root.appendChild(HELP);
    dockPaint();
  }
  function dockPaint(fromFeed) {
    if (!DOCK) return;
    var d = S.dock, onFull = S.pid && S.tab === "messages" && (!d.pid || d.pid === S.pid);           // the full chat is on screen: no need for the window too
    if (!d.pid && S.pid) d.pid = S.pid;
    if (!d.pid && (S.projects || []).length) d.pid = S.projects[0].id;
    DOCK.className = (d.open && !d.min ? "open" : "") + (d.closed || onFull || (S.modal && !(d.open && !d.min)) ? " gone" : "");
    if (HELP) HELP.style.display = S.modal ? "none" : "";
    var n = dockUnread(), cnt = DOCK.querySelector(".dk-count"); cnt.textContent = n ? (n > 99 ? "99+" : n) : ""; cnt.style.display = n ? "" : "none";
    if (!(d.open && !d.min)) return;
    var data = (S.dockData || {})[d.pid] || (S.data && S.pid === d.pid ? { messages: S.data.messages, channels: S.data.channels, members: S.data.members, reads: S.data.reads } : null);
    if (!data && !(S.feedBusy || {})[d.pid]) loadFeed(d.pid);
    var chans = dockChans(data); if (chans.indexOf(d.ch) < 0) d.ch = chans[0];
    var projs = S.projects || [], pname = (projs.filter(function (p) { return p.id === d.pid; })[0] || {}).name || "Chat";
    DOCK.querySelector(".dk-head").innerHTML = (projs.length > 1 ? '<select class="dk-proj" aria-label="Project">' + projs.map(function (p) { return '<option value="' + esc(p.id) + '"' + (p.id === d.pid ? " selected" : "") + ">" + esc(p.name) + (p.unread ? " (" + p.unread + ")" : "") + "</option>"; }).join("") + "</select>" : "<b>" + esc(pname) + "</b>") +
      '<button class="dk-x dk-call" data-a="dkCall" title="Video call">' + ICON.video + '</button><button class="dk-x" data-a="dkMore" title="More">⋯</button><button class="dk-x" data-a="dkFull" title="Open the full chat">⤢</button><button class="dk-x" data-a="dkMin" title="Minimize">–</button><button class="dk-x" data-a="dkClose" title="Close">×</button>' +
      (d.more ? '<div class="dk-menu"><button data-a="dkSelStart">Select messages to delete</button>' + (isDm(d.ch) || (S.me && S.me.admin) ? '<button data-a="dkClear" class="bad">Clear this ' + (isDm(d.ch) ? "private chat" : "channel") + "</button>" : "") + "</div>" : "");
    var unreadOf = function (c) { if (!data || c === d.ch) return 0; var r = (data.reads || {})[c] || ""; return (data.messages || []).filter(function (m) { return (m.channel || "client") === c && !m.mine && m.at > r; }).length; };
    DOCK.querySelector(".dk-chans").innerHTML = chans.map(function (c) { var n = unreadOf(c); return '<button class="dk-chan' + (c === d.ch ? " on" : "") + (isDm(c) ? " dm" : "") + '" data-a="dkChan" data-c="' + esc(c) + '">' + esc(dockLabel(data, c)) + (n ? "<i>" + n + "</i>" : "") + "</button>"; }).join("") +
      '<button class="dk-chan add' + (d.picking ? " on" : "") + '" data-a="dkPick" title="Message one person privately">＋ Private</button>';
    var form = DOCK.querySelector(".dk-form"), selBar = DOCK.querySelector(".dk-selbar");
    if (!selBar) { selBar = document.createElement("div"); selBar.className = "dk-selbar"; form.parentNode.insertBefore(selBar, form); }
    var nSel = d.sel ? Object.keys(d.sel).length : 0;
    selBar.innerHTML = d.sel ? '<span>' + (nSel ? nSel + " selected" : "Tap messages to select them") + '</span><button class="btn ghost sm" data-a="dkSelCancel">Cancel</button><button class="btn sm danger-btn" data-a="dkSelDel"' + (nSel ? "" : " disabled") + ">Delete</button>" : "";
    selBar.style.display = d.sel ? "" : "none"; form.style.display = d.sel ? "none" : "";
    if (d.calling) {
      var cands = dockCallables(data, d.ch), bodyC = DOCK.querySelector(".dk-body");
      var htmlC = '<div class="dk-pick"><b>Who do you want to call?</b><span class="muted small">They get a ring right away, wherever they are in the portal.</span>' +
        (cands.length ? cands.map(function (x) { return '<label class="dk-who"><input type="checkbox" value="' + esc(x.key) + '" checked>' + av(x.name, x.avatar, x.role, "xs", x.key) + "<span><b>" + esc(x.name) + '</b><small class="muted">' + esc(roleName(x.role)) + "</small></span></label>"; }).join("") +
          '<button class="btn" data-a="dkCallGo">' + ICON.video + " Call</button>" : '<p class="muted small">Nobody else can be called here.</p>') + "</div>";
      if (bodyC.dataset.h !== String(scHash(htmlC))) { bodyC.innerHTML = htmlC; bodyC.dataset.h = scHash(htmlC); }
      return;
    }
    if (d.picking) {
      var who = ((data && data.members) || []).filter(function (x) { return x.key && x.key !== S.me.key && dmOk(x.role); });
      var bodyP = DOCK.querySelector(".dk-body"), htmlP = '<div class="dk-pick"><b>Message privately</b><span class="muted small">Only the two of you will see it.' + (staff() ? "" : " You can message Blue Sierra.") + "</span>" +
        (who.length ? who.map(function (x) { return '<button class="dk-who" data-a="dkDm" data-k="' + esc(x.key) + '">' + av(x.name, x.avatar, x.role, "xs", x.key) + "<span><b>" + esc(x.name) + '</b><small class="muted">' + esc(roleName(x.role)) + "</small></span></button>"; }).join("") : '<p class="muted small">Nobody to message here yet.</p>') + "</div>";
      if (bodyP.dataset.h !== String(scHash(htmlP))) { bodyP.innerHTML = htmlP; bodyP.dataset.h = scHash(htmlP); }
      return;
    }
    var body = DOCK.querySelector(".dk-body"), atBottom = body.scrollHeight - body.scrollTop - body.clientHeight < 60;
    var list = data ? (data.messages || []).filter(function (m) { return (m.channel || "client") === d.ch && !m.thread_id && m.kind !== "answer"; }).slice(-60) : null;
    var html = !data ? '<p class="muted small dk-empty">Loading…</p>' : list.length ? list.map(dockMsg).join("") : '<p class="muted small dk-empty">No messages here yet. Say hi 👋</p>';
    if (body.dataset.h !== String(scHash(html))) { body.innerHTML = html; body.dataset.h = scHash(html); if (atBottom || !fromFeed) body.scrollTop = body.scrollHeight; }
    if (data && list && list.length && document.visibilityState === "visible") {
      var last = list[list.length - 1], r = ((data.reads || {})[d.ch] || "");
      if (!last.mine && last.at > r) { (data.reads = data.reads || {})[d.ch] = last.at; call("markRead", { projectId: d.pid, channel: d.ch }).then(function () { var pr = (S.projects || []).filter(function (p) { return p.id === d.pid; })[0]; if (pr) { pr.unread = 0; dockPaint(); } }).catch(function () {}); }
    }
  }
  function dropLocal(pid, test) {
    if (S.dockData && S.dockData[pid]) S.dockData[pid].messages = (S.dockData[pid].messages || []).filter(function (m) { return !test(m); });
    if (S.data && S.pid === pid) { S.data.messages = S.data.messages.filter(function (m) { return !test(m); }); if (S.tab === "messages") keepScroll(render); }
    S.sel = null; if (DOCK) { DOCK.querySelector(".dk-body").dataset.h = ""; dockPaint(true); }
  }
  async function dockSend() {
    var d = S.dock, ta = DOCK.querySelector(".dk-form textarea"), imp = DOCK.querySelector("[name=important]"), text = ta.value.trim(); if (!text || !d.pid) return;
    var data = (S.dockData || {})[d.pid], nd = new Date(), p2 = function (x) { return String(x).padStart(2, "0"); };
    var tmp = { id: "tmp" + nd.getTime(), pending: true, mine: true, author: S.me.name, role: S.me.role, akey: S.me.key, avatar: S.me.avatar, kind: "message", text: text, channel: d.ch, thread_id: "", files: [], reactions: [],
      at: nd.getFullYear() + "-" + p2(nd.getMonth() + 1) + "-" + p2(nd.getDate()) + " " + p2(nd.getHours()) + ":" + p2(nd.getMinutes()) };
    if (data) data.messages = (data.messages || []).concat([tmp]);
    if (S.data && S.pid === d.pid && S.data.messages !== (data || {}).messages) S.data.messages.push(tmp);
    ta.value = ""; ta.style.height = "auto"; var important = imp.checked; imp.checked = false; dockPaint();
    try { await call("sendMessage", { projectId: d.pid, channel: d.ch, text: text, important: important }); if (important) toast("Sent · emailed too"); }
    catch (e) { ta.value = text; if (data) data.messages = data.messages.filter(function (m) { return m !== tmp; }); toast(e.message); dockPaint(); return; }
    loadFeed(d.pid);
  }
  root.addEventListener("change", function (e) { if (e.target.matches("#bsp-dock .dk-proj")) { S.dock.pid = e.target.value; S.dock.ch = ""; dockSave(); dockPaint(); loadFeed(S.dock.pid); liveLoop(true); } });
  function dockAction(a, b) {
    var d = S.dock;
    if (a === "dkOpen") { d.open = true; d.min = false; d.closed = false; if (S.pid) d.pid = d.pid || S.pid; dockSave(); dockPaint(); loadFeed(d.pid); liveLoop(true); setTimeout(function () { var t = DOCK.querySelector("textarea"); if (t && !PHONE) t.focus(); }, 50); return true; }
    if (a === "dkMin") { d.min = true; d.open = false; dockSave(); dockPaint(); return true; }
    if (a === "dkClose") { d.closed = true; d.open = false; dockSave(); dockPaint(); toast("Chat closed. It comes back when someone writes, or from the 💬 in the top bar."); return true; }
    if (a === "dkMore") { d.more = !d.more; dockPaint(); return true; }
    if (a === "dkSelStart") { d.more = false; d.picking = false; d.calling = false; d.sel = {}; DOCK.querySelector(".dk-body").dataset.h = ""; dockPaint(); return true; }
    if (a === "dkSel") { if (d.sel[b.dataset.id]) delete d.sel[b.dataset.id]; else d.sel[b.dataset.id] = 1; DOCK.querySelector(".dk-body").dataset.h = ""; dockPaint(true); return true; }
    if (a === "dkSelCancel") { d.sel = null; DOCK.querySelector(".dk-body").dataset.h = ""; dockPaint(true); return true; }
    if (a === "dkSelDel") { var ids = Object.keys(d.sel || {}); if (!ids.length) return true;
      sure("Delete " + ids.length + " message" + (ids.length > 1 ? "s" : "") + "? Everyone stops seeing " + (ids.length > 1 ? "them" : "it") + ".", function () {
        call("deleteMessages", { projectId: d.pid, ids: ids }).then(function () { d.sel = null; dropLocal(d.pid, function (m) { return ids.indexOf(m.id) > -1; }); toast("Deleted"); }).catch(function (er) { toast(er.message); }); });
      return true; }
    if (a === "dkClear") { d.more = false; var chx = d.ch;
      sure("Clear the whole " + (isDm(chx) ? "private chat" : "#" + chx + " channel") + "? Every message in it is deleted for everyone, and it can't be undone.", function () {
        call("clearChat", { projectId: d.pid, channel: chx }).then(function (r) { dropLocal(d.pid, function (m) { return (m.channel || "client") === chx; }); toast("Cleared (" + r.deleted + " messages)"); }).catch(function (er) { toast(er.message); }); });
      dockPaint(); return true; }
    if (a === "dkCall") { d.more = false; d.picking = false; d.sel = null;
      var dd = (S.dockData || {})[d.pid] || (S.data && S.pid === d.pid ? S.data : null);
      if (isDm(d.ch)) { var other = dockCallables(dd, d.ch)[0]; if (other) startCallNow(b, [other.key], d.pid, d.ch, other.name); return true; }
      d.calling = !d.calling; DOCK.querySelector(".dk-body").dataset.h = ""; dockPaint(); return true; }
    if (a === "dkCallGo") { var keys = [].map.call(DOCK.querySelectorAll(".dk-pick input:checked"), function (x) { return x.value; }); if (!keys.length) { toast("Pick someone to call"); return true; }
      var dd2 = (S.dockData || {})[d.pid] || (S.data && S.pid === d.pid ? S.data : null), one = keys.length === 1 ? (dockCallables(dd2, d.ch).filter(function (x) { return x.key === keys[0]; })[0] || {}).name : keys.length + " people";
      d.calling = false; DOCK.querySelector(".dk-body").dataset.h = ""; dockPaint(); startCallNow(b, keys, d.pid, d.ch, one); return true; }
    if (a === "dkPick") { d.calling = false; d.picking = !d.picking; DOCK.querySelector(".dk-body").dataset.h = ""; dockPaint(); return true; }
    if (a === "dkDm") { d.picking = false; d.ch = dmKey(b.dataset.k); dockSave(); DOCK.querySelector(".dk-body").dataset.h = ""; dockPaint(); liveLoop(true); setTimeout(function () { var t = DOCK.querySelector("textarea"); if (t) t.focus(); }, 30); return true; }
    if (a === "dkChan") { d.picking = false; d.calling = false; d.sel = null; d.more = false; d.ch = b.dataset.c; dockSave(); var body = DOCK.querySelector(".dk-body"); body.dataset.h = ""; dockPaint(); liveLoop(true); return true; }
    if (a === "dkFull") { d.open = false; d.min = true; dockSave(); S.wantChan = d.ch; go(d.pid, "messages"); return true; }
    return false;
  }
  /* A new message brings a closed dock back as a bubble. */
  var _onPulse = onPulse;
  onPulse = function (p) { if (p && p.id && S.pulseId != null && p.id !== S.pulseId && S.dock.closed) { S.dock.closed = false; dockSave(); } _onPulse(p); dockPaint(); };

  /* ---------- Support widget: a screenshot of what's wrong (mark it up) + a short note, straight to Jesús ---------- */
  var H2C = "https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js";
  function loadH2C(src) { return new Promise(function (res, rej) { if (window.html2canvas) return res(); var s = document.createElement("script"); s.src = src; s.onload = res; s.onerror = function () { rej(new Error("Couldn't load the screenshot tool.")); }; document.head.appendChild(s); }); }
  async function snapPage() {
    await loadH2C(H2C);
    var c = await window.html2canvas(document.body, { useCORS: true, logging: false, backgroundColor: "#f6f2eb", scale: Math.min(1.5, window.devicePixelRatio || 1),
      x: window.scrollX, y: window.scrollY, width: window.innerWidth, height: window.innerHeight, windowWidth: document.documentElement.clientWidth,
      ignoreElements: function (el) { return el.id === "bsp-help" || el.classList && el.classList.contains("hp-panel"); } });
    return c;
  }
  /* An exact screenshot of this tab (Chrome/Edge/Safari on a computer ask "share this tab?" once). Phones fall back to a redraw. */
  function grabTab() {
    var md = navigator.mediaDevices; if (PHONE || !md || !md.getDisplayMedia) return Promise.reject(new Error("unsupported"));
    return md.getDisplayMedia({ video: { displaySurface: "browser", frameRate: 5 }, audio: false, preferCurrentTab: true, selfBrowserSurface: "include", surfaceSwitching: "exclude", monitorTypeSurfaces: "exclude" })
      .then(function (stream) {
        var v = document.createElement("video"); v.muted = true; v.playsInline = true; v.srcObject = stream;
        var stop = function () { stream.getTracks().forEach(function (t) { t.stop(); }); };
        return v.play().then(function () { return new Promise(function (r) { setTimeout(r, 400); }); }).then(function () {
          var c = document.createElement("canvas"); c.width = v.videoWidth; c.height = v.videoHeight; c.getContext("2d").drawImage(v, 0, 0); stop();
          if (!c.width) throw new Error("empty"); return c;
        }, function (e) { stop(); throw e; });
      });
  }
  function helpOpen() {
    if (document.querySelector(".hp-panel")) return;
    var shot = grabTab();                                   // must start right inside the click
    shot.catch(function () {});
    helpPanel(shot);
  }
  async function helpPanel(grab) {
    var w = document.createElement("div"); w.className = "hp-panel"; w.setAttribute("role", "dialog"); w.setAttribute("aria-label", "Report a problem");
    w.innerHTML = '<div class="hp-card"><div class="hp-top"><b>Help us fix it</b><span class="muted small">Beta v1.1 · goes straight to Jesús</span><button class="hp-x" aria-label="Close">×</button></div>' +
      '<div class="hp-shot"><p class="muted small hp-wait">Taking a screenshot of this page…</p></div>' +
      '<div class="hp-tools"><span class="muted small">Draw on it to point at the problem</span><button type="button" class="link small hp-undo">Undo</button><button type="button" class="link small hp-clear">Clear</button><label class="link small">Use another image<input type="file" accept="image/*" hidden class="hp-file"></label></div>' +
      '<div class="hp-chips">' + ["Something's broken", "Too slow", "Looks wrong", "Idea"].map(function (t) { return '<button type="button" class="chip" data-t="' + esc(t) + '">' + esc(t) + "</button>"; }).join("") + "</div>" +
      '<textarea class="hp-text" rows="3" placeholder="What happened? What did you expect? (one or two lines is perfect)"></textarea>' +
      '<p class="muted small hp-ctx">We also send: the page you\'re on, your browser and screen size, and any recent errors. Nothing else.</p>' +
      '<div class="actions"><button type="button" class="btn ghost hp-cancel">Cancel</button><button type="button" class="btn hp-send">Send</button></div></div>';
    document.body.appendChild(w);
    var close = function () { w.remove(); }, kind = "";
    w.querySelector(".hp-x").onclick = close; w.querySelector(".hp-cancel").onclick = close; w.addEventListener("click", function (e) { if (e.target === w) close(); });
    w.querySelectorAll(".hp-chips .chip").forEach(function (c) { c.onclick = function () { w.querySelectorAll(".hp-chips .chip").forEach(function (x) { x.classList.remove("on"); }); c.classList.add("on"); kind = c.dataset.t; }; });
    var shot = w.querySelector(".hp-shot"), base = null, cv = null, ctx = null, strokes = [], cur = null;
    function draw() { if (!cv) return; ctx.drawImage(base, 0, 0, cv.width, cv.height); ctx.lineWidth = Math.max(3, cv.width / 260); ctx.lineCap = "round"; ctx.lineJoin = "round"; ctx.strokeStyle = "#e5322d";
      strokes.forEach(function (s) { ctx.beginPath(); s.forEach(function (pt, i) { if (i) ctx.lineTo(pt[0], pt[1]); else ctx.moveTo(pt[0], pt[1]); }); ctx.stroke(); }); }
    function useImage(src) {
      base = src; cv = document.createElement("canvas"); var sc = Math.min(1, 1600 / (src.width || 1)); cv.width = Math.round(src.width * sc); cv.height = Math.round(src.height * sc); ctx = cv.getContext("2d");
      shot.innerHTML = ""; shot.appendChild(cv); strokes = []; draw();
      var pos = function (e) { var r = cv.getBoundingClientRect(); return [(e.clientX - r.left) * cv.width / r.width, (e.clientY - r.top) * cv.height / r.height]; };
      cv.onpointerdown = function (e) { cv.setPointerCapture(e.pointerId); cur = [pos(e)]; strokes.push(cur); draw(); };
      cv.onpointermove = function (e) { if (!cur) return; cur.push(pos(e)); draw(); };
      cv.onpointerup = cv.onpointercancel = function () { cur = null; };
    }
    w.querySelector(".hp-undo").onclick = function () { strokes.pop(); draw(); };
    w.querySelector(".hp-clear").onclick = function () { strokes = []; draw(); };
    w.querySelector(".hp-file").onchange = function (e) { var f = e.target.files[0]; if (!f) return; var im = new Image(); im.onload = function () { useImage(im); }; im.src = URL.createObjectURL(f); };
    w.style.visibility = "hidden"; w.setAttribute("data-lenis-prevent", "");
    try { var c = await grab.catch(function () { return snapPage(); }); useImage(c); } catch (e) { shot.innerHTML = '<p class="muted small">Couldn\'t take the screenshot here. Use "Use another image" to add one, or just write what happened.</p>'; }
    w.style.visibility = "";
    w.querySelector(".hp-text").focus();
    w.querySelector(".hp-send").onclick = function () {
      var btn = this, note = w.querySelector(".hp-text").value.trim(); if (!note && !cv) return toast("Write what happened, or add a screenshot.");
      btn.disabled = true; btn.textContent = "Sending…";
      var meta = { pid: S.pid || "", tab: S.pid ? S.tab : "", view: S.pid ? "" : S.home || "home", hash: location.hash, ua: navigator.userAgent, screen: window.innerWidth + "×" + window.innerHeight, errors: ERRLOG.slice(-5), version: "beta 1.1", kind: kind };
      call("feedback", { text: (kind ? "[" + kind + "] " : "") + note, image: cv ? cv.toDataURL("image/jpeg", 0.82) : "", meta: meta })
        .then(function () { w.querySelector(".hp-card").innerHTML = '<div class="hp-done"><b>Thank you! 🙌</b><p class="muted">Jesús got it with the screenshot. We\'ll fix it fast.</p><button class="btn" type="button">Close</button></div>'; w.querySelector(".hp-done .btn").onclick = close; })
        .catch(function (e) { btn.disabled = false; btn.textContent = "Send"; toast(e.message); });
    };
  }
  function meetUrl(ref) { var u = String(ref || "").replace(/^meet:/, ""); if (!S.me || /authuser=/.test(u)) return u; return u.split("?")[0] + "?authuser=" + encodeURIComponent(S.me.email); }

  /* Admin: the beta feedback, newest first (Home → Team). */
  function feedbackCard() {
    if (!S.me || !S.me.admin) return "";
    if (!S.fb) { S.fb = "loading"; call("listFeedback").then(function (r) { S.fb = r.items; }).catch(function () { S.fb = []; }).then(function () { if (!S.pid && S.home === "team") keepScroll(render); }); }
    var list = S.fb === "loading" ? null : S.fb, open = (list || []).filter(function (f) { return f.status !== "done"; });
    return '<div class="section-title"><div><h2>Beta feedback</h2><span class="muted small">What people reported with the Feedback tab (left edge of the screen). It also lands in your email.</span></div></div>' +
      '<div class="card fb-list">' + (!list ? '<p class="muted small">Loading…</p>' : !list.length ? '<p class="muted small">Nothing yet. 🎉</p>' : list.slice(0, 20).map(function (f) {
        return '<div class="fb-row' + (f.status === "done" ? " done" : "") + '">' + (f.shot ? '<a href="' + esc(f.link) + '" target="_blank" rel="noopener"><img src="' + esc(f.shot) + '" alt="Screenshot" loading="lazy"></a>' : '<span class="fb-noimg">✎</span>') +
          '<div><b>' + esc(f.name) + '</b> <small class="muted">' + esc([f.project, f.tab].filter(Boolean).join(" · ")) + " · " + day(String(f.at).slice(0, 10)) + "</small><p>" + esc(f.text || "(screenshot only)") + "</p></div>" +
          '<button class="btn ghost sm" data-a="fbDone" data-id="' + esc(f.id) + '" data-s="' + (f.status === "done" ? "open" : "done") + '">' + (f.status === "done" ? "Reopen" : "Fixed") + "</button></div>";
      }).join("")) + (open.length ? '<p class="muted small">' + open.length + " open</p>" : "") + "</div>";
  }
  root.addEventListener("click", function (e) {
    var b = e.target.closest("[data-a]"); if (!b) return;
    var a = b.dataset.a;
    if (/^dk/.test(a)) { e.preventDefault(); e.stopImmediatePropagation(); dockAction(a, b); return; }
    if (a === "helpOpen") { e.preventDefault(); e.stopImmediatePropagation(); helpOpen(); return; }
    if (a === "fbDone") { e.preventDefault(); e.stopImmediatePropagation(); call("setFeedback", { id: b.dataset.id, status: b.dataset.s }).then(function () { (S.fb || []).forEach(function (f) { if (f.id === b.dataset.id) f.status = b.dataset.s; }); keepScroll(render); }).catch(function (er) { toast(er.message); }); return; }
    // Chat clean-up (full chat)
    if (a === "selStart") { e.preventDefault(); e.stopImmediatePropagation(); S.sel = {}; keepScroll(render); return; }
    if (a === "selCancel") { e.preventDefault(); e.stopImmediatePropagation(); S.sel = null; keepScroll(render); return; }
    if (a === "selPick") { if (e.target.closest("a, .m-tools, .rx, .rx-pop, .m-replies, .ev-btn")) return; e.preventDefault(); e.stopImmediatePropagation(); if (S.sel[b.dataset.id]) delete S.sel[b.dataset.id]; else S.sel[b.dataset.id] = 1; keepScroll(render); return; }
    if (a === "selDelete") { e.preventDefault(); e.stopImmediatePropagation(); var ids = Object.keys(S.sel || {}); if (!ids.length) return; var pidD = S.pid;
      sure("Delete " + ids.length + " message" + (ids.length > 1 ? "s" : "") + "? Everyone stops seeing " + (ids.length > 1 ? "them" : "it") + ".", function () {
        call("deleteMessages", { projectId: pidD, ids: ids }).then(function () { dropLocal(pidD, function (m) { return ids.indexOf(m.id) > -1; }); toast("Deleted"); }).catch(function (er) { toast(er.message); }); });
      return; }
    if (a === "clearChat") { e.preventDefault(); e.stopImmediatePropagation(); var chc = S.chan, pidC = S.pid;
      sure("Clear the whole " + (isDm(chc) ? "private chat with " + dmWith(chc).name : "#" + chc + " channel") + "? Every message in it is deleted for everyone, and it can't be undone.", function () {
        call("clearChat", { projectId: pidC, channel: chc }).then(function (r) { dropLocal(pidC, function (m) { return (m.channel || "client") === chc; }); toast("Cleared (" + r.deleted + " messages)"); }).catch(function (er) { toast(er.message); }); });
      return; }
    if (a === "chan") S.sel = null;
    // Join a call inside the portal (from a chat card)
    if (a === "joinCall") { e.preventDefault(); e.stopImmediatePropagation(); var pj = b.dataset.p || S.pid;
      run(b, async function () { var jr = await call("joinCall", { projectId: pj, room: b.dataset.room }); callWindow(jr.url, "Video call"); }); return; }
    // Never leave the page to talk to someone: the message pop-up, the person card and Who's around open the chat window
    if (S.tab !== "messages" || !S.pid) {
      if (a === "actOpen" && b.closest("#bsp-pop")) { e.preventDefault(); e.stopImmediatePropagation(); hidePop(); S.dock.pid = b.dataset.p; S.dock.ch = b.dataset.c; S.dock.picking = S.dock.calling = false; S.dock.sel = null; S.dock.closed = false; if (DOCK) DOCK.querySelector(".dk-body").dataset.h = ""; dockAction("dkOpen", b); loadFeed(b.dataset.p); return; }
      if (a === "dmPick" && S.pid) { e.preventDefault(); e.stopImmediatePropagation(); S.modal = null; keepScroll(render); S.dock.pid = S.pid; S.dock.ch = dmKey(b.dataset.k); S.dock.picking = S.dock.calling = false; S.dock.closed = false; if (DOCK) DOCK.querySelector(".dk-body").dataset.h = ""; dockAction("dkOpen", b); loadFeed(S.pid); return; }
    }
    if (a === "callPerson") { e.preventDefault(); e.stopImmediatePropagation(); S.peopleOpen = false; S.modal = null; keepScroll(render); var pidP = b.dataset.p || S.pid; if (!pidP) return toast("Open a project first");
      var wp = ((S.presence && S.presence.people) || []).filter(function (x) { return x.key === b.dataset.k; })[0];
      startCallNow(null, [b.dataset.k], pidP, dmKey(b.dataset.k), wp ? wp.name : ""); return; }
    if (a === "chatDock") { e.preventDefault(); e.stopImmediatePropagation(); S.dock.closed = false; if (S.dock.open && !S.dock.min) dockAction("dkMin", b); else dockAction("dkOpen", b); return; }
    if (a === "dmGo" && !(S.pid === b.dataset.p && S.tab === "messages")) { e.preventDefault(); e.stopImmediatePropagation(); S.peopleOpen = false; keepScroll(render);
      S.dock.pid = b.dataset.p; S.dock.ch = dmKey(b.dataset.k); S.dock.picking = false; S.dock.closed = false; DOCK && (DOCK.querySelector(".dk-body").dataset.h = ""); dockAction("dkOpen", b); loadFeed(b.dataset.p); return; }
  }, true);
  /* ---------- Instant (Firebase): the server rings a private doorbell; we hear it in well under a second ---------- */
  var RT = { es: null, url: "", u: "", open: false, tes: null, tkey: "", typ: {} };
  function rtStart() {
    var cfg = S.me && S.me.rt; if (!cfg || !window.EventSource || S.viewAs) return rtStop();
    if (RT.es && RT.u === cfg.u) return;
    rtStop(); RT.url = cfg.url; RT.u = cfg.u;
    var es = RT.es = new EventSource(cfg.url + "/rt/u/" + cfg.u + ".json"), first = true;
    es.onopen = function () { RT.open = true; };
    es.onerror = function () { RT.open = false; };
    var on = function (ev) {
      var d; try { d = JSON.parse(ev.data); } catch (e) { return; } if (!d) return;
      RT.open = true;
      if (first && d.path === "/") { first = false; return; }                      // what was there before we connected
      first = false;
      if (d.path === "/m" && d.data && d.data.m) return rtMessage(d.data);
      if (d.path === "/call" && d.data && d.data.url) return incomingCall(d.data);
      var mv = /^\/v\/(.+)$/.exec(d.path || ""); if (mv) return onVer(mv[1], d.data);
      if (d.path === "/v" && d.data) Object.keys(d.data).forEach(function (pid) { onVer(pid, d.data[pid]); });
    };
    es.addEventListener("put", on); es.addEventListener("patch", on);
  }
  function rtStop() { if (RT.es) try { RT.es.close(); } catch (e) {} RT.es = null; RT.open = false; RT.u = ""; rtTypingWatch(null); }
  /* A message arrived: put it in place (replacing our own grey "sending" copy), redraw only what shows it. */
  function rtMessage(e) {
    var m = e.m, pid = e.pid, add = function (list) {
      if (!list) return list; if (list.some(function (x) { return x.id === m.id; })) return list;
      var i = -1; list.forEach(function (x, j) { if (i < 0 && x.pending && x.mine && m.mine && x.text === m.text && (x.channel || "client") === m.channel) i = j; });
      if (i > -1) { list = list.slice(); list[i] = m; return list; } return list.concat([m]);
    };
    var here = S.pid === pid && S.data;
    if (here) {
      var atBottom = window.innerHeight + window.scrollY > document.body.scrollHeight - 220;
      S.data.messages = add(S.data.messages);
      if (S.tab === "messages" && !S.modal) { keepScroll(render); if (atBottom) window.scrollTo(0, document.body.scrollHeight); if (m.channel === S.chan && document.visibilityState === "visible") markChannelRead(); }
    }
    if (S.dockData && S.dockData[pid]) S.dockData[pid].messages = add(S.dockData[pid].messages);
    if (RT.typ) Object.keys(RT.typ).forEach(function (k) { if (RT.typ[k].n === first(m.author)) delete RT.typ[k]; });
    rtShowTyping();
    if (!m.mine) {
      var seen = (here && S.tab === "messages" && S.chan === m.channel && document.visibilityState === "visible") || (S.dock.open && !S.dock.min && S.dock.pid === pid && S.dock.ch === m.channel && document.visibilityState === "visible");
      if (!seen) {
        var pr = (S.projects || []).filter(function (x) { return x.id === pid; })[0]; if (pr) pr.unread = (pr.unread || 0) + 1;
        S.pulseId = m.id; if (S.dock.closed) { S.dock.closed = false; dockSave(); }
        var pp = { id: m.id, pid: pid, channel: m.channel, thread_id: m.thread_id || "", author: m.author, avatar: m.avatar, akey: m.akey, project: pr ? pr.name : "", dm: isDm(m.channel), kind: m.kind };
        var where = pp.dm ? "privately" : m.kind === "event" ? "" : "in #" + m.channel, line = m.kind === "event" ? m.author + " " + String(m.text).split("\n")[0] : String(m.text).split("\n")[0];
        showPop(pp, where, line);
        try { if (document.visibilityState !== "visible" && window.Notification && Notification.permission === "granted") { var n = new Notification(m.author + (pp.dm ? " (private)" : " · " + pp.project), { body: line, tag: "bsp-" + m.id }); n.onclick = function () { window.focus(); S.wantChan = m.channel; go(pid, "messages"); n.close(); }; } } catch (er) {}
        var bb = root.querySelector(".bell"); if (bb) loadNotif();
      }
    }
    dockPaint(true);
  }
  /* Typing, browser to browser: write my dot, watch the channel I have open. */
  function rtSecretFor(pid, ch) { var r = (S.data && S.pid === pid && S.data.rt) || ((S.dockData || {})[pid] || {}).rt; return r ? r[ch] : ""; }
  function rtTypingWatch(sec) {
    if (RT.tkey === (sec || "")) return; if (RT.tes) try { RT.tes.close(); } catch (e) {} RT.tes = null; RT.tkey = sec || ""; RT.typ = {}; rtShowTyping();
    if (!sec || !RT.url) return;
    var es = RT.tes = new EventSource(RT.url + "/rt/t/" + sec + ".json"), first = true;
    var on = function (ev) { var d; try { d = JSON.parse(ev.data); } catch (e) { return; } if (!d) return;
      var now = Date.now(), put = function (k, v) { if (k === S.me.key) return; if (v && v.n && !first) RT.typ[k] = { n: v.n, at: now }; else if (!v) delete RT.typ[k]; };
      if (d.path === "/") { if (d.data) Object.keys(d.data).forEach(function (k) { put(k, d.data[k]); }); }
      else { var k = String(d.path).split("/")[1]; if (k) put(k, d.data); }
      first = false; rtShowTyping(); };
    es.addEventListener("put", on); es.addEventListener("patch", on);
  }
  function rtShowTyping() { var now = Date.now(), names = Object.keys(RT.typ || {}).filter(function (k) { return now - RT.typ[k].at < 5000; }).map(function (k) { return RT.typ[k].n; }); if (RT.tes) { S.typing = names; showTyping(); } }
  setInterval(function () { if (RT.tes) rtShowTyping(); var tg = liveTarget(); rtTypingWatch(tg && RT.es ? rtSecretFor(tg[0], tg[1]) : null); if (S.me && S.me.rt && !RT.es) rtStart(); if ((!S.me || !S.token) && RT.es) rtStop(); }, 1000);
  var _typedIn = typedIn;
  typedIn = function (pid, ch) {
    var sec = RT.es && rtSecretFor(pid, ch);
    if (!sec) return _typedIn(pid, ch);
    var t = Date.now(); if (t - typedAt < 2000) return; typedAt = t;
    fetch(RT.url + "/rt/t/" + sec + "/" + S.me.key + ".json", { method: "PUT", body: JSON.stringify({ n: first(S.me.name), t: t }) }).catch(function () {});
  };
  /* ---------- The call, inside the portal: a floating window you can drag, shrink to a pill, or pop out ---------- */
  function callWindow(url, title) {
    endIncoming(); var old = root.querySelector(".call-win"); if (old) old.remove();
    var w = document.createElement("div"); w.className = "call-win"; w.setAttribute("data-lenis-prevent", "");
    w.innerHTML = '<div class="cw-head"><span class="cw-dot"></span><b>' + esc(title || "Video call") + '</b><span class="cw-time">0:00</span>' +
      '<button type="button" data-cw="min" title="Shrink (the call keeps going)">–</button><button type="button" data-cw="pop" title="Open in its own window">⤢</button><button type="button" data-cw="end" class="cw-end">Leave</button></div>' +
      '<iframe src="' + esc(url) + '" allow="camera; microphone; fullscreen; display-capture; autoplay; clipboard-write; speaker-selection" allowfullscreen title="Video call"></iframe>';
    root.appendChild(w);
    var t0 = Date.now(), tm = w.querySelector(".cw-time"), iv = setInterval(function () { if (!w.isConnected) return clearInterval(iv); var s = Math.floor((Date.now() - t0) / 1000); tm.textContent = Math.floor(s / 60) + ":" + String(s % 60).padStart(2, "0"); }, 1000);
    w.querySelector("[data-cw=min]").onclick = function () { w.classList.toggle("min"); this.textContent = w.classList.contains("min") ? "▢" : "–"; };
    w.querySelector("[data-cw=pop]").onclick = function () { window.open(url, "bsp-call", "width=1180,height=780"); w.remove(); };
    w.querySelector("[data-cw=end]").onclick = function () { w.remove(); toast("You left the call"); };
    // drag by the title bar (desktop)
    var head = w.querySelector(".cw-head"), sx, sy, ox, oy;
    head.addEventListener("pointerdown", function (e) { if (e.target.closest("button") || PHONE) return; var r = w.getBoundingClientRect(); sx = e.clientX; sy = e.clientY; ox = r.left; oy = r.top; head.setPointerCapture(e.pointerId); w.classList.add("drag"); });
    head.addEventListener("pointermove", function (e) { if (sx == null) return; w.style.left = Math.max(8, Math.min(window.innerWidth - 120, ox + e.clientX - sx)) + "px"; w.style.top = Math.max(8, Math.min(window.innerHeight - 60, oy + e.clientY - sy)) + "px"; w.style.right = "auto"; w.style.bottom = "auto"; });
    head.addEventListener("pointerup", function () { sx = null; w.classList.remove("drag"); });
  }
  /* Calls from the chat window and from Who's around: no page change. */
  function dockCallables(d, ch) {
    return ((d && d.members) || []).filter(function (mb) {
      if (!mb.key || mb.key === S.me.key) return false;
      return isDm(ch) ? ch.indexOf(mb.key) > -1 : ch === "team" ? ["admin", "staff", "crew"].indexOf(mb.role) > -1 : ch === "architect" ? ["admin", "staff", "architect"].indexOf(mb.role) > -1 : ch === "crew" ? ["admin", "staff", "crew"].indexOf(mb.role) > -1 : mb.role !== "crew";
    });
  }
  /* ---------- Incoming call: rings wherever you are, with Accept / Decline ---------- */
  var RING = null;
  function ringStart() {
    try {
      var Ctx = window.AudioContext || window.webkitAudioContext; if (!Ctx) return; var ac = new Ctx(), on = true;
      var beep = function () { if (!on) return; [0, 0.35].forEach(function (t) { var o = ac.createOscillator(), g = ac.createGain(); o.type = "sine"; o.frequency.value = 880; g.gain.setValueAtTime(0.0001, ac.currentTime + t); g.gain.exponentialRampToValueAtTime(0.18, ac.currentTime + t + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, ac.currentTime + t + 0.28); o.connect(g); g.connect(ac.destination); o.start(ac.currentTime + t); o.stop(ac.currentTime + t + 0.3); }); };
      beep(); var iv = setInterval(beep, 2200);
      RING = function () { on = false; clearInterval(iv); try { ac.close(); } catch (e) {} RING = null; };
    } catch (e) {}
  }
  function incomingCall(c) {
    if (!c || Date.now() - (c.ts || 0) > 90000 || S.lastCall === c.id) return;      // old ring from before we connected
    S.lastCall = c.id; endIncoming();
    var w = document.createElement("div"); w.className = "inc-call"; w.setAttribute("role", "alertdialog"); w.setAttribute("aria-label", c.from + " is calling");
    w.innerHTML = '<div class="ic-card"><div class="ic-ring">' + av(c.from, c.avatar, "", "", c.akey) + '</div><div class="ic-txt"><b>' + esc(c.from) + '</b><span>is calling you · ' + esc(c.project || "") + '</span><small>Google Meet · ' + esc(c.code || "") + "</small></div>" +
      '<div class="ic-acts"><button class="ic-no" aria-label="Decline">' + ICON.x + '<span>Decline</span></button><a class="ic-yes" href="' + esc(c.url) + '" target="' + (PHONE ? "_blank" : "bsp-meet") + '" rel="noopener">' + ICON.video + "<span>Accept</span></a></div></div>";
    root.appendChild(w); ringStart();
    var done = function () { endIncoming(); };
    w.querySelector(".ic-yes").addEventListener("click", function (e) { if (c.embed) { e.preventDefault(); done(); callWindow(c.url, c.from); return; } if (!PHONE) { e.preventDefault(); window.open(c.url, "bsp-meet", "width=1180,height=780"); } done(); });
    w.querySelector(".ic-no").addEventListener("click", function () {
      done(); toast("Declined. We let " + first(c.from) + " know.");
      call("sendMessage", { projectId: c.pid, channel: dmKey(c.akey), text: "📵 I can't take the call right now. I'll call you back." }).catch(function () {});
    });
    S.callTimer = setTimeout(function () { if (document.querySelector(".inc-call")) { endIncoming(); toast("Missed call from " + c.from); } }, 60000);
    try { if (document.visibilityState !== "visible" && window.Notification && Notification.permission === "granted") { var n = new Notification("📹 " + c.from + " is calling you", { body: c.project + " · tap to join", tag: "bsp-call-" + c.id, requireInteraction: true }); n.onclick = function () { window.focus(); if (c.embed) callWindow(c.url, c.from); else window.open(c.url, "bsp-meet", "width=1180,height=780"); endIncoming(); n.close(); }; } } catch (e) {}
  }
  if (!API) window.__bspTestCall = function (c) { incomingCall(Object.assign({ id: "t" + Date.now(), ts: Date.now(), pid: S.pid || "p1", project: "Hillside Residence", from: "Nayeli Toto", akey: "x", url: "https://meet.google.com/abc-defg-hij", code: "abc-defg-hij" }, c || {})); };   // preview only
  function endIncoming() { if (RING) RING(); clearTimeout(S.callTimer); var w = document.querySelector(".inc-call"); if (w) w.remove(); }
  /* Admin: Home → Team → Video calls inside the portal (Daily.co). */
  function callCard() {
    if (!S.me || !S.me.admin) return "";
    var on = S.me.calls === "portal";
    return '<div class="card rt-card' + (on ? " on" : "") + '"><div class="qb-h"><span class="rt-mark" aria-hidden="true">📹</span><div><b>Video calls inside the portal (Daily.co)</b><div class="muted small">' +
      (on ? "On: calls open in a window inside the portal, and the person you call gets a ring." : "Off: calls open Google Meet in a new window (Google doesn't allow Meet inside other pages). Paste a Daily.co API key to keep calls inside the portal (free up to 10,000 minutes a month).") + "</div></div></div>" +
      '<form class="form" data-form="callKey"><label class="f">Daily API key<input type="password" name="key" autocomplete="new-password" placeholder="' + (on ? "Saved. Paste a new one to replace it" : "dashboard.daily.co → Developers → API key") + '"></label>' +
      '<div class="actions">' + (on ? '<button type="button" class="btn ghost sm" data-a="callOff">Back to Google Meet</button>' : "") + '<button class="btn sm" type="submit">' + (on ? "Save" : "Turn on") + "</button></div></form></div>";
  }
  root.addEventListener("submit", function (e) {
    var f = e.target; if (!f.matches || !f.matches("form[data-form=callKey]")) return; e.preventDefault(); e.stopImmediatePropagation();
    var btn = f.querySelector("[type=submit]"); btn.disabled = true;
    call("callSave", { key: f.key.value }).then(function () { f.key.value = ""; return call("me"); }).then(function (r) { S.me = Object.assign(S.me, r.me); keepScroll(render); toast("Calls now open inside the portal 📹"); })
      .catch(function (er) { toast(er.message); }).then(function () { btn.disabled = false; });
  }, true);
  root.addEventListener("click", function (e) {
    var b = e.target.closest("[data-a=callOff]"); if (!b) return; e.preventDefault(); e.stopImmediatePropagation();
    call("callSave", { off: true }).then(function () { return call("me"); }).then(function (r) { S.me = Object.assign(S.me, r.me); keepScroll(render); toast("Calls use Google Meet again"); }).catch(function (er) { toast(er.message); });
  }, true);
  /* Admin: Home → Team → Instant chat (Firebase). */
  function rtCard() {
    if (!S.me || !S.me.admin) return "";
    if (!S.rtSt) { S.rtSt = "loading"; call("rtStatus").then(function (r) { S.rtSt = r; }).catch(function () { S.rtSt = { on: false }; }).then(function () { if (!S.pid && S.home === "team") keepScroll(render); }); return ""; }
    if (S.rtSt === "loading") return "";
    var st = S.rtSt;
    return '<div class="card rt-card' + (st.on ? " on" : "") + '"><div class="qb-h"><span class="rt-mark" aria-hidden="true">⚡</span><div><b>Instant chat (Firebase)</b><div class="muted small">' +
      (st.on ? "On: messages and “is typing” arrive in under a second. " + (RT.open ? "This browser is connected." : "Connecting…") : "Off: chat updates every few seconds. Paste your Firebase Realtime Database address and its Database secret to make it instant.") + "</div></div></div>" +
      '<form class="form" data-form="rtKeys"><div class="row2"><label class="f">Database address<input type="url" name="url" placeholder="https://your-project-default-rtdb.firebaseio.com" value="' + esc(st.url || "") + '"></label>' +
      '<label class="f">Database secret<input type="password" name="secret" autocomplete="new-password" placeholder="' + (st.hasSecret ? "Saved. Leave blank to keep it" : "Project settings → Service accounts → Database secrets") + '"></label></div>' +
      '<div class="actions">' + (st.on ? '<button type="button" class="btn ghost sm" data-a="rtOff">Turn off</button>' : "") + '<button class="btn sm" type="submit">' + (st.on ? "Save" : "Turn on") + "</button></div></form></div>";
  }
  root.addEventListener("submit", function (e) {
    var f = e.target; if (!f.matches || !f.matches("form[data-form=rtKeys]")) return; e.preventDefault(); e.stopImmediatePropagation();
    var btn = f.querySelector("[type=submit]"); btn.disabled = true;
    call("rtSave", { url: f.url.value, secret: f.secret.value }).then(function (r) { S.rtSt = r; f.secret.value = ""; return call("me"); })
      .then(function (r) { S.me = Object.assign(S.me, r.me); rtStart(); keepScroll(render); toast("Instant chat is on ⚡"); })
      .catch(function (er) { toast(er.message); }).then(function () { btn.disabled = false; });
  }, true);
  root.addEventListener("click", function (e) {
    var b = e.target.closest("[data-a=rtOff]"); if (!b) return; e.preventDefault(); e.stopImmediatePropagation();
    if (!window.confirm("Turn off instant chat? Chat keeps working, updating every few seconds.")) return;
    call("rtSave", { off: true }).then(function (r) { S.rtSt = r; S.me.rt = null; rtStop(); keepScroll(render); toast("Instant chat is off"); }).catch(function (er) { toast(er.message); });
  }, true);
  /* ======================= Landscape maintenance (office · crew · client) ======================= */
  var LS_ST = { scheduled: ["Scheduled", ""], in_progress: ["In progress", "gold"], blocked: ["Blocked", "bad"], completed: ["Completed", "ok"], canceled: ["Canceled", ""], weather: ["Weather delay", "bad"] };
  var LS_ISS = { new: ["New", "bad"], review: ["Office review", "gold"], included: ["Included", "ok"], correction: ["Correction", "gold"], billable: ["Billable", "gold"], scheduled: ["Scheduled", "ok"], closed: ["Closed", ""] };
  var LS_FREQ_TXT = { weekly: "Weekly", biweekly: "Every 2 weeks", monthly: "Monthly", seasonal: "Seasonal (4×/yr)", none: "No recurring visits" };
  var LS_FEATURES = ["Lawn", "Planting beds", "Trees", "Shrubs", "Irrigation", "Drainage", "Hardscape", "Gutters", "Pool area", "Slopes"];
  var LS_DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  function lsDaysTxt(w, short) { var l = String(w).split(",").filter(function (x) { return /^[0-6]$/.test(x); }).map(Number); if (l.length > 2 && l.every(function (x, i) { return !i || x === l[i - 1] + 1; })) return LS_DAYS[l[0]].slice(0, 3) + "–" + LS_DAYS[l[l.length - 1]].slice(0, 3); return l.map(function (x) { return short || l.length > 1 ? LS_DAYS[x].slice(0, 3) : LS_DAYS[x]; }).join(", "); }
  function lsToday() { var d = new Date(), p = function (x) { return String(x).padStart(2, "0"); }; return d.getFullYear() + "-" + p(d.getMonth() + 1) + "-" + p(d.getDate()); }
  function lsAddD(s, n) { var d = new Date(s + "T12:00:00"); d.setDate(d.getDate() + n); var p = function (x) { return String(x).padStart(2, "0"); }; return d.getFullYear() + "-" + p(d.getMonth() + 1) + "-" + p(d.getDate()); }
  function lsDow(s) { return LS_DAYS[new Date(s + "T12:00:00").getDay()]; }
  function lsPill(st) { var x = LS_ST[st] || [st, ""]; return '<span class="pill ' + x[1] + '">' + esc(x[0]) + "</span>"; }
  function lsIssPill(st) { var x = LS_ISS[st] || [st, ""]; return '<span class="pill ' + x[1] + '">' + esc(x[0]) + "</span>"; }
  function lsHm(min) { min = Math.round(min || 0); return min >= 60 ? Math.floor(min / 60) + " h" + (min % 60 ? " " + (min % 60) + " min" : "") : min + " min"; }
  /* Labor (person-minutes) vs time on site (elapsed): an override on the property, else the work split between the crew. */
  function lsSize(cid) { var c = lsC(cid); return c ? Math.max(1, (c.members || []).length || 1) : 1; }
  function lsSite(v) { var p = lsP(v.property_id), size = lsSize(v.crew_id); if (p.visit_dur && v.kind === "maintenance") return { min: p.visit_dur, src: "set", size: size }; return { min: Math.max(5, Math.ceil((v.est_min || 60) / size)), src: size > 1 ? "split" : "one", size: size, none: !lsC(v.crew_id) }; }
  function lsSiteWhy(src, pm, size, none) { return src === "set" ? "time on site set on the property" : pm + " person-min" + (size > 1 ? " ÷ " + size + " people" : none ? " · no crew yet, 1 person assumed" : " · 1-person crew"); }
  function lsSiteTxt(v, short) { var s = lsSite(v); return lsHm(s.min) + " on site" + (short ? "" : " (" + lsSiteWhy(s.src, v.est_min, s.size, s.none) + ")"); }
  /* One stop order everywhere: saved stop number, then property name, then id (the server sorts the same way). */
  function lsCmp(a, b) { var d = (a.stop || 99) - (b.stop || 99); if (d) return d; var na = lsP(a.property_id).name || "", nb = lsP(b.property_id).name || ""; return na < nb ? -1 : na > nb ? 1 : a.id < b.id ? -1 : 1; }
  function lsCrewHrs(c) {
    var hh = function (x) { var m = String(x || "").trim().toLowerCase().match(/^(\d{1,2})(?::(\d\d))?\s*(am|pm|a|p)?$/); if (!m) return null; var h = +m[1]; if (m[3] && m[3][0] === "p" && h < 12) h += 12; if (m[3] && m[3][0] === "a" && h === 12) h = 0; return h * 60 + (+m[2] || 0); };
    var t = String((c && c.hours) || "").toLowerCase().match(/\d{1,2}(?::\d\d)?\s*(?:am|pm|a|p)?/g) || [], a = hh(t[0]), b = hh(t[1]);
    if (a == null) a = 420; if (b == null) b = a + 510; if (b <= a && !/[ap]/.test(t[1] || "")) b += 720; if (b <= a) b = a + 510; return { start: a, end: b };
  }
  function lsP(id) { return ((S.ls && S.ls.props) || []).filter(function (p) { return p.id === id; })[0] || {}; }
  function lsC(id) { return ((S.ls && S.ls.crews) || []).filter(function (c) { return c.id === id; })[0] || null; }
  function lsV(id) { return ((S.ls && S.ls.visits) || []).filter(function (v) { return v.id === id; })[0] || (S.lsProp && (S.lsProp.visits || []).filter(function (v) { return v.id === id; })[0]) || null; }
  function lsDot(c) { return '<i class="ls-dot" style="background:' + esc((c && c.color) || "#999") + '"></i>'; }
  function lsMissed(v, today) { return v.date < today && ["scheduled", "in_progress"].indexOf(v.status) > -1; }
  function lsNav(p) { var q = p.lat != null ? p.lat + "," + p.lon : [p.address, p.city].filter(Boolean).join(", "); return "https://www.google.com/maps/dir/?api=1&destination=" + encodeURIComponent(q); }
  async function lsLoad(force) {
    if (S.lsBusy) return; S.lsBusy = 1; var f = S.lsF || {}, ck = "ls:" + (f.from || "") + (f.to || ""), gen = S.lsGen;
    if (!S.ls) { var oldl = cacheGet(ck); if (oldl && oldl.role) { S.ls = oldl; if (!S.pid && S.home === "ls") keepScroll(render); } }
    try { var r = await call("lsHome", { from: f.from, to: f.to }); if (gen !== S.lsGen) { S.lsBusy = 0; if (!S.ls && !S.pid && S.home === "ls") keepScroll(render); return; } S.ls = r; if (r && r.role) cacheSet(ck, r); } catch (e) { if (!S.ls || !S.ls.role) S.ls = { err: e.message }; else toast("Couldn't refresh: " + e.message); }
    S.lsBusy = 0; if (!S.pid && S.home === "ls") keepScroll(render);
    if (S.ls && S.ls.role && S.ls.role !== "client") lsWeather();
  }
  /* 7-day rain forecast where the properties are (Open-Meteo, free, no key). Labeled as a forecast. */
  async function lsWeather() {
    if (S.lsWx || S.lsWxBusy) return; S.lsWxBusy = 1;
    var p = ((S.ls && S.ls.props) || []).filter(function (x) { return x.lat != null; })[0], lat = p ? p.lat : 37.56, lon = p ? p.lon : -122.32;
    try { var r = await (await fetch("https://api.open-meteo.com/v1/forecast?latitude=" + lat + "&longitude=" + lon + "&daily=precipitation_probability_max,weather_code&timezone=auto&forecast_days=10")).json();
      S.lsWx = {}; (r.daily.time || []).forEach(function (d, i) { S.lsWx[d] = { rain: r.daily.precipitation_probability_max[i], code: r.daily.weather_code[i] }; });
    } catch (e) { S.lsWx = { _off: true }; }
    S.lsWxBusy = 0; if (!S.pid && S.home === "ls") keepScroll(render);
  }
  function lsWxTag(d) { var w = S.lsWx && S.lsWx[d]; if (!w) return ""; return '<span class="ls-wx' + (w.rain >= 60 ? " wet" : "") + '" title="Forecast (Open-Meteo): ' + w.rain + '% chance of rain">' + (w.rain >= 60 ? "🌧 " : w.rain >= 30 ? "🌦 " : "☀️ ") + w.rain + "%</span>"; }

  function lsView() {
    if (!S.ls) { lsLoad(); return '<div class="loading" style="min-height:30vh">Loading maintenance…</div>'; }
    if (S.ls.err) return '<div class="empty">' + esc(S.ls.err) + ' <button class="link" data-a="lsReload">Try again</button></div>';
    if (!S.ls.role) return '<div class="empty">Nothing here yet.</div>';
    if (S.ls.role === "crew") return lsCrewView();
    if (S.ls.role === "client") return lsClientView();
    var t = S.lsTab || "today", tabs = [["today", "Dashboard"], ["schedule", "Schedule"], ["props", "Properties"], ["requests", "Requests"], ["est", "Estimates"], ["crews", "Crews"]].concat(S.ls.money ? [["costs", "Costs"]] : []);
    var newReq = S.ls.issues.filter(function (i) { return i.status === "new"; }).length;
    var head = '<div class="ls-tabs">' + tabs.map(function (x) { return '<button class="chip' + (t === x[0] ? " on" : "") + '" data-a="lsTab" data-v="' + x[0] + '">' + x[1] + (x[0] === "requests" && newReq ? ' <span class="count">' + newReq + "</span>" : "") + (x[0] === "est" && (S.ls.estimates || []).some(function (e) { return e.status === "revised" || e.status === "draft"; }) ? ' <span class="count">' + (S.ls.estimates || []).filter(function (e) { return e.status === "revised" || e.status === "draft"; }).length + "</span>" : "") + "</button>"; }).join("") +
      '<span class="ls-sp"></span>' + (S.me.admin && !S.ls.props.some(function (p) { return p.sample; }) && !S.ls.props.length ? '<button class="btn ghost sm" data-a="lsSeed">Load sample data</button>' : "") +
      (S.me.admin && S.ls.props.some(function (p) { return p.sample; }) ? '<button class="btn ghost sm" data-a="lsClearSample">Remove sample data</button>' : "") + "</div>" +
      (S.ls.props.some(function (p) { return p.sample; }) ? '<div class="ls-sample">Sample data is loaded (names start with SAMPLE). Remove it before going live.</div>' : "");
    return head + (t === "schedule" ? lsSchedule() : t === "props" ? lsProps() : t === "requests" ? lsRequests() : t === "est" ? lsEstimates() : t === "crews" ? lsCrews() : t === "costs" ? lsCosts() : lsDash());
  }
  /* ---- office dashboard ---- */
  function lsFilters() {
    var f = S.lsF || {}, ranges = [["", "Next 3 weeks"], ["today", "Today"], ["week", "This week"], ["month", "This month"], ["last30", "Last 30 days"]];
    return '<div class="ls-filters"><select data-ls-f="range">' + ranges.map(function (r) { return '<option value="' + r[0] + '"' + ((f.range || "") === r[0] ? " selected" : "") + ">" + r[1] + "</option>"; }).join("") + "</select>" +
      '<select data-ls-f="crew"><option value="">All crews</option>' + S.ls.crews.map(function (c) { return '<option value="' + esc(c.id) + '"' + (f.crew === c.id ? " selected" : "") + ">" + esc(c.name) + "</option>"; }).join("") + "</select>" +
      '<select data-ls-f="prop"><option value="">All properties</option>' + S.ls.props.map(function (p) { return '<option value="' + esc(p.id) + '"' + (f.prop === p.id ? " selected" : "") + ">" + esc(p.name) + "</option>"; }).join("") + "</select>" +
      '<select data-ls-f="kind"><option value="">All work</option><option value="maintenance"' + (f.kind === "maintenance" ? " selected" : "") + '>Recurring maintenance</option><option value="extra"' + (f.kind === "extra" ? " selected" : "") + '>Additional work</option><option value="correction"' + (f.kind === "correction" ? " selected" : "") + ">Corrections</option></select></div>";
  }
  function lsFiltered() {
    var f = S.lsF || {}; return S.ls.visits.filter(function (v) { return (!f.crew || v.crew_id === f.crew) && (!f.prop || v.property_id === f.prop) && (!f.kind || v.kind === f.kind); });
  }
  function lsDash() {
    var today = S.ls.today, vs = lsFiltered(), tv = vs.filter(function (v) { return v.date === today; });
    var done = tv.filter(function (v) { return v.status === "completed"; }).length, prog = tv.filter(function (v) { return v.status === "in_progress"; }).length;
    var attention = vs.filter(function (v) { return lsMissed(v, today) || v.status === "blocked" || v.status === "weather"; });
    var newIss = S.ls.issues.filter(function (i) { return i.status === "new" || i.status === "review"; }), urgent = newIss.filter(function (i) { return i.urgency === "urgent"; }).length;
    var st = S.ls.stats, tot = st && st.total;
    var cards = '<div class="grid g4 ls-kpis">' +
      '<button class="stat ls-kpi" data-a="lsTab" data-v="schedule"><span class="eyebrow">Today</span><b>' + tv.length + ' visits</b><small>' + done + " done · " + prog + " in progress</small></button>" +
      '<button class="stat ls-kpi' + (attention.length ? " warn" : "") + '" data-a="lsJump" data-v="attention"><span class="eyebrow">Needs attention</span><b>' + attention.length + "</b><small>Missed, blocked or weather</small></button>" +
      '<button class="stat ls-kpi' + (urgent ? " warn" : "") + '" data-a="lsTab" data-v="requests"><span class="eyebrow">Client requests</span><b>' + newIss.length + "</b><small>" + (urgent ? urgent + " urgent" : "Waiting for the office") + "</small></button>" +
      (tot ? '<button class="stat ls-kpi" data-a="lsTab" data-v="costs"><span class="eyebrow">Profit · ' + esc(lsRangeTxt()) + '</span><b class="' + (tot.profit < 0 ? "neg" : "") + '">' + m0(tot.profit) + "</b><small>" + m0(tot.revenue) + " revenue · " + m0(tot.labor) + " labor · " + m0(tot.expenses + tot.materials + tot.shared) + " costs</small></button>"
        : '<button class="stat ls-kpi" data-a="lsTab" data-v="est"><span class="eyebrow">Waiting for approval</span><b>' + (S.ls.estimates || []).filter(function (e) { return e.status === "sent"; }).length + "</b><small>Estimates & change orders sent</small></button>") + "</div>";
    var crews = S.ls.crews.map(function (c) {
      var mine = tv.filter(function (v) { return v.crew_id === c.id; }).sort(lsCmp), d = mine.filter(function (v) { return v.status === "completed"; }).length;
      var next = mine.filter(function (v) { return ["scheduled", "in_progress"].indexOf(v.status) > -1; })[0], load = mine.reduce(function (a, v) { return a + lsSite(v).min; }, 0);
      return '<div class="ls-crewrow">' + lsDot(c) + '<div class="lc-name"><b>' + esc(c.name) + '</b><small class="muted">' + c.members.length + (c.members.length === 1 ? " person · " : " people · ") + lsHm(load) + " on site" + (load > lsCrewHrs(c).end - lsCrewHrs(c).start ? ' · <span class="bad-t">overloaded</span>' : "") + "</small></div>" +
        '<div class="lc-bar"><div class="mini"><i style="width:' + (mine.length ? Math.round(d / mine.length * 100) : 0) + '%"></i></div><small class="muted">' + d + " of " + mine.length + " stops" + (next ? " · next: " + esc(lsP(next.property_id).name) : "") + "</small></div>" +
        (mine.length ? '<button class="btn ghost sm" data-a="lsxPlan" data-c="' + esc(c.id) + '" data-d="' + today + '">Plan route</button>' : "") + "</div>";
    }).join("");
    var attn = attention.slice(0, 12).map(lsVisitRow).join("");
    var over = st && st.over && st.over.length ? '<div class="card ls-list">' + st.over.slice(0, 6).map(function (x) { return '<div class="ls-row"><div><b>' + esc(x.name) + '</b><small class="muted">' + x.visits + " visits · " + lsHm(x.labor_min) + " worked vs " + lsHm(x.est_min) + ' planned</small></div><span class="pill bad">+' + x.over + "% over</span></div>"; }).join("") + "</div>" : "";
    return lsFilters() + cards +
      '<div class="section-title"><h2>Crews today</h2><span class="muted small">' + lsDow(today) + " " + day(today) + " " + lsWxTag(today) + "</span></div>" + '<div class="card ls-list">' + (crews || '<p class="muted small">Add a crew to start.</p>') + "</div>" +
      '<div class="section-title" id="ls-attention"><h2>Needs attention</h2><span class="muted small">Missed, blocked and weather-delayed visits</span></div>' + (attn ? '<div class="card ls-list">' + attn + "</div>" : '<div class="empty">Nothing missed. 🌿</div>') +
      '<div class="section-title"><h2>New requests</h2><button class="link small" data-a="lsTab" data-v="requests">All requests →</button></div>' + (newIss.length ? '<div class="card ls-list">' + newIss.slice(0, 6).map(lsIssueRow).join("") + "</div>" : '<div class="empty">No requests waiting.</div>') +
      ((S.ls.estimates || []).some(function (e) { return e.status === "sent" || e.status === "revised"; }) ? '<div class="section-title"><h2>Estimates waiting</h2><button class="link small" data-a="lsTab" data-v="est">All estimates →</button></div><div class="card ls-list">' + S.ls.estimates.filter(function (e) { return e.status === "sent" || e.status === "revised"; }).slice(0, 6).map(lsEstRow).join("") + "</div>" : "") +
      (over ? '<div class="section-title"><h2>Going over the labor budget</h2><span class="muted small">Actual crew time vs the time planned in the agreement</span></div>' + over : "") +
      '<div class="section-title"><h2>Seasonal opportunities</h2></div><div class="card ls-soon"><b>Coming in stage 2</b><p class="muted small">Fertilizing, mulching, pruning before the rains, gutter cleaning and irrigation checks, suggested per property from its agreement, history and crew observations, with the office deciding what goes to the client.</p></div>';
  }
  function lsRangeTxt() { var r = (S.lsF || {}).range || ""; return { "": "next 3 weeks", today: "today", week: "this week", month: "this month", last30: "last 30 days" }[r] || ""; }
  function lsVisitRow(v) {
    var p = lsP(v.property_id), c = lsC(v.crew_id), today = S.ls.today;
    return '<div class="ls-row' + (lsMissed(v, today) ? " missed" : "") + '">' + lsDot(c) + '<div class="ls-main" data-a="lsOpenVisit" data-id="' + esc(v.id) + '"><b>' + (v.stop ? '<span class="ls-stop">' + v.stop + "</span>" : "") + esc(p.name || "Property") + "</b><small class=\"muted\">" +
      esc([lsDow(v.date).slice(0, 3) + " " + day(v.date), c ? c.name : "No crew", lsSiteTxt(v, true), v.kind !== "maintenance" ? (v.kind === "extra" ? "Additional work" : "Correction") : ""].filter(Boolean).join(" · ")) + (v.reason ? " · " + esc(v.reason) : "") + "</small></div>" +
      (lsMissed(v, today) ? '<span class="pill bad">Missed</span>' : lsPill(v.status)) + "</div>";
  }
  function lsIssueRow(i) {
    var p = lsP(i.property_id);
    return '<div class="ls-row"><span class="ls-urg u-' + esc(i.urgency) + '" title="' + esc(i.urgency) + '"></span><div class="ls-main" data-a="lsTriageOpen" data-id="' + esc(i.id) + '"><b>' + esc(p.name || "Property") + '</b><small class="muted">' + esc(i.text.slice(0, 140)) + "</small><small class=\"muted\">" + esc(i.by_name || "") + " · " + day(String(i.at).slice(0, 10)) + (i.photos.length ? " · 📷 " + i.photos.length : "") + "</small></div>" + lsIssPill(i.status) + "</div>";
  }
  /* ---- schedule: list by day / map ---- */
  function lsSchedule() {
    var mode = S.lsMode || "list", vs = lsFiltered().filter(function (v) { return v.status !== "canceled"; }), today = S.ls.today, days = {};
    vs.forEach(function (v) { (days[v.date] = days[v.date] || []).push(v); });
    var keys = Object.keys(days).sort(), mapDay = lsMapDayGet();
    var top = lsFilters() + '<div class="ls-bar"><div class="chips">' + [["list", "List"], ["map", "Map"]].map(function (x) { return '<button class="chip' + (mode === x[0] ? " on" : "") + '" data-a="lsMode" data-v="' + x[0] + '">' + x[1] + "</button>"; }).join("") + "</div>" +
      '<button class="btn sm" data-a="modal" data-m="lsVisit">＋ One-time visit / work order</button></div>';
    if (mode === "map") {
      var dayList = keys.indexOf(mapDay) > -1 ? keys : keys.concat([mapDay]).sort();
      return top + '<div class="ls-bar"><select data-ls-mapday>' + dayList.map(function (d) { return '<option value="' + d + '"' + (d === mapDay ? " selected" : "") + ">" + lsDow(d) + " " + day(d) + " (" + (days[d] || []).length + ")</option>"; }).join("") + "</select>" + lsWxTag(mapDay) + "</div>" +
        '<div class="card ls-mapcard"><div id="ls-map" data-keep="1"></div></div><p class="muted small">Stops in route order for each crew. Drive times are estimates (straight-line distance), not live traffic.</p>';
    }
    if (!keys.length) return top + '<div class="empty">No visits in this range. Add properties with an agreement, or a one-time visit.</div>';
    return top + keys.map(function (d) {
      var list = days[d], byCrew = {}; list.forEach(function (v) { (byCrew[v.crew_id || ""] = byCrew[v.crew_id || ""] || []).push(v); });
      var wx = S.lsWx && S.lsWx[d], wet = wx && wx.rain >= 60;
      return '<div class="ls-day' + (d === today ? " today" : "") + '"><div class="ls-dayh"><b>' + lsDow(d) + " " + day(d) + "</b>" + lsWxTag(d) + '<span class="muted small">' + list.length + " visit" + (list.length === 1 ? "" : "s") + "</span>" + (list.some(function (v) { return !v.crew_id; }) ? '<span class="pill bad" title="Some visits have no crew">Incomplete</span>' : "") +
        (d >= today ? '<button class="btn ghost sm' + (wet ? " warn" : "") + '" data-a="lsRainDay" data-d="' + d + '">' + (wet ? "🌧 " : "") + "Move this day…</button>" : "") + "</div>" +
        Object.keys(byCrew).map(function (cid) {
          var c = lsC(cid), vv = byCrew[cid].sort(lsCmp), load = vv.reduce(function (a, v) { return a + lsSite(v).min; }, 0);
          return '<div class="ls-crewblock"><div class="ls-cbh">' + lsDot(c) + "<b>" + esc(c ? c.name : "No crew assigned") + '</b><small class="muted">' + vv.length + (vv.length === 1 ? " stop · " : " stops · ") + lsHm(load) + " on site" + (c ? "" : " · 1 person assumed") + (load > (c ? lsCrewHrs(c).end - lsCrewHrs(c).start : 510) ? ' · <span class="bad-t">overloaded</span>' : "") + "</small>" +
            (vv.length ? '<button class="link small" data-a="lsxPlan" data-c="' + esc(cid) + '" data-d="' + d + '">Plan route</button>' : "") + "</div>" +
            vv.map(function (v, i) {
              var p = lsP(v.property_id);
              return '<div class="ls-stoprow"><span class="ls-stop">' + (v.stop || i + 1) + '</span><div class="ls-main" data-a="lsOpenVisit" data-id="' + esc(v.id) + '"><b>' + esc(p.name) + '</b><small class="muted">' + esc([p.address, p.city].filter(Boolean).join(", ")) + " · " + lsSiteTxt(v) + (v.travel_min ? " · ~" + v.travel_min + " min drive" : "") + (v.kind !== "maintenance" ? " · " + (v.kind === "extra" ? "Additional work" : "Correction") : "") + "</small></div>" +
                (c && vv.length > 1 ? '<span class="ls-ord"><button title="Earlier" data-a="lsOrd" data-id="' + esc(v.id) + '" data-dir="-1"' + (i ? "" : " disabled") + '>↑</button><button title="Later" data-a="lsOrd" data-id="' + esc(v.id) + '" data-dir="1"' + (i < vv.length - 1 ? "" : " disabled") + ">↓</button></span>" : "") +
                (lsMissed(v, today) ? '<span class="pill bad">Missed</span>' : lsPill(v.status)) + "</div>";
            }).join("") + "</div>";
        }).join("") + "</div>";
    }).join("");
  }
  /* Leaflet map of one day's stops, numbered and joined per crew. */
  var LEAF = null;
  function lsMapInit() {
    var el = document.getElementById("ls-map"); if (!el || !S.ls) return;
    var key = (lsMapDayGet()) + "|" + JSON.stringify(S.lsF || {}) + "|" + S.ls.visits.length; if (el.dataset.k === key && el._map) return;
    var go2 = function () {
      if (el._map) { el._map.remove(); el._map = null; }
      var map = el._map = L.map(el, { scrollWheelZoom: false }); el.dataset.k = key;
      L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", { maxZoom: 19, attribution: "© OpenStreetMap", referrerPolicy: "strict-origin-when-cross-origin", crossOrigin: false }).addTo(map);
      var d = lsMapDayGet(), pts = [], byCrew = {};
      lsFiltered().filter(function (v) { return v.date === d && v.status !== "canceled"; }).forEach(function (v) { (byCrew[v.crew_id] = byCrew[v.crew_id] || []).push(v); });
      Object.keys(byCrew).forEach(function (cid) {
        var c = lsC(cid), col = (c && c.color) || "#555", line = [];
        byCrew[cid].sort(lsCmp).forEach(function (v, i) {
          var p = lsP(v.property_id); if (p.lat == null) return; var ll = [p.lat, p.lon]; pts.push(ll); line.push(ll);
          L.marker(ll, { icon: L.divIcon({ className: "ls-pin", html: '<span style="background:' + col + '">' + (v.stop || i + 1) + "</span>", iconSize: [28, 28], iconAnchor: [14, 14] }) }).addTo(map)
            .bindPopup("<b>" + esc(p.name) + "</b><br>" + esc(c ? c.name : "") + "<br>" + esc((LS_ST[v.status] || [v.status])[0]));
        });
        if (line.length > 1) L.polyline(line, { color: col, weight: 3, opacity: .7, dashArray: "6 6" }).addTo(map);
      });
      if (pts.length) map.fitBounds(pts, { padding: [40, 40], maxZoom: 14 }); else map.setView([37.5, -122.25], 10);
    };
    if (window.L) return go2();
    if (!document.getElementById("leaf-css")) { var l = document.createElement("link"); l.id = "leaf-css"; l.rel = "stylesheet"; l.href = "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.css"; document.head.appendChild(l); }
    var sc = document.createElement("script"); sc.src = "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.js"; sc.onload = go2; document.head.appendChild(sc);
  }
  /* ---- properties ---- */
  function lsProps() {
    var list = S.ls.props.filter(function (p) { return p.status !== "ended" || S.lsShowEnded; });
    var next = function (p) { var v = S.ls.visits.filter(function (x) { return x.property_id === p.id && x.date >= S.ls.today && x.status === "scheduled"; })[0]; return v ? lsDow(v.date).slice(0, 3) + " " + day(v.date) : "—"; };
    return '<div class="ls-bar"><span class="muted small">' + list.length + " properties</span><button class=\"btn sm\" data-a=\"modal\" data-m=\"lsProp\">＋ Property</button></div>" +
      (list.length ? '<div class="ls-pgrid">' + list.map(function (p) {
        var c = lsC(p.crew_id);
        return '<button class="card ls-pcard" data-a="lsOpenProp" data-id="' + esc(p.id) + '"><div class="ls-pch"><b>' + esc(p.name) + "</b>" + (p.status !== "active" ? '<span class="pill">' + esc(p.status) + "</span>" : "") + "</div>" +
          '<small class="muted">' + esc([p.client_name, p.city].filter(Boolean).join(" · ")) + "</small>" +
          '<div class="ls-pcm"><span>' + esc(LS_FREQ_TXT[p.freq] || "") + (p.freq !== "none" && p.weekday !== "" ? " · " + lsDaysTxt(p.weekday, true) : "") + "</span><span>" + lsDot(c) + esc(c ? c.name : "No crew") + "</span></div>" +
          '<div class="ls-pcm"><span>Next: ' + next(p) + "</span>" + (p.price != null ? "<b>" + m0(p.price) + "/" + ({ monthly: "mo", per_visit: "visit", quarterly: "qtr", annual: "yr" }[p.billing] || "mo") + "</b>" : "") + "</div>" +
          (p.features.length ? '<div class="ls-tags">' + p.features.slice(0, 5).map(function (f) { return "<span>" + esc(f) + "</span>"; }).join("") + "</div>" : "") + "</button>";
      }).join("") + "</div>" : '<div class="empty">No properties yet. Add the first one with its maintenance agreement' + (S.me.admin ? ', or load sample data to try it out.' : ".") + "</div>");
  }
  /* ---- requests (issues) ---- */
  function lsRequests() {
    var f = S.lsReqF || "open", list = S.ls.issues.filter(function (i) { return f === "all" || (f === "open" ? ["new", "review"].indexOf(i.status) > -1 : f === "work" ? ["billable", "correction", "included", "scheduled"].indexOf(i.status) > -1 : i.status === "closed"); });
    return '<div class="ls-bar"><div class="chips">' + [["open", "To review"], ["work", "In the works"], ["closed", "Closed"], ["all", "All"]].map(function (x) { return '<button class="chip' + (f === x[0] ? " on" : "") + '" data-a="lsReqF" data-v="' + x[0] + '">' + x[1] + "</button>"; }).join("") + "</div>" +
      '<button class="btn sm" data-a="modal" data-m="lsIssue">＋ Log a request</button></div>' +
      (list.length ? '<div class="card ls-list">' + list.map(lsIssueRow).join("") + "</div>" : '<div class="empty">Nothing here.</div>') +
      '<p class="muted small">Clients report from their portal; crews report what they find at a stop. The office decides: included in the agreement, a correction (our fix, no charge), or billable additional work, and can turn it into a work order.</p>';
  }
  /* ---- crews & rates ---- */
  function lsCrews() {
    var rates = S.ls.rates || [], rateOf = function (e) { var r = rates.filter(function (x) { return x.email === e; })[0]; return r ? r.rate : ""; };
    return '<div class="ls-bar"><span class="muted small">' + S.ls.crews.length + " crews</span><button class=\"btn sm\" data-a=\"modal\" data-m=\"lsCrew\">＋ Crew</button></div>" +
      (S.ls.crews.length ? '<div class="card ls-list">' + S.ls.crews.map(function (c) { return '<div class="ls-row">' + lsDot(c) + '<div class="ls-main" data-a="modal" data-m="lsCrew" data-id="' + esc(c.id) + '"><b>' + esc(c.name) + '</b><small class="muted">' + esc(c.members.map(function (m) { return m.name; }).join(", ") || "No members") + (c.skills ? " · " + esc(c.skills) : "") + (c.hours ? " · " + esc(c.hours) : "") + "</small></div></div>"; }).join("") + "</div>" : '<div class="empty">No crews yet.</div>') +
      (S.me.admin && S.ls.money ? '<div class="section-title"><h2>Labor rates</h2><span class="muted small">Hourly cost per person (wages + burden). Only you see these. Default: $' + S.ls.default_rate + '/h</span></div><form class="card ls-rates" data-form="lsRates">' +
        (S.ls.people || []).filter(function (x) { return x.role !== "admin"; }).map(function (x) { return '<label class="ls-rate"><span>' + esc(x.name) + '</span><span class="ls-money">$<input type="number" step="0.5" min="0" name="r:' + esc(x.email) + '" value="' + esc(rateOf(x.email)) + '" placeholder="' + S.ls.default_rate + '"></span></label>'; }).join("") +
        '<label class="ls-rate"><span><b>Default for everyone else</b></span><span class="ls-money">$<input type="number" step="0.5" min="0" name="default" value="' + S.ls.default_rate + '"></span></label><div class="actions"><button class="btn sm" type="submit">Save rates</button></div></form>' : "");
  }
  /* ---- costs & profitability ---- */
  function lsCosts() {
    var st = S.ls.stats, tot = st.total, pend = (S.ls.expenses || []).filter(function (e) { return e.status === "pending"; });
    var tbl = st.props.length ? '<div class="card tbl" data-lenis-prevent><table class="t"><thead><tr><th>Property</th><th class="num">Visits</th><th class="num">Revenue</th><th class="num">Labor</th><th class="num">Materials + expenses</th><th class="num">Profit</th><th class="num">Crew time vs plan</th></tr></thead><tbody>' +
      st.props.map(function (x) { return "<tr><td>" + esc(x.name) + '</td><td class="num">' + x.visits + '</td><td class="num">' + m0(x.revenue) + '</td><td class="num">' + m0(x.labor) + '</td><td class="num">' + m0(x.materials + x.expenses) + '</td><td class="num"><b class="' + (x.profit < 0 ? "neg" : "") + '">' + m0(x.profit) + "</b>" + (x.margin != null ? ' <small class="muted">' + x.margin + "%</small>" : "") + '</td><td class="num">' + (x.over != null ? (x.over > 15 ? '<span class="pill bad">+' + x.over + "%</span>" : x.over + "%") : "—") + "</td></tr>"; }).join("") + "</tbody></table></div>" : '<div class="empty">No completed visits in this range yet.</div>';
    return lsFilters() + '<div class="grid g4 ls-kpis">' + stat("Revenue", m0(tot.revenue), tot.visits + " completed visits") + stat("Labor", m0(tot.labor), lsHm(tot.labor_min) + " of crew time") + stat("Materials & expenses", m0(tot.materials + tot.expenses + tot.shared), m0(tot.shared) + " shared (not on a property)") + stat("Profit", m0(tot.profit), tot.revenue ? Math.round(tot.profit / tot.revenue * 100) + "% margin" : "") + "</div>" +
      (pend.length ? '<div class="section-title"><h2>Expenses to review</h2><span class="muted small">Logged by crews</span></div><div class="card ls-list">' + pend.map(function (e) { var p = lsP(e.property_id);
        return '<div class="ls-row"><div class="ls-main"><b>' + esc(e.category) + " · " + m0(e.amount) + '</b><small class="muted">' + esc([p.name, e.vendor, e.by, day(e.date)].filter(Boolean).join(" · ")) + (e.note ? " · " + esc(e.note) : "") + "</small></div>" + (e.receipt ? '<a class="btn ghost sm" href="' + esc(e.receipt) + '" target="_blank" rel="noopener">Receipt</a>' : "") +
          '<button class="btn ghost sm" data-a="lsExp" data-id="' + esc(e.id) + '" data-s="rejected">Reject</button><button class="btn sm" data-a="lsExp" data-id="' + esc(e.id) + '" data-s="approved">Approve</button></div>'; }).join("") + "</div>" : "") +
      '<div class="section-title"><h2>By property</h2><span class="muted small">Least profitable first</span></div>' + tbl +
      '<div class="card ls-explain"><b>How this is counted</b><p class="muted small">Recurring revenue: each agreement\'s price is spread evenly over the visits it pays for (e.g. $650/month on a weekly schedule ≈ $150 per visit) and counted when a visit is completed. Additional work counts at its own price. Labor: each person\'s minutes × their hourly rate (a 3-person crew for 2 hours = 6 labor hours). Materials and expenses tied to a visit or property count there once; costs with no property (fuel for the whole fleet, for example) are shown as shared and never added to a property, so nothing is counted twice.</p></div>';
  }

  /* ======================= crew: my route (phone first) ======================= */
  function lsCrewView() {
    var d = S.lsDay || S.ls.today, vs = S.ls.visits.filter(function (v) { return v.date === d && v.status !== "canceled"; }).sort(lsCmp);
    var done = vs.filter(function (v) { return v.status === "completed"; }).length, crew = S.ls.crews.map(function (c) { return c.name; }).join(", ");
    var nav = '<div class="ls-daynav"><button class="btn ghost sm" data-a="lsDay" data-v="-1">‹</button><b>' + (d === S.ls.today ? "Today" : lsDow(d)) + " · " + day(d) + '</b><button class="btn ghost sm" data-a="lsDay" data-v="1">›</button></div>';
    return '<div class="ls-crewhead"><div><div class="eyebrow">' + esc(crew) + "</div><h2>My route</h2></div>" + '<div class="ls-prog"><b>' + done + "/" + vs.length + '</b><small class="muted">stops done</small></div></div>' + nav +
      (vs.length ? vs.map(function (v, i) {
        var p = lsP(v.property_id), cur = !["completed", "canceled"].indexOf(v.status) > -1;
        return '<div class="card ls-stopcard s-' + esc(v.status) + '"><div class="lsc-top"><span class="ls-stop big">' + (v.stop || i + 1) + '</span><div class="ls-main" data-a="lsOpenVisit" data-id="' + esc(v.id) + '"><b>' + esc(p.name) + '</b><small class="muted">' + esc([p.address, p.city].filter(Boolean).join(", ")) + "</small><small class=\"muted\">" + lsSiteTxt(v, true) + (v.kind !== "maintenance" ? " · " + (v.kind === "extra" ? "Additional work" : "Correction") : "") + (v.priority === "high" ? ' · <span class="bad-t">priority</span>' : "") + "</small></div>" + lsPill(v.status) + "</div>" +
          '<div class="lsc-acts"><a class="btn ghost sm" href="' + esc(lsNav(p)) + '" target="_blank" rel="noopener">🧭 Navigate</a><button class="btn sm" data-a="lsOpenVisit" data-id="' + esc(v.id) + '">' + (v.status === "completed" ? "See report" : v.status === "in_progress" ? "Continue" : "Open work order") + "</button></div></div>";
      }).join("") : '<div class="empty">No stops ' + (d === S.ls.today ? "today" : "this day") + ". 🌿</div>");
  }
  /* ======================= client: my property ======================= */
  function lsClientView() {
    var today = S.ls.today;
    return S.ls.props.map(function (p) {
      var up = S.ls.visits.filter(function (v) { return v.property_id === p.id && v.date >= today && v.status !== "completed"; }).sort(function (a, b) { return a.date < b.date ? -1 : 1; });
      var past = S.ls.visits.filter(function (v) { return v.property_id === p.id && v.status === "completed"; }).sort(function (a, b) { return a.date < b.date ? 1 : -1; });
      var reqs = S.ls.issues.filter(function (i) { return i.property_id === p.id; });
      return '<div class="ls-client"><div class="ls-chero card"><div><div class="eyebrow">Your property</div><h2>' + esc(p.name) + '</h2><p class="muted">' + esc([p.address, p.city].filter(Boolean).join(", ")) + "</p>" +
        '<div class="ls-next">' + (up[0] ? "Next visit: <b>" + lsDow(up[0].date) + " " + day(up[0].date) + "</b>" + (up[0].status === "weather" ? " (moved for weather)" : "") : "No visit scheduled yet") + "</div></div>" +
        '<button class="btn" data-a="modal" data-m="lsIssue" data-id="' + esc(p.id) + '">Report an issue</button></div>' +
        (function () { var mine = (S.ls.estimates || []).filter(function (e) { return e.property_id === p.id; }), wait = mine.filter(function (e) { return e.status === "sent"; });
          return (wait.length ? '<div class="section-title"><h2>Waiting for your approval</h2></div>' + wait.map(function (e) { return '<div class="card ls-estwait"><div><div class="eyebrow">' + (e.kind === "change_order" ? "Change order" : "Estimate") + " · version " + e.version + "</div><b>" + esc(e.title) + '</b><small class="muted">' + esc((e.scope || "").slice(0, 140)) + '</small></div><div class="lew-r"><b>' + m0(e.total) + '</b><button class="btn" data-a="lsEstOpen" data-id="' + esc(e.id) + '">Review & approve</button></div></div>'; }).join("") : "") +
            (mine.length > wait.length ? '<div class="section-title"><h2>Estimates</h2></div><div class="card ls-list">' + mine.filter(function (e) { return e.status !== "sent"; }).map(lsEstRow).join("") + "</div>" : ""); })() +
        '<div class="section-title"><h2>Your agreement</h2><span class="muted small">' + esc(LS_FREQ_TXT[p.freq] || "") + (p.price != null ? " · " + m0(p.price) + " " + ({ monthly: "per month", per_visit: "per visit", quarterly: "per quarter", annual: "per year" }[p.billing] || "") : "") + "</span></div>" +
        '<div class="grid g2"><div class="card"><b>Included</b><p class="muted small ls-pre">' + esc(p.included || "—") + '</p></div><div class="card"><b>Not included (priced separately)</b><p class="muted small ls-pre">' + esc(p.excluded || "—") + "</p></div></div>" +
        '<div class="section-title"><h2>Your requests</h2></div>' + (reqs.length ? '<div class="card ls-list">' + reqs.map(function (i) { return '<div class="ls-row"><span class="ls-urg u-' + esc(i.urgency) + '"></span><div class="ls-main"><b>' + esc(i.text.slice(0, 120)) + '</b><small class="muted">' + day(String(i.at).slice(0, 10)) + (i.office_note ? " · Blue Sierra: " + esc(i.office_note) : "") + "</small></div>" + lsIssPill(i.status) + "</div>"; }).join("") + "</div>" : '<div class="empty">No requests. Something wrong? Tap Report an issue.</div>') +
        '<div class="section-title"><h2>Visit reports</h2></div>' + (past.length ? past.slice(0, 8).map(function (v) {
          return '<div class="card ls-report"><div class="ls-row"><div class="ls-main"><b>' + lsDow(v.date) + " " + day(v.date) + "</b><small class=\"muted\">" + esc(v.scope || "Maintenance visit") + "</small></div>" + lsPill("completed") + "</div>" +
            (v.checklist.length ? '<ul class="ls-done">' + v.checklist.filter(function (c) { return c.done; }).map(function (c) { return "<li>✓ " + esc(c.t) + "</li>"; }).join("") + "</ul>" : "") + (v.notes ? '<p class="small">' + esc(v.notes) + "</p>" : "") +
            (v.after.length ? '<div class="ls-photos">' + v.after.map(function (ph) { return '<a href="' + esc(ph.full) + '" target="_blank" rel="noopener"><img src="' + esc(ph.thumb) + '" alt="After" loading="lazy"></a>'; }).join("") + "</div>" : "") + "</div>";
        }).join("") : '<div class="empty">Reports appear here after each visit.</div>') + "</div>";
    }).join("") || '<div class="empty">No property on your account yet.</div>';
  }

  /* ======================= windows (modals) ======================= */
  function lsModal(m) {
    var d = S.ls || {};
    if (m.type === "lsProp") {
      var p = m.id ? lsP(m.id) : { freq: "weekly", billing: "monthly", visit_min: 90, features: [], status: "active", start: lsToday(), weekday: String(new Date().getDay()), checklist: [] };
      var cl = (p.checklist && p.checklist.length ? p.checklist : ["Mow and edge lawn areas", "Blow walks, drive and patios", "Weed planting beds", "Check irrigation (leaks, broken heads)", "Prune as needed", "Remove green waste"]).join("\n");
      return "<h2>" + (m.id ? "Edit property" : "New property") + '</h2><form class="form" data-form="lsProp">' +
        '<label class="f">Property name<input name="name" required value="' + esc(p.name) + '" placeholder="e.g. Oak Knoll Estate"></label>' +
        '<div class="row2"><label class="f">Client<input name="client_name" value="' + esc(p.client_name) + '"></label><label class="f">Client emails (they get portal access to this property)<input name="client_emails" value="' + esc(p.client_emails) + '" placeholder="name@email.com, other@email.com"></label></div>' +
        '<div class="row2"><label class="f">Address<input name="address" value="' + esc(p.address) + '"></label><label class="f">City<input name="city" value="' + esc(p.city) + '"></label></div>' +
        '<div class="row2"><label class="f">On-site contact<input name="contacts" value="' + esc(p.contacts) + '" placeholder="Name · phone"></label><label class="f">Access instructions<input name="access" value="' + esc(p.access) + '" placeholder="Gate code, dog, parking…"></label></div>' +
        '<div class="f"><span>Features</span><div class="ls-checks">' + LS_FEATURES.map(function (f) { return '<label><input type="checkbox" name="features" value="' + f + '"' + (p.features.indexOf(f) > -1 ? " checked" : "") + "> " + f + "</label>"; }).join("") + "</div></div>" +
        '<div class="row2"><label class="f">Access window: from<input type="time" name="window_from" value="' + esc(p.window_from || "") + '"></label><label class="f">to<input type="time" name="window_to" value="' + esc(p.window_to || "") + '"></label></div>' +
        '<div class="row2"><div class="f" role="group" aria-label="Days the client allows">Days the client allows <small class="muted">(none = any day)</small><span class="ls-days">' + LS_DAYS.map(function (n, i) { return '<label class="ls-dayc"><input type="checkbox" name="days_ok" value="' + i + '"' + (String(p.days_ok || "").split(",").indexOf(String(i)) > -1 ? " checked" : "") + "><span>" + n.slice(0, 3) + "</span></label>"; }).join("") + '</span></div><label class="f">Needs on the truck<input name="equipment" value="' + esc(p.equipment || "") + '" placeholder="e.g. trailer, aerator, hedge trimmer"></label></div>' +
        '<label class="f">Service notes (team only)<textarea name="notes">' + esc(p.notes) + "</textarea></label>" +
        "<h3>Maintenance agreement</h3>" +
        '<div class="row2"><label class="f">How often<select name="freq">' + Object.keys(LS_FREQ_TXT).map(function (k) { return '<option value="' + k + '"' + (p.freq === k ? " selected" : "") + ">" + LS_FREQ_TXT[k] + "</option>"; }).join("") + '</select></label><div class="f" role="group" aria-label="Service days">Day(s)<span class="ls-days">' + LS_DAYS.map(function (n, i) { return '<label class="ls-dayc"><input type="checkbox" name="weekday" value="' + i + '"' + (String(p.weekday).split(",").indexOf(String(i)) > -1 ? " checked" : "") + "><span>" + n.slice(0, 3) + "</span></label>"; }).join("") + "</span></div></div>" +
        '<div class="row2"><label class="f">Starts<input type="date" name="start" value="' + esc(p.start) + '"></label><label class="f">Crew<select name="crew_id"><option value="">No crew yet</option>' + (d.crews || []).map(function (c) { return '<option value="' + esc(c.id) + '"' + (p.crew_id === c.id ? " selected" : "") + ">" + esc(c.name) + "</option>"; }).join("") + "</select></label></div>" +
        '<div class="row2"><label class="f">Planned labor per visit (person-minutes)<input type="number" name="visit_min" min="10" step="5" value="' + esc(p.visit_min) + '"><span class="ls-chk"><input type="checkbox" name="labor_ok" value="1"' + (p.labor_ok ? " checked" : "") + '> This labor time is confirmed</span></label>' +
        '<label class="f">Time on site (minutes, optional)<input type="number" name="visit_dur" min="5" step="5" value="' + esc(p.visit_dur || "") + '" placeholder="Split between the crew"><small class="muted">Leave empty to split the labor between the crew (90 person-min with 2 people ≈ 45 min). Set it when the work cannot be split that way.</small></label></div><div class="row2">' +
        (d.money ? '<label class="f">Price<span class="ls-money">$<input type="number" name="price" step="0.01" min="0" value="' + esc(p.price == null ? "" : p.price) + '"></span><select name="billing">' + [["monthly", "per month"], ["per_visit", "per visit"], ["quarterly", "per quarter"], ["annual", "per year"]].map(function (o) { return '<option value="' + o[0] + '"' + (p.billing === o[0] ? " selected" : "") + ">" + o[1] + "</option>"; }).join("") + "</select></label>" : '<span class="muted small" style="align-self:end">Price: only Jesús and #money</span>') + "</div>" +
        '<div class="row2"><label class="f">Included in the agreement<textarea name="included" placeholder="Mowing, edging, blowing, bed weeding…">' + esc(p.included) + '</textarea></label><label class="f">Not included (priced separately)<textarea name="excluded" placeholder="Tree work, plant replacement, hauling…">' + esc(p.excluded) + "</textarea></label></div>" +
        '<label class="f">Visit checklist (one per line)<textarea name="checklist" rows="5">' + esc(cl) + "</textarea></label>" +
        (m.id ? '<label class="f">Status<select name="status">' + [["active", "Active"], ["paused", "Paused (no new visits)"], ["ended", "Ended"]].map(function (o) { return '<option value="' + o[0] + '"' + (p.status === o[0] ? " selected" : "") + ">" + o[1] + "</option>"; }).join("") + "</select></label>" : "") +
        '<p class="muted small">Changing the day, how often, or the crew re-plans future visits nobody has moved or started. Moved and completed visits stay as they are.</p>' +
        '<div class="actions"><button type="button" class="btn ghost" data-a="close">Cancel</button><button class="btn" type="submit">Save</button></div></form>';
    }
    if (m.type === "lsCrew") {
      var c = m.id ? lsC(m.id) : { members: [], color: "#2f6db0" }, mem = (c.members || []).map(function (x) { return x.email; });
      return "<h2>" + (m.id ? "Edit crew" : "New crew") + '</h2><form class="form" data-form="lsCrew"><div class="row2"><label class="f">Name<input name="name" required value="' + esc(c.name) + '" placeholder="e.g. Crew A"></label><label class="f">Color<input type="color" name="color" value="' + esc(c.color || "#2f6db0") + '"></label></div>' +
        '<div class="f"><span>Members (they see this crew\'s route on their phone)</span><div class="ls-checks">' + (d.people || []).filter(function (x) { return x.role !== "admin"; }).map(function (x) { return '<label><input type="checkbox" name="members" value="' + esc(x.email) + '"' + (mem.indexOf(x.email) > -1 ? " checked" : "") + "> " + esc(x.name) + "</label>"; }).join("") + "</div><span class=\"muted small\">Add people as #crew in Home → Team first.</span></div>" +
        '<div class="row2"><label class="f">Equipment on the truck & skills<input name="skills" value="' + esc(c.skills) + '" placeholder="Trailer, mower, aerator, irrigation…"></label><label class="f">Shift (working hours)<input name="hours" value="' + esc(c.hours) + '" placeholder="7:00–15:30"></label></div>' +
        '<label class="f">Vehicle<input name="vehicle" value="' + esc(c.vehicle || "") + '" placeholder="e.g. Truck 2 (F-250) + 12 ft trailer"></label>' +
        '<div class="actions"><button type="button" class="btn ghost" data-a="close">Cancel</button><button class="btn" type="submit">Save</button></div></form>';
    }
    if (m.type === "lsVisit") {
      var v = m.id ? lsV(m.id) : { date: m.date || lsToday(), kind: m.date ? "maintenance" : "extra", est_min: m.prop ? (lsP(m.prop).visit_min || 60) : 60, priority: "normal", property_id: m.prop || "", crew_id: m.crew || "" };
      return "<h2>" + (m.id ? "Edit visit" : "One-time visit / work order") + '</h2><form class="form" data-form="lsVisit">' +
        (m.id ? "" : '<label class="f">Property<select name="property_id" required><option value="">Pick…</option>' + (d.props || []).map(function (p) { return '<option value="' + esc(p.id) + '"' + (v.property_id === p.id ? " selected" : "") + ">" + esc(p.name) + "</option>"; }).join("") + "</select></label>") +
        '<div class="row2"><label class="f">Date<input type="date" name="date" value="' + esc(v.date) + '"></label><label class="f">Crew<select name="crew_id"><option value="">No crew</option>' + (d.crews || []).map(function (c) { return '<option value="' + esc(c.id) + '"' + (v.crew_id === c.id ? " selected" : "") + ">" + esc(c.name) + "</option>"; }).join("") + "</select></label></div>" +
        '<div class="row2"><label class="f">Type<select name="kind">' + [["maintenance", "Recurring maintenance"], ["extra", "Additional work (billable)"], ["correction", "Correction (no charge)"]].map(function (o) { return '<option value="' + o[0] + '"' + (v.kind === o[0] ? " selected" : "") + ">" + o[1] + "</option>"; }).join("") + '</select></label><label class="f">Planned labor (person-minutes)<input type="number" name="est_min" min="5" step="5" value="' + esc(v.est_min) + '"></label></div>' +
        '<label class="f">Scope of work<textarea name="scope">' + esc(v.scope) + "</textarea></label>" +
        (m.id ? '<div class="row2"><label class="f">Status<select name="status">' + Object.keys(LS_ST).map(function (k) { return '<option value="' + k + '"' + (v.status === k ? " selected" : "") + ">" + LS_ST[k][0] + "</option>"; }).join("") + '</select></label><label class="f">Reason (if it can\'t happen)<input name="reason" value="' + esc(v.reason) + '"></label></div>' : "") +
        (d.money ? '<label class="f">Price (additional work)<span class="ls-money">$<input type="number" name="price" step="0.01" min="0" value="' + esc(v.price || "") + '"></span></label>' : "") +
        '<div class="actions"><button type="button" class="btn ghost" data-a="close">Cancel</button><button class="btn" type="submit">Save</button></div></form>';
    }
    if (m.type === "lsWork") return lsWorkOrder(lsV(m.id));
    if (m.type === "lsIssue") {
      var props = d.props || [];
      return "<h2>Report an issue</h2><p class=\"muted\" style=\"margin:4px 0 12px\">A leak, a damaged plant, a branch that looks unsafe, standing water… Blue Sierra reviews it and tells you what happens next.</p>" +
        '<form class="form" data-form="lsIssue">' + (props.length > 1 || !m.id ? '<label class="f">Property<select name="property_id" required>' + props.map(function (p) { return '<option value="' + esc(p.id) + '"' + (m.id === p.id ? " selected" : "") + ">" + esc(p.name) + "</option>"; }).join("") + "</select></label>" : '<input type="hidden" name="property_id" value="' + esc(m.id) + '">') +
        '<input type="hidden" name="visit_id" value="' + esc(m.visit || "") + '">' +
        '<label class="f">What\'s going on?<textarea name="text" required placeholder="e.g. The sprinkler by the front walk is spraying the house"></textarea></label>' +
        '<div class="row2"><label class="f">Where exactly<input name="place" placeholder="Front walk, back corner…"></label><label class="f">How urgent<select name="urgency"><option value="low">Whenever you\'re next here</option><option value="normal" selected>Soon</option><option value="urgent">Urgent (water, safety)</option></select></label></div>' +
        '<label class="f">Photos (up to 5)<input type="file" name="photos" accept="image/*" multiple' + (PHONE ? ' capture="environment"' : "") + "></label>" +
        '<div class="actions"><button type="button" class="btn ghost" data-a="close">Cancel</button><button class="btn" type="submit">Send to Blue Sierra</button></div></form>';
    }
    if (m.type === "lsTriage") {
      var i = (d.issues || []).filter(function (x) { return x.id === m.id; })[0] || {}, pp = lsP(i.property_id);
      return "<h2>" + esc(pp.name || "Request") + '</h2><p class="muted small">' + esc(i.by_name) + " · " + day(String(i.at).slice(0, 10)) + " · " + esc(i.urgency) + (i.place ? " · " + esc(i.place) : "") + "</p><p>" + esc(i.text) + "</p>" +
        (i.photos && i.photos.length ? '<div class="ls-photos">' + i.photos.map(function (ph) { return '<a href="' + esc(ph.full) + '" target="_blank" rel="noopener"><img src="' + esc(ph.thumb) + '" alt=""></a>'; }).join("") + "</div>" : "") +
        '<div class="ls-agree"><div><b>Included</b><p class="muted small ls-pre">' + esc(pp.included || "—") + '</p></div><div><b>Not included</b><p class="muted small ls-pre">' + esc(pp.excluded || "—") + "</p></div></div>" +
        '<form class="form" data-form="lsTriage"><div class="f"><span>What is it?</span><div class="ls-radio">' + [["included", "Included in the agreement"], ["correction", "Correction (our fix, no charge)"], ["billable", "Billable additional work"], ["review", "Still reviewing"], ["closed", "Close (nothing to do)"]].map(function (o) { return '<label><input type="radio" name="status" value="' + o[0] + '"' + ((i.status === o[0]) || (i.status === "new" && o[0] === "review") ? " checked" : "") + "> " + o[1] + "</label>"; }).join("") + "</div></div>" +
        '<label class="f">Note for the client<textarea name="office_note" placeholder="What we\'ll do and when">' + esc(i.office_note) + "</textarea></label>" +
        '<details class="ls-mk"' + (i.visit_id ? "" : " open") + "><summary>" + (i.visit_id ? "Work order already created" : "Create a work order") + '</summary><label class="check-line"><input type="checkbox" name="make_visit"' + (i.visit_id ? "" : " checked") + '> Schedule it</label><div class="row2"><label class="f">Date<input type="date" name="date" value="' + lsAddD(lsToday(), 2) + '"></label><label class="f">Crew<select name="crew_id">' + (d.crews || []).map(function (c) { return '<option value="' + esc(c.id) + '"' + (pp.crew_id === c.id ? " selected" : "") + ">" + esc(c.name) + "</option>"; }).join("") + "</select></label></div>" +
        (d.money ? '<label class="f">Price if billable<span class="ls-money">$<input type="number" name="price" step="0.01" min="0"></span></label>' : "") + "</details>" +
        '<div class="actions">' + (d.money ? '<button type="button" class="btn ghost" data-a="modal" data-m="lsEst" data-prop="' + esc(i.property_id) + '" data-issue="' + esc(i.id) + '" style="margin-right:auto">Write an estimate instead</button>' : "") + '<button type="button" class="btn ghost" data-a="close">Cancel</button><button class="btn" type="submit">Save</button></div></form>';
    }
    if (m.type === "lsPropView") return lsPropView();
    if (m.type === "lsEst") return lsEstEditor(m);
    if (m.type === "lsEstView") return lsEstView(m);
    return "";
  }
  function lsPropView() {
    var x = S.lsProp; if (!x) return '<div class="loading">Loading…</div>'; var p = x.prop, c = lsC(p.crew_id), office = S.ls && S.ls.role === "office";
    return '<div class="ls-pv"><div class="ls-pvh"><div><div class="eyebrow">' + esc(p.client_name || "Property") + "</div><h2>" + esc(p.name) + '</h2><p class="muted small">' + esc([p.address, p.city].filter(Boolean).join(", ")) + (p.lat != null ? ' · <a href="' + esc(lsNav(p)) + '" target="_blank" rel="noopener">Directions</a>' : "") + "</p></div>" +
      (office ? '<div class="actions"><button class="btn ghost sm" data-a="modal" data-m="lsProp" data-id="' + esc(p.id) + '">Edit</button><button class="btn sm" data-a="lsNewWO" data-id="' + esc(p.id) + '">＋ Work order</button></div>' : "") + "</div>" +
      '<div class="grid g3"><div class="card"><span class="eyebrow">Agreement</span><b>' + esc(LS_FREQ_TXT[p.freq] || "") + (p.weekday !== "" && p.freq !== "none" ? " · " + lsDaysTxt(p.weekday) : "") + "</b><small class=\"muted\">" + (p.price != null ? m0(p.price) + " " + ({ monthly: "per month", per_visit: "per visit", quarterly: "per quarter", annual: "per year" }[p.billing] || "") + " · " : "") + lsHm(p.visit_min) + " planned per visit</small></div>" +
      '<div class="card"><span class="eyebrow">Crew</span><b>' + lsDot(c) + esc(c ? c.name : "No crew") + '</b><small class="muted">' + esc(p.access || "No access notes") + "</small></div>" +
      '<div class="card"><span class="eyebrow">Features</span><div class="ls-tags">' + (p.features.map(function (f) { return "<span>" + esc(f) + "</span>"; }).join("") || '<small class="muted">—</small>') + "</div></div></div>" +
      '<div class="ls-agree"><div><b>Included</b><p class="muted small ls-pre">' + esc(p.included || "—") + '</p></div><div><b>Not included (priced separately)</b><p class="muted small ls-pre">' + esc(p.excluded || "—") + "</p></div></div>" +
      (p.notes ? '<p class="small"><b>Service notes:</b> ' + esc(p.notes) + "</p>" : "") +
      '<h3>Visits</h3><div class="ls-list">' + (x.visits.length ? x.visits.slice(0, 20).map(lsVisitRow).join("") : '<p class="muted small">No visits yet.</p>') + "</div>" +
      '<h3>Requests</h3><div class="ls-list">' + (x.issues.length ? x.issues.map(lsIssueRow).join("") : '<p class="muted small">None.</p>') + "</div>" +
      '<h3>Estimates & change orders' + (office && S.ls.money ? ' <button class="link small" data-a="modal" data-m="lsEst" data-prop="' + esc(p.id) + '">＋ New</button>' : "") + '</h3><div class="ls-list">' + (((S.ls && S.ls.estimates) || []).filter(function (e) { return e.property_id === p.id; }).map(lsEstRow).join("") || '<p class="muted small">None.</p>') + "</div>" +
      (x.log.length ? '<details class="inv-hist"><summary>History · ' + x.log.length + "</summary>" + x.log.map(function (l) { return '<div class="ih-row"><b>' + esc(l.by) + "</b> " + esc(l.text) + '<small class="muted">' + esc(l.at) + "</small></div>"; }).join("") + "</details>" : "") +
      '<div class="actions"><button type="button" class="btn ghost" data-a="close">Close</button></div></div>';
  }
  /* The work order: what the crew sees at the stop (and the office, with prices). */
  function lsWorkOrder(v) {
    if (!v) return '<p class="muted">This visit isn\'t here anymore.</p><div class="actions"><button class="btn ghost" data-a="close">Close</button></div>';
    var p = lsP(v.property_id), role = S.ls.role, c = lsC(v.crew_id), done = v.status === "completed", closed = done || v.status === "canceled";
    var members = (c && c.members) || [], lab = {}; (v.labor || []).forEach(function (l) { lab[l.email || l.name] = l.min; });
    var guess = v.started_at ? Math.max(5, Math.round((Date.now() - new Date(String(v.started_at).replace(" ", "T")).getTime()) / 60000)) : "";
    return '<div class="ls-wo"><div class="ls-woh"><div><div class="eyebrow">' + lsDow(v.date) + " " + day(v.date) + (v.stop ? " · stop " + v.stop : "") + "</div><h2>" + esc(p.name) + '</h2><p class="muted small">' + esc([p.address, p.city].filter(Boolean).join(", ")) + "</p></div>" + lsPill(v.status) + "</div>" +
      '<div class="ls-woacts"><a class="btn ghost sm" href="' + esc(lsNav(p)) + '" target="_blank" rel="noopener">🧭 Navigate</a>' + (role === "office" && !done ? '<button class="btn ghost sm" data-a="modal" data-m="lsVisit" data-id="' + esc(v.id) + '">Edit / move</button>' : "") + (!closed ? (v.status !== "in_progress" ? '<button class="btn sm" data-a="lsAct" data-act="start" data-id="' + esc(v.id) + '">▶ Start</button>' : "") : "") + "</div>" +
      (p.access ? '<div class="ls-note"><b>Access:</b> ' + esc(p.access) + "</div>" : "") + (p.contacts ? '<div class="ls-note"><b>Contact:</b> ' + esc(p.contacts) + "</div>" : "") + (p.notes && role !== "client" ? '<div class="ls-note"><b>Notes:</b> ' + esc(p.notes) + "</div>" : "") +
      '<h3>Scope</h3><p class="small">' + esc(v.scope || "") + "</p>" + (v.kind === "maintenance" ? '<p class="muted small">Included: ' + esc(p.included || "see agreement") + (p.excluded ? " · <b>Not included:</b> " + esc(p.excluded) : "") + "</p>" : "") +
      (v.checklist.length ? '<h3>Checklist</h3><div class="ls-cl">' + v.checklist.map(function (cl, i) { return '<label class="ls-cli' + (cl.done ? " on" : "") + '"><input type="checkbox" data-ls-check="' + i + '" data-id="' + esc(v.id) + '"' + (cl.done ? " checked" : "") + (closed ? " disabled" : "") + "><span>" + esc(cl.t) + "</span></label>"; }).join("") + "</div>" : "") +
      '<h3>Photos</h3><div class="ls-ph2"><div><b class="small">Before</b><div class="ls-photos">' + v.before.map(function (ph) { return '<a href="' + esc(ph.full) + '" target="_blank" rel="noopener"><img src="' + esc(ph.thumb) + '" alt=""></a>'; }).join("") + "</div>" + (!closed ? '<label class="btn ghost sm">＋ Before<input type="file" accept="image/*" multiple capture="environment" hidden data-ls-photo="before" data-id="' + esc(v.id) + '"></label>' : "") + "</div>" +
      '<div><b class="small">After</b><div class="ls-photos">' + v.after.map(function (ph) { return '<a href="' + esc(ph.full) + '" target="_blank" rel="noopener"><img src="' + esc(ph.thumb) + '" alt=""></a>'; }).join("") + "</div>" + (!closed ? '<label class="btn ghost sm">＋ After<input type="file" accept="image/*" multiple capture="environment" hidden data-ls-photo="after" data-id="' + esc(v.id) + '"></label>' : "") + "</div></div>" +
      '<h3>Materials used</h3><div class="ls-mats">' + (v.materials || []).map(function (mt, i) { return '<div class="ls-mat"><span>' + esc(mt.item) + (mt.qty ? " · " + esc(mt.qty) : "") + (mt.cost ? " · " + money(mt.cost) : "") + "</span>" + (!closed ? '<button class="link small" data-a="lsMatDel" data-id="' + esc(v.id) + '" data-i="' + i + '">Remove</button>' : "") + "</div>"; }).join("") +
        (!closed ? '<form class="ls-matf" data-form="lsMat" data-id="' + esc(v.id) + '"><input name="item" placeholder="e.g. Mulch" required><input name="qty" placeholder="Qty" size="6">' + (S.ls.money ? '<input name="cost" type="number" step="0.01" placeholder="$" size="6">' : "") + '<button class="btn ghost sm" type="submit">Add</button></form>' : "") + "</div>" +
      (role !== "client" ? '<h3>Crew time</h3><form class="ls-labor" data-form="lsLabor" data-id="' + esc(v.id) + '">' + (members.length ? members.map(function (mb) { var key = mb.email || mb.name; return '<label class="ls-rate"><span>' + esc(mb.name) + '</span><span class="ls-money"><input type="number" min="0" step="5" name="' + esc(key) + '" value="' + esc(lab[key] != null ? lab[key] : guess) + '"' + (closed && role !== "office" ? " disabled" : "") + "> min</span></label>"; }).join("") : '<p class="muted small">No crew on this visit.</p>') +
        '<p class="muted small">Minutes each person worked here (a 3-person crew for 2 hours = 120 each).' + (v.started_at && !done ? " Filled in from when you pressed Start." : "") + "</p></form>" : "") +
      '<h3>Notes & problems found</h3><textarea class="ls-ta" data-ls-notes data-id="' + esc(v.id) + '" placeholder="What you did, anything the office should know"' + (closed && role !== "office" ? " disabled" : "") + ">" + esc(v.notes || "") + "</textarea>" +
      '<textarea class="ls-ta" data-ls-problems placeholder="Problems found / extra work to recommend (leaks, damaged plants, unsafe branches, gutters, drainage…)"' + (closed ? " disabled" : "") + ">" + esc(v.problems || "") + "</textarea>" +
      '<div class="ls-woacts"><button class="btn ghost sm" data-a="modal" data-m="lsIssue" data-id="' + esc(p.id) + '" data-visit="' + esc(v.id) + '">⚠ Report a problem to the office</button>' + (role !== "client" ? '<button class="btn ghost sm" data-a="lsExpOpen" data-id="' + esc(v.id) + '">🧾 Add expense / receipt</button>' : "") + "</div>" +
      (v.reason ? '<div class="ls-note bad">Reason: ' + esc(v.reason) + "</div>" : "") +
      (!closed ? '<div class="ls-finish"><button class="btn ghost" data-a="lsCannot" data-id="' + esc(v.id) + '">Can\'t complete…</button><button class="btn" data-a="lsComplete" data-id="' + esc(v.id) + '">✓ Complete visit</button></div>' : '<div class="actions"><button class="btn ghost" data-a="close">Close</button></div>') + "</div>";
  }
  /* ---- Maintenance: actions ---- */
  function lsRefresh() { return lsLoad(true).then(function () { if (S.modal && S.modal.type === "lsWork") keepScroll(render); }); }
  function lsApplyVisit(v) { if (!v || !S.ls) return; S.ls.visits = S.ls.visits.map(function (x) { return x.id === v.id ? v : x; }); if (!S.ls.visits.some(function (x) { return x.id === v.id; })) S.ls.visits.push(v); keepScroll(render); }
  function lsRangeDates(r) {
    var t = lsToday(), d = new Date(t + "T12:00:00");
    if (r === "today") return [t, t];
    if (r === "week") { var s = lsAddD(t, -((d.getDay() + 6) % 7)); return [s, lsAddD(s, 6)]; }
    if (r === "month") { var p = function (x) { return String(x).padStart(2, "0"); }; var a = d.getFullYear() + "-" + p(d.getMonth() + 1) + "-01", e = new Date(d.getFullYear(), d.getMonth() + 1, 0); return [a, e.getFullYear() + "-" + p(e.getMonth() + 1) + "-" + p(e.getDate())]; }
    if (r === "last30") return [lsAddD(t, -30), t];
    return [lsAddD(t, -7), lsAddD(t, 21)];
  }
  async function lsFiles(input, max) { var out = []; var fl = [].slice.call(input && input.files || [], 0, max || 5); for (var i = 0; i < fl.length; i++) out.push(await readFile(fl[i])); return out; }
  root.addEventListener("click", function (e) {
    var b = e.target.closest("[data-a]"); if (!b) return; var a = b.dataset.a; if (!/^ls/.test(a) || /^lsEst|^lsx/.test(a)) return;
    e.preventDefault(); e.stopImmediatePropagation();
    if (a === "lsTab") { S.lsTab = b.dataset.v; S.home = "ls"; if (S.pid) return go(null); return keepScroll(render); }
    if (a === "lsReload") { S.ls = null; return keepScroll(render); }
    if (a === "lsMode") { S.lsMode = b.dataset.v; return keepScroll(render); }
    if (a === "lsReqF") { S.lsReqF = b.dataset.v; return keepScroll(render); }
    if (a === "lsJump") { var el = document.getElementById("ls-" + b.dataset.v); if (el) el.scrollIntoView({ behavior: "smooth", block: "start" }); return; }
    if (a === "lsDay") { S.lsDay = lsAddD(S.lsDay || S.ls.today, Number(b.dataset.v)); var dd = S.lsDay; if (dd < S.ls.from || dd > S.ls.to) { S.lsF = Object.assign({}, S.lsF || {}, { from: lsAddD(dd, -3), to: lsAddD(dd, 10) }); S.ls = null; } return keepScroll(render); }
    if (a === "lsOpenVisit") { S.modal = { type: "lsWork", id: b.dataset.id }; return keepScroll(render); }
    if (a === "lsOpenProp") { S.lsProp = null; S.modal = { type: "lsPropView", id: b.dataset.id }; keepScroll(render); call("lsProperty", { id: b.dataset.id }).then(function (r) { S.lsProp = r; keepScroll(render); }).catch(function (er) { toast(er.message); S.modal = null; keepScroll(render); }); return; }
    if (a === "lsNewWO") { S.modal = { type: "lsVisit", prop: b.dataset.id }; return keepScroll(render); }
    if (a === "lsTriageOpen") { if (S.ls.role !== "office") return; S.modal = { type: "lsTriage", id: b.dataset.id }; return keepScroll(render); }
    if (a === "lsSeed") return run(b, async function () { await call("lsSeed"); S.ls = null; keepScroll(render); toast("Sample data loaded (names start with SAMPLE)"); });
    if (a === "lsClearSample") { sure("Remove all the SAMPLE properties, crews, visits and requests?", function () { call("lsClearSample").then(function () { S.ls = null; keepScroll(render); toast("Sample data removed"); }).catch(function (er) { toast(er.message); }); }); return; }
    if (a === "lsRoute") return run(b, async function () { var r = await call("lsRoute", { date: b.dataset.d, crew_id: b.dataset.c }); await lsLoad(true); toast(r.stops + " stops ordered · ~" + r.drive_min + " min driving" + (r.real ? " (Google)" : " (estimate)") + (r.missing ? " · " + r.missing + " without a map location" : "")); });
    if (a === "lsOrd") {
      var v = lsV(b.dataset.id); if (!v) return; var list = S.ls.visits.filter(function (x) { return x.date === v.date && x.crew_id === v.crew_id && x.status !== "canceled"; }).sort(function (x, y) { return (x.stop || 99) - (y.stop || 99); });
      var i = list.indexOf(v), j = i + Number(b.dataset.dir); if (j < 0 || j >= list.length) return; var t = list[i]; list[i] = list[j]; list[j] = t;
      list.forEach(function (x, k) { x.stop = k + 1; }); keepScroll(render);
      call("lsRoute", { date: v.date, crew_id: v.crew_id, order: list.map(function (x) { return x.id; }) }).catch(function (er) { toast(er.message); }); return;
    }
    if (a === "lsRainDay") {
      var day0 = b.dataset.d, ids = S.ls.visits.filter(function (x) { return x.date === day0 && ["scheduled", "weather"].indexOf(x.status) > -1; }).map(function (x) { return x.id; });
      if (!ids.length) return toast("Nothing to move that day.");
      var to = window.prompt("Move " + ids.length + " visit" + (ids.length > 1 ? "s" : "") + " from " + day0 + " to which date? (YYYY-MM-DD)", lsAddD(day0, 1)); if (!to) return;
      var tell = window.confirm("Email the clients that their visit moved?");
      return run(b, async function () { var r = await call("lsMoveVisits", { ids: ids, to: to, reason: "weather", notify: tell }); await lsLoad(true); toast(r.moved + " visits moved" + (r.told ? " · " + r.told + " clients told" : "")); });
    }
    if (a === "lsAct") return run(b, async function () { var r = await call("lsVisitUpdate", { id: b.dataset.id, act: b.dataset.act }); lsApplyVisit(r.visit); });
    if (a === "lsMatDel") return run(b, async function () { var r = await call("lsVisitUpdate", { id: b.dataset.id, act: "material", remove: Number(b.dataset.i) }); lsApplyVisit(r.visit); });
    if (a === "lsComplete") {
      var f = root.querySelector("form[data-form=lsLabor]"), lab = f ? [].map.call(f.querySelectorAll("input[type=number]"), function (x) { return { email: x.name, min: Number(x.value) || 0 }; }).filter(function (l) { return l.min > 0; }) : [];
      var notes = (root.querySelector("[data-ls-notes]") || {}).value, problems = (root.querySelector("[data-ls-problems]") || {}).value, vid = b.dataset.id;
      return run(b, async function () {
        var r = await call("lsVisitUpdate", { id: vid, act: "complete", labor: lab, notes: notes, problems: problems });
        if (problems && problems.trim()) await call("lsReportIssue", { property_id: r.visit.property_id, visit_id: vid, text: "Found at the visit: " + problems.trim(), urgency: "normal" }).catch(function () {});
        S.modal = null; lsApplyVisit(r.visit); toast("Visit completed ✓" + (problems && problems.trim() ? " · problems sent to the office" : ""));
      });
    }
    if (a === "lsCannot") {
      var why = window.prompt("Why can't this visit be completed? (gate locked, rain, client asked to skip…)"); if (!why) return;
      var st = /rain|weather|storm|lluvia/i.test(why) ? "weather" : /cancel/i.test(why) ? "canceled" : "blocked";
      return run(b, async function () { var r = await call("lsVisitUpdate", { id: b.dataset.id, act: "cannot", reason: why, status: st }); S.modal = null; lsApplyVisit(r.visit); toast("Marked " + (LS_ST[st] || [st])[0].toLowerCase() + ". The office sees it."); });
    }
    if (a === "lsExp") return run(b, async function () { await call("lsReviewExpense", { id: b.dataset.id, status: b.dataset.s }); await lsLoad(true); toast(b.dataset.s === "approved" ? "Approved" : "Rejected"); });
    if (a === "lsExpOpen") {
      var amt = window.prompt("Expense amount ($)"); if (!amt) return; var cat = window.prompt("Category: materials, fertilizer, hauling, disposal, fuel, equipment, subcontractor or other", "materials") || "other";
      var vendor = window.prompt("Where? (vendor)", "") || "", inp = document.createElement("input"); inp.type = "file"; inp.accept = "image/*,application/pdf";
      var send = async function (rec) { await call("lsSaveExpense", { visit_id: b.dataset.id, amount: amt, category: cat.trim().toLowerCase(), vendor: vendor, receipt: rec }); toast(S.ls.money ? "Expense saved" : "Expense sent to the office for review"); };
      if (window.confirm("Add a photo of the receipt?")) { inp.onchange = function () { lsFiles(inp, 1).then(function (fs) { return send(fs[0] || null); }).catch(function (er) { toast(er.message); }); }; inp.click(); }
      else send(null).catch(function (er) { toast(er.message); });
      return;
    }
  }, true);
  root.addEventListener("change", function (e) {
    var t = e.target;
    if (t.matches("[data-ls-f]")) { S.lsF = Object.assign({}, S.lsF || {}); S.lsF[t.dataset.lsF] = t.value; if (t.dataset.lsF === "range") { var r = lsRangeDates(t.value); S.lsF.from = r[0]; S.lsF.to = r[1]; S.ls = null; } keepScroll(render); return; }
    if (t.matches("[data-ls-mapday]")) { S.lsMapDay = t.value; keepScroll(render); return; }
    if (t.matches("[data-ls-check]")) { var vid = t.dataset.id, i = Number(t.dataset.lsCheck); t.closest(".ls-cli").classList.toggle("on", t.checked); call("lsVisitUpdate", { id: vid, act: "check", i: i, done: t.checked }).then(function (r) { var v = lsV(vid); if (v) v.checklist = r.visit.checklist; }).catch(function (er) { toast(er.message); t.checked = !t.checked; }); return; }
    if (t.matches("[data-ls-photo]")) { var id = t.dataset.id, which = t.dataset.lsPhoto; toast("Uploading photos…"); lsFiles(t, 6).then(function (fs) { return call("lsVisitUpdate", { id: id, act: "photo", which: which, files: fs }); }).then(function (r) { lsApplyVisit(r.visit); toast("Photos added"); }).catch(function (er) { toast(er.message); }); return; }
    if (t.matches("[data-ls-notes]")) { call("lsVisitUpdate", { id: t.dataset.id, act: "notes", notes: t.value }).catch(function (er) { toast(er.message); }); return; }
    if (t.matches("form[data-form=lsLabor] input")) { var f = t.form, lab = [].map.call(f.querySelectorAll("input[type=number]"), function (x) { return { email: x.name, min: Number(x.value) || 0 }; }); call("lsVisitUpdate", { id: f.dataset.id, act: "labor", labor: lab }).then(function (r) { var v = lsV(f.dataset.id); if (v) { v.labor = r.visit.labor; v.labor_min = r.visit.labor_min; } }).catch(function (er) { toast(er.message); }); return; }
  });
  root.addEventListener("submit", function (e) {
    var f = e.target; if (!f.matches || !f.matches("form[data-form^=ls]") || f.matches("form[data-form=lsEst], form[data-form=lsDecide], form[data-form^=lsx]")) return; e.preventDefault(); e.stopImmediatePropagation();
    var kind = f.dataset.form, fd = new FormData(f), v = function (k) { return String(fd.get(k) == null ? "" : fd.get(k)).trim(); }, btn = f.querySelector("[type=submit]");
    run(btn, async function () {
      if (kind === "lsProp") {
        var prop = { id: S.modal.id || undefined, name: v("name"), client_name: v("client_name"), client_emails: v("client_emails"), address: v("address"), city: v("city"), contacts: v("contacts"), access: v("access"), notes: v("notes"),
          features: fd.getAll("features"), freq: v("freq"), weekday: fd.getAll("weekday").join(","), start: v("start"), crew_id: v("crew_id"), visit_min: v("visit_min"), visit_dur: v("visit_dur"), labor_ok: !!fd.get("labor_ok"), window_from: v("window_from"), window_to: v("window_to"), days_ok: fd.getAll("days_ok").join(","), equipment: v("equipment"), included: v("included"), excluded: v("excluded"), checklist: v("checklist").split("\n").map(function (x) { return x.trim(); }).filter(Boolean) };
        if (fd.has("price")) { prop.price = v("price") || 0; prop.billing = v("billing"); } if (fd.has("status")) prop.status = v("status");
        var old = S.modal.id ? lsP(S.modal.id) : {};
        if (prop.address && (prop.address !== old.address || prop.city !== old.city || old.lat == null)) try {
          var g = await (await fetch("https://nominatim.openstreetmap.org/search?format=json&limit=1&countrycodes=us&q=" + encodeURIComponent([prop.address, prop.city, "CA"].filter(Boolean).join(", ")))).json();
          if (g && g[0]) { prop.lat = +(+g[0].lat).toFixed(6); prop.lon = +(+g[0].lon).toFixed(6); }
        } catch (er) {}
        await call("lsSaveProperty", { prop: prop }); S.modal = null; await lsLoad(true); toast(prop.id ? "Property saved" : "Property added · visits scheduled"); return;
      }
      if (kind === "lsCrew") { await call("lsSaveCrew", { crew: { id: S.modal.id || undefined, name: v("name"), color: v("color"), members: fd.getAll("members"), skills: v("skills"), hours: v("hours"), vehicle: v("vehicle") } }); S.modal = null; await lsLoad(true); toast("Crew saved"); return; }
      if (kind === "lsVisit") {
        var vis = { id: S.modal.id || undefined, property_id: v("property_id") || undefined, date: v("date"), crew_id: v("crew_id"), kind: v("kind"), est_min: v("est_min"), scope: v("scope") };
        if (fd.has("status")) { vis.status = v("status"); vis.reason = v("reason"); } if (fd.has("price") && v("price")) vis.price = v("price");
        await call("lsSaveVisit", { visit: vis }); S.modal = null; await lsLoad(true); toast("Saved"); return;
      }
      if (kind === "lsIssue") {
        var photos = await lsFiles(f.querySelector("[name=photos]"), 5);
        await call("lsReportIssue", { property_id: v("property_id"), visit_id: v("visit_id"), text: v("text"), place: v("place"), urgency: v("urgency"), photos: photos });
        S.modal = null; await lsLoad(true); toast("Sent. Blue Sierra will review it and let you know."); return;
      }
      if (kind === "lsTriage") {
        var body = { id: S.modal.id, status: fd.get("status"), office_note: v("office_note") }, tri = (S.ls.issues || []).filter(function (x) { return x.id === S.modal.id; })[0] || {};
        if (fd.has("owner")) { body.owner = v("owner"); body.next_action = v("next_action"); body.next_date = v("next_date"); }
        if (fd.get("make_visit")) { body.make_visit = true; body.date = v("date"); body.crew_id = v("crew_id"); if (v("price")) body.price = v("price"); }
        await call("lsTriage", body); S.modal = null; await lsLoad(true); toast(body.make_visit ? "Work order scheduled" : "Saved");
        if (fd.get("notify")) { var pn = lsP(tri.property_id); S.modal = { type: "lsxNotify", prop: tri.property_id, subject: "About your request · " + (pn.name || ""), text: "Hi,\n\nThanks for letting us know about: " + String(tri.text || "").slice(0, 200) + "\n\n" + (v("office_note") || "") + (body.make_visit ? "\n\nWe scheduled it for " + lsDow(body.date) + " " + day(body.date) + "." : "") + "\n\nBlue Sierra" }; keepScroll(render); }
        return;
      }
      if (kind === "lsMat") { var r = await call("lsVisitUpdate", { id: f.dataset.id, act: "material", item: v("item"), qty: v("qty"), cost: v("cost") }); lsApplyVisit(r.visit); return; }
      if (kind === "lsRates") {
        var jobs = []; fd.forEach(function (val, k) { if (k.indexOf("r:") === 0 && String(val).trim() !== "") jobs.push(call("lsSetRate", { email: k.slice(2), rate: val })); });
        if (v("default")) jobs.push(call("lsSetRate", { default: true, rate: v("default") }));
        await Promise.all(jobs); await lsLoad(true); toast("Rates saved"); return;
      }
    });
  }, true);
  /* ---------------- Estimates & change orders ---------------- */
  var LS_EST = { draft: ["Draft", ""], sent: ["Waiting for client", "gold"], approved: ["Approved", "ok"], scheduled: ["Approved · work order", "ok"], declined: ["Declined", "bad"], withdrawn: ["Withdrawn", ""], revised: ["Changed · needs re-approval", "bad"] };
  function lsEstPill(st) { var x = LS_EST[st] || [st, ""]; return '<span class="pill ' + x[1] + '">' + esc(x[0]) + "</span>"; }
  function lsE(id) { return ((S.ls && S.ls.estimates) || []).filter(function (e) { return e.id === id; })[0] || null; }
  function lsEstRow(e) {
    var p = lsP(e.property_id);
    return '<div class="ls-row"><div class="ls-main" data-a="lsEstOpen" data-id="' + esc(e.id) + '"><b>' + (e.kind === "change_order" ? "Change order · " : "") + esc(e.title || "Estimate") + '</b><small class="muted">' + esc([p.name, e.version ? "v" + e.version : "not sent", e.sent_at ? "sent " + day(String(e.sent_at).slice(0, 10)) : ""].filter(Boolean).join(" · ")) + "</small></div>" +
      (e.total != null ? "<b>" + m0(e.total) + "</b>" : "") + lsEstPill(e.status) + "</div>";
  }
  function lsEstimates() {
    var f = S.lsEstF || "open", all = S.ls.estimates || [], list = all.filter(function (e) { return f === "all" || (f === "open" ? ["draft", "sent", "revised"].indexOf(e.status) > -1 : f === "won" ? ["approved", "scheduled"].indexOf(e.status) > -1 : ["declined", "withdrawn"].indexOf(e.status) > -1); });
    var waiting = all.filter(function (e) { return e.status === "sent"; }), won = all.filter(function (e) { return ["approved", "scheduled"].indexOf(e.status) > -1; });
    var sum = function (l) { return l.reduce(function (a, e) { return a + (e.total || 0); }, 0); };
    return (S.ls.money ? '<div class="grid g3 ls-kpis">' + stat("Waiting for clients", m0(sum(waiting)), waiting.length + " estimate" + (waiting.length === 1 ? "" : "s")) + stat("Approved", m0(sum(won)), won.length + " → work orders") + stat("Win rate", (function () { var dec = all.filter(function (e) { return e.status === "declined"; }).length; return won.length + dec ? Math.round(won.length / (won.length + dec) * 100) + "%" : "—"; })(), "approved vs declined") + "</div>" : "") +
      '<div class="ls-bar"><div class="chips">' + [["open", "In progress"], ["won", "Approved"], ["lost", "Declined / withdrawn"], ["all", "All"]].map(function (x) { return '<button class="chip' + (f === x[0] ? " on" : "") + '" data-a="lsEstF" data-v="' + x[0] + '">' + x[1] + "</button>"; }).join("") + "</div>" +
      (S.ls.money ? '<button class="btn sm" data-a="modal" data-m="lsEst">＋ Estimate / change order</button>' : '<span class="muted small">Only Jesús and #money write estimates</span>') + "</div>" +
      (list.length ? '<div class="card ls-list">' + list.map(lsEstRow).join("") + "</div>" : '<div class="empty">Nothing here.</div>') +
      '<p class="muted small">Each send freezes a numbered version. The client approves exactly that version with their name; changing it afterwards needs a new approval, and its work order waits until then.</p>';
  }
  function lsEstEditor(m) {
    var e = m.id ? lsE(m.id) : null, p0 = m.prop ? lsP(m.prop) : {}, iss = m.issue ? ((S.ls.issues || []).filter(function (i) { return i.id === m.issue; })[0] || {}) : {};
    var x = e || { kind: "estimate", title: iss.text ? iss.text.slice(0, 80) : "", scope: iss.text || "", exclusions: p0.excluded || "", impact: "", proposed_date: lsAddD(lsToday(), 7), lines: [{ desc: "", qty: 1, unit: "", price: "" }], property_id: m.prop || "" };
    var rows = (x.lines && x.lines.length ? x.lines : [{ desc: "", qty: 1, unit: "", price: "" }]).concat([{ desc: "", qty: 1, unit: "", price: "" }]);
    var row = function (l) { return '<div class="es-line"><input name="ldesc" placeholder="Description" value="' + esc(l.desc) + '"><input name="lqty" type="number" min="0" step="0.5" value="' + esc(l.qty) + '"><input name="lunit" placeholder="unit" value="' + esc(l.unit) + '"><span class="ls-money">$<input name="lprice" type="number" min="0" step="0.01" value="' + esc(l.price) + '"></span><b class="es-amt">' + (l.price ? money((+l.qty || 0) * (+l.price || 0)) : "") + "</b></div>"; };
    return "<h2>" + (e ? "Edit " : "New ") + (x.kind === "change_order" ? "change order" : "estimate") + "</h2>" +
      (e && ["approved", "scheduled"].indexOf(e.status) > -1 ? '<div class="ls-note bad">The client approved version ' + e.approved_v + '. Saving a change makes a new version they must approve again, and its work order goes on hold until they do.</div>' : "") +
      '<form class="form" data-form="lsEst" data-issue="' + esc(m.issue || (e && e.issue_id) || "") + '">' +
      '<div class="row2"><label class="f">Property<select name="property_id" required' + (e ? " disabled" : "") + '><option value="">Pick…</option>' + S.ls.props.map(function (p) { return '<option value="' + esc(p.id) + '"' + (x.property_id === p.id ? " selected" : "") + ">" + esc(p.name) + "</option>"; }).join("") + "</select></label>" +
      '<label class="f">Type<select name="kind"><option value="estimate"' + (x.kind !== "change_order" ? " selected" : "") + '>Estimate (new work)</option><option value="change_order"' + (x.kind === "change_order" ? " selected" : "") + ">Change order (changes agreed work)</option></select></label></div>" +
      '<label class="f">Title<input type="text" name="title" required value="' + esc(x.title) + '" placeholder="e.g. Replace 3 shrubs and mulch the front beds"></label>' +
      '<label class="f">Scope of work<textarea name="scope" required rows="4">' + esc(x.scope) + "</textarea></label>" +
      '<div class="f"><span>Price, line by line</span><div class="es-lines"><div class="es-line es-h"><span>Description</span><span>Qty</span><span>Unit</span><span>Price</span><span>Amount</span></div>' + rows.map(row).join("") + '</div><button type="button" class="link small" data-a="lsEstRow">＋ Add a line</button><div class="es-total">Total <b data-es-total>' + money(rows.reduce(function (a, l) { return a + (+l.qty || 0) * (+l.price || 0); }, 0)) + "</b></div></div>" +
      '<div class="row2"><label class="f">Not included<textarea name="exclusions" rows="2">' + esc(x.exclusions) + '</textarea></label><label class="f">Schedule impact<textarea name="impact" rows="2" placeholder="e.g. Adds about 3 hours to the next visit">' + esc(x.impact) + "</textarea></label></div>" +
      '<label class="f">Proposed date<input type="date" name="proposed_date" value="' + esc(x.proposed_date) + '"></label>' +
      '<div class="actions"><button type="button" class="btn ghost" data-a="close">Cancel</button><button class="btn ghost" type="submit" name="go" value="save">Save draft</button><button class="btn" type="submit" name="go" value="send">Save & send to client</button></div></form>';
  }
  function lsEstView(m) {
    var e = lsE(m.id); if (!e) return '<p class="muted">Not found.</p><div class="actions"><button class="btn ghost" data-a="close">Close</button></div>';
    var p = lsP(e.property_id), client = S.ls.role === "client", log = (S.lsEstLog && S.lsEstLog.id === e.id) ? S.lsEstLog.log : [];
    var lines = '<div class="es-view"><div class="es-line es-h"><span>Description</span><span>Qty</span><span>Unit</span>' + (e.total != null ? "<span>Price</span><span>Amount</span>" : "") + "</div>" + (e.lines || []).map(function (l) { return '<div class="es-line"><span>' + esc(l.desc) + "</span><span>" + esc(l.qty) + "</span><span>" + esc(l.unit || "") + "</span>" + (e.total != null ? "<span>" + money(l.price) + "</span><b>" + money(l.amount) + "</b>" : "") + "</div>"; }).join("") + (e.total != null ? '<div class="es-total">Total <b>' + money(e.total) + "</b></div>" : "") + "</div>";
    var body = '<div class="es-head"><div><div class="eyebrow">' + (e.kind === "change_order" ? "Change order" : "Estimate") + " · " + esc(p.name || "") + (e.version ? " · version " + e.version : "") + "</div><h2>" + esc(e.title || "") + "</h2></div>" + lsEstPill(e.status) + "</div>" +
      '<h3>Scope of work</h3><p class="ls-pre">' + esc(e.scope || "") + "</p>" + lines +
      '<div class="ls-agree"><div><b>Not included</b><p class="muted small ls-pre">' + esc(e.exclusions || "—") + '</p></div><div><b>Schedule</b><p class="muted small ls-pre">' + esc(e.impact || "No change") + (e.proposed_date ? "\nProposed date: " + day(e.proposed_date) : "") + "</p></div></div>";
    if (e.approved_v) body += '<div class="ls-note">✅ Approved by <b>' + esc(e.approved_name) + "</b> · version " + e.approved_v + (e.approved_at ? " · " + esc(e.approved_at) : "") + (e.approved_hash && !client ? ' · fingerprint <code>' + esc(e.approved_hash) + "</code>" : "") + "</div>";
    if (e.status === "declined") body += '<div class="ls-note bad">Declined' + (e.declined_reason ? ": " + esc(e.declined_reason) : "") + "</div>";
    if (client && e.status === "sent") {
      body += '<form class="form es-sign" data-form="lsDecide" data-id="' + esc(e.id) + '" data-v="' + e.version + '"><h3>Approve this ' + (e.kind === "change_order" ? "change order" : "estimate") + '</h3><label class="f">Your full name<input name="name" required autocomplete="name"></label>' +
        '<label class="check-line"><input type="checkbox" name="agree" required> I approve version ' + e.version + " (" + m0(e.total) + '), its scope and what\'s not included.</label>' +
        '<div class="actions"><button type="button" class="btn ghost" data-a="lsDecline" data-id="' + esc(e.id) + '" data-v="' + e.version + '">Decline</button><button class="btn" type="submit">✓ Approve</button></div></form>';
    } else if (!client) {
      body += '<div class="ls-woacts">' + (S.ls.money && e.status !== "withdrawn" ? '<button class="btn ghost sm" data-a="modal" data-m="lsEst" data-id="' + esc(e.id) + '">Edit</button>' : "") +
        (S.ls.money && ["draft", "revised"].indexOf(e.status) > -1 ? '<button class="btn sm" data-a="lsEstSend" data-id="' + esc(e.id) + '">Send to client</button>' : "") +
        (S.ls.money && e.status === "sent" ? '<button class="btn ghost sm" data-a="lsEstPhone" data-id="' + esc(e.id) + '" data-v="' + e.version + '">Record approval given by phone</button>' : "") +
        (S.ls.money && ["draft", "sent", "revised", "declined"].indexOf(e.status) > -1 ? '<button class="btn ghost sm" data-a="lsEstWithdraw" data-id="' + esc(e.id) + '">Withdraw</button>' : "") +
        (e.visit_id ? '<button class="btn ghost sm" data-a="lsOpenVisit" data-id="' + esc(e.visit_id) + '">Open the work order</button>' : "") + "</div>" +
        ((e.history || []).length ? '<details class="inv-hist"><summary>Versions sent · ' + e.history.length + "</summary>" + e.history.map(function (h) { return '<div class="ih-row"><b>v' + h.v + "</b> " + esc(h.by) + (h.total != null ? " · " + money(h.total) : "") + ' · <code>' + esc(h.hash) + '</code><small class="muted">' + esc(h.at) + "</small></div>"; }).join("") + "</details>" : "") +
        (log.length ? '<details class="inv-hist"><summary>History · ' + log.length + "</summary>" + log.map(function (l) { return '<div class="ih-row"><b>' + esc(l.by) + "</b> " + esc(l.text) + '<small class="muted">' + esc(l.at) + "</small></div>"; }).join("") + "</details>" : "");
    }
    return '<div class="es-doc">' + body + '<div class="actions"><button type="button" class="btn ghost" data-a="close">Close</button></div></div>';
  }
  function lsEstFormData(f) {
    var d = [].map.call(f.querySelectorAll(".es-line:not(.es-h)"), function (r) { return { desc: (r.querySelector("[name=ldesc]") || {}).value || "", qty: (r.querySelector("[name=lqty]") || {}).value || 1, unit: (r.querySelector("[name=lunit]") || {}).value || "", price: (r.querySelector("[name=lprice]") || {}).value || 0 }; });
    return d.filter(function (l) { return l.desc.trim(); });
  }
  root.addEventListener("input", function (e) {
    var f = e.target.closest && e.target.closest("form[data-form=lsEst]"); if (!f || !e.target.closest(".es-line")) return;
    var tot = 0; f.querySelectorAll(".es-line:not(.es-h)").forEach(function (r) { var q = +(r.querySelector("[name=lqty]") || {}).value || 0, pr = +(r.querySelector("[name=lprice]") || {}).value || 0; tot += q * pr; var a = r.querySelector(".es-amt"); if (a) a.textContent = pr ? money(q * pr) : ""; });
    var t = f.querySelector("[data-es-total]"); if (t) t.textContent = money(tot);
  });
  root.addEventListener("click", function (e) {
    var b = e.target.closest("[data-a]"); if (!b) return; var a = b.dataset.a; if (!/^lsEst|^lsDecline/.test(a)) return;
    e.preventDefault(); e.stopImmediatePropagation();
    if (a === "lsEstF") { S.lsEstF = b.dataset.v; return keepScroll(render); }
    if (a === "lsEstOpen") { S.modal = { type: "lsEstView", id: b.dataset.id }; S.lsEstLog = null; keepScroll(render); if (S.ls.role === "office") call("lsEstimate", { id: b.dataset.id }).then(function (r) { S.lsEstLog = { id: b.dataset.id, log: r.log }; keepScroll(render); }).catch(function () {}); return; }
    if (a === "lsEstRow") { var box = b.parentNode.querySelector(".es-lines"), rr = box.querySelector(".es-line:not(.es-h)"); var n = rr.cloneNode(true); n.querySelectorAll("input").forEach(function (i) { i.value = i.name === "lqty" ? "1" : ""; }); n.querySelector(".es-amt").textContent = ""; box.appendChild(n); n.querySelector("input").focus(); return; }
    if (a === "lsEstSend") return run(b, async function () { var r = await call("lsSendEstimate", { id: b.dataset.id }); await lsLoad(true); toast("Sent as version " + r.version + ". The client got an email."); });
    if (a === "lsEstWithdraw") { sure("Withdraw this estimate? The client won't be able to approve it.", function () { call("lsWithdraw", { id: b.dataset.id }).then(function () { S.modal = null; return lsLoad(true); }).then(function () { toast("Withdrawn"); }).catch(function (er) { toast(er.message); }); }); return; }
    if (a === "lsEstPhone") { var nm = window.prompt("Who approved it, by phone or in person? (their full name)"); if (!nm) return; return run(b, async function () { await call("lsDecide", { id: b.dataset.id, version: Number(b.dataset.v), decision: "approve", name: nm, agree: true }); S.modal = null; await lsLoad(true); toast("Approval recorded · work order created"); }); }
    if (a === "lsDecline") { var why = window.prompt("Tell Blue Sierra why (optional): too expensive, not now, want changes…", ""); if (why === null) return; return run(b, async function () { await call("lsDecide", { id: b.dataset.id, version: Number(b.dataset.v), decision: "decline", reason: why }); S.modal = null; await lsLoad(true); toast("Declined. Blue Sierra will follow up."); }); }
  }, true);
  root.addEventListener("submit", function (e) {
    var f = e.target; if (!f.matches || !f.matches("form[data-form=lsEst], form[data-form=lsDecide]")) return; e.preventDefault(); e.stopImmediatePropagation();
    var fd = new FormData(f), v = function (k) { return String(fd.get(k) == null ? "" : fd.get(k)).trim(); }, go2 = (e.submitter && e.submitter.value) || "save", btn = e.submitter || f.querySelector("[type=submit]");
    run(btn, async function () {
      if (f.dataset.form === "lsDecide") {
        await call("lsDecide", { id: f.dataset.id, version: Number(f.dataset.v), decision: "approve", name: v("name"), agree: !!fd.get("agree") });
        S.modal = null; await lsLoad(true); toast("Approved ✓ Blue Sierra will schedule the work."); return;
      }
      var id = S.modal.id || undefined, est = lsE(id) || {};
      var r = await call("lsSaveEstimate", { estimate: { opp_id: f.dataset.opp || undefined, id: id, property_id: v("property_id") || est.property_id, issue_id: f.dataset.issue, kind: v("kind"), title: v("title"), scope: v("scope"), exclusions: v("exclusions"), impact: v("impact"), proposed_date: v("proposed_date"), lines: lsEstFormData(f) } });
      if (go2 === "send") { var s2 = await call("lsSendEstimate", { id: r.id }); toast("Sent as version " + s2.version + ". The client got an email."); } else toast(r.status === "revised" ? "Saved. Send it so the client approves the new version." : "Draft saved");
      S.modal = null; await lsLoad(true);
    });
  }, true);
  /* ======================= routes with Google drive times, every pin, better days, pricing check ======================= */
  S.lsRoutes = {}; S.lsAll = true;
  var _lsLoad0 = lsLoad;
  lsLoad = function (force) { if (force) { S.lsRoutes = {}; S.lsSug = null; S.lsPrice = null; } return _lsLoad0.apply(this, arguments); };
  function lsV(id) { return ((S.ls && S.ls.visits) || []).filter(function (v) { return v.id === id; })[0]; }
  function lsHasPin(p) { return p && p.lat != null && p.lat !== "" && p.lon != null && p.lon !== ""; }
  function lsNoPin() { return ((S.ls && S.ls.props) || []).filter(function (p) { return p.status !== "ended" && !lsHasPin(p); }); }
  function lsLazy(flag, busy, action, body, done) {
    if (S[busy]) return; S[busy] = 1;
    call(action, body || {}).then(function (r) { S[flag] = r; }).catch(function (e) { S[flag] = { err: e.message }; }).then(function () { S[busy] = 0; if (done) done(); keepScroll(render); });
  }
  /* Google's encoded polyline → [[lat, lon]] (the real road line between stops). */
  function lsDecode(str) {
    var i = 0, lat = 0, lng = 0, out = [];
    while (i < str.length) {
      var b, sh = 0, res = 0; do { b = str.charCodeAt(i++) - 63; res |= (b & 31) << sh; sh += 5; } while (b >= 32); lat += res & 1 ? ~(res >> 1) : res >> 1;
      sh = 0; res = 0; do { b = str.charCodeAt(i++) - 63; res |= (b & 31) << sh; sh += 5; } while (b >= 32); lng += res & 1 ? ~(res >> 1) : res >> 1;
      out.push([lat / 1e5, lng / 1e5]);
    }
    return out;
  }
  function lsDayIds(d) { return lsFiltered().filter(function (v) { return v.date === d && v.status !== "canceled"; }).sort(lsCmp).map(function (v) { return v.id; }); }
  function lsRouteKey(d) { return d + "|" + lsDayIds(d).join(","); }
  function lsRoutesFor(d) {
    var ids = lsDayIds(d), k = d + "|" + ids.join(","); if (S.lsRoutes[k]) return S.lsRoutes[k];
    if (!ids.length) return (S.lsRoutes[k] = { date: d, crews: [] });
    if (S.lsRoutesBusy !== k) { S.lsRoutesBusy = k; call("lsDayRoutes", { date: d, ids: ids }).then(function (r) { S.lsRoutes[k] = r; }).catch(function (e) { S.lsRoutes[k] = { err: e.message, crews: [] }; }).then(function () { S.lsRoutesBusy = null; keepScroll(render); }); }
    return null;
  }
  /* The map's day: the one picked, else today if it has visits, else the next day that does. Select, map and routes all read this. */
  function lsMapDayGet() {
    if (S.lsMapDay) return S.lsMapDay; var t = S.ls.today, ds = lsFiltered().filter(function (v) { return v.status !== "canceled" && v.date >= t; }).map(function (v) { return v.date; }).sort();
    S.lsMapDay = ds.indexOf(t) > -1 || !ds.length ? t : ds[0]; return S.lsMapDay;
  }
  function lsPinNote() {
    var r = S.lsPinRes, miss = lsNoPin();
    var res = r ? '<div class="card ls-pinres"><div><b>Map pins</b>' +
      (r.found.length ? '<p class="small">✓ Found ' + r.found.length + ": " + esc(r.found.map(function (x) { return x.name; }).join(", ")) + "</p>" : "") +
      (r.check.length ? '<p class="small">⚠️ Placed, please check (Google only found the street or area): ' + r.check.map(function (x) { return "<b>" + esc(x.name) + "</b> → " + esc(x.address); }).join("; ") + "</p>" : "") +
      (r.none.length ? '<p class="small">✗ Not found, add the street address: ' + r.none.map(function (n) { var p = S.ls.props.filter(function (q) { return q.name === n; })[0]; return p ? '<button class="link small" data-a="modal" data-m="lsProp" data-id="' + esc(p.id) + '">' + esc(n) + "</button>" : esc(n); }).join(", ") + "</p>" : "") +
      '</div><button class="link small" data-a="lsxPinHide">Close</button></div>' : "";
    return res + (miss.length && !r ? '<div class="ls-pinbar">📍 ' + miss.length + " " + (miss.length === 1 ? "property has" : "properties have") + ' no map pin: ' + esc(miss.slice(0, 6).map(function (p) { return p.name; }).join(", ")) + (miss.length > 6 ? "…" : "") + ' <button class="btn sm" data-a="lsxPins">Find them with Google</button></div>' : "");
  }
  function lsYardRow() {
    var y = S.ls.yard, admin = S.me && S.me.role === "admin";
    if (S.lsYardEdit && admin) return '<form class="ls-yard" data-form="lsxYard">🏠 <input type="text" name="yard" required placeholder="Yard / office address, city" value="' + esc(y ? y.address : "") + '"><button class="btn sm" type="submit">Save</button><button type="button" class="btn ghost sm" data-a="lsxYardEdit">Cancel</button></form>';
    return '<div class="ls-yard">🏠 <span>' + (y ? "Day starts and ends at <b>" + esc(y.address) + "</b>" : "No yard set yet: routes start at the first stop.") + "</span>" + (admin ? '<button class="link small" data-a="lsxYardEdit">' + (y ? "Change" : "Set where the day starts") + "</button>" : "") + "</div>";
  }
  function lsRouteCard(g) {
    var c = lsC(g.crew_id), col = (c && c.color) || "#5b6b7a", hrs = g.hours || { start: 420, end: 930 }, span = hrs.end - hrs.start, over = g.day_min > span, pct = Math.min(100, Math.round(g.day_min / span * 100)), y = S.ls.yard;
    var list = (y ? '<div class="ls-rstop yard"><span class="ls-stop">🏠</span><div class="ls-main"><b>Yard</b></div></div>' : "") + g.stops.map(function (s, i) {
      var v = lsV(s.visit_id) || {}, p = lsP(v.property_id) || {};
      var leg = s.drive_min == null ? "" : (i || y) ? '<div class="ls-leg">↓ ' + lsHm(s.drive_min) + (s.km ? " · " + s.km + " km" : "") + "</div>" : "";
      return leg + '<div class="ls-rstop"><span class="ls-stop" style="background:' + col + '">' + (i + 1) + '</span><div class="ls-main" data-a="lsOpenVisit" data-id="' + esc(s.visit_id) + '"><b>' + esc(p.name || "Visit") + '</b><small class="muted">' + esc([p.address, p.city].filter(Boolean).join(", ")) + " · " + lsHm(s.site_min) + " on site <span class=\"muted\">(" + esc(lsSiteWhy(s.site_src, s.person_min, g.size, g.no_crew)) + ")</span>" + (s.why ? ' · <span class="bad-t">' + esc(s.why) + "</span>" : "") + "</small></div></div>";
    }).join("") + (y && g.back_min ? '<div class="ls-leg">↓ ' + lsHm(g.back_min) + ' back</div><div class="ls-rstop yard"><span class="ls-stop">🏠</span><div class="ls-main"><b>Yard</b></div></div>' : "");
    return '<div class="card ls-rcard"><div class="ls-rch">' + lsDot(c) + "<b>" + esc(c ? c.name : "No crew assigned") + '</b><span class="pill' + (g.real ? " ok" : "") + '">' + (g.real ? "Google drive times" : "Estimated") + "</span></div>" +
      '<div class="ls-rstats"><div><span class="eyebrow">Driving</span><b>' + lsHm(g.drive_min) + "</b></div><div><span class=\"eyebrow\">On site</span><b>" + lsHm(g.site_min) + "</b><small>" + (g.no_crew ? "no crew: 1 person assumed" : g.size + (g.size === 1 ? " person" : " people")) + "</small></div>" +
      (g.revenue != null ? '<div><span class="eyebrow">Revenue</span><b>' + m0(g.revenue) + "</b>" + (g.day_min ? "<small>" + m0(g.revenue / (g.day_min / 60)) + "/h of the day</small>" : "") + "</div>" : "") + "</div>" +
      '<div class="ls-daybar' + (over ? " over" : "") + '"><span style="width:' + pct + '%"></span></div><small class="muted">' + lsHm(g.day_min) + " of the crew's " + lsHm(span) + " shift" + (over ? ' · <b class="bad-t">over by ' + lsHm(g.day_min - span) + "</b>" : g.day_min < span - 90 ? " · room for " + lsHm(span - g.day_min) + " more" : "") + "</small>" +
      '<div class="ls-rlist">' + list + "</div>" +
      '<div class="ls-racts">' + (g.maps ? '<a class="btn sm" href="' + esc(g.maps) + '" target="_blank" rel="noopener">Open in Google Maps</a>' : "") +
      (!g.kept && g.stops.length > 1 ? '<button class="btn sm" data-a="lsxSave" data-c="' + esc(g.crew_id) + '" data-d="' + esc(lsMapDayGet()) + '" data-o="' + esc(g.stops.map(function (s) { return s.visit_id; }).join(",")) + '">Use this order</button><button class="link small" data-a="lsxKeep">Keep the current order</button>' : g.kept && g.stops.length > 1 ? '<button class="link small" data-a="lsxReopt" data-d="' + esc(lsMapDayGet()) + '">Suggest a better order</button>' : "") + "</div>" +
      (!g.kept ? '<small class="muted">Suggested order, not saved yet. The list, the crew\'s phone and navigation keep the current order until you use it.</small>' : "") +
      (g.missing ? '<small class="bad-t">' + g.missing + (g.missing === 1 ? " stop has an incomplete address and isn't" : " stops have incomplete addresses and aren't") + " in the drive times. Fix the address to route it.</small>" : "") + "</div>";
  }
  function lsRoutePanel() {
    var d = lsMapDayGet(), r = lsRoutesFor(d);
    var nxt = !r || r.crews.length ? null : lsFiltered().filter(function (v) { return v.status !== "canceled" && v.date > d; }).map(function (v) { return v.date; }).sort()[0];
    var cards = !r ? '<div class="card ls-rload">Asking Google for drive times…</div>' : r.err ? '<div class="card">' + esc(r.err) + "</div>" : !r.crews.length ? '<div class="empty">No visits on ' + lsDow(d) + " " + day(d) + (nxt ? '. <button class="link" data-a="lsxDay" data-v="' + nxt + '">Next day with visits: ' + lsDow(nxt) + " " + day(nxt) + " →</button>" : ".") + "</div>" : r.crews.map(lsRouteCard).join("");
    return lsYardRow() + lsPinNote() + '<div class="ls-routegrid"><div class="card ls-mapcard"><div class="ls-mapbar"><label class="ls-tog"><input type="checkbox" data-lsx-all' + (S.lsAll ? " checked" : "") + "> Show all " + S.ls.props.filter(lsHasPin).length + ' properties</label><span class="muted small">Numbers = this day\'s stops in order</span></div><div id="ls-map" data-keep="1"></div></div><div class="ls-routes">' + cards + "</div></div>";
  }
  function lsSugCard() {
    if (!S.ls || S.ls.role !== "office" || S.lsSugHide) return "";
    if (!S.lsSug) { lsLazy("lsSug", "lsSugBusy", "lsSuggestDays"); return ""; }
    var r = S.lsSug; if (r.err || !r.moves || !r.moves.length) return "";
    return '<div class="card ls-sug"><div class="ls-sugh"><div><span class="eyebrow">Save driving</span><b>About ' + lsHm(r.save_min_week) + " less driving a week</b><small class=\"muted\">Move these to a day the crew is already nearby. Estimated for a typical week" + (r.yard ? "" : "; set where the day starts for better suggestions") + '.</small></div><button class="link small" data-a="lsxSugHide">Hide</button></div>' +
      r.moves.map(function (m) { return '<div class="ls-row"><div class="ls-main"><b>' + esc(m.name) + ": " + LS_DAYS[m.from] + "s → " + LS_DAYS[m.to] + 's</b><small class="muted">Near ' + esc(m.near) + (m.biweekly ? " · every other week" : "") + " · saves ~" + m.save_min + ' min a week</small></div><button class="btn sm" data-a="lsxMove" data-id="' + esc(m.id) + '" data-v="' + m.to + '" data-n="' + esc(m.name) + '">Move</button></div>'; }).join("") + "</div>";
  }
  function lsPriceCard() {
    if (!S.ls || !S.ls.money) return "";
    if (!S.lsPrice) { lsLazy("lsPrice", "lsPriceBusy", "lsPricing"); return '<div class="section-title"><h2>Pricing check</h2></div><div class="card ls-rload">Working out each agreement\'s money per crew hour…</div>'; }
    var r = S.lsPrice; if (r.err) return '<div class="card">' + esc(r.err) + "</div>";
    var tgt = r.target, rows = r.rows || [], below = rows.filter(function (x) { return x.per_hour != null && x.per_hour < tgt; }), tr = rows.reduce(function (a, x) { return a + x.revenue; }, 0), th = rows.reduce(function (a, x) { return a + x.hours; }, 0), tp = rows.reduce(function (a, x) { return a + x.profit; }, 0);
    var admin = S.me && S.me.role === "admin";
    return '<div class="section-title"><h2>Pricing check</h2><span class="muted small">Each agreement per month, crew time on site + its share of the driving</span></div>' +
      '<div class="grid g4 ls-kpis">' + stat("Agreements pay", m0(tr) + "/mo", rows.length + " recurring properties") + stat("Crew hours", Math.round(th) + " h/mo", "on site + driving, all people") + stat("Per crew hour", th ? m0(tr / th) : "—", "goal " + m0(tgt)) + stat("Below the goal", String(below.length), below.length ? "raise or re-route these" : "all good") + "</div>" +
      '<div class="card tbl" data-lenis-prevent><table class="t ls-price"><thead><tr><th>Property</th><th class="num">$ per crew hour</th><th class="num">Pays /mo</th><th class="num">Profit /mo</th><th class="num">Crew hours /mo</th><th class="num">On site /visit</th><th class="num">Drive /visit</th><th class="num">Visits /mo</th><th class="num">Labor cost</th></tr></thead><tbody>' +
      rows.map(function (x) {
        var low = x.per_hour != null && x.per_hour < tgt;
        return '<tr class="' + (low || x.no_price ? "low" : "") + '"><td><button class="link" data-a="lsOpenProp" data-id="' + esc(x.id) + '">' + esc(x.name) + "</button>" + (x.no_price ? ' <span class="pill bad">No price</span>' : "") + (x.no_pin ? ' <span class="pill">No pin</span>' : "") + '</td><td class="num"><b class="' + (low ? "neg" : "") + '">' + (x.per_hour == null ? "—" : m0(x.per_hour)) + '</b></td><td class="num">' + (x.no_price ? "—" : m0(x.revenue)) + '</td><td class="num"><b class="' + (x.profit < 0 ? "neg" : "") + '">' + m0(x.profit) + '</b></td><td class="num">' + x.hours + ' h</td><td class="num">' + lsHm(x.site_min) + (x.logged ? ' <small class="muted">logged</small>' : ' <small class="muted">plan</small>') + '</td><td class="num">' + (x.no_pin ? "—" : lsHm(x.drive_min)) + '</td><td class="num">' + x.visits + '</td><td class="num">' + m0(x.cost) + "</td></tr>";
      }).join("") + "</tbody></table></div>" +
      '<div class="card ls-explain"><b>How this is counted</b><p class="muted small">Revenue per month from the agreement. Crew hours = person-minutes on site per visit (from what crews logged in the last 90 days, otherwise the planned minutes on the property) + driving to it × people in the truck, times visits per month. Labor cost uses each crew member\'s rate (or ' + m0(r.rate) + "/h). Driving is estimated for a typical week" + (r.yard ? ", starting and ending at the yard" : "") + ". $ per crew hour = what the agreement pays ÷ crew hours: the number to compare when you price, re-route, or drop a client.</p>" +
      (admin ? '<form class="ls-goal" data-form="lsxGoal">Goal per crew hour: $<input type="number" name="target" min="10" max="500" step="5" value="' + tgt + '"><button class="btn ghost sm" type="submit">Save</button></form>' : "") + "</div>";
  }
  /* The crew's own day: one tap to drive the stops in order with Google Maps (starts from where they are). */
  function lsCrewMapsLink(vs) {
    var pts = vs.slice().sort(lsCmp).map(function (v) { var p = lsP(v.property_id); return lsHasPin(p) ? p.lat + "," + p.lon : ""; }).filter(Boolean);
    if (!pts.length) return "";
    var dest = pts.pop();
    return "https://www.google.com/maps/dir/?api=1&travelmode=driving&destination=" + encodeURIComponent(dest) + (pts.length ? "&waypoints=" + encodeURIComponent(pts.join("|")) : "");
  }
  var _lsCrewView0 = lsCrewView;
  lsCrewView = function () {
    var html = _lsCrewView0.apply(this, arguments);
    try { var mine = (S.ls.visits || []).filter(function (v) { return v.date === S.ls.today && v.status !== "canceled" && v.status !== "completed"; }), u = lsCrewMapsLink(mine);
      if (u && html.indexOf("ls-crewnav") < 0) html = '<a class="btn ls-crewnav" href="' + esc(u) + '" target="_blank" rel="noopener">🧭 Drive today\'s stops in Google Maps</a>' + html; } catch (e) {}
    return html;
  };
  var _lsSchedule0 = lsSchedule;
  lsSchedule = function () {
    var base = _lsSchedule0.apply(this, arguments);
    if ((S.lsMode || "list") === "map") base = base.replace(/<div class="card ls-mapcard">[\s\S]*$/, lsRoutePanel());
    return lsSugCard() + base;
  };
  var _lsProps0 = lsProps;
  lsProps = function () { return (S.ls.role === "office" ? lsPinNote() : "") + _lsProps0.apply(this, arguments); };
  var _lsCosts0 = lsCosts;
  lsCosts = function () { return lsPriceCard() + _lsCosts0.apply(this, arguments); };
  /* Map: every property (grey), the yard, and each crew's route for the day on the real roads. */
  lsMapInit = function () {
    var el = document.getElementById("ls-map"); if (!el || !S.ls) return;
    var d = lsMapDayGet(), r = S.lsRoutes[lsRouteKey(d)];
    var key = d + "|" + JSON.stringify(S.lsF || {}) + "|" + S.ls.visits.length + "|" + (r ? "r" : "") + "|" + (S.lsAll ? "a" : "") + "|" + (S.ls.yard ? S.ls.yard.lat : "");
    if (el.dataset.k === key && el._map) return;
    var go2 = function () {
      if (el._map) { el._map.remove(); el._map = null; }
      var map = el._map = L.map(el, { scrollWheelZoom: false }); el.dataset.k = key;
      L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", { maxZoom: 19, attribution: "© OpenStreetMap", referrerPolicy: "strict-origin-when-cross-origin", crossOrigin: false }).addTo(map);
      var pts = [], onRoute = {};
      (r && r.crews || []).forEach(function (g) {
        var c = lsC(g.crew_id), col = (c && c.color) || "#2f6db0", line = [];
        g.stops.forEach(function (s, i) {
          var v = lsV(s.visit_id), p = v && lsP(v.property_id); if (!lsHasPin(p)) return; onRoute[p.id] = 1;
          if (s.drive_min == null) { L.marker([+p.lat, +p.lon], { icon: L.divIcon({ className: "ls-pin approx", html: "<span>!</span>", iconSize: [28, 28], iconAnchor: [14, 14] }) }).addTo(map).bindPopup("<b>" + esc(p.name) + "</b><br>Approximate location: " + esc(s.why || "address incomplete") + ".<br>Not in this route's drive times."); return; }
          var ll = [+p.lat, +p.lon]; pts.push(ll); line.push(ll);
          L.marker(ll, { zIndexOffset: 500, icon: L.divIcon({ className: "ls-pin", html: '<span style="background:' + col + '">' + (i + 1) + "</span>", iconSize: [28, 28], iconAnchor: [14, 14] }) }).addTo(map)
            .bindPopup("<b>" + esc(p.name) + "</b><br>" + esc(c ? c.name : "No crew") + "<br>Stop " + (i + 1) + (s.drive_min != null && (i || S.ls.yard) ? " · " + lsHm(s.drive_min) + " drive to here" : "") + "<br>" + lsSiteTxt(v, true));
        });
        if (g.poly) L.polyline(lsDecode(g.poly), { color: col, weight: 4, opacity: .8 }).addTo(map);
        else if (line.length > 1) L.polyline(line, { color: col, weight: 3, opacity: .7, dashArray: "6 6" }).addTo(map);
      });
      if (!r) lsFiltered().filter(function (v) { return v.date === d && v.status !== "canceled"; }).forEach(function (v) { var p = lsP(v.property_id); if (lsHasPin(p)) { pts.push([+p.lat, +p.lon]); onRoute[p.id] = 1; L.marker([+p.lat, +p.lon], { icon: L.divIcon({ className: "ls-pin", html: "<span>•</span>", iconSize: [28, 28], iconAnchor: [14, 14] }) }).addTo(map).bindPopup("<b>" + esc(p.name) + "</b>"); } });
      if (S.lsAll) S.ls.props.forEach(function (p) {
        if (!lsHasPin(p) || onRoute[p.id] || p.status === "ended") return; var ll = [+p.lat, +p.lon]; if (!pts.length) pts.push(ll);
        L.circleMarker(ll, { radius: 7, color: "#fff", weight: 2, fillColor: "#7d8794", fillOpacity: .9 }).addTo(map).bindTooltip(esc(p.name)).bindPopup("<b>" + esc(p.name) + "</b><br>" + esc(LS_FREQ_TXT[p.freq] || "") + (p.weekday !== "" && p.freq !== "none" ? " · " + lsDaysTxt(p.weekday) : "") + "<br>" + esc(p.address || ""));
      });
      var all = S.lsAll ? S.ls.props.filter(lsHasPin).map(function (p) { return [+p.lat, +p.lon]; }) : [];
      if (S.ls.yard) { var yl = [S.ls.yard.lat, S.ls.yard.lon]; pts.push(yl); L.marker(yl, { zIndexOffset: 600, icon: L.divIcon({ className: "ls-pin yard", html: "<span>🏠</span>", iconSize: [30, 30], iconAnchor: [15, 15] }) }).addTo(map).bindPopup("<b>Yard</b><br>" + esc(S.ls.yard.address)); }
      var fit = pts.concat(all);
      if (fit.length) map.fitBounds(fit, { padding: [30, 30], maxZoom: 14 }); else map.setView([37.45, -122.15], 10);
    };
    if (window.L) return go2();
    if (!document.getElementById("leaf-css")) { var l = document.createElement("link"); l.id = "leaf-css"; l.rel = "stylesheet"; l.href = "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.css"; document.head.appendChild(l); }
    var sc = document.createElement("script"); sc.src = "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.js"; sc.onload = go2; document.head.appendChild(sc);
  };
  root.addEventListener("click", function (e) {
    var b = e.target.closest("[data-a]"); if (!b) return; var a = b.dataset.a; if (!/^lsx(YardEdit|SugHide|PinHide|Pins|Save|Reopt|Keep)$/.test(a)) return;
    e.preventDefault(); e.stopImmediatePropagation();
    if (a === "lsxYardEdit") { S.lsYardEdit = !S.lsYardEdit; return keepScroll(render); }
    if (a === "lsxSugHide") { S.lsSugHide = true; return keepScroll(render); }
    if (a === "lsxPinHide") { S.lsPinRes = null; return keepScroll(render); }
    if (a === "lsxPins") return run(b, async function () { var r = await call("lsFixPins", {}); S.lsPinRes = r; await lsLoad(true); toast((r.found.length + r.check.length) ? "📍 " + (r.found.length + r.check.length) + " placed on the map" : "Google couldn't place them: add street addresses"); });
    if (a === "lsxSave") return run(b, async function () { var r = await call("lsSaveOrder", { date: b.dataset.d, crew_id: b.dataset.c, order: b.dataset.o.split(",") }); await lsLoad(true); toast("Saved for the list, the map and the crew's phone: " + r.stops + " stops · " + lsHm(r.drive_min) + " driving" + (r.real ? "" : " (estimate)")); });
    if (a === "lsxReopt") return run(b, async function () { var d = b.dataset.d; S.lsRoutes[lsRouteKey(d)] = await call("lsDayRoutes", { date: d, ids: lsDayIds(d), optimize: true }); keepScroll(render); });
    if (a === "lsxKeep") { S.lsRoutes = {}; return keepScroll(render); }
    if (a === "lsxDay") { S.lsMapDay = b.dataset.v; return keepScroll(render); }
    if (a === "lsxMove") { var nm = b.dataset.n, to = LS_DAYS[+b.dataset.v];
      return sure("Move " + nm + " to " + to + "s from next " + to + " on? Its future visits move; visits already done or changed by hand stay.", function () {
        call("lsMoveDay", { id: b.dataset.id, weekday: Number(b.dataset.v) }).then(function () { S.lsSug = null; return lsLoad(true); }).then(function () { toast(nm + " is now on " + to + "s"); }).catch(function (er) { toast(er.message); }); }); }
  }, true);
  root.addEventListener("change", function (e) {
    var t = e.target; if (!t.matches || !t.matches("[data-lsx-all]")) return; e.stopImmediatePropagation();
    S.lsAll = t.checked; keepScroll(render);
  }, true);
  root.addEventListener("submit", function (e) {
    var f = e.target; if (!f.matches || !f.matches("form[data-form=lsxYard], form[data-form=lsxGoal]")) return; e.preventDefault(); e.stopImmediatePropagation();
    var fd = new FormData(f), btn = f.querySelector("[type=submit]");
    if (f.dataset.form === "lsxYard") return run(btn, async function () { var r = await call("lsSettings", { yard: String(fd.get("yard") || "").trim() }); S.ls.yard = r.cfg.yard; S.lsYardEdit = false; S.lsRoutes = {}; S.lsSug = null; S.lsPrice = null; keepScroll(render); toast("Yard saved: " + (r.cfg.yard ? r.cfg.yard.address : "none")); });
    run(btn, async function () { var r = await call("lsSettings", { target: Number(fd.get("target")) }); S.lsPrice = null; S.ls.target = r.cfg.target; keepScroll(render); toast("Goal: $" + r.cfg.target + " per crew hour"); });
  }, true);
  /* ======================= batch 1: role switches clear staff data, preview pickers, ready-to-dispatch checks ======================= */
  function lsReset() {
    S.lsGen = (S.lsGen || 0) + 1; S.ls = null; S.lsBusy = 0; S.lsRoutes = {}; S.lsRoutesBusy = null; S.lsSug = null; S.lsPrice = null; S.lsProp = null; S.lsPinRes = null; S.lsEstLog = null;
    S.lsMapDay = null; S.lsDay = null; S.lsTab = null; S.lsYardEdit = false; S.fin = null; S.money = null; S.qb = null;
    if (S.home === "finance") S.home = "projects";
  }
  function lsPreviewPick() {
    if (!S.viewAs || !S.ls || S.ls.err) return ""; var list = S.ls.pick || [];
    if (S.viewAs !== "client" && S.viewAs !== "crew") return "";
    var who = S.viewAs === "client" ? "the client of" : "the crew";
    return '<div class="card ls-pvpick"><span>👁 Maintenance as ' + who + ' </span><select data-lsx-pv><option value="">Pick ' + (S.viewAs === "client" ? "a property" : "a crew") + "…</option>" +
      list.map(function (x) { return '<option value="' + esc(x.id) + '"' + (S.viewAsLs === x.id ? " selected" : "") + ">" + esc(x.name) + (S.viewAs === "client" && !x.has_client ? " (no client email yet)" : "") + "</option>"; }).join("") +
      '</select><small class="muted">Exactly what the server sends ' + (S.viewAs === "client" ? "that client" : "that crew") + ". Nothing internal, nothing saves.</small></div>";
  }
  var _lsView0 = lsView;
  lsView = function () { var h = _lsView0.apply(this, arguments); return lsPreviewPick() + h; };
  /* What has to be fixed before the trucks leave (next 7 days). */
  function lsReadyItems() {
    var t = S.ls.today, wk = lsAddD(t, 7), items = [], act = S.ls.props.filter(function (p) { return p.status === "active"; });
    var vs = S.ls.visits.filter(function (v) { return v.date >= t && v.date <= wk && ["scheduled", "in_progress", "blocked", "weather"].indexOf(v.status) > -1; });
    var noCrew = vs.filter(function (v) { return !v.crew_id; });
    if (!S.ls.crews.length) items.push({ lv: "bad", t: "No crews set up", d: "Visits can't be assigned, and every time on site assumes 1 person.", a: '<button class="btn sm" data-a="lsTab" data-v="crews">Add crews</button>' });
    if (noCrew.length) items.push({ lv: "bad", t: noCrew.length + " visit" + (noCrew.length === 1 ? "" : "s") + " in the next 7 days have no crew", d: "The schedule is incomplete until each visit has a crew. Assign a crew on the property (its future visits follow).", a: '<button class="btn ghost sm" data-a="lsTab" data-v="props">Assign on properties</button>' });
    var bad = act.filter(function (p) { return p.routable === false; });
    if (bad.length) items.push({ lv: "warn", t: bad.length + " " + (bad.length === 1 ? "property can't" : "properties can't") + " be routed", d: "Not counted in drive times until the address is complete: " + bad.map(function (p) { return '<button class="link small" data-a="modal" data-m="lsProp" data-id="' + esc(p.id) + '">' + esc(p.name) + "</button> (" + esc(p.route_why) + ")"; }).join(", ") });
    var unc = act.filter(function (p) { return p.freq !== "none" && !p.labor_ok; });
    if (unc.length) items.push({ lv: "warn", t: unc.length + " " + (unc.length === 1 ? "property uses" : "properties use") + " an unconfirmed labor time", d: "Their planned labor is still a default or a guess (imported ones got 90 person-minutes). Open each one, set the real time and tick “confirmed”, so routes, shifts and pricing are right: " + unc.slice(0, 8).map(function (p) { return '<button class="link small" data-a="modal" data-m="lsProp" data-id="' + esc(p.id) + '">' + esc(p.name) + "</button>"; }).join(", ") + (unc.length > 8 ? "…" : "") });
    if (!S.ls.yard) items.push({ lv: "warn", t: "No office / yard address", d: "Routes can't include loading, the drive out or the drive back.", a: S.me && S.me.role === "admin" ? '<button class="btn ghost sm" data-a="lsxGoMap">Set it on the map</button>' : "" });
    if (S.ls.money) { var np = act.filter(function (p) { return p.freq !== "none" && !p.price; }); if (np.length) items.push({ lv: "warn", t: np.length + " agreement" + (np.length === 1 ? "" : "s") + " without a price", d: np.map(function (p) { return '<button class="link small" data-a="modal" data-m="lsProp" data-id="' + esc(p.id) + '">' + esc(p.name) + "</button>"; }).join(", ") }); }
    var load = {}; vs.filter(function (v) { return v.crew_id; }).forEach(function (v) { var k = v.date + "|" + v.crew_id; load[k] = (load[k] || 0) + lsSite(v).min; });
    Object.keys(load).forEach(function (k) { var c = lsC(k.split("|")[1]), h = lsCrewHrs(c), span = h.end - h.start; if (load[k] > span) items.push({ lv: "bad", t: "Overloaded: " + esc(c ? c.name : "crew") + " on " + lsDow(k.split("|")[0]) + " " + day(k.split("|")[0]), d: lsHm(load[k]) + " on site before any driving, in a " + lsHm(span) + " shift. Move a visit or add people." }); });
    return items;
  }
  function lsReadyCard() {
    var it = lsReadyItems();
    return '<div class="section-title"><h2>Before the trucks leave</h2><span class="muted small">Next 7 days</span></div>' + (it.length ? '<div class="card ls-ready">' + it.map(function (x) {
      return '<div class="ls-rdy ' + x.lv + '"><span class="ls-rdyi">' + (x.lv === "bad" ? "⛔" : "⚠️") + '</span><div class="ls-main"><b>' + x.t + '</b><small class="muted">' + x.d + "</small></div>" + (x.a || "") + "</div>"; }).join("") + "</div>" : '<div class="empty">Every visit has a crew, an address and a confirmed time. ✓</div>');
  }
  var _lsDash0 = lsDash;
  lsDash = function () { var h = _lsDash0.apply(this, arguments), mk = '<div class="section-title"><h2>Crews today</h2>'; return h.indexOf(mk) > -1 ? h.replace(mk, lsReadyCard() + mk) : lsReadyCard() + h; };
  var _lsSchedule1 = lsSchedule;
  lsSchedule = function () {
    var h = _lsSchedule1.apply(this, arguments), n = lsFiltered().filter(function (v) { return v.status !== "canceled" && v.status !== "completed" && v.date >= S.ls.today && !v.crew_id; }).length;
    return (n ? '<div class="ls-incomplete">⛔ <b>Schedule incomplete:</b> ' + n + " upcoming visit" + (n === 1 ? " has" : "s have") + ' no crew. Times on site assume 1 person until a crew is assigned. <button class="link small" data-a="lsTab" data-v="today">See what needs attention</button></div>' : "") + h;
  };
  root.addEventListener("click", function (e) {
    var b = e.target.closest("[data-a=lsxGoMap]"); if (!b) return; e.preventDefault(); e.stopImmediatePropagation();
    S.lsTab = "schedule"; S.lsMode = "map"; S.lsYardEdit = true; keepScroll(render);
  }, true);
  root.addEventListener("change", function (e) {
    var t = e.target; if (!t.matches || !t.matches("[data-lsx-pv]")) return; e.stopImmediatePropagation();
    S.viewAsLs = t.value || null; var keep = S.ls && S.ls.pick; S.lsGen = (S.lsGen || 0) + 1; S.ls = null; S.lsBusy = 0; S.lsProp = null; S.modal = null; keepScroll(render);
  }, true);
  /* ======================= batch 2: dispatch map: property list + day route beside the map ======================= */
  S.lsPlan = {}; S.lsOrder = {}; S.lsStart = {}; S.lsLine = {}; S.lsPTab = "all"; S.lsSort = "office"; S.lsPF = {};
  function mi(km) { return km == null ? "—" : (Math.round(km * 0.621371 * 10) / 10) + " mi"; }
  function clk(m) { if (m == null) return ""; m = Math.round(m); var h = Math.floor(m / 60) % 24, mm = m % 60, ap = h >= 12 ? "PM" : "AM", h12 = h % 12 || 12; return h12 + ":" + (mm < 10 ? "0" : "") + mm + " " + ap; }
  function hhmm(s) { var m = String(s || "").match(/^(\d\d):(\d\d)$/); return m ? +m[1] * 60 + +m[2] : null; }
  function lsDayVisits(d) { return lsFiltered().filter(function (v) { return v.date === d && v.status !== "canceled"; }).sort(lsCmp); }
  function lsGroups(d) { var g = {}; lsDayVisits(d).forEach(function (v) { (g[v.crew_id || ""] = g[v.crew_id || ""] || []).push(v); }); return g; }
  function lsCrewPick(d) { var g = lsGroups(d), ks = Object.keys(g).sort(function (a, b) { return a === "" ? 1 : b === "" ? -1 : (lsC(a) || {}).name < (lsC(b) || {}).name ? -1 : 1; }); if (S.lsPCrew == null || ks.indexOf(S.lsPCrew) < 0) S.lsPCrew = ks.length ? ks[0] : (S.lsPCrew || ""); return { groups: g, keys: ks, cur: S.lsPCrew }; }
  function lsDk() { var d = lsMapDayGet(); lsCrewPick(d); return d + "|" + (S.lsPCrew || ""); }
  function lsNextVisit(p) { var t = S.ls.today; return S.ls.visits.filter(function (v) { return v.property_id === p.id && v.date >= t && ["scheduled", "in_progress", "weather"].indexOf(v.status) > -1; }).sort(function (a, b) { return a.date < b.date ? -1 : 1; })[0]; }
  function lsOpenIss(p) { return (S.ls.issues || []).filter(function (i) { return i.property_id === p.id && i.status !== "closed"; }); }
  function lsODGet() { if (!S.ls.yard) return null; if (!S.lsOD && !S.lsODBusy) lsLazy("lsOD", "lsODBusy", "lsOfficeDist"); return S.lsOD && S.lsOD.props ? S.lsOD.props : null; }
  function lsPlanGet() {
    var dk = lsDk(), d = lsMapDayGet(), crew = S.lsPCrew || "", vs = (lsGroups(d)[crew] || []), ids = vs.map(function (v) { return v.id; }), ord = S.lsOrder[dk], st = S.lsStart[dk] || {};
    if (!ids.length) return { empty: true };
    var key = dk + "|" + ids.join(",") + "|" + (ord ? ord.join(",") : "") + "|" + (st.address || "") + "|" + (st.time || "");
    if (S.lsPlan[key]) return S.lsPlan[key];
    if (S.lsPlanBusy !== key) { S.lsPlanBusy = key; call("lsPlanDay", { date: d, crew_id: crew, ids: ids, order: ord || undefined, start: st.address || undefined, start_time: st.time || undefined })
      .then(function (r) { S.lsPlan[key] = r; }).catch(function (e) { S.lsPlan[key] = { err: e.message }; if (st.address) S.lsStart[dk] = Object.assign({}, st, { address: "" }); }).then(function () { S.lsPlanBusy = null; keepScroll(render); }); }
    return null;
  }
  function lsDaySel() {
    var d = lsMapDayGet(), t = S.ls.today, opts = [], x = t, end = S.ls.to > lsAddD(t, 21) ? S.ls.to : lsAddD(t, 21);
    for (var i = 0; x <= end && i < 40; i++, x = lsAddD(x, 1)) opts.push(x); if (opts.indexOf(d) < 0) opts.unshift(d);
    return '<div class="lsd-days"><button class="btn ghost sm" data-a="lsxDayStep" data-v="-1" aria-label="Previous day">‹</button><select data-lsx-day aria-label="Day">' + opts.map(function (o) { var n = lsDayVisits(o).length; return '<option value="' + o + '"' + (o === d ? " selected" : "") + ">" + (o === t ? "Today · " : "") + lsDow(o).slice(0, 3) + " " + day(o) + " · " + n + " visit" + (n === 1 ? "" : "s") + "</option>"; }).join("") +
      '</select><button class="btn ghost sm" data-a="lsxDayStep" data-v="1" aria-label="Next day">›</button>' + lsWxTag(d) + "</div>";
  }
  function lsCrewChips(d) {
    var cp = lsCrewPick(d); if (!cp.keys.length) return "";
    return '<div class="chips lsd-crews">' + cp.keys.map(function (k) { var c = lsC(k), n = cp.groups[k].length; return '<button class="chip' + (k === cp.cur ? " on" : "") + '" data-a="lsxCrew" data-v="' + esc(k) + '">' + lsDot(c) + esc(c ? c.name : "No crew") + " · " + n + "</button>"; }).join("") + "</div>";
  }
  /* ---------- All properties ---------- */
  function lsPropCards() {
    var od = lsODGet(), f = S.lsPF || {}, q = String(S.lsQ || "").toLowerCase().trim(), all = S.ls.props.filter(function (p) { return p.status !== "ended"; });
    var cities = all.map(function (p) { return p.city || ""; }).filter(function (c, i, a) { return c && a.indexOf(c) === i; }).sort();
    var list = all.filter(function (p) {
      if (q && (p.name + " " + p.address + " " + p.city + " " + p.client_name).toLowerCase().indexOf(q) < 0) return false;
      if (f.city && p.city !== f.city) return false; if (f.crew != null && f.crew !== "" && (f.crew === "-" ? p.crew_id : p.crew_id !== f.crew)) return false;
      if (f.day && String(p.weekday).split(",").indexOf(f.day) < 0) return false; if (f.freq && p.freq !== f.freq) return false; return true;
    });
    var dist = function (p) { var o = od && od[p.id]; return o ? o.min : 9999; }, firstDay = function (p) { var l = String(p.weekday).split(",").filter(Boolean).map(Number); return p.freq === "none" || !l.length ? 9 : l[0] === 0 ? 7 : l[0]; };
    list.sort(function (a, b) { var s = S.lsSort; var r = s === "office" ? dist(a) - dist(b) : s === "city" ? (a.city || "~").localeCompare(b.city || "~") : s === "day" ? firstDay(a) - firstDay(b) : 0; return r || a.name.localeCompare(b.name); });
    var sel = function (name, opts, cur) { return '<select data-lsx-pf="' + name + '">' + opts.map(function (o) { return '<option value="' + esc(o[0]) + '"' + (String(cur || "") === o[0] ? " selected" : "") + ">" + esc(o[1]) + "</option>"; }).join("") + "</select>"; };
    var ctl = '<div class="lsd-ctl"><input type="search" data-lsx-q placeholder="Search name, address, client" value="' + esc(S.lsQ || "") + '">' +
      '<div class="lsd-filters">' + sel("city", [["", "All cities"]].concat(cities.map(function (c) { return [c, c]; })), f.city) +
      sel("day", [["", "Any day"]].concat([1, 2, 3, 4, 5, 6, 0].map(function (i) { return [String(i), LS_DAYS[i]]; })), f.day) +
      sel("crew", [["", "Any crew"], ["-", "No crew"]].concat(S.ls.crews.map(function (c) { return [c.id, c.name]; })), f.crew) +
      sel("freq", [["", "Any service"]].concat(Object.keys(LS_FREQ_TXT).map(function (k) { return [k, LS_FREQ_TXT[k]]; })), f.freq) +
      '<label class="lsd-sort">Sort ' + sel("sort", [["office", "Distance from office"], ["city", "City"], ["day", "Service day"], ["name", "Name"]], S.lsSort) + "</label></div>" +
      '<small class="muted">' + (list.length === all.length ? all.length + " properties" : "Showing " + list.length + " of " + all.length + " properties") + (S.ls.yard ? (od ? " · drive from the office: Google" : " · getting drive times from the office…") : " · set the office address to see drive times") + "</small></div>";
    return ctl + '<div class="lsd-plist">' + (list.length ? list.map(lsPropCard).join("") : '<div class="empty">No property matches.</div>') + "</div>";
  }
  function lsPropCard(p) {
    var od = lsODGet(), o = od && od[p.id], c = lsC(p.crew_id), nv = lsNextVisit(p), iss = lsOpenIss(p), on = S.lsSel === p.id, size = c ? Math.max(1, c.members.length) : 1;
    var onSite = p.visit_dur ? p.visit_dur : Math.ceil((p.visit_min || 60) / size), d = lsMapDayGet(), stop = lsDayVisits(d).filter(function (v) { return v.property_id === p.id; })[0];
    var pills = (stop ? '<span class="pill ok">' + (lsDow(d).slice(0, 3)) + (stop.stop ? " · stop " + stop.stop : "") + "</span>" : "") + (p.routable === false ? '<span class="pill bad" title="' + esc(p.route_why) + '">Address incomplete</span>' : "") + (iss.length ? '<span class="pill warn">' + iss.length + " open issue" + (iss.length === 1 ? "" : "s") + "</span>" : "") + (p.access || p.window_from ? '<span class="pill" title="Access instructions">🔑</span>' : "");
    var h = '<div class="lsd-pc' + (on ? " sel" : "") + '" id="lsd-p-' + esc(p.id) + '"><div class="lsd-pch" data-a="lsxSel" data-id="' + esc(p.id) + '"><b>' + esc(p.name) + "</b>" + pills + "</div>" +
      '<small class="muted" data-a="lsxSel" data-id="' + esc(p.id) + '">' + esc([p.address, p.city].filter(Boolean).join(", ") || "No address") + (p.client_name ? " · " + esc(p.client_name) : "") + "</small>" +
      '<div class="lsd-pcm" data-a="lsxSel" data-id="' + esc(p.id) + '"><span>' + esc(LS_FREQ_TXT[p.freq] || "") + (p.freq !== "none" && p.weekday !== "" ? " · " + lsDaysTxt(p.weekday, true) : "") + "</span><span>" + lsDot(c) + esc(c ? c.name : "No crew") + "</span><span>" + lsHm(onSite) + " on site" + (p.visit_dur ? "" : " · " + (p.visit_min || 60) + " person-min") + (p.labor_ok ? "" : ' <i class="muted">(unconfirmed)</i>') + "</span></div>" +
      '<div class="lsd-pcm" data-a="lsxSel" data-id="' + esc(p.id) + '"><span class="lsd-od">🏠 ' + (p.routable === false ? '<span class="bad-t">' + esc(p.route_why) + "</span>" : !S.ls.yard ? "office not set" : o ? lsHm(o.min) + " · " + mi(o.km) + " from office" + (o.real ? "" : " (estimate)") : "…") + "</span><span>Next: " + (nv ? lsDow(nv.date).slice(0, 3) + " " + day(nv.date) : "—") + "</span></div>";
    if (on) {
      var det = [["Access", p.access], ["Access window", p.window_from || p.window_to ? (p.window_from ? clk(hhmm(p.window_from)) : "any time") + " – " + (p.window_to ? clk(hhmm(p.window_to)) : "end of day") : ""], ["Client allows", p.days_ok ? lsDaysTxt(p.days_ok) : ""], ["Needs on the truck", p.equipment], ["Service", (p.features || []).join(", ") + (p.included ? ((p.features || []).length ? " · " : "") + p.included : "")], ["On-site contact", p.contacts], ["Team notes", p.notes]]
        .filter(function (x) { return x[1]; }).map(function (x) { return "<dt>" + x[0] + "</dt><dd>" + esc(x[1]) + "</dd>"; }).join("");
      var nav = S.ls.yard && lsHasPin(p) ? "https://www.google.com/maps/dir/?api=1&travelmode=driving&origin=" + encodeURIComponent(S.ls.yard.lat + "," + S.ls.yard.lon) + "&destination=" + encodeURIComponent(p.lat + "," + p.lon) : lsNav(p);
      h += '<div class="lsd-pdet">' + (det ? "<dl>" + det + "</dl>" : '<p class="muted small">No access notes or instructions yet.</p>') +
        (iss.length ? '<div class="lsd-iss">' + iss.slice(0, 3).map(function (i) { return '<button class="link small" data-a="lsTriageOpen" data-id="' + esc(i.id) + '">' + (i.urgency === "urgent" ? "🔴 " : "") + esc(i.text.slice(0, 80)) + "</button>"; }).join("") + "</div>" : "") +
        '<div class="lsd-acts"><button class="btn ghost sm" data-a="lsOpenProp" data-id="' + esc(p.id) + '">Open property</button>' +
        (nv ? '<button class="btn ghost sm" data-a="lsOpenVisit" data-id="' + esc(nv.id) + '">Work order (' + lsDow(nv.date).slice(0, 3) + " " + day(nv.date) + ")</button>" : "") +
        (!stop ? '<button class="btn ghost sm" data-a="lsxAddRoute" data-id="' + esc(p.id) + '">Add to ' + lsDow(d).slice(0, 3) + " " + day(d) + "</button>" : "") +
        '<a class="btn sm" href="' + esc(nav) + '" target="_blank" rel="noopener">🧭 Navigate</a></div></div>';
    }
    return h + "</div>";
  }
  /* ---------- the day's route for one crew ---------- */
  function lsRouteTab() {
    var d = lsMapDayGet(), cp = lsCrewPick(d), crew = cp.cur, c = lsC(crew), dk = lsDk(), st = S.lsStart[dk] || {};
    if (!cp.keys.length) {
      var nxt = lsFiltered().filter(function (v) { return v.status !== "canceled" && v.date > d; }).map(function (v) { return v.date; }).sort()[0];
      return '<div class="empty lsd-empty"><b>No visits on ' + lsDow(d) + " " + day(d) + ".</b><br>" + (nxt ? '<button class="btn sm" data-a="lsxDay" data-v="' + nxt + '">Go to ' + lsDow(nxt) + " " + day(nxt) + "</button><br>" : "") + 'To build a route for this day, open a property in <button class="link" data-a="lsxPTab" data-v="all">All properties</button> and use “Add to ' + lsDow(d).slice(0, 3) + '”.</div>';
    }
    var r = lsPlanGet(); if (!r) return '<div class="card ls-rload">Planning the day with Google drive times…</div>';
    if (r.err) return '<div class="card">' + esc(r.err) + "</div>";
    var cur = r.current, sug = r.suggested, showS = sug && S.lsShowSug === dk, P = showS ? sug : cur, hrs = r.hours, over = P.finish > hrs.end, size = r.size, dcfg = S.ls.day_cfg || {};
    var head = '<div class="lsd-rhead">' + lsDot(c) + "<div><b>" + esc(c ? c.name : "No crew assigned") + '</b><small class="muted">' + (r.no_crew ? "No crew: 1 person assumed" : size + (size === 1 ? " person" : " people")) + (c && c.vehicle ? " · 🚚 " + esc(c.vehicle) : c ? " · no vehicle set" : "") + " · shift " + clk(hrs.start) + "–" + clk(hrs.end) + (hrs.set || !c ? "" : " (default)") + "</small></div>" + '<span class="pill' + (P.real ? " ok" : "") + '">' + (P.real ? "Google road times" : "Estimated times") + "</span></div>";
    var start = '<form class="lsd-start" data-form="lsxStart">From ' + (st.address ? "<b>" + esc((r.origin || {}).address || st.address) + '</b> <button type="button" class="link small" data-a="lsxStartReset">use the office</button>' : r.origin ? "🏠 <b>the office</b>" : '<span class="bad-t">no office set</span>') +
      ' at <input type="time" name="time" value="' + esc(st.time || (function (m) { var h = Math.floor(m / 60), mm = m % 60; return (h < 10 ? "0" : "") + h + ":" + (mm < 10 ? "0" : "") + mm; })(r.start_time)) + '"> <input type="text" name="address" placeholder="Start somewhere else (address)" value=""><button class="btn ghost sm" type="submit">Update</button></form>';
    var cmp = "";
    if (sug) {
      var conf = function (pl) { var l = pl.rows.filter(function (x) { return x.late; }).length; return (l ? l + " late" : "") + (pl.over_min ? (l ? ", " : "") + "over shift " + lsHm(pl.over_min) : ""); };
      cmp = '<div class="lsd-cmp"><div><span class="eyebrow">Current order</span><b>' + lsHm(cur.drive_min) + " driving · " + mi(cur.km) + "</b><small>back " + clk(cur.finish) + (conf(cur) ? ' · <span class="bad-t">' + conf(cur) + "</span>" : "") + "</small></div>" +
        '<div class="good"><span class="eyebrow">Suggested</span><b>' + lsHm(sug.drive_min) + " driving · " + mi(sug.km) + "</b><small>back " + clk(sug.finish) + (conf(sug) ? ' · <span class="bad-t">' + conf(sug) + "</span>" : " · no conflicts") + "</small></div>" +
        '<div class="lsd-save"><b>Saves ' + lsHm(Math.max(0, r.save_min)) + " and " + mi(Math.max(0, r.save_km)) + (r.save_finish > 0 ? ", back " + lsHm(r.save_finish) + " earlier" : "") + '</b><div><button class="btn ghost sm" data-a="lsxShowSug">' + (showS ? "Show current" : "Show suggested") + '</button><button class="btn sm" data-a="lsxApply" data-o="' + esc(sug.order.join(",")) + '">Use suggested order</button></div></div></div>';
    } else if (cur.rows.length > 1) cmp = '<div class="lsd-ok">✓ This is already the best order we found' + (cur.late_min ? " (but see the conflicts below)" : "") + ".</div>";
    var dirty = S.lsOrder[dk] && !showS;
    var rowsH = '<div class="lsd-tl"><div class="lsd-trow yard"><span class="ls-stop">🏠</span><div><b>' + (r.origin && r.origin.kind === "custom" ? esc(r.origin.address) : "Office / yard") + '</b><small class="muted">' + (P.load_min ? "Load " + clk(P.start) + "–" + clk(P.leave) + " · " : "") + "leave " + clk(P.leave) + "</small></div></div>" +
      P.rows.map(function (x, i) {
        var brk = x.brk ? '<div class="lsd-leg brk">☕ Lunch ' + lsHm(x.brk) + "</div>" : "", leg = '<div class="lsd-leg">↓ ' + lsHm(x.drive_min) + " · " + mi(x.km) + (i || r.origin ? " from the " + (i ? "previous stop" : "office") : "") + "</div>";
        if (x.fuel) return brk + leg + '<div class="lsd-trow fuel"><span class="ls-stop">⛽</span><div><b>' + esc(x.name) + '</b><small class="muted">' + clk(x.arrive) + "–" + clk(x.depart) + " · " + x.svc + " min</small></div></div>";
        var v = lsV(x.visit_id) || {}, p = lsP(x.property_id), lack = (x.lack || []).length, n = P.rows.filter(function (y, j) { return j <= i && !y.fuel; }).length;
        var notes = [];
        if (x.fixed) notes.push("🔒 locked at " + clk(hhmm(x.fixed)));
        if (x.window) notes.push("window " + (x.window[0] ? clk(hhmm(x.window[0])) : "…") + "–" + (x.window[1] ? clk(hhmm(x.window[1])) : "…"));
        if (x.wait) notes.push("waits " + lsHm(x.wait));
        if (p.access) notes.push("🔑 " + p.access);
        if (v.kind === "extra") notes.push("➕ approved extra work: " + (v.scope || ""));
        if (v.kind === "correction") notes.push("correction: " + (v.scope || ""));
        return brk + leg + '<div class="lsd-trow' + (x.late ? " late" : "") + (S.lsSel === x.property_id ? " sel" : "") + '"' + (!showS ? ' draggable="true" data-vid="' + esc(x.visit_id) + '"' : "") + ' id="lsd-r-' + esc(x.property_id) + '"><span class="ls-stop" style="background:' + esc((c && c.color) || "#2f6db0") + '">' + n + "</span>" +
          '<div class="lsd-tmain"><div class="lsd-tt"><b data-a="lsxSel" data-id="' + esc(x.property_id) + '">' + esc(p.name || "Visit") + '</b><span class="lsd-time">' + clk(x.arrive) + (x.wait ? " → " + clk(x.start) : "") + " – " + clk(x.depart) + "</span></div>" +
          '<small class="muted">' + lsHm(x.svc) + " on site (" + esc(lsSiteWhy(x.svc_src, x.person_min, size, r.no_crew)) + ") · office " + (x.office_min != null ? lsHm(x.office_min) + " · " + mi(x.office_km) : "—") + "</small>" +
          (notes.length ? '<small class="lsd-notes">' + notes.map(esc).join(" · ") + "</small>" : "") +
          (x.late ? '<small class="bad-t">⛔ ' + lsHm(x.late) + " " + esc((x.why || []).join(", ")) + "</small>" : "") + (lack ? '<small class="bad-t">🧰 crew doesn\'t list: ' + esc(x.lack.join(", ")) + "</small>" : "") +
          (S.lsLock === x.visit_id ? '<form class="lsd-lock" data-form="lsxLock" data-id="' + esc(x.visit_id) + '"><input type="time" name="time" value="' + esc(x.fixed) + '" required><button class="btn sm" type="submit">Lock</button>' + (x.fixed ? '<button type="button" class="btn ghost sm" data-a="lsxUnlock" data-id="' + esc(x.visit_id) + '">Unlock</button>' : "") + '<button type="button" class="link small" data-a="lsxLockX">Cancel</button></form>' : "") + "</div>" +
          (!showS ? '<div class="lsd-rbtn"><button title="Earlier" data-a="lsxMv" data-id="' + esc(x.visit_id) + '" data-dir="-1"' + (i ? "" : " disabled") + '>↑</button><button title="Later" data-a="lsxMv" data-id="' + esc(x.visit_id) + '" data-dir="1"' + (i < P.rows.length - 1 ? "" : " disabled") + '>↓</button><button title="Lock to a time (client appointment)" data-a="lsxLockOpen" data-id="' + esc(x.visit_id) + '">' + (x.fixed ? "🔒" : "🕘") + "</button></div>" : "") + "</div>";
      }).join("") +
      (r.missing.length ? r.missing.map(function (m) { return '<div class="lsd-trow miss"><span class="ls-stop">!</span><div><b>' + esc(m.name) + '</b><small class="bad-t">Not in the drive times: ' + esc(m.why || "address incomplete") + '</small><button class="link small" data-a="modal" data-m="lsProp" data-id="' + esc(m.property_id) + '">Fix the address</button></div></div>'; }).join("") : "") +
      (r.origin && P.rows.length ? (P.break_min && !P.rows.some(function (x) { return x.brk; }) ? "" : "") + '<div class="lsd-leg">↓ ' + lsHm(P.back_min) + " · " + mi(P.back_km) + " back</div>" + '<div class="lsd-trow yard"><span class="ls-stop">🏠</span><div><b>Back at the yard ' + clk(P.finish) + "</b></div></div>" : "") + "</div>";
    var tot = '<div class="lsd-tot"><div><span class="eyebrow">Miles</span><b>' + mi(P.km).replace(" mi", "") + "</b></div><div><span class=\"eyebrow\">Driving</span><b>" + lsHm(P.drive_min) + "</b></div><div><span class=\"eyebrow\">On site</span><b>" + lsHm(P.svc_min) + "</b></div><div" + (over ? ' class="over"' : "") + '><span class="eyebrow">Back by</span><b>' + clk(P.finish) + "</b><small>" + (over ? "over the shift by " + lsHm(P.finish - hrs.end) : "shift ends " + clk(hrs.end)) + "</small></div></div>" +
      '<small class="muted">Includes ' + (P.load_min ? lsHm(P.load_min) + " loading at the yard" : "no loading time") + (P.break_min ? ", " + lsHm(P.break_min) + " lunch" : "") + (P.fuel_min ? ", " + lsHm(P.fuel_min) + " at fuel, supply or disposal stops" : "") + (P.wait_min ? ", " + lsHm(P.wait_min) + " waiting for access windows or locked times" : "") + ". Travel labor = driving × " + size + (size === 1 ? " person" : " people") + " in the truck.</small>";
    var acts = '<div class="lsd-racts">' + (dirty ? '<button class="btn sm" data-a="lsxApply" data-o="' + esc(cur.order.join(",")) + '">Save this order for the crew</button><button class="btn ghost sm" data-a="lsxUndo">Undo changes</button>' : !r.saved && !sug ? '<button class="btn ghost sm" data-a="lsxApply" data-o="' + esc(cur.order.join(",")) + '">Save this order for the crew</button>' : "") +
      (P.maps ? '<a class="btn ghost sm" href="' + esc(P.maps) + '" target="_blank" rel="noopener">Open in Google Maps</a>' : "") + "</div>" + (dirty ? '<small class="muted">Your new order isn\'t saved yet. The crew\'s phone and navigation keep the saved order until you save.</small>' : "");
    return head + start + cmp + rowsH + tot + acts + lsDispatchSheet(r, P);
  }
  /* What to load and what to know before the truck leaves. */
  function lsDispatchSheet(r, P) {
    var need = {}, extras = [], access = [], urgent = [], c = lsC(r.crew_id);
    P.rows.forEach(function (x) { if (x.fuel) return; var p = lsP(x.property_id), v = lsV(x.visit_id) || {};
      (x.need || []).forEach(function (e) { var k = e.toLowerCase(); need[k] = need[k] || { e: e, at: [], lack: false }; need[k].at.push(p.name); if ((x.lack || []).indexOf(e) > -1) need[k].lack = true; });
      if (v.kind !== "maintenance") extras.push(p.name + ": " + (v.scope || "work order"));
      if (p.access || x.window || x.fixed) access.push(p.name + ": " + [p.access, x.fixed ? "locked " + clk(hhmm(x.fixed)) : "", x.window ? "window " + (x.window[0] ? clk(hhmm(x.window[0])) : "…") + "–" + (x.window[1] ? clk(hhmm(x.window[1])) : "…") : ""].filter(Boolean).join(" · "));
      lsOpenIss(p).filter(function (i) { return i.urgency === "urgent"; }).forEach(function (i) { urgent.push(p.name + ": " + i.text.slice(0, 100)); }); });
    var ks = Object.keys(need), blk = function (t, l, empty) { return '<div class="lsd-ds"><b>' + t + "</b>" + (l.length ? "<ul>" + l.map(function (x) { return "<li>" + x + "</li>"; }).join("") + "</ul>" : '<p class="muted small">' + empty + "</p>") + "</div>"; };
    return '<div class="lsd-sheet"><div class="lsd-sh"><span class="eyebrow">Before the truck leaves</span>' + (c ? "<small>" + esc(c.name) + (c.vehicle ? " · " + esc(c.vehicle) : "") + "</small>" : "") + "</div>" +
      blk("Load the truck", ks.map(function (k) { return esc(need[k].e) + ' <small class="muted">(' + esc(need[k].at.join(", ")) + ")</small>" + (need[k].lack ? ' <span class="bad-t">not on this crew\'s list</span>' : ""); }), "No special equipment set on these properties (set “Needs on the truck” on a property).") +
      blk("Approved extra work and corrections", extras.map(esc), "Only regular maintenance today.") +
      blk("Access and appointments", access.map(esc), "No gate codes, windows or locked times on these stops.") +
      blk("Urgent client requests", urgent.map(esc), "None.") + "</div>";
  }
  /* ---------- the panel ---------- */
  function lsDispatchPanel() {
    var d = lsMapDayGet(), nAll = S.ls.props.filter(function (p) { return p.status !== "ended"; }).length, nDay = lsDayVisits(d).length, tab = S.lsPTab || "all", mob = S.lsMob || "list";
    return lsYardRow() + lsPinNote() + '<div class="lsd-bar">' + lsDaySel() + lsCrewChips(d) + '<div class="chips lsd-mob">' + [["map", "Map"], ["list", "List"]].map(function (x) { return '<button class="chip' + (mob === x[0] ? " on" : "") + '" data-a="lsxMob" data-v="' + x[0] + '">' + x[1] + "</button>"; }).join("") + "</div></div>" +
      '<div class="lsd-grid mob-' + mob + '"><div class="card lsd-map"><div class="ls-mapbar"><span class="lsd-legend"><i class="lg y">🏠</i> office <i class="lg s">1</i> stops in order <i class="lg o"></i> other properties <i class="lg x">!</i> address incomplete <i class="lg sel"></i> selected + road from the office</span></div><div id="ls-map" data-keep="1"></div></div>' +
      '<div class="card lsd-side"><div class="lsd-tabs" role="tablist"><button role="tab" class="' + (tab === "all" ? "on" : "") + '" data-a="lsxPTab" data-v="all">All properties <span class="count">' + nAll + '</span></button><button role="tab" class="' + (tab === "route" ? "on" : "") + '" data-a="lsxPTab" data-v="route">' + lsDow(d).slice(0, 3) + " " + day(d) + ' route <span class="count">' + nDay + "</span></button></div>" +
      '<div class="lsd-body" data-lenis-prevent>' + (tab === "route" ? lsRouteTab() : lsPropCards()) + "</div></div></div>";
  }
  var _lsSchedule2 = lsSchedule;
  lsSchedule = function () {
    var h = _lsSchedule2.apply(this, arguments);
    if ((S.lsMode || "list") !== "map") return h;
    var i = h.indexOf('<div class="ls-bar"><select data-ls-mapday>'); if (i < 0) i = h.indexOf("<div class=\"ls-yard"); return i < 0 ? h : h.slice(0, i) + lsDispatchPanel();
  };
  /* ---------- the map ---------- */
  function lsPinIcon(cls, txt, col) { return L.divIcon({ className: "ls-pin " + cls, html: "<span" + (col ? ' style="background:' + col + '"' : "") + ">" + txt + "</span>", iconSize: [28, 28], iconAnchor: [14, 14] }); }
  lsMapInit = function () {
    var el = document.getElementById("ls-map"); if (!el || !S.ls) return;
    var go2 = function () {
      var d = lsMapDayGet(), dk = lsDk(), r = lsPlanGet(), sug = r && r.suggested && S.lsShowSug === dk, P = r && !r.err && !r.empty ? (sug ? r.suggested : r.current) : null, c = lsC(S.lsPCrew), col = (c && c.color) || "#2f6db0";
      var key = d + "|" + dk + "|" + (P ? P.order.join(",") + P.poly.length : "-") + "|" + (S.ls.yard ? S.ls.yard.lat : "") + "|" + S.ls.props.length + "|" + S.ls.visits.length;
      if (!el._map) { el._map = L.map(el, { scrollWheelZoom: false }); L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", { maxZoom: 19, attribution: "© OpenStreetMap", referrerPolicy: "strict-origin-when-cross-origin", crossOrigin: false }).addTo(el._map); el._base = L.layerGroup().addTo(el._map); el._sel = L.layerGroup().addTo(el._map); el._marks = {}; }
      var map = el._map;
      if (el.dataset.k !== key) {
        el.dataset.k = key; el._base.clearLayers(); el._marks = {}; var pts = [], onRoute = {};
        if (P) P.rows.forEach(function (x, i) { if (x.fuel) { el._base.addLayer(L.marker([x.lat, x.lon], { icon: lsPinIcon("fuel", "⛽"), zIndexOffset: 550 }).bindTooltip(esc(x.name))); return; }
          var p = lsP(x.property_id); onRoute[p.id] = 1; var ll = [x.lat, x.lon]; pts.push(ll); var n = P.rows.filter(function (y, j) { return j <= i && !y.fuel; }).length;
          var mk = L.marker(ll, { icon: lsPinIcon("", n, col), zIndexOffset: 500 }).bindTooltip(n + ". " + esc(p.name) + " · " + clk(x.arrive)); mk.on("click", function () { lsSelect(p.id, true); }); el._base.addLayer(mk); el._marks[p.id] = mk; });
        if (P && P.poly) el._base.addLayer(L.polyline(lsDecode(P.poly), { color: col, weight: 4, opacity: .8 }));
        else if (pts.length > 1) el._base.addLayer(L.polyline(pts, { color: col, weight: 3, opacity: .7, dashArray: "6 6" }));
        lsDayVisits(d).forEach(function (v) { var p = lsP(v.property_id); if (onRoute[p.id] || !lsHasPin(p) || (v.crew_id || "") === (S.lsPCrew || "")) return; var oc = lsC(v.crew_id); onRoute[p.id] = 1;
          var mk = L.circleMarker([+p.lat, +p.lon], { radius: 9, color: "#fff", weight: 2, fillColor: (oc && oc.color) || "#555", fillOpacity: 1 }).bindTooltip(esc(p.name) + " · " + esc(oc ? oc.name : "No crew")); mk.on("click", function () { lsSelect(p.id, true); }); el._base.addLayer(mk); el._marks[p.id] = mk; });
        S.ls.props.forEach(function (p) { if (!lsHasPin(p) || onRoute[p.id] || p.status === "ended") return; var bad = p.routable === false;
          var mk = bad ? L.marker([+p.lat, +p.lon], { icon: lsPinIcon("approx", "!") }) : L.circleMarker([+p.lat, +p.lon], { radius: 8, color: "#fff", weight: 2, fillColor: "#7d8794", fillOpacity: .95 });
          mk.bindTooltip(esc(p.name) + (bad ? " · approximate location" : "")); mk.on("click", function () { lsSelect(p.id, true); }); el._base.addLayer(mk); el._marks[p.id] = mk; });
        if (S.ls.yard) { var yl = [S.ls.yard.lat, S.ls.yard.lon]; el._base.addLayer(L.marker(yl, { icon: lsPinIcon("yard", "🏠"), zIndexOffset: 600 }).bindTooltip("Office / yard")); }
        var fit = pts.length ? pts.concat(S.ls.yard ? [[S.ls.yard.lat, S.ls.yard.lon]] : []) : S.ls.props.filter(lsHasPin).map(function (p) { return [+p.lat, +p.lon]; });
        if (el.dataset.fit !== d + dk) { el.dataset.fit = d + dk; if (fit.length) map.fitBounds(fit, { padding: [30, 30], maxZoom: 14 }); else map.setView([37.45, -122.15], 10); }
        el.dataset.sel = "";
      }
      lsDrawSel(el);
      setTimeout(function () { map.invalidateSize(); }, 50);
    };
    if (window.L) return go2();
    if (!document.getElementById("leaf-css")) { var l = document.createElement("link"); l.id = "leaf-css"; l.rel = "stylesheet"; l.href = "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.css"; document.head.appendChild(l); }
    if (!document.getElementById("leaf-js")) { var sc = document.createElement("script"); sc.id = "leaf-js"; sc.src = "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.js"; sc.onload = function () { lsMapInit(); }; document.head.appendChild(sc); }
  };
  function lsDrawSel(el) {
    var id = S.lsSel || ""; if (el.dataset.sel === id + "|" + (S.lsLine[id] ? 1 : 0)) return; el.dataset.sel = id + "|" + (S.lsLine[id] ? 1 : 0); el._sel.clearLayers(); if (!id) return;
    var p = lsP(id); if (!lsHasPin(p)) return; var ll = [+p.lat, +p.lon];
    el._sel.addLayer(L.circleMarker(ll, { radius: 21, color: "#e07b00", weight: 5, opacity: 1, fill: true, fillColor: "#e07b00", fillOpacity: .15 }));
    var ln = S.lsLine[id];
    if (S.ls.yard && p.routable !== false) {
      if (ln === undefined && S.lsLineBusy !== id) { S.lsLineBusy = id; call("lsPropLine", { id: id }).then(function (r) { S.lsLine[id] = r; }).catch(function () { S.lsLine[id] = { poly: "" }; }).then(function () { S.lsLineBusy = null; var e2 = document.getElementById("ls-map"); if (e2 && e2._map) lsDrawSel(e2); }); }
      if (ln && ln.poly) el._sel.addLayer(L.polyline(lsDecode(ln.poly), { color: "#e07b00", weight: 5, opacity: 1 }));
      else if (ln) el._sel.addLayer(L.polyline([[S.ls.yard.lat, S.ls.yard.lon], ll], { color: "#e07b00", weight: 4, opacity: 1, dashArray: "10 8" }));
    }
    if (el._selFit !== id) { el._selFit = id; var b = [ll].concat(S.ls.yard ? [[S.ls.yard.lat, S.ls.yard.lon]] : []); el._map.fitBounds(b, { padding: [50, 50], maxZoom: 14 }); }
  }
  function lsSelect(id, fromMap) {
    S.lsSel = S.lsSel === id && !fromMap ? null : id;
    if (fromMap) { var onR = (lsGroups(lsMapDayGet())[S.lsPCrew || ""] || []).some(function (v) { return v.property_id === id; }); S.lsPTab = onR && S.lsPTab === "route" ? "route" : "all"; S.lsMob = "list"; }
    keepScroll(render);
    setTimeout(function () { var c = document.getElementById((S.lsPTab === "route" ? "lsd-r-" : "lsd-p-") + id) || document.getElementById("lsd-p-" + id), body = document.querySelector(".lsd-body"); if (c && body) { body.scrollTop = c.offsetTop - body.offsetTop - 8; } }, 30);
  }
  function lsRefreshPlan() { S.lsPlan = {}; }
  function lsMove(dk, ids) { S.lsOrder[dk] = ids; S.lsShowSug = null; keepScroll(render); }
  root.addEventListener("click", function (e) {
    var b = e.target.closest("[data-a]"); if (!b) return; var a = b.dataset.a;
    if (a === "lsxPlan") { e.preventDefault(); e.stopImmediatePropagation(); S.lsTab = "schedule"; S.lsMode = "map"; S.lsMapDay = b.dataset.d; S.lsPCrew = b.dataset.c || ""; S.lsPTab = "route"; window.scrollTo(0, 0); return keepScroll(render); }
    if (!/^lsx/.test(a)) return;
    var dk = lsDk(), handled = true;
    if (a === "lsxSel") lsSelect(b.dataset.id, false);
    else if (a === "lsxPTab") { S.lsPTab = b.dataset.v; keepScroll(render); }
    else if (a === "lsxMob") { S.lsMob = b.dataset.v; keepScroll(render); }
    else if (a === "lsxCrew") { S.lsPCrew = b.dataset.v; S.lsShowSug = null; keepScroll(render); }
    else if (a === "lsxDay") { S.lsMapDay = b.dataset.v; S.lsShowSug = null; S.lsPCrew = null; keepScroll(render); }
    else if (a === "lsxDayStep") { var nd = lsAddD(lsMapDayGet(), Number(b.dataset.v)); S.lsMapDay = nd; S.lsPCrew = null; S.lsShowSug = null; if (nd < S.ls.from || nd > S.ls.to) { S.lsF = Object.assign({}, S.lsF || {}, { from: lsAddD(nd, -7), to: lsAddD(nd, 21) }); S.lsGen = (S.lsGen || 0) + 1; S.ls = null; S.lsBusy = 0; } keepScroll(render); }
    else if (a === "lsxShowSug") { S.lsShowSug = S.lsShowSug === dk ? null : dk; keepScroll(render); }
    else if (a === "lsxUndo") { delete S.lsOrder[dk]; keepScroll(render); }
    else if (a === "lsxStartReset") { S.lsStart[dk] = Object.assign({}, S.lsStart[dk] || {}, { address: "" }); keepScroll(render); }
    else if (a === "lsxMv") { var r = lsPlanGet(); if (!r || !r.current) return; var o = r.current.order.slice(), i = o.indexOf(b.dataset.id), j = i + Number(b.dataset.dir); if (i < 0 || j < 0 || j >= o.length) return; o.splice(j, 0, o.splice(i, 1)[0]); lsMove(dk, o); }
    else if (a === "lsxLockOpen") { S.lsLock = S.lsLock === b.dataset.id ? null : b.dataset.id; keepScroll(render); }
    else if (a === "lsxLockX") { S.lsLock = null; keepScroll(render); }
    else if (a === "lsxUnlock") run(b, async function () { await call("lsFixTime", { id: b.dataset.id, time: "" }); S.lsLock = null; lsRefreshPlan(); await lsLoad(true); toast("Unlocked"); });
    else if (a === "lsxApply") run(b, async function () { var st = S.lsStart[dk] || {}, r = await call("lsSaveOrder", { date: lsMapDayGet(), crew_id: S.lsPCrew || "", order: b.dataset.o.split(","), start: st.address || undefined, start_time: st.time || undefined }); delete S.lsOrder[dk]; S.lsShowSug = null; lsRefreshPlan(); S.lsRoutes = {}; await lsLoad(true); toast("Saved for the list, the map, the crew's phone and navigation: " + r.stops + " stops · back " + clk(r.finish)); });
    else if (a === "lsxAddRoute") { S.modal = { type: "lsVisit", prop: b.dataset.id, date: lsMapDayGet(), crew: S.lsPCrew || lsP(b.dataset.id).crew_id || "" }; keepScroll(render); }
    else handled = false;
    if (handled) { e.preventDefault(); e.stopImmediatePropagation(); }
  }, true);
  root.addEventListener("change", function (e) {
    var t = e.target; if (!t.matches) return;
    if (t.matches("[data-lsx-day]")) { e.stopImmediatePropagation(); S.lsMapDay = t.value; S.lsPCrew = null; S.lsShowSug = null; return keepScroll(render); }
    if (t.matches("[data-lsx-pf]")) { e.stopImmediatePropagation(); if (t.dataset.lsxPf === "sort") S.lsSort = t.value; else { S.lsPF = Object.assign({}, S.lsPF); S.lsPF[t.dataset.lsxPf] = t.value; } return keepScroll(render); }
  }, true);
  root.addEventListener("input", function (e) { var t = e.target; if (!t.matches || !t.matches("[data-lsx-q]")) return; S.lsQ = t.value; clearTimeout(S.lsQT); S.lsQT = setTimeout(function () { keepScroll(render); }, 150); }, true);
  root.addEventListener("submit", function (e) {
    var f = e.target; if (!f.matches || !f.matches("form[data-form=lsxStart], form[data-form=lsxLock]")) return; e.preventDefault(); e.stopImmediatePropagation();
    var fd = new FormData(f), dk = lsDk();
    if (f.dataset.form === "lsxStart") { var cur = S.lsStart[dk] || {}, ad = String(fd.get("address") || "").trim(); S.lsStart[dk] = { time: String(fd.get("time") || ""), address: ad || cur.address || "" }; return keepScroll(render); }
    run(f.querySelector("[type=submit]"), async function () { await call("lsFixTime", { id: f.dataset.id, time: String(fd.get("time") || "") }); S.lsLock = null; lsRefreshPlan(); await lsLoad(true); toast("Locked at " + clk(hhmm(String(fd.get("time"))))); });
  }, true);
  /* drag and drop to reorder stops (then the route is recalculated, not saved until you save) */
  root.addEventListener("dragstart", function (e) { var r = e.target.closest && e.target.closest(".lsd-trow[data-vid]"); if (!r) return; S.lsDrag = r.dataset.vid; e.dataTransfer.effectAllowed = "move"; try { e.dataTransfer.setData("text/plain", r.dataset.vid); } catch (x) {} r.classList.add("drag"); });
  root.addEventListener("dragover", function (e) { var r = e.target.closest && e.target.closest(".lsd-trow[data-vid]"); if (!r || !S.lsDrag) return; e.preventDefault(); root.querySelectorAll(".lsd-trow.over").forEach(function (x) { x.classList.remove("over"); }); r.classList.add("over"); });
  root.addEventListener("dragend", function () { S.lsDrag = null; root.querySelectorAll(".lsd-trow.over, .lsd-trow.drag").forEach(function (x) { x.classList.remove("over", "drag"); }); });
  root.addEventListener("drop", function (e) {
    var r = e.target.closest && e.target.closest(".lsd-trow[data-vid]"); if (!r || !S.lsDrag) return; e.preventDefault();
    var pl = lsPlanGet(); if (!pl || !pl.current) return; var o = pl.current.order.slice(), i = o.indexOf(S.lsDrag), j = o.indexOf(r.dataset.vid); S.lsDrag = null; if (i < 0 || j < 0 || i === j) return keepScroll(render);
    o.splice(j, 0, o.splice(i, 1)[0]); lsMove(lsDk(), o);
  });
  /* Moving a recurring day: show exactly what changes before anything changes. */
  var _lsModal2 = lsModal;
  lsModal = function (m) {
    if (m.type === "lsVisit" && !m.id && (m.date || m.crew)) { var h0 = _lsModal2.apply(this, arguments); if (m.date) h0 = h0.replace(/name="date" value="[^"]*"/, 'name="date" value="' + esc(m.date) + '"'); if (m.crew) h0 = h0.replace('<option value="' + esc(m.crew) + '">', '<option value="' + esc(m.crew) + '" selected>'); return h0.replace("<h2>One-time visit / work order</h2>", "<h2>Add a visit to the route</h2><p class=\"muted small\">Creates a one-time visit for this day. Pick the type: regular maintenance, billable additional work, or a correction.</p>"); }
    if (m.type !== "lsxMovePrev") return _lsModal2.apply(this, arguments);
    var x = m.data; if (!x) return '<div class="loading">Checking which visits would change…</div>';
    var ds = function (l) { return l.length ? l.map(function (d) { return lsDow(d).slice(0, 3) + " " + day(d); }).join(", ") : "none"; };
    return "<h2>Move " + esc(x.name) + " to " + LS_DAYS[x.to] + "s?</h2>" +
      (!x.allowed ? '<div class="ls-incomplete">⛔ The client only allows ' + esc(lsDaysTxt(x.days_ok)) + ". This move isn't possible unless you change the allowed days on the property first.</div>" : "") +
      (x.multi ? '<div class="ls-incomplete">This property has several service days (' + esc(lsDaysTxt(x.from)) + "). Moving puts all of them on one day.</div>" : "") +
      '<dl class="lsd-mv"><dt>Starts</dt><dd>' + lsDow(x.start) + " " + day(x.start) + "</dd><dt>Visits removed</dt><dd>" + ds(x.remove) + "</dd><dt>Visits added</dt><dd>" + ds(x.add) + "</dd><dt>Staying as they are</dt><dd>" + (x.stay.length ? x.stay.map(function (s) { return lsDow(s.date).slice(0, 3) + " " + day(s.date) + " (" + (s.moved ? "moved by hand" : s.status) + ")"; }).join(", ") : "none") + "</dd></dl>" +
      '<p class="muted small">Only future visits nobody has moved or started change. The client isn\'t notified automatically: tell them about the new day.</p>' +
      '<div class="actions"><button class="btn ghost" data-a="close">Cancel</button>' + (x.allowed ? '<button class="btn" data-a="lsxMoveGo" data-id="' + esc(x.id) + '" data-v="' + x.to + '" data-n="' + esc(x.name) + '">Move to ' + LS_DAYS[x.to] + "s</button>" : "") + "</div>";
  };
  root.addEventListener("click", function (e) {
    var b = e.target.closest("[data-a=lsxMove], [data-a=lsxMoveGo]"); if (!b) return; e.preventDefault(); e.stopImmediatePropagation();
    if (b.dataset.a === "lsxMove") { S.modal = { type: "lsxMovePrev" }; keepScroll(render); call("lsMoveDayPreview", { id: b.dataset.id, weekday: Number(b.dataset.v) }).then(function (r) { if (S.modal && S.modal.type === "lsxMovePrev") { S.modal.data = r; keepScroll(render); } }).catch(function (er) { S.modal = null; toast(er.message); keepScroll(render); }); return; }
    var nm = b.dataset.n, to = LS_DAYS[+b.dataset.v];
    run(b, async function () { await call("lsMoveDay", { id: b.dataset.id, weekday: Number(b.dataset.v) }); S.lsSug = null; lsRefreshPlan(); await lsLoad(true); toast(nm + " is now on " + to + "s");
      S.modal = { type: "lsxNotify", prop: b.dataset.id, subject: "Your maintenance day is changing · " + nm, text: "Hi,\n\nTo serve " + nm + " better, starting next week our crew will come on " + to + "s.\n\nIf that day doesn't work for you, just reply and we'll find another.\n\nThank you,\nBlue Sierra" }; keepScroll(render); });
  }, true);
  var _lsSugCard2 = lsSugCard;
  lsSugCard = function () {
    var h = _lsSugCard2.apply(this, arguments); if (!h || !S.lsSug || !S.lsSug.moves) return h;
    S.lsSug.moves.forEach(function (m) { if (!m.with || !m.with.length) return; var why = "It's " + m.with[0].mi + " mi from " + m.with[0].name + (m.with.length > 1 ? " and near " + m.with.slice(1, 3).map(function (w) { return w.name + " (" + w.mi + " mi)"; }).join(", ") : "") + ", already on " + LS_DAYS[m.to] + "s" + (m.was_with && m.was_with.length > 1 ? ". Today it's on its own trip on " + LS_DAYS[m.from] + "s" : "") + ".";
      h = h.replace("Near " + esc(m.near), esc(why)); });
    return h.replace(/>Move<\/button>/g, ">Review the move</button>");
  };
  /* ======================= batch 3: extra stops, places, crew outcomes, request queue, client messages, seasonal ======================= */
  var LS_XK = { fuel: ["⛽", "Fuel"], supplier: ["🏪", "Supplier"], disposal: ["🗑", "Disposal"] };
  S.lsFuelUI = {};
  function lsPosOpts(P, cur) {
    var stops = P.rows.filter(function (x) { return !x.fuel; }), o = '<option value="0"' + (cur === 0 ? " selected" : "") + ">Before the first stop</option>";
    stops.forEach(function (x, i) { if (i < stops.length - 1) o += '<option value="' + (i + 1) + '"' + (cur === i + 1 ? " selected" : "") + ">After " + esc((lsP(x.property_id).name || "stop " + (i + 1))) + "</option>"; });
    return o + '<option value="' + stops.length + '"' + (cur === stops.length ? " selected" : "") + ">On the way back</option>";
  }
  function lsExtrasPanel(r, P) {
    var dk = lsDk(), ui = S.lsFuelUI[dk] || {}, places = (S.ls.places || []).filter(function (p) { return p.kind !== "fuel"; });
    var h = '<div class="lsd-xbtns"><button class="btn ghost sm" data-a="lsxFuelOpen">⛽ Find fuel along the route</button><button class="btn ghost sm" data-a="lsxSupOpen">🏪 Supplier or 🗑 disposal stop</button></div>';
    if (ui.sup) h += '<div class="lsd-xpanel"><b>Add a supplier or disposal stop</b>' + (places.length ? places.map(function (p) {
      return '<form class="lsd-xrow" data-form="lsxAddPlace" data-id="' + esc(p.id) + '"><div><b>' + LS_XK[p.kind][0] + " " + esc(p.name) + '</b><small class="muted">' + esc(LS_XK[p.kind][1]) + " · " + esc(p.address || "") + (p.hours ? " · " + esc(p.hours) : " · hours not set") + "</small></div>" +
        '<select name="pos">' + lsPosOpts(P, p.kind === "disposal" ? P.rows.filter(function (x) { return !x.fuel; }).length : 0) + '</select><input type="number" name="min" min="5" max="90" value="' + (p.min || 15) + '" title="Minutes there"> min<button class="btn sm" type="submit">Add</button></form>'; }).join("")
      : '<p class="muted small">No suppliers or dump sites saved yet.</p>') + '<button class="link small" data-a="lsxPlacesGo">Manage places</button></div>';
    if (ui.fuel) {
      var res = ui.res, pref = r.fuel_pref || {};
      h += '<div class="lsd-xpanel"><form class="lsd-fopts" data-form="lsxFuelFind"><b>Find fuel</b><label><input type="radio" name="fuel" value="gas"' + ((ui.fuelT || pref.fuel) !== "diesel" ? " checked" : "") + '> Gas</label><label><input type="radio" name="fuel" value="diesel"' + ((ui.fuelT || pref.fuel) === "diesel" ? " checked" : "") + '> Diesel</label>' +
        '<label><input type="checkbox" name="trailer"' + ((ui.trailer != null ? ui.trailer : pref.trailer) ? " checked" : "") + '> Towing a trailer</label><select name="near"><option value="route"' + (ui.near !== "office" ? " selected" : "") + '>Along the route</option><option value="office"' + (ui.near === "office" ? " selected" : "") + '>Near the office</option></select><button class="btn sm" type="submit">Search</button></form>' +
        (!res ? '<p class="muted small">Searches OpenStreetMap for stations, then checks the extra drive with Google.</p>' : res.busy ? '<p class="muted small">Looking for stations…</p>' : res.err ? '<p class="bad-t small">' + esc(res.err) + "</p>" : !res.stations.length ? '<p class="muted small">No stations found there.</p>' :
          res.stations.map(function (st, k) {
            var pl = st.place, rec = st.rec || {}, ver = function (ok, txt) { return '<span class="' + (ok ? "lsd-ok2" : "lsd-chk") + '">' + (ok ? "✓ " : "? ") + txt + "</span>"; };
            var hours = pl && pl.hours ? ver(true, "Hours: " + pl.hours + " (checked by " + (pl.checked_by || "the office") + ")") : st.hours ? ver(false, "Hours listed on OpenStreetMap: " + st.hours + " · confirm") : ver(false, "Hours not listed · call to confirm");
            var fuelT = (ui.fuelT || pref.fuel) === "diesel" ? ((pl && pl.diesel === "yes") || rec.diesel === "yes" ? ver(true, "Diesel (checked by the office)") : st.diesel === "yes" ? ver(false, "Diesel listed on OpenStreetMap · confirm") : ver(false, "Diesel not listed · confirm")) : (st.gas ? ver(false, "Gas listed · confirm") : "");
            var tr = (pl && pl.trailer) || rec.trailer, trT = tr ? ver(tr === "ok", "Truck/trailer: " + { ok: "fits", tight: "tight", no: "no trailer" }[tr] + " (" + esc((pl && pl.checked_by) || rec.by || "office") + ")") : ver(false, "Truck/trailer access not recorded");
            return '<div class="lsd-st"><div class="lsd-sth"><b>⛽ ' + esc(st.name) + "</b>" + (pl && pl.preferred ? '<span class="pill ok">Preferred</span>' : pl ? '<span class="pill">Saved</span>' : "") + '<span class="lsd-det">' + (st.detour_min == null ? "detour —" : "+" + lsHm(st.detour_min) + (st.detour_real ? "" : " (estimate)")) + "</span></div>" +
              '<small class="muted">' + esc(st.addr || "address not listed") + (st.brand && st.brand !== st.name ? " · " + esc(st.brand) : "") + "</small><div class=\"lsd-vers\">" + hours + fuelT + trT + "</div>" +
              (ui.note === k ? '<form class="lsd-note" data-form="lsxFuelNote" data-k="' + k + '">Trailer <select name="trailer"><option value="">not checked</option><option value="ok">fits</option><option value="tight">tight</option><option value="no">no trailer</option></select> Diesel <select name="diesel"><option value="">not checked</option><option value="yes">yes</option><option value="no">no</option></select><input name="note" placeholder="Note (e.g. use the back pumps)"><button class="btn sm" type="submit">Save</button></form>' : "") +
              '<form class="lsd-xrow" data-form="lsxFuelAdd" data-k="' + k + '"><select name="pos">' + lsPosOpts(P, st.pos != null ? st.pos : 0) + '</select><input type="number" name="min" min="5" max="60" value="15" title="Minutes there"> min<button class="btn sm" type="submit">Add to the day</button><button type="button" class="link small" data-a="lsxFuelNoteOpen" data-k="' + k + '">Record access</button>' + (!(pl && pl.preferred) ? '<button type="button" class="link small" data-a="lsxFuelPref" data-k="' + k + '">Make preferred</button>' : "") + "</form></div>";
          }).join("") + '<p class="muted small">Station names and places come from OpenStreetMap contributors; “?” means it still needs checking. ' + esc(res.prices || "Prices aren't shown: no reliable live price source is connected.") + "</p>") + "</div>";
    }
    return h;
  }
  var _lsRouteTab3 = lsRouteTab;
  lsRouteTab = function () {
    var h = _lsRouteTab3.apply(this, arguments), r = lsPlanGet(); if (!r || r.err || r.empty || !r.current) return h;
    var dk = lsDk(), P = r.suggested && S.lsShowSug === dk ? r.suggested : r.current;
    h = h.replace(/<div class="lsd-trow fuel"><span class="ls-stop">⛽<\/span><div><b>([^<]*)<\/b><small class="muted">([^<]*)<\/small><\/div><\/div>/g, function (all, name, info) {
      var x = P.rows.filter(function (y) { return y.fuel && esc(y.name) === name; })[0] || {}, k = LS_XK[x.kind || "fuel"] || LS_XK.fuel;
      return '<div class="lsd-trow fuel"><span class="ls-stop">' + k[0] + '</span><div class="lsd-tmain"><div class="lsd-tt"><b>' + name + '</b><span class="lsd-time">' + info.split(" · ")[0] + '</span></div><small class="muted">' + k[1] + " stop · " + (x.svc || "") + " min" + (x.address ? " · " + esc(x.address) : "") + "</small></div>" + (x.i != null ? '<button class="link small" data-a="lsxStopRm" data-i="' + x.i + '">Remove</button>' : "") + "</div>";
    });
    var i = h.indexOf('<div class="lsd-tot">'); return i < 0 ? h : h.slice(0, i) + lsExtrasPanel(r, P) + h.slice(i);
  };
  /* ---------- Crews tab: the day routine + places ---------- */
  function lsPlacesCard() {
    var cfg = S.ls.day_cfg || { load_min: 15, break_min: 30, break_at: 690 }, admin = S.me && S.me.role === "admin", pl = S.ls.places || [], ba = cfg.break_at, bt = (Math.floor(ba / 60) < 10 ? "0" : "") + Math.floor(ba / 60) + ":" + (ba % 60 < 10 ? "0" : "") + ba % 60;
    return '<div class="section-title" id="ls-places"><h2>The working day & places</h2><span class="muted small">Used by every route</span></div><div class="card lsd-places">' +
      (admin ? '<form class="lsd-routine" data-form="lsxRoutine"><label>Loading at the yard <input type="number" name="load_min" min="0" max="120" value="' + cfg.load_min + '"> min</label><label>Lunch <input type="number" name="break_min" min="0" max="120" value="' + cfg.break_min + '"> min</label><label>after <input type="time" name="break_at" value="' + bt + '"></label><button class="btn sm" type="submit">Save</button></form>'
        : '<p class="small">Loading ' + cfg.load_min + " min · lunch " + cfg.break_min + " min after " + clk(ba) + " (Jesús changes these)</p>") +
      '<p class="muted small">Each crew\'s shift is on the crew. Office address: ' + (S.ls.yard ? esc(S.ls.yard.address) : "not set") + ".</p>" +
      '<div class="ls-list">' + (pl.length ? pl.map(function (p) { var k = LS_XK[p.kind] || LS_XK.supplier; return '<div class="ls-row"><span>' + k[0] + '</span><div class="ls-main"><b>' + esc(p.name) + (p.preferred ? ' <span class="pill ok">Preferred</span>' : "") + '</b><small class="muted">' + esc(k[1]) + " · " + esc(p.address || "") + " · " + (p.min || 15) + " min" + (p.hours ? " · " + esc(p.hours) : "") + (p.trailer ? " · trailer " + esc(p.trailer) : "") + (p.checked_by ? " · checked by " + esc(p.checked_by) + " " + esc(p.checked_at) : "") + '</small></div><button class="link small" data-a="lsxPlaceRm" data-id="' + esc(p.id) + '">Remove</button></div>'; }).join("") : '<p class="muted small">No places yet: add your fuel station, supplier and green-waste / dump site.</p>') + "</div>" +
      '<form class="lsd-placef" data-form="lsxPlace"><select name="kind"><option value="supplier">🏪 Supplier</option><option value="disposal">🗑 Disposal / green waste</option><option value="fuel">⛽ Fuel station</option></select><input name="name" required placeholder="Name"><input name="address" required placeholder="Address, city"><input name="hours" placeholder="Hours (e.g. Mon–Sat 6–4)"><input type="number" name="min" min="5" max="90" placeholder="Minutes there" value="15"><label class="ls-chk"><input type="checkbox" name="preferred" value="1"> Preferred (fuel)</label><button class="btn sm" type="submit">Add place</button></form></div>';
  }
  var _lsCrews3 = lsCrews;
  lsCrews = function () { return _lsCrews3.apply(this, arguments) + lsPlacesCard(); };
  /* ---------- crew phone: the next stop with everything they need ---------- */
  var _lsCrewView3 = lsCrewView;
  lsCrewView = function () {
    var h = _lsCrewView3.apply(this, arguments);
    try {
      var d = S.lsDay || S.ls.today, vs = S.ls.visits.filter(function (v) { return v.date === d && v.status !== "canceled"; }).sort(lsCmp), nx = vs.filter(function (v) { return ["scheduled", "in_progress"].indexOf(v.status) > -1; })[0];
      if (!nx) return h; var p = lsP(nx.property_id), c = lsC(nx.crew_id), lines = [];
      if (p.access) lines.push(["🔑 Access", p.access]); if (p.window_from || p.window_to) lines.push(["🕘 Access window", (p.window_from ? clk(hhmm(p.window_from)) : "any time") + " – " + (p.window_to ? clk(hhmm(p.window_to)) : "end of day")]);
      if (nx.fixed_time) lines.push(["🔒 Appointment", clk(hhmm(nx.fixed_time))]); if (nx.kind !== "maintenance") lines.push([nx.kind === "extra" ? "➕ Approved extra work" : "🔧 Correction", nx.scope || ""]);
      if (p.equipment) lines.push(["🧰 Bring", p.equipment]); if (p.contacts) lines.push(["📞 On site", p.contacts]);
      var todo = (nx.checklist || []).filter(function (x) { return !x.done; }).map(function (x) { return x.t; });
      var card = '<div class="card lsd-next"><span class="eyebrow">' + (nx.status === "in_progress" ? "Working now" : "Next stop") + '</span><h3>' + esc(p.name) + '</h3><small class="muted">' + esc([p.address, p.city].filter(Boolean).join(", ")) + " · " + lsSiteTxt(nx, true) + "</small>" +
        (lines.length ? "<dl>" + lines.map(function (l) { return "<dt>" + l[0] + "</dt><dd>" + esc(l[1]) + "</dd>"; }).join("") + "</dl>" : "") + (todo.length ? '<p class="small"><b>To do:</b> ' + esc(todo.join(" · ")) + "</p>" : "") +
        '<div class="lsc-acts"><a class="btn ghost sm" href="' + esc(lsNav(p)) + '" target="_blank" rel="noopener">🧭 Navigate</a><button class="btn sm" data-a="lsOpenVisit" data-id="' + esc(nx.id) + '">' + (nx.status === "in_progress" ? "Continue" : "Open work order") + "</button></div></div>";
      var i = h.indexOf('<div class="card ls-stopcard'); return i < 0 ? h : h.slice(0, i) + card + h.slice(i);
    } catch (e) { return h; }
  };
  var _lsWorkOrder3 = lsWorkOrder;
  lsWorkOrder = function (v) {
    var h = _lsWorkOrder3.apply(this, arguments); if (!v || ["completed", "canceled"].indexOf(v.status) > -1) return h;
    h = h.replace('data-a="lsCannot"', 'data-a="lsxCannot"').replace('data-a="lsComplete"', 'data-a="lsxComplete"');
    var fu = '<div class="lsd-fu"><label class="f">Anything left after today?<select data-lsx-fu><option value="">No, all done</option><option value="more_time">More time needed next visit</option><option value="another_visit">Another visit needed</option></select></label><input data-lsx-funote placeholder="What\'s left (the office sees this)"></div>';
    if (S.lsCannot === v.id) fu = '<form class="lsd-cannot" data-form="lsxCannot" data-id="' + esc(v.id) + '"><b>What happened?</b>' + [["inaccessible", "Property inaccessible (gate locked, no access)"], ["weather", "Weather delay"], ["equipment", "Equipment problem"], ["other", "Other reason"]].map(function (o, i) { return '<label><input type="radio" name="outcome" value="' + o[0] + '"' + (i ? "" : " checked") + "> " + o[1] + "</label>"; }).join("") +
      '<textarea name="reason" required placeholder="Tell the office what happened"></textarea><div class="actions"><button type="button" class="btn ghost" data-a="lsxCannotX">Back</button><button class="btn" type="submit">Send to the office</button></div></form>';
    var i = h.indexOf('<div class="ls-finish">'); h = i < 0 ? h : h.slice(0, i) + fu + (S.lsCannot === v.id ? "" : h.slice(i)) + (S.lsCannot === v.id ? "</div>" : "");
    return h.replace("Problems found / extra work to recommend (leaks, damaged plants, unsafe branches, gutters, drainage…)", "Extra work to recommend (the office reviews it, nothing is billed until they approve): leaks, damaged plants, unsafe branches…");
  };
  /* ---------- the office's request queue ---------- */
  var LS_IK = { recommendation: "Crew recommendation", followup: "Follow-up from a visit", request: "" };
  function lsChain(i) {
    var c = i.chain; if (!c) return ""; var parts = [];
    if (c.found_id) parts.push('<button class="link small" data-a="lsOpenVisit" data-id="' + esc(c.found_id) + '">found at the ' + day(c.found_date) + " visit</button>");
    if (c.est_id) parts.push('<button class="link small" data-a="lsEstOpen" data-id="' + esc(c.est_id) + '">Estimate v' + (c.est_v || 1) + " · " + esc(c.est_status) + "</button>");
    if (c.visit_id) parts.push('<button class="link small" data-a="lsOpenVisit" data-id="' + esc(c.visit_id) + '">Work order ' + day(c.visit_date) + " · " + esc((LS_ST[c.visit_status] || [c.visit_status])[0]) + "</button>");
    if (c.done_at) parts.push('<button class="link small" data-a="lsOpenVisit" data-id="' + esc(c.visit_id) + '">✓ Report</button>');
    return parts.length ? '<span class="lsd-chain">' + parts.join(" → ") + "</span>" : "";
  }
  var _lsIssueRow3 = lsIssueRow;
  lsIssueRow = function (i) {
    var h = _lsIssueRow3.apply(this, arguments); if (!S.ls || S.ls.role !== "office") return h;
    var extra = (LS_IK[i.kind] ? '<span class="pill warn">' + LS_IK[i.kind] + "</span> " : "") + (i.owner_name ? "👤 " + esc(i.owner_name) : '<span class="muted">no owner</span>') + (i.next_action ? " · next: " + esc(i.next_action) + (i.next_date ? " by " + day(i.next_date) : "") : "") + " " + lsChain(i);
    return h.replace(/(<\/small><\/div>)([^]*)$/, '</small><small class="lsd-iq">' + extra + "</small></div>$2");
  };
  var _lsModal3 = lsModal;
  lsModal = function (m) {
    if (m.type === "lsxNotify") {
      var p = lsP(m.prop);
      return '<h2>Message to the client</h2><p class="muted small">' + esc(p.name) + " · to " + esc(p.client_emails || "no client email yet") + '</p><form class="form" data-form="lsxNotify" data-id="' + esc(m.prop) + '"><label class="f">Subject<input name="subject" required value="' + esc(m.subject || "") + '"></label><label class="f">Message<textarea name="text" rows="8" required>' + esc(m.text || "") + '</textarea></label><p class="muted small">Nothing is sent until you press Send.</p><div class="actions"><button type="button" class="btn ghost" data-a="close">Not now</button><button class="btn" type="submit"' + (p.client_emails ? "" : " disabled") + ">Send</button></div></form>";
    }
    if (m.type === "lsxOpp") {
      return '<h2>Seasonal opportunity</h2><form class="form" data-form="lsxOpp"><label class="f">Property<select name="property_id" required><option value="">Pick…</option>' + S.ls.props.filter(function (p) { return p.status === "active"; }).map(function (p) { return '<option value="' + esc(p.id) + '">' + esc(p.name) + "</option>"; }).join("") + "</select></label>" +
        '<label class="f">Service<input name="service" required placeholder="e.g. Pre-winter pruning"></label><label class="f">Why now<input name="reason" placeholder="e.g. Before the rains"></label><div class="row2"><label class="f">When<input name="timing" placeholder="e.g. December"></label><label class="f">Owner<select name="owner"><option value="">—</option>' + (S.ls.staff || []).map(function (x) { return '<option value="' + esc(x.email) + '">' + esc(x.name) + "</option>"; }).join("") + '</select></label></div><div class="actions"><button type="button" class="btn ghost" data-a="close">Cancel</button><button class="btn" type="submit">Add</button></div></form>';
    }
    var h = _lsModal3.apply(this, arguments);
    if (m.type === "lsTriage") {
      var i = (S.ls.issues || []).filter(function (x) { return x.id === m.id; })[0] || {};
      var who = '<div class="row2"><label class="f">Owner<select name="owner"><option value="">—</option>' + (S.ls.staff || []).map(function (x) { return '<option value="' + esc(x.email) + '"' + (i.owner === x.email ? " selected" : "") + ">" + esc(x.name) + "</option>"; }).join("") + '</select></label><label class="f">Next action<input name="next_action" value="' + esc(i.next_action || "") + '" placeholder="e.g. Send an estimate"></label></div><label class="f">By<input type="date" name="next_date" value="' + esc(i.next_date || "") + '"></label>';
      h = h.replace('<details class="ls-mk"', who + '<details class="ls-mk"');
      h = h.replace("</details>", '<button type="button" class="btn ghost sm" data-a="lsxImpact" data-p="' + esc(i.property_id) + '">See the effect on that day\'s route</button><div id="lsx-impact"></div></details><label class="check-line"><input type="checkbox" name="notify" value="1"> Then write the client a message</label>');
      if (i.chain && !i.chain.visit_id && i.visit_id) h = h.replace('<details class="ls-mk">', '<details class="ls-mk" open>').replace("<summary>Work order already created</summary>", "<summary>Create a work order</summary>").replace('<input type="checkbox" name="make_visit">', '<input type="checkbox" name="make_visit" checked>');
      if (LS_IK[i.kind]) h = h.replace("</p><p>", '</p><p><span class="pill warn">' + LS_IK[i.kind] + "</span></p><p>");
      if (i.chain && (i.chain.est_id || i.chain.visit_id)) h = h.replace('<div class="ls-agree">', '<p class="small">Where it stands: ' + lsChain(i) + '</p><div class="ls-agree">');
    }
    return h;
  };
  /* ---------- seasonal opportunities ---------- */
  var LS_OST = { idea: ["Idea", ""], proposed: ["Estimate sent", "warn"], approved: ["Approved", "ok"], scheduled: ["Scheduled", "ok"], done: ["Done", "ok"], declined: ["Declined", "bad"], dropped: ["Dropped", ""] };
  function lsOppsSection() {
    var list = (S.ls.opps || []).filter(function (o) { return o.status !== "dropped"; }), open = list.filter(function (o) { return ["idea", "proposed"].indexOf(o.status) > -1; }).length;
    return '<div class="section-title"><h2>Seasonal opportunities</h2><span class="lsd-oppb"><button class="btn ghost sm" data-a="lsxOppSuggest">Suggest for this season</button><button class="btn sm" data-a="modal" data-m="lsxOpp">＋ Opportunity</button></span></div>' +
      (list.length ? '<div class="card ls-list">' + list.slice(0, 30).map(function (o) { var p = lsP(o.property_id), st = LS_OST[o.status] || [o.status, ""];
        return '<div class="ls-row"><div class="ls-main"><b>' + esc(o.service) + " · " + esc(p.name || "") + '</b><small class="muted">' + esc([o.timing, o.reason].filter(Boolean).join(" · ")) + "</small><small>👤 <select class=\"lsd-own\" data-lsx-oppowner=\"" + esc(o.id) + "\"><option value=\"\">no owner</option>" + (S.ls.staff || []).map(function (x) { return '<option value="' + esc(x.email) + '"' + (o.owner === x.email ? " selected" : "") + ">" + esc(x.name) + "</option>"; }).join("") + "</select>" +
          (o.est_id ? ' · <button class="link small" data-a="lsEstOpen" data-id="' + esc(o.est_id) + '">estimate</button>' : "") + (o.visit_id ? ' · <button class="link small" data-a="lsOpenVisit" data-id="' + esc(o.visit_id) + '">work order ' + day(o.visit_date) + "</button>" : "") + "</small></div>" +
          '<span class="pill ' + st[1] + '">' + st[0] + "</span>" + (o.status === "idea" ? (S.ls.money ? '<button class="btn sm" data-a="lsxOppEst" data-id="' + esc(o.id) + '">Write estimate</button>' : "") + '<button class="link small" data-a="lsxOppSet" data-id="' + esc(o.id) + '" data-s="dropped">Drop</button>' : "") + "</div>"; }).join("") + "</div>" + '<p class="muted small">' + open + " open. The same service can't be proposed twice for a property within the season; approving the estimate schedules the work.</p>"
        : '<div class="empty">No opportunities yet. “Suggest for this season” looks at each property\'s features and the month (pruning before the rains, irrigation, leaf cleanup, mulch…).</div>');
  }
  var _lsDash3 = lsDash;
  lsDash = function () { var h = _lsDash3.apply(this, arguments); return h.replace(/<div class="section-title"><h2>Seasonal opportunities<\/h2><\/div><div class="card ls-soon">[\s\S]*?<\/div>/, lsOppsSection()); };
  var _lsEstEditor3 = lsEstEditor;
  lsEstEditor = function (m) {
    var h = _lsEstEditor3.apply(this, arguments), o = m.opp ? (S.ls.opps || []).filter(function (x) { return x.id === m.opp; })[0] : null; if (!o) return h;
    return h.replace('data-form="lsEst" data-issue="', 'data-form="lsEst" data-opp="' + esc(o.id) + '" data-issue="').replace('name="title" required value=""', 'name="title" required value="' + esc(o.service) + '"').replace('<textarea name="scope" required rows="4"></textarea>', '<textarea name="scope" required rows="4">' + esc(o.service + (o.reason ? ". " + o.reason : "")) + "</textarea>");
  };
  /* ---------- actions ---------- */
  function lsPlanNow() { var r = lsPlanGet(); return r && r.current ? (r.suggested && S.lsShowSug === lsDk() ? r.suggested : r.current) : null; }
  root.addEventListener("click", function (e) {
    var b = e.target.closest("[data-a]"); if (!b) return; var a = b.dataset.a, dk, ui;
    var mine = /^lsx(FuelOpen|SupOpen|StopRm|FuelNoteOpen|FuelPref|PlacesGo|PlaceRm|Cannot|CannotX|Complete|Impact|OppSuggest|OppEst|OppSet)$/; if (!mine.test(a)) return; e.preventDefault(); e.stopImmediatePropagation();
    if (a === "lsxFuelOpen" || a === "lsxSupOpen") { dk = lsDk(); ui = S.lsFuelUI[dk] = S.lsFuelUI[dk] || {}; if (a === "lsxFuelOpen") ui.fuel = !ui.fuel; else ui.sup = !ui.sup; return keepScroll(render); }
    if (a === "lsxStopRm") return run(b, async function () { await call("lsStopRemove", { date: lsMapDayGet(), crew_id: S.lsPCrew || "", i: Number(b.dataset.i) }); S.lsPlan = {}; keepScroll(render); toast("Stop removed"); });
    if (a === "lsxFuelNoteOpen") { ui = S.lsFuelUI[lsDk()]; ui.note = ui.note === +b.dataset.k ? null : +b.dataset.k; return keepScroll(render); }
    if (a === "lsxFuelPref") { var st = S.lsFuelUI[lsDk()].res.stations[+b.dataset.k];
      return run(b, async function () { await call("lsSavePlace", { place: { kind: "fuel", name: st.name, address: st.addr || "", lat: st.lat, lon: st.lon, osm_id: st.id, preferred: true, hours: st.place ? st.place.hours : undefined } }); await lsLoad(true); S.lsFuelUI[lsDk()].res = null; toast(st.name + " is your preferred station"); }); }
    if (a === "lsxPlacesGo") { S.lsTab = "crews"; S.flash = "ls-places"; return keepScroll(render); }
    if (a === "lsxPlaceRm") return sure("Remove this place? Routes already planned keep their stops.", function () { call("lsSavePlace", { place: { id: b.dataset.id, remove: true } }).then(function () { return lsLoad(true); }).then(function () { toast("Removed"); }).catch(function (er) { toast(er.message); }); });
    if (a === "lsxCannot") { S.lsCannot = b.dataset.id; return keepScroll(render); }
    if (a === "lsxCannotX") { S.lsCannot = null; return keepScroll(render); }
    if (a === "lsxComplete") {
      var f = root.querySelector("form[data-form=lsLabor]"), lab = f ? [].map.call(f.querySelectorAll("input[type=number]"), function (x) { return { email: x.name, min: Number(x.value) || 0 }; }).filter(function (l) { return l.min > 0; }) : [];
      var notes = (root.querySelector("[data-ls-notes]") || {}).value, problems = (root.querySelector("[data-ls-problems]") || {}).value, fu = (root.querySelector("[data-lsx-fu]") || {}).value || "", fun = (root.querySelector("[data-lsx-funote]") || {}).value || "", vid = b.dataset.id;
      if (fu && !fun.trim()) return toast("Say what's left to do, so the office can plan it.");
      return run(b, async function () {
        var r = await call("lsVisitUpdate", { id: vid, act: "complete", labor: lab, notes: notes, problems: problems, followup: fu || undefined, followup_note: fun });
        if (problems && problems.trim()) await call("lsReportIssue", { property_id: r.visit.property_id, visit_id: vid, text: problems.trim(), urgency: "normal", recommend: true }).catch(function () {});
        S.modal = null; lsApplyVisit(r.visit); toast("Visit completed ✓" + (fu ? " · the office will plan what's left" : "") + (problems && problems.trim() ? " · recommendation sent for review" : ""));
      });
    }
    if (a === "lsxImpact") {
      var fm = b.closest("form"), out = document.getElementById("lsx-impact"), dd = fm.querySelector("[name=date]").value, cr = fm.querySelector("[name=crew_id]").value; out.innerHTML = '<p class="muted small">Planning that day…</p>';
      return call("lsInsertImpact", { property_id: b.dataset.p, date: dd, crew_id: cr }).then(function (r) {
        var A = r.after, B = r.before, over = A.finish > r.end;
        out.innerHTML = '<div class="lsd-imp' + (over || A.late ? " bad" : "") + '"><b>' + lsDow(dd) + " " + day(dd) + ": stop " + r.position + " of " + A.stops + "</b><br>Driving " + lsHm(B.drive_min) + " → <b>" + lsHm(A.drive_min) + "</b> (+" + lsHm(Math.max(0, A.drive_min - B.drive_min)) + ") · back " + (B.finish ? clk(B.finish) : "—") + " → <b>" + clk(A.finish) + "</b>" +
          (over ? '<br><span class="bad-t">Over the shift by ' + lsHm(A.finish - r.end) + "</span>" : "") + (A.late ? '<br><span class="bad-t">' + A.late + " stop(s) would be late</span>" : "") + (!r.routable ? '<br><span class="bad-t">This property\'s address is incomplete, so its driving isn\'t counted.</span>' : "") + (r.real ? "" : "<br><small>Estimated times</small>") + "</div>";
      }).catch(function (er) { out.innerHTML = '<p class="bad-t small">' + esc(er.message) + "</p>"; });
    }
    if (a === "lsxOppSuggest") return run(b, async function () { var r = await call("lsSuggestOpps", {}); await lsLoad(true); toast(r.made ? r.made + " opportunities suggested" : "Nothing new for this season"); });
    if (a === "lsxOppEst") { S.modal = { type: "lsEst", opp: b.dataset.id, prop: ((S.ls.opps || []).filter(function (o) { return o.id === b.dataset.id; })[0] || {}).property_id }; return keepScroll(render); }
    if (a === "lsxOppSet") return run(b, async function () { await call("lsSaveOpp", { opp: { id: b.dataset.id, status: b.dataset.s } }); await lsLoad(true); toast("Updated"); });
  }, true);
  root.addEventListener("change", function (e) { var t = e.target; if (!t.matches || !t.matches("[data-lsx-oppowner]")) return; e.stopImmediatePropagation();
    call("lsSaveOpp", { opp: { id: t.dataset.lsxOppowner, owner: t.value } }).then(function () { (S.ls.opps || []).forEach(function (o) { if (o.id === t.dataset.lsxOppowner) { o.owner = t.value; } }); toast("Owner saved"); }).catch(function (er) { toast(er.message); }); }, true);
  root.addEventListener("submit", function (e) {
    var f = e.target; if (!f.matches || !f.matches("form[data-form=lsxAddPlace], form[data-form=lsxFuelFind], form[data-form=lsxFuelAdd], form[data-form=lsxFuelNote], form[data-form=lsxRoutine], form[data-form=lsxPlace], form[data-form=lsxCannot], form[data-form=lsxNotify], form[data-form=lsxOpp]")) return;
    e.preventDefault(); e.stopImmediatePropagation(); var fd = new FormData(f), k = f.dataset.form, btn = f.querySelector("[type=submit]"), dk = lsDk(), ui = S.lsFuelUI[dk] = S.lsFuelUI[dk] || {};
    var V = function (n) { return String(fd.get(n) == null ? "" : fd.get(n)).trim(); };
    if (k === "lsxAddPlace") return run(btn, async function () { await call("lsStopAdd", { date: lsMapDayGet(), crew_id: S.lsPCrew || "", place_id: f.dataset.id, pos: Number(V("pos")), min: Number(V("min")) }); S.lsPlan = {}; ui.sup = false; keepScroll(render); toast("Stop added to the day"); });
    if (k === "lsxFuelFind") { ui.fuelT = V("fuel"); ui.trailer = !!fd.get("trailer"); ui.near = V("near"); ui.res = { busy: 1 }; keepScroll(render); var r0 = lsPlanNow();
      return call("lsFuelFind", { date: lsMapDayGet(), crew_id: S.lsPCrew || "", fuel: ui.fuelT, trailer: ui.trailer, near: ui.near, order: r0 ? r0.order : undefined }).then(function (r) { ui.res = r; }).catch(function (er) { ui.res = { err: er.message, stations: [] }; }).then(function () { keepScroll(render); }); }
    if (k === "lsxFuelAdd") { var st = ui.res.stations[+f.dataset.k];
      return run(btn, async function () { await call("lsFuelSet", { date: lsMapDayGet(), crew_id: S.lsPCrew || "", station: { id: st.id, name: st.name, lat: st.lat, lon: st.lon, addr: st.addr }, pos: Number(V("pos")), min: Number(V("min")) }); S.lsPlan = {}; ui.fuel = false; keepScroll(render); toast("⛽ " + st.name + " added to the day"); }); }
    if (k === "lsxFuelNote") { var s2 = ui.res.stations[+f.dataset.k];
      return run(btn, async function () { var body = { trailer: V("trailer"), diesel: V("diesel"), note: V("note") };
        if (s2.place) await call("lsSavePlace", { place: { id: s2.place.id, trailer: body.trailer, diesel: body.diesel, notes: body.note } }); else await call("lsFuelNote", Object.assign({ id: s2.id, name: s2.name }, body));
        s2.rec = { trailer: body.trailer, diesel: body.diesel, note: body.note, by: S.me.name }; if (s2.place) { s2.place.trailer = body.trailer; s2.place.diesel = body.diesel; } ui.note = null; keepScroll(render); toast("Recorded"); }); }
    if (k === "lsxRoutine") return run(btn, async function () { var r = await call("lsSettings", { load_min: Number(V("load_min")), break_min: Number(V("break_min")), break_at: V("break_at") }); S.ls.day_cfg = { load_min: r.cfg.load_min, break_min: r.cfg.break_min, break_at: r.cfg.break_at }; S.lsPlan = {}; keepScroll(render); toast("Saved: every route uses it"); });
    if (k === "lsxPlace") return run(btn, async function () { await call("lsSavePlace", { place: { kind: V("kind"), name: V("name"), address: V("address"), hours: V("hours"), min: Number(V("min")) || 15, preferred: !!fd.get("preferred") } }); await lsLoad(true); toast("Place added"); });
    if (k === "lsxCannot") return run(btn, async function () { var oc = V("outcome"), r = await call("lsVisitUpdate", { id: f.dataset.id, act: "cannot", outcome: oc === "other" ? undefined : oc, reason: V("reason"), status: oc === "weather" ? "weather" : "blocked" }); S.lsCannot = null; S.modal = null; lsApplyVisit(r.visit); toast("Sent to the office. It's on their Needs attention list."); });
    if (k === "lsxNotify") return run(btn, async function () { var r = await call("lsNotifyClient", { property_id: f.dataset.id, subject: V("subject"), text: V("text") }); S.modal = null; keepScroll(render); toast("Sent to " + r.sent + " client email" + (r.sent === 1 ? "" : "s")); });
    if (k === "lsxOpp") return run(btn, async function () { await call("lsSaveOpp", { opp: { property_id: V("property_id"), service: V("service"), reason: V("reason"), timing: V("timing"), owner: V("owner") } }); S.modal = null; await lsLoad(true); toast("Opportunity added"); });
  }, true);
  liveLoop();
  if (S.token) { render(); route(); } else render();
})();
