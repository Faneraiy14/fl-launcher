// ============================================
// launcher.js (MCLC + TOMATE LOADERS - ПРАЦЮЄ)
// ============================================

const { Client } = require('minecraft-launcher-core');
const { fabric, forge, neoforge } = require('tomate-loaders');
const path = require('path');
const fs = require('fs');
const https = require('https');
const AdmZip = require('adm-zip');
const crypto = require('crypto');
const { execSync } = require('child_process');

// ============ ДОПОМІЖНІ ФУНКЦІЇ ============

function send(win, status, sub) {
    if (!win || win.isDestroyed()) return;
    try {
        if (status !== undefined) win.webContents.send('status', status);
        if (sub !== undefined) win.webContents.send('sub-status', sub);
    } catch (err) {
        console.error('[LAUNCHER] send error:', err.message);
    }
}

function sendError(win, errorDetails) {
    if (!win || win.isDestroyed()) return;
    try {
        win.webContents.send('launch-error-details', errorDetails);
        win.webContents.send('status', `❌ ПОМИЛКА: ${errorDetails.shortMessage}`);
        win.webContents.send('sub-status', errorDetails.details);
    } catch (err) {
        console.error('[LAUNCHER] sendError error:', err);
    }
}

function formatMB(bytes) {
    return `${(bytes / 1048576).toFixed(1)} MB`;
}

function getAppData() {
    return process.env.APPDATA ||
        (process.platform === 'darwin'
            ? path.join(process.env.HOME, 'Library', 'Application Support')
            : path.join(process.env.HOME, '.config'));
}

function makeOfflineUUID(username) {
    const normalized = username.normalize('NFKC');
    const h = crypto.createHash('md5').update('OfflinePlayer:' + normalized).digest();
    h[6] = (h[6] & 0x0f) | 0x30;
    h[8] = (h[8] & 0x3f) | 0x80;
    return h.toString('hex').replace(/(.{8})(.{4})(.{4})(.{4})(.{12})/, '$1-$2-$3-$4-$5');
}

function getRequiredJavaMajor(mcVersion) {
    const version = String(mcVersion || '').trim();
    
    if (version.startsWith('1.21')) return 21;
    if (version.startsWith('1.20')) return 17;
    if (version.startsWith('1.19')) return 17;
    if (version.startsWith('1.18')) return 17;
    if (version.startsWith('1.17')) return 16;
    
    const match = version.match(/^(\d+)(?:\.(\d+))?/);
    if (!match) return 17;
    const major = parseInt(match[1], 10);
    const minor = parseInt(match[2] || '0', 10);
    const releaseLine = major === 1 ? minor : major;
    
    if (releaseLine >= 21) return 21;
    if (releaseLine >= 17) return 17;
    return 8;
}

async function fetchJavaDownloadUrl(major) {
    const os = process.platform === 'win32' ? 'windows' : (process.platform === 'darwin' ? 'mac' : 'linux');
    const arch = (process.platform === 'darwin' && process.arch === 'arm64') ? 'aarch64' : 'x64';
    const url = `https://api.adoptium.net/v3/assets/latest/${major}/hotspot?architecture=${arch}&image_type=jdk&os=${os}&vendor=eclipse`;
    
    return new Promise((resolve, reject) => {
        https.get(url, { headers: { 'User-Agent': 'fl-launcher/1.6' }, timeout: 30000 }, (res) => {
            let data = '';
            res.on('data', c => data += c);
            res.on('end', () => {
                try {
                    if (!data || data.trim().length === 0) {
                        reject(new Error(`Adoptium: порожня відповідь для Java ${major}`));
                        return;
                    }
                    const json = JSON.parse(data);
                    if (!Array.isArray(json) || !json.length) {
                        reject(new Error(`Adoptium: немає релізів для Java ${major}`));
                        return;
                    }
                    resolve(json[0].binary.package.link);
                } catch (e) {
                    reject(e);
                }
            });
        }).on('error', reject);
    });
}

