// ============================================
// owner-passwords.js (ПОВНІСТЮ)
// ============================================
// ═══════════════════════════════════════════════════════
//  FL LAUNCHER — owner-passwords.js
//  Зберігання паролів овнера
//  ⚠️ ЗАВОДСЬКИЙ ПАРОЛЬ ВІДОМИЙ ТІЛЬКИ ТВОРЦЮ!
// ═══════════════════════════════════════════════════════

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// ============ КРИПТОГРАФІЧНИЙ КЛЮЧ ============
const MASTER_KEY = crypto.createHash('sha256')
    .update('fl-launcher-v1-secure-key-2026-owner-only')
    .digest();

const IV_LENGTH = 16;
const SALT_LENGTH = 32;

// ============ ЗАВОДСЬКИЙ ПАРОЛЬ (ТІЛЬКИ ТУТ!) ============
// ⚠️ НІКОМУ НЕ ПОКАЗУЙТЕ ЦЕЙ ПАРОЛЬ!
const FACTORY_MASTER_PASSWORD = 'hh7ub#&jd7n3k*F9xLm2!qRt5@Yp8$Wv4';

const FACTORY_PASSWORD_HASH = crypto.createHash('sha512')
    .update(FACTORY_MASTER_PASSWORD)
    .update(MASTER_KEY)
    .digest('hex');

console.log('[OWNER_PASS] Система захисту овнера ініціалізована');

function encrypt(text, customKey = null) {
    if (!text || typeof text !== 'string') {
        throw new Error('Invalid text for encryption');
    }
    const iv = crypto.randomBytes(IV_LENGTH);
    const salt = crypto.randomBytes(SALT_LENGTH);
    const key = customKey || MASTER_KEY;
    
    const cipher = crypto.createCipheriv('aes-256-cbc', key, iv);
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    
    return salt.toString('hex') + ':' + iv.toString('hex') + ':' + encrypted;
}

function decrypt(encryptedData, customKey = null) {
    if (!encryptedData || typeof encryptedData !== 'string') {
        throw new Error('Invalid encrypted data');
    }
    const parts = encryptedData.split(':');
    if (parts.length < 3) {
        throw new Error('Invalid encrypted data format');
    }
    
    const salt = Buffer.from(parts[0], 'hex');
    const iv = Buffer.from(parts[1], 'hex');
    const encryptedText = parts.slice(2).join(':');
    const key = customKey || MASTER_KEY;
    
    const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv);
    let decrypted = decipher.update(encryptedText, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
}

function getPasswordsPath() {
    let exePath = process.execPath;
    if (process.platform === 'win32' && exePath.endsWith('.exe')) {
        const dir = path.dirname(exePath);
        return path.join(dir, '.fl_owner_data');
    }
    return path.join(process.cwd(), '.fl_owner_data');
}

function isFactoryPassword(password) {
    if (!password || typeof password !== 'string') return false;
    const hash = crypto.createHash('sha512')
        .update(password)
        .update(MASTER_KEY)
        .digest('hex');
    return hash === FACTORY_PASSWORD_HASH;
}

function initializeOwnerData() {
    const filePath = getPasswordsPath();
    if (!fs.existsSync(filePath)) {
        console.log('[OWNER_PASS] Створення захищених даних овнера');
        const ownerData = {
            factoryPasswordHash: FACTORY_PASSWORD_HASH,
            isFactoryPasswordActive: true,
            passwords: []
        };
        saveOwnerData(ownerData);
        return true;
    }
    return false;
}

