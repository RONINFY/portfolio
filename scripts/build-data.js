const fs = require('fs');
const path = require('path');

const ROBLOX_USER_ID = 9296222240; // John America

const PORTFOLIO_GAMES = [
    { placeId: 136577413998809, role: 'Beta Tester', category: 'commissioned', description: 'Tested mechanics and reported physics interaction bugs in flight mechanics during beta test.' }, // build plane
    { placeId: 109932080383306, role: 'Tester', category: 'commissioned', description: 'Evaluated core gameplay loops during alpha test.' }, // Slap Brawl!
    { placeId: 124910815181368, role: 'Beta Tester', category: 'commissioned', description: 'Tested and helped resolve visual bugs during testing phase, and gave advice to improve core gameplay loop' }, // [pillow]
    { placeId: 94702395375549, role: 'Trade Update Tester', category: 'commissioned', description: 'Tested and helped find bugs pertaining to the trading system before the official release of the trade update' },
    { placeId: 109021167563361, role: 'Tester', category: 'commissioned', description: 'Helped identify functional bugs during beta test.' }, //Build a tree factory
    { isNDA: true, role: 'Full-time Staff (NDA)', category: 'formal', description: 'Dedicated QA lead for a high-priority, unannounced project.' }
];

async function fetchData() {
    console.log('Starting static data generation for Roblox APIs...');
    const result = {
        user: { name: 'John America', displayName: 'John America', avatarUrl: '' },
        games: [],
        grandTotalVisits: 0
    };

    try {
        // Fetch User Profile
        const userRes = await fetch(`https://users.roblox.com/v1/users/${ROBLOX_USER_ID}`);
        if (userRes.ok) {
            const userData = await userRes.json();
            result.user.name = userData.name || result.user.name;
            result.user.displayName = userData.displayName || result.user.displayName;
        }

        // Fetch Avatar
        const avatarRes = await fetch(`https://thumbnails.roblox.com/v1/users/avatar-headshot?userIds=${ROBLOX_USER_ID}&size=420x420&format=Png&isCircular=true`);
        if (avatarRes.ok) {
            const avatarData = await avatarRes.json();
            if (avatarData.data && avatarData.data.length > 0) {
                result.user.avatarUrl = avatarData.data[0].imageUrl;
            }
        }

        // Resolve any placeIds to universeIds first
        await Promise.all(PORTFOLIO_GAMES.map(async (g) => {
            if (g.placeId && !g.universeId) {
                try {
                    const uRes = await fetch(`https://apis.roblox.com/universes/v1/places/${g.placeId}/universe`);
                    if (uRes.ok) {
                        const uData = await uRes.json();
                        g.universeId = uData.universeId;
                    }
                } catch (e) {
                    console.error("Failed to fetch universe ID for place", g.placeId);
                }
            }
        }));

        // Fetch Games Data
        const universeIds = PORTFOLIO_GAMES.map(g => g.universeId).filter(Boolean).join(',');

        const [detailsRes, iconsRes, votesRes] = await Promise.all([
            fetch(`https://games.roblox.com/v1/games?universeIds=${universeIds}`),
            fetch(`https://thumbnails.roblox.com/v1/games/icons?universeIds=${universeIds}&returnPolicy=PlaceHolder&size=512x512&format=Png&isCircular=false`),
            fetch(`https://games.roblox.com/v1/games/votes?universeIds=${universeIds}`)
        ]);

        const detailsData = detailsRes.ok ? await detailsRes.json() : { data: [] };
        const iconsData = iconsRes.ok ? await iconsRes.json() : { data: [] };
        const votesData = votesRes.ok ? await votesRes.json() : { data: [] };

        const groupDetailsMap = {};
        await Promise.all(detailsData.data.map(async (game) => {
            if (game.creator.type === 'Group') {
                try {
                    const groupRes = await fetch(`https://groups.roblox.com/v1/groups/${game.creator.id}`);
                    if (groupRes.ok) {
                        groupDetailsMap[game.id] = await groupRes.json();
                    }
                } catch (e) {
                    console.error("Failed to fetch group info for", game.name);
                }
            }
        }));

        result.games = detailsData.data.map(game => {
            const iconObj = iconsData.data.find(icon => icon.targetId === game.id);
            const voteObj = votesData.data.find(vote => vote.id === game.id);
            const config = PORTFOLIO_GAMES.find(g => g.universeId === game.id) || {};

            return {
                ...game,
                iconUrl: iconObj ? iconObj.imageUrl : '',
                likes: voteObj ? voteObj.upVotes : 0,
                role: config.role || 'QA',
                category: config.category || 'commissioned',
                isNDA: config.isNDA || false,
                description: config.description || '',
                groupDetails: groupDetailsMap[game.id] || null
            };
        }).concat(PORTFOLIO_GAMES.filter(g => g.isNDA).map(g => ({
            name: "[CLASSIFIED] Unannounced Project",
            creator: { name: "[REDACTED]" },
            isNDA: true,
            role: g.role,
            category: g.category,
            description: g.description,
            visits: 0, playing: 0, likes: 0, favoritedCount: 0,
            iconUrl: 'https://img.icons8.com/ios-filled/200/ffffff/lock.png'
        })));

        result.grandTotalVisits = result.games.reduce((sum, game) => sum + game.visits, 0);
        result.gamesTested = PORTFOLIO_GAMES.length;

        // Sort by visits descending
        result.games.sort((a, b) => b.visits - a.visits);

        const formatNumber = (num) => {
            if (num >= 1000000000) return (num / 1000000000).toFixed(1) + 'B+';
            if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M+';
            if (num >= 1000) return (num / 1000).toFixed(1) + 'K+';
            return num.toLocaleString();
        };

        const formatFullNumber = (num) => {
            return num.toLocaleString();
        };

        const buildGamesHtml = (gamesData) => {
            let result = '';
            gamesData.forEach((game) => {
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

                // Inject games natively with no animation delays because the DOM should instantly paint
                const onclickAttr = game.isNDA ? '' : `onclick="window.open('https://www.roblox.com/games/${game.rootPlaceId}', '_blank')"`;
                const styleAttr = game.isNDA ? 'opacity: 1; transform: translateY(0); animation: none;' : 'cursor: pointer; opacity: 1; transform: translateY(0); animation: none;';
                
                result += `
            <div class="game-card${game.isNDA ? ' nda' : ''}" data-category="${game.category}" ${onclickAttr} style="${styleAttr}">
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
                            <span class="metric-value">${game.isNDA ? 'N/A' : formatNumber(game.visits)}</span>
                        </div>
                        <div class="metric">
                            <span class="metric-label"><i class="fas fa-users" style="color:#1d9bf0"></i> Playing</span>
                            <span class="metric-value">${game.isNDA ? 'N/A' : formatNumber(game.playing)}</span>
                        </div>
                        <div class="metric">
                            <span class="metric-label"><i class="fas fa-thumbs-up" style="color:#00b894"></i> Likes</span>
                            <span class="metric-value">${game.isNDA ? 'N/A' : formatNumber(game.likes)}</span>
                        </div>
                        <div class="metric">
                            <span class="metric-label"><i class="fas fa-star" style="color:#fdcb6e"></i> Favorites</span>
                            <span class="metric-value">${game.isNDA ? 'N/A' : formatNumber(game.favoritedCount)}</span>
                        </div>
                    </div>
                </div>
            </div>
        `;
            });
            return result;
        };

        // ... inside fetchData where data mapping completes
        // Write to data.json (keep as backup)
        const jsonOutputPath = path.join(__dirname, '..', 'data.json');
        fs.writeFileSync(jsonOutputPath, JSON.stringify(result, null, 2));

        // Inject into index.html for TRUE Static generation
        const indexPath = path.join(__dirname, '..', 'index.html');
        let indexHtml = fs.readFileSync(indexPath, 'utf8');

        // Inject Avatar
        indexHtml = indexHtml.replace(
            /(<!-- SSG:AVATAR -->)[\s\S]*?(<!-- \/SSG:AVATAR -->)/g,
            `$1\n                <img id="userAvatar" src="${result.user.avatarUrl}" alt="John America Avatar" class="profile-avatar">\n                $2`
        );
        // Inject Username
        indexHtml = indexHtml.replace(
            /(<!-- SSG:USERNAME -->)[\s\S]*?(<!-- \/SSG:USERNAME -->)/g,
            `$1\n                        <p id="robloxUsername">${result.user.name}</p>\n                        $2`
        );
        // Inject Display Name
        indexHtml = indexHtml.replace(
            /(<!-- SSG:DISPLAY_NAME -->)[\s\S]*?(<!-- \/SSG:DISPLAY_NAME -->)/g,
            `$1\n                        <span id="robloxDisplayName" class="sub-handle">@${result.user.displayName}</span>\n                        $2`
        );
        // Inject Total Visits
        indexHtml = indexHtml.replace(
            /(<!-- SSG:TOTAL_VISITS -->)[\s\S]*?(<!-- \/SSG:TOTAL_VISITS -->)/g,
            `$1\n                    <span id="grandTotalVisits" class="value">${formatFullNumber(result.grandTotalVisits)}</span>\n                    $2`
        );
        // Inject Games Tested
        indexHtml = indexHtml.replace(
            /(<!-- SSG:TOTAL_GAMES -->)[\s\S]*?(<!-- \/SSG:TOTAL_GAMES -->)/g,
            `$1\n                        <span id="grandTotalGames" class="value">${result.gamesTested}</span>\n                        $2`
        );
        // Inject Games Grid
        indexHtml = indexHtml.replace(
            /(<!-- SSG:GAMES_GRID -->)[\s\S]*?(<!-- \/SSG:GAMES_GRID -->)/g,
            `$1\n                ${buildGamesHtml(result.games)}\n                $2`
        );

        fs.writeFileSync(indexPath, indexHtml);
        console.log(`Successfully generated static HTML at ${indexPath}`);
    } catch (e) {
        console.error('Failed processing data:', e);
        process.exit(1);
    }
}

fetchData();
