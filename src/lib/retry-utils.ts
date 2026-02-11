/**
 * Retry utilities with exponential backoff and jitter
 * Designed for high-concurrency scenarios (500+ users)
 * 
 * Jitter prevents "thundering herd" - all clients retrying at the same time
 */

export interface RetryOptions {
  maxRetries?: number;
  baseDelayMs?: number;
  maxDelayMs?: number;
  jitterFactor?: number; // 0-1, how much randomness to add
}

const DEFAULT_OPTIONS: Required<RetryOptions> = {
  maxRetries: 3,
  baseDelayMs: 1000,
  maxDelayMs: 10000,
  jitterFactor: 0.3,
};

/**
 * Calculate delay with exponential backoff and jitter
 */
export function calculateBackoffDelay(
  attempt: number,
  options: RetryOptions = {}
): number {
  const { baseDelayMs, maxDelayMs, jitterFactor } = { ...DEFAULT_OPTIONS, ...options };
  
  // Exponential backoff: base * 2^attempt
  const exponentialDelay = baseDelayMs * Math.pow(2, attempt);
  
  // Cap at max delay
  const cappedDelay = Math.min(exponentialDelay, maxDelayMs);
  
  // Add jitter: randomize within ±jitterFactor of the delay
  const jitter = cappedDelay * jitterFactor * (Math.random() * 2 - 1);
  
  return Math.max(0, cappedDelay + jitter);
}

/**
 * Sleep for a specified duration
 */
export function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Execute a function with retry logic, exponential backoff, and jitter
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const { maxRetries } = { ...DEFAULT_OPTIONS, ...options };
  let lastError: Error | undefined;
  
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      
      if (attempt < maxRetries) {
        const delay = calculateBackoffDelay(attempt, options);
        console.log(`[Retry] Attempt ${attempt + 1}/${maxRetries + 1} failed, retrying in ${Math.round(delay)}ms...`);
        await sleep(delay);
      }
    }
  }
  
  throw lastError;
}

/**
 * Stagger initial connections to prevent thundering herd on page load
 * Returns a promise that resolves after a random delay
 */
export function staggeredStart(maxDelayMs: number = 2000): Promise<void> {
  const delay = Math.random() * maxDelayMs;
  return sleep(delay);
}

/**
 * Configuration constants for high-concurrency polling
 * Optimized for 500+ concurrent users
 */
export const HIGH_CONCURRENCY_CONFIG = {
  // Realtime heartbeat - increased to reduce DB load
  HEARTBEAT_INTERVAL_MS: 8000, // 8 seconds (was 3s)
  
  // Study response polling - increased since we have debounced saves
  STUDY_RESPONSE_POLL_MS: 10000, // 10 seconds (was 4s)
  
  // Group verification polling - WebSocket primary, this is fallback
  GROUP_VERIFICATION_POLL_MS: 10000, // 10 seconds (was 5s)
  
  // Debounce delay for saves - slightly increased
  SAVE_DEBOUNCE_MS: 1500, // 1.5 seconds (was 1s)
  
  // Stale time for queries - should be slightly less than poll interval
  STALE_TIME_BUFFER_MS: 500,
  
  PRAYER_WALL_POLL_MS: 10000, // 10 seconds (was 5s)
  PRAYER_NOTIFICATION_POLL_MS: 30000, // 30 seconds (was 15s)
  PRAYER_NOTIFICATION_FULL_POLL_MS: 60000, // 60 seconds (was 30s)
  FEATURE_TOGGLE_POLL_MS: 120000, // 2 minutes - toggles rarely change
} as const;

/**
 * Mobile polling multiplier for adaptive intervals on mobile devices
 * Polling intervals are increased by this factor on mobile to reduce battery drain
 */
export const MOBILE_POLLING_MULTIPLIER = 1.5;

/**
 * Detect if the device is a mobile device
 * Checks user agent for mobile patterns and falls back to window width check
 * Returns false on server-side (SSR environments)
 */
export function isMobileDevice(): boolean {
  // Server-side check
  if (typeof window === 'undefined') {
    return false;
  }

  // Check user agent for common mobile patterns
  const mobilePatterns = /iPhone|iPad|Android|webOS|BlackBerry|IEMobile|Opera Mini/i;
  if (mobilePatterns.test(navigator.userAgent)) {
    return true;
  }

  // Fallback: check viewport width (tablets and phones typically under 768px)
  return window.innerWidth < 768;
}

/**
 * Get adaptive polling interval based on device type
 * Increases intervals on mobile devices to reduce battery drain
 * Adds jitter to prevent thundering herd
 * @param baseMs - Base polling interval in milliseconds
 * @returns Adjusted polling interval with jitter in milliseconds
 */
export function getPollingInterval(baseMs: number): number {
  const multiplier = isMobileDevice() ? MOBILE_POLLING_MULTIPLIER : 1;
  const adjustedMs = baseMs * multiplier;
  const jitter = Math.random() * 2000;
  return adjustedMs + jitter;
}
