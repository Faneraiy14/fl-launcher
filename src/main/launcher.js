const { app } = require('electron');
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

function launchGame(inst, win) {
    // Залізобетонний спосіб перевірити режим розробника
    const isDev = app.getAppPath().includes('node_modules') || !process.resourcesPath || process.resourcesPath.includes('node_modules');
    
    // Якщо розробка — беремо корінь проекту, якщо зібрано — папку поруч із .exe (ЗА МЕЖАМИ app.asar!)
    const baseAppPath = isDev ? process.cwd() : path.dirname(process.execPath);
    
    // Тепер папка instances гарантовано створюється у доступному для запису місці
    const rootPath = path.join(baseAppPath, 'instances', inst.name);
    const jarPath = path.join(rootPath, 'versions', inst.version, `${inst.version}.jar`);
    
    // Шлях до вашої вбудованої портативної Java
    const javaPath = path.join(baseAppPath, 'java', 'bin', 'java.exe');
    
    // Перевірка, чи взагалі існує Java перед запуском
    if (!fs.existsSync(javaPath)) {
        console.error(`Критична помилка: Java не знайдено за шляхом: ${javaPath}`);
        if (win && !win.isDestroyed()) {
            win.show();
            win.webContents.send('status', 'Помилка: вбудовану Java не знайдено!');
        }
        return;
    }
    
    const libDir = path.join(rootPath, 'libraries');
    const argsFile = path.join(rootPath, 'args.txt');

    const getFiles = (dir) => {
        let results = [];
        if (!fs.existsSync(dir)) return [];
        fs.readdirSync(dir).forEach(file => {
            const fullPath = path.join(dir, file);
            if (fs.statSync(fullPath).isDirectory()) results = results.concat(getFiles(fullPath));
            else if (file.endsWith('.jar')) results.push(fullPath);
        });
        return results;
    };

    const libs = fs.existsSync(libDir) ? getFiles(libDir).join(';') : "";
    
    const argsContent = [
        "-Xmx4096M",
        "-cp", `${jarPath};${libs}`,
        "net.minecraft.client.main.Main",
        "--username", inst.username,
        "--version", inst.version,
        "--gameDir", rootPath,
        "--assetsDir", path.join(rootPath, 'assets'),
        "--assetIndex", inst.version,
        "--uuid", "any",
        "--accessToken", "any",
        "--versionType", "release"
    ].join('\n');
    
    try {
        // Створюємо папку інстансу безпечно
        if (!fs.existsSync(rootPath)) {
            fs.mkdirSync(rootPath, { recursive: true });
        }
        fs.writeFileSync(argsFile, argsContent);
    } catch (err) {
        console.error("Помилка створення файлів конфігурації гри:", err);
        if (win && !win.isDestroyed()) win.show();
        return;
    }

    console.log("Запуск через: " + javaPath);
    
    if (win && !win.isDestroyed()) {
        win.hide();
    }

    // Запуск процесу гри
    const child = spawn(javaPath, ["@" + argsFile], { cwd: rootPath });

    child.stdout.on('data', (d) => console.log(`MC: ${d}`));
    child.stderr.on('data', (d) => console.error(`MC_ERR: ${d}`));
    
    // Якщо сам процес не зміг запуститися (наприклад, через брак ОЗУ чи збій Windows)
    child.on('error', (err) => {
        console.error("Не вдалося запустити процес гри:", err);
        if (win && !win.isDestroyed()) {
            win.show();
            win.webContents.send('status', 'Помилка запуску процесу гри.');
        }
    });

    child.on('close', () => {
        if (win && !win.isDestroyed()) win.show();
    });
}

module.exports = { launchGame };
