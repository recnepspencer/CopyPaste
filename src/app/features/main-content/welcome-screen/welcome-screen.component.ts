import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { LucideAngularModule } from 'lucide-angular';
import { ProjectStateService } from '../../../core/services/project-state.service';

@Component({
  selector: 'app-welcome-screen',
  standalone: true,
  imports: [CommonModule, LucideAngularModule],
  templateUrl: './welcome-screen.component.html',
  styleUrls: ['./welcome-screen.component.scss']
})
export class WelcomeScreenComponent {
  constructor(public projectState: ProjectStateService) {}

  getProjectName(path: string): string {
    return path.split('/').pop() || path;
  }
}

