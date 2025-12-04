import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

// --- Chess Logic (Backend Optimized) ---

const isValidPos = (r, c) => r >= 0 && r < 8 && c >= 0 && c < 8;

const isWhite = (piece) => piece && piece === piece.toUpperCase();
const getColor = (piece) => {
    if (!piece) return null;
    return isWhite(piece) ? 'white' : 'black';
};

// Deep Copy
const cloneBoard = (board) => board.map(row => [...row]);

// Helper to execute move
const executeChessMove = (board, move) => {
    const newBoard = cloneBoard(board);
    const piece = newBoard[move.from.r][move.from.c];

    if (!piece) return { board: newBoard, piece: null };

    newBoard[move.from.r][move.from.c] = null;
    newBoard[move.to.r][move.to.c] = piece;

    if (move.captured === 'en_passant') {
        newBoard[move.enPassantTarget.r][move.enPassantTarget.c] = null;
    }

    if (move.castle) {
        const row = move.from.r;
        if (move.castle === 'king') {
            newBoard[row][5] = newBoard[row][7];
            newBoard[row][7] = null;
        } else {
            newBoard[row][3] = newBoard[row][0];
            newBoard[row][0] = null;
        }
    }

    // Promotion (Default to Queen)
    if (piece.toLowerCase() === 'p' && (move.to.r === 0 || move.to.r === 7)) {
        const promoteTo = move.promotion ? move.promotion.toLowerCase() : 'q';
        const newPieceChar = getColor(piece) === 'white' ? promoteTo.toUpperCase() : promoteTo;
        newBoard[move.to.r][move.to.c] = newPieceChar;
    }

    return { board: newBoard, piece };
};

// Move Generation
const getValidChessMoves = (board, turn, lastMove = null, castlingRights = { wK: true, wQ: true, bK: true, bQ: true }) => {
    let moves = [];
    for (let r = 0; r < 8; r++) {
        for (let c = 0; c < 8; c++) {
            const piece = board[r][c];
            if (piece && getColor(piece) === turn) {
                moves.push(...getPieceMoves(board, r, c, piece, lastMove, castlingRights));
            }
        }
    }
    // Check filtering
    return moves.filter(move => {
        const tempBoard = executeChessMove(board, move).board;
        return !isInCheck(tempBoard, turn);
    });
};

