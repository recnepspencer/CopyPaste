import { Injectable, signal, computed, NgZone } from '@angular/core';
import { ElectronService } from '../../services/electron';
import { TokenService } from '../../services/token';
import { SearchService } from '../services/search.service';
import { FileNode } from '../../components/file-tree/file-tree';

export interface Workspace {
  id: string; // The root folder path
  name: string; // The folder name (basename)
  files: FileNode[];
}

@Injectable({
  providedIn: 'root',
})
export class ProjectStateService {
  // --- Core State ---
  workspaces = signal<Workspace[]>([]);
  activeWorkspaceId = signal<string | null>(null);
  isProjectLoading = signal<boolean>(false);
  isRefreshing = signal<boolean>(false);
  recentProjects = signal<string[]>([]);

  // --- Selection & Expansion (immutable signal-based) ---
  selectedPaths = signal<Set<string>>(new Set());
  expandedPaths = signal<Set<string>>(new Set());

  // --- Derived State ---
  activeWorkspace = computed(() => {
    const id = this.activeWorkspaceId();
    return this.workspaces().find((w) => w.id === id) || null;
  });

  files = computed<FileNode[]>(() => this.activeWorkspace()?.files || []);

  allNodesFlat = computed<FileNode[]>(() => {
    const result: FileNode[] = [];
    const traverse = (nodes: FileNode[]) => {
      for (const node of nodes) {
        result.push(node);
        if (node.children) traverse(node.children);
      }
    };
    traverse(this.files());
    return result;
  });

  currentFolderPath = computed<string>(() => this.activeWorkspace()?.id || '');

  totalSelectedTokens = computed<number>(() => {
    // Re-read cacheUpdated so this recomputes when tokens finish loading
    this.tokenService.cacheUpdated();
    const selected = this.selectedPaths();
    let total = 0;
    for (const path of selected) {
      total += this.tokenService.getCachedCount(path);
    }
    return total;
  });

  selectedFileCount = computed<number>(() => this.selectedPaths().size);

  // --- Auto-refresh throttle ---
  private lastAutoRefreshTime = 0;
  private autoRefreshThrottleMs = 2000;

  constructor(
    private electron: ElectronService,
    private tokenService: TokenService,
    private searchService: SearchService,
    private ngZone: NgZone,
  ) {
    this.loadRecentProjects();

    // Listen for filesystem changes from the Electron main process
    this.electron.onFsChanged(() => {
      this.ngZone.run(() => this.handleFsChanged());
    });
  }

  private handleFsChanged() {
    // Don't auto-refresh if already refreshing or if throttle hasn't elapsed
    if (this.isRefreshing()) return;
    const now = Date.now();
    if (now - this.lastAutoRefreshTime < this.autoRefreshThrottleMs) return;
    this.lastAutoRefreshTime = now;
    this.refreshProject();
  }

  // --- Project Actions ---

  async openProject(path?: string) {
    const targetPath = path || (await this.electron.selectDirectory());
    if (!targetPath) return;

    const normalizedPath = targetPath.replace(/\\/g, '/');

    // If already open, just switch to it
    const existing = this.workspaces().find((w) => w.id === normalizedPath);
    if (existing) {
      this.activeWorkspaceId.set(normalizedPath);
      this.syncFilesToWorker(existing.files);
      return;
    }

    this.isProjectLoading.set(true);
    try {
      await this.loadDirectoryData(normalizedPath);
      this.addToRecentProjects(normalizedPath);
    } catch (err) {
      console.error('Failed to load project:', err);
    } finally {
      this.isProjectLoading.set(false);
    }
  }

  async refreshProject(): Promise<void> {
    const currentPath = this.currentFolderPath();
    if (!currentPath) return;

    this.isRefreshing.set(true);
    try {
      this.tokenService.clearCache();
      await this.loadDirectoryData(currentPath);
      // Kick off token calculation for currently selected files
      this.calculateSelectedTokens();
    } catch (err) {
      console.error('Failed to refresh project:', err);
    } finally {
      this.isRefreshing.set(false);
    }
  }

  closeProject(id: string) {
    this.workspaces.update((ws) => ws.filter((w) => w.id !== id));

    if (this.activeWorkspaceId() === id) {
      const remaining = this.workspaces();
      if (remaining.length > 0) {
        this.activeWorkspaceId.set(remaining[remaining.length - 1].id);
        this.syncFilesToWorker(remaining[remaining.length - 1].files);
        // Start watching the new active workspace
        this.electron.watchDirectory(remaining[remaining.length - 1].id);
      } else {
        this.activeWorkspaceId.set(null);
        this.selectedPaths.set(new Set());
        this.expandedPaths.set(new Set());
        // No workspaces left, stop watching
        this.electron.unwatchDirectory();
      }
    }
  }

  switchWorkspace(id: string) {
    this.activeWorkspaceId.set(id);
    const active = this.activeWorkspace();
    if (active) {
      this.syncFilesToWorker(active.files);
      // Switch watcher to the new active workspace
      this.electron.watchDirectory(active.id);
    }
  }

  // --- Selection Actions ---

