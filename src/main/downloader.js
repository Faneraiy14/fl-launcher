const axios = require('axios');
async function getVersions() {
    try {
        const res = await axios.get('https://launchermeta.mojang.com/mc/game/version_manifest.json');
        return res.data.versions;
    } catch (e) { return []; }
}
module.exports = { getVersions };