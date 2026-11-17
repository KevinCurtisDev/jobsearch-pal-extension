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
- [ ] **S13 spike (T1.1), repeat in desktop Chrome.** Expected: the panel click is refused, as in Chromium 158.
  1. Open any https page (e.g. `https://example.com`), click the toolbar icon: the side panel opens.
  2. In the same tab go to a different site (e.g. `https://example.org`). This ends the click's access.
  3. Right-click inside the side panel → Inspect → Console. Paste the `INSTALL_PROBE` snippet from `tests/e2e/spike-s13.spec.ts` (the code between the backticks); Chrome may ask you to type `allow pasting` first. An "S13 probe" button appears in the panel.
  4. Click the button with the mouse, then run `window.__s13` in the console. Expected: `ok: false` and "Cannot access contents of the page".
  5. With `openPanelOnActionClick` on: `chrome://extensions` → JobSearch Pal → "service worker" → Console: `chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true })`. Repeat steps 1–4 (expected the same). Then reload the extension on `chrome://extensions`; it sets the setting back to off.
  6. Note your Chrome version and the two `window.__s13` results in the table below.

## Results
| Date | Chrome version | Checks | Notes |
|---|---|---|---|
| 2026-11-17 | not noted | Every release + M0 (all) | Owner: everything works. Side panel shows brand + empty state only, as expected for M0. |
