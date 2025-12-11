import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';
import { z } from 'npm:zod@^3.24.2';

const RATE_LIMITS = new Map();
const checkRateLimit = (userId) => {
    const now = Date.now();
    const userLimit = RATE_LIMITS.get(userId) || { count: 0, start: now };
    if (now - userLimit.start > 60000) { userLimit.count = 0; userLimit.start = now; }
    if (userLimit.count >= 10) return false;
    userLimit.count++;
    RATE_LIMITS.set(userId, userLimit);
    return true;
};

const walletSchema = z.object({
    action: z.enum(['get_balance', 'deposit', 'pay_entry_fee', 'withdraw', 'place_bet']),
    userId: z.string().optional(),
    amount: z.number().optional(),
    gameId: z.string().optional()
}).superRefine((data, ctx) => {
    if (data.action === 'deposit') {
        if (data.amount === undefined || data.amount <= 0) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                message: "Amount must be positive for deposit",
                path: ["amount"]
            });
        }
    }
    if (data.action === 'pay_entry_fee') {
        if (!data.gameId) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                message: "Game ID is required for entry fee",
                path: ["gameId"]
            });
        }
        if (data.amount === undefined || data.amount <= 0) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                message: "Amount must be positive for entry fee",
                path: ["amount"]
            });
        }
    }
});