const getPieceMoves = (board, r, c, piece, lastMove, castlingRights) => {
    if (!piece) return [];
    const moves = [];
    const type = piece.toLowerCase();
    const color = getColor(piece);
    const direction = color === 'white' ? -1 : 1;
    const startRow = color === 'white' ? 6 : 1;

    const addMove = (tr, tc) => {
        if (isValidPos(tr, tc)) {
            const target = board[tr][tc];
            if (!target || getColor(target) !== color) {
                moves.push({ from: { r, c }, to: { r: tr, c: tc }, captured: target });
            }
        }
    };

    if (type === 'p') {
        if (isValidPos(r + direction, c) && !board[r + direction][c]) {
            moves.push({ from: { r, c }, to: { r: r + direction, c }, captured: null });
            if (r === startRow && !board[r + direction * 2][c] && !board[r + direction][c]) {
                moves.push({ from: { r, c }, to: { r: r + direction * 2, c }, captured: null });
            }
        }
        [[direction, -1], [direction, 1]].forEach(([dr, dc]) => {
            const tr = r + dr, tc = c + dc;
            if (isValidPos(tr, tc)) {
                const target = board[tr][tc];
                if (target && getColor(target) !== color) {
                    moves.push({ from: { r, c }, to: { r: tr, c: tc }, captured: target });
                }
                // En Passant
                if (!target && lastMove && lastMove.piece && 
                    lastMove.piece.toLowerCase() === 'p' &&
                    Math.abs(lastMove.from.r - lastMove.to.r) === 2 &&
                    lastMove.to.r === r && lastMove.to.c === tc) {
                    moves.push({ from: { r, c }, to: { r: tr, c: tc }, captured: 'en_passant', enPassantTarget: { r, c: tc } });
                }
            }
        });
    } else if (type === 'n') {
        [[-2, -1], [-2, 1], [-1, -2], [-1, 2], [1, -2], [1, 2], [2, -1], [2, 1]].forEach(([dr, dc]) => addMove(r + dr, c + dc));
    } else if (type === 'k') {
        [[-1, -1], [-1, 0], [-1, 1], [0, -1], [0, 1], [1, -1], [1, 0], [1, 1]].forEach(([dr, dc]) => addMove(r + dr, c + dc));
        // Castling
        if (!isCurrentInCheck(board, color)) {
             const row = color === 'white' ? 7 : 0;
             if (r === row && c === 4) {
                 if (castlingRights[color === 'white' ? 'wK' : 'bK'] && !board[row][5] && !board[row][6]) {
                     if (!isSquareAttacked(board, row, 5, color) && !isSquareAttacked(board, row, 6, color))
                        moves.push({ from: {r, c}, to: {r: row, c: 6}, castle: 'king' });
                 }
                 if (castlingRights[color === 'white' ? 'wQ' : 'bQ'] && !board[row][3] && !board[row][2] && !board[row][1]) {
                     if (!isSquareAttacked(board, row, 3, color) && !isSquareAttacked(board, row, 2, color))
                        moves.push({ from: {r, c}, to: {r: row, c: 2}, castle: 'queen' });
                 }
             }
        }
    } else {
        // Slider
        const directions = type === 'b' ? [[-1, -1], [-1, 1], [1, -1], [1, 1]] :
                           type === 'r' ? [[-1, 0], [1, 0], [0, -1], [0, 1]] :
                                          [[-1, -1], [-1, 1], [1, -1], [1, 1], [-1, 0], [1, 0], [0, -1], [0, 1]];
        
        directions.forEach(([dr, dc]) => {
            let d = 1;
            while (true) {
                const tr = r + dr * d, tc = c + dc * d;
                if (!isValidPos(tr, tc)) break;
                const target = board[tr][tc];
                if (!target) {
                    moves.push({ from: { r, c }, to: { r: tr, c: tc }, captured: null });
                } else {
                    if (getColor(target) !== color) {
                        moves.push({ from: { r, c }, to: { r: tr, c: tc }, captured: target });
                    }
                    break;
                }
                d++;
            }
        });
    }
    return moves;
};

const isCurrentInCheck = (board, color) => {
    let kingPos;
    for(let r=0; r<8; r++) {
        for(let c=0; c<8; c++) {
            if (board[r][c] === (color === 'white' ? 'K' : 'k')) {
                kingPos = {r, c};
                break;
            }
        }
    }
    if (!kingPos) return true; 
    return isSquareAttacked(board, kingPos.r, kingPos.c, color);
};

const isSquareAttacked = (board, r, c, color) => {
    const opponent = color === 'white' ? 'black' : 'white';
    
    // Knight
    const knightMoves = [[-2, -1], [-2, 1], [-1, -2], [-1, 2], [1, -2], [1, 2], [2, -1], [2, 1]];
    for (let [dr, dc] of knightMoves) {
        const tr = r + dr, tc = c + dc;
        if (isValidPos(tr, tc)) {
            const p = board[tr][tc];
            if (p && getColor(p) === opponent && p.toLowerCase() === 'n') return true;
        }
    }

    // Sliders
    const orths = [[-1, 0], [1, 0], [0, -1], [0, 1]];
    for (let [dr, dc] of orths) {
        let d = 1;
        while(true) {
            const tr = r + dr * d, tc = c + dc * d;
            if (!isValidPos(tr, tc)) break;
            const p = board[tr][tc];
            if (p) {
                if (getColor(p) === opponent && (p.toLowerCase() === 'r' || p.toLowerCase() === 'q')) return true;
                break; 
            }
            d++;
        }
    }
    const diags = [[-1, -1], [-1, 1], [1, -1], [1, 1]];
    for (let [dr, dc] of diags) {
        let d = 1;
        while(true) {
            const tr = r + dr * d, tc = c + dc * d;
            if (!isValidPos(tr, tc)) break;
            const p = board[tr][tc];
            if (p) {
                if (getColor(p) === opponent && (p.toLowerCase() === 'b' || p.toLowerCase() === 'q')) return true;
                break; 
            }
            d++;
        }
    }

    // Pawn
    const attackDir = color === 'white' ? -1 : 1; 
    [[attackDir, -1], [attackDir, 1]].forEach(([dr, dc]) => {
        const tr = r + dr, tc = c + dc;
        if (isValidPos(tr, tc)) {
            const p = board[tr][tc];
            if (p && getColor(p) === opponent && p.toLowerCase() === 'p') return true;
        }
    });

    // King
    const kingMoves = [[-1, -1], [-1, 0], [-1, 1], [0, -1], [0, 1], [1, -1], [1, 0], [1, 1]];
    for (let [dr, dc] of kingMoves) {
        const tr = r + dr, tc = c + dc;
        if (isValidPos(tr, tc)) {
            const p = board[tr][tc];
            if (p && getColor(p) === opponent && p.toLowerCase() === 'k') return true;
        }
    }

    return false;
};

