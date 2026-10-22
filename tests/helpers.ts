import type { FormDraft, PersistAdapter } from '../src/core/types';
export function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}
export function memoryAdapter() {
  const data = new Map<string, unknown>();
  const adapter: PersistAdapter = {
    async get<T>(key: string) {
      // Test double storage boundary; production core still validates the envelope.
      return (structuredClone(data.get(key)) ?? null) as FormDraft<T> | null;
    },
    async set(key, value) { data.set(key, structuredClone(value)); },
    async remove(key) { data.delete(key); },
  };
  return { adapter, data };
}
