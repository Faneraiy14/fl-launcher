const { app } = require('electron');
const fs = require('fs');
const path = require('path');

// Офіційний та безпечний шлях до папки AppData/Roaming/my-mc-launcher для збереження налаштувань
const configFolder = app.getPath('userData');
const configPath = path.join(configFolder, 'config.json');

module.exports = {
    load: () => {
        try {
            if (fs.existsSync(configPath)) {
                const fileData = fs.readFileSync(configPath, 'utf8');
                return JSON.parse(fileData);
            }
        } catch (err) {
            console.error("Помилка читання або парсингу config.json. Повертаємо чистий конфіг:", err);
        }
        // Якщо файлу немає або він пошкоджений — повертаємо шаблон
        return { installations: [] };
    },
    
    save: (cfg) => {
        try {
            // Гарантуємо, що папка в AppData існує перед записом
            if (!fs.existsSync(configFolder)) {
                fs.mkdirSync(configFolder, { recursive: true });
            }
            fs.writeFileSync(configPath, JSON.stringify(cfg, null, 2), 'utf8');
        } catch (err) {
            console.error("Не вдалося зберегти конфігурацію в AppData:", err);
        }
    }
};
