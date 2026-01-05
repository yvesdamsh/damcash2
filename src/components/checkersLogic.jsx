// Logique du jeu de dames - Règles Internationales (10x10)
export const BOARD_SIZE = 10;
// - Pions : Déplacement avant (1 case), Prise avant/arrière.
// - Dames (Rois) : Déplacement toute distance diagonale, Prise toute distance.
// - Prise obligatoire.
// - Prise multiple prioritaire (optionnel, ici on force juste la prise si disponible).

export const initializeBoard = () => {
    const board = Array(BOARD_SIZE).fill(null).map(() => Array(BOARD_SIZE).fill(0));
    for (let row = 0; row < BOARD_SIZE; row++) {
        for (let col = 0; col < BOARD_SIZE; col++) {
            if ((row + col) % 2 !== 0) {
                if (row < 4) board[row][col] = 2; // Noir (4 rangées)
                if (row > 5) board[row][col] = 1; // Blanc (4 rangées)
            }
        }
    }
    return board;
};

// --- Helpers ---

const isValidPos = (r, c) => r >= 0 && r < BOARD_SIZE && c >= 0 && c < BOARD_SIZE;

const getPiece = (board, r, c) => isValidPos(r, c) ? board[r][c] : null;

const isOpponent = (piece, currentTurn) => {
    if (!piece || piece === 0) return false;
    const isWhite = piece === 1 || piece === 3;
    return currentTurn === 'white' ? !isWhite : isWhite;
};

const isOwnPiece = (piece, currentTurn) => {
    if (!piece || piece === 0) return false;
    const isWhite = piece === 1 || piece === 3;
    return currentTurn === 'white' ? isWhite : !isWhite;
};

// --- Core Logic ---

// Helper for Majority Capture
const getMaxChainLength = (board, r, c, piece) => {
    const { captures } = getMovesForPiece(board, r, c, piece, true);
    if (captures.length === 0) return 0;
    
    let max = 0;
    for (const cap of captures) {
        const { newBoard } = executeMove(board, [r,c], [cap.to.r, cap.to.c], cap.captured);
        let len = 1;
        // International rules: a man that reaches the king row during a capture continues the sequence as a king
        len += getMaxChainLength(newBoard, cap.to.r, cap.to.c, newBoard[cap.to.r][cap.to.c]);
        if (len > max) max = len;
    }
    return max;
};

// Retourne tous les coups possibles pour un joueur donné
// Si des prises sont possibles, retourne UNIQUEMENT les prises MAJORITAIRES (Prise obligatoire)
export const getValidMoves = (board, turn) => {
    let moves = [];
    let captureMoves = [];

    for (let r = 0; r < BOARD_SIZE; r++) {
        for (let c = 0; c < BOARD_SIZE; c++) {
            const piece = board[r][c];
            if (isOwnPiece(piece, turn)) {
                const pieceMoves = getMovesForPiece(board, r, c, piece);
                moves.push(...pieceMoves.moves);
                captureMoves.push(...pieceMoves.captures);
            }
        }
    }

    // Si des captures existent, elles sont obligatoires ET Majoritaires
    if (captureMoves.length > 0) {
        let maxCaptureDepth = 0;
        
        // Calculate depth for all candidate captures
        const capturesWithDepth = captureMoves.map(move => {
            const { newBoard, promoted } = executeMove(board, [move.from.r, move.from.c], [move.to.r, move.to.c], move.captured);
            let depth = 1;
            if (!promoted) {
                 depth += getMaxChainLength(newBoard, move.to.r, move.to.c, newBoard[move.to.r][move.to.c]);
            }
            if (depth > maxCaptureDepth) maxCaptureDepth = depth;
            return { ...move, depth };
        });

        // Return only moves that lead to max capture count
        return capturesWithDepth.filter(m => m.depth === maxCaptureDepth);
    }
    return moves;
};

