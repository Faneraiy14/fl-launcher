// ============================================
// downloader.js (виправлено)
// ============================================
const https = require('https');

const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36';

async function getVersions() {
    return new Promise((resolve) => {
        console.log("[DOWNLOADER_LOG]: Отримання маніфесту версій...");
        
        const options = {
            hostname: 'piston-meta.mojang.com',
            path: '/mc/game/version_manifest_v2.json',
            method: 'GET',
            headers: { 
                'User-Agent': USER_AGENT, 
                'Accept': 'application/json' 
            },
            timeout: 15000
        };
        
        const req = https.request(options, (res) => {
            if (res.statusCode !== 200) {
                console.error(`[DOWNLOADER_ERR]: HTTP ${res.statusCode}`);
                resolve([]);
                return;
            }
            
            res.setEncoding('utf8');
            let rawData = '';
            
            res.on('data', (chunk) => { rawData += chunk; });
            res.on('end', () => {
                try {
                    if (!rawData || rawData.trim().length === 0) {
                        console.error("[DOWNLOADER_ERR]: Порожня відповідь");
                        resolve([]);
                        return;
                    }
                    
                    const parsed = JSON.parse(rawData);
                    if (parsed && Array.isArray(parsed.versions)) {
                        const validVersions = parsed.versions.filter(v => v.id && !v.id.startsWith('a') && !v.id.startsWith('b'));
                        const releases = validVersions.filter(v => v.type === 'release');
                        const snapshots = validVersions.filter(v => v.type === 'snapshot');
                        
                        releases.sort((a, b) => new Date(b.releaseTime || 0) - new Date(a.releaseTime || 0));
                        snapshots.sort((a, b) => new Date(b.releaseTime || 0) - new Date(a.releaseTime || 0));
                        const finalSorted = [...releases, ...snapshots];
                        
                        console.log(`[DOWNLOADER_SUCCESS]: ${releases.length} релізів, ${snapshots.length} снапшотів.`);
                        resolve(finalSorted);
                    } else {
                        console.error("[DOWNLOADER_ERR]: Невідома структура відповіді");
                        resolve([]);
                    }
                } catch (err) {
                    console.error("[DOWNLOADER_JSON_ERR]:", err.message);
                    resolve([]);
                }
            });
        });
        
        req.on('error', (err) => {
            console.error("[DOWNLOADER_NETWORK_ERR]:", err.message);
            resolve([]);
        });
        
        req.on('timeout', () => {
            console.error("[DOWNLOADER_TIMEOUT]");
            req.destroy();
            resolve([]);
        });
        
        req.end();
    });
}

module.exports = { getVersions };