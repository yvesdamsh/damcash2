import React from 'react';
import ChessPiece from './ChessPiece';
import { motion } from 'framer-motion';

export default function ChessBoard({ board, onSquareClick, selectedSquare, validMoves, currentTurn, playerColor, lastMove }) {
    
    const isMyTurn = currentTurn === playerColor;

    // Helper to calculate notation
    const getAlgebraic = (r, c) => {
        const files = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
        return `${files[c]}${8-r}`;
    };

    return (
        <div className="relative select-none">
            <div className="bg-[#3d2b1f] p-2 md:p-4 rounded-lg shadow-2xl border-4 border-[#2c1e12]">
                <div className="grid grid-cols-8 gap-0 aspect-square w-full max-w-[600px] mx-auto bg-[#F0E7D5] border-4 border-[#3d2b1f] shadow-inner">
                    {board.map((row, r) => (
                        row.map((piece, c) => {
                            const isDark = (r + c) % 2 !== 0;
                            const isSelected = selectedSquare && selectedSquare[0] === r && selectedSquare[1] === c;
                            const isTarget = validMoves.some(m => m.r === r && m.c === c);
                            const isLastMove = lastMove && (
                                (lastMove.from.r === r && lastMove.from.c === c) || 
                                (lastMove.to.r === r && lastMove.to.c === c)
                            );
                            
                            // Colors from prompt
                            const squareColor = isDark 
                                ? 'bg-[#6B8E4E]' // Green
                                : 'bg-[#F0E7D5]'; // Beige

                            return (
                                <div
                                    key={`${r}-${c}`}
                                    onClick={() => onSquareClick(r, c)}
                                    className={`
                                        relative w-full h-full flex items-center justify-center
                                        ${squareColor}
                                        ${isLastMove ? 'after:absolute after:inset-0 after:bg-yellow-400/30' : ''}
                                        ${isSelected ? 'bg-yellow-200/50 ring-inset ring-4 ring-yellow-400' : ''}
                                        ${isTarget && isMyTurn ? 'cursor-pointer' : ''}
                                    `}
                                >
                                    {/* Coordinates */}
                                    {c === 0 && (
                                        <span className={`absolute left-0.5 top-0 text-[8px] md:text-[10px] font-bold ${isDark ? 'text-[#F0E7D5]' : 'text-[#6B8E4E]'}`}>
                                            {8 - r}
                                        </span>
                                    )}
                                    {r === 7 && (
                                        <span className={`absolute right-0.5 bottom-0 text-[8px] md:text-[10px] font-bold ${isDark ? 'text-[#F0E7D5]' : 'text-[#6B8E4E]'}`}>
                                            {String.fromCharCode(97 + c)}
                                        </span>
                                    )}

                                    {/* Valid Move Indicator */}
                                    {isTarget && isMyTurn && (
                                        <div className={`
                                            absolute z-10 rounded-full pointer-events-none
                                            ${piece ? 'inset-0 border-[6px] border-black/10' : 'w-3 h-3 md:w-4 md:h-4 bg-black/10'}
                                        `} />
                                    )}

                                    {/* The Piece */}
                                    {piece && (
                                        <ChessPiece type={piece} isSelected={isSelected} />
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