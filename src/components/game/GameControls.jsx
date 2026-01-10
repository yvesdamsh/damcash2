import React from 'react';
import { Button } from '@/components/ui/button';
import { Loader2, ThumbsUp, ThumbsDown, Undo2, Handshake, X, Flag, RotateCcw } from 'lucide-react';

export default function GameControls({ 
    game, 
    currentUser, 
    takebackLoading, 
    onAcceptTakeback, 
    onDeclineTakeback, 
    onRequestTakeback, 
    onAcceptDraw, 
    onDeclineDraw, 
    onOfferDraw, 
    onResign, 
    onRematch 
}) {
    if (!game) return null;

    const bothPlayersPresent = !!(game.white_player_id && game.black_player_id);
    const isPlayer = currentUser && (
        currentUser.id === game.white_player_id ||
        currentUser.id === game.black_player_id
    );
    const isPlaying = game.status === 'playing' || (game.status === 'waiting' && bothPlayersPresent);
    const isFinished = game.status === 'finished';

    return (
        <div className="flex justify-center items-center gap-2 md:gap-4 py-2 mx-2 md:mx-0">
            {isPlayer && isPlaying && (
                <>
                    {/* UNDO ACTIONS */}
                    {game.takeback_requested_by === currentUser?.id ? (
                        <Button variant="outline" size="sm" disabled className="opacity-70 h-10 px-3">
                            <Loader2 className="w-4 h-4 animate-spin" />
                        </Button>
                    ) : game.takeback_requested_by ? (
                        <div className="flex gap-1 animate-pulse">
                            <Button size="sm" className="bg-blue-600 hover:bg-blue-700 text-white h-10 px-3" onClick={onAcceptTakeback} disabled={takebackLoading}>
                                <ThumbsUp className="w-4 h-4" />
                            </Button>
                            <Button size="sm" variant="outline" className="border-red-200 text-red-600 h-10 px-3" onClick={onDeclineTakeback}>
                                <ThumbsDown className="w-4 h-4" />
                            </Button>
                        </div>
                    ) : (
                        <Button variant="outline" size="sm" className="h-10 px-3 md:px-4 bg-white/80 hover:bg-white border-[#d4c5b0] text-[#6b5138]" onClick={onRequestTakeback} title="Annuler le coup">
                            <Undo2 className="w-5 h-5 md:mr-2" /> <span className="hidden md:inline">Annuler</span>
                        </Button>
                    )}

                    {/* DRAW ACTIONS */}
                    {game.draw_offer_by === currentUser?.id ? (
                        <Button variant="outline" size="sm" disabled className="opacity-70 h-10 px-3">
                            <Loader2 className="w-4 h-4 animate-spin" />
                        </Button>
                    ) : game.draw_offer_by ? (
                        <div className="flex gap-1 animate-pulse">
                            <Button size="sm" className="bg-green-600 hover:bg-green-700 text-white h-10 px-3" onClick={onAcceptDraw}>
                                <Handshake className="w-4 h-4" />
                            </Button>
                            <Button size="sm" variant="outline" className="border-red-200 text-red-600 h-10 px-3" onClick={onDeclineDraw}>
                                <X className="w-4 h-4" />
                            </Button>
                        </div>
                    ) : (
                        <Button variant="outline" size="sm" className="h-10 px-3 md:px-4 bg-white/80 hover:bg-white border-[#d4c5b0] text-[#6b5138]" onClick={onOfferDraw} title="Proposer nulle">
                            <Handshake className="w-5 h-5 md:mr-2" /> <span className="hidden md:inline">Nulle</span>
                        </Button>
                    )}

                    {/* RESIGN */}
                    <Button variant="outline" size="sm" className="h-10 px-3 md:px-4 bg-white/80 hover:bg-red-50 border-red-200 text-red-600" onClick={onResign} title="Abandonner">
                        <Flag className="w-5 h-5 md:mr-2" /> <span className="hidden md:inline">Abandon</span>
                    </Button>
                </>
            )}
            
            {isPlayer && isFinished && (
                 <Button onClick={onRematch} className="h-10 bg-[#4a3728] hover:bg-[#2c1e12] text-[#e8dcc5] font-bold shadow-sm">
                    <RotateCcw className="w-4 h-4 mr-2" /> Rejouer
                </Button>
            )}
        </div>
    );
}