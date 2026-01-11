import React from "react";
import ChessBoard from "@/components/ChessBoard";
import { base44 } from "@/api/base44Client";
import { getValidChessMoves, executeChessMove, getSan, isInCheck } from "@/components/chessLogic";

export default function DailyChessPuzzle({ puzzle, board: initialBoard }) {
  const [board, setBoard] = React.useState(() => (Array.isArray(initialBoard) ? initialBoard : Array.from({length:8},()=>Array(8).fill(null))));
  const [castlingRights, setCastlingRights] = React.useState({ wK: true, wQ: true, bK: true, bQ: true });
  const [lastMove, setLastMove] = React.useState(null);
  const [currentTurn, setCurrentTurn] = React.useState('white');
  const [selected, setSelected] = React.useState(null);
  const [validMoves, setValidMoves] = React.useState([]);
  const [step, setStep] = React.useState(0);
  const [pieceSet, setPieceSet] = React.useState('standard');
  const [message, setMessage] = React.useState('');

  React.useEffect(() => {
    (async () => {
      const me = await base44.auth.me().catch(() => null);
      if (me?.preferences?.chess_pieces) setPieceSet(me.preferences.chess_pieces);
    })();
  }, []);

  // Normalize SAN (remove +, #, spaces)
  const normSan = (s) => (s || '').replace(/[+#]/g, '').trim();

  const solution = React.useMemo(() => {
    try {
      const arr = JSON.parse(puzzle?.solution_moves || '[]');
      return Array.isArray(arr) ? arr.map(String) : [];
    } catch (_) { return []; }
  }, [puzzle?.solution_moves]);

  const handleSquareClick = (r, c) => {
    const piece = board[r]?.[c];
    // If selecting a piece of current side
    const isWhite = piece && piece === piece.toUpperCase();
    const myColor = currentTurn === 'white';
    const isMyPiece = !!piece && ((myColor && isWhite) || (!myColor && !isWhite));

    if (isMyPiece) {
      const moves = getValidChessMoves(board, currentTurn, lastMove, castlingRights);
      setSelected([r, c]);
      setValidMoves(moves.filter(m => m.from.r === r && m.from.c === c));
      setMessage('');
      return;
    }

    if (selected) {
      const move = validMoves.find(m => m.to.r === r && m.to.c === c);
      if (!move) { setSelected(null); setValidMoves([]); return; }

      // Promotion auto-queen if needed
      const movingPiece = board[move.from.r][move.from.c];
      if (movingPiece && movingPiece.toLowerCase() === 'p' && (move.to.r === 0 || move.to.r === 7)) {
        move.promotion = 'q';
      }

      // Validate against solution SAN
      const san = normSan(getSan(board, move, castlingRights, lastMove));
      const targetSan = normSan(solution[step]);
      if (targetSan && san !== targetSan) {
        setMessage('Mauvais coup, réessayez.');
        return;
      }

      // Execute
      const { board: newBoard, piece: movedPiece } = executeChessMove(board, move);
      // Update castling rights
      const newCastling = { ...castlingRights };
      if (movedPiece && movedPiece.toLowerCase() === 'k') {
        if (currentTurn === 'white') { newCastling.wK = false; newCastling.wQ = false; }
        else { newCastling.bK = false; newCastling.bQ = false; }
      }
      if (movedPiece && movedPiece.toLowerCase() === 'r') {
        if (move.from.r === 7 && move.from.c === 0) newCastling.wQ = false;
        if (move.from.r === 7 && move.from.c === 7) newCastling.wK = false;
        if (move.from.r === 0 && move.from.c === 0) newCastling.bQ = false;
        if (move.from.r === 0 && move.from.c === 7) newCastling.bK = false;
      }

      setBoard(newBoard);
      setCastlingRights(newCastling);
      setLastMove({ ...move, piece: movedPiece });
      setSelected(null);
      setValidMoves([]);
      const nextTurn = currentTurn === 'white' ? 'black' : 'white';
      setCurrentTurn(nextTurn);

      const nextStep = step + 1;
      setStep(nextStep);
      if (nextStep >= solution.length) {
        setMessage('Bravo ! Puzzle résolu.');
      } else {
        // Optional hint: check if opponent is in check
        if (isInCheck(newBoard, nextTurn)) setMessage('Échec !'); else setMessage('');
      }
    }
  };

  return (
    <div className="w-full max-w-[640px] mx-auto">
      <ChessBoard
        board={board}
        onSquareClick={handleSquareClick}
        validMoves={validMoves}
        currentTurn={currentTurn}
        orientation="white"
        pieceSet={pieceSet || 'standard'}
      />
      {message && (
        <div className="mt-2 text-sm text-center text-[#4a3728] dark:text-[#e8dcc5]">{message}</div>
      )}
    </div>
  );
}