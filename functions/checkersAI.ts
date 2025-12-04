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
const getAllPlayableMoves = (board, turn, activePiece = null) => {
    let simpleMoves = [];
    let captureChains = [];

    for (let r = 0; r < 10; r++) {
        for (let c = 0; c < 10; c++) {
            // If activePiece is defined, skip all other pieces
            if (activePiece && (r !== activePiece.r || c !== activePiece.c)) continue;

            const piece = board[r][c];
            if (isOwnPiece(piece, turn)) {
                // Check captures first (Mandatory)
                const chains = getFullCaptureChains(board, r, c, piece);
                if (chains.length > 0) {
                    captureChains.push(...chains);
                } 
                
                // If no global captures found yet (and not restricted to active capture sequence), collect simple moves
                // If activePiece is set, it usually means we MUST capture (continuation). 
                // But if no captures available for activePiece (shouldn't happen if logic is correct upstream), simple moves might be valid? 
                // No, usually activePiece implies "mid-capture".
                // Let's allow simple moves only if activePiece is NOT set.
                if (captureChains.length === 0 && !activePiece) {
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
    BACK_ROW: 30,      // Stronger back row preference
    CENTER: 15,        // Stronger center control
    EDGE: 5,           // Edges are safer
    ADVANCED: 5,       // Push forward
    MOBILITY: 2,       // Number of moves available
    DOG_HOLE: -20,     // Penalty for being trapped in corners
    BRIDGE: 15,        // Bonus for holding bridge (c=2, r=9 or c=7, r=0)
    OREO: 15           // Bonus for Oreo pattern (defensive triangle)
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
            // Edges (Safe from double jumps often)
            if (c === 0 || c === 9) value += WEIGHTS.EDGE;
            
            // Center Box (Control)
            if (c >= 3 && c <= 6 && r >= 3 && r <= 6) value += WEIGHTS.CENTER;
            
            // Advancement (for non-kings) - Reward getting closer to King
            if (!isKing) {
                const rank = isWhite ? (9 - r) : r;
                // Progressive advancement
                value += rank * rank * 0.5; 
                
                // Back row safety (Keep pieces on home row as long as possible)
                if ((isWhite && r === 9) || (!isWhite && r === 0)) value += WEIGHTS.BACK_ROW;

                // Dog Hole Penalty (Trapped pieces at r0,c1 or r0,c8 roughly)
                if (isWhite && r===9 && (c===0 || c===2)) value += WEIGHTS.DOG_HOLE;
            } else {
                // King centralization
                 if (c >= 2 && c <= 7 && r >= 2 && r <= 7) value += 10;
            }

            // Patterns
            // Bridge (White: r9 c2/4/6/8? Standard checkers 10x10 board is big)
            // Assuming 10x10 international checkers (0-9)
            // Bridge is usually central back.

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

// --- Quiescence Search ---
// Extends the search for forced sequences (captures) to avoid horizon effect
const quiescence = (board, alpha, beta, maximizingPlayer, turn, aiColor) => {
    // Generate moves
    const moves = getAllPlayableMoves(board, turn);
    
    // 1. Game Over / Terminal
    if (moves.length === 0) {
        return maximizingPlayer ? -100000 : 100000;
    }

    // 2. Check if "Quiet"
    // In our logic, capture moves have score > 0.
    const isForced = moves[0].score > 0;

    if (!isForced) {
        // Quiet position: Return static evaluation
        return evaluate(board, aiColor, turn);
    }

    // 3. Forced/Capture Node: Continue Searching
    if (maximizingPlayer) {
        let maxEval = -Infinity;
        // Note: moves are already mandatory captures if isForced is true
        for (const move of moves) {
            const nextTurn = turn === 'white' ? 'black' : 'white';
            // Recursively call quiescence
            const score = quiescence(move.finalBoard, alpha, beta, false, nextTurn, aiColor);
            
            if (score > maxEval) maxEval = score;
            alpha = Math.max(alpha, score);
            if (beta <= alpha) break;
        }
        return maxEval;
    } else {
        let minEval = Infinity;
        for (const move of moves) {
            const nextTurn = turn === 'white' ? 'black' : 'white';
            const score = quiescence(move.finalBoard, alpha, beta, true, nextTurn, aiColor);
            
            if (score < minEval) minEval = score;
            beta = Math.min(beta, score);
            if (beta <= alpha) break;
        }
        return minEval;
    }
};

// --- Minimax ---

const minimax = (board, depth, alpha, beta, maximizingPlayer, turn, aiColor, activePiece = null, deadline = null) => {
    // Time Check
    if (deadline && Date.now() > deadline) throw new Error('TIMEOUT');

    // 1. Generate Moves (Pass activePiece only for the root call/current state)
    const moves = getAllPlayableMoves(board, turn, activePiece);

    // 2. Terminal States
    if (moves.length === 0) {
        return { score: maximizingPlayer ? -100000 : 100000 };
    }
    
    // Depth 0 -> Quiescence Search instead of Evaluate
    if (depth === 0) {
        return { score: quiescence(board, alpha, beta, maximizingPlayer, turn, aiColor) };
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
        const { board, turn, difficulty = 'medium', activePiece } = await req.json();

        if (!board || !turn) {
            return Response.json({ error: 'Missing board or turn' }, { status: 400 });
        }

        // Depth Configuration
        let maxDepth = 4; 
        switch (difficulty) {
            case 'easy': maxDepth = 2; break;
            case 'medium': maxDepth = 4; break;
            case 'hard': maxDepth = 6; break;
            case 'expert': maxDepth = 8; break;
            case 'grandmaster': maxDepth = 10; break;
            default: maxDepth = 4;
        }
        
        // Panic Mode
        if (timeLeft && timeLeft < 10) maxDepth = Math.min(maxDepth, 4);
        if (timeLeft && timeLeft < 5) maxDepth = 2;

        // Iterative Deepening
        let bestMoveSoFar = null;
        let currentDepth = 2; // Start with decent depth
        
        // If activePiece (multi-jump in progress), we must play the forced sequence.
        // Minimax handles it, but depth can be lower.
        if (activePiece) maxDepth = 12; // Forced moves are fast to calculate

        while (currentDepth <= maxDepth) {
            if (!activePiece && Date.now() > deadline - 50) break;

            try {
                const result = minimax(board, currentDepth, -Infinity, Infinity, true, turn, turn, activePiece, deadline);
                if (result && result.move) {
                    bestMoveSoFar = result;
                }
                if (Math.abs(result.score) > 90000) break; // Mate/Win found
            } catch (e) {
                if (e.message === 'TIMEOUT') break;
                throw e;
            }
            currentDepth += 2; // Checkers implies 2-ply increments usually for stability, or 1
        }

        const result = bestMoveSoFar || { move: null, score: 0 };
        
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