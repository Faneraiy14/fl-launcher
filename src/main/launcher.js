// ЧАСТИНА 1: Конфігурація та завантаження Java рантайму
const JAVA_LINKS = {
    8: "хттпс://г-и-т-х-у-б.сом/adoptium/temurin8-binaries/releases/download/jdk8u412-b08/OpenJDK8U-jdk_x64_windows_hotspot_8u412b08.zip"
        .replace("хттпс://г-и-т-х-у-б.сом", "https://github.com"),
    17: "хттпс://г-и-т-х-у-б.сом/adoptium/temurin17-binaries/releases/download/jdk-17.0.11%2B9/OpenJDK17U-jdk_x64_windows_hotspot_17.0.11_9.zip"
        .replace("хттпс://г-и-т-х-у-б.сом", "https://github.com"),
    21: "хттпс://г-и-т-х-у-б.сом/adoptium/temurin21-binaries/releases/download/jdk-21.0.3%2B9/OpenJDK21U-jdk_x64_windows_hotspot_21.0.3_9.zip"
        .replace("хттпс://г-и-т-х-у-б.сом", "https://github.com"),
    25: "хттпс://г-и-т-х-у-б.сом/adoptium/temurin25-binaries/releases/download/jdk-25.0.3%2B9/OpenJDK25U-jdk_x64_windows_hotspot_25.0.3_9.zip"
        .replace("хттпс://г-и-т-х-у-б.сом", "https://github.com")
};

const { app } = require('electron');
const { Client } = require('minecraft-launcher-core');
const path = require('path');
const fs = require('fs');
const https = require('https');
const AdmZip = require('adm-zip');
const axios = require('axios');
const crypto = require('crypto');

const launcher = new Client();

function generateOfflineUUID(username) {
    let hash = crypto.createHash('md5').update("OfflinePlayer:" + username).digest();
    hash[6] = (hash[6] & 0x0f) | 0x30; 
    hash[8] = (hash[8] & 0x3f) | 0x80; 
    return hash.toString('hex').replace(/(.{8})(.{4})(.{4})(.{4})(.{12})/, '$1-$2-$3-$4-$5');
}

function downloadUrlWithRedirects(url, filePath, win, version) {
    return new Promise((resolve, reject) => {
        https.get(url, (res) => {
            if ([301, 302, 303, 307, 308].includes(res.statusCode) && res.headers.location) {
                return downloadUrlWithRedirects(res.headers.location, filePath, win, version).then(resolve).catch(reject);
            }
            if (res.statusCode !== 200) {
                return reject(new Error(`Сервер повернув код помилки: ${res.statusCode}`));
            }
            const fileStream = fs.createWriteStream(filePath);
            res.pipe(fileStream);
            fileStream.on('finish', () => {
                fileStream.close();
                resolve();
            });
        }).on('error', (err) => reject(err));
    });
}

