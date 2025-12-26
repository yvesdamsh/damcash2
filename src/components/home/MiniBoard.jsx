import React from "react";

export default function MiniBoard({ type = 'chess', className = '', board = null, onSquareClick, lastMove = null }) {
  const n = Array.isArray(board) && board.length ? board.length : (type === 'chess' ? 8 : 10);
  const darkColor = type === 'chess' ? (document.documentElement.classList.contains('dark') ? '#0f3d1a' : '#1f4d2e') : (document.documentElement.classList.contains('dark') ? '#3d2b1f' : '#8b6a4a');
  const lightColor = type === 'chess' ? (document.documentElement.classList.contains('dark') ? '#154b26' : '#cfe8cf') : (document.documentElement.classList.contains('dark') ? '#2a201a' : '#f0e6d2');

  return (
    <div className={`w-full aspect-square rounded-xl overflow-hidden border border-black/10 dark:border-white/10 ${className}`} style={{maxHeight: 520}}>
      <div
        className="grid w-full h-full"
        style={{ gridTemplateColumns: `repeat(${n}, 1fr)`, gridTemplateRows: `repeat(${n}, 1fr)` }}
      >
        {Array.from({ length: n * n }).map((_, i) => {
          const r = Math.floor(i / n);
          const c = i % n;
          const dark = (r + c) % 2 === 1;
          const piece = board ? (board[r] ? board[r][c] : null) : null;
          const isLastFrom = lastMove && lastMove.from && lastMove.from.r === r && lastMove.from.c === c;
          const isLastTo = lastMove && lastMove.to && lastMove.to.r === r && lastMove.to.c === c;
          const renderPiece = () => {
            if (!piece) return null;
            if (type === 'chess') {
              const map = { 'P':'♙','N':'♘','B':'♗','R':'♖','Q':'♕','K':'♔','p':'♟','n':'♞','b':'♝','r':'♜','q':'♛','k':'♚' };
              const sym = map[piece];
              if (!sym) return null;
              const isWhite = typeof piece === 'string' && piece === piece.toUpperCase();
              return <span className={`text-xl md:text-2xl transition-transform duration-300 ease-out will-change-transform ${isLastTo ? 'scale-110' : ''} ${isWhite ? 'text-white drop-shadow' : 'text-black'}`}>{sym}</span>;
            } else {
              // checkers: 1 W man, 2 B man, 3 W king, 4 B king
              const isWhite = piece === 1 || piece === 3;
              const isKing = piece === 3 || piece === 4;
              return (
                <div className={`relative w-5 h-5 md:w-6 md:h-6 transition-transform duration-300 ease-out will-change-transform ${isLastTo ? 'scale-110' : ''}`}>
                  <div className="absolute inset-0 rounded-full" style={{ backgroundColor: isWhite ? '#f5f5f5' : '#2b2b2b', boxShadow: 'inset 0 1px 1px rgba(0,0,0,0.4)' }} />
                  {isKing && <span className="absolute -top-1 -right-1 text-[9px] md:text-[10px]">👑</span>}
                </div>
              );
            }
          };
          return (
            <button
              key={i}
              type="button"
              onClick={onSquareClick ? () => onSquareClick(r, c) : undefined}
              style={{ backgroundColor: dark ? darkColor : lightColor }}
              className={`w-full h-full flex items-center justify-center border border-black/5 dark:border-white/10 mini-board-square relative ${isLastFrom ? 'ring-2 ring-yellow-300' : ''} ${isLastTo ? 'ring-2 ring-yellow-500' : ''}`}
            >
              {isLastTo && (
                <span className="absolute inset-0 bg-yellow-300/20 animate-pulse pointer-events-none" />
              )}
              {renderPiece()}
            </button>
          );
        })}
      </div>
    </div>
  );
}