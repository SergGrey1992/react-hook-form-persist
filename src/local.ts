'use client';
import { createPersistHook } from './core/create-persist-hook';
import { localAdapter } from './adapters/web-storage';
export const usePersistForm = createPersistHook(localAdapter, false);
export type { FormDraft, PersistAdapter, PersistOptions, PersistResult, PersistState, PersistStatus } from './core/types';
