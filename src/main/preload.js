// ============================================
// preload.js (З ВСІМА КАНАЛАМИ)
// ============================================

const { contextBridge, ipcRenderer } = require('electron');

const SEND_CHANNELS = [
    'save-inst', 'del-inst', 'update-inst', 'launch',
    'show-about-dialog', 'check-for-updates',
    'save-custom-skin', 'delete-custom-skin', 'update-skin',
    'delete-mod', 'install-local-mod',
    'open-skin-selector', 'open-mod-manager', 'open-owner-passwords',
    'open-game-folder', 'open-game-log',
    'owner-check-master', 'owner-add-password', 'owner-delete-password'
];

const INVOKE_CHANNELS = [
    'get-cfg', 'get-skins',
    'search-mods', 'get-mod-versions', 'download-mod', 'get-installed-mods',
    'choose-local-mod',
    'owner-get-passwords', 'owner-is-set', 'owner-is-using-factory', 'owner-change-password',
    'get-app-version'
];

const RECEIVE_CHANNELS = [
    'status', 'sub-status',
    'config-updated', 'init-versions-data',
    'updater-download-start', 'updater-download-progress',
    'skin-saved', 'skin-deleted', 'skin-updated',
    'mod-deleted', 'mod-installed',
    'instance-data',
    'owner-auth-result', 'owner-passwords-updated',
    'launch-error-details'
];

contextBridge.exposeInMainWorld('api', {
    send: (channel, data) => {
        if (SEND_CHANNELS.includes(channel)) {
            console.log(`[PRELOAD] SEND: ${channel}`, data);
            ipcRenderer.send(channel, data);
        } else {
            console.warn(`[PRELOAD] Заборонений send-канал: ${channel}`);
        }
    },
    invoke: async (channel, ...args) => {
        if (INVOKE_CHANNELS.includes(channel)) {
            console.log(`[PRELOAD] INVOKE: ${channel}`, args);
            return await ipcRenderer.invoke(channel, ...args);
        }
        console.warn(`[PRELOAD] Заборонений invoke-канал: ${channel}`);
        return null;
    },
    on: (channel, callback) => {
        if (RECEIVE_CHANNELS.includes(channel)) {
            const wrapped = (_event, ...args) => {
                console.log(`[PRELOAD] RECEIVE: ${channel}`, args);
                try {
                    callback(...args);
                } catch (err) {
                    console.error(`[PRELOAD] Callback error on ${channel}:`, err);
                }
            };
            ipcRenderer.on(channel, wrapped);
            return () => ipcRenderer.removeListener(channel, wrapped);
        }
        console.warn(`[PRELOAD] Заборонений receive-канал: ${channel}`);
        return () => {};
    },
    once: (channel, callback) => {
        if (RECEIVE_CHANNELS.includes(channel)) {
            ipcRenderer.once(channel, (_event, ...args) => {
                console.log(`[PRELOAD] ONCE: ${channel}`, args);
                try {
                    callback(...args);
                } catch (err) {
                    console.error(`[PRELOAD] Once callback error on ${channel}:`, err);
                }
            });
        }
    }
});

console.log('[PRELOAD] FL Launcher preload script loaded');