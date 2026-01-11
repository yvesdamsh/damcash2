import React from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { useLanguage } from '@/components/LanguageContext';
import { Eye, Sword, Users, Loader2 } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { useNavigate } from 'react-router-dom';

export default function LeagueMatchmaking({ league, currentUser }) {
  const { t } = useLanguage();
  const navigate = useNavigate();
  const [waiting, setWaiting] = React.useState([]);
  const [live, setLive] = React.useState([]);
  const [loading, setLoading] = React.useState(false);

  const refresh = React.useCallback(async () => {
    if (!league) return;
    const [w, l] = await Promise.all([
      base44.entities.Game.filter({ league_id: league.id, status: 'waiting' }),
      base44.entities.Game.filter({ league_id: league.id, status: 'playing' })
    ]);
    setWaiting(w || []);
    setLive((l || []).slice(0, 4));
  }, [league?.id]);

  React.useEffect(() => {
    refresh();
    const iv = setInterval(refresh, 30000);
    return () => clearInterval(iv);
  }, [refresh]);

  const handlePlay = async () => {
    if (!league || !currentUser) return;
    setLoading(true);
    try {
      // Find compatible game (same time control preferred)
      const myPart = (await base44.entities.LeagueParticipant.list({ league_id: league.id, user_id: currentUser.id }))[0];
      const myElo = myPart?.elo ?? 1200;

      let best = null, bestDist = Infinity;
      for (const g of waiting) {
        if (g.white_player_id === currentUser.id) continue;
        const hostPart = (await base44.entities.LeagueParticipant.list({ league_id: league.id, user_id: g.white_player_id }))[0];
        const hostElo = hostPart?.elo ?? 1200;
        const dist = Math.abs(hostElo - myElo);
        if (dist < bestDist) { best = g; bestDist = dist; }
      }

      if (best) {
        await base44.entities.Game.update(best.id, {
          black_player_id: currentUser.id,
          black_player_name: currentUser.username || currentUser.full_name || t('common.player'),
          status: 'playing'
        });
        navigate(`/Game?id=${best.id}`);
        return;
      }

      // Else create new waiting game
      const initialBoard = league.game_type === 'chess' 
        ? JSON.stringify({ board: (await import('@/components/chessLogic')).initializeChessBoard(), castlingRights: { wK: true, wQ: true, bK: true, bQ: true }, lastMove: null })
        : JSON.stringify((await import('@/components/checkersLogic')).initializeBoard());

      const newGame = await base44.entities.Game.create({
        league_id: league.id,
        game_type: league.game_type,
        status: 'waiting',
        white_player_id: currentUser.id,
        white_player_name: currentUser.username || currentUser.full_name || t('common.player'),
        current_turn: 'white',
        board_state: initialBoard,
        initial_time: 5,
        increment: 0,
        white_seconds_left: 300,
        black_seconds_left: 300
      });
      navigate(`/Game?id=${newGame.id}`);
    } finally {
      setLoading(false);
    }
  };

  const grouped = React.useMemo(() => {
    const map = new Map();
    for (const g of waiting) {
      const key = g.white_player_id || 'unknown';
      map.set(key, (map.get(key) || 0) + 1);
    }
    return map;
  }, [waiting]);

  return (
    <Card className="border-[#d4c5b0]">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-[#4a3728]"><Users className="w-4 h-4" /> {t('league.matchmaking') || 'Matchmaking de Ligue'}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="text-sm text-[#6b5138]">{waiting.length} {t('matchmaking.players') || 'joueurs'} en attente • {live.length} {t('league.live_games') || 'parties en cours'}</div>
          <Button onClick={handlePlay} disabled={loading} className="bg-[#6b5138] text-white hover:bg-[#5c4430]">
            {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Sword className="w-4 h-4 mr-2" />} {t('league.play_match')}
          </Button>
        </div>

        <div className="bg-[#fffcf5] border border-[#f0e6d2] rounded p-3">
          <div className="text-xs font-bold text-[#6b5138] mb-2">{t('league.queue_by_division') || 'File d\'attente par division'}</div>
          <div className="text-xs text-[#4a3728] grid grid-cols-2 gap-2">
            <div>Bronze: {waiting.filter(w => (w.white_player_tier || 'bronze') === 'bronze').length}</div>
            <div>Silver: {waiting.filter(w => (w.white_player_tier || 'bronze') === 'silver').length}</div>
            <div>Gold: {waiting.filter(w => (w.white_player_tier || 'bronze') === 'gold').length}</div>
            <div>Diamond: {waiting.filter(w => (w.white_player_tier || 'bronze') === 'diamond').length}</div>
            <div>Master: {waiting.filter(w => (w.white_player_tier || 'bronze') === 'master').length}</div>
          </div>
        </div>

        {live.length > 0 && (
          <div className="space-y-2">
            <div className="text-xs font-bold text-[#6b5138]">{t('matchmaking.watch_while_waiting') || 'Regardez en attendant'}</div>
            {live.map(g => (
              <div key={g.id} className="flex items-center justify-between text-sm bg-white border border-[#f0e6d2] p-2 rounded">
                <div className="truncate text-[#4a3728]">{g.white_player_name} vs {g.black_player_name}</div>
                <Button size="sm" variant="outline" onClick={() => navigate(`/Game?id=${g.id}`)}><Eye className="w-3 h-3 mr-1" /> {t('league.watch') || 'Regarder'}</Button>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}