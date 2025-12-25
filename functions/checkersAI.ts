import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

// Strong Checkers (10x10 draughts) AI with: iterative deepening, alpha-beta, quiescence,
// killer/history heuristics, mobility/safety evaluation, mandatory max-capture rule, and
// support for forced continuation (activePiece).

class DraughtsEngine {
  constructor() {
    this.EMPTY = 0;
    this.WHITE_MAN = 1;
    this.WHITE_KING = 2;
    this.BLACK_MAN = 3;
    this.BLACK_KING = 4;

    this.WHITE = 1;
    this.BLACK = 2;

    this.DIR_UL = 0; // up-left
    this.DIR_UR = 1; // up-right
    this.DIR_DL = 2; // down-left
    this.DIR_DR = 3; // down-right

    this.board = new Int8Array(51);
    this.NEIGHBORS = new Array(51).fill(0).map(() => [0, 0, 0, 0]);
    this.initTables();
  }

  initTables() {
    for (let s = 1; s <= 50; s++) {
      const { r, c } = this.getRC(s);
      this.NEIGHBORS[s][this.DIR_UL] = this.getSquare(r - 1, c - 1);
      this.NEIGHBORS[s][this.DIR_UR] = this.getSquare(r - 1, c + 1);
      this.NEIGHBORS[s][this.DIR_DL] = this.getSquare(r + 1, c - 1);
      this.NEIGHBORS[s][this.DIR_DR] = this.getSquare(r + 1, c + 1);
    }
  }

  getRC(s) {
    const r = Math.floor((s - 1) / 5);
    const pos = (s - 1) % 5;
    const c = (r % 2 === 0) ? (pos * 2 + 1) : (pos * 2);
    return { r, c };
  }

  getSquare(r, c) {
    if (r < 0 || r > 9 || c < 0 || c > 9) return 0;
    const dark = (r % 2 === 0 && c % 2 === 1) || (r % 2 === 1 && c % 2 === 0);
    if (!dark) return 0;
    const pos = Math.floor(c / 2);
    return r * 5 + pos + 1;
  }

  cloneBoard(b) {
    return new Int8Array(b);
  }

  applyMove(board, move) {
    const nb = this.cloneBoard(board);
    const piece = nb[move.from];
    nb[move.from] = this.EMPTY;
    nb[move.to] = piece;
    if (move.isCapture && Array.isArray(move.captured)) {
      for (const cap of move.captured) nb[cap] = this.EMPTY;
    }
    // Promotion
    if (piece === this.WHITE_MAN && move.to <= 5) nb[move.to] = this.WHITE_KING;
    else if (piece === this.BLACK_MAN && move.to >= 46) nb[move.to] = this.BLACK_KING;
    return nb;
  }

  // --- Move Generation ---
  getValidMoves(board, turnColor, onlyFromSquare = null) {
    const captures = [];
    let maxCaptureLen = 0;

    for (let s = 1; s <= 50; s++) {
      if (onlyFromSquare && s !== onlyFromSquare) continue;
      const piece = board[s];
      if (piece === this.EMPTY) continue;
      const color = (piece === this.WHITE_MAN || piece === this.WHITE_KING) ? this.WHITE : this.BLACK;
      if (color !== turnColor) continue;
      const cs = this.findCaptures(board, s, piece);
      if (cs.length) {
        for (const m of cs) {
          if (m.captured.length > maxCaptureLen) maxCaptureLen = m.captured.length;
          captures.push(m);
        }
      }
    }

    if (captures.length) return captures.filter(m => m.captured.length === maxCaptureLen);

    // No captures -> simple moves
    const moves = [];
    for (let s = 1; s <= 50; s++) {
      if (onlyFromSquare && s !== onlyFromSquare) continue;
      const piece = board[s];
      if (piece === this.EMPTY) continue;
      const color = (piece === this.WHITE_MAN || piece === this.WHITE_KING) ? this.WHITE : this.BLACK;
      if (color !== turnColor) continue;
      moves.push(...this.findSimpleMoves(board, s, piece));
    }
    return moves;
  }

  findSimpleMoves(board, square, piece) {
    const moves = [];
    const isKing = (piece === this.WHITE_KING || piece === this.BLACK_KING);
    const isWhite = (piece === this.WHITE_MAN || piece === this.WHITE_KING);
    const dirs = isKing ? [this.DIR_UL, this.DIR_UR, this.DIR_DL, this.DIR_DR] : (isWhite ? [this.DIR_UL, this.DIR_UR] : [this.DIR_DL, this.DIR_DR]);
    for (const d of dirs) {
      let cur = square;
      while (true) {
        const nxt = this.NEIGHBORS[cur][d];
        if (!nxt) break;
        if (board[nxt] === this.EMPTY) {
          moves.push({ from: square, to: nxt, captured: [], isCapture: false });
          if (!isKing) break; // men move 1 step
          cur = nxt; // kings can glide
        } else break;
      }
    }
    return moves;
  }

