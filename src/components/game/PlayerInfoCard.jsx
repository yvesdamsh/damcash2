import React from 'react';
import { User, Trophy } from 'lucide-react';
import GameTimer from '@/components/GameTimer';

export default function PlayerInfoCard({ 
    player, 
    game, 
    isSoloMode, 
    onTimeout,
    getElo 
}) {
    const displayName = player?.info?.username || player?.name || (player?.color === 'white' ? 'Blanc' : 'Noir');
    const isWaiting = !player?.id || !player?.name;
    return (
        <div className="flex justify-between items-center p-3 bg-white/90 shadow-sm rounded-xl border border-[#d4c5b0] mx-2 md:mx-0 mt-2 md:mt-0">
            <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-gray-200 rounded-full flex items-center justify-center text-gray-500 overflow-hidden">
                    {player.info?.avatar_url ? (
                        <img src={player.info.avatar_url} className="w-full h-full object-cover" alt={displayName} />
                    ) : (
                        <User className="w-6 h-6" />
                    )}
                </div>
                <div>
                    <div className="font-bold text-gray-800 flex items-center gap-2 text-sm md:text-base">
                        {isWaiting ? (
                            <span className="text-gray-400 italic">En attente...</span>
                        ) : (
                            <>
                                {displayName}
                                <span className="text-xs bg-gray-200 px-1.5 py-0.5 rounded text-gray-600">
                                    {getElo ? getElo(player.info, game.game_type) : (player.info?.elo || 1200)}
                                </span>
                            </>
                        )}
                    </div>
                    {game.winner_id === player.id && !isSoloMode && (
                        <span className="text-green-600 text-xs font-bold flex items-center">
                            <Trophy className="w-3 h-3 mr-1"/> Vainqueur
                        </span>
                    )}
                </div>
            </div>
            <GameTimer 
                key={`timer-${game.id}-${player.color}`}
                initialSeconds={player.timeLeft} 
                isActive={game.status === 'playing' && game.current_turn === player.color && !!game.last_move_at}
                onTimeout={() => onTimeout(player.color)}
            />
        </div>
    );
}