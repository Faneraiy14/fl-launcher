const { ipcRenderer } = require('electron');

window.addEventListener('DOMContentLoaded', async () => {
    const versions = await ipcRenderer.invoke('get-versions');
    const select = document.getElementById('versionSelect');
    versions.filter(v => v.type === 'release').forEach(v => {
        let opt = document.createElement('option');
        opt.value = opt.text = v.id;
        select.appendChild(opt);
    });
});

document.getElementById('playBtn').addEventListener('click', () => {
    ipcRenderer.send('launch-game', {
        username: document.getElementById('username').value,
        version: document.getElementById('versionSelect').value
    });
});

ipcRenderer.on('download-progress', (event, progress) => {
    document.getElementById('progressContainer').style.display = 'block';
    document.getElementById('progressBar').value = progress;
    document.getElementById('statusText').innerText = `Завантаження: ${progress}%`;
});