  findCaptures(board, square, piece) {
    const captures = [];
    const isKing = (piece === this.WHITE_KING || piece === this.BLACK_KING);
    const isWhite = (piece === this.WHITE_MAN || piece === this.WHITE_KING);
    const enemyMan = isWhite ? this.BLACK_MAN : this.WHITE_MAN;
    const enemyKing = isWhite ? this.BLACK_KING : this.WHITE_KING;
    const dirs = [this.DIR_UL, this.DIR_UR, this.DIR_DL, this.DIR_DR];

    const dfs = (curSq, taken, path) => {
      let extended = false;
      for (const d of dirs) {
        let seenEnemySq = 0;
        let travel = curSq;
        while (true) {
          const nxt = this.NEIGHBORS[travel][d];
          if (!nxt) break;
          const cell = board[nxt];
          if (cell === this.EMPTY) {
            if (seenEnemySq) {
              if (taken.includes(seenEnemySq)) break; // cannot recapture same piece
              // landing after a capture
              extended = true;
              // simulate landing by adding to path and continue
              const newPath = [...path, nxt];
              const newTaken = [...taken, seenEnemySq];
              // Temporarily remove enemy to allow multi-capture exploration
              const saved = board[seenEnemySq];
              const savedFrom = board[curSq];
              board[seenEnemySq] = this.EMPTY;
              board[curSq] = this.EMPTY;
              const tmpPiece = savedFrom;
              board[nxt] = tmpPiece;
              dfs(nxt, newTaken, newPath);
              // Undo temp
              board[nxt] = this.EMPTY;
              board[curSq] = savedFrom;
              board[seenEnemySq] = saved;

              if (!isKing) break; // men jump only one square landing choice per dir
            } else {
              if (!isKing) break; // men cannot slide before capture
              // keep sliding searching for enemy
              travel = nxt;
            }
          } else if (cell === enemyMan || cell === enemyKing) {
            if (seenEnemySq) break; // cannot have two in a row
            seenEnemySq = nxt;
            // continue to look for empty landing squares after enemy
            travel = nxt;
          } else {
            break; // own piece blocking
          }
        }
      }
      if (!extended && taken.length) {
        captures.push({ from: square, to: curSq, captured: taken, isCapture: true, path });
      }
    };

    dfs(square, [], []);
    return captures;
  }

  // --- Evaluation ---
  evaluate(board, turnColor) {
    const oppDir = (d) => (d===this.DIR_UL?this.DIR_DR : d===this.DIR_UR?this.DIR_DL : d===this.DIR_DL?this.DIR_UR : this.DIR_UL);
    const mobility = (b, s, p) => {
      let m = 0;
      const isKing = (p === this.WHITE_KING || p === this.BLACK_KING);
      const isWhite = (p === this.WHITE_MAN || p === this.WHITE_KING);
      const dirs = isKing ? [this.DIR_UL, this.DIR_UR, this.DIR_DL, this.DIR_DR] : (isWhite ? [this.DIR_UL, this.DIR_UR] : [this.DIR_DL, this.DIR_DR]);
      for (const d of dirs) {
        let cur = s; let steps = 0;
        while (true) {
          const nxt = this.NEIGHBORS[cur][d];
          if (!nxt) break;
          if (b[nxt] !== this.EMPTY) break;
          m++; steps++; cur = nxt;
          if (!isKing || steps >= 3) break; // limit look-ahead
        }
      }
      return m;
    };
    const capturable = (b, s, isWhitePiece) => {
      const dirs = [this.DIR_UL, this.DIR_UR, this.DIR_DL, this.DIR_DR];
      for (const d of dirs) {
        const enemySq = this.NEIGHBORS[s][d];
        if (!enemySq) continue;
        const ep = b[enemySq];
        if (!ep || ep === this.EMPTY) continue;
        const enemyIsWhite = (ep === this.WHITE_MAN || ep === this.WHITE_KING);
        if (enemyIsWhite === isWhitePiece) continue;
        const landing = this.NEIGHBORS[s][oppDir(d)];
        if (landing && b[landing] === this.EMPTY) return true;
      }
      return false;
    };

    let w = 0, bl = 0;
    const centerRows = new Set([4, 5]);
    for (let i = 1; i <= 50; i++) {
      const p = board[i];
      if (p === this.EMPTY) continue;
      const r = Math.floor((i - 1) / 5);
      const isWhite = (p === this.WHITE_MAN || p === this.WHITE_KING);
      const isKing = (p === this.WHITE_KING || p === this.BLACK_KING);
      let val = isKing ? 340 : 100; // material
      if (!isKing) val += (isWhite ? (9 - r) : r) * 3.5; // advancement
      if (centerRows.has(r)) val += 5; // center
      if (!isKing && ((isWhite && i >= 46) || (!isWhite && i <= 5))) val += 6; // back rank guard
      if (!isKing) { // near promotion
        const dist = isWhite ? r : (9 - r);
        if (dist <= 2) val += (3 - dist) * 14;
      }
      val += mobility(board, i, p) * 2; // mobility
      if (capturable(board, i, isWhite)) val -= isKing ? 160 : 95; // hanging
      if (isWhite) w += val; else bl += val;
    }
    const tempo = 10;
    const base = (w - bl) + (turnColor === this.WHITE ? tempo : -tempo);
    return (turnColor === this.WHITE) ? base : -base;
  }

