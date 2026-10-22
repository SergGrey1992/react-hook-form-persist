import { act, renderHook, waitFor } from '@testing-library/react';
import { StrictMode, type PropsWithChildren } from 'react';
import { useForm, useFieldArray } from 'react-hook-form';
import { afterEach, expect, it, vi } from 'vitest';
import { PersistFormProvider, usePersistForm } from '../src/custom';
import { deferred, memoryAdapter } from './helpers';
import type { FormDraft, PersistAdapter } from '../src/core/types';

type Values = { name: string; password: string; rows: { text: string }[] };
const defaults: Values = { name: '', password: 'current', rows: [] };
const draft = (name = 'saved') => ({ version: 1, updatedAt: Date.now(), values: { ...defaults, name, password: 'old' } });
function mount(adapter: PersistAdapter, options: { key?: string; enabled?: boolean; debounce?: number; maxAge?: number; version?: number } = {}, strict = false) {
  const wrapper = ({ children }: PropsWithChildren) => <PersistFormProvider adapter={adapter}>{strict ? <StrictMode>{children}</StrictMode> : children}</PersistFormProvider>;
  return renderHook((props: typeof options) => {
    const form = useForm<Values>({ defaultValues: defaults });
    const array = useFieldArray({ control: form.control, name: 'rows' });
    return { form, array, persist: usePersistForm({ form, key: 'key', ...props }) };
  }, { wrapper, initialProps: options });
}
afterEach(() => vi.useRealTimers());
it('restores before subscription and preserves excluded defaults', async () => {
  const { adapter, data } = memoryAdapter(); data.set('key', draft());
  const set = vi.spyOn(adapter, 'set');
  const { result } = mount(adapter);
  await waitFor(() => expect(result.current.persist.isRestored).toBe(true));
  expect(result.current.form.getValues()).toEqual({ ...defaults, name: 'saved' });
  expect(result.current.persist.hasDraft).toBe(true);
  expect(set).not.toHaveBeenCalled();
});
it('does not persist missing draft or initial values', async () => {
  const { adapter, data } = memoryAdapter(); const { result } = mount(adapter);
  await waitFor(() => expect(result.current.persist.status).toBe('ready'));
  await act(() => result.current.persist.flush());
  expect(data.size).toBe(0);
});
it('debounces and flushes a current snapshot', async () => {
  const { adapter, data } = memoryAdapter(); const { result } = mount(adapter);
  await waitFor(() => expect(result.current.persist.isRestored).toBe(true));
  vi.useFakeTimers();
  act(() => result.current.form.setValue('name', 'a'));
  await act(() => vi.advanceTimersByTimeAsync(499));
  expect(data.size).toBe(0);
  act(() => result.current.form.setValue('name', 'b'));
  await act(() => vi.advanceTimersByTimeAsync(500));
  expect(data.get('key')).toMatchObject({ values: { name: 'b' } });
  expect(result.current.persist.lastSavedAt).toBeTypeOf('number');
  expect(result.current.persist.isRestored).toBe(true);
  act(() => result.current.form.setValue('name', 'c'));
  await act(() => result.current.persist.flush());
  expect(data.get('key')).toMatchObject({ values: { name: 'c' } });
});
it.each(['expired', 'version', 'malformed'] as const)('removes %s drafts', async kind => {
  const { adapter, data } = memoryAdapter();
  data.set('key', kind === 'expired' ? { ...draft(), updatedAt: 1 } : kind === 'version' ? { ...draft(), version: 2 } : { broken: true });
  const { result } = mount(adapter);
  await waitFor(() => expect(result.current.persist.isRestored).toBe(true));
  expect(result.current.form.getValues('name')).toBe(''); expect(data.size).toBe(0);
});
it('reports read errors but finishes restoration and allows later saving', async () => {
  const { adapter, data } = memoryAdapter(); vi.spyOn(adapter, 'get').mockRejectedValueOnce(new Error('offline'));
  const { result } = mount(adapter);
  await waitFor(() => expect(result.current.persist.status).toBe('error'));
  expect(result.current.persist.isRestored).toBe(true);
  act(() => result.current.form.setValue('name', 'retry'));
  await act(() => result.current.persist.flush());
  expect(data.get('key')).toMatchObject({ values: { name: 'retry' } });
});
it('reports write rejection without a false save timestamp and supports retry', async () => {
  const { adapter, data } = memoryAdapter(); const set = vi.spyOn(adapter, 'set').mockRejectedValueOnce(new Error('quota'));
  const { result } = mount(adapter);
  await waitFor(() => expect(result.current.persist.isRestored).toBe(true));
  act(() => result.current.form.setValue('name', 'retry'));
  await act(async () => { await expect(result.current.persist.flush()).rejects.toThrow('quota'); });
  expect(result.current.persist.lastSavedAt).toBeNull(); expect(result.current.persist.status).toBe('error');
  await act(() => result.current.persist.flush());
  expect(set).toHaveBeenCalledTimes(2); expect(data.get('key')).toMatchObject({ values: { name: 'retry' } });
});
it('clear cancels debounce, removes storage, permits reuse and propagates remove failures', async () => {
  const { adapter, data } = memoryAdapter(); data.set('key', draft()); const { result } = mount(adapter);
  await waitFor(() => expect(result.current.persist.isRestored).toBe(true));
  act(() => result.current.form.setValue('name', 'discard'));
  await act(() => result.current.persist.clearDraft());
  await act(() => result.current.persist.flush());
  expect(data.size).toBe(0); expect(result.current.persist.hasDraft).toBe(false);
  act(() => result.current.form.setValue('name', 'new'));
  await act(() => result.current.persist.flush()); expect(data.size).toBe(1);
  vi.spyOn(adapter, 'remove').mockRejectedValueOnce(new Error('denied'));
  await act(async () => { await expect(result.current.persist.clearDraft()).rejects.toThrow('denied'); });
  expect(result.current.persist.status).toBe('error'); expect(result.current.persist.hasDraft).toBe(true);
});
it('clear during slow read never resets the form', async () => {
  const { adapter, data } = memoryAdapter(); const read = deferred<FormDraft<Values> | null>();
  vi.spyOn(adapter, 'get').mockReturnValue(read.promise);
  const { result } = mount(adapter); let cleared!: Promise<void>;
  act(() => { cleared = result.current.persist.clearDraft(); });
  await act(async () => { read.resolve(draft()); await cleared; });
  expect(result.current.form.getValues('name')).toBe(''); expect(data.size).toBe(0);
});
it('preserves edits made during slow restoration', async () => {
  const { adapter } = memoryAdapter(); const read = deferred<FormDraft<Values> | null>();
  vi.spyOn(adapter, 'get').mockReturnValue(read.promise); const { result } = mount(adapter);
  act(() => result.current.form.setValue('name', 'typed'));
  await act(async () => { read.resolve(draft()); await read.promise; });
  await waitFor(() => expect(result.current.persist.isRestored).toBe(true));
  expect(result.current.form.getValues('name')).toBe('typed');
});
it('serializes clear behind an active write', async () => {
  const { adapter, data } = memoryAdapter(); const original = adapter.set; const gate = deferred<void>();
  vi.spyOn(adapter, 'set').mockImplementation(async (key, value) => { await gate.promise; await original(key, value); });
  const { result } = mount(adapter); await waitFor(() => expect(result.current.persist.isRestored).toBe(true));
  act(() => result.current.form.setValue('name', 'pending'));
  let writing!: Promise<void>; let clearing!: Promise<void>;
  act(() => { writing = result.current.persist.flush(); });
  await act(async () => { await Promise.resolve(); });
  act(() => { clearing = result.current.persist.clearDraft(); });
  await act(async () => { gate.resolve(); await writing; await clearing; });
  expect(data.size).toBe(0); expect(result.current.persist.hasDraft).toBe(false);
});
it('handles enabled and changing keys', async () => {
  const { adapter, data } = memoryAdapter(); data.set('other', draft('other'));
  const get = vi.spyOn(adapter, 'get'); const { result, rerender } = mount(adapter, { enabled: false });
  expect(result.current.persist.isRestored).toBe(false); expect(get).not.toHaveBeenCalled();
  rerender({ enabled: true }); await waitFor(() => expect(result.current.persist.isRestored).toBe(true));
  act(() => result.current.form.setValue('name', 'discard pending'));
  rerender({ enabled: true, key: 'other' });
  await waitFor(() => expect(result.current.form.getValues('name')).toBe('other'));
  expect(data.has('key')).toBe(false);
});
it('works in Strict Mode and releases pending timers on unmount', async () => {
  const { adapter, data } = memoryAdapter(); data.set('key', draft()); const { result, unmount } = mount(adapter, {}, true);
  await waitFor(() => expect(result.current.persist.isRestored).toBe(true));
  vi.useFakeTimers(); act(() => result.current.form.setValue('name', 'unsaved')); unmount();
  await vi.runAllTimersAsync(); expect(data.get('key')).toMatchObject({ values: { name: 'saved' } });
  expect(vi.getTimerCount()).toBe(0);
});
it('saves useFieldArray values', async () => {
  const { adapter, data } = memoryAdapter(); const { result } = mount(adapter);
  await waitFor(() => expect(result.current.persist.isRestored).toBe(true));
  act(() => result.current.array.append({ text: 'row' }));
  await act(() => result.current.persist.flush());
  expect(data.get('key')).toMatchObject({ values: { rows: [{ text: 'row' }] } });
});
it('flush rejects values that cannot be cloned instead of reporting success', async () => {
  const { adapter } = memoryAdapter();
  const wrapper = ({ children }: PropsWithChildren) => <PersistFormProvider adapter={adapter}>{children}</PersistFormProvider>;
  const { result } = renderHook(() => { const form = useForm<{ value: unknown }>({ defaultValues: { value: '' } }); return { form, persist: usePersistForm({ form, key: 'clone' }) }; }, { wrapper });
  await waitFor(() => expect(result.current.persist.isRestored).toBe(true));
  act(() => result.current.form.setValue('value', () => 'not cloneable'));
  await act(async () => { await expect(result.current.persist.flush()).rejects.toThrow(); });
  expect(result.current.persist.status).toBe('error');
});
it('flush waits for restoration and does not save its initial empty snapshot', async () => {
  const { adapter, data } = memoryAdapter(); const read = deferred<FormDraft<Values> | null>();
  vi.spyOn(adapter, 'get').mockReturnValue(read.promise); const { result } = mount(adapter);
  let flushed!: Promise<void>; act(() => { flushed = result.current.persist.flush(); });
  await act(async () => { read.resolve(draft()); await flushed; });
  expect(result.current.form.getValues('name')).toBe('saved'); expect(data.size).toBe(0);
});
it('does not mark invalidation successful when removal fails', async () => {
  const { adapter, data } = memoryAdapter(); data.set('key', { broken: true });
  vi.spyOn(adapter, 'remove').mockRejectedValueOnce(new Error('offline'));
  const { result } = mount(adapter);
  await waitFor(() => expect(result.current.persist.isRestored).toBe(true)); expect(result.current.persist.status).toBe('error');
});
