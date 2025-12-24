import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Calendar, Flag, Loader2, MapPin, Clock, Megaphone } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { useLanguage } from "@/components/LanguageContext";
import { Link } from "react-router-dom";

export default function UpcomingTournaments() {
  const { t, formatDate, formatCurrency } = useLanguage();
  const [loading, setLoading] = React.useState(true);
  const [items, setItems] = React.useState([]);

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
              <p className="text-sm text-[#6b5138] dark:text-[#b09a85] mt-1">{tt('home.hourly_tournament_desc', 'Every hour on the hour. Fast 5+0 matches, prizes and badges.')}</p>
              <div className="mt-2 text-xs flex items-center gap-1 text-[#6b5138] dark:text-[#b09a85]">
                <Clock className="w-3 h-3" /> {tt('home.starts_every_hour', 'Starts every hour')}
              </div>
            </div>
            <Link to="/Tournaments" className="flex-shrink-0">
              <Button size="sm" className="bg-[#6B8E4E] hover:bg-[#5a7a40] text-white">{tt('home.join_now', 'Join now')}</Button>
            </Link>
          </div>
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
                <Link to="/Tournaments" className="flex-1">
                  <Button className="w-full bg-[#4a3728] hover:bg-[#2c1e12] text-[#e8dcc5]">{tt('common.view', 'Voir')}</Button>
                </Link>
              </div>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
}