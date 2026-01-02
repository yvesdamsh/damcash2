import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
    const start = Date.now();
    try {
        const base44 = createClientFromRequest(req);

        // Parse body safely
        let body = {};
        try { body = await req.json(); } catch (_) {}
        const gameId = body?.gameId;
        if (!gameId) return Response.json({ error: 'No gameId' }, { status: 400 });

        // Helper: wrap promises with timeout to avoid hanging -> 502
        const withTimeout = async (promise, ms, label) => {
            const result = await Promise.race([
                promise.then((v) => ({ ok: true, v })).catch((e) => ({ ok: false, e })),
                new Promise((resolve) => setTimeout(() => resolve({ ok: false, e: new Error('timeout') }), ms))
            ]);
            if (!result.ok) {
                console.error('[pollGameUpdates]', label, 'failed:', result.e?.message || result.e);
                return null;
            }
            return result.v;
        };

        // Auth is optional
        let currentUser = null;
        try { currentUser = await withTimeout(base44.auth.me(), 1000, 'auth.me'); } catch (_) {}

        // Parallel fetches with timeouts
        const gamePromise = withTimeout(base44.entities.Game.get(gameId), 3000, 'Game.get');
        const messagesPromise = withTimeout(
            base44.entities.ChatMessage.filter({ game_id: gameId }, '-created_date', 50),
            3000,
            'ChatMessage.filter'
        );
        const signalsPromise = currentUser
            ? withTimeout(
                base44.entities.SignalMessage.filter({ game_id: gameId, recipient_id: currentUser.id }, '-created_date', 10),
                3000,
                'SignalMessage.filter'
              )
            : Promise.resolve([]);

        const [game, messagesRaw, signals] = await Promise.all([
            gamePromise,
            messagesPromise,
            signalsPromise
        ]);

        const messages = Array.isArray(messagesRaw)
            ? messagesRaw.sort((a, b) => new Date(a.created_date) - new Date(b.created_date))
            : [];

        const duration = Date.now() - start;
        console.log('[pollGameUpdates] ok', { gameId, duration, gotGame: !!game, messages: messages.length, signals: Array.isArray(signals) ? signals.length : 0 });

        return Response.json({ game, messages, signals: signals || [] });
    } catch (e) {
        console.error('[pollGameUpdates] error', e?.message || e);
        return Response.json({ error: e.message || String(e) }, { status: 500 });
    }
});