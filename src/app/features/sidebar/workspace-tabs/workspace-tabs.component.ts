import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { LucideAngularModule } from 'lucide-angular';
import { ProjectStateService } from '../../../core/services/project-state.service';

@Component({
  selector: 'app-workspace-tabs',
  standalone: true,
  imports: [CommonModule, LucideAngularModule],
  template: `
    <div class="tabs-container">
      @for (workspace of projectState.workspaces(); track workspace.id) {
        <div
          class="tab"
          [class.active]="projectState.activeWorkspaceId() === workspace.id"
          (click)="projectState.switchWorkspace(workspace.id)"
        >
          <lucide-icon name="folder" [size]="14"></lucide-icon>
          <span class="tab-title" [title]="workspace.id">{{ workspace.name }}</span>
          <button class="close-btn" title="Close Project" (click)="closeTab($event, workspace.id)">
            <lucide-icon name="x" [size]="12"></lucide-icon>
          </button>
        </div>
      }

      <!-- New Tab Button -->
      <button class="new-tab-btn" title="Open Project" (click)="projectState.openProject()">
        <lucide-icon name="plus" [size]="16"></lucide-icon>
      </button>
    </div>
  `,
  styles: [
    `
      .tabs-container {
        display: flex;
        background-color: var(--bg-app);
        border-bottom: 1px solid var(--border);
        height: 40px;
        overflow-x: auto;
        overflow-y: hidden;

        /* Mac window control spacing (traffic lights drag region) */
        -webkit-app-region: drag;
        padding-left: 70px;
      }

      /* Scrollbar hidden for tabs */
      .tabs-container::-webkit-scrollbar {
        display: none;
      }

      .tab {
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 0 12px;
        min-width: 120px;
        max-width: 250px;
        height: 100%;
        border-right: 1px solid var(--border);
        background-color: var(--bg-app);
        color: var(--text-dim);
        cursor: pointer;
        -webkit-app-region: no-drag;
        transition:
          background-color 0.2s,
          color 0.2s;

        /* Subtle inner shadow for inactive tabs */
        box-shadow: inset 0 -2px 5px rgba(0, 0, 0, 0.2);
      }

      .tab:hover {
        background-color: var(--bg-hover);
      }

      .tab.active {
        background-color: var(--bg-panel);
        color: var(--text-main);
        box-shadow: none; /* Flat and prominent */
        border-bottom: 1px solid var(--bg-panel); /* Covers the container border */
        margin-bottom: -1px;
      }

      .tab-title {
        flex: 1;
        font-size: 13px;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
        user-select: none;
      }

      .close-btn {
        background: none;
        border: none;
        color: var(--text-dim);
        display: flex;
        align-items: center;
        justify-content: center;
        width: 20px;
        height: 20px;
        border-radius: 4px;
        cursor: pointer;
        opacity: 0;
        transition:
          opacity 0.2s,
          background-color 0.2s,
          color 0.2s;
      }

      /* Only show close button on active tab or hover */
      .tab.active .close-btn,
      .tab:hover .close-btn {
        opacity: 1;
      }

      .close-btn:hover {
        background-color: rgba(255, 255, 255, 0.1);
        color: var(--text-main);
      }

      .new-tab-btn {
        background: none;
        border: none;
        color: var(--text-dim);
        display: flex;
        align-items: center;
        justify-content: center;
        width: 40px;
        height: 40px;
        cursor: pointer;
        -webkit-app-region: no-drag;
        transition:
          color 0.2s,
          background-color 0.2s;
      }

      .new-tab-btn:hover {
        color: var(--text-main);
        background-color: var(--bg-hover);
      }
    `,
  ],
})
export class WorkspaceTabsComponent {
  constructor(public projectState: ProjectStateService) {}

  closeTab(event: MouseEvent, id: string) {
    event.stopPropagation();
    this.projectState.closeProject(id);
  }
}
