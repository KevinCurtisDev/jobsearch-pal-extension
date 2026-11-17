---
paths:
  - "src/background/**"
  - "src/shared/messages.ts"
---
# background and messaging
- Register listeners synchronously at the top level; keep no state in memory (the worker stops when idle). Persist with the storage module if needed.
- New message: a type + validator in the feature's file, `on(type, validator, handler)`; check the sender (`isExtensionPage`, or `sender.tab` + `frameId === 0` for page scripts).
- Handlers return plain data; the router wraps it as `{ ok, data }` or `{ ok: false, error }`.