// Retourne les coups pour une pièce spécifique
export const getMovesForPiece = (board, r, c, piece, onlyCaptures = false) => {
    const moves = [];
    const captures = [];
    const isKing = piece === 3 || piece === 4;
    const isWhite = piece === 1 || piece === 3;
    
    // Directions: [dRow, dCol]
    const directions = [[-1, -1], [-1, 1], [1, -1], [1, 1]];

    directions.forEach(([dr, dc]) => {
        // Logique PION
        if (!isKing) {
            // Mouvement simple (seulement vers l'avant pour pions)
            const forward = isWhite ? -1 : 1;
            if (!onlyCaptures && dr === forward) {
                const nr = r + dr, nc = c + dc;
                if (isValidPos(nr, nc) && board[nr][nc] === 0) {
                    moves.push({ from: {r,c}, to: {r: nr, c: nc}, captured: null });
                }
            }

            // Prise (avant et arrière pour pions internationaux)
            const jr = r + (dr * 2), jc = c + (dc * 2);
            const mr = r + dr, mc = c + dc;

            if (isValidPos(jr, jc) && isValidPos(mr, mc)) {
                if (board[jr][jc] === 0 && isOpponent(board[mr][mc], isWhite ? 'white' : 'black')) {
                    captures.push({ from: {r,c}, to: {r: jr, c: jc}, captured: {r: mr, c: mc} });
                }
            }
        } 
        // Logique DAME (Flying King)
        else {
            let dist = 1;
            for (let __safe=0; __safe<100; __safe++) {
                const nr = r + (dr * dist);
                const nc = c + (dc * dist);

                if (!isValidPos(nr, nc)) break;

                const cell = board[nr][nc];

                if (cell === 0) {
                    // Case vide : mouvement possible si pas onlyCaptures
                    if (!onlyCaptures) {
                        moves.push({ from: {r,c}, to: {r: nr, c: nc}, captured: null });
                    }
                } else {
                    // Pièce rencontrée
                    if (isOwnPiece(cell, isWhite ? 'white' : 'black')) {
                        break; // Bloqué par ami
                    } else {
                        // Ennemi rencontré : vérifier si on peut sauter DERRIÈRE
                        // On doit vérifier les cases après l'ennemi
                        let jumpDist = 1;
                        for (let __safe=0; __safe<100; __safe++) {
                            const jr = nr + (dr * jumpDist);
                            const jc = nc + (dc * jumpDist);
                            if (!isValidPos(jr, jc) || board[jr][jc] !== 0) break;
                            
                            // Case vide derrière l'ennemi = Prise valide
                            captures.push({ from: {r,c}, to: {r: jr, c: jc}, captured: {r: nr, c: nc} });
                            jumpDist++;
                        }
                        break; // On ne peut pas sauter plus d'une pièce d'un coup dans la même ligne sans atterrir
                    }
                }
                dist++;
            }
        }
    });

    return { moves, captures };
};

// Valide un coup spécifique (utilisé par l'UI pour vérifier si le clic est bon)
// Doit être cohérent avec getValidMoves (respect de l'obligation de prise)
export const validateMove = (board, from, to, turn, mustCapture = false) => {
    // 1. Générer tous les coups valides globaux pour vérifier l'obligation de prise
    // Si mustCapture est true, on sait déjà qu'on est dans une séquence de prise
    
    const allMoves = getValidMoves(board, turn);
    const isCaptureAvailable = allMoves.some(m => m.captured !== null);
    
    // Trouver le coup correspondant dans la liste des coups valides
    const move = allMoves.find(m => 
        m.from.r === from[0] && m.from.c === from[1] &&
        m.to.r === to[0] && m.to.c === to[1]
    );

    if (!move) return { valid: false };

    // Si une prise est disponible globalement, on ne peut pas jouer un coup simple
    if (isCaptureAvailable && !move.captured) {
        return { valid: false, error: "Prise obligatoire !" };
    }

    return { valid: true, captured: move.captured };
};

export const executeMove = (board, from, to, captured) => {
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
    let promoted = false;
    if (piece === 1 && toRow === 0) {
        newBoard[toRow][toCol] = 3;
        promoted = true;
    } else if (piece === 2 && toRow === BOARD_SIZE - 1) {
        newBoard[toRow][toCol] = 4;
        promoted = true;
    }

    return { newBoard, promoted };
};

export const checkWinner = (board) => {
    let whiteCount = 0;
    let blackCount = 0;
    let whiteMoves = false;
    let blackMoves = false;

    // Compte simple
    board.forEach(row => {
        row.forEach(cell => {
            if (cell === 1 || cell === 3) whiteCount++;
            if (cell === 2 || cell === 4) blackCount++;
        });
    });

    // Vérification de blocage (plus coûteux, à faire si count > 0)
    if (whiteCount > 0) {
        const moves = getValidMoves(board, 'white');
        if (moves.length > 0) whiteMoves = true;
    }
    if (blackCount > 0) {
        const moves = getValidMoves(board, 'black');
        if (moves.length > 0) blackMoves = true;
    }

    if (whiteCount === 0 || !whiteMoves) return 'black';
    if (blackCount === 0 || !blackMoves) return 'white';
    return null;
};

export const getCheckersPositionId = (board, turn) => {
    const boardStr = board.map(row => row.join('')).join('');
    return `${boardStr}-${turn}`;
};

export const checkCheckersStatus = (board, turn, halfMoveClock = 0, positionHistory = {}) => {
    // 1. Check Win/Loss
    const winner = checkWinner(board);
    if (winner) return { status: 'finished', winner };

    // 2. 50-Move Rule (100 half-moves without capture)
    // Standard rule varies, but 50 moves without capture is a safe generic implementation
    if (halfMoveClock >= 100) return { status: 'finished', result: 'draw_50_moves' };

    // 3. Threefold Repetition
    const currentPos = getCheckersPositionId(board, turn);
    if (positionHistory[currentPos] >= 3) return { status: 'finished', result: 'draw_repetition' };

    return { status: 'playing' };
};