import assert from 'node:assert/strict';
import test from 'node:test';

import { createAdjustmentHistoryStore } from '../src/engine/adjustmentHistoryStore.js';

test('createAdjustmentHistoryStore stores and filters entries by user', () => {
  const store = createAdjustmentHistoryStore(3);

  store.add({ id: '1', userId: 'u1', reason: 'r1' });
  store.add({ id: '2', userId: 'u2', reason: 'r2' });
  store.add({ id: '3', userId: 'u1', reason: 'r3' });
  store.add({ id: '4', userId: 'u1', reason: 'r4' });

  const u1 = store.listByUser('u1', 10);
  const all = store.listByUser(undefined, 10);

  assert.equal(all.length, 3);
  assert.equal(u1.length, 2);
  assert.equal(u1[0].id, '4');
});
