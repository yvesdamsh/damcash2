import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { User, Circle, Swords, Crown, Gamepad2, Search } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { initializeBoard } from '@/components/checkersLogic';
import { initializeChessBoard } from '@/components/chessLogic';

export default function Lobby() {
    const [users, setUsers] = useState([]);
    const [publicGames, setPublicGames] = useState([]);
    const [loading, setLoading] = useState(true);
    const [currentUser, setCurrentUser] = useState(null);
    const navigate = useNavigate();

    const fetchData = async () => {
        try {
            // 1. Fetch Users (Online logic)
            const allUsers = await base44.entities.User.list({ limit: 100, sort: { last_seen: -1 } });
            const now = new Date();
            const onlineThreshold = 10 * 60 * 1000; 
            const onlineUsers = allUsers.filter(u => u.last_seen && (now - new Date(u.last_seen)) < onlineThreshold);
            setUsers(onlineUsers);

            // 2. Fetch Public Games
            const games = await base44.entities.Game.filter({ status: 'waiting', is_private: false }, '-created_date', 20);
            setPublicGames(games);
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        const init = async () => {
            const me = await base44.auth.me();
            setCurrentUser(me);
            fetchData();
        };
        init();
        
        const interval = setInterval(fetchData, 10000); // Faster refresh for lobby
        return () => clearInterval(interval);
    }, []);
        try {
            // Fetch users active in the last 10 minutes
            // Since we can't do complex date math in filter usually, we fetch list and filter in JS or use sort
            // We'll fetch users sorted by last_seen desc
            const allUsers = await base44.entities.User.list({ limit: 100, sort: { last_seen: -1 } });
            const now = new Date();
            const onlineThreshold = 10 * 60 * 1000; // 10 minutes

            const onlineUsers = allUsers.filter(u => {
                if (!u.last_seen) return false;
                return (now - new Date(u.last_seen)) < onlineThreshold;
            });

            setUsers(onlineUsers);
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        const init = async () => {
            const me = await base44.auth.me();
            setCurrentUser(me);
            fetchUsers();
        };
        init();
        
        const interval = setInterval(fetchUsers, 30000); // Refresh every 30s
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

            await base44.entities.Notification.create({
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
        // Filter players by their default_game preference
        const players = users.filter(u => {
            // If user has specific preference, strict match
            // If no preference, maybe show in both? Or default to Checkers?
            // User asked "ne jamais les mettre ensemble".
            const pref = u.default_game || 'checkers';
            return pref === type;
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
                {players.map(player => (
                    <Card key={player.id} className="p-4 flex items-center justify-between hover:shadow-md transition-all border-[#d4c5b0]">
                        <div className="flex items-center gap-3">
                            <div className="relative">
                                <div className="w-12 h-12 bg-gray-200 rounded-full flex items-center justify-center overflow-hidden border-2 border-white shadow-sm">
                                    {player.avatar_url ? <img src={player.avatar_url} className="w-full h-full object-cover" /> : <User className="w-6 h-6 text-gray-400" />}
                                </div>
                                <div className="absolute bottom-0 right-0 w-3.5 h-3.5 bg-green-500 border-2 border-white rounded-full" title="En ligne"></div>
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
                            </div>
                        </div>
                        {player.id !== currentUser?.id && (
                            <Button 
                                size="sm" 
                                className="bg-[#4a3728] hover:bg-[#2c1e12] text-[#e8dcc5]"
                                onClick={() => handleChallenge(player, type)}
                            >
                                <Swords className="w-4 h-4 mr-2" />
                                Défier
                            </Button>
                        )}
                    </Card>
                ))}
            </div>
        );
    };

    return (
        <div className="max-w-6xl mx-auto p-4 space-y-8">
            <div className="text-center mb-8">
                <h1 className="text-4xl font-black text-[#4a3728] mb-2 font-serif">SALON DES JOUEURS</h1>
                <p className="text-[#6b5138]">Trouvez des adversaires en ligne et lancez des défis en temps réel.</p>
            </div>

            <Tabs defaultValue="checkers" className="w-full">
                <TabsList className="flex flex-col md:grid md:grid-cols-3 w-full bg-transparent md:bg-[#e8dcc5] p-0 md:p-1 gap-2 md:gap-0 rounded-xl mb-8 h-auto">
                    <TabsTrigger value="games" className="w-full data-[state=active]:bg-[#4a3728] data-[state=active]:text-[#e8dcc5] bg-[#e8dcc5]/50 md:bg-transparent text-[#6b5138] font-bold py-3 rounded-lg transition-all border md:border-none border-[#d4c5b0]">
                        <div className="flex items-center justify-center gap-2">
                            <Swords className="w-5 h-5" />
                            <span>Parties Publiques</span>
                            <span className="ml-2 text-xs bg-black/10 data-[state=active]:bg-white/20 px-2 py-0.5 rounded-full">
                                {publicGames.length}
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

                <TabsContent value="games" className="animate-in fade-in duration-500">
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
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
                </TabsContent>

                <TabsContent value="checkers" className="animate-in fade-in duration-500">
                    <PlayerList type="checkers" />
                </TabsContent>

                <TabsContent value="chess" className="animate-in fade-in duration-500">
                    <PlayerList type="chess" />
                </TabsContent>
            </Tabs>
        </div>
    );
}