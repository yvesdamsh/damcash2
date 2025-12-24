import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import ChessBoard from "@/components/ChessBoard";
import CheckerBoard from "@/components/CheckerBoard";
import { useLanguage } from "@/components/LanguageContext";
import { initializeBoard as initCheckers } from "@/components/checkersLogic";
import { initializeChessBoard as initChess } from "@/components/chessLogic";
import { base44 } from "@/api/base44Client";
import { Eraser, Save, Crown } from "lucide-react";

export default function PuzzleEditor({ gameType = 'checkers', onSaved }) {
  const { t } = useLanguage();
  const tf = (key, fallback) => (t(key) === key ? fallback : t(key));

  // Board state (start from initial game setup so it "reverts" to initial after 24h)
  const [chessBoard, setChessBoard] = React.useState(gameType === 'chess' ? initChess() : null);
  const [checkersBoard, setCheckersBoard] = React.useState(gameType === 'checkers' ? initCheckers() : null);

  // Palette selection
  const [selected, setSelected] = React.useState(gameType === 'chess' ? 'Q' : 1); // null = erase
  const [difficulty, setDifficulty] = React.useState('medium');
  const [title, setTitle] = React.useState(t('home.daily_puzzle') === 'home.daily_puzzle' ? 'Daily Puzzle' : t('home.daily_puzzle'));
  const [fenText, setFenText] = React.useState('');
  const [fenError, setFenError] = React.useState('');

  React.useEffect(() => {
    if (gameType === 'chess') {
      setChessBoard(initChess());
      setCheckersBoard(null);
      setSelected('Q');
    } else {
      setChessBoard(null);
      setCheckersBoard(initCheckers());
      setSelected(1);
    }
  }, [gameType]);

  const handleSquareClick = (r, c) => {
    if (gameType === 'chess') {
      setChessBoard((prev) => {
        const next = prev.map((row) => [...row]);
        next[r][c] = selected || null;
        return next;
      });
    } else {
      setCheckersBoard((prev) => {
        const next = prev.map((row) => [...row]);
        next[r][c] = selected || 0;
        return next;
      });
    }
  };

  const savePuzzle = async () => {
    // Allow only one daily per 24h
    const existing = await base44.entities.Puzzle.filter({ game_type: gameType, theme: 'daily' }, '-created_date', 1);
    const last = existing?.[0];
    if (last) {
      const created = new Date(last.created_date).getTime();
      const expired = Date.now() - created > 24 * 60 * 60 * 1000;
      if (!expired) {
        alert(t('home.daily_exists') || 'Un puzzle du jour existe déjà pour les dernières 24 heures.');
        return;
      }
    }

    const payload = {
      game_type: gameType,
      title,
      description: '',
      difficulty,
      theme: 'daily',
      board_state:
        gameType === 'chess'
          ? JSON.stringify({ board: chessBoard, castlingRights: { wK: false, wQ: false, bK: false, bQ: false }, lastMove: null })
          : JSON.stringify(checkersBoard),
    };

    const created = await base44.entities.Puzzle.create(payload);
    if (onSaved) onSaved(created);
  };

  return (
    <Card className="bg-white/90 dark:bg-[#1e1814]/90 border border-dashed border-[#d4c5b0] dark:border-[#3d2b1f]">
      <CardHeader>
        <CardTitle className="text-[#4a3728] dark:text-[#e8dcc5]">
          {tf('home.propose_puzzle', 'Proposer un puzzle (24h)')}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-4 items-start xl:grid-cols-[1fr_360px]">
          <MiniBoard
            type={gameType}
            board={gameType === 'chess' ? chessBoard : checkersBoard}
            onSquareClick={handleSquareClick}
            className="bg-white/60 ring-1 ring-[#4a3728]/15 min-h-[300px] sm:min-h-[360px] md:min-h-[420px] max-w-[520px] mx-auto"
          />

          <div className="space-y-3">
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder={tf('home.puzzle_title', 'Titre du puzzle')} />
            <div>
              <label className="text-xs text-gray-500">{tf('home.difficulty', 'Difficulté')}</label>
              <Select value={difficulty} onValueChange={setDifficulty}>
                <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {['easy','medium','hard'].map((d) => (
                    <SelectItem key={d} value={d}>{d}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <div className="grid grid-cols-2 gap-2">
                <Button variant="outline" onClick={() => {
                  if (gameType==='chess') {
                    setChessBoard(Array.from({length:8},()=>Array(8).fill(null)));
                  } else {
                    setCheckersBoard(Array.from({length:8},()=>Array(8).fill(0)));
                  }
                }}>
                  {tf('home.clear_board','Vider le plateau')}
                </Button>
                <Button variant="outline" onClick={() => {
                  if (gameType==='chess') {
                    setChessBoard(initChess());
                  } else {
                    setCheckersBoard(initCheckers());
                  }
                }}>
                  {tf('home.start_position','Position de départ')}
                </Button>
              </div>

              {gameType === 'chess' && (
                <div className="space-y-2">
                  <Input
                    value={fenText || ''}
                    onChange={(e) => { setFenText(e.target.value); setFenError(''); }}
                    placeholder={tf('home.paste_fen','Coller FEN (ex: rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR)')}
                  />
                  <Button
                    variant="secondary"
                    onClick={() => {
                      const part = (fenText || '').trim().split(' ')[0];
                      const ranks = part.split('/');
                      if (ranks.length !== 8) { setFenError(tf('home.fen_invalid','FEN invalide')); return; }
                      const board = [];
                      for (let r=0;r<8;r++) {
                        const row = [];
                        let count = 0;
                        for (const ch of ranks[r]) {
                          if (/[1-8]/.test(ch)) {
                            const n = parseInt(ch,10);
                            for (let i=0;i<n;i++){ row.push(null); count++; }
                          } else if (/[prnbqkPRNBQK]/.test(ch)) {
                            row.push(ch);
                            count++;
                          } else {
                            setFenError(tf('home.fen_invalid','FEN invalide')); return;
                          }
                        }
                        if (count !== 8) { setFenError(tf('home.fen_invalid','FEN invalide')); return; }
                        board.push(row);
                      }
                      setChessBoard(board);
                      setFenError('');
                    }}
                  >
                    {tf('home.apply_fen','Appliquer FEN')}
                  </Button>
                  {fenError && <p className="text-xs text-red-600">{fenError}</p>}
                </div>
              )}
            </div>

            {gameType === 'chess' ? (
              <div className="space-y-1">
                <div className="text-xs text-gray-500">{tf('home.piece_palette', 'Palette de pièces')}</div>
                <div className="grid grid-cols-7 gap-1">
                  {['K','Q','R','B','N','P','k','q','r','b','n','p'].map((p) => (
                    <button
                      key={p}
                      onClick={() => setSelected(p)}
                      className={`h-9 rounded border flex items-center justify-center text-lg ${selected===p?'bg-emerald-200 border-emerald-400':'bg-white border-gray-300'}`}
                    >
                      {({K:'♔',Q:'♕',R:'♖',B:'♗',N:'♘',P:'♙',k:'♚',q:'♛',r:'♜',b:'♝',n:'♞',p:'♟'})[p]}
                    </button>
                  ))}
                  <button onClick={() => setSelected(null)} className={`h-9 rounded border flex items-center justify-center ${selected==null?'bg-rose-100 border-rose-300':'bg-white border-gray-300'}`}>
                    <Eraser className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-1">
                <div className="text-xs text-gray-500">{tf('home.piece_palette', 'Palette de pions')}</div>
                <div className="grid grid-cols-5 gap-1">
                  {[{v:1,label:'W'},{v:3,label:'W👑'},{v:2,label:'B'},{v:4,label:'B👑'}].map(({v,label}) => (
                    <button key={v} onClick={() => setSelected(v)} className={`h-9 rounded border flex items-center justify-center ${selected===v?'bg-amber-100 border-amber-300':'bg-white border-gray-300'}`}>
                      <span className="w-6 h-6 rounded-full" style={{backgroundColor: (v===1||v===3)?'#f5f5f5':'#2b2b2b', display:'inline-block'}} />
                      {(v===3||v===4) ? <Crown className="w-4 h-4 ml-1" /> : null}
                    </button>
                  ))}
                  <button onClick={() => setSelected(null)} className={`h-9 rounded border flex items-center justify-center ${selected==null?'bg-rose-100 border-rose-300':'bg-white border-gray-300'}`}>
                    <Eraser className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}

            <Button onClick={savePuzzle} className="w-full bg-[#6B8E4E] hover:bg-[#5a7a40] text-white">
              <Save className="w-4 h-4 mr-2" /> {tf('home.save_public', 'Publier (24h)')}
            </Button>
            <p className="text-[11px] text-gray-500">{tf('home.save_notice', 'Une fois sauvegardé, ce puzzle restera visible 24h puis le plateau se réinitialisera.')}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}