import {
  Component,
  computed,
  effect,
  signal,
  ElementRef,
  HostListener,
  inject,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { LucideAngularModule } from 'lucide-angular';
import { SearchService } from '../../../core/services/search.service';
import { ProjectStateService } from '../../../core/services/project-state.service';
import { ElectronService } from '../../../services/electron';

@Component({
  selector: 'app-search-panel',
  standalone: true,
  imports: [CommonModule, FormsModule, LucideAngularModule],
  templateUrl: './search-panel.component.html',
  styleUrls: ['./search-panel.component.scss'],
})
export class SearchPanelComponent {
  // Local UI state (dropdown visibility, edit modes)
  showOptions = signal<boolean>(false);
  editingIncludeId = signal<string | null>(null);
  editingPatternId = signal<string | null>(null);
  newIncludePath = signal<string>('');
  newExcludePattern = signal<string>('');

  // Computed for filtered results
  filteredSearchResults = computed(() => {
    return this.searchService
      .workerSearchResults()
      .slice(0, this.searchService.searchResultsLimit());
  });

  private elementRef = inject(ElementRef); // Inject reference to this component's DOM

  constructor(
    public searchService: SearchService,
    private projectState: ProjectStateService,
    private electron: ElectronService,
  ) {
    // Effect: Trigger search when inputs change (with debounce)
    effect((onCleanup) => {
      const q = this.searchService.searchQuery();
      const inc = this.searchService.searchIncludeFolders();
      const exc = this.searchService.searchExcludePatterns();

      // Don't search if no project
      if (this.projectState.files().length === 0) return;

      const timer = setTimeout(() => {
        this.searchService.triggerSearch();
      }, 150); // 150ms debounce

      onCleanup(() => clearTimeout(timer));
    });
  }

  // --- Search Actions ---

  onSearchInput(event: Event) {
    const val = (event.target as HTMLInputElement).value;
    this.searchService.searchQuery.set(val);
    this.searchService.showSearchResults.set(true);
    this.searchService.searchResultsLimit.set(10); // Reset limit when search changes

    // Ensure search is triggered (effect handles debounce, but this ensures it runs)
    // The effect will handle the actual debounced search
  }

  toggleSearchOptions() {
    this.showOptions.update((val) => !val);
  }

  closeSearchOptions() {
    this.showOptions.set(false);
    this.editingIncludeId.set(null);
    this.editingPatternId.set(null);
  }

  // NEW: Listen for clicks anywhere on the document
  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent) {
    // Check if the click occurred INSIDE this component
    if (!this.elementRef.nativeElement.contains(event.target)) {
      // If outside, close the options/results
      this.closeSearchOptions();
      // Also close search results if you want that behavior:
      this.searchService.showSearchResults.set(false);
    }
  }

  // --- File Selection from Search Results ---

  toggleFileFromSearch(file: { name: string; path: string }) {
    this.projectState.toggleSelection(file.path, 'file');
    this.projectState.expandParentsForFile(file.path);
  }

  isFileSelected(filePath: string): boolean {
    return this.projectState.isSelected(filePath);
  }

  getRelativePath(fullPath: string): string {
    const nodes = this.projectState.files();
    if (nodes.length > 0 && nodes[0].path) {
      const firstPath = nodes[0].path;
      const parts = firstPath.split('/');
      const rootPath = parts.slice(0, -1).join('/');
      if (rootPath && fullPath.startsWith(rootPath)) {
        return fullPath.substring(rootPath.length + 1);
      }
    }
    return fullPath;
  }

  onSearchScroll(event: Event) {
    const target = event.target as HTMLElement;
    const scrollTop = target.scrollTop;
    const scrollHeight = target.scrollHeight;
    const clientHeight = target.clientHeight;

    // Load more when scrolled near bottom (within 100px)
    if (scrollHeight - scrollTop - clientHeight < 100) {
      const currentLimit = this.searchService.searchResultsLimit();
      const totalAvailable = this.searchService.workerSearchResults().length;
      if (currentLimit < totalAvailable) {
        // Load 20 more items
        this.searchService.searchResultsLimit.set(Math.min(currentLimit + 20, totalAvailable));
      }
    }
  }

  // --- Drag & Drop for Includes ---

  onSearchDragOver(event: DragEvent) {
    event.preventDefault();
    event.stopPropagation();

    if (event.dataTransfer) {
      const target = event.currentTarget as HTMLElement;
      target.classList.add('drag-over');
    }
  }

  onSearchDragLeave(event: DragEvent) {
    const target = event.currentTarget as HTMLElement;
    target.classList.remove('drag-over');
  }

  onSearchDrop(event: DragEvent) {
    event.preventDefault();
    event.stopPropagation();

    const target = event.currentTarget as HTMLElement;
    target.classList.remove('drag-over');

    if (!event.dataTransfer) return;

    // Try multiple ways to get the path (for different drag sources)
    let path: string | null = null;

    // Method 1: From file tree drag (text/plain)
    path = event.dataTransfer.getData('text/plain');

    // Method 2: From file tree drag (application/x-file-path)
    if (!path) {
      path = event.dataTransfer.getData('application/x-file-path');
    }

    // Method 3: From file system drag (Electron file path)
    if (!path && event.dataTransfer.files && event.dataTransfer.files.length > 0) {
      path = (event.dataTransfer.files[0] as any).path;
    }

    if (path && path.trim()) {
      // In Electron, check if it's a directory using fs
      try {
        const fs = (window as any).require?.('fs');
        if (fs) {
          const stats = fs.statSync(path);
          if (stats.isDirectory()) {
            this.searchService.addIncludeFolder(path);
            this.projectState.expandParentsForFile(path);
          }
        } else {
          // Fallback: assume it's a directory if we can't check
          this.searchService.addIncludeFolder(path);
          this.projectState.expandParentsForFile(path);
        }
      } catch (err) {
        console.error('Error checking dropped item:', err);
      }
    }
  }

  async selectIncludeFolder() {
    const path = await this.electron.selectDirectory();
    if (path) {
      this.searchService.addIncludeFolder(path);
      this.projectState.expandParentsForFile(path);
    }
  }

  // --- Include Folder Actions ---

  addNewIncludeFolder() {
    const path = this.newIncludePath().trim();
    if (path) {
      this.searchService.addIncludeFolder(path);
      this.newIncludePath.set('');
      this.projectState.expandParentsForFile(path);
    }
  }

  updateIncludeFolder(id: string, newPath: string) {
    if (!newPath.trim()) {
      this.searchService.removeIncludeFolder(id);
      return;
    }

    const trimmedPath = newPath.trim();
    const current = this.searchService.searchIncludeFolders();

    // Check if this path already exists (excluding current item)
    if (current.some((f) => f.id !== id && f.path === trimmedPath)) {
      alert(`Folder "${trimmedPath}" already exists in the include list.`);
      return;
    }

    this.searchService.updateIncludeFolder(id, trimmedPath);
  }

  toggleIncludeFolder(id: string) {
    const folder = this.searchService.searchIncludeFolders().find((f) => f.id === id);
    if (!folder) return;

    // If trying to enable, check if this path exists as an enabled exclude pattern
    if (!folder.enabled) {
      if (this.searchService.hasIncludeConflict(folder.path)) {
        alert(this.searchService.getIncludeConflictMessage(folder.path));
        return;
      }
    }

    this.searchService.toggleIncludeFolder(id);
  }

  // --- Exclude Pattern Actions ---

  addNewExcludePattern() {
    const pattern = this.newExcludePattern().trim();
    if (pattern) {
      this.searchService.addExcludePattern(pattern);
      this.newExcludePattern.set('');
    }
  }

  updateExcludePattern(id: string, newPattern: string) {
    if (!newPattern.trim()) {
      this.searchService.removeExcludePattern(id);
      return;
    }

    const trimmedPattern = newPattern.trim();
    const current = this.searchService.searchExcludePatterns();

    // Check if this pattern already exists (excluding current item)
    if (current.some((p) => p.id !== id && p.pattern === trimmedPattern)) {
      alert(`Pattern "${trimmedPattern}" already exists in the exclude list.`);
      return;
    }

    this.searchService.updateExcludePattern(id, trimmedPattern);
  }

  toggleExcludePattern(id: string) {
    const pattern = this.searchService.searchExcludePatterns().find((p) => p.id === id);
    if (!pattern) return;

    // If trying to enable, check if any enabled include folders would conflict
    if (!pattern.enabled) {
      if (this.searchService.hasExcludeConflict(pattern.pattern)) {
        const enabledFolders = this.searchService.searchIncludeFolders().filter((f) => f.enabled);
        const conflicts = enabledFolders.filter((f) => {
          return this.searchService.hasExcludeConflict(pattern.pattern);
        });

        if (conflicts.length === 1) {
          alert(
            `Cannot enable this exclude pattern. The folder "${conflicts[0].path}" is currently enabled and conflicts with this pattern. Please disable the folder first.`,
          );
        } else {
          alert(
            `Cannot enable this exclude pattern. ${conflicts.length} folders are currently enabled and conflict with this pattern. Please disable them first.`,
          );
        }
        return;
      }
    }

    this.searchService.toggleExcludePattern(id);
  }
}
