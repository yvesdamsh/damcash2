import React from 'react';
import CheckerPiece from './CheckerPiece';
import { motion, AnimatePresence } from 'framer-motion';

export default function CheckerBoard({ board, onSquareClick, selectedSquare, validMoves, currentTurn, playerColor, lastMove, theme = 'standard', pieceDesign = 'standard', onDrop }) {
    
    const isValidTarget = (r, c) => {
        if (!selectedSquare) return false;
        return validMoves.some(move => move.from.r === r && move.from.c === c) || 
               validMoves.some(move => move.to.r === r && move.to.c === c); 
        // Note: Original Logic was using validMoves to check target squares for highlighting valid moves.
        // Actually, in CheckerBoard.js context, `validMoves` usually contains full move objects.
        // The `isValidTarget` function implementation was `return validMoves.some(move => move.row === r && move.col === c);`
        // But `move` object structure in `checkersLogic` is `{from: {r,c}, to: {r,c}}`. 
        // So the original code `move.row` likely was wrong or referring to a flattened structure?
        // Let's look at `checkersLogic.getValidMoves` -> returns `{from, to, captured}`.
        // So `isValidTarget` should check `move.to.r` and `move.to.c`.
        // Let's fix this bug while we are here if needed, but primarily handle theme.
    };
    
    // Correction for highlighting targets
    const isMoveTarget = (r, c) => {
        return validMoves.some(m => m.to.r === r && m.to.c === c);
    }

    const isMyTurn = currentTurn === playerColor;

    // Theme Config
    const themes = {
        standard: { dark: 'bg-[#5c4430]', light: 'bg-[#e8dcc5]', border: 'border-[#5c4430]', frame: 'bg-[#4a3728]' },
        classic: { dark: 'bg-black', light: 'bg-[#cc0000]', border: 'border-black', frame: 'bg-[#1a1a1a]' },
        modern: { dark: 'bg-[#2c3e50]', light: 'bg-[#ecf0f1]', border: 'border-[#34495e]', frame: 'bg-[#2c3e50]' },
    };

    const currentTheme = themes[theme] || themes.standard;

    return (
        <div className="relative select-none w-full h-full flex justify-center items-center">
            {/* Board Frame with coordinate labels */}
            <div className={`${currentTheme.frame} md:p-1 md:rounded-lg md:shadow-2xl md:border-4 border-black/30 max-h-full aspect-square w-full md:max-w-[90vh]`}>
                
                <div 
                    className={`grid gap-0 w-full h-full ${currentTheme.light} md:border-2 ${currentTheme.border} shadow-inner`}
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
                            const isTarget = isMoveTarget(r, c);
                            
                            const squareColor = isDark ? currentTheme.dark : currentTheme.light;

                            // Check if piece belongs to current player for cursor styling
                            const isMyPiece = piece !== 0 && (
                                (playerColor === 'white' && (piece === 1 || piece === 3)) ||
                                (playerColor === 'black' && (piece === 2 || piece === 4))
                            );

                            return (
                                <div
                                    key={`${r}-${c}`}
                                    data-row={r}
                                    data-col={c}
                                    onClick={() => onSquareClick(r, c)}
                                    style={{ aspectRatio: '1/1' }}
                                    className={`
                                        relative w-full h-full flex items-center justify-center board-square
                                        ${squareColor}
                                        ${isSelected ? 'ring-4 ring-yellow-400 z-10' : ''}
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
                                                design={pieceDesign}
                                                onDragEnd={(e, info) => {
                                                    if(!onDrop) return;
                                                    const target = document.elementFromPoint(info.point.x, info.point.y);
                                                    const square = target?.closest('.board-square');
                                                    if (square) {
                                                        const tr = parseInt(square.dataset.row);
                                                        const tc = parseInt(square.dataset.col);
                                                        if (!isNaN(tr) && !isNaN(tc) && !(tr === r && tc === c)) {
                                                            onDrop({ r, c }, { r: tr, c: tc });
                                                        }
                                                    }
                                                }}
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