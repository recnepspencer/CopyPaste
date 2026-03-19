import { Component, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { LucideAngularModule } from 'lucide-angular';
import { TemplateService, PromptTemplate } from '../../../services/template';
import { ProjectStateService } from '../../../core/services/project-state.service';

@Component({
  selector: 'app-template-dropdown',
  standalone: true,
  imports: [CommonModule, LucideAngularModule],
  templateUrl: './template-dropdown.component.html',
  styleUrls: ['./template-dropdown.component.scss'],
})
export class TemplateDropdownComponent {
  showDropdown = signal<boolean>(false);
  selectedTemplate = signal<PromptTemplate | null>(null);
  activeMenuId = signal<string | null>(null);
  popoverPosition = signal<{ top: number; right: number }>({ top: 0, right: 0 });

  constructor(
    public templateService: TemplateService,
    private projectState: ProjectStateService,
  ) {}

  toggleDropdown() {
    this.showDropdown.update((val) => !val);
  }

  applyTemplate(t: PromptTemplate) {
    if (!this.projectState.files().length) return;
    // Set selection to template's file paths
    this.projectState.setSelection(new Set(t.filePaths));
    // Expand parent folders for each selected file
    for (const filePath of t.filePaths) {
      this.projectState.expandParentsForFile(filePath);
    }
    this.selectedTemplate.set(t);
    this.showDropdown.set(false);
  }

  toggleMenu(id: string, event: Event, buttonElement: HTMLElement) {
    event.stopPropagation();

    if (this.activeMenuId() === id) {
      this.activeMenuId.set(null);
    } else {
      // Calculate position relative to viewport for the ellipses button
      const rect = buttonElement.getBoundingClientRect();
      const viewportWidth = window.innerWidth;
      const popoverWidth = 120;
      const margin = 10;

      // Position popover below and aligned to the right edge of the button
      let top = rect.bottom + 4; // 4px gap below button
      let right = viewportWidth - rect.right; // Align right edge with button right edge

      // Adjust if popover would go off screen to the right
      if (right + popoverWidth > viewportWidth - margin) {
        right = viewportWidth - rect.left - popoverWidth; // Position to the left instead
      }

      // Ensure it doesn't go off top
      if (top < margin) {
        top = margin;
      }

      // If popover would go off bottom, position above instead
      const popoverHeight = 40; // Approximate height
      if (top + popoverHeight > window.innerHeight - margin) {
        top = rect.top - popoverHeight - 4; // Position above button
        if (top < margin) {
          top = margin;
        }
      }

      this.popoverPosition.set({ top, right });
      this.activeMenuId.set(id);
    }
  }

  deleteTemplate(id: string) {
    this.templateService.deleteTemplate(id);
    this.activeMenuId.set(null);
    // Clear selected template if it was deleted
    if (this.selectedTemplate()?.id === id) {
      this.selectedTemplate.set(null);
    }
  }
}
