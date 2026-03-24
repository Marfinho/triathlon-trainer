/**
 * In-memory adjustment history store.
 * @param {number} [maxItems]
 */
export function createAdjustmentHistoryStore(maxItems = 500) {
  const entries = [];

  return {
    add(entry) {
      entries.push(entry);
      if (entries.length > maxItems) {
        entries.splice(0, entries.length - maxItems);
      }
    },
    listByUser(userId, limit = 30) {
      const filtered = userId ? entries.filter((x) => x.userId === userId) : entries;
      return filtered.slice(-limit).reverse();
    },
    clear() {
      entries.length = 0;
    }
  };
}
