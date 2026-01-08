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

    // Fetch Users for ELO Sorting
    const allUsers = await base44.asServiceRole.entities.User.list();
    const userMap = new Map(allUsers.map(u => [u.id, u]));
    
    const getElo = (pid) => {
        const u = userMap.get(pid);
        if (!u) return 1200;
        return tournament.game_type === 'chess' ? (u.elo_chess || 1200) : (u.elo_checkers || 1200);
    };

    // Sort: Primary = Score DESC, Secondary = ELO DESC
    participants.sort((a, b) => {
        const scoreDiff = (b.score || 0) - (a.score || 0);
        if (scoreDiff !== 0) return scoreDiff;
        return getElo(b.user_id) - getElo(a.user_id);
    });

    const newRound = (tournament.current_round || 0) + 1;
    const pairings = [];
    const used = new Set();

    // Special Round 1: Dutch System (1 vs N/2+1)
    if (newRound === 1) {
        const half = Math.ceil(participants.length / 2);
        const topHalf = participants.slice(0, half);
        const bottomHalf = participants.slice(half);
        
        // Handle odd total
        if (participants.length % 2 !== 0) {
            const byePlayer = bottomHalf.pop(); // Lowest seed gets Bye
            await base44.asServiceRole.entities.TournamentParticipant.update(byePlayer.id, {
                score: 1, games_played: 0
            });
            // Notify Bye
            await base44.asServiceRole.entities.Notification.create({
                recipient_id: byePlayer.user_id,
                type: "tournament_round",
                title: "Bye (Tour 1)",
                message: "Vous avez reçu un Bye pour le premier tour (1 point).",
                link: `/TournamentDetail?id=${tournamentId}`
            });
        }

        // Pair Top Half vs Bottom Half
        for (let i = 0; i < topHalf.length; i++) {
            if (bottomHalf[i]) {
                pairings.push([topHalf[i], bottomHalf[i]]);
            } else {
                // Should not happen if odd handled, unless strange split
                // If bottom ran out, pair remaining top? (Not possible if split correctly)
            }
        }
    } else {
        // Subsequent Rounds: Score Groups + ELO Pairing
        // Group by Score
        const scoreGroups = {};
        participants.forEach(p => {
            const s = p.score || 0;
            if (!scoreGroups[s]) scoreGroups[s] = [];
            scoreGroups[s].push(p);
        });

        // Process groups from high to low
        const scores = Object.keys(scoreGroups).sort((a, b) => parseFloat(b) - parseFloat(a));
        let floaters = [];

        for (const s of scores) {
            const group = [...floaters, ...scoreGroups[s]];
            floaters = []; // Reset floaters for next
            
            // Sort group by ELO
            group.sort((a, b) => getElo(b.user_id) - getElo(a.user_id));

            while (group.length > 1) {
                const p1 = group.shift();
                
                // Find best opponent in group
                let matched = false;
                for (let i = 0; i < group.length; i++) {
                    const p2 = group[i];
                    
                    // Valid check
                    const key1 = `${p1.user_id}-${p2.user_id}`;
                    const key2 = `${p2.user_id}-${p1.user_id}`;
                    const played = playedMap.has(key1) || playedMap.has(key2);
                    const isTeammate = tournament.team_mode && p1.team_id && p2.team_id && p1.team_id === p2.team_id;

                    if (!played && !isTeammate) {
                        pairings.push([p1, p2]);
                        group.splice(i, 1);
                        matched = true;
                        break;
                    }
                }

                if (!matched) {
                    // Cannot pair in this group? Float down?
                    // For now, simplistic: if no match found in group, put p1 to floaters?
                    // Or try to pair with played if forced?
                    // Let's float p1 to next lower group
                    floaters.push(p1);
                }
            }

            if (group.length === 1) {
                floaters.push(group[0]);
            }
        }

        // Handle remaining floaters (Bye)
        if (floaters.length > 0) {
            const byePlayer = floaters[0]; // Lowest seed remaining
            await base44.asServiceRole.entities.TournamentParticipant.update(byePlayer.id, {
                score: (byePlayer.score || 0) + 1,
                games_played: (byePlayer.games_played || 0) + 0 // No game played
            });
             await base44.asServiceRole.entities.Notification.create({
                recipient_id: byePlayer.user_id,
                type: "info",
                title: `Bye (Tour ${newRound})`,
                message: "Vous avez reçu un Bye pour ce tour (1 point).",
                link: `/TournamentDetail?id=${tournamentId}`
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
        
        // Parse time control
        const parts = (tournament.time_control || "5+0").split('+');
        const mins = parseInt(parts[0]) || 5;
        const timeSeconds = mins * 60;
        const increment = parseInt(parts[1]) || 0;

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
            white_seconds_left: timeSeconds,
            black_seconds_left: timeSeconds,
            increment: increment,
            is_private: true
        });
        
        await base44.asServiceRole.entities.TournamentParticipant.update(p1.id, { current_game_id: game.id });
        await base44.asServiceRole.entities.TournamentParticipant.update(p2.id, { current_game_id: game.id });

        // Notify Match
        const notifyMatch = async (pid, opponentName) => {
            const u = userMap.get(pid);
            if (u && u.preferences && u.preferences.notify_match === false) return;
            
            await base44.asServiceRole.entities.Notification.create({
                recipient_id: pid,
                type: 'tournament_round',
                title: `Tour ${newRound} prêt`,
                message: `Contre ${opponentName}`,
                link: `/Game?id=${game.id}`
            });
        };
        await notifyMatch(p1.user_id, p2.user_name);
        await notifyMatch(p2.user_id, p1.user_name);
    }

    await base44.asServiceRole.entities.Tournament.update(tournament.id, { 
        current_round: newRound,
        status: 'ongoing'
    });

    return Response.json({ message: 'Round generated', round: newRound, pairings: pairings.length });
}

Deno.serve(handler);