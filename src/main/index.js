const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const { launchGame } = require('./launcher');
const { getVersions } = require('./downloader');

function createWindow() {
    const win = new BrowserWindow({
        width: 900, height: 600,
        webPreferences: { nodeIntegration: true, contextIsolation: false }
    });
    win.loadFile(path.join(__dirname, '../renderer/index.html'));
}

ipcMain.handle('get-versions', async () => await getVersions());
ipcMain.on('launch-game', (event, data) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    launchGame(data.username, data.version, win);
});

app.whenReady().then(createWindow)