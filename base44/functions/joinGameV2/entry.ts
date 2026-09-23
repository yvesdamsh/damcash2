import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';
import { z } from 'npm:zod@3.24.2';

const schema = z.object({ gameId: z.string().min(1), userId: z.string().optional() });

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

    // If already seated, success
    if (game.white_player_id === me.id || game.black_player_id === me.id) {
      return Response.json({ success: true, game });
    }

    const update = {};
    if (!game.white_player_id) {
      update.white_player_id = me.id;
      update.white_player_name = me.username || me.full_name || 'Player';
    } else if (!game.black_player_id) {
      update.black_player_id = me.id;
      update.black_player_name = me.username || me.full_name || 'Player';
    } else {
      return Response.json({ error: 'Game is full' }, { status: 409 });
    }

    // Move to playing if both present
    const updated = await base44.asServiceRole.entities.Game.update(gameId, update);
    let final = await base44.asServiceRole.entities.Game.get(gameId);
    if (final.white_player_id && final.black_player_id && final.status === 'waiting') {
      final = await base44.asServiceRole.entities.Game.update(gameId, { status: 'playing', updated_date: new Date().toISOString() });
    }

    // Fanout
    const payload = { id: final.id, status: final.status, white_player_id: final.white_player_id, black_player_id: final.black_player_id, updated_date: new Date().toISOString() };
    try { await base44.asServiceRole.functions.invoke('gameSocket', { gameId, type: 'GAME_UPDATE', payload }); } catch (_) {}

    return Response.json({ success: true, game: final });
  } catch (e) {
    return Response.json({ error: e.message }, { status: 500 });
  }
});