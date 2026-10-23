import { InvalidDraftError } from '../core/errors';
import type { FormDraft, PersistAdapter } from '../core/types';

/** Lazy access keeps importing the module safe on the server. */
export function createWebStorageAdapter(getStorage: () => Storage): PersistAdapter {
  return {
    async get<T>(key: string) {
      const raw = getStorage().getItem(key);
      // Storage is untrusted. The generic contract cannot validate T; core checks the envelope.
      if (raw === null) return null;
      try { return JSON.parse(raw) as FormDraft<T>; }
      catch (cause) { throw new InvalidDraftError(cause); }
    },
    async set(key, draft) { getStorage().setItem(key, JSON.stringify(draft)); },
    async remove(key) { getStorage().removeItem(key); },
  };
}
export const localAdapter = createWebStorageAdapter(() => window.localStorage);
export const sessionAdapter = createWebStorageAdapter(() => window.sessionStorage);
