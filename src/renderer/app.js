// ============================================
// app.js (ПОВНІСТЮ - З ПОКАЗОМ ВЕРСІЇ)
// ============================================

let currentInst = null;
let isLaunching = false;
let currentSkin = { id: 'steve', name: 'Steve', imageUrl: 'https://minotar.net/helm/steve/100.png' };
let unsubs = [];

function escapeHtml(str) { 
    if (!str) return ''; 
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;'); 
}

function cleanup() {
    if (unsubs && unsubs.length) {
        unsubs.forEach(fn => {
            if (fn && typeof fn === 'function') fn();
        });
        unsubs.length = 0;
    }
}

function setInterfaceLock(lock) {
    isLaunching = lock;
    
    const addBtn = document.getElementById('addBtn');
    if (addBtn) addBtn.disabled = lock;
    
    const settingsCard = document.getElementById('settingsCard');
    if (settingsCard) {
        const inputs = settingsCard.querySelectorAll('input, select, button');
        inputs.forEach(el => { if (el) el.disabled = lock; });
    }
    
    const list = document.getElementById('list');
    if (list) { 
        list.style.opacity = lock ? '0.5' : '1'; 
        list.style.pointerEvents = lock ? 'none' : 'auto'; 
    }
    
    const progWrap = document.querySelector('.progress-container');
    if (progWrap) progWrap.style.display = lock ? 'block' : 'none';
    
    if (!lock) { 
        const bar = document.getElementById('progressBar'); 
        if (bar) bar.style.width = '0%'; 
    }
}

async function loadSkins() {
    try { 
        const skins = await window.api.invoke('get-skins'); 
        if (skins && skins.length && currentSkin) { 
            const found = skins.find(s => s.id === currentSkin.id); 
            if (found) { 
                currentSkin = found; 
                updateSkinPreview(); 
            } 
        } 
    } catch (err) { 
        console.error('[APP] loadSkins:', err); 
    }
}

function updateSkinPreview() { 
    const img = document.getElementById('skinPreviewImg'); 
    if (img && currentSkin) { 
        img.src = currentSkin.imageUrl; 
        img.alt = currentSkin.name; 
        img.onerror = () => { 
            img.src = 'https://minotar.net/helm/steve/50.png'; 
        }; 
    } 
}

function openSkinSelector() { 
    if (!currentInst) { 
        alert('Спочатку виберіть збірку!'); 
        return; 
    } 
    window.api.send('open-skin-selector'); 
}

function openModManager() { 
    if (!currentInst) { 
        alert('Спочатку виберіть збірку!'); 
        return; 
    } 
    window.api.send('open-mod-manager', { 
        name: currentInst.name, 
        version: currentInst.version, 
        loader: currentInst.loader, 
        customPath: currentInst.customPath || '' 
    }); 
}

function openOwnerPasswords() { 
    window.api.send('open-owner-passwords'); 
}

function readForm() {
    const nameInput = document.getElementById('editName');
    const userInput = document.getElementById('user');
    const passwordInput = document.getElementById('password');
    const verSelect = document.getElementById('ver');
    const loaderSelect = document.getElementById('loader');
    const customPathInput = document.getElementById('customPath');
    const ramRange = document.getElementById('ramRange');
    
    return {
        name: nameInput?.value?.trim() || '',
        username: userInput?.value?.trim() || 'Player',
        password: passwordInput?.value || '',
        skin: currentSkin.id,
        version: verSelect?.value || '',
        loader: loaderSelect?.value || 'Vanilla',
        customPath: customPathInput?.value?.trim() || '',
        ram: parseInt(ramRange?.value, 10) || 4096
    };
}