const isInCheck = (board, color) => isCurrentInCheck(board, color);

// --- Opening Book (Expanded) ---
// Simplified map: FEN (without move counters) -> Array of Algebraic Moves
const OPENING_BOOK = {
    // Start
    "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq -": ["e2e4", "d2d4", "g1f3", "c2c4"],
    
    // e4 Responses
    "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq -": ["c7c5", "e7e5", "e7e6", "c7c6", "d7d6"],
    // Sicilian (1. e4 c5)
    "rnbqkbnr/pp1ppppp/8/2p5/4P3/8/PPPP1PPP/RNBQKBNR w KQkq -": ["g1f3", "c2c3", "b1c3"],
    // French (1. e4 e6)
    "rnbqkbnr/pppp1ppp/4p3/8/4P3/8/PPPP1PPP/RNBQKBNR w KQkq -": ["d2d4", "d2d3"],
    // Caro-Kann (1. e4 c6)
    "rnbqkbnr/pp1ppppp/2p5/8/4P3/8/PPPP1PPP/RNBQKBNR w KQkq -": ["d2d4", "g1f3"],

    // d4 Responses
    "rnbqkbnr/pppppppp/8/8/3P4/8/PPP1PPPP/RNBQKBNR b KQkq -": ["g8f6", "d7d5", "e7e6", "f7f5"],
    // Queen's Gambit (1. d4 d5 2. c4)
    "rnbqkbnr/ppp1pppp/8/3p4/3P4/8/PPP1PPPP/RNBQKBNR w KQkq -": ["c2c4", "g1f3", "c1f4"],
    "rnbqkbnr/ppp1pppp/8/3p4/2PP4/8/PP2PPPP/RNBQKBNR b KQkq -": ["e7e6", "c7c6", "d5c4"], // Declined, Slav, Accepted

    // Reti / English
    "rnbqkbnr/pppppppp/8/8/8/5N2/PPPPPPPP/RNBQKB1R b KQkq -": ["d7d5", "c7c5", "g8f6"],
    "rnbqkbnr/pppppppp/8/8/2P5/8/PP1PPPPP/RNBQKBNR b KQkq -": ["e7e5", "c7c5", "g8f6"]
};

const boardToFen = (board, turn, castlingRights, lastMove) => {
    let fen = "";
    let empty = 0;
    for (let r = 0; r < 8; r++) {
        for (let c = 0; c < 8; c++) {
            const p = board[r][c];
            if (!p) empty++;
            else {
                if (empty > 0) { fen += empty; empty = 0; }
                fen += p;
            }
        }
        if (empty > 0) { fen += empty; empty = 0; }
        if (r < 7) fen += "/";
    }
    
    const castling = [
        castlingRights.wK ? 'K' : '',
        castlingRights.wQ ? 'Q' : '',
        castlingRights.bK ? 'k' : '',
        castlingRights.bQ ? 'q' : ''
    ].join('') || '-';

    let ep = '-';
    if (lastMove && lastMove.piece && lastMove.piece.toLowerCase() === 'p' && Math.abs(lastMove.from.r - lastMove.to.r) === 2) {
        const colMap = "abcdefgh";
        const rowMap = "87654321"; // 0->8, 7->1
        const r = (lastMove.from.r + lastMove.to.r) / 2;
        ep = colMap[lastMove.from.c] + rowMap[r];
    }

    return `${fen} ${turn} ${castling} ${ep}`;
};

