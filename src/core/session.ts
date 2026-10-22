import type { PersistAdapter, PersistState } from './types';
import { enqueue } from './queue';
import { isDraftEnvelope } from './validation';
import { filterValues, restoreValues, snapshotValues, valuesEqual } from './values';

interface SessionOptions<T extends Record<string, unknown>> {
  adapter: PersistAdapter; key: string; debounce: number; maxAge: number; version: number;
  exclude: readonly string[]; persistSensitiveFields: boolean;
  getValues(): T;
  reset(values: T): void;
  subscribe(callback: (values: T) => void): () => void;
  onState(state: PersistState): void;
}
export function createSession<T extends Record<string, unknown>>(options: SessionOptions<T>) {
  const { adapter, key } = options;
  let active = true;
  let epoch = 0;
  let revision = 0;
  let snapshotError: { cause: unknown } | undefined;
  let pending: { values: T; revision: number } | undefined;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let unsubscribe: (() => void) | undefined;
  let lastWrite: Promise<void> = Promise.resolve();
  let state: PersistState = { status: 'loading', isRestored: false, hasDraft: false, lastSavedAt: null };
  let operations = 0;
  function update(patch: Partial<PersistState>) {
    state = { ...state, ...patch };
    // subscribe callbacks must not synchronously dispatch React state updates.
    queueMicrotask(() => { if (active) options.onState(state); });
  }
  function cancelTimer() { if (timer !== undefined) clearTimeout(timer); timer = undefined; }
  function schedule(values: T) {
    if (!active) return;
    cancelTimer();
    revision++;
    try {
      pending = { values: filterValues(values, options.exclude, options.persistSensitiveFields), revision };
      snapshotError = undefined;
      timer = setTimeout(() => { timer = undefined; void write().catch(() => {}); }, options.debounce);
    } catch (cause) { pending = undefined; snapshotError = { cause }; update({ status: 'error' }); }
  }
  function write(): Promise<void> {
    cancelTimer();
    if (snapshotError) return Promise.reject(snapshotError.cause);
    if (!pending || !active) return lastWrite;
    const snapshot = pending;
    pending = undefined;
    const generation = epoch;
    operations++;
    update({ status: 'saving' });
    lastWrite = enqueue(adapter, key, async () => {
      if (!active || generation !== epoch) return;
      const updatedAt = Date.now();
      await adapter.set(key, { version: options.version, updatedAt, values: snapshot.values });
      if (active && generation === epoch) update({ hasDraft: true, lastSavedAt: updatedAt });
    }).then(() => {
      operations--;
      if (active && generation === epoch && operations === 0 && !snapshotError) update({ status: 'ready' });
    }, (error: unknown) => {
      operations--;
      if (active && generation === epoch) {
        // Keep the failed snapshot only if no newer edit has superseded it.
        if (!pending && revision === snapshot.revision) pending = snapshot;
        update({ status: 'error' });
      }
      throw error;
    });
    // Attach a handler even if an unmount prevents anybody from awaiting flush.
    void lastWrite.catch(() => {});
    return lastWrite;
  }
  const initialized = (async () => {
    const generation = epoch;
    let baseline: T | undefined;
    let changed = false;
    try {
      baseline = snapshotValues(options.getValues());
      const draft: unknown = await enqueue(adapter, key, () => active ? adapter.get<unknown>(key) : Promise.resolve(null));
      if (!active || generation !== epoch) return;
      changed = !valuesEqual(baseline, options.getValues());
      if (draft !== null) {
        if (!isDraftEnvelope(draft) || draft.version !== options.version || Date.now() - draft.updatedAt > options.maxAge) {
          await enqueue(adapter, key, async () => { if (active && generation === epoch) await adapter.remove(key); });
        } else {
          if (!changed) {
            // Runtime validates only the envelope, not the user's schema. See API trust boundary.
            options.reset(restoreValues(options.getValues(), draft.values as T, options.exclude, options.persistSensitiveFields));
          }
          update({ hasDraft: true, lastSavedAt: draft.updatedAt });
        }
      }
      update({ status: 'ready' });
    } catch { if (active && generation === epoch) update({ status: 'error' }); }
    finally {
      if (active) {
        unsubscribe = options.subscribe(schedule);
        update({ isRestored: true });
        if (generation === epoch && (changed || (baseline !== undefined && !valuesEqual(baseline, options.getValues()) && !state.hasDraft))) schedule(options.getValues());
      }
    }
  })();
  return {
    async flush() { await initialized; if (active) await write(); },
    async clearDraft() {
      if (!active) return;
      const generation = ++epoch;
      pending = undefined; snapshotError = undefined; cancelTimer();
      // Reset a previous write error so an empty post-clear flush is a no-op.
      lastWrite = Promise.resolve();
      try {
        await enqueue(adapter, key, () => adapter.remove(key));
        if (active && generation === epoch) update({ hasDraft: false, lastSavedAt: null, status: operations ? 'saving' : 'ready' });
      } catch (error) { if (active && generation === epoch) update({ status: 'error' }); throw error; }
    },
    dispose() { active = false; pending = undefined; snapshotError = undefined; cancelTimer(); unsubscribe?.(); },
  };
}
