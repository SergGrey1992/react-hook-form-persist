import { describe, expect, it } from 'vitest';
import { createWebStorageAdapter } from '../src/adapters/web-storage';
import { createIndexedDBAdapter } from '../src/adapters/indexed-db';
import { isDraftEnvelope } from '../src/core/validation';

describe.each(['local', 'session', 'indexed'] as const)('%s storage', (kind) => {
  const adapter = () => kind === 'indexed'
    ? createIndexedDBAdapter({ databaseName: crypto.randomUUID() })
    : createWebStorageAdapter(() => kind === 'local' ? localStorage : sessionStorage);
  it('reads missing, writes and removes nested values', async () => {
    const store = adapter();
    expect(await store.get('form')).toBeNull();
    const draft = { version: 1, updatedAt: 123, values: { people: [{ name: 'Anna' }] } };
    await store.set('form', draft);
    expect(await store.get('form')).toEqual(draft);
    await store.remove('form');
    expect(await store.get('form')).toBeNull();
  });
});
it('keeps structured-clone types in IndexedDB', async () => {
  const store = createIndexedDBAdapter({ databaseName: crypto.randomUUID() });
  const values = { date: new Date(), map: new Map([['a', 1]]) };
  await store.set('key', { values, version: 1, updatedAt: 1 });
  expect((await store.get('key'))?.values).toEqual(values);
});
it('rejects corrupted JSON and storage access failures', async () => {
  localStorage.setItem('bad', '{');
  const store = createWebStorageAdapter(() => localStorage);
  await expect(store.get('bad')).rejects.toThrow();
  const broken = createWebStorageAdapter(() => { throw new Error('denied'); });
  await expect(broken.get('key')).rejects.toThrow('denied');
  await expect(broken.set('key', { version: 1, updatedAt: 1, values: {} })).rejects.toThrow('denied');
  await expect(broken.remove('key')).rejects.toThrow('denied');
});
it('rejects JSON-incompatible values', async () => {
  const store = createWebStorageAdapter(() => localStorage);
  await expect(store.set('big', { version: 1, updatedAt: 1, values: { n: 1n } })).rejects.toThrow();
});
it.each([null, [], {}, { version: '1', updatedAt: 1, values: {} }, { version: 1, updatedAt: NaN, values: {} }, { version: 1, updatedAt: 1, values: [] }])('rejects invalid envelope %j', value => {
  expect(isDraftEnvelope(value)).toBe(false);
});
it('accepts an envelope without claiming to validate the application schema', () => {
  expect(isDraftEnvelope({ version: 1, updatedAt: 1, values: { arbitrary: true } })).toBe(true);
});
