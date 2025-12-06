import React from 'react';
import { Button } from '@/components/ui/button';
import { RotateCcw, X, Trophy, Handshake } from 'lucide-react';
import { motion } from 'framer-motion';

export default function GameResultOverlay({ 
    game, 
    currentUser, 
    onClose, 
    onRematch, 
    onHome 
}) {
    if (!game) return null;

    const isWinner = game.winner_id === currentUser?.id;
    const isLoser = game.winner_id && game.winner_id !== currentUser?.id;
    const isDraw = !game.winner_id;

    return (
        <motion.div 
            initial={{ opacity: 0 }} 
            animate={{ opacity: 1 }} 
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
        >
            <motion.div 
                initial={{ scale: 0.8, y: 20 }}
                animate={{ scale: 1, y: 0 }}
                className="bg-[#fdfbf7] border-4 border-[#4a3728] rounded-2xl p-8 max-w-md w-full text-center shadow-2xl relative overflow-hidden"
            >
                <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-[#4a3728] via-[#b8860b] to-[#4a3728]" />
                
                <div className="mb-6">
                    {isWinner ? (
                        <>
                            <Trophy className="w-20 h-20 mx-auto text-yellow-500 mb-4 animate-bounce" />
                            <h2 className="text-4xl font-black text-[#4a3728] mb-2">VICTOIRE !</h2>
                            <p className="text-[#6b5138] font-medium">Magnifique performance !</p>
                        </>
                    ) : isLoser ? (
                        <>
                            <X className="w-20 h-20 mx-auto text-red-400 mb-4" />
                            <h2 className="text-4xl font-black text-[#4a3728] mb-2">DÉFAITE</h2>
                            <p className="text-[#6b5138] font-medium">Bien essayé, la prochaine sera la bonne.</p>
                        </>
                    ) : (
                        <>
                            <Handshake className="w-20 h-20 mx-auto text-blue-400 mb-4" />
                            <h2 className="text-4xl font-black text-[#4a3728] mb-2">MATCH NUL</h2>
                            <p className="text-[#6b5138] font-medium">Une bataille très serrée.</p>
                        </>
                    )}
                </div>

                {(game.series_length || 1) > 1 && (
                    <div className="bg-[#f5f0e6] rounded-lg p-4 mb-6 border border-[#d4c5b0]">
                        <h3 className="font-bold text-[#4a3728] mb-2 text-sm uppercase tracking-widest">Score de la série</h3>
                        <div className="flex justify-center items-center gap-6 text-2xl font-black">
                            <div className="flex flex-col items-center">
                                <span className="text-sm font-normal text-gray-500 mb-1">{game.white_player_name}</span>
                                <span className={game.winner_id === game.white_player_id ? "text-green-600" : "text-[#4a3728]"}>
                                    {(game.series_score_white || 0) + (game.winner_id === game.white_player_id ? 1 : game.winner_id ? 0 : 0.5)}
                                </span>
                            </div>
                            <span className="text-gray-300">-</span>
                            <div className="flex flex-col items-center">
                                <span className="text-sm font-normal text-gray-500 mb-1">{game.black_player_name}</span>
                                <span className={game.winner_id === game.black_player_id ? "text-green-600" : "text-[#4a3728]"}>
                                    {(game.series_score_black || 0) + (game.winner_id === game.black_player_id ? 1 : game.winner_id ? 0 : 0.5)}
                                </span>
                            </div>
                        </div>
                        <p className="text-xs text-gray-500 mt-2">Best of {game.series_length}</p>
                    </div>
                )}

                <button 
                    onClick={onClose}
                    className="absolute top-4 right-4 p-2 text-[#4a3728] hover:bg-black/5 rounded-full transition-colors"
                    title="Fermer et analyser"
                >
                    <X className="w-6 h-6" />
                </button>

                <div className="space-y-3">
                    <Button onClick={onRematch} className="w-full bg-[#4a3728] hover:bg-[#2c1e12] text-[#e8dcc5] h-12 text-lg font-bold shadow-lg">
                        <RotateCcw className="w-5 h-5 mr-2" /> {(game.series_length > 1) ? "Manche Suivante" : "Rejouer"}
                    </Button>
                    
                    <Button variant="outline" onClick={onHome} className="w-full border-[#d4c5b0] text-[#6b5138] hover:bg-[#f5f0e6]">
                        Retour à l'accueil
                    </Button>
                </div>
            </motion.div>
        </motion.div>
    );
}