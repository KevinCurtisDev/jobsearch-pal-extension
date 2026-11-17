---
paths:
  - "src/**"
---
# Product rules (X1–X11, P1–P12)

From `docs/source/PLANNING-CLAUDE.md` §2, renamed (ADR-008) and adapted (`docs/DECISIONS.md`). A rule
here never overrides CLAUDE.md's hard rules. Gate status and gaps: `docs/RECONCILE.md` §2.

## Extension rules
- **X1** The local edition makes no network requests: no fetch, XHR, WebSocket, EventSource, sendBeacon, analytics, fonts or CDNs.
- **X2** No remote code. Everything executable is bundled; data packs ship with releases.
- **X3** Nothing injected or read on linkedin.com, indeed.com (all country subdomains) or glassdoor.*. There, capture uses only the tab URL and title plus what the user types or pastes.
- **X4** Read a page only on a user action (or a declared career-site pattern, not used in Phase 1). Never in the background, across tabs or in bulk.
- **X5** Never submit anything for the user. No `submit()`, `requestSubmit()` or synthetic clicks on page controls.
- **X6** Never autofill or store special category fields (diversity, disability, ethnicity, gender identity, religion, health).
- **X7** Never invent experience. Any generated or rearranged text passes the no-invention guard in `src/core`.
- **X8** Every score shows reasons, source and confidence, and a waiting state until its data gate is met. Uncalibrated thresholds are never shown as numbers.
- **X8a** Never call a vacancy a "scam" or a "ghost job". Show signals and let the user decide.
- **X9** The user owns the data: one-click export (JSON, CSV), one-click delete, optional passphrase-encrypted backup, a "what is stored" screen.
- **X10** Minimum permissions, each justified in `docs/STORE_LISTING.md` and `docs/PRIVACY.md`. No `<all_urls>`; no host permissions without an ADR.
- **X11** In-page hide or highlight only on Tier A sites the user enabled one by one; never on X3 sites. Ids are ULIDs. The append-only event log is the source of truth; other state is a projection rebuildable from it.
- **Core purity:** `src/core` uses no `chrome`, `window`, `document` or browser-only modules (ADR-005).
- **Free for life:** never move a shipped local feature behind a paywall.

## Platform rules (as they apply to this extension)
- **P1** Rules and data decide; AI only writes (no AI in the local edition).
- **P2** No auto-apply: the user always submits on the employer's site.
- **P3** No scraping of LinkedIn or any site whose terms forbid it (see X3, X4).
- **P4** Never invent experience (see X7).
- **P5** Every score is explained, calibrated and honest about uncertainty (see X8).
- **P6** No face, emotion or appearance analysis.
- **P7** Privacy: never sell data; one-click export and delete; consent before any data leaves the device (not possible in the local edition).
- **P8** Accessibility: WCAG 2.2 AA. Real buttons, links and labels; visible focus; 44 px targets; meaning never by colour alone; works in a 320 px side panel.
- **P9** Secure defaults: page data is hostile (text only, `textContent`); every message validated and sender-checked; storage access level `TRUSTED_CONTEXTS`.
- **P10** Badges are earned, never bought.
- **P11** Cost-efficient by default: no servers in the local edition.
- **P12** GDPR by design: no personal data in logs (ids only); privacy policy and store declarations match what the code does.
