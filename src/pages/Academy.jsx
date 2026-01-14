import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useLanguage } from '@/components/LanguageContext';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { BookOpen, Puzzle, Swords, Brain, CheckCircle2, ChevronRight, Lock, Search, BarChart2 } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import PuzzleMode from '@/components/training/PuzzleMode';
import FreeTrainingMode from '@/components/training/FreeTrainingMode';
import AnalysisMode from '@/components/training/AnalysisMode';
import PerformanceStats from '@/components/training/PerformanceStats';

export default function Academy() {
    const { t, language } = useLanguage();
    const navigate = useNavigate();
    const [lessons, setLessons] = useState([]);
    const [puzzles, setPuzzles] = useState([]);
    const [activeTab, setActiveTab] = useState('lessons');
    const [gameType, setGameType] = useState(() => {
        try { return localStorage.getItem('gameMode') || 'checkers'; } catch (_) { return 'checkers'; }
    });

    useEffect(() => {
        const fetchContent = async () => {
            try {
                // Fetch lessons
                const allLessons = await base44.entities.Lesson.filter({ game_type: gameType });
                setLessons(allLessons.sort((a,b) => (a.order || 0) - (b.order || 0)));
                
                // Fetch puzzles (sample)
                const allPuzzles = await base44.entities.Puzzle.filter({ game_type: gameType }, {}, 10);
                setPuzzles(allPuzzles);
            } catch (e) {
                console.error("Academy fetch error", e);
            }
        };
        fetchContent();
    }, [gameType]);

    // Sync with global game mode changes
    useEffect(() => {
        const handler = () => {
            try {
                const mode = localStorage.getItem('gameMode');
                if (mode && mode !== gameType) setGameType(mode);
            } catch (_) {}
        };
        window.addEventListener('gameModeChanged', handler);
        return () => window.removeEventListener('gameModeChanged', handler);
    }, [gameType]);

    return (
        <div className="max-w-6xl mx-auto p-6">
            <div className="text-center mb-10">
                <h1 className="text-4xl font-bold text-[#4a3728] mb-2 flex items-center justify-center gap-3">
                    <Brain className="w-10 h-10" /> {t('academy.title')}
                </h1>
                <p className="text-[#6b5138]">{t('academy.subtitle')}</p>
            </div>

            <div className="flex justify-center mb-8">
                <div className="bg-[#e8dcc5] p-1 rounded-full flex gap-1">
                    <button 
                        onClick={() => { setGameType('checkers'); try { localStorage.setItem('gameMode','checkers'); } catch (_) {} window.dispatchEvent(new Event('gameModeChanged')); }}
                        className={`px-6 py-2 rounded-full font-bold transition-all ${gameType === 'checkers' ? 'bg-[#4a3728] text-[#e8dcc5]' : 'text-[#4a3728] hover:bg-[#d4c5b0]'}`}
                    >
                        ⚪ {t('game.checkers')}
                    </button>
                    <button 
                        onClick={() => { setGameType('chess'); try { localStorage.setItem('gameMode','chess'); } catch (_) {} window.dispatchEvent(new Event('gameModeChanged')); }}
                        className={`px-6 py-2 rounded-full font-bold transition-all ${gameType === 'chess' ? 'bg-[#4a3728] text-[#e8dcc5]' : 'text-[#4a3728] hover:bg-[#d4c5b0]'}`}
                    >
                        ♟️ {t('game.chess')}
                    </button>
                </div>
            </div>

            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                <TabsList className="grid w-full grid-cols-6 bg-[#e8dcc5]">
                    <TabsTrigger value="lessons" className="data-[state=active]:bg-[#4a3728] data-[state=active]:text-[#e8dcc5]">
                        <BookOpen className="w-4 h-4 mr-2" /> {t('academy.lessons')}
                    </TabsTrigger>
                    <TabsTrigger value="puzzles" className="data-[state=active]:bg-[#4a3728] data-[state=active]:text-[#e8dcc5]">
                        <Puzzle className="w-4 h-4 mr-2" /> {t('academy.puzzles')}
                    </TabsTrigger>
                    <TabsTrigger value="practice" className="data-[state=active]:bg-[#4a3728] data-[state=active]:text-[#e8dcc5]">
                        <Swords className="w-4 h-4 mr-2" /> {t('academy.practice')}
                    </TabsTrigger>
                    <TabsTrigger value="free" className="data-[state=active]:bg-[#4a3728] data-[state=active]:text-[#e8dcc5]">
                        <Brain className="w-4 h-4 mr-2" /> {t('academy.free_training') || 'Free Training'}
                    </TabsTrigger>
                    <TabsTrigger value="analysis" className="data-[state=active]:bg-[#4a3728] data-[state=active]:text-[#e8dcc5]">
                        <Search className="w-4 h-4 mr-2" /> {t('tv.review')}
                    </TabsTrigger>
                    <TabsTrigger value="stats" className="data-[state=active]:bg-[#4a3728] data-[state=active]:text-[#e8dcc5]">
                        <BarChart2 className="w-4 h-4 mr-2" /> Stats
                    </TabsTrigger>
                </TabsList>

                <TabsContent value="lessons" className="mt-6 space-y-6">
                    <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {lessons.length > 0 ? lessons.map(lesson => (
                            <Card key={lesson.id} className="border-[#d4c5b0] hover:shadow-lg transition-shadow bg-white">
                                <CardHeader>
                                    <div className="flex justify-between items-start mb-2">
                                        <Badge variant="secondary" className="bg-[#f0e6d2] text-[#6b5138] capitalize">
                                            {lesson.difficulty}
                                        </Badge>
                                        <Badge variant="outline" className="border-[#d4c5b0] text-[#8c7b6a] capitalize">
                                            {lesson.category}
                                        </Badge>
                                    </div>
                                    <CardTitle className="text-[#4a3728]">{lesson.title}</CardTitle>
                                    <CardDescription className="line-clamp-2">{lesson.description}</CardDescription>
                                </CardHeader>
                                <CardContent>
                                    <Button className="w-full bg-[#4a3728] hover:bg-[#2c1e12]" onClick={() => navigate(`/Lesson?id=${lesson.id}`)}>
                                        {t('academy.start_lesson')} <ChevronRight className="w-4 h-4 ml-2" />
                                    </Button>
                                </CardContent>
                            </Card>
                        )) : (
                            <div className="col-span-full text-center py-12 text-gray-500">
                                <BookOpen className="w-12 h-12 mx-auto mb-4 opacity-20" />
                                <p>{t('academy.no_lessons')}</p>
                            </div>
                        )}
                    </div>
                </TabsContent>

                <TabsContent value="puzzles" className="mt-6">
                    <PuzzleMode />
                </TabsContent>

                <TabsContent value="practice" className="mt-6">
                    <div className="grid md:grid-cols-2 gap-6">
                        <Card className="border-[#d4c5b0] bg-gradient-to-br from-[#fdfbf7] to-[#f0e6d2]">
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2"><Swords className="w-5 h-5" /> {t('academy.endgames_title')}</CardTitle>
                                <CardDescription>{t('academy.endgames_desc')}</CardDescription>
                            </CardHeader>
                            <CardContent>
                                <Button className="w-full bg-[#4a3728]" onClick={() => navigate(`/Practice/Endgames?type=${gameType}`)}>{t('academy.train_btn')}</Button>
                            </CardContent>
                        </Card>
                        <Card className="border-[#d4c5b0] bg-gradient-to-br from-[#fdfbf7] to-[#f0e6d2]">
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2"><CheckCircle2 className="w-5 h-5" /> {t('academy.tactics_title')}</CardTitle>
                                <CardDescription>{t('academy.tactics_desc')}</CardDescription>
                            </CardHeader>
                            <CardContent>
                                <Button className="w-full bg-[#4a3728]" onClick={() => navigate(`/Practice/Tactics?type=${gameType}`)}>{t('academy.train_btn')}</Button>
                            </CardContent>
                        </Card>
                    </div>
                </TabsContent>
                <TabsContent value="free" className="mt-6">
                    <FreeTrainingMode />
                </TabsContent>
                <TabsContent value="analysis" className="mt-6">
                    <AnalysisMode />
                </TabsContent>
                <TabsContent value="stats" className="mt-6">
                    <PerformanceStats />
                </TabsContent>
            </Tabs>
        </div>
    );
}