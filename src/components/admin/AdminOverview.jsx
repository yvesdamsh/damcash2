import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Download, Users, CreditCard, Gamepad2, TrendingUp } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line } from 'recharts';

export default function AdminOverview({ stats, loading, onDownloadCSV }) {
    if (!stats) return null;

    return (
        <div className="space-y-8">
            <div className="flex justify-between items-center">
                <h2 className="text-2xl font-bold text-[#4a3728]">Vue d'ensemble</h2>
                <div className="flex gap-2">
                    <Button variant="outline" onClick={() => onDownloadCSV(stats.raw.users, 'utilisateurs.csv')}>
                        <Download className="w-4 h-4 mr-2" /> Users CSV
                    </Button>
                    <Button variant="outline" onClick={() => onDownloadCSV(stats.raw.transactions, 'transactions.csv')}>
                        <Download className="w-4 h-4 mr-2" /> Transactions CSV
                    </Button>
                </div>
            </div>

            {/* Overview Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Utilisateurs Totaux</CardTitle>
                        <Users className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{stats.overview.totalUsers}</div>
                        <p className="text-xs text-muted-foreground">
                            +{stats.overview.newUsersLast30Days} ce mois-ci
                        </p>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Volume Transactions</CardTitle>
                        <CreditCard className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{stats.overview.totalVolume.toLocaleString()} D$</div>
                        <p className="text-xs text-muted-foreground">
                            Volume total échangé
                        </p>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Parties Actives</CardTitle>
                        <Gamepad2 className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{stats.overview.activeGames}</div>
                        <p className="text-xs text-muted-foreground">
                            En cours actuellement
                        </p>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Parties Terminées</CardTitle>
                        <TrendingUp className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{stats.overview.totalGamesPlayed}</div>
                        <p className="text-xs text-muted-foreground">
                            Depuis le début
                        </p>
                    </CardContent>
                </Card>
            </div>

            {/* Charts Section */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <Card className="p-4">
                    <CardHeader>
                        <CardTitle>Volume des Transactions (30 jours)</CardTitle>
                    </CardHeader>
                    <CardContent className="h-[300px]">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={stats.charts.volumeTrend}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                                <XAxis 
                                    dataKey="date" 
                                    tickFormatter={(value) => new Date(value).toLocaleDateString('fr-FR', {day: 'numeric', month: 'short'})}
                                    fontSize={12}
                                />
                                <YAxis fontSize={12} />
                                <Tooltip 
                                    formatter={(value) => [`${value} D$`, 'Volume']}
                                    labelFormatter={(label) => new Date(label).toLocaleDateString('fr-FR', {weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'})}
                                />
                                <Bar dataKey="volume" fill="#b8860b" radius={[4, 4, 0, 0]} />
                            </BarChart>
                        </ResponsiveContainer>
                    </CardContent>
                </Card>

                <Card className="p-4">
                    <CardHeader>
                        <CardTitle>Parties Créées (30 jours)</CardTitle>
                    </CardHeader>
                    <CardContent className="h-[300px]">
                        <ResponsiveContainer width="100%" height="100%">
                            <LineChart data={stats.charts.gamesTrend}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                                <XAxis 
                                    dataKey="date" 
                                    tickFormatter={(value) => new Date(value).toLocaleDateString('fr-FR', {day: 'numeric', month: 'short'})}
                                    fontSize={12}
                                />
                                <YAxis fontSize={12} />
                                <Tooltip />
                                <Line type="monotone" dataKey="count" stroke="#4a3728" strokeWidth={2} dot={{r: 4}} activeDot={{r: 6}} />
                            </LineChart>
                        </ResponsiveContainer>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}