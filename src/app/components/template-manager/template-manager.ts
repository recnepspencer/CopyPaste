import { Component, EventEmitter, Output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TemplateService } from '../../services/template';

@Component({
  selector: 'app-template-manager',
  standalone: true,
  imports: [FormsModule],
  template: `
    <div class="overlay">
      <div class="modal">
        <div class="modal-header">
          <h2>Manage Templates</h2>
          <button class="close-btn" (click)="close.emit()">×</button>
        </div>

        <div class="modal-body">
          <div class="create-box">
            <p style="color: var(--text-dim); font-size: 12px; margin: 0 0 10px 0;">
              Templates are now created from selected files using the "Save" button in the sidebar.
            </p>
          </div>

          <div class="template-list">
            @for (t of templateService.templates(); track t.id) {
              <div class="template-item">
                <div class="info">
                  <strong>{{ t.name }}</strong>
                  <small>{{ t.filePaths.length }} file(s)</small>
                </div>
                <button class="btn-icon" (click)="templateService.deleteTemplate(t.id)">🗑️</button>
              </div>
            } @empty {
              <div class="empty-msg">No templates created yet.</div>
            }
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .overlay { 
      position: fixed; 
      top: 0; 
      left: 0; 
      right: 0; 
      bottom: 0; 
      background: rgba(0,0,0,0.7); 
      display: flex; 
      align-items: center; 
      justify-content: center; 
      z-index: 1000; 
    }
    .modal { 
      background: var(--bg-panel); 
      width: 500px; 
      border: 1px solid var(--border); 
      box-shadow: 0 10px 30px rgba(0,0,0,0.5); 
      border-radius: 8px; 
    }
    .modal-header { 
      padding: 15px 20px; 
      border-bottom: 1px solid var(--border); 
      display: flex; 
      justify-content: space-between; 
      align-items: center; 
      h2 { 
        margin: 0; 
        font-size: 16px; 
        color: var(--text-main); 
      } 
      .close-btn { 
        background: none; 
        border: none; 
        color: var(--text-dim); 
        font-size: 24px; 
        cursor: pointer; 
        padding: 0;
        width: 30px;
        height: 30px;
      } 
      .close-btn:hover {
        color: var(--text-main);
      }
    }
    .modal-body { 
      padding: 20px; 
    }
    .create-box { 
      display: flex; 
      gap: 10px; 
      flex-direction: column; 
      margin-bottom: 20px; 
      input { 
        background: var(--bg-app); 
        border: 1px solid var(--border); 
        color: var(--text-main); 
        padding: 8px; 
        border-radius: 4px; 
      } 
    }
    .template-list { 
      max-height: 300px; 
      overflow-y: auto; 
      border-top: 1px solid var(--border); 
      padding-top: 10px;
    }
    .template-item { 
      padding: 10px; 
      border-bottom: 1px solid var(--border); 
      display: flex; 
      justify-content: space-between; 
      align-items: center; 
      .info { 
        display: flex; 
        flex-direction: column; 
        flex: 1;
      } 
      strong {
        color: var(--text-main);
        margin-bottom: 4px;
      }
      small { 
        color: var(--text-dim); 
        font-size: 11px; 
      } 
      .btn-icon { 
        background: none; 
        border: none; 
        cursor: pointer; 
        opacity: 0.5; 
        transition: opacity 0.2s; 
        font-size: 16px;
        padding: 4px 8px;
      } 
      .btn-icon:hover { 
        opacity: 1; 
      } 
    }
    .btn-red.small { 
      padding: 8px; 
      font-size: 12px; 
    }
    .empty-msg { 
      padding: 20px; 
      text-align: center; 
      color: var(--text-dim); 
      font-style: italic; 
    }
  `]
})
export class TemplateManagerComponent {
  @Output() close = new EventEmitter<void>();

  constructor(public templateService: TemplateService) {}
}
