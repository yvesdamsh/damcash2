import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';
import { initializeBoard } from '../components/checkersLogic.js'; // We can't import from components in backend functions easily usually, better to duplicate logic or minimal init
import { initializeChessBoard } from '../components/chessLogic.js';

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

// FEN for chess
const initChess = () => "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";

export default async function handler(req) {
    const base44 = createClientFromRequest(req);
    const { tournamentId } = await req.json();

    if (!tournamentId) return Response.json({ error: 'Missing tournamentId' }, { status: 400 });

    const tournament = await base44.asServiceRole.entities.Tournament.get(tournamentId);
    if (!tournament || tournament.status !== 'ongoing') return Response.json({ message: 'Tournament not active' });

    // Get participants who are active
    const participants = await base44.asServiceRole.entities.TournamentParticipant.filter({
        tournament_id: tournamentId,
        status: 'active'
    });

    // Find players who are NOT playing (current_game_id is null or empty)
    // Note: filter might not support 'null', so we filter in memory
    const available = participants.filter(p => !p.current_game_id);

    if (available.length < 2) return Response.json({ message: 'Not enough players to pair', count: 0 });

    // Sort by score to pair similar skill (Swiss-ish) or just random for Arena
    // Arena usually tries to pair closest score
    available.sort((a, b) => (b.score || 0) - (a.score || 0));

    let pairings = 0;
    const used = new Set();

    for (let i = 0; i < available.length; i++) {
        if (used.has(available[i].id)) continue;

        const p1 = available[i];
        let p2 = null;

        // Find best opponent (next available)
        // Priority: 
        // 1. Not same team (if team mode)
        // 2. Closest score (list is sorted)
        
        for (let j = i + 1; j < available.length; j++) {
            if (used.has(available[j].id)) continue;
            
            const candidate = available[j];
            
            // Team restriction
            if (tournament.team_mode && p1.team_id && candidate.team_id && p1.team_id === candidate.team_id) {
                continue; 
            }
            
            // Found suitable opponent
            p2 = candidate;
            break;
        }

        if (p2) {
            used.add(p1.id);
            used.add(p2.id);

            // Parse time control
            // "3+0" -> 3 min, 0 inc
            const parts = (tournament.time_control || "5+0").split('+');
            const mins = parseInt(parts[0]);
            const inc = parseInt(parts[1]);

            // Create Game
            const boardState = tournament.game_type === 'chess' 
                ? JSON.stringify({ board: "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1", castlingRights: { wK: true, wQ: true, bK: true, bQ: true }, lastMove: null })
                : JSON.stringify(initCheckers());

            const game = await base44.asServiceRole.entities.Game.create({
                status: 'playing',
                game_type: tournament.game_type,
                white_player_id: p1.user_id,
                white_player_name: p1.user_name,
                black_player_id: p2.user_id,
                black_player_name: p2.user_name,
                current_turn: 'white',
                board_state: boardState,
                tournament_id: tournament.id,
                white_seconds_left: mins * 60,
                black_seconds_left: mins * 60,
                is_private: true // Hidden from public list maybe? or false to show. Let's say true to keep main page clean, visible in tournament page
            });

            // Update participants
            await base44.asServiceRole.entities.TournamentParticipant.update(p1.id, { current_game_id: game.id });
            await base44.asServiceRole.entities.TournamentParticipant.update(p2.id, { current_game_id: game.id });
            
            pairings++;
        }
    }

    return Response.json({ message: 'Pairings generated', count: pairings });
}

Deno.serve(handler);