export default async function handler(req) {
    const base44 = createClientFromRequest(req);
    const rawBody = await req.json();

    const validation = walletSchema.safeParse(rawBody);
    if (!validation.success) {
        return Response.json({ error: "Invalid input", details: validation.error.format() }, { status: 400 });
    }

    const { action, userId, amount, gameId } = validation.data;

    // Check Auth (unless service role bypass is safe, but here we prefer secure checks)
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    if (!checkRateLimit(user.id)) {
        return Response.json({ error: 'Rate limit exceeded' }, { status: 429 });
    }

    // Helper to get or create wallet
    const getWallet = async (uid) => {
        const wallets = await base44.asServiceRole.entities.Wallet.filter({ user_id: uid });
        if (wallets.length > 0) return wallets[0];
        return await base44.asServiceRole.entities.Wallet.create({ user_id: uid, balance: 0 });
    };

    // 1. Get Balance
    if (action === 'get_balance') {
        const targetId = userId || user.id;
        if (targetId !== user.id && user.role !== 'admin') {
             return Response.json({ error: 'Unauthorized access to wallet' }, { status: 403 });
        }
        const wallet = await getWallet(targetId);
        return Response.json({ balance: wallet.balance });
    }

    // 2. Deposit (Demo)
    if (action === 'deposit') {
        if (amount <= 0) return Response.json({ error: 'Invalid amount' }, { status: 400 });
        const wallet = await getWallet(userId || user.id);
        
        await base44.asServiceRole.entities.Wallet.update(wallet.id, { 
            balance: (wallet.balance || 0) + amount 
        });
        
        await base44.asServiceRole.entities.Transaction.create({
            user_id: wallet.user_id,
            type: 'deposit',
            amount: amount,
            status: 'completed',
            created_at: new Date().toISOString(),
            description: 'Dépôt de fonds'
        });
        
        return Response.json({ success: true, new_balance: (wallet.balance || 0) + amount });
    }

    // 3. Deduct for Game (Entry Fee)
    if (action === 'pay_entry_fee') {
        if (!gameId || !amount) return Response.json({ error: 'Missing params' }, { status: 400 });
        
        // Security: Verify user is actually in the game/tournament
        const game = await base44.asServiceRole.entities.Game.get(gameId).catch(() => null);
        const tournament = !game ? await base44.asServiceRole.entities.Tournament.get(gameId).catch(() => null) : null;
        
        const isParticipant = 
            (game && (game.white_player_id === user.id || game.black_player_id === user.id)) ||
            (tournament && (await base44.asServiceRole.entities.TournamentParticipant.filter({ tournament_id: gameId, user_id: user.id })).length > 0);

        if (!isParticipant) {
             return Response.json({ error: 'User is not a participant' }, { status: 403 });
        }

        const wallet = await getWallet(user.id);

        if ((wallet.balance || 0) < amount) {
            return Response.json({ error: 'Insufficient funds' }, { status: 400 });
        }

        await base44.asServiceRole.entities.Wallet.update(wallet.id, {
            balance: wallet.balance - amount
        });

        await base44.asServiceRole.entities.Transaction.create({
            user_id: wallet.user_id,
            type: 'entry_fee',
            amount: -amount,
            game_id: gameId,
            status: 'completed',
            description: 'Mise de jeu'
        });

        // Update Prize Pool
        try {
            // Try Game first
            const game = await base44.asServiceRole.entities.Game.get(gameId).catch(() => null);
            if (game) {
                await base44.asServiceRole.entities.Game.update(gameId, {
                    prize_pool: (game.prize_pool || 0) + amount
                });
            } else {
                // Try Tournament
                const tournament = await base44.asServiceRole.entities.Tournament.get(gameId).catch(() => null);
                if (tournament) {
                    await base44.asServiceRole.entities.Tournament.update(gameId, {
                        prize_pool: (tournament.prize_pool || 0) + amount
                    });
                }
            }
        } catch (e) {
            console.error("Failed to update prize pool", e);
        }

        return Response.json({ success: true });
    }

    // 4. Place Bet
    if (action === 'place_bet') {
        const { pick, amount, gameId } = rawBody;
        if (!gameId || !amount || amount <= 0) return Response.json({ error: 'Invalid params' }, { status: 400 });
        
        const wallet = await getWallet(user.id);
        if ((wallet.balance || 0) < amount) {
            return Response.json({ error: 'Fonds insuffisants' }, { status: 400 });
        }

        // Fetch game to calculate odds (simple version: based on ELO)
        const game = await base44.asServiceRole.entities.Game.get(gameId);
        if (!game || game.status !== 'playing') return Response.json({ error: 'Partie non disponible' }, { status: 400 });

        // Simple Odds Calculation
        const ratingA = game.white_player_elo || 1200;
        const ratingB = game.black_player_elo || 1200;
        const probA = 1 / (1 + Math.pow(10, (ratingB - ratingA) / 400));
        
        let odds = 2.0; // Default
        if (pick === 'white') odds = (1 / probA) * 0.9; // 10% house edge
        else if (pick === 'black') odds = (1 / (1 - probA)) * 0.9;
        else if (pick === 'draw') odds = 3.0; // Fixed draw odds for simplicity

        // Cap odds
        odds = Math.max(1.1, Math.min(odds, 10));
        const potential_payout = Math.floor(amount * odds);

        // Deduct
        await base44.asServiceRole.entities.Wallet.update(wallet.id, { balance: wallet.balance - amount });
        
        // Log transaction
        await base44.asServiceRole.entities.Transaction.create({
            user_id: user.id,
            type: 'bet_placed',
            amount: -amount,
            game_id: gameId,
            status: 'completed',
            description: `Pari sur ${pick} (Cote: ${odds.toFixed(2)})`
        });

        // Create Bet
        const bet = await base44.asServiceRole.entities.Bet.create({
            user_id: user.id,
            game_id: gameId,
            pick,
            amount,
            odds,
            potential_payout,
            status: 'pending',
            created_at: new Date().toISOString()
        });

        return Response.json({ success: true, bet });
    }

    // 5. Withdraw
    if (action === 'withdraw') {
        if (!amount || amount <= 0) return Response.json({ error: 'Invalid amount' }, { status: 400 });
        const wallet = await getWallet(userId || user.id);
        
        if ((wallet.balance || 0) < amount) {
            return Response.json({ error: 'Insufficient funds' }, { status: 400 });
        }

        // Deduct balance
        await base44.asServiceRole.entities.Wallet.update(wallet.id, { 
            balance: wallet.balance - amount 
        });
        
        // Log transaction
        await base44.asServiceRole.entities.Transaction.create({
            user_id: wallet.user_id,
            type: 'withdrawal',
            amount: -amount,
            status: 'pending', // Mark as pending for manual processing or API callback
            created_at: new Date().toISOString(),
            description: 'Retrait de fonds'
        });
        
        return Response.json({ success: true, new_balance: wallet.balance - amount });
    }

    return Response.json({ error: 'Invalid action' }, { status: 400 });
}

Deno.serve(handler);