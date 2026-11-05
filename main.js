const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs');

app.disableHardwareAcceleration();
app.commandLine.appendSwitch('disable-gpu');
app.commandLine.appendSwitch('no-sandbox');
app.commandLine.appendSwitch('disable-software-rasterizer');

const configPath = path.join(app.getPath('userData'), 'window-state.json');

function loadWindowState() {
  try {
    if (fs.existsSync(configPath)) {
      return JSON.parse(fs.readFileSync(configPath, 'utf8'));
    }
  } catch (e) {
    console.error("Erreur lecture configuration fenêtre", e);
  }
  return { width: 1280, height: 920, x: undefined, y: undefined };
}

function saveWindowState(win) {
  try {
    if (win && !win.isDestroyed() && !win.isMinimized() && !win.isMaximized()) {
      fs.writeFileSync(configPath, JSON.stringify(win.getBounds()), 'utf8');
    }
  } catch (e) {
    console.error("Erreur sauvegarde configuration fenêtre", e);
  }
}

let mainWindow = null;

function createWindow() {
  const state = loadWindowState();

  mainWindow = new BrowserWindow({
    width: state.width || 1280,
    height: state.height || 920,
    x: state.x,
    y: state.y,
    minWidth: 1050,
    minHeight: 750,
    title: "Roland HandSonic HPD-15 Set & Preset Librarian",
    backgroundColor: '#121518',
    show: false,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
      sandbox: false,
      webgl: false
    }
  });

  winPermissionSetup(mainWindow);

  // Sauvegarde sécurisée sur resize et move (la fermeture gère la dernière position)
  ['resize', 'move'].forEach(event => {
    mainWindow.on(event, () => saveWindowState(mainWindow));
  });

  mainWindow.on('close', () => {
    saveWindowState(mainWindow);
  });

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  mainWindow.loadFile(path.join(__dirname, 'index.html'));
}

function winPermissionSetup(win) {
  win.webContents.session.setPermissionCheckHandler((webContents, permission) => {
    return permission === 'midi' || permission === 'midiSysex';
  });
  win.webContents.session.setDevicePermissionHandler((details) => {
    return details.deviceType === 'midi';
  });
}

// Handlers IPC pour dialogues macOS natifs
ipcMain.handle('select-directory', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openDirectory', 'createDirectory'],
    title: 'Choisir le dossier de travail des Sets'
  });
  return (!result.canceled && result.filePaths.length > 0) ? result.filePaths[0] : null;
});

ipcMain.handle('show-save-dialog', async (event, defaultName) => {
  const result = await dialog.showSaveDialog(mainWindow, {
    title: 'Enregistrer le Set JSON',
    defaultPath: defaultName || 'Set_HPD15.json',
    filters: [{ name: 'Set Roland HPD-15', extensions: ['json'] }]
  });
  return (!result.canceled) ? result.filePath : null;
});

ipcMain.handle('show-open-dialog', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    title: 'Charger un Set JSON',
    properties: ['openFile'],
    filters: [{ name: 'Set Roland HPD-15', extensions: ['json'] }]
  });
  return (!result.canceled && result.filePaths.length > 0) ? result.filePaths[0] : null;
});

app.whenReady().then(() => {
  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});