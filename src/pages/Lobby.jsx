import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { User, Circle, Swords, Crown, Gamepad2, Search, MessagesSquare, Users, Play, Filter } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { initializeBoard } from '@/components/checkersLogic';
import { initializeChessBoard } from '@/components/chessLogic';
import LobbyChat from '@/components/LobbyChat';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';

export default function Lobby() {
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
            // 1. Fetch Users (Online logic)
            const allUsers = await base44.entities.User.list({ limit: 100, sort: { last_seen: -1 } });
            const now = new Date();
            const onlineThreshold = 10 * 60 * 1000; 
            const onlineUsers = allUsers.filter(u => u.last_seen && (now - new Date(u.last_seen)) < onlineThreshold);
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
        
        const interval = setInterval(fetchData, 5000); // Refresh every 5s for lobby
        return () => clearInterval(interval);
    }, []);

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
                white_player_name: currentUser.full_name || currentUser.username || 'Hôte',
                current_turn: 'white',
                board_state: initialBoard,
                is_private: false, // Public
                created_by_user_id: currentUser.id
            });
            
            toast.success("Partie publique créée !");
            navigate(`/Game?id=${newGame.id}`);
        } catch (e) {
            toast.error("Erreur création partie");
        }
    };

    const handleJoinGame = async (gameId) => {
        if (!currentUser) return base44.auth.redirectToLogin();
        try {
            const res = await base44.functions.invoke('joinGame', { gameId });
            if (res.data?.error) {
                toast.error(res.data.error);
            } else {
                toast.success("Partie rejointe !");
                navigate(`/Game?id=${gameId}`);
            }
        } catch (e) {
            toast.error("Erreur lors de la connexion");
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
                white_player_name: currentUser.full_name || 'Joueur 1',
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
                title: "Défi reçu !",
                message: `${currentUser.full_name || 'Un joueur'} vous défie aux ${type === 'chess' ? 'Échecs' : 'Dames'}.`,
                link: `/Game?id=${newGame.id}`
            });

            toast.success(`Défi envoyé à ${opponent.full_name || 'Joueur'} !`);
            navigate(`/Game?id=${newGame.id}`);

        } catch (e) {
            console.error(e);
            toast.error("Erreur lors de l'envoi du défi");
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

        if (loading) return <div className="p-8 text-center text-gray-500">Chargement...</div>;
        
        if (players.length === 0) return (
            <div className="flex flex-col items-center justify-center py-12 bg-white/50 rounded-xl border-2 border-dashed border-[#d4c5b0] text-[#6b5138]">
                <Search className="w-10 h-10 mb-2 opacity-50" />
                <p>Aucun joueur de {type === 'chess' ? 'Échecs' : 'Dames'} en ligne pour le moment.</p>
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
                                    }`} title={status === 'playing' ? "En jeu" : "En ligne"}></div>
                                </div>
                                <div>
                                    <div className="font-bold text-[#4a3728] flex items-center gap-1">
                                        {player.full_name || 'Joueur'}
                                        {player.id === currentUser?.id && <span className="text-xs text-gray-500">(Moi)</span>}
                                    </div>
                                    <div className="text-xs text-[#6b5138] flex items-center gap-2">
                                        <Crown className="w-3 h-3 text-yellow-600" />
                                        ELO: {type === 'chess' ? (player.elo_chess || 1200) : (player.elo_checkers || 1200)}
                                    </div>
                                    <div className="text-[10px] text-gray-500 mt-0.5 font-medium">
                                        {status === 'playing' ? <span className="text-red-500">En partie</span> : <span className="text-green-600">Disponible</span>}
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
                                            title="Regarder la partie"
                                        >
                                            <Play className="w-4 h-4 mr-2" />
                                            Regarder
                                        </Button>
                                    ) : (
                                        <Button 
                                            size="sm" 
                                            className="bg-[#4a3728] hover:bg-[#2c1e12] text-[#e8dcc5]"
                                            onClick={() => handleChallenge(player, type)}
                                            title="Inviter à jouer"
                                        >
                                            <Swords className="w-4 h-4 mr-2" />
                                            Inviter
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
                <h1 className="text-4xl font-black text-[#4a3728] mb-2 font-serif">SALON DES JOUEURS</h1>
                <p className="text-[#6b5138]">Trouvez des adversaires en ligne et lancez des défis en temps réel.</p>
            </div>

            <Tabs defaultValue="games" className="w-full">
                <TabsList className="flex flex-col md:grid md:grid-cols-3 w-full bg-transparent md:bg-[#e8dcc5] p-0 md:p-1 gap-2 md:gap-0 rounded-xl mb-8 h-auto">
                    <TabsTrigger value="games" className="w-full data-[state=active]:bg-[#4a3728] data-[state=active]:text-[#e8dcc5] bg-[#e8dcc5]/50 md:bg-transparent text-[#6b5138] font-bold py-3 rounded-lg transition-all border md:border-none border-[#d4c5b0]">
                        <div className="flex items-center justify-center gap-2">
                            <Swords className="w-5 h-5" />
                            <span>Jouer</span>
                            <span className="ml-2 text-xs bg-black/10 data-[state=active]:bg-white/20 px-2 py-0.5 rounded-full">
                                {publicGames.length}
                            </span>
                        </div>
                    </TabsTrigger>
                    <TabsTrigger value="spectate" className="w-full data-[state=active]:bg-[#4a3728] data-[state=active]:text-[#e8dcc5] bg-[#e8dcc5]/50 md:bg-transparent text-[#6b5138] font-bold py-3 rounded-lg transition-all border md:border-none border-[#d4c5b0]">
                        <div className="flex items-center justify-center gap-2">
                            <Eye className="w-5 h-5" />
                            <span>Regarder</span>
                            <span className="ml-2 text-xs bg-black/10 data-[state=active]:bg-white/20 px-2 py-0.5 rounded-full">
                                {activeGames.filter(g => !g.is_private).length}
                            </span>
                        </div>
                    </TabsTrigger>
                    <TabsTrigger value="checkers" className="w-full data-[state=active]:bg-[#4a3728] data-[state=active]:text-[#e8dcc5] bg-[#e8dcc5]/50 md:bg-transparent text-[#6b5138] font-bold py-3 rounded-lg transition-all border md:border-none border-[#d4c5b0]">
                        <div className="flex items-center justify-center gap-2">
                            <Circle className="w-5 h-5" />
                            <span>Joueurs de Dames</span>
                            <span className="ml-2 text-xs bg-black/10 data-[state=active]:bg-white/20 px-2 py-0.5 rounded-full">
                                {users.filter(u => (u.default_game || 'checkers') === 'checkers').length}
                            </span>
                        </div>
                    </TabsTrigger>
                    <TabsTrigger value="chess" className="w-full data-[state=active]:bg-[#4a3728] data-[state=active]:text-[#e8dcc5] bg-[#e8dcc5]/50 md:bg-transparent text-[#6b5138] font-bold py-3 rounded-lg transition-all border md:border-none border-[#d4c5b0]">
                        <div className="flex items-center justify-center gap-2">
                            <Gamepad2 className="w-5 h-5" />
                            <span>Joueurs d'Échecs</span>
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
                                        <p>Aucune partie en cours à regarder.</p>
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
                                                    <div className="text-xs text-[#6b5138]">{game.game_type === 'chess' ? 'Échecs' : 'Dames'} • {game.initial_time || 10} min</div>
                                                </div>
                                            </div>
                                            <Button onClick={() => navigate(`/Game?id=${game.id}`)} variant="outline" className="border-[#d4c5b0] text-[#6b5138] hover:bg-[#f5f0e6]">
                                                <Eye className="w-4 h-4 mr-2" /> Regarder
                                            </Button>
                                        </Card>
                                    ))
                                )}
                            </div>
                        </div>
                        <div className="lg:w-96 hidden lg:block">
                             <div className="h-[600px] bg-white rounded-lg border border-[#d4c5b0] p-4 flex flex-col justify-center items-center text-center text-[#6b5138]">
                                 <MessagesSquare className="w-12 h-12 mb-2 opacity-20" />
                                 <p>Discutez du match dans le salon général</p>
                             </div>
                        </div>
                    </div>
                </TabsContent>

                <TabsContent value="games" className="animate-in fade-in duration-500">
                    <div className="flex flex-col lg:flex-row gap-6">
                        <div className="flex-1">
                            <div className="mb-6 flex gap-4 justify-center">
                                <Button onClick={() => handleCreatePublicGame('checkers')} className="bg-[#4a3728] hover:bg-[#2c1e12] text-[#e8dcc5] gap-2">
                                    <Circle className="w-4 h-4" /> Créer Dames
                                </Button>
                                <Button onClick={() => handleCreatePublicGame('chess')} className="bg-[#6B8E4E] hover:bg-[#5a7a40] text-white gap-2">
                                    <Gamepad2 className="w-4 h-4" /> Créer Échecs
                                </Button>
                            </div>

                            {publicGames.length === 0 ? (
                                 <div className="flex flex-col items-center justify-center py-12 bg-white/50 rounded-xl border-2 border-dashed border-[#d4c5b0] text-[#6b5138]">
                                    <Swords className="w-10 h-10 mb-2 opacity-50" />
                                    <p>Aucune partie publique en attente. Créez-en une !</p>
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
                                                    <div className="font-bold text-[#4a3728]">{game.white_player_name} <span className="font-normal text-gray-500">attend...</span></div>
                                                    <div className="text-xs text-[#6b5138]">{game.game_type === 'chess' ? 'Échecs' : 'Dames'} • {game.initial_time || 10} min</div>
                                                </div>
                                            </div>
                                            <Button onClick={() => handleJoinGame(game.id)} className="bg-[#6b5138] hover:bg-[#5c4430]">
                                                Rejoindre
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
                                            <MessagesSquare className="w-4 h-4 mr-2" /> Général
                                        </TabsTrigger>
                                        {myTeam && (
                                            <TabsTrigger value="team" className="flex-1 data-[state=active]:bg-[#4a3728] data-[state=active]:text-[#e8dcc5]">
                                                <Users className="w-4 h-4 mr-2" /> Équipe
                                            </TabsTrigger>
                                        )}
                                    </TabsList>
                                    <TabsContent value="global" className="flex-1 mt-2 h-full">
                                        <LobbyChat channelId="global" channelName="Salon Général" currentUser={currentUser} />
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
                                    <Label className="text-xs text-gray-500">Rechercher un joueur</Label>
                                    <Input 
                                        placeholder="Nom du joueur..." 
                                        value={playerFilter.name}
                                        onChange={(e) => setPlayerFilter(prev => ({ ...prev, name: e.target.value }))}
                                        className="h-9"
                                    />
                                </div>
                                <div className="w-32">
                                    <Label className="text-xs text-gray-500">ELO Min</Label>
                                    <Select value={playerFilter.elo_min.toString()} onValueChange={(v) => setPlayerFilter(prev => ({ ...prev, elo_min: parseInt(v) }))}>
                                        <SelectTrigger className="h-9">
                                            <SelectValue placeholder="0" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="0">Tous</SelectItem>
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
                                 <p>Le chat est disponible dans l'onglet "Parties Publiques"</p>
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
                                    <Label className="text-xs text-gray-500">Rechercher un joueur</Label>
                                    <Input 
                                        placeholder="Nom du joueur..." 
                                        value={playerFilter.name}
                                        onChange={(e) => setPlayerFilter(prev => ({ ...prev, name: e.target.value }))}
                                        className="h-9"
                                    />
                                </div>
                                <div className="w-32">
                                    <Label className="text-xs text-gray-500">ELO Min</Label>
                                    <Select value={playerFilter.elo_min.toString()} onValueChange={(v) => setPlayerFilter(prev => ({ ...prev, elo_min: parseInt(v) }))}>
                                        <SelectTrigger className="h-9">
                                            <SelectValue placeholder="0" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="0">Tous</SelectItem>
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
                                 <p>Le chat est disponible dans l'onglet "Parties Publiques"</p>
                             </div>
                        </div>
                    </div>
                </TabsContent>
            </Tabs>
        </div>
    );
}