import { Component, HostListener, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { SidebarComponent } from './features/sidebar/sidebar.component';
import { ContentAreaComponent } from './features/main-content/content-area.component';
import { WorkspaceTabsComponent } from './features/sidebar/workspace-tabs/workspace-tabs.component';
import { ProjectStateService } from './core/services/project-state.service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, SidebarComponent, ContentAreaComponent, WorkspaceTabsComponent],
  templateUrl: './app.html',
  styleUrls: ['./app.component.scss'],
})
export class App {
  sidebarWidth = signal<number>(350);
  isResizing = signal<boolean>(false);

  constructor(private projectState: ProjectStateService) {
    // Load saved width
    const savedWidth = localStorage.getItem('sidebarWidth');
    if (savedWidth) {
      this.sidebarWidth.set(parseInt(savedWidth, 10));
    }
  }

  // --- Resizer Logic ---

  onResizeStart(event: MouseEvent) {
    event.preventDefault();
    this.isResizing.set(true);
    // Add class to body to prevent text selection and show resize cursor everywhere
    document.body.classList.add('resizing');
  }

  @HostListener('window:mousemove', ['$event'])
  onMouseMove(event: MouseEvent) {
    if (!this.isResizing()) return;

    // Minimum 200px, Maximum 800px or 50% of screen width
    const minWidth = 200;
    const maxWidth = Math.min(800, window.innerWidth - 300); // Leave at least 300px for content

    let newWidth = event.clientX;
    newWidth = Math.max(minWidth, Math.min(newWidth, maxWidth));

    this.sidebarWidth.set(newWidth);
  }

  @HostListener('window:mouseup')
  onMouseUp() {
    if (this.isResizing()) {
      this.isResizing.set(false);
      document.body.classList.remove('resizing');
      localStorage.setItem('sidebarWidth', this.sidebarWidth().toString());
    }
  }

  // --- Drag & Drop Handler for Folder Import ---

  @HostListener('dragover', ['$event'])
  onDragOver(e: DragEvent) {
    e.preventDefault();
    e.stopPropagation();
  }

  @HostListener('drop', ['$event'])
  onDrop(e: DragEvent) {
    e.preventDefault();
    e.stopPropagation();

    if (e.dataTransfer && e.dataTransfer.files.length > 0) {
      const path = (e.dataTransfer.files[0] as any).path;
      this.projectState.openProject(path);
    }
  }
}
