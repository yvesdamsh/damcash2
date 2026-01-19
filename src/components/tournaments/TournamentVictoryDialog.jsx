import { useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Trophy, Share2 } from 'lucide-react';
import { motion } from 'framer-motion';
import confetti from 'canvas-confetti';
import { useLanguage } from '@/components/LanguageContext';

export default function TournamentVictoryDialog({ open, onOpenChange, tournament, stats, prize }) {
    const { t } = useLanguage();

    useEffect(() => {
        if (open) {
            const duration = 3000;
            const animationEnd = Date.now() + duration;
            const defaults = { startVelocity: 30, spread: 360, ticks: 60, zIndex: 100 };

            const randomInRange = (min, max) => Math.random() * (max - min) + min;

            const interval = setInterval(() => {
                const timeLeft = animationEnd - Date.now();

                if (timeLeft <= 0) {
                    return clearInterval(interval);
                }

                const particleCount = 50 * (timeLeft / duration);
                confetti({ ...defaults, particleCount, origin: { x: randomInRange(0.1, 0.3), y: Math.random() - 0.2 } });
                confetti({ ...defaults, particleCount, origin: { x: randomInRange(0.7, 0.9), y: Math.random() - 0.2 } });
            }, 250);

            return () => clearInterval(interval);
        }
    }, [open]);

    if (!tournament) return null;

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-md bg-gradient-to-br from-yellow-50 to-orange-50 border-yellow-200">
                <DialogHeader>
                    <DialogTitle className="text-center flex flex-col items-center gap-4 pt-4">
                        <motion.div
                            initial={{ scale: 0, rotate: -180 }}
                            animate={{ scale: 1, rotate: 0 }}
                            transition={{ type: "spring", stiffness: 260, damping: 20 }}
                        >
                            <div className="w-24 h-24 bg-yellow-100 rounded-full flex items-center justify-center border-4 border-yellow-400 shadow-xl">
                                <Trophy className="w-12 h-12 text-yellow-600" />
                            </div>
                        </motion.div>
                        <div className="space-y-1">
                            <h2 className="text-2xl font-black text-yellow-800 uppercase tracking-wider">
                                {t('tournament.victory_title') || "VICTOIRE !"}
                            </h2>
                            <p className="text-yellow-700 font-medium">
                                {t('tournament.champion_msg', { name: tournament.name }) || `Champion du tournoi ${tournament.name}`}
                            </p>
                        </div>
                    </DialogTitle>
                </DialogHeader>

                <div className="py-6 space-y-4">
                    {prize > 0 && (
                        <div className="bg-white/60 p-4 rounded-xl border border-yellow-200 text-center">
                            <span className="text-sm text-yellow-600 uppercase font-bold">{t('tournament.prize_won') || "Prix Gagné"}</span>
                            <div className="text-3xl font-black text-yellow-600 flex items-center justify-center gap-1">
                                {prize} <span className="text-lg">D$</span>
                            </div>
                        </div>
                    )}

                    <div className="grid grid-cols-2 gap-3">
                        <div className="bg-white/60 p-3 rounded-lg text-center">
                            <div className="text-xs text-gray-500 uppercase">{t('teams.wins') || "Victoires"}</div>
                            <div className="text-xl font-bold text-gray-800">{stats?.wins || 0}</div>
                        </div>
                        <div className="bg-white/60 p-3 rounded-lg text-center">
                            <div className="text-xs text-gray-500 uppercase">ELO</div>
                            <div className="text-xl font-bold text-gray-800 flex items-center justify-center gap-1">
                                {stats?.elo || 1200} 
                                <span className="text-xs text-green-600 font-normal">
                                    (+{stats?.elo_gain || 0})
                                </span>
                            </div>
                        </div>
                    </div>
                </div>

                <DialogFooter className="flex-col sm:flex-row gap-2">
                    <Button variant="outline" className="w-full border-yellow-300 text-yellow-700 hover:bg-yellow-100" onClick={() => onOpenChange(false)}>
                        {t('common.close') || "Fermer"}
                    </Button>
                    <Button className="w-full bg-yellow-600 hover:bg-yellow-700 text-white shadow-lg">
                        <Share2 className="w-4 h-4 mr-2" /> {t('profile.share') || "Partager"}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}