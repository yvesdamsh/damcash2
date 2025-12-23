import React from 'react';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { User, RefreshCw } from 'lucide-react';
import { useLanguage } from '@/components/LanguageContext';
import { useNavigate } from 'react-router-dom';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';

export default function HomeOnlineUsers() {
  const { t } = useLanguage();
  const [me, setMe] = React.useState(null);
  const [users, setUsers] = React.useState([]);
  const [loading, setLoading] = React.useState(true);
  const navigate = useNavigate();
  const [configOpen, setConfigOpen] = React.useState(false);
  const [selectedUser, setSelectedUser] = React.useState(null);
  const [creating, setCreating] = React.useState(false);
  const [cfg, setCfg] = React.useState({
    time: 10,
    increment: 0,
    series: 1,
    stake: 0,
    type: (localStorage.getItem('gameMode') || 'checkers')
  });

  const fetchOnline = React.useCallback(async () => {
    setLoading(true);
    try {
      const current = await base44.auth.me().catch(() => null);
      setMe(current);
      const res = await base44.functions.invoke('listOnlineUsers', { limit: 20 });
      const list = res?.data?.users || [];
      setUsers(list);
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    fetchOnline();
    const iv = setInterval(fetchOnline, 30000);
    return () => clearInterval(iv);
  }, [fetchOnline]);

  const isOnline = (lastSeen) => {
    if (!lastSeen) return false;
    return Date.now() - new Date(lastSeen).getTime() < 5 * 60 * 1000;
  };

  const rows = (() => {
    if (!me) return users;
    const exists = users.find((u) => u.id === me.id);
    if (exists) return users;
    return [{
      id: me.id,
      username: me.username,
      full_name: me.full_name,
      email: me.email,
      avatar_url: me.avatar_url,
      last_seen: new Date().toISOString(),
    }, ...users].slice(0, 20);
  })();

  const openConfig = (u) => {
    if (!me || (u && me && u.id === me.id)) return;
    setSelectedUser(u);
    setConfigOpen(true);
  };

  const handleConfirmInvite = async () => {
    if (!selectedUser) return;
    setCreating(true);
    try {
      const authed = await base44.auth.isAuthenticated().catch(() => false);
      if (!authed) {
        base44.auth.redirectToLogin(window.location.href);
        return;
      }
      const current = await base44.auth.me();
      const code = Math.random().toString(36).substring(2, 8).toUpperCase();

      let initialBoard;
      if (cfg.type === 'chess') {
        const { initializeChessBoard } = await import('@/components/chessLogic');
        initialBoard = JSON.stringify({ board: initializeChessBoard(), castlingRights: { wK: true, wQ: true, bK: true, bQ: true }, lastMove: null });
      } else {
        const { initializeBoard } = await import('@/components/checkersLogic');
        initialBoard = JSON.stringify(initializeBoard());
      }

      const newGame = await base44.entities.Game.create({
        status: 'waiting',
        game_type: cfg.type,
        white_player_id: current.id,
        white_player_name: current.username || `Joueur ${current.id.substring(0,4)}`,
        current_turn: 'white',
        board_state: initialBoard,
        is_private: true,
        access_code: code,
        initial_time: cfg.time,
        increment: cfg.increment,
        white_seconds_left: cfg.time * 60,
        black_seconds_left: cfg.time * 60,
        series_length: cfg.series,
        series_score_white: 0,
        series_score_black: 0,
        entry_fee: cfg.stake,
        prize_pool: 0
      });

      await base44.entities.Invitation.create({
        from_user_id: current.id,
        from_user_name: current.username || `Joueur ${current.id.substring(0,4)}`,
        to_user_email: selectedUser.email,
        game_type: cfg.type,
        game_id: newGame.id,
        status: 'pending'
      });

      await base44.functions.invoke('sendNotification', {
        recipient_id: selectedUser.id,
        type: 'game_invite',
        title: t('home.invite_friend'),
        message: (t('home.invite_from') || 'Invitation de') + ` ${current.username || t('common.anonymous')}`,
        link: `/Game?id=${newGame.id}`,
        metadata: { gameId: newGame.id }
      });

      setConfigOpen(false);
      navigate(`/Game?id=${newGame.id}`);
    } finally {
      setCreating(false);
    }
  };

  return (
    <Card className="bg-white/80 dark:bg-[#1e1814]/80 backdrop-blur border-[#d4c5b0] dark:border-[#3d2b1f] shadow-lg">
      <Dialog open={configOpen} onOpenChange={setConfigOpen}>
        <DialogContent className="sm:max-w-[480px] bg-[#fdfbf7]">
          <DialogHeader>
            <DialogTitle className="text-[#4a3728]">{t('home.configure_match') || 'Configurer la partie'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-2">
              {[{l:'1+0', t:1, i:0},{l:'3+2', t:3, i:2},{l:'5+0', t:5, i:0},{l:'10+0', t:10, i:0},{l:'15+10', t:15, i:10}].map(p => (
                <Button key={p.l} variant={cfg.time===p.t && cfg.increment===p.i ? 'default':'outline'} onClick={() => setCfg({...cfg, time:p.t, increment:p.i})} className={cfg.time===p.t && cfg.increment===p.i ? 'bg-[#6b5138] hover:bg-[#5c4430] text-white' : 'border-[#d4c5b0] text-[#6b5138]'}>
                  {p.l}
                </Button>
              ))}
            </div>
            <div className="grid grid-cols-5 gap-2">
              {[1,3,7,9,20].map(s => (
                <Button key={s} variant={cfg.series===s ? 'default':'outline'} onClick={() => setCfg({...cfg, series:s})} className={cfg.series===s ? 'bg-[#6b5138] hover:bg-[#5c4430] text-white':'border-[#d4c5b0] text-[#6b5138]'}>
                  {s===1 ? 'Unique' : s}
                </Button>
              ))}
            </div>
            <div className="grid grid-cols-5 gap-2">
              {[0,10,50,100,500].map(s => (
                <Button key={s} variant={cfg.stake===s ? 'default':'outline'} onClick={() => setCfg({...cfg, stake:s})} className={cfg.stake===s ? 'bg-yellow-600 hover:bg-yellow-700 text-white':'border-[#d4c5b0] text-[#6b5138]'}>
                  {s===0 ? 'Gratuit' : `D$ ${s}`}
                </Button>
              ))}
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Button variant={cfg.type==='checkers' ? 'default':'outline'} onClick={() => setCfg({...cfg, type:'checkers'})} className={cfg.type==='checkers' ? 'bg-[#6b5138] hover:bg-[#5c4430] text-white':'border-[#d4c5b0] text-[#6b5138]'}>⚪ Dames</Button>
              <Button variant={cfg.type==='chess' ? 'default':'outline'} onClick={() => setCfg({...cfg, type:'chess'})} className={cfg.type==='chess' ? 'bg-[#6B8E4E] hover:bg-[#5a7a40] text-white':'border-[#d4c5b0] text-[#6B8E4E]'}>♟️ Échecs</Button>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setConfigOpen(false)} className="border-[#d4c5b0] text-[#6b5138]">{t('common.cancel') || 'Annuler'}</Button>
              <Button onClick={handleConfirmInvite} disabled={creating} className="bg-[#4a3728] hover:bg-[#2c1e12] text-white">
                {creating ? '...' : (t('home.send_invite') || 'Envoyer l\'invitation')}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <CardHeader className="pb-2 flex items-center justify-between">
        <CardTitle className="text-sm font-bold uppercase text-gray-600 dark:text-[#b09a85]">
          {t('home.online_now') !== 'home.online_now' ? t('home.online_now') : 'En ligne maintenant'} ({rows.length})
        </CardTitle>
        <Button size="icon" variant="ghost" onClick={fetchOnline} className="h-7 w-7">
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
        </Button>
      </CardHeader>
      <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {rows.length === 0 && (
          <div className="text-xs text-gray-400 italic">{t('home.no_online') || 'Personne en ligne pour le moment.'}</div>
        )}
        {rows.map((u) => {
          const online = isOnline(u.last_seen);
          const isMe = me && u.id === me.id;
          return (
            <div key={u.id} className="flex items-center gap-3 p-2 rounded border border-[#e8dcc5] dark:border-[#3d2b1f] bg-[#fdfbf7] dark:bg-[#2a201a]">
              <div className="relative">
                <div className="w-9 h-9 rounded-full bg-gray-200 flex items-center justify-center overflow-hidden border border-white shadow-sm">
                  {u.avatar_url ? (
                    <img src={u.avatar_url} alt={u.username || u.full_name} className="w-full h-full object-cover" />
                  ) : (
                    <User className="w-5 h-5 text-gray-500" />
                  )}
                </div>
                <span className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-white ${online ? 'bg-green-500' : 'bg-gray-300'}`} />
              </div>
              <div className="flex-1 min-w-0">
                <button onClick={() => !isMe && openConfig(u)} disabled={isMe} className="text-left text-sm font-bold text-[#4a3728] dark:text-[#e8dcc5] underline-offset-2 hover:underline truncate disabled:opacity-60">
                  {isMe ? (u.username || u.full_name || 'Moi') : (u.username || u.full_name || 'Joueur')}
                </button>
                <div className="text-[10px] text-gray-500 truncate">
                  {online ? (t('home.status_online') || 'En ligne') : (t('home.status_recent') || 'Récemment')}
                </div>
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}