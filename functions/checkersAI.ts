import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

// --- Logic duplicated/adapted from frontend for backend execution ---
// Representation: 0=empty, 1=white, 2=black, 3=white_king, 4=black_king

const isValidPos = (r, c) => r >= 0 && r < 10 && c >= 0 && c < 10;

const isOwnPiece = (piece, turn) => {
    if (!piece || piece === 0) return false;
    const isWhite = piece === 1 || piece === 3;
    return turn === 'white' ? isWhite : !isWhite;
};

const isOpponent = (piece, turn) => {
    if (!piece || piece === 0) return false;
    const isWhite = piece === 1 || piece === 3;
    return turn === 'white' ? !isWhite : isWhite;
};

// Simplified execution for simulation (doesn't need to track "promoted" flag for return, just modifies board)
const executeMove = (board, from, to, captured) => {
    // Deep copy board
    const newBoard = board.map(row => [...row]);
    const [fromRow, fromCol] = from;
    const [toRow, toCol] = to;
    const piece = newBoard[fromRow][fromCol];

    newBoard[toRow][toCol] = piece;
    newBoard[fromRow][fromCol] = 0;

    if (captured) {
        newBoard[captured.r][captured.c] = 0;
    }

    // Promotion
    if (piece === 1 && toRow === 0) {
        newBoard[toRow][toCol] = 3;
    } else if (piece === 2 && toRow === 9) {
        newBoard[toRow][toCol] = 4;
    }

    return newBoard;
};

const getMovesForPiece = (board, r, c, piece, onlyCaptures = false) => {
    const moves = [];
    const captures = [];
    const isKing = piece === 3 || piece === 4;
    const isWhite = piece === 1 || piece === 3;
    const directions = [[-1, -1], [-1, 1], [1, -1], [1, 1]];

    directions.forEach(([dr, dc]) => {
        if (!isKing) {
            const forward = isWhite ? -1 : 1;
            // Move
            if (!onlyCaptures && dr === forward) {
                const nr = r + dr, nc = c + dc;
                if (isValidPos(nr, nc) && board[nr][nc] === 0) {
                    moves.push({ from: {r,c}, to: {r: nr, c: nc}, captured: null });
                }
            }
            // Capture
            const jr = r + (dr * 2), jc = c + (dc * 2);
            const mr = r + dr, mc = c + dc;
            if (isValidPos(jr, jc) && isValidPos(mr, mc)) {
                if (board[jr][jc] === 0 && isOpponent(board[mr][mc], isWhite ? 'white' : 'black')) {
                    captures.push({ from: {r,c}, to: {r: jr, c: jc}, captured: {r: mr, c: mc} });
                }
            }
        } else {
            // King
            let dist = 1;
            while (true) {
                const nr = r + (dr * dist);
                const nc = c + (dc * dist);
                if (!isValidPos(nr, nc)) break;
                const cell = board[nr][nc];
                if (cell === 0) {
                    if (!onlyCaptures) moves.push({ from: {r,c}, to: {r: nr, c: nc}, captured: null });
                } else {
                    if (isOwnPiece(cell, isWhite ? 'white' : 'black')) break;
                    else {
                        let jumpDist = 1;
                        while (true) {
                            const jr = nr + (dr * jumpDist);
                            const jc = nc + (dc * jumpDist);
                            if (!isValidPos(jr, jc) || board[jr][jc] !== 0) break;
                            captures.push({ from: {r,c}, to: {r: jr, c: jc}, captured: {r: nr, c: nc} });
                            jumpDist++;
                        }
                        break;
                    }
                }
                dist++;
            }
        }
    });
    return { moves, captures };
};

const getAllMoves = (board, turn) => {
    let moves = [];
    let captureMoves = [];
    for (let r = 0; r < 10; r++) {
        for (let c = 0; c < 10; c++) {
            const piece = board[r][c];
            if (isOwnPiece(piece, turn)) {
                const { moves: m, captures: cpts } = getMovesForPiece(board, r, c, piece);
                moves.push(...m);
                captureMoves.push(...cpts);
            }
        }
    }
    // Mandatory capture rule
    if (captureMoves.length > 0) {
        // Simplification: In simulation we pick all captures. 
        // Implementing "Majority Capture" strictly is expensive for AI depth, 
        // but we can filter by max length if needed. For now, returning all captures is safer for search space coverage.
        return captureMoves;
    }
    return moves;
};


