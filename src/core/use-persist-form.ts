'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { FieldValues } from 'react-hook-form';
import type { PersistAdapter, PersistOptions, PersistResult, PersistState } from './types';
import { createSession } from './session';
const initialState = (enabled: boolean): PersistState => ({ status: enabled ? 'loading' : 'ready', isRestored: false, hasDraft: false, lastSavedAt: null });
export function usePersistCore<T extends FieldValues, Context, Output>(adapter: PersistAdapter, options: PersistOptions<T, Context, Output>): PersistResult {
  const { form, key, debounce = 500, maxAge = 30 * 24 * 60 * 60 * 1000, version = 1, enabled = true, persistSensitiveFields = false } = options;
  if (!key || !Number.isFinite(debounce) || debounce < 0 || debounce > 2_147_483_647 || !Number.isFinite(maxAge) || maxAge < 0 || !Number.isSafeInteger(version) || version < 0) {
    throw new Error('usePersistForm: key must be nonempty, debounce/maxAge nonnegative finite numbers, version a nonnegative safe integer.');
  }
  const { getValues, reset, subscribe } = form;
  const excludeKey = JSON.stringify(options.exclude ?? []);
  const [state, setState] = useState<PersistState>(() => initialState(enabled));
  const session = useRef<ReturnType<typeof createSession<T>> | null>(null);
  useEffect(() => {
    setState(initialState(enabled));
    if (!enabled) return;
    // JSON was produced from a readonly FieldPath array in this render.
    const exclude = JSON.parse(excludeKey) as string[];
    const current = createSession<T>({
      adapter, key, debounce, maxAge, version, exclude, persistSensitiveFields,
      getValues, reset: values => reset(values),
      subscribe: callback => subscribe({ formState: { values: true }, callback: ({ values }) => callback(values) }),
      onState: setState,
    });
    session.current = current;
    return () => { current.dispose(); if (session.current === current) session.current = null; };
  }, [adapter, key, debounce, maxAge, version, enabled, persistSensitiveFields, excludeKey, getValues, reset, subscribe]);
  const flush = useCallback(async () => { await session.current?.flush(); }, []);
  const clearDraft = useCallback(async () => { await session.current?.clearDraft(); }, []);
  return { ...state, flush, clearDraft };
}