function showInstance(inst) {
    if (!inst) return;
    
    currentInst = inst;
    currentSkin = { 
        id: inst.skin || 'steve', 
        name: inst.skin || 'Steve', 
        imageUrl: `https://minotar.net/helm/${inst.skin || 'steve'}/100.png` 
    };
    updateSkinPreview();
    
    const settingsCard = document.getElementById('settingsCard');
    if (settingsCard) settingsCard.style.display = 'block';
    
    const title = document.getElementById('title');
    if (title) title.textContent = inst.name;
    
    const editName = document.getElementById('editName');
    if (editName) editName.value = inst.name;
    
    const user = document.getElementById('user');
    if (user) user.value = inst.username || 'Player';
    
    const password = document.getElementById('password');
    if (password) password.value = inst.password || '';
    
    const customPath = document.getElementById('customPath');
    if (customPath) customPath.value = inst.customPath || '';
    
    const loader = document.getElementById('loader');
    if (loader) loader.value = inst.loader || 'Vanilla';
    
    const ram = inst.ram || 4096;
    const ramRange = document.getElementById('ramRange');
    const ramLabel = document.getElementById('ramLabel');
    if (ramRange) ramRange.value = ram;
    if (ramLabel) ramLabel.textContent = `Виділена пам'ять: ${ram} MB`;
    
    const statusText = document.getElementById('statusText');
    if (statusText) {
        statusText.textContent = 'Статус: готовий';
        statusText.style.color = '';
    }
    
    const subStatusText = document.getElementById('subStatusText');
    if (subStatusText) {
        subStatusText.textContent = '';
        subStatusText.style.color = '';
    }
    
    const verSelect = document.getElementById('ver');
    if (verSelect && inst.version) { 
        if (![...verSelect.options].some(o => o.value === inst.version)) {
            verSelect.appendChild(new Option(inst.version, inst.version));
        }
        verSelect.value = inst.version; 
    }
}

async function loadSidebar() {
    const list = document.getElementById('list');
    if (!list) return;
    
    list.innerHTML = '';
    let cfg;
    try { 
        cfg = await window.api.invoke('get-cfg'); 
    } catch (err) { 
        console.error('[APP] loadSidebar error:', err);
        cfg = { installations: [] }; 
    }
    
    const installations = cfg?.installations || [];
    installations.forEach(inst => {
        const item = document.createElement('div');
        item.className = 'inst-item';
        item.innerHTML = `<span>${escapeHtml(inst.name)}</span><button class="menu-btn">⋮</button>`;
        
        item.addEventListener('click', (e) => { 
            if (e.target.classList.contains('menu-btn')) return;
            if (!isLaunching) showInstance(inst); 
        });
        
        const menuBtn = item.querySelector('.menu-btn');
        if (menuBtn) {
            menuBtn.addEventListener('click', (e) => { 
                e.stopPropagation(); 
                if (isLaunching) return; 
                currentInst = inst; 
                const menu = document.getElementById('contextMenu'); 
                if (menu) { 
                    menu.style.top = `${e.clientY}px`; 
                    menu.style.left = `${e.clientX}px`; 
                    menu.classList.remove('hidden'); 
                } 
            });
        }
        
        list.appendChild(item);
    });
}

// ============ ПОКАЗ ВЕРСІЇ ============

function createToastElement() {
    if (document.getElementById('versionToast')) return;
    
    const toast = document.createElement('div');
    toast.id = 'versionToast';
    toast.style.cssText = `
        position: fixed;
        bottom: 20px;
        right: 20px;
        background: #2ecc71;
        color: #fff;
        padding: 12px 20px;
        border-radius: 8px;
        font-size: 14px;
        font-weight: bold;
        z-index: 9999;
        opacity: 0;
        transition: opacity 0.3s ease;
        pointer-events: none;
        box-shadow: 0 4px 15px rgba(0,0,0,0.3);
    `;
    document.body.appendChild(toast);
}

function showVersionToast(version) {
    createToastElement();
    const toast = document.getElementById('versionToast');
    if (!toast) return;
    
    toast.textContent = `FL Launcher v${version}`;
    toast.style.opacity = '1';
    
    setTimeout(() => {
        toast.style.opacity = '0';
    }, 2000);
}

async function checkAndShowVersion() {
    try {
        const version = await window.api.invoke('get-app-version');
        showVersionToast(version);
    } catch (err) {
        console.error('[APP] Помилка отримання версії:', err);
        showVersionToast('1.6.0');
    }
}

