// Configuration
const ROBLOX_USER_ID = 9296222240; // John America

// Portfolio Games List (Optimized with Universe IDs to save API roundtrips for static hosting)
const PORTFOLIO_GAMES = [
    { universeId: 9907858048, role: 'Beta Tester', description: 'Tested mechanics and reported physics interaction bugs in flight mechanics during beta test.' }, // Build Plane For Brainrots
    { universeId: 9092720426, role: 'Alpha Tester', description: 'Evaluated core gameplay loops during alpha test.' }, // Pillow Battles
    { universeId: 9898476119, role: 'Beta Tester', description: 'Tested and helped resolve visual bugs during beta test' }, // Build a Tree Factory
    { universeId: 9715827305, role: 'Beta Tester', description: 'Helped identify functional bugs during beta test.' } // shinjuku shenanagins 
];

// Proxy configuration to handle CORS issues cleanly
const getProxiedUrl = (url) => {
    // Use corsproxy.io as a reliable proxy since roproxy is frequently down/rate-limited
    return `https://corsproxy.io/?url=${encodeURIComponent(url)}`;
};

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

// Core Application Logic
class PortfolioApp {
    constructor() {
        this.gamesData = [];
        this.universeRoleMap = {};
        this.grandTotalVisits = 0;
        this.init();
    }

    async init() {
        await Promise.all([
            this.fetchUserProfile(),
            this.loadGamesData()
        ]);

        // Start auto-refresh interval (every 60 seconds)
        setInterval(() => {
            console.log("Auto-refreshing live data...");
            this.refreshGamesData();
        }, 60000);
    }

    async fetchUserProfile() {
        try {
            // Get user basic info
            const userRes = await fetch(getProxiedUrl(`https://users.roblox.com/v1/users/${ROBLOX_USER_ID}`));
            const userData = await userRes.json();

            // Get user avatar
            const avatarRes = await fetch(getProxiedUrl(`https://thumbnails.roblox.com/v1/users/avatar-headshot?userIds=${ROBLOX_USER_ID}&size=420x420&format=Png&isCircular=true`));
            const avatarData = await avatarRes.json();

            // Update UI
            if (userData.name) {
                document.getElementById('robloxUsername').textContent = userData.name;
                document.getElementById('robloxDisplayName').textContent = `@${userData.displayName}`;

                // Update glitch title to match display name if desired
                // document.querySelector('.glitch').textContent = userData.displayName.toUpperCase();
                // document.querySelector('.glitch').setAttribute('data-text', userData.displayName.toUpperCase());
            }

            if (avatarData.data && avatarData.data.length > 0) {
                const avatarUrl = avatarData.data[0].imageUrl;
                const avatarImg = document.getElementById('userAvatar');
                avatarImg.src = avatarUrl;
                avatarImg.classList.remove('loading-shimmer');
            }
        } catch (error) {
            console.error("Failed to load user profile:", error);
            document.getElementById('robloxUsername').textContent = "John America";
        }
    }

    async loadGamesData() {
        try {
            // Static Site Optimization: Use pre-cached Universe IDs to avoid CORS & proxy errors 
            // and eliminate one network sequentially chained trip.
            const universeIds = PORTFOLIO_GAMES.map((game) => {
                this.universeRoleMap[game.universeId] = game;
                return game.universeId;
            });

            const csvUniverses = universeIds.join(',');

            if (universeIds.length === 0) return;

            // Fetch game details, icons, and votes
            await this.fetchAndRenderGameMetrics(csvUniverses);

        } catch (error) {
            console.error("Failed to load games data:", error);
            document.getElementById('gamesGrid').innerHTML = `<p style="color:red; text-align:center;">Error loading live metrics. Please try again later.</p>`;
        }
    }

    async refreshGamesData() {
        const universeIds = Object.keys(this.universeRoleMap);
        if (universeIds.length === 0) return;

        const csvUniverses = universeIds.join(',');
        await this.fetchAndRenderGameMetrics(csvUniverses);
    }

