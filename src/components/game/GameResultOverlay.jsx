import React from 'react';
import { Button } from '@/components/ui/button';
import { RotateCcw, X, Trophy, Handshake } from 'lucide-react';
import { motion } from 'framer-motion';
import { useLanguage } from '@/components/LanguageContext';

export default function GameResultOverlay({ 
    game, 
    currentUser, 
    onClose, 
    onRematch, 
    onHome 
}) {
    const { t } = useLanguage();
    if (!game) return null;

    const isSpectator = currentUser?.id !== game.white_player_id && currentUser?.id !== game.black_player_id;
    const isWinner = !isSpectator && game.winner_id === currentUser?.id;
    const isLoser = !isSpectator && game.winner_id && game.winner_id !== currentUser?.id;
    const isDraw = !game.winner_id;

    // Calculate Series Status
    const seriesLength = game.series_length || 1;
    const currentWhiteScore = (game.series_score_white || 0) + (game.winner_id === game.white_player_id ? 1 : game.winner_id ? 0 : 0.5);
    const currentBlackScore = (game.series_score_black || 0) + (game.winner_id === game.black_player_id ? 1 : game.winner_id ? 0 : 0.5);
    
    const isSeriesDecided = currentWhiteScore > seriesLength / 2 || currentBlackScore > seriesLength / 2 || (currentWhiteScore + currentBlackScore >= seriesLength);
    
    const isWhite = currentUser?.id === game.white_player_id;
    const myScore = isWhite ? currentWhiteScore : currentBlackScore;
    const opponentScore = isWhite ? currentBlackScore : currentWhiteScore;
    
    // Leave/Close Logic
    // Spectators can always leave.
    // Players: "Only the trailing player can forfeit the series" (if not decided)
    const canForfeit = isSeriesDecided || (myScore < opponentScore);
    const showCloseButton = isSpectator || canForfeit || isWinner; // Winner can close to view board, but maybe not forfeit button

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
                            <h2 className="text-4xl font-black text-[#4a3728] mb-2">{t('game.result.victory')}</h2>
                            <p className="text-[#6b5138] font-medium">{t('game.result.victory_desc')}</p>
                        </>
                    ) : isLoser ? (
                        <>
                            <X className="w-20 h-20 mx-auto text-red-400 mb-4" />
                            <h2 className="text-4xl font-black text-[#4a3728] mb-2">{t('game.result.defeat')}</h2>
                            <p className="text-[#6b5138] font-medium">{t('game.result.defeat_desc')}</p>
                        </>
                    ) : isSpectator ? (
                        <>
                            {game.winner_id ? <Trophy className="w-20 h-20 mx-auto text-yellow-500 mb-4" /> : <Handshake className="w-20 h-20 mx-auto text-blue-400 mb-4" />}
                            <h2 className="text-4xl font-black text-[#4a3728] mb-2">{game.winner_id ? (game.winner_id === game.white_player_id ? "VICTOIRE BLANCS" : "VICTOIRE NOIRS") : t('game.result.draw')}</h2>
                            <p className="text-[#6b5138] font-medium">Partie terminée</p>
                        </>
                    ) : (
                        <>
                            <Handshake className="w-20 h-20 mx-auto text-blue-400 mb-4" />
                            <h2 className="text-4xl font-black text-[#4a3728] mb-2">{t('game.result.draw')}</h2>
                            <p className="text-[#6b5138] font-medium">{t('game.result.draw_desc')}</p>
                        </>
                    )}
                </div>

                {(game.series_length || 1) > 1 && (
                    <div className="bg-[#f5f0e6] rounded-lg p-4 mb-6 border border-[#d4c5b0]">
                        <h3 className="font-bold text-[#4a3728] mb-2 text-sm uppercase tracking-widest">{t('game.result.series_score')}</h3>
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
                        <p className="text-xs text-gray-500 mt-2">{t('game.result.best_of')} {game.series_length}</p>
                    </div>
                )}

                {showCloseButton && (
                    <button 
                        onClick={onClose}
                        className="absolute top-4 right-4 p-2 text-[#4a3728] hover:bg-black/5 rounded-full transition-colors"
                        title="Fermer et analyser"
                    >
                        <X className="w-6 h-6" />
                    </button>
                )}

                <div className="space-y-3">
                    {!isSpectator && (
                        <Button onClick={onRematch} className="w-full bg-[#4a3728] hover:bg-[#2c1e12] text-[#e8dcc5] h-12 text-lg font-bold shadow-lg">
                            <RotateCcw className="w-5 h-5 mr-2" /> {(game.series_length > 1 && !isSeriesDecided) ? t('game.result.next_round_mandatory') : t('game.result.rematch')}
                        </Button>
                    )}
                    
                    {(canForfeit || isSpectator) && (
                        <Button variant="outline" onClick={onHome} className="w-full border-[#d4c5b0] text-[#6b5138] hover:bg-[#f5f0e6]">
                            {!isSeriesDecided && !isSpectator ? t('game.result.forfeit_series') : t('game.result.back_home')}
                        </Button>
                    )}
                    
                    {!canForfeit && !isSpectator && (
                        <p className="text-xs text-gray-500 italic mt-2">
                            {t('game.result.cannot_leave_msg')}
                        </p>
                    )}
                </div>
            </motion.div>
        </motion.div>
    );
}