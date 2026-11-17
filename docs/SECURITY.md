# Security checklist: JobSearch Pal

*Run through this in `/prepare-release`. Most items are enforced automatically by `npm run verify`.*

| Check | How it's enforced |
|---|---|
| Permissions are exactly [activeTab, scripting, storage, sidePanel, alarms, notifications], no host permissions or content scripts | `scripts/check-dist.ts` (verify) |
| No HTML sinks (`innerHTML`, `outerHTML`, `insertAdjacentHTML`, `document.write`, `DOMParser`) | ESLint (verify) |
| No eval, `new Function`, remote scripts or imports | ESLint + `check-dist.ts` |
| Strict extension-page CSP | `check-dist.ts` |
| Messages only from this extension, validated before use | `src/background/router.ts` + handler validators |
| Data read from storage, messages and files is validated | code review: every read goes through a parser |
| No secrets in the repo (`.env`, keys) | `.gitignore`; review `git ls-files` |
| Dependencies have no known vulnerabilities | `npm audit` |
| Any new permission or data collection has an ADR in DECISIONS.md and is reflected in PRIVACY.md | review |
