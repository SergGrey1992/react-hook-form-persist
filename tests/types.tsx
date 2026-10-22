import { expectTypeOf } from 'vitest';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { usePersistForm, type PersistResult, type PersistAdapter, type FormDraft } from '../src';
import { usePersistForm as local } from '../src/local';
import { usePersistForm as session } from '../src/session';
import { usePersistForm as indexed } from '../src/indexed';
import { usePersistForm as custom } from '../src/custom';
const schema = z.object({ count: z.string().transform(Number), nested: z.object({ name: z.string() }) });
export function TypeChecks() {
  const form = useForm<z.input<typeof schema>, { locale: string }, z.output<typeof schema>>({ resolver: zodResolver(schema) });
  const result = usePersistForm({ form, key: 'typed', exclude: ['nested.name'] });
  expectTypeOf(result).toEqualTypeOf<PersistResult>();
  expectTypeOf(result.flush()).toEqualTypeOf<Promise<void>>();
  expectTypeOf(result.clearDraft()).toEqualTypeOf<Promise<void>>();
  local({ form, key: 'typed' }); session({ form, key: 'typed' }); indexed({ form, key: 'typed' }); custom({ form, key: 'typed' });
  // @ts-expect-error exclude must be a real field path
  usePersistForm({ form, key: 'typed', exclude: ['unknown'] });
  // @ts-expect-error key is required
  usePersistForm({ form });
  return null;
}
const adapter: PersistAdapter = { async get<T>(): Promise<FormDraft<T> | null> { return null; }, async set() {}, async remove() {} };
expectTypeOf(adapter.get<{ name: string }>('key')).toEqualTypeOf<Promise<FormDraft<{ name: string }> | null>>();
