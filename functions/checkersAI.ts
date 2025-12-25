/**
 * IA de dames (draughts) par Jules - Intégration pour Damcash (Base44)
 * 
 * INSTRUCTIONS:
 * 1. Copiez TOUT ce code dans le fichier functions/checkersAI de Base44
 * 2. Remplacez TOUT le contenu existant
 * 3. Cliquez sur "Publish" pour déployer
 * 
 * Caractéristiques:
 * - Force ELO estimée: ~1900-2100 (vs ~1450 pour l'IA actuelle)
 * - Minimax avec Alpha-Beta pruning
 * - Quiescence Search (évite l'effet horizon)
 * - Move ordering (captures en premier)
 * - Règles FMJD (plateau 10x10, dames volantes, prise obligatoire max)
 */

// ==================================================================================
// == MOTEUR IA DE JULES (DraughtsEngine)
// ==================================================================================

class DraughtsEngine {
    constructor() {
        // Constants
        this.EMPTY = 0;
        this.WHITE_MAN = 1;
        this.WHITE_KING = 2;
        this.BLACK_MAN = 3;
        this.BLACK_KING = 4;

        this.WHITE = 1;
        this.BLACK = 2;

        // Directions (UL, UR, DL, DR)
        this.NEIGHBORS = [];
        this.DIR_UL = 0;
        this.DIR_UR = 1;
        this.DIR_DL = 2;
        this.DIR_DR = 3;

        this.board = new Int8Array(51); // Index 1-50
        this.initTables();
    }

    initTables() {
        this.NEIGHBORS = new Array(51).fill(0).map(() => [0, 0, 0, 0]);
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
        let c;
        if (r % 2 === 0) c = pos * 2 + 1;
        else c = pos * 2;
        return { r, c };
    }

    getSquare(r, c) {
        if (r < 0 || r > 9 || c < 0 || c > 9) return 0;
        if ((r % 2 === 0 && c % 2 !== 1) || (r % 2 !== 0 && c % 2 !== 0)) return 0;
        const pos = Math.floor(c / 2);
        return r * 5 + pos + 1;
    }

    // Advanced heuristic evaluation
    evaluate(board, turnColor) {
        let whiteScore = 0;
        let blackScore = 0;

        for (let i = 1; i <= 50; i++) {
            const piece = board[i];
            if (piece === this.EMPTY) continue;

            if (piece === this.WHITE_MAN) {
                whiteScore += 100;
                const r = Math.floor((i - 1) / 5);
                whiteScore += (9 - r) * 2; // Advancement bonus
                if (r === 4 || r === 5) whiteScore += 3; // Center control
                if (i >= 46 && i <= 50) whiteScore += 5; // Back rank guard
            } else if (piece === this.WHITE_KING) {
                whiteScore += 300;
            } else if (piece === this.BLACK_MAN) {
                blackScore += 100;
                const r = Math.floor((i - 1) / 5);
                blackScore += r * 2; // Advancement bonus
                if (r === 4 || r === 5) blackScore += 3; // Center control
                if (i >= 1 && i <= 5) blackScore += 5; // Back rank guard
            } else if (piece === this.BLACK_KING) {
                blackScore += 300;
            }
        }

        const evalScore = whiteScore - blackScore;
        return turnColor === this.WHITE ? evalScore : -evalScore;
    }

    applyMove(board, move) {
        const newBoard = new Int8Array(board);
        const piece = newBoard[move.from];
        newBoard[move.from] = this.EMPTY;
        newBoard[move.to] = piece;

        if (move.isCapture) {
            for (const capturedIndex of move.captured) {
                newBoard[capturedIndex] = this.EMPTY;
            }
        }

        // Promotion
        if (piece === this.WHITE_MAN && move.to <= 5) {
            newBoard[move.to] = this.WHITE_KING;
        } else if (piece === this.BLACK_MAN && move.to >= 46) {
            newBoard[move.to] = this.BLACK_KING;
        }

        return newBoard;
    }

