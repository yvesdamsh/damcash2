import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';
import { z } from 'npm:zod@3.24.2';

const schema = z.object({
  gameId: z.string().min(1),
  userId: z.string().optional() // ignored; rely on auth
});

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const me = await base44.auth.me();
    if (!me) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const v = schema.safeParse(await req.json().catch(() => ({})));
    if (!v.success) return Response.json({ error: 'Invalid input', details: v.error.flatten() }, { status: 400 });

    const { gameId } = v.data;
    const game = await base44.asServiceRole.entities.Game.get(gameId);
    if (!game) return Response.json({ error: 'Game not found' }, { status: 404 });

    const isWhite = me.id === game.white_player_id;
    const isBlack = me.id === game.black_player_id;
    if (!isWhite && !isBlack) return Response.json({ error: 'Forbidden: not a player' }, { status: 403 });

    const winnerId = isWhite ? game.black_player_id : game.white_player_id;

    // Finish game
    const updateData = { status: 'finished', winner_id: winnerId, updated_date: new Date().toISOString() };
    await base44.asServiceRole.entities.Game.update(gameId, updateData);

    // Fan out immediately
    try { await base44.asServiceRole.functions.invoke('gameSocket', { gameId, type: 'GAME_UPDATE', payload: updateData }); } catch (_) {}

    // Process result (ELO, wallets, etc.)
    try {
      await base44.asServiceRole.functions.invoke('processGameResult', { gameId, outcome: { winnerId, result: 'resignation' } });
    } catch (_) {}

    return Response.json({ success: true, winnerId });
  } catch (e) {
    return Response.json({ error: e.message }, { status: 500 });
  }
});