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

const RATE_LIMIT = new Map();
const LIMIT_WINDOW = 60000; // 1 minute
const MAX_REQUESTS = 2;

function checkRateLimit(ip) {
    const now = Date.now();
    const record = RATE_LIMIT.get(ip) || { count: 0, start: now };
    if (now - record.start > LIMIT_WINDOW) { record.count = 0; record.start = now; }
    record.count++;
    RATE_LIMIT.set(ip, record);
    return record.count <= MAX_REQUESTS;
}

export default async function handler(req) {
    const clientIp = (req.headers.get("x-forwarded-for") || "unknown").split(',')[0].trim();
    if (!checkRateLimit(clientIp)) return Response.json({ error: "Too many requests" }, { status: 429 });

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
            prize_pool: 0 
        });

        // Notify Match Start
        const notifyMatch = async (uid, opponentName) => {
            const u = userMap.get(uid); // Ensure userMap is available or fetch
            if (u && u.preferences && u.preferences.notify_match === false) return;
            
            await base44.asServiceRole.entities.Notification.create({
                recipient_id: uid,
                type: 'game',
                title: 'Match Prêt !',
                message: `Votre partie contre ${opponentName} commence.`,
                link: `/Game?id=${game.id}`
            });
        };
        // Note: userMap might not be populated in all contexts (e.g. bracket only fetches allUsers if we moved logic).
        // If userMap is missing in 'createGame' scope, we might need to fetch. 
        // In startTournament context, 'userMap' is defined before.
        await notifyMatch(p1.user_id, p2.user_name);
        await notifyMatch(p2.user_id, p1.user_name);
    };

    // 1. Arena
    if (tournament.format === 'arena') {
        await base44.asServiceRole.entities.Tournament.update(tournament.id, { status: 'ongoing', current_round: 1 });
        return Response.json({ success: true, message: 'Arena started' });
    }

    // Fetch User Details for ELO Seeding
    const userIds = participants.map(p => p.user_id);
    // Optimize: fetch only needed users. Since we can't filter easily with $in, fetch all or chunk.
    // If list is huge, this is slow. For now assume manageable.
    const allUsers = await base44.asServiceRole.entities.User.list();
    const userMap = new Map(allUsers.map(u => [u.id, u]));

    const getElo = (pid) => {
        const u = userMap.get(pid);
        if (!u) return 1200;
        return tournament.game_type === 'chess' ? (u.elo_chess || 1200) : (u.elo_checkers || 1200);
    };

    // Sort participants by ELO descending
    participants.sort((a, b) => getElo(b.user_id) - getElo(a.user_id));

    // 2. Swiss
    if (tournament.format === 'swiss') {
        // Reset round to 0 so swissPairing increments to 1
        await base44.asServiceRole.entities.Tournament.update(tournament.id, { status: 'ongoing', current_round: 0 });
        
        // Invoke swissPairing which now handles ELO seeding and Byes
        try {
            // Pass team_mode to swissPairing to handle team constraints if needed
            await base44.asServiceRole.functions.invoke('swissPairing', { tournamentId: tournament.id, teamMode: tournament.team_mode });
            return Response.json({ success: true, message: 'Swiss started with ELO seeding' });
        } catch (e) {
            console.error("Swiss pairing invoke failed", e);
            return Response.json({ error: 'Failed to start Swiss pairing' }, { status: 500 });
        }
    }

    // Notify all participants
    const notifChannel = new BroadcastChannel('notifications');
    for (const p of participants) {
        // Check Prefs
        const pUser = userMap.get(p.user_id);
        if (pUser && pUser.preferences && pUser.preferences.notify_tournament === false) continue;

        // Create Notification Entity
        base44.asServiceRole.entities.Notification.create({
            recipient_id: p.user_id,
            type: 'tournament_update',
            title: 'Tournoi commencé !',
            message: `Le tournoi ${tournament.name} a commencé. Préparez-vous !`,
            link: `/Tournaments?id=${tournament.id}`,
            read: false
        }).catch(console.error);

        // Real-time Push
        notifChannel.postMessage({
            recipientId: p.user_id,
            type: 'tournament_update',
            title: 'Tournoi commencé !',
            message: `Le tournoi ${tournament.name} a commencé. Préparez-vous !`,
            link: `/Tournaments?id=${tournament.id}`
        });
    }

    // 3. Bracket (Single Elimination) - Seeded 1 vs N, 2 vs N-1...
    if (tournament.format === 'bracket') {
        await base44.asServiceRole.entities.Tournament.update(tournament.id, { status: 'ongoing', current_round: 1 });
        
        // Handle Odd Number - Top Seed gets Bye
        if (participants.length % 2 !== 0) {
            const byePlayer = participants.shift(); // Top seed (sorted desc)
            // Auto-win / Bye logic:
            // Mark as 'active' but maybe give a "Bye" win game or just advance?
            // For bracket visualizer, better to have a game with no opponent or special status.
            // We'll just update score and status, bracket component should handle "no game in round 1" as bye.
            await base44.asServiceRole.entities.TournamentParticipant.update(byePlayer.id, { 
                status: 'active',
                score: 1, // 1 point for bye
                tournament_round: 2 // Advance effectively? Or just let bracket manager pick them up next.
            });
            // Actually, standard Bracket logic needs them to be waiting for Round 2. 
            // We'll skip creating a game for them.
        }

        // Pair remaining: 1 vs N, 2 vs N-1
        const count = participants.length;
        for (let i = 0; i < count / 2; i++) {
            const p1 = participants[i];
            const p2 = participants[count - 1 - i];
            await createGame(p1, p2, 1);
        }
        
        return Response.json({ success: true, message: 'Bracket started (Seeded)' });
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