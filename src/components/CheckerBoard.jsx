import React, { memo, useRef, useMemo } from 'react';
import CheckerPiece from './CheckerPiece';
import { AnimatePresence, motion } from 'framer-motion';
import { getValidMoves as getCheckersMoves } from '@/components/checkersLogic';

// Sub-component memoized for performance
const CheckerSquare = memo(({ 
    r, c, piece, isDark, isSelected, isTarget, isPremoveSource, isPremoveTarget, 
    theme, canInteract, onSquareClick, isTurnPiece, pieceDesign, animDelta, onPieceDrop 
}) => {
    
    // Framer Motion Drag Handler
    const handleDragEnd = (e, info) => {
        let clientX, clientY;
        if (e.changedTouches && e.changedTouches.length > 0) {
            clientX = e.changedTouches[0].clientX;
            clientY = e.changedTouches[0].clientY;
        } else if (e.clientX !== undefined) {
            clientX = e.clientX;
            clientY = e.clientY;
        } else {
            clientX = info.point.x;
            clientY = info.point.y;
        }

        const elements = document.elementsFromPoint(clientX, clientY);
        const targetSquare = elements.find(el => el.classList.contains('board-square'));

        if (targetSquare) {
            const targetR = parseInt(targetSquare.dataset.r);
            const targetC = parseInt(targetSquare.dataset.c);

            if (!isNaN(targetR) && !isNaN(targetC) && (targetR !== r || targetC !== c)) {
                if (onPieceDrop) onPieceDrop(r, c, targetR, targetC);
            }
        }
    };

    const squareColor = isDark ? theme.dark : theme.light;

    return (
        <div
            data-r={r}
            data-c={c}
            onClick={piece === 0 ? () => onSquareClick(r, c) : undefined}
            style={{ aspectRatio: '1/1' }}
            className={`
                board-square
                relative w-full h-full flex items-center justify-center
                ${squareColor}
                ${isSelected ? 'ring-4 ring-yellow-400 z-10' : ''}
                ${isPremoveSource ? 'bg-red-200/60 ring-inset ring-4 ring-red-400' : ''}
                ${isPremoveTarget ? 'bg-red-400/40' : ''}
                ${(isTarget && canInteract) || (isTurnPiece && canInteract) ? 'cursor-pointer' : ''}
                transition-colors duration-150
            `}
        >
            {isDark && (
                <div className="absolute inset-0 opacity-10 bg-[url('https://www.transparenttextures.com/patterns/wood-pattern.png')]" />
            )}

            {isDark && (
                <span className="absolute left-0.5 top-0.5 text-[8px] md:text-[10px] text-[#d4c5b0] opacity-60 font-mono">
                    {r * 5 + Math.floor(c / 2) + 1}
                </span>
            )}

            {isTarget && canInteract && (
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
                        onPieceClick={() => onSquareClick(r, c)}
                        onDragEnd={handleDragEnd}
                        canDrag={canInteract && isTurnPiece}
                        animateFrom={animDelta}
                    />
                )}
            </AnimatePresence>
        </div>
    );
}, (prev, next) => {
    // Custom comparison for performance
    return prev.piece === next.piece &&
           prev.isSelected === next.isSelected &&
           prev.isTarget === next.isTarget &&
           prev.isPremoveSource === next.isPremoveSource &&
           prev.isPremoveTarget === next.isPremoveTarget &&
           prev.canInteract === next.canInteract &&
           prev.isTurnPiece === next.isTurnPiece &&
           prev.theme === next.theme &&
           prev.pieceDesign === next.pieceDesign &&
           prev.animDelta === next.animDelta;
});