  // --- Quiescence (captures only) ---
  quiescence(board, alpha, beta, turnColor, heroColor) {
    const stand = this.evaluate(board, heroColor);
    if (stand >= beta) return beta;
    if (alpha < stand) alpha = stand;

    const moves = this.getValidMoves(board, turnColor).filter(m => m.isCapture);
    if (!moves.length) return stand;

    // Simple MVV/LVA proxy: sort by captured length desc
    moves.sort((a, b) => (b.captured?.length || 0) - (a.captured?.length || 0));
    for (const mv of moves) {
      const nb = this.applyMove(board, mv);
      const nt = (turnColor === this.WHITE) ? this.BLACK : this.WHITE;
      const score = -this.quiescence(nb, -beta, -alpha, nt, heroColor);
      if (score >= beta) return beta;
      if (score > alpha) alpha = score;
    }
    return alpha;
  }

  // --- Search with heuristics and time ---
  getBestMove(board, heroColor, options = { maxDepth: 5, timeMs: 800, onlyFromSquare: null }) {
    const { maxDepth, timeMs, onlyFromSquare } = options || {};
    const killers = Array.from({ length: 64 }, () => []);
    const history = new Map();
    const deadline = Date.now() + Math.max(100, Math.min(4000, timeMs || 800));

    const moveKey = (m) => `${m.from}-${m.to}-${m.captured?.join('.') || ''}`;
    const unsafeLanding = (b, mv) => {
      const piece = b[mv.to];
      const isWhitePiece = (piece === this.WHITE_MAN || piece === this.WHITE_KING);
      const dirs = [this.DIR_UL, this.DIR_UR, this.DIR_DL, this.DIR_DR];
      const oppDir = (d) => (d===this.DIR_UL?this.DIR_DR : d===this.DIR_UR?this.DIR_DL : d===this.DIR_DL?this.DIR_UR : this.DIR_UL);
      for (const d of dirs) {
        const enemySq = this.NEIGHBORS[mv.to][d];
        if (!enemySq) continue;
        const ep = b[enemySq];
        if (!ep || ep === this.EMPTY) continue;
        const enemyIsWhite = (ep === this.WHITE_MAN || ep === this.WHITE_KING);
        if (enemyIsWhite === isWhitePiece) continue;
        const landing = this.NEIGHBORS[mv.to][oppDir(d)];
        if (landing && b[landing] === this.EMPTY) return true;
      }
      return false;
    };

    const scoreMove = (b, mv, ply) => {
      let s = 0;
      if (mv.isCapture) s += 1000 + ((mv.captured?.length || 1) * 140);
      const piece = b[mv.from];
      const willPromote = (piece===this.WHITE_MAN && mv.to <= 5) || (piece===this.BLACK_MAN && mv.to >= 46);
      if (willPromote) s += 320;
      const km = killers[ply]?.[0];
      if (km && km.from === mv.from && km.to === mv.to) s += 110;
      const nb = this.applyMove(b, mv);
      if (!mv.isCapture && unsafeLanding(nb, mv)) s -= 150;
      const h = history.get(moveKey(mv)) || 0;
      s += h;
      return s;
    };

    const orderMoves = (b, list, ply) => list
      .map(m => ({ m, sc: scoreMove(b, m, ply) }))
      .sort((a, b) => b.sc - a.sc)
      .map(x => x.m);

    let bestRoot = null;

    const search = (b, depth, alpha, beta, turnColor, ply, fromSqLimit) => {
      if (Date.now() > deadline) throw new Error('TIMEOUT');
      if (depth === 0) return this.quiescence(b, alpha, beta, turnColor, heroColor);

      const moves = this.getValidMoves(b, turnColor, fromSqLimit);
      if (!moves.length) return (turnColor === heroColor) ? -100000 + ply : 100000 - ply;

      const ordered = orderMoves(b, moves, ply);
      let bestLocal = null;

      if (turnColor === heroColor) {
        let val = -Infinity;
        for (const mv of ordered) {
          const nb = this.applyMove(b, mv);
          const nt = (turnColor === this.WHITE) ? this.BLACK : this.WHITE;
          const sc = search(nb, depth - 1, alpha, beta, nt, ply + 1, null);
          if (sc > val) { val = sc; bestLocal = mv; }
          if (val > alpha) alpha = val;
          if (alpha >= beta) {
            if (!mv.isCapture) {
              killers[ply][0] = mv;
              history.set(moveKey(mv), (history.get(moveKey(mv)) || 0) + 30);
            }
            break;
          }
        }
        if (ply === 0 && bestLocal) bestRoot = bestLocal;
        return val;
      } else {
        let val = Infinity;
        for (const mv of ordered) {
          const nb = this.applyMove(b, mv);
          const nt = (turnColor === this.WHITE) ? this.BLACK : this.WHITE;
          const sc = search(nb, depth - 1, alpha, beta, nt, ply + 1, null);
          if (sc < val) { val = sc; bestLocal = mv; }
          if (val < beta) beta = val;
          if (alpha >= beta) {
            if (!mv.isCapture) {
              killers[ply][0] = mv;
              history.set(moveKey(mv), (history.get(moveKey(mv)) || 0) + 30);
            }
            break;
          }
        }
        if (ply === 0 && bestLocal) bestRoot = bestLocal;
        return val;
      }
    };

    // Iterative deepening
    for (let d = 1; d <= Math.max(1, maxDepth || 5); d++) {
      try {
        search(board, d, -Infinity, Infinity, heroColor, 0, onlyFromSquare || null);
      } catch (e) {
        break; // time's up
      }
    }
    return bestRoot || (this.getValidMoves(board, heroColor, onlyFromSquare || null)[0] || null);
  }
}

