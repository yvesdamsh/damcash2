import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, Puzzle, Brain } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { useLanguage } from "@/components/LanguageContext";
import { Link } from "react-router-dom";
import MiniBoard from "@/components/home/MiniBoard";
import PuzzleEditor from "@/components/home/PuzzleEditor";
import DailyCheckersPuzzle from "@/components/puzzle/DailyCheckersPuzzle";

export default function DailyPuzzle({ gameType: propGameType }) {
  const { t, formatDate } = useLanguage();
  const tf = (key, fallback) => (t(key) === key ? fallback : t(key));
  const [loading, setLoading] = React.useState(true);
  const [puzzle, setPuzzle] = React.useState(null);
  const gameType = propGameType || (typeof window !== 'undefined' ? (localStorage.getItem('gameMode') || 'checkers') : 'checkers');

  const tt = (key, fallback) => {
    const v = t(key);
    return v === key ? fallback : v;
  };

  React.useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        setLoading(true);
        const list = await base44.entities.Puzzle.filter({ game_type: gameType, theme: 'daily' }, '-created_date', 1);
        if (mounted) setPuzzle(list?.[0] || null);
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, [gameType]);

  return (
    <Card className="bg-white/90 dark:bg-[#1e1814]/90 border-[#d4c5b0] dark:border-[#3d2b1f] shadow-xl h-full">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-[#4a3728] dark:text-[#e8dcc5]">
          <Puzzle className="w-5 h-5" /> {tf('home.daily_puzzle', 'Puzzle du jour')}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <style>{`.mini-board-square{outline:1px solid rgba(0,0,0,0.08)} .dark .mini-board-square{outline-color:rgba(255,255,255,0.1)}`}</style>
        {loading ? (
          <div className="flex items-center gap-2 text-sm text-gray-500">
            <Loader2 className="w-4 h-4 animate-spin" /> {tf('common.loading', 'Chargement...')}
          </div>
        ) : (
          (() => {
            const now = Date.now();
            const created = puzzle?.created_date ? new Date(puzzle.created_date).getTime() : 0;
            const valid = puzzle && (now - created <= 24*60*60*1000);

            // Parse board for display
            let board = null;
            if (valid && puzzle?.board_state) {
              try {
                const parsed = JSON.parse(puzzle.board_state);
                board = gameType === 'chess' ? (parsed?.board || null) : (Array.isArray(parsed) ? parsed : null);
              } catch (_) {}
            }

            return valid ? (
              gameType === 'checkers' ? (
                <DailyCheckersPuzzle puzzle={puzzle} board={board} />
              ) : (
              <div className="space-y-3">
                <MiniBoard type={gameType} board={board} className="w-full max-w-[420px] mx-auto ring-1 ring-[#4a3728]/15" />
                <div className="flex items-center gap-2">
                  <Badge variant="secondary" className="bg-[#e8dcc5] text-[#4a3728] dark:bg-[#3d2b1f] dark:text-[#e8dcc5]">
                    {puzzle.difficulty || 'medium'}
                  </Badge>
                  {puzzle.rating ? (
                    <span className="text-xs text-gray-600 dark:text-gray-300">ELO {puzzle.rating}</span>
                  ) : null}
                </div>
                <div>
                  <div className="font-bold text-[#4a3728] dark:text-[#e8dcc5] text-lg line-clamp-1">{puzzle.title || (gameType === 'chess' ? 'Tactique d’échecs' : 'Tactique de dames')}</div>
                  {puzzle.description && (
                    <p className="text-sm text-[#6b5138] dark:text-[#b09a85] line-clamp-3">{puzzle.description}</p>
                  )}
                </div>
                <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
                  <span>{tf('common.updated', 'Mise à jour')} : {puzzle.updated_date ? formatDate(puzzle.updated_date) : '-'}</span>
                  <span>{tf('home.expires_in', 'Expire dans')} ~{Math.max(0, Math.ceil((24*60*60*1000 - (now - created)) / (60*60*1000)))}h</span>
                </div>
                <div className="flex gap-2">
                  <Link to="/Training" className="flex-1">
                    <Button className="w-full bg-[#6B8E4E] hover:bg-[#5a7a40] text-white">
                      <Brain className="w-4 h-4 mr-2" /> {tf('home.solve_now', 'Résoudre maintenant')}
                    </Button>
                  </Link>
                </div>
              </div>
              )
            ) : (
              <PuzzleEditor gameType={gameType} onSaved={(p) => setPuzzle(p)} />
            );
          })()
        )}
      </CardContent>
    </Card>
  );
}