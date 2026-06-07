// ============================================
// index.js (ГОЛОВНИЙ ПРОЦЕС)
// ============================================

const { app, BrowserWindow, ipcMain, dialog, shell } = require('electron');
const path = require('path');
const fs = require('fs');
const https = require('https');
const { exec } = require('child_process');
const { launchGame } = require('./launcher');
const { getVersions } = require('./downloader');
const { load, save } = require('./config');
const skinManager = require('./skin-manager');
const modManager = require('./mod-manager');
const ownerPasswords = require('./owner-passwords');

let mainWindow = null;
let splashWindow = null;
let cachedVersions = [];
let isGameLaunching = false;
let currentGameProcess = null;

const APP_VERSION = app.getVersion();
const USER_AGENT = 'fl-launcher/1.6 (github.com/Faneraiy14/fl-launcher)';

function getAppData() {
    return process.env.APPDATA ||
        (process.platform === 'darwin'
            ? path.join(process.env.HOME, 'Library', 'Application Support')
            : path.join(process.env.HOME, '.config'));
}

function safeSendToMain(channel, data) {
    if (mainWindow && !mainWindow.isDestroyed() && mainWindow.webContents) {
        try {
            mainWindow.webContents.send(channel, data);
        } catch (err) {
            console.error(`[INDEX] safeSendToMain error on ${channel}:`, err.message);
        }
    }
}

async function safeDialog(options) {
    if (!mainWindow || mainWindow.isDestroyed()) {
        return { response: -1 };
    }
    try {
        return await dialog.showMessageBox(mainWindow, options);
    } catch (err) {
        console.error('[INDEX] dialog error:', err.message);
        return { response: -1 };
    }
}

const GAME_FOLDERS = [
    'mods', 'shaderpacks', 'resourcepacks', 'saves', 'screenshots',
    'logs', 'config', 'scripts', 'datapacks', 'crash-reports'
];

function createGameFolders(instanceName) {
    try {
        const base = getInstanceRoot(instanceName);
        for (const folder of GAME_FOLDERS) {
            const folderPath = path.join(base, folder);
            if (!fs.existsSync(folderPath)) {
                fs.mkdirSync(folderPath, { recursive: true });
            }
        }
    } catch (err) {
        console.error('[INDEX] createGameFolders:', err.message);
    }
}

function getInstanceRoot(inst) {
    if (inst?.customPath && typeof inst.customPath === 'string' && inst.customPath.trim().length > 0) {
        return path.normalize(inst.customPath);
    }
    const name = typeof inst === 'string' ? inst : inst?.name;
    if (!name) return path.join(getAppData(), 'fl-launcher', 'instances', 'default');
    const safeName = path.basename(name).replace(/[/\\]/g, '_');
    return path.join(getAppData(), 'fl-launcher', 'instances', safeName);
}

function showAbout() {
    safeDialog({
        type: 'info', 
        title: 'Про FL Launcher',
        message: `FL Launcher v${APP_VERSION}`,
        detail: `Лаунчер для Minecraft Java Edition\n\nРозробник: Faneraiy14\n\nОсобливості:\n• Підтримка Fabric, Forge, NeoForge\n• Автоматична Java через Adoptium API\n• Менеджер модів (Modrinth)\n• Менеджер скінів\n• Автооновлення\n\n© 2026 FL Launcher`,
        buttons: ['OK']
    });
}

let updateDownloading = false;

