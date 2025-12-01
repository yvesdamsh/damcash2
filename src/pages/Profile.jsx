import React, { useEffect, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { User, Activity, Calendar, Shield, Edit, Camera, History, Save } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';

export default function Profile() {
    const [user, setUser] = useState(null);
    const [stats, setStats] = useState(null);
    const [isEditing, setIsEditing] = useState(false);
    const [editForm, setEditForm] = useState({ username: '', full_name: '', avatar_url: '', bio: '' });
    const [uploading, setUploading] = useState(false);

    useEffect(() => {
        const init = async () => {
            try {
                const u = await base44.auth.me();
                setUser(u);
                setEditForm({ 
                    username: u.username || '', 
                    full_name: u.full_name || '',
                    avatar_url: u.avatar_url || ''
                });

                // Fetch user stats
                // Note: We can now rely on user object for stats if updated correctly, 
                // but for safety we'll keep fetching from the entity list if that's how it was set up.
                // Actually, let's try to use the user object itself first if stats are there.
                
                // The snapshot implied 'stats' were fetched separately. 
                // We'll stick to fetching to be safe, but map fields correctly.
                const allStats = await base44.entities.User.list();
                const myStats = allStats.find(s => s.created_by === u.email) || {
                    elo_checkers: 1200, elo_chess: 1200, 
                    wins_checkers: 0, losses_checkers: 0,
                    wins_chess: 0, losses_chess: 0,
                    games_played: 0
                };
                setStats(myStats);
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
            // Using integration to upload file
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
            // Update built-in user and extended attributes
            await base44.auth.updateMe({
                username: editForm.username,
                full_name: editForm.full_name,
                avatar_url: editForm.avatar_url
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
        <div className="max-w-4xl mx-auto p-4">
            <div className="bg-white/90 backdrop-blur rounded-2xl shadow-xl border border-[#d4c5b0] overflow-hidden">
                <div className="h-32 bg-[#4a3728] relative overflow-hidden">
                    <motion.div 
                        initial={{ opacity: 0, scale: 2 }}
                        animate={{ opacity: 0.1, scale: 1 }}
                        transition={{ duration: 1.5, ease: "circOut" }}
                        className="absolute inset-0 flex items-center justify-center pointer-events-none select-none"
                    >
                        <span className="text-9xl font-black text-[#e8dcc5] tracking-tighter">DAMCASH</span>
                    </motion.div>
                    <div className="absolute -bottom-12 left-8 group z-10">
                        <motion.div 
                            initial={{ scale: 0, rotate: -180 }}
                            animate={{ scale: 1, rotate: 0 }}
                            transition={{ type: "spring", stiffness: 260, damping: 20, delay: 0.3 }}
                            className="w-24 h-24 rounded-full bg-white p-1 shadow-lg relative overflow-hidden"
                        >
                            {user.avatar_url ? (
                                <img src={user.avatar_url} alt="Profile" className="w-full h-full rounded-full object-cover" />
                            ) : (
                                <div className="w-full h-full rounded-full bg-gradient-to-br from-gray-200 to-gray-400 flex items-center justify-center">
                                    <User className="w-12 h-12 text-gray-600" />
                                </div>
                            )}
                        </motion.div>
                    </div>
                    <div className="absolute bottom-4 right-8">
                        <Dialog open={isEditing} onOpenChange={setIsEditing}>
                            <DialogTrigger asChild>
                                <Button variant="secondary" className="bg-white/20 hover:bg-white/30 text-white border-white/50">
                                    <Edit className="w-4 h-4 mr-2" /> Modifier le profil
                                </Button>
                            </DialogTrigger>
                            <DialogContent className="sm:max-w-[425px]">
                                <DialogHeader>
                                    <DialogTitle>Modifier le profil</DialogTitle>
                                </DialogHeader>
                                <div className="grid gap-4 py-4">
                                    <div className="flex flex-col items-center gap-4">
                                        <div className="w-24 h-24 rounded-full overflow-hidden bg-gray-100 relative group cursor-pointer border-2 border-dashed border-gray-300 hover:border-gray-400">
                                            {editForm.avatar_url ? (
                                                <img src={editForm.avatar_url} alt="Preview" className="w-full h-full object-cover" />
                                            ) : (
                                                <div className="flex items-center justify-center w-full h-full text-gray-400"><User className="w-8 h-8" /></div>
                                            )}
                                            <div className="absolute inset-0 bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                                <Camera className="w-6 h-6 text-white" />
                                            </div>
                                            <input type="file" accept="image/*" onChange={handleFileUpload} className="absolute inset-0 opacity-0 cursor-pointer" />
                                        </div>
                                        {uploading && <span className="text-xs text-blue-500">Téléchargement...</span>}
                                    </div>
                                    <div className="grid gap-2">
                                        <Label htmlFor="username">Nom d'utilisateur</Label>
                                        <Input id="username" value={editForm.username} onChange={(e) => setEditForm({...editForm, username: e.target.value})} placeholder="Pseudo" />
                                    </div>
                                    <div className="grid gap-2">
                                        <Label htmlFor="name">Nom complet</Label>
                                        <Input id="name" value={editForm.full_name} onChange={(e) => setEditForm({...editForm, full_name: e.target.value})} placeholder="Nom Prénom" />
                                    </div>
                                </div>
                                <div className="flex justify-end">
                                    <Button onClick={handleSaveProfile} className="bg-[#4a3728] hover:bg-[#2c1e12]">
                                        <Save className="w-4 h-4 mr-2" /> Enregistrer
                                    </Button>
                                </div>
                            </DialogContent>
                        </Dialog>
                    </div>
                </div>

                <div className="pt-16 px-8 pb-8">
                    <div className="flex flex-col md:flex-row justify-between items-start mb-8 gap-4">
                        <motion.div
                            initial={{ opacity: 0, x: -20 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: 0.4 }}
                        >
                            <h1 className="text-3xl font-bold text-[#4a3728]">{user.username || user.full_name || 'Joueur'}</h1>
                            <p className="text-gray-500">{user.email}</p>
                            {user.username && user.full_name && <p className="text-sm text-gray-400">{user.full_name}</p>}
                        </motion.div>
                        <div className="flex gap-3">
                            <Link to="/GameHistory">
                                <Button variant="outline" className="border-[#6b5138] text-[#6b5138] hover:bg-[#6b5138] hover:text-white">
                                    <History className="w-4 h-4 mr-2" /> Historique des parties
                                </Button>
                            </Link>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
                        {[
                            { title: "ELO Moyen", value: avgElo, icon: Activity },
                            { title: "Dames (ELO)", value: stats.elo_checkers || 1200, icon: Shield },
                            { title: "Échecs (ELO)", value: stats.elo_chess || 1200, icon: Shield },
                            { title: "Ratio Victoires", value: `${winRate}%`, sub: `${totalWins}V / ${totalLosses}D`, icon: Trophy }
                        ].map((item, index) => (
                            <motion.div
                                key={index}
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: 0.5 + (index * 0.1) }}
                                whileHover={{ scale: 1.05, rotate: 1 }}
                                className="h-full"
                            >
                                <Card className="h-full border-none shadow-md bg-gradient-to-br from-white to-[#fdfbf7] hover:shadow-lg transition-shadow">
                                    <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
                                        <CardTitle className="text-sm font-medium text-gray-500">{item.title}</CardTitle>
                                        <item.icon className="w-4 h-4 text-[#d4c5b0]" />
                                    </CardHeader>
                                    <CardContent>
                                        <div className="text-2xl font-bold text-[#4a3728]">{item.value}</div>
                                        {item.sub && <p className="text-xs text-gray-500 mt-1">{item.sub}</p>}
                                    </CardContent>
                                </Card>
                            </motion.div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
}