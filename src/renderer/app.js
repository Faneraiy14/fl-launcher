const { ipcRenderer, shell } = require('electron');
const path = require('path');
const fs = require('fs');
let currentInst = null;
let isLaunching = false; // Глобальний прапорець статусу запуску гри

async function init() {
    // ЗАХИСТ: Примусово розблоковуємо весь інтерфейс при старті лаунчера
    setInterfaceLock(false);
    
    setupGlobalEvents();
    
    try {
        const versions = await ipcRenderer.invoke('get-versions');
        const verSelect = document.getElementById('ver');
        
        if (versions && Array.isArray(versions) && versions.length > 0) {
            verSelect.innerHTML = ""; 
            
            // Виводимо АБСОЛЮТНО ВСІ версії від Mojang без жодних обмежень
            versions.forEach(v => {
                const typeLabel = v.type === 'release' ? '' : ` (${v.type})`;
                verSelect.innerHTML += `<option value="${v.id}">${v.id}${typeLabel}</option>`;
            });

            if (verSelect.options.length > 0) verSelect.selectedIndex = 0;
        } else {
            // Безпечний локальний список, якщо сервери Mojang недоступні
            const localReleases = ["1.21.11", "1.21.4", "1.20.4", "1.16.5"];
            verSelect.innerHTML = "";
            localReleases.forEach(v => { verSelect.innerHTML += `<option value="${v}">${v}</option>`; });
            verSelect.selectedIndex = 0;
        }
    } catch (err) {
        console.error("Помилка IPC при завантаженні версій:", err);
    }

    loadSidebar();
}

// Функція для повного увімкнення або вимкнення інтерфейсу налаштувань
function setInterfaceLock(lock) {
    isLaunching = lock; 
    
    // Блокуємо/розблоковуємо кнопку створення нової збірки
    const addBtn = document.getElementById('addBtn');
    if (addBtn) addBtn.disabled = lock;
    
    // Знаходимо всі інпути, селектори та кнопки всередині форми налаштувань і перемикаємо їх
    const card = document.getElementById('settingsCard');
    if (card) {
        const elements = card.querySelectorAll('input, select, button');
        elements.forEach(el => {
            el.disabled = lock;
        });
    }
    
    // Візуально додаємо прозорості списку збірок, щоб показати, що він заблокований
    const list = document.getElementById('list');
    if (list) {
        list.style.opacity = lock ? "0.5" : "1";
        list.style.pointerEvents = lock ? "none" : "auto"; 
    }
}

function setupGlobalEvents() {
    document.getElementById('addBtn').onclick = () => {
        if (isLaunching) return; 
        const verSelect = document.getElementById('ver');
        // Якщо список версій ще не провантажився, ставимо дефолтну робочу версію
        const defaultVer = verSelect && verSelect.options.length > 0 && verSelect.value ? verSelect.value : '1.21.4';
        ipcRenderer.send('save-inst', { name: `Збірка ${Date.now().toString().slice(-4)}`, version: defaultVer, loader: 'Vanilla', username: 'Player', customPath: '' });
    };

    document.getElementById('saveBtn').onclick = () => {
        if (isLaunching || !currentInst) return;
        ipcRenderer.send('update-inst', {
            oldName: currentInst.name,
            name: document.getElementById('editName').value.trim(),
            username: document.getElementById('user').value.trim(),
            version: document.getElementById('ver').value,
            loader: document.getElementById('loader').value,
            customPath: document.getElementById('customPath').value.trim()
        });
    };

    document.getElementById('playBtn').onclick = () => { 
        if (isLaunching) return;
        if (!currentInst) {
            alert("Будь ласка, спочатку оберіть або створіть збірку гри ліворуч!");
            return;
        }

        let finalVersion = document.getElementById('ver').value;
        if (!finalVersion && currentInst.version) {
            finalVersion = currentInst.version;
        }

        const updatedInst = {
            name: currentInst.name, 
            username: document.getElementById('user').value.trim() || 'Player',
            version: finalVersion, 
            loader: document.getElementById('loader').value,
            customPath: document.getElementById('customPath').value.trim()
        };

        if (!updatedInst.version) {
            alert("Помилка: Не вдалося визначити версію гри. Оберіть її зі списку.");
            return;
        }

        setInterfaceLock(true);
        ipcRenderer.send('launch', updatedInst); 
    };
    
    document.getElementById('folderBtn').onclick = () => {
        if (isLaunching || !currentInst) return;
        
        try {
            const appDataPath = process.env.APPDATA || (process.platform === 'darwin' ? path.join(process.env.HOME, 'Library', 'Application Support') : path.join(process.env.HOME, '.config'));
            const instancePath = path.join(appDataPath, 'fl-launcher', 'instances', currentInst.name);
            
            if (!fs.existsSync(instancePath)) {
                fs.mkdirSync(instancePath, { recursive: true });
            }
            shell.openPath(instancePath);
        } catch (err) {
            console.error("Помилка відкриття папки:", err);
        }
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
                if (verSelect) {
                    let optionExists = false;
                    for (let idx = 0; idx < verSelect.options.length; idx++) {
                        if (verSelect.options[idx].value === i.version) {
                            optionExists = true;
                            break;
                        }
                    }
                    
                    if (!optionExists && i.version) {
                        const newOpt = document.createElement('option');
                        newOpt.value = i.version;
                        newOpt.innerText = i.version;
                        verSelect.appendChild(newOpt);
                    }
                    
                    verSelect.value = i.version;
                    
                    if (verSelect.value !== i.version && verSelect.options.length > 0) {
                        verSelect.selectedIndex = 0;
                    }
                }
                
                document.getElementById('loader').value = i.loader || "Vanilla";
                document.getElementById('customPath').value = i.customPath || "";
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

ipcRenderer.on('status', (e, m) => { 
    document.getElementById('statusText').innerText = m; 
    if (m.includes('вилетіла') || m.includes('готовий') || m.includes('помилка') || m.includes('запуск')) {
        // Додано розблокування при статусі "запуск", якщо вікно не сховалося,
        // щоб інтерфейс не зависав «намертво» у разі мовчазного крашу Java
        setInterfaceLock(false);
    }
});

ipcRenderer.on('sub-status', (e, m) => { document.getElementById('subStatusText').innerText = m; });
init();
