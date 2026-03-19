import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { LucideAngularModule } from 'lucide-angular';

@Component({
  selector: 'app-loader',
  standalone: true,
  imports: [CommonModule, LucideAngularModule],
  template: `
    <div class="loader-container" [class.full-height]="fullHeight">
      <lucide-icon name="loader-2" class="spin-icon" [size]="size"></lucide-icon>
      <p *ngIf="message">{{ message }}</p>
    </div>
  `,
  styles: [`
    .loader-container {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      color: var(--text-dim);
      gap: 10px;
    }
    .full-height { height: 100%; }
    .spin-icon {
      animation: spin 1s linear infinite;
      color: var(--accent-red);
    }
    p {
      margin: 0;
      font-size: 12px;
      letter-spacing: 0.5px;
    }
    @keyframes spin { 100% { transform: rotate(360deg); } }
  `]
})
export class LoaderComponent {
  @Input() message: string = '';
  @Input() size: number = 32;
  @Input() fullHeight: boolean = true;
}

