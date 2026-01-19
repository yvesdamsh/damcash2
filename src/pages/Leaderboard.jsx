import { useEffect, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Trophy, Medal, Crown, UserPlus, Check } from 'lucide-react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { useLanguage } from '@/components/LanguageContext';

export default function Leaderboard() {
    const { t } = useLanguage();
    const [players, setPlayers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [gameType, setGameType] = useState(localStorage.getItem('gameMode') || 'checkers');
    const [timeframe, setTimeframe] = useState('all_time');
    const [metric, setMetric] = useState('elo');
    const [tierFilter, setTierFilter] = useState('all');
    const [followedIds, setFollowedIds] = useState(new Set());
    const [currentUser, setCurrentUser] = useState(null);

    useEffect(() => {
        const handleModeChange = () => setGameType(localStorage.getItem('gameMode') || 'checkers');
        window.addEventListener('gameModeChanged', handleModeChange);
        return () => window.removeEventListener('gameModeChanged', handleModeChange);
    }, []);

    useEffect(() => {
        const init = async () => {
            try {
                const u = await base44.auth.me().catch(()=>null);
                if (u) {
                    setCurrentUser(u);
                    const follows = await base44.entities.Follow.filter({ follower_id: u.id });
                    setFollowedIds(new Set(follows.map(f => f.target_id)));
                }
            } catch (e) {}
        };
        init();
    }, []);

    useEffect(() => {
        const fetchLeaderboard = async () => {
            setLoading(true);
            try {
                const res = await base44.functions.invoke('getLeaderboardData', {
                    timeframe,
                    gameType,
                    metric
                });
                setPlayers(res.data || []);
            } catch (e) {
                console.error(e);
            } finally {
                setLoading(false);
            }
        };
        fetchLeaderboard();
    }, [gameType, timeframe, metric]);

    const handleFollow = async (targetId) => {
        if (!currentUser) return toast.error(t('leaderboard.toast_login'));
        try {
            if (followedIds.has(targetId)) {
                // Unfollow
                const follows = await base44.entities.Follow.filter({ follower_id: currentUser.id, target_id: targetId });
                if (follows.length) await base44.entities.Follow.delete(follows[0].id);
                const next = new Set(followedIds);
                next.delete(targetId);
                setFollowedIds(next);
                toast.success(t('leaderboard.toast_unfollow'));
            } else {
                // Follow
                await base44.entities.Follow.create({
                    follower_id: currentUser.id,
                    target_id: targetId,
                    target_type: 'user',
                    created_at: new Date().toISOString()
                });
                setFollowedIds(prev => new Set(prev).add(targetId));
                toast.success(t('leaderboard.toast_follow'));
            }
        } catch (e) {
            toast.error(t('leaderboard.toast_error'));
        }
    };

    return (
        <div className="max-w-5xl mx-auto space-y-6 pb-20">
            <div className="text-center space-y-2">
                <h1 className="text-4xl font-black text-[#4a3728] flex items-center justify-center gap-3 uppercase tracking-wider">
                    <Trophy className="w-10 h-10 text-yellow-600" />
                    {t('leaderboard.title')}
                </h1>
                <p className="text-[#6b5138] font-medium">{t('leaderboard.subtitle')}</p>
            </div>

            {/* Filters */}
            <div className="bg-white/80 backdrop-blur p-4 rounded-xl border border-[#d4c5b0] shadow-sm flex flex-col md:flex-row gap-4 justify-between items-center">
                
                <div className="flex gap-2 items-center">
                    <Select value={metric} onValueChange={setMetric}>
                        <SelectTrigger className="w-[180px] border-[#d4c5b0]">
                            <SelectValue placeholder={t('leaderboard.metric')} />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="elo">{t('leaderboard.metric_elo')}</SelectItem>
                            <SelectItem value="wins">{t('leaderboard.metric_wins')}</SelectItem>
                            <SelectItem value="tournament_wins">{t('leaderboard.metric_tournament_wins')}</SelectItem>
                        </SelectContent>
                    </Select>

                    {metric !== 'elo' && (
                        <Select value={timeframe} onValueChange={setTimeframe}>
                            <SelectTrigger className="w-[150px] border-[#d4c5b0]">
                                <SelectValue placeholder={t('leaderboard.timeframe')} />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all_time">{t('leaderboard.timeframe_all_time')}</SelectItem>
                                <SelectItem value="monthly">{t('leaderboard.timeframe_monthly')}</SelectItem>
                                <SelectItem value="weekly">{t('leaderboard.timeframe_weekly')}</SelectItem>
                                <SelectItem value="daily">{t('leaderboard.timeframe_daily')}</SelectItem>
                            </SelectContent>
                        </Select>
                    )}

                    {metric === 'elo' && (
                         <Select value={tierFilter} onValueChange={setTierFilter}>
                            <SelectTrigger className="w-[150px] border-[#d4c5b0]">
                                <SelectValue placeholder={t('leaderboard.tier')} />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">{t('leaderboard.tier_all')}</SelectItem>
                                <SelectItem value="Maître">{t('leaderboard.tier_master')}</SelectItem>
                                <SelectItem value="Pro">{t('leaderboard.tier_pro')}</SelectItem>
                                <SelectItem value="Amateur">{t('leaderboard.tier_amateur')}</SelectItem>
                            </SelectContent>
                        </Select>
                    )}
                </div>
            </div>

            <Card className="bg-white/90 backdrop-blur border-[#d4c5b0] shadow-xl overflow-hidden">
                <CardHeader className="bg-[#4a3728] text-[#e8dcc5] py-3">
                    <div className="grid grid-cols-12 gap-4 font-bold text-sm md:text-base items-center">
                        <div className="col-span-2 text-center">{t('leaderboard.col_rank')}</div>
                        <div className="col-span-6">{t('leaderboard.col_player')}</div>
                        <div className="col-span-2 text-center">
                            {metric === 'elo' ? t('leaderboard.col_elo') : metric === 'wins' ? t('leaderboard.col_wins') : t('leaderboard.col_titles')}
                        </div>
                        <div className="col-span-2 text-center">{t('leaderboard.col_follow')}</div>
                    </div>
                </CardHeader>
                <CardContent className="p-0 min-h-[300px]">
                    {loading ? (
                        <div className="flex justify-center items-center h-[300px]">
                            <Loader2 className="w-8 h-8 animate-spin text-[#6b5138]" />
                        </div>
                    ) : players.length === 0 ? (
                        <div className="flex flex-col justify-center items-center h-[300px] text-gray-400">
                            <Trophy className="w-12 h-12 mb-2 opacity-20" />
                            <p>{t('leaderboard.no_data')}</p>
                        </div>
                    ) : (
                        players
                            .filter(p => {
                                if (metric !== 'elo' || tierFilter === 'all') return true;
                                const tier = gameType === 'chess' ? p.tier_chess : p.tier_checkers;
                                return tier === tierFilter || (!tier && tierFilter === 'Amateur'); // Default to Amateur if undef
                            })
                            .map((player, index) => {
                            let rankDisplay = <span className="font-bold text-gray-500 text-lg">#{index + 1}</span>;
                            let bgClass = index % 2 === 0 ? 'bg-white' : 'bg-[#fcf9f5]';
                            
                            // Derive tier for display
                            const pTier = gameType === 'chess' ? (player.tier_chess || 'Amateur') : (player.tier_checkers || 'Amateur');
                            const tierColors = {
                                'Amateur': 'text-gray-500',
                                'Pro': 'text-blue-600',
                                'Maître': 'text-purple-600'
                            };

                            if (index === 0) {
                                rankDisplay = <Medal className="w-6 h-6 text-yellow-500 drop-shadow-sm" />;
                                bgClass = 'bg-gradient-to-r from-yellow-50/50 to-white border-l-4 border-yellow-400';
                            }
                            if (index === 1) {
                                rankDisplay = <Medal className="w-6 h-6 text-gray-400 drop-shadow-sm" />;
                                bgClass = 'bg-gradient-to-r from-gray-50/50 to-white border-l-4 border-gray-300';
                            }
                            if (index === 2) {
                                rankDisplay = <Medal className="w-6 h-6 text-amber-700 drop-shadow-sm" />;
                                bgClass = 'bg-gradient-to-r from-amber-50/50 to-white border-l-4 border-amber-600';
                            }

                            return (
                                <div 
                                    key={player.id}
                                    className={`
                                        grid grid-cols-12 gap-4 p-4 items-center border-b border-gray-100 transition-all hover:bg-[#f0e6d2]
                                        ${bgClass}
                                    `}
                                >
                                    <div className="col-span-2 flex justify-center">
                                        {rankDisplay}
                                    </div>
                                    <div className="col-span-6 flex items-center gap-3">
                                        <Avatar className="w-10 h-10 border-2 border-white shadow-sm">
                                            <AvatarImage src={player.avatar_url} />
                                            <AvatarFallback>{player.username?.[0]}</AvatarFallback>
                                        </Avatar>
                                        <div className="overflow-hidden">
                                            <div className="font-bold text-[#4a3728] truncate flex items-center gap-2">
                                                {player.username}
                                                {metric === 'elo' && (
                                                    <span className={`text-[10px] uppercase border px-1 rounded ${tierColors[pTier] || 'text-gray-500'} border-current opacity-70`}>
                                                        {pTier}
                                                    </span>
                                                )}
                                            </div>
                                            {metric === 'elo' && <div className="text-xs text-gray-400">{player.games_played || 0} {t('leaderboard.games')}</div>}
                                        </div>
                                        {index === 0 && <Crown className="w-4 h-4 text-yellow-500 ml-auto hidden md:block" />}
                                    </div>
                                    <div className="col-span-2 text-center">
                                        <span className="font-mono font-black text-xl text-[#6b5138]">
                                            {player.value}
                                        </span>
                                    </div>
                                    <div className="col-span-2 flex justify-center">
                                        {currentUser && currentUser.id !== player.id && (
                                            <Button 
                                                size="sm" 
                                                variant={followedIds.has(player.id) ? "secondary" : "outline"}
                                                onClick={() => handleFollow(player.id)}
                                                className={`h-8 w-8 p-0 rounded-full ${followedIds.has(player.id) ? 'bg-green-100 text-green-600 hover:bg-red-100 hover:text-red-600' : 'border-[#d4c5b0] text-[#6b5138]'}`}
                                            >
                                                {followedIds.has(player.id) ? <Check className="w-4 h-4" /> : <UserPlus className="w-4 h-4" />}
                                            </Button>
                                        )}
                                    </div>
                                </div>
                            );
                        })
                    )}
                </CardContent>
            </Card>
        </div>
    );
}