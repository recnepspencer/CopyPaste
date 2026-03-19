import { Injectable } from '@angular/core';

// Access window.require to grab Electron
const electron = (<any>window).require ? (<any>window).require('electron') : null;

@Injectable({
  providedIn: 'root',
})
export class ElectronService {
  private ipcRenderer = electron ? electron.ipcRenderer : null;

  async selectDirectory(): Promise<string | null> {
    if (!this.ipcRenderer) return null;
    return await this.ipcRenderer.invoke('select-directory');
  }

  async readDirectory(path: string): Promise<any[]> {
    if (!this.ipcRenderer) return [];
    return await this.ipcRenderer.invoke('read-directory', path);
  }

  async readFile(path: string): Promise<string> {
    if (!this.ipcRenderer) return '';
    return await this.ipcRenderer.invoke('read-file', path);
  }

  async watchDirectory(path: string): Promise<void> {
    if (!this.ipcRenderer) return;
    await this.ipcRenderer.invoke('watch-directory', path);
  }

  async unwatchDirectory(): Promise<void> {
    if (!this.ipcRenderer) return;
    await this.ipcRenderer.invoke('unwatch-directory');
  }

  onFsChanged(callback: () => void): void {
    if (!this.ipcRenderer) return;
    this.ipcRenderer.on('fs-changed', callback);
  }

  offFsChanged(callback: () => void): void {
    if (!this.ipcRenderer) return;
    this.ipcRenderer.removeListener('fs-changed', callback);
  }
}