function downloadAndInstallUpdate(version, downloadUrl) {
    if (updateDownloading) return;
    updateDownloading = true;
    
    safeDialog({
        type: 'info', 
        title: 'Завантаження оновлення',
        message: `Завантаження FL Launcher ${version}...`,
        detail: 'Будь ласка, зачекайте. Вікно закриється після завершення.',
        buttons: ['OK'],
        noLink: true
    });
    
    const downloadPath = path.join(app.getPath('temp'), `fl-launcher-${version}-setup.exe`);
    const file = fs.createWriteStream(downloadPath);
    
    const request = https.get(downloadUrl, { headers: { 'User-Agent': USER_AGENT } }, (response) => {
        response.pipe(file);
        file.on('finish', () => {
            file.close();
            safeDialog({
                type: 'question', 
                title: 'Оновлення готове',
                message: 'Оновлення завантажено! Встановити зараз?',
                detail: 'Лаунчер закриється для встановлення оновлення.',
                buttons: ['Встановити зараз', 'Пізніше'], 
                defaultId: 0, 
                cancelId: 1
            }).then(r => {
                if (r.response === 0) {
                    exec(`"${downloadPath}" /S`, (err) => {
                        if (err) console.error('[UPDATER] Помилка запуску інсталятора:', err);
                        app.quit();
                    });
                } else {
                    updateDownloading = false;
                }
            }).catch(() => { updateDownloading = false; });
        });
    });
    
    request.on('error', (err) => {
        console.error('[UPDATER] Помилка завантаження:', err);
        updateDownloading = false;
        safeDialog({
            type: 'error', 
            title: 'Помилка',
            message: 'Не вдалося завантажити оновлення.',
            detail: err.message,
            buttons: ['OK']
        });
    });
    request.setTimeout(30000, () => {
        request.destroy();
        updateDownloading = false;
    });
}

function checkForUpdates(silent = false) {
    console.log('[UPDATER] Перевірка оновлень... Поточна версія:', APP_VERSION);
    
    const url = 'https://github.com/Faneraiy14/fl-launcher/releases/latest/download/latest.yml';
    
    const request = https.get(url, { headers: { 'User-Agent': USER_AGENT }, timeout: 10000 }, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
            try {
                const versionMatch = data.match(/version:\s*(\d+\.\d+\.\d+)/);
                if (versionMatch) {
                    const latestVersion = versionMatch[1];
                    console.log('[UPDATER] Остання версія:', latestVersion);
                    
                    if (latestVersion !== APP_VERSION) {
                        console.log('[UPDATER] Доступне оновлення!');
                        safeDialog({
                            type: 'info', 
                            title: 'Доступне оновлення',
                            message: `Нова версія FL Launcher ${latestVersion} доступна!`,
                            detail: `Ваша версія: ${APP_VERSION}\nНова версія: ${latestVersion}\n\nБажаєте оновити зараз?`,
                            buttons: ['Оновити', 'Пізніше'], 
                            defaultId: 0, 
                            cancelId: 1
                        }).then(r => {
                            if (r.response === 0) {
                                const downloadUrl = `https://github.com/Faneraiy14/fl-launcher/releases/download/v${latestVersion}/fl-launcher-Setup-${latestVersion}.exe`;
                                downloadAndInstallUpdate(latestVersion, downloadUrl);
                            }
                        }).catch(err => console.error('[UPDATER] dialog error:', err));
                    } else if (!silent) {
                        safeDialog({
                            type: 'info', 
                            title: 'Оновлення',
                            message: 'У вас остання версія!',
                            detail: `FL Launcher ${APP_VERSION} — остання версія.`,
                            buttons: ['OK']
                        });
                    } else {
                        console.log('[UPDATER] Вже остання версія');
                    }
                }
            } catch (err) {
                console.error('[UPDATER] Помилка парсингу:', err);
                if (!silent) {
                    safeDialog({ type: 'error', title: 'Помилка', message: 'Не вдалося перевірити оновлення.', buttons: ['OK'] });
                }
            }
        });
    });
    
    request.on('error', (err) => {
        console.error('[UPDATER] Помилка запиту:', err.message);
        if (!silent) {
            safeDialog({ type: 'error', title: 'Помилка', message: 'Не вдалося підключитись до сервера.', buttons: ['OK'] });
        }
    });
    request.setTimeout(10000, () => {
        request.destroy();
        if (!silent) {
            safeDialog({ type: 'error', title: 'Помилка', message: 'Таймаут підключення.', buttons: ['OK'] });
        }
    });
}

