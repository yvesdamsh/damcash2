import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';
import { z } from 'npm:zod@3.24.2';
import { getValidChessMoves, executeChessMove, checkChessStatus, isInCheck } from './validation/chess.js';
import { getValidMoves as getCheckersValidMoves, executeMove as execCheckersMove, checkWinner as checkCheckersWinner, getMovesForPiece } from './validation/checkers.js';

const schema = z.object({
  gameId: z.string().min(1),
  userId: z.string().optional(), // ignored; rely on auth
  move: z.object({
    from: z.object({ r: z.number().int().min(0), c: z.number().int().min(0) }),
    to: z.object({ r: z.number().int().min(0), c: z.number().int().min(0) }),
    captured: z.any().optional(),
    promotion: z.string().optional()
  })
});

function parseTC(game) {
  return { minutes: Number(game.initial_time || 10), inc: Number(game.increment || 0) };
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const me = await base44.auth.me();
    if (!me) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const input = await req.json().catch(() => ({}));
    const v = schema.safeParse(input);
    if (!v.success) return Response.json({ error: 'Invalid input', details: v.error.flatten() }, { status: 400 });

    const { gameId, move } = v.data;
    try { console.log('[MAKE_MOVE][IN]', { gameId, move }); } catch (_) {}

    // Load game
    const game = await base44.asServiceRole.entities.Game.get(gameId);
    if (!game) return Response.json({ error: 'Game not found' }, { status: 404 });

    // Permissions: must be a seated player and their turn (ignore provided userId)
    const myColor = (me.id === game.white_player_id) ? 'white' : (me.id === game.black_player_id ? 'black' : null);
    if (!myColor) return Response.json({ error: 'Forbidden: not a player' }, { status: 403 });
    if (game.status !== 'playing' && game.status !== 'waiting') return Response.json({ error: 'Game is not active' }, { status: 409 });
    if (game.current_turn !== myColor) return Response.json({ error: 'Not your turn' }, { status: 409 });

    const { minutes, inc } = parseTC(game);

    let newBoard;
    let status = game.status;
    let winnerId = null;
    let nextTurn = (myColor === 'white') ? 'black' : 'white';
    const nowIso = new Date().toISOString();

    // Timers: deduct elapsed for current player, then add increment
    let whiteLeft = Number(game.white_seconds_left || minutes * 60);
    let blackLeft = Number(game.black_seconds_left || minutes * 60);
    if (game.last_move_at) {
      const elapsed = (Date.now() - new Date(game.last_move_at).getTime()) / 1000;
      if (myColor === 'white') whiteLeft = Math.max(0, whiteLeft - elapsed + inc);
      else blackLeft = Math.max(0, blackLeft - elapsed + inc);
    }

    // Moves history
    const history = (() => { try { return JSON.parse(game.moves || '[]'); } catch { return []; } })();

    if (game.game_type === 'chess') {
      // Parse board state
      let state; try { state = JSON.parse(game.board_state || '{}'); } catch { state = {}; }
      const board = Array.isArray(state.board) ? state.board : [];
      const castling = state.castlingRights || { wK: true, wQ: true, bK: true, bQ: true };
      const lastMove = state.lastMove || null;

      // Validate move
      const valids = getValidChessMoves(board, myColor, lastMove, castling);
      const isValid = valids.some(m => m.from.r === move.from.r && m.from.c === move.from.c && m.to.r === move.to.r && m.to.c === move.to.c);
      if (!isValid) return Response.json({ error: 'Illegal move' }, { status: 400 });

      // Execute
      const { board: b2, piece } = executeChessMove(board, move);
      newBoard = b2;

      // Update castling rights
      const cast = { ...castling };
      if (piece && piece.toLowerCase() === 'k') {
        if (myColor === 'white') { cast.wK = false; cast.wQ = false; } else { cast.bK = false; cast.bQ = false; }
      }
      if (piece && piece.toLowerCase() === 'r') {
        if (move.from.r === 7 && move.from.c === 0) cast.wQ = false;
        if (move.from.r === 7 && move.from.c === 7) cast.wK = false;
        if (move.from.r === 0 && move.from.c === 0) cast.bQ = false;
        if (move.from.r === 0 && move.from.c === 7) cast.bK = false;
      }
      if (move.captured) {
        if (move.to.r === 0 && move.to.c === 0) cast.bQ = false;
        if (move.to.r === 0 && move.to.c === 7) cast.bK = false;
        if (move.to.r === 7 && move.to.c === 0) cast.wQ = false;
        if (move.to.r === 7 && move.to.c === 7) cast.wK = false;
      }

      const halfMoveClock = (move.captured || (piece && piece.toLowerCase() === 'p')) ? 0 : ((state.halfMoveClock || 0) + 1);

      // Status (checkmate/stalemate etc.)
      const gameStatus = checkChessStatus(newBoard, nextTurn, { ...move, piece }, cast, halfMoveClock, state.positionHistory || {});
      if (gameStatus === 'checkmate') { status = 'finished'; winnerId = myColor === 'white' ? game.white_player_id : game.black_player_id; }
      else if (gameStatus !== 'playing') { status = 'finished'; }

      const newState = {
        board: newBoard,
        castlingRights: cast,
        lastMove: { ...move, piece },
        halfMoveClock,
        positionHistory: state.positionHistory || {}
      };

      history.push({ type: 'chess', from: move.from, to: move.to, captured: !!move.captured, promotion: move.promotion, board: JSON.stringify(newState) });

      const updateData = {
        board_state: JSON.stringify(newState),
        current_turn: status === 'finished' ? game.current_turn : nextTurn,
        status,
        winner_id: winnerId || null,
        moves: JSON.stringify(history),
        move_count: history.length,
        last_move_at: nowIso,
        white_seconds_left: whiteLeft,
        black_seconds_left: blackLeft
      };

      await base44.asServiceRole.entities.Game.update(gameId, updateData);
      try { await base44.asServiceRole.functions.invoke('gameSocket', { gameId, type: 'GAME_UPDATE', payload: updateData }); } catch (e) { try { console.warn('[MAKE_MOVE][SOCKET_FANOUT][ERR]', e?.message || e); } catch(_) {} }
      try { console.log('[MAKE_MOVE][OUT][CHESS]', { nextTurn: updateData.current_turn, move_count: updateData.move_count }); } catch (_) {}

      return Response.json({ success: true, newBoard: newState, nextTurn: updateData.current_turn, gameStatus: status });
    }

    // CHECKERS
    let board; try { board = JSON.parse(game.board_state || '[]'); } catch { board = []; }

    // Validate move against mandatory capture rule
    const valids = getCheckersValidMoves(board, myColor);
    const chosen = valids.find(m => m.from?.r === move.from.r && m.from?.c === move.from.c && m.to?.r === move.to.r && m.to?.c === move.to.c);
    if (!chosen) return Response.json({ error: 'Illegal move' }, { status: 400 });

    const { newBoard: b2, promoted } = execCheckersMove(board, [move.from.r, move.from.c], [move.to.r, move.to.c], chosen.captured || move.captured || null);

    // If capture and more captures available from landing square (and not promoted), player must continue (keep turn)
    let mustContinue = false;
    if ((chosen.captured || move.captured) && !promoted) {
      const { captures } = getMovesForPiece(b2, move.to.r, move.to.c, b2[move.to.r][move.to.c], true);
      if (captures && captures.length > 0) mustContinue = true;
    }
    newBoard = b2;

    if (!mustContinue) nextTurn = (myColor === 'white') ? 'black' : 'white'; else nextTurn = myColor;

    const winnerColor = checkCheckersWinner(newBoard);
    if (winnerColor) {
      status = 'finished';
      winnerId = winnerColor === 'white' ? game.white_player_id : game.black_player_id;
    }

    const getNum = (r, c) => r * 5 + Math.floor(c / 2) + 1;
    history.push({ type: 'checkers', from: move.from, to: move.to, captured: !!(chosen.captured || move.captured), board: JSON.stringify(newBoard), notation: `${getNum(move.from.r, move.from.c)}${(chosen.captured||move.captured)?'x':'-'}${getNum(move.to.r, move.to.c)}` });

    const updateData = {
      board_state: JSON.stringify(newBoard),
      current_turn: status === 'finished' ? game.current_turn : nextTurn,
      status,
      winner_id: winnerId || null,
      moves: JSON.stringify(history),
      move_count: history.length,
      last_move_at: nowIso,
      white_seconds_left: whiteLeft,
      black_seconds_left: blackLeft
    };

    await base44.asServiceRole.entities.Game.update(gameId, updateData);
    try { await base44.asServiceRole.functions.invoke('gameSocket', { gameId, type: 'GAME_UPDATE', payload: updateData }); } catch (e) { try { console.warn('[MAKE_MOVE][SOCKET_FANOUT][ERR]', e?.message || e); } catch(_) {} }
    try { console.log('[MAKE_MOVE][OUT][CHECKERS]', { nextTurn: updateData.current_turn, move_count: updateData.move_count }); } catch (_) {}

    return Response.json({ success: true, newBoard, nextTurn: updateData.current_turn, gameStatus: status });
  } catch (e) {
    try { console.error('[MAKE_MOVE][ERR]', e?.message || e); } catch(_) {}
    return Response.json({ error: e.message }, { status: 500 });
  }
});