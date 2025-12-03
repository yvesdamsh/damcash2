import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

// --- Checkers Logic (Backend Optimized) ---

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

// Helper to deep copy board
const cloneBoard = (board) => board.map(row => [...row]);

// Execute a SINGLE step (jump or move)
const executeStep = (board, from, to, captured) => {
    const newBoard = cloneBoard(board);
    const [fromRow, fromCol] = from;
    const [toRow, toCol] = to;
    const piece = newBoard[fromRow][fromCol];

    newBoard[toRow][toCol] = piece;
    newBoard[fromRow][fromCol] = 0;

    if (captured) {
        newBoard[captured.r][captured.c] = 0;
    }

    // Promotion (King me)
    let promoted = false;
    if (piece === 1 && toRow === 0) {
        newBoard[toRow][toCol] = 3;
        promoted = true;
    } else if (piece === 2 && toRow === 9) {
        newBoard[toRow][toCol] = 4;
        promoted = true;
    }

    return { newBoard, promoted };
};

// Get all basic moves/captures from a specific position
const getStepsForPiece = (board, r, c, piece, onlyCaptures = false) => {
    const moves = [];
    const captures = [];
    const isKing = piece === 3 || piece === 4;
    const isWhite = piece === 1 || piece === 3;
    
    const directions = [[-1, -1], [-1, 1], [1, -1], [1, 1]];

    directions.forEach(([dr, dc]) => {
        // Paws (Men)
        if (!isKing) {
            const forward = isWhite ? -1 : 1;
            // Simple Move
            if (!onlyCaptures && dr === forward) {
                const nr = r + dr, nc = c + dc;
                if (isValidPos(nr, nc) && board[nr][nc] === 0) {
                    moves.push({ from: {r,c}, to: {r: nr, c: nc}, captured: null });
                }
            }
            // Capture
            const jr = r + (dr * 2), jc = c + (dc * 2); // Jump destination
            const mr = r + dr, mc = c + dc; // Middle (victim)
            
            if (isValidPos(jr, jc) && isValidPos(mr, mc)) {
                if (board[jr][jc] === 0 && isOpponent(board[mr][mc], isWhite ? 'white' : 'black')) {
                    captures.push({ from: {r,c}, to: {r: jr, c: jc}, captured: {r: mr, c: mc} });
                }
            }
        } 
        // Kings (Flying Kings)
        else {
             let dist = 1;
             while (true) {
                 const nr = r + (dr * dist);
                 const nc = c + (dc * dist);
                 if (!isValidPos(nr, nc)) break;
                 
                 const cell = board[nr][nc];
                 if (cell === 0) {
                     if (!onlyCaptures) moves.push({ from: {r,c}, to: {r: nr, c: nc}, captured: null });
                 } else {
                     // Hit a piece
                     if (isOwnPiece(cell, isWhite ? 'white' : 'black')) break; // Blocked by friend
                     
                     // Enemy - check jump
                     let jumpDist = 1;
                     while (true) {
                         const jr = nr + (dr * jumpDist);
                         const jc = nc + (dc * jumpDist);
                         if (!isValidPos(jr, jc) || board[jr][jc] !== 0) break;
                         
                         captures.push({ from: {r,c}, to: {r: jr, c: jc}, captured: {r: nr, c: nc} });
                         jumpDist++;
                     }
                     break; // Can't jump over two
                 }
                 dist++;
             }
        }
    });

    return { moves, captures };
};

// Recursively build full capture chains
const getFullCaptureChains = (board, r, c, piece) => {
    const { captures } = getStepsForPiece(board, r, c, piece, true);
    if (captures.length === 0) return [];

    const chains = [];
    for (const cap of captures) {
        const { newBoard, promoted } = executeStep(board, [r,c], [cap.to.r, cap.to.c], cap.captured);
        
        if (promoted) {
            chains.push({
                finalBoard: newBoard,
                steps: [cap],
                score: 1 // 1 capture
            });
        } else {
            // Recursion
            const subChains = getFullCaptureChains(newBoard, cap.to.r, cap.to.c, piece); // Pass same piece type as it moved
            if (subChains.length === 0) {
                chains.push({
                    finalBoard: newBoard,
                    steps: [cap],
                    score: 1
                });
            } else {
                for (const sub of subChains) {
                    chains.push({
                        finalBoard: sub.finalBoard,
                        steps: [cap, ...sub.steps],
                        score: 1 + sub.score
                    });
                }
            }
        }
    }
    return chains;
};