function createSplashWindow() {
    splashWindow = new BrowserWindow({
        width: 400, 
        height: 250,
        frame: false, 
        transparent: true,
        alwaysOnTop: true, 
        center: true,
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            preload: path.join(__dirname, 'preload.js')
        }
    });
    splashWindow.setMenu(null);

    const splashHtml = `<!DOCTYPE html><html><head><style>
        *{margin:0;padding:0;box-sizing:border-box}
        body{background:#121214;color:#fff;font-family:'Segoe UI',sans-serif;
             display:flex;flex-direction:column;justify-content:center;align-items:center;
             height:100vh;border:1px solid #27272a;border-radius:12px;overflow:hidden}
        .logo{font-size:32px;font-weight:800;color:#2ecc71;margin-bottom:12px;letter-spacing:2px}
        .spin{width:36px;height:36px;border:4px solid #27272a;border-top-color:#2ecc71;
              border-radius:50%;animation:s .9s linear infinite;margin-bottom:14px}
        .txt{font-size:13px;color:#71717a}
        @keyframes s{to{transform:rotate(360deg)}}
    </style></head><body>
        <div class="logo">FL LAUNCHER</div>
        <div class="spin"></div>
        <div class="txt">Завантаження списку версій...</div>
    </body></html>`;

    splashWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(splashHtml)}`);

    splashWindow.webContents.once('did-finish-load', async () => {
        const timer = setTimeout(() => { 
            if (splashWindow && !splashWindow.isDestroyed() && !mainWindow) {
                console.warn('[SPLASH] Timeout, примусове створення вікна');
                createMainWindow(); 
            }
        }, 15000);
        
        try {
            const versions = await getVersions();
            cachedVersions = Array.isArray(versions) ? versions : [];
        } catch (err) {
            console.error('[INDEX] getVersions error:', err.message);
            cachedVersions = [];
        } finally {
            clearTimeout(timer);
            if (!mainWindow && splashWindow && !splashWindow.isDestroyed()) {
                createMainWindow();
            }
        }
    });
}

function createMainWindow() {
    if (splashWindow && !splashWindow.isDestroyed()) {
        splashWindow.close();
        splashWindow = null;
    }
    
    mainWindow = new BrowserWindow({
        width: 1100, 
        height: 750,
        show: false, 
        minWidth: 900, 
        minHeight: 650,
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            preload: path.join(__dirname, 'preload.js')
        }
    });
    mainWindow.setMenu(null);
    mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'));

    mainWindow.webContents.setWindowOpenHandler(({ url }) => {
        shell.openExternal(url);
        return { action: 'deny' };
    });

    const defaultVersions = [
        { id: '1.21.10', type: 'release' },
        { id: '1.21.4', type: 'release' },
        { id: '1.21.3', type: 'release' },
        { id: '1.21.1', type: 'release' },
        { id: '1.20.4', type: 'release' },
        { id: '1.20.1', type: 'release' },
        { id: '1.19.4', type: 'release' },
        { id: '1.18.2', type: 'release' },
        { id: '1.16.5', type: 'release' }
    ];
    
    mainWindow.webContents.once('did-finish-load', () => {
        const versionsToSend = (cachedVersions && cachedVersions.length) ? cachedVersions : defaultVersions;
        safeSendToMain('init-versions-data', versionsToSend);
    });

    mainWindow.once('ready-to-show', () => {
        mainWindow.show();
        
        setTimeout(() => {
            checkForUpdates(true);
        }, 5000);
    });

    mainWindow.on('closed', () => { 
        mainWindow = null; 
    });
}

app.whenReady().then(() => {
    createSplashWindow();
});

app.on('window-all-closed', () => { 
    if (process.platform !== 'darwin') app.quit(); 
});

app.on('activate', () => {
    if (mainWindow === null) {
        createSplashWindow();
    }
});

// ============ IPC: КОНФІГУРАЦІЯ ============

ipcMain.handle('get-cfg', async () => {
    try { 
        return load(); 
    } catch (err) { 
        console.error('[IPC] get-cfg error:', err.message);
        return { installations: [] }; 
    }
});

ipcMain.on('save-inst', (e, inst) => {
    try {
        if (!inst || !inst.name) {
            console.error('[IPC] save-inst: invalid instance data');
            return;
        }
        const cfg = load();
        if (cfg.installations.some(i => i.name === inst.name)) {
            safeSendToMain('config-updated');
            return;
        }
        cfg.installations.push(inst);
        save(cfg);
        createGameFolders(inst);
        safeSendToMain('config-updated');
    } catch (err) { 
        console.error('[IPC] save-inst:', err.message); 
    }
});

ipcMain.on('del-inst', (e, name) => {
    if (!name) return;
    
    safeDialog({
        type: 'warning', 
        title: 'Видалення збірки',
        message: `Видалити збірку "${name}"?`,
        detail: 'Файли конфігурації збірки будуть видалені з списку (папка залишиться на диску).',
        buttons: ['Видалити', 'Скасувати'], 
        defaultId: 1, 
        cancelId: 1
    }).then(r => {
        if (r.response !== 0) return;
        try {
            const cfg = load();
            cfg.installations = cfg.installations.filter(i => i.name !== name);
            save(cfg);
            safeSendToMain('config-updated');
        } catch (err) { 
            console.error('[IPC] del-inst:', err.message); 
        }
    }).catch(err => console.error('[IPC] del-inst dialog error:', err));
});

ipcMain.on('update-inst', (e, d) => {
    try {
        if (!d || !d.oldName) {
            console.error('[IPC] update-inst: invalid data');
            return;
        }
        const cfg = load();
        const idx = cfg.installations.findIndex(i => i.name === d.oldName);
        if (idx === -1) return;

        if (d.oldName !== d.name && d.name) {
            const oldPath = path.join(getAppData(), 'fl-launcher', 'instances', d.oldName);
            const newPath = path.join(getAppData(), 'fl-launcher', 'instances', d.name);
            if (fs.existsSync(oldPath) && !fs.existsSync(newPath)) {
                try {
                    fs.renameSync(oldPath, newPath);
                } catch (renameErr) {
                    console.error('[IPC] update-inst rename error:', renameErr.message);
                }
            }
        }

        cfg.installations[idx] = {
            name: d.name || d.oldName,
            username: d.username || 'Player',
            password: d.password || '',
            skin: d.skin || 'steve',
            version: d.version || '1.21.10',
            loader: d.loader || 'Vanilla',
            customPath: d.customPath || '',
            ram: d.ram || 4096
        };
        save(cfg);
        createGameFolders(cfg.installations[idx]);
        safeSendToMain('config-updated');
    } catch (err) { 
        console.error('[IPC] update-inst:', err.message); 
    }
});

// ============ IPC: ЗАПУСК ГРИ ============

ipcMain.on('launch', async (e, inst) => {
    if (isGameLaunching) {
        safeSendToMain('status', 'Статус: гра вже запускається...');
        return;
    }
    if (!inst?.name) {
        safeSendToMain('status', 'Статус: помилка - немає даних збірки');
        return;
    }
    
    isGameLaunching = true;

    try {
        const cfg = load();
        const idx = cfg.installations.findIndex(i => i.name === inst.name);
        if (idx !== -1) {
            cfg.installations[idx] = {
                name: inst.name,
                username: inst.username || 'Player',
                password: inst.password || '',
                skin: inst.skin || 'steve',
                version: inst.version,
                loader: inst.loader || 'Vanilla',
                customPath: inst.customPath || '',
                ram: inst.ram || 4096
            };
            save(cfg);
        }
        createGameFolders(inst);
        
        currentGameProcess = await launchGame(inst, mainWindow);
        
        if (currentGameProcess) {
            currentGameProcess.on('exit', () => {
                isGameLaunching = false;
                currentGameProcess = null;
            });
        } else {
            isGameLaunching = false;
        }
    } catch (err) {
        console.error('[IPC] launch:', err.message);
        safeSendToMain('status', 'Статус: помилка запуска.');
        safeSendToMain('sub-status', err.message);
        isGameLaunching = false;
        if (mainWindow && !mainWindow.isDestroyed()) mainWindow.show();
    }
});

// ============ IPC: РІЗНЕ ============

ipcMain.on('show-about-dialog', showAbout);
ipcMain.on('check-for-updates', () => checkForUpdates(false));

ipcMain.handle('get-app-version', async () => {
    return app.getVersion();
});

ipcMain.on('open-game-folder', (e, inst) => {
    try {
        if (!inst) return;
        const folder = getInstanceRoot(inst);
        if (!fs.existsSync(folder)) {
            fs.mkdirSync(folder, { recursive: true });
        }
        shell.openPath(folder);
    } catch (err) {
        console.error('[IPC] open-game-folder:', err.message);
    }
});

ipcMain.on('open-game-log', (e, inst) => {
    try {
        if (!inst) return;
        const logPath = path.join(getInstanceRoot(inst), 'latest-mc.log');
        if (fs.existsSync(logPath)) {
            shell.openPath(logPath);
        } else {
            safeDialog({
                type: 'info',
                title: 'Лог не знайдено',
                message: 'Лог ще не створено. Запустіть гру хоча б раз!',
                buttons: ['OK']
            });
        }
    } catch (err) {
        console.error('[IPC] open-game-log:', err.message);
    }
});

// ============ IPC: ВІДКРИТТЯ ДОЧІРНІХ ВІКОН ============

function createChildWindow(parent, htmlFile, options = {}) {
    if (!mainWindow) return null;
    
    const win = new BrowserWindow({
        width: options.width || 800,
        height: options.height || 620,
        parent: mainWindow,
        modal: options.modal !== false,
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            preload: path.join(__dirname, 'preload.js')
        }
    });
    win.setMenu(null);
    win.loadFile(path.join(__dirname, '../renderer', htmlFile));
    return win;
}

ipcMain.on('open-skin-selector', () => {
    const skinWin = createChildWindow(mainWindow, 'skin-selector.html', { width: 800, height: 620 });
    if (skinWin) {
        skinWin.on('closed', () => {
            safeSendToMain('config-updated');
        });
    }
});

ipcMain.on('open-mod-manager', (e, instData) => {
    const modWin = createChildWindow(mainWindow, 'mod-manager.html', { width: 1000, height: 720 });
    if (modWin && instData) {
        modWin.webContents.once('did-finish-load', () => {
            modWin.webContents.send('instance-data', instData);
        });
    }
});

ipcMain.on('open-owner-passwords', () => {
    createChildWindow(mainWindow, 'owner-passwords.html', { width: 600, height: 550 });
});

// ============ IPC: СКІНИ ============

ipcMain.handle('get-skins', async () => {
    try {
        return skinManager.getAllSkins();
    } catch (err) {
        console.error('[IPC] get-skins error:', err);
        return [];
    }
});

ipcMain.on('save-custom-skin', (e, { skinId, base64 }) => {
    try {
        if (!skinId || !base64) {
            e.reply('skin-saved', { success: false, error: 'Missing data' });
            return;
        }
        const skinsDir = skinManager.skinsFolder;
        if (!fs.existsSync(skinsDir)) fs.mkdirSync(skinsDir, { recursive: true });
        const safeSkinId = path.basename(String(skinId || `custom_${Date.now()}`)).replace(/\.png$/i, '');
        const skinPath = path.join(skinsDir, `${safeSkinId}.png`);
        const base64Data = base64.replace(/^data:image\/png;base64,/, '');
        fs.writeFileSync(skinPath, base64Data, 'base64');
        e.reply('skin-saved', { success: true, skinId: safeSkinId });
    } catch (err) {
        console.error('[IPC] save-custom-skin:', err.message);
        e.reply('skin-saved', { success: false, error: err.message });
    }
});

ipcMain.on('delete-custom-skin', (e, skinId) => {
    const success = skinManager.deleteCustomSkin(skinId);
    e.reply('skin-deleted', { success, skinId });
});

ipcMain.on('update-skin', (e, skin) => {
    safeSendToMain('skin-updated', skin);
});

// ============ IPC: МОДИ ============

ipcMain.handle('search-mods', async (e, query) => {
    try {
        return await modManager.searchMods(query);
    } catch (err) {
        console.error('[IPC] search-mods error:', err);
        return [];
    }
});

ipcMain.handle('get-mod-versions', async (e, projectId, loader, gameVersion) => {
    try {
        return await modManager.getModVersions(projectId, loader, gameVersion);
    } catch (err) {
        console.error('[IPC] get-mod-versions error:', err);
        return [];
    }
});

ipcMain.handle('download-mod', async (e, projectId, versionId, instName) => {
    try {
        return await modManager.downloadMod(projectId, versionId, instName);
    } catch (err) {
        console.error('[IPC] download-mod error:', err);
        return { success: false, error: err.message };
    }
});

ipcMain.handle('get-installed-mods', async (e, instName) => {
    try {
        return modManager.getInstalledMods(instName);
    } catch (err) {
        console.error('[IPC] get-installed-mods error:', err);
        return [];
    }
});

ipcMain.on('delete-mod', (e, data) => {
    try {
        const instName = data.instance || data;
        const modName = data.mod || '';
        const success = modManager.deleteMod(instName, modName);
        e.reply('mod-deleted', { success, modName });
    } catch (err) {
        console.error('[IPC] delete-mod error:', err);
        e.reply('mod-deleted', { success: false, modName: '' });
    }
});

ipcMain.on('install-local-mod', (e, data) => {
    try {
        const instName = data.instance || data;
        const filePath = data.path || '';
        const result = modManager.installLocalMod(instName, filePath);
        e.reply('mod-installed', result);
    } catch (err) {
        console.error('[IPC] install-local-mod error:', err);
        e.reply('mod-installed', { success: false, error: err.message });
    }
});

// ============ IPC: ПАРОЛІ ОВНЕРА ============

ipcMain.handle('owner-is-set', async () => {
    try {
        return ownerPasswords.isMasterPasswordSet();
    } catch (err) {
        console.error('[IPC] owner-is-set error:', err);
        return true;
    }
});

ipcMain.handle('owner-is-using-factory', async () => {
    try {
        return ownerPasswords.isUsingFactoryPassword();
    } catch (err) {
        console.error('[IPC] owner-is-using-factory error:', err);
        return true;
    }
});

ipcMain.handle('owner-change-password', async (e, { oldPassword, newPassword }) => {
    try {
        return ownerPasswords.changeMasterPassword(oldPassword, newPassword);
    } catch (err) {
        console.error('[IPC] owner-change-password error:', err);
        return { success: false, error: err.message };
    }
});

ipcMain.on('owner-check-master', (e, password) => {
    try {
        const result = ownerPasswords.checkMasterPassword(password);
        e.reply('owner-auth-result', { success: result });
    } catch (err) {
        console.error('[IPC] owner-check-master error:', err);
        e.reply('owner-auth-result', { success: false });
    }
});

ipcMain.handle('owner-get-passwords', async () => {
    try {
        return ownerPasswords.getPasswords();
    } catch (err) {
        console.error('[IPC] owner-get-passwords error:', err);
        return [];
    }
});

ipcMain.on('owner-add-password', (e, { service, username, password }) => {
    try {
        ownerPasswords.addPassword(service, username, password);
        e.reply('owner-passwords-updated');
    } catch (err) {
        console.error('[IPC] owner-add-password error:', err);
    }
});

ipcMain.on('owner-delete-password', (e, service) => {
    try {
        ownerPasswords.deletePassword(service);
        e.reply('owner-passwords-updated');
    } catch (err) {
        console.error('[IPC] owner-delete-password error:', err);
    }
});