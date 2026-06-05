const https = require('https');

async function getVersions() {
    return new Promise((resolve) => {
        console.log("[DOWNLOADER_LOG]: Отримання маніфесту версій з piston-meta.mojang.com...");
        
        const options = {
            hostname: 'piston-meta.mojang.com', 
            path: '/mc/game/version_manifest_v2.json', 
            method: 'GET',
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
                'Accept': 'application/json'
            },
            timeout: 10000 
        };

        const req = https.request(options, (res) => {
            res.setEncoding('utf8');
            let rawData = '';

            if (res.statusCode !== 200) {
                console.error(`[DOWNLOADER_ERR]: Сервер повернув код помилки: ${res.statusCode}`);
                resolve([]);
                return;
            }

            res.on('data', (chunk) => { rawData += chunk; });
            res.on('end', () => {
                try {
                    const parsed = JSON.parse(rawData);
                    if (parsed && Array.isArray(parsed.versions)) {
                        // ФІЛЬТРАЦІЯ: Прибираємо доісторичні альфа/бета версії, залишаємо лише нормальні релізи та снапшоти
                        const validVersions = parsed.versions.filter(v => {
                            // Прибираємо старі версії типу "b1.7.3" або "a1.2.6"
                            return !v.id.startsWith('a') && !v.id.startsWith('b');
                        });

                        // 1. Розділяємо на чисті стабільні релізи та тестові снапшоти
                        const releases = validVersions.filter(v => v.type === 'release');
                        const snapshots = validVersions.filter(v => v.type === 'snapshot');
                        
                        // 2. Безпечне сортування груп за датою (від нових до старих)
                        releases.sort((a, b) => new Date(b.releaseTime || 0) - new Date(a.releaseTime || 0));
                        snapshots.sort((a, b) => new Date(b.releaseTime || 0) - new Date(a.releaseTime || 0));
                        
                        // 3. З'єднуємо: спочатку йдуть ВСІ стабільні релізи, потім ВСІ снапшоти
                        const finalSorted = [...releases, ...snapshots];
                        
                        console.log(`[DOWNLOADER_SUCCESS]: Успішно відсортовано: ${releases.length} релізів та ${snapshots.length} снапшотів.`);
                        resolve(finalSorted);
                    } else {
                        console.error("[DOWNLOADER_ERR]: Невідома структура маніфесту.");
                        resolve([]);
                    }
                } catch (err) {
                    console.error("[DOWNLOADER_JSON_ERR]: Помилка парсингу JSON:", err.message);
                    resolve([]);
                }
            });
        });

        req.on('error', (err) => {
            console.error("[DOWNLOADER_NETWORK_ERR]: Помилка мережі:", err.message);
            resolve([]);
        });

        req.on('timeout', () => {
            console.error("[DOWNLOADER_TIMEOUT]: Час очікування відповіді вичерпано.");
            req.destroy();
            resolve([]);
        });

        req.end();
    });
}

module.exports = { getVersions };
