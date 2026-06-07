// ============================================
// skin-manager.js (виправлено)
// ============================================
const fs = require('fs');
const path = require('path');

const appDataRoaming = process.env.APPDATA || (process.platform === 'darwin' ? path.join(process.env.HOME, 'Library', 'Application Support') : path.join(process.env.HOME, '.config'));
const skinsFolder = path.join(appDataRoaming, 'fl-launcher', 'skins');
const MAX_SKIN_SIZE_BYTES = 1024 * 1024; // 1MB

const publicSkins = [
    { id: 'steve', name: 'Steve', imageUrl: 'https://minotar.net/helm/steve/100.png' },
    { id: 'alex', name: 'Alex', imageUrl: 'https://minotar.net/helm/alex/100.png' },
    { id: 'herobrine', name: 'Herobrine', imageUrl: 'https://minotar.net/helm/Herobrine/100.png' },
    { id: 'notch', name: 'Notch', imageUrl: 'https://minotar.net/helm/Notch/100.png' },
    { id: 'dream', name: 'Dream', imageUrl: 'https://minotar.net/helm/Dream/100.png' },
    { id: 'technoblade', name: 'Technoblade', imageUrl: 'https://minotar.net/helm/Technoblade/100.png' }
];

function ensureSkinsFolder() {
    if (!fs.existsSync(skinsFolder)) {
        fs.mkdirSync(skinsFolder, { recursive: true });
    }
}

function getAllSkins() {
    ensureSkinsFolder();
    const skins = [...publicSkins];
    
    try {
        const files = fs.readdirSync(skinsFolder);
        for (const file of files) {
            if (file.endsWith('.png')) {
                const skinId = file.replace('.png', '');
                if (!skins.some(s => s.id === skinId)) {
                    const skinPath = path.join(skinsFolder, file);
                    const stats = fs.statSync(skinPath);
                    
                    if (stats.size > MAX_SKIN_SIZE_BYTES) {
                        console.warn(`[SKIN_MANAGER] Скін ${skinId} завеликий (${stats.size} bytes), пропускаємо`);
                        continue;
                    }
                    
                    const imageBase64 = fs.readFileSync(skinPath).toString('base64');
                    skins.push({ 
                        id: skinId, 
                        name: skinId, 
                        isCustom: true, 
                        imageUrl: `data:image/png;base64,${imageBase64}` 
                    });
                }
            }
        }
    } catch (err) {
        console.error('[SKIN_MANAGER] getAllSkins error:', err);
    }
    
    return skins;
}

function deleteCustomSkin(skinId) {
    if (!skinId || typeof skinId !== 'string') {
        console.error('[SKIN_MANAGER] Invalid skinId for deletion');
        return false;
    }
    
    const safeSkinId = path.basename(String(skinId)).replace(/\.png$/i, '');
    if (!safeSkinId || safeSkinId === '.' || safeSkinId === '..') {
        console.error('[SKIN_MANAGER] Unsafe skinId');
        return false;
    }
    
    const skinPath = path.join(skinsFolder, `${safeSkinId}.png`);
    if (fs.existsSync(skinPath)) {
        try {
            fs.unlinkSync(skinPath);
            return true;
        } catch (err) {
            console.error('[SKIN_MANAGER] deleteCustomSkin error:', err);
            return false;
        }
    }
    return false;
}

module.exports = { getAllSkins, deleteCustomSkin, skinsFolder };