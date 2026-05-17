"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.listeningProgressPercent = listeningProgressPercent;
/** Percent of media listened: 100 if completed; else based on stored duration from the member player. */
function listeningProgressPercent(progressSeconds, mediaDurationSeconds, completed) {
    if (completed)
        return 100;
    const d = mediaDurationSeconds;
    if (d == null || d < 1 || !Number.isFinite(d))
        return null;
    return Math.min(100, Math.max(0, Math.round((progressSeconds / d) * 100)));
}
