# Blue Sierra Academy and client portal

Two pages on bluesierracorp.com, loaded from this repo through jsDelivr.

**/academy** (team): onboarding portal for Blue Sierra Construction hires: login (Memberstack), employee info, the Appointment Setter course, practice, certification, and a call log tied to the Setter Call List.

The Webflow page `/academy` loads these files from jsDelivr, so a push here updates the site (after the jsDelivr cache is purged).

| File | What it is |
|---|---|
| `academy.css` | Styles, all scoped to `#bs-academy` |
| `academy-content.js` | Course content and settings (public: never put secrets here) |
| `academy-calls.js` | Calls tab (setter) and Report tab (admin) |
| `academy-app.js` | The portal engine |
| `apps-script/Code.gs` | Google Apps Script for the Setter Call List |
| `portal.css`, `portal-app.js` | **/portal** (clients): project photos, updates, questions by email, invoices, messages, checklist |
| `apps-script/Portal.gs` | Google Apps Script backend for /portal (private Sheet + Drive + Gmail) |
| `portal-mock.js`, `portal-preview.html` | Preview with fictional data. Never loaded on the live site |
| `webflow-loader.html` | What goes in the Webflow page |
| `INSTALAR.md` | Setup guide (Spanish) |

Per-person data lives in Memberstack custom fields. Access keys for the call log live in the Sheet's "Setters" tab. Photo links and the Apps Script URL are set in the Webflow page (`window.BSA_SETTINGS`), not here.
