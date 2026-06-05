// ЧАСТИНА 1: Ініціалізація, блокування інтерфейсу та глобальні події
const { ipcRenderer, shell } = require('electron');
const path = require('path');
const fs = require('fs');
let currentInst = null;
let isLaunching = false;

function init() {
    setInterfaceLock(false);
    setupGlobalEvents();
    loadSidebar();
}

function setInterfaceLock(lock) {
    isLaunching = lock; 
    const addBtn = document.getElementById('addBtn');
    if (addBtn) addBtn.disabled = lock;
    
    const card = document.getElementById('settingsCard');
    if (card) {
        const elements = card.querySelectorAll('input, select, button');
        elements.forEach(el => { el.disabled = lock; });
    }
    
    const list = document.getElementById('list');
    if (list) {
        list.style.opacity = lock ? "0.5" : "1";
        list.style.pointerEvents = lock ? "none" : "auto"; 
    }

    const progressContainer = document.querySelector('.progress-container');
    if (progressContainer) {
        progressContainer.style.display = lock ? "block" : "none";
    }
    
    if (!lock) {
        const progressBar = document.getElementById('progressBar');
        if (progressBar) progressBar.style.width = "0%";
    }
}

function setupGlobalEvents() {
    const ramRange = document.getElementById('ramRange');
    const ramLabel = document.getElementById('ramLabel');
    if (ramRange && ramLabel) {
        ramRange.oninput = () => {
            ramLabel.innerText = `Виділена пам'ять: ${ramRange.value} MB`;
        };
    }

    // Створення нової випадкової збірки з унікальним чотиризначним ID
    document.getElementById('addBtn').onclick = () => {
        if (isLaunching) return; 
        const verSelect = document.getElementById('ver');
        let defaultVer = '1.21.4'; 
        
        if (verSelect && verSelect.options && verSelect.options.length > 0) {
            defaultVer = verSelect.options[0].value; 
        }
        
        ipcRenderer.send('save-inst', { 
            name: `Збірка ${Date.now().toString().slice(-4)}`, 
            version: defaultVer, 
            loader: 'Vanilla', 
            username: 'Player', 
            customPath: '',
            ram: 4096 
        });
    };

    // Окрема помаранчева кнопка збереження налаштувань користувачем
    document.getElementById('saveBtn').onclick = () => {
        if (isLaunching || !currentInst) return;
        const newName = document.getElementById('editName').value.trim();
        if (!newName) {
            alert("Помилка: Назва збірки не може бути порожньою!");
            return;
        }
        ipcRenderer.send('update-inst', {
            oldName: currentInst.name,
            name: newName,
            username: document.getElementById('user').value.trim(),
            version: document.getElementById('ver').value,
            loader: document.getElementById('loader').value,
            customPath: document.getElementById('customPath').value.trim(),
            ram: parseInt(document.getElementById('ramRange').value) || 4096
        });
        document.getElementById('settingsCard').style.display = 'none';
        currentInst = null;
    };
    // Головна кнопка "ГРАТИ" з автоматичним збереженням перед запуском
    document.getElementById('playBtn').onclick = () => { 
        if (isLaunching) return;
        if (!currentInst) {
            alert("Будь ласка, спочатку оберіть або створить збірку гри ліворуч!");
            return;
        }

        // 1. Зчитуємо назву збірки прямо з поля введення, щоб уникнути багів зі старими або випадковими іменами
        const activeName = document.getElementById('editName').value.trim();
        if (!activeName) {
            alert("Помилка: Назва збірки не може бути порожньою!");
            return;
        }

        let finalVersion = document.getElementById('ver').value;
        if (!finalVersion && currentInst.version) {
            finalVersion = currentInst.version;
        }

        // 2. Збираємо 100% актуальний об'єкт даних із поточних полей інтерфейсу
        const updatedInst = {
            oldName: currentInst.name, // Потрібно для бекенду, якщо назву було змінено в інпуті
            name: activeName, 
            username: document.getElementById('user').value.trim() || 'Player',
            version: finalVersion, 
            loader: document.getElementById('loader').value,
            customPath: document.getElementById('customPath').value.trim(),
            ram: parseInt(document.getElementById('ramRange').value) || 4096
        };

        if (!updatedInst.version) {
            alert("Помилка: Не вдалося визначити версію гри.");
            return;
        }

        // 3. Автозбереження: оновлюємо конфігурацію в JSON перед самим стартом гри
        ipcRenderer.send('update-inst', updatedInst);

        // 4. Синхронізуємо локальне ім'я профілю з новим значенням
        currentInst.name = updatedInst.name;

        // 5. Блокуємо елементи управління і відправляємо гру на запуск
        setInterfaceLock(true);
        ipcRenderer.send('launch', updatedInst); 
    };
    
    document.getElementById('folderBtn').onclick = () => {
        if (isLaunching || !currentInst) return;
        try {
            const appDataPath = process.env.APPDATA || (process.platform === 'darwin' ? path.join(process.env.HOME, 'Library', 'Application Support') : path.join(process.env.HOME, '.config'));
            const instancePath = currentInst.customPath && fs.existsSync(currentInst.customPath) ? currentInst.customPath : path.join(appDataPath, 'fl-launcher', 'instances', currentInst.name);
            if (!fs.existsSync(instancePath)) { fs.mkdirSync(instancePath, { recursive: true }); }
            shell.openPath(instancePath);
        } catch (err) { console.error(err); }
    };

    document.getElementById('logBtn').onclick = () => {
        if (!currentInst) return;
        try {
            const appDataPath = process.env.APPDATA || (process.platform === 'darwin' ? path.join(process.env.HOME, 'Library', 'Application Support') : path.join(process.env.HOME, '.config'));
            const logPath = path.join(appDataPath, 'fl-launcher', 'instances', currentInst.name, 'latest-mc.log');
            if (fs.existsSync(logPath)) {
                shell.openPath(logPath);
            } else {
                alert("Файл логів ще не створено. Запустіть гру хоча б один раз!");
            }
        } catch (err) { console.error(err); }
    };

    window.onclick = (e) => { 
        if (isLaunching) return; 
        if (!e.target.matches('.menu-btn')) { 
            const m = document.getElementById('contextMenu'); 
            if (m) m.classList.add('hidden'); 
        } 
    };
}

