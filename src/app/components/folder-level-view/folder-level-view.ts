import { Component, input, output, signal, computed, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { LucideAngularModule } from 'lucide-angular';
import { FileNode } from '../file-tree/file-tree';
import { TokenService } from '../../services/token';
import { ElectronService } from '../../services/electron';
import { ProjectStateService } from '../../core/services/project-state.service';

@Component({
  selector: 'app-folder-level-view',
  standalone: true,
  imports: [CommonModule, LucideAngularModule],
  template: `
    <div class="folder-level-view">
      <!-- Folder Cards Grid - Flat Structure -->
      <div class="cards-grid">
        @for (folder of folderViewModels(); track folder.path) {
          <div class="folder-container">
            <div class="folder-header">
              <div class="folder-info">
                <lucide-icon name="folder" [size]="18"></lucide-icon>
                <span class="folder-path">{{ folder.relativePath }}</span>
              </div>
              <div class="folder-stats">
                <span class="stat">
                  <lucide-icon name="file-code" [size]="12"></lucide-icon>
                  {{ folder.files.length }} files
                </span>
              </div>
            </div>

            <!-- Files displayed as cards within folder -->
            @if (folder.files.length > 0) {
              <div class="folder-files">
                @for (file of folder.files; track file.path) {
                  <div class="file-card" #fileCard (click)="onItemClick(file, $event, fileCard)">
                    <div class="file-icon">
                      <lucide-icon name="file-code" [size]="14"></lucide-icon>
                    </div>
                    <div class="file-info">
                      <span class="file-name">{{ file.name }}</span>
                      <span class="file-path">{{ file.relativePath }}</span>
                      <span class="file-tokens">{{ file.tokens }} tokens</span>
                    </div>
                  </div>
                }
              </div>
            }
          </div>
        }
      </div>

      <!-- Empty State -->
      @if (folderViewModels().length === 0) {
        <div class="empty-state">
          <lucide-icon name="folder-x" [size]="48"></lucide-icon>
          <p>No folders with selected files</p>
          <small>Select files in the sidebar to see folders here</small>
        </div>
      }

      <!-- File Content Popover -->
      @if (selectedFile() && fileContent()) {
        <div
          class="file-popover-wrapper"
          (click)="closeFilePopover()"
          (mousemove)="$event.stopPropagation()"
        >
          <div
            class="file-popover"
            (click)="$event.stopPropagation()"
            (mousemove)="$event.stopPropagation()"
            [style.top.px]="popoverPosition().top"
            [style.left.px]="popoverPosition().left"
          >
            <div class="file-popover-header">
              <span class="file-popover-title">{{ selectedFile()?.name }}</span>
              <span class="file-popover-tokens">{{ fileTokens() }} tokens</span>
              <button class="file-popover-close" (click)="closeFilePopover()">
                <lucide-icon name="x" [size]="18"></lucide-icon>
              </button>
            </div>
            <div class="file-popover-content">
              <textarea readonly class="file-content-textarea">{{ fileContent() }}</textarea>
            </div>
          </div>
        </div>
      }
    </div>
  `,
  styleUrls: ['./folder-level-view.scss'],
})
export class FolderLevelViewComponent {
  private tokenService = inject(TokenService);
  private electron = inject(ElectronService);
  private projectState = inject(ProjectStateService);

  selectedFile = signal<{ name: string; path: string } | null>(null);
  fileContent = signal<string | null>(null);
  fileTokens = signal<number>(0);
  popoverPosition = signal<{ top: number; left: number }>({ top: 0, left: 0 });

  private rootPath = computed(() => {
    const nodes = this.projectState.files();
    if (nodes.length > 0 && nodes[0].path) {
      const firstPath = nodes[0].path;
      const parts = firstPath.split('/');
      return parts.slice(0, -1).join('/');
    }
    return '';
  });

  folderViewModels = computed(() => {
    const nodes = this.projectState.files();
    const selected = this.projectState.selectedPaths();
    // React to token cache updates
    this.tokenService.cacheUpdated();

    const root = this.rootPath();
    const getRelativePath = (fullPath: string) => {
      if (root && fullPath.startsWith(root)) {
        return fullPath.substring(root.length + 1);
      }
      return fullPath;
    };

    const folderMap = new Map<
      string,
      {
        path: string;
        relativePath: string;
        files: { name: string; path: string; relativePath: string; tokens: number }[];
      }
    >();

    const traverse = (currentNodes: FileNode[], parentFolder: FileNode | null) => {
      for (const node of currentNodes) {
        if (node.type === 'file' && selected.has(node.path) && parentFolder) {
          if (!folderMap.has(parentFolder.path)) {
            folderMap.set(parentFolder.path, {
              path: parentFolder.path,
              relativePath: getRelativePath(parentFolder.path),
              files: [],
            });
          }
          folderMap.get(parentFolder.path)!.files.push({
            name: node.name,
            path: node.path,
            relativePath: getRelativePath(node.path),
            tokens: this.tokenService.getCachedCount(node.path),
          });
        } else if (node.type === 'folder' && node.children) {
          traverse(node.children, node);
        }
      }
    };

    traverse(nodes, null);
    return Array.from(folderMap.values()).sort((a, b) => a.path.localeCompare(b.path));
  });

  async onItemClick(
    file: { name: string; path: string },
    event: MouseEvent,
    cardElement: HTMLElement,
  ) {
    event.stopPropagation();

    if (this.selectedFile()?.path === file.path && this.fileContent()) {
      return;
    }

    const rect = cardElement.getBoundingClientRect();
    const viewportWidth = window.innerWidth;
    const popoverWidth = 900;
    const margin = 20;

    let top = rect.bottom + 8;
    let left = rect.left + rect.width / 2 - popoverWidth / 2;

    if (left < margin) {
      left = margin;
    } else if (left + popoverWidth > viewportWidth - margin) {
      left = viewportWidth - popoverWidth - margin;
    }

    const popoverHeight = 800;
    if (top + popoverHeight > window.innerHeight) {
      top = rect.top - popoverHeight - 8;
      if (top < margin) top = margin;
    }

    this.popoverPosition.set({ top, left });
    this.selectedFile.set(file);
    this.fileContent.set(null);
    this.fileTokens.set(0);

    try {
      const content = await this.electron.readFile(file.path);
      this.fileContent.set(content);
      const tokens = await this.tokenService.getTokenCount(file.path, content, true);
      this.fileTokens.set(tokens);
    } catch (err) {
      console.error('Failed to read file:', err);
      this.fileContent.set('Error reading file');
    }
  }

  closeFilePopover() {
    this.selectedFile.set(null);
    this.fileContent.set(null);
    this.fileTokens.set(0);
  }
}
