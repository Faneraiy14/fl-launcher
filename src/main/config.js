const fs = require('fs');
const path = require('path');

const appDataRoaming = process.env.APPDATA || (process.platform === 'darwin' ? path.join(process.env.HOME, 'Library', 'Application Support') : path.join(process.env.HOME, '.config'));
const configFolder = path.join(appDataRoaming, 'fl-launcher');
const configPath = path.join(configFolder, 'config.json');
const backupPath = path.join(configFolder, 'config.json.bak'); // Путь к файлу резервной копии

module.exports = {
    load: () => {
        try {
            if (!fs.existsSync(configFolder)) { 
                fs.mkdirSync(configFolder, { recursive: true }); 
            }
            
            // Если основной файл существует, пытаемся его прочитать
            if (fs.existsSync(configPath)) { 
                const data = fs.readFileSync(configPath, 'utf8').trim();
                if (data.length > 0) {
                    return JSON.parse(data); 
                }
            }
        } catch (err) { 
            console.error("[CONFIG_ERR]: Основний файл конфігурації пошкоджено, спроба відновити з бекапу...", err.message); 
            
            // Защита от повреждения файлов: если основной файл сломался, восстанавливаем его из бэкапа
            try {
                if (fs.existsSync(backupPath)) {
                    const backupData = fs.readFileSync(backupPath, 'utf8');
                    fs.writeFileSync(configPath, backupData, 'utf8');
                    console.log("[CONFIG_INFO]: Конфігурацію успішно відновлено з резервної копії.");
                    return JSON.parse(backupData);
                }
            } catch (backupErr) {
                console.error("[CONFIG_ERR]: Не вдалося прочитати навіть резервну копію:", backupErr.message);
            }
        }
        return { installations: [] };
    },
    save: (cfg) => {
        try {
            if (!fs.existsSync(configFolder)) { 
                fs.mkdirSync(configFolder, { recursive: true }); 
            }
            
            // Перед перезаписью основного файла делаем бэкап текущего рабочего конфига
            if (fs.existsSync(configPath)) {
                fs.copyFileSync(configPath, backupPath);
            }
            
            fs.writeFileSync(configPath, JSON.stringify(cfg, null, 2), 'utf8');
        } catch (err) { 
            console.error("[CONFIG_SAVE_ERR]: Помилка збереження файлу конфігурації:", err); 
        }
    }
};