async function loadSidebar() {
    const list = document.getElementById('list'); if (!list) return; list.innerHTML = "";
    try {
        const conf = await ipcRenderer.invoke('get-cfg');
        if (!conf || !conf.installations) return;
        conf.installations.forEach(i => {
            let div = document.createElement('div'); div.className = 'inst-item';
            div.innerHTML = `<span>${i.name}</span> <button class="menu-btn">⋮</button>`;
            
            div.querySelector('.menu-btn').onclick = (e) => {
                e.stopPropagation(); 
                if (isLaunching) return; 
                currentInst = i;
                const m = document.getElementById('contextMenu');
                if (m) { m.style.top = e.clientY + 'px'; m.style.left = e.clientX + 'px'; m.classList.remove('hidden'); }
            };
            
            div.onclick = () => {
                if (isLaunching) return; 
                currentInst = i; document.getElementById('settingsCard').style.display = 'block';
                document.getElementById('title').innerText = i.name;
                document.getElementById('editName').value = i.name;
                document.getElementById('user').value = i.username || 'Player';
                
                const verSelect = document.getElementById('ver');
                if (verSelect && i.version) {
                    let hasOption = false;
                    for (let idx = 0; idx < verSelect.options.length; idx++) {
                        if (verSelect.options[idx].value === i.version) { hasOption = true; break; }
                    }
                    if (!hasOption) {
                        const temporaryOpt = document.createElement('option');
                        temporaryOpt.value = i.version; temporaryOpt.innerText = i.version;
                        verSelect.appendChild(temporaryOpt);
                    }
                    verSelect.value = i.version;
                }
                
                document.getElementById('loader').value = i.loader || "Vanilla";
                document.getElementById('customPath').value = i.customPath || "";
                
                const savedRam = i.ram || 4096;
                document.getElementById('ramRange').value = savedRam;
                document.getElementById('ramLabel').innerText = `Виділена пам'ять: ${savedRam} MB`;

                document.getElementById('statusText').innerText = "Статус: готовий";
                document.getElementById('subStatusText').innerText = ""; 
            };
            list.appendChild(div);
        });
    } catch (err) { console.error(err); }
}

window.delInst = () => { 
    if (isLaunching) return;
    ipcRenderer.send('del-inst', currentInst.name); 
    document.getElementById('contextMenu').classList.add('hidden'); 
    document.getElementById('settingsCard').style.display = 'none'; 
    currentInst = null; 
};

window.editInst = () => { 
    if (isLaunching) return;
    document.getElementById('settingsCard').style.display = 'block'; 
    document.getElementById('contextMenu').classList.add('hidden'); 
};

ipcRenderer.on('config-updated', () => { loadSidebar(); });

ipcRenderer.on('init-versions-data', (e, versions) => {
    const verSelect = document.getElementById('ver');
    if (!verSelect) return;
    
    if (versions && Array.isArray(versions) && versions.length > 0) {
        verSelect.innerHTML = ""; 
        versions.forEach(v => {
            const typeLabel = v.type === 'release' ? '' : ` (${v.type})`;
            verSelect.innerHTML += `<option value="${v.id}">${v.id}${typeLabel}</option>`;
        });
        
        if (verSelect.options.length > 0) {
            verSelect.selectedIndex = 0;
            verSelect.value = verSelect.options[0].value;
        }
    } else {
        const localReleases = ["1.21.4", "1.20.4", "1.16.5"];
        verSelect.innerHTML = "";
        localReleases.forEach(v => { verSelect.innerHTML += `<option value="${v}">${v}</option>`; });
        verSelect.selectedIndex = 0;
    }
    
    if (currentInst && currentInst.version) {
        verSelect.value = currentInst.version;
    }
});

ipcRenderer.on('status', (e, message) => { 
    const statusText = document.getElementById('statusText');
    if (statusText) statusText.innerText = message;

    const match = message.match(/(\d+)%/);
    if (match) {
        const percent = match[1]; 
        const progressBar = document.getElementById('progressBar');
        if (progressBar) progressBar.style.width = `${percent}%`;
    }

    if (message.includes('готовий') || message.includes('помилка') || message.includes('закрилися')) {
        setInterfaceLock(false);
    }
});

ipcRenderer.on('sub-status', (e, subMessage) => {
    const subStatusText = document.getElementById('subStatusText');
    if (subStatusText) subStatusText.innerText = subMessage;
});

document.addEventListener('DOMContentLoaded', init);
