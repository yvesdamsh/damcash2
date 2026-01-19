import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Calendar, Flag, Loader2, Clock, Megaphone } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { useLanguage } from "@/components/LanguageContext";
import { Link } from "react-router-dom";

export default function UpcomingTournaments() {
  const { t, formatDate, formatCurrency } = useLanguage();
  const [loading, setLoading] = React.useState(true);
  const [items, setItems] = React.useState([]);
  const [now, setNow] = React.useState(new Date());

  React.useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  const tt = (key, fallback) => {
    const v = t(key);
    return v === key ? fallback : v;
  };

  React.useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        setLoading(true);
        const list = await base44.entities.Tournament.filter({ status: 'open' }, '-start_date', 50);
        const now = new Date();
        const upcoming = (list || [])
          .filter(x => x.start_date ? new Date(x.start_date) >= now : true)
          .sort((a,b) => new Date(a.start_date || 0) - new Date(b.start_date || 0))
          .slice(0, 5);
        if (mounted) setItems(upcoming);
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, []);

  // Hourly tournaments schedule helpers
  const nextStart = React.useMemo(() => {
    const d = new Date(now);
    d.setSeconds(0, 0);
    if (d.getMinutes() === 0 && d.getSeconds() === 0) {
      // already on the hour, start is now
      return d;
    }
    d.setMinutes(0);
    d.setHours(d.getHours() + 1);
    return d;
  }, [now]);

  const joinOpens = new Date(nextStart.getTime() - 3 * 60 * 1000);
  const diffMs = Math.max(0, nextStart.getTime() - now.getTime());
  const hours = Math.floor(diffMs / 3600000);
  const minutes = Math.floor((diffMs % 3600000) / 60000);
  const seconds = Math.floor((diffMs % 60000) / 1000);
  const countdown = `${hours > 0 ? String(hours).padStart(2,'0') + ':' : ''}${String(minutes).padStart(2,'0')}:${String(seconds).padStart(2,'0')}`;
  const upcomingStarts = Array.from({ length: 5 }, (_, i) => new Date(nextStart.getTime() + i * 60 * 60 * 1000));
  const ROTATION = ['3+0','5+0','3+2'];
  const baseIndex = React.useMemo(() => {
    if (items[0]?.time_control && ROTATION.includes(items[0].time_control)) return ROTATION.indexOf(items[0].time_control);
    const hIndex = Math.floor(nextStart.getTime() / 3600000) % 3;
    return hIndex % 3;
  }, [items, nextStart]);
  const schedule = upcomingStarts.map((d, i) => ({ date: d, tc: ROTATION[(baseIndex + i) % 3] }));

  return (
    <Card className="bg-white/90 dark:bg-[#1e1814]/90 border-[#d4c5b0] dark:border-[#3d2b1f] shadow-xl h-full">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-[#4a3728] dark:text-[#e8dcc5]">
          <Flag className="w-5 h-5" /> {tt('home.upcoming_tournaments', 'Prochains tournois')}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Featured Damcash Hourly Tournament */}
        <div className="p-4 rounded-lg bg-gradient-to-r from-amber-200 to-yellow-100 dark:from-amber-900/40 dark:to-yellow-900/20 border border-amber-300 dark:border-amber-800">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex items-center gap-2 font-bold text-amber-900 dark:text-amber-200">
                <Megaphone className="w-4 h-4" />
                {tt('home.hourly_tournament', 'Damcash Hourly Tournament')}
              </div>
              <p className="text-sm text-[#6b5138] dark:text-[#b09a85] mt-1">{tt('home.hourly_tournament_desc', 'Every hour. Rotating 3+0 → 5+0 → 3+2. Join early to enter the waiting list.')}</p>
              <div className="mt-2 text-xs flex items-center gap-1 text-[#6b5138] dark:text-[#b09a85]">
                <Clock className="w-3 h-3" /> {tt('home.starts_every_hour', 'Starts every hour')}
              </div>
            </div>
            <Link to={items[0]?.id ? `/TournamentDetail?id=${items[0].id}&join=queue` : "/Tournaments"} className="flex-shrink-0">
              <Button size="sm" className="bg-[#6B8E4E] hover:bg-[#5a7a40] text-white">{tt('tournaments.join_btn', 'Rejoindre')}</Button>
            </Link>
          </div>
          <div className="mt-2 text-xs text-[#6b5138] dark:text-[#b09a85]">
            <span className="inline-block px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 font-semibold mr-2">{tt('home.waiting_list','Waiting list')}</span>
            {tt('home.waiting_list_desc','Join now to reserve your seat; you’ll wait until the start time.')}
          </div>
        </div>
        {/* Live countdown to next start */}
        <div className="p-3 rounded-lg border bg-white/70 dark:bg-[#2a201a] border-[#e8dcc5] dark:border-[#3d2b1f]">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-[#4a3728] dark:text-[#e8dcc5] font-semibold">
              <Clock className="w-4 h-4" /> {tt('home.next_starts_in','Next tournament starts in')}
            </div>
            <div className="text-lg font-bold text-amber-700 dark:text-amber-300 tabular-nums">{countdown}</div>
          </div>
          <div className="text-xs text-[#6b5138] dark:text-[#b09a85] mt-1"><span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-green-100 text-green-800 font-semibold">{tt('home.waiting_list_open','Waiting list is open')}</span></div>
        </div>
        {/* Upcoming hourly list (5 items) */}
        <div className="p-3 rounded-lg border bg-[#fdfbf7] dark:bg-[#2c241b] border-[#e8dcc5] dark:border-[#3d2b1f]">
          <div className="text-sm font-bold text-[#4a3728] dark:text-[#e8dcc5] mb-2">{tt('home.upcoming_hourly','Upcoming hourly tournaments')}</div>
          <ul className="text-sm text-[#6b5138] dark:text-[#b09a85] space-y-1">
            {schedule.map(({date, tc}, i) => (
              <li key={i}>• {tc} {tt('home.at','at')} {formatDate(date, 'p')}</li>
            ))}
          </ul>
        </div>
        {loading ? (
          <div className="flex items-center gap-2 text-sm text-gray-500"><Loader2 className="w-4 h-4 animate-spin" /> {tt('common.loading', 'Chargement...')}</div>
        ) : items.length === 0 ? (
          <div className="text-sm text-[#6b5138] dark:text-[#b09a85]">
            {tt('home.no_tournaments', 'Aucun tournoi programmé pour le moment.')}<br/>
            {tt('home.tournaments_announce', 'Revenez bientôt, de nouveaux tournois seront annoncés ici !')}
          </div>
        ) : (
          items.map((it) => (
            <div key={it.id} className="p-3 rounded-lg border bg-[#fdfbf7] dark:bg-[#2c241b] border-[#e8dcc5] dark:border-[#3d2b1f]">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="font-bold text-[#4a3728] dark:text-[#e8dcc5] truncate">{it.name}</div>
                  <div className="text-xs text-gray-600 dark:text-gray-400 flex items-center gap-1">
                    <Calendar className="w-3 h-3" /> {it.start_date ? formatDate(it.start_date, 'PPpp') : '-'}
                  </div>
                </div>
                <Badge className="bg-[#6B8E4E] text-white whitespace-nowrap">{it.game_type === 'chess' ? 'Chess' : 'Checkers'}</Badge>
              </div>
              {it.description && (
                <p className="mt-1 text-xs text-[#6b5138] dark:text-[#b09a85] line-clamp-2">{it.description}</p>
              )}
              <div className="mt-2 flex items-center justify-between text-sm text-[#6b5138] dark:text-[#b09a85]">
                <span>{tt('home.entry_fee', 'Entrée')} : {formatCurrency(it.entry_fee || 0)}</span>
                <span>{tt('home.prize_pool', 'Prix')} : {formatCurrency(it.prize_pool || 0)}</span>
              </div>
              <div className="mt-3 flex gap-2">
                <Link to={`/TournamentDetail?id=${it.id}&join=queue`} className="flex-1">
                 <Button className="w-full bg-[#4a3728] hover:bg-[#2c1e12] text-[#e8dcc5]">{tt('tournaments.join_btn', 'Rejoindre')}</Button>
                </Link>
              </div>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
}