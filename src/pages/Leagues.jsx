import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Trophy, Crown, Shield, ChevronRight, Star, Info, Calendar, Medal, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from 'sonner';
import { useRobustWebSocket } from '@/components/hooks/useRobustWebSocket';
import { useLanguage } from '@/components/LanguageContext';

const LeagueCard = ({ league, onJoin, isJoined }) => {
    const { t } = useLanguage();
    return (
        <motion.div 
            whileHover={{ y: -5 }}
            className="bg-white rounded-xl border border-[#d4c5b0] shadow-lg overflow-hidden flex flex-col"
        >
            <div className="bg-[#4a3728] p-4 flex justify-between items-center text-[#e8dcc5]">
                <div className="flex items-center gap-3">
                    <Trophy className="w-6 h-6 text-yellow-500" />
                    <div>
                        <h3 className="font-bold text-lg">{league.name}</h3>
                        <span className="text-xs opacity-75">{t('leagues.season')} {league.season} • {league.game_type === 'chess' ? t('game.chess') : t('game.checkers')}</span>
                    </div>
                </div>
                <span className={`text-xs px-2 py-1 rounded-full ${league.status === 'active' ? 'bg-green-600' : 'bg-gray-600'}`}>
                    {league.status === 'active' ? t('leagues.status_active') : t('leagues.status_upcoming')}
                </span>
            </div>
            <div className="p-4 flex-1 flex flex-col gap-4 bg-[#fdfbf7]">
                <p className="text-sm text-gray-600 line-clamp-2">{league.description}</p>
                
                <div className="grid grid-cols-2 gap-2 text-xs text-gray-500">
                    <div className="flex items-center gap-1">
                        <Calendar className="w-3 h-3" />
                        {t('leagues.end_date')} {new Date(league.end_date).toLocaleDateString()}
                    </div>
                    <div className="flex items-center gap-1">
                        <Shield className="w-3 h-3" />
                        {t('leagues.active_divisions')}
                    </div>
                </div>
                
                {league.status === 'active' && (
                    <div className="bg-blue-50 p-2 rounded text-xs text-blue-800 mt-2">
                        <span className="font-bold">{t('leagues.promotion')}</span> {t('league.promotion_desc')} • <span className="font-bold">{t('leagues.relegation')}</span> {t('league.relegation_desc')}
                    </div>
                )}

                <div className="mt-auto pt-4 border-t border-gray-100">
                    {isJoined ? (
                        <Link to={`/LeagueDetail?id=${league.id}`} className="w-full">
                            <Button className="w-full bg-[#6b5138] hover:bg-[#5c4430] gap-2">
                                <Medal className="w-4 h-4" /> {t('leagues.view_rank')}
                            </Button>
                        </Link>
                    ) : (
                         <Button 
                            onClick={() => onJoin(league)} 
                            disabled={league.status !== 'active'}
                            className="w-full bg-green-600 hover:bg-green-700 gap-2"
                        >
                            {t('leagues.join_btn')} <ChevronRight className="w-4 h-4" />
                        </Button>
                    )}
                </div>
            </div>
        </motion.div>
    );
};

