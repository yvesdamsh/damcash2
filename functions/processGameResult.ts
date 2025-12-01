import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

export default async function handler(req) {
    const base44 = createClientFromRequest(req);
    const { gameId } = await req.json();

    if (!gameId) return Response.json({ error: 'Missing gameId' }, { status: 400 });

    // Lock logic via check
    const game = await base44.asServiceRole.entities.Game.get(gameId);
    if (!game || game.status !== 'finished' || game.elo_processed) {
        return Response.json({ message: 'Game not finished or already processed' });
    }

    // Mark as processed immediately to avoid double run
    await base44.asServiceRole.entities.Game.update(gameId, { elo_processed: true });

    const whiteId = game.white_player_id;
    const blackId = game.black_player_id;
    const winnerId = game.winner_id;
    const type = game.game_type; // 'checkers' or 'chess'

    // 1. Update ELO
    if (whiteId && blackId && whiteId !== blackId) { // Don't rate solo games
        const [whiteUser, blackUser] = await Promise.all([
            base44.asServiceRole.entities.User.get(whiteId),
            base44.asServiceRole.entities.User.get(blackId)
        ]);

        if (whiteUser && blackUser) {
            const ratingA = type === 'chess' ? (whiteUser.elo_chess || 1200) : (whiteUser.elo_checkers || 1200);
            const ratingB = type === 'chess' ? (blackUser.elo_chess || 1200) : (blackUser.elo_checkers || 1200);
            
            const K = 32;
            const expectedA = 1 / (1 + Math.pow(10, (ratingB - ratingA) / 400));
            const expectedB = 1 / (1 + Math.pow(10, (ratingA - ratingB) / 400));
            
            let scoreA = 0.5;
            let scoreB = 0.5;
            if (winnerId === whiteId) { scoreA = 1; scoreB = 0; }
            else if (winnerId === blackId) { scoreA = 0; scoreB = 1; }
            
            const newRatingA = Math.round(ratingA + K * (scoreA - expectedA));
            const newRatingB = Math.round(ratingB + K * (scoreB - expectedB));
            
            // Update White
            const whiteUpdates = { games_played: (whiteUser.games_played || 0) + 1 };
            if (type === 'chess') {
                whiteUpdates.elo_chess = newRatingA;
                if (scoreA === 1) whiteUpdates.wins_chess = (whiteUser.wins_chess || 0) + 1;
                else if (scoreA === 0) whiteUpdates.losses_chess = (whiteUser.losses_chess || 0) + 1;
            } else {
                whiteUpdates.elo_checkers = newRatingA;
                if (scoreA === 1) whiteUpdates.wins_checkers = (whiteUser.wins_checkers || 0) + 1;
                else if (scoreA === 0) whiteUpdates.losses_checkers = (whiteUser.losses_checkers || 0) + 1;
            }
            await base44.asServiceRole.entities.User.update(whiteId, whiteUpdates);

            // Update Black
            const blackUpdates = { games_played: (blackUser.games_played || 0) + 1 };
            if (type === 'chess') {
                blackUpdates.elo_chess = newRatingB;
                if (scoreB === 1) blackUpdates.wins_chess = (blackUser.wins_chess || 0) + 1;
                else if (scoreB === 0) blackUpdates.losses_chess = (blackUser.losses_chess || 0) + 1;
            } else {
                blackUpdates.elo_checkers = newRatingB;
                if (scoreB === 1) blackUpdates.wins_checkers = (blackUser.wins_checkers || 0) + 1;
                else if (scoreB === 0) blackUpdates.losses_checkers = (blackUser.losses_checkers || 0) + 1;
            }
            await base44.asServiceRole.entities.User.update(blackId, blackUpdates);
        }
    }

    // 2. Update Tournament Scores if applicable
    if (game.tournament_id) {
        // Fetch participants
        const participants = await base44.asServiceRole.entities.TournamentParticipant.filter({
            tournament_id: game.tournament_id
        });
        
        const pWhite = participants.find(p => p.user_id === whiteId);
        const pBlack = participants.find(p => p.user_id === blackId);

        let pointsWhite = 0.5;
        let pointsBlack = 0.5;
        
        // Arena: Win=2, Draw=1, Loss=0 (As per previous prompt)
        // Swiss/Standard: Win=1, Draw=0.5, Loss=0 (Standard)
        const tournament = await base44.asServiceRole.entities.Tournament.get(game.tournament_id);
        
        if (tournament.format === 'arena') {
            if (winnerId === whiteId) { pointsWhite = 2; pointsBlack = 0; }
            else if (winnerId === blackId) { pointsWhite = 0; pointsBlack = 2; }
            else { pointsWhite = 1; pointsBlack = 1; } // Draw
        } else {
            // Swiss / Bracket
            if (winnerId === whiteId) { pointsWhite = 1; pointsBlack = 0; }
            else if (winnerId === blackId) { pointsWhite = 0; pointsBlack = 1; }
            else { pointsWhite = 0.5; pointsBlack = 0.5; }
        }

        if (pWhite) {
            await base44.asServiceRole.entities.TournamentParticipant.update(pWhite.id, {
                score: (pWhite.score || 0) + pointsWhite,
                games_played: (pWhite.games_played || 0) + 1,
                current_game_id: null // Free up for next pairing
            });
        }
        if (pBlack) {
            await base44.asServiceRole.entities.TournamentParticipant.update(pBlack.id, {
                score: (pBlack.score || 0) + pointsBlack,
                games_played: (pBlack.games_played || 0) + 1,
                current_game_id: null
            });
        }
    }

    return Response.json({ status: 'success', message: 'Elo and scores updated' });
}

Deno.serve(handler);