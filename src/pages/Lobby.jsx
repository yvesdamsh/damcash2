import React, { useState, useEffect } from 'react';
import { useLanguage } from '@/components/LanguageContext';
import { base44 } from '@/api/base44Client';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { User, Circle, Swords, Crown, Gamepad2, Search, MessagesSquare, Users, Play, Filter, Eye } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { initializeBoard } from '@/components/checkersLogic';
import { initializeChessBoard } from '@/components/chessLogic';
import LobbyChat from '@/components/LobbyChat';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { useRobustWebSocket } from '@/components/hooks/useRobustWebSocket';

export default function Lobby() {
    const { t } = useLanguage();
    const [users, setUsers] = useState([]);
    const [publicGames, setPublicGames] = useState([]);
    const [activeGames, setActiveGames] = useState([]);
    const [loading, setLoading] = useState(true);
    const [currentUser, setCurrentUser] = useState(null);
    const [myTeam, setMyTeam] = useState(null);
    const [playerFilter, setPlayerFilter] = useState({ elo_min: 0, name: '' });
    const navigate = useNavigate();

    const fetchData = async () => {
        try {
            // 1. Fetch Users (Online logic) - Filtered on Backend
            const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString();
            const onlineUsers = await base44.entities.User.filter({ 
                last_seen: { $gte: tenMinutesAgo } 
            }, '-last_seen', 100);
            setUsers(onlineUsers);

            // 2. Fetch Public Waiting Games
            const games = await base44.entities.Game.filter({ status: 'waiting', is_private: false }, '-created_date', 20);
            setPublicGames(games);

            // 3. Fetch Active Games (to determine user status)
            const playing = await base44.entities.Game.filter({ status: 'playing' }, '-updated_date', 50);
            setActiveGames(playing);

        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    const getUserStatus = (userId) => {
        const game = activeGames.find(g => g.white_player_id === userId || g.black_player_id === userId);
        if (game) return { status: 'playing', gameId: game.id };
        return { status: 'online' };
    };

    useEffect(() => {
        const init = async () => {
            const me = await base44.auth.me();
            setCurrentUser(me);
            
            if (me) {
                // Check for team membership
                const memberships = await base44.entities.TeamMember.filter({ user_id: me.id, status: 'active' });
                if (memberships.length > 0) {
                    const team = await base44.entities.Team.get(memberships[0].team_id);
                    setMyTeam(team);
                }
            }
            
            fetchData();
        };
        init();

        // Auto-refresh lobby data (users/games) every 15s to keep list fresh
        const interval = setInterval(fetchData, 15000);
        return () => clearInterval(interval);
    }, []);

    // Real-time Socket
    const { sendMessage } = useRobustWebSocket('/functions/realtimeSocket?channelId=lobby', {
        onMessage: (event, data) => {
            if (!data) return;
            if (data.type === 'game_created') {
                setPublicGames(prev => [data.game, ...prev].slice(0, 20));
            } else if (data.type === 'game_finished') {
                fetchData(); 
            } else if (data.type === 'game_updated' && data.game && data.game.status !== 'playing') {
                // Only refresh if status changed from playing to something else (or waiting to playing)
                // But typically game_updated is for moves. We ignore moves to save rate limits.
                // If status changed, usually game_finished or game_created covers it, or specific status update events.
                // We'll trust game_finished for completion. For waiting->playing, we can check status.
                if (data.game.status !== 'playing') fetchData();
            }
        }
    });

    const handleCreatePublicGame = async (type) => {
        if (!currentUser) return base44.auth.redirectToLogin();
        try {
            const initialBoard = type === 'chess' 
                ? JSON.stringify({ board: initializeChessBoard(), castlingRights: { wK: true, wQ: true, bK: true, bQ: true }, lastMove: null })
                : JSON.stringify(initializeBoard());

            const newGame = await base44.entities.Game.create({
                status: 'waiting',
                game_type: type,
                white_player_id: currentUser.id,
                white_player_name: currentUser.full_name || currentUser.username || t('lobby.me'),
                current_turn: 'white',
                board_state: initialBoard,
                is_private: false, // Public
                created_by_user_id: currentUser.id
            });
            
            // Notify Lobby
            sendMessage({ type: 'game_created', game: newGame });

            toast.success(t('lobby.game_created'));
            navigate(`/Game?id=${newGame.id}`);
        } catch (e) {
            toast.error(t('lobby.create_error'));
        }
    };

    const handleJoinGame = async (gameId) => {
        if (!currentUser) return base44.auth.redirectToLogin();
        try {
            const res = await base44.functions.invoke('joinGame', { gameId });
            if (res.data?.error) {
                toast.error(res.data.error);
            } else {
                toast.success(t('lobby.joined_success'));
                navigate(`/Game?id=${gameId}`);
            }
        } catch (e) {
            toast.error(t('lobby.join_error'));
        }
    };

    const handleChallenge = async (opponent, type) => {
        if (!currentUser) return base44.auth.redirectToLogin();
        
        try {
            const initialBoard = type === 'chess' 
                ? JSON.stringify({ board: initializeChessBoard(), castlingRights: { wK: true, wQ: true, bK: true, bQ: true }, lastMove: null })
                : JSON.stringify(initializeBoard());

            // Create Private Game
            const newGame = await base44.entities.Game.create({
                status: 'waiting',
                game_type: type,
                white_player_id: currentUser.id,
                white_player_name: currentUser.full_name || t('lobby.me'),
                current_turn: 'white',
                board_state: initialBoard,
                is_private: true,
                access_code: Math.random().toString(36).substring(2, 8).toUpperCase()
            });

            // Send Invite
            await base44.entities.Invitation.create({
                from_user_id: currentUser.id,
                from_user_name: currentUser.full_name || currentUser.email,
                to_user_email: opponent.email,
                game_type: type,
                game_id: newGame.id,
                status: 'pending'
            });

            // Send Real-time Notification
            await base44.functions.invoke('sendNotification', {
                recipient_id: opponent.id,
                type: "game",
                title: t('lobby.challenge_received'),
                message: `${currentUser.full_name || t('common.player')} ${t('lobby.challenge_msg')} ${type === 'chess' ? t('game.chess') : t('game.checkers')}.`,
                link: `/Game?id=${newGame.id}`
            });

            toast.success(`${t('lobby.challenge_sent')} ${opponent.full_name || t('common.player')} !`);
            navigate(`/Game?id=${newGame.id}`);

        } catch (e) {
            console.error(e);
            toast.error(t('lobby.challenge_error'));
        }
    };

    const PlayerList = ({ type }) => {
        const players = users.filter(u => {
            // Filter by Game Type
            const pref = u.default_game || 'checkers';
            if (pref !== type) return false;
            
            // Filter by ELO
            const elo = type === 'chess' ? (u.elo_chess || 1200) : (u.elo_checkers || 1200);
            if (elo < playerFilter.elo_min) return false;

            // Filter by Name
            if (playerFilter.name && !u.full_name?.toLowerCase().includes(playerFilter.name.toLowerCase()) && !u.username?.toLowerCase().includes(playerFilter.name.toLowerCase())) return false;

            return true;
        });

        if (loading) return <div className="p-8 text-center text-gray-500">{t('common.loading')}</div>;
        
        if (players.length === 0) return (
            <div className="flex flex-col items-center justify-center py-12 bg-white/50 rounded-xl border-2 border-dashed border-[#d4c5b0] text-[#6b5138]">
                <Search className="w-10 h-10 mb-2 opacity-50" />
                <p>{t('lobby.no_players', { type: type === 'chess' ? t('game.chess') : t('game.checkers') })}</p>
            </div>
        );

        return (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {players.map(player => {
                    const { status, gameId } = getUserStatus(player.id);
                    return (
                        <Card key={player.id} className="p-4 flex items-center justify-between hover:shadow-md transition-all border-[#d4c5b0]">
                            <div className="flex items-center gap-3">
                                <div className="relative">
                                    <div className="w-12 h-12 bg-gray-200 rounded-full flex items-center justify-center overflow-hidden border-2 border-white shadow-sm">
                                        {player.avatar_url ? <img src={player.avatar_url} className="w-full h-full object-cover" /> : <User className="w-6 h-6 text-gray-400" />}
                                    </div>
                                    <div className={`absolute bottom-0 right-0 w-3.5 h-3.5 border-2 border-white rounded-full ${
                                        status === 'playing' ? 'bg-red-500' : 'bg-green-500'
                                    }`} title={status === 'playing' ? t('lobby.status_playing') : t('lobby.status_online')}></div>
                                </div>
                                <div>
                                    <div className="font-bold text-[#4a3728] flex items-center gap-1">
                                        {player.full_name || t('common.player')}
                                        {player.id === currentUser?.id && <span className="text-xs text-gray-500">({t('lobby.me')})</span>}
                                    </div>
                                    <div className="text-xs text-[#6b5138] flex items-center gap-2">
                                        <Crown className="w-3 h-3 text-yellow-600" />
                                        ELO: {type === 'chess' ? (player.elo_chess || 1200) : (player.elo_checkers || 1200)}
                                    </div>
                                    <div className="text-[10px] text-gray-500 mt-0.5 font-medium">
                                        {status === 'playing' ? <span className="text-red-500">{t('lobby.playing')}</span> : <span className="text-green-600">{t('lobby.available')}</span>}
                                    </div>
                                </div>
                            </div>
                            {player.id !== currentUser?.id && (
                                <div className="flex gap-2">
                                    {status === 'playing' ? (
                                        <Button 
                                            size="sm" 
                                            variant="outline"
                                            className="border-[#d4c5b0] text-[#6b5138] hover:bg-[#f5f0e6]"
                                            onClick={() => navigate(`/Game?id=${gameId}`)}
                                            title={t('lobby.watch')}
                                        >
                                            <Play className="w-4 h-4 mr-2" />
                                            {t('lobby.watch')}
                                        </Button>
                                    ) : (
                                        <Button 
                                            size="sm" 
                                            className="bg-[#4a3728] hover:bg-[#2c1e12] text-[#e8dcc5]"
                                            onClick={() => handleChallenge(player, type)}
                                            title={t('lobby.invite')}
                                        >
                                            <Swords className="w-4 h-4 mr-2" />
                                            {t('lobby.invite')}
                                        </Button>
                                    )}
                                </div>
                            )}
                        </Card>
                    );
                })}
            </div>
        );
    };

    return (
        <div className="max-w-6xl mx-auto p-4 space-y-8">
            <div className="text-center mb-8">
                <h1 className="text-4xl font-black text-[#4a3728] mb-2 font-serif">{t('lobby.title')}</h1>
                <p className="text-[#6b5138]">{t('lobby.subtitle')}</p>
            </div>

            <Tabs defaultValue="games" className="w-full">
                <TabsList className="flex flex-col md:grid md:grid-cols-3 w-full bg-transparent md:bg-[#e8dcc5] p-0 md:p-1 gap-2 md:gap-0 rounded-xl mb-8 h-auto">
                    <TabsTrigger value="games" className="w-full data-[state=active]:bg-[#4a3728] data-[state=active]:text-[#e8dcc5] bg-[#e8dcc5]/50 md:bg-transparent text-[#6b5138] font-bold py-3 rounded-lg transition-all border md:border-none border-[#d4c5b0]">
                        <div className="flex items-center justify-center gap-2">
                            <Swords className="w-5 h-5" />
                            <span>{t('lobby.tab_play')}</span>
                            <span className="ml-2 text-xs bg-black/10 data-[state=active]:bg-white/20 px-2 py-0.5 rounded-full">
                                {publicGames.length}
                            </span>
                        </div>
                    </TabsTrigger>
                    <TabsTrigger value="spectate" className="w-full data-[state=active]:bg-[#4a3728] data-[state=active]:text-[#e8dcc5] bg-[#e8dcc5]/50 md:bg-transparent text-[#6b5138] font-bold py-3 rounded-lg transition-all border md:border-none border-[#d4c5b0]">
                        <div className="flex items-center justify-center gap-2">
                            <Eye className="w-5 h-5" />
                            <span>{t('lobby.tab_spectate')}</span>
                            <span className="ml-2 text-xs bg-black/10 data-[state=active]:bg-white/20 px-2 py-0.5 rounded-full">
                                {activeGames.filter(g => !g.is_private).length}
                            </span>
                        </div>
                    </TabsTrigger>
                    <TabsTrigger value="checkers" className="w-full data-[state=active]:bg-[#4a3728] data-[state=active]:text-[#e8dcc5] bg-[#e8dcc5]/50 md:bg-transparent text-[#6b5138] font-bold py-3 rounded-lg transition-all border md:border-none border-[#d4c5b0]">
                        <div className="flex items-center justify-center gap-2">
                            <Circle className="w-5 h-5" />
                            <span>{t('lobby.tab_checkers_players')}</span>
                            <span className="ml-2 text-xs bg-black/10 data-[state=active]:bg-white/20 px-2 py-0.5 rounded-full">
                                {users.filter(u => (u.default_game || 'checkers') === 'checkers').length}
                            </span>
                        </div>
                    </TabsTrigger>
                    <TabsTrigger value="chess" className="w-full data-[state=active]:bg-[#4a3728] data-[state=active]:text-[#e8dcc5] bg-[#e8dcc5]/50 md:bg-transparent text-[#6b5138] font-bold py-3 rounded-lg transition-all border md:border-none border-[#d4c5b0]">
                        <div className="flex items-center justify-center gap-2">
                            <Gamepad2 className="w-5 h-5" />
                            <span>{t('lobby.tab_chess_players')}</span>
                            <span className="ml-2 text-xs bg-black/10 data-[state=active]:bg-white/20 px-2 py-0.5 rounded-full">
                                {users.filter(u => u.default_game === 'chess').length}
                            </span>
                        </div>
                    </TabsTrigger>
                </TabsList>

                <TabsContent value="spectate" className="animate-in fade-in duration-500">
                     <div className="flex flex-col lg:flex-row gap-6">
                        <div className="flex-1">
                            <div className="grid grid-cols-1 gap-4">
                                {activeGames.filter(g => !g.is_private).length === 0 ? (
                                    <div className="flex flex-col items-center justify-center py-12 bg-white/50 rounded-xl border-2 border-dashed border-[#d4c5b0] text-[#6b5138]">
                                        <Eye className="w-10 h-10 mb-2 opacity-50" />
                                        <p>{t('lobby.no_spectate')}</p>
                                    </div>
                                ) : (
                                    activeGames.filter(g => !g.is_private).map(game => (
                                        <Card key={game.id} className="p-4 flex items-center justify-between border-[#d4c5b0] hover:shadow-md transition-all">
                                            <div className="flex items-center gap-3">
                                                <div className={`w-12 h-12 rounded-lg flex items-center justify-center text-white ${game.game_type === 'chess' ? 'bg-[#6B8E4E]' : 'bg-[#4a3728]'}`}>
                                                    {game.game_type === 'chess' ? <Gamepad2 className="w-6 h-6" /> : <Circle className="w-6 h-6" />}
                                                </div>
                                                <div>
                                                    <div className="font-bold text-[#4a3728] flex items-center gap-2">
                                                        <span>{game.white_player_name}</span>
                                                        <span className="text-xs text-gray-400">vs</span>
                                                        <span>{game.black_player_name}</span>
                                                    </div>
                                                    <div className="text-xs text-[#6b5138]">{game.game_type === 'chess' ? t('game.chess') : t('game.checkers')} • {game.initial_time || 10} {t('common.min')}</div>
                                                </div>
                                            </div>
                                            <Button onClick={() => navigate(`/Game?id=${game.id}`)} variant="outline" className="border-[#d4c5b0] text-[#6b5138] hover:bg-[#f5f0e6]">
                                                <Eye className="w-4 h-4 mr-2" /> {t('lobby.watch')}
                                            </Button>
                                        </Card>
                                    ))
                                )}
                            </div>
                        </div>
                        <div className="lg:w-96 hidden lg:block">
                             <div className="h-[600px] bg-white rounded-lg border border-[#d4c5b0] p-4 flex flex-col justify-center items-center text-center text-[#6b5138]">
                                 <MessagesSquare className="w-12 h-12 mb-2 opacity-20" />
                                 <p>{t('lobby.chat_hint')}</p>
                             </div>
                        </div>
                    </div>
                </TabsContent>

                <TabsContent value="games" className="animate-in fade-in duration-500">
                    <div className="flex flex-col lg:flex-row gap-6">
                        <div className="flex-1">
                            <div className="mb-6 flex gap-4 justify-center">
                                <Button onClick={() => handleCreatePublicGame('checkers')} className="bg-[#4a3728] hover:bg-[#2c1e12] text-[#e8dcc5] gap-2">
                                    <Circle className="w-4 h-4" /> {t('lobby.create_checkers')}
                                </Button>
                                <Button onClick={() => handleCreatePublicGame('chess')} className="bg-[#6B8E4E] hover:bg-[#5a7a40] text-white gap-2">
                                    <Gamepad2 className="w-4 h-4" /> {t('lobby.create_chess')}
                                </Button>
                            </div>

                            {publicGames.length === 0 ? (
                                 <div className="flex flex-col items-center justify-center py-12 bg-white/50 rounded-xl border-2 border-dashed border-[#d4c5b0] text-[#6b5138]">
                                    <Swords className="w-10 h-10 mb-2 opacity-50" />
                                    <p>{t('lobby.no_games')}</p>
                                </div>
                            ) : (
                                <div className="grid grid-cols-1 gap-4">
                                    {publicGames.map(game => (
                                        <Card key={game.id} className="p-4 flex items-center justify-between border-[#d4c5b0] hover:shadow-md transition-all">
                                            <div className="flex items-center gap-3">
                                                <div className={`w-12 h-12 rounded-lg flex items-center justify-center text-white ${game.game_type === 'chess' ? 'bg-[#6B8E4E]' : 'bg-[#4a3728]'}`}>
                                                    {game.game_type === 'chess' ? <Gamepad2 className="w-6 h-6" /> : <Circle className="w-6 h-6" />}
                                                </div>
                                                <div>
                                                    <div className="font-bold text-[#4a3728]">{game.white_player_name} <span className="font-normal text-gray-500">{t('lobby.waiting')}</span></div>
                                                    <div className="text-xs text-[#6b5138]">{game.game_type === 'chess' ? t('game.chess') : t('game.checkers')} • {game.initial_time || 10} {t('common.min')}</div>
                                                </div>
                                            </div>
                                            <Button onClick={() => handleJoinGame(game.id)} className="bg-[#6b5138] hover:bg-[#5c4430]">
                                                {t('lobby.join')}
                                            </Button>
                                        </Card>
                                    ))}
                                </div>
                            )}
                        </div>
                        
                        <div className="lg:w-96 space-y-6">
                            {/* Global Chat Section */}
                            <div className="h-[600px]">
                                <Tabs defaultValue="global" className="h-full flex flex-col">
                                    <TabsList className="w-full bg-[#e8dcc5]">
                                        <TabsTrigger value="global" className="flex-1 data-[state=active]:bg-[#4a3728] data-[state=active]:text-[#e8dcc5]">
                                            <MessagesSquare className="w-4 h-4 mr-2" /> {t('lobby.chat_global')}
                                        </TabsTrigger>
                                        {myTeam && (
                                            <TabsTrigger value="team" className="flex-1 data-[state=active]:bg-[#4a3728] data-[state=active]:text-[#e8dcc5]">
                                                <Users className="w-4 h-4 mr-2" /> {t('lobby.chat_team')}
                                            </TabsTrigger>
                                        )}
                                    </TabsList>
                                    <TabsContent value="global" className="flex-1 mt-2 h-full">
                                        <LobbyChat channelId="global" channelName={t('lobby.chat_global')} currentUser={currentUser} />
                                    </TabsContent>
                                    {myTeam && (
                                        <TabsContent value="team" className="flex-1 mt-2 h-full">
                                            <LobbyChat channelId={myTeam.id} channelName={myTeam.name} currentUser={currentUser} />
                                        </TabsContent>
                                    )}
                                </Tabs>
                            </div>
                        </div>
                    </div>
                </TabsContent>

                <TabsContent value="checkers" className="animate-in fade-in duration-500">
                    <div className="flex flex-col lg:flex-row gap-6">
                        <div className="flex-1">
                             {/* Simple Player Filter */}
                             <div className="bg-white p-3 rounded-lg shadow-sm border border-[#d4c5b0] mb-4 flex flex-wrap gap-4 items-end">
                                <div className="flex-1 min-w-[200px]">
                                    <Label className="text-xs text-gray-500">{t('lobby.search_player')}</Label>
                                    <Input 
                                        placeholder={t('lobby.player_name_placeholder')} 
                                        value={playerFilter.name}
                                        onChange={(e) => setPlayerFilter(prev => ({ ...prev, name: e.target.value }))}
                                        className="h-9"
                                    />
                                </div>
                                <div className="w-32">
                                    <Label className="text-xs text-gray-500">{t('lobby.elo_min')}</Label>
                                    <Select value={playerFilter.elo_min.toString()} onValueChange={(v) => setPlayerFilter(prev => ({ ...prev, elo_min: parseInt(v) }))}>
                                        <SelectTrigger className="h-9">
                                            <SelectValue placeholder="0" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="0">{t('lobby.all')}</SelectItem>
                                            <SelectItem value="1000">1000+</SelectItem>
                                            <SelectItem value="1200">1200+</SelectItem>
                                            <SelectItem value="1500">1500+</SelectItem>
                                            <SelectItem value="1800">1800+</SelectItem>
                                            <SelectItem value="2000">2000+</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                             </div>
                             <PlayerList type="checkers" />
                        </div>
                        <div className="lg:w-96 hidden lg:block">
                             <div className="h-[600px] bg-white rounded-lg border border-[#d4c5b0] p-4 flex flex-col justify-center items-center text-center text-[#6b5138]">
                                 <MessagesSquare className="w-12 h-12 mb-2 opacity-20" />
                                 <p>{t('lobby.chat_unavailable_hint')}</p>
                             </div>
                        </div>
                    </div>
                </TabsContent>

                <TabsContent value="chess" className="animate-in fade-in duration-500">
                     <div className="flex flex-col lg:flex-row gap-6">
                        <div className="flex-1">
                             {/* Simple Player Filter */}
                             <div className="bg-white p-3 rounded-lg shadow-sm border border-[#d4c5b0] mb-4 flex flex-wrap gap-4 items-end">
                                <div className="flex-1 min-w-[200px]">
                                    <Label className="text-xs text-gray-500">{t('lobby.search_player')}</Label>
                                    <Input 
                                        placeholder={t('lobby.player_name_placeholder')} 
                                        value={playerFilter.name}
                                        onChange={(e) => setPlayerFilter(prev => ({ ...prev, name: e.target.value }))}
                                        className="h-9"
                                    />
                                </div>
                                <div className="w-32">
                                    <Label className="text-xs text-gray-500">{t('lobby.elo_min')}</Label>
                                    <Select value={playerFilter.elo_min.toString()} onValueChange={(v) => setPlayerFilter(prev => ({ ...prev, elo_min: parseInt(v) }))}>
                                        <SelectTrigger className="h-9">
                                            <SelectValue placeholder="0" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="0">{t('lobby.all')}</SelectItem>
                                            <SelectItem value="1000">1000+</SelectItem>
                                            <SelectItem value="1200">1200+</SelectItem>
                                            <SelectItem value="1500">1500+</SelectItem>
                                            <SelectItem value="1800">1800+</SelectItem>
                                            <SelectItem value="2000">2000+</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                             </div>
                             <PlayerList type="chess" />
                        </div>
                        <div className="lg:w-96 hidden lg:block">
                             <div className="h-[600px] bg-white rounded-lg border border-[#d4c5b0] p-4 flex flex-col justify-center items-center text-center text-[#6b5138]">
                                 <MessagesSquare className="w-12 h-12 mb-2 opacity-20" />
                                 <p>{t('lobby.chat_unavailable_hint')}</p>
                             </div>
                        </div>
                    </div>
                </TabsContent>
            </Tabs>
        </div>
    );
}