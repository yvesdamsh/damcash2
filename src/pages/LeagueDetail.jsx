import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useLocation, Link, useNavigate } from 'react-router-dom';
import { Trophy, Medal, Crown, Shield, User, ArrowUpCircle, ArrowDownCircle, ChevronLeft, Sword, Loader2, UserPlus, LogIn } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useLanguage } from '@/components/LanguageContext';
import UserSearchDialog from '@/components/UserSearchDialog';
import { toast } from 'sonner';
import { initializeBoard } from '@/components/checkersLogic';
import { initializeChessBoard } from '@/components/chessLogic';

const TierIcon = ({ tier }) => {
    const colors = {
        bronze: "text-orange-700",
        silver: "text-gray-400",
        gold: "text-yellow-500",
        diamond: "text-cyan-400",
        master: "text-purple-600"
    };
    return <Shield className={`w-5 h-5 ${colors[tier] || colors.bronze}`} fill="currentColor" fillOpacity={0.2} />;
};

export default function LeagueDetail() {
    const { t } = useLanguage();
    const location = useLocation();
    const searchParams = new URLSearchParams(location.search);
    const id = searchParams.get('id');
    const navigate = useNavigate();

    const [league, setLeague] = useState(null);
    const [participants, setParticipants] = useState([]);
    const [loading, setLoading] = useState(true);
    const [matching, setMatching] = useState(false);
    const [currentUser, setCurrentUser] = useState(null);
    const [inviteOpen, setInviteOpen] = useState(false);
    const [joining, setJoining] = useState(false);

    useEffect(() => {
        base44.auth.me().then(setCurrentUser).catch(() => {});
    }, []);

    useEffect(() => {
        if (!id) return;
        const fetchDetails = async () => {
            try {
                const [l, parts] = await Promise.all([
                    base44.entities.League.get(id),
                    base44.entities.LeagueParticipant.list({ league_id: id }, { points: -1 }) // Sort by points desc
                ]);
                setLeague(l);
                setParticipants(parts);
            } catch (e) {
                console.error(e);
            } finally {
                setLoading(false);
            }
        };
        fetchDetails();
    }, [id]);

    const handlePlayMatch = async () => {
        if (!currentUser) return;
        setMatching(true);
        try {
            // 1. Look for open games in this league
            const games = await base44.entities.Game.filter({ 
                league_id: league.id, 
                status: 'waiting',
                game_type: league.game_type
            });
            
            // Filter games where I am not the host
            const validGame = games.find(g => g.white_player_id !== currentUser.id);

            if (validGame) {
                // Join existing
                await base44.entities.Game.update(validGame.id, {
                    black_player_id: currentUser.id,
                    black_player_name: currentUser.username || currentUser.full_name || "Joueur",
                    status: 'playing'
                });
                navigate(`/Game?id=${validGame.id}`);
            } else {
                // Create new
                const initialBoard = league.game_type === 'chess' 
                    ? JSON.stringify({ board: initializeChessBoard(), castlingRights: { wK: true, wQ: true, bK: true, bQ: true }, lastMove: null })
                    : JSON.stringify(initializeBoard());

                const newGame = await base44.entities.Game.create({
                    league_id: league.id,
                    game_type: league.game_type,
                    status: 'waiting',
                    white_player_id: currentUser.id,
                    white_player_name: currentUser.username || currentUser.full_name || "Joueur",
                    current_turn: 'white',
                    board_state: initialBoard,
                    initial_time: 5, // Standard league Blitz 5+0
                    increment: 0,
                    white_seconds_left: 300,
                    black_seconds_left: 300
                });
                navigate(`/Game?id=${newGame.id}`);
            }
        } catch (e) {
            console.error("Matchmaking error", e);
            toast.error(t('common.error'));
            setMatching(false);
        }
    };

    if (loading) return <div className="p-8 text-center">{t('league.loading')}</div>;
    if (!league) return <div className="p-8 text-center">{t('league.not_found')}</div>;

    // Determine active tier tab
    const currentTier = searchParams.get('tier') || 'bronze';
    const filteredParticipants = participants.filter(p => p.rank_tier === currentTier);
    const tiers = ['bronze', 'silver', 'gold', 'diamond', 'master'];

    return (
        <div className="max-w-5xl mx-auto p-4">
            <div className="mb-8">
                <Link to="/Leagues" className="text-[#6b5138] hover:underline flex items-center gap-1 mb-4">
                    <ChevronLeft className="w-4 h-4" /> {t('league.back')}
                </Link>
                <div className="bg-[#4a3728] rounded-xl p-8 text-[#e8dcc5] shadow-xl relative overflow-hidden">
                    <div className="absolute top-0 right-0 opacity-10 transform translate-x-10 -translate-y-10">
                        <Trophy className="w-64 h-64" />
                    </div>
                    <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6 relative z-10">
                        <div>
                            <h1 className="text-4xl font-black mb-2">{league.name}</h1>
                            <p className="text-xl opacity-80 mb-4">{league.description}</p>
                            <div className="flex gap-4 text-sm font-bold">
                                <span className="bg-black/20 px-3 py-1 rounded-full">{t('league.season')} {league.season}</span>
                                <span className="bg-black/20 px-3 py-1 rounded-full">{league.game_type === 'chess' ? t('game.chess') : t('game.checkers')}</span>
                                <span className="bg-green-600/80 px-3 py-1 rounded-full uppercase">{league.status === 'active' ? t('leagues.status_active') : (league.status === 'upcoming' ? t('leagues.status_upcoming') : league.status)}</span>
                            </div>
                        </div>
                        {league.status === 'active' && participants.some(p => p.user_id === currentUser?.id) && (
                            <Button 
                                onClick={handlePlayMatch} 
                                disabled={matching}
                                className="bg-[#e8dcc5] text-[#4a3728] hover:bg-white font-bold text-lg px-8 py-6 shadow-lg animate-in slide-in-from-right-4"
                            >
                                {matching ? <Loader2 className="w-6 h-6 animate-spin mr-2" /> : <Sword className="w-6 h-6 mr-2" />}
                                {t('league.play_match') || "Jouer un Match"}
                            </Button>
                        )}
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                {/* Rewards Card */}
                <div className="bg-gradient-to-br from-yellow-50 to-white border border-yellow-200 rounded-xl p-6 shadow-sm">
                    <h3 className="font-bold text-[#4a3728] mb-4 flex items-center gap-2"><Trophy className="w-5 h-5 text-yellow-500" /> {t('league.rewards_title')}</h3>
                    <div className="space-y-3 text-sm">
                        <div className="flex items-center gap-3 bg-white p-2 rounded border border-yellow-100">
                            <div className="bg-yellow-100 p-1.5 rounded-full text-yellow-700 font-bold text-xs">{t('league.first_place')}</div>
                            <span className="font-medium text-[#6b5138]">{league.rewards?.first || t('league.reward_champion')}</span>
                        </div>
                        <div className="flex items-center gap-3 bg-white p-2 rounded border border-gray-100">
                            <div className="bg-gray-100 p-1.5 rounded-full text-gray-600 font-bold text-xs">{t('league.second_place')}</div>
                            <span className="font-medium text-[#6b5138]">{league.rewards?.second || t('league.reward_silver')}</span>
                        </div>
                        <div className="flex items-center gap-3 bg-white p-2 rounded border border-orange-100">
                            <div className="bg-orange-100 p-1.5 rounded-full text-orange-700 font-bold text-xs">{t('league.third_place')}</div>
                            <span className="font-medium text-[#6b5138]">{league.rewards?.third || t('league.reward_bronze')}</span>
                        </div>
                        <div className="mt-4 pt-4 border-t border-dashed border-gray-200 text-xs text-gray-500">
                            <p className="mb-1 font-bold text-blue-600">{t('league.promotion_title')}</p>
                            <p>{league.rewards?.tier_promotion || t('league.promotion_desc')}</p>
                        </div>
                    </div>
                </div>

                {/* Rules Card */}
                <div className="bg-white border border-[#d4c5b0] rounded-xl p-6 shadow-sm md:col-span-2">
                    <h3 className="font-bold text-[#4a3728] mb-4 flex items-center gap-2"><Shield className="w-5 h-5 text-[#6b5138]" /> {t('league.rules_title')}</h3>
                    <p className="text-sm text-gray-600 leading-relaxed whitespace-pre-line">
                        {league.rules_summary || t('league.rules_default')}
                    </p>
                </div>
            </div>

            <div className="bg-white rounded-xl border border-[#d4c5b0] shadow-lg overflow-hidden">
                <div className="p-4 bg-[#fdfbf7] border-b border-[#d4c5b0] flex justify-between items-center">
                    <div className="flex flex-col gap-4 w-full">
                        <div className="flex justify-between items-center">
                            <h2 className="text-xl font-bold text-[#4a3728] flex items-center gap-2">
                                <Crown className="w-5 h-5 text-yellow-600" /> {t('league.standings_title')}
                            </h2>
                            <div className="text-sm text-gray-500">
                                {filteredParticipants.length} {t('league.players_in_division')}
                            </div>
                        </div>
                        
                        {/* Tiers Navigation */}
                        <div className="flex gap-2 overflow-x-auto pb-2">
                            {tiers.map(tier => (
                                <Button
                                    key={tier}
                                    variant={currentTier === tier ? "default" : "outline"}
                                    className={`capitalize ${currentTier === tier ? 'bg-[#6b5138] text-white' : 'text-[#6b5138] border-[#d4c5b0]'} gap-2`}
                                    onClick={() => {
                                        const newParams = new URLSearchParams(location.search);
                                        newParams.set('tier', tier);
                                        window.location.search = newParams.toString();
                                    }}
                                >
                                    <TierIcon tier={tier} /> {t(`league.tier_${tier}`)}
                                </Button>
                            ))}
                        </div>
                    </div>
                </div>
                
                <div className="overflow-x-auto">
                    <table className="w-full text-left">
                        <thead className="bg-[#f5f0e6] text-[#6b5138] text-xs uppercase font-bold">
                            <tr>
                                <th className="p-4 w-16 text-center">{t('league.rank')}</th>
                                <th className="p-4">{t('league.player')}</th>
                                <th className="p-4 w-32">{t('league.division')}</th>
                                <th className="p-4 w-24 text-center">{t('league.stats')}</th>
                                <th className="p-4 w-24 text-right">{t('league.points')}</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-[#f0e6d2]">
                            {filteredParticipants.map((p, idx) => (
                                <tr key={p.id} className={`hover:bg-[#fffcf5] transition-colors ${idx < 3 ? 'bg-green-50/50 border-l-4 border-green-500' : ''} ${idx > filteredParticipants.length - 4 && filteredParticipants.length > 5 ? 'bg-red-50/50 border-l-4 border-red-400' : ''}`}>
                                    <td className="p-4 text-center font-bold text-[#4a3728]">
                                        {idx === 0 && <Crown className="w-5 h-5 text-yellow-500 mx-auto" />}
                                        {idx === 1 && <Medal className="w-5 h-5 text-gray-400 mx-auto" />}
                                        {idx === 2 && <Medal className="w-5 h-5 text-orange-600 mx-auto" />}
                                        {idx > 2 && `#${idx + 1}`}
                                    </td>
                                    <td className="p-4">
                                        <div className="flex items-center gap-3">
                                            <div className="w-8 h-8 rounded-full bg-gray-200 overflow-hidden">
                                                {p.avatar_url ? <img src={p.avatar_url} className="w-full h-full object-cover" /> : <User className="w-5 h-5 m-1.5 text-gray-500" />}
                                            </div>
                                            <span className="font-medium text-[#4a3728]">{p.user_name}</span>
                                        </div>
                                    </td>
                                    <td className="p-4">
                                        <div className="flex items-center gap-2 capitalize text-sm">
                                            <TierIcon tier={p.rank_tier} />
                                            {t(`league.tier_${p.rank_tier}`)}
                                        </div>
                                    </td>
                                    <td className="p-4 text-center text-sm text-gray-600 font-mono">
                                        <span className="text-green-600 font-bold">{p.wins}</span>/
                                        <span className="text-red-500">{p.losses}</span>/
                                        <span className="text-gray-500">{p.draws}</span>
                                    </td>
                                    <td className="p-4 text-right font-black text-lg text-[#4a3728]">
                                        {p.points}
                                    </td>
                                </tr>
                            ))}
                            {participants.length === 0 && (
                                <tr>
                                    <td colSpan="5" className="p-8 text-center text-gray-400 italic">
                                        {t('league.no_participants')}
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}