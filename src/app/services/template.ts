import { Injectable, signal } from '@angular/core';

export interface PromptTemplate {
  id: string;
  name: string;
  filePaths: string[];
}

@Injectable({
  providedIn: 'root',
})
export class TemplateService {
  templates = signal<PromptTemplate[]>([]);

  constructor() {
    const saved = localStorage.getItem('prompt-templates');
    if (saved) {
      try {
        const loaded = JSON.parse(saved);
        // Migrate old templates that use patterns to filePaths
        const migrated = loaded
          .filter((t: any) => t.filePaths && t.filePaths.length > 0)
          .map((t: any) => ({ id: t.id, name: t.name, filePaths: t.filePaths }));
        this.templates.set(migrated);
        if (migrated.length !== loaded.length) {
          this.save();
        }
      } catch (e) {
        console.error('Failed to load templates:', e);
      }
    }
  }

  addTemplate(name: string, filePaths: string[]): void {
    const newTemplate: PromptTemplate = {
      id: Date.now().toString(),
      name,
      filePaths,
    };
    this.templates.update((t) => [...t, newTemplate]);
    this.save();
  }

  deleteTemplate(id: string): void {
    this.templates.update((t) => t.filter((tmpl) => tmpl.id !== id));
    this.save();
  }

  private save(): void {
    localStorage.setItem('prompt-templates', JSON.stringify(this.templates()));
  }
}
