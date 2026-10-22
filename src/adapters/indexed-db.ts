import { openDB, type IDBPDatabase } from 'idb';
import type { FormDraft, PersistAdapter } from '../core/types';
export function createIndexedDBAdapter(options: { databaseName?: string; storeName?: string } = {}): PersistAdapter {
  const name = options.databaseName ?? 'react-hook-form-persist';
  const store = options.storeName ?? 'drafts';
  let connection: Promise<IDBPDatabase> | undefined;
  function database() {
    if (!connection) {
      connection = openDB(name, 1, {
        upgrade(db) { db.createObjectStore(store); },
        blocking() { const previous = connection; connection = undefined; void previous?.then(db => db.close(), () => {}); },
        terminated() { connection = undefined; },
      }).catch((error: unknown) => { connection = undefined; throw error; });
    }
    return connection;
  }
  return {
    async get<T>(key: string) {
      const value: unknown = await (await database()).get(store, key);
      // IndexedDB returns unknown data. Core validates its envelope before restoring it.
      return (value ?? null) as FormDraft<T> | null;
    },
    async set(key, draft) { await (await database()).put(store, draft, key); },
    async remove(key) { await (await database()).delete(store, key); },
  };
}
export const indexedAdapter = createIndexedDBAdapter();
