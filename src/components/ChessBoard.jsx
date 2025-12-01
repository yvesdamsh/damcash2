import React from 'react';
import ChessPiece from './ChessPiece';
import { motion } from 'framer-motion';
import { getValidChessMoves } from '@/components/chessLogic';

export default function ChessBoard({ board, onSquareClick, onPieceDrop, selectedSquare, validMoves, currentTurn, playerColor, lastMove, theme = 'standard', pieceSet = 'standard', premove }) {
    
    const isMyTurn = currentTurn === playerColor;
    const boardRef = React.useRef(null);

    // Theme Configuration
    const themes = {
        standard: { dark: 'bg-[#6B8E4E]', light: 'bg-[#F0E7D5]', border: 'border-[#3d2b1f]', bg: 'bg-[#3d2b1f]', textDark: 'text-[#F0E7D5]', textLight: 'text-[#6B8E4E]' },
        wood: { dark: 'bg-[#B58863]', light: 'bg-[#F0D9B5]', border: 'border-[#5c4430]', bg: 'bg-[#5c4430]', textDark: 'text-[#F0D9B5]', textLight: 'text-[#B58863]' },
        blue: { dark: 'bg-[#5D8AA8]', light: 'bg-[#DEE3E6]', border: 'border-[#2F4F4F]', bg: 'bg-[#2F4F4F]', textDark: 'text-[#DEE3E6]', textLight: 'text-[#5D8AA8]' },
    };

    const currentTheme = themes[theme] || themes.standard;

    const handleDragEnd = (e, info, r, c) => {
        // Robust coordinate extraction for Mobile/Desktop
        const clientX = info.point.x || (e.changedTouches && e.changedTouches[0] ? e.changedTouches[0].clientX : 0);
        const clientY = info.point.y || (e.changedTouches && e.changedTouches[0] ? e.changedTouches[0].clientY : 0);

        // Use elementsFromPoint to find the square under the finger directly
        const elements = document.elementsFromPoint(clientX, clientY);
        const targetSquare = elements.find(el => el.classList.contains('board-square'));

        if (targetSquare) {
            const targetR = parseInt(targetSquare.dataset.r);
            const targetC = parseInt(targetSquare.dataset.c);

            if (!isNaN(targetR) && !isNaN(targetC)) {
                if (targetR !== r || targetC !== c) {
                    // Calculate valid moves locally
                    // Note: Chess logic requires castling rights and last move. 
                    // We might not have them perfectly in sync here without prop drilling more state,
                    // but we can fallback to basic validation or trust the drop.
                    // Actually, let's trust the drop event filtering done by Game.js, 
                    // BUT to prevent the snap-back glitch we need to know if it's valid here?
                    // In CheckerBoard we checked validity to hide the piece.
                    
                    // For Chess, fetching exact valid moves locally is harder because we need castlingRights etc.
                    // Let's assume validMoves prop is up to date enough or just hide the piece optimistically if it's a different square.
                    // Or better: check against validMoves prop.
                    
                    const isValidMove = validMoves.some(m => 
                        m.from.r === r && m.from.c === c && 
                        m.to.r === targetR && m.to.c === targetC
                    );

                    // Snap-back prevention removed to avoid visibility issues

                    onPieceDrop(r, c, targetR, targetC);
                }
            }
        }
    };

    return (
        <div className="relative select-none w-full h-full flex justify-center items-center" style={{ touchAction: 'none', WebkitUserSelect: 'none', userSelect: 'none' }}>
            <div className={`${currentTheme.bg} p-0 md:p-1 rounded-none md:rounded-lg shadow-none md:shadow-2xl border-0 md:border-4 border-[#2c1e12] max-h-full aspect-square w-full md:max-w-[90vh]`}>
                <div 
                    ref={boardRef}
                    className={`grid gap-0 w-full h-full ${currentTheme.light} border-0 md:border-2 ${currentTheme.border} shadow-inner rounded-none md:rounded`}
                    style={{ 
                        gridTemplateColumns: 'repeat(8, 1fr)', 
                        gridTemplateRows: 'repeat(8, 1fr)',
                        aspectRatio: '1/1'
                    }}
                >
                    {board.map((row, r) => (
                    row.map((piece, c) => {
                        const isDark = (r + c) % 2 !== 0;
                        const isSelected = selectedSquare && selectedSquare[0] === r && selectedSquare[1] === c;
                        const isTarget = validMoves.some(m => m.to.r === r && m.to.c === c);
                        const isLastMove = lastMove && (
                            (lastMove.from.r === r && lastMove.from.c === c) || 
                            (lastMove.to.r === r && lastMove.to.c === c)
                        );
                        
                        const isLastMoveTarget = lastMove && lastMove.to.r === r && lastMove.to.c === c;
                            
                            // Premove Highlight
                            const isPremoveSource = premove && premove.from.r === r && premove.from.c === c;
                            const isPremoveTarget = premove && premove.to.r === r && premove.to.c === c;

                            const squareColor = isDark ? currentTheme.dark : currentTheme.light;

                            return (
                                <div
                                    key={`${r}-${c}`}
                                    data-r={r}
                                    data-c={c}
                                    onClick={() => onSquareClick(r, c)}
                                    style={{ aspectRatio: '1/1' }}
                                    className={`
                                        board-square
                                        relative w-full h-full flex items-center justify-center
                                        ${squareColor}
                                        ${isLastMove ? 'after:absolute after:inset-0 after:bg-yellow-400/30' : ''}
                                        ${isSelected ? 'bg-yellow-200/50 ring-inset ring-4 ring-yellow-400' : ''}
                                        ${isPremoveSource ? 'bg-red-200/60 ring-inset ring-4 ring-red-400' : ''}
                                        ${isPremoveTarget ? 'bg-red-400/40' : ''}
                                        ${isTarget && isMyTurn ? 'cursor-pointer' : ''}
                                        ${isLastMoveTarget ? 'z-30' : (piece ? 'z-20' : 'z-auto')}
                                    `}
                                >
                                    {/* Coordinates */}
                                    {c === 0 && (
                                        <span className={`absolute left-0.5 top-0 text-[8px] md:text-[10px] font-bold ${isDark ? currentTheme.textDark : currentTheme.textLight}`}>
                                            {8 - r}
                                        </span>
                                    )}
                                    {r === 7 && (
                                        <span className={`absolute right-0.5 bottom-0 text-[8px] md:text-[10px] font-bold ${isDark ? currentTheme.textDark : currentTheme.textLight}`}>
                                            {String.fromCharCode(97 + c)}
                                        </span>
                                    )}

                                    {/* Valid Move Indicator */}
                                    {isTarget && isMyTurn && (
                                        <div className={`
                                            absolute z-10 rounded-full pointer-events-none
                                            ${piece ? 'inset-0 border-[4px] md:border-[6px] border-black/20' : 'w-4 h-4 md:w-6 md:h-6 bg-black/20'}
                                        `} />
                                    )}

                                    {/* The Piece */}
                                    {piece && (
                                        <ChessPiece 
                                            type={piece} 
                                            isSelected={isSelected}
                                            set={pieceSet}
                                            onDragEnd={(e, info) => handleDragEnd(e, info, r, c)}
                                            onDragStart={() => onSquareClick(r, c)}
                                            dragConstraints={boardRef}
                                            animateFrom={
                                                lastMove && lastMove.to.r === r && lastMove.to.c === c
                                                ? { x: (lastMove.from.c - c) * 100 + '%', y: (lastMove.from.r - r) * 100 + '%' }
                                                : null
                                            }
                                        />
                                    )}
                                </div>
                            );
                        })
                    ))}
                </div>
            </div>
        </div>
    );
}