    async fetchAndRenderGameMetrics(csvUniverses) {
        // Fetch Details, Icons, and Votes concurrently for faster load speeds
        const [detailsRes, iconsRes, votesRes] = await Promise.all([
            fetch(getProxiedUrl(`https://games.roblox.com/v1/games?universeIds=${csvUniverses}`)),
            fetch(getProxiedUrl(`https://thumbnails.roblox.com/v1/games/icons?universeIds=${csvUniverses}&returnPolicy=PlaceHolder&size=512x512&format=Png&isCircular=false`)),
            fetch(getProxiedUrl(`https://games.roblox.com/v1/games/votes?universeIds=${csvUniverses}`))
        ]);

        const [detailsData, iconsData, votesData] = await Promise.all([
            detailsRes.json(),
            iconsRes.json(),
            votesRes.json()
        ]);

        // Fetch Group data for Group-created games
        const groupDetailsMap = {};
        await Promise.all(detailsData.data.map(async (game) => {
            if (game.creator.type === 'Group') {
                try {
                    const groupRes = await fetch(getProxiedUrl(`https://groups.roblox.com/v1/groups/${game.creator.id}`));
                    const groupData = await groupRes.json();
                    groupDetailsMap[game.id] = groupData;
                } catch (e) {
                    console.error("Failed to fetch group info for", game.name);
                }
            }
        }));

        // Merge data
        this.gamesData = detailsData.data.map(game => {
            const iconObj = iconsData.data.find(icon => icon.targetId === game.id);
            const voteObj = votesData.data.find(vote => vote.id === game.id);
            const config = this.universeRoleMap[game.id] || {};
            return {
                ...game,
                iconUrl: iconObj ? iconObj.imageUrl : '',
                likes: voteObj ? voteObj.upVotes : 0,
                role: config.role || 'QA',
                description: config.description || '',
                groupDetails: groupDetailsMap[game.id] || null
            };
        });

        // Calculate Grand Total
        this.grandTotalVisits = this.gamesData.reduce((sum, game) => sum + game.visits, 0);

        // Sort by visits descending
        this.gamesData.sort((a, b) => b.visits - a.visits);

        this.updateUI();
    }

    updateUI() {
        // Update Grand Total with an animation
        const totalVisitsEl = document.getElementById('grandTotalVisits');
        totalVisitsEl.textContent = formatFullNumber(this.grandTotalVisits);

        // Render Cards with DocumentFragment for performance
        const grid = document.getElementById('gamesGrid');
        const fragment = document.createDocumentFragment();

        this.gamesData.forEach(game => {
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
                        <div class="metric">
                            <span class="metric-label"><i class="fas fa-globe-americas" style="color:var(--crimson-red)"></i> Visits</span>
                            <span class="metric-value">${formatNumber(game.visits)}</span>
                        </div>
                        <div class="metric">
                            <span class="metric-label"><i class="fas fa-users" style="color:#1d9bf0"></i> Playing</span>
                            <span class="metric-value">${formatNumber(game.playing)}</span>
                        </div>
                        <div class="metric">
                            <span class="metric-label"><i class="fas fa-thumbs-up" style="color:#00b894"></i> Likes</span>
                            <span class="metric-value">${formatNumber(game.likes)}</span>
                        </div>
                        <div class="metric">
                            <span class="metric-label"><i class="fas fa-star" style="color:#fdcb6e"></i> Favorites</span>
                            <span class="metric-value">${formatNumber(game.favoritedCount)}</span>
                        </div>
                    </div>
                </div>
            `;
            fragment.appendChild(card);
        });

        grid.innerHTML = ''; // Clear previous
        grid.appendChild(fragment); // Single DOM reflow append
    }
}

// Global functions
window.copyDiscord = function () {
    navigator.clipboard.writeText("jxhnamerica");
    alert("Discord ID copied to clipboard!");
};

// Boot strap
document.addEventListener('DOMContentLoaded', () => {
    new PortfolioApp();
});
