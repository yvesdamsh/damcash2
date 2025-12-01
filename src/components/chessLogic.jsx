// Chess Game Logic

export const INITIAL_BOARD_FEN = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";

// Piece types: p=pawn, r=rook, n=knight, b=bishop, q=queen, k=king
// Case: lowercase=black, uppercase=white

export const initializeChessBoard = () => {
    const board = Array(8).fill(null).map(() => Array(8).fill(null));
    // Standard setup
    const setup = [
        ['r', 'n', 'b', 'q', 'k', 'b', 'n', 'r'], // Black pieces row 0
        ['p', 'p', 'p', 'p', 'p', 'p', 'p', 'p'], // Black pawns row 1
        Array(8).fill(null),
        Array(8).fill(null),
        Array(8).fill(null),
        Array(8).fill(null),
        ['P', 'P', 'P', 'P', 'P', 'P', 'P', 'P'], // White pawns row 6
        ['R', 'N', 'B', 'Q', 'K', 'B', 'N', 'R']  // White pieces row 7
    ];
    return setup;
};

const isWhite = (piece) => piece && piece === piece.toUpperCase();
const isBlack = (piece) => piece && piece === piece.toLowerCase();
const getColor = (piece) => {
    if (!piece) return null;
    return isWhite(piece) ? 'white' : 'black';
};

const isValidPos = (r, c) => r >= 0 && r < 8 && c >= 0 && c < 8;

export const getValidChessMoves = (board, turn, lastMove = null, castlingRights = { wK: true, wQ: true, bK: true, bQ: true }) => {
    let moves = [];
    for (let r = 0; r < 8; r++) {
        for (let c = 0; c < 8; c++) {
            const piece = board[r][c];
            if (piece && getColor(piece) === turn) {
                moves.push(...getPieceMoves(board, r, c, piece, lastMove, castlingRights));
            }
        }
    }
    
    // Filter moves that leave king in check
    return moves.filter(move => {
        const tempBoard = executeChessMove(board, move).board;
        return !isInCheck(tempBoard, turn);
    });
};

