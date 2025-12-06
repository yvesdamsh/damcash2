import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        
        // Parse body safely
        let body = {};
        try { body = await req.json(); } catch(e) {}
        const { gameId } = body;
        
        if (!gameId) return Response.json({error: "No gameId"}, {status: 400});

        // 1. Fetch Game (Always fresh)
        const gamePromise = base44.entities.Game.get(gameId);
        
        // 2. Fetch Chat (Last 50)
        const messagesPromise = base44.entities.ChatMessage.filter(
            { game_id: gameId }, 
            '-created_date', 
            50
        );

        // 3. Fetch Signals (If user authenticated)
        let signalsPromise = Promise.resolve([]);
        let currentUser = null;
        
        try {
            currentUser = await base44.auth.me();
            if (currentUser) {
                signalsPromise = base44.entities.SignalMessage.filter({ 
                    game_id: gameId, 
                    recipient_id: currentUser.id 
                }, '-created_date', 10);
            }
        } catch(e) {
            // User might be guest or not logged in
        }

        const [game, messages, signals] = await Promise.all([
            gamePromise,
            messagesPromise,
            signalsPromise
        ]);

        // Process signals: We can't delete them safely here without risking data loss if response fails.
        // But we can return them and let client handle deletion or just ignore duplicates.

        return Response.json({
            game,
            messages: messages ? messages.sort((a,b) => new Date(a.created_date) - new Date(b.created_date)) : [],
            signals: signals || []
        });

    } catch (e) {
        return Response.json({ error: e.message }, { status: 500 });
    }
});