// Adapter between app's 10x10 board format and engine's 1..50 indexing
const damcashAdapter = {
  fromBoard: (damcashBoard, engine) => {
    const b = new Int8Array(51);
    for (let r = 0; r < 10; r++) {
      for (let c = 0; c < 10; c++) {
        const dark = (r % 2 === 0 && c % 2 === 1) || (r % 2 === 1 && c % 2 === 0);
        if (!dark) continue;
        const s = engine.getSquare(r, c);
        if (!s) continue;
        const piece = damcashBoard[r]?.[c] || 0; // app: 0 empty, 1 WM, 2 BM, 3 WK, 4 BK
        let mapped = 0;
        if (piece === 1) mapped = engine.WHITE_MAN;
        else if (piece === 2) mapped = engine.BLACK_MAN;
        else if (piece === 3) mapped = engine.WHITE_KING;
        else if (piece === 4) mapped = engine.BLACK_KING;
        b[s] = mapped;
      }
    }
    return b;
  },
  toAppMove: (engineMove, engine) => {
    // Provide single-step fields for current UI plus full sequence for future
    const fromRC = engine.getRC(engineMove.from);
    const fullPath = Array.isArray(engineMove.path) ? engineMove.path : [];
    const firstTo = fullPath.length ? fullPath[0] : engineMove.to;
    const toRC = engine.getRC(firstTo);
    const caps = Array.isArray(engineMove.captured) ? engineMove.captured : [];
    const firstCap = caps.length ? engine.getRC(caps[0]) : null;
    return {
      from: { r: fromRC.r, c: fromRC.c },
      to: { r: toRC.r, c: toRC.c },
      captured: firstCap ? { r: firstCap.r, c: firstCap.c } : null,
      captures: caps.map(s => { const rc = engine.getRC(s); return { r: rc.r, c: rc.c }; }),
      path: fullPath.map(s => { const rc = engine.getRC(s); return { r: rc.r, c: rc.c }; })
    };
  }
};

// --- Opening Book (from FMJD classical courses) ---
function createStartingBoard(engine) {
  const b = new Int8Array(51);
  for (let s = 1; s <= 50; s++) b[s] = engine.EMPTY;
  for (let s = 1; s <= 20; s++) b[s] = engine.BLACK_MAN;
  for (let s = 31; s <= 50; s++) b[s] = engine.WHITE_MAN;
  return b;
}

