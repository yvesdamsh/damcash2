import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

// Enhanced Checkers (10x10 draughts) AI with FMJD strategic concepts:
// - Iterative deepening, alpha-beta, quiescence
// - Killer/history heuristics
// - FMJD strategic evaluation: Long Diagonal, Wing Control (Chizhov), 
//   Hanging Pawns, Triangle Formations, Dog Hole, Central Star
// - Mandatory max-capture rule
// - Support for forced continuation (activePiece)

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
    
    // FMJD Strategic Constants
    this.LONG_DIAGONAL = [5, 14, 23, 32, 41, 46]; // Grande Diagonale
    this.CENTRAL_STAR = [22, 23, 27, 28, 29]; // Étoile Centrale (cases stratégiques)
    this.WHITE_DOG_HOLE = 46; // Trou de chien blanc
    this.BLACK_DOG_HOLE = 5;  // Trou de chien noir
    
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
              if (taken.includes(seenEnemySq)) break;
              extended = true;
              const newPath = [...path, nxt];
              const newTaken = [...taken, seenEnemySq];
              const saved = board[seenEnemySq];
              const savedFrom = board[curSq];
              board[seenEnemySq] = this.EMPTY;
              board[curSq] = this.EMPTY;
              const tmpPiece = savedFrom;
              board[nxt] = tmpPiece;
              dfs(nxt, newTaken, newPath);
              board[nxt] = this.EMPTY;
              board[curSq] = savedFrom;
              board[seenEnemySq] = saved;

              if (!isKing) break;
            } else {
              if (!isKing) break;
              travel = nxt;
            }
          } else if (cell === enemyMan || cell === enemyKing) {
            if (seenEnemySq) break;
            seenEnemySq = nxt;
            travel = nxt;
          } else {
            break;
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

  // --- FMJD Enhanced Evaluation ---
  evaluate(board, turnColor) {
    const oppDir = (d) => (d===this.DIR_UL?this.DIR_DR : d===this.DIR_UR?this.DIR_DL : d===this.DIR_DL?this.DIR_UR : this.DIR_UL);
    
    // Helper: Calculate mobility
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
          if (!isKing || steps >= 3) break;
        }
      }
      return m;
    };
    
    // Helper: Check if piece is capturable (men adjacent, kings from distance)
    const capturable = (b, s, isWhitePiece) => {
      const dirs = [this.DIR_UL, this.DIR_UR, this.DIR_DL, this.DIR_DR];
      const isEnemy = (p) => p && p !== this.EMPTY && ((p === this.WHITE_MAN || p === this.WHITE_KING) !== isWhitePiece);
      const isKingPiece = (p) => p === this.WHITE_KING || p === this.BLACK_KING;

      for (const d of dirs) {
        // 1) Enemy man (or king) adjacent that can jump over us
        const adj = this.NEIGHBORS[s][d];
        if (adj && isEnemy(b[adj])) {
          const landing = this.NEIGHBORS[s][oppDir(d)];
          if (landing && b[landing] === this.EMPTY) return true;
        }

        // 2) Enemy king on same diagonal at distance with empty squares between
        //    King before us on the ray 'd'
        let cur = this.NEIGHBORS[s][d];
        while (cur && b[cur] === this.EMPTY) cur = this.NEIGHBORS[cur][d];
        if (cur && isEnemy(b[cur]) && isKingPiece(b[cur])) {
          const firstBeyond = this.NEIGHBORS[s][oppDir(d)];
          if (firstBeyond && b[firstBeyond] === this.EMPTY) return true; // at least one landing square beyond
        }
        //    King behind us on the opposite ray
        cur = this.NEIGHBORS[s][oppDir(d)];
        while (cur && b[cur] === this.EMPTY) cur = this.NEIGHBORS[cur][oppDir(d)];
        if (cur && isEnemy(b[cur]) && isKingPiece(b[cur])) {
          const firstBeyond = this.NEIGHBORS[s][d];
          if (firstBeyond && b[firstBeyond] === this.EMPTY) return true;
        }
      }
      return false;
    };

    // Helper: Check if pawn is supported (has friendly pawn behind)
    const isSupported = (b, s, isWhite) => {
      const { r, c } = this.getRC(s);
      const behindRow = isWhite ? r + 1 : r - 1;
      if (behindRow < 0 || behindRow > 9) return false;
      
      const leftBehind = this.getSquare(behindRow, c - 1);
      const rightBehind = this.getSquare(behindRow, c + 1);
      const friendlyMan = isWhite ? this.WHITE_MAN : this.BLACK_MAN;
      
      if (leftBehind && b[leftBehind] === friendlyMan) return true;
      if (rightBehind && b[rightBehind] === friendlyMan) return true;
      return false;
    };

    // Helper: Check for triangle formation
    const hasTriangle = (b, s, isWhite) => {
      const { r, c } = this.getRC(s);
      const behindRow = isWhite ? r + 1 : r - 1;
      if (behindRow < 0 || behindRow > 9) return false;
      
      const leftBehind = this.getSquare(behindRow, c - 1);
      const rightBehind = this.getSquare(behindRow, c + 1);
      const friendlyMan = isWhite ? this.WHITE_MAN : this.BLACK_MAN;
      
      return leftBehind && rightBehind && 
             b[leftBehind] === friendlyMan && 
             b[rightBehind] === friendlyMan;
    };

    let w = 0, bl = 0;
    const centerRows = new Set([4, 5]);
    
    // Track pieces for wing control
    const whitePieces = [];
    const blackPieces = [];

    for (let i = 1; i <= 50; i++) {
      const p = board[i];
      if (p === this.EMPTY) continue;
      
      const { r, c } = this.getRC(i);
      const isWhite = (p === this.WHITE_MAN || p === this.WHITE_KING);
      const isKing = (p === this.WHITE_KING || p === this.BLACK_KING);
      
      // Track pieces
      if (isWhite) whitePieces.push({ sq: i, r, c, isKing });
      else blackPieces.push({ sq: i, r, c, isKing });
      
      // === BASE EVALUATION ===
      let val = isKing ? 340 : 100; // Material

      // 1) SECURITY FIRST: heavy penalty if the piece is capturable (FMJD priority)
      if (capturable(board, i, isWhite)) val -= isKing ? 400 : 200;
      
      // Advancement bonus
      if (!isKing) val += (isWhite ? (9 - r) : r) * 3.5;
      
      // Center control
      if (centerRows.has(r)) val += 5;
      
      // Back rank guard
      if (!isKing && ((isWhite && i >= 46) || (!isWhite && i <= 5))) val += 6;
      
      // Near promotion bonus
      if (!isKing) {
        const dist = isWhite ? r : (9 - r);
        if (dist <= 2) val += (3 - dist) * 14;
      }
      
      // Mobility
      val += mobility(board, i, p) * 2;
      
      // === FMJD STRATEGIC BONUSES (moderate) ===
      
      // 1. Long Diagonal Control (Grande Diagonale) +8
      if (this.LONG_DIAGONAL.includes(i)) {
        val += 8;
      }
      
      // 2. Central Star Control (Étoile Centrale) +6
      if (this.CENTRAL_STAR.includes(i)) {
        val += 6;
      }
      
      // 3. Hanging Pawn Penalty (Pions Suspendus) -10
      if (!isKing) {
        const isAdvanced = isWhite ? (r < 5) : (r > 4);
        if (isAdvanced && !isSupported(board, i, isWhite)) {
          val -= 10;
        }
      }
      
      // 4. Triangle Formation Bonus +8
      if (!isKing && hasTriangle(board, i, isWhite)) {
        val += 8;
      }
      
      // 5. Dog Hole (pion piégé) -15
      if (isWhite && i === this.WHITE_DOG_HOLE) {
        const blocker = board[41];
        if (blocker === this.BLACK_MAN || blocker === this.BLACK_KING) {
          val -= 15;
        }
      }
      if (!isWhite && i === this.BLACK_DOG_HOLE) {
        const blocker = board[10];
        if (blocker === this.WHITE_MAN || blocker === this.WHITE_KING) {
          val -= 15;
        }
      }
      
      if (isWhite) w += val; else bl += val;
    }
    
    // === WING CONTROL (presence on both flanks) +5 ===
    // Left wing: columns 0-2 (squares with c <= 2)
    // Right wing: columns 7-9 (squares with c >= 7)
    const whiteLeftWing = whitePieces.filter(p => p.c <= 2).length;
    const whiteRightWing = whitePieces.filter(p => p.c >= 7).length;
    const blackLeftWing = blackPieces.filter(p => p.c >= 7).length; // Inverted for black
    const blackRightWing = blackPieces.filter(p => p.c <= 2).length;

    if (whiteLeftWing > 0 && whiteRightWing > 0) {
      w += 5;
    }
    if (blackLeftWing > 0 && blackRightWing > 0) {
      bl += 5;
    }
    
    // Keep other heuristics as-is (optional extras not specified by user)
    // === FORMATION 45-40 (Olympic Formation) ===
    if (board[45] === this.WHITE_MAN && board[40] === this.WHITE_MAN) {
      w += 18;
    }
    if (board[6] === this.BLACK_MAN && board[11] === this.BLACK_MAN) {
      bl += 18;
    }
    
    // === PASSED PAWN BONUS ===
    for (const piece of whitePieces) {
      if (!piece.isKing && piece.r <= 4) {
        let isPassed = true;
        for (let checkRow = piece.r - 1; checkRow >= 0; checkRow--) {
          for (let dc = -1; dc <= 1; dc++) {
            const checkSq = this.getSquare(checkRow, piece.c + dc);
            if (checkSq && board[checkSq] === this.BLACK_MAN) { isPassed = false; break; }
          }
          if (!isPassed) break;
        }
        if (isPassed) w += 20;
      }
    }
    for (const piece of blackPieces) {
      if (!piece.isKing && piece.r >= 5) {
        let isPassed = true;
        for (let checkRow = piece.r + 1; checkRow <= 9; checkRow++) {
          for (let dc = -1; dc <= 1; dc++) {
            const checkSq = this.getSquare(checkRow, piece.c + dc);
            if (checkSq && board[checkSq] === this.WHITE_MAN) { isPassed = false; break; }
          }
          if (!isPassed) break;
        }
        if (isPassed) bl += 20;
      }
    }

    const tempo = 10;
    const base = (w - bl) + (turnColor === this.WHITE ? tempo : -tempo);
    return (turnColor === this.WHITE) ? base : -base;
  }

  // --- Quiescence (captures only) ---
  quiescence(board, alpha, beta, turnColor, heroColor) {
    // If a big tactical shot exists for the side to move, prune towards it
    const shot = this.findTacticalShot(board, turnColor, 4);
    if (shot) {
      const nb = this.applyMove(board, shot);
      const nt = (turnColor === this.WHITE) ? this.BLACK : this.WHITE;
      return Math.max(alpha, -this.quiescence(nb, -beta, -alpha, nt, heroColor));
    }
    const stand = this.evaluate(board, heroColor);
    if (stand >= beta) return beta;
    if (alpha < stand) alpha = stand;

    const moves = this.getValidMoves(board, turnColor).filter(m => m.isCapture);
    if (!moves.length) return stand;

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

  // --- Tactical combination detector (sacrifice -> forced recapture -> combo) ---
  findTacticalShot(board, heroColor, maxReplies = 6) {
    const opp = (heroColor === this.WHITE) ? this.BLACK : this.WHITE;
    const legal = this.getValidMoves(board, heroColor);
    if (!legal.length) return null;

    // Helper: piece value (king more valuable)
    const pVal = (p) => (p === this.WHITE_KING || p === this.BLACK_KING) ? 2 : 1;
    const capsValue = (b, caps) => Array.isArray(caps) ? caps.reduce((s, sq) => s + pVal(b[sq] || 0), 0) : 0;

    let best = null;
    let bestScore = -Infinity;

    // Consider both captures and quiet moves (many motifs start by a sacrifice/quiet move)
    for (const mv of legal) {
      const b1 = this.applyMove(board, mv);
      const oppMoves = this.getValidMoves(b1, opp)
        .sort((a, b) => (b.isCapture? (b.captured?.length||0) : 0) - (a.isCapture? (a.captured?.length||0) : 0))
        .slice(0, maxReplies);

      for (const omv of oppMoves) {
        const b2 = this.applyMove(b1, omv);
        const hero2 = this.getValidMoves(b2, heroColor).filter(m => m.isCapture)
          .sort((a, b) => (b.captured?.length || 0) - (a.captured?.length || 0));
        if (!hero2.length) continue;

        const follow = hero2[0];
        const gainNow = capsValue(board, mv.captured);
        const lossOpp = capsValue(b1, omv.captured);
        const gainNext = capsValue(b2, follow.captured);
        const net = (gainNow + gainNext) - lossOpp; // positive if combo wins material
        const chainLen = (mv.isCapture ? (mv.captured?.length || 0) : 0) + (follow.captured?.length || 0);

        // Heuristic score: reward net material and chain length (motif-like sequences)
        const score = net * 120 + chainLen * 15 + (mv.isCapture ? 10 : 0);

        if (net >= 1 && chainLen >= 2 && score > bestScore) {
          bestScore = score;
          best = mv;
        }
      }
    }

    return best;
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
      const isEnemy = (p) => p && p !== this.EMPTY && ((p === this.WHITE_MAN || p === this.WHITE_KING) !== isWhitePiece);
      const isKingPiece = (p) => p === this.WHITE_KING || p === this.BLACK_KING;
      const opp = (d) => (d===this.DIR_UL?this.DIR_DR : d===this.DIR_UR?this.DIR_DL : d===this.DIR_DL?this.DIR_UR : this.DIR_UL);

      for (const d of dirs) {
        // Adjacent enemy that can jump over us
        const adj = this.NEIGHBORS[mv.to][d];
        if (adj && isEnemy(b[adj])) {
          const landing = this.NEIGHBORS[mv.to][opp(d)];
          if (landing && b[landing] === this.EMPTY) return true;
        }
        // Enemy king on ray (any distance) with empty squares between and landing square behind us
        let cur = this.NEIGHBORS[mv.to][d];
        while (cur && b[cur] === this.EMPTY) cur = this.NEIGHBORS[cur][d];
        if (cur && isEnemy(b[cur]) && isKingPiece(b[cur])) {
          const landing = this.NEIGHBORS[mv.to][opp(d)];
          if (landing && b[landing] === this.EMPTY) return true;
        }
        cur = this.NEIGHBORS[mv.to][opp(d)];
        while (cur && b[cur] === this.EMPTY) cur = this.NEIGHBORS[cur][opp(d)];
        if (cur && isEnemy(b[cur]) && isKingPiece(b[cur])) {
          const landing = this.NEIGHBORS[mv.to][d];
          if (landing && b[landing] === this.EMPTY) return true;
        }
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
      // Immediate unsafe landing (incl. king long jump)
      if (!mv.isCapture && unsafeLanding(nb, mv)) s -= 380;
      // Never hang a piece: if opponent can capture our moved piece right away, punish heavily
      if (!mv.isCapture) {
        const moverIsWhite = (piece === this.WHITE_MAN || piece === this.WHITE_KING);
        const oppColor = moverIsWhite ? this.BLACK : this.WHITE;
        const oppCaps = this.getValidMoves(nb, oppColor).filter(m=>m.isCapture && Array.isArray(m.captured) && m.captured.includes(mv.to));
        if (oppCaps.length) s -= 6000;
      }
      const h = history.get(moveKey(mv)) || 0;
      s += h;

      // FMJD bonus: prefer moves to strategic squares
      if (this.LONG_DIAGONAL.includes(mv.to)) s += 25;
      if (this.CENTRAL_STAR.includes(mv.to)) s += 20;

      return s;
    };

    const orderMoves = (b, list, ply) => list
      .map(m => ({ m, sc: scoreMove(b, m, ply) }))
      .sort((a, b) => b.sc - a.sc)
      .map(x => x.m);

    let bestRoot = null;

    // Play thematic combinations when available (before normal search)
    if (!onlyFromSquare) {
      const shot = this.findTacticalShot(board, heroColor, 6);
      if (shot) return shot;
    }

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
        const piece = damcashBoard[r]?.[c] || 0;
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

// --- Enhanced Opening Book (FMJD classical + modern variations) ---
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
  const start = createStartingBoard(engine);
  const sigNow = boardSignature(currentBoard);
  const sigStart = boardSignature(start);
  const isStart = sigNow === sigStart;

  // Classical FMJD opening moves for White
  const whiteFirst = [
    { from: 32, to: 28 }, // Classical: 32-28
    { from: 31, to: 27 }, // Roozenburg
    { from: 33, to: 29 }, // Springer
    { from: 34, to: 30 }, // Keller
    { from: 35, to: 30 }, // Alternative
  ];

  // Black responses based on White's opening
  const blackReplies = {
    '32-28': [ { from: 19, to: 23 }, { from: 17, to: 22 }, { from: 18, to: 22 } ],
    '31-27': [ { from: 20, to: 24 }, { from: 19, to: 23 }, { from: 17, to: 21 } ],
    '33-29': [ { from: 19, to: 23 }, { from: 18, to: 22 }, { from: 19, to: 24 } ],
    '34-30': [ { from: 19, to: 23 }, { from: 20, to: 25 } ],
    '35-30': [ { from: 20, to: 25 }, { from: 19, to: 24 } ],
  };

  const legal = engine.getValidMoves(currentBoard, aiColor);

  if (isStart && aiColor === engine.WHITE) {
    // Randomly select from good openings for variety, but avoid immediate recapture blunders
    const shuffled = whiteFirst.sort(() => Math.random() - 0.5);
    for (const cand of shuffled) {
      const mv = legal.find(m => m.from === cand.from && m.to === cand.to && !m.isCapture);
      if (mv) {
        const nb = engine.applyMove(currentBoard, mv);
        const opp = engine.BLACK;
        const replyCaps = engine.getValidMoves(nb, opp).filter(m=>m.isCapture && m.captured?.includes(mv.to));
        if (replyCaps.length === 0) return mv;
      }
    }
  }

  if (aiColor === engine.BLACK) {
    for (const wf of whiteFirst) {
      const sim = engine.applyMove(start, { from: wf.from, to: wf.to, captured: [], isCapture: false });
      if (boardSignature(sim) === sigNow) {
        const key = `${wf.from}-${wf.to}`;
        const replies = blackReplies[key] || [];
        // Randomly select from good responses, but avoid immediate recapture traps (e.g., 16-21 vs 31-27)
        const shuffled = replies.sort(() => Math.random() - 0.5);
        for (const rep of shuffled) {
          const mv = legal.find(m => m.from === rep.from && m.to === rep.to && !m.isCapture);
          if (mv) {
            const nb = engine.applyMove(currentBoard, mv);
            const opp = engine.WHITE;
            const replyCaps = engine.getValidMoves(nb, opp).filter(m=>m.isCapture && m.captured?.includes(mv.to));
            if (replyCaps.length === 0) return mv;
          }
        }
      }
    }
  }
  return null;
}

Deno.serve(async (req) => {
  try {
    const _base44 = createClientFromRequest(req);
    const { board, turn, difficulty = 'medium', timeLeft, activePiece } = await req.json();

    if (!Array.isArray(board) || board.length !== 10 || !turn) {
      return Response.json({ error: 'Invalid payload' }, { status: 400 });
    }

    const engine = new DraughtsEngine();
    const engBoard = damcashAdapter.fromBoard(board, engine);
    const aiColor = (turn === 'white') ? engine.WHITE : engine.BLACK;

    // Opening book shortcut
    if (!activePiece) {
      const book = findBookMove(engine, engBoard, aiColor);
      if (book) {
        const moveForApp = damcashAdapter.toAppMove(book, engine);
        return Response.json({ move: moveForApp, score: 0, source: 'book' });
      }
    }

    // Difficulty -> depth/time mapping
    let maxDepth = 5;
    if (difficulty === 'easy') maxDepth = 3;
    else if (difficulty === 'hard') maxDepth = 10;
    else if (difficulty === 'expert') maxDepth = 12;
    
    const baseTime = (difficulty === 'easy') ? 220 : 
                    (difficulty === 'hard' ? 1500 : 
                    (difficulty === 'expert' ? 3200 : 800));
    const dynTime = (typeof timeLeft === 'number') ? Math.max(200, Math.min(2000, Math.floor(timeLeft * 1000 * 0.03))) : baseTime;
    const timeMs = Math.max(baseTime, dynTime);

    // Forced continuation
    let onlyFromSquare = null;
    if (activePiece && typeof activePiece.r === 'number' && typeof activePiece.c === 'number') {
      const sq = engine.getSquare(activePiece.r, activePiece.c) || null;
      if (sq) {
        const p = engBoard[sq];
        const pColor = (p === engine.WHITE_MAN || p === engine.WHITE_KING) ? engine.WHITE
                    : (p === engine.BLACK_MAN || p === engine.BLACK_KING) ? engine.BLACK : 0;
        if (p && pColor === aiColor) {
          const cont = engine.getValidMoves(engBoard, aiColor, sq);
          if (cont && cont.length) {
            onlyFromSquare = sq;
          }
        }
      }
    }

    let bestMove = engine.getBestMove(engBoard, aiColor, { maxDepth, timeMs, onlyFromSquare });
    if (!bestMove) {
      const legal = engine.getValidMoves(engBoard, aiColor, onlyFromSquare || null);
      if (legal && legal.length) bestMove = legal[0];
    }
    if (!bestMove) return Response.json({ error: 'No move' }, { status: 200 });

    const moveForApp = damcashAdapter.toAppMove(bestMove, engine);
    return Response.json({ move: moveForApp, score: 0, fullSequence: [moveForApp] });
  } catch (e) {
    console.error('checkersAI error:', e);
    return Response.json({ error: e.message || 'Internal error' }, { status: 500 });
  }
});