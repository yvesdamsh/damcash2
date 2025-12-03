import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

export default async function handler(req) {
    const base44 = createClientFromRequest(req);
    const { timeframe, gameType, metric } = await req.json(); // timeframe: 'all_time'|'daily'|'weekly'|'monthly', gameType: 'checkers'|'chess', metric: 'elo'|'wins'|'tournament_wins'

    try {
        // 1. ELO Leaderboard (Only meaningful for All Time - Current Standing)
        if (metric === 'elo') {
            const sortField = gameType === 'chess' ? '-elo_chess' : '-elo_checkers';
            const users = await base44.asServiceRole.entities.User.list(sortField, 50);
            
            const results = users.map(u => ({
                id: u.id,
                username: u.username || u.full_name || u.created_by.split('@')[0],
                avatar_url: u.avatar_url,
                value: gameType === 'chess' ? (u.elo_chess || 1200) : (u.elo_checkers || 1200),
                games_played: u.games_played || 0
            }));
            
            // Sort again just in case (client side sort is robust)
            return Response.json(results.sort((a, b) => b.value - a.value));
        }

        // 2. Wins / Tournament Wins (Timeframe based)
        let sinceDate = null;
        const now = new Date();
        if (timeframe === 'daily') sinceDate = new Date(now.setDate(now.getDate() - 1));
        else if (timeframe === 'weekly') sinceDate = new Date(now.setDate(now.getDate() - 7));
        else if (timeframe === 'monthly') sinceDate = new Date(now.setDate(now.getDate() - 30));

        const resultsMap = {}; // userId -> { count, userDetails }

        if (metric === 'wins') {
            // Fetch Games
            let filters = { status: 'finished' };
            if (gameType) filters.game_type = gameType;
            
            // Base44 filter doesn't support complex date operators directly in simple filter object mostly, 
            // but usually we can fetch and filter or use sort.
            // For scale, we'd use a better query. Here we fetch recent finished games.
            // We'll fetch last 500 games or so? 
            // If 'all_time', we might use User.wins_checkers directly for efficiency.
            
            if (timeframe === 'all_time') {
                const users = await base44.asServiceRole.entities.User.list();
                const field = gameType === 'chess' ? 'wins_chess' : 'wins_checkers';
                return Response.json(users
                    .map(u => ({
                        id: u.id,
                        username: u.username || u.full_name || u.created_by.split('@')[0],
                        avatar_url: u.avatar_url,
                        value: u[field] || 0
                    }))
                    .sort((a, b) => b.value - a.value)
                    .slice(0, 50)
                );
            }

            // For periods, we must aggregate games
            // Fetch games sorted by updated_date descending
            const games = await base44.asServiceRole.entities.Game.filter(filters, '-updated_date', 500);
            
            for (const game of games) {
                if (sinceDate && new Date(game.updated_date) < sinceDate) break; // Stop if passed date
                if (!game.winner_id) continue;

                if (!resultsMap[game.winner_id]) {
                    resultsMap[game.winner_id] = { count: 0, name: game.winner_id === game.white_player_id ? game.white_player_name : game.black_player_name };
                }
                resultsMap[game.winner_id].count++;
            }

        } else if (metric === 'tournament_wins') {
             // Tournaments
             const tournaments = await base44.asServiceRole.entities.Tournament.filter({ status: 'finished' }, '-end_date', 100);
             
             for (const t of tournaments) {
                 if (gameType && t.game_type !== gameType) continue;
                 if (sinceDate && new Date(t.end_date) < sinceDate) continue;
                 if (!t.winner_id) continue;

                 if (!resultsMap[t.winner_id]) {
                     resultsMap[t.winner_id] = { count: 0, name: 'Joueur' }; // We might need to fetch user name if not stored
                 }
                 resultsMap[t.winner_id].count++;
             }
        }

        // Enhance with user details
        const userIds = Object.keys(resultsMap);
        const finalResults = [];
        
        // Fetch only needed users for performance (or just rely on full list if cached/small)
        // For now, fetch all is simpler but let's try to be safe if many users
        // Actually we have filtered logic above, let's just use the ones we found in resultsMap
        
        const allUsers = await base44.asServiceRole.entities.User.list(); // Optimized: ideally filter by IDs but SDK limitation
        const userLookup = {};
        allUsers.forEach(u => userLookup[u.id] = u);

        userIds.forEach(uid => {
            const u = userLookup[uid];
            if (u) {
                 finalResults.push({
                    id: uid,
                    username: u.username || u.full_name || 'Joueur',
                    avatar_url: u.avatar_url,
                    value: resultsMap[uid].count,
                    badge_count: 0 // Will fill if needed
                 });
            }
        });

        // Sort by Value (Wins)
        return Response.json(finalResults.sort((a, b) => b.value - a.value).slice(0, 50));

    } catch (error) {
        return Response.json({ error: error.message }, { status: 500 });
    }
}

Deno.serve(handler);