import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Link } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Trophy, Calendar, ArrowRight } from 'lucide-react';
import { useLanguage } from '@/components/LanguageContext';

export default function NextTournamentBanner() {
    const [nextTournament, setNextTournament] = useState(null);
    const [countdown, setCountdown] = useState('');
    const { t, formatDate } = useLanguage();

    useEffect(() => {
        const fetchNext = async () => {
            try {
                // Fetch open tournaments sorted by start date
                const tournaments = await base44.entities.Tournament.filter({ status: 'open' }, 'start_date', 10);
                // Filter for future start dates
                const now = new Date();
                const upcoming = tournaments
                    .filter(t => new Date(t.start_date) > now)
                    .sort((a,b) => new Date(a.start_date) - new Date(b.start_date));
                
                if (upcoming.length > 0) {
                    setNextTournament(upcoming[0]);
                }
            } catch (e) {
                console.error(e);
            }
        };
        fetchNext();
        const interval = setInterval(fetchNext, 60000); 
        return () => clearInterval(interval);
    }, []);

    useEffect(() => {
        if (!nextTournament) return;

        const timer = setInterval(() => {
            const now = new Date();
            const start = new Date(nextTournament.start_date);
            const diff = start - now;

            if (diff <= 0) {
                setCountdown(t('tournaments.status_ongoing') || "En cours");
            } else {
                const days = Math.floor(diff / (1000 * 60 * 60 * 24));
                const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
                const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
                const seconds = Math.floor((diff % (1000 * 60)) / 1000);
                
                let cd = '';
                if (days > 0) cd += `${days}j `;
                cd += `${hours}h ${minutes}m ${seconds}s`;
                setCountdown(cd);
            }
        }, 1000);

        return () => clearInterval(timer);
    }, [nextTournament]);

    if (!nextTournament) return null;

    return (
        <div className="mb-8 animate-in slide-in-from-top-4 fade-in duration-700">
            <Card className="bg-gradient-to-r from-yellow-500 to-orange-600 text-white border-none shadow-xl overflow-hidden relative">
                <div className="absolute top-0 right-0 p-8 opacity-10 pointer-events-none">
                    <Trophy className="w-48 h-48" />
                </div>
                <CardContent className="p-6 relative z-10 flex flex-col md:flex-row items-center justify-between gap-6">
                    <div className="flex items-center gap-4 w-full md:w-auto">
                        <div className="bg-white/20 p-3 rounded-full backdrop-blur-sm shrink-0">
                            <Trophy className="w-8 h-8 text-white" />
                        </div>
                        <div>
                            <div className="text-xs font-bold uppercase tracking-wider opacity-90 mb-1 flex items-center gap-2">
                                <span className="bg-red-500 px-2 py-0.5 rounded text-[10px] animate-pulse">LIVE</span>
                                {t('tournaments.official_title') || "Événement Officiel"}
                            </div>
                            <h3 className="text-2xl font-black leading-tight mb-1">{nextTournament.name}</h3>
                            <div className="flex flex-wrap items-center gap-3 text-sm opacity-90">
                                <span className="flex items-center gap-1"><Calendar className="w-4 h-4" /> {formatDate(new Date(nextTournament.start_date), 'dd MMM HH:mm')}</span>
                                <span className="flex items-center gap-1 bg-black/10 px-2 rounded-full">{nextTournament.game_type === 'chess' ? '♟️ Échecs' : '⚪ Dames'}</span>
                                {nextTournament.prize_pool > 0 && <span className="font-bold text-yellow-200">🏆 ${nextTournament.prize_pool}</span>}
                            </div>
                        </div>
                    </div>

                    <div className="flex flex-col sm:flex-row items-center gap-4 w-full md:w-auto">
                        <div className="text-center bg-black/20 px-6 py-2 rounded-xl backdrop-blur-sm border border-white/10 w-full sm:w-auto">
                            <div className="text-[10px] uppercase opacity-75 mb-1 font-bold tracking-widest">{t('tournaments.starts_in') || "DÉBUT DANS"}</div>
                            <div className="text-2xl font-mono font-bold tracking-widest tabular-nums">
                                {countdown}
                            </div>
                        </div>
                        <Link to={`/TournamentDetail?id=${nextTournament.id}&join=queue`} className="w-full sm:w-auto">
                            <Button className="w-full bg-white text-orange-600 hover:bg-orange-50 font-bold shadow-lg transition-transform hover:scale-105">
                                {t('tournaments.join_btn') || "Rejoindre"} <ArrowRight className="w-4 h-4 ml-2" />
                            </Button>
                        </Link>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}