export const getPieceMoves = (board, r, c, piece, lastMove, castlingRights) => {
    const moves = [];
    const type = piece.toLowerCase();
    const color = getColor(piece);
    const direction = color === 'white' ? -1 : 1;
    const startRow = color === 'white' ? 6 : 1;

    // Helper to add move if valid
    const addMove = (tr, tc) => {
        if (isValidPos(tr, tc)) {
            const target = board[tr][tc];
            if (!target || getColor(target) !== color) {
                moves.push({ from: { r, c }, to: { r: tr, c: tc }, captured: target });
            }
        }
    };

    if (type === 'p') {
        // Forward 1
        if (isValidPos(r + direction, c) && !board[r + direction][c]) {
            moves.push({ from: { r, c }, to: { r: r + direction, c }, captured: null });
            // Forward 2
            if (r === startRow && !board[r + direction * 2][c] && !board[r + direction][c]) {
                moves.push({ from: { r, c }, to: { r: r + direction * 2, c }, captured: null });
            }
        }
        // Captures
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
        // Castling (simplified logic - assumes not in check check done elsewhere usually, but added here)
        if (!isCurrentInCheck(board, color)) {
             const row = color === 'white' ? 7 : 0;
             if (r === row && c === 4) {
                 // King side
                 if (castlingRights[color === 'white' ? 'wK' : 'bK'] && !board[row][5] && !board[row][6]) {
                     if (!isSquareAttacked(board, row, 5, color) && !isSquareAttacked(board, row, 6, color))
                        moves.push({ from: {r, c}, to: {r: row, c: 6}, castle: 'king' });
                 }
                 // Queen side
                 if (castlingRights[color === 'white' ? 'wQ' : 'bQ'] && !board[row][3] && !board[row][2] && !board[row][1]) {
                     if (!isSquareAttacked(board, row, 3, color) && !isSquareAttacked(board, row, 2, color))
                        moves.push({ from: {r, c}, to: {r: row, c: 2}, castle: 'queen' });
                 }
             }
        }
    } else {
        // Sliding pieces (b, r, q)
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

export const executeChessMove = (board, move) => {
    const newBoard = board.map(row => [...row]);
    const piece = newBoard[move.from.r][move.from.c];

    if (!piece) return { board: newBoard, piece: null, promoted: false };

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

    // Promotion
    let promoted = false;
    if (piece.toLowerCase() === 'p' && (move.to.r === 0 || move.to.r === 7)) {
        // Use provided promotion type or default to Queen
        const promoteTo = move.promotion ? move.promotion.toLowerCase() : 'q';
        const newPieceChar = getColor(piece) === 'white' ? promoteTo.toUpperCase() : promoteTo;
        newBoard[move.to.r][move.to.c] = newPieceChar;
        promoted = true;
    }

    return { board: newBoard, piece, promoted };
    };

export const isCurrentInCheck = (board, color) => {
    let kingPos;
    for(let r=0; r<8; r++) {
        for(let c=0; c<8; c++) {
            if (board[r][c] === (color === 'white' ? 'K' : 'k')) {
                kingPos = {r, c};
                break;
            }
        }
    }
    if (!kingPos) return true; // Should not happen
    return isSquareAttacked(board, kingPos.r, kingPos.c, color);
};

// Is the square attacked by the OPPONENT of 'color'
const isSquareAttacked = (board, r, c, color) => {
    const opponent = color === 'white' ? 'black' : 'white';
    // Simple check: iterate all opponent pieces and see if they can hit (r,c)
    // Optimization: check from the square outwards like a Knight, Rook, Bishop to see if hit
    
    // Check Knight attacks
    const knightMoves = [[-2, -1], [-2, 1], [-1, -2], [-1, 2], [1, -2], [1, 2], [2, -1], [2, 1]];
    for (let [dr, dc] of knightMoves) {
        const tr = r + dr, tc = c + dc;
        if (isValidPos(tr, tc)) {
            const p = board[tr][tc];
            if (p && getColor(p) === opponent && p.toLowerCase() === 'n') return true;
        }
    }

    // Check sliding (Rook/Queen)
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

    // Check diagonal (Bishop/Queen)
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

    // Check Pawn
    const pawnDir = color === 'white' ? -1 : 1; // Opponent pawn attacks from opposite
    // White king checks black pawns: black pawns are at r-1 (if white is at r)
    // Actually if I am white, opponent is black. Black pawns attack "down" (+1).
    // If I am checking if square R,C is attacked by Black: check R-1,C-1 and R-1,C+1 for Black Pawn
    const attackDir = color === 'white' ? -1 : 1; 
    [[attackDir, -1], [attackDir, 1]].forEach(([dr, dc]) => {
        const tr = r + dr, tc = c + dc;
        if (isValidPos(tr, tc)) {
            const p = board[tr][tc];
            if (p && getColor(p) === opponent && p.toLowerCase() === 'p') return true;
        }
    });

    // Check King
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

export const isInCheck = (board, color) => {
    return isCurrentInCheck(board, color);
};

export const getPositionId = (board, turn, castlingRights, lastMove) => {
    const boardStr = board.map(r => r.map(p => p || '-').join('')).join('/');
    const castling = [
        castlingRights.wK ? 'K' : '',
        castlingRights.wQ ? 'Q' : '',
        castlingRights.bK ? 'k' : '',
        castlingRights.bQ ? 'q' : ''
    ].join('') || '-';
    
    let ep = '-';
    if (lastMove && lastMove.piece && lastMove.piece.toLowerCase() === 'p' && Math.abs(lastMove.from.r - lastMove.to.r) === 2) {
        const r = (lastMove.from.r + lastMove.to.r) / 2;
        const c = lastMove.from.c;
        ep = `${r},${c}`;
    }

    return `${boardStr} ${turn} ${castling} ${ep}`;
};

export const checkChessStatus = (board, turn, lastMove, castlingRights, halfMoveClock = 0, positionHistory = {}) => {
    // 1. Check Checkmate/Stalemate
    const validMoves = getValidChessMoves(board, turn, lastMove, castlingRights);
    if (validMoves.length === 0) {
        if (isInCheck(board, turn)) return 'checkmate';
        return 'stalemate';
    }

    // 2. 50-Move Rule (100 half-moves)
    if (halfMoveClock >= 100) return 'draw_50_moves';

    // 3. Threefold Repetition
    const currentPos = getPositionId(board, turn, castlingRights, lastMove);
    if (positionHistory[currentPos] >= 3) return 'draw_repetition';

    return 'playing';
};