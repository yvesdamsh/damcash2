import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

const channel = new BroadcastChannel('notifications');

export default async function handler(req) {
    // CORS preflight support
    if (req.method === 'OPTIONS') {
        return new Response(null, {
            status: 204,
            headers: {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
                'Access-Control-Allow-Headers': 'Content-Type, Authorization'
            }
        });
    }
    const base44 = createClientFromRequest(req);
    const now = new Date();

    // 1. Manage Official Tournaments (Hourly & Daily/Weekly)
    const ensureScheduledTournament = async (namePrefix, type, format, tc, targetDate, recurrence, prize = 100) => {
        const existing = await base44.asServiceRole.entities.Tournament.filter({
            game_type: type,
            format: format,
            status: ['open', 'ongoing']
        });
        
        // Check if we have one starting around targetDate (+/- 30 mins)
        const found = existing.find(t => Math.abs(new Date(t.start_date) - targetDate) < 30 * 60 * 1000 && t.name.startsWith(namePrefix));
        
        if (!found) {
             // Duration logic: Arena 1h, Swiss 2h
             const duration = format === 'arena' ? 60 : 120;
             const endDate = new Date(targetDate.getTime() + duration * 60 * 1000);
             
             await base44.asServiceRole.entities.Tournament.create({
                name: `${namePrefix} ${format === 'arena' ? tc : format}`,
                game_type: type,
                format: format,
                time_control: tc,
                start_date: targetDate.toISOString(),
                end_date: endDate.toISOString(),
                max_players: 999,
                status: 'open',
                recurrence: recurrence, // system handles recurrence on finish, but we double check here
                description: "Tournoi Officiel Damcash",
                prize_pool: prize,
                rounds: format === 'swiss' ? 7 : 0,
                created_by_user_id: 'system',
                elo_min: 0, elo_max: 3000
            });
        }
    };

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

    // 0. CLEANUP STALE DATA (Critical for display)
    try {
        // Cancel "Open" system tournaments that are > 2 hours old (never started)
        const staleOpen = await base44.asServiceRole.entities.Tournament.filter({ 
            status: 'open', 
            created_by_user_id: 'system' 
        });
        for (const t of staleOpen) {
            // If start date is more than 2 hours in the past
            if (new Date(t.start_date) < new Date(now.getTime() - 2 * 60 * 60 * 1000)) {
                console.log(`Cancelling stale tournament: ${t.name}`);
                await base44.asServiceRole.entities.Tournament.update(t.id, { status: 'cancelled' });
            }
        }

        // Force Finish "Ongoing" system tournaments that are > 2 hours past END date (stuck)
        const stuckOngoing = await base44.asServiceRole.entities.Tournament.filter({ 
            status: 'ongoing', 
            created_by_user_id: 'system' 
        });
        for (const t of stuckOngoing) {
            if (t.end_date && new Date(t.end_date) < new Date(now.getTime() - 2 * 60 * 60 * 1000)) {
                 console.log(`Force finishing stuck tournament: ${t.name}`);
                 await finishTournament(t, base44);
            }
        }

        // Cleanup "Future Garbage" (Tournaments > 48 hours ahead created by system)
        // This prevents clutter from previous buggy recurrent logic
        const futureGarbage = await base44.asServiceRole.entities.Tournament.filter({ 
            status: 'open', 
            created_by_user_id: 'system' 
        });
        const farFuture = new Date(now.getTime() + 48 * 60 * 60 * 1000);
        for (const t of futureGarbage) {
            if (new Date(t.start_date) > farFuture) {
                console.log(`Deleting far future tournament: ${t.name} (${t.start_date})`);
                await base44.asServiceRole.entities.Tournament.delete(t.id);
            }
        }
    } catch (e) {
        console.error("Cleanup error:", e);
    }

    // A. Hourly Arenas (Next 12 hours to be safe)
    // Note: currentHour is now.getHours(). 
    // If now is 17:13, currentHour is 17.
    // i=0 -> targetTime set to Hour 17:00 today.
    // i=1 -> targetTime set to Hour 18:00 today.
    // If we are at 17:13, the 17:00 tournament is already started or should have started.
    // If it didn't start, ensureScheduledTournament will create it as "Open" with start time 17:00.
    // BUT the start logic below (A. Start Tournaments) checks "if start_date <= now".
    // 17:00 <= 17:13, so it will immediately start.
    
    // We loop through next 12 hours
    for (let i = 0; i < 12; i++) {
        const targetTime = new Date(now);
        targetTime.setMinutes(0, 0, 0); 
        // We must use setHours on the targetTime object correctly to handle date rollover
        // The previous code did: targetTime.setHours(currentHour + i) which is correct for Date object.
        targetTime.setHours(currentHour + i); 
        
        const tcIndex = (currentHour + i) % 3;
        const tc = timeControls[tcIndex];
        
        try {
            await ensureScheduledTournament(`Arena ${tc} Dames`, 'checkers', 'arena', tc, targetTime, 'none', 50);
            await ensureScheduledTournament(`Arena ${tc} Échecs`, 'chess', 'arena', tc, targetTime, 'none', 50);
        } catch (e) {
            console.error(`Failed to schedule hour ${i}`, e);
        }
    }

    // B. Daily Major Tournaments
    // Daily Checkers Rapid at 18:00
    const todayRapidCheckers = new Date(now); todayRapidCheckers.setHours(18, 0, 0, 0);
    if (now > todayRapidCheckers) todayRapidCheckers.setDate(todayRapidCheckers.getDate() + 1);
    await ensureScheduledTournament("Daily Checkers Rapid", 'checkers', 'swiss', '10+0', todayRapidCheckers, 'daily', 200);

    // Daily Chess Blitz at 20:00
    const todayBlitzChess = new Date(now); todayBlitzChess.setHours(20, 0, 0, 0);
    if (now > todayBlitzChess) todayBlitzChess.setDate(todayBlitzChess.getDate() + 1);
    await ensureScheduledTournament("Daily Chess Blitz", 'chess', 'swiss', '3+2', todayBlitzChess, 'daily', 200);

    // C. Weekly Championships (Saturday/Sunday)
    // Next Saturday 16:00 for Checkers
    const nextSaturday = new Date(now); 
    nextSaturday.setDate(now.getDate() + (6 - now.getDay() + 7) % 7);
    nextSaturday.setHours(16, 0, 0, 0);
    if (now > nextSaturday) nextSaturday.setDate(nextSaturday.getDate() + 7); // If today is Saturday and passed
    await ensureScheduledTournament("Hebdo Dames Championship", 'checkers', 'arena', '5+0', nextSaturday, 'weekly', 1000);

    // Next Sunday 16:00 for Chess
    const nextSunday = new Date(now); 
    nextSunday.setDate(now.getDate() + (0 - now.getDay() + 7) % 7);
    nextSunday.setHours(16, 0, 0, 0);
    if (now > nextSunday) nextSunday.setDate(nextSunday.getDate() + 7);
    await ensureScheduledTournament("Hebdo Échecs Championship", 'chess', 'arena', '5+0', nextSunday, 'weekly', 1000);


    // 2. GENERAL TOURNAMENT MANAGER (Starts and Ends ANY tournament)
    
    // A.1 Upcoming Reminders (15 mins before)
    const upcoming = await base44.asServiceRole.entities.Tournament.filter({ status: 'open' });
    for (const t of upcoming) {
        const start = new Date(t.start_date);
        const diff = start - now;
        // Check if between 14 and 16 minutes away (to send once approx)
        if (diff > 14 * 60 * 1000 && diff < 16 * 60 * 1000) {
            // Send reminder
             const participants = await base44.asServiceRole.entities.TournamentParticipant.filter({ tournament_id: t.id });
             for (const p of participants) {
                 await base44.asServiceRole.entities.Notification.create({
                    recipient_id: p.user_id,
                    type: "tournament",
                    title: "Rappel Tournoi",
                    message: `Le tournoi ${t.name} commence dans 15 minutes !`,
                    link: `/TournamentDetail?id=${t.id}`
                });
             }
        }
    }

    // A.2 Start Tournaments
    const pendingStart = upcoming; // reused list
    for (const t of pendingStart) {
        if (new Date(t.start_date) <= now) {
            // Start it
            await base44.asServiceRole.entities.Tournament.update(t.id, { status: 'ongoing' });
            // Trigger Matchmaking (Initial)
            await base44.asServiceRole.functions.invoke('startTournament', { tournamentId: t.id });
            
            // Notify Participants & Followers
            const participants = await base44.asServiceRole.entities.TournamentParticipant.filter({ tournament_id: t.id });
            const followers = await base44.asServiceRole.entities.TournamentFollow.filter({ tournament_id: t.id });
            
            const recipientIds = new Set([
                ...participants.map(p => p.user_id),
                ...followers.map(f => f.user_id)
            ]);

            for (const uid of recipientIds) {
                const u = await base44.asServiceRole.entities.User.get(uid);
                if (u && u.preferences && u.preferences.notify_tournament === false) continue;

                await base44.asServiceRole.entities.Notification.create({
                    recipient_id: uid,
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

    return new Response(JSON.stringify({ status: 'success' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
    });
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
    // Team Mode Aggregation
    let finalRanking = participants;

    if (tournament.team_mode) {
        const teamScores = {}; // team_id -> { score, wins, buchholz, ... }
        
        participants.forEach(p => {
            if (p.team_id) {
                if (!teamScores[p.team_id]) {
                    teamScores[p.team_id] = { 
                        team_id: p.team_id, 
                        user_name: `Équipe ${p.team_id.substring(0,4)}`, // Placeholder name if not available
                        score: 0, 
                        wins: 0, 
                        buchholz: 0,
                        user_id: p.user_id // Store one user ID for reference (e.g. captain) but winner is team
                    };
                }
                teamScores[p.team_id].score += (p.score || 0);
                teamScores[p.team_id].wins += (p.wins || 0);
                teamScores[p.team_id].buchholz += (p.buchholz || 0);
            }
        });
        
        finalRanking = Object.values(teamScores);
    }

    const sorted = finalRanking.sort((a, b) => {
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

    const updateData = { status: 'finished' };
    if (tournament.team_mode) {
        updateData.winner_team_id = winner.team_id;
    } else {
        updateData.winner_id = winner.user_id;
    }

    await base44.asServiceRole.entities.Tournament.update(tournament.id, updateData);

    // Handle Recurrence
    if (tournament.recurrence && tournament.recurrence !== 'none') {
        const nextStart = new Date(tournament.start_date);
        if (tournament.recurrence === 'daily') nextStart.setDate(nextStart.getDate() + 1);
        if (tournament.recurrence === 'weekly') nextStart.setDate(nextStart.getDate() + 7);
        
        // Check if already exists to avoid dupes (simple check)
        const exists = await base44.asServiceRole.entities.Tournament.filter({
            name: tournament.name, // Assuming same name
            start_date: nextStart.toISOString()
        });

        if (exists.length === 0) {
            // Create next instance
            const newTournament = { ...tournament };
            delete newTournament.id;
            delete newTournament.created_date;
            delete newTournament.updated_date;
            delete newTournament.winner_id;
            delete newTournament.current_round;
            delete newTournament.status; // Reset to open
            delete newTournament.access_code; // Maybe keep or generate new? Let's generate new if private
            delete newTournament.winner_id;
            delete newTournament.winner_team_id;

            newTournament.start_date = nextStart.toISOString();
            if (tournament.end_date) {
                const duration = new Date(tournament.end_date) - new Date(tournament.start_date);
                newTournament.end_date = new Date(nextStart.getTime() + duration).toISOString();
            }
            newTournament.status = 'open';
            newTournament.access_code = tournament.is_private ? Math.random().toString(36).substring(2, 8).toUpperCase() : null;

            await base44.asServiceRole.entities.Tournament.create(newTournament);
        }
    }

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

        // Distribution Logic
        let distribution = { 1: 0.5, 2: 0.3, 3: 0.2 }; // Default
        
        if (tournament.prize_distribution) {
            try {
                const parsed = JSON.parse(tournament.prize_distribution);
                // Validate sums to approx 1? Or just use as weights?
                // Assuming percentages like { "1": 0.5, "2": 0.3 }
                distribution = parsed;
            } catch (e) {
                console.error("Invalid prize distribution JSON", e);
            }
        }

        // Apply distribution
        for (let i = 0; i < sorted.length; i++) {
            const rank = i + 1;
            const percentage = distribution[rank] || 0;
            
            if (percentage > 0) {
                const p = sorted[i];
                const amount = Math.floor(netPool * percentage);
                
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

    // Check for "Invincible" Badge (No losses)
    let isInvincible = false;
    try {
        const winnerGames = games.filter(g => 
            (g.white_player_id === winner.user_id || g.black_player_id === winner.user_id)
        );
        // Invincible if played at least 3 games and lost none (draws allowed? usually invincible implies no loss)
        // Check for any loss
        const hasLoss = winnerGames.some(g => g.winner_id && g.winner_id !== winner.user_id);
        if (winnerGames.length >= 3 && !hasLoss) {
            isInvincible = true;
        }
    } catch(e) {}

    if (isInvincible) {
        await base44.asServiceRole.entities.UserBadge.create({
            user_id: winner.user_id,
            tournament_id: tournament.id,
            name: "Invincible",
            icon: "Shield",
            description: `A remporté ${tournament.name} sans aucune défaite !`,
            awarded_at: new Date().toISOString()
        });
        await base44.asServiceRole.entities.Notification.create({
            recipient_id: winner.user_id,
            type: "success",
            title: "Badge Légendaire !",
            message: "Vous avez débloqué le badge 'Invincible' pour votre performance parfaite.",
            link: "/Profile"
        });
    }

    // Badge for Winner (Individual or Team)
    if (tournament.team_mode && winner.team_id) {
        // Award to all team members (assuming we can fetch them)
        const teamMembers = await base44.asServiceRole.entities.TeamMember.filter({ team_id: winner.team_id, status: 'active' });
        for (const member of teamMembers) {
            await base44.asServiceRole.entities.UserBadge.create({
                user_id: member.user_id,
                tournament_id: tournament.id,
                name: tournament.badge_name || `Champion ${tournament.name} (Équipe)`,
                icon: tournament.badge_icon || 'Trophy',
                awarded_at: new Date().toISOString()
            });
            
            // Notify Member
            await base44.asServiceRole.entities.Notification.create({
                recipient_id: member.user_id,
                type: "success",
                title: "Victoire d'Équipe !",
                message: `Votre équipe a remporté le tournoi ${tournament.name} ! Vous avez reçu un badge.`,
                link: `/Profile`
            });
        }
        
        // Update Tournament with Winner Team
        await base44.asServiceRole.entities.Tournament.update(tournament.id, { winner_team_id: winner.team_id });

    } else {
        // Individual
        await base44.asServiceRole.entities.UserBadge.create({
            user_id: winner.user_id,
            tournament_id: tournament.id,
            name: tournament.badge_name || `Champion ${tournament.name}`,
            icon: tournament.badge_icon || 'Trophy',
            awarded_at: new Date().toISOString()
        });
    }

    // Notify Followers of Winner
    const followers = await base44.asServiceRole.entities.TournamentFollow.filter({ tournament_id: tournament.id });
    for (const f of followers) {
        const u = await base44.asServiceRole.entities.User.get(f.user_id);
        if (u && u.preferences && u.preferences.notify_tournament === false) continue;

        await base44.asServiceRole.entities.Notification.create({
            recipient_id: f.user_id,
            type: "tournament",
            title: "Tournoi terminé",
            message: `${winner.user_name} a remporté le tournoi ${tournament.name} !`,
            link: `/TournamentDetail?id=${tournament.id}`
        });
    }
}