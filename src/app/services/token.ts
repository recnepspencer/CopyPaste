import { Injectable, NgZone, signal } from '@angular/core';

interface PersistedEntry {
  count: number;
  mtimeMs: number;
}

@Injectable({
  providedIn: 'root',
})
export class TokenService {
  public worker: Worker | null = null;
  public cacheUpdated = signal<number>(0);
  private cache = new Map<string, number>();

  // mtime at the time the count was cached (used for persistent cache validation)
  private cachedMtimes = new Map<string, number>();

  // Store the active promises so we can reuse them (Deduplication)
  private pendingPromises = new Map<string, Promise<number>>();

  // Store the resolvers to call when worker replies
  private resolvers = new Map<string, (count: number) => void>();

  private static STORAGE_KEY = 'token-cache-v1';
  private persistDebounce: any;

  constructor(private ngZone: NgZone) {
    this.loadPersistedCache();
    this.initWorker();
  }

  // --- Persistence ---

  private loadPersistedCache() {
    try {
      const raw = localStorage.getItem(TokenService.STORAGE_KEY);
      if (!raw) return;
      const parsed: Record<string, PersistedEntry> = JSON.parse(raw);
      for (const [path, entry] of Object.entries(parsed)) {
        if (typeof entry.count === 'number' && typeof entry.mtimeMs === 'number') {
          this.cache.set(path, entry.count);
          this.cachedMtimes.set(path, entry.mtimeMs);
        }
      }
    } catch {
      // Corrupt storage — start fresh
      localStorage.removeItem(TokenService.STORAGE_KEY);
    }
  }

  private schedulePersist() {
    if (this.persistDebounce) clearTimeout(this.persistDebounce);
    this.persistDebounce = setTimeout(() => this.flushToStorage(), 500);
  }

  private flushToStorage() {
    try {
      const out: Record<string, PersistedEntry> = {};
      for (const [path, count] of this.cache.entries()) {
        const mtimeMs = this.cachedMtimes.get(path);
        if (mtimeMs !== undefined) {
          out[path] = { count, mtimeMs };
        }
      }
      localStorage.setItem(TokenService.STORAGE_KEY, JSON.stringify(out));
    } catch {
      // Storage full or unavailable — not critical
    }
  }

  // --- Worker lifecycle ---

  private initWorker() {
    if (typeof Worker === 'undefined') return;

    try {
      this.worker = new Worker(new URL('../app.worker', import.meta.url));

      this.worker.addEventListener('message', ({ data }) => {
        this.ngZone.run(() => {
          if (data.action === 'TOKEN_RESULT') {
            const { id, count } = data;
            if (this.resolvers.has(id)) {
              this.resolvers.get(id)!(count);
              this.resolvers.delete(id);
              this.pendingPromises.delete(id);
            }
          }
        });
      });

      this.worker.addEventListener('error', (e) => {
        console.error('Token worker error:', e.message);
        this.worker = null;
      });
    } catch (e) {
      console.error('Worker init failed', e);
      this.worker = null;
    }
  }

  // --- Public API ---

  /**
   * Returns the token count for the given file. Skips tokenization entirely
   * if the cached entry's mtimeMs matches the file's current mtimeMs on disk.
   */
  async getTokenCount(
    path: string,
    content: string,
    priority: boolean = false,
    mtimeMs?: number,
  ): Promise<number> {
    // 1. Cache Hit — valid if no mtime provided OR mtime matches stored mtime
    if (this.cache.has(path)) {
      const storedMtime = this.cachedMtimes.get(path);
      const mtimeValid =
        mtimeMs === undefined || storedMtime === undefined || storedMtime === mtimeMs;
      if (mtimeValid) {
        return this.cache.get(path)!;
      }
      // mtime changed — file was edited, evict and recompute
      this.cache.delete(path);
      this.cachedMtimes.delete(path);
    }

    // 2. Deduplication
    if (this.pendingPromises.has(path)) {
      return this.pendingPromises.get(path)!;
    }

    // 3. No worker available — return 0
    if (!this.worker) {
      return 0;
    }

    // 4. Send to web worker
    const promise = new Promise<number>((resolve) => {
      this.resolvers.set(path, (count) => {
        this.cache.set(path, count);
        if (mtimeMs !== undefined) this.cachedMtimes.set(path, mtimeMs);
        this.cacheUpdated.update((v) => v + 1);
        this.schedulePersist();
        resolve(count);
      });

      // Safety Timeout — if the worker doesn't respond in time, recover gracefully
      setTimeout(() => {
        this.ngZone.run(() => {
          if (this.resolvers.has(path)) {
            this.resolvers.delete(path);
            this.pendingPromises.delete(path);
            this.cache.set(path, 0);
            this.cacheUpdated.update((v) => v + 1);
            console.warn('TokenService: worker timed out for', path);
            resolve(0);
          }
        });
      }, 5000);

      this.worker!.postMessage({
        action: 'TOKENIZE',
        payload: { id: path, content, priority },
      });
    });

    this.pendingPromises.set(path, promise);

    promise.finally(() => {
      this.pendingPromises.delete(path);
    });

    return promise;
  }

  getCachedCount(path: string): number {
    return this.cache.get(path) || 0;
  }

  hasCached(path: string): boolean {
    return this.cache.has(path);
  }

  /**
   * Forces a clear of the internal token cache + localStorage.
   * Call this when files might have changed on disk (e.g. Refresh button).
   */
  clearCache() {
    this.cache.clear();
    this.cachedMtimes.clear();
    this.cacheUpdated.update((v) => v + 1);
    this.pendingPromises.clear();
    this.resolvers.clear();
    localStorage.removeItem(TokenService.STORAGE_KEY);
  }
}