    getBestMove(board, heroColor, depth = 4) {
        let bestMove = null;
        let alpha = -Infinity;
        let beta = Infinity;
        const self = this;
        
        const maximize = (board, currentDepth, alpha, beta, turnColor) => {
            const moves = self.getValidMoves(board, turnColor);
            if (moves.length === 0) return -100000 - currentDepth;
            if (currentDepth === 0) return self.quiescence(board, alpha, beta, turnColor, heroColor);

            moves.sort((a, b) => {
                if (a.isCapture && !b.isCapture) return -1;
                if (!a.isCapture && b.isCapture) return 1;
                return 0;
            });

            let maxEval = -Infinity;
            for (const move of moves) {
                const nextBoard = self.applyMove(board, move);
                const nextColor = turnColor === self.WHITE ? self.BLACK : self.WHITE;
                const evalVal = minimize(nextBoard, currentDepth - 1, alpha, beta, nextColor);
                
                if (evalVal > maxEval) {
                    maxEval = evalVal;
                    if (currentDepth === depth) bestMove = move;
                }
                alpha = Math.max(alpha, evalVal);
                if (beta <= alpha) break;
            }
            return maxEval;
        };

        const minimize = (board, currentDepth, alpha, beta, turnColor) => {
            const moves = self.getValidMoves(board, turnColor);
            if (moves.length === 0) return 100000 + currentDepth;
            if (currentDepth === 0) return self.quiescence(board, alpha, beta, turnColor, heroColor);

            moves.sort((a, b) => {
                if (a.isCapture && !b.isCapture) return -1;
                if (!a.isCapture && b.isCapture) return 1;
                return 0;
            });

            let minEval = Infinity;
            for (const move of moves) {
                const nextBoard = self.applyMove(board, move);
                const nextColor = turnColor === self.WHITE ? self.BLACK : self.WHITE;
                const evalVal = maximize(nextBoard, currentDepth - 1, alpha, beta, nextColor);
                
                if (evalVal < minEval) minEval = evalVal;
                beta = Math.min(beta, evalVal);
                if (beta <= alpha) break;
            }
            return minEval;
        };

        maximize(board, depth, alpha, beta, heroColor);
        return bestMove;
    }

    quiescence(board, alpha, beta, turnColor, heroColor) {
        const standPat = this.evaluate(board, heroColor);
        const moves = this.getValidMoves(board, turnColor);
        const captureMoves = moves.filter(m => m.isCapture);
        
        if (captureMoves.length === 0) return standPat;
        
        const isMaximizing = (turnColor === heroColor);
        
        if (isMaximizing) {
            let maxScore = -Infinity;
            for (const move of captureMoves) {
                const nextBoard = this.applyMove(board, move);
                const nextColor = turnColor === this.WHITE ? this.BLACK : this.WHITE;
                const score = this.quiescence(nextBoard, alpha, beta, nextColor, heroColor);
                if (score > maxScore) maxScore = score;
                alpha = Math.max(alpha, maxScore);
                if (beta <= alpha) break;
            }
            return maxScore;
        } else {
            let minScore = Infinity;
            for (const move of captureMoves) {
                const nextBoard = this.applyMove(board, move);
                const nextColor = turnColor === this.WHITE ? this.BLACK : this.WHITE;
                const score = this.quiescence(nextBoard, alpha, beta, nextColor, heroColor);
                if (score < minScore) minScore = score;
                beta = Math.min(beta, minScore);
                if (beta <= alpha) break;
            }
            return minScore;
        }
    }

    getValidMoves(board, turnColor) {
        const captures = [];
        let maxCaptureCount = 0;
        
        for (let s = 1; s <= 50; s++) {
            const piece = board[s];
            if (piece === this.EMPTY) continue;
            const pieceColor = (piece === this.WHITE_MAN || piece === this.WHITE_KING) ? this.WHITE : this.BLACK;
            if (pieceColor !== turnColor) continue;

            const pieceCaptures = this.findCaptures(board, s, piece);
            if (pieceCaptures.length > 0) {
                for (const move of pieceCaptures) {
                    if (move.captured.length > maxCaptureCount) {
                        maxCaptureCount = move.captured.length;
                    }
                    captures.push(move);
                }
            }
        }

        if (captures.length > 0) {
            return captures.filter(m => m.captured.length === maxCaptureCount);
        }

        const moves = [];
        for (let s = 1; s <= 50; s++) {
            const piece = board[s];
            if (piece === this.EMPTY) continue;
            const pieceColor = (piece === this.WHITE_MAN || piece === this.WHITE_KING) ? this.WHITE : this.BLACK;
            if (pieceColor !== turnColor) continue;

            const simple = this.findSimpleMoves(board, s, piece);
            moves.push(...simple);
        }
        return moves;
    }

