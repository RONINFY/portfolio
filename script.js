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
        this.grandTotalVisits = 0;
        this.init();
    }

    async init() {
        try {
            const res = await fetch('./data.json');
            if (res.ok) {
                const data = await res.json();
                
                // Update User UI
                if (data.user.name) {
                    document.getElementById('robloxUsername').textContent = data.user.name;
                }
                if (data.user.displayName) {
                    document.getElementById('robloxDisplayName').textContent = `@${data.user.displayName}`;
                }
                
                if (data.user.avatarUrl) {
                    const avatarImg = document.getElementById('userAvatar');
                    avatarImg.src = data.user.avatarUrl;
                    avatarImg.classList.remove('loading-shimmer');
                }

                // Update Games Data
                this.gamesData = data.games || [];
                this.grandTotalVisits = data.grandTotalVisits || 0;
                
                this.updateUI();
            } else {
                throw new Error("data.json not found");
            }
        } catch (error) {
            console.error("Failed to load static data:", error);
            document.getElementById('gamesGrid').innerHTML = `<p style="color:red; text-align:center;">Error loading live metrics. Please try again later.</p>`;
        }
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
