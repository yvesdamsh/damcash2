import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { useLanguage } from '@/components/LanguageContext';

function timeLeft(end) {
  if (!end) return '';
  const ms = new Date(end).getTime() - Date.now();
  if (ms <= 0) return '0d 0h';
  const d = Math.floor(ms / (24*3600*1000));
  const h = Math.floor((ms % (24*3600*1000)) / (3600*1000));
  return `${d}d ${h}h`;
}

export default function LeagueSeasonBanner({ league, participants, currentUserId }) {
  const { t } = useLanguage();
  const my = React.useMemo(() => (participants || []).find(p => p.user_id === currentUserId), [participants, currentUserId]);
  const tierList = React.useMemo(() => (participants || []).filter(p => p.rank_tier === (my?.rank_tier || 'bronze')).sort((a,b) => (b.points||0)-(a.points||0)), [participants, my?.rank_tier]);
  const idx = tierList.findIndex(p => p.user_id === currentUserId);
  const n = tierList.length || 1;
  const top = Math.max(1, Math.floor(n * 0.2));
  const bottom = Math.max(1, Math.floor(n * 0.2));
  const zone = (idx >=0 && idx < top) ? 'promo' : (idx >= n - bottom ? 'releg' : 'safe');

  return (
    <Card className="bg-gradient-to-r from-[#6B8E4E] to-[#4a3728] text-white border-none">
      <CardContent className="p-4 md:p-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="text-xs uppercase opacity-80">{t('league.season_time_left') || 'Temps restant dans la saison'}</div>
          <div className="text-2xl md:text-3xl font-black tracking-tight">{timeLeft(league?.end_date)}</div>
        </div>
        <div className="text-sm">
          <div className="font-bold mb-1">{t('league.current_zone') || 'Zone actuelle'}</div>
          <div className={`px-3 py-1 rounded-full inline-block ${zone==='promo' ? 'bg-green-600' : (zone==='releg' ? 'bg-red-600' : 'bg-white/20')}`}> 
            {zone==='promo' ? (t('league.zone_promo') || 'Promotion') : (zone==='releg' ? (t('league.zone_relegation') || 'Relégation') : (t('league.zone_safe') || 'Neutre'))}
          </div>
        </div>
        <div className="text-sm">
          <div className="font-bold mb-1">{t('league.potential_rewards') || 'Récompenses potentielles'}</div>
          <div className="opacity-90">{league?.rewards?.first || t('league.reward_champion')}</div>
        </div>
      </CardContent>
    </Card>
  );
}