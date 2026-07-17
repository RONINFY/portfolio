const fs = require('fs');
const path = require('path');
const {
    escapeHtml,
    formatFullNumber,
    mergeGamesData,
    buildGamesHtml
} = require('../render.js');

const ROOT = path.join(__dirname, '..');
const config = JSON.parse(fs.readFileSync(path.join(ROOT, 'games.json'), 'utf8'));
const ROBLOX_USER_ID = config.robloxUserId;
const PORTFOLIO_GAMES = config.games;

const fetchJson = async (url) => {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
    return res.json();
};

// Replaces the content between <!-- SSG:MARKER --> ... <!-- /SSG:MARKER -->.
// Uses a replacer function so '$' characters in game names can't corrupt output.
const injectBetween = (html, marker, replacement) => {
    const re = new RegExp(`(<!-- SSG:${marker} -->)[\\s\\S]*?(<!-- /SSG:${marker} -->)`);
    if (!re.test(html)) throw new Error(`SSG marker "${marker}" not found in index.html`);
    return html.replace(re, (_, open, close) => `${open}\n${replacement}\n${close}`);
};

async function fetchData() {
    console.log('Starting static data generation from Roblox APIs...');

    const result = {
        generatedAt: new Date().toISOString(),
        user: { name: 'John America', displayName: 'John America', avatarUrl: '' },
        games: [],
        grandTotalVisits: 0,
        gamesTested: PORTFOLIO_GAMES.length
    };

    // User profile + avatar are non-fatal: stale stats are worse than a missing avatar.
    try {
        const userData = await fetchJson(`https://users.roblox.com/v1/users/${ROBLOX_USER_ID}`);
        result.user.name = userData.name || result.user.name;
        result.user.displayName = userData.displayName || result.user.displayName;
    } catch (e) {
        console.warn('User profile fetch failed:', e.message);
    }
    try {
        const avatarData = await fetchJson(`https://thumbnails.roblox.com/v1/users/avatar-headshot?userIds=${ROBLOX_USER_ID}&size=420x420&format=Png&isCircular=true`);
        if (avatarData.data && avatarData.data.length > 0) {
            result.user.avatarUrl = avatarData.data[0].imageUrl || '';
        }
    } catch (e) {
        console.warn('Avatar fetch failed:', e.message);
    }

    // Resolve placeIds -> universeIds
    await Promise.all(PORTFOLIO_GAMES.map(async (g) => {
        if (!g.placeId || g.universeId) return;
        try {
            const uData = await fetchJson(`https://apis.roblox.com/universes/v1/places/${g.placeId}/universe`);
            g.universeId = uData.universeId;
        } catch (e) {
            console.warn(`Failed to resolve universe for place ${g.placeId}:`, e.message);
        }
    }));

    const resolved = PORTFOLIO_GAMES.filter((g) => g.universeId);
    const expected = PORTFOLIO_GAMES.filter((g) => g.placeId).length;
    if (resolved.length < expected) {
        console.warn(`Only ${resolved.length}/${expected} games resolved to universes.`);
    }

    const universeIds = resolved.map((g) => g.universeId).join(',');

    // Game details are fatal on failure: fetchJson throws on non-OK responses,
    // which fails the workflow and keeps the last good deployment live.
    const [detailsData, iconsData, votesData] = await Promise.all([
        fetchJson(`https://games.roblox.com/v1/games?universeIds=${universeIds}`),
        fetchJson(`https://thumbnails.roblox.com/v1/games/icons?universeIds=${universeIds}&returnPolicy=PlaceHolder&size=512x512&format=Png&isCircular=false`)
            .catch((e) => { console.warn('Icons fetch failed:', e.message); return { data: [] }; }),
        fetchJson(`https://games.roblox.com/v1/games/votes?universeIds=${universeIds}`)
            .catch((e) => { console.warn('Votes fetch failed:', e.message); return { data: [] }; })
    ]);

    const groupDetailsMap = {};
    await Promise.all((detailsData.data || []).map(async (game) => {
        if (!game.creator || game.creator.type !== 'Group') return;
        try {
            groupDetailsMap[game.id] = await fetchJson(`https://groups.roblox.com/v1/groups/${game.creator.id}`);
        } catch (e) {
            console.warn(`Group fetch failed for "${game.name}":`, e.message);
        }
    }));

    result.games = mergeGamesData(PORTFOLIO_GAMES, detailsData, iconsData, votesData, groupDetailsMap);
    result.grandTotalVisits = result.games.reduce((sum, game) => sum + (game.visits || 0), 0);

    if (!result.games.some((g) => !g.isNDA)) {
        throw new Error('Roblox APIs returned no game data — aborting so the last good deploy stays live.');
    }

    // data.json powers the client-side fallback (and local development).
    fs.writeFileSync(path.join(ROOT, 'data.json'), JSON.stringify(result, null, 2));

    // Pre-render into index.html between the SSG markers.
    const indexPath = path.join(ROOT, 'index.html');
    let indexHtml = fs.readFileSync(indexPath, 'utf8');

    if (result.user.avatarUrl) {
        const avatarUrl = escapeHtml(result.user.avatarUrl);
        indexHtml = injectBetween(indexHtml, 'AVATAR',
            `                <img id="userAvatar" src="${avatarUrl}" alt="John America's Roblox avatar" class="profile-avatar">`);
        indexHtml = injectBetween(indexHtml, 'OG_IMAGE',
            `    <meta property="og:image" content="${avatarUrl}">\n    <meta name="twitter:image" content="${avatarUrl}">`);
    }
    indexHtml = injectBetween(indexHtml, 'USERNAME',
        `                        <p id="robloxUsername">${escapeHtml(result.user.name)}</p>`);
    indexHtml = injectBetween(indexHtml, 'DISPLAY_NAME',
        `                        <span id="robloxDisplayName" class="sub-handle">@${escapeHtml(result.user.displayName)}</span>`);
    indexHtml = injectBetween(indexHtml, 'TOTAL_VISITS',
        `                        <span id="grandTotalVisits" class="value">${formatFullNumber(result.grandTotalVisits)}</span>`);
    indexHtml = injectBetween(indexHtml, 'TOTAL_GAMES',
        `                        <span id="grandTotalGames" class="value">${result.gamesTested}</span>`);
    indexHtml = injectBetween(indexHtml, 'GAMES_GRID', buildGamesHtml(result.games));

    fs.writeFileSync(indexPath, indexHtml);
    console.log(`Pre-rendered ${result.games.length} games (${result.grandTotalVisits.toLocaleString('en-US')} total visits) into index.html`);
}

fetchData().catch((e) => {
    console.error('Static data generation failed:', e);
    process.exit(1);
});
