import React, { useEffect, useRef } from 'react';
import { useLanguage } from '@/components/LanguageContext';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { Play, Pause, SkipBack, SkipForward, ChevronLeft, ChevronRight } from 'lucide-react';

export default function MoveHistory({ moves, currentIndex, onSelectMove, gameType, isPlaying }) {
    const { t } = useLanguage();
    const scrollRef = useRef(null);

    useEffect(() => {
        if (scrollRef.current) {
            // Simple auto-scroll to bottom/current
            const activeEl = scrollRef.current.querySelector('[data-active="true"]');
            if (activeEl) activeEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
    }, [currentIndex]);

    const formatMove = (move, index) => {
        // Use pre-calculated notation if available
        if (move.notation) return move.notation;

        if (gameType === 'chess') {
            const files = ['a','b','c','d','e','f','g','h'];
            const from = `${files[move.from.c]}${8-move.from.r}`;
            const to = `${files[move.to.c]}${8-move.to.r}`;
            return `${move.piece || ''} ${from}-${to}`;
        } else {
            // Fallback Checkers notation (1-50)
            const getNum = (r, c) => r * 5 + Math.floor(c / 2) + 1;
            const separator = move.captured ? 'x' : '-';
            return `${getNum(move.from.r, move.from.c)}${separator}${getNum(move.to.r, move.to.c)}`;
        }
    };

    // Group into pairs for white/black
    const rows = [];
    for (let i = 0; i < moves.length; i += 2) {
        rows.push({
            index: i / 2 + 1,
            white: { move: moves[i], idx: i },
            black: moves[i+1] ? { move: moves[i+1], idx: i+1 } : null
        });
    }

    return (
        <div className="flex flex-col h-full bg-white rounded-lg shadow-sm border border-[#d4c5b0]">
            <div className="p-2 bg-[#f5f0e6] border-b border-[#d4c5b0] text-xs font-bold text-[#6b5138] uppercase tracking-wider text-center">
                {t('game.move_history_title')}
            </div>
            <ScrollArea className="flex-1 p-2" ref={scrollRef}>
                <div className="space-y-1">
                    {rows.map((row) => (
                        <div key={row.index} className="flex text-sm">
                            <div className="w-8 text-[#a3907c] font-mono text-xs py-1">{row.index}.</div>
                            <button 
                                onClick={() => onSelectMove(row.white.idx)}
                                data-active={currentIndex === row.white.idx}
                                className={cn(
                                    "flex-1 text-left px-2 py-1 rounded transition-colors hover:bg-[#e8dcc5]",
                                    currentIndex === row.white.idx ? "bg-[#6b5138] text-white font-bold" : "text-[#4a3728]"
                                )}
                            >
                                {formatMove(row.white.move, row.white.idx)}
                            </button>
                            {row.black && (
                                <button 
                                    onClick={() => onSelectMove(row.black.idx)}
                                    data-active={currentIndex === row.black.idx}
                                    className={cn(
                                        "flex-1 text-left px-2 py-1 rounded transition-colors hover:bg-[#e8dcc5]",
                                        currentIndex === row.black.idx ? "bg-[#6b5138] text-white font-bold" : "text-[#4a3728]"
                                    )}
                                >
                                    {formatMove(row.black.move, row.black.idx)}
                                </button>
                            )}
                        </div>
                    ))}
                </div>
            </ScrollArea>
        </div>
    );
}