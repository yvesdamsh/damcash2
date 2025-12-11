import React, { useEffect, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { Loader2, Brain, AlertTriangle, Star, ThumbsUp, Info, Share2, TrendingUp } from 'lucide-react';
import { toast } from 'sonner';

export default function AnalysisPanel({ gameId, onJumpToMove }) {
    const [analysis, setAnalysis] = useState(null);
    const [loading, setLoading] = useState(false);
    const [sharing, setSharing] = useState(false);

    const fetchAnalysis = async () => {
        setLoading(true);
        try {
            const res = await base44.functions.invoke('analyzeGame', { gameId });
            setAnalysis(res.data);
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    const handleShare = async () => {
        setSharing(true);
        try {
            // 1. Create Forum Post
            const user = await base44.auth.me();
            if (!user) {
                toast.error("Connectez-vous pour partager");
                return;
            }

            const gameUrl = `${window.location.origin}/Game?id=${gameId}`;
            const data = analysis.analysis_data ? JSON.parse(analysis.analysis_data) : {};
            const opening = data.opening_name || "Partie";
            
            await base44.entities.ForumPost.create({
                author_id: user.id,
                author_name: user.full_name || user.username,
                author_avatar: user.avatar_url,
                content: `J'ai analysé ma partie "${opening}" ! \n\nRésumé IA: ${analysis.summary}\n\nPrécision: Blancs ${data.white_accuracy || '?'}% - Noirs ${data.black_accuracy || '?'}% \n\nRevoir la partie: ${gameUrl}`,
                likes: 0,
                liked_by: []
            });

            toast.success("Analyse partagée sur le forum !");
        } catch (e) {
            toast.error("Erreur lors du partage");
        } finally {
            setSharing(false);
        }
    };

    if (loading) {
        return (
            <div className="h-full flex flex-col items-center justify-center p-6 text-[#6b5138] space-y-4">
                <Loader2 className="w-8 h-8 animate-spin" />
                <p className="text-sm font-medium text-center">L'IA analyse votre partie...<br/>Recherche des coups brillants et des erreurs.</p>
            </div>
        );
    }

    if (!analysis) {
        return (
            <div className="h-full flex flex-col items-center justify-center p-6 text-center">
                <Brain className="w-12 h-12 text-[#d4c5b0] mb-4" />
                <h3 className="font-bold text-[#4a3728] mb-2">Analyse IA</h3>
                <p className="text-sm text-gray-500 mb-4">Obtenez un résumé détaillé, votre précision et vos erreurs clés.</p>
                <Button onClick={fetchAnalysis} className="bg-[#4a3728] hover:bg-[#2c1e12]">
                    Lancer l'analyse
                </Button>
            </div>
        );
    }

    const data = analysis.analysis_data ? JSON.parse(analysis.analysis_data) : {};
    // Backward compatibility check
    const moments = Array.isArray(data) ? data : (data.key_moments || []); 
    const whiteAcc = data.white_accuracy;
    const blackAcc = data.black_accuracy;
    const opening = data.opening_name;
    const openingAdvice = data.opening_advice;

    const getIcon = (type) => {
        switch(type) {
            case 'brilliant': return <Star className="w-4 h-4 text-yellow-500" />;
            case 'blunder': return <AlertTriangle className="w-4 h-4 text-red-600" />;
            case 'mistake': return <AlertTriangle className="w-4 h-4 text-orange-500" />;
            case 'good': return <ThumbsUp className="w-4 h-4 text-green-500" />;
            default: return <Info className="w-4 h-4 text-blue-500" />;
        }
    };

    return (
        <div className="h-full flex flex-col bg-white rounded-lg shadow-sm border border-[#d4c5b0]">
            <div className="p-3 bg-[#f5f0e6] border-b border-[#d4c5b0] flex justify-between items-center">
                <h3 className="font-bold text-[#4a3728] flex items-center gap-2">
                    <Brain className="w-4 h-4" /> Rapport d'Analyse
                </h3>
                <Button size="sm" variant="ghost" onClick={handleShare} disabled={sharing} className="h-6 text-xs gap-1 hover:bg-[#e8dcc5]">
                    <Share2 className="w-3 h-3" /> Partager
                </Button>
            </div>
            <ScrollArea className="flex-1 p-4">
                <div className="mb-6 bg-blue-50 p-3 rounded-lg border border-blue-100">
                    <h4 className="text-xs font-bold text-blue-800 uppercase mb-1">Résumé de la Partie</h4>
                    <p className="text-sm text-blue-900 leading-relaxed">{analysis.summary}</p>
                </div>

                {whiteAcc !== undefined && (
                    <div className="mb-6 grid grid-cols-2 gap-4">
                        <div className="bg-gray-50 p-2 rounded border border-gray-200 text-center">
                            <div className="text-xs text-gray-500 uppercase mb-1">Précision Blancs</div>
                            <div className={`text-xl font-black ${whiteAcc > 80 ? 'text-green-600' : 'text-gray-800'}`}>
                                {whiteAcc}%
                            </div>
                        </div>
                        <div className="bg-gray-900 p-2 rounded border border-gray-800 text-center">
                            <div className="text-xs text-gray-400 uppercase mb-1">Précision Noirs</div>
                            <div className={`text-xl font-black ${blackAcc > 80 ? 'text-green-400' : 'text-white'}`}>
                                {blackAcc}%
                            </div>
                        </div>
                    </div>
                )}

                {(opening || openingAdvice) && (
                    <div className="mb-6 bg-amber-50 p-3 rounded-lg border border-amber-100">
                        <div className="flex items-center gap-2 text-sm text-gray-600 mb-2">
                            <TrendingUp className="w-4 h-4 text-amber-600" />
                            Ouverture: <span className="font-bold text-[#4a3728]">{opening || 'Inconnue'}</span>
                        </div>
                        {openingAdvice && (
                            <div className="text-sm text-amber-900 bg-amber-100/50 p-2 rounded">
                                <span className="font-bold">Conseil:</span> {openingAdvice}
                            </div>
                        )}
                    </div>
                )}

                <h4 className="text-xs font-bold text-[#6b5138] uppercase mb-3">Coups Clés & Opportunités</h4>
                <div className="space-y-3">
                    {moments.length === 0 ? (
                        <p className="text-sm text-gray-500 italic">Aucun moment clé détecté.</p>
                    ) : moments.map((moment, i) => (
                        <div 
                            key={i} 
                            onClick={() => onJumpToMove(moment.move_index)}
                            className={`p-3 rounded-lg border hover:shadow-md cursor-pointer transition-all ${moment.type === 'blunder' ? 'bg-red-50 border-red-100' : 'bg-white border-gray-100 hover:border-[#d4c5b0]'}`}
                        >
                            <div className="flex items-center gap-2 mb-1">
                                {getIcon(moment.type)}
                                <span className={`text-xs font-bold uppercase ${moment.type === 'blunder' ? 'text-red-600' : 'text-gray-600'}`}>{moment.type}</span>
                                <span className="text-xs text-gray-400 ml-auto">Coup #{moment.move_index + 1}</span>
                            </div>
                            <p className="text-sm text-gray-700 mb-2">{moment.comment}</p>
                            {moment.better_move && (
                                <div className="flex items-center gap-2 mt-1">
                                    <div className="text-xs font-bold text-gray-500">Meilleur coup:</div>
                                    <div className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded border border-green-200 font-mono font-bold flex items-center gap-1">
                                        <TrendingUp className="w-3 h-3" /> {moment.better_move}
                                    </div>
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            </ScrollArea>
        </div>
    );
}