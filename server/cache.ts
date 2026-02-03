interface CacheEntry<T> {
  data: T;
  expiry: number;
}

class SimpleCache {
  private cache: Map<string, CacheEntry<unknown>> = new Map();
  private defaultTTL: number;

  constructor(defaultTTLSeconds: number = 300) {
    this.defaultTTL = defaultTTLSeconds * 1000;
    
    // Cleanup expired entries every minute
    setInterval(() => this.cleanup(), 60000);
  }

  set<T>(key: string, value: T, ttlSeconds?: number): void {
    const ttl = (ttlSeconds ?? this.defaultTTL / 1000) * 1000;
    this.cache.set(key, {
      data: value,
      expiry: Date.now() + ttl,
    });
  }

  get<T>(key: string): T | undefined {
    const entry = this.cache.get(key);
    if (!entry) return undefined;
    
    if (Date.now() > entry.expiry) {
      this.cache.delete(key);
      return undefined;
    }
    
    return entry.data as T;
  }

  has(key: string): boolean {
    const entry = this.cache.get(key);
    if (!entry) return false;
    
    if (Date.now() > entry.expiry) {
      this.cache.delete(key);
      return false;
    }
    
    return true;
  }

  delete(key: string): boolean {
    return this.cache.delete(key);
  }

  clear(): void {
    this.cache.clear();
  }

  // Delete all keys matching a pattern
  invalidatePattern(pattern: string): number {
    let count = 0;
    for (const key of this.cache.keys()) {
      if (key.includes(pattern)) {
        this.cache.delete(key);
        count++;
      }
    }
    return count;
  }

  private cleanup(): void {
    const now = Date.now();
    for (const [key, entry] of this.cache.entries()) {
      if (now > entry.expiry) {
        this.cache.delete(key);
      }
    }
  }

  getStats() {
    return {
      size: this.cache.size,
      keys: Array.from(this.cache.keys()),
    };
  }
}

// Bible data cache - long TTL (1 hour) since Bible verses rarely change
export const bibleCache = new SimpleCache(3600);

// Timeline events cache - long TTL (1 hour)
export const timelineCache = new SimpleCache(3600);

// General API cache - shorter TTL (5 minutes)
export const apiCache = new SimpleCache(300);

// Cache key generators
export const cacheKeys = {
  bibleBooks: () => 'bible:books',
  bibleChapters: (bookName: string) => `bible:chapters:${bookName}`,
  bibleVerses: (bookName: string, chapter: number) => `bible:verses:${bookName}:${chapter}`,
  bibleSearch: (query: string) => `bible:search:${query}`,
  timelineSeasons: () => 'timeline:seasons',
  timelineEvents: (seasonId?: string) => seasonId ? `timeline:events:${seasonId}` : 'timeline:events:all',
  blessingVerse: () => 'blessing:random',
};
