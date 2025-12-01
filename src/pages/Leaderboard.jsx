import React, { useEffect, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Trophy, Medal, User } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export default function Leaderboard() {
    const [players, setPlayers] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchLeaderboard = async () => {
            try {
                const data = await base44.entities.User.list({}, { elo: -1 }, 50);
                
                if (data.length === 0) {
                    setPlayers([
                        { id: '1', created_by: 'GrandMaître', elo: 2400, wins: 150, games_played: 160 },
                        { id: '2', created_by: 'CheckersPro', elo: 1950, wins: 80, games_played: 100 },
                        { id: '3', created_by: 'Debutante', elo: 1200, wins: 5, games_played: 10 },
                    ]);
                } else {
                    setPlayers(data);
                }
            } catch (e) {
                console.error(e);
            } finally {
                setLoading(false);
            }
        };
        fetchLeaderboard();
    }, []);

    return (
        <div className="max-w-3xl mx-auto">
            <h1 className="text-4xl font-bold text-[#4a3728] text-center mb-8 flex items-center justify-center gap-3">
                <Trophy className="w-10 h-10 text-yellow-600" />
                Tableau des Leaders
            </h1>

            <Card className="bg-white/90 backdrop-blur border-[#d4c5b0] shadow-xl">
                <CardHeader className="bg-[#4a3728] text-[#e8dcc5] rounded-t-xl">
                    <div className="grid grid-cols-12 gap-4 font-bold text-sm md:text-base">
                        <div className="col-span-2 text-center">Rang</div>
                        <div className="col-span-6">Joueur</div>
                        <div className="col-span-2 text-center">ELO</div>
                        <div className="col-span-2 text-center">Victoires</div>
                    </div>
                </CardHeader>
                <CardContent className="p-0">
                    {players.map((player, index) => {
                        let rankIcon = null;
                        if (index === 0) rankIcon = <Medal className="w-5 h-5 text-yellow-500" />;
                        if (index === 1) rankIcon = <Medal className="w-5 h-5 text-gray-400" />;
                        if (index === 2) rankIcon = <Medal className="w-5 h-5 text-amber-700" />;

                        return (
                            <div 
                                key={player.id}
                                className={`
                                    grid grid-cols-12 gap-4 p-4 items-center border-b border-gray-100 transition-colors
                                    ${index % 2 === 0 ? 'bg-white' : 'bg-[#fcf9f5]'}
                                    hover:bg-[#f0e6d2]
                                `}
                            >
                                <div className="col-span-2 flex justify-center font-bold text-[#4a3728]">
                                    {rankIcon || `#${index + 1}`}
                                </div>
                                <div className="col-span-6 flex items-center gap-3">
                                    <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center overflow-hidden">
                                        <User className="w-5 h-5 text-gray-500" />
                                    </div>
                                    <span className="font-medium truncate">
                                        {player.created_by?.split('@')[0] || 'Joueur'}
                                    </span>
                                </div>
                                <div className="col-span-2 text-center font-mono font-bold text-[#6b5138]">
                                    {player.elo}
                                </div>
                                <div className="col-span-2 text-center text-gray-600">
                                    {player.wins}
                                </div>
                            </div>
                        );
                    })}
                </CardContent>
            </Card>
        </div>
    );
}