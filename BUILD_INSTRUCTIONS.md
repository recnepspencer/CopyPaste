# Building the macOS App

## 1. Disable DevTools (Already Done)

DevTools auto-opening has been disabled in `main.js`.

## 2. Build the Production App

Run this command to create a macOS app bundle:

```bash
npm run package:mac
```

This will:

- Build the Angular app for production
- Create a `.app` bundle in the `release` folder
- Create a `.dmg` installer file

## 3. Find Your App

After building, you'll find:

- **App Bundle**: `release/CopyPaste.app`
- **DMG Installer**: `release/CopyPaste-0.0.0.dmg`

## 4. Install the App

### Option A: Use the DMG

1. Open the `.dmg` file
2. Drag the app to your Applications folder
3. The app will appear in your Applications folder

### Option B: Use the App Bundle Directly

1. Navigate to the `release` folder
2. Right-click `CopyPaste.app`
3. Select "Open" (you may need to allow it in Security & Privacy settings the first time)
4. You can drag it to your Applications folder or Dock

## 5. Enable DevTools for Development

If you want DevTools to open during development, uncomment this line in `main.js`:

```javascript
mainWindow.webContents.openDevTools();
```

Or use the development script:

```bash
npm start
```

## Troubleshooting

If you get a "can't be opened" error:

1. Right-click the app
2. Select "Open"
3. Click "Open" in the security dialog
4. The app will be added to your allowed apps