function downloadFile(url, dest, onProgress) {
    return new Promise((resolve, reject) => {
        const request = https.get(url, { headers: { 'User-Agent': 'fl-launcher/1.6' }, timeout: 60000 }, (res) => {
            if ([301, 302, 303, 307, 308].includes(res.statusCode) && res.headers.location) {
                return downloadFile(res.headers.location, dest, onProgress).then(resolve).catch(reject);
            }
            if (res.statusCode !== 200) {
                return reject(new Error(`HTTP ${res.statusCode}`));
            }
            const total = parseInt(res.headers['content-length'] || '0', 10);
            let downloaded = 0;
            const out = fs.createWriteStream(dest);
            
            res.on('data', chunk => {
                downloaded += chunk.length;
                if (total > 0 && typeof onProgress === 'function') {
                    try {
                        onProgress({ percent: Math.min(100, Math.round(downloaded / total * 100)), downloaded, total });
                    } catch (progressErr) {}
                }
            });
            
            res.pipe(out);
            out.on('finish', () => {
                out.close(() => {
                    if (typeof onProgress === 'function') {
                        try {
                            onProgress({ percent: 100, downloaded: total || downloaded, total: total || downloaded });
                        } catch (progressErr) {}
                    }
                    resolve();
                });
            });
            out.on('error', reject);
        });
        request.on('error', reject);
        request.setTimeout(60000, () => {
            request.destroy();
            reject(new Error('Download timeout'));
        });
    });
}

async function ensureJava(major, javaDir, win) {
    const bin = process.platform === 'win32' ? 'java.exe' : 'java';
    
    if (fs.existsSync(javaDir)) {
        try {
            const entries = fs.readdirSync(javaDir);
            for (const entry of entries) {
                try {
                    const p = path.join(javaDir, entry);
                    const stat = fs.lstatSync(p);
                    if (stat.isDirectory()) {
                        const exe = path.join(p, 'bin', bin);
                        if (fs.existsSync(exe)) {
                            return exe;
                        }
                    }
                } catch (e) {}
            }
        } catch (e) {}
    }
    
    send(win, `Встановлення Java ${major}...`, 'Запит до Adoptium API...');
    
    let dlUrl;
    try {
        dlUrl = await fetchJavaDownloadUrl(major);
    } catch (err) {
        throw new Error(`Не вдалося отримати посилання на Java ${major}: ${err.message}`);
    }
    
    send(win, `Завантаження Java ${major}... 0%`, 'Це може зайняти кілька хвилин...');
    fs.mkdirSync(javaDir, { recursive: true });
    
    const isWin = process.platform === 'win32';
    const ext = isWin ? 'zip' : 'tar.gz';
    const archive = path.join(javaDir, `temp_java${major}.${ext}`);
    
    try {
        await downloadFile(dlUrl, archive, ({ percent, downloaded, total }) => {
            const detail = total > 0 ? `${formatMB(downloaded)} / ${formatMB(total)}` : `${formatMB(downloaded)}`;
            send(win, `Завантаження Java ${major}... ${percent}%`, detail);
        });
    } catch (err) {
        try { fs.unlinkSync(archive); } catch (e) {}
        throw new Error(`Не вдалося завантажити Java ${major}: ${err.message}`);
    }
    
    send(win, `Встановлення Java ${major}...`, 'Розпакування архіву...');
    
    try {
        if (isWin) {
            const zip = new AdmZip(archive);
            zip.extractAllTo(javaDir, true);
        } else {
            try {
                execSync(`tar -xzf "${archive}" -C "${javaDir}"`, { stdio: 'pipe', timeout: 120000 });
            } catch (tarErr) {
                throw new Error(`Помилка розпакування tar.gz: ${tarErr.message}`);
            }
        }
        try { fs.unlinkSync(archive); } catch (e) {}
    } catch (err) {
        try { fs.unlinkSync(archive); } catch (e) {}
        throw new Error(`Помилка розпакування Java ${major}: ${err.message}`);
    }
    
    try {
        const entries = fs.readdirSync(javaDir);
        for (const entry of entries) {
            try {
                const p = path.join(javaDir, entry);
                const stat = fs.lstatSync(p);
                if (stat.isDirectory()) {
                    const exe = path.join(p, 'bin', bin);
                    if (fs.existsSync(exe)) {
                        return exe;
                    }
                }
            } catch (e) {}
        }
    } catch (err) {
        throw new Error(`Java ${major} не знайдено після встановлення: ${err.message}`);
    }
    
    throw new Error(`java не знайдено після встановлення Java ${major}`);
}

// ============ ЗАВАНТАЖЕННЯ FABRIC API ============

