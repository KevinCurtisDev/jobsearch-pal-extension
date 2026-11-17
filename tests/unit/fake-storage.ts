// In-memory stand-in for chrome.storage, for unit tests. Installs itself on globalThis.chrome.
type Listener = (changes: Record<string, { oldValue?: unknown; newValue?: unknown }>, area: string) => void;

export function installFakeStorage() {
  const listeners = new Set<Listener>();
  const area = (name: string) => {
    const data = new Map<string, unknown>();
    const emit = (key: string, oldValue: unknown, newValue: unknown) => {
      for (const l of listeners) l({ [key]: { oldValue, newValue } }, name);
    };
    return {
      data,
      async get(key: string) {
        return data.has(key) ? { [key]: structuredClone(data.get(key)) } : {};
      },
      async set(items: Record<string, unknown>) {
        for (const [k, v] of Object.entries(items)) {
          const old = data.get(k);
          data.set(k, structuredClone(v));
          emit(k, old, v);
        }
      },
      async remove(key: string) {
        const old = data.get(key);
        data.delete(key);
        emit(key, old, undefined);
      }
    };
  };
  const storage = {
    local: area("local"),
    sync: area("sync"),
    session: area("session"),
    onChanged: { addListener: (l: Listener) => listeners.add(l), removeListener: (l: Listener) => listeners.delete(l) }
  };
  const g = globalThis as unknown as { chrome?: Record<string, unknown> };
  g.chrome = { ...(g.chrome ?? {}), storage };
  return storage;
}
