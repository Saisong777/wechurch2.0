/**
 * Retry utilities for handling transient failures during high-concurrency scenarios.
 * These helpers implement exponential backoff to reduce thundering herd effects.
 */

export interface RetryOptions {
  maxRetries?: number;
  baseDelay?: number;
  maxDelay?: number;
  onRetry?: (attempt: number, error: Error) => void;
}

const DEFAULT_OPTIONS: Required<Omit<RetryOptions, 'onRetry'>> = {
  maxRetries: 3,
  baseDelay: 1000,  // 1 second
  maxDelay: 10000,  // 10 seconds max
};

/**
 * Adds jitter to delay to prevent thundering herd
 */
function addJitter(delay: number): number {
  // Add ±30% jitter
  const jitter = delay * 0.3 * (Math.random() * 2 - 1);
  return Math.max(100, delay + jitter);
}

/**
 * Calculate exponential backoff delay with jitter
 */
function calculateDelay(attempt: number, baseDelay: number, maxDelay: number): number {
  const exponentialDelay = baseDelay * Math.pow(2, attempt - 1);
  const cappedDelay = Math.min(exponentialDelay, maxDelay);
  return addJitter(cappedDelay);
}

/**
 * Sleep for a specified duration
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Check if an error is retryable
 */
function isRetryableError(error: any): boolean {
  // Network errors
  if (error?.message?.includes('fetch') || error?.message?.includes('network')) {
    return true;
  }
  
  // Database connection errors
  if (error?.code === 'PGRST301' || error?.code === 'PGRST502') {
    return true;
  }
  
  // Timeout errors
  if (error?.message?.includes('timeout') || error?.message?.includes('timed out')) {
    return true;
  }
  
  // Rate limiting (should back off and retry)
  if (error?.status === 429 || error?.code === '429') {
    return true;
  }
  
  // 5xx server errors (temporary)
  if (error?.status >= 500 && error?.status < 600) {
    return true;
  }
  
  // Connection pool exhaustion
  if (error?.message?.includes('connection') || error?.message?.includes('pool')) {
    return true;
  }
  
  return false;
}

/**
 * Execute a function with retry logic and exponential backoff.
 * Useful for database operations that may fail during high load.
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const { maxRetries, baseDelay, maxDelay } = { ...DEFAULT_OPTIONS, ...options };
  
  let lastError: Error | null = null;
  
  for (let attempt = 1; attempt <= maxRetries + 1; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      
      // Don't retry on non-retryable errors or last attempt
      if (!isRetryableError(error) || attempt > maxRetries) {
        throw lastError;
      }
      
      const delay = calculateDelay(attempt, baseDelay, maxDelay);
      console.log(`[Retry] Attempt ${attempt} failed, retrying in ${Math.round(delay)}ms...`, lastError.message);
      
      if (options.onRetry) {
        options.onRetry(attempt, lastError);
      }
      
      await sleep(delay);
    }
  }
  
  throw lastError || new Error('Retry failed with unknown error');
}

/**
 * Create a rate-limited version of a function.
 * Prevents more than `limit` calls within `windowMs`.
 */
export function createRateLimiter<T extends (...args: any[]) => Promise<any>>(
  fn: T,
  limit: number,
  windowMs: number
): T {
  const calls: number[] = [];
  
  return (async (...args: Parameters<T>) => {
    const now = Date.now();
    
    // Remove old calls outside the window
    while (calls.length > 0 && calls[0] < now - windowMs) {
      calls.shift();
    }
    
    // If at limit, wait until oldest call expires
    if (calls.length >= limit) {
      const waitTime = calls[0] + windowMs - now;
      if (waitTime > 0) {
        await sleep(waitTime + addJitter(100));
      }
      calls.shift();
    }
    
    calls.push(now);
    return fn(...args);
  }) as T;
}

/**
 * Batch multiple calls into a single operation.
 * Useful for reducing database load when multiple components request similar data.
 */
export function createBatcher<K, V>(
  fetchFn: (keys: K[]) => Promise<Map<K, V>>,
  delayMs: number = 50
): (key: K) => Promise<V | undefined> {
  let pendingKeys: K[] = [];
  let pendingPromise: Promise<Map<K, V>> | null = null;
  let timeout: NodeJS.Timeout | null = null;
  
  return async (key: K) => {
    pendingKeys.push(key);
    
    if (!pendingPromise) {
      pendingPromise = new Promise((resolve) => {
        timeout = setTimeout(async () => {
          const keysToFetch = [...pendingKeys];
          pendingKeys = [];
          pendingPromise = null;
          timeout = null;
          
          try {
            const results = await fetchFn(keysToFetch);
            resolve(results);
          } catch (error) {
            resolve(new Map());
          }
        }, delayMs);
      });
    }
    
    const results = await pendingPromise;
    return results.get(key);
  };
}
