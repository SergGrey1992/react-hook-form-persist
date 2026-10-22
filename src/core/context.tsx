'use client';
import { createContext, createElement, type ReactNode } from 'react';
import type { PersistAdapter } from './types';
export const PersistContext = createContext<PersistAdapter | null>(null);
export interface PersistFormProviderProps { adapter: PersistAdapter; children?: ReactNode }
/** Keep adapter referentially stable (module constant or useMemo). */
export function PersistFormProvider({ adapter, children }: PersistFormProviderProps) {
  return createElement(PersistContext.Provider, { value: adapter }, children);
}
