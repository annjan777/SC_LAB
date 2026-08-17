const tracker = new Map();
const MAX_TRACKER_SIZE = 10000;
// Periodically clean up expired entries to prevent memory leaks
setInterval(() => {
    const now = Date.now();
    for (const [ip, state] of tracker.entries()) {
        if (state.blockedUntil < now && state.failedAttempts < 15) {
            tracker.delete(ip);
        }
    }
}, 60 * 60 * 1000).unref(); // Run every hour
export function getPenalty(failures) {
    if (failures >= 75)
        return 24 * 60 * 60 * 1000; // 24 hours
    if (failures >= 60)
        return 3 * 60 * 60 * 1000; // 3 hours
    if (failures >= 45)
        return 60 * 60 * 1000; // 1 hour
    if (failures >= 30)
        return 15 * 60 * 1000; // 15 mins
    if (failures >= 15)
        return 5 * 60 * 1000; // 5 mins
    return 0;
}
export function formatTime(ms) {
    const mins = Math.ceil(ms / 60000);
    if (mins >= 1440)
        return `${Math.ceil(mins / 1440)} hours`;
    if (mins >= 60)
        return `${Math.ceil(mins / 60)} hours`;
    return `${mins} minutes`;
}
export const progressiveLoginLimiter = (req, res, next) => {
    const ip = req.ip || req.socket.remoteAddress || 'unknown';
    const state = tracker.get(ip);
    if (state && state.blockedUntil > Date.now()) {
        const remainingMs = state.blockedUntil - Date.now();
        return res.status(429).json({
            error: `Too many failed login attempts. Please try again in ${formatTime(remainingMs)}.`
        });
    }
    next();
};
export function recordFailedLogin(ip) {
    // Prevent unbounded memory growth by evicting oldest (first) entry if at limit
    if (tracker.size >= MAX_TRACKER_SIZE && !tracker.has(ip)) {
        const firstKey = tracker.keys().next().value;
        if (firstKey)
            tracker.delete(firstKey);
    }
    const state = tracker.get(ip) || { failedAttempts: 0, blockedUntil: 0 };
    state.failedAttempts += 1;
    const penaltyMs = getPenalty(state.failedAttempts);
    if (penaltyMs > 0 && state.failedAttempts % 15 === 0) {
        state.blockedUntil = Date.now() + penaltyMs;
    }
    tracker.set(ip, state);
}
export function resetFailedLogin(ip) {
    tracker.delete(ip);
}
// Exported for testing/cleanup
export function clearRateLimitTracker() {
    tracker.clear();
}
