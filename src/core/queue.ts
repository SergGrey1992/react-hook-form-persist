import type { PersistAdapter } from './types';
const queues = new WeakMap<PersistAdapter, Map<string, Promise<void>>>();
export function enqueue<T>(adapter: PersistAdapter, key: string, operation: () => Promise<T>): Promise<T> {
  let keys = queues.get(adapter);
  if (!keys) { keys = new Map(); queues.set(adapter, keys); }
  const result = (keys.get(key) ?? Promise.resolve()).then(operation);
  const settled = result.then(() => {}, () => {});
  keys.set(key, settled);
  void settled.then(() => { if (keys.get(key) === settled) keys.delete(key); });
  return result;
}
