const forbidden = new Set(['__proto__', 'constructor', 'prototype']);
const sensitive = new Set(['password', 'confirmpassword', 'token', 'accesstoken', 'refreshtoken', 'secret']);
function container(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
    && (Array.isArray(value) || Object.getPrototypeOf(value) === Object.prototype || Object.getPrototypeOf(value) === null);
}

/** Copy traversable containers without cloning opaque/excluded platform values yet. */
function copyContainers<T>(value: T): T {
  const seen = new WeakMap<object, unknown>();
  function copy(input: unknown): unknown {
    if (typeof input !== 'object' || input === null) return input;
    if (seen.has(input)) return seen.get(input);
    if (input instanceof Map) {
      const output = new Map<unknown, unknown>(); seen.set(input, output);
      for (const [key, entry] of input) output.set(copy(key), copy(entry));
      return output;
    }
    if (input instanceof Set) {
      const output = new Set<unknown>(); seen.set(input, output);
      for (const entry of input) output.add(copy(entry));
      return output;
    }
    if (!container(input)) return input;
    const output: object = Array.isArray(input) ? new Array<unknown>(input.length) : {};
    seen.set(input, output);
    for (const key of Object.keys(input)) {
      if (!forbidden.has(key)) Object.defineProperty(output, key, { value: copy(input[key]), writable: true, enumerable: true, configurable: true });
    }
    return output;
  }
  // Container copying preserves the input shape; opaque values are left for structuredClone.
  return copy(value) as T;
}

export function snapshotValues<T>(values: T): T { return structuredClone(values); }
function blocked(name: string, path: string, exclude: readonly string[], persistSensitiveFields: boolean) {
  return forbidden.has(name) || exclude.includes(path) || (!persistSensitiveFields && sensitive.has(name.toLowerCase()));
}
export function filterValues<T>(values: T, exclude: readonly string[], persistSensitiveFields: boolean): T {
  const copy = copyContainers(values);
  // Ancestors (rather than global visited) also handle aliased objects at different paths.
  const ancestors = new WeakSet<object>();
  function visit(value: unknown, prefix: string) {
    if (typeof value !== 'object' || value === null || ancestors.has(value)) return;
    ancestors.add(value);
    if (value instanceof Map) {
      for (const [key, entry] of value) { visit(key, prefix); visit(entry, prefix); }
    } else if (value instanceof Set) {
      for (const entry of value) visit(entry, prefix);
    }
    if (!container(value)) { ancestors.delete(value); return; }
    for (const name of Object.keys(value)) {
      const path = prefix ? `${prefix}.${name}` : name;
      if (blocked(name, path, exclude, persistSensitiveFields)) delete value[name];
      else visit(value[name], path);
    }
    ancestors.delete(value);
  }
  visit(copy, '');
  // Exclusions run first so ignored functions/FileList do not prevent saving.
  return snapshotValues(copy);
}
export function restoreValues<T>(current: T, saved: T, exclude: readonly string[], persistSensitiveFields: boolean): T {
  const result = filterValues(saved, exclude, persistSensitiveFields);
  const defaults = copyContainers(current);
  const ancestors = new WeakSet<object>();
  function merge(target: unknown, source: unknown, prefix: string) {
    if (!container(target) || !container(source) || ancestors.has(source)) return;
    ancestors.add(source);
    for (const name of Object.keys(source)) {
      if (forbidden.has(name)) continue;
      const path = prefix ? `${prefix}.${name}` : name;
      if (blocked(name, path, exclude, persistSensitiveFields)) target[name] = source[name];
      else if (!Object.hasOwn(target, name) && !Array.isArray(target)) target[name] = source[name];
      else merge(target[name], source[name], path);
    }
    ancestors.delete(source);
  }
  merge(result, defaults, '');
  return result;
}
/** Compare structured values to detect edits during a pending restore. */
export function valuesEqual(a: unknown, b: unknown, seen = new WeakMap<object, object>()): boolean {
  if (Object.is(a, b)) return true;
  if (typeof a !== 'object' || a === null || typeof b !== 'object' || b === null) return false;
  if (Object.getPrototypeOf(a) !== Object.getPrototypeOf(b)) return false;
  if (seen.has(a)) return seen.get(a) === b;
  seen.set(a, b);
  if (a instanceof Date && b instanceof Date) return a.getTime() === b.getTime();
  if (a instanceof RegExp && b instanceof RegExp) return String(a) === String(b);
  if (a instanceof Map && b instanceof Map) return valuesEqual([...a], [...b], seen);
  if (a instanceof Set && b instanceof Set) return valuesEqual([...a], [...b], seen);
  if (a instanceof ArrayBuffer && b instanceof ArrayBuffer) return valuesEqual(new Uint8Array(a), new Uint8Array(b), seen);
  if (ArrayBuffer.isView(a) && ArrayBuffer.isView(b)) {
    const av = new Uint8Array(a.buffer, a.byteOffset, a.byteLength), bv = new Uint8Array(b.buffer, b.byteOffset, b.byteLength);
    return av.length === bv.length && av.every((value, index) => value === bv[index]);
  }
  if (!container(a) || !container(b)) return false;
  const keys = Object.keys(a);
  return keys.length === Object.keys(b).length && keys.every(key => Object.hasOwn(b, key) && valuesEqual(a[key], b[key], seen));
}
