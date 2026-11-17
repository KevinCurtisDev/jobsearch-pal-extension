# Manual QA in Chrome: JobSearch Pal

*Automated tests run in Chromium; these checks are for real Chrome on your computer. Tick them before
each release and note the Chrome version. Never tick a check you haven't done.*

Setup: `npm run build`, then `chrome://extensions` → Developer mode → **Load unpacked** → this
project's `dist/` folder (from Windows: `\\wsl.localhost\Ubuntu\<project path>\dist`). After a
rebuild, click the reload icon on the extension card, then reload the test tab.

## Every release
- [ ] Installs with no unexpected permission warning (permissions: activeTab, scripting, storage).
- [ ] No errors on the extension card or in its service worker console (`chrome://extensions` → Inspect views).
- [ ] Works on 3 real sites (e.g. a news site, a web app, a documentation page).
- [ ] The extension runs on a normal web page when you click it (toolbar icon, or Run on this page in the popup). *(page-inject)*
- [ ] Clicking it on chrome://extensions or the Chrome Web Store shows a clear explanation, not an error. *(page-inject)*
- [ ] Clicking it twice on the same page doesn't create a second copy. *(page-inject)*
- [ ] Data survives closing and reopening Chrome. *(storage)*

## Results
| Date | Chrome version | Checks | Notes |
|---|---|---|---|
