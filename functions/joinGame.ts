import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';
import { z } from 'npm:zod@3.24.2';

const gameUpdates = new BroadcastChannel('game_updates');

// Ensure function is served via Deno.serve wrapper per platform requirements
Deno.serve(handler);

const joinGameSchema = z.object({
    gameId: z.string().min(1, "Game ID is required")
});

export default async function handler(req) {
    if (req.method !== 'POST') {
        return new Response("Method not allowed", { status: 405 });
    }

    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();
        
        if (!user) {
            return Response.json({ error: "Unauthorized" }, { status: 401 });
        }

        const body = await req.json();
        const validation = joinGameSchema.safeParse(body);

        if (!validation.success) {
            return Response.json({ error: "Invalid input", details: validation.error.format() }, { status: 400 });
        }

        const { gameId } = validation.data;

        // Check active games limit
        const [activeWhiteRaw, activeBlackRaw] = await Promise.all([
            base44.entities.Game.filter({ white_player_id: user.id, status: 'playing' }),
            base44.entities.Game.filter({ black_player_id: user.id, status: 'playing' })
        ]);

        // Autoriser si l'unique partie "en cours" est précisément celle qu'on tente de rejoindre
        const activeWhite = (activeWhiteRaw || []).filter(g => g.id !== gameId);
        const activeBlack = (activeBlackRaw || []).filter(g => g.id !== gameId);

        if (activeWhite.length > 0 || activeBlack.length > 0) {
            return Response.json({ error: "Vous avez déjà une partie en cours." }, { status: 400 });
        }

        // Get the game to check status and vacancy
        const game = await base44.entities.Game.get(gameId);

        // If the user already owns a seat in this game, just return success
        if (game.white_player_id === user.id || game.black_player_id === user.id) {
            return Response.json({ success: true, game });
        }
        if (!game) {
            return Response.json({ error: "Game not found" }, { status: 404 });
        }

        const seatAvailable = !game.white_player_id || !game.black_player_id;
        if (!(game.status === 'waiting' || (game.status === 'playing' && seatAvailable))) {
            return Response.json({ error: "Game is not accepting players" }, { status: 400 });
        }

        // Determine role
        const updateData = {
            status: 'playing',
            current_turn: 'white', // Ensure turn starts correctly
            last_move_at: new Date().toISOString() // Start clock
        };

        if (!game.white_player_id) {
            updateData.white_player_id = user.id;
            updateData.white_player_name = user.full_name || user.username || 'Joueur 1';
        } else if (!game.black_player_id) {
            updateData.black_player_id = user.id;
            updateData.black_player_name = user.full_name || user.username || 'Joueur 2';
        } else {
            return Response.json({ error: "Game is full" }, { status: 400 });
        }

        // SECURITY: Handle Entry Fee
        if (game.entry_fee && game.entry_fee > 0) {
            const wallets = await base44.asServiceRole.entities.Wallet.filter({ user_id: user.id });
            let wallet = wallets[0];
            if (!wallet) wallet = await base44.asServiceRole.entities.Wallet.create({ user_id: user.id, balance: 0 });

            if ((wallet.balance || 0) < game.entry_fee) {
                return Response.json({ error: "Insufficient funds for entry fee" }, { status: 402 });
            }

            // Deduct Fee
            await base44.asServiceRole.entities.Wallet.update(wallet.id, {
                balance: wallet.balance - game.entry_fee
            });

            // Record Transaction
            await base44.asServiceRole.entities.Transaction.create({
                user_id: user.id,
                type: 'entry_fee',
                amount: -game.entry_fee,
                game_id: gameId,
                status: 'completed',
                description: 'Mise de jeu (Join)'
            });

            // Add to Prize Pool
            updateData.prize_pool = (game.prize_pool || 0) + game.entry_fee;
        }

        // Perform Update
        const updatedGame = await base44.asServiceRole.entities.Game.update(gameId, updateData);

        // Broadcast start with explicit player fields to avoid stale caches on clients
        gameUpdates.postMessage({
            gameId,
            type: 'GAME_UPDATE',
            payload: {
                id: updatedGame.id,
                status: updatedGame.status,
                current_turn: updatedGame.current_turn,
                last_move_at: updatedGame.last_move_at,
                white_player_id: updatedGame.white_player_id,
                white_player_name: updatedGame.white_player_name,
                black_player_id: updatedGame.black_player_id,
                black_player_name: updatedGame.black_player_name,
                updated_date: new Date().toISOString()
            }
        });
        // Also trigger a refetch signal for clients that rely on it
        gameUpdates.postMessage({
            gameId,
            type: 'GAME_REFETCH'
        });

        // Notify opponent
        const opponentId = updatedGame.white_player_id === user.id ? updatedGame.black_player_id : updatedGame.white_player_id;
        if (opponentId) {
            // We don't await this to avoid blocking response
            base44.asServiceRole.functions.invoke('sendNotification', {
                recipient_id: opponentId,
                type: 'game',
                title: 'Partie commencée !',
                message: `${user.full_name || user.username || 'Un joueur'} a rejoint la partie. À vous de jouer !`,
                link: `/Game?id=${gameId}`
            }).catch(console.error);
        }

        return Response.json({ success: true, game: updatedGame });

    } catch (e) {
        console.error("Join error:", e);
        return Response.json({ error: e.message }, { status: 500 });
    }
}