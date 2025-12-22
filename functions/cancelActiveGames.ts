import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

const gameUpdates = new BroadcastChannel('game_updates');

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    // Find all active (playing) games where the user is seated
    const [asWhite, asBlack] = await Promise.all([
      base44.asServiceRole.entities.Game.filter({ white_player_id: user.id, status: 'playing' }),
      base44.asServiceRole.entities.Game.filter({ black_player_id: user.id, status: 'playing' })
    ]);

    const games = [...(asWhite || []), ...(asBlack || [])];
    if (games.length === 0) {
      return Response.json({ success: true, aborted: 0 });
    }

    const now = new Date().toISOString();

    // Abort all such games
    await Promise.all(games.map(async (g) => {
      const updated = await base44.asServiceRole.entities.Game.update(g.id, {
        status: 'aborted',
        winner_id: null,
        draw_offer_by: null,
        takeback_requested_by: null,
        updated_date: now
      });

      // Notify listeners (sockets/pollers)
      try {
        gameUpdates.postMessage({
          gameId: g.id,
          type: 'GAME_UPDATE',
          payload: {
            id: g.id,
            status: 'aborted',
            winner_id: null,
            updated_date: now
          }
        });
        gameUpdates.postMessage({ gameId: g.id, type: 'GAME_REFETCH' });
      } catch (_) {}

      return updated;
    }));

    return Response.json({ success: true, aborted: games.length });
  } catch (e) {
    console.error('cancelActiveGames error:', e);
    return Response.json({ error: e.message }, { status: 500 });
  }
});