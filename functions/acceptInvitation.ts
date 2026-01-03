import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';
const gameUpdates = new BroadcastChannel('game_updates');

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const invitationId = body.invitationId;
    if (!invitationId) return Response.json({ error: 'Missing invitationId' }, { status: 400 });

    const inv = await base44.asServiceRole.entities.Invitation.get(invitationId);
    if (!inv || inv.status !== 'pending') {
      return Response.json({ error: 'Invitation not pending' }, { status: 409 });
    }

    // Validate recipient (by email) when available
    if (inv.to_user_email && user.email && inv.to_user_email.toLowerCase() !== user.email.toLowerCase()) {
      return Response.json({ error: 'Invitation not addressed to you' }, { status: 403 });
    }

    if (!inv.game_id) return Response.json({ error: 'Invitation without game' }, { status: 400 });

    // Fetch game and ensure seat available
    const game = await base44.asServiceRole.entities.Game.get(inv.game_id);
    if (!game) return Response.json({ error: 'Game not found' }, { status: 404 });

    // If already in game, accept harmlessly
    const alreadyPlayer = (game.white_player_id === user.id) || (game.black_player_id === user.id);

    // Determine target color (if black empty, join as black, else white if empty)
    let updateData = {};
    if (!alreadyPlayer) {
      if (!game.black_player_id) {
        updateData = { black_player_id: user.id, black_player_name: user.username || user.full_name || 'Player' };
      } else if (!game.white_player_id) {
        updateData = { white_player_id: user.id, white_player_name: user.username || user.full_name || 'Player' };
      } else {
        // Race lost
        await base44.asServiceRole.entities.Invitation.update(invitationId, { status: 'declined' });
        return Response.json({ error: 'Game is full' }, { status: 409 });
      }

      // Apply update (seat assignment only)
      await base44.asServiceRole.entities.Game.update(game.id, updateData);
      // Set status to playing only when both players present
      const fresh = await base44.asServiceRole.entities.Game.get(game.id);
      if (fresh.white_player_id && fresh.black_player_id && fresh.status === 'waiting') {
        await base44.asServiceRole.entities.Game.update(game.id, { status: 'playing' });
      }
    }

    // Mark invitation accepted
    await base44.asServiceRole.entities.Invitation.update(invitationId, { status: 'accepted' });

    // Broadcast immediate update to both clients
    const latest = await base44.asServiceRole.entities.Game.get(game.id);
    gameUpdates.postMessage({
      gameId: latest.id,
      type: 'GAME_UPDATE',
      payload: {
        id: latest.id,
        status: latest.status,
        white_player_id: latest.white_player_id,
        white_player_name: latest.white_player_name,
        black_player_id: latest.black_player_id,
        black_player_name: latest.black_player_name,
        updated_date: new Date().toISOString()
      }
    });
    gameUpdates.postMessage({ gameId: latest.id, type: 'GAME_REFETCH' });

    return Response.json({ gameId: game.id });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});