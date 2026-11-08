/* ======================================================================================================
   Today: the office's work queue. Every item is DERIVED from a real record (a message, a visit, a request,
   an estimate, a proposal, an expense), so nothing is copied, duplicated or left out of date. The only thing
   stored is what a person decides about an item: who owns it, until when it's snoozed, and a note (TodayState).
   "Ready to operate": the missing data that keeps the portal from running the business, counted from the
   records themselves. Nothing here fills a gap with an assumption.
   Office (staff) only. Money items only for #money. Deployed concatenated after Growth.gs.
   ====================================================================================================== */
TABLES.TodayState = ["key", "owner", "snooze_until", "note", "updated_at", "updated_by"];
var TD_OPEN_VISIT = function (v) { return ["completed", "canceled", "skipped"].indexOf(v.status) < 0; };
function tdNeed(me) { if (!me || !isStaff(me) || me.preview) throw new Error("Today is for the Blue Sierra office."); }
function tdHoursSince(at) { var d = new Date(String(at || "").replace(" ", "T")); return isNaN(d) ? 0 : (Date.now() - d.getTime()) / 36e5; }
function tdDaysSince(at) { return tdHoursSince(at) / 24; }
function tdAgo(at) { var h = tdHoursSince(at); return h < 1 ? "less than an hour ago" : h < 48 ? Math.round(h) + " h ago" : Math.round(h / 24) + " days ago"; }
function tdStaffEmail(e) { var p = e ? findBy("People", "email", normEmail(e)) : null; return p && isTrue(p.active) && isStaff(p) ? p.email : ""; }

