const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const scheduler = require('./scheduler');

let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1200,
    minHeight: 700,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
      enableRemoteModule: true
    },
    title: 'K8s 调度器模拟沙盒'
  });

  mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'));

  if (process.argv.includes('--dev')) {
    mainWindow.webContents.openDevTools();
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

ipcMain.handle('get-initial-nodes', () => {
  return scheduler.getInitialNodes();
});

ipcMain.handle('schedule-pod', (event, podSpec) => {
  return scheduler.schedulePod(podSpec);
});

ipcMain.handle('reset-simulation', () => {
  return scheduler.resetSimulation();
});