// --- Evaluation (PeSTO Tables - Advanced Heuristics) ---
// Tables are flipped for Black effectively by logic or by table definition. 
// Here we define from White's perspective (row 0=White Backrank in array terms? No, row 7 is white backrank usually in our array [0..7])
// Our array: row 0 = Black Pieces, row 7 = White Pieces.
// So 'p' table should reward advancing to row 0.
// MG = Middlegame, EG = Endgame

const mg_value = { p: 82, n: 337, b: 365, r: 477, q: 1025, k: 0 };
const eg_value = { p: 94, n: 281, b: 297, r: 512, q: 936, k: 0 };

// Tables (from White's perspective: row 7 is bottom/home, row 0 is top/prom)
// We need to map board[r][c] where r=7 is white home.
const mg_pawn_table = [
  [ 0,  0,  0,  0,  0,  0,  0,  0],
  [98,134, 61, 95, 68,126, 34,-11],
  [-6,  7, 26, 31, 65, 56, 25,-20],
  [-14,13,  6, 21, 23, 12, 17,-23],
  [-27,-2, -5, 12, 17,  6, 10,-25],
  [-26,-4, -4,-10,  3,  3, 33,-12],
  [-35,-1,-20,-23,-15, 24, 38,-22],
  [ 0,  0,  0,  0,  0,  0,  0,  0]
];
const eg_pawn_table = [
  [ 0,  0,  0,  0,  0,  0,  0,  0],
  [178,173,158,134,147,132,165,187],
  [94,100, 85, 67, 56, 53, 82, 84],
  [32, 24, 13,  5, -2,  4, 17, 17],
  [13,  9, -3, -7, -7, -8,  3, -1],
  [ 4,  7, -6,  1,  0, -5, -1, -8],
  [13,  8,  8, 10, 13,  0,  2, -7],
  [ 0,  0,  0,  0,  0,  0,  0,  0]
];
const mg_knight_table = [
  [-167,-89,-34,-49, 61,-97,-15,-107],
  [-73,-41, 72, 36, 23, 62,  7, -17],
  [-47, 60, 37, 65, 84,129, 73,  44],
  [-9, 17, 19, 53, 37, 69, 18,  22],
  [-13,  4, 16, 13, 28, 19, 21,  -8],
  [-23, -9, 12, 10, 19, 17, 25, -16],
  [-29,-53,-12, -3, -1, 18,-14, -19],
  [-105,-21,-58,-33,-17,-28,-19, -23]
];
const mg_bishop_table = [
  [-29,  4,-82,-37,-25,-42,  7,  -8],
  [-26, 16,-18,-10, 30, 25, 27, -26],
  [-16, 37, 43, 40, 35, 50, 37,  -2],
  [-4,  5, 19, 50, 37, 37,  7,  -2],
  [-6, 13, 13, 26, 34, 12, 10,   4],
  [ 0, 15, 15, 15, 14, 27, 18,  10],
  [ 4, 15, 16,  9,  8,  6, 10,  17],
  [-14,-13,-10,-10, -9,-10,-20, -14]
];
const mg_rook_table = [
  [32, 42, 32, 51, 63,  9, 31, 43],
  [27, 32, 58, 62, 80, 55, 26, 20],
  [-5, 19, 26, 36, 17, 45, 61, 16],
  [-24,-11,  7, 26, 24, 35, -8,-20],
  [-36,-26,-12, -1,  9, -7,  6,-23],
  [-45,-25,-16,-17,  3,  0, -5,-33],
  [-44,-16,-20, -9, -1, 11, -6,-71],
  [-19,-13,  1, 17, 16,  7,-37,-26]
];
const mg_queen_table = [
  [-28,  0, 29, 12, 59, 44, 43, 45],
  [-24,-39,-5,  1,-16, 57, 28, 54],
  [-13,-17, 7,  8, 29, 56, 47, 57],
  [-27,-27,-16,-16, -1, 17, -2,  1],
  [-9,-26,-9, -10, -2, -4,  3, -3],
  [-14,  2,-11, -2, -5,  2, 14,  5],
  [-35, -8, 11,  2,  8, 15, -3,  1],
  [-1, -18, -9, 10,-15,-25,-31,-50]
];
const mg_king_table = [
  [-65, 23, 16,-15,-56,-34,  2, 13],
  [29, -1,-20, -7, -8, -4,-38,-29],
  [-9, 24,  2,-16,-20,  6, 22,-22],
  [-17,-20,-12,-27,-30,-25,-14,-36],
  [-49, -1,-27,-39,-46,-44,-33,-51],
  [-14,-14,-22,-46,-44,-30,-15,-27],
  [1,  7, -8,-64,-43,-16,  9,  8],
  [-15, 36, 12,-54,  8,-28, 24, 14]
];
const eg_king_table = [
  [-74,-35,-18,-18,-11, 15,  4,-17],
  [-12, 17, 14, 17, 17, 38, 23, 11],
  [10, 17, 23, 15, 20, 45, 44, 13],
  [-8, 22, 24, 27, 26, 33, 26,  3],
  [-18, -4, 21, 24, 27, 23,  9,-11],
  [-19, -3, 11, 21, 23, 16,  7, -9],
  [-27,-11,  4, 13, 14,  4, -5,-17],
  [-53,-34,-21,-11,-28,-14,-24,-43]
];