/* Every rule in one place. Each item: what happened, on which record, who owns it, the next action, and where to open it. */
function tdItems(me) {
  var money = canMoney(me), today = lsDay(new Date()), in7 = lsAdd(today, 7), out = [];
  var add = function (x) { x.owner = tdStaffEmail(x.owner); out.push(x); };
  var projects = {}; rows("Projects").filter(function (p) { return p.status === "active" || !p.status; }).forEach(function (p) { projects[p.id] = p; });
  // 1. Projects: a client or architect wrote and nobody on the team answered (per chat channel, last message wins)
  var last = {}; rows("Messages").forEach(function (m) { if (!projects[m.project_id]) return; var k = m.project_id + "|" + (m.channel || "client"); if (!last[k] || String(m.at) > String(last[k].at)) last[k] = m; });
  Object.keys(last).forEach(function (k) {
    var m = last[k], h = tdHoursSince(m.at), p = projects[m.project_id], ch = m.channel || "client";
    if (["client", "architect"].indexOf(m.role) < 0 || h < 4 || h > 24 * 30) return;
    add({ key: "msg:" + m.project_id + ":" + ch, kind: "message", area: "projects", priority: h > 24 ? 1 : 2, title: (m.author || "The client") + " is waiting for an answer",
      sub: p.name + " · " + (/^dm:/.test(ch) ? "private chat" : ch + " chat"), why: "“" + String(m.text || "(attachment)").slice(0, 90) + "” · " + tdAgo(m.at) + ", no reply from the team", next: "Reply in the chat",
      since: m.at, link: { type: "project", pid: p.id, tab: "messages", ch: ch } });
  });
  // 2. Projects: a question we asked the client is still open (a client decision)
  rows("Messages").forEach(function (m) {
    if (m.kind !== "question" || m.status !== "open" || !projects[m.project_id] || tdDaysSince(m.at) < 2) return;
    add({ key: "q:" + m.id, kind: "decision", area: "projects", priority: tdDaysSince(m.at) > 7 ? 2 : 3, title: "Waiting on the client's decision", sub: projects[m.project_id].name,
      why: "“" + String(m.text || "").slice(0, 90) + "” · asked " + tdAgo(m.at), next: "Follow up with the client", owner: m.author_email, since: m.at, link: { type: "project", pid: m.project_id, tab: "messages", ch: "client" } });
  });
  // 3. Projects: checklist items past due
  rows("Checklist").forEach(function (c) {
    if (!projects[c.project_id] || isTrue(c.done) || !/^\d{4}-\d\d-\d\d$/.test(String(c.due || "")) || c.due >= today) return;
    add({ key: "chk:" + c.id, kind: "overdue", area: "projects", priority: 2, title: "Checklist item past due", sub: projects[c.project_id].name, why: "“" + String(c.item || "").slice(0, 90) + "” was due " + c.due,
      next: "Finish it or move the date", owner: c.assignee || c.owner, due: c.due, since: c.edited_at, link: { type: "project", pid: c.project_id, tab: "checklist" } });
  });
  // 4. Maintenance: visits in the next 7 days with no crew (one item per day)
  var props = {}; rows("LsProps").filter(function (p) { return p.status === "active" && !isTrue(p.sample); }).forEach(function (p) { props[p.id] = p; });
  var noCrew = {}; rows("LsVisits").forEach(function (v) { if (!props[v.property_id] || isTrue(v.sample) || !TD_OPEN_VISIT(v) || v.crew_id || v.date < today || v.date > in7) return; (noCrew[v.date] = noCrew[v.date] || []).push(v); });
  Object.keys(noCrew).sort().forEach(function (d) {
    var l = noCrew[d];
    add({ key: "nocrew:" + d, kind: "dispatch", area: "maintenance", priority: d <= lsAdd(today, 1) ? 1 : 2, title: l.length + " visit" + (l.length > 1 ? "s" : "") + " with no crew · " + lsDowName(d) + " " + d,
      sub: l.slice(0, 4).map(function (v) { return props[v.property_id].name; }).join(", ") + (l.length > 4 ? " +" + (l.length - 4) : ""), why: "Nobody is assigned, so these visits can't be dispatched", next: "Assign a crew", due: d, link: { type: "lsday", date: d } });
  });
  // 5. Maintenance: visits whose day passed and were never closed
  rows("LsVisits").forEach(function (v) {
    if (!props[v.property_id] || isTrue(v.sample) || !TD_OPEN_VISIT(v) || v.date >= today || v.date < lsAdd(today, -30)) return;
    add({ key: "late:" + v.id, kind: "overdue", area: "maintenance", priority: 2, title: "Visit not closed", sub: props[v.property_id].name + " · " + v.date, why: "The day passed and it isn't completed, skipped or moved", next: "Close it with its outcome or reschedule", due: v.date, link: { type: "lsday", date: v.date, visit: v.id } });
  });
  // 6. Maintenance: requests with no owner, or past their next-action date
  rows("LsIssues").forEach(function (i) {
    if (isTrue(i.sample) || ["new", "review"].indexOf(i.status) < 0) return; var p = props[i.property_id]; if (!p) return;
    var overdue = i.next_date && i.next_date < today, urgent = i.urgency === "urgent";
    if (i.owner && !overdue) return;
    add({ key: "req:" + i.id, kind: "request", area: "maintenance", priority: urgent ? 1 : overdue ? 2 : 2, title: (urgent ? "Urgent request" : "Request") + (i.owner ? " past its date" : " with no owner"), sub: p.name + " · from " + (i.by_name || "someone"),
      why: "“" + String(i.text || "").slice(0, 90) + "” · " + tdAgo(i.at), next: i.next_action || "Acknowledge it, pick an owner and the next step", owner: i.owner, due: i.next_date || "", since: i.at, link: { type: "requests" } });
  });
  // 7. Maintenance: estimates / change orders waiting on the client
  rows("LsEstimates").forEach(function (e) {
    if (isTrue(e.sample) || e.status !== "sent" || tdDaysSince(e.sent_at) < 5) return; var p = props[e.property_id]; if (!p) return;
    add({ key: "est:" + e.id, kind: "decision", area: "maintenance", priority: 3, title: "Estimate waiting on the client", sub: p.name + " · " + (e.title || "estimate"), why: "Sent " + tdAgo(e.sent_at) + ", no decision yet", next: "Follow up with the client", owner: e.created_by, since: e.sent_at, link: { type: "estimates" } });
  });
  // 8. Money: crew expenses waiting for review (#money only)
  if (money) { var pend = rows("LsExpenses").filter(function (x) { return x.status === "pending" && !isTrue(x.sample); });
    if (pend.length) add({ key: "exp:pending", kind: "review", area: "money", priority: pend.some(function (x) { return tdDaysSince(x.at) > 2; }) ? 2 : 3, title: pend.length + " crew expense" + (pend.length > 1 ? "s" : "") + " to review", sub: "Maintenance · costs",
      why: "They don't count in costs until someone approves or rejects them", next: "Approve or reject with the receipt", since: pend.map(function (x) { return x.at; }).sort()[0], link: { type: "costs" } }); }
  // 9–13. Growth: overdue next steps, proposals to review/finish/follow, failed sends, deadlines
  var opps = {}; rows("GrOpps").filter(function (o) { return o.status !== "deleted" && ["won", "lost", "later"].indexOf(o.stage) < 0; }).forEach(function (o) { opps[o.id] = o; });
  Object.keys(opps).forEach(function (id) {
    var o = opps[id];
    if (o.next_date && o.next_date < today) add({ key: "opp:" + o.id, kind: "overdue", area: "growth", priority: 2, title: "Sales next step is late", sub: o.name, why: (o.next_action || "Next step") + " was due " + o.next_date, next: o.next_action || "Do the next step or change the date", owner: o.owner, due: o.next_date, link: { type: "opp", id: o.id, sub: "overview" } });
    [["rfp_due", "RFP due"], ["board_date", "Board decision"], ["walk_date", "Site walk"]].forEach(function (f) { var d = o[f[0]];
      if (d && d >= today && d <= lsAdd(today, 3)) add({ key: "dl:" + o.id + ":" + f[0], kind: "deadline", area: "growth", priority: 1, title: f[1] + " " + (d === today ? "today" : "on " + lsDowName(d) + " " + d), sub: o.name, why: "Deadline from the opportunity", next: "Make sure everything is ready", owner: o.owner, due: d, link: { type: "opp", id: o.id, sub: "overview" } }); });
  });
  var props2 = rows("GrProposals"), sends = rows("GrOutbox");
  props2.forEach(function (p) {
    var o = opps[p.opp_id]; if (!o) return;
    if (p.status === "review") add({ key: "prop:" + p.id + ":review", kind: "approval", area: "growth", priority: 2, authority: true, title: "Proposal v" + p.version + " waiting for approval", sub: o.name, why: "Only Jesús or #money approve proposals", next: "Review and approve, or send back with a note", owner: tdAdminEmail(), since: p.created_at, link: { type: "opp", id: o.id, sub: "proposal" } });
    if (p.status === "draft" && tdDaysSince(p.created_at) >= 3) add({ key: "prop:" + p.id + ":draft", kind: "finish", area: "growth", priority: 3, title: "Proposal v" + p.version + " still a draft", sub: o.name, why: "Started " + tdAgo(p.created_at), next: "Finish it and send it to internal review", owner: p.created_by, since: p.created_at, link: { type: "opp", id: o.id, sub: "proposal" } });
    if (p.status === "approved") add({ key: "prop:" + p.id + ":pdf", kind: "finish", area: "growth", priority: 2, title: "Approved proposal v" + p.version + " needs its final PDF", sub: o.name, why: "Approved " + tdAgo(p.reviewed_at), next: "Make the final PDF and email it", owner: p.created_by, since: p.reviewed_at, link: { type: "opp", id: o.id, sub: "proposal" } });
    if (p.status === "sent" && tdDaysSince(p.sent_at) >= 7) add({ key: "prop:" + p.id + ":follow", kind: "follow", area: "growth", priority: 3, title: "Follow up on proposal v" + p.version, sub: o.name, why: "Sent " + tdAgo(p.sent_at) + ", no answer recorded", next: "Follow up (there's a draft for it)", owner: o.owner, since: p.sent_at, link: { type: "opp", id: o.id, sub: "proposal" } });
  });
  sends.forEach(function (m) {
    if (["failed", "partial", "pending"].indexOf(m.status) < 0 || !opps[m.opp_id]) return;
    var p = m.proposal_id ? findBy("GrProposals", "id", m.proposal_id) : null; if (p && ["sent", "accepted"].indexOf(p.status) > -1) return;   // a later send already reached everyone
    var bad = parseJson(m.recipients, []).filter(function (x) { return x.status !== "accepted"; });
    add({ key: "send:" + m.id, kind: "failed", area: "growth", priority: 1, title: "Email didn't reach " + bad.map(function (x) { return x.email; }).join(", "), sub: opps[m.opp_id].name + " · " + m.subject, why: m.last_error || "Not sent", next: "Fix the address or retry", owner: m.created_by, since: m.updated_at, link: { type: "opp", id: m.opp_id, sub: "proposal" } });
  });
  return out;
}
function tdAdminEmail() { var a = rows("People").filter(function (p) { return p.role === "admin" && isTrue(p.active); })[0]; return a ? a.email : ""; }
function lsDowName(d) { var x = lsParse(d); return x ? ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][x.getDay()] : ""; }

