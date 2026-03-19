import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ProjectStateService } from '../../core/services/project-state.service';
import { SearchPanelComponent } from './search-panel/search-panel.component';
import { SidebarFooterComponent } from './sidebar-footer/sidebar-footer.component';
import { TemplateDropdownComponent } from './templates/template-dropdown.component';
import { FileTreeComponent } from '../../components/file-tree/file-tree';
import { LoaderComponent } from '../../shared/ui/loader/loader.component';

@Component({
  selector: 'app-sidebar',
  standalone: true,
  imports: [
    CommonModule,
    SearchPanelComponent,
    SidebarFooterComponent,
    TemplateDropdownComponent,
    FileTreeComponent,
    LoaderComponent,
  ],
  template: `
    <div class="sidebar-layout">
      <div class="header">
        <h3>{{ projectState.activeWorkspace()?.name || 'PROJECT FILES' | uppercase }}</h3>
        <button class="btn-red" (click)="projectState.openProject()">Import Project</button>
      </div>

      <app-template-dropdown class="section-border"></app-template-dropdown>

      <div class="tree-container">
        @if (projectState.files().length > 0) {
          <app-search-panel></app-search-panel>
        }

        <div class="tree-content">
          @if (projectState.isProjectLoading()) {
            <app-loader message="Scanning Files..."></app-loader>
          } @else if (projectState.files().length > 0) {
            <app-file-tree [nodes]="projectState.files()"></app-file-tree>
          } @else {
            <div class="empty-state">
              <p>No project loaded</p>
            </div>
          }
        </div>
      </div>

      <app-sidebar-footer></app-sidebar-footer>
    </div>
  `,
  styles: [
    `
      :host {
        display: block;
        height: 100%;
        overflow: hidden;
      }
      .sidebar-layout {
        display: flex;
        flex-direction: column;
        height: 100%;
        background-color: var(--bg-panel);
        border-right: 1px solid var(--border);
        overflow: hidden;
      }
      .header {
        padding: 20px;
        border-bottom: 1px solid var(--border);
        flex-shrink: 0;
      }
      .header h3 {
        margin: 0 0 10px 0;
        font-size: 12px;
        color: var(--text-dim);
        letter-spacing: 1px;
      }
      .header button {
        width: 100%;
      }
      .section-border {
        border-bottom: 1px solid var(--border);
        display: block;
      }
      .tree-container {
        flex: 1;
        display: flex;
        flex-direction: column;
        min-height: 0;
        overflow: hidden;
      }
      .tree-content {
        flex: 1;
        overflow-y: auto;
        padding-top: 10px;
      }
      .empty-state {
        padding: 40px 20px;
        text-align: center;
        color: var(--text-dim);
        font-size: 13px;
      }
    `,
  ],
})
export class SidebarComponent {
  constructor(public projectState: ProjectStateService) {}
}
