# Manual QA in Chrome: JobSearch Pal

*Automated tests run in Chromium; these checks are for real Chrome on your computer. Tick them before
each release and note the Chrome version. Never tick a check you haven't done.*

Setup: `npm run build`, then `chrome://extensions` → Developer mode → **Load unpacked** → this
project's `dist/` folder (from Windows: `\\wsl.localhost\Ubuntu\<project path>\dist`). After a
rebuild, click the reload icon on the extension card, then reload the test tab.

## Every release
- [x] Installs with no unexpected permission warning (permissions: activeTab, scripting, storage, sidePanel, alarms, notifications).
- [x] No errors on the extension card or in its service worker console (`chrome://extensions` → Inspect views).
- [x] Works on 3 real sites (e.g. a news site, a web app, a documentation page).
- [x] The extension runs on a normal web page when you click it (toolbar icon; there is no popup). *(page-inject)*
- [x] Clicking it on chrome://extensions or the Chrome Web Store shows a clear explanation, not an error. *(page-inject)*
- [x] Clicking it twice on the same page doesn't create a second copy. *(page-inject)*
- [x] Data survives closing and reopening Chrome. *(storage)*

## M0 Gates and platform
- [x] `chrome://extensions` shows the name "JobSearch Pal: Job Application Tracker" (not "(dev)" in a `npm run package` build). *(T0.3)*
- [x] Clicking the toolbar icon on a job page opens the side panel, which shows the brand name and an empty state, and the page capture still runs. *(T0.4)*
- [x] Installing shows the warnings expected for the six permissions (notifications; reading on the active tab only) and nothing about "all sites". *(T0.4)*
- [x] Service worker console (Inspect views) shows no errors after install and after one capture; the Network tab shows no external requests. *(T0.5, T0.6)*

## M1 Vertical slice
- [x] **S13 spike (T1.1), repeat in desktop Chrome.** Expected: the panel click is refused, as in Chromium 158.
  1. Open any https page (e.g. `https://example.com`), click the toolbar icon: the side panel opens.
  2. In the same tab go to a different site (e.g. `https://example.org`). This ends the click's access.
  3. Right-click inside the side panel → Inspect → Console. Paste the `INSTALL_PROBE` snippet from `tests/e2e/spike-s13.spec.ts` (the code between the backticks); Chrome may ask you to type `allow pasting` first. An "S13 probe" button appears in the panel.
  4. Click the button with the mouse, then run `window.__s13` in the console. Expected: `ok: false` and "Cannot access contents of the page".
  5. With `openPanelOnActionClick` on: `chrome://extensions` → JobSearch Pal → "service worker" → Console: `chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true })`. Repeat steps 1–4 (expected the same). Then reload the extension on `chrome://extensions`; it sets the setting back to off.
  6. Note your Chrome version and the two `window.__s13` results in the table below.

- [x] **Capture and save (T1.5, T1.6).** On a real Greenhouse job post, click the toolbar icon: the side panel shows "Review this job" with the title and company filled in. Click **Save job**: it appears under "Saved jobs" with "Status: Saved".
- [x] **LinkedIn (T1.5).** On a linkedin.com job post, click the icon: the panel explains that only the address and title are saved, and nothing on the page changes. Paste the description, save: it is listed.
- [x] **Keyboard at 320 px (T1.6, F8).** Make the side panel as narrow as it goes. With Tab, Shift+Tab and Enter only, edit a field, save, export and import: every control is reachable, focus is always visible, nothing is cut off.
- [x] **Backup round trip (T1.7).** Click **Export backup**: a file `jobsearch-pal-backup-<date>.json` downloads (no permission prompt). Remove the extension, load it again, import the file: the dry-run shows "New jobs: N", click **Import**, the jobs are back. Import the same file again: "Nothing new to import".
- [x] **Bad backup (T1.7).** Edit one character in an exported file and import it: a plain message says the file was changed; nothing is added.
- [x] **Offline (X1).** In the service worker and panel DevTools Network tabs, capture, save, export and import: no external requests.

### M1 bundle baseline (T1.8, `npm run measure` after `npm run build`, 2026-11-17)
Production build; limits are set from this baseline (SPEC §6).

| File | Bytes | Gzip |
|---|---:|---:|
| background.js | 143,335 | 47,294 |
| sidepanel.js | 149,714 | 49,329 |
| page.js | 38,857 | 13,115 |
| sidepanel.html, tokens.css, ui/tokens.css, manifest.json, messages.json | 10,166 | 3,113 |
| **Total** | **342,072** | **112,851** |

## Results
| Date | Chrome version | Checks | Notes |
|---|---|---|---|
| 2026-11-17 | not noted | Every release + M0 (all) | Owner: everything works. Side panel shows brand + empty state only, as expected for M0. |
| 2026-11-17 | 158 | M1 (all) | Owner: all M1 checks pass. S13: both `window.__s13` results `ok: false` (openPanelOnActionClick off and on), same as Chromium 158 headless. First try did nothing because Chrome still ran a stale `dist/`; fixed by reloading the extension. |
