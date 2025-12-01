import React, { useEffect, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Trophy, Medal, User, Crown, Calendar, Timer, Swords } from 'lucide-react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Loader2 } from 'lucide-react';

export default function Leaderboard() {
    const [players, setPlayers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [gameType, setGameType] = useState('checkers');
    const [timeframe, setTimeframe] = useState('all_time');
    const [metric, setMetric] = useState('elo');

    useEffect(() => {
        const fetchLeaderboard = async () => {
            setLoading(true);
            try {
                // If daily/weekly/monthly and metric is ELO, we fallback to wins or just show current ELO?
                // Usually ELO is all time. Let's force 'all_time' if metric is 'elo' to avoid confusion or just show current.
                
                const res = await base44.functions.invoke('getLeaderboardData', {
                    timeframe,
                    gameType,
                    metric
                });
                setPlayers(res.data || []);
            } catch (e) {
                console.error(e);
            } finally {
                setLoading(false);
            }
        };
        fetchLeaderboard();
    }, [gameType, timeframe, metric]);

    return (
        <div className="max-w-4xl mx-auto space-y-6">
            <div className="text-center space-y-2">
                <h1 className="text-4xl font-black text-[#4a3728] flex items-center justify-center gap-3 uppercase tracking-wider">
                    <Trophy className="w-10 h-10 text-yellow-600" />
                    Classement
                </h1>
                <p className="text-[#6b5138] font-medium">Les légendes de Damcash</p>
            </div>

            {/* Filters */}
            <div className="bg-white/80 backdrop-blur p-4 rounded-xl border border-[#d4c5b0] shadow-sm flex flex-col md:flex-row gap-4 justify-between items-center">
                <div className="flex gap-2">
                     <Button 
                        variant={gameType === 'checkers' ? "default" : "outline"}
                        onClick={() => setGameType('checkers')}
                        className={gameType === 'checkers' ? "bg-[#6b5138] hover:bg-[#5c4430]" : "border-[#d4c5b0] text-[#6b5138]"}
                    >
                        ⚪ Dames
                    </Button>
                    <Button 
                        variant={gameType === 'chess' ? "default" : "outline"}
                        onClick={() => setGameType('chess')}
                        className={gameType === 'chess' ? "bg-[#6b5138] hover:bg-[#5c4430]" : "border-[#d4c5b0] text-[#6b5138]"}
                    >
                        ♟️ Échecs
                    </Button>
                </div>

                <div className="flex gap-2 items-center">
                    <Select value={metric} onValueChange={setMetric}>
                        <SelectTrigger className="w-[180px] border-[#d4c5b0]">
                            <SelectValue placeholder="Métrique" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="elo">🏆 Classement ELO</SelectItem>
                            <SelectItem value="wins">⚔️ Victoires</SelectItem>
                            <SelectItem value="tournament_wins">👑 Tournois Gagnés</SelectItem>
                        </SelectContent>
                    </Select>

                    {metric !== 'elo' && (
                        <Select value={timeframe} onValueChange={setTimeframe}>
                            <SelectTrigger className="w-[150px] border-[#d4c5b0]">
                                <SelectValue placeholder="Période" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all_time">Tout temps</SelectItem>
                                <SelectItem value="monthly">Ce mois</SelectItem>
                                <SelectItem value="weekly">Cette semaine</SelectItem>
                                <SelectItem value="daily">Aujourd'hui</SelectItem>
                            </SelectContent>
                        </Select>
                    )}
                </div>
            </div>

            <Card className="bg-white/90 backdrop-blur border-[#d4c5b0] shadow-xl overflow-hidden">
                <CardHeader className="bg-[#4a3728] text-[#e8dcc5] py-3">
                    <div className="grid grid-cols-12 gap-4 font-bold text-sm md:text-base items-center">
                        <div className="col-span-2 text-center">Rang</div>
                        <div className="col-span-7">Joueur</div>
                        <div className="col-span-3 text-center">
                            {metric === 'elo' ? 'ELO' : metric === 'wins' ? 'Victoires' : 'Titres'}
                        </div>
                    </div>
                </CardHeader>
                <CardContent className="p-0 min-h-[300px]">
                    {loading ? (
                        <div className="flex justify-center items-center h-[300px]">
                            <Loader2 className="w-8 h-8 animate-spin text-[#6b5138]" />
                        </div>
                    ) : players.length === 0 ? (
                        <div className="flex flex-col justify-center items-center h-[300px] text-gray-400">
                            <Trophy className="w-12 h-12 mb-2 opacity-20" />
                            <p>Aucune donnée trouvée pour cette période</p>
                        </div>
                    ) : (
                        players.map((player, index) => {
                            let rankDisplay = <span className="font-bold text-gray-500 text-lg">#{index + 1}</span>;
                            let bgClass = index % 2 === 0 ? 'bg-white' : 'bg-[#fcf9f5]';
                            
                            if (index === 0) {
                                rankDisplay = <Medal className="w-6 h-6 text-yellow-500 drop-shadow-sm" />;
                                bgClass = 'bg-gradient-to-r from-yellow-50/50 to-white border-l-4 border-yellow-400';
                            }
                            if (index === 1) {
                                rankDisplay = <Medal className="w-6 h-6 text-gray-400 drop-shadow-sm" />;
                                bgClass = 'bg-gradient-to-r from-gray-50/50 to-white border-l-4 border-gray-300';
                            }
                            if (index === 2) {
                                rankDisplay = <Medal className="w-6 h-6 text-amber-700 drop-shadow-sm" />;
                                bgClass = 'bg-gradient-to-r from-amber-50/50 to-white border-l-4 border-amber-600';
                            }

                            return (
                                <div 
                                    key={player.id}
                                    className={`
                                        grid grid-cols-12 gap-4 p-4 items-center border-b border-gray-100 transition-all hover:bg-[#f0e6d2]
                                        ${bgClass}
                                    `}
                                >
                                    <div className="col-span-2 flex justify-center">
                                        {rankDisplay}
                                    </div>
                                    <div className="col-span-7 flex items-center gap-3">
                                        <Avatar className="w-10 h-10 border-2 border-white shadow-sm">
                                            <AvatarImage src={player.avatar_url} />
                                            <AvatarFallback>{player.username?.[0]}</AvatarFallback>
                                        </Avatar>
                                        <div className="overflow-hidden">
                                            <div className="font-bold text-[#4a3728] truncate">{player.username}</div>
                                            {metric === 'elo' && <div className="text-xs text-gray-400">{player.games_played || 0} parties</div>}
                                        </div>
                                        {index === 0 && <Crown className="w-4 h-4 text-yellow-500 ml-auto hidden md:block" />}
                                    </div>
                                    <div className="col-span-3 text-center">
                                        <span className="font-mono font-black text-xl text-[#6b5138]">
                                            {player.value}
                                        </span>
                                    </div>
                                </div>
                            );
                        })
                    )}
                </CardContent>
            </Card>
        </div>
    );
}