function showDetailedError(errorDetails) {
    console.error('[APP] Launch error details:', errorDetails);
    
    const statusEl = document.getElementById('statusText');
    const subStatusEl = document.getElementById('subStatusText');
    
    if (statusEl) {
        statusEl.innerHTML = `❌ ПОМИЛКА: ${errorDetails.shortMessage || 'Невідома помилка'}`;
        statusEl.style.color = '#e74c3c';
        statusEl.style.fontWeight = 'bold';
    }
    
    if (subStatusEl) {
        subStatusEl.innerHTML = errorDetails.details || 'Немає додаткової інформації';
        subStatusEl.style.color = '#e74c3c';
        subStatusEl.style.fontSize = '12px';
    }
    
    if (errorDetails.stepLog && errorDetails.stepLog.length) {
        console.group('📋 ДЕТАЛЬНИЙ ЛОГ ЗАПУСКУ');
        errorDetails.stepLog.forEach(step => {
            const icon = step.success ? '✅' : '❌';
            console.log(`${icon} ${step.step}: ${step.details}`);
        });
        console.groupEnd();
    }
    
    if (errorDetails.stack) {
        console.error('📚 Stack trace:', errorDetails.stack);
    }
    
    setTimeout(() => {
        setInterfaceLock(false);
    }, 500);
}

// ============ НАЛАШТУВАННЯ ПОДІЙ ============

function setupGlobalEvents() {
    const ramRange = document.getElementById('ramRange');
    const ramLabel = document.getElementById('ramLabel');
    if (ramRange && ramLabel) {
        ramRange.addEventListener('input', function () { 
            ramLabel.textContent = `Виділена пам'ять: ${this.value} MB`; 
        });
    }
    
    const addBtn = document.getElementById('addBtn');
    if (addBtn) {
        addBtn.addEventListener('click', () => { 
            if (isLaunching) return; 
            const verSelect = document.getElementById('ver'); 
            const defaultVersion = verSelect?.options[0]?.value || '1.21.10';
            window.api.send('save-inst', { 
                name: `Збірка ${Date.now().toString().slice(-4)}`, 
                version: defaultVersion, 
                loader: 'Vanilla', 
                username: 'Player', 
                password: '', 
                skin: 'steve', 
                customPath: '', 
                ram: 4096 
            }); 
        });
    }
    
    const saveBtn = document.getElementById('saveBtn');
    if (saveBtn) {
        saveBtn.addEventListener('click', () => { 
            if (isLaunching || !currentInst) return; 
            const form = readForm(); 
            if (!form.name) { 
                alert('Назва збірки не може бути порожньою!'); 
                return; 
            } 
            window.api.send('update-inst', { oldName: currentInst.name, ...form }); 
            const settingsCard = document.getElementById('settingsCard');
            if (settingsCard) settingsCard.style.display = 'none'; 
            currentInst = null; 
        });
    }
    
    const playBtn = document.getElementById('playBtn');
    if (playBtn) {
        playBtn.addEventListener('click', () => { 
            if (isLaunching) return; 
            if (!currentInst) { 
                alert('Спочатку оберіть або створіть збірку!'); 
                return; 
            } 
            const form = readForm(); 
            if (!form.name) { 
                alert('Назва збірки не може бути порожньою!'); 
                return; 
            } 
            if (!form.version) { 
                alert('Не вдалося визначити версію гри.'); 
                return; 
            } 
            window.api.send('update-inst', { oldName: currentInst.name, ...form }); 
            currentInst.name = form.name; 
            setInterfaceLock(true); 
            window.api.send('launch', form); 
        });
    }
    
    const folderBtn = document.getElementById('folderBtn');
    if (folderBtn) {
        folderBtn.addEventListener('click', () => { 
            if (!currentInst) return; 
            window.api.send('open-game-folder', readForm()); 
        });
    }
    
    const logBtn = document.getElementById('logBtn');
    if (logBtn) {
        logBtn.addEventListener('click', () => { 
            if (!currentInst) return; 
            window.api.send('open-game-log', readForm()); 
        });
    }
    
    const modsBtn = document.getElementById('modsBtn');
    if (modsBtn) modsBtn.addEventListener('click', openModManager);
    
    const changeSkinBtn = document.getElementById('changeSkinBtn');
    if (changeSkinBtn) changeSkinBtn.addEventListener('click', openSkinSelector);
    
    const aboutBtnSidebar = document.getElementById('aboutBtnSidebar');
    if (aboutBtnSidebar) aboutBtnSidebar.addEventListener('click', () => { window.api.send('show-about-dialog'); });
    
    const checkUpdatesBtn = document.getElementById('checkUpdatesBtn');
    if (checkUpdatesBtn) {
        checkUpdatesBtn.addEventListener('click', () => { 
            checkAndShowVersion();
            window.api.send('check-for-updates'); 
        });
    }
    
    const showVersionBtn = document.getElementById('showVersionBtn');
    if (showVersionBtn) {
        showVersionBtn.addEventListener('click', checkAndShowVersion);
    }
    
    const ownerPassBtn = document.getElementById('ownerPassBtn');
    if (ownerPassBtn) ownerPassBtn.addEventListener('click', openOwnerPasswords);
    
    const editInstBtn = document.getElementById('editInstBtn');
    if (editInstBtn) {
        editInstBtn.addEventListener('click', () => {
            if (isLaunching || !currentInst) return;
            showInstance(currentInst);
            const menu = document.getElementById('contextMenu');
            if (menu) menu.classList.add('hidden');
        });
    }
    
    const delInstBtn = document.getElementById('delInstBtn');
    if (delInstBtn) {
        delInstBtn.addEventListener('click', () => {
            if (isLaunching || !currentInst) return;
            window.api.send('del-inst', currentInst.name);
            const menu = document.getElementById('contextMenu');
            if (menu) menu.classList.add('hidden');
            const settingsCard = document.getElementById('settingsCard');
            if (settingsCard) settingsCard.style.display = 'none';
            currentInst = null;
        });
    }
    
    window.addEventListener('click', (e) => { 
        if (!e.target.closest('.menu-btn') && !e.target.closest('.context-menu')) {
            const menu = document.getElementById('contextMenu');
            if (menu) menu.classList.add('hidden');
        }
    });
}

