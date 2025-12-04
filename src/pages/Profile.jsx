import React, { useEffect, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { User, Activity, Shield, Edit, Camera, History, Save, Trophy, Star, MapPin, Globe, Crown, Palette, Medal, Award, Clock, Layout, MessageSquare, TrendingUp, Calendar as CalendarIcon, ShoppingBag, LogOut } from 'lucide-react';
import GameSettings from '@/components/GameSettings';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area, PieChart, Pie, Cell, Legend } from 'recharts';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import PlayerSearchBar from '@/components/PlayerSearchBar';

export default function Profile() {
    const [user, setUser] = useState(null);
    const [isOwnProfile, setIsOwnProfile] = useState(false);
    const [stats, setStats] = useState(null);
    const [ranks, setRanks] = useState({ checkers: '-', chess: '-' });
    const [favoriteGames, setFavoriteGames] = useState([]);
    const [gameHistory, setGameHistory] = useState([]);
    const [badges, setBadges] = useState([]);
    const [isEditing, setIsEditing] = useState(false);
    const [isSettingsOpen, setIsSettingsOpen] = useState(false);
    const [editForm, setEditForm] = useState({ 
        username: '', 
        full_name: '', 
        avatar_url: '', 
        banner_url: '',
        bio: '',
        profile_theme: 'default',
        avatar_frame: 'none'
    });
    const [uploading, setUploading] = useState(false);
    const navigate = useNavigate();
    const location = useLocation();
    const queryParams = new URLSearchParams(location.search);
    const profileId = queryParams.get('id');

    const themes = {
        default: "bg-gradient-to-r from-[#4a3728] to-[#2c1e12]",
        blue: "bg-gradient-to-r from-blue-800 to-blue-950",
        gold: "bg-gradient-to-r from-yellow-600 to-yellow-800",
        forest: "bg-gradient-to-r from-green-800 to-green-950",
        purple: "bg-gradient-to-r from-purple-800 to-purple-950"
    };

    const frames = {
        none: "",
        gold: "border-yellow-400 ring-4 ring-yellow-400/30",
        silver: "border-gray-300 ring-4 ring-gray-300/30",
        neon: "border-cyan-400 ring-4 ring-cyan-400/50 shadow-[0_0_15px_rgba(34,211,238,0.5)]",
        wood: "border-[#5c4033] ring-4 ring-[#8b5a2b]"
    };

    const checkAndAwardBadges = async (currentUser, currentStats) => {
        const newBadges = [];
        const existingBadges = await base44.entities.UserBadge.filter({ user_id: currentUser.id });
        const hasBadge = (name) => existingBadges.some(b => b.name === name);

        // 1. Games Played
        if ((currentStats.games_played || 0) >= 10 && !hasBadge('Débutant Motivé')) {
            newBadges.push({ name: 'Débutant Motivé', icon: 'Star', description: 'Joué 10 parties' });
        }
        if ((currentStats.games_played || 0) >= 50 && !hasBadge('Vétéran')) {
            newBadges.push({ name: 'Vétéran', icon: 'Shield', description: 'Joué 50 parties' });
        }

        // 2. Wins
        if ((currentStats.wins_checkers || 0) >= 10 && !hasBadge('Maître des Dames')) {
            newBadges.push({ name: 'Maître des Dames', icon: 'Crown', description: '10 Victoires aux Dames' });
        }
        if ((currentStats.wins_chess || 0) >= 10 && !hasBadge('Stratège Échecs')) {
            newBadges.push({ name: 'Stratège Échecs', icon: 'Brain', description: '10 Victoires aux Échecs' });
        }

        // 3. ELO
        if (((currentStats.elo_chess || 0) >= 1500 || (currentStats.elo_checkers || 0) >= 1500) && !hasBadge('Elite 1500')) {
            newBadges.push({ name: 'Elite 1500', icon: 'Trophy', description: 'Atteint 1500 ELO' });
        }

        // Create new badges
        for (const b of newBadges) {
            await base44.entities.UserBadge.create({
                user_id: currentUser.id,
                name: b.name,
                icon: b.icon,
                tournament_id: 'system', // System awarded
                awarded_at: new Date().toISOString()
            });
            // Notify
             await base44.entities.Notification.create({
                recipient_id: currentUser.id,
                type: "success",
                title: "Nouveau Badge !",
                message: `Vous avez débloqué le badge : ${b.name}`,
                link: `/Profile`
            });
        }
        
        if (newBadges.length > 0) {
            return await base44.entities.UserBadge.filter({ user_id: currentUser.id });
        }
        return existingBadges;
    };

    useEffect(() => {
        const init = async () => {
            try {
                const currentUser = await base44.auth.me();
                let u = currentUser;
                let isOwnProfileLocal = true;

                if (profileId && profileId !== currentUser.id) {
                    u = await base44.entities.User.get(profileId);
                    isOwnProfileLocal = false;
                }

                setUser(u);
                setIsOwnProfile(isOwnProfileLocal);
                
                if (isOwnProfileLocal) {
                    setEditForm({ 
                        username: u.username || '', 
                        full_name: u.full_name || '',
                        avatar_url: u.avatar_url || '',
                        banner_url: u.banner_url || '',
                        bio: u.bio || '',
                        profile_theme: u.profile_theme || 'default',
                        avatar_frame: u.avatar_frame || 'none'
                    });
                }

                const allStats = await base44.entities.User.list();
                // Match by ID to be safer
                const myStats = allStats.find(s => s.id === u.id) || {
                    elo_checkers: 1200, elo_chess: 1200, 
                    wins_checkers: 0, losses_checkers: 0,
                    wins_chess: 0, losses_chess: 0,
                    games_played: 0
                };
                setStats(myStats);

                // Calculate Ranks
                const sortedCheckers = [...allStats].sort((a, b) => (b.elo_checkers || 1200) - (a.elo_checkers || 1200));
                const myCheckersRank = sortedCheckers.findIndex(s => s.id === u.id) + 1;

                const sortedChess = [...allStats].sort((a, b) => (b.elo_chess || 1200) - (a.elo_chess || 1200));
                const myChessRank = sortedChess.findIndex(s => s.id === u.id) + 1;

                setRanks({ checkers: myCheckersRank, chess: myChessRank });

                // Fetch Favorites
                if (u.favorite_games && u.favorite_games.length > 0) {
                    const favs = await Promise.all(u.favorite_games.map(id => base44.entities.Game.get(id).catch(() => null)));
                    setFavoriteGames(favs.filter(g => g));
                }

                // Fetch History (Extended for graph)
                const [whiteGames, blackGames] = await Promise.all([
                    base44.entities.Game.filter({ white_player_id: u.id, status: 'finished' }, '-updated_date', 50),
                    base44.entities.Game.filter({ black_player_id: u.id, status: 'finished' }, '-updated_date', 50)
                ]);
                const history = [...whiteGames, ...blackGames]
                    .filter((g, index, self) => index === self.findIndex(t => t.id === g.id))
                    .sort((a, b) => new Date(b.updated_date) - new Date(a.updated_date));
                setGameHistory(history);

                // Badges
                // Only check award if own profile, else just fetch
                let userBadges;
                if (isOwnProfile) {
                    userBadges = await checkAndAwardBadges(u, myStats);
                } else {
                    userBadges = await base44.entities.UserBadge.filter({ user_id: u.id });
                }
                setBadges(userBadges);

            } catch (e) {
                console.error(e);
                if (!profileId) base44.auth.redirectToLogin('/Home');
            }
        };
        init();
    }, [profileId]);

    const handleFileUpload = async (e, field) => {
        const file = e.target.files[0];
        if (!file) return;
        
        setUploading(true);
        try {
            const { file_url } = await base44.integrations.Core.UploadFile({ file: file });
            setEditForm(prev => ({ ...prev, [field]: file_url }));
        } catch (error) {
            console.error("Upload failed", error);
        } finally {
            setUploading(false);
        }
    };

    const handleSaveProfile = async () => {
        try {
            await base44.auth.updateMe({
                username: editForm.username,
                full_name: editForm.full_name,
                avatar_url: editForm.avatar_url,
                banner_url: editForm.banner_url,
                bio: editForm.bio,
                profile_theme: editForm.profile_theme,
                avatar_frame: editForm.avatar_frame
            });
            
            const updatedUser = await base44.auth.me();
            setUser(updatedUser);
            setIsEditing(false);
        } catch (error) {
            console.error("Update failed", error);
        }
    };

    if (!user || !stats) return null;

    const totalWins = (stats.wins_checkers || 0) + (stats.wins_chess || 0);
    const totalLosses = (stats.losses_checkers || 0) + (stats.losses_chess || 0);
    const winRate = stats.games_played > 0 
        ? Math.round((totalWins / stats.games_played) * 100) 
        : 0;

    const avgElo = Math.round(((stats.elo_checkers || 1200) + (stats.elo_chess || 1200)) / 2);

    // Stats Calculation for Charts
    const chessGames = (stats.wins_chess || 0) + (stats.losses_chess || 0); // + draws if tracked
    const checkersGames = (stats.wins_checkers || 0) + (stats.losses_checkers || 0);
    
    const pieData = [
        { name: 'Victoires', value: totalWins, color: '#16a34a' },
        { name: 'Défaites', value: totalLosses, color: '#dc2626' },
        // Draws not explicitly in stats object but can be inferred or just ignored for now
    ];

    const gameModeData = [
        { name: 'Échecs', value: chessGames, color: '#2563eb' },
        { name: 'Dames', value: checkersGames, color: '#d97706' }
    ];

    // Graph Data Preparation
    const chartData = gameHistory.slice().reverse().map((g, i) => ({
        name: i + 1,
        elo: g.white_player_id === user.id ? g.white_player_elo : g.black_player_elo,
        date: format(new Date(g.updated_date), 'd MMM'),
        game: g.game_type === 'chess' ? 'Échecs' : 'Dames'
    })).filter(d => d.elo); // Only keep games where elo was recorded

    return (
        <div className="max-w-5xl mx-auto p-4 pb-20">
            <div className="flex justify-end mb-4">
                <div className="w-full max-w-xs">
                    <PlayerSearchBar />
                </div>
            </div>
            <div className="bg-white/90 backdrop-blur rounded-3xl shadow-2xl border border-[#d4c5b0] overflow-hidden mb-8">
                {/* Cover / Header */}
                <div className={`h-48 ${themes[user.profile_theme || 'default']} relative overflow-hidden transition-all duration-500 bg-cover bg-center`} style={user.banner_url ? { backgroundImage: `url(${user.banner_url})` } : {}}>
                    {!user.banner_url && (
                        <motion.div 
                            initial={{ opacity: 0, scale: 2 }}
                            animate={{ opacity: 0.1, scale: 1 }}
                            transition={{ duration: 1.5, ease: "circOut" }}
                            className="absolute inset-0 flex items-center justify-center pointer-events-none select-none"
                        >
                            <span className="text-9xl font-black text-[#e8dcc5] tracking-tighter opacity-20">DAMCASH</span>
                        </motion.div>
                    )}
                    <div className="absolute bottom-4 right-8 z-20 flex gap-2">
                        {(!profileId || (user && user.email === (base44.auth.me()?.email || ''))) && (
                            <Button variant="secondary" onClick={() => navigate('/Shop')} className="bg-yellow-500/20 hover:bg-yellow-500/40 text-white border-yellow-500/50 backdrop-blur-sm">
                                <ShoppingBag className="w-4 h-4 mr-2" /> Boutique
                            </Button>
                        )}
                        
                        {(!profileId || (user && user.email === (base44.auth.me()?.email || ''))) && (
                            <Dialog open={isEditing} onOpenChange={setIsEditing}>
                                <DialogTrigger asChild>
                                    <Button variant="secondary" className="bg-white/10 hover:bg-white/20 text-white border-white/30 backdrop-blur-sm">
                                        <Edit className="w-4 h-4 mr-2" /> Modifier
                                    </Button>
                                </DialogTrigger>
                            <DialogContent className="sm:max-w-[500px] bg-[#fdfbf7] border-[#d4c5b0]">
                                <DialogHeader>
                                    <DialogTitle className="text-[#4a3728]">Modifier le profil</DialogTitle>
                                </DialogHeader>
                                <div className="grid gap-6 py-4">
                                    <div className="flex flex-col items-center gap-4">
                                        <div className="w-32 h-32 rounded-full overflow-hidden bg-gray-100 relative group cursor-pointer border-4 border-white shadow-lg">
                                            {editForm.avatar_url ? (
                                                <img src={editForm.avatar_url} alt="Preview" className="w-full h-full object-cover" />
                                            ) : (
                                                <div className="flex items-center justify-center w-full h-full text-gray-400"><User className="w-12 h-12" /></div>
                                            )}
                                            <div className="absolute inset-0 bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                                <Camera className="w-8 h-8 text-white" />
                                            </div>
                                            <input type="file" accept="image/*" onChange={(e) => handleFileUpload(e, 'avatar_url')} className="absolute inset-0 opacity-0 cursor-pointer" />
                                        </div>
                                        
                                        {/* Banner Upload */}
                                        <div className="w-full space-y-2">
                                            <Label>Bannière de profil</Label>
                                            <div className="h-24 w-full rounded-lg bg-gray-100 relative group overflow-hidden border border-[#d4c5b0]">
                                                {editForm.banner_url ? (
                                                    <img src={editForm.banner_url} className="w-full h-full object-cover" />
                                                ) : (
                                                    <div className="w-full h-full flex items-center justify-center text-gray-400">
                                                        <Layout className="w-6 h-6 mr-2" /> Pas de bannière
                                                    </div>
                                                )}
                                                <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer">
                                                    <Camera className="w-6 h-6 text-white mr-2" /> Changer
                                                </div>
                                                <input type="file" accept="image/*" onChange={(e) => handleFileUpload(e, 'banner_url')} className="absolute inset-0 opacity-0 cursor-pointer" />
                                            </div>
                                        </div>

                                        {uploading && <span className="text-xs text-blue-500 animate-pulse text-center">Téléchargement...</span>}
                                    </div>
                                    <div className="grid gap-4">
                                        <div className="grid gap-2">
                                            <Label htmlFor="username" className="text-[#6b5138]">Nom d'utilisateur</Label>
                                            <Input id="username" value={editForm.username} onChange={(e) => setEditForm({...editForm, username: e.target.value})} className="border-[#d4c5b0] focus:ring-[#4a3728]" />
                                        </div>
                                        <div className="grid gap-2">
                                            <Label htmlFor="name" className="text-[#6b5138]">Nom complet</Label>
                                            <Input id="name" value={editForm.full_name} onChange={(e) => setEditForm({...editForm, full_name: e.target.value})} className="border-[#d4c5b0] focus:ring-[#4a3728]" />
                                        </div>
                                        <div className="grid gap-2">
                                            <Label htmlFor="bio" className="text-[#6b5138]">Biographie</Label>
                                            <textarea 
                                                id="bio" 
                                                className="flex min-h-[100px] w-full rounded-md border border-[#d4c5b0] bg-white px-3 py-2 text-sm placeholder:text-gray-400 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#4a3728] disabled:cursor-not-allowed disabled:opacity-50"
                                                value={editForm.bio} 
                                                onChange={(e) => setEditForm({...editForm, bio: e.target.value})} 
                                                placeholder="Parlez-nous de vous, de votre expérience aux échecs ou aux dames..." 
                                            />
                                        </div>
                                        <div className="grid grid-cols-2 gap-4">
                                            <div className="grid gap-2">
                                                <Label>Thème Profil</Label>
                                                <Select value={editForm.profile_theme} onValueChange={(v) => setEditForm({...editForm, profile_theme: v})}>
                                                    <SelectTrigger className="border-[#d4c5b0]">
                                                        <SelectValue placeholder="Thème" />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        <SelectItem value="default">Classique (Bois)</SelectItem>
                                                        <SelectItem value="blue">Nuit Bleue</SelectItem>
                                                        <SelectItem value="gold">Or Royal</SelectItem>
                                                        <SelectItem value="forest">Forêt Sombre</SelectItem>
                                                        <SelectItem value="purple">Violet Mystique</SelectItem>
                                                    </SelectContent>
                                                </Select>
                                            </div>
                                            <div className="grid gap-2">
                                                <Label>Cadre Avatar</Label>
                                                <Select value={editForm.avatar_frame} onValueChange={(v) => setEditForm({...editForm, avatar_frame: v})}>
                                                    <SelectTrigger className="border-[#d4c5b0]">
                                                        <SelectValue placeholder="Cadre" />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        <SelectItem value="none">Aucun</SelectItem>
                                                        <SelectItem value="gold">Cercle d'Or</SelectItem>
                                                        <SelectItem value="silver">Argenté</SelectItem>
                                                        <SelectItem value="neon">Néon Cyber</SelectItem>
                                                        <SelectItem value="wood">Bois Rustique</SelectItem>
                                                    </SelectContent>
                                                </Select>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                                <div className="flex justify-end gap-2">
                                    <Button variant="outline" onClick={() => setIsEditing(false)} className="border-[#d4c5b0] text-[#6b5138]">Annuler</Button>
                                    <Button onClick={handleSaveProfile} className="bg-[#4a3728] hover:bg-[#2c1e12] text-[#e8dcc5]">
                                        <Save className="w-4 h-4 mr-2" /> Enregistrer
                                    </Button>
                                </div>
                            </DialogContent>
                            </Dialog>
                        )}

                        {(!profileId || (user && user.email === (base44.auth.me()?.email || ''))) && (
                            <Dialog open={isSettingsOpen} onOpenChange={setIsSettingsOpen}>
                                <DialogTrigger asChild>
                                    <Button variant="secondary" className="bg-white/10 hover:bg-white/20 text-white border-white/30 backdrop-blur-sm">
                                        <Palette className="w-4 h-4 mr-2" /> Personnaliser
                                    </Button>
                                </DialogTrigger>
                                <DialogContent className="sm:max-w-[400px] bg-[#fdfbf7] border-[#d4c5b0]">
                                    <DialogHeader>
                                        <DialogTitle className="text-[#4a3728]">Personnalisation</DialogTitle>
                                    </DialogHeader>
                                    <GameSettings user={user} onUpdate={() => {
                                        base44.auth.me().then(setUser);
                                        setIsSettingsOpen(false);
                                    }} />
                                </DialogContent>
                            </Dialog>
                        )}
                    </div>
                </div>

                <div className="px-8 pb-8 relative">
                    <div className="flex flex-col md:flex-row justify-between items-start gap-6 -mt-16">
                        {/* Avatar & Info */}
                        <div className="flex flex-col md:flex-row items-end md:items-end gap-6 z-10">
                            <motion.div 
                                initial={{ scale: 0, rotate: -20 }}
                                animate={{ scale: 1, rotate: 0 }}
                                transition={{ type: "spring", stiffness: 260, damping: 20 }}
                                className={`w-32 h-32 md:w-40 md:h-40 rounded-full bg-white p-1.5 shadow-2xl overflow-hidden border-4 border-[#e8dcc5] ${frames[user.avatar_frame || 'none']}`}
                            >
                                {user.avatar_url ? (
                                    <img src={user.avatar_url} alt="Profile" className="w-full h-full rounded-full object-cover" />
                                ) : (
                                    <div className="w-full h-full rounded-full bg-gradient-to-br from-gray-100 to-gray-300 flex items-center justify-center">
                                        <User className="w-16 h-16 text-gray-400" />
                                    </div>
                                )}
                            </motion.div>
                            <div className="mb-2 text-center md:text-left">
                                <h1 className="text-4xl font-black text-[#4a3728] drop-shadow-sm">{user.username || user.full_name || 'Joueur'}</h1>
                                
                                <div className="flex items-center justify-center md:justify-start gap-2 mb-2 mt-1">
                                    <div className="px-2 py-0.5 bg-yellow-100 text-yellow-800 rounded text-xs font-bold border border-yellow-200">
                                        Niveau {user.level || 1}
                                    </div>
                                    <div className="px-2 py-0.5 bg-blue-100 text-blue-800 rounded text-xs font-bold border border-blue-200">
                                        XP: {user.xp || 0}
                                    </div>
                                    <div className="px-2 py-0.5 bg-green-100 text-green-800 rounded text-xs font-bold border border-green-200 flex items-center gap-1">
                                        <Shield className="w-3 h-3" /> Dames: {stats.elo_checkers || 1200}
                                    </div>
                                    <div className="px-2 py-0.5 bg-purple-100 text-purple-800 rounded text-xs font-bold border border-purple-200 flex items-center gap-1">
                                        <Crown className="w-3 h-3" /> Échecs: {stats.elo_chess || 1200}
                                    </div>
                                    <div className="w-24 h-2 bg-gray-200 rounded-full overflow-hidden border border-gray-300">
                                        <div 
                                            className="h-full bg-yellow-500 transition-all duration-1000" 
                                            style={{ width: `${Math.min(100, ((user.xp || 0) % 500) / 5)}%` }}
                                            title={`Progression: ${(user.xp || 0) % 500} / 500 XP`}
                                        />
                                    </div>
                                </div>

                                <p className="text-gray-500 font-medium">{user.email}</p>
                                {user.bio && <p className="text-[#6b5138] mt-2 max-w-lg italic">"{user.bio}"</p>}
                            </div>
                        </div>

                        {/* Action Buttons */}
                        <div className="flex gap-3 mt-4 md:mt-16">
                            <Link to="/Messages">
                                <Button className="bg-[#4a3728] hover:bg-[#2c1e12] text-white shadow-md">
                                    <MessageSquare className="w-4 h-4 mr-2" /> Messages
                                </Button>
                            </Link>
                            {isOwnProfile && (
                                <Button 
                                    variant="destructive"
                                    onClick={async () => {
                                        try {
                                            await base44.auth.logout('/Home');
                                        } catch (e) {
                                            console.error(e);
                                            window.location.href = '/Home';
                                        }
                                    }}
                                    className="bg-red-600 hover:bg-red-700 text-white shadow-md"
                                >
                                    <LogOut className="w-4 h-4 mr-2" /> Déconnexion
                                </Button>
                            )}
                            {badges.length > 0 && (
                                <div className="flex -space-x-3 overflow-hidden py-2 ml-2">
                                    {badges.slice(0, 5).map((b, i) => (
                                        <div key={i} className="inline-block h-10 w-10 rounded-full ring-2 ring-white bg-yellow-100 flex items-center justify-center shadow-sm" title={b.name}>
                                            <Trophy className="w-5 h-5 text-yellow-600" />
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>

                    <Tabs defaultValue="overview" className="mt-12">
                        <TabsList className="grid w-full grid-cols-1 sm:grid-cols-4 h-auto bg-[#f5f0e6] mb-8 gap-1 p-1">
                            <TabsTrigger value="overview" className="data-[state=active]:bg-[#4a3728] data-[state=active]:text-[#e8dcc5] py-2">Vue d'ensemble</TabsTrigger>
                            <TabsTrigger value="stats" className="data-[state=active]:bg-[#4a3728] data-[state=active]:text-[#e8dcc5] py-2">Statistiques</TabsTrigger>
                            <TabsTrigger value="history" className="data-[state=active]:bg-[#4a3728] data-[state=active]:text-[#e8dcc5] py-2">Historique</TabsTrigger>
                            <TabsTrigger value="badges" className="data-[state=active]:bg-[#4a3728] data-[state=active]:text-[#e8dcc5] py-2">Badges</TabsTrigger>
                        </TabsList>

                        <TabsContent value="overview">
                            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-8">
                                <div className="lg:col-span-2 space-y-6">
                                    <div className="bg-white rounded-xl p-6 border border-[#d4c5b0] shadow-sm">
                                        <h3 className="text-lg font-bold text-[#4a3728] mb-4">Détails du joueur</h3>
                                        <div className="space-y-3 text-sm text-gray-700">
                                            <div className="flex items-center gap-2">
                                                <Globe className="w-4 h-4 text-gray-400" />
                                                <span>Pays: <span className="font-medium">{user.country || 'International'} 🌍</span></span>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <CalendarIcon className="w-4 h-4 text-gray-400" />
                                                <span>Membre depuis: <span className="font-medium">{format(new Date(user.created_date || Date.now()), 'd MMMM yyyy', { locale: fr })}</span></span>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <Clock className="w-4 h-4 text-gray-400" />
                                                <span>Actif: <span className="font-medium text-green-600">En ligne</span></span>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <Activity className="w-4 h-4 text-gray-400" />
                                                <span>Taux de complétion: <span className="font-medium">100%</span></span>
                                            </div>
                                            <div className="pt-2 border-t border-gray-100 mt-2">
                                                <p className="text-gray-500 mb-1">Temps total à jouer:</p>
                                                <p className="font-mono font-bold text-[#6b5138]">{Math.floor((stats.games_played * 15) / 60)} heures estimées</p>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                <div className="space-y-6">
                                    {/* Favorite Games */}
                                    <div className="bg-white/50 rounded-xl p-6 border border-[#d4c5b0]">
                                        <h3 className="text-lg font-bold text-[#4a3728] mb-4 flex items-center gap-2"><Star className="w-5 h-5 text-yellow-500 fill-yellow-500" /> Parties Favorites</h3>
                                        {favoriteGames.length > 0 ? (
                                            <div className="space-y-3">
                                                {favoriteGames.map(game => (
                                                    <div key={game.id} onClick={() => navigate(`/Game?id=${game.id}`)} className="flex justify-between items-center p-3 bg-white rounded-lg shadow-sm hover:bg-[#fdfbf7] cursor-pointer border border-transparent hover:border-[#d4c5b0] transition-all">
                                                        <div>
                                                            <div className="font-bold text-[#4a3728]">{game.game_type === 'chess' ? 'Échecs' : 'Dames'}</div>
                                                            <div className="text-xs text-gray-500">vs {game.white_player_id === user.id ? game.black_player_name : game.white_player_name}</div>
                                                        </div>
                                                        <Button size="sm" variant="ghost" className="text-[#6b5138] hover:text-[#4a3728]">Revoir</Button>
                                                    </div>
                                                ))}
                                            </div>
                                        ) : (
                                            <div className="flex flex-col items-center justify-center h-40 text-gray-400">
                                                <Star className="w-8 h-8 mb-2 opacity-20" />
                                                <p>Aucune partie favorite</p>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </TabsContent>

                        <TabsContent value="stats">
                            {/* Graph Section */}
                            <Card className="mb-8 border-[#d4c5b0] shadow-sm overflow-hidden">
                                <CardHeader className="bg-[#f9f6f0] border-b border-[#f0e6d2] py-3">
                                    <div className="flex justify-between items-center">
                                        <CardTitle className="text-lg text-[#4a3728] flex items-center gap-2">
                                            <TrendingUp className="w-5 h-5 text-green-600" /> Progression ELO
                                        </CardTitle>
                                        <div className="flex gap-2 text-xs">
                                            <Button variant="ghost" size="sm" className="h-7 px-2 bg-white border shadow-sm text-[#6b5138]">1m</Button>
                                            <Button variant="ghost" size="sm" className="h-7 px-2 text-gray-500 hover:text-[#6b5138]">6m</Button>
                                            <Button variant="ghost" size="sm" className="h-7 px-2 text-gray-500 hover:text-[#6b5138]">1y</Button>
                                            <Button variant="ghost" size="sm" className="h-7 px-2 text-gray-500 hover:text-[#6b5138]">All</Button>
                                        </div>
                                    </div>
                                </CardHeader>
                                <CardContent className="p-4 h-64">
                                    {chartData.length > 1 ? (
                                        <ResponsiveContainer width="100%" height="100%">
                                            <AreaChart data={chartData}>
                                                <defs>
                                                    <linearGradient id="colorElo" x1="0" y1="0" x2="0" y2="1">
                                                        <stop offset="5%" stopColor="#4a3728" stopOpacity={0.3}/>
                                                        <stop offset="95%" stopColor="#4a3728" stopOpacity={0}/>
                                                    </linearGradient>
                                                </defs>
                                                <CartesianGrid strokeDasharray="3 3" stroke="#f0e6d2" />
                                                <XAxis dataKey="name" hide />
                                                <YAxis domain={['auto', 'auto']} stroke="#8c7b6a" fontSize={12} />
                                                <Tooltip 
                                                    contentStyle={{ backgroundColor: '#fff', borderColor: '#d4c5b0', borderRadius: '8px' }}
                                                    labelStyle={{ display: 'none' }}
                                                    itemStyle={{ color: '#4a3728', fontWeight: 'bold' }}
                                                    formatter={(value, name, props) => [value, `${props.payload.game}`]}
                                                />
                                                <Area type="monotone" dataKey="elo" stroke="#4a3728" strokeWidth={2} fillOpacity={1} fill="url(#colorElo)" />
                                            </AreaChart>
                                        </ResponsiveContainer>
                                    ) : (
                                        <div className="flex items-center justify-center h-full text-gray-400">
                                            <p>Jouez plus de parties pour voir votre progression !</p>
                                        </div>
                                    )}
                                </CardContent>
                            </Card>

                            {/* Detailed Info Grid */}
                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
                                {/* Detailed Stats Section - Moved to Stats Tab, but kept a summary here if needed. 
                                    Actually, we moved charts to 'stats' tab. 
                                    So we just keep the structure clean here.
                                */}
                            </div>
                        </TabsContent>

                        <TabsContent value="stats">
                            <div className="bg-white rounded-xl p-6 border border-[#d4c5b0] shadow-sm mb-6">
                                <h3 className="text-lg font-bold text-[#4a3728] mb-4">Répartition des Performances</h3>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-8">
                                    <div className="h-60 flex flex-col items-center justify-center">
                                        <h4 className="text-sm font-bold text-gray-500 uppercase mb-2">Ratio Victoires/Défaites</h4>
                                        <ResponsiveContainer width="100%" height="100%">
                                            <PieChart>
                                                <Pie 
                                                    data={pieData} 
                                                    innerRadius={40} 
                                                    outerRadius={70} 
                                                    paddingAngle={5} 
                                                    dataKey="value"
                                                >
                                                    {pieData.map((entry, index) => (
                                                        <Cell key={`cell-${index}`} fill={entry.color} />
                                                    ))}
                                                </Pie>
                                                <Tooltip />
                                                <Legend verticalAlign="bottom" height={36} iconSize={10} />
                                            </PieChart>
                                        </ResponsiveContainer>
                                    </div>
                                    <div className="h-60 flex flex-col items-center justify-center">
                                        <h4 className="text-sm font-bold text-gray-500 uppercase mb-2">Modes de jeu préférés</h4>
                                        <ResponsiveContainer width="100%" height="100%">
                                            <PieChart>
                                                <Pie 
                                                    data={gameModeData} 
                                                    cx="50%" 
                                                    cy="50%" 
                                                    outerRadius={70} 
                                                    fill="#8884d8" 
                                                    dataKey="value" 
                                                    label={({name, percent}) => `${(percent * 100).toFixed(0)}%`}
                                                >
                                                    {gameModeData.map((entry, index) => (
                                                        <Cell key={`cell-${index}`} fill={entry.color} />
                                                    ))}
                                                </Pie>
                                                <Tooltip />
                                                <Legend verticalAlign="bottom" height={36} iconSize={10} />
                                            </PieChart>
                                        </ResponsiveContainer>
                                    </div>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
                                <Card className="bg-white border-[#d4c5b0] shadow-sm hover:shadow-md transition-shadow">
                                    <CardContent className="p-6 flex items-center justify-between">
                                        <div>
                                            <p className="text-gray-500 text-sm font-bold uppercase tracking-wide mb-1">Dames</p>
                                            <div className="text-4xl font-black text-[#4a3728]">{stats.elo_checkers || 1200}</div>
                                            <div className="flex items-center gap-2 mt-2">
                                                <span className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded-full font-bold">Rank #{ranks.checkers}</span>
                                                <span className="text-xs text-gray-400">{stats.games_played_checkers || 0} parties</span>
                                            </div>
                                        </div>
                                        <div className="w-16 h-16 bg-[#f5f0e6] rounded-full flex items-center justify-center">
                                            <Shield className="w-8 h-8 text-[#4a3728]" />
                                        </div>
                                    </CardContent>
                                </Card>
                                <Card className="bg-white border-[#d4c5b0] shadow-sm hover:shadow-md transition-shadow">
                                    <CardContent className="p-6 flex items-center justify-between">
                                        <div>
                                            <p className="text-gray-500 text-sm font-bold uppercase tracking-wide mb-1">Échecs</p>
                                            <div className="text-4xl font-black text-[#4a3728]">{stats.elo_chess || 1200}</div>
                                            <div className="flex items-center gap-2 mt-2">
                                                <span className="text-xs bg-purple-100 text-purple-800 px-2 py-1 rounded-full font-bold">Rank #{ranks.chess}</span>
                                                <span className="text-xs text-gray-400">{stats.games_played_chess || 0} parties</span>
                                            </div>
                                        </div>
                                        <div className="w-16 h-16 bg-[#f5f0e6] rounded-full flex items-center justify-center">
                                            <Crown className="w-8 h-8 text-[#4a3728]" />
                                        </div>
                                    </CardContent>
                                </Card>
                            </div>
                        </TabsContent>

                    <TabsContent value="history">
                        <Card className="bg-white/90 border-none">
                            <CardContent className="p-0">
                                {gameHistory.length === 0 ? (
                                    <div className="p-12 text-center text-gray-500">
                                        <History className="w-12 h-12 mx-auto opacity-20 mb-2" />
                                        <p>Aucun historique disponible.</p>
                                        <Link to="/" className="text-[#6b5138] hover:underline font-bold mt-2 inline-block">Jouer une partie !</Link>
                                    </div>
                                ) : (
                                    <div className="overflow-x-auto">
                                        <table className="w-full text-sm text-left">
                                            <thead className="text-xs text-gray-500 uppercase bg-gray-50">
                                                <tr>
                                                    <th className="px-6 py-3">Date</th>
                                                    <th className="px-6 py-3">Jeu</th>
                                                    <th className="px-6 py-3">Adversaire</th>
                                                    <th className="px-6 py-3 text-center">Résultat</th>
                                                    <th className="px-6 py-3 text-right">Action</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {gameHistory.map((game) => {
                                                    const isWhite = game.white_player_id === user.id;
                                                    const opponentName = isWhite ? game.black_player_name : game.white_player_name;
                                                    const isWinner = game.winner_id === user.id;
                                                    const isDraw = !game.winner_id;
                                                    return (
                                                        <tr key={game.id} className="bg-white border-b hover:bg-gray-50">
                                                            <td className="px-6 py-4 font-medium text-gray-900 whitespace-nowrap">
                                                                {format(new Date(game.updated_date), 'dd MMM yyyy', { locale: fr })}
                                                            </td>
                                                            <td className="px-6 py-4">
                                                                <span className={`px-2 py-1 rounded text-xs font-bold ${game.game_type === 'chess' ? 'bg-blue-100 text-blue-800' : 'bg-amber-100 text-amber-800'}`}>
                                                                    {game.game_type === 'chess' ? 'Échecs' : 'Dames'}
                                                                </span>
                                                            </td>
                                                            <td className="px-6 py-4">{opponentName || 'Anonyme'}</td>
                                                            <td className="px-6 py-4 text-center">
                                                                {isDraw ? (
                                                                    <span className="bg-gray-100 text-gray-800 text-xs font-medium px-2.5 py-0.5 rounded">Nul</span>
                                                                ) : isWinner ? (
                                                                    <span className="bg-green-100 text-green-800 text-xs font-medium px-2.5 py-0.5 rounded">Victoire</span>
                                                                ) : (
                                                                    <span className="bg-red-100 text-red-800 text-xs font-medium px-2.5 py-0.5 rounded">Défaite</span>
                                                                )}
                                                            </td>
                                                            <td className="px-6 py-4 text-right">
                                                                <Button size="sm" variant="outline" onClick={() => navigate(`/Game?id=${game.id}`)}>
                                                                    <History className="w-3 h-3 mr-1" /> Revoir
                                                                </Button>
                                                            </td>
                                                        </tr>
                                                    );
                                                })}
                                            </tbody>
                                        </table>
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                    </TabsContent>

                    <TabsContent value="badges">
                         <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                             {badges.length > 0 ? badges.map((badge, i) => (
                                 <Card key={i} className="bg-gradient-to-br from-yellow-50 to-white border-yellow-200 overflow-hidden relative group hover:shadow-lg transition-all">
                                     <div className="absolute top-0 right-0 p-2 opacity-10 group-hover:opacity-20 transition-opacity">
                                         <Award className="w-20 h-20 text-yellow-500" />
                                     </div>
                                     <CardContent className="p-6 text-center flex flex-col items-center z-10 relative">
                                         <div className="w-16 h-16 bg-yellow-100 rounded-full flex items-center justify-center mb-3 text-yellow-600 ring-4 ring-yellow-50">
                                             <Trophy className="w-8 h-8" />
                                         </div>
                                         <h3 className="font-bold text-[#4a3728] mb-1">{badge.name}</h3>
                                         <p className="text-xs text-gray-500 mb-2">{badge.description || 'Récompense prestigieuse'}</p>
                                         <p className="text-[10px] text-gray-400 uppercase tracking-widest">
                                             Obtenu le {format(new Date(badge.awarded_at), 'dd/MM/yyyy')}
                                         </p>
                                     </CardContent>
                                 </Card>
                             )) : (
                                 <div className="col-span-full text-center py-12 text-gray-500 bg-white/50 rounded-xl border border-dashed border-gray-300">
                                     <Award className="w-12 h-12 mx-auto text-gray-300 mb-2" />
                                     <p>Aucun badge débloqué pour le moment.</p>
                                     <p className="text-sm">Jouez des parties pour gagner des récompenses !</p>
                                 </div>
                             )}
                         </div>
                    </TabsContent>
                    </Tabs>
                </div>
            </div>
        </div>
    );
}