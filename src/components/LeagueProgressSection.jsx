import React from 'react';
import { base44 } from '@/api/base44Client';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { useLanguage } from '@/components/LanguageContext';

export default function LeagueProgressSection({ leagueId, userId }) {
  const { t } = useLanguage();
  const [data, setData] = React.useState([]);

  React.useEffect(() => {
    (async () => {
      if (!leagueId || !userId) return;
      // Fetch last 12 finished games in league for this user
      const games = await base44.entities.Game.filter({ league_id: leagueId, status: 'finished' }, '-updated_date', 20);
      const mine = (games || []).filter(g => g.white_player_id === userId || g.black_player_id === userId).slice(0, 12).reverse();
      let points = 0;
      const series = mine.map((g, idx) => {
        const won = !!g.winner_id && g.winner_id === userId;
        const draw = !g.winner_id;
        const delta = won ? 3 : (draw ? 1 : 0);
        points += delta;
        return { idx: idx+1, points, label: new Date(g.updated_date || g.created_date).toLocaleDateString() };
      });
      setData(series);
    })();
  }, [leagueId, userId]);

  if (!userId) return null;

  return (
    <Card className="mt-6 border-[#d4c5b0]">
      <CardHeader>
        <CardTitle className="text-[#4a3728]">{t('league.progress_chart') || 'Progression de points (dern. matchs)'}</CardTitle>
      </CardHeader>
      <CardContent style={{ height: 260 }}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ left: 10, right: 10, top: 10, bottom: 10 }}>
            <XAxis dataKey="idx" tick={{ fontSize: 12 }} />
            <YAxis tick={{ fontSize: 12 }} allowDecimals={false} />
            <Tooltip formatter={(v) => [v, 'Points']} labelFormatter={(l) => `Match ${l}`} />
            <Line type="monotone" dataKey="points" stroke="#6b5138" strokeWidth={2} dot={false} />
          </LineChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}