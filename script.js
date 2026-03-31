// Formatting helpers
const formatNumber = (num) => {
    if (num >= 1000000000) return (num / 1000000000).toFixed(1) + 'B+';
    if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M+';
    if (num >= 1000) return (num / 1000).toFixed(1) + 'K+';
    return num.toLocaleString();
};

const formatFullNumber = (num) => {
    return num.toLocaleString();
};

// Global Discord Function
window.copyDiscord = function () {
    navigator.clipboard.writeText("jxhnamerica");
    alert("Discord ID copied to clipboard!");
};

// Fallback execution
const ROBLOX_USER_ID = 9296222240; // John America
const PORTFOLIO_GAMES = [
    { placeId: 136577413998809, role: 'Beta Tester', description: 'Tested mechanics and reported physics interaction bugs in flight mechanics during beta test.' }, // build plane
    { placeId: 109932080383306, role: 'Tester', description: 'Evaluated core gameplay loops during alpha test.' }, // Slap Brawl!
    { placeId: 124910815181368, role: 'Beta Tester', description: 'Tested and helped resolve visual bugs during testing phase, and gave advice to improve core gameplay loop' }, // [pillow]
    // { placeId: DevTest 91774484861138, role: 'Beta Tester', description: 'Tested and helped resolve visual bugs during testing phase, and gave advice to improve core gameplay loop' },
    { placeId: 109021167563361, role: 'Tester', description: 'Helped identify functional bugs during beta test.' } //Build a tree factory
];

const getProxiedUrl = (url) => {
    return `https://corsproxy.io/?url=${encodeURIComponent(url)}`;
};

