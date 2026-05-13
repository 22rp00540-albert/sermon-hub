/** Minimum seconds of real playback (client-measured) before we accept "completed". */
export function minEngagedSecondsForCompletion(mediaDurationSeconds: number): number {
  if (!Number.isFinite(mediaDurationSeconds) || mediaDurationSeconds < 1) return 1;
  const pct = Math.floor(mediaDurationSeconds * 0.82);
  return Math.min(mediaDurationSeconds, Math.max(12, pct));
}

/**
 * Decide if a session may be marked completed. Ignores client "completed" unless
 * progress is near the end and engaged time (when provided) or anti-spoof rules pass.
 */
export function resolveListeningCompletion(args: {
  clientWantsComplete: boolean;
  progressSeconds: number;
  engagedWatchSeconds: number | undefined;
  previousProgressSeconds: number;
  previousCompleted: boolean;
  mediaDurationSeconds: number | null;
}): boolean {
  if (args.previousCompleted) return true;
  if (!args.clientWantsComplete) return false;

  const dur = args.mediaDurationSeconds;
  if (dur == null || dur < 1) return false;

  const prog = args.progressSeconds;
  const nearEnd = prog >= dur - 2 || prog >= Math.floor(dur * 0.92);
  if (!nearEnd) return false;

  if (args.engagedWatchSeconds != null && Number.isFinite(args.engagedWatchSeconds)) {
    const need = minEngagedSecondsForCompletion(dur);
    return args.engagedWatchSeconds >= Math.max(0, need - 2);
  }

  // Legacy clients (no engaged time): block obvious seek-to-end from the start.
  if (dur >= 45 && args.previousProgressSeconds < Math.min(45, dur * 0.12) && prog >= dur * 0.94) {
    return false;
  }
  return true;
}
