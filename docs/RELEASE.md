# Release checklist: JobSearch Pal

*`/prepare-release <version>` does steps 1–5 and stops. You do step 6 yourself.*

1. All tasks for the release are done; `npm run verify` green and `npm run test:e2e` green.
2. Version set everywhere: `node scripts/bump.ts <version>`; CHANGELOG.md entry written.
3. Your own icons in `public/icons/` (16, 32, 48, 128 px PNG); store screenshots ready (1280×800).
4. `docs/STORE_LISTING.md` and `docs/PRIVACY.md` filled in; manual checks in `docs/QA.md` done.
5. `npm run package` → `release/jobsearch-pal-<version>.zip`, then `node scripts/release-check.ts` passes.
6. **You** upload the zip in the Chrome Web Store Developer Dashboard (https://chrome.google.com/webstore/devconsole),
   paste the listing and privacy answers, and submit for review. Claude never publishes.
