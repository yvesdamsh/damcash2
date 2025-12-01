import React, { useEffect, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { Loader2, Brain, AlertTriangle, Star, ThumbsUp, Info } from 'lucide-react';

export default function AnalysisPanel({ gameId, onJumpToMove }) {
    const [analysis, setAnalysis] = useState(null);
    const [loading, setLoading] = useState(false);

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
                <p className="text-sm text-gray-500 mb-4">Obtenez un résumé détaillé et découvrez vos erreurs clés.</p>
                <Button onClick={fetchAnalysis} className="bg-[#4a3728] hover:bg-[#2c1e12]">
                    Lancer l'analyse
                </Button>
            </div>
        );
    }

    const moments = analysis.analysis_data ? JSON.parse(analysis.analysis_data) : [];

    const getIcon = (type) => {
        switch(type) {
            case 'brilliant': return <Star className="w-4 h-4 text-yellow-500" />;
            case 'blunder': return <AlertTriangle className="w-4 h-4 text-red-500" />;
            case 'mistake': return <AlertTriangle className="w-4 h-4 text-orange-500" />;
            case 'good': return <ThumbsUp className="w-4 h-4 text-green-500" />;
            default: return <Info className="w-4 h-4 text-blue-500" />;
        }
    };

    return (
        <div className="h-full flex flex-col bg-white rounded-lg shadow-sm border border-[#d4c5b0]">
            <div className="p-3 bg-[#f5f0e6] border-b border-[#d4c5b0]">
                <h3 className="font-bold text-[#4a3728] flex items-center gap-2">
                    <Brain className="w-4 h-4" /> Rapport d'analyse
                </h3>
            </div>
            <ScrollArea className="flex-1 p-4">
                <div className="mb-6 bg-blue-50 p-3 rounded-lg border border-blue-100">
                    <h4 className="text-xs font-bold text-blue-800 uppercase mb-1">Résumé</h4>
                    <p className="text-sm text-blue-900 leading-relaxed">{analysis.summary}</p>
                </div>

                <h4 className="text-xs font-bold text-[#6b5138] uppercase mb-3">Moments Clés</h4>
                <div className="space-y-3">
                    {moments.map((moment, i) => (
                        <div 
                            key={i} 
                            onClick={() => onJumpToMove(moment.move_index)}
                            className="p-3 rounded-lg border hover:shadow-md cursor-pointer transition-all bg-white border-gray-100 hover:border-[#d4c5b0]"
                        >
                            <div className="flex items-center gap-2 mb-1">
                                {getIcon(moment.type)}
                                <span className="text-xs font-bold uppercase text-gray-600">{moment.type}</span>
                                <span className="text-xs text-gray-400 ml-auto">Coup #{moment.move_index + 1}</span>
                            </div>
                            <p className="text-sm text-gray-700">{moment.comment}</p>
                        </div>
                    ))}
                </div>
            </ScrollArea>
        </div>
    );
}