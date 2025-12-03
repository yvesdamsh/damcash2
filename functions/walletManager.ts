import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

export default async function handler(req) {
    const base44 = createClientFromRequest(req);
    const body = await req.json();
    const { action, userId, amount, gameId } = body;

    // Check Auth (unless service role bypass is safe, but here we prefer secure checks)
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    // Helper to get or create wallet
    const getWallet = async (uid) => {
        const wallets = await base44.asServiceRole.entities.Wallet.filter({ user_id: uid });
        if (wallets.length > 0) return wallets[0];
        return await base44.asServiceRole.entities.Wallet.create({ user_id: uid, balance: 0 });
    };

    // 1. Get Balance
    if (action === 'get_balance') {
        const wallet = await getWallet(userId || user.id);
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
    // This should ideally be called by server when creating/joining game, but we can expose it securely
    // Or trust client for now with validation
    if (action === 'pay_entry_fee') {
        if (!gameId || !amount) return Response.json({ error: 'Missing params' }, { status: 400 });
        const wallet = await getWallet(userId || user.id);

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

    return Response.json({ error: 'Invalid action' }, { status: 400 });
}

Deno.serve(handler);