async function runClientFallback() {
    try {
        console.warn("SSG Pre-rendering not detected. Running Client-Side fallback...");

        // Resolve any placeIds to universeIds first
        await Promise.all(PORTFOLIO_GAMES.map(async (g) => {
            if (g.placeId && !g.universeId) {
                try {
                    const uRes = await fetch(getProxiedUrl(`https://apis.roblox.com/universes/v1/places/${g.placeId}/universe`));
                    if (uRes.ok) {
                        const uData = await uRes.json();
                        g.universeId = uData.universeId;
                    }
                } catch (e) {
                    // Ignore fail
                }
            }
        }));

        const universeIds = PORTFOLIO_GAMES.map(g => g.universeId).filter(Boolean).join(',');

        // Execute API Fetches
        const [userRes, avatarRes, detailsRes, iconsRes, votesRes] = await Promise.all([
            fetch(getProxiedUrl(`https://users.roblox.com/v1/users/${ROBLOX_USER_ID}`)),
            fetch(getProxiedUrl(`https://thumbnails.roblox.com/v1/users/avatar-headshot?userIds=${ROBLOX_USER_ID}&size=420x420&format=Png&isCircular=true`)),
            fetch(getProxiedUrl(`https://games.roblox.com/v1/games?universeIds=${universeIds}`)),
            fetch(getProxiedUrl(`https://thumbnails.roblox.com/v1/games/icons?universeIds=${universeIds}&returnPolicy=PlaceHolder&size=512x512&format=Png&isCircular=false`)),
            fetch(getProxiedUrl(`https://games.roblox.com/v1/games/votes?universeIds=${universeIds}`))
        ]);

        const detailsData = await detailsRes.json();
        const iconsData = await iconsRes.json();
        const votesData = await votesRes.json();
        const userData = await userRes.json();
        const avatarData = await avatarRes.json();

        // Populate User Info
        if (userData.name) document.getElementById('robloxUsername').textContent = userData.name;
        if (userData.displayName) document.getElementById('robloxDisplayName').textContent = `@${userData.displayName}`;
        if (avatarData.data && avatarData.data.length > 0) {
            const img = document.getElementById('userAvatar');
            img.src = avatarData.data[0].imageUrl;
            img.classList.remove('loading-shimmer');
        }

        // Fetch Group data for Group-created games
        const groupDetailsMap = {};
        await Promise.all((detailsData.data || []).map(async (game) => {
            if (game.creator.type === 'Group') {
                try {
                    const groupRes = await fetch(getProxiedUrl(`https://groups.roblox.com/v1/groups/${game.creator.id}`));
                    const groupData = await groupRes.json();
                    groupDetailsMap[game.id] = groupData;
                } catch (e) {
                    // Ignore group fetch fail
                }
            }
        }));

        // Merge Game Data
        let gamesData = (detailsData.data || []).map(game => {
            const iconObj = iconsData.data.find(icon => icon.targetId === game.id);
            const voteObj = votesData.data.find(vote => vote.id === game.id);
            const config = PORTFOLIO_GAMES.find(g => g.universeId === game.id) || {};
            return {
                ...game,
                iconUrl: iconObj ? iconObj.imageUrl : '',
                likes: voteObj ? voteObj.upVotes : 0,
                role: config.role || 'QA',
                description: config.description || '',
                groupDetails: groupDetailsMap[game.id] || null
            };
        });

        // Sort descending visits
        gamesData.sort((a, b) => b.visits - a.visits);

        let grandTotalVisits = gamesData.reduce((sum, game) => sum + game.visits, 0);
        document.getElementById('grandTotalVisits').textContent = formatFullNumber(grandTotalVisits);

        const gamesTestedElem = document.getElementById('grandTotalGames');
        if (gamesTestedElem) {
            gamesTestedElem.textContent = PORTFOLIO_GAMES.length;
        }

        // Render HTML Cards manually on client
        const grid = document.getElementById('gamesGrid');
        const fragment = document.createDocumentFragment();

        gamesData.forEach((game, index) => {
            const card = document.createElement('div');
            card.className = 'game-card';
            card.onclick = () => window.open(`https://www.roblox.com/games/${game.rootPlaceId}`, '_blank');
            card.style.cursor = 'pointer';

            let creatorHtml = '';
            if (game.creator.type === 'Group') {
                const groupVerified = ((game.groupDetails && game.groupDetails.hasVerifiedBadge) || game.creator.hasVerifiedBadge)
                    ? '<i class="fas fa-check-circle verified-icon" title="Verified Group"></i>' : '';
                let ownerHtml = '';
                if (game.groupDetails && game.groupDetails.owner) {
                    const ownerVerified = game.groupDetails.owner.hasVerifiedBadge
                        ? '<i class="fas fa-check-circle verified-icon" title="Verified Creator"></i>' : '';
                    ownerHtml = `<div class="creator-sub">By: ${game.groupDetails.owner.username} ${ownerVerified}</div>`;
                }
                creatorHtml = `<div class="creator-tag"><i class="fas fa-users"></i> ${game.creator.name} ${groupVerified}${ownerHtml}</div>`;
            } else {
                const verifiedTag = game.creator.hasVerifiedBadge
                    ? '<i class="fas fa-check-circle verified-icon" title="Verified Creator"></i>' : '';
                creatorHtml = `<div class="creator-tag"><i class="fas fa-user"></i> ${game.creator.name} ${verifiedTag}</div>`;
            }

            const descriptionHtml = game.description ? `<div class="contribution-desc">${game.description}</div>` : '';

            card.innerHTML = `
                <div class="game-icon-wrapper">
                    <img src="${game.iconUrl}" alt="${game.name} Icon" class="game-icon" loading="lazy">
                    <div class="qa-role-badge"><i class="fas fa-hammer"></i> ${game.role}</div>
                </div>
                <div class="game-info">
                    <h3 class="game-title" title="${game.name}">${game.name}</h3>
                    ${creatorHtml}
                    ${descriptionHtml}
                    <div class="metrics-grid">
                        <div class="metric"><span class="metric-label"><i class="fas fa-globe-americas" style="color:var(--crimson-red)"></i> Visits</span><span class="metric-value">${formatNumber(game.visits)}</span></div>
                        <div class="metric"><span class="metric-label"><i class="fas fa-users" style="color:#1d9bf0"></i> Playing</span><span class="metric-value">${formatNumber(game.playing)}</span></div>
                        <div class="metric"><span class="metric-label"><i class="fas fa-thumbs-up" style="color:#00b894"></i> Likes</span><span class="metric-value">${formatNumber(game.likes)}</span></div>
                        <div class="metric"><span class="metric-label"><i class="fas fa-star" style="color:#fdcb6e"></i> Favorites</span><span class="metric-value">${formatNumber(game.favoritedCount)}</span></div>
                    </div>
                </div>
            `;
            fragment.appendChild(card);
        });

        grid.innerHTML = '';
        grid.appendChild(fragment);

    } catch (e) {
        console.error("Client fallback completely failed:", e);
        document.getElementById('gamesGrid').innerHTML = `<p style="color:red; text-align:center;">Error loading live metrics. Please try again later.</p>`;
    }
}

// Bootstrap
document.addEventListener('DOMContentLoaded', () => {
    // If the HTML explicitly says 'Loading...', it means GitHub Actions failed to natively pre-render the data 
    // (or you're developing locally). We fall back to old client-side fetching as a bulletproof safety net!
    const testVisits = document.getElementById('grandTotalVisits');
    if (testVisits && testVisits.textContent.includes('Loading')) {
        runClientFallback();
    }
});
