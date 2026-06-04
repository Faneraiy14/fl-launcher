const { app } = require('electron');
const fs = require('fs');
const path = require('path');

const configFolder = app.getPath('userData');
const configPath = path.join(configFolder, 'config.json');

module.exports = {
    load: () => {
        try {
            if (fs.existsSync(configPath)) {
                return JSON.parse(fs.readFileSync(configPath, 'utf8'));
            }
        } catch (err) {
            console.error("Помилка читання бази даних config.json:", err);
        }
        return { installations: [] };
    },
    save: (cfg) => {
        try {
            if (!fs.existsSync(configFolder)) fs.mkdirSync(configFolder, { recursive: true });
            fs.writeFileSync(configPath, JSON.stringify(cfg, null, 2), 'utf8');
        } catch (err) {
            console.error("Помилка запису бази даних в AppData:", err);
        }
    }
};