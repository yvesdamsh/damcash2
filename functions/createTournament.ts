import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';
import { z } from 'npm:zod@3.24.2';
import { initializeChessBoard } from './validation/chess.js';
import { initializeBoard as initializeCheckers } from './validation/checkers.js';

const schema = z.object({
  name: z.string().min(3),
  gameType: z.enum(['checkers','chess']),
  format: z.enum(['bracket','arena','swiss','hybrid']).default('bracket'),
  maxParticipants: z.number().int().min(2).max(512),
  startTime: z.string().datetime(),
  prizePool: z.number().nonnegative().default(0),
  entryFee: z.number().nonnegative().default(0)
});

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const me = await base44.auth.me();
    if (!me) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const input = await req.json().catch(() => ({}));
    const v = schema.safeParse(input);
    if (!v.success) return Response.json({ error: 'Invalid input', details: v.error.flatten() }, { status: 400 });

    const { name, gameType, format, maxParticipants, startTime, prizePool, entryFee } = v.data;

    const startISO = (() => {
      try { return new Date(startTime).toISOString(); } catch { return new Date().toISOString(); }
    })();

    // Basic sensible defaults
    const defaultRounds = format === 'swiss' ? 5 : 3;
    const tournament = await base44.asServiceRole.entities.Tournament.create({
      name,
      description: null,
      game_type: gameType,
      format,
      rounds: defaultRounds,
      time_control: '5+0',
      max_players: maxParticipants,
      start_date: startISO,
      end_date: null,
      status: 'open',
      prize_pool: prizePool || 0,
      entry_fee: entryFee || 0,
      created_by_user_id: me.id,
      is_private: false
    });

    // Pre-create a sample first-round pairing preview game (optional): ensure proper initial board when created later
    const initialBoardState = gameType === 'chess' ? JSON.stringify({
      board: initializeChessBoard(),
      castlingRights: { wK: true, wQ: true, bK: true, bQ: true },
      lastMove: null,
      halfMoveClock: 0,
      positionHistory: {}
    }) : JSON.stringify(initializeCheckers());
    // Note: We don't persist a game here, but keep the correct template ready if used.

    // Broadcast lightweight update (best effort)
    try {
      await base44.asServiceRole.functions.invoke('tournamentSocket', {
        type: 'TOURNAMENT_UPDATE',
        tournamentId: tournament.id,
        payload: { id: tournament.id, status: tournament.status, updated_date: new Date().toISOString() }
      });
    } catch (_) {}

    return Response.json({ tournamentId: tournament.id, tournament });
  } catch (e) {
    return Response.json({ error: e.message }, { status: 500 });
  }
});