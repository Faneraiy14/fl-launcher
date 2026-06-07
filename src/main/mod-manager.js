// ============================================
// mod-manager.js (виправлено)
// ============================================
const fs = require('fs');
const path = require('path');
const axios = require('axios');

const appData = process.env.APPDATA || (process.platform === 'darwin' ? path.join(process.env.HOME, 'Library', 'Application Support') : path.join(process.env.HOME, '.config'));
const instancesPath = path.join(appData, 'fl-launcher', 'instances');
const MODRINTH = 'https://api.modrinth.com/v2';
const HEADERS = { 'User-Agent': 'fl-launcher/1.5 (github.com/Faneraiy14/fl-launcher)' };
const TIMEOUT_MS = 30000;

function getModsDir(instance) {
    if (!instance) {
        throw new Error('Instance is required');
    }
    const instPath = instance.customPath ? instance.customPath : path.join(instancesPath, instance.name || instance);
    return path.join(instPath, 'mods');
}

function ensureModsDir(instance) {
    const modsDir = getModsDir(instance);
    if (!fs.existsSync(modsDir)) {
        fs.mkdirSync(modsDir, { recursive: true });
    }
    return modsDir;
}

async function searchMods(query, limit = 20) {
    if (!query || typeof query !== 'string' || query.trim().length === 0) {
        return [];
    }
    
    try {
        const response = await axios.get(`${MODRINTH}/search`, { 
            params: { 
                query: query.trim(), 
                limit: Math.min(limit, 50), 
                facets: '["project_type:mod"]' 
            }, 
            headers: HEADERS, 
            timeout: TIMEOUT_MS 
        });
        
        if (response.data && Array.isArray(response.data.hits)) {
            return response.data.hits.map(h => ({ 
                id: h.project_id, 
                name: h.title || 'Без назви', 
                description: (h.description || '').substring(0, 200), 
                author: h.author || 'Невідомий', 
                downloads: h.downloads || 0 
            }));
        }
        return [];
    } catch (err) {
        console.error('[MOD_MANAGER] searchMods:', err.message);
        return [];
    }
}

async function getModVersions(projectId, loader, gameVersion) {
    if (!projectId) return [];
    
    try {
        const loaderNorm = loader?.toLowerCase();
        if (!loaderNorm || loaderNorm === 'vanilla') {
            return [];
        }
        
        const params = { 
            loaders: JSON.stringify([loaderNorm]), 
            game_versions: JSON.stringify([gameVersion]) 
        };
        
        const response = await axios.get(`${MODRINTH}/project/${projectId}/version`, { 
            params, 
            headers: HEADERS, 
            timeout: TIMEOUT_MS 
        });
        
        if (response.data && Array.isArray(response.data)) {
            return response.data.map(v => ({ 
                id: v.id, 
                versionNumber: v.version_number, 
                name: v.name 
            }));
        }
        return [];
    } catch (err) {
        console.error('[MOD_MANAGER] getModVersions:', err.message);
        return [];
    }
}

async function downloadMod(projectId, versionId, instance) {
    if (!projectId || !versionId || !instance) {
        return { success: false, error: 'Missing required parameters' };
    }
    
    try {
        const response = await axios.get(`${MODRINTH}/version/${versionId}`, { 
            headers: HEADERS, 
            timeout: TIMEOUT_MS 
        });
        
        const file = response.data.files?.find(f => f.primary) || response.data.files?.[0];
        if (!file) {
            throw new Error('Файл мода не знайдено');
        }
        
        const modsDir = ensureModsDir(instance);
        const destPath = path.join(modsDir, file.filename);
        
        const fileResponse = await axios({ 
            method: 'GET', 
            url: file.url, 
            responseType: 'stream', 
            headers: HEADERS, 
            timeout: 60000 
        });
        
        const writer = fs.createWriteStream(destPath);
        fileResponse.data.pipe(writer);
        
        return new Promise((resolve) => {
            writer.on('finish', () => {
                writer.close();
                resolve({ success: true, path: destPath, name: file.filename });
            });
            writer.on('error', (err) => {
                writer.close();
                resolve({ success: false, error: err.message });
            });
        });
    } catch (err) {
        console.error('[MOD_MANAGER] downloadMod:', err.message);
        return { success: false, error: err.message };
    }
}

function getInstalledMods(instance) {
    if (!instance) return [];
    
    try {
        const modsDir = getModsDir(instance);
        if (!fs.existsSync(modsDir)) return [];
        
        const files = fs.readdirSync(modsDir);
        const mods = [];
        
        for (const file of files) {
            if (file.endsWith('.jar')) {
                const filePath = path.join(modsDir, file);
                try {
                    const stats = fs.statSync(filePath);
                    mods.push({ 
                        name: file, 
                        path: filePath, 
                        size: stats.size, 
                        sizeMB: (stats.size / 1048576).toFixed(2) 
                    });
                } catch (statErr) {
                    console.error('[MOD_MANAGER] getInstalledMods stat error:', statErr.message);
                }
            }
        }
        return mods;
    } catch (err) {
        console.error('[MOD_MANAGER] getInstalledMods:', err.message);
        return [];
    }
}

function deleteMod(instance, modName) {
    if (!instance || !modName) return false;
    
    const safeName = path.basename(modName || '');
    if (!safeName || !safeName.toLowerCase().endsWith('.jar')) {
        return false;
    }
    
    const modPath = path.join(getModsDir(instance), safeName);
    if (!fs.existsSync(modPath)) return false;
    
    try {
        fs.unlinkSync(modPath);
        return true;
    } catch (err) {
        console.error('[MOD_MANAGER] deleteMod:', err.message);
        return false;
    }
}

function installLocalMod(instance, filePath) {
    if (!instance || !filePath) {
        return { success: false, error: 'Missing required parameters' };
    }
    
    try {
        if (path.extname(filePath).toLowerCase() !== '.jar') {
            return { success: false, error: 'Оберіть JAR файл мода' };
        }
        
        const modsDir = ensureModsDir(instance);
        const fileName = path.basename(filePath);
        const destPath = path.join(modsDir, fileName);
        
        fs.copyFileSync(filePath, destPath);
        return { success: true, name: fileName };
    } catch (err) {
        console.error('[MOD_MANAGER] installLocalMod:', err.message);
        return { success: false, error: err.message };
    }
}

module.exports = { 
    searchMods, 
    getModVersions, 
    downloadMod, 
    getInstalledMods, 
    deleteMod, 
    installLocalMod 
};