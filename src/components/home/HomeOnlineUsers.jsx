import React from 'react';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { User, RefreshCw } from 'lucide-react';
import { useLanguage } from '@/components/LanguageContext';

export default function HomeOnlineUsers() {
  const { t } = useLanguage();
  const [me, setMe] = React.useState(null);
  const [users, setUsers] = React.useState([]);
  const [loading, setLoading] = React.useState(true);

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

  return (
    <Card className="bg-white/80 dark:bg-[#1e1814]/80 backdrop-blur border-[#d4c5b0] dark:border-[#3d2b1f] shadow-lg">
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
                <div className="text-sm font-bold text-[#4a3728] dark:text-[#e8dcc5] truncate">
                  {isMe ? (u.username || u.full_name || 'Moi') + ' • ' + (t('home.you') || 'Vous') : (u.username || u.full_name || 'Joueur')}
                </div>
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