import React, { useEffect, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader2, Download, Users, CreditCard, Gamepad2, TrendingUp, AlertCircle } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line } from 'recharts';
import { useNavigate } from 'react-router-dom';

export default function AdminDashboard() {
    const [stats, setStats] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const navigate = useNavigate();

    useEffect(() => {
        const fetchStats = async () => {
            try {
                const user = await base44.auth.me();
                if (!user || user.role !== 'admin') {
                    setError("Accès non autorisé. Réservé aux administrateurs.");
                    setLoading(false);
                    return;
                }

                const response = await base44.functions.invoke('getAdminStats');
                if (response.status === 200) {
                    setStats(response.data);
                } else {
                    throw new Error(response.data?.error || "Erreur lors du chargement des statistiques");
                }
            } catch (err) {
                console.error(err);
                setError(err.message);
            } finally {
                setLoading(false);
            }
        };

        fetchStats();
    }, []);

    const downloadCSV = (data, filename) => {
        if (!data || !data.length) return;
        const headers = Object.keys(data[0]).join(',');
        const rows = data.map(row => Object.values(row).map(v => `"${v}"`).join(','));
        const csvContent = [headers, ...rows].join('\n');
        
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        if (link.download !== undefined) {
            const url = URL.createObjectURL(blob);
            link.setAttribute('href', url);
            link.setAttribute('download', filename);
            link.style.visibility = 'hidden';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        }
    };

    if (loading) return (
        <div className="min-h-screen flex items-center justify-center">
            <Loader2 className="w-8 h-8 animate-spin text-[#4a3728]" />
        </div>
    );

    if (error) return (
        <div className="min-h-screen flex flex-col items-center justify-center gap-4">
            <AlertCircle className="w-12 h-12 text-red-500" />
            <h1 className="text-2xl font-bold text-[#4a3728]">Accès Refusé</h1>
            <p className="text-gray-600">{error}</p>
            <Button onClick={() => navigate('/Home')}>Retour à l'accueil</Button>
        </div>
    );

    return (
        <div className="container mx-auto p-6 space-y-8 pb-20">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-3xl font-black text-[#4a3728]">Tableau de Bord Administrateur</h1>
                    <p className="text-gray-600">Vue d'ensemble des performances de DamCash</p>
                </div>
                <div className="flex gap-2">
                    <Button variant="outline" onClick={() => downloadCSV(stats.raw.users, 'utilisateurs.csv')}>
                        <Download className="w-4 h-4 mr-2" /> Users CSV
                    </Button>
                    <Button variant="outline" onClick={() => downloadCSV(stats.raw.transactions, 'transactions.csv')}>
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