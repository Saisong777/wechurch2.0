/** AbortController-based request lifetime for browsers without AbortSignal.any/timeout.
 * Keep the work promise open through body decoding so timeout/caller cancellation
 * cannot turn a late response into a successful result. No global polyfill.
 */
export function withRequestTimeout<T>(
  upstream: AbortSignal | null | undefined,
  work: (signal: AbortSignal) => Promise<T>,
  timeoutMs = 15000,
): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const controller = new AbortController();
    let settled = false;
    const cleanup = () => {
      clearTimeout(timer);
      upstream?.removeEventListener('abort', onCallerAbort);
    };
    const fail = (error: unknown) => {
      if (settled) return;
      settled = true;
      cleanup();
      reject(error);
    };
    const cancel = (reason: unknown) => {
      if (settled) return;
      fail(reason);
      controller.abort();
    };
    const onCallerAbort = () => cancel(upstream?.reason ?? new DOMException('請求已取消。', 'AbortError'));
    const timer = setTimeout(() => cancel(new DOMException('請求逾時，請重新確認結果。', 'TimeoutError')), timeoutMs);
    if (upstream?.aborted) {
      onCallerAbort();
      return;
    }
    upstream?.addEventListener('abort', onCallerAbort, { once: true });
    // Handle both synchronous throws and rejected/late work without unhandled promises.
    Promise.resolve().then(() => {
      if (controller.signal.aborted) throw new DOMException('請求已取消。', 'AbortError');
      return work(controller.signal);
    }).then(value => {
      if (settled) return;
      settled = true;
      cleanup();
      resolve(value);
    }, fail);
  });
}

/** Guard continuations after headers/body await even if a transport ignores abort. */
export function throwIfRequestAborted(signal: AbortSignal): void {
  if (signal.aborted) throw new DOMException('請求已取消。', 'AbortError');
}
