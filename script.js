// ============================================================
//  MAINTENANCE MODE  —  set to 1 to show the maintenance page
//                       set to 0 to show the normal site
// ============================================================
const MAINTENANCE_MODE = 0;

const DISCORD_HANDLE = 'jxhnamerica';
const R = window.PortfolioRender;

// ------------------------------------------------------------
//  Data hydration
//  Normally GitHub Actions pre-renders everything into the HTML.
//  If the markers still say "Loading", we fall back to:
//    1. data.json (written by the same build script), then
//    2. live Roblox APIs through a CORS proxy (local dev safety net).
// ------------------------------------------------------------
const getProxiedUrl = (url) => `https://corsproxy.io/?url=${encodeURIComponent(url)}`;

const fetchJson = async (url) => {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
    return res.json();
};

function applyData(data) {
    const user = data.user || {};
    if (user.avatarUrl) document.getElementById('userAvatar').src = user.avatarUrl;
    if (user.name) document.getElementById('robloxUsername').textContent = user.name;
    if (user.displayName) document.getElementById('robloxDisplayName').textContent = `@${user.displayName}`;

    const games = data.games || [];
    const totalVisits = games.reduce((sum, g) => sum + (g.visits || 0), 0);
    document.getElementById('grandTotalVisits').textContent = R.formatFullNumber(totalVisits);
    document.getElementById('grandTotalGames').textContent = data.gamesTested || games.length;
    document.getElementById('gamesGrid').innerHTML = R.buildGamesHtml(games);
}

async function hydrateFromStaticData() {
    applyData(await fetchJson('data.json'));
}

async function hydrateFromLiveApis() {
    const config = await fetchJson('games.json');
    const portfolioGames = config.games;
    const userId = config.robloxUserId;

    await Promise.all(portfolioGames.map(async (g) => {
        if (!g.placeId || g.universeId) return;
        try {
            const uData = await fetchJson(getProxiedUrl(`https://apis.roblox.com/universes/v1/places/${g.placeId}/universe`));
            g.universeId = uData.universeId;
        } catch (e) {
            console.warn(`Failed to resolve universe for place ${g.placeId}`);
        }
    }));

    const universeIds = portfolioGames.map((g) => g.universeId).filter(Boolean).join(',');

    const [userData, avatarData, detailsData, iconsData, votesData] = await Promise.all([
        fetchJson(getProxiedUrl(`https://users.roblox.com/v1/users/${userId}`)).catch(() => ({})),
        fetchJson(getProxiedUrl(`https://thumbnails.roblox.com/v1/users/avatar-headshot?userIds=${userId}&size=420x420&format=Png&isCircular=true`)).catch(() => ({ data: [] })),
        fetchJson(getProxiedUrl(`https://games.roblox.com/v1/games?universeIds=${universeIds}`)),
        fetchJson(getProxiedUrl(`https://thumbnails.roblox.com/v1/games/icons?universeIds=${universeIds}&returnPolicy=PlaceHolder&size=512x512&format=Png&isCircular=false`)).catch(() => ({ data: [] })),
        fetchJson(getProxiedUrl(`https://games.roblox.com/v1/games/votes?universeIds=${universeIds}`)).catch(() => ({ data: [] }))
    ]);

    const groupDetailsMap = {};
    await Promise.all((detailsData.data || []).map(async (game) => {
        if (!game.creator || game.creator.type !== 'Group') return;
        try {
            groupDetailsMap[game.id] = await fetchJson(getProxiedUrl(`https://groups.roblox.com/v1/groups/${game.creator.id}`));
        } catch (e) {
            console.warn(`Group fetch failed for "${game.name}"`);
        }
    }));

    applyData({
        user: {
            name: userData.name,
            displayName: userData.displayName,
            avatarUrl: (avatarData.data && avatarData.data[0] && avatarData.data[0].imageUrl) || ''
        },
        games: R.mergeGamesData(portfolioGames, detailsData, iconsData, votesData, groupDetailsMap),
        gamesTested: portfolioGames.length
    });
}

async function hydrate() {
    try {
        await hydrateFromStaticData();
        return;
    } catch (e) {
        console.warn('data.json unavailable, falling back to live Roblox APIs...');
    }
    try {
        await hydrateFromLiveApis();
    } catch (e) {
        console.error('Live API fallback failed:', e);
        document.getElementById('gamesGrid').innerHTML =
            '<p class="grid-error">Could not load live metrics. Please refresh in a moment.</p>';
    }
}

// ------------------------------------------------------------
//  Category filter (role cards)
// ------------------------------------------------------------
function setupFilters() {
    const roleCards = document.querySelectorAll('.role-card[data-filter]');
    const title = document.getElementById('portfolioTitle');
    const TITLES = { commissioned: 'QA Commissions', formal: 'QA Staff Roles' };

    const applyFilter = (category) => {
        document.querySelectorAll('.game-card').forEach((card) => {
            // '' restores the stylesheet value so flex cards don't become block
            card.style.display = (!category || card.dataset.category === category) ? '' : 'none';
        });
        roleCards.forEach((c) => {
            const active = c.dataset.filter === category;
            c.classList.toggle('active-filter', active);
            c.setAttribute('aria-pressed', String(active));
        });
        if (title) title.textContent = category ? TITLES[category] : 'Overall QA Portfolio';
    };

    roleCards.forEach((card) => {
        const toggle = () => applyFilter(card.classList.contains('active-filter') ? null : card.dataset.filter);
        card.addEventListener('click', toggle);
        card.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                toggle();
            }
        });
    });
}

// ------------------------------------------------------------
//  Discord copy button
// ------------------------------------------------------------
function setupCopyButton() {
    const btn = document.getElementById('copyDiscordBtn');
    if (!btn) return;
    const icon = btn.querySelector('i');
    let resetTimer;

    btn.addEventListener('click', async () => {
        try {
            await navigator.clipboard.writeText(DISCORD_HANDLE);
        } catch (e) {
            window.prompt('Copy my Discord handle:', DISCORD_HANDLE);
            return;
        }
        btn.classList.add('copied');
        icon.className = 'fas fa-check';
        clearTimeout(resetTimer);
        resetTimer = setTimeout(() => {
            btn.classList.remove('copied');
            icon.className = 'fas fa-copy';
        }, 2000);
    });
}

// ------------------------------------------------------------
//  Bootstrap
// ------------------------------------------------------------
document.addEventListener('DOMContentLoaded', () => {
    if (MAINTENANCE_MODE) {
        document.getElementById('maintenanceOverlay').style.display = 'flex';
        document.body.style.overflow = 'hidden';
        return;
    }

    setupFilters();
    setupCopyButton();

    const totals = document.getElementById('grandTotalVisits');
    if (totals && totals.textContent.includes('Loading')) {
        hydrate();
    }
});
