import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';
import { z } from 'npm:zod@^3.24.2';

const gameResultSchema = z.object({
    gameId: z.string().min(1, "Game ID is required")
});

export default async function handler(req) {
    const base44 = createClientFromRequest(req);
    const body = await req.json();
    
    const user = await base44.auth.me();
    // Allow admin or system (if local) or players to trigger processing
    // But ideally restrict to players involved in the game or admin
    
    const validation = gameResultSchema.safeParse(body);
    if (!validation.success) {
        return Response.json({ error: "Invalid input", details: validation.error.format() }, { status: 400 });
    }

    const { gameId } = validation.data;

    // Lock logic via check
    const game = await base44.asServiceRole.entities.Game.get(gameId);
    if (!game || game.status !== 'finished' || game.elo_processed) {
        return Response.json({ message: 'Game not finished or already processed' });
    }

    // Security Check: Ensure caller is authorized
    if (user && user.role !== 'admin' && game.white_player_id !== user.id && game.black_player_id !== user.id) {
         return Response.json({ error: "Unauthorized" }, { status: 403 });
    }

    // Mark as processed immediately to avoid double run
    await base44.asServiceRole.entities.Game.update(gameId, { elo_processed: true });

    const whiteId = game.white_player_id;
    const blackId = game.black_player_id;
    const winnerId = game.winner_id;
    const type = game.game_type; // 'checkers' or 'chess'

    // 0. Process Payouts if Prize Pool exists
    if (game.prize_pool && game.prize_pool > 0) {
        const commissionRate = 0.10;
        const commission = Math.floor(game.prize_pool * commissionRate);
        const netPool = game.prize_pool - commission;

        // Record Commission (System)
        if (commission > 0) {
             // Optionally record to a system wallet or just log transaction
             await base44.asServiceRole.entities.Transaction.create({
                user_id: 'system', // System ID
                type: 'commission',
                amount: commission,
                game_id: gameId,
                status: 'completed',
                description: 'Commission 10%'
            });
        }

        if (winnerId) {
            const payoutAmount = netPool;
            // Fetch winner wallet
            const wallets = await base44.asServiceRole.entities.Wallet.filter({ user_id: winnerId });
            let wallet = wallets[0];
            if (!wallet) {
                wallet = await base44.asServiceRole.entities.Wallet.create({ user_id: winnerId, balance: 0 });
            }
            
            // Update balance
            await base44.asServiceRole.entities.Wallet.update(wallet.id, {
                balance: (wallet.balance || 0) + payoutAmount
            });

            // Record Transaction
            await base44.asServiceRole.entities.Transaction.create({
                user_id: winnerId,
                type: 'prize',
                amount: payoutAmount,
                game_id: gameId,
                status: 'completed',
                description: 'Gain de partie'
            });

            // Notify
             await base44.asServiceRole.entities.Notification.create({
                recipient_id: winnerId,
                type: "success",
                title: "Gain Reçu !",
                message: `Vous avez gagné ${payoutAmount} D$ ! (Com. 10% déduite)`,
                link: `/Wallet`
            });
        } else {
            // Draw - Split NET pool
            const split = Math.floor(netPool / 2);
            [whiteId, blackId].forEach(async (uid) => {
                 if (!uid) return;
                 const wallets = await base44.asServiceRole.entities.Wallet.filter({ user_id: uid });
                 let w = wallets[0];
                 if (!w) w = await base44.asServiceRole.entities.Wallet.create({ user_id: uid, balance: 0 });
                 
                 await base44.asServiceRole.entities.Wallet.update(w.id, { balance: (w.balance||0) + split });
                 
                 await base44.asServiceRole.entities.Transaction.create({
                    user_id: uid,
                    type: 'refund',
                    amount: split,
                    game_id: gameId,
                    status: 'completed',
                    description: 'Partage du pot (Nulle)'
                });
            });
        }
    }

    // Broadcast Result to Realtime Socket (Activity Feed & Lobby)
    try {
        const bc = new BroadcastChannel("global_updates");
        bc.postMessage({
            channels: ['activity', 'lobby', 'tournaments'], // Broadcast to relevant channels
            payload: {
                type: 'game_finished',
                gameId: game.id,
                game: game, // Full game object for feed
                winnerId: winnerId,
                whiteId: whiteId,
                blackId: blackId
            }
        });
        setTimeout(() => bc.close(), 100); // Clean up
    } catch(e) {
        console.error("Broadcast failed", e);
    }

    // 1. Update ELO
    if (whiteId && blackId && whiteId !== blackId) { // Don't rate solo games
        const [whiteUser, blackUser] = await Promise.all([
            base44.asServiceRole.entities.User.get(whiteId),
            base44.asServiceRole.entities.User.get(blackId)
        ]);

        if (whiteUser && blackUser) {
            const ratingA = type === 'chess' ? (whiteUser.elo_chess || 1200) : (whiteUser.elo_checkers || 1200);
            const ratingB = type === 'chess' ? (blackUser.elo_chess || 1200) : (blackUser.elo_checkers || 1200);
            
            // Dynamic K-factor based on games played
            const getK = (games) => {
                if (!games || games < 30) return 40; // Provisional rating (placement) - moves fast
                if (games > 100) return 20; // Established rating - moves normally
                return 32; // Intermediate
            };

            const getTier = (elo) => {
                if (elo < 1200) return 'Amateur';
                if (elo < 1800) return 'Pro';
                return 'Maître';
            };

            const KA = getK(whiteUser.games_played);
            const KB = getK(blackUser.games_played);

            const expectedA = 1 / (1 + Math.pow(10, (ratingB - ratingA) / 400));
            const expectedB = 1 / (1 + Math.pow(10, (ratingA - ratingB) / 400));
            
            let scoreA = 0.5;
            let scoreB = 0.5;
            if (winnerId === whiteId) { scoreA = 1; scoreB = 0; }
            else if (winnerId === blackId) { scoreA = 0; scoreB = 1; }
            
            const newRatingA = Math.round(ratingA + KA * (scoreA - expectedA));
            const newRatingB = Math.round(ratingB + KB * (scoreB - expectedB));

            // XP & Level Logic
            const calculateXP = (score) => {
                if (score === 1) return 100; // Win
                if (score === 0.5) return 50; // Draw
                return 20; // Loss
            };

            const xpA = calculateXP(scoreA);
            const xpB = calculateXP(scoreB);

            const processLevelUpdate = async (userId, currentXP, addedXP) => {
                const newXP = (currentXP || 0) + addedXP;
                const oldLevel = Math.floor(Math.sqrt(currentXP || 0) * 0.1) + 1;
                const newLevel = Math.floor(Math.sqrt(newXP) * 0.1) + 1;
                
                if (newLevel > oldLevel) {
                    // Level Up Bonus
                    const bonus = newLevel * 50; // 50 coins per level
                    const wallets = await base44.asServiceRole.entities.Wallet.filter({ user_id: userId });
                    let w = wallets[0];
                    if (!w) w = await base44.asServiceRole.entities.Wallet.create({ user_id: userId, balance: 0 });
                    
                    await base44.asServiceRole.entities.Wallet.update(w.id, { balance: (w.balance||0) + bonus });
                    await base44.asServiceRole.entities.Transaction.create({
                        user_id: userId,
                        type: 'reward',
                        amount: bonus,
                        status: 'completed',
                        description: `Niveau ${newLevel} atteint !`
                    });

                    await base44.asServiceRole.entities.Notification.create({
                        recipient_id: userId,
                        type: "success",
                        title: "Niveau Supérieur !",
                        message: `Bravo ! Vous êtes passé au niveau ${newLevel}. Bonus: ${bonus} D$`,
                        link: `/Profile`
                    });
                }
                return { xp: newXP, level: newLevel };
            };

            const levelUpdatesA = await processLevelUpdate(whiteId, whiteUser.xp, xpA);
            const levelUpdatesB = await processLevelUpdate(blackId, blackUser.xp, xpB);
            
            // Helper to update tier and notify
            const processTierUpdate = async (userId, oldTier, newElo, gameType) => {
                const newTier = getTier(newElo);
                if (oldTier !== newTier) {
                    // Badge/Notify logic
                    if (newTier === 'Maître' || newTier === 'Pro') {
                        await base44.asServiceRole.entities.UserBadge.create({
                            user_id: userId,
                            name: `Promotion ${newTier}`,
                            icon: "Award",
                            awarded_at: new Date().toISOString()
                        });
                        await base44.asServiceRole.entities.Notification.create({
                            recipient_id: userId,
                            type: "success",
                            title: "Promotion !",
                            message: `Félicitations ! Vous êtes passé au rang ${newTier} en ${gameType === 'chess' ? 'Échecs' : 'Dames'}.`,
                            link: `/Profile`
                        });
                    }
                }
                return newTier;
            };

            // Update White
            const whiteUpdates = { 
                games_played: (whiteUser.games_played || 0) + 1,
                xp: levelUpdatesA.xp,
                level: levelUpdatesA.level
            };
            if (type === 'chess') {
                whiteUpdates.elo_chess = newRatingA;
                whiteUpdates.tier_chess = await processTierUpdate(whiteId, whiteUser.tier_chess, newRatingA, 'chess');
                if (scoreA === 1) whiteUpdates.wins_chess = (whiteUser.wins_chess || 0) + 1;
                else if (scoreA === 0) whiteUpdates.losses_chess = (whiteUser.losses_chess || 0) + 1;
            } else {
                whiteUpdates.elo_checkers = newRatingA;
                whiteUpdates.tier_checkers = await processTierUpdate(whiteId, whiteUser.tier_checkers, newRatingA, 'checkers');
                if (scoreA === 1) whiteUpdates.wins_checkers = (whiteUser.wins_checkers || 0) + 1;
                else if (scoreA === 0) whiteUpdates.losses_checkers = (whiteUser.losses_checkers || 0) + 1;
            }
            await base44.asServiceRole.entities.User.update(whiteId, whiteUpdates);

            // Update Black
            const blackUpdates = { 
                games_played: (blackUser.games_played || 0) + 1,
                xp: levelUpdatesB.xp,
                level: levelUpdatesB.level
            };
            if (type === 'chess') {
                blackUpdates.elo_chess = newRatingB;
                blackUpdates.tier_chess = await processTierUpdate(blackId, blackUser.tier_chess, newRatingB, 'chess');
                if (scoreB === 1) blackUpdates.wins_chess = (blackUser.wins_chess || 0) + 1;
                else if (scoreB === 0) blackUpdates.losses_chess = (blackUser.losses_chess || 0) + 1;
            } else {
                blackUpdates.elo_checkers = newRatingB;
                blackUpdates.tier_checkers = await processTierUpdate(blackId, blackUser.tier_checkers, newRatingB, 'checkers');
                if (scoreB === 1) blackUpdates.wins_checkers = (blackUser.wins_checkers || 0) + 1;
                else if (scoreB === 0) blackUpdates.losses_checkers = (blackUser.losses_checkers || 0) + 1;
            }
            await base44.asServiceRole.entities.User.update(blackId, blackUpdates);

            // Record Elo History
            await base44.asServiceRole.entities.EloHistory.create({
                user_id: whiteId,
                game_type: type,
                old_elo: ratingA,
                new_elo: newRatingA,
                change_amount: newRatingA - ratingA,
                game_id: gameId,
                reason: winnerId === whiteId ? 'game_win' : (winnerId === blackId ? 'game_loss' : 'game_draw')
            });

            await base44.asServiceRole.entities.EloHistory.create({
                user_id: blackId,
                game_type: type,
                old_elo: ratingB,
                new_elo: newRatingB,
                change_amount: newRatingB - ratingB,
                game_id: gameId,
                reason: winnerId === blackId ? 'game_win' : (winnerId === whiteId ? 'game_loss' : 'game_draw')
            });
            
            // Notifications for result
            if (whiteId && blackId && whiteId !== blackId) {
                const whiteMsg = winnerId === whiteId ? "Vous avez gagné la partie !" : (winnerId ? "Vous avez perdu la partie." : "Match nul.");
                const blackMsg = winnerId === blackId ? "Vous avez gagné la partie !" : (winnerId ? "Vous avez perdu la partie." : "Match nul.");
                
                await base44.asServiceRole.entities.Notification.create({
                    recipient_id: whiteId,
                    type: "game",
                    title: "Fin de partie",
                    message: `${whiteMsg} vs ${game.black_player_name}`,
                    link: `/Game?id=${gameId}`
                });
                
                await base44.asServiceRole.entities.Notification.create({
                    recipient_id: blackId,
                    type: "game",
                    title: "Fin de partie",
                    message: `${blackMsg} vs ${game.white_player_name}`,
                    link: `/Game?id=${gameId}`
                });
            }
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
    } else if (whiteId && blackId && whiteId !== blackId) {
        // 3. Update LEAGUE Scores if it's a ranked game (non-tournament)
        // Find active leagues for this game type
        try {
            const activeLeagues = await base44.asServiceRole.entities.League.list({ 
                status: 'active', 
                game_type: type 
            });
            
            if (activeLeagues && activeLeagues.length > 0) {
                // Update stats for all active leagues where users are participants
                for (const league of activeLeagues) {
                    const participants = await base44.asServiceRole.entities.LeagueParticipant.list({
                        league_id: league.id,
                        user_id: { '$in': [whiteId, blackId] } // Filter is nicer if supported, otherwise fetch individually
                    });
                    // Note: The above list query might not work perfectly if $in is not supported by Base44 SDK mock,
                    // fallback to checking individually. Assuming basic filter works.
                    // If not, we'd do loop. Let's do safe loop.
                    
                    const whiteParticipant = (await base44.asServiceRole.entities.LeagueParticipant.list({ league_id: league.id, user_id: whiteId }))[0];
                    const blackParticipant = (await base44.asServiceRole.entities.LeagueParticipant.list({ league_id: league.id, user_id: blackId }))[0];

                    const updateParticipant = async (p, isWinner, isDraw) => {
                        if (!p) return;
                        const points = isWinner ? 3 : (isDraw ? 1 : 0); // 3 points for win, 1 for draw
                        const newPoints = (p.points || 0) + points;
                        
                        // Advanced tier calculation
                        let tier = p.rank_tier;
                        if (newPoints < 100) tier = 'bronze';
                        else if (newPoints < 250) tier = 'silver';
                        else if (newPoints < 500) tier = 'gold';
                        else if (newPoints < 800) tier = 'diamond';
                        else tier = 'master';

                        // Check for badges
                        if (tier !== p.rank_tier && tier === 'gold') {
                            await base44.asServiceRole.entities.UserBadge.create({
                                user_id: p.user_id,
                                name: "Promotion Or",
                                icon: "Crown",
                                awarded_at: new Date().toISOString()
                            });
                        }
                        if (tier !== p.rank_tier && tier === 'master') {
                            await base44.asServiceRole.entities.UserBadge.create({
                                user_id: p.user_id,
                                name: "Maître de la Ligue",
                                icon: "Trophy",
                                awarded_at: new Date().toISOString()
                            });
                        }
                        
                        await base44.asServiceRole.entities.LeagueParticipant.update(p.id, {
                            points: newPoints,
                            wins: (p.wins || 0) + (isWinner ? 1 : 0),
                            losses: (p.losses || 0) + (isWinner || isDraw ? 0 : 1),
                            draws: (p.draws || 0) + (isDraw ? 1 : 0),
                            rank_tier: tier
                        });
                    };

                    const isDraw = !winnerId;
                    await updateParticipant(whiteParticipant, winnerId === whiteId, isDraw);
                    await updateParticipant(blackParticipant, winnerId === blackId, isDraw);
                }
            }
        } catch (err) {
            console.error("Error updating leagues", err);
        }
    }

    return Response.json({ status: 'success', message: 'Elo and scores updated' });
}

Deno.serve(handler);