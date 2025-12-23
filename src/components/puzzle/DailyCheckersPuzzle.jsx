import React from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import DraughtsBoard from "@/components/puzzle/DraughtsBoard";
import { useLanguage } from "@/components/LanguageContext";
import { Brain, Eye } from "lucide-react";
import { Link } from "react-router-dom";

export default function DailyCheckersPuzzle({ puzzle, board }) {
  const { t, formatDate } = useLanguage();
  const tf = (k, f) => (t(k) === k ? f : t(k));
  const created = puzzle?.created_date ? new Date(puzzle.created_date) : null;

  const noPuzzle = !puzzle;
  return (
    <div className="flex flex-col lg:flex-row gap-6">
      <div className="flex items-center justify-center flex-1 min-w-[260px]">
        <DraughtsBoard board={board} />
      </div>
      <aside className="w-full lg:w-[320px] bg-white/80 dark:bg-[#2a201a] border rounded-xl p-4 h-fit border-[#e8dcc5] dark:border-[#3d2b1f]">
        <div className="flex items-start justify-between mb-3">
          <div>
            <div className="text-xs text-gray-500 dark:text-gray-400">{tf('puzzle.daily','Puzzle du jour')}</div>
            <h3 className="text-lg font-bold text-[#4a3728] dark:text-[#e8dcc5] line-clamp-2">{puzzle?.title || tf('puzzle.checkers_title','Tactique de dames')}</h3>
            {noPuzzle && (
              <div className="mt-1 text-xs text-gray-500">{tf('puzzle.none','Aucun puzzle publié aujourd\'hui')}</div>
            )}
          </div>
          <Badge variant="secondary" className="bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200">{puzzle?.difficulty || 'medium'}</Badge>
        </div>

        {puzzle?.rating && (
          <div className="text-xs text-gray-600 dark:text-gray-300 mb-2">ELO {puzzle.rating}</div>
        )}

        {puzzle?.description && (
          <p className="text-sm text-[#6b5138] dark:text-[#b09a85] mb-4 line-clamp-4">{puzzle.description}</p>
        )}

        <div className="rounded-lg border bg-[#fdfbf7] dark:bg-[#1e1814] border-[#e8dcc5] dark:border-[#3d2b1f] p-3 mb-4">
          <div className="flex items-center gap-2 font-semibold text-[#4a3728] dark:text-[#e8dcc5]">
            <span className="inline-flex h-5 w-5 rounded-full bg-black items-center justify-center mr-1"><span className="h-2.5 w-2.5 rounded-full bg-gray-100" /></span>
            {tf('puzzle.your_turn','Votre tour')} <span className="text-xs ml-2 text-gray-500">{tf('puzzle.find_best_move','Trouvez le meilleur coup')}</span>
          </div>
        </div>

        <div className="space-y-2">
          <Link to="/Training">
            <Button className="w-full bg-[#6B8E4E] hover:bg-[#5a7a40] text-white">
              <Brain className="w-4 h-4 mr-2" /> {noPuzzle ? tf('puzzle.practice','S\'entraîner') : tf('home.solve_now','Résoudre maintenant')}
            </Button>
          </Link>
          <div className="grid grid-cols-2 gap-2">
            <Link to="/Training">
              <Button variant="outline" className="w-full">
                <Eye className="w-4 h-4 mr-2" /> {tf('puzzle.view_solution','Voir la solution')}
              </Button>
            </Link>
            <Link to="/CreatePuzzle">
              <Button variant="outline" className="w-full">
                + {tf('puzzle.create','Proposer un puzzle')}
              </Button>
            </Link>
          </div>
        </div>

        <div className="mt-4 text-xs text-gray-500 dark:text-gray-400">
          <div>{tf('common.updated','Mise à jour')}: {puzzle?.updated_date ? formatDate(puzzle.updated_date) : '-'}</div>
          {created && <div>{tf('puzzle.published','Publié')}: {formatDate(created)}</div>}
        </div>
      </aside>
    </div>
  );
}