/* "Ready to operate": each group counts what's missing in the records, says who usually fixes it and opens the place to fix it. */
function tdReady(me) {
  var props = rows("LsProps").filter(function (p) { return p.status === "active" && !isTrue(p.sample); }), recur = props.filter(function (p) { return p.freq && p.freq !== "none"; });
  var crews = rows("LsCrews").filter(function (c) { return !isTrue(c.sample); }), today = lsDay(new Date()), in21 = lsAdd(today, 21), live = {}; props.forEach(function (p) { live[p.id] = p; });
  var noCrew = rows("LsVisits").filter(function (v) { return live[v.property_id] && !isTrue(v.sample) && TD_OPEN_VISIT(v) && !v.crew_id && v.date >= today && v.date <= in21; });
  var names = function (l) { return l.map(function (p) { return { id: p.id, name: p.name }; }); };
  var projs = rows("Projects").filter(function (p) { return p.status === "active" || !p.status; }), people = rows("People").filter(function (x) { return isTrue(x.active) && isOutside(x); }), plans = rows("Plans");
  var noOutside = projs.filter(function (p) { return !people.some(function (x) { return splitIds(x.project_ids).indexOf(p.id) > -1; }); }), noPlans = projs.filter(function (p) { return !plans.some(function (x) { return x.project_id === p.id; }); });
  var rates = parseJson(PropertiesService.getScriptProperties().getProperty("GR_RATES"), null), creds = grCredsValid(), kinds = {}; creds.forEach(function (c) { kinds[c.kind] = 1; });
  var crewBad = crews.filter(function (c) { return !splitIds(c.members).length || !c.vehicle || !lsCrewHours(c).set; });
  var g = [
    { key: "crews", title: "Crews", owner: "Jesús or dispatcher", total: Math.max(1, crews.length), done: crews.length - crewBad.length, todo: crews.length ? crewBad.map(function (c) { return { id: c.id, name: c.name + ": " + [!splitIds(c.members).length ? "no members" : "", !c.vehicle ? "no vehicle" : "", !lsCrewHours(c).set ? "no shift hours" : ""].filter(Boolean).join(", ") }; }) : [{ id: "", name: "No crews yet: create them with members, vehicle and shift hours" }], link: { type: "lstab", tab: "crews" } },
    { key: "assign", title: "Visits with a crew (next 3 weeks)", owner: "Dispatcher", total: noCrew.length + rows("LsVisits").filter(function (v) { return live[v.property_id] && TD_OPEN_VISIT(v) && v.crew_id && v.date >= today && v.date <= in21; }).length, done: 0, todo: noCrew.length ? [{ id: "", name: noCrew.length + " visits have no crew" }] : [], link: { type: "lstab", tab: "schedule" } },
    { key: "labor", title: "Time on site confirmed", owner: "Jesús or the foreman", total: recur.length, todo: names(recur.filter(function (p) { return !isTrue(p.labor_ok); })), link: { type: "lstab", tab: "props" } },
    { key: "price", title: "Agreement prices", owner: "Jesús", total: recur.length, todo: names(recur.filter(function (p) { return !num(p.price); })), link: { type: "lstab", tab: "props" } },
    { key: "address", title: "Addresses the route can use", owner: "Office", total: props.length, todo: names(props.filter(function (p) { return !lsRoutable(p); })), link: { type: "lstab", tab: "props" } },
    { key: "client_email", title: "Client contact email", owner: "Office", total: props.length, todo: names(props.filter(function (p) { return !String(p.client_emails || "").trim(); })), link: { type: "lstab", tab: "props" } },
    { key: "creds", title: "License and insurance (verified, current)", owner: "Jesús", total: 2, done: (kinds.license ? 1 : 0) + (kinds.insurance ? 1 : 0), todo: [!kinds.license ? { id: "", name: "C-27 license" } : null, !kinds.insurance ? { id: "", name: "Insurance certificate" } : null].filter(Boolean), link: { type: "grtab", tab: "set" } },
    { key: "rates", title: "Estimate rates checked against real production", owner: "Jesús", total: 1, done: rates && rates.reviewed_at ? 1 : 0, todo: rates && rates.reviewed_at ? [] : [{ id: "", name: rates ? "Rates were changed but never marked as checked" : "Still the starting values" }], note: rates && rates.reviewed_at ? "Checked " + rates.reviewed_at : "", link: { type: "grtab", tab: "set" } },
    { key: "outside", title: "Construction projects with the client or architect invited", owner: "PM", total: projs.length, todo: names(noOutside), link: { type: "projects" } },
    { key: "plans", title: "Construction projects with plans uploaded", owner: "PM", total: projs.length, todo: names(noPlans), link: { type: "projects" } }
  ];
  g.forEach(function (x) { if (x.done == null) x.done = Math.max(0, x.total - x.todo.length); if (x.key === "assign") x.done = Math.max(0, x.total - noCrew.length); x.ok = x.todo.length === 0 && x.total > 0; });
  return { groups: g, done: g.filter(function (x) { return x.ok; }).length, total: g.length };
}

