import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Medal } from 'lucide-react';
import { useLanguage } from '@/components/LanguageContext';

export default function TournamentDefeatDialog({ open, onOpenChange, tournament, stats, rank }) {
    const { t } = useLanguage();

    if (!tournament) return null;

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-md bg-white">
                <DialogHeader>
                    <DialogTitle className="text-center flex flex-col items-center gap-4 pt-4">
                        <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center border-4 border-gray-200">
                            <Medal className="w-10 h-10 text-gray-500" />
                        </div>
                        <div className="space-y-1">
                            <h2 className="text-xl font-bold text-gray-800">
                                {t('tournament.finished_title') || "Tournoi Terminé"}
                            </h2>
                            <p className="text-gray-600">
                                {t('tournament.thank_you_playing', { name: tournament.name }) || `Merci d'avoir participé à ${tournament.name}`}
                            </p>
                        </div>
                    </DialogTitle>
                </DialogHeader>

                <div className="py-6 space-y-4">
                    <div className="text-center">
                        <span className="text-sm text-gray-500 uppercase tracking-widest">{t('profile.rank') || "Classement Final"}</span>
                        <div className="text-4xl font-black text-gray-800 mt-1">
                            #{rank}
                        </div>
                    </div>

                    <div className="grid grid-cols-3 gap-3 border-t border-gray-100 pt-4">
                        <div className="text-center">
                            <div className="text-xs text-gray-400 uppercase mb-1">{t('teams.wins') || "Victoires"}</div>
                            <div className="font-bold text-green-600">{stats?.wins || 0}</div>
                        </div>
                        <div className="text-center border-l border-gray-100">
                            <div className="text-xs text-gray-400 uppercase mb-1">{t('league.points') || "Points"}</div>
                            <div className="font-bold text-blue-600">{stats?.score || 0}</div>
                        </div>
                        <div className="text-center border-l border-gray-100">
                            <div className="text-xs text-gray-400 uppercase mb-1">{t('home.games_played') || "Parties"}</div>
                            <div className="font-bold text-gray-700">{stats?.games_played || 0}</div>
                        </div>
                    </div>
                </div>

                <DialogFooter>
                    <Button className="w-full bg-[#4a3728] hover:bg-[#2c1e12]" onClick={() => onOpenChange(false)}>
                        {t('tournament.back_list') || "Retour aux tournois"}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}