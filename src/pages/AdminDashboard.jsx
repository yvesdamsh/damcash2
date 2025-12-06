import React, { useEffect, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Loader2, AlertCircle, LayoutDashboard, Users, Gamepad2, ShoppingBag, Trophy } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import AdminOverview from '@/components/admin/AdminOverview';
import AdminUsers from '@/components/admin/AdminUsers';
import AdminGames from '@/components/admin/AdminGames';
import AdminShop from '@/components/admin/AdminShop';

export default function AdminDashboard() {
    const [activeTab, setActiveTab] = useState('overview');
    const [stats, setStats] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const navigate = useNavigate();

    useEffect(() => {
        const checkAuth = async () => {
            try {
                const user = await base44.auth.me();
                if (!user || user.role !== 'admin') {
                    setError("Accès non autorisé.");
                    setLoading(false);
                    return;
                }
                // Initial stats load
                const response = await base44.functions.invoke('getAdminStats');
                if (response.status === 200) setStats(response.data);
            } catch (err) {
                console.error(err);
                setError(err.message);
            } finally {
                setLoading(false);
            }
        };
        checkAuth();
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
        <div className="min-h-screen flex items-center justify-center bg-[#f5f0e6]">
            <Loader2 className="w-10 h-10 animate-spin text-[#4a3728]" />
        </div>
    );

    if (error) return (
        <div className="min-h-screen flex flex-col items-center justify-center gap-4 bg-[#f5f0e6]">
            <AlertCircle className="w-12 h-12 text-red-500" />
            <h1 className="text-2xl font-bold text-[#4a3728]">Accès Refusé</h1>
            <p className="text-gray-600">{error}</p>
            <button onClick={() => navigate('/Home')} className="px-4 py-2 bg-[#4a3728] text-white rounded-lg">
                Retour à l'accueil
            </button>
        </div>
    );

    return (
        <div className="min-h-screen bg-[#f5f0e6]">
            <div className="bg-[#4a3728] text-[#e8dcc5] p-4 shadow-md">
                <div className="container mx-auto flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <LayoutDashboard className="w-6 h-6" />
                        <h1 className="text-xl font-black tracking-wider">ADMINISTRATION</h1>
                    </div>
                    <div className="text-sm opacity-80">
                        DamCash v1.0
                    </div>
                </div>
            </div>

            <div className="container mx-auto p-4 md:p-8">
                <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
                    <TabsList className="grid w-full grid-cols-4 lg:w-[600px] bg-white border border-[#d4c5b0] p-1 rounded-xl shadow-sm">
                        <TabsTrigger value="overview" className="data-[state=active]:bg-[#4a3728] data-[state=active]:text-[#e8dcc5]">
                            <LayoutDashboard className="w-4 h-4 mr-2" />
                            <span className="hidden md:inline">Vue d'ensemble</span>
                        </TabsTrigger>
                        <TabsTrigger value="users" className="data-[state=active]:bg-[#4a3728] data-[state=active]:text-[#e8dcc5]">
                            <Users className="w-4 h-4 mr-2" />
                            <span className="hidden md:inline">Utilisateurs</span>
                        </TabsTrigger>
                        <TabsTrigger value="games" className="data-[state=active]:bg-[#4a3728] data-[state=active]:text-[#e8dcc5]">
                            <Gamepad2 className="w-4 h-4 mr-2" />
                            <span className="hidden md:inline">Parties</span>
                        </TabsTrigger>
                        <TabsTrigger value="shop" className="data-[state=active]:bg-[#4a3728] data-[state=active]:text-[#e8dcc5]">
                            <ShoppingBag className="w-4 h-4 mr-2" />
                            <span className="hidden md:inline">Boutique</span>
                        </TabsTrigger>
                    </TabsList>

                    <div className="bg-white/50 backdrop-blur-sm border border-[#d4c5b0] rounded-xl p-6 shadow-sm min-h-[500px]">
                        <TabsContent value="overview" className="mt-0">
                            <AdminOverview stats={stats} onDownloadCSV={downloadCSV} />
                        </TabsContent>
                        <TabsContent value="users" className="mt-0">
                            <AdminUsers />
                        </TabsContent>
                        <TabsContent value="games" className="mt-0">
                            <AdminGames />
                        </TabsContent>
                        <TabsContent value="shop" className="mt-0">
                            <AdminShop />
                        </TabsContent>
                    </div>
                </Tabs>
            </div>
        </div>
    );
}