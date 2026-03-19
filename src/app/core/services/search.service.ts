import { Injectable, signal, NgZone } from '@angular/core';
import { matchesExcludePattern } from '../utils/pattern-matcher';

export interface ExcludePattern {
  id: string;
  pattern: string;
  enabled: boolean;
}

export interface IncludeFolder {
  id: string;
  path: string;
  enabled: boolean;
}

@Injectable({
  providedIn: 'root',
})
export class SearchService {
  // --- State Signals ---
  searchQuery = signal<string>('');

  // Filters
  searchIncludeFolders = signal<IncludeFolder[]>([]);
  searchExcludePatterns = signal<ExcludePattern[]>([]);

  // Results
  workerSearchResults = signal<{ name: string; path: string }[]>([]);
  isSearching = signal<boolean>(false);

  // UI Helpers (Limits, Visibility)
  searchResultsLimit = signal<number>(10);
  showSearchResults = signal<boolean>(false);

  // Own worker reference (shared web worker, separate instance for search)
  worker: Worker | null = null;

  // Default excludes
  private defaultExcludePatterns = [
    '**/node_modules/**',
    '**/.git/**',
    '**/.vscode/**',
    '**/.idea/**',
    '**/dist/**',
    '**/build/**',
    '**/.next/**',
    '**/coverage/**',
    '**/.DS_Store',
    '**/Thumbs.db',
  ];

  constructor(private ngZone: NgZone) {
    this.loadSettings();
    this.initWorker();
  }

  // --- Worker Lifecycle ---

  private initWorker() {
    if (typeof Worker === 'undefined') return;

    try {
      this.worker = new Worker(new URL('../../app.worker', import.meta.url));

      this.worker.addEventListener('message', ({ data }) => {
        this.ngZone.run(() => {
          if (data.action === 'SEARCH_RESULT') {
            this.workerSearchResults.set(data.results);
            this.isSearching.set(false);
          }
        });
      });

      this.worker.addEventListener('error', (e) => {
        console.error('Search worker error:', e.message);
        this.worker = null;
      });
    } catch (e) {
      console.error('Search worker init failed', e);
      this.worker = null;
    }
  }

  // --- Public API for file sync ---

  updateFiles(files: { name: string; path: string }[]) {
    if (this.worker) {
      this.worker.postMessage({ action: 'UPDATE_FILES', payload: files });
    }
  }

  triggerSearch() {
    if (!this.worker) {
      console.warn('Worker not available for search');
      return;
    }

    this.isSearching.set(true);

    const enabledIncludes = this.searchIncludeFolders()
      .filter((f) => f.enabled)
      .map((f) => f.path);

    const enabledExcludes = this.searchExcludePatterns()
      .filter((p) => p.enabled)
      .map((p) => p.pattern);

    this.worker.postMessage({
      action: 'SEARCH',
      payload: {
        query: this.searchQuery(),
        includes: enabledIncludes,
        excludes: enabledExcludes,
        limit: 2000,
      },
    });
  }

  // --- Actions: Include Folders ---

  addIncludeFolder(path: string) {
    const current = this.searchIncludeFolders();
    if (current.some((f) => f.path === path)) return; // No duplicates

    const newFolder: IncludeFolder = {
      id: crypto.randomUUID(),
      path,
      enabled: true,
    };

    this.searchIncludeFolders.set([...current, newFolder]);
    this.saveSettings();
  }

  removeIncludeFolder(id: string) {
    this.searchIncludeFolders.update((list) => list.filter((f) => f.id !== id));
    this.saveSettings();
  }

  toggleIncludeFolder(id: string) {
    this.searchIncludeFolders.update((list) =>
      list.map((f) => (f.id === id ? { ...f, enabled: !f.enabled } : f)),
    );
    this.saveSettings();
  }

  updateIncludeFolder(id: string, newPath: string) {
    const trimmed = newPath.trim();
    if (!trimmed) {
      this.removeIncludeFolder(id);
      return;
    }
    this.searchIncludeFolders.update((list) =>
      list.map((f) => (f.id === id ? { ...f, path: trimmed } : f)),
    );
    this.saveSettings();
  }

  // --- Actions: Exclude Patterns ---

  addExcludePattern(pattern: string) {
    const trimmed = pattern.trim();
    if (!trimmed) return;

    const current = this.searchExcludePatterns();
    if (current.some((p) => p.pattern === trimmed)) return;

    const newPattern: ExcludePattern = {
      id: crypto.randomUUID(),
      pattern: trimmed,
      enabled: true,
    };

    this.searchExcludePatterns.set([...current, newPattern]);
    this.saveSettings();
  }

  removeExcludePattern(id: string) {
    this.searchExcludePatterns.update((list) => list.filter((p) => p.id !== id));
    this.saveSettings();
  }

  toggleExcludePattern(id: string) {
    this.searchExcludePatterns.update((list) =>
      list.map((p) => (p.id === id ? { ...p, enabled: !p.enabled } : p)),
    );
    this.saveSettings();
  }

  updateExcludePattern(id: string, newPattern: string) {
    const trimmed = newPattern.trim();
    if (!trimmed) {
      this.removeExcludePattern(id);
      return;
    }
    this.searchExcludePatterns.update((list) =>
      list.map((p) => (p.id === id ? { ...p, pattern: trimmed } : p)),
    );
    this.saveSettings();
  }

  // --- Conflict Logic ---

  hasIncludeConflict(folderPath: string): boolean {
    const enabledExcludes = this.searchExcludePatterns().filter((p) => p.enabled);
    return enabledExcludes.some((p) => {
      return (
        matchesExcludePattern(folderPath, p.pattern) ||
        folderPath.includes(p.pattern.replace(/\*\*/g, ''))
      );
    });
  }

  getIncludeConflictMessage(folderPath: string): string {
    const enabledExcludes = this.searchExcludePatterns().filter((p) => p.enabled);
    const conflicts = enabledExcludes.filter((p) => {
      return (
        matchesExcludePattern(folderPath, p.pattern) ||
        folderPath.includes(p.pattern.replace(/\*\*/g, ''))
      );
    });

    if (conflicts.length === 0) return '';
    const patternNames = conflicts.map((c) => `"${c.pattern}"`).join(', ');
    return `Conflicts with exclude pattern(s): ${patternNames}`;
  }

  hasExcludeConflict(pattern: string): boolean {
    const enabledFolders = this.searchIncludeFolders().filter((f) => f.enabled);
    return enabledFolders.some((f) => {
      return (
        matchesExcludePattern(f.path, pattern) || f.path.includes(pattern.replace(/\*\*/g, ''))
      );
    });
  }

  // --- Persistence ---

  private loadSettings() {
    try {
      const savedIncludes = localStorage.getItem('searchIncludeFolders');
      if (savedIncludes) this.searchIncludeFolders.set(JSON.parse(savedIncludes));

      const savedExcludes = localStorage.getItem('searchExcludePatterns');
      if (savedExcludes) {
        this.searchExcludePatterns.set(JSON.parse(savedExcludes));
      } else {
        // Init with defaults if empty
        this.searchExcludePatterns.set(
          this.defaultExcludePatterns.map((p) => ({
            id: crypto.randomUUID(),
            pattern: p,
            enabled: true,
          })),
        );
      }
    } catch (e) {
      console.error('Error loading search settings', e);
    }
  }

  private saveSettings() {
    localStorage.setItem('searchIncludeFolders', JSON.stringify(this.searchIncludeFolders()));
    localStorage.setItem('searchExcludePatterns', JSON.stringify(this.searchExcludePatterns()));
  }
}
