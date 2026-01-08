import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';
import { z } from 'npm:zod@3.24.2';

const schema = z.object({ tournamentId: z.string().min(1), round: z.number().int().min(1) });

function byScoreDesc(a, b) { return (b.score || 0) - (a.score || 0); }

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const me = await base44.auth.me();
    if (!me) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    // Admin or owner only
    if (me.role !== 'admin') return Response.json({ error: 'Forbidden' }, { status: 403 });

    const v = schema.safeParse(await req.json().catch(() => ({})));
    if (!v.success) return Response.json({ error: 'Invalid input', details: v.error.flatten() }, { status: 400 });

    const { tournamentId, round } = v.data;

    const t = await base44.asServiceRole.entities.Tournament.get(tournamentId);
    if (!t) return Response.json({ error: 'Tournament not found' }, { status: 404 });

    // Load active participants ordered by score
    let participants = await base44.asServiceRole.entities.TournamentParticipant.filter({ tournament_id: tournamentId, status: 'active' });
    participants = participants.sort(byScoreDesc);

    const pairings = [];
    const used = new Set();

    for (let i = 0; i < participants.length; i++) {
      if (used.has(participants[i].id)) continue;
      let opponent = null;
      for (let j = i + 1; j < participants.length; j++) {
        if (!used.has(participants[j].id)) { opponent = participants[j]; break; }
      }
      if (opponent) {
        used.add(participants[i].id);
        used.add(opponent.id);
        pairings.push([participants[i], opponent]);
      } else {
        // Bye for last odd player
        pairings.push([participants[i], null]);
        used.add(participants[i].id);
      }
    }

    // Create games for this round (public waiting games)
    const createdGames = [];
    for (const [p1, p2] of pairings) {
      if (!p2) {
        // Award bye point
        await base44.asServiceRole.entities.TournamentParticipant.update(p1.id, { score: (p1.score || 0) + 1, games_played: (p1.games_played || 0) + 1 });
        continue;
      }
      const game = await base44.asServiceRole.entities.Game.create({
        status: 'waiting',
        game_type: t.game_type,
        white_player_id: p1.user_id,
        white_player_name: p1.user_name,
        black_player_id: p2.user_id,
        black_player_name: p2.user_name,
        current_turn: 'white',
        board_state: t.game_type === 'chess' ? JSON.stringify({ board: Array(8).fill(null).map(()=>Array(8).fill(null)), castlingRights: { wK: true, wQ: true, bK: true, bQ: true }, lastMove: null }) : JSON.stringify(Array(10).fill(null).map(()=>Array(10).fill(0))),
        is_private: false,
        tournament_id: t.id,
        tournament_round: round
      });
      createdGames.push(game);
    }

    // Advance current round
    await base44.asServiceRole.entities.Tournament.update(t.id, { current_round: round });

    return Response.json({ success: true, pairings: pairings.map(p => p.map(x => x && x.user_id)), games: createdGames });
  } catch (e) {
    return Response.json({ error: e.message }, { status: 500 });
  }
});