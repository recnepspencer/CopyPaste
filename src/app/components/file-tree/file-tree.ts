import { Component, Input, inject } from '@angular/core';
import { LucideAngularModule } from 'lucide-angular';
import { ProjectStateService } from '../../core/services/project-state.service';

export interface FileNode {
  name: string;
  path: string;
  type: 'file' | 'folder';
  children?: FileNode[];
  mtimeMs?: number;
}

@Component({
  selector: 'app-file-tree',
  standalone: true,
  imports: [LucideAngularModule],
  template: `
    <ul class="tree-list">
      @for (node of nodes; track node.path) {
        <li>
          <div
            class="node-row"
            [class.active]="
              node.type === 'file'
                ? projectState.isSelected(node.path)
                : projectState.isFolderFullySelected(node.children || [])
            "
          >
            <input
              type="radio"
              [checked]="
                node.type === 'file'
                  ? projectState.isSelected(node.path)
                  : projectState.isFolderFullySelected(node.children || [])
              "
              (click)="toggleSelection(node, $event)"
            />

            <div
              class="node-label"
              (click)="handleNodeClick(node)"
              [draggable]="node.type === 'folder'"
              (dragstart)="onDragStart($event, node)"
            >
              <span class="icon">
                @if (node.type === 'folder') {
                  @if (projectState.isExpanded(node.path)) {
                    <lucide-icon name="folder-open" [size]="14"></lucide-icon>
                  } @else {
                    <lucide-icon name="folder" [size]="14"></lucide-icon>
                  }
                } @else {
                  <lucide-icon name="file-code" [size]="14"></lucide-icon>
                }
              </span>
              <span class="name">{{ node.name }}</span>
            </div>
          </div>

          @if (node.type === 'folder' && projectState.isExpanded(node.path)) {
            <div class="children">
              <app-file-tree [nodes]="node.children || []"></app-file-tree>
            </div>
          }
        </li>
      }
    </ul>
  `,
  styleUrls: ['./file-tree.scss'],
})
export class FileTreeComponent {
  @Input() nodes: FileNode[] = [];

  projectState = inject(ProjectStateService);

  private lastClickedPath: string | null = null;

  toggleSelection(node: FileNode, event: MouseEvent) {
    event.stopPropagation();

    if (event.shiftKey && this.lastClickedPath) {
      this.projectState.selectRange(this.lastClickedPath, node.path);
    } else {
      this.projectState.toggleSelection(node.path, node.type, node.children);
    }
    this.lastClickedPath = node.path;
  }

  handleNodeClick(node: FileNode) {
    if (node.type === 'folder') {
      this.projectState.toggleExpanded(node.path);
    }
  }

  onDragStart(event: DragEvent, node: FileNode) {
    if (node.type === 'folder') {
      event.dataTransfer!.effectAllowed = 'copy';
      event.dataTransfer!.setData('text/plain', node.path);
      event.dataTransfer!.setData('application/x-file-path', node.path);
    }
  }
}
