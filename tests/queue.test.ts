import { expect, it } from 'vitest';
import { enqueue } from '../src/core/queue';
import type { PersistAdapter } from '../src/core/types';
const adapter: PersistAdapter = { async get() { return null; }, async set() {}, async remove() {} };
it('serializes a key and recovers after rejection', async () => {
  const order: number[] = [];
  let release = () => {};
  const gate = new Promise<void>(resolve => { release = resolve; });
  const a = enqueue(adapter, 'a', async () => { await gate; order.push(1); throw new Error('fail'); });
  const rejection = expect(a).rejects.toThrow('fail');
  const b = enqueue(adapter, 'a', async () => { order.push(2); });
  await enqueue(adapter, 'b', async () => { order.push(3); });
  expect(order).toEqual([3]);
  release(); await rejection; await b;
  expect(order).toEqual([3, 1, 2]);
});
