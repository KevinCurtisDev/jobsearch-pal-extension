// Typed storage keys. Every value read back is validated by the key's parser; anything invalid or
// missing becomes the key's fallback, so callers never see corrupt data.
//
//   const lastRun = defineKey("local", "lastRun", parseLastRun, null);
//   await write(lastRun, { at: Date.now() });
//   const v = await read(lastRun);            // validated value or the fallback
//   const stop = watch(lastRun, (v) => ...);  // called on every change, with validated values
//
// Areas: "local" (10 MB, this device), "sync" (100 KB total, 8 KB per key, follows the Chrome profile),
// "session" (memory only, cleared when the browser restarts; background and extension pages only).

export type Area = "local" | "sync" | "session";
export type Key<T> = { readonly area: Area; readonly name: string; readonly parse: (raw: unknown) => T | null; readonly fallback: T };

/** chrome.storage.sync limit per item (key + JSON value), in bytes. */
export const SYNC_ITEM_LIMIT = 8192;

export function defineKey<T>(area: Area, name: string, parse: (raw: unknown) => T | null, fallback: T): Key<T> {
  if (!/^[A-Za-z][A-Za-z0-9_.:-]{0,63}$/.test(name)) throw new Error(`invalid storage key name "${name}"`);
  return Object.freeze({ area, name, parse, fallback });
}

export async function read<T>(key: Key<T>): Promise<T> {
  try {
    const got = await chrome.storage[key.area].get(key.name);
    const raw = (got as Record<string, unknown>)[key.name];
    if (raw === undefined) return key.fallback;
    return key.parse(raw) ?? key.fallback;
  } catch {
    return key.fallback;
  }
}

/** Writes a value after checking it passes the key's own parser. Rejects with a clear error. */
export async function write<T>(key: Key<T>, value: T): Promise<void> {
  if (key.parse(value) === null) throw new Error(`refusing to store an invalid value for "${key.name}"`);
  if (key.area === "sync") {
    const bytes = new TextEncoder().encode(key.name + JSON.stringify(value)).length;
    if (bytes > SYNC_ITEM_LIMIT) throw new Error(`"${key.name}" is ${bytes} bytes; storage.sync allows ${SYNC_ITEM_LIMIT} per key`);
  }
  await chrome.storage[key.area].set({ [key.name]: value });
}

export async function remove<T>(key: Key<T>): Promise<void> {
  await chrome.storage[key.area].remove(key.name);
}

/** Calls `cb` with the validated new value whenever the key changes. Returns an unsubscribe function. */
export function watch<T>(key: Key<T>, cb: (value: T) => void): () => void {
  const listener = (changes: Record<string, chrome.storage.StorageChange>, area: string) => {
    if (area !== key.area || !(key.name in changes)) return;
    const next = changes[key.name]!.newValue;
    cb(next === undefined ? key.fallback : (key.parse(next) ?? key.fallback));
  };
  chrome.storage.onChanged.addListener(listener);
  return () => chrome.storage.onChanged.removeListener(listener);
}
