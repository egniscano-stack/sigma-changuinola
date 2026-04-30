const { app, BrowserWindow, Menu, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');

function createWindow() {
  const win = new BrowserWindow({
    width: 1280,
    height: 720,
    minWidth: 1000,
    minHeight: 600,
    title: "Municipio de Changuinola",
    icon: path.join(__dirname, 'dist/icon.ico'),
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.cjs')
    }
  });

  const startUrl = !app.isPackaged 
    ? 'http://localhost:3000' 
    : `file://${path.join(__dirname, 'dist/index.html')}`;

  win.loadURL(startUrl);
  if (!app.isPackaged) {
    win.webContents.openDevTools();
  }
  Menu.setApplicationMenu(null);
}

app.whenReady().then(() => {
  createWindow();

  // IPC handlers for local backup
  const backupDir = path.join(app.getPath('userData'), 'SIGMA_Backups');
  if (!fs.existsSync(backupDir)) {
    fs.mkdirSync(backupDir, { recursive: true });
  }

  ipcMain.handle('save-backup', (event, { key, data }) => {
    try {
      fs.writeFileSync(path.join(backupDir, `${key}.json`), JSON.stringify(data, null, 2));
      return { success: true, path: backupDir };
    } catch (e) {
      console.error(e);
      return { success: false, error: e.message };
    }
  });

  ipcMain.handle('load-backup', (event, { key }) => {
    try {
      const filePath = path.join(backupDir, `${key}.json`);
      if (fs.existsSync(filePath)) {
        return { success: true, data: JSON.parse(fs.readFileSync(filePath, 'utf-8')) };
      }
      return { success: true, data: null };
    } catch (e) {
      console.error(e);
      return { success: false, error: e.message };
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
