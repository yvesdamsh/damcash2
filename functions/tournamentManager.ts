import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

const channel = new BroadcastChannel('notifications');

export default async function handler(req) {
    const base44 = createClientFromRequest(req);
    const now = new Date();

    // 1. Manage Hourly Arenas (Existing Logic)
    // ... (Simplified/Refactored to use common logic if possible, but keeping for compatibility)
    const currentHour = now.getHours();
    const nextHour = (currentHour + 1) % 24;
    const timeControls = ["3+0", "5+0", "3+2"];
    const currentTC = timeControls[currentHour % 3];
    const nextTC = timeControls[nextHour % 3];

    const currentStart = new Date(now); currentStart.setMinutes(0, 0, 0);
    const currentEnd = new Date(currentStart); currentEnd.setMinutes(57, 0, 0);
    
    const nextStart = new Date(now); nextStart.setHours(currentHour + 1, 0, 0, 0);
    const nextEnd = new Date(nextStart); nextEnd.setMinutes(57, 0, 0);

    const ensureArena = async (start, end, tc, type) => {
        const existing = await base44.asServiceRole.entities.Tournament.filter({
            format: 'arena', game_type: type, status: ['open', 'ongoing']
        });
        const found = existing.find(t => Math.abs(new Date(t.start_date) - start) < 60000);
        
        if (!found) {
            await base44.asServiceRole.entities.Tournament.create({
                name: `Arena ${type === 'checkers' ? 'Dames' : 'Échecs'} ${tc}`,
                game_type: type, format: 'arena', time_control: tc,
                start_date: start.toISOString(), end_date: end.toISOString(),
                max_players: 999, status: now >= start ? 'ongoing' : 'open',
                description: "Tournoi officiel Damcash.",
                prize_pool: 100, // Automated prize for automated tournaments
                elo_min: 0, elo_max: 3000
            });
        }
    };

    await ensureArena(currentStart, currentEnd, currentTC, 'checkers');
    await ensureArena(currentStart, currentEnd, currentTC, 'chess');
    await ensureArena(nextStart, nextEnd, nextTC, 'checkers');
    await ensureArena(nextStart, nextEnd, nextTC, 'chess');


    // 2. GENERAL TOURNAMENT MANAGER (Starts and Ends ANY tournament)
    
    // A. Start Tournaments
    const pendingStart = await base44.asServiceRole.entities.Tournament.filter({ status: 'open' });
    for (const t of pendingStart) {
        if (new Date(t.start_date) <= now) {
            // Start it
            await base44.asServiceRole.entities.Tournament.update(t.id, { status: 'ongoing' });
            // Trigger Matchmaking (Initial)
            await base44.asServiceRole.functions.invoke('startTournament', { tournamentId: t.id });
            
            // Notify
            const participants = await base44.asServiceRole.entities.TournamentParticipant.filter({ tournament_id: t.id });
            for (const p of participants) {
                await base44.asServiceRole.entities.Notification.create({
                    recipient_id: p.user_id,
                    type: "tournament",
                    title: "C'est parti !",
                    message: `Le tournoi ${t.name} commence maintenant.`,
                    link: `/TournamentDetail?id=${t.id}`
                });
            }
        }
    }

    // B. End Tournaments & Payouts
    // Check ongoing tournaments that have passed end_date (for timed) OR completed (logic usually elsewhere, but we can safeguard here)
    const ongoing = await base44.asServiceRole.entities.Tournament.filter({ status: 'ongoing' });
    for (const t of ongoing) {
        // Check if end date passed (primary trigger for Arena/Timed events)
        // For Brackets, usually end_date is max duration, but real trigger is games finished. 
        // We'll assume end_date is hard cutoff or if format is 'arena'.
        // For automated admin tournaments, we'll respect end_date if set.
        if (t.end_date && new Date(t.end_date) <= now) {
            await finishTournament(t, base44);
        }
    }

    return Response.json({ status: 'success' });
}