  toggleSelection(path: string, nodeType: 'file' | 'folder', children?: FileNode[]) {
    this.selectedPaths.update((prev) => {
      const next = new Set(prev);
      if (nodeType === 'file') {
        next.has(path) ? next.delete(path) : next.add(path);
      } else if (nodeType === 'folder' && children) {
        // Check if all descendant files are selected
        const descendantFiles = this.getDescendantFiles(children);
        const allSelected = descendantFiles.every((f) => next.has(f.path));
        if (allSelected) {
          for (const f of descendantFiles) next.delete(f.path);
        } else {
          for (const f of descendantFiles) next.add(f.path);
        }
      }
      return next;
    });
    this.calculateSelectedTokens();
  }

  selectRange(startPath: string, endPath: string) {
    const flat = this.allNodesFlat();
    const startIndex = flat.findIndex((n) => n.path === startPath);
    const endIndex = flat.findIndex((n) => n.path === endPath);
    if (startIndex === -1 || endIndex === -1) return;

    const minIndex = Math.min(startIndex, endIndex);
    const maxIndex = Math.max(startIndex, endIndex);

    this.selectedPaths.update((prev) => {
      const next = new Set(prev);
      const targetState = !prev.has(flat[endIndex].path);
      for (let i = minIndex; i <= maxIndex; i++) {
        const node = flat[i];
        if (targetState) {
          next.add(node.path);
          if (node.type === 'folder' && node.children) {
            for (const f of this.getDescendantFiles(node.children)) next.add(f.path);
          }
        } else {
          next.delete(node.path);
          if (node.type === 'folder' && node.children) {
            for (const f of this.getDescendantFiles(node.children)) next.delete(f.path);
          }
        }
      }
      return next;
    });
    this.calculateSelectedTokens();
  }

  setSelection(paths: Set<string>) {
    this.selectedPaths.set(paths);
    this.calculateSelectedTokens();
  }

  clearSelection() {
    this.selectedPaths.set(new Set());
  }

  isSelected(path: string): boolean {
    return this.selectedPaths().has(path);
  }

  isFolderFullySelected(children: FileNode[]): boolean {
    const descendants = this.getDescendantFiles(children);
    if (descendants.length === 0) return false;
    const selected = this.selectedPaths();
    return descendants.every((f) => selected.has(f.path));
  }

  // --- Expansion Actions ---

  toggleExpanded(path: string) {
    this.expandedPaths.update((prev) => {
      const next = new Set(prev);
      next.has(path) ? next.delete(path) : next.add(path);
      return next;
    });
  }

  isExpanded(path: string): boolean {
    return this.expandedPaths().has(path);
  }

  expandParentsForFile(filePath: string) {
    this.expandedPaths.update((prev) => {
      const next = new Set(prev);
      const parts = filePath.split('/');
      for (let i = 1; i < parts.length; i++) {
        next.add(parts.slice(0, i).join('/'));
      }
      return next;
    });
  }

  // --- Utilities ---

  getSelectedFilePaths(): string[] {
    return Array.from(this.selectedPaths());
  }

  // --- Private ---

  private async loadDirectoryData(path: string) {
    const result = await this.electron.readDirectory(path);

    const normalizeNodes = (nodes: FileNode[]): FileNode[] => {
      return nodes.map((node) => ({
        ...node,
        path: node.path.replace(/\\/g, '/'),
        children: node.children ? normalizeNodes(node.children) : undefined,
      }));
    };

    const normalizedResult = normalizeNodes(result);
    const folderName = path.split('/').pop() || path;

    const newWorkspace: Workspace = {
      id: path,
      name: folderName,
      files: normalizedResult,
    };

    this.workspaces.update((ws) => {
      const idx = ws.findIndex((w) => w.id === path);
      if (idx >= 0) {
        const copy = [...ws];
        copy[idx] = newWorkspace;
        return copy;
      }
      return [...ws, newWorkspace];
    });

    this.activeWorkspaceId.set(path);
    this.syncFilesToWorker(normalizedResult);

    // Start watching this directory for changes
    this.electron.watchDirectory(path);
  }

  private syncFilesToWorker(nodes: FileNode[]) {
    if (nodes.length > 0) {
      const flat = this.getDescendantFiles(nodes).map((f) => ({
        name: f.name,
        path: f.path,
      }));
      this.searchService.updateFiles(flat);
    }
  }

  private getDescendantFiles(nodes: FileNode[]): FileNode[] {
    const files: FileNode[] = [];
    const traverse = (nodeList: FileNode[]) => {
      for (const node of nodeList) {
        if (node.type === 'file') files.push(node);
        if (node.children) traverse(node.children);
      }
    };
    traverse(nodes);
    return files;
  }

  private async calculateSelectedTokens() {
    const selectedPaths = this.getSelectedFilePaths();
    if (selectedPaths.length === 0) return;

    for (const path of selectedPaths) {
      if (!this.tokenService.hasCached(path)) {
        const node = this.allNodesFlat().find((n) => n.path === path);
        const content = await this.electron.readFile(path);
        await this.tokenService.getTokenCount(path, content, true, node?.mtimeMs);
      }
    }
  }

  // --- Persistence ---

  private loadRecentProjects() {
    const saved = localStorage.getItem('recent-projects');
    if (saved) {
      try {
        this.recentProjects.set(JSON.parse(saved));
      } catch (e) {
        console.error(e);
      }
    }
  }

  private addToRecentProjects(path: string) {
    const current = this.recentProjects();
    const filtered = current.filter((p) => p !== path);
    const updated = [path, ...filtered].slice(0, 10);
    this.recentProjects.set(updated);
    localStorage.setItem('recent-projects', JSON.stringify(updated));
  }
}