ACTIONS.todayQueue = function (me, b) {
  tdNeed(me); var today = lsDay(new Date()), st = {}; rows("TodayState").forEach(function (s) { st[s.key] = s; });
  var items = tdItems(me), snoozed = 0, seen = {};
  items = items.filter(function (x) { if (seen[x.key]) return false; seen[x.key] = 1; return true; }).map(function (x) {
    var s = st[x.key]; if (s) { if (s.owner) x.owner = tdStaffEmail(s.owner); x.note = s.note || ""; x.snooze_until = s.snooze_until || ""; x.state_by = s.updated_by ? personName(s.updated_by) : ""; }
    x.owner_name = x.owner ? personName(x.owner) : ""; x.mine = x.owner === me.email; x.authority = !!x.authority; return x;
  }).filter(function (x) { if (x.snooze_until && x.snooze_until > today && !b.show_snoozed) { snoozed++; return false; } return true; })
    .sort(function (a, c) { return (a.priority - c.priority) || String(a.due || "9").localeCompare(String(c.due || "9")) || String(a.since || "").localeCompare(String(c.since || "")); });
  return { items: items, snoozed: snoozed, ready: tdReady(me), computed_at: now(), today: today, me: me.email, admin: me.role === "admin", money: canMoney(me),
    staff: rows("People").filter(function (x) { return isTrue(x.active) && isStaff(x); }).map(function (x) { return { email: x.email, name: x.name }; }) };
};
NO_LOCK.todayQueue = 1;
/* Who owns an item, snooze it until a date, or a note. Repeating the same request changes nothing. */
ACTIONS.todaySet = function (me, b) {
  tdNeed(me); var key = String(b.key || ""); if (!/^[a-z]+:[\w:.-]{1,90}$/.test(key)) throw new Error("Unknown item.");
  var cur = findBy("TodayState", "key", key), patch = { updated_at: now(), updated_by: me.email };
  if (b.owner !== undefined) { var o = String(b.owner || ""); if (o && !tdStaffEmail(o)) throw new Error("Pick someone on the team."); patch.owner = o ? normEmail(o) : ""; }
  if (b.snooze_until !== undefined) { var d = String(b.snooze_until || ""), today = lsDay(new Date()); if (d && (!/^\d{4}-\d\d-\d\d$/.test(d) || d <= today || d > lsAdd(today, 60))) throw new Error("Snooze to a date in the next 60 days."); patch.snooze_until = d; }
  if (b.note !== undefined) patch.note = clean(b.note, 300);
  if (cur) update("TodayState", "key", key, patch); else insert("TodayState", Object.assign({ key: key, owner: "", snooze_until: "", note: "" }, patch));
  return { key: key };
};
PREFETCH.todayQueue = ["People", "Projects", "Messages", "Checklist", "Plans", "TodayState"].concat(LS_TABLES, GR_TABLES);
PREFETCH.todaySet = ["People", "TodayState"];
/* Saving the estimate rates as Jesús now records the date they were checked (feeds "Ready to operate"). */
var _grRatesToday = ACTIONS.grRates;
ACTIONS.grRates = function (me, b) {
  var r = _grRatesToday(me, b);
  if (b.save && b.reviewed) { var pr = PropertiesService.getScriptProperties(), cur = parseJson(pr.getProperty("GR_RATES"), {}); cur.reviewed_at = lsDay(new Date()); cur.reviewed_by = me.email; pr.setProperty("GR_RATES", JSON.stringify(cur)); }
  var o = parseJson(PropertiesService.getScriptProperties().getProperty("GR_RATES"), {}); if (r.rates) { r.rates.reviewed_at = o.reviewed_at || ""; } return r;
};
