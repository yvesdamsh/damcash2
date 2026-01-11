import React from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { useLanguage } from '@/components/LanguageContext';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { base44 } from '@/api/base44Client';

export default function LeagueStatsCard({ league, currentUser }) {
  const { t } = useLanguage();
  const [me, setMe] = React.useState(null);
  const [tierPlayers, setTierPlayers] = React.useState([]);
  const [recent, setRecent] = React.useState([]);

  React.useEffect(() => {
    (async () => {
      if (!league || !currentUser) return;
      const my = (await base44.entities.LeagueParticipant.list({ league_id: league.id, user_id: currentUser.id }))[0];
      setMe(my || null);
      const tierList = await base44.entities.LeagueParticipant.list({ league_id: league.id, rank_tier: my?.rank_tier || 'bronze' }, { points: -1 });
      setTierPlayers(tierList || []);
      const games = await base44.entities.Game.filter({ league_id: league.id, status: 'finished' }, '-updated_date', 10);
      const mine = (games || []).filter(g => g.white_player_id === currentUser.id || g.black_player_id === currentUser.id).slice(0, 5);
      setRecent(mine);
    })();
  }, [league?.id, currentUser?.id]);

  const myRank = React.useMemo(() => {
    if (!me) return '-';
    const idx = tierPlayers.findIndex(p => p.user_id === me.user_id);
    return idx >= 0 ? idx + 1 : '-';
  }, [me, tierPlayers]);

  const promotionThreshold = React.useMemo(() => {
    const n = tierPlayers.length || 1;
    const topCount = Math.max(1, Math.floor(n * 0.2));
    return topCount;
  }, [tierPlayers.length]);

  const inPromoZone = React.useMemo(() => Number(myRank) > 0 && Number(myRank) <= promotionThreshold, [myRank, promotionThreshold]);
  const inRelegZone = React.useMemo(() => {
    const n = tierPlayers.length || 1;
    const bottom = Math.max(1, Math.floor(n * 0.2));
    return Number(myRank) > (n - bottom);
  }, [myRank, tierPlayers.length]);

  const TrendIcon = inPromoZone ? TrendingUp : (inRelegZone ? TrendingDown : Minus);

  return (
    <Card className="border-[#d4c5b0]">
      <CardHeader>
        <CardTitle className="text-[#4a3728]">{t('league.my_status') || 'Mon statut'}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 text-sm text-[#4a3728]">
        <div className="flex items-center justify-between">
          <div className="font-semibold">{t('league.position')}</div>
          <div className="font-black">#{myRank} / {tierPlayers.length || 0}</div>
        </div>
        <div className="flex items-center justify-between">
          <div className="font-semibold">{t('league.points')}</div>
          <div className="font-black">{me?.points ?? 0}</div>
        </div>
        <div className="flex items-center justify-between">
          <div className="font-semibold">{t('league.promo_target') || 'Objectif promotion'}</div>
          <div className="font-black">Top {promotionThreshold}</div>
        </div>
        <div className="flex items-center gap-2 text-xs">
          <TrendIcon className={inPromoZone ? 'text-green-600' : (inRelegZone ? 'text-red-600' : 'text-gray-500')} />
          <span>{inPromoZone ? (t('league.zone_promo') || 'Zone de promotion') : (inRelegZone ? (t('league.zone_relegation') || 'Zone de relégation') : (t('league.zone_safe') || 'Zone neutre'))}</span>
        </div>

        {recent.length > 0 && (
          <div className="pt-2 border-t border-dashed border-[#f0e6d2]">
            <div className="text-xs font-bold mb-2">{t('league.last_matches') || 'Derniers matchs'}</div>
            <div className="space-y-1">
              {recent.map(g => {
                const iWon = g.winner_id && g.winner_id === currentUser.id;
                const isDraw = !g.winner_id;
                return (
                  <div key={g.id} className="flex items-center justify-between text-xs">
                    <div className="truncate">{g.white_player_name} vs {g.black_player_name}</div>
                    <div className={`font-bold ${iWon ? 'text-green-600' : (isDraw ? 'text-gray-500' : 'text-red-600')}`}>{iWon ? 'W' : (isDraw ? 'D' : 'L')}</div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}