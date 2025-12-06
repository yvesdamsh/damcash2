import React from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { ArrowRight, Clock, User, AlertCircle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useLanguage } from '@/components/LanguageContext';

export default function RejoinGameDialog({ games, open, onOpenChange, currentUser }) {
    const navigate = useNavigate();
    const { t } = useLanguage();

    if (!games || games.length === 0) return null;

    const isMyTurn = (game) => {
        if (!currentUser) return false;
        if (game.current_turn === 'white' && game.white_player_id === currentUser.id) return true;
        if (game.current_turn === 'black' && game.black_player_id === currentUser.id) return true;
        return false;
    };

    // Sort: My turn first
    const sortedGames = [...games].sort((a, b) => {
        const aMyTurn = isMyTurn(a);
        const bMyTurn = isMyTurn(b);
        if (aMyTurn && !bMyTurn) return -1;
        if (!aMyTurn && bMyTurn) return 1;
        return new Date(b.updated_date) - new Date(a.updated_date);
    });

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
                
                <div className="space-y-3 mt-2 max-h-[60vh] overflow-y-auto pr-1">
                    {sortedGames.map(game => {
                        const myTurn = isMyTurn(game);
                        return (
                            <div 
                                key={game.id} 
                                className={`flex items-center justify-between p-3 border rounded-lg shadow-sm transition-all cursor-pointer group ${
                                    myTurn 
                                        ? 'bg-amber-50 border-amber-500/50 shadow-md ring-1 ring-amber-500/20' 
                                        : 'bg-white border-[#d4c5b0] hover:border-[#4a3728]'
                                }`}
                                onClick={() => navigate(`/Game?id=${game.id}`)}
                            >
                                <div className="flex flex-col">
                                    <span className="font-bold text-[#4a3728] text-sm flex items-center gap-2">
                                        {game.game_type === 'chess' ? '♟️ Chess' : '⚪ Checkers'}
                                        {myTurn && (
                                            <Badge className="bg-amber-600 hover:bg-amber-700 text-[10px] px-1.5 py-0 h-5">
                                                <AlertCircle className="w-3 h-3 mr-1" />
                                                {t('game.your_turn') || "À toi !"}
                                            </Badge>
                                        )}
                                    </span>
                                    <span className="text-xs text-[#6b5138] flex items-center gap-1 mt-1">
                                        <User className="w-3 h-3" />
                                        {currentUser && game.white_player_id === currentUser.id 
                                            ? `vs ${game.black_player_name}` 
                                            : (currentUser && game.black_player_id === currentUser.id 
                                                ? `vs ${game.white_player_name}` 
                                                : `${game.white_player_name} vs ${game.black_player_name}`)
                                        }
                                        <span className="text-gray-400 font-normal text-xs ml-2">#{game.access_code || game.id.substring(0, 4)}</span>
                                    </span>
                                </div>
                                <Button size="sm" className={myTurn ? "bg-amber-600 hover:bg-amber-700 text-white" : "bg-[#4a3728] hover:bg-[#2c1e12] text-[#e8dcc5]"}>
                                    {myTurn ? (t('common.play') || "Jouer") : (t('common.watch') || "Voir")} <ArrowRight className="w-4 h-4 ml-1" />
                                </Button>
                            </div>
                        );
                    })}
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