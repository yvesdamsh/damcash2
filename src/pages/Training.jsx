import React, { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Brain, Swords } from 'lucide-react';
import PuzzleMode from '@/components/training/PuzzleMode';
import FreeTrainingMode from '@/components/training/FreeTrainingMode';

export default function Training() {
    return (
        <div className="max-w-5xl mx-auto py-6 px-4 md:py-8">
            <div className="text-center mb-6 md:mb-8">
                <h1 className="text-3xl md:text-4xl font-black text-[#4a3728] mb-2">Centre d'Entraînement</h1>
                <p className="text-[#6b5138] text-sm md:text-base">Améliorez votre jeu avec des puzzles tactiques ou l'analyse libre.</p>
            </div>

            <Tabs defaultValue="puzzles" className="w-full">
                <TabsList className="grid w-full grid-cols-2 bg-[#e8dcc5] p-1 rounded-xl mb-6 md:mb-8 h-auto">
                    <TabsTrigger value="puzzles" className="data-[state=active]:bg-[#4a3728] data-[state=active]:text-[#e8dcc5] text-[#6b5138] font-bold py-2 md:py-3 text-sm md:text-lg rounded-lg transition-all whitespace-normal h-full leading-tight">
                        <div className="flex items-center justify-center gap-2">
                            <Brain className="w-4 h-4 md:w-5 md:h-5" />
                            <span>Puzzles Tactiques</span>
                        </div>
                    </TabsTrigger>
                    <TabsTrigger value="free" className="data-[state=active]:bg-[#4a3728] data-[state=active]:text-[#e8dcc5] text-[#6b5138] font-bold py-2 md:py-3 text-sm md:text-lg rounded-lg transition-all whitespace-normal h-full leading-tight">
                        <div className="flex items-center justify-center gap-2">
                            <Swords className="w-4 h-4 md:w-5 md:h-5" />
                            <span>Entraînement Libre</span>
                        </div>
                    </TabsTrigger>
                </TabsList>

                <TabsContent value="puzzles" className="animate-in fade-in duration-500">
                    <PuzzleMode />
                </TabsContent>

                <TabsContent value="free" className="animate-in fade-in duration-500">
                    <FreeTrainingMode />
                </TabsContent>
            </Tabs>
        </div>
    );
}