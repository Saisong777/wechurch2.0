import { BoundedCache } from '../boundedCache';

// Only immutable reference-reader actions belong here, never member notes or feeds.
const publicActions = new Set(['info', 'chapter', 'notes', 'tokens', 'dictionary', 'xrefs', 'preview', 'search', 'item']);
export class PublicReferenceCache {
  private cache: BoundedCache<unknown>;
  private inflight = new Map<string, Promise<unknown>>();
  constructor(private namespace: string, maxBytes = 32 * 1024 * 1024, maxEntries = 512) {
    this.cache = new BoundedCache(maxBytes, maxEntries);
  }
  load(action: string, parameters: Record<string, string>, loader: () => Promise<unknown>): Promise<unknown> {
    if (!publicActions.has(action)) return Promise.reject(Object.assign(new Error('Not a public reference action'), { status: 400 }));
    const key = JSON.stringify([this.namespace, action, Object.entries(parameters).sort(([a], [b]) => a.localeCompare(b))]);
    const cached = this.cache.get(key);
    if (cached !== undefined) return Promise.resolve(cached);
    const existing = this.inflight.get(key);
    if (existing) return existing;
    if (this.inflight.size >= 24) return Promise.reject(Object.assign(new Error('目前使用人數較多，請稍後重試。'), { status: 429 }));
    const request = Promise.resolve().then(loader).then(value => {
      this.cache.set(key, value, 5 * 60 * 1000);
      return value;
    }).finally(() => { this.inflight.delete(key); });
    this.inflight.set(key, request);
    return request;
  }
  getStats() { return { ...this.cache.getStats(), inflight: this.inflight.size }; }
}
