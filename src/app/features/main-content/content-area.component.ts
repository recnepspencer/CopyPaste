import { Component, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { LucideAngularModule } from 'lucide-angular';
import { ProjectStateService } from '../../core/services/project-state.service';
import { FolderLevelViewComponent } from '../../components/folder-level-view/folder-level-view';
import { WelcomeScreenComponent } from './welcome-screen/welcome-screen.component';
import { ElectronService } from '../../services/electron';

@Component({
  selector: 'app-content-area',
  standalone: true,
  imports: [CommonModule, LucideAngularModule, FolderLevelViewComponent, WelcomeScreenComponent],
  templateUrl: './content-area.component.html',
  styleUrls: ['./content-area.component.scss'],
})
export class ContentAreaComponent {
  showToast = signal<boolean>(false);
  toastMessage = signal<string>('');

  constructor(
    public projectState: ProjectStateService,
    private electron: ElectronService,
  ) {}

  async copySelectedFiles() {
    const selectedPaths = this.projectState.getSelectedFilePaths();
    if (selectedPaths.length === 0) return;

    const fileContents: { path: string; content: string }[] = [];
    for (const filePath of selectedPaths) {
      try {
        const content = await this.electron.readFile(filePath);
        fileContents.push({ path: filePath, content });
      } catch (err) {
        console.error(`Failed to read ${filePath}:`, err);
      }
    }

    let prompt = `# Selected Files (${selectedPaths.length} files, ${this.projectState.totalSelectedTokens()} tokens)\n\n`;

    for (const file of fileContents) {
      const relativePath = file.path.split('/').slice(-3).join('/');
      prompt += `## ${relativePath}\n\`\`\`\n${file.content}\n\`\`\`\n\n`;
    }

    try {
      await navigator.clipboard.writeText(prompt);
      this.triggerToast();
    } catch (err) {
      console.error('Failed to copy to clipboard:', err);
    }
  }

  triggerToast(message: string = 'Prompt copied!') {
    this.toastMessage.set(message);
    this.showToast.set(true);
    setTimeout(() => this.showToast.set(false), 3000);
  }

  async handleRefresh() {
    await this.projectState.refreshProject();
    this.triggerToast('Refresh complete!');
  }
}