// Get ALL valid full moves for a turn
const getAllPlayableMoves = (board, turn) => {
    let simpleMoves = [];
    let captureChains = [];

    for (let r = 0; r < 10; r++) {
        for (let c = 0; c < 10; c++) {
            const piece = board[r][c];
            if (isOwnPiece(piece, turn)) {
                // Check captures first (Mandatory)
                const chains = getFullCaptureChains(board, r, c, piece);
                if (chains.length > 0) {
                    captureChains.push(...chains);
                } 
                
                // If no global captures found yet, collect simple moves
                if (captureChains.length === 0) {
                    const { moves } = getStepsForPiece(board, r, c, piece, false);
                    // Format simple moves to match chain structure
                    simpleMoves.push(...moves.map(m => ({
                        finalBoard: executeStep(board, [m.from.r, m.from.c], [m.to.r, m.to.c], null).newBoard,
                        steps: [m],
                        score: 0
                    })));
                }
            }
        }
    }

    if (captureChains.length > 0) {
        // Filter by Max Length (Majority Rule)
        const maxScore = Math.max(...captureChains.map(c => c.score));
        return captureChains.filter(c => c.score === maxScore);
    }
    return simpleMoves;
};

// --- Evaluation ---

const WEIGHTS = {
    PIECE: 100,
    KING: 300,
    BACK_ROW: 20,      // Keep back row intact
    CENTER: 5,         // Control center
    EDGE: 2,           // Edges are safer than middle of nowhere
    ADVANCED: 3,       // Push forward
    MOBILITY: 1        // Number of moves available
};

const evaluate = (board, aiColor, turn) => {
    let score = 0;
    let whitePieces = 0;
    let blackPieces = 0;
    
    // Basic Material & Position
    for (let r = 0; r < 10; r++) {
        for (let c = 0; c < 10; c++) {
            const piece = board[r][c];
            if (piece === 0) continue;

            const isWhite = piece === 1 || piece === 3;
            const isKing = piece === 3 || piece === 4;
            
            let value = isKing ? WEIGHTS.KING : WEIGHTS.PIECE;

            // Position Bonuses
            if (c === 0 || c === 9) value += WEIGHTS.EDGE;
            if (c >= 3 && c <= 6 && r >= 3 && r <= 6) value += WEIGHTS.CENTER;
            
            // Advancement (for non-kings)
            if (!isKing) {
                const rank = isWhite ? (9 - r) : r;
                value += rank * WEIGHTS.ADVANCED;
                
                // Back row safety
                if ((isWhite && r === 9) || (!isWhite && r === 0)) value += WEIGHTS.BACK_ROW;
            }

            if (isWhite) {
                whitePieces++;
                score += value;
            } else {
                blackPieces++;
                score -= value;
            }
        }
    }

    return aiColor === 'white' ? score : -score;
};

// --- Minimax ---

const minimax = (board, depth, alpha, beta, maximizingPlayer, turn, aiColor) => {
    // 1. Generate Moves
    const moves = getAllPlayableMoves(board, turn);

    // 2. Terminal States
    if (depth === 0) {
        return { score: evaluate(board, aiColor, turn) };
    }
    if (moves.length === 0) {
        // No moves = Loss
        return { score: maximizingPlayer ? -100000 : 100000 };
    }

    // 3. Search
    let bestMove = moves[0];
    
    if (maximizingPlayer) {
        let maxEval = -Infinity;
        
        // Move ordering (Captures first)
        moves.sort((a, b) => b.score - a.score);

        for (const move of moves) {
            const nextTurn = turn === 'white' ? 'black' : 'white';
            const evalObj = minimax(move.finalBoard, depth - 1, alpha, beta, false, nextTurn, aiColor);
            
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
        
        moves.sort((a, b) => b.score - a.score);

        for (const move of moves) {
            const nextTurn = turn === 'white' ? 'black' : 'white';
            const evalObj = minimax(move.finalBoard, depth - 1, alpha, beta, true, nextTurn, aiColor);
            
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
        const { board, turn, difficulty = 'medium' } = await req.json();

        if (!board || !turn) {
            return Response.json({ error: 'Missing board or turn' }, { status: 400 });
        }

        // Depth Configuration
        let depth = 4; 
        switch (difficulty) {
            case 'easy': depth = 2; break;
            case 'medium': depth = 4; break;
            case 'hard': depth = 6; break;
            case 'expert': depth = 8; break;
            case 'grandmaster': depth = 10; break;
            default: depth = 4;
        }

        const result = minimax(board, depth, -Infinity, Infinity, true, turn, turn);
        
        if (!result.move) {
            return Response.json({ error: 'No moves available' }, { status: 200 });
        }

        const firstStep = result.move.steps[0];

        return Response.json({
            move: firstStep, // { from, to, captured }
            score: result.score,
            fullSequence: result.move.steps
        });

    } catch (error) {
        console.error(error);
        return Response.json({ error: error.message }, { status: 500 });
    }
});