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

// --- Evaluation ---

const PIECE_VALUES = { p: 100, n: 320, b: 330, r: 500, q: 900, k: 20000 };

const evaluateBoard = (board, aiColor) => {
    let score = 0;
    for (let r = 0; r < 8; r++) {
        for (let c = 0; c < 8; c++) {
            const piece = board[r][c];
            if (!piece) continue;
            
            const type = piece.toLowerCase();
            const color = getColor(piece);
            const value = PIECE_VALUES[type];
            
            if (color === aiColor) score += value;
            else score -= value;
            
            // Positional Tweaks (simplified)
            // Center control
            if ((r === 3 || r === 4) && (c === 3 || c === 4)) {
                if (color === aiColor) score += 10; else score -= 10;
            }
        }
    }
    return score;
};

// --- Minimax ---

const minimax = (board, depth, alpha, beta, maximizingPlayer, turn, aiColor, castlingRights, lastMove) => {
    if (depth === 0) {
        return { score: evaluateBoard(board, aiColor) };
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
    try {
        const base44 = createClientFromRequest(req);
        const { board, turn, difficulty = 'medium', castlingRights, lastMove } = await req.json();

        if (!board || !turn) {
            return Response.json({ error: 'Missing board or turn' }, { status: 400 });
        }

        // Chess Depth
        let depth = 2;
        switch (difficulty) {
            case 'easy': depth = 1; break;
            case 'medium': depth = 2; break;
            case 'hard': depth = 3; break;
            case 'expert': depth = 4; break;
            case 'grandmaster': depth = 5; break;
            default: depth = 2;
        }

        const result = minimax(board, depth, -Infinity, Infinity, true, turn, turn, castlingRights || { wK: true, wQ: true, bK: true, bQ: true }, lastMove);
        
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