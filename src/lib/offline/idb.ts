/**
 * Minimal key-value store on IndexedDB (falls back to memory where IndexedDB isn't available, e.g. private
 * windows or tests). Everything is best-effort: storage failures never break the app.
 */
const DB_NAME = "splitfree-offline";
const STORE = "kv";

const memory = new Map<string, unknown>();

function open(): Promise<IDBDatabase | null> {
  if (typeof indexedDB === "undefined") return Promise.resolve(null);
  return new Promise((resolve) => {
    try {
      const req = indexedDB.open(DB_NAME, 1);
      req.onupgradeneeded = () => req.result.createObjectStore(STORE);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

function run<T>(db: IDBDatabase, mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest): Promise<T | undefined> {
  return new Promise((resolve) => {
    try {
      const req = fn(db.transaction(STORE, mode).objectStore(STORE));
      req.onsuccess = () => resolve(req.result as T);
      req.onerror = () => resolve(undefined);
    } catch {
      resolve(undefined);
    }
  });
}

export async function idbGet<T>(key: string): Promise<T | undefined> {
  const db = await open();
  if (!db) return memory.get(key) as T | undefined;
  const value = await run<T>(db, "readonly", (s) => s.get(key));
  db.close();
  return value;
}

export async function idbSet(key: string, value: unknown): Promise<void> {
  const db = await open();
  if (!db) { memory.set(key, value); return; }
  await run(db, "readwrite", (s) => s.put(value, key));
  db.close();
}

export async function idbDelete(key: string): Promise<void> {
  memory.delete(key);
  const db = await open();
  if (!db) return;
  await run(db, "readwrite", (s) => s.delete(key));
  db.close();
}
