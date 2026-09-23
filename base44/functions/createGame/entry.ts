import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';
import { z } from 'npm:zod@3.24.2';
import { initializeChessBoard } from './validation/chess.js';
import { initializeBoard as initializeCheckers } from './validation/checkers.js';

const schema = z.object({
  gameType: z.enum(['chess','checkers']).default('checkers'),
  whitePlayerId: z.string().optional(),
  blackPlayerId: z.string().optional(),
  timeControl: z.string().default('10+0'), // "minutes+increment"
  isAI: z.boolean().optional(),
  aiDifficulty: z.enum(['easy','medium','hard']).optional()
});

function parseTimeControl(tc) {
  try {
    const [m, inc] = String(tc || '10+0').split('+');
    const minutes = Math.max(1, parseInt(m || '10', 10));
    const increment = Math.max(0, parseInt(inc || '0', 10));
    return { minutes, increment };
  } catch (_) {
    return { minutes: 10, increment: 0 };
  }
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const me = await base44.auth.me();
    if (!me) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const input = await req.json().catch(() => ({}));
    const v = schema.safeParse(input);
    if (!v.success) return Response.json({ error: 'Invalid input', details: v.error.flatten() }, { status: 400 });

    const { gameType, whitePlayerId, blackPlayerId, timeControl, isAI, aiDifficulty } = v.data;
    const { minutes, increment } = parseTimeControl(timeControl);

    // Players
    let whiteId = whitePlayerId || me.id;
    let whiteName = me.username || me.full_name || 'Player';
    let blackId = blackPlayerId || null;
    let blackName = blackPlayerId ? undefined : null;

    // AI option: force AI as opponent if requested and no explicit opponent id
    if (isAI && !blackPlayerId) {
      blackId = 'ai';
      blackName = `AI (${aiDifficulty || 'medium'})`;
    }

    // Initial board
    let boardState;
    if (gameType === 'chess') {
      boardState = JSON.stringify({
        board: initializeChessBoard(),
        castlingRights: { wK: true, wQ: true, bK: true, bQ: true },
        lastMove: null,
        halfMoveClock: 0,
        positionHistory: {}
      });
    } else {
      boardState = JSON.stringify(initializeCheckers());
    }

    // Determine status
    const status = (whiteId && blackId) ? 'playing' : 'waiting';

    const game = await base44.asServiceRole.entities.Game.create({
      status,
      game_type: gameType,
      white_player_id: whiteId,
      white_player_name: whiteName,
      black_player_id: blackId || undefined,
      black_player_name: blackName || undefined,
      current_turn: 'white',
      board_state: boardState,
      moves: '[]',
      white_seconds_left: minutes * 60,
      black_seconds_left: minutes * 60,
      initial_time: minutes,
      increment,
      is_private: false
    });

    // Inform game channel (best-effort)
    try {
      await base44.asServiceRole.functions.invoke('gameSocket', {
        gameId: game.id,
        type: 'GAME_UPDATE',
        payload: { id: game.id, status: game.status, updated_date: new Date().toISOString() }
      });
    } catch (_) {}

    return Response.json({ gameId: game.id, game });
  } catch (e) {
    return Response.json({ error: e.message }, { status: 500 });
  }
});