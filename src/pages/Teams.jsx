import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Users, Plus, Search, Shield } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';

export default function Teams() {
    const [teams, setTeams] = useState([]);
    const [loading, setLoading] = useState(true);
    const [isCreateOpen, setIsCreateOpen] = useState(false);
    const [newTeamName, setNewTeamName] = useState('');
    const [newTeamDesc, setNewTeamDesc] = useState('');
    const [searchQuery, setSearchQuery] = useState('');
    const [user, setUser] = useState(null);

    useEffect(() => {
        const init = async () => {
            const u = await base44.auth.me();
            setUser(u);
            fetchTeams();
        };
        init();
    }, []);

    const fetchTeams = async () => {
        setLoading(true);
        try {
            const list = await base44.entities.Team.list('-created_at', 50);
            setTeams(list);
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    const handleCreateTeam = async () => {
        if (!newTeamName) return toast.error("Nom requis");
        if (!user) return toast.error("Connectez-vous");

        try {
            // 1. Create Team
            const team = await base44.entities.Team.create({
                name: newTeamName,
                description: newTeamDesc,
                leader_id: user.id,
                created_at: new Date().toISOString()
            });

            // 2. Add Leader as Member
            await base44.entities.TeamMember.create({
                team_id: team.id,
                user_id: user.id,
                user_name: user.full_name || user.email,
                user_avatar: user.avatar_url,
                role: 'leader',
                status: 'active',
                joined_at: new Date().toISOString()
            });

            toast.success("Équipe créée !");
            setIsCreateOpen(false);
            fetchTeams();
        } catch (e) {
            console.error(e);
            toast.error("Erreur création équipe");
        }
    };

    const filteredTeams = teams.filter(t => 
        t.name.toLowerCase().includes(searchQuery.toLowerCase())
    );

    return (
        <div className="max-w-6xl mx-auto p-4 space-y-8">
            <div className="flex flex-col md:flex-row justify-between items-center gap-4">
                <div>
                    <h1 className="text-4xl font-black text-[#4a3728] flex items-center gap-3" style={{ fontFamily: 'Georgia, serif' }}>
                        <Shield className="w-10 h-10 text-[#d45c30]" /> ÉQUIPES
                    </h1>
                    <p className="text-[#6b5138]">Rejoignez un clan ou créez le vôtre pour la gloire !</p>
                </div>

                <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
                    <DialogTrigger asChild>
                        <Button className="bg-[#4a3728] hover:bg-[#2c1e12] text-[#e8dcc5] gap-2">
                            <Plus className="w-5 h-5" /> Créer une Équipe
                        </Button>
                    </DialogTrigger>
                    <DialogContent className="bg-[#fdfbf7] border-[#d4c5b0]">
                        <DialogHeader>
                            <DialogTitle>Nouvelle Équipe</DialogTitle>
                        </DialogHeader>
                        <div className="space-y-4 py-4">
                            <div className="space-y-2">
                                <Label>Nom de l'équipe</Label>
                                <Input 
                                    value={newTeamName}
                                    onChange={e => setNewTeamName(e.target.value)}
                                    placeholder="Les Lions de l'Atlas"
                                    className="border-[#d4c5b0]"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label>Description</Label>
                                <Input 
                                    value={newTeamDesc}
                                    onChange={e => setNewTeamDesc(e.target.value)}
                                    placeholder="Une devise ou une courte description..."
                                    className="border-[#d4c5b0]"
                                />
                            </div>
                        </div>
                        <DialogFooter>
                            <Button onClick={handleCreateTeam} className="bg-[#4a3728]">Créer</Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>
            </div>

            <div className="flex items-center gap-2 bg-white p-2 rounded-lg border border-[#d4c5b0] max-w-md">
                <Search className="w-5 h-5 text-gray-400" />
                <Input 
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    placeholder="Rechercher une équipe..."
                    className="border-none shadow-none focus-visible:ring-0"
                />
            </div>

            {loading ? (
                <div className="text-center p-8">Chargement...</div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {filteredTeams.map(team => (
                        <Link key={team.id} to={`/TeamDetail?id=${team.id}`}>
                            <Card className="hover:shadow-lg transition-all cursor-pointer border-[#d4c5b0] bg-white/80 h-full">
                                <CardHeader className="flex flex-row items-center gap-4 pb-2">
                                    <div className="w-12 h-12 rounded-lg bg-[#4a3728] flex items-center justify-center text-[#e8dcc5]">
                                        <Users className="w-6 h-6" />
                                    </div>
                                    <div>
                                        <CardTitle className="text-xl text-[#4a3728]">{team.name}</CardTitle>
                                        <div className="text-xs text-gray-500">
                                            Créé le {new Date(team.created_at).toLocaleDateString()}
                                        </div>
                                    </div>
                                </CardHeader>
                                <CardContent>
                                    <p className="text-gray-600 text-sm line-clamp-2 h-10">
                                        {team.description || "Aucune description"}
                                    </p>
                                    <div className="mt-4 flex gap-4 text-xs font-bold text-[#6b5138]">
                                        <div>🏆 {team.stats?.tournament_wins || 0} Titres</div>
                                        <div>⚔️ {team.stats?.wins || 0} Victoires</div>
                                    </div>
                                </CardContent>
                            </Card>
                        </Link>
                    ))}
                    {filteredTeams.length === 0 && (
                        <div className="col-span-full text-center p-12 text-gray-400 border-2 border-dashed rounded-xl">
                            Aucune équipe trouvée.
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}