// Tables mapping
const TABLES = {
    p: { mg: mg_pawn_table, eg: eg_pawn_table },
    n: { mg: mg_knight_table, eg: mg_knight_table }, // Using mg for eg roughly
    b: { mg: mg_bishop_table, eg: mg_bishop_table },
    r: { mg: mg_rook_table, eg: mg_rook_table },
    q: { mg: mg_queen_table, eg: mg_queen_table },
    k: { mg: mg_king_table, eg: eg_king_table }
};

const evaluateBoard = (board, aiColor) => {
    let mgScore = 0;
    let egScore = 0;
    let gamePhase = 0;
    let aiMat = 0;
    let opMat = 0;
    let aiKing = null;
    let opKing = null;

    for (let r = 0; r < 8; r++) {
        for (let c = 0; c < 8; c++) {
            const piece = board[r][c];
            if (!piece) continue;

            const type = piece.toLowerCase();
            const color = getColor(piece);
            const isWhitePiece = color === 'white';
            
            // Calculate Phase (to interpolate MG and EG scores)
            // Total non-pawn material max ~24.
            const mw = { n: 1, b: 1, r: 2, q: 4, k: 0, p: 0 };
            gamePhase += mw[type] || 0;

            // PST Lookups
            // If White: index is [r][c]. If Black: index is [7-r][c] (mirror vertically)
            // Actually PeSTO tables are usually relative to piece POV.
            // White P on rank 6 (index 1) is close to promo. 
            // Our array: 0 is top, 7 is bottom. White starts at 7.
            // So for White, r corresponds to table directly? No, table usually 0=rank 1 (backrank).
            // Let's map: White Backrank is 7. Table Backrank is usually 7 (bottom) or 0 (top)?
            // Standard: Rank 1 is bottom.
            // Our Board: 7 is bottom.
            // PST Table: row 0 is Rank 8 (Top), row 7 is Rank 1 (Bottom).
            // So White Piece at board[r][c]: table value at table[r][c].
            // Black Piece at board[r][c]: table value at table[7-r][c] (mirrored).
            
            const tr = isWhitePiece ? r : 7 - r; // Mirror for black
            // Actually for black we need to mirror the table lookup to treat it as if it was white on the other side
            
            const mgVal = (mg_value[type] || 0) + (TABLES[type]?.mg[tr]?.[c] || 0);
            const egVal = (eg_value[type] || 0) + (TABLES[type]?.eg[tr]?.[c] || 0);

            if (color === aiColor) {
                mgScore += mgVal;
                egScore += egVal;
                aiMat += mg_value[type] || 0;
                if (type === 'k') aiKing = {r, c};
            } else {
                mgScore -= mgVal;
                egScore -= egVal;
                opMat += mg_value[type] || 0;
                if (type === 'k') opKing = {r, c};
            }
        }
    }

    // Interpolate Phase
    const mgPhase = Math.min(24, gamePhase);
    const egPhase = 24 - mgPhase;
    
    let score = (mgScore * mgPhase + egScore * egPhase) / 24;

    // Endgame Mop-up Evaluation
    // Encourage pushing enemy king to edge if we have material advantage (no pawns or just winning)
    if (egPhase > 10 && aiMat > opMat + 200 && opKing && aiKing) {
        // Distance between kings (closer is better for checkmate usually)
        const dist = Math.abs(aiKing.r - opKing.r) + Math.abs(aiKing.c - opKing.c);
        score += (14 - dist) * 5; // Reward proximity

        // Push enemy king to center dist (center is 3.5, 3.5) -> dist from center
        const centerDist = Math.abs(opKing.r - 3.5) + Math.abs(opKing.c - 3.5);
        score += centerDist * 10; // Reward enemy king being far from center (edge)
    }

    return score;
};

