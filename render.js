/*
 * Shared rendering + data-merging module.
 * Loaded by scripts/build-data.js (Node, build time) and by the browser
 * (via <script src="render.js">) so the card markup only exists here.
 */
(function (root, factory) {
    if (typeof module === 'object' && module.exports) {
        module.exports = factory();
    } else {
        root.PortfolioRender = factory();
    }
})(typeof self !== 'undefined' ? self : this, function () {
    'use strict';

    var NDA_ICON_URL = 'https://img.icons8.com/ios-filled/200/ffffff/lock.png';

    // Every string that originates from the Roblox API goes through here
    // before being placed into HTML (element content AND attribute values).
    var escapeHtml = function (value) {
        return String(value == null ? '' : value).replace(/[&<>"']/g, function (ch) {
            return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch];
        });
    };

    var formatNumber = function (num) {
        num = Number(num) || 0;
        if (num >= 1e9) return (num / 1e9).toFixed(1) + 'B+';
        if (num >= 1e6) return (num / 1e6).toFixed(1) + 'M+';
        if (num >= 1e3) return (num / 1e3).toFixed(1) + 'K+';
        return num.toLocaleString('en-US');
    };

    var formatFullNumber = function (num) {
        return (Number(num) || 0).toLocaleString('en-US');
    };

    // Combines the games.json config with the raw Roblox API payloads
    // (details, icons, votes, group lookups) into render-ready objects.
    var mergeGamesData = function (configGames, detailsData, iconsData, votesData, groupDetailsMap) {
        groupDetailsMap = groupDetailsMap || {};

        var games = (detailsData.data || []).map(function (game) {
            var icon = (iconsData.data || []).find(function (i) { return i.targetId === game.id; });
            var vote = (votesData.data || []).find(function (v) { return v.id === game.id; });
            var cfg = configGames.find(function (g) { return g.universeId === game.id; }) || {};
            return Object.assign({}, game, {
                iconUrl: icon ? icon.imageUrl : '',
                likes: vote ? vote.upVotes : 0,
                role: cfg.role || 'QA Tester',
                category: cfg.category || 'commissioned',
                isNDA: false,
                description: cfg.description || '',
                groupDetails: groupDetailsMap[game.id] || null
            });
        }).concat(configGames.filter(function (g) { return g.isNDA; }).map(function (g) {
            return {
                name: 'Unannounced Project',
                creator: { name: 'Undisclosed' },
                isNDA: true,
                role: g.role,
                category: g.category,
                description: g.description,
                visits: 0, playing: 0, likes: 0, favoritedCount: 0,
                iconUrl: NDA_ICON_URL
            };
        }));

        games.sort(function (a, b) { return b.visits - a.visits; });
        return games;
    };

    var verifiedIcon = function (title) {
        return ' <i class="fas fa-check-circle verified-icon" title="' + title + '"></i>';
    };

    var buildCreatorHtml = function (game) {
        var creator = game.creator || {};
        var name = escapeHtml(creator.name);
        if (creator.type === 'Group') {
            var groupVerified = ((game.groupDetails && game.groupDetails.hasVerifiedBadge) || creator.hasVerifiedBadge)
                ? verifiedIcon('Verified Group') : '';
            var ownerHtml = '';
            if (game.groupDetails && game.groupDetails.owner) {
                var ownerVerified = game.groupDetails.owner.hasVerifiedBadge ? verifiedIcon('Verified Creator') : '';
                ownerHtml = '<div class="creator-sub">By: ' + escapeHtml(game.groupDetails.owner.username) + ownerVerified + '</div>';
            }
            return '<div class="creator-tag"><i class="fas fa-users"></i> ' + name + groupVerified + ownerHtml + '</div>';
        }
        var verified = creator.hasVerifiedBadge ? verifiedIcon('Verified Creator') : '';
        return '<div class="creator-tag"><i class="fas fa-user"></i> ' + name + verified + '</div>';
    };

    var METRICS = [
        { key: 'visits', label: 'Visits', icon: 'fa-globe-americas', colorClass: 'mi-visits' },
        { key: 'playing', label: 'Playing', icon: 'fa-users', colorClass: 'mi-playing' },
        { key: 'likes', label: 'Likes', icon: 'fa-thumbs-up', colorClass: 'mi-likes' },
        { key: 'favoritedCount', label: 'Favorites', icon: 'fa-star', colorClass: 'mi-favorites' }
    ];

    var buildMetricsHtml = function (game) {
        return METRICS.map(function (m) {
            return '<div class="metric">'
                + '<span class="metric-label"><i class="fas ' + m.icon + ' ' + m.colorClass + '"></i> ' + m.label + '</span>'
                + '<span class="metric-value">' + (game.isNDA ? 'N/A' : formatNumber(game[m.key])) + '</span>'
                + '</div>';
        }).join('\n');
    };

    var buildGameCardHtml = function (game) {
        var name = escapeHtml(game.name);
        var inner = '<div class="game-icon-wrapper">'
            + '<img src="' + escapeHtml(game.iconUrl || NDA_ICON_URL) + '" alt="' + name + ' icon" class="game-icon" loading="lazy">'
            + '<div class="qa-role-badge"><i class="fas fa-hammer"></i> ' + escapeHtml(game.role) + '</div>'
            + '</div>'
            + '<div class="game-info">'
            + '<h3 class="game-title" title="' + name + '">' + name + '</h3>'
            + buildCreatorHtml(game)
            + (game.description ? '<div class="contribution-desc">' + escapeHtml(game.description) + '</div>' : '')
            + '<div class="metrics-grid">' + buildMetricsHtml(game) + '</div>'
            + '</div>';

        if (game.isNDA) {
            return '<div class="game-card nda" data-category="' + escapeHtml(game.category) + '">' + inner + '</div>';
        }
        // Real anchors (instead of window.open) keep middle-click, ctrl+click,
        // keyboard focus and link previews working.
        return '<a class="game-card" data-category="' + escapeHtml(game.category) + '"'
            + ' href="https://www.roblox.com/games/' + encodeURIComponent(game.rootPlaceId) + '"'
            + ' target="_blank" rel="noopener noreferrer">' + inner + '</a>';
    };

    var buildGamesHtml = function (games) {
        return games.map(buildGameCardHtml).join('\n');
    };

    return {
        NDA_ICON_URL: NDA_ICON_URL,
        escapeHtml: escapeHtml,
        formatNumber: formatNumber,
        formatFullNumber: formatFullNumber,
        mergeGamesData: mergeGamesData,
        buildGamesHtml: buildGamesHtml
    };
});
