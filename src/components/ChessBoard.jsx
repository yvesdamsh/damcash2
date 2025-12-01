import React from 'react';
import ChessPiece from './ChessPiece';
import { motion } from 'framer-motion';

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
        if (!boardRef.current) return;
        const boardRect = boardRef.current.getBoundingClientRect();
        const squareSize = boardRect.width / 8;
        
        // Calculate drop coordinates relative to board
        const dropX = info.point.x - boardRect.left;
        const dropY = info.point.y - boardRect.top;
        
        const targetC = Math.floor(dropX / squareSize);
        const targetR = Math.floor(dropY / squareSize);

        if (targetR >= 0 && targetR < 8 && targetC >= 0 && targetC < 8) {
            if (targetR !== r || targetC !== c) {
                onPieceDrop(r, c, targetR, targetC);
            }
        }
    };

    return (
        <div className="relative select-none w-full h-full flex justify-center items-center" style={{ touchAction: 'none' }}>
            <div className={`${currentTheme.bg} p-0.5 md:p-1 rounded-md md:rounded-lg shadow-xl md:shadow-2xl border-2 md:border-4 border-[#2c1e12] max-h-full aspect-square w-full md:max-w-[90vh]`}>
                <div 
                    ref={boardRef}
                    className={`grid gap-0 w-full h-full ${currentTheme.light} border md:border-2 ${currentTheme.border} shadow-inner rounded-sm md:rounded`}
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
                            
                            // Premove Highlight
                            const isPremoveSource = premove && premove.from.r === r && premove.from.c === c;
                            const isPremoveTarget = premove && premove.to.r === r && premove.to.c === c;

                            const squareColor = isDark ? currentTheme.dark : currentTheme.light;

                            return (
                                <div
                                    key={`${r}-${c}`}
                                    onClick={() => onSquareClick(r, c)}
                                    style={{ aspectRatio: '1/1' }}
                                    className={`
                                        relative w-full h-full flex items-center justify-center
                                        ${squareColor}
                                        ${isLastMove ? 'after:absolute after:inset-0 after:bg-yellow-400/30' : ''}
                                        ${isSelected ? 'bg-yellow-200/50 ring-inset ring-4 ring-yellow-400' : ''}
                                        ${isPremoveSource ? 'bg-red-200/60 ring-inset ring-4 ring-red-400' : ''}
                                        ${isPremoveTarget ? 'bg-red-400/40' : ''}
                                        ${isTarget && isMyTurn ? 'cursor-pointer' : ''}
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