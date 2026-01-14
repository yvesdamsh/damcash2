import React, { useState, useEffect } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Brain, Swords, BarChart2, Search, PlusCircle, BookOpen, Puzzle, CheckCircle2, ChevronRight } from 'lucide-react';
import PuzzleMode from '@/components/training/PuzzleMode';
import FreeTrainingMode from '@/components/training/FreeTrainingMode';
import AnalysisMode from '@/components/training/AnalysisMode';
import PerformanceStats from '@/components/training/PerformanceStats';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { base44 } from '@/api/base44Client';
import { Link } from 'react-router-dom';
import { useLanguage } from '@/components/LanguageContext';

export default function Training() {
    const { t } = useLanguage();
    const [lessons, setLessons] = useState([]);
    const [gameType, setGameType] = useState(() => { try { return localStorage.getItem('gameMode') || 'checkers'; } catch (_) { return 'checkers'; } });

    useEffect(() => {
        const fetchContent = async () => {
            try {
                const allLessons = await base44.entities.Lesson.filter({ game_type: gameType });
                setLessons((allLessons || []).sort((a,b) => (a.order || 0) - (b.order || 0)));
            } catch (e) { console.error('Training fetch error', e); }
        };
        fetchContent();
    }, [gameType]);

    useEffect(() => {
        const handler = () => {
            try { const mode = localStorage.getItem('gameMode'); if (mode && mode !== gameType) setGameType(mode); } catch (_) {}
        };
        window.addEventListener('gameModeChanged', handler);
        return () => window.removeEventListener('gameModeChanged', handler);
    }, [gameType]);
    
    return (
        <div className="max-w-6xl mx-auto py-6 px-4 md:py-8">
            <div className="flex flex-col md:flex-row items-center justify-between mb-6 md:mb-8">
                <div className="text-center md:text-left mb-4 md:mb-0">
                    <h1 className="text-3xl md:text-4xl font-black text-[#4a3728] mb-2">{t('academy.title')}</h1>
                    <p className="text-[#6b5138] text-sm md:text-base">{t('academy.subtitle')}</p>
                </div>
                <Link to="/CreatePuzzle">
                    <Button className="bg-[#4a3728] hover:bg-[#2c1e12] text-[#e8dcc5] font-bold shadow-lg">
                        <PlusCircle className="w-4 h-4 mr-2" /> {t('common.create')} Puzzle
                    </Button>
                </Link>
            </div>

            <Tabs defaultValue="puzzles" className="w-full">
                <TabsList className="grid w-full grid-cols-5 bg-[#e8dcc5] p-1 rounded-xl mb-6 md:mb-8 h-auto">
                    <TabsTrigger value="lessons" className="data-[state=active]:bg-[#4a3728] data-[state=active]:text-[#e8dcc5] text-[#6b5138] font-bold py-2 md:py-3 text-xs md:text-sm rounded-lg transition-all whitespace-normal h-full leading-tight">
                        <div className="flex flex-col md:flex-row items-center justify-center gap-1 md:gap-2">
                            <BookOpen className="w-4 h-4" />
                            <span>{t('academy.lessons')}</span>
                        </div>
                    </TabsTrigger>
                    <TabsTrigger value="puzzles" className="data-[state=active]:bg-[#4a3728] data-[state=active]:text-[#e8dcc5] text-[#6b5138] font-bold py-2 md:py-3 text-xs md:text-sm rounded-lg transition-all whitespace-normal h-full leading-tight">
                        <div className="flex flex-col md:flex-row items-center justify-center gap-1 md:gap-2">
                            <Brain className="w-4 h-4" />
                            <span>{t('academy.puzzles')}</span>
                        </div>
                    </TabsTrigger>
                    <TabsTrigger value="free" className="data-[state=active]:bg-[#4a3728] data-[state=active]:text-[#e8dcc5] text-[#6b5138] font-bold py-2 md:py-3 text-xs md:text-sm rounded-lg transition-all whitespace-normal h-full leading-tight">
                        <div className="flex flex-col md:flex-row items-center justify-center gap-1 md:gap-2">
                            <Swords className="w-4 h-4" />
                            <span>{t('academy.practice')}</span>
                        </div>
                    </TabsTrigger>
                    <TabsTrigger value="analysis" className="data-[state=active]:bg-[#4a3728] data-[state=active]:text-[#e8dcc5] text-[#6b5138] font-bold py-2 md:py-3 text-xs md:text-sm rounded-lg transition-all whitespace-normal h-full leading-tight">
                        <div className="flex flex-col md:flex-row items-center justify-center gap-1 md:gap-2">
                            <Search className="w-4 h-4" />
                            <span>{t('tv.review')}</span>
                        </div>
                    </TabsTrigger>
                    <TabsTrigger value="stats" className="data-[state=active]:bg-[#4a3728] data-[state=active]:text-[#e8dcc5] text-[#6b5138] font-bold py-2 md:py-3 text-xs md:text-sm rounded-lg transition-all whitespace-normal h-full leading-tight">
                        <div className="flex flex-col md:flex-row items-center justify-center gap-1 md:gap-2">
                            <BarChart2 className="w-4 h-4" />
                            <span>Stats</span>
                        </div>
                    </TabsTrigger>
                </TabsList>

                <TabsContent value="lessons" className="animate-in fade-in duration-500">
                    <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {lessons.length > 0 ? lessons.map((lesson) => (
                            <Card key={lesson.id} className="border-[#d4c5b0] hover:shadow-lg transition-shadow bg-white">
                                <CardHeader>
                                    <div className="flex justify-between items-start mb-2">
                                        <Badge variant="secondary" className="bg-[#f0e6d2] text-[#6b5138] capitalize">{lesson.difficulty}</Badge>
                                        <Badge variant="outline" className="border-[#d4c5b0] text-[#8c7b6a] capitalize">{lesson.category}</Badge>
                                    </div>
                                    <CardTitle className="text-[#4a3728]">{lesson.title}</CardTitle>
                                    <CardDescription className="line-clamp-2">{lesson.description}</CardDescription>
                                </CardHeader>
                                <CardContent>
                                    <Link to={`/Lesson?id=${lesson.id}`}>
                                        <Button className="w-full bg-[#4a3728] hover:bg-[#2c1e12]">
                                            {t('academy.start_lesson')} <ChevronRight className="w-4 h-4 ml-2" />
                                        </Button>
                                    </Link>
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

                <TabsContent value="puzzles" className="animate-in fade-in duration-500">
                    <PuzzleMode />
                </TabsContent>

                <TabsContent value="free" className="animate-in fade-in duration-500">
                    <FreeTrainingMode />
                </TabsContent>

                <TabsContent value="analysis" className="animate-in fade-in duration-500">
                    <AnalysisMode />
                </TabsContent>

                <TabsContent value="practice" className="animate-in fade-in duration-500">
                    <div className="grid md:grid-cols-2 gap-6">
                        <Card className="border-[#d4c5b0] bg-gradient-to-br from-[#fdfbf7] to-[#f0e6d2]">
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2"><Swords className="w-5 h-5" /> {t('academy.endgames_title')}</CardTitle>
                                <CardDescription>{t('academy.endgames_desc')}</CardDescription>
                            </CardHeader>
                            <CardContent>
                                <Link to={`/Practice/Endgames?type=${gameType}`}>
                                    <Button className="w-full bg-[#4a3728]">{t('academy.train_btn')}</Button>
                                </Link>
                            </CardContent>
                        </Card>
                        <Card className="border-[#d4c5b0] bg-gradient-to-br from-[#fdfbf7] to-[#f0e6d2]">
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2"><CheckCircle2 className="w-5 h-5" /> {t('academy.tactics_title')}</CardTitle>
                                <CardDescription>{t('academy.tactics_desc')}</CardDescription>
                            </CardHeader>
                            <CardContent>
                                <Link to={`/Practice/Tactics?type=${gameType}`}>
                                    <Button className="w-full bg-[#4a3728]">{t('academy.train_btn')}</Button>
                                </Link>
                            </CardContent>
                        </Card>
                    </div>
                </TabsContent>

                <TabsContent value="stats" className="animate-in fade-in duration-500">
                    <PerformanceStats />
                </TabsContent>
            </Tabs>
        </div>
    );
}