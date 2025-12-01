import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

// Minimal Init Logic
const initCheckers = () => {
    const board = Array(10).fill(null).map(() => Array(10).fill(0));
    for (let r = 0; r < 4; r++) {
        for (let c = 0; c < 10; c++) {
            if ((r + c) % 2 !== 0) board[r][c] = 2; // Black
        }
    }
    for (let r = 6; r < 10; r++) {
        for (let c = 0; c < 10; c++) {
            if ((r + c) % 2 !== 0) board[r][c] = 1; // White
        }
    }
    return board;
};

export default async function handler(req) {
    const base44 = createClientFromRequest(req);
    const { tournamentId } = await req.json();

    if (!tournamentId) return Response.json({ error: 'Missing tournamentId' }, { status: 400 });

    const tournament = await base44.asServiceRole.entities.Tournament.get(tournamentId);
    if (!tournament || tournament.format !== 'swiss') return Response.json({ message: 'Not a Swiss tournament' });

    // Get all participants
    const participants = await base44.asServiceRole.entities.TournamentParticipant.filter({
        tournament_id: tournamentId,
        status: 'active'
    });

    // Get all games to avoid repeats
    const games = await base44.asServiceRole.entities.Game.filter({ tournament_id: tournamentId });
    
    const playedMap = new Set();
    games.forEach(g => {
        playedMap.add(`${g.white_player_id}-${g.black_player_id}`);
        playedMap.add(`${g.black_player_id}-${g.white_player_id}`);
    });

    // Sort by score descending
    participants.sort((a, b) => (b.score || 0) - (a.score || 0));

    const newRound = (tournament.current_round || 0) + 1;
    const pairings = [];
    const used = new Set();

    // Simple Greedy Pairing
    for (let i = 0; i < participants.length; i++) {
        if (used.has(participants[i].id)) continue;
        
        let bestOpponent = null;
        for (let j = i + 1; j < participants.length; j++) {
            if (used.has(participants[j].id)) continue;
            
            // Check if played
            const key = `${participants[i].user_id}-${participants[j].user_id}`;
            if (!playedMap.has(key)) {
                bestOpponent = participants[j];
                break;
            }
        }

        // If no opponent found who hasn't played, take next available even if played (fallback)
        // Or implement a 'Bye'
        if (!bestOpponent) {
             for (let j = i + 1; j < participants.length; j++) {
                if (!used.has(participants[j].id)) {
                    bestOpponent = participants[j];
                    break;
                }
            }
        }

        if (bestOpponent) {
            pairings.push([participants[i], bestOpponent]);
            used.add(participants[i].id);
            used.add(bestOpponent.id);
        } else {
            // Bye for participants[i]
            // Give 1 point
            await base44.asServiceRole.entities.TournamentParticipant.update(participants[i].id, {
                score: (participants[i].score || 0) + 1,
                games_played: (participants[i].games_played || 0) + 1 // Maybe? Or count as played
            });
        }
    }

    // Create Games
    for (const pair of pairings) {
        const [p1, p2] = pair;
        
        const boardState = tournament.game_type === 'chess' 
            ? JSON.stringify({ board: "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1", castlingRights: { wK: true, wQ: true, bK: true, bQ: true }, lastMove: null })
            : JSON.stringify(initCheckers());

        // Alternate colors if possible? Random for now
        const isP1White = Math.random() > 0.5;
        
        const game = await base44.asServiceRole.entities.Game.create({
            status: 'playing',
            game_type: tournament.game_type,
            white_player_id: isP1White ? p1.user_id : p2.user_id,
            white_player_name: isP1White ? p1.user_name : p2.user_name,
            black_player_id: isP1White ? p2.user_id : p1.user_id,
            black_player_name: isP1White ? p2.user_name : p1.user_name,
            current_turn: 'white',
            board_state: boardState,
            tournament_id: tournament.id,
            tournament_round: newRound,
            white_seconds_left: 300, // Default or parse from time_control
            black_seconds_left: 300,
            is_private: true
        });
        
        await base44.asServiceRole.entities.TournamentParticipant.update(p1.id, { current_game_id: game.id });
        await base44.asServiceRole.entities.TournamentParticipant.update(p2.id, { current_game_id: game.id });
    }

    await base44.asServiceRole.entities.Tournament.update(tournament.id, { 
        current_round: newRound,
        status: 'ongoing'
    });

    return Response.json({ message: 'Round generated', round: newRound, pairings: pairings.length });
}

Deno.serve(handler);