import React, { useEffect, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { User, Activity, Calendar, Shield } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export default function Profile() {
    const [user, setUser] = useState(null);
    const [stats, setStats] = useState(null);

    useEffect(() => {
        const init = async () => {
            try {
                const u = await base44.auth.me();
                setUser(u);
                const allStats = await base44.entities.User.list();
                const myStats = allStats.find(s => s.created_by === u.email) || {
                    elo: 1200, wins: 0, losses: 0, games_played: 0
                };
                setStats(myStats);
            } catch (e) {
                base44.auth.redirectToLogin();
            }
        };
        init();
    }, []);

    if (!user || !stats) return null;

    const winRate = stats.games_played > 0 
        ? Math.round((stats.wins / stats.games_played) * 100) 
        : 0;

    return (
        <div className="max-w-4xl mx-auto">
            <div className="bg-white/90 backdrop-blur rounded-2xl shadow-xl border border-[#d4c5b0] overflow-hidden">
                <div className="h-32 bg-[#4a3728] relative">
                    <div className="absolute -bottom-12 left-8">
                        <div className="w-24 h-24 rounded-full bg-white p-1 shadow-lg">
                            <div className="w-full h-full rounded-full bg-gradient-to-br from-gray-200 to-gray-400 flex items-center justify-center">
                                <User className="w-12 h-12 text-gray-600" />
                            </div>
                        </div>
                    </div>
                </div>

                <div className="pt-16 px-8 pb-8">
                    <div className="flex justify-between items-start mb-8">
                        <div>
                            <h1 className="text-3xl font-bold text-[#4a3728]">{user.full_name || 'Joueur'}</h1>
                            <p className="text-gray-500">{user.email}</p>
                        </div>
                        <div className="bg-[#e8dcc5] px-4 py-2 rounded-lg">
                            <span className="text-xs uppercase tracking-wider text-[#6b5138] font-bold">Membre depuis</span>
                            <p className="font-mono text-[#4a3728]">2024</p>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <Card>
                            <CardHeader className="pb-2">
                                <CardTitle className="text-sm font-medium text-gray-500 flex items-center gap-2">
                                    <Activity className="w-4 h-4" /> Score ELO
                                </CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="text-3xl font-bold text-[#6b5138]">{stats.elo}</div>
                            </CardContent>
                        </Card>

                        <Card>
                            <CardHeader className="pb-2">
                                <CardTitle className="text-sm font-medium text-gray-500 flex items-center gap-2">
                                    <Shield className="w-4 h-4" /> Ratio Victoires
                                </CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="text-3xl font-bold text-[#6b5138]">{winRate}%</div>
                                <p className="text-xs text-gray-500">{stats.wins} victoires / {stats.losses} défaites</p>
                            </CardContent>
                        </Card>

                        <Card>
                            <CardHeader className="pb-2">
                                <CardTitle className="text-sm font-medium text-gray-500 flex items-center gap-2">
                                    <Calendar className="w-4 h-4" /> Parties Jouées
                                </CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="text-3xl font-bold text-[#6b5138]">{stats.games_played}</div>
                            </CardContent>
                        </Card>
                    </div>
                </div>
            </div>
        </div>
    );
}