import { Button } from '@/components/ui/button';
import { SkipBack, ChevronLeft, ChevronRight, SkipForward } from 'lucide-react';

export default function ReplayControls({ 
    moves, 
    currentIndex, 
    onIndexChange 
}) {
    if (!moves || moves.length === 0) return null;

    const total = moves.length;
    const current = currentIndex === -1 ? total : currentIndex + 1;

    return (
        <div className="w-full max-w-md mx-auto bg-[#4a3728] p-1 rounded-lg shadow-inner flex items-center gap-1">
            <Button 
                variant="ghost" 
                size="icon" 
                className="h-8 w-8 text-[#e8dcc5] hover:bg-white/10 hover:text-white" 
                onClick={() => onIndexChange(0)} 
                disabled={currentIndex === 0 || (currentIndex === -1 && total === 0)}
            >
                <SkipBack className="w-4 h-4" />
            </Button>
            <Button 
                variant="ghost" 
                size="icon" 
                className="h-8 w-8 text-[#e8dcc5] hover:bg-white/10 hover:text-white" 
                onClick={() => onIndexChange(prev => prev === -1 ? total - 2 : Math.max(0, prev - 1))} 
                disabled={currentIndex === 0}
            >
                <ChevronLeft className="w-4 h-4" />
            </Button>
            
            <div className="flex-1 mx-2 relative h-8 flex items-center justify-center">
                <div className="absolute inset-0 flex items-center">
                    <div className="w-full h-1 bg-white/20 rounded-full overflow-hidden">
                        <div 
                            className="h-full bg-yellow-500 transition-all duration-200"
                            style={{ width: `${(current / total) * 100}%` }}
                        />
                    </div>
                </div>
                <span className="relative z-10 text-xs font-mono font-bold text-[#e8dcc5] bg-[#4a3728] px-2 rounded">
                    {current} / {total}
                </span>
            </div>

            <Button 
                variant="ghost" 
                size="icon" 
                className="h-8 w-8 text-[#e8dcc5] hover:bg-white/10 hover:text-white" 
                onClick={() => onIndexChange(prev => (prev === -1 || prev >= total - 1) ? -1 : prev + 1)} 
                disabled={currentIndex === -1}
            >
                <ChevronRight className="w-4 h-4" />
            </Button>
            <Button 
                variant="ghost" 
                size="icon" 
                className="h-8 w-8 text-[#e8dcc5] hover:bg-white/10 hover:text-white" 
                onClick={() => onIndexChange(-1)} 
                disabled={currentIndex === -1}
            >
                <SkipForward className="w-4 h-4" />
            </Button>
        </div>
    );
}