import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, Puzzle, Brain } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { useLanguage } from "@/components/LanguageContext";
import { Link } from "react-router-dom";

export default function DailyPuzzle({ gameType: propGameType }) {
  const { t, formatDate } = useLanguage();
  const [loading, setLoading] = React.useState(true);
  const [puzzle, setPuzzle] = React.useState(null);
  const gameType = propGameType || (typeof window !== 'undefined' ? (localStorage.getItem('gameMode') || 'checkers') : 'checkers');

  React.useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        setLoading(true);
        const list = await base44.entities.Puzzle.filter({ game_type: gameType }, '-updated_date', 1);
        if (mounted) setPuzzle(list?.[0] || null);
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, [gameType]);

  return (
    <Card className="bg-white/85 dark:bg-[#1e1814]/85 border-[#d4c5b0] dark:border-[#3d2b1f] shadow-lg h-full">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-[#4a3728] dark:text-[#e8dcc5]">
          <Puzzle className="w-5 h-5" /> {t('home.daily_puzzle') || 'Daily Puzzle'}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {loading ? (
          <div className="flex items-center gap-2 text-sm text-gray-500">
            <Loader2 className="w-4 h-4 animate-spin" /> {t('common.loading') || 'Loading...'}
          </div>
        ) : puzzle ? (
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Badge variant="secondary" className="bg-[#e8dcc5] text-[#4a3728] dark:bg-[#3d2b1f] dark:text-[#e8dcc5]">
                {puzzle.difficulty || 'medium'}
              </Badge>
              {puzzle.rating ? (
                <span className="text-xs text-gray-600 dark:text-gray-300">ELO {puzzle.rating}</span>
              ) : null}
            </div>
            <div>
              <div className="font-bold text-[#4a3728] dark:text-[#e8dcc5] text-lg line-clamp-1">{puzzle.title || (gameType === 'chess' ? 'Chess Tactics' : 'Checkers Tactics')}</div>
              {puzzle.description && (
                <p className="text-sm text-[#6b5138] dark:text-[#b09a85] line-clamp-3">{puzzle.description}</p>
              )}
            </div>
            <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
              <span>{t('common.updated') || 'Updated'}: {puzzle.updated_date ? formatDate(puzzle.updated_date) : '-'}</span>
            </div>
            <div className="flex gap-2">
              <Link to="/Training" className="flex-1">
                <Button className="w-full bg-[#6B8E4E] hover:bg-[#5a7a40] text-white">
                  <Brain className="w-4 h-4 mr-2" /> {t('home.solve_now') || 'Solve now'}
                </Button>
              </Link>
              <Link to="/Academy">
                <Button variant="outline" className="border-[#d4c5b0] text-[#4a3728] dark:border-[#3d2b1f] dark:text-[#e8dcc5]">
                  {t('home.more_puzzles') || 'More'}
                </Button>
              </Link>
            </div>
          </div>
        ) : (
          <div className="text-sm text-gray-600 dark:text-gray-300">
            {t('home.no_puzzle') || 'No puzzle available today.'}
          </div>
        )}
      </CardContent>
    </Card>
  );
}