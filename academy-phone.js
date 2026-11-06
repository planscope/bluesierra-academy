/* Blue Sierra Academy — phone layer for the setter workspace.
   With a RingCentral client ID (window.BSA_SETTINGS.ringcentralClientId), it loads RingCentral's official
   Embeddable widget (v3.0.0, pinned) so calls are made from the browser and every call's start, end and
   duration are reported to the workspace. Without it, "Call" opens the phone's tel: handler (the RingCentral
   app, if it's installed as the default) and the workspace times the call itself.
   Docs: https://ringcentral.github.io/ringcentral-embeddable/docs/integration/api/ and /events/ */
(function () {
  "use strict";
  var SET = window.BSA_SETTINGS || {};
  var CLIENT_ID = String(SET.ringcentralClientId || "").trim();
  var VERSION = "3.0.0";
  var listeners = [];
  var state = { mode: CLIENT_ID ? "ringcentral" : "tel", loaded: false, loggedIn: false, connected: false, current: null };

  function emit(type, detail) { listeners.forEach(function (fn) { try { fn(type, detail || {}); } catch (e) {} }); }
  function digits(n) { return String(n || "").replace(/[^\d+]/g, ""); }
  function e164(n) { var d = digits(n).replace(/^\+?1?(\d{10})$/, "+1$1"); return /^\+\d{10,15}$/.test(d) ? d : digits(n); }
  function frame() { return document.querySelector("#rc-widget-adapter-frame"); }
  function now() { return Date.now(); }
  function callNumber(call) {
    if (!call) return "";
    var to = call.to && (call.to.phoneNumber || call.to.extensionNumber) || call.toNumber || call.to;
    return digits(typeof to === "string" ? to : "");
  }
  function sameNumber(a, b) { a = digits(a).slice(-10); b = digits(b).slice(-10); return a && b && a === b; }

  function load() {
    if (state.mode !== "ringcentral" || state.loaded) return;
    state.loaded = true;
    var s = document.createElement("script");
    s.src = "https://apps.ringcentral.com/integration/ringcentral-embeddable/" + VERSION + "/adapter.js" +
      "?clientId=" + encodeURIComponent(CLIENT_ID) + "&defaultCallWith=browser&disableMeeting=true&disableGlip=true";
    s.async = true;
    s.onerror = function () { state.mode = "tel"; emit("status", { error: "RingCentral didn't load. Calls will open your phone app." }); };
    document.head.appendChild(s);

    window.addEventListener("message", function (e) {
      // Only accept messages from RingCentral's widget frame.
      if (e.origin !== "https://apps.ringcentral.com") return;
      var d = e.data; if (!d || typeof d.type !== "string") return;
      switch (d.type) {
        case "rc-login-status-notify": state.loggedIn = !!d.loggedIn; emit("status", {}); break;
        case "rc-webphone-connection-status-notify": state.connected = d.connectionStatus === "connectionStatus-connected"; emit("status", {}); break;
        case "rc-call-init-notify":
        case "rc-call-start-notify": {
          var n = callNumber(d.call), cur = state.current;
          if (cur && (!n || sameNumber(n, cur.number))) {
            if (d.type === "rc-call-start-notify" && !cur.connectedAt) cur.connectedAt = now();
            cur.rcId = cur.rcId || (d.call && (d.call.id || d.call.sessionId || d.call.telephonySessionId)) || "";
            emit("call", { phase: d.type === "rc-call-start-notify" ? "connected" : "dialing", call: cur });
          }
          break;
        }
        case "rc-call-end-notify": {
          var cur2 = state.current, n2 = callNumber(d.call);
          if (cur2 && (!n2 || sameNumber(n2, cur2.number))) finish(cur2, "ringcentral", d.call);
          break;
        }
      }
    });
  }

  function finish(cur, source, raw) {
    if (!cur || cur.endedAt) return;
    cur.endedAt = now();
    var reported = raw && Number(raw.duration);
    // Talk time: RingCentral's own duration when it gives one, otherwise from connect (or dial) to hang-up.
    cur.seconds = reported > 0 ? Math.round(reported) : Math.max(0, Math.round((cur.endedAt - (cur.connectedAt || cur.startedAt)) / 1000));
    cur.source = source;
    state.current = null;
    emit("call", { phase: "ended", call: cur });
  }

  window.BSA_PHONE = {
    mode: function () { return state.mode; },
    status: function () { return { mode: state.mode, loggedIn: state.loggedIn, connected: state.connected, inCall: !!state.current }; },
    on: function (fn) { listeners.push(fn); },
    init: load,
    /* Start a call to a firm. meta = { row, firm } so the workspace can tie the call to the call list. */
    call: function (number, meta) {
      var n = e164(number);
      if (!digits(n)) throw new Error("This firm has no phone number on the list.");
      if (state.current && !state.current.endedAt) finish(state.current, state.current.source || state.mode, null);
      state.current = { number: n, row: meta && meta.row, firm: meta && meta.firm, startedAt: now(), connectedAt: 0, endedAt: 0, seconds: 0, source: state.mode };
      if (state.mode === "ringcentral" && frame()) {
        frame().contentWindow.postMessage({ type: "rc-adapter-new-call", phoneNumber: n, toCall: true }, "https://apps.ringcentral.com");
      } else {
        state.mode = state.mode === "ringcentral" && !frame() ? "tel" : state.mode;
        state.current.source = "tel";
        var a = document.createElement("a"); a.href = "tel:" + n; a.style.display = "none"; document.body.appendChild(a); a.click(); a.remove();
      }
      emit("call", { phase: "dialing", call: state.current });
      return state.current;
    },
    /* For tel: calls the browser can't see the hang-up, so the setter presses "End call". */
    end: function () { if (state.current) finish(state.current, state.current.source || "tel", null); },
    current: function () { return state.current; }
  };
  if (state.mode === "ringcentral") {
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", load); else load();
  }
})();
