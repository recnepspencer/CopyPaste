import { ApplicationConfig, provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideRouter } from '@angular/router';
import { LUCIDE_ICONS, LucideIconProvider } from 'lucide-angular';
import {
  Save,
  MoreHorizontal,
  Trash2,
  Loader2,
  Folder,
  FolderOpen,
  FileCode,
  X,
  Home,
  FolderX,
  ArrowRight,
  Copy,
  CheckCircle,
  ChevronDown,
  Search,
  Settings,
  Pencil,
  RotateCw,
  Plus,
} from 'lucide-angular';

import { routes } from './app.routes';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(routes),
    {
      provide: LUCIDE_ICONS,
      useFactory: () => {
        return new LucideIconProvider({
          Save: Save,
          MoreHorizontal: MoreHorizontal,
          Trash2: Trash2,
          Loader2: Loader2,
          Folder: Folder,
          FolderOpen: FolderOpen,
          FileCode: FileCode,
          X: X,
          Home: Home,
          FolderX: FolderX,
          ArrowRight: ArrowRight,
          Copy: Copy,
          CheckCircle: CheckCircle,
          ChevronDown: ChevronDown,
          Search: Search,
          Settings: Settings,
          Pencil: Pencil,
          RotateCw: RotateCw,
          Plus: Plus,
        });
      },
    },
  ],
};
