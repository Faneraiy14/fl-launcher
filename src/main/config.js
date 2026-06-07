// ============================================
// config.js (виправлено)
// ============================================
const fs = require('fs');
const path = require('path');

const appDataRoaming = process.env.APPDATA || (process.platform === 'darwin' ? path.join(process.env.HOME, 'Library', 'Application Support') : path.join(process.env.HOME, '.config'));
const configFolder = path.join(appDataRoaming, 'fl-launcher');
const configPath = path.join(configFolder, 'config.json');
const backupPath = path.join(configFolder, 'config.json.bak');

function ensureConfigFolder() {
    if (!fs.existsSync(configFolder)) {
        fs.mkdirSync(configFolder, { recursive: true });
    }
}

module.exports = {
    load: () => {
        try {
            ensureConfigFolder();
            if (fs.existsSync(configPath)) {
                const data = fs.readFileSync(configPath, 'utf8').trim();
                if (data.length > 0) {
                    const parsed = JSON.parse(data);
                    if (parsed && Array.isArray(parsed.installations)) {
                        return parsed;
                    }
                }
            }
        } catch (err) {
            console.error("[CONFIG_ERR]:", err.message);
            try {
                if (fs.existsSync(backupPath)) {
                    const backupData = fs.readFileSync(backupPath, 'utf8');
                    const parsed = JSON.parse(backupData);
                    if (parsed && Array.isArray(parsed.installations)) {
                        fs.writeFileSync(configPath, backupData, 'utf8');
                        return parsed;
                    }
                }
            } catch (backupErr) {
                console.error("[CONFIG_BACKUP_ERR]:", backupErr.message);
            }
        }
        return { installations: [] };
    },
    save: (cfg) => {
        try {
            if (!cfg || typeof cfg !== 'object') {
                throw new Error('Invalid configuration object');
            }
            ensureConfigFolder();
            if (fs.existsSync(configPath)) {
                fs.copyFileSync(configPath, backupPath);
            }
            fs.writeFileSync(configPath, JSON.stringify(cfg, null, 2), 'utf8');
        } catch (err) {
            console.error("[CONFIG_SAVE_ERR]:", err);
        }
    }
};