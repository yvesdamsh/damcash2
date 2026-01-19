import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Eye, Loader2, Sword, Clock, Volume2, VolumeX } from 'lucide-react';
import { useLanguage } from '@/components/LanguageContext';
import ChessBoard from '@/components/ChessBoard';
import CheckerBoard from '@/components/CheckerBoard';
import { base44 } from '@/api/base44Client';

function formatTime(total) {
  const m = Math.floor(total / 60).toString().padStart(2, '0');
  const s = Math.floor(total % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
}

export default function MatchmakingModal({ open, seconds = 0, waitingGames = [], liveGames = [], criteria, onCancel, onWatch }) {
  const { t, language } = useLanguage();
  if (!open) return null;

  const topWaiting = waitingGames.slice(0, 6);
  const topLive = liveGames.slice(0, 2);

  const compatibleCount = waitingGames.filter(g => g.initial_time === (criteria?.time) && g.increment === (criteria?.increment)).length;

  const [sound, setSound] = React.useState(true);
  const [selectedLiveId, setSelectedLiveId] = React.useState(topLive[0]?.id || null);
  const [previewBoard, setPreviewBoard] = React.useState([]);
  const [previewTurn, setPreviewTurn] = React.useState('white');

  React.useEffect(() => { setSelectedLiveId(topLive[0]?.id || null); }, [open, liveGames.length]);

  React.useEffect(() => {
    if (!open || !selectedLiveId) return;
    const timer = setInterval(async () => {
      try {
        const g = await base44.entities.Game.get(selectedLiveId);
        if (g) {
          setPreviewTurn(g.current_turn || 'white');
          try {
            const parsed = JSON.parse(g.board_state || '[]');
            if (g.game_type === 'chess') setPreviewBoard(parsed.board || []);
            else setPreviewBoard(parsed);
          } catch {}
        }
      } catch {}
    }, 2000);
    return () => clearInterval(timer);
  }, [open, selectedLiveId]);

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <Card className="w-full max-w-2xl bg-[#fdfbf7] border-[#d4c5b0] shadow-2xl animate-in fade-in">
        <CardHeader className="border-b border-[#d4c5b0]/40">
          <CardTitle className="flex items-center justify-between text-[#4a3728]">
            <span className="flex items-center gap-2"><Sword className="w-5 h-5" /> {t('matchmaking.searching') || 'Recherche en cours'}</span>
            <span className="flex items-center gap-2">
              <span className="text-sm font-mono flex items-center gap-2 text-[#6b5138]"><Clock className="w-4 h-4" /> {t('matchmaking.time_elapsed') || 'Temps écoulé'}: {formatTime(seconds)}</span>
              <button onClick={() => setSound(s => !s)} className="p-1.5 rounded-md border border-[#d4c5b0] hover:bg-white" title={sound ? 'Mute' : 'Unmute'}>
                {sound ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
              </button>
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-4 grid md:grid-cols-2 gap-4">
          <div className="md:col-span-2">
            <div className="bg-white rounded-md border border-[#e8dcc5] p-3 flex items-center justify-between">
              <div className="text-sm font-semibold text-[#4a3728]">
                {(t('matchmaking.looking_for_opponent') || "Recherche d'un adversaire")} • {(criteria?.gameType === 'chess' ? t('game.chess') : t('game.checkers'))} • {criteria?.time}+{criteria?.increment}
              </div>
              <div className="text-sm font-mono text-[#6b5138]">{formatTime(seconds)}</div>
            </div>
          </div>
          <div className="space-y-3">
            <div className="text-xs font-bold text-[#6b5138] uppercase flex items-center gap-2">
              {t('matchmaking.waiting_queue') || 'File d\'attente'}
              <span className="text-[10px] text-gray-500">{waitingGames.length} {t('matchmaking.players') || 'joueurs'} • {compatibleCount} {t('matchmaking.compatible') || 'compatibles'}</span>
            </div>
            {topWaiting.length === 0 ? (
              <div className="h-28 flex flex-col items-center justify-center text-sm text-gray-500 bg-white rounded-md border border-[#d4c5b0]">
                <div>{t('matchmaking.no_players_waiting') || 'Aucun joueur en attente'}</div>
                <div className="text-[11px] opacity-70">{t('matchmaking.be_patient') || 'Soyez patient, d\'autres joueurs arrivent...'}</div>
              </div>
            ) : (
              <div className="space-y-2 max-h-40 overflow-y-auto">
                {topWaiting.map(g => {
                  const isCompat = g.initial_time === (criteria?.time) && g.increment === (criteria?.increment);
                  return (
                    <div key={g.id} className="flex items-center justify-between p-2 bg-white rounded-md border border-[#e8dcc5]">
                      <div className="text-sm text-[#4a3728] font-medium truncate">{g.white_player_name} • {g.initial_time}+{g.increment}</div>
                      <div className="flex items-center gap-2">
                        {isCompat && <span className="text-[10px] px-1.5 py-0.5 rounded bg-green-100 text-green-700 border border-green-200">{t('matchmaking.compatible') || 'compatibles'}</span>}
                        <div className="text-[10px] text-gray-500">ELO {g.white_player_elo || 1200}</div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="space-y-3">
            <div className="text-xs font-bold text-[#6b5138] uppercase">{t('matchmaking.watch_while_waiting') || 'Regardez en attendant'}</div>
            {topLive.length === 0 ? (
              <div className="h-28 flex items-center justify-center text-sm text-gray-500 bg-white rounded-md border border-[#d4c5b0]">{t('matchmaking.no_live_games') || 'Aucune partie en cours à regarder'}</div>
            ) : (
              <div className="space-y-2">
                {topLive.map(g => (
                  <div key={g.id} className="flex items-center justify-between p-2 bg-white rounded-md border border-[#e8dcc5]">
                    <div className="text-sm text-[#4a3728] font-medium truncate">{g.white_player_name} vs {g.black_player_name}</div>
                    <div className="flex items-center gap-2">
                      <Button size="sm" variant="outline" onClick={() => setSelectedLiveId(g.id)} className="h-8">👁️</Button>
                      <Button size="sm" variant="outline" onClick={() => onWatch && onWatch(g.id)} className="h-8">
                        <Eye className="w-3 h-3 mr-1" /> {t('matchmaking.watch_fullscreen') || 'Plein écran'}
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className="bg-white rounded-md border border-[#e8dcc5] p-3 mt-3">
              {selectedLiveId ? (
                <div className="w-full max-w-[320px] mx-auto">
                  {(() => {
                    const g = liveGames.find(x => x.id === selectedLiveId);
                    if (!g) return null;
                    return g.game_type === 'chess' ? (
                      <div className="aspect-square">
                        <ChessBoard board={previewBoard} currentTurn={previewTurn} playerColor="spectator" isSoloMode={false} validMoves={[]} onSquareClick={()=>{}} onPieceDrop={()=>{}} />
                      </div>
                    ) : (
                      <div className="aspect-square">
                        <CheckerBoard board={previewBoard} currentTurn={previewTurn} playerColor="spectator" isSoloMode={false} validMoves={[]} onSquareClick={()=>{}} />
                      </div>
                    );
                  })()}
                  <div className="flex items-center justify-between mt-2 text-xs text-[#6b5138]">
                    <span>{language === 'fr' ? (previewTurn === 'white' ? 'Tour des Blancs' : 'Tour des Noirs') : (previewTurn === 'white' ? 'White to move' : 'Black to move')}</span>
                    <Button size="sm" variant="outline" onClick={() => onWatch && onWatch(selectedLiveId)} className="h-8">
                      <Eye className="w-3 h-3 mr-1" /> {t('matchmaking.watch_fullscreen') || 'Plein écran'}
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="text-sm text-gray-500">{t('matchmaking.no_live_games') || 'Aucune partie en cours à regarder'}</div>
              )}
            </div>
          </div>

          <div className="md:col-span-2 flex items-center justify-between mt-2">
            <div className="text-xs text-[#6b5138] flex items-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin" />
              {t('matchmaking.connecting') || 'Connexion...'}
            </div>
            <Button variant="outline" onClick={onCancel} className="border-[#d4c5b0]">{t('matchmaking.cancel_search') || 'Annuler la recherche'}</Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}