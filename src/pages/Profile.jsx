import React, { useEffect, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { User, Activity, Shield, Edit, Camera, History, Save, Trophy, Star, MapPin, Globe, Crown } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';

export default function Profile() {
    const [user, setUser] = useState(null);
    const [stats, setStats] = useState(null);
    const [ranks, setRanks] = useState({ checkers: '-', chess: '-' });
    const [favoriteGames, setFavoriteGames] = useState([]);
    const [isEditing, setIsEditing] = useState(false);
    const [editForm, setEditForm] = useState({ username: '', full_name: '', avatar_url: '', bio: '' });
    const [uploading, setUploading] = useState(false);
    const navigate = useNavigate();

    useEffect(() => {
        const init = async () => {
            try {
                const u = await base44.auth.me();
                setUser(u);
                setEditForm({ 
                    username: u.username || '', 
                    full_name: u.full_name || '',
                    avatar_url: u.avatar_url || '',
                    bio: u.bio || ''
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

            } catch (e) {
                console.error(e);
                base44.auth.redirectToLogin();
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
                bio: editForm.bio
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
                <div className="h-48 bg-gradient-to-r from-[#4a3728] to-[#2c1e12] relative overflow-hidden">
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
                                className="w-32 h-32 md:w-40 md:h-40 rounded-full bg-white p-1.5 shadow-2xl overflow-hidden border-4 border-[#e8dcc5]"
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
                            <Link to="/GameHistory">
                                <Button variant="outline" className="border-[#6b5138] text-[#6b5138] hover:bg-[#6b5138] hover:text-white shadow-sm">
                                    <History className="w-4 h-4 mr-2" /> Historique
                                </Button>
                            </Link>
                        </div>
                    </div>

                    {/* Stats Grid */}
                    <div className="mt-12 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
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
                </div>
            </div>
        </div>
    );
}