function downloadRequiredJava(version, targetPath, win) {
    return new Promise(async (resolve, reject) => {
        const binaryName = process.platform === 'win32' ? 'java.exe' : 'java';
        if (fs.existsSync(targetPath)) {
            const files = fs.readdirSync(targetPath);
            const subDir = files.find(f => fs.lstatSync(path.join(targetPath, f)).isDirectory());
            if (subDir) {
                const checkedPath = path.join(targetPath, subDir, 'bin', binaryName);
                if (fs.existsSync(checkedPath)) return resolve(checkedPath);
            }
        }
        if (win && !win.isDestroyed()) {
            win.webContents.send('status', `Завантаження модулів (Java ${version})...`);
            win.webContents.send('sub-status', 'Скачування оригінального бінарного архіву...');
        }
        fs.mkdirSync(targetPath, { recursive: true });
        const zipPath = path.join(targetPath, `java${version}.zip`);
        const url = JAVA_LINKS[version];
        if (!url) return reject(new Error(`Не знайдено конфігурації посилання для Java ${version}`));
        try {
            await downloadUrlWithRedirects(url, zipPath, win, version);
            if (win && !win.isDestroyed()) win.webContents.send('sub-status', `Розпакування компонентів Java ${version}...`);
            const zip = new AdmZip(zipPath);
            zip.extractAllTo(targetPath, true);
            fs.unlinkSync(zipPath); 
            const dirs = fs.readdirSync(targetPath);
            const subDir = dirs.find(d => fs.lstatSync(path.join(targetPath, d)).isDirectory());
            resolve(path.join(targetPath, subDir, 'bin', binaryName));
        } catch (e) {
            if (fs.existsSync(zipPath)) fs.unlinkSync(zipPath);
            reject(new Error(`Помилка інсталяції Java: ${e.message}`));
        }
    });
}
// ЧАСТЬ 2: Функция запуска игры launchGame и экспорт модуля
async function launchGame(inst, win) {
    try {
        // Логирование для проверки структуры объекта конфигурации
        console.log("=== ДІАГНОСТИКА ОБ'ЄКТА INST ==="); 
        console.dir(inst, { depth: null });

        const appDataRoaming = process.env.APPDATA || (process.platform === 'darwin' ? path.join(process.env.HOME, 'Library', 'Application Support') : path.join(process.env.HOME, '.config'));
        const rootPath = inst.customPath && fs.existsSync(inst.customPath) ? inst.customPath : path.join(appDataRoaming, 'fl-launcher', 'instances', inst.name);
        
        const modsPath = path.join(rootPath, 'mods');
        if (!fs.existsSync(modsPath)) fs.mkdirSync(modsPath, { recursive: true });

        const logFilePath = path.join(rootPath, 'latest-mc.log');
        fs.writeFileSync(logFilePath, `--- FL LAUNCHER LOG SESSION: ${new Date().toISOString()} ---\n`, 'utf8');

        let rawVersion = (typeof inst.version === 'object' ? inst.version.id : inst.version) || "1.21.4";
        
        let cleanVersionArray = rawVersion.trim().split(' ');
        let cleanVersionNumber = cleanVersionArray[0]; // Исправлено: теперь берется строка версии

        if (!cleanVersionNumber) {
            if (win && !win.isDestroyed()) {
                win.webContents.send('status', 'Помилка конфігурації.');
                win.webContents.send('sub-status', 'Не вдалося розпізнати версію!');
            }
            return;
        }

        let major = 21; 

        if (cleanVersionNumber.includes('w') || cleanVersionNumber.startsWith('26') || cleanVersionNumber.startsWith('25') || cleanVersionNumber.startsWith('1.22')) {
            major = 25; 
        } else {
            const versionFloat = parseFloat(cleanVersionNumber.split('.').slice(0, 2).join('.'));
            if (versionFloat < 1.17) major = 8;
            else if (versionFloat >= 1.17 && versionFloat <= 1.20) major = 17;
            else if (versionFloat >= 1.21) major = 21; 
        }

        const runtimeDir = path.join(appDataRoaming, 'fl-launcher', 'runtime', `java${major}`);
        const javaPath = await downloadRequiredJava(major, runtimeDir, win);

        if (!fs.existsSync(javaPath)) {
            if (win && !win.isDestroyed()) win.webContents.send('status', 'Статус: помилка, Java не знайдено!');
            return;
        }

        if (win && !win.isDestroyed()) {
            win.webContents.send('status', 'Завантаження файлів... 0%');
            win.webContents.send('sub-status', 'Аналіз клієнта гри...');
        }

        let versionOptions = { number: cleanVersionNumber, type: "release" };
        if (cleanVersionNumber.includes('w') || cleanVersionNumber.includes('pre') || cleanVersionNumber.includes('rc')) {
            versionOptions.type = "snapshot";
        }

        if (inst.loader === "Fabric") {
            if (win && !win.isDestroyed()) win.webContents.send('sub-status', 'Синхронізація пакетів Fabric...');
            try {
                const metaUrl = `https://fabricmc.net{cleanVersionNumber}`;
                const res = await axios.get(metaUrl);
                if (res.data && res.data.length > 0) {
                    const stableLoader = res.data.find(item => item.loader.stable === true) || res.data;
                    const loaderVersion = stableLoader.loader.version;
                    versionOptions.custom = `fabric-loader-${loaderVersion}-${cleanVersionNumber}`;
                }
            } catch (err) { 
                console.error("Помилка отримання Fabric метаданих:", err.message); 
                if (win && !win.isDestroyed()) {
                    win.webContents.send('status', 'Помилка Fabric');
                    win.webContents.send('sub-status', 'Не вдалося завантажити метадані версії.');
                }
                return;
            }
        }

        launcher.on('progress', (e) => {
            if (!win || win.isDestroyed()) return;
            if (!e.total || e.total === 0) return;
            const percent = ((e.task / e.total) * 100).toFixed(0);
            win.webContents.send('status', `Завантаження файлів клієнта (${percent}%)...`);
        });

        launcher.on('download-status', (e) => {
            if (!win || win.isDestroyed()) return;
            win.webContents.send('sub-status', `Скачування компонентів гри: [${e.current}/${e.total}]`);
        });

        const playerUsername = inst.username || "Player";
        const playerUUID = generateOfflineUUID(playerUsername);

        let opts = {
            authorization: { 
                access_token: "any_token", 
                client_token: "any_token", 
                uuid: playerUUID, 
                user_properties: "{}", 
                username: playerUsername 
            },
            root: rootPath, 
            version: versionOptions,
            memory: { max: `${inst.ram || 4096}M`, min: "1024M" }, 
            javaPath: javaPath,
            overrides: { detached: false }
        };

        let hasHiddenWindow = false;

        launcher.launch(opts)
            .then(() => {
                if (win && !win.isDestroyed()) {
                    win.webContents.send('status', 'Статус: ініціалізація двигуна...');
                    win.webContents.send('sub-status', 'Очікуйте появу вікна гри...');
                }
            })
            .catch((err) => {
                fs.appendFileSync(logFilePath, `[LAUNCHER_ERROR]: ${err.message}\n`, 'utf8');
                if (win && !win.isDestroyed()) {
                    win.show();
                    win.webContents.send('status', `Статус: помилка запуска.`);
                    win.webContents.send('sub-status', err.message);
                }
            });

        launcher.on('data', (d) => {
            const line = d.toString('utf8').trim();
            if (line) {
                fs.appendFileSync(logFilePath, `${line}\n`, 'utf8');
                if (!hasHiddenWindow && win && !win.isDestroyed()) {
                    hasHiddenWindow = true;
                    win.webContents.send('status', 'Статус: гра запущена!');
                    win.webContents.send('sub-status', 'Приємної гри!');
                    setTimeout(() => { if (win && !win.isDestroyed()) win.hide(); }, 1500);
                }
            }
        });

        launcher.on('close', (code) => {
            fs.appendFileSync(logFilePath, `\n--- GAME CLOSED WITH CODE: ${code} ---\n`, 'utf8');
            if (win && !win.isDestroyed()) {
                win.show(); 
                win.webContents.send('status', code === 0 ? 'Статус: готовий' : `Гра закрилася (Код: ${code})`);
                win.webContents.send('sub-status', code === 0 ? 'Очікуємо наступного запуску.' : 'Перевірте логи гри.');
            }
        });

    } catch (globalErr) {
        console.error(globalErr);
        if (win && !win.isDestroyed()) {
            win.webContents.send('status', 'Критична помилка');
            win.webContents.send('sub-status', globalErr.message);
        }
    }
}

module.exports = { launchGame };