function boardSignature(b) {
  const w = [], wk = [], bl = [], bk = [];
  for (let s = 1; s <= 50; s++) {
    const p = b[s];
    if (!p) continue;
    if (p === 1) w.push(s);
    else if (p === 2) wk.push(s);
    else if (p === 3) bl.push(s);
    else if (p === 4) bk.push(s);
  }
  return `W:${w.join(',')}|WK:${wk.join(',')}|B:${bl.join(',')}|BK:${bk.join(',')}`;
}

function findBookMove(engine, currentBoard, aiColor) {
  // Skip book if kings or captures forced likely
  // 1) First move as White from initial position
  const start = createStartingBoard(engine);
  const sigNow = boardSignature(currentBoard);
  const sigStart = boardSignature(start);
  const isStart = sigNow === sigStart;

  const whiteFirst = [
    { from: 32, to: 28 },
    { from: 31, to: 27 },
    { from: 33, to: 29 },
    { from: 34, to: 30 },
  ];

  const blackReplies = {
    '32-28': [ { from: 19, to: 23 }, { from: 17, to: 22 } ],
    '31-27': [ { from: 20, to: 24 }, { from: 19, to: 23 } ],
    '33-29': [ { from: 19, to: 23 }, { from: 18, to: 22 } ],
    '34-30': [ { from: 19, to: 23 } ],
  };

  const legal = engine.getValidMoves(currentBoard, aiColor);

  if (isStart && aiColor === engine.WHITE) {
    for (const cand of whiteFirst) {
      const mv = legal.find(m => m.from === cand.from && m.to === cand.to && !m.isCapture);
      if (mv) return mv;
    }
  }

  if (aiColor === engine.BLACK) {
    // Detect if we are after one of the white first moves by simulating it from start
    for (const wf of whiteFirst) {
      const sim = engine.applyMove(start, { from: wf.from, to: wf.to, captured: [], isCapture: false });
      if (boardSignature(sim) === sigNow) {
        const key = `${wf.from}-${wf.to}`;
        const replies = blackReplies[key] || [];
        for (const rep of replies) {
          const mv = legal.find(m => m.from === rep.from && m.to === rep.to && !m.isCapture);
          if (mv) return mv;
        }
      }
    }
  }
  return null;
}

Deno.serve(async (req) => {
  try {
    // Not enforcing auth to allow local/guest play, consistent with chessAI
    const _base44 = createClientFromRequest(req);
    const { board, turn, difficulty = 'medium', timeLeft, activePiece } = await req.json();

    if (!Array.isArray(board) || board.length !== 10 || !turn) {
      return Response.json({ error: 'Invalid payload' }, { status: 400 });
    }

    const engine = new DraughtsEngine();
    const engBoard = damcashAdapter.fromBoard(board, engine);
    const aiColor = (turn === 'white') ? engine.WHITE : engine.BLACK;

    // Opening book (FMJD classical) shortcut when applicable
    if (!activePiece) {
      const book = findBookMove(engine, engBoard, aiColor);
      if (book) {
        const moveForApp = damcashAdapter.toAppMove(book, engine);
        return Response.json({ move: moveForApp, score: 0, source: 'book' });
      }
    }

    // Difficulty -> depth/time mapping (+ dynamic time management)
    let maxDepth = 5;
    if (difficulty === 'easy') maxDepth = 3;
    else if (difficulty === 'hard') maxDepth = 8;
    const baseTime = (difficulty === 'easy') ? 220 : (difficulty === 'hard' ? 1500 : 800);
    const dynTime = (typeof timeLeft === 'number') ? Math.max(200, Math.min(2000, Math.floor(timeLeft * 1000 * 0.03))) : baseTime;
    const timeMs = Math.max(baseTime, dynTime);

    // Forced continuation square if provided
    let onlyFromSquare = null;
    if (activePiece && typeof activePiece.r === 'number' && typeof activePiece.c === 'number') {
      onlyFromSquare = engine.getSquare(activePiece.r, activePiece.c) || null;
    }

    const bestMove = engine.getBestMove(engBoard, aiColor, { maxDepth, timeMs, onlyFromSquare });
    if (!bestMove) return Response.json({ error: 'No move' }, { status: 200 });

    const moveForApp = damcashAdapter.toAppMove(bestMove, engine);
    return Response.json({ move: moveForApp, score: 0, fullSequence: [moveForApp] });
  } catch (e) {
    console.error('checkersAI error:', e);
    return Response.json({ error: e.message || 'Internal error' }, { status: 500 });
  }
});