const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

function launchGame(username, version, win) {
    const rootPath = path.join(__dirname, '../../instances', version);
    const jarPath = path.join(rootPath, 'versions', version, `${version}.jar`);
    const libPath = path.join(rootPath, 'libraries', '*');
    
    // Якщо нік порожній, ставимо Fanera
    const finalUsername = (username && username.trim() !== "") ? username : "Fanera";

    const args = [
        "-Xmx4096M",
        "-cp", `${jarPath};${libPath}`,
        "net.minecraft.client.main.Main",
        "--username", finalUsername,
        "--version", version,
        "--gameDir", rootPath,
        "--assetsDir", path.join(rootPath, 'assets'),
        "--assetIndex", version,
        "--uuid", "any",
        "--accessToken", "any",
        "--versionType", "release"
    ];

    win.hide(); // Ховаємо лаунчер при запуску
    console.log("Запуск Minecraft...");

    const child = spawn("java", args, { cwd: rootPath, shell: true });

    child.stdout.on('data', (d) => console.log(`MC: ${d}`));
    child.stderr.on('data', (d) => console.error(`MC_ERR: ${d}`));
    child.on('close', (code) => {
        console.log(`Гра завершилась з кодом: ${code}`);
        win.show(); // Показуємо лаунчер після виходу з гри
    });
}

module.exports = { launchGame };