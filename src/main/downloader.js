const https = require('https');

async function getVersions() {
    return new Promise((resolve) => {
        const options = {
            hostname: 'piston-meta.mojang.com', // Новий правильний сервер Mojang
            path: '/mc/game/version_manifest_v2.json', // Новий шлях до версій v2
            method: 'GET',
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Accept': 'application/json; charset=utf-8'
            },
            timeout: 10000
        };

        const req = https.request(options, (res) => {
            // Примусово змушуємо Node зчитувати біти як чистий UTF-8 текст
            res.setEncoding('utf8');
            let rawData = '';

            if (res.statusCode !== 200) {
                console.error(`[DOWNLOADER_ERR]: Статус сервера Mojang: ${res.statusCode}`);
                resolve([]);
                return;
            }

            res.on('data', (chunk) => { rawData += chunk; });
            
            res.on('end', () => {
                try {
                    const parsed = JSON.parse(rawData);
                    if (parsed && Array.isArray(parsed.versions)) {
                        console.log(`[DOWNLOADER]: Динамічно викачано з інтернету ${parsed.versions.length} версій.`);
                        resolve(parsed.versions);
                    } else {
                        resolve([]);
                    }
                } catch (err) {
                    console.error("[DOWNLOADER_JSON_ERR]: Помилка парсингу маніфесту:", err.message);
                    resolve([]);
                }
            });
        });

        req.on('error', (err) => {
            console.error("[DOWNLOADER_NETWORK_ERR]: Помилка мережі Windows:", err.message);
            resolve([]);
        });

        req.on('timeout', () => {
            req.destroy();
            console.error("[DOWNLOADER_TIMEOUT]: Перевищено ліміт часу очікування.");
            resolve([]);
        });

        req.end();
    });
}

module.exports = { getVersions };