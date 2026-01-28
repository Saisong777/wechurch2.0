/**
 * Retry utilities with exponential backoff and jitter
 * Optimized for high-concurrency scenarios (100+ concurrent users)
 */

interface RetryOptions {
  maxRetries?: number;
  baseDelay?: number;
  maxDelay?: number;
  jitterFactor?: number;
}

const DEFAULT_OPTIONS: Required<RetryOptions> = {
  maxRetries: 3,
  baseDelay: 1000,
  maxDelay: 10000,
  jitterFactor: 0.3, // 30% jitter
};

/**
 * Calculate delay with exponential backoff and jitter
 * Jitter prevents thundering herd problem when many clients retry simultaneously
 */
export function calculateBackoffDelay(
  attempt: number,
  options: RetryOptions = {}
): number {
  const { baseDelay, maxDelay, jitterFactor } = { ...DEFAULT_OPTIONS, ...options };
  
  // Exponential backoff: baseDelay * 2^attempt
  const exponentialDelay = baseDelay * Math.pow(2, attempt);
  
  // Cap at maxDelay
  const cappedDelay = Math.min(exponentialDelay, maxDelay);
  
  // Add random jitter (±jitterFactor)
  const jitter = cappedDelay * jitterFactor * (Math.random() * 2 - 1);
  
  return Math.round(cappedDelay + jitter);
}

/**
 * Sleep for a specified duration
 */
export function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Retry a function with exponential backoff and jitter
 * Use this for database operations that might fail under high load
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const { maxRetries } = { ...DEFAULT_OPTIONS, ...options };
  
  let lastError: Error | null = null;
  
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error as Error;
      
      if (attempt < maxRetries) {
        const delay = calculateBackoffDelay(attempt, options);
        console.log(`[Retry] Attempt ${attempt + 1} failed, retrying in ${delay}ms...`);
        await sleep(delay);
      }
    }
  }
  
  throw lastError;
}

/**
 * Create a debounced function that delays execution
 * Useful for reducing rapid-fire database updates
 */
export function createDebouncedFn<T extends (...args: any[]) => any>(
  fn: T,
  delay: number
): (...args: Parameters<T>) => void {
  let timeoutId: NodeJS.Timeout | null = null;
  
  return (...args: Parameters<T>) => {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
    
    timeoutId = setTimeout(() => {
      fn(...args);
      timeoutId = null;
    }, delay);
  };
}

/**
 * Create a throttled function that limits execution rate
 * Useful for preventing too many requests in a short time
 */
export function createThrottledFn<T extends (...args: any[]) => any>(
  fn: T,
  limit: number
): (...args: Parameters<T>) => void {
  let inThrottle = false;
  let lastArgs: Parameters<T> | null = null;
  
  return (...args: Parameters<T>) => {
    if (!inThrottle) {
      fn(...args);
      inThrottle = true;
      
      setTimeout(() => {
        inThrottle = false;
        if (lastArgs) {
          fn(...lastArgs);
          lastArgs = null;
        }
      }, limit);
    } else {
      lastArgs = args;
    }
  };
}

/**
 * Generate a random interval with jitter for polling
 * Prevents all clients from polling at the exact same time
 */
export function getJitteredInterval(baseInterval: number, jitterPercent: number = 0.2): number {
  const jitter = baseInterval * jitterPercent * (Math.random() * 2 - 1);
  return Math.round(baseInterval + jitter);
}
