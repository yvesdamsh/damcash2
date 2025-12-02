import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useLocation, Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Users, Shield, Calendar, ArrowLeft, Check, X, Crown } from 'lucide-react';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';

export default function TeamDetail() {
    const location = useLocation();
    const params = new URLSearchParams(location.search);
    const id = params.get('id');

    const [team, setTeam] = useState(null);
    const [members, setMembers] = useState([]);
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const init = async () => {
            if (!id) return;
            try {
                const u = await base44.auth.me();
                setUser(u);

                const [tData, mData] = await Promise.all([
                    base44.entities.Team.get(id),
                    base44.entities.TeamMember.filter({ team_id: id })
                ]);
                setTeam(tData);
                setMembers(mData);
            } catch (e) {
                console.error(e);
            } finally {
                setLoading(false);
            }
        };
        init();
    }, [id]);

    const isLeader = team && user && team.leader_id === user.id;
    const myMembership = members.find(m => m.user_id === user?.id);
    const activeMembers = members.filter(m => m.status === 'active');
    const pendingMembers = members.filter(m => m.status === 'pending');

    const handleJoin = async () => {
        if (!user) return toast.error("Connectez-vous");
        try {
            const newMember = await base44.entities.TeamMember.create({
                team_id: team.id,
                user_id: user.id,
                user_name: user.full_name || user.email,
                user_avatar: user.avatar_url,
                role: 'member',
                status: 'pending',
                joined_at: new Date().toISOString()
            });
            setMembers([...members, newMember]);
            toast.success("Demande envoyée !");
        } catch (e) {
            toast.error("Erreur lors de la demande");
        }
    };

    const handleLeave = async () => {
        if (!myMembership) return;
        if (isLeader && activeMembers.length > 1) {
            return toast.error("Le chef ne peut pas quitter s'il reste des membres. Transférez le leadership ou dissolvez l'équipe.");
        }
        try {
            await base44.entities.TeamMember.delete(myMembership.id);
            if (isLeader && activeMembers.length === 1) {
                // Delete Team if last member leaves
                await base44.entities.Team.delete(team.id);
                window.location.href = '/Teams';
                return;
            }
            setMembers(members.filter(m => m.id !== myMembership.id));
            toast.success("Vous avez quitté l'équipe");
        } catch (e) {
            toast.error("Erreur");
        }
    };

    const handleAction = async (memberId, action) => {
        try {
            if (action === 'accept') {
                await base44.entities.TeamMember.update(memberId, { status: 'active' });
                setMembers(members.map(m => m.id === memberId ? { ...m, status: 'active' } : m));
                toast.success("Membre accepté");
            } else if (action === 'kick' || action === 'reject') {
                await base44.entities.TeamMember.delete(memberId);
                setMembers(members.filter(m => m.id !== memberId));
                toast.success(action === 'kick' ? "Membre exclu" : "Demande rejetée");
            }
        } catch (e) {
            toast.error("Erreur action");
        }
    };

    if (loading) return <div className="p-8 text-center">Chargement...</div>;
    if (!team) return <div className="p-8 text-center">Équipe introuvable</div>;

    return (
        <div className="max-w-5xl mx-auto p-4 space-y-6">
            <Link to="/Teams">
                <Button variant="ghost" className="gap-2 text-gray-600">
                    <ArrowLeft className="w-4 h-4" /> Retour aux équipes
                </Button>
            </Link>

            <div className="bg-white rounded-xl shadow-lg overflow-hidden border border-[#d4c5b0]">
                <div className="h-32 bg-gradient-to-r from-[#4a3728] to-[#2c1e12] relative">
                    <div className="absolute -bottom-10 left-8 p-1 bg-white rounded-xl">
                        <div className="w-20 h-20 bg-gray-100 rounded-lg flex items-center justify-center text-[#4a3728]">
                             {team.avatar_url ? <img src={team.avatar_url} className="w-full h-full object-cover rounded-lg" /> : <Shield className="w-10 h-10" />}
                        </div>
                    </div>
                </div>
                <div className="pt-12 pb-6 px-8">
                    <div className="flex justify-between items-start">
                        <div>
                            <h1 className="text-3xl font-black text-[#4a3728]">{team.name}</h1>
                            <p className="text-gray-600 mt-1">{team.description}</p>
                            <div className="flex gap-4 mt-4 text-sm text-gray-500">
                                <div className="flex items-center gap-1">
                                    <Users className="w-4 h-4" /> {activeMembers.length} Membres
                                </div>
                                <div className="flex items-center gap-1">
                                    <Calendar className="w-4 h-4" /> Créé le {new Date(team.created_at).toLocaleDateString()}
                                </div>
                            </div>
                        </div>
                        <div>
                            {!myMembership && (
                                <Button onClick={handleJoin} className="bg-green-600 hover:bg-green-700">
                                    Rejoindre l'équipe
                                </Button>
                            )}
                            {myMembership && myMembership.status === 'active' && (
                                <Button onClick={handleLeave} variant="outline" className="text-red-600 border-red-200 hover:bg-red-50">
                                    Quitter
                                </Button>
                            )}
                            {myMembership && myMembership.status === 'pending' && (
                                <Button disabled variant="secondary">Demande envoyée</Button>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            <Tabs defaultValue="members" className="w-full">
                <TabsList className="bg-[#e8dcc5]">
                    <TabsTrigger value="members" className="data-[state=active]:bg-[#4a3728] data-[state=active]:text-[#e8dcc5]">Membres</TabsTrigger>
                    {isLeader && <TabsTrigger value="requests" className="data-[state=active]:bg-[#4a3728] data-[state=active]:text-[#e8dcc5]">Demandes ({pendingMembers.length})</TabsTrigger>}
                    <TabsTrigger value="stats" className="data-[state=active]:bg-[#4a3728] data-[state=active]:text-[#e8dcc5]">Statistiques</TabsTrigger>
                </TabsList>

                <TabsContent value="members" className="mt-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {activeMembers.map(member => (
                            <Card key={member.id} className="flex items-center justify-between p-4">
                                <div className="flex items-center gap-3">
                                    <Avatar>
                                        <AvatarImage src={member.user_avatar} />
                                        <AvatarFallback>{member.user_name?.[0]}</AvatarFallback>
                                    </Avatar>
                                    <div>
                                        <div className="font-bold flex items-center gap-2">
                                            {member.user_name}
                                            {member.role === 'leader' && <Crown className="w-4 h-4 text-yellow-500" />}
                                        </div>
                                        <div className="text-xs text-gray-500 capitalize">{member.role}</div>
                                    </div>
                                </div>
                                {isLeader && member.role !== 'leader' && (
                                    <Button 
                                        onClick={() => handleAction(member.id, 'kick')}
                                        size="sm" 
                                        variant="ghost" 
                                        className="text-red-500 hover:text-red-700 hover:bg-red-50"
                                    >
                                        Exclure
                                    </Button>
                                )}
                            </Card>
                        ))}
                    </div>
                </TabsContent>

                <TabsContent value="requests">
                    {pendingMembers.length === 0 ? (
                        <div className="text-center p-8 text-gray-500">Aucune demande en attente</div>
                    ) : (
                        <div className="grid grid-cols-1 gap-4">
                             {pendingMembers.map(member => (
                                <Card key={member.id} className="flex items-center justify-between p-4">
                                    <div className="flex items-center gap-3">
                                        <Avatar>
                                            <AvatarImage src={member.user_avatar} />
                                            <AvatarFallback>{member.user_name?.[0]}</AvatarFallback>
                                        </Avatar>
                                        <div className="font-bold">{member.user_name}</div>
                                    </div>
                                    <div className="flex gap-2">
                                        <Button onClick={() => handleAction(member.id, 'accept')} size="sm" className="bg-green-600 hover:bg-green-700">
                                            <Check className="w-4 h-4 mr-1" /> Accepter
                                        </Button>
                                        <Button onClick={() => handleAction(member.id, 'reject')} size="sm" variant="outline" className="text-red-600 border-red-200">
                                            <X className="w-4 h-4 mr-1" /> Refuser
                                        </Button>
                                    </div>
                                </Card>
                             ))}
                        </div>
                    )}
                </TabsContent>
                
                <TabsContent value="stats">
                    <Card>
                        <CardContent className="p-6">
                            <div className="grid grid-cols-3 gap-4 text-center">
                                <div className="p-4 bg-gray-50 rounded-lg">
                                    <div className="text-2xl font-bold text-[#4a3728]">{team.stats?.wins || 0}</div>
                                    <div className="text-sm text-gray-500">Victoires</div>
                                </div>
                                <div className="p-4 bg-gray-50 rounded-lg">
                                    <div className="text-2xl font-bold text-[#4a3728]">{team.stats?.losses || 0}</div>
                                    <div className="text-sm text-gray-500">Défaites</div>
                                </div>
                                <div className="p-4 bg-gray-50 rounded-lg">
                                    <div className="text-2xl font-bold text-[#4a3728]">{team.stats?.tournament_wins || 0}</div>
                                    <div className="text-sm text-gray-500">Tournois Gagnés</div>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>
            </Tabs>
        </div>
    );
}