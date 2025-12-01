import React, { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Brain, Swords, BarChart2, Search } from 'lucide-react';
import PuzzleMode from '@/components/training/PuzzleMode';
import FreeTrainingMode from '@/components/training/FreeTrainingMode';
import AnalysisMode from '@/components/training/AnalysisMode';
import PerformanceStats from '@/components/training/PerformanceStats';

export default function Training() {
    return (
        <div className="max-w-6xl mx-auto py-6 px-4 md:py-8">
            <div className="text-center mb-6 md:mb-8">
                <h1 className="text-3xl md:text-4xl font-black text-[#4a3728] mb-2">Centre d'Entraînement</h1>
                <p className="text-[#6b5138] text-sm md:text-base">Améliorez votre jeu, analysez vos parties et suivez vos progrès.</p>
            </div>

            <Tabs defaultValue="puzzles" className="w-full">
                <TabsList className="grid w-full grid-cols-4 bg-[#e8dcc5] p-1 rounded-xl mb-6 md:mb-8 h-auto">
                    <TabsTrigger value="puzzles" className="data-[state=active]:bg-[#4a3728] data-[state=active]:text-[#e8dcc5] text-[#6b5138] font-bold py-2 md:py-3 text-xs md:text-sm rounded-lg transition-all whitespace-normal h-full leading-tight">
                        <div className="flex flex-col md:flex-row items-center justify-center gap-1 md:gap-2">
                            <Brain className="w-4 h-4" />
                            <span>Puzzles</span>
                        </div>
                    </TabsTrigger>
                    <TabsTrigger value="free" className="data-[state=active]:bg-[#4a3728] data-[state=active]:text-[#e8dcc5] text-[#6b5138] font-bold py-2 md:py-3 text-xs md:text-sm rounded-lg transition-all whitespace-normal h-full leading-tight">
                        <div className="flex flex-col md:flex-row items-center justify-center gap-1 md:gap-2">
                            <Swords className="w-4 h-4" />
                            <span>Libre</span>
                        </div>
                    </TabsTrigger>
                    <TabsTrigger value="analysis" className="data-[state=active]:bg-[#4a3728] data-[state=active]:text-[#e8dcc5] text-[#6b5138] font-bold py-2 md:py-3 text-xs md:text-sm rounded-lg transition-all whitespace-normal h-full leading-tight">
                        <div className="flex flex-col md:flex-row items-center justify-center gap-1 md:gap-2">
                            <Search className="w-4 h-4" />
                            <span>Analyse</span>
                        </div>
                    </TabsTrigger>
                    <TabsTrigger value="stats" className="data-[state=active]:bg-[#4a3728] data-[state=active]:text-[#e8dcc5] text-[#6b5138] font-bold py-2 md:py-3 text-xs md:text-sm rounded-lg transition-all whitespace-normal h-full leading-tight">
                        <div className="flex flex-col md:flex-row items-center justify-center gap-1 md:gap-2">
                            <BarChart2 className="w-4 h-4" />
                            <span>Stats</span>
                        </div>
                    </TabsTrigger>
                </TabsList>

                <TabsContent value="puzzles" className="animate-in fade-in duration-500">
                    <PuzzleMode />
                </TabsContent>

                <TabsContent value="free" className="animate-in fade-in duration-500">
                    <FreeTrainingMode />
                </TabsContent>

                <TabsContent value="analysis" className="animate-in fade-in duration-500">
                    <AnalysisMode />
                </TabsContent>

                <TabsContent value="stats" className="animate-in fade-in duration-500">
                    <PerformanceStats />
                </TabsContent>
            </Tabs>
        </div>
    );
}