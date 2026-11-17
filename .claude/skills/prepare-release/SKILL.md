---
name: prepare-release
description: Prepare a Chrome Web Store release package and checklist for this extension. Never uploads, publishes, pushes or tags without explicit approval. Use only when the owner asks to prepare a release.
argument-hint: "<version, e.g. 1.0.0>"
disable-model-invocation: true
---
Prepare release **$ARGUMENTS** for the Chrome Web Store. Work only inside this repository.
**Never** upload, publish, submit, `git push`, merge to main or tag without the owner's explicit yes.

1. Check the working tree is clean (`git status`). If not, ask what to do.
2. Run `/verify-extension` steps 1–2 (all automated checks must be green, including `npm run test:e2e` if present).
3. `node scripts/bump.ts $ARGUMENTS`; add a `## $ARGUMENTS` entry to CHANGELOG.md summarising
   user-visible changes since the last release (from `git log` and docs/PROGRESS.md).
4. Draft or update `docs/STORE_LISTING.md` (detailed description from SPEC.md; permission
   justifications are prefilled) and `docs/PRIVACY.md`. Leave ⟨placeholders⟩ only for facts you can't know
   (support email, URLs, screenshots) and list them for the owner.
5. `npm run package`, then commit (`chore(release): $ARGUMENTS`) and run `node scripts/release-check.ts`.
6. Report:
   - the zip path and size, and what `release-check.ts` still flags (e.g. placeholder icons);
   - the manual checks from `docs/QA.md` the owner must do in Chrome with the built `dist/`;
   - the owner's submission steps from `docs/RELEASE.md` step 6;
   - then ask: "Shall I merge to main and tag v$ARGUMENTS locally?" Do nothing more until they answer.
