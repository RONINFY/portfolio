const fs = require('fs');
const path = require('path');

const ROBLOX_USER_ID = 9296222240; // John America

const PORTFOLIO_GAMES = [
    { universeId: 9907858048, role: 'Beta Tester', description: 'Tested mechanics and reported physics interaction bugs in flight mechanics during beta test.' },
    { universeId: 9092720426, role: 'Alpha Tester', description: 'Evaluated core gameplay loops during alpha test.' },
    { universeId: 9898476119, role: 'Beta Tester', description: 'Tested and helped resolve visual bugs during beta test' },
    { universeId: 9715827305, role: 'Beta Tester', description: 'Helped identify functional bugs during beta test.' }
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

        // Fetch Games Data
        const universeIds = PORTFOLIO_GAMES.map(g => g.universeId).join(',');
        
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
                description: config.description || '',
                groupDetails: groupDetailsMap[game.id] || null
            };
        });

        result.grandTotalVisits = result.games.reduce((sum, game) => sum + game.visits, 0);

        // Sort by visits descending
        result.games.sort((a, b) => b.visits - a.visits);

        // Write to data.json
        const outputPath = path.join(__dirname, '..', 'data.json');
        fs.writeFileSync(outputPath, JSON.stringify(result, null, 2));
        console.log(`Successfully generated static data at ${outputPath}`);
    } catch (e) {
        console.error('Failed processing data:', e);
        process.exit(1);
    }
}

fetchData();
