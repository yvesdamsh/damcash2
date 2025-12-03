import React, { useEffect, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { User, Activity, Shield, Edit, Camera, History, Save, Trophy, Star, MapPin, Globe, Crown, Palette, Medal, Award, Clock, Layout, MessageSquare } from 'lucide-react';
import GameSettings from '@/components/GameSettings';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

export default function Profile() {
    const [user, setUser] = useState(null);
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
        bio: '',
        profile_theme: 'default',
        avatar_frame: 'none'
    });
    const [uploading, setUploading] = useState(false);
    const navigate = useNavigate();

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
                const u = await base44.auth.me();
                setUser(u);
                setEditForm({ 
                    username: u.username || '', 
                    full_name: u.full_name || '',
                    avatar_url: u.avatar_url || '',
                    bio: u.bio || '',
                    profile_theme: u.profile_theme || 'default',
                    avatar_frame: u.avatar_frame || 'none'
                });

                const allStats = await base44.entities.User.list();
                const myStats = allStats.find(s => s.created_by === u.email) || {
                    elo_checkers: 1200, elo_chess: 1200, 
                    wins_checkers: 0, losses_checkers: 0,
                    wins_chess: 0, losses_chess: 0,
                    games_played: 0
                };
                setStats(myStats);

                // Calculate Ranks
                const sortedCheckers = [...allStats].sort((a, b) => (b.elo_checkers || 1200) - (a.elo_checkers || 1200));
                const myCheckersRank = sortedCheckers.findIndex(s => s.created_by === u.email) + 1;

                const sortedChess = [...allStats].sort((a, b) => (b.elo_chess || 1200) - (a.elo_chess || 1200));
                const myChessRank = sortedChess.findIndex(s => s.created_by === u.email) + 1;

                setRanks({ checkers: myCheckersRank, chess: myChessRank });

                // Fetch Favorites
                if (u.favorite_games && u.favorite_games.length > 0) {
                    const favs = await Promise.all(u.favorite_games.map(id => base44.entities.Game.get(id).catch(() => null)));
                    setFavoriteGames(favs.filter(g => g));
                }

                // Fetch History
                const [whiteGames, blackGames] = await Promise.all([
                    base44.entities.Game.filter({ white_player_id: u.id, status: 'finished' }, '-updated_date', 20),
                    base44.entities.Game.filter({ black_player_id: u.id, status: 'finished' }, '-updated_date', 20)
                ]);
                const history = [...whiteGames, ...blackGames]
                    .filter((g, index, self) => index === self.findIndex(t => t.id === g.id))
                    .sort((a, b) => new Date(b.updated_date) - new Date(a.updated_date));
                setGameHistory(history);

                // Badges
                const userBadges = await checkAndAwardBadges(u, myStats);
                setBadges(userBadges);

            } catch (e) {
                console.error(e);
                base44.auth.redirectToLogin('/Home');
            }
        };
        init();
    }, []);

    const handleFileUpload = async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        
        setUploading(true);
        try {
            const { file_url } = await base44.integrations.Core.UploadFile({ file: file });
            setEditForm(prev => ({ ...prev, avatar_url: file_url }));
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

    return (
        <div className="max-w-5xl mx-auto p-4 pb-20">
            <div className="bg-white/90 backdrop-blur rounded-3xl shadow-2xl border border-[#d4c5b0] overflow-hidden mb-8">
                {/* Cover / Header */}
                <div className={`h-48 ${themes[user.profile_theme || 'default']} relative overflow-hidden transition-all duration-500`}>
                    <motion.div 
                        initial={{ opacity: 0, scale: 2 }}
                        animate={{ opacity: 0.1, scale: 1 }}
                        transition={{ duration: 1.5, ease: "circOut" }}
                        className="absolute inset-0 flex items-center justify-center pointer-events-none select-none"
                    >
                        <span className="text-9xl font-black text-[#e8dcc5] tracking-tighter opacity-20">DAMCASH</span>
                    </motion.div>
                    <div className="absolute bottom-4 right-8 z-20">
                        <Dialog open={isEditing} onOpenChange={setIsEditing}>
                            <DialogTrigger asChild>
                                <Button variant="secondary" className="bg-white/10 hover:bg-white/20 text-white border-white/30 backdrop-blur-sm">
                                    <Edit className="w-4 h-4 mr-2" /> Modifier le profil
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
                                            <input type="file" accept="image/*" onChange={handleFileUpload} className="absolute inset-0 opacity-0 cursor-pointer" />
                                        </div>
                                        {uploading && <span className="text-xs text-blue-500 animate-pulse">Téléchargement...</span>}
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
                        <Dialog open={isSettingsOpen} onOpenChange={setIsSettingsOpen}>
                            <DialogTrigger asChild>
                                <Button variant="secondary" className="bg-white/10 hover:bg-white/20 text-white border-white/30 backdrop-blur-sm ml-2">
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
                        <TabsList className="grid w-full grid-cols-3 bg-[#f5f0e6] mb-8">
                            <TabsTrigger value="overview" className="data-[state=active]:bg-[#4a3728] data-[state=active]:text-[#e8dcc5]">Vue d'ensemble</TabsTrigger>
                            <TabsTrigger value="history" className="data-[state=active]:bg-[#4a3728] data-[state=active]:text-[#e8dcc5]">Historique</TabsTrigger>
                            <TabsTrigger value="badges" className="data-[state=active]:bg-[#4a3728] data-[state=active]:text-[#e8dcc5]">Badges & Trophées</TabsTrigger>
                        </TabsList>

                        <TabsContent value="overview">
                            {/* Stats Grid */}
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                        <Card className="bg-gradient-to-br from-[#6b5138] to-[#4a3728] text-white border-none shadow-lg transform hover:-translate-y-1 transition-transform duration-300">
                            <CardContent className="p-6 flex items-center justify-between">
                                <div>
                                    <p className="text-white/80 text-sm font-medium mb-1">Classement Global</p>
                                    <div className="text-3xl font-bold flex items-baseline gap-1">
                                        <span className="text-xs">#</span>{Math.min(ranks.checkers, ranks.chess) === 0 ? '-' : Math.min(ranks.checkers, ranks.chess)}
                                    </div>
                                    <p className="text-xs text-white/60 mt-1">Top Player</p>
                                </div>
                                <div className="bg-white/20 p-3 rounded-full">
                                    <Globe className="w-6 h-6 text-white" />
                                </div>
                            </CardContent>
                        </Card>

                        <Card className="bg-white border-[#d4c5b0] shadow-md hover:shadow-lg transition-shadow">
                            <CardContent className="p-6 flex items-center justify-between">
                                <div>
                                    <p className="text-gray-500 text-sm font-medium mb-1">Dames</p>
                                    <div className="text-3xl font-bold text-[#4a3728]">{stats.elo_checkers || 1200}</div>
                                    <p className="text-xs text-green-600 font-bold mt-1">Rank #{ranks.checkers}</p>
                                </div>
                                <div className="bg-[#f5f0e6] p-3 rounded-full">
                                    <Shield className="w-6 h-6 text-[#6b5138]" />
                                </div>
                            </CardContent>
                        </Card>

                        <Card className="bg-white border-[#d4c5b0] shadow-md hover:shadow-lg transition-shadow">
                            <CardContent className="p-6 flex items-center justify-between">
                                <div>
                                    <p className="text-gray-500 text-sm font-medium mb-1">Échecs</p>
                                    <div className="text-3xl font-bold text-[#4a3728]">{stats.elo_chess || 1200}</div>
                                    <p className="text-xs text-green-600 font-bold mt-1">Rank #{ranks.chess}</p>
                                </div>
                                <div className="bg-[#f5f0e6] p-3 rounded-full">
                                    <Crown className="w-6 h-6 text-[#6b5138]" />
                                </div>
                            </CardContent>
                        </Card>

                        <Card className="bg-white border-[#d4c5b0] shadow-md hover:shadow-lg transition-shadow">
                            <CardContent className="p-6 flex items-center justify-between">
                                <div>
                                    <p className="text-gray-500 text-sm font-medium mb-1">Victoires</p>
                                    <div className="text-3xl font-bold text-[#4a3728]">{winRate}%</div>
                                    <p className="text-xs text-gray-400 mt-1">{totalWins} Victoires - {totalLosses} Défaites</p>
                                </div>
                                <div className="bg-[#f5f0e6] p-3 rounded-full">
                                    <Trophy className="w-6 h-6 text-[#6b5138]" />
                                </div>
                            </CardContent>
                        </Card>
                    </div>

                    {/* Detailed Stats */}
                    <div className="mt-8 grid grid-cols-1 md:grid-cols-2 gap-8">
                         <div className="bg-white/50 rounded-xl p-6 border border-[#d4c5b0]">
                             <h3 className="text-lg font-bold text-[#4a3728] mb-4 flex items-center gap-2"><Activity className="w-5 h-5" /> Statistiques Détaillées</h3>
                             <div className="space-y-4">
                                 <div className="flex justify-between items-center p-3 bg-white rounded-lg shadow-sm">
                                     <span className="text-gray-600">Parties Jouées</span>
                                     <span className="font-bold text-[#4a3728]">{stats.games_played}</span>
                                 </div>
                                 <div className="flex justify-between items-center p-3 bg-white rounded-lg shadow-sm">
                                     <span className="text-gray-600">Victoires Dames</span>
                                     <span className="font-bold text-green-600">{stats.wins_checkers}</span>
                                 </div>
                                 <div className="flex justify-between items-center p-3 bg-white rounded-lg shadow-sm">
                                     <span className="text-gray-600">Victoires Échecs</span>
                                     <span className="font-bold text-green-600">{stats.wins_chess}</span>
                                 </div>
                             </div>
                         </div>

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
                                     <p className="text-xs mt-1">Marquez des parties pour les voir ici.</p>
                                 </div>
                             )}
                         </div>
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