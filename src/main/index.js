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
    
    win.loadFile(path.join(__dirname, '../renderer/index.html'));

    win.on('closed', () => {
        win = null;
    });

    // Безпечний запуск перевірки оновлень через 3 секунди
    setTimeout(() => {
        autoUpdater.checkForUpdatesAndNotify().catch(err => console.error("Помилка автооновлення:", err));
    }, 3000);
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
    if (win === null) createWindow();
});

// ОБРОБКА ЗАПИТІВ ІНТЕРФЕЙСУ (IPC)

ipcMain.handle('get-versions', async () => {
    try {
        return await getVersions();
    } catch (err) {
        console.error("Помилка отримання версій:", err);
        return [];
    }
});

ipcMain.handle('get-cfg', () => {
    try {
        return load();
    } catch (err) {
        console.error("Помилка завантаження конфігу:", err);
        return { installations: [] };
    }
});

// Збереження нової збірки
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

// Видалення збірки
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

// Редагування та оновлення збірки
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
        console.error("Помилка оновлення збірки:", err);
    }
});

// Виклик запуску гри з обробкою збоїв
ipcMain.on('launch', (e, inst) => {
    try {
        if (win) launchGame(inst, win);
    } catch (err) {
        console.error("Критична помилка запуску гри:", err);
    }
});

// НАЛАШТУВАННЯ ПОДІЙ АВТООНОВЛЕННЯ

autoUpdater.on('update-available', () => {
    if (win && win.webContents) win.webContents.send('updater-download-start');
});

autoUpdater.on('download-progress', (progressObj) => {
    if (win && win.webContents) {
        win.webContents.send('updater-download-progress', progressObj.percent.toFixed(1));
    }
});

autoUpdater.on('update-downloaded', () => {
    if (!win) return;
    dialog.showMessageBox(win, {
        type: 'info',
        title: 'Оновлення готове',
        message: 'Нову версію лаунчера успішно завантажено. Перезапустити програму, щоб оновитися?',
        buttons: ['Оновити зараз', 'Пізніше'],
        defaultId: 0
    }).then((result) => {
        if (result.response === 0) {
            autoUpdater.quitAndInstall();
        }
    });
});

// Відловлювання помилок мережі або доступу при автооновленні
autoUpdater.on('error', (err) => {
    console.error("Помилка в модулі electron-updater:", err);
});
