# Product brief: JobSearch Pal

*One page. The owner approves it; `/plan-feature` turns it into SPEC.md and TASKS.md.*

- **One-line pitch:** Save job posts from the page you're on, track each application's status, set reminders, back up and export. Free and local-only.
- **Who it's for:** Job seekers applying to many roles across job boards and company career sites who want one private place to track them.
- **Problem it solves:** Applications get scattered across tabs, boards and spreadsheets; people lose track of where they applied, what stage each is at and when to follow up.
- **MVP features (what a first user must be able to do):**
  - Save the posting on the current page with one click: reads schema.org JobPosting data and supported job-board pages, only when the user clicks
  - Side panel listing saved jobs with an editable application status (saved, applied, interviewing, offer, rejected, withdrawn) and notes
  - Per-application follow-up reminders shown as Chrome notifications
  - Back up and restore all data as a JSON file, and export to CSV
  - Everything stored locally in chrome.storage; no network requests
- **Out of scope for v1:**
  - Any network requests, servers, accounts or sync services
  - AI features of any kind
  - Auto-applying, form filling or submitting anything on the user's behalf
  - Background reading of pages or always-on content scripts / host permissions
  - sidePanel, alarms and notifications permissions until the owner approves them as planned tasks
- **Free vs paid:** Free
- **Constraints:** permissions [activeTab, scripting, storage, sidePanel, alarms, notifications] (ADR-006); no server, accounts or analytics unless decided in DECISIONS.md.