// --- AI Evaluation & Search ---

// Weights
const WEIGHTS = {
    PIECE: 100,
    KING: 300,
    POS_CENTER: 2,
    POS_EDGE: 1,
    RANDOM_FACTOR: 10
};

const evaluateBoard = (board, aiColor) => {
    let score = 0;
    const isWhiteAI = aiColor === 'white';
    
    for (let r = 0; r < 10; r++) {
        for (let c = 0; c < 10; c++) {
            const piece = board[r][c];
            if (piece === 0) continue;

            let value = 0;
            const isKing = piece === 3 || piece === 4;
            const isWhitePiece = piece === 1 || piece === 3;

            // Material
            value += isKing ? WEIGHTS.KING : WEIGHTS.PIECE;

            // Position (encourage center control)
            if (c > 2 && c < 7 && r > 2 && r < 7) value += WEIGHTS.POS_CENTER;
            
            // Add to score based on side
            if (isWhitePiece === isWhiteAI) {
                score += value;
            } else {
                score -= value;
            }
        }
    }
    return score;
};

// Minimax with Alpha-Beta
const minimax = (board, depth, alpha, beta, maximizingPlayer, turn, aiColor) => {
    if (depth === 0) {
        return { score: evaluateBoard(board, aiColor) };
    }

    const moves = getAllMoves(board, turn);
    
    // Game over or stuck
    if (moves.length === 0) {
        // If maximizing player has no moves, they lose
        return { score: maximizingPlayer ? -10000 : 10000 };
    }

    if (maximizingPlayer) {
        let maxEval = -Infinity;
        let bestMove = moves[0]; // Default
        
        // Sort moves? (Captures first for better pruning)
        moves.sort((a, b) => (b.captured ? 1 : 0) - (a.captured ? 1 : 0));

        for (const move of moves) {
            const nextBoard = executeMove(board, [move.from.r, move.from.c], [move.to.r, move.to.c], move.captured);
            const nextTurn = turn === 'white' ? 'black' : 'white';
            
            // Note: Checkers often has multi-jump. This simple Minimax does single steps.
            // For full correctness with multi-jumps, we'd need to check if 'move' was a capture 
            // and if more captures are available for the same piece.
            // Simplifying: Assuming turn ends after one move step for AI evaluation speed. 
            // (Ideally should simulate full turn).
            
            const evalObj = minimax(nextBoard, depth - 1, alpha, beta, false, nextTurn, aiColor);
            
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
        let bestMove = moves[0];
        
        moves.sort((a, b) => (b.captured ? 1 : 0) - (a.captured ? 1 : 0));

        for (const move of moves) {
            const nextBoard = executeMove(board, [move.from.r, move.from.c], [move.to.r, move.to.c], move.captured);
            const nextTurn = turn === 'white' ? 'black' : 'white';
            
            const evalObj = minimax(nextBoard, depth - 1, alpha, beta, true, nextTurn, aiColor);
            
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
        if (req.method !== 'POST') {
            return Response.json({ error: 'Method not allowed' }, { status: 405 });
        }

        const base44 = createClientFromRequest(req);
        const { board, turn, difficulty = 'medium' } = await req.json();

        if (!board || !turn) {
            return Response.json({ error: 'Missing board or turn' }, { status: 400 });
        }

        // Set depth based on difficulty
        let depth;
        switch (difficulty) {
            case 'easy': depth = 2; break; // Fast, shallow
            case 'hard': depth = 6; break; // Slower, smarter
            case 'expert': depth = 8; break; // Very slow
            case 'medium': default: depth = 4; break;
        }

        // Run AI
        const result = minimax(board, depth, -Infinity, Infinity, true, turn, turn);
        
        return Response.json({
            move: result.move,
            score: result.score,
            depth: depth
        });

    } catch (error) {
        console.error(error);
        return Response.json({ error: error.message }, { status: 500 });
    }
});