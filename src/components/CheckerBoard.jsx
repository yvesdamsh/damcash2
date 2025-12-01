import React from 'react';
import CheckerPiece from './CheckerPiece';
import { motion, AnimatePresence } from 'framer-motion';

export default function CheckerBoard({ board, onSquareClick, onPieceDrop, selectedSquare, validMoves, currentTurn, playerColor, lastMove, theme = 'standard', pieceDesign = 'standard', premove }) {
    
    const isMoveTarget = (r, c) => {
        return validMoves.some(m => m.to.r === r && m.to.c === c);
    }

    const isMyTurn = currentTurn === playerColor;
    const boardRef = React.useRef(null);

    const handleDragEnd = (e, info, r, c) => {
        if (!boardRef.current) return;
        const boardRect = boardRef.current.getBoundingClientRect();
        const squareSize = boardRect.width / 10;
        
        const dropX = info.point.x - boardRect.left;
        const dropY = info.point.y - boardRect.top;
        
        const targetC = Math.floor(dropX / squareSize);
        const targetR = Math.floor(dropY / squareSize);

        if (targetR >= 0 && targetR < 10 && targetC >= 0 && targetC < 10) {
            if (targetR !== r || targetC !== c) {
                if (onPieceDrop) onPieceDrop(r, c, targetR, targetC);
            }
        }
    };

    const themes = {
        standard: { dark: 'bg-[#5c4430]', light: 'bg-[#e8dcc5]', border: 'border-[#5c4430]', frame: 'bg-[#4a3728]' },
        classic: { dark: 'bg-black', light: 'bg-[#cc0000]', border: 'border-black', frame: 'bg-[#1a1a1a]' },
        modern: { dark: 'bg-[#2c3e50]', light: 'bg-[#ecf0f1]', border: 'border-[#34495e]', frame: 'bg-[#2c3e50]' },
    };

    const currentTheme = themes[theme] || themes.standard;

    return (
        <div className="relative select-none w-full h-full flex justify-center items-center" style={{ touchAction: 'none' }}>
            <div className={`${currentTheme.frame} p-0.5 md:p-1 rounded-md md:rounded-lg shadow-xl md:shadow-2xl border-2 md:border-4 border-black/30 max-h-full aspect-square w-full md:max-w-[90vh]`}>
                <div 
                    ref={boardRef}
                    className={`grid gap-0 w-full h-full ${currentTheme.light} border md:border-2 ${currentTheme.border} shadow-inner rounded-sm md:rounded`}
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

                            const isMyPiece = piece !== 0 && (
                                (playerColor === 'white' && (piece === 1 || piece === 3)) ||
                                (playerColor === 'black' && (piece === 2 || piece === 4))
                            );

                            // Premove Highlight
                            const isPremoveSource = premove && premove.from.r === r && premove.from.c === c;
                            const isPremoveTarget = premove && premove.to.r === r && premove.to.c === c;

                            return (
                                <div
                                    key={`${r}-${c}`}
                                    onClick={() => onSquareClick(r, c)}
                                    style={{ aspectRatio: '1/1' }}
                                    className={`
                                        relative w-full h-full flex items-center justify-center
                                        ${squareColor}
                                        ${isSelected ? 'ring-4 ring-yellow-400 z-10' : ''}
                                        ${isPremoveSource ? 'bg-red-200/60 ring-inset ring-4 ring-red-400' : ''}
                                        ${isPremoveTarget ? 'bg-red-400/40' : ''}
                                        ${(isTarget && isMyTurn) || (isMyPiece && isMyTurn) ? 'cursor-pointer' : ''}
                                        transition-colors duration-150
                                    `}
                                >
                                    {isDark && (
                                        <div className="absolute inset-0 opacity-10 bg-[url('https://www.transparenttextures.com/patterns/wood-pattern.png')]" />
                                    )}

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

                                    {isTarget && isMyTurn && (
                                        <motion.div 
                                            initial={{ scale: 0 }}
                                            animate={{ scale: 1 }}
                                            className="absolute w-4 h-4 md:w-6 md:h-6 rounded-full bg-green-500 opacity-60 z-20 pointer-events-none shadow-[0_0_5px_#00ff00]" 
                                        />
                                    )}

                                    <AnimatePresence mode='popLayout'>
                                        {piece !== 0 && (
                                            <CheckerPiece 
                                                key={`piece-${r}-${c}`} 
                                                type={piece} 
                                                isSelected={isSelected} 
                                                design={pieceDesign}
                                                onDragEnd={(e, info) => handleDragEnd(e, info, r, c)}
                                                onDragStart={() => onSquareClick(r, c)}
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