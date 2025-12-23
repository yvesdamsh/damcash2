import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Calendar, Flag, Loader2 } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { useLanguage } from "@/components/LanguageContext";
import { Link } from "react-router-dom";

export default function UpcomingTournaments() {
  const { t, formatDate, formatCurrency } = useLanguage();
  const [loading, setLoading] = React.useState(true);
  const [items, setItems] = React.useState([]);

  React.useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        setLoading(true);
        const list = await base44.entities.Tournament.filter({ status: 'open' }, '-start_date', 20);
        const now = new Date();
        const upcoming = (list || [])
          .filter(x => x.start_date ? new Date(x.start_date) >= now : true)
          .sort((a,b) => new Date(a.start_date || 0) - new Date(b.start_date || 0))
          .slice(0, 3);
        if (mounted) setItems(upcoming);
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, []);

  return (
    <Card className="bg-white/85 dark:bg-[#1e1814]/85 border-[#d4c5b0] dark:border-[#3d2b1f] shadow-lg h-full">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-[#4a3728] dark:text-[#e8dcc5]">
          <Flag className="w-5 h-5" /> {t('home.upcoming_tournaments') || 'Upcoming Tournaments'}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {loading ? (
          <div className="flex items-center gap-2 text-sm text-gray-500"><Loader2 className="w-4 h-4 animate-spin" /> {t('common.loading') || 'Loading...'}</div>
        ) : items.length === 0 ? (
          <div className="text-sm text-gray-600 dark:text-gray-300">{t('home.no_tournaments') || 'No upcoming tournaments.'}</div>
        ) : (
          items.map((it) => (
            <div key={it.id} className="p-3 rounded-lg border bg-[#fdfbf7] dark:bg-[#2c241b] border-[#e8dcc5] dark:border-[#3d2b1f]">
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-bold text-[#4a3728] dark:text-[#e8dcc5]">{it.name}</div>
                  <div className="text-xs text-gray-600 dark:text-gray-400 flex items-center gap-1">
                    <Calendar className="w-3 h-3" /> {it.start_date ? formatDate(it.start_date, 'PPpp') : '-'}
                  </div>
                </div>
                <Badge className="bg-[#6B8E4E] text-white">{it.game_type === 'chess' ? 'Chess' : 'Checkers'}</Badge>
              </div>
              <div className="mt-2 flex items-center justify-between text-sm text-[#6b5138] dark:text-[#b09a85]">
                <span>{t('home.entry_fee') || 'Entry'}: {formatCurrency(it.entry_fee || 0)}</span>
                <span>{t('home.prize_pool') || 'Prize'}: {formatCurrency(it.prize_pool || 0)}</span>
              </div>
              <div className="mt-3 flex gap-2">
                <Link to="/Tournaments" className="flex-1">
                  <Button className="w-full bg-[#4a3728] hover:bg-[#2c1e12] text-[#e8dcc5]">{t('common.view') || 'View'}</Button>
                </Link>
              </div>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
}