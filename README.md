# Blue Sierra Academy and client portal

Two pages on bluesierracorp.com, loaded from this repo through GitHub Pages.

**/academy** (team): onboarding portal for Blue Sierra Construction hires: login (Memberstack), employee info, the Appointment Setter course, practice, certification, and a call log tied to the Setter Call List.

The Webflow pages load these files from GitHub Pages (planscope.github.io/bluesierra-academy), so a push here updates the site within about 10 minutes.

| File | What it is |
|---|---|
| `academy.css` | Styles, all scoped to `#bs-academy` |
| `academy-content.js` | Course content and settings (public: never put secrets here) |
| `academy-phone.js` | Phone layer: RingCentral Embeddable when configured, otherwise tel: links |
| `academy-workspace.js` | Workspace tab (shift clock, call queue, call/email, checked-off list) and Report tab (timesheet) |
| `academy-app.js` | The portal engine |
| `apps-script/Code.gs`, `apps-script/Workspace.gs` | Standalone Apps Script for the Setter Call List (calls, shifts, email, report) |
| `portal.css`, `portal-app.js` | **/portal** (clients): project photos, updates, questions by email, invoices, messages, checklist |
| `apps-script/Portal.gs` | Google Apps Script backend for /portal (private Sheet + Drive + Gmail) |
| `portal-mock.js`, `portal-preview.html` | Preview with fictional data. Never loaded on the live site |
| `webflow-loader.html` | What goes in the Webflow page |
| `INSTALAR.md` | Setup guide (Spanish) |

Per-person data lives in Memberstack custom fields. Each person's call-log key goes in their Memberstack `call-key` field; the backend keeps only SHA-256 hashes of keys in its own Script Properties, never in the Sheet. Photo links and the Apps Script URL are set in the Webflow page (`window.BSA_SETTINGS`), not here.
