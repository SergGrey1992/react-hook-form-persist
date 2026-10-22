import type { FormDraft } from './types';
export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
export function isDraftEnvelope(value: unknown): value is FormDraft<Record<string, unknown>> {
  return isRecord(value) && typeof value.version === 'number' && Number.isFinite(value.version)
    && typeof value.updatedAt === 'number' && Number.isFinite(value.updatedAt)
    && value.updatedAt >= 0 && isRecord(value.values);
}