// ============ ІНІЦІАЛІЗАЦІЯ ============

function init() {
    cleanup();
    setInterfaceLock(false);
    setupGlobalEvents();
    loadSidebar();
    loadSkins();
    
    unsubs.push(window.api.on('config-updated', () => {
        loadSidebar();
    }));
    
    unsubs.push(window.api.on('init-versions-data', (versions) => { 
        const sel = document.getElementById('ver'); 
        if (!sel) return; 
        sel.innerHTML = ''; 
        if (versions && versions.length) { 
            versions.forEach(v => { 
                const label = v.type === 'release' ? v.id : `${v.id} (${v.type})`; 
                sel.appendChild(new Option(label, v.id)); 
            }); 
        } else { 
            ['1.21.10', '1.21.4', '1.20.4', '1.16.5'].forEach(v => sel.appendChild(new Option(v, v))); 
        } 
        sel.selectedIndex = 0; 
        if (currentInst && currentInst.version) { 
            if (![...sel.options].some(o => o.value === currentInst.version)) {
                sel.appendChild(new Option(currentInst.version, currentInst.version));
            }
            sel.value = currentInst.version; 
        } 
    }));
    
    unsubs.push(window.api.on('status', (msg) => { 
        const el = document.getElementById('statusText'); 
        if (el) {
            if (!msg.includes('ПОМИЛКА') && !msg.includes('помилка')) {
                el.style.color = '';
            }
            el.textContent = msg; 
        }
        const match = msg.match(/(\d+)%/); 
        const progressBar = document.getElementById('progressBar');
        if (match && progressBar) progressBar.style.width = `${match[1]}%`; 
        if (msg && (msg.toLowerCase().includes('готовий') || msg.toLowerCase().includes('помилка') || msg.toLowerCase().includes('закрилася'))) {
            setInterfaceLock(false);
        }
    }));
    
    unsubs.push(window.api.on('sub-status', (msg) => { 
        const el = document.getElementById('subStatusText'); 
        if (el) {
            if (msg && msg.includes('помилка')) {
                el.style.color = '#e74c3c';
            } else {
                el.style.color = '';
            }
            el.textContent = msg; 
        }
    }));
    
    unsubs.push(window.api.on('skin-updated', (skin) => { 
        currentSkin = skin; 
        updateSkinPreview(); 
    }));
    
    unsubs.push(window.api.on('launch-error-details', (errorDetails) => {
        showDetailedError(errorDetails);
    }));
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}