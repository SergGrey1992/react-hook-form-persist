'use client';
import { createPersistHook } from './core/create-persist-hook';
import { indexedAdapter } from './adapters/indexed-db';
export const usePersistForm = createPersistHook(indexedAdapter, true);
export { PersistFormProvider } from './core/context';
export type { PersistFormProviderProps } from './core/context';
export type { FormDraft, PersistAdapter, PersistOptions, PersistResult, PersistState, PersistStatus } from './core/types';
