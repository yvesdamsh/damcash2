import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Trophy, XCircle, Handshake } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export default function PerformanceStats() {
    const [loading, setLoading] = useState(true);
    const [stats, setStats] = useState(null);
    const [timeRange, setTimeRange] = useState('all');

    useEffect(() => {
        const fetchStats = async () => {
            try {
                const user = await base44.auth.me();
                // Fetch finished games where user played
                const games = await base44.entities.Game.filter({ 
                    status: 'finished',
                    $or: [{ white_player_id: user.id }, { black_player_id: user.id }]
                });

                // Process Data
                const chessGames = games.filter(g => g.game_type === 'chess');
                const checkersGames = games.filter(g => g.game_type === 'checkers');

                const processGameSet = (gameSet) => {
                    let wins = 0, losses = 0, draws = 0;
                    let whiteWins = 0, whiteLosses = 0;
                    let blackWins = 0, blackLosses = 0;
                    const openings = {};

                    gameSet.forEach(g => {
                        const isWhite = g.white_player_id === user.id;
                        const isWinner = g.winner_id === user.id;
                        const isDraw = !g.winner_id;

                        if (isDraw) draws++;
                        else if (isWinner) {
                            wins++;
                            if (isWhite) whiteWins++; else blackWins++;
                        } else {
                            losses++;
                            if (isWhite) whiteLosses++; else blackLosses++;
                        }

                        if (g.opening_name) {
                            openings[g.opening_name] = (openings[g.opening_name] || 0) + 1;
                        }
                    });

                    return {
                        total: gameSet.length,
                        wins, losses, draws,
                        white: { wins: whiteWins, losses: whiteLosses },
                        black: { wins: blackWins, losses: blackLosses },
                        openings: Object.entries(openings)
                            .map(([name, count]) => ({ name, count }))
                            .sort((a, b) => b.count - a.count)
                            .slice(0, 5)
                    };
                };

                setStats({
                    chess: processGameSet(chessGames),
                    checkers: processGameSet(checkersGames)
                });
                setLoading(false);
            } catch (e) {
                console.error(e);
                setLoading(false);
            }
        };
        fetchStats();
    }, [timeRange]);

    if (loading) return <div className="p-8 text-center">Chargement des stats...</div>;
    if (!stats) return null;

    const COLORS = ['#22c55e', '#ef4444', '#94a3b8'];

    const StatCard = ({ title, data, type }) => (
        <div className="space-y-6">
            <div className="grid grid-cols-3 gap-4">
                <Card className="bg-green-50 border-green-100">
                    <CardContent className="p-4 text-center">
                        <div className="text-2xl font-bold text-green-700">{data.wins}</div>
                        <div className="text-xs text-green-600 uppercase font-bold flex items-center justify-center gap-1">
                            <Trophy className="w-3 h-3" /> Victoires
                        </div>
                    </CardContent>
                </Card>
                <Card className="bg-red-50 border-red-100">
                    <CardContent className="p-4 text-center">
                        <div className="text-2xl font-bold text-red-700">{data.losses}</div>
                        <div className="text-xs text-red-600 uppercase font-bold flex items-center justify-center gap-1">
                            <XCircle className="w-3 h-3" /> Défaites
                        </div>
                    </CardContent>
                </Card>
                <Card className="bg-slate-50 border-slate-100">
                    <CardContent className="p-4 text-center">
                        <div className="text-2xl font-bold text-slate-700">{data.draws}</div>
                        <div className="text-xs text-slate-600 uppercase font-bold flex items-center justify-center gap-1">
                            <Handshake className="w-3 h-3" /> Nulles
                        </div>
                    </CardContent>
                </Card>
            </div>

            <div className="grid md:grid-cols-2 gap-6">
                <Card>
                    <CardHeader><CardTitle className="text-sm">Répartition des Résultats</CardTitle></CardHeader>
                    <CardContent className="h-64">
                        <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                                <Pie
                                    data={[
                                        { name: 'Victoires', value: data.wins },
                                        { name: 'Défaites', value: data.losses },
                                        { name: 'Nulles', value: data.draws }
                                    ]}
                                    cx="50%" cy="50%"
                                    innerRadius={60} outerRadius={80}
                                    paddingAngle={5}
                                    dataKey="value"
                                >
                                    {COLORS.map((color, index) => (
                                        <Cell key={`cell-${index}`} fill={color} />
                                    ))}
                                </Pie>
                                <Legend />
                                <Tooltip />
                            </PieChart>
                        </ResponsiveContainer>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader><CardTitle className="text-sm">Performance par Couleur</CardTitle></CardHeader>
                    <CardContent className="h-64">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart
                                data={[
                                    { name: 'Blancs', wins: data.white.wins, losses: data.white.losses },
                                    { name: 'Noirs', wins: data.black.wins, losses: data.black.losses }
                                ]}
                                layout="vertical"
                            >
                                <XAxis type="number" hide />
                                <YAxis dataKey="name" type="category" width={50} />
                                <Tooltip />
                                <Legend />
                                <Bar dataKey="wins" name="Victoires" fill="#22c55e" stackId="a" radius={[0, 4, 4, 0]} />
                                <Bar dataKey="losses" name="Défaites" fill="#ef4444" stackId="a" radius={[0, 4, 4, 0]} />
                            </BarChart>
                        </ResponsiveContainer>
                    </CardContent>
                </Card>
            </div>

            {data.openings.length > 0 && (
                <Card>
                    <CardHeader><CardTitle className="text-sm">Ouvertures Fréquentes</CardTitle></CardHeader>
                    <CardContent>
                        <div className="space-y-2">
                            {data.openings.map((op, i) => (
                                <div key={i} className="flex justify-between items-center p-2 hover:bg-gray-50 rounded">
                                    <span className="font-medium text-sm">{op.name}</span>
                                    <span className="text-xs bg-gray-200 px-2 py-1 rounded-full">{op.count} parties</span>
                                </div>
                            ))}
                        </div>
                    </CardContent>
                </Card>
            )}
        </div>
    );

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <h2 className="text-2xl font-bold text-[#4a3728]">Statistiques de Performance</h2>
                <Select value={timeRange} onValueChange={setTimeRange}>
                    <SelectTrigger className="w-32">
                        <SelectValue placeholder="Période" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">Toujours</SelectItem>
                        <SelectItem value="month">Ce mois</SelectItem>
                    </SelectContent>
                </Select>
            </div>

            <Tabs defaultValue="chess" className="w-full">
                <TabsList className="w-full grid grid-cols-2 mb-6">
                    <TabsTrigger value="chess">Échecs</TabsTrigger>
                    <TabsTrigger value="checkers">Dames</TabsTrigger>
                </TabsList>
                <TabsContent value="chess">
                    <StatCard title="Échecs" data={stats.chess} type="chess" />
                </TabsContent>
                <TabsContent value="checkers">
                    <StatCard title="Dames" data={stats.checkers} type="checkers" />
                </TabsContent>
            </Tabs>
        </div>
    );
}