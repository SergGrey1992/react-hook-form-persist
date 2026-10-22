'use client';
import { useContext } from 'react';
import type { FieldValues } from 'react-hook-form';
import { PersistContext } from './context';
import { usePersistCore } from './use-persist-form';
import type { PersistAdapter, PersistOptions } from './types';
export function createPersistHook(fallback: PersistAdapter | null, useProvider: boolean) {
  return function usePersistForm<T extends FieldValues, Context = unknown, Output = T>(options: PersistOptions<T, Context, Output>) {
    const provider = useContext(PersistContext);
    const adapter = useProvider ? provider ?? fallback : fallback;
    if (!adapter) throw new Error('usePersistForm: /custom requires a PersistFormProvider with an adapter.');
    return usePersistCore(adapter, options);
  };
}
