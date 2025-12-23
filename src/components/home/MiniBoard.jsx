import React from "react";

export default function MiniBoard({ type = 'chess', className = '', board = null, onSquareClick }) {
  const n = type === 'chess' ? 8 : 10;
  const isDark = document.documentElement.classList.contains('dark');
  const darkColor = type === 'chess' ? (isDark ? '#0f3d1a' : '#1f4d2e') : (isDark ? '#3d2b1f' : '#8b6a4a');
  const lightColor = type === 'chess' ? (isDark ? '#cfe8cf' : '#eaf5ea') : (isDark ? '#e8dcc5' : '#f5ead7');

  return (
    <div className={`w-full aspect-square rounded-xl shadow-inner overflow-hidden border border-black/20 dark:border-white/20 ${className}`}>
      <div
        className="grid w-full h-full"
        style={{ gridTemplateColumns: `repeat(${n}, 1fr)`, gridTemplateRows: `repeat(${n}, 1fr)` }}
      >
        {Array.from({ length: n * n }).map((_, i) => {
          const r = Math.floor(i / n);
          const c = i % n;
          const dark = (r + c) % 2 === 1;
          const piece = board ? (board[r] ? board[r][c] : null) : null;
          const renderPiece = () => {
            if (!piece) return null;
            if (type === 'chess') {
              const map = { 'P':'♙','N':'♘','B':'♗','R':'♖','Q':'♕','K':'♔','p':'♟','n':'♞','b':'♝','r':'♜','q':'♛','k':'♚' };
              const sym = map[piece];
              if (!sym) return null;
              const isWhite = typeof piece === 'string' && piece === piece.toUpperCase();
              return <span className={`${isWhite ? 'text-white drop-shadow' : 'text-black'}`}>{sym}</span>;
            } else {
              // checkers: 1 W man, 2 B man, 3 W king, 4 B king
              const isWhite = piece === 1 || piece === 3;
              const isKing = piece === 3 || piece === 4;
              return (
                <div className="relative w-[min(2.2vw,22px)] h-[min(2.2vw,22px)] md:w-[min(1.2vw,24px)] md:h-[min(1.2vw,24px)]">
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
              className="w-full h-full flex items-center justify-center text-[min(2.3vw,22px)] md:text-[min(1.2vw,24px)]"
            >
              {renderPiece()}
            </button>
          );
        })}
      </div>
    </div>
  );
}