async function finishTournament(tournament, base44) {
    const participants = await base44.asServiceRole.entities.TournamentParticipant.filter({ tournament_id: tournament.id });
    if (participants.length === 0) {
        await base44.asServiceRole.entities.Tournament.update(tournament.id, { status: 'finished' });
        return;
    }

    // Advanced Tie-Breakers (Buchholz / Sonneborn-Berger)
    const games = await base44.asServiceRole.entities.Game.filter({ tournament_id: tournament.id, status: 'finished' });
    
    // Helper: Get opponents of a participant
    const getOpponents = (userId) => {
        const opponents = [];
        games.forEach(g => {
            if (g.white_player_id === userId) opponents.push({ id: g.black_player_id, result: g.winner_id === userId ? 1 : (g.winner_id ? 0 : 0.5) });
            else if (g.black_player_id === userId) opponents.push({ id: g.white_player_id, result: g.winner_id === userId ? 1 : (g.winner_id ? 0 : 0.5) });
        });
        return opponents;
    };

    // Helper: Get Score of a participant
    const getScore = (userId) => {
        const p = participants.find(part => part.user_id === userId);
        return p ? (p.score || 0) : 0;
    };

    // Calculate Metrics
    for (const p of participants) {
        const opps = getOpponents(p.user_id);
        
        // Buchholz: Sum of opponents' scores
        const buchholz = opps.reduce((sum, opp) => sum + getScore(opp.id), 0);
        
        // Sonneborn-Berger: Sum of scores of opponents you DEFEATED + 0.5 * scores of opponents you DREW
        const sb = opps.reduce((sum, opp) => {
            if (opp.result === 1) return sum + getScore(opp.id);
            if (opp.result === 0.5) return sum + (getScore(opp.id) * 0.5);
            return sum;
        }, 0);

        p.buchholz = buchholz;
        p.sonneborn_berger = sb;
        
        // Update DB with these stats for record keeping
        // (assuming schema allows arbitrary props or we ignore if not in schema, mainly used for sorting here)
    }

    // Sort based on Tie Breaker setting
    const sorted = participants.sort((a, b) => {
        // 1. Score (Primary)
        if ((b.score || 0) !== (a.score || 0)) return (b.score || 0) - (a.score || 0);
        
        // 2. Tie Breakers
        const tieBreaker = tournament.tie_breaker || 'buchholz';
        
        if (tieBreaker === 'buchholz') {
            if (b.buchholz !== a.buchholz) return b.buchholz - a.buchholz;
        }
        else if (tieBreaker === 'sonneborn_berger') {
            if (b.sonneborn_berger !== a.sonneborn_berger) return b.sonneborn_berger - a.sonneborn_berger;
        }
        else if (tieBreaker === 'head_to_head') {
            // Simple check if they played each other
            const match = games.find(g => 
                (g.white_player_id === a.user_id && g.black_player_id === b.user_id) || 
                (g.white_player_id === b.user_id && g.black_player_id === a.user_id)
            );
            if (match) {
                if (match.winner_id === a.user_id) return -1; // a wins -> a comes first (index 0) so negative diff? Wait. Sort desc? 
                // Sort fn: < 0 means a comes first.
                // If a is better, we want a first. 
                if (match.winner_id === b.user_id) return 1;
            }
        }
        else if (tieBreaker === 'wins') {
            if ((b.wins || 0) !== (a.wins || 0)) return (b.wins || 0) - (a.wins || 0);
        }

        // 3. Fallback: Wins -> Games Played -> Random/ID
        return (b.wins || 0) - (a.wins || 0);
    });

    const winner = sorted[0];
    if (!winner) return; // Should not happen if len > 0

    await base44.asServiceRole.entities.Tournament.update(tournament.id, { 
        status: 'finished',
        winner_id: winner.user_id 
    });

    // Distribute Prizes
    if (tournament.prize_pool > 0) {
        const commissionRate = 0.10;
        const commission = Math.floor(tournament.prize_pool * commissionRate);
        const netPool = tournament.prize_pool - commission;

        // Record Commission
        if (commission > 0) {
             await base44.asServiceRole.entities.Transaction.create({
                user_id: 'system',
                type: 'commission',
                amount: commission,
                game_id: tournament.id,
                status: 'completed',
                description: 'Commission Tournoi 10%'
            });
        }

        // Standard: 1st = 50%, 2nd = 30%, 3rd = 20% of NET pool
        const distribution = [0.5, 0.3, 0.2];
        for (let i = 0; i < Math.min(sorted.length, 3); i++) {
            const p = sorted[i];
            const amount = Math.floor(netPool * distribution[i]);
            if (amount > 0) {
                // Check wallet
                const wallets = await base44.asServiceRole.entities.Wallet.filter({ user_id: p.user_id });
                let wallet = wallets[0];
                if (!wallet) wallet = await base44.asServiceRole.entities.Wallet.create({ user_id: p.user_id, balance: 0 });

                // Credit
                await base44.asServiceRole.entities.Wallet.update(wallet.id, {
                    balance: (wallet.balance || 0) + amount
                });

                // Log
                await base44.asServiceRole.entities.Transaction.create({
                    user_id: p.user_id,
                    type: 'prize',
                    amount: amount,
                    status: 'completed',
                    description: `Prix Tournoi ${tournament.name} (Rang ${i+1})`,
                    game_id: tournament.id // using game_id field for ref
                });

                // Notify
                await base44.asServiceRole.entities.Notification.create({
                    recipient_id: p.user_id,
                    type: "success",
                    title: "Récompense Tournoi",
                    message: `Vous avez terminé ${i+1}e et gagné ${amount} DamCoins !`,
                    link: `/Wallet`
                });
            }
        }
    }

    // Badge for Winner
    await base44.asServiceRole.entities.UserBadge.create({
        user_id: winner.user_id,
        tournament_id: tournament.id,
        name: `Champion ${tournament.name}`,
        icon: 'Trophy',
        awarded_at: new Date().toISOString()
    });
}