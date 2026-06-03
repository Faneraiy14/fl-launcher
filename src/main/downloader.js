async function getVersions() {
    // Встановлюємо таймаут 10 секунд за допомогою AbortController
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);

    try {
        const res = await fetch('https://launchermeta.mojang.com/mc/game/version_manifest.json', {
            headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' },
            signal: controller.signal
        });
        
        clearTimeout(timeoutId); // Скасовуємо таймаут, оскільки запит успішний
        
        if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
        
        const data = await res.json();
        
        // Гарантуємо, що дані мають правильний масив версій
        if (data && Array.isArray(data.versions)) {
            return data.versions;
        } else {
            throw new Error("Невірна структура даних від Mojang");
        }
    } catch (e) { 
        clearTimeout(timeoutId); // На всяк випадок очищуємо таймер при помилці
        if (e.name === 'AbortError') {
            console.error("Помилка: Запит до launchermeta.mojang.com скасовано через таймаут (10 сек).");
        } else {
            console.error("Помилка завантаження версій Майнкрафт:", e);
        }
        return []; 
    }
}

module.exports = { getVersions };
