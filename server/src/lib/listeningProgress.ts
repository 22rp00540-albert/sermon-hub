/** Percent of media listened: 100 if completed; else based on stored duration from the member player. */
export function listeningProgressPercent(
  progressSeconds: number,
  mediaDurationSeconds: number | null | undefined,
  completed: boolean,
): number | null {
  if (completed) return 100;
  const d = mediaDurationSeconds;
  if (d == null || d < 1 || !Number.isFinite(d)) return null;
  return Math.min(100, Math.max(0, Math.round((progressSeconds / d) * 100)));
}
