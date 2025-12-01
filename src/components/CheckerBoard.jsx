import React from 'react';
import CheckerPiece from './CheckerPiece';
import { motion, AnimatePresence } from 'framer-motion';

export default function CheckerBoard({ board, onSquareClick, selectedSquare, validMoves, currentTurn, playerColor, lastMove }) {
    
    const isValidTarget = (r, c) => {
        if (!selectedSquare) return false;
        return validMoves.some(move => move.row === r && move.col === c);
    };

    const isMyTurn = currentTurn === playerColor;

    return (
        <div className="relative select-none w-full h-full flex justify-center items-center">
            {/* Board Frame with coordinate labels */}
            <div className="bg-[#4a3728] p-1 rounded-lg shadow-2xl border-4 border-[#2c1e12] max-h-[85vh] aspect-square w-full max-w-[85vh]">
                
                <div 
                    className="grid gap-0 w-full h-full bg-[#2c1e12] border-2 border-[#5c4430] shadow-inner"
                    style={{ 
                        gridTemplateColumns: 'repeat(10, 1fr)', 
                        gridTemplateRows: 'repeat(10, 1fr)',
                        aspectRatio: '1/1'
                    }}
                >
                    {board.map((row, r) => (
                        row.map((piece, c) => {
                            const isDark = (r + c) % 2 !== 0;
                            const isSelected = selectedSquare && selectedSquare[0] === r && selectedSquare[1] === c;
                            const isTarget = isValidTarget(r, c);
                            
                            // Wood texture colors
                            const squareColor = isDark 
                                ? 'bg-[#5c4430]' // Dark wood
                                : 'bg-[#e8dcc5]'; // Light wood

                            // Check if piece belongs to current player for cursor styling
                            const isMyPiece = piece !== 0 && (
                                (playerColor === 'white' && (piece === 1 || piece === 3)) ||
                                (playerColor === 'black' && (piece === 2 || piece === 4))
                            );

                            return (
                                <div
                                    key={`${r}-${c}`}
                                    onClick={() => onSquareClick(r, c)}
                                    style={{ aspectRatio: '1/1' }}
                                    className={`
                                        relative w-full h-full flex items-center justify-center
                                        ${squareColor}
                                        ${(isTarget && isMyTurn) || (isMyPiece && isMyTurn) ? 'cursor-pointer' : ''}
                                        transition-colors duration-150
                                    `}
                                >
                                    {/* Board Texture Overlay */}
                                    {isDark && (
                                        <div className="absolute inset-0 opacity-10 bg-[url('https://www.transparenttextures.com/patterns/wood-pattern.png')]" />
                                    )}

                                    {/* Coordinates (Only show on edges) */}
                                    {c === 9 && isDark && (
                                        <span className="absolute right-0.5 bottom-0.5 text-[8px] md:text-[10px] text-[#d4c5b0] opacity-50 font-mono">
                                            {r + 1}
                                        </span>
                                    )}
                                    {r === 9 && isDark && (
                                        <span className="absolute left-0.5 bottom-0.5 text-[8px] md:text-[10px] text-[#d4c5b0] opacity-50 font-mono">
                                            {String.fromCharCode(65 + c)}
                                        </span>
                                    )}

                                    {/* Valid Move Indicator */}
                                    {isTarget && isMyTurn && (
                                        <motion.div 
                                            initial={{ scale: 0 }}
                                            animate={{ scale: 1 }}
                                            className="absolute w-[30%] h-[30%] rounded-full bg-green-500 opacity-60 z-20 pointer-events-none shadow-[0_0_5px_#00ff00]" 
                                        />
                                    )}

                                    {/* The Piece */}
                                    <AnimatePresence mode='popLayout'>
                                        {piece !== 0 && (
                                            <CheckerPiece 
                                                key={`piece-${r}-${c}`} 
                                                type={piece} 
                                                isSelected={isSelected} 
                                                animateFrom={
                                                    lastMove && lastMove.to.r === r && lastMove.to.c === c
                                                    ? { x: (lastMove.from.c - c) * 100 + '%', y: (lastMove.from.r - r) * 100 + '%' }
                                                    : null
                                                }
                                            />
                                        )}
                                    </AnimatePresence>
                                </div>
                            );
                        })
                    ))}
                </div>
            </div>
        </div>
    );
}