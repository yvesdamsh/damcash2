import React from 'react';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { User, RefreshCw } from 'lucide-react';
import { useLanguage } from '@/components/LanguageContext';
import { useNavigate } from 'react-router-dom';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { toast } from 'sonner';

export default function HomeOnlineUsers() {
  const { t } = useLanguage();
  const [me, setMe] = React.useState(null);
  const meRef = React.useRef(null);
  const fetchInFlightRef = React.useRef(false);
  const lastFetchRef = React.useRef(0);
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

  // Debug traces
  React.useEffect(() => { console.log('[HomeOnlineUsers] state:init', { cfg }); }, []);
  React.useEffect(() => { console.log('[HomeOnlineUsers] configOpen changed:', configOpen); }, [configOpen]);
  React.useEffect(() => { if (selectedUser) console.log('[HomeOnlineUsers] selectedUser:', selectedUser?.id, selectedUser?.username || selectedUser?.full_name); }, [selectedUser]);

  const fetchOnline = React.useCallback(async () => {
    const now = Date.now();
    if (fetchInFlightRef.current || now - lastFetchRef.current < 30000) return;
    fetchInFlightRef.current = true;
    setLoading(true);
    try {
      let list = [];
      try {
        const res = await base44.functions.invoke('listOnlineUsers', { limit: 20, gameType: cfg.type });
        list = res?.data?.users || [];
      } catch (e) {
        // On rate limit or other error, keep current list and back off silently
        list = users;
      }
      setUsers(list);
      lastFetchRef.current = Date.now();
    } finally {
      fetchInFlightRef.current = false;
      setLoading(false);
    }
  }, [cfg.type, users]);

  React.useEffect(() => {
    // Try to load current user, but online list no longer depends on it
    base44.auth.me().then(u => { setMe(u); meRef.current = u; }).catch(() => { setMe(null); meRef.current = null; });
    // Fetch quickly on mount; if function fails, UI stays empty but won’t block
    setTimeout(() => fetchOnline(), 200);
  }, [cfg.type, fetchOnline]);

  React.useEffect(() => {
    const onMode = () => setCfg(prev => ({ ...prev, type: (localStorage.getItem('gameMode') || 'checkers') }));
    window.addEventListener('gameModeChanged', onMode);
    return () => window.removeEventListener('gameModeChanged', onMode);
  }, []);

  React.useEffect(() => {
      const iv = setInterval(() => { if (!document.hidden) fetchOnline(); }, 120000);
      return () => clearInterval(iv);
  }, [fetchOnline]);

  const isOnline = (lastSeen) => {
    if (!lastSeen) return false;
    return Date.now() - new Date(lastSeen).getTime() < 5 * 60 * 1000;
  };

  const rows = (() => {
    if (!me) return users; // do not inject self if me is not known; still allow selection
    const exists = users.find((u) => u.id === me.id);
    if (exists) return users;
    const pref = String(me?.default_game || me?.preferred_game_type || '').toLowerCase();
    const shouldIncludeMe = pref === cfg.type;
    if (!shouldIncludeMe) return users;
    return [{ id: me.id, username: me.username, full_name: me.full_name, email: me.email, avatar_url: me.avatar_url, last_seen: new Date().toISOString() }, ...users].slice(0, 20);
  })();

  const openConfig = (u) => {
    const isSelf = !!(me && u && u.id === me.id);
    console.log('[HomeOnlineUsers] openConfig()', { clickedId: u?.id, name: u?.username || u?.full_name, isSelf, meId: me?.id });
    if (isSelf) return;
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

      setConfigOpen(false);

      // Ensure Invitation is persisted before navigating (prevents lost invites)
      const inv = await base44.entities.Invitation.create({
        from_user_id: current.id,
        from_user_name: current.username || `Joueur ${current.id.substring(0,4)}`,
        to_user_email: (selectedUser.email || '').toLowerCase(),
        to_user_id: selectedUser.id,
        game_type: cfg.type,
        game_id: newGame.id,
        status: 'pending'
      });

      toast.success(t('home.invite_sent_waiting') || 'Table créée, en attente de votre ami...');
      navigate(`/Game?id=${newGame.id}`);

      // Fire-and-forget notification
      base44.functions.invoke('sendNotification', {
        recipient_id: selectedUser.id,
        type: 'game_invite',
        title: t('home.invite_friend'),
        message: (t('home.invite_from') || 'Invitation de') + ` ${current.username || t('common.anonymous')}`,
        link: `/Game?id=${newGame.id}&join=player`,
        metadata: { gameId: newGame.id, invitationId: inv.id }
      }).catch(e => console.warn('[INVITE] Notification failed:', e?.message || e));
    } finally {
      setCreating(false);
    }
  };

  return (
    <Card className="bg-white/80 dark:bg-[#1e1814]/80 backdrop-blur border-[#d4c5b0] dark:border-[#3d2b1f] shadow-lg">
      <Dialog open={configOpen} onOpenChange={(v) => { console.log('[HomeOnlineUsers] onOpenChange', v); setConfigOpen(v); }}>
        <DialogContent className="sm:max-w-[420px]" onOpenAutoFocus={() => console.log('[HomeOnlineUsers] Dialog open') }>
          <DialogHeader>
            <DialogTitle>Défier {selectedUser?.username || selectedUser?.full_name || 'joueur'}</DialogTitle>
          </DialogHeader>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => { console.log('[HomeOnlineUsers] cancel'); setConfigOpen(false); }}>
              {t('common.cancel') || 'Annuler'}
            </Button>
            <Button onClick={() => { console.log('[HomeOnlineUsers] Defier click'); handleConfirmInvite(); }} disabled={creating}>
              {creating ? '...' : 'Défier'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <CardHeader className="pb-2 flex items-center justify-between">
        <CardTitle className="text-sm font-bold uppercase text-gray-600 dark:text-[#b09a85]">
          {t('home.online_now') || 'En ligne maintenant'} ({rows.length})
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
            <div key={u.id} onClick={() => { console.log('[HomeOnlineUsers] user row clicked', u.id, u.username || u.full_name); if (!isMe) openConfig(u); }} className={`group flex items-center gap-3 p-2 rounded border border-[#e8dcc5] dark:border-[#3d2b1f] bg-[#fdfbf7] dark:bg-[#2a201a] ${!isMe ? 'cursor-pointer hover:bg-[#f6efe4]' : 'opacity-60 cursor-not-allowed'}`} role="button" tabIndex={0} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); console.log('[HomeOnlineUsers] user row keydown', e.key, u.id); if (!isMe) openConfig(u); } }}>
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
                <div className="text-left text-sm font-bold text-[#4a3728] dark:text-[#e8dcc5] underline-offset-2 group-hover:underline truncate">
                  {u.username || u.full_name || (isMe ? (t('lobby.me') || 'Me') : (t('common.player') || 'Player'))}
                </div>
                <div className="text-[10px] text-gray-500 truncate">
                  {online ? (t('home.status_online') || 'En ligne') : (t('home.status_recent') || 'Récemment')}
                </div>
                <div className="text-[10px] text-gray-500 truncate">
                  ELO: {(u.elo_checkers ?? 1200)} (Dames) • {(u.elo_chess ?? 1200)} (Échecs)
                </div>
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}