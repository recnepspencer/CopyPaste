const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const chokidar = require('chokidar');

let mainWindow;

// --- File Watcher ---
let activeWatcher = null;
let fsChangedDebounce = null;

const SKIP_DIRS = [
  'node_modules', '.git', 'target', 'dist', 'build', '.next', '.nuxt',
  '__pycache__', '.venv', 'venv', '.gradle', '.idea', '.vscode',
  'coverage', '.angular', '.cache', '.turbo', 'Pods',
];

function startWatching(rootPath) {
  stopWatching();

  const ignored = SKIP_DIRS.map((d) => path.join(rootPath, d));
  // Also ignore any hidden directories (dotfiles)
  ignored.push(/(^|[\/\\])\../);

  activeWatcher = chokidar.watch(rootPath, {
    ignored,
    ignoreInitial: true,
    persistent: true,
    depth: 20,
    awaitWriteFinish: { stabilityThreshold: 300, pollInterval: 100 },
  });

  const notifyRenderer = () => {
    if (fsChangedDebounce) clearTimeout(fsChangedDebounce);
    fsChangedDebounce = setTimeout(() => {
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('fs-changed');
      }
    }, 500);
  };

  activeWatcher
    .on('add', notifyRenderer)
    .on('unlink', notifyRenderer)
    .on('addDir', notifyRenderer)
    .on('unlinkDir', notifyRenderer);
}

function stopWatching() {
  if (fsChangedDebounce) {
    clearTimeout(fsChangedDebounce);
    fsChangedDebounce = null;
  }
  if (activeWatcher) {
    activeWatcher.close();
    activeWatcher = null;
  }
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    backgroundColor: '#121212', // Match CSS
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
      webSecurity: false,
    },
  });

  const buildPath = path.join(__dirname, 'dist/copypaste/browser/index.html');

  // Use loadURL with file:// protocol for better compatibility
  mainWindow.loadURL(`file://${buildPath}`);

  // Open DevTools for debugging (remove in production)
  mainWindow.webContents.openDevTools();

  // Log any errors
  mainWindow.webContents.on('did-fail-load', (event, errorCode, errorDescription) => {
    console.error('Failed to load:', errorCode, errorDescription);
  });
}

// --- IPC HANDLERS ---

// 1. Open Directory Dialog
ipcMain.handle('select-directory', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openDirectory'],
  });
  return result.canceled ? null : result.filePaths[0];
});

// 2. Scan Directory (Recursive)
ipcMain.handle('read-directory', async (event, rootPath) => {
  // Skip known heavy/irrelevant directories during scan
  const SKIP_DIRS = new Set([
    'node_modules',
    '.git',
    'target', // Rust build output
    'dist',
    'build',
    '.next',
    '.nuxt',
    '__pycache__',
    '.venv',
    'venv',
    '.gradle',
    '.idea',
    '.vscode',
    'coverage',
    '.angular',
    '.cache',
    '.turbo',
    'Pods', // iOS CocoaPods
  ]);

  const scan = async (dir) => {
    const items = await fs.promises.readdir(dir, { withFileTypes: true });
    const results = [];

    for (const item of items) {
      // Skip hidden files/dirs (except known ones we want)
      if (item.name.startsWith('.') && !item.name.startsWith('.env')) {
        if (item.isDirectory()) continue; // Skip hidden directories
      }

      const fullPath = path.join(dir, item.name);
      const isDir = item.isDirectory();

      if (isDir && SKIP_DIRS.has(item.name)) {
        continue; // Skip heavy directories entirely
      }

      results.push({
        name: item.name,
        path: fullPath,
        type: isDir ? 'folder' : 'file',
        mtimeMs: isDir ? undefined : (await fs.promises.stat(fullPath)).mtimeMs,
        children: isDir ? await scan(fullPath) : null,
      });
    }

    return results;
  };

  return await scan(rootPath);
});

// 3. Read File Content
ipcMain.handle('read-file', async (event, filePath) => {
  try {
    // Only read text files to avoid crashing on binaries (images, etc)
    return fs.readFileSync(filePath, 'utf-8');
  } catch (e) {
    return `Error reading file: ${e.message}`;
  }
});

// 4. Watch / Unwatch directory for file changes
ipcMain.handle('watch-directory', (event, rootPath) => {
  startWatching(rootPath);
});

ipcMain.handle('unwatch-directory', () => {
  stopWatching();
});

app.on('ready', createWindow);

app.on('window-all-closed', () => {
  stopWatching();
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
