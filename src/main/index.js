// ЧАСТИНА 1: Модулі, ініціалізація вікон та автооновлення
const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const { autoUpdater } = require('electron-updater');
const { launchGame } = require('./launcher'); 
const { getVersions } = require('./downloader');
const { load, save } = require('./config');

let mainWindow;
let splashWindow;
let cachedVersions = []; 

function preCreateInstanceFolders(instanceName) {
    try {
        const appDataRoaming = process.env.APPDATA || (process.platform === 'darwin' ? path.join(process.env.HOME, 'Library', 'Application Support') : path.join(process.env.HOME, '.config'));
        const instanceModsPath = path.join(appDataRoaming, 'fl-launcher', 'instances', instanceName, 'mods');
        if (!fs.existsSync(instanceModsPath)) {
            fs.mkdirSync(instanceModsPath, { recursive: true });
            console.log(`[CONFIG_INFO]: Папку mods для збірки "${instanceName}" створено заздалегідь.`);
        }
    } catch (err) {
        console.error("Помилка попереднього створення папок:", err);
    }
}

function createSplashWindow() {
    splashWindow = new BrowserWindow({
        width: 400,
        height: 250,
        frame: false, 
        transparent: true, 
        alwaysOnTop: true,
        center: true, 
        webPreferences: { nodeIntegration: true, contextIsolation: false }
    });

    const splashHtml = `
        <!DOCTYPE html>
        <html>
        <head>
            <style>
                body { background: #121214; color: #fff; font-family: 'Segoe UI', sans-serif; margin:0; display:flex; flex-direction:column; justify-content:center; align-items:center; height:100vh; border: 1px solid #27272a; border-radius: 12px; overflow:hidden; }
                .logo { font-size: 32px; font-weight: 800; color: #2ecc71; margin-bottom: 10px; letter-spacing: 2px; }
                .loader { width: 40px; height: 40px; border: 4px solid #27272a; border-top: 4px solid #2ecc71; border-radius: 50%; animation: spin 1s linear infinite; margin-bottom: 15px; }
                .text { font-size: 14px; color: #a1a1aa; font-weight: 500; }
                @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
            </style>
        </head>
        <body>
            <div class="logo">FL LAUNCHER</div>
            <div class="loader"></div>
            <div class="text">Перевірка модулів та завантаження версій...</div>
        </body>
        </html>
    `;
    
    splashWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(splashHtml)}`);

    splashWindow.webContents.on('did-finish-load', async () => {
        let isDataLoaded = false;
        const maxTimeout = setTimeout(() => {
            if (!isDataLoaded) {
                isDataLoaded = true;
                createMainWindow();
            }
        }, 300000);

        try {
            cachedVersions = await getVersions();
            if (!isDataLoaded) {
                clearTimeout(maxTimeout);
                isDataLoaded = true;
                createMainWindow();
            }
        } catch (err) {
            if (!isDataLoaded) {
                clearTimeout(maxTimeout);
                isDataLoaded = true;
                createMainWindow(); 
            }
        }
    });
}

function createMainWindow() {
    mainWindow = new BrowserWindow({ 
        width: 1000, 
        height: 700, 
        show: false, 
        webPreferences: { nodeIntegration: true, contextIsolation: false } 
    });
    
    mainWindow.setMenu(null); 
    mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'));

    mainWindow.webContents.on('did-finish-load', () => {
        if (mainWindow && mainWindow.webContents) {
            mainWindow.webContents.send('init-versions-data', cachedVersions);
        }
    });

    mainWindow.once('ready-to-show', () => {
        if (splashWindow) {
            splashWindow.close(); 
            splashWindow = null;
        }
        mainWindow.show(); 
    });

    mainWindow.on('closed', () => { mainWindow = null; });

    setTimeout(() => {
        autoUpdater.checkForUpdatesAndNotify().catch(err => console.error("Помилка автооновлення:", err));
    }, 3000);
}

app.whenReady().then(createSplashWindow);

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
});
// ЧАСТЬ 2: IPC Обработчики, Автосохранение и Запуск игры

ipcMain.handle('get-cfg', () => {
    try { return load(); } catch (err) { return { installations: [] }; }
});

ipcMain.on('save-inst', (e, i) => { 
    try { 
        let c = load(); 
        c.installations.push(i); 
        save(c); 
        preCreateInstanceFolders(i.name);
        e.reply('config-updated'); 
    } catch (err) { console.error(err); }
});

ipcMain.on('del-inst', (e, name) => { 
    try { let c = load(); c.installations = c.installations.filter(i => i.name !== name); save(c); e.reply('config-updated'); } catch (err) { console.error(err); }
});

ipcMain.on('update-inst', (e, d) => { 
    try {
        let c = load(); 
        let idx = c.installations.findIndex(i => i.name === d.oldName); 
        if (idx !== -1) {
            const appDataRoaming = process.env.APPDATA || (process.platform === 'darwin' ? path.join(process.env.HOME, 'Library', 'Application Support') : path.join(process.env.HOME, '.config'));
            const oldFolderPath = path.join(appDataRoaming, 'fl-launcher', 'instances', d.oldName);
            const newFolderPath = path.join(appDataRoaming, 'fl-launcher', 'instances', d.name);
            
            if (d.oldName !== d.name && fs.existsSync(oldFolderPath)) {
                if (!fs.existsSync(path.dirname(newFolderPath))) {
                    fs.mkdirSync(path.dirname(newFolderPath), { recursive: true });
                }
                fs.renameSync(oldFolderPath, newFolderPath);
            }
            c.installations[idx] = { name: d.name, username: d.username, version: d.version, loader: d.loader, customPath: d.customPath, ram: d.ram };
            save(c); 
            preCreateInstanceFolders(d.name);
            e.reply('config-updated');
        }
    } catch (err) { console.error(err); }
});

// ВИПРАВЛЕНО: Автоматичне збереження поточної конфігурації збірки прямо перед грою
ipcMain.on('launch', (e, inst) => {
    try { 
        if (!inst || !inst.name) return;

        let c = load(); 
        // Шукаємо, чи існує вже така збірка в конфігурації лаунчера
        let idx = c.installations.findIndex(i => i.name === inst.name); 
        
        if (idx !== -1) {
            // Якщо збірка знайдена, оновлюємо її актуальними даними з полей інтерфейсу
            c.installations[idx] = { 
                name: inst.name, 
                username: inst.username, 
                version: inst.version, 
                loader: inst.loader, 
                customPath: inst.customPath || '', 
                ram: inst.ram 
            };
            save(c);
        }

        // Забезпечуємо створення папки з правильною назвою збірки перед запуском
        preCreateInstanceFolders(inst.name);

        if (mainWindow) {
            launchGame(inst, mainWindow); 
        }
    } catch (err) { 
        console.error("Помилка автозбереження перед запуском:", err); 
    }
});

autoUpdater.on('update-available', () => { if (mainWindow && mainWindow.webContents) mainWindow.webContents.send('updater-download-start'); });
autoUpdater.on('download-progress', (p) => { if (mainWindow && mainWindow.webContents) mainWindow.webContents.send('updater-download-progress', p.percent.toFixed(1)); });
autoUpdater.on('update-downloaded', () => {
    if (!mainWindow) return;
    dialog.showMessageBox(mainWindow, { type: 'info', title: 'Оновлення', message: 'Перезапустити лаунчер для встановлення оновлення?', buttons: ['Оновити', 'Пізніше'], defaultId: 0 })
    .then((r) => { if (r.response === 0) autoUpdater.quitAndInstall(); });
});