export default function LeaguesPage() {
    const { t } = useLanguage();
    const [leagues, setLeagues] = useState([]);
    const [myParticipations, setMyParticipations] = useState([]);
    const [loading, setLoading] = useState(true);
    const [user, setUser] = useState(null);
    const [gameMode, setGameMode] = useState(localStorage.getItem('gameMode') || 'checkers');
    const [createOpen, setCreateOpen] = useState(false);
    const [newLeague, setNewLeague] = useState({
        name: '',
        description: '',
        game_type: 'checkers',
        start_date: '',
        end_date: ''
    });

    useEffect(() => {
        const handleModeChange = () => setGameMode(localStorage.getItem('gameMode') || 'checkers');
        window.addEventListener('gameModeChanged', handleModeChange);
        return () => window.removeEventListener('gameModeChanged', handleModeChange);
    }, []);

    useEffect(() => {
        const init = async () => {
            try {
                const currentUser = await base44.auth.me();
                setUser(currentUser);

                // Ensure seasons are managed
                await base44.functions.invoke('seasonManager', {});

                const [allLeagues, parts] = await Promise.all([
                    base44.entities.League.list('-start_date', 50),
                    currentUser ? base44.entities.LeagueParticipant.filter({ user_id: currentUser.id }) : []
                ]);

                setLeagues(allLeagues);
                setMyParticipations(parts);
            } catch (e) {
                console.error(e);
            } finally {
                setLoading(false);
            }
        };
        init();
    }, []);

    useRobustWebSocket('/functions/realtimeSocket?channelId=leagues', {
        onMessage: (event, data) => {
            if (data && data.type === 'league_update') {
                // Refresh leagues
                base44.entities.League.list('-start_date', 50).then(setLeagues);
            }
        }
    });

    const handleJoin = async (league) => {
        if (!user) {
            toast.error(t('leagues.login_required'));
            return;
        }
        try {
            await base44.entities.LeagueParticipant.create({
                league_id: league.id,
                user_id: user.id,
                user_name: user.full_name || user.username || t('common.player'),
                avatar_url: user.avatar_url,
                points: 0,
                wins: 0, losses: 0, draws: 0,
                rank_tier: 'bronze'
            });
            toast.success(t('leagues.welcome_msg', { name: league.name }));
            // Refresh
            const parts = await base44.entities.LeagueParticipant.list({ user_id: user.id });
            setMyParticipations(parts);
        } catch (e) {
            toast.error(t('leagues.join_error'));
        }
    };

    const handleCreateLeague = async () => {
        if (!newLeague.name || !newLeague.start_date || !newLeague.end_date) {
            toast.error(t('common.fill_required'));
            return;
        }

        try {
            await base44.entities.League.create({
                name: newLeague.name,
                description: newLeague.description,
                season: 1,
                game_type: newLeague.game_type,
                status: "active", // Auto-activate for ease of use
                start_date: new Date(newLeague.start_date).toISOString(),
                end_date: new Date(newLeague.end_date).toISOString(),
                rules_summary: t('league.rules_default')
            });
            toast.success(t('leagues.created_success'));
            setCreateOpen(false);
            // Refresh list
            const allLeagues = await base44.entities.League.list('-start_date', 50);
            setLeagues(allLeagues);
        } catch(e) { 
            console.error(e); 
            toast.error(t('common.error'));
        }
    };

    if (loading) return <div className="p-8 text-center text-[#4a3728]">{t('leagues.loading')}</div>;

    return (
        <div className="max-w-7xl mx-auto p-4 space-y-8">
            <div className="text-center mb-12">
                <h1 className="text-4xl md:text-5xl font-black text-[#4a3728] mb-4 drop-shadow-sm" style={{ fontFamily: 'Georgia, serif' }}>
                    {t('leagues.title')}
                </h1>
                <p className="text-lg text-[#6b5138] max-w-2xl mx-auto">
                    {t('leagues.subtitle')}
                </p>
                
                <div className="mt-6">
                    <Dialog open={createOpen} onOpenChange={setCreateOpen}>
                        <DialogTrigger asChild>
                            <Button className="bg-[#4a3728] text-[#e8dcc5] hover:bg-[#5c4430]">
                                <Plus className="w-4 h-4 mr-2" /> {t('leagues.create_new')}
                            </Button>
                        </DialogTrigger>
                        <DialogContent className="bg-[#fdfbf7] border-[#d4c5b0]">
                            <DialogHeader>
                                <DialogTitle>{t('leagues.create_new')}</DialogTitle>
                            </DialogHeader>
                            <div className="space-y-4 py-4">
                                <div className="space-y-2">
                                    <Label>{t('common.name')}</Label>
                                    <Input 
                                        value={newLeague.name} 
                                        onChange={e => setNewLeague({...newLeague, name: e.target.value})} 
                                        placeholder={t('leagues.placeholder_name')}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label>{t('common.description')}</Label>
                                    <Input 
                                        value={newLeague.description} 
                                        onChange={e => setNewLeague({...newLeague, description: e.target.value})} 
                                        placeholder={t('leagues.placeholder_desc')}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label>{t('game.type')}</Label>
                                    <Select 
                                        value={newLeague.game_type} 
                                        onValueChange={v => setNewLeague({...newLeague, game_type: v})}
                                    >
                                        <SelectTrigger>
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="checkers">{t('game.checkers')}</SelectItem>
                                            <SelectItem value="chess">{t('game.chess')}</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <Label>{t('leagues.start_date')}</Label>
                                        <Input 
                                            type="date" 
                                            value={newLeague.start_date} 
                                            onChange={e => setNewLeague({...newLeague, start_date: e.target.value})} 
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label>{t('leagues.end_date')}</Label>
                                        <Input 
                                            type="date" 
                                            value={newLeague.end_date} 
                                            onChange={e => setNewLeague({...newLeague, end_date: e.target.value})} 
                                        />
                                    </div>
                                </div>
                            </div>
                            <DialogFooter>
                                <Button variant="outline" onClick={() => setCreateOpen(false)}>{t('common.cancel')}</Button>
                                <Button onClick={handleCreateLeague} className="bg-[#4a3728] text-[#e8dcc5]">{t('common.create')}</Button>
                            </DialogFooter>
                        </DialogContent>
                    </Dialog>
                </div>
            </div>

            <div className="space-y-8">
                {['active', 'upcoming', 'completed'].map(status => {
                    const filteredLeagues = leagues
                        .filter(l => l.game_type === gameMode)
                        .filter(l => l.status === status);
                    
                    if (filteredLeagues.length === 0) return null;
                    
                    const titles = {
                        active: t('leagues.active_seasons'),
                        upcoming: t('leagues.upcoming_seasons'),
                        completed: t('leagues.archived_seasons')
                    };

                    return (
                        <div key={status}>
                            <h2 className="text-2xl font-bold text-[#6b5138] mb-4 border-b border-[#d4c5b0] pb-2 capitalize flex items-center gap-2">
                                {status === 'active' && <Crown className="w-5 h-5" />}
                                {titles[status]}
                            </h2>
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                {filteredLeagues.map(league => (
                                    <LeagueCard 
                                        key={league.id} 
                                        league={league} 
                                        onJoin={handleJoin}
                                        isJoined={myParticipations.some(p => p.league_id === league.id)}
                                    />
                                ))}
                            </div>
                        </div>
                    );
                })}
            </div>

            {leagues.length === 0 && !loading && (
                <div className="text-center py-12 bg-white/50 rounded-xl border-2 border-dashed border-[#d4c5b0]">
                    <Trophy className="w-12 h-12 mx-auto text-gray-400 mb-3" />
                    <p className="text-gray-500">{t('leagues.no_leagues')}</p>
                </div>
            )}
        </div>
    );
}