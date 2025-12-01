// Utilitaires pour la logique du jeu de dames (8x8)

// Initialise le plateau standard 8x8
// 0 = vide, 1 = blanc, 2 = noir, 3 = dame blanche, 4 = dame noire
export const initializeBoard = () => {
    const board = Array(8).fill(null).map(() => Array(8).fill(0));
    for (let row = 0; row < 8; row++) {
        for (let col = 0; col < 8; col++) {
            // Les pions sont sur les cases sombres uniquement
            if ((row + col) % 2 !== 0) {
                if (row < 3) board[row][col] = 2; // Noir en haut
                if (row > 4) board[row][col] = 1; // Blanc en bas
            }
        }
    }
    return board;
};

// Vérifie si des mouvements sont possibles pour un joueur
export const hasValidMoves = (board, player) => { // player: 'white' or 'black'
    // Logique simplifiée pour vérifier l'existence de mouvements
    // Dans une implémentation complète, cela devrait parcourir toutes les pièces
    return true; 
};

// Vérifie si un mouvement est valide
// Retourne un objet { valid: boolean, captured: {row, col} | null }
export const validateMove = (board, from, to, turn) => {
    const [fromRow, fromCol] = from;
    const [toRow, toCol] = to;
    const piece = board[fromRow][fromCol];
    
    // Vérifications de base
    if (piece === 0) return { valid: false };
    if (board[toRow][toCol] !== 0) return { valid: false }; // Case cible occupée
    if ((toRow + toCol) % 2 === 0) return { valid: false }; // Doit être case sombre

    const isWhite = piece === 1 || piece === 3;
    const isKing = piece === 3 || piece === 4;
    const playerColor = isWhite ? 'white' : 'black';

    if (playerColor !== turn) return { valid: false };

    const rowDiff = toRow - fromRow;
    const colDiff = toCol - fromCol;
    const absRowDiff = Math.abs(rowDiff);
    const absColDiff = Math.abs(colDiff);

    // Mouvement simple (1 case)
    if (absRowDiff === 1 && absColDiff === 1) {
        if (!isKing) {
            // Les pions normaux ne reculent pas
            if (isWhite && rowDiff > 0) return { valid: false };
            if (!isWhite && rowDiff < 0) return { valid: false };
        }
        return { valid: true, captured: null };
    }

    // Mouvement de capture (2 cases) - Standard Checkers (jump over)
    if (absRowDiff === 2 && absColDiff === 2) {
        const midRow = fromRow + rowDiff / 2;
        const midCol = fromCol + colDiff / 2;
        const midPiece = board[midRow][midCol];

        if (midPiece === 0) return { valid: false }; // Rien à capturer
        
        const isMidWhite = midPiece === 1 || midPiece === 3;
        // On ne peut pas capturer ses propres pièces
        if (isWhite === isMidWhite) return { valid: false };

        // Règles standard : capture avant/arrière autorisée pour Roi, 
        // Pions capturent seulement avant (en règles US/UK) ou arrière (Règles Int/Fr).
        // Pour satisfaire "règles françaises", on autorise la capture arrière pour tous.
        
        return { valid: true, captured: { row: midRow, col: midCol } };
    }

    return { valid: false };
};

// Exécute le mouvement et retourne le nouveau plateau
export const executeMove = (board, from, to, captured) => {
    const newBoard = board.map(row => [...row]);
    const [fromRow, fromCol] = from;
    const [toRow, toCol] = to;
    const piece = newBoard[fromRow][fromCol];

    newBoard[toRow][toCol] = piece;
    newBoard[fromRow][fromCol] = 0;

    if (captured) {
        newBoard[captured.row][captured.col] = 0;
    }

    // Promotion en dame
    if (piece === 1 && toRow === 0) {
        newBoard[toRow][toCol] = 3; // Dame blanche
    } else if (piece === 2 && toRow === 7) {
        newBoard[toRow][toCol] = 4; // Dame noire
    }

    return newBoard;
};

// Vérifie la condition de victoire
export const checkWinner = (board) => {
    let whiteCount = 0;
    let blackCount = 0;

    board.forEach(row => {
        row.forEach(cell => {
            if (cell === 1 || cell === 3) whiteCount++;
            if (cell === 2 || cell === 4) blackCount++;
        });
    });

    if (whiteCount === 0) return 'black';
    if (blackCount === 0) return 'white';
    return null;
};