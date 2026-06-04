const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const { autoUpdater } = require('electron-updater');
const { launchGame } = require('./launcher'); 
const { getVersions } = require('./downloader');
const { load, save } = require('./config');

let win;

function createWindow() {
    win = new BrowserWindow({ 
        width: 1000, 
        height: 700, 
        webPreferences: { 
            nodeIntegration: true, 
            contextIsolation: false 
        } 
    });
    
    win.setMenu(null); // Повністю прибираємо верхній білий бар меню
    win.loadFile(path.join(__dirname, '../renderer/index.html'));

    win.on('closed', () => {
        win = null;
    });

    setTimeout(() => {
        autoUpdater.checkForUpdatesAndNotify().catch(err => console.error("Помилка автооновлення лаунчера:", err));
    }, 3000);
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
});

// ОБРОБКА ЗАПИТІВ IPC-МОСТУ

ipcMain.handle('get-versions', async () => {
    try {
        return await getVersions();
    } catch (err) {
        console.error("Помилка у мосту get-versions:", err);
        return [];
    }
});

ipcMain.handle('get-cfg', () => {
    try {
        return load();
    } catch (err) {
        return { installations: [] };
    }
});

ipcMain.on('save-inst', (e, i) => { 
    try {
        let c = load(); 
        c.installations.push(i); 
        save(c); 
        e.reply('config-updated');
    } catch (err) {
        console.error("Помилка збереження збірки:", err);
    }
});

ipcMain.on('del-inst', (e, name) => { 
    try {
        let c = load(); 
        c.installations = c.installations.filter(i => i.name !== name); 
        save(c); 
        e.reply('config-updated');
    } catch (err) {
        console.error("Помилка видалення збірки:", err);
    }
});

ipcMain.on('update-inst', (e, d) => { 
    try {
        let c = load(); 
        let idx = c.installations.findIndex(i => i.name === d.oldName); 
        if (idx !== -1) {
            c.installations[idx] = {
                name: d.name,
                username: d.username,
                version: d.version,
                loader: d.loader,
                customPath: d.customPath
            };
            save(c); 
            e.reply('config-updated');
        }
    } catch (err) {
        console.error("Помилка оновлення конфігу:", err);
    }
});

ipcMain.on('launch', (e, inst) => {
    try {
        if (win) launchGame(inst, win);
    } catch (err) {
        console.error("Критична помилка виклику launchGame:", err);
    }
});

// АВТООНОВЛЕННЯ СЕРВЕРУ
autoUpdater.on('update-available', () => { if (win && win.webContents) win.webContents.send('updater-download-start'); });
autoUpdater.on('download-progress', (p) => { if (win && win.webContents) win.webContents.send('updater-download-progress', p.percent.toFixed(1)); });
autoUpdater.on('update-downloaded', () => {
    if (!win) return;
    dialog.showMessageBox(win, { type: 'info', title: 'Оновлення', message: 'Перезапустити лаунчер для встановлення оновлення?', buttons: ['Оновити', 'Пізніше'], defaultId: 0 })
    .then((r) => { if (r.response === 0) autoUpdater.quitAndInstall(); });
});