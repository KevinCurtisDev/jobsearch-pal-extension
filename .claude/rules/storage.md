---
paths:
  - "src/storage/**"
---
# storage module
- Every key is declared with `defineKey(area, name, parse, fallback)`; `parse` returns `null` for anything invalid. Never call `chrome.storage` directly elsewhere.
- `sync`: 8 KB per key, 100 KB total. Keep large or frequently written data in `local`.
- Changing a stored shape: keep the key name, accept the old shape in the parser (no silent data loss).