const CheckerBoard = ({ board, onSquareClick, onPieceDrop, selectedSquare, validMoves, currentTurn, playerColor, lastMove, lastDragMove, theme = 'standard', pieceDesign = 'standard', premove, isSoloMode = false, orientation = 'white' }) => {
    
    const boardRef = useRef(null);
    const isFlipped = orientation === 'black';
    const canInteract = isSoloMode || (currentTurn === playerColor);

    // Memoize move targets for fast lookup
    const targetMap = useMemo(() => {
        const map = new Set();
        validMoves.forEach(m => map.add(`${m.to.r},${m.to.c}`));
        return map;
    }, [validMoves]);

    const themes = {
        standard: { dark: 'bg-[#5c4430]', light: 'bg-[#e8dcc5]', border: 'border-[#5c4430]', frame: 'bg-[#4a3728]' },
        classic: { dark: 'bg-black', light: 'bg-[#cc0000]', border: 'border-black', frame: 'bg-[#1a1a1a]' },
        modern: { dark: 'bg-[#2c3e50]', light: 'bg-[#ecf0f1]', border: 'border-[#34495e]', frame: 'bg-[#2c3e50]' },
    };

    const currentTheme = themes[theme] || themes.standard;
    const rows = isFlipped ? [9,8,7,6,5,4,3,2,1,0] : [0,1,2,3,4,5,6,7,8,9];
    const cols = isFlipped ? [9,8,7,6,5,4,3,2,1,0] : [0,1,2,3,4,5,6,7,8,9];

    return (
        <div 
            className="relative select-none w-full h-full flex justify-center items-center" 
            style={{ touchAction: 'none', WebkitUserSelect: 'none', userSelect: 'none' }}
            onContextMenu={(e) => e.preventDefault()}
        >
            <div className={`${currentTheme.frame} p-0 md:p-1 rounded-none md:rounded-lg shadow-none md:shadow-2xl border-0 md:border-4 border-black/30 max-h-full aspect-square w-full md:max-w-[90vh]`}>
                <div 
                    ref={boardRef}
                    className={`grid gap-0 w-full h-full ${currentTheme.light} border-0 md:border-2 ${currentTheme.border} shadow-inner rounded-none md:rounded`}
                    style={{ 
                        gridTemplateColumns: 'repeat(10, 1fr)', 
                        gridTemplateRows: 'repeat(10, 1fr)',
                        aspectRatio: '1/1'
                    }}
                >
                    {rows.map((r) => (
                        cols.map((c) => {
                            const piece = board[r]?.[c];
                            const isDark = (r + c) % 2 !== 0;
                            const isSelected = selectedSquare && selectedSquare[0] === r && selectedSquare[1] === c;
                            const isTarget = targetMap.has(`${r},${c}`);

                            const isTurnPiece = piece !== 0 && (
                                (currentTurn === 'white' && (piece === 1 || piece === 3)) ||
                                (currentTurn === 'black' && (piece === 2 || piece === 4))
                            );

                            const isPremoveSource = premove && premove.from.r === r && premove.from.c === c;
                            const isPremoveTarget = premove && premove.to.r === r && premove.to.c === c;

                            let animDelta = null;
                            const isDragMove = lastDragMove && lastMove && 
                                               lastDragMove.from.r === lastMove.from.r && 
                                               lastDragMove.from.c === lastMove.from.c &&
                                               lastDragMove.to.r === lastMove.to.r &&
                                               lastDragMove.to.c === lastMove.to.c;

                            if (!isDragMove && lastMove && lastMove.to.r === r && lastMove.to.c === c) {
                                const dx = (lastMove.from.c - c);
                                const dy = (lastMove.from.r - r);
                                animDelta = {
                                    x: (isFlipped ? -dx : dx) * 100 + '%',
                                    y: (isFlipped ? -dy : dy) * 100 + '%'
                                };
                            }

                            return (
                                <CheckerSquare
                                    key={`${r}-${c}`}
                                    r={r}
                                    c={c}
                                    piece={piece}
                                    isDark={isDark}
                                    isSelected={isSelected}
                                    isTarget={isTarget}
                                    isPremoveSource={isPremoveSource}
                                    isPremoveTarget={isPremoveTarget}
                                    theme={currentTheme}
                                    canInteract={canInteract}
                                    onSquareClick={onSquareClick}
                                    isTurnPiece={isTurnPiece}
                                    pieceDesign={pieceDesign}
                                    animDelta={animDelta}
                                    onPieceDrop={onPieceDrop}
                                />
                            );
                        })
                    ))}
                </div>
            </div>
        </div>
    );
};

export default memo(CheckerBoard);