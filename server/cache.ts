import { BoundedCache } from './boundedCache';

export class SimpleCache {
  private cache: BoundedCache<unknown>;
  constructor(private defaultTTLSeconds = 300, maxBytes = 8 * 1024 * 1024, maxEntries = 512) {
    this.cache = new BoundedCache(maxBytes, maxEntries);
  }
  set<T>(key: string, value: T, ttlSeconds = this.defaultTTLSeconds): void {
    this.cache.set(key, value, ttlSeconds * 1000);
  }
  get<T>(key: string): T | undefined { return this.cache.get(key) as T | undefined; }
  has(key: string): boolean { return this.cache.get(key) !== undefined; }
  delete(key: string): boolean { return this.cache.delete(key); }
  clear(): void { this.cache.clear(); }
  invalidatePattern(pattern: string): number {
    let count = 0;
    for (const key of this.cache.keys()) if (key.includes(pattern)) { this.cache.delete(key); count++; }
    return count;
  }
  getStats() { return { ...this.cache.getStats(), keys: Array.from(this.cache.keys()) }; }
}

export class SessionCache {
  private cache: BoundedCache<unknown>;
  constructor(maxBytes = 8 * 1024 * 1024, maxEntries = 512) {
    this.cache = new BoundedCache(maxBytes, maxEntries);
  }
  get<T>(key: string): T | null { return (this.cache.get(key) as T | undefined) ?? null; }
  set<T>(key: string, data: T, ttlMs = 2000): void { this.cache.set(key, data, ttlMs); }
  invalidate(pattern: string): void {
    for (const key of this.cache.keys()) if (key.startsWith(pattern)) this.cache.delete(key);
  }
  clear(): void { this.cache.clear(); }
  getStats() { return this.cache.getStats(); }
}

export const sessionCache = new SessionCache();
export const bibleCache = new SimpleCache(3600);
export const timelineCache = new SimpleCache(3600);
export const apiCache = new SimpleCache(300);
export const prayerCache = new SimpleCache(5);

// Cache key generators
export const cacheKeys = {
  bibleBooks: () => 'bible:books',
  bibleChapters: (bookName: string) => `bible:chapters:${bookName}`,
  bibleVerses: (bookName: string, chapter: number) => `bible:verses:${bookName}:${chapter}`,
  bibleSearch: (query: string) => `bible:search:${query}`,
  timelineSeasons: () => 'timeline:seasons',
  timelineEvents: (seasonId?: string) => seasonId ? `timeline:events:${seasonId}` : 'timeline:events:all',
  blessingVerse: () => 'blessing:random',
  prayers: () => 'prayers:all',
  prayerComments: (prayerId: string) => `prayers:comments:${prayerId}`,
  featureToggles: () => 'feature:toggles',
};