// --- Quiescence Search ---
const quiescence = (board, alpha, beta, turn, aiColor, castlingRights, lastMove) => {
    const standPat = evaluateBoard(board, aiColor);
    
    if (standPat >= beta) return standPat;
    if (alpha < standPat) alpha = standPat;

    const moves = getValidChessMoves(board, turn, lastMove, castlingRights).filter(m => m.captured);
    // Sort captures by MVV-LVA (Most Valuable Victim - Least Valuable Aggressor) roughly
    // Simplified: sort by captured value
    moves.sort((a, b) => {
        const valA = mg_value[a.captured?.toLowerCase()] || 0;
        const valB = mg_value[b.captured?.toLowerCase()] || 0;
        return valB - valA;
    });

    for (const move of moves) {
        const { board: nextBoard } = executeChessMove(board, move);
        const nextTurn = turn === 'white' ? 'black' : 'white';
        const score = quiescence(nextBoard, -beta, -alpha, nextTurn, aiColor, castlingRights, move);

        if (score >= beta) return beta;
        if (score > alpha) alpha = score;
    }
    return alpha;
};

// --- Minimax ---

const minimax = (board, depth, alpha, beta, maximizingPlayer, turn, aiColor, castlingRights, lastMove, deadline) => {
    // Time Check in Recursion
    if (deadline && Date.now() > deadline) throw new Error('TIMEOUT');
    if (depth === 0) {
        // Use Quiescence at leaf nodes
        return { score: quiescence(board, alpha, beta, turn, aiColor, castlingRights, lastMove) };
    }

    const moves = getValidChessMoves(board, turn, lastMove, castlingRights);
    
    if (moves.length === 0) {
        if (isInCheck(board, turn)) {
            return { score: maximizingPlayer ? -100000 : 100000 }; // Checkmate
        }
        return { score: 0 }; // Stalemate
    }

    let bestMove = moves[0];

    if (maximizingPlayer) {
        let maxEval = -Infinity;
        
        // Sort captures first
        moves.sort((a, b) => (b.captured ? 1 : 0) - (a.captured ? 1 : 0));

        for (const move of moves) {
            const { board: nextBoard } = executeChessMove(board, move);
            const nextTurn = turn === 'white' ? 'black' : 'white';
            
            // Ideally we update castling rights/lastMove for recursion, but simplified for now (stateless recursion or assumptions)
            // To do it right: need to update them. 
            // For simplicity in this basic AI: we assume rights don't change drastically in 2-3 moves or we ignore deep castling logic logic for performance.
            // Correct way: update them.
            // Since executeChessMove doesn't return updated rights, we skip updating them for depth > 1 to keep it simple and fast.
            // This weakens the AI slightly but avoids complexity hell in this single file.
            
            const evalObj = minimax(nextBoard, depth - 1, alpha, beta, false, nextTurn, aiColor, castlingRights, move);
            
            if (evalObj.score > maxEval) {
                maxEval = evalObj.score;
                bestMove = move;
            }
            alpha = Math.max(alpha, evalObj.score);
            if (beta <= alpha) break;
        }
        return { score: maxEval, move: bestMove };
    } else {
        let minEval = Infinity;
        moves.sort((a, b) => (b.captured ? 1 : 0) - (a.captured ? 1 : 0));

        for (const move of moves) {
            const { board: nextBoard } = executeChessMove(board, move);
            const nextTurn = turn === 'white' ? 'black' : 'white';
            const evalObj = minimax(nextBoard, depth - 1, alpha, beta, true, nextTurn, aiColor, castlingRights, move);
            
            if (evalObj.score < minEval) {
                minEval = evalObj.score;
                bestMove = move;
            }
            beta = Math.min(beta, evalObj.score);
            if (beta <= alpha) break;
        }
        return { score: minEval, move: bestMove };
    }
};

