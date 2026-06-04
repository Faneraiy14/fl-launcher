const { app } = require('electron');
const { Client } = require('minecraft-launcher-core');
const path = require('path');
const fs = require('fs');

const launcher = new Client();

function launchGame(inst, win) {
    const isDev = app.getAppPath().includes('node_modules') || !process.resourcesPath || process.resourcesPath.includes('node_modules');
    const baseAppPath = isDev ? process.cwd() : process.resourcesPath;
    
    const appDataRoot = app.getPath('userData'); 
    const rootPath = path.join(appDataRoot, 'instances', inst.name);
    const javaPath = path.join(baseAppPath, 'java', 'bin', 'java.exe');
    
    console.log(`[LAUNCHER_PATH_INFO]: Пошук Java за шляхом: "${javaPath}"`);
    console.log(`[LAUNCHER_PATH_INFO]: Папка гри в AppData: "${rootPath}"`);

    if (!fs.existsSync(javaPath)) {
        if (win && !win.isDestroyed()) {
            win.webContents.send('status', 'Статус: помилка, портативну Java не знайдено!');
            win.webContents.send('sub-status', 'Будь ласка, перевірте наявність папки java в корні.');
        }
        return;
    }

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
        if (win && !win.isDestroyed()) win.webContents.send('status', 'Статус: помилка конфігурації.');
        return;
    }

    console.log(`[LAUNCHER_INFO]: Початок підготовки версії гри: "${cleanVersionNumber}"`);

    // ВІДПРАВЛЯЄМО ПЕРШИЙ ЖИВИЙ СТАТУС, ЩОБ КОРИСТУВАЧ БАЧИВ РОБОТУ
    if (win && !win.isDestroyed()) {
        win.webContents.send('status', 'Зв\'язок із серверами Mojang...');
        win.webContents.send('sub-status', 'Очікуйте, перевіряємо маніфести та індекси клієнта...');
    }

    // ВІДСТЕЖЕННЯ ПРОГРЕСУ СКАЧУВАННЯ
    launcher.on('progress', (e) => {
        if (!win || win.isDestroyed()) return;
        const percent = ((e.task / e.total) * 100).toFixed(0);
        win.webContents.send('status', `Завантаження файлів клієнта (${percent}%)...`);
    });

    // ПОКРОКОВЕ ВІДПРАВЛЕННЯ НАЗВ КОМПОНЕНТІВ, ЯКІ ЗАРАЗ СКАЧУЮТЬСЯ
    launcher.on('download-status', (e) => {
        if (!win || win.isDestroyed()) return;
        let taskName = e.type;
        if (taskName === 'assets') taskName = 'ігрових ресурсів (текстури, звуки)';
        if (taskName === 'classes') taskName = 'головних файлів клієнта (client.jar)';
        if (taskName === 'libraries') taskName = 'системних бібліотек Java';
        if (taskName === 'natives') taskName = 'компонентів сумісності Windows';
        
        win.webContents.send('sub-status', `Скачується: ${taskName}...`);
    });

    let opts = {
        authorization: { access_token: "any", client_token: "any", uuid: "any", user_properties: "{}", username: inst.username || "Player" },
        root: rootPath, 
        version: { 
            number: cleanVersionNumber, 
            type: inst.version && inst.version.includes('snapshot') ? "snapshot" : "release" 
        },
        memory: { max: "4096M", min: "1024M" }, // Збільшено для стабільності
        javaPath: javaPath,
        overrides: { detached: false }
    };

    launcher.launch(opts)
        .then(() => {
            if (win && !win.isDestroyed()) {
                win.webContents.send('status', 'Статус: запуск гри...');
                win.webContents.send('sub-status', 'Java-процес запущено успішно! Приємної гри!');
                // --- ХОВАННЯ ВІКНА ПОВНІСТЮ ВИМКНЕНО ---
                // Ми залишаємо лаунчер відкритим на екрані, щоб ви бачили весь лог розгортання
            }
        })
        .catch((err) => {
            console.error("[LAUNCHER_CORE_ERR]:", err);
            if (win && !win.isDestroyed()) {
                win.webContents.send('status', `Статус: помилка запуска.`);
                win.webContents.send('sub-status', err.message);
            }
        });

    // Виведення логів гри в консоль
    launcher.on('data', (d) => {
        const line = d.toString('utf8').trim();
        if (line) console.log(`[MC_LOG]: ${line}`);
    });

    launcher.on('close', (code) => {
        if (win && !win.isDestroyed()) {
            win.webContents.send('status', code === 0 ? 'Статус: готовий' : `Гра закрилася (Код: ${code})`);
            win.webContents.send('sub-status', code === 0 ? 'Очікуємо наступного запуску.' : 'Перевірте консоль для діагностики помилки.');
        }
    });
}

module.exports = { launchGame };
