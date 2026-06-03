const { ipcRenderer } = require('electron');
let currentInst = null;

// Ініціалізація інтерфейсу при старті програми
async function init() {
    setupGlobalEvents();
    
    try {
        const versions = await ipcRenderer.invoke('get-versions');
        const verSelect = document.getElementById('ver');
        
        if (versions && Array.isArray(versions)) {
            // Фільтруємо лише релізи та додаємо їх у випадаючий список
            versions.filter(v => v.type === 'release').forEach(v => {
                verSelect.innerHTML += `<option value="${v.id}">${v.id}</option>`;
            });
        }
    } catch (err) {
        console.error("Не вдалося завантажити список версій:", err);
        document.getElementById('statusText').innerText = "Статус: Помилка завантаження версій з мережі";
    }

    loadSidebar();
}

// Налаштування глобальних подій, які мають створюватися лише ОДИН раз
function setupGlobalEvents() {
    document.getElementById('addBtn').onclick = () => {
        ipcRenderer.send('save-inst', { 
            name: `Нова збірка ${Date.now().toString().slice(-4)}`, 
            version: '1.21.1', 
            loader: 'Vanilla', 
            username: 'Player', 
            customPath: '' 
        });
    };

    document.getElementById('saveBtn').onclick = () => {
        if (!currentInst) return;
        
        ipcRenderer.send('update-inst', {
            oldName: currentInst.name,
            name: document.getElementById('editName').value.trim(),
            username: document.getElementById('user').value.trim(),
            version: document.getElementById('ver').value,
            loader: document.getElementById('loader').value,
            customPath: document.getElementById('customPath').value.trim()
        });
    };

    // Слухач кнопки "ГРАТИ" призначається ОДИН раз (усуває баг дублювання процесів)
    const playBtn = document.getElementById('playBtn');
    if (playBtn) {
        playBtn.onclick = () => {
            if (currentInst) {
                ipcRenderer.send('launch', currentInst);
            }
        };
    }

    // Закриття контекстного меню при кліку в будь-яке інше місце екрана
    window.onclick = (e) => { 
        if (!e.target.matches('.menu-btn')) {
            const menu = document.getElementById('contextMenu');
            if (menu) menu.classList.add('hidden'); 
        }
    };
}

// Функція динамічного рендерингу сайдбару зі збірками
async function loadSidebar() {
    const list = document.getElementById('list'); 
    if (!list) return;
    
    list.innerHTML = "";
    
    try {
        const conf = await ipcRenderer.invoke('get-cfg');
        if (!conf || !conf.installations) return;

        conf.installations.forEach(i => {
            let div = document.createElement('div');
            div.className = 'inst-item';
            div.innerHTML = `<span>${i.name}</span> <button class="menu-btn">⋮</button>`;
            
            // Натискання на три крапки (тригер контекстного меню)
            div.querySelector('.menu-btn').onclick = (e) => {
                e.stopPropagation(); // Зупиняємо виклик події натискання на сам div
                currentInst = i;
                const menu = document.getElementById('contextMenu');
                if (menu) {
                    menu.style.top = e.clientY + 'px'; 
                    menu.style.left = e.clientX + 'px'; 
                    menu.classList.remove('hidden');
                }
            };

            // Вибір збірки для редагування/запуску
            div.onclick = () => {
                currentInst = i;
                
                const settingsCard = document.getElementById('settingsCard');
                if (settingsCard) settingsCard.style.display = 'block';
                
                document.getElementById('title').innerText = i.name;
                document.getElementById('editName').value = i.name;
                document.getElementById('user').value = i.username || 'Player';
                document.getElementById('ver').value = i.version;
                document.getElementById('loader').value = i.loader || "Vanilla";
                document.getElementById('customPath').value = i.customPath || "";
            };
            
            list.appendChild(div);
        });
    } catch (err) {
        console.error("Помилка рендерингу сайдбару:", err);
    }
}

// ГЛОБАЛЬНІ ФУНКЦІЇ ДЛЯ КОНТЕКСТНОГО МЕНЮ (виклик з HTML атрибутів)
window.delInst = () => { 
    if (!currentInst) return;
    ipcRenderer.send('del-inst', currentInst.name); 
    
    document.getElementById('contextMenu').classList.add('hidden'); 
    document.getElementById('settingsCard').style.display = 'none'; 
    currentInst = null; // Повністю очищуємо виділення збірки
};

window.editInst = () => { 
    const settingsCard = document.getElementById('settingsCard');
    if (settingsCard) settingsCard.style.display = 'block'; 
    document.getElementById('contextMenu').classList.add('hidden'); 
};

// СЛУХАЧІ СИСТЕМНИХ ПОДІЙ ВІД NODE.JS (MAIN)

ipcRenderer.on('config-updated', () => {
    loadSidebar();
});

ipcRenderer.on('status', (e, m) => {
    const statusText = document.getElementById('statusText');
    if (statusText) statusText.innerText = m;
});

// ПЕРЕХОПЛЕННЯ ПРОГРЕСУ ОНОВЛЕННЯ

ipcRenderer.on('updater-download-start', () => {
    if (document.getElementById('updater-progress-container')) return;

    const container = document.createElement('div');
    container.id = 'updater-progress-container';
    container.style = 'position:fixed; bottom:15px; right:15px; background:#18181b; border:1px solid #27272a; padding:15px; border-radius:8px; z-index:9999; color:#fff; width:260px; font-family:sans-serif; box-shadow:0 10px 25px rgba(0,0,0,0.5);';
    container.innerHTML = `
        <div style="margin-bottom:8px; font-size:13px; font-weight:500;" id="updater-text">Завантаження оновлення... 0%</div>
        <div style="width:100%; background:#27272a; height:6px; border-radius:3px; overflow:hidden;">
            <div id="updater-bar" style="width:0%; background:#2ecc71; height:100%; transition: width 0.2s ease;"></div>
        </div>
    `;
    document.body.appendChild(container);
});

ipcRenderer.on('updater-download-progress', (event, percent) => {
    const bar = document.getElementById('updater-bar');
    const text = document.getElementById('updater-text');
    if (bar && text) {
        bar.style.width = percent + '%';
        text.innerText = `Завантаження оновлення... ${percent}%`;
    }
});

// Запуск ініціалізації після повного завантаження скрипту
init();