function loadOwnerData() {
    const filePath = getPasswordsPath();
    if (!fs.existsSync(filePath)) {
        initializeOwnerData();
        return { factoryPasswordHash: FACTORY_PASSWORD_HASH, isFactoryPasswordActive: true, passwords: [] };
    }
    try {
        const encrypted = fs.readFileSync(filePath, 'utf8');
        if (!encrypted || encrypted.trim().length === 0) {
            return { factoryPasswordHash: FACTORY_PASSWORD_HASH, isFactoryPasswordActive: true, passwords: [] };
        }
        const decrypted = decrypt(encrypted);
        const parsed = JSON.parse(decrypted);
        return {
            factoryPasswordHash: parsed.factoryPasswordHash || FACTORY_PASSWORD_HASH,
            isFactoryPasswordActive: parsed.isFactoryPasswordActive !== false,
            currentPasswordHash: parsed.currentPasswordHash,
            passwords: Array.isArray(parsed.passwords) ? parsed.passwords : []
        };
    } catch (err) {
        console.error('[OWNER_PASS] Помилка завантаження:', err);
        return { factoryPasswordHash: FACTORY_PASSWORD_HASH, isFactoryPasswordActive: true, passwords: [] };
    }
}

function saveOwnerData(data) {
    try {
        if (!data || typeof data !== 'object') {
            throw new Error('Invalid data for saving');
        }
        const filePath = getPasswordsPath();
        const encrypted = encrypt(JSON.stringify(data));
        fs.writeFileSync(filePath, encrypted, 'utf8');
        return true;
    } catch (err) {
        console.error('[OWNER_PASS] Помилка збереження:', err);
        return false;
    }
}

function checkMasterPassword(password) {
    if (!password || typeof password !== 'string') {
        return false;
    }
    
    const data = loadOwnerData();
    
    if (data.isFactoryPasswordActive && isFactoryPassword(password)) {
        console.log('[OWNER_PASS] Успішний вхід з заводським паролем');
        return true;
    }
    
    if (!data.isFactoryPasswordActive && data.currentPasswordHash) {
        const inputHash = crypto.createHash('sha512')
            .update(password)
            .update(MASTER_KEY)
            .digest('hex');
        
        if (inputHash === data.currentPasswordHash) {
            return true;
        }
    }
    
    return false;
}

function changeMasterPassword(oldPassword, newPassword) {
    if (!checkMasterPassword(oldPassword)) {
        return { success: false, error: 'Старий пароль невірний' };
    }
    
    if (!newPassword || newPassword.length < 8) {
        return { success: false, error: 'Новий пароль має бути не менше 8 символів' };
    }
    
    const data = loadOwnerData();
    data.currentPasswordHash = crypto.createHash('sha512')
        .update(newPassword)
        .update(MASTER_KEY)
        .digest('hex');
    data.isFactoryPasswordActive = false;
    delete data.factoryPasswordHash;
    
    saveOwnerData(data);
    return { success: true };
}

function isUsingFactoryPassword() {
    const data = loadOwnerData();
    return data.isFactoryPasswordActive === true;
}

function addPassword(service, username, password) {
    if (!service || !username || !password) {
        console.error('[OWNER_PASS] Missing required fields for addPassword');
        return false;
    }
    
    const data = loadOwnerData();
    const encryptedPassword = encrypt(password);
    data.passwords = data.passwords.filter(p => p.service !== service);
    data.passwords.push({ 
        service: String(service), 
        username: String(username), 
        password: encryptedPassword,
        createdAt: new Date().toISOString() 
    });
    return saveOwnerData(data);
}

function getPasswords() {
    const data = loadOwnerData();
    return (data.passwords || []).map(p => ({
        service: p.service,
        username: p.username,
        password: decrypt(p.password),
        createdAt: p.createdAt
    }));
}

function deletePassword(service) {
    if (!service) return false;
    
    const data = loadOwnerData();
    data.passwords = data.passwords.filter(p => p.service !== service);
    return saveOwnerData(data);
}

function isMasterPasswordSet() {
    return true;
}

module.exports = {
    checkMasterPassword,
    addPassword,
    getPasswords,
    deletePassword,
    isMasterPasswordSet,
    changeMasterPassword,
    isUsingFactoryPassword
};