import React, { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Brain, Swords } from 'lucide-react';
import PuzzleMode from '@/components/training/PuzzleMode';
import FreeTrainingMode from '@/components/training/FreeTrainingMode';

export default function Training() {
    return (
        <div className="max-w-5xl mx-auto py-8 px-4">
            <div className="text-center mb-8">
                <h1 className="text-4xl font-black text-[#4a3728] mb-2">Centre d'Entraînement</h1>
                <p className="text-[#6b5138]">Améliorez votre jeu avec des puzzles tactiques ou l'analyse libre.</p>
            </div>

            <Tabs defaultValue="puzzles" className="w-full">
                <TabsList className="grid w-full grid-cols-2 bg-[#e8dcc5] p-1 rounded-xl mb-8">
                    <TabsTrigger value="puzzles" className="data-[state=active]:bg-[#4a3728] data-[state=active]:text-[#e8dcc5] text-[#6b5138] font-bold py-3 text-lg rounded-lg transition-all">
                        <Brain className="w-5 h-5 mr-2" /> Puzzles Tactiques
                    </TabsTrigger>
                    <TabsTrigger value="free" className="data-[state=active]:bg-[#4a3728] data-[state=active]:text-[#e8dcc5] text-[#6b5138] font-bold py-3 text-lg rounded-lg transition-all">
                        <Swords className="w-5 h-5 mr-2" /> Entraînement Libre
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