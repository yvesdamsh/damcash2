import React, { memo, useRef, useMemo } from 'react';
import ChessPiece from './ChessPiece';
import { AnimatePresence } from 'framer-motion';
import { isInCheck } from '@/components/chessLogic';

const ChessSquare = memo(({ 
    r, c, piece, isDark, isSelected, isTarget, isLastMove, isLastMoveTarget, isPremoveSource, isPremoveTarget, isCheck,
    theme, canInteract, onSquareClick, onPieceDrop, pieceSet, currentTurn, animDelta, isFlipped, boardRef
}) => {

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

    const squareColor = isCheck 
        ? 'bg-red-500/90' 
        : (isDark ? theme.dark : theme.light);

    return (
        <div
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
                ${isCheck ? 'ring-inset ring-4 ring-red-600 shadow-[0_0_20px_rgba(220,38,38,0.6)] z-30 animate-pulse' : ''}
                ${isTarget && canInteract ? 'cursor-pointer' : ''}
                ${isLastMoveTarget ? 'z-30' : (piece ? 'z-20' : 'z-auto')}
            `}
        >
            {(!isFlipped ? c === 0 : c === 7) && (
                <span className={`absolute left-0.5 top-0 text-[8px] md:text-[10px] font-bold ${isDark ? theme.textDark : theme.textLight}`}>
                    {8 - r}
                </span>
            )}
            {(!isFlipped ? r === 7 : r === 0) && (
                <span className={`absolute right-0.5 bottom-0 text-[8px] md:text-[10px] font-bold ${isDark ? theme.textDark : theme.textLight}`}>
                    {String.fromCharCode(97 + c)}
                </span>
            )}

            {isTarget && canInteract && (
                <div className={`
                    absolute z-10 rounded-full pointer-events-none
                    ${piece ? 'inset-0 border-[4px] md:border-[6px] border-black/20' : 'w-4 h-4 md:w-6 md:h-6 bg-black/20'}
                `} />
            )}

            <AnimatePresence mode='popLayout'>
                {piece && (
                    <ChessPiece 
                        key={`piece-${r}-${c}`}
                        type={piece} 
                        isSelected={isSelected}
                        set={pieceSet}
                        onDragEnd={handleDragEnd}
                        dragConstraints={boardRef}
                        canDrag={canInteract && (
                            (currentTurn === 'white' && piece === piece.toUpperCase()) ||
                            (currentTurn === 'black' && piece === piece.toLowerCase())
                        )}
                        animateFrom={animDelta}
                    />
                )}
            </AnimatePresence>
        </div>
    );
}, (prev, next) => {
    return prev.piece === next.piece &&
           prev.isSelected === next.isSelected &&
           prev.isTarget === next.isTarget &&
           prev.isLastMove === next.isLastMove &&
           prev.isLastMoveTarget === next.isLastMoveTarget &&
           prev.isPremoveSource === next.isPremoveSource &&
           prev.isPremoveTarget === next.isPremoveTarget &&
           prev.isCheck === next.isCheck &&
           prev.canInteract === next.canInteract &&
           prev.currentTurn === next.currentTurn &&
           prev.theme === next.theme &&
           prev.animDelta === next.animDelta &&
           prev.isFlipped === next.isFlipped;
});

const ChessBoard = ({ board, onSquareClick, onPieceDrop, selectedSquare, validMoves, currentTurn, playerColor, lastMove, theme = 'standard', pieceSet = 'standard', premove, isSoloMode = false, orientation = 'white' }) => {
    
    const canInteract = isSoloMode || (currentTurn === playerColor);
    const boardRef = useRef(null);
    const boardOrientation = orientation || (playerColor === 'black' ? 'black' : 'white');
    const isFlipped = boardOrientation === 'black';

    // Target Map for O(1) lookup
    const targetMap = useMemo(() => {
        const map = new Set();
        validMoves.forEach(m => map.add(`${m.to.r},${m.to.c}`));
        return map;
    }, [validMoves]);

    const themes = {
        standard: { dark: 'bg-[#6B8E4E]', light: 'bg-[#F0E7D5]', border: 'border-[#3d2b1f]', bg: 'bg-[#3d2b1f]', textDark: 'text-[#F0E7D5]', textLight: 'text-[#6B8E4E]' },
        wood: { dark: 'bg-[#B58863]', light: 'bg-[#F0D9B5]', border: 'border-[#5c4430]', bg: 'bg-[#5c4430]', textDark: 'text-[#F0D9B5]', textLight: 'text-[#B58863]' },
        blue: { dark: 'bg-[#5D8AA8]', light: 'bg-[#DEE3E6]', border: 'border-[#2F4F4F]', bg: 'bg-[#2F4F4F]', textDark: 'text-[#DEE3E6]', textLight: 'text-[#5D8AA8]' },
    };

    const currentTheme = themes[theme] || themes.standard;

    const { isWhiteCheck, isBlackCheck } = useMemo(() => {
        if (!board || board.length !== 8) return { isWhiteCheck: false, isBlackCheck: false };
        return {
            isWhiteCheck: isInCheck(board, 'white'),
            isBlackCheck: isInCheck(board, 'black')
        };
    }, [board]);

    const rows = isFlipped ? [7,6,5,4,3,2,1,0] : [0,1,2,3,4,5,6,7];
    const cols = isFlipped ? [7,6,5,4,3,2,1,0] : [0,1,2,3,4,5,6,7];

    return (
        <div 
            className="relative select-none w-full h-full flex justify-center items-center" 
            style={{ touchAction: 'none', WebkitUserSelect: 'none', userSelect: 'none' }}
            onContextMenu={(e) => e.preventDefault()}
        >
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
                    {rows.map((r) => (
                        cols.map((c) => {
                            const piece = board[r]?.[c];
                            const isDark = (r + c) % 2 !== 0;
                            const isSelected = selectedSquare && selectedSquare[0] === r && selectedSquare[1] === c;
                            const isTarget = targetMap.has(`${r},${c}`);
                            
                            const isLastMove = lastMove && (
                                (lastMove.from.r === r && lastMove.from.c === c) || 
                                (lastMove.to.r === r && lastMove.to.c === c)
                            );
                            const isLastMoveTarget = lastMove && lastMove.to.r === r && lastMove.to.c === c;
                            
                            const isPremoveSource = premove && premove.from.r === r && premove.from.c === c;
                            const isPremoveTarget = premove && premove.to.r === r && premove.to.c === c;

                            const isKing = piece && piece.toLowerCase() === 'k';
                            const isCheck = isKing && ((piece === 'K' && isWhiteCheck) || (piece === 'k' && isBlackCheck));

                            let animDelta = null;
                            if (lastMove && lastMove.to.r === r && lastMove.to.c === c) {
                                const dx = (lastMove.from.c - c);
                                const dy = (lastMove.from.r - r);
                                animDelta = {
                                    x: (isFlipped ? -dx : dx) * 100 + '%',
                                    y: (isFlipped ? -dy : dy) * 100 + '%'
                                };
                            }

                            return (
                                <ChessSquare
                                    key={`${r}-${c}`}
                                    r={r}
                                    c={c}
                                    piece={piece}
                                    isDark={isDark}
                                    isSelected={isSelected}
                                    isTarget={isTarget}
                                    isLastMove={isLastMove}
                                    isLastMoveTarget={isLastMoveTarget}
                                    isPremoveSource={isPremoveSource}
                                    isPremoveTarget={isPremoveTarget}
                                    isCheck={isCheck}
                                    theme={currentTheme}
                                    canInteract={canInteract}
                                    onSquareClick={onSquareClick}
                                    onPieceDrop={onPieceDrop}
                                    pieceSet={pieceSet}
                                    currentTurn={currentTurn}
                                    animDelta={animDelta}
                                    isFlipped={isFlipped}
                                    boardRef={boardRef}
                                />
                            );
                        })
                    ))}
                </div>
            </div>
        </div>
    );
};

export default memo(ChessBoard);