import { act, renderHook, waitFor } from '@testing-library/react';
import type { PropsWithChildren } from 'react';
import { useForm } from 'react-hook-form';
import { expect, it, vi } from 'vitest';
import { usePersistForm as root } from '../src';
import { usePersistForm as local } from '../src/local';
import { usePersistForm as session } from '../src/session';
import { usePersistForm as indexed } from '../src/indexed';
import { usePersistForm as custom, PersistFormProvider } from '../src/custom';
import { indexedAdapter } from '../src/adapters/indexed-db';
import { deferred, memoryAdapter } from './helpers';
import type { FormDraft } from '../src/core/types';
const draft = (name: string) => ({ version: 1, updatedAt: Date.now(), values: { name } });
it.each([['local', local], ['session', session], ['indexed', indexed]] as const)('%s ignores Provider', async (kind, hook) => {
  const { adapter, data } = memoryAdapter(); const key = crypto.randomUUID(); data.set(key, draft('provider'));
  if (kind === 'local') localStorage.setItem(key, JSON.stringify(draft('fixed')));
  else if (kind === 'session') sessionStorage.setItem(key, JSON.stringify(draft('fixed')));
  else await indexedAdapter.set(key, draft('fixed'));
  const wrapper = ({ children }: PropsWithChildren) => <PersistFormProvider adapter={adapter}>{children}</PersistFormProvider>;
  const { result } = renderHook(() => { const form = useForm({ defaultValues: { name: '' } }); return { form, persist: hook({ form, key }) }; }, { wrapper });
  await waitFor(() => expect(result.current.persist.isRestored).toBe(true));
  expect(result.current.form.getValues('name')).toBe('fixed');
});
it.each([['root', root], ['custom', custom]] as const)('%s uses closest Provider', async (_kind, hook) => {
  const outer = memoryAdapter(); const inner = memoryAdapter(); outer.data.set('key', draft('outer')); inner.data.set('key', draft('inner'));
  const wrapper = ({ children }: PropsWithChildren) => <PersistFormProvider adapter={outer.adapter}><PersistFormProvider adapter={inner.adapter}>{children}</PersistFormProvider></PersistFormProvider>;
  const get = vi.spyOn(inner.adapter, 'get');
  const { result, rerender } = renderHook(() => { const form = useForm({ defaultValues: { name: '' } }); return { form, persist: hook({ form, key: 'key' }) }; }, { wrapper });
  await waitFor(() => expect(result.current.persist.isRestored).toBe(true));
  expect(result.current.form.getValues('name')).toBe('inner'); rerender(); expect(get).toHaveBeenCalledTimes(1);
});
it('root falls back to IndexedDB', async () => {
  const key = crypto.randomUUID(); await indexedAdapter.set(key, draft('indexed'));
  const { result } = renderHook(() => { const form = useForm({ defaultValues: { name: '' } }); return { form, persist: root({ form, key }) }; });
  await waitFor(() => expect(result.current.persist.isRestored).toBe(true)); expect(result.current.form.getValues('name')).toBe('indexed');
});
it('custom requires Provider', () => {
  expect(() => renderHook(() => { const form = useForm(); return custom({ form, key: 'key' }); })).toThrow('PersistFormProvider');
});
it('adapter replacement ignores a late result from the old adapter', async () => {
  const first = memoryAdapter(), second = memoryAdapter(); const read = deferred<FormDraft<{ name: string }> | null>();
  vi.spyOn(first.adapter, 'get').mockReturnValue(read.promise); second.data.set('key', draft('second'));
  let adapter = first.adapter;
  const wrapper = ({ children }: PropsWithChildren) => <PersistFormProvider adapter={adapter}>{children}</PersistFormProvider>;
  const { result, rerender } = renderHook(() => { const form = useForm({ defaultValues: { name: '' } }); return { form, persist: root({ form, key: 'key' }) }; }, { wrapper });
  adapter = second.adapter; rerender();
  await waitFor(() => expect(result.current.form.getValues('name')).toBe('second'));
  await act(async () => { read.resolve(draft('first')); await read.promise; });
  expect(result.current.form.getValues('name')).toBe('second');
});