async function downloadFabricApi(rootPath, mcVersion, win) {
    const modsDir = path.join(rootPath, 'mods');
    if (!fs.existsSync(modsDir)) fs.mkdirSync(modsDir, { recursive: true });
    
    const fabricApiUrls = {
        '1.21.10': 'https://mediafilez.forgecdn.net/files/7057/902/fabric-api-0.138.0+1.21.10.jar',
        '1.21.4': 'https://mediafilez.forgecdn.net/files/6512/775/fabric-api-0.138.0+1.21.4.jar',
        '1.20.4': 'https://mediafilez.forgecdn.net/files/5580/158/fabric-api-0.96.1+1.20.4.jar',
        '1.20.1': 'https://mediafilez.forgecdn.net/files/5421/575/fabric-api-0.88.1+1.20.1.jar',
        '1.19.4': 'https://mediafilez.forgecdn.net/files/5360/965/fabric-api-0.83.1+1.19.4.jar',
        '1.18.2': 'https://mediafilez.forgecdn.net/files/4707/100/fabric-api-0.60.0+1.18.2.jar',
        '1.16.5': 'https://mediafilez.forgecdn.net/files/4225/891/fabric-api-0.42.0+1.16.5.jar'
    };
    
    const url = fabricApiUrls[mcVersion] || fabricApiUrls['1.21.10'];
    const filePath = path.join(modsDir, 'fabric-api.jar');
    
    if (fs.existsSync(filePath)) {
        return true;
    }
    
    send(win, 'Завантаження Fabric API...', '');
    
    try {
        await downloadFile(url, filePath, ({ percent }) => {
            send(win, `Fabric API... ${percent}%`, '');
        });
        console.log('[LAUNCHER] Fabric API завантажено');
        return true;
    } catch (err) {
        console.error('[LAUNCHER] Помилка завантаження Fabric API:', err);
        return false;
    }
}

// ============ ОСНОВНА ФУНКЦІЯ ЗАПУСКУ ============

