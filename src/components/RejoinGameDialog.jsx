import React from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { ArrowRight, Clock, User } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useLanguage } from '@/components/LanguageContext';

export default function RejoinGameDialog({ games, open, onOpenChange }) {
    const navigate = useNavigate();
    const { t } = useLanguage();

    if (!games || games.length === 0) return null;

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-md bg-[#fdfbf7] border-[#d4c5b0]">
                <DialogHeader>
                    <DialogTitle className="text-[#4a3728] flex items-center gap-2">
                        <Clock className="w-5 h-5" />
                        {t('home.active_games_title') || "Parties en cours"}
                    </DialogTitle>
                    <DialogDescription>
                        {t('home.active_games_desc') || "Vous avez des parties en cours. Voulez-vous les rejoindre ?"}
                    </DialogDescription>
                </DialogHeader>
                
                <div className="space-y-3 mt-2">
                    {games.map(game => (
                        <div 
                            key={game.id} 
                            className="flex items-center justify-between p-3 bg-white border border-[#d4c5b0] rounded-lg shadow-sm hover:border-[#4a3728] transition-colors cursor-pointer group"
                            onClick={() => navigate(`/Game?id=${game.id}`)}
                        >
                            <div className="flex flex-col">
                                <span className="font-bold text-[#4a3728] text-sm flex items-center gap-2">
                                    {game.game_type === 'chess' ? '♟️ Chess' : '⚪ Checkers'}
                                    <span className="text-gray-400 font-normal text-xs">#{game.access_code || game.id.substring(0, 4)}</span>
                                </span>
                                <span className="text-xs text-[#6b5138] flex items-center gap-1 mt-1">
                                    <User className="w-3 h-3" />
                                    vs {game.white_player_name === 'Vous' ? game.black_player_name : game.white_player_name}
                                </span>
                            </div>
                            <Button size="sm" className="bg-[#4a3728] hover:bg-[#2c1e12] text-[#e8dcc5]">
                                {t('common.join') || "Rejoindre"} <ArrowRight className="w-4 h-4 ml-1" />
                            </Button>
                        </div>
                    ))}
                </div>
                
                <div className="flex justify-end mt-2">
                    <Button variant="ghost" onClick={() => onOpenChange(false)} className="text-gray-500 hover:text-[#4a3728]">
                        {t('common.dismiss') || "Plus tard"}
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    );
}