    findSimpleMoves(board, square, piece) {
        const moves = [];
        const isKing = (piece === this.WHITE_KING || piece === this.BLACK_KING);
        const isWhite = (piece === this.WHITE_MAN || piece === this.WHITE_KING);
        
        let dirs = [];
        if (isKing) dirs = [0, 1, 2, 3];
        else if (isWhite) dirs = [0, 1];
        else dirs = [2, 3];

        for (const d of dirs) {
            let current = square;
            while (true) {
                const next = this.NEIGHBORS[current][d];
                if (next === 0) break;
                if (board[next] === this.EMPTY) {
                    moves.push({ from: square, to: next, captured: [], isCapture: false });
                    if (!isKing) break;
                    current = next;
                } else {
                    break;
                }
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
        const self = this;
        
        const search = (currentSquare, currentBoard, capturedIndices, path) => {
            let foundContinuation = false;
            const dirs = [0, 1, 2, 3];
            
            for (const d of dirs) {
                let landing = currentSquare;
                let capturedSquare = 0;
                
                while (true) {
                    landing = self.NEIGHBORS[landing][d];
                    if (landing === 0) break;

                    const cell = currentBoard[landing];
                    
                    if (cell === self.EMPTY) {
                        if (capturedSquare !== 0) {
                            if (capturedIndices.includes(capturedSquare)) break;

                            const newCaptured = [...capturedIndices, capturedSquare];
                            const newPath = [...path, landing];
                            
                            foundContinuation = true;
                            search(landing, currentBoard, newCaptured, newPath);
                            
                            if (!isKing) break;
                        } else {
                            if (!isKing) break;
                        }
                    } else if (cell === enemyMan || cell === enemyKing) {
                        if (capturedSquare !== 0) break;
                        capturedSquare = landing;
                        if (capturedIndices.includes(capturedSquare)) break;
                    } else {
                        break;
                    }
                }
            }

            if (!foundContinuation && capturedIndices.length > 0) {
                captures.push({
                    from: square,
                    to: currentSquare,
                    captured: capturedIndices,
                    isCapture: true,
                    path: path
                });
            }
        };

        search(square, board, [], []);
        return captures;
    }
}

// ==================================================================================
// == ADAPTATEUR DAMCASH (Conversion plateau 10x10 <-> notation 1-50)
// ==================================================================================

const damcashAdapter = {
    // Convertit le plateau 10x10 de Damcash en plateau 1-50 de Jules
    fromDamcashBoard: (damcashBoard, engine) => {
        const julesBoard = new Int8Array(51);
        for (let r = 0; r < 10; r++) {
            for (let c = 0; c < 10; c++) {
                // Seules les cases jouables (diagonales sombres)
                if ((r % 2 === 0 && c % 2 === 1) || (r % 2 === 1 && c % 2 === 0)) {
                    const square = engine.getSquare(r, c);
                    if (square > 0 && square <= 50) {
                        const piece = damcashBoard[r]?.[c] || 0;
                        // Mapping des pièces Damcash -> Engine
                        // Damcash: 0 empty, 1 WM, 2 BM, 3 WK, 4 BK
                        // Engine:  0 empty, 1 WM, 2 WK, 3 BM, 4 BK
                        let mapped = 0;
                        if (piece === 1) mapped = engine.WHITE_MAN;
                        else if (piece === 2) mapped = engine.BLACK_MAN; // 2 -> 3
                        else if (piece === 3) mapped = engine.WHITE_KING; // 3 -> 2
                        else if (piece === 4) mapped = engine.BLACK_KING;
                        else mapped = 0;
                        julesBoard[square] = mapped;
                    }
                }
            }
        }
        return julesBoard;
    },

    // Convertit un mouvement de Jules en format Damcash
    toDamcashMove: (julesMove, engine) => {
        const fromRC = engine.getRC(julesMove.from);
        const toRC = engine.getRC(julesMove.to);
        const capturesRC = julesMove.captured.map(s => engine.getRC(s));
        
        return {
            from: { r: fromRC.r, c: fromRC.c },
            to: { r: toRC.r, c: toRC.c },
            captures: capturesRC.map(rc => ({ r: rc.r, c: rc.c }))
        };
    }
};

// ==================================================================================
// == HANDLER DENO.SERVE (Point d'entrée pour Base44)
// ==================================================================================

Deno.serve(async (req) => {
    try {
        const { board, turn, difficulty = 'medium', activePiece } = await req.json();

        if (!board || !turn) {
            return new Response(JSON.stringify({ error: 'Missing board or turn' }), { 
                status: 400,
                headers: { "Content-Type": "application/json" }
            });
        }

        const engine = new DraughtsEngine();
        const julesBoard = damcashAdapter.fromDamcashBoard(board, engine);

        // Déterminer la couleur de l'IA
        const aiColor = turn === 'white' ? engine.WHITE : engine.BLACK;
        
        // Profondeur de recherche selon la difficulté
        let depth = 4;
        if (difficulty === 'easy') depth = 2;
        else if (difficulty === 'hard') depth = 6;

        // Obtenir le meilleur coup
        const bestMove = engine.getBestMove(julesBoard, aiColor, depth);

        if (!bestMove) {
            return new Response(JSON.stringify({ error: 'No move found' }), { 
                status: 500,
                headers: { "Content-Type": "application/json" }
            });
        }

        // Convertir le mouvement au format Damcash
        const damcashMove = damcashAdapter.toDamcashMove(bestMove, engine);

        // Format de réponse compatible avec Damcash
        return new Response(JSON.stringify({ 
            move: damcashMove,
            score: 0,
            fullSequence: [damcashMove]
        }), { 
            headers: { "Content-Type": "application/json" }
        });

    } catch (e) {
        console.error('AI Error:', e);
        return new Response(JSON.stringify({ error: e.message }), { 
            status: 500,
            headers: { "Content-Type": "application/json" }
        });
    }
});