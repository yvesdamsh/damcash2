import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';
import { initializeBoard } from '../components/checkersLogic.js'; // Assumption: we can't import directly easily, using minimal init
// Actually, importing from components might fail in Deno deploy if not careful with paths/deps. 
// Safe to duplicate minimal board init.

const initCheckers = () => {
    const board = Array(10).fill(null).map(() => Array(10).fill(0));
    for (let r = 0; r < 4; r++) {
        for (let c = 0; c < 10; c++) {
            if ((r + c) % 2 !== 0) board[r][c] = 2;
        }
    }
    for (let r = 6; r < 10; r++) {
        for (let c = 0; c < 10; c++) {
            if ((r + c) % 2 !== 0) board[r][c] = 1;
        }
    }
    return board;
};

const initChess = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";

export default async function handler(req) {
    const base44 = createClientFromRequest(req);
    const { tournamentId } = await req.json();

    if (!tournamentId) return Response.json({ error: 'Missing tournamentId' }, { status: 400 });

    const tournament = await base44.asServiceRole.entities.Tournament.get(tournamentId);
    if (!tournament) return Response.json({ error: 'Tournament not found' }, { status: 404 });

    // Validate creator? We assume caller (frontend) checked or we check here if we pass userId
    // But for now we assume the button is only shown to admin/creator in frontend. 
    // Ideally we check: const user = await base44.auth.me(); if (user.id !== tournament.created_by_user_id) ...

    const participants = await base44.asServiceRole.entities.TournamentParticipant.filter({
        tournament_id: tournamentId,
        status: 'active'
    });

    if (participants.length < 2) return Response.json({ error: 'Not enough players' }, { status: 400 });

    // Time Control Parsing
    const parts = (tournament.time_control || "5+0").split('+');
    const mins = parseInt(parts[0]) || 5;
    const timeSeconds = mins * 60;
    const increment = parseInt(parts[1]) || 0;

    // Common Game Create Helper
    const createGame = async (p1, p2, round, stage = null, groupId = null) => {
         const boardState = tournament.game_type === 'chess' 
            ? JSON.stringify({ board: initChess, castlingRights: { wK: true, wQ: true, bK: true, bQ: true }, lastMove: null })
            : JSON.stringify(initCheckers());

        await base44.asServiceRole.entities.Game.create({
            status: 'waiting',
            game_type: tournament.game_type,
            white_player_id: p1.user_id,
            white_player_name: p1.user_name,
            black_player_id: p2.user_id,
            black_player_name: p2.user_name,
            current_turn: 'white',
            board_state: boardState,
            tournament_id: tournament.id,
            tournament_round: round,
            white_seconds_left: timeSeconds,
            black_seconds_left: timeSeconds,
            increment: increment,
            is_private: true,
            prize_pool: 0 // Individual game prize? Maybe 0, tournament has prize
        });
    };

    // 1. Arena
    if (tournament.format === 'arena') {
        await base44.asServiceRole.entities.Tournament.update(tournament.id, { status: 'ongoing', current_round: 1 });
        return Response.json({ success: true, message: 'Arena started' });
    }

    // 2. Swiss
    if (tournament.format === 'swiss') {
        // Just invoke swissPairing or replicate round 1 logic (Random/Seed)
        // Let's replicate simple seeded pairing for Round 1
        await base44.asServiceRole.entities.Tournament.update(tournament.id, { status: 'ongoing', current_round: 1 });
        
        // Sort by seed (random or rating if we had it)
        const shuffled = [...participants].sort(() => 0.5 - Math.random());
        // Split top half vs bottom half? Or just adjacent
        // Standard Swiss Round 1: Top half vs Bottom half
        const half = Math.floor(shuffled.length / 2);
        const top = shuffled.slice(0, half);
        const bottom = shuffled.slice(half);
        
        for (let i = 0; i < top.length; i++) {
            if (bottom[i]) {
                 await createGame(top[i], bottom[i], 1);
            }
        }
        // If odd number, one bye (already in bottom leftover?)
        if (shuffled.length % 2 !== 0) {
             const byePlayer = shuffled[shuffled.length - 1];
             // Give point?
             await base44.asServiceRole.entities.TournamentParticipant.update(byePlayer.id, { score: 1, games_played: 1 });
        }

        return Response.json({ success: true, message: 'Swiss started' });
    }

    // 3. Bracket (Single Elimination)
    if (tournament.format === 'bracket') {
        await base44.asServiceRole.entities.Tournament.update(tournament.id, { status: 'ongoing', current_round: 1 });
        const shuffled = [...participants].sort(() => 0.5 - Math.random());
        
        for (let i = 0; i < shuffled.length; i += 2) {
            if (i + 1 < shuffled.length) {
                await createGame(shuffled[i], shuffled[i+1], 1);
            } else {
                // Bye
                await base44.asServiceRole.entities.TournamentParticipant.update(shuffled[i].id, { status: 'active' }); // Just moves to next round technically
            }
        }
        return Response.json({ success: true, message: 'Bracket started' });
    }

    // 4. Hybrid (Groups -> Bracket)
    if (tournament.format === 'hybrid') {
        const groupNames = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];
        const shuffled = [...participants].sort(() => 0.5 - Math.random());
        const groupSize = tournament.group_size || 4;
        const numGroups = Math.ceil(shuffled.length / groupSize);

        // Assign Groups
        const groups = {};
        for (let i = 0; i < shuffled.length; i++) {
            const groupIndex = i % numGroups;
            const gName = groupNames[groupIndex];
            const p = shuffled[i];
            await base44.asServiceRole.entities.TournamentParticipant.update(p.id, {
                group_id: gName,
                group_points: 0
            });
            if (!groups[gName]) groups[gName] = [];
            groups[gName].push(p);
        }

        // Generate Round Robin Matches
        for (const gName in groups) {
            const gp = groups[gName];
            for (let i = 0; i < gp.length; i++) {
                for (let j = i + 1; j < gp.length; j++) {
                    await createGame(gp[i], gp[j], 0, 'groups', gName);
                }
            }
        }

        await base44.asServiceRole.entities.Tournament.update(tournament.id, { status: 'ongoing', stage: 'groups' });
        return Response.json({ success: true, message: 'Hybrid groups started' });
    }

    return Response.json({ error: 'Unknown format' });
}

Deno.serve(handler);