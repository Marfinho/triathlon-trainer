/** Reine Skip-Logik des Cron-Schedulers: ist ein neuer Sync fällig? */
export function isSyncDue(
  lastSyncAt: Date | null,
  intervalMin: number,
  now: Date,
): boolean {
  if (!lastSyncAt) return true;
  const elapsedMin = (now.getTime() - lastSyncAt.getTime()) / 60000;
  return elapsedMin >= intervalMin;
}
