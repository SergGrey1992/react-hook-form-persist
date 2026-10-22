import type { FieldPath, FieldValues, UseFormReturn } from 'react-hook-form';

export interface FormDraft<T> { version: number; updatedAt: number; values: T }
export interface PersistAdapter {
  get<T>(key: string): Promise<FormDraft<T> | null>;
  set<T>(key: string, draft: FormDraft<T>): Promise<void>;
  remove(key: string): Promise<void>;
}
export type PersistStatus = 'loading' | 'ready' | 'saving' | 'error';
export interface PersistState {
  status: PersistStatus;
  isRestored: boolean;
  hasDraft: boolean;
  lastSavedAt: number | null;
}
export interface PersistResult extends PersistState {
  clearDraft(): Promise<void>;
  flush(): Promise<void>;
}
export interface PersistOptions<T extends FieldValues, Context = unknown, Output = T> {
  form: UseFormReturn<T, Context, Output>;
  key: string;
  debounce?: number;
  maxAge?: number;
  version?: number;
  enabled?: boolean;
  exclude?: readonly FieldPath<T>[];
  /** Explicit opt-in to saving common password/token names. Explicit exclude still wins. */
  persistSensitiveFields?: boolean;
}
