'use client';
import { createPersistHook } from './core/create-persist-hook';
import { sessionAdapter } from './adapters/web-storage';
export const usePersistForm = createPersistHook(sessionAdapter, false);
export type { FormDraft, PersistAdapter, PersistOptions, PersistResult, PersistState, PersistStatus } from './core/types';
