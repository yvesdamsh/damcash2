import React, { useEffect, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Trophy, Calendar, Users, Plus, ArrowRight, Crown, Gamepad2 } from 'lucide-react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';

export default function Tournaments() {
    const [tournaments, setTournaments] = useState([]);
    const [user, setUser] = useState(null);
    const [isCreateOpen, setIsCreateOpen] = useState(false);
    const [newTournament, setNewTournament] = useState({
        name: '',
        game_type: 'checkers',
        max_players: '8',
        start_date: ''
    });

    useEffect(() => {
        const init = async () => {
            try {
                const u = await base44.auth.me();
                setUser(u);
                // Ensure tournaments exist
                await base44.functions.invoke('tournamentManager', {});
                fetchTournaments();
            } catch (e) {
                console.error(e);
            }
        };
        init();
    }, []);

    const fetchTournaments = async () => {
        const list = await base44.entities.Tournament.list('-start_date', 20);
        setTournaments(list);
    };

    const handleCreate = async () => {
        if (!newTournament.name || !newTournament.start_date) {
            toast.error("Veuillez remplir tous les champs");
            return;
        }
        try {
            await base44.entities.Tournament.create({
                ...newTournament,
                max_players: parseInt(newTournament.max_players),
                status: 'open'
            });
            toast.success("Tournoi créé !");
            setIsCreateOpen(false);
            fetchTournaments();
        } catch (e) {
            toast.error("Erreur lors de la création");
        }
    };

    return (
        <div className="max-w-6xl mx-auto p-4 md:p-8">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
                <div>
                    <h1 className="text-4xl font-bold text-[#4a3728] flex items-center gap-3" style={{ fontFamily: 'Georgia, serif' }}>
                        <Trophy className="w-10 h-10 text-yellow-600" /> Tournois
                    </h1>
                    <p className="text-[#6b5138] mt-2">Affrontez les meilleurs joueurs et remportez la coupe !</p>
                </div>
                
                <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
                    <DialogTrigger asChild>
                        <Button className="bg-[#4a3728] hover:bg-[#2c1e12] text-[#e8dcc5] gap-2 shadow-lg">
                            <Plus className="w-5 h-5" /> Créer un tournoi
                        </Button>
                    </DialogTrigger>
                    <DialogContent className="bg-[#fdfbf7] border-[#d4c5b0]">
                        <DialogHeader>
                            <DialogTitle className="text-[#4a3728]">Nouveau Tournoi</DialogTitle>
                        </DialogHeader>
                        <div className="grid gap-4 py-4">
                            <div className="grid gap-2">
                                <Label>Nom du tournoi</Label>
                                <Input 
                                    value={newTournament.name} 
                                    onChange={e => setNewTournament({...newTournament, name: e.target.value})}
                                    placeholder="Ex: Coupe du Printemps"
                                    className="border-[#d4c5b0]"
                                />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="grid gap-2">
                                    <Label>Jeu</Label>
                                    <Select 
                                        value={newTournament.game_type} 
                                        onValueChange={v => setNewTournament({...newTournament, game_type: v})}
                                    >
                                        <SelectTrigger className="border-[#d4c5b0]">
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="checkers">Dames</SelectItem>
                                            <SelectItem value="chess">Échecs</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="grid gap-2">
                                    <Label>Joueurs Max</Label>
                                    <Select 
                                        value={newTournament.max_players} 
                                        onValueChange={v => setNewTournament({...newTournament, max_players: v})}
                                    >
                                        <SelectTrigger className="border-[#d4c5b0]">
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="4">4</SelectItem>
                                            <SelectItem value="8">8</SelectItem>
                                            <SelectItem value="16">16</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>
                            <div className="grid gap-2">
                                <Label>Date de début</Label>
                                <Input 
                                    type="datetime-local"
                                    value={newTournament.start_date} 
                                    onChange={e => setNewTournament({...newTournament, start_date: e.target.value})}
                                    className="border-[#d4c5b0]"
                                />
                            </div>
                        </div>
                        <DialogFooter>
                            <Button onClick={handleCreate} className="bg-[#4a3728] hover:bg-[#2c1e12]">Créer</Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {tournaments.map(t => (
                    <Card key={t.id} className="bg-white/90 border-[#d4c5b0] shadow-md hover:shadow-xl transition-all group">
                        <CardHeader className="pb-3">
                            <div className="flex justify-between items-start">
                                <div className={`px-2 py-1 rounded text-xs font-bold uppercase tracking-wide mb-2 inline-block ${
                                    t.status === 'open' ? 'bg-green-100 text-green-800' : 
                                    t.status === 'ongoing' ? 'bg-blue-100 text-blue-800' : 'bg-gray-100 text-gray-800'
                                }`}>
                                    {t.status === 'open' ? 'Inscriptions ouvertes' : 
                                     t.status === 'ongoing' ? 'En cours' : 'Terminé'}
                                </div>
                                <div className="text-[#8c7b6a]">
                                    {t.game_type === 'chess' ? <Crown className="w-5 h-5" /> : <Gamepad2 className="w-5 h-5" />}
                                </div>
                            </div>
                            <CardTitle className="text-xl text-[#4a3728] group-hover:text-[#6b5138] transition-colors">
                                {t.name}
                            </CardTitle>
                            <CardDescription className="flex items-center gap-2">
                                <Calendar className="w-3 h-3" />
                                {format(new Date(t.start_date), 'dd MMM yyyy à HH:mm', { locale: fr })}
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            <div className="flex items-center justify-between text-sm text-gray-600 bg-[#f5f0e6] p-3 rounded-lg">
                                <div className="flex items-center gap-2">
                                    <Users className="w-4 h-4" />
                                    <span>Participants</span>
                                </div>
                                <span className="font-bold">{t.current_round || 0} / {t.max_players}</span>
                            </div>
                        </CardContent>
                        <CardFooter>
                            <Link to={`/TournamentDetail?id=${t.id}`} className="w-full">
                                <Button className="w-full bg-[#e8dcc5] hover:bg-[#d4c5b0] text-[#4a3728] border border-[#d4c5b0] group-hover:bg-[#4a3728] group-hover:text-[#e8dcc5] transition-all">
                                    Voir le tournoi <ArrowRight className="w-4 h-4 ml-2" />
                                </Button>
                            </Link>
                        </CardFooter>
                    </Card>
                ))}
            </div>

            {tournaments.length === 0 && (
                <div className="text-center py-20 bg-white/50 rounded-xl border-2 border-dashed border-[#d4c5b0]">
                    <Trophy className="w-16 h-16 mx-auto text-[#d4c5b0] mb-4" />
                    <h3 className="text-xl font-bold text-[#6b5138]">Aucun tournoi pour le moment</h3>
                    <p className="text-gray-500">Soyez le premier à en créer un !</p>
                </div>
            )}
        </div>
    );
}