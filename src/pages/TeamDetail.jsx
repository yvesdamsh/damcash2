import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useLocation, Link } from 'react-router-dom';
import { useLanguage } from '@/components/LanguageContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Users, Shield, Calendar, ArrowLeft, Check, X, Crown } from 'lucide-react';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import UserSearchDialog from '@/components/UserSearchDialog';

export default function TeamDetail() {
    const { t } = useLanguage();
    const location = useLocation();
    const params = new URLSearchParams(location.search);
    const id = params.get('id');

    const [team, setTeam] = useState(null);
    const [members, setMembers] = useState([]);
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);
    const [isFollowing, setIsFollowing] = useState(false);
    const [inviteOpen, setInviteOpen] = useState(false);

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

                // Check follow status
                if (u) {
                    const follows = await base44.entities.Follow.filter({ 
                        follower_id: u.id, 
                        target_id: id 
                    });
                    setIsFollowing(follows.length > 0);
                }
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
        if (!user) return toast.error(t('teams.error_login'));
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
            toast.success(t('team.success_join'));
        } catch (e) {
            toast.error(t('common.error'));
        }
    };

    const handleLeave = async () => {
        if (!myMembership) return;
        if (isLeader && activeMembers.length > 1) {
            return toast.error(t('team.error_leader_leave'));
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
            toast.success(t('team.success_leave'));
        } catch (e) {
            toast.error(t('common.error'));
        }
    };

    const handleAction = async (memberId, action) => {
        try {
            if (action === 'accept') {
                await base44.entities.TeamMember.update(memberId, { status: 'active' });
                setMembers(members.map(m => m.id === memberId ? { ...m, status: 'active' } : m));
                toast.success(t('team.success_accept'));
            } else if (action === 'kick' || action === 'reject' || action === 'cancel_invite') {
                await base44.entities.TeamMember.delete(memberId);
                setMembers(members.filter(m => m.id !== memberId));
                toast.success(t('common.success'));
            }
        } catch (e) {
            toast.error(t('common.error'));
        }
    };

    const handleInviteUser = async (userToInvite) => {
        if (members.some(m => m.user_id === userToInvite.id)) {
            return toast.error("Utilisateur déjà dans l'équipe ou invité");
        }
        try {
            const newMember = await base44.entities.TeamMember.create({
                team_id: team.id,
                user_id: userToInvite.id,
                user_name: userToInvite.username || userToInvite.full_name,
                user_avatar: userToInvite.avatar_url,
                role: 'member',
                status: 'invited',
                joined_at: new Date().toISOString()
            });
            setMembers([...members, newMember]);
            
            await base44.entities.Notification.create({
                recipient_id: userToInvite.id,
                type: "team_request",
                title: "Invitation d'équipe",
                message: `Vous avez été invité à rejoindre ${team.name}`,
                link: `/Profile`
            });

            toast.success("Invitation envoyée");
            setInviteOpen(false);
        } catch (e) {
            toast.error("Erreur invitation");
        }
    };

    const handleFollowToggle = async () => {
        if (!user) return;
        try {
            if (isFollowing) {
                const record = await base44.entities.Follow.filter({ follower_id: user.id, target_id: team.id });
                if (record.length) await base44.entities.Follow.delete(record[0].id);
                setIsFollowing(false);
                toast.success("Vous ne suivez plus cette équipe");
            } else {
                await base44.entities.Follow.create({
                    follower_id: user.id,
                    target_id: team.id,
                    target_type: 'team',
                    created_at: new Date().toISOString()
                });
                setIsFollowing(true);
                toast.success("Équipe suivie !");
            }
        } catch (e) {
            console.error(e);
            toast.error("Erreur action");
        }
    };

    if (loading) return <div className="p-8 text-center">{t('common.loading')}</div>;
    if (!team) return <div className="p-8 text-center">Not Found</div>;

    return (
        <div className="max-w-5xl mx-auto p-4 space-y-6">
            <Link to="/Teams">
                <Button variant="ghost" className="gap-2 text-gray-600">
                    <ArrowLeft className="w-4 h-4" /> {t('team.back')}
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
                                    <Users className="w-4 h-4" /> {activeMembers.length} {t('team.members_count')}
                                </div>
                                <div className="flex items-center gap-1">
                                    <Calendar className="w-4 h-4" /> {t('team.created_on')} {new Date(team.created_at).toLocaleDateString()}
                                </div>
                            </div>
                        </div>
                        <div className="flex gap-2">
                            <Button 
                                variant={isFollowing ? "secondary" : "outline"} 
                                onClick={handleFollowToggle}
                                className={isFollowing ? "bg-white/20 text-white border-none hover:bg-white/30" : "bg-transparent text-white border-white/50 hover:bg-white/10"}
                            >
                                {isFollowing ? "Suivi" : "Suivre"}
                            </Button>
                            {isLeader && (
                                <Button onClick={() => setInviteOpen(true)} className="bg-[#4a3728] hover:bg-[#2c1e12]">
                                    <Users className="w-4 h-4 mr-2" /> Inviter
                                </Button>
                            )}
                            {!myMembership && (
                                <Button onClick={handleJoin} className="bg-green-600 hover:bg-green-700">
                                    {t('team.join')}
                                </Button>
                            )}
                            {myMembership && myMembership.status === 'active' && (
                                <Button onClick={handleLeave} variant="outline" className="text-red-600 border-red-200 hover:bg-red-50">
                                    {t('team.leave')}
                                </Button>
                            )}
                            {myMembership && myMembership.status === 'pending' && (
                                <Button disabled variant="secondary">{t('team.pending')}</Button>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            <UserSearchDialog 
                isOpen={inviteOpen} 
                onClose={() => setInviteOpen(false)} 
                onInvite={handleInviteUser} 
                title="Inviter un joueur"
            />

            <Tabs defaultValue="members" className="w-full">
                <TabsList className="bg-[#e8dcc5]">
                    <TabsTrigger value="members" className="data-[state=active]:bg-[#4a3728] data-[state=active]:text-[#e8dcc5]">{t('team.tab_members')}</TabsTrigger>
                    {isLeader && <TabsTrigger value="requests" className="data-[state=active]:bg-[#4a3728] data-[state=active]:text-[#e8dcc5]">{t('team.tab_requests')} ({pendingMembers.length})</TabsTrigger>}
                    <TabsTrigger value="stats" className="data-[state=active]:bg-[#4a3728] data-[state=active]:text-[#e8dcc5]">{t('team.tab_stats')}</TabsTrigger>
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
                                        <div className="text-xs text-gray-500 capitalize">
                                            {member.status === 'invited' ? 'Invité' : member.role}
                                        </div>
                                    </div>
                                </div>
                                {isLeader && member.role !== 'leader' && (
                                    <Button 
                                        onClick={() => handleAction(member.id, member.status === 'invited' ? 'cancel_invite' : 'kick')}
                                        size="sm" 
                                        variant="ghost" 
                                        className="text-red-500 hover:text-red-700 hover:bg-red-50"
                                    >
                                        {member.status === 'invited' ? 'Annuler' : t('team.kick')}
                                    </Button>
                                )}
                            </Card>
                        ))}
                    </div>
                </TabsContent>

                <TabsContent value="requests">
                    {pendingMembers.length === 0 ? (
                        <div className="text-center p-8 text-gray-500">{t('team.no_requests')}</div>
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
                                            <Check className="w-4 h-4 mr-1" /> {t('team.accept')}
                                        </Button>
                                        <Button onClick={() => handleAction(member.id, 'reject')} size="sm" variant="outline" className="text-red-600 border-red-200">
                                            <X className="w-4 h-4 mr-1" /> {t('team.reject')}
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
                                    <div className="text-sm text-gray-500">{t('team.stats_wins')}</div>
                                </div>
                                <div className="p-4 bg-gray-50 rounded-lg">
                                    <div className="text-2xl font-bold text-[#4a3728]">{team.stats?.losses || 0}</div>
                                    <div className="text-sm text-gray-500">{t('team.stats_losses')}</div>
                                </div>
                                <div className="p-4 bg-gray-50 rounded-lg">
                                    <div className="text-2xl font-bold text-[#4a3728]">{team.stats?.tournament_wins || 0}</div>
                                    <div className="text-sm text-gray-500">{t('team.stats_tournaments')}</div>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>
            </Tabs>
        </div>
    );
}