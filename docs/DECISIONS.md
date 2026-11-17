# Decisions: JobSearch Pal

*One entry per decision, 8 lines or fewer. Newest last. Never rewrite an accepted entry; supersede it.*

## ADR-001 Generated from chrome-extension-factory 0.4.0
- **Status:** accepted
- **Decision:** start from the factory core with modules: e2e-playwright, page-inject, storage. Permission budget [activeTab, scripting, storage].
- **Why:** shared, tested build, lint, security and packaging setup; least-privilege permissions.
- **Consequences:** factory updates are applied manually (see the factory's VERSIONING guide); this repo is independent.
