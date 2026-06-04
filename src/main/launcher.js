const { app } = require('electron');
const { Client } = require('minecraft-launcher-core');
const path = require('path');
const fs = require('fs');

const launcher = new Client();

function launchGame(inst, win) {
    const isDev = app.getAppPath().includes('node_modules') || !process.resourcesPath || process.resourcesPath.includes('node_modules');
    const baseAppPath = isDev ? process.cwd() : process.resourcesPath;
    
    // --- ПЕРЕНОС В ROAMING APPDATA ---
    // Берём системный путь C:\Users\Имя\AppData\Roaming\fl-launcher
    const appDataRoot = app.getPath('userData'); 
    const rootPath = path.join(appDataRoot, 'instances', inst.name);
    // ---------------------------------
    
    // Путь к портативной Java (остаётся внутри структуры программы/extraFiles)
    const javaPath = path.join(baseAppPath, 'java', 'bin', 'java.exe');
    
    console.log(`[LAUNCHER_PATH_INFO]: Поиск Java за шляхом: "${javaPath}"`);
    console.log(`[LAUNCHER_PATH_INFO]: Глобальна папка гри в AppData: "${rootPath}"`);

    if (!fs.existsSync(javaPath)) {
        if (win && !win.isDestroyed()) win.webContents.send('status', 'Статус: помилка, портативну Java не знайдено!');
        console.error(`[LAUNCHER_ERR]: Java не знайдено за адресою: ${javaPath}`);
        return;
    }

    // --- ПРАВИЛЬНА ТА БЕЗПЕЧНА ОЧИСТКА РЯДКА ВЕРСІЇ ---
    let rawVersion = "";

    if (inst && inst.version) {
        if (typeof inst.version === 'object' && inst.version.id) {
            rawVersion = inst.version.id;
        } else if (typeof inst.version === 'string') {
            rawVersion = inst.version;
        }
    }

    let cleanVersionNumber = rawVersion.trim().split(' ')[0];

    if (!cleanVersionNumber) {
        console.error("[LAUNCHER_ERR]: Чиста версія гри пуста!");
        if (win && !win.isDestroyed()) {
            win.webContents.send('status', 'Статус: помилка конфігурації.');
            win.webContents.send('sub-status', 'Помилка: не вдалося розпізнати версію!');
        }
        return;
    }

    console.log(`[LAUNCHER_INFO]: Запуск текстової версії гри: "${cleanVersionNumber}"`);

    if (win && !win.isDestroyed()) {
        win.webContents.send('status', 'Завантаження файлів... 0%');
        win.webContents.send('sub-status', 'Аналіз клієнта гри...');
    }

    launcher.on('progress', (e) => {
        if (!win || win.isDestroyed()) return;
        const percent = ((e.task / e.total) * 100).toFixed(0);
        win.webContents.send('status', `Завантаження клієнта (${percent}%)...`);
    });

    launcher.on('download-status', (e) => {
        if (!win || win.isDestroyed()) return;
        let taskName = e.type;
        if (taskName === 'assets') taskName = 'ресурсів гри';
        if (taskName === 'classes') taskName = 'файлів клієнта';
        if (taskName === 'libraries') taskName = 'бібліотек Java';
        if (taskName === 'natives') taskName = 'системних компонентів';
        
        win.webContents.send('sub-status', `Скачується: ${taskName}...`);
    });

    let opts = {
        authorization: { access_token: "any", client_token: "any", uuid: "any", user_properties: "{}", username: inst.username || "Player" },
        root: rootPath, // Теперь качает строго в AppData/Roaming/fl-launcher/instances/...
        version: { 
            number: cleanVersionNumber, 
            type: inst.version && inst.version.includes('snapshot') ? "snapshot" : "release" 
        },
        memory: { max: "2048M", min: "512M" },
        javaPath: javaPath,
        overrides: { detached: false }
    };

    launcher.launch(opts)
        .then(() => {
            if (win && !win.isDestroyed()) {
                win.webContents.send('status', 'Статус: запуск гри...');
                win.webContents.send('sub-status', 'Приємної гри!');
                setTimeout(() => { if (win && !win.isDestroyed()) win.hide(); }, 2000);
            }
        })
        .catch((err) => {
            console.error("[LAUNCHER_CORE_ERR]:", err);
            if (win && !win.isDestroyed()) {
                win.show();
                win.webContents.send('status', `Статус: помилка запуска.`);
                win.webContents.send('sub-status', err.message);
            }
        });

    launcher.on('data', (d) => {
        const line = d.toString('utf8').trim();
        if (line) console.log(`[MC_LOG]: ${line}`);
    });

    launcher.on('close', (code) => {
        if (win && !win.isDestroyed()) {
            win.show();
            win.webContents.send('status', code === 0 ? 'Статус: готовий' : `Гра вилетіла (Код: ${code})`);
            win.webContents.send('sub-status', '');
        }
    });
}

module.exports = { launchGame };
