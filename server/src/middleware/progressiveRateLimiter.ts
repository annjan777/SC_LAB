import { Request, Response, NextFunction } from 'express';

interface RateLimitState {
  failedAttempts: number;
  blockedUntil: number;
  accounts?: Set<string>;
}

// A whole network address (often a shared lab/NAT IP) is only blocked when its failures are spread over
// several different accounts (password spraying). One person mistyping their own password is handled by
// the per-account lockout below, so colleagues on the same network are not locked out with them.
const IP_BLOCK_MIN_ACCOUNTS = 5;

const tracker = new Map<string, RateLimitState>();
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

export function getPenalty(failures: number): number {
  if (failures >= 75) return 24 * 60 * 60 * 1000; // 24 hours
  if (failures >= 60) return 3 * 60 * 60 * 1000; // 3 hours
  if (failures >= 45) return 60 * 60 * 1000; // 1 hour
  if (failures >= 30) return 15 * 60 * 1000; // 15 mins
  if (failures >= 15) return 5 * 60 * 1000; // 5 mins
  return 0;
}

export function formatTime(ms: number): string {
  const mins = Math.ceil(ms / 60000);
  if (mins >= 1440) return `${Math.ceil(mins / 1440)} hours`;
  if (mins >= 60) return `${Math.ceil(mins / 60)} hours`;
  return `${mins} minutes`;
}

export const progressiveLoginLimiter = (req: Request, res: Response, next: NextFunction) => {
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

/** Milliseconds until this IP may try to log in again (0 when not blocked). */
export function getLoginBlockRemainingMs(ip: string): number {
  const state = tracker.get(ip);
  return state && state.blockedUntil > Date.now() ? state.blockedUntil - Date.now() : 0;
}

export function recordFailedLogin(ip: string, email?: string) {
  // Prevent unbounded memory growth by evicting oldest (first) entry if at limit
  if (tracker.size >= MAX_TRACKER_SIZE && !tracker.has(ip)) {
    const firstKey = tracker.keys().next().value;
    if (firstKey) tracker.delete(firstKey);
  }

  const state = tracker.get(ip) || { failedAttempts: 0, blockedUntil: 0, accounts: new Set<string>() };
  state.failedAttempts += 1;
  if (email) (state.accounts ||= new Set()).add(String(email).trim().toLowerCase());
  const spraying = !email || (state.accounts?.size ?? 0) >= IP_BLOCK_MIN_ACCOUNTS;

  const penaltyMs = getPenalty(state.failedAttempts);
  if (spraying && penaltyMs > 0 && state.failedAttempts % 15 === 0) {
    state.blockedUntil = Date.now() + penaltyMs;
  }

  tracker.set(ip, state);
}

export function resetFailedLogin(ip: string) {
  tracker.delete(ip);
}

// ---------------------------------------------------------------------------
// Per-account lockout (BUG-SEC-IPLOCK). The IP limiter alone lets an attacker
// rotate source addresses and keep guessing one account's password, so failures
// are also counted per (normalised) email: ACCOUNT_MAX_FAILURES failures within
// ACCOUNT_WINDOW_MS block that account for ACCOUNT_BLOCK_MS.
// ---------------------------------------------------------------------------
interface AccountLockState {
  failedAttempts: number;
  windowStart: number;
  blockedUntil: number;
}

const accountTracker = new Map<string, AccountLockState>();
const ACCOUNT_MAX_FAILURES = 10;
const ACCOUNT_WINDOW_MS = 15 * 60 * 1000;
const ACCOUNT_BLOCK_MS = 15 * 60 * 1000;

function accountKey(email: string): string {
  return String(email || '').trim().toLowerCase();
}

setInterval(() => {
  const now = Date.now();
  for (const [key, state] of accountTracker.entries()) {
    if (state.blockedUntil < now && now - state.windowStart > ACCOUNT_WINDOW_MS) {
      accountTracker.delete(key);
    }
  }
}, 60 * 60 * 1000).unref();

/** Milliseconds until this account may try to log in again (0 when not blocked). */
export function getAccountBlockRemainingMs(email: string): number {
  const state = accountTracker.get(accountKey(email));
  return state && state.blockedUntil > Date.now() ? state.blockedUntil - Date.now() : 0;
}

export function recordFailedLoginForAccount(email: string) {
  const key = accountKey(email);
  if (!key) return;
  if (accountTracker.size >= MAX_TRACKER_SIZE && !accountTracker.has(key)) {
    const firstKey = accountTracker.keys().next().value;
    if (firstKey) accountTracker.delete(firstKey);
  }

  const now = Date.now();
  let state = accountTracker.get(key);
  if (!state || (state.blockedUntil <= now && now - state.windowStart > ACCOUNT_WINDOW_MS)) {
    state = { failedAttempts: 0, windowStart: now, blockedUntil: 0 };
  }
  state.failedAttempts += 1;

  if (state.failedAttempts >= ACCOUNT_MAX_FAILURES) {
    state.blockedUntil = now + ACCOUNT_BLOCK_MS;
    // Start a fresh count once the block is in place.
    state.failedAttempts = 0;
    state.windowStart = now;
  }

  accountTracker.set(key, state);
}

export function resetAccountFailures(email: string) {
  accountTracker.delete(accountKey(email));
}

// Exported for testing/cleanup
export function clearRateLimitTracker() {
  tracker.clear();
  accountTracker.clear();
}
