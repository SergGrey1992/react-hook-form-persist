import { expect, it } from 'vitest';
import { filterValues, restoreValues, snapshotValues } from '../src/core/values';
it('excludes nested paths without mutating or shifting arrays', () => {
  const value = { user: { name: 'Anna', password: 'hidden' }, rows: [{ text: 'a' }, { text: 'b' }] };
  const filtered = filterValues(value, ['rows.0.text'], false);
  expect(filtered).toEqual({ user: { name: 'Anna' }, rows: [{}, { text: 'b' }] });
  expect(value.rows[0]?.text).toBe('a');
  expect(value.user.password).toBe('hidden');
});
it('excludes sensitive keys recursively, opt-in keeps them but exclude wins', () => {
  const value = { PASSWORD: 'p', nested: { accessToken: 't', confirmPassword: 'p', refreshToken: 'r', token: 't', secret: 's' } };
  expect(filterValues(value, [], false)).toEqual({ nested: {} });
  expect(filterValues(value, ['nested.secret'], true)).toEqual({ PASSWORD: 'p', nested: { accessToken: 't', confirmPassword: 'p', refreshToken: 'r', token: 't' } });
});
it('preserves current excluded values while restoring saved arrays', () => {
  const current = { name: '', password: 'current', rows: [{ text: '', secret: 'mine' }] };
  const saved = { name: 'saved', password: 'stale', rows: [{ text: 'restored', secret: 'stale' }] };
  expect(restoreValues(current, saved, [], false)).toEqual({ name: 'saved', password: 'current', rows: [{ text: 'restored', secret: 'mine' }] });
});
it('clones dates maps and cycles independently', () => {
  const value: { date: Date; map: Map<string, number>; self?: unknown } = { date: new Date(), map: new Map([['x', 1]]) };
  value.self = value;
  const copy = snapshotValues(value);
  expect(copy).not.toBe(value);
  expect(copy.date).toEqual(value.date);
  expect(copy.self).toBe(copy);
  expect(copy.map).toEqual(value.map);
});
it('does not pollute prototypes', () => {
  const hostile: unknown = JSON.parse('{"__proto__":{"polluted":true},"constructor":{"prototype":{"polluted":true}}}');
  expect(filterValues(hostile, ['__proto__.polluted'], false)).toEqual({});
  expect(Object.prototype).not.toHaveProperty('polluted');
});