Deno.serve(async (req) => {
        // Randomness / Suboptimal moves
        // Instead of pure minimax, we collect top moves and pick based on randomness score
        // Implementation: Inside minimax, we usually return BEST. 
        // We can run minimax at Root, get scores for all moves, then pick.
        // Refactor Root Call to get all move scores:
        
        const rootMoves = getValidChessMoves(board, turn, lastMove, castlingRights);
        if (rootMoves.length === 0) return Response.json({ error: 'No moves' }, { status: 200 });
        
        let scoredMoves = [];
        
        // Run search for each root move
        // Time budget split? No, just run depth search on each branch or standard AlphaBeta root
        // Standard AlphaBeta returns best move only. We need list for randomness.
        // Let's run shallow search (depth 1) to sort, then deep search on best?
        // Or just modify Root search loop here.
        
        for (const move of rootMoves) {
            if (Date.now() > deadline - 50) break;
            
            // Execute move
            const { board: nextBoard } = executeChessMove(board, move);
            const nextTurn = turn === 'white' ? 'black' : 'white';
            
            // Search
            // We use maxDepth-1 because we already made one move
            try {
                const res = minimax(nextBoard, maxDepth - 1, -Infinity, Infinity, false, nextTurn, turn, castlingRights, move, deadline);
                scoredMoves.push({ move, score: res.score });
            } catch(e) {
                scoredMoves.push({ move, score: -Infinity }); // Timeout treated as bad
            }
        }
        
        // Sort by score (descending for Maximizer - which is AI, AI wants to Maximize its score)
        // Our evaluateBoard returns positive for AI color.
        scoredMoves.sort((a, b) => b.score - a.score);
        
        let selected = scoredMoves[0];
        
        // Apply Randomness/Blunder Chance
        // If randomness > 0, we might pick 2nd or 3rd best
        if (randomness > 0 && scoredMoves.length > 1) {
            const roll = Math.random() * 100;
            if (roll < randomness) {
                // Pick from top 3 weighted?
                // Or just pick 2nd best
                const cand = scoredMoves.slice(0, Math.min(scoredMoves.length, 3));
                selected = cand[Math.floor(Math.random() * cand.length)];
            }
        }

        return Response.json({
            move: selected.move,
            score: selected.score
        });

        let bestMoveSoFar = null;
        let currentDepth = 1;
        
        // Iterative Deepening
        while (currentDepth <= maxDepth) {
            // Check if we ran out of time budget
            if (Date.now() > deadline - 100) break; // Leave 100ms buffer

            try {
                const result = minimax(board, currentDepth, -Infinity, Infinity, true, turn, turn, castlingRights || { wK: true, wQ: true, bK: true, bQ: true }, lastMove, deadline);
                if (result && result.move) {
                    bestMoveSoFar = result;
                }
                // If we found a checkmate, stop searching
                if (Math.abs(result.score) > 90000) break;
            } catch (e) {
                if (e.message === 'TIMEOUT') break;
                throw e;
            }
            currentDepth++;
        }

        const result = bestMoveSoFar || { move: null, score: 0 };
        
        if (!result.move) {
            return Response.json({ error: 'No moves available' }, { status: 200 });
        }

        return Response.json({
            move: result.move,
            score: result.score
        });

    } catch (error) {
        console.error(error);
        return Response.json({ error: error.message }, { status: 500 });
    }
});