import React from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import CheckerBoard from "@/components/CheckerBoard";
import { getValidMoves, executeMove } from "@/components/checkersLogic";
import { initializeBoard as initCheckers } from "@/components/checkersLogic";
import { useLanguage } from "@/components/LanguageContext";
import { Brain, Eye } from "lucide-react";
import { Link } from "react-router-dom";
import { base44 } from "@/api/base44Client";

function InteractiveCheckersBoard({ puzzle, initialBoard, theme, pieceDesign }) {
  const [board, setBoard] = React.useState(initialBoard);
  const [currentTurn, setCurrentTurn] = React.useState('white');
  const [selected, setSelected] = React.useState(null);
  const [validMoves, setValidMoves] = React.useState([]);
  const [mustContinueWith, setMustContinueWith] = React.useState(null);
  const [message, setMessage] = React.useState('');

  const solution = React.useMemo(() => {
    try { const arr = JSON.parse(puzzle?.solution_moves || '[]'); return Array.isArray(arr) ? arr : []; } catch(_) { return []; }
  }, [puzzle?.solution_moves]);
  const [step, setStep] = React.useState(0);

  const sameSquare = (a,b) => a && b && a.r===b.r && a.c===b.c;

  const handleSquareClick = async (r, c) => {
    const piece = board[r]?.[c];
    const isMyPiece = piece !== 0 && ((currentTurn === 'white' && (piece === 1 || piece === 3)) || (currentTurn === 'black' && (piece === 2 || piece === 4)));

    if (mustContinueWith) {
      if (selected && selected[0] === mustContinueWith.r && selected[1] === mustContinueWith.c) {
        const mv = validMoves.find(m => m.to.r === r && m.to.c === c);
        if (mv) return applyMove(mv);
      }
      return;
    }

    if (isMyPiece) {
      const all = getValidMoves(board, currentTurn);
      const pieceMoves = all.filter(m => m.from.r === r && m.from.c === c);
      setSelected([r,c]);
      setValidMoves(pieceMoves);
      setMessage('');
      return;
    }

    if (selected) {
      const mv = validMoves.find(m => m.to.r === r && m.to.c === c);
      if (mv) return applyMove(mv);
      setSelected(null); setValidMoves([]);
    }
  };

  const applyMove = async (move) => {
    // Validate against solution if provided (expects {from:{r,c}, to:{r,c}})
    const expected = solution[step];
    if (expected && expected.from && expected.to) {
      const ok = sameSquare(expected.from, move.from) && sameSquare(expected.to, move.to);
      if (!ok) { setMessage('Mauvais coup, réessayez.'); return; }
    }

    const { newBoard, promoted } = executeMove(board, [move.from.r, move.from.c], [move.to.r, move.to.c], move.captured);
    setBoard(newBoard);
    setMessage('');

    // Check for continued capture
    const contAll = getValidMoves(newBoard, currentTurn);
    const continuation = contAll.filter(m => m.from.r === move.to.r && m.from.c === move.to.c && m.captured);
    if (move.captured && continuation.length > 0) {
      setMustContinueWith({ r: move.to.r, c: move.to.c });
      setSelected([move.to.r, move.to.c]);
      setValidMoves(continuation);
    } else {
      setMustContinueWith(null);
      setSelected(null);
      setValidMoves([]);
      setCurrentTurn(prev => (prev === 'white' ? 'black' : 'white'));
      setStep(s => s + 1);
      if (step + 1 >= solution.length) setMessage('Bravo ! Puzzle résolu.');
    }
  };

  return (
    <CheckerBoard
      board={board}
      onSquareClick={handleSquareClick}
      selectedSquare={selected}
      validMoves={validMoves}
      currentTurn={currentTurn}
      playerColor={currentTurn}
      orientation="white"
      theme={theme}
      pieceDesign={pieceDesign}
    />
  );
}

export default function DailyCheckersPuzzle({ puzzle, board }) { /* responsive container fixes */
  const { t, formatDate } = useLanguage();
  const tf = (k, f) => (t(k) === k ? f : t(k));
  const created = puzzle?.created_date ? new Date(puzzle.created_date) : null;

  const [checkersTheme, setCheckersTheme] = React.useState(undefined);
  const [checkersPieces, setCheckersPieces] = React.useState(undefined);

  React.useEffect(() => {
    (async () => {
      try {
        const me = await base44.auth.me().catch(() => null);
        const prefs = me?.preferences;
        if (prefs) {
          setCheckersTheme(prefs.checkers_theme);
          setCheckersPieces(prefs.checkers_pieces);
        }
      } catch {}
    })();
  }, []);

  const noPuzzle = !puzzle;
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col items-center w-full">
        <div className="relative md:shadow-2xl rounded-none md:rounded-lg w-full md:max-w-[600px] aspect-square z-0 mx-auto">
          <InteractiveCheckersBoard 
            puzzle={puzzle}
            initialBoard={(Array.isArray(board) && board.length===10 && board.every(r=>Array.isArray(r)&&r.length===10)) ? board : initCheckers()}
            theme={checkersTheme}
            pieceDesign={checkersPieces}
          />
        </div>
      </div>
      <aside className="w-full bg-white/80 dark:bg-[#2a201a] border rounded-xl p-4 h-fit border-[#e8dcc5] dark:border-[#3d2b1f]">
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