async function launchGame(inst, win) {
    try {
        const loaderType = (inst.loader || 'Vanilla').toLowerCase();
        const mcVersion = (typeof inst.version === 'object' ? inst.version.id : inst.version || '1.21.4').trim();
        const rootPath = inst.customPath ? inst.customPath : path.join(getAppData(), 'fl-launcher', 'instances', inst.name);
        const username = inst.username || 'Player';

        console.log(`[LAUNCHER] Запуск: ${mcVersion} з ${loaderType}`);
        send(win, `Підготовка ${loaderType}...`, `Версія ${mcVersion}`);

        fs.mkdirSync(path.join(rootPath, 'mods'), { recursive: true });

        const logFile = path.join(rootPath, 'latest-mc.log');
        fs.writeFileSync(logFile, `--- FL LAUNCHER SESSION: ${new Date().toISOString()} ---\n`, 'utf8');
        fs.appendFileSync(logFile, `[INFO] Version: ${mcVersion}\n`);
        fs.appendFileSync(logFile, `[INFO] Loader: ${loaderType}\n`);
        fs.appendFileSync(logFile, `[INFO] RAM: ${inst.ram} MB\n`);

        const javaMajor = getRequiredJavaMajor(mcVersion);
        const javaDir = path.join(getAppData(), 'fl-launcher', 'runtime', `java${javaMajor}`);
        let javaPath = await ensureJava(javaMajor, javaDir, win);
        console.log(`[LAUNCHER] Java: ${javaPath}`);
        fs.appendFileSync(logFile, `[INFO] Java path: ${javaPath}\n`);

        let launchConfig;
        let loaderDisplayName = 'Vanilla';

        // ============ FABRIC (через tomate-loaders) ============
        if (loaderType === 'fabric') {
            loaderDisplayName = 'Fabric';
            send(win, "Fabric", `Отримання конфігурації для ${mcVersion}...`);
            
            try {
                // tomate-loaders сам завантажує та встановлює Fabric
                launchConfig = await fabric.getMCLCLaunchConfig({
                    gameVersion: mcVersion,
                    rootPath: rootPath,
                });
                console.log('[LAUNCHER] Fabric конфігурацію отримано');
                fs.appendFileSync(logFile, `[INFO] Fabric config: ${JSON.stringify(launchConfig)}\n`);
                
                // Завантажуємо Fabric API
                await downloadFabricApi(rootPath, mcVersion, win);
                
                send(win, "Fabric готовий", `Версія ${launchConfig.version?.number || mcVersion}`);
            } catch (err) {
                console.error('[LAUNCHER] Помилка Fabric:', err);
                sendError(win, {
                    shortMessage: 'Помилка Fabric',
                    details: err.message || 'Не вдалося отримати конфігурацію Fabric'
                });
                return null;
            }
        }
        // ============ FORGE (через tomate-loaders) ============
        else if (loaderType === 'forge') {
            loaderDisplayName = 'Forge';
            send(win, "Forge", `Отримання конфігурації для ${mcVersion}...`);
            
            try {
                launchConfig = await forge.getMCLCLaunchConfig({
                    gameVersion: mcVersion,
                    rootPath: rootPath,
                });
                console.log('[LAUNCHER] Forge конфігурацію отримано');
                fs.appendFileSync(logFile, `[INFO] Forge config: ${JSON.stringify(launchConfig)}\n`);
                send(win, "Forge готовий", `Версія ${launchConfig.version?.number || mcVersion}`);
            } catch (err) {
                console.error('[LAUNCHER] Помилка Forge:', err);
                sendError(win, {
                    shortMessage: 'Помилка Forge',
                    details: err.message || 'Не вдалося отримати конфігурацію Forge'
                });
                return null;
            }
        }
        // ============ NEOFORGE (через tomate-loaders) ============
        else if (loaderType === 'neoforge') {
            loaderDisplayName = 'NeoForge';
            send(win, "NeoForge", `Отримання конфігурації для ${mcVersion}...`);
            
            try {
                launchConfig = await neoforge.getMCLCLaunchConfig({
                    gameVersion: mcVersion,
                    rootPath: rootPath,
                });
                console.log('[LAUNCHER] NeoForge конфігурацію отримано');
                fs.appendFileSync(logFile, `[INFO] NeoForge config: ${JSON.stringify(launchConfig)}\n`);
                send(win, "NeoForge готовий", `Версія ${launchConfig.version?.number || mcVersion}`);
            } catch (err) {
                console.error('[LAUNCHER] Помилка NeoForge:', err);
                sendError(win, {
                    shortMessage: 'Помилка NeoForge',
                    details: err.message || 'Не вдалося отримати конфігурацію NeoForge'
                });
                return null;
            }
        }
        // ============ VANILLA ============
        else {
            launchConfig = {
                version: { number: mcVersion, type: 'release' }
            };
        }

        // ============ ЗАПУСК ЧЕРЕЗ MCLC ============
        const opts = {
            authorization: {
                access_token: 'offline',
                client_token: 'offline',
                uuid: makeOfflineUUID(username),
                user_properties: '{}',
                username: username,
                name: username
            },
            root: rootPath,
            version: launchConfig.version,
            memory: {
                max: `${inst.ram || 4096}M`,
                min: '1024M'
            },
            javaPath: javaPath,
            overrides: {
                detached: false
            }
        };

        console.log('[LAUNCHER] Запуск з версією:', JSON.stringify(launchConfig.version));
        send(win, `Запуск ${loaderDisplayName}...`, 'Будь ласка, зачекайте');

        const launcher = new Client();

        launcher.on('progress', ({ task, total }) => {
            if (total) {
                const percent = Math.round(task / total * 100);
                send(win, `Завантаження файлів (${percent}%)...`);
            }
        });

        launcher.on('download-status', ({ current, total }) => {
            const percent = total ? Math.min(100, Math.round(current / total * 100)) : 0;
            send(win, `Завантаження... ${percent}%`, `[${current}/${total}]`);
        });

        launcher.on('arguments', args => {
            const argsStr = args.join(' ');
            console.log('[LAUNCHER] Аргументи:', argsStr.substring(0, 300));
            try { fs.appendFileSync(logFile, `[ARGS] ${argsStr}\n`, 'utf8'); } catch(e) {}
        });

        launcher.on('data', chunk => {
            const line = chunk.toString('utf8').trim();
            if (line) {
                console.log('[MINECRAFT]', line.substring(0, 200));
                try { fs.appendFileSync(logFile, line + '\n', 'utf8'); } catch(e) {}
            }
        });

        launcher.on('close', (code) => {
            console.log(`[LAUNCHER] Гра закрита з кодом: ${code}`);
            try { fs.appendFileSync(logFile, `\n--- CLOSED: code ${code} ---\n`, 'utf8'); } catch(e) {}
            if (win && !win.isDestroyed()) {
                win.show();
                send(win, code === 0 ? 'Статус: готовий' : `Гра закрилася (Код: ${code})`);
            }
        });

        launcher.on('error', (error) => {
            console.error('[LAUNCHER] Помилка:', error);
            sendError(win, {
                shortMessage: 'Помилка запуску',
                details: error.message || 'Невідома помилка'
            });
            if (win && !win.isDestroyed()) win.show();
        });

        const gameProcess = await launcher.launch(opts);

        if (!gameProcess) {
            sendError(win, {
                shortMessage: `${loaderDisplayName} не запустився`,
                details: 'Не вдалося створити процес. Перевірте логи.'
            });
            return null;
        }

        if (win && !win.isDestroyed()) win.hide();
        send(win, `${loaderDisplayName} запущено!`, 'Гра працює');

        return gameProcess;

    } catch (err) {
        console.error('[LAUNCHER] Критична помилка:', err);
        sendError(win, {
            shortMessage: 'Критична помилка',
            details: err.message
        });
        if (win && !win.isDestroyed()) win.show();
        return null;
    }
}

module.exports = { launchGame };