# Spec: JobSearch Pal

*Source of truth for what the extension does. Short, numbered, testable. Update it before changing behaviour.*

## 1. Summary
Save job posts from the page you're on, track each application's status, set reminders, back up and export. Free and local-only.

## 2. Users and main flow
⟨Who clicks what, in 3–6 steps.⟩

## 3. MVP features (each must be testable)
- F1 ⟨feature⟩: ⟨acceptance criteria⟩

## 4. Later (not in the MVP)
- ⟨feature⟩

## 5. Permissions and privacy
- Permission budget: [activeTab, scripting, storage] (`extension.config.json`). Any change needs an ADR in DECISIONS.md.
- Data stays on the device unless stated here. No analytics, no remote code.

## 6. Security rules
- No HTML sinks; build DOM with createElement + textContent.
- Validate everything read from storage, messages and files.

## 7. Non-goals
- ⟨what we deliberately don't do⟩
