import { Component, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { LucideAngularModule } from 'lucide-angular';
import { ProjectStateService } from '../../../core/services/project-state.service';
import { TemplateService } from '../../../services/template';

@Component({
  selector: 'app-sidebar-footer',
  standalone: true,
  imports: [CommonModule, LucideAngularModule],
  templateUrl: './sidebar-footer.component.html',
  styleUrls: ['./sidebar-footer.component.scss'],
})
export class SidebarFooterComponent {
  showSaveDialog = signal<boolean>(false);
  newTemplateName = signal<string>('');

  constructor(
    public projectState: ProjectStateService,
    private templateService: TemplateService,
  ) {}

  openSaveDialog() {
    this.newTemplateName.set('');
    this.showSaveDialog.set(true);
  }

  closeSaveDialog() {
    this.showSaveDialog.set(false);
    this.newTemplateName.set('');
  }

  saveTemplate() {
    const name = this.newTemplateName();
    if (!name.trim()) return;

    const filePaths = this.projectState.getSelectedFilePaths();
    this.templateService.addTemplate(name.trim(), filePaths);
    this.closeSaveDialog();
  }
}
