import { serialize, deserialize } from 'node:v8';

export class BoundedCache<T> {
  private entries = new Map<string, { value: Buffer; expires: number; bytes: number }>();
  private bytes = 0;
  constructor(readonly maxBytes: number, readonly maxEntries: number) {}
  get(key: string): T | undefined {
    const entry = this.entries.get(key);
    if (!entry) return undefined;
    if (Date.now() >= entry.expires) { this.delete(key); return undefined; }
    this.entries.delete(key);
    this.entries.set(key, entry);
    return deserialize(entry.value) as T;
  }
  set(key: string, value: T, ttlMs: number): void {
    this.delete(key);
    if (!Number.isFinite(ttlMs) || ttlMs <= 0) return;
    let serialized: Buffer;
    try { serialized = serialize(value); }
    catch { return; }
    const bytes = serialized.byteLength + Buffer.byteLength(key) + 64;
    if (bytes > this.maxBytes || this.maxEntries < 1) return;
    this.cleanup();
    while (this.entries.size >= this.maxEntries || this.bytes + bytes > this.maxBytes) {
      this.delete(this.entries.keys().next().value!);
    }
    this.entries.set(key, { value: serialized, expires: Date.now() + ttlMs, bytes });
    this.bytes += bytes;
  }
  delete(key: string): boolean {
    const entry = this.entries.get(key);
    if (!entry) return false;
    this.bytes -= entry.bytes;
    return this.entries.delete(key);
  }
  clear(): void { this.entries.clear(); this.bytes = 0; }
  keys(): IterableIterator<string> { return this.entries.keys(); }
  cleanup(): void {
    for (const [key, entry] of this.entries) if (Date.now() >= entry.expires) this.delete(key);
  }
  getStats() {
    this.cleanup();
    return { size: this.entries.size, bytes: this.bytes, maxBytes: this.maxBytes, maxEntries: this